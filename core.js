/* Jádro konfigurátoru podnoží: data, geometrie jeklů (tělesa s pokosy, zámky a otvory), cena, nosnost.
   Sdílí ho stránka pro zákazníky i interní stránka dílny. Souřadnice v mm, Z nahoru.

   Konstrukce:
   - SVAŘOVANÁ: vodorovný horní rám ze 4 jeklů s pokosy 45°; nohy (a šikmé díly) jsou nahoře
     rovně zaříznuté a mají 2 zámky, které zapadnou do drážek (protikusů) ve spodní stěně podélných jeklů rámu.
   - ŠROUBOVANÁ (Rám U, 4 nohy): boky se svaří u nás (pokosy 45°), podélné spojky se k bokům přišroubují.
     Spojka má na obou koncích 2 zámky do drážek v boku (vystředění, přenos smyku) a uvnitř konce
     zavařenou koncovou desku s přivařovací maticí. Šroub prochází montážním otvorem ve vnější stěně
     boku a otvorem ve vnitřní stěně do matice. Montážní otvor zakryje plastová záslepka. */
(function (root) {
  'use strict';

  const THK = { 20: [2], 30: [2, 3], 40: [2, 3, 4], 50: [2, 3, 4] };
  const SIZES = [20, 30, 40, 50];
  /* 20 modelů. Ikona = pohled na bok (64×48, podlaha y=42, horní rám y=6).
     bolt: jde vyrobit i jako šroubovaná (jen U a 4N – boky se svaří, spojky se přišroubují).
     note: omezení použití, ukáže se zákazníkovi. */
  const MODELS = [
    { id: 'U', lab: 'Rám U', desc: 'Uzavřené boky', icon: 'M6 6 H58 M12 6 V42 H52 V6', bolt: true },
    { id: '4N', lab: '4 nohy', desc: 'Klasická stavba stolu', icon: 'M6 6 H58 M12 6 V42 M52 6 V42', bolt: true },
    { id: 'X', lab: 'Kříž X', desc: 'Překřížené nohy', icon: 'M6 6 H58 M12 42 L52 6 M52 42 L12 6' },
    { id: 'T', lab: 'Trapéz', desc: 'Boky zúžené k zemi', icon: 'M6 6 H58 M12 6 L20 42 H44 L52 6' },
    { id: 'TR', lab: 'Trapéz obrácený', desc: 'Boky rozšířené k zemi', icon: 'M6 6 H58 M20 6 L12 42 H52 L44 6' },
    { id: 'A', lab: 'A-rám', desc: 'Nohy se sbíhají nahoru, příčka', icon: 'M6 6 H58 M12 42 L29 6 M52 42 L35 6 M19 29 H45' },
    { id: 'D', lab: 'Delta', desc: 'Trojúhelník na spodní příčce', icon: 'M6 6 H58 M12 42 H52 M12 42 L29 6 M52 42 L35 6' },
    { id: 'V', lab: 'V-rám', desc: 'Nohy do středu na patku', icon: 'M6 6 H58 M12 6 L29 42 M52 6 L35 42 M18 42 H46' },
    { id: 'H', lab: 'H-rám', desc: 'Nohy s příčkou ve výšce', icon: 'M6 6 H58 M12 6 V42 M52 6 V42 M12 28 H52' },
    { id: 'UP', lab: 'Rám U s příčkou', desc: 'Uzavřený bok s mezipříčkou', icon: 'M6 6 H58 M12 6 V42 H52 V6 M12 26 H52' },
    { id: 'SL', lab: 'Slot', desc: 'Rám se svislou příčkou', icon: 'M6 6 H58 M12 6 V42 H52 V6 M32 6 V42' },
    { id: 'KL', lab: 'Klec', desc: 'Rám se dvěma svislými příčkami', icon: 'M6 6 H58 M12 6 V42 H52 V6 M25 6 V42 M39 6 V42' },
    { id: 'UU', lab: 'Rám v rámu', desc: 'Dvojitý bok', icon: 'M6 6 H58 M12 6 V42 H52 V6 M20 6 V32 H44 V6' },
    { id: 'XR', lab: 'Kříž v rámu', desc: 'Uzavřený bok s křížem', icon: 'M6 6 H58 M12 6 V42 H52 V6 M16 42 L48 6 M48 42 L16 6' },
    { id: 'N', lab: 'N-rám', desc: 'Nohy se šikmou výztuhou', icon: 'M6 6 H58 M12 6 V42 M52 6 V42 M12 36 L52 12' },
    { id: 'KR', lab: 'Kosý rám', desc: 'Rovnoběžník – nohy nakloněné', icon: 'M6 6 H58 M12 6 L20 42 H52 L44 6' },
    { id: 'Z', lab: 'Z-rám', desc: 'Šikmá noha na spodní příčce', icon: 'M6 6 H58 M52 6 L12 42 H52', note: 'Z-rám doporučujeme pro stoly do délky 1,6 m.' },
    { id: 'C', lab: 'C-rám', desc: 'Otevřený bok – odkládací stolek', icon: 'M6 6 H58 M52 6 V42 H12', note: 'C-rám je určený pro odkládací a noční stolky, které se zasouvají k sedačce nebo posteli.' },
    { id: 'TS', lab: 'Kozlík', desc: 'Středový sloupek na patce', icon: 'M6 6 H58 M32 6 V42 M16 42 H48' },
    { id: 'K', lab: 'Kostka', desc: 'Rám U se spodními spojkami', icon: 'M6 6 H58 M12 6 V42 H52 V6 M12 36 H52' },
    /* umělecké */
    { id: 'HX', lab: 'Šestiúhelník', desc: 'Bok jako šestiúhelník', icon: 'M6 6 H58 M24 6 L12 24 L22 42 H42 L52 24 L40 6', art: true },
    { id: 'BL', lab: 'Blesk', desc: 'Klikatá výztuha mezi nohou a patkou', icon: 'M6 6 H58 M12 6 V42 H54 M52 6 L12 18 L52 30 L24 42', art: true },
    { id: 'DM', lab: 'Diamant v rámu', desc: 'Kosočtverec v uzavřeném boku', icon: 'M6 6 H58 M12 6 V42 H52 V6 M32 6 L12 24 L32 42 L52 24 Z', art: true },
    { id: 'SM', lab: 'Strom', desc: 'Sloupek s větvemi na patce', icon: 'M6 6 H58 M32 6 V42 M16 42 H48 M32 24 L12 6 M32 24 L52 6', art: true },
    { id: 'VJ', lab: 'Vějíř', desc: 'Paprsky z patky', icon: 'M6 6 H58 M14 42 H50 M26 42 L12 6 M30 42 L24 6 M34 42 L40 6 M38 42 L52 6', art: true },
    { id: 'MD', lab: 'Mondrian', desc: 'Nepravidelné dělení boku', icon: 'M6 6 H58 M12 6 V42 H52 V6 M26 6 V42 M12 20 H26 M26 32 H52', art: true },
    { id: 'MS', lab: 'Most', desc: 'Příhradový bok (W)', icon: 'M6 6 H58 M12 6 V42 H52 V6 M16 42 L22 6 M30 42 L24 6 M34 42 L40 6 M48 42 L42 6', art: true },
    { id: 'SC', lab: 'Schody', desc: 'Stupňovitý bok', icon: 'M6 6 H58 M12 6 V42 M52 6 V24 H32 V42 H52', art: true },
    { id: 'ST', lab: 'Štít', desc: 'Rám se sbíhajícími diagonálami', icon: 'M6 6 H58 M12 6 V42 H52 V6 M16 42 L30 6 M48 42 L34 6', art: true },
    { id: 'OK', lab: 'Okno', desc: 'Rám s vnitřním oknem', icon: 'M6 6 H58 M12 6 V42 H52 V6 M24 16 H40 V32 H24 Z M12 24 H24 M40 24 H52 M32 6 V16 M32 32 V42', art: true }
  ];
  const FIN = [
    { id: 'black', lab: 'Černá mat', ral: 'RAL 9005', sw: '#1E1F21', k: 1 },
    { id: 'anth', lab: 'Antracit', ral: 'RAL 7016', sw: '#383E45', k: 1 },
    { id: 'white', lab: 'Bílá', ral: 'RAL 9016', sw: '#F2F2EE', k: 1 },
    { id: 'raw', lab: 'Ocel + lak', ral: 'bezbarvý lak', sw: '#77726A', k: 0.7 }
  ];
  const SHAPES = [
    { id: 'rect', lab: 'Obdélník', icon: 'M6 12 H58 V36 H6 Z' },
    { id: 'round', lab: 'Zaoblené rohy', icon: 'M14 12 H50 Q58 12 58 20 V28 Q58 36 50 36 H14 Q6 36 6 28 V20 Q6 12 14 12 Z' },
    { id: 'stadium', lab: 'Ovál', icon: 'M18 12 H46 A12 12 0 0 1 46 36 H18 A12 12 0 0 1 18 12 Z' },
    { id: 'ellipse', lab: 'Elipsa', icon: 'M6 24 A26 12 0 1 0 58 24 A26 12 0 1 0 6 24 Z' },
    { id: 'circle', lab: 'Kruh', icon: 'M16 24 A16 16 0 1 0 48 24 A16 16 0 1 0 16 24 Z' }
  ];
  const DEFAULT_RATES = {
    kg: 42, rez: 35, svar: 90, sroub: 110, barva: 280, priprava: 600, marze: 35,
    plate: { w: 40, l: 60, t: 4 }, plateSpacing: 450,
    boltModels: ['U', '4N'], boltMax4N: 1400,
    tabClear: 0.15
  };
  const DEFAULT_CFG = { model: 'U', L: 1600, W: 800, H: 750, td: 40, size: 40, t: 2, join: 'weld', shape: 'rect', fin: 'black', qty: 1, dmode: 'table', dL: 1600, dW: 800 };

  /* Rozšíření (rozpracované modely ve vyvoj.js): vlastní normalize/analyze/audit/describe pro svoje id modelů */
  const EXT = [];
  const extFor = (id) => EXT.find((e) => e.owns(id));
  function register(ext) { if (EXT.indexOf(ext) < 0) EXT.push(ext); }
  function modelInfo(id) { const m = MODELS.find((x) => x.id === id); if (m) return m; const e = extFor(id); return e ? e.MODELS.find((x) => x.id === id) : undefined; }
  const allModels = () => EXT.reduce((a, e) => a.concat(e.MODELS), MODELS.slice());

  const clamp = (v, a, b) => { const n = Number(v); return isFinite(n) && n > 0 ? Math.min(b, Math.max(a, n)) : a; };
  const rates0 = (r) => { const R = Object.assign({}, DEFAULT_RATES, r || {}); R.plate = Object.assign({}, DEFAULT_RATES.plate, (r && r.plate) || {}); return R; };

  function normalize(c) {
    const ex = c && extFor(c.model); if (ex) return ex.normalize(c);
    c = Object.assign({}, DEFAULT_CFG, c || {});
    const o = {};
    o.model = MODELS.some((m) => m.id === c.model) ? c.model : 'U';
    o.shape = SHAPES.some((s) => s.id === c.shape) ? c.shape : 'rect';
    o.L = Math.round(clamp(c.L, 350, 2400));
    o.W = o.shape === 'circle' ? o.L : Math.round(clamp(c.W, 300, 1100));
    o.H = Math.round(clamp(c.H, 350, 1100));
    o.td = Math.round(clamp(c.td, 18, 80));
    o.size = SIZES.indexOf(Number(c.size)) >= 0 ? Number(c.size) : 40;
    const tl = THK[o.size], t = Number(c.t);
    o.t = tl.indexOf(t) >= 0 ? t : (t > tl[tl.length - 1] ? tl[tl.length - 1] : tl[0]);
    o.join = c.join === 'bolt' ? 'bolt' : 'weld';
    o.fin = FIN.some((f) => f.id === c.fin) ? c.fin : 'black';
    o.qty = Math.round(clamp(c.qty, 1, 50));
    o.dmode = c.dmode === 'own' ? 'own' : 'table';
    o.dL = Math.round(clamp(c.dL, 300, 3000));
    o.dW = o.shape === 'circle' ? o.dL : Math.round(clamp(c.dW, 250, 1500));
    return o;
  }

  /* Šroubované jen: model povolený v ceníku, jekl od 30×30 (do 20×20 se matice nevejde), 4 nohy do max. délky */
  function boltAllowed(cfg, rates) {
    const R = rates0(rates);
    if ((R.boltModels || []).indexOf(cfg.model) < 0 || !(MODELS.find((m) => m.id === cfg.model) || {}).bolt) return false;
    if (cfg.size < 30) return false;
    if (cfg.model === '4N' && cfg.L > (R.boltMax4N || 1400)) return false;
    return true;
  }
  function boltWhyNot(cfg, rates) {
    const R = rates0(rates);
    if ((R.boltModels || []).indexOf(cfg.model) < 0 || !(MODELS.find((m) => m.id === cfg.model) || {}).bolt) return 'model';
    if (cfg.size < 30) return 'size';
    if (cfg.model === '4N' && cfg.L > (R.boltMax4N || 1400)) return 'length';
    return '';
  }

  function frameDims(cfg) {
    const s = cfg.size, L = cfg.L, W = cfg.W, four = cfg.model === '4N', shape = cfg.shape;
    let ox = four ? 40 : 100, oy = four ? 40 : 50;
    if (L < 1000) ox = Math.max(20, Math.round(L * 0.05));
    if (W < 600) oy = 20;
    let Lf = L - 2 * ox, Wf = W - 2 * oy;
    if (shape === 'ellipse' || shape === 'circle' || (shape === 'stadium' && L <= W)) { Lf = L * 0.68; Wf = W * 0.68; }
    else if (shape === 'stadium') { Wf = W * 0.78; Lf = (L - W) + W * 0.56; }
    Lf = Math.max(Math.round(Lf / 10) * 10, 4 * s + 60);
    Wf = Math.max(Math.round(Wf / 10) * 10, 4 * s + 60);
    return { Lf, Wf, Hf: cfg.H - cfg.td };
  }

  /* ---------- vektory ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const unit = (a) => mul(a, 1 / len(a));
  const lerp = (a, b, f) => add(a, mul(sub(b, a), f));
  function newell(P) {
    const n = [0, 0, 0];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return n;
  }
  const V = { add, sub, mul, dot, cross, len, unit, newell };

  /* ---------- těleso z ploch zadaných body -> sdílené vrcholy ---------- */
  function solidFromFaces(pf) {
    const verts = [], map = {};
    const id = (p) => {
      const k = Math.round(p[0] * 1e4) + ',' + Math.round(p[1] * 1e4) + ',' + Math.round(p[2] * 1e4);
      if (map[k] == null) { map[k] = verts.length; verts.push(p); }
      return map[k];
    };
    const faces = pf.map((f) => ({ outer: f.loops[0].map(id), inner: f.loops.slice(1).map((l) => l.map(id)), n: unit(f.n) }));
    return { verts, faces };
  }
  function orientFace(verts, f) {
    let outer = f.outer.slice();
    if (dot(newell(outer.map((i) => verts[i])), f.n) < 0) outer.reverse();
    const inner = f.inner.map((lp) => { lp = lp.slice(); if (dot(newell(lp.map((i) => verts[i])), f.n) > 0) lp.reverse(); return lp; });
    return { outer, inner, n: f.n };
  }
  function volume(solid) {
    let v = 0;
    solid.faces.forEach((f0) => {
      const f = orientFace(solid.verts, f0), p0 = solid.verts[f.outer[0]];
      [f.outer].concat(f.inner).forEach((lp) => { v += dot(p0, newell(lp.map((i) => solid.verts[i]))) / 6; });
    });
    return v;
  }

  /* ---------- jekl ----------
     m: {p1, p2, w} osa a orientace; cut1/cut2: {p, n}; opt.tab1/tab2: {d, len, a, walls} zámky uprostřed stěn
     (walls = seznam stěn '+v' | '-v' | '+w' | '-w', výchozí ['+v', '-v']);
     opt.holes: [{wall:'+v'|'-v'|'+w'|'-w', pts:[[x, c], ...]}] x = poloha podél osy od p1, c = příčně ve stěně */
  const OFFS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const WALLS = [{ id: '-w', a: 0, b: 1 }, { id: '+v', a: 1, b: 2 }, { id: '+w', a: 2, b: 3 }, { id: '-v', a: 3, b: 0 }];
  function frame(p1, p2, w) {
    const u = unit(sub(p2, p1));
    let ww = sub(w, mul(u, dot(w, u))); ww = unit(ww);
    return { p1, p2, u, w: ww, v: cross(ww, u) };
  }
  function tube(m, s, t, cut1, cut2, opt) {
    opt = opt || {};
    const F = [], H = { o: s / 2, i: s / 2 - t };
    const E = {};
    ['o', 'i'].forEach((r) => OFFS.forEach(([a, b], k) => {
      const c = add(add(m.p1, mul(m.v, a * H[r])), mul(m.w, b * H[r]));
      [[1, cut1], [2, cut2]].forEach(([e, cut]) => {
        const lam = dot(cut.n, sub(cut.p, c)) / dot(cut.n, m.u);
        E[r + k + e] = add(c, mul(m.u, lam));
      });
    }));
    const tabs = { 1: opt.tab1, 2: opt.tab2 };
    // body zámku na hraně stěny W (r, konec e): souřadnice napříč stěnou = ±a od středu stěny
    const tp = (r, W, e, target) => {
      const ci = W.id.indexOf('v') >= 0 ? 1 : 0, wa = OFFS[W.a][ci] * H[r], wb = OFFS[W.b][ci] * H[r];
      return lerp(E[r + W.a + e], E[r + W.b + e], (target - wa) / (wb - wa));
    };
    // tabPts[e][stěna] = {po, qo, pi, qi}: p blíž rohu W.a, q blíž rohu W.b
    const tabPts = {};
    [1, 2].forEach((e) => {
      const T = tabs[e]; if (!T) return;
      const walls = T.walls || ['+v', '-v'];
      if (!walls.length) return;
      tabPts[e] = { up: (p) => add(p, mul(T.d, T.len)), W: {} };
      WALLS.forEach((W) => {
        if (walls.indexOf(W.id) < 0) return;
        const ci = W.id.indexOf('v') >= 0 ? 1 : 0, sA = OFFS[W.a][ci];
        tabPts[e].W[W.id] = { po: tp('o', W, e, sA * T.a), qo: tp('o', W, e, -sA * T.a), pi: tp('i', W, e, sA * T.a), qi: tp('i', W, e, -sA * T.a) };
      });
    });
    const holesOn = (wid) => (opt.holes || []).filter((h) => h.wall === wid);
    WALLS.forEach((W) => {
      const nv = unit(add(mul(m.v, OFFS[W.a][0] + OFFS[W.b][0]), mul(m.w, OFFS[W.a][1] + OFFS[W.b][1])));
      const across = W.id.indexOf('v') >= 0 ? m.w : m.v;
      ['o', 'i'].forEach((r) => {
        const loop = [E[r + W.a + 1]];
        const tabSeg = (e, fromA) => {
          const tpE = tabPts[e]; if (!tpE || !tpE.W[W.id]) return [];
          const P = [tpE.W[W.id]['p' + r], tpE.W[W.id]['q' + r]];
          const [p, q] = fromA ? P : [P[1], P[0]];
          return [p, tpE.up(p), tpE.up(q), q];
        };
        loop.push(...tabSeg(1, true));
        loop.push(E[r + W.b + 1], E[r + W.b + 2]);
        loop.push(...tabSeg(2, false));
        loop.push(E[r + W.a + 2]);
        const loops = [loop];
        holesOn(W.id).forEach((h) => loops.push(h.pts.map(([x, c]) => add(add(add(m.p1, mul(m.u, x)), mul(across, c)), mul(nv, H[r])))));
        F.push({ loops, n: r === 'o' ? nv : mul(nv, -1) });
      });
      holesOn(W.id).forEach((h) => {
        const P = (r) => h.pts.map(([x, c]) => add(add(add(m.p1, mul(m.u, x)), mul(across, c)), mul(nv, H[r])));
        const po = P('o'), pi = P('i'), cen = mul(po.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / po.length);
        for (let k = 0; k < po.length; k++) {
          const k2 = (k + 1) % po.length, mid = mul(add(po[k], po[k2]), 0.5);
          let n = cross(sub(po[k2], po[k]), nv); if (dot(n, sub(cen, mid)) < 0) n = mul(n, -1);
          F.push({ loops: [[po[k], po[k2], pi[k2], pi[k]]], n });
        }
      });
    });
    [[1, cut1, -1], [2, cut2, 1]].forEach(([e, cut, sg]) => {
      let n = unit(cut.n); if (dot(n, m.u) * sg < 0) n = mul(n, -1);
      const O = (k) => E['o' + k + e], I = (k) => E['i' + k + e], T = tabPts[e];
      if (!T) { F.push({ loops: [[O(0), O(1), O(2), O(3)], [I(0), I(1), I(2), I(3)]], n }); return; }
      // čelo = mezikruží rozdělené zámky na kusy: od zámku k dalšímu zámku po vnějším obrysu, zpět po vnitřním
      const ti = [0, 1, 2, 3].filter((j) => T.W[WALLS[j].id]);
      ti.forEach((j1, k) => {
        const j2 = ti[(k + 1) % ti.length], A1 = T.W[WALLS[j1].id], A2 = T.W[WALLS[j2].id];
        const corners = [];
        for (let j = j1; ; ) { j = (j + 1) % 4; corners.push(WALLS[j].a); if (j === j2) break; }
        F.push({ loops: [[A1.qo].concat(corners.map(O), [A2.po, A2.pi], corners.slice().reverse().map(I), [A1.qi])], n });
      });
      const d = tabs[e].d;
      ti.forEach((j) => {
        const Q = T.W[WALLS[j].id], fp = [Q.po, Q.qo, Q.qi, Q.pi], top = fp.map(T.up);
        const cen = mul(fp.reduce((a, b) => add(a, b), [0, 0, 0]), 0.25);
        let nt = unit(cut.n); if (dot(nt, d) < 0) nt = mul(nt, -1);
        F.push({ loops: [top], n: nt });
        [[0, 3], [1, 2]].forEach(([a, b]) => {
          const quad = [fp[a], fp[b], top[b], top[a]];
          let ns = cross(sub(fp[b], fp[a]), d); const mid = mul(add(fp[a], fp[b]), 0.5);
          if (dot(ns, sub(mid, cen)) < 0) ns = mul(ns, -1);
          F.push({ loops: [quad], n: ns });
        });
      });
    });
    const solid = solidFromFaces(F);
    solid.tabFoot = {};
    solid.tabDir = {};          // směr a délka zámků (pro stránku Testing – rozložení a postup)
    solid.tabWalls = {};
    [1, 2].forEach((e) => {
      if (!tabPts[e]) return;
      const ids = WALLS.map((W) => W.id).filter((id) => tabPts[e].W[id]);
      solid.tabFoot[e] = ids.map((id) => { const Q = tabPts[e].W[id]; return [Q.po, Q.qo, Q.pi, Q.qi]; });
      solid.tabWalls[e] = ids;
      solid.tabDir[e] = { d: tabs[e].d, len: tabs[e].len };
    });
    return solid;
  }
  function boxSolid(o, ex, ey, ez) {
    const p = [o, add(o, ex), add(add(o, ex), ey), add(o, ey)], q = p.map((x) => add(x, ez));
    return solidFromFaces([
      { loops: [p], n: mul(ez, -1) }, { loops: [q], n: ez },
      { loops: [[p[0], p[1], q[1], q[0]]], n: mul(ey, -1) }, { loops: [[p[1], p[2], q[2], q[1]]], n: ex },
      { loops: [[p[2], p[3], q[3], q[2]]], n: ey }, { loops: [[p[3], p[0], q[0], q[3]]], n: mul(ex, -1) }]);
  }

  const plane = (p, n) => ({ p, n });
  const cornerPlane = (outer, inner, normal) => plane(outer, cross(sub(inner, outer), normal));
  const circle = (cx, cy, r, n) => { const out = []; n = n || 32; for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; };
  const rect = (x0, x1, c0, c1) => [[x0, c0], [x1, c0], [x1, c1], [x0, c1]];

  /* ---------- boky: definice uzlů a úseků v rovině boku (y, z) ----------
     konce úseků: floor (řez u země), top (vodorovný řez + zámky do horního rámu), free (kolmý řez, zátka),
     miter (pokos s úsekem j), butt (dosedá na stěnu úseku j) */
  const lineX = (p1, p2, q1, q2) => {
    const d1 = [p2[0] - p1[0], p2[1] - p1[1]], d2 = [q2[0] - q1[0], q2[1] - q1[1]];
    const den = d1[0] * d2[1] - d1[1] * d2[0], k = ((q1[0] - p1[0]) * d2[1] - (q1[1] - p1[1]) * d2[0]) / den;
    return [p1[0] + d1[0] * k, p1[1] + d1[1] * k];
  };
  const atZ = (a, b, z) => [a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]), z];
  /* Špičky pokosů a horní hrany šikmých dílů nesmí vyčnívat za obrys rámu (±Wf/2):
     uzel se posune dovnitř tak, aby vnější roh pokosu ležel přesně na obrysu. */
  function sideDef(id, Wf, zt, s) {
    const segs = sideDefRaw(id, Wf, zt, s), h = s / 2, lim = Wf / 2;
    const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
    const dirOf = (d) => { const l = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]); return [(d.b[0] - d.a[0]) / l, (d.b[1] - d.a[1]) / l]; };
    for (let it = 0; it < 6; it++) {
      let moved = false;
      segs.forEach((d, i) => ['a', 'b'].forEach((k) => {
        const e = k === 'a' ? d.ea : d.eb, node = d[k];
        let outerY = null;
        if (e.t === 'miter') {
          const o = segs[e.j], dd = dirOf(d), od = dirOf(o);
          const dA = k === 'a' ? dd : [-dd[0], -dd[1]], dB = same(o.a, node) ? od : [-od[0], -od[1]];
          const nA = [-dA[1], dA[0]], nB = [-dB[1], dB[0]];
          const sA = Math.sign(nA[0] * dB[0] + nA[1] * dB[1]) || 1, sB = Math.sign(nB[0] * dA[0] + nB[1] * dA[1]) || 1;
          const oA = [node[0] - nA[0] * sA * h, node[1] - nA[1] * sA * h], oB = [node[0] - nB[0] * sB * h, node[1] - nB[1] * sB * h];
          const den = dA[0] * dB[1] - dA[1] * dB[0];
          if (Math.abs(den) < 1e-9) return;
          const kk = ((oB[0] - oA[0]) * dB[1] - (oB[1] - oA[1]) * dB[0]) / den;
          outerY = oA[0] + dA[0] * kk;
        } else if (e.t === 'top' || e.t === 'floor') {
          const dd = dirOf(d), cosT = Math.abs(dd[1]);
          if (cosT < 0.999) outerY = node[0] + Math.sign(node[0] || 1) * h / cosT;
        }
        if (outerY === null || Math.abs(outerY) <= lim + 0.05) return;
        const delta = (Math.abs(outerY) - lim) * Math.sign(outerY);
        const newNode = [node[0] - delta, node[1]];
        segs.forEach((q) => { if (same(q.a, node)) q.a = newNode.slice(); if (same(q.b, node)) q.b = newNode.slice(); });
        moved = true;
      }));
      if (!moved) break;
    }
    // konce dosedající na jiný díl vrátit přesně na jeho osu (po posunu uzlů)
    for (let pass = 0; pass < 2; pass++) segs.forEach((d) => {
      if (d.ea.t === 'butt') { const o = segs[d.ea.j]; d.a = lineX(d.a, d.b, o.a, o.b); }
      if (d.eb.t === 'butt') { const o = segs[d.eb.j]; d.b = lineX(d.a, d.b, o.a, o.b); }
    });
    // u kříže znovu najít bod, kde dělená diagonála dosedá na průběžnou
    const xi = id === 'X' ? 0 : id === 'XR' ? 3 : -1;
    if (xi >= 0) { const A = segs[xi], B1 = segs[xi + 1], B2 = segs[xi + 2], m = lineX(A.a, A.b, B1.a, B2.b); B1.b = m.slice(); B2.a = m.slice(); }
    return segs;
  }
  function sideDefRaw(id, Wf, zt, s) {
    const h = s / 2, Yo = Wf / 2 - h, F = { t: 'floor' }, T = { t: 'top' }, R = { t: 'free' };
    const M = (j) => ({ t: 'miter', j }), Bt = (j) => ({ t: 'butt', j });
    const seg = (g, n, a, b, ea, eb) => ({ g, n, a, b, ea, eb });
    const U = () => {
      const BL = [-Yo, h], BR = [Yo, h];
      return [seg('L', 'Noha', BL, [-Yo, zt], M(2), T), seg('L', 'Noha', BR, [Yo, zt], M(2), T), seg('B', 'Spodní příčka', BL, BR, M(0), M(1))];
    };
    const legs4 = () => [seg('L', 'Noha', [-Yo, 0], [-Yo, zt], F, T), seg('L', 'Noha', [Yo, 0], [Yo, zt], F, T)];
    const cross = (a1, a2, b1, b2, e1, e2, gA, gB1, gB2) => {
      const m = lineX(a1, a2, b1, b2), base = e1.base || 0;
      return [seg(gA, 'Diagonála průběžná', a1, a2, e1, T), seg(gB1, 'Diagonála dělená – dolní', b1, m, e2, Bt(base)), seg(gB2, 'Diagonála dělená – horní', m, b2, Bt(base), T)];
    };
    switch (id) {
      case 'U': return U();
      case '4N': return legs4();
      case 'X': {
        const r = cross([-Yo, 0], [Yo, zt], [Yo, 0], [-Yo, zt], F, F, 'D1', 'D2', 'D3');
        return r;
      }
      case 'T': case 'TR': case 'KR': case 'D': {
        let bl, br, tl, tr;
        if (id === 'T') { const Wb = Math.max(Wf * 0.8, 2 * s + 80); bl = [-(Wb / 2 - h), h]; br = [Wb / 2 - h, h]; tl = [-Yo, zt]; tr = [Yo, zt]; }
        if (id === 'TR') { const Wt = Math.max(Wf * 0.62, 2 * s + 80); bl = [-Yo, h]; br = [Yo, h]; tl = [-(Wt / 2 - h), zt]; tr = [Wt / 2 - h, zt]; }
        if (id === 'KR') { const d = Math.round(Wf * 0.14); bl = [-Yo + d, h]; br = [Yo, h]; tl = [-Yo, zt]; tr = [Yo - d, zt]; }
        if (id === 'D') { bl = [-Yo, h]; br = [Yo, h]; tl = [-s, zt]; tr = [s, zt]; }
        return [seg('L', id === 'KR' ? 'Noha šikmá' : 'Noha šikmá', bl, tl, M(2), T), seg(id === 'KR' ? 'L2' : 'L', 'Noha šikmá', br, tr, M(2), T), seg('B', 'Spodní příčka', bl, br, M(0), M(1))];
      }
      case 'A': {
        const l1 = [[-Yo, 0], [-s, zt]], l2 = [[Yo, 0], [s, zt]], zc = zt * 0.35;
        return [seg('L', 'Noha šikmá', l1[0], l1[1], F, T), seg('L', 'Noha šikmá', l2[0], l2[1], F, T), seg('P', 'Příčka', atZ(l1[0], l1[1], zc), atZ(l2[0], l2[1], zc), Bt(0), Bt(1))];
      }
      case 'V': {
        const fw = Math.max(Wf * 0.4, 2 * s + 40);
        return [seg('F', 'Patka', [-fw, h], [fw, h], R, R), seg('L', 'Noha šikmá', [-s, h], [-Yo, zt], Bt(0), T), seg('L', 'Noha šikmá', [s, h], [Yo, zt], Bt(0), T)];
      }
      case 'H': case 'N': {
        const r = legs4();
        if (id === 'H') { const zc = zt * 0.35; r.push(seg('P', 'Příčka', [-Yo, zc], [Yo, zc], Bt(0), Bt(1))); }
        else r.push(seg('P', 'Výztuha šikmá', [-Yo, zt * 0.14], [Yo, zt * 0.86], Bt(0), Bt(1)));
        return r;
      }
      case 'UP': { const r = U(), zc = zt * 0.45; r.push(seg('P', 'Mezipříčka', [-Yo, zc], [Yo, zc], Bt(0), Bt(1))); return r; }
      case 'SL': { const r = U(); r.push(seg('P', 'Svislá příčka', [0, h], [0, zt], Bt(2), T)); return r; }
      case 'KL': { const r = U(), yk = Math.round(Wf / 6); r.push(seg('P', 'Svislá příčka', [-yk, h], [-yk, zt], Bt(2), T), seg('P', 'Svislá příčka', [yk, h], [yk, zt], Bt(2), T)); return r; }
      case 'UU': {
        const r = U(), yi = Yo - 2.5 * s, zi = h + 3 * s;
        r.push(seg('L2', 'Vnitřní noha', [-yi, zi], [-yi, zt], M(5), T), seg('L2', 'Vnitřní noha', [yi, zi], [yi, zt], M(5), T), seg('B2', 'Vnitřní spodní příčka', [-yi, zi], [yi, zi], M(3), M(4)));
        return r;
      }
      case 'XR': {
        const r = U(), yi = Yo - s - 15;
        const c = cross([-yi, h], [yi, zt], [yi, h], [-yi, zt], { t: 'butt', j: 2, base: 3 }, Bt(2), 'D1', 'D2', 'D3');
        c[0].ea = Bt(2); c[1].eb = Bt(3); c[2].ea = Bt(3);
        return r.concat(c);
      }
      case 'Z': return [seg('B', 'Spodní příčka', [-Yo, h], [Yo, h], M(1), R), seg('L', 'Noha šikmá', [-Yo, h], [Yo, zt], M(0), T)];
      case 'C': return [seg('L', 'Noha', [Yo, h], [Yo, zt], M(1), T), seg('B', 'Spodní příčka', [-Yo, h], [Yo, h], R, M(0))];
      case 'TS': { const fw = Math.max(Wf * 0.44, 2 * s + 60); return [seg('F', 'Patka', [-fw, h], [fw, h], R, R), seg('L', 'Sloupek', [0, h], [0, zt], Bt(0), T)]; }
      case 'K': return U();
      case 'HX': {
        const b = Wf * 0.36, bt = Math.max(Wf * 0.22, s * 1.5), zm = zt * 0.5;
        return [seg('B', 'Spodní hrana', [-b, h], [b, h], M(1), M(2)), seg('L', 'Dolní šikmá', [-b, h], [-Yo, zm], M(0), M(3)), seg('L', 'Dolní šikmá', [b, h], [Yo, zm], M(0), M(4)),
          seg('L2', 'Horní šikmá', [-Yo, zm], [-bt, zt], M(1), T), seg('L2', 'Horní šikmá', [Yo, zm], [bt, zt], M(2), T)];
      }
      case 'BL': {
        const z1 = zt * 0.34, z2 = zt * 0.64;
        return [seg('F', 'Patka', [-Yo, h], [Yo, h], M(1), R), seg('L', 'Noha', [-Yo, h], [-Yo, zt], M(0), T),
          seg('Z1', 'Klikatý díl 1', [-Yo * 0.35, h], [Yo, z1], Bt(0), M(3)), seg('Z2', 'Klikatý díl 2', [Yo, z1], [-Yo, z2], M(2), Bt(1)),
          seg('Z3', 'Klikatý díl 3', [-Yo, z2 + s * 1.4], [Yo, zt], Bt(1), T)];
      }
      case 'DM': {
        const r = U(), q = s * 1.3, zm = zt * 0.5;
        r.push(seg('P', 'Diamant – dolní', [-q, h], [-Yo, zm - q], Bt(2), Bt(0)), seg('P', 'Diamant – dolní', [q, h], [Yo, zm - q], Bt(2), Bt(1)),
          seg('P2', 'Diamant – horní', [-Yo, zm + q], [-q, zt], Bt(0), T), seg('P2', 'Diamant – horní', [Yo, zm + q], [q, zt], Bt(1), T));
        return r;
      }
      case 'SM': {
        const fw = Math.max(Wf * 0.44, 2 * s + 60), zb = zt * 0.45;
        return [seg('F', 'Patka', [-fw, h], [fw, h], R, R), seg('L', 'Sloupek', [0, h], [0, zt], Bt(0), T),
          seg('P', 'Větev', [0, zb], [-Yo, zt], Bt(1), T), seg('P', 'Větev', [0, zb], [Yo, zt], Bt(1), T)];
      }
      case 'VJ': {
        const fw = Math.max(Wf * 0.42, 2 * s + 60), g1 = Math.max(Wf * 0.05, s * 0.8), g2 = Math.max(Wf * 0.16, g1 + 1.8 * s);
        return [seg('F', 'Patka', [-fw, h], [fw, h], R, R),
          seg('P', 'Paprsek vnější', [-g2, h], [-Yo, zt], Bt(0), T), seg('P2', 'Paprsek vnitřní', [-g1, h], [-Wf / 6, zt], Bt(0), T),
          seg('P2', 'Paprsek vnitřní', [g1, h], [Wf / 6, zt], Bt(0), T), seg('P', 'Paprsek vnější', [g2, h], [Yo, zt], Bt(0), T)];
      }
      case 'MD': {
        const r = U(), yv = -Wf * 0.18;
        r.push(seg('P', 'Svislá příčka', [yv, h], [yv, zt], Bt(2), T), seg('P2', 'Vodorovná příčka horní', [-Yo, zt * 0.58], [yv, zt * 0.58], Bt(0), Bt(3)),
          seg('P3', 'Vodorovná příčka dolní', [yv, zt * 0.3], [Yo, zt * 0.3], Bt(3), Bt(1)));
        return r;
      }
      case 'MS': {
        const r = U(), q = s * 0.9, b0 = Yo - 1.8 * s, tq = Wf * 0.25;
        r.push(seg('D1', 'Diagonála krajní', [-b0, h], [-tq - q, zt], Bt(2), T), seg('D2', 'Diagonála vnitřní', [-q, h], [-tq + q, zt], Bt(2), T),
          seg('D2', 'Diagonála vnitřní', [q, h], [tq - q, zt], Bt(2), T), seg('D1', 'Diagonála krajní', [b0, h], [tq + q, zt], Bt(2), T));
        return r;
      }
      case 'SC': {
        const z2 = zt * 0.5;
        return [seg('L', 'Noha', [-Yo, 0], [-Yo, zt], F, T), seg('S1', 'Schod – horní svislý', [Yo, z2], [Yo, zt], M(2), T),
          seg('S2', 'Schod – vodorovný', [0, z2], [Yo, z2], M(3), M(1)), seg('S3', 'Schod – dolní svislý', [0, h], [0, z2], M(4), M(2)),
          seg('S4', 'Schod – patka', [0, h], [Yo, h], M(3), R)];
      }
      case 'ST': {
        const r = U(), b0 = Yo - 1.6 * s, q = s * 0.9;
        r.push(seg('P', 'Diagonála štítu', [-b0, h], [-q, zt], Bt(2), T), seg('P', 'Diagonála štítu', [b0, h], [q, zt], Bt(2), T));
        return r;
      }
      case 'OK': {
        const r = U(), wi = Math.max(Wf * 0.2, 2 * s), z1 = zt * 0.3, z2 = zt * 0.7, zm = (z1 + z2) / 2;
        r.push(seg('W1', 'Okno – vodorovné', [-wi, z1], [wi, z1], M(4), M(5)), seg('W2', 'Okno – svislé', [-wi, z1], [-wi, z2], M(3), M(6)),
          seg('W2', 'Okno – svislé', [wi, z1], [wi, z2], M(3), M(6)), seg('W1', 'Okno – vodorovné', [-wi, z2], [wi, z2], M(4), M(5)),
          seg('P', 'Spojka boční', [-Yo, zm], [-wi, zm], Bt(0), Bt(4)), seg('P', 'Spojka boční', [Yo, zm], [wi, zm], Bt(1), Bt(5)),
          seg('P2', 'Spojka horní', [0, z2], [0, zt], Bt(6), T), seg('P3', 'Spojka dolní', [0, h], [0, z1], Bt(2), Bt(3)));
        return r;
      }
    }
    return U();
  }

  function build(cfgIn, ratesIn) {
    const cfg = normalize(cfgIn), R = rates0(ratesIn);
    const s = cfg.size, t = cfg.t, h = s / 2, a = s >= 30 ? s / 4 : 4, cl = R.tabClear;
    const { Lf, Wf, Hf } = frameDims(cfg);
    const X = Lf / 2 - h, Yo = Wf / 2 - h;
    const ex = [1, 0, 0], ey = [0, 1, 0], ez = [0, 0, 1];
    const bolted = cfg.join === 'bolt' && boltAllowed(cfg, R);
    const parts = [];          // {poz, name, m(frame), solid, cut1, cut2}
    const slotsFor = [];      // drážky pro zámky nohou: {x, y} středy nohou a stopy zámků
    const push = (poz, name, m, c1, c2, opt) => { const sol = tube(m, s, t, c1, c2, opt); parts.push({ poz, name, m, solid: sol, cut1: c1, cut2: c2 }); return sol; };
    const zTop = Hf - s;                      // spodní líc horního rámu
    const boltPts = [], hw = [];
    let railY = Yo, Ls, weldJoints = 0, caps = 0;

    if (!bolted) {
      /* ----- SVAŘOVANÉ: horní rám 45°, boky z definice, nohy se zámky do rámu (nebo do vnitřní příčky) ----- */
      const Xl = X;                         // rovina boků = pod příčným jeklem obvodového rámu
      const defs = sideDef(cfg.model, Wf, zTop, s);
      const tops = [];                      // stopy zámků: {x, y, foot}
      let free = 0, joints = 0;
      const needCross = false;              // nohy končí vždy pod obvodovým rámem
      /* Zámky do horního rámu: drážka musí ležet celá v rovné části spodní stěny jeklu rámu (ne v rohu –
         rádius ~2,4 t), zhruba uprostřed její šířky a nesmí přetékat přes pokos. Ze 4 stěn dílu se proto
         vyberou jen ty, jejichž zámek takhle padne – u nohy v rohu rámu to jsou dvě vnitřní stěny
         (jedna do podélného, druhá do příčného jekla), u dílu pod příčným jeklem dvě stěny napříč jeklem. */
      const ownerAt = (x, y) => {
        const inR = Math.abs(Math.abs(y) - Yo) <= h && Math.abs(x) <= Lf / 2, inS = Math.abs(Math.abs(x) - X) <= h && Math.abs(y) <= Wf / 2;
        if (inR && inS) return Lf / 2 - Math.abs(x) > Wf / 2 - Math.abs(y) ? 'R' + Math.sign(y) : 'S' + Math.sign(x);
        return inR ? 'R' + Math.sign(y) : inS ? 'S' + Math.sign(x) : null;
      };
      const flat = h - 2.4 * t;
      const tabSpot = (fp) => {                // fp = obrys zámku dole i nahoře (celý průchod stěnou rámu)
        const xs = fp.map((p) => p[0]), ys = fp.map((p) => p[1]);
        const x0 = Math.min(...xs) - cl, x1 = Math.max(...xs) + cl, y0 = Math.min(...ys) - cl, y1 = Math.max(...ys) + cl;
        const C = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], own = C.map(([x, y]) => ownerAt(x, y));
        if (!own[0] || own.some((o) => o !== own[0])) return null;
        // můstek k pokosu aspoň tloušťka stěny
        if (C.some(([x, y]) => Math.abs(Math.abs(y) - Yo) <= h && Math.abs(Math.abs(x) - X) <= h && Math.abs((Lf / 2 - Math.abs(x)) - (Wf / 2 - Math.abs(y))) / Math.SQRT2 < t)) return null;
        const o = own[0], rail = o[0] === 'R', c = rail ? Number(o.slice(1)) * Yo : Number(o.slice(1)) * X;
        const lo = (rail ? y0 : x0) - c, hi = (rail ? y1 : x1) - c;
        if (lo < -flat - 1e-6 || hi > flat + 1e-6 || Math.abs((lo + hi) / 2) > Math.max(2, 0.1 * s)) return null;
        // můstek k už použitým drážkám ve stejném jeklu aspoň 2× tloušťka stěny
        if (taken.some((q) => q.o === o && x0 < q.x1 + 2 * t && q.x0 < x1 + 2 * t && y0 < q.y1 + 2 * t && q.y0 < y1 + 2 * t)) return null;
        return { o, x0, x1, y0, y1 };
      };
      const taken = [];
      const ALLW = ['+v', '-v', '+w', '-w'];
      /* Díl se zámky jde nasadit jen ve směru zámků. Když se dva (nebo víc) takových dílů v boku navzájem
         blokují (šikmé větve ze společného uzlu – každá by cestou po své ose projela tou druhou), nedá se
         sestavit v žádném pořadí: jednomu z nich se zámky zruší (jen svar, nasadí se bokem). Boky jsou
         rovinné, takže stačí 2D test v rovině boku (y, z): obálka dílu posunutá proti směru zámku. */
      const hull2 = (pts) => convexHull(pts.map((p) => [p[1], p[2]]));
      const overlap2 = (A2, B2, tol) => {          // konvexní mnohoúhelníky se překrývají víc než tol (SAT)
        for (const P of [A2, B2]) for (let k = 0; k < P.length; k++) {
          const a0 = P[k], a1 = P[(k + 1) % P.length], nx = a0[1] - a1[1], ny = a1[0] - a0[0], l = Math.hypot(nx, ny);
          if (l < 1e-9) continue;
          const pr = (Q) => Q.map((q) => (q[0] * nx + q[1] * ny) / l), pa = pr(A2), pb = pr(B2);
          if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= tol) return false;
        }
        return true;
      };
      const dropBlockedTabs = (plan) => {
        const D = 3 * Math.max(Wf, Hf);
        for (let guard = 0; guard < plan.length; guard++) {
          const tabbed = plan.map((P, i) => i).filter((i) => plan[i].opt.tab1 || plan[i].opt.tab2);
          if (tabbed.length < 2) return;
          const geo = plan.map((P) => hull2(tube(P.mT, s, t, P.c1, P.c2, P.opt).verts));
          const sweep = (i) => { const T = plan[i].opt.tab2 || plan[i].opt.tab1; return convexHull(geo[i].concat(geo[i].map((q) => [q[0] - T.d[1] * D, q[1] - T.d[2] * D]))); };
          const blk = {};
          tabbed.forEach((i) => { const S = sweep(i); blk[i] = tabbed.filter((j) => j !== i && overlap2(S, geo[j], 0.5)); });
          // cyklus v grafu „i blokuje j“ (j musí jít dřív než i … a naopak)
          let cyc = null;
          const st = {}, path = [];
          const dfs = (i) => { st[i] = 1; path.push(i); for (const j of blk[i]) { if (cyc) return; if (st[j] === 1) { cyc = path.slice(path.indexOf(j)); return; } if (!st[j]) dfs(j); } path.pop(); st[i] = 2; };
          tabbed.forEach((i) => { if (!st[i] && !cyc) dfs(i); });
          if (!cyc) return;
          const nt = (i) => ((plan[i].opt.tab1 || {}).walls || []).length + ((plan[i].opt.tab2 || {}).walls || []).length;
          const victim = cyc.slice().sort((x, y) => nt(x) - nt(y) || y - x)[0];
          delete plan[victim].opt.tab1; delete plan[victim].opt.tab2;
        }
      };
      // stěny, ze kterých zámek padne doprostřed rovné stěny rámu; když je u pokosu těsno, zámek se trochu zkrátí
      // Zámek je kus stěny jeklu – vede v její rovině, tedy po ose dílu (u šikmého dílu šikmo) a projde
      // spodní stěnou rámu (svisle o t); drážka v rámu je obdélník, kterým projde celý zámek.
      const tabFor = (m, c1, c2, e) => {
        const d = e === 2 ? m.u : mul(m.u, -1);
        if (d[2] < 0.5) return null;            // moc plochý díl – zámek by byl dlouhý, jen svar
        const len = t / d[2];
        let best = null;
        [a, a * 0.9, a * 0.8].forEach((aa) => {
          const T = { d, len, a: aa, walls: ALLW }, sol = tube(m, s, t, c1, c2, e === 1 ? { tab1: T } : { tab2: T });
          const ok = sol.tabWalls[e].map((id, k) => { const q = sol.tabFoot[e][k]; return [id, tabSpot(q.concat(q.map((p) => add(p, mul(d, len)))))]; }).filter((x) => x[1]);
          if (!best || ok.length > best.ok.length) best = { aa, ok };
        });
        if (!best.ok.length) return null;
        best.ok.forEach((x) => taken.push(x[1]));
        return { d, len, a: best.aa, walls: best.ok.map((x) => x[0]) };
      };
      // spodní spojky u Kostky: drážky ve vnitřní stěně spodní příčky
      const kostka = cfg.model === 'K', yb = Wf / 2 - 1.5 * s - 5;
      for (const sx of [-1, 1]) {
        const x = sx * Xl, P3 = (p) => [x, p[0], p[1]];
        const dir2 = (d) => { const dy = d.b[0] - d.a[0], dz = d.b[1] - d.a[1], l = Math.hypot(dy, dz); return [dy / l, dz / l]; };
        const cutAt = (i, end) => {
          const d = defs[i], e = end === 1 ? d.ea : d.eb, node = end === 1 ? d.a : d.b, other = end === 1 ? d.b : d.a;
          const dd = dir2(d);
          if (e.t === 'floor') return plane([0, 0, 0], ez);
          if (e.t === 'top') return plane([0, 0, zTop], ez);
          if (e.t === 'free') return plane(P3(node), [0, dd[0], dd[1]]);
          const o = defs[e.j], od = dir2(o);
          if (e.t === 'butt') {
            let n = [-od[1], od[0]];
            const sg = Math.sign((other[0] - node[0]) * n[0] + (other[1] - node[1]) * n[1]) || 1;
            n = [n[0] * sg, n[1] * sg];
            // průsečík osy s osou úseku j = uzel; rovina = stěna úseku j obrácená k tomuto úseku
            const base = lineX(d.a, d.b, o.a, o.b);
            return plane(P3([base[0] + n[0] * h, base[1] + n[1] * h]), [0, n[0], n[1]]);
          }
          // pokos: vnější a vnitřní roh z odsazených os
          const dA = end === 1 ? dd : [-dd[0], -dd[1]];
          const oNode = (Math.hypot(o.a[0] - node[0], o.a[1] - node[1]) < 1e-6) ? 1 : 2;
          const dB = oNode === 1 ? od : [-od[0], -od[1]];
          const nA = [-dA[1], dA[0]], nB = [-dB[1], dB[0]];
          const sA = Math.sign(nA[0] * dB[0] + nA[1] * dB[1]) || 1, sB = Math.sign(nB[0] * dA[0] + nB[1] * dA[1]) || 1;
          const off = (p, n, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
          const iA = off(node, nA, sA * h), oA = off(node, nA, -sA * h), iB = off(node, nB, sB * h), oB = off(node, nB, -sB * h);
          const ic = lineX(iA, [iA[0] + dA[0], iA[1] + dA[1]], iB, [iB[0] + dB[0], iB[1] + dB[1]]);
          const oc = lineX(oA, [oA[0] + dA[0], oA[1] + dA[1]], oB, [oB[0] + dB[0], oB[1] + dB[1]]);
          return cornerPlane(P3(oc), P3(ic), ex);
        };
        const plan = defs.map((d, i) => {
          const dd = dir2(d), c1 = cutAt(i, 1), c2 = cutAt(i, 2);
          const opt = {}, mT = frame(P3(d.a), P3(d.b), [0, -dd[1], dd[0]]);
          if (d.ea.t === 'top') opt.tab1 = tabFor(mT, c1, c2, 1) || undefined;
          if (d.eb.t === 'top') opt.tab2 = tabFor(mT, c1, c2, 2) || undefined;
          return { d, dd, c1, c2, opt, mT };
        });
        dropBlockedTabs(plan);
        plan.forEach(({ d, dd, c1, c2, opt }) => {
          if (kostka && d.g === 'B') {
            const inner = sx > 0 ? '+v' : '-v', m0 = frame(P3(d.a), P3(d.b), [0, -dd[1], dd[0]]);
            opt.holes = [];
            for (const sy of [-1, 1]) {
              const yc = sy * yb - m0.p1[1] * Math.sign(m0.u[1]);
              const along = (y) => (y - m0.p1[1]) * m0.u[1];
              [[sy * yb + h - t, sy * yb + h], [sy * yb - h, sy * yb - h + t]].forEach(([y0, y1]) => {
                const a0 = along(y0), a1 = along(y1);
                opt.holes.push({ wall: inner, pts: rect(Math.min(a0, a1) - cl, Math.max(a0, a1) + cl, -a - cl, a + cl) });
              });
              void yc;
            }
          }
          const sol = push(d.g, d.n, frame(P3(d.a), P3(d.b), [0, -dd[1], dd[0]]), c1, c2, opt);
          // stopa zámku v rámu = dolní i horní obrys (u šikmého zámku se posune)
          const pass = (e) => sol.tabFoot[e].map((q) => q.concat(q.map((p) => add(p, mul(sol.tabDir[e].d, sol.tabDir[e].len)))));
          if (d.ea.t === 'top' && sol.tabFoot[1]) tops.push({ x, y: d.a[0], foot: pass(1) });
          if (d.eb.t === 'top' && sol.tabFoot[2]) tops.push({ x, y: d.b[0], foot: pass(2) });
          [d.ea, d.eb].forEach((e) => { if (e.t === 'free') free++; else if (e.t === 'butt' || e.t === 'top') joints++; else if (e.t === 'miter') joints += 0.5; });
        });
      }
      const footSlot = (fp, m, wall) => {
        const across = wall.indexOf('v') >= 0 ? m.w : m.v;
        const xs = fp.map((p) => dot(sub(p, m.p1), m.u)), cs = fp.map((p) => dot(sub(p, m.p1), across));
        return { wall, pts: rect(Math.min(...xs) - cl, Math.max(...xs) + cl, Math.min(...cs) - cl, Math.max(...cs) + cl) };
      };
      // do kterého jeklu rámu zámek padne: u rohu rozhoduje pokosová čára (dál od čela než od boku = podélný jekl)
      const footOwner = (fp) => {
        const cx = fp.reduce((q, p) => q + p[0], 0) / fp.length, cy = fp.reduce((q, p) => q + p[1], 0) / fp.length;
        const own = ownerAt(cx, cy); if (own) return own;
        const dEnd = Lf / 2 - Math.abs(cx), dSide = Wf / 2 - Math.abs(cy);
        if (dSide <= s && (dEnd > dSide || dEnd > s)) return 'R' + Math.sign(cy);
        return 'S' + Math.sign(cx);
      };
      // vnitřní příčky rámu (nad boky), když některá noha nekončí pod podélným jeklem
      const crossFeet = { '-1': [], '1': [] };
      if (needCross) {
        for (const sx of [-1, 1]) {
          const x = sx * Xl, yE = Wf / 2 - s;
          const m = frame([x, -yE, Hf - h], [x, yE, Hf - h], ez);
          const holes = [];
          tops.filter((tp) => Math.sign(tp.x) === sx && Math.abs(Math.abs(tp.y) - Yo) > 0.5).forEach((tp) => tp.foot.forEach((fp) => holes.push(footSlot(fp, m, '-w'))));
          const sol = push('C', 'Rám – vnitřní příčka', m, plane([0, -yE, 0], ey), plane([0, yE, 0], ey), { tab1: { d: mul(ey, -1), len: t, a }, tab2: { d: ey, len: t, a }, holes });
          crossFeet['-1'].push(...sol.tabFoot[1]); crossFeet['1'].push(...sol.tabFoot[2]);
          joints += 2;
        }
      }
      // spodní spojky u Kostky
      if (kostka) {
        const xE = Xl - h;
        for (const sy of [-1, 1]) {
          push('BR', 'Spodní spojka', frame([-xE, sy * yb, h], [xE, sy * yb, h], ez), plane([-xE, 0, 0], ex), plane([xE, 0, 0], ex),
            { tab1: { d: mul(ex, -1), len: t, a }, tab2: { d: ex, len: t, a } });
          joints += 2;
        }
      }
      // horní rám: 4 jekly, pokosy 45° ve vodorovné rovině; drážky pro zámky nohou a vnitřních příček
      const corner = (sx, sy) => cornerPlane([sx * Lf / 2, sy * Wf / 2, 0], [sx * (Lf / 2 - s), sy * (Wf / 2 - s), 0], ez);
      const railHoles = {};
      for (const sy of [-1, 1]) {
        const m = frame([-Lf / 2, sy * Yo, Hf - h], [Lf / 2, sy * Yo, Hf - h], ez);
        const holes = [];
        tops.forEach((tp) => tp.foot.forEach((fp) => { if (footOwner(fp) === 'R' + sy) holes.push(footSlot(fp, m, '-w')); }));
        crossFeet[String(sy)].forEach((fp) => holes.push(footSlot(fp, m, sy > 0 ? '-v' : '+v')));
        railHoles[sy] = holes;
      }
      const sameRails = JSON.stringify(railHoles[-1].map((x) => x.pts.map((p) => p.map((v) => Math.round(v * 10))).sort())) === JSON.stringify(railHoles[1].map((x) => x.pts.map((p) => [p[0], -p[1]].map((v) => Math.round(v * 10)))).sort());
      for (const sy of [-1, 1]) {
        const m = frame([-Lf / 2, sy * Yo, Hf - h], [Lf / 2, sy * Yo, Hf - h], ez);
        const poz = sameRails || sy < 0 ? 'R' : 'R2';
        parts.push({ poz, name: 'Rám – podélný jekl' + (sameRails ? '' : sy < 0 ? ' (strana A)' : ' (strana B)'), m, solid: tube(m, s, t, corner(-1, sy), corner(1, sy), { holes: railHoles[sy] }), cut1: corner(-1, sy), cut2: corner(1, sy) });
      }
      for (const sx of [-1, 1]) {
        const m = frame([sx * X, -Wf / 2, Hf - h], [sx * X, Wf / 2, Hf - h], ez), holes = [];
        tops.forEach((tp) => tp.foot.forEach((fp) => { if (footOwner(fp) === 'S' + sx) holes.push(footSlot(fp, m, '-w')); }));
        push('S', 'Rám – příčný jekl', m, corner(sx, -1), corner(sx, 1), { holes });
      }
      joints += 4;
      weldJoints = Math.round(joints);
      caps = free;
      if (free) hw.push({ name: 'Plastová zátka ' + s + '×' + s, q: free });
      Ls = 2 * Xl - s;
    } else {

      /* ----- ŠROUBOVANÉ: svařené boky (pokosy 45°) + přišroubované spojky ----- */
      const M8 = s >= 40;
      const bolt = { d: M8 ? 'M8' : 'M6', hole: M8 ? 4.5 : 3.3, access: M8 ? 8 : 6 };
      railY = Wf / 2 - s - h - 5;           // spojky odsazené od rohu boku, aby nezasahovaly do pokosu
      const railX = Lf / 2 - s;             // konec spojky = vnitřní líc boku
      for (const sx of [-1, 1]) {
        const x = sx * X, yz = (y, z) => [x, y, z];
        const cTL = cornerPlane(yz(-Wf / 2, Hf), yz(-Wf / 2 + s, Hf - s), ex), cTR = cornerPlane(yz(Wf / 2, Hf), yz(Wf / 2 - s, Hf - s), ex);
        // horní příčka boku: v = -x -> stěna +v míří k -x
        const m = frame(yz(-Wf / 2, Hf - h), yz(Wf / 2, Hf - h), ez);
        const inner = sx > 0 ? '+v' : '-v', outer = sx > 0 ? '-v' : '+v';
        const holes = [];
        for (const sy of [-1, 1]) {
          const yc = sy * railY - m.p1[1];   // poloha podél příčky
          // drážky pro zámky spojky (zámky na stěnách spojky kolmých na y)
          holes.push({ wall: inner, pts: rect(yc + h - t - cl, yc + h + cl, -a - cl, a + cl) });
          holes.push({ wall: inner, pts: rect(yc - h - cl, yc - h + t + cl, -a - cl, a + cl) });
          holes.push({ wall: inner, pts: circle(yc, 0, bolt.hole) });
          holes.push({ wall: outer, pts: circle(yc, 0, bolt.access) });
          boltPts.push([sx * (Lf / 2 - h), sy * railY, Hf - h]);
        }
        push('S', 'Bok – horní příčka', m, cTL, cTR, { holes });
        if (cfg.model === 'U') {
          const cBL = cornerPlane(yz(-Wf / 2, 0), yz(-Wf / 2 + s, s), ex), cBR = cornerPlane(yz(Wf / 2, 0), yz(Wf / 2 - s, s), ex);
          push('B', 'Bok – spodní příčka', frame(yz(-Wf / 2, h), yz(Wf / 2, h), ez), cBL, cBR);
          push('L', 'Bok – noha', frame(yz(-Yo, 0), yz(-Yo, Hf), [0, -1, 0]), cBL, cTL);
          push('L', 'Bok – noha', frame(yz(Yo, 0), yz(Yo, Hf), [0, 1, 0]), cBR, cTR);
        } else {
          push('L', 'Bok – noha', frame(yz(-Yo, 0), yz(-Yo, Hf), [0, -1, 0]), plane([0, 0, 0], ez), cTL);
          push('L', 'Bok – noha', frame(yz(Yo, 0), yz(Yo, Hf), [0, 1, 0]), plane([0, 0, 0], ez), cTR);
        }
      }
      for (const sy of [-1, 1]) {
        push('R', 'Spojka šroubovaná', frame([-railX, sy * railY, Hf - h], [railX, sy * railY, Hf - h], ez), plane([-railX, 0, 0], ex), plane([railX, 0, 0], ex),
          { tab1: { d: mul(ex, -1), len: t, a }, tab2: { d: ex, len: t, a } });
      }
      const nb = 4, need = t + 3 + (M8 ? 6.5 : 5) + 3, bl = [12, 16, 20, 25, 30].find((x) => x >= need) || 30;
      hw.push({ name: 'Šroub ' + bolt.d + '×' + bl + ' DIN 912 + podložka', q: nb });
      hw.push({ name: 'Přivařovací matice ' + bolt.d + ' DIN 929', q: nb });
      hw.push({ name: 'Plastová záslepka Ø' + 2 * bolt.access, q: nb });
      hw.push({ name: 'Imbusový klíč (přibalit)', q: 1 });
      Ls = Lf - 2 * s;
    }

    /* úchytky desky: počet podle délky a šířky (max. rozteč z ceníku) */
    const P = R.plate, sp = Math.max(200, R.plateSpacing || 450);
    const plateBoxes = [];
    const span = Lf - 2 * s - 2 * 60 - P.w;
    const nLong = Math.max(2, Math.ceil(span / sp) + 1);
    const plateY = bolted ? railY : Yo;
    for (const sy of [-1, 1]) for (let k = 0; k < nLong; k++) {
      const xc = -span / 2 - P.w / 2 + span * (k / (nLong - 1));
      const y0 = sy * (plateY - h);
      plateBoxes.push(boxSolid([xc, y0, Hf - P.t], [P.w, 0, 0], [0, -sy * P.l, 0], [0, 0, P.t]));
    }
    const shortSpan = Wf - 2 * s;
    const nShort = shortSpan >= 500 ? Math.max(1, Math.ceil((shortSpan - 2 * 150) / sp)) : 0;
    for (const sx of [-1, 1]) for (let k = 0; k < nShort; k++) {
      const yc = nShort === 1 ? -P.w / 2 : -(shortSpan / 2 - 150) + (shortSpan - 300 - P.w) * (k / (nShort - 1));
      const x0 = sx * (Lf / 2 - s);
      plateBoxes.push(boxSolid([x0, yc, Hf - P.t], [-sx * P.l, 0, 0], [0, P.w, 0], [0, 0, P.t]));
    }
    const plates = [{ name: 'Úchytka desky, otvor Ø6', w: P.w, l: P.l, t: P.t, q: plateBoxes.length, holes: [[P.w / 2, P.l * 0.65, 3]] }];
    if (bolted) {
      const e = Math.round((s - 2 * t - 0.4) * 10) / 10;
      plates.push({ name: 'Koncová deska spojky (zavařit, matice ' + (s >= 40 ? 'M8' : 'M6') + ')', w: e, l: e, t: 3, q: 4, holes: [[e / 2, e / 2, s >= 40 ? 4.5 : 3.3]] });
    }
    return { cfg, parts, plates, plateBoxes, boltPts, hw, dims: { Lf, Wf, Hf }, bolted, Ls, railY, weldJoints };
  }

  /* lokální souřadnice dílu (osa X od 0) */
  function toLocal(part) {
    const m = part.m, S = part.solid;
    const loc = S.verts.map((p) => { const d = sub(p, m.p1); return [dot(d, m.u), dot(d, m.v), dot(d, m.w)]; });
    const mn = Math.min.apply(null, loc.map((p) => p[0]));
    loc.forEach((p) => { p[0] -= mn; });
    const faces = S.faces.map((f) => ({ outer: f.outer, inner: f.inner, n: [dot(f.n, m.u), dot(f.n, m.v), dot(f.n, m.w)] }));
    return { verts: loc, faces };
  }
  const partLength = (part) => { const L = toLocal(part).verts.map((p) => p[0]); return Math.max.apply(null, L); };
  const cutAngles = (part) => [part.cut1, part.cut2].map((c) => Math.round(Math.acos(Math.min(1, Math.abs(dot(unit(c.n), part.m.u)))) * 1800 / Math.PI) / 10);

  function deskOutline(shape, DL, DW) {
    const hx = DL / 2, hy = DW / 2, out = [];
    const arc = (cx, cy, rx, ry, a0, a1, n) => { for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } };
    const PI = Math.PI;
    if (shape === 'rect') out.push([-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]);
    else if (shape === 'round') { const r = Math.min(100, DL / 4, DW / 4); arc(hx - r, -hy + r, r, r, -PI / 2, 0, 8); arc(hx - r, hy - r, r, r, 0, PI / 2, 8); arc(-hx + r, hy - r, r, r, PI / 2, PI, 8); arc(-hx + r, -hy + r, r, r, PI, 1.5 * PI, 8); }
    else if (shape === 'stadium' && DL > DW) { arc(hx - hy, 0, hy, hy, -PI / 2, PI / 2, 24); arc(-hx + hy, 0, hy, hy, PI / 2, 1.5 * PI, 24); }
    else arc(0, 0, hx, hy, 0, 2 * PI * 63 / 64, 63);
    return out;
  }

  const nf = (n, d) => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const POZ_ORDER = ['R', 'R2', 'S', 'C', 'L', 'L2', 'B', 'B2', 'P', 'P2', 'P3', 'F', 'D1', 'D2', 'D3', 'Z1', 'Z2', 'Z3', 'S1', 'S2', 'S3', 'S4', 'W1', 'W2', 'BR'];

  function analyzeCore(cfgIn, ratesIn) {
    const R = rates0(ratesIn);
    const B = build(cfgIn, R);
    const cfg = B.cfg, s = cfg.size, t = cfg.t, F = FIN.find((f) => f.id === cfg.fin);
    const groups = {};
    B.parts.forEach((p) => { (groups[p.poz] = groups[p.poz] || []).push(p); });
    const rows = [], problems = [];
    let tubeM = 0, kg = 0, n = 0;
    // stejná pozice, ale jiný počet zámků (díl, kterému se zámky zrušily kvůli sestavitelnosti) = samostatná položka
    const nTabs = (p) => ((p.solid.tabFoot || {})[1] || []).length + ((p.solid.tabFoot || {})[2] || []).length;
    const subGroups = [];
    POZ_ORDER.filter((k) => groups[k]).forEach((k) => {
      const by = {};
      groups[k].forEach((p) => { (by[nTabs(p)] = by[nTabs(p)] || []).push(p); });
      const keys = Object.keys(by).sort((a, b) => b - a);
      keys.forEach((nk) => subGroups.push([k, by[nk], keys.length > 1 && Number(nk) === 0]));
    });
    subGroups.forEach(([k, g, noTab]) => {
      const p = g[0], L = partLength(p), vol = volume(p.solid), an = cutAngles(p);
      g.forEach((q) => { if (Math.abs(partLength(q) - L) > 0.3 || Math.abs(volume(q.solid) - vol) > 5) problems.push(k + ': kusy nejsou shodné'); });
      n++;
      const poz = 'P' + String(n).padStart(2, '0');
      const feat = [];
      if (p.solid.tabFoot[1] || p.solid.tabFoot[2]) feat.push('zámky');
      const nh = p.solid.faces.reduce((acc, f) => acc + f.inner.length, 0) - (p.solid.tabFoot[1] ? 0 : 1) - (p.solid.tabFoot[2] ? 0 : 1);
      if (nh > 0) feat.push(['R', 'R2', 'S'].indexOf(k) >= 0 && !B.bolted ? 'drážky' : 'otvory');
      tubeM += L * g.length / 1000; kg += vol * 7.85e-6 * g.length;
      rows.push({ poz, name: p.name + (noTab ? ' – bez zámku' : ''), kind: 'tube', prof: 'jekl ' + s + '×' + s + '×' + t, L, len: L.toFixed(1), cut: an[0] + '° / ' + an[1] + '°', feat: feat.join(', '), q: g.length, stroj: 'K2', file: poz + '_L' + Math.round(L) + '_' + g.length + 'ks.step', part: p });
    });
    B.plates.forEach((p) => {
      n++;
      p.poz = 'P' + String(n).padStart(2, '0');
      kg += p.w * p.l * p.t * 7.85e-6 * p.q;
      rows.push({ poz: p.poz, name: p.name, kind: 'plate', prof: 'plech ' + p.t + ' mm', len: nf(p.w, 1) + ' × ' + nf(p.l, 1), cut: 'pálení', feat: '', q: p.q, stroj: 'C2', file: p.poz + '_plech' + p.t + '_' + p.w + 'x' + p.l + '_' + p.q + 'ks.dxf', plate: p });
    });
    B.hw.forEach((x) => { n++; rows.push({ poz: 'P' + String(n).padStart(2, '0'), name: x.name, kind: 'hw', prof: 'nakupovaný díl', len: '', cut: '', feat: '', q: x.q, stroj: '', file: '' }); });
    let welds = B.weldJoints, bolts = 0;
    if (B.bolted) { welds = (cfg.model === 'U' ? 8 : 4) + 4; bolts = 4; }
    const surf = tubeM * 4 * s / 1000;
    const cuts = rows.filter((r) => r.kind !== 'hw').reduce((acc, r) => acc + r.q, 0);
    const markup = 1 + R.marze / 100;
    const cost = kg * R.kg + cuts * R.rez + welds * R.svar + bolts * R.sroub + surf * R.barva * F.k + R.priprava;
    const price = Math.round(cost * markup / 10) * 10;
    const vat = Math.round(price * 1.21 / 10) * 10;
    const I = (s * Math.pow(s, 3) - (s - 2 * t) * Math.pow(s - 2 * t, 3)) / 12, Wel = I / (s / 2), Ls = B.Ls;
    const Qs = 16 * 160 * Wel / Ls, Qd = 2 * 384 * 210000 * I / (1500 * Ls * Ls);
    const load = Math.floor(Math.min(Qs, Qd) / 9.81 / 1.5 * (B.bolted ? 0.85 : 1) / 10) * 10;
    return { R, B, cfg, rows, tubeM, kg, welds, bolts, price, vat, load, problems };
  }

  /* Kusovník, hmotnost, cena, nosnost, upozornění */
  function analyze(cfgIn, ratesIn) {
    const ex = cfgIn && extFor(cfgIn.model); if (ex) return ex.analyze(cfgIn, ratesIn);
    const X = analyzeCore(cfgIn, ratesIn), cfg = X.cfg, B = X.B, R = X.R, s = cfg.size;
    let lvl = X.load >= 150 ? 'ok' : X.load >= 80 ? 'warn' : 'bad';
    const warns = [];
    if (s === 20 && (cfg.L > 1000 || cfg.H > 800)) warns.push('Jekl 20×20 je určený pro malé stolky (noční, odkládací). Na větší stůl zvolte 30×30 a víc.');
    if (lvl === 'bad') warns.push('Na tuto délku je profil slabý – deska by se mohla prohýbat. Zvolte silnější jekl nebo kratší stůl.');
    if (lvl === 'warn') warns.push('Na běžné stolování stačí, na těžší zátěž (dílna, pracovní stůl) zvolte silnější profil.');
    if (B.dims.Hf / s > 22 && s > 20) warns.push('Vysoký stůl s tenkým profilem může být do strany pružný.');
    if (cfg.L > 2000 && cfg.model !== '4N') warns.push('U délky nad 2 m doporučujeme středovou výztuhu.');
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L, DW = cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const ohEnd = Math.round((DL - B.dims.Lf) / 2), ohSide = Math.round((DW - B.dims.Wf) / 2);
    let ohWarn = null;
    if (ohEnd < 0 || ohSide < 0) ohWarn = { lvl: 'bad', t: 'Podnož by vyčnívala zpod desky. Zmenšete podnož v kroku 2, nebo použijte tlačítko Přizpůsobit podnož desce.' };
    else if (ohEnd > 350 || ohSide > 250) ohWarn = { lvl: 'warn', t: 'Velký přesah desky – při opření o kraj se deska může prohýbat nebo stůl převážit.' };
    let boltDiff = 0;
    const boltOK = boltAllowed(cfg, R);
    if (boltOK) {
      const w = analyzeCore(Object.assign({}, cfg, { join: 'weld' }), R), b = analyzeCore(Object.assign({}, cfg, { join: 'bolt' }), R);
      boltDiff = b.vat - w.vat;
    }
    let au = null;
    try { au = audit(cfg, R); } catch (e) { au = null; }
    if (au) {
      X.load = Math.min(500, Math.floor(au.capKg / 10) * 10);
      const L2 = X.load >= 150 ? 'ok' : X.load >= 80 ? 'warn' : 'bad';
      warns.length = 0;
      if (s === 20 && (cfg.L > 1000 || cfg.H > 800)) warns.push('Jekl 20×20 je určený pro malé stolky (noční, odkládací). Na větší stůl zvolte 30×30 a víc.');
      if (L2 === 'bad') warns.push('Na tuto velikost je podnož slabá – deska by se mohla prohýbat. Zvolte silnější jekl nebo menší stůl.');
      if (L2 === 'warn') warns.push('Na běžné stolování stačí, na těžší zátěž (dílna, pracovní stůl) zvolte silnější profil.');
      const ck = (id) => au.checks.find((c) => c.id === id);
      if (ck('sway').lvl !== 'ok') warns.push(ck('sway').lvl === 'bad' ? 'Stůl bude do boku výrazně pružit (' + ck('sway').val.toFixed(0) + ' mm při opření) – zvolte silnější jekl nebo tvar s výztuhou.' : 'Stůl může do boku mírně pružit – pro klid zvolte silnější jekl.');
      if (ck('stab').lvl !== 'ok') warns.push(ck('stab').lvl === 'bad' ? 'Při opření o okraj desky se stůl může převrhnout – zmenšete přesah desky nebo zvolte jiný tvar.' : 'Při opření o úplný okraj desky je stůl na hraně stability.');
      if (ck('pt').lvl === 'bad' || ck('weld').lvl === 'bad') warns.push('Při soustředěné zátěži (opření, sednutí na stůl) by byla podnož přetížená – zvolte silnější jekl.');
      if (cfg.L > 2000 && ck('defl').lvl !== 'ok') warns.push('U této délky se rám znatelně prohýbá – doporučujeme silnější profil.');
      lvl = L2;
    }
    return Object.assign(X, { audit: au, build: B, lvl, warns, DL, DW, ohEnd, ohSide, ohWarn, boltOK, boltWhy: boltWhyNot(cfg, R), bolted: B.bolted, boltDiff, total: X.vat * cfg.qty });
  }

  function describe(cfg) {
    const ex = cfg && extFor(cfg.model); if (ex) return ex.describe(cfg);
    const M = MODELS.find((m) => m.id === cfg.model), F = FIN.find((f) => f.id === cfg.fin), S = SHAPES.find((x) => x.id === cfg.shape);
    const desk = cfg.shape === 'circle' ? 'Ø ' + nf(cfg.L) : nf(cfg.L) + ' × ' + nf(cfg.W);
    return M.lab + ', ' + desk + ' × ' + nf(cfg.H) + ' mm, jekl ' + cfg.size + '×' + cfg.size + '×' + cfg.t + ', ' + (cfg.join === 'bolt' ? 'šroubovaná' : 'svařovaná') + ', ' + F.lab + ', deska ' + S.lab.toLowerCase();
  }

  /* ---------- 2D náhled (malíř) – pro PDF a jako záloha bez WebGL ---------- */
  function paint(ctx, W, H, bodies, opts) {
    opts = opts || {};
    const az = (opts.az == null ? -35 : opts.az) * Math.PI / 180, el = (opts.el == null ? 24 : opts.el) * Math.PI / 180;
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const pj = (p) => { const xr = p[0] * ca - p[1] * sa, yr = p[0] * sa + p[1] * ca; return [xr, -p[2] * ce - yr * se, yr * ce - p[2] * se]; };
    const view = [0, Math.cos(el), -Math.sin(el)];
    const light = unit([-0.4, -0.6, 0.8]);
    const polys = [];
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    bodies.forEach((b) => {
      const P = b.verts.map(pj);
      P.forEach((q) => { mnx = Math.min(mnx, q[0]); mxx = Math.max(mxx, q[0]); mny = Math.min(mny, q[1]); mxy = Math.max(mxy, q[1]); });
      b.faces.forEach((f) => {
        const nr = [f.n[0] * ca - f.n[1] * sa, f.n[0] * sa + f.n[1] * ca, f.n[2]];
        if (dot(nr, view) > 0.001 && !b.alpha) return;
        const depth = f.outer.reduce((acc, i) => acc + P[i][2], 0) / f.outer.length;
        const shade = 0.55 + 0.45 * Math.max(0, dot(f.n, light));
        polys.push({ loops: [f.outer].concat(f.inner).map((lp) => lp.map((i) => P[i])), depth, color: b.color, shade, alpha: b.alpha || 1 });
      });
    });
    polys.sort((p, q) => q.depth - p.depth);
    const pad = opts.pad == null ? 0.06 : opts.pad;
    const sc = Math.min(W * (1 - 2 * pad) / (mxx - mnx), H * (1 - 2 * pad) / (mxy - mny));
    const ox = W / 2 - sc * (mnx + mxx) / 2, oy = H / 2 - sc * (mny + mxy) / 2;
    polys.forEach((p) => {
      ctx.beginPath();
      p.loops.forEach((lp) => { lp.forEach((q, i) => { const x = ox + q[0] * sc, y = oy + q[1] * sc; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); });
      const c = p.color, r = parseInt(c.substr(1, 2), 16), g = parseInt(c.substr(3, 2), 16), b2 = parseInt(c.substr(5, 2), 16);
      ctx.fillStyle = 'rgba(' + Math.round(r * p.shade) + ',' + Math.round(g * p.shade) + ',' + Math.round(b2 * p.shade) + ',' + p.alpha + ')';
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6; ctx.stroke();
    });
  }

  function previewBodies(A) {
    const fin = FIN.find((f) => f.id === A.cfg.fin);
    const col = A.cfg.fin === 'white' ? '#D8D8D4' : fin.sw === '#1E1F21' ? '#3A3C40' : fin.sw;
    return A.build.parts.map((p) => ({ verts: p.solid.verts, faces: p.solid.faces, color: col }))
      .concat(A.build.plateBoxes.map((b) => ({ verts: b.verts, faces: b.faces, color: '#B8440F' })));
  }


  /* =====================================================================
     AUDIT KONSTRUKCE: prutový model (3D rám, 6 stupňů volnosti v uzlu),
     zatěžovací stavy podle EN 12521 (domácí stoly) a výrobní kontroly pro Bodor K2/C2.
     Předpoklady: ocel S235 (fy 235 MPa), dovolené napětí 157 MPa (γ = 1,5), svary plně
     nosné a tuhé, deska se do tuhosti nepočítá (na straně bezpečnosti), nohy kloubově na zemi.
     ===================================================================== */
  const E = 210000, G = 81000, SIG_ALLOW = 157, WELD_ALLOW = 180;

  function frameGraph(cfgIn, ratesIn) {
    const cfg = normalize(cfgIn), R = rates0(ratesIn), s = cfg.size, h = s / 2;
    const { Lf, Wf, Hf } = frameDims(cfg), X = Lf / 2 - h, Yo = Wf / 2 - h, zr = Hf - h, zTop = Hf - s;
    const bolted = cfg.join === 'bolt' && boltAllowed(cfg, R);
    const lines = [], supportsAt = [], sideSegs = [];
    const L = (a, b, kind, tag) => lines.push({ a, b, kind: kind || 'tube', tag: tag || '' });
    let Xl;
    if (!bolted) {
      Xl = X;
      const defs = sideDef(cfg.model, Wf, zTop, s);
      let needCross = false;
      for (const sx of [-1, 1]) {
        const x = sx * Xl, P3 = (p) => [x, p[0], p[1]];
        defs.forEach((d, i) => {
          L(P3(d.a), P3(d.b), 'tube', 'side');
          if (sx > 0) sideSegs.push({ i, a: d.a, b: d.b, ea: d.ea, eb: d.eb });
          [[d.ea, d.a], [d.eb, d.b]].forEach(([e, p]) => {
            if (e.t === 'top') { L(P3(p), [x, p[0], zr], 'rigid'); if (Math.abs(Math.abs(p[0]) - Yo) > 0.5) needCross = true; }
            if (e.t === 'floor') supportsAt.push(P3(p));
          });
          if (d.a[1] <= h + 0.5 && d.b[1] <= h + 0.5) { supportsAt.push(P3(d.a)); supportsAt.push(P3(d.b)); }
        });
      }
      for (const sy of [-1, 1]) L([-X, sy * Yo, zr], [X, sy * Yo, zr], 'tube', 'top');
      for (const sx of [-1, 1]) L([sx * X, -Yo, zr], [sx * X, Yo, zr], 'tube', 'top');
      void needCross;
      if (cfg.model === 'K') { const yb = Wf / 2 - 1.5 * s - 5; for (const sy of [-1, 1]) L([-Xl, sy * yb, h], [Xl, sy * yb, h]); }
    } else {
      Xl = X;
      const railY = Wf / 2 - s - h - 5;
      for (const sx of [-1, 1]) {
        const x = sx * X;
        L([x, -Yo, zr], [x, Yo, zr], 'tube', 'top');
        for (const sy of [-1, 1]) {
          const z0 = cfg.model === 'U' ? h : 0;
          L([x, sy * Yo, z0], [x, sy * Yo, zr]);
          supportsAt.push([x, sy * Yo, z0]);
        }
        if (cfg.model === 'U') L([x, -Yo, h], [x, Yo, h]);
      }
      for (const sy of [-1, 1]) L([-X, sy * railY, zr], [X, sy * railY, zr], 'tube', 'top');
    }
    // uzly a rozdělení prutů v bodech, které na nich leží
    const nodes = [], key = (p) => nodes.findIndex((q) => Math.abs(q[0] - p[0]) < 0.5 && Math.abs(q[1] - p[1]) < 0.5 && Math.abs(q[2] - p[2]) < 0.5);
    const nodeOf = (p) => { let k = key(p); if (k < 0) { k = nodes.length; nodes.push(p.slice()); } return k; };
    const allPts = [];
    lines.forEach((l) => { allPts.push(l.a, l.b); });
    supportsAt.forEach((p) => allPts.push(p));
    const els = [];
    lines.forEach((l) => {
      const d = sub(l.b, l.a), Ln = len(d), u = mul(d, 1 / Ln);
      const inner = allPts.map((p) => ({ p, t: dot(sub(p, l.a), u) }))
        .filter((q) => q.t > 0.5 && q.t < Ln - 0.5 && len(sub(q.p, add(l.a, mul(u, q.t)))) < 0.5)
        .sort((p, q) => p.t - q.t);
      let chain = [l.a].concat(inner.map((q) => q.p), [l.b]);
      if (l.tag === 'top') {
        const ch2 = [chain[0]];
        for (let k = 1; k < chain.length; k++) {
          const p0 = chain[k - 1], p1 = chain[k], nseg = Math.max(1, Math.ceil(len(sub(p1, p0)) / 200));
          for (let q = 1; q <= nseg; q++) ch2.push(add(p0, mul(sub(p1, p0), q / nseg)));
        }
        chain = ch2;
      }
      for (let k = 0; k < chain.length - 1; k++) {
        const i = nodeOf(chain[k]), j = nodeOf(chain[k + 1]);
        if (i !== j && !els.some((e) => (e.i === i && e.j === j) || (e.i === j && e.j === i))) els.push({ i, j, kind: l.kind, tag: l.tag });
      }
    });
    const sup = [...new Set(supportsAt.map(nodeOf))];
    return { cfg, nodes, els, sup, dims: { Lf, Wf, Hf, Xl, Yo, zr }, bolted, sideSegs };
  }

  function sectionOf(s, t) {
    const A = s * s - (s - 2 * t) * (s - 2 * t), I = (Math.pow(s, 4) - Math.pow(s - 2 * t, 4)) / 12;
    const Am = (s - t) * (s - t), J = 4 * Am * Am * t / (4 * (s - t));
    return { A, I, J, W: I / (s / 2) };
  }

  function solveFrame(g, loadsList) {
    const n = g.nodes.length, N = 6 * n, sec = sectionOf(g.cfg.size, g.cfg.t);
    const K = Array.from({ length: N }, () => new Float64Array(N));
    const elData = g.els.map((e) => {
      const pi = g.nodes[e.i], pj = g.nodes[e.j], d = sub(pj, pi), Le = len(d), ex = mul(d, 1 / Le);
      const ref = Math.abs(ex[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
      const ey = unit(cross(ref, ex)), ez = cross(ex, ey);
      const k = e.kind === 'rigid' ? 1000 : 1;
      const A = sec.A * k, I = sec.I * k, J = sec.J * k;
      const kl = Array.from({ length: 12 }, () => new Float64Array(12));
      const a = E * A / Le, t = G * J / Le, b1 = 12 * E * I / Math.pow(Le, 3), b2 = 6 * E * I / (Le * Le), b3 = 4 * E * I / Le, b4 = 2 * E * I / Le;
      const setS = (r, c, v) => { kl[r][c] += v; };
      setS(0, 0, a); setS(0, 6, -a); setS(6, 0, -a); setS(6, 6, a);
      setS(3, 3, t); setS(3, 9, -t); setS(9, 3, -t); setS(9, 9, t);
      // ohyb v rovině x-y (posun v, rotace kolem z)
      [[1, 5, 7, 11, 1], [2, 4, 8, 10, -1]].forEach(([v1, r1, v2, r2, sg]) => {
        const m = [[b1, sg * b2, -b1, sg * b2], [sg * b2, b3, -sg * b2, b4], [-b1, -sg * b2, b1, -sg * b2], [sg * b2, b4, -sg * b2, b3]];
        const idx = [v1, r1, v2, r2];
        for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) setS(idx[p], idx[q], m[p][q]);
      });
      const Rm = [ex, ey, ez];
      const T = (vec) => [dot(Rm[0], vec), dot(Rm[1], vec), dot(Rm[2], vec)];
      // kg = T' kl T, T blokově diagonální z Rm
      const Tm = Array.from({ length: 12 }, () => new Float64Array(12));
      for (let b = 0; b < 4; b++) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) Tm[3 * b + r][3 * b + c] = Rm[r][c];
      const kg = Array.from({ length: 12 }, () => new Float64Array(12));
      const tmp = Array.from({ length: 12 }, () => new Float64Array(12));
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) { let s2 = 0; for (let q = 0; q < 12; q++) s2 += kl[r][q] * Tm[q][c]; tmp[r][c] = s2; }
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) { let s2 = 0; for (let q = 0; q < 12; q++) s2 += Tm[q][r] * tmp[q][c]; kg[r][c] = s2; }
      const dofs = [];
      for (let q = 0; q < 6; q++) dofs.push(6 * e.i + q);
      for (let q = 0; q < 6; q++) dofs.push(6 * e.j + q);
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) K[dofs[r]][dofs[c]] += kg[r][c];
      void T;
      return { e, Le, kl, Tm, dofs, sec: e.kind === 'rigid' ? null : sec };
    });
    const fixed = new Set();
    g.sup.forEach((i) => { fixed.add(6 * i); fixed.add(6 * i + 1); fixed.add(6 * i + 2); });
    // malá pružina na všech rotacích proti numerické singularitě u kloubů
    for (let i = 0; i < N; i++) if (i % 6 >= 3) K[i][i] += 1;
    const free = []; for (let i = 0; i < N; i++) if (!fixed.has(i)) free.push(i);
    const m = free.length;
    const A = free.map((r) => Float64Array.from(free.map((c) => K[r][c])));
    // LU s částečnou pivotací
    const piv = new Int32Array(m); for (let i = 0; i < m; i++) piv[i] = i;
    let singular = false;
    let maxDiag = 0; for (let i = 0; i < m; i++) maxDiag = Math.max(maxDiag, Math.abs(A[i][i]));
    for (let k = 0; k < m; k++) {
      let p = k, mx = Math.abs(A[k][k]);
      for (let i = k + 1; i < m; i++) if (Math.abs(A[i][k]) > mx) { mx = Math.abs(A[i][k]); p = i; }
      if (mx < maxDiag * 1e-11) { singular = true; A[k][k] = maxDiag * 1e-6; mx = A[k][k]; p = k; }
      if (p !== k) { const tr = A[k]; A[k] = A[p]; A[p] = tr; const tp = piv[k]; piv[k] = piv[p]; piv[p] = tp; }
      const akk = A[k][k], rowk = A[k];
      for (let i = k + 1; i < m; i++) {
        const f = A[i][k] / akk; if (f === 0) continue;
        A[i][k] = f; const rowi = A[i];
        for (let j = k + 1; j < m; j++) rowi[j] -= f * rowk[j];
      }
    }
    const solve = (F) => {
      const b = new Float64Array(m); for (let i = 0; i < m; i++) b[i] = F[free[piv[i]]] || 0;
      for (let i = 1; i < m; i++) { let s2 = b[i]; const r = A[i]; for (let j = 0; j < i; j++) s2 -= r[j] * b[j]; b[i] = s2; }
      for (let i = m - 1; i >= 0; i--) { let s2 = b[i]; const r = A[i]; for (let j = i + 1; j < m; j++) s2 -= r[j] * b[j]; b[i] = s2 / r[i]; }
      const u = new Float64Array(N); for (let i = 0; i < m; i++) u[free[i]] = b[i];
      return u;
    };
    const results = loadsList.map((F) => {
      const u = solve(F);
      let smax = 0, sEnd = 0, worst = null;
      const forces = elData.map((ed) => {
        if (!ed.sec) return null;
        const ue = ed.dofs.map((d) => u[d]);
        const ul = new Float64Array(12); for (let r = 0; r < 12; r++) { let s2 = 0; for (let c = 0; c < 12; c++) s2 += ed.Tm[r][c] * ue[c]; ul[r] = s2; }
        const fl = new Float64Array(12); for (let r = 0; r < 12; r++) { let s2 = 0; for (let c = 0; c < 12; c++) s2 += ed.kl[r][c] * ul[c]; fl[r] = s2; }
        const Nax = -fl[0];
        const sig = (o) => Math.abs(fl[o]) / ed.sec.A + Math.hypot(fl[o + 4], fl[o + 5]) / ed.sec.W;
        const s1 = sig(0), s2 = sig(6), sm = Math.max(s1, s2);
        if (sm > smax) { smax = sm; worst = ed; }
        sEnd = Math.max(sEnd, sm);
        return { N: Nax, sig: sm, Le: ed.Le };
      });
      return { u, smax, sEnd, forces, worst };
    });
    return { results, singular, elData };
  }

  function audit(cfgIn, ratesIn) {
    const ex = cfgIn && extFor(cfgIn.model); if (ex) return ex.audit(cfgIn, ratesIn);
    const cfg = normalize(cfgIn), R = rates0(ratesIn);
    const g = frameGraph(cfg, R), n = g.nodes.length, N = 6 * n, s = cfg.size, sec = sectionOf(s, cfg.t);
    const A = analyzeCore(cfg, R);
    const topNodes = [], topEls = g.els.filter((e) => e.tag === 'top');
    topEls.forEach((e) => { topNodes.push(e.i, e.j); });
    const topSet = [...new Set(topNodes)];
    // LC1 rovnoměrné 1500 N po horním rámu (podle přilehlých délek)
    const F1 = new Float64Array(N);
    let totL = 0; topEls.forEach((e) => { totL += len(sub(g.nodes[e.j], g.nodes[e.i])); });
    topEls.forEach((e) => { const l = len(sub(g.nodes[e.j], g.nodes[e.i])), f = 1500 * l / totL / 2; F1[6 * e.i + 2] -= f; F1[6 * e.j + 2] -= f; });
    // LC2 bodová 1000 N (EN 12521 zk. 2) v kandidátních uzlech horního rámu
    const cand = topSet.slice();
    const loadsP = cand.map((i) => { const F = new Float64Array(N); F[6 * i + 2] = -1000; return F; });
    // LC3 vodorovná 400 N + 500 N zátěž (EN 12521 zk. 1) ve směru x a y
    const corners = topSet.filter((i) => Math.abs(Math.abs(g.nodes[i][0]) - (g.dims.Lf / 2 - s / 2)) < 1 && Math.abs(Math.abs(g.nodes[i][1]) - g.dims.Yo) < 1);
    const hx = new Float64Array(N), hy = new Float64Array(N);
    const cn = corners.length ? corners : topSet;
    cn.forEach((i) => { hx[6 * i] = 400 / cn.length; hy[6 * i + 1] = 400 / cn.length; hx[6 * i + 2] = -500 / cn.length; hy[6 * i + 2] = -500 / cn.length; });
    const sol = solveFrame(g, [F1, hx, hy].concat(loadsP));
    const [r1, rx, ry] = sol.results, rp = sol.results.slice(3);
    const dz1 = Math.max(...topSet.map((i) => -r1.u[6 * i + 2]));
    const span = Math.max(g.dims.Lf, g.dims.Wf);
    const sway = Math.max(...topSet.map((i) => Math.abs(rx.u[6 * i])), ...topSet.map((i) => Math.abs(ry.u[6 * i + 1])));
    const swayX = Math.max(...topSet.map((i) => Math.abs(rx.u[6 * i]))), swayY = Math.max(...topSet.map((i) => Math.abs(ry.u[6 * i + 1])));
    const sP = Math.max(...rp.map((r) => r.smax));
    const dP = Math.max(...rp.map((r, k) => -r.u[6 * cand[k] + 2]));
    const sH = Math.max(rx.smax, ry.smax);
    // vzpěr: tlačené pruty při LC1 (×3 rezerva)
    let buck = Infinity;
    r1.forces.forEach((f) => { if (f && f.N < -1) { const Pcr = Math.PI * Math.PI * E * sec.I / (f.Le * f.Le); buck = Math.min(buck, Pcr / (-f.N)); } });
    // nosnost: kolik rovnoměrného zatížení snese podle napětí a průhybu L/300
    const capN = 1500 * Math.min(SIG_ALLOW / Math.max(r1.smax, 1e-6), (span / 300) / Math.max(dz1, 1e-6));
    // stabilita proti převržení (EN 12521 zk. 10): svislá síla 50 mm od hrany desky
    const pts = g.sup.map((i) => [g.nodes[i][0], g.nodes[i][1]]);
    const hull = convexHull(pts);
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L, DW = cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const V = cfg.L >= 1600 ? 400 : cfg.L < 800 ? 200 : 300;
    const deskKg = 15 * DL * DW / 1e6, Wt = (A.kg + deskKg) * 9.81;
    const probe = [];
    const outline = deskOutline(cfg.shape, DL, DW);
    outline.forEach((p) => { const r2 = Math.hypot(p[0], p[1]); probe.push([p[0] * (1 - 50 / r2), p[1] * (1 - 50 / r2)]); });
    let stab = Infinity;
    for (let k = 0; k < hull.length; k++) {
      const a = hull[k], b = hull[(k + 1) % hull.length];
      const ex2 = [b[0] - a[0], b[1] - a[1]], le = Math.hypot(ex2[0], ex2[1]), nO = [ex2[1] / le, -ex2[0] / le];
      const dist = (p) => (p[0] - a[0]) * nO[0] + (p[1] - a[1]) * nO[1];   // + = venku
      const cgArm = -dist([0, 0]);
      probe.forEach((p) => { const d = dist(p); if (d > 0) stab = Math.min(stab, (Wt * cgArm) / (V * d)); });
    }
    // výrobní kontroly
    const fab = [];
    A.rows.filter((r) => r.kind === 'tube').forEach((r) => {
      if (r.L > 6400) fab.push({ lvl: 'bad', t: r.poz + ' ' + r.name + ': délka ' + Math.round(r.L) + ' mm přesahuje tyč 6,5 m.' });
      if (r.L < 60) fab.push({ lvl: 'warn', t: r.poz + ' ' + r.name + ': krátký díl ' + Math.round(r.L) + ' mm – ověřit upnutí v K2.' });
      const ang = r.cut.split('/').map((x) => parseFloat(x));
      if (Math.max(...ang) > 62) fab.push({ lvl: 'warn', t: r.poz + ' ' + r.name + ': ostrý řez ' + Math.max(...ang) + '° – dlouhá špička, horší svařování a přesnost.' });
    });
    const flat = s - 2 * 2 * cfg.t, slotW = (s >= 30 ? s / 2 : 8) + 2 * R.tabClear;
    if (slotW > flat - 2) fab.push({ lvl: 'warn', t: 'Drážka pro zámek (' + slotW.toFixed(1) + ' mm) je blízko zaoblení rohu jeklu ' + s + '×' + s + ' – ověřit poloměr rohu.' });
    // úhly ve spojích a kolize dílů v boku
    const segs = g.sideSegs, dir = (d) => { const l2 = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]); return [(d.b[0] - d.a[0]) / l2, (d.b[1] - d.a[1]) / l2]; };
    segs.forEach((d) => [d.ea, d.eb].forEach((e) => {
      if (e.t !== 'miter' && e.t !== 'butt') return;
      const o = segs[e.j]; if (!o) return;
      const u1 = dir(d), u2 = dir(o), ang = Math.acos(Math.min(1, Math.abs(u1[0] * u2[0] + u1[1] * u2[1]))) * 180 / Math.PI;
      if (ang < 25) fab.push({ lvl: 'warn', t: 'Spoj pod úhlem ' + ang.toFixed(0) + '° – špatný přístup pro svár, díl je v místě spoje citlivý.' });
    }));
    const joined = (i, j) => [segs[i].ea, segs[i].eb].some((e) => e.j === j) || [segs[j].ea, segs[j].eb].some((e) => e.j === i) ||
      [[segs[i].a, segs[j].a], [segs[i].a, segs[j].b], [segs[i].b, segs[j].a], [segs[i].b, segs[j].b]].some(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1);
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      if (joined(i, j)) continue;
      const dmin = segDist(segs[i].a, segs[i].b, segs[j].a, segs[j].b);
      if (dmin < s - 0.5) fab.push({ lvl: 'bad', t: 'Díly „' + (sideDef(cfg.model, g.dims.Wf, g.dims.zr - s / 2, s)[i] || {}).n + '“ a „' + (sideDef(cfg.model, g.dims.Wf, g.dims.zr - s / 2, s)[j] || {}).n + '“ se protínají (' + dmin.toFixed(0) + ' mm).' });
    }
    const uniq = []; fab.forEach((f) => { if (!uniq.some((x) => x.t === f.t)) uniq.push(f); });
    // hodnocení
    const checks = [];
    const add2 = (id, lab, val, unitS, lvl, hint) => checks.push({ id, lab, val, unit: unitS, lvl, hint });
    const lv = (x, okLim, warnLim, lower) => lower ? (x >= okLim ? 'ok' : x >= warnLim ? 'warn' : 'bad') : (x <= okLim ? 'ok' : x <= warnLim ? 'warn' : 'bad');
    add2('pt', 'Bodová síla 1000 N (napětí)', sP, 'MPa', lv(sP, SIG_ALLOW, 235), 'EN 12521 zk. 2, dovoleno ' + SIG_ALLOW + ' MPa');
    add2('weld', 'Svary při 1000 N', sP * 1.43, 'MPa', lv(sP * 1.43, WELD_ALLOW, 260), 'koutový svar a = 0,7 t po obvodu');
    add2('cap', 'Nosnost rovnoměrně', Math.min(999, Math.floor(capN / 9.81 / 10) * 10), 'kg', lv(capN / 9.81, 150, 80, true), 'napětí ≤ ' + SIG_ALLOW + ' MPa a průhyb ≤ L/300');
    add2('defl', 'Průhyb rámu při 150 kg', dz1, 'mm', lv(dz1, span / 300, span / 200), 'limit L/300 = ' + (span / 300).toFixed(1) + ' mm');
    add2('sway', 'Vyklonění při 400 N do boku', sway, 'mm', lv(sway, 5, 10), 'podélně ' + swayX.toFixed(1) + ' mm, příčně ' + swayY.toFixed(1) + ' mm; do 5 mm stůl nepůsobí vratce');
    add2('hs', 'Napětí při 400 N do boku', sH, 'MPa', lv(sH, SIG_ALLOW, 235), 'EN 12521 zk. 1');
    add2('buck', 'Vzpěr tlačených dílů', buck === Infinity ? 99 : Math.min(99, buck), '× rezerva', lv(buck, 3, 1.5, true), 'Eulerova síla / skutečná síla při 150 kg');
    add2('stab', 'Stabilita proti převržení', stab === Infinity ? 99 : Math.min(99, stab), '× rezerva', lv(stab, 1.5, 1.0, true), V + ' N 50 mm od hrany desky, deska ' + deskKg.toFixed(0) + ' kg');
    const lvls = checks.map((c) => c.lvl).concat(uniq.map((f) => f.lvl));
    if (sol.singular) lvls.push('bad');
    const overall = lvls.indexOf('bad') >= 0 ? 'bad' : lvls.indexOf('warn') >= 0 ? 'warn' : 'ok';
    return { cfg, checks, fab: uniq, overall, singular: sol.singular, capKg: capN / 9.81, sway, dz1, stab, graph: g };
  }

  function convexHull(P) {
    const pts = P.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    pts.forEach((p) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    pts.slice().reverse().forEach((p) => { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function segDist(a, b, c, d) {
    const dd = (p, q, r) => { const vx = r[0] - q[0], vy = r[1] - q[1], l2 = vx * vx + vy * vy; let t = ((p[0] - q[0]) * vx + (p[1] - q[1]) * vy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - q[0] - t * vx, p[1] - q[1] - t * vy); };
    const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    if (cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0) return 0;
    return Math.min(dd(a, c, d), dd(b, c, d), dd(c, a, b), dd(d, a, b));
  }

  root.Podnoze = { tube, frame, register, modelInfo, allModels, solveFrame, sectionOf, convexHull, audit, frameGraph, THK, SIZES, MODELS, FIN, SHAPES, DEFAULT_RATES, DEFAULT_CFG, normalize, frameDims, build, analyze, toLocal, partLength, volume, orientFace, deskOutline, describe, paint, previewBodies, boltAllowed, rates0, nf, V };
})(typeof window !== 'undefined' ? window : globalThis);
