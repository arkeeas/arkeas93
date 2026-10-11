# Zadání – parametrický Motýlek

## Znaky

1. Kruhová horní deska z ocelového plechu tl. 4 mm; průměr 500–800 mm po 50 mm. Zdroj: uživatel schválil rozsah 11. 10. 2026; výchozí zdrojový DXF/STEP Ø600 mm.
2. Celková výška stolku 400–650 mm po 10 mm; výchozí zdrojový STEP 500 mm. Zdroj: uživatel schválil rozsah 11. 10. 2026.
3. Podnož tvoří díly A a B z plechu tl. 4 mm, vzájemně kolmých; jejich obrys se musí upravit společně s deskou a výškou. Zdroj: dodané STEP a DXF, uživatel požaduje, aby díly zapadaly.
4. Středový zámek A/B si zachová vůli a šířku pro plech 4 mm i při změně průměru. Zdroj: požadavek na funkční sestavení.
5. 3D náhled a stažitelné výrobní DXF musí odpovídat zvoleným rozměrům. Zdroj: uživatel.
6. Původní konfigurace Ø600 × 500 mm musí zůstat geometricky shodná s dodanými soubory. Zdroj: dodané STEP/DXF.

## Předpoklady

- Deska zůstává kruhová; „rozšíření desky“ znamená změnu jejího průměru.
- Výška se měří od podlahy k horní ploše desky.
- Ocelová varianta má tři laserované díly z plechu 4 mm. Varianta vlastní dřevěné desky má dva díly A/B a čtyři ocelové úchyty, vše z plechu 4 mm.
- Ocel a nosnost nejsou nově staticky přepočítány; konfigurátor mění rozměry a výrobní obrysy, nikoli deklaraci únosnosti.
- Změna průměru roztáhne obrys podnoží radiálně od středového zámku; oblast zámku zachová zdrojovou šířku 4,3 mm (polovina 2,15 mm), aby se nezměnila původní vůle.
- Výrobní export dostupný v prohlížeči je DXF. Původní STEP slouží jako výchozí geometrický zdroj; pro jiné rozměry jej nelze vydávat za aktualizovaný bez parametrického STEP exportu.
- Varianta vlastní desky: zákazník dodává kruhovou dřevěnou desku Ø 500–800 mm, tloušťku zadá 10–60 mm; výška stolku je vždy po horní plochu. Deska se připevní čtyřmi radiálně orientovanými drážkami 18 × 5,5 mm ve čtyřech ocelových úchytech 44 × 44 × 4 mm. Čtyři úchyty se přivaří na horní konce podnoží v osových polohách odpovídajících původním montážním výřezům. Ocelová deska se v této variantě nevyrábí a není zahrnuta v hmotnosti/ceně.
- U vlastní desky pod 18 mm musí dílna potvrdit vhodnou délku vrutů a jejich únosnost; bez statického výpočtu se nosnost celé sestavy neuvádí.
