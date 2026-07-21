/**
 * Creates an IntersectionObserver that applies a `visible` class
 * to elements with `.fade-in-up` when they scroll into view.
 */

function createScrollObserver(options) {
  const threshold = (options && options.threshold) || 0.1;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold }
  );

  return observer;
}

/**
 * Observes all `.fade-in-up` elements in the document.
 * Returns the observer instance for cleanup.
 */
function initScrollAnimations(options) {
  const observer = createScrollObserver(options);
  const elements = document.querySelectorAll('.fade-in-up');

  elements.forEach((el) => observer.observe(el));

  return { observer, count: elements.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createScrollObserver, initScrollAnimations };
}
