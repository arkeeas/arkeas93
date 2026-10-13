/* Náhled věšáku Jelen jako SVG: pohled zepředu (po ohnutí háčků) nebo rozvin. */
(function (root) {
  'use strict';
  const COLORS = { black: '#242629', anth: '#41474e', white: '#e8e8e3', raw: '#827d74' };
  const f1 = (n) => Math.round(n * 10) / 10;
  const poly = (p) => 'M' + p.map(([x, y]) => f1(x) + ' ' + f1(-y)).join('L') + 'Z';   // y nahoru → SVG y dolů
  // Háčky: dvojice ohybových čar na jednom proužku. První (horní) ohyb vyklápí proužek k čelu, takže zepředu
  // zmizí vše pod ním – zbývá jen obrys nad prvním ohybem.
  function hookTabs(art) {
    const lines = art.bends.map(([a, b]) => ({ x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y: a[1] })), tabs = {};
    lines.forEach((l) => { const k = Math.round((l.x0 + l.x1) / 2); (tabs[k] = tabs[k] || []).push(l); });
    return Object.keys(tabs).map((k) => { const l = tabs[k].sort((p, q) => q.y - p.y); return { x0: l[0].x0, x1: l[0].x1, top: l[0].y, bottom: l[l.length - 1].y }; });
  }
  function svg(art, o) {
    const opt = o || {}, a = art || root.JelenArtwork, mode = opt.mode === 'rozvin' ? 'rozvin' : 'front', fill = COLORS[opt.finish] || COLORS.black;
    const w = a.flat[0], h = a.flat[1], pad = 30, tabs = hookTabs(a);
    const cx = 0, cy = (211.158 - 190.981) / 2;
    let mask = '', clip = '';
    if (mode === 'front') {
      clip = tabs.map((t) => '<rect x="' + f1(t.x0 - 2) + '" y="' + f1(-t.top) + '" width="' + f1(t.x1 - t.x0 + 4) + '" height="' + f1(t.top - t.bottom + 60) + '" fill="black"/>').join('');
      mask = '<mask id="jm" maskUnits="userSpaceOnUse" x="-400" y="-260" width="800" height="520"><rect x="-400" y="-260" width="800" height="520" fill="white"/>' + clip + '</mask>';
    }
    const slots = mode === 'rozvin' ? a.slots.map((s) => '<path d="' + poly(s) + '" fill="#f2f4f5"/>').join('') : '';
    const bends = mode === 'rozvin' ? a.bends.map(([p, q]) => '<path d="M' + f1(p[0]) + ' ' + f1(-p[1]) + 'L' + f1(q[0]) + ' ' + f1(-q[1]) + '" stroke="#c43a26" stroke-width="1.2"/>').join('') : '';
    const holes = a.holes.map(([x, y, r]) => '<circle cx="' + f1(x) + '" cy="' + f1(-y) + '" r="' + r + '" fill="#f2f4f5" stroke="#9aa2a8" stroke-width="0.6"/>').join('');
    const hooks = mode === 'front' ? tabs.map((t) => '<rect x="' + f1(t.x0) + '" y="' + f1(-t.top - 1) + '" width="' + f1(t.x1 - t.x0) + '" height="3" rx="1" fill="#e9b44c"/>').join('') : '';
    const vb = [f1(-w / 2 - pad), f1(-211.2 - pad), f1(w + 2 * pad), f1(h + 2 * pad + 20)].join(' ');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" role="img" aria-label="Věšák Jelen – ' + (mode === 'front' ? 'pohled zepředu' : 'rozvin') + '" preserveAspectRatio="xMidYMid meet"><defs>' + mask + '<filter id="jsh" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="3" dy="5" stdDeviation="4" flood-opacity="0.3"/></filter></defs>' +
      '<g filter="url(#jsh)"><g' + (mask ? ' mask="url(#jm)"' : '') + '><path d="' + poly(a.outline) + '" fill="' + fill + '"' + (opt.finish === 'white' ? ' stroke="#9a9a94" stroke-width="1"' : '') + '/>' + slots + '</g></g>' + holes + bends + hooks +
      '<text x="0" y="' + f1(190.981 + 28) + '" font-size="15" text-anchor="middle" fill="#697179">' + (mode === 'front' ? w + ' × ' + Math.round(h) + ' mm · žluté značky = ' + tabs.length + ' háčků vystupujících ze zdi o ' + a.hookOut + ' mm' : 'rozvin ' + w + ' × ' + h + ' mm · červeně ohyby') + '</text></svg>';
  }
  const api = { svg, hookTabs, COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JelenView = api;
})(typeof window !== 'undefined' ? window : globalThis);
