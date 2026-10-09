/* Konferenční stolečky – jádro bez 3D (běží v prohlížeči i v Node).
 *
 * Model „Řetěz“ (podle fotky): tři články z jeklu zavěšené do sebe jako řetěz.
 *   dole  „Λ“  – dvě nohy na plotně, hrot nahoře (horní polovina kosočtverce), rovina XZ
 *   střed  ◇   – celý kosočtverec, otočený o 90° (rovina YZ)
 *   nahoře „V“ – dvě nohy pod deskou, hrot dole, rovina XZ
 * Řetěz v tlaku sám nedrží, proto hrot Λ dosedá do spodního žlábku kosočtverce a hrot V do horního – tam se články svaří.
 * Výška kosočtverce se dopočítá tak, aby oba hroty právě dosedly (nejmenší zaklesnutí, kdy se tělesa neprotínají).
 *
 * Zámečky pro Bodor K2: v každém rohu (pokosu) má jeden jekl čep (prodloužená přední i zadní stěna) a sousední výřez.
 * Nohy se zasunou do otvorů v plotně a v plechu pod deskou (laser na plech) do hloubky plechu pod deskou – to je zámek pro nohy;
 * nahoře lícují s plechem (dosednou na dřevo), dole končí uvnitř otvoru plotny, takže se zavaří zespodu a nic nevyčuhuje.
 * Osy: Z nahoru, mm. Souřadnice článku v rovině: u vodorovně, v nahoru.
 */
(function (root) {
  'use strict';

  const PROFILES = [
    { id: '40x20x2', hp: 40, hd: 20, wall: 2 }, { id: '40x20x3', hp: 40, hd: 20, wall: 3 },
    { id: '30x20x2', hp: 30, hd: 20, wall: 2 }, { id: '40x30x2', hp: 40, hd: 30, wall: 2 },
    { id: '50x30x3', hp: 50, hd: 30, wall: 3 }, { id: '30x30x2', hp: 30, hd: 30, wall: 2 },
    { id: '20x40x2', hp: 20, hd: 40, wall: 2 }
  ];
  const DEFAULT_CFG = {
    H: 450, topD: 700, topT: 30, baseW: 340, baseT: 10, plT: 6,
    prof: '40x20x2', gamma: 40, spread: 240, weldGap: 0, clear: 0.15, tabMargin: 3, holeClear: 0.5,
    fin: 'black', qty: 1
  };
  /* povrch a sazby – stejné jako u podnoží (core.js), ceník se bere z nastaveni/cenik */
  const FIN = [
    { id: 'black', lab: 'Černá mat', ral: 'RAL 9005', sw: '#1E1F21', k: 1 },
    { id: 'anth', lab: 'Antracit', ral: 'RAL 7016', sw: '#383E45', k: 1 },
    { id: 'white', lab: 'Bílá', ral: 'RAL 9016', sw: '#F2F2EE', k: 1 },
    { id: 'raw', lab: 'Ocel + lak', ral: 'bezbarvý lak', sw: '#77726A', k: 0.7 }
  ];
  const DEFAULT_RATES = { kg: 42, rez: 35, svar: 90, barva: 280, priprava: 600, marze: 35 };
  const STEEL = 7.85e-6;                                            // kg/mm³
  const kgm = (p) => (2 * (p.hp + p.hd) * p.wall - 4 * p.wall * p.wall) * STEEL * 1000;
  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;

  const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]);
  const mul = (a, k) => a.map((v) => v * k), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const len = (a) => Math.hypot(...a), norm = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

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
  function clipHalf(poly, q, n) {                                   // Sutherland–Hodgman, zůstává strana, kam míří n
    const out = [], inside = (p) => dot(sub(p, q), n) >= -1e-9;
    poly.forEach((p, i) => {
      const s = poly[(i + poly.length - 1) % poly.length], pi = inside(p), si = inside(s);
      if (pi !== si) { const t = dot(sub(q, s), n) / dot(sub(p, s), n); out.push([s[0] + (p[0] - s[0]) * t, s[1] + (p[1] - s[1]) * t]); }
      if (pi) out.push(p);
    });
    return out;
  }

  function normalize(c) {
    const o = Object.assign({}, DEFAULT_CFG, c || {});
    const num = (k, lo, hi) => { const v = Number(o[k]); o[k] = Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : DEFAULT_CFG[k])); };
    num('H', 300, 800); num('topD', 400, 1400); num('topT', 10, 60); num('baseW', 150, 700); num('baseT', 4, 25); num('plT', 3, 12);
    num('gamma', 25, 60); num('spread', 60, 500); num('weldGap', 0, 3); num('clear', 0, 0.5); num('tabMargin', 1, 8); num('holeClear', 0, 2);
    if (!PROFILES.some((p) => p.id === o.prof)) o.prof = DEFAULT_CFG.prof;
    if (!FIN.some((f) => f.id === o.fin)) o.fin = DEFAULT_CFG.fin;
    o.qty = Math.min(99, Math.max(1, Math.round(Number(o.qty)) || 1));
    return o;
  }

  /* ---------- článek: lomená osa C (otevřená nebo uzavřená), jekl šířky hp v rovině ----------
   * jekl i jde z C[i] do C[i+1]; v rohu pokos, na volném konci vodorovný řez v bodě C.
   * obrys jeklu: [začátek venku, konec venku, konec uvnitř, začátek uvnitř]; „venku“ = vlevo od směru osy */
  function frame(C, closed, hp) {
    const n = closed ? C.length : C.length - 1, at = (i) => C[i % C.length];
    const dir = [], out = [];
    for (let i = 0; i < n; i++) { const d = norm(sub(at(i + 1), at(i))); dir.push(d); out.push([-d[1], d[0]]); }
    const off = (i, s, p) => add(p, mul(out[i], s));
    const corner = {};
    for (let k = closed ? 0 : 1; k < (closed ? n : n); k++) {
      const a = (k + n - 1) % n, b = k, p = at(k);
      corner[k] = { O: isect(off(b, hp / 2, p), dir[b], off(a, hp / 2, p), dir[a]), I: isect(off(b, -hp / 2, p), dir[b], off(a, -hp / 2, p), dir[a]), ang: Math.acos(Math.max(-1, Math.min(1, -dot(dir[a], dir[b])))) };
    }
    const cut = (i, p) => {
      const hit = (s) => { const q = off(i, s, p), t = (p[1] - q[1]) / dir[i][1]; return [q[0] + dir[i][0] * t, p[1]]; };
      return { O: hit(hp / 2), I: hit(-hp / 2) };
    };
    const endK = (i) => (closed ? (i + 1) % n : i + 1);
    const polys = [];
    for (let i = 0; i < n; i++) {
      const s = corner[i] || cut(i, at(i)), e = corner[endK(i)] || cut(i, at(i + 1));
      polys.push([s.O, e.O, e.I, s.I]);
    }
    const prev = (i) => (closed ? (i + n - 1) % n : (i >= 1 ? i - 1 : -1));
    return { C, closed, n, hp, dir, out, corner, polys, endK, prev };
  }

  /* čep jeklu i (konec) do jeklu j (začátek) v rohu k = j; klíč = i */
  function locks(F, cfg) {
    const res = {}, wt = F.hp - 2 * cfg.tabMargin;
    Object.keys(F.corner).map(Number).forEach((k) => {
      const i = (k + F.n - 1) % F.n, j = k, d = F.dir[j], nn = [d[1], -d[0]], cr = F.corner[k];
      const mDir = norm(sub(cr.O, cr.I)), p0 = F.C[k];
      const base = [wt / 2, -wt / 2].map((s) => isect(add(p0, mul(nn, s)), d, cr.I, mDir));
      let lt = 0;
      for (let s = 0.5; s <= 60; s += 0.5) {
        if (base.every((p) => inConvex(F.polys[j], add(p, mul(d, s)), cfg.tabMargin - 0.01, 3))) lt = s; else break;
      }
      const l = Math.min(14, lt);
      res[i] = { bar: i, to: j, tab: [base[0], add(base[0], mul(d, l)), add(base[1], mul(d, l)), base[1]], wt, lt: l, ok: l >= 4 };
    });
    return res;
  }

  /* plochý tvar přední (= zadní) stěny jeklu i: s podél osy od bodu C[i], t napříč */
  function barFlat(F, lk, cfg, i) {
    const d = F.dir[i], nn = [d[1], -d[0]], o = F.C[i], c = cfg.clear;
    const to2 = (p) => { const q = sub(p, o); return [dot(q, d), dot(q, nn)]; };
    const body = F.polys[i].map(to2);
    const near = (from, pairs) => pairs.slice().sort((p, q) => len(sub(p[0], from)) - len(sub(q[0], from)));
    const pts = [body[0], body[1]];
    let tab = null, notch = null;
    if (lk[i]) {
      tab = lk[i].tab.map(to2);
      const tp = near(body[1], [[tab[0], tab[1]], [tab[3], tab[2]]]);
      pts.push(tp[0][0], tp[0][1], tp[1][1], tp[1][0]);
    }
    pts.push(body[2], body[3]);
    const pr = F.prev(i);
    if (pr >= 0 && lk[pr] && F.corner[i]) {
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
    return { body: rr(body), tab: tab && rr(tab), notch: notch && rr(notch), contour: rr(pts) };
  }

  /* DXF (R12, mm): shapes = [{ layer, polys: [[x,y]...], circles: [[x,y,r]], dx, dy }] */
  function dxf(shapes) {
    const out = ['0', 'SECTION', '2', 'ENTITIES'];
    shapes.forEach((sh) => {
      const dx = sh.dx || 0, dy = sh.dy || 0;
      (sh.polys || []).forEach((poly) => poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length];
        out.push('0', 'LINE', '8', sh.layer, '10', r2(p[0] + dx), '20', r2(p[1] + dy), '30', 0, '11', r2(q[0] + dx), '21', r2(q[1] + dy), '31', 0);
      }));
      (sh.circles || []).forEach((c) => out.push('0', 'CIRCLE', '8', sh.layer, '10', r2(c[0] + dx), '20', r2(c[1] + dy), '30', 0, '40', r2(c[2])));
    });
    out.push('0', 'ENDSEC', '0', 'EOF');
    return out.join('\n') + '\n';
  }

  /* ---------- 3D: hranoly jeklů a kontrola, že se články neprotínají ---------- */
  function prism(poly2, hd, plane, z) {                             // plane 'xz' (tloušťka v Y) nebo 'yz' (tloušťka v X)
    const v = [];
    [-hd / 2, hd / 2].forEach((s) => poly2.forEach((p) => v.push(plane === 'xz' ? [p[0], s, p[1] + z] : [s, p[0], p[1] + z])));
    return { v, nq: poly2.length, plane };
  }
  const edgesOf = (P) => { const e = [P.plane === 'xz' ? [0, 1, 0] : [1, 0, 0]]; for (let i = 0; i < P.nq; i++) e.push(norm(sub(P.v[(i + 1) % P.nq], P.v[i]))); return e; };
  const axesOf = (P) => { const u = edgesOf(P)[0], ax = [u]; for (let i = 0; i < P.nq; i++) ax.push(norm(cross(u, sub(P.v[(i + 1) % P.nq], P.v[i])))); return ax; };
  function gap(A, B) {                                              // největší oddělující mezera přes osy SAT (záporná = protínají se)
    const cand = axesOf(A).concat(axesOf(B));
    edgesOf(A).forEach((a) => edgesOf(B).forEach((b) => { const c = cross(a, b); if (len(c) > 1e-6) cand.push(norm(c)); }));
    let best = -Infinity;
    cand.forEach((n) => {
      const pa = A.v.map((p) => dot(p, n)), pb = B.v.map((p) => dot(p, n));
      best = Math.max(best, Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
    });
    return best;
  }
  const minGap = (As, Bs) => { let m = Infinity; As.forEach((a) => Bs.forEach((b) => { m = Math.min(m, gap(a, b)); })); return m; };

  /* ---------- sestava pro dané zaklesnutí ov (o kolik je hrot Λ nad spodní špičkou kosočtverce, po osách) ---------- */
  function geom(cfg, ov) {
    const P = PROFILES.find((p) => p.id === cfg.prof), g = rad(cfg.gamma), tg = Math.tan(g), hp = P.hp, hd = P.hd;
    const f = cfg.spread / 2, h = f / tg;                           // h = viditelná výška nohy nad plechem
    const Hs = cfg.H - cfg.topT - cfg.plT - cfg.baseT;
    const b = (Hs - 2 * h + 2 * ov) / 2, a = b * tg;
    const zl = cfg.baseT + h, zm = zl - ov + b, zu = zm + b - ov;     // hrot Λ, střed kosočtverce, hrot V
    const ins = Math.min(cfg.plT, cfg.baseT);                       // nohy jdou do otvorů v plechu stejně hluboko ⇒ dolní a horní jsou stejné díly
    const dl = zl - (cfg.baseT - ins), du = cfg.H - cfg.topT - cfg.plT + ins - zu;
    const lam = frame([[-dl * tg, -dl], [0, 0], [dl * tg, -dl]], false, hp);
    const vee = frame([[du * tg, du], [0, 0], [-du * tg, du]], false, hp);
    const mid = frame([[0, b], [a, 0], [0, -b], [-a, 0]], true, hp);
    return { P, g, tg, hp, hd, f, h, Hs, b, a, zl, zm, zu, ov, ins, lam, vee, mid };
  }
  function clash(G) {
    const L = G.lam.polys.map((q) => prism(q, G.hd, 'xz', G.zl));
    const V = G.vee.polys.map((q) => prism(q, G.hd, 'xz', G.zu));
    const M = G.mid.polys.map((q) => prism(q, G.hd, 'yz', G.zm));
    return { lm: minGap(L, M), vm: minGap(V, M), lv: minGap(L, V) };
  }
  /* nejmenší zaklesnutí, při kterém se články neprotínají = hroty právě dosednou */
  function seat(cfg) {
    const g = (ov) => { const c = clash(geom(cfg, ov)); return Math.min(c.lm, c.vm, c.lv); };
    let lo = null, hi = null, prev = 0;
    for (let ov = 2; ov <= 400; ov += 2) {
      if (g(ov) >= 0) { lo = prev; hi = ov; break; }
      prev = ov;
    }
    if (hi === null) return null;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (g(m) >= 0) hi = m; else lo = m; }
    return hi;
  }

  /* otvor v plechu pro nohu: obrys jeklu oříznutý tloušťkou plechu (z0..z1), + vůle */
  function hole(poly, zc, z0, z1, hd, c) {
    let p = poly.map((q) => [q[0], q[1] + zc]);
    p = clipHalf(p, [0, z0], [0, 1]); p = clipHalf(p, [0, z1], [0, -1]);
    if (!p.length) return null;
    const xs = p.map((q) => q[0]);
    return [[Math.min(...xs) - c, -hd / 2 - c], [Math.max(...xs) + c, -hd / 2 - c], [Math.max(...xs) + c, hd / 2 + c], [Math.min(...xs) - c, hd / 2 + c]];
  }

  /* ---------- vše pro zákazníka i dílnu ---------- */
  function build(c) {
    const cfg = normalize(c), warn = [];
    const G0 = geom(cfg, 0), tipsOk = G0.Hs - 2 * G0.h - G0.hp / Math.sin(G0.g) >= 10;
    if (!tipsOk) warn.push('Nohy jsou na tuhle výšku moc dlouhé – hroty dolního a horního článku by se potkaly. Zmenši rozteč noh nebo zvětši úhel.');
    let ov0 = seat(cfg);
    if (ov0 === null) { if (tipsOk) warn.push('Články se do sebe nevejdou – zvol užší jekl nebo širší úhel.'); ov0 = 120; }
    const G = geom(cfg, ov0 + cfg.weldGap), cl = clash(G);
    const gp = Math.min(cl.lm, cl.vm);
    const frames = { lam: G.lam, vee: G.vee, mid: G.mid };
    const lk = {}, flats = {};
    Object.keys(frames).forEach((k) => {
      lk[k] = locks(frames[k], cfg);
      flats[k] = frames[k].polys.map((_, i) => barFlat(frames[k], lk[k], cfg, i));
    });

    /* díly: stejný obrys stěny = stejný díl */
    const footCut = 90 - cfg.gamma;
    const endTxt = (F, k) => (F.corner[k] ? 'pokos ' + r1(deg(F.corner[k].ang) / 2) + '°' : 'vodorovný řez ' + r1(footCut) + '°');
    const roles = [
      ['lam', 0, 'Noha s čepem'], ['lam', 1, 'Noha s výřezem'], ['vee', 0, 'Noha s čepem'], ['vee', 1, 'Noha s výřezem'],
      ['mid', 0, 'Článek – čep u boku'], ['mid', 1, 'Článek – čep u špičky'], ['mid', 2, 'Článek – čep u boku'], ['mid', 3, 'Článek – čep u špičky']
    ];
    const parts = [];
    roles.forEach(([k, i, name]) => {
      const F = frames[k], f = flats[k][i], sig = JSON.stringify(f.contour.map((p) => [r1(p[0]), r1(p[1])]));
      const hit = parts.find((p) => p.sig === sig);
      if (hit) { hit.qty++; hit.where.push(k); return; }
      const p = F.polys[i];
      parts.push({
        sig, name, frame: k, bar: i, qty: 1, where: [k], flat: f,
        lo: r1(len(sub(p[1], p[0]))), li: r1(len(sub(p[2], p[3]))),
        ends: [endTxt(F, i), endTxt(F, F.endK(i))], tab: !!lk[k][i], notch: F.prev(i) >= 0 && !!lk[k][F.prev(i)] && !!F.corner[i]
      });
    });
    const legsDiffer = parts.some((p) => p.where.includes('lam') && !p.where.includes('vee'));
    parts.forEach((p, n) => {
      p.id = String.fromCharCode(65 + n);
      if (legsDiffer && p.frame !== 'mid') p.name += p.frame === 'lam' ? ' (dolní)' : ' (horní)';
      delete p.sig;
    });

    /* plechy: plotna (nohy Λ) a plech pod deskou (nohy V) */
    const hc = cfg.holeClear;
    const baseHoles = G.lam.polys.map((q) => hole(q, G.zl, 0, cfg.baseT, G.hd, hc)).filter(Boolean);
    const zt0 = cfg.H - cfg.topT - cfg.plT, zt1 = cfg.H - cfg.topT;
    const topHoles = G.vee.polys.map((q) => hole(q, G.zu, zt0, zt1, G.hd, hc)).filter(Boolean);
    const reach = Math.max(...topHoles.flat().map((p) => Math.abs(p[0])));
    const topW = Math.ceil((2 * reach + 2 * 45) / 10) * 10, inset = 20;
    const screws = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [sx * (topW / 2 - inset), sy * (topW / 2 - inset), 3.5]);
    const sq = (w) => [[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, w / 2], [-w / 2, w / 2]];
    const plates = {
      base: { name: 'Plotna', w: cfg.baseW, t: cfg.baseT, outline: sq(cfg.baseW), holes: baseHoles, circles: [] },
      top: { name: 'Plech pod deskou', w: topW, t: cfg.plT, outline: sq(topW), holes: topHoles, circles: screws }
    };
    const plateKg = (pl) => (pl.w * pl.w - pl.holes.reduce((s, h) => s + area(h), 0)) * pl.t * STEEL;

    const barLen = parts.reduce((s, p) => s + (p.lo + p.li) / 2 * p.qty, 0);
    const kgBars = kgm(G.P) * barLen / 1000, kgPlates = plateKg(plates.base) + plateKg(plates.top);

    if (Object.values(lk).some((m) => Object.values(m).some((x) => !x.ok))) warn.push('V některém rohu je čep kratší než 4 mm – zámeček nedrží. Zvol širší jekl nebo menší okraj čepu.');
    const baseReach = Math.max(...baseHoles.flat().map((p) => Math.abs(p[0])));
    if (baseReach > cfg.baseW / 2 - 15) warn.push('Plotna ' + cfg.baseW + ' mm je pro tuhle rozteč noh malá – potřebuje aspoň ' + Math.ceil((2 * baseReach + 30) / 10) * 10 + ' mm.');
    if (Math.hypot(topW / 2, topW / 2) > cfg.topD / 2 - 15) warn.push('Plech pod deskou (' + topW + ' mm) vyčuhuje z desky Ø ' + cfg.topD + ' – zmenši rozteč noh nebo zvětši desku.');
    if (G.mid.polys.some((q) => q.some((p) => Math.abs(p[0]) > cfg.topD / 2 - 20))) warn.push('Prostřední článek je širší než deska.');

    return {
      cfg, G, ov: G.ov, ovSeat: ov0, gap: gp, clash: cl, frames, lk, flats, parts, plates, warn,
      kgBars, kgPlates, kg: kgBars + kgPlates, footCut,
      size: { midH: 2 * G.b + G.hp / Math.sin(G.g), midW: 2 * G.a + G.hp / Math.cos(G.g), legH: G.h, spread: cfg.spread }
    };
  }

  /* makro pro FreeCAD: postaví sestavu a vypíše průniky / vzdálenosti článků */
  function freecadMacro(c) {
    const B = build(c), { cfg, G } = B, poly = (ps) => JSON.stringify(ps.map((q) => q.map((p) => [r2(p[0]), r2(p[1])])));
    const holes = (h) => JSON.stringify(h.map((q) => q.map((p) => [r2(p[0]), r2(p[1])])));
    return [
      '# Konferenční stolek „Řetěz“ – makro FreeCAD (vygenerováno z konfigurátoru)',
      'import FreeCAD as App, Part',
      'doc = App.newDocument("Stolek")',
      'HD = ' + G.hd,
      'def jekl(name, poly, zc, plane):',
      '    if plane == "yz": v = [App.Vector(-HD/2, u, z + zc) for u, z in poly]; ex = App.Vector(HD, 0, 0)',
      '    else: v = [App.Vector(u, -HD/2, z + zc) for u, z in poly]; ex = App.Vector(0, HD, 0)',
      '    o = doc.addObject("Part::Feature", name); o.Shape = Part.Face(Part.makePolygon(v + [v[0]])).extrude(ex); return o',
      'def plech(name, w, t, z0, holes, screws):',
      '    s = Part.makeBox(w, w, t, App.Vector(-w/2, -w/2, z0))',
      '    for h in holes:',
      '        x0 = min(p[0] for p in h); x1 = max(p[0] for p in h); y0 = min(p[1] for p in h); y1 = max(p[1] for p in h)',
      '        s = s.cut(Part.makeBox(x1 - x0, y1 - y0, t + 2, App.Vector(x0, y0, z0 - 1)))',
      '    for x, y, r in screws: s = s.cut(Part.makeCylinder(r, t + 2, App.Vector(x, y, z0 - 1)))',
      '    o = doc.addObject("Part::Feature", name); o.Shape = s; return o',
      'L = [jekl("Dolni_%d" % i, q, ' + r2(G.zl) + ', "xz") for i, q in enumerate(' + poly(G.lam.polys) + ')]',
      'M = [jekl("Stred_%d" % i, q, ' + r2(G.zm) + ', "yz") for i, q in enumerate(' + poly(G.mid.polys) + ')]',
      'V = [jekl("Horni_%d" % i, q, ' + r2(G.zu) + ', "xz") for i, q in enumerate(' + poly(G.vee.polys) + ')]',
      'plech("Plotna", ' + cfg.baseW + ', ' + cfg.baseT + ', 0, ' + holes(B.plates.base.holes) + ', [])',
      'plech("Plech_pod_deskou", ' + B.plates.top.w + ', ' + cfg.plT + ', ' + (cfg.H - cfg.topT - cfg.plT) + ', ' + holes(B.plates.top.holes) + ', ' + JSON.stringify(B.plates.top.circles) + ')',
      'd = doc.addObject("Part::Cylinder", "Deska"); d.Radius = ' + cfg.topD / 2 + '; d.Height = ' + cfg.topT + '; d.Placement.Base = App.Vector(0, 0, ' + (cfg.H - cfg.topT) + ')',
      'doc.recompute()',
      'def kontrola(a, b, jm):',
      '    vol = sum(x.Shape.common(y.Shape).Volume for x in a for y in b)',
      '    dist = min(x.Shape.distToShape(y.Shape)[0] for x in a for y in b)',
      '    print(jm, "průnik %.2f mm3, nejmenší vzdálenost %.2f mm" % (vol, dist))',
      'kontrola(L, M, "Dolní Λ × kosočtverec:")',
      'kontrola(V, M, "Horní V × kosočtverec:")',
      'kontrola(L, V, "Dolní Λ × horní V:")',
      ''
    ].join('\n');
  }

  /* orientační cena podnože stolku (bez desky) – stejný vzorec jako analyzeCore v core.js:
   * materiál + pálení dílů + svary + prášková barva + příprava, marže, DPH 21 % */
  function price(B, ratesIn) {
    const R = Object.assign({}, DEFAULT_RATES, ratesIn || {}), c = B.cfg, P = B.G.P, F = FIN.find((f) => f.id === c.fin);
    const barLen = B.parts.reduce((s, p) => s + (p.lo + p.li) / 2 * p.qty, 0);
    const cuts = B.parts.reduce((s, p) => s + p.qty, 0) + 2;
    const welds = 4 + 2 + 4 + 4;                                     // kosočtverec, hroty V/Λ, nohy v plechu, styky článků
    const surf = barLen * 2 * (P.hp + P.hd) / 1e6 + [B.plates.base, B.plates.top].reduce((s, pl) => s + 2 * pl.w * pl.w / 1e6, 0);
    const cost = B.kg * R.kg + cuts * R.rez + welds * R.svar + surf * R.barva * F.k + R.priprava;
    const p = Math.round(cost * (1 + R.marze / 100) / 10) * 10, vat = Math.round(p * 1.21 / 10) * 10;
    return { price: p, vat, total: vat * c.qty, cuts, welds, surf };
  }
  function describe(c) {
    c = normalize(c);
    const F = FIN.find((f) => f.id === c.fin);
    return 'Stolek Řetěz ' + c.gamma + '° · výška ' + c.H + ' · deska Ø ' + c.topD + ' · jekl ' + c.prof.replace(/x/g, '×') + ' · ' + F.lab;
  }

  const API = {
    FIN, DEFAULT_RATES, price, describe,
    PROFILES, DEFAULT_CFG, kgm, dxf, area, normalize, frame, locks, barFlat, geom, clash, seat, build, freecadMacro, orient, rad, deg, r1
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Stolecky = API;
})(typeof window !== 'undefined' ? window : globalThis);
