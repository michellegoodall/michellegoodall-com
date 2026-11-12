/*
 * Homepage: the right-edge scroll rail and the one reveal.
 *
 * Motion on this page is deliberately quiet. Things fade up once as they
 * appear ([data-reveal] gets .is-in; the CSS does the rest), and the rail
 * follows whichever section is in the middle of the screen. Nothing is pinned
 * or tied to the scroll position.
 */
(function () {
  'use strict';

  var sections = Array.prototype.slice.call(document.querySelectorAll('main > .sec'));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('.rail__link'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Scroll rail -----------------------------------------------------------
  var currentRail = null, onRed = null, ticking = false;

  function updateRail() {
    ticking = false;
    var mid = window.innerHeight / 2, section = null;
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.height && r.top <= mid && r.bottom > mid) { section = sections[i]; break; }
    }
    var key = section ? section.dataset.rail : null;
    if (key !== currentRail) {
      currentRail = key;
      railLinks.forEach(function (a) {
        var on = a.dataset.rail === key;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    // On red sections the rail switches to black.
    var red = !!(section && section.dataset.theme === 'red');
    if (red !== onRed) { onRed = red; document.body.classList.toggle('on-red', red); }
  }

  function requestRail() {
    if (!ticking) { ticking = true; requestAnimationFrame(updateRail); }
  }

  window.addEventListener('scroll', requestRail, { passive: true });
  window.addEventListener('resize', requestRail);
  // The password gate hides the page until it's unlocked; measure again then.
  window.addEventListener('mg:unlocked', updateRail);
  updateRail();

  // ---- Reveal on enter -------------------------------------------------------
  var revealables = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    Array.prototype.forEach.call(revealables, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-in'); });
  }
})();
