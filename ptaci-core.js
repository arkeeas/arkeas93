/* Ptačí věšáky z plechu (C2 + 2 ohyby): pevná velikost, výběr pózy, orientační cena. */
(function (root) {
  'use strict';
  const FINISHES = ['black', 'anth', 'white', 'raw'];
  const FINISH_LABELS = { black: 'Černá mat', anth: 'Antracit', white: 'Bílá', raw: 'Ocel + lak' };
  // Pevná velikost: největší rozměr siluety 160 mm, plech S235 4 mm, jazýček / háček 22 mm.
  const SIZE = { span: 160, t: 4, tongueW: 22 };
  // Hodnoty ze skutečného běhu ptaci_fc.py ve FreeCADu (assets/ptaci/souhrn.json): rozvin [mm], hmotnost [kg], délka řezu [mm].
  const POSES = {
    vzlet: { label: 'Vzlet – obě křídla nahoru', flat: [150.3, 229.4], kg: 0.278, cutMm: 961 },
    mavnuti: { label: 'Mávnutí – křídlo nahoru a dolů', flat: [146.9, 217.2], kg: 0.231, cutMm: 901 },
    plachteni: { label: 'Plachtění – křídla roztažená', flat: [152, 201.5], kg: 0.208, cutMm: 866 },
    klouzani: { label: 'Klouzání – křídla dozadu', flat: [152.1, 203.8], kg: 0.26, cutMm: 923 }
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
    if (config && config.layout) return describeLayout(config.layout);
    const c = normalize(config);
    return 'Ptačí věšák · ' + POSES[c.pose].label + ' · ' + SIZE.span + ' mm · ' + FINISH_LABELS[c.finish] + ' · ' + c.qty + ' ks';
  }
  function validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); }
  // Jednotková cena kusu; příprava zakázky se dělí mezi `share` kusů celé objednávky.
  function unit(c, R, share) {
    const pose = POSES[c.pose];
    const areaMm2 = pose.kg / BASIS.steelKgPerMm3 / SIZE.t;          // plocha plechu (včetně rozvinutého jazýčku)
    const surfaceM2 = (2 * areaMm2 + pose.cutMm * SIZE.t) / 1e6;       // obě strany + hrany
    const finishFactor = c.finish === 'raw' ? 0.7 : 1;
    const cost = pose.kg * R.kg + BASIS.pierces * R.rez + BASIS.bends * R.ohyb + surfaceM2 * R.barva * finishFactor + R.priprava / share;
    const price = Math.round(cost * (1 + R.marze / 100) / 10) * 10;
    return { price, vat: Math.round(price * 1.21 / 10) * 10, surfaceM2, finishFactor };
  }
  function price(config, rates) {
    const c = normalize(config), pose = POSES[c.pose], R = Object.assign({}, DEFAULT_RATES, rates || {});
    const u = unit(c, R, c.qty);
    return { estimate: true, price: u.price, vat: u.vat, total: u.vat * c.qty, kg: pose.kg, cuts: BASIS.pierces, bends: BASIS.bends, cutMm: pose.cutMm, surfaceM2: Math.round(u.surfaceM2 * 10000) / 10000, finishFactor: u.finishFactor };
  }

  /* ---------- rozložení na stěně: více kusů (různé pózy a povrchy) v jedné objednávce ---------- */
  const WALL_LIMITS = { minW: 300, maxW: 6000, minH: 300, maxH: 4000, maxPieces: 40, defaultW: 1000, defaultH: 700 };
  const num = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null;
  const clampNum = (v, lo, hi, fb) => { const n = num(v); return n == null ? fb : Math.min(hi, Math.max(lo, n)); };
  function normalizeLayout(layout) {
    const l = layout || {}, w = l.wall || {}, L = WALL_LIMITS;
    const pieces = (Array.isArray(l.pieces) ? l.pieces : []).slice(0, L.maxPieces).map((p) => {
      const q = p || {};
      return {
        pose: Object.prototype.hasOwnProperty.call(POSES, q.pose) ? q.pose : DEFAULTS.pose,
        finish: FINISHES.includes(q.finish) ? q.finish : DEFAULTS.finish,
        x: Math.round(clampNum(q.x, -1e5, 1e5, 0)), y: Math.round(clampNum(q.y, -1e5, 1e5, 0))
      };
    });
    return { wall: { w: Math.round(clampNum(w.w, L.minW, L.maxW, L.defaultW)), h: Math.round(clampNum(w.h, L.minH, L.maxH, L.defaultH)) }, pieces };
  }
  function validateLayout(layout) {
    const l = layout || {}, L = WALL_LIMITS, errors = [];
    const w = l.wall || {}, ww = num(w.w), wh = num(w.h);
    if (ww == null || ww < L.minW || ww > L.maxW || wh == null || wh < L.minH || wh > L.maxH) errors.push('Rozměr stěny musí být ' + L.minW + '–' + L.maxW + ' × ' + L.minH + '–' + L.maxH + ' mm.');
    const pieces = Array.isArray(l.pieces) ? l.pieces : [];
    if (!pieces.length) errors.push('Přidejte na stěnu alespoň jednoho ptáka.');
    if (pieces.length > L.maxPieces) errors.push('Na jednu stěnu lze přidat nejvýše ' + L.maxPieces + ' kusů.');
    if (pieces.some((p) => !p || !Object.prototype.hasOwnProperty.call(POSES, p.pose) || !FINISHES.includes(p.finish) || num(p.x) == null || num(p.y) == null)) errors.push('Některý z ptáků má neplatnou pózu, povrch nebo polohu.');
    return { ok: errors.length === 0, errors };
  }
  // Seskupí kusy podle (póza, povrch) – to je i podklad pro cenu a výrobu.
  function groupPieces(layout) {
    const map = new Map();
    normalizeLayout(layout).pieces.forEach((p) => { const k = p.pose + '|' + p.finish; if (!map.has(k)) map.set(k, { pose: p.pose, finish: p.finish, qty: 0 }); map.get(k).qty++; });
    return [...map.values()];
  }
  function describeLayout(layout) {
    const n = normalizeLayout(layout), groups = groupPieces(n);
    return 'Ptačí věšáky · rozložení na stěně ' + n.wall.w + ' × ' + n.wall.h + ' mm · ' + n.pieces.length + ' ks (' + groups.map((g) => g.qty + '× ' + POSES[g.pose].label.split(' – ')[0] + ', ' + FINISH_LABELS[g.finish]).join('; ') + ')';
  }
  function priceLayout(layout, rates) {
    const R = Object.assign({}, DEFAULT_RATES, rates || {}), groups = groupPieces(layout), qty = groups.reduce((s, g) => s + g.qty, 0);
    const t = { estimate: true, qty, price: 0, vat: 0, total: 0, kg: 0, cuts: 0, bends: 0, cutMm: 0, surfaceM2: 0, groups: [] };
    groups.forEach((g) => {
      const u = unit(g, R, qty), pose = POSES[g.pose];
      t.groups.push({ pose: g.pose, finish: g.finish, qty: g.qty, price: u.price, vat: u.vat });
      t.price += u.price * g.qty; t.vat += u.vat * g.qty; t.total += u.vat * g.qty;
      t.kg += pose.kg * g.qty; t.cuts += BASIS.pierces * g.qty; t.bends += BASIS.bends * g.qty; t.cutMm += pose.cutMm * g.qty; t.surfaceM2 += u.surfaceM2 * g.qty;
    });
    t.kg = Math.round(t.kg * 1000) / 1000; t.surfaceM2 = Math.round(t.surfaceM2 * 10000) / 10000;
    return t;
  }
  const api = { SIZE, POSES, BASIS, FINISHES, FINISH_LABELS, DEFAULTS, DEFAULT_RATES, WALL_LIMITS, normalize, validate, describe, price, validEmail, normalizeLayout, validateLayout, groupPieces, describeLayout, priceLayout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ptaci = api;
})(typeof window !== 'undefined' ? window : globalThis);
