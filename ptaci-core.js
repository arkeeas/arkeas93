/* Ptačí věšáky z plechu (C2 + 2 ohyby): pevná velikost, výběr pózy, orientační cena. */
(function (root) {
  'use strict';
  const FINISHES = ['black', 'anth', 'white', 'raw'];
  const FINISH_LABELS = { black: 'Černá mat', anth: 'Antracit', white: 'Bílá', raw: 'Ocel + lak' };
  // Pevná velikost: největší rozměr siluety 160 mm, plech S235 4 mm, jazýček / háček 22 mm.
  const SIZE = { span: 160, t: 4, tongueW: 22 };
  // Hodnoty z ověřeného běhu ptaci_fc.py ve FreeCADu (nastroje/ptaci/README.md): rozvin [mm], hmotnost [kg], délka řezu [mm].
  const POSES = {
    vzlet: { label: 'Vzlet – obě křídla nahoru', flat: [150, 229], kg: 0.29, cutMm: 884 },
    mavnuti: { label: 'Mávnutí – křídlo nahoru a dolů', flat: [147, 217], kg: 0.24, cutMm: 824 },
    plachteni: { label: 'Plachtění – křídla roztažená', flat: [152, 202], kg: 0.22, cutMm: 789 },
    klouzani: { label: 'Klouzání – křídla dozadu', flat: [152, 204], kg: 0.27, cutMm: 846 }
  };
  // Pálení: 1 vnější obrys + 2 díry na vruty + 2 drážky v ohybech = 5 průstřelů; ohyby 2×.
  const BASIS = { pierces: 5, bends: 2, steelKgPerMm3: 7.85e-6 };
  const DEFAULTS = { pose: 'vzlet', finish: 'black', qty: 1 };
  // `ohyb` zatím není v dílenském ceníku – výchozí hodnota je odhad, ať se dá cena spočítat.
  const DEFAULT_RATES = { kg: 42, rez: 35, svar: 90, barva: 280, priprava: 600, marze: 35, ohyb: 30 };

  const whole = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
  function normalize(config) {
    const c = config || {};
    return {
      pose: Object.prototype.hasOwnProperty.call(POSES, c.pose) ? c.pose : DEFAULTS.pose,
      finish: FINISHES.includes(c.finish) ? c.finish : DEFAULTS.finish,
      qty: whole(c.qty, DEFAULTS.qty)
    };
  }
  function validate(config) {
    const c = config || {}, errors = [];
    if (!Object.prototype.hasOwnProperty.call(POSES, c.pose)) errors.push('Vyberte pózu ptáka.');
    if (c.finish != null && !FINISHES.includes(c.finish)) errors.push('Vyberte platný povrch.');
    const qty = Number(c.qty);
    if (c.qty == null || c.qty === '' || !Number.isSafeInteger(qty) || qty < 1) errors.push('Počet kusů musí být celé číslo alespoň 1.');
    return { ok: errors.length === 0, errors };
  }
  function describe(config) {
    const c = normalize(config);
    return 'Ptačí věšák · ' + POSES[c.pose].label + ' · ' + SIZE.span + ' mm · ' + FINISH_LABELS[c.finish] + ' · ' + c.qty + ' ks';
  }
  function validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); }
  function price(config, rates) {
    const c = normalize(config), pose = POSES[c.pose], R = Object.assign({}, DEFAULT_RATES, rates || {});
    const areaMm2 = pose.kg / BASIS.steelKgPerMm3 / SIZE.t;          // plocha plechu (včetně rozvinutého jazýčku)
    const surfaceM2 = (2 * areaMm2 + pose.cutMm * SIZE.t) / 1e6;       // obě strany + hrany
    const finishFactor = c.finish === 'raw' ? 0.7 : 1;
    // Příprava zakázky se rozpočítá na kusy – u věšáků se vyrábí víc kusů najednou.
    const unitCost = pose.kg * R.kg + BASIS.pierces * R.rez + BASIS.bends * R.ohyb + surfaceM2 * R.barva * finishFactor + R.priprava / c.qty;
    const unitPrice = Math.round(unitCost * (1 + R.marze / 100) / 10) * 10;
    const unitVat = Math.round(unitPrice * 1.21 / 10) * 10;
    return { estimate: true, price: unitPrice, vat: unitVat, total: unitVat * c.qty, kg: pose.kg, cuts: BASIS.pierces, bends: BASIS.bends, cutMm: pose.cutMm, surfaceM2: Math.round(surfaceM2 * 10000) / 10000, finishFactor };
  }
  const api = { SIZE, POSES, BASIS, FINISHES, FINISH_LABELS, DEFAULTS, DEFAULT_RATES, normalize, validate, describe, price, validEmail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ptaci = api;
})(typeof window !== 'undefined' ? window : globalThis);
