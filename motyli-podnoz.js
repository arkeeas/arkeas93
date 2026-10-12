/* Motýlí podnož – souměrná sestava ve velikostech S / M / L, spoj křídel svarem nebo šrouby.
 * Síť vzorového křídla (+X −Y) pro každou velikost je v motyli-podnoz-kridla.js; generuje ji
 * motyli-podnoz/vytvor_symetrickou_podnoz.FCMacro spolu se STEP a kontrolou (assets/motyli-podnoz).
 * Křídlo se mění jen vodorovně (výška 728 mm, jekl 40×40×3, výplň 5 mm s okrajem 8 mm).
 * Tady se křídlo posune v Y (střed otisku konců na čele uzlu y = ±30 mm) a zrcadlí do 4 poloh.
 * Uzel: krabička z plechů 6 mm 120 × 120 × 110 (z 250–360), víko nahoře, dole otevřená.
 * Spoj: 'svar' (jekly na bočnici uzlu) nebo 'srouby' (čelní deska 12 mm, 2× M10 zevnitř uzlu). */
(function (root) {
  'use strict';
  const V = root.Vyvoj, DATA = root.MOTYLI_KRIDLA;
  if (!V || !DATA) throw new Error('Motýlí podnož vyžaduje Vyvoj a motyli-podnoz-kridla.js');
  const MODEL = {
    id: 'MOT', lab: 'Motýlí podnož', desc: 'Velikosti S / M / L, křídla k uzlu svarem nebo šrouby',
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

  /* Musí odpovídat makru vytvor_symetrickou_podnoz.FCMacro. */
  const HUB = { half: 60, t: 6, z0: 250, z1: 360 };
  const PLATE = { t: 12, y0: 2, y1: 58, z0: 252, z1: 356 };
  const BOLTS = [[42, 282], [18, 336]];
  const PATCH_CENTER = 30;
  const ROOT_TUBES = ['jekl_40x40x3_1', 'jekl_40x40x3_6'];   // horní a dolní jekl u uzlu
  const STEEL = 7.85e-6;
  const VELIKOSTI = [
    { id: 'S', lab: 'S', deska: '160–180 × 90 cm' },
    { id: 'M', lab: 'M', deska: '200–220 × 100 cm' },
    { id: 'L', lab: 'L', deska: '240 × 110 cm' }
  ].filter((v) => DATA[v.id]);
  const SPOJE = [
    { id: 'srouby', lab: 'Šrouby', p: 'křídla zvlášť do lakovny i auta', c: '8× M10 zevnitř uzlu, přístup zespodu' },
    { id: 'svar', lab: 'Svar', p: 'nejlevnější, bez čelních desek', c: 'celá podnož jeden svařenec' }
  ];
  const PART_NAMES = { vypln_5mm: 'výplň 5 mm', horni_deska_110x86x8: 'horní deska 110×86×8' };
  const QUADS = [
    { lab: 'křídlo +X −Y', sx: 1, sy: 1 },
    { lab: 'křídlo +X +Y', sx: 1, sy: -1 },
    { lab: 'křídlo −X +Y', sx: -1, sy: -1 },
    { lab: 'křídlo −X −Y', sx: -1, sy: 1 }
  ];

  function box(x0, x1, y0, y1, z0, z1) {
    const verts = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const tris = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
    return { verts, tris };
  }
  function meshVolume(m) {
    let v = 0;
    for (const t of m.tris) v += dot(m.verts[t[0]], cross(m.verts[t[1]], m.verts[t[2]]));
    return Math.abs(v) / 6;
  }
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
  const partLabel = (n) => PART_NAMES[n] || n.replace(/^jekl_40x40x3_(\d)$/, 'jekl 40×40×3 č. $1');

  function geometry(vel, spoj) {
    const W = DATA[vel], dx = spoj === 'srouby' ? PLATE.t : 0, parts = hubParts();
    for (const q of QUADS) {
      const flip = q.sx * q.sy < 0;
      const tf = (p) => [q.sx * (p[0] + dx), q.sy * (p[1] + W.shiftY), p[2]];
      const fixTris = (tris) => flip ? tris.map((t) => [t[0], t[2], t[1]]) : tris;
      for (const src of W.parts) parts.push({ name: q.lab + ' – ' + partLabel(src.name), verts: src.verts.map(tf), tris: fixTris(src.tris) });
      if (spoj === 'srouby') {
        const m = box(HUB.half, HUB.half + PLATE.t, -PLATE.y1, -PLATE.y0, PLATE.z0, PLATE.z1);
        parts.push({ name: q.lab + ' – čelní deska 12 mm, 2× závit M10', verts: m.verts.map((p) => [q.sx * p[0], q.sy * p[1], p[2]]), tris: fixTris(m.tris) });
      }
    }
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of parts) for (const v of p.verts) for (let a = 0; a < 3; a++) { if (v[a] < lo[a]) lo[a] = v[a]; if (v[a] > hi[a]) hi[a] = v[a]; }
    return { parts, dims: { Lf: Math.round(hi[0] - lo[0]), Wf: Math.round(hi[1] - lo[1]), Hf: Math.round(hi[2] - lo[2]) } };
  }
  const GEO = {};
  const geo = (vel, spoj) => GEO[vel + spoj] || (GEO[vel + spoj] = geometry(vel, spoj));

  /* Otisk konců jeklů vzorového křídla na čele uzlu / čelní desky. */
  function seatCheck(vel, spoj) {
    const W = DATA[vel];
    const pts = W.parts.filter((p) => ROOT_TUBES.indexOf(p.name) >= 0)
      .flatMap((p) => p.verts.filter((v) => Math.abs(v[0] - HUB.half) < 0.06).map((v) => [v[1] + W.shiftY, v[2]]));
    const y0 = Math.min(...pts.map((p) => p[0])), y1 = Math.max(...pts.map((p) => p[0])), z0 = Math.min(...pts.map((p) => p[1])), z1 = Math.max(...pts.map((p) => p[1]));
    const face = spoj === 'srouby' ? { y0: -PLATE.y1, y1: -PLATE.y0, z0: PLATE.z0, z1: PLATE.z1 } : { y0: -HUB.half, y1: HUB.half, z0: HUB.z0, z1: HUB.z1 };
    return { patch: { y0, y1, z0, z1 }, margin: Math.min(y0 - face.y0, face.y1 - y1, z0 - face.z0, face.z1 - z1), centreGap: -2 * y1 };
  }

  const WING_VOL = {};
  const wingVol = (vel) => WING_VOL[vel] || (WING_VOL[vel] = DATA[vel].parts.reduce((s, p) => s + meshVolume(p), 0));
  const HUB_VOL = hubParts().reduce((s, p) => s + meshVolume(p), 0);
  function bom(vel, spoj) {
    const holeVol = Math.PI * 4.25 * 4.25 * PLATE.t;
    const plateVol = spoj === 'srouby' ? 4 * (PLATE.t * (PLATE.y1 - PLATE.y0) * (PLATE.z1 - PLATE.z0) - 2 * holeVol) : 0;
    const vol = 4 * wingVol(vel) + HUB_VOL + plateVol;
    const paintM = 2.19 * (4 * wingVol(vel) + HUB_VOL) / (4 * wingVol('M') + HUB_VOL);   // plocha laku úměrně oceli křídel, M = 2,19 m²
    return {
      volumeMm3: Math.round(vol), kg: Math.round(vol * STEEL * 100) / 100,
      cuts: 32 + 5 + (spoj === 'srouby' ? 4 : 0),
      welds: 68 + 8,                       // 68 kontaktů z původního STEP + 8 švů krabičky uzlu
      bolts: spoj === 'srouby' ? 8 : 0,
      paintM2: Math.round((paintM + (spoj === 'srouby' ? 0.04 : 0)) * 100) / 100
    };
  }

  /* Doporučená velikost podle desky: největší, u které deska přečnívá na bocích ≥ 80 mm a na čelech ≥ 150 mm
     (na bocích sedí lidé, špičky křídel jsou u podlahy skoro na hraně podnože). */
  const MIN_OH = { side: 80, end: 150 };
  function suggestVel(dL, dW) {
    const ok = VELIKOSTI.filter((v) => { const d = geo(v.id, 'svar').dims; return d.Lf <= dL - 2 * MIN_OH.end && d.Wf <= dW - 2 * MIN_OH.side; });
    return ok.length ? ok[ok.length - 1].id : VELIKOSTI[0].id;
  }

  function normalize(c) {
    if (!c || c.model !== 'MOT') return baseNormalize(c);
    const base = baseNormalize(c);
    const spoj = SPOJE.some((s) => s.id === c.spoj) ? c.spoj : 'srouby';
    const vel = VELIKOSTI.some((v) => v.id === c.vel) ? c.vel : 'M';
    const D = geo(vel, spoj).dims;
    const shape = base.shape || 'rect', dmode = c.dmode === 'own' ? 'own' : 'table';
    const rawDL = Number(c.dL), rawDW = Number(c.dW), rawTd = Number(c.td);
    const dL = clamp(Number.isFinite(rawDL) && rawDL > 0 ? rawDL : D.Lf, 300, 3000);
    const dW = shape === 'circle' ? dL : clamp(Number.isFinite(rawDW) && rawDW > 0 ? rawDW : D.Wf, 250, 1500);
    return Object.assign({}, base, {
      model: 'MOT', vel, spoj, L: D.Lf, W: D.Wf, H: D.Hf, shape, dmode, dL, dW,
      td: clamp(Number.isFinite(rawTd) ? rawTd : 18, 18, 80), fin: base.fin || 'black', qty: base.qty
    });
  }

  function build(c) {
    if (!c || c.model !== 'MOT') return baseBuild(c);
    const cfg = normalize(c), G = geo(cfg.vel, cfg.spoj);
    const parts = G.parts.map((p) => ({
      poz: p.name, name: p.name,
      solid: { verts: p.verts, faces: p.tris.map((t) => {
        const a = p.verts[t[0]], b = p.verts[t[1]], d = p.verts[t[2]], n = cross(sub(b, a), sub(d, a)), q = norm(n) || 1;
        return { outer: t, inner: [], n: mul(n, 1 / q) };
      }) }
    }));
    const notes = ['Tvar a rozměry desky jsou pouze vizualizace; její uchycení k podnoži není navrženo.'];
    if (cfg.spoj === 'srouby') notes.push('Křídla se k uzlu šroubují 2× M10 × 16 (8.8) zevnitř uzlu do závitu v čelní desce 12 mm; uzel je dole otevřený kvůli přístupu.');
    return { cfg, dims: Object.assign({}, G.dims), parts, plateBoxes: [], hwBodies: [], plates: [], hw: [], boltPts: [], notes, weldJoints: null, glassTop: false };
  }

  function analyze(c, ratesIn) {
    if (!c || c.model !== 'MOT') return baseAnalyze(c, ratesIn);
    const cfg = normalize(c), B = build(cfg), BOM = bom(cfg.vel, cfg.spoj);
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L;
    const DW = cfg.shape === 'circle' ? DL : cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const ohEnd = Math.round((DL - cfg.L) / 2), ohSide = Math.round((DW - cfg.W) / 2);
    const ohWarn = ohEnd < 0 || ohSide < 0 ? { lvl: 'bad', t: 'Deska je menší než podnož – zvolte menší velikost podnože.' }
      : ohSide < MIN_OH.side ? { lvl: 'warn', t: 'Na bocích deska přečnívá jen ' + ohSide + ' mm – sedícím půjdou nohy ke křídlům. Zvažte menší velikost.' }
      : ohEnd > 450 || ohSide > 300 ? { lvl: 'warn', t: 'Deska má velký přesah; zvažte větší velikost podnože.' } : null;
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
    const suggested = cfg.dmode === 'own' ? suggestVel(DL, DW) : null;
    return { cfg, build: B, B, audit: null, cost, capacity: null, price, vat, total: vat * cfg.qty, load: null,
      warnings: [MODEL.note, 'Orientační cena; ' + BOM.welds + ' svarových kontaktů a plocha laku ' + String(BOM.paintM2).replace('.', ',') + ' m² jsou pracovní odhady k potvrzení dílnou.', 'Deska zákazníka není zahrnuta. Nosnost nebyla ověřena.'], DL, DW,
      ohEnd, ohSide, ohWarn, rows, R, kg: BOM.kg, welds: BOM.welds, tubeM: null, mount: null, seat: seatCheck(cfg.vel, cfg.spoj), suggestedVel: suggested };
  }
  function audit(c, rates) { return c && c.model === 'MOT' ? { overall: 'unknown', checks: [], warnings: ['Nosnost nebyla ověřena.'] } : baseAudit(c, rates); }
  function describe(c) {
    if (!c || c.model !== 'MOT') return baseDescribe(c);
    const cfg = normalize(c);
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L;
    const DW = cfg.shape === 'circle' ? DL : cfg.dmode === 'own' ? cfg.dW : cfg.W;
    return 'Motýlí podnož ' + cfg.vel + ' – ' + cfg.L + ' × ' + cfg.W + ' × ' + cfg.H + ' mm, křídla '
      + (cfg.spoj === 'srouby' ? 'šroubovaná (8× M10)' : 'přivařená') + '; deska ' + cfg.shape + ' ' + DL + ' × ' + DW + ' × ' + cfg.td + ' mm';
  }
  const stepFiles = (c) => { const cfg = normalize(c); return { step: 'assets/motyli-podnoz/motyli_podnoz_' + cfg.vel + '_' + cfg.spoj + '.step', zip: 'assets/motyli-podnoz/step_dily_' + cfg.vel + '_' + cfg.spoj + '.zip' }; };

  Object.assign(V, {
    normalize, build, analyze, audit, describe,
    MOTYLI_SPOJE: SPOJE.map((s) => Object.assign({}, s)),
    MOTYLI_VELIKOSTI: VELIKOSTI.map((v) => Object.assign({}, v, { dims: Object.assign({}, geo(v.id, 'svar').dims) })),
    MOTYLI_BOM: (vel, spoj) => bom(vel, spoj),
    MOTYLI_GEOM: { HUB, PLATE, BOLTS, PATCH_CENTER, seatCheck, suggestVel },
    motyliStepFiles: stepFiles,
    motyliBase: { normalize: baseNormalize, build: baseBuild, analyze: baseAnalyze, audit: baseAudit }
  });
})(typeof window !== 'undefined' ? window : globalThis);
