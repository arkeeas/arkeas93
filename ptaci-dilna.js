/* Dílna: zobrazení poptávek ptačích věšáků (bez generování výrobních souborů – ty vzniknou z nastroje/ptaci). */
(function (root) {
  'use strict';
  let item = null, options = {};
  const files = [
    ['Generátor tvarů (ptaci.py)', 'nastroje/ptaci/ptaci.py'],
    ['FreeCAD: rozvin DXF + STEP (ptaci_fc.py)', 'nastroje/ptaci/ptaci_fc.py'],
    ['Společné funkce (vesak_lib.py)', 'nastroje/ptaci/vesak_lib.py'],
    ['Obrysy a parametry (ptaci.json)', 'nastroje/ptaci/ptaci.json']
  ];
  const nf = (n) => new Intl.NumberFormat('cs-CZ').format(n);
  function escape(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function accepts(value) { return !!value && value.product === 'ptak'; }
  function core() { return root.Ptaci || (typeof require === 'function' ? require('./ptaci-core.js') : null); }
  function describe(config) { const P = core(); return P ? P.describe(config) : 'Ptačí věšák'; }
  function production(config) {
    const P = core(); if (!P) return '';
    const c = P.normalize(config), s = P.POSES[c.pose];
    return 'Rozvin ' + s.flat[0] + ' × ' + s.flat[1] + ' mm · plech S235 ' + P.SIZE.t + ' mm · ' + String(s.kg).replace('.', ',') + ' kg · délka řezu ' + s.cutMm + ' mm · 2 ohyby 90° · pálení C2 × ' + c.qty + ' ks';
  }
  function referenceFiles() { return files.map((f) => ({ label: f[0], path: f[1] })); }
  function render() {
    if (!options.document || !item) return;
    const doc = options.document, get = (id) => doc.getElementById(id), c = item.customer || {}, config = item.config || {};
    const order = get('paOrder'), detail = get('paDetail'), refs = get('paRefs');
    if (order) order.innerHTML = '<strong>' + escape(item.id) + '</strong> · ' + escape(item.created || '');
    const b = item.priceBreakdown || {};
    const hasEstimate = item.priceEstimate && [item.total, item.price, item.vat].every((v) => v != null && Number.isFinite(Number(v)));
    if (detail) detail.innerHTML = '<dl class="za-dl"><dt>Konfigurace</dt><dd>' + escape(describe(config)) + '</dd><dt>Výroba</dt><dd>' + escape(production(config)) + '</dd>' +
      (hasEstimate ? '<dt>Orientační cena</dt><dd>' + escape(nf(item.total)) + ' Kč s DPH celkem (' + escape(nf(item.vat)) + ' Kč s DPH / ks; ' + escape(nf(item.price)) + ' Kč bez DPH / ks)</dd><dt>Cenový podklad</dt><dd>' + escape(b.kg || '—') + ' kg · ' + escape(b.cuts || '—') + ' průstřelů · ' + escape(b.bends || '—') + ' ohyby · plocha ' + escape(Number(b.surfaceM2 || 0).toFixed(3)) + ' m²</dd>' : '') +
      '<dt>Zákazník</dt><dd>' + escape(c.name || '') + '</dd><dt>E-mail</dt><dd><a href="mailto:' + escape(c.email || '') + '">' + escape(c.email || '') + '</a></dd><dt>Telefon</dt><dd>' + escape(c.phone || '—') + '</dd><dt>Poznámka</dt><dd>' + escape(item.note || '—') + '</dd></dl>' +
      '<div class="za-notice">Cena je orientační: sazba za ohyb (30 Kč) zatím není v ceníku a jde o odhad. K-faktor a vnitřní poloměr ohybu ověřit na ohraňovačce zkušebním kusem.</div>';
    if (refs) refs.innerHTML = referenceFiles().map((f) => '<li><a href="' + escape(f.path) + '" download>' + escape(f.label) + '</a></li>').join('');
  }
  function init(opts) { options = opts || {}; if (!options.document && typeof document !== 'undefined') options.document = document; render(); }
  function open(value) { item = value || null; render(); }
  const api = { init, open, render, describe, production, accepts, escape, referenceFiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PtaDilna = api;
})(typeof window !== 'undefined' ? window : globalThis);
