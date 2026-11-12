/*
 * Homepage v2 scroll choreography (Figma: "Homepage v2 — Scroll").
 *
 * One rAF loop reads each section's position and writes CSS variables:
 *   --q  0 → 1 as a section scrolls up and out of view (hero exit)
 *   --e  0 → 1 as a section scrolls into view from below (photo motion)
 *   --p  0 → 1 across a sticky [data-scene] (manifesto, the glance cloud)
 * All three are eased toward the real scroll position, so motion glides.
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
  // Scroll values are eased rather than applied raw: each frame they close 12%
  // of the gap to the real scroll position (the same "smoothing 88" the v1
  // homepage used). A mouse wheel moves the page in steps; easing turns those
  // steps into one continuous glide, so nothing jumps.
  var SMOOTH = 0.12;
  var state = sections.map(function () { return { q: null, e: null, p: null }; });
  var running = false, lastTime = 0;

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 16.667, 3) : 1;
    lastTime = now;
    var k = reduceMotion ? 1 : 1 - Math.pow(1 - SMOOTH, dt);
    var vh = window.innerHeight;
    var railSection = null, settled = true;

    sections.forEach(function (sec, i) {
      var r = sec.getBoundingClientRect();
      if (!r.height) return;                       // hidden (e.g. behind the password gate)
      var st = state[i];

      var target = {
        q: clamp(-r.top / r.height, 0, 1),
        e: clamp(1 - r.top / vh, 0, 1),
        p: 0
      };
      if (sec.hasAttribute('data-scene')) {
        var span = r.height - vh;
        target.p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
      }

      ['q', 'e', 'p'].forEach(function (key) {
        var v = st[key] === null ? target[key] : st[key] + (target[key] - st[key]) * k;
        if (Math.abs(target[key] - v) < 0.0005) v = target[key];
        else settled = false;
        if (v !== st[key]) { st[key] = v; sec.style.setProperty('--' + key, v.toFixed(4)); }
      });

      if (sec === manifesto) {
        words.forEach(function (w) { w.classList.toggle('is-on', st.p >= parseFloat(w.dataset.at)); });
      }

      // The rail follows whichever section covers the middle of the screen
      // (from the real position, so it answers immediately).
      if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) railSection = sec;
    });

    setRail(railSection);

    if (settled) { running = false; lastTime = 0; }
    else requestAnimationFrame(frame);
  }

  function update() {
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
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
