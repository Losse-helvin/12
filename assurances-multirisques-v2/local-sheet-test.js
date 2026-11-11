/* Test local uniquement : envoyer le questionnaire au même Apps Script que l'autre LP.
   Ce script charge le fetch natif avant le shim local, qui simule les appels externes. */
(function () {
  'use strict';
  var host = window.location.hostname;
  var local = !host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' ||
    /\.localhost$|\.local$|\.e2b\.app$/i.test(host);
  if (!local) return;

  var form = document.querySelector('form.form-ass');
  if (!form) return;
  var nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  var url = form.getAttribute('data-google-script-url');
  var button = form.querySelector('[type="submit"]');
  var done = form.parentElement.querySelector('.w-form-done');
  // Les étapes masquées contiennent des champs required : les vérifier ci-dessous
  // selon la branche suivie, plutôt que bloquer la soumission native sur ces champs.
  form.noValidate = true;
  var error = document.createElement('p');
  error.setAttribute('role', 'alert');
  error.style.color = '#b42318';
  form.appendChild(error);
  var sending = false;
  var leadId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() :
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

  function value(name) {
    var field = form.querySelector('[name="' + name + '"]:checked') ||
      form.querySelector('[name="' + name + '"]:not([type="radio"]):not([type="checkbox"])');
    return field ? field.value.trim() : '';
  }

  function payload() {
    var insurance = [];
    form.querySelectorAll('input[name^="reponse_1_"]:checked').forEach(function (input) {
      var label = value(input.name.replace('reponse_', 'reponse_lib_'));
      if (label) insurance.push(label);
    });
    var merchandise = form.querySelector('[name="reponse_1_3"]:checked') ? value('reponse_champ_1_3') : '';
    var extra = [value('question_4') + ' ' + value('reponse_4')];
    if (merchandise) extra.push(value('reponse_champ_lib_1_3') + ' ' + merchandise);
    var fields = {
      form_id: form.id, id_lead: leadId, telephone_verifie: 'non',
      question_1: value('question_1'), reponse_1: insurance.join(', '),
      question_2: value('question_2'), reponse_2: value('reponse_2'),
      question_3: value('question_3'), reponse_3: value('reponse_2') === '0 à 1' ? value('reponse_3') : '',
      question_4: value('question_4'), reponse_4: value('reponse_4'),
      solution: insurance.join(', '), enjeu: extra.join(' | '),
      source: value('source'), categorie: value('categorie'), user: value('user'),
      gclid: value('gclid'), consentement: value('consentement'), website: ''
    };
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (key) { body.append(key, fields[key]); });
    return body;
  }

  form.addEventListener('submit', function (event) {
    // Empêcher Webflow, le shim de succès et les handlers CRM/tracking de traiter cet envoi.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (sending) return;
    error.textContent = '';
    if (!form.querySelector('input[name^="reponse_1_"]:checked') || !value('reponse_2') ||
        (value('reponse_2') === '0 à 1' && !value('reponse_3')) || !value('reponse_4') ||
        (form.querySelector('[name="reponse_1_3"]:checked') && !value('reponse_champ_1_3'))) {
      error.textContent = 'Veuillez compléter les réponses aux étapes précédentes.';
      return;
    }
    if (value('consentement') !== 'oui') {
      error.textContent = 'Veuillez accepter l’utilisation de vos informations avant de valider.';
      return;
    }
    if (!nativeFetch || !url) {
      error.textContent = 'Envoi Google Sheets indisponible dans ce navigateur.';
      return;
    }
    sending = true;
    if (button) { button.disabled = true; button.value = 'Envoi…'; }
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, 15000) : null;
    nativeFetch(url, { method: 'POST', mode: 'cors', credentials: 'omit', body: payload(),
      signal: controller ? controller.signal : undefined })
      .then(function (response) {
        return response.json().catch(function () { return null; }).then(function (json) {
          if (!response.ok || !json || json.status !== 'ok') throw new Error('Envoi non confirmé');
        });
      }).then(function () {
        form.style.display = 'none';
        if (done) {
          done.textContent = 'Test local : questionnaire enregistré dans Google Sheets, sans envoi SMS ni CRM.';
          done.style.display = 'block';
        }
      }).catch(function () {
        error.textContent = 'Nous n’avons pas pu transmettre votre demande à Google Sheets. Vérifiez votre connexion puis réessayez.';
      }).finally(function () {
        if (timer) window.clearTimeout(timer);
        sending = false;
        if (button) { button.disabled = false; button.value = 'Valider'; }
      });
  }, true);
})();
