# Zábradlí s geometrickým motivem – parametrická varianta konfigurátoru

Model je variantou výplně odvozenou z přiložené fotografie. V konfigurátoru používá aktuálně nastavenou délku, sklon, výšku, profil madla, povrch a rozteč motivů. Vstupy a výchozí hodnoty jsou v [konfigurace.json](konfigurace.json); [build_model.py](build_model.py) je generátor FreeCADu. Délka a sklon nejsou zapečené do návrhu.

## Soubory

- `build_model.py` – parametrický generátor, ukládá FCStd, STEP, CSV a metadata.
- `konfigurace.json` – návrh vstupního schématu pro konfigurátor.
- `zabradli_geometricky_motiv.FCStd` a `.step` – ukázková sestava.
- `kusovnik.csv`, `model_info.json` – základní soupis a použitá nastavení.
- Každý motiv má samostatnou kotevní patku 60×80×6 mm se dvěma otvory Ø11 mm (rozteč 50 mm).
- Ve spodní stěně horního jeklu je pod každou tyčí obdélníkový otvor. Má celkovou montážní vůli 0,5 mm a tyč zasahuje 10 mm do jeklu pro obvodové svaření.
- `zadani_znaky.md` – požadavky, konstrukční předpoklady a limity ukázky.

## Vstupy konfigurátoru

Konfigurátor nabízí výšku madla, rozteč motivů a volitelnou dřevěnou krycí lištu; výchozí je ocelové madlo bez dřeva. Délka a sklon se převezmou z nastavení trasy. Počet motivů se odvodí od délky, rozteče, sklonu a šířky; zbylá délka se rozdělí na koncové okraje. Pro rovné zábradlí se použije sklon 0°. Výška 1000 mm označuje horní plochu madla nad místní pochozí přímkou. Změna parametrů CAD ukázky se provede voláním `build_model({...}, výstupní_složka)` ve FreeCAD Python prostředí.

## Konstrukční předpoklady a limity prototypu

- Ukázka: délka 1600 mm po sklonu, sklon 30°, horní plocha madla 1000 mm nad pochozí přímkou, rozteč motivů 250 mm.
- Madlo je dutý jekl 40×40×2 mm. Motiv tvoří vnější a vnitřní obdélníkový rám z pásoviny 12×6 mm; vnější výška 640 mm.
- CAD ukázka používá jedno přímé rameno v jedné rovině; konfigurátorová varianta navazuje motivy i madlo na jednotlivé zadané rovné a šikmé úseky.
- Základní patka je výchozí geometrie, nikoli staticky ověřený kotevní návrh. Rozteč otvorů a způsob kotvení ověřte podle konkrétního podkladu.
- Není to schválený výrobní návrh ani statické posouzení. Průřezy, spoje, kotvení, mezery a únosnost je třeba potvrdit podle skutečného použití.
- Samostatný kód konfigurátoru není v tomto pracovním projektu; balíček dodává geometrii i konfigurační schéma jako podklad k jeho napojení.
