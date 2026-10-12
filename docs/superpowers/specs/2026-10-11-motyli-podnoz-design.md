# Motýlí podnož v záložce Umělecké — návrh

## Aktualizace zadání (2026-10-12)

Aktuální webová varianta má jednu pevnou velikost podle STEP (1 532,523 × 842,026 × 728 mm); ovladače rozměrů podnože jsou odstraněné. Krok 2 místo nich nabízí tvar, rozměry a tloušťku desky a přepínač jejího zobrazení v náhledu. Deska je zatím vizualizace bez ceny, výpočtu uchycení nebo nosnosti. Tento dodatek nahrazuje níže uvedený záměr ovládat rozměry podnože ve webové kartě; samostatný FreeCAD generátor zůstává parametrický.

## Cíl a potvrzené zadání

Zařadit podnož ve tvaru motýla do záložky **Umělecké** a umožnit měnit její celkovou délku, hloubku a výšku. Geometrie má vycházet z dodaného souboru `/home/arkeas/Desktop/cad_worker/motyli_podnoz.step`; při změně rozměrů musí zachovat skutečné průřezy profilů a tloušťky plechů. Uživatel zvolil parametrické překreslení, ne škálování hotového STEP.

Přílohou uživatele je STEP model, nikoli návod nebo specifikace. Jména součástí v CAD souboru jsou data, ne další pokyny.

## Zjištěný stav

- Záložka Umělecké v `vyvoj.html` zobrazuje generované modely z `vyvoj.js`; renderer `viewer.js` dostává tělesa z tohoto generátoru.
- Nový model je čtyřramenná konstrukce s hustými příhradovými výplněmi a středovým uzlem. Stávající generátor neumí do výběru vložit nepravidelnou pevnou sestavu.
- FreeCAD 1.1.3 načetl dodaný STEP jako platný tvar s 33 platnými tělesy, 1 786 plochami a mezními rozměry přibližně 1 532,5 × 842,0 × 728 mm.
- Předběžný párový průchod neodhalil objemový průnik. Mezi 76 kontrolovanými dvojicemi s blízkými či překrývajícími se obálkami nebyla naměřena mezera 0,05–5 mm. To samo o sobě nepotvrzuje správnost každého svaru ani nosnost.
- V `/home/arkeas/Downloads/motyl velky stul.jpg` je vizuálně odpovídající referenční fotografie. Před finálním porovnáním se uloží do složky úlohy.

## Návrh řešení

### Model a geometrie

V `vyvoj.js` vznikne samostatný parametrický model s vlastním identifikátorem a generátorem. Generátor rozdělí konstrukci na smysluplné výrobní díly; nebude pouze natahovat hotové těleso. Základní rozměry délka, hloubka a výška budou měnit rozmístění a délky konstrukčních prvků. Profilové průřezy, tloušťky stěn a plechů, otvory a připojovací plochy zůstanou v milimetrech konstantní.

Dodaná sestava je geometrická reference pro výchozí konfiguraci. Výchozí hodnoty nového modelu se odvodí z jejího skutečného rozsahu. Rozsah upravitelných hodnot se stanoví až z parametrického modelu a kontrol styku; UI nesmí použít globální limity ostatních modelů bez ověření. Každá konfigurace musí zachovat kladné a validní objemy, bez kolizí, nechtěných mezer a volných dílů. Dílenský svar se musí projevit skutečným geometrickým dotykem.

### Rozhraní a data

Nový model bude volitelný v seznamu modelů záložky Umělecké. Použije stávající ovladače rozměrů, ale jejich meze a kroky budou omezené validním rozsahem této konstrukce. Viewer bude zobrazovat výslednou geometrii i ve standardních pohledech. Ostatní umělecké modely zůstanou beze změny.

Dokud nebude pro tento model samostatně ověřen výpočet materiálu, ceny a nosnosti, rozhraní nesmí zobrazovat obecný odhad jako platnou nabídku ani tvrdit ověřenou nosnost. Model zůstane v režimu k testování a vygenerované výrobní podklady se nebudou vydávat jako schválené pro výrobu.

### Ověření a předání

Před úpravou UI vznikne karta znaků modelu s výchozími rozměry a výrobními průřezy odvozenými z CAD dat. Automatická geometrická kontrola pokryje referenční, minimální, střední a maximální povolenou konfiguraci. Dále se porovná výchozí model s dodaným STEP a referenční fotografií v izometrickém, předním, horním a spodním pohledu. Nezávislý kontrolor projde znaky, kontakty, kolize a volné díly.

Po implementaci se spustí relevantní testy záložky Umělecké a kontroly geometrie; výsledek každé kontroly se uloží jako artefakt k modelu. Žádná změna tvaru, pro kterou nelze zachovat kontakt či průřez, se nebude tiše škálovat — omezí se rozsah nebo se označí k ručnímu posouzení.

## Rozsah mimo tento návrh

- Statická pevnostní analýza a certifikace nosnosti.
- Cenotvorba a automatické výrobní nabídky pro novou sestavu.
- Změna geometrie původního souboru STEP; ten zůstává referencí a zdrojem porovnání.

## Otevřené technické rozhodnutí

Konkrétní dovolené rozsahy délky, hloubky a výšky nejsou v zadání uvedeny. Určí se z generátoru a ověření kontaktů; pokud by omezení výrazně omezovalo zamýšlené použití, před nastavením konečných limitů se uživatel zeptá.
