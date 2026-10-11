/* Workshop display for butterfly screen inquiries; no pricing or production generation. */
(function (root) {
  'use strict';
  let item = null, options = {};
  const files = [
    ['FreeCAD sestava', 'assets/zasteny/motyli_800x2000/zastena_motyli_800x2000.FCStd'],
    ['STEP sestava', 'assets/zasteny/motyli_800x2000/zastena_motyli_800x2000.step'],
    ['DXF výplň', 'assets/zasteny/motyli_800x2000/vypln_720x1770_t2_C2.dxf'],
    ['DXF patka', 'assets/zasteny/motyli_800x2000/patka_40x100_t6_2xD14.dxf'],
    ['Kusovník CSV', 'assets/zasteny/motyli_800x2000/kusovnik.csv']
  ];
  function escape(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function accepts(value) { return !!value && value.product === 'zastena'; }
  function describe(config) {
    const Z = root.Zasteny || (typeof require === 'function' ? require('./zasteny-core.js') : null);
    return Z ? Z.describe(config) : 'Zástěna Motýli';
  }
  function manualReviewNotice(config) {
    const c = config || {};
    return 'Referenční podklady jsou pouze pro 800 × 2000 mm. Požadovaný rozměr ' + escape(c.width || '—') + ' × ' + escape(c.height || '—') + ' mm musí dílna ručně posoudit; cena a proveditelnost nejsou potvrzené.';
  }
  function referenceFiles() { return files.map((f) => ({ label: f[0] + ' · reference 800 × 2000 mm', path: f[1] })); }
  function render() {
    if (!options.document || !item) return;
    const doc = options.document, get = (id) => doc.getElementById(id), c = item.customer || {}, config = item.config || {};
    const order = get('zaOrder'), detail = get('zaDetail'), refs = get('zaRefs');
    if (order) order.innerHTML = '<strong>' + escape(item.id) + '</strong> · ' + escape(item.created || '');
    if (detail) detail.innerHTML = '<dl class="za-dl"><dt>Konfigurace</dt><dd>' + escape(describe(config)) + '</dd><dt>Zákazník</dt><dd>' + escape(c.name || '') + '</dd><dt>E-mail</dt><dd><a href="mailto:' + escape(c.email || '') + '">' + escape(c.email || '') + '</a></dd><dt>Telefon</dt><dd>' + escape(c.phone || '—') + '</dd><dt>Poznámka</dt><dd>' + escape(item.note || '—') + '</dd></dl><div class="za-notice">' + manualReviewNotice(config) + '</div>';
    if (refs) refs.innerHTML = referenceFiles().map((f) => '<li><a href="' + escape(f.path) + '" download>' + escape(f.label) + '</a></li>').join('');
  }
  function init(opts) { options = opts || {}; if (!options.document && typeof document !== 'undefined') options.document = document; render(); }
  function open(value) { item = value || null; render(); }
  const api = { init, open, render, describe, accepts, escape, manualReviewNotice, referenceFiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZasDilna = api;
})(typeof window !== 'undefined' ? window : globalThis);
