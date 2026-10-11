/* Configuration and illustrative geometry for butterfly privacy screens. */
(function (root) {
  'use strict';
  const FINISHES = ['black', 'anth', 'white', 'raw'];
  const DEFAULTS = { width: 800, height: 2000, finish: 'black', qty: 1 };
  const DEFAULT_RATES = { kg: 42, rez: 35, svar: 90, barva: 280, priprava: 600, marze: 35 };
  const PRICE_BASIS = { kg: 29.05, cuts: 188, welds: 6, panelSurfaceM2: 2.0435302, frameSurfaceM2: 0.8704, platesSurfaceM2: 0.01936 };
  function normalize(config) {
    const c = config || {};
    const whole = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
    return {
      width: whole(c.width, DEFAULTS.width),
      height: whole(c.height, DEFAULTS.height),
      finish: FINISHES.includes(c.finish) ? c.finish : DEFAULTS.finish,
      qty: whole(c.qty, DEFAULTS.qty)
    };
  }
  function validate(config) {
    const c = config || {}, errors = [];
    ['width', 'height'].forEach((key) => {
      const n = Number(c[key]);
      if (c[key] == null || c[key] === '' || !Number.isFinite(n) || !Number.isSafeInteger(n) || n <= 0) errors.push(key + ' musí být kladné celé číslo.');
    });
    const qty = Number(c.qty);
    if (c.qty == null || c.qty === '' || !Number.isFinite(qty) || !Number.isSafeInteger(qty) || qty < 1) errors.push('Počet kusů musí být celé číslo alespoň 1.');
    if (c.finish != null && !FINISHES.includes(c.finish)) errors.push('Vyberte platný povrch.');
    return { ok: errors.length === 0, errors };
  }
  function layout(config) {
    const c = normalize(config), rail = Math.min(40, c.width / 5, c.height / 3);
    const lowerClearance = Math.min(150, Math.max(0, c.height - 3 * rail));
    const panel = { x: rail, z: lowerClearance + rail, width: Math.max(1, c.width - 2 * rail), height: Math.max(1, c.height - lowerClearance - 2 * rail) };
    const art = root.ZastenyArtwork || {};
    const sheet = art.sheet_mm || [720, 1770];
    const scale = Math.min(panel.width / sheet[0], panel.height / sheet[1]);
    const motifWidth = sheet[0] * scale, motifHeight = sheet[1] * scale;
    return {
      outer: { width: c.width, height: c.height, depth: 100 }, panel,
      frame: [
        { x: rail, z: c.height - rail, width: Math.max(1, c.width - 2 * rail), height: rail },
        { x: rail, z: lowerClearance, width: Math.max(1, c.width - 2 * rail), height: rail },
        { x: 0, z: 0, width: rail, height: c.height },
        { x: c.width - rail, z: 0, width: rail, height: c.height }
      ],
      motif: { scale, x: panel.x + (panel.width - motifWidth) / 2, z: panel.z + (panel.height - motifHeight) / 2, width: motifWidth, height: motifHeight }
    };
  }
  function validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); }
  function describe(config) {
    const c = normalize(config), labels = { black: 'Černá mat', anth: 'Antracit', white: 'Bílá', raw: 'Ocel + lak' };
    return 'Zástěna Motýli · ' + c.width + ' × ' + c.height + ' mm · ' + labels[c.finish] + ' · ' + c.qty + ' ks';
  }
  function price(config, rates) {
    const c = normalize(config), source = config || {};
    if (Number(source.width) !== 800 || Number(source.height) !== 2000) return null;
    const R = Object.assign({}, DEFAULT_RATES, rates || {}), finishFactor = c.finish === 'raw' ? 0.7 : 1;
    const surfaceM2 = PRICE_BASIS.panelSurfaceM2 + PRICE_BASIS.frameSurfaceM2 + PRICE_BASIS.platesSurfaceM2;
    const cost = PRICE_BASIS.kg * R.kg + PRICE_BASIS.cuts * R.rez + PRICE_BASIS.welds * R.svar + surfaceM2 * R.barva * finishFactor + R.priprava;
    const unitPrice = Math.round(cost * (1 + R.marze / 100) / 10) * 10;
    const unitVat = Math.round(unitPrice * 1.21 / 10) * 10;
    return { estimate: true, price: unitPrice, vat: unitVat, total: unitVat * c.qty, kg: PRICE_BASIS.kg, cuts: PRICE_BASIS.cuts, welds: PRICE_BASIS.welds, surfaceM2, finishFactor };
  }
  const api = { DEFAULTS, DEFAULT_RATES, PRICE_BASIS, FINISHES, normalize, validate, layout, describe, price, validEmail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Zasteny = api;
})(typeof window !== 'undefined' ? window : globalThis);
