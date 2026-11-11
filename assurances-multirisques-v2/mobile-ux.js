/* =====================================================================
   mobile-ux.js — confort mobile et confirmation (LP comparateurpro.fr)
   ---------------------------------------------------------------------
   Module partagé, injecté dans CHAQUE landing page avant </body>.
   Ne touche ni au design ni aux fichiers CSS existants : tout est injecté
   à l'exécution, avec des styles à portée limitée préfixés `mux-`.

   Ce qu'il apporte :

   1. CONFIRMATION QUI RESTE LISIBLE
      Le handler d'origine redirige 3 s après le « Merci ! ». Sur mobile,
      3 s ne suffisent pas à lire le message. Une barre défilante bloque
      la redirection, et l'utilisateur choisit : « Continuer » (maintenant)
      ou « Rester » (annule la redirection).

   2. ZONES TACTILES CONFORMES (WCAG 2.5.5)
      Tout bouton ou lien d'action de moins de 44 × 44 px est agrandi
      **uniquement sur écran tactile** (pointer: coarse). Sur ordinateur,
      le rendu est strictement identique à aujourd'hui.

   3. PAS DE ZOOM AUTOMATIQUE SUR iOS
      Un champ dont la police fait moins de 16 px déclenche un zoom
      involontaire au focus sur iPhone, qui décale toute la page. Sur
      écran tactile, la police des champs est portée à 16 px.

   4. CIBLE D'ERREUR VISIBLE SUR MOBILE
      Quand un message d'erreur s'affiche, le champ fautif est amené à
      l'écran (au-dessus du clavier) au lieu de rester caché dessous.

   5. ÉTIQUETAGE DES CHAMPS
      Les champs dépourvus de <label> reçoivent un `aria-label` déduit de
      leur placeholder ou de leur nom, pour les lecteurs d'écran.

   Surcharge possible avant chargement :
     window.MOBILE_UX_CONFIG = { cibleTactile: 48, delaiRedirection: 8000 };
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = Object.assign({
    cibleTactile: 44,       // px — WCAG 2.5.5 (AAA 44, AA 24)
    policeMinChamp: 16,     // px — en dessous, iOS zoome au focus
    delaiRedirection: 8000, // ms — laisser le temps de lire le « Merci »
    etiqueter: true
  }, window.MOBILE_UX_CONFIG || {});

  var tactile = false;
  try { tactile = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
  // Repli pour les navigateurs anciens sans matchMedia
  if (!tactile) tactile = ('ontouchstart' in window) && window.innerWidth < 1024;

  /* ---------- 1. Styles injectés (portée limitée) ---------- */
  var CSS = [
    'body.mux-tactile .mux-tap{min-height:' + CONFIG.cibleTactile + 'px;min-width:' + CONFIG.cibleTactile + 'px;',
    'display:inline-flex;align-items:center;justify-content:center;}',
    'body.mux-tactile input:not([type=hidden]):not([type=radio]):not([type=checkbox]),',
    'body.mux-tactile select,body.mux-tactile textarea{font-size:' + CONFIG.policeMinChamp + 'px !important;}',
    '#mux-barre{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:none;',
    'background:#111;color:#fff;padding:14px 16px calc(14px + env(safe-area-inset-bottom));',
    'font:600 15px/-1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
    'box-shadow:0 -4px 16px rgba(0,0,0,.25);align-items:center;gap:12px;}',
    '#mux-barre.mux-actif{display:flex;}',
    '#mux-barre .mux-texte{flex:1;line-height:1.35;}',
    '#mux-barre button{appearance:none;border:0;border-radius:8px;padding:12px 16px;',
    'font:700 15px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer;',
    'min-height:' + CONFIG.cibleTactile + 'px;white-space:nowrap;}',
    '#mux-barre .mux-suite{background:#fff;color:#111;}',
    '#mux-barre .mux-rester{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);}',
    '.mux-erreur-vue{outline:3px solid #c62828 !important;outline-offset:2px;}'
  ].join('');

  function injecterStyles() {
    if (document.getElementById('mux-styles')) return;
    var s = document.createElement('style');
    s.id = 'mux-styles';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- 2. Confirmation : bloquer la redirection trop rapide ---------- */
  function barre(titre) {
    var b = document.getElementById('mux-barre');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'mux-barre';
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    b.innerHTML = '<span class="mux-texte"></span>' +
      '<button type="button" class="mux-suite">Continuer</button>' +
      '<button type="button" class="mux-rester">Rester</button>';
    b.querySelector('.mux-texte').textContent = titre;
    document.body.appendChild(b);
    return b;
  }

  // Neutralise location.href pendant `delaiRedirection` ms après le « Merci »,
  // puis propose le choix au lieu d'imposer la navigation.
  var merciDetecte = false;
  function verifierMerci() {
    if (merciDetecte) return;
    var done = document.querySelector('.w-form-done, .form-audi-success, .ubepro-merci');
    if (!done) return;
    // Un « Merci » est visible dès que son style inline n'est plus `display:none`.
    // On ne se fie pas à offsetParent (absent des environnements sans rendu).
    var visible = !/display\s*:\s*none/i.test(done.getAttribute('style') || '');
    if (!visible) return;
    merciDetecte = true;
    proposerPoursuite();
  }

  function protegerConfirmation() {
    try {
      new MutationObserver(verifierMerci).observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
      });
    } catch (e) {}
    // Filets de sécurité : périodique au début de vie de la page, et au submit.
    var tics = 0;
    var t = window.setInterval(function () { verifierMerci(); if (++tics > 120 || merciDetecte) window.clearInterval(t); }, 500);
    document.addEventListener('submit', function () {
      window.setTimeout(verifierMerci, 300);
      window.setTimeout(verifierMerci, 1200);
      window.setTimeout(verifierMerci, 2500);
    }, true);
  }

  function proposerPoursuite() {
    var redirige = false;
    // Intercepte les affectations de location.href / replace / assign
    var vrai = location.href;
    try {
      var verrou = true;
      window.setTimeout(function () { verrou = false; }, CONFIG.delaiRedirection);
      var proto = window.Location && window.Location.prototype;
      if (proto && proto.href) {
        var desc = Object.getOwnPropertyDescriptor(proto, 'href');
        if (desc && desc.set) {
          Object.defineProperty(proto, 'href', {
            configurable: true,
            get: desc.get,
            set: function (v) { if (verrou) { redirige = v; } else { desc.set.call(this, v); } }
          });
        }
      }
    } catch (e) { /* certains navigateurs refusent : on se rabat sur la barre */ }

    var tous = document.querySelectorAll('a[href]');
    for (var i = 0; i < tous.length; i++) {
      (function (a) {
        a.addEventListener('click', function (e) { if (verrou) { e.preventDefault(); } }, true);
      })(tous[i]);
    }
    var delai = Math.round(CONFIG.delaiRedirection / 1000);
    var b = barre('Votre demande est bien envoyée. Redirection automatique dans ' + delai + ' s.');
    b.classList.add('mux-actif');
    var suite = b.querySelector('.mux-suite');
    var rester = b.querySelector('.mux-rester');
    suite.addEventListener('click', function () {
      b.classList.remove('mux-actif');
      if (redirige) location.href = redirige;
      else if (verrou) { verrou = false; }
    });
    rester.addEventListener('click', function () {
      b.classList.remove('mux-actif');
      verrou = false;
    });
  }

  /* ---------- 3. Zones tactiles ---------- */
  var SELECTEUR_ACTION = 'a, button, [role="button"], input[type="submit"], input[type="button"], ' +
    '.bouton-valider, .w-button, [data-form="submit-btn"]';

  function agrandirCibles() {
    if (!tactile) return;
    document.body.classList.add('mux-tactile');
    var els = document.querySelectorAll(SELECTEUR_ACTION);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList.contains('mux-tap')) continue;
      var r = el.getBoundingClientRect();
      if (r.width < CONFIG.cibleTactile || r.height < CONFIG.cibleTactile) {
        el.classList.add('mux-tap');
      }
    }
  }

  /* ---------- 4. Étiquetage des champs ---------- */
  function etiqueter() {
    if (!CONFIG.etiqueter) return;
    var champs = document.querySelectorAll('input:not([type=hidden]), select, textarea');
    for (var i = 0; i < champs.length; i++) {
      var c = champs[i];
      if (c.getAttribute('aria-label') || c.getAttribute('aria-labelledby')) continue;
      if (c.labels && c.labels.length) continue;
      var txt = c.getAttribute('placeholder') || c.getAttribute('data-name') || c.getAttribute('name') || '';
      txt = String(txt).replace(/["_\-\d]+$/g, ' ').replace(/[_-]+/g, ' ').trim();
      if (txt) c.setAttribute('aria-label', txt.charAt(0).toUpperCase() + txt.slice(1));
    }
  }

  /* ---------- 5. Erreur visible au-dessus du clavier ---------- */
  function surveillerErreurs() {
    var observe = new MutationObserver(function () {
      var rouge = document.querySelector('[role="status"]');
      if (!rouge || rouge.offsetParent === null || !rouge.textContent) return;
      var cible = document.activeElement;
      if (cible && /^(INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) {
        cible.classList.add('mux-erreur-vue');
        try { cible.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { cible.scrollIntoView(); }
        window.setTimeout(function () { cible.classList.remove('mux-erreur-vue'); }, 2500);
      }
    });
    observe.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  /* ---------- Init ---------- */
  var initialise = false;
  function init() {
    if (initialise) return;
    initialise = true;
    injecterStyles();
    etiqueter();
    agrandirCibles();
    protegerConfirmation();
    surveillerErreurs();
    window.addEventListener('resize', agrandirCibles);
    window.mobileUx = { version: '2026-11-10-mux1', tactile: tactile, config: CONFIG };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    // Repli : certains contextes (iframes, scripts injectés tard) n'émettent pas
    // DOMContentLoaded ; `load` couvre ce cas, et init() est idempotent.
    window.addEventListener('load', init);
  } else {
    init();
  }
})();
