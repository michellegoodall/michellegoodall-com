/*
 * The glance, option A: "The cloud" (Figma: "Glance — Explorations" G1–G4).
 *
 * Every card is a point in 3D, projected by hand each frame (no library), so
 * the four states can blend into each other:
 *   G1 at rest    the cloud turns slowly; drag to spin it
 *   G2 flying in  scroll moves the camera into the cloud; near cards blur and
 *                 rush past, the card under the red dot sharpens and is named
 *   G3 sorting    hover / tap a discipline: its pieces fan out, the rest drop
 *                 back into faint dust
 *   G4 handoff    the cloud gathers into one deck, and the top card (the Pinky
 *                 Ring photo) grows to fill the screen, which is where the
 *                 Beloved Projects section picks up
 * Positions are in the Figma frame's 1440 × 900 space; the stage is scaled to
 * the window with --k.
 */
(function () {
  'use strict';

  var section = document.querySelector('.cloud');
  if (!section) return;

  var pin = section.querySelector('.scene__pin');
  var stage = section.querySelector('.cloud__stage');
  var template = section.querySelector('.cloud__pieces');
  var magnets = Array.prototype.slice.call(section.querySelectorAll('.cloud__magnet'));
  var reticle = section.querySelector('.cloud__reticle');
  var magnetBox = section.querySelector('.cloud__magnets');
  var sortedBox = section.querySelector('.cloud__sorted');
  var sortedTitle = section.querySelector('.cloud__sorted-title');
  var sortedCount = section.querySelector('.cloud__sorted-count');
  var focusBox = section.querySelector('.cloud__focus');
  var focusMeta = section.querySelector('.cloud__focus-meta');
  var focusName = section.querySelector('.cloud__focus-name');
  var belovedBack = section.querySelector('.cloud__beloved');
  var hintRest = section.querySelector('.cloud__hint--rest');
  var hintGather = section.querySelector('.cloud__hint--gather');
  var handoff = section.querySelector('.cloud__handoff');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CX = 720, CY = 450;         // centre of the 1440 × 900 frame
  var FOCAL = 1000;               // perspective focal length
  var REST_DIST = 1100;           // camera distance at rest (G1)
  var FLY_DIST = 150;             // camera distance at the end of the fly-in (G2)
  var COPIES = 3;                 // each piece appears this many times in the cloud

  // Scroll phases (fractions of the pinned scene)
  var REST_END = 0.12, FLY_END = 0.6, GATHER_END = 0.88;

  // G4 deck: card centres from the Figma frame, bottom → top.
  var DECK = [[667, 475], [752, 420], [701, 473], [733, 425], [693, 469],
              [755, 431], [687, 464], [734, 438], [724, 458], [711, 446]];

  var DISCIPLINES = {
    cd: 'Creative Direction', es: 'Exhibitions & Spaces', ev: 'Events',
    pr: 'Print & Collateral', ux: 'UI / UX', wd: 'Web Development'
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
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
      index: i,
      href: a.getAttribute('href'),
      name: a.dataset.name,
      meta: a.dataset.meta,
      d: (a.dataset.d || '').split(/\s+/).filter(Boolean),
      img: a.querySelector('img')
    };
  });

  var SHAPES = [[120, 160], [160, 120], [140, 140]];   // portrait, landscape, square
  var cards = [];

  for (var copy = 0; copy < COPIES; copy++) {
    pieces.forEach(function (piece) {
      var el = document.createElement('a');
      el.className = 'cloud__card';
      el.href = piece.href;
      el.draggable = false;
      var img = piece.img.cloneNode();
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      el.appendChild(img);
      if (copy > 0) {                      // duplicates are decoration only
        el.tabIndex = -1;
        el.setAttribute('aria-hidden', 'true');
        img.alt = '';
      }

      // A point inside an ellipsoid, a little denser towards the middle.
      var u = Math.pow(rand(), 0.6), th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      var shape = SHAPES[Math.floor(rand() * SHAPES.length)];
      var size = 0.85 + rand() * 0.35;

      var card = {
        el: el, piece: piece, copy: copy,
        x: 340 * u * Math.sin(ph) * Math.cos(th),
        y: 300 * u * Math.cos(ph),
        z: 340 * u * Math.sin(ph) * Math.sin(th),
        w: shape[0] * size, h: shape[1] * size,
        cur: null, drawn: {}
      };
      cards.push(card);
      stage.appendChild(el);
    });
  }

  // Discipline counts = how many pieces sit under each.
  magnets.forEach(function (m) {
    var n = pieces.filter(function (p) { return p.d.indexOf(m.dataset.d) !== -1; }).length;
    m.querySelector('.cloud__count').textContent = pad2(n);
  });

  // ---- Interaction state -------------------------------------------------------
  var sortKey = null;
  var yaw = 0.4, pitch = 0.12, yawVel = 0, pitchVel = 0;
  var dragging = false, dragMoved = false, lastX = 0, lastY = 0, lastPointer = 'mouse';
  var k = 1, u = 1, vw = 1, vh = 1, mobile = false;

  function setSort(key) {
    if (key === sortKey) return;
    sortKey = key;
    magnets.forEach(function (m) {
      var on = m.dataset.d === key;
      m.classList.toggle('is-active', on);
      m.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    pin.classList.toggle('is-sorted', !!key);
    if (key) {
      var hits = pieces.filter(function (p) { return p.d.indexOf(key) !== -1; });
      var projects = hits.map(function (p) { return p.name; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; }).length;
      sortedTitle.textContent = DISCIPLINES[key];
      sortedCount.textContent = pad2(hits.length) + (hits.length === 1 ? ' piece' : ' pieces') +
        '  ·  ' + projects + (projects === 1 ? ' project' : ' projects') + '  ·  click one to open';
    }
  }

  magnets.forEach(function (m) {
    m.setAttribute('aria-pressed', 'false');
    m.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setSort(m.dataset.d); });
    m.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') setSort(null); });
    m.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType; });
    m.addEventListener('focus', function () { setSort(m.dataset.d); });
    m.addEventListener('click', function () {
      // Mouse already sorted on hover; touch and keyboard toggle.
      if (lastPointer === 'mouse' && m.matches(':hover')) return;
      setSort(sortKey === m.dataset.d ? null : m.dataset.d);
    });
  });
  magnetBox.addEventListener('focusout', function (e) {
    if (!magnetBox.contains(e.relatedTarget)) setSort(null);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setSort(null); });

  // Drag to orbit (anywhere on the scene except the discipline buttons).
  pin.addEventListener('pointerdown', function (e) {
    lastPointer = e.pointerType;
    if (e.target.closest('.cloud__magnet') || e.button > 0) return;
    dragging = true; dragMoved = false;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 1) dragMoved = true;
    yawVel = dx * 0.006;
    pitchVel = dy * 0.004;
    yaw += yawVel;
    pitch = clamp(pitch + pitchVel, -0.7, 0.7);
  });
  window.addEventListener('pointerup', function (e) {
    if (!dragging) return;
    dragging = false;
    // A tap on empty space clears a touch sort.
    if (!dragMoved && sortKey && e.pointerType !== 'mouse' && !e.target.closest('.cloud__card, .cloud__magnet')) setSort(null);
  });
  // A drag shouldn't also open the card it ended on.
  pin.addEventListener('click', function (e) {
    if (dragMoved) { e.preventDefault(); e.stopPropagation(); dragMoved = false; }
  }, true);

  // ---- Layout ------------------------------------------------------------------
  function fit() {
    vw = window.innerWidth; vh = window.innerHeight;
    mobile = vw < 768;
    k = Math.min(vw / 1440, vh / 900);
    // The design unit --u from css/home.css (one Figma px), needed for the handoff.
    u = mobile ? 0.62 : Math.max(0.6, k);
    if (mobile) k = Math.min(vh / 900, Math.max(k, 0.48));
    pin.style.setProperty('--k', k.toFixed(4));
  }

  // ---- Frame -------------------------------------------------------------------
  function project(c, camDist, cy, sy, cp, sp) {
    // Spin around Y, then tilt around X.
    var x1 = c.x * cy - c.z * sy;
    var z1 = c.x * sy + c.z * cy;
    var y2 = c.y * cp - z1 * sp;
    var z2 = c.y * sp + z1 * cp;
    var depth = camDist - z2;
    var s = FOCAL / Math.max(depth, 40);   // cards behind the camera stay huge and off-screen
    return { x: CX + x1 * s, y: CY + y2 * s, w: c.w * s, h: c.h * s, depth: depth };
  }

  var focused = null, shownPiece = null, lastTime = 0, running = false, visible = false, pinHidden = false;

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    var r = section.getBoundingClientRect();
    if (!r.height) { requestAnimationFrame(frame); return; }      // behind the password gate
    var span = r.height - vh;
    var p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;

    var fly = smooth((p - REST_END) / (FLY_END - REST_END));
    var gather = smooth((p - FLY_END) / (GATHER_END - FLY_END));
    var hand = smooth((p - GATHER_END) / (1 - GATHER_END));

    if (sortKey && (fly > 0.02 || gather > 0)) setSort(null);    // scrolling away ends a sort

    // Slow turn at rest, drag inertia, and a slower drift while flying.
    if (!dragging) {
      yawVel *= Math.pow(0.92, dt * 60);
      pitchVel *= Math.pow(0.9, dt * 60);
      yaw += yawVel;
      pitch = clamp(pitch + pitchVel, -0.7, 0.7);
      pitch += (0.12 - pitch) * 0.02;
    }
    if (!reduceMotion && !sortKey) yaw += dt * 0.08 * (1 - 0.6 * fly) * (1 - gather);

    var camDist = lerp(REST_DIST, FLY_DIST, fly);
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

    // Project everything, then pick the card under the reticle while flying.
    var proj = cards.map(function (c) { return project(c, camDist, cy, sy, cp, sp); });

    focused = null;
    if (fly > 0.08 && gather < 0.15) {
      var best = null, bestScore = Infinity;
      proj.forEach(function (q, i) {
        if (q.depth < 220) return;
        var dx = Math.abs(q.x - CX), dy = Math.abs(q.y - CY);
        var inside = dx < q.w / 2 && dy < q.h / 2;
        var score = (inside ? 0 : 10000) + q.depth;
        if (!inside && Math.hypot(dx, dy) > 160) return;
        if (score < bestScore) { bestScore = score; best = i; }
      });
      if (best !== null) focused = cards[best];
    }

    // Sorted fan (G3)
    var fanIndex = {}, fanCount = 0;
    if (sortKey) {
      cards.forEach(function (c) {
        if (c.copy === 0 && c.piece.d.indexOf(sortKey) !== -1) fanIndex[c.piece.index] = fanCount++;
      });
    }
    var spread = Math.min(48, 6.9 * Math.max(fanCount - 1, 0));

    var ease = 1 - Math.pow(1 - 0.14, dt * 60);

    cards.forEach(function (c, i) {
      var q = proj[i];
      var t = { x: q.x, y: q.y, w: q.w, h: q.h, r: 0, o: 1, b: 0, z: Math.round(3000 - q.depth) };

      // Opacity and blur by depth (G1: far cards ~72% and slightly soft).
      t.o = clamp(1 - (q.depth - 155) * 0.32 / 875, 0.7, 1);
      t.b = q.depth > 800 ? 1 : 0;
      if (fly > 0) {
        // G2: near cards rush past blurred; anything at the camera fades out.
        // Within ~600px of the camera a card goes soft, up to 7px when it's close
        // (G2); everything else keeps a faint 0.75px so the focus card stands out.
        var ramp = clamp(fly * 4, 0, 1);
        var nearBlur = clamp((600 - q.depth) / 350, 0, 1) * 7;
        t.b = Math.max(t.b * (1 - ramp), (nearBlur > 0.75 ? nearBlur : 0.75) * ramp);
        t.o *= clamp((q.depth - 60) / 140, 0, 1) * lerp(1, 0.75, fly);
        if (c === focused) { t.b = 0; t.o = 1; t.z = 4000; }
      }

      // G3: matching pieces fan out, the rest fall back into dust.
      if (sortKey) {
        if (c.piece.index in fanIndex && c.copy === 0) {
          var n = fanIndex[c.piece.index];
          var ang = fanCount > 1 ? -spread / 2 + n * spread / (fanCount - 1) : 0;
          var rad = ang * Math.PI / 180;
          t = { x: 711 + 960 * Math.sin(rad), y: 1433 - 960 * Math.cos(rad), w: 210, h: 280, r: ang, o: 1, b: 0, z: 5000 + n };
        } else {
          t.x = CX + (t.x - CX) * 0.35; t.y = CY + (t.y - CY) * 0.35;
          t.w *= 0.4; t.h *= 0.4; t.o = 0.12; t.b = 1; t.z = Math.min(t.z, 2000);
        }
      }

      // G4: gather into one deck, then the top card becomes the photo.
      if (gather > 0) {
        var slot = c.piece.index, deck;
        if (c.copy === 0) {
          var size = slot;
          deck = { x: DECK[slot][0], y: DECK[slot][1], w: 300 + 14 * size, h: 380 + 16 * size,
                   r: (11 - 1.1 * slot) * (slot % 2 ? -1 : 1), o: 0.4 + 0.06 * slot, b: 0, z: 6000 + slot };
        } else {
          deck = { x: CX - 9, y: CY, w: 300, h: 380, r: 0, o: 0, b: 0, z: 5000 };
        }
        t = { x: lerp(t.x, deck.x, gather), y: lerp(t.y, deck.y, gather), w: lerp(t.w, deck.w, gather),
              h: lerp(t.h, deck.h, gather), r: lerp(t.r, deck.r, gather), o: lerp(t.o, deck.o, gather),
              b: lerp(t.b, 0, gather), z: gather > 0.5 ? deck.z : t.z };

        if (hand > 0) {
          if (c.copy === 0 && slot === pieces.length - 1) {
            // Grow to exactly the box of the next section's photo (it overhangs
            // the window by 180u each side and 112u top and bottom, see
            // .beloved__photo), so the crop matches when the pin lets go.
            var cw = (vw + 360 * u) / k, ch = (vh + 224 * u) / k;
            t.x = lerp(t.x, CX, hand); t.y = lerp(t.y, CY, hand);
            t.w = lerp(t.w, cw, hand); t.h = lerp(t.h, ch, hand);
            t.r = lerp(t.r, 0, hand); t.o = lerp(t.o, 1, hand);
          } else {
            t.o *= 1 - hand;
          }
        }
      }

      // Ease toward the target (sorting and the fly-in feel weighted, not instant).
      // (The handoff tracks scroll exactly so the swap at the end lines up.)
      if (!c.cur || reduceMotion || hand > 0) c.cur = t;
      else {
        var a = ease;
        c.cur = { x: lerp(c.cur.x, t.x, a), y: lerp(c.cur.y, t.y, a), w: lerp(c.cur.w, t.w, a),
                  h: lerp(c.cur.h, t.h, a), r: lerp(c.cur.r, t.r, a), o: lerp(c.cur.o, t.o, a),
                  b: lerp(c.cur.b, t.b, a), z: t.z };
      }
      draw(c);
    });

    // Text layers
    var restVis = (1 - clamp(fly * 6, 0, 1)) * (1 - gather);
    magnetBox.style.opacity = restVis.toFixed(3);
    magnetBox.style.visibility = restVis < 0.02 ? 'hidden' : '';
    hintRest.style.opacity = (sortKey ? 0 : restVis).toFixed(3);
    hintGather.style.opacity = (gather * (1 - hand)).toFixed(3);
    reticle.style.opacity = (clamp(fly * 5, 0, 1) * (1 - clamp(gather * 3, 0, 1))).toFixed(3);
    belovedBack.style.opacity = (gather * (1 - hand)).toFixed(3);
    handoff.style.opacity = hand.toFixed(3);
    // At the very end the next section sits underneath, identical: let go.
    var done = p >= 0.9999;
    if (done !== pinHidden) { pinHidden = done; pin.style.visibility = done ? 'hidden' : ''; }
    sortedBox.style.opacity = sortKey ? '1' : '0';

    focusBox.classList.toggle('is-on', !!focused);
    if (focused && focused.piece !== shownPiece) {
      shownPiece = focused.piece;
      focusMeta.textContent = shownPiece.meta;
      focusName.textContent = shownPiece.name;
    }

    if (visible) requestAnimationFrame(frame);
    else running = false;
  }

  function draw(c) {
    var s = c.cur, d = c.drawn, el = c.el;
    var w = Math.round(s.w * 2) / 2, h = Math.round(s.h * 2) / 2;
    if (w !== d.w) { el.style.width = w + 'px'; d.w = w; }
    if (h !== d.h) { el.style.height = h + 'px'; d.h = h; }
    el.style.transform = 'translate3d(' + (s.x - w / 2).toFixed(1) + 'px,' + (s.y - h / 2).toFixed(1) +
      'px,0) rotate(' + s.r.toFixed(2) + 'deg)';
    var o = Math.round(s.o * 100) / 100;
    // ('' rather than 'visible', so hiding the pin at the handoff hides cards too)
    if (o !== d.o) { el.style.opacity = o; d.o = o; el.style.visibility = o < 0.01 ? 'hidden' : ''; }
    var b = Math.round(s.b * 4) / 4;
    if (b !== d.b) { el.style.filter = b > 0 ? 'blur(' + b + 'px)' : 'none'; d.b = b; }
    if (s.z !== d.z) { el.style.zIndex = s.z; d.z = s.z; }
  }

  function start() {
    if (running) return;
    running = true; lastTime = 0;
    requestAnimationFrame(frame);
  }

  // Only animate while the section is on (or near) the screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }, { rootMargin: '200px 0px' }).observe(section);
  } else {
    visible = true; start();
  }

  window.addEventListener('resize', fit);
  window.addEventListener('mg:unlocked', function () { fit(); if (visible) start(); });
  fit();

  // Exposed for debugging in the console, e.g. glanceCloud.sort('es')
  window.glanceCloud = { sort: setSort, cards: cards };
})();
