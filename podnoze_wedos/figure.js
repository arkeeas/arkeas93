/* Postava pro měřítko: dospělý / dítě, stojí / sedí na židli.
   Vrací tělesa ve stejném formátu jako díly podnože ({verts, faces}), takže je vykreslí
   three.js i záložní 2D náhled. Proporce z antropometrických poměrů k výšce postavy S. */
(function (root) {
  'use strict';
  const K = root.Podnoze, V = K.V;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /* komolý kužel s eliptickým průřezem mezi body a, b; r = [rx, ry] (rx = příčný směr) */
  function limb(a, b, ra, rb, n) {
    n = n || 12;
    const ax = unit(sub(b, a));
    let e1 = [1, 0, 0];
    if (Math.abs(dot(e1, ax)) > 0.9) e1 = [0, 1, 0];
    e1 = unit(sub(e1, mul(ax, dot(e1, ax))));
    const e2 = cross(ax, e1);
    if (!Array.isArray(ra)) ra = [ra, ra];
    if (!Array.isArray(rb)) rb = [rb, rb];
    const verts = [], faces = [];
    for (let k = 0; k < 2; k++) {
      const c = k ? b : a, r = k ? rb : ra;
      for (let i = 0; i < n; i++) {
        const t = i / n * Math.PI * 2;
        verts.push(add(c, add(mul(e1, Math.cos(t) * r[0]), mul(e2, Math.sin(t) * r[1]))));
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, q = [i, j, n + j, n + i];
      const mid = mul(add(add(verts[i], verts[j]), add(verts[n + i], verts[n + j])), 0.25);
      const cm = mul(add(a, b), 0.5);
      let nn = sub(mid, cm); nn = unit(sub(nn, mul(ax, dot(nn, ax))));
      faces.push({ outer: q, inner: [], n: nn });
    }
    faces.push({ outer: [...Array(n).keys()], inner: [], n: mul(ax, -1) });
    faces.push({ outer: [...Array(n).keys()].map((i) => n + i), inner: [], n: ax });
    return { verts, faces };
  }

  /* elipsoid */
  function ball(c, rx, ry, rz, nlat, nlon) {
    ry = ry == null ? rx : ry; rz = rz == null ? rx : rz;
    nlat = nlat || 8; nlon = nlon || 12;
    const verts = [[c[0], c[1], c[2] - rz]], faces = [];
    for (let i = 1; i < nlat; i++) {
      const ph = -Math.PI / 2 + i / nlat * Math.PI;
      for (let j = 0; j < nlon; j++) {
        const th = j / nlon * Math.PI * 2;
        verts.push([c[0] + rx * Math.cos(ph) * Math.cos(th), c[1] + ry * Math.cos(ph) * Math.sin(th), c[2] + rz * Math.sin(ph)]);
      }
    }
    verts.push([c[0], c[1], c[2] + rz]);
    const top = verts.length - 1, id = (i, j) => 1 + (i - 1) * nlon + (j % nlon);
    const nrm = (ix) => { const m = ix.reduce((s, k) => add(s, verts[k]), [0, 0, 0]); const p = sub(mul(m, 1 / ix.length), c); return unit([p[0] / rx / rx, p[1] / ry / ry, p[2] / rz / rz]); };
    for (let j = 0; j < nlon; j++) {
      let f = [0, id(1, j + 1), id(1, j)]; faces.push({ outer: f, inner: [], n: nrm(f) });
      f = [top, id(nlat - 1, j), id(nlat - 1, j + 1)]; faces.push({ outer: f, inner: [], n: nrm(f) });
      for (let i = 1; i < nlat - 1; i++) {
        f = [id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)]; faces.push({ outer: f, inner: [], n: nrm(f) });
      }
    }
    return { verts, faces };
  }

  function box(x0, x1, y0, y1, z0, z1) {
    const verts = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const faces = [
      { outer: [0, 1, 2, 3], inner: [], n: [0, 0, -1] }, { outer: [4, 5, 6, 7], inner: [], n: [0, 0, 1] },
      { outer: [0, 1, 5, 4], inner: [], n: [0, -1, 0] }, { outer: [2, 3, 7, 6], inner: [], n: [0, 1, 0] },
      { outer: [1, 2, 6, 5], inner: [], n: [1, 0, 0] }, { outer: [0, 3, 7, 4], inner: [], n: [-1, 0, 0] }
    ];
    return { verts, faces };
  }

  /* dvoučlánková inverzní kinematika: kloub (loket/koleno) mezi body p a q, ohnutý směrem pole */
  function ik(p, q, l1, l2, pole) {
    let d = sub(q, p), dl = len(d);
    const max = (l1 + l2) * 0.999;
    if (dl > max) { q = add(p, mul(d, max / dl)); d = sub(q, p); dl = max; }
    const u = unit(d), a = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    let w = sub(pole, mul(u, dot(pole, u))); w = unit(w);
    return { j: add(add(p, mul(u, a)), mul(w, h)), end: q };
  }

  const PRESET = { adult: { S: 1780, lab: 'Dospělý' }, child: { S: 1250, lab: 'Dítě' } };

  /* hlavní funkce: A = výsledek Podnoze.analyze, o = { kind:'adult'|'child', pose:'stand'|'sit', S } */
  function build(A, o) {
    const child = o.kind === 'child';
    const S = Math.max(800, Math.min(2200, +o.S || PRESET[o.kind].S));
    const sit = o.pose === 'sit';
    const hk = child ? 1.22 : 1; // větší hlava u dítěte
    const hrx = 0.046 * S * hk, hry = 0.056 * S * hk, hrz = 0.064 * S * hk;

    /* hrana desky na straně postavy (osa -y) a výška pod rámem */
    const outline = K.deskOutline(A.cfg.shape, A.DL, A.DW);
    const mid = outline.filter((p) => Math.abs(p[0]) < A.DL * 0.2);
    const edgeY = Math.min(...(mid.length ? mid : outline).map((p) => p[1]));
    const Hf = A.build.dims.Hf, zTop = A.cfg.H, under = Hf - A.cfg.size;

    const L = { th: 0.245 * S, sh: 0.246 * S, ua: 0.186 * S, fa: 0.15 * S };
    const hs = sit ? Math.round(0.25 * S + 15) : 0; // výška sedáku = podkolenní výška + obuv
    const needUnder = Math.round(hs + 0.045 * S + 0.042 * S + 20);
    const legOk = !sit || under >= needUnder;

    /* poloha pánve (počátek postavy) v ose y */
    let y0;
    if (!sit) y0 = edgeY - 0.17 * S;
    else if (legOk) y0 = edgeY - 0.14 * S;
    else y0 = edgeY - (L.th + 0.06 * S + 40);
    const O = [0, y0, 0];
    const P = (x, y, z) => add(O, [x, y, z]);

    const bodies = [];
    const skin = child ? '#C9B8A0' : '#B7BEC6';
    const push = (s, c) => { s.color = c || skin; bodies.push(s); };

    let hipZ, shZ, shY, pelvis;
    if (!sit) { hipZ = 0.5 * S; shZ = S - 1.8 * hrz - 0.05 * S; shY = 0; pelvis = P(0, -0.005 * S, hipZ + 0.02 * S); }
    else { hipZ = hs + 0.05 * S; shZ = hs + 0.345 * S - (child ? 0.01 * S : 0); shY = -0.03 * S; pelvis = P(0, -0.025 * S, hs + 0.065 * S); }

    /* trup, pánev, krk, hlava */
    const waist = P(0, sit ? -0.03 * S : 0, (sit ? hs + 0.07 * S : hipZ) + 0.11 * S);
    const chest = P(0, shY, shZ - 0.035 * S);
    push(ball(pelvis, 0.098 * S, 0.064 * S, 0.062 * S));
    push(limb(pelvis, waist, [0.094 * S, 0.06 * S], [0.083 * S, 0.055 * S], 14));
    push(limb(waist, chest, [0.083 * S, 0.055 * S], [0.108 * S, 0.066 * S], 14));
    push(ball(chest, 0.108 * S, 0.066 * S, 0.035 * S));
    const neckTop = P(0, shY + 0.005 * S, shZ + 0.05 * S);
    push(limb(P(0, shY, shZ - 0.01 * S), neckTop, 0.026 * S, 0.024 * S, 10));
    push(ball(add(neckTop, [0, 0.006 * S, hrz * 0.8]), hrx, hry, hrz, 9, 14));

    /* nohy */
    [-1, 1].forEach((sg) => {
      const hip = P(sg * 0.052 * S, sit ? 0 : 0, hipZ);
      let ankle, pole;
      if (!sit) { ankle = P(sg * 0.058 * S, 0.005 * S, 0.045 * S); pole = [0, 1, 0]; }
      else { ankle = P(sg * 0.07 * S, L.th + 0.03 * S, 0.045 * S); pole = [0, 0.3, 1]; }
      let knee;
      if (!sit) knee = add(mul(add(hip, ankle), 0.5), [0, 0.01 * S, 0]);
      else { const r = ik(hip, ankle, L.th, L.sh, pole); knee = r.j; ankle = r.end; }
      push(limb(hip, knee, 0.046 * S, 0.031 * S));
      push(ball(knee, 0.031 * S));
      push(limb(knee, ankle, 0.031 * S, 0.02 * S));
      push(limb(add(ankle, [0, -0.025 * S, -0.02 * S]), add(ankle, [0, 0.125 * S, -0.028 * S]), [0.024 * S, 0.02 * S], [0.022 * S, 0.012 * S], 10), child ? '#8A7D6C' : '#6E747B');
    });

    /* ruce: vsedě na desce, pokud na ni dosáhne; jinak na stehnech; vestoje podél těla */
    let handsOnDesk = false;
    [-1, 1].forEach((sg) => {
      const sh = P(sg * 0.1 * S, shY, shZ - 0.012 * S);
      let wrist, pole = [sg * 0.25, -0.6, -1];
      if (!sit) wrist = P(sg * 0.125 * S, 0.035 * S, shZ - 0.325 * S);
      else {
        const onDesk = [sg * 0.12 * S, edgeY + 0.07 * S, zTop + 0.018 * S];
        const reach = len(sub(onDesk, sh)) <= (L.ua + L.fa) * 0.98;
        const rel = zTop - hs;
        if (reach && rel > 0.12 * S && rel < 0.36 * S) { wrist = onDesk; handsOnDesk = true; }
        else wrist = P(sg * 0.075 * S, 0.15 * S, hs + 0.105 * S);
      }
      const r = ik(sh, wrist, L.ua, L.fa, pole);
      push(ball(sh, 0.036 * S));
      push(limb(sh, r.j, 0.027 * S, 0.021 * S));
      push(ball(r.j, 0.021 * S));
      push(limb(r.j, r.end, 0.021 * S, 0.016 * S));
      const hd = sit ? unit(sub(r.end, r.j)) : [0, 0, -1];
      const hdir = sit && handsOnDesk ? unit([hd[0], hd[1], 0]) : hd;
      push(limb(r.end, add(r.end, mul(hdir, 0.1 * S)), [0.021 * S, 0.01 * S], [0.018 * S, 0.008 * S], 8));
    });

    /* židle */
    if (sit) {
      const c = '#5C6167', t = Math.max(16, 0.014 * S), w = 0.135 * S, yb = -0.13 * S, yf = 0.15 * S, p = 0.018 * S;
      const Bx = (x0, x1, ya, yb2, z0, z1) => push(box(x0, x1, y0 + ya, y0 + yb2, z0, z1), c);
      Bx(-w, w, yb, yf, hs - t, hs);
      [[-w, yb], [w - p, yb], [-w, yf - p], [w - p, yf - p]].forEach(([x, y]) => Bx(x, x + p, y, y + p, 0, hs - t));
      [-w, w - p].forEach((x) => Bx(x, x + p, yb, yb + p, hs, hs + 0.25 * S));
      Bx(-w, w, yb, yb + p, hs + 0.14 * S, hs + 0.25 * S);
    }

    const zs = bodies.flatMap((b) => b.verts.map((v) => v[2]));
    const ys = bodies.flatMap((b) => b.verts.map((v) => v[1]));
    return {
      bodies,
      info: {
        S, sit, child, seat: hs, under: Math.round(under), need: needUnder, legOk, handsOnDesk,
        ideal: Math.round(0.42 * S), zMax: Math.max(...zs), yMin: Math.min(...ys)
      }
    };
  }

  root.Postava = { build, PRESET };
})(window);
