/* Skicář – jádro bez 3D (běží v prohlížeči i v Node).
 *
 * Model skici:
 *   members: pruty – osa profilu od a do b (mm, Z nahoru), profil z katalogu, natočení kolem osy
 *   plates:  desky – vodorovné obdélníky (dřevo, sklo, kámen, plech), spodní plocha ve výšce z
 *   joints:  záměr spoje v uzlu (pokos / na tupo s průběžným prutem / plný roh) – jen informace pro AI a importér
 *
 * Osa prutu = střed obrysu průřezu. u = směr šířky průřezu (první rozměr profilu), v = směr výšky (druhý rozměr).
 * Vodorovný / šikmý prut: u vodorovně napříč, v nahoru. Svislý prut: u = X, v = Y. Natočení otáčí u, v kolem osy.
 */
(function (root) {
  'use strict';

  const DEFAULT_CATALOG = [
    'jekl 20x20x2', 'jekl 25x25x2', 'jekl 30x30x2', 'jekl 40x40x2', 'jekl 40x40x3', 'jekl 50x50x3', 'jekl 60x60x3',
    'jekl 40x20x2', 'jekl 50x30x2', 'jekl 60x40x3', 'jekl 80x40x3',
    'pas 20x4', 'pas 30x5', 'pas 40x5', 'pas 50x5', 'pas 60x8',
    'L 30x30x3', 'L 40x40x4', 'U 50x25x4',
    'trubka 26.9x2', 'trubka 33.7x2', 'trubka 42.4x2',
    'kulatina 10', 'kulatina 12'
  ].join('\n');

  const TYPES = {
    jekl: { n: 3, lab: 'jekl' }, pas: { n: 2, lab: 'pásovina' }, L: { n: 3, lab: 'úhelník L' }, U: { n: 3, lab: 'U profil' },
    trubka: { n: 2, lab: 'trubka' }, kulatina: { n: 1, lab: 'kulatina' }
  };
  const STEEL = 0.00785;   // kg/m na 1 mm² průřezu

  /* ---------- profily ---------- */
  function parseProfile(line) {
    const s = String(line || '').trim().replace(/×/g, 'x').replace(/,/g, '.').replace(/\s+/g, ' ');
    if (!s || s.startsWith('#')) return null;
    const m = s.match(/^(jekl|pas|pásovina|L|U|trubka|kulatina|tr|ø|Ø)\s*([0-9.]+(?:\s*x\s*[0-9.]+)*)$/i);
    if (!m) return null;
    let typ = m[1].toLowerCase();
    if (typ === 'pásovina') typ = 'pas';
    if (typ === 'tr') typ = 'trubka';
    if (typ === 'ø') typ = 'kulatina';
    if (typ === 'l') typ = 'L';
    if (typ === 'u') typ = 'U';
    const n = m[2].split(/\s*x\s*/).map(Number);
    if (n.some((x) => !(x > 0)) || n.length !== TYPES[typ].n) return null;
    const p = { typ };
    if (typ === 'jekl' || typ === 'L' || typ === 'U') { p.a = n[0]; p.b = n[1]; p.t = n[2]; if (p.t * 2 >= Math.min(p.a, p.b)) return null; }
    else if (typ === 'pas') { p.a = n[0]; p.b = n[1]; }
    else if (typ === 'trubka') { p.d = n[0]; p.t = n[1]; if (p.t * 2 >= p.d) return null; }
    else p.d = n[0];
    p.id = profileId(p);
    p.area = area(p);
    p.kgm = round(p.area * STEEL, 3);
    return p;
  }
  function fmt(x) { return String(round(x, 1)).replace(/\.0$/, ''); }
  function profileId(p) {
    if (p.typ === 'trubka') return 'trubka ' + fmt(p.d) + 'x' + fmt(p.t);
    if (p.typ === 'kulatina') return 'kulatina ' + fmt(p.d);
    if (p.typ === 'pas') return 'pas ' + fmt(p.a) + 'x' + fmt(p.b);
    return p.typ + ' ' + fmt(p.a) + 'x' + fmt(p.b) + 'x' + fmt(p.t);
  }
  function profileLabel(p) {
    const x = (s) => s.replace(/x/g, '×');
    if (p.typ === 'trubka') return 'trubka Ø' + x(fmt(p.d) + 'x' + fmt(p.t));
    if (p.typ === 'kulatina') return 'kulatina Ø' + fmt(p.d);
    if (p.typ === 'pas') return 'pásovina ' + x(fmt(p.a) + 'x' + fmt(p.b));
    return (p.typ === 'jekl' ? 'jekl ' : p.typ + ' ') + x(fmt(p.a) + 'x' + fmt(p.b) + 'x' + fmt(p.t));
  }
  function area(p) {
    switch (p.typ) {
      case 'jekl': return 2 * p.t * (p.a + p.b) - 4 * p.t * p.t;
      case 'pas': return p.a * p.b;
      case 'L': return p.t * (p.a + p.b - p.t);
      case 'U': return p.t * (p.a + 2 * p.b - 2 * p.t);
      case 'trubka': return Math.PI * (p.d - p.t) * p.t;
      case 'kulatina': return Math.PI * p.d * p.d / 4;
    }
    return 0;
  }
  /* rozměr obrysu průřezu [ve směru u, ve směru v] */
  function extent(p) { return p.d ? [p.d, p.d] : [p.a, p.b]; }
  /* obrys průřezu v rovině (u, v) se středem obrysu v počátku: { outer: [[u,v]…], holes: [[[u,v]…]], round: d? } */
  function section(p) {
    const [w, h] = extent(p), hw = w / 2, hh = h / 2;
    const rect = (a, b) => [[-a, -b], [a, -b], [a, b], [-a, b]];
    switch (p.typ) {
      case 'jekl': return { outer: rect(hw, hh), holes: [rect(hw - p.t, hh - p.t)] };
      case 'pas': return { outer: rect(hw, hh), holes: [] };
      case 'L': return { outer: [[-hw, -hh], [hw, -hh], [hw, -hh + p.t], [-hw + p.t, -hh + p.t], [-hw + p.t, hh], [-hw, hh]], holes: [] };
      case 'U': return { outer: [[-hw, -hh], [hw, -hh], [hw, hh], [hw - p.t, hh], [hw - p.t, -hh + p.t], [-hw + p.t, -hh + p.t], [-hw + p.t, hh], [-hw, hh]], holes: [] };
      case 'trubka': return { round: p.d, hole: p.d - 2 * p.t };
      case 'kulatina': return { round: p.d, hole: 0 };
    }
    return null;
  }
  function parseCatalog(text) {
    const list = [], bad = [], seen = {};
    String(text || '').split(/\r?\n/).forEach((l) => {
      if (!l.trim() || l.trim().startsWith('#')) return;
      const p = parseProfile(l);
      if (!p) bad.push(l.trim());
      else if (!seen[p.id]) { seen[p.id] = 1; list.push(p); }
    });
    return { list, bad, byId: Object.fromEntries(list.map((p) => [p.id, p])) };
  }

  /* ---------- vektory ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const norm = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 0]; };
  function round(x, d) { const k = Math.pow(10, d == null ? 1 : d); return Math.round(x * k) / k; }
  const rp = (p) => p.map((c) => round(c, 1) + 0);
  const key = (p) => p.map((c) => round(c, 1).toFixed(1)).join(',');

  /* báze prutu: x = osa, u = šířka průřezu, v = výška průřezu */
  /* u, v nezávisí na tom, od kterého konce byl prut nakreslený: počítají se z „kanonického“ směru
     (nahoru, jinak +X, jinak +Y). Pro směr b − a proto u × v může mířit i proti ose – průřez je stejný. */
  function canonDir(a, b) {
    const x = norm(sub(b, a)), e = 1e-6;
    const flip = x[2] < -e || (Math.abs(x[2]) <= e && (x[0] < -e || (Math.abs(x[0]) <= e && x[1] < 0)));
    return flip ? mul(x, -1) : x;
  }
  function frame(a, b, roll) {
    const x = canonDir(a, b);
    let u, v;
    if (Math.abs(x[2]) > 0.999) { u = [1, 0, 0]; v = norm(cross(x, u)); }
    else { u = norm(cross([0, 0, 1], x)); v = cross(x, u); }
    const r = (roll || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const u2 = add(mul(u, c), mul(v, s)), v2 = add(mul(u, -s), mul(v, c));
    return { x, u: u2.map((q) => round(q, 6) + 0), v: v2.map((q) => round(q, 6) + 0) };
  }

  /* ---------- model ---------- */
  function emptyModel() {
    return { name: 'Nová skica', note: '', catalog: DEFAULT_CATALOG, members: [], plates: [], joints: {}, seq: 1 };
  }
  function nextId(model, pre) { const id = pre + model.seq; model.seq += 1; return id; }
  function addMember(model, prof, a, b, extra) {
    const m = Object.assign({ id: nextId(model, 'P'), prof, a: rp(a), b: rp(b), roll: 0, name: '', note: '', thru: false }, extra || {});
    model.members.push(m); return m;
  }
  function addPlate(model, p0, p1, z, t, mat, extra) {
    const pl = Object.assign({ id: nextId(model, 'D'), x0: round(Math.min(p0[0], p1[0])), y0: round(Math.min(p0[1], p1[1])), x1: round(Math.max(p0[0], p1[0])), y1: round(Math.max(p0[1], p1[1])), z: round(z), t: t || 20, mat: mat || 'dřevo', name: '', note: '' }, extra || {});
    model.plates.push(pl); return pl;
  }
  const mLen = (m) => len(sub(m.b, m.a));

  /* uzly: konce prutů (a body, kde konec leží uvnitř jiného prutu) */
  function nodes(model) {
    const map = {};
    model.members.forEach((m) => [m.a, m.b].forEach((p) => {
      const k = key(p);
      (map[k] = map[k] || { p: rp(p), ends: [], on: [] }).ends.push(m.id);
    }));
    Object.values(map).forEach((n) => {
      model.members.forEach((m) => {
        if (n.ends.includes(m.id)) return;
        const d = sub(m.b, m.a), L = len(d); if (L < 1e-6) return;
        const t = dot(sub(n.p, m.a), d) / (L * L);
        if (t <= 1e-4 || t >= 1 - 1e-4) return;
        if (len(sub(add(m.a, mul(d, t)), n.p)) < 0.6) n.on.push(m.id);
      });
    });
    return map;
  }

  function checks(model) {
    const out = [], cat = parseCatalog(model.catalog).byId;
    model.members.forEach((m) => {
      if (mLen(m) < 1) out.push({ lvl: 'bad', id: m.id, msg: m.id + ' má nulovou délku' });
      if (!cat[m.prof]) out.push({ lvl: 'warn', id: m.id, msg: m.id + ': profil „' + m.prof + '“ není v katalogu' });
    });
    for (let i = 0; i < model.members.length; i++) for (let j = i + 1; j < model.members.length; j++) {
      const A = model.members[i], B = model.members[j];
      const da = norm(sub(A.b, A.a)), db = norm(sub(B.b, B.a));
      if (Math.abs(Math.abs(dot(da, db)) - 1) > 1e-6) continue;
      const off = sub(B.a, A.a), perp = sub(off, mul(da, dot(off, da)));
      if (len(perp) > 0.6) continue;
      const La = mLen(A), t1 = dot(sub(B.a, A.a), da), t2 = dot(sub(B.b, A.a), da);
      const lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(La, Math.max(t1, t2));
      if (hi - lo > 1) out.push({ lvl: 'bad', id: B.id, msg: A.id + ' a ' + B.id + ' se překrývají v délce ' + Math.round(hi - lo) + ' mm' });
    }
    const N = nodes(model);
    Object.values(N).forEach((n) => {
      const j = model.joints[key(n.p)];
      if (j && j.type === 'pokos' && n.ends.length !== 2) out.push({ lvl: 'warn', msg: 'Pokos v uzlu [' + n.p.join(', ') + '] potřebuje právě 2 pruty, je jich ' + n.ends.length });
      if (j && j.type === 'tupo' && j.thru && !n.ends.concat(n.on).includes(j.thru)) out.push({ lvl: 'warn', msg: 'Průběžný prut ' + j.thru + ' v uzlu [' + n.p.join(', ') + '] tam nevede' });
    });
    return out;
  }

  /* ---------- kusovník ---------- */
  function bom(model) {
    const cat = parseCatalog(model.catalog).byId;
    const rows = {}, per = {};
    model.members.forEach((m) => {
      const L = Math.round(mLen(m)), k = m.prof + '|' + L;
      (rows[k] = rows[k] || { prof: m.prof, len: L, ks: 0, ids: [] }).ks += 1; rows[k].ids.push(m.id);
      const p = cat[m.prof];
      (per[m.prof] = per[m.prof] || { prof: m.prof, label: p ? profileLabel(p) : m.prof, m: 0, kg: 0, ks: 0 });
      per[m.prof].m += L / 1000; per[m.prof].ks += 1; per[m.prof].kg += p ? p.kgm * L / 1000 : 0;
    });
    const plates = model.plates.map((p) => ({ id: p.id, mat: p.mat, t: p.t, w: round(p.x1 - p.x0), d: round(p.y1 - p.y0) }));
    const list = Object.values(rows).sort((a, b) => a.prof.localeCompare(b.prof) || b.len - a.len);
    const tot = Object.values(per);
    const plech = model.plates.filter((p) => p.mat === 'plech').reduce((s, p) => s + (p.x1 - p.x0) * (p.y1 - p.y0) * p.t * 7.85e-6, 0);
    return { rows: list, per: tot.map((r) => Object.assign(r, { m: round(r.m, 2), kg: round(r.kg, 1) })), plates, kg: round(tot.reduce((s, r) => s + r.kg, 0) + plech, 1), m: round(tot.reduce((s, r) => s + r.m, 0), 2) };
  }

  function bounds(model) {
    const cat = parseCatalog(model.catalog).byId;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    const grow = (p, r) => p.forEach((c, i) => { mn[i] = Math.min(mn[i], c - r); mx[i] = Math.max(mx[i], c + r); });
    model.members.forEach((m) => {
      const p = cat[m.prof], [w, h] = p ? extent(p) : [0, 0], f = frame(m.a, m.b, m.roll);
      [m.a, m.b].forEach((q) => [-1, 1].forEach((su) => [-1, 1].forEach((sv) => grow(add(q, add(mul(f.u, su * w / 2), mul(f.v, sv * h / 2))), 0))));
    });
    model.plates.forEach((p) => { grow([p.x0, p.y0, p.z], 0); grow([p.x1, p.y1, p.z + p.t], 0); });
    if (!isFinite(mn[0])) return null;
    return { mn, mx, size: mx.map((x, i) => Math.round(x - mn[i])) };
  }

  /* ---------- úpravy ---------- */
  function move(model, ids, d, copy) {
    const out = [];
    model.members.filter((m) => ids.includes(m.id)).forEach((m) => {
      if (copy) out.push(addMember(model, m.prof, add(m.a, d), add(m.b, d), { roll: m.roll, name: m.name, note: m.note, thru: m.thru }).id);
      else { m.a = rp(add(m.a, d)); m.b = rp(add(m.b, d)); out.push(m.id); }
    });
    model.plates.filter((p) => ids.includes(p.id)).forEach((p) => {
      if (copy) out.push(addPlate(model, [p.x0 + d[0], p.y0 + d[1]], [p.x1 + d[0], p.y1 + d[1]], p.z + d[2], p.t, p.mat, { name: p.name, note: p.note }).id);
      else { p.x0 = round(p.x0 + d[0]); p.x1 = round(p.x1 + d[0]); p.y0 = round(p.y0 + d[1]); p.y1 = round(p.y1 + d[1]); p.z = round(p.z + d[2]); out.push(p.id); }
    });
    return out;
  }
  /* zrcadlení výběru podle roviny kolmé na osu ax (0 = X, 1 = Y) procházející c; kopie, duplicitní pruty se vynechají */
  function mirror(model, ids, ax, c) {
    const f = (p) => { const q = p.slice(); q[ax] = 2 * c - q[ax]; return q; };
    const have = new Set(model.members.map((m) => m.prof + '|' + [key(m.a), key(m.b)].sort().join('|')));
    const out = [];
    model.members.filter((m) => ids.includes(m.id)).forEach((m) => {
      const a = f(m.a), b = f(m.b), k = m.prof + '|' + [key(a), key(b)].sort().join('|');
      if (have.has(k)) return; have.add(k);
      out.push(addMember(model, m.prof, a, b, { roll: -m.roll, name: m.name, note: m.note, thru: m.thru }).id);
    });
    model.plates.filter((p) => ids.includes(p.id)).forEach((p) => {
      const a = f([p.x0, p.y0, p.z]), b = f([p.x1, p.y1, p.z]);
      if (Math.abs(a[ax] - [p.x0, p.y0][ax]) < 0.5 && Math.abs(b[ax] - [p.x1, p.y1][ax]) < 0.5) return;
      out.push(addPlate(model, a, b, p.z, p.t, p.mat, { name: p.name, note: p.note }).id);
    });
    return out;
  }
  function remove(model, ids) {
    model.members = model.members.filter((m) => !ids.includes(m.id));
    model.plates = model.plates.filter((p) => !ids.includes(p.id));
  }
  /* rozdělí prut v bodě p (ležícím na něm) na dva */
  function split(model, id, p) {
    const m = model.members.find((x) => x.id === id); if (!m) return null;
    const d = sub(m.b, m.a), L = len(d), t = dot(sub(p, m.a), d) / (L * L);
    if (t <= 0.001 || t >= 0.999) return null;
    const q = rp(add(m.a, mul(d, t))), b = m.b;
    m.b = q;
    return addMember(model, m.prof, q, b, { roll: m.roll, name: m.name, note: m.note, thru: m.thru }).id;
  }

  /* ---------- převod hotových modelů (podnože, umělecké) ----------
     A = výsledek Podnoze.build / Vyvoj.build. Jekly (parts) se převedou přesně podle své osy a průřezu,
     plechy a pásoviny (plateBoxes) přes hlavní osy tělesa: protáhlé → pásovina, ploché vodorovné → deska z plechu,
     protáhlé spojovací materiály (závitové tyče) → kulatina, matice a podložky se vynechají. Přidá se deska stolu. */
  function eig3(C) {
    const a = C.map((r) => r.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 50; it++) {
      let p = 0, q = 1;
      if (Math.abs(a[0][2]) > Math.abs(a[p][q])) { p = 0; q = 2; }
      if (Math.abs(a[1][2]) > Math.abs(a[p][q])) { p = 1; q = 2; }
      if (Math.abs(a[p][q]) < 1e-9) break;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
    }
    return [0, 1, 2].map((i) => ({ val: a[i][i], vec: norm([v[0][i], v[1][i], v[2][i]]) })).sort((x, y) => y.val - x.val);
  }
  function range(verts, d) { let lo = Infinity, hi = -Infinity; verts.forEach((p) => { const t = dot(p, d); if (t < lo) lo = t; if (t > hi) hi = t; }); return [lo, hi]; }
  function obb(verts) {
    const n = verts.length, c = [0, 1, 2].map((i) => verts.reduce((s, p) => s + p[i], 0) / n);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    verts.forEach((p) => { const d = sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j] / n; });
    const E = eig3(C).map((e) => e.vec);
    const R = E.map((e) => range(verts, e));
    return { axes: E, size: R.map((r) => r[1] - r[0]), center: [0, 1, 2].reduce((s, i) => add(s, mul(E[i], (R[i][0] + R[i][1]) / 2)), [0, 0, 0]), ranges: R };
  }
  function ensureProfile(model, id) {
    const p = parseProfile(id); if (!p) return null;
    if (!parseCatalog(model.catalog).byId[p.id]) model.catalog = model.catalog.replace(/\s*$/, '') + '\n' + p.id;
    return p;
  }
  /* prut z tělesa ve známém směru osy x: najde natočení, při kterém šířka profilu sedí na těleso */
  function memberFromBody(model, prof, verts, x, hint, extra) {
    const p0 = [0, 0, 0], f = frame(p0, x, 0), [w, h] = extent(prof);
    const cands = [];
    const th0 = hint ? Math.atan2(dot(hint, f.v), dot(hint, f.u)) * 180 / Math.PI : 0;
    [th0, th0 + 90].forEach((r) => {
      const g = frame(p0, x, r), eu = range(verts, g.u), ev = range(verts, g.v);
      cands.push({ r, g, eu, ev, err: Math.abs(eu[1] - eu[0] - w) + Math.abs(ev[1] - ev[0] - h) });
    });
    const b = cands.sort((m, n) => m.err - n.err)[0], ex = range(verts, f.x);
    const base = add(mul(b.g.u, (b.eu[0] + b.eu[1]) / 2), mul(b.g.v, (b.ev[0] + b.ev[1]) / 2));
    const roll = ((Math.round(b.r) % 180) + 180) % 180;
    return addMember(model, prof.id, add(base, mul(f.x, ex[0])), add(base, mul(f.x, ex[1])), Object.assign({ roll }, extra || {}));
  }
  /* plochý svařenec z pásoviny na hranu (trojúhelník, kosočtverec): obrys → pásoviny po hranách */
  function hull2(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    P.forEach((p) => { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); });
    P.slice().reverse().forEach((p) => { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function ringToMembers(model, verts, O) {
    const [e1, e2, e3] = O.axes, mid = (O.ranges[2][0] + O.ranges[2][1]) / 2;
    const pts = verts.map((p) => [dot(p, e1), dot(p, e2)]);
    let H = hull2(pts);
    /* sloučit téměř rovnoběžné hrany (zkosené rohy) */
    const keep = [];
    H.forEach((p, i) => {
      const a = H[(i - 1 + H.length) % H.length], b = H[(i + 1) % H.length];
      const d1 = norm([p[0] - a[0], p[1] - a[1], 0]), d2 = norm([b[0] - p[0], b[1] - p[1], 0]);
      if (dot(d1, d2) < 0.996 && Math.hypot(p[0] - a[0], p[1] - a[1]) > 1) keep.push(p);
    });
    H = keep;
    if (H.length < 3) return false;
    const edges = [];
    for (let i = 0; i < H.length; i++) {
      const a = H[i], b = H[(i + 1) % H.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 20) continue;
      const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-d[1], d[0]];   // hull je proti směru hodin → n míří dovnitř
      let t = Infinity;
      pts.forEach((p) => {
        const s = (p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1], q = (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];
        if (s > 0 && s < L && q > 0.5 && q < t) t = q;
      });
      edges.push({ a, b, d, n, t, L });
    }
    const minSpan = Math.min(O.size[0], O.size[1]);
    if (!edges.length || edges.some((e) => !isFinite(e.t) || e.t > 0.35 * minSpan)) return false;
    const T = Math.round(edges.map((e) => e.t).sort((x, y) => x - y)[Math.floor(edges.length / 2)]);
    const pr = ensureProfile(model, 'pas ' + Math.round(O.size[2]) + 'x' + Math.max(1, T)); if (!pr) return false;
    const P3 = (u, v) => add(add(mul(e1, u), mul(e2, v)), mul(e3, mid));
    edges.forEach((e) => {
      const o = [e.n[0] * T / 2, e.n[1] * T / 2];
      const A = P3(e.a[0] + o[0], e.a[1] + o[1]), B = P3(e.b[0] + o[0], e.b[1] + o[1]);
      const f = frame(A, B, 0), r = Math.atan2(dot(e3, f.v), dot(e3, f.u)) * 180 / Math.PI;
      addMember(model, pr.id, A, B, { roll: ((Math.round(r) % 180) + 180) % 180, name: 'pásovina na hranu' });
    });
    return true;
  }
  function importBuild(model, A, opt) {
    const o = opt || {}, cfg = A.cfg || {}, added = [], skipped = [];
    const before = new Set(model.members.map((m) => m.id).concat(model.plates.map((p) => p.id)));
    const defProf = 'jekl ' + (cfg.size || 40) + 'x' + (cfg.size || 40) + 'x' + (cfg.t || 2);
    (A.parts || []).forEach((pt) => {
      const verts = pt.solid && pt.solid.verts; if (!verts || !verts.length || !pt.m) return;
      const prof = ensureProfile(model, (pt.prof || defProf).replace(/×/g, 'x')) || ensureProfile(model, defProf);
      const x = norm(sub(pt.m.p2, pt.m.p1)); if (len(x) < 0.5) return;
      memberFromBody(model, prof, verts, x, pt.m.w, { name: (pt.name || '').toLowerCase() });
    });
    const bodies = (A.plateBoxes || []).map((b) => ({ b, hw: false })).concat((A.hwBodies || []).map((b) => ({ b, hw: true })));
    bodies.forEach(({ b, hw }) => {
      const verts = b.verts; if (!verts || verts.length < 4) return;
      const O = obb(verts), [L1, L2, L3] = O.size;
      if (hw) {
        if (L1 < 3 * L2) return;                       // matice, podložky
        const pr = ensureProfile(model, 'kulatina ' + Math.round(L2));
        memberFromBody(model, pr, verts, O.axes[0], null, { name: 'závitová tyč' });
        return;
      }
      if (L1 < 2.5 * L2 && Math.abs(O.axes[2][2]) > 0.95) {
        const R = [0, 1].map((i) => range(verts, i === 0 ? [1, 0, 0] : [0, 1, 0])), z = range(verts, [0, 0, 1]);
        addPlate(model, [R[0][0], R[1][0]], [R[0][1], R[1][1]], z[0], Math.max(1, round(z[1] - z[0])), 'plech', { name: 'plech' });
        return;
      }
      if (L3 < 0.5) { skipped.push('těleso bez tloušťky'); return; }
      if (L1 < 2.5 * L2 && ringToMembers(model, verts, O)) return;
      const pr = ensureProfile(model, 'pas ' + Math.round(L2) + 'x' + Math.max(1, Math.round(L3)));
      if (!pr) { skipped.push('nerozpoznané těleso'); return; }
      memberFromBody(model, pr, verts, O.axes[0], O.axes[1], { name: 'pásovina' });
    });
    if (o.desk !== false && cfg.td > 0 && cfg.H > 0) {
      const dl = cfg.dL || cfg.L, dw = cfg.dW || cfg.W;
      if (dl > 0 && dw > 0) addPlate(model, [-dl / 2, -dw / 2], [dl / 2, dw / 2], cfg.H - cfg.td, cfg.td, 'dřevo', { name: 'deska' });
    }
    model.members.concat(model.plates).forEach((x) => { if (!before.has(x.id)) added.push(x.id); });
    return { added, skipped };
  }

  /* ---------- export / import ---------- */
  const JOINT_LAB = { pokos: 'pokos', tupo: 'na tupo (průběžný prut)', plny: 'plný roh (prodloužit o půl profilu a zavařit)', zamek: 'zámečky / drážka', sroub: 'šroubovaný' };

  function exportJSON(model) {
    const cat = parseCatalog(model.catalog), used = {};
    model.members.forEach((m) => { used[m.prof] = 1; });
    const N = nodes(model);
    const uzly = Object.values(N).filter((n) => n.ends.length > 1 || n.on.length || model.joints[key(n.p)]).map((n) => {
      const j = model.joints[key(n.p)] || {};
      const o = { bod: n.p, konce_prutu: n.ends };
      if (n.on.length) o.lezi_na = n.on;
      if (j.type) o.spoj = j.type;
      if (j.thru) o.prubezny = j.thru;
      if (j.note) o.poznamka = j.note;
      return o;
    });
    const B = bounds(model), K = bom(model);
    return {
      format: 'arkeas-skica', verze: 1, jednotky: 'mm',
      nazev: model.name, poznamka: model.note || '',
      konvence: 'Z nahoru. Body a/b jsou osy prutů = střed obrysu průřezu. u = směr první míry profilu (šířka), v = směr druhé míry (výška/tloušťka). Pruty se v uzlech potkávají jen osami – styky, zkrácení, pokosy, zámečky a otvory nejsou vyřešené. Desky leží spodní plochou ve výšce z.',
      rozmery: B ? { x: B.size[0], y: B.size[1], z: B.size[2] } : null,
      profily: Object.keys(used).map((id) => { const p = cat.byId[id]; return p ? Object.assign({ id, nazev: profileLabel(p) }, p) : { id, nazev: id, neznamy: true }; }),
      pruty: model.members.map((m) => {
        const f = frame(m.a, m.b, m.roll);
        const o = { id: m.id, profil: m.prof, a: m.a, b: m.b, delka_osy: round(mLen(m)), u: f.u, v: f.v, natoceni: m.roll || 0 };
        if (m.name) o.nazev = m.name;
        if (m.thru) o.prubezny = true;
        if (m.note) o.poznamka = m.note;
        return o;
      }),
      desky: model.plates.map((p) => {
        const o = { id: p.id, material: p.mat, tloustka: p.t, x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, z: p.z };
        if (p.name) o.nazev = p.name; if (p.note) o.poznamka = p.note;
        return o;
      }),
      uzly,
      kusovnik: { pruty: K.rows.map((r) => ({ profil: r.prof, delka_osy: r.len, ks: r.ks, id: r.ids })), celkem: K.per, hmotnost_kg: K.kg },
      upozorneni: checks(model).map((c) => c.msg),
      katalog: cat.list.map((p) => p.id)
    };
  }

  function importJSON(obj) {
    const m = emptyModel();
    if (!obj || typeof obj !== 'object') throw new Error('Soubor není skica.');
    if (obj.format !== 'arkeas-skica') throw new Error('Soubor není skica ze skicáře (chybí format: arkeas-skica).');
    m.name = obj.nazev || m.name; m.note = obj.poznamka || '';
    if (Array.isArray(obj.katalog) && obj.katalog.length) m.catalog = obj.katalog.join('\n');
    const known = parseCatalog(m.catalog).byId;
    (obj.profily || []).forEach((p) => { if (!known[p.id] && parseProfile(p.id)) { m.catalog += '\n' + p.id; known[p.id] = 1; } });
    let mx = 0;
    const num = (id) => { const n = parseInt(String(id).replace(/\D/g, ''), 10); if (n > mx) mx = n; };
    (obj.pruty || []).forEach((p) => { num(p.id); m.members.push({ id: p.id, prof: p.profil, a: rp(p.a), b: rp(p.b), roll: p.natoceni || 0, name: p.nazev || '', note: p.poznamka || '', thru: !!p.prubezny }); });
    (obj.desky || []).forEach((p) => { num(p.id); m.plates.push({ id: p.id, x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, z: p.z, t: p.tloustka, mat: p.material || 'dřevo', name: p.nazev || '', note: p.poznamka || '' }); });
    (obj.uzly || []).forEach((u) => { if (u.spoj || u.prubezny || u.poznamka) m.joints[key(u.bod)] = { type: u.spoj || '', thru: u.prubezny || '', note: u.poznamka || '' }; });
    m.seq = mx + 1;
    return m;
  }

  function aiText(model) {
    const J = exportJSON(model);
    return [
      'Skica svařované konstrukce ze Skicáře (arkeas93): ' + J.nazev + (J.rozmery ? ' – obrys ' + J.rozmery.x + ' × ' + J.rozmery.y + ' × ' + J.rozmery.z + ' mm' : '') + '.',
      J.poznamka ? 'Poznámka kreslíře: ' + J.poznamka : '',
      'Je to náčrt, ne výrobní model: pruty jsou zadané osami (střed obrysu průřezu), v uzlech se jen potkávají. Postav ji ve FreeCADu (makro freecad/skica_import.py z repa arkeas93 načte tento JSON), pak doplň styky – zkrácení o profil, pokosy, zámečky podle pravidel dílny – a výrobní podklady. Spoj v uzlu je záměr kreslíře, „lezi_na“ znamená T-spoj na průběžný prut. Rozměry ber jako zadání, nesrovnalosti a upozornění napiš, než začneš.',
      '',
      '```json',
      JSON.stringify(J, null, 1),
      '```'
    ].filter((x, i) => x !== '' || i === 3).join('\n');
  }

  const API = {
    DEFAULT_CATALOG, TYPES, parseProfile, parseCatalog, profileLabel, extent, section, area,
    sub, add, mul, dot, cross, len, norm, round, key, frame,
    emptyModel, addMember, addPlate, mLen, nodes, checks, bom, bounds, move, mirror, remove, split,
    importBuild, obb, JOINT_LAB, exportJSON, importJSON, aiText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SkicaCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
