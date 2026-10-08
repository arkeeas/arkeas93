#!/usr/bin/env node
/* Kontrola konferenčních stolečků:  node tests/kontrola-stolecky.js [-v] */
'use strict';
const path = require('path'), cp = require('child_process'), fs = require('fs'), os = require('os');
const S = require(path.join(__dirname, '..', 'stolecky-core.js'));
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('  CHYBA ' + m); } else if (process.argv.includes('-v')) console.log('  ok  ' + m); };

S.PROFILES.forEach((p) => [35, 40, 45, 50].forEach((g) => {
  const b = S.build({ prof: p.id, gamma: g }), id = p.id + ' γ' + g, L = b.L, c = b.cfg;
  check(Math.abs(b.zA + L.b + L.hl - (c.H - c.topT)) < 0.01, id + ': horní nohy končí pod deskou');
  check(Math.abs(b.zB - L.b - L.hl - c.baseT) < 0.01, id + ': dolní nohy stojí na plotně');
  /* dvě nohy dole a dvě nahoru: špičky noh jsou od sebe o 2× rozteč, ve stejné výšce */
  const fx = (q) => (q[1][0] + q[2][0]) / 2, f1 = fx(b.polysB[1]), f2 = (b.polysB[2][0][0] + b.polysB[2][3][0]) / 2;
  check(Math.abs(f1 + c.foot) < 0.01 && Math.abs(f2 - c.foot) < 0.01, id + ': dolní nohy v ±' + c.foot);
  check(Math.abs(b.polysB[1][1][1] - b.polysB[2][0][1]) < 1e-6 && Math.abs(b.polysB[1][1][1] - L.zf) < 1e-6, id + ': nohy v jedné výšce');
  check(Object.values(b.lk).length === 3 && Object.values(b.lk).every((x) => x.ok), id + ': tři zámky, čepy ≥ 4 mm');
  b.flats.forEach((f, i) => {
    const sum = S.area(f.body) + (f.tab ? S.area(f.tab) : 0) - (f.notch ? S.area(f.notch) : 0);
    check(Math.abs(S.area(f.contour) - sum) < 0.5, id + ': obrys dílu ' + i + ' = stěna + čep − výřez');
    if (f.slot) check(f.slot.pieces.length === 2 && f.slot.pieces.every((q) => q.length >= 3) && S.area(f.slot.pieces[0]) + S.area(f.slot.pieces[1]) < S.area(f.contour), id + ': zářez rozdělí stěnu na dva kusy');
  });
  check(b.flats[1].slot && b.flats[2].slot && b.flats[1].slot.wall !== b.flats[2].slot.wall, id + ': zářezy v přední a zadní stěně');
  if (g >= 45 && p.id !== '40x40x2' && p.id !== '40x30x2') check(b.gap > 0, id + ': články do sebe nenarážejí (' + b.gap.toFixed(1) + ' mm)');
  check(b.gap >= 0 || b.warn.some((w) => /narážejí/.test(w)), id + ': kolize je ohlášená');
}));
const d = S.build({});
check(d.warn.length === 0, 'výchozí nastavení bez varování');
check(d.parts.length === 4 && d.parts.every((p) => p.qty === 2), 'čtyři díly po dvou kusech (8 jeklů)');
check(S.build({ overlap: 0.1 }).gap < 0, 'malý překryv: články do sebe narážejí');
check(S.bestOverlap({}).gap > 0, 'najde překryv s kladnou vůlí');
check(S.dxf([{ layer: 'X', polys: [d.flats[0].contour] }]).split('\n').filter((x) => x === 'LINE').length === d.flats[0].contour.length, 'DXF: úsečka na každou hranu');
const mac = S.freecadMacro({});
check(/Dolni_%d/.test(mac) && /Kolizí mezi články/.test(mac), 'makro FreeCAD obsahuje tělesa i kontrolu');
try { const f = path.join(os.tmpdir(), 'stolek-makro.py'); fs.writeFileSync(f, mac); cp.execFileSync('python3', ['-c', 'import ast,sys;ast.parse(open(sys.argv[1]).read())', f]); check(true, 'makro FreeCAD je platný Python'); } catch (e) { if (e.code !== 'ENOENT') check(false, 'makro FreeCAD není platný Python'); }
console.log(bad ? bad + ' chyb' : 'Stolečky: vše v pořádku');
process.exit(bad ? 1 : 0);
