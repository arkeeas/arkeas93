/*
 * geometry.js – parametrický model podnože „4 nohy + rám“.
 *
 * Souřadnice: X = délka stolu, Y = šířka, Z = výška (podlaha z = 0), mm.
 * Vstup: parametry z formuláře. Výstup: seznam pozic (dílů) s tělesy,
 * umístěními, kusovníkem, varováními a chybami.
 */
(function (root) {
  "use strict";
  const B = root.BREP;
  const { Xf } = B;

  const round1 = (x) => Math.round(x * 10) / 10;

  function profil(list, id) {
    const p = list.find((q) => q.id === id);
    if (!p) return null;
    return Object.assign({ ro: 2 * p.t, ri: p.t }, p);
  }

  // Umístění jeklu: lokální Z = osa jeklu, lokální Y = „nahoru“ profilu
  const ALONG_X = (T) => Xf.make([0, 1, 0], [0, 0, 1], [1, 0, 0], T);
  const ALONG_Y = (T) => Xf.make([-1, 0, 0], [0, 0, 1], [0, 1, 0], T);
  const ALONG_Z = (T) => Xf.make([1, 0, 0], [0, 1, 0], [0, 0, 1], T);
  // Výrobní orientace pro K2: jekl podél osy X, začíná v 0
  const PRODUKCE = ALONG_X([0, 0, 0]);

  /* Otvory pro přišroubování desky v horní a spodní stěně jeklu */
  function holesForScrews(p, len, cfg, warnings, label) {
    const tp = B.tubeProfile(p.b, p.h, p.t, p.ro, p.ri);
    const flat = tp.flat.x; // šířka rovné části horní/spodní stěny
    let dTop = cfg.horni, dBot = cfg.spodni;
    const maxD = flat - 2;
    if (maxD < dTop) {
      warnings.push(label + ": profil je příliš úzký na otvory pro šrouby – otvory vynechány.");
      return [];
    }
    if (dBot > maxD) {
      warnings.push(label + ": spodní otvor zmenšen z Ø" + dBot + " na Ø" + round1(maxD) + " (úzká stěna profilu).");
      dBot = Math.floor(maxD * 2) / 2;
    }
    let zs = [];
    const e = cfg.odKraje;
    if (len < 2 * e + 50) zs = [len / 2];
    else {
      const n = Math.max(2, Math.ceil((len - 2 * e) / cfg.maxRozteč) + 1);
      for (let i = 0; i < n; i++) zs.push(e + (i * (len - 2 * e)) / (n - 1));
    }
    const holes = [];
    for (const z of zs) {
      holes.push({ center: [0, p.h / 2, z], normal: [0, 1, 0], t: p.t, r: dTop / 2,
        outerFace: [0, tp.walls.outer.top], innerFace: [1, tp.walls.inner.top], d: dTop, wall: "horní" });
      holes.push({ center: [0, -p.h / 2, z], normal: [0, -1, 0], t: p.t, r: dBot / 2,
        outerFace: [0, tp.walls.outer.bottom], innerFace: [1, tp.walls.inner.bottom], d: dBot, wall: "spodní" });
    }
    return holes;
  }

  function tubeSolid(p, len, holes) {
    const tp = B.tubeProfile(p.b, p.h, p.t, p.ro, p.ri);
    return { loops: tp.loops, length: len, wallHoles: holes || [] };
  }

  function build(par, K) {
    K = K || root.KATALOG;
    const errors = [], warnings = [];
    const pn = profil(K.profilyNohy, par.profilNohy);
    const pr = profil(K.profilyRamu, par.profilRamu);
    if (!pn) errors.push("Neznámý profil nohy.");
    if (!pr) errors.push("Neznámý profil rámu.");
    if (errors.length) return { errors, warnings, parts: [] };

    const chk = (v, [a, b], name) => { if (!(v >= a && v <= b)) errors.push(name + " musí být v rozsahu " + a + "–" + b + " mm."); };
    chk(par.deskaDelka, K.limity.deskaDelka, "Délka desky");
    chk(par.deskaSirka, K.limity.deskaSirka, "Šířka desky");
    chk(par.vyskaStolu, K.limity.vyskaStolu, "Výška stolu");
    chk(par.tloustkaDesky, K.limity.tloustkaDesky, "Tloušťka desky");
    chk(par.presah, K.limity.presah, "Přesah desky");

    const L = par.deskaDelka - 2 * par.presah; // vnější rozměr podnože
    const W = par.deskaSirka - 2 * par.presah;
    const H = par.vyskaStolu - par.tloustkaDesky; // výška podnože
    const a1 = pn.b, a2 = pn.h; // noha: a1 ve směru X, a2 ve směru Y
    const tp = par.patky ? K.patka.t : 0;

    if (pr.b > Math.min(a1, a2)) errors.push("Profil rámu (" + pr.id + ") je širší než noha (" + pn.id + ") – luby by nedosedly na nohu.");
    if (L < 2 * a1 + 150 || W < 2 * a2 + 150) errors.push("Podnož je pro zvolený profil nohy příliš malá (zmenšete přesah nebo profil).");
    if (H < pr.h + 150) errors.push("Výška podnože je příliš malá.");
    if (par.spodniPricky && (par.vyskaPricky < tp + 20 || par.vyskaPricky + pr.h > H - pr.h - 50))
      errors.push("Spodní příčka: výška nad podlahou mimo rozumný rozsah.");
    if (errors.length) return { errors, warnings, parts: [] };

    const parts = [];
    const add = (o) => { o.pos = "P" + (parts.length + 1); parts.push(o); return o; };

    // --- nohy ---
    const legLen = H - tp;
    const legT = [
      [a1 / 2, a2 / 2], [L - a1 / 2, a2 / 2], [L - a1 / 2, W - a2 / 2], [a1 / 2, W - a2 / 2]
    ];
    add({
      name: "Noha", kind: "K2", profile: pn, length: legLen,
      solid: tubeSolid(pn, legLen), cut: "90° / 90°",
      instances: legT.map(([x, y]) => ALONG_Z([x, y, tp])),
      note: par.patky ? "dole patka s maticí " + K.patka.zavit : "konce zaslepit plastovou zátkou"
    });

    // --- luby rámu ---
    const scr = K.otvoryDeska;
    const lenX = L - 2 * a1, lenY = W - 2 * a2;
    const zr = H - pr.h / 2;
    const hX = par.otvoryDeska ? holesForScrews(pr, lenX, scr, warnings, "Dlouhý lub") : [];
    add({
      name: "Lub dlouhý", kind: "K2", profile: pr, length: lenX,
      solid: tubeSolid(pr, lenX, hX), cut: "90° / 90°",
      instances: [ALONG_X([a1, pr.b / 2, zr]), ALONG_X([a1, W - pr.b / 2, zr])],
      note: hX.length ? (hX.length / 2) + "× otvor Ø" + hX[0].d + " nahoře / Ø" + hX[1].d + " dole" : ""
    });
    const hY = par.otvoryDeska ? holesForScrews(pr, lenY, scr, warnings, "Krátký lub") : [];
    add({
      name: "Lub krátký", kind: "K2", profile: pr, length: lenY,
      solid: tubeSolid(pr, lenY, hY), cut: "90° / 90°",
      instances: [ALONG_Y([pr.b / 2, a2, zr]), ALONG_Y([L - pr.b / 2, a2, zr])],
      note: hY.length ? (hY.length / 2) + "× otvor Ø" + hY[0].d + " nahoře / Ø" + hY[1].d + " dole" : ""
    });

    // --- střední příčka rámu ---
    if (L > K.stredniPricka_od) {
      const len = W - 2 * pr.b;
      const hM = par.otvoryDeska ? holesForScrews(pr, len, scr, warnings, "Střední příčka") : [];
      add({
        name: "Příčka střední", kind: "K2", profile: pr, length: len,
        solid: tubeSolid(pr, len, hM), cut: "90° / 90°",
        instances: [ALONG_Y([L / 2, pr.b, zr])],
        note: "automaticky nad délku " + K.stredniPricka_od + " mm" + (hM.length ? "; " + (hM.length / 2) + "× otvor" : "")
      });
    }

    // --- spodní příčky (na kratších stranách) ---
    if (par.spodniPricky) {
      const zs = par.vyskaPricky + pr.h / 2;
      add({
        name: "Příčka spodní", kind: "K2", profile: pr, length: lenY,
        solid: tubeSolid(pr, lenY), cut: "90° / 90°",
        instances: [ALONG_Y([a1 / 2, a2, zs]), ALONG_Y([L - a1 / 2, a2, zs])],
        note: "spodní hrana " + par.vyskaPricky + " mm nad podlahou"
      });
    }

    // --- patky ---
    if (par.patky) {
      const pp = B.plateProfile(a1, a2, [{ x: 0, y: 0, d: K.patka.otvor }]);
      add({
        name: "Patka", kind: "C2", plate: { b: a1, h: a2, t: tp, holes: [{ x: 0, y: 0, d: K.patka.otvor }] },
        profile: { id: "P" + tp + " " + a1 + "×" + a2 }, length: tp,
        solid: { loops: pp.loops, length: tp, wallHoles: [] },
        instances: legT.map(([x, y]) => ALONG_Z([x, y, 0])),
        note: "otvor Ø" + K.patka.otvor + " pro matici " + K.patka.zavit + " (navařit zevnitř nohy)"
      });
    }

    // hmotnosti
    const rho = K.material.hustota_kg_m3 * 1e-9; // kg/mm³
    let mass = 0, pieces = 0;
    for (const p of parts) {
      p.qty = p.instances.length;
      p.mass1 = B.solidVolume(p.solid) * rho;
      p.productionXf = p.kind === "K2" ? PRODUKCE : Xf.identity();
      mass += p.mass1 * p.qty;
      pieces += p.qty;
    }

    // jednoduché kontroly (bez výpočtu zatížení – doplní se později)
    if (lenX > 1400 && pr.h <= 40) warnings.push("Dlouhý lub " + Math.round(lenX) + " mm z profilu " + pr.id + " – zvažte vyšší profil rámu.");
    if (H > 900 && pn.b < 50) warnings.push("Vysoká podnož s tenkou nohou – zvažte spodní příčky nebo silnější profil.");

    return {
      errors, warnings, parts,
      dims: { L, W, H, deskaL: par.deskaDelka, deskaW: par.deskaSirka, deskaT: par.tloustkaDesky, zDesky: H },
      mass, pieces, params: Object.assign({}, par)
    };
  }

  root.GEOMETRY = { build, profil };
})(typeof window !== "undefined" ? window : globalThis);
