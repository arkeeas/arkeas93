# Zástěna s motýly podle fotografie — 800 × 2000 mm

Opravený návrh. Motiv 181 otvorů je vektorizovaný přímo z dodané fotografie a
zjednodušený na uzavřené laserové kontury. Proporce jsou upravené na zadaný
celkový rozměr. Fotografie není kótovaný výrobní výkres, proto jde o co
nejvěrnější proveditelnou interpretaci viditelného vzoru.

## Výstupy

- `nahled.png` — čelní náhled zástěny.
- `zastena_motyli_800x2000.FCStd` — editovatelná sestava FreeCAD.
- `zastena_motyli_800x2000.step` — 3D sestava pro předání.
- `vypln_720x1770_t2_C2.dxf` — výplň, plech 2 mm, 1:1 v mm; 1 vnější obrys
  a 181 uzavřených otvorů.
- `patka_40x100_t6_2xD14.dxf` — jedna kotvicí patka.
- `kusovnik.csv` — přehled dílů.
- `reference.png`, `trace_reference.py`, `artwork.json`,
  `build_panel.py` — podklad a reprodukovatelný postup.
- `kontrola.json`, `kontrola_step.json` — geometrické kontroly.

## Konstrukce

- Vnější čelní rozměr 800 × 2000 mm.
- Obvodový rám z jeklu 40 × 40 × 2 mm z místní knihovny profilů.
- Výplň z ocelového plechu 2 mm, 720 × 1770 mm, určená pro C2.
- Spodní příčka 150–190 mm nad zemí; stojky nesou dvě patky
  40 × 100 × 6 mm se dvěma otvory Ø14 mm v každé.
- Minimální vypočtená šířka ocelového můstku mezi dvěma výřezy 8,626 mm.
- Orientační hmotnost celé sestavy 29,05 kg při hustotě oceli 7850 kg/m³.

## Ověření a výroba

STEP byl znovu načten ve FreeCADu: je platný, obsahuje sedm platných těles
a má obálku 800 × 100 × 2000 mm. Plech má proti nevýřezanému polotovaru
odebraný objem 505 269,8 mm³; plocha otvorů v DXF souhlasí s 3D modelem.

Před řezáním zkontrolovat kompenzaci šířky řezu, kvalitu drobných otvorů,
konkrétní možnosti stroje C2 pro patky 6 mm a podle místa montáže ověřit
kotvení i zatížení větrem. Návrh neobsahuje statický posudek.
