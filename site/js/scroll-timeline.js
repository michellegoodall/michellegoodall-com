/*
 * Homepage scroll animation.
 *
 * Hand-written replacement for the Webflow IX2 interaction "Homepage Animation"
 * (event: SCROLLING_IN_VIEW on .section, smoothing 88). Keyframes, easings and
 * the progress formula are taken from the published Webflow bundle so the
 * motion matches michellegoodall.com.
 *
 * How it works:
 *   .section is 1500vh tall and everything inside it is position: fixed, so
 *   scrolling does not move content; it only advances a 0–100% timeline.
 *   Each track below maps that timeline to one CSS property.
 */
(function () {
  'use strict';

  // Webflow "smoothing: 88" -> each frame closes 12% of the gap to the target.
  var SMOOTHING = 0.88;

  // ---- Easing (Webflow's named curves are CSS cubic-beziers) ---------------
  function bezier(x1, y1, x2, y2) {
    function a(p1, p2) { return 1 - 3 * p2 + 3 * p1; }
    function b(p1, p2) { return 3 * p2 - 6 * p1; }
    function c(p1) { return 3 * p1; }
    function at(t, p1, p2) { return ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t; }
    function slope(t, p1, p2) { return 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var d = at(t, x1, x2) - x;
        if (Math.abs(d) < 1e-6) break;
        var s = slope(t, x1, x2);
        if (Math.abs(s) < 1e-6) break;
        t -= d / s;
      }
      return at(t, y1, y2);
    };
  }

  var EASE = {
    linear: function (t) { return t; },
    in: bezier(0.42, 0, 1, 1),      // Webflow "easeIn"
    out: bezier(0, 0, 0.58, 1)      // Webflow "easeOut"
  };

  // ---- Timeline -------------------------------------------------------------
  // keys: [progress %, value, easing used from this key to the next]
  var DARK = [34, 34, 34];
  var CREAM = [236, 231, 220];

  var TRACKS = [
    // Intro: name slides off, blurb and [SCROLL] fade
    { el: '.big-heading-h1-mg', prop: 'x', unit: 'vw', keys: [[0, 0, 'in'], [30, -110, 'out']] },
    { el: '.little-heading-h2-mg', prop: 'x', unit: 'vw', keys: [[0, 0, 'in'], [39, 110, 'out']] },
    { el: '.scroll-text', prop: 'opacity', keys: [[0, 1], [12, 0]] },
    { el: '.mg-blurb-copy', prop: 'opacity', keys: [[12, 1], [18, 0]] },

    // Manifesto text rises through the viewport
    { el: '.mg-intro-hp-text', prop: 'y', unit: 'vh', keys: [[18, 100], [48, -130]] },

    // Red panel drops in behind the text, then wipes up and away
    { el: '.homepage-div-block-3', prop: 'y', unit: 'vh', keys: [[34, -100], [42, 0], [55.5, 0], [56, -150]] },

    // "Beloved Projects" + background image rise in, then pan left
    { el: '.beloved-projects-copy', prop: 'x', unit: 'vw', keys: [[42, 0, 'in'], [55, 0, 'out'], [55.5, 0, 'in'], [70, -125, 'out']] },
    { el: '.beloved-projects-copy', prop: 'y', unit: 'vh', keys: [[42, 100, 'in'], [55, 0, 'out'], [55.5, 0, 'in'], [70, 0, 'out']] },
    { el: '.hp-projects-background-image', prop: 'x', unit: 'vw', keys: [[42, 0, 'in'], [55, 0, 'out'], [55.5, 0, 'in'], [70, -60, 'out'], [80, -60, 'in'], [90, -125, 'out']] },
    { el: '.hp-projects-background-image', prop: 'y', unit: 'vh', keys: [[42, 150, 'in'], [55, 0, 'out'], [55.5, 0, 'in'], [70, 0, 'out'], [80, 0, 'in'], [90, 0, 'out']] },
    { el: '.hp-projects-background-image', prop: 'scale', keys: [[42, 2, 'in'], [55, 1.25, 'out'], [55.5, 1.25, 'in'], [62, 1]] },

    // Stellar Works project card slides in from the right, holds, exits left
    { el: '.hp-projects-foreground-image', prop: 'x', unit: 'vw', keys: [[59, 110, 'in'], [70, 10, 'out'], [80, 10, 'in'], [90, -100, 'out']] },
    { el: '.hp-projects-serif-header', prop: 'x', unit: 'vw', keys: [[59, 110, 'in'], [70, 10, 'out'], [80, 10, 'in'], [90, -100, 'out']] },
    { el: '.hp-projects-calligraphy-header', prop: 'x', unit: 'vw', keys: [[59, 118, 'in'], [70, 14, 'out'], [80, 10, 'in'], [90, -108, 'out']] },
    { el: '.hp-projects-scrolling-copy-1', prop: 'x', unit: 'vw', keys: [[70, 50, 'in'], [80, 50, 'out']] },
    { el: '.hp-projects-scrolling-copy-1', prop: 'y', unit: 'vh', keys: [[70, 65, 'in'], [80, -65, 'out']] }
  ];

  // "Good design starts with strategy, ..." — each word fades in over 0.5%,
  // one after another from 24% to 31%. The script-font words also go dark -> cream.
  for (var i = 1; i <= 14; i++) {
    var start = 24 + (i - 1) * 0.5;
    TRACKS.push({ el: '.text-span-' + i, prop: 'opacity', keys: [[start, 0], [start + 0.5, 1]] });
    if (i === 5 || i === 9 || i === 14) {
      TRACKS.push({ el: '.text-span-' + i, prop: 'color', keys: [[start, DARK], [start + 0.5, CREAM]] });
    }
  }

  // ---- Interpolation --------------------------------------------------------
  function mix(a, b, t) {
    if (Array.isArray(a)) return a.map(function (v, k) { return v + (b[k] - v) * t; });
    return a + (b - a) * t;
  }

  // Before the first key -> first value; after the last -> last value.
  function sample(keys, pct) {
    if (pct <= keys[0][0]) return keys[0][1];
    for (var k = 0; k < keys.length - 1; k++) {
      var from = keys[k], to = keys[k + 1];
      if (pct < to[0]) {
        var t = (pct - from[0]) / (to[0] - from[0]);
        return mix(from[1], to[1], EASE[from[2] || 'linear'](t));
      }
    }
    return keys[keys.length - 1][1];
  }

  // ---- Wiring ---------------------------------------------------------------
  var section = document.querySelector('.section');
  if (!section) return;

  // Group tracks by element so each element gets one combined transform.
  var targets = [];
  TRACKS.forEach(function (track) {
    section.querySelectorAll(track.el).forEach(function (node) {
      var entry = targets.find(function (t) { return t.node === node; });
      if (!entry) targets.push(entry = { node: node, tracks: [] });
      entry.tracks.push(track);
    });
  });

  function render(progress) {
    var pct = progress * 100;
    targets.forEach(function (target) {
      var x = '0px', y = '0px', scale = null, hasTransform = false, style = target.node.style;
      target.tracks.forEach(function (track) {
        var v = sample(track.keys, pct);
        switch (track.prop) {
          case 'x': x = v + track.unit; hasTransform = true; break;
          case 'y': y = v + track.unit; hasTransform = true; break;
          case 'scale': scale = v; hasTransform = true; break;
          case 'opacity': style.opacity = v; break;
          case 'color': style.color = 'rgb(' + v.map(Math.round).join(', ') + ')'; break;
        }
      });
      if (hasTransform) {
        style.transform = 'translate3d(' + x + ', ' + y + ', 0px)' +
          (scale === null ? '' : ' scale3d(' + scale + ', ' + scale + ', 1)');
      }
    });
  }

  // Same formula Webflow uses for "while scrolling in view" with no offsets:
  // 0 when the section's top meets the viewport top, rising as it scrolls past.
  function targetProgress() {
    var vh = document.documentElement.clientHeight;
    var rect = section.getBoundingClientRect();
    var enter = rect.top + Math.min(rect.height, vh);
    var span = Math.min(vh + (rect.bottom - enter), document.documentElement.scrollHeight);
    return span > 0 ? Math.min(Math.max(0, vh - enter), span) / span : 0;
  }

  var position = targetProgress();
  var running = false;

  function tick() {
    var target = targetProgress();
    var gap = target - position;
    position = Math.abs(gap) < 1e-5 ? target : position + gap * (1 - SMOOTHING);
    render(position);
    running = position !== target;
    if (running) requestAnimationFrame(tick);
  }

  function wake() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake);
  render(position);

  // Exposed for debugging in the console: scrollTimeline.render(0.5)
  window.scrollTimeline = { render: render, tracks: TRACKS, progress: targetProgress };
})();
