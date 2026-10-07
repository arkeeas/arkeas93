# -*- coding: utf-8 -*-
"""
Konferenční stolek „Infinity Cube“ – JEDNA nepřerušená uzavřená smyčka z jeklu, která projde všech
12 hran kvádru, pokosy 45° v každém lomu, nahoře čiré sklo.

Spuštění ve FreeCADu: Makro → Makra… → vybrat tento soubor → Spustit
(nebo v Python konzoli: exec(open('/cesta/stolek_kostra.py').read())).
Mimo FreeCAD (obyčejný python3) skript jen ověří trasu a vypíše body.

Proč 16 úseků a ne 12:
  V každém rohu kvádru se potkávají 3 hrany (lichý počet). Uzavřená trasa musí do každého rohu stejně krát
  vejít i vyjít, takže projít každou z 12 hran PRÁVĚ JEDNOU nejde (Eulerova věta). Nejkratší uzavřená trasa
  přes všech 12 hran má 16 úseků – 4 hrany projde dvakrát. Tam vedou dva jekly těsně vedle sebe (svařené),
  posunuté o šířku jeklu: levá horní, přední pravá svislá, zadní pravá svislá a levá spodní hrana.
  Trasu našel úplný průzkum všech uzavřených tras po hranách kvádru (168 tras × všechna posunutí o jekl):
  tahle má nejméně posunutých úseků, žádné dva jekly se neprotínají a horní rám je v jedné rovině.

Trasa (kvádr 500 × 500 × 500, jekl 40, souřadnice os jeklů od rohu):
   1 [0,0,0] → [0,0,500] nahoru        9 → [500,0,0] dopředu
   2 → [0,500,500] dozadu             10 → [500,0,500] nahoru (2. jekl přední pravé)
   3 → [0,500,40] dolů                11 → [40,0,500] doleva
   4 → [0,40,40] dopředu (2. jekl)    12 → [40,500,500] dozadu (2. jekl levé horní)
   5 → [500,40,40] doprava            13 → [460,500,500] doprava
   6 → [500,40,500] nahoru            14 → [460,500,0] dolů (2. jekl zadní pravé)
   7 → [500,500,500] dozadu           15 → [0,500,0] doleva
   8 → [500,500,0] dolů               16 → [0,0,0] dopředu – smyčka se uzavře
"""
import math

# ---------------- parametry (mm) ----------------
L = 1000.0      # délka stolku (X) = délka skla
W = 600.0       # hloubka stolku (Y) = šířka skla
H = 450.0       # výška včetně skla (Z)
GLASS = 10.0    # tloušťka čirého skla
S = 40.0        # jekl S × S
T = 2.0         # stěna jeklu
GLASS_OVER = 0.0    # přesah skla přes obrys rámu na každé straně

# ---------------- trasa ----------------
# každá souřadnice: (roh 0/1, posun o kolik šířek jeklu); 0 = osa jeklu u začátku, 1 = osa jeklu u konce
ROUTE = [
    ((0, 0), (0, 0), (0, 0)), ((0, 0), (0, 0), (1, 0)), ((0, 0), (1, 0), (1, 0)), ((0, 0), (1, 0), (0, 1)),
    ((0, 0), (0, 1), (0, 1)), ((1, 0), (0, 1), (0, 1)), ((1, 0), (0, 1), (1, 0)), ((1, 0), (1, 0), (1, 0)),
    ((1, 0), (1, 0), (0, 0)), ((1, 0), (0, 0), (0, 0)), ((1, 0), (0, 0), (1, 0)), ((0, 1), (0, 0), (1, 0)),
    ((0, 1), (1, 0), (1, 0)), ((1, -1), (1, 0), (1, 0)), ((1, -1), (1, 0), (0, 0)), ((0, 0), (1, 0), (0, 0)),
]
Ht = H - GLASS                                   # horní plocha rámu
LO = (S / 2, S / 2, S / 2)
HI = (L - S / 2, W - S / 2, Ht - S / 2)
pts = [tuple((LO[k] if c[0] == 0 else HI[k]) + c[1] * S for k, c in enumerate(p)) for p in ROUTE]
n = len(pts)
segs = [(pts[i], pts[(i + 1) % n]) for i in range(n)]

# ---------------- kontroly ----------------
def axis(a, b):
    d = [abs(b[k] - a[k]) for k in range(3)]
    if sorted(d)[1] > 1e-6:
        raise RuntimeError('Úsek není rovnoběžný s osou: %s → %s' % (a, b))
    return d.index(max(d))

ax = [axis(a, b) for a, b in segs]
for i in range(n):
    if ax[i] == ax[(i + 1) % n]:
        raise RuntimeError('Lom v bodě %s není 90°' % (segs[i][1],))
    if math.dist(*segs[i]) < S:
        raise RuntimeError('Úsek %d je kratší než jekl – stolek je na tuto trasu příliš malý' % (i + 1))
if any(p[2] > HI[2] + 1e-6 or p[2] < LO[2] - 1e-6 for p in pts):
    raise RuntimeError('Jekl vyčnívá nad horní rám nebo pod zem')
top = [s for s in segs if abs(s[0][2] - s[1][2]) < 1e-6 and s[0][2] > Ht / 2]
if any(abs(s[0][2] - HI[2]) > 1e-6 for s in top):
    raise RuntimeError('Horní rám není v jedné rovině')

# všech 12 hran kvádru pokrytých (úsek leží na hraně nebo o max. jeden jekl vedle ní)
edges = []
for a in range(3):
    o = [k for k in range(3) if k != a]
    for u in (LO[o[0]], HI[o[0]]):
        for v in (LO[o[1]], HI[o[1]]):
            edges.append((a, o, u, v))
def covers(e, s):
    a, o, u, v = e
    return axis(*s) == a and abs(s[0][o[0]] - u) <= S + 1e-6 and abs(s[0][o[1]] - v) <= S + 1e-6
missing = [e for e in edges if not any(covers(e, s) for s in segs)]
if missing:
    raise RuntimeError('Trasa nepokryje %d hran kvádru' % len(missing))

def box_of(a, b, half):
    return [min(a[k], b[k]) - half for k in range(3)], [max(a[k], b[k]) + half for k in range(3)]

def overlap(b1, b2, tol=0.5):
    return all(b1[0][k] < b2[1][k] - tol and b2[0][k] < b1[1][k] - tol for k in range(3))

for i in range(n):
    for j in range(i + 2, n):
        if i == 0 and j == n - 1:
            continue
        if overlap(box_of(*segs[i], S / 2), box_of(*segs[j], S / 2)):
            raise RuntimeError('Jekly se protínají: úsek %d a %d' % (i + 1, j + 1))

total = sum(math.dist(a, b) for a, b in segs)
report = ('Infinity Cube: jedna uzavřená smyčka, %d úseků (12 hran, 4 zdvojené), všechny lomy 90° s pokosem 45°, '
          'horní rám v jedné rovině, jekl %.2f m' % (n, total / 1000.0))


# ---------------- tělesa (FreeCAD) ----------------
def unit(a, b):
    d = [b[k] - a[k] for k in range(3)]
    l = math.sqrt(sum(c * c for c in d))
    return [c / l for c in d]

try:
    import FreeCAD as App
    import Part
except ImportError:
    App = None
    print(report)
    for i, (a, b) in enumerate(segs):
        print('  %2d  %s → %s' % (i + 1, tuple(round(v) for v in a), tuple(round(v) for v in b)))

if App is not None:
    V = App.Vector
    BIG = 10 * (L + W + H)

    def half_space(p, nrm):
        """poloprostor (x − p)·nrm ≥ 0 jako velký kvádr"""
        nv = V(*nrm); nv.normalize()
        e2 = nv.cross(V(0, 0, 1)) if abs(nv.z) < 0.9 else nv.cross(V(1, 0, 0))
        e2.normalize(); e3 = nv.cross(e2)
        b = Part.makeBox(BIG, 2 * BIG, 2 * BIG)
        m = App.Matrix(nv.x, e2.x, e3.x, 0, nv.y, e2.y, e3.y, 0, nv.z, e2.z, e3.z, 0, 0, 0, 0, 1)
        b.translate(V(0, -BIG, -BIG))
        b = b.transformGeometry(m)
        b.translate(V(*p))
        return b

    pieces = []
    for i, (a, b) in enumerate(segs):
        u = unit(a, b)
        up = unit(*segs[i - 1])
        un = unit(*segs[(i + 1) % n])
        lo, hi = box_of(a, b, S / 2)
        k = ax[i]
        loI = [lo[j] - 1 if j == k else lo[j] + T for j in range(3)]
        hiI = [hi[j] + 1 if j == k else hi[j] - T for j in range(3)]
        tube = Part.makeBox(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], V(*lo)).cut(
            Part.makeBox(hiI[0] - loI[0], hiI[1] - loI[1], hiI[2] - loI[2], V(*loI)))
        # pokosy 45°: rovina půlící lom – na začátku (x − a)·(up + u) ≥ 0, na konci (x − b)·(u + un) ≤ 0
        tube = tube.common(half_space(a, [up[j] + u[j] for j in range(3)]))
        tube = tube.common(half_space(b, [-(u[j] + un[j]) for j in range(3)]))
        pieces.append(tube)

    frame = pieces[0]
    for pc in pieces[1:]:
        frame = frame.fuse(pc)
    frame = frame.removeSplitter()

    gl = (L + 2 * GLASS_OVER, W + 2 * GLASS_OVER)
    glass = Part.makeBox(gl[0], gl[1], GLASS, V(-GLASS_OVER, -GLASS_OVER, Ht))

    doc = App.ActiveDocument or App.newDocument('InfinityCube')
    grp = doc.addObject('App::DocumentObjectGroup', 'Jekly_kusovnik')
    for i, pc in enumerate(pieces):           # jednotlivé kusy jeklu (řezání na K2)
        o = doc.addObject('Part::Feature', 'Jekl_%02d' % (i + 1))
        o.Shape = pc
        grp.addObject(o)
        if App.GuiUp:
            o.ViewObject.Visibility = False
    f = doc.addObject('Part::Feature', 'Ram_jekl_%dx%dx%d' % (S, S, T))
    f.Shape = frame
    g = doc.addObject('Part::Feature', 'Sklo_cire_%dmm' % GLASS)
    g.Shape = glass
    doc.recompute()
    if App.GuiUp:
        import FreeCADGui as Gui
        f.ViewObject.ShapeColor = (0.10, 0.10, 0.11)
        g.ViewObject.ShapeColor = (0.80, 0.92, 0.95)
        g.ViewObject.Transparency = 80
        Gui.activeDocument().activeView().viewIsometric()
        Gui.SendMsgToActiveView('ViewFit')
    App.Console.PrintMessage(report + ', rám %.1f kg\n' % (frame.Volume * 7.85e-6))
