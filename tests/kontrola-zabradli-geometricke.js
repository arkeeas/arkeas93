"use strict";
require("../core.js"); require("../gen.js"); require("../zabradli-core.js");
const Z = globalThis.Zabradli, G = globalThis.Generator, { validate } = require("./validate-step.js");
const A = Z.analyze({ vypln: "geometricky", sloupky: true, vyska: 1100, motifPitch: 300,
  segs: [{ L: 1800, rise: 900 }] });
const members = A.lay.members;
const motifs = A.lay.motifCenters;
const plates = members.filter((m) => m.role === "patka" && m.kind === "plate");
const slots = members.filter((m) => m.role === "rail").flatMap((m) => m.holes || []).filter((h) => h.kind === "insert");
if (A.cfg.vypln !== "geometricky") throw new Error("vypln was not normalized");
if (A.cfg.anchor !== "patka") throw new Error("geometric motif must use plate anchors");
if (!motifs.length || plates.length !== motifs.length || slots.length !== motifs.length) throw new Error("frame, plate, and slot counts differ");
if (plates.some((m) => m.w !== 60 || m.l !== 80 || m.t !== 6 || m.holes.length !== 2 || m.holes.some((h) => h[2] !== 5.5))) throw new Error("plate dimensions/holes incorrect");
for (const m of members) {
  if (!m.solid || Z.volume(m.solid) <= 0 || !G.checkClosed(m.solid.verts, m.solid.faces)) throw new Error("invalid member: " + m.name);
}
const step = validate(G.stepFile("geometricke_zabradli", members.map((m) => m.solid)), "geometricke_zabradli");
if (step.errs.length) throw new Error(step.errs.slice(0, 3).join("; "));
const flat = Z.analyze({ vypln: "geometricky", segs: [{ L: 1800, rise: 0 }] });
if (!flat.lay.members.some((m) => m.role === "rail" && Math.abs(m.d[2]) < 1e-8)) throw new Error("flat handrail is not horizontal");
const down = Z.analyze({ vypln: "geometricky", vyska: 1000, segs: [{ L: 1400, rise: -500 }] });
if (!down.lay.members.some((m) => m.role === "rail" && m.d[2] < 0)) throw new Error("downward slope was not preserved");
const corner = Z.analyze({ vypln: "geometricky", segs: [{ L: 1200, rise: 0, turn: 90 }, { L: 1200, rise: -300 }] });
for (const m of corner.lay.members) if (!m.solid || Z.volume(m.solid) <= 0 || !G.checkClosed(m.solid.verts, m.solid.faces)) throw new Error("invalid multi-segment part: " + m.name);
const standard = Z.analyze({ vypln: "standard", sloupky: true, anchor: "bocni", segs: [{ L: 1800, rise: 0 }] });
if (standard.cfg.vypln !== "standard" || standard.cfg.anchor !== "bocni" || !standard.lay.members.some((m) => m.role === "bar")) throw new Error("standard type A settings changed");
if (!(A.price > 0)) throw new Error("price not calculated");
console.log("OK geometrical railing: slope, flat, height, pitch, insert slots, base plates, price");
