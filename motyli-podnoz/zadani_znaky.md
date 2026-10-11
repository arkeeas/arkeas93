# Karta znaků — Motýlí podnož

| Znak | Zjištěná hodnota | Zdroj a jistota |
|---|---|---|
| Celková obálka B-rep | 1 532,526 × 842,028 × 732,014 mm (Z −4,014…728 mm) | FreeCAD 1.1.3 / OCC 7.8.1; 4 jekly zasahují 4,014 mm pod Z=0. Připojený backend FreeCAD 1.1.1 uvádí 728 mm. |
| Počet samostatných těles | 33, všechna jsou validní | Aktualizovaný STEP; FreeCAD 1.1.3 a CAD audit. |
| Hlavní průřez | Zaoblený dutý profil 40×40 mm, stěna 3 mm; vnější rádius 6 mm, vnitřní 3 mm | Řez tělesy a cylindrické plochy v aktualizovaném STEP; přímá geometrická evidence. |
| Křídlo | 6 obvodových jeklů 40×40×3 mm, laserovaná výplň tloušťky 5 mm, horní deska 110×86×8 mm / 4× Ø9 mm | Názvy dílů a B-rep tělesa v STEP; výplň má složitou geometrii bez parametrické historie. |
| Symetrie sestavy | Čtyři opakované části kolem středového uzlu | STEP a porovnání s referenční fotografií `zadani_foto1.jpg`; půdorys sestavy odpovídá fotografii. |
| Výchozí rozměry | Délka 1 532,526 mm, hloubka 842,028 mm; B-rep výška 732,014 mm, vrchol v Z=728 mm | FreeCAD 1.1.3 / OCC 7.8.1; viz poznámka k rozdílné obálce v 1.1.1. |

## Předpoklady a neověřené body

- Uživatel zvolil zachovat půdorysné úhly křídel a měnit jejich rozteč. Délka a hloubka jsou proto svázané společným faktorem; výška se může měnit nezávisle a sklony jeklů se přepočítají.
- Parametrický generátor odvozuje šest profilových os na každé křídlo a původní řezné roviny z B-rep. Výplň se mění v její rovině se zachováním tloušťky 5 mm; její kontura je převzatá a protažená podle rámu, nikoli znovu navržená podle výrobního výkresu.
- Generátor přijímá délku 1 400–1 650 mm a výšku 680–800 mm; krajní kombinace vytvářejí 33 validních těles. Kontakty dílů mimo nominální rozměr nejsou ověřené, zejména dosednutí transformované výplně na rám.
- Nativní FCStd obsahuje generovanou B-rep geometrii a tabulku parametrů; změna rozměrů vyžaduje zavřít soubor a znovu spustit makro. Nejde o historii plně editovatelných náčrtů/prvků. Výrobní výkres ani ověřená pravidla pro novou konturu výplně nejsou k dispozici.
- Materiál, svary, tolerance, únosnost a výrobní schválení nejsou potvrzené.
