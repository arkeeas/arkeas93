# Zástěny – návrh zákaznického konfigurátoru

## Cíl

Přidat do zákaznické části webu `arkeas93` novou položku **Zástěny** a umožnit zákazníkovi nakonfigurovat zástěnu s motýlím motivem, zadat vlastní rozměry a odeslat nezávaznou poptávku, kterou zpracuje stávající dílenská stránka.

## Schválený rozsah

- Prvním produktem je zástěna s motýlím výřezem podle dodaných CAD podkladů.
- Zákazník zadá šířku a výšku, vybere povrch a počet kusů, přidá kontaktní údaje a poznámku.
- Zákaznická stránka nabídne otočitelný 3D náhled. Změna rozměrů přizpůsobí náhled zadaným hodnotám.
- Stránka nezobrazuje cenu a neoznačuje vlastní rozměr za výrobně schválený. Výslovně uvede, že proveditelnost i cenu potvrdí dílna.
- Odeslaná poptávka se uloží přes stejnou databázovou abstrakci jako ostatní produkty a bude vidět v dílně.
- Dílenská stránka zobrazí rozměry, povrch, množství, kontakt a poznámku; poskytne také dodané výrobní podklady jako **referenční pouze pro 800 × 2000 mm**.
- Podklady zůstanou dostupné pro původní rozměr 800 × 2000 mm. Pro jiné rozměry se automaticky negeneruje cena, výrobní STEP ani řezný DXF.

## Uživatelské rozhraní

Nová stránka `zasteny.html` bude následovat produktový vzor `stolecky.html` a `zabradli.html`: horní produktové menu, 3D náhled, nastavení a formulář poptávky. Odkaz **Zástěny** bude doplněn do horního menu všech zákaznických produktových stránek.

Konfigurace obsahuje šířku a výšku v milimetrech, povrch ze stávající nabídky, počet kusů a nepovinnou poznámku. Náhled zachová poměr motivu a přizpůsobí jej vnitřní ploše rámu. Text u náhledu a před odesláním upozorní, že vlastní rozměry jsou předmětem ručního posouzení.

Validace vyžaduje kladné rozměry a počet kusů alespoň 1, jméno a platný e-mail. Nezobrazuje se odhad ceny, dostupnost ani příslib výrobního termínu.

## Data a dílenský tok

Poptávka se uloží do existujícího dokumentu `poptavky/{uid}` jako položka s `product: "zastena"`, stavem `nova`, zákaznickými údaji a konfigurací `{ width, height, finish, qty }`. Současný formát `items` a stávající stavový tok zůstanou zachované.

V `interni.html` přibude produktová obsluha poptávek zástěn: seznam je jasně odliší od ostatních produktů a otevření zobrazí kompletní konfiguraci a kontaktní údaje. Detail nabídne původní technické soubory a viditelné upozornění, že jde o výrobní referenci rozměru 800 × 2000 mm; zakázkové rozměry musí být ověřeny ručně.

## CAD podklady

Do `assets/zasteny/motyli_800x2000/` se uloží použitelné dodané podklady: zdrojový FreeCAD dokument, STEP, DXF výplně a patek, CSV kusovník, kontrolní JSON, náhled a zdrojové soubory motivu/modelu včetně README. Do repozitáře se nepřidávají dočasné `.FCBak` soubory ani `__pycache__`.

3D náhled bude odvozen z dodaných kontur motivu a konstrukčních rozměrů. Uživatel může rozměr měnit pro vizuální představu; toto přizpůsobení není výrobním modelem ani posouzením minimálních můstků, stability, kotvení, zatížení větrem nebo statiky.

## Změněné části

- `zasteny.html` — zákaznické UI a formulář.
- `zasteny-core.js` — normalizace a validace konfigurace, popis poptávky.
- `zasteny-viewer.js` — Three.js náhled zástěny a jeho přizpůsobení rozměrům.
- `assets/zasteny/motyli_800x2000/` — dodaný referenční CAD balík.
- `index.html`, `vyvoj.html`, `zabradli.html`, `stolecky.html` — společná produktová navigace.
- `interni.html` a produktový dílenský skript — seznam a detail poptávek zástěn s odkazy na reference.
- `README.md` — popis nové stránky, poptávkového toku a omezení CAD reference.
- `tests/` — cílená kontrola konfigurace, náhledu a dílenského toku podle existujících vzorů.

## Rizika a hranice

- Dodaná sestava neobsahuje ověřené ceny ani statické posouzení.
- Dodané STEP/DXF odpovídají pouze 800 × 2000 mm a jejich texty již uvádějí konstrukční předpoklady (včetně neověřeného kotvení a limitu laseru pro patky 6 mm).
- Náhled po změně rozměrů může ukázat proporce, ale nesmí sloužit jako potvrzení vyrobitelnosti ani jako generovaný řezný podklad.
- Repozitář ukládá testovací poptávky do lokálního úložiště prohlížeče, pokud není dostupné produkční připojení; stávající chování se nemění.

## Kritéria přijetí

1. Zákazník najde **Zástěny** z ostatních produktových stránek a stránka otevře funkční konfigurátor.
2. Změna šířky, výšky, povrchu nebo množství aktualizuje souhrn a 3D náhled; neukáže cenu.
3. Platná poptávka uloží `product: "zastena"` se všemi hodnotami a zákaznickými údaji do existujícího toku.
4. Dílna zobrazí poptávku, umožní ji otevřít, zobrazí upozornění pro zakázkový rozměr a zpřístupní referenční CAD soubory.
5. Stránka i dílna zřetelně odliší referenční model 800 × 2000 mm od individuálně požadovaných rozměrů.
