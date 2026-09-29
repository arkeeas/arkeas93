"""Vytvoří js/vendor/pdf-font.js – podmnožina písma Liberation Sans (SIL OFL)
pro PDF kusovník s českou diakritikou. Spuštění: python3 tools/make_font_data.py"""
import base64, io, json, sys
from fontTools import subset
from fontTools.ttLib import TTFont

EXTRA = "ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž×°–—„“”‚‘’Øø·…²³€±≤≥"
CHARS = "".join(chr(c) for c in range(32, 127)) + EXTRA
SRC = {"regular": "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
       "bold": "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"}

out = {"chars": CHARS, "fonts": {}}
for key, path in SRC.items():
    opts = subset.Options(); opts.glyph_names = True; opts.name_IDs = ["*"]; opts.notdef_outline = True
    opts.layout_features = []; opts.hinting = False
    f = TTFont(path); sub = subset.Subsetter(opts); sub.populate(text=CHARS); sub.subset(f)
    buf = io.BytesIO(); f.save(buf); data = buf.getvalue()
    f = TTFont(io.BytesIO(data))
    cmap = f.getBestCmap(); upm = f["head"].unitsPerEm; hmtx = f["hmtx"]
    names, widths = [], []
    for ch in CHARS:
        g = cmap[ord(ch)]; names.append(g); widths.append(round(hmtx[g][0] * 1000 / upm))
    h = f["head"]; os2 = f["OS/2"]
    out["fonts"][key] = {
        "b64": base64.b64encode(data).decode(), "names": names, "widths": widths,
        "bbox": [round(v * 1000 / upm) for v in (h.xMin, h.yMin, h.xMax, h.yMax)],
        "ascent": round(os2.sTypoAscender * 1000 / upm), "descent": round(os2.sTypoDescender * 1000 / upm),
        "capHeight": round(getattr(os2, "sCapHeight", 700) * 1000 / upm),
        "psName": f["name"].getDebugName(6) or "LiberationSans"}
    print(key, len(data), "B", file=sys.stderr)

js = "/* Liberation Sans (c) Red Hat, SIL Open Font License 1.1 – podmnožina pro PDF. Generováno tools/make_font_data.py */\n"
js += "(function(root){root.PDF_FONT=" + json.dumps(out, ensure_ascii=False) + ";})(typeof window!=='undefined'?window:globalThis);\n"
open("js/vendor/pdf-font.js", "w", encoding="utf-8").write(js)
