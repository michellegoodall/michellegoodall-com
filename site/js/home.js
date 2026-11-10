/*
 * Homepage v2 scroll choreography (Figma: "Homepage v2 — Scroll").
 *
 * One rAF loop reads each section's position and writes CSS variables:
 *   --q  0 → 1 as a section scrolls up and out of view (hero exit)
 *   --e  0 → 1 as a section scrolls into view from below (photo motion)
 *   --p  0 → 1 across a sticky [data-scene] (manifesto, the glance cloud)
 * CSS turns those into motion (see css/home.css). This file also:
 *   - lights up manifesto words as --p passes each word's data-at
 *   - reveals [data-reveal] elements on enter
 *   - drives the right-edge scroll rail
 * The glance cloud has its own script (js/cloud.js) and reads --p from here.
 */
(function () {
  'use strict';

  var sections = Array.prototype.slice.call(document.querySelectorAll('main > .sec'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ---- Manifesto words -------------------------------------------------------
  var manifesto = document.querySelector('.manifesto');
  var words = manifesto ? Array.prototype.slice.call(manifesto.querySelectorAll('.w')) : [];

  // ---- Scroll rail -----------------------------------------------------------
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('.rail__link'));
  var currentRail = null, onRed = null;

  function setRail(section) {
    var key = section ? section.dataset.rail : null;
    if (key !== currentRail) {
      currentRail = key;
      railLinks.forEach(function (a) {
        var on = a.dataset.rail === key;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    var red = !!(section && section.dataset.theme === 'red');
    if (red !== onRed) { onRed = red; document.body.classList.toggle('on-red', red); }
  }

  // ---- Main loop -------------------------------------------------------------
  var ticking = false;

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var railSection = null;

    sections.forEach(function (sec) {
      var r = sec.getBoundingClientRect();
      if (!r.height) return;                       // hidden (e.g. behind the password gate)

      sec.style.setProperty('--q', clamp(-r.top / r.height, 0, 1).toFixed(4));
      sec.style.setProperty('--e', clamp(1 - r.top / vh, 0, 1).toFixed(4));

      if (sec.hasAttribute('data-scene')) {
        var span = r.height - vh;
        var p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
        sec.style.setProperty('--p', p.toFixed(4));

        if (sec === manifesto) {
          words.forEach(function (w) { w.classList.toggle('is-on', p >= parseFloat(w.dataset.at)); });
        }
      }

      // The rail follows whichever section covers the middle of the screen.
      if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) railSection = sec;
    });

    setRail(railSection);
  }

  function requestUpdate() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  // The password gate hides the page until it's unlocked; measure again then.
  window.addEventListener('mg:unlocked', update);

  // ---- Reveal on enter -------------------------------------------------------
  var revealables = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(revealables, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-in'); });
  }

  update();

  // Exposed for debugging in the console.
  window.homeScroll = { update: update };
})();
