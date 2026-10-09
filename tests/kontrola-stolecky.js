#!/usr/bin/env node
/* Kontrola konferenčního stolku „Řetěz“:  node tests/kontrola-stolecky.js [-v]
 *  - dvě nohy dole na plotně a dvě nahoře pod deskou, výšky sedí
 *  - články se neprotínají a v háčcích na sebe dosedají (vůle 0), s vůlí v háčku se oddálí
 *  - ponoření se zámečky: skutečné obrysy jeklů se zářezy se v háčku nepřekrývají a dosednou na plošku (svislé řezy obrysy)
 *  - nohy Λ míří do rohů plotny otočené o 45°
 *  - zámečky: čep ≥ 4 mm v každém rohu, obrys stěny = stěna + čep − výřez
 *  - díly: 8 jeklů ve 4 typech (zámeček v háčku je jen u špičky, takže ani čtverec při 45° nemá shodné strany), otvory v plechu jsou mimo okraj, makro FreeCAD je platný Python
 */
'use strict';
const path = require('path'), cp = require('child_process'), fs = require('fs'), os = require('os');
const S = require(path.join(__dirname, '..', 'stolecky-core.js'));
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('  CHYBA ' + m); } else if (process.argv.includes('-v')) console.log('  ok  ' + m); };

S.PROFILES.forEach((p) => [40, 45, 50].forEach((g) => [180, 240].forEach((sp) => {
  const b = S.build({ prof: p.id, gamma: g, spread: sp, baseW: 420 }), G = b.G, c = b.cfg, id = p.id + ' γ' + g + ' rozteč ' + sp;
  if (b.warn.some((w) => /nevejdou|potkaly/.test(w))) { check(true, id + ': nejde – ohlášeno'); return; }
  /* nohy: střed řezu nohy v úrovni horní plochy plotny je v ±rozteč/2 */
  const footX = (poly, zc, z) => { const pts = []; poly.forEach((a, i) => { const q = poly[(i + 1) % poly.length], za = a[1] + zc, zb = q[1] + zc; if ((za - z) * (zb - z) < 0) pts.push(a[0] + (q[0] - a[0]) * (z - za) / (zb - za)); }); return (Math.min(...pts) + Math.max(...pts)) / 2; };
  const xl = G.lam.polys.map((q) => footX(q, G.zl, c.baseT + 1e-6)), xu = G.vee.polys.map((q) => footX(q, G.zu, c.H - c.topT - c.plT - 1e-6));
  check(xl.every((x) => Math.abs(Math.abs(x) - sp / 2) < 0.5) && xl[0] * xl[1] < 0, id + ': dvě nohy dole v ±' + sp / 2 + ' (' + xl.map((x) => x.toFixed(1)) + ')');
  check(xu.every((x) => Math.abs(Math.abs(x) - sp / 2) < 0.5) && xu[0] * xu[1] < 0, id + ': dvě nohy nahoře v ±' + sp / 2);
  const zmin = Math.min(...G.lam.polys.flat().map((q) => q[1] + G.zl)), zmax = Math.max(...G.vee.polys.flat().map((q) => q[1] + G.zu));
  check(Math.abs(zmin - (c.baseT - G.ins)) < 0.01 && Math.abs(zmax - (c.H - c.topT)) < 0.01, id + ': nohy v plechu ' + G.ins + ' mm, nahoře lícují s plechem');
  check(Math.abs(b.clashSeat.lm) < 0.05 && Math.abs(b.clashSeat.vm) < 0.05 && b.clash.lv > 0, id + ': články dosedají, neprotínají se (' + b.clashSeat.lm.toFixed(3) + ')');
  /* háček po zářezech: v každém svislém řezu x (Λ, V) a y (kosočtverec) přes křížení spočti rozsah materiálu */
  const zr = (polys, zc, u) => { const zs = []; polys.forEach((q) => q.forEach((a, i) => { const p = q[(i + 1) % q.length]; if ((a[0] - u) * (p[0] - u) <= 0 && a[0] !== p[0]) zs.push(a[1] + (p[1] - a[1]) * (u - a[0]) / (p[0] - a[0]) + zc); })); return zs; };
  const hw = G.hd / 2 - 0.01, us = []; for (let k = 0; k <= 20; k++) us.push(-hw + 2 * hw * k / 20);
  const near = (zs, lo, hi) => zs.filter((z) => z > lo && z < hi);
  const lamLo = Math.min(...us.map((u) => Math.min(...near(zr(b.cut.lam, G.zl, u), G.zcB - 60, G.zl + 60))));
  const midBotHi = Math.max(...us.map((u) => Math.max(...near(zr(b.cut.mid, G.zm, u), G.zm - G.b - 60, G.zcB + 30))));
  const veeHi = Math.max(...us.map((u) => Math.max(...near(zr(b.cut.vee, G.zu, u), G.zu - 60, G.zcT + 60))));
  const midTopLo = Math.min(...us.map((u) => Math.min(...near(zr(b.cut.mid, G.zm, u), G.zcT - 30, G.zm + G.b + 60))));
  check(Math.abs(lamLo - midBotHi) < 0.02 && Math.abs(midTopLo - veeHi) < 0.02, id + ': zámečky v háčku – články dosedají na plošku bez průniku (' + (lamLo - midBotHi).toFixed(3) + ' / ' + (midTopLo - veeHi).toFixed(3) + ')');
  check(Object.values(b.flats).flat().every((f) => f.biteOk) && b.parts.every((q) => q.flat.bites.length === 1), id + ': každý jekl má jeden zámeček v háčku');
  check(Object.values(b.lk).every((m) => Object.values(m).every((x) => x.ok)), id + ': čepy ≥ 4 mm');
  Object.values(b.flats).flat().forEach((f, i) => {
    const sum = S.area(f.body) + (f.tab ? S.area(f.tab) : 0) - (f.notch ? S.area(f.notch) : 0) - f.biteArea;
    check(Math.abs(S.area(f.contour) - sum) < 0.5, id + ': obrys stěny ' + i);
  });
  check(b.parts.reduce((n, q) => n + q.qty, 0) === 8 && b.parts.length === 4, id + ': 8 jeklů, ' + b.parts.length + ' typy');
  const pt = b.plates.top; check(pt.holes.length === 2 && pt.holes.flat().every((q) => Math.abs(q[0]) < pt.w / 2 && Math.abs(q[1]) < pt.w / 2), id + ': otvory v plechu pod deskou');
  const pb = b.plates.base, R = pb.w / Math.SQRT2;
  check(pb.rot === 45 && pb.outline.every((q) => Math.abs(Math.hypot(q[0], q[1]) - R) < 1e-6) && Math.abs(pb.outline[1][1]) < 1e-9 && pb.outline[1][0] > 0, id + ': plotna otočená o 45°, roh na ose nohou');
  check(pb.holes.length === 2 && pb.holes.every((h) => h.every((q) => Math.abs(q[0]) + Math.abs(q[1]) < R) && Math.abs(h.reduce((s, q) => s + q[1], 0)) < 1e-6), id + ': otvory v plotně leží na úhlopříčce mířící do rohů');
})));
const d = S.build({});
check(d.warn.length === 0, 'výchozí nastavení bez varování');
const gapped = S.build({ weldGap: 2, sink: 0 });
check(gapped.clash.lm > 0.3 && gapped.clash.vm > 0.3, 'vůle v háčku oddálí články (' + gapped.clash.lm.toFixed(2) + ' mm)');
check(S.build({ sink: 3 }).warn.some((w) => /mělčí než stěna/.test(w)), 'mělký zámeček v háčku se ohlásí');
check(S.normalize({ sink: 4, weldGap: 2 }).weldGap === 0, 'zámeček v háčku zruší vůli');
check(/rot\)|, 45\)/.test(S.freecadMacro({})), 'makro FreeCAD otočí plotnu o 45°');
check(S.build({ spread: 500 }).warn.some((w) => /potkaly|malá|vyčuhuje/.test(w)), 'příliš velká rozteč noh se ohlásí');
check(S.dxf([{ layer: 'X', polys: [d.parts[0].flat.contour] }]).split('\n').filter((x) => x === 'LINE').length === d.parts[0].flat.contour.length, 'DXF: úsečka na každou hranu');
check(S.dxf([{ layer: 'O', polys: [], circles: d.plates.top.circles }]).split('\n').filter((x) => x === 'CIRCLE').length === 4, 'DXF: 4 díry na vruty');
const mac = S.freecadMacro({});
check(/distToShape/.test(mac) && /Stred_%d/.test(mac), 'makro FreeCAD obsahuje tělesa i kontrolu');
try { const f = path.join(os.tmpdir(), 'stolek-makro.py'); fs.writeFileSync(f, mac); cp.execFileSync('python3', ['-c', 'import ast,sys;ast.parse(open(sys.argv[1]).read())', f]); check(true, 'makro FreeCAD je platný Python'); } catch (e) { if (e.code !== 'ENOENT') check(false, 'makro FreeCAD není platný Python'); }
console.log(bad ? bad + ' chyb' : 'Stolečky: vše v pořádku');
process.exit(bad ? 1 : 0);
