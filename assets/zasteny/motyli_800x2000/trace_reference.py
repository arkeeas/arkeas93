"""Trace the visible apertures of the supplied panel photograph to laser contours.

Run with system Python before build_panel.py. The photograph is design input, not
a dimensioned manufacturing drawing; this script keeps geometry and decisions
reproducible.
"""
import json
from pathlib import Path

import contourpy
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "reference.png"
ROI = (329, 265, 840, 1305)
PANEL_W, PANEL_H = 720.0, 1770.0
THRESHOLD = 55
EDGE_MASK_PX = 9
ERODE_PX = 1
MIN_PIXELS = 20


def rdp(points, tol):
    if len(points) <= 2:
        return points
    a, b = points[0], points[-1]
    v = b - a
    den = np.hypot(*v)
    if den < 1e-9:
        d = np.hypot(*(points[1:-1] - a).T)
    else:
        q = points[1:-1] - a
        d = np.abs(v[0] * q[:, 1] - v[1] * q[:, 0]) / den
    k = int(np.argmax(d)) + 1
    if d[k - 1] <= tol:
        return np.vstack((a, b))
    return np.vstack((rdp(points[: k + 1], tol)[:-1], rdp(points[k:], tol)))


def simplify_ring(ring, tol=0.95):
    if np.allclose(ring[0], ring[-1]):
        ring = ring[:-1]
    # Split a closed path across its two most distant points so that both
    # halves retain their outline when the RDP simplifier closes it.
    ia = int(np.argmin(ring[:, 0]))
    ib = int(np.argmax(ring[:, 0]))
    if ia > ib:
        ia, ib = ib, ia
    first = rdp(ring[ia: ib + 1], tol)
    second = rdp(np.vstack((ring[ib:], ring[: ia + 1])), tol)
    result = np.vstack((first[:-1], second[:-1]))
    return result


im = np.asarray(Image.open(SOURCE).convert("RGB"), dtype=np.uint8)
x0, y0, x1, y1 = ROI
rgb = im[y0:y1, x0:x1].astype(float)
lum = rgb.max(axis=2)
green = rgb[:, :, 1]
mask = (lum > THRESHOLD) & (green > THRESHOLD * 0.70)
mask[:EDGE_MASK_PX] = False
mask[-EDGE_MASK_PX:] = False
mask[:, :EDGE_MASK_PX] = False
mask[:, -EDGE_MASK_PX:] = False
# Any isolated dark pixel island inside an aperture would fall out of the
# sheet. Fill those islands, then expand the steel by about 1 source pixel.
mask = ndi.binary_fill_holes(mask)
mask = ndi.binary_erosion(mask, iterations=ERODE_PX)
labels, count = ndi.label(mask)
sizes = np.bincount(labels.ravel())
mask &= sizes[labels] >= MIN_PIXELS
smooth = ndi.gaussian_filter(mask.astype(float), sigma=0.70)
contours = contourpy.contour_generator(z=smooth).lines(0.5)

holes = []
pixel_vertices = 0
for c in contours:
    ring = simplify_ring(c)
    if len(ring) < 3:
        continue
    # The source photograph is taller relative to its width. The given
    # 800 x 2000 mm overall size is authoritative, so map the motif into the
    # 720 x 1770 mm clear aperture within the 40 mm frame.
    pts = np.column_stack((
        ring[:, 0] * PANEL_W / (x1 - x0 - 1),
        (y1 - y0 - 1 - ring[:, 1]) * PANEL_H / (y1 - y0 - 1),
    ))
    area = abs(np.dot(pts[:, 0], np.roll(pts[:, 1], 1)) -
               np.dot(pts[:, 1], np.roll(pts[:, 0], 1))) / 2
    if area < 28:
        continue
    pts = [[round(float(x), 2), round(float(z), 2)] for x, z in pts]
    holes.append({"kind": "poly", "pts": pts})
    pixel_vertices += len(pts)

holes.sort(key=lambda h: -sum(p[1] for p in h["pts"]) / len(h["pts"]))
# Two neighboring apertures in the upper wing retain too little steel after
# photo tracing. A submillimetre local inset on each side clears an 8 mm web.
for index, factor in ((19, 0.975), (21, 0.965)):
    pts = np.asarray(holes[index]["pts"], dtype=float)
    center = pts.mean(axis=0)
    holes[index]["pts"] = np.round(center + (pts - center) * factor, 2).tolist()
(HERE / "artwork.json").write_text(json.dumps({
    "source": SOURCE.name,
    "source_roi_pixels": ROI,
    "sheet_mm": [PANEL_W, PANEL_H],
    "threshold": THRESHOLD,
    "erosion_source_pixels": ERODE_PX,
    "contours": holes,
}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

preview = Image.new("RGB", (511, 1040), (22, 27, 25))
dr = ImageDraw.Draw(preview)
for h in holes:
    pts = [(x * (x1 - x0 - 1) / PANEL_W,
            (PANEL_H - z) * (y1 - y0 - 1) / PANEL_H)
           for x, z in h["pts"]]
    dr.polygon(pts, fill=(222, 211, 183))
preview.save(HERE / "motiv_vyrez.png")
print(json.dumps({"contours": len(holes), "vertices": pixel_vertices,
                  "cut_fraction": round(float(mask.mean()), 3)}))
