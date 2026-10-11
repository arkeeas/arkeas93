# Motýlí podnož

Umělecká podnož používá aktualizovanou triangulovanou síť ze souboru `motyli_podnoz_jekl_40x40.step` (FreeCAD 1.1.3). Síť má 33 těles a 125 608 trojúhelníků. Je určena pouze pro zobrazení.

## Kontrola geometrie

- STEP se načetl jako 33 platných těles; audit nenašel geometrické chyby. Stav auditu je `VAROVANI`.
- Rozměr výsledné náhledové sítě: 1 532,5 × 842,0 × 728 mm.
- Audit B-rep uvádí obálku 1 532,5 × 842,0 × 732,0 mm, zatímco triangulovaná síť má výšku 728 mm. Před výrobou je potřeba tento 4mm rozdíl potvrdit v CADu.
- Audit označil 28 těles jako možné ohýbané plechy s nestandardním ohybem. Jde o automatickou heuristiku a neověřuje průřezy jeklu 40×40. Materiál ocel je předpoklad; odhad hmotnosti 48,66 kg není výrobní údaj.

## Omezení

- Rozměry jsou v konfigurátoru pevné. Síť není parametrický ani editovatelný CAD model.
- Profilové průřezy, výrobní postupy, svary a záměr dotyků nejsou ověřené vůči výkresu nebo zdrojovému editovatelnému CADu.
- Cena, nosnost, pevnostní analýza a schválení pro výrobu nejsou k dispozici. UI je nezobrazuje jako ověřené.
- Před výrobou je nutné potvrdit průřezy a spoje v editovatelném CADu nebo výkresu.

Podrobný audit je v `kontrola.json`; znaky a předpoklady jsou v `zadani_znaky.md`.
