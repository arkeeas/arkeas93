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
const cornerStep = validate(G.stepFile("geometricke_rohy", corner.lay.members.map((m) => m.solid)), "geometricke_rohy");
if (cornerStep.errs.length) throw new Error(cornerStep.errs.slice(0, 3).join("; "));
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const capGap = (a, b) => Math.max(
  ...a.map((p) => Math.min(...b.map((q) => distance(p, q)))),
  ...b.map((p) => Math.min(...a.map((q) => distance(p, q))))
);
const miterFrames = A.lay.members.filter((m) => m.role === "motif" && /vnější rám|vnitřní rám/.test(m.name));
if (miterFrames.filter((m) => Math.abs(m.cut0.n[0]) > 0.1 && Math.abs(m.cut1.n[0]) > 0.1).length < 4) throw new Error("rectangular frame corners are not mitered");
const angleFromAxis = (m, cut) => Math.acos(Math.min(1, Math.abs(cut.reduce((sum, x, i) => sum + x * m.d[i], 0)) / Math.hypot(...cut))) * 180 / Math.PI;
const capVerts = (m, cut) => {
  const plane = cut === "end" ? m.cut1 : m.cut0, n = plane.n, p = plane.p;
  return m.solid.faces.filter((f) => f.outer.every((i) => Math.abs(n.reduce((s, x, k) => s + x * (m.solid.verts[i][k] - p[k]), 0)) < 1e-5))
    .flatMap((f) => f.outer.map((i) => m.solid.verts[i]));
};
function checkFrameCorners(members) {
  const frames = members.filter((m) => m.role === "motif" && /vnější rám|vnitřní rám/.test(m.name));
  if (frames.some((m) => m.kind !== "tube" || m.h1 !== 10 || m.h2 !== 10 || m.t !== 2 || !m.prof.includes("20×20×2"))) throw new Error("motif frames are not made from 20×20×2 hollow square tube");
  if (frames.some((m) => Math.abs(angleFromAxis(m, m.cut0.n) - 45) > 0.2 || Math.abs(angleFromAxis(m, m.cut1.n) - 45) > 0.2)) throw new Error("motif frame cuts are not 45 degrees");
  const groups = new Map();
  for (const m of frames) {
    const label = m.name.replace(/ (svislý díl|horní spojka|dolní spojka)$/, "");
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(m);
  }
  for (const [label, group] of groups) {
    const left = group.find((m) => /svislý díl/.test(m.name) && m.cut0.p[0] <= m.cut1.p[0]);
    const right = group.find((m) => /svislý díl/.test(m.name) && m !== left);
    const bottom = group.find((m) => /dolní spojka/.test(m.name));
    const top = group.find((m) => /horní spojka/.test(m.name));
    if (!left || !right || !bottom || !top || group.length !== 4) throw new Error("incomplete frame: " + label);
    const pairs = [[left,"start",bottom,"start"],[right,"start",bottom,"end"],[left,"end",top,"start"],[right,"end",top,"end"]];
    for (const [a, ac, b, bc] of pairs) if (capGap(capVerts(a, ac), capVerts(b, bc)) > 0.01) throw new Error("45-degree frame corner does not fit: " + label);
  }
}
checkFrameCorners(A.lay.members);
checkFrameCorners(corner.lay.members);
const transition = Z.analyze({ vypln: "geometricky", vyska: 1000, segs: [{ L: 1200, rise: 600 }, { L: 1200, rise: 0 }] });
checkFrameCorners(transition.lay.members);
const rails = transition.lay.members.filter((m) => m.role === "rail");
const joints = transition.lay.members.filter((m) => m.role === "corner" && m.kind === "tube" && m.connectorPair);
const capPoints = (m, cut) => {
  const plane = cut === "end" ? m.cut1 : m.cut0, n = plane.n, p = plane.p, v = m.solid.verts;
  return m.solid.faces.filter((f) => f.outer.every((i) => Math.abs(n.reduce((s, x, k) => s + x * (v[i][k] - p[k]), 0)) < 1e-5)).flatMap((f) => f.outer.map((i) => v[i]));
};
if (joints.length !== 1 || capGap(capPoints(rails[0], "end"), capPoints(joints[0], "start")) > 0.01 || capGap(capPoints(joints[0], "end"), capPoints(rails[1], "start")) > 0.01) throw new Error("sloped and level handrails do not meet through a fitted corner connector");
const standard = Z.analyze({ vypln: "standard", sloupky: true, anchor: "bocni", segs: [{ L: 1800, rise: 0 }] });
if (standard.cfg.vypln !== "standard" || standard.cfg.anchor !== "bocni" || !standard.lay.members.some((m) => m.role === "bar")) throw new Error("standard type A settings changed");
if (!(A.price > 0)) throw new Error("price not calculated");
console.log("OK geometrical railing: slope, flat, height, pitch, insert slots, base plates, price");
