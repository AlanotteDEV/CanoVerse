# Sicurezza — Setup anti-abuso

Cosa protegge già il sito, cosa resta da fare **nelle console esterne**
(EmailJS / Firebase) e cosa è stato valutato e scartato.

Riferimento: punti **1** (scritture pubbliche su Firestore) e **2** (quota EmailJS)
della revisione di sicurezza.

---

## ✅ Già attivo nel codice (nessuna azione richiesta)

- **Honeypot anti-bot** sul form di iscrizione (`iscrizione.html` + `src/js/formHandler.js`):
  un campo invisibile `#website`; se un bot lo compila, oppure se l'invio arriva
  in meno di 1,5 s dal caricamento, l'invio viene **ignorato** (email non spedita,
  nessun documento salvato su Firestore) mostrando un finto esito positivo.
- **Firestore Security Rules** (`firestore.rules`): sono la difesa vera sul database.
  Le scritture su `registrations` passano solo se hanno esattamente i quattro campi
  previsti, con nome ≤ 80 caratteri, categoria da un elenco chiuso e timestamp
  server-side. Modifica e cancellazione sono riservate all'admin.
- **Tetto dei posti del torneo imposto lato server**: il contatore
  `meta/tcg_onepiece_count` può muoversi solo di ±1, e il +1 solo sotto i 20 posti.
  Chi tentasse di iscriversi bypassando il form si vede rifiutare la transazione
  dal database, non solo dal JavaScript.
- **Nessun dato sensibile nel database pubblico**: `registrations` è in lettura
  pubblica perché le liste iscritti si aggiornano in tempo reale. Per questo email,
  età e note **non ci vengono proprio salvate** (viaggiano solo nell'email
  all'organizzatore), e chi non presta il consenso facoltativo alla pubblicazione
  vi compare come «Iscritto anonimo», senza personaggio.
- **Content-Security-Policy** su tutte le pagine: origini consentite dichiarate una
  per una, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- **Registro dei consensi cookie** (`cookie_consents`): scrivibile da chiunque ma
  vincolato nei campi, leggibile solo dall'admin, mai modificabile né cancellabile —
  serve da prova ex art. 7 GDPR.

---

## 1) EmailJS — Allowlist del dominio  (protegge la quota email)

**Da fare.** È l'unico passo rimasto ed è il più importante: la public key +
service/template ID di EmailJS sono visibili nel codice (inevitabile lato client),
quindi senza restrizioni chiunque può inviare email dalla tua quota.

### Passi

1. Accedi a **EmailJS** → <https://dashboard.emailjs.com/>
2. **Account → Security**
   - Attiva **"Allow list"** (restrizione per dominio) e aggiungi:
     `canoverse.vercel.app`
   - In questo modo le chiamate `emailjs.send()` sono accettate solo se partono dal sito.
3. (Consigliato) Attiva anche il limite di invii/quota e, se disponibile, la
   protezione **reCAPTCHA** lato EmailJS.

---

## 2) Firebase App Check — valutato e rimandato

App Check farebbe accettare a Firestore **solo** le richieste provenienti davvero
da questo sito, verificate con reCAPTCHA v3: è la difesa contro chi scrive sul
database bypassando il form.

Lo scaffolding era stato inserito nel codice ma è rimasto **inerte per mesi** —
la Site Key era un placeholder, quindi l'inizializzazione veniva sempre saltata —
ed è stato rimosso, perché codice che sembra attivo e non lo è è peggio di codice
assente. Restava solo il costo: un download in più per pagina e una voce di troppo
nella CSP.

**Se in futuro serve davvero**, va reintrodotto da zero insieme alla chiave (non
prima):

1. Crea una chiave **reCAPTCHA v3** su <https://www.google.com/recaptcha/admin/create>,
   dominio `canoverse.vercel.app` (più `localhost` per le prove).
2. Carica `firebase-app-check-compat.js` nelle pagine Firebase e chiama
   `firebase.appCheck().activate(SITE_KEY, true)` in `src/js/firebase-config.js`.
   Solo la **Site Key** va nel codice: è pubblica per design, la Secret Key **no**.
3. Rimetti `https://firebaseappcheck.googleapis.com` nella `connect-src` della CSP
   di **tutte** le pagine che caricano Firebase.
4. Firebase Console → progetto **arcomix-8db18** → **App Check**: registra l'app Web
   col provider reCAPTCHA v3 e la Secret Key.
5. Abilita l'enforcement su **Cloud Firestore**, ma lascialo prima qualche ora in
   **Monitor** per verificare che le richieste legittime passino.
6. **Aggiorna le informative**: reCAPTCHA v3 è uno strumento Google e va aggiunto
   alla tabella di `cookie.html` (categoria Necessari, finalità anti-abuso) e
   all'elenco fornitori di `privacy.html`. Questo passo non è facoltativo.

Il commit che l'ha rimosso (`4392887`) contiene il codice originale, se serve
riprenderlo.

---

## Verifica finale

- [ ] Allowlist dominio attiva su EmailJS
- [ ] Prova un'iscrizione reale dal sito: deve funzionare, e l'iscritto deve
      ricevere la mail di conferma
- [ ] Prova un'iscrizione **senza** spuntare il consenso alla pubblicazione: nella
      lista pubblica deve comparire «Iscritto anonimo», e all'organizzatore deve
      arrivare comunque il nome vero
- [ ] (Opzionale) prova una POST diretta a Firestore con campi fuori schema: deve
      essere **rifiutata** dalle Security Rules
