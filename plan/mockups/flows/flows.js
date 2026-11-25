// Shared behaviour for the learner-flow mockups (not part of the product).
// 1. Builds the preview toolbar (screen picker, phone width, logic notes).
// 2. Fills <div data-hdr="..."> placeholders with the header variants so every screen uses the same navbar markup.
// 3. Small interactions: menu, account dropdown, tabs, filter chips, toggles, copy buttons, fake QR.
// PLACEHOLDER DATA: the learner (Rohit Menon), prices, dates, the UPI ID, phone numbers and every photo are invented.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s) };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) };
  var ic = function (n, c) { return '<svg class="ic' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>' };
  var brand = '<a class="brand" href="flows-index.html" aria-label="CloudCadre home"><svg class="mark" aria-hidden="true"><use href="#cc-mark"/></svg><span>Cloud<span class="c2">Cadre</span></span></a>';
  var wa = '<svg class="wa" aria-hidden="true"><use href="#lg-whatsapp"/></svg>';
  var WA = 'https://wa.me/919876543210';

  var learnLinks = [
    ['home', 'My learning', 'flow-learn.html#home', 'home'],
    ['material', 'Course material', 'flow-learn.html#material', 'book'],
    ['live', 'Live classes', 'flow-learn.html#live', 'live'],
    ['notes', 'My notes', 'flow-learn.html#notes', 'note']
  ];

  function acctMenu(open) {
    return '<div class="acct"><button class="acct-btn" aria-haspopup="menu" aria-expanded="' + (open ? 'true' : 'false') + '" data-acct><span class="av" aria-hidden="true">RM</span>Rohit' + ic('chev') + '</button>' +
      '<div class="umenu" role="menu" ' + (open ? '' : 'hidden') + '>' +
      '<div class="who"><span class="av" aria-hidden="true">RM</span><div><b>Rohit Menon</b><span>rohit.menon@example.com</span></div></div>' +
      '<a role="menuitem" href="flow-account.html#profile">' + ic('user') + 'Profile</a>' +
      '<a role="menuitem" href="flow-account.html#subscription">' + ic('card') + 'Subscription<span class="tagx">CEAP</span></a>' +
      '<a role="menuitem" href="flow-account.html#payments">' + ic('receipt') + 'Payments and receipts</a>' +
      '<a role="menuitem" href="flow-account.html#security">' + ic('shield') + 'Password and devices</a>' +
      '<div class="sep"></div>' +
      '<a role="menuitem" href="' + WA + '" target="_blank" rel="noopener noreferrer">' + ic('help') + 'Help on WhatsApp</a>' +
      '<div class="sep"></div>' +
      '<a role="menuitem" class="out" href="flow-account.html#logout">' + ic('logout') + 'Log out</a>' +
      '</div></div>';
  }
  function mnavIn(active) {
    var l = learnLinks.map(function (x) { return '<a href="' + x[2] + '"' + (x[0] === active ? ' aria-current="page"' : '') + '>' + ic(x[3]) + x[1] + '</a>' }).join('');
    return '<div class="mnav" id="mnav"><div class="who" style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)"><span class="av" aria-hidden="true">RM</span><div><b style="display:block;font-size:17px">Rohit Menon</b><span style="font-size:14px;color:var(--mute);font-weight:500">rohit.menon@example.com</span></div></div>' + l +
      '<a href="flow-account.html#profile">' + ic('user') + 'Account settings</a><a href="flow-account.html#payments">' + ic('receipt') + 'Payments and receipts</a>' +
      '<a href="' + WA + '" target="_blank" rel="noopener noreferrer">' + ic('help') + 'Help on WhatsApp</a>' +
      '<a href="flow-account.html#logout">' + ic('logout') + 'Log out</a></div>';
  }
  function mnavOut() {
    return '<div class="mnav" id="mnav"><a href="flows-index.html">Program</a><a href="flows-index.html">How we teach</a><a href="flows-index.html">Placements</a><a href="flows-index.html">Trainers</a><a href="flows-index.html">FAQ</a><a href="flow-join.html#login">Log in</a>' +
      '<a class="btn btn-line" href="' + WA + '" target="_blank" rel="noopener noreferrer">' + wa + 'WhatsApp us</a></div>';
  }
  var H = {
    out: function () {
      return '<div class="bar"><header class="hdr wrap"><nav class="nav" aria-label="Main">' + brand +
        '<div class="links"><a href="flows-index.html">Program</a><a href="flows-index.html">How we teach</a><a href="flows-index.html">Placements</a><a href="flows-index.html">Trainers</a><a href="flows-index.html">FAQ</a></div>' +
        '<div class="nav-end"><a href="flow-join.html#login">Log in</a><a class="btn btn-sm btn-line" href="' + WA + '" target="_blank" rel="noopener noreferrer">' + wa + 'WhatsApp us</a></div>' +
        '<button class="menu" aria-expanded="false" aria-controls="mnav" data-menu>Menu</button></nav>' + mnavOut() + '</header></div>';
    },
    inn: function (active, open) {
      var l = learnLinks.map(function (x) { return '<a href="' + x[2] + '"' + (x[0] === active ? ' aria-current="page"' : '') + '>' + x[1] + '</a>' }).join('');
      return '<div class="bar"><header class="hdr wrap"><nav class="nav" aria-label="Main">' + brand + '<div class="links">' + l + '</div>' +
        '<div class="nav-end">' + acctMenu(open) + '</div>' +
        '<button class="menu" aria-expanded="false" aria-controls="mnav" data-menu>Menu</button></nav>' + mnavIn(active) + '</header></div>';
    },
    focus: function (title, exitLabel, exitHref, secure) {
      return '<div class="fbar"><header class="hdr wrap"><div class="fnav">' + brand +
        (title ? '<p class="ttl">' + title + '</p>' : '') +
        (secure ? '<span class="secure">' + ic('lock') + 'Secure checkout</span>' : '<a class="exit" href="' + (exitHref || '#') + '">' + ic('x') + (exitLabel || 'Close') + '</a>') +
        '</div></header></div>';
    }
  };
  var F = {
    lite: function () {
      return '<footer class="wrap"><div class="foot-lite"><span>© 2026 CloudCadre</span><span>Need help? <a href="' + WA + '" target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a> · <a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Refunds</a></span></div></footer>';
    }
  };
  window.CC = { ic: ic, H: H, F: F, brand: brand, wa: wa, WA: WA, acctMenu: acctMenu, mnavIn: mnavIn };

  // Fake, non-scannable QR: finder squares in three corners plus seeded noise. Marked as a placeholder in the UI.
  function qr(n, seed) {
    var s = seed || 7, size = n || 29, r = function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 };
    var cells = '', c = 10, fin = function (x, y) {
      return '<rect x="' + x * c + '" y="' + y * c + '" width="' + 7 * c + '" height="' + 7 * c + '" rx="8" fill="#14201F"/><rect x="' + (x + 1) * c + '" y="' + (y + 1) * c + '" width="' + 5 * c + '" height="' + 5 * c + '" rx="5" fill="#fff"/><rect x="' + (x + 2) * c + '" y="' + (y + 2) * c + '" width="' + 3 * c + '" height="' + 3 * c + '" rx="3" fill="#14201F"/>';
    };
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var inF = (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
      if (inF) continue;
      if (r() > 0.52) cells += '<rect x="' + x * c + '" y="' + y * c + '" width="' + c + '" height="' + c + '" fill="#14201F"/>';
    }
    var w = size * c;
    return '<svg viewBox="0 0 ' + w + ' ' + w + '" role="img" aria-label="Placeholder QR code (not scannable)">' + cells + fin(0, 0) + fin(size - 7, 0) + fin(0, size - 7) + '</svg>';
  }
  window.CC.qr = qr;

  function build() {
    var cfg = window.FLOW || { title: 'Flow', screens: [] };
    var html = document.documentElement;
    if (localStorage.getItem('cc-phone') === '1') html.classList.add('phone');
    if (localStorage.getItem('cc-notes') === '1') html.classList.add('notes');

    // header / footer placeholders
    $$('[data-hdr]').forEach(function (el) {
      var k = el.getAttribute('data-hdr'), a = el.getAttribute('data-active'), t = el.getAttribute('data-title');
      var out = '';
      if (k === 'out') out = H.out();
      else if (k === 'in') out = H.inn(a, el.hasAttribute('data-open'));
      else if (k === 'focus') out = H.focus(t, el.getAttribute('data-exit'), el.getAttribute('data-href'), el.hasAttribute('data-secure'));
      el.outerHTML = out;
    });
    $$('[data-foot]').forEach(function (el) { el.outerHTML = F.lite() });
    $$('[data-qr]').forEach(function (el) { el.innerHTML = qr(29, +el.getAttribute('data-qr') || 7) });
    $$('[data-i]').forEach(function (el) { el.insertAdjacentHTML('afterbegin', ic(el.getAttribute('data-i'))) });

    // toolbar
    var tb = document.createElement('div');
    tb.className = 'tb'; tb.setAttribute('role', 'toolbar'); tb.setAttribute('aria-label', 'Preview options');
    var last = '', btns = '';
    cfg.screens.forEach(function (s) {
      if (s.group && s.group !== last) { btns += '<span class="grp">' + s.group + '</span>'; last = s.group }
      btns += '<button data-s="' + s.id + '" aria-pressed="false">' + s.label + '</button>';
    });
    tb.innerHTML = '<b>' + cfg.title + '</b><a href="flows-index.html">All flows</a><div class="seg">' + btns + '</div>' +
      '<button class="tog" id="t-phone" aria-pressed="false">Phone width</button><button class="tog" id="t-notes" aria-pressed="false">Logic notes</button>';
    document.body.insertBefore(tb, document.body.firstChild.nextSibling);
    var phoneB = $('#t-phone'), notesB = $('#t-notes');
    function sync() { phoneB.setAttribute('aria-pressed', html.classList.contains('phone')); notesB.setAttribute('aria-pressed', html.classList.contains('notes')) }
    phoneB.onclick = function () { html.classList.toggle('phone'); localStorage.setItem('cc-phone', html.classList.contains('phone') ? '1' : '0'); sync() };
    notesB.onclick = function () { html.classList.toggle('notes'); localStorage.setItem('cc-notes', html.classList.contains('notes') ? '1' : '0'); sync() };
    sync();

    function show(id) {
      var ok = cfg.screens.some(function (s) { return s.id === id });
      if (!ok) id = cfg.screens[0].id;
      $$('.screen').forEach(function (el) { el.hidden = el.id !== id });
      $$('.tb [data-s]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-s') === id) });
      var s = cfg.screens.filter(function (x) { return x.id === id })[0];
      document.title = (s ? s.label + ' · ' : '') + cfg.title + ' · CloudCadre mockup';
      window.scrollTo(0, 0);
    }
    tb.addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      history.replaceState(null, '', '#' + b.getAttribute('data-s')); show(b.getAttribute('data-s'));
    });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]'); if (!g) return;
      e.preventDefault(); var id = g.getAttribute('data-go'); history.replaceState(null, '', '#' + id); show(id);
    });
    window.addEventListener('hashchange', function () { show(location.hash.slice(1)) });
    show(location.hash.slice(1));

    // menu (phone)
    document.addEventListener('click', function (e) {
      var m = e.target.closest('[data-menu]');
      if (m) { var p = m.closest('.hdr').querySelector('.mnav'); var o = p.classList.toggle('open'); m.setAttribute('aria-expanded', o); m.textContent = o ? 'Close' : 'Menu'; return }
      var a = e.target.closest('[data-acct]');
      if (a) { var u = a.parentElement.querySelector('.umenu'); u.hidden = !u.hidden; a.setAttribute('aria-expanded', !u.hidden); return }
      var t = e.target.closest('[role="tab"]');
      if (t) { var list = t.parentElement; $$('[role="tab"]', list).forEach(function (x) { x.setAttribute('aria-selected', x === t) }); var root = t.closest('[data-tabs]') || document; $$('[data-pane]', root).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== t.getAttribute('data-tab') }); return }
      var sw = e.target.closest('.tgl'); if (sw) { sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') !== 'true'); return }
      var pr = e.target.closest('[aria-pressed]:not(.tog)');
      if (pr && !pr.closest('.tb') && pr.closest('[data-single]')) { $$('[aria-pressed]', pr.closest('[data-single]')).forEach(function (x) { x.setAttribute('aria-pressed', x === pr) }); return }
      var me = e.target.closest('.method:not(.off)');
      if (me) { $$('.method', me.parentElement).forEach(function (x) { x.setAttribute('aria-checked', x === me) }); var pane = me.getAttribute('data-show'); if (pane) $$('[data-method]').forEach(function (p) { p.hidden = p.getAttribute('data-method') !== pane }); return }
      var cp = e.target.closest('[data-copy]');
      if (cp) { var old = cp.innerHTML; cp.innerHTML = ic('check') + 'Copied'; setTimeout(function () { cp.innerHTML = old }, 1400); return }
    });
    // keyboard for tablists (arrow keys, Home, End), as in guide §7.8
    document.addEventListener('keydown', function (e) {
      var t = e.target.closest && e.target.closest('[role="tab"]'); if (!t) return;
      var tabs = $$('[role="tab"]', t.parentElement), i = tabs.indexOf(t), n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
      if (n > -1) { e.preventDefault(); tabs[n].focus(); tabs[n].click() }
    });
  }
  document.addEventListener('DOMContentLoaded', function () { build() });
})();
