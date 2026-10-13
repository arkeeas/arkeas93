'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const P = require('../ptaci-core.js');

/* ---------- core ---------- */
assert.deepEqual(P.normalize({}), { pose: 'vzlet', finish: 'black', qty: 1 });
assert.deepEqual(P.normalize({ pose: 'neexistuje', finish: 'purple', qty: 0 }), { pose: 'vzlet', finish: 'black', qty: 1 });
assert.deepEqual(P.normalize({ pose: 'klouzani', finish: 'raw', qty: 5 }), { pose: 'klouzani', finish: 'raw', qty: 5 });
assert.equal(P.normalize({ pose: '__proto__' }).pose, 'vzlet');
assert.equal(P.normalize({ pose: 'toString' }).pose, 'vzlet');
assert.equal(P.validate({ pose: 'vzlet', finish: 'black', qty: 1 }).ok, true);
assert.equal(P.validate({ pose: 'x', finish: 'black', qty: 1 }).ok, false);
assert.equal(P.validate({ pose: 'vzlet', finish: 'black', qty: 0 }).ok, false);
assert.equal(P.validate({ pose: 'vzlet', finish: 'purple', qty: 1 }).ok, false);
for (const qty of [0, -1, 1.5, NaN, Infinity, '', null, Number.MAX_SAFE_INTEGER + 1]) assert.equal(P.validate({ pose: 'vzlet', finish: 'black', qty }).ok, false, `reject qty ${qty}`);
assert.match(P.describe({ pose: 'mavnuti', finish: 'anth', qty: 3 }), /Mávnutí.*160 mm.*Antracit.*3 ks/);
assert.equal(P.validEmail('rené@example.cz'), true);
assert.equal(P.validEmail('not an email'), false);
assert.equal(P.SIZE.span, 160);
assert.deepEqual(Object.keys(P.POSES), ['vzlet', 'mavnuti', 'plachteni', 'klouzani']);

// ceník: s nulovými sazbami kromě jedné vychází cena přesně z rozpisu
const only = (o) => Object.assign({ kg: 0, rez: 0, svar: 0, barva: 0, priprava: 0, marze: 0, ohyb: 0 }, o);
assert.equal(P.price({ pose: 'vzlet', finish: 'black', qty: 1 }, only({ rez: 10 })).price, 50);                   // 5 průstřelů × 10
assert.equal(P.price({ pose: 'vzlet', finish: 'black', qty: 1 }, only({ ohyb: 100 })).price, 200);                // 2 ohyby × 100
assert.equal(P.price({ pose: 'vzlet', finish: 'black', qty: 1 }, only({ kg: 100 })).price, 30);                   // 0,29 kg × 100 = 29 → zaokrouhleno na 10
assert.equal(P.price({ pose: 'vzlet', finish: 'black', qty: 1 }, only({ priprava: 600 })).price, 600);
// příprava se dělí mezi kusy: 10 ks → 60 Kč na kus, celkem stejná příprava
const one = P.price({ pose: 'vzlet', finish: 'black', qty: 1 }, only({ priprava: 600 })), ten = P.price({ pose: 'vzlet', finish: 'black', qty: 10 }, only({ priprava: 600 }));
assert.equal(ten.price, 60); assert.ok(ten.price < one.price);
assert.equal(ten.total, ten.vat * 10);
// marže a DPH
const m = P.price({ pose: 'vzlet', finish: 'black', qty: 1 }, only({ rez: 10, marze: 100 }));
assert.equal(m.price, 100); assert.equal(m.vat, 120); assert.equal(m.total, 120);
// bez barvy je levnější povrch „ocel + lak“
const paint = only({ barva: 10000 });
assert.ok(P.price({ pose: 'vzlet', finish: 'raw', qty: 1 }, paint).price < P.price({ pose: 'vzlet', finish: 'black', qty: 1 }, paint).price);
// výchozí ceník dává smysluplné kladné ceny pro všechny pózy a mezi pózami platí řazení podle hmotnosti a řezu
for (const k of Object.keys(P.POSES)) { const r = P.price({ pose: k, finish: 'black', qty: 1 }); assert.ok(r.estimate && r.price > 0 && r.vat > r.price && r.total === r.vat, k); assert.equal(r.cuts, 5); assert.equal(r.bends, 2); }
assert.ok(P.price({ pose: 'vzlet', qty: 1 }).price >= P.price({ pose: 'plachteni', qty: 1 }).price);
// sazby z dílenské databáze (cizí klíče) se ignorují, `ohyb` má výchozí hodnotu
assert.equal(P.price({ pose: 'vzlet', qty: 1 }, { kg: 42, rez: 35, svar: 90, barva: 280, priprava: 600, marze: 35, plate: { w: 1 } }).price, P.price({ pose: 'vzlet', qty: 1 }).price);
console.log('kontrola-ptaci: core OK');

/* ---------- obrysy ptáků + geometrie háčku ---------- */
const vm = require('node:vm');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/ptaci/artwork.js'), 'utf8'), ctx);
const art = ctx.window.PtaciArtwork;
assert.ok(art && art.params && art.tongue && art.birds);
assert.deepEqual(Object.keys(art.birds), Object.keys(P.POSES));
assert.equal(art.params.span, P.SIZE.span); assert.equal(art.params.t, P.SIZE.t); assert.equal(art.params.tongue_w, P.SIZE.tongueW);
for (const [k, b] of Object.entries(art.birds)) {
  assert.equal(b.parts.length, 6, k + ': tělo, hlava, zobák, ocas, 2 křídla');
  const xs = b.parts.flat().map((p) => p[0]), ys = b.parts.flat().map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  assert.ok(Math.abs(Math.max(w, h) - P.SIZE.span) < 0.5, `${k}: největší rozměr siluety je ${P.SIZE.span} mm (${w.toFixed(1)} × ${h.toFixed(1)})`);
  assert.ok(b.parts.flat().every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])));
  assert.equal(b.anchor.length, 2);
}
const V = require('../ptaci-viewer.js');
const z0 = -10, prof = V.hookProfile(art.params, art.tongue, z0);
const us = prof.map((p) => p[0]), vs = prof.map((p) => p[1]);
assert.ok(Math.abs(Math.min(...us)) < 1e-9, 'háček začíná u zdi (u = 0)');
assert.ok(Math.abs(Math.max(...us) - art.params.arm) < 1e-6, 'rameno 45 mm od zdi (vnější rozměr)');
assert.ok(Math.abs(Math.max(...vs) - (z0 + art.tongue.s[2] ) ) < 0.6, 'zarážka končí nad ohybem (+ 0,5 mm přesah)');
const lip = (z0 + art.tongue.s[2]) - (z0 - (art.params.ri + art.params.t));
assert.ok(Math.abs(lip - art.params.lip) < 1e-6, 'zarážka 18 mm (vnější rozměr)');
const area = Math.abs(prof.reduce((a, p, i) => { const q = prof[(i + 1) % prof.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const expected = art.params.t * (2 * (Math.PI / 2) * (art.params.ri + art.params.t / 2) + art.tongue.s[1] + art.tongue.s[2] + 0.5);   // tloušťka × délka střednice + 0,5 mm přesah
assert.ok(Math.abs(area - expected) / expected < 0.01, `plocha profilu háčku ${area.toFixed(1)} mm² ≈ ${expected.toFixed(1)}`);
console.log('kontrola-ptaci: obrysy + háček OK');

/* ---------- náhled: průchod s atrapou Three.js (kontrola volání, ne vzhledu) ---------- */
const calls = { meshes: 0, extrudes: 0, holes: 0 };
class V2 { constructor(x, y) { this.x = x; this.y = y; } }
class Shape { constructor(pts) { assert.ok(Array.isArray(pts) && pts.every((p) => p instanceof V2)); this.holes = []; } }
class Path { absarc() { calls.holes++; } }
class Geo { dispose() {} rotateY() { return this; } translate() { return this; } }
const stub = {
  Vector2: V2, Shape, Path, Color: class {}, Scene: class { add() {} set background(v) {} },
  WebGLRenderer: class { constructor() { this.domElement = {}; this.shadowMap = {}; } setPixelRatio() {} setSize() {} render() {} dispose() {} },
  PerspectiveCamera: class { constructor() { this.position = { set() {} }; } updateProjectionMatrix() {} lookAt() {} },
  HemisphereLight: class {}, AmbientLight: class {}, DirectionalLight: class { constructor() { this.position = { set() {} }; this.shadow = { camera: {} }; } },
  Group: class { constructor() { this.children = []; } add(c) { this.children.push(c); } traverse(fn) { fn(this); this.children.forEach((c) => c.traverse && c.traverse(fn)); } },
  MeshStandardMaterial: class { dispose() {} }, DoubleSide: 2, PCFSoftShadowMap: 1,
  ExtrudeGeometry: class extends Geo { constructor(shape, opt) { super(); assert.ok(shape instanceof Shape && opt.depth > 0); calls.extrudes++; } },
  PlaneGeometry: class extends Geo {},
  Mesh: class { constructor(g, m) { calls.meshes++; this.geometry = g; this.material = m; this.position = { set() {} }; } traverse(fn) { fn(this); } }
};
const host = { clientWidth: 600, clientHeight: 400, replaceChildren() {} };
const sandbox = { THREE: stub, PtaciArtwork: art, Ptaci: P, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, devicePixelRatio: 1 };
const loaded = Object.assign({}, V);   // modul používá globální root = globalThis; ověříme jen veřejné API
assert.equal(typeof loaded.create, 'function');
const src = fs.readFileSync(path.join(root, 'ptaci-viewer.js'), 'utf8');
vm.createContext(sandbox); sandbox.window = sandbox; vm.runInContext(src, sandbox);
const viewer = sandbox.PtaciViewer.create(host);
assert.ok(viewer && typeof viewer.update === 'function');
for (const pose of Object.keys(P.POSES)) { calls.meshes = 0; calls.extrudes = 0; viewer.update({ pose, finish: 'white', qty: 1 }); assert.equal(calls.extrudes, 6 + 1 + 1, pose + ': 6 dílů siluety + jazýček + háček'); assert.equal(calls.meshes, 6 + 1 + 1 + 1, pose + ': + zeď'); }
for (const v of ['front', 'side', 'iso']) viewer.view(v);
viewer.destroy();
console.log('kontrola-ptaci: náhled (atrapa THREE) OK');

/* ---------- dílna ---------- */
const D = require('../ptaci-dilna.js');
assert.equal(D.accepts({ product: 'ptak' }), true);
assert.equal(D.accepts({ product: 'zastena' }), false);
assert.match(D.describe({ pose: 'plachteni', finish: 'black', qty: 2 }), /Plachtění.*2 ks/);
assert.match(D.production({ pose: 'vzlet', qty: 4 }), /150,3 × 229,4.*0,278 kg.*961 mm.*2 ohyby.*4 ks/);
assert.match(D.escape('<script>'), /&lt;script&gt;/);
const fakeDoc = { els: {}, getElementById(id) { return this.els[id] || (this.els[id] = {}); } };
D.init({ document: fakeDoc });
D.open({ id: 'V1', created: 'x', product: 'ptak', customer: { name: '<b>Jan</b>', email: 'a@b.cz' }, config: { pose: 'vzlet', finish: 'black', qty: 1 }, priceEstimate: true, price: 1000, vat: 1210, total: 1210, priceBreakdown: { kg: 0.29, cuts: 5, bends: 2, surfaceM2: 0.019 } });
assert.match(fakeDoc.els.paDetail.innerHTML, /&lt;b&gt;Jan/); assert.doesNotMatch(fakeDoc.els.paDetail.innerHTML, /<b>Jan/);
assert.match(fakeDoc.els.paDetail.innerHTML, /1\s?210 Kč s DPH/);
for (const f of D.referenceFiles()) assert.ok(fs.existsSync(path.join(root, f.path)), 'chybí soubor ' + f.path);
console.log('kontrola-ptaci: dílna OK');

/* ---------- stránka Ostatní: napojení ---------- */
const html = fs.readFileSync(path.join(root, 'ostatni.html'), 'utf8'), js = fs.readFileSync(path.join(root, 'ostatni.js'), 'utf8');
const wanted = [...new Set([...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((x) => x[1]))];
for (const id of wanted) assert.ok(new RegExp(`id="${id}"`).test(html), `ostatni.html nemá prvek #${id}`);
for (const src of ['assets/ptaci/artwork.js', 'ptaci-core.js', 'ptaci-viewer.js', 'ptaci-stena.js', 'zasteny-core.js', 'zasteny-viewer.js', 'ostatni.js']) assert.ok(html.includes(`src="${src}"`), 'chybí skript ' + src);
for (const page of ['index.html', 'vyvoj.html', 'zabradli.html', 'stolecky.html', 'ostatni.html']) {
  const s = fs.readFileSync(path.join(root, page), 'utf8');
  assert.ok(s.includes('<a href="ostatni.html"') && s.includes('>Ostatní</a>'), page + ' odkazuje na Ostatní');
  assert.ok(!/>Zástěny<\/a>/.test(s), page + ' už nemá záložku Zástěny');
}
assert.match(fs.readFileSync(path.join(root, 'zasteny.html'), 'utf8'), /ostatni\.html/);
const interni = fs.readFileSync(path.join(root, 'interni.html'), 'utf8');
for (const id of ['t-pta', 'p-pta', 'paOrder', 'paDetail', 'paRefs']) assert.ok(interni.includes(`id="${id}"`), 'interni.html: #' + id);
assert.ok(interni.includes("it.product === 'ptak'") && interni.includes('ptaci-dilna.js'));
console.log('kontrola-ptaci: stránka + dílna napojeny OK');

/* ---------- poptávka: kompatibilita se serverem (dilna_api/poptavky.php) ---------- */
assert.match(js, /const id = 'A' \+ stamp/, 'ID poptávky začíná povolenou předponou');
const phpFile = path.join(root, 'dilna_api/poptavky.php');
if (fs.existsSync(phpFile)) {   // server API může být v repu dočasně vrácen zpět – pak se kontrola přeskočí
  const phpRule = fs.readFileSync(phpFile, 'utf8').match(/preg_match\('\/\^\[([A-Z]+)\]/);
  assert.ok(phpRule && phpRule[1].includes('A'), 'server přijímá předponu A');
}
assert.ok(js.includes('result.emailSkipped') && js.includes('result.emailAccepted'), 'odeslání zpracuje odpověď e-mailové služby');
console.log('kontrola-ptaci: kompatibilita se serverem OK');

/* ---------- výrobní soubory a souhrn z FreeCADu ---------- */
const souhrn = JSON.parse(fs.readFileSync(path.join(root, 'assets/ptaci/souhrn.json'), 'utf8'));
assert.equal(souhrn.length, 4);
for (const r of souhrn) {
  const pose = P.POSES[r.pose];
  assert.ok(pose, 'póza ze souhrnu existuje: ' + r.pose);
  assert.equal(r.valid, true); assert.equal(r.solids, 1); assert.equal(r.short_edges, 0);
  assert.deepEqual(pose.flat, r.flat, r.pose + ': rozvin odpovídá souhrnu');
  assert.equal(pose.kg, r.kg, r.pose + ': hmotnost odpovídá souhrnu');
  assert.equal(pose.cutMm, r.cut_mm, r.pose + ': délka řezu odpovídá souhrnu');
  const dxf = fs.readFileSync(path.join(root, `assets/ptaci/ptak_${r.pose}_rozvin.dxf`), 'utf8');
  for (const layer of ['OBRYS', 'OTVORY', 'OHYB']) assert.ok(dxf.includes(layer), `${r.pose}: DXF má vrstvu ${layer}`);
  assert.ok(dxf.trimEnd().endsWith('EOF'), r.pose + ': DXF je úplný');
  const step = fs.readFileSync(path.join(root, `assets/ptaci/ptak_${r.pose}.step`), 'utf8').slice(0, 200);
  assert.ok(step.startsWith('ISO-10303-21'), r.pose + ': STEP hlavička');
}
console.log('kontrola-ptaci: DXF/STEP + souhrn OK');

/* ---------- rozložení na stěně ---------- */
const S = require('../ptaci-stena.js');
const poses = Object.keys(P.POSES);
// jádro: normalizace, validace, popis, cena
assert.equal(P.normalizeLayout({}).wall.w, P.WALL_LIMITS.defaultW);
assert.deepEqual(P.normalizeLayout({ wall: { w: 99999, h: 1 }, pieces: [{ pose: 'x', finish: 'y', x: 'a', y: 5 }] }), { wall: { w: 6000, h: 300 }, pieces: [{ pose: 'vzlet', finish: 'black', x: 0, y: 5 }] });
assert.equal(P.normalizeLayout({ pieces: Array(100).fill({ pose: 'vzlet', finish: 'black', x: 1, y: 1 }) }).pieces.length, P.WALL_LIMITS.maxPieces);
assert.equal(P.validateLayout({ wall: { w: 1000, h: 700 }, pieces: [] }).ok, false);
assert.equal(P.validateLayout({ wall: { w: 1000, h: 700 }, pieces: [{ pose: 'vzlet', finish: 'black', x: 100, y: 100 }] }).ok, true);
assert.equal(P.validateLayout({ wall: { w: 10, h: 700 }, pieces: [{ pose: 'vzlet', finish: 'black', x: 100, y: 100 }] }).ok, false);
assert.equal(P.validateLayout({ wall: { w: 1000, h: 700 }, pieces: [{ pose: 'xx', finish: 'black', x: 1, y: 1 }] }).ok, false);
assert.equal(P.validateLayout({ wall: { w: 1000, h: 700 }, pieces: [{ pose: 'vzlet', finish: 'black', x: NaN, y: 1 }] }).ok, false);
const lay1 = { wall: { w: 1000, h: 700 }, pieces: [{ pose: 'klouzani', finish: 'anth', x: 500, y: 400 }] };
// jeden kus na stěně stojí stejně jako jeden kus v konfigurátoru
assert.equal(P.priceLayout(lay1).total, P.price({ pose: 'klouzani', finish: 'anth', qty: 1 }).total);
const two = { wall: lay1.wall, pieces: [lay1.pieces[0], lay1.pieces[0]] };
assert.equal(P.priceLayout(two).total, P.price({ pose: 'klouzani', finish: 'anth', qty: 2 }).total, 'dva stejné kusy = qty 2');
// různé pózy sdílejí přípravu: 4 různí ptáci jsou levnější na kus než 4× samostatně
const four = { wall: lay1.wall, pieces: poses.map((pose) => ({ pose, finish: 'black', x: 0, y: 0 })) };
const sep = poses.reduce((sum, pose) => sum + P.price({ pose, finish: 'black', qty: 1 }).total, 0);
assert.ok(P.priceLayout(four).total < sep, 'společná příprava zlevňuje');
assert.equal(P.priceLayout(four).qty, 4); assert.equal(P.priceLayout(four).bends, 8);
assert.match(P.describe({ layout: four }), /rozložení na stěně 1000 × 700 mm.*4 ks/);
assert.deepEqual(P.groupPieces(two), [{ pose: 'klouzani', finish: 'anth', qty: 2 }]);
// geometrie: obrys, odstupy, kolize
for (const k of poses) {
  const f = S.footprint(art, k);
  assert.ok(f.bbox.maxX - f.bbox.minX >= 155 && f.bbox.maxX - f.bbox.minX <= 165, k + ': šířka obrysu ≈ 160');
  assert.ok(Math.abs(f.bbox.minY + 60) < 0.01, k + ': jazýček sahá 60 mm pod kotvící bod');
  assert.equal(f.hulls.length, 7);
}
const at = (pose, x, y) => ({ pose, finish: 'black', x, y });
assert.equal(S.pieceDistance(art, at('vzlet', 300, 300), at('vzlet', 300, 300)), 0, 'stejné místo = překryv');
assert.ok(S.pieceDistance(art, at('vzlet', 300, 300), at('mavnuti', 700, 300)) > 100);
assert.ok(S.pieceDistance(art, at('vzlet', 300, 300), at('vzlet', 300, 300 + 200)) > 0);
const dist = (d) => S.pieceDistance(art, at('plachteni', 300, 300), at('plachteni', 300 + d, 300));
assert.ok(dist(100) < dist(200) && dist(200) < dist(300), 'vzdálenost roste s odstupem');
assert.equal(S.status({ wall: { w: 1000, h: 700 }, pieces: [at('vzlet', 300, 300), at('vzlet', 310, 305)] }, art).ok, false, 'překrývající se kusy neprojdou');
assert.equal(S.status({ wall: { w: 1000, h: 700 }, pieces: [at('vzlet', 5, 300)] }, art).ok, false, 'kus mimo stěnu neprojde');
assert.equal(S.status({ wall: { w: 1000, h: 700 }, pieces: [at('vzlet', 300, 300), at('vzlet', 700, 300)] }, art).ok, true);
// přichycení a ohraničení
const cl = S.clampPiece(art, at('vzlet', -999, 99999), { w: 1000, h: 700 });
const cb = S.bounds(art, cl); assert.ok(cb.minX >= S.MARGIN - 0.01 && cb.maxY <= 700 - S.MARGIN + 0.01);
// přidávání: postupně se zaplní stěna bez kolizí, nakonec už místo není
let L = S.emptyLayout(), added = 0;
for (let i = 0; i < 60; i++) { const r = S.addPiece(L, art, poses[i % 4], 'black'); if (!r.added) break; L = r.layout; added++; assert.equal(S.status(L, art).ok, true, 'po přidání ' + added + '. kusu bez kolizí'); }
assert.ok(added >= 6 && added <= P.WALL_LIMITS.maxPieces, 'na 1000 × 700 se vejde několik kusů: ' + added);
assert.equal(S.addPiece(L, art, 'vzlet', 'black').added, added >= P.WALL_LIMITS.maxPieces ? false : false);
// rozmístění: 4 různé pózy i na malé stěně bez kolizí
for (const [w, h] of [[1000, 700], [1500, 1000], [800, 800], [2000, 600]]) {
  const A = S.arrange({ wall: { w, h }, pieces: poses.map((pose) => at(pose, 0, 0)) }, art);
  const st = S.status(A, art); assert.deepEqual(st.errors, [], `rozmístění 4 ptáků na ${w}×${h}`); assert.equal(st.close.length, 0, `odstupy ${w}×${h}`);
}
// SVG
const svg = S.svg(A0(), { art, selected: 0, wall: 'dark' });
function A0() { return S.arrange({ wall: { w: 1000, h: 700 }, pieces: poses.map((pose) => at(pose, 0, 0)) }, art); }
assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
assert.equal((svg.match(/class="bird/g) || []).length, 4); assert.ok(svg.includes('bird sel'));
assert.equal(svg.includes('NaN') || svg.includes('undefined'), false, 'SVG bez NaN/undefined');
assert.match(S.svg({ wall: { w: 1000, h: 700 }, pieces: [] }, { art }), /1000 mm/);
// dílna: rozložení
D.init({ document: fakeDoc });
const lay = A0();
assert.match(D.production({ layout: lay }), /1× Vzlet.*1× Klouzání.*celkem 4 ks/);
assert.equal(D.placement({ layout: lay }).length, 4);
D.open({ id: 'A261013-ABCD', created: 'x', product: 'ptak', customer: { name: 'Jan', email: 'a@b.cz' }, config: { layout: lay, qty: 4 }, priceEstimate: true, price: 2160, vat: 2600, total: 2600, priceBreakdown: { kg: 0.977, cuts: 20, bends: 8, surfaceM2: 0.08 } });
assert.match(fakeDoc.els.paDetail.innerHTML, /rozložení na stěně 1000 × 700 mm/); assert.match(fakeDoc.els.paDetail.innerHTML, /Rozmístění/); assert.match(fakeDoc.els.paDetail.innerHTML, /2\s?600 Kč s DPH celkem/);
assert.doesNotMatch(fakeDoc.els.paDetail.innerHTML, /Kč s DPH \/ ks/);
assert.match(D.describe({ layout: lay }), /4 ks/);
console.log('kontrola-ptaci: rozložení na stěně OK');

/* ---------- věšák Jelen ---------- */
const J = require('../jelen-core.js'), JV = require('../jelen-view.js');
const jsum = JSON.parse(fs.readFileSync(path.join(root, 'assets/jelen/souhrn.json'), 'utf8'));
assert.equal(jsum.valid, true); assert.equal(jsum.solids, 1); assert.equal(jsum.short_edges, 0); assert.equal(jsum.hooks, J.SPEC.hooks);
assert.deepEqual(J.SPEC.flat, jsum.flat); assert.equal(J.SPEC.kg, jsum.kg); assert.equal(J.SPEC.cutMm, jsum.cut_mm); assert.equal(J.SPEC.hookOut, jsum.hook_out);
const jdxf = fs.readFileSync(path.join(root, 'assets/jelen/jelen_rozvin.dxf'), 'utf8');
for (const l of ['OBRYS', 'OTVORY', 'OHYB']) assert.ok(jdxf.includes(l), 'DXF jelen: ' + l);
assert.equal((jdxf.match(/\nOHYB\n/g) || []).length, J.SPEC.bends, 'počet ohybových čar = ohyby');
assert.ok(jdxf.trimEnd().endsWith('EOF'));
assert.ok(fs.readFileSync(path.join(root, 'assets/jelen/jelen.step'), 'utf8').slice(0, 20).startsWith('ISO-10303-21'));
assert.equal(J.validate({ finish: 'black', qty: 1 }).ok, true);
for (const q of [0, -1, 1.5, '', null, NaN]) assert.equal(J.validate({ finish: 'black', qty: q }).ok, false);
assert.equal(J.validate({ finish: 'x', qty: 1 }).ok, false);
assert.match(J.describe({ finish: 'anth', qty: 2 }), /Jelen.*700 × 402.*8 háčků.*Antracit.*2 ks/);
const jo = (o) => Object.assign({ kg: 0, rez: 0, svar: 0, barva: 0, priprava: 0, marze: 0, ohyb: 0 }, o);
assert.equal(J.price({ qty: 1 }, jo({ ohyb: 10 })).price, 160); assert.equal(J.price({ qty: 1 }, jo({ rez: 10 })).price, 200);
assert.equal(J.price({ qty: 10 }, jo({ priprava: 600 })).price, 60);
const jp = J.price({ qty: 1 }); assert.ok(jp.price > 0 && jp.vat > jp.price && jp.total === jp.vat);
assert.ok(J.price({ qty: 5 }).price < jp.price);
const jart = (() => { const c2 = { window: {} }; vm.createContext(c2); vm.runInContext(fs.readFileSync(path.join(root, 'assets/jelen/artwork.js'), 'utf8'), c2); return c2.window.JelenArtwork; })();
assert.equal(jart.bends.length, 16); assert.equal(jart.slots.length, 16); assert.equal(jart.holes.length, 3); assert.equal(JV.hookTabs(jart).length, 8);
for (const mode of ['front', 'rozvin']) { const sv = JV.svg(jart, { mode, finish: 'raw' }); assert.ok(sv.startsWith('<svg') && sv.endsWith('</svg>')); assert.ok(!/NaN|undefined/.test(sv), mode); }
D.init({ document: fakeDoc });
assert.equal(D.accepts({ product: 'jelen' }), true);
assert.match(D.production({ finish: 'black', qty: 2 }, 'jelen'), /700 × 402,1.*1,45 kg.*5638 mm.*8 háčků = 16 ohybů.*2 ks/);
assert.match(D.describe({ finish: 'black', qty: 1 }, 'jelen'), /Jelen/);
D.open({ id: 'A261013-JELN', created: 'x', product: 'jelen', customer: { name: 'Jan', email: 'a@b.cz' }, config: { finish: 'black', qty: 1 }, priceEstimate: true, price: 2540, vat: 3070, total: 3070, priceBreakdown: { kg: 1.45, cuts: 20, bends: 16, surfaceM2: 0.14 } });
assert.match(fakeDoc.els.paDetail.innerHTML, /Věšák Jelen/); assert.match(fakeDoc.els.paRefs.innerHTML, /jelen_rozvin\.dxf/);
for (const f of D.referenceFiles('jelen')) assert.ok(fs.existsSync(path.join(root, f.path)), 'chybí ' + f.path);
for (const src of ['assets/jelen/artwork.js', 'jelen-core.js', 'jelen-view.js']) assert.ok(html.includes(`src="${src}"`), 'ostatni.html: ' + src);
assert.ok(interni.includes('jelen-core.js') && interni.includes("it.product === 'jelen'"));
console.log('kontrola-ptaci: Jelen OK');
