# Email delle iscrizioni — come configurarle

Quando qualcuno si iscrive a una gara, al contest o al torneo, il sito manda
**due email**:

1. **A voi organizzatori** → `Canoversecomicscosplay@gmail.com`
   con tutti i dati dell'iscritto (nome, email, personaggio, categoria, note).
2. **A chi si è iscritto** → una conferma con riepilogo, data e luogo del
   festival e un promemoria su cosa portare, diverso a seconda della categoria.

Il codice è già pronto (`src/js/formHandler.js`). Resta da fare la
configurazione su EmailJS, che richiede 10 minuti.

---

## Passo 1 — Controlla il template esistente (quello per voi)

Vai su **emailjs.com → Email Templates** e apri il template `template_8ogqjxg`.

Nella scheda **Settings** verifica che i campi siano impostati con le
variabili, non con indirizzi fissi:

| Campo      | Deve contenere      |
|------------|---------------------|
| To email   | `{{to_email}}`      |
| To name    | `{{to_name}}`       |
| From name  | `{{from_name}}`     |
| Reply To   | `{{reply_to}}`      |
| Subject    | `{{subject}}`       |

Nel **corpo** del messaggio basta che ci sia `{{message}}`.

> ⚠️ Se il campo "To email" contiene un indirizzo scritto a mano, la mail
> di conferma all'iscritto **non partirà**: andrebbe sempre a voi.

---

## Passo 2 — Crea il template della conferma

È consigliato un secondo template, così la mail all'iscritto può avere una
grafica diversa (intestazione, logo, colori).

1. **Email Templates → Create New Template**
2. Chiamalo per esempio `Conferma iscrizione`
3. In **Settings** imposta gli stessi campi del passo 1
   (`{{to_email}}`, `{{to_name}}`, `{{from_name}}`, `{{reply_to}}`, `{{subject}}`)
4. Nel corpo metti `{{message}}` (puoi aggiungere sopra il logo e sotto i
   contatti, se vuoi una versione grafica)
5. Salva e **copia l'ID** del template (tipo `template_ab12cde`)

---

## Passo 3 — Incolla l'ID nel sito

Apri `src/js/formHandler.js` e alla riga 9 sostituisci l'ID:

```js
templateIdUser: 'template_ab12cde',   // ← l'ID del nuovo template
```

Se salti questo passo non si rompe niente: la conferma verrà inviata usando
lo stesso template della notifica interna.

---

## Come si comporta il sito

- La **notifica a voi** è quella indispensabile: se non parte, l'iscrizione
  viene considerata fallita e l'utente vede un messaggio di errore.
- La **conferma all'iscritto** è un extra: se fallisce (indirizzo sbagliato,
  template non configurato…) l'iscrizione resta comunque valida e viene
  salvata. L'errore finisce solo nella console del browser.

## Attenzione al piano gratuito

Il piano gratuito di EmailJS include **200 email al mese**. Ora ogni
iscrizione ne consuma **2** invece di 1: con 100 iscritti si arriva al
limite. Se prevedete più iscrizioni, valutate il passaggio a un piano
superiore oppure disattivate la conferma automatica.

## Come disattivare la conferma all'iscritto

In `src/js/formHandler.js` commenta il blocco `emailjs.send(...)` che usa
`templateIdUser` (è quello con il commento "Conferma a chi si è iscritto").
