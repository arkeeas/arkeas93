"""Generátor laserových motivů řady „Příroda“ pro zábradlí (assets/zabradli/motiv-<id>.js + DXF + náhled).

Zdroj: AI vektor (Recraft) – čtyři scény v pásu. Postup:
  1. rasterizace scény v měřítku výroby (0,5 mm / px), šedé fragmenty prahem jasu
  2. otvory užší než HOLE_MIN se zavřou (štěrbiny, drobné tečky)
  3. můstky užší než WEB se rozšíří (výsledná ocel ≥ WEB)
  4. volné ostrůvky: malé zmizí, velké (ptáci, listy) se připojí můstkem WEB k nejbližší oceli
  5. kontrola: nejužší můstek, největší otvor (koule), podíl otvorů
  6. obrysy otvorů jako lomené čáry (bulge 0), počátek vlevo dole, y nahoru, mm
Motiv je „scéna na ořez“: konfigurátor ho nedeformuje, jen ořízne na rozměr pole (dole ukotveno, střed na střed).
Použití: python3 nastroje/motiv_priroda.py /cesta/priroda_vector.svg
"""
import sys, os, json, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(__file__))
from svg_raster import rasterize
from skimage.morphology import medial_axis

PX = 0.5                     # mm na px rastru
H_MM = 820.0                 # výška scény = výška plechu bez okraje u zábradlí 1 m (při menší výšce se ořízne horní okraj)
WEB = 6.0                    # nejužší můstek oceli (mm) → plech max 6 mm
WEB_R = 6.9                  # v rastru se drží širší (rezerva na zjednodušení obrysu ±0,3 mm a mřížku 0,5 mm)
HOLE_MIN = 6.0               # nejužší otvor (mm)
FINE = {'los': 5.0}           # motivy s jemnější kresbou: můstek a otvor 5 mm → plech nejvýš 5 mm
ISL_KEEP = 300.0             # ostrůvek větší než tolik mm² se připojí, menší zmizí
EPS = 0.3                    # tolerance zjednodušení obrysu (mm)
ROOT = os.path.join(os.path.dirname(__file__), '..')

SCENES = [  # id, popis, rámeček scény v SVG (x0, y0, x1, y1), zvířata [x od, x do (mm ve scéně), hlavní]
    ('jelen',  'Jelen v lese',   'jelen, srnec, smrky', (31, 294, 352, 478), [[975, 1430, 1], [270, 410, 0]]),
    ('medved', 'Medvěd',         'medvěd, srnec, smrky', (364, 294, 660, 478), [[970, 1319, 1], [280, 410, 0]]),
    ('smrky',  'Smrkový les',    'smrky a hejno ptáků',  (672, 294, 992, 478), []),
    ('los',    'Los',            'los, ptáci, smrky',    None,                 [[609, 1070, 1]]),
]

def disk(r_mm):
    r = max(1, int(round(r_mm / PX)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))

def _mm(v): return int(round(v / PX))

def _ballmap(M):
    c = M.copy(); b = 1; c[:b] = 1; c[-b:] = 1; c[:, :b] = 1; c[:, -b:] = 1
    return cv2.distanceTransform((1 - c).astype(np.uint8), cv2.DIST_L2, 5)

def _attach(M, B, avoid=None):
    """připojí tvar B nejbližším bodem k oceli M (můstek WEB), mimo oblast avoid (např. tělo zvířete); vrací délku můstku v mm"""
    H, W = M.shape
    T = M if avoid is None else (M & (1 - avoid)).astype(np.uint8)
    dist, lbl = cv2.distanceTransformWithLabels(1 - T, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    yy, xx = np.where(T > 0); lut = np.zeros(lbl.max() + 1, np.int64); lut[lbl[yy, xx]] = yy * W + xx
    by, bx = np.where(B > 0); k = np.argmin(dist[by, bx]); q = lut[lbl[by[k], bx[k]]]
    cv2.line(M, (int(bx[k]), int(by[k])), (int(q % W), int(q // W)), 1, _mm(WEB))
    return dist[by[k], bx[k]] * PX

def prep_smrky(raw):
    """Smrky: strom pod každým ptákem se zvedne, až se špička dotkne ocasu (koruna 380 mm, okno ±110 mm);
    do největších otvorů oblohy se doplní další ptáci (kopie původních, i zrcadlově), dokud koule ≤ 110 mm."""
    raw = raw.astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(raw, 8)
    order = np.argsort(-st[1:, cv2.CC_STAT_AREA]) + 1
    T = (lab == order[0]).astype(np.uint8)
    birds = [(lab == i).astype(np.uint8) for i in order[1:] if st[i, cv2.CC_STAT_AREA] * PX * PX > 2000]
    H, W = T.shape
    for b in birds:
        by, bx = np.where(b > 0); i = np.argmax(by); tx, ty = int(bx[i]), int(by[i])
        x0, x1 = max(0, tx - _mm(150)), min(W, tx + _mm(150))
        cols = T[:, x0:x1]; ys = np.argmax(cols > 0, axis=0); ys[cols.max(0) == 0] = H
        cand = [(abs(x - tx), ys[x - x0], x) for x in range(x0 + _mm(20), x1 - _mm(20))
                if ys[x - x0] <= ys[max(0, x - x0 - _mm(20)):x - x0 + _mm(20)].min()]
        _, tipy, tipx = min(cand)
        if tipy <= ty: continue
        w = _mm(110); base = min(H - 1, tipy + _mm(380)); K = (base - ty + _mm(4)) / (base - tipy)
        win = T[tipy:base, max(0, tipx - w):tipx + w]
        sc = cv2.resize(win, (win.shape[1], int(win.shape[0] * K)), interpolation=cv2.INTER_NEAREST)
        y0 = base - sc.shape[0]
        T[max(0, y0):base, max(0, tipx - w):tipx + w] |= sc[max(0, -y0):]
    M = T.copy()
    for b in birds: M |= b
    tmpl = []
    for b in birds:
        ys, xs = np.where(b > 0); c = b[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; tmpl += [c, c[:, ::-1]]
    BIRDS[:] = tmpl
    return add_flock(M)

BIRDS = []                   # siluety ptáků ze scény Smrky (i zrcadlově) – doplňují se do velkých otvorů oblohy

def add_flock(M, limit=110, maxn=12, avoid=None):
    """do největších otvorů (koule nad limit) postupně vloží ptáky, každého připojí můstkem k nejbližší oceli"""
    M = M.astype(np.uint8); H, W = M.shape; tmpl = BIRDS
    for added in range(maxn):
        d = _ballmap(M)
        if 2 * d.max() * PX <= limit: break
        y, x = np.unravel_index(np.argmax(d), d.shape); r = d[y, x]
        t = tmpl[added % len(tmpl)]; s = min(1.0, 1.5 * r / max(t.shape))
        tt = cv2.resize(t, (max(3, int(t.shape[1] * s)), max(3, int(t.shape[0] * s))), interpolation=cv2.INTER_NEAREST)
        h, w = tt.shape; y0, x0 = y - h // 2, x - w // 2
        if y0 < 0 or x0 < 0 or y0 + h > H or x0 + w > W: break
        B = np.zeros_like(M); B[y0:y0 + h, x0:x0 + w] = tt
        if avoid is not None and (B & avoid).any(): avoid = avoid.copy()
        _attach(M, B, avoid); M |= B
    return M.astype(bool)

def add_branches(M, limit=110, maxn=8, avoid=None):
    """do největších otvorů natáhne mírně prohnutou větev (šířka WEB + 2 mm) od oceli k oceli, dokud koule ≤ limit;
    větev nesmí vést přes chráněnou oblast (zvíře) – pak se zkusí jiný sklon"""
    M = M.astype(np.uint8); H, W = M.shape; wpx = int(round((WEB + 2) / PX))
    for it in range(maxn):
        d = _ballmap(M)
        if 2 * d.max() * PX <= limit: break
        y, x = np.unravel_index(np.argmax(d), d.shape)
        done = False
        for ang in (-7, 7, -15, 15, 0, -25, 25):
            t = np.radians(ang); ux, uy = np.cos(t), np.sin(t)
            def run(sg):
                for r in range(1, W):
                    px, py = int(round(x + sg * r * ux)), int(round(y + sg * r * uy))
                    if px < 0 or py < 0 or px >= W or py >= H or M[py, px]: return (px, py), r
                return None, 0
            (a, ra), (b, rb) = run(-1), run(1)
            if a is None or b is None: continue
            n = 24; pts = []
            for i in range(n + 1):
                u = i / n; sag = 0.06 * (ra + rb) * 4 * u * (1 - u)            # větev se mírně prohne dolů
                pts.append([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + sag])
            L = np.zeros_like(M); cv2.polylines(L, [np.int32(pts)], False, 1, wpx)
            if avoid is not None and (L & avoid).any(): continue
            M |= L; done = True; break
        if not done: break
    return M.astype(bool)

def prep_los(svg):
    """Los: schodišťový panel (sklon 28,8°) narovnaný svislým zkosením – stromy zůstanou svislé, zem vodorovná.
    Los by se tím naklonil o 28,8° (vypadal by, že se pase z kopce), proto se vyřízne zvlášť a vloží zpět vzpřímený;
    mezeru pod předníma nohama vyplní pahorek. Vrací masku scény v rozlišení PX a výšce H_MM."""
    sc, X0, Y0 = 8, 15, 490
    m = rasterize(svg, (X0, Y0, 495, 990), sc).astype(np.uint8)
    H, W = m.shape
    k = (751 - 503.5) / 450.0
    def unshear(img):
        return cv2.warpAffine(img, np.float32([[1, 0, 0], [k, 1, 0]]), (W, H + int(k * W)), flags=cv2.INTER_NEAREST, borderValue=0)
    U = unshear(m)
    bx0, by0, bx1, by1 = [int((v - o) * sc) for v, o in zip((160, 698, 292, 791), (X0, Y0, X0, Y0))]
    box = np.zeros_like(m); box[by0:by1, bx0:bx1] = m[by0:by1, bx0:bx1]
    op = cv2.morphologyEx(box, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(op, 8)
    body = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    near = (cv2.distanceTransform(1 - body, cv2.DIST_L2, 5) < 22).astype(np.uint8)
    moose = body.copy()
    for _ in range(14):
        moose = cv2.dilate(moose, np.ones((3, 3), np.uint8)) & box & near
    U[cv2.dilate(unshear(moose), np.ones((5, 5), np.uint8)) > 0] = 0
    dy = int(round(k * (bx0 + bx1) / 2))
    U3 = U.copy(); U3[by0 + dy:by1 + dy, bx0:bx1] |= moose[by0:by1, bx0:bx1]
    MZ = np.zeros_like(U3); MZ[by0 + dy:by1 + dy, bx0:bx1] = cv2.dilate(moose, np.ones((25, 25), np.uint8))[by0:by1, bx0:bx1]
    for x in range(bx0, bx1):
        col = np.where(moose[by0:by1, x] > 0)[0]
        if not len(col) or col.max() < (by1 - by0) - 25: continue
        yb = by0 + col.max() + dy
        below = np.where(U3[yb + 1:, x] > 0)[0]
        if len(below): U3[yb:yb + 1 + below[0], x] = 1
    scene = U3[2280:3720, 110:3800]
    f = (H_MM / PX) / scene.shape[0]
    out = cv2.resize(scene * 255, None, fx=f, fy=f, interpolation=cv2.INTER_AREA) > 127
    zone = cv2.resize(MZ[2280:3720, 110:3800] * 255, (out.shape[1], out.shape[0]), interpolation=cv2.INTER_NEAREST) > 127
    return out, zone.astype(np.uint8)

def clean(mat, pad, WEB_R=WEB_R, HOLE_MIN=HOLE_MIN):
    """otvory ≥ HOLE_MIN, ocel ≥ WEB_R, žádné volné ostrůvky; opakuje se, protože smazaný ostrůvek nebo můstek
    k ptákovi může vedle sebe udělat nové úzké místo"""
    M = mat.astype(np.uint8)
    def frame(M):
        M[:pad] = M[-pad:] = 1; M[:, :pad] = M[:, -pad:] = 1
    for rnd in range(4):
        for _ in range(2):
            H = cv2.morphologyEx(1 - M, cv2.MORPH_OPEN, disk(HOLE_MIN / 2))          # štěrbiny pryč
            M = 1 - H
            thin = M & (1 - cv2.morphologyEx(M, cv2.MORPH_OPEN, disk(WEB_R / 2)))   # tenká ocel
            M = M | cv2.dilate(thin, disk(WEB_R / 2))
            frame(M)
        n, lab, st, _c = cv2.connectedComponentsWithStats(M, connectivity=8)
        main = lab[0, 0]
        isl = [i for i in range(1, n) if i != main]
        if not isl: break
        mainmask = (lab == main).astype(np.uint8)
        dist, lbl = cv2.distanceTransformWithLabels(1 - mainmask, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        ys, xs = np.where(mainmask > 0)
        lut = np.zeros(lbl.max() + 1, np.int64); lut[lbl[ys, xs]] = ys * M.shape[1] + xs
        for i in isl:
            if st[i, cv2.CC_STAT_AREA] * PX * PX < ISL_KEEP:
                M[lab == i] = 0; continue
            iy, ix = np.where(lab == i)
            k = np.argmin(dist[iy, ix]); p = (int(ix[k]), int(iy[k]))
            q = int(lut[lbl[iy[k], ix[k]]]); q = (q % M.shape[1], q // M.shape[1])
            cv2.line(M, p, q, 1, max(2, int(round(WEB_R / PX))))
    return M

def measure(M, pad, WEB=WEB):
    H = (1 - M).astype(np.uint8)
    dH = cv2.distanceTransform(H, cv2.DIST_L2, 5)
    ball = 2 * dH.max() * PX
    # můstky: ocel, kterou nepokryje otevření kruhem o průměru WEB − 1 px, je užší než WEB (bývají to jen špičky jehličí)
    Mi = M.astype(np.uint8)
    thin = Mi & (1 - cv2.morphologyEx(Mi, cv2.MORPH_OPEN, disk(WEB / 2 - PX)))
    thin[:pad + 2] = 0; thin[-pad - 2:] = 0; thin[:, :pad + 2] = 0; thin[:, -pad - 2:] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(thin, connectivity=8)
    # tenké místo, které spojuje dvě části (krček), je horší než špička: kolik je jich širších než 2 px
    web = WEB if not any(st[i, cv2.CC_STAT_AREA] * PX * PX > 4 for i in range(1, n)) else round(WEB - 1, 1)
    open_ratio = float(H[pad:-pad, pad:-pad].mean())
    yb, xb = np.unravel_index(np.argmax(dH), dH.shape)
    return ball, web, open_ratio, (xb, yb)

def trace(M, pad, HOLE_MIN=HOLE_MIN):
    H = (1 - M).astype(np.uint8)
    cs, hier = cv2.findContours(H, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    hh, ww = M.shape
    out, kids = [], 0
    for c, hrow in zip(cs, hier[0]):
        if hrow[3] != -1: kids += 1; continue
        a = cv2.approxPolyDP(c, EPS / PX, True)[:, 0, :]
        if len(a) < 3 or cv2.contourArea(a) * PX * PX < 10: continue
        if min(cv2.minAreaRect(c)[1]) * PX < HOLE_MIN - PX: continue      # drobný otvor (zbytek po ostrůvku) – zůstane ocel
        pts = [((x - pad + 0.5) * PX, (hh - pad - y - 0.5) * PX) for x, y in a]
        flat = []
        for x, y in pts: flat += [round(x, 2), round(y, 2), 0]
        out.append(flat)
    return out, kids

def main(svg_path):
    svg = open(svg_path).read()
    index = []
    for sid, lab, sub, box, anim in SCENES:
        if sid == 'los':
            mat, zone = prep_los(svg)
            mat = add_branches(mat, avoid=zone)           # velký otvor nad losem přepaží větev (ne přes losa)
        else:
            sc = (H_MM / PX) / (box[3] - box[1])
            mat = rasterize(svg, box, sc)
        if sid == 'smrky': mat = prep_smrky(mat)
        pad = int(round(10 / PX))
        mat = np.pad(mat, pad, constant_values=True)
        fine = FINE.get(sid)                       # jemný motiv: menší můstek a otvor (a tím i nižší nejsilnější plech)
        wb, hm = (fine, fine) if fine else (WEB, HOLE_MIN)
        M = clean(mat, pad, WEB_R=wb + 0.9, HOLE_MIN=hm)
        ball, web, opr, bpos = measure(M, pad, WEB=wb)
        holes, kids = trace(M, pad, HOLE_MIN=hm)
        Wmm = (M.shape[1] - 2 * pad) * PX
        cut = sum(sum(math.hypot(h[3*i] - h[3*((i+1) % (len(h)//3))], h[3*i+1] - h[3*((i+1) % (len(h)//3))+1]) for i in range(len(h)//3)) for h in holes) / 1000
        info = dict(id=sid, lab=lab, sub=sub, W=round(Wmm, 1), H=H_MM, web=round(web, 1), ball=round(ball), open=round(opr, 3),
                    n=len(holes), cutM=round(cut, 1), kids=kids)
        print(json.dumps(info, ensure_ascii=False))
        index.append(info)
        d = os.path.join(ROOT, 'assets', 'zabradli', 'priroda'); os.makedirs(d, exist_ok=True)
        img = np.where(M[pad:-pad, pad:-pad] > 0, 40, 245).astype(np.uint8)
        cv2.imwrite(os.path.join(d, sid + '_nahled.png'), cv2.resize(img, None, fx=0.4, fy=0.4, interpolation=cv2.INTER_AREA))
        orig = np.where(mat[pad:-pad, pad:-pad], 40, 245).astype(np.uint8)
        cv2.imwrite(os.path.join(d, sid + '_zdroj.png'), cv2.resize(orig, None, fx=0.4, fy=0.4, interpolation=cv2.INTER_AREA))
        js = ('/* Laserový motiv řady Příroda „%s“ – scéna %s × %s mm na ořez (dole ukotveno, vystředěno), počátek vlevo dole, mm.\n'
              '   Výřez = uzavřená křivka [x, y, bulge, …] (bulge 0 = úsečka). Zdroj: AI vektor, vyčištěno nastroje/motiv_priroda.py:\n'
              '   můstky ≥ %s mm, otvor ≥ %s mm, největší otvor koule Ø%s mm, podíl otvorů %s %%. Generuje se – ručně neupravovat. */\n'
              "(function (root) {\n  'use strict';\n  const M = root.ZabradliMotivy = root.ZabradliMotivy || {};\n"
              "  M[%s] = { id: %s, lab: %s, sub: %s, rada: 'priroda', mode: 'crop', W: %s, H: %s, web: %s, holeMin: %s, ball: %s, open: %s,\n    anim: %s,\n    holes: [\n%s\n    ] };\n"
              "})(typeof globalThis !== 'undefined' ? globalThis : this);\n") % (
            lab, info['W'], H_MM, info['web'], hm, info['ball'], round(opr * 100),
            json.dumps(sid), json.dumps(sid), json.dumps(lab, ensure_ascii=False), json.dumps(sub, ensure_ascii=False),
            info['W'], H_MM, info['web'], hm, info['ball'], info['open'], json.dumps(anim),
            ',\n'.join('      ' + json.dumps(h, separators=(',', ':')) for h in holes))
        open(os.path.join(ROOT, 'assets', 'zabradli', 'motiv-' + sid + '.js'), 'w').write(js)
    json.dump(index, open(os.path.join(ROOT, 'assets', 'zabradli', 'priroda', 'index.json'), 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1])
