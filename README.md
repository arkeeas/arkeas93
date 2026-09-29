# Konfigurátor podnoží stolů – testovací verze

Webová aplikace, ve které si zákazník nastaví ocelovou podnož stolu, vidí ji ve 3D a „objedná“. V testovacím režimu se objednávka nikam neodesílá. Místo toho se ukáže, co by dostala firma: text e-mailu a složka zakázky se soubory pro výrobu.

**Online:** https://arkeeas.github.io/arkeas93/ (funguje po zapnutí GitHub Pages, viz níže)

## Jak to vyzkoušet

### V prohlížeči (pro testery)
Otevřete odkaz výše. Nic se neinstaluje a funguje to i na mobilu.

1. Nastavte rozměry, profily a povrch. Náhled se mění hned.
2. **Sdílet konfiguraci** zkopíruje odkaz na přesně toto nastavení. Hodí se do chatu kolegům nebo k nahlášení chyby.
3. **Objednat (test)**: vyplňte jméno a e-mail a pak **Odeslat objednávku (test)**.
4. Uvidíte e-mail pro firmu a seznam příloh. **Stáhnout vše (ZIP)** stáhne celou složku zakázky.

### Dílenský režim
Na konec adresy přidejte `?dilna` (např. `…/arkeas93/?dilna`). Zobrazí se barvy pozic v 3D a sloupec stroj (K2/C2). Zákazník tohle nevidí a obrázek v objednávce je vždy v barvě povrchu.

### Lokálně (bez internetu)
1. Na GitHubu **Code → Download ZIP** a rozbalit.
2. Dvakrát kliknout na `index.html`. Nepotřebujete server ani instalaci.

## Co přijde „do firmy“

```
Jmeno_Zakaznika_K260929-1356/
├── sestava.step          celá podnož (každý díl samostatné těleso)
├── kusovnik.pdf          kusovník k tisku
├── kusovnik.csv          totéž pro Excel
├── nahled.png            obrázek z 3D náhledu
├── objednavka.txt        text e-mailu
├── objednavka.json       strojově čitelná data (pro budoucí automatizaci)
└── dily/
    ├── K2/               jekly pro trubkový laser – 1 STEP na pozici
    │   └── P1_Noha_60x60x3_L715_4ks.step
    └── C2/               plechy pro plošný laser – DXF
        └── P6_Patka_P5_60x60_4ks.dxf
```

Názvy dílů obsahují **pozici, profil, délku a počet kusů celkem**. Jekly v souborech pro K2 leží podél osy X a začínají v 0. Mají skutečné rádiusy rohů podle EN 10219 (vnější 2·t, vnitřní t) a otvory pro šrouby desky jsou vymodelované.

### Co ověřit (checklist)
- [ ] `sestava.step` jde otevřít v SolidWorksu nebo FreeCADu, díly sedí na sebe a rozměry odpovídají.
- [ ] STEP z `dily/K2` načte software trubkového laseru (Bodor K2) a rozpozná profil i otvory.
- [ ] DXF z `dily/C2` načte CypCut (Bodor C2) v milimetrech.
- [ ] Kusovník: délky, počty kusů a hmotnosti sedí s tím, jak by díl nakreslil konstruktér.

Chyby hlaste přes **Nahlásit chybu** (GitHub Issues, odkaz na konfiguraci se doplní sám), nebo pošlete odkaz ze **Sdílet konfiguraci**.

## Konstrukce podnože (verze 1)

- 4 nohy z jeklu po celé výšce. Rám (luby) je navařený mezi nohy, lícuje s vnější stranou a horní hranou nohy.
- Nad 1600 mm délky podnože se automaticky přidá střední příčka rámu.
- Volitelně:
  - patky 5 mm s otvorem Ø9 pro matici M8 (rektifikační nožka),
  - otvory v lubech pro přišroubování desky (Ø5,5 nahoře, Ø10 dole),
  - spodní příčky na kratších stranách.
- Deska se nevyrábí. V náhledu je jen pro představu a určuje rozměr podnože (deska − 2 × přesah).
- Všechny řezy jsou 90°. Hmotnost se počítá z geometrie (7850 kg/m³).

## Struktura projektu

| Soubor | Co dělá |
|---|---|
| `data/katalog.js` | **Data:** profily, rozsahy, povrchy, výchozí hodnoty. Sem později přijdou ceny. |
| `js/geometry.js` | Parametrický model podnože: díly, umístění, kontroly |
| `js/brep.js` | Přesná 3D geometrie (roviny, válce), zápis STEP AP214, síť pro náhled |
| `js/export.js` | DXF, kusovník PDF/CSV, text objednávky, ZIP |
| `js/viewer.js` | 3D náhled (čisté WebGL) |
| `js/app.js` | Formulář, přepočet, objednávkový dialog |
| `tests/validate-step.js` | Kontrola STEP bez CAD: uzavřenost, orientace ploch, geometrie |
| `tests/generuj-vzorek.js` | Vygeneruje vzorovou zakázku bez prohlížeče |

Aplikace nepoužívá žádné externí knihovny ani build. Stačí upravit soubor a obnovit stránku.

### Testy (Node.js 18+)
```bash
node tests/generuj-vzorek.js vystup 1800 800 750   # vzorová zakázka do ./vystup + kontrola STEP
node tests/validate-step.js cesta/k/souboru.step    # kontrola libovolného STEP z konfigurátoru
```

## Zapnutí odkazu pro testery (jednorázově)

GitHub → repozitář → **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, složka `/ (root)` → **Save**. Za minutu až dvě poběží na https://arkeeas.github.io/arkeas93/. Každý další push do `main` se nasadí sám.

## Plán dalších kroků

1. ✅ Konfigurace, 3D náhled, testovací objednávka, výrobní soubory (tato verze)
2. Ověřit STEP a DXF na strojích a doladit konstrukční detaily (spoje, patky, otvory)
3. Ceník v `data/katalog.js` (Kč/m profilu, práce, povrch) a výpočet ceny
4. Kontrola zatížení a průhybu rámu
5. Skutečné odeslání objednávky: e-mail do firmy s přílohami (potřebuje malý server)
6. Online platba a faktura
7. Další modely (celé stoly, jiné typy podnoží)

Přispívání: jedna změna = jedna větev a pull request. Ceny a profily se upravují jen v `data/katalog.js`.

---
Písmo v PDF: Liberation Sans (SIL Open Font License), viz `js/vendor/`.
