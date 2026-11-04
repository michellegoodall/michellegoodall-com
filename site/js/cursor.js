/*
 * Gooey blob cursor.
 *
 * One fixed-size canvas, one requestAnimationFrame loop, a fixed number of
 * points. The head eases toward the mouse and each following point eases
 * toward the one ahead of it, so the chain forms a tapered liquid tail. All
 * circles go into a single path and are filled once, so overlaps merge into
 * one smooth shape (no SVG filters, no per-move DOM nodes).
 *
 * The loop stops itself once the tail has settled and restarts on the next
 * mouse move, so it costs nothing while idle or while only scrolling.
 */
(function () {
  // Skip on touch-only devices: there is no cursor to replace.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var COLOR = '#811600';
  var POINTS = 14;        // length of the tail
  var HEAD_RADIUS = 20;   // px
  var TAIL_RADIUS = 4;    // px, radius of the last point
  var HEAD_EASE = 0.35;   // how quickly the head catches the mouse (0–1)
  var TAIL_EASE = 0.42;   // how tightly each point follows the one ahead
  var WOBBLE = 0.08;      // gentle breathing of the radii (fraction)

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wake();
  }

  var mouseX = -100, mouseY = -100;
  var visible = false;
  var pts = [];
  for (var i = 0; i < POINTS; i++) pts.push({ x: mouseX, y: mouseY });

  var running = false;
  var lastTime = 0;

  function frame(now) {
    // Frame-rate independent easing (tuned for 60fps).
    var dt = lastTime ? Math.min((now - lastTime) / 16.667, 3) : 1;
    lastTime = now;
    var headK = 1 - Math.pow(1 - (reduceMotion ? 1 : HEAD_EASE), dt);
    var tailK = 1 - Math.pow(1 - (reduceMotion ? 1 : TAIL_EASE), dt);

    pts[0].x += (mouseX - pts[0].x) * headK;
    pts[0].y += (mouseY - pts[0].y) * headK;
    var moving = Math.abs(mouseX - pts[0].x) + Math.abs(mouseY - pts[0].y) > 0.1;

    for (var i = 1; i < POINTS; i++) {
      var p = pts[i], prev = pts[i - 1];
      var dx = prev.x - p.x, dy = prev.y - p.y;
      p.x += dx * tailK;
      p.y += dy * tailK;
      if (Math.abs(dx) + Math.abs(dy) > 0.1) moving = true;
    }

    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (visible) {
      var t = now / 1000;
      var radii = [];
      for (var j = 0; j < POINTS; j++) {
        var f = j / (POINTS - 1);
        var r = HEAD_RADIUS + (TAIL_RADIUS - HEAD_RADIUS) * f;
        if (!reduceMotion) r *= 1 + WOBBLE * Math.sin(t * 2.2 + j * 0.6);
        radii.push(r);
      }
      ctx.beginPath();
      for (var k = POINTS - 1; k >= 0; k--) {
        circle(pts[k].x, pts[k].y, radii[k]);
        if (k === 0) break;
        // Fill the gap to the next point so fast moves stay one smooth shape.
        var a = pts[k], b = pts[k - 1];
        var gap = Math.hypot(b.x - a.x, b.y - a.y);
        var step = Math.max(radii[k] * 0.5, 1);
        for (var d = step; d < gap; d += step) {
          var u = d / gap;
          circle(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u,
                 radii[k] + (radii[k - 1] - radii[k]) * u);
        }
      }
      ctx.fillStyle = COLOR;
      ctx.fill(); // one fill: overlapping circles merge into one shape
    }

    if (moving) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      lastTime = 0;
    }
  }

  function circle(x, y, r) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  function wake() {
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!visible) {
      // Appear in place instead of streaking in from the corner.
      visible = true;
      for (var i = 0; i < POINTS; i++) { pts[i].x = mouseX; pts[i].y = mouseY; }
    }
    wake();
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', function () {
    visible = false;
    wake();
  });

  window.addEventListener('resize', resize);
  resize();

  // Hide the native cursor only once this script is running.
  document.documentElement.classList.add('has-blob-cursor');
})();
