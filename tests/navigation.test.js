/**
 * @jest-environment jsdom
 */

const { scrollToSection, getAnchorHash, initSmoothScrollLinks, initMobileMenu } = require('../src/js/navigation');

describe('navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ── scrollToSection ───────────────────────────────────────────────

  describe('scrollToSection', () => {
    test('should scroll to a valid section and return true', () => {
      document.body.innerHTML = '<section id="evento">Evento</section>';
      const section = document.getElementById('evento');
      section.scrollIntoView = jest.fn();

      const result = scrollToSection('#evento');

      expect(result).toBe(true);
      expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    test('should return false when section does not exist', () => {
      document.body.innerHTML = '<div>Nothing here</div>';
      expect(scrollToSection('#nonexistent')).toBe(false);
    });

    test('should work with different selector types', () => {
      document.body.innerHTML = '<div class="target">Target</div>';
      const el = document.querySelector('.target');
      el.scrollIntoView = jest.fn();

      expect(scrollToSection('.target')).toBe(true);
      expect(el.scrollIntoView).toHaveBeenCalled();
    });
  });

  // ── getAnchorHash ─────────────────────────────────────────────────

  describe('getAnchorHash', () => {
    test('should return hash from a valid anchor', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '#programma');
      expect(getAnchorHash(anchor)).toBe('#programma');
    });

    test('should return null for null input', () => {
      expect(getAnchorHash(null)).toBeNull();
    });

    test('should return null for undefined input', () => {
      expect(getAnchorHash(undefined)).toBeNull();
    });

    test('should return null for an anchor with no href', () => {
      const anchor = document.createElement('a');
      expect(getAnchorHash(anchor)).toBeNull();
    });

    test('should return null for a bare "#" href', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '#');
      expect(getAnchorHash(anchor)).toBeNull();
    });

    test('should return null for an external URL', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'https://example.com');
      expect(getAnchorHash(anchor)).toBeNull();
    });

    test('should return null for a relative path', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'about.html');
      expect(getAnchorHash(anchor)).toBeNull();
    });

    test('should return hash for long anchor names', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '#very-long-section-name');
      expect(getAnchorHash(anchor)).toBe('#very-long-section-name');
    });
  });

  // ── initSmoothScrollLinks ─────────────────────────────────────────

  describe('initSmoothScrollLinks', () => {
    test('should bind click handlers to all valid anchor links', () => {
      document.body.innerHTML = `
        <a href="#evento">Evento</a>
        <a href="#programma">Programma</a>
        <a href="#tcg">TCG</a>
        <a href="https://example.com">External</a>
      `;

      const bound = initSmoothScrollLinks();
      // Only the 3 hash links should be bound
      expect(bound).toBe(3);
    });

    test('should return 0 when no anchor links exist', () => {
      document.body.innerHTML = '<div>No links</div>';
      expect(initSmoothScrollLinks()).toBe(0);
    });

    test('should not count bare "#" links', () => {
      document.body.innerHTML = `
        <a href="#">Top</a>
        <a href="#section">Section</a>
      `;
      // "#" is bare (length < 2) so not bound; "#section" is bound
      expect(initSmoothScrollLinks()).toBe(1);
    });

    test('should prevent default on click and call scrollToSection', () => {
      document.body.innerHTML = `
        <a href="#evento">Evento</a>
        <section id="evento">Evento Section</section>
      `;

      const section = document.getElementById('evento');
      section.scrollIntoView = jest.fn();

      initSmoothScrollLinks();

      const link = document.querySelector('a[href="#evento"]');
      const clickEvent = new Event('click', { bubbles: true, cancelable: true });
      clickEvent.preventDefault = jest.fn();
      link.dispatchEvent(clickEvent);

      expect(clickEvent.preventDefault).toHaveBeenCalled();
      expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });
  });

  describe('initMobileMenu', () => {
    test('should toggle the mobile menu and update aria-expanded', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      document.body.innerHTML = `
        <button data-mobile-nav-toggle aria-expanded="false"></button>
        <div data-mobile-nav class="hidden flex-col"></div>
      `;

      const button = document.querySelector('[data-mobile-nav-toggle]');
      const nav = document.querySelector('[data-mobile-nav]');

      const result = initMobileMenu();

      expect(result).toBe(true);
      expect(nav.classList.contains('hidden')).toBe(true);

      button.click();

      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(nav.classList.contains('hidden')).toBe(false);
    });
  });
});
