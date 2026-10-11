/* Configuration and illustrative geometry for butterfly privacy screens. */
(function (root) {
  'use strict';
  const FINISHES = ['black', 'anth', 'white', 'raw'];
  const DEFAULTS = { width: 800, height: 2000, finish: 'black', qty: 1 };
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
    const c = normalize(config), wall = Math.min(40, c.width / 5, c.height / 10), rail = Math.min(40, wall);
    const panel = { x: wall, z: wall + 40, width: Math.max(1, c.width - 2 * wall), height: Math.max(1, c.height - 2 * wall - 60) };
    const art = root.ZastenyArtwork || {};
    const sheet = art['sheet_mm'] || art.sheet_mm || [720, 1770];
    const scale = Math.min(panel.width / sheet[0], panel.height / sheet[1]);
    const motifWidth = sheet[0] * scale, motifHeight = sheet[1] * scale;
    return {
      outer: { width: c.width, height: c.height, depth: 100 }, panel,
      frame: [
        { x: 0, z: 0, width: c.width, height: rail },
        { x: 0, z: c.height - rail, width: c.width, height: rail },
        { x: 0, z: rail, width: rail, height: c.height - 2 * rail },
        { x: c.width - rail, z: rail, width: rail, height: c.height - 2 * rail }
      ],
      motif: { scale, x: panel.x + (panel.width - motifWidth) / 2, z: panel.z + (panel.height - motifHeight) / 2, width: motifWidth, height: motifHeight }
    };
  }
  function validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); }
  function describe(config) {
    const c = normalize(config), labels = { black: 'Černá mat', anth: 'Antracit', white: 'Bílá', raw: 'Ocel + lak' };
    return 'Zástěna Motýli · ' + c.width + ' × ' + c.height + ' mm · ' + labels[c.finish] + ' · ' + c.qty + ' ks';
  }
  const api = { DEFAULTS, FINISHES, normalize, validate, layout, describe, validEmail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Zasteny = api;
})(typeof window !== 'undefined' ? window : globalThis);
