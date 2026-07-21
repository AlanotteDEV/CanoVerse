const emailJsConfig = {
  publicKey: '7l_HAZEX9KJId_NRw',
  serviceId: 'service_lhtetiu',
  templateId: 'template_8ogqjxg',
  recipientEmail: 'trajan.comic.cosplay@gmail.com',
};

const ONE_PIECE_MAX = 16;

function initEmailJS() {
  if (window.emailjs && !window.emailjsInitDone) {
    emailjs.init(emailJsConfig.publicKey);
    window.emailjsInitDone = true;
  }
}

function buildEmailText(formData) {
  return [
    'Nuova registrazione dal modulo del sito.',
    '',
    'Nome / Nome d\'Arte: ' + formData.name,
    'Email: ' + formData.email,
    'Personaggio / Gioco: ' + (formData.character || 'N/A'),
    'Categoria: ' + formData.category,
    'Note aggiuntive: ' + (formData.message || 'Nessuna'),
    '',
    '---',
    'CanoVerse — Festival 2026',
  ].join('\n');
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

  const templateParams = {
    from_name: formData.name,
    from_email: formData.email,
    reply_to: formData.email,
    to_email: emailJsConfig.recipientEmail,
    subject: 'Registrazione CanoVerse',
    message: buildEmailText(formData),
  };

  try {
    await emailjs.send(emailJsConfig.serviceId, emailJsConfig.templateId, templateParams);
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
  module.exports = { handleFormSubmit, validateForm, isValidEmail };
}
