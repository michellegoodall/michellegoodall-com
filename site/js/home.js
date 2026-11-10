/*
 * Homepage v2 scroll choreography (Figma: "Homepage v2 — Scroll").
 *
 * One rAF loop reads each section's position and writes CSS variables:
 *   --q  0 → 1 as a section scrolls up and out of view (hero exit)
 *   --e  0 → 1 as a section scrolls into view from below (photo motion)
 *   --p  0 → 1 across a sticky [data-scene] (manifesto, ring)
 * CSS turns those into motion (see css/home.css). This file also:
 *   - lights up manifesto words as --p passes each word's data-at
 *   - spins the H04 ring with scroll and captions the front card
 *   - reveals [data-reveal] elements on enter
 *   - drives the right-edge scroll rail
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var sections = Array.prototype.slice.call(document.querySelectorAll('main > .sec'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ---- Manifesto words -------------------------------------------------------
  var manifesto = document.querySelector('.manifesto');
  var words = manifesto ? Array.prototype.slice.call(manifesto.querySelectorAll('.w')) : [];

  // ---- Ring ------------------------------------------------------------------
  var glance = document.querySelector('.glance');
  var stage = glance && glance.querySelector('.glance__stage');
  var cards = glance ? Array.prototype.slice.call(glance.querySelectorAll('.card')) : [];
  var metaEl = glance && glance.querySelector('.glance__meta');
  var nameEl = glance && glance.querySelector('.glance__name');

  var RADIUS = 460;                    // px, in the 1440 × 900 stage
  var STEP = 360 / (cards.length || 1);
  // At the top of the section the ring sits half a step round, so the first
  // two cards straddle the front (as in the H04 frame). Scrolling the whole
  // section turns it most of a full circle, so every card passes the front.
  // (2° short of half, so the first card is unambiguously the one captioned.)
  var START = STEP / 2 - 2;
  var TURN = 360 - STEP;
  var ringAngle = START, ringTarget = START, activeIndex = -1;

  function placeCards() {
    cards.forEach(function (card, i) {
      var a = i * STEP - ringAngle;               // angle from the front, degrees
      var rad = a * Math.PI / 180;
      card.style.transform = 'rotateY(' + a.toFixed(2) + 'deg) translateZ(' + RADIUS + 'px)';
      // Front cards are solid, side cards half, back cards faint (H04 opacities).
      card.style.opacity = clamp(0.323 + 0.68 * Math.cos(rad), 0.14, 1).toFixed(3);
      card.style.zIndex = Math.round(100 + 100 * Math.cos(rad));
      card.tabIndex = Math.cos(rad) > 0.5 ? 0 : -1;
    });

    // Caption the card nearest the front.
    var best = 0, bestCos = -2;
    cards.forEach(function (card, i) {
      var c = Math.cos((i * STEP - ringAngle) * Math.PI / 180);
      if (c > bestCos + 1e-6) { bestCos = c; best = i; }
    });
    if (best !== activeIndex) {
      activeIndex = best;
      var card = cards[best];
      metaEl.textContent = card.dataset.meta;
      nameEl.classList.add('is-swapping');
      setTimeout(function () {
        nameEl.textContent = card.dataset.name;
        nameEl.classList.remove('is-swapping');
      }, reduceMotion ? 0 : 180);
    }
  }

  // Scale the 1440 × 900 stage to the window. Phones get a larger scale than
  // pure fit-to-width so the cards stay readable; the sides crop.
  function fitStage() {
    if (!stage) return;
    var w = window.innerWidth, h = window.innerHeight;
    var k = Math.min(w / 1440, h / 900);
    if (w < 768) k = Math.min(h / 900, Math.max(k, 0.52));
    stage.style.setProperty('--k', k.toFixed(4));
  }

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
        if (sec === glance) ringTarget = START + p * TURN;
      }

      // The rail follows whichever section covers the middle of the screen.
      if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) railSection = sec;
    });

    setRail(railSection);
    spin();
  }

  // The ring eases toward its scroll position for a weighty feel.
  var spinning = false;
  function spin() {
    if (spinning) return;
    spinning = true;
    requestAnimationFrame(function step() {
      var gap = ringTarget - ringAngle;
      ringAngle = Math.abs(gap) < 0.01 || reduceMotion ? ringTarget : ringAngle + gap * 0.12;
      placeCards();
      if (ringAngle !== ringTarget) requestAnimationFrame(step);
      else spinning = false;
    });
  }

  function requestUpdate() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', function () { fitStage(); requestUpdate(); });
  // The password gate hides the page until it's unlocked; measure again then.
  window.addEventListener('mg:unlocked', function () { fitStage(); update(); });

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

  fitStage();
  placeCards();
  update();

  // Exposed for debugging in the console, e.g. homeScroll.ring(90)
  window.homeScroll = {
    update: update,
    ring: function (deg) { ringTarget = ringAngle = deg; placeCards(); }
  };
})();
