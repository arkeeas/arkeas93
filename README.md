# Podnože na míru – konfigurátor (testovací verze)

Konfigurátor ocelových podnoží stolů. Má dvě části, mezi kterými se přepíná záložkou nahoře:

- **Zákazník** (`index.html`): výběr tvaru podnože, rozměry, profil jeklu, spoje, povrch a deska. Obsahuje 3D náhled, orientační nosnost, cenu a nezávaznou poptávku.
- **Umělecké** (`vyvoj.html`, záložka vedle *Podnože*): modely **Kosočtverec** (boky z trojúhelníků a kosočtverce z pásoviny na hranu, spojené závitovými tyčemi s maticemi), **Pavouk** (hvězdicová podnož jen z jeklů – 4 ramena k zemi a 4 k desce, rozmístění X v rozích nebo kříž 90°) a **Pohozenec** (zatím rozpracované) se stejným postupem jako podnože (tvar, rozměry, jekl, povrch, deska, 3D náhled, nosnost, cena, poptávka). V Kroku 1 se volí **spojení noh** (*zaseknuté do sebe* – výřezy v nohách C a D, nebo *spojovací plech* se 4 zuby uprostřed) a **horní část** (*3 příčné pásoviny*, *2 šikmé pásoviny* přes špičky, *kříž z pásovin* – běžný pro kulaté a čtvercové desky, *obvodový rámeček* s pokosy 45° – pro kámen, sklo a tenké desky, *rámeček z jeklu* naležato (10×10 až 40×40), nebo *4 plotny na špičkách*). U pásovin a ploten jde zvolit **tloušťku** (2–5 mm), **šířku** (20–50 mm nebo auto) a **délku** (pásoviny: auto nebo vlastní v mm, plotny: 80–250 mm). Pásoviny i plotny se vždy zkrátí, aby nepřečuhovaly přes desku (nechá se okraj 20 mm), ale vždy zakryjí špičky noh; u ploten **tvar** (obdélník nebo **X** se 4 otvory na koncích ramen), u rámečku z jeklu **profil** 10×10, 15×15, 20×10, 20×20, 25×25, 30×15, 30×20, 30×30, 35×35, 40×20, 40×30, 40×40 (auto 40×20; do jeklu užšího než 25 mm se nevejde montážní otvor, takže jen lepení nebo svorníky, pod 16 mm jen lepení). Když zvolený rozměr nezakryje špičku nohy nebo ho nedovolí geometrie, použije se nejbližší možný a stránka to napíše. Navíc **Krok 7 – Uchycení k desce**: truhlář si vybere ze 6 způsobů – *vruty do dřeva* (pevný bod Ø9 + ovály 40×9 pro dilataci masivu), *zapuštěné vruty* (Ø5,5 se zahloubením, čistý vzhled, pro DTD/MDF/překližku), *závitové vložky M6* (opakovaná montáž, deska od 22 mm), *stolové spony* (pevný bod + spony přes hranu pásoviny, pro masiv) *lepení* (bez otvorů, pro kámen, sklo, HPL) a *vlepené svorníky* (navařené M8, vlepí se do slepých děr v desce). Spony jdou jen s pásovinami. Podle volby se změní otvory v pásovinách (3D, STEP, DXF), spojovací materiál v kusovníku, cena a postup *Pro truhláře* (vrták, hloubka podle tloušťky desky) – ten je i v ZIPu dílny jako `*_pro_truhlare.txt`. Poptávky z ní se v dílně otevřou a stáhnou stejně.
- **Zábradlí** (`zabradli.html`, záložka v hlavním menu vedle *Podnože*): **jeden typ, který si zákazník poskládá** – sloupky ano/ne (s roztečí 600–1500 mm), madlo dřevěné / horní rám, profil rámu, špruše 20–60 mm se spojem podle šířky, přesah špruší nahoře a dole. Trasa po úsecích (délka, převýšení u schodiště, zatočení), výška, kotvení (z boku přes fasádu / shora patkami pod sloupky, i na schodišti / sloupky přes čelo s plotnou do čela desky / bez kotev) a podklad, konce přikotvené ke zdi, tepelně oddělující podložky pod plotny, povrch a služby (zaměření, pomoc s kotvením, montáž). **Kotvy** jde rozmístit roztečí, nebo je v rozvinutém pásu táhnout po jedné – přichytí se jen na povolené místo (mezera mezi špruše nebo sloupek, mimo roh a styk pole). Mezery hlídají meze z ceníku dílny: nad doporučenou varování, nad maximem nejde poptat. **Podle stavby** (Krok 2 → *Podle stavby*): zákazník poskládá bloky (rovná hrana, schodiště, rohy, konec volný / u zdi) a změří je – každý rozměr dvakrát jinou cestou (hrana A + kontrolní B z druhého konce, roh přes značky 1 m a úhlopříčku C – z ní se spočítá skutečný úhel a jde jedním klikem převzít, schody n × h proti převýšení H). U každé míry je **?** s obrázkem a návodem, pod tím půdorys a seznam *co změřit / co přeměřit*. Chybějící míra = nejde poptat, nesedící = varování; v dílně je u poptávky vidět, jestli rozměry sedí. 3D náhled se stavbou (i jednotlivé schody) a cena s rozpisem. Poptávka jde do stejné dílny jako podnože.
- **Dílna** (`interni.html`): přijaté poptávky, objednávka a stažení podkladů (.zip), audit konstrukce všech tvarů a ceník.
- **Testing** (`montaz.html`): stejná podnož jako u zákazníka (sdílí nastavení se záložkou Zákazník / Umělecké), ale pro dílnu:
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
| `vyvoj.js` | umělecké modely (záložka Umělecké), uchycení k desce (`MOUNTS`): vlastní booleovské jádro pro rovinná tělesa, Pohozenec (spojení noh × horní část × uchycení; staré poptávky PZ2/PZ3 se převedou) |
| `vyvoj.html` | stránka Umělecké |
| `montaz.html`, `montaz.js` | stránka Testing – rozložení, postup skládání, sonda svářečky |
| `montaz-core.js` | jádro Testing bez 3D: díly, zámky, dosedací plochy a směry nasazení, kontrola cesty na místo, hledání svarů, přístup hořáku (běží i v Node) |
| `zabradli.html` | stránka Zábradlí pro zákazníky |
| `zabradli-core.js` | zábradlí bez 3D: trasa, díly typu 01 a 02 (port generátorů ze skillu sldprt-zabradli), zámky, kotvy, tělesa, kusovník, cena (běží i v Node) |
| `zabradli-viewer.js` | 3D náhled zábradlí se stavbou (deska, fasáda) |
| `zabradli-dilna.js` | dílna – záložka *Zábradlí – podklady*: kusovník, 3D, ZIP (sestava STEP, `dily/K2` jekly, `dily/pasovina`, `dily/C2` plotny a patky, kusovník PDF, **řezný plán PDF**, doklad), ceník zábradlí |
| `lokal.js` | náhrada databáze a stahování mimo Claude (localStorage) |
| `modebar.css` | horní přepínač Zákazník / Dílna |
| `tests/` | kontrola STEP bez CAD, zámků a drážek, stránky Testing |

### Kontrola STEP (Node.js 18+)
```bash
node tests/kontrola-step.js 1600 800 750
```
Vygeneruje STEP všech tvarů a zkontroluje uzavřenost těles, orientaci ploch a geometrii.

### Kontrola zámků a drážek (Node.js 18+)
```bash
node tests/kontrola-zamky.js -v
```
Všechny tvary × profily × tloušťky × 4 rozměry: každý zámek má drážku a projde jí, vede po ose dílu (je to kus stěny – jde vypálit), drážka leží celá v rovné části stěny rámu (ne v rohu, rádius ~2,4 t), zhruba uprostřed šířky, nepřetéká přes okraj ani pokos, má můstek k jiným drážkám a zámek nevyčnívá z rámu.

Pravidla v `core.js` (build): zámek se dává jen na stěny dílu, ze kterých padne doprostřed rovné spodní stěny rámu – u nohy v rohu jedna vnitřní stěna do podélného a druhá do příčného jekla, u dílu pod příčným jeklem dvě stěny napříč. Šikmý díl má zámek po své ose a drážka je na šikmý průchod. Velmi plochý díl (sklon pod 30°) zámek nemá. Když by se dva díly se zámky v boku navzájem blokovaly při nasazení (šikmé větve ze společného uzlu), jeden z nich zámky nemá a v kusovníku je zvlášť („– bez zámku“).

### Kontrola stránky Testing (Node.js 18+)
```bash
node tests/kontrola-montaz.js 1600 800 750 -v
```
Pro každý tvar: díly, zámky, svary, navržené pořadí (bez konfliktu nasazení a bez nárazu cestou na místo), směr nasazení u zámků a přístup hořáku ke každému svaru.

## Zapnutí odkazu (jednorázově)
GitHub → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → **Save**.

## Umělecké – rozpracované modely

Jeden model **Pohozenec**: 4 nohy do „#“ kolem středu (A/B tvoří X zepředu, C/D X zboku). Volby se kombinují:

| Volba | Možnosti |
|---|---|
| Spojení noh | **Zaseknuté do sebe** – C a D mají v rozích výřezy na profil A a B (vůle 0,2 mm). **Spojovací plech** – nohy se nedotýkají, v půlce výšky vodorovný plech 3 mm se 4 zuby do děr ve vnitřních stěnách jeklů. |
| Horní část | **3 příčné pásoviny** – krajní v zápichu špiček A a B, střední mezi špičkami C a D. **2 šikmé pásoviny** D–A a C–B na špičkách. **Kříž z pásovin** – B–A celá, D–C ze dvou půlek zaříznutých podél hrany B–A (1 mm na svar). **Obvodový rámeček** – 4 pásoviny s pokosy 45°, osy stran přes středy špiček. **Rámeček z jeklu** – totéž z jeklu 10×10 až 40×40 naležato (otvory v horní stěně, montážní otvory Ø15 ve spodní), v kusovníku jako jekly pro K2. **4 plotny** na špičkách noh – obdélník, nebo X (dvě ramena pod ±45° k noze, otvor na konci každého ramene). |
| Rozměry | tloušťka 2–5 mm, šířka 20–50 mm, délka pásovin / ploten (nikdy nepřečuhují přes desku), tvar ploten (obdélník / X), profil jeklu rámečku 10×10 až 40×40 |
| Uchycení k desce | vruty s ovály, zapuštěné vruty, závitové vložky M6, stolové spony (jen s pásovinami), lepení, vlepené svorníky M8 |

**Kosočtverec** (KS): 2 boky na koncích stolu (osa boku 100 mm / 10 % délky od čela desky, šířka boku = hloubka desky − 2 × 7 %). Každý bok je obdélník rozdělený na 4 rohové trojúhelníky a kosočtverec s vrcholy ve středech stran; mezi tvary je mezera (30–60 mm). Tvary jsou duté rámečky buď z **pásoviny** postavené na hranu – hloubka 60/80/100 mm, tloušťka 8/10/12 mm, v kusovníku každý pás zvlášť (DXF s otvory) – nebo z **jeklu** (40×40 až 100×40) svařené s pokosy v rozích, v kusovníku každý kus jeklu zvlášť (K2, STEP, úhly řezu); horní jekly mají ve spodní stěně montážní otvory pro šroubovák. Přes každou mezeru vedou 2 závitové tyče M12/M16/M20 se 4 maticemi a podložkami (tyče, matice a podložky jsou nakupované díly; v náhledu a sestavě STEP jsou, v kusovníku jako nákup). Deska leží na horních pásech horních trojúhelníků, otvory pro uchycení podle volby v Kroku 7. Pevnost se počítá zjednodušeně: ohyb tyčí přes mezeru, vyklonění boku z roviny a převržení. V Testing se tvary zasouvají kolmo k boku.

**Pavouk** (PV): jen z jeklů, 4 ramena dolů na patky a 4 nahoru ke špičkám. Rozmístění noh: **X v rozích** (±0,3 L × ±0,3 W, patky víc do čtverce, aby úhel úhlopříčky byl 35–55°) nebo **kříž 90°** (dvě delší nohy podél stolu ±0,34 L, dvě kratší přesně kolmo ±0,34 W). Rameno dolů a nahoru na opačné straně leží v jedné přímce (v úhlopříčných rovinách tvoří X). Na každé straně se rameno nahoru a dolů potkají jako „>“ s pokosem ve středu výšky, sousední strany na sebe dosednou rovnými řezy (roviny x = 0 a y = 0) – uprostřed nic dalšího není. U kříže 90° tvoří patky kosočtverec, takže stabilita na rozích obdélníkové desky je slabší. Horní část a uchycení jako u Pohozence (příčné = 2 přes špičky na koncích, „šikmé“ = 2 podélné). V Testing se skládá od ramen k zemi.

**Trojúhelníky** (TJ, zákaznická nabídka v *Podnože*, výpočet v `vyvoj.js`): na každém konci stolu rovinný bok. Spodní trojúhelník (základna na zemi, vrchol ve výšce `trH`) je jeden celý kus jeklu. Horní trojúhelník je obrácený (základna pod deskou) a v místě křížení se přeruší a navaří na spodní, takže oba tvary jsou do sebe zapuštěné a uprostřed vzniká kosočtverec. Volby: šířka základny `trA` (500–800 mm), výška vrcholu `trH` (400–650 mm, vždy nad polovinou výšky) a jekl `trJ`. Nosnost je zjednodušená (`auditTJ`: rovnoměrné zatížení horních pásů, bodová síla, vyklonění, převržení, svar), uchycení k desce jde zvolit stejně jako u ostatních modelů (otvory jsou v horních pásech), bez Testingu (`testing: false`, `tests/kontrola-montaz.js` ho vypisuje jako přeskočený).

Dřívější modely PZ2 (zámky + příčné pásoviny) a PZ3 (spojovák + šikmé pásoviny) se u starých poptávek převedou automaticky.

Rozteč patek a odsazení noh se dopočítá z rozměru stolu a profilu jeklu. Audit zatím ukazuje nízkou stabilitu proti převržení na rozích obdélníkové desky (patky tvoří v půdorysu kosočtverec) – proto poptávku na stránce Umělecké neblokuje.

### Kontrola zábradlí (Node.js 18+)
```bash
node tests/kontrola-zabradli.js -v
```
Vzor akce 01 (rám proti kusovníku vzoru) a akce 02 (pole, kotvy, vložky, madla proti `railing_b.py`), pak všechny typy × tvary × kotvení × strany a rám × špruše × spoj × přesahy: uzavřená tělesa, platný STEP dílů i sestavy, zámky jen v rovné části stěny rámu, počty drážek a zámečků podle spoje, zámeček přesně na tloušťku stěny. Trvá ~3 min.

Pravidla v `zabradli-core.js` (společná pro oba typy, funkce `barSet` a `jointInfo`): spoj špruše s rámem se řídí šířkou špruše proti rovné části stěny rámu (šířka − 2 × 2,4 t):
- **vejde se** (špruše + 2× vůle 0,5 ≤ rovná část) → drážka v rámu, špruše projde; s přesahem jde skrz rám **jedním kusem** (drážky v obou stěnách),
- **široká jako rám** (do šířky rámu) → **na tupo** (řez na pile), nebo za příplatek **zámečky**: konec špruše zúžený na zámeček, který projde stěnou a lícuje s jejím vnitřkem (nevyčnívá),
- **širší než rám** → vždy zámečky.

U spoje na tupo / se zámečky je přesah **samostatný kus** (se zámečky má spodní rám drážky z obou stran). Přesah nahoru jen bez dřevěného madla, dolů jen při kotvení z boku (jinak je spodní rám u podlahy). Příplatek za zámeček na špruši je v Dílna → Ceník (`zamekSpruse`, Kč/ks, zatím orientačně). Zinkovací otvory se nepřidávají. Patky shora i sloupky přes čelo jen se sloupky. **Vlastní úhel rohu** (rychlý režim i stavba): vnitřní úhel 60–179° (změna směru max. ±120°, ostřejší roh by dal pokosy přes 60°). Krajní špruše se od rohu odsadí podle úhlu a šířky špruše (c ≥ š/2·cotg α + t/2), aby se v rohu nesrazily – test kontroluje překryv svislých dílů v půdorysu. Skripty se načítají s `?v=verze` a stránka zábradlí hlásí, když se načte jádro jiné verze (stará mezipaměť) – při změně jádra zvedni verzi v `zabradli-core.js` i v HTML. Se sloupky jen čtvercový jekl (sloupek z 40×20 je napříč slabý). Interně je „se sloupky“ = typ A (port railing.py), „bez sloupků“ = typ B (railing_b.py) – kvůli uloženým poptávkám.

**Řezný plán** (`cutPlan` v `zabradli-core.js`, PDF v ZIPu): kusy jeklu a pásoviny na tyče od nejdelšího (první vhodná tyč), stejné tyče sloučené, nahoře co objednat. Délka kusu = nejdelší hrana (pokos celý, kusy se nezaklesávají – na straně jistoty). Délka tyče, prořez pily, řez K2 a nevyužitelný konec v upínači K2 (výchozí 6000 / 3 / 1 / 120 mm, odhad) nastavuje Dílna → Ceník. Cena zatím počítá materiál z kg, ne z počtu tyčí.

**Kotvy:** meze `kotvaMax` / `kotvaDop` (mezera mezi kotvami) a `kotvaKonecMax` / `kotvaKonecDop` (přesah konce za krajní kotvu) jsou v Dílna → Ceník. Výchozí 1500 / 1200 / 600 / 400 mm jsou **odhad, ne statický výpočet** – dílna je musí nastavit. Mezera přes půdorysný roh se hlídá jen proti maximu (roh je ztužený). Každé pole (bez sloupků) musí mít aspoň jednu kotvu. Výjimka s podpisem odpovědné osoby zatím není. Ceník zábradlí je zatím orientační.

**Způsoby kotvení:**
- **Shora (patky)** – patka 100×120×8 pod sloupkem. Na schodišti je spodní rám 40 mm nad čarou hran stupňů, sloupky jdou doprostřed stupňů (podle počtu schodů – v rychlém režimu ho zákazník musí zadat, jinak nejde poptat) a pod rámem mají nožku k patce. Na hraně podesty / zlomu je nožka s patkou 60 mm vedle na rovné straně (pod rovným rámem), na konci schodiště patka 160 mm na stranu, kde je podlaha ve stejné výšce – kotva je 60 mm od hrany.
- **Sloupky přes čelo** – spodní rám na čáře podlahy, pod každým sloupkem nožka a na jejím boku plotna 120×100×10 do čela desky (horní hrana 25 mm pod podlahou, na schodišti pod nejnižším stupněm v délce plotny). Jen bez zateplení. Rohy a zlomy se z boku kotvit nedají, proto je u každého kotevní sloupek 450 mm od rohu (`CELO_CORNER`).
- **Konec ke zdi** – na koncovém sloupku 2 plotny 120×100×10 (u horního a spodního rámu), mezera ke zdi 20 mm = plotna + 10 mm podložka / vyrovnání. Kotvy do zdi mají vlastní podklad (zdivo / beton) a cenu; konec u zdi se v kontrole kotev počítá jako ukotvený. Ve stavbě jde jen u konce „u zdi“.
- **Tepelně oddělující podložka** 10 mm pod plotny na čele a na zdi (ramena z boku, přes čelo, ke zdi). Rameno se o ni zkrátí. Cena `podlozka` v Dílna → Ceník (orientačně).
