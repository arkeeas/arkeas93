#!/usr/bin/env python3
"""Ptačí věšáky z plechu (C2) – siluety vlaštovek s jazýčkem, který se ohne do háčku.

Souřadnice siluety: mm, x doprava (hlava vlevo), y nahoru, střed těla v počátku.
Každý pták = seznam mnohoúhelníků (tělo, hlava, zobák, ocas, 2 křídla); sjednocení dělá FreeCAD (ptaci_fc.py).
Spuštění: python3 ptaci.py  → ptaci.json (obrysy + parametry) a nahled.svg
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- parametry výroby ----
P = dict(
    t=4.0,            # tloušťka plechu [mm]
    span=160.0,       # cílová největší rozměr siluety [mm]
    tongue_w=22.0,    # šířka jazýčku / háčku
    wall=60.0,        # svislá část na zdi pod tělem (k vnější ploše ramene) – vnější rozměr
    arm=45.0,         # rameno háčku od zdi (vnější rozměr k vnější ploše zarážky)
    lip=18.0,         # zarážka na konci ramene (vnější rozměr)
    ri=4.0,           # vnitřní poloměr ohybu (= t)
    K=0.33,           # K-faktor (ověřit na vaší ohraňovačce)
    hole=5.5,         # díra pro vrut 5 mm
    csk=11.0,         # zahloubení 90°
)

def bez(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        u = i / n; a = (1 - u) ** 3; b = 3 * u * (1 - u) ** 2; c = 3 * u * u * (1 - u); d = u ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out

def rot(pts, ang, cx=0.0, cy=0.0):
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]

def body(L=70, H=10.0):
    """trup jako kapka: hlava vlevo (x=0), k ocasu se zúží na 3,5 mm (ocas se na něj napojí)"""
    top, bot = [], []
    for i in range(41):
        x = L * i / 40
        u = x / L
        h = H * math.sin(math.pi / 2 * u / 0.3) ** 0.5 if u < 0.3 else H + (3.5 - H) * ((u - 0.3) / 0.7) ** 1.2
        top.append((x, 1.5 + h)); bot.append((x, 1.5 - h * 0.9))
    return top + bot[::-1]

def head():
    return [(9 + 9 * math.cos(2 * math.pi * i / 32), 4 + 8.5 * math.sin(2 * math.pi * i / 32)) for i in range(32)]

def beak():
    return [(-8, 3.5), (2, 7.5), (2, 0.5)]

def tail(spread=1.0, droop=0.0):
    """vidlicový ocas: dva hroty, zářez mezi nimi"""
    pts = [(58, 6), (118, 11 + 6 * spread), (90, 1.5), (114, -13 - 7 * spread), (58, -3)]
    return rot(pts, droop, 62, 1)

def wing(L=78, root=18, sweep=30, curve=1.0):
    """čepel křídla v lokálních souřadnicích: kořen na ose x (−root/2..root/2), špička nahoře, zahnutá dozadu"""
    a, b, tip = (-root / 2, 0), (root / 2, 0), (sweep, L)
    lead = bez(a, (-root / 2 - 6, L * 0.5), (sweep - 22 * curve, L * 0.98), tip)
    trail = bez(tip, (sweep - 6, L * 0.7), (root / 2 + 2, L * 0.3), b)
    return lead + trail[1:]

def place_wing(w, ang, sx, sy):
    return [(x + sx, y + sy) for x, y in rot(w, ang)]

POSES = {
    'vzlet':     dict(lab='Vzlet – obě křídla nahoru', w=[(-6, 88, 30), (22, 74, 36)], tail=(1.0, 4)),
    'mavnuti':   dict(lab='Mávnutí – křídlo nahoru a dolů', w=[(12, 86, 30), (160, 70, 28)], tail=(0.8, -4)),
    'plachteni': dict(lab='Plachtění – křídla roztažená', w=[(40, 90, 32), (140, 90, 32)], tail=(1.2, 0)),
    'klouzani':  dict(lab='Klouzání – křídla dozadu', w=[(-30, 80, 28), (-8, 70, 34)], tail=(1.4, 14)),
}

def bird(pose):
    d = POSES[pose]
    parts = [body(), head(), beak(), tail(*d['tail'])]
    for ang, L, sx in d['w']:
        parts.append(place_wing(wing(L=L), ang, sx, 4))
    # normalizace: největší rozměr = span, střed obdélníku v počátku
    xs = [x for p in parts for x, _ in p]; ys = [y for p in parts for _, y in p]
    k = P['span'] / max(max(xs) - min(xs), max(ys) - min(ys))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    parts = [[(round((x - cx) * k, 3), round((y - cy) * k, 3)) for x, y in p] for p in parts]
    # bod pod těžištěm těla, kam se napojí jazýček (spodní hrana trupu v x těžiště trupu)
    b = parts[0]
    bx = sum(x for x, _ in b) / len(b)
    by = min(y for x, y in b if abs(x - bx) < 6)
    return dict(pose=pose, lab=d['lab'], parts=parts, anchor=[round(bx, 2), round(by, 2)], scale=round(k, 4))

def flat_tongue():
    """rozvinutá délka jazýčku pod tělem: součet vnějších rozměrů − 2 × zkrácení ohybu"""
    t, ri, K = P['t'], P['ri'], P['K']
    BA = math.pi / 2 * (ri + K * t)        # délka neutrální vrstvy v ohybu
    BD = 2 * (ri + t) - BA                 # zkrácení ohybu
    L = P['wall'] + P['arm'] + P['lip'] - 2 * BD
    s1 = P['wall'] - (ri + t)              # rovná část na zdi
    s2 = P['arm'] - 2 * (ri + t)           # rovné rameno
    s3 = P['lip'] - (ri + t)               # rovná zarážka
    bends = [s1 + BA / 2, s1 + BA + s2 + BA / 2]   # osy ohybů od spodní hrany těla
    return dict(BA=round(BA, 3), BD=round(BD, 3), L=round(L, 2), s=[round(s1, 2), round(s2, 2), round(s3, 2)], bends=[round(b, 2) for b in bends])

def svg(birds):
    cell, out = 230, []
    for i, b in enumerate(birds):
        ox, oy = 115 + i * cell, 120
        polys = ''.join('<polygon points="%s"/>' % ' '.join('%.1f,%.1f' % (ox + x, oy - y) for x, y in p) for p in b['parts'])
        ax, ay = b['anchor']; w = P['tongue_w']
        tg = '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#B8440F"/>' % (ox + ax - w / 2, oy - ay - 2, w, P['wall'])
        out.append('<g fill="#1E1F21">%s</g>%s<text x="%d" y="250" font-size="13" text-anchor="middle" font-family="sans-serif">%s</text>' % (polys, tg, ox, b['lab']))
    return '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="270" style="background:#F1EFEA">%s</svg>' % (cell * len(birds), ''.join(out))

if __name__ == '__main__':
    birds = [bird(k) for k in POSES]
    data = dict(params=P, tongue=flat_tongue(), birds=birds)
    json.dump(data, open(os.path.join(HERE, 'ptaci.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, 'nahled.svg'), 'w').write(svg(birds))
    print(json.dumps(data['tongue'], ensure_ascii=False))
