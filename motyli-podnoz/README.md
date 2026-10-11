# Motýlí podnož

Model je zařazen v záložce **Umělecké** jako náhled dodaného STEP souboru. Náhled používá triangulovanou síť (59 104 trojúhelníků, 33 těles), odvozenou z `/home/arkeas/Desktop/cad_worker/motyli_podnoz.step` pomocí FreeCAD 1.1.3.

## Ověřeno

- Původní STEP se načetl jako platný B-rep s 33 platnými tělesy, 1 786 plochami a obálkou 1 532,526 × 842,028 × 728 mm.
- Kontrola výrobního workflow nehlásila geometrickou chybu; celkový stav je `VAROVANI`.
- Čtyři složitá tělesa kontrola označila jako pravděpodobně ohýbaný plech s nestandardním ohybem. Tloušťky z protokolu jsou heuristické odhady.

## Omezení

- V konfigurátoru jsou rozměry zdrojové sestavy zobrazené jako pevné a nelze je měnit. Síť je určena pro vizualizaci, nikoli pro úpravy CAD geometrie.
- Profilové průřezy, výrobní postupy, svary a záměr jednotlivých dotyků nebyly ověřeny proti výkresu ani zdrojovému editovatelnému CAD modelu.
- Cena, nosnost, pevnostní analýza a schválení pro výrobu nejsou k dispozici. UI je nezobrazuje jako ověřené.
- Pro výrobní použití je nutné překreslit díly parametricky a zkontrolovat jejich spoje.

Podrobný protokol je v `kontrola.json`; charakteristiky a jejich zdroje jsou v `zadani_znaky.md`.
