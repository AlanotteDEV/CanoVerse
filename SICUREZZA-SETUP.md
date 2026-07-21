# Sicurezza — Setup anti-abuso

Questo documento elenca i passi da completare **nelle console esterne** (Firebase / Google reCAPTCHA / EmailJS) per attivare le protezioni anti-abuso già predisposte nel codice.

Riferimento: punti **1** (scritture pubbliche su Firestore) e **2** (quota EmailJS) della revisione di sicurezza.

---

## ✅ Già attivo nel codice (nessuna azione richiesta)

- **Honeypot anti-bot** sul form di iscrizione (`iscrizione.html` + `src/js/formHandler.js`):
  un campo invisibile `#website`; se un bot lo compila, oppure se l'invio arriva
  in meno di 1,5 s dal caricamento, l'invio viene **ignorato** (email non spedita,
  nessun documento salvato su Firestore) mostrando un finto esito positivo.
- **Scaffolding di Firebase App Check** già inserito: SDK caricato su tutte le pagine
  Firebase e CSP già aggiornata. Resta **inerte** finché non completi i passi qui sotto.

---

## 1) Firebase App Check + reCAPTCHA v3  (blocca le scritture automatizzate)

App Check fa sì che Firestore accetti **solo** le richieste provenienti davvero da
questo sito. È la vera difesa contro chi scrive sul database bypassando il form.

### Passi

1. **Crea una chiave reCAPTCHA v3**
   - Vai su <https://www.google.com/recaptcha/admin/create>
   - Tipo: **reCAPTCHA v3**
   - Domini: `canoverse.vercel.app` (aggiungi anche `localhost` se vuoi testare in locale)
   - Ottieni **Site Key** (pubblica) e **Secret Key** (privata).

2. **Incolla la Site Key nel codice**
   - File `src/js/firebase-config.js`, costante `APPCHECK_RECAPTCHA_SITE_KEY`:
     ```js
     const APPCHECK_RECAPTCHA_SITE_KEY = 'LA_TUA_SITE_KEY_QUI';
     ```
   - (Solo la Site Key va nel codice: è pubblica per design. La Secret Key **NON**
     va mai messa qui.)

3. **Registra l'app in Firebase Console**
   - Firebase Console → progetto **arcomix-8db18** → **App Check**
   - Seleziona l'app Web → provider **reCAPTCHA v3** → incolla la **Secret Key**.

4. **Abilita l'enforcement su Cloud Firestore**
   - App Check → scheda **APIs** → **Cloud Firestore** → **Enforce**.
   - Consiglio: lascia prima qualche ora in **Monitor** per verificare che le
     richieste legittime passino, poi attiva **Enforce**.

5. **(Facoltativo) Debug token per test in locale**
   - Per testare da `localhost`/`file://`, in console browser comparirà un debug
     token da registrare in App Check → *Manage debug tokens*.

> Finché il placeholder in `firebase-config.js` non viene sostituito, App Check
> non si inizializza: il sito continua a funzionare esattamente come ora.

---

## 2) EmailJS — Allowlist del dominio  (protegge la quota email)

La public key + service/template ID di EmailJS sono visibili nel codice (inevitabile
lato client): senza restrizioni, chiunque potrebbe inviare email dalla tua quota.

### Passi

1. Accedi a **EmailJS** → <https://dashboard.emailjs.com/>
2. **Account → Security**
   - Attiva **"Allow list"** (restrizione per dominio) e aggiungi:
     `canoverse.vercel.app`
   - In questo modo le chiamate `emailjs.send()` sono accettate solo se partono dal sito.
3. (Consigliato) Attiva anche il limite di invii/quota e, se disponibile, la
   protezione **reCAPTCHA** lato EmailJS.

---

## Verifica finale

- [ ] Site Key reCAPTCHA inserita in `firebase-config.js`
- [ ] App registrata in Firebase App Check con la Secret Key
- [ ] Enforcement Firestore attivo (dopo fase di Monitor)
- [ ] Allowlist dominio attiva su EmailJS
- [ ] Prova un'iscrizione reale dal sito: deve funzionare
- [ ] (Opzionale) prova una POST diretta a Firestore da fuori dominio: deve essere **rifiutata**
