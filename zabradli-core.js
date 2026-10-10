/* zabradli-core.js – zábradlí pro konfigurátor.
 *   typ A = vzor „akce 01“: sloupky mezi madly, rám z jeklu 40×40, výplň z pásoviny.
 *   typ B = vzor „akce 02“: bez sloupků, pole do 1,5 m na tupo s vložkami, boční kotvení přes fasádu, dřevěné madlo.
 * Port generátorů railing.py / railing_b.py ze skillu sldprt-zabradli. Běží v prohlížeči i v Node (bez závislostí).
 * Souřadnice: mm, Z nahoru. Trasa = čára podlahy / výstupní čára schodiště v ose zábradlí.
 *
 * Pravidlo zámků (stejné jako u podnoží): drážka pro pásovinu se dělá jen tehdy, když celá padne do rovné části
 * stěny rámu (mimo rádius rohu ~2,4 t), tj. rám musí být širší než pásovina. Jinak se pásovina svaří na tupo.
 * Technologické otvory pro zinkování se nepřidávají (jen na výslovné přání).
 */
(function (root) {
  'use strict';

  /* ---------- vektory ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const unit = (a) => mul(a, 1 / len(a));
  const Z = [0, 0, 1];
  const DEG = 180 / Math.PI;
  const hproj = (d) => unit([d[0], d[1], 0]);
  const frameOf = (d) => { const w = unit(cross(Z, d)); return { w, up: unit(cross(d, w)) }; };
  const hit = (c, d, P) => add(c, mul(d, dot(P.n, sub(P.p, c)) / dot(P.n, d)));
  const r1 = (x) => Math.round(x * 10) / 10;
  const cutAngle = (d, n) => r1(Math.acos(Math.min(1, Math.abs(dot(unit(d), unit(n))))) * DEG);
  const nf = (n, d) => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

  function extent(p0, d, e1, e2, h1, h2, c0, c1) {
    let best = 0;
    [-h1, h1].forEach((a) => [-h2, h2].forEach((b) => {
      const p = add(add(p0, mul(e1, a)), mul(e2, b));
      const t0 = dot(c0.n, sub(c0.p, p)) / dot(d, c0.n), t1 = dot(c1.n, sub(c1.p, p)) / dot(d, c1.n);
      best = Math.max(best, Math.abs(t1 - t0));
    }));
    return best;
  }

  /* ---------- tělesa z rovinných ploch ---------- */
  function solidFrom(F) {
    const verts = [], map = {};
    const id = (p) => {
      const k = Math.round(p[0] * 1e4) + ',' + Math.round(p[1] * 1e4) + ',' + Math.round(p[2] * 1e4);
      if (map[k] == null) { map[k] = verts.length; verts.push(p); }
      return map[k];
    };
    const faces = F.map((f) => ({ outer: f.loops[0].map(id), inner: f.loops.slice(1).map((l) => l.map(id)), n: unit(f.n) }));
    return { verts, faces };
  }

  /* hranol obdélníkového průřezu (dutý jekl t > 0, plný t = 0) mezi dvěma rovinami řezu.
     m: {p0, d, e1, e2, h1, h2, t, cut0, cut1, holes:[{wall:'+e1'|'-e1'|'+e2'|'-e2', dir, pts}]}
     otvor = obrys (3D body) promítnutý ve směru dir na vnější i vnitřní povrch stěny (přesný průchod hranolu). */
  const OF = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function prismSolid(m) {
    const F = [], S = m.t > 0 ? ['o', 'i'] : ['o'];
    const H = { o: [m.h1, m.h2], i: [m.h1 - m.t, m.h2 - m.t] };
    const E = {};
    S.forEach((r) => OF.forEach(([a, b], k) => {
      const c = add(add(m.p0, mul(m.e1, a * H[r][0])), mul(m.e2, b * H[r][1]));
      E[r + k + '0'] = hit(c, m.d, m.cut0); E[r + k + '1'] = hit(c, m.d, m.cut1);
    }));
    const WALL = [{ id: '-e2', k: 0, n: mul(m.e2, -1), hk: 1 }, { id: '+e1', k: 1, n: m.e1, hk: 0 }, { id: '+e2', k: 2, n: m.e2, hk: 1 }, { id: '-e1', k: 3, n: mul(m.e1, -1), hk: 0 }];
    WALL.forEach((W) => {
      const k1 = (W.k + 1) % 4, hs = (m.holes || []).filter((h) => h.wall === W.id);
      const proj = {};
      S.forEach((r) => {
        const P = { p: add(m.p0, mul(W.n, H[r][W.hk])), n: W.n };
        proj[r] = hs.map((h) => (r === 'i' && h.innerPts ? h.innerPts : h.pts).map((q) => hit(q, h.dir, P)));
        F.push({ loops: [[E[r + W.k + '0'], E[r + k1 + '0'], E[r + k1 + '1'], E[r + W.k + '1']]].concat(proj[r]), n: r === 'o' ? W.n : mul(W.n, -1) });
      });
      if (m.t > 0) hs.forEach((h, j) => {
        const po = proj.o[j], pi = proj.i[j], cen = mul(po.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / po.length);
        for (let k = 0; k < po.length; k++) {
          const k2 = (k + 1) % po.length, mid = mul(add(po[k], po[k2]), 0.5);
          let n = cross(sub(po[k2], po[k]), sub(pi[k], po[k])); if (dot(n, sub(cen, mid)) < 0) n = mul(n, -1);   // bok otvoru sleduje skutečný průchod mezi stěnami
          F.push({ loops: [[po[k], po[k2], pi[k2], pi[k]]], n });
        }
      });
    });
    [['0', m.cut0, -1], ['1', m.cut1, 1]].forEach(([e, cut, sg]) => {
      let n = unit(cut.n); if (dot(n, m.d) * sg < 0) n = mul(n, -1);
      const loops = [[0, 1, 2, 3].map((k) => E['o' + k + e])];
      if (m.t > 0) loops.push([0, 1, 2, 3].map((k) => E['i' + k + e]));
      F.push({ loops, n });
    });
    return solidFrom(F);
  }

  function connectorCap(m, plane) {
    const f = m.solid.faces.find((x) => x.outer.every((i) => Math.abs(dot(plane.n, sub(m.solid.verts[i], plane.p))) < 1e-5) && (!m.t || x.inner.length));
    if (!f) throw new Error('Nelze najít řeznou plochu madla pro rohovou spojku.');
    return { outer: f.outer.map((i) => m.solid.verts[i]), inner: f.inner.length ? f.inner[0].map((i) => m.solid.verts[i]) : [], n: unit(plane.n) };
  }

  function connectorSolid(m) {
    const a = connectorCap(m.connectorPair[0], m.connectorPair[0].cut1), b = connectorCap(m.connectorPair[1], m.connectorPair[1].cut0);
    let best = null;
    for (const dir of [1, -1]) for (let shift = 0; shift < 4; shift++) {
      const ids = [0, 1, 2, 3].map((i) => (shift + dir * i + 8) % 4);
      const score = ids.reduce((sum, j, i) => sum + dot(sub(a.outer[i], b.outer[j]), sub(a.outer[i], b.outer[j])), 0);
      if (!best || score < best.score) best = { ids, score };
    }
    const bo = best.ids.map((i) => b.outer[i]), bi = b.inner.length ? best.ids.map((i) => b.inner[i]) : [];
    const F = [], ca = mul(a.outer.reduce(add, [0, 0, 0]), 1 / 4), cb = mul(bo.reduce(add, [0, 0, 0]), 1 / 4);
    const axis = sub(cb, ca), n = unit(axis);
    m.p0 = ca; m.d = n; m.L = len(axis);
    m.e1 = unit(cross(Math.abs(n[2]) < 0.9 ? Z : [0, 1, 0], n)); m.e2 = unit(cross(n, m.e1));
    const capNormal = (cap, outward) => dot(cap.n, outward) < 0 ? mul(cap.n, -1) : cap.n;
    F.push({ loops: a.inner.length ? [a.outer, a.inner] : [a.outer], n: capNormal(a, mul(n, -1)) }, { loops: b.inner.length ? [bo, bi] : [bo], n: capNormal(b, n) });
    const center = mul(a.outer.concat(bo).reduce(add, [0, 0, 0]), 1 / 8);
    const triangles = (p, inward) => {
      for (let j = 1; j < p.length - 1; j++) {
        let q = [p[0], p[j], p[j + 1]], nn = cross(sub(q[1], q[0]), sub(q[2], q[0]));
        const mid = mul(q.reduce(add, [0, 0, 0]), 1 / 3);
        if ((dot(nn, sub(mid, center)) > 0) === inward) { q = [q[0], q[2], q[1]]; nn = mul(nn, -1); }
        F.push({ loops: [q], n: nn });
      }
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      triangles([a.outer[i], a.outer[j], bo[j], bo[i]], false);
      if (a.inner.length) triangles([a.inner[i], a.inner[j], bi[j], bi[i]], true);
    }
    return solidFrom(F);
  }

  /* vytažení rovinného obrysu (konvexní) s otvory: deska, plotna, tyč */
  function extrudeSolid(outer, holes, o, ex, ey, ez, t) {
    const P = (q, z) => add(add(add(o, mul(ex, q[0])), mul(ey, q[1])), mul(ez, z));
    const F = [];
    F.push({ loops: [outer.map((q) => P(q, 0))].concat(holes.map((h) => h.map((q) => P(q, 0)))), n: mul(ez, -1) });
    F.push({ loops: [outer.map((q) => P(q, t))].concat(holes.map((h) => h.map((q) => P(q, t)))), n: ez });
    const sides = (poly, inward) => {
      const c = poly.reduce((a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length], [0, 0]);
      poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length];
        let n2 = [b[1] - a[1], -(b[0] - a[0])];
        const mid = [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1]];
        if ((n2[0] * mid[0] + n2[1] * mid[1] > 0) === inward) n2 = [-n2[0], -n2[1]];
        F.push({ loops: [[P(a, 0), P(b, 0), P(b, t), P(a, t)]], n: add(mul(ex, n2[0]), mul(ey, n2[1])) });
      });
    };
    sides(outer, false);
    holes.forEach((h) => sides(h, true));
    return solidFrom(F);
  }
  const circle = (cx, cy, r, n) => { const out = []; n = n || 16; for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; };
  const rect2 = (w, l) => [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]];

  /* šestistěn z 8 bodů (spodní 4 + horní 4) – kontext (deska, fasáda) */
  function hexa(p) {
    const q = [p[0], p[1], p[2], p[3]], u = [p[4], p[5], p[6], p[7]];
    const c = mul(p.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / 8);
    const face = (loop) => { let n = cross(sub(loop[1], loop[0]), sub(loop[2], loop[0])); const m = mul(loop.reduce((a, b) => add(a, b), [0, 0, 0]), 0.25); if (dot(n, sub(m, c)) < 0) n = mul(n, -1); return { loops: [loop], n }; };
    return solidFrom([face(q), face(u), face([q[0], q[1], u[1], u[0]]), face([q[1], q[2], u[2], u[1]]), face([q[2], q[3], u[3], u[2]]), face([q[3], q[0], u[0], u[3]])]);
  }

  function volume(s) {
    let v = 0;
    s.faces.forEach((f) => {
      const P = s.verts, p0 = P[f.outer[0]];
      const nw = (lp) => { const n = [0, 0, 0]; lp.forEach((a, i) => { const A = P[a], B = P[lp[(i + 1) % lp.length]]; n[0] += (A[1] - B[1]) * (A[2] + B[2]); n[1] += (A[2] - B[2]) * (A[0] + B[0]); n[2] += (A[0] - B[0]) * (A[1] + B[1]); }); return n; };
      const no = nw(f.outer), so = dot(no, f.n) < 0 ? -1 : 1;
      v += so * dot(p0, no) / 6;
      f.inner.forEach((lp) => { const ni = nw(lp), si = dot(ni, f.n) > 0 ? -1 : 1; v += si * dot(p0, ni) / 6; });
    });
    return Math.abs(v);
  }

  /* ---------- volby ---------- */
  const TUBE_R = 2.4;                           // rádius rohu jeklu ~2,4 t (stejně jako core.js u zámků podnoží)
  const flatFace = (s, t) => s - 2 * TUBE_R * t;
  const TYPES = [                                 // jen pro staré poptávky a popis; zákazník volí sloupky ano/ne
    { id: 'A', lab: 'Se sloupky', sub: 'vzor 01 · madla z jeklu', icon: 'M4 8 H60 M4 40 H60 M4 8 V40 M60 8 V40 M32 8 V40 M12 8 V40 M18 8 V40 M24 8 V40 M40 8 V40 M46 8 V40 M52 8 V40' },
    { id: 'B', lab: 'Bez sloupků', sub: 'vzor 02 · dřevěné madlo', icon: 'M2 5 H62 M2 10 H62 M4 10 V40 M4 40 H60 M60 10 V40 M12 10 V46 M20 10 V46 M28 10 V46 M36 10 V46 M44 10 V46 M52 10 V46' }
  ];
  /* rám: w = šířka napříč zábradlím (stěna, do které jdou špruše), h = výška průřezu, t = stěna; ins = vložka styku polí (jen typ B) */
  const RAILS = {
    A: [{ id: '40x40x2', w: 40, h: 40, s: 40, t: 2, lab: '40×40×2', sub: 'vzor 01' }, { id: '50x50x2', w: 50, h: 50, s: 50, t: 2, lab: '50×50×2', sub: 'mohutnější' }],
    B: [{ id: '40x20x3', w: 40, h: 20, t: 3, ins: [30, 10, 2], lab: '40×20×3 naplocho', sub: 'vzor 02' }, { id: '60x30x3', w: 60, h: 30, t: 3, ins: [50, 20, 2], lab: '60×30×3 naplocho', sub: 'mohutnější' },
        { id: '40x40x2', w: 40, h: 40, t: 2, ins: [30, 30, 2], lab: '40×40×2', sub: 'čtvercový' }, { id: '50x50x2', w: 50, h: 50, t: 2, ins: [40, 40, 2], lab: '50×50×2', sub: 'čtvercový, mohutnější' }]
  };
  /* špruše (pásovina): w = šířka napříč zábradlím, t = tloušťka podél zábradlí */
  const BARS = [
    { id: '20x5', w: 20, t: 5, lab: 'PL 20×5', sub: 'nejsubtilnější' },
    { id: '25x5', w: 25, t: 5, lab: 'PL 25×5', sub: 'subtilnější' },
    { id: '35x5', w: 35, t: 5, lab: 'PL 35×5', sub: 'vzor 01' },
    { id: '40x8', w: 40, t: 8, lab: 'PL 40×8', sub: '' },
    { id: '40x10', w: 40, t: 10, lab: 'PL 40×10', sub: 'vzor 02' },
    { id: '50x10', w: 50, t: 10, lab: 'PL 50×10', sub: 'výraznější' },
    { id: '60x10', w: 60, t: 10, lab: 'PL 60×10', sub: 'nejmohutnější' }
  ];
  const JOINS = [
    { id: 'tupo', lab: 'Na tupo', sub: 'řez na pile, bez zámků' },
    { id: 'zamek', lab: 'Zámečky', sub: 'konec zúžený do drážky, bez měření · příplatek' }
  ];
  const PROF_A = RAILS.A, BAR_A = BARS;          // starší názvy (uložené poptávky, testy)
  const FIN = [
    { id: 'zn', lab: 'Žárový zinek', sub: 'bez barvy', sw: '#A7ADB1' },
    { id: 'znpu', lab: 'Zinek + PU lak', sub: 'vzor 02', sw: '#959CA1' },
    { id: 'prasek', lab: 'Prášková barva', sub: 'RAL 7016', sw: '#383E45' },
    { id: 'duplex', lab: 'Zinek + barva', sub: 'duplex RAL 7016', sw: '#3E444B' }
  ];
  const ANCHOR = [
    { id: 'bocni', lab: 'Z boku', sub: 'do čela desky, i přes zateplení' },
    { id: 'patka', lab: 'Shora', sub: 'patky pod sloupky na podlahu i na stupně' },
    { id: 'celo', lab: 'Sloupky přes čelo', sub: 'sloupek dolů přes hranu, plotna do čela' },
    { id: 'bez', lab: 'Bez kotev', sub: 'kotvení řeším sám' }
  ];
  const WALL_BASE = [
    { id: 'zdivo', lab: 'Zeď – zdivo', sub: 'chemická kotva se sítkem' },
    { id: 'beton', lab: 'Zeď – beton', sub: 'chemická kotva M12' }
  ];
  /* kotvení – pevné rozměry (mm) */
  const PAD_T = 10;                              // tepelně oddělující podložka pod plotnu (na čele a na zdi)
  const PATKA_STAIR_GAP = 40;                    // na schodišti: spodní rám nad čarou hran stupňů (patky stojí na stupních)
  const CELO_CORNER = 450;                       // sloupky přes čelo: kotevní sloupek u rohu / zlomu (do rohu z boku kotvit nejde)
  const CELO_PLATE = { w: 120, l: 100, t: 10, drop: 25 };   // plotna na boku sloupku; horní hrana 25 mm pod podlahou / stupněm
  const ZED_PLATE = { w: 120, l: 100, t: 10 };   // plotna ke zdi na koncovém sloupku (mezera ke zdi 20 = plotna 10 + podložka / vyrovnání 10)
  const BASE = [
    { id: 'beton', lab: 'Beton', sub: 'chemická kotva M12' },
    { id: 'zdivo', lab: 'Zdivo', sub: 'chemická kotva se sítkem' },
    { id: 'ocel', lab: 'Ocel', sub: 'šrouby M12' }
  ];
  const SERVICES = [
    { id: 'zamereni', lab: 'Zaměření na místě', sub: 'změříme a rozměry potvrdíme před výrobou' },
    { id: 'kotveni', lab: 'Pomoc s kotvením', sub: 'posoudíme podklad a navrhneme kotvy' },
    { id: 'montaz', lab: 'Montáž', sub: 'osadíme a ukotvíme' }
  ];
  /* zatočení = změna směru (kladně vlevo). Vlastní úhel: vnitřní úhel rohu 60–179°, tedy změna směru nejvýš ±120°,
     ostřejší roh by dal pokosy přes 60° (dlouhé, slabé spoje). Zaokrouhleno na 0,5°. */
  const TURN_MAX = 120;
  const normTurn = (v) => { const n = Number(v); return isFinite(n) ? Math.round(Math.max(-TURN_MAX, Math.min(TURN_MAX, n)) * 2) / 2 : 0; };
  const TURNS = [{ v: 0, lab: 'rovně' }, { v: 90, lab: 'vlevo 90°' }, { v: -90, lab: 'vpravo 90°' }, { v: 45, lab: 'vlevo 45°' }, { v: -45, lab: 'vpravo 45°' }];
  const PRESETS = [
    { id: 'rovne', lab: 'Rovné', icon: 'M6 24 H58', segs: [{ L: 3000, rise: 0 }] },
    { id: 'L', lab: 'Roh L', icon: 'M6 40 H44 V8', segs: [{ L: 4500, rise: 0, turn: 90 }, { L: 3000, rise: 0 }] },
    { id: 'U', lab: 'Balkon U', icon: 'M10 8 V40 H54 V8', segs: [{ L: 1500, rise: 0, turn: 90 }, { L: 3000, rise: 0, turn: 90 }, { L: 1500, rise: 0 }] },
    { id: 'schody', lab: 'Schodiště', icon: 'M6 42 L58 10', segs: [{ L: 3000, rise: 1800 }] },
    { id: 'schodypod', lab: 'Schody + podesta', icon: 'M4 44 L28 20 H46 V6', segs: [{ L: 2380, rise: 2000 }, { L: 4500, rise: 0, turn: 90 }, { L: 3000, rise: 0 }] }
  ];
  const DEFAULT_CFG = {
    typ: 'B', segs: PRESETS[4].segs.map((s) => Object.assign({ turn: 0 }, s)), vyska: 1000, side: 'L',
    vypln: 'standard', motifPitch: 250,
    rail: null, bar: null, join: 'tupo', overTop: null, overBot: null,       // null = výchozí podle typu
    sloupky: null, postPitch: 1000, madlo: true, anchor: 'bocni', base: 'beton', facade: 200, arm: 250, kotvyRoztec: null, kotvyPos: null,
    zed: { start: false, end: false }, zedBase: 'zdivo', podlozka: false,
    fin: 'znpu', services: { zamereni: true, kotveni: false, montaz: false }, qty: 1
  };
  const DEFAULT_RATES = {
    kg: 42, rez: 35, svar: 90, drazka: 15, zinek: 28, lak: 180, prasek: 280, madlo: 1150, priprava: 1500, marze: 35,
    kotva: { beton: 190, zdivo: 260, ocel: 90 }, zamereni: 1500, kotveni: 1200, montazM: 950, montazKotva: 150, slotClear: 0.5,
    zamekSpruse: 45,
    podlozka: 220,                               // tepelně oddělující podložka pod plotnu – Kč/ks, orientačně                             // vyřezání zámečku na konci špruše (pila to neumí) – Kč/ks, orientačně
    // kotvy – meze nastavuje dílna (zatím výchozí odhad, NE statický výpočet): mezera mezi kotvami a přesah konce za poslední kotvu [mm]
    kotvaMax: 1500, kotvaDop: 1200, kotvaKonecMax: 600, kotvaKonecDop: 400,
    // řezný plán – nastavuje dílna (výchozí odhad): délka tyče, prořez pily, řez a nevyužitelný konec tyče na K2 (upínač) [mm]
    tycDelka: 6000, prorezPila: 3, prorezK2: 1, zbytekK2: 120
  };
  const OVER_MAX = 400, POST_MIN = 600, POST_MAX = 1500;
  const rates0 = (r) => { const R = Object.assign({}, DEFAULT_RATES, r || {}); R.kotva = Object.assign({}, DEFAULT_RATES.kotva, (r && r.kotva) || {}); return R; };

  const num = (v, a, b, d) => { const n = Number(v); return isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  const pick = (list, v, d) => (list.some((x) => (x.id != null ? x.id : x.v) === v) ? v : d);
  function normalize(c) {
    c = Object.assign({}, DEFAULT_CFG, c || {});
    const o = {};
    o.vypln = c.vypln === 'geometricky' ? 'geometricky' : 'standard';
    // jeden typ zábradlí: sloupky ano/ne (interně typ A = se sloupky, B = pole bez sloupků – kvůli uloženým poptávkám)
    o.sloupky = o.vypln === 'geometricky' ? true : c.sloupky != null ? !!c.sloupky : c.typ === 'A';
    o.typ = o.sloupky ? 'A' : 'B';
    o.postPitch = Math.round(num(c.postPitch, POST_MIN, POST_MAX, 1000));
    o.motifPitch = Math.round(num(c.motifPitch, 150, 400, 250));
    let segs = Array.isArray(c.segs) && c.segs.length ? c.segs.slice(0, 8) : DEFAULT_CFG.segs;
    o.segs = segs.map((s, i) => {
      const L = Math.round(num(s.L, 300, 12000, 3000));
      const rise = Math.round(num(s.rise, -L, L, 0));                 // max. sklon 45°
      const o2 = { L, rise, turn: i < segs.length - 1 ? normTurn(s.turn) : 0 };
      if (o2.turn && (s.custom || !TURNS.some((t) => t.v === o2.turn))) o2.custom = true;
      if (rise && s.steps) o2.steps = Math.round(num(s.steps, 2, 40, 2));      // počet stupňů – jen pro náhled stavby
      return o2;
    });
    o.vyska = Math.round(num(c.vyska, 900, 1200, 1000));
    o.stavba = normStavba(c.stavba);
    if (o.stavba && o.stavba.on) o.segs = stavbaSegs(o.stavba);           // trasa ze stavby, kterou zákazník poskládal a změřil
    o.side = c.side === 'R' ? 'R' : 'L';
    const rl = RAILS[o.typ];
    o.rail = pick(rl, c.rail != null ? c.rail : (o.typ === 'A' ? c.profA : null), rl[0].id);
    o.bar = pick(BARS, c.bar != null ? c.bar : (o.typ === 'A' ? c.barA : null), o.typ === 'A' ? '35x5' : '40x10');
    o.join = c.join === 'zamek' ? 'zamek' : 'tupo';
    o.madlo = c.madlo !== false;                 // true = dřevěné madlo navrch, false = horní rám je madlo
    o.anchor = pick(ANCHOR, c.anchor, 'bocni');
    if (o.vypln === 'geometricky') o.anchor = 'patka';
    if ((o.anchor === 'patka' || o.anchor === 'celo') && !o.sloupky) o.anchor = 'bocni';      // patky i čelo jsou pod sloupky
    // konce přikotvené ke zdi; podle stavby jen tam, kde zábradlí opravdu končí u zdi
    const zd = c.zed || {}, stOn = o.stavba && o.stavba.on;
    o.zed = { start: !!zd.start && (!stOn || o.stavba.start === 'zed'), end: !!zd.end && (!stOn || o.stavba.end === 'zed') };
    o.zedBase = pick(WALL_BASE, c.zedBase, 'zdivo');
    o.podlozka = !!c.podlozka;
    // přesah špruší: nahoru jen bez dřevěného madla (to leží na horním rámu), dolů jen když spodní rám není na podlaze
    const ov = overAllowed(o);
    o.overTop = ov.top ? Math.round(c.overTop == null ? 0 : num(c.overTop, 0, OVER_MAX, 0)) : 0;
    o.overBot = ov.bot ? Math.round(c.overBot == null ? (o.typ === 'B' ? 150 : 0) : num(c.overBot, 0, OVER_MAX, 0)) : 0;
    o.base = pick(BASE, c.base, 'beton');
    o.facade = Math.round(num(c.facade, 0, 400, 200));
    o.arm = Math.round(num(c.arm, 60, 600, o.facade + 50));
    o.fin = pick(FIN, c.fin, 'znpu');
    o.kotvyRoztec = c.kotvyRoztec == null || c.kotvyRoztec === '' ? null : Math.round(num(c.kotvyRoztec, 300, 3000, 1000));
    o.kotvyPos = Array.isArray(c.kotvyPos) && c.kotvyPos.length ? c.kotvyPos.map(Number).filter(isFinite).map(Math.round).sort((a, b) => a - b).slice(0, 120) : null;
    const sv = c.services || {};
    o.services = { zamereni: !!sv.zamereni, kotveni: !!sv.kotveni, montaz: !!sv.montaz };
    o.qty = Math.round(num(c.qty, 1, 20, 1));
    return o;
  }
  const patkaAllowed = (cfg) => !!cfg.sloupky;       // patky i sloupky přes čelo – jen se sloupky (i na schodišti)
  const wallAllowed = (cfg) => cfg.anchor !== 'bez';
  const padAllowed = (cfg) => cfg.anchor === 'bocni' || cfg.anchor === 'celo' || (wallAllowed(cfg) && (cfg.zed.start || cfg.zed.end));
  /* úseky schodiště, u kterých chybí počet schodů – patky stojí na stupních / plotna jde pod stupně, bez schodů je neumístíme */
  const stepsMissing = (cfg) => cfg.vypln === 'geometricky' ? [] : (cfg.anchor === 'patka' || cfg.anchor === 'celo') ? cfg.segs.map((s, i) => (s.rise && !s.steps ? i : -1)).filter((i) => i >= 0) : [];
  const stepsOf = (s) => (s.rise ? s.steps || Math.max(2, Math.round(Math.abs(s.rise) / 175) + 1) : null);
  /* ======================================================================
     STAVBA Z BLOKŮ – zákazník poskládá, jak to u něj vypadá, a změří ji. Z bloků se spočítá trasa zábradlí.
     Každý rozměr se měří dvakrát jinou cestou, aby šla chyba chytit:
       rovná hrana  A = délka po čele desky, B = totéž změřené znovu od druhého konce (má vyjít ±10 mm)
       roh          na obou hranách 1 m od rohu značka, C = vzdálenost značek → úhel (pravý roh = 1 414 mm)
       schodiště    n = počet schodů (výšek), h = výška schodu, g = hloubka schodu,
                    H = celé převýšení (kontrola n × h), D = vodorovná délka od první k poslední hraně (kontrola (n−1) × g)
     Zábradlí na schodech vede po čáře hran schodů (od hrany prvního schodu k hraně podesty).
     ====================================================================== */
  const WALL_GAP = 20;                          // mezera zábradlí od zdi
  const MARK = 1000;                            // značky 1 m od rohu
  const nn = (v, a, b) => (v == null || v === '' || !isFinite(Number(v)) ? null : Math.round(Math.min(b, Math.max(a, Number(v)))));
  function normStavba(st) {
    if (!st || typeof st !== 'object') return null;
    const bl = (Array.isArray(st.bloky) ? st.bloky : []).slice(0, 8).map((b, i, arr) => {
      const turn = i < arr.length - 1 ? normTurn(b.turn) : 0, custom = !!turn && (!!b.custom || !TURNS.some((t) => t.v === turn));
      if (b.t === 'schody') return { t: 'schody', n: nn(b.n, 2, 40), h: nn(b.h, 50, 300), g: nn(b.g, 100, 500), H: nn(b.H, 100, 8000), D: nn(b.D, 100, 15000), dir: b.dir === 'dolu' ? 'dolu' : 'nahoru', turn, custom };
      return { t: 'hrana', A: nn(b.A, 1, 15000), B: nn(b.B, 1, 15000), turn, custom, C: nn(b.C, 1, 2000) };
    });
    return { on: !!st.on, bloky: bl.length ? bl : [{ t: 'hrana', A: null, B: null, turn: 0, C: null }],
      start: st.start === 'zed' ? 'zed' : 'volny', end: st.end === 'zed' ? 'zed' : 'volny', deska: nn(st.deska, 50, 600) };
  }
  const stairDims = (b) => {                    // efektivní výška a hloubka schodu (celkové míry mají přednost – jedno měření místo součtu)
    const h = b.n && b.H ? b.H / b.n : b.h || 175, g = b.n && b.D && b.n > 1 ? b.D / (b.n - 1) : b.g || 280;
    return { n: b.n || 10, h, g };
  };
  function stavbaSegs(st) {
    const bl = st.bloky;
    return bl.map((b, i) => {
      if (b.t === 'schody') {
        const d = stairDims(b), sg = b.dir === 'dolu' ? -1 : 1;
        return { L: Math.max(300, Math.round((d.n - 1) * d.g)), rise: sg * Math.round((d.n - 1) * d.h), turn: b.turn, custom: b.custom, steps: d.n };
      }
      let L = b.A && b.B ? (b.A + b.B) / 2 : b.A || b.B || 1000;
      if (i === 0 && st.start === 'zed') L -= WALL_GAP;
      if (i === bl.length - 1 && st.end === 'zed') L -= WALL_GAP;
      return { L: Math.max(300, Math.round(L)), rise: 0, turn: b.turn, custom: b.custom };
    });
  }
  /* co chybí změřit (nejde poptat) a co přeměřit (varování) */
  function stavbaCheck(cfg) {
    const st = cfg.stavba, missing = [], remeasure = [];
    if (!st || !st.on) return { missing, remeasure, on: false };
    const bl = st.bloky, lab = (i) => 'Blok ' + (i + 1) + ' (' + (bl[i].t === 'schody' ? 'schodiště' : 'rovná hrana') + ')';
    bl.forEach((b, i) => {
      if (b.t === 'hrana') {
        if (b.A == null) missing.push({ i, k: 'A', t: lab(i) + ': délka hrany A' });
        if (b.B == null) missing.push({ i, k: 'B', t: lab(i) + ': kontrolní délka B (změřte znovu od druhého konce)' });
        if (b.A != null && b.B != null && Math.abs(b.A - b.B) > 10) remeasure.push({ i, k: 'A', t: lab(i) + ': A a B se liší o ' + nf(Math.abs(b.A - b.B)) + ' mm – přeměřte, má vyjít stejně (±10 mm).' });
        [['A', b.A], ['B', b.B]].forEach(([k, v]) => { if (v != null && v < 300) remeasure.push({ i, k, t: lab(i) + ': ' + k + ' = ' + v + ' mm je méně než 30 cm – nezadali jste centimetry? Vše se zadává v milimetrech.' }); });
      } else {
        if (b.n == null) missing.push({ i, k: 'n', t: lab(i) + ': počet schodů n' });
        if (b.h == null && b.H == null) missing.push({ i, k: 'h', t: lab(i) + ': výška schodu h' });
        if (b.g == null && b.D == null) missing.push({ i, k: 'g', t: lab(i) + ': hloubka schodu g' });
        if (b.H == null) remeasure.push({ i, k: 'H', lvl: 'info', t: lab(i) + ': doporučujeme změřit i celé převýšení H – zkontroluje počet schodů.' });
        if (b.h != null && (b.h < 140 || b.h > 210)) remeasure.push({ i, k: 'h', t: lab(i) + ': výška schodu ' + b.h + ' mm je neobvyklá (běžně 150–200 mm) – přeměřte svisle od jednoho schodu k druhému.' });
        if (b.g != null && (b.g < 220 || b.g > 350)) remeasure.push({ i, k: 'g', t: lab(i) + ': hloubka schodu ' + b.g + ' mm je neobvyklá (běžně 250–320 mm) – měřte vodorovně od hrany schodu k hraně dalšího.' });
        if (b.n && b.h && b.H && Math.abs(b.n * b.h - b.H) > 15) remeasure.push({ i, k: 'H', t: lab(i) + ': ' + b.n + ' schodů × ' + b.h + ' mm = ' + nf(b.n * b.h) + ' mm, ale převýšení H je ' + nf(b.H) + ' mm – spočítejte schody znovu, nebo přeměřte výšku schodu.' });
        if (b.n > 1 && b.g && b.D && Math.abs((b.n - 1) * b.g - b.D) > 20) remeasure.push({ i, k: 'D', t: lab(i) + ': ' + (b.n - 1) + ' × ' + b.g + ' mm = ' + nf((b.n - 1) * b.g) + ' mm, ale délka D je ' + nf(b.D) + ' mm – přeměřte.' });
      }
      // roh mezi dvěma rovnými hranami: kontrola úhlu úhlopříčkou mezi značkami 1 m od rohu
      if (i < bl.length - 1 && b.turn && b.t === 'hrana' && bl[i + 1].t === 'hrana') {
        const want = 180 - Math.abs(b.turn), cw = Math.round(2 * MARK * Math.sin(want / 2 / DEG));
        if (b.C == null) missing.push({ i, k: 'C', t: 'Roh za blokem ' + (i + 1) + ': úhlopříčka C mezi značkami 1 m od rohu (u tohoto rohu má vyjít ' + nf(cw) + ' mm)' });
        else {
          const ang = 2 * Math.asin(Math.min(1, b.C / (2 * MARK))) * DEG, dev = ang - want;
          if (Math.abs(dev) > 1.5) remeasure.push({ i, k: 'C', lvl: Math.abs(dev) > 10 ? 'bad' : 'warn', t: 'Roh za blokem ' + (i + 1) + ': podle úhlopříčky má roh ' + nf(ang, 1) + '° místo ' + want + '° (C má být ' + nf(cw) + ' mm). ' + (Math.abs(dev) > 10 ? 'To je spíš jiný roh, než jste vybrali – zkontrolujte směr zatočení a přeměřte. Pokud míra platí, převezměte změřený úhel (tlačítko u rohu).' : 'Přeměřte; pokud to platí, převezměte změřený úhel (tlačítko u rohu).'), ang: Math.round(ang * 2) / 2 });
        }
      }
    });
    if (cfg.anchor === 'bocni' || cfg.anchor === 'celo') {
      if (st.deska == null) missing.push({ i: -1, k: 'deska', t: 'Tloušťka nosné desky (čelo betonu bez zateplení) – do ní jdou kotvy' });
      else if (st.deska < 150) remeasure.push({ i: -1, k: 'deska', t: 'Deska ' + st.deska + ' mm je tenká – kotva M12 potřebuje aspoň 150 mm betonu. Přidejte pomoc s kotvením, nebo zvolte kotvení shora.' });
      else if (cfg.anchor === 'celo' && st.deska < 200 && cfg.segs.some((s) => s.rise)) remeasure.push({ i: -1, k: 'deska', lvl: 'info', t: 'U schodiště se plotna dává pod stupně – ověřte, že je pod nimi aspoň 150 mm betonu.' });
    }
    return { missing, remeasure, on: true };
  }

  function overAllowed(cfg) {
    const top = !cfg.madlo, bot = cfg.typ === 'B' || cfg.anchor === 'bocni' || cfg.anchor === 'celo';
    return { top, bot,
      whyTop: top ? '' : 'Nahoru jen bez dřevěného madla – madlo leží na horním rámu.',
      whyBot: bot ? '' : 'Dolů jen při kotvení z boku nebo přes čelo – jinak je spodní rám u podlahy a špruše by do ní narazila.' };
  }

  /* trasa: body čáry podlahy (začátek v počátku, první úsek ve směru +X) */
  function routePoints(segs) {
    const pts = [[0, 0, 0]];
    let a = 0;
    segs.forEach((s, i) => {
      const p = pts[pts.length - 1];
      pts.push([p[0] + Math.cos(a) * s.L, p[1] + Math.sin(a) * s.L, p[2] + s.rise]);
      if (i < segs.length - 1) a += (s.turn || 0) / DEG;
    });
    return pts;
  }

  /* ======================================================================
     KOTVY – poloha s = délka podél osy rámu od začátku zábradlí (na schodišti po sklonu).
     Každá layout funkce dá seznam povolených míst (cand): u bočního kotvení středy mezer mezi špruše
     (rameno nesmí narazit do špruše), u sloupků i pod sloupky; mimo rohy, styky polí a konce.
     Kotva zadaná rukou se vždy přichytí na nejbližší povolené místo – na zakázané místo ji dát nejde.
     ====================================================================== */
  function snapAnchors(cand, want) {
    const used = [];
    want.forEach((w) => {
      let best = null;
      cand.forEach((c) => { if (used.indexOf(c) < 0 && (best === null || Math.abs(c - w) < Math.abs(best - w))) best = c; });
      if (best !== null) used.push(best);
    });
    return used.sort((x, y) => x - y);
  }
  function autoAnchors(cand, total, r, groups) {
    const n = Math.max(1, Math.ceil(total / r - 1e-9)), want = [];
    for (let i = 0; i < n; i++) want.push(total * (i + 0.5) / n);
    const used = snapAnchors(cand, want);
    (groups || []).forEach((g) => {                 // každé pole aspoň jednu kotvu
      if (used.some((u) => g.s0 < u && u < g.s1)) return;
      const inG = cand.filter((c) => g.s0 < c && c < g.s1 && used.indexOf(c) < 0), mid = (g.s0 + g.s1) / 2;
      if (inG.length) used.push(inG.reduce((b, x) => (Math.abs(x - mid) < Math.abs(b - mid) ? x : b)));
    });
    return used.sort((x, y) => x - y);
  }

  /* ======================================================================
     ŠPRUŠE – společné pro oba typy. Jedna svislá špruše mezi horním a spodním rámem.
       o.aT / o.aB  body na ose horního / spodního rámu ve svislé ose špruše
       o.u          normála „nahoru“ rámu (na schodišti šikmo), o.h půlka výšky průřezu rámu, o.t stěna rámu
       o.e1         napříč zábradlím (šířka špruše o.w), o.e2 podél zábradlí (tloušťka o.bt)
       o.mode       'drazka' – špruše se vejde do rovné části stěny: projde drážkou, s přesahem skrz rám jedním kusem
                    'tupo'   – na tupo na povrch rámu, přesah je samostatný kus
                    'zamek'  – jako tupo, ale každý konec u rámu má zámeček o.tw zanořený přes stěnu (lícuje s vnitřkem stěny)
       o.top/o.bot  člen horního / spodního rámu (dostane drážky: '-e2' spodní stěna, '+e2' horní stěna)
     ====================================================================== */
  function barSet(out, o) {
    const u = o.u, h = o.h, c = o.clear;
    const P = (pt, k) => ({ p: add(pt, mul(u, k)), n: u });
    const Hz = (pt) => ({ p: pt, n: Z });
    const slot = (rail, wall, ctr, hw) => {
      if (!rail) return;
      rail.holes.push({ wall, dir: Z, pts: [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, y]) => add(add(ctr, mul(o.e1, x * (hw + c))), mul(o.e2, y * (o.bt / 2 + c)))) });
    };
    const sl = o.sloped ? ' šikmá' : '';
    const piece = (role, name, c0, c1, tab0, tab1) => {
      const p0 = hit(o.aT, Z, c0);
      const m = { kind: 'bar', role, name: name + sl + (tab0 || tab1 ? ' se zámečky' : ''), prof: o.prof, p0, d: Z, e1: o.e1, e2: o.e2, h1: o.w / 2, h2: o.bt / 2, t: 0,
        cut0: c0, cut1: c1, holes: [], a1: cutAngle(Z, c0.n), a2: cutAngle(Z, c1.n) };
      if (tab0 || tab1) { m.tab0 = tab0 || null; m.tab1 = tab1 || null; m.tw = o.tw; m.tabs = (tab0 ? 1 : 0) + (tab1 ? 1 : 0); }
      m.L = extent(p0, Z, o.e1, o.e2, o.w / 2, o.bt / 2, tab0 || c0, tab1 || c1);
      out.push(m);
      return m;
    };
    const below = { p: sub(add(o.aB, mul(u, -h)), mul(Z, o.overBot)), n: u };
    const above = { p: add(add(o.aT, mul(u, h)), mul(Z, o.overTop)), n: u };
    if (o.mode === 'drazka') {
      const hw = o.w / 2;
      let c0, c1;
      if (o.overBot > 0) { c0 = below; slot(o.bot, '+e2', o.aB, hw); slot(o.bot, '-e2', o.aB, hw); } else { c0 = Hz(o.aB); slot(o.bot, '+e2', o.aB, hw); }
      if (o.overTop > 0) { c1 = above; slot(o.top, '-e2', o.aT, hw); slot(o.top, '+e2', o.aT, hw); } else { c1 = Hz(o.aT); slot(o.top, '-e2', o.aT, hw); }
      piece('bar', 'špruše', c0, c1);
      return;
    }
    const zm = o.mode === 'zamek', ti = h - o.t, hw = o.tw / 2;
    piece('bar', 'špruše', P(o.aB, h), P(o.aT, -h), zm ? P(o.aB, ti) : null, zm ? P(o.aT, -ti) : null);
    if (zm) { slot(o.bot, '+e2', o.aB, hw); slot(o.top, '-e2', o.aT, hw); }
    if (o.overBot > 0) { piece('over', 'přesah špruše dole', below, P(o.aB, -h), null, zm ? P(o.aB, -ti) : null); if (zm) slot(o.bot, '-e2', o.aB, hw); }
    if (o.overTop > 0) { piece('overtop', 'přesah špruše nahoře', P(o.aT, h), above, zm ? P(o.aT, ti) : null, null); if (zm) slot(o.top, '+e2', o.aT, hw); }
  }

  /* ======================================================================
     TYP A – vzor akce 01 (port railing.py). path = osa HORNÍHO madla.
     ====================================================================== */
  const STD_A = {
    tube: 40, wall: 2, rail_spacing: 1000, bar_w: 35, bar_t: 5, pitch_flat: 111, pitch_slope: 118, min_end_gap: 60,
    post_max_flat: 1000, post_max_slope: 1350, slope_tol: 1, handrail: false, handrail_w: 60, handrail_h: 40, locks: false, slot_clear: 0.5, joint: null, tab_w: 0, over_top: 0, over_bot: 0,
    anchor: 'bez', side: 1, arm_len: 250, plate_t: 10, plate: 120, rod_len: 150, rod_spacing: 70,
    patka: { w: 100, l: 120, t: 8 }, patka_long: 160,
    floor_off: null, seg_steps: null, celo_corner: CELO_CORNER, pad: 0, zed: null
  };
  function layoutA(path, kw) {
    const P = Object.assign({}, STD_A, kw || {});
    const a = P.tube / 2, H = P.rail_spacing, T = P.wall;
    const joint = P.joint || (P.locks ? 'drazka' : 'tupo');
    const pts = path.map((p) => [p[0], p[1], p[2] || 0]);
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const d = unit(sub(pts[i + 1], pts[i])), slope = Math.asin(Math.min(1, Math.abs(d[2]))) * DEG;
      segs.push(Object.assign({ i, p0: pts[i], p1: pts[i + 1], d, slope, sloped: slope > P.slope_tol }, frameOf(d)));
    }
    let acc = 0;
    segs.forEach((s) => { s.s0 = acc; s.L = len(sub(s.p1, s.p0)); acc += s.L; });
    const total = acc, sOf = (k, p) => segs[k].s0 + dot(sub(p, segs[k].p0), segs[k].d);
    const prof = 'jekl ' + P.tube + '×' + P.tube + '×' + T, profB = 'PL ' + P.bar_w + '×' + P.bar_t;
    const members = [], fields = [];
    const offZ = (level) => mul(Z, -H * level);

    function endPlane(k, atStart, level) {
      const s = segs[k], off = offZ(level);
      if (atStart && k > 0) return { p: add(s.p0, off), n: unit(add(segs[k - 1].d, s.d)) };
      if (!atStart && k < segs.length - 1) return { p: add(s.p1, off), n: unit(add(s.d, segs[k + 1].d)) };
      const v = add(atStart ? s.p0 : s.p1, off), out = atStart ? mul(s.d, -1) : s.d, hz = hproj(out);
      const uo = level === 0 ? s.up : mul(s.up, -1);
      const corners = [1, -1].map((e) => {
        const rhs = mul(sub(hz, uo), e * a);
        const sol = dot(rhs, hz) / dot(out, hz);
        return add(add(v, mul(out, sol)), mul(uo, e * a));
      });
      let n = unit(cross(s.w, sub(corners[0], corners[1])));
      if (dot(n, out) < 0) n = mul(n, -1);
      return { p: v, n, outer: corners[0], inner: corners[1] };
    }

    // madla
    const rails = {};
    segs.forEach((s, k) => [[0, P.handrail ? 'horní rám' : 'horní madlo'], [1, P.handrail ? 'spodní rám' : 'spodní madlo']].forEach(([level, nm]) => {
      const off = offZ(level), c0 = endPlane(k, true, level), c1 = endPlane(k, false, level);
      const m = { kind: 'tube', role: 'rail', name: nm + (s.sloped ? ' šikmé' : ''), prof, p0: add(s.p0, off), d: s.d, e1: s.w, e2: s.up, h1: a, h2: a, t: T,
        cut0: { p: c0.p, n: c0.n }, cut1: { p: c1.p, n: c1.n }, holes: [], seg: k, level };
      m.L = extent(m.p0, m.d, m.e1, m.e2, a, a, m.cut0, m.cut1); m.a1 = cutAngle(s.d, c0.n); m.a2 = cutAngle(s.d, c1.n);
      rails[k + '_' + level] = m; members.push(m);
    }));

    // koncové sloupky (plná výška, pokos s madly)
    [[true, 0], [false, segs.length - 1]].forEach(([atStart, k]) => {
      const s = segs[k], v = atStart ? s.p0 : s.p1, out = atStart ? mul(s.d, -1) : s.d;
      const top = endPlane(k, atStart, 0), bot = endPlane(k, atStart, 1), hz = hproj(out), pw = unit(cross(Z, hz));
      const m = { kind: 'tube', role: 'end_post', name: 'koncový sloupek', prof, p0: sub(v, mul(Z, H)), d: Z, e1: pw, e2: hz, h1: a, h2: a, t: T,
        cut0: { p: bot.p, n: mul(bot.n, -1) }, cut1: { p: top.p, n: mul(top.n, -1) }, holes: [] };
      m.L = extent(m.p0, Z, pw, hz, a, a, m.cut0, m.cut1); m.a1 = cutAngle(Z, bot.n); m.a2 = cutAngle(Z, top.n);
      members.push(m);
    });

    // sloupky mezi madly: rohy / zlomy + mezilehlé
    const postPos = [];
    for (let k = 1; k < segs.length; k++) postPos.push({ pt: segs[k].p0, hz: hproj(segs[k].d), label: 'rohový sloupek', corner: k, s: segs[k].s0 });
    const nSteps = (k) => (P.seg_steps && P.seg_steps[k]) || 0;
    /* rozdělení úseku sloupky (zlomky délky 0…1):
         běžně rovnoměrně po nejvýš mx,
         patky na schodišti – sloupky doprostřed stupňů (patka musí celá stát na stupni),
         sloupky přes čelo – u každého rohu / zlomu navíc kotevní sloupek CELO_CORNER od něj (do rohu se z boku kotvit nedá). */
    function segFracs(k) {
      const s = segs[k], L = s.L, mx = s.sloped ? P.post_max_slope : P.post_max_flat;
      const even = (a, b) => { const n = Math.max(1, Math.ceil((b - a) / mx - 1e-6)), out = []; for (let j = 1; j < n; j++) out.push(a + (b - a) * j / n); return out; };
      if (P.anchor === 'celo') {
        const off = P.celo_corner / Math.cos(s.slope / DEG), sv = k > 0, ev = k < segs.length - 1;
        const a0 = sv ? off : 0, a1 = ev ? L - off : L;
        let pts;
        if (!sv && !ev) pts = even(0, L);
        else if (a1 - a0 >= 300) pts = (sv ? [a0] : []).concat(even(a0, a1), ev ? [a1] : []);
        else pts = L >= 600 ? [L / 2] : [];
        return [0].concat(pts.map((x) => x / L), [1]);
      }
      const nt = nSteps(k) - 1;
      if (P.anchor === 'patka' && s.sloped && nt >= 1) {
        const snap = (nfi) => {
          const out = [0]; let last = -1;
          for (let j = 1; j < nfi; j++) {
            const t = j / nfi, hi = nt - 1 - (nfi - 1 - j);
            let best = last + 1;
            for (let i = last + 1; i <= hi; i++) if (Math.abs((i + 0.5) / nt - t) < Math.abs((best + 0.5) / nt - t)) best = i;
            out.push((best + 0.5) / nt); last = best;
          }
          return out.concat([1]);
        };
        let fr = null;
        for (let nfi = Math.max(1, Math.ceil(L / mx - 1e-6)); nfi <= nt + 1; nfi++) {
          fr = snap(nfi);
          let mxd = 0; for (let i = 1; i < fr.length; i++) mxd = Math.max(mxd, (fr[i] - fr[i - 1]) * L);
          if (mxd <= mx + 1e-6) break;
        }
        return fr;
      }
      return [0].concat(even(0, L).map((x) => x / L), [1]);
    }
    segs.forEach((s, k) => {
      const fr = segFracs(k);
      for (let j = 1; j < fr.length - 1; j++) postPos.push({ pt: add(s.p0, mul(sub(s.p1, s.p0), fr[j])), hz: hproj(s.d), label: 'sloupek', seg: k, s: s.s0 + s.L * fr[j], x: s.L * fr[j] });
      for (let j = 0; j < fr.length - 1; j++) fields.push({ k, t0: fr[j], t1: fr[j + 1] });
    });
    const zon = (pl, xy) => pl.p[2] - (pl.n[0] * (xy[0] - pl.p[0]) + pl.n[1] * (xy[1] - pl.p[1])) / pl.n[2];
    postPos.forEach((pp) => {
      const pt = pp.pt;
      const adj = segs.filter((s) => Math.abs(len(sub(pt, s.p0)) + len(sub(pt, s.p1)) - len(sub(s.p1, s.p0))) < 1e-6);
      const topPl = [], botPl = [];
      adj.forEach((s) => {
        const ins = s.sloped ? 0 : T;
        topPl.push({ p: sub(s.p0, mul(s.up, a - ins)), n: s.up });
        botPl.push({ p: add(sub(s.p0, mul(Z, H)), mul(s.up, a - ins)), n: mul(s.up, -1) });
      });
      const hz = pp.hz;
      const pw = unit(cross(Z, hz));
      const edges = [];
      [-a, a].forEach((sw) => [-a, a].forEach((su) => edges.push(add(add(pt, mul(pw, sw)), mul(hz, su)))));
      const zts = edges.map((e) => Math.max.apply(null, topPl.map((p) => zon(p, e))));
      const zbs = edges.map((e) => Math.min.apply(null, botPl.map((p) => zon(p, e))));
      const anySl = adj.some((s) => s.sloped), allSl = adj.every((s) => s.sloped);
      const mixed = anySl && !allSl;
      const twoPlanes = adj.length > 1 && allSl && Math.abs(dot(adj[0].up, adj[1].up) - 1) > 1e-9;
      let cut0, cut1, L, ang = 0;
      if (mixed || twoPlanes) {                         // zlom vodorovná/šikmá (vzor 970,5) nebo roh na šikmině: rovné řezy
        const zt = Math.min.apply(null, zts), zb = Math.min.apply(null, zbs);
        cut0 = { p: [pt[0], pt[1], zb], n: Z }; cut1 = { p: [pt[0], pt[1], zt], n: Z }; L = zt - zb;
      } else {
        cut0 = botPl[0]; cut1 = topPl[0];
        L = Math.max.apply(null, zts) - Math.min.apply(null, zbs);
        ang = allSl ? r1(adj[0].slope) : 0;
      }
      const zb0 = zon(cut0, pt);
      const m = { kind: 'tube', role: 'post', name: pp.label + (ang ? ' šikmina' : mixed ? ' ve zlomu' : ''), prof, p0: [pt[0], pt[1], zb0], d: Z, e1: pw, e2: hz, h1: a, h2: a, t: T,
        cut0, cut1, holes: [], L, a1: ang, a2: ang };
      members.push(m);
    });

    // výplň: pásovina, v každém poli vystředěná
    const cl = P.slot_clear, barInfo = [], gapS = [];
    fields.forEach(({ k, t0, t1 }) => {
      const s = segs[k], d = s.d, pitch = s.sloped ? P.pitch_slope : P.pitch_flat;
      const A = add(s.p0, mul(sub(s.p1, s.p0), t0)), B = add(s.p0, mul(sub(s.p1, s.p0), t1));
      const fieldLen = len(sub(B, A)), cosS = Math.cos(s.slope / DEG);
      const clearH = fieldLen * cosS - P.tube, pitchH = pitch * cosS;
      let n = 0;
      while ((clearH - (n * pitchH + P.bar_t)) / 2 >= P.min_end_gap) n++;
      n = Math.max(1, n);
      const spanH = (n - 1) * pitchH, mid = mul(add(A, B), 0.5);
      const hz = hproj(d), wb = unit(cross(Z, hz)), fs = [];
      for (let j = 0; j < n; j++) {
        const cTop = add(mid, mul(d, (-spanH / 2 + j * pitchH) / cosS));
        fs.push(sOf(k, cTop));
        barSet(members, { aT: cTop, aB: sub(cTop, mul(Z, H)), u: s.up, h: a, t: T, e1: wb, e2: hz, w: P.bar_w, bt: P.bar_t, tw: P.tab_w, mode: joint,
          overTop: P.over_top, overBot: P.over_bot, top: rails[k + '_0'], bot: rails[k + '_1'], clear: cl, prof: profB, sloped: s.sloped });
      }
      for (let j = 0; j < fs.length - 1; j++) gapS.push((fs[j] + fs[j + 1]) / 2);
      barInfo.push({ seg: k, n, gapEnd: r1((clearH - (spanH + P.bar_t)) / 2), gapMid: r1(pitchH - P.bar_t) });
    });

    // dřevěné madlo navrch horního rámu (pokos ve vrcholech, na koncích lícuje s koncovým sloupkem)
    if (P.handrail) segs.forEach((s, k) => {
      const c0 = add(s.p0, mul(s.up, a + P.handrail_h / 2));
      const ends = [true, false].map((isStart) => {
        if (isStart && k > 0) return { p: s.p0, n: unit(add(segs[k - 1].d, s.d)) };
        if (!isStart && k < segs.length - 1) return { p: s.p1, n: unit(add(s.d, segs[k + 1].d)) };
        const V = isStart ? s.p0 : s.p1, ohz = hproj(isStart ? mul(s.d, -1) : s.d);
        return { p: add(V, mul(ohz, a)), n: ohz };
      });
      members.push({ kind: 'wood', role: 'handrail', name: 'dřevěné madlo' + (s.sloped ? ' šikmé' : ''), prof: 'dřevo ' + P.handrail_w + '×' + P.handrail_h, p0: c0, d: s.d, e1: s.w, e2: s.up,
        h1: P.handrail_w / 2, h2: P.handrail_h / 2, t: 0, cut0: ends[0], cut1: ends[1], holes: [],
        L: extent(c0, s.d, s.w, s.up, P.handrail_w / 2, P.handrail_h / 2, ends[0], ends[1]), a1: cutAngle(s.d, ends[0].n), a2: cutAngle(s.d, ends[1].n) });
    });

    // kotvení
    const anchors = [];
    const side = P.side;
    const postS = postPos.map((pp) => pp.s);
    const segAtS = (sv) => { for (let k = 0; k < segs.length; k++) if (sv < segs[k].s0 + segs[k].L - 1e-6) return k; return segs.length - 1; };
    const zed = P.zed || { start: false, end: false };
    let anch = { total, cand: [], used: [], groups: [], verts: segs.slice(1).map((x) => x.s0), posts: postS, movable: false, kind: P.anchor,
      corners: segs.slice(1).filter((x, i) => dot(hproj(segs[i].d), hproj(x.d)) < 0.999).map((x) => x.s0), fixed: [] };
    const fOff = P.floor_off != null ? P.floor_off : H + a;            // osa horního madla nad čarou podlahy / hran stupňů
    /* podlaha pod bodem úseku k (x = délka od začátku úseku po sklonu): rovina, nebo stupeň (výška nižší z obou hran) */
    const treadZ = (k, x) => {
      const s = segs[k], z0 = s.p0[2] - fOff, rise = s.p1[2] - s.p0[2];
      if (!s.sloped) return z0;
      const nt = Math.max(1, nSteps(k) - 1), i = Math.max(0, Math.min(nt - 1, Math.floor(x / s.L * nt + 1e-9)));
      return z0 + (rise * i + Math.min(0, rise)) / nt;
    };
    const lowerPl = (k) => ({ p: sub(sub(segs[k].p0, mul(Z, H)), mul(segs[k].up, a)), n: segs[k].up });   // spodní líc spodního rámu
    // body sloupků: koncové (end ±1) a mezi madly (roh = corner, jinak seg + x)
    const ends = [[true, 0], [false, segs.length - 1]].map(([atStart, k]) => {
      const s = segs[k];
      return { pt: atStart ? s.p0 : s.p1, hz: hproj(s.d), end: atStart ? -1 : 1, seg: k, x: atStart ? 0 : s.L, s: atStart ? 0 : total };
    });
    const pts0 = ends.concat(postPos).map((ap) => Object.assign({ pw: unit(cross(Z, ap.hz)) }, ap));
    /* nožka pod spodním rámem: svislý jekl od zadané výšky nahoru k spodnímu líci rámu (u zlomu / rohu vodorovně pod nižším rámem) */
    function stub(ap, zBot, nm) {
      const ks = ap.corner != null ? [ap.corner - 1, ap.corner] : [ap.seg];
      const pls = ks.map(lowerPl);
      const crn = []; [-a, a].forEach((sw) => [-a, a].forEach((su) => crn.push(add(add(ap.pt, mul(ap.pw, sw)), mul(ap.hz, su)))));
      let top = pls[0];
      if (pls.length > 1 && Math.abs(dot(pls[0].n, pls[1].n) - 1) > 1e-9) top = { p: [ap.pt[0], ap.pt[1], Math.min.apply(null, crn.map((c) => Math.min.apply(null, pls.map((pl) => zon(pl, c)))))], n: Z };
      if (zon(top, ap.pt) - zBot < 0.5) return;
      const bot = { p: [ap.pt[0], ap.pt[1], zBot], n: Z };
      const m = { kind: 'tube', role: 'stub', name: nm, prof, p0: [ap.pt[0], ap.pt[1], zBot], d: Z, e1: ap.pw, e2: ap.hz, h1: a, h2: a, t: T, cut0: bot, cut1: top, holes: [], a1: 0, a2: cutAngle(Z, top.n) };
      m.L = extent(m.p0, Z, ap.pw, ap.hz, a, a, bot, top);
      anchors.push(m);
    }
    const rodsDown = (o, ey, t, z0) => [40, -40].forEach((y) => anchors.push({ kind: 'rod', role: 'rod', o: add(add(o, mul(ey, y)), mul(Z, t + 20)), dir: mul(Z, -1), r: 6, L: P.rod_len - 30 + t + 20 }));
    /* svislá plotna na boku dílu: o = střed líce dílu, ex podél, ez do stavby; za ní podložka; 2 kotvy ve směru ez */
    function sidePlate(role, name, o, ex, ez, pl, holes, wall) {
      const ey = unit(cross(ez, ex));
      anchors.push({ kind: 'plate', role, name, prof: 'plech ' + pl.t + ' mm', o, ex, ey, ez, w: pl.w, l: pl.l, t: pl.t, holes });
      if (P.pad) anchors.push({ kind: 'pad', role: 'pad', name: 'tepelně oddělující podložka', prof: 'podložka ' + P.pad + ' mm', o: add(o, mul(ez, pl.t)), ex, ey, ez, w: pl.w, l: pl.l, t: P.pad, holes });
      holes.forEach((h) => anchors.push({ kind: 'rod', role: 'rod', wall: !!wall, o: add(add(sub(o, mul(ez, 30)), mul(ex, h[0])), mul(ey, h[1])), dir: ez, r: 6, L: P.rod_len + 30 + pl.t + P.pad + 10 }));
    }

    if (P.anchor === 'bocni') {
      // povolená místa: konce (pod koncovým sloupkem), sloupky a středy mezer mezi špruše
      const cand = [0, total].concat(postS, gapS).map((x) => Math.round(x * 10) / 10).filter((x, i, arr) => arr.indexOf(x) === i).sort((x, y) => x - y);
      const def = [0, total].filter((x) => !(x === 0 ? zed.start : zed.end)).concat(postS);   // konec u zdi drží plotna ke zdi
      const used = P.anchor_s ? snapAnchors(cand, P.anchor_s) : P.anchor_pitch ? autoAnchors(cand, total, P.anchor_pitch) : snapAnchors(cand, def);
      anch = Object.assign(anch, { cand, used, movable: true });
      used.forEach((sv) => {
        const k = segAtS(sv), s = segs[k], hz = hproj(s.d), win = mul(unit(cross(Z, hz)), side);
        const end = sv < 1e-6 ? -1 : sv > total - 1e-6 ? 1 : 0;
        const pt = add(s.p0, mul(s.d, sv - s.s0));
        let c = sub(pt, mul(Z, H));
        if (end) c = sub(c, mul(s.d, end * a / Math.cos(s.slope / DEG)));   // u koncového sloupku rameno pod rámem, ne za ním
        armSet(anchors, add(c, mul(win, a)), win, hz, P, s);
      });
    } else if (P.anchor === 'patka') {
      /* patka 100×120×8 pod sloupkem. Na schodišti stojí na stupni: sloupky jsou uprostřed stupňů, pod spodním rámem nožka.
         Sloupek na hraně stupně / podesty (zlom, konec): patka 160 mm jen na tu stranu, kde je podlaha ve stejné výšce –
         kotva je pak 60 mm od hrany. Kde podlaha není na žádné straně, patka se nedá. */
      const pk = P.patka, used = [];
      pts0.forEach((ap0) => {
        let ap = ap0;
        // zlom rovina / schodiště: spodní rámy tu mají dva různé spodní líce – nožka s patkou jde kousek vedle,
        // pod rám na rovné straně (60 mm od zlomu, kotva tak není u hrany podesty). Bez rovné strany se nekotví.
        if (ap.corner != null && (segs[ap.corner - 1].sloped || segs[ap.corner].sloped)) {
          const kf = !segs[ap.corner].sloped ? ap.corner : !segs[ap.corner - 1].sloped ? ap.corner - 1 : -1;
          if (kf < 0) return;
          const dir = mul(hproj(segs[kf].d), kf === ap.corner ? 1 : -1), off = pk.w / 2 + 10;
          ap = { pt: add(ap.pt, mul(dir, off)), hz: hproj(segs[kf].d), pw: unit(cross(Z, hproj(segs[kf].d))), seg: kf, x: kf === ap.corner ? off : segs[kf].L - off, s: ap.s + (kf === ap.corner ? off : -off), mid: true };
        }
        const zf = ap.corner == null && ap.end == null ? treadZ(ap.seg, ap.x) : ap.pt[2] - fOff;
        let dir = ap.hz, off = 0, w = pk.w;
        if (ap.corner != null || ap.end != null) {
          const side2 = (k, away) => { const s = segs[k], up = s.d[2] * away; return { dir: mul(hproj(s.d), away), good: !s.sloped || up > 0, stair: s.sloped }; };
          let sides;
          if (ap.corner != null) sides = [side2(ap.corner, 1), side2(ap.corner - 1, -1)];
          else {
            const inw = side2(ap.seg, -ap.end), s = segs[ap.seg];
            sides = [inw, { dir: mul(inw.dir, -1), good: s.sloped && inw.stair && !inw.good, stair: true, out: true }];
          }
          if (ap.corner != null && sides[0].good && sides[1].good) { dir = ap.hz; }
          else if (ap.end != null && sides[0].good && !sides[0].stair) { dir = sides[0].dir; off = pk.w / 2 - a; }   // rovina: lícuje s koncem
          else {
            const g = sides.find((x) => x.good);
            if (!g) return;
            dir = g.dir; w = P.patka_long; off = w / 2 - a;
          }
        }
        const ex = unit(dir), ey = unit(cross(Z, ex)), c = add([ap.pt[0], ap.pt[1], zf], mul(ex, off));
        anchors.push({ kind: 'plate', role: 'patka', name: 'kotevní patka', prof: 'plech ' + pk.t + ' mm', o: c, ex, ey, ez: Z, w, l: pk.l, t: pk.t, holes: [[0, 40, 7], [0, -40, 7]] });
        rodsDown(c, ey, pk.t);
        stub(ap, zf + pk.t, 'nožka sloupku na patku');
        used.push(ap.s);
      });
      anch.used = used.sort((x, y) => x - y);
    } else if (P.anchor === 'celo') {
      /* sloupek přetažený přes čelo: pod spodním rámem nožka, na jejím boku do stavby plotna 120×100×10 se 2 kotvami.
         Horní hrana plotny 25 mm pod podlahou; na schodišti pod nejnižším stupněm v délce plotny. Rohy a zlomy se nekotví. */
      const pl = CELO_PLATE, used = [];
      pts0.forEach((ap) => {
        if (ap.corner != null) return;
        const k = ap.seg, s = segs[k], win = mul(ap.pw, side);
        const off = ap.end != null ? -ap.end * (pl.w / 2 - a) : 0;            // u konce lícuje s koncem sloupku
        const xc = ap.x + off / Math.cos(s.slope / DEG);
        let zf = Infinity;
        const hw2 = pl.w / 2 / Math.cos(s.slope / DEG);                      // půlka plotny po sklonu
        for (let x = xc - hw2; x <= xc + hw2 + 1e-6; x += 5) zf = Math.min(zf, treadZ(k, Math.max(0, Math.min(s.L, x))));
        const zc = zf - pl.drop - pl.l / 2;
        const o = add(add([ap.pt[0], ap.pt[1], zc], mul(ap.hz, off)), mul(win, a));
        sidePlate('celo', 'plotna na čelo', o, ap.hz, win, pl, [[40, 0, 7], [-40, 0, 7]]);
        stub(ap, zc - pl.l / 2, 'nožka sloupku přes čelo');
        used.push(ap.s);
      });
      anch.used = used.sort((x, y) => x - y);
    }
    // konec ke zdi: na koncovém sloupku 2 plotny (u horního a spodního rámu), mezera ke zdi 20 mm
    if (P.anchor !== 'bez') ends.forEach((ap) => {
      if (!(ap.end < 0 ? zed.start : zed.end)) return;
      const out = mul(ap.hz, ap.end), pw = unit(cross(Z, out)), zf = ap.pt[2] - fOff;
      const zTop = ap.pt[2] - 100, zBot = Math.max(ap.pt[2] - H + 100, zf + 150);
      const zs = zTop - zBot >= 150 ? [zTop, zBot] : [(zTop + zBot) / 2];
      zs.forEach((z) => sidePlate('zed', 'plotna ke zdi', add([ap.pt[0], ap.pt[1], z], mul(out, a)), pw, out, ZED_PLATE, [[40, 0, 7], [-40, 0, 7]], true));
      anch.fixed.push(ap.s);
    });
    return { P, segs, members: members.concat(anchors), fields, barInfo, locks: joint !== 'tupo', joint, anch };
  }

  /* kotevní sada: rameno z jeklu 40×20×3, plotna P10 120×120, 2× závitová tyč M12 */
  /* s podložkou (P.pad) je rameno o tloušťku podložky kratší – plotna i podložka se vejdou do zadané délky ramene */
  function armSet(out, base, win, hz, P, seg) {
    const pad = P.pad || 0, L = P.arm_len - P.plate_t - pad, ah = 20, av = 10, at = 3;
    const m = { kind: 'tube', role: 'arm', name: 'kotevní rameno', prof: 'jekl 40×20×3', p0: base, d: win, e1: hz, e2: Z, h1: ah, h2: av, t: at,
      cut0: { p: base, n: win }, cut1: { p: add(base, mul(win, L)), n: win }, holes: [], L, a1: 0, a2: 0 };
    out.push(m);
    const o = add(base, mul(win, L));
    const holes = [[0, P.rod_spacing / 2, 7], [0, -P.rod_spacing / 2, 7]];
    out.push({ kind: 'plate', role: 'plotna', name: 'kotevní plotna', prof: 'plech ' + P.plate_t + ' mm', o, ex: hz, ey: Z, ez: win, w: P.plate, l: P.plate, t: P.plate_t, holes });
    if (pad) out.push({ kind: 'pad', role: 'pad', name: 'tepelně oddělující podložka', prof: 'podložka ' + pad + ' mm', o: add(o, mul(win, P.plate_t)), ex: hz, ey: Z, ez: win, w: P.plate, l: P.plate, t: pad, holes });
    [-1, 1].forEach((sg) => out.push({ kind: 'rod', role: 'rod', o: add(sub(o, mul(win, 30)), mul(Z, sg * P.rod_spacing / 2)), dir: win, r: 6, L: P.rod_len + 30 + P.plate_t + pad + 10 }));
  }

  /* ======================================================================
     TYP B – vzor akce 02 (port railing_b.py). path = čára podlahy / schodiště.
     ====================================================================== */
  const STD_B = {
    rail_w: 40, rail_h: 20, rail_t: 3, bar_w: 40, bar_t: 10, handrail: true, handrail_top: 1000, handrail_w: 60, handrail_h: 40,
    bottom_rail_z: -100, overhang: 150, pitch_max: 116, field_max: 1500, joint_gap: 10, joint_min_corner: 300,
    insert_w: 30, insert_h: 10, insert_t: 2, insert_len: 200, arm_len: 250, arms_per_field: 2, plate: 120, plate_t: 10,
    rod_len: 150, rod_spacing: 70, omit_corner: 1, end_post: true, side: 1, anchor: 'bocni', bar_joint: 'tupo', tab_w: 0, over_top: 0, slot_clear: 0.5,
    pad: 0, zed: null
  };
  function layoutB(path, kw) {
    const P = Object.assign({}, STD_B, kw || {});
    const pts = path.map((p) => [p[0], p[1], p[2] || 0]);
    const hh = P.rail_h / 2, hw = P.rail_w / 2, T = P.rail_t;
    const zt = P.handrail ? P.handrail_top - P.handrail_h - hh : P.handrail_top - hh;
    const zb = P.bottom_rail_z;
    const segs = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = unit(sub(pts[i + 1], pts[i])), hz = hproj(d), wg = unit(cross(Z, hz)), up = unit(cross(d, wg));
      const L = len(sub(pts[i + 1], pts[i])), slope = Math.asin(Math.max(-1, Math.min(1, d[2]))) * DEG;
      segs.push({ i, p0: pts[i], p1: pts[i + 1], d, hz, wg, up, win: mul(wg, P.side), L, s0: acc, slope, cos: Math.cos(slope / DEG) });
      acc += L;
    }
    const total = acc;
    const verts = segs.slice(1).map((s) => s.s0);
    const planCorners = [];
    for (let k = 1; k < segs.length; k++) if (dot(segs[k - 1].hz, segs[k].hz) < 0.999) planCorners.push(segs[k].s0);
    const at = (sv) => { for (let k = 0; k < segs.length; k++) { const s = segs[k]; if (sv <= s.s0 + s.L + 1e-9 || k === segs.length - 1) return [k, add(s.p0, mul(s.d, sv - s.s0))]; } };
    const segAt = (sv) => segs[at(sv)[0]];

    // špruše: v každém úseku rovnoměrně podle vodorovné délky
    const bars = [], pd = hh;
    segs.forEach((s, k) => {
      const Lh = s.L * s.cos, first = k === 0, last = k === segs.length - 1;
      // odsazení krajní špruše od rohu: obdélník špruše (šířka napříč, tloušťka podél) musí zůstat na své straně osy rohu,
      // jinak se v ostrém rohu nebo u široké špruše srazí se špruší z druhé strany: c ≥ (š/2)·cotg(α) + t/2, α = půlka vnitřního úhlu
      const keep = (ka, kb) => {
        const c = Math.max(-1, Math.min(1, -dot(segs[ka].hz, segs[kb].hz))), al = Math.acos(c) / 2;
        return Math.max(hw + P.bar_t / 2, al > 1e-6 && al < Math.PI / 2 - 1e-6 ? P.bar_w / 2 / Math.tan(al) + P.bar_t / 2 : 0);
      };
      const st = first && P.end_post ? pd - P.bar_t / 2 : first ? P.bar_t / 2 : keep(k - 1, k);
      const en = Lh - (last && P.end_post ? pd - P.bar_t / 2 : last ? P.bar_t / 2 : keep(k, k + 1));
      const nInt = Math.ceil((en - st) / P.pitch_max - 1e-9), pitch = (en - st) / nInt;
      for (let j = 0; j <= nInt; j++) {
        if (P.end_post && ((first && j === 0) || (last && j === nInt))) continue;
        const th = st + j * pitch;
        bars.push({ seg: k, th, s: s.s0 + th / s.cos, pitchH: pitch });
      }
    });
    const barS = bars.map((b) => b.s).sort((x, y) => x - y);

    // styky polí
    let nfi = Math.ceil(total / (P.field_max - 100) - 1e-9), joints, bounds;
    for (let guard = 0; guard < 60; guard++, nfi++) {
      joints = []; let ok = true;
      for (let j = 1; j < nfi; j++) {
        const target = total * j / nfi;
        let placed = null;
        const cand = barS.slice().sort((x, y) => Math.abs(x - target) - Math.abs(y - target)).slice(0, 14);
        for (const c of cand) {
          const js = c + (P.bar_t / 2 + P.joint_gap) / segAt(c).cos;
          if (verts.every((v) => Math.abs(js - v) >= P.joint_min_corner)) { placed = js; break; }
        }
        if (placed == null) { ok = false; break; }
        joints.push(placed);
      }
      bounds = [0].concat(joints, [total]);
      let mx = 0; for (let i = 1; i < bounds.length; i++) mx = Math.max(mx, bounds[i] - bounds[i - 1]);
      if (ok && mx <= P.field_max + 1e-6) break;
    }
    const fields = [];
    for (let i = 1; i < bounds.length; i++) fields.push({ i: i - 1, s0: bounds[i - 1], s1: bounds[i], L: bounds[i] - bounds[i - 1], verts: verts.filter((v) => bounds[i - 1] < v && v < bounds[i]) });

    const miterPlane = (kn, z) => ({ p: add(segs[kn].p0, mul(Z, z)), n: unit(add(segs[kn - 1].d, segs[kn].d)) });
    function endFramePlane(atStart, z, top) {
      const s = atStart ? segs[0] : segs[segs.length - 1];
      const v = add(atStart ? s.p0 : s.p1, mul(Z, z)), out = atStart ? mul(s.d, -1) : s.d, ohz = hproj(out);
      const uo = top ? s.up : mul(s.up, -1);
      const corners = [1, -1].map((e) => {
        const rhs = mul(sub(mul(ohz, pd), mul(uo, hh)), e);
        const sol = dot(rhs, ohz) / dot(out, ohz);
        return add(add(v, mul(out, sol)), mul(uo, e * hh));
      });
      let n = unit(cross(s.wg, sub(corners[0], corners[1])));
      if (dot(n, out) < 0) n = mul(n, -1);
      return { p: v, n, outer: corners[0], inner: corners[1] };
    }

    const members = [];
    const profR = 'jekl ' + P.rail_w + '×' + P.rail_h + '×' + T, profB = 'PL ' + P.bar_w + '×' + P.bar_t;

    // rámy po polích, v poli rozdělené na rovné kusy ve vrcholech
    fields.forEach((f) => {
      const cuts = [f.s0].concat(f.verts, [f.s1]);
      [[zt, 'horní rám'], [zb, 'spodní rám']].forEach(([zc, nm]) => {
        const top = zc === zt;
        for (let i = 0; i < cuts.length - 1; i++) {
          const c0 = cuts[i], c1 = cuts[i + 1], k = at(c0 + 1e-6)[0], s = segs[k];
          const p0 = add(add(s.p0, mul(s.d, c0 - s.s0)), mul(Z, zc));
          const ends = [[c0, true], [c1, false]].map(([cc, isStart]) => {
            if (f.verts.indexOf(cc) >= 0) return miterPlane(isStart ? k : k + 1, zc);
            if ((cc === 0 || Math.abs(cc - total) < 1e-6) && P.end_post) { const e = endFramePlane(cc === 0, zc, top); return { p: e.p, n: e.n }; }
            return { p: add(add(s.p0, mul(s.d, cc - s.s0)), mul(Z, zc)), n: s.d };
          });
          const m = { kind: 'tube', role: 'rail', name: nm + (Math.abs(s.slope) > 1 ? ' šikmý' : ''), prof: profR, p0, d: s.d, e1: s.wg, e2: s.up, h1: hw, h2: hh, t: T,
            cut0: ends[0], cut1: ends[1], holes: [], field: f.i, seg: k, sA: c0, sB: c1, lev: top ? 'top' : 'bot' };
          m.L = extent(p0, s.d, s.wg, s.up, hw, hh, ends[0], ends[1]); m.a1 = cutAngle(s.d, ends[0].n); m.a2 = cutAngle(s.d, ends[1].n);
          members.push(m);
        }
      });
    });

    // koncové sloupky (uzavřený rám)
    if (P.end_post) [true, false].forEach((atStart) => {
      const s = atStart ? segs[0] : segs[segs.length - 1], V = atStart ? s.p0 : s.p1, out = atStart ? mul(s.d, -1) : s.d, ohz = hproj(out);
      const t1 = endFramePlane(atStart, zt, true), b1 = endFramePlane(atStart, zb, false);
      const m = { kind: 'tube', role: 'end_post', name: 'koncový sloupek', prof: profR, p0: add(V, mul(Z, zb)), d: Z, e1: s.wg, e2: ohz, h1: hw, h2: pd, t: T,
        cut0: { p: b1.p, n: mul(b1.n, -1) }, cut1: { p: t1.p, n: mul(t1.n, -1) }, holes: [] };
      m.L = extent(m.p0, Z, s.wg, ohz, hw, pd, m.cut0, m.cut1); m.a1 = cutAngle(Z, b1.n); m.a2 = cutAngle(Z, t1.n);
      members.push(m);
    });

    // kotevní ramena (uprostřed mezery mezi špruše, 2 na pole, u rohu se nejbližší vynechá)
    const anchors = [];
    let anch = { total, cand: [], used: [], groups: fields.map((f) => ({ s0: f.s0, s1: f.s1 })), verts, joints, corners: planCorners, posts: [], movable: false, kind: P.anchor, fixed: [] };
    if (P.anchor === 'bocni') {
      // povolená místa: středy mezer mezi špruše, mimo rohy (rameno + 60 mm) a styky polí (60 mm)
      const cand = [];
      for (let i = 0; i < barS.length - 1; i++) {
        const g = (barS[i] + barS[i + 1]) / 2;
        if (verts.every((v) => Math.abs(g - v) > hw + 60) && joints.every((j) => Math.abs(g - j) > 60)) cand.push(Math.round(g * 10) / 10);
      }
      let used;
      if (P.anchor_s) used = snapAnchors(cand, P.anchor_s);
      else if (P.anchor_pitch) used = autoAnchors(cand, total, P.anchor_pitch, anch.groups);
      else {                                           // vzor 02: 2 na pole uprostřed mezery, u rohu se nejbližší vynechá
        const armPos = [];
        fields.forEach((f) => {
          const inside = barS.filter((b) => f.s0 < b && b < f.s1);
          let gaps = []; for (let i = 0; i < inside.length - 1; i++) gaps.push((inside[i] + inside[i + 1]) / 2);
          const g2 = gaps.filter((g) => verts.every((v) => Math.abs(g - v) > hw + 60)); if (g2.length) gaps = g2;
          if (!gaps.length) return;
          for (let j = 0; j < P.arms_per_field; j++) {
            const target = f.s0 + f.L * (j + 0.5) / P.arms_per_field;
            const g = gaps.reduce((b, x) => (Math.abs(x - target) < Math.abs(b - target) ? x : b), gaps[0]);
            if (!armPos.some((x) => x.s === g)) armPos.push({ s: g, f: f.i });
          }
        });
        const omit = new Set();
        planCorners.forEach((c) => armPos.slice().sort((x, y) => Math.abs(x.s - c) - Math.abs(y.s - c)).slice(0, P.omit_corner).forEach((x) => omit.add(x.s)));
        used = armPos.filter((x) => !omit.has(x.s)).map((x) => Math.round(x.s * 10) / 10).sort((x, y) => x - y);
      }
      anch = Object.assign(anch, { cand, used, movable: true });
      used.forEach((sv) => {
        const [k, p] = at(sv), s = segs[k];
        armSet(anchors, add(add(p, mul(Z, zb)), mul(s.win, hw)), s.win, s.hz, P, s);
      });
    }
    // konec ke zdi: na koncovém sloupku 2 plotny 120×100×10, mezera ke zdi 20 mm (plotna + podložka / vyrovnání)
    const zed = P.zed || {};
    if (P.anchor !== 'bez' && P.end_post) [true, false].forEach((atStart) => {
      if (!(atStart ? zed.start : zed.end)) return;
      const s = atStart ? segs[0] : segs[segs.length - 1], V = atStart ? s.p0 : s.p1, ohz = hproj(atStart ? mul(s.d, -1) : s.d), pl = ZED_PLATE, pad = P.pad || 0;
      const ex = s.wg, ey = unit(cross(ohz, ex)), zTop = zt - 100, zBot = Math.max(zb + 100, 150);
      (zTop - zBot >= 150 ? [zTop, zBot] : [(zTop + zBot) / 2]).forEach((z) => {
        const o = add(add(V, mul(Z, z)), mul(ohz, pd)), holes = [[40, 0, 7], [-40, 0, 7]];
        anchors.push({ kind: 'plate', role: 'zed', name: 'plotna ke zdi', prof: 'plech ' + pl.t + ' mm', o, ex, ey, ez: ohz, w: pl.w, l: pl.l, t: pl.t, holes });
        if (pad) anchors.push({ kind: 'pad', role: 'pad', name: 'tepelně oddělující podložka', prof: 'podložka ' + pad + ' mm', o: add(o, mul(ohz, pl.t)), ex, ey, ez: ohz, w: pl.w, l: pl.l, t: pad, holes });
        holes.forEach((h) => anchors.push({ kind: 'rod', role: 'rod', wall: true, o: add(add(sub(o, mul(ohz, 30)), mul(ex, h[0])), mul(ey, h[1])), dir: ohz, r: 6, L: P.rod_len + 30 + pl.t + pad + 10 }));
      });
      anch.fixed.push(atStart ? 0 : total);
    });

    // špruše + přesahy (spoj podle šířky špruše proti rovné části stěny rámu – viz barSet)
    const railAt = (lev, sv) => members.find((m) => m.role === 'rail' && m.lev === lev && m.sA - 1e-6 <= sv && sv <= m.sB + 1e-6);
    bars.forEach((b) => {
      const s = segs[b.seg];
      const p = add(add(s.p0, mul(s.hz, b.th)), mul(Z, b.th * Math.tan(s.slope / DEG)));
      barSet(members, { aT: add(p, mul(Z, zt)), aB: add(p, mul(Z, zb)), u: s.up, h: hh, t: T, e1: s.wg, e2: s.hz, w: P.bar_w, bt: P.bar_t, tw: P.tab_w, mode: P.bar_joint,
        overTop: P.over_top, overBot: P.overhang, top: railAt('top', b.s), bot: railAt('bot', b.s), clear: P.slot_clear, prof: profB, sloped: Math.abs(s.slope) > 1 });
    });

    // vložky ve stycích
    joints.forEach((js) => {
      const [k, p] = at(js), s = segs[k];
      [zt, zb].forEach((zc) => {
        const p0 = sub(add(p, mul(Z, zc)), mul(s.d, P.insert_len / 2));
        members.push({ kind: 'tube', role: 'insert', name: 'vložka styku', prof: 'jekl ' + P.insert_w + '×' + P.insert_h + '×' + P.insert_t, p0, d: s.d, e1: s.wg, e2: s.up,
          h1: P.insert_w / 2, h2: P.insert_h / 2, t: P.insert_t, cut0: { p: p0, n: s.d }, cut1: { p: add(p0, mul(s.d, P.insert_len)), n: s.d }, holes: [], L: P.insert_len, a1: 0, a2: 0 });
      });
    });

    // dřevěné madlo po úsecích (pokos ve vrcholech, na koncích lícuje s koncovým sloupkem)
    if (P.handrail) segs.forEach((s, k) => {
      const c0 = add(add(s.p0, mul(Z, zt)), mul(s.up, hh + P.handrail_h / 2));
      const ends = [true, false].map((isStart) => {
        if ((isStart && k > 0) || (!isStart && k < segs.length - 1)) return miterPlane(isStart ? k : k + 1, zt);
        const V = isStart ? s.p0 : s.p1, ohz = hproj(isStart ? mul(s.d, -1) : s.d);
        return { p: add(V, mul(ohz, P.end_post ? pd : 0)), n: ohz };
      });
      members.push({ kind: 'wood', role: 'handrail', name: 'dřevěné madlo' + (Math.abs(s.slope) > 1 ? ' šikmé' : ''), prof: 'dřevo ' + P.handrail_w + '×' + P.handrail_h, p0: c0, d: s.d, e1: s.wg, e2: s.up,
        h1: P.handrail_w / 2, h2: P.handrail_h / 2, t: 0, cut0: ends[0], cut1: ends[1], holes: [],
        L: extent(c0, s.d, s.wg, s.up, P.handrail_w / 2, P.handrail_h / 2, ends[0], ends[1]), a1: cutAngle(s.d, ends[0].n), a2: cutAngle(s.d, ends[1].n) });
    });

    const pitches = bars.map((b) => b.pitchH);
    return { P, segs, members: members.concat(anchors), fields, joints, bars, zt, zb, total, anch, locks: P.bar_joint !== 'tupo', joint: P.bar_joint, gapMax: r1(Math.max.apply(null, pitches) - P.bar_t) };
  }

  /* ---------- tělesa dílů ---------- */
  /* špruše se zámečky: plný hranol w × bt mezi řezy cut0/cut1, na konci se zámečkem zúžení na tw až k rovině tab0/tab1
     (vnitřní líc stěny rámu – zámeček nikdy nevyčnívá). Rovina řezu nemá složku napříč (e1), takže boky zámečku jsou rovné. */
  function tabBarSolid(m) {
    const F = [], h1 = m.h1, h2 = m.h2, tw = m.tw / 2;
    const pt = (x, y, pl) => hit(add(add(m.p0, mul(m.e1, x)), mul(m.e2, y)), m.d, pl);
    const outN = (pl, sg) => { let n = unit(pl.n); if (dot(n, m.d) * sg < 0) n = mul(n, -1); return n; };
    const E0 = { c: m.cut0, tb: m.tab0, sg: -1 }, E1 = { c: m.cut1, tb: m.tab1, sg: 1 };
    [-1, 1].forEach((s2) => {
      const y = s2 * h2, loop = [];
      if (E0.tb) loop.push(pt(-h1, y, E0.c), pt(-tw, y, E0.c), pt(-tw, y, E0.tb), pt(tw, y, E0.tb), pt(tw, y, E0.c), pt(h1, y, E0.c));
      else loop.push(pt(-h1, y, E0.c), pt(h1, y, E0.c));
      if (E1.tb) loop.push(pt(h1, y, E1.c), pt(tw, y, E1.c), pt(tw, y, E1.tb), pt(-tw, y, E1.tb), pt(-tw, y, E1.c), pt(-h1, y, E1.c));
      else loop.push(pt(h1, y, E1.c), pt(-h1, y, E1.c));
      F.push({ loops: [loop], n: mul(m.e2, s2) });
    });
    [-1, 1].forEach((s1) => { const x = s1 * h1; F.push({ loops: [[pt(x, -h2, m.cut0), pt(x, -h2, m.cut1), pt(x, h2, m.cut1), pt(x, h2, m.cut0)]], n: mul(m.e1, s1) }); });
    const rect = (xa, xb, pl) => [pt(xa, -h2, pl), pt(xb, -h2, pl), pt(xb, h2, pl), pt(xa, h2, pl)];
    [E0, E1].forEach((e) => {
      const n = outN(e.c, e.sg);
      if (!e.tb) { F.push({ loops: [rect(-h1, h1, e.c)], n }); return; }
      F.push({ loops: [rect(-h1, -tw, e.c)], n }, { loops: [rect(tw, h1, e.c)], n }, { loops: [rect(-tw, tw, e.tb)], n: outN(e.tb, e.sg) });
      [-1, 1].forEach((s1) => { const x = s1 * tw; F.push({ loops: [[pt(x, -h2, e.c), pt(x, -h2, e.tb), pt(x, h2, e.tb), pt(x, h2, e.c)]], n: mul(m.e1, s1) }); });
    });
    return solidFrom(F);
  }
  function memberSolid(m) {
    if (m.connectorPair) return connectorSolid(m);
    if (m.kind === 'bar' && (m.tab0 || m.tab1)) return tabBarSolid(m);
    if (m.kind === 'plate' || m.kind === 'pad') return extrudeSolid(rect2(m.w, m.l), m.holes.map((h) => circle(h[0], h[1], h[2], 16)), m.o, m.ex, m.ey, m.ez, m.t);
    if (m.kind === 'rod') { const e1 = unit(cross(m.dir, Math.abs(m.dir[2]) < 0.9 ? Z : [1, 0, 0])), e2 = cross(m.dir, e1); return extrudeSolid(circle(0, 0, m.r, 12), [], m.o, e1, e2, m.dir, m.L); }
    return prismSolid(m);
  }
  /* díl v lokálních souřadnicích (x podél osy od 0) – pro STEP jednotlivých dílů na K2 */
  function toLocal(m) {
    const s = m.solid || memberSolid(m);
    let o, ax;
    if (m.kind === 'plate' || m.kind === 'pad') { o = m.o; ax = [m.ex, m.ey, m.ez]; } else { o = m.p0; ax = [m.d, m.e1, m.e2]; }
    if (dot(cross(ax[0], ax[1]), ax[2]) < 0) ax = [ax[0], ax[1], mul(ax[2], -1)];   // pravotočivá soustava – jinak by díl vyšel zrcadlově
    let loc = s.verts.map((v) => { const q = sub(v, o); return [dot(q, ax[0]), dot(q, ax[1]), dot(q, ax[2])]; });
    const x0 = Math.min.apply(null, loc.map((p) => p[0]));
    if (m.kind !== 'plate' && m.kind !== 'pad') loc = loc.map((p) => [p[0] - x0, p[1], p[2]]);
    const faces = s.faces.map((f) => ({ outer: f.outer, inner: f.inner, n: [dot(f.n, ax[0]), dot(f.n, ax[1]), dot(f.n, ax[2])] }));
    return { verts: loc, faces };
  }
  /* klíč tvaru – shodné díly (i otočené kolem osy nebo obrácené) mají stejný klíč; zrcadlové ne */
  function shapeKey(m) {
    const L = toLocal(m), xs = L.verts.map((p) => p[0]), x1 = Math.max.apply(null, xs);
    const sym = m.h1 === m.h2 ? [0, 1, 2, 3] : [0, 2];
    let best = null;
    [false, true].forEach((rev) => sym.forEach((q) => {
      const ca = [1, 0, -1, 0][q], sa = [0, 1, 0, -1][q];
      const pts = L.verts.map((p) => {
        let x = p[0], y = p[1], z = p[2];
        if (rev) { x = x1 - x; y = -y; }                  // otočení o 180° kolem svislé osy dílu
        return [Math.round(x * 2) / 2, Math.round((y * ca - z * sa) * 2) / 2, Math.round((y * sa + z * ca) * 2) / 2].join(',');
      }).sort().join(';');
      if (best === null || pts < best) best = pts;
    }));
    return m.prof + '|' + best;
  }

  /* ---------- kontext (deska, schodiště, fasáda) jen pro náhled ---------- */
  function context(cfg, pts, lay) {
    const ctxWall = [];
    const out = [], side = cfg.side === 'R' ? -1 : 1, isB = cfg.typ === 'B';
    const hw = isB ? lay.P.rail_w / 2 : lay.P.tube / 2;
    const pad = cfg.podlozka && padAllowed(cfg) ? PAD_T : 0;
    const edge = cfg.anchor === 'patka' || (cfg.typ === 'A' && cfg.anchor === 'bez') ? -70 : cfg.anchor === 'celo' ? hw + CELO_PLATE.t + pad : hw + cfg.arm;
    const flat = pts.every((p) => Math.abs(p[2] - pts[0][2]) < 1e-6) && pts.length > 2;
    const winOf = (i) => mul(unit(cross(Z, hproj(sub(pts[i + 1], pts[i])))), side);
    if (flat) {
      // rovná deska: obrys = trasa posunutá o čelo desky, uzavřená ke stavbě (L doplněné na rovnoběžník, U a víc uzavřené)
      const off = pts.map((p, i) => {
        if (i === 0) return add(p, mul(winOf(0), edge));
        if (i === pts.length - 1) return add(p, mul(winOf(i - 1), edge));
        const a = winOf(i - 1), b = winOf(i), bis = unit(add(a, b));
        return add(p, mul(bis, edge / Math.max(0.3, dot(bis, a))));
      });
      let poly = off.slice();
      if (pts.length === 3) poly.push(add(off[0], sub(off[2], off[1])));
      const c = poly.reduce((a, q) => add(a, mul(q, 1 / poly.length)), [0, 0, 0]);
      const P2 = poly.map((q) => [q[0] - c[0], q[1] - c[1]]);
      const ar = P2.reduce((a, q, i) => a + q[0] * P2[(i + 1) % P2.length][1] - P2[(i + 1) % P2.length][0] * q[1], 0);
      if (ar < 0) P2.reverse();
      out.push({ solid: extrudeSolid(P2, [], [c[0], c[1], pts[0][2] - 220], [1, 0, 0], [0, 1, 0], Z, 220), color: '#CFCAC0', alpha: 1, tag: 'deska' });
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1], win = winOf(i);
      const strip = (o1, o2, z1, z2) => { const P = []; [z1, z2].forEach((z) => [[p0, o1], [p1, o1], [p1, o2], [p0, o2]].forEach(([p, o]) => P.push(add(add(p, mul(win, o)), [0, 0, z])))); return hexa(P); };
      const sg = cfg.segs[i];
      if (!flat && sg && sg.rise && sg.steps) {          // schodiště ze stavby: jednotlivé schody pod čarou hran
        const n = sg.steps, hs = (p1[2] - p0[2]) / (n - 1), dH = hproj(sub(p1, p0)), gs = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / (n - 1);
        const zMin = Math.min(p0[2], p1[2]) - Math.abs(hs) - 150;
        for (let k = 0; k < n - 1; k++) {
          const a = add(p0, mul(dH, k * gs)), b = add(p0, mul(dH, (k + 1) * gs)), top = Math.min(p0[2] + k * hs, p0[2] + (k + 1) * hs) - p0[2];
          const P = []; [zMin - p0[2], top].forEach((z) => [[a, edge], [b, edge], [b, edge + 1000], [a, edge + 1000]].forEach(([q, o]) => P.push(add(add([q[0], q[1], p0[2]], mul(win, o)), [0, 0, z]))));
          out.push({ solid: hexa(P), color: '#CFCAC0', alpha: 1, tag: 'deska' });
        }
      } else if (!flat) out.push({ solid: strip(edge, edge + 1400, -220, 0), color: '#CFCAC0', alpha: 1, tag: 'deska' });
      if (cfg.anchor === 'bocni' && cfg.facade > 0) out.push({ solid: strip(edge - cfg.facade, edge, -260, 30), color: '#E9E1CF', alpha: 0.55, tag: 'fasada' });
    }
    // zeď u konce přikotveného ke zdi (líc zdi 20 mm za koncovým sloupkem)
    if (wallAllowed(cfg)) [[cfg.zed.start, 0, 1], [cfg.zed.end, pts.length - 1, pts.length - 2]].forEach(([on, i, j]) => {
      if (!on) return;
      const V = pts[i], out = hproj(sub(V, pts[j])), win = mul(unit(cross(Z, out)), side), pe = isB ? lay.P.rail_h / 2 : hw;
      const P8 = [];
      [-250, 2500].forEach((z) => [[pe + WALL_GAP, -400], [pe + WALL_GAP + 250, -400], [pe + WALL_GAP + 250, 1600], [pe + WALL_GAP, 1600]].forEach(([u, w]) => P8.push(add(add(add(V, mul(out, u)), mul(win, w)), [0, 0, z]))));
      ctxWall.push({ solid: hexa(P8), color: '#D9D3C7', alpha: 0.6, tag: 'zed' });
    });
    return out.concat(ctxWall);
  }

  /* ---------- celá konfigurace -> díly, kusovník, cena ---------- */
  /* spoj špruše s rámem podle šířky špruše proti rovné části stěny rámu (mimo rádius rohu ~2,4 t):
       vejde se  -> drážka v rámu, špruše projde (s přesahem skrz rám jedním kusem)
       stejně široká (do šířky rámu) -> na tupo (pila), nebo za příplatek zámečky
       širší než rám -> vždy zámečky; přesah je samostatný kus se zámečkem (spodní rám má drážky z obou stran) */
  function jointInfo(cfg) {
    cfg = normalize(cfg);
    const rail = RAILS[cfg.typ].find((r) => r.id === cfg.rail), bar = BARS.find((b) => b.id === cfg.bar), c = DEFAULT_RATES.slotClear;
    const flat = flatFace(rail.w, rail.t), need = bar.w + 2 * c, tw = Math.floor(flat - 2 * c - 2);
    const cls = need <= flat ? 'vejde' : bar.w <= rail.w ? 'stejna' : 'sirsi';
    const mode = cls === 'vejde' ? 'drazka' : cls === 'sirsi' ? 'zamek' : cfg.join;
    const over = cfg.overTop > 0 || cfg.overBot > 0;
    let why;
    if (mode === 'drazka') why = 'Špruše ' + bar.w + ' mm se vejde do rovné části stěny rámu (' + nf(flat, 1) + ' mm) – projde drážkou' + (over ? ' a s přesahem jde skrz rám jedním kusem' : '') + ', při svařování se nic neměří.';
    else if (cls === 'sirsi') why = 'Špruše ' + bar.w + ' mm je širší než rám ' + rail.w + ' mm – konce se zúží na zámeček ' + tw + ' mm, který se zanoří do drážky v rovné části stěny rámu.' + (over ? ' Přesah je samostatný kus, také se zámečkem.' : '');
    else if (mode === 'zamek') why = 'Konec špruše se zúží na zámeček ' + tw + ' mm do drážky v rovné části stěny rámu – svařuje se bez měření.' + (over ? ' Přesah je samostatný kus se zámečkem.' : '') + ' Zámeček se na pile neudělá, počítá se příplatek.';
    else why = 'Drážka pro špruši ' + bar.w + ' mm by zasáhla do rádiusu rohu rámu (rovná část stěny jen ' + nf(flat, 1) + ' mm) – svaří se na tupo' + (over ? ', přesah jako samostatný kus' : '') + '. Za příplatek lze konce zúžit na zámečky.';
    return { ok: mode !== 'tupo', cls, mode, rail, bar, flat, tw, face: rail.w, choice: cls === 'stejna', why };
  }
  const lockInfo = jointInfo;

  function layoutGeometric(path, kw) {
    const P = Object.assign({ handrail_height: 1000, pitch: 250, rail_w: 40, rail_h: 40, rail_t: 2,
      frame_w: 130, inner_w: 60, frame_h: 640, inner_h: 500, frame_tube_w: 20, frame_tube_t: 2, bar_w: 12, bar_t: 6,
      foot_h: 90, plate_w: 60, plate_l: 80, plate_t: 6, hole_d: 11, handrail: false, handrail_w: 60, handrail_h: 40 }, kw || {});
    const pts = path.map((p) => [p[0], p[1], p[2] || 0]), segs = [], members = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const v = sub(pts[i + 1], pts[i]), L = len(v), d = unit(v), h = unit([d[0], d[1], 0]);
      const across = unit(cross(Z, h)), e2 = unit(cross(d, across));
      const s = { i, p0: pts[i], p1: pts[i + 1], d, h, across, e2, L, s0: acc,
        slope: Math.atan2(d[2], Math.hypot(d[0], d[1])) * DEG, sloped: Math.abs(d[2]) > 1e-6 };
      segs.push(s); acc += L;
    }
    const total = acc, railMembers = [], motifCenters = [], woodMembers = [];
    const pointAt = (s, u) => add(s.p0, mul(s.d, u));
    const cutPlane = (k, atStart, axisPoint) => {
      const s = segs[k];
      const top = P.handrail_height + (P.handrail ? P.handrail_h : 0);
      if (atStart && k > 0) return { p: add(segs[k].p0, [0, 0, top]), n: unit(add(segs[k - 1].d, s.d)) };
      if (!atStart && k < segs.length - 1) return { p: add(segs[k].p1, [0, 0, top]), n: unit(add(s.d, segs[k + 1].d)) };
      return { p: axisPoint, n: atStart ? mul(s.d, -1) : s.d };
    };
    segs.forEach((s, k) => {
      const midZ = P.handrail_height - P.rail_h / 2 * s.e2[2];
      const p0 = add(s.p0, mul(Z, midZ)), p1 = add(s.p1, mul(Z, midZ));
      const m = { kind: 'tube', role: 'rail', name: 'horní madlo' + (s.sloped ? ' šikmé' : ''),
        prof: 'jekl ' + P.rail_w + '×' + P.rail_h + '×' + P.rail_t, p0, d: s.d, e1: s.across, e2: s.e2,
        h1: P.rail_w / 2, h2: P.rail_h / 2, t: P.rail_t,
        cut0: cutPlane(k, true, p0), cut1: cutPlane(k, false, p1), holes: [], holeLabel: 'otvor pro zasunutí svislé tyče', L: s.L, a1: 0, a2: 0, seg: k };
      railMembers.push(m); members.push(m);
      if (P.handrail) {
        const woodP0 = add(p0, mul(s.e2, P.rail_h / 2 + P.handrail_h / 2));
        const wood = { kind: 'wood', role: 'handrail', name: 'dřevěné madlo' + (s.sloped ? ' šikmé' : ''),
          prof: 'dřevo ' + P.handrail_w + '×' + P.handrail_h, p0: woodP0, d: s.d, e1: s.across, e2: s.e2,
          h1: P.handrail_w / 2, h2: P.handrail_h / 2, t: 0, cut0: cutPlane(k, true, p0), cut1: cutPlane(k, false, p1), holes: [], L: s.L, a1: 0, a2: 0, seg: k };
        members.push(wood); woodMembers.push(wood);
      }
    });
    for (let k = 1; k < segs.length; k++) {
      const seam = railMembers[k - 1].cut1.p, n = unit(railMembers[k - 1].cut1.n);
      const makeJoint = (a, b, kind, name) => {
        a.cut1 = { p: sub(seam, mul(n, 1)), n };
        b.cut0 = { p: add(seam, mul(n, 1)), n };
        const d = unit(add(segs[k - 1].d, segs[k].d)), e1 = unit(cross(Math.abs(d[2]) < 0.9 ? Z : [0, 1, 0], d)), e2 = unit(cross(d, e1));
        members.push({ kind, role: 'corner', name, prof: a.prof, p0: seam, d, e1, e2,
          h1: a.h1, h2: a.h2, t: a.t, cut0: a.cut1, cut1: b.cut0, holes: [], L: 2, a1: 0, a2: 0, connectorPair: [a, b] });
      };
      makeJoint(railMembers[k - 1], railMembers[k], 'tube', 'rohová spojka madla');
      if (P.handrail) makeJoint(woodMembers[k - 1], woodMembers[k], 'wood', 'rohová spojka dřevěného madla');
    }
    const bar = (role, name, p0, d, e1, e2, length, h1, h2, cut0, cut1) => {
      const m = { kind: 'bar', role, name, prof: 'PL ' + P.bar_w + '×' + P.bar_t,
        p0, d, e1, e2, h1, h2, t: 0, cut0: cut0 || { p: p0, n: mul(d, -1) },
        cut1: cut1 || { p: add(p0, mul(d, length)), n: d }, holes: [], L: length, a1: 0, a2: 0 };
      members.push(m); return m;
    };
    const frameTube = (name, p0, d, e1, e2, length, cut0, cut1) => {
      const w = P.frame_tube_w, t = P.frame_tube_t;
      const m = { kind: 'tube', role: 'motif', name, prof: 'jekl ' + w + '×' + w + '×' + t,
        p0, d, e1, e2, h1: w / 2, h2: w / 2, t, cut0, cut1, holes: [], L: length, a1: 45, a2: 45 };
      members.push(m); return m;
    };
    const frame = (s, center, bottom, width, height, label) => {
      const bw = P.frame_tube_w, d = s.h, across = s.across, left = -(width - bw) / 2, right = (width - bw) / 2;
      const zBot = bottom + bw / 2, zTop = bottom + height - bw / 2;
      [-1, 1].forEach((sgn) => {
        const x = sgn < 0 ? left : right, p = add(add(center, mul(d, x)), mul(Z, zBot));
        const n0 = add(mul(d, -sgn), Z), n1 = sub(mul(d, -sgn), Z);
        frameTube(label + ' svislý díl', p, Z, d, across, height - bw,
          { p, n: n0 }, { p: add(p, mul(Z, height - bw)), n: n1 });
      });
      [false, true].forEach((atTop) => {
        const z = atTop ? zTop : zBot, q = add(center, mul(Z, z));
        const p0 = add(q, mul(d, left)), p1 = add(q, mul(d, right));
        const n0 = add(d, atTop ? mul(Z, -1) : Z), n1 = add(mul(d, -1), atTop ? mul(Z, -1) : Z);
        frameTube(label + (atTop ? ' horní spojka' : ' dolní spojka'), p0, d, across, Z, width - bw,
          { p: p0, n: n0 }, { p: p1, n: n1 });
      });
    };
    const centers = [];
    segs.forEach((s, k) => {
      const cos = Math.max(0.7071, Math.hypot(s.d[0], s.d[1])), widthOnPath = P.frame_w / cos;
      const margin = widthOnPath / 2;
      const count = Math.max(1, Math.floor(Math.max(0, s.L - widthOnPath) / P.pitch) + 1);
      const start = (s.L - (count - 1) * P.pitch) / 2;
      for (let j = 0; j < count; j++) {
        const u = start + j * P.pitch, floor = pointAt(s, u), c = [floor[0], floor[1], floor[2]], label = 'Motiv ' + String(centers.length + 1).padStart(2, '0');
        centers.push(s.s0 + u); motifCenters.push({ s: s.s0 + u, point: floor, segment: k });
        const base = P.foot_h, outerBottom = base, innerBottom = base + (P.frame_h - P.inner_h) / 2;
        const plate = { kind: 'plate', role: 'patka', name: 'kotevní patka 60×80×6', prof: 'plech 6 mm',
          o: add(floor, mul(Z, -P.plate_t)), ex: s.h, ey: s.across, ez: Z, w: P.plate_w, l: P.plate_l, t: P.plate_t,
          holes: [[0, -25, P.hole_d / 2], [0, 25, P.hole_d / 2]], L: P.plate_l };
        members.push(plate);
        bar('motif', label + ' noha', c, Z, s.h, s.across, P.foot_h, P.bar_w / 2, P.bar_t / 2);
        frame(s, c, outerBottom, P.frame_w, P.frame_h, label + ' vnější rám');
        frame(s, c, innerBottom, P.inner_w, P.inner_h, label + ' vnitřní rám');
        const connectorStart = add(add(c, mul(Z, outerBottom + P.bar_w)), mul(s.h, 0));
        bar('motif', label + ' spoj vnitřního rámu', connectorStart, Z, s.h, s.across,
          innerBottom - outerBottom - P.bar_w, P.bar_w / 2, P.bar_t / 2);
        const rail = railMembers[k];
        const insert = hit(floor, Z, { p: sub(rail.p0, mul(s.e2, P.rail_h / 2)), n: mul(s.e2, -1) });
        const zHit = insert[2];
        const halfAlong = (P.bar_w + 0.5) / (2 * cos);
        const halfAcross = (P.bar_t + 0.5) / 2;
        const corners = (center) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add(add(center, mul(s.d, a * halfAlong)), mul(s.across, b * halfAcross)));
        const innerCenter = add(insert, mul(Z, P.rail_t / Math.max(0.7071, s.e2[2])));
        rail.holes.push({ wall: '-e2', dir: s.e2, pts: corners(insert), innerPts: corners(innerCenter), kind: 'insert' });
        const tieStart = add(floor, mul(Z, outerBottom + P.frame_h));
        const tieLen = zHit + 10 - tieStart[2];
        if (tieLen <= 0) throw new Error('Výška madla je příliš malá pro geometrický motiv.');
        bar('motif', label + ' horní zasouvací tyč', tieStart, Z, s.h, s.across, tieLen, P.bar_w / 2, P.bar_t / 2);
      }
    });
    const pitchGaps = centers.slice(1).map((x, i) => x - centers[i]);
    return { P: { tube: P.rail_w, rail_w: P.rail_w, rail_h: P.rail_h }, segs, members, fields: [], bars: [],
      barInfo: [], gapMax: pitchGaps.length ? Math.max.apply(null, pitchGaps) - P.frame_w : 0,
      anch: { total, cand: centers, used: centers, groups: [], verts: [], posts: centers, movable: false, kind: 'patka', fixed: [], corners: segs.slice(1).map((s) => s.s0) },
      locks: false, motifCenters };
  }

  function build(cfgIn) {
    const cfg = normalize(cfgIn), pts = routePoints(cfg.segs), side = cfg.side === 'R' ? -1 : 1;
    const jt = jointInfo(cfg), pr = jt.rail, br = jt.bar;
    const common = { bar_w: br.w, bar_t: br.t, tab_w: jt.tw, over_top: cfg.overTop, anchor: cfg.anchor, side, arm_len: cfg.arm, slot_clear: DEFAULT_RATES.slotClear,
      anchor_s: cfg.kotvyPos, anchor_pitch: cfg.kotvyRoztec, pad: cfg.podlozka && padAllowed(cfg) ? PAD_T : 0, zed: cfg.zed };
    let lay;
    if (cfg.vypln === 'geometricky') {
      lay = layoutGeometric(pts, { handrail_height: cfg.vyska - (cfg.madlo ? 40 : 0), pitch: cfg.motifPitch,
        rail_w: pr.w, rail_h: pr.h, rail_t: pr.t, handrail: cfg.madlo });
    } else if (cfg.typ === 'A') {
      const a = pr.w / 2, zt = cfg.vyska - a - (cfg.madlo ? STD_A.handrail_h : 0), stairs = cfg.segs.some((s) => s.rise);
      // spodní rám: z boku pod podlahou, na patkách (na schodišti s mezerou nad hranami stupňů), jinak na čáře podlahy
      const zbAxis = cfg.anchor === 'bocni' ? -100 : cfg.anchor === 'patka' ? (stairs ? PATKA_STAIR_GAP : STD_A.patka.t) + a : a;
      lay = layoutA(pts.map((p) => add(p, [0, 0, zt])), Object.assign({ tube: pr.w, wall: pr.t, rail_spacing: zt - zbAxis, joint: jt.mode, over_bot: cfg.overBot,
        floor_off: zt, seg_steps: cfg.segs.map(stepsOf),
        pitch_flat: 106 + br.t, pitch_slope: 113 + br.t, post_max_flat: cfg.postPitch, post_max_slope: cfg.postPitch * 1.35, handrail: cfg.madlo }, common));
    } else {
      lay = layoutB(pts, Object.assign({ rail_w: pr.w, rail_h: pr.h, rail_t: pr.t, insert_w: pr.ins[0], insert_h: pr.ins[1], insert_t: pr.ins[2],
        handrail: cfg.madlo, handrail_top: cfg.vyska, bar_joint: jt.mode, overhang: cfg.overBot, pitch_max: 106 + br.t }, common));
    }
    lay.members.forEach((m) => { m.solid = memberSolid(m); });
    const locks = cfg.vypln === 'geometricky' ? { ok: true, mode: 'vlozeni', choice: false,
      why: 'Svislé tyče se zasouvají do otvorů v horním jeklu a přivaří.' } : jt;
    return { cfg, pts, lay, locks, context: context(cfg, pts, lay) };
  }

  const ROLE_ORDER = ['rail', 'end_post', 'post', 'stub', 'insert', 'arm', 'motif', 'bar', 'over', 'overtop', 'patka', 'plotna', 'celo', 'zed', 'handrail'];
  const hwName = (base) => (base === 'ocel' ? 'šroub M12 + matice, podložka' : 'závitová tyč M12 + ' + (base === 'zdivo' ? 'chemická kotva se sítkem' : 'chemická kotva') + ', matice, podložka');
  function analyze(cfgIn, ratesIn) {
    const R = rates0(ratesIn), B = build(cfgIn), cfg = B.cfg, lay = B.lay;
    const parts = lay.members.filter((m) => m.kind !== 'rod' && m.kind !== 'pad');
    const pads = lay.members.filter((m) => m.kind === 'pad');
    const groups = new Map();
    parts.forEach((m) => {
      const k = m.kind === 'plate' ? m.role + '|' + m.w + 'x' + m.l + 'x' + m.t + '|' + m.holes.length : shapeKey(m);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    });
    const gl = Array.from(groups.values()).sort((x, y) => (ROLE_ORDER.indexOf(x[0].role) - ROLE_ORDER.indexOf(y[0].role)) || (y[0].L || 0) - (x[0].L || 0));
    const rows = [], problems = [];
    let kg = 0, area = 0, tubeM = 0, barM = 0, woodM = 0, slots = 0, tabs = 0, n = 0;
    gl.forEach((g) => {
      const m = g[0], poz = 'Z' + String(++n).padStart(2, '0'), q = g.length;
      const names = Array.from(new Set(g.map((x) => x.name)));
      const name = names.length === 1 ? m.name : names.join(' + ');
      g.forEach((x) => { x.poz = poz; });
      if (m.kind === 'plate') {
        kg += m.w * m.l * m.t * 7.85e-6 * q; area += 2 * m.w * m.l * 1e-6 * q;
        rows.push({ poz, kind: 'plate', role: m.role, name: m.name, prof: m.prof, len: nf(m.w) + ' × ' + nf(m.l), L: m.l, cut: 'pálení', feat: m.holes.length + '× otvor Ø' + (2 * m.holes[0][2]), q, stroj: 'C2', file: poz + '_plech' + m.t + '_' + m.w + 'x' + m.l + '_' + q + 'ks.dxf', part: m });
        return;
      }
      const vol = volume(m.solid), L = m.L, nh = (m.holes || []).length;
      if (m.kind === 'wood') { woodM += L * q / 1000; rows.push({ poz, kind: 'wood', role: m.role, name, prof: m.prof, L, len: nf(L, 1), cut: nf(m.a1, m.a1 % 1 ? 1 : 0) + '° / ' + nf(m.a2, m.a2 % 1 ? 1 : 0) + '°', feat: '', q, stroj: 'truhlář', file: '', part: m }); return; }
      kg += vol * 7.85e-6 * q;
      area += (4 * m.h1 + 4 * m.h2) * L * 1e-6 * q;     // vnější povrch (obvod × délka)
      if (m.kind === 'tube') tubeM += L * q / 1000; else barM += L * q / 1000;
      slots += (m.holes || []).filter((h) => !h.kind || h.kind === 'lock').length * q;
      const nt = m.tabs || 0; tabs += nt * q;
      const tube = m.kind === 'tube';
      const pr = m.prof.replace('jekl ', '').replace('PL ', 'PL').replace(/×/g, 'x');
      rows.push({ poz, kind: tube ? 'tube' : 'bar', role: m.role, name, prof: m.prof, L, len: nf(L, 1), cut: nf(m.a1, m.a1 % 1 ? 1 : 0) + '° / ' + nf(m.a2, m.a2 % 1 ? 1 : 0) + '°', feat: nh ? (m.holeLabel ? nh + '× ' + m.holeLabel : nh + '× drážka pro zámek') : nt ? nt + '× zámeček ' + m.tw + ' mm' : '', q,
        stroj: tube ? 'K2' : 'pila', file: poz + '_' + pr + '_L' + Math.round(L) + '_' + q + 'ks.step', part: m });
      if (tube && L > 6000) problems.push(poz + ' ' + name + ': délka ' + nf(L) + ' mm je přes tyč 6 m – potřeba styk.');
    });
    const rodsWall = lay.members.filter((m) => m.kind === 'rod' && m.wall).length, rodsMain = lay.members.filter((m) => m.kind === 'rod' && !m.wall).length, rods = rodsMain + rodsWall;
    const base = BASE.find((b) => b.id === cfg.base), wbase = WALL_BASE.find((b) => b.id === cfg.zedBase);
    if (rodsMain) rows.push({ poz: 'Z' + String(++n).padStart(2, '0'), kind: 'hw', role: 'hw', name: hwName(cfg.base), prof: 'nakupovaný díl', len: '', L: 0, cut: '', feat: base.lab, q: rodsMain, stroj: '', file: '' });
    if (rodsWall) rows.push({ poz: 'Z' + String(++n).padStart(2, '0'), kind: 'hw', role: 'hw', name: hwName(cfg.zedBase) + ' – do zdi', prof: 'nakupovaný díl', len: '', L: 0, cut: '', feat: wbase.lab, q: rodsWall, stroj: '', file: '' });
    const padG = new Map();
    pads.forEach((m) => { const k = m.w + ' × ' + m.l + ' × ' + m.t; if (!padG.has(k)) padG.set(k, []); padG.get(k).push(m); });
    padG.forEach((g, k) => {
      const poz = 'Z' + String(++n).padStart(2, '0');
      g.forEach((m) => { m.poz = poz; });
      rows.push({ poz, kind: 'hw', role: 'pad', name: 'tepelně oddělující podložka ' + k + ' mm, 2 otvory Ø14', prof: 'nakupovaný díl', len: '', L: 0, cut: '', feat: 'pod plotnu', q: g.length, stroj: '', file: '' });
    });
    const anchorsN = parts.filter((m) => ['arm', 'patka', 'celo', 'zed'].indexOf(m.role) >= 0).length;

    // svary (odhad pro cenu)
    const cnt = (r) => parts.filter((m) => m.role === r).length;
    const motifFrameMembers = parts.filter((m) => m.role === 'motif' && /vnější rám|vnitřní rám/.test(m.name)).length;
    const motifFrameWelds = Math.round(motifFrameMembers / 4) * 4;
    const welds = cnt('post') * 2 + cnt('end_post') * 2 + (lay.segs.length - 1) * 2 + parts.filter((m) => m.role === 'corner' && m.kind === 'tube').length * 2 + cnt('bar') * 2 + motifFrameWelds + cnt('over') + cnt('overtop') + cnt('insert') + cnt('arm') * 2 + cnt('patka') + cnt('stub') + cnt('celo') + cnt('zed');
    const cutsN = rows.filter((r) => r.kind === 'tube' || r.kind === 'bar' || r.kind === 'plate').reduce((a, r) => a + r.q, 0);
    const fin = cfg.fin;
    const finCost = (fin === 'zn' ? kg * R.zinek : fin === 'znpu' ? kg * R.zinek + area * R.lak : fin === 'prasek' ? area * R.prasek : kg * R.zinek + area * R.prasek);
    const cost = kg * R.kg + cutsN * R.rez + welds * R.svar + slots * R.drazka + tabs * R.zamekSpruse + finCost + woodM * R.madlo + rodsMain * (R.kotva[cfg.base] || 0) + rodsWall * (R.kotva[cfg.zedBase] || 0) + pads.length * R.podlozka + R.priprava;
    const price = Math.round(cost * (1 + R.marze / 100) / 10) * 10;
    const lenM = cfg.segs.reduce((a, s) => a + Math.hypot(s.L, s.rise), 0) / 1000;
    const svc = [];
    if (cfg.services.zamereni) svc.push({ id: 'zamereni', lab: 'Zaměření na místě', price: R.zamereni });
    if (cfg.services.kotveni) svc.push({ id: 'kotveni', lab: 'Pomoc s kotvením (posouzení podkladu, návrh kotev)', price: R.kotveni });
    if (cfg.services.montaz) svc.push({ id: 'montaz', lab: 'Montáž (' + nf(lenM, 1) + ' m, ' + anchorsN + ' kotev)', price: Math.round((lenM * R.montazM + anchorsN * R.montazKotva) / 10) * 10 });
    const svcPrice = svc.reduce((a, s) => a + s.price, 0);
    const vat = (x) => Math.round(x * 1.21 / 10) * 10;
    const total = vat(price * cfg.qty + svcPrice);

    // upozornění
    const warns = [];
    if (cfg.vypln === 'geometricky') {
      if (lay.gapMax > 110) warns.push({ lvl: 'warn', t: 'Světlá mezera mezi motivy ' + nf(lay.gapMax) + ' mm – víc než 110 mm.' });
    } else if (cfg.typ === 'A') {
      const gm = Math.max.apply(null, lay.barInfo.map((b) => Math.max(b.gapMid, b.gapEnd)));
      if (gm > 110) warns.push({ lvl: 'warn', t: 'Světlá mezera ve výplni ' + nf(gm) + ' mm – víc než 110 mm.' });
    } else if (lay.gapMax > 110) warns.push({ lvl: 'warn', t: 'Světlá mezera mezi špruše ' + nf(lay.gapMax) + ' mm – víc než 110 mm.' });
    if (B.locks.mode === 'zamek') warns.push({ lvl: 'info', t: 'Špruše se zámečky nejdou nařezat jen na pile – v ceně je příplatek za vyřezání ' + tabs + ' zámečků.' });
    if (cfg.overTop > 0) warns.push({ lvl: 'info', t: 'Špruše přečnívají ' + cfg.overTop + ' mm nad horní rám. Výška zábradlí se měří k hornímu rámu, přesah ji nezvyšuje.' });
    if (cfg.vyska < 1000) warns.push({ lvl: 'warn', t: 'Pro balkony, terasy a schodiště s volnou hloubkou nad 3 m chce ČSN 74 3305 výšku zábradlí aspoň 1000 mm.' });
    if (cfg.segs.some((s) => Math.abs(s.rise) / s.L > Math.tan(42 / DEG))) warns.push({ lvl: 'warn', t: 'Sklon úseku přes 42° – ověřte rozměry schodiště, nejlépe zaměřením.' });
    if (cfg.anchor === 'bocni' && cfg.arm < cfg.facade + 30) warns.push({ lvl: 'bad', t: 'Rameno kotvy (' + cfg.arm + ' mm) je kratší než fasáda + 30 mm – plotna by nedosedla na nosnou desku.' });
    if (cfg.anchor === 'bez') warns.push({ lvl: 'info', t: 'Bez kotev: zábradlí dodáme bez kotevních prvků, kotvení a jeho únosnost zajišťujete sami.' });
    const sm = stepsMissing(cfg);
    if (sm.length) warns.push({ lvl: 'bad', t: (cfg.anchor === 'patka' ? 'Patky na schodišti stojí na stupních' : 'Plotny na schodišti jdou pod stupně') + ' – zadejte počet schodů u úseku ' + sm.map((i) => i + 1).join(', ') + '.' });
    if ((cfg.anchor === 'patka' || cfg.anchor === 'celo') && !(cfg.stavba && cfg.stavba.on)) cfg.segs.forEach((s, i) => {
      if (!s.rise || !s.steps) return;
      const g = s.L / (s.steps - 1), h = Math.abs(s.rise) / (s.steps - 1);
      if (g < 220 || g > 350 || h < 140 || h > 210) warns.push({ lvl: 'bad', t: 'Úsek ' + (i + 1) + ': z délky, převýšení a ' + s.steps + ' schodů vychází schod ' + nf(h) + ' × ' + nf(g) + ' mm (výška × hloubka) – to je neobvyklé. Zkontrolujte počet schodů: počítají se výšky od prvního schodu po podestu.' });
    });
    if (cfg.anchor === 'patka' && cfg.segs.some((s) => s.rise)) warns.push({ lvl: 'info', t: cfg.vypln === 'geometricky' ? 'Kotevní plechy jsou vodorovné a jejich poloha sleduje zadanou šikmou trasu; ověřte dosednutí na skutečných stupních.' : 'Na schodišti stojí patky uprostřed stupňů, pod spodním rámem jsou nožky. Poloha stupňů je ze zadaných rozměrů – doporučujeme zaměření.' });
    if (cfg.anchor === 'celo') warns.push({ lvl: 'info', t: 'Sloupky přes čelo se kotví do betonu bez zateplení. U rohů a zlomů je kotevní sloupek ' + CELO_CORNER + ' mm od rohu – do rohu z boku kotvit nejde.' });
    if (cfg.anchor !== 'bez' && !cfg.services.kotveni && !cfg.services.montaz) warns.push({ lvl: 'info', t: 'Kotvy jsou navržené pro běžný podklad (' + base.lab.toLowerCase() + '). Pokud si podkladem nejste jistí, přidejte pomoc s kotvením.' });
    problems.forEach((p) => warns.push({ lvl: 'warn', t: p }));
    const meas = stavbaCheck(cfg);
    if (meas.missing.length) warns.push({ lvl: 'bad', t: 'Doměřte: ' + meas.missing.map((m) => m.t).join('; ') + '.' });
    meas.remeasure.forEach((m) => warns.push({ lvl: m.lvl || 'warn', t: m.t }));
    const kotvy = anchorCheck(lay.anch, R, cfg);
    kotvy.msgs.forEach((m) => warns.push(m));
    return { cfg, R, build: B, lay, rows, parts, pads, rodsWall, kg, area, tubeM, barM, woodM, slots, tabs, kotvy, meas, welds, rods, anchorsN, lenM, price, svc, svcPrice, total, vatOf: vat, warns, problems, locks: B.locks };
  }

  /* ---------- řezný plán: kusy na tyče (první vhodná, od nejdelšího) ----------
     Délka kusu = nejdelší hrana dílu (pokos se počítá celý, kusy se do sebe nezaklesávají – na straně jistoty).
     K2: každá tyč má nevyužitelný konec v upínači; pila: prořez za každým kusem. */
  function cutPlan(A, R) {
    R = rates0(R || A.R);
    const groups = new Map();
    A.rows.forEach((r) => {
      if (r.kind !== 'tube' && r.kind !== 'bar') return;
      const k = r.prof + '|' + r.stroj;
      if (!groups.has(k)) groups.set(k, { prof: r.prof, stroj: r.stroj, pieces: [] });
      for (let i = 0; i < r.q * A.cfg.qty; i++) groups.get(k).pieces.push({ poz: r.poz, L: r.L, name: r.name, cut: r.cut });
    });
    const out = [];
    groups.forEach((g) => {
      const k2 = g.stroj === 'K2', kerf = k2 ? R.prorezK2 : R.prorezPila, cap = R.tycDelka - (k2 ? R.zbytekK2 : 0);
      const bars = [], over = [];
      g.pieces.slice().sort((a, b) => b.L - a.L).forEach((pc) => {
        if (pc.L > cap) { over.push(pc); return; }
        let bar = bars.find((b) => b.used + pc.L + (b.pieces.length ? kerf : 0) <= cap + 1e-6);
        if (!bar) { bar = { pieces: [], used: 0 }; bars.push(bar); }
        bar.used += pc.L + (bar.pieces.length ? kerf : 0); bar.pieces.push(pc);
      });
      bars.forEach((b) => { b.rest = R.tycDelka - b.used - (k2 ? R.zbytekK2 : 0); });
      const usedL = g.pieces.reduce((a, p) => a + p.L, 0);
      out.push({ prof: g.prof, stroj: g.stroj, stock: R.tycDelka, kerf, end: k2 ? R.zbytekK2 : 0, bars, over, n: g.pieces.length, usedL,
        util: bars.length ? usedL / (bars.length * R.tycDelka) : 0 });
    });
    return out.sort((a, b) => (a.stroj === b.stroj ? 0 : a.stroj === 'K2' ? -1 : 1) || b.usedL - a.usedL);
  }

  /* kontrola rozmístění kotev: červeně (nejde poptat) nad maximum dílny, oranžově nad doporučenou hodnotu */
  function anchorCheck(an, R, cfg) {
    const out = { gaps: [], ends: [0, 0], lvl: [], endLvl: ['ok', 'ok'], msgs: [], groups: [], pts: [] };
    if (!an || cfg.anchor === 'bez') return out;
    // kotevní body = kotvy + konce přikotvené ke zdi (pevné)
    const fx = an.fixed || [], u = an.used.concat(fx).filter((x, i, arr) => arr.indexOf(x) === i).sort((x, y) => x - y), T = an.total, nf0 = (x) => nf(Math.round(x));
    out.pts = u;
    const L = (x, dop, max) => (x > max + 1e-6 ? 'bad' : x > dop + 1e-6 ? 'warn' : 'ok');
    if (!u.length) { out.msgs.push({ lvl: 'bad', t: 'Zábradlí nemá žádnou kotvu.' }); return out; }
    for (let i = 0; i < u.length - 1; i++) out.gaps.push(u[i + 1] - u[i]);
    // mezera přes půdorysný roh: roh je ztužený ve dvou směrech – hlídá se jen maximum
    const overCorner = (i) => (an.corners || []).some((c) => u[i] < c && c < u[i + 1]);
    out.lvl = out.gaps.map((g, i) => L(g, overCorner(i) ? R.kotvaMax : R.kotvaDop, R.kotvaMax));
    out.ends = [u[0], T - u[u.length - 1]];
    out.endLvl = out.ends.map((e) => L(e, R.kotvaKonecDop, R.kotvaKonecMax));
    const gm = out.gaps.length ? Math.max.apply(null, out.gaps) : 0, em = Math.max(out.ends[0], out.ends[1]);
    const worst = out.lvl.indexOf('bad') >= 0 ? 'bad' : out.lvl.indexOf('warn') >= 0 ? 'warn' : 'ok';
    const gw = out.gaps.filter((g, i) => out.lvl[i] === worst), gm2 = gw.length ? Math.max.apply(null, gw) : gm;
    const lg = worst, le = L(em, R.kotvaKonecDop, R.kotvaKonecMax);
    if (lg !== 'ok') out.msgs.push({ lvl: lg, t: 'Mezera mezi kotvami ' + nf0(gm2) + ' mm – ' + (lg === 'bad' ? 'víc než povolených ' + nf0(R.kotvaMax) + ' mm. Přidejte kotvu nebo zmenšete rozteč.' : 'doporučujeme nejvýš ' + nf0(R.kotvaDop) + ' mm.') });
    if (le !== 'ok') out.msgs.push({ lvl: le, t: 'Konec zábradlí přečnívá ' + nf0(em) + ' mm za krajní kotvu – ' + (le === 'bad' ? 'povoleno nejvýš ' + nf0(R.kotvaKonecMax) + ' mm.' : 'doporučujeme nejvýš ' + nf0(R.kotvaKonecDop) + ' mm.') });
    const none = [], one = [];
    (an.groups || []).forEach((g, i) => {
      const n = an.used.filter((x) => g.s0 < x && x < g.s1).length + fx.filter((x) => g.s0 - 1e-6 <= x && x <= g.s1 + 1e-6).length, corner = (an.verts || []).some((v) => g.s0 < v && v < g.s1);
      out.groups.push(n);
      if (!n) none.push(i + 1); else if (n < 2 && !corner) one.push(i + 1);
    });
    const lst = (a) => (a.length > 6 ? a.slice(0, 6).join(', ') + ' a další' : a.join(', '));
    if (none.length) out.msgs.push({ lvl: 'bad', t: (none.length > 1 ? 'Pole ' + lst(none) + ' nemají' : 'Pole ' + none[0] + ' nemá') + ' žádnou kotvu – každé pole se musí ukotvit.' });
    if (one.length) out.msgs.push({ lvl: 'warn', t: (one.length > 1 ? 'Pole ' + lst(one) + ' mají' : 'Pole ' + one[0] + ' má') + ' jen jednu kotvu – rovné pole bez rohu doporučujeme kotvit aspoň dvakrát.' });
    return out;
  }

  function describe(cfg) {
    cfg = normalize(cfg);
    const T = TYPES.find((t) => t.id === cfg.typ), lenM = cfg.segs.reduce((a, s) => a + Math.hypot(s.L, s.rise), 0) / 1000;
    const shape = cfg.segs.length === 1 ? (cfg.segs[0].rise ? 'schodiště' : 'rovné') : cfg.segs.length + ' úseky' + (cfg.segs.some((s) => s.rise) ? ' se schodištěm' : '');
    const zd = cfg.zed.start || cfg.zed.end ? ', ' + (cfg.zed.start && cfg.zed.end ? 'oba konce' : cfg.zed.start ? 'začátek' : 'konec') + ' ke zdi (' + WALL_BASE.find((b) => b.id === cfg.zedBase).lab.replace('Zeď – ', '') + ')' : '';
    const an = cfg.anchor === 'bez' ? 'bez kotev' : ({ patka: 'kotvení shora', celo: 'sloupky přes čelo', bocni: 'kotvení z boku' }[cfg.anchor]) + ' – ' + BASE.find((b) => b.id === cfg.base).lab.toLowerCase() + zd + (cfg.podlozka && padAllowed(cfg) ? ', tepelně oddělující podložky' : '');
    const ms = cfg.stavba && cfg.stavba.on ? stavbaCheck(cfg) : null;
    return 'Zábradlí ' + (cfg.vypln === 'geometricky' ? 's geometrickým motivem po ' + cfg.motifPitch + ' mm' : cfg.sloupky ? 'se sloupky po max. ' + cfg.postPitch + ' mm' : 'bez sloupků') + ', ' + nf(lenM, 1) + ' m, ' + shape + ', výška ' + cfg.vyska + ' mm' + ', rám jekl ' + cfg.rail.replace(/x/g, '×') + (cfg.vypln === 'geometricky' ? ', dvojitý rám z jeklu 20×20×2 s pokosy 45°' : ', špruše ' + BARS.find((b) => b.id === cfg.bar).lab + ' (' + { drazka: 'v drážkách', tupo: 'na tupo', zamek: 'se zámečky' }[jointInfo(cfg).mode] + ')') +
      (cfg.overTop || cfg.overBot ? ', přesah ' + [cfg.overTop ? 'nahoře ' + cfg.overTop : '', cfg.overBot ? 'dole ' + cfg.overBot : ''].filter(Boolean).join(' / ') + ' mm' : '') + (cfg.madlo ? ', dřevěné madlo' : ', bez dřevěného madla') + ', ' + an + ', ' + FIN.find((f) => f.id === cfg.fin).lab.toLowerCase() +
      (ms ? ', rozměry změřil zákazník' + (ms.remeasure.filter((m) => m.lvl !== 'info').length ? ' (' + ms.remeasure.filter((m) => m.lvl !== 'info').length + '× k přeměření)' : '') : '');
  }

  root.Zabradli = { cutPlan, VERSION: '20261012b', WALL_BASE, PAD_T, CELO_CORNER, wallAllowed, padAllowed, stepsMissing, TURN_MAX, normTurn, WALL_GAP, MARK, normStavba, stavbaSegs, stavbaCheck, stairDims, TYPES, RAILS, BARS, JOINS, OVER_MAX, POST_MIN, POST_MAX, PROF_A, BAR_A, overAllowed, jointInfo, anchorCheck, FIN, ANCHOR, BASE, SERVICES, TURNS, PRESETS, DEFAULT_CFG, DEFAULT_RATES, rates0, normalize, routePoints, patkaAllowed, lockInfo,
    layoutA, layoutB, layoutGeometric, build, analyze, describe, memberSolid, toLocal, volume, nf, V: { add, sub, mul, dot, cross, len, unit } };
})(typeof window !== 'undefined' ? window : globalThis);
