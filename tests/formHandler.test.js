/**
 * @jest-environment jsdom
 */

const { handleFormSubmit, validateForm, isValidEmail, buildEmailText, buildUserEmailText, documentNote } = require('../src/js/formHandler');

describe('formHandler', () => {
  // ── handleFormSubmit ──────────────────────────────────────────────

  describe('handleFormSubmit', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <form id="cosplayForm" onsubmit="handleFormSubmit(event)">
          <input id="name" value="Mario" />
          <input id="email" value="mario@example.com" />
          <input id="character" value="" />
          <select id="type"><option value="cosplay_singolo">Cosplay Singolo</option></select>
          <textarea id="message"></textarea>
          <button type="submit">Invia</button>
        </form>
        <div id="successMessage" class="hidden"></div>
      `;
      Element.prototype.scrollIntoView = jest.fn();

      window.emailjs = {
        init: jest.fn(),
        send: jest.fn().mockResolvedValue({}),
      };
      window.emailjsInitDone = false;

      // formHandler.js relies on the global `db`/`firebase` set up by
      // firebase-config.js in the browser; outside a page load neither
      // exists, so saveRegistration() throws ReferenceError and the
      // submission silently falls into the error path.
      window.firebase = {
        firestore: {
          FieldValue: {
            serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
          },
        },
      };
      window.db = {
        collection: jest.fn(() => ({
          add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
          doc: jest.fn(() => ({
            id: 'mock-doc-id',
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 0 }) }),
          })),
        })),
        runTransaction: jest.fn(async (updateFn) =>
          updateFn({
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 0 }) }),
            update: jest.fn(),
            set: jest.fn(),
          })
        ),
      };
    });

    afterEach(() => {
      delete window.emailjs;
      delete window.emailjsInitDone;
      delete window.firebase;
      delete window.db;
    });

    test('should prevent default form submission', () => {
      const event = { preventDefault: jest.fn() };
      handleFormSubmit(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    test('should hide the form after submission', async () => {
      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);
      const form = document.getElementById('cosplayForm');
      expect(form.style.display).toBe('none');
    });

    test('should remove "hidden" class from success message', async () => {
      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);
      const msg = document.getElementById('successMessage');
      expect(msg.classList.contains('hidden')).toBe(false);
    });

    test('should scroll success message into view', async () => {
      const event = { preventDefault: jest.fn() };
      const msg = document.getElementById('successMessage');
      msg.scrollIntoView = jest.fn();
      await handleFormSubmit(event);
      expect(msg.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });

    test('should return true on successful submission', async () => {
      const event = { preventDefault: jest.fn() };
      await expect(handleFormSubmit(event)).resolves.toBe(true);
    });

    test('should return false when form element is missing', async () => {
      document.body.innerHTML = '<div id="successMessage" class="hidden"></div>';
      const event = { preventDefault: jest.fn() };
      await expect(handleFormSubmit(event)).resolves.toBe(false);
    });

    test('should return false when success message element is missing', async () => {
      document.body.innerHTML = '<form id="cosplayForm"></form>';
      const event = { preventDefault: jest.fn() };
      await expect(handleFormSubmit(event)).resolves.toBe(false);
    });
  });

  // ── handleFormSubmit (torneo One Piece, contatore transazionale) ───

  describe('handleFormSubmit — tcg_onepiece slot cap', () => {
    // `counterCount` è ciò che vede il controllo preliminare leggendo
    // meta/tcg_onepiece_count; `transactionCount` è ciò che vede la
    // transazione atomica. Di norma coincidono: differiscono solo per
    // simulare la corsa sull'ultimo posto.
    function mockDb(counterCount, transactionCount, spies) {
      const s = spies || {};
      return {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            id: 'mock-doc-id',
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ count: counterCount }),
            }),
          })),
        })),
        runTransaction: jest.fn(async (updateFn) =>
          updateFn({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ count: transactionCount }),
            }),
            update: s.update || jest.fn(),
            set: s.set || jest.fn(),
          })
        ),
      };
    }

    beforeEach(() => {
      document.body.innerHTML = `
        <form id="cosplayForm" onsubmit="handleFormSubmit(event)">
          <input id="name" value="Mario" />
          <input id="email" value="mario@example.com" />
          <input id="character" value="" />
          <select id="type"><option value="tcg_onepiece" selected>One Piece Card Game</option></select>
          <textarea id="message"></textarea>
          <button type="submit">Invia</button>
        </form>
        <div id="successMessage" class="hidden"></div>
      `;
      Element.prototype.scrollIntoView = jest.fn();
      window.alert = jest.fn();

      window.emailjs = { init: jest.fn(), send: jest.fn().mockResolvedValue({}) };
      window.emailjsInitDone = false;
      window.firebase = {
        firestore: { FieldValue: { serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP') } },
      };
    });

    afterEach(() => {
      delete window.emailjs;
      delete window.emailjsInitDone;
      delete window.firebase;
      delete window.db;
      delete window.alert;
    });

    test('creates the registration and increments the counter when under the cap', async () => {
      const transactionUpdate = jest.fn();
      const transactionSet = jest.fn();
      window.db = mockDb(5, 5, { update: transactionUpdate, set: transactionSet });

      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);

      expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), { count: 6 });
      expect(transactionSet).toHaveBeenCalledTimes(1);
      expect(window.alert).not.toHaveBeenCalled();
      const successMsg = document.getElementById('successMessage');
      expect(successMsg.classList.contains('hidden')).toBe(false);
    });

    test('saves the registration before sending any email', async () => {
      window.db = mockDb(5, 5);

      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);

      // Il posto va riservato per primo: solo così una transazione rifiutata
      // non lascia in giro email di conferma per un'iscrizione inesistente.
      expect(window.db.runTransaction.mock.invocationCallOrder[0])
        .toBeLessThan(window.emailjs.send.mock.invocationCallOrder[0]);
    });

    test('blocks the submission before sending emails when the counter is already at the cap', async () => {
      window.db = mockDb(20, 20);

      const event = { preventDefault: jest.fn() };
      const result = await handleFormSubmit(event);

      expect(result).toBe(false);
      expect(window.alert).toHaveBeenCalledWith(
        'Siamo spiacenti, i posti per il torneo One Piece Card Game sono esauriti (20/20).'
      );
      expect(window.emailjs.send).not.toHaveBeenCalled();
      expect(window.db.runTransaction).not.toHaveBeenCalled();
      expect(document.getElementById('cosplayForm').style.display).not.toBe('none');
    });

    test('shows a sold-out alert when the transaction finds the cap already reached (race condition on the last slot)', async () => {
      // Il controllo preliminare lato client vede ancora 19/20 (non blocca
      // l'invio), ma nel frattempo un'altra registrazione ha già occupato
      // l'ultimo posto: solo la transazione atomica se ne accorge davvero.
      window.db = mockDb(19, 20);

      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);

      expect(window.alert).toHaveBeenCalledWith(
        'Siamo spiacenti, i posti per il torneo One Piece Card Game sono esauriti (20/20).'
      );
      // Nessuna email deve essere partita: l'iscrizione non è mai esistita.
      expect(window.emailjs.send).not.toHaveBeenCalled();
      const form = document.getElementById('cosplayForm');
      expect(form.style.display).not.toBe('none');
    });

    test('keeps the registration valid when the notification email fails after the save', async () => {
      window.db = mockDb(5, 5);
      window.emailjs.send = jest.fn().mockRejectedValue(new Error('EmailJS down'));

      const event = { preventDefault: jest.fn() };
      const result = await handleFormSubmit(event);

      expect(result).toBe(true);
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('La tua iscrizione è stata registrata')
      );
      // Form chiuso: il posto è già occupato, un secondo invio ne brucerebbe un altro.
      expect(document.getElementById('cosplayForm').style.display).toBe('none');
    });
  });

  // ── handleFormSubmit (anti-bot honeypot + tempo minimo) ───────────

  describe('handleFormSubmit — anti-bot honeypot', () => {
    let sendMock;

    beforeEach(() => {
      document.body.innerHTML = `
        <form id="cosplayForm" onsubmit="handleFormSubmit(event)">
          <div class="hp-field"><input id="website" name="website" value="" /></div>
          <input id="name" value="Mario" />
          <input id="email" value="mario@example.com" />
          <input id="character" value="" />
          <select id="type"><option value="cosplay_singolo" selected>Cosplay Singolo</option></select>
          <textarea id="message"></textarea>
          <input type="checkbox" id="privacy-consent" checked />
          <input type="checkbox" id="age-consent" checked />
          <button type="submit">Invia</button>
        </form>
        <div id="successMessage" class="hidden"></div>
      `;
      Element.prototype.scrollIntoView = jest.fn();
      window.alert = jest.fn();
      sendMock = jest.fn().mockResolvedValue({});
      window.emailjs = { init: jest.fn(), send: sendMock };
      window.emailjsInitDone = false;
      window.firebase = {
        firestore: { FieldValue: { serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP') } },
      };
      window.db = {
        collection: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'mock-id' }) })),
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete window.emailjs;
      delete window.emailjsInitDone;
      delete window.firebase;
      delete window.db;
      delete window.alert;
    });

    test('blocks the submission when the honeypot field is filled (no email, no save)', async () => {
      document.getElementById('website').value = 'http://spam.example';
      const event = { preventDefault: jest.fn() };
      const result = await handleFormSubmit(event);
      expect(sendMock).not.toHaveBeenCalled();
      expect(result).toBe(true); // finto esito positivo per non allertare il bot
      expect(document.getElementById('cosplayForm').style.display).toBe('none');
    });

    test('blocks a submission that arrives too fast (bot timing)', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(0); // tempo trascorso "negativo" → troppo veloce
      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);
      expect(sendMock).not.toHaveBeenCalled();
    });

    test('lets a genuine submission through (empty honeypot, enough time elapsed)', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER); // molto tempo trascorso
      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);
      // Due invii: la notifica agli organizzatori e la conferma all'iscritto.
      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(document.getElementById('successMessage').classList.contains('hidden')).toBe(false);
    });
  });

  // ── isValidEmail ──────────────────────────────────────────────────

  describe('isValidEmail', () => {
    test.each([
      ['user@example.com', true],
      ['test.user@domain.co', true],
      ['a@b.c', true],
      ['user+tag@example.org', true],
    ])('should accept valid email: %s', (email, expected) => {
      expect(isValidEmail(email)).toBe(expected);
    });

    test.each([
      ['', false],
      ['plaintext', false],
      ['@domain.com', false],
      ['user@', false],
      ['user @example.com', false],
      ['user@.com', false],
    ])('should reject invalid email: %s', (email, expected) => {
      expect(isValidEmail(email)).toBe(expected);
    });
  });

  // ── validateForm ──────────────────────────────────────────────────

  describe('validateForm', () => {
    let form;

    beforeEach(() => {
      document.body.innerHTML = `
        <form id="testForm">
          <input id="name" value="" />
          <input id="email" value="" />
          <select id="type"><option value="">-- Scegli --</option><option value="cosplay">Cosplay</option></select>
        </form>
      `;
      form = document.getElementById('testForm');
    });

    test('should return invalid when all fields are empty', () => {
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name');
      expect(result.errors).toContain('email');
      expect(result.errors).toContain('category');
    });

    test('should return valid when all fields are filled correctly', () => {
      form.querySelector('#name').value = 'Mario Rossi';
      form.querySelector('#email').value = 'mario@example.com';
      form.querySelector('#type').value = 'cosplay';
      const result = validateForm(form);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should report email_format error for malformed email', () => {
      form.querySelector('#name').value = 'Mario';
      form.querySelector('#email').value = 'not-an-email';
      form.querySelector('#type').value = 'cosplay';
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('email_format');
    });

    test('should report name error when name is whitespace only', () => {
      form.querySelector('#name').value = '   ';
      form.querySelector('#email').value = 'a@b.c';
      form.querySelector('#type').value = 'cosplay';
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name');
    });

    test('should report category error when no option selected', () => {
      form.querySelector('#name').value = 'Mario';
      form.querySelector('#email').value = 'mario@example.com';
      // type stays at default empty value
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('category');
    });
  });

  // ── Età e moduli da consegnare ────────────────────────────────────

  describe('validateForm — età e consenso genitoriale', () => {
    let form;

    beforeEach(() => {
      document.body.innerHTML = `
        <form id="testForm">
          <input id="name" value="Mario Rossi" />
          <input id="email" value="mario@example.com" />
          <select id="type">
            <option value="cosplay_singolo">Cosplay</option>
            <option value="cosplay_gruppo">Gruppo</option>
          </select>
          <input id="age" value="" />
          <input type="checkbox" id="group-has-minors" />
          <input type="checkbox" id="minor-consent-ack" />
        </form>
      `;
      form = document.getElementById('testForm');
      form.querySelector('#type').value = 'cosplay_singolo';
    });

    test('should report age error when the field is empty', () => {
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('age');
    });

    test('should report age error when the value is not a number', () => {
      form.querySelector('#age').value = 'venti';
      const result = validateForm(form);
      expect(result.errors).toContain('age');
    });

    test.each([['0'], ['121']])('should report age_range for out of range value: %s', (value) => {
      form.querySelector('#age').value = value;
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('age_range');
    });

    test('should be valid for an adult without any acknowledgement', () => {
      form.querySelector('#age').value = '25';
      const result = validateForm(form);
      expect(result.valid).toBe(true);
    });

    test('should require the parental consent acknowledgement under 18', () => {
      form.querySelector('#age').value = '15';
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('minor_consent');
    });

    test('should accept a minor once the acknowledgement is checked', () => {
      form.querySelector('#age').value = '15';
      form.querySelector('#minor-consent-ack').checked = true;
      const result = validateForm(form);
      expect(result.valid).toBe(true);
    });

    test('should treat 18 as adult', () => {
      form.querySelector('#age').value = '18';
      const result = validateForm(form);
      expect(result.valid).toBe(true);
    });

    test('should require the acknowledgement when an adult declares minors in the group', () => {
      form.querySelector('#type').value = 'cosplay_gruppo';
      form.querySelector('#age').value = '30';
      form.querySelector('#group-has-minors').checked = true;
      const result = validateForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('minor_consent');
    });
  });

  // ── documentNote ──────────────────────────────────────────────────

  describe('documentNote', () => {
    test('should point a minor to the parental consent form', () => {
      const note = documentNote({ age: '14', category: 'cosplay_singolo' });
      expect(note).toContain('consenso-genitori.html');
      expect(note).not.toContain('liberatoria-immagini.html');
    });

    test('should tell K-POP minors to send the form in advance', () => {
      const note = documentNote({ age: '14', category: 'kpop' });
      expect(note).toContain('in anticipo');
    });

    test('should tell other minors to bring the form at check-in', () => {
      const note = documentNote({ age: '14', category: 'tcg_onepiece' });
      expect(note).toContain('check-in');
    });

    test('should point an adult to the optional image release', () => {
      const note = documentNote({ age: '30', category: 'cosplay_singolo' });
      expect(note).toContain('liberatoria-immagini.html');
      expect(note).toContain('facoltativa');
    });

    test('should mention both forms when an adult registers a group with minors', () => {
      const note = documentNote({ age: '30', category: 'cosplay_gruppo', groupHasMinors: true });
      expect(note).toContain('liberatoria-immagini.html');
      expect(note).toContain('consenso-genitori.html');
    });
  });

  // ── buildEmailText ────────────────────────────────────────────────

  describe('buildEmailText — segnalazione dei minori', () => {
    const base = {
      name: 'Mario',
      email: 'mario@example.com',
      character: '',
      category: 'cosplay_singolo',
      message: '',
    };

    test('should include the declared age', () => {
      expect(buildEmailText({ ...base, age: '22' })).toContain('Età: 22');
    });

    test('should flag a minor registration for the organisers', () => {
      expect(buildEmailText({ ...base, age: '16' })).toContain('MINORENNE');
    });

    test('should not flag an adult registration', () => {
      expect(buildEmailText({ ...base, age: '22' })).not.toContain('MINORENNE');
    });

    test('should flag a group that includes other minors', () => {
      const text = buildEmailText({ ...base, age: '22', category: 'cosplay_gruppo', groupHasMinors: true });
      expect(text).toContain('ALTRI MINORENNI');
    });
  });

  // ── Consenso alla pubblicazione nelle liste iscritti ───────────────

  describe('handleFormSubmit — consenso alla pubblicazione', () => {
    // Gli spy sui due punti di scrittura: `addSpy` per le iscrizioni
    // normali, `transactionSet` per il torneo. È lì che si vede cosa
    // finisce davvero nella collection a lettura pubblica.
    let addSpy;
    let transactionSet;

    function mockDb() {
      addSpy = jest.fn().mockResolvedValue({ id: 'mock-id' });
      transactionSet = jest.fn();
      return {
        collection: jest.fn(() => ({
          add: addSpy,
          doc: jest.fn(() => ({
            id: 'mock-doc-id',
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 0 }) }),
          })),
        })),
        runTransaction: jest.fn(async (updateFn) =>
          updateFn({
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 0 }) }),
            update: jest.fn(),
            set: transactionSet,
          })
        ),
      };
    }

    // `consent`: true = casella presente e spuntata, false = presente e
    // non spuntata, null = casella assente dal markup.
    function renderForm(consent) {
      const checkbox = consent === null
        ? ''
        : '<input type="checkbox" id="publish-consent" ' + (consent ? 'checked' : '') + ' />';
      document.body.innerHTML = `
        <form id="cosplayForm" onsubmit="handleFormSubmit(event)">
          <input id="name" value="Mario Rossi" />
          <input id="email" value="mario@example.com" />
          <input id="character" value="Monkey D. Rufy" />
          <select id="type"><option value="cosplay_singolo" selected>Cosplay Singolo</option></select>
          <textarea id="message"></textarea>
          ${checkbox}
          <button type="submit">Invia</button>
        </form>
        <div id="successMessage" class="hidden"></div>
      `;
    }

    beforeEach(() => {
      Element.prototype.scrollIntoView = jest.fn();
      window.alert = jest.fn();
      window.emailjs = { init: jest.fn(), send: jest.fn().mockResolvedValue({}) };
      window.emailjsInitDone = false;
      window.firebase = {
        firestore: { FieldValue: { serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP') } },
      };
      window.db = mockDb();
    });

    afterEach(() => {
      delete window.emailjs;
      delete window.emailjsInitDone;
      delete window.firebase;
      delete window.db;
      delete window.alert;
    });

    test('should publish name and character when consent is given', async () => {
      renderForm(true);
      await handleFormSubmit({ preventDefault: jest.fn() });

      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Mario Rossi',
        character: 'Monkey D. Rufy',
      }));
    });

    test('should store a placeholder instead of the name when consent is withheld', async () => {
      renderForm(false);
      await handleFormSubmit({ preventDefault: jest.fn() });

      const saved = addSpy.mock.calls[0][0];
      expect(saved.name).toBe('Iscritto anonimo');
      expect(saved.character).toBe('');
    });

    test('should never let identifying data reach Firestore without consent', async () => {
      renderForm(false);
      await handleFormSubmit({ preventDefault: jest.fn() });

      // La collection registrations è in lettura pubblica: senza consenso
      // qui non deve finire nulla di identificativo, nemmeno di rimbalzo
      // in un campo diverso da quello previsto.
      const saved = JSON.stringify(addSpy.mock.calls[0][0]);
      expect(saved).not.toContain('Mario Rossi');
      expect(saved).not.toContain('Monkey D. Rufy');
      expect(saved).not.toContain('mario@example.com');
    });

    test('should default to not publishing when the checkbox is missing', async () => {
      // Se il markup perde la casella (refuso, pagina vecchia in cache),
      // l'opzione prudente è non pubblicare: meglio una lista anonima che
      // un nome pubblicato senza che nessuno l'abbia autorizzato.
      renderForm(null);
      await handleFormSubmit({ preventDefault: jest.fn() });

      expect(addSpy.mock.calls[0][0].name).toBe('Iscritto anonimo');
    });

    test('should still register the participant when consent is withheld', async () => {
      // Il consenso è facoltativo: senza, l'iscrizione vale comunque e il
      // documento serve a tenere i contatori degli iscritti.
      renderForm(false);
      await handleFormSubmit({ preventDefault: jest.fn() });

      expect(addSpy).toHaveBeenCalledTimes(1);
      const successMsg = document.getElementById('successMessage');
      expect(successMsg.classList.contains('hidden')).toBe(false);
    });

    test('should anonymise the tournament registration too', async () => {
      // Il torneo non passa da collection.add() ma dalla transazione: è un
      // secondo punto di scrittura, e deve rispettare lo stesso consenso.
      renderForm(false);
      document.getElementById('type').innerHTML =
        '<option value="tcg_onepiece" selected>One Piece Card Game</option>';
      await handleFormSubmit({ preventDefault: jest.fn() });

      expect(transactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Iscritto anonimo', character: '' })
      );
    });

    test('should send the real name to the organisers even without consent', async () => {
      // L'organizzatore ha bisogno del nome vero per il check-in: il
      // consenso riguarda la pubblicazione, non l'iscrizione in sé.
      renderForm(false);
      await handleFormSubmit({ preventDefault: jest.fn() });

      const adminParams = window.emailjs.send.mock.calls[0][2];
      expect(adminParams.from_name).toBe('Mario Rossi');
      expect(adminParams.message).toContain('Mario Rossi');
    });
  });

  // ── Testi email: come viene comunicato il consenso ─────────────────

  describe('buildEmailText / buildUserEmailText — consenso alla pubblicazione', () => {
    const base = {
      name: 'Mario Rossi',
      email: 'mario@example.com',
      character: 'Monkey D. Rufy',
      category: 'cosplay_singolo',
      message: '',
      age: '22',
    };

    test('should tell the organisers that consent was given', () => {
      expect(buildEmailText({ ...base, publishConsent: true }))
        .toContain('Pubblicazione in lista: Sì');
    });

    test('should warn the organisers that the public entry is anonymous', () => {
      expect(buildEmailText({ ...base, publishConsent: false }))
        .toContain('Iscritto anonimo');
    });

    test('should confirm publication to a consenting registrant', () => {
      expect(buildUserEmailText({ ...base, publishConsent: true }))
        .toContain('compaiono nella lista pubblica');
    });

    test('should explain the anonymous entry to a non-consenting registrant', () => {
      expect(buildUserEmailText({ ...base, publishConsent: false }))
        .toContain('Iscritto anonimo');
    });
  });
});
