# FreeCAD (headless): freecad.cmd -c "exec(open('.../ptaci_fc.py').read())"
# Z ptaci.json postaví pro každého ptáka: rozvinutý plech (DXF pro C2) a 3D model s ohnutým háčkem (STEP, FCStd).
import json, math, os
import FreeCAD as App, Part, sys
sys.path.insert(0, '/home/arkeas/snap/freecad/common')
from vesak_lib import clean_face, outline_loops, slot_rects, bend_cutters

D = '/home/arkeas/Desktop/cad_worker/dobre/ptaci_vesaky'
OUT = os.path.join(D, 'vystup'); os.makedirs(OUT, exist_ok=True)
J = json.load(open(os.path.join(D, 'ptaci.json')))
P, TG = J['params'], J['tongue']
t, ri, w = P['t'], P['ri'], P['tongue_w']
s1, s2, s3 = TG['s']
R_TIP = 1.5                      # zaoblení hrotů (křídla, ocas) – bezpečné hrany, laser je vypálí čistě

V = lambda x, y, z=0: App.Vector(x, y, z)
def face2d(pts):                # 2D (x, y) v rovině XY, vždy proti směru hodin (normála +Z), jinak se plochy nesloučí
    if sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) < 0: pts = pts[::-1]
    return Part.Face(Part.makePolygon([V(x, y) for x, y in pts] + [V(*pts[0])]))

def union2d(faces):
    """sjednocení ploch v rovině XY: vytáhnout na tělesa, sloučit, vzít spodní plochu (z = 0)"""
    sol = faces[0].extrude(V(0, 0, 1))
    for f in faces[1:]: sol = sol.fuse(f.extrude(V(0, 0, 1)))
    sol = sol.removeSplitter()
    bottom = [f for f in sol.Faces if abs(f.BoundBox.ZMax) < 1e-6 and abs(f.BoundBox.ZMin) < 1e-6]
    assert len(bottom) == 1, 'obrys se nesloučil do jedné plochy: %d' % len(bottom)
    return bottom[0]

def smooth(f, r):
    """otevření (−r, +r) zaoblí ostré hroty, uzavření (+r/2, −r/2) zaoblí vnitřní kouty"""
    f = f.makeOffset2D(-r, join=0).makeOffset2D(r, join=0)
    return f.makeOffset2D(r / 2, join=0).makeOffset2D(-r / 2, join=0)

def outline_pts(face, tol=0.2):
    loops = []
    for wr in face.Wires:
        pts = [(p.x, p.y) for p in wr.discretize(Deflection=tol)]
        if len(pts) > 2 and math.dist(pts[0], pts[-1]) < 1e-6: pts = pts[:-1]
        loops.append(pts)
    return loops

def dxf(path, outer, circles, bends, notes, slots=()):
    L = ['0', 'SECTION', '2', 'ENTITIES']
    def line(a, b, layer):
        L.extend(['0', 'LINE', '8', layer, '10', '%.3f' % a[0], '20', '%.3f' % a[1], '30', '0', '11', '%.3f' % b[0], '21', '%.3f' % b[1], '31', '0'])
    for loop in outer:
        for i, p in enumerate(loop): line(p, loop[(i + 1) % len(loop)], 'OBRYS')
    for loop in slots:
        for i, p in enumerate(loop): line(p, loop[(i + 1) % len(loop)], 'OTVORY')
    for x, y, r in circles:
        L.extend(['0', 'CIRCLE', '8', 'OTVORY', '10', '%.3f' % x, '20', '%.3f' % y, '30', '0', '40', '%.3f' % r])
    for a, b in bends: line(a, b, 'OHYB')
    for x, y, h, txt in notes:
        L.extend(['0', 'TEXT', '8', 'POPIS', '10', '%.3f' % x, '20', '%.3f' % y, '30', '0', '40', '%.2f' % h, '1', txt])
    L.extend(['0', 'ENDSEC', '0', 'EOF'])
    open(path, 'w').write('\n'.join(L) + '\n')

summary = []
for b in J['birds']:
    name = b['pose']
    ax, ay = b['anchor']
    birdf = [face2d(p) for p in b['parts']]
    x0, x1 = ax - w / 2, ax + w / 2
    top = ay + 6                                    # jazýček zajede 6 mm do těla
    # rozvinutý tvar: pták + jazýček celé rozvinuté délky
    flat = union2d(birdf + [face2d([(x0, top), (x0, ay - TG['L']), (x1, ay - TG['L']), (x1, top)])])
    flat = clean_face(smooth(flat, R_TIP))
    slots, SL = slot_rects(ax, ay, w, TG['bends'], TG['BA'])
    holes_y = [ay - 16, ay - s1 + 14]              # 2 díry pro vruty na části u zdi
    circles = [(ax, y, P['hole'] / 2) for y in holes_y]
    bends = [((x0, ay - d), (x1, ay - d)) for d in TG['bends']]
    bb = flat.BoundBox
    notes = [(bb.XMin, bb.YMin - 8, 3.5, 'PTAK %s  plech %g mm S235  C2  1 ks' % (name.upper(), t)),
             (bb.XMin, bb.YMin - 14, 3, 'OHYB 1 a 2: 90 st. stejnym smerem (k licu), vnitrni R%g, K=%g' % (ri, P['K'])),
             (bb.XMin, bb.YMin - 19, 3, 'otvory D%g se zahloubenim D%g x 90 st. z licove strany' % (P['hole'], P['csk']))]
    notes.append((bb.XMin, bb.YMin - 24, 3, 'drazky v ohybech %g x %.1f mm (snadne ohybani)' % (SL, TG['BA'])))
    dxf(os.path.join(OUT, 'ptak_%s_rozvin.dxf' % name), outline_loops(flat), circles, bends, notes, slots)

    # ---- 3D: rovná část (pták + jazýček až k ohybu) v rovině XZ, tloušťka do +Y (zeď je y = 0) ----
    z0 = ay - s1
    flat3 = clean_face(smooth(union2d(birdf + [face2d([(x0, top), (x0, z0), (x1, z0), (x1, top)])]), R_TIP))
    m = App.Matrix(); m.A11, m.A12, m.A13 = 1, 0, 0; m.A21, m.A22, m.A23 = 0, 0, 1; m.A31, m.A32, m.A33 = 0, 1, 0
    plate = flat3.copy().rotate(V(0, 0, 0), V(1, 0, 0), 90).extrude(V(0, t, 0))   # (x, y2d) → (x, 0, z)   # otočení (ne transformGeometry – ta mění roviny na B-spline plochy)
    # ohnutý háček: profil v rovině YZ se skutečnými oblouky, vytažený o šířku jazýčku
    cy, y2 = t + ri, t + ri + s2
    ro = ri + t
    Y = lambda y, z: V(x0, y, z)
    arc = lambda c, r, a0, a1: Part.Arc(Y(c[0] + r * math.cos(a0), c[1] + r * math.sin(a0)), Y(c[0] + r * math.cos((a0 + a1) / 2), c[1] + r * math.sin((a0 + a1) / 2)), Y(c[0] + r * math.cos(a1), c[1] + r * math.sin(a1)))
    pi = math.pi
    segs = [
        arc((cy, z0), ro, pi, 1.5 * pi),                     # vnější oblouk 1: (0, z0) → (cy, z0 − ro)
        Part.LineSegment(Y(cy, z0 - ro), Y(y2, z0 - ro)),
        arc((y2, z0), ro, 1.5 * pi, 2 * pi),                 # vnější oblouk 2 → (y2 + ro, z0)
        Part.LineSegment(Y(y2 + ro, z0), Y(y2 + ro, z0 + s3)),
        Part.LineSegment(Y(y2 + ro, z0 + s3), Y(y2 + ri, z0 + s3)),
        Part.LineSegment(Y(y2 + ri, z0 + s3), Y(y2 + ri, z0)),
        arc((y2, z0), ri, 2 * pi, 1.5 * pi),                 # vnitřní oblouk 2
        Part.LineSegment(Y(y2, z0 - ri), Y(cy, z0 - ri)),
        arc((cy, z0), ri, 1.5 * pi, pi),                     # vnitřní oblouk 1 → (t, z0)
        Part.LineSegment(Y(t, z0), Y(t, z0 + 0.5)), Part.LineSegment(Y(t, z0 + 0.5), Y(0, z0 + 0.5)), Part.LineSegment(Y(0, z0 + 0.5), Y(0, z0))  # 0,5 mm přesah do rovné části → spolehlivé sloučení,
    ]
    hook = Part.Face(Part.Wire(Part.Shape(segs).Edges)).extrude(V(w, 0, 0))
    solid = plate.fuse(hook).removeSplitter()
    for c in bend_cutters(ax, z0, SL, t, ri, s2): solid = solid.cut(c)
    for z in holes_y:                                          # díry se zahloubením z lícové strany (y = t)
        solid = solid.cut(Part.makeCylinder(P['hole'] / 2, t + 2, V(ax, -1, z), V(0, 1, 0)))
        h = (P['csk'] - P['hole']) / 2
        solid = solid.cut(Part.makeCone(P['hole'] / 2, P['csk'] / 2, h + 0.01, V(ax, t - h, z), V(0, 1, 0)))
    doc = App.newDocument('ptak_' + name)
    o = doc.addObject('Part::Feature', 'Ptak_' + name); o.Shape = solid
    doc.recompute()
    solid.exportStep(os.path.join(OUT, 'ptak_%s.step' % name))
    doc.saveAs(os.path.join(OUT, 'ptak_%s.FCStd' % name))
    App.closeDocument(doc.Name)
    fb = flat.BoundBox
    summary.append(dict(pose=name, valid=solid.isValid(), solids=len(solid.Solids), vol=round(solid.Volume), kg=round(solid.Volume * 7.85e-6, 3),
                        flat=[round(fb.XLength, 1), round(fb.YLength, 1)], cut_mm=round(sum(e.Length for e in flat.Edges) + 2 * pi * P['hole'] / 2 * 2 + 2 * 2 * (SL + TG['BA'])), faces=len(solid.Faces), short_edges=sum(1 for e in solid.Edges if e.Length < 0.05),
                        hook_out=round(solid.BoundBox.YMax, 2), z_bottom=round(solid.BoundBox.ZMin - ay, 2)))
json.dump(summary, open(os.path.join(OUT, 'souhrn.json'), 'w'), ensure_ascii=False, indent=1)
print('HOTOVO', json.dumps(summary, ensure_ascii=False))
