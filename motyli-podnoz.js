/* Parametrický vizualizační model motýlí podnože odvozený ze STEP. */
(function (root) {
  'use strict';
  const V = root.Vyvoj, DATA = root.MOTYLI_MESH;
  if (!V || !DATA) throw new Error('Motýlí podnož vyžaduje Vyvoj a motyli-podnoz-mesh.js');
  const MODEL = {
    id: 'MOT', lab: 'Motýlí podnož', desc: 'Pevná velikost podle původního STEP',
    icon: 'M4 24 L20 8 L32 20 L44 8 L60 24 L44 40 L32 28 L20 40 Z',
    note: 'Deska je jen náhled; podnož má orientační cenu, nosnost není ověřená.', wip: true
  };
  if (!V.MODELS.some((m) => m.id === MODEL.id)) V.MODELS.push(MODEL);
  const baseNormalize = V.normalize, baseBuild = V.build, baseAnalyze = V.analyze, baseAudit = V.audit, baseDescribe = V.describe;
  const FIXED = { L: DATA.bbox[0], W: DATA.bbox[1], H: DATA.bbox[2] };
  // Fixed-size BOM from the validated native FreeCAD B-rep (all dimensions in mm).
  // Weld operations and powder-coat area remain explicit pricing assumptions.
  const BOM = {
    volumeMm3: 6198430.331, kg: 48.6587, cuts: 33, welds: 68,
    tubeVolumeMm3: 4199348.331, panelVolumeMm3: 1431893.924,
    plateVolumeMm3: 293588.108, hubVolumeMm3: 273600, paintM2: 2.19
  };
  const SPREAD = { fixedL: 193.72, spanL: 1338.81, fixedW: 172.53, spanW: 669.50 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const mul = (a, s) => a.map((x) => x * s);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const n = norm(a); if (n < 1e-10) throw new Error('Neplatná osa dílu MOT'); return mul(a, 1 / n); };

  function eigen3(matrix) {
    const a = matrix.map((r) => r.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 32; it++) {
      let p = 0, q = 1;
      if (Math.abs(a[0][2]) > Math.abs(a[p][q])) { p = 0; q = 2; }
      if (Math.abs(a[1][2]) > Math.abs(a[p][q])) { p = 1; q = 2; }
      if (Math.abs(a[p][q]) < 1e-10) break;
      const tau = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
      const c = 1 / Math.sqrt(1 + t * t), s = t * c;
      const app = a[p][p], aqq = a[q][q], apq = a[p][q];
      a[p][p] = app - t * apq; a[q][q] = aqq + t * apq; a[p][q] = a[q][p] = 0;
      for (let r = 0; r < 3; r++) if (r !== p && r !== q) {
        const arp = a[r][p], arq = a[r][q];
        a[r][p] = a[p][r] = c * arp - s * arq;
        a[r][q] = a[q][r] = s * arp + c * arq;
      }
      for (let r = 0; r < 3; r++) {
        const vrp = v[r][p], vrq = v[r][q];
        v[r][p] = c * vrp - s * vrq; v[r][q] = s * vrp + c * vrq;
      }
    }
    return { values: [a[0][0], a[1][1], a[2][2]], vectors: [0, 1, 2].map((j) => [v[0][j], v[1][j], v[2][j]]) };
  }

  function stats(points) {
    const center = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / points.length);
    const m = Array.from({ length: 3 }, () => [0, 0, 0]);
    for (const p of points) { const d = sub(p, center); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += d[i] * d[j]; }
    const eig = eigen3(m);
    return { center, values: eig.values, vectors: eig.vectors };
  }

  function lineIntersection(a, b) {
    const u = a.axis, v = b.axis, w = sub(a.point, b.point), uv = dot(u, v), uw = dot(u, w), vw = dot(v, w), den = 1 - uv * uv;
    if (den < 1e-8) throw new Error('Rovnoběžné osy jeklů v MOT');
    const pa = add(a.point, mul(u, (uv * vw - uw) / den));
    const pb = add(b.point, mul(v, (vw - uv * uw) / den));
    if (norm(sub(pa, pb)) > 8) throw new Error('Osy jeklů MOT se míjejí');
    return mul(add(pa, pb), 0.5);
  }

  function rotate(v, from, to) {
    const axis = cross(from, to), s = norm(axis), c = clamp(dot(from, to), -1, 1);
    if (s < 1e-9) return c > 0 ? v.slice() : mul(v, -1);
    const k = mul(axis, 1 / s);
    return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
  }

  const wings = [1, 9, 17, 25].map((start) => ({ panel: start, beams: [1, 2, 3, 4, 5, 6].map((n) => start + n), plate: start + 7 }));
  const nodesByWing = wings.map((wing) => {
    const axes = wing.beams.map((idx) => {
      const s = stats(DATA.parts[idx].verts);
      const axisIndex = s.values.indexOf(Math.max(...s.values));
      return { point: s.center, axis: unit(s.vectors[axisIndex]) };
    });
    const pairs = [[0, 5], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
    const nodes = pairs.map(([a, b]) => lineIntersection(axes[a], axes[b]));
    return { axes, nodes };
  });
  const panelFrames = wings.map((wing) => {
    const s = stats(DATA.parts[wing.panel].verts);
    let n = s.vectors[s.values.indexOf(Math.min(...s.values))];
    n = unit([n[0], n[1], 0]);
    return { n, t: unit([-n[1], n[0], 0]) };
  });

  function dimensions(L, H) {
    const spread = (L - SPREAD.fixedL) / SPREAD.spanL;
    const heightScale = H / DATA.bbox[2];
    return { spread, heightScale, W: SPREAD.fixedW + SPREAD.spanW * spread };
  }

  function normalize(c) {
    if (!c || c.model !== 'MOT') return baseNormalize(c);
    const base = baseNormalize(c);
    const shape = base.shape || 'rect', dmode = c.dmode === 'own' ? 'own' : 'table';
    const rawDL = Number(c.dL), rawDW = Number(c.dW);
    const rawTd = Number(c.td);
    const dL = clamp(Number.isFinite(rawDL) && rawDL > 0 ? rawDL : FIXED.L, 300, 3000);
    const dW = shape === 'circle' ? dL : clamp(Number.isFinite(rawDW) && rawDW > 0 ? rawDW : FIXED.W, 250, 1500);
    return Object.assign({}, base, {
      model: 'MOT', L: FIXED.L, W: FIXED.W, H: FIXED.H, shape, dmode, dL, dW,
      td: clamp(Number.isFinite(rawTd) ? rawTd : 18, 18, 80), fin: base.fin || 'black', qty: base.qty
    });
  }

  function morphBeam(points, srcA, srcB, dstA, dstB) {
    const srcDir = unit(sub(srcB, srcA)), dstVec = sub(dstB, dstA), dstDir = unit(dstVec), scale = norm(dstVec) / norm(sub(srcB, srcA));
    return points.map((p) => {
      const d = sub(p, srcA), along = dot(d, srcDir), across = sub(d, mul(srcDir, along));
      return add(add(dstA, rotate(across, srcDir, dstDir)), mul(dstDir, along * scale));
    });
  }

  function morphPanel(points, rootPoint, frame, spread, heightScale) {
    const n = frame.n, t = frame.t, z = [0, 0, 1];
    return points.map((p) => {
      const d = sub(p, rootPoint);
      return add(rootPoint, add(add(mul(n, dot(d, n)), mul(t, dot(d, t) * spread)), mul(z, d[2] * heightScale)));
    });
  }

  function build(c) {
    if (!c || c.model !== 'MOT') return baseBuild(c);
    const cfg = normalize(c), dim = dimensions(cfg.L, cfg.H), parts = DATA.parts.map((p) => ({ name: p.name, source: p }));
    for (let wi = 0; wi < wings.length; wi++) {
      const wing = wings[wi], source = nodesByWing[wi], rootNode = source.nodes[0];
      const mapNode = (p) => add(rootNode, [dim.spread * (p[0] - rootNode[0]), dim.spread * (p[1] - rootNode[1]), dim.heightScale * (p[2] - rootNode[2])]);
      const moved = source.nodes.map(mapNode);
      for (let bi = 0; bi < 6; bi++) {
        const next = (bi + 1) % 6;
        const srcA = source.nodes[bi], srcB = source.nodes[next];
        parts[wing.beams[bi]].verts = morphBeam(DATA.parts[wing.beams[bi]].verts, srcA, srcB, moved[bi], moved[next]);
      }
      parts[wing.panel].verts = morphPanel(DATA.parts[wing.panel].verts, rootNode, panelFrames[wi], dim.spread, dim.heightScale);
      const delta = sub(moved[2], source.nodes[2]);
      parts[wing.plate].verts = DATA.parts[wing.plate].verts.map((p) => add(p, delta));
    }
    const shaped = parts.map((p) => ({
      poz: p.name, name: p.name,
      solid: { verts: p.verts || p.source.verts, faces: p.source.tris.map((t) => {
        const verts = p.verts || p.source.verts, a = verts[t[0]], b = verts[t[1]], d = verts[t[2]];
        const u = sub(b, a), v = sub(d, a), n = cross(u, v), q = norm(n) || 1;
        return { outer: t, inner: [], n: mul(n, 1 / q) };
      }) }
    }));
    return {
      cfg,
      dims: { Lf: FIXED.L, Wf: FIXED.W, Hf: FIXED.H },
      parts: shaped, plateBoxes: [], hwBodies: [], plates: [], hw: [], boltPts: [],
      notes: ['Tvar a rozměry desky jsou pouze vizualizace; její uchycení k podnoži není navrženo.'],
      weldJoints: null, glassTop: false
    };
  }

  function analyze(c, ratesIn) {
    if (!c || c.model !== 'MOT') return baseAnalyze(c, ratesIn);
    const cfg = normalize(c), B = build(cfg);
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L;
    const DW = cfg.shape === 'circle' ? DL : cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const ohEnd = Math.round((DL - FIXED.L) / 2), ohSide = Math.round((DW - FIXED.W) / 2);
    const ohWarn = ohEnd < 0 || ohSide < 0 ? { lvl: 'bad', t: 'Deska je menší než podnož.' }
      : ohEnd > 450 || ohSide > 300 ? { lvl: 'warn', t: 'Deska má velký přesah; stabilita této varianty nebyla ověřena.' } : null;
    const R = V.rates0(ratesIn), F = V.FIN.find((f) => f.id === cfg.fin) || V.FIN[0];
    const rows = [
      { id: 'material', label: 'Ocel podle B-rep objemu', qty: BOM.kg, unit: 'kg', rate: R.kg },
      { id: 'cut', label: 'Řez / pálení dílů', qty: BOM.cuts, unit: 'ks', rate: R.rez },
      { id: 'weld', label: 'Předpoklad svarových kontaktů', qty: BOM.welds, unit: 'ks', rate: R.svar },
      { id: 'paint', label: 'Prášková barva – odhad plochy', qty: BOM.paintM2, unit: 'm²', rate: R.barva * F.k },
      { id: 'prep', label: 'Příprava zakázky', qty: 1, unit: 'zakázka', rate: R.priprava },
      { id: 'board', label: 'Deska zákazníka (mimo cenu)', qty: 1, unit: 'ks', rate: 0 }
    ].map((r) => Object.assign(r, { amount: r.id === 'board' ? 0 : r.qty * r.rate }));
    const cost = rows.reduce((sum, r) => sum + r.amount, 0);
    const price = Math.round(cost * (1 + R.marze / 100) / 10) * 10;
    const vat = Math.round(price * 1.21 / 10) * 10;
    return { cfg, build: B, B, audit: null, cost, capacity: null, price, vat, total: vat * cfg.qty, load: null,
      warnings: [MODEL.note, 'Orientační cena; 68 svarových kontaktů a plocha laku 2,19 m² jsou pracovní odhady k potvrzení dílnou.', 'Deska zákazníka není zahrnuta. Nosnost nebyla ověřena.'], DL, DW,
      ohEnd, ohSide, ohWarn, rows, R, kg: BOM.kg, welds: BOM.welds, tubeM: null, mount: null };
  }
  function audit(c, rates) { return c && c.model === 'MOT' ? { overall: 'unknown', checks: [], warnings: ['Nosnost nebyla ověřena.'] } : baseAudit(c, rates); }
  function describe(c) {
    const cfg = normalize(c);
    if (!c || c.model !== 'MOT') return baseDescribe(c);
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L;
    const DW = cfg.shape === 'circle' ? DL : cfg.dmode === 'own' ? cfg.dW : cfg.W;
    return 'Motýlí podnož – pevně ' + Math.round(cfg.L) + ' × ' + Math.round(cfg.W) + ' × ' + Math.round(cfg.H) + ' mm; deska ' + cfg.shape + ' ' + DL + ' × ' + DW + ' × ' + cfg.td + ' mm';
  }

  Object.assign(V, {
    normalize, build, analyze, audit, describe,
    MOTYLI_BOM: Object.assign({}, BOM),
    MOTYLI_FIXED_DIMS: Object.assign({}, FIXED),
    motyliBase: { normalize: baseNormalize, build: baseBuild, analyze: baseAnalyze, audit: baseAudit }
  });
})(typeof window !== 'undefined' ? window : globalThis);
