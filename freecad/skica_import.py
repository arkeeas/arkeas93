# -*- coding: utf-8 -*-
"""
Import skici ze Skicáře (skica.html, soubor *.skica.json) do FreeCADu.

Spuštění ve FreeCADu:  Makro → Makra… → skica_import.py → Spustit  (zeptá se na soubor)
  nebo v Python konzoli:  SOUBOR = '/cesta/stul.skica.json'; exec(open('/cesta/skica_import.py').read())
Mimo FreeCAD:            python3 skica_import.py stul.skica.json   (jen kontrola a výpis, nic nestaví)

Co makro udělá:
  - každý prut postaví jako těleso svého profilu (jekl, pásovina, L, U, trubka, kulatina) po ose a → b,
    průřez natočený podle vektorů u, v z JSONu (osa = střed obrysu průřezu);
  - desky jako kvádry (spodní plocha ve výšce z);
  - styky, které jsou v JSONu jednoznačné (UPRAVIT_STYKY = True):
      * uzel se spojem „pokos“ a právě 2 pruty → oba seříznout rovinou půlící úhel;
      * uzel se spojem „plny“ → konce prodloužit o půl profilu (plný roh, zavaří se);
      * prut, který končí na jiném prutu (lezi_na), nebo uzel „tupo“ s průběžným prutem
        → konec zkrátit k líci průběžného prutu;
      * ostatní uzly zůstanou jen v osách (pruty se překrývají) – ty doladí AI / člověk.
  - vypíše kusovník s délkami po úpravě styků a seznam neurčených uzlů.
"""
import json
import math
import os
import sys

UPRAVIT_STYKY = True

# ---------------- vektory ----------------
def sub(a, b): return [a[i] - b[i] for i in range(3)]
def add(a, b): return [a[i] + b[i] for i in range(3)]
def mul(a, k): return [c * k for c in a]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def length(a): return math.sqrt(dot(a, a))
def norm(a):
    l = length(a)
    return [c / l for c in a] if l > 1e-12 else [0.0, 0.0, 0.0]
def key(p): return ','.join('%.1f' % round(c, 1) for c in p)


# ---------------- profily ----------------
def parse_profile(pid):
    s = pid.replace('×', 'x').replace(',', '.').split()
    typ, nums = s[0], [float(x) for x in s[1].split('x')]
    if typ in ('jekl', 'L', 'U'):
        return {'typ': typ, 'a': nums[0], 'b': nums[1], 't': nums[2]}
    if typ == 'pas':
        return {'typ': typ, 'a': nums[0], 'b': nums[1]}
    if typ == 'trubka':
        return {'typ': typ, 'd': nums[0], 't': nums[1]}
    return {'typ': 'kulatina', 'd': nums[0]}

def extent(p):
    return (p['d'], p['d']) if 'd' in p else (p['a'], p['b'])

def kg_m(p):
    t = p.get('t', 0)
    if p['typ'] == 'jekl': A = 2 * t * (p['a'] + p['b']) - 4 * t * t
    elif p['typ'] == 'pas': A = p['a'] * p['b']
    elif p['typ'] == 'L': A = t * (p['a'] + p['b'] - t)
    elif p['typ'] == 'U': A = t * (p['a'] + 2 * p['b'] - 2 * t)
    elif p['typ'] == 'trubka': A = math.pi * (p['d'] - t) * t
    else: A = math.pi * p['d'] ** 2 / 4
    return A * 0.00785

def half_face(p, u, v, d):
    """vzdálenost od osy prutu k jeho líci ve směru d (d kolmé na osu)"""
    w, h = extent(p)
    if 'd' in p:
        return p['d'] / 2
    return abs(dot(d, u)) * w / 2 + abs(dot(d, v)) * h / 2


# ---------------- načtení a styky (bez FreeCADu) ----------------
def load(path):
    with open(path, encoding='utf-8') as f:
        J = json.load(f)
    if J.get('format') != 'arkeas-skica':
        raise ValueError('Soubor není skica ze Skicáře (chybí "format": "arkeas-skica").')
    return J

def plan(J):
    """spočítá pro každý prut úpravy konců: prodloužení e0/e1 (+ ven, − zkrácení) a řezné roviny"""
    P = {m['id']: m for m in J['pruty']}
    prof = {m['id']: parse_profile(m['profil']) for m in J['pruty']}
    ends = {}
    for m in J['pruty']:
        for end, p in ((0, m['a']), (1, m['b'])):
            ends.setdefault(key(p), []).append((m['id'], end))
    uzly = {key(u['bod']): u for u in J.get('uzly', [])}
    adj = {m['id']: {'e': [0.0, 0.0], 'kind': [None, None], 'cuts': [], 'pozn': []} for m in J['pruty']}
    neurcene = []
    if not UPRAVIT_STYKY:
        return P, prof, adj, neurcene

    def out_dir(mid, end):
        m = P[mid]
        d = norm(sub(m['b'], m['a']))
        return d if end == 0 else mul(d, -1)       # od uzlu ven po prutu

    for k, lst in ends.items():
        u = uzly.get(k, {})
        spoj, thru, lezi = u.get('spoj', ''), u.get('prubezny', ''), u.get('lezi_na', [])
        if not thru and lezi:
            thru = lezi[0]
        bod = [float(c) for c in k.split(',')]
        if spoj == 'pokos' and len(lst) == 2:
            (i, ei), (j, ej) = lst
            di, dj = out_dir(i, ei), out_dir(j, ej)
            if abs(dot(di, dj)) < 0.9999:
                for (a, ea, da, db) in ((i, ei, di, dj), (j, ej, dj, di)):
                    adj[a]['e'][ea] = 3 * max(extent(prof[a]))
                    adj[a]['kind'][ea] = 'pokos'
                    adj[a]['cuts'].append((bod, sub(da, db)))
                    adj[a]['pozn'].append('pokos v [%s]' % k)
            continue
        if spoj == 'plny':
            for (a, ea) in lst:
                adj[a]['e'][ea] = max(extent(prof[a])) / 2
                adj[a]['kind'][ea] = 'plny'
                adj[a]['pozn'].append('plný roh v [%s]' % k)
            continue
        if thru and thru in P:
            T = P[thru]
            tx = norm(sub(T['b'], T['a']))
            own = [ea for (a, ea) in lst if a == thru]
            others = [(a, ea) for (a, ea) in lst if a != thru]
            if own and others:                      # průběžný tu taky končí (roh na tupo) – přetáhnout ho přes líc druhého
                o = P[others[0][0]]
                adj[thru]['e'][own[0]] = half_face(prof[o['id']], o['u'], o['v'], tx)
                adj[thru]['kind'][own[0]] = 'tupo'
            for (a, ea) in lst:
                if a == thru:
                    continue
                d = out_dir(a, ea)
                perp = sub(d, mul(tx, dot(d, tx)))
                if length(perp) < 1e-6:
                    continue                      # souosé – nechat
                c = abs(dot(norm(perp), d)) or 1.0
                sh = half_face(prof[thru], T['u'], T['v'], norm(perp)) / c
                adj[a]['e'][ea] = -sh
                adj[a]['kind'][ea] = 'tupo'
                adj[a]['pozn'].append('na tupo k %s' % thru)
            continue
        if len(lst) > 1 or spoj:
            neurcene.append((k, [x[0] for x in lst], spoj or ''))
    return P, prof, adj, neurcene

def report(J, P, prof, adj, neurcene):
    L = ['Skica: %s' % J.get('nazev', ''), 'Prutů: %d, desek: %d' % (len(J['pruty']), len(J.get('desky', [])))]
    rows = {}
    for m in J['pruty']:
        A = adj[m['id']]
        cut = length(sub(m['b'], m['a'])) + sum(A['e'][i] for i in (0, 1) if A['kind'][i] != 'pokos')
        r = rows.setdefault((m['profil'], round(cut)), [0, []])
        r[0] += 1
        r[1].append(m['id'])
    L.append('Kusovník (délka po úpravě styků; u pokosu osová – přesnou dlouhou hranu změř na tělese):')
    for (pr, ln), (n, ids) in sorted(rows.items()):
        L.append('  %-16s %6d mm  %2d ks   %s' % (pr, ln, n, ', '.join(ids)))
    kg = sum(kg_m(prof[m['id']]) * length(sub(m['b'], m['a'])) / 1000 for m in J['pruty'])
    L.append('Hmotnost oceli (osově): %.1f kg' % kg)
    if neurcene:
        L.append('Neurčené uzly (jen v osách, doladit): %d' % len(neurcene))
        for k, ids, s in neurcene[:30]:
            L.append('  [%s] %s %s' % (k, ', '.join(ids), s))
    for w in J.get('upozorneni', []):
        L.append('POZOR: ' + w)
    return '\n'.join(L)


# ---------------- FreeCAD ----------------
def build(J, P, prof, adj):
    import FreeCAD as App
    import Part
    Vec = App.Vector
    ext = max([abs(c) for m in J['pruty'] for c in m['a'] + m['b']] + [1000.0])
    BIG = 10 * ext + 1000

    def section_face(p, o, u, v):
        U, W = Vec(*u), Vec(*v)
        pt = lambda x, y: o + U * x + W * y
        def poly(pts):
            return Part.makePolygon([pt(x, y) for x, y in pts] + [pt(*pts[0])])
        if 'd' in p:
            n = U.cross(W)
            outer = Part.Wire(Part.makeCircle(p['d'] / 2, o, n))
            f = Part.Face(outer)
            if p['typ'] == 'trubka':
                f = f.cut(Part.Face(Part.Wire(Part.makeCircle(p['d'] / 2 - p['t'], o, n))))
            return f
        w, h = extent(p)
        hw, hh = w / 2, h / 2
        if p['typ'] in ('jekl', 'pas'):
            f = Part.Face(poly([(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]))
            if p['typ'] == 'jekl':
                t = p['t']
                f = f.cut(Part.Face(poly([(-hw + t, -hh + t), (hw - t, -hh + t), (hw - t, hh - t), (-hw + t, hh - t)])))
            return f
        t = p['t']
        if p['typ'] == 'L':
            return Part.Face(poly([(-hw, -hh), (hw, -hh), (hw, -hh + t), (-hw + t, -hh + t), (-hw + t, hh), (-hw, hh)]))
        return Part.Face(poly([(-hw, -hh), (hw, -hh), (hw, hh), (hw - t, hh), (hw - t, -hh + t), (-hw + t, -hh + t), (-hw + t, hh), (-hw, hh)]))

    def half_space(p, n):
        nv = Vec(*n); nv.normalize()
        e2 = nv.cross(Vec(0, 0, 1)) if abs(nv.z) < 0.9 else nv.cross(Vec(1, 0, 0))
        e2.normalize(); e3 = nv.cross(e2)
        b = Part.makeBox(BIG, 2 * BIG, 2 * BIG, Vec(0, -BIG, -BIG))
        m = App.Matrix(nv.x, e2.x, e3.x, 0, nv.y, e2.y, e3.y, 0, nv.z, e2.z, e3.z, 0, 0, 0, 0, 1)
        b = b.transformGeometry(m)
        b.translate(Vec(*p))
        return b

    doc = App.ActiveDocument or App.newDocument('Skica')
    nazev = ''.join(ch if ch.isalnum() else '_' for ch in J.get('nazev', 'Skica'))[:40] or 'Skica'
    root = doc.addObject('App::DocumentObjectGroup', 'Skica_' + nazev)
    groups = {}
    PAL = [(0.35, 0.39, 0.43), (0.23, 0.35, 0.55), (0.18, 0.49, 0.31), (0.55, 0.35, 0.23), (0.48, 0.31, 0.55), (0.31, 0.50, 0.50)]
    for m in J['pruty']:
        p = prof[m['id']]
        a, b = m['a'], m['b']
        d = norm(sub(b, a))
        e0, e1 = adj[m['id']]['e']
        s = sub(a, mul(d, e0))
        Ltot = length(sub(b, a)) + e0 + e1
        if Ltot < 0.5:
            continue
        face = section_face(p, Vec(*s), m['u'], m['v'])
        solid = face.extrude(Vec(*mul(d, Ltot)))
        for (pt, n) in adj[m['id']]['cuts']:
            solid = solid.common(half_space(pt, n))
        g = groups.get(m['profil'])
        if g is None:
            g = doc.addObject('App::DocumentObjectGroup', 'Profil_' + m['profil'].replace(' ', '_').replace('.', '_'))
            g.Label = m['profil']
            root.addObject(g)
            groups[m['profil']] = g
        o = doc.addObject('Part::Feature', m['id'])
        o.Label = '%s %s%s' % (m['id'], m['profil'], (' ' + m['nazev']) if m.get('nazev') else '')
        o.Shape = solid
        g.addObject(o)
        if App.GuiUp:
            o.ViewObject.ShapeColor = PAL[list(groups).index(m['profil']) % len(PAL)]
    MAT = {'dřevo': (0.77, 0.60, 0.42, 0), 'sklo': (0.62, 0.83, 0.86, 70), 'kámen': (0.65, 0.64, 0.61, 0), 'plech': (0.49, 0.53, 0.56, 0)}
    if J.get('desky'):
        gd = doc.addObject('App::DocumentObjectGroup', 'Desky')
        root.addObject(gd)
        for pl in J['desky']:
            w, dd = pl['x1'] - pl['x0'], pl['y1'] - pl['y0']
            o = doc.addObject('Part::Feature', pl['id'])
            o.Label = '%s %s %dx%dx%d%s' % (pl['id'], pl['material'], w, dd, pl['tloustka'], (' ' + pl['nazev']) if pl.get('nazev') else '')
            o.Shape = Part.makeBox(w, dd, pl['tloustka'], Vec(pl['x0'], pl['y0'], pl['z']))
            gd.addObject(o)
            if App.GuiUp:
                c = MAT.get(pl['material'], MAT['dřevo'])
                o.ViewObject.ShapeColor = c[:3]
                o.ViewObject.Transparency = c[3]
    doc.recompute()
    if App.GuiUp:
        import FreeCADGui as Gui
        Gui.activeDocument().activeView().viewIsometric()
        Gui.SendMsgToActiveView('ViewFit')
    return doc


def main(path):
    J = load(path)
    P, prof, adj, neurcene = plan(J)
    rep = report(J, P, prof, adj, neurcene)
    try:
        import FreeCAD as App
    except ImportError:
        print(rep)
        return
    build(J, P, prof, adj)
    App.Console.PrintMessage(rep + '\n')


if __name__ == '__main__' and 'FreeCAD' not in sys.modules:
    if len(sys.argv) < 2:
        print('použití: python3 skica_import.py soubor.skica.json')
        sys.exit(1)
    main(sys.argv[1])
else:
    _cesta = globals().get('SOUBOR')
    if not _cesta:
        try:
            import FreeCAD as _App
            if _App.GuiUp:
                from PySide import QtGui
                _cesta = QtGui.QFileDialog.getOpenFileName(None, 'Skica ze Skicáře', os.path.expanduser('~'), 'Skica (*.json)')[0]
        except Exception:
            _cesta = None
    if _cesta:
        main(_cesta)
