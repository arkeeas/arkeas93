# Podnože na míru – konfigurátor (testovací verze)

Konfigurátor ocelových podnoží stolů. Má dvě části, mezi kterými se přepíná záložkou nahoře:

- **Zákazník** (`index.html`): výběr tvaru podnože, rozměry, profil jeklu, spoje, povrch a deska. Obsahuje 3D náhled, orientační nosnost, cenu a nezávaznou poptávku.
- **Dílna** (`interni.html`): přijaté poptávky, objednávka a stažení podkladů (.zip), audit konstrukce všech tvarů a ceník.

**Online:** https://arkeeas.github.io/arkeas93/ (po zapnutí GitHub Pages, viz níže)

## Jak testovat

1. V záložce **Zákazník** nastavte podnož a klikněte na **Nezávazně poptat**. Vyplňte jméno a e-mail a odešlete.
2. Přepněte na záložku **Dílna → Poptávky**. Poptávka tam je. **Otevřít** ji převede do záložky *Objednávka a podklady*.
3. **Stáhnout podklady (.zip)** stáhne složku zakázky: sestavu STEP, kusovník PDF, testovací doklad o zaplacení, `dily/K2/*.step` (jekly) a `dily/C2/*.dxf` (plechy).

> **Důležité:** zatím neexistuje server. Poptávky a ceník se ukládají **jen v prohlížeči**, ve kterém byly zadány. Zákazník a dílna se proto musí testovat ve stejném prohlížeči. Každý tester má svoje vlastní data. Skutečné odesílání poptávek do firmy přijde se serverem a nahradí se jen soubor `lokal.js`.

### Lokálně
Na GitHubu **Code → Download ZIP**, rozbalit a otevřít `index.html`. 3D náhled používá knihovnu three.js z internetu. Bez připojení se ukáže zjednodušený 2D náhled.

## Soubory

| Soubor | Co dělá |
|---|---|
| `index.html` | stránka pro zákazníky |
| `interni.html` | stránka pro dílnu |
| `core.js` | tvary podnoží, geometrie, výpočet nosnosti (EN 12521), cena, kusovník |
| `gen.js` | výrobní podklady: STEP, DXF, PDF, ZIP |
| `viewer.js`, `figure.js` | 3D náhled a postava pro měřítko |
| `lokal.js` | náhrada databáze a stahování mimo Claude (localStorage) |
| `modebar.css` | horní přepínač Zákazník / Dílna |
| `tests/` | kontrola STEP bez CAD |

### Kontrola STEP (Node.js 18+)
```bash
node tests/kontrola-step.js 1600 800 750
```
Vygeneruje STEP všech tvarů a zkontroluje uzavřenost těles, orientaci ploch a geometrii.

## Zapnutí odkazu (jednorázově)
GitHub → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → **Save**.
