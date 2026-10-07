/* Umělecké podnože – rozpracované modely (záložka „Umělecké“).
   Vlastní geometrické jádro: booleovské operace nad rovinnými tělesy (BSP CSG) a sloučení ploch
   do B-rep (plochy s otvory, sdílené vrcholy) – stejný formát těles jako core.js, takže funguje
   3D náhled, STEP, DXF, PDF i zip z dílny. Souřadnice v mm, Z nahoru, X délka stolu, Y hloubka.

   Model Pohozenec: 4 nohy do „#“ kolem středu. A/B tvoří X zepředu, C/D X zboku. Volby:
   - cfg.joint – spojení noh: 'zamky' = C a D mají v rozích výřezy přesně na profil A a B (vůle 0,2 mm),
     nohy jsou do sebe zaseknuté; 'spojovak' = nohy se nedotýkají, v půlce výšky vodorovný plech 3 mm
     se 4 zuby do děr ve vnitřních stěnách jeklů.
   - cfg.top – na čem leží deska: 'pricne' = 3 příčné pásoviny (krajní v zápichu špiček A a B, střední
     mezi špičkami C a D), 'diag' = 2 pásoviny D–A a C–B na špičkách, 'kriz' = kříž z pásovin A–B (celá)
     a C–D (2 půlky dosedající na A–B), 'ram' = obvodový rámeček z pásoviny přes všechny 4 špičky (pokosy 45°),
     'ramj' = obvodový rámeček z jeklu naležato (pokosy 45°, otvory v horní stěně, montážní ve spodní),
     'plotny' = 4 plotny na špičkách.
   - cfg.barT / cfg.barW – tloušťka 2–5 mm a šířka 20–50 mm pásovin a ploten (0 = automaticky),
     cfg.barL – délka pásovin (0 = automaticky), cfg.plL – délka ploten (0 = automaticky). Pásoviny i plotny
     se vždy zkrátí tak, aby nepřečuhovaly přes desku (okraj 20 mm), ale zakryjí špičky noh.
     cfg.plS – tvar ploten ('obd' obdélník / 'x' kříž X se 4 otvory), cfg.rjp – profil jeklu rámečku 10×10 až 40×40 ('auto' = 40×20).
   Starší poptávky s modely PZ2 (zámky + příčné) a PZ3 (spojovák + šikmé) se převedou (LEGACY).

   Model Infinity Cube (VR, konferenční stolek): obrys kvádr, JEDNA nepřerušená uzavřená smyčka z jeklu přes
   všech 12 hran (16 úseků, 4 hrany zdvojené jeklem vedle sebe), lomy 90° s pokosem 45°, horní rám v jedné
   rovině nese čiré sklo. Trasa VR_ROUTE = freecad/stolek_kostra.py.

   Model Kosočtverec (KS): 2 boky na koncích stolu, každý je obdélník rozdělený na 4 rohové trojúhelníky
   a kosočtverec uprostřed (vrcholy ve středech stran). Všechny tvary jsou duté rámečky z pásoviny postavené
   na hranu (hloubka ksD, tloušťka ksT), mezi tvary je mezera ksG a přes každou mezeru vedou 2 závitové
   tyče (ksM) s maticemi z obou stran obou stěn. Deska leží na horních pásech horních trojúhelníků.

   Model Pavouk (PV): hvězdicová podnož jen z jeklů – 4 ramena dolů na zem a 4 nahoru k desce. Rameno dolů
   a rameno nahoru na opačné straně leží v jedné přímce (ve svislých rovinách tvoří X). Na každé straně se rameno
   nahoru a dolů potkají jako „>“ s pokosem ve středu výšky, sousední strany na sebe dosednou rovnými řezy
   ve svislých rovinách půlících úhel mezi stranami. cfg.pvLay: 'diag' = špičky i patky v rozích ±xF × ±yF,
   'plus' = kříž 90° – dvě delší nohy podél stolu (±xF, 0) a dvě kratší kolmo (0, ±yF).
   Horní část a uchycení se volí stejně jako u Pohozence (bez volby spojení noh).

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
    { id: 'VR', lab: 'Infinity Cube', desc: 'Konferenční stolek – jedna nepřerušená smyčka z jeklu přes všech 12 hran kvádru, nahoře čiré sklo', icon: 'M10 8 H54 V40 H10 Z M16 14 V40 M48 14 V40 M16 14 H48', note: 'Rozpracovaný model – geometrie se ještě ladí.', wip: true, vr: true },
    { id: 'KS', lab: 'Kosočtverec', desc: 'Boky z trojúhelníků a kosočtverce z pásoviny, spojené závitovými tyčemi s maticemi', icon: 'M6 6 H58 M12 6 H28 L12 22 Z M52 6 H36 L52 22 Z M12 42 H28 L12 26 Z M52 42 H36 L52 26 Z M32 10 L48 24 L32 38 L16 24 Z', note: 'Rozpracovaný model – geometrie se ještě ladí.', wip: true, ks: true },
    { id: 'PV', lab: 'Pavouk', desc: 'Hvězdicová podnož jen z jeklů – 4 ramena k zemi a 4 k desce, sbíhají se uprostřed', icon: 'M6 6 H58 M12 42 L52 6 M52 42 L12 6 M28 18 H36 V30 H28 Z', note: 'Rozpracovaný model – geometrie se ještě ladí.', wip: true, pav: true },
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
    { id: 'diag', lab: '2 šikmé pásoviny', icon: 'M18 8 L58 24 M46 40 L6 24', p: 'Pásoviny spojují vždy dvě špičky noh – vzhled „vrtule“, méně materiálu.', c: 'Deska leží jen na 2 pásovinách, kraje desky víc přesahují.' },
    { id: 'kriz', lab: 'Kříž z pásovin', icon: 'M6 22 L58 26 M30 4 L34 44', p: 'Dvě pásoviny přes střed do kříže – deska je podepřená i uprostřed. Nejčastější volba pro kulaté a čtvercové desky.', c: 'Uprostřed se pásoviny stýkají, svar je pod deskou vidět zespodu.' },
    { id: 'ram', lab: 'Obvodový rámeček', icon: 'M8 8 H56 V40 H8 Z', p: 'Rámeček z pásoviny přes všechny 4 nohy – deska leží po celém obvodu. Pro kámen, sklo, keramiku a tenké desky, které se nesmí prohnout.', c: 'Nejvíc materiálu a svarů, rámeček je zboku vidět pod deskou.' },
    { id: 'ramj', lab: 'Rámeček z jeklu', icon: 'M8 8 H56 V40 H8 Z M13 13 H51 V35 H13 Z', p: 'Rámeček z jeklu 10×10 až 40×40 naležato – tužší než pásovina, deska leží po celém obvodu. Klasika u jídelních stolů.', c: 'Dražší, zboku je pod deskou vidět lem jeklu. Jekl užší než 25 mm jde jen lepit (nebo svorníky).' },
    { id: 'plotny', lab: '4 plotny na špičkách', icon: 'M50 18 H60 V26 H50 Z M4 22 H14 V30 H4 Z M28 36 H36 V44 H28 Z M28 4 H36 V12 H28 Z', p: 'Na každé noze jen malá plotna – obdélník nebo X se 4 otvory. Pod deskou skoro nic není vidět, nejlehčí.', c: 'Deska drží jen ve 4 bodech, měla by být tužší (od 25 mm).' }
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
  // u Pavouka jsou špičky v rozích obdélníku: „šikmé“ pásoviny vedou podél stolu, příčné jsou jen 2
  const PV_TOPS = {
    pricne: { lab: '2 příčné pásoviny', icon: 'M14 8 V40 M50 8 V40', p: 'Každá pásovina spojí dvě špičky na jednom konci stolu – jednoduché a levné.', c: 'Deska podepřená jen na koncích, uprostřed volně.' },
    diag: { lab: '2 podélné pásoviny', icon: 'M8 14 H56 M8 34 H56', p: 'Pásoviny podél stolu přes špičky – deska se podélně neprohne.', c: 'Na čelech desky větší přesah bez podpory.' }
  };
  const PV_PLUS_TOPS = {
    pricne: { lab: '3 příčné pásoviny', icon: 'M14 8 V40 M32 8 V40 M50 8 V40', p: 'Přes konce dlouhých noh a uprostřed přes obě krátké – deska leží na 3 liniích.', c: 'Pásoviny jsou zboku vidět pod deskou.' },
    kriz: { p: 'Pásoviny po nohách do kříže – jedna podél, druhá napříč. Podepře desku i uprostřed.' }
  };
  const PV_LAYS = [
    { id: 'diag', lab: 'X v rozích', p: 'Nohy míří do rohů stolu – v půdorysu tvar X.' },
    { id: 'plus', lab: 'Kříž 90°', p: 'Dvě delší nohy podél stolu a dvě kratší přesně kolmo – v půdorysu kříž.' }
  ];
  const topsFor = (model, lay) => TOPS.map((tp) => {
    const ov = model !== 'PV' ? null : lay === 'plus' ? PV_PLUS_TOPS[tp.id] : PV_TOPS[tp.id];
    return ov ? Object.assign({}, tp, ov) : tp;
  });
  const mountOk = (mount, top, jw) => !(mount === 'spony' && (top === 'plotny' || top === 'ramj')) &&
    !(top === 'ramj' && jw < RJ_SCREW && mount !== 'lepeni' && mount !== 'svorniky') && !(top === 'ramj' && jw < 16 && mount === 'svorniky');
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
    const BAR_T = cfg.model === 'VR' ? cfg.t : cfg.model === 'KS' ? (cfg.ksMat === 'jekl' ? KS_JEKL.find((j) => j.id === cfg.ksJ).t : cfg.ksT) : cfg.top === 'ramj' ? rjOf(cfg).t : cfg.barT;   // co svírá hlava šroubu
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
      hw.push({ name: 'Vrut do dřeva 6×' + L + ' půlkulatá hlava TX (pevný bod)', q: nHole }, { name: 'Ocelová stolová spona Z (přes hranu pásoviny ' + BAR_T + ' mm)', q: nSpot }, { name: 'Vrut do dřeva 4×16 (ke sponě)', q: nSpot });
      cost += nHole * 3 + nSpot * (8 + 1);
      steps.push('Podnož položte na rub desky a vystřeďte. Středový otvor každé pásoviny přišroubujte vrutem 6×' + L + ' (předvrtat Ø3,5 mm, hloubka ' + (L - BAR_T + 2) + ' mm).',
        'Spony rozmístěte střídavě z obou stran pásovin (' + nSpot + ' ks), jazýček pod hranou pásoviny, a přišroubujte vruty 4×16.',
        'Spony nedotahujte natvrdo proti pásovině – deska po nich musí moct klouzat.');
    } else if (M.id === 'svorniky') {
      studL = Math.max(10, Math.min(30, Math.floor((td - 10) / 5) * 5));
      bars.forEach((b) => { const pl = b.plan, nn = [-pl.d[1], pl.d[0]]; pl.pts.forEach((q) => { const [u, v] = Array.isArray(q) ? q : [q, 0]; studs.push([pl.c[0] + pl.d[0] * u + nn[0] * v, pl.c[1] + pl.d[1] * u + nn[1] * v]); }); });
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
  /* Kosočtverec: závitové tyče (d, matice: výška h a otvor klíče sw, otvor v pásu Ø hole), nejmenší mezera */
  const KS_ROD = { M12: { d: 12, h: 10, sw: 18, hole: 13, gmin: 30 }, M16: { d: 16, h: 13, sw: 24, hole: 17.5, gmin: 34 }, M20: { d: 20, h: 16, sw: 30, hole: 22, gmin: 40 } };
  const KS_GAP = [30, 40, 50, 60];
  /* jekly pro tvary Kosočtverce: D = hloubka (kolmo k boku), w = šířka v rovině boku, t = stěna */
  const KS_JEKL = [[40, 40, 2], [50, 30, 2], [60, 20, 2], [60, 30, 2], [60, 40, 3], [80, 20, 2], [80, 40, 3], [100, 40, 3]]
    .map(([D, w, t]) => ({ id: D + 'x' + w, D, w, t }));
  const BAR_TS = [2, 3, 4, 5], BAR_STD = [20, 25, 30, 35, 40, 45, 50], PL_L = [80, 100, 120, 150, 180, 200, 250];
  // šířky, které může vynutit geometrie (střední příčná pásovina musí vyplnit mezeru mezi špičkami C a D)
  const BAR_ALL = BAR_STD.concat([60, 70, 80, 100]), DESK_EDGE = 20;
  /* jekly rámečku naležato: w = šířka (vodorovně), h = výška, t = stěna */
  const RJ = [[10, 10, 1], [15, 15, 1.5], [20, 10, 1.5], [20, 20, 2], [25, 25, 2], [30, 15, 2], [30, 20, 2], [30, 30, 2], [35, 35, 2], [40, 20, 2], [40, 30, 2], [40, 40, 2]]
    .map(([w, h, t]) => ({ id: w + 'x' + h, w, h, t }));
  const RJ_SCREW = 25;   // užší jekl: montážní otvor ve spodní stěně se nevejde – jen lepení nebo svorníky
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const inside = (pt, Q) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [x1, y1] = Q[i], [x2, y2] = Q[j]; if ((y1 > pt[1]) !== (y2 > pt[1]) && pt[0] < (x2 - x1) * (pt[1] - y1) / (y2 - y1) + x1) c = !c; } return c; };   // bod v mnohoúhelníku (2D)

  function normalize(c) {
    c = c || {};
    const o = P.normalize(Object.assign({}, c, { model: 'U' }));
    const lg = LEGACY[c.model] || {};
    o.model = ['PV', 'KS', 'VR'].indexOf(c.model) >= 0 ? c.model : 'PZ';
    o.vrH = [45, 55, 65].indexOf(Number(c.vrH)) >= 0 ? Number(c.vrH) : 55;
    o.vrO = [60, 80, 100, 120].indexOf(Number(c.vrO)) >= 0 ? Number(c.vrO) : 80;
    o.ksD = [60, 80, 100].indexOf(Number(c.ksD)) >= 0 ? Number(c.ksD) : 80;
    o.ksT = [8, 10, 12].indexOf(Number(c.ksT)) >= 0 ? Number(c.ksT) : 10;
    o.ksM = KS_ROD[c.ksM] ? c.ksM : 'M16';
    o.ksG = KS_GAP.indexOf(Number(c.ksG)) >= 0 ? Number(c.ksG) : 40;
    o.ksMat = c.ksMat === 'jekl' ? 'jekl' : 'pas';
    o.ksJ = KS_JEKL.some((j) => j.id === c.ksJ) ? c.ksJ : '60x30';
    while (o.ksG < KS_ROD[o.ksM].gmin) o.ksG = KS_GAP.find((g) => g > o.ksG);
    o.pvLay = c.pvLay === 'plus' ? 'plus' : 'diag';
    o.join = 'weld';
    o.joint = JOINTS.some((m) => m.id === c.joint) ? c.joint : lg.joint || 'spojovak';
    o.top = TOPS.some((m) => m.id === c.top) ? c.top : lg.top || 'diag';
    o.mount = MOUNTS.some((m) => m.id === c.mount) ? c.mount : o.model === 'VR' ? 'lepeni' : 'vrut';
    o.barT = BAR_TS.indexOf(Number(c.barT)) >= 0 ? Number(c.barT) : 5;
    o.barW = BAR_STD.indexOf(Number(c.barW)) >= 0 ? Number(c.barW) : 0;
    o.plL = PL_L.indexOf(Number(c.plL)) >= 0 ? Number(c.plL) : 0;
    o.barL = Number(c.barL) > 0 ? Math.round(clamp(Number(c.barL), 100, 2400)) : 0;
    o.rjp = RJ.some((r) => r.id === c.rjp) ? c.rjp : 'auto';
    o.plS = c.plS === 'x' ? 'x' : 'obd';
    const jw = o.top === 'ramj' ? rjOf(o).w : 99;
    if (!mountOk(o.mount, o.top, jw)) o.mount = ['vrut', 'svorniky', 'lepeni'].find((m) => mountOk(m, o.top, jw));
    if (SIZES.indexOf(o.size) < 0) { o.size = 40; o.t = 2; }
    if (o.model === 'VR') { o.shape = 'rect'; o.td = Math.round(clamp(Number(c.td) || o.td, 8, 80)); o.L = Math.max(o.L, 600); o.W = Math.max(o.W, 350); o.H = Math.max(o.H, 350); }   // stolek: jen obdélník
    else { o.L = Math.max(o.L, 900); o.W = o.shape === 'circle' ? o.L : Math.max(o.W, 600); o.H = Math.max(o.H, 550); }
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
    let barNote = '';
    const want = cfg.top === 'pricne' ? cfg.barW : 0;
    if (cfg.joint === 'zamky') {
      const ok = BAR_ALL.filter((w) => (s + w) / 2 <= cT - 4);
      if (want && ok.indexOf(want) < 0) barNote = 'Šířka pásovin ' + want + ' mm se se zaseknutými nohami nedá použít (jde nejvýš ' + (ok.length ? ok[ok.length - 1] : '–') + ' mm) – použita automatická.';
      if (ok.length) { barMid = ok.indexOf(want) >= 0 ? want : ok[ok.length - 1]; c = (s + barMid) / 2; }
      else { c = Math.max(h + 2, cT - 4); barMid = Math.round((2 * c - s) * 10) / 10; gapNote = 'nestandardní šířka střední pásoviny'; }
    } else {
      c = Math.ceil((cT + 2.5) * 2) / 2;
      const ok = cfg.top === 'pricne' ? BAR_ALL.filter((w) => (s + w) / 2 >= c) : [];
      if (want && ok.indexOf(want) < 0) barNote = 'Šířka pásovin ' + want + ' mm se se spojovacím plechem nedá použít (jde nejméně ' + (ok.length ? ok[0] : '–') + ' mm) – použita automatická.';
      if (ok.length) { barMid = ok.indexOf(want) >= 0 ? want : ok[0]; c = (s + barMid) / 2; }
      else { barMid = Math.round((2 * c - s) * 10) / 10; gapNote = 'nestandardní šířka střední pásoviny'; }
    }
    if (cfg.top !== 'pricne') gapNote = '';
    const legs = {
      A: [[-xA, c, 0], [xA, c, Htop]], B: [[xA, -c, 0], [-xA, -c, Htop]],
      C: [[c, yC, 0], [c, -yC, Htop]], D: [[-c, -yC, 0], [-c, yC, Htop]]
    };
    return { s, h, t: cfg.t, Htop, xA, yC, c, cT, barMid, gapNote, barNote, legs };
  }
  /* Pavouk: patky i špičky v ±xF × ±yF, náboj ve středu výšky. Velikost náboje tak, aby se ramena mimo něj
     nedotkla: v úhlopříčné rovině (sklon th) ani sousední ramena v půdorysu (úhel mezi úhlopříčkami 2·phiMin). */
  function layoutPV(cfg) {
    const s = cfg.size, h = s / 2, Htop = cfg.H - cfg.td, zc = Htop / 2, k35 = Math.tan(35 * Math.PI / 180);
    let xF, yF, legs;
    if (cfg.pvLay === 'plus') {
      // kříž 90°: delší nohy podél stolu (A vpravo, B vlevo), kratší napříč (C dole, D nahoře)
      xF = clamp(Math.round(cfg.L * 0.34), 250, 760); yF = clamp(Math.round(cfg.W * 0.34), 160, 400);
      legs = { A: [[-xF, 0, 0], [xF, 0, Htop]], B: [[xF, 0, 0], [-xF, 0, Htop]], C: [[0, yF, 0], [0, -yF, Htop]], D: [[0, -yF, 0], [0, yF, Htop]] };
    } else {
      // X v rozích: patky víc do čtverce (úhel úhlopříčky 35–55°), jinak by se ramena u středu nevešla vedle sebe
      xF = clamp(Math.round(cfg.L * 0.3), 220, 700); yF = clamp(Math.round(cfg.W * 0.3), 160, 380);
      if (yF < xF * k35) yF = Math.min(Math.round(xF * k35), Math.round(cfg.W / 2 - 50));
      if (xF < yF * k35) xF = Math.min(Math.round(yF * k35), Math.round(cfg.L / 2 - 50));
      legs = { A: [[-xF, -yF, 0], [xF, yF, Htop]], B: [[xF, yF, 0], [-xF, -yF, Htop]], C: [[-xF, yF, 0], [xF, -yF, Htop]], D: [[xF, -yF, 0], [-xF, yF, Htop]] };
    }
    return { s, h, t: cfg.t, Htop, xA: xF, yC: yF, c: 0, cT: 0, barMid: null, gapNote: '', barNote: '', legs, zc, pav: true, plus: cfg.pvLay === 'plus' };
  }
  const layoutFor = (cfg) => (cfg.model === 'PV' ? layoutPV(cfg) : layout(cfg));

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
  function plotnaPlan(c2, d, fpHalf, s, mount, wp, lWant, notes, span) {
    const M = mountOf(mount), uMin = Math.ceil(fpHalf + 8 + 12), Lmin = Math.ceil((uMin + 22) / 5) * 10;
    const Lmax = span ? 2 * Math.min(-span[0], span[1]) : 1e9;   // plotna je souměrná ke špičce
    if (lWant && lWant < Lmin && notes) notes.push('Plotna ' + lWant + ' mm je na stopu jeklu krátká – použita nejkratší možná délka.');
    let Lp = lWant && lWant >= Lmin ? lWant : Lmin;
    if (Lp > Lmax) { if (notes && lWant) notes.push('Plotny ' + lWant + ' mm by přečuhovaly přes desku – zkráceny.'); Lp = Math.max(Lmin, Math.floor(Lmax / 5) * 5); }
    if (Lmin > Lmax && notes) notes.push('Plotny přečuhují přes desku – zvětšete desku nebo zmenšete podnož.');
    const uH = Lp / 2 - 22;
    const pts = [-uH, uH], holes = [];
    if (!M.none) pts.forEach((u) => holes.push(M.oval ? ['oval', u, M.oval, 24] : M.csk ? ['csk', u, M.hole] : ['hole', u, M.hole]));
    return { c: c2, d, L: Lp, w: wp, holes, spots: [], pts, mount: M.id, kind: 'plotna' };
  }
  /* plotna X: ramena délky aL a šířky wp pod ±45° ke směru nohy, kulatý otvor 22 mm od konce každého ramene.
     R = poloměr stopy jeklu, reach = kam až smí plotna od středu (deska). */
  function plotnaX(c2, d, R, mount, wp, lWant, notes, reach) {
    const M = mountOf(mount), b = wp / 2, aMin = Math.max(R + 8 + 12 + 22, b + 30), Lmin = Math.ceil(2 * aMin / 5) * 5;
    const aMax = reach * Math.SQRT2 - b;
    if (lWant && lWant < Lmin && notes) notes.push('Plotna X ' + lWant + ' mm je na stopu jeklu krátká – použita nejkratší možná délka ramene.');
    let a = (lWant && lWant >= Lmin ? lWant : Lmin) / 2;
    if (a > aMax) { if (notes && lWant) notes.push('Plotny X ' + lWant + ' mm by přečuhovaly přes desku – zkráceny.'); a = Math.max(aMin, Math.floor(aMax)); }
    if (aMin > aMax && notes) notes.push('Plotny přečuhují přes desku – zvětšete desku nebo zmenšete podnož.');
    const r45 = ([x, y]) => [(x - y) / Math.SQRT2, (x + y) / Math.SQRT2];
    const plus = [[a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b], [-a, -b], [-b, -b], [-b, -a], [b, -a], [b, -b]];
    const poly = plus.map(r45), ext = (a + b) / Math.SQRT2;
    const pts = [[a - 22, 0], [0, a - 22], [-(a - 22), 0], [0, -(a - 22)]].map(r45), holes = [];
    if (!M.none) pts.forEach(([u, v]) => holes.push([M.csk ? 'csk' : 'hole', u, M.hole, 0, v]));
    return { c: c2, d, L: 2 * ext, w: 2 * ext, holes, spots: [], pts, poly, mount: M.id, kind: 'plotna', armL: Math.round(2 * a) };
  }
  function barSolid(b, z0, z1) {
    const n = [-b.d[1], b.d[0]], P2 = (u, v) => [b.c[0] + b.d[0] * u + n[0] * v, b.c[1] + b.d[1] * u + n[1] * v];
    const outl = b.poly || [[-b.L / 2, -b.w / 2], [b.L / 2, -b.w / 2], [b.L / 2, b.w / 2], [-b.L / 2, b.w / 2]];
    let s = extrude(outl.map(([u, v]) => P2(u, v)), z0, z1);
    const J = b.tube;   // jekl naležato: dutina průchozí pokosy, otvor v horní stěně, montážní otvor ve spodní
    if (J) s = s.subtract(extrude([P2(-b.L / 2 - 10, -b.w / 2 + J.t), P2(b.L / 2 + 10, -b.w / 2 + J.t), P2(b.L / 2 + 10, b.w / 2 - J.t), P2(-b.L / 2 - 10, b.w / 2 - J.t)], z0 + J.t, z1 - J.t));
    let cut = null;
    const hole = (k, u, r, ol, za, zb, v) => { const pts = (k === 'oval' ? stadium(u, 0, ol || 40, r, 8) : circle(u, v || 0, r, 20)).map(([x, y]) => P2(x, y)); const e = extrude(pts, za, zb); cut = cut ? cut.union(e) : e; };
    b.holes.forEach(([k, u, r, ol, v]) => {
      if (!J) { hole(k, u, r, ol, z0 - 1, z1 + 1, v); return; }
      const half = k === 'oval' ? r / 2 : r;
      hole(k, u, r, ol, z1 - J.t - 1, z1 + 1);
      hole(k, u, k === 'oval' ? 2 * Math.max(half + 3, 7) : Math.max(half + 3, 7), ol, z0 - 1, z0 + J.t + 1);
    });
    return cut ? s.subtract(cut) : s;
  }
  function barPlate(b, poz, name) {   // pro DXF: obdélník L × w, otvory v souřadnicích pásoviny
    const M = mountOf(b.mount), csk = b.holes.some((x) => x[0] === 'csk');
    const what = M.studs ? ' – navařit svorníky M8' : M.none ? ' – bez otvorů (lepení)' : csk ? ' – otvory Ø' + nf1(2 * M.hole) + ' zahloubit 90° na Ø' + nf1(M.csk) + ' zespodu' : '';
    return { name: name + what, w: b.L, l: b.w, t: b.t, q: 1, holes: b.holes.filter((x) => x[0] !== 'oval').map(([, u, r, , v]) => [u + b.L / 2, (v || 0) + b.w / 2, r]),
      ovals: b.holes.filter((x) => x[0] === 'oval').map(([, u, w, ol]) => [u + b.L / 2, b.w / 2, ol || 40, w]), poz, kind: b.kind,
      poly: b.poly ? b.poly.map(([u, v]) => [u + b.L / 2, v + b.w / 2]) : undefined };
  }

  const rjOf = (cfg) => {
    if (cfg.rjp !== 'auto') return RJ.find((r) => r.id === cfg.rjp);
    return RJ.find((r) => r.id === '40x20');
  };

  /* těleso podél libovolné osy: n-úhelník o poloměru r (válec n=12, šestihran n=6) */
  function cylAlong(o, d, r, L, n) {
    const e1 = vunit(Math.abs(d[0]) < 0.9 ? vcross(d, [1, 0, 0]) : vcross(d, [0, 1, 0])), e2 = vcross(d, e1);
    const ring = (base) => { const out = []; for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n + Math.PI / n; out.push(vadd(base, vadd(vmul(e1, r * Math.cos(a)), vmul(e2, r * Math.sin(a))))); } return out; };
    const bot = ring(o), top = ring(vadd(o, vmul(d, L)));
    const polys = [new Poly(bot.slice().reverse()), new Poly(top)];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; polys.push(new Poly([bot[i], bot[j], top[j], top[i]].map((x) => x.slice()))); }
    const sol = new Solid(polys);
    if (sol.volume() < 0) sol.polys.forEach((q) => q.flip());
    return sol;
  }
  // konvexní mnohoúhelník (y, z) protažený ve směru X
  function extrudeX(pts, x0, x1) {
    const bot = pts.map((q) => [x0, q[0], q[1]]), top = pts.map((q) => [x1, q[0], q[1]]);
    const polys = [new Poly(bot.slice().reverse()), new Poly(top)];
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; polys.push(new Poly([bot[i], bot[j], top[j], top[i]].map((x) => x.slice()))); }
    const sol = new Solid(polys);
    if (sol.volume() < 0) sol.polys.forEach((q) => q.flip());
    return sol;
  }
  // posun hran konvexního mnohoúhelníku (proti směru hodinových ručiček) dovnitř o ds[i]
  function offsetPoly(P, ds) {
    const n = P.length, lines = P.map((a, i) => {
      const b = P[(i + 1) % n], e = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(e[0], e[1]), u = [e[0] / l, e[1] / l], nI = [-u[1], u[0]];
      return { p: [a[0] + nI[0] * ds[i], a[1] + nI[1] * ds[i]], u };
    });
    return lines.map((L2, i) => {
      const L1 = lines[(i - 1 + n) % n], den = L1.u[0] * L2.u[1] - L1.u[1] * L2.u[0];
      const t = ((L2.p[0] - L1.p[0]) * L2.u[1] - (L2.p[1] - L1.p[1]) * L2.u[0]) / den;
      return [L1.p[0] + L1.u[0] * t, L1.p[1] + L1.u[1] * t];
    });
  }

  /* Vnořené rámy: x podél stolu, deska (= horní obdélník) x ∈ ±L/2, druhý rám posunutý o vrO doprava */
  /* Infinity Cube: jedna uzavřená smyčka 16 úseků přes všech 12 hran kvádru (každou hranu projít právě jednou
     nejde – v rozích se potkávají 3 hrany, Eulerova věta). 4 hrany projde dvakrát – tam jsou 2 jekly vedle sebe
     (posunuté o šířku jeklu). Trasa = výsledek úplného průzkumu (nejméně posunů, bez průniků, horní rám v jedné
     rovině); stejná jako ROUTE ve freecad/stolek_kostra.py. Každá souřadnice: [roh 0/1, posun v šířkách jeklu]. */
  const VR_ROUTE = [
    [[0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [1, 0]], [[0, 0], [1, 0], [1, 0]], [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [0, 1], [0, 1]], [[1, 0], [0, 1], [0, 1]], [[1, 0], [0, 1], [1, 0]], [[1, 0], [1, 0], [1, 0]],
    [[1, 0], [1, 0], [0, 0]], [[1, 0], [0, 0], [0, 0]], [[1, 0], [0, 0], [1, 0]], [[0, 1], [0, 0], [1, 0]],
    [[0, 1], [1, 0], [1, 0]], [[1, -1], [1, 0], [1, 0]], [[1, -1], [1, 0], [0, 0]], [[0, 0], [1, 0], [0, 0]]
  ];
  function layoutVR(cfg) {
    const s = cfg.size, t = cfg.t, Ht = cfg.H - cfg.td, L = cfg.L, W = cfg.W;
    const LO = [-L / 2 + s / 2, -W / 2 + s / 2, s / 2], HI = [L / 2 - s / 2, W / 2 - s / 2, Ht - s / 2];
    const pts = VR_ROUTE.map((p) => p.map(([c, k], ax) => (c ? HI[ax] : LO[ax]) + k * s));
    const segs = pts.map((a, i) => [a, pts[(i + 1) % pts.length]]);
    return { s, t, Ht, L, W, D: s, X: L / 2 - s / 2, Y: W / 2 - s / 2, ZT: HI[2], ZB: LO[2], segs, vr: true, xA: L / 2, yC: W / 2, h: s / 2, c: 0, legs: null };
  }

  // poloprostor (p − P)·n ≥ 0 s libovolnou normálou
  function half3(P0, n) {
    const e1 = vunit(n), e2 = vunit(Math.abs(e1[2]) < 0.9 ? vcross([0, 0, 1], e1) : vcross([1, 0, 0], e1)), e3 = vcross(e1, e2);
    return prism(P0, e1, e2, e3, 0, BIG, -BIG, BIG, -BIG, BIG);
  }
  function buildVR(cfg) {
    const G = layoutVR(cfg), { s, t, Ht, L, W, segs } = G, parts = [], notes = [], bars = [], n = segs.length;
    const dir = (a, b) => vunit(vsub(b, a));
    const pieces = segs.map(([a, b], i) => {
      const u = dir(a, b), up = dir(...segs[(i - 1 + n) % n]), un = dir(...segs[(i + 1) % n]);
      const lo = [0, 1, 2].map((k) => Math.min(a[k], b[k]) - s / 2), hi = [0, 1, 2].map((k) => Math.max(a[k], b[k]) + s / 2);
      const ax = u.findIndex((v) => Math.abs(v) > 0.5), loI = lo.map((v, k) => (k === ax ? v - 1 : v + t)), hiI = hi.map((v, k) => (k === ax ? v + 1 : v - t));
      let sol = box(lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]).subtract(box(loI[0], hiI[0], loI[1], hiI[1], loI[2], hiI[2]));
      // pokosy 45°: na začátku (p − a)·(up + u) ≥ 0, na konci (p − b)·(u + un) ≤ 0
      sol = sol.intersect(half3(a, vadd(up, u))).intersect(half3(b, vmul(vadd(u, un), -1)));
      const vert = Math.abs(u[2]) > 0.5, top = !vert && Math.abs(a[2] - G.ZT) < 0.5, along = vert ? 'svislý' : Math.abs(u[0]) > 0.5 ? 'podélný' : 'příčný';
      const len = vlen(vsub(b, a));
      const name = vert ? 'Svislý jekl' : (top ? 'Horní rám – ' : Math.abs(a[2] - G.ZB) < 0.5 ? 'Rám na zemi – ' : 'Dolní rám (2. jekl) – ') + along;
      return { name, sol, F: a, T: b, vert, top, along };
    });
    // sklo na horním rámu: otvory podle uchycení v podélných horních jeklech (otvor nahoře, montážní dole)
    pieces.filter((pc) => pc.top && pc.along === 'podélný').forEach((pc, bi) => {
      const y = pc.F[1], x0 = Math.min(pc.F[0], pc.T[0]) + s, x1 = Math.max(pc.F[0], pc.T[0]) - s;
      const plan = barPlan([(x0 + x1) / 2, y], [1, 0], x1 - x0, s, [], cfg.mount);
      plan.t = t;
      bars.push({ id: 'H' + bi, name: 'Horní rám', plan });
      const nn = [-plan.d[1], plan.d[0]], P2 = (u, v) => [plan.c[0] + plan.d[0] * u + nn[0] * v, plan.c[1] + plan.d[1] * u + nn[1] * v];
      plan.holes.forEach(([k2, u, r, ol, v]) => {
        const ptsH = (rr) => (k2 === 'oval' ? stadium(u, 0, ol || 40, rr, 8) : circle(u, v || 0, rr, 20)).map(([x, yy]) => P2(x, yy));
        pc.sol = pc.sol.subtract(extrude(ptsH(r), Ht - t - 1, Ht + 1));
        const ra = k2 === 'oval' ? 2 * Math.max(r / 2 + 3, 7) : Math.max(r + 3, 7);
        if (ra * 2 < s - 2 * t) pc.sol = pc.sol.subtract(extrude(ptsH(ra), Ht - s - 1, Ht - s + t + 1));
      });
      pc.holes = !mountOf(cfg.mount).none;
    });
    const sig = [];
    pieces.forEach((pc) => {
      const u = dir(pc.F, pc.T), m = pc.vert ? { p1: pc.F[2] < pc.T[2] ? pc.F : pc.T, u: [0, 0, 1], v: [1, 0, 0], w: [0, 1, 0], L: Math.abs(pc.T[2] - pc.F[2]) } : frameOf(pc.F, pc.T);
      void u;
      const order = pc.vert ? 300 : pc.top ? 1 : 400;   // skládání odspodu: rám na zemi, svislé, horní rám
      const part = { name: pc.name, order, ins: [0, 0, -1], m, solid: toBrep(pc.sol), csg: pc.sol, ang: 45, prof: 'jekl ' + s + '×' + s + '×' + t, feat: pc.holes ? 'otvory pro desku' : '' };   // vše se spouští rovně shora
      const k = pc.name + '|' + Math.round(P.partLength(part)) + '|' + Math.round(P.volume(part.solid) / 50);
      let i = sig.indexOf(k); if (i < 0) { sig.push(k); i = sig.length - 1; }
      part.poz = 'V' + (i + 1);
      parts.push(part);
    });
    const kit = mountKit(cfg, bars), hwBodies = [];
    kit.studs.forEach(([x, y]) => hwBodies.push(toBrep(extrude(circle(x, y, 4, 12), Ht, Ht + kit.studL))));
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    parts.forEach((pt) => pt.solid.verts.forEach((q) => { mnx = Math.min(mnx, q[0]); mxx = Math.max(mxx, q[0]); mny = Math.min(mny, q[1]); mxy = Math.max(mxy, q[1]); }));
    void L; void W;
    return { cfg, parts, plates: [], plateBoxes: [], hwBodies, boltPts: [], hw: kit.hw, kit, dims: { Lf: Math.round(mxx - mnx), Wf: Math.round(mxy - mny), Hf: Ht },
      bolted: false, G, notes, bars, weldJoints: n, overhangOk: true, glassTop: true };
  }
  // prutový model pro audit: osy jeklů smyčky, podpory na zemi, zatížení v uzlech horního rámu
  function graphVR(cfg) {
    const G = layoutVR(cfg), nodes = [], els = [], sup = [];
    const nodeOf = (q) => { let k = nodes.findIndex((r) => Math.abs(r[0] - q[0]) < 0.5 && Math.abs(r[1] - q[1]) < 0.5 && Math.abs(r[2] - q[2]) < 0.5); if (k < 0) { k = nodes.length; nodes.push(q.slice()); } return k; };
    G.segs.forEach(([a, b]) => { const nd = Math.max(3, Math.round(vlen(vsub(b, a)) / 80)); for (let i = 0; i < nd; i++) els.push({ i: nodeOf(vadd(a, vmul(vsub(b, a), i / nd))), j: nodeOf(vadd(a, vmul(vsub(b, a), (i + 1) / nd))), kind: 'tube', tag: 'r' }); });
    // zdvojené hrany a rohy: jekly těsně vedle sebe jsou po délce svařené – tuhé spoje mezi blízkými uzly
    const linked = new Set(els.map((e) => Math.min(e.i, e.j) + '|' + Math.max(e.i, e.j)));
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const d = vlen(vsub(nodes[i], nodes[j]));
      if (d > 1 && d <= G.s * 1.05 && !linked.has(i + '|' + j)) els.push({ i, j, kind: 'rigid', tag: 'svar' });
    }
    G.segs.forEach(([a]) => { if (Math.abs(a[2] - G.ZB) < 0.5) sup.push(nodeOf(a)); });
    const tops = [...new Set(G.segs.filter(([a]) => Math.abs(a[2] - G.ZT) < 0.5).map(([a]) => nodeOf(a)))];
    return { cfg, nodes, els, sup: [...new Set(sup)], tops, G };
  }

  function layoutKS(cfg) {
    const J = cfg.ksMat === 'jekl' ? KS_JEKL.find((j) => j.id === cfg.ksJ) : null;
    const D = J ? J.D : cfg.ksD, tb = J ? J.w : cfg.ksT, g = cfg.ksG, Htop = cfg.H - cfg.td, zc = Htop / 2;
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L, DW = cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const a = Math.round(clamp(DW - 2 * Math.max(50, 0.07 * DW), 300, 1000) / 2);
    const xS = Math.round(Math.max(DL / 2 - Math.max(100, 0.1 * DL) - D / 2, a));
    return { D, tb, g, Htop, zc, a, xS, J, ks: true, xA: xS, yC: a, s: D, h: D / 2, t: tb, c: 0, legs: null };
  }

  function buildKS(cfg) {
    const G = layoutKS(cfg), { D, tb, g, Htop, zc, a, xS, J } = G, R = KS_ROD[cfg.ksM];
    const parts = [], plateBoxes = [], plates = [], notes = [], hwBodies = [], bars = [];
    // tvary v rovině boku (y, z), proti směru hodinových ručiček
    const Bm = [0, 0], Rr = [a, zc], T = [0, Htop], Lv = [-a, zc];
    const rh = [Bm, Rr, T, Lv];
    const dOut = offsetPoly(rh, [g / 2, g / 2, g / 2, g / 2]), dIn = offsetPoly(dOut, [tb, tb, tb, tb]);
    const tri = [
      { id: 'BR', name: 'Trojúhelník dolní', P: [Bm, [a, 0], Rr], k: 0 },
      { id: 'TR', name: 'Trojúhelník horní', P: [Rr, [a, Htop], T], k: 1 },
      { id: 'TL', name: 'Trojúhelník horní', P: [T, [-a, Htop], Lv], k: 2 },
      { id: 'BL', name: 'Trojúhelník dolní', P: [Lv, [-a, 0], Bm], k: 3 }
    ].map((tr) => { const out = offsetPoly(tr.P, [0, 0, g / 2]); return Object.assign(tr, { out, inn: offsetPoly(out, [tb, tb, tb]) }); });
    const shapes = tri.concat([{ id: 'DM', name: 'Kosočtverec', out: dOut, inn: dIn }]);
    const near = (v, w) => Math.abs(v - w) < 0.01;
    shapes.forEach((sh) => { sh.holes = sh.out.map(() => []); sh.top = sh.out.findIndex((q, i) => near(q[1], Htop) && near(sh.out[(i + 1) % sh.out.length][1], Htop)); });   // otvory po hranách: [u od začátku hrany, poloměr, ovál?]
    // závitové tyče: přes každou mezeru 2 kusy (30 % a 70 % hrany kosočtverce)
    const rods = [];
    tri.forEach((tr) => {
      const k = tr.k, A0 = dOut[k], A1 = dOut[(k + 1) % 4], e = [A1[0] - A0[0], A1[1] - A0[1]], le = Math.hypot(e[0], e[1]), u = [e[0] / le, e[1] / le], n = [u[1], -u[0]];
      const H0 = tr.out[2], H1 = tr.out[0], eh = [H1[0] - H0[0], H1[1] - H0[1]], lh = Math.hypot(eh[0], eh[1]), uh = [eh[0] / lh, eh[1] / lh];
      [0.3, 0.7].forEach((f) => {
        const p = [A0[0] + e[0] * f, A0[1] + e[1] * f], q = [p[0] + n[0] * g, p[1] + n[1] * g];
        rods.push({ p, n });
        shapes[4].holes[k].push([f * le, R.hole / 2]);
        tr.holes[2].push([(q[0] - H0[0]) * uh[0] + (q[1] - H0[1]) * uh[1], R.hole / 2]);
      });
    });
    const Lr = Math.ceil((g + 2 * tb + 2 * (R.h + 8)) / 10) * 10;
    // horní pásy horních trojúhelníků nesou desku: otvory podle uchycení (pásovina v rovině desky)
    const frames = [-xS, xS];
    frames.forEach((xc, fi) => tri.filter((tr) => tr.id[0] === 'T').forEach((tr) => {
      const s0 = tr.out[tr.top], s1 = tr.out[(tr.top + 1) % 3], y0 = s0[0], y1 = s1[0], dy = Math.sign(y1 - y0), Ls = Math.abs(y1 - y0);
      const plan = barPlan([xc, (y0 + y1) / 2], [0, dy], Ls, D, [], cfg.mount);
      plan.t = tb;
      bars.push({ id: 'H' + fi + tr.id, name: 'Horní pás', plan, tr: tr.id, xc });
    }));
    // názvy hran tvarů
    shapes.forEach((sh) => {
      sh.edgeName = sh.out.map((A0, i) => {
        const B1 = sh.out[(i + 1) % sh.out.length], top = i === sh.top, what = J ? 'jekl' : 'pás';
        return sh.id === 'DM' ? 'Kosočtverec – ' + what : (near(A0[0], B1[0]) && !near(A0[1], B1[1]) ? 'Trojúhelník' : sh.name) + ' – ' +
          (top ? 'horní ' + what + ' (pod deskou)' : near(A0[1], 0) && near(B1[1], 0) ? what + ' na zemi' : near(A0[0], B1[0]) ? 'svislý ' + what : 'šikmý ' + what);
      });
    });
    // tělesa
    frames.forEach((xc, fi) => {
      const x0 = xc - D / 2, x1 = xc + D / 2;
      const rodCuts = rods.map((r) => cylAlong([xc, r.p[0] - r.n[0] * (tb + 2), r.p[1] - r.n[1] * (tb + 2)], [0, r.n[0], r.n[1]], R.hole / 2, g + 2 * tb + 4, 16));
      shapes.forEach((sh) => {
        let sol = extrudeX(sh.out, x0, x1).subtract(extrudeX(sh.inn, x0 - 1, x1 + 1));
        if (J) {   // dutina jeklu – průchozí přes pokosy v rozích
          const n = sh.out.length, cav = extrudeX(offsetPoly(sh.out, Array(n).fill(J.t)), x0 + J.t, x1 - J.t).subtract(extrudeX(offsetPoly(sh.inn, Array(n).fill(-J.t)), x0, x1));
          sol = sol.subtract(cav);
        }
        rodCuts.forEach((c) => { sol = sol.subtract(c); });
        bars.filter((b) => b.xc === xc && b.tr === sh.id).forEach((b) => {
          const pl = b.plan, nn = [-pl.d[1], pl.d[0]], P2 = (u, v) => [pl.c[0] + pl.d[0] * u + nn[0] * v, pl.c[1] + pl.d[1] * u + nn[1] * v];
          pl.holes.forEach(([k2, u, r, ol, v]) => {
            const pts = (rr) => (k2 === 'oval' ? stadium(u, 0, ol || 40, rr, 8) : circle(u, v || 0, rr, 20)).map(([x, y]) => P2(x, y));
            if (!J) { sol = sol.subtract(extrude(pts(r), Htop - tb - 1, Htop + 1)); return; }
            // jekl: otvor v horní stěně, montážní (pro hlavu a šroubovák) ve spodní
            sol = sol.subtract(extrude(pts(r), Htop - J.t - 1, Htop + 1));
            const ra = k2 === 'oval' ? 2 * Math.max(r / 2 + 3, 7) : Math.max(r + 3, 7);
            sol = sol.subtract(extrude(pts(ra), Htop - tb - 1, Htop - tb + J.t + 1));
          });
        });
        if (J) {   // každá hrana zvlášť jako díl z jeklu (pokosy v rozích), do kusovníku K2 / STEP
          sh.out.forEach((A0, i) => {
            const i1 = (i + 1) % sh.out.length, A1 = sh.out[i1], I0 = sh.inn[i], I1 = sh.inn[i1];
            const piece = sol.intersect(extrudeX([A0, A1, I1, I0], x0 - 1, x1 + 1));
            const mid0 = [(A0[0] + I0[0]) / 2, (A0[1] + I0[1]) / 2], mid1 = [(A1[0] + I1[0]) / 2, (A1[1] + I1[1]) / 2];
            const F = [xc, mid0[0], mid0[1]], T2 = [xc, mid1[0], mid1[1]], u = vunit(vsub(T2, F));
            const m = Math.abs(u[2]) > 0.99 ? { p1: F, u, v: [1, 0, 0], w: vcross(u, [1, 0, 0]), L: vlen(vsub(T2, F)) } : frameOf(F, T2);
            const angAt = (P0, P1, P2) => { const a1 = vunit([0, P0[0] - P1[0], P0[1] - P1[1]]), a2 = vunit([0, P2[0] - P1[0], P2[1] - P1[1]]); return Math.round((90 - Math.acos(Math.max(-1, Math.min(1, vdot(a1, a2)))) * 90 / Math.PI) * 10) / 10; };
            const nN = sh.out.length, ang = angAt(sh.out[(i - 1 + nN) % nN], A0, A1) + ' / ' + angAt(A0, A1, sh.out[(i + 2) % nN]);
            parts.push({ poz: sh.id + i, name: sh.edgeName[i], m, solid: toBrep(piece), csg: piece, cutTxt: ang, ins: [-Math.sign(xc), 0, 0], prof: 'jekl ' + J.D + '×' + J.w + '×' + J.t, feat: sh.holes[i].length || i === sh.top ? 'otvory' : '' });
          });
          return;
        }
        const br = toBrep(sol);
        br.paint = 'fin'; br.ins = [-Math.sign(xc), 0, 0]; br.label = (sh.id === 'DM' ? 'Kosočtverec' : sh.name + (sh.id[1] === 'R' ? ' pravý' : ' levý')) + ' – bok ' + (fi ? 'B' : 'A');
        plateBoxes.push(br);
      });
      // tyče a matice (nakupované díly – jen do náhledu a sestavy)
      rods.forEach((r) => {
        const n3 = [0, r.n[0], r.n[1]], o = [xc, r.p[0], r.p[1]], at = (d) => vadd(o, vmul(n3, d));
        hwBodies.push(toBrep(cylAlong(at(-(tb + R.h + 8)), n3, R.d / 2, Lr, 12)));
        [-(tb + R.h), 0, g - R.h, g + tb].forEach((d0) => hwBodies.push(toBrep(cylAlong(at(d0), n3, R.sw / Math.sqrt(3), R.h, 6))));
      });
    });
    // pásy (kusovník, DXF): délka po vnější hraně, otvory na ose pásu
    if (!J) shapes.forEach((sh) => sh.out.forEach((A0, i) => {
      const A1 = sh.out[(i + 1) % sh.out.length], L = Math.round(Math.hypot(A1[0] - A0[0], A1[1] - A0[1]) * 10) / 10;
      const holes = sh.holes[i].map(([u, r]) => [u, D / 2, r]);
      let ovals;
      const top = i === sh.top, B1 = sh.out[(i + 1) % sh.out.length];
      if (top) {   // horní pás – otvory pro uchycení desky (u od začátku hrany = od rohu boku)
        const pl = bars.find((b) => b.tr === sh.id).plan;
        pl.holes.filter((x) => x[0] !== 'oval').forEach(([, u, r, , v]) => holes.push([u + pl.L / 2, D / 2 + (v || 0), r]));
        ovals = pl.holes.filter((x) => x[0] === 'oval').map(([, u, w, ol]) => [u + pl.L / 2, D / 2, ol || 40, w]);
      }
      const nm = sh.edgeName[i] + ' (na hranu)';
      plates.push({ name: nm, w: L, l: D, t: tb, q: 2, holes, ovals, kind: undefined });
    }));
    if (J) {
      const sig = [];
      parts.forEach((pt) => {
        const k = pt.name + '|' + Math.round(P.partLength(pt)) + '|' + Math.round(P.volume(pt.solid) / 50);
        let i = sig.indexOf(k); if (i < 0) { sig.push(k); i = sig.length - 1; }
        pt.poz = 'J' + (i + 1);
      });
      parts.sort((p1, p2) => Number(p1.poz.slice(1)) - Number(p2.poz.slice(1)));
    }
    const kit = mountKit(cfg, bars);
    kit.studs.forEach(([x, y]) => { const st = toBrep(extrude(circle(x, y, 4, 12), Htop, Htop + kit.studL)); hwBodies.push(st); });
    const nr = rods.length * 2;
    const hw = kit.hw.concat([
      { name: 'Závitová tyč ' + cfg.ksM + ' × ' + Lr + ' mm', q: nr },
      { name: 'Matice ' + cfg.ksM + ' DIN 934', q: nr * 4 },
      { name: 'Podložka ' + cfg.ksM + ' DIN 125', q: nr * 4 }
    ]);
    const extraCost = nr * (Lr * 0.06 + 4 * 3 + 4 * 1);
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    parts.map((pt) => pt.solid).concat(plateBoxes).forEach((b) => b.verts.forEach((q) => { mnx = Math.min(mnx, q[0]); mxx = Math.max(mxx, q[0]); mny = Math.min(mny, q[1]); mxy = Math.max(mxy, q[1]); }));
    const Lf = Math.round(2 * Math.max(-mnx, mxx)), Wf = Math.round(2 * Math.max(-mny, mxy));
    return { cfg, parts, plates, plateBoxes, hwBodies, boltPts: [], hw, kit, extraCost, dims: { Lf, Wf, Hf: Htop }, bolted: false, G, notes, bars, weldJoints: 2 * (4 * 3 + 4) };
  }

  /* zjednodušený audit Kosočtverce: tyče v ohybu přes mezeru (přenášejí veškeré zatížení mezi tvary),
     vyklonění boku z roviny a převržení */
  function auditKS(cfg, B) {
    const G = B.G, R = KS_ROD[cfg.ksM], dc = 0.84 * R.d, Wr = Math.PI * dc * dc * dc / 32, arm = G.g / 2 + 4;
    const Vrod = SIG_ALLOW * Wr / arm;                       // N na tyč
    const capN = 2 * 4 * Vrod;                               // 2 boky × (2 horní mezery × 2 tyče)
    const sP = 500 * arm / Wr;                               // bodová síla 1000 N na jeden horní trojúhelník = 2 tyče
    const I = (G.J ? 2 * (Math.pow(G.D, 3) * G.tb - Math.pow(G.D - 2 * G.J.t, 3) * (G.tb - 2 * G.J.t)) / 12 : 2 * G.tb * Math.pow(G.D, 3) / 12) * 0.5, sway = 200 * Math.pow(G.Htop, 3) / (3 * 210000 * I);
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L, DW = cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const hull = P.convexHull([[-G.xS - G.D / 2, -G.a], [G.xS + G.D / 2, -G.a], [G.xS + G.D / 2, G.a], [-G.xS - G.D / 2, G.a]]);
    const Vf = cfg.L >= 1600 ? 400 : cfg.L < 800 ? 200 : 300, kgSteel = massOf(B), deskKg = 15 * DL * DW / 1e6, Wt = (kgSteel + deskKg) * 9.81;
    const probe = P.deskOutline(cfg.shape, DL, DW).map((q) => { const r2 = Math.hypot(q[0], q[1]); return [q[0] * (1 - 50 / r2), q[1] * (1 - 50 / r2)]; });
    let stab = Infinity;
    for (let k = 0; k < hull.length; k++) {
      const a = hull[k], b = hull[(k + 1) % hull.length], ex = [b[0] - a[0], b[1] - a[1]], le = Math.hypot(ex[0], ex[1]), nO = [ex[1] / le, -ex[0] / le];
      const dist = (q) => (q[0] - a[0]) * nO[0] + (q[1] - a[1]) * nO[1], cgArm = -dist([0, 0]);
      probe.forEach((q) => { const d = dist(q); if (d > 0) stab = Math.min(stab, (Wt * cgArm) / (Vf * d)); });
    }
    const lv = (x, ok, warn, lower) => lower ? (x >= ok ? 'ok' : x >= warn ? 'warn' : 'bad') : (x <= ok ? 'ok' : x <= warn ? 'warn' : 'bad');
    const checks = [
      { id: 'pt', lab: 'Bodová síla 1000 N na horní trojúhelník (tyče v ohybu)', val: sP, unit: 'MPa', lvl: lv(sP, SIG_ALLOW, 235), hint: 'tyč ' + cfg.ksM + ' přes mezeru ' + G.g + ' mm' },
      { id: 'weld', lab: 'Svary v rozích tvarů', val: 1000 / (0.7 * (G.J ? G.J.t : G.tb) * G.D), unit: 'MPa', lvl: 'ok', hint: 'koutový svar a = 0,7 t po hloubce pásu' },
      { id: 'cap', lab: 'Nosnost rovnoměrně', val: Math.min(999, Math.floor(capN / 9.81 / 1.5 / 10) * 10), unit: 'kg', lvl: lv(capN / 9.81 / 1.5, 150, 80, true), hint: 'ohyb tyčí přes mezeru, rezerva 1,5' },
      { id: 'sway', lab: 'Vyklonění boku z roviny při 400 N', val: sway, unit: 'mm', lvl: lv(sway, 5, 10), hint: 'bok jako konzola od desky' },
      { id: 'stab', lab: 'Stabilita proti převržení', val: stab === Infinity ? 99 : Math.min(99, stab), unit: '× rezerva', lvl: lv(stab, 1.5, 1.0, true), hint: Vf + ' N 50 mm od hrany desky' }
    ];
    const fab = B.notes.map((t) => ({ lvl: 'warn', t }));
    const lvls = checks.map((c) => c.lvl).concat(fab.map((f) => f.lvl));
    return { cfg, checks, fab, overall: lvls.indexOf('bad') >= 0 ? 'bad' : lvls.indexOf('warn') >= 0 ? 'warn' : 'ok', singular: false, capKg: capN / 9.81 / 1.5, sway, dz1: 0, stab, graph: null };
  }

  const cache = new Map();
  function build(cfgIn) {
    const cfg = normalize(cfgIn);
    const key = [cfg.model, cfg.vrH, cfg.vrO, cfg.pvLay, cfg.ksD, cfg.ksT, cfg.ksM, cfg.ksG, cfg.ksMat, cfg.ksJ, cfg.joint, cfg.top, cfg.L, cfg.W, cfg.H, cfg.td, cfg.size, cfg.t, cfg.mount, cfg.barT, cfg.barW, cfg.barL, cfg.plL, cfg.plS, cfg.rjp, cfg.shape, cfg.dmode, cfg.dL, cfg.dW].join('|');
    if (cache.has(key)) return Object.assign({}, cache.get(key), { cfg });
    if (cfg.model === 'VR') { const outVR = buildVR(cfg); if (cache.size > 40) cache.clear(); cache.set(key, outVR); return outVR; }
    if (cfg.model === 'KS') { const outKS = buildKS(cfg); if (cache.size > 40) cache.clear(); cache.set(key, outKS); return outKS; }
    const RJp = cfg.top === 'ramj' ? rjOf(cfg) : null, BAR_T = cfg.barT;
    const G = layoutFor(cfg), { s, h, t, Htop, c, legs } = G, Hc = Htop - (RJp ? RJp.h : BAR_T), pav = !!G.pav;
    const parts = [], plateBoxes = [], plates = [], notes = [];
    const zamky = !pav && cfg.joint === 'zamky', pricne = !pav && cfg.top === 'pricne';
    if (G.barNote) notes.push(G.barNote);
    // šířka pásoviny: zvolená (20–50 mm), automaticky nejužší, která zakryje stopu jeklu (nejvýš 50 mm)
    const pickW = (need, what) => {
      const w = cfg.barW || BAR_STD.find((x) => x >= need) || BAR_STD[BAR_STD.length - 1];
      if (need - w > 10) notes.push((what || 'Pásovina') + ' ' + w + ' mm je užší než špička nohy – noha bude zboku přesahovat o ' + Math.round((need - w) / 2) + ' mm.');
      return w;
    };
    // deska v půdorysu, zmenšená o okraj – pásoviny ani plotny přes ni nesmí přečuhovat
    const DL = cfg.dmode === 'own' ? cfg.dL : cfg.L, DW = cfg.dmode === 'own' ? cfg.dW : cfg.W;
    const desk = P.deskOutline(cfg.shape, DL - 2 * DESK_EDGE, DW - 2 * DESK_EDGE);
    const inDesk = (q) => inside(q, desk);
    // kam až smí pásovina ve směru d od bodu cc (obě hrany pásoviny musí zůstat na desce)
    const deskSpan = (cc, d, w) => {
      const n = [-d[1], d[0]], okAt = (u) => [-1, 1].every((sg) => inDesk([cc[0] + d[0] * u + n[0] * sg * w / 2, cc[1] + d[1] * u + n[1] * sg * w / 2]));
      const reach = (sg) => { let u = 0; if (!okAt(0)) return 0; while (u < 3000 && okAt(sg * (u + 2))) u += 2; return sg * u; };
      return [reach(-1), reach(1)];
    };
    // délka pásoviny: [lo, hi] musí zakrýt (špičky), [aLo, aHi] = automaticky; vrací nový střed a délku
    const fitBar = (cc, d, w, lo, hi, aLo, aHi) => {
      let a = aLo, b = aHi;
      if (cfg.barL) { const m = (lo + hi) / 2; a = m - cfg.barL / 2; b = m + cfg.barL / 2; }
      const [dLo, dHi] = deskSpan(cc, d, w);
      let cut = false;
      if (a < dLo) { a = dLo; cut = true; }
      if (b > dHi) { b = dHi; cut = true; }
      if (a > lo) a = lo;
      if (b < hi) b = hi;
      if (cfg.barL && cut) notes.push('Pásoviny ' + cfg.barL + ' mm by přečuhovaly přes desku – zkráceny tak, aby zůstalo ' + DESK_EDGE + ' mm od hrany.');
      if (cfg.barL && !cut && b - a > cfg.barL + 1) notes.push('Pásoviny ' + cfg.barL + ' mm nezakryjí špičky noh – prodlouženy.');
      if (lo < dLo - 0.5 || hi > dHi + 0.5) notes.push('Pásovina musí kvůli nohám přečuhovat přes desku – zvětšete desku nebo zmenšete podnož.');
      a = Math.floor(a); b = Math.ceil(b);
      return { c: [cc[0] + d[0] * (a + b) / 2, cc[1] + d[1] * (a + b) / 2], L: b - a };
    };
    const raw = {}, lower = {};
    if (pav) {
      // Na každé straně se rameno nahoru a rameno dolů potkají jako „>“: pokos ve vodorovné rovině středu.
      // Sousední strany se dělí svislými rovinami půlícími úhel mezi nimi (rovné řezy, ramena na sebe dosednou).
      const sides = ['A', 'B', 'C', 'D'].map((k) => { const q = legs[k][1], r = Math.hypot(q[0], q[1]); return [q[0] / r, q[1] / r]; });
      const half = (n) => prism([0, 0, 0], [n[0], n[1], 0], [0, 0, 1], [n[1], -n[0], 0], 0, BIG, -BIG, BIG, -BIG, BIG);   // n·p ≥ 0
      const wedge = (u) => {
        // dvě sousední strany = nejmenší úhel na každou stranu od u
        const ang = (v) => Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
        const others = sides.filter((v) => Math.abs(ang(v)) > 1e-6);
        const left = others.filter((v) => ang(v) > 0).sort((a, b) => ang(a) - ang(b))[0], right = others.filter((v) => ang(v) < 0).sort((a, b) => ang(b) - ang(a))[0];
        let w = null;
        [left, right].forEach((v) => { const n = [u[0] - v[0], u[1] - v[1]], l = Math.hypot(n[0], n[1]); const hs = half([n[0] / l, n[1] / l]); w = w ? w.intersect(hs) : hs; });
        return w;
      };
      ['A', 'B', 'C', 'D'].forEach((k) => {
        const full = tubeRaw(legs[k][0], legs[k][1], s, t, Hc), q = legs[k][1], r = Math.hypot(q[0], q[1]), u = [q[0] / r, q[1] / r];
        lower[k] = full.sol.intersect(slab(-1, G.zc)).intersect(wedge([-u[0], -u[1]]));
        raw[k] = { m: full.m, sol: full.sol.intersect(slab(G.zc, Hc + 1)).intersect(wedge(u)) };
      });
    } else ['A', 'B', 'C', 'D'].forEach((k) => { raw[k] = tubeRaw(legs[k][0], legs[k][1], s, t, pricne ? Htop : Hc); });
    /* spojení noh */
    if (pav) {
      // ramena se svaří k sobě – uprostřed nic dalšího není
    } else if (zamky) {
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
    if (pav && cfg.top === 'pricne') {
      const grp = G.plus ? [['P1', ['B']], ['P2', ['C', 'D']], ['P3', ['A']]] : [['P1', ['B', 'D']], ['P2', ['A', 'C']]];
      grp.forEach(([id, ks]) => {
        const fp = [].concat(...ks.map((k) => topFoot(legs[k][0], legs[k][1], h, Hc)));
        const xs = fp.map((q) => q[0]), ys = fp.map((q) => q[1]), x0 = (Math.min(...xs) + Math.max(...xs)) / 2;
        const wb = pickW(Math.max(...xs) - Math.min(...xs) - 6), cover = Math.max(...ys.map(Math.abs)) + 10, auto = Math.max(cover, (DW - 100) / 2);
        const F = fitBar([x0, 0], [0, 1], wb, -cover, cover, -auto, auto);
        const forb = ks.map((k) => { const q = topFoot(legs[k][0], legs[k][1], h, Hc).map((p) => p[1] - F.c[1]); return [Math.min(...q) - 8, Math.max(...q) + 8]; });
        bars.push({ id, name: ks.length === 1 ? 'Pásovina příčná krajní (na špičce dlouhé nohy)' : 'Pásovina příčná ' + ks.join('–') + ' (přes špičky)', plan: barPlan(F.c, [0, 1], F.L, wb, forb, cfg.mount) });
      });
    } else if (pricne) {
      // zápich pro krajní pásovinu ve špičce A a B
      const wEnd = G.barMid;
      ['A', 'B'].forEach((k) => { const x = legs[k][1][0], w = wEnd / 2 + 0.2; raw[k].sol = raw[k].sol.subtract(box(x - w, x + w, -BIG, BIG, Hc, Htop + 10)); });
      const auto = Math.max(Math.round((DW - 100) / 10) * 10, 2 * G.yC + 2 * s + 40) / 2;
      const fpY = (k) => topFoot(legs[k][0], legs[k][1], h, Hc).map((p) => p[1]);
      const one = (id, name, x, cover, forbK) => {
        const F = fitBar([x, 0], [0, 1], wEnd, -cover, cover, -auto, auto);
        const forb = forbK ? [[Math.min(...fpY(forbK)) - 8 - F.c[1], Math.max(...fpY(forbK)) + 8 - F.c[1]]] : [];
        return { id, name, plan: barPlan(F.c, [0, 1], F.L, wEnd, forb, cfg.mount) };
      };
      const endCover = (k) => Math.max(...fpY(k).map(Math.abs)) + 30;
      bars = [
        one('P1', 'Pásovina krajní (na špičce B)', -G.xA, endCover('B'), 'B'),
        one('P3', 'Pásovina krajní (na špičce A)', G.xA, endCover('A'), 'A'),
        one('P2', 'Pásovina střední (mezi C a D)', 0, G.yC + h + 10, null)
      ];
      if (G.gapNote) notes.push('Pozor: ' + G.gapNote + ' (' + G.barMid + ' mm).');
      else if (G.barMid > BAR_STD[BAR_STD.length - 1] && !G.barNote) notes.push('Se spojovacím plechem musí střední pásovina vyplnit mezeru mezi nohama C a D – šířka příčných pásovin je proto ' + G.barMid + ' mm.');
    } else if (cfg.top === 'diag' || cfg.top === 'kriz') {
      // pásovina mezi dvěma špičkami: šířka tak, aby zakryla obě stopy jeklů
      const tipBar = (k1, k2) => {
        const p1 = legs[k1][1], p2 = legs[k2][1], d0 = vunit([p2[0] - p1[0], p2[1] - p1[1], 0]), d = [d0[0], d0[1]], n = [-d[1], d[0]];
        const fp = topFoot(legs[k1][0], legs[k1][1], h, Hc).concat(topFoot(legs[k2][0], legs[k2][1], h, Hc));
        const us = fp.map((p) => (p[0] - p1[0]) * d[0] + (p[1] - p1[1]) * d[1]), vs = fp.map((p) => (p[0] - p1[0]) * n[0] + (p[1] - p1[1]) * n[1]);
        const u0 = Math.min(...us) - 10, u1 = Math.max(...us) + 10, v0 = Math.min(...vs), v1 = Math.max(...vs);
        const need = v1 - v0 - 6, wb = pickW(need);
        const c0 = [p1[0] + d[0] * (u0 + u1) / 2 + n[0] * (v0 + v1) / 2, p1[1] + d[1] * (u0 + u1) / 2 + n[1] * (v0 + v1) / 2], half = (u1 - u0) / 2;
        const F = fitBar(c0, d, wb, -half, half, -half, half), cc = F.c;
        const forbOf = (k, cq) => { const q = topFoot(legs[k][0], legs[k][1], h, Hc).map((p) => (p[0] - cq[0]) * d[0] + (p[1] - cq[1]) * d[1]); return [Math.min(...q) - 8, Math.max(...q) + 8]; };
        return { cc, d, n, L: F.L, wb, forbOf };
      };
      if (cfg.top === 'diag') {
        [['P1', 'D', 'A'], ['P2', 'C', 'B']].forEach(([id, k1, k2]) => {
          const T = tipBar(k1, k2);
          bars.push({ id, name: 'Pásovina ' + k1 + '–' + k2 + ' (na špičkách)', plan: barPlan(T.cc, T.d, T.L, T.wb, [T.forbOf(k1, T.cc), T.forbOf(k2, T.cc)], cfg.mount) });
        });
      } else {
        // kříž: B–A celá, D–C ze dvou půlek, konce zaříznuté rovnoběžně s hranou B–A (mezera 1 mm na svar)
        const T1 = tipBar('B', 'A'), T2 = tipBar('D', 'C');
        bars.push({ id: 'P1', name: 'Pásovina kříže B–A (celá)', plan: barPlan(T1.cc, T1.d, T1.L, T1.wb, [T1.forbOf('B', T1.cc), T1.forbOf('A', T1.cc), [-T2.wb / 2 - 8, T2.wb / 2 + 8]], cfg.mount) });
        const a = T1.n[0] * (T2.cc[0] - T1.cc[0]) + T1.n[1] * (T2.cc[1] - T1.cc[1]), b = T1.n[0] * T2.d[0] + T1.n[1] * T2.d[1], e = T1.n[0] * T2.n[0] + T1.n[1] * T2.n[1];
        const lim = T1.wb / 2 + 1, uAt = (sg, v) => (sg * lim - a - e * v) / b;   // u na D–C, kde je hrana B–A
        const ends = [-T2.L / 2, T2.L / 2], w2 = T2.wb / 2;
        [[ends[0], Math.sign(b) < 0 ? 1 : -1, 'D'], [ends[1], Math.sign(b) < 0 ? -1 : 1, 'C']].forEach(([uEnd, sg, k]) => {
          const ua = uAt(sg, -w2), ub = uAt(sg, w2);   // řezná hrana u stykové strany
          const lo = Math.min(uEnd, ua, ub), hi = Math.max(uEnd, ua, ub), mid = (lo + hi) / 2;
          const cH = [T2.cc[0] + T2.d[0] * mid, T2.cc[1] + T2.d[1] * mid];
          const poly = uEnd < 0 ? [[uEnd - mid, -w2], [ua - mid, -w2], [ub - mid, w2], [uEnd - mid, w2]] : [[ua - mid, -w2], [uEnd - mid, -w2], [uEnd - mid, w2], [ub - mid, w2]];
          const plan = barPlan(cH, T2.d, hi - lo, T2.wb, [T2.forbOf(k, cH)], cfg.mount);
          plan.poly = poly;
          bars.push({ id: 'P' + k, name: 'Půlka kříže ' + k + ' (dosedá na B–A)', plan });
        });
      }
    } else if (cfg.top === 'ram' || cfg.top === 'ramj') {
      // obvodový rámeček: osy stran jdou přes středy stop špiček (A vpravo, B vlevo, C dole, D nahoře), pokosy 45°
      const fpC = (k) => { const f = topFoot(legs[k][0], legs[k][1], h, Hc); return [f.reduce((q, p) => q + p[0], 0) / 4, f.reduce((q, p) => q + p[1], 0) / 4, f]; };
      const X = (fpC('A')[0] - fpC('B')[0]) / 2, Y = (fpC('D')[1] - fpC('C')[1]) / 2;
      const across = (k, ax) => { const f = fpC(k)[2].map((p) => p[ax]); return Math.max(...f) - Math.min(...f); };
      const needR = Math.max(across('A', 0), across('C', 1)) - 6;
      const wr = RJp ? RJp.w : pickW(needR), w2 = wr / 2;
      if (RJp && needR - RJp.w > 10) notes.push('Jekl ' + RJp.w + ' mm je užší než špička nohy (' + Math.ceil(needR + 6) + ' mm) – špička bude pod rámečkem zboku vyčnívat o ' + Math.round((needR + 6 - RJp.w) / 2) + ' mm.');
      [['D', [0, Y], [1, 0], X], ['C', [0, -Y], [-1, 0], X], ['A', [X, 0], [0, -1], Y], ['B', [-X, 0], [0, 1], Y]].forEach(([k, cc, d, half]) => {
        const Lo = 2 * half + wr, Li = 2 * half - wr;
        const nn = [-d[1], d[0]], forb = [];
        ['A', 'B', 'C', 'D'].forEach((q) => {
          const pts = fpC(q)[2], us = pts.map((p) => (p[0] - cc[0]) * d[0] + (p[1] - cc[1]) * d[1]), vs = pts.map((p) => (p[0] - cc[0]) * nn[0] + (p[1] - cc[1]) * nn[1]);
          if (Math.min(...vs) < w2 && Math.max(...vs) > -w2 && Math.min(...us) < Lo / 2 && Math.max(...us) > -Lo / 2) forb.push([Math.min(...us) - 8, Math.max(...us) + 8]);
        });
        const plan = barPlan(cc, d, Li, wr, forb, cfg.mount);
        plan.L = Lo; plan.poly = [[-Li / 2, -w2], [Li / 2, -w2], [Lo / 2, w2], [-Lo / 2, w2]];
        if (RJp) plan.tube = RJp;
        bars.push({ id: 'R' + k, name: (RJp ? 'Rám z jeklu' : 'Rámeček') + ' – strana ' + (d[0] ? 'dlouhá' : 'krátká') + ' (pokosy 45°)', plan, long: !!d[0] });
      });
    } else {
      // plotna na každé špičce, podél vodorovného směru nohy
      ['A', 'B', 'C', 'D'].forEach((k) => {
        const fp = topFoot(legs[k][0], legs[k][1], h, Hc), m = raw[k].m, d = [m.u[0], m.u[1]], dl = Math.hypot(d[0], d[1]);
        d[0] /= dl; d[1] /= dl;
        const cc = [fp.reduce((a, p) => a + p[0], 0) / 4, fp.reduce((a, p) => a + p[1], 0) / 4];
        const us = fp.map((p) => (p[0] - cc[0]) * d[0] + (p[1] - cc[1]) * d[1]);
        const wp = pickW(cfg.plS === 'x' ? 40 : s + 10, 'Plotna');
        if (cfg.plS === 'x') {
          const R = Math.max(...fp.map((p) => Math.hypot(p[0] - cc[0], p[1] - cc[1]))), n = [-d[1], d[0]];
          const reach = Math.min(...[d, n].map((dd) => { const sp = deskSpan(cc, dd, 1); return Math.min(-sp[0], sp[1]); }));
          bars.push({ id: 'P' + k, name: 'Plotna X na špičce noh', plan: plotnaX(cc, d, R, cfg.mount, wp, cfg.plL, notes, reach) });
        } else bars.push({ id: 'P' + k, name: 'Plotna na špičce noh', plan: plotnaPlan(cc, d, Math.max(...us.map(Math.abs)), s, cfg.mount, wp, cfg.plL, notes, deskSpan(cc, d, wp)) });
      });
    }
    bars.forEach((b) => { b.plan.t = BAR_T; });
    if (pricne) bars.forEach((b) => { b.plan.w = G.barMid; });
    bars.filter((b) => !b.plan.tube).forEach((b) => { plateBoxes.push(toBrep(barSolid(b.plan, Hc, Htop))); plates.push(barPlate(b.plan, null, b.name)); });
    // rámeček z jeklu = trubkové díly (kusovník K2, STEP)
    bars.filter((b) => b.plan.tube).forEach((b) => {
      const pl = b.plan, sol = barSolid(pl, Hc, Htop), zc = (Hc + Htop) / 2;
      const F = [pl.c[0] - pl.d[0] * pl.L / 2, pl.c[1] - pl.d[1] * pl.L / 2, zc], T2 = [pl.c[0] + pl.d[0] * pl.L / 2, pl.c[1] + pl.d[1] * pl.L / 2, zc];
      const J = pl.tube, feat = pl.holes.length ? 'otvory nahoře, montážní dole' : '';
      parts.push({ poz: b.long ? 'RL' : 'RK', name: b.name, m: frameOf(F, T2), solid: toBrep(sol), csg: sol, ang: 45, prof: 'jekl ' + J.w + '×' + J.h + '×' + J.t, feat });
    });
    for (let i = notes.length - 1; i >= 0; i--) if (notes.indexOf(notes[i]) < i) notes.splice(i, 1);
    // díly: A≅B, C≅D (otočení o 180°)
    const names = { A: 'Noha dlouhá A/B', C: zamky ? 'Noha C/D (výřezy)' : 'Noha C/D' };
    if (pav) ['A', 'B', 'C', 'D'].forEach((k, i) => {
      const lg = G.plus ? (k === 'A' || k === 'B' ? ' – dlouhé' : ' – krátké') : '';
      const fp = { prof: 'jekl ' + s + '×' + s + '×' + t, feat: 'u středu pokos na rameno pod/nad + rovné řezy na sousední ramena' };
      parts.splice(i, 0, Object.assign({ poz: G.plus ? (k === 'A' || k === 'B' ? 'SL' : 'SK') : 'S', name: 'Rameno dolní (patka)' + lg, m: raw[k].m, solid: toBrep(lower[k]), csg: lower[k] }, fp));
      parts.splice(4 + i, 0, Object.assign({ poz: G.plus ? (k === 'A' || k === 'B' ? 'HL' : 'HK') : 'H', name: 'Rameno horní (k desce)' + lg, m: raw[k].m, solid: toBrep(raw[k].sol), csg: raw[k].sol }, fp));
    });
    else ['A', 'B', 'C', 'D'].forEach((k) => {
      const r = raw[k], g = k === 'A' || k === 'B' ? 'A' : 'C';
      parts.splice(['A', 'B', 'C', 'D'].indexOf(k), 0, { poz: g, name: names[g], m: r.m, solid: toBrep(r.sol), cut1: { p: [0, 0, 0], n: [0, 0, 1] }, cut2: { p: [0, 0, Htop], n: [0, 0, 1] }, csg: r.sol });
    });
    // rozměry podnože (obrys v půdorysu)
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    parts.map((p) => p.solid).concat(plateBoxes).forEach((b) => b.verts.forEach((p) => { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }));
    const Lf = Math.round(2 * Math.max(-mnx, mxx)), Wf = Math.round(2 * Math.max(-mny, mxy));
    const kit = mountKit(cfg, bars);
    kit.studs.forEach(([x, y]) => { plateBoxes.push(toBrep(extrude(circle(x, y, 4, 12), Htop, Htop + kit.studL))); });
    const welds = { pricne: pav ? 4 : 8, diag: 4, kriz: 6, ram: 8, ramj: 8, plotny: 4 }[cfg.top] + (pav ? 8 : 4);
    const out = { cfg, parts, plates, plateBoxes, boltPts: [], hw: kit.hw, kit, dims: { Lf, Wf, Hf: Htop }, bolted: false, G, notes, bars, weldJoints: welds };
    if (cache.size > 40) cache.clear();
    cache.set(key, out);
    return out;
  }

  /* ====================== audit (prutový model) ====================== */
  const SIG_ALLOW = 157, WELD_ALLOW = 180, E = 210000;
  function graph(cfg) {
    if (cfg.model === 'VR') return graphVR(cfg);
    const G = layoutFor(cfg), h = G.h, nodes = [], els = [], sup = [];
    const nodeOf = (p) => { let k = nodes.findIndex((q) => Math.abs(q[0] - p[0]) < 0.5 && Math.abs(q[1] - p[1]) < 0.5 && Math.abs(q[2] - p[2]) < 0.5); if (k < 0) { k = nodes.length; nodes.push(p.slice()); } return k; };
    const at = (k, s2) => { const [F, T] = G.legs[k]; return vadd(F, vmul(vsub(T, F), s2)); };
    const pts = { A: [0, 1], B: [0, 1], C: [0, 1], D: [0, 1] };
    const links = [];
    if (cfg.joint === 'zamky' && !G.pav) {
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
    if (normalize(cfgIn).model === 'KS') { const c2 = normalize(cfgIn); return auditKS(c2, build(c2)); }
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
      const ang = p.ang !== undefined ? p.ang : Math.acos(Math.abs(p.m.u[2])) * 180 / Math.PI;
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
    [...new Set(B.parts.map((p) => p.poz))].forEach((g) => {
      const grp = B.parts.filter((p) => p.poz === g), p = grp[0], L = P.partLength(p), vol = P.volume(p.solid);
      grp.forEach((q) => { if (Math.abs(P.partLength(q) - L) > 0.3 || Math.abs(P.volume(q.solid) - vol) > 5) problems.push(g + ': kusy nejsou shodné'); });
      n++; const poz = 'P' + String(n).padStart(2, '0');
      const ang = p.cutTxt ? null : p.ang !== undefined ? p.ang : Math.round(Math.acos(Math.abs(p.m.u[2])) * 1800 / Math.PI) / 10;
      const feat = p.prof ? p.feat : [cfg.joint === 'zamky' ? (g === 'C' ? 'výřezy pro A a B' : '') : 'díra pro zub plechu', cfg.top === 'pricne' && g === 'A' ? 'zápich pro pásovinu' : ''].filter(Boolean).join(', ');
      tubeM += L * grp.length / 1000; kg += vol * 7.85e-6 * grp.length;
      rows.push({ poz, name: p.name, kind: 'tube', prof: p.prof || 'jekl ' + s + '×' + s + '×' + t, L, len: L.toFixed(1), cut: p.cutTxt ? p.cutTxt.replace(' / ', '° / ') + '°' : ang + '° / ' + ang + '°', feat, q: grp.length, stroj: 'K2', file: poz + '_L' + Math.round(L) + '_' + grp.length + 'ks.step', part: p });
    });
    // shodné pásoviny sloučit
    const pl = [];
    B.plates.forEach((p) => {
      const sig = JSON.stringify([p.w, p.l, p.t, p.holes, p.ovals, p.poly].map((x) => x === undefined ? null : x), (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v);
      const same = pl.find((x) => x.sig === sig);
      if (same) same.p.q += p.q || 1; else pl.push({ sig, p: Object.assign({}, p) });
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
    const cost = kg * R.kg + cuts * R.rez + welds * R.svar + surf * R.barva * F.k + R.priprava + B.kit.cost + (B.extraCost || 0);
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
    if (B.overhangOk) ohWarn = ohSide < 0 ? { lvl: 'bad', t: 'Podnož by vyčnívala zpod desky do boku.' } : null;   // stolek: rám záměrně vyčnívá za desku
    else if (ohEnd < 0 || ohSide < 0) ohWarn = { lvl: 'bad', t: 'Podnož by vyčnívala zpod desky. Zvětšete stůl nebo použijte Přizpůsobit podnož desce.' };
    else if (ohEnd > 450 || ohSide > 300) ohWarn = { lvl: 'warn', t: 'Velký přesah desky – při opření o kraj se deska může prohýbat nebo stůl převážit.' };
    return { R, B, build: B, cfg, rows, tubeM, kg, welds, bolts: 0, price, vat, load, problems, audit: au, lvl, warns, DL, DW, ohEnd, ohSide, ohWarn,
      boltOK: false, boltWhy: 'model', bolted: false, boltDiff: 0, mount: B.kit, total: vat * cfg.qty };
  }

  function describe(cfg) {
    const M = MODELS.find((m) => m.id === cfg.model) || MODELS[0], F = P.FIN.find((f) => f.id === cfg.fin), S = P.SHAPES.find((x) => x.id === cfg.shape);
    const desk = cfg.shape === 'circle' ? 'Ø ' + P.nf(cfg.L) : P.nf(cfg.L) + ' × ' + P.nf(cfg.W);
    if (M.vr) return M.lab + ' (umělecká, jekl ' + cfg.size + '×' + cfg.size + '×' + cfg.t + ', smyčka 16 úseků přes 12 hran), sklo ' + P.nf(cfg.L) + ' × ' + P.nf(cfg.W) + ' × ' + P.nf(cfg.H) + ' mm, ' + F.lab + ', deska ' + cfg.td + ' mm, uchycení: ' + mountOf(cfg.mount).lab.toLowerCase();
    if (M.ks) return M.lab + ' (umělecká, ' + (cfg.ksMat === 'jekl' ? 'jekl ' + cfg.ksJ.replace('x', '×') : 'pás ' + cfg.ksD + '×' + cfg.ksT) + ', tyče ' + cfg.ksM + ', mezera ' + cfg.ksG + ' mm), ' + desk + ' × ' + P.nf(cfg.H) + ' mm, svařované tvary, ' + F.lab + ', deska ' + S.lab.toLowerCase() + ' ' + cfg.td + ' mm, uchycení: ' + mountOf(cfg.mount).lab.toLowerCase();
    const J = JOINTS.find((x) => x.id === cfg.joint), T = topsFor(cfg.model, cfg.pvLay).find((x) => x.id === cfg.top);
    return M.lab + ' (umělecká, ' + (M.pav ? 'nohy: ' + PV_LAYS.find((x) => x.id === cfg.pvLay).lab.toLowerCase() + ', ' : 'nohy: ' + J.lab.toLowerCase() + ', ') + 'nahoře: ' + T.lab + '), ' + desk + ' × ' + P.nf(cfg.H) + ' mm, jekl ' + cfg.size + '×' + cfg.size + '×' + cfg.t + ', svařovaná, ' + F.lab + ', deska ' + S.lab.toLowerCase() + ' ' + cfg.td + ' mm, uchycení: ' + mountOf(cfg.mount).lab.toLowerCase();
  }

  const API = { MODELS, MOUNTS, JOINTS, TOPS, PV_LAYS, KS_ROD, KS_GAP, KS_JEKL, topsFor, BAR_TS, BAR_STD, PL_L, RJ, rjOf, mountOk, owns, normalize, build, analyze, audit, describe, layout, csg: { Solid, box, prism, extrude, toBrep } };
  P.register(API);
  // stejné rozhraní jako Podnoze, jen s vlastními modely (pro stránku Umělecké)
  root.Vyvoj = Object.assign({}, P, { MODELS, MOUNTS, JOINTS, TOPS, PV_LAYS, KS_ROD, KS_GAP, KS_JEKL, topsFor, BAR_TS, BAR_STD, PL_L, RJ, rjOf, mountOk, SIZES, DEFAULT_CFG: Object.assign({}, P.DEFAULT_CFG, { model: 'PZ' }), normalize, build, analyze, audit, describe, ext: API });
})(typeof window !== 'undefined' ? window : globalThis);
