# -*- coding: utf-8 -*-
"""
Konferenční stolek „Infinity Cube“ podle předlohy (skica) – jedna zalomená trasa z 18 rovných jeklů
ve 3 výškách, v každém lomu právě 2 profily, + čiré sklo položené na horním rámu.

Spuštění ve FreeCADu: Makro → Makra… → vybrat tento soubor → Spustit
(nebo v Python konzoli: exec(open('/cesta/stolek_kostra.py').read())).
Mimo FreeCAD (obyčejný python3) skript jen spočítá a vypíše kontrolu trasy.

Body jsou OSY profilů (střed průřezu jeklu). Spoje:
  - roh, kde se potkají 2 profily: pokos – oba profily se seříznou rovinou půlící úhel mezi nimi
    (u pravého úhlu 45°, u šikmého profilu 11 podle skutečného úhlu)
  - roh, kde se potkají 3 profily: profily se prodlouží o polovinu jeklu a svaří do plného rohu
Na konci skript vypíše, kolik profilů je v kterém rohu a jestli trasa tvoří jednu uzavřenou smyčku.
"""
import math

# ---------------- parametry (mm) ----------------
S = 50.0        # jekl S × S
T = 3.0         # stěna jeklu
GLASS = 10.0    # tloušťka čirého skla
GLASS_OVER = 0.0    # přesah skla přes vnější obrys stolku

# ---------------- rozměry stolku (vnější obrys, mm) ----------------
L = 1000.0      # délka (X, dopředu 0 → dozadu L)
W = 600.0       # šířka (Y, „pravá“ strana skici je y = 0)
H = 450.0       # výška rámu bez skla (Z)

# ---------------- trasa podle předlohy (skica): 18 úseků, osy jeklů ----------------
# Jedna zalomená trasa ve 3 výškách, všechny lomy 90° s pokosem, v každém lomu jen 2 profily:
#   horní rám (nese sklo) – v horním zadním vrcholu mezera, oba jekly u ní jdou svisle dolů na zem;
#   pod pravým horním rohem žádná stojka – vedle (o d) stojí pravý rám v nižší výšce z2;
#   vpředu před horním rámem nižší portál ve výšce z1, vlevo dole otevřený;
#   na zemi vnější a vnitřní obíhající jekly (vlevo a vzadu dva vedle sebe s mezerou).
d = 1.5 * S                                  # rozteč souběžných jeklů (mezera d − S)
x0, xb = S / 2, L - S / 2                    # vpředu / vzadu
xf, xi = x0 + d, xb - d                      # přední hrana horního rámu / vnitřní zadní jekl na zemi
yl, ym = W - S / 2, S / 2                    # levá / pravá strana
yt, yi = ym + d, yl - d                      # pravá hrana horního rámu / vnitřní levý jekl
zg, zt = S / 2, H - S / 2                    # zem / horní rám
z1, z2 = zg + 0.7 * (zt - zg), zg + 0.6 * (zt - zg)   # přední portál / pravý rám
TRASA = [
    (xb, yl, zg), (xb, yl, zt), (xf, yl, zt), (xf, yt, zt), (xb, yt, zt), (xb, yi, zt), (xb, yi, zg),
    (xb, ym, zg), (xb, ym, z2), (x0, ym, z2), (x0, ym, zg), (xi, ym, zg),
    (xi, yi, zg), (x0, yi, zg), (x0, yt, zg), (x0, yt, z1), (x0, yl, z1), (x0, yl, zg),
]
JMENA = ['levá zadní noha', 'horní levý podélný', 'horní přední příčný', 'horní pravý podélný', 'horní zadní příčný (k mezeře)',
         'noha u mezery', 'zadní vnější na zemi', 'pravá zadní stojka', 'pravý rám nahoře', 'pravá přední noha',
         'pravý na zemi', 'zadní vnitřní na zemi', 'levý vnitřní na zemi', 'přední na zemi', 'portál pravá noha',
         'portál nahoře', 'portál levá noha', 'levý vnější na zemi']
PROFILY = [('%d %s' % (k + 1, JMENA[k]), TRASA[k], TRASA[(k + 1) % len(TRASA)]) for k in range(len(TRASA))]
HORNI = [1, 2, 3, 4]    # na těchto profilech leží sklo


# ---------------- kontrola trasy ----------------
def key(p):
    return tuple(round(c, 3) for c in p)

def sub(a, b):
    return [a[k] - b[k] for k in range(3)]

def norm(v):
    l = math.sqrt(sum(c * c for c in v))
    return [c / l for c in v]

def dot(a, b):
    return sum(a[k] * b[k] for k in range(3))

uzly = {}
for i, (_, a, b) in enumerate(PROFILY):
    uzly.setdefault(key(a), []).append(i)
    uzly.setdefault(key(b), []).append(i)

lines = ['Kontrola trasy (%d profilů):' % len(PROFILY)]
for p, idx in sorted(uzly.items()):
    lines.append('  roh %-18s %d profily: %s' % (str(p), len(idx), ', '.join(PROFILY[i][0].split()[0] for i in idx)))
# úhly ve spojích dvou profilů
for p, idx in sorted(uzly.items()):
    if len(idx) == 2:
        i, j = idx
        di = norm(sub(PROFILY[i][2], PROFILY[i][1]) if key(PROFILY[i][2]) != p else sub(PROFILY[i][1], PROFILY[i][2]))
        dj = norm(sub(PROFILY[j][2], PROFILY[j][1]) if key(PROFILY[j][2]) != p else sub(PROFILY[j][1], PROFILY[j][2]))
        # di, dj míří od rohu ven
        di = norm(sub(PROFILY[i][1], PROFILY[i][2])) if key(PROFILY[i][1]) != p else norm(sub(PROFILY[i][2], PROFILY[i][1]))
        dj = norm(sub(PROFILY[j][1], PROFILY[j][2])) if key(PROFILY[j][1]) != p else norm(sub(PROFILY[j][2], PROFILY[j][1]))
        ang = math.degrees(math.acos(max(-1, min(1, dot(di, dj)))))
        if abs(ang - 90) > 0.5:
            lines.append('  POZOR: v rohu %s svírají profily %s a %s úhel %.1f° (ne 90°)'
                         % (str(p), PROFILY[i][0].split()[0], PROFILY[j][0].split()[0], ang))
tri = [p for p, idx in uzly.items() if len(idx) >= 3]
ctyri = [p for p, idx in uzly.items() if len(idx) >= 4]
volne = [p for p, idx in uzly.items() if len(idx) == 1]
smycka = not tri and not volne and len(uzly) == len(PROFILY)
lines.append('  rohů se 3 profily: %d, se 4 a více: %d, volných konců: %d' % (len(tri), len(ctyri), len(volne)))
lines.append('  jedna uzavřená smyčka: %s' % ('ANO' if smycka else
             'NE – rohy se 3 profily dělají z trasy rozvětvenou síť; uzavřená smyčka potřebuje v každém rohu přesně 2 profily'))
report = '\n'.join(lines)


# ---------------- tělesa (FreeCAD) ----------------
try:
    import FreeCAD as App
    import Part
except ImportError:
    App = None
    print(report)

if App is not None:
    V = App.Vector
    ext = [max(abs(c) for _, a, b in PROFILY for c in a + b)]
    BIG = 10 * ext[0] + 1000

    def frame_of(d):
        """ortonormální báze: x = osa profilu, y = kolmice (stěna rovnoběžná s jednou osou souřadnic)"""
        x = V(*d); x.normalize()
        ref = V(1, 0, 0) if abs(x.x) < 0.9 else V(0, 1, 0)
        y = ref - x * ref.dot(x); y.normalize()
        z = x.cross(y)
        return x, y, z

    def oriented_box(p0, d, length, w, start_off):
        """kvádr délky length podél d (od p0 + d·start_off), průřez w × w kolem osy"""
        x, y, z = frame_of(d)
        b = Part.makeBox(length, w, w, V(0, -w / 2, -w / 2))
        m = App.Matrix(x.x, y.x, z.x, 0, x.y, y.y, z.y, 0, x.z, y.z, z.z, 0, 0, 0, 0, 1)
        b = b.transformGeometry(m)
        b.translate(V(*p0) + x * start_off)
        return b

    def half_space(p, n):
        """poloprostor (q − p)·n ≥ 0"""
        nv = V(*n); nv.normalize()
        e2 = nv.cross(V(0, 0, 1)) if abs(nv.z) < 0.9 else nv.cross(V(1, 0, 0))
        e2.normalize(); e3 = nv.cross(e2)
        b = Part.makeBox(BIG, 2 * BIG, 2 * BIG, V(0, -BIG, -BIG))
        m = App.Matrix(nv.x, e2.x, e3.x, 0, nv.y, e2.y, e3.y, 0, nv.z, e2.z, e3.z, 0, 0, 0, 0, 1)
        b = b.transformGeometry(m)
        b.translate(V(*p))
        return b

    outer_all, inner_all, kusy = [], [], []
    for i, (name, a, b) in enumerate(PROFILY):
        d = norm(sub(b, a))
        L = math.dist(a, b)
        cuts = []
        e0 = e1 = 0.0
        for end, p in ((0, a), (1, b)):
            idx = uzly[key(p)]
            if len(idx) == 2:          # pokos: rovina půlící úhel s druhým profilem
                j = idx[0] if idx[1] == i else idx[1]
                aj, bj = PROFILY[j][1], PROFILY[j][2]
                dj = norm(sub(bj, aj)) if key(aj) == key(p) else norm(sub(aj, bj))   # od rohu ven po profilu j
                di = d if end == 0 else [-c for c in d]                              # od rohu ven po profilu i
                n = [di[k] - dj[k] for k in range(3)]                                 # na stranu profilu i
                if math.sqrt(dot(n, n)) > 1e-9:
                    cuts.append((p, n))
                if end == 0: e0 = S * 3
                else: e1 = S * 3
            else:                      # 3 profily: prodloužit o půl jeklu, plný svařený roh
                if end == 0: e0 = S / 2
                else: e1 = S / 2
        o = oriented_box(a, d, L + e0 + e1, S, -e0)
        n_ = oriented_box(a, d, L + e0 + e1 + 2, S - 2 * T, -e0 - 1)
        for p, n in cuts:
            hs = half_space(p, n)
            o = o.common(hs)
            n_ = n_.common(hs)
        outer_all.append(o)
        inner_all.append(n_)
        kusy.append((name, o.cut(n_)))

    outer = outer_all[0]
    for s in outer_all[1:]:
        outer = outer.fuse(s)
    inner = inner_all[0]
    for s in inner_all[1:]:
        inner = inner.fuse(s)
    frame = outer.cut(inner).removeSplitter()

    # sklo na horním rámu (horní plocha jeklů), přes celý obrys stolku – vpředu a vpravo přesahuje o d
    top = max(PROFILY[i][1][2] for i in HORNI) + S / 2
    gx0, gx1 = -GLASS_OVER, L + GLASS_OVER
    gy0, gy1 = -GLASS_OVER, W + GLASS_OVER
    glass = Part.makeBox(gx1 - gx0, gy1 - gy0, GLASS, V(gx0, gy0, top))

    doc = App.ActiveDocument or App.newDocument('InfinityCube')
    grp = doc.addObject('App::DocumentObjectGroup', 'Profily_%d_ks' % len(PROFILY))
    for name, shp in kusy:
        o = doc.addObject('Part::Feature', 'Profil_' + name.split()[0])
        o.Label = 'Profil ' + name
        o.Shape = shp
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
    App.Console.PrintMessage(report + '\nRám %.1f kg, sklo %d × %d × %d mm\n' % (frame.Volume * 7.85e-6, gx1 - gx0, gy1 - gy0, GLASS))
