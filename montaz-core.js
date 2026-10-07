/* Jádro stránky Testing: rozložení podnože, postup sestavení a přístup svařovacího hořáku.
   Bez three.js – běží v prohlížeči i v Node (tests/kontrola-montaz.js). Souřadnice v mm, Z nahoru.

   - díly (items): každý jekl zvlášť, plechy/pásoviny zvlášť, úchytky desky jako jedna skupina
   - zámky (tabLinks): který díl má zámky do kterého a jakým směrem -> směr nasazení v postupu
   - svary (seams): hrany čela jeklu, které leží na jiném dílu (pokos, tupý spoj, noha pod rámem)
   - přístup hořáku (reach): z bodu svaru se zkusí ~60 směrů v kuželu kolem ideálního směru;
     hořák = kužel trysky + válec těla, kolize se počítá proti už položeným dílům (a stolu). */
(function (root) {
  'use strict';
  const K = root.Podnoze;
  if (!K) throw new Error('montaz-core.js potřebuje core.js');

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const unit = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 1]; };
  const angDeg = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180 / Math.PI;
  const OFFS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  /* ---------------- plochy pro geometrické dotazy ---------------- */
  function faceGeo(verts, f) {
    const outer = f.outer.map((i) => verts[i]);
    let n = K.V.newell(outer);
    if (len(n) < 1e-9) n = f.n.slice();
    n = unit(n);
    if (dot(n, f.n) < 0) n = mul(n, -1);
    const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = unit(cross(n, ax)), e2 = cross(n, e1);
    const loops3 = [outer].concat((f.inner || []).map((l) => l.map((i) => verts[i])));
    const loops2 = loops3.map((l) => l.map((p) => [dot(p, e1), dot(p, e2)]));
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    loops2[0].forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    return { n, d: dot(n, outer[0]), e1, e2, loops3, loops2, bb: [x0, y0, x1, y1] };
  }
  function inside2(q, F) {
    if (q[0] < F.bb[0] - 1e-6 || q[0] > F.bb[2] + 1e-6 || q[1] < F.bb[1] - 1e-6 || q[1] > F.bb[3] + 1e-6) return false;
    let c = false;
    F.loops2.forEach((L) => {
      for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
        const a = L[i], b = L[j];
        if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
    });
    return c;
  }
  function segPointDist(p, a, b) {
    const ab = sub(b, a), l2 = dot(ab, ab);
    const t = l2 > 1e-12 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
    return len(sub(p, add(a, mul(ab, t))));
  }
  function faceDist(p, F) {
    const s = dot(F.n, p) - F.d;
    if (inside2([dot(p, F.e1), dot(p, F.e2)], F)) return Math.abs(s);
    let m = Infinity;
    F.loops3.forEach((L) => { for (let i = 0; i < L.length; i++) m = Math.min(m, segPointDist(p, L[i], L[(i + 1) % L.length])); });
    return m;
  }
  function aabbDist(p, bb) {
    let s = 0;
    for (let k = 0; k < 3; k++) { const v = p[k] < bb[0][k] ? bb[0][k] - p[k] : p[k] > bb[1][k] ? p[k] - bb[1][k] : 0; s += v * v; }
    return Math.sqrt(s);
  }
  function itemDist(p, it, maxD) {
    if (aabbDist(p, it.bb) > maxD) return Infinity;
    let m = Infinity;
    for (const F of it.faces) { const d = faceDist(p, F); if (d < m) m = d; }
    return m;
  }
  function segHitsFace(a, b, F) {
    const sa = dot(F.n, a) - F.d, sb = dot(F.n, b) - F.d;
    if ((sa > 1e-7 && sb > 1e-7) || (sa < -1e-7 && sb < -1e-7)) return false;
    if (Math.abs(sa - sb) < 1e-9) return false;
    const t = sa / (sa - sb), x = add(a, mul(sub(b, a), t));
    return inside2([dot(x, F.e1), dot(x, F.e2)], F);
  }
  function segAabb(a, b, bb, pad) {
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      const d = b[k] - a[k], lo = bb[0][k] - pad, hi = bb[1][k] + pad;
      if (Math.abs(d) < 1e-12) { if (a[k] < lo || a[k] > hi) return false; continue; }
      let u0 = (lo - a[k]) / d, u1 = (hi - a[k]) / d;
      if (u0 > u1) { const x = u0; u0 = u1; u1 = x; }
      t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      if (t0 > t1) return false;
    }
    return true;
  }
  function segHitsItem(a, b, it) {
    if (!segAabb(a, b, it.bb, 0.01)) return false;
    for (const F of it.faces) if (segHitsFace(a, b, F)) return true;
    return false;
  }

  /* ---------------- díly ---------------- */
  function mkItem(id, kind, name, poz, key, solids, part) {
    const faces = [];
    const bb = [[1e18, 1e18, 1e18], [-1e18, -1e18, -1e18]];
    solids.forEach((S) => {
      S.faces.forEach((f) => faces.push(faceGeo(S.verts, f)));
      S.verts.forEach((p) => { for (let k = 0; k < 3; k++) { bb[0][k] = Math.min(bb[0][k], p[k]); bb[1][k] = Math.max(bb[1][k], p[k]); } });
    });
    return { id, kind, name, poz, key, solids, part, faces, bb, c: mul(add(bb[0], bb[1]), 0.5), tabs: [], seams: [], bolted: false };
  }

  function describeWhere(items, center, size) {
    items.forEach((it) => {
      const w = [], dx = it.c[0] - center[0], dy = it.c[1] - center[1];
      if (Math.abs(dx) > 0.12 * size[0]) w.push(dx < 0 ? 'vlevo' : 'vpravo');
      if (Math.abs(dy) > 0.12 * size[1]) w.push(dy < 0 ? 'vpředu' : 'vzadu');
      it.where = w.join(' ');
    });
    const seen = {};
    items.forEach((it) => { const k = it.name + '|' + it.where; (seen[k] = seen[k] || []).push(it); });
    Object.values(seen).forEach((g) => { if (g.length > 1) g.forEach((it, i) => { it.where = (it.where ? it.where + ' ' : '') + '(' + (i + 1) + ')'; }); });
    items.forEach((it) => { it.label = (it.poz ? it.poz + ' ' : '') + it.name + (it.where ? ' · ' + it.where : ''); });
  }

  /* hrany čel jeklu, které leží na jiném dílu = svar */
  function findSeams(M, eps) {
    const items = M.items, out = [], keyOf = (p) => p.map((v) => Math.round(v * 2)).join(',');
    const seen = new Set();
    items.forEach((it, i) => {
      if (it.kind !== 'tube' || !it.part || !it.part.m || it.bolted) return;
      const m = it.part.m, h = M.h, S = it.solids[0];
      const tol = Math.max(0.02, h * 0.002);
      const loc = S.verts.map((p) => { const d = sub(p, m.p1); return [dot(d, m.u), dot(d, m.v), dot(d, m.w)]; });
      const ext = OFFS.map(([a, b]) => {
        const xs = loc.filter((q) => Math.abs(q[1] - a * h) < tol && Math.abs(q[2] - b * h) < tol).map((q) => q[0]);
        return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
      });
      if (ext.some((x) => !x)) return;
      [1, 2].forEach((e) => {
        const C = OFFS.map(([a, b], k) => add(add(add(m.p1, mul(m.u, ext[k][e - 1])), mul(m.v, a * h)), mul(m.w, b * h)));
        if (C.every((p) => p[2] < 0.5)) return;                      // na zemi
        let nC = unit(cross(sub(C[1], C[0]), sub(C[3], C[0])));
        if (dot(nC, e === 1 ? mul(m.u, -1) : m.u) < 0) nC = mul(nC, -1);
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4, p0 = C[k], p1 = C[k2], mid = mul(add(p0, p1), 0.5);
          // nejbližší jiný díl k půlce hrany
          let bj = -1, bd = Infinity;
          items.forEach((o, j) => { if (j === i || o.bolted) return; const d = itemDist(mid, o, eps); if (d < bd) { bd = d; bj = j; } });
          if (bj < 0 || bd > eps) continue;
          const near = (p) => items.some((o, j) => j !== i && !o.bolted && itemDist(p, o, eps) <= eps * 1.5);
          if (!near(p0) || !near(p1)) continue;
          const key = [keyOf(p0), keyOf(p1)].sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          const nS = unit(add(mul(m.v, OFFS[k][0] + OFFS[k2][0]), mul(m.w, OFFS[k][1] + OFFS[k2][1])));
          // normály ploch druhého dílu u svaru: bez té, na kterou čelo dosedá (pokud je i jiná)
          const cand = [];
          items.forEach((o, j) => {
            if (j === i || aabbDist(mid, o.bb) > eps) return;
            o.faces.forEach((F) => { if (faceDist(mid, F) <= eps && !cand.some((n) => dot(n, F.n) > 0.985)) cand.push(F.n); });
          });
          let use = cand.filter((n) => dot(n, nC) > -0.95);
          if (!use.length) use = cand;
          const nB = unit(use.reduce((acc, n) => add(acc, n), [0, 0, 0]));
          let ideal = add(nS, nB);
          ideal = len(ideal) < 0.3 ? nS : unit(ideal);
          const cs = dot(nS, nB);
          const kind = cs > 0.9 ? 'v líci' : Math.abs(cs) < 0.35 ? 'koutový' : 'šikmý';
          const sm = { id: out.length, a: i, b: bj, p0, p1, mid, nS, nB, ideal, kind, length: len(sub(p1, p0)) };
          out.push(sm);
        }
      });
    });
    out.forEach((sm) => { items[sm.a].seams.push(sm.id); if (items[sm.b].seams.indexOf(sm.id) < 0) items[sm.b].seams.push(sm.id); });
    return out;
  }

  /* obecné hledání svarů (rozpracované modely – výřezy, dotyk uprostřed délky):
     vnější hrany jeklu, které po délce leží na jiném dílu */
  function findSeamsGeneric(M, eps) {
    const items = M.items, out = [], h = M.h, t = M.t;
    const keyOf = (p) => p.map((v) => Math.round(v * 2)).join(',');
    items.forEach((it, i) => {
      if (it.kind !== 'tube' || !it.part || !it.part.m) return;
      const m = it.part.m;
      const others = items.map((o, j) => j).filter((j) => j !== i && aabbDist(it.c, items[j].bb) < M.maxDim);
      const edges = new Map();
      it.faces.forEach((F) => F.loops3.forEach((L) => { for (let k = 0; k < L.length; k++) { const a = L[k], b = L[(k + 1) % L.length]; const key = [keyOf(a), keyOf(b)].sort().join('|'); if (!edges.has(key)) edges.set(key, [a, b]); } }));
      edges.forEach(([a, b]) => {
        if (len(sub(b, a)) < 3) return;
        const mid = mul(add(a, b), 0.5);
        const lm = sub(mid, m.p1);
        if (Math.max(Math.abs(dot(lm, m.v)), Math.abs(dot(lm, m.w))) < h - 0.4 * t) return;   // vnitřní hrana (dutina jeklu)
        let bj = -1, bd = Infinity;
        others.forEach((j) => { const d = itemDist(mid, items[j], eps); if (d < bd) { bd = d; bj = j; } });
        if (bj < 0 || bd > eps) return;
        // část hrany, která na dílu bj opravdu leží
        const N = 9, flags = [];
        for (let k = 0; k < N; k++) flags.push(itemDist(add(a, mul(sub(b, a), k / (N - 1))), items[bj], eps) <= eps);
        let best = [0, -1], cur = -1;
        flags.forEach((f, k) => { if (f) { if (cur < 0) cur = k; if (k - cur > best[1] - best[0]) best = [cur, k]; } else cur = -1; });
        if (best[1] - best[0] < 2) return;
        const p0 = add(a, mul(sub(b, a), best[0] / (N - 1))), p1 = add(a, mul(sub(b, a), best[1] / (N - 1))), pm = mul(add(p0, p1), 0.5);
        // plochy u hrany: vlastní (bez té, která leží na druhém dílu) + druhého dílu
        const nearB = items[bj].faces.filter((F) => faceDist(pm, F) <= eps).map((F) => F.n);
        const own = it.faces.filter((F) => faceDist(pm, F) <= 0.02).map((F) => F.n);
        const contact = own.filter((n) => nearB.some((q) => dot(n, q) < -0.95));
        const free = own.filter((n) => !nearB.some((q) => dot(n, q) < -0.95));
        if (!free.length) return;
        let useB = contact.length ? nearB.filter((q) => contact.every((n) => dot(n, q) > -0.95)) : nearB.slice();
        if (!useB.length) useB = nearB;
        const nS = unit(free.reduce((s2, n) => add(s2, n), [0, 0, 0])), nB = unit(useB.reduce((s2, n) => add(s2, n), [0, 0, 0]));
        let ideal = add(nS, nB); ideal = len(ideal) < 0.3 ? nS : unit(ideal);
        const cs = dot(nS, nB);
        // stejný svar už našel druhý díl (nebo sousední hrana) – přeskočit
        if (out.some((sm) => segPointDist(pm, sm.p0, sm.p1) < 1 && segPointDist(sm.mid, p0, p1) < 1)) return;
        out.push({ id: out.length, a: i, b: bj, p0, p1, mid: pm, nS, nB, ideal, kind: cs > 0.9 ? 'v líci' : Math.abs(cs) < 0.35 ? 'koutový' : 'šikmý', length: len(sub(p1, p0)) });
      });
    });
    // navazující kousky stejného spoje ve stejném směru sloučit do jednoho úseku
    let merged = true;
    while (merged) {
      merged = false;
      for (let x = 0; x < out.length && !merged; x++) for (let y = x + 1; y < out.length && !merged; y++) {
        const A1 = out[x], B1 = out[y];
        if (!((A1.a === B1.a && A1.b === B1.b) || (A1.a === B1.b && A1.b === B1.a))) continue;
        if (dot(A1.ideal, B1.ideal) < 0.97) continue;
        const da = unit(sub(A1.p1, A1.p0)), db = unit(sub(B1.p1, B1.p0));
        if (Math.abs(dot(da, db)) < 0.995) continue;
        const ends = [[A1.p0, B1.p0], [A1.p0, B1.p1], [A1.p1, B1.p0], [A1.p1, B1.p1]].find(([u, w]) => len(sub(u, w)) < 0.8);
        if (!ends) continue;
        const pts = [A1.p0, A1.p1, B1.p0, B1.p1], o = A1.p0;
        const ts = pts.map((p) => dot(sub(p, o), da));
        const p0 = pts[ts.indexOf(Math.min(...ts))], p1 = pts[ts.indexOf(Math.max(...ts))];
        Object.assign(A1, { p0, p1, mid: mul(add(p0, p1), 0.5), length: len(sub(p1, p0)), ideal: unit(add(mul(A1.ideal, A1.length), mul(B1.ideal, B1.length))) });
        out.splice(y, 1); merged = true;
      }
    }
    out.forEach((sm, k) => { sm.id = k; });
    out.forEach((sm) => { items[sm.a].seams.push(sm.id); if (items[sm.b].seams.indexOf(sm.id) < 0) items[sm.b].seams.push(sm.id); });
    return out;
  }

  function prepare(A) {
    const B = A.build, cfg = A.cfg, s = cfg.size, t = cfg.t;
    const core = K.MODELS.some((m) => m.id === cfg.model);
    const pozOf = {}, rowOf = {};
    A.rows.forEach((r) => { if (r.part) { pozOf[r.part.poz] = r.poz; rowOf[r.part.poz] = r; } });
    const items = [];
    B.parts.forEach((p, i) => {
      const it = mkItem('t' + i, 'tube', p.name, pozOf[p.poz] || '', p.poz, [p.solid], p);
      it.row = rowOf[p.poz] || null;
      if (p.ins) it.ins = p.ins;   // vlastní směr nasazení (Kosočtverec z jeklu: kolmo k boku)
      it.bolted = !!(B.bolted && /^Spojka šroubovaná/.test(p.name));
      const TF = p.solid.tabFoot || {}, TD = p.solid.tabDir || {};
      [1, 2].forEach((e) => {
        if (!TF[e] || !TD[e]) return;
        TF[e].forEach((q) => {      // q = [A1o, A2o, A1i, A2i]
          const quad = [q[0], q[1], q[3], q[2]], c = mul(quad.reduce((a, b) => add(a, b), [0, 0, 0]), 0.25);
          it.tabs.push({ e, quad, c, d: unit(TD[e].d), len: TD[e].len });
        });
      });
      items.push(it);
    });
    if (B.plateBoxes.length) {
      if (core) {
        const row = A.rows.find((r) => r.plate && /Úchytka/.test(r.plate.name));
        items.push(mkItem('g', 'group', 'Úchytky desky (' + B.plateBoxes.length + ' ks)', row ? row.poz : '', 'UCH', B.plateBoxes, null));
      } else {
        B.plateBoxes.forEach((b, i) => {
          const pl = B.plates[i] || {};
          const row = A.rows.find((r) => r.plate && Math.abs(r.plate.w - pl.w) < 0.6 && Math.abs(r.plate.l - pl.l) < 0.6 && r.plate.t === pl.t);
          const itp = mkItem('p' + i, 'plate', b.label || pl.name || 'Plech', row ? row.poz : '', row ? row.poz : 'PL' + i, [b], null);
          if (b.ins) itp.ins = b.ins;   // díl si nese vlastní směr nasazení (Kosočtverec: tvary se zasouvají kolmo k boku)
          items.push(itp);
        });
      }
    }
    const bb = [[1e18, 1e18, 1e18], [-1e18, -1e18, -1e18]];
    items.forEach((it) => { for (let k = 0; k < 3; k++) { bb[0][k] = Math.min(bb[0][k], it.bb[0][k]); bb[1][k] = Math.max(bb[1][k], it.bb[1][k]); } });
    const center = mul(add(bb[0], bb[1]), 0.5), size = sub(bb[1], bb[0]);
    describeWhere(items, center, size);
    if (!core && B.G && B.G.legs) {     // rozpracované modely: nohy podle písmen A–D z návrhu
      const ks = Object.keys(B.G.legs);
      items.forEach((it, i) => { if (it.kind === 'tube' && ks[i]) { it.where = 'noha ' + ks[i]; it.label = (it.poz ? it.poz + ' ' : '') + it.name + ' · ' + it.where; } });
    }
    const M = { A, cfg, core, items, bb, center, size, maxDim: Math.max(size[0], size[1], size[2]), h: s / 2, s, t, bolted: !!B.bolted, Hf: B.dims.Hf };

    // zámky: který díl má zámek do kterého (čep zámku leží v drážce druhého dílu)
    M.tabLinks = [];
    items.forEach((it, i) => it.tabs.forEach((tb) => {
      const probe = add(tb.c, mul(tb.d, tb.len * 0.5));
      let bj = -1, bd = Infinity;
      items.forEach((o, j) => { if (j === i) return; const d = itemDist(probe, o, t + 3); if (d < bd) { bd = d; bj = j; } });
      tb.to = bd <= t + 3 ? bj : -1;
      if (tb.to >= 0 && !M.tabLinks.some((l) => l.from === i && l.to === bj && dot(l.d, tb.d) > 0.98)) M.tabLinks.push({ from: i, to: bj, d: tb.d });
    }));

    M.seams = core ? findSeams(M, 0.3) : findSeamsGeneric(M, 0.3);

    // směr rozložení: od středu ven; díly se zámky od drážek, díly s drážkami od zámků
    M.explode = items.map((it, i) => {
      const r = sub(it.c, center);
      const base = len(r) > 1 ? unit(r) : [0, 0, 1];
      let extra = [0, 0, 0];
      M.tabLinks.forEach((l) => { if (l.from === i) extra = sub(extra, l.d); if (l.to === i) extra = add(extra, l.d); });
      return len(extra) > 1e-6 ? unit(add(base, mul(unit(extra), 1.2))) : base;
    });
    return M;
  }

  /* ---------------- dosedací plochy ----------------
     Dvě protilehlé rovnoběžné plochy dvou dílů ve vzdálenosti do CT_GAP (vůle zámku 0,15 mm, výřezu 0,2 mm),
     které se překrývají = dotyk. Normála plochy dílu i (ven, směrem k dílu j) omezuje směr nasazení d:
     díl přijíždí k protikusu nebo se po něm smýká, nikdy do něj (d·n ≥ 0). */
  const CT_GAP = 0.5;
  function facePts(F) {          // body kousek uvnitř plochy u hran (a těžiště), ve 3D
    if (F.pts) return F.pts;
    const out2 = [], L = F.loops2[0], dl = 0.4;
    for (let k = 0; k < L.length; k++) {
      const a = L[k], b = L[(k + 1) % L.length], ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey);
      if (el < 1e-6) continue;
      const px = -ey / el, py = ex / el, n = Math.max(1, Math.min(40, Math.ceil(el / 20)));
      let sg = 0;
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n, m = [a[0] + ex * t, a[1] + ey * t];
        if (!sg) { if (inside2([m[0] + px * dl, m[1] + py * dl], F)) sg = 1; else if (inside2([m[0] - px * dl, m[1] - py * dl], F)) sg = -1; else continue; }
        const q = [m[0] + sg * px * dl, m[1] + sg * py * dl];
        if (inside2(q, F)) out2.push(q);
      }
    }
    let cx = 0, cy = 0; L.forEach((p) => { cx += p[0]; cy += p[1]; });
    if (L.length && inside2([cx / L.length, cy / L.length], F)) out2.push([cx / L.length, cy / L.length]);
    F.pts = out2.map((q) => add(add(mul(F.e1, q[0]), mul(F.e2, q[1])), mul(F.n, F.d)));
    return F.pts;
  }
  function aabbGap(a, b) {
    let g = 0;
    for (let k = 0; k < 3; k++) g = Math.max(g, a[0][k] - b[1][k], b[0][k] - a[1][k]);
    return g;
  }
  function contacts(M, i, j) {   // normály dotykových ploch dílu i směrem k dílu j
    const key = i + ':' + j;
    M.ct = M.ct || new Map();
    if (M.ct.has(key)) return M.ct.get(key);
    const A = M.items[i], B = M.items[j], out = [];
    if (aabbGap(A.bb, B.bb) <= CT_GAP + 0.01) {
      for (const Fa of A.faces) {
        if (out.some((n) => dot(n, Fa.n) > 0.995)) continue;
        for (const Fb of B.faces) {
          if (dot(Fa.n, Fb.n) > -0.985) continue;
          const gap = -Fb.d - Fa.d;                                    // vzdálenost rovin podél normály Fa
          if (gap > CT_GAP || gap < -CT_GAP) continue;
          const inB = (p) => inside2([dot(p, Fb.e1), dot(p, Fb.e2)], Fb), inA = (p) => inside2([dot(p, Fa.e1), dot(p, Fa.e2)], Fa);
          if (facePts(Fa).some(inB) || facePts(Fb).some(inA)) { out.push(Fa.n); break; }
        }
      }
    }
    M.ct.set(key, out);
    return out;
  }
  function neighbours(M, i) {      // díly, které se dílu i dotýkají nebo s ním mají zámky
    M.nb = M.nb || [];
    if (M.nb[i]) return M.nb[i];
    const s = [];
    M.items.forEach((o, j) => { if (j !== i && (contacts(M, i, j).length || M.tabLinks.some((l) => (l.from === i && l.to === j) || (l.to === i && l.from === j)))) s.push(j); });
    M.nb[i] = s;
    return s;
  }
  function sphereDirs(n) {
    const out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < n; k++) { const z = 1 - 2 * (k + 0.5) / n, r = Math.sqrt(1 - z * z); out.push([r * Math.cos(k * ga), r * Math.sin(k * ga), z]); }
    return out;
  }
  const SPHERE = sphereDirs(160), AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  /* směr, kterým díl i přijede na místo, když jsou položené díly placed (Set indexů).
     Zámky dávají směr přesně, dosedací plochy (pokosy, tupé spoje, výřezy, drážky) ho omezují.
     Z možných směrů se vybere ten nejbližší „zvenku a shora“ (up = kde je nahoře, podle otočení podnože). */
  function insertDir(M, i, placed, up) {
    up = up || [0, 0, 1];
    const pl = neighbours(M, i).filter((j) => placed.has(j));
    const key = i + '|' + pl.join(',') + '|' + up.join(',');
    M.ins = M.ins || new Map();
    if (M.ins.has(key)) return M.ins.get(key);
    const it = M.items[i], lab = (j) => M.items[j].label;
    const tabC = [];
    M.tabLinks.forEach((l) => {
      if (l.from === i && placed.has(l.to)) tabC.push({ d: l.d, j: l.to, why: 'zámky do ' + lab(l.to) });
      if (l.to === i && placed.has(l.from)) tabC.push({ d: mul(l.d, -1), j: l.from, why: 'zámky z ' + lab(l.from) });
    });
    const N = [];
    pl.forEach((j) => contacts(M, i, j).forEach((n) => { if (!N.some((c) => c.j === j && dot(c.n, n) > 0.995)) N.push({ n, j }); }));
    const r = sub(it.c, M.center), rad = [r[0], r[1], 0];
    const pref = it.ins ? unit(it.ins) : unit(add(mul(up, -1), len(rad) > 1 ? mul(unit(rad), -0.8) : [0, 0, 0]));
    let res;
    if (!tabC.length && !N.length) res = { dir: pref, tabs: false, conflict: false, guided: false, why: [], cands: [pref] };
    else {
      const slack = (d) => N.reduce((m, c) => Math.min(m, dot(d, c.n)), 1);
      const tabOk = (d) => tabC.every((c) => dot(d, c.d) > 0.995);
      const ok = (d) => tabOk(d) && slack(d) >= -0.03;
      let cands;
      if (tabC.length) cands = [tabC[0].d];
      else {
        cands = [pref].concat(AXES, N.map((c) => c.n), SPHERE);
        for (let a = 0; a < N.length; a++) for (let b = a + 1; b < N.length; b++) {
          const x = cross(N[a].n, N[b].n);
          if (len(x) > 0.05) { const u = unit(x); cands.push(u, mul(u, -1)); }
        }
      }
      const score = (d) => dot(d, pref) + 0.3 * Math.min(0.5, Math.max(0, slack(d))) + 0.01 * d[1];
      const feas = cands.filter(ok).sort((a, b) => score(b) - score(a));
      if (feas.length) {
        const dir = feas[0], guided = !tabC.length && !ok(pref) && !ok(mul(up, -1));   // ani „shora“ nejde – směr určují plochy
        const active = [...new Set(N.filter((c) => dot(dir, c.n) < 0.25).map((c) => c.j))];
        res = { dir, tabs: tabC.length > 0, conflict: false, guided, cands: feas,
          why: tabC.length ? [...new Set(tabC.map((c) => c.why))] : guided ? ['dosedací plochy u ' + active.map(lab).join(', ')] : [] };
      } else {
        // nejde nasadit: kdo s kým je v rozporu
        let dir, against;
        if (tabC.length) {
          dir = tabC[0].d;
          const badT = tabC.filter((c) => dot(c.d, dir) <= 0.995).map((c) => c.j), badN = N.filter((c) => dot(dir, c.n) < -0.03).map((c) => c.j);
          against = [...new Set([tabC[0].j].concat(badT, badN))];
        } else {
          dir = cands.reduce((b, d) => (slack(d) > slack(b) ? d : b), cands[0]);
          against = [...new Set(N.map((c) => c.j))];
        }
        res = { dir, tabs: tabC.length > 0, conflict: true, guided: true, cands: [], against,
          why: tabC.length ? [...new Set(tabC.map((c) => c.why))] : ['dosedací plochy u ' + against.map(lab).join(', ')] };
      }
    }
    M.ins.set(key, res);
    return res;
  }

  /* cestou na místo: díl i jede z dálky ve směru dir – nenarazí do položených dílů? (vzorky na hranách obou dílů) */
  function edgePts(it, step) {
    if (it.ep) return it.ep;
    const out = [], seen = new Set(), kq = (p) => p.map((v) => Math.round(v * 4)).join(',');
    it.faces.forEach((F) => F.loops3.forEach((L) => {
      for (let k = 0; k < L.length; k++) {
        const a = L[k], b = L[(k + 1) % L.length], key = [kq(a), kq(b)].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const n = Math.max(1, Math.min(80, Math.ceil(len(sub(b, a)) / step)));
        for (let s = 0; s <= n; s++) out.push(add(a, mul(sub(b, a), s / n)));
      }
    }));
    it.ep = out;
    return out;
  }
  function edgeDist2(q, F) {
    let m = Infinity;
    F.loops2.forEach((L) => { for (let k = 0; k < L.length; k++) { const a = L[k], b = L[(k + 1) % L.length], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey; const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / l2)) : 0; m = Math.min(m, Math.hypot(q[0] - a[0] - ex * t, q[1] - a[1] - ey * t)); } });
    return m;
  }
  function segCrossesItem(a, b, it) {     // jako segHitsItem, ale dotyk na hraně plochy se nepočítá (lícující díly)
    if (!segAabb(a, b, it.bb, 0.01)) return false;
    for (const F of it.faces) {
      const sa = dot(F.n, a) - F.d, sb = dot(F.n, b) - F.d;
      if ((sa > 1e-7 && sb > 1e-7) || (sa < -1e-7 && sb < -1e-7) || Math.abs(sa - sb) < 1e-9) continue;
      const x = add(a, mul(sub(b, a), sa / (sa - sb))), q = [dot(x, F.e1), dot(x, F.e2)];
      if (inside2(q, F) && edgeDist2(q, F) > 0.05) return true;
    }
    return false;
  }
  const SWEEP_MIN = 4;
  function sweptBox(it, dir, D) {      // obálka dílu na cestě z dálky (proti směru nasazení)
    return [[0, 1, 2].map((k) => Math.min(it.bb[0][k], it.bb[0][k] - dir[k] * D)), [0, 1, 2].map((k) => Math.max(it.bb[1][k], it.bb[1][k] - dir[k] * D))];
  }
  function sweepBlockers(M, i, dir, placed) {
    const it = M.items[i], D = M.maxDim * 1.5, off = 1.5, d = unit(dir);
    const swept = sweptBox(it, d, D);
    const out = [];
    placed.forEach((j) => {
      const o = M.items[j];
      if (j === i || aabbGap(swept, o.bb) > 0) return;
      // počet různých vzorků, které narazí (osamělé zásahy = drobné nepřesnosti geometrie u drážek, ne skutečná překážka)
      const kq = (p) => p.map((v) => Math.round(v * 2)).join(',');
      const hits = new Set();
      edgePts(it, 25).forEach((v) => { if (hits.size < SWEEP_MIN && segCrossesItem(sub(v, mul(d, off)), sub(v, mul(d, D)), o)) hits.add(kq(v)); });
      edgePts(o, 25).forEach((w) => { if (hits.size < SWEEP_MIN && aabbDist(w, swept) < 1 && segCrossesItem(add(w, mul(d, off)), add(w, mul(d, D)), it)) hits.add('b' + kq(w)); });
      if (hits.size >= SWEEP_MIN) out.push(j);
    });
    return out;
  }
  /* insertDir + kontrola cesty: z možných směrů první, kterým díl projede; když žádný, hlásí, do čeho narazí */
  function insertCheck(M, i, placed, up) {
    const r = insertDir(M, i, placed, up);
    if (r.conflict) return r;
    const key = 'sw|' + i + '|' + [...placed].sort((a, b) => a - b).join(',') + '|' + (up || [0, 0, 1]).join(',');
    if (M.ins.has(key)) return M.ins.get(key);
    let res = null, first = null;
    for (const d of r.cands.slice(0, 6)) {
      const bl = sweepBlockers(M, i, d, placed);
      if (!first) first = bl;
      if (!bl.length) { res = Object.assign({}, r, { dir: d, blocked: [], rerouted: d !== r.dir }); break; }
    }
    if (!res) res = Object.assign({}, r, { blocked: first || [] });
    M.ins.set(key, res);
    return res;
  }

  /* svar se dělá v kroku, kdy jsou položené oba díly */
  function seamStep(M, sm, stepOf) {
    const a = stepOf[sm.a], b = stepOf[sm.b];
    return a == null || b == null ? null : Math.max(a, b);
  }

  /* návrh pořadí: nejdřív díly s drážkami (rám), pak díly se zámky, pak ostatní – vždy navazující */
  function suggestOrder(M) {
    const n = M.items.length, placed = new Set(), order = [];
    const recv = (i) => M.tabLinks.some((l) => l.to === i), hasTab = (i) => M.tabLinks.some((l) => l.from === i);
    const linked = (i) => M.items[i].seams.some((sid) => { const sm = M.seams[sid]; const o = sm.a === i ? sm.b : sm.a; return placed.has(o); }) ||
      M.tabLinks.some((l) => (l.from === i && placed.has(l.to)) || (l.to === i && placed.has(l.from)));
    while (order.length < n) {
      const cand = [];
      for (let i = 0; i < n; i++) {
        if (placed.has(i)) continue;
        const it = M.items[i];
        let sc = 0;
        if (it.kind === 'group') sc -= 1000;
        if (it.kind === 'plate' && M.items.some((o, j) => o.kind === 'tube' && !placed.has(j))) sc -= 40;   // pásovinu/plech až na nohy
        if (placed.size && !linked(i)) sc -= 500;
        if (insertDir(M, i, placed).conflict) sc -= 300;
        // díl, po jehož položení by jiný díl už nešel nasadit (zámky z obou stran) – odložit
        const after = new Set(placed); after.add(i);
        for (let j = 0; j < n; j++) if (j !== i && !after.has(j) && !insertDir(M, j, placed).conflict && insertDir(M, j, after).conflict) sc -= 200;
        // … nebo by cestou na místo narazil do dílu i (jen sousední díly – sdílený svar / dotyk)
        if (placed.size) for (let j = 0; j < n; j++) {
          if (after.has(j)) continue;
          const d1 = insertDir(M, j, after);
          if (d1.conflict || aabbGap(sweptBox(M.items[j], d1.dir, M.maxDim * 1.5), it.bb) > 0) continue;
          const r0 = insertCheck(M, j, placed), r1 = insertCheck(M, j, after);
          if (!(r0.blocked && r0.blocked.length) && r1.blocked && r1.blocked.length) sc -= 150;
        }
        if (recv(i) && !hasTab(i)) sc += 60; else if (hasTab(i)) sc += 30;
        const arm = (o, re) => o.part && re.test(o.part.name || ''), hub = M.items.some((o) => arm(o, /^Rameno /));
        if (arm(it, /^Rameno dolní/)) sc += 300;        // Pavouk: nejdřív ramena k zemi (svaří se k sobě),
        else if (arm(it, /^Rameno horní/)) sc += 150;   // pak ramena k desce, nakonec horní část
        else if (it.part && it.part.order) sc += it.part.order;   // díl si nese pořadí skládání (Vnořené rámy: odspodu)
        else if (!hub && !M.items.some((q) => q.part && q.part.order) && it.kind === 'tube' && it.part && Math.abs(it.part.m.u[2]) < 0.05 && it.c[2] > M.Hf - 1.5 * M.s) sc += 45;   // horní rám nejdřív
        sc += it.seams.filter((sid) => { const sm = M.seams[sid]; return placed.has(sm.a === i ? sm.b : sm.a); }).length * 4;
        sc += it.c[2] / Math.max(1, M.size[2]) * 5;
        cand.push([sc, i]);
      }
      // z nejlepších vybrat první, který cestou na místo nenarazí do už položených dílů
      cand.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      let best = cand[0][1];
      for (const [sc, i] of cand.slice(0, 5)) {
        if (sc < cand[0][0] - 150) break;
        const r = insertCheck(M, i, placed);
        if (!r.conflict && !(r.blocked && r.blocked.length)) { best = i; break; }
      }
      placed.add(best); order.push(best);
    }
    return order;
  }

  /* ---------------- přístup hořáku ---------------- */
  const TORCH = {
    mig: { id: 'mig', lab: 'MIG/MAG', r0: 7, R: 11, taper: 25, so: 12, L: 160 },
    tig: { id: 'tig', lab: 'TIG', r0: 6.5, R: 12, taper: 35, so: 5, L: 100 }
  };
  function capDirs(D0, n, maxDeg) {
    const z = unit(D0), ax = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const x = unit(cross(z, ax)), y = cross(z, x), c0 = Math.cos(maxDeg * Math.PI / 180), ga = Math.PI * (3 - Math.sqrt(5));
    const out = [z];
    for (let i = 0; i < n - 1; i++) {
      const cz = 1 - (1 - c0) * (i + 0.5) / (n - 1), r = Math.sqrt(Math.max(0, 1 - cz * cz)), ph = i * ga;
      out.push(unit(add(add(mul(x, r * Math.cos(ph)), mul(y, r * Math.sin(ph))), mul(z, cz))));
    }
    return out;
  }
  function torchSegs(P, d, T) {
    const ax = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = unit(cross(d, ax)), e2 = cross(d, e1);
    const at = (t, r, ph) => add(add(P, mul(d, t)), add(mul(e1, r * Math.cos(ph)), mul(e2, r * Math.sin(ph))));
    const segs = [[add(P, mul(d, T.L)), add(P, mul(d, T.so))]];
    for (let j = 0; j < 12; j++) {
      const ph = j * Math.PI / 6;
      const a = at(T.L, T.R, ph), b = at(T.so + T.taper, T.R, ph), c = at(T.so, T.r0, ph);
      segs.push([a, b], [b, c]);
    }
    return segs;
  }
  /* table: { z, sign } – poloviční prostor stolu (sign·(z − table.z) > 0 je deska stolu) */
  function torchFree(P, d, T, obst, table) {
    const segs = torchSegs(P, d, T);
    if (table) for (const [a, b] of segs) for (const p of [a, b]) if (table.sign * (p[2] - table.z) > 0.01) return false;
    for (const it of obst) for (const [a, b] of segs) if (segHitsItem(a, b, it)) return false;
    return true;
  }
  function reach(M, P, D0, obstacleIdx, torch, table, opt) {
    opt = opt || {};
    const T = torch || TORCH.mig, R = T.L + T.R + 2;
    const obst = obstacleIdx.map((i) => M.items[i]).filter((it) => aabbDist(P, it.bb) < R);
    const dirs = capDirs(D0, opt.n || 60, opt.maxDeg || 75);
    const samples = dirs.map((d) => ({ d, free: torchFree(P, d, T, obst, table) }));
    let best = null, bestAng = Infinity;
    samples.forEach((sm) => { if (sm.free) { const a = angDeg(sm.d, D0); if (a < bestAng) { bestAng = a; best = sm.d; } } });
    const nFree = samples.filter((sm) => sm.free).length;
    const status = !best ? 'no' : bestAng <= 30 ? 'ok' : bestAng <= 60 ? 'tight' : 'no';
    return { samples, best, bestAng: best ? bestAng : null, nFree, n: samples.length, status };
  }

  /* proč hořák nedosáhne: stůl / tvar spoje (ostrý úhel) / konkrétní díly, které překáží */
  const RANK = { no: 0, tight: 1, ok: 2 };
  function diagnose(M, P, D0, base, obst, T, table, r) {
    if (!r || r.status === 'ok') return null;
    const q = (o, tb) => reach(M, P, D0, o, T, tb, { n: 40 });
    if (table) { const r2 = q(obst, null); if (RANK[r2.status] > RANK[r.status]) return { cause: 'table', better: r2.status }; }
    const self = q(base, null);
    if (RANK[self.status] <= RANK[r.status]) return { cause: 'shape', angle: jointAngle(M, P, base) };
    const R = T.L + T.R + 2, blockers = [];
    obst.forEach((o) => {
      if (base.indexOf(o) >= 0 || aabbDist(P, M.items[o].bb) > R) return;
      if (RANK[q(base.concat([o]), null).status] < RANK[self.status]) blockers.push(o);
    });
    return { cause: 'parts', blockers, better: self.status };
  }
  /* úhel mezi díly u svaru (vzduch mezi plochami), pro hlášku o ostrém úhlu */
  function jointAngle(M, P, base) {
    const ns = [];
    base.forEach((i) => M.items[i].faces.forEach((F) => { if (faceDist(P, F) <= 0.35 && !ns.some((n) => dot(n, F.n) > 0.985)) ns.push(F.n); }));
    let best = null;
    for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) {
      const c = dot(ns[a], ns[b]); if (c < -0.95) continue;
      const ang = 180 - Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
      if (best == null || ang < best) best = ang;
    }
    return best;
  }

  /* bod a normála na povrchu dílu nejblíž zadanému bodu (pro ruční sondu z kliknutí) */
  function surfaceNormalAt(M, p) {
    let bn = null, bd = Infinity, bi = -1;
    M.items.forEach((it, i) => { if (aabbDist(p, it.bb) > 2) return; it.faces.forEach((F) => { const d = faceDist(p, F); if (d < bd) { bd = d; bn = F.n; bi = i; } }); });
    return bn ? { n: bn, item: bi, dist: bd } : null;
  }

  const API = { prepare, insertDir, insertCheck, sweepBlockers, contacts, neighbours, diagnose, seamStep, suggestOrder, reach, torchFree, torchSegs, surfaceNormalAt, itemDist, angDeg, TORCH, V: { add, sub, mul, dot, cross, len, unit } };
  root.Montaz = API;
})(typeof window !== 'undefined' ? window : globalThis);
