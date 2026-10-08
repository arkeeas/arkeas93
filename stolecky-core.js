/* Konferenční stolečky – jádro bez 3D (běží v prohlížeči i v Node).
 *
 * Model „Dva články“: podnož tvoří dva kosočtverečné články z jeklu zavěšené do sebe jako články řetězu
 * (jeden leží v rovině XZ, druhý v rovině YZ), dole plotna, nahoře kulatá deska.
 *
 * Každý článek = 4 stejné jekly spojené na pokos. Na rozích drží díly pohromadě zámečky pro Bodor K2:
 * jeden jekl má na konci čep (prodloužená přední i zadní stěna), sousední má na stejném místě výřez.
 * Čep zapadne do výřezu, díly se samy zarovnají a jen se svaří. Osy souřadnic: Z nahoru, mm.
 */
(function (root) {
  'use strict';

  const PROFILES = [
    { id: '20x40x2', hp: 20, hd: 40, wall: 2 }, { id: '20x40x3', hp: 20, hd: 40, wall: 3 },
    { id: '40x20x2', hp: 40, hd: 20, wall: 2 }, { id: '40x30x2', hp: 40, hd: 30, wall: 2 },
    { id: '20x20x2', hp: 20, hd: 20, wall: 2 }, { id: '30x30x2', hp: 30, hd: 30, wall: 2 },
    { id: '40x40x2', hp: 40, hd: 40, wall: 2 }
  ];
  const DEFAULT_CFG = {
    H: 450, topD: 700, topT: 30, baseW: 300, baseT: 10,
    prof: '20x40x2', gamma: 40, overlap: 0.6, clear: 0.15, tabMargin: 3
  };
  const kgm = (p) => (2 * (p.hp + p.hd) * p.wall - 4 * p.wall * p.wall) * 0.00785;
  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;

  /* ---------- 2D / 3D pomůcky ---------- */
  const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]);
  const mul = (a, k) => a.map((v) => v * k), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const len = (a) => Math.hypot(...a), norm = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /* průsečík dvou přímek (bod + směr) v rovině */
  function isect(p, d, q, e) {
    const den = d[0] * e[1] - d[1] * e[0];
    const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  }
  function inConvex(poly, p, margin, skip) {
    const sg = orient(poly) > 0 ? 1 : -1;
    for (let i = 0; i < poly.length; i++) {
      if (i === skip) continue;
      const a = poly[i], b = poly[(i + 1) % poly.length], e = sub(b, a);
      if (sg * (e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0])) / len(e) < margin) return false;
    }
    return true;
  }
  function orient(poly) { let s = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; }); return s; }

  function normalize(c) {
    const o = Object.assign({}, DEFAULT_CFG, c || {});
    const num = (k, lo, hi) => { o[k] = Math.min(hi, Math.max(lo, Number(o[k]) || DEFAULT_CFG[k])); };
    num('H', 300, 700); num('topD', 400, 1200); num('topT', 10, 60); num('baseW', 150, 600); num('baseT', 3, 25);
    num('gamma', 25, 60); num('overlap', 0.1, 0.8); num('clear', 0, 0.5); num('tabMargin', 1, 8);
    if (!PROFILES.some((p) => p.id === o.prof)) o.prof = DEFAULT_CFG.prof;
    return o;
  }

  /* ---------- článek (kosočtverec) v rovině ---------- */
  function link(cfg) {
    const P = PROFILES.find((p) => p.id === cfg.prof), g = rad(cfg.gamma);
    const hp = P.hp, hd = P.hd;
    const Hs = cfg.H - cfg.topT - cfg.baseT;                        // výška, kterou zabere sloupek
    const bo = Hs / (4 - 2 * cfg.overlap);                          // polovina vnější výšky článku
    const ext = (hp / 2) / Math.sin(g);                             // špička vnějšku nad osou rohu
    const b = bo - ext, a = b * Math.tan(g);
    const V = [[0, b], [a, 0], [0, -b], [-a, 0]];                   // osy rohů: nahoře, vpravo, dole, vlevo (po směru hodin)
    const dir = V.map((v, i) => norm(sub(V[(i + 1) % 4], v)));
    const out = dir.map((d) => [-d[1], d[0]]);                      // vlevo od směru jízdy po směru hodin = ven
    const oLine = (i, s) => add(V[i], mul(out[i], s));
    const O = [], I = [];
    for (let i = 0; i < 4; i++) {                                   // roh i = mezi jeklem i-1 a i
      const pr = (i + 3) % 4;
      O.push(isect(oLine(i, hp / 2), dir[i], oLine(pr, hp / 2), dir[pr]));
      I.push(isect(oLine(i, -hp / 2), dir[i], oLine(pr, -hp / 2), dir[pr]));
    }
    const quads = [];                                               // jekl i: od rohu i do rohu i+1
    for (let i = 0; i < 4; i++) quads.push([O[i], O[(i + 1) % 4], I[(i + 1) % 4], I[i]]);
    const cl = len(sub(V[1], V[0]));
    const angTop = 2 * g, angSide = Math.PI - 2 * g;                // vnitřní úhly rohů
    return {
      hp, hd, wall: P.wall, a, b, bo, g, V, O, I, dir, quads, cl, angTop, angSide,
      lo: len(sub(O[1], O[0])), li: len(sub(I[1], I[0])),
      oh: Math.max(...O.map((p) => p[1])), ow: Math.max(...O.map((p) => p[0]))
    };
  }

  /* ---------- čepy a výřezy (zámečky) ---------- */
  function locks(L, cfg) {
    const res = [], wt = L.hp - 2 * cfg.tabMargin;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, d = L.dir[j], nn = [d[1], -d[0]];       // čep jeklu i je pruh podél osy sousedního jeklu j
      const mDir = norm(sub(L.O[j], L.I[j]));
      const base = [wt / 2, -wt / 2].map((s) => isect(add(L.V[j], mul(nn, s)), d, L.I[j], mDir));
      let lt = 0;
      for (let s = 0.5; s <= 60; s += 0.5) {
        if ([base[0], base[1]].every((p) => inConvex(L.quads[j], add(p, mul(d, s)), cfg.tabMargin - 0.01, 3))) lt = s; else break;
      }
      const len = Math.min(14, lt);
      const tab = [base[0], add(base[0], mul(d, len)), add(base[1], mul(d, len)), base[1]];
      res.push({ bar: i, to: j, tab, wt, lt: len, ok: len >= 4 });
    }
    return res;
  }

  /* plochý tvar přední (a zadní) stěny jeklu i: s podél osy (0 = osa rohu i), t napříč.
   * body = obrys stěny na pokos, tab = čep na konci, notch = výřez na začátku (čep předchozího jeklu + vůle),
   * contour = jeden uzavřený obrys k vyřezání (stěna s čepem i výřezem) */
  function barFlat(L, lk, cfg, i) {
    const d = L.dir[i], nn = [d[1], -d[0]], o = L.V[i], c = cfg.clear;
    const to2 = (p) => { const q = sub(p, o); return [dot(q, d), dot(q, nn)]; };
    const body = L.quads[i].map(to2);
    const tab = lk[i].tab.map(to2);                                 // [základna 0, špička 0, špička 1, základna 1]
    const tp = lk[(i + 3) % 4].tab.map(to2);                        // čep předchozího jeklu v mých souřadnicích
    const e = norm(sub(tp[1], tp[0]));
    let np = [-e[1], e[0]]; if (dot(np, sub(tp[3], tp[0])) < 0) np = mul(np, -1);
    const md = norm(sub(body[0], body[3]));
    const nb0 = isect(add(tp[0], mul(np, -c)), e, body[3], md), nb1 = isect(add(tp[3], mul(np, c)), e, body[3], md);
    const nt0 = add(add(tp[1], mul(np, -c)), mul(e, c)), nt1 = add(add(tp[2], mul(np, c)), mul(e, c));
    const notch = [nb0, nt0, nt1, nb1];
    const near = (from, pairs) => pairs.slice().sort((p, q) => len(sub(p[0], from)) - len(sub(q[0], from)));
    const tabPath = near(body[1], [[tab[0], tab[1]], [tab[3], tab[2]]]);
    const pocket = near(body[3], [[nb0, nt0], [nb1, nt1]]);
    const contour = [body[0], body[1], tabPath[0][0], tabPath[0][1], tabPath[1][1], tabPath[1][0], body[2], body[3],
      pocket[0][0], pocket[0][1], pocket[1][1], pocket[1][0]].map((p) => [r2(p[0]), r2(p[1])]);
    const rr = (poly) => poly.map((p) => [r2(p[0]), r2(p[1])]);
    return { body: rr(body), tab: rr(tab), notch: rr(notch), contour };
  }

  /* DXF (R12, mm) – obrys stěny k vyřezání; stejný pro přední i zadní stěnu */
  function dxf(contour) {
    const out = ['0', 'SECTION', '2', 'ENTITIES'];
    contour.forEach((p, i) => {
      const q = contour[(i + 1) % contour.length];
      out.push('0', 'LINE', '8', 'VYREZ', '10', p[0], '20', p[1], '30', 0, '11', q[0], '21', q[1], '31', 0);
    });
    out.push('0', 'ENDSEC', '0', 'EOF');
    return out.join('\n') + '\n';
  }
  const area = (poly) => Math.abs(orient(poly)) / 2;

  /* ---------- 3D tělesa pro kontrolu zaklesnutí ---------- */
  function prism(poly2, hd, plane) {                                // plane 'xz' (y = ±hd/2) nebo 'yz' (x = ±hd/2)
    const v = [];
    [-hd / 2, hd / 2].forEach((s) => poly2.forEach((p) => v.push(plane === 'xz' ? [p[0], s, p[1]] : [s, p[0], p[1]])));
    const nq = poly2.length;
    return { v, nq, plane };
  }
  function axes(P) {
    const ax = [], u = P.plane === 'xz' ? [0, 1, 0] : [1, 0, 0];
    ax.push(u);
    for (let i = 0; i < P.nq; i++) ax.push(norm(cross(u, sub(P.v[(i + 1) % P.nq], P.v[i]))));
    return ax;
  }
  function edges(P) {
    const e = [P.plane === 'xz' ? [0, 1, 0] : [1, 0, 0]];
    for (let i = 0; i < P.nq; i++) e.push(norm(sub(P.v[(i + 1) % P.nq], P.v[i])));
    return e;
  }
  /* nejlepší oddělující vzdálenost dvou konvexních těles (záporná = zasahují do sebe) */
  function gap(A, B) {
    const cand = axes(A).concat(axes(B));
    edges(A).forEach((a) => edges(B).forEach((b) => { const c = cross(a, b); if (len(c) > 1e-6) cand.push(norm(c)); }));
    let best = -Infinity;
    cand.forEach((n) => {
      const pa = A.v.map((p) => dot(p, n)), pb = B.v.map((p) => dot(p, n));
      const g = Math.max(Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
      if (g > best) best = g;
    });
    return best;
  }

  /* uspořádání po výšce (mm od podlahy) */
  function layout(c) {
    const cfg = normalize(c), L = link(cfg);
    const zB = cfg.baseT + L.oh;                                    // střed dolního článku (v rovině YZ)
    const zA = zB + 2 * L.oh * (1 - cfg.overlap);                   // střed horního článku (v rovině XZ)
    return { cfg, L, zA, zB, ov: 2 * L.oh * cfg.overlap, top: cfg.H - cfg.topT };
  }
  function interlock(c) {
    const { L, zA, zB } = layout(c);
    const shift = (q, z) => q.map((p) => [p[0], p[1] + z]);
    const A = L.quads.map((q) => prism(shift(q, zA), L.hd, 'xz'));
    const B = L.quads.map((q) => prism(shift(q, zB), L.hd, 'yz'));
    let min = Infinity;
    A.forEach((a) => B.forEach((b) => { min = Math.min(min, gap(a, b)); }));
    return min;
  }
  /* nejlepší překryv článků: největší vůle mezi články */
  function bestOverlap(c) {
    let best = null;
    for (let k = 0.1; k <= 0.8 + 1e-9; k += 0.01) {
      const g = interlock(Object.assign({}, c, { overlap: k }));
      if (!best || g > best.gap) best = { overlap: r2(k), gap: g };
    }
    return best;
  }

  /* ---------- vše pro dílnu ---------- */
  function build(c) {
    const Y = layout(c), { cfg, L } = Y;
    const lk = locks(L, cfg);
    const kg = kgm(PROFILES.find((p) => p.id === cfg.prof)) * L.cl * 8 / 1000;
    const miterTop = deg(L.angTop / 2), miterSide = deg(L.angSide / 2);   // úhel řezu proti ose jeklu
    const gp = interlock(cfg);
    const warn = [];
    if (gp < 1) warn.push(gp < 0 ? 'Články do sebe narážejí (překrytí ' + r1(-gp) + ' mm). Zvětši překryv nebo úhel, nebo zvol užší jekl.' : 'Mezi články je vůle jen ' + r1(gp) + ' mm – po zinkování nebo svařování se nemusí otáčet.');
    if (lk.some((x) => !x.ok)) warn.push('V některém rohu je čep kratší než 4 mm – zámeček nedrží. Zvolte širší jekl nebo menší úhel.');
    if (L.ow * 2 > cfg.baseW - 20) warn.push('Plotna ' + cfg.baseW + ' mm je užší než podnož (' + r1(L.ow * 2) + ' mm) – zvětši ji.');
    const stackTop = Y.zA + L.oh;
    if (Math.abs(stackTop - Y.top) > 0.5) warn.push('Výška sloupku nesedí (' + r1(stackTop) + ' ≠ ' + r1(Y.top) + ').');
    return {
      cfg, L, zA: Y.zA, zB: Y.zB, ov: Y.ov, lk, gap: gp, warn, kg,
      flats: [0, 1, 2, 3].map((i) => barFlat(L, lk, cfg, i)),
      miterTop, miterSide,
      cut: {
        pieces: [
          { type: 'A', qty: 4, note: 'čep na straně rohu, výřez u špičky' },
          { type: 'B', qty: 4, note: 'čep u špičky, výřez na straně rohu' }
        ],
        lo: r1(L.lo), li: r1(L.li), cl: r1(L.cl)
      }
    };
  }

  const API = { PROFILES, DEFAULT_CFG, kgm, dxf, area, normalize, link, locks, barFlat, layout, interlock, bestOverlap, build, orient, rad, deg, r1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Stolecky = API;
})(typeof window !== 'undefined' ? window : globalThis);
