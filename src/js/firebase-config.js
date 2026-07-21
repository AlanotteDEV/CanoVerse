const firebaseConfig = {
  apiKey: "AIzaSyCcEr967KBilLmusc66xT6JVBG9Qrj4yZY",
  authDomain: "arcomix-8db18.firebaseapp.com",
  projectId: "arcomix-8db18",
  storageBucket: "arcomix-8db18.firebasestorage.app",
  messagingSenderId: "1067090080221",
  appId: "1:1067090080221:web:9af76f421a5be106048634"
};

firebase.initializeApp(firebaseConfig);

/* ══════════════════════════════════════════════════════════════════
   Firebase App Check (anti-abuso su Firestore)
   ------------------------------------------------------------------
   Blocca le scritture automatizzate: quando l'enforcement è attivo
   sulla Firebase Console, Firestore accetta solo richieste che
   arrivano davvero da questo sito, verificate tramite reCAPTCHA v3.

   ⚠️  ATTUALMENTE INERTE: la Site Key qui sotto è un placeholder, quindi
   App Check NON viene inizializzato e nulla cambia nel comportamento del
   sito. Per attivarlo, segui i passi in  SICUREZZA-SETUP.md :
     1) crea una chiave reCAPTCHA v3 e incolla la Site Key in APPCHECK_RECAPTCHA_SITE_KEY;
     2) registra l'app in Firebase Console → App Check con quella chiave;
     3) abilita l'enforcement su Cloud Firestore.
   Finché il placeholder non viene sostituito, il blocco if è falso e il
   codice viene saltato: nessun errore, nessuna richiesta bloccata.
   ══════════════════════════════════════════════════════════════════ */
const APPCHECK_RECAPTCHA_SITE_KEY = 'REPLACE_WITH_RECAPTCHA_V3_SITE_KEY';
if (typeof firebase.appCheck === 'function' &&
    APPCHECK_RECAPTCHA_SITE_KEY.indexOf('REPLACE_WITH') === -1) {
  try {
    firebase.appCheck().activate(APPCHECK_RECAPTCHA_SITE_KEY, /* isTokenAutoRefreshEnabled */ true);
  } catch (e) {
    console.error('Inizializzazione App Check fallita:', e);
  }
}

const db = firebase.firestore();
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
