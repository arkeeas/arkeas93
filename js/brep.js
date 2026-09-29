/*
 * brep.js – jednoduché objemové těleso „vytažený profil“ (jekl, plech)
 *           + export do STEP AP214 (přesná B-rep geometrie: roviny, válce)
 *           + síť trojúhelníků pro 3D náhled.
 *
 * Těleso v lokálních souřadnicích:
 *   - profil v rovině XY (smyčky úseček / oblouků / kružnic),
 *     smyčka 0 = vnější obrys (CCW), další smyčky = díry (CW),
 *   - vytažení podél +Z o délku `length`,
 *   - volitelně „otvory ve stěně“ (kolmo na rovinnou boční stěnu).
 */
(function (root) {
  "use strict";

  // ---------- vektorová pomůcka ----------
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
  };

  // Rigidní transformace: R = [ex, ey, ez] (obrazy lokálních os), T = posun
  const Xf = {
    identity: () => ({ R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], T: [0, 0, 0] }),
    make: (ex, ey, ez, T) => ({ R: [ex, ey, ez], T: T || [0, 0, 0] }),
    dir: (xf, d) => [
      xf.R[0][0] * d[0] + xf.R[1][0] * d[1] + xf.R[2][0] * d[2],
      xf.R[0][1] * d[0] + xf.R[1][1] * d[1] + xf.R[2][1] * d[2],
      xf.R[0][2] * d[0] + xf.R[1][2] * d[1] + xf.R[2][2] * d[2]
    ],
    pt: (xf, p) => V.add(Xf.dir(xf, p), xf.T)
  };

  // ---------- profily ----------
  function reverseLoop(segs) {
    return segs.slice().reverse().map((s) => Object.assign({}, s, { p0: s.p1, p1: s.p0, ccw: !s.ccw }));
  }

  /* Obdélník bx × hy se zaoblením r, střed v počátku, CCW.
     Vrací { segs, walls: {bottom,right,top,left} } – indexy rovinných stěn. */
  function roundedRect(bx, hy, r) {
    const x = bx / 2, y = hy / 2;
    const segs = [];
    const walls = {};
    if (r <= 1e-9) {
      segs.push({ type: "line", p0: [-x, -y], p1: [x, -y] }); walls.bottom = 0;
      segs.push({ type: "line", p0: [x, -y], p1: [x, y] }); walls.right = 1;
      segs.push({ type: "line", p0: [x, y], p1: [-x, y] }); walls.top = 2;
      segs.push({ type: "line", p0: [-x, y], p1: [-x, -y] }); walls.left = 3;
    } else {
      segs.push({ type: "line", p0: [-x + r, -y], p1: [x - r, -y] }); walls.bottom = 0;
      segs.push({ type: "arc", c: [x - r, -y + r], r, p0: [x - r, -y], p1: [x, -y + r], ccw: true });
      segs.push({ type: "line", p0: [x, -y + r], p1: [x, y - r] }); walls.right = 2;
      segs.push({ type: "arc", c: [x - r, y - r], r, p0: [x, y - r], p1: [x - r, y], ccw: true });
      segs.push({ type: "line", p0: [x - r, y], p1: [-x + r, y] }); walls.top = 4;
      segs.push({ type: "arc", c: [-x + r, y - r], r, p0: [-x + r, y], p1: [-x, y - r], ccw: true });
      segs.push({ type: "line", p0: [-x, y - r], p1: [-x, -y + r] }); walls.left = 6;
      segs.push({ type: "arc", c: [-x + r, -y + r], r, p0: [-x, -y + r], p1: [-x + r, -y], ccw: true });
    }
    return { segs, walls };
  }

  /* Jekl (uzavřený obdélníkový profil) bx × hy × t.
     ro = vnější rádius, ri = vnitřní rádius. */
  function tubeProfile(bx, hy, t, ro, ri) {
    const outer = roundedRect(bx, hy, ro);
    const innerCCW = roundedRect(bx - 2 * t, hy - 2 * t, ri);
    const n = innerCCW.segs.length;
    const inner = reverseLoop(innerCCW.segs);
    const innerWalls = {};
    for (const k in innerCCW.walls) innerWalls[k] = n - 1 - innerCCW.walls[k];
    return {
      loops: [outer.segs, inner],
      walls: { outer: outer.walls, inner: innerWalls },
      flat: { x: Math.min(bx - 2 * ro, bx - 2 * t - 2 * ri), y: Math.min(hy - 2 * ro, hy - 2 * t - 2 * ri) }
    };
  }

  /* Plech bx × hy s kruhovými otvory holes = [{x,y,d}] */
  function plateProfile(bx, hy, holes) {
    const loops = [roundedRect(bx, hy, 0).segs];
    for (const h of holes || []) {
      const r = h.d / 2;
      const p = [h.x + r, h.y];
      loops.push([{ type: "circle", c: [h.x, h.y], r, p0: p, p1: p, ccw: false }]);
    }
    return { loops };
  }

  // ---------- plocha a hmotnost ----------
  function arcSpan(s) {
    if (s.type === "circle") return s.ccw ? 2 * Math.PI : -2 * Math.PI;
    const a0 = Math.atan2(s.p0[1] - s.c[1], s.p0[0] - s.c[0]);
    const a1 = Math.atan2(s.p1[1] - s.c[1], s.p1[0] - s.c[0]);
    let d = a1 - a0;
    if (s.ccw) { while (d <= 0) d += 2 * Math.PI; } else { while (d >= 0) d -= 2 * Math.PI; }
    return d;
  }

  function loopSignedArea(segs) {
    let A = 0;
    for (const s of segs) {
      if (s.type === "line") {
        A += (s.p0[0] * s.p1[1] - s.p1[0] * s.p0[1]) / 2;
      } else {
        const a0 = Math.atan2(s.p0[1] - s.c[1], s.p0[0] - s.c[0]);
        const d = arcSpan(s), a1 = a0 + d, r = s.r, cx = s.c[0], cy = s.c[1];
        A += 0.5 * (cx * r * (Math.sin(a1) - Math.sin(a0)) + r * r * d - cy * r * (Math.cos(a1) - Math.cos(a0)));
      }
    }
    return A;
  }

  function solidVolume(solid) {
    let A = 0;
    for (const l of solid.loops) A += loopSignedArea(l);
    let vol = A * solid.length;
    for (const h of solid.wallHoles || []) vol -= Math.PI * h.r * h.r * h.t;
    return vol; // mm³
  }

  // ---------- STEP ----------
  function fmt(n) {
    if (Math.abs(n) < 1e-10) n = 0;
    let s = n.toFixed(6).replace(/0+$/, "");
    if (s.endsWith(".")) return s;
    if (s.indexOf(".") < 0) s += ".";
    return s === "-0." ? "0." : s;
  }
  function str(s) {
    // STEP řetězec – bez diakritiky (kvůli kompatibilitě) a s escapem apostrofu
    return "'" + String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/'/g, "''") + "'";
  }

  class StepWriter {
    constructor() { this.lines = []; this.n = 0; }
    add(s) { this.n++; this.lines.push("#" + this.n + "=" + s + ";"); return this.n; }
    ref(i) { return "#" + i; }
    list(a) { return "(" + a.map((i) => "#" + i).join(",") + ")"; }
  }

  /* Zapíše jedno těleso jako MANIFOLD_SOLID_BREP, vrací id. */
  function writeSolid(w, solid, xf, name) {
    xf = xf || Xf.identity();
    const P = (p) => w.add("CARTESIAN_POINT('',(" + Xf.pt(xf, p).map(fmt).join(",") + "))");
    const D = (d) => w.add("DIRECTION('',(" + V.norm(Xf.dir(xf, d)).map(fmt).join(",") + "))");
    const AX = (o, z, x) => w.add("AXIS2_PLACEMENT_3D(''," + "#" + P(o) + ",#" + D(z) + ",#" + D(x) + ")");
    const VP = (p) => w.add("VERTEX_POINT('',#" + P(p) + ")");
    const LINE = (p, d) => { const vec = w.add("VECTOR('',#" + D(d) + ",1.)"); return w.add("LINE('',#" + P(p) + ",#" + vec + ")"); };
    const CIRC = (c, z, x, r) => w.add("CIRCLE('',#" + AX(c, z, x) + "," + fmt(r) + ")");
    const EC = (v0, v1, curve) => w.add("EDGE_CURVE('',#" + v0 + ",#" + v1 + ",#" + curve + ",.T.)");
    const OE = (e, sense) => w.add("ORIENTED_EDGE('',*,*,#" + e + "," + (sense ? ".T." : ".F.") + ")");
    const LOOP = (oes) => w.add("EDGE_LOOP(''," + w.list(oes) + ")");
    const BOUND = (loop, outer) => w.add((outer ? "FACE_OUTER_BOUND" : "FACE_BOUND") + "('',#" + loop + ",.T.)");
    const FACE = (bounds, surf, same) => w.add("ADVANCED_FACE(''," + w.list(bounds) + ",#" + surf + "," + (same ? ".T." : ".F.") + ")");

    const L = solid.length;
    const loops = solid.loops;
    const V0 = [], VL = [], E0 = [], EL = [], LE = [];

    // vrcholy
    loops.forEach((segs, k) => {
      V0[k] = segs.map((s) => VP([s.p0[0], s.p0[1], 0]));
      VL[k] = segs.map((s) => VP([s.p0[0], s.p0[1], L]));
    });

    // hrany profilu (z=0 a z=L) a podélné hrany
    function profileEdge(s, z, Vs, i, n) {
      const v0 = Vs[i], v1 = Vs[(i + 1) % n];
      let curve;
      if (s.type === "line") {
        curve = LINE([s.p0[0], s.p0[1], z], [s.p1[0] - s.p0[0], s.p1[1] - s.p0[1], 0]);
      } else {
        const ref = [s.p0[0] - s.c[0], s.p0[1] - s.c[1], 0];
        curve = CIRC([s.c[0], s.c[1], z], [0, 0, s.ccw ? 1 : -1], ref, s.r);
      }
      return EC(v0, v1, curve);
    }
    loops.forEach((segs, k) => {
      const n = segs.length;
      E0[k] = segs.map((s, i) => profileEdge(s, 0, V0[k], i, n));
      EL[k] = segs.map((s, i) => profileEdge(s, L, VL[k], i, n));
      LE[k] = segs.map((s, i) => EC(V0[k][i], VL[k][i], LINE([s.p0[0], s.p0[1], 0], [0, 0, 1])));
    });

    // otvory ve stěnách – připravit hrany
    const extraBounds = {}; // "k:i" -> [bound ids]
    const holeFaces = [];
    for (const h of solid.wallHoles || []) {
      const n = V.norm(h.normal);
      const e1 = [0, 0, 1];
      const co = h.center, ci = V.sub(co, V.mul(n, h.t));
      const vo = VP(V.add(co, V.mul(e1, h.r)));
      const vi = VP(V.add(ci, V.mul(e1, h.r)));
      const Co = EC(vo, vo, CIRC(co, n, e1, h.r));
      const Ci = EC(vi, vi, CIRC(ci, n, e1, h.r));
      const seam = EC(vi, vo, LINE(V.add(ci, V.mul(e1, h.r)), n));
      const ko = h.outerFace.join(":"), ki = h.innerFace.join(":");
      (extraBounds[ko] = extraBounds[ko] || []).push(BOUND(LOOP([OE(Co, false)]), false));
      (extraBounds[ki] = extraBounds[ki] || []).push(BOUND(LOOP([OE(Ci, true)]), false));
      const cyl = w.add("CYLINDRICAL_SURFACE('',#" + AX(ci, n, e1) + "," + fmt(h.r) + ")");
      const lp = LOOP([OE(Ci, false), OE(seam, true), OE(Co, true), OE(seam, false)]);
      holeFaces.push(FACE([BOUND(lp, true)], cyl, false));
    }

    const faces = [];
    // boční plochy
    loops.forEach((segs, k) => {
      const n = segs.length;
      segs.forEach((s, i) => {
        const j = (i + 1) % n;
        const lp = LOOP([OE(E0[k][i], true), OE(LE[k][j], true), OE(EL[k][i], false), OE(LE[k][i], false)]);
        let surf, same = true;
        if (s.type === "line") {
          const t = V.norm([s.p1[0] - s.p0[0], s.p1[1] - s.p0[1], 0]);
          const nrm = [t[1], -t[0], 0];
          surf = w.add("PLANE('',#" + AX([s.p0[0], s.p0[1], 0], nrm, t) + ")");
        } else {
          surf = w.add("CYLINDRICAL_SURFACE('',#" + AX([s.c[0], s.c[1], 0], [0, 0, 1], [1, 0, 0]) + "," + fmt(s.r) + ")");
          same = !!s.ccw;
        }
        const bounds = [BOUND(lp, true)].concat(extraBounds[k + ":" + i] || []);
        faces.push(FACE(bounds, surf, same));
      });
    });

    // čela z=0 (normála -Z) a z=L (normála +Z)
    const b0 = loops.map((segs, k) => BOUND(LOOP(segs.map((s, i) => OE(E0[k][i], false)).reverse()), k === 0));
    faces.push(FACE(b0, w.add("PLANE('',#" + AX([0, 0, 0], [0, 0, -1], [1, 0, 0]) + ")"), true));
    const bL = loops.map((segs, k) => BOUND(LOOP(segs.map((s, i) => OE(EL[k][i], true))), k === 0));
    faces.push(FACE(bL, w.add("PLANE('',#" + AX([0, 0, L], [0, 0, 1], [1, 0, 0]) + ")"), true));

    const shell = w.add("CLOSED_SHELL(''," + w.list(faces.concat(holeFaces)) + ")");
    return w.add("MANIFOLD_SOLID_BREP(" + str(name || "") + ",#" + shell + ")");
  }

  /* bodies = [{solid, xf, name}] → text STEP souboru (jeden díl, případně víc těles) */
  function toStep(bodies, opts) {
    opts = opts || {};
    const w = new StepWriter();
    const appCtx = w.add("APPLICATION_CONTEXT('core data for automotive mechanical design processes')");
    w.add("APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#" + appCtx + ")");
    const prodCtx = w.add("PRODUCT_CONTEXT('',#" + appCtx + ",'mechanical')");
    const name = opts.name || "dil";
    const prod = w.add("PRODUCT(" + str(name) + "," + str(name) + ",'',(#" + prodCtx + "))");
    w.add("PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#" + prod + "))");
    const pdf = w.add("PRODUCT_DEFINITION_FORMATION('','',#" + prod + ")");
    const pdCtx = w.add("PRODUCT_DEFINITION_CONTEXT('part definition',#" + appCtx + ",'design')");
    const pd = w.add("PRODUCT_DEFINITION('design','',#" + pdf + ",#" + pdCtx + ")");
    const pds = w.add("PRODUCT_DEFINITION_SHAPE('','',#" + pd + ")");

    const lu = w.add("(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))");
    const au = w.add("(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))");
    const su = w.add("(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())");
    const unc = w.add("UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),#" + lu + ",'distance_accuracy_value','confusion accuracy')");
    const ctx = w.add("(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#" + unc + "))GLOBAL_UNIT_ASSIGNED_CONTEXT((#" + lu + ",#" + au + ",#" + su + "))REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'))");

    const origin = w.add("AXIS2_PLACEMENT_3D('',#" + w.add("CARTESIAN_POINT('',(0.,0.,0.))") + ",#" + w.add("DIRECTION('',(0.,0.,1.))") + ",#" + w.add("DIRECTION('',(1.,0.,0.))") + ")");
    const items = [origin];
    for (const b of bodies) items.push(writeSolid(w, b.solid, b.xf, b.name));
    const rep = w.add("ADVANCED_BREP_SHAPE_REPRESENTATION(" + str(name) + "," + w.list(items) + ",#" + ctx + ")");
    w.add("SHAPE_DEFINITION_REPRESENTATION(#" + pds + ",#" + rep + ")");

    const ts = (opts.date || new Date()).toISOString().slice(0, 19);
    return [
      "ISO-10303-21;",
      "HEADER;",
      "FILE_DESCRIPTION(('" + "Konfigurator podnozi" + "'),'2;1');",
      "FILE_NAME(" + str(opts.fileName || name + ".step") + ",'" + ts + "',(" + str(opts.author || "") + "),(" + str(opts.org || "") + "),'konfigurator-stolu','konfigurator-stolu','');",
      "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
      "ENDSEC;",
      "DATA;"
    ].concat(w.lines, ["ENDSEC;", "END-ISO-10303-21;", ""]).join("\n");
  }

  // ---------- síť pro náhled ----------
  function tessLoop(segs, arcStep) {
    const pts = [], nrm = [];
    for (const s of segs) {
      if (s.type === "line") {
        const t = V.norm([s.p1[0] - s.p0[0], s.p1[1] - s.p0[1], 0]);
        pts.push({ p: s.p0, n: [t[1], -t[0]], flat: true, t: [t[0], t[1]] });
      } else {
        const a0 = Math.atan2(s.p0[1] - s.c[1], s.p0[0] - s.c[0]);
        const d = arcSpan(s);
        const k = Math.max(2, Math.ceil(Math.abs(d) / arcStep));
        for (let j = 0; j < k; j++) {
          const a = a0 + (d * j) / k;
          const rad = [Math.cos(a), Math.sin(a)];
          const sgn = s.ccw ? 1 : -1;
          pts.push({ p: [s.c[0] + s.r * rad[0], s.c[1] + s.r * rad[1]], n: [rad[0] * sgn, rad[1] * sgn], flat: false });
        }
      }
    }
    return pts;
  }

  /* Vrací { pos:[], nor:[] } (pole čísel) ve světových souřadnicích */
  function toMesh(solid, xf, out) {
    out = out || { pos: [], nor: [] };
    const L = solid.length;
    const tri = (a, b, c, n) => {
      for (const p of [a, b, c]) { out.pos.push(...Xf.pt(xf, p)); out.nor.push(...V.norm(Xf.dir(xf, n))); }
    };
    const triN = (a, na, b, nb, c, nc) => {
      [[a, na], [b, nb], [c, nc]].forEach(([p, n]) => { out.pos.push(...Xf.pt(xf, p)); out.nor.push(...V.norm(Xf.dir(xf, n))); });
    };
    const tl = solid.loops.map((l) => tessLoop(l, Math.PI / 12));
    // boční plochy
    for (const pts of tl) {
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const a0 = [a.p[0], a.p[1], 0], b0 = [b.p[0], b.p[1], 0], a1 = [a.p[0], a.p[1], L], b1 = [b.p[0], b.p[1], L];
        // rohové oblouky navazují tečně na úsečky → normála konce oblouku = normála další úsečky
        const na = [a.n[0], a.n[1], 0];
        const nb = a.flat ? na : [b.n[0], b.n[1], 0];
        triN(a0, na, b0, nb, b1, nb);
        triN(a0, na, b1, nb, a1, na);
      }
    }
    // čela
    const outer = tl[0].map((q) => q.p);
    if (tl.length === 2 && tl[1].length === tl[0].length) {
      const cw = tl[1].map((q) => q.p);
      const inner = [cw[0]].concat(cw.slice(1).reverse());
      const n = outer.length;
      for (let i = 0; i < n; i++) {
        const o0 = outer[i], o1 = outer[(i + 1) % n], i0 = inner[i], i1 = inner[(i + 1) % n];
        tri([o0[0], o0[1], L], [o1[0], o1[1], L], [i1[0], i1[1], L], [0, 0, 1]);
        tri([o0[0], o0[1], L], [i1[0], i1[1], L], [i0[0], i0[1], L], [0, 0, 1]);
        tri([o0[0], o0[1], 0], [i1[0], i1[1], 0], [o1[0], o1[1], 0], [0, 0, -1]);
        tri([o0[0], o0[1], 0], [i0[0], i0[1], 0], [i1[0], i1[1], 0], [0, 0, -1]);
      }
    } else {
      for (let i = 1; i < outer.length - 1; i++) {
        const a = outer[0], b = outer[i], c = outer[i + 1];
        tri([a[0], a[1], L], [b[0], b[1], L], [c[0], c[1], L], [0, 0, 1]);
        tri([a[0], a[1], 0], [c[0], c[1], 0], [b[0], b[1], 0], [0, 0, -1]);
      }
    }
    return out;
  }

  /* Tmavé kotoučky v místě otvorů (jen vizuálně) */
  function holeMarks(solid, xf, out) {
    out = out || { pos: [], nor: [] };
    for (const h of solid.wallHoles || []) {
      const n = V.norm(h.normal), e1 = [0, 0, 1], e2 = V.cross(n, e1);
      const c = V.add(h.center, V.mul(n, 0.15));
      const k = 20;
      for (let j = 0; j < k; j++) {
        const a0 = (2 * Math.PI * j) / k, a1 = (2 * Math.PI * (j + 1)) / k;
        const p0 = V.add(c, V.add(V.mul(e1, h.r * Math.cos(a0)), V.mul(e2, h.r * Math.sin(a0))));
        const p1 = V.add(c, V.add(V.mul(e1, h.r * Math.cos(a1)), V.mul(e2, h.r * Math.sin(a1))));
        for (const p of [c, p0, p1]) { out.pos.push(...Xf.pt(xf, p)); out.nor.push(...V.norm(Xf.dir(xf, n))); }
      }
    }
    return out;
  }

  root.BREP = { V, Xf, roundedRect, tubeProfile, plateProfile, loopSignedArea, solidVolume, toStep, toMesh, holeMarks, fmt };
})(typeof window !== "undefined" ? window : globalThis);
