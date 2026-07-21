/**
 * Smooth-scroll navigation utilities for the festival page.
 */

/**
 * Scrolls to the element matching the given CSS selector.
 * Returns true if the element was found and scrolled to, false otherwise.
 */
function scrollToSection(selector) {
  const target = document.querySelector(selector);
  if (!target) {
    return false;
  }
  target.scrollIntoView({ behavior: 'smooth' });
  return true;
}

/**
 * Extracts the hash portion of an anchor href and normalises it.
 * Returns null if no valid hash is found.
 */
function getAnchorHash(anchorElement) {
  if (!anchorElement || !anchorElement.getAttribute) {
    return null;
  }
  const href = anchorElement.getAttribute('href');
  if (!href || !href.startsWith('#') || href.length < 2) {
    return null;
  }
  return href;
}

/**
 * Attaches smooth-scroll click handlers to all in-page anchor links.
 * Returns the number of links that were bound.
 */
function initSmoothScrollLinks() {
  const links = document.querySelectorAll('a[href^="#"]');
  let bound = 0;

  links.forEach((link) => {
    const hash = getAnchorHash(link);
    if (!hash) return;

    link.addEventListener('click', (event) => {
      event.preventDefault();
      scrollToSection(hash);
    });
    bound++;
  });

  return bound;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrollToSection, getAnchorHash, initSmoothScrollLinks };
}
