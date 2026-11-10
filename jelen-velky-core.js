/* Velký Jelen 1200 z plechu (C2 + ohnuté háčky): jedna pevná varianta, povrch a počet kusů, orientační cena.
   Zdroj: assets/jelen-velky/jelen_velky_1200_paleni.dxf (jen vrstva REZ). Hodnoty z assets/jelen-velky/souhrn.json
   (nastroje/jelen_velky.py); test hlídá shodu. Tloušťka 3 mm a 2 ohyby na háček jsou PŘEDPOKLAD – v DXF nejsou. */
(function (root) {
  'use strict';
  const FINISHES = ['black', 'anth', 'white', 'raw'];
  const FINISH_LABELS = { black: 'Černá mat', anth: 'Antracit', white: 'Bílá', raw: 'Ocel + lak' };
  const SPEC = {
    label: 'Věšák Jelen velký', width: 1200, height: 744, t: 3, hooks: 10, hookWidth: 20,
    flat: [1200.0, 743.9], kg: 4.37, cutMm: 15721,
    pierces: 23,      // 1 vnější obrys + 22 vnitřních výřezů (oči, uši, nos, srst); otvory na uchycení v DXF nejsou – uchycení přes 6 sloupků zezadu (jekl 20×20×2 L31 + destička s klíčovou dírkou), pozice v jelen_velky_1200_znaceni_rubem.dxf
    bends: 20,        // předpoklad: 10 háčků × 2 ohyby 90° jako u malého Jelena – ohybové čáry v DXF nejsou
    steelKgPerMm3: 7.85e-6
  };
  const DEFAULTS = { finish: 'black', qty: 1 };
  const DEFAULT_RATES = { kg: 42, rez: 35, svar: 90, barva: 280, priprava: 600, marze: 35, ohyb: 30 };
  // meze ceníku: záporné / nulové / nesmyslné sazby se vrátí na výchozí (stejně jako u podnoží – core.js)
  const RATE_LIM = { kg: [0, 1000], rez: [0, 5000], svar: [0, 5000], barva: [0, 5000], priprava: [0, 100000], marze: [0, 300], ohyb: [0, 5000] };
  const rates0 = (r) => { const R = Object.assign({}, DEFAULT_RATES, r || {}); Object.keys(RATE_LIM).forEach((k) => { if (DEFAULT_RATES[k] === undefined) return; const n = Number(R[k]); if (!Number.isFinite(n) || n < RATE_LIM[k][0] || n > RATE_LIM[k][1]) R[k] = DEFAULT_RATES[k]; }); return R; };
  const QTY_MAX = 99;                                                  // nejvíc kusů v jedné poptávce
  const normalize = (c) => {
    const x = c || {}, q = Number(x.qty);
    return { finish: FINISHES.includes(x.finish) ? x.finish : DEFAULTS.finish, qty: Number.isSafeInteger(q) && q > 0 ? q : DEFAULTS.qty };
  };
  function validate(config) {
    const c = config || {}, errors = [], qty = Number(c.qty);
    if (c.finish != null && !FINISHES.includes(c.finish)) errors.push('Vyberte platný povrch.');
    if (c.qty == null || c.qty === '' || !Number.isSafeInteger(qty) || qty < 1) errors.push('Počet kusů musí být celé číslo alespoň 1.');
    else if (qty > QTY_MAX) errors.push('Počet kusů je nejvýše ' + QTY_MAX + '.');
    return { ok: errors.length === 0, errors };
  }
  function describe(config) {
    const c = normalize(config);
    return SPEC.label + ' · ' + SPEC.width + ' × ' + SPEC.height + ' mm · ' + SPEC.hooks + ' háčků · ' + FINISH_LABELS[c.finish] + ' · ' + c.qty + ' ks';
  }
  const validEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim());
  function price(config, rates) {
    const c = normalize(config), R = rates0(rates);
    const areaMm2 = SPEC.kg / SPEC.steelKgPerMm3 / SPEC.t;
    const surfaceM2 = (2 * areaMm2 + SPEC.cutMm * SPEC.t) / 1e6, finishFactor = c.finish === 'raw' ? 0.7 : 1;
    const cost = SPEC.kg * R.kg + SPEC.pierces * R.rez + SPEC.bends * R.ohyb + surfaceM2 * R.barva * finishFactor + R.priprava / c.qty;
    const unit = Math.round(cost * (1 + R.marze / 100) / 10) * 10, vat = Math.round(unit * 1.21 / 10) * 10;
    return { estimate: true, price: unit, vat, total: vat * c.qty, kg: SPEC.kg, cuts: SPEC.pierces, bends: SPEC.bends, cutMm: SPEC.cutMm, surfaceM2: Math.round(surfaceM2 * 10000) / 10000 };
  }
  const api = { SPEC, FINISHES, FINISH_LABELS, DEFAULTS, DEFAULT_RATES, normalize, validate, describe, price, validEmail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JelenVelky = api;
})(typeof window !== 'undefined' ? window : globalThis);
