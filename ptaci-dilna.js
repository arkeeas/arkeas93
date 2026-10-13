/* Dílna: zobrazení poptávek ptačích věšáků (bez generování výrobních souborů – ty vzniknou z nastroje/ptaci). */
(function (root) {
  'use strict';
  let item = null, options = {};
  const files = [
    ['Vzlet – rozvin DXF (laser)', 'assets/ptaci/ptak_vzlet_rozvin.dxf'], ['Vzlet – model STEP', 'assets/ptaci/ptak_vzlet.step'],
    ['Mávnutí – rozvin DXF (laser)', 'assets/ptaci/ptak_mavnuti_rozvin.dxf'], ['Mávnutí – model STEP', 'assets/ptaci/ptak_mavnuti.step'],
    ['Plachtění – rozvin DXF (laser)', 'assets/ptaci/ptak_plachteni_rozvin.dxf'], ['Plachtění – model STEP', 'assets/ptaci/ptak_plachteni.step'],
    ['Klouzání – rozvin DXF (laser)', 'assets/ptaci/ptak_klouzani_rozvin.dxf'], ['Klouzání – model STEP', 'assets/ptaci/ptak_klouzani.step'],
    ['Souhrn kontroly FreeCAD (souhrn.json)', 'assets/ptaci/souhrn.json'],
    ['Generátor tvarů (ptaci.py)', 'nastroje/ptaci/ptaci.py'],
    ['FreeCAD: rozvin DXF + STEP (ptaci_fc.py)', 'nastroje/ptaci/ptaci_fc.py'],
    ['Společné funkce (vesak_lib.py)', 'nastroje/ptaci/vesak_lib.py'],
    ['Obrysy a parametry (ptaci.json)', 'nastroje/ptaci/ptaci.json']
  ];
  const jelenFiles = [['Jelen – rozvin DXF (laser)', 'assets/jelen/jelen_rozvin.dxf'], ['Jelen – model STEP', 'assets/jelen/jelen.step'], ['Souhrn kontroly FreeCAD (souhrn.json)', 'assets/jelen/souhrn.json']];
  const jelenVelkyFiles = [['Jelen velký – pálicí DXF (laser, jen obrys a výřezy)', 'assets/jelen-velky/jelen_velky_1200_paleni.dxf'], ['Souhrn z DXF (souhrn.json)', 'assets/jelen-velky/souhrn.json'], ['Výpočet souhrnu (jelen_velky.py)', 'nastroje/jelen_velky.py']];
  const nf = (n) => new Intl.NumberFormat('cs-CZ').format(n);
  function escape(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function accepts(value) { return !!value && (value.product === 'ptak' || value.product === 'jelen' || value.product === 'jelenvelky'); }
  function jel() { return root.Jelen || (typeof require === 'function' ? require('./jelen-core.js') : null); }
  function jelv() { return root.JelenVelky || (typeof require === 'function' ? require('./jelen-velky-core.js') : null); }
  function core() { return root.Ptaci || (typeof require === 'function' ? require('./ptaci-core.js') : null); }
  function P0() { return core(); }
  function describe(config, product) { if (product === 'jelenvelky') { const J = jelv(); return J ? J.describe(config) : 'Věšák Jelen velký'; } if (product === 'jelen') { const J = jel(); return J ? J.describe(config) : 'Věšák Jelen'; } const P = core(); return P ? P.describe(config) : 'Ptačí věšák'; }
  const dec = (n) => String(n).replace('.', ',');
  function production(config, product) {
    if (product === 'jelenvelky') { const J = jelv(), S = J.SPEC, c = J.normalize(config); return 'Rozvin ' + dec(S.flat[0]) + ' × ' + dec(S.flat[1]) + ' mm · plech S235 ' + S.t + ' mm (předpoklad, v DXF není) · ' + dec(S.kg) + ' kg · délka řezu ' + S.cutMm + ' mm · ' + S.pierces + ' průstřelů · ' + S.hooks + ' háčků z jazyků ' + S.hookWidth + ' mm, navrženo ' + S.bends + ' ohybů 90° – OHYBOVÉ ČÁRY A OTVORY NA UCHYCENÍ V DXF CHYBÍ, doplnit před pálením · pálení C2 × ' + c.qty + ' ks'; }
    if (product === 'jelen') { const J = jel(), S = J.SPEC, c = J.normalize(config); return 'Rozvin ' + dec(S.flat[0]) + ' × ' + dec(S.flat[1]) + ' mm · plech S235 ' + S.t + ' mm · ' + dec(S.kg) + ' kg · délka řezu ' + S.cutMm + ' mm · ' + S.hooks + ' háčků = ' + S.bends + ' ohybů 90° (vnitřní R3, K = 0,33) · 3 otvory Ø5,5 se zahloubením Ø11 · pálení C2 × ' + c.qty + ' ks'; }
    const P = core(); if (!P) return '';
    if (config && config.layout) {
      const n = P.normalizeLayout(config.layout);
      const byPose = {}; P.groupPieces(n).forEach((g) => { byPose[g.pose] = (byPose[g.pose] || 0) + g.qty; });
      return Object.keys(byPose).map((k) => ({ pose: k, qty: byPose[k] })).map((g) => { const s = P.POSES[g.pose]; return g.qty + '× ' + s.label.split(' – ')[0] + ': rozvin ' + dec(s.flat[0]) + ' × ' + dec(s.flat[1]) + ' mm, ' + dec(s.kg) + ' kg, řez ' + s.cutMm + ' mm'; }).join(' · ') + ' · plech S235 ' + P.SIZE.t + ' mm · 2 ohyby 90° na kus · pálení C2 · celkem ' + n.pieces.length + ' ks';
    }
    const c = P.normalize(config), s = P.POSES[c.pose];
    return 'Rozvin ' + dec(s.flat[0]) + ' × ' + dec(s.flat[1]) + ' mm · plech S235 ' + P.SIZE.t + ' mm · ' + dec(s.kg) + ' kg · délka řezu ' + s.cutMm + ' mm · 2 ohyby 90° · pálení C2 × ' + c.qty + ' ks';
  }
  // Rozmístění pro montáž: souřadnice kotvícího bodu (horní střed jazýčku) od levého a spodního okraje stěny.
  function placement(config) {
    const P = core(); if (!P || !config || !config.layout) return [];
    const n = P.normalizeLayout(config.layout);
    return n.pieces.map((p, i) => ({ no: i + 1, label: P.POSES[p.pose].label.split(' – ')[0], finish: P.FINISH_LABELS[p.finish], x: p.x, y: p.y }));
  }
  function referenceFiles(product) { if (product === 'jelenvelky') return jelenVelkyFiles.map((f) => ({ label: f[0], path: f[1] })); if (product === 'jelen') return jelenFiles.map((f) => ({ label: f[0], path: f[1] })); return files.map((f) => ({ label: f[0], path: f[1] })); }
  function render() {
    if (!options.document || !item) return;
    const doc = options.document, get = (id) => doc.getElementById(id), c = item.customer || {}, config = item.config || {};
    const order = get('paOrder'), detail = get('paDetail'), refs = get('paRefs');
    if (order) order.innerHTML = '<strong>' + escape(item.id) + '</strong> · ' + escape(item.created || '');
    const b = item.priceBreakdown || {};
    const hasEstimate = item.priceEstimate && [item.total, item.price, item.vat].every((v) => v != null && Number.isFinite(Number(v)));
    if (detail) detail.innerHTML = '<dl class="za-dl"><dt>Konfigurace</dt><dd>' + escape(describe(config, item.product)) + '</dd><dt>Výroba</dt><dd>' + escape(production(config, item.product)) + '</dd>' +
      (hasEstimate ? '<dt>Orientační cena</dt><dd>' + escape(nf(item.total)) + ' Kč s DPH celkem (' + (config.layout ? escape(nf(item.price)) + ' Kč bez DPH celkem; příprava rozpočtená na všechny kusy' : escape(nf(item.vat)) + ' Kč s DPH / ks; ' + escape(nf(item.price)) + ' Kč bez DPH / ks') + ')</dd><dt>Cenový podklad</dt><dd>' + escape(b.kg == null ? '—' : dec(b.kg)) + ' kg · ' + escape(b.cuts || '—') + ' průstřelů · ' + escape(b.bends || '—') + ' ohybů · plocha ' + escape(Number(b.surfaceM2 || 0).toFixed(3)) + ' m²</dd>' : '') +
      (config.layout ? '<dt>Rozmístění</dt><dd>Stěna ' + escape(P0().normalizeLayout(config.layout).wall.w) + ' × ' + escape(P0().normalizeLayout(config.layout).wall.h) + ' mm. Souřadnice kotvícího bodu (horní střed jazýčku) od levého / spodního okraje stěny:<ol class="za-place">' + placement(config).map((p) => '<li>' + escape(p.label) + ', ' + escape(p.finish) + ' – ' + escape(p.x) + ' / ' + escape(p.y) + ' mm</li>').join('') + '</ol></dd>' : '') +
      '<dt>Zákazník</dt><dd>' + escape(c.name || '') + '</dd><dt>E-mail</dt><dd><a href="mailto:' + escape(c.email || '') + '">' + escape(c.email || '') + '</a></dd><dt>Telefon</dt><dd>' + escape(c.phone || '—') + '</dd><dt>Poznámka</dt><dd>' + escape(item.note || '—') + '</dd></dl>' +
      '<div class="za-notice">Cena je orientační: sazba za ohyb (30 Kč) zatím není v ceníku a jde o odhad. K-faktor a vnitřní poloměr ohybu ověřit na ohraňovačce zkušebním kusem. Souřadnice z rozložení jsou návrh zákazníka – před výrobou ověřit na místě.</div>';
    if (refs) refs.innerHTML = referenceFiles(item.product).map((f) => '<li><a href="' + escape(f.path) + '" download>' + escape(f.label) + '</a></li>').join('');
  }
  function init(opts) { options = opts || {}; if (!options.document && typeof document !== 'undefined') options.document = document; render(); }
  function open(value) { item = value || null; render(); }
  const api = { init, open, render, describe, production, placement, accepts, escape, referenceFiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PtaDilna = api;
})(typeof window !== 'undefined' ? window : globalThis);
