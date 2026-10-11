'use strict';
const path = require('path');
const fs = require('fs');
const S = require(path.join(__dirname, '..', 'stolecky-core.js'));
let bad = 0;
const check = (ok, msg) => { if (!ok) { bad++; console.log('  CHYBA ' + msg); } };

const low = S.normalize({ model: 'motylek', H: 399, topD: 475 });
check(low.H === 400 && low.topD === 500, 'Motýlek omezí a zaokrouhlí minimum na H400 / Ø500');
const high = S.normalize({ model: 'motylek', H: 700, topD: 825 });
check(high.H === 650 && high.topD === 800, 'Motýlek omezí a zaokrouhlí maximum na H650 / Ø800');
check(S.normalize({ model: 'motylek', H: 637, topD: 675 }).H === 640 && S.normalize({ model: 'motylek', H: 637, topD: 675 }).topD === 700,
  'Motýlek zaokrouhluje na krok výšky 10 mm a průměru 50 mm');

const scale = S.motylekRadialScale(800);
check(S.mapMotylekRadial(0, scale) === 0 && S.mapMotylekRadial(2.15, scale) === 2.15,
  'radiální změna zachová zdrojový středový zámek široký 4,3 mm');
check(Math.abs(S.mapMotylekRadial(12, scale) - (2.15 + (12 - 2.15) * scale)) < 1e-8 && Math.abs(S.mapMotylekRadial(-12, scale) + (2.15 + (12 - 2.15) * scale)) < 1e-8,
  'radiální změna roztahuje obě strany souměrně za zámkem');
check(Math.abs(S.mapMotylekRadial(300, scale) - 400) < 1e-8, 'radiální měřítko dovede horní zámky přesně k poloměru desky');
const mesh = { name: 'Motyli podnoz A - ocel 4 mm', positions: [0, 0, 500, 2.15, 0, 295, 300, 0, 496], indices: [0, 1, 2] };
const fittedMesh = S.transformMotylekMesh(mesh, mesh.name, { model: 'motylek', H: 650, topD: 800 });
check(Math.abs(fittedMesh.positions[5] - 383.5) < 1e-8 && Math.abs(fittedMesh.positions[6] - 400) < 1e-8 && Math.abs(fittedMesh.positions[8] - 644.8) < 1e-8,
  '3D podnož zachová šířku zámku a shodně přepočítá jeho hloubku i horní hranu');
const deskMesh = S.transformMotylekMesh({ name: 'Kruhová deska', positions: [300, 0, 496, 0, 300, 500], indices: [0, 1] }, 'Kruhová deska', { model: 'motylek', H: 650, topD: 800 });
check(Math.abs(deskMesh.positions[0] - 400) < 1e-8 && Math.abs(deskMesh.positions[2] - 646) < 1e-8 && Math.abs(deskMesh.positions[4] - 400) < 1e-8 && Math.abs(deskMesh.positions[5] - 650) < 1e-8,
  '3D deska má zvolený průměr a její horní plocha je v nastavené výšce');
const slotDeskMesh = S.transformMotylekMesh({ name: 'Kruhová deska', positions: [2.15, 185, 496, -2.15, 185, 496], indices: [] }, 'Kruhová deska', { model: 'motylek', H: 650, topD: 800 });
check(slotDeskMesh.positions[0] === 2.15 && slotDeskMesh.positions[3] === -2.15 && Math.abs(slotDeskMesh.positions[1] - S.mapMotylekRadial(185, scale)) < 1e-8,
  '3D model zachová šířku drážky v desce a posune ji spolu s jazykem podnože');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets/stolecky/motyli_stolek/deska_600_4mm.dxf'), 'utf8');
check(S.transformMotylekDxf(source, 'deska', { model: 'motylek', H: 500, topD: 600 }) === source,
  'výchozí deska Ø600 vrací zdrojový DXF beze změny');
const sample = ['0','SECTION','2','ENTITIES','0','CIRCLE','10','300','20','0','40','300','0','CIRCLE','10','250','20','0','40','3.5','0','LINE','10','0','20','0','11','12','21','500','0','ENDSEC','0','EOF'].join('\n');
const resized = S.transformMotylekDxf(sample, 'deska', { model: 'motylek', H: 650, topD: 800 });
check(/\n10\n400(?:\.0+)?\n20\n0(?:\.0+)?\n40\n400(?:\.0+)?\n/.test(resized), 'Ø desky a obvodová kružnice se zvětší na 800 mm');
check(resized.includes('\n10\n' + (2.15 + (250 - 2.15) * scale).toFixed(6) + '\n20\n0\n40\n3.5\n'), 'poloha otvoru se zvětší, jeho průměr zůstane 7 mm');
const plate = S.transformMotylekDxf(sample, 'A', { model: 'motylek', H: 650, topD: 800 });
check(plate.includes('\n11\n' + (2.15 + (12 - 2.15) * scale).toFixed(6) + '\n21\n650\n'), 'výška DXF podnože roste a středový zámek si drží zdrojovou šířku');
function dxfLines(text) {
  const rows = text.replace(/\r\n/g, '\n').split('\n'), found = [];
  for (let i = 0; i + 1 < rows.length;) {
    if (rows[i].trim() !== '0') { i += 2; continue; }
    const type = rows[i + 1].trim(); let end = i + 2;
    while (end + 1 < rows.length && rows[end].trim() !== '0') end += 2;
    if (type === 'LINE') {
      const vals = {};
      for (let j = i + 2; j < end; j += 2) vals[rows[j].trim()] = Number(rows[j + 1]);
      found.push([[vals['10'], vals['20']], [vals['11'], vals['21']]]);
    }
    i = end;
  }
  return found;
}
const sourceA = fs.readFileSync(path.join(__dirname, '..', 'assets/stolecky/motyli_stolek/podnoz_A_4mm.dxf'), 'utf8');
const sourceB = fs.readFileSync(path.join(__dirname, '..', 'assets/stolecky/motyli_stolek/podnoz_B_4mm.dxf'), 'utf8');
const dxfA = S.transformMotylekDxf(sourceA, 'A', { model: 'motylek', H: 650, topD: 800 });
const dxfB = S.transformMotylekDxf(sourceB, 'B', { model: 'motylek', H: 650, topD: 800 });
const dxfDesk = S.transformMotylekDxf(source, 'deska', { model: 'motylek', H: 650, topD: 800 });
const verticalJoint = dxfLines(dxfA).some((line) => Math.abs(line[0][0] - 2.15) < 1e-6 && Math.abs(line[1][0] - 2.15) < 1e-6 &&
  Math.abs(Math.min(line[0][1], line[1][1]) - 383.5) < 1e-6 && Math.abs(Math.max(line[0][1], line[1][1]) - 644.8) < 1e-6);
check(verticalJoint, 'skutečný DXF A zachová 4,3mm zámek při změně výšky');
const verticalJointB = dxfLines(dxfB).some((line) => Math.abs(line[0][0] - 2.15) < 1e-6 && Math.abs(line[1][0] - 2.15) < 1e-6 &&
  Math.abs(Math.max(line[0][1], line[1][1]) - 383.5) < 1e-6);
check(verticalJointB, 'skutečný DXF B končí v přesné stejné výšce zámku jako podnož A');
const scaledSlotY = S.mapMotylekRadial(176.85, scale);
const tableSlot = dxfLines(dxfDesk).some((line) => Math.abs(line[0][0] - scaledSlotY) < 1e-6 && Math.abs(line[1][0] - scaledSlotY) < 1e-6 &&
  Math.abs(Math.abs(line[0][1] - line[1][1]) - 4.3) < 1e-6);
check(tableSlot, 'skutečný DXF desky zachová šířku montážní drážky a sladí její polohu s podnoží');

const baseline = S.build({ model: 'motylek', H: 500, topD: 600 });
const resizedBuild = S.build({ model: 'motylek', H: 650, topD: 800 });
check(baseline.cfg.H === 500 && baseline.cfg.topD === 600, 'výchozí model zůstává Ø600 × 500');
check(resizedBuild.massKg > baseline.massKg && resizedBuild.surfaceM2 > baseline.surfaceM2,
  'orientační hmotnost a plocha povrchu reagují na rozměry');
check(resizedBuild.meshAsset && resizedBuild.meshScale && resizedBuild.meshScale.radial === scale && resizedBuild.meshScale.height === 1.3,
  '3D model dostává změněné měřítko od stejné konfigurace');
const cad = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets/stolecky/motyli_stolek/preview.json'), 'utf8'));
for (const dims of [{ H: 400, topD: 500 }, { H: 500, topD: 600 }, { H: 650, topD: 800 }]) {
  const transformed = cad.meshes.map((m) => S.transformMotylekMesh(m, m.name, Object.assign({ model: 'motylek' }, dims)));
  const toPoints = (m) => { const p = m.positions, out = []; for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]); return out; };
  const points = transformed.flatMap(toPoints);
  check(points.every((p) => p.every(Number.isFinite)), '3D mesh je konečný pro H' + dims.H + ' / Ø' + dims.topD);
  const desk = toPoints(transformed.find((m) => /deska/i.test(m.name)));
  check(Math.abs(Math.min(...desk.map((p) => p[2])) - (dims.H - 4)) < 0.01 && Math.abs(Math.max(...desk.map((p) => p[2])) - dims.H) < 0.01,
    '3D deska sedí ve výšce H' + dims.H + ' / Ø' + dims.topD);
  check(Math.max(...desk.map((p) => Math.hypot(p[0], p[1]))) <= dims.topD / 2 + 0.01,
    '3D obrys nepřesáhne Ø' + dims.topD);
  const legs = transformed.filter((m) => !/deska/i.test(m.name)).flatMap(toPoints);
  check(Math.abs(Math.min(...legs.map((p) => p[2]))) < 0.01 && Math.abs(Math.max(...legs.map((p) => p[2])) - dims.H) < 0.01,
    '3D podnože dosáhnou od podlahy až do desky H' + dims.H);
}

console.log(bad ? bad + ' chyb' : 'Motýlek parametrický: vše v pořádku');
process.exit(bad ? 1 : 0);
