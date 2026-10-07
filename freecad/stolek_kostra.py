# -*- coding: utf-8 -*-
"""
Konferenční stolek „Vnořené rámy“ – jedna souvislá svařená kostra z jeklu + skleněná deska.
Stejná geometrie jako model VR v konfigurátoru (vyvoj.js).

Spuštění ve FreeCADu: Makro → Makra… → vybrat tento soubor → Spustit
(nebo v Python konzoli: exec(open('/cesta/stolek_kostra.py').read())).

Kostra:
  - vyšší část pod sklem: x ∈ ±L/2, horní rám ve výšce Ht = H − tloušťka skla
  - nižší část vedle ní:  x ∈ L/2 … L/2 + E, rám ve výšce Hm
  - na zemi jeden uzavřený obdélník x ∈ −L/2 … L/2 + E
  - svislé hrany: levé nohy (zem → horní rám), sloupky (nižší → horní rám), pravé nohy (zem → nižší rám)
Uzavřená smyčka: levá noha nahoru → horní rám → sloupek dolů → nižší rám → pravá noha dolů → po zemi zpět.
Doplňkové hrany ji uzavřou do obdélníků tak, že v každém rohu se potká jekl ve směru X, Y i Z.
Skript to na konci ověří (žádný konec profilu nezůstane volný).
"""
import FreeCAD as App
import Part

# ---------------- parametry (mm) ----------------
L = 1000.0      # délka skla / horní části
W = 600.0       # šířka stolku
H = 450.0       # výška stolku včetně skla
GLASS = 10.0    # tloušťka skla
E = 400.0       # délka nižší části vedle skla
HM_PCT = 55.0   # výška nižšího rámu v % výšky kostry
S = 40.0        # jekl S × S
T = 2.0         # tloušťka stěny jeklu
GLASS_INSET = 0.0   # 0 = sklo položené na rámu; > 0 = sklo zapuštěné do rámu o tolik mm (falc)

Ht = H - GLASS + GLASS_INSET
Hm = max(3 * S, min(Ht * HM_PCT / 100.0, Ht - 2 * S - 40))
yy = W / 2 - S / 2          # osy jeklů v Y
zT, zM, zF = Ht - S / 2, Hm - S / 2, S / 2   # osy rámů v Z
x0, xa, xe = -L / 2 + S / 2, L / 2 - S / 2, L / 2 + E - S / 2   # osy svislých hran v X

# ---------------- osy kostry (uzly a hrany) ----------------
def rect(xa_, xb_, z):
    p = [(xa_, -yy, z), (xb_, -yy, z), (xb_, yy, z), (xa_, yy, z)]
    return [(p[i], p[(i + 1) % 4]) for i in range(4)]

edges = []
edges += rect(x0, xa, zT)            # horní rám (pod sklem)
edges += rect(xa, xe, zM)            # nižší rám
edges += rect(x0, xe, zF)            # rám na zemi – uzavřený obdélník
for y in (-yy, yy):
    edges.append(((x0, y, zF), (x0, y, zT)))   # levé nohy
    edges.append(((xa, y, zM), (xa, y, zT)))   # sloupky nižší → horní rám
    edges.append(((xe, y, zF), (xe, y, zM)))   # pravé nohy


# ---------------- kontrola spojitosti ----------------
def key(p):
    return tuple(round(c, 3) for c in p)

def axis(a, b):
    d = [abs(b[i] - a[i]) for i in range(3)]
    return 'XYZ'[d.index(max(d))]

nodes = {}
for a, b in edges:
    for p, q in ((a, b), (b, a)):
        nodes.setdefault(key(p), set()).add(axis(p, q))
bad = [n for n, ax in nodes.items() if ax != {'X', 'Y', 'Z'}]
if bad:
    raise RuntimeError('Kostra není spojitá – rohy bez všech tří os: %s' % bad)

# ---------------- tělesa ----------------
def bar(a, b, half):
    """kvádr kolem osy a–b, průřez 2·half, na koncích prodloužený o half (rohy se slijí)"""
    lo = [min(a[i], b[i]) - half for i in range(3)]
    hi = [max(a[i], b[i]) + half for i in range(3)]
    return Part.makeBox(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], App.Vector(*lo))

outer = bar(*edges[0], S / 2)
for a, b in edges[1:]:
    outer = outer.fuse(bar(a, b, S / 2))
inner = bar(*edges[0], S / 2 - T)
for a, b in edges[1:]:
    inner = inner.fuse(bar(a, b, S / 2 - T))
frame = outer.cut(inner).removeSplitter()   # dutá kostra, dutiny propojené přes rohy (svařenec)

if GLASS_INSET > 0:   # falc pro zapuštěné sklo
    frame = frame.cut(Part.makeBox(L - 2 * T, W - 2 * T, GLASS_INSET + 1, App.Vector(-L / 2 + T, -W / 2 + T, Ht - GLASS_INSET)))

glass = Part.makeBox(L - (2 * T if GLASS_INSET > 0 else 0), W - (2 * T if GLASS_INSET > 0 else 0), GLASS,
                     App.Vector(-L / 2 + (T if GLASS_INSET > 0 else 0), -W / 2 + (T if GLASS_INSET > 0 else 0), Ht - GLASS_INSET))

# ---------------- dokument ----------------
doc = App.ActiveDocument or App.newDocument('Stolek')
f = doc.addObject('Part::Feature', 'Kostra_jekl_%dx%dx%d' % (S, S, T))
f.Shape = frame
g = doc.addObject('Part::Feature', 'Sklo_%dmm' % GLASS)
g.Shape = glass
doc.recompute()

if App.GuiUp:
    import FreeCADGui as Gui
    f.ViewObject.ShapeColor = (0.12, 0.12, 0.13)
    g.ViewObject.ShapeColor = (0.75, 0.88, 0.92)
    g.ViewObject.Transparency = 75
    Gui.activeDocument().activeView().viewIsometric()
    Gui.SendMsgToActiveView('ViewFit')

total = sum(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2) ** 0.5 for a, b in edges)
App.Console.PrintMessage('Stolek: %d hran, %d rohů (všechny X+Y+Z), jekl celkem %.2f m, kostra %.1f kg\n'
                         % (len(edges), len(nodes), total / 1000.0, frame.Volume * 7.85e-6))
