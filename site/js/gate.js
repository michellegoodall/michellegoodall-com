// Under-construction password gate.
// This is a client-side gate only: it keeps casual visitors out, but anyone
// who reads the page source can get past it. Don't rely on it for secrets.
//
// To change the password, replace PASSWORD_HASH with the output of:
//   printf 'newpassword' | shasum -a 256
(function () {
  var PASSWORD_HASH = '1c0d4e19d2673ccd7fd1b9aa017c5f482f56cbcc3f990d8660a3f364071a3c16';
  var KEY = 'mg-gate';
  var root = document.documentElement;
  // Resolve asset paths from this script's location so the gate works on
  // pages in subfolders (e.g. /work/) as well as the homepage.
  var base = new URL('..', document.currentScript.src).href;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  if (stored() === PASSWORD_HASH) return;

  root.classList.add('is-gated');

  async function sha256(text) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function build() {
    var gate = document.createElement('form');
    gate.className = 'mg-gate';
    gate.innerHTML =
      '<img class="mg-gate__logo" src="' + base + 'assets/cdn.prod.website-files.com/67e188bcae1b9517b8659be5/67e309ec32ed162d0c0daae7_mglogonewred.svg" alt="Michelle Goodall">' +
      '<input class="mg-gate__input" type="password" aria-label="Password" autocomplete="current-password" placeholder="Password" required autofocus>' +
      '<p class="mg-gate__err" role="alert" aria-live="polite"></p>';
    document.body.appendChild(gate);

    var input = gate.querySelector('input');
    var err = gate.querySelector('.mg-gate__err');
    input.focus();

    // Clicking anywhere on the screen puts the cursor back in the box.
    gate.addEventListener('mousedown', function (e) {
      if (e.target !== input) { e.preventDefault(); input.focus(); }
    });

    gate.addEventListener('submit', async function (e) {
      e.preventDefault();
      var hash = await sha256(input.value);
      if (hash === PASSWORD_HASH) {
        try { localStorage.setItem(KEY, hash); } catch (e2) {}
        root.classList.remove('is-gated');
        gate.remove();
        // The page was hidden until now, so anything that measured it on load
        // (the scroll animation) needs to measure again from the top.
        window.scrollTo(0, 0);
        window.dispatchEvent(new Event('mg:unlocked'));
      } else {
        err.textContent = 'Wrong password';
        input.value = '';
        input.focus();
      }
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
