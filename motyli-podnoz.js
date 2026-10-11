/* Náhled původní Motýlí podnože. STEP je zdroj geometrie; tato síť není B-rep. */
(function (root) {
  'use strict';
  const V = root.Vyvoj, DATA = root.MOTYLI_MESH;
  if (!V || !DATA) throw new Error('Motýlí podnož vyžaduje Vyvoj a motyli-podnoz-mesh.js');
  const MODEL = { id: 'MOT', lab: 'Motýlí podnož', desc: 'Náhled dodaného STEP modelu (33 těles)', icon: 'M4 24 L20 8 L32 20 L44 8 L60 24 L44 40 L32 28 L20 40 Z', note: 'Rozměry jsou pevné podle zdrojového STEP; parametrická úprava a výrobní ověření čekají na překreslení.', wip: true };
  if (!V.MODELS.some((m) => m.id === MODEL.id)) V.MODELS.push(MODEL);
  const baseNormalize = V.normalize, baseBuild = V.build, baseAnalyze = V.analyze, baseAudit = V.audit, baseDescribe = V.describe;
  const dims = { Lf: DATA.bbox[0], Wf: DATA.bbox[1], Hf: DATA.bbox[2] };
  const cfgMot = (c) => Object.assign({}, c, { model: 'MOT', L: Math.round(dims.Lf), W: Math.round(dims.Wf), H: Math.round(dims.Hf), shape: 'rect', dmode: 'table', dL: Math.round(dims.Lf), dW: Math.round(dims.Wf), td: 18, fin: c.fin || 'black', qty: 1 });
  function normalize(c) { return c && c.model === 'MOT' ? cfgMot(baseNormalize(c)) : baseNormalize(c); }
  function build(c) {
    if (!c || c.model !== 'MOT') return baseBuild(c);
    const cfg = normalize(c);
    const parts = DATA.parts.map((p) => ({ poz: p.name, name: p.name, solid: { verts: p.verts, faces: p.tris.map((t) => {
      const a = p.verts[t[0]], b = p.verts[t[1]], d = p.verts[t[2]], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], q = Math.hypot(...n) || 1;
      return { outer: t, inner: [], n: n.map((x) => x / q) };
    }) } }));
    return { cfg, dims, parts, plateBoxes: [], hwBodies: [], plates: [], hw: [], boltPts: [], notes: ['Pouze vizualizační síť z STEP; nejde o parametrický ani výrobní B-rep.'], weldJoints: null, glassTop: false };
  }
  function analyze(c) {
    if (!c || c.model !== 'MOT') return baseAnalyze(c);
    const cfg = normalize(c), B = build(cfg);
    return { cfg, build: B, B, audit: null, cost: null, capacity: null, price: null, load: null, warnings: [MODEL.note, 'Cena a nosnost nejsou pro tento model vypočtené.'], DL: cfg.L, DW: cfg.W, ohEnd: 0, ohSide: 0, ohWarn: null, rows: [], total: null, R: null, mount: null };
  }
  function audit(c, rates) { return c && c.model === 'MOT' ? { overall: 'unknown', checks: [], warnings: ['Nosnost nebyla ověřena.'] } : baseAudit(c, rates); }
  function describe(c) { return c && c.model === 'MOT' ? 'Motýlí podnož – náhled STEP, ' + dims.Lf.toFixed(1) + ' × ' + dims.Wf.toFixed(1) + ' × ' + dims.Hf.toFixed(1) + ' mm' : baseDescribe(c); }
  Object.assign(V, { normalize, build, analyze, audit, describe, MOTYLI_LIMITS: { L: { min: 1533, max: 1533, step: 1 }, W: { min: 842, max: 842, step: 1 }, H: { min: 728, max: 728, step: 1 } }, motyliBase: { normalize: baseNormalize, build: baseBuild, analyze: baseAnalyze, audit: baseAudit } });
})(typeof window !== 'undefined' ? window : globalThis);
