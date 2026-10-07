/* Umělecké podnože – rozpracované modely (záložka „Umělecké“).
   Vlastní geometrické jádro: booleovské operace nad rovinnými tělesy (BSP CSG) a sloučení ploch
   do B-rep (plochy s otvory, sdílené vrcholy) – stejný formát těles jako core.js, takže funguje
   3D náhled, STEP, DXF, PDF i zip z dílny. Souřadnice v mm, Z nahoru, X délka stolu, Y hloubka.

   Model Pohozenec: 4 nohy do „#“ kolem středu. A/B tvoří X zepředu, C/D X zboku. Volby:
   - cfg.joint – spojení noh: 'zamky' = C a D mají v rozích výřezy přesně na profil A a B (vůle 0,2 mm),
     nohy jsou do sebe zaseknuté; 'spojovak' = nohy se nedotýkají, v půlce výšky vodorovný plech 3 mm
     se 4 zuby do děr ve vnitřních stěnách jeklů.
   - cfg.top – na čem leží deska: 'pricne' = 3 příčné pásoviny (krajní v zápichu špiček A a B, střední
     mezi špičkami C a D), 'diag' = 2 pásoviny D–A a C–B na špičkách, 'plotny' = 4 plotny na špičkách.
   Starší poptávky s modely PZ2 (zámky + příčné) a PZ3 (spojovák + šikmé) se převedou (LEGACY).

   Uchycení k desce (cfg.mount, volí truhlář): mění otvory v pásovinách a spojovací materiál – viz MOUNTS. */
(function (root) {
  'use strict';
  const P = root.Podnoze;
  if (!P) throw new Error('vyvoj.js potřebuje core.js');
  const V = P.V;

  /* ====================== CSG (BSP) ====================== */
  const EPS = 1e-6;
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vlen = (a) => Math.sqrt(vdot(a, a));
  const vunit = (a) => vmul(a, 1 / vlen(a));

  class Plane {
    constructor(n, w) { this.n = n; this.w = w; }
    static from(a, b, c) { const n = vunit(vcross(vsub(b, a), vsub(c, a))); return new Plane(n, vdot(n, a)); }
    clone() { return new Plane(this.n.slice(), this.w); }
    flip() { this.n = vmul(this.n, -1); this.w = -this.w; }
    split(poly, cf, cb, f, b) {
      const COP = 0, FR = 1, BK = 2, SP = 3;
      let pt = 0; const types = [];
      for (const v of poly.v) { const t = vdot(this.n, v) - this.w; const ty = t < -EPS ? BK : t > EPS ? FR : COP; pt |= ty; types.push(ty); }
      if (pt === COP) (vdot(this.n, poly.pl.n) > 0 ? cf : cb).push(poly);
      else if (pt === FR) f.push(poly);
      else if (pt === BK) b.push(poly);
      else {
        const fv = [], bv = [];
        for (let i = 0; i < poly.v.length; i++) {
          const j = (i + 1) % poly.v.length, ti = types[i], tj = types[j], vi = poly.v[i], vj = poly.v[j];
          if (ti !== BK) fv.push(vi);
          if (ti !== FR) bv.push(vi);
          if ((ti | tj) === SP) { const t = (this.w - vdot(this.n, vi)) / vdot(this.n, vsub(vj, vi)); const v = vadd(vi, vmul(vsub(vj, vi), t)); fv.push(v); bv.push(v.slice()); }
        }
        if (fv.length >= 3) f.push(new Poly(fv, poly.pl));
        if (bv.length >= 3) b.push(new Poly(bv, poly.pl));
      }
    }
  }
  class Poly {
    constructor(v, pl) { this.v = v; this.pl = pl || Plane.from(v[0], v[1], v[2]); }
    clone() { return new Poly(this.v.map((x) => x.slice()), this.pl.clone()); }
    flip() { this.v.reverse(); this.pl = this.pl.clone(); this.pl.flip(); }
  }
  class Node {
    constructor(polys) { this.pl = null; this.front = null; this.back = null; this.polys = []; if (polys) this.build(polys); }
    invert() { const st = [this]; while (st.length) { const n = st.pop(); n.polys.forEach((p) => p.flip()); n.pl.flip(); const t = n.front; n.front = n.back; n.back = t; if (n.front) st.push(n.front); if (n.back) st.push(n.back); } }
    clipPolys(polys) {
      if (!this.pl) return polys.slice();
      let f = [], b = [];
      for (const p of polys) this.pl.split(p, f, b, f, b);
      if (this.front) f = this.front.clipPolys(f);
      b = this.back ? this.back.clipPolys(b) : [];
      return f.concat(b);
    }
    clipTo(bsp) { const st = [this]; while (st.length) { const n = st.pop(); n.polys = bsp.clipPolys(n.polys); if (n.front) st.push(n.front); if (n.back) st.push(n.back); } }
    all() { const out = [], st = [this]; while (st.length) { const n = st.pop(); out.push(...n.polys); if (n.front) st.push(n.front); if (n.back) st.push(n.back); } return out; }
    build(polys) {
      if (!polys.length) return;
      if (!this.pl) this.pl = polys[0].pl.clone();
      const f = [], b = [];
      for (const p of polys) this.pl.split(p, this.polys, this.polys, f, b);
      if (f.length) { if (!this.front) this.front = new Node(); this.front.build(f); }
      if (b.length) { if (!this.back) this.back = new Node(); this.back.build(b); }
    }
  }
  class Solid {
    constructor(polys) { this.polys = polys; }
    clone() { return new Solid(this.polys.map((p) => p.clone())); }
    union(o) { const a = new Node(this.clone().polys), b = new Node(o.clone().polys); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all()); return new Solid(a.all()); }
    subtract(o) { const a = new Node(this.clone().polys), b = new Node(o.clone().polys); a.invert(); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all()); a.invert(); return new Solid(a.all()); }
    intersect(o) { const a = new Node(this.clone().polys), b = new Node(o.clone().polys); a.invert(); b.clipTo(a); b.invert(); a.clipTo(b); b.clipTo(a); a.build(b.all()); a.invert(); return new Solid(a.all()); }
    volume() { let v = 0; for (const p of this.polys) { const a = p.v[0]; for (let i = 1; i < p.v.length - 1; i++) v += vdot(a, vcross(p.v[i], p.v[i + 1])); } return v / 6; }
  }
  function hexa(c8) {
    const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]];
    const s = new Solid(F.map((f) => new Poly(f.map((i) => c8[i].slice()))));
    if (s.volume() < 0) s.polys.forEach((p) => p.flip());
    return s;
  }
  const box = (x0, x1, y0, y1, z0, z1) => hexa([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]);
  function prism(o, e1, e2, e3, a0, a1, b0, b1, c0, c1) {
    const Pt = (a, b, c) => vadd(vadd(vadd(o, vmul(e1, a)), vmul(e2, b)), vmul(e3, c));
    return hexa([Pt(a0, b0, c0), Pt(a1, b0, c0), Pt(a1, b1, c0), Pt(a0, b1, c0), Pt(a0, b0, c1), Pt(a1, b0, c1), Pt(a1, b1, c1), Pt(a0, b1, c1)]);
  }
  function extrude(pts2, z0, z1) {   // konvexní polygon v rovině XY
    const bot = pts2.map((p) => [p[0], p[1], z0]), top = pts2.map((p) => [p[0], p[1], z1]);
    const polys = [new Poly(bot.slice().reverse()), new Poly(top)];
    for (let i = 0; i < pts2.length; i++) { const j = (i + 1) % pts2.length; polys.push(new Poly([bot[i], bot[j], top[j], top[i]].map((x) => x.slice()))); }
    const s = new Solid(polys);
    if (s.volume() < 0) s.polys.forEach((p) => p.flip());
    return s;
  }
  const BIG = 5000, slab = (z0, z1) => box(-BIG, BIG, -BIG, BIG, z0, z1);

  /* ====================== polygony -> B-rep (sdílené vrcholy, plochy s otvory) ====================== */
  const TOL = 1e-4;
  function toBrep(solid) {
    const map = new Map(), V0 = [];
    const kf = (x) => Math.round(x / TOL);
    const vid = (p) => {
      const k = [kf(p[0]), kf(p[1]), kf(p[2])];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const kk = (k[0] + dx) + ',' + (k[1] + dy) + ',' + (k[2] + dz); if (map.has(kk)) return map.get(kk);
      }
      const id = V0.length; V0.push(p.slice()); map.set(k.join(','), id); return id;
    };
    let polys = [];
    for (const p of solid.polys) {
      let ids = p.v.map(vid); ids = ids.filter((x, i) => x !== ids[(i + ids.length - 1) % ids.length]);
      if (ids.length >= 3) polys.push({ ids, n: p.pl.n, w: p.pl.w });
    }
    // T-spoje: vložit vrcholy ležící na hranách
    const heal = (ids) => {
      const out = [];
      for (let i = 0; i < ids.length; i++) {
        const a = ids[i], b = ids[(i + 1) % ids.length], A = V0[a], B = V0[b], d = vsub(B, A), L2 = vdot(d, d);
        out.push(a);
        if (L2 < 1e-18) continue;
        const on = [];
        for (let k = 0; k < V0.length; k++) {
          if (k === a || k === b) continue;
          const t = vdot(vsub(V0[k], A), d) / L2;
          if (t <= 1e-7 || t >= 1 - 1e-7) continue;
          if (vlen(vsub(V0[k], vadd(A, vmul(d, t)))) < 5 * TOL) on.push([t, k]);
        }
        on.sort((x, y) => x[0] - y[0]).forEach((q) => out.push(q[1]));
      }
      return out;
    };
    for (let it = 0; it < 6; it++) { let ch = false; polys = polys.map((p) => { const h = heal(p.ids); if (h.length !== p.ids.length) ch = true; return { ids: h, n: p.n, w: p.w }; }); if (!ch) break; }
    // skupiny podle roviny
    const groups = new Map();
    polys.forEach((p) => { const k = p.n.map((x) => Math.round(x * 1e4)).join(',') + '|' + Math.round(p.w * 100); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
    const facesRaw = [];
    groups.forEach((lst) => {
      const n = lst[0].n, E = new Map();
      lst.forEach((p) => p.ids.forEach((a, i) => {
        const b = p.ids[(i + 1) % p.ids.length], rk = b + '>' + a;
        if ((E.get(rk) || 0) > 0) E.set(rk, E.get(rk) - 1); else E.set(a + '>' + b, (E.get(a + '>' + b) || 0) + 1);
      }));
      const rem = new Map();
      E.forEach((c, k) => { for (let q = 0; q < c; q++) { const [a, b] = k.split('>').map(Number); if (!rem.has(a)) rem.set(a, []); rem.get(a).push(b); } });
      const u = vunit(Math.abs(n[0]) < 0.9 ? vcross(n, [1, 0, 0]) : vcross(n, [0, 1, 0])), v = vcross(n, u);
      const ang = (d) => Math.atan2(vdot(d, v), vdot(d, u));
      const loops = [];
      for (;;) {
        let a0 = null; for (const [k, l] of rem) if (l.length) { a0 = k; break; }
        if (a0 === null) break;
        let prev = a0, cur = rem.get(a0).shift(); const loop = [a0]; let guard = 0;
        while (cur !== a0) {
          loop.push(cur);
          const c = rem.get(cur) || [];
          let nxt;
          if (c.length === 1) nxt = c.shift();
          else {
            const din = ang(vsub(V0[cur], V0[prev])); let best = null;
            c.forEach((cand) => { let dd = ang(vsub(V0[cand], V0[cur])) - din; dd = ((dd + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; if (!best || dd > best[0]) best = [dd, cand]; });
            nxt = best[1]; c.splice(c.indexOf(nxt), 1);
          }
          prev = cur; cur = nxt;
          if (++guard > 100000) throw new Error('toBrep: smyčka');
        }
        loops.push(loop);
      }
      facesRaw.push({ n, loops, u, v });
    });
    // odstranit vrcholy, které jsou ve všech smyčkách jen na přímce
    const corner = new Uint8Array(V0.length);
    facesRaw.forEach((f) => f.loops.forEach((L) => L.forEach((c, i) => {
      const p = V0[L[(i + L.length - 1) % L.length]], q = V0[L[(i + 1) % L.length]], d1 = vsub(V0[c], p), d2 = vsub(q, V0[c]);
      const cr = vlen(vcross(d1, d2)) / (vlen(d1) * vlen(d2) + 1e-30);
      if (cr > 1e-6 || vdot(d1, d2) < 0) corner[c] = 1;
    })));
    const used = new Map(), verts = [];
    const nid = (i) => { if (!used.has(i)) { used.set(i, verts.length); verts.push(V0[i]); } return used.get(i); };
    const faces = [];
    facesRaw.forEach((f) => {
      const ls = f.loops.map((L) => L.filter((i) => corner[i])).filter((L) => L.length >= 3);
      const p2 = (L) => L.map((i) => [vdot(V0[i], f.u), vdot(V0[i], f.v)]);
      const sarea = (Q) => { let s = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
      const inside = (pt, Q) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [x1, y1] = Q[i], [x2, y2] = Q[j]; if ((y1 > pt[1]) !== (y2 > pt[1]) && pt[0] < (x2 - x1) * (pt[1] - y1) / (y2 - y1) + x1) c = !c; } return c; };
      const outers = ls.filter((L) => sarea(p2(L)) > 0), holes = ls.filter((L) => sarea(p2(L)) <= 0);
      const fl = outers.map((o) => ({ o, h: [] }));
      holes.forEach((hl) => {
        const Q = p2(hl), cen = Q.reduce((a, b) => [a[0] + b[0] / Q.length, a[1] + b[1] / Q.length], [0, 0]);
        const probe = [Q[0][0] * 0.999 + cen[0] * 0.001, Q[0][1] * 0.999 + cen[1] * 0.001];
        let best = null;
        fl.forEach((x) => { const O = p2(x.o); if (inside(probe, O)) { const a = Math.abs(sarea(O)); if (!best || a < best[0]) best = [a, x]; } });
        if (!best) throw new Error('toBrep: otvor bez obrysu');
        best[1].h.push(hl);
      });
      fl.forEach((x) => faces.push({ outer: x.o.map(nid), inner: x.h.map((L) => L.map(nid)), n: f.n.slice() }));
    });
    return { verts, faces, tabFoot: {} };
  }

  /* ====================== modely ====================== */
  const MODELS = [
    { id: 'PZ', lab: 'Pohozenec', desc: '4 nohy do # kolem středu – spojení noh a horní část si zvolíte', icon: 'M6 6 H58 M10 42 L54 6 M54 42 L10 6 M28 6 L32 42 M36 6 L32 42', note: 'Rozpracovaný model – geometrie se ještě ladí.', wip: true }
  ];
  const LEGACY = { PZ2: { joint: 'zamky', top: 'pricne' }, PZ3: { joint: 'spojovak', top: 'diag' } };
  const owns = (id) => MODELS.some((m) => m.id === id) || !!LEGACY[id];

  /* spojení noh */
  const JOINTS = [
    { id: 'zamky', lab: 'Zaseknuté do sebe', p: 'Nohy C a D mají výřezy přesně na profil A a B – zapadnou do sebe a drží samy, svařuje se jen v rozích.', c: 'Přesné řezání na laseru, nohy jsou těsně u sebe.' },
    { id: 'spojovak', lab: 'Spojovací plech', p: 'Uprostřed vodorovný plech 3 mm se 4 zuby do děr v jeklech – nohy se vystředí samy, mezi nimi je mezera.', c: 'O jeden díl víc, plech je vidět uprostřed podnože.' }
  ];
  /* horní část – na čem leží deska (ikona = půdorys) */
  const TOPS = [
    { id: 'pricne', lab: '3 příčné pásoviny', icon: 'M14 8 V40 M32 8 V40 M50 8 V40', p: 'Krajní pásoviny zapuštěné v zápichu špiček, střední mezi nohama – deska leží na 3 liniích, nejtužší.', c: 'Pásoviny jsou zboku vidět pod deskou.' },
    { id: 'diag', lab: '2 šikmé pásoviny', icon: 'M26 8 L56 22 M38 40 L8 26', p: 'Pásoviny spojují vždy dvě špičky noh – vzhled „vrtule“, méně materiálu.', c: 'Deska leží jen na 2 pásovinách, kraje desky víc přesahují.' },
    { id: 'plotny', lab: '4 plotny na špičkách', icon: 'M50 18 H60 V26 H50 Z M4 22 H14 V30 H4 Z M28 36 H36 V44 H28 Z M28 4 H36 V12 H28 Z', p: 'Na každé noze jen malá plotna – pod deskou skoro nic není vidět, nejlehčí.', c: 'Deska drží jen ve 4 bodech, měla by být tužší (od 25 mm).' }
  ];

  /* Uchycení k desce. Otvory jsou v pásovinách: uprostřed pevný bod, dál k okrajům podle typu.
     hole: poloměr kulatého otvoru, oval: šířka oválu 40 mm podél pásoviny (dilatace masivu), csk: průměr zahloubení. */
  const MOUNTS = [
    { id: 'vrut', lab: 'Vruty do dřeva', hole: 4.5, oval: 9,
      p: 'Nejjednodušší a nejlevnější. Ovály podél pásoviny nechají masivní desku pracovat, nepraskne.',
      c: 'Opakovaným rozebíráním se díry ve dřevě vytloukají.' },
    { id: 'zapust', lab: 'Zapuštěné vruty', hole: 2.75, csk: 10.5, round: true,
      p: 'Hlavy vrutů zapuštěné v pásovině – zespodu čistý vzhled, nic nevyčnívá.',
      c: 'Jen kulaté otvory bez dilatace – pro DTD, MDF, překližku a dýhu, ne pro široký masiv.' },
    { id: 'insert', lab: 'Závitové vložky M6', hole: 3.3, oval: 6.6, minTd: 22,
      p: 'Kovový závit v desce – podnož jde rozebrat a znovu sestavit kolikrát je potřeba (stěhování, doprava).',
      c: 'Truhlář vrtá přesně podle podnože, deska musí mít aspoň 22 mm.' },
    { id: 'spony', lab: 'Stolové spony', hole: 4.5,
      p: 'Pro masiv: deska drží jen pevný bod uprostřed, spony přes hranu pásoviny ji nechají volně dilatovat.',
      c: 'Víc kusů spojovacího materiálu, montáž trvá déle.' },
    { id: 'lepeni', lab: 'Lepení', none: true,
      p: 'Pásoviny bez otvorů – pro kámen, sklo, keramiku nebo HPL compact, kam se šroubovat nedá.',
      c: 'Nerozebíratelné, lepidlo tuhne 24 h. Ne pro masiv (nemůže dilatovat).' },
    { id: 'svorniky', lab: 'Vlepené svorníky', none: true, studs: true, minTd: 25,
      p: 'Na pásovinách navařené závitové svorníky M8, které se vlepí do slepých děr v desce – zespodu žádné hlavy šroubů. Pro kámen, beton i dřevo.',
      c: 'Vrtá se přesně podle podnože, lepí se epoxidem nebo chemickou kotvou – nerozebíratelné.' }
  ];
  const mountOk = (mount, top) => !(mount === 'spony' && top === 'plotny');
  const mountOf = (id) => MOUNTS.find((m) => m.id === id) || MOUNTS[0];
  const SCREW_L = [16, 20, 25, 30, 35, 40, 45, 50];
  const nf1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

  /* spojovací materiál a postup pro truhláře podle typu uchycení a tloušťky desky */
  function mountKit(cfg, bars) {
    const M = mountOf(cfg.mount), td = cfg.td;
    const nHole = bars.reduce((a, b) => a + b.plan.holes.filter((x) => x[0] === 'hole' || x[0] === 'csk').length, 0);
    const nOval = bars.reduce((a, b) => a + b.plan.holes.filter((x) => x[0] === 'oval').length, 0);
    const nSpot = bars.reduce((a, b) => a + b.plan.spots.length, 0);
    const studs = [];
    let studL = 0;
    const hw = [], steps = [], warns = [];
    let cost = 0;
    const screwL = (d, max) => SCREW_L.filter((l) => l <= Math.min(BAR_T + td - 6, max)).pop() || SCREW_L[0];
    if (M.id === 'vrut') {
      const d = td < 22 ? 5 : 6, L = screwL(d, BAR_T + 35), n = nHole + nOval, emb = L - BAR_T;
      hw.push({ name: 'Vrut do dřeva ' + d + '×' + L + ' půlkulatá hlava TX', q: n }, { name: 'Podložka ' + (d + 0.4).toString().replace('.', ',') + ' DIN 9021 (pod ovály)', q: nOval });
      cost += n * 3 + nOval * 2;
      steps.push('Podnož položte na rub desky, vystřeďte a obkreslete otvory.',
        'Předvrtejte Ø' + nf1(d * 0.6) + ' mm do hloubky ' + (emb + 2) + ' mm (deska ' + td + ' mm, zbude ' + (td - emb - 2) + ' mm).',
        nHole ? 'Středové kulaté otvory dotáhněte pevně (pevný bod). Ve středech oválů vruty s podložkou dotáhněte jen lehce, ať deska může pracovat.'
          : 'Vruty v oválech s podložkou dotáhněte jen lehce, ať deska může pracovat.');
    } else if (M.id === 'zapust') {
      const L = screwL(5, BAR_T + 35), n = nHole, emb = L - BAR_T;
      hw.push({ name: 'Vrut do dřeva 5×' + L + ' zápustná hlava TX', q: n });
      cost += n * 3 + n * 15;   // + zahloubení otvoru
      steps.push('Podnož položte na rub desky, vystřeďte a obkreslete otvory.',
        'Předvrtejte Ø3 mm do hloubky ' + (emb + 2) + ' mm.', 'Vruty dotáhněte tak, aby hlava dosedla do zahloubení – nepřetahovat.');
      if (td >= 30) warns.push('Zapuštěné vruty nemají dilataci – pro masivní desku zvolte vruty s ovály nebo stolové spony.');
    } else if (M.id === 'insert') {
      const n = nHole + nOval;
      hw.push({ name: 'Závitová vložka M6 do dřeva (vnější Ø10, délka 13 mm)', q: n }, { name: 'Šroub M6×16 DIN 7380 imbus', q: n }, { name: 'Podložka 6,4 DIN 9021', q: n });
      cost += n * (12 + 4 + 2);
      steps.push('Podnož položte na rub desky, vystřeďte a označte středy kulatých otvorů a středy oválů.',
        'Vrtejte Ø8,5–9 mm (podle výrobce vložky) do hloubky 15 mm, kolmo – nejlépe ve stojanové vrtačce nebo s vodítkem.',
        'Vložky zašroubujte imbusem zarovnané s povrchem (ne hlouběji), pak přišroubujte podnož šrouby M6×16 s podložkou.');
      if (td < (M.minTd || 0)) warns.push('Deska ' + td + ' mm je na závitové vložky tenká (potřeba aspoň ' + M.minTd + ' mm) – vložka by mohla prorazit líc desky.');
    } else if (M.id === 'spony') {
      const L = screwL(6, BAR_T + 30);
      hw.push({ name: 'Vrut do dřeva 6×' + L + ' půlkulatá hlava TX (pevný bod)', q: nHole }, { name: 'Ocelová stolová spona Z (přes hranu pásoviny 5 mm)', q: nSpot }, { name: 'Vrut do dřeva 4×16 (ke sponě)', q: nSpot });
      cost += nHole * 3 + nSpot * (8 + 1);
      steps.push('Podnož položte na rub desky a vystřeďte. Středový otvor každé pásoviny přišroubujte vrutem 6×' + L + ' (předvrtat Ø3,5 mm, hloubka ' + (L - BAR_T + 2) + ' mm).',
        'Spony rozmístěte střídavě z obou stran pásovin (' + nSpot + ' ks), jazýček pod hranou pásoviny, a přišroubujte vruty 4×16.',
        'Spony nedotahujte natvrdo proti pásovině – deska po nich musí moct klouzat.');
    } else if (M.id === 'svorniky') {
      studL = Math.max(10, Math.min(30, Math.floor((td - 10) / 5) * 5));
      bars.forEach((b) => { b.plan.pts.forEach((u) => studs.push([b.plan.c[0] + b.plan.d[0] * u, b.plan.c[1] + b.plan.d[1] * u])); });
      hw.push({ name: 'Přivařovací svorník M8×' + studL + ' (navařit na pásovinu)', q: studs.length }, { name: 'Epoxid / chemická kotva, kartuše 300 ml', q: 1 });
      cost += studs.length * (6 + 12) + 280;
      steps.push('Podnož položte na rub desky, vystřeďte a obkreslete obrys pásovin, středy svorníků označte.',
        'Vrtejte slepé díry Ø12 mm do hloubky ' + (studL + 3) + ' mm (deska ' + td + ' mm, zbude ' + (td - studL - 3) + ' mm), vyfoukejte prach.',
        'Díry naplňte do 2/3 epoxidem nebo chemickou kotvou, podnož vsaďte, vyrovnejte a nechte 24 hodin vytvrdnout.');
      if (td >= 30) warns.push('Vlepené svorníky nepovolí desce dilataci – u široké masivní desky zvolte vruty s ovály nebo stolové spony.');
      if (td < M.minTd) warns.push('Deska ' + td + ' mm je na vlepené svorníky tenká (potřeba aspoň ' + M.minTd + ' mm).');
    } else {
      hw.push({ name: 'Lepidlo MS polymer, kartuše 290 ml', q: 1 });
      cost += 250;
      steps.push('Lepené plochy pásovin i desky odmastěte (líh, IPA), u lesklé desky zdrsněte.',
        'Naneste housenku MS polymeru Ø 8 mm podél pásovin, podnož přiložte, vystřeďte a zatižte rovnoměrně.',
        'Nechte vytvrdnout 24 hodin, plně zatěžovat až po 48 hodinách.');
      if (td >= 30) warns.push('Lepení nepovolí desce dilataci – na masivní desku zvolte vruty s ovály nebo stolové spony.');
    }
    if (cfg.top === 'plotny' && td < 25) warns.push('Na 4 plotnách se tenká deska mezi nohama prohne – doporučujeme desku od 25 mm.');
    return { M, hw: hw.filter((x) => x.q > 0), steps, warns, cost, studs, studL };
  }
  const SIZES = [30, 40, 50];
  const BAR_T = 5, BAR_STD = [40, 50, 60, 70, 80, 100];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function normalize(c) {
    c = c || {};
    const o = P.normalize(Object.assign({}, c, { model: 'U' }));
    const lg = LEGACY[c.model] || {};
    o.model = 'PZ';
    o.join = 'weld';
    o.joint = JOINTS.some((m) => m.id === c.joint) ? c.joint : lg.joint || 'spojovak';
    o.top = TOPS.some((m) => m.id === c.top) ? c.top : lg.top || 'diag';
    o.mount = MOUNTS.some((m) => m.id === c.mount) ? c.mount : 'vrut';
    if (!mountOk(o.mount, o.top)) o.mount = 'vrut';
    if (SIZES.indexOf(o.size) < 0) { o.size = 40; o.t = 2; }
    o.L = Math.max(o.L, 900); o.W = o.shape === 'circle' ? o.L : Math.max(o.W, 600); o.H = Math.max(o.H, 550);
    return o;
  }

  /* hlavní rozměry: rozteč patek, odsazení rovin noh (c), šířky pásovin */
  function layout(cfg) {
    const s = cfg.size, h = s / 2, Htop = cfg.H - cfg.td;
    const xA = clamp(Math.round(cfg.L * 0.31), 250, 750), yC = clamp(Math.round(cfg.W * 0.375), 180, 420);
    const kA = Htop / (2 * xA), kC = Htop / (2 * yC);
    const vA = h * Math.sqrt(1 + kA * kA), vC = h * Math.sqrt(1 + kC * kC);
    const cT = h + (vA + vC) / (kA + kC);           // odsazení, při kterém se nohy v rohu právě dotknou
    // zámky: nohy se v rozích překrývají aspoň o 4 mm; spojovák: mezera aspoň 2,5 mm.
    // c = (s + šířka střední pásoviny) / 2, aby se u příčných pásovin dala vzít standardní šířka.
    let c, barMid = null, gapNote = '';
    if (cfg.joint === 'zamky') {
      const ok = BAR_STD.filter((w) => (s + w) / 2 <= cT - 4);
      if (ok.length) { barMid = ok[ok.length - 1]; c = (s + barMid) / 2; }
      else { c = Math.max(h + 2, cT - 4); barMid = Math.round((2 * c - s) * 10) / 10; gapNote = 'nestandardní šířka střední pásoviny'; }
    } else {
      c = Math.ceil((cT + 2.5) * 2) / 2;
      const ok = cfg.top === 'pricne' ? BAR_STD.filter((w) => (s + w) / 2 >= c) : [];
      if (ok.length) { barMid = ok[0]; c = (s + barMid) / 2; }
      else { barMid = Math.round((2 * c - s) * 10) / 10; gapNote = 'nestandardní šířka střední pásoviny'; }
    }
    if (cfg.top !== 'pricne') gapNote = '';
    const legs = {
      A: [[-xA, c, 0], [xA, c, Htop]], B: [[xA, -c, 0], [-xA, -c, Htop]],
      C: [[c, yC, 0], [c, -yC, Htop]], D: [[-c, -yC, 0], [-c, yC, Htop]]
    };
    return { s, h, t: cfg.t, Htop, xA, yC, c, cT, barMid, gapNote, legs };
  }
  function frameOf(F, T) {
    const d = vsub(T, F), L = vlen(d), u = vmul(d, 1 / L);
    const w = vunit(vcross([0, 0, 1], u)), v = vcross(w, u);   // w vodorovně, v „nahoru“ kolmo k ose
    return { p1: F, p2: T, u, v, w, L };
  }
  function tubeRaw(F, T, s, t, zCut) {
    const m = frameOf(F, T), h = s / 2;
    const outer = prism(F, m.u, m.v, m.w, -300, m.L + 300, -h, h, -h, h);
    const inner = prism(F, m.u, m.v, m.w, -301, m.L + 301, -h + t, h - t, -h + t, h - t);
    return { m, sol: outer.subtract(inner).intersect(slab(0, zCut)) };
  }
  function topFoot(F, T, h, z) {
    const m = frameOf(F, T), out = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const q = vadd(vadd(T, vmul(m.v, a * h)), vmul(m.w, b * h)); out.push(vadd(q, vmul(m.u, (z - q[2]) / m.u[2]))); }
    return out;
  }
  const circle = (cx, cy, r, n) => { const o = []; n = n || 24; for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
  const stadium = (cx, cy, L, w, n) => { const r = w / 2, hl = (L - w) / 2, o = []; n = n || 10; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; o.push([cx + hl + r * Math.cos(a), cy + r * Math.sin(a)]); } for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + Math.PI * i / n; o.push([cx - hl + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };

  /* pásovina: střed c, směr d (jednotkový v XY), délka, šířka; otvory do dřeva mimo stopy jeklů.
     Pozice (spots) jsou pro všechna uchycení stejné, typ otvoru určuje uchycení. */
  function barPlan(c2, d, Lb, wb, forbid, mount) {
    const M = mountOf(mount), spots = [], placed = [];
    const ok = (u, half) => Math.abs(u) + half <= Lb / 2 - 12 && forbid.every(([f0, f1]) => !(u + half > f0 && u - half < f1)) && placed.every((q) => Math.abs(u - q) > 60);
    const place = (tg, half, mid) => { for (let dd = 0; dd < 140; dd += 5) for (const sg of [1, -1]) { const u = tg + sg * dd; if (ok(u, half)) { placed.push(u); (mid ? [u] : spots).push(u); return mid ? u : null; } } return null; };
    const uMid = place(0, 4.5, true);
    const span = Lb / 2 - 40, n = Math.max(1, Math.round(span / 175));
    for (const sg of [1, -1]) for (let i = 1; i <= n; i++) place(sg * i * span / n, 20);
    const holes = [];
    if (!M.none) {
      if (uMid !== null) holes.push([M.csk ? 'csk' : 'hole', uMid, M.hole]);
      if (M.oval) spots.forEach((u) => holes.push(['oval', u, M.oval]));
      else if (M.round) spots.forEach((u) => holes.push(['csk', u, M.hole]));
    }
    return { c: c2, d, L: Lb, w: wb, holes, spots, pts: (uMid !== null ? [uMid] : []).concat(spots), mount: M.id };
  }
  /* plotna na špičce: obdélník podél vodorovného směru nohy, 2 otvory po stranách stopy jeklu */
  function plotnaPlan(c2, d, fpHalf, s, mount) {
    const M = mountOf(mount), uH = Math.ceil(fpHalf + 8 + 12), Lp = Math.ceil((uH + 22) / 5) * 10, wp = BAR_STD.find((x) => x >= s + 20) || 100;
    const pts = [-uH, uH], holes = [];
    if (!M.none) pts.forEach((u) => holes.push(M.oval ? ['oval', u, M.oval, 24] : M.csk ? ['csk', u, M.hole] : ['hole', u, M.hole]));
    return { c: c2, d, L: Lp, w: wp, holes, spots: [], pts, mount: M.id, kind: 'plotna' };
  }
  function barSolid(b, z0, z1) {
    const n = [-b.d[1], b.d[0]], P2 = (u, v) => [b.c[0] + b.d[0] * u + n[0] * v, b.c[1] + b.d[1] * u + n[1] * v];
    let s = extrude([P2(-b.L / 2, -b.w / 2), P2(b.L / 2, -b.w / 2), P2(b.L / 2, b.w / 2), P2(-b.L / 2, b.w / 2)], z0, z1);
    let cut = null;
    b.holes.forEach(([k, u, r, ol]) => { const pts = (k === 'oval' ? stadium(u, 0, ol || 40, r, 8) : circle(u, 0, r, 20)).map(([x, y]) => P2(x, y)); const e = extrude(pts, z0 - 1, z1 + 1); cut = cut ? cut.union(e) : e; });
    return cut ? s.subtract(cut) : s;
  }
  function barPlate(b, poz, name) {   // pro DXF: obdélník L × w, otvory v souřadnicích pásoviny
    const M = mountOf(b.mount), csk = b.holes.some((x) => x[0] === 'csk');
    const what = M.studs ? ' – navařit svorníky M8' : M.none ? ' – bez otvorů (lepení)' : csk ? ' – otvory Ø' + nf1(2 * M.hole) + ' zahloubit 90° na Ø' + nf1(M.csk) + ' zespodu' : '';
    return { name: name + what, w: b.L, l: b.w, t: BAR_T, q: 1, holes: b.holes.filter((x) => x[0] !== 'oval').map(([, u, r]) => [u + b.L / 2, b.w / 2, r]),
      ovals: b.holes.filter((x) => x[0] === 'oval').map(([, u, w, ol]) => [u + b.L / 2, b.w / 2, ol || 40, w]), poz, kind: b.kind };
  }

  const cache = new Map();
  function build(cfgIn) {
    const cfg = normalize(cfgIn);
    const key = [cfg.joint, cfg.top, cfg.L, cfg.W, cfg.H, cfg.td, cfg.size, cfg.t, cfg.mount].join('|');
    if (cache.has(key)) return Object.assign({}, cache.get(key), { cfg });
    const G = layout(cfg), { s, h, t, Htop, c, legs } = G, Hc = Htop - BAR_T;
    const parts = [], plateBoxes = [], plates = [], notes = [];
    const zamky = cfg.joint === 'zamky', pricne = cfg.top === 'pricne';
    const raw = {};
    ['A', 'B', 'C', 'D'].forEach((k) => { raw[k] = tubeRaw(legs[k][0], legs[k][1], s, t, pricne ? Htop : Hc); });
    /* spojení noh */
    if (zamky) {
      // výřezy v rozích: C, D dostanou profil A a B (+0,2 mm)
      ['C', 'D'].forEach((k) => ['A', 'B'].forEach((n) => { const m = raw[n].m, cl = 0.2; raw[k].sol = raw[k].sol.subtract(prism(m.p1, m.u, m.v, m.w, -300, m.L + 300, -h - cl, h + cl, -h - cl, h + cl)); }));
    } else {
      // díry pro zuby spojovacího plechu (výška = půlka, osy tam procházejí středy stran čtverce)
      const zp = Htop / 2, tw = s / 4 + 0.2, z0 = zp - 1.5 - 0.2, z1 = zp + 1.5 + 0.2, r = c - h - 5, e = c + 5;
      const cuts = { A: box(-tw, tw, r, e, z0, z1), B: box(-tw, tw, -e, -r, z0, z1), C: box(r, e, -tw, tw, z0, z1), D: box(-e, -r, -tw, tw, z0, z1) };
      ['A', 'B', 'C', 'D'].forEach((k) => { raw[k].sol = raw[k].sol.subtract(cuts[k]); });
      // plech 3 mm: čtverec mezi vnitřními stěnami + 4 zuby
      const sq = c - h - 0.2, te = c - h + t + 3, w2 = s / 4;
      let pl = box(-sq, sq, -sq, sq, zp - 1.5, zp + 1.5);
      [box(sq - 1, te, -w2, w2, zp - 1.5, zp + 1.5), box(-te, -sq + 1, -w2, w2, zp - 1.5, zp + 1.5), box(-w2, w2, sq - 1, te, zp - 1.5, zp + 1.5), box(-w2, w2, -te, -sq + 1, zp - 1.5, zp + 1.5)].forEach((b) => { pl = pl.union(b); });
      plateBoxes.push(toBrep(pl));
      const outline = [];
      [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([cx, cy]) => {
        const R = (a, b) => [cx * a - cy * b, cy * a + cx * b];
        [[sq, -sq], [sq, -w2], [te, -w2], [te, w2], [sq, w2]].forEach(([a, b]) => outline.push(R(a, b)));
      });
      plates.push({ name: 'Spojovací plech se 4 zuby', w: 2 * te, l: 2 * te, t: 3, q: 1, poly: outline.map(([x, y]) => [x + te, y + te]), holes: [], kind: 'spojovak' });
    }
    /* horní část */
    let bars = [];
    if (pricne) {
      // zápich pro krajní pásovinu ve špičce A a B
      const wEnd = G.barMid;
      ['A', 'B'].forEach((k) => { const x = legs[k][1][0], w = wEnd / 2 + 0.2; raw[k].sol = raw[k].sol.subtract(box(x - w, x + w, -BIG, BIG, Hc, Htop + 10)); });
      const Lb = Math.max(Math.round((cfg.W - 100) / 10) * 10, 2 * G.yC + 2 * s + 40);
      const fpY = (k) => topFoot(legs[k][0], legs[k][1], h, Hc).map((p) => p[1]);
      const forbEnd = (k) => { const ys = fpY(k); return [[Math.min(...ys) - 8, Math.max(...ys) + 8]]; };
      bars = [
        { id: 'P1', name: 'Pásovina krajní (na špičce B)', plan: barPlan([-G.xA, 0], [0, 1], Lb, wEnd, forbEnd('B'), cfg.mount) },
        { id: 'P3', name: 'Pásovina krajní (na špičce A)', plan: barPlan([G.xA, 0], [0, 1], Lb, wEnd, forbEnd('A'), cfg.mount) },
        { id: 'P2', name: 'Pásovina střední (mezi C a D)', plan: barPlan([0, 0], [0, 1], Lb, G.barMid, [], cfg.mount) }
      ];
      if (G.gapNote) notes.push('Pozor: ' + G.gapNote + ' (' + G.barMid + ' mm).');
    } else if (cfg.top === 'diag') {
      // pásoviny D–A a C–B po špičkách
      [['P1', 'D', 'A'], ['P2', 'C', 'B']].forEach(([id, k1, k2]) => {
        const p1 = legs[k1][1], p2 = legs[k2][1], d0 = vunit([p2[0] - p1[0], p2[1] - p1[1], 0]), d = [d0[0], d0[1]], n = [-d[1], d[0]];
        const fp = topFoot(legs[k1][0], legs[k1][1], h, Hc).concat(topFoot(legs[k2][0], legs[k2][1], h, Hc));
        const us = fp.map((p) => (p[0] - p1[0]) * d[0] + (p[1] - p1[1]) * d[1]), vs = fp.map((p) => (p[0] - p1[0]) * n[0] + (p[1] - p1[1]) * n[1]);
        const u0 = Math.min(...us) - 10, u1 = Math.max(...us) + 10, v0 = Math.min(...vs), v1 = Math.max(...vs);
        const need = v1 - v0 - 6, wb = BAR_STD.find((x) => x >= need) || 100;
        const cc = [p1[0] + d[0] * (u0 + u1) / 2 + n[0] * (v0 + v1) / 2, p1[1] + d[1] * (u0 + u1) / 2 + n[1] * (v0 + v1) / 2];
        const forb = [k1, k2].map((k) => { const q = topFoot(legs[k][0], legs[k][1], h, Hc).map((p) => (p[0] - cc[0]) * d[0] + (p[1] - cc[1]) * d[1]); return [Math.min(...q) - 8, Math.max(...q) + 8]; });
        bars.push({ id, name: 'Pásovina ' + k1 + '–' + k2 + ' (na špičkách)', plan: barPlan(cc, d, Math.round(u1 - u0), wb, forb, cfg.mount) });
      });
    } else {
      // plotna na každé špičce, podél vodorovného směru nohy
      ['A', 'B', 'C', 'D'].forEach((k) => {
        const fp = topFoot(legs[k][0], legs[k][1], h, Hc), m = raw[k].m, d = [m.u[0], m.u[1]], dl = Math.hypot(d[0], d[1]);
        d[0] /= dl; d[1] /= dl;
        const cc = [fp.reduce((a, p) => a + p[0], 0) / 4, fp.reduce((a, p) => a + p[1], 0) / 4];
        const us = fp.map((p) => (p[0] - cc[0]) * d[0] + (p[1] - cc[1]) * d[1]);
        bars.push({ id: 'P' + k, name: 'Plotna na špičce noh', plan: plotnaPlan(cc, d, Math.max(...us.map(Math.abs)), s, cfg.mount) });
      });
    }
    bars.forEach((b) => { plateBoxes.push(toBrep(barSolid(b.plan, Hc, Htop))); plates.push(barPlate(b.plan, null, b.name)); });
    // díly: A≅B, C≅D (otočení o 180°)
    const names = { A: 'Noha dlouhá A/B', C: zamky ? 'Noha C/D (výřezy)' : 'Noha C/D' };
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const r = raw[k], g = k === 'A' || k === 'B' ? 'A' : 'C';
      parts.push({ poz: g, name: names[g], m: r.m, solid: toBrep(r.sol), cut1: { p: [0, 0, 0], n: [0, 0, 1] }, cut2: { p: [0, 0, Htop], n: [0, 0, 1] }, csg: r.sol });
    });
    // rozměry podnože (obrys v půdorysu)
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    parts.map((p) => p.solid).concat(plateBoxes).forEach((b) => b.verts.forEach((p) => { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }));
    const Lf = Math.round(2 * Math.max(-mnx, mxx)), Wf = Math.round(2 * Math.max(-mny, mxy));
    const kit = mountKit(cfg, bars);
    kit.studs.forEach(([x, y]) => { plateBoxes.push(toBrep(extrude(circle(x, y, 4, 12), Htop, Htop + kit.studL))); });
    const welds = (pricne ? 8 : cfg.top === 'plotny' ? 4 : 4) + (zamky ? 4 : 4);
    const out = { cfg, parts, plates, plateBoxes, boltPts: [], hw: kit.hw, kit, dims: { Lf, Wf, Hf: Htop }, bolted: false, G, notes, bars, weldJoints: welds };
    if (cache.size > 40) cache.clear();
    cache.set(key, out);
    return out;
  }

  /* ====================== audit (prutový model) ====================== */
  const SIG_ALLOW = 157, WELD_ALLOW = 180, E = 210000;
  function graph(cfg) {
    const G = layout(cfg), h = G.h, nodes = [], els = [], sup = [];
    const nodeOf = (p) => { let k = nodes.findIndex((q) => Math.abs(q[0] - p[0]) < 0.5 && Math.abs(q[1] - p[1]) < 0.5 && Math.abs(q[2] - p[2]) < 0.5); if (k < 0) { k = nodes.length; nodes.push(p.slice()); } return k; };
    const at = (k, s2) => { const [F, T] = G.legs[k]; return vadd(F, vmul(vsub(T, F), s2)); };
    const pts = { A: [0, 1], B: [0, 1], C: [0, 1], D: [0, 1] };
    const links = [];
    if (cfg.joint === 'zamky') {
      // nejbližší body os v rozích = svar
      [['A', 'C'], ['A', 'D'], ['B', 'C'], ['B', 'D']].forEach(([a, b]) => {
        const [p1, q1] = G.legs[a], [p2, q2] = G.legs[b], d1 = vsub(q1, p1), d2 = vsub(q2, p2), r = vsub(p1, p2);
        const aa = vdot(d1, d1), e = vdot(d2, d2), bb = vdot(d1, d2), cc = vdot(d1, r), f = vdot(d2, r), den = aa * e - bb * bb;
        let s1 = clamp((bb * f - cc * e) / den, 0, 1); const t1 = clamp((bb * s1 + f) / e, 0, 1); s1 = clamp((bb * t1 - cc) / aa, 0, 1);
        pts[a].push(s1); pts[b].push(t1); links.push([a, s1, b, t1]);
      });
    } else {
      ['A', 'B', 'C', 'D'].forEach((k) => pts[k].push(0.5));
      const cen = [0, 0, G.Htop / 2];
      ['A', 'B', 'C', 'D'].forEach((k) => links.push(['cen', cen, k, 0.5]));
    }
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const ss = [...new Set(pts[k].map((x) => Math.round(x * 1e6) / 1e6))].sort((x, y) => x - y);
      // jemnější dělení kvůli vzpěru a průhybu
      const fine = []; ss.forEach((x, i) => { fine.push(x); if (i < ss.length - 1) { const n = 4; for (let q = 1; q < n; q++) fine.push(x + (ss[i + 1] - x) * q / n); } });
      for (let i = 0; i < fine.length - 1; i++) els.push({ i: nodeOf(at(k, fine[i])), j: nodeOf(at(k, fine[i + 1])), kind: 'tube', tag: k });
      sup.push(nodeOf(at(k, 0)));
    });
    links.forEach((l) => {
      const a = l[0] === 'cen' ? nodeOf(l[1]) : nodeOf(at(l[0], l[1])), b = nodeOf(at(l[2], l[3]));
      if (a !== b) els.push({ i: a, j: b, kind: 'rigid', tag: 'spoj' });
    });
    const tops = ['A', 'B', 'C', 'D'].map((k) => nodeOf(at(k, 1)));
    return { cfg, nodes, els, sup: [...new Set(sup)], tops, G };
  }

  function audit(cfgIn, ratesIn) {
    const cfg = normalize(cfgIn), R = P.rates0(ratesIn), g = graph(cfg), n = g.nodes.length, N = 6 * n, sec = P.sectionOf(cfg.size, cfg.t);
    const F1 = new Float64Array(N); g.tops.forEach((i) => { F1[6 * i + 2] = -1500 / g.tops.length; });
    const loadsP = g.tops.map((i) => { const F = new Float64Array(N); F[6 * i + 2] = -1000; return F; });
    const hx = new Float64Array(N), hy = new Float64Array(N);
    g.tops.forEach((i) => { hx[6 * i] = 400 / 4; hy[6 * i + 1] = 400 / 4; hx[6 * i + 2] = -500 / 4; hy[6 * i + 2] = -500 / 4; });
    const sol = P.solveFrame(g, [F1, hx, hy].concat(loadsP));
    const [r1, rx, ry] = sol.results, rp = sol.results.slice(3);
    const dz1 = Math.max(...g.tops.map((i) => -r1.u[6 * i + 2]));
    const span = Math.max(2 * g.G.xA, 2 * g.G.yC);
    const swayX = Math.max(...g.tops.map((i) => Math.abs(rx.u[6 * i]))), swayY = Math.max(...g.tops.map((i) => Math.abs(ry.u[6 * i + 1]))), sway = Math.max(swayX, swayY);
    const sP = Math.max(...rp.map((r) => r.smax)), sH = Math.max(rx.smax, ry.smax);
    let buck = Infinity;
    r1.forces.forEach((f) => { if (f && f.N < -1) { const Pcr = Math.PI * Math.PI * E * sec.I / (f.Le * f.Le); buck = Math.min(buck, Pcr / (-f.N)); } });
    const capN = 1500 * Math.min(SIG_ALLOW / Math.max(r1.smax, 1e-6), (span / 300) / Math.max(dz1, 1e-6));
    // převržení
    const hull = P.convexHull(g.sup.map((i) => [g.nodes[i][0], g.nodes[i][1]]));
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L, DW = cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const Vf = cfg.L >= 1600 ? 400 : cfg.L < 800 ? 200 : 300;
    const B = build(cfg), kgSteel = massOf(B), deskKg = 15 * DL * DW / 1e6, Wt = (kgSteel + deskKg) * 9.81;
    const probe = P.deskOutline(cfg.shape, DL, DW).map((p) => { const r2 = Math.hypot(p[0], p[1]); return [p[0] * (1 - 50 / r2), p[1] * (1 - 50 / r2)]; });
    let stab = Infinity;
    for (let k = 0; k < hull.length; k++) {
      const a = hull[k], b = hull[(k + 1) % hull.length], ex = [b[0] - a[0], b[1] - a[1]], le = Math.hypot(ex[0], ex[1]), nO = [ex[1] / le, -ex[0] / le];
      const dist = (p) => (p[0] - a[0]) * nO[0] + (p[1] - a[1]) * nO[1], cgArm = -dist([0, 0]);
      probe.forEach((p) => { const d = dist(p); if (d > 0) stab = Math.min(stab, (Wt * cgArm) / (Vf * d)); });
    }
    // výroba
    const fab = [];
    B.parts.forEach((p) => {
      const L = P.partLength(p);
      if (L > 6400) fab.push({ lvl: 'bad', t: p.name + ': délka ' + Math.round(L) + ' mm přesahuje tyč 6,5 m.' });
      const ang = Math.acos(Math.abs(p.m.u[2])) * 180 / Math.PI;
      if (ang > 62) fab.push({ lvl: 'warn', t: p.name + ': ostrý řez ' + ang.toFixed(1) + '° – dlouhá špička.' });
    });
    B.notes.forEach((t) => fab.push({ lvl: 'warn', t }));
    const uniq = []; fab.forEach((f) => { if (!uniq.some((x) => x.t === f.t)) uniq.push(f); });
    const checks = [];
    const add2 = (id, lab, val, unit, lvl, hint) => checks.push({ id, lab, val, unit, lvl, hint });
    const lv = (x, ok, warn, lower) => lower ? (x >= ok ? 'ok' : x >= warn ? 'warn' : 'bad') : (x <= ok ? 'ok' : x <= warn ? 'warn' : 'bad');
    add2('pt', 'Bodová síla 1000 N na špičku nohy (napětí)', sP, 'MPa', lv(sP, SIG_ALLOW, 235), 'EN 12521 zk. 2, dovoleno ' + SIG_ALLOW + ' MPa');
    add2('weld', 'Svary při 1000 N', sP * 1.43, 'MPa', lv(sP * 1.43, WELD_ALLOW, 260), 'koutový svar a = 0,7 t po obvodu');
    add2('cap', 'Nosnost rovnoměrně', Math.min(999, Math.floor(capN / 9.81 / 10) * 10), 'kg', lv(capN / 9.81, 150, 80, true), 'napětí ≤ ' + SIG_ALLOW + ' MPa a průhyb ≤ L/300');
    add2('defl', 'Průhyb špiček při 150 kg', dz1, 'mm', lv(dz1, span / 300, span / 200), 'limit L/300 = ' + (span / 300).toFixed(1) + ' mm');
    add2('sway', 'Vyklonění při 400 N do boku', sway, 'mm', lv(sway, 5, 10), 'podélně ' + swayX.toFixed(1) + ' mm, příčně ' + swayY.toFixed(1) + ' mm');
    add2('hs', 'Napětí při 400 N do boku', sH, 'MPa', lv(sH, SIG_ALLOW, 235), 'EN 12521 zk. 1');
    add2('buck', 'Vzpěr tlačených dílů', buck === Infinity ? 99 : Math.min(99, buck), '× rezerva', lv(buck, 3, 1.5, true), 'Eulerova síla / skutečná síla při 150 kg');
    add2('stab', 'Stabilita proti převržení', stab === Infinity ? 99 : Math.min(99, stab), '× rezerva', lv(stab, 1.5, 1.0, true), Vf + ' N 50 mm od hrany desky, deska ' + deskKg.toFixed(0) + ' kg');
    const lvls = checks.map((c) => c.lvl).concat(uniq.map((f) => f.lvl));
    if (sol.singular) lvls.push('bad');
    const overall = lvls.indexOf('bad') >= 0 ? 'bad' : lvls.indexOf('warn') >= 0 ? 'warn' : 'ok';
    void R;
    return { cfg, checks, fab: uniq, overall, singular: sol.singular, capKg: capN / 9.81, sway, dz1, stab, graph: g };
  }

  function massOf(B) { let kg = 0; B.parts.forEach((p) => { kg += P.volume(p.solid) * 7.85e-6; }); B.plateBoxes.forEach((b) => { kg += P.volume(b) * 7.85e-6; }); return kg; }

  /* ====================== kusovník, cena, nosnost ====================== */
  function analyze(cfgIn, ratesIn) {
    const R = P.rates0(ratesIn), B = build(cfgIn), cfg = B.cfg, s = cfg.size, t = cfg.t, F = P.FIN.find((f) => f.id === cfg.fin);
    const rows = [], problems = [];
    let n = 0, tubeM = 0, kg = 0;
    ['A', 'C'].forEach((g) => {
      const grp = B.parts.filter((p) => p.poz === g), p = grp[0], L = P.partLength(p), vol = P.volume(p.solid);
      grp.forEach((q) => { if (Math.abs(P.partLength(q) - L) > 0.3 || Math.abs(P.volume(q.solid) - vol) > 5) problems.push(g + ': kusy nejsou shodné'); });
      n++; const poz = 'P' + String(n).padStart(2, '0');
      const ang = Math.round(Math.acos(Math.abs(p.m.u[2])) * 1800 / Math.PI) / 10;
      const feat = [cfg.joint === 'zamky' ? (g === 'C' ? 'výřezy pro A a B' : '') : 'díra pro zub plechu', cfg.top === 'pricne' && g === 'A' ? 'zápich pro pásovinu' : ''].filter(Boolean).join(', ');
      tubeM += L * grp.length / 1000; kg += vol * 7.85e-6 * grp.length;
      rows.push({ poz, name: p.name, kind: 'tube', prof: 'jekl ' + s + '×' + s + '×' + t, L, len: L.toFixed(1), cut: ang + '° / ' + ang + '°', feat, q: grp.length, stroj: 'K2', file: poz + '_L' + Math.round(L) + '_' + grp.length + 'ks.step', part: p });
    });
    // shodné pásoviny sloučit
    const pl = [];
    B.plates.forEach((p) => {
      const sig = JSON.stringify([p.w, p.l, p.t, p.holes, p.ovals, p.poly].map((x) => x === undefined ? null : x), (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v);
      const same = pl.find((x) => x.sig === sig);
      if (same) same.p.q += 1; else pl.push({ sig, p: Object.assign({}, p) });
    });
    B.plateBoxes.forEach((b) => { kg += P.volume(b) * 7.85e-6; });
    pl.forEach(({ p }) => {
      n++; p.poz = 'P' + String(n).padStart(2, '0');
      const wtxt = P.nf(p.w, 1) + ' × ' + P.nf(p.l, 1);
      rows.push({ poz: p.poz, name: p.name, kind: 'plate', prof: (p.kind ? 'plech ' : 'pásovina ') + p.t + ' mm', len: wtxt, cut: 'pálení', feat: '', q: p.q, stroj: 'C2', file: p.poz + '_' + (p.kind ? 'plech' : 'pasovina') + p.t + '_' + Math.round(p.w) + 'x' + Math.round(p.l) + '_' + p.q + 'ks.dxf', plate: p });
    });
    const cuts = rows.reduce((a, r) => a + r.q, 0);
    B.hw.forEach((x) => { n++; rows.push({ poz: 'P' + String(n).padStart(2, '0'), name: x.name, kind: 'hw', prof: 'nakupovaný díl', len: '', cut: '', feat: '', q: x.q, stroj: '', file: '' }); });
    const welds = B.weldJoints, surf = tubeM * 4 * s / 1000 + B.plates.reduce((a, p) => a + 2 * p.w * p.l / 1e6, 0);
    const markup = 1 + R.marze / 100;
    const cost = kg * R.kg + cuts * R.rez + welds * R.svar + surf * R.barva * F.k + R.priprava + B.kit.cost;
    const price = Math.round(cost * markup / 10) * 10, vat = Math.round(price * 1.21 / 10) * 10;
    let au = null; try { au = audit(cfg, R); } catch (e) { au = null; }
    const load = au ? Math.min(500, Math.floor(au.capKg / 10) * 10) : 0;
    const lvl = load >= 150 ? 'ok' : load >= 80 ? 'warn' : 'bad';
    const warns = ['Rozpracovaný model – tvar a výrobní podklady se ještě ověřují, cena je orientační.'];
    if (lvl === 'bad') warns.push('Na tuto velikost je podnož slabá – zvolte silnější jekl nebo menší stůl.');
    if (lvl === 'warn') warns.push('Na běžné stolování stačí, na těžší zátěž zvolte silnější profil.');
    if (au) {
      const ck = (id) => au.checks.find((c) => c.id === id);
      if (ck('sway').lvl !== 'ok') warns.push(ck('sway').lvl === 'bad' ? 'Stůl bude do boku výrazně pružit (' + ck('sway').val.toFixed(0) + ' mm při opření) – zvolte silnější jekl.' : 'Stůl může do boku mírně pružit – pro klid zvolte silnější jekl.');
      if (ck('stab').lvl !== 'ok') warns.push('Při opření o okraj desky je stůl na hraně stability – zmenšete přesah desky.');
      if (ck('pt').lvl === 'bad' || ck('weld').lvl === 'bad') warns.push('Při soustředěné zátěži by byla podnož přetížená – zvolte silnější jekl.');
    }
    B.notes.forEach((x) => warns.push(x));
    B.kit.warns.forEach((x) => warns.push(x));
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L, DW = cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const ohEnd = Math.round((DL - B.dims.Lf) / 2), ohSide = Math.round((DW - B.dims.Wf) / 2);
    let ohWarn = null;
    if (ohEnd < 0 || ohSide < 0) ohWarn = { lvl: 'bad', t: 'Podnož by vyčnívala zpod desky. Zvětšete stůl nebo použijte Přizpůsobit podnož desce.' };
    else if (ohEnd > 450 || ohSide > 300) ohWarn = { lvl: 'warn', t: 'Velký přesah desky – při opření o kraj se deska může prohýbat nebo stůl převážit.' };
    return { R, B, build: B, cfg, rows, tubeM, kg, welds, bolts: 0, price, vat, load, problems, audit: au, lvl, warns, DL, DW, ohEnd, ohSide, ohWarn,
      boltOK: false, boltWhy: 'model', bolted: false, boltDiff: 0, mount: B.kit, total: vat * cfg.qty };
  }

  function describe(cfg) {
    const M = MODELS.find((m) => m.id === cfg.model) || MODELS[0], F = P.FIN.find((f) => f.id === cfg.fin), S = P.SHAPES.find((x) => x.id === cfg.shape);
    const desk = cfg.shape === 'circle' ? 'Ø ' + P.nf(cfg.L) : P.nf(cfg.L) + ' × ' + P.nf(cfg.W);
    const J = JOINTS.find((x) => x.id === cfg.joint), T = TOPS.find((x) => x.id === cfg.top);
    return M.lab + ' (umělecká, nohy: ' + J.lab.toLowerCase() + ', nahoře: ' + T.lab + '), ' + desk + ' × ' + P.nf(cfg.H) + ' mm, jekl ' + cfg.size + '×' + cfg.size + '×' + cfg.t + ', svařovaná, ' + F.lab + ', deska ' + S.lab.toLowerCase() + ' ' + cfg.td + ' mm, uchycení: ' + mountOf(cfg.mount).lab.toLowerCase();
  }

  const API = { MODELS, MOUNTS, JOINTS, TOPS, mountOk, owns, normalize, build, analyze, audit, describe, layout, csg: { Solid, box, prism, extrude, toBrep } };
  P.register(API);
  // stejné rozhraní jako Podnoze, jen s vlastními modely (pro stránku Umělecké)
  root.Vyvoj = Object.assign({}, P, { MODELS, MOUNTS, JOINTS, TOPS, mountOk, SIZES, DEFAULT_CFG: Object.assign({}, P.DEFAULT_CFG, { model: 'PZ' }), normalize, build, analyze, audit, describe, ext: API });
})(typeof window !== 'undefined' ? window : globalThis);
