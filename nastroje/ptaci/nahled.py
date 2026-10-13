#!/usr/bin/env python3
"""Náhledy: rozvinuté DXF (obrys, díry, ohyby) a 3D pohled z boku shora – SVG → PNG."""
import json, math, os, sys
D = os.path.dirname(os.path.abspath(__file__))
def read_dxf(path):
    t = open(path).read().split('\n'); ents = []; i = 0
    while i < len(t) - 1:
        if t[i].strip() == '0' and t[i + 1].strip() in ('LINE', 'CIRCLE', 'TEXT'):
            kind = t[i + 1].strip(); d = {}; i += 2
            while i < len(t) - 1 and t[i].strip() != '0':
                d.setdefault(t[i].strip(), t[i + 1].strip()); i += 2
            ents.append((kind, d))
        else: i += 1
    return ents
def flat_svg(name, cx, cy, s=1.0):
    g = []
    ents = read_dxf(os.path.join(D, 'vystup', 'ptak_%s_rozvin.dxf' % name))
    xs = [float(d[k]) for kd, d in ents if kd == 'LINE' and d['8'] == 'OBRYS' for k in ('10', '11')]
    ys = [float(d[k]) for kd, d in ents if kd == 'LINE' and d['8'] == 'OBRYS' for k in ('20', '21')]
    ox, oy = cx - (min(xs) + max(xs)) / 2 * s, cy + (min(ys) + max(ys)) / 2 * s
    for kind, d in ents:
        X = lambda x: ox + float(x) * s; Y = lambda y: oy - float(y) * s
        col = {'OBRYS': '#17181A', 'OHYB': '#B8440F', 'OTVORY': '#17181A', 'POPIS': '#5E5A54'}[d['8']]
        if kind == 'LINE': g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s" %s/>' % (X(d['10']), Y(d['20']), X(d['11']), Y(d['21']), col, 1.2 if d['8'] == 'OBRYS' else 1, 'stroke-dasharray="5 3"' if d['8'] == 'OHYB' else ''))
        elif kind == 'CIRCLE': g.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="%s"/>' % (X(d['10']), Y(d['20']), float(d['40']) * s, col))
        else: g.append('<text x="%.1f" y="%.1f" font-size="%.1f" fill="%s" font-family="sans-serif">%s</text>' % (X(d['10']), Y(d['20']), float(d['40']) * s * 1.2, col, d['1']))
    return ''.join(g)
def iso_svg(m, cx, cy, s=1.0, az=-58, el=18):
    a, e = math.radians(az), math.radians(el)
    def P(p):
        x, y, z = p; X = x * math.cos(a) + y * math.sin(a); Yd = -x * math.sin(a) + y * math.cos(a)
        return (X, z * math.cos(e) - Yd * math.sin(e), Yd * math.cos(e) + z * math.sin(e))
    V = [P(p) for p in m['v']]; L = (0.35, 0.55, 0.75); n = math.sqrt(sum(c * c for c in L)); L = [c / n for c in L]
    tris = []
    for f in m['f']:
        A, B, C = (m['v'][k] for k in f)
        u = [B[i] - A[i] for i in range(3)]; w = [C[i] - A[i] for i in range(3)]
        N = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; nl = math.sqrt(sum(c * c for c in N)) or 1
        sh = abs(sum(N[i] / nl * [0.45, -0.75, 0.5][i] for i in range(3)))
        tris.append((sum(V[k][2] for k in f) / 3, [V[k] for k in f], sh))
    tris.sort(key=lambda t: t[0])
    ox = cx - (min(p[0] for p in V) + max(p[0] for p in V)) / 2 * s; oy = cy + (min(p[1] for p in V) + max(p[1] for p in V)) / 2 * s
    out = []
    for _, pts, sh in tris:
        c = int(40 + 150 * sh)
        out.append('<polygon points="%s" fill="rgb(%d,%d,%d)" stroke="rgb(%d,%d,%d)" stroke-width="0.4"/>' % (' '.join('%.1f,%.1f' % (ox + p[0] * s, oy - p[1] * s) for p in pts), c, c, c + 4, c, c, c + 4))
    return ''.join(out)
if __name__ == '__main__':
    mesh = json.load(open(sys.argv[1]))
    names = ['vzlet', 'mavnuti', 'plachteni', 'klouzani']
    cw = 300
    body = ''.join('<g>%s</g><g>%s</g>' % (flat_svg(n, cw / 2 + i * cw, 190, 1.0), iso_svg(mesh[n], cw / 2 + i * cw, 520, 1.15)) for i, n in enumerate(names))
    hdr = '<text x="20" y="28" font-size="17" font-family="sans-serif" font-weight="600">Rozvinutý plech pro C2 – oranžově čáry ohybů, popisky v DXF</text><text x="20" y="378" font-size="17" font-family="sans-serif" font-weight="600">3D – háček ohnutý od zdi (zeď je vzadu)</text>'
    open(os.path.join(D, 'nahled_vyroba.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="680" style="background:#F7F6F2">%s%s</svg>' % (cw * 4, hdr, body))
