const emailJsConfig = {
  publicKey: '7l_HAZEX9KJId_NRw',
  serviceId: 'service_lhtetiu',
  // Template della notifica che arriva agli organizzatori
  templateId: 'template_8ogqjxg',
  // Template della mail di conferma che arriva a chi si iscrive.
  // ⚠️ Va creato su EmailJS (vedi ISTRUZIONI-EMAIL.md) e incollato qui.
  // Se resta uguale a templateId, la conferma usa lo stesso modello.
  templateIdUser: 'template_8ogqjxg',
  recipientEmail: 'Canoversecomicscosplay@gmail.com',
  eventName: 'CanoVerse 2026',
};

const ONE_PIECE_MAX = 16;

// Etichette leggibili delle categorie (nelle email, al posto dei codici)
const CATEGORY_LABELS = {
  cosplay_singolo: 'Gara Cosplay — Singolo',
  cosplay_gruppo: 'Gara Cosplay — Gruppo',
  kpop: 'Contest K-POP',
  tcg_onepiece: 'Torneo One Piece Card Game',
};

// Cosa portare / ricordare, in base alla categoria scelta
const CATEGORY_NOTES = {
  cosplay_singolo: 'Ricorda: non c\'è sfilata. I giudici in incognito valutano i costumi durante tutta la giornata, la premiazione è a fine serata.',
  cosplay_gruppo: 'Ricorda: non c\'è sfilata. I giudici in incognito valutano i costumi durante tutta la giornata, la premiazione è a fine serata.',
  kpop: 'Ricorda di portare la tua base musicale. Una giuria qualificata valuterà tecnica, sincronia e presenza scenica: in palio un buono Amazon.',
  tcg_onepiece: 'Ricorda di portare il tuo mazzo e i token, validi secondo la ban-list ufficiale. Quota di iscrizione: 12 €, da saldare in loco. Ogni partecipante riceve una bustina dell\'espansione corrente.',
};

function categoryLabel(code) {
  return CATEGORY_LABELS[code] || code;
}

// ── Anti-bot ────────────────────────────────────────────────────────
// Tempo minimo (ms) tra il caricamento del form e l'invio: sotto questa
// soglia l'invio è quasi certamente automatizzato. Un utente reale impiega
// diversi secondi (compila i campi + spunta i due checkbox di consenso).
const MIN_SUBMIT_MS = 1500;
// Istante in cui lo script è stato valutato (≈ form pronto in pagina).
const formReadyAt = Date.now();

function initEmailJS() {
  if (window.emailjs && !window.emailjsInitDone) {
    emailjs.init(emailJsConfig.publicKey);
    window.emailjsInitDone = true;
  }
}

// Testo della notifica per gli organizzatori
function buildEmailText(formData) {
  return [
    'Nuova registrazione dal modulo del sito.',
    '',
    'Nome / Nome d\'Arte: ' + formData.name,
    'Email: ' + formData.email,
    'Personaggio / Gioco: ' + (formData.character || 'N/A'),
    'Categoria: ' + categoryLabel(formData.category),
    'Note aggiuntive: ' + (formData.message || 'Nessuna'),
    '',
    '---',
    'CanoVerse — Festival 2026',
  ].join('\n');
}

// Testo della conferma per chi si è iscritto
function buildUserEmailText(formData) {
  const note = CATEGORY_NOTES[formData.category];
  return [
    'Ciao ' + formData.name + ',',
    '',
    'la tua iscrizione a CanoVerse 2026 è stata registrata.',
    '',
    '— RIEPILOGO —',
    'Categoria: ' + categoryLabel(formData.category),
    'Personaggio / Gioco / Brano: ' + (formData.character || 'non indicato'),
    formData.message ? 'Note: ' + formData.message : '',
    '',
    '— QUANDO E DOVE —',
    'Sabato 5 settembre 2026, dalle 10:30 alle 23:30',
    'Piazza Galluppi — Canosa di Puglia (BT)',
    'Ingresso libero e gratuito.',
    '',
    note ? '— DA RICORDARE —' : '',
    note || '',
    '',
    'Il tuo nome e il personaggio scelto compaiono nella lista pubblica degli iscritti sul sito.',
    'Se hai meno di 18 anni, porta al check-in il modulo di consenso firmato da un genitore o tutore.',
    '',
    'Per qualsiasi domanda rispondi a questa email.',
    'Ci vediamo al festival!',
    '',
    '---',
    'CanoVerse 2026 — Comics & Games',
    'Canosa di Puglia',
  ].filter(function (line) { return line !== ''; }).join('\n');
}

async function getOnePieceCount() {
  const snapshot = await db.collection('registrations')
    .where('category', '==', 'tcg_onepiece')
    .get();
  return snapshot.size;
}

async function saveRegistration(formData) {
  const registrationData = {
    name: formData.name,
    character: formData.character || '',
    category: formData.category,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (formData.category !== 'tcg_onepiece') {
    await db.collection('registrations').add(registrationData);
    return;
  }

  // Il tetto di ONE_PIECE_MAX posti è imposto anche dalle Firestore
  // Security Rules tramite meta/tcg_onepiece_count: se qualcuno prova a
  // registrarsi oltre il limite (anche bypassando il sito), la transazione
  // viene rifiutata dal database, non solo dal controllo lato client.
  const counterRef = db.collection('meta').doc('tcg_onepiece_count');
  const registrationRef = db.collection('registrations').doc();

  await db.runTransaction(async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists ? counterSnap.data().count : 0;
    if (current >= ONE_PIECE_MAX) {
      throw new Error('SOLD_OUT');
    }
    transaction.update(counterRef, { count: current + 1 });
    transaction.set(registrationRef, registrationData);
  });
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('cosplayForm');
  const successMsg = document.getElementById('successMessage');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (!form || !successMsg) return false;

  // ── Filtro anti-bot (honeypot + tempo minimo) ──
  // Attivo solo se il markup honeypot è presente (pagina reale); nei test
  // unitari il campo non c'è e il controllo viene saltato.
  const honeypot = form.querySelector('#website');
  if (honeypot) {
    const tooFast = (Date.now() - formReadyAt) < MIN_SUBMIT_MS;
    if (honeypot.value.trim() !== '' || tooFast) {
      // Probabile bot: mostra un finto esito positivo senza inviare email
      // né salvare nulla su Firestore, così l'automazione non capisce di
      // essere stata bloccata.
      form.style.display = 'none';
      successMsg.classList.remove('hidden');
      return true;
    }
  }

  const name = form.querySelector('#name');
  const email = form.querySelector('#email');
  const character = form.querySelector('#character');
  const type = form.querySelector('#type');
  const message = form.querySelector('#message');

  if (!name || !email || !type) return false;

  const formData = {
    name: name.value.trim(),
    email: email.value.trim(),
    character: character ? character.value.trim() : '',
    category: type.value,
    message: message ? message.value.trim() : '',
  };

  const validation = validateForm(form);
  if (!validation.valid) {
    if (validation.errors.includes('privacy_consent') || validation.errors.includes('age_consent')) {
      alert('Per favore conferma di aver letto l\'Informativa Privacy e la dichiarazione sull\'età per procedere con l\'iscrizione.');
    } else {
      alert('Per favore compila correttamente i campi obbligatori: nome, email e categoria.');
    }
    return false;
  }

  if (formData.category === 'tcg_onepiece') {
    const count = await getOnePieceCount();
    if (count >= ONE_PIECE_MAX) {
      alert('Siamo spiacenti, i posti per il torneo One Piece Card Game sono esauriti (16/16).');
      return false;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Invio in corso...';
  }

  initEmailJS();

  // 1) Notifica agli organizzatori
  const adminParams = {
    from_name: formData.name,
    from_email: formData.email,
    reply_to: formData.email,
    to_name: emailJsConfig.eventName,
    to_email: emailJsConfig.recipientEmail,
    subject: 'Nuova iscrizione — ' + categoryLabel(formData.category),
    message: buildEmailText(formData),
  };

  // 2) Conferma a chi si è iscritto
  const userParams = {
    from_name: emailJsConfig.eventName,
    from_email: emailJsConfig.recipientEmail,
    reply_to: emailJsConfig.recipientEmail,
    to_name: formData.name,
    to_email: formData.email,
    subject: 'Iscrizione confermata — ' + emailJsConfig.eventName,
    message: buildUserEmailText(formData),
  };

  try {
    // La notifica agli organizzatori è quella indispensabile: se fallisce,
    // l'iscrizione non va a buon fine.
    await emailjs.send(emailJsConfig.serviceId, emailJsConfig.templateId, adminParams);

    // La conferma all'utente è un "di più": se non parte (template non
    // ancora configurato, indirizzo inesistente...) l'iscrizione resta
    // comunque valida, ce lo segniamo solo in console.
    emailjs
      .send(emailJsConfig.serviceId, emailJsConfig.templateIdUser, userParams)
      .catch(function (err) {
        console.warn('Conferma all\'iscritto non inviata:', err);
      });

    await saveRegistration(formData);
    form.style.display = 'none';
    successMsg.classList.remove('hidden');
    successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    console.error('Errore:', error);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Invia Modulo';
    }
    if (error && error.message === 'SOLD_OUT') {
      alert('Siamo spiacenti, i posti per il torneo One Piece Card Game sono esauriti (16/16).');
    } else {
      alert('C\'è stato un problema nell\'invio. Controlla le impostazioni e riprova.');
    }
  }

  return true;
}

function validateForm(formElement) {
  const errors = [];
  const name = formElement.querySelector('#name');
  const email = formElement.querySelector('#email');
  const category = formElement.querySelector('#type');
  const privacyConsent = formElement.querySelector('#privacy-consent');
  const ageConsent = formElement.querySelector('#age-consent');

  if (!name || !name.value.trim()) errors.push('name');
  if (!email || !email.value.trim()) errors.push('email');
  else if (!isValidEmail(email.value.trim())) errors.push('email_format');
  if (!category || !category.value) errors.push('category');
  if (privacyConsent && !privacyConsent.checked) errors.push('privacy_consent');
  if (ageConsent && !ageConsent.checked) errors.push('age_consent');

  return { valid: errors.length === 0, errors };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleFormSubmit, validateForm, isValidEmail, buildEmailText, buildUserEmailText, categoryLabel };
}
