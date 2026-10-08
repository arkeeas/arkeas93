/* Konferenční stolečky – jádro bez 3D (běží v prohlížeči i v Node).
 *
 * Model „Dva články“: dva kosočtverečné články z jeklu zavěšené do sebe jako články řetězu
 * (dolní leží v rovině YZ, horní v rovině XZ). Dolní článek má pod sebou DVĚ NOHY na plotně, horní DVĚ NOHY pod deskou:
 * dvě strany kosočtverce jsou prodloužené za špičku, v ní se zkříží (zámek do půl hloubky jeklu) a rozběhnou do dvou noh.
 *
 * Články jsou stejné (horní = dolní otočený o 180° v rovině). Každý má 4 jekly: 2 krátké (strany nahoře) a 2 dlouhé (s nohou).
 * Na rozích drží díly zámečky pro Bodor K2: čep ve stěně jeklu zapadne do výřezu souseda. Ve zkřížení má jeden jekl
 * zářez v přední stěně a druhý v zadní (do půl hloubky) – prostrčí se přes sebe. Osy: Z nahoru, mm.
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
    prof: '20x40x2', gamma: 40, overlap: 0.6, foot: 60, clear: 0.15, tabMargin: 3
  };
  const kgm = (p) => (2 * (p.hp + p.hd) * p.wall - 4 * p.wall * p.wall) * 0.00785;
  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;

  const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]);
  const mul = (a, k) => a.map((v) => v * k), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const len = (a) => Math.hypot(...a), norm = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  function isect(p, d, q, e) {                                      // průsečík dvou přímek (bod + směr)
    const den = d[0] * e[1] - d[1] * e[0];
    const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  }
  function orient(poly) { let s = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; }); return s; }
  const area = (poly) => Math.abs(orient(poly)) / 2;
  function inConvex(poly, p, margin, skip) {
    const sg = orient(poly) > 0 ? 1 : -1;
    for (let i = 0; i < poly.length; i++) {
      if (i === skip) continue;
      const a = poly[i], b = poly[(i + 1) % poly.length], e = sub(b, a);
      if (sg * (e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0])) / len(e) < margin) return false;
    }
    return true;
  }
  /* ořez mnohoúhelníku polorovinou (Sutherland–Hodgman); zůstává strana, kam míří n */
  function clipHalf(poly, q, n) {
    const out = [], inside = (p) => dot(sub(p, q), n) >= -1e-9;
    poly.forEach((p, i) => {
      const s = poly[(i + poly.length - 1) % poly.length], pi = inside(p), si = inside(s);
      if (pi !== si) { const t = dot(sub(q, s), n) / dot(sub(p, s), n); out.push([s[0] + (p[0] - s[0]) * t, s[1] + (p[1] - s[1]) * t]); }
      if (pi) out.push(p);
    });
    return out;
  }
  function clipConvex(subject, win) {                               // průnik s konvexním mnohoúhelníkem
    const sg = orient(win) > 0 ? 1 : -1;
    let res = subject;
    win.forEach((a, i) => {
      if (!res.length) return;
      const b = win[(i + 1) % win.length], e = sub(b, a);
      res = clipHalf(res, a, norm([-e[1] * sg, e[0] * sg]));
    });
    return res;
  }

  function normalize(c) {
    const o = Object.assign({}, DEFAULT_CFG, c || {});
    const num = (k, lo, hi) => { const v = Number(o[k]); o[k] = Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : DEFAULT_CFG[k])); };
    num('H', 300, 700); num('topD', 400, 1200); num('topT', 10, 60); num('baseW', 150, 600); num('baseT', 3, 25);
    num('gamma', 25, 60); num('overlap', 0.1, 0.8); num('foot', 20, 200); num('clear', 0, 0.5); num('tabMargin', 1, 8);
    if (!PROFILES.some((p) => p.id === o.prof)) o.prof = DEFAULT_CFG.prof;
    return o;
  }

  /* ---------- dolní článek (nohy dolů) v rovině, střed v 0,0; horní je jeho otočení o 180° ---------- */
  function link(cfg) {
    const P = PROFILES.find((p) => p.id === cfg.prof), g = rad(cfg.gamma), tg = Math.tan(g);
    const hp = P.hp, hd = P.hd, hl = cfg.foot / tg;                  // hl = svislá délka nohy pod špičkou
    const Hs = cfg.H - cfg.topT - cfg.baseT;
    const bRaw = (Hs - 2 * hl) / (4 - 2 * cfg.overlap), b = Math.max(bRaw, 20), a = b * tg;
    const V = [[0, b], [a, 0], [0, -b], [-a, 0]];                    // rohy po směru hodin: nahoře, vpravo, dole (zkřížení), vlevo
    const dir = V.map((v, i) => norm(sub(V[(i + 1) % 4], v)));
    const out = dir.map((d) => [-d[1], d[0]]);                       // ven
    const off = (i, s) => add(V[i], mul(out[i], s));
    const O = [], I = [];
    for (let i = 0; i < 4; i++) {
      const pr = (i + 3) % 4;
      O.push(isect(off(i, hp / 2), dir[i], off(pr, hp / 2), dir[pr]));
      I.push(isect(off(i, -hp / 2), dir[i], off(pr, -hp / 2), dir[pr]));
    }
    const zf = -(b + hl);                                            // výška špiček noh (vodorovný řez)
    const hit = (p, d) => { const t = (zf - p[1]) / d[1]; return [p[0] + d[0] * t, zf]; };
    const E1o = hit(off(1, hp / 2), dir[1]), E1i = hit(off(1, -hp / 2), dir[1]);
    const E2o = hit(off(2, hp / 2), dir[2]), E2i = hit(off(2, -hp / 2), dir[2]);
    /* obrys každého jeklu: [začátek venku, konec venku, konec uvnitř, začátek uvnitř] */
    const polys = [[O[0], O[1], I[1], I[0]], [O[1], E1o, E1i, I[1]], [E2o, O[3], I[3], E2i], [O[3], O[0], I[0], I[3]]];
    const cross12 = clipConvex(polys[1], polys[2]);                  // místo zkřížení nohou
    return {
      hp, hd, wall: P.wall, a, b, g, hl, zf, bOk: bRaw >= 20, V, O, I, dir, out, polys, cross12,
      angTop: 2 * g, angSide: Math.PI - 2 * g, ow: Math.max(a + hp, cfg.foot + hp), foot: cfg.foot
    };
  }

  /* ---------- čepy a výřezy (zámečky) v rozích 3, 0, 1 ---------- */
  const CORNERS = [3, 0, 1];
  function locks(L, cfg) {
    const res = {}, wt = L.hp - 2 * cfg.tabMargin;
    CORNERS.forEach((j) => {
      const i = (j + 3) % 4, d = L.dir[j], nn = [d[1], -d[0]];       // čep jeklu i je pruh podél osy jeklu j
      const mDir = norm(sub(L.O[j], L.I[j]));
      const base = [wt / 2, -wt / 2].map((s) => isect(add(L.V[j], mul(nn, s)), d, L.I[j], mDir));
      let lt = 0;
      for (let s = 0.5; s <= 60; s += 0.5) {
        if (base.every((p) => inConvex(L.polys[j], add(p, mul(d, s)), cfg.tabMargin - 0.01, 3))) lt = s; else break;
      }
      const l = Math.min(14, lt);
      res[i] = { bar: i, to: j, tab: [base[0], add(base[0], mul(d, l)), add(base[1], mul(d, l)), base[1]], wt, lt: l, ok: l >= 4 };
    });
    return res;
  }

  /* plochý tvar přední (nebo zadní) stěny jeklu i: s podél osy, t napříč (počátek v ose rohu i) */
  function barFlat(L, lk, cfg, i) {
    const d = L.dir[i], nn = [d[1], -d[0]], o = L.V[i], c = cfg.clear;
    const to2 = (p) => { const q = sub(p, o); return [dot(q, d), dot(q, nn)]; };
    const body = L.polys[i].map(to2);
    const near = (from, pairs) => pairs.slice().sort((p, q) => len(sub(p[0], from)) - len(sub(q[0], from)));
    const pts = [body[0], body[1]];
    let tab = null, notch = null;
    if (lk[i]) {
      tab = lk[i].tab.map(to2);
      const tp = near(body[1], [[tab[0], tab[1]], [tab[3], tab[2]]]);
      pts.push(tp[0][0], tp[0][1], tp[1][1], tp[1][0]);
    }
    pts.push(body[2], body[3]);
    const pr = (i + 3) % 4;
    if (lk[pr]) {
      const tq = lk[pr].tab.map(to2), e = norm(sub(tq[1], tq[0]));
      let np = [-e[1], e[0]]; if (dot(np, sub(tq[3], tq[0])) < 0) np = mul(np, -1);
      const md = norm(sub(body[0], body[3]));
      const nb0 = isect(add(tq[0], mul(np, -c)), e, body[3], md), nb1 = isect(add(tq[3], mul(np, c)), e, body[3], md);
      const nt0 = add(add(tq[1], mul(np, -c)), mul(e, c)), nt1 = add(add(tq[2], mul(np, c)), mul(e, c));
      notch = [nb0, nt0, nt1, nb1];
      const pk = near(body[3], [[nb0, nt0], [nb1, nt1]]);
      pts.push(pk[0][0], pk[0][1], pk[1][1], pk[1][0]);
    }
    const rr = (poly) => poly.map((p) => [r2(p[0]), r2(p[1])]);
    const contour = rr(pts);
    /* zkřížení nohou: jeklu 1 se vyřízne přední stěna, jeklu 2 zadní (v místě zkřížení přes celou šířku jeklu) */
    let slot = null;
    if (i === 1 || i === 2) {
      const ot = L.polys[3 - i].map(to2), lines = [[ot[0], ot[1]], [ot[3], ot[2]]];
      const sr = mid(body[0], body[3]), er = mid(body[1], body[2]);
      const sd = (ln, p) => { const e = norm(sub(ln[1], ln[0])); return dot(sub(p, ln[0]), [-e[1], e[0]]); };
      lines.sort((p, q) => Math.abs(sd(p, sr)) - Math.abs(sd(q, sr)));
      const side = (ln, p) => { const e = norm(sub(ln[1], ln[0])), nv = [-e[1], e[0]]; return dot(sub(p, ln[0]), nv) >= 0 ? nv : mul(nv, -1); };
      const p1 = clipHalf(contour, lines[0][0], side(lines[0], sr)), p2 = clipHalf(contour, lines[1][0], side(lines[1], er));
      const sAt = (ln) => isect(ln[0], norm(sub(ln[1], ln[0])), [0, 0], [1, 0])[0];
      slot = { wall: i === 1 ? 'přední' : 'zadní', pieces: [rr(p1), rr(p2)], len: r1(Math.abs(sAt(lines[1]) - sAt(lines[0]))), depth: L.hd / 2 };
    }
    return { body: rr(body), tab: tab && rr(tab), notch: notch && rr(notch), contour, slot };
  }

  /* DXF (R12, mm): uzavřené obrysy; každý obrys má svou vrstvu a posun v ose Y, ať se nepřekrývají */
  function dxf(shapes) {
    const out = ['0', 'SECTION', '2', 'ENTITIES'];
    shapes.forEach((sh) => sh.polys.forEach((poly) => poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      out.push('0', 'LINE', '8', sh.layer, '10', p[0], '20', p[1] + (sh.dy || 0), '30', 0, '11', q[0], '21', q[1] + (sh.dy || 0), '31', 0);
    })));
    out.push('0', 'ENDSEC', '0', 'EOF');
    return out.join('\n') + '\n';
  }

  /* ---------- 3D tělesa pro kontrolu zaklesnutí ---------- */
  function prism(poly2, hd, plane) {
    const v = [];
    [-hd / 2, hd / 2].forEach((s) => poly2.forEach((p) => v.push(plane === 'xz' ? [p[0], s, p[1]] : [s, p[0], p[1]])));
    return { v, nq: poly2.length, plane };
  }
  const edgesOf = (P) => { const e = [P.plane === 'xz' ? [0, 1, 0] : [1, 0, 0]]; for (let i = 0; i < P.nq; i++) e.push(norm(sub(P.v[(i + 1) % P.nq], P.v[i]))); return e; };
  const axesOf = (P) => { const u = edgesOf(P)[0], ax = [u]; for (let i = 0; i < P.nq; i++) ax.push(norm(cross(u, sub(P.v[(i + 1) % P.nq], P.v[i])))); return ax; };
  function gap(A, B) {                                              // nejlepší oddělující vzdálenost (záporná = zasahují do sebe)
    const cand = axesOf(A).concat(axesOf(B));
    edgesOf(A).forEach((a) => edgesOf(B).forEach((b) => { const c = cross(a, b); if (len(c) > 1e-6) cand.push(norm(c)); }));
    let best = -Infinity;
    cand.forEach((n) => {
      const pa = A.v.map((p) => dot(p, n)), pb = B.v.map((p) => dot(p, n));
      best = Math.max(best, Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
    });
    return best;
  }

  /* uspořádání po výšce */
  function layout(c) {
    const cfg = normalize(c), L = link(cfg);
    const zB = cfg.baseT + L.b + L.hl;                              // střed dolního článku (rovina YZ)
    const zA = zB + 2 * L.b * (1 - cfg.overlap);                    // střed horního článku (rovina XZ)
    const rot = (poly) => poly.map(([u, v]) => [-u, -v]);
    return { cfg, L, zA, zB, top: cfg.H - cfg.topT, polysB: L.polys, polysA: L.polys.map(rot) };
  }
  function interlock(c) {
    const Y = layout(c), { L } = Y, sh = (q, z) => q.map((p) => [p[0], p[1] + z]);
    const A = Y.polysA.map((q) => prism(sh(q, Y.zA), L.hd, 'xz')), B = Y.polysB.map((q) => prism(sh(q, Y.zB), L.hd, 'yz'));
    let min = Infinity;
    A.forEach((a) => B.forEach((b) => { min = Math.min(min, gap(a, b)); }));
    return min;
  }
  function bestOverlap(c) {
    let best = null;
    for (let k = 0.1; k <= 0.8 + 1e-9; k += 0.01) {
      const g = interlock(Object.assign({}, c, { overlap: k }));
      if (!best || g > best.gap) best = { overlap: r2(k), gap: g };
    }
    return best;
  }

  /* ---------- vše pro dílnu ---------- */
  const PART_BAR = { A: 0, B: 3, C: 1, D: 2 };
  function build(c) {
    const Y = layout(c), { cfg, L } = Y, lk = locks(L, cfg);
    const flats = [0, 1, 2, 3].map((i) => barFlat(L, lk, cfg, i));
    const miterTop = deg(L.angTop / 2), miterSide = deg(L.angSide / 2), footCut = 90 - cfg.gamma;
    const parts = Object.keys(PART_BAR).map((id) => {
      const i = PART_BAR[id], p = L.polys[i];
      const ends = [[0, 3], [1, 2]].map(([o, n], k) => {
        const mitre = (k === 0 ? i : (i + 1) % 4);
        const free = (i === 1 && k === 1) || (i === 2 && k === 0);
        return free ? 'noha – vodorovný řez ' + r1(footCut) + '°' : (mitre === 0 ? 'pokos ' + r1(miterTop) + '°' : 'pokos ' + r1(miterSide) + '°');
      });
      return {
        id, bar: i, qty: 2, lo: r1(len(sub(p[1], p[0]))), li: r1(len(sub(p[2], p[3]))), ends,
        tab: !!lk[i], notch: !!lk[(i + 3) % 4], slot: flats[i].slot
      };
    });
    const totalLen = parts.reduce((s, p) => s + (p.lo + p.li) / 2 * p.qty, 0);
    const kg = kgm(PROFILES.find((p) => p.id === cfg.prof)) * totalLen / 1000;
    const gp = interlock(cfg), warn = [];
    if (!L.bOk) warn.push('Výška je příliš nízká na takhle dlouhé nohy. Zmenši rozteč noh nebo zvyš stůl.');
    if (gp < 1) warn.push(gp < 0 ? 'Články do sebe narážejí (překrytí ' + r1(-gp) + ' mm). Zvětši překryv nebo úhel, nebo zvol užší jekl.' : 'Mezi články je vůle jen ' + r1(gp) + ' mm.');
    if (Object.values(lk).some((x) => !x.ok)) warn.push('V některém rohu je čep kratší než 4 mm – zámeček nedrží. Zvol širší jekl nebo menší úhel.');
    if (cfg.baseW < 2 * cfg.foot + L.hp + 20) warn.push('Plotna ' + cfg.baseW + ' mm je užší než rozteč noh (' + r1(2 * cfg.foot + L.hp) + ' mm) – zvětši ji.');
    if (cfg.topD < 2 * cfg.foot + L.hp + 60) warn.push('Deska ' + cfg.topD + ' mm je malá na rozteč noh – zmenši rozteč.');
    if (Math.abs(Y.zA + L.b + L.hl - Y.top) > 0.5 && L.bOk) warn.push('Výška sloupku nesedí.');
    return { cfg, L, zA: Y.zA, zB: Y.zB, polysA: Y.polysA, polysB: Y.polysB, lk, flats, parts, gap: gp, warn, kg, miterTop, miterSide, footCut };
  }

  /* makro pro FreeCAD: postaví oba články, plotnu a desku jako tělesa (volitelná kontrola geometrie) */
  function freecadMacro(c) {
    const B = build(c), { cfg, L } = B, hd = L.hd;
    return [
      '# Konferenční stolek „Dva články“ – makro FreeCAD (vygenerováno z konfigurátoru)',
      'import FreeCAD as App, Part',
      'doc = App.newDocument("Stolek")',
      'HD = ' + hd + '',
      'def jekl(name, poly, zc, plane):',
      '    pts = [(p[0], p[1] + zc) for p in poly]',
      '    if plane == "yz": v = [App.Vector(-HD/2, u, z) for u, z in pts]; ex = App.Vector(HD, 0, 0)',
      '    else: v = [App.Vector(u, -HD/2, z) for u, z in pts]; ex = App.Vector(0, HD, 0)',
      '    f = Part.Face(Part.makePolygon(v + [v[0]]))',
      '    o = doc.addObject("Part::Feature", name); o.Shape = f.extrude(ex)',
      'LOWER = ' + JSON.stringify(B.polysB.map((q) => q.map((p) => [r2(p[0]), r2(p[1])]))),
      'UPPER = ' + JSON.stringify(B.polysA.map((q) => q.map((p) => [r2(p[0]), r2(p[1])]))),
      'for i, q in enumerate(LOWER): jekl("Dolni_%d" % i, q, ' + r2(B.zB) + ', "yz")',
      'for i, q in enumerate(UPPER): jekl("Horni_%d" % i, q, ' + r2(B.zA) + ', "xz")',
      'p = doc.addObject("Part::Box", "Plotna"); p.Length = p.Width = ' + cfg.baseW + '; p.Height = ' + cfg.baseT + '; p.Placement.Base = App.Vector(-' + cfg.baseW / 2 + ', -' + cfg.baseW / 2 + ', 0)',
      'd = doc.addObject("Part::Cylinder", "Deska"); d.Radius = ' + cfg.topD / 2 + '; d.Height = ' + cfg.topT + '; d.Placement.Base = App.Vector(0, 0, ' + (cfg.H - cfg.topT) + ')',
      'doc.recompute()',
      '# kontrola: průnik dolních a horních jeklů musí být prázdný',
      'import itertools',
      'bad = 0',
      'for lo in [o for o in doc.Objects if o.Name.startswith("Dolni")]:',
      '    for hi in [o for o in doc.Objects if o.Name.startswith("Horni")]:',
      '        v = lo.Shape.common(hi.Shape).Volume',
      '        if v > 1e-3: bad += 1; print("KOLIZE", lo.Name, hi.Name, round(v, 1), "mm3")',
      'print("Kolizí mezi články:", bad)',
      ''
    ].join('\n');
  }

  const API = { PROFILES, DEFAULT_CFG, PART_BAR, kgm, dxf, area, normalize, link, locks, barFlat, layout, interlock, bestOverlap, build, freecadMacro, clipConvex, orient, rad, deg, r1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Stolecky = API;
})(typeof window !== 'undefined' ? window : globalThis);
