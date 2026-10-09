/* Dílna – konferenční stolečky: otevření poptávky, zámečky a plechy, řezný plán pro Bodor K2, výkresy, DXF, makro FreeCAD, postup.
   Načítá se v interni.html za stolecky-core.js. Zákaznická stránka (stolecky.html) nastavuje jen tvar, rozměry, profil, povrch a desku. */
(function (root) {
  'use strict';
  const S = root.Stolecky, $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const nf = (n) => Number(n).toLocaleString('cs-CZ', { maximumFractionDigits: 0 });
  const r2 = (v) => Math.round(v * 100) / 100;
  const LS = 'stolecky-retez';
  const FIELDS = [
    ['sink', 'Ponoření v háčku (prázdné = auto)', 0, 12, 1], ['weldGap', 'Vůle v háčku (jen bez ponoření)', 0, 3, 0.5],
    ['clear', 'Vůle výřezu pro čep', 0, 0.5, 0.05], ['tabMargin', 'Okraj čepu od hrany', 1, 8, 1],
    ['holeClear', 'Vůle otvorů v plechu', 0, 2, 0.1], ['baseT', 'Tloušťka plotny', 4, 25, 1], ['plT', 'Plech pod deskou', 3, 12, 1]
  ];
  let cfg = S.normalize({}), current = null, dls = null, rates = null, built = false;
  try { const st = JSON.parse(localStorage.getItem(LS) || 'null'); if (st) cfg = S.normalize(st); } catch (e) { /* bez paměti */ }

  /* ---------- výkresy ---------- */
  const poly = (pts, attr) => '<polygon points="' + pts.map((p) => r2(p[0]) + ',' + r2(p[1])).join(' ') + '" ' + attr + '/>';
  function svgBox(all, pad, extraH) {
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) + pad - x0, h = Math.max(...ys) + pad + extraH - y0;
    return { w, h, P: (p) => [p[0] - x0, p[1] - y0] };
  }
  function partSvg(p) {
    const f = p.flat, all = f.contour.concat(f.notch || []), b = svgBox(all, 8, 14);
    return '<figure><svg viewBox="0 0 ' + r2(b.w) + ' ' + r2(b.h) + '" role="img" aria-label="Díl ' + p.id + '" font-family="sans-serif">' +
      poly(f.contour.map(b.P), 'fill="#EEE9DF" stroke="#17181A" stroke-width="0.7" stroke-linejoin="round"') +
      (f.notch ? poly(f.notch.map(b.P), 'fill="none" stroke="#B8440F" stroke-width="0.5" stroke-dasharray="2 1.5"') : '') +
      (f.bites || []).map((q) => poly(q.map(b.P), 'fill="none" stroke="#B8440F" stroke-width="0.5"')).join('') +
      '<text x="' + r2(b.w / 2) + '" y="' + r2(b.h - 4) + '" text-anchor="middle" font-size="7" fill="#5E5A54">' + esc(p.ends[0]) + ' → ' + esc(p.ends[1]) + '</text></svg>' +
      '<figcaption><b>' + p.id + ' – ' + esc(p.name) + '</b>, ' + p.qty + ' ks, ' + fmt(p.lo) + ' / ' + fmt(p.li) + ' mm' + (f.bites && f.bites.length ? ', zámeček v háčku' : '') + '</figcaption></figure>';
  }
  function plateSvg(pl) {
    const b = svgBox(pl.outline, 6, 0), fl = (q) => q.map((p) => b.P([p[0], -p[1]]));
    return '<figure><svg viewBox="0 0 ' + r2(b.w) + ' ' + r2(b.h) + '" role="img" aria-label="' + pl.name + '">' +
      poly(fl(pl.outline), 'fill="#DAD6CE" stroke="#17181A" stroke-width="1.2"') +
      pl.holes.map((h) => poly(fl(h), 'fill="#FBFAF7" stroke="#17181A" stroke-width="1"')).join('') +
      pl.circles.map((c) => { const q = b.P([c[0], -c[1]]); return '<circle cx="' + r2(q[0]) + '" cy="' + r2(q[1]) + '" r="' + c[2] + '" fill="#FBFAF7" stroke="#17181A" stroke-width="1"/>'; }).join('') +
      '</svg><figcaption><b>' + pl.name + '</b> ' + pl.w + ' × ' + pl.w + ' × ' + pl.t + ' mm' + (pl.rot ? ' otočená o ' + pl.rot + '° (nohy do rohů)' : '') + ', ' + pl.holes.length + ' otvory pro nohy' + (pl.circles.length ? ', ' + pl.circles.length + ' díry Ø 7 na vruty do desky' : '') + ' (laser na plech)</figcaption></figure>';
  }
  async function download(name, text, type) {
    if (dls && dls.save) { try { await dls.save({ filename: name, data: new Blob([text], { type }) }); return; } catch (e) { /* zkusím obyčejné stažení */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function steps(B) {
    const G = B.G, c = B.cfg, midTip = G.zm - G.b - G.hp / (2 * Math.sin(G.g));
    const ids = (mid) => B.parts.filter((p) => (p.frame === 'mid') === mid).map((p) => p.qty + '× ' + p.id).join(', ');
    return [
      'Kosočtverec: 4 jekly (' + ids(true) + ') srazíš čepy do výřezů na rovném stole a svaříš všechny čtyři pokosy.',
      'Nohy: ze 4 jeklů (' + ids(false) + ') svaříš dvě „V“ – v hrotu zapadne čep do výřezu.',
      'Obě „V“ provlékni kosočtvercem: volný konec nohy prostrčíš otvorem kosočtverce a posuneš, až je hrot uvnitř. Dolní je hrotem nahoru („Λ“), horní hrotem dolů.',
      'Dolní nohy zasuň do otvorů v plotně (' + fmt(G.ins) + ' mm hluboko, plotna je otočená o 45°, nohy míří do rohů) a zavař zespodu v otvoru. Kosočtverec podlož pod spodní špičkou podložkou ' + fmt(midTip - c.baseT) + ' mm nad plotnou.',
      'Plech pod deskou podepři ' + fmt(c.H - c.topT - c.plT - c.baseT) + ' mm nad plotnou, horní nohy zasuň do jeho otvorů (lícují s horní plochou plechu) a zavař.',
      (B.sink > 0 ? 'V háčcích zapadnou články do zámečků (ponoření ' + fmt(B.sink) + ' mm) a dosednou na rovnou plošku – tam je svař, dole i nahoře.'
        : 'Svař články v místech, kde se dotýkají (dole i nahoře vždy dva styky po ' + fmt(G.hd) + ' mm).') + ' Řetěz sám v tlaku nedrží – bez těchto svarů by se pod deskou sesunul.',
      'Desku přišroubuj k plechu vruty přes 4 díry Ø 7.'
    ].map((t) => '<li>' + t + '</li>').join('');
  }

  /* ---------- formulář ---------- */
  function buildForm() {
    if (built) return;
    built = true;
    $('sFields').innerHTML = '<legend>Zámečky a plechy</legend>' + FIELDS.map(([k, l, lo, hi, st]) => '<label class="f" for="sf-' + k + '">' + l + ' [mm]<input id="sf-' + k + '" type="number" min="' + lo + '" max="' + hi + '" step="' + st + '"></label>').join('');
    FIELDS.forEach(([k]) => $('sf-' + k).addEventListener('change', (e) => {
      const v = e.target.value.trim();
      cfg = S.normalize(Object.assign({}, cfg, { [k]: k === 'sink' && v === '' ? 'auto' : Number(v) })); render();
    }));
    $('sEdit').addEventListener('click', () => { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) { /* bez paměti */ } location.href = 'stolecky.html'; });
    $('sCodeLoad').addEventListener('click', () => {
      try {
        const t = $('sCodeIn').value.trim().replace(/^STOLEK:/, '');
        cfg = S.normalize(JSON.parse(decodeURIComponent(escape(atob(t))))); current = null; render();
        $('sCodeMsg').textContent = 'Načteno: ' + S.describe(cfg);
      } catch (e) { $('sCodeMsg').textContent = 'Kód nejde přečíst – zkontroluj, že je zkopírovaný celý.'; }
    });
  }

  function render() {
    buildForm();
    const B = S.build(cfg), c = B.cfg, X = S.price(B, rates);
    FIELDS.forEach(([k]) => { const el = $('sf-' + k); if (document.activeElement !== el) el.value = k === 'sink' && c.sink === 'auto' ? '' : c[k]; });
    $('sf-sink').placeholder = 'auto (' + S.sinkMinOf(c) + ')';
    $('sf-weldGap').disabled = B.sink > 0;
    const it = current, cu = (it && it.customer) || {};
    $('sOrder').innerHTML = it ? '<b>' + esc(it.id) + '</b> · ' + esc(cu.name) + ' · ' + esc(cu.email) + (cu.phone ? ' · ' + esc(cu.phone) : '') + (cu.address ? '<br>' + esc(cu.address) : '') + (it.note ? '<br>„' + esc(it.note) + '“' : '')
      : '<span style="color:var(--muted)">Bez poptávky – podklady pro konfiguraci z konfigurátoru stolečků v tomto prohlížeči.</span>';
    $('sCfg').textContent = S.describe(c) + ' · plotna ' + c.baseW + ' × ' + c.baseW + ' × ' + c.baseT + ' · rozteč noh ' + c.spread + ' · ' + c.qty + ' ks';
    $('sPrice').textContent = nf(X.vat) + ' Kč s DPH / ks · ' + nf(X.price) + ' Kč bez DPH';
    $('sFacts').innerHTML = [['Kosočtverec (v × š)', fmt(B.size.midH) + ' × ' + fmt(B.size.midW)], ['Výška noh', fmt(B.size.legH) + ' mm'],
      ['V háčku', B.sink > 0 ? 'zámeček ' + fmt(B.sink) + ' mm' : B.gap < 0.05 ? 'dosedají' : 'vůle ' + fmt(B.gap) + ' mm'], ['Hmotnost', fmt(B.kgBars) + ' + ' + fmt(B.kgPlates) + ' kg']]
      .map(([a, b]) => '<div class="fact"><b>' + b + '</b><span>' + a + '</span></div>').join('');
    $('sWarns').innerHTML = B.warn.map((w) => '<div>' + esc(w) + '</div>').join('');
    $('sCut').innerHTML = B.parts.map((p) => '<tr><td class="mono">' + p.id + '</td><td>' + esc(p.name) + '</td><td class="num">' + p.qty * c.qty + '</td><td class="num">' + fmt(p.lo) + ' / ' + fmt(p.li) + '</td><td>' + esc(p.ends[0]) + '</td><td>' + esc(p.ends[1]) + '</td></tr>').join('') +
      '<tr><td colspan="6" style="color:var(--muted)">Jekl ' + c.prof.replace(/x/g, '×') + ', celkem ' + B.parts.reduce((s, p) => s + p.qty, 0) * c.qty + ' kusů' + (c.qty > 1 ? ' (' + c.qty + ' stolky)' : '') + '. Pokos = úhel řezu proti ose jeklu. Čep i výřez je v přední i zadní stěně' + (B.sink > 0 ? ', zámeček v háčku přes celou hloubku jeklu' : '') + '.</td></tr>';
    $('sFlats').innerHTML = B.parts.map(partSvg).join('') + plateSvg(B.plates.base) + plateSvg(B.plates.top);
    $('sDl').innerHTML = B.parts.map((p) => '<button type="button" class="btn" data-dxf="' + p.id + '">DXF ' + p.id + '</button>').join('') +
      '<button type="button" class="btn" data-pl="base">DXF plotna</button><button type="button" class="btn" data-pl="top">DXF plech pod deskou</button><button type="button" class="btn" data-fc="1">Makro FreeCAD</button>';
    $('sDl').querySelectorAll('[data-dxf]').forEach((b) => b.addEventListener('click', () => {
      const p = B.parts.find((q) => q.id === b.dataset.dxf);
      download('stolek-dil-' + p.id + '.dxf', S.dxf([{ layer: 'STENA', polys: [p.flat.contour] }]), 'application/dxf');
    }));
    $('sDl').querySelectorAll('[data-pl]').forEach((b) => b.addEventListener('click', () => {
      const pl = B.plates[b.dataset.pl];
      download('stolek-' + (b.dataset.pl === 'base' ? 'plotna' : 'plech-pod-deskou') + '.dxf', S.dxf([{ layer: 'OBRYS', polys: [pl.outline] }, { layer: 'OTVORY', polys: pl.holes, circles: pl.circles }]), 'application/dxf');
    }));
    $('sDl').querySelector('[data-fc]').addEventListener('click', () => download('stolek-retez.FCMacro', S.freecadMacro(c), 'text/plain'));
    $('sSteps').innerHTML = steps(B);
  }

  function open(it) { current = it; cfg = S.normalize(it.config); render(); }
  function init(o) { dls = o.dls || null; }
  function setRates(r) { rates = r; }

  root.StoDilna = { init, open, render, setRates, describe: S.describe };
})(typeof window !== 'undefined' ? window : globalThis);
