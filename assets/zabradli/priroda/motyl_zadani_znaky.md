# Zadání variant motýla A/B/C

1. Zákazník může v řadě Příroda zvolit pro každé pole jednu ze tří variant: A = první dodaný obrázek, B = druhý dodaný obrázek, C = původní připravený motiv.
2. Všechny tři motivy tvoří jeden velký, jasně rozeznatelný motýl s květinami a rostlinami; bez dalších zvířat.
3. A a B jsou přesně dodané náhledy převedené na černou spojitou ocelovou plochu s bílými laserovými výřezy. C zachovává původní identifikátor `motyl`, aby fungovaly již uložené konfigurace.
4. Volby A/B/C zobrazují v konfigurátoru náhled motivu a lze je použít na rovné výplni i podporovaných schodištích 25–40°.
5. Generátor cílí na ocelové můstky 8 mm a výřezy od 6 mm; všechny uzavřené otvory musejí zůstat do 110 mm.

## Předpoklady

- Obrázky A a B jsou oříznuty na vlastní panel, převedeny na 1bitovou geometrii a upraveny generátorem, který odstraňuje příliš drobné prvky a spojuje ostrůvky.
- Výška scény odpovídá generátoru řady Příroda (820 mm); šířka odpovídá poměru stran jednotlivých předloh. Konfigurátor scénu přiměřeně ořízne podle rozměru pole.
- Obrysy jsou zjednodušeny tolerancí 0,8 mm, aby DXF zůstal přehledný.
- Počítačová kontrola ověřuje geometrii, můstky a otvory na rovině i všech sedmi podporovaných sklonech. Před sériovou výrobou doporučuji zkušební výpalek v konečné tloušťce plechu.
