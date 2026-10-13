# Společné funkce pro věšáky z plechu (FreeCAD headless): čistý obrys bez mikrohran a drážky v ohybech.
import math
import FreeCAD as App, Part
V = lambda x, y, z=0: App.Vector(x, y, z)

def clean_face(face, tol=0.05, min_len=0.25):
    """Obrys po zaoblení (makeOffset2D) má tisíce drobných B-spline úseků a hran < 0,01 mm – na tom padá GUI FreeCADu.
    Obrys se navzorkuje a zjednoduší (Douglas–Peucker, odchylka tol) na lomenou čáru: jen úsečky, žádná kratší než min_len."""
    pts = [(p.x, p.y) for p in face.OuterWire.discretize(Deflection=0.005)]
    if math.dist(pts[0], pts[-1]) < 1e-6: pts = pts[:-1]
    def dp(a, b):
        A, B = pts[a], pts[b]; dx, dy = B[0] - A[0], B[1] - A[1]; L = math.hypot(dx, dy) or 1e-9
        best, k = -1, None
        for i in range(a + 1, b):
            d = abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L
            if d > best: best, k = d, i
        return (best, k)
    # začátek v nejvzdálenějším bodě od prvního (ať se smyčka dělí na dvě rozumné poloviny)
    far = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
    keep = {0, far, len(pts)}
    pts.append(pts[0])
    stack = [(0, far), (far, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2: continue
        d, k = dp(a, b)
        if d > tol: keep.add(k); stack += [(a, k), (k, b)]
    idx = sorted(keep - {len(pts)})
    q = [pts[i] for i in idx if i < len(pts) - 1]
    r = [q[0]]
    for p in q[1:]:
        if math.dist(p, r[-1]) >= min_len: r.append(p)
    if math.dist(r[-1], r[0]) < min_len: r.pop()
    return Part.Face(Part.makePolygon([V(x, y) for x, y in r] + [V(*r[0])]))

def outline_loops(face, defl=0.05):
    loops = []
    for wr in face.Wires:
        pts = [(p.x, p.y) for p in wr.discretize(Deflection=defl)]
        if len(pts) > 2 and math.dist(pts[0], pts[-1]) < 1e-6: pts = pts[:-1]
        loops.append(pts)
    return loops

def slot_rects(ax, ay, w, bends, BA, frac=0.5):
    """drážka v ohybu: uprostřed jazýčku, délka frac × šířka, šířka = délka oblouku v ohybu (BA)"""
    L = round(w * frac, 1)
    return [[(ax - L / 2, ay - d - BA / 2), (ax + L / 2, ay - d - BA / 2), (ax + L / 2, ay - d + BA / 2), (ax - L / 2, ay - d + BA / 2)] for d in bends], L

def bend_cutters(ax, z0, L, t, ri, s2):
    """3D: odebrat oblouk ohybu v šířce drážky (čtvrtmezikruží vytažené o L) u obou ohybů"""
    out = []
    for (cy, a0, a1) in ((t + ri, math.pi, 1.5 * math.pi), (t + ri + s2, 1.5 * math.pi, 2 * math.pi)):
        x0 = ax - L / 2
        P = lambda r, a: V(x0, cy + r * math.cos(a), z0 + r * math.sin(a))
        am = (a0 + a1) / 2
        ri2, ro2 = ri - 0.05, ri + t + 0.05
        segs = [Part.Arc(P(ro2, a0), P(ro2, am), P(ro2, a1)), Part.LineSegment(P(ro2, a1), P(ri2, a1)),
                Part.Arc(P(ri2, a1), P(ri2, am), P(ri2, a0)), Part.LineSegment(P(ri2, a0), P(ro2, a0))]
        out.append(Part.Face(Part.Wire(Part.Shape(segs).Edges)).extrude(V(L, 0, 0)))
    return out
