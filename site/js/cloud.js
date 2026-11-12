/*
 * The glance, option A: "The cloud" (Figma: "Glance — Explorations" G1–G4).
 *
 * Every card is a point in 3D, projected by hand each frame (no library), so
 * the states can blend into each other:
 *   G1 at rest    the cloud turns slowly; drag to spin it
 *   G2 flying in  scroll moves the camera into the cloud; the card under your
 *                 cursor (the red blob) comes forward and is named in script
 *   G3 sorting    hover / tap a discipline: its pieces fan out, the rest drop
 *                 back into faint dust
 *   G4 handoff    the cloud gathers into one deck, then the Pinky Ring photo
 *                 opens out from the top card and becomes the Beloved Projects
 *                 screen, which then scrolls on to the featured projects
 *
 * Performance: cards are a fixed size and move with transform + opacity only
 * (no filters, no width/height changes), so everything stays on the GPU.
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
  var cover = section.querySelector('.cloud__cover');
  var handoff = section.querySelector('.cloud__handoff');
  var openLink = section.querySelector('.cloud__open');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CX = 720, CY = 450;         // centre of the 1440 × 900 frame
  var CARD_W = 150, CARD_H = 200; // every card's box; size comes from scale
  var FOCAL = 1000;               // perspective focal length
  var REST_DIST = 1100;           // camera distance at rest (G1)
  var FLY_DIST = 480;             // camera distance at the end of the fly-in (G2): inside the cloud, not through it
  var COPIES = 3;                 // each piece appears this many times in the cloud

  // Scroll phases (fractions of the pinned scene). The last stretch holds on
  // the finished Beloved Projects screen before the page moves on.
  var REST_END = 0.1, FLY_END = 0.5, GATHER_END = 0.76, OPEN_END = 0.9;

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
  var TOP = pieces.length - 1;     // the last piece tops the deck and opens into the photo

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
      cards.push({
        el: el, piece: piece, copy: copy,
        x: 340 * u * Math.sin(ph) * Math.cos(th),
        y: 300 * u * Math.cos(ph),
        z: 340 * u * Math.sin(ph) * Math.sin(th),
        size: 0.75 + rand() * 0.45,
        cur: null, drawn: {}
      });
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
  var mouseX = null, mouseY = null;          // in window px; null until the mouse moves
  var k = 1, vw = 1, vh = 1, mobile = false;

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
    if (e.target.closest('.cloud__magnet, .cloud__open') || e.button > 0) return;
    dragging = true; dragMoved = false;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { mouseX = e.clientX; mouseY = e.clientY; }
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 1) dragMoved = true;
    yawVel = dx * 0.006;
    pitchVel = dy * 0.004;
    yaw += yawVel;
    pitch = clamp(pitch + pitchVel, -0.7, 0.7);
  }, { passive: true });
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
    var s = FOCAL / Math.max(depth, 60);   // cards at the camera stay big and off-screen
    return { x: CX + x1 * s, y: CY + y2 * s, s: s * c.size, depth: depth };
  }

  var focused = null, shownPiece = null, lastTime = 0, running = false, visible = false, order = [];

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    var r = section.getBoundingClientRect();
    if (!r.height) { if (visible) requestAnimationFrame(frame); else running = false; return; }
    // Scroll progress: the eased value js/home.js writes as --p (so the fly-in,
    // gather and photo opening glide rather than step with the mouse wheel).
    var eased = parseFloat(section.style.getPropertyValue('--p'));
    var span = r.height - vh;
    var p = isNaN(eased) ? (span > 0 ? clamp(-r.top / span, 0, 1) : 0) : eased;

    var fly = smooth((p - REST_END) / (FLY_END - REST_END));
    var gather = smooth((p - FLY_END) / (GATHER_END - FLY_END));
    var open = smooth((p - GATHER_END) / (OPEN_END - GATHER_END));

    if (sortKey && (fly > 0.02 || gather > 0)) setSort(null);    // scrolling on ends a sort

    // Slow turn at rest, drag inertia, and a slower drift while flying.
    if (!dragging) {
      yawVel *= Math.pow(0.92, dt * 60);
      pitchVel *= Math.pow(0.9, dt * 60);
      yaw += yawVel;
      pitch = clamp(pitch + pitchVel, -0.7, 0.7);
      pitch += (0.12 - pitch) * 0.02;
    }
    if (!reduceMotion && !sortKey) yaw += dt * 0.06 * (1 - 0.6 * fly) * (1 - gather);

    // The camera flies in, then pulls back out as the cloud gathers, so cards
    // travel into the deck from a normal-looking cloud (not from huge, faded
    // cards right at the camera).
    var camDist = lerp(REST_DIST, FLY_DIST, fly * (1 - smooth(gather * 1.6)));
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var proj = cards.map(function (c) { return project(c, camDist, cy, sy, cp, sp); });

    // G2: the card under the cursor (or the centre, on touch) comes forward.
    focused = null;
    if (fly > 0.08 && gather < 0.15) {
      var fx = CX, fy = CY;
      if (mouseX !== null && !mobile) { fx = CX + (mouseX - vw / 2) / k; fy = CY + (mouseY - vh / 2) / k; }
      var best = null, bestDepth = Infinity;
      proj.forEach(function (q, i) {
        if (q.depth < 220) return;
        var hw = CARD_W * q.s / 2, hh = CARD_H * q.s / 2;
        if (Math.abs(q.x - fx) < hw && Math.abs(q.y - fy) < hh && q.depth < bestDepth) { bestDepth = q.depth; best = i; }
      });
      if (best !== null) focused = cards[best];
    }

    // G3: sorted fan
    var fanIndex = {}, fanCount = 0;
    if (sortKey) {
      cards.forEach(function (c) {
        if (c.copy === 0 && c.piece.d.indexOf(sortKey) !== -1) fanIndex[c.piece.index] = fanCount++;
      });
    }
    var spread = Math.min(48, 6.9 * Math.max(fanCount - 1, 0));

    var ease = 1 - Math.pow(1 - 0.2, dt * 60);

    cards.forEach(function (c, i) {
      var q = proj[i];
      var t = { x: q.x, y: q.y, s: q.s, r: 0, o: 1, z: Math.round(3000 - q.depth) };

      // G1: far cards a touch faded (80–100%), so overlaps stay crisp.
      t.o = clamp(1 - (q.depth - 155) * 0.2 / 875, 0.8, 1);
      if (fly > 0) {
        // G2: anything reaching the camera fades away; the focus card simply
        // comes to the front, a touch larger (the rest stay solid).
        t.o *= clamp((q.depth - 110) / 70, 0, 1);   // short fade, so few cards are ever see-through
        if (c === focused) { t.o = 1; t.z = 4000; t.s *= 1.06; }
      }

      // G3: matching pieces fan out, the rest fall back into dust.
      if (sortKey) {
        if (c.copy === 0 && c.piece.index in fanIndex) {
          var n = fanIndex[c.piece.index];
          var ang = fanCount > 1 ? -spread / 2 + n * spread / (fanCount - 1) : 0;
          var rad = ang * Math.PI / 180;
          t = { x: 711 + 960 * Math.sin(rad), y: 1433 - 960 * Math.cos(rad), s: 1.4, r: ang, o: 1, z: 5000 + n };
        } else {
          t.x = CX + (t.x - CX) * 0.35; t.y = CY + (t.y - CY) * 0.35;
          t.s *= 0.4; t.o = 0.12; t.z = Math.min(t.z, 2000);
        }
      }

      // G4: gather into one deck.
      if (gather > 0) {
        var slot = c.piece.index, deck;
        if (c.copy === 0) {
          // Solid cards (see-through ones layered into a ghostly mess).
          deck = { x: DECK[slot][0], y: DECK[slot][1], s: (300 + 14 * slot) / CARD_W,
                   r: (11 - 1.1 * slot) * (slot % 2 ? -1 : 1), o: 1, z: 6000 + slot };
        } else {
          deck = { x: CX - 9, y: CY, s: 2, r: 0, o: 0, z: 5000 };
        }
        // Duplicates fade out in the first part of the gather, so only the
        // ten deck cards are seen travelling in.
        var go = c.copy === 0 ? gather : clamp(gather * 2.5, 0, 1);
        t = { x: lerp(t.x, deck.x, gather), y: lerp(t.y, deck.y, gather), s: lerp(t.s, deck.s, gather),
              r: lerp(t.r, deck.r, gather), o: lerp(t.o, deck.o, go), z: gather > 0.5 ? deck.z : t.z };
        // The deck fades out under the opening photo.
        if (open > 0) t.o *= 1 - clamp(open * 2.5, 0, 1);
      }

      if (!c.cur || reduceMotion) c.cur = t;
      else {
        c.cur = { x: lerp(c.cur.x, t.x, ease), y: lerp(c.cur.y, t.y, ease), s: lerp(c.cur.s, t.s, ease),
                  r: lerp(c.cur.r, t.r, ease), o: lerp(c.cur.o, t.o, ease), z: t.z };
      }
      c.zt = t.z;
      draw(c);
    });

    // Stacking: nearest on top, re-assigned only when the order actually
    // changes, so cards don't flicker as they pass each other.
    var sorted = cards.slice().sort(function (a, b) { return a.zt - b.zt; });
    if (sorted.some(function (c, i) { return order[i] !== c; })) {
      order = sorted;
      sorted.forEach(function (c, i) { c.el.style.zIndex = i + 1; });
    }

    // The Beloved Projects photo opens out of the deck's top card.
    if (open > 0) {
      var w = (300 + 14 * TOP) * k, h = (380 + 16 * TOP) * k;
      var cx = vw / 2 + (DECK[TOP][0] - CX) * k, cyy = vh / 2 + (DECK[TOP][1] - CY) * k;
      var top = (cyy - h / 2) * (1 - open), left = (cx - w / 2) * (1 - open);
      var right = (vw - cx - w / 2) * (1 - open), bottom = (vh - cyy - h / 2) * (1 - open);
      cover.style.clipPath = 'inset(' + top.toFixed(1) + 'px ' + right.toFixed(1) + 'px ' +
        bottom.toFixed(1) + 'px ' + left.toFixed(1) + 'px)';
      cover.style.opacity = clamp(open * 4, 0, 1).toFixed(3);
    } else {
      cover.style.opacity = '0';
    }
    var headline = smooth((open - 0.55) / 0.45);
    handoff.style.opacity = headline.toFixed(3);
    openLink.style.opacity = headline.toFixed(3);
    openLink.style.visibility = headline > 0.5 ? 'visible' : 'hidden';

    // Text layers
    var restVis = (1 - clamp(fly * 6, 0, 1)) * (1 - gather);
    magnetBox.style.opacity = restVis.toFixed(3);
    magnetBox.style.visibility = restVis < 0.02 ? 'hidden' : '';
    hintRest.style.opacity = (sortKey ? 0 : restVis).toFixed(3);
    hintGather.style.opacity = (gather * (1 - open)).toFixed(3);
    belovedBack.style.opacity = (gather * (1 - clamp(open * 3, 0, 1))).toFixed(3);
    sortedBox.style.opacity = sortKey ? '1' : '0';

    focusBox.classList.toggle('is-on', !!focused);
    if (focused && focused.piece !== shownPiece) {
      shownPiece = focused.piece;
      focusMeta.textContent = shownPiece.meta;
      focusName.textContent = shownPiece.name;
    }

    // Once the photo has opened, this screen is "04 Projects" on the rail.
    var railKey = open > 0.5 ? 'projects' : 'glance';
    if (section.dataset.rail !== railKey) section.dataset.rail = railKey;

    if (visible) requestAnimationFrame(frame);
    else running = false;
  }

  function draw(c) {
    var s = c.cur, d = c.drawn, el = c.el;
    el.style.transform = 'translate3d(' + (s.x - CARD_W / 2).toFixed(2) + 'px,' + (s.y - CARD_H / 2).toFixed(2) +
      'px,0) rotate(' + s.r.toFixed(2) + 'deg) scale(' + s.s.toFixed(4) + ')';
    var o = Math.round(s.o * 100) / 100;
    // ('' rather than 'visible', so a hidden parent still hides the cards)
    if (o !== d.o) { el.style.opacity = o; d.o = o; el.style.visibility = o < 0.01 ? 'hidden' : ''; }
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
