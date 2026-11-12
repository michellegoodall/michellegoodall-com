/*
 * The glance (H04): the cloud, kept calm (Figma: "Glance — Explorations" G1 + G3).
 *
 *   At rest  all the work floats as one slowly turning cloud; drag to spin it.
 *            Hover a piece: the cloud pauses, the piece comes to the front and
 *            its name appears.
 *   Sorted   hover a discipline (tap on phones): its pieces fan out, the rest
 *            fade back to faint dust.
 *
 * Kept clean on purpose: no blur, nothing tied to scroll, and cards only ever
 * change transform and opacity (fixed size, GPU-only). Stacking order changes
 * only when two cards actually pass each other. The loop runs only while the
 * section is on screen.
 */
(function () {
  'use strict';

  var section = document.querySelector('.glance');
  if (!section) return;

  var stage = section.querySelector('.glance__stage');
  var template = section.querySelector('.glance__pieces');
  var filters = Array.prototype.slice.call(section.querySelectorAll('.glance__filter'));
  var sortedBox = section.querySelector('.glance__sorted');
  var sortedTitle = section.querySelector('.glance__sorted-title');
  var sortedCount = section.querySelector('.glance__sorted-count');
  var captionBox = section.querySelector('.glance__caption');
  var metaEl = section.querySelector('.glance__meta');
  var nameEl = section.querySelector('.glance__name');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CX = 720, CY = 450;          // centre of the 1440 × 900 frame
  var CARD_W = 150, CARD_H = 200;  // every card's box; size comes from scale
  var FOCAL = 1000, CAM = 1100;    // perspective
  var COPIES = 3;                  // each piece appears this many times
  var SPIN = 0.05;                 // radians per second at rest (slow)

  var NAMES = {
    cd: 'Creative Direction', es: 'Exhibitions & Spaces', ev: 'Events',
    pr: 'Print & Collateral', ux: 'UI / UX', wd: 'Web Development'
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Small seeded random so the cloud is the same on every visit.
  var seed = 20261109;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---- Build the cards -------------------------------------------------------
  var pieces = Array.prototype.map.call(template.content.children, function (a, i) {
    return {
      index: i, href: a.getAttribute('href'), name: a.dataset.name, meta: a.dataset.meta,
      d: (a.dataset.d || '').split(/\s+/).filter(Boolean), img: a.querySelector('img')
    };
  });

  var cards = [];
  for (var copy = 0; copy < COPIES; copy++) {
    pieces.forEach(function (piece) {
      var el = document.createElement('a');
      el.className = 'glance__card';
      el.href = piece.href;
      el.draggable = false;
      var img = piece.img.cloneNode();
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      el.appendChild(img);
      if (copy > 0) { el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); img.alt = ''; }

      // A point inside an ellipsoid, a little denser towards the middle.
      var u = Math.pow(rand(), 0.6), th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      var card = {
        el: el, piece: piece, copy: copy,
        x: 340 * u * Math.sin(ph) * Math.cos(th),
        y: 290 * u * Math.cos(ph),
        z: 340 * u * Math.sin(ph) * Math.sin(th),
        size: 0.75 + rand() * 0.45,
        cur: null, drawn: {}
      };
      cards.push(card);
      stage.appendChild(el);

      // Hover a piece (mouse) or focus it (keyboard) to see its name.
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && !dragging) setHover(card); });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') setHover(null, card); });
      el.addEventListener('focus', function () { setHover(card); });
      el.addEventListener('blur', function () { setHover(null, card); });
    });
  }

  filters.forEach(function (f) {
    var n = pieces.filter(function (p) { return p.d.indexOf(f.dataset.d) !== -1; }).length;
    f.querySelector('.glance__count').textContent = pad2(n);
  });

  // ---- State -------------------------------------------------------------------
  var sortKey = null, hovered = null;
  var yaw = 0.4, pitch = 0.12, yawVel = 0, pitchVel = 0;
  var dragging = false, dragMoved = false, lastX = 0, lastY = 0, lastPointer = 'mouse';
  var k = 1, vw = 1, vh = 1;

  function setHover(card, leaving) {
    if (leaving && hovered !== leaving) return;
    hovered = card;
    captionBox.classList.toggle('is-on', !!card && !sortKey);
    section.classList.toggle('is-naming', !!card && !sortKey);
    if (card) { metaEl.textContent = card.piece.meta; nameEl.textContent = card.piece.name; }
    wake();   // the cloud pauses while a piece is hovered, and resumes after
  }

  function setSort(key) {
    if (key === sortKey) return;
    sortKey = key;
    filters.forEach(function (f) {
      var on = f.dataset.d === key;
      f.classList.toggle('is-active', on);
      f.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    section.classList.toggle('is-sorted', !!key);
    sortedBox.classList.toggle('is-on', !!key);
    if (key) {
      var hits = pieces.filter(function (p) { return p.d.indexOf(key) !== -1; });
      var projects = hits.map(function (p) { return p.name; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; }).length;
      sortedTitle.textContent = NAMES[key];
      sortedCount.textContent = pad2(hits.length) + (hits.length === 1 ? ' piece' : ' pieces') +
        '  ·  ' + projects + (projects === 1 ? ' project' : ' projects') + '  ·  click one to open';
    }
    setHover(hovered);
    wake();
  }

  filters.forEach(function (f) {
    f.setAttribute('aria-pressed', 'false');
    f.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType; });
    f.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setSort(f.dataset.d); });
    f.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') setSort(null); });
    f.addEventListener('focus', function () { setSort(f.dataset.d); });
    f.addEventListener('blur', function () { setSort(null); });
    f.addEventListener('click', function () {
      // Mouse already sorted on hover; touch and keyboard toggle.
      if (lastPointer === 'mouse' && f.matches(':hover')) return;
      setSort(sortKey === f.dataset.d ? null : f.dataset.d);
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setSort(null); });

  // Drag to spin.
  section.addEventListener('pointerdown', function (e) {
    lastPointer = e.pointerType;
    if (e.target.closest('.glance__filter, .open-link') || e.button > 0) return;
    dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) { dragMoved = true; if (hovered) setHover(null); }
    yawVel = dx * 0.005;
    pitchVel = dy * 0.003;
    yaw += yawVel;
    pitch = clamp(pitch + pitchVel, -0.6, 0.6);
    wake();
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    if (!dragging) return;
    dragging = false;
    // A tap on empty space clears a touch sort.
    if (!dragMoved && sortKey && e.pointerType !== 'mouse' && !e.target.closest('.glance__card, .glance__filter')) setSort(null);
  });
  // A drag shouldn't also open the card it ended on.
  section.addEventListener('click', function (e) {
    if (dragMoved) { e.preventDefault(); e.stopPropagation(); dragMoved = false; }
  }, true);

  function fit() {
    vw = window.innerWidth; vh = section.clientHeight || window.innerHeight;
    k = Math.min(vw / 1440, vh / 900);
    if (vw < 768) k = Math.min(vh / 900, Math.max(k, 0.5));
    section.style.setProperty('--k', k.toFixed(4));
  }

  // ---- Frame -------------------------------------------------------------------
  var lastTime = 0, running = false, visible = false, order = [];

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    if (!dragging) {
      yawVel *= Math.pow(0.9, dt * 60);
      pitchVel *= Math.pow(0.88, dt * 60);
      yaw += yawVel;
      pitch = clamp(pitch + pitchVel, -0.6, 0.6);
      pitch += (0.12 - pitch) * (1 - Math.pow(0.98, dt * 60));   // settle back to a slight tilt
      if (!reduceMotion && !sortKey && !hovered) yaw += dt * SPIN;
    }

    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

    // Sorted fan (G3)
    var fan = {}, fanCount = 0;
    if (sortKey) cards.forEach(function (c) {
      if (c.copy === 0 && c.piece.d.indexOf(sortKey) !== -1) fan[c.piece.index] = fanCount++;
    });
    var spread = Math.min(48, 6.9 * Math.max(fanCount - 1, 0));
    var ease = reduceMotion ? 1 : 1 - Math.pow(1 - 0.12, dt * 60);
    var moving = false;

    cards.forEach(function (c) {
      // Spin around Y, then tilt around X; cards always face the viewer.
      var x1 = c.x * cy - c.z * sy, z1 = c.x * sy + c.z * cy;
      var y2 = c.y * cp - z1 * sp, z2 = c.y * sp + z1 * cp;
      var depth = CAM - z2, s = FOCAL / depth;
      var t = { x: CX + x1 * s, y: CY + y2 * s, s: s * c.size, r: 0,
                o: clamp(1 - (depth - 760) * 0.2 / 680, 0.8, 1), depth: depth };

      if (sortKey) {
        if (c.copy === 0 && c.piece.index in fan) {
          var n = fan[c.piece.index];
          var ang = fanCount > 1 ? -spread / 2 + n * spread / (fanCount - 1) : 0;
          var rad = ang * Math.PI / 180;
          t = { x: 711 + 960 * Math.sin(rad), y: 1433 - 960 * Math.cos(rad), s: 1.4, r: ang, o: 1, depth: -100 + n };
        } else {
          t.x = CX + (t.x - CX) * 0.35; t.y = CY + (t.y - CY) * 0.35;
          t.s *= 0.4; t.o = 0.12; t.depth += 2000;
        }
      } else if (hovered === c) {
        // The hovered piece simply comes to the front, a touch larger; the
        // rest stay solid (dimming them made the overlaps look muddy).
        t.s *= 1.1; t.o = 1; t.depth = -1000;
      }

      if (!c.cur) c.cur = t;
      else {
        var d = Math.abs(c.cur.x - t.x) + Math.abs(c.cur.y - t.y) + Math.abs(c.cur.s - t.s) * 100 + Math.abs(c.cur.r - t.r);
        if (d > 0.05) moving = true;
        c.cur = { x: lerp(c.cur.x, t.x, ease), y: lerp(c.cur.y, t.y, ease), s: lerp(c.cur.s, t.s, ease),
                  r: lerp(c.cur.r, t.r, ease), o: lerp(c.cur.o, t.o, ease), depth: t.depth };
      }
    });

    // Stacking: nearest on top, but only re-assign when the order changes.
    var sorted = cards.slice().sort(function (a, b) { return b.cur.depth - a.cur.depth; });
    var changed = sorted.some(function (c, i) { return order[i] !== c; });
    if (changed) { order = sorted; sorted.forEach(function (c, i) { c.el.style.zIndex = i + 1; }); }

    cards.forEach(draw);

    // Keep going while visible and something is moving; otherwise rest.
    var spinning = !reduceMotion && !sortKey && !hovered;
    if (visible && (spinning || moving || dragging || Math.abs(yawVel) > 1e-4)) requestAnimationFrame(frame);
    else running = false;
  }

  function draw(c) {
    var s = c.cur, d = c.drawn, el = c.el;
    el.style.transform = 'translate3d(' + (s.x - CARD_W / 2).toFixed(2) + 'px,' + (s.y - CARD_H / 2).toFixed(2) +
      'px,0) rotate(' + s.r.toFixed(2) + 'deg) scale(' + s.s.toFixed(4) + ')';
    var o = Math.round(s.o * 100) / 100;
    if (o !== d.o) { el.style.opacity = o; d.o = o; }
  }

  function wake() {
    if (running || !visible) return;
    running = true; lastTime = 0;
    requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) wake();
    }, { rootMargin: '100px 0px' }).observe(section);
  } else { visible = true; wake(); }

  window.addEventListener('resize', function () { fit(); wake(); });
  window.addEventListener('mg:unlocked', function () { fit(); wake(); });
  fit();
})();
