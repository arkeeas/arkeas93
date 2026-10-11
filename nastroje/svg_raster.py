"""Rasterizace SVG z AI generátoru (jen příkazy M L C Z, absolutní) do binární masky materiálu.
Šedé fragmenty z vyhlazování hran se rozhodnou prahem jasu (tmavé = materiál)."""
import re
import numpy as np
import cv2

def _paths(svg):
    s = re.sub(r'<metadata>.*?</metadata>', '', svg, flags=re.S)
    for attrs in re.findall(r'<path([^>]*)/>', s):
        m = re.search(r'fill="([^"]+)"', attrs)
        fill = m.group(1) if m else '#000000'
        if fill == 'white': fill = '#ffffff'
        if fill == 'black': fill = '#000000'
        h = fill.lstrip('#')
        lum = 0.299 * int(h[0:2], 16) + 0.587 * int(h[2:4], 16) + 0.114 * int(h[4:6], 16)
        yield lum < 128, re.search(r'd="([^"]+)"', attrs).group(1)

def _subpaths(d, steps=10):
    toks = re.findall(r'[MLCZ]|-?\d+\.?\d*(?:e-?\d+)?', d)
    polys, cur, i, cmd, p = [], [], 0, None, (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in 'MLCZ':
            cmd = t; i += 1
            if t == 'Z' and cur: polys.append(cur); cur = []
            continue
        if cmd == 'M':
            if cur: polys.append(cur)
            p = (float(toks[i]), float(toks[i + 1])); cur = [p]; i += 2; cmd = 'L'
        elif cmd == 'L':
            p = (float(toks[i]), float(toks[i + 1])); cur.append(p); i += 2
        elif cmd == 'C':
            a = [float(x) for x in toks[i:i + 6]]; i += 6
            x0, y0 = p
            for k in range(1, steps + 1):
                u = k / steps; v = 1 - u
                cur.append((v**3*x0 + 3*v*v*u*a[0] + 3*v*u*u*a[2] + u**3*a[4], v**3*y0 + 3*v*v*u*a[1] + 3*v*u*u*a[3] + u**3*a[5]))
            p = (a[4], a[5])
        else:
            i += 1
    if cur: polys.append(cur)
    return polys

def rasterize(svg_text, box, scale):
    """box = (x0, y0, x1, y1) v souřadnicích SVG, scale = px rastru na 1 px SVG. Vrací masku materiálu (True = ocel)."""
    x0, y0, x1, y1 = box
    W, H = int(round((x1 - x0) * scale)), int(round((y1 - y0) * scale))
    img = np.zeros((H, W), np.uint8)           # 0 = bílá (otvor), 255 = materiál
    SH = 4                                     # cv2 subpixel shift
    for dark, d in _paths(svg_text):
        polys = [np.array([[(x - x0) * scale * (1 << SH), (y - y0) * scale * (1 << SH)] for x, y in pl], np.int64).astype(np.int32)
                 for pl in _subpaths(d) if len(pl) > 2]
        if not polys: continue
        # sudo-liché pravidlo v rámci jedné cesty
        xs = np.concatenate([q[:, 0] for q in polys]) >> SH; ys = np.concatenate([q[:, 1] for q in polys]) >> SH
        bx0, by0 = max(0, xs.min() - 1), max(0, ys.min() - 1); bx1, by1 = min(W, xs.max() + 2), min(H, ys.max() + 2)
        if bx1 <= bx0 or by1 <= by0: continue
        m = np.zeros((by1 - by0, bx1 - bx0), np.uint8)
        for q in polys:
            t = np.zeros_like(m)
            cv2.fillPoly(t, [q - np.array([bx0 << SH, by0 << SH], np.int32)], 1, lineType=cv2.LINE_8, shift=SH)
            m ^= t
        reg = img[by0:by1, bx0:bx1]
        reg[m > 0] = 255 if dark else 0
    return img > 127
