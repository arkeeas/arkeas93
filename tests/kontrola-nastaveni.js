"use strict";
/* Kontrola nastavení a blokování poptávky (krajní hodnoty, normy, staré konfigurace):
   - zábradlí: výška × hloubka pádu (ČSN 74 3305), světlá mezera 120 / 80 mm, rozteč špruší pro děti, geometrický motiv, mezera u podlahy,
     orientační posudek sloupku, přesah špruší nahoru, rám delší než tyč, RAL a umístění, meze ceníku, kotvení „bez“ v poptávkovém formuláři
   - podnože: blokování (díly se protínají, pohyblivá konstrukce, podnož vyčnívá zpod desky, výjimka stabilita Pohozence), meze modelů, pod nohy, jiný RAL
   - stolečky, ostatní: blokování, meze ceníku a počtu kusů
   - staré konfigurace bez nových polí se normalizují a dál jdou poptat
   Použití: node tests/kontrola-nastaveni.js */
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "ral.js")); require(path.join(ROOT, "core.js")); require(path.join(ROOT, "gen.js"));
["strom", "bunky", "jelen", "medved", "smrky", "los", "motyl", "motyl-a", "motyl-b", "kachny"].forEach((m) => require(path.join(ROOT, "assets/zabradli/motiv-" + m + ".js")));
fs.readdirSync(path.join(ROOT, "assets/zabradli/schody")).forEach((f) => require(path.join(ROOT, "assets/zabradli/schody", f)));
require(path.join(ROOT, "zabradli-core.js")); require(path.join(ROOT, "vyvoj.js"));
const Z = globalThis.Zabradli, P = globalThis.Podnoze, V = globalThis.Vyvoj, Ral = globalThis.Ral;
const S = require(path.join(ROOT, "stolecky-core.js")), Zas = require(path.join(ROOT, "zasteny-core.js")), Pt = require(path.join(ROOT, "ptaci-core.js"));

let bad = 0, n = 0;
const fail = (t) => { bad++; console.log("CHYBA " + t); };
const ok = (c, t) => { n++; if (!c) fail(t); };
const has = (A, lvl, re) => A.warns.some((w) => w.lvl === lvl && re.test(w.t));
const flat = [{ L: 3000, rise: 0 }];

/* ---------- zábradlí: výška × hloubka pádu ---------- */
{
  const H = (hloubka, vyska) => Z.analyze({ typ: "A", sloupky: true, segs: flat, hloubka, vyska });
  [["do3", 900, null], ["do12", 1000, 990], ["do30", 1100, 1090], ["nad30", 1200, 1190]].forEach(([h, min, low]) => {
    ok(!has(H(h, min), "bad", /pod minimem/), "výška " + min + " u hloubky " + h + " má projít");
    if (low) ok(has(H(h, low), "bad", /pod minimem/), "výška " + low + " u hloubky " + h + " je pod minimem");
  });
  ok(Z.normalize({ vyska: 800 }).vyska === 900 && Z.normalize({ vyska: 1500 }).vyska === 1300, "rozsah výšky 900–1300 mm");
  // stará poptávka bez hloubky: 900–990 mm = „do 3 m“ (zpětně se nezablokuje), 1000 a víc = „do 12 m“
  [900, 950, 990].forEach((v) => { const c = Z.normalize({ vyska: v }); ok(c.hloubka === "do3" && c.vyska === v, "stará výška " + v + " dostane hloubku do 3 m"); ok(!has(Z.analyze({ vyska: v, segs: flat }), "bad", /pod minimem/), "stará výška " + v + " se nezablokuje"); });
  ok(Z.normalize({ vyska: 1000 }).hloubka === "do12" && Z.normalize({}).hloubka === "do12", "výchozí hloubka do 12 m");
  ok(Z.normalize({ vyska: 950, hloubka: "do12" }).hloubka === "do12" && has(Z.analyze({ vyska: 950, hloubka: "do12", segs: flat }), "bad", /pod minimem/), "výslovně zadaná hloubka do 12 m + 950 mm je chyba");
  ok(Z.normalize({ hloubka: "nesmysl", vyska: 1100 }).hloubka === "do12", "neznámá hloubka spadne na výchozí");
  ok(has(Z.analyze({ segs: [{ L: 2000, rise: 2000 }], anchor: "bocni" }), "warn", /25–38°/), "sklon nad 38° varuje a říká, že běžná schodiště mají 25–38°");
  ok(!has(Z.analyze({ segs: [{ L: 3000, rise: 1800 }], anchor: "bocni" }), "warn", /Sklon úseku/), "sklon 31° nevaruje");
}

/* ---------- zábradlí: světlá mezera 120 / 80 ---------- */
{
  const lim = (A) => Math.max.apply(null, (A.lay.barInfo || []).map((b) => Math.max(b.gapMid, b.gapEnd)));
  const std = Z.analyze({ typ: "A", sloupky: true, segs: [{ L: 4000, rise: 0 }] });
  ok(lim(std) <= 120 && !has(std, "bad", /mezera/), "běžná mezera špruší do 120 mm (" + lim(std) + ")");
  ok(has(Z.analyze({ typ: "A", sloupky: true, segs: flat }, { mezeraMax: 90 }), "bad", /Světlá mezera ve výplni .*víc než 90/), "nad limit normy je mezera bad (špruše typ A)");
  ok(has(Z.analyze({ typ: "A", sloupky: true, segs: flat }, { mezeraMax: 110, mezeraVarovani: 100 }), "warn", /rezerva dílny/), "mezi rezervou dílny a limitem je mezera jen varování");
  ok(has(Z.analyze({ segs: flat }, { mezeraMax: 90 }), "bad", /Světlá mezera mezi špruše/), "nad limit normy je mezera bad (špruše typ B)");
  // děti: rozteč špruší se zmenší, mezera ≤ 80 mm (i na šikmině a u konců polí)
  [[{ typ: "A", sloupky: true }, "A"], [{ sloupky: false }, "B"]].forEach(([c, lab]) => {
    [flat, [{ L: 2800, rise: 1700 }], [{ L: 4500, rise: 0, turn: 90 }, { L: 3000, rise: 0 }]].forEach((segs, i) => {
      const A = Z.analyze(Object.assign({ uziti: "deti", segs, anchor: c.sloupky ? "patka" : "bocni" }, c, { rail: "50x50x3" }));
      const g = c.sloupky ? lim(A) : A.lay.gapMax;
      ok(g <= 80 && !has(A, "bad", /mezer/), "děti " + lab + " úsek " + i + ": mezera " + g + " ≤ 80 mm");
      ok(g > 20, "děti " + lab + ": mezera není nesmyslně malá (" + g + ")");
    });
    const N = Z.analyze(Object.assign({ segs: flat }, c)), D = Z.analyze(Object.assign({ segs: flat, uziti: "deti" }, c));
    ok((c.sloupky ? D.lay.barInfo[0].n > N.lay.barInfo[0].n : D.lay.bars.length > N.lay.bars.length), "děti " + lab + ": špruší je víc než běžně");
  });
  // geometrický motiv: rozteč omezená tak, aby mezera nepřesáhla limit
  const NV = { cfgVer: Z.CFG_VER };          // konfigurace ze stránky (dnešní limity); bez cfgVer = stará poptávka
  const G = Z.normalize({ vypln: "geometricky", motifPitch: 400, cfgVer: Z.CFG_VER }), Gd = Z.normalize({ vypln: "geometricky", motifPitch: 400, uziti: "deti", cfgVer: Z.CFG_VER });
  ok(G.motifPitch === Z.GEO_FRAME_W + 120 && Gd.motifPitch === Z.GEO_FRAME_W + 80, "rozteč geometrického motivu max 250 / 210 mm (" + G.motifPitch + "/" + Gd.motifPitch + ")");
  const GA = Z.analyze(Object.assign({ vypln: "geometricky", motifPitch: 400, segs: [{ L: 3000, rise: 0 }] }, NV));
  ok(GA.lay.gapMax <= 120 && !has(GA, "bad", /mezera/), "geometrický motiv: mezera ≤ 120 mm (" + GA.lay.gapMax + ")");
  ok(has(GA, "warn", /rezerva dílny/), "geometrický motiv 250 mm = mezera 120 > 110: varování");
  const GD = Z.analyze({ vypln: "geometricky", uziti: "deti", segs: [{ L: 3000, rise: 0 }] });
  ok(has(GD, "bad", /pod spodním rámem u podlahy 90 mm/) && has(GD, "warn", /šplhání/), "geometrický motiv pro děti: mezera u podlahy 90 > 80 bad + šplhání");
  ok(!has(Z.analyze({ vypln: "geometricky", segs: [{ L: 3000, rise: 0 }] }), "bad", /podlahy/), "geometrický motiv běžně: mezera u podlahy 90 ≤ 120");
  // laserový motiv: děti = otvory nad 80 mm bad, jinak warn (šplhání)
  const LD = Z.analyze({ vypln: "laser", uziti: "deti", segs: flat });
  ok(has(LD, "bad", /šplhání/) || has(LD, "warn", /šplhání/), "laserový motiv pro děti: upozornění na šplhání");
  ok(has(LD, "bad", /Největší otvor/), "laserový motiv pro děti: otvor nad 80 mm je bad");
  const LN = Z.analyze({ vypln: "laser", segs: flat });
  ok(!has(LN, "bad", /Největší otvor/) && !has(LN, "warn", /šplhání/), "laserový motiv běžně: otvor do 120 mm a bez šplhání");
  const PR = Z.analyze({ vypln: "laser", rada: "priroda", motiv: "jelen", uziti: "deti", segs: flat });
  ok(PR.warns.some((w) => /šplhání/.test(w.t)), "Příroda pro děti: upozornění na šplhání");
  ok(Z.analyze({ vypln: "laser", rada: "priroda", motiv: "jelen", segs: flat }, { mezeraMax: 60, mezeraVarovani: 50 }).warns.some((w) => w.lvl === "bad" && /Největší otvor/.test(w.t)), "Příroda: otvor kontroluje limit mezery z ceníku");
  // mezera u podlahy
  ok(Z.analyze({ typ: "A", sloupky: true, anchor: "patka", segs: flat }).lay.floorGap === 8 && Z.analyze({ typ: "A", sloupky: true, anchor: "patka", segs: [{ L: 3000, rise: 1800, steps: 11 }] }).lay.floorGap === 40, "mezera u podlahy: patka 8 mm, na schodišti 40 mm");
  ok(Z.analyze({ anchor: "bocni", segs: flat }).lay.floorGap === 0, "z boku: rám leží na podlaze");
  ok(has(Z.analyze({ typ: "A", sloupky: true, anchor: "patka", uziti: "deti", segs: [{ L: 3000, rise: 1800, steps: 11 }] }, { mezeraMax: 50, mezeraDeti: 30, mezeraVarovani: 30, mezeraRezerva: 0 }), "bad", /pod spodním rámem u podlahy/), "mezera u podlahy nad limit je bad");
  ok(has(Z.analyze({ typ: "A", sloupky: true, anchor: "patka", segs: [{ L: 3000, rise: 1800, steps: 11 }] }), "info", /trojúhelník/), "schodiště: trojúhelník nad stupněm jako info");
}

/* ---------- zábradlí: orientační posudek sloupku ---------- */
{
  const P1 = (rail, pitch, uz) => Z.analyze({ typ: "A", sloupky: true, rail, postPitch: pitch, uziti: uz || "dum", segs: [{ L: 6000, rise: 0 }] });
  const a1000 = P1("40x40x2", 1000), a1500 = P1("40x40x2", 1500);
  ok(a1000.post && Math.abs(a1000.post.s - 1000) < 1 && a1000.post.util < 0.8 && a1000.post.lvl === "info", "40×40×2 při rozteči 1000: využití " + Math.round(a1000.post.util * 100) + " % (< 80 %)");
  ok(a1500.post.util > 1 && a1500.post.lvl === "bad" && has(a1500, "bad", /Orientační posouzení sloupku.*přetížený/), "40×40×2 při rozteči 1500: využití " + Math.round(a1500.post.util * 100) + " % > 100 % = bad");
  ok(Math.abs(a1500.post.s - 1500) < 1, "rozteč se bere z vypočteného layoutu (" + Math.round(a1500.post.s) + ")");
  // skutečná největší rozteč: 3100 mm s max. rozteční 1500 = pole po 1033, ne 1500
  const real = Z.analyze({ typ: "A", sloupky: true, postPitch: 1500, segs: [{ L: 3100, rise: 0 }] });
  ok(Math.abs(real.post.s - 3100 / 3) < 1, "použije se skutečná rozteč " + Math.round(real.post.s) + ", ne nastavené maximum");
  ok(has(a1000, "info", /využití \d+ %/), "zákazník vidí jednu řádku s využitím sloupku");
  // ruční kontrola: 40×40×2, S235, 0,5 kN/m, 1000 × 1000 mm: Wpl = 4336 mm³, M = 1,5·500·1000 = 0,75 kNm, MRd = 1,019 kNm
  ok(Math.abs(a1000.post.Wpl - 4336) < 1 && Math.abs(a1000.post.MEd - 750000) < 1 && Math.abs(a1000.post.utilM - 750000 / (4336 * 235)) < 1e-9, "výpočet Wpl / MEd / MRd sedí s ruční kontrolou");
  ok(P1("40x40x3", 1500).post.util < 1 && P1("50x50x3", 1500).post.util < P1("40x40x3", 1500).post.util && P1("60x60x3", 1500).post.util < P1("50x50x3", 1500).post.util, "silnější profily snesou větší rozteč");
  ok(P1("40x40x2", 1000, "verejny").post.q === 1 && P1("40x40x2", 1000, "deti").post.util > 1 && P1("40x40x2", 1000, "bytdum").post.q === 0.5, "zatížení 0,5 / 1,0 kN/m podle užití");
  ok(P1("40x40x2", 1000, "verejny").post.util > a1000.post.util * 1.9, "veřejný prostor: dvojnásobné zatížení");
  // veřejný prostor, výška 1100, 1,0 kN/m: rada jmenuje profil, který při stejné rozteči projde
  const pub = Z.analyze({ typ: "A", sloupky: true, rail: "40x40x2", postPitch: 1000, uziti: "verejny", vyska: 1100, hloubka: "do30", segs: [{ L: 5000, rise: 0 }] });
  ok(pub.post.lvl === "bad" && pub.post.better && has(pub, "bad", new RegExp("[Zz]volte profil " + Z.RAILS.A.find((r) => r.id === pub.post.better).lab)) && !has(pub, "bad", /zhruba do [1-5]\d\d mm/), "přetížený sloupek: rada s konkrétním profilem (" + pub.post.better + ")");
  const pub2 = Z.analyze(Object.assign({}, pub.cfg, { rail: pub.post.better }));
  ok(pub2.post.util <= 0.8 && !pub2.warns.some((w) => w.lvl === "bad"), "doporučený profil " + pub.post.better + " pro 1100 mm a 1,0 kN/m projde (" + Math.round(pub2.post.util * 100) + " %) a jde poptat");
  const custom = Z.analyze({ typ: "A", sloupky: true, postPitch: 1000, segs: flat }, { zatizeniDum: 1, pruhybSloupekMax: 5 });
  ok(custom.post.q === 1 && custom.post.utilDefl > custom.post.utilM, "zatížení a limit průhybu jdou z ceníku dílny");
  ok(!Z.analyze({ sloupky: false, segs: flat }).post && has(Z.analyze({ sloupky: false, segs: flat }), "info", /ověří dílna/), "bez sloupků: jen info, posudek se nedělá");
  ok(Z.analyze({ vypln: "geometricky", segs: flat }).post === null, "geometrický motiv: posudek sloupku se nedělá");
  ok(Z.analyze({ vypln: "laser", segs: flat }).post && Z.analyze({ vypln: "laser", segs: flat }).post.s > 0, "laserový motiv se sloupky: posudek se dělá");
  // nové profily projdou geometrií (zámky/drážky, uzavřená tělesa) – detailně v kontrola-zabradli.js
  ["40x40x3", "50x50x3", "60x60x3"].forEach((r) => { const A = Z.analyze({ typ: "A", sloupky: true, rail: r, segs: [{ L: 4500, rise: 0, turn: 90 }, { L: 3000, rise: 1500 }] }); ok(A.cfg.rail === r && A.lay.members.length > 20, "profil " + r + " je v nabídce a jde sestavit"); });
}

/* ---------- zábradlí: přesah nahoru, rám delší než tyč, povrch, RAL ---------- */
{
  ok(Z.normalize({ madlo: false, overTop: 250, cfgVer: Z.CFG_VER }).overTop === 100 && Z.normalize({ madlo: false, overBot: 250, anchor: "bocni" }).overBot === 250, "přesah nahoru max 100 mm, dolů 400 mm");
  ok(has(Z.analyze({ madlo: false, overTop: 50, segs: flat }), "warn", /zaoblené nebo zatupené/), "přesah nahoru: zaoblené konce (warn)");
  ok(has(Z.analyze({ madlo: false, overTop: 50, uziti: "deti", segs: flat }), "bad", /zaoblené nebo zatupené.*nejde/), "přesah nahoru + děti = bad");
  ok(!has(Z.analyze({ madlo: false, segs: flat }), "warn", /zaoblené/), "bez přesahu žádné upozornění");
  const long = Z.analyze({ typ: "A", sloupky: true, segs: [{ L: 9000, rise: 0 }] });
  ok(has(long, "bad", /delší než tyč.*Rozdělte/), "rám delší než tyč je bad s radou");
  ok(!has(Z.analyze({ typ: "A", sloupky: true, segs: [{ L: 9000, rise: 0 }] }, { tycDelka: 12000 }), "bad", /delší než tyč/), "limit délky tyče jde z ceníku (tycDelka)");
  ok(!has(Z.analyze({ typ: "A", sloupky: true, segs: [{ L: 3000, rise: 0 }] }), "bad", /delší než tyč/), "běžný rám tyč nepřesáhne");
  // povrch
  ok(has(Z.analyze({ fin: "prasek", segs: flat }), "warn", /bez zinku venku/) && !has(Z.analyze({ fin: "prasek", umisteni: "uvnitr", segs: flat }), "warn", /bez zinku/) && !has(Z.analyze({ fin: "duplex", segs: flat }), "warn", /bez zinku/), "prášek venku varuje, uvnitř ne, duplex ne");
  ok(Z.normalize({}).umisteni === "venku" && Z.normalize({ umisteni: "uvnitr" }).umisteni === "uvnitr" && Z.normalize({ umisteni: "x" }).umisteni === "venku", "umístění: výchozí venku");
  ok(Z.normalize({}).ral === "7016" && Z.normalize({ ral: "3000" }).ral === "3000" && Z.normalize({ ral: "1234" }).ral === "7016", "RAL: výchozí 7016, neznámý spadne na výchozí");
  const j = Z.normalize({ fin: "prasek", ral: "jiny", ralJiny: "ral 5010" });
  ok(j.ral === "jiny" && j.ralJiny === "5010", "jiný RAL se ověří a uloží (" + j.ralJiny + ")");
  ok(has(Z.analyze({ fin: "duplex", ral: "jiny", ralJiny: "50", segs: flat }), "bad", /číslo odstínu RAL/) && !has(Z.analyze({ fin: "duplex", ral: "jiny", ralJiny: "5010", segs: flat }), "bad", /RAL/), "nehotový jiný RAL = bad, platný projde");
  ok(!has(Z.analyze({ fin: "zn", ral: "jiny", ralJiny: "", segs: flat }), "bad", /RAL/), "u zinku se RAL neřeší");
  ok(Z.normalize({ ral: "jiny", ralJiny: "0123" }).ralJiny === "0123" && !Ral.valid("0123") && !Ral.valid("123") && !Ral.valid("12345") && Ral.valid("9005"), "RAL: 4 číslice, první 1–9");
  ok(/RAL 5010/.test(Z.describe({ fin: "prasek", ral: "jiny", ralJiny: "5010" })) && /RAL 3000/.test(Z.describe({ fin: "duplex", ral: "3000" })) && /vnitřní/.test(Z.describe({ umisteni: "uvnitr" })), "describe obsahuje RAL, umístění");
  ok(/zábradlí|Zábradlí/.test(Z.describe({ uziti: "deti", hloubka: "do30" })) && /prostor s dětmi/.test(Z.describe({ uziti: "deti" })) && /do 30 m/.test(Z.describe({ hloubka: "do30" })), "describe obsahuje užití a hloubku");
  // meze ceníku
  const R = Z.rates0({ kg: -5, marze: 9999, tycDelka: "x", mezeraMax: 5, kotva: { beton: -1 }, kotvaDop: 5000, kotvaMax: 1000 });
  ok(R.kg === 42 && R.marze === 35 && R.tycDelka === 6000 && R.mezeraMax === 120 && R.kotva.beton === 190 && R.kotvaDop <= R.kotvaMax, "rates0 vrátí nesmyslné hodnoty na výchozí");
  ok(Z.rates0({ kg: 0, svar: 0 }).kg === 0, "nulová sazba ve výpočtu projde (testy), formulář dílny ji odmítne");
  ok(Z.checkRates({ kg: 0 }).length === 1 && Z.checkRates({ marze: -1 }).length === 1 && Z.checkRates({ kotva: { beton: 0 } }).length === 1 && Z.checkRates(Z.DEFAULT_RATES).length === 0, "checkRates odmítne nulu a záporná čísla, výchozí ceník projde");
  ok(Z.checkRates({ mezeraDeti: 100, mezeraMax: 90 }).length === 1, "mezera pro děti nesmí být větší než běžná");
  // kotvení „bez“: poptávkový formulář vyžaduje zaškrtnutí
  const html = fs.readFileSync(path.join(ROOT, "zabradli.html"), "utf8");
  ok(/id="fBez"/.test(html) && /Beru na vědomí, že kotvení a jeho únosnost zajišťuji sám/.test(html) && /cfg\.anchor === 'bez' && !\$\('fBez'\)\.checked/.test(html), "formulář zábradlí vyžaduje potvrzení u kotvení „bez“");
  ok(Z.analyze({ anchor: "bez", sloupky: true, typ: "A", segs: flat }).warns.some((w) => /Bez kotev/.test(w.t)), "bez kotev: info v zadání");
}

/* ---------- zábradlí: staré konfigurace bez nových polí + presety ---------- */
const NV0 = { cfgVer: Z.CFG_VER };
{
  const old = { typ: "B", segs: Z.DEFAULT_CFG.segs, vyska: 1000, side: "L", vypln: "standard", rail: null, bar: null, join: "tupo", anchor: "bocni", base: "beton", facade: 200, arm: 250, fin: "znpu", services: { zamereni: true }, qty: 1 };
  ["uziti", "hloubka", "umisteni", "ral", "ralJiny"].forEach((k) => ok(!(k in old), "stará konfigurace nemá pole " + k));
  const A0 = Z.analyze(old);
  ok(!A0.warns.some((w) => w.lvl === "bad"), "stará výchozí konfigurace jde dál poptat: " + A0.warns.filter((w) => w.lvl === "bad").map((w) => w.t).join(" | "));
  const A1 = Z.analyze(Z.DEFAULT_CFG);
  ok(!A1.warns.some((w) => w.lvl === "bad"), "DEFAULT_CFG jde poptat: " + A1.warns.filter((w) => w.lvl === "bad").map((w) => w.t).join(" | "));
  ok(Z.normalize(old).uziti === "dum" && Z.normalize(old).umisteni === "venku" && Z.normalize(old).ral === "7016", "staré nastavení dostane výchozí nová pole");
  // uložené nastavení se po normalizaci nemění (idempotence)
  const nz = Z.normalize(old); ok(JSON.stringify(Z.normalize(nz)) === JSON.stringify(nz), "normalize je idempotentní");
  Z.PRESETS.forEach((pr) => [{ typ: "B", anchor: "bocni" }, { typ: "A", sloupky: true, anchor: "bocni", rail: "50x50x3" }].forEach((c) => {
    const segs = pr.segs.map((s) => Object.assign({ turn: 0 }, s));
    const A = Z.analyze(Object.assign({ segs }, c, pr.id === "schody" || pr.id === "schodypod" ? { segs: segs.map((s) => (s.rise ? Object.assign({ steps: 11 }, s) : s)) } : {}));
    const b = A.warns.filter((w) => w.lvl === "bad");
    ok(b.length === 0, "preset " + pr.id + " " + (c.sloupky ? "se sloupky" : "bez sloupků") + " jde poptat: " + b.map((w) => w.t.slice(0, 90)).join(" | "));
  }));
  // stará (už přijatá) poptávka bez cfgVer: dílna vidí rozměry, jak je zákazník objednal – nic se neořízne, jen upozornění
  const oldTop = Z.analyze({ typ: "A", sloupky: true, madlo: false, overTop: 300, segs: flat });
  ok(oldTop.cfg.overTop === 300 && has(oldTop, "warn", /Starší poptávka: přesah špruší nahoru 300 mm/), "stará poptávka: přesah nahoru 300 mm zůstane + varování");
  ok(oldTop.lay.members.filter((m) => m.role === "overtop").length > 0, "stará poptávka: přesahy nahoru jsou v geometrii");
  const oldGeo = Z.analyze({ vypln: "geometricky", motifPitch: 300, segs: [{ L: 3000, rise: 0 }] });
  ok(oldGeo.cfg.motifPitch === 300 && has(oldGeo, "warn", /Starší poptávka: rozteč geometrického motivu 300 mm/), "stará poptávka: rozteč motivu 300 mm zůstane + varování");
  ok(Z.analyze({ typ: "A", sloupky: true, madlo: false, overTop: 300, segs: flat, cfgVer: Z.CFG_VER }).cfg.overTop === 100, "nová konfigurace (cfgVer): přesah nahoru 300 → 100 mm");
  ok(Z.normalize(Z.normalize({ cfgVer: Z.CFG_VER })).cfgVer === Z.CFG_VER && Z.normalize({}).cfgVer === undefined, "cfgVer se drží přes normalize, stará poptávka ho nedostane");
  // výchozí stav stránky: žádné varování způsobené novými kontrolami (sklon výchozího presetu 35°)
  const def = Z.analyze(Object.assign({}, Z.DEFAULT_CFG, NV0));
  ok(!def.warns.some((w) => w.lvl !== "info"), "výchozí zábradlí bez varování: " + def.warns.filter((w) => w.lvl !== "info").map((w) => w.t.slice(0, 60)).join(" | "));
}

/* ---------- podnože: blokování, meze modelů, pod nohy, RAL ---------- */
{
  const why = (c) => P.blockReasons(P.analyze(c));
  ok(why({ model: "UU", L: 350, W: 300, H: 350, size: 50, t: 4 }).some((t) => /protínají/.test(t)), "UU 350×300×350 jekl 50×50×4: díly se protínají = blokováno");
  ok(P.analyze({ model: "MS", L: 350, W: 300, H: 350, size: 50, t: 4 }).audit.fab.some((f) => f.lvl === "bad"), "MS 350×300 jekl 50 je kolize dílů");
  ok(P.analyze({ model: "OK", L: 350, W: 300, H: 350, size: 50, t: 4 }).audit.fab.some((f) => f.lvl === "bad"), "OK 350×300 jekl 50 je kolize dílů");
  // minimální rozměry modelu: na hranici projde, těsně pod ní ne
  [["UU", 50], ["UU", 40], ["MS", 30], ["MS", 40], ["MS", 50], ["OK", 40], ["OK", 50]].forEach(([m, size]) => ["rect", "ellipse"].forEach((shape) => {
    const lim = P.dimLimits(m, size, shape), t = P.THK[size][0];
    const okc = { model: m, size, t, shape, L: Math.max(700, lim.minL), W: lim.minW, H: 750 };
    ok(!why(okc).some((x) => /protínají/.test(x)), m + " " + size + " " + shape + ": při minimálním W " + lim.minW + " se díly neprotínají");
    ok(why(Object.assign({}, okc, { W: lim.minW - 20 })).some((x) => /protínají/.test(x)), m + " " + size + " " + shape + ": pod minimálním W " + lim.minW + " se díly protínají");
  }));
  ok(P.dimLimits("U", 40, "rect").minW === 300 && P.dimLimits("C", 40, "rect").maxL === 1000 && P.dimLimits("C", 40, "rect").maxW === 600 && P.dimLimits("C", 40, "rect").maxH === 750, "dimLimits: výchozí meze a C-rám 1000 × 600 × 750");
  // C-rám v mezích projde auditem s jeklem 50×50×4 (v rozích krychle meze)
  [[350, 300, 350], [1000, 600, 750], [1000, 300, 750], [350, 600, 750], [700, 450, 450]].forEach(([L, W, H]) => { const A = P.analyze({ model: "C", L, W, H, size: 50, t: 4 }); ok(A.audit.overall === "ok" && P.blockReasons(A).length === 0, "C-rám " + L + "×" + W + "×" + H + " s jeklem 50×50×4 projde auditem (" + A.audit.overall + ")"); });
  ok(P.analyze({ model: "C", L: 1600, W: 800, H: 750, size: 50, t: 4 }).warns.some((w) => /malé stolky/.test(w)), "C-rám nad meze: varování (stará poptávka se nerozbije)");
  ok(P.normalize({ model: "C", L: 1600 }).L === 1600, "normalize C-rám nad meze nepřepíše uložený rozměr");
  // pohyblivá konstrukce
  const sing = { model: "Z", size: 20, t: 2, L: 1000, W: 1100, H: 600 };
  ok(P.analyze(sing).audit.singular && why(sing).some((t) => /pohyblivá/.test(t)), "singulární konstrukce blokuje poptávku");
  // podnož vyčnívá zpod desky
  const oh = { model: "4N", dmode: "own", dL: 400, dW: 300 };
  ok(P.analyze(oh).ohWarn && P.analyze(oh).ohWarn.lvl === "bad" && why(oh).some((t) => /vyčnívala/.test(t)), "podnož vyčnívá zpod desky = blokuje");
  ok(P.blockReasons(P.analyze({ model: "4N" })).length === 0, "výchozí podnož se dá poptat");
  // díl delší než tyč
  const fake = (model, extra) => Object.assign({ cfg: { model }, audit: { checks: [{ id: "stab", lab: "Stabilita proti převržení", lvl: "bad" }], fab: [], singular: false }, ohWarn: null }, extra);
  ok(P.blockReasons(fake("U")).length === 1 && P.blockReasons(fake("PZ")).length === 0, "stabilita blokuje, jen u Pohozence (PZ) ne");
  ok(P.blockReasons(fake("PZ", { audit: { checks: [{ id: "sway", lab: "Vyklonění", lvl: "bad" }], fab: [{ lvl: "bad", t: "díl delší než tyč" }], singular: true } })).length === 3, "u Pohozence blokuje všechno ostatní (checks, fab, singular)");
  ok(P.blockReasons(fake("U", { audit: { checks: [], fab: [{ lvl: "warn", t: "x" }], singular: false } })).length === 0, "fab jen warn neblokuje");
  const pz = V.analyze({ model: "PZ" });
  ok(V.blockReasons(pz).every((t) => !/stabilit/i.test(t)), "Pohozenec: stabilita se neblokuje (README)");
  const htmlI = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), htmlV = fs.readFileSync(path.join(ROOT, "vyvoj.html"), "utf8");
  ok(/K\.blockReasons\(A\)/.test(htmlI) && /K\.blockReasons\(A\)/.test(htmlV) && /id="askWhy"/.test(htmlI) && /id="askWhy"/.test(htmlV), "obě stránky blokují přes blockReasons a píšou důvod");
  // pod nohy
  const feet = P.analyze({ model: "4N", nohy: "rektif", size: 40 });
  ok(P.feetCount(P.normalize({ model: "SC" })).q === 6 && P.feetCount(P.normalize({ model: "U" })).q === 4 && P.feetCount(P.normalize({ model: "TS" })).q === 4, "pod nohy: Schody 6 bodů (noha + spodní příčka), U a Kozlík 4");
  ok(feet.feet && feet.feet.q === 4 && feet.rows.some((r) => r.kind === "hw" && /rektifikační nožka M8/.test(r.name) && r.q === 4), "rektifikační nožky: 4 ks v kusovníku");
  ok(P.analyze({ model: "U", nohy: "kluzak" }).rows.some((r) => /kluzák/.test(r.name) && r.q === 4), "kluzáky: 4 ks u rámu U (průběžná spodní příčka)");
  ok(P.analyze({ model: "4N", nohy: "rektif" }).price > P.analyze({ model: "4N" }).price && P.analyze({ model: "4N" }).rows.every((r) => !/nožka|kluzák/.test(r.name)), "pod nohy se promítne do ceny, výchozí 'nic' do kusovníku nic nepřidá");
  ok(P.analyze({ model: "4N", nohy: "rektif" }, { rektifikace: 1000 }).price > P.analyze({ model: "4N", nohy: "rektif" }).price, "cena nožek jde z ceníku (rektifikace)");
  ok(P.normalize({ nohy: "rektif", size: 20, t: 2 }).nohy === "kluzak" && P.normalize({}).nohy === "nic" && P.normalize({ nohy: "x" }).nohy === "nic", "rektifikace jen od jeklu 30×30, výchozí nic");
  ok(/rektifikační nožky M8/.test(P.describe(P.normalize({ nohy: "rektif" }))) && !/pod nohy/.test(P.describe(P.normalize({}))), "popis obsahuje volbu pod nohy");
  ok(/10–25 mm/.test(P.FEET_NOTE), "poznámka o změně výšky rektifikací");
  ok(V.analyze({ model: "PZ", nohy: "kluzak" }).rows.some((r) => /kluzák/.test(r.name)), "Umělecké: pod nohy v kusovníku");
  // RAL
  const r = P.analyze({ fin: "ral", ralJiny: "5010" }), r0 = P.analyze({ fin: "ral", ralJiny: "50" });
  ok(P.normalize({ fin: "ral", ralJiny: "ral 5010" }).ralJiny === "5010" && P.normalize({ fin: "black", ralJiny: "abc" }).ralJiny === "", "podnože: jiný RAL se ověří");
  ok(P.blockReasons(r).length === 0 && P.blockReasons(r0).some((t) => /RAL/.test(t)), "podnože: nehotový jiný RAL blokuje poptávku, platný ne");
  ok(/RAL 5010/.test(P.describe(r.cfg)) && P.finOf(r.cfg).sw === Ral.hex("jiny", "5010"), "podnože: describe a barva podle RAL");
  ok(P.normalize({ model: "U", fin: "anth" }).fin === "anth", "staré povrchy fungují dál");
  // staré konfigurace
  const oldP = { model: "U", L: 1600, W: 800, H: 750, td: 40, size: 40, t: 2, join: "weld", shape: "rect", fin: "black", qty: 1, dmode: "table", dL: 1600, dW: 800 };
  ok(P.blockReasons(P.analyze(oldP)).length === 0 && P.normalize(oldP).nohy === "nic", "stará konfigurace podnože se dá poptat");
  ok(P.blockReasons(P.analyze(P.DEFAULT_CFG)).length === 0, "DEFAULT_CFG podnože se dá poptat");
  ok(P.blockReasons(V.analyze(V.DEFAULT_CFG)).filter((t) => !/stabilit/i.test(t)).length === 0, "DEFAULT_CFG Uměleckých: " + P.blockReasons(V.analyze(V.DEFAULT_CFG)).join(" | "));
  // ceník
  const rp = P.rates0({ kg: -1, marze: 1000, plate: { w: -5 }, boltMax4N: 10 });
  ok(rp.kg === 42 && rp.marze === 35 && rp.plate.w === 40 && rp.boltMax4N === 1400, "podnože: nesmyslné sazby ceníku se vrátí na výchozí");
  ok(P.checkRates({ kg: 0 }).length === 1 && P.checkRates({ marze: 301 }).length === 1 && P.checkRates({ plate: { w: 0, l: 60, t: 4 } }).length === 1 && P.checkRates(P.DEFAULT_RATES).length === 0, "podnože: formulář ceníku odmítne nulu, záporné a nesmyslné hodnoty");
}

/* ---------- stolečky, ostatní ---------- */
{
  const B = S.build({});
  ok(Array.isArray(B.block) && B.block.length === 0, "stolek Řetěz: výchozí jde poptat");
  const T = S.build({ H: 300, gamma: 60, spread: 500 });
  ok(Array.isArray(T.block) && Array.isArray(T.warn), "stolek: krajní hodnoty se spočítají");
  ok(S.build({ mount: "zapust", plT: 3 }).block.some((t) => /plech aspoň 5 mm/.test(t)), "stolek: zapuštěné vruty do plechu 3 mm = blokuje");
  ok(S.build({ mount: "insert", topT: 10 }).block.some((t) => /desku aspoň 22 mm/.test(t)), "stolek: vložky M6 do desky 10 mm = blokuje");
  ok(S.build({ fin: "ral", ralJiny: "" }).block.some((t) => /RAL/.test(t)) && S.build({ fin: "ral", ralJiny: "5010" }).block.length === 0 && /RAL 5010/.test(S.describe({ fin: "ral", ralJiny: "5010" })), "stolek: jiný RAL");
  ok(S.build({ model: "motylek", fin: "ral", ralJiny: "1" }).block.length === 1, "Motýlek: jiný RAL");
  const oldS = { model: "retez", H: 450, topD: 700, topT: 30, baseW: 340, baseT: 10, plT: 6, prof: "40x20x2", gamma: 40, spread: 240, fin: "anth", qty: 1, top: "plech", mount: "vrut" };
  ok(S.build(oldS).block.length === 0 && S.normalize(oldS).ralJiny === "", "stará konfigurace stolku se dá poptat");
  const priceNeg = S.price(S.build({}), { kg: -100, marze: -50 });
  ok(priceNeg.price === S.price(S.build({})).price, "stolek: záporné sazby ceníku se ignorují");
  // ostatní
  ok(!Zas.validate({ width: 800, height: 2000, finish: "black", qty: 100 }).ok && Zas.validate({ width: 800, height: 2000, finish: "black", qty: 99 }).ok, "zástěna: nejvýš 99 ks");
  ok(!Zas.validate({ width: 5, height: 2000, finish: "black", qty: 1 }).ok && !Zas.validate({ width: 800, height: 90000, finish: "black", qty: 1 }).ok && Zas.validate({ width: 800, height: 2000, finish: "black", qty: 1 }).ok, "zástěna: rozměr 300–3000 mm");
  ok(!Pt.validate({ pose: "vzlet", finish: "black", qty: 1000 }).ok, "ptáci: nejvýš 99 ks");
  ok(Zas.price({ width: 800, height: 2000, finish: "black", qty: 1 }, { kg: -1, marze: -100 }).price === Zas.price({ width: 800, height: 2000, finish: "black", qty: 1 }).price, "zástěna: záporné sazby ceníku se ignorují");
  ok(Pt.price({ pose: "vzlet", finish: "black", qty: 1 }, { marze: 9999 }).price === Pt.price({ pose: "vzlet", finish: "black", qty: 1 }).price, "ptáci: marže nad 300 % se ignoruje");
}

console.log(bad ? "\n" + bad + " chyb z " + n + " kontrol" : "\nNastavení a blokování: vše v pořádku (" + n + " kontrol)");
process.exit(bad ? 1 : 0);
