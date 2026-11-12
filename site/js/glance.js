/*
 * The glance (H04): a grid of every piece.
 *   - Pick a discipline (hover, or tap / Enter): the other pieces fade back
 *     and the caption names the discipline.
 *   - Hover a piece: the rest dim a little and the caption names the piece.
 * Opacity and colour only; the CSS handles the fades.
 */
(function () {
  'use strict';

  var section = document.querySelector('.glance');
  if (!section) return;

  var grid = section.querySelector('.glance__grid');
  var cards = Array.prototype.slice.call(section.querySelectorAll('.glance__card'));
  var filters = Array.prototype.slice.call(section.querySelectorAll('.glance__filter'));
  var metaEl = section.querySelector('.glance__meta');
  var nameEl = section.querySelector('.glance__name');
  var IDLE = metaEl.textContent;

  var NAMES = {
    cd: 'Creative Direction', es: 'Exhibitions & Spaces', ev: 'Events',
    pr: 'Print & Collateral', ux: 'UI / UX', wd: 'Web Development'
  };

  function disciplines(card) { return (card.dataset.d || '').split(/\s+/).filter(Boolean); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Counts next to each discipline = pieces filed under it.
  filters.forEach(function (f) {
    var n = cards.filter(function (c) { return disciplines(c).indexOf(f.dataset.d) !== -1; }).length;
    f.querySelector('.glance__count').textContent = pad2(n);
  });

  var active = null, hovered = null;

  function caption() {
    if (hovered) {
      metaEl.textContent = hovered.dataset.meta;
      nameEl.textContent = hovered.dataset.name;
    } else if (active) {
      var hits = cards.filter(function (c) { return disciplines(c).indexOf(active) !== -1; });
      var projects = hits.map(function (c) { return c.dataset.name; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; }).length;
      metaEl.textContent = pad2(hits.length) + (hits.length === 1 ? ' piece' : ' pieces') +
        '  ·  ' + projects + (projects === 1 ? ' project' : ' projects');
      nameEl.textContent = NAMES[active];
    } else {
      metaEl.textContent = IDLE;
      nameEl.innerHTML = '&nbsp;';
    }
  }

  function setFilter(key) {
    active = key;
    filters.forEach(function (f) {
      var on = f.dataset.d === key;
      f.classList.toggle('is-active', on);
      f.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    cards.forEach(function (c) {
      c.classList.toggle('is-out', !!key && disciplines(c).indexOf(key) === -1);
    });
    caption();
  }

  var lastPointer = 'mouse';
  filters.forEach(function (f) {
    f.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType; });
    f.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setFilter(f.dataset.d); });
    f.addEventListener('click', function () {
      // Mouse already filtered on hover; touch and keyboard toggle.
      if (lastPointer === 'mouse' && f.matches(':hover')) return;
      setFilter(active === f.dataset.d ? null : f.dataset.d);
    });
  });
  section.querySelector('.glance__filters').addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') setFilter(null);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setFilter(null); });

  cards.forEach(function (c) {
    function on() { hovered = c; c.classList.add('is-hover'); grid.classList.add('is-hovering'); caption(); }
    function off() { if (hovered === c) hovered = null; c.classList.remove('is-hover'); grid.classList.remove('is-hovering'); caption(); }
    c.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') on(); });
    c.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') off(); });
    c.addEventListener('focus', on);
    c.addEventListener('blur', off);
  });
})();
