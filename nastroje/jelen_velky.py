#!/usr/bin/env python3
"""Velký Jelen 1200: z pálicího DXF (jen vrstva REZ, polyline s oblouky) spočítá souhrn a náhled.

Výstup: assets/jelen-velky/souhrn.json (délka řezu, plocha, hmotnost, průstřely, háčky)
        assets/jelen-velky/artwork.js  (zjednodušený obrys pro náhled v ostatni.html)
Spuštění z kořene repa:  python3 nastroje/jelen_velky.py
Tloušťka plechu není v DXF – bere se T níže (stejná řada jako malý Jelen). Při změně přegenerovat a upravit SPEC v jelen-velky-core.js.
"""
import json, math, os, sys

T = 3.0                 # mm, předpoklad – v DXF není
RHO = 7.85e-6           # kg/mm³
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DXF = os.path.join(ROOT, 'assets/jelen-velky/jelen_velky_1200_paleni.dxf')


def read_polylines(path):
    lines = [l.strip() for l in open(path, encoding='utf-8', errors='replace')]
    polys, cur, v = [], None, None
    for code, val in zip(lines[0::2], lines[1::2]):
        if code == '0':
            if v is not None and cur is not None:
                cur.append(v)
            v = None
            if val == 'POLYLINE':
                cur = []
            elif val == 'VERTEX':
                v = [0.0, 0.0, 0.0]
            elif val == 'SEQEND' and cur is not None:
                polys.append(cur)
                cur = None
        elif v is not None and code in ('10', '20', '42'):
            v['10 20 42'.split().index(code)] = float(val)
    return polys


def seg_arc(p, q, b):
    """Oblouk z bulge: (střed, poloměr, úhel startu, středový úhel) nebo None pro úsečku."""
    if abs(b) < 1e-9:
        return None
    d = math.hypot(q[0] - p[0], q[1] - p[1])
    th = 4 * math.atan(b)
    r = d / (2 * math.sin(th / 2))
    mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
    h = r * math.cos(th / 2)
    ux, uy = (q[0] - p[0]) / d, (q[1] - p[1]) / d
    cx, cy = mx - uy * h, my + ux * h
    return cx, cy, abs(r), math.atan2(p[1] - cy, p[0] - cx), th


def length(poly):
    L = 0.0
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        a = seg_arc(p, q, p[2])
        L += abs(a[2] * a[4]) if a else math.hypot(q[0] - p[0], q[1] - p[1])
    return L


def points(poly, step):
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        out.append((p[0], p[1]))
        a = seg_arc(p, q, p[2])
        if a:
            cx, cy, r, a0, th = a
            k = max(2, int(abs(r * th) / step))
            out += [(cx + r * math.cos(a0 + th * j / k), cy + r * math.sin(a0 + th * j / k)) for j in range(1, k)]
    return out


def area(pts):
    return 0.5 * sum(pts[i][0] * pts[i - 1][1] * -1 + pts[i - 1][0] * pts[i][1] for i in range(len(pts))) * -1


def tabs(poly):
    """Háčky = úzké jazyky ~20 mm visící dolů z parohů: svislá hrana dolů, oblé dno, svislá hrana nahoru."""
    n, out = len(poly), []
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        if abs(a[0] - b[0]) < 1 and a[1] - b[1] > 25 and abs(a[2]) < 1e-9:
            for k in range(2, 6):
                c, d = poly[(i + k) % n], poly[(i + k + 1) % n]
                if abs(c[0] - d[0]) < 1 and d[1] - c[1] > 25 and 17 < abs(c[0] - a[0]) < 23 and abs(c[2]) < 1e-9:
                    x0, x1 = sorted((a[0], c[0]))
                    bot = min(pp[1] for pp in points([poly[(i + j) % n] for j in range(1, k + 1)] + [c], 0.5))
                    out.append([round(x0, 1), round(x1, 1), round(bot, 1), round(min(a[1], d[1]), 1)])
                    break
    return sorted(out)


def main():
    polys = read_polylines(DXF)
    outline, holes = polys[0], polys[1:]
    pts_o = points(outline, 0.5)
    xs, ys = [p[0] for p in pts_o], [p[1] for p in pts_o]
    net = abs(area(pts_o)) - sum(abs(area(points(h, 0.5))) for h in holes)
    cut = sum(length(p) for p in polys)
    hk = tabs(outline)
    summary = {
        'zdroj': os.path.basename(DXF), 'vrstvy': ['REZ'], 'konturu': len(polys), 'otvory_na_uchyceni': 0, 'ohybove_cary': 0,
        'flat': [round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1)], 't_predpoklad': T,
        'plocha_mm2': round(net), 'kg': round(net * T * RHO, 2), 'cut_mm': round(cut), 'hooks': len(hk),
        'hook_tabs': hk, 'hook_width': round(sum(t[1] - t[0] for t in hk) / len(hk), 1),
        'hook_len_min': round(min(t[3] - t[2] for t in hk), 1)
    }
    json.dump(summary, open(os.path.join(ROOT, 'assets/jelen-velky/souhrn.json'), 'w'), ensure_ascii=False, indent=1)
    r = lambda p: [round(p[0], 1), round(p[1], 1)]
    art = {'flat': summary['flat'], 'box': [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)], 't': T,
           'outline': [r(p) for p in points(outline, 3)], 'holes': [[r(p) for p in points(h, 1.5)] for h in holes], 'tabs': hk}
    with open(os.path.join(ROOT, 'assets/jelen-velky/artwork.js'), 'w') as f:
        f.write('/* Velký Jelen 1200 (mm, souřadnice z DXF, y nahoru) z jelen_velky_1200_paleni.dxf – jen pro náhled. Generuje nastroje/jelen_velky.py. */\n')
        f.write('window.JelenVelkyArtwork = ' + json.dumps(art, separators=(',', ':')) + ';\n')
    print(json.dumps({k: v for k, v in summary.items() if k != 'hook_tabs'}, ensure_ascii=False))


if __name__ == '__main__':
    sys.exit(main())
