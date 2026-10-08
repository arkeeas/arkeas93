#!/usr/bin/env node
/* Kontrola konferenčních stolečků:  node tests/kontrola-stolecky.js [-v] */
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'stolecky-core.js'));
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('  CHYBA ' + m); } else if (process.argv.includes('-v')) console.log('  ok  ' + m); };

S.PROFILES.forEach((p) => [30, 35, 40, 45, 50].forEach((g) => {
  const b = S.build({ prof: p.id, gamma: g });
  const id = p.id + ' γ' + g;
  check(b.L.quads.length === 4 && Math.abs(b.L.lo * 4 - b.L.lo * 4) < 1e-9, id + ': 4 jekly');
  check(Math.abs(b.zA + b.L.oh - (b.cfg.H - b.cfg.topT)) < 0.01 && b.warn.every((w) => !/Výška/.test(w)), id + ': výška sedí');
  check(b.lk.every((x) => x.ok), id + ': čepy ≥ 4 mm');
  b.flats.forEach((f, i) => check(Math.abs(S.area(f.contour) - (S.area(f.body) + S.area(f.tab) - S.area(f.notch))) < 0.5, id + ': obrys dílu ' + i + ' = stěna + čep − výřez'));
  if (g >= 45) check(b.gap > 0, id + ': články do sebe nenarážejí (' + b.gap.toFixed(1) + ' mm)');
  check(b.gap >= 0 || b.warn.some((w) => /narážejí/.test(w)), id + ': kolize je ohlášená');
}));
const d = S.build({});
check(d.warn.length === 0, 'výchozí nastavení bez varování');
check(S.build({ overlap: 0.1 }).gap < 0, 'malý překryv: články do sebe narážejí');
check(S.bestOverlap({}).gap > 0, 'najde překryv s kladnou vůlí');
check(S.dxf(d.flats[0].contour).split('\n').filter((x) => x === 'LINE').length === 12, 'DXF: 12 úseček');
console.log(bad ? bad + ' chyb' : 'Stolečky: vše v pořádku');
process.exit(bad ? 1 : 0);
