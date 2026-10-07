# -*- coding: utf-8 -*-
"""
Konferenční stolek „Infinity Cube“ – jedna uzavřená smyčka z jeklu tvaru kvádru + čiré sklo.

Spuštění ve FreeCADu: Makro → Makra… → vybrat tento soubor → Spustit
(nebo v Python konzoli: exec(open('/cesta/stolek_kostra.py').read())).

Princip iluze:
  - Obrys je kvádr L × W × H. Horní rám je celý v jedné rovině (všechny horní jekly ve stejné výšce),
    na něm leží čiré sklo.
  - V každém rohu stojí dva svislé jekly: vnější (na obvodu) a vnitřní (posunutý o ODSAZENI dovnitř
    v X i Y). Nahoře podélný jekl v rohu odbočí dolů do vnějšího, příčný (o ODSAZENI dovnitř) do vnitřního –
    v rohu se tak „jeden jekl stáčí dolů, druhý do strany a třetí do hloubky“, ale nikdy se nepotkají
    všechny tři v jednom bodě.
  - Dole je stejné uspořádání, jen v rozích prohozené tak, aby z celé konstrukce vznikla JEDNA uzavřená
    smyčka. K tomu stačí 2 malá odsazení (schůdek o ODSAZENI v půdorysu) na rámu na zemi – nahoře žádné.
  - Všechny lomy jsou 90°, žádný jekl nekončí slepě. Skript to na konci ověří.
"""
import itertools

# ---------------- parametry (mm) ----------------
L = 1000.0          # délka stolku (= délka skla)
W = 600.0           # šířka stolku (= šířka skla)
H = 450.0           # výška včetně skla
GLASS = 10.0        # tloušťka skla
S = 40.0            # jekl S × S
T = 2.0             # stěna jeklu
ODSAZENI = 2 * S    # o kolik je vnitřní jekl posunutý dovnitř (osa–osa), musí být > S
GLASS_OVER = 0.0    # o kolik sklo přesahuje rám na každé straně (0 = lícuje s obrysem)

if ODSAZENI <= S:
    raise ValueError('ODSAZENI musí být větší než S, jinak se vnitřní a vnější jekly dotknou.')

X, Y, D = L / 2 - S / 2, W / 2 - S / 2, ODSAZENI     # osy obvodových jeklů a odsazení
ZT, ZB = H - GLASS - S / 2, S / 2                    # osy horního rámu a rámu na zemi
CORNERS = [(1, 1), (1, -1), (-1, -1), (-1, 1)]
RAILS = [('x', 1), ('x', -1), ('y', 1), ('y', -1)]   # podélný jekl na y = ±Y, příčný na x = ±X


def pos(c, kind):
    """půdorysná poloha svislého jeklu v rohu c: 'O' vnější, 'I' vnitřní"""
    sx, sy = c
    return (sx * X, sy * Y) if kind == 'O' else (sx * (X - D), sy * (Y - D))


def rail_corners(r):
    a, s = r
    return [(1, s), (-1, s)] if a == 'x' else [(s, 1), (s, -1)]


def build_loop(top, bot):
    """top/bot: v každém rohu, který jekl ('x' nebo 'y') dostane vnější svislý jekl.
    Vrátí uzavřenou smyčku jako seznam bodů, nebo None, když vyjde víc smyček."""
    lv = {'T': dict(zip(CORNERS, top)), 'B': dict(zip(CORNERS, bot))}
    links = {}

    def link(a, b, pts):
        links.setdefault(a, []).append((b, pts))
        links.setdefault(b, []).append((a, pts[::-1]))

    for lvl, z in (('T', ZT), ('B', ZB)):
        for r in RAILS:
            c1, c2 = rail_corners(r)
            k1 = 'O' if lv[lvl][c1] == r[0] else 'I'
            k2 = 'O' if lv[lvl][c2] == r[0] else 'I'
            p1, p2 = pos(c1, k1), pos(c2, k2)
            if r[0] == 'x':   # podélný: případný schůdek v půli délky (posun v Y)
                pts = [p1, (0.0, p1[1]), (0.0, p2[1]), p2] if abs(p1[1] - p2[1]) > 1e-6 else [p1, p2]
            else:             # příčný: případný schůdek v půli šířky (posun v X)
                pts = [p1, (p1[0], 0.0), (p2[0], 0.0), p2] if abs(p1[0] - p2[0]) > 1e-6 else [p1, p2]
            link((c1, k1, lvl), (c2, k2, lvl), [(x, y, z) for x, y in pts])
    for c in CORNERS:
        for k in 'OI':
            x, y = pos(c, k)
            link((c, k, 'T'), (c, k, 'B'), [(x, y, ZT), (x, y, ZB)])
    # průchod smyčkou: z každého konce jekl pokračuje druhým napojením; smyčka musí projít všech 16 konců
    if any(len(v) != 2 for v in links.values()):
        return None
    start = next(iter(links))
    loop, prev, cur, seen = [], None, start, set()
    while True:
        seen.add(cur)
        b, pts = links[cur][0] if prev is None or links[cur][0][0] != prev else links[cur][1]
        loop.extend(pts[:-1])
        prev, cur = cur, b
        if cur == start:
            break
    return loop if len(seen) == 16 else None


# nahoře bez schůdků (všechny podélné jekly na obvodu), dole nejméně schůdků, jedna smyčka
loop = None
for bot in itertools.product('xy', repeat=4):
    lp = build_loop(('x',) * 4, bot)
    if lp:
        loop = lp
        break
if loop is None:
    raise RuntimeError('Nepodařilo se složit jednu uzavřenou smyčku.')

# odstranit body uprostřed rovných úseků
def simplify(pts):
    out = []
    n = len(pts)
    for i in range(n):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
        d1 = [b[k] - a[k] for k in range(3)]
        d2 = [c[k] - b[k] for k in range(3)]
        cr = (d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0])
        if any(abs(v) > 1e-6 for v in cr):
            out.append(b)
    return out

loop = simplify(loop)
segs = [(loop[i], loop[(i + 1) % len(loop)]) for i in range(len(loop))]


# ---------------- kontroly ----------------
def axis(a, b):
    d = [abs(b[k] - a[k]) for k in range(3)]
    if sorted(d)[1] > 1e-6:
        raise RuntimeError('Úsek není rovnoběžný s osou: %s → %s' % (a, b))
    return d.index(max(d))

ax = [axis(a, b) for a, b in segs]
for i in range(len(segs)):
    if ax[i] == ax[(i + 1) % len(segs)]:
        raise RuntimeError('Lom není 90° v bodě %s' % (segs[i][1],))
zs = sorted(set(round(p[2], 3) for p in loop))
assert zs == [round(ZB, 3), round(ZT, 3)], 'Jekly mají být jen ve dvou výškách (zem a horní rám)'
top_segs = [s for s in segs if round(s[0][2], 3) == round(ZT, 3) and round(s[1][2], 3) == round(ZT, 3)]
assert all(round(s[0][2], 3) == round(ZT, 3) for s in top_segs), 'Horní rám není v jedné rovině'


def box_of(a, b, half):
    lo = [min(a[k], b[k]) - half for k in range(3)]
    hi = [max(a[k], b[k]) + half for k in range(3)]
    return lo, hi


def overlap(b1, b2, tol=0.5):
    return all(b1[0][k] < b2[1][k] - tol and b2[0][k] < b1[1][k] - tol for k in range(3))

n = len(segs)
for i in range(n):
    for j in range(i + 2, n):
        if i == 0 and j == n - 1:
            continue   # sousední přes začátek smyčky
        if overlap(box_of(*segs[i], S / 2), box_of(*segs[j], S / 2)):
            raise RuntimeError('Jekly se protínají: úsek %d a %d' % (i, j))
# v žádném rohu obrysu se nepotkají tři jekly v jednom bodě
for p in loop:
    meets = sum(1 for a, b in segs if p in (a, b))
    assert meets == 2, 'Uzel %s spojuje %d jekly' % (p, meets)

total = sum(sum(abs(b[k] - a[k]) for k in range(3)) for a, b in segs)
report = 'Infinity Cube: jedna uzavřená smyčka, %d úseků, všechny lomy 90°, horní rám v jedné rovině, jekl %.2f m' % (n, total / 1000.0)

# ---------------- FreeCAD ----------------
try:
    import FreeCAD as App
    import Part
except ImportError:      # mimo FreeCAD: jen kontrola geometrie
    App = None
    print(report)
    for a, b in segs:
        print('  %s → %s' % (tuple(round(v) for v in a), tuple(round(v) for v in b)))

if App is not None:
    def solid(a, b, half):
        lo, hi = box_of(a, b, half)
        return Part.makeBox(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], App.Vector(*lo))

    outer = solid(*segs[0], S / 2)
    for a, b in segs[1:]:
        outer = outer.fuse(solid(a, b, S / 2))
    inner = solid(*segs[0], S / 2 - T)
    for a, b in segs[1:]:
        inner = inner.fuse(solid(a, b, S / 2 - T))
    frame = outer.cut(inner).removeSplitter()     # dutý jekl, dutina průchozí celou smyčkou

    gl = L + 2 * GLASS_OVER, W + 2 * GLASS_OVER
    glass = Part.makeBox(gl[0], gl[1], GLASS, App.Vector(-gl[0] / 2, -gl[1] / 2, H - GLASS))

    doc = App.ActiveDocument or App.newDocument('InfinityCube')
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
    App.Console.PrintMessage(report + ', hmotnost rámu %.1f kg\n' % (frame.Volume * 7.85e-6))
