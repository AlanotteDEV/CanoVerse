/* ══════════════════════════════════════════════════════════════════
   CanoVerse — Cookie Consent (self-hosted, GDPR / ePrivacy)
   ------------------------------------------------------------------
   Banner con "Accetta tutti", "Rifiuta" (solo necessari) e
   "Personalizza" (selezione granulare per categoria).
   Nessun cookie/tracciante non necessario viene attivato senza
   consenso esplicito (opt-in): le categorie non necessarie sono
   disattivate di default.

   Categorie:
     - necessary   : sempre attive (funzionamento sito, form, database)
     - statistics  : analisi d'uso in forma aggregata (opt-in)
     - thirdparty  : contenuti da terze parti, es. mappa Google (opt-in)

   Per collegare un contenuto a una categoria:
     <iframe suppressedsrc="..." src="about:blank"> ...   (mappa Google)
     <script type="text/plain" data-consent="statistics" data-src="..."></script>
   Riapri le preferenze da un link:  class="cookie-preferences-link"
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'canoverse_cookie_consent';
  var CONSENT_VERSION = 1;
  // Il consenso va rinnovato periodicamente (prassi/Linee guida Garante):
  // scaduto questo periodo il banner viene riproposto.
  var CONSENT_MAX_AGE_DAYS = 180;

  /* ---------- Stato consenso ---------- */
  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== CONSENT_VERSION) return null;
      if (data.timestamp) {
        var age = Date.now() - new Date(data.timestamp).getTime();
        if (isNaN(age) || age > CONSENT_MAX_AGE_DAYS * 86400000) return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(prefs) {
    var data = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      necessary: true,
      statistics: !!prefs.statistics,
      thirdparty: !!prefs.thirdparty
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
    logConsent(data);
    applyConsent(data);
    return data;
  }

  // Registro del consenso (prova ex art. 7 GDPR): salva su Firestore la data,
  // le categorie scelte e la versione dell'informativa, SENZA dati identificativi.
  // Se Firebase non è presente sulla pagina (es. privacy/cookie), viene saltato.
  function logConsent(data) {
    try {
      if (!window.db || !window.firebase || !firebase.firestore) return;
      window.db.collection('cookie_consents').add({
        necessary: true,
        statistics: !!data.statistics,
        thirdparty: !!data.thirdparty,
        policyVersion: CONSENT_VERSION,
        page: String(location.pathname).substring(0, 200),
        userAgent: String(navigator.userAgent).substring(0, 400),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Applica il consenso alla pagina ---------- */
  function applyConsent(data) {
    if (data.thirdparty) activateThirdParty();
    if (data.statistics) activateCategoryScripts('statistics');
    refreshBlockedEmbeds(data);
    window.dispatchEvent(new CustomEvent('canoverse:consent', { detail: data }));
  }

  // Sblocca gli iframe con "suppressedsrc" (mappa Google ecc.)
  function activateThirdParty() {
    var nodes = document.querySelectorAll('iframe[suppressedsrc], [data-consent-src]');
    Array.prototype.forEach.call(nodes, function (el) {
      var s = el.getAttribute('suppressedsrc') || el.getAttribute('data-consent-src');
      if (s && el.getAttribute('src') !== s) el.setAttribute('src', s);
    });
    removeAllOverlays();
  }

  // Attiva eventuali <script type="text/plain" data-consent="..." data-src="...">
  function activateCategoryScripts(category) {
    var nodes = document.querySelectorAll('script[type="text/plain"][data-consent="' + category + '"]');
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute('data-activated')) return;
      var s = document.createElement('script');
      if (node.getAttribute('data-src')) s.src = node.getAttribute('data-src');
      else s.textContent = node.textContent;
      node.setAttribute('data-activated', '1');
      node.parentNode.insertBefore(s, node.nextSibling);
    });
  }

  /* ---------- Placeholder sui contenuti bloccati ---------- */
  function refreshBlockedEmbeds(data) {
    var frames = document.querySelectorAll('iframe[suppressedsrc]');
    Array.prototype.forEach.call(frames, function (frame) {
      var active = frame.getAttribute('src') && frame.getAttribute('src') !== 'about:blank';
      if (data && data.thirdparty && !active) {
        var s = frame.getAttribute('suppressedsrc');
        if (s) frame.setAttribute('src', s);
        return;
      }
      if (!data || !data.thirdparty) addOverlay(frame);
    });
  }

  function addOverlay(frame) {
    var parent = frame.parentNode;
    if (!parent || parent.querySelector('.cvc-embed-overlay')) return;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    var ov = document.createElement('div');
    ov.className = 'cvc-embed-overlay';
    ov.innerHTML =
      '<div class="cvc-embed-inner">' +
        '<div class="cvc-embed-ico">🗺️</div>' +
        '<p class="cvc-embed-txt">Questo contenuto è fornito da <strong>Google Maps</strong> e può installare cookie di terze parti. Per visualizzarlo autorizza i cookie di terze parti.</p>' +
        '<button type="button" class="cvc-btn cvc-btn-primary cvc-embed-accept">Attiva contenuto</button>' +
        '<button type="button" class="cvc-btn cvc-btn-link cvc-embed-prefs">Gestisci preferenze</button>' +
      '</div>';
    parent.appendChild(ov);
    ov.querySelector('.cvc-embed-accept').addEventListener('click', function () {
      var c = getConsent() || {};
      saveConsent({ statistics: !!c.statistics, thirdparty: true });
    });
    ov.querySelector('.cvc-embed-prefs').addEventListener('click', openPreferences);
  }

  function removeAllOverlays() {
    var ovs = document.querySelectorAll('.cvc-embed-overlay');
    Array.prototype.forEach.call(ovs, function (o) { o.parentNode.removeChild(o); });
  }

  /* ---------- Stili ---------- */
  function injectStyles() {
    if (document.getElementById('cvc-styles')) return;
    var css = [
      ':root{--cvc-yellow:#19a7b5;--cvc-bg:#150a2b;--cvc-ink:#ffffff;--cvc-muted:#c3b3e6;--cvc-line:#2ce8c8;--cvc-pink:#ff2d95;}',
      '.cvc-hidden{display:none!important;}',
      '.cvc-root,.cvc-root *{box-sizing:border-box;font-family:Inter,system-ui,sans-serif;}',
      /* Banner */
      '.cvc-banner{position:fixed;z-index:2147483000;left:16px;right:16px;bottom:16px;margin:0 auto;max-width:560px;background:var(--cvc-bg);border:2px solid var(--cvc-line);box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 26px rgba(44,232,200,.4);padding:22px 22px 18px;animation:cvc-in .35s cubic-bezier(.2,.9,.3,1.2);}',
      '@keyframes cvc-in{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}',
      '.cvc-badge{display:inline-flex;align-items:center;gap:7px;background:var(--cvc-yellow);border:2px solid rgba(0,0,0,.4);color:#fff;font-weight:800;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:4px 10px;margin-bottom:12px;}',
      '.cvc-title{font-size:19px;font-weight:800;color:var(--cvc-ink);margin:0 0 6px;letter-spacing:-.01em;}',
      '.cvc-text{font-size:13.5px;line-height:1.55;color:var(--cvc-muted);margin:0 0 16px;}',
      '.cvc-text a{color:var(--cvc-line);font-weight:700;text-decoration:underline;text-underline-offset:2px;}',
      '.cvc-text a:hover{color:#000;}',
      '.cvc-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}',
      /* Bottoni */
      '.cvc-btn{font-family:inherit;font-weight:800;font-size:13.5px;cursor:pointer;padding:11px 18px;border:2px solid var(--cvc-line);background:rgba(255,255,255,.06);color:var(--cvc-ink);transition:transform .12s ease,box-shadow .12s ease,background .12s ease;letter-spacing:.01em;}',
      '.cvc-btn:hover{transform:translateY(-2px);box-shadow:0 0 18px rgba(44,232,200,.7);background:rgba(44,232,200,.14);}',
      '.cvc-btn:active{transform:translate(0,0);box-shadow:none;}',
      '.cvc-btn-primary{background:var(--cvc-yellow);}',
      '.cvc-btn-ghost{background:transparent;}',
      /* Pulsanti Accetta/Rifiuta con pari dignità (Linee guida Garante: nessun nudge) */
      '.cvc-btn-equal{background:rgba(255,255,255,.07);min-width:150px;flex:1 1 0;text-align:center;}',
      '.cvc-btn-link{border:none;background:none;text-decoration:underline;text-underline-offset:3px;padding:11px 6px;color:var(--cvc-muted);box-shadow:none!important;transform:none!important;}',
      '.cvc-btn-link:hover{color:var(--cvc-line);}',
      '.cvc-actions .cvc-grow{flex:1 1 auto;}',
      /* Overlay modale */
      '.cvc-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(17,17,17,.55);display:flex;align-items:center;justify-content:center;padding:16px;animation:cvc-fade .25s ease;}',
      '@keyframes cvc-fade{from{opacity:0;}to{opacity:1;}}',
      '.cvc-modal{width:100%;max-width:600px;max-height:90vh;overflow:auto;background:var(--cvc-bg);border:2px solid var(--cvc-line);box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 30px rgba(44,232,200,.45);padding:26px;}',
      '.cvc-modal h2{font-size:22px;font-weight:800;margin:0 0 4px;color:var(--cvc-ink);letter-spacing:-.01em;}',
      '.cvc-modal .cvc-text{margin-bottom:20px;}',
      /* Categorie */
      '.cvc-cat{border:2px solid rgba(44,232,200,.4);background:rgba(255,255,255,.05);padding:15px 16px;margin-bottom:12px;}',
      '.cvc-cat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}',
      '.cvc-cat-name{font-weight:800;font-size:14.5px;color:var(--cvc-ink);}',
      '.cvc-cat-desc{font-size:12.5px;line-height:1.5;color:var(--cvc-muted);margin:8px 0 0;}',
      '.cvc-tag{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--cvc-muted);}',
      /* Toggle */
      '.cvc-switch{position:relative;width:46px;height:26px;flex:0 0 auto;}',
      '.cvc-switch input{opacity:0;width:0;height:0;position:absolute;}',
      '.cvc-slider{position:absolute;inset:0;background:rgba(255,255,255,.12);border:2px solid rgba(44,232,200,.5);cursor:pointer;transition:background .18s;}',
      '.cvc-slider:before{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border:2px solid rgba(0,0,0,.4);transition:transform .18s;}',
      '.cvc-switch input:checked + .cvc-slider{background:var(--cvc-yellow);}',
      '.cvc-switch input:checked + .cvc-slider:before{transform:translateX(20px);}',
      '.cvc-switch input:disabled + .cvc-slider{opacity:.6;cursor:not-allowed;}',
      '.cvc-modal-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px;}',
      /* Overlay contenuti bloccati */
      '.cvc-embed-overlay{position:absolute;inset:0;background:rgba(21,10,43,.96);display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;}',
      '.cvc-embed-inner{max-width:340px;}',
      '.cvc-embed-ico{font-size:34px;margin-bottom:8px;}',
      '.cvc-embed-txt{font-size:13px;line-height:1.5;color:var(--cvc-muted);margin:0 0 14px;}',
      '.cvc-embed-txt strong{color:var(--cvc-ink);}',
      '.cvc-embed-overlay .cvc-btn{display:inline-block;margin:0 4px;}',
      /* Responsive */
      '@media(max-width:520px){.cvc-banner{left:8px;right:8px;bottom:8px;padding:18px 16px;box-shadow:0 0 22px rgba(44,232,200,.4);}.cvc-actions{flex-direction:column;align-items:stretch;}.cvc-btn{width:100%;text-align:center;}.cvc-btn-link{width:auto;}.cvc-modal{padding:20px;}}',
      /* In stampa il banner/modale/overlay non devono comparire */
      '@media print{.cvc-banner,.cvc-overlay,.cvc-embed-overlay{display:none!important;}}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'cvc-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------- Banner ---------- */
  var bannerEl = null;
  function buildBanner() {
    if (bannerEl) return bannerEl;
    var b = document.createElement('div');
    b.className = 'cvc-root cvc-banner cvc-hidden';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-live', 'polite');
    b.setAttribute('aria-label', 'Informativa cookie');
    b.innerHTML =
      '<span class="cvc-badge">🍪 Cookie</span>' +
      '<h2 class="cvc-title">Rispettiamo la tua privacy</h2>' +
      '<p class="cvc-text">Usiamo cookie tecnici necessari al funzionamento del sito e, previo tuo consenso, ' +
      'cookie statistici e di terze parti (es. la mappa Google). Puoi accettarli tutti, rifiutarli o scegliere. ' +
      'Dettagli nella <a href="cookie.html" target="_blank" rel="noopener">Cookie Policy</a> ' +
      'e nella <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>' +
      '<div class="cvc-actions">' +
        '<button type="button" class="cvc-btn cvc-btn-equal" data-cvc="accept">Accetta tutti</button>' +
        '<button type="button" class="cvc-btn cvc-btn-equal" data-cvc="reject">Rifiuta tutti</button>' +
        '<button type="button" class="cvc-btn cvc-btn-link" data-cvc="customize">Personalizza</button>' +
      '</div>';
    document.body.appendChild(b);
    b.querySelector('[data-cvc="accept"]').addEventListener('click', function () {
      saveConsent({ statistics: true, thirdparty: true });
      hideBanner();
    });
    b.querySelector('[data-cvc="reject"]').addEventListener('click', function () {
      saveConsent({ statistics: false, thirdparty: false });
      hideBanner();
    });
    b.querySelector('[data-cvc="customize"]').addEventListener('click', openPreferences);
    bannerEl = b;
    return b;
  }

  function showBanner() { buildBanner().classList.remove('cvc-hidden'); }
  function hideBanner() { if (bannerEl) bannerEl.classList.add('cvc-hidden'); }

  /* ---------- Modale preferenze ---------- */
  function openPreferences() {
    var current = getConsent() || { statistics: false, thirdparty: false };
    var ov = document.createElement('div');
    ov.className = 'cvc-root cvc-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Preferenze cookie');
    ov.innerHTML =
      '<div class="cvc-modal">' +
        '<h2>Preferenze cookie</h2>' +
        '<p class="cvc-text">Attiva o disattiva le categorie di cookie. I cookie necessari non possono essere disattivati perché indispensabili al funzionamento del sito.</p>' +
        cat('necessary', 'Necessari', 'Sempre attivi', true, true,
            'Garantiscono il funzionamento del sito, l\'invio del modulo d\'iscrizione (EmailJS) e la gestione delle iscrizioni sul database (Firebase). Includono la memorizzazione della tua scelta sui cookie.') +
        cat('statistics', 'Statistici', null, current.statistics, false,
            'Ci aiutano a capire in forma aggregata e anonima come viene usato il sito, per migliorarlo. Attualmente non sono attivi strumenti statistici: la categoria è predisposta per un eventuale uso futuro.') +
        cat('thirdparty', 'Terze parti', null, current.thirdparty, false,
            'Abilitano contenuti forniti da servizi esterni, come la mappa interattiva di Google Maps, che possono installare cookie propri.') +
        '<div class="cvc-modal-actions">' +
          '<button type="button" class="cvc-btn cvc-btn-primary" data-cvc="save">Salva preferenze</button>' +
          '<button type="button" class="cvc-btn cvc-btn-ghost" data-cvc="accept-all">Accetta tutti</button>' +
          '<button type="button" class="cvc-btn cvc-btn-ghost" data-cvc="reject-all">Rifiuta</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function readToggle(id) {
      var el = ov.querySelector('#cvc-t-' + id);
      return el ? el.checked : false;
    }
    ov.querySelector('[data-cvc="save"]').addEventListener('click', function () {
      saveConsent({ statistics: readToggle('statistics'), thirdparty: readToggle('thirdparty') });
      close(); hideBanner();
    });
    ov.querySelector('[data-cvc="accept-all"]').addEventListener('click', function () {
      saveConsent({ statistics: true, thirdparty: true }); close(); hideBanner();
    });
    ov.querySelector('[data-cvc="reject-all"]').addEventListener('click', function () {
      saveConsent({ statistics: false, thirdparty: false }); close(); hideBanner();
    });
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  function cat(id, name, tag, checked, disabled, desc) {
    return '<div class="cvc-cat">' +
      '<div class="cvc-cat-head">' +
        '<span class="cvc-cat-name">' + name + '</span>' +
        (tag
          ? '<span class="cvc-tag">' + tag + '</span>'
          : '<label class="cvc-switch"><input type="checkbox" id="cvc-t-' + id + '"' +
            (checked ? ' checked' : '') + (disabled ? ' disabled' : '') +
            '><span class="cvc-slider"></span></label>') +
      '</div>' +
      '<p class="cvc-cat-desc">' + desc + '</p>' +
    '</div>';
  }

  /* ---------- Collega i link "Preferenze cookie" ---------- */
  function bindPreferenceLinks() {
    var links = document.querySelectorAll('.cookie-preferences-link, .iubenda-cs-preferences-link');
    Array.prototype.forEach.call(links, function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); openPreferences(); });
    });
  }

  /* ---------- API pubblica ---------- */
  window.CanoVerseConsent = {
    open: openPreferences,
    get: getConsent,
    reset: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} showBanner(); }
  };

  /* ---------- Avvio ---------- */
  function init() {
    injectStyles();
    bindPreferenceLinks();
    var consent = getConsent();
    if (consent) {
      applyConsent(consent);
    } else {
      refreshBlockedEmbeds(null); // mostra placeholder sui contenuti bloccati
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
