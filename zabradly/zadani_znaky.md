# Zadání – zábradlí s geometrickým motivem

## Znaky požadované na modelu
1. Horní madlo může být rovné nebo šikmé a sleduje nastavenou trasu – zdroj: uživatel.
2. Opakující se motiv tvoří vnější a vnitřní obdélníkový rám – zdroj: referenční fotografie.
3. Výchozí horní plocha madla je 1000 mm nad místní pochozí čarou – zdroj: uživatel.
4. Délka a sklon se berou z parametrů konfigurátoru; rozteč motivů je nastavitelná – zdroj: uživatel a konfigurátor.
5. Horní svislá tyč se zasouvá do výřezu ve spodní stěně jeklu a svaří. Výřez má celkovou vůli 0,5 mm a tyč zasahuje 10 mm dovnitř – zdroj: uživatel; vůle a hloubka zasunutí jsou předpoklady.
6. Pod každým motivem je kotevní plech 60×80×6 mm se dvěma otvory Ø11 mm, rozteč středů 50 mm – zdroj: uživatel pro rozměr plechu a otvorů; rozteč otvorů je předpoklad.
7. STEP a FCStd obsahují oddělené těleso madla, modulu každého motivu a každé patky; sestavu lze znovu sestavit ze vstupů generátoru.

## Předpoklady pro demonstrační variantu
- Ukázka: délka 1600 mm po sklonu, sklon 30°, rozteč motivů 250 mm, horní plocha madla 1000 mm.
- Madlo z jeklu 40×40×2 mm; rámy z pásoviny 12×6 mm; vnější rozměr motivu 130×640 mm a vnitřní rám 60×500 mm.
- Dolní hrana rámu je 90 mm nad kotevním plechem.
- FreeCAD ukázka je jedno přímé rameno. Konfigurátor podporuje i více rovných/šikmých úseků; skutečné schodiště po jednotlivých stupních není v CAD ukázce modelováno.
- Ocel S235 a hustota 7850 kg/m³ jsou předpoklady. Profil, patky, svar, kotvy a únosnost je třeba ověřit pro konkrétní stavbu; model není statický posudek.
