/*
 * Work index interactions (Figma: "Work — Concept" › W01 / W02).
 *
 * Filter: the chosen discipline turns red, rows that aren't filed under it
 *   fade to 18%, and the matching tags inside each row turn red.
 * Hover: the hovered row stays cream while the others dim to ink, and a
 *   tilted preview image trails the cursor blob.
 */
(function () {
  'use strict';

  var list = document.querySelector('.rows');
  if (!list) return;
  var rows = Array.prototype.slice.call(list.querySelectorAll('.row'));
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.filter__btn'));

  // ---- Filter ---------------------------------------------------------------
  function applyFilter(key) {
    buttons.forEach(function (btn) {
      var on = btn.dataset.filter === key;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    rows.forEach(function (row) {
      var filed = row.dataset.disciplines.split(' ');
      row.classList.toggle('is-out', key !== 'all' && filed.indexOf(key) === -1);
      row.querySelectorAll('.row__tags span').forEach(function (tag) {
        tag.classList.toggle('is-match', key !== 'all' && tag.dataset.d === key);
      });
    });
    if (hovered && hovered.classList.contains('is-out')) setHover(null);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () { applyFilter(btn.dataset.filter); });
  });

  // ---- Hover + preview ------------------------------------------------------
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!canHover) return;

  var preview = document.querySelector('.preview');
  var hovered = null;

  // The design puts the image up and to the left of the blob, so the blob
  // sits on its lower-right corner. Offsets are from the cursor to the
  // image's top-left corner (380 × 254, rotated 4°).
  var OFFSET_X = -372;
  var OFFSET_Y = -209;
  var EASE = 0.18;

  var mouseX = 0, mouseY = 0, x = 0, y = 0, running = false;

  function setHover(row) {
    if (row === hovered) return;
    if (hovered) hovered.classList.remove('is-hover');
    hovered = row;
    list.classList.toggle('is-hovering', !!row);
    if (row) row.classList.add('is-hover');

    var src = row && row.dataset.preview;
    if (src) {
      if (preview.getAttribute('src') !== src) preview.src = src;
      if (!preview.classList.contains('is-visible')) { x = mouseX + OFFSET_X; y = mouseY + OFFSET_Y; }
      preview.classList.add('is-visible');
      wake();
    } else {
      preview.classList.remove('is-visible');
    }
  }

  function frame() {
    x += (mouseX + OFFSET_X - x) * EASE;
    y += (mouseY + OFFSET_Y - y) * EASE;
    preview.style.transform = 'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, 0) rotate(4deg)';
    // Stop once the image has caught up; the next pointer move restarts it.
    if (Math.abs(mouseX + OFFSET_X - x) + Math.abs(mouseY + OFFSET_Y - y) < 0.2) { running = false; return; }
    requestAnimationFrame(frame);
  }
  function wake() {
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  document.addEventListener('pointermove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    var row = e.target.closest && e.target.closest('.row');
    setHover(row && !row.classList.contains('is-out') ? row : null);
    if (hovered) wake();
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', function () { setHover(null); });

  // Scrolling moves rows under a still cursor, so re-check what's under it.
  window.addEventListener('scroll', function () {
    var el = document.elementFromPoint(mouseX, mouseY);
    var row = el && el.closest('.row');
    setHover(row && !row.classList.contains('is-out') ? row : null);
  }, { passive: true });
})();
