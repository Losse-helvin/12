/* =====================================================================
   mobile-ux.js — confort mobile et confirmation (LP comparateurpro.fr)
   ---------------------------------------------------------------------
   Module partagé, injecté dans CHAQUE landing page avant </body>.
   Ne touche ni au design ni aux fichiers CSS existants : tout est injecté
   à l'exécution, avec des styles à portée limitée préfixés `mux-`.

   Ce qu'il apporte :

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
     window.MOBILE_UX_CONFIG = { cibleTactile: 48 };
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = Object.assign({
    cibleTactile: 44,       // px — WCAG 2.5.5 (AAA 44, AA 24)
    policeMinChamp: 16,     // px — en dessous, iOS zoome au focus
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
    '.mux-erreur-vue{outline:3px solid #c62828 !important;outline-offset:2px;}'
  ].join('');

  function injecterStyles() {
    if (document.getElementById('mux-styles')) return;
    var s = document.createElement('style');
    s.id = 'mux-styles';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
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
      if (!document || !document.body) return;
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
    surveillerErreurs();
    window.addEventListener('resize', agrandirCibles);
    window.mobileUx = { version: '2026-11-10-mux2', tactile: tactile, config: CONFIG };
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
