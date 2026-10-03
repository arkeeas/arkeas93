# Podnože na míru – konfigurátor (testovací verze)

Konfigurátor ocelových podnoží stolů. Má dvě části, mezi kterými se přepíná záložkou nahoře:

- **Zákazník** (`index.html`): výběr tvaru podnože, rozměry, profil jeklu, spoje, povrch a deska. Obsahuje 3D náhled, orientační nosnost, cenu a nezávaznou poptávku.
- **In progress** (`vyvoj.html`, záložka vedle *Podnože*): rozpracované modely se stejným postupem jako podnože (tvar, rozměry, jekl, povrch, deska, 3D náhled, nosnost, cena, poptávka). Poptávky z ní se v dílně otevřou a stáhnou stejně.
- **Dílna** (`interni.html`): přijaté poptávky, objednávka a stažení podkladů (.zip), audit konstrukce všech tvarů a ceník.
- **Testing** (`montaz.html`): stejná podnož jako u zákazníka (sdílí nastavení se záložkou Zákazník / In progress), ale pro dílnu:
  - *Rozložit* – posuvník rozloží podnož (každý díl odjede cestou, kterou se nasazuje), kliknutím vybereš díl, vysuneš ho zvlášť, ukážeš jen jeho navazující díly, nebo necháš podnož rozebrat po jednom. Zámky (oranžově) a drážky/otvory (žlutě) jsou zvýrazněné.
  - *Postup* – naklikáš pořadí skládání (nebo „Navrhnout pořadí“), krokuješ / přehráváš. Díl přijede ze směru, kterým ho jde fyzicky nasadit: zámky dávají směr přesně, dosedací plochy (pokosy, tupé spoje, výřezy) ho omezují – třeba spodní příčku mezi dvěma pokosy jde zasunout jen bokem. Když díl tímhle pořadím nejde nasadit (zámky proti dosedacím plochám, zaklíněný díl) nebo cestou na místo narazí do už položeného dílu, stránka to označí a řekne, který díl položit dřív. „Vzhůru nohama“ = rám leží na stole.
  - *Svářečka* – každý svar se vyhodnotí v kroku, kdy vzniká: ~50 směrů hořáku (kužel trysky + válec, rozměry nastavitelné, MIG/TIG) proti už položeným dílům a stolu. Zelená / oranžová / červená + příčina (ostrý úhel, stůl, konkrétní díl, který překáží). Kliknutím kamkoli ukáže volný kužel přístupu a hořák v nejlepším směru.

**Online:** https://arkeeas.github.io/arkeas93/ (po zapnutí GitHub Pages, viz níže)

## Jak testovat

1. V záložce **Zákazník** nastavte podnož a klikněte na **Nezávazně poptat**. Vyplňte jméno a e-mail a odešlete.
2. Přepněte na záložku **Dílna → Poptávky**. Poptávka tam je. **Otevřít** ji převede do záložky *Objednávka a podklady*.
3. **Stáhnout podklady (.zip)** stáhne složku zakázky: sestavu STEP, kusovník PDF, testovací doklad o zaplacení, `dily/K2/*.step` (jekly) a `dily/C2/*.dxf` (plechy).

> **Důležité:** zatím neexistuje server. Poptávky a ceník se ukládají **jen v prohlížeči**, ve kterém byly zadány. Zákazník a dílna se proto musí testovat ve stejném prohlížeči. Každý tester má svoje vlastní data. Skutečné odesílání poptávek do firmy přijde se serverem a nahradí se jen soubor `lokal.js`.

### Lokálně
Na GitHubu **Code → Download ZIP**, rozbalit a otevřít `index.html`. 3D náhled používá knihovnu three.js z internetu. Bez připojení se ukáže zjednodušený 2D náhled.

## Soubory

| Soubor | Co dělá |
|---|---|
| `index.html` | stránka pro zákazníky |
| `interni.html` | stránka pro dílnu |
| `core.js` | tvary podnoží, geometrie, výpočet nosnosti (EN 12521), cena, kusovník |
| `gen.js` | výrobní podklady: STEP, DXF, PDF, ZIP |
| `viewer.js`, `figure.js` | 3D náhled a postava pro měřítko |
| `vyvoj.js` | rozpracované modely (In progress): vlastní booleovské jádro pro rovinná tělesa, Pohozenec – zámky a Pohozenec – spojovák |
| `vyvoj.html` | stránka In progress |
| `montaz.html`, `montaz.js` | stránka Testing – rozložení, postup skládání, sonda svářečky |
| `montaz-core.js` | jádro Testing bez 3D: díly, zámky, dosedací plochy a směry nasazení, kontrola cesty na místo, hledání svarů, přístup hořáku (běží i v Node) |
| `lokal.js` | náhrada databáze a stahování mimo Claude (localStorage) |
| `modebar.css` | horní přepínač Zákazník / Dílna |
| `tests/` | kontrola STEP bez CAD |

### Kontrola STEP (Node.js 18+)
```bash
node tests/kontrola-step.js 1600 800 750
```
Vygeneruje STEP všech tvarů a zkontroluje uzavřenost těles, orientaci ploch a geometrii.

### Kontrola stránky Testing (Node.js 18+)
```bash
node tests/kontrola-montaz.js 1600 800 750 -v
```
Pro každý tvar: díly, zámky, svary, navržené pořadí (bez konfliktu nasazení a bez nárazu cestou na místo), směr nasazení u zámků a přístup hořáku ke každému svaru.

## Zapnutí odkazu (jednorázově)
GitHub → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → **Save**.

## In progress – rozpracované modely

| Model | Popis |
|---|---|
| **Pohozenec – zámky** (PZ2) | 4 nohy do „#“ kolem středu (A/B tvoří X zepředu, C/D X zboku). C a D mají v rozích výřezy na profil A a B (vůle 0,2 mm), A a B mají ve špičce zápich pro krajní pásovinu. Střední pásovina leží mezi špičkami C a D. |
| **Pohozenec – spojovák** (PZ3) | Stejné nohy bez zámků, v půlce výšky vodorovný plech 3 mm se 4 zuby do děr ve vnitřních stěnách jeklů. Nahoře 2 pásoviny D–A a C–B na špičkách. |

Rozteč patek a odsazení noh se dopočítá z rozměru stolu a profilu jeklu. Audit zatím u obou ukazuje nízkou stabilitu proti převržení na rozích obdélníkové desky (patky tvoří v půdorysu kosočtverec) – proto poptávku na stránce In progress neblokuje.
