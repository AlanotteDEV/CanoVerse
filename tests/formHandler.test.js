/**
 * @jest-environment jsdom
 */

const { handleFormSubmit, validateForm, isValidEmail } = require('../src/js/formHandler');

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
          doc: jest.fn(() => ({ id: 'mock-doc-id' })),
          where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ size: 0 }),
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
      window.db = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ id: 'mock-doc-id' })),
          where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ size: 5 }) })),
        })),
        runTransaction: jest.fn(async (updateFn) =>
          updateFn({
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 5 }) }),
            update: transactionUpdate,
            set: transactionSet,
          })
        ),
      };

      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);

      expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), { count: 6 });
      expect(transactionSet).toHaveBeenCalledTimes(1);
      expect(window.alert).not.toHaveBeenCalled();
      const successMsg = document.getElementById('successMessage');
      expect(successMsg.classList.contains('hidden')).toBe(false);
    });

    test('shows a sold-out alert when the transaction finds the cap already reached (race condition on the last slot)', async () => {
      // Il controllo preliminare lato client vede ancora 15/16 (non blocca
      // l'invio), ma nel frattempo un'altra registrazione ha già occupato
      // l'ultimo posto: solo la transazione atomica se ne accorge davvero.
      window.db = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ id: 'mock-doc-id' })),
          where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ size: 15 }) })),
        })),
        runTransaction: jest.fn(async (updateFn) =>
          updateFn({
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ count: 16 }) }),
            update: jest.fn(),
            set: jest.fn(),
          })
        ),
      };

      const event = { preventDefault: jest.fn() };
      await handleFormSubmit(event);

      expect(window.alert).toHaveBeenCalledWith(
        'Siamo spiacenti, i posti per il torneo One Piece Card Game sono esauriti (16/16).'
      );
      const form = document.getElementById('cosplayForm');
      expect(form.style.display).not.toBe('none');
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
});
