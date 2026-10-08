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

  /* ---------- šablony ---------- */
  const TEMPLATES = [
    {
      id: 'stul', lab: 'Stůl', sub: 'rám pod deskou + 4 nohy',
      params: [{ k: 'L', lab: 'Délka', def: 1600 }, { k: 'W', lab: 'Šířka', def: 800 }, { k: 'H', lab: 'Výška', def: 750 }, { k: 'T', lab: 'Deska', def: 40 }, { k: 'O', lab: 'Přesah desky', def: 50 }],
      profs: [{ k: 'leg', lab: 'Nohy', def: 'jekl 60x60x3' }, { k: 'rail', lab: 'Rám', def: 'jekl 40x40x2' }],
      build(m, P, cat) {
        const s = Math.max(...extent(cat[P.leg] || { a: 40, b: 40 })), r = extent(cat[P.rail] || { a: 40, b: 40 })[1];
        const x0 = P.O + s / 2, x1 = P.L - P.O - s / 2, y0 = P.O + s / 2, y1 = P.W - P.O - s / 2, zt = P.H - P.T - r / 2;
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y]) => addMember(m, P.leg, [x, y, 0], [x, y, zt], { name: 'noha' }));
        addMember(m, P.rail, [x0, y0, zt], [x1, y0, zt], { name: 'rám podélný' }); addMember(m, P.rail, [x0, y1, zt], [x1, y1, zt], { name: 'rám podélný' });
        addMember(m, P.rail, [x0, y0, zt], [x0, y1, zt], { name: 'rám příčný' }); addMember(m, P.rail, [x1, y0, zt], [x1, y1, zt], { name: 'rám příčný' });
        if (P.T > 0) addPlate(m, [0, 0], [P.L, P.W], P.H - P.T, P.T, 'dřevo', { name: 'deska' });
      }
    },
    {
      id: 'stolek', lab: 'Konferenční stolek', sub: 'horní a spodní rám, polička',
      params: [{ k: 'L', lab: 'Délka', def: 1000 }, { k: 'W', lab: 'Šířka', def: 600 }, { k: 'H', lab: 'Výška', def: 450 }, { k: 'T', lab: 'Deska', def: 10 }, { k: 'Z', lab: 'Spodní rám', def: 120 }],
      profs: [{ k: 'tube', lab: 'Jekl', def: 'jekl 30x30x2' }],
      build(m, P, cat) {
        const s = Math.max(...extent(cat[P.tube] || { a: 30, b: 30 }));
        const x0 = s / 2, x1 = P.L - s / 2, y0 = s / 2, y1 = P.W - s / 2, zt = P.H - P.T - s / 2, zb = P.Z;
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y]) => addMember(m, P.tube, [x, y, 0], [x, y, zt], { name: 'noha' }));
        [zt, zb].forEach((z) => {
          addMember(m, P.tube, [x0, y0, z], [x1, y0, z], { name: 'podélný' }); addMember(m, P.tube, [x0, y1, z], [x1, y1, z], { name: 'podélný' });
          addMember(m, P.tube, [x0, y0, z], [x0, y1, z], { name: 'příčný' }); addMember(m, P.tube, [x1, y0, z], [x1, y1, z], { name: 'příčný' });
        });
        if (P.T > 0) addPlate(m, [0, 0], [P.L, P.W], P.H - P.T, P.T, 'sklo', { name: 'deska' });
        addPlate(m, [x0, y0], [x1, y1], zb + s / 2, 18, 'dřevo', { name: 'polička' });
      }
    },
    {
      id: 'policka', lab: 'Polička / regál', sub: '2 bočnice žebříky + police',
      params: [{ k: 'L', lab: 'Šířka', def: 900 }, { k: 'D', lab: 'Hloubka', def: 300 }, { k: 'H', lab: 'Výška', def: 1800 }, { k: 'N', lab: 'Polic', def: 5 }, { k: 'T', lab: 'Police tl.', def: 25 }],
      profs: [{ k: 'tube', lab: 'Bočnice', def: 'jekl 30x30x2' }, { k: 'bar', lab: 'Nosníky polic', def: 'L 30x30x3' }],
      build(m, P, cat) {
        const s = Math.max(...extent(cat[P.tube] || { a: 30, b: 30 })), hb = extent(cat[P.bar] || { a: 30, b: 30 })[1];
        const n = Math.max(2, Math.round(P.N)), y0 = s / 2, y1 = P.D - s / 2, z0 = 0;
        const zt = P.H - s / 2, zs = [];
        for (let i = 0; i < n; i++) zs.push(Math.round(80 + (zt - 80) * i / (n - 1)));
        [s / 2, P.L - s / 2].forEach((x) => {
          addMember(m, P.tube, [x, y0, z0], [x, y0, P.H - s / 2], { name: 'bočnice noha' }); addMember(m, P.tube, [x, y1, z0], [x, y1, P.H - s / 2], { name: 'bočnice noha' });
          zs.forEach((z) => addMember(m, P.tube, [x, y0, z], [x, y1, z], { name: 'příčka bočnice' }));
        });
        zs.forEach((z) => {
          addMember(m, P.bar, [s / 2, y0, z], [P.L - s / 2, y0, z], { name: 'nosník police' }); addMember(m, P.bar, [s / 2, y1, z], [P.L - s / 2, y1, z], { name: 'nosník police' });
          if (P.T > 0) addPlate(m, [0, 0], [P.L, P.D], z + hb / 2, P.T, 'dřevo', { name: 'police' });
        });
      }
    },
    {
      id: 'zabradli', lab: 'Zábradlí rovné', sub: 'rám, sloupky a špruše',
      params: [{ k: 'L', lab: 'Délka', def: 3000 }, { k: 'H', lab: 'Výška', def: 1000 }, { k: 'S', lab: 'Rozteč sloupků', def: 1200 }, { k: 'G', lab: 'Rozteč špruší', def: 120 }, { k: 'Z', lab: 'Spodní rám', def: 100 }],
      profs: [{ k: 'rail', lab: 'Rám a sloupky', def: 'jekl 40x40x2' }, { k: 'bar', lab: 'Špruše', def: 'pas 40x5' }],
      build(m, P, cat) {
        const s = Math.max(...extent(cat[P.rail] || { a: 40, b: 40 }));
        const zt = P.H - s / 2, zb = P.Z, x0 = s / 2, x1 = P.L - s / 2;
        addMember(m, P.rail, [x0, 0, zt], [x1, 0, zt], { name: 'madlo / horní rám' }); addMember(m, P.rail, [x0, 0, zb], [x1, 0, zb], { name: 'spodní rám' });
        const np = Math.max(1, Math.ceil((x1 - x0) / P.S)), posts = [];
        for (let i = 0; i <= np; i++) posts.push(Math.round(x0 + (x1 - x0) * i / np));
        posts.forEach((x) => addMember(m, P.rail, [x, 0, 0], [x, 0, zt], { name: 'sloupek' }));
        for (let i = 0; i < np; i++) {
          const a = posts[i] + s / 2, b = posts[i + 1] - s / 2, k = Math.max(1, Math.round((b - a) / P.G));
          for (let j = 1; j < k; j++) { const x = Math.round(a + (b - a) * j / k); addMember(m, P.bar, [x, 0, zb], [x, 0, zt], { name: 'špruše' }); }
        }
      }
    }
  ];
  function applyTemplate(model, tid, P) {
    const t = TEMPLATES.find((x) => x.id === tid); if (!t) return [];
    const before = new Set(model.members.map((m) => m.id).concat(model.plates.map((p) => p.id)));
    const cat = parseCatalog(model.catalog).byId;
    const Q = {}; t.params.forEach((p) => { Q[p.k] = Number(P && P[p.k] != null ? P[p.k] : p.def); }); t.profs.forEach((p) => { Q[p.k] = (P && P[p.k]) || p.def; });
    t.build(model, Q, cat);
    return model.members.map((m) => m.id).concat(model.plates.map((p) => p.id)).filter((id) => !before.has(id));
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
    TEMPLATES, applyTemplate, JOINT_LAB, exportJSON, importJSON, aiText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SkicaCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
