"""Re-import the deliverable STEP and write a compact geometry report."""
import json
import sys
from pathlib import Path

import Part

step_path = Path(sys.argv[-1]).resolve()
shape = Part.read(str(step_path))
bb = shape.BoundBox
solids = list(shape.Solids)
report = {
    "step": str(step_path),
    "valid": bool(shape.isValid()),
    "solid_count": len(solids),
    "all_solids_valid": all(s.isValid() and s.Volume > 0 for s in solids),
    "bbox_mm": [round(bb.XLength, 3), round(bb.YLength, 3), round(bb.ZLength, 3)],
    "volume_mm3": round(shape.Volume, 1),
    "size_bytes": step_path.stat().st_size,
}
out_path = step_path.with_name("kontrola_step.json")
out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
if not report["valid"] or not report["all_solids_valid"] or report["solid_count"] != 7:
    raise RuntimeError("STEP re-import validation failed")
if any(abs(a - b) > 0.1 for a, b in zip(report["bbox_mm"], [800.0, 100.0, 2000.0])):
    raise RuntimeError("STEP bounding box differs from design")
