"""Build an 800 x 2000 mm garden screen from the local profile library.

Run inside FreeCADCmd. Source dimensions are in mm. The apertures are traced
from the supplied reference photograph and cleaned for 2 mm sheet cutting.
"""
import csv
import json
import math
from pathlib import Path

import FreeCAD as App
import Part
from FreeCAD import Vector

OUT = Path(__file__).resolve().parent
PROFILE_FILE = Path.home() / "CAD-knihovna/prurezy/jekl-jekl-40x40-2.json"

W, H = 800.0, 2000.0
PANEL_W, PANEL_H, SHEET_T = 720.0, 1770.0, 2.0
PANEL_X, PANEL_Y, PANEL_Z = 40.0, 38.0, 190.0
TUBE = 40.0
TUBE_WALL = 2.0
BASE_W, BASE_D, BASE_T = 40.0, 100.0, 6.0
BASE_HOLE_D, BASE_HOLE_SPAN = 14.0, 60.0


def V2(x, z, y=-1.0):
    return Vector(float(x), float(y), float(z))


def wire_from_profile(loop):
    edges = []
    for seg in loop:
        if seg["typ"] == "usecka":
            p1, p2 = seg["p1"], seg["p2"]
            a, b = (p2, p1) if seg.get("obracene") else (p1, p2)
            edges.append(Part.makeLine(Vector(a[0], a[1], 0), Vector(b[0], b[1], 0)))
        else:
            start, end = seg["start"], seg["konec"]
            a, b = (end, start) if seg.get("obracene") else (start, end)
            cx, cy = seg["stred"]
            aa = math.atan2(a[1] - cy, a[0] - cx)
            ab = math.atan2(b[1] - cy, b[0] - cx)
            delta = (ab - aa + math.pi) % (2 * math.pi) - math.pi
            r = float(seg["r"])
            mid = (cx + r * math.cos(aa + delta / 2), cy + r * math.sin(aa + delta / 2))
            edges.append(Part.Arc(Vector(a[0], a[1], 0), Vector(mid[0], mid[1], 0), Vector(b[0], b[1], 0)).toShape())
    w = Part.Wire(edges)
    if not w.isClosed():
        raise RuntimeError("Profile loop from library did not close")
    return w


with PROFILE_FILE.open(encoding="utf-8") as f:
    profile = json.load(f)
assert profile["bbox_mm"] == [40.0, 40.0]
assert abs(profile["plocha_mm2"] - 297.13) < 0.02
outer_wire = wire_from_profile(profile["smycky"][0])
inner_wire = wire_from_profile(profile["smycky"][1])
inner_wire.reverse()
profile_face = Part.Face([outer_wire, inner_wire])
if not profile_face.isValid():
    raise RuntimeError("Library profile face is invalid")


def tube_z(x0, y0, z0, length):
    section = profile_face.copy()
    section.translate(Vector(x0 + 20, y0 + 20, z0))
    return section.extrude(Vector(0, 0, length))


def tube_x(x0, y0, z_center, length):
    section = profile_face.copy()
    section.rotate(Vector(0, 0, 0), Vector(0, 1, 0), 90)
    section.translate(Vector(x0, y0 + 20, z_center))
    return section.extrude(Vector(length, 0, 0))


holes = json.loads((OUT / "artwork.json").read_text(encoding="utf-8"))["contours"]


def cutter_for(h):
    if h["kind"] == "circle":
        return Part.makeCylinder(h["r"], SHEET_T + 2, Vector(PANEL_X + h["x"], PANEL_Y - 1, PANEL_Z + h["z"]), Vector(0, 1, 0))
    points = [V2(PANEL_X + x, PANEL_Z + z, PANEL_Y - 1) for x, z in h["pts"]]
    poly = Part.makePolygon(points + [points[0]])
    face = Part.Face(Part.Wire(poly.Edges))
    return face.extrude(Vector(0, SHEET_T + 2, 0))


left = tube_z(0, 0, BASE_T, H - BASE_T)
right = tube_z(W - TUBE, 0, BASE_T, H - BASE_T)
top = tube_x(TUBE, 0, H - TUBE / 2, W - 2 * TUBE)
bottom = tube_x(TUBE, 0, 170, W - 2 * TUBE)  # lower rail: 150–190 mm above ground
sheet = Part.makeBox(PANEL_W, SHEET_T, PANEL_H, Vector(PANEL_X, PANEL_Y, PANEL_Z))
cutter_shapes = [cutter_for(h) for h in holes]
min_web_mm = float("inf")
closest_features = None
tight_web_pairs = []
for i, a in enumerate(cutter_shapes):
    ab = a.BoundBox
    for j in range(i + 1, len(cutter_shapes)):
        b = cutter_shapes[j]
        bb = b.BoundBox
        gx = max(bb.XMin - ab.XMax, ab.XMin - bb.XMax, 0.0)
        gz = max(bb.ZMin - ab.ZMax, ab.ZMin - bb.ZMax, 0.0)
        if math.hypot(gx, gz) > 15.0:
            continue
        gap = a.distToShape(b)[0]
        if gap < min_web_mm:
            min_web_mm, closest_features = gap, [i, j]
        if gap < 8.0:
            tight_web_pairs.append({"indices": [i, j], "gap_mm": round(gap, 3)})
cutters = Part.makeCompound(cutter_shapes)
sheet = sheet.cut(cutters).removeSplitter()

if not sheet.isValid() or len(sheet.Solids) != 1 or sheet.Volume <= 0:
    raise RuntimeError(f"Laser-cut panel invalid: valid={sheet.isValid()} solids={len(sheet.Solids)} volume={sheet.Volume}")
if sheet.Volume >= PANEL_W * PANEL_H * SHEET_T * 0.90:
    raise RuntimeError("Panel did not lose enough volume; check cutter placement")

plates = []
for x0 in (0.0, W - TUBE):
    plate = Part.makeBox(BASE_W, BASE_D, BASE_T, Vector(x0, -30, 0))
    # Two anchor holes along screen depth; plate stays inside the 800 mm width.
    for dy in (-BASE_HOLE_SPAN / 2, BASE_HOLE_SPAN / 2):
        plate = plate.cut(Part.makeCylinder(BASE_HOLE_D / 2, BASE_T + 2,
                                             Vector(x0 + BASE_W / 2, 20 + dy, -1), Vector(0, 0, 1)))
    plates.append(plate.removeSplitter())

parts = [left, right, top, bottom, sheet] + plates
names = ["Stojka leva jekl 40x40x2", "Stojka prava jekl 40x40x2", "Pricna horni jekl 40x40x2",
         "Pricna dolni jekl 40x40x2", "Vyrezavana vypln ocel 2 mm", "Patka leva 40x100x6", "Patka prava 40x100x6"]
for name, shape in zip(names, parts):
    if not shape.isValid() or shape.Volume <= 0:
        raise RuntimeError(f"Invalid member {name}")

doc = App.newDocument("Zastena_motyli_800x2000")
features = []
for name, shape in zip(names, parts):
    obj = doc.addObject("PartDesign::Feature", name.replace(" ", "_"))
    obj.Label = name
    obj.Shape = shape
    features.append(obj)
doc.recompute()
doc.saveAs(str(OUT / "zastena_motyli_800x2000.FCStd"))
Part.export(features, str(OUT / "zastena_motyli_800x2000.step"))


def dxf_header():
    return ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "9", "$MEASUREMENT", "70", "1",
            "0", "ENDSEC", "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", "1",
            "0", "LAYER", "2", "CUT", "70", "0", "62", "7", "6", "CONTINUOUS", "0", "ENDTAB",
            "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]


def poly_dxf(pts, layer="CUT"):
    e = ["0", "LWPOLYLINE", "8", layer, "90", str(len(pts)), "70", "1"]
    for x, z in pts:
        e += ["10", f"{x:.4f}", "20", f"{z:.4f}"]
    return e


dxf = dxf_header()
dxf += poly_dxf([(0, 0), (PANEL_W, 0), (PANEL_W, PANEL_H), (0, PANEL_H)])
for h in holes:
    if h["kind"] == "circle":
        dxf += ["0", "CIRCLE", "8", "CUT", "10", f"{h['x']:.4f}", "20", f"{h['z']:.4f}", "30", "0", "40", f"{h['r']:.4f}"]
    else:
        dxf += poly_dxf(h["pts"])
dxf += ["0", "ENDSEC", "0", "EOF"]
(OUT / "vypln_720x1770_t2_C2.dxf").write_text("\n".join(dxf) + "\n", encoding="ascii")

base_dxf = dxf_header()
base_dxf += poly_dxf([(0, 0), (BASE_W, 0), (BASE_W, BASE_D), (0, BASE_D)])
for y in (20.0, 80.0):
    base_dxf += ["0", "CIRCLE", "8", "CUT", "10", str(BASE_W / 2), "20", str(y), "30", "0", "40", str(BASE_HOLE_D / 2)]
base_dxf += ["0", "ENDSEC", "0", "EOF"]
(OUT / "patka_40x100_t6_2xD14.dxf").write_text("\n".join(base_dxf) + "\n", encoding="ascii")

with (OUT / "kusovnik.csv").open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["Položka", "Materiál/profil", "Rozměr mm", "Ks", "Poznámka"])
    w.writerow([1, "Jekl 40x40x2", "2000", 2, "Svislé stojky; profil z knihovny"])
    w.writerow([2, "Jekl 40x40x2", "720", 2, "Horní a spodní příčka; pokos / přířez ověřit před výrobou"])
    w.writerow([3, "Ocelový plech 2 mm", "720x1770", 1, f"C2; motiv motýlů a rostlin podle reference; {len(holes)} řezných otvorů"])
    w.writerow([4, "Ocelový plech 6 mm", "40x100", 2, "Úzké patky pod stojkami; 2x otvor Ø14 na patku; limit C2 pro 6 mm není doložen"])

report = {
    "units": "mm",
    "overall_mm": [W, BASE_D, H],
    "front_view_mm": [W, H],
    "sheet_mm": [PANEL_W, SHEET_T, PANEL_H],
    "sheet_material_assumption": "steel (grade not specified)",
    "frame_profile": "jekl-jekl-40x40-2",
    "lower_rail_ground_clearance_mm": 150,
    "base_plates": {"size_mm": [BASE_W, BASE_D, BASE_T], "hole_d_mm": BASE_HOLE_D, "holes_per_plate": 2},
    "cutout_count": len(holes),
    "minimum_web_between_cutouts_mm": round(min_web_mm, 3),
    "closest_cutout_indices": closest_features,
    "cutout_pairs_under_8mm_web": tight_web_pairs,
    "panel_valid": sheet.isValid(),
    "panel_solids": len(sheet.Solids),
    "panel_volume_mm3": round(sheet.Volume, 1),
    "mass_estimate_kg_if_all_steel": round(sum(s.Volume for s in parts) * 7850 / 1_000_000_000, 2),
    "members": [{"name": n, "valid": s.isValid(), "solids": len(s.Solids), "volume_mm3": round(s.Volume, 1)} for n, s in zip(names, parts)],
    "step": "zastena_motyli_800x2000.step",
    "dxf_panel": "vypln_720x1770_t2_C2.dxf",
    "dxf_base_plates": "patka_40x100_t6_2xD14.dxf",
    "assumptions": [
        "Freestanding garden screen inspired by the reference image.",
        "Overall height includes the 150 mm exposed lower leg section.",
        "The C2 process is specified for the 2 mm panel; its 1770 x 720 mm blank fits the documented 3048 x 1524 mm bed when rotated.",
        "C2 maximum thickness is not documented for the 6 mm anchor plates.",
        "Anchor holes and plate sizing are indicative and require verification against the real mounting substrate and wind load.",
        "Decorative cutouts are traced from the supplied photograph, thresholded and simplified; photograph is not a dimensioned source."
    ]
}
(OUT / "kontrola.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

try:
    from PIL import Image, ImageDraw
    scale = 0.5
    im = Image.new("RGB", (560, 1080), (224, 222, 211))
    dr = ImageDraw.Draw(im)
    ox, oy = 80, 30
    fw, fh = round(W * scale), round(H * scale)
    # Ground and two ground plates
    dr.rectangle((ox - 10, oy + fh - 18, ox + fw + 10, oy + fh - 14), fill=(90, 90, 83))
    for xc in (20, W - 20):
        px = ox + xc * scale
        dr.rectangle((px - 25, oy + fh - 6, px + 25, oy + fh), fill=(38, 42, 40))
    # Laser plate visible within frame; apertures reveal the light background.
    x0, x1 = ox + PANEL_X * scale, ox + (PANEL_X + PANEL_W) * scale
    z0, z1 = oy + (H - (PANEL_Z + PANEL_H)) * scale, oy + (H - PANEL_Z) * scale
    dr.rectangle((x0, z0, x1, z1), fill=(25, 29, 27))
    def screen_pt(x, z):
        return ox + (PANEL_X + x) * scale, oy + (H - PANEL_Z - z) * scale
    for h in holes:
        if h["kind"] == "circle":
            x, z = screen_pt(h["x"], h["z"])
            rr = h["r"] * scale
            dr.ellipse((x - rr, z - rr, x + rr, z + rr), fill=(224, 222, 211))
        else:
            dr.polygon([screen_pt(x, z) for x, z in h["pts"]], fill=(224, 222, 211))
    # Re-draw crisp 40 mm frame rails and posts over the sheet edges.
    bw = round(TUBE * scale)
    dr.rectangle((ox, oy, ox + fw, oy + bw), fill=(35, 40, 38))
    dr.rectangle((ox, oy + fh - round(190 * scale), ox + fw, oy + fh - round(150 * scale)), fill=(35, 40, 38))
    dr.rectangle((ox, oy, ox + bw, oy + fh), fill=(35, 40, 38))
    dr.rectangle((ox + fw - bw, oy, ox + fw, oy + fh), fill=(35, 40, 38))
    im.save(OUT / "nahled.png")
except Exception as e:
    (OUT / "nahled_warning.txt").write_text(str(e), encoding="utf-8")

print(json.dumps({"status": "ok", "output": str(OUT), "bounds_mm": [W, BASE_D, H], "cutouts": len(holes), "step_bytes": (OUT / "zastena_motyli_800x2000.step").stat().st_size, "report": str(OUT / "kontrola.json")}, ensure_ascii=False))
