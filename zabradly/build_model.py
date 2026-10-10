"""FreeCAD generator for the geometric-motif stair railing.

Run in FreeCAD Python console or FreeCADCmd:
  exec(open('/path/to/build_model.py', encoding='utf-8').read())
  build_model(params, output_dir)
The dictionary keys and defaults are documented in konfigurace.json.
"""
import csv
import json
import math
import os

import FreeCAD as App
import Part
from FreeCAD import Vector


DEFAULTS = {
    "run_length": 1600.0,
    "slope_deg": 30.0,
    "handrail_height": 1000.0,
    "motif_pitch": 250.0,
    "motif_width": 130.0,
    "outer_height": 640.0,
    "inner_width": 60.0,
    "inner_height": 500.0,
    "bar_width": 12.0,
    "bar_depth": 6.0,
    "handrail_size": 40.0,
    "handrail_wall": 2.0,
    "anchor_plate_width": 60.0,
    "anchor_plate_length": 80.0,
    "anchor_plate_thickness": 6.0,
    "anchor_hole_diameter": 11.0,
    "anchor_hole_spacing": 50.0,
}


def _box(x, y, z, dx, dy, dz):
    return Part.makeBox(float(dx), float(dy), float(dz), Vector(float(x), float(y), float(z)))


def _rect_loop(cx, bottom, width, height, bar, depth):
    """Closed rectangular loop, fused into one solid, centered in Y."""
    left, right = cx - width / 2.0, cx + width / 2.0
    top = bottom + height
    pieces = [
        _box(left, -depth / 2, bottom, bar, depth, height),
        _box(right - bar, -depth / 2, bottom, bar, depth, height),
        _box(left, -depth / 2, bottom, width, depth, bar),
        _box(left, -depth / 2, top - bar, width, depth, bar),
    ]
    result = pieces[0]
    for piece in pieces[1:]:
        result = result.fuse(piece)
    return result.removeSplitter()


def _sloped_top_post(cx, bottom, width, depth, top_left, top_right):
    """Vertical support with a mitred top matching the underside of the rail."""
    x0, x1 = cx - width / 2.0, cx + width / 2.0
    pts = [Vector(x0, -depth / 2, bottom), Vector(x1, -depth / 2, bottom),
           Vector(x1, -depth / 2, top_right), Vector(x0, -depth / 2, top_left)]
    wire = Part.makePolygon(pts + [pts[0]])
    face = Part.Face(Part.Wire(wire.Edges))
    return face.extrude(Vector(0, depth, 0))


def _new_feature(doc, group, name, shape):
    if not shape.isValid() or shape.Volume <= 0:
        raise RuntimeError("Neplatné těleso: " + name)
    obj = doc.addObject("PartDesign::Feature", name)
    obj.Label = name.replace("_", " ")
    obj.Shape = shape
    obj.ViewObject.ShapeColor = (0.66, 0.67, 0.70)
    obj.ViewObject.LineColor = (0.12, 0.12, 0.13)
    obj.ViewObject.DisplayMode = "Flat Lines"
    group.addObject(obj)
    return obj


def build_model(params=None, output_dir=None):
    """Rebuild and export a configurable single-run railing assembly."""
    p = dict(DEFAULTS)
    if params:
        p.update(params)
    L = float(p["run_length"])
    angle = float(p["slope_deg"])
    height = float(p["handrail_height"])
    pitch = float(p["motif_pitch"])
    if L <= 0 or pitch <= 0 or not (0 <= abs(angle) <= 45):
        raise ValueError("Délka a rozteč musí být kladné; sklon musí být v rozsahu ±45°.")
    if height < p["outer_height"] + 100:
        raise ValueError("Výška madla musí přesahovat vnější rám alespoň o 100 mm.")
    if App.ActiveDocument and App.ActiveDocument.Name == "GeometricMotifRail":
        App.closeDocument("GeometricMotifRail")
    doc = App.newDocument("GeometricMotifRail")
    grp = doc.addObject("App::DocumentObjectGroup", "RailAssembly")
    grp.Label = "Zábradlí – geometrický motiv"

    # Position the motifs first so their insertion slots can be cut into the
    # lower wall of the handrail before it is rotated onto the requested slope.
    s = float(p["handrail_size"])
    wall = float(p["handrail_wall"])
    theta = math.radians(angle)
    outer_width = float(p["motif_width"])
    usable_center_length = max(0.0, L - outer_width / math.cos(theta))
    count = max(1, int(math.floor(usable_center_length / pitch)) + 1)
    horizontal_run = L * math.cos(theta)
    # The bottom face of the inclined square tube is offset horizontally from
    # its centerline by half the tube size; align each upright to that face.
    contact_offset = s / 2.0 * math.sin(theta)
    if count == 1:
        centers = [contact_offset + horizontal_run / 2.0]
    else:
        end_margin = (L - (count - 1) * pitch) / 2.0
        centers = [contact_offset + (end_margin + i * pitch) * math.cos(theta)
                   for i in range(count)]
    bar = float(p["bar_width"])
    depth = float(p["bar_depth"])
    clearance = 0.5
    rail = _box(0, -s / 2, -s / 2, L, s, s).cut(
        _box(-1, -s / 2 + wall, -s / 2 + wall, L + 2, s - 2 * wall, s - 2 * wall)
    )
    for x in centers:
        # Skewed slot follows a vertical insert through the sloped lower wall.
        # Its opening at each wall face is exactly the insert footprint + 0.5 mm.
        local_x = (x - contact_offset) / math.cos(theta) + wall * math.tan(theta) / 2.0
        slot_w = (bar + clearance) / math.cos(theta)
        y0, yspan = -(depth + clearance) / 2.0, depth + clearance
        z0, z1 = -s / 2.0 - 1.0, -s / 2.0 + wall + 1.0
        def slot_center_at(z):
            return local_x + (z + s / 2.0 - wall / 2.0) * math.tan(theta)
        c0, c1 = slot_center_at(z0), slot_center_at(z1)
        wire = Part.makePolygon([
            Vector(c0 - slot_w / 2, y0, z0), Vector(c0 + slot_w / 2, y0, z0),
            Vector(c1 + slot_w / 2, y0, z1), Vector(c1 - slot_w / 2, y0, z1),
            Vector(c0 - slot_w / 2, y0, z0)])
        slot = Part.Face(Part.Wire(wire.Edges)).extrude(Vector(0, yspan, 0))
        rail = rail.cut(slot)
    rail.rotate(Vector(0, 0, 0), Vector(0, 1, 0), -angle)
    rise = L * math.sin(theta)
    rail.translate(Vector(0, 0, height - s / (2.0 * math.cos(theta))))
    _new_feature(doc, grp, "Madlo_jekl_40x40x2", rail)

    for i, x in enumerate(centers, 1):
        base_z = x * math.tan(math.radians(angle))
        outer_bottom = base_z + 90.0
        outer_height = float(p["outer_height"])
        inner_width = float(p["inner_width"])
        inner_height = float(p["inner_height"])
        outer = _rect_loop(x, outer_bottom, outer_width, outer_height, bar, depth)
        inner_bottom = outer_bottom + (outer_height - inner_height) / 2.0
        inner = _rect_loop(x, inner_bottom, inner_width, inner_height, bar, depth)

        # Lower support meets the tread datum; upper support connects the motif
        # to the handrail. All parts touch the frame and remain one solid/module.
        foot = _box(x - bar / 2, -depth / 2, base_z, bar, depth, 90.0 + bar)
        plate_w = float(p["anchor_plate_width"])
        plate_l = float(p["anchor_plate_length"])
        plate_t = float(p["anchor_plate_thickness"])
        hole_r = float(p["anchor_hole_diameter"]) / 2.0
        hole_spacing = float(p["anchor_hole_spacing"])
        plate = _box(x - plate_w / 2, -plate_l / 2, base_z - plate_t, plate_w, plate_l, plate_t)
        for y in (-hole_spacing / 2.0, hole_spacing / 2.0):
            cutter = Part.makeCylinder(hole_r, plate_t + 2.0,
                                       Vector(x, y, base_z - plate_t - 1.0), Vector(0, 0, 1))
            plate = plate.cut(cutter)
        if not plate.isValid() or plate.Volume <= 0:
            raise RuntimeError("Neplatná kotevní patka u motivu %d" % i)
        inner_link = _box(x - bar / 2, -depth / 2, outer_bottom + bar,
                          bar, depth, inner_bottom - outer_bottom - bar)
        motif_top = outer_bottom + outer_height
        theta = math.radians(angle)
        rail_bottom = lambda xx: height + (xx - contact_offset) * math.tan(theta) - s / 2.0 * (math.cos(theta) + 1.0 / math.cos(theta))
        tie = _sloped_top_post(x, motif_top - bar, bar, depth,
                               rail_bottom(x - bar / 2) + 10.0, rail_bottom(x + bar / 2) + 10.0)
        module = outer.fuse(inner).fuse(foot).fuse(inner_link).fuse(tie).removeSplitter()
        _new_feature(doc, grp, "Motiv_%02d" % i, module)
        _new_feature(doc, grp, "Patka_%02d" % i, plate)

    doc.recompute()
    for obj in grp.Group:
        if not obj.Shape.isValid() or obj.Shape.Volume <= 0:
            raise RuntimeError("Kontrola tělesa selhala: " + obj.Label)

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        fcstd = os.path.join(output_dir, "zabradli_geometricky_motiv.FCStd")
        step = os.path.join(output_dir, "zabradli_geometricky_motiv.step")
        csv_path = os.path.join(output_dir, "kusovnik.csv")
        doc.recompute()
        doc.saveAs(fcstd)
        import Import
        Import.export(list(grp.Group), step)
        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow(["Pozice", "Díl", "Počet", "Délka ramene mm", "Sklon °", "Výška madla mm"])
            writer.writerow([1, "Madlo jekl 40×40×2", 1, round(L, 1), round(angle, 2), round(height, 1)])
            writer.writerow([2, "Modul geometrického motivu", count, round(L, 1), round(angle, 2), round(height, 1)])
            writer.writerow([3, "Kotvicí plech 60×80×6, 2×Ø11", count, round(L, 1), round(angle, 2), round(height, 1)])
        with open(os.path.join(output_dir, "model_info.json"), "w", encoding="utf-8") as f:
            json.dump({"parameters": p, "motif_count": count, "rise_mm": rise,
                       "anchor_plates": {"count": count, "width_mm": p["anchor_plate_width"],
                         "length_mm": p["anchor_plate_length"], "thickness_mm": p["anchor_plate_thickness"],
                         "holes": 2, "hole_diameter_mm": p["anchor_hole_diameter"],
                         "hole_spacing_mm": p["anchor_hole_spacing"]},
                       "valid_solids": len(grp.Group), "step_file": os.path.basename(step)},
                      f, ensure_ascii=False, indent=2)
    return doc, grp


if __name__ == "__main__":
    build_model(DEFAULTS, os.path.dirname(os.path.abspath(__file__)))
