# Motýlí podnož — parametrická rekonstrukce

Složka obsahuje parametrický nativní FreeCAD model, jeho generátor a přesnou STEP referenci. STEP je jediný dostupný zdroj; původní parametrický CAD ani výrobní výkres nejsou k dispozici.

## Závěr kontroly

- Aktualizovaný STEP obsahuje 33 validních B-rep těles v jedné sestavě.
- Hlavní rovné profily mají podle cylindrických ploch v rozích průřez 40×40×3 mm, vnější rádius 6 mm a vnitřní rádius 3 mm.
- Čtyři křídla mají každé šest obvodových jeklů 40×40×3 mm, jednu 5mm laserovanou výplň a horní montážní desku 110×86×8 mm se čtyřmi otvory Ø9 mm. Výplň je složitý samostatný B-rep, nikoli doložený parametrický plechový díl.
- FreeCAD 1.1.3 / OCC 7.8.1 potvrzuje B-rep obálku 1 532,526×842,028×732,014 mm; Z sahá od −4,014 do 728 mm. Čtyři hlavní profily přesahují pod nulovou rovinu.
- FreeCAD 1.1.3 / OCC 7.8.1 znovu otevřel výsledek parametrického generátoru: 33/33 těles je validních. Výchozí obálka je 1 532,522×842,026×732,014 mm; proti STEP se liší nejvýše o 0,004 mm. Celkový objem se liší o 42 mm³ z 6,198 mil. mm³ (0,0007 %).
- V nominální variantě má 24 sousedních spojů jeklů nulovou vypočtenou vzdálenost; největší numerický objemový průnik je 0,0021 mm³. Spoje jeklů, výplní, desek a uzlu byly samostatně porovnány v nominální variantě.
- V krajních rozměrových variantách i při zkoušce 1 600 × 780 mm se vygenerovalo 33/33 validních těles. Kontakty výplní a rámu v těchto změněných variantách nejsou potvrzené.

## Konfigurátor Umělecké

V konfigurátoru otevři záložku **Umělecké** a vyber **Motýlí podnož**. Webová varianta má jednu pevnou velikost podle STEP: 1 532,523 × 842,026 × 728 mm. V kroku **Deska** lze vybrat tvar, použít rozměry podnože nebo zadat vlastní rozměry a tloušťku. Desku lze zobrazit či skrýt v náhledu. Tato volba je pouze vizualizační; cena, uchycení desky a nosnost se nepočítají.

Rozměry nativního FreeCAD modelu lze stále upravit v tabulce **Parametry**, buňky `B2` (délka) a `B4` (výška). Ulož a zavři dokument, potom spusť `vytvor_parametricky_model.FCMacro`. Generátor načte hodnoty z tabulky, přepočítá geometrii a přepíše FCStd. Výsledná hloubka je odvozena od konstrukce; je uvedena v `B11`.

![Náhled parametrické rekonstrukce](/home/arkeas/src/arkeas93/motyli-podnoz/nahled_parametricky.png)

Povolený rozsah generátoru je délka 1 400–1 650 mm a výška 680–800 mm. Výsledné B-rep tělesa byla v krajních kombinacích tohoto rozsahu ověřena jako validní. Kontakty jednotlivých dílů jsou ověřené v nominální variantě; před výrobou jiné velikosti je nutné zkontrolovat dosednutí výplní a jeklů:

- půdorysné úhly křídel zůstávají stejné; délka a hloubka se mění společnou roztečí,
- jekly se generují jako samostatná tělesa s profilem 40×40×3 mm, rádiusy R6/R3 a pokosy odvozenými z ploch spojů STEP,
- laserovaná výplň se mění v její vlastní rovině a zachovává tloušťku 5 mm,
- horní deska 110×86×8 mm se čtyřmi otvory Ø9 se posouvá s křídlem, její rozměry se nemění.

`motyli_podnoz_parametricky.FCStd` je nativní soubor FreeCAD s výslednými B-rep tělesy a tabulkou parametrů. Neobsahuje historii plně editovatelných náčrtů a prvků: po změně tabulky se geometrie vytvoří znovu spuštěním makra. Laserovaná výplň je transformovaná původní STEP kontura, ne nový návrh výrobního profilu. `motyli_podnoz_reference.FCStd` zůstává neměnnou geometrií přímo z STEP pro porovnání. Model není pevnostní výpočet ani výrobní schválení; svary, únosnost a specifikaci materiálu je nutné ověřit samostatně.
