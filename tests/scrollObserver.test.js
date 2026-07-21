/**
 * @jest-environment jsdom
 */

const { createScrollObserver, initScrollAnimations } = require('../src/js/scrollObserver');

describe('scrollObserver', () => {
  let mockObserve;
  let mockUnobserve;
  let mockDisconnect;
  let observerCallback;

  beforeEach(() => {
    mockObserve = jest.fn();
    mockUnobserve = jest.fn();
    mockDisconnect = jest.fn();

    // Capture the callback that IntersectionObserver receives
    global.IntersectionObserver = jest.fn((callback) => {
      observerCallback = callback;
      return {
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
      };
    });

    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── createScrollObserver ──────────────────────────────────────────

  describe('createScrollObserver', () => {
    test('should create an IntersectionObserver with default threshold', () => {
      createScrollObserver();
      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { threshold: 0.1 }
      );
    });

    test('should accept a custom threshold', () => {
      createScrollObserver({ threshold: 0.5 });
      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { threshold: 0.5 }
      );
    });

    test('should add "visible" class when entry is intersecting', () => {
      createScrollObserver();

      const mockTarget = document.createElement('div');
      mockTarget.classList.add('fade-in-up');

      observerCallback([{ isIntersecting: true, target: mockTarget }]);

      expect(mockTarget.classList.contains('visible')).toBe(true);
    });

    test('should NOT add "visible" class when entry is not intersecting', () => {
      createScrollObserver();

      const mockTarget = document.createElement('div');
      mockTarget.classList.add('fade-in-up');

      observerCallback([{ isIntersecting: false, target: mockTarget }]);

      expect(mockTarget.classList.contains('visible')).toBe(false);
    });

    test('should unobserve element after it becomes visible', () => {
      createScrollObserver();

      const mockTarget = document.createElement('div');
      observerCallback([{ isIntersecting: true, target: mockTarget }]);

      expect(mockUnobserve).toHaveBeenCalledWith(mockTarget);
    });

    test('should NOT unobserve element that is not intersecting', () => {
      createScrollObserver();

      const mockTarget = document.createElement('div');
      observerCallback([{ isIntersecting: false, target: mockTarget }]);

      expect(mockUnobserve).not.toHaveBeenCalled();
    });

    test('should process multiple entries in a single callback', () => {
      createScrollObserver();

      const target1 = document.createElement('div');
      const target2 = document.createElement('div');
      const target3 = document.createElement('div');

      observerCallback([
        { isIntersecting: true, target: target1 },
        { isIntersecting: false, target: target2 },
        { isIntersecting: true, target: target3 },
      ]);

      expect(target1.classList.contains('visible')).toBe(true);
      expect(target2.classList.contains('visible')).toBe(false);
      expect(target3.classList.contains('visible')).toBe(true);
      expect(mockUnobserve).toHaveBeenCalledTimes(2);
    });
  });

  // ── initScrollAnimations ──────────────────────────────────────────

  describe('initScrollAnimations', () => {
    test('should observe all .fade-in-up elements', () => {
      document.body.innerHTML = `
        <div class="fade-in-up">A</div>
        <div class="fade-in-up">B</div>
        <div class="fade-in-up">C</div>
      `;

      const result = initScrollAnimations();

      expect(mockObserve).toHaveBeenCalledTimes(3);
      expect(result.count).toBe(3);
    });

    test('should return 0 count when no .fade-in-up elements exist', () => {
      document.body.innerHTML = '<div>No animations</div>';

      const result = initScrollAnimations();

      expect(mockObserve).not.toHaveBeenCalled();
      expect(result.count).toBe(0);
    });

    test('should return the observer instance', () => {
      const result = initScrollAnimations();
      expect(result.observer).toBeDefined();
      expect(result.observer.observe).toBeDefined();
    });

    test('should forward custom options to createScrollObserver', () => {
      initScrollAnimations({ threshold: 0.3 });

      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { threshold: 0.3 }
      );
    });
  });
});
