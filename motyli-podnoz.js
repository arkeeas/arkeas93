/* Motýlí podnož – souměrná sestava ze vzorového křídla STEP (křídlo 2) a uzlu z plechů.
 * Původní STEP měl křídla posunutá (jen otočená o 180°, ne zrcadlená) a konce
 * křídel 1 a 4 přečnívaly přes uzel. Tady se vezme jedno křídlo, posune se v ose Y
 * tak, aby otisk jeho konců ležel souměrně na čele uzlu (střed ±30 mm), a zrcadlí se.
 * Spoj křídla s uzlem: 'svar' (jekly přímo na čelo uzlu) nebo 'srouby'
 * (čelní deska 12 mm se 2 závity M10, šrouby zevnitř uzlu, přístup zespodu). */
(function (root) {
  'use strict';
  const V = root.Vyvoj, DATA = root.MOTYLI_MESH;
  if (!V || !DATA) throw new Error('Motýlí podnož vyžaduje Vyvoj a motyli-podnoz-mesh.js');
  const MODEL = {
    id: 'MOT', lab: 'Motýlí podnož', desc: 'Pevná velikost, křídla k uzlu svarem nebo šrouby',
    icon: 'M4 24 L20 8 L32 20 L44 8 L60 24 L44 40 L32 28 L20 40 Z',
    note: 'Deska je jen náhled; podnož má orientační cenu, nosnost není ověřená.', wip: true
  };
  if (!V.MODELS.some((m) => m.id === MODEL.id)) V.MODELS.push(MODEL);
  const baseNormalize = V.normalize, baseBuild = V.build, baseAnalyze = V.analyze, baseAudit = V.audit, baseDescribe = V.describe;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const mul = (a, s) => a.map((x) => x * s);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => Math.hypot(a[0], a[1], a[2]);

  /* Geometrie uzlu a spoje (mm). Uzel = svařená krabička z plechů 6 mm, nahoře víko, dole otevřená. */
  const HUB = { half: 60, t: 6, z0: 260, z1: 360 };
  const PLATE = { t: 12, y0: 2, y1: 58, z0: 262, z1: 356 };            // čelní deska (souřadnice pro křídlo v −Y)
  const BOLTS = [[42, 282], [18, 336]];                                 // [|y|, z] – úhlopříčně, M10 × 16
  const PATCH_CENTER = 30;                                              // střed otisku konců křídla na čele uzlu
  const MASTER = { panel: 9, beams: [10, 11, 12, 13, 14, 15], plate: 16 };  // křídlo 2 (+X, −Y) ve zdrojovém STEP
  const MASTER_IDS = [MASTER.panel].concat(MASTER.beams, [MASTER.plate]);
  const ROOT_BEAMS = [10, 15];                                          // horní a dolní vnitřní jekl – dosedají na uzel
  const STEEL = 7.85e-6;                                                // kg/mm³
  const SPOJE = [
    { id: 'srouby', lab: 'Šrouby', p: 'křídla zvlášť do lakovny i auta', c: '8× M10 zevnitř uzlu, přístup zespodu' },
    { id: 'svar', lab: 'Svar', p: 'nejlevnější, bez čelních desek', c: 'celá podnož jeden svařenec' }
  ];

  // Posun vzorového křídla v Y: střed otisku obou vnitřních jeklů na čele x = 60 → y = −30.
  const rootY = ROOT_BEAMS.flatMap((i) => DATA.parts[i].verts.filter((v) => Math.abs(v[0] - HUB.half) < 0.05).map((v) => v[1]));
  if (!rootY.length) throw new Error('MOT: vzorové křídlo nedosedá na čelo uzlu');
  const SHIFT_Y = -PATCH_CENTER - (Math.min(...rootY) + Math.max(...rootY)) / 2;

  function box(x0, x1, y0, y1, z0, z1) {
    const verts = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const tris = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
    return { verts, tris };
  }
  function meshVolume(m) {
    let v = 0;
    for (const t of m.tris) { const a = m.verts[t[0]], b = m.verts[t[1]], c = m.verts[t[2]]; v += dot(a, cross(b, c)); }
    return Math.abs(v) / 6;
  }

  const MASTER_VOL = MASTER_IDS.reduce((s, i) => s + meshVolume(DATA.parts[i]), 0);

  function hubParts() {
    const h = HUB.half, t = HUB.t, zt = HUB.z1 - t;
    return [
      ['Uzel – bočnice +X (pl. 6)', box(h - t, h, -h, h, HUB.z0, zt)],
      ['Uzel – bočnice −X (pl. 6)', box(-h, -h + t, -h, h, HUB.z0, zt)],
      ['Uzel – bočnice +Y (pl. 6)', box(-h + t, h - t, h - t, h, HUB.z0, zt)],
      ['Uzel – bočnice −Y (pl. 6)', box(-h + t, h - t, -h, -h + t, HUB.z0, zt)],
      ['Uzel – víko (pl. 6)', box(-h, h, -h, h, zt, HUB.z1)]
    ].map(([name, m]) => ({ name, verts: m.verts, tris: m.tris }));
  }

  const QUADS = [
    { lab: 'křídlo +X −Y', sx: 1, sy: 1 },
    { lab: 'křídlo +X +Y', sx: 1, sy: -1 },
    { lab: 'křídlo −X +Y', sx: -1, sy: -1 },
    { lab: 'křídlo −X −Y', sx: -1, sy: 1 }
  ];
  const WING_NAMES = ['výplň 5 mm', 'jekl 1', 'jekl 2', 'jekl 3', 'jekl 4', 'jekl 5', 'jekl 6', 'horní deska 110×86×8'];

  function geometry(spoj) {
    const dx = spoj === 'srouby' ? PLATE.t : 0, parts = hubParts();
    for (const q of QUADS) {
      const flip = q.sx * q.sy < 0;
      const tf = (p) => [q.sx * (p[0] + dx), q.sy * (p[1] + SHIFT_Y), p[2]];
      const fixTris = (tris) => flip ? tris.map((t) => [t[0], t[2], t[1]]) : tris;
      MASTER_IDS.forEach((idx, k) => {
        const src = DATA.parts[idx];
        parts.push({ name: q.lab + ' – ' + WING_NAMES[k], verts: src.verts.map(tf), tris: fixTris(src.tris) });
      });
      if (spoj === 'srouby') {
        const m = box(HUB.half, HUB.half + PLATE.t, -PLATE.y1, -PLATE.y0, PLATE.z0, PLATE.z1);
        const tp = (p) => [q.sx * p[0], q.sy * p[1], p[2]];
        parts.push({ name: q.lab + ' – čelní deska 12 mm, 2× závit M10', verts: m.verts.map(tp), tris: fixTris(m.tris) });
      }
    }
    const xyz = parts.flatMap((p) => p.verts);
    const ext = [0, 1, 2].map((a) => { let lo = Infinity, hi = -Infinity; for (const v of xyz) { if (v[a] < lo) lo = v[a]; if (v[a] > hi) hi = v[a]; } return hi - lo; });
    return { parts, dims: { Lf: +ext[0].toFixed(1), Wf: +ext[1].toFixed(1), Hf: +ext[2].toFixed(1) } };
  }
  const GEO = { svar: geometry('svar'), srouby: geometry('srouby') };

  /* Kontrola dosednutí: konce jeklů vzorového křídla musí ležet na čele uzlu / čelní desky s okrajem. */
  function seatCheck(spoj) {
    const xFace = HUB.half, pts = ROOT_BEAMS.flatMap((i) => DATA.parts[i].verts.filter((v) => Math.abs(v[0] - xFace) < 0.05).map((v) => [v[1] + SHIFT_Y, v[2]]));
    const y0 = Math.min(...pts.map((p) => p[0])), y1 = Math.max(...pts.map((p) => p[0])), z0 = Math.min(...pts.map((p) => p[1])), z1 = Math.max(...pts.map((p) => p[1]));
    const face = spoj === 'srouby' ? { y0: -PLATE.y1, y1: -PLATE.y0, z0: PLATE.z0, z1: PLATE.z1 } : { y0: -HUB.half, y1: HUB.half, z0: HUB.z0, z1: HUB.z1 };
    return { patch: { y0, y1, z0, z1 }, margin: Math.min(y0 - face.y0, face.y1 - y1, z0 - face.z0, face.z1 - z1), centreGap: -2 * y1 };
  }

  function bom(spoj) {
    const hubVol = hubParts().reduce((s, p) => s + meshVolume(p), 0);
    const holeVol = Math.PI * 4.25 * 4.25 * PLATE.t;
    const plateVol = spoj === 'srouby' ? 4 * (PLATE.t * (PLATE.y1 - PLATE.y0) * (PLATE.z1 - PLATE.z0) - 2 * holeVol) : 0;
    const vol = 4 * MASTER_VOL + hubVol + plateVol;
    return {
      volumeMm3: Math.round(vol), kg: Math.round(vol * STEEL * 100) / 100,
      cuts: 32 + 5 + (spoj === 'srouby' ? 4 : 0),
      welds: 68 + 8,                       // 68 kontaktů z původního STEP + 8 švů krabičky uzlu
      bolts: spoj === 'srouby' ? 8 : 0,
      paintM2: spoj === 'srouby' ? 2.23 : 2.19
    };
  }
  const BOMS = { svar: bom('svar'), srouby: bom('srouby') };

  function normalize(c) {
    if (!c || c.model !== 'MOT') return baseNormalize(c);
    const base = baseNormalize(c);
    const spoj = SPOJE.some((s) => s.id === c.spoj) ? c.spoj : 'srouby';
    const D = GEO[spoj].dims;
    const shape = base.shape || 'rect', dmode = c.dmode === 'own' ? 'own' : 'table';
    const rawDL = Number(c.dL), rawDW = Number(c.dW), rawTd = Number(c.td);
    const dL = clamp(Number.isFinite(rawDL) && rawDL > 0 ? rawDL : D.Lf, 300, 3000);
    const dW = shape === 'circle' ? dL : clamp(Number.isFinite(rawDW) && rawDW > 0 ? rawDW : D.Wf, 250, 1500);
    return Object.assign({}, base, {
      model: 'MOT', spoj, L: D.Lf, W: D.Wf, H: D.Hf, shape, dmode, dL, dW,
      td: clamp(Number.isFinite(rawTd) ? rawTd : 18, 18, 80), fin: base.fin || 'black', qty: base.qty
    });
  }

  function build(c) {
    if (!c || c.model !== 'MOT') return baseBuild(c);
    const cfg = normalize(c), G = GEO[cfg.spoj];
    const parts = G.parts.map((p) => ({
      poz: p.name, name: p.name,
      solid: { verts: p.verts, faces: p.tris.map((t) => {
        const a = p.verts[t[0]], b = p.verts[t[1]], d = p.verts[t[2]], n = cross(sub(b, a), sub(d, a)), q = norm(n) || 1;
        return { outer: t, inner: [], n: mul(n, 1 / q) };
      }) }
    }));
    const notes = ['Tvar a rozměry desky jsou pouze vizualizace; její uchycení k podnoži není navrženo.'];
    if (cfg.spoj === 'srouby') notes.push('Křídla se k uzlu šroubují 2× M10 × 16 (8.8) zevnitř uzlu do závitu v čelní desce 12 mm; uzel je dole otevřený kvůli přístupu.');
    return {
      cfg, dims: Object.assign({}, G.dims), parts, plateBoxes: [], hwBodies: [], plates: [], hw: [], boltPts: [],
      notes, weldJoints: null, glassTop: false
    };
  }

  function analyze(c, ratesIn) {
    if (!c || c.model !== 'MOT') return baseAnalyze(c, ratesIn);
    const cfg = normalize(c), B = build(cfg), BOM = BOMS[cfg.spoj];
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L;
    const DW = cfg.shape === 'circle' ? DL : cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const ohEnd = Math.round((DL - cfg.L) / 2), ohSide = Math.round((DW - cfg.W) / 2);
    const ohWarn = ohEnd < 0 || ohSide < 0 ? { lvl: 'bad', t: 'Deska je menší než podnož.' }
      : ohEnd > 450 || ohSide > 300 ? { lvl: 'warn', t: 'Deska má velký přesah; stabilita této varianty nebyla ověřena.' } : null;
    const R = V.rates0(ratesIn), F = V.FIN.find((f) => f.id === cfg.fin) || V.FIN[0];
    const rows = [
      { id: 'material', label: 'Ocel podle objemu sestavy', qty: BOM.kg, unit: 'kg', rate: R.kg },
      { id: 'cut', label: 'Řez / pálení dílů', qty: BOM.cuts, unit: 'ks', rate: R.rez },
      { id: 'weld', label: 'Předpoklad svarových kontaktů', qty: BOM.welds, unit: 'ks', rate: R.svar },
      { id: 'bolt', label: 'Šrouby M10 × 16 (8.8) + závit v čelní desce', qty: BOM.bolts, unit: 'ks', rate: R.sroub },
      { id: 'paint', label: 'Prášková barva – odhad plochy', qty: BOM.paintM2, unit: 'm²', rate: R.barva * F.k },
      { id: 'prep', label: 'Příprava zakázky', qty: 1, unit: 'zakázka', rate: R.priprava },
      { id: 'board', label: 'Deska zákazníka (mimo cenu)', qty: 1, unit: 'ks', rate: 0 }
    ].map((r) => Object.assign(r, { amount: r.id === 'board' ? 0 : r.qty * r.rate }));
    const cost = rows.reduce((sum, r) => sum + r.amount, 0);
    const price = Math.round(cost * (1 + R.marze / 100) / 10) * 10;
    const vat = Math.round(price * 1.21 / 10) * 10;
    return { cfg, build: B, B, audit: null, cost, capacity: null, price, vat, total: vat * cfg.qty, load: null,
      warnings: [MODEL.note, 'Orientační cena; ' + BOM.welds + ' svarových kontaktů a plocha laku ' + String(BOM.paintM2).replace('.', ',') + ' m² jsou pracovní odhady k potvrzení dílnou.', 'Deska zákazníka není zahrnuta. Nosnost nebyla ověřena.'], DL, DW,
      ohEnd, ohSide, ohWarn, rows, R, kg: BOM.kg, welds: BOM.welds, tubeM: null, mount: null, seat: seatCheck(cfg.spoj) };
  }
  function audit(c, rates) { return c && c.model === 'MOT' ? { overall: 'unknown', checks: [], warnings: ['Nosnost nebyla ověřena.'] } : baseAudit(c, rates); }
  function describe(c) {
    if (!c || c.model !== 'MOT') return baseDescribe(c);
    const cfg = normalize(c);
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L;
    const DW = cfg.shape === 'circle' ? DL : cfg.dmode === 'own' ? cfg.dW : cfg.W;
    return 'Motýlí podnož – pevně ' + Math.round(cfg.L) + ' × ' + Math.round(cfg.W) + ' × ' + Math.round(cfg.H) + ' mm, křídla '
      + (cfg.spoj === 'srouby' ? 'šroubovaná (8× M10)' : 'přivařená') + '; deska ' + cfg.shape + ' ' + DL + ' × ' + DW + ' × ' + cfg.td + ' mm';
  }

  Object.assign(V, {
    normalize, build, analyze, audit, describe,
    MOTYLI_SPOJE: SPOJE.map((s) => Object.assign({}, s)),
    MOTYLI_BOM: { svar: Object.assign({}, BOMS.svar), srouby: Object.assign({}, BOMS.srouby) },
    MOTYLI_FIXED_DIMS: { svar: Object.assign({}, GEO.svar.dims), srouby: Object.assign({}, GEO.srouby.dims) },
    MOTYLI_GEOM: { HUB, PLATE, BOLTS, SHIFT_Y, PATCH_CENTER, seatCheck },
    motyliBase: { normalize: baseNormalize, build: baseBuild, analyze: baseAnalyze, audit: baseAudit }
  });
})(typeof window !== 'undefined' ? window : globalThis);
