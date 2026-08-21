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

// Posti totali del torneo One Piece Card Game. Se cambia, vanno aggiornati
// anche firestore.rules (che impone lo stesso tetto lato server) e i testi
// in index.html.
const ONE_PIECE_MAX = 20;
const ONE_PIECE_SOLD_OUT_MSG =
  'Siamo spiacenti, i posti per il torneo One Piece Card Game sono esauriti (' +
  ONE_PIECE_MAX + '/' + ONE_PIECE_MAX + ').';

// Etichette leggibili delle categorie (nelle email, al posto dei codici)
const CATEGORY_LABELS = {
  cosplay_singolo: 'Gara Cosplay — Singolo',
  cosplay_gruppo: 'Gara Cosplay — Gruppo',
  kpop: 'Contest K-POP',
  tcg_onepiece: 'Torneo One Piece Card Game',
  workshop_cucito: 'Workshop di cucito «Un punto alla volta»',
};

// Cosa portare / ricordare, in base alla categoria scelta
const CATEGORY_NOTES = {
  cosplay_singolo: 'Ricorda: non c\'è sfilata. I giudici in incognito valutano i costumi durante tutta la giornata, la premiazione è a fine serata. Al miglior cosplay in assoluto va un buono Manbaga.',
  cosplay_gruppo: 'Ricorda: non c\'è sfilata. I giudici in incognito valutano i costumi durante tutta la giornata, la premiazione è a fine serata. Al miglior cosplay in assoluto va un buono Manbaga.',
  kpop: 'IMPORTANTE — entro il 31 agosto invia il brano dell\'esibizione a Canoversecomicscosplay@gmail.com, indicando il nome della crew (o del solista) e il titolo del brano. La traccia deve durare al massimo 5 minuti ed essere la versione studio (mashup e remix ammessi, alle stesse condizioni).\nOgni crew o solista può occupare un solo slot in gara.\nSe sei in crew, indica l\'eta di ogni membro: per i minorenni serve la liberatoria firmata dai tutori legali, da consegnare in cartaceo o via email.\nIl giorno dell\'evento presentati in fiera almeno un\'ora prima per l\'organizzazione della scaletta: chi non si presenta entro quell\'ora viene eliminato direttamente.\nValuta una giuria qualificata; al vincitore una coppa.',
  workshop_cucito: 'Il workshop e gratuito e aperto a tutti i livelli, anche a chi non ha mai cucito. L\'iscrizione serve a organizzare il materiale: chi non si iscrive puo comunque partecipare, ma non possiamo garantire la disponibilita del materiale necessario. Iscrizioni entro il 3 settembre.',
  tcg_onepiece: 'Quota di iscrizione: 15 €, da saldare in loco. Il regolamento completo del torneo (formato, ban-list, premi e cosa portare) e in fase di definizione: lo pubblicheremo sul sito e ti avviseremo appena disponibile.',
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
    'Sabato 5 settembre 2026, dalle 10:30 a mezzanotte',
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

// Posti già occupati al torneo, letti dal contatore meta/tcg_onepiece_count:
// è lo stesso documento su cui lavora la transazione di saveRegistration, e
// l'unico a cui guardano le Security Rules. Contare invece i documenti in
// `registrations` significherebbe leggere una fonte diversa da quella che
// decide davvero, con il rischio di dire "ci sono ancora posti" e poi
// rifiutare l'iscrizione (o viceversa) se le due si disallineano.
async function getOnePieceCount() {
  const snapshot = await db.collection('meta').doc('tcg_onepiece_count').get();
  return snapshot.exists ? snapshot.data().count : 0;
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
    // Se la lettura del contatore fallisce (rete assente, permessi...) non
    // blocchiamo l'utente qui: l'ultima parola spetta comunque alla
    // transazione atomica in saveRegistration.
    let count = null;
    try {
      count = await getOnePieceCount();
    } catch (err) {
      console.warn('Contatore posti non leggibile:', err);
    }
    if (count !== null && count >= ONE_PIECE_MAX) {
      alert(ONE_PIECE_SOLD_OUT_MSG);
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

  // Diventa true appena il posto è riservato su Firestore: da quel momento
  // l'iscrizione esiste e il form non va più riaperto, altrimenti un secondo
  // invio occuperebbe un posto in più.
  let saved = false;

  try {
    // 1) Salvataggio su Firestore. Va fatto PRIMA delle email perché è qui
    //    che il posto viene davvero riservato: se la transazione rifiuta
    //    l'iscrizione (SOLD_OUT), nessuna mail è ancora partita e l'utente
    //    non riceve una conferma per un'iscrizione che non esiste.
    await saveRegistration(formData);
    saved = true;

    // 2) Notifica agli organizzatori: è l'unico posto in cui viaggiano email
    //    e note dell'iscritto (su Firestore salviamo solo nome, personaggio
    //    e categoria), quindi se fallisce va segnalato.
    await emailjs.send(emailJsConfig.serviceId, emailJsConfig.templateId, adminParams);

    // 3) La conferma all'utente è un "di più": se non parte (template non
    //    ancora configurato, indirizzo inesistente...) l'iscrizione resta
    //    comunque valida, ce lo segniamo solo in console.
    emailjs
      .send(emailJsConfig.serviceId, emailJsConfig.templateIdUser, userParams)
      .catch(function (err) {
        console.warn('Conferma all\'iscritto non inviata:', err);
      });

    form.style.display = 'none';
    successMsg.classList.remove('hidden');
    successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    console.error('Errore:', error);

    if (saved) {
      // Posto già riservato: l'invio della notifica è fallito dopo il
      // salvataggio. Teniamo chiuso il form per non creare un doppione e
      // chiediamo all'iscritto di scriverci, così gli organizzatori
      // recuperano i contatti che erano solo nella mail.
      alert(
        'La tua iscrizione è stata registrata, ma non siamo riusciti a inviare l\'email di notifica.\n' +
        'Scrivi a ' + emailJsConfig.recipientEmail + ' per completare la conferma.'
      );
      form.style.display = 'none';
      successMsg.classList.remove('hidden');
      successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Invia Modulo';
    }
    if (error && error.message === 'SOLD_OUT') {
      alert(ONE_PIECE_SOLD_OUT_MSG);
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
