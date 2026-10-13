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
assert.match(D.production({ pose: 'vzlet', qty: 4 }), /150 × 229.*0,29 kg.*884 mm.*2 ohyby.*4 ks/);
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
for (const src of ['assets/ptaci/artwork.js', 'ptaci-core.js', 'ptaci-viewer.js', 'zasteny-core.js', 'zasteny-viewer.js', 'ostatni.js']) assert.ok(html.includes(`src="${src}"`), 'chybí skript ' + src);
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
const phpRule = fs.readFileSync(path.join(root, 'dilna_api/poptavky.php'), 'utf8').match(/preg_match\('\/\^\[([A-Z]+)\]/);
assert.ok(phpRule && phpRule[1].includes('A'), 'server přijímá předponu A');
assert.ok(js.includes('result.emailSkipped') && js.includes('result.emailAccepted'), 'odeslání zpracuje odpověď e-mailové služby');
console.log('kontrola-ptaci: kompatibilita se serverem OK');
