/* Ptačí věšáky: rozložení na stěně – čistá logika (obrys, kolize, rozmístění) a kreslení SVG.
   Souřadnice na stěně: mm, počátek vlevo dole, x doprava, y nahoru. Poloha kusu = kotvící bod
   (horní střed jazýčku, kde se věšák připevňuje), shodný s `anchor` z assets/ptaci/artwork.js. */
(function (root) {
  'use strict';
  const GAP = 15;          // doporučený minimální odstup mezi ptáky [mm]
  const OVERLAP = 2;       // pod touto vzdáleností se kusy považují za překrývající (nelze vyrobit/pověsit)
  const MARGIN = 20;       // minimální odstup od okraje stěny [mm]
  const STEP = 5;          // mřížka přichytávání [mm]
  const WALLS = {
    light: ['Světlá omítka', '#eeece6'], cream: ['Béžová', '#e3d8c3'], grey: ['Šedá', '#b7bcc0'],
    dark: ['Tmavě šedá', '#3d4247'], brick: ['Cihla', '#9b5a49']
  };
  const COLORS = { black: '#242629', anth: '#41474e', white: '#e8e8e3', raw: '#827d74' };
  const cache = {};

  function core() { return root.Ptaci || (typeof require === 'function' ? require('./ptaci-core.js') : null); }
  function artwork() { return root.PtaciArtwork || null; }

  /* ---------- geometrie ---------- */
  function hull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    p.forEach((q) => { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  // Zjednoduší konvexní obrys na nejvýš `max` vrcholů odebíráním vrcholů s nejmenším trojúhelníkem (odchylka v řádu desetin mm).
  function simplify(h, max) {
    const p = h.slice();
    while (p.length > max) {
      let bi = 0, ba = Infinity;
      for (let i = 0; i < p.length; i++) {
        const a = p[(i + p.length - 1) % p.length], b = p[i], c = p[(i + 1) % p.length];
        const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
        if (area < ba) { ba = area; bi = i; }
      }
      p.splice(bi, 1);
    }
    return p;
  }
  // Obrys kusu na stěně vzhledem ke kotvícímu bodu: části siluety + rovná část jazýčku (háček pak vystupuje ze stěny).
  function footprint(art, pose) {
    const key = pose;
    const A = art || artwork();
    if (!A) throw new Error('Chybí obrysy ptáků (assets/ptaci/artwork.js).');
    if (A._fp && A._fp[key]) return A._fp[key];
    const b = A.birds[pose], [ax, ay] = b.anchor, P = A.params, w = P.tongue_w / 2;
    const bottom = A.tongue.s[0] + P.ri + P.t;                          // spodní okraj jazýčku na zdi (vnější strana prvního ohybu)
    const tongue = [[-w, 0], [w, 0], [w, -bottom], [-w, -bottom]];
    const rel = b.parts.map((poly) => poly.map(([x, y]) => [x - ax, y - ay]));
    const all = rel.concat([tongue]);
    const xs = [], ys = [];
    all.forEach((poly) => poly.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
    const fp = {
      pose, rel, tongue, hulls: all.map((poly) => simplify(hull(poly), 16)),
      bbox: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
      anchor: [ax, ay], tongueW: P.tongue_w, tongueBottom: bottom
    };
    // cache vážeme na objekt artwork (v testech může být víc kopií)
    Object.defineProperty(A, '_fp', { value: A._fp || {}, enumerable: false, writable: true });
    A._fp[key] = fp; return fp;
  }
  function segDist(a, b, c, d) {
    const cr = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    const ps = (p, s, e) => { const dx = e[0] - s[0], dy = e[1] - s[1], l = dx * dx + dy * dy; let t = l ? ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - s[0] - t * dx, p[1] - s[1] - t * dy); };
    return Math.min(ps(a, c, d), ps(b, c, d), ps(c, a, b), ps(d, a, b));
  }
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // Vzdálenost dvou konvexních obrysů (0 = překrývají se).
  function hullDistance(A, B, dx, dy) {
    const Bs = B.map(([x, y]) => [x + dx, y + dy]);
    if (A.length < 3 || Bs.length < 3) return Infinity;
    if (inside(Bs[0], A) || inside(A[0], Bs)) return 0;
    let best = Infinity;
    for (let i = 0; i < A.length; i++) {
      const a = A[i], b = A[(i + 1) % A.length];
      for (let j = 0; j < Bs.length; j++) { const d = segDist(a, b, Bs[j], Bs[(j + 1) % Bs.length]); if (d < best) { best = d; if (best === 0) return 0; } }
    }
    return best;
  }
  const hbox = (h) => { const xs = h.map((v) => v[0]), ys = h.map((v) => v[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
  // Vzdálenost dvou kusů. S `limit` stačí vědět, že je alespoň `limit` – pak vrací hodnotu ≥ limit bez přesného výpočtu.
  function pieceDistance(art, p, q, limit) {
    const f = footprint(art, p.pose), g = footprint(art, q.pose), dx = q.x - p.x, dy = q.y - p.y;
    // rychlé vyloučení podle obdélníků
    const gx = Math.max(f.bbox.minX, g.bbox.minX + dx) - Math.min(f.bbox.maxX, g.bbox.maxX + dx);
    const gy = Math.max(f.bbox.minY, g.bbox.minY + dy) - Math.min(f.bbox.maxY, g.bbox.maxY + dy);
    const lim = limit == null ? Infinity : limit;
    if (Math.max(gx, gy) >= lim) return Math.max(gx, gy);
    if (!f.hb) { f.hb = f.hulls.map(hbox); }
    let best = Infinity;
    for (let i = 0; i < f.hulls.length; i++) for (let j = 0; j < g.hulls.length; j++) {
      if (!g.hb) g.hb = g.hulls.map(hbox);
      const a = f.hb[i], b = g.hb[j];
      const bgx = Math.max(a[0], b[0] + dx) - Math.min(a[1], b[1] + dx), bgy = Math.max(a[2], b[2] + dy) - Math.min(a[3], b[3] + dy);
      if (Math.max(bgx, bgy) >= Math.min(lim, best)) continue;
      const d = hullDistance(f.hulls[i], g.hulls[j], dx, dy); if (d < best) best = d; if (best === 0) return 0;
    }
    return best === Infinity ? lim : best;
  }
  // Dvojice kusů, které jsou blíž než `gap` (výchozí doporučený odstup).
  function collisions(layout, art, gap) {
    const g = gap == null ? GAP : gap, pcs = layout.pieces, out = [];
    for (let i = 0; i < pcs.length; i++) for (let j = i + 1; j < pcs.length; j++) { const d = pieceDistance(art, pcs[i], pcs[j], g); if (d < g) out.push({ a: i, b: j, distance: Math.round(d * 10) / 10 }); }
    return out;
  }
  function bounds(art, piece) {
    const b = footprint(art, piece.pose).bbox;
    return { minX: piece.x + b.minX, maxX: piece.x + b.maxX, minY: piece.y + b.minY, maxY: piece.y + b.maxY };
  }
  // Kusy vyčnívající mimo stěnu (s odstupem MARGIN od okraje).
  function outside(layout, art) {
    return layout.pieces.map((p, i) => { const b = bounds(art, p); return b.minX < MARGIN - 0.01 || b.minY < MARGIN - 0.01 || b.maxX > layout.wall.w - MARGIN + 0.01 || b.maxY > layout.wall.h - MARGIN + 0.01 ? i : -1; }).filter((i) => i >= 0);
  }
  function clampPiece(art, piece, wall) {
    const b = footprint(art, piece.pose).bbox;
    const lo = (m, w, bm, bM) => { const a = Math.ceil(MARGIN - bm), z = Math.floor(w - MARGIN - bM); return a <= z ? [a, z] : [Math.round((a + z) / 2), Math.round((a + z) / 2)]; };
    const [x0, x1] = lo('x', wall.w, b.minX, b.maxX), [y0, y1] = lo('y', wall.h, b.minY, b.maxY);
    return Object.assign({}, piece, { x: Math.min(x1, Math.max(x0, Math.round(piece.x))), y: Math.min(y1, Math.max(y0, Math.round(piece.y))) });
  }
  const snap = (v) => Math.round(v / STEP) * STEP;

  /* ---------- úpravy rozložení (vrací nový objekt) ---------- */
  function emptyLayout() { const L = core().WALL_LIMITS; return { wall: { w: L.defaultW, h: L.defaultH }, pieces: [] }; }
  // Najde první volné místo (shora zleva); když není, vrátí pozici u horního levého rohu.
  function findFree(layout, art, pose) {
    const f = footprint(art, pose), W = layout.wall.w, H = layout.wall.h, probe = { pose, finish: 'black', x: 0, y: 0 };
    const x0 = MARGIN - f.bbox.minX, x1 = W - MARGIN - f.bbox.maxX, y0 = MARGIN - f.bbox.minY, y1 = H - MARGIN - f.bbox.maxY;
    if (x1 < x0 || y1 < y0) return clampPiece(art, probe, layout.wall);
    const step = 20;
    for (let y = Math.floor(y1); y >= y0; y -= step) for (let x = Math.ceil(x0); x <= x1; x += step) {
      probe.x = Math.ceil(x / STEP) * STEP; probe.y = Math.floor(y / STEP) * STEP;
      if (probe.x > x1 || probe.y < y0) continue;
      if (layout.pieces.every((q) => pieceDistance(art, probe, q, GAP) >= GAP)) return { x: probe.x, y: probe.y };
    }
    return null;
  }
  function addPiece(layout, art, pose, finish) {
    const L = core().WALL_LIMITS;
    if (layout.pieces.length >= L.maxPieces) return { layout, added: false, reason: 'max' };
    const pos = findFree(layout, art, pose);
    if (!pos) return { layout, added: false, reason: 'full' };
    return { layout: Object.assign({}, layout, { pieces: layout.pieces.concat([{ pose, finish, x: pos.x, y: pos.y }]) }), added: true };
  }
  // Rovnoměrné rozmístění do řad podle poměru stran stěny; liché sloupce mírně posunuté, ať to vypadá jako hejno.
  function arrange(layout, art) {
    const n = layout.pieces.length; if (!n) return layout;
    const W = layout.wall.w, H = layout.wall.h;
    const cols = Math.min(n, Math.max(1, Math.round(Math.sqrt(n * W / H)))), rows = Math.ceil(n / cols);
    const cw = W / cols, ch = H / rows;
    const pieces = layout.pieces.map((p, i) => {
      const r = Math.floor(i / cols), c = i % cols, bb = footprint(art, p.pose).bbox;
      const inRow = Math.min(cols, n - r * cols), off = (cols - inRow) * cw / 2;      // poslední řadu vycentrovat
      const stagger = rows > 1 || cols > 1 ? (c % 2 ? -1 : 1) * Math.min(ch * 0.1, 40) : 0;
      const cx = off + (c + 0.5) * cw, cy = H - (r + 0.5) * ch + stagger;
      return clampPiece(art, { pose: p.pose, finish: p.finish, x: snap(cx - (bb.minX + bb.maxX) / 2), y: snap(cy - (bb.minY + bb.maxY) / 2) }, layout.wall);
    });
    return Object.assign({}, layout, { pieces });
  }
  function status(layout, art) {
    const hit = collisions(layout, art, GAP), overlap = hit.filter((h) => h.distance < OVERLAP), out = outside(layout, art);
    const errors = [];
    if (overlap.length) errors.push('Někteří ptáci se překrývají – odtáhněte je od sebe.');
    if (out.length) errors.push('Někteří ptáci jsou mimo stěnu nebo příliš u okraje.');
    return { close: hit, overlap, outside: out, errors, ok: errors.length === 0 };
  }

  /* ---------- SVG ---------- */
  const f1 = (n) => Math.round(n * 10) / 10;
  function partPath(poly) { return 'M' + poly.map(([x, y]) => f1(x) + ' ' + f1(y)).join('L') + 'Z'; }
  function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // Obrázek stěny. opts: { selected, wall: klíč barvy, art, labels }
  function svg(layout, opts) {
    const o = opts || {}, art = o.art || artwork(), W = layout.wall.w, H = layout.wall.h, pad = Math.max(W, H) * 0.06;
    const wallColor = (WALLS[o.wall] || WALLS.light)[1], dark = o.wall === 'dark' || o.wall === 'brick';
    const fs = Math.max(W, H) / 45, ink = dark ? '#f1f1ef' : '#4b535a';
    const st = status(layout, art), bad = new Set(st.overlap.flatMap((h) => [h.a, h.b]).concat(st.outside)), near = new Set(st.close.flatMap((h) => [h.a, h.b]));
    let grid = '';
    for (let x = 100; x < W; x += 100) grid += 'M' + x + ' 0V' + H;
    for (let y = 100; y < H; y += 100) grid += 'M0 ' + y + 'H' + W;
    const pcs = layout.pieces.map((p, i) => {
      const f = footprint(art, p.pose), fill = COLORS[p.finish] || COLORS.black, cls = 'bird' + (bad.has(i) ? ' bad' : near.has(i) ? ' near' : '') + (o.selected === i ? ' sel' : '');
      const stroke = p.finish === 'white' ? ' stroke="#9a9a94" stroke-width="0.8"' : '';
      return '<g class="' + cls + '" data-i="' + i + '" transform="translate(' + p.x + ' ' + p.y + ')" filter="url(#sh)"><g fill="' + fill + '"' + stroke + '>' +
        f.rel.map((poly) => '<path d="' + partPath(poly) + '"/>').join('') +
        '<rect x="' + (-f.tongueW / 2) + '" y="' + (-f.tongueBottom) + '" width="' + f.tongueW + '" height="' + f.tongueBottom + '"/></g>' +
        '<circle r="2.6" fill="' + (p.finish === 'white' ? '#a34d39' : '#e9b44c') + '"/>' +
        '<rect class="hit" x="' + f1(f.bbox.minX) + '" y="' + f1(f.bbox.minY) + '" width="' + f1(f.bbox.maxX - f.bbox.minX) + '" height="' + f1(f.bbox.maxY - f.bbox.minY) + '" fill="transparent"/></g>';
    }).join('');
    const nums = o.labels === false ? '' : layout.pieces.map((p, i) => {
      const b = footprint(art, p.pose).bbox;
      return '<text x="' + f1(p.x + (b.minX + b.maxX) / 2) + '" y="' + f1(H - (p.y + b.maxY) - fs * 0.35) + '" font-size="' + f1(fs * 0.8) + '" text-anchor="middle" fill="' + ink + '" pointer-events="none">' + (i + 1) + '</text>';
    }).join('');
    const rulerX = W - 100 - 15, rulerY = H - 15;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f1(-pad) + ' ' + f1(-pad) + ' ' + f1(W + 2 * pad) + ' ' + f1(H + 2 * pad) + '" role="img" aria-label="Rozložení ptáků na stěně ' + W + ' × ' + H + ' mm" preserveAspectRatio="xMidYMid meet">' +
      '<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="2" dy="-3" stdDeviation="2.5" flood-color="#000" flood-opacity="' + (dark ? '0.5' : '0.28') + '"/></filter></defs>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + wallColor + '" stroke="' + (dark ? '#888' : '#8b949b') + '" stroke-width="1.5" data-wall="1"/>' +
      '<g transform="translate(0 ' + H + ') scale(1 -1)"><path d="' + grid + '" stroke="' + (dark ? '#ffffff' : '#000000') + '" stroke-opacity="0.07" stroke-width="0.8" fill="none" pointer-events="none"/>' + pcs + '</g>' + nums +
      '<text x="' + W / 2 + '" y="' + f1(-pad * 0.35) + '" font-size="' + f1(fs) + '" text-anchor="middle" fill="#697179">' + W + ' mm</text>' +
      '<text transform="translate(' + f1(-pad * 0.35) + ' ' + H / 2 + ') rotate(-90)" font-size="' + f1(fs) + '" text-anchor="middle" fill="#697179">' + H + ' mm</text>' +
      '<g pointer-events="none"><path d="M' + rulerX + ' ' + rulerY + 'h100" stroke="' + ink + '" stroke-width="2"/><path d="M' + rulerX + ' ' + (rulerY - 5) + 'v10M' + (rulerX + 100) + ' ' + (rulerY - 5) + 'v10" stroke="' + ink + '" stroke-width="1.5"/><text x="' + (rulerX + 50) + '" y="' + (rulerY - 8) + '" font-size="' + f1(fs * 0.75) + '" text-anchor="middle" fill="' + ink + '">100 mm</text></g>' +
      '</svg>';
  }

  const api = { GAP, OVERLAP, MARGIN, STEP, WALLS, COLORS, footprint, hull, hullDistance, pieceDistance, collisions, outside, bounds, clampPiece, snap, emptyLayout, findFree, addPiece, arrange, status, svg, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PtaciStena = api;
})(typeof window !== 'undefined' ? window : globalThis);
