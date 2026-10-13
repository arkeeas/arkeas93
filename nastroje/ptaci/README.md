# Ptačí věšáky – plech, pálení C2

Siluety vlaštovek se jazýčkem, který se ohne do háčku. Jeden díl z plechu S235 4 mm, 1× pálení na C2 a 2 ohyby.

## Varianty
| soubor | póza | rozvin [mm] | hmotnost | délka řezu |
|---|---|---|---|---|
| `vystup/ptak_vzlet_*` | obě křídla nahoru | 150 × 229 | 0,29 kg | 884 mm |
| `vystup/ptak_mavnuti_*` | křídlo nahoru a dolů | 147 × 217 | 0,24 kg | 824 mm |
| `vystup/ptak_plachteni_*` | křídla roztažená | 152 × 202 | 0,22 kg | 789 mm |
| `vystup/ptak_klouzani_*` | křídla dozadu | 152 × 204 | 0,27 kg | 846 mm |

Každá varianta: `*_rozvin.dxf` (C2 – vrstvy OBRYS, OTVORY, OHYB, POPIS), `*.step` a `*.FCStd` (3D s ohnutým háčkem).

## Háček
- jazýček 22 mm, na zdi 60 mm pod tělem (2 díry Ø 5,5 se zahloubením Ø 11 × 90° z líce, na vrut 5 mm)
- ohyb 1: 90° od zdi, rameno 45 mm; ohyb 2: 90° nahoru, zarážka 18 mm (vnější rozměry)
- oba ohyby stejným směrem (k líci), vnitřní R 4, K = 0,33 → zkrácení ohybu 7,64 mm, rozvinutá délka jazýčku pod tělem 107,7 mm
- **K-faktor a poloměr ověřit na vaší ohraňovačce** (zkušební kus) – při jiném změnit `K` / `ri` v `ptaci.py`
- drážky v ohybech (snadné ohýbání): 11 × 8,4 mm uprostřed každého ohybu, můstky 2 × 5,5 mm
- pevnost: 10 kg na konci ramene ≈ 140 MPa v můstcích ohybu (S235 → rezerva ~1,7×)
- STEP čistý (jen úsečky, žádné mikrohrany) – společné funkce ve `vesak_lib.py` (kopírovat s `*_fc.py` do `~/snap/freecad/common/`)
- hroty křídel a ocasu zaoblené R 1,5 (bezpečné, laser je vypálí čistě)

## Úpravy
1. `python3 ptaci.py` – tvary a parametry (`P`: tloušťka, velikost `span`, rozměry háčku; `POSES`: úhly a délky křídel) → `ptaci.json`, `nahled.svg`
2. `freecad.cmd -c "exec(open('/home/arkeas/snap/freecad/common/ptaci_fc.py').read())"` (zkopírovat `ptaci_fc.py` do `~/snap/freecad/common/`) → `vystup/`
3. `python3 nahled.py <mesh.json>` → `nahled_vyroba.png`
