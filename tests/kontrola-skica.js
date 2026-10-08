#!/usr/bin/env node
/* Kontrola Skicáře (Node.js 18+):  node tests/kontrola-skica.js [-v]
 *  - katalog profilů se přečte celý, hmotnosti sedí s tabulkovými (±6 %)
 *  - báze prutu u, v, osa jsou kolmé jednotkové a nezávisí na směru kreslení
 *  - všechny hotové modely (podnože, umělecké): převod bez upozornění, obrys sedí, export → import → export beze změny
 *  - kusovník, překryv, rozdělení, posun, zrcadlení
 *  - když je k dispozici python3: importér freecad/skica_import.py přečte export a spočítá styky
 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const S = require(path.join(__dirname, '..', 'skica-core.js'));
const V = process.argv.includes('-v');
let bad = 0, ok = 0;
const check = (c, msg) => { if (c) { ok++; if (V) console.log('  ok  ' + msg); } else { bad++; console.log('  CHYBA ' + msg); } };

/* katalog */
const cat = S.parseCatalog(S.DEFAULT_CATALOG);
check(cat.bad.length === 0 && cat.list.length >= 20, 'výchozí katalog: ' + cat.list.length + ' profilů');
const TAB = { 'jekl 40x40x2': 2.31, 'jekl 40x40x3': 3.30, 'jekl 60x40x3': 4.25, 'pas 40x5': 1.57, 'L 40x40x4': 2.42, 'trubka 33.7x2': 1.56, 'kulatina 12': 0.888 };
Object.entries(TAB).forEach(([id, kg]) => { const p = cat.byId[id]; check(p && Math.abs(p.kgm - kg) / kg < 0.06, id + ' ' + (p && p.kgm) + ' kg/m (tabulka ' + kg + ')'); });
check(S.parseProfile('jekl 40×20×2').id === 'jekl 40x20x2' && S.parseProfile('pásovina 30x5').id === 'pas 30x5' && S.parseProfile('jekl 20x20x12') === null, 'zápis profilů (×, pásovina, nesmyslná stěna)');

/* báze */
const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 2, 3], [-1, 0, 0], [0, 0, -1], [3, -2, 1]];
dirs.forEach((d) => [0, 90, 37].forEach((r) => {
  const f = S.frame([0, 0, 0], d, r), g = S.frame(d, [0, 0, 0], r), x = S.norm(d);
  const orth = Math.abs(S.dot(f.u, f.v)) < 1e-5 && Math.abs(S.dot(f.u, x)) < 1e-5 && Math.abs(S.dot(f.v, x)) < 1e-5 && Math.abs(S.len(f.u) - 1) < 1e-5 && Math.abs(S.len(f.v) - 1) < 1e-5;
  const same = S.len(S.sub(f.u, g.u)) < 1e-5 && S.len(S.sub(f.v, g.v)) < 1e-5;
  check(orth && same, 'báze směr ' + d + ' natočení ' + r + '°');
}));
check(S.frame([0, 0, 0], [100, 0, 0], 0).v[2] === 1 && S.frame([0, 0, 0], [0, 0, 100], 0).u[0] === 1, 'vodorovný prut: v nahoru, svislý: u = X');

/* hotové modely z konfigurátoru → skica */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skica-'));
const files = [];
require(path.join(__dirname, '..', 'core.js')); require(path.join(__dirname, '..', 'vyvoj.js'));
const PZ = globalThis.Podnoze, VY = globalThis.Vyvoj;
PZ.allModels().forEach((md) => {
  const E = VY.ext.owns(md.id) ? VY : PZ;
  const cfg = E.normalize(Object.assign({}, E.DEFAULT_CFG, { model: md.id }));
  const m = S.emptyModel(); let r;
  try { r = S.importBuild(m, E.build(cfg)); } catch (e) { check(false, 'model ' + md.id + ': ' + e.message); return; }
  const C = S.checks(m), B = S.bounds(m), J = S.exportJSON(m), back = S.exportJSON(S.importJSON(JSON.parse(JSON.stringify(J))));
  check(m.members.length >= 4 && C.length === 0 && !r.skipped.length, 'model ' + md.id + ' (' + md.lab + '): ' + m.members.length + ' prutů, ' + m.plates.length + ' desek, upozornění ' + C.length);
  check(B && Math.abs(B.size[0] - cfg.L) <= 2 && Math.abs(B.size[1] - cfg.W) <= 2 && Math.abs(B.size[2] - cfg.H) <= 40, 'model ' + md.id + ': obrys ' + (B && B.size.join(' × ')) + ' (stůl ' + cfg.L + ' × ' + cfg.W + ' × ' + cfg.H + ')');
  check(JSON.stringify(back) === JSON.stringify(J), 'model ' + md.id + ': export → import → export beze změny');
  const tubes = (E.build(cfg).parts || []).length;
  check(m.members.filter((x) => x.prof.startsWith('jekl')).length === tubes, 'model ' + md.id + ': každý jekl je prut (' + tubes + ')');
  if (['4N', 'KS', 'PV'].includes(md.id)) { const f = path.join(tmp, md.id + '.skica.json'); fs.writeFileSync(f, JSON.stringify(J)); files.push(f); }
});

/* úpravy a kontroly */
const m = S.emptyModel();
const a = S.addMember(m, 'jekl 40x40x2', [0, 0, 0], [1000, 0, 0]);
S.addMember(m, 'jekl 40x40x2', [600, 0, 0], [1400, 0, 0]);
check(S.checks(m).some((c) => /překrývají v délce 400/.test(c.msg)), 'překryv souosých prutů se najde');
m.members.pop();
const nb = S.split(m, a.id, [400, 0, 0]);
check(nb && S.mLen(a) === 400 && S.mLen(m.members[1]) === 600, 'rozdělení prutu 400 + 600');
const cp1 = S.move(m, [a.id], [0, 500, 0], true);
check(cp1.length === 1 && m.members.length === 3 && m.members[2].a[1] === 500, 'kopie posunem');
const mi = S.mirror(m, [a.id, cp1[0]], 1, 250);
check(mi.length === 0, 'zrcadlení souměrné dvojice přes její střed nic nezdvojí');
const mi2 = S.mirror(m, [a.id], 1, 1000);
const mm2 = m.members.find((x) => x.id === mi2[0]);
check(mi2.length === 1 && mm2 && mm2.a[1] === 2000 && mm2.b[1] === 2000, 'zrcadlová kopie přes rovinu y = 1000');
const K = S.bom(m);
check(K.rows.length === 2 && K.per[0].ks === 4 && Math.abs(K.per[0].m - 1.8) < 1e-9, 'kusovník: 2 délky, 4 kusy, 1,8 m');

/* rám s pokosy a T-spojem → importér */
const r = S.emptyModel();
const W = 800, H = 500;
S.addMember(r, 'jekl 40x40x2', [0, 0, 0], [W, 0, 0]); S.addMember(r, 'jekl 40x40x2', [W, 0, 0], [W, 0, H]);
S.addMember(r, 'jekl 40x40x2', [W, 0, H], [0, 0, H]); S.addMember(r, 'jekl 40x40x2', [0, 0, H], [0, 0, 0]);
S.addMember(r, 'pas 40x5', [400, 0, 0], [400, 0, H], { roll: 90 });
[[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]].forEach((p) => { r.joints[S.key(p)] = { type: 'pokos', thru: '', note: '' }; });
check(S.checks(r).length === 0, 'rám s pokosy a příčkou: bez upozornění');
const rf = path.join(tmp, 'ram.skica.json'); fs.writeFileSync(rf, JSON.stringify(S.exportJSON(r))); files.push(rf);

let py = null; try { cp.execSync('python3 --version', { stdio: 'ignore' }); py = 'python3'; } catch (e) { /* bez pythonu */ }
if (py) {
  const imp = path.join(__dirname, '..', 'freecad', 'skica_import.py');
  files.forEach((f) => {
    let out = ''; try { out = cp.execFileSync(py, [imp, f], { encoding: 'utf8' }); } catch (e) { out = 'ERR ' + (e.stderr || e.message); }
    check(/^Skica:/.test(out) && /Kusovník/.test(out), 'importér přečte ' + path.basename(f));
    if (V) console.log(out.split('\n').map((l) => '      ' + l).join('\n'));
    if (f === rf) check(/pas 40x5\s+460 mm/.test(out) && /jekl 40x40x2\s+800 mm\s+2 ks/.test(out), 'importér: příčka zkrácená k líci rámu (460), pokosy osově 800');
  });
} else console.log('  (python3 není – importér se nekontroluje)');

console.log((bad ? 'CHYBY: ' + bad : 'Vše v pořádku') + ' (' + ok + ' kontrol)');
process.exit(bad ? 1 : 0);
