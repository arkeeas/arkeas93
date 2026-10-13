/* Náhled velkého Jelena jako SVG: pohled zepředu (háčky ohnuté ke stěně → zespodu zmizí) nebo rozvin z DXF. */
(function (root) {
  'use strict';
  const COLORS = { black: '#242629', anth: '#41474e', white: '#e8e8e3', raw: '#827d74' };
  const f1 = (n) => Math.round(n * 10) / 10;
  const poly = (p) => 'M' + p.map(([x, y]) => f1(x) + ' ' + f1(-y)).join('L') + 'Z';   // y nahoru → SVG y dolů
  function svg(art, o) {
    const opt = o || {}, a = art || root.JelenVelkyArtwork, mode = opt.mode === 'rozvin' ? 'rozvin' : 'front', fill = COLORS[opt.finish] || COLORS.black;
    const [bx0, by0, bx1, by1] = a.box, pad = 40;
    // výřezy jako díry (evenodd) v jedné cestě s obrysem
    const d = poly(a.outline) + a.holes.map(poly).join('');
    // pohled zepředu: jazyk háčku pod kořenem se vyklopí ke stěně → zakrýt ho maskou, nahoře nechat žlutou značku
    const cut = mode === 'front' ? a.tabs.map(([x0, x1, bot, top]) => '<rect x="' + f1(x0 - 2) + '" y="' + f1(-top + 1) + '" width="' + f1(x1 - x0 + 4) + '" height="' + f1(top - bot + 4) + '" fill="black"/>').join('') : '';
    const mask = cut ? '<mask id="jvm" maskUnits="userSpaceOnUse" x="' + (bx0 - pad) + '" y="' + (-by1 - pad) + '" width="' + (bx1 - bx0 + 2 * pad) + '" height="' + (by1 - by0 + 2 * pad) + '"><rect x="' + (bx0 - pad) + '" y="' + (-by1 - pad) + '" width="' + (bx1 - bx0 + 2 * pad) + '" height="' + (by1 - by0 + 2 * pad) + '" fill="white"/>' + cut + '</mask>' : '';
    const marks = mode === 'front'
      ? a.tabs.map(([x0, x1, , top]) => '<rect x="' + f1(x0) + '" y="' + f1(-top - 1) + '" width="' + f1(x1 - x0) + '" height="4" rx="1" fill="#e9b44c"/>').join('')
      : a.tabs.map(([x0, x1, bot, top]) => '<rect x="' + f1(x0) + '" y="' + f1(-top) + '" width="' + f1(x1 - x0) + '" height="' + f1(top - bot) + '" fill="none" stroke="#e9b44c" stroke-width="1.5" stroke-dasharray="4 3"/>').join('');
    const vb = [bx0 - pad, -by1 - pad, bx1 - bx0 + 2 * pad, by1 - by0 + 2 * pad + 30].map(f1).join(' ');
    const label = mode === 'front'
      ? Math.round(a.flat[0]) + ' × ' + Math.round(a.flat[1]) + ' mm · žluté značky = ' + a.tabs.length + ' háčků (jazyky ' + Math.round(a.tabs[0][1] - a.tabs[0][0]) + ' mm ohnuté ke stěně)'
      : 'rozvin z pálicího DXF ' + a.flat[0] + ' × ' + a.flat[1] + ' mm · čárkovaně jazyky háčků (ohybové čáry v DXF nejsou)';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" role="img" aria-label="Věšák Jelen velký – ' + (mode === 'front' ? 'pohled zepředu' : 'rozvin') + '" preserveAspectRatio="xMidYMid meet"><defs>' + mask +
      '<filter id="jvsh" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="4" dy="6" stdDeviation="5" flood-opacity="0.3"/></filter></defs>' +
      '<g filter="url(#jvsh)"><g' + (mask ? ' mask="url(#jvm)"' : '') + '><path d="' + d + '" fill="' + fill + '" fill-rule="evenodd"' + (opt.finish === 'white' ? ' stroke="#9a9a94" stroke-width="1.2"' : '') + '/></g></g>' + marks +
      '<text x="' + f1((bx0 + bx1) / 2) + '" y="' + f1(-by0 + 30) + '" font-size="20" text-anchor="middle" fill="#697179">' + label + '</text></svg>';
  }
  const api = { svg, COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JelenVelkyView = api;
})(typeof window !== 'undefined' ? window : globalThis);
