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
H_MM = 900.0                 # výška scény (pole bývá 800–880 mm, ořízne se horní okraj)
WEB = 6.0                    # nejužší můstek oceli (mm) → plech max 6 mm
HOLE_MIN = 6.0               # nejužší otvor (mm)
ISL_KEEP = 300.0             # ostrůvek větší než tolik mm² se připojí, menší zmizí
EPS = 0.3                    # tolerance zjednodušení obrysu (mm)
ROOT = os.path.join(os.path.dirname(__file__), '..')

SCENES = [  # id, popis, rámeček scény v SVG (x0, y0, x1, y1)
    ('jelen',  'Jelen v lese',   'jelen, smrky, břízy', (31, 294, 352, 478)),
    ('medved', 'Medvěd',         'medvěd, srnec, smrky', (364, 294, 660, 478)),
    ('smrky',  'Smrkový les',    'smrky a dravci',       (672, 294, 992, 478)),
]

def disk(r_mm):
    r = max(1, int(round(r_mm / PX)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))

def clean(mat, pad):
    M = mat.astype(np.uint8)
    for _ in range(2):
        H = cv2.morphologyEx(1 - M, cv2.MORPH_OPEN, disk(HOLE_MIN / 2))          # štěrbiny pryč
        M = 1 - H
        thin = M & (1 - cv2.morphologyEx(M, cv2.MORPH_OPEN, disk(WEB / 2)))     # tenká ocel
        M = M | cv2.dilate(thin, disk(WEB / 2))
        M[:pad] = M[-pad:] = 1; M[:, :pad] = M[:, -pad:] = 1
    # ostrůvky
    for _ in range(3):
        n, lab, st, _c = cv2.connectedComponentsWithStats(M, connectivity=8)
        main = lab[0, 0]
        isl = [i for i in range(1, n) if i != main]
        if not isl: break
        mainmask = (lab == main).astype(np.uint8)
        dist, lbl = cv2.distanceTransformWithLabels(1 - mainmask, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        zy, zx = np.where(mainmask == 0)[0:0], None
        ys, xs = np.where(mainmask > 0)
        # mapování label -> souřadnice nejbližšího pixelu oceli
        lut = np.zeros(lbl.max() + 1, np.int64); lut[lbl[ys, xs]] = ys * M.shape[1] + xs
        for i in isl:
            area = st[i, cv2.CC_STAT_AREA] * PX * PX
            if area < ISL_KEEP:
                M[lab == i] = 0; continue
            iy, ix = np.where(lab == i)
            k = np.argmin(dist[iy, ix]); p = (int(ix[k]), int(iy[k]))
            q = int(lut[lbl[iy[k], ix[k]]]); q = (q % M.shape[1], q // M.shape[1])
            cv2.line(M, p, q, 1, max(2, int(round(WEB / PX))))
    return M

def measure(M, pad):
    H = (1 - M).astype(np.uint8)
    dH = cv2.distanceTransform(H, cv2.DIST_L2, 5)
    ball = 2 * dH.max() * PX
    inner = M[pad:-pad, pad:-pad].astype(bool)
    skel, dist = medial_axis(inner, return_distance=True)
    # konce větví (1 soused) vynechat – tam je tloušťka přirozeně menší
    sk = skel.astype(np.uint8)
    nb = cv2.filter2D(sk, -1, np.ones((3, 3), np.float32)) - 1
    body = skel & (nb >= 2)
    w = 2 * dist[body] * PX
    web = float(np.percentile(w, 0.5)) if w.size else 0
    open_ratio = float(H[pad:-pad, pad:-pad].mean())
    yb, xb = np.unravel_index(np.argmax(dH), dH.shape)
    return ball, web, open_ratio, (xb, yb)

def trace(M, pad):
    H = (1 - M).astype(np.uint8)
    cs, hier = cv2.findContours(H, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    hh, ww = M.shape
    out, kids = [], 0
    for c, hrow in zip(cs, hier[0]):
        if hrow[3] != -1: kids += 1; continue
        a = cv2.approxPolyDP(c, EPS / PX, True)[:, 0, :]
        if len(a) < 3 or cv2.contourArea(a) * PX * PX < 10: continue
        pts = [((x - pad + 0.5) * PX, (hh - pad - y - 0.5) * PX) for x, y in a]
        flat = []
        for x, y in pts: flat += [round(x, 2), round(y, 2), 0]
        out.append(flat)
    return out, kids

def main(svg_path):
    svg = open(svg_path).read()
    index = []
    for sid, lab, sub, box in SCENES:
        sc = (H_MM / PX) / (box[3] - box[1])
        mat = rasterize(svg, box, sc)
        pad = int(round(10 / PX))
        mat = np.pad(mat, pad, constant_values=True)
        M = clean(mat, pad)
        ball, web, opr, bpos = measure(M, pad)
        holes, kids = trace(M, pad)
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
              "  M[%s] = { id: %s, lab: %s, sub: %s, rada: 'priroda', mode: 'crop', W: %s, H: %s, web: %s, holeMin: %s, ball: %s, open: %s,\n    holes: [\n%s\n    ] };\n"
              "})(typeof globalThis !== 'undefined' ? globalThis : this);\n") % (
            lab, info['W'], H_MM, info['web'], HOLE_MIN, info['ball'], round(opr * 100),
            json.dumps(sid), json.dumps(sid), json.dumps(lab, ensure_ascii=False), json.dumps(sub, ensure_ascii=False),
            info['W'], H_MM, info['web'], HOLE_MIN, info['ball'], info['open'],
            ',\n'.join('      ' + json.dumps(h, separators=(',', ':')) for h in holes))
        open(os.path.join(ROOT, 'assets', 'zabradli', 'motiv-' + sid + '.js'), 'w').write(js)
    json.dump(index, open(os.path.join(ROOT, 'assets', 'zabradli', 'priroda', 'index.json'), 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1])
