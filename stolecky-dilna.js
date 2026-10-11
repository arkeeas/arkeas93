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
    ['clear', 'Vůle zámečku v háčku', 0, 0.5, 0.05], 
    ['holeClear', 'Vůle otvorů v plechu', 0, 2, 0.1], ['baseT', 'Tloušťka plotny', 4, 25, 1], ['plT', 'Plech pod deskou', 3, 12, 1]
  ];
  let cfg = S.normalize({}), current = null, dls = null, rates = null, built = false, viewer = null, see = false;
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
      pl.circles.map((c) => { const q = b.P([c[0], -c[1]]); return (pl.csk ? '<circle cx="' + r2(q[0]) + '" cy="' + r2(q[1]) + '" r="' + pl.csk / 2 + '" fill="none" stroke="#B8440F" stroke-width="0.8" stroke-dasharray="2 1.5"/>' : '') + '<circle cx="' + r2(q[0]) + '" cy="' + r2(q[1]) + '" r="' + c[2] + '" fill="#FBFAF7" stroke="#17181A" stroke-width="1"/>'; }).join('') +
      (pl.studs || []).map((c) => { const q = b.P([c[0], -c[1]]); return '<g stroke="#B8440F" stroke-width="1"><circle cx="' + r2(q[0]) + '" cy="' + r2(q[1]) + '" r="4" fill="none"/><path d="M' + r2(q[0] - 7) + ' ' + r2(q[1]) + ' h14 M' + r2(q[0]) + ' ' + r2(q[1] - 7) + ' v14"/></g>'; }).join('') +
      '</svg><figcaption><b>' + pl.name + '</b> ' + (pl.shape === 'kruh' ? 'Ø ' + pl.w + ' × ' + pl.t : pl.shape === 'kriz' ? pl.w + ' × ' + pl.w + ' (kříž) × ' + pl.t : pl.w + ' × ' + pl.w + ' × ' + pl.t) + ' mm' + (pl.rot ? ' otočená o ' + pl.rot + '° (nohy do rohů)' : '') + ', ' + pl.holes.length + ' otvory pro nohy' + (pl.circles.length ? ', ' + pl.circles.length + ' díry Ø ' + fmt(pl.circles[0][2] * 2) + (pl.csk ? ' se zahloubením Ø ' + fmt(pl.csk) + ' (90°)' : '') + ' na uchycení desky' : '') + (pl.studs && pl.studs.length ? ', ' + pl.studs.length + '× navařit svorník M8×20' : '') + ' (laser na plech)</figcaption></figure>';
  }
  async function download(name, text, type) {
    if (dls && dls.save) { try { await dls.save({ filename: name, data: new Blob([text], { type }) }); return; } catch (e) { /* zkusím obyčejné stažení */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function steps(B) {
    const G = B.G, c = B.cfg, midTip = G.zm - G.b - G.hp / (2 * Math.sin(G.g));
    const ids = (mid) => B.parts.filter((p) => (p.frame === 'mid') === mid).map((p) => p.qty + '× ' + p.id).join(', ');
    return [
      'Kosočtverec: 4 jekly (' + ids(true) + ') slož na rovném stole pokosy k sobě (zámečky v háčku na špičkách) a svař všechny čtyři pokosy.',
      'Nohy: ze 4 jeklů (' + ids(false) + ') svař dvě „V“ – pokosy k sobě, zámečky na vnitřní straně hrotu.',
      'Obě „V“ provlékni kosočtvercem: volný konec nohy prostrčíš otvorem kosočtverce a posuneš, až je hrot uvnitř. Dolní je hrotem nahoru („Λ“), horní hrotem dolů.',
      'Dolní nohy zasuň do otvorů v plotně (' + fmt(G.ins) + ' mm hluboko, plotna je otočená o 45°, nohy míří do rohů) a zavař zespodu v otvoru. Kosočtverec podlož pod spodní špičkou podložkou ' + fmt(midTip - c.baseT) + ' mm nad plotnou.',
      'Plech pod deskou podepři ' + fmt(c.H - c.topT - c.plT - c.baseT) + ' mm nad plotnou, horní nohy zasuň do jeho otvorů (lícují s horní plochou plechu) a zavař.',
      (B.sink > 0 ? 'V háčcích zapadnou články do zámečků (ponoření ' + fmt(B.sink) + ' mm) a dosednou na rovnou plošku – tam je svař, dole i nahoře.'
        : 'Svař články v místech, kde se dotýkají (dole i nahoře vždy dva styky po ' + fmt(G.hd) + ' mm).') + ' Řetěz sám v tlaku nedrží – bez těchto svarů by se pod deskou sesunul.',
      (B.plates.top.studs.length ? 'Před povrchovou úpravou navař na horní plech ' + B.plates.top.studs.length + ' svorníky M8×20 (značky na výkresu).' : 'Uchycení desky: ' + B.mount.M.lab.toLowerCase() + ' – postup pro truhláře je na zákaznické stránce, materiál: ' + B.mount.hw.map((h) => h.q + '× ' + h.name).join(', ') + '.')
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
    if (root.StoViewer) viewer = root.StoViewer.create($('sviz'));
    document.querySelectorAll('[data-sview]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.sview === 'top' || b.dataset.sview === 'bottom') { see = true; $('sSee').checked = true; render(); } if (viewer) viewer.view(b.dataset.sview); }));
    $('sSee').addEventListener('change', (e) => { see = e.target.checked; render(); });
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
    $('sFields').hidden = B.model === 'motylek';
    FIELDS.forEach(([k]) => { const el = $('sf-' + k); if (document.activeElement !== el) el.value = k === 'sink' && c.sink === 'auto' ? '' : c[k]; });
    $('sf-sink').placeholder = 'auto (' + S.sinkMinOf(c) + ')';
    $('sf-weldGap').disabled = B.sink > 0;
    const it = current, cu = (it && it.customer) || {};
    $('sOrder').innerHTML = it ? '<b>' + esc(it.id) + '</b> · ' + esc(cu.name) + ' · ' + esc(cu.email) + (cu.phone ? ' · ' + esc(cu.phone) : '') + (cu.address ? '<br>' + esc(cu.address) : '') + (it.note ? '<br>„' + esc(it.note) + '“' : '')
      : '<span style="color:var(--muted)">Bez poptávky – podklady pro konfiguraci z konfigurátoru stolečků v tomto prohlížeči.</span>';
    if (B.model === 'motylek') {
      $('sCfg').textContent = S.describe(c) + ' · parametrická varianta';
      const ownTop = c.motylekTop === 'vlastni';
      $('sPriceTitle').textContent = ownTop ? 'Orientační cena podnože a úchytů, bez vlastní desky' : 'Orientační cena podle ceníku, včetně ocelové desky';
      $('sPrice').textContent = nf(X.vat) + ' Kč s DPH / ks · ' + nf(X.price) + ' Kč bez DPH';
      const deskFact = ownTop ? 'Vlastní dřevěná Ø' + c.topD + ' × ' + c.motylekTopT + ' mm' : 'Ocelová Ø ' + c.topD + ' mm';
      $('sFacts').innerHTML = [['Deska', deskFact], ['Výška', c.H + ' mm'], ['Plech', '4 mm'], ...(ownTop ? [['Uchycení', '4× drážka 18 × 5,5 mm']] : []), ['Odhad hmotnosti oceli', fmt(B.kg) + ' kg']]
        .map(([a, b]) => '<div class="fact"><b>' + b + '</b><span>' + a + '</span></div>').join('');
      $('sWarns').innerHTML = B.warn.map((w) => '<div>' + esc(w) + '</div>').join('') +
        '<div>Kontrola: výška se měří od podlahy po horní povrch. Podnože A/B se roztahují souměrně; středový zámek zůstává široký 4,3 mm.</div>' +
        (ownTop || c.H !== 500 || c.topD !== 600 ? '<div>Původní STEP je referenční pouze pro ocelovou variantu Ø600 × 500 mm; výrobní DXF níže se generují podle aktuální konfigurace.</div>' : '');
      $('sCutTitle').textContent = ownTop ? 'Výrobní díly – podnož a úchyty' : 'Výrobní díly – laserované plechy';
      $('sCut').innerHTML = [
        ['A', 'Motýlí podnož A, ocel 4 mm', c.qty],
        ['B', 'Motýlí podnož B, ocel 4 mm', c.qty],
        ...(ownTop ? [['U', 'Úchyt vlastní desky, ocel 4 mm', 4 * c.qty]] : [['1', 'Kruhová deska Ø ' + c.topD + ' mm, ocel 4 mm', c.qty]])
      ].map((p) => '<tr><td class="mono">' + p[0] + '</td><td>' + p[1] + '</td><td class="num">' + p[2] + '</td><td colspan="3">' +
        (p[0] === 'U' ? '4× rádiusová drážka pro vruty, výpal z dodaného DXF' : 'DXF přepočtené pro Ø ' + c.topD + ' × ' + c.H + ' mm') + '</td></tr>').join('') +
        '<tr><td colspan="6" style="color:var(--muted)">Obrysy vycházejí z původních DXF; výška a průměr se přepočítají, šířka zámku zůstává podle zdroje.</td></tr>';
      $('sFlatsTitle').textContent = 'Zdrojové CAD soubory';
      $('sFlats').innerHTML = '<figure class="wide"><figcaption><b>STEP sestava</b> je zdrojový model s ocelovou deskou Ø600 × 500 mm. Pro variantu s vlastní deskou použijte její výrobní DXF úchytů a přepočtené DXF podnoží; náhled odpovídá zvolené konfiguraci.</figcaption></figure>';
      $('sDl').innerHTML = B.productFiles.map((f) => f.part
        ? '<button type="button" class="btn" data-motylek-part="' + esc(f.part) + '"' + (f.path ? ' data-source="' + esc(f.path) + '"' : '') + '>' + esc(f.label) + '</button>'
        : '<a class="btn" href="' + esc(f.path) + '" download title="Zdrojový model, rozměr Ø600 × 500 mm">' + esc(f.label) + '</a>').join('');
      $('sDl').querySelectorAll('[data-motylek-part]').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const part = button.dataset.motylekPart;
          let output;
          if (part === 'uchyty') output = S.motylekMountTabDxf();
          else {
            const res = await fetch(button.dataset.source);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            output = S.transformMotylekDxf(await res.text(), part, c);
          }
          const name = part === 'deska' ? 'motylek-deska-D' + c.topD + 'mm.dxf'
            : part === 'uchyty' ? 'motylek-uchyt-vlastni-desky-4x.dxf'
              : 'motylek-podnoz-' + part + '-H' + c.H + '-D' + c.topD + 'mm.dxf';
          await download(name, output, 'application/dxf');
        } catch (error) {
          $('sWarns').innerHTML += '<div>DXF se nepodařilo připravit. Zkuste stránku načíst znovu.</div>';
        } finally { button.disabled = false; }
      }));
      $('sSteps').innerHTML = ownTop ? [
        'Z DXF podnoží A/B vyříznout oba díly a z DXF úchytu vypálit 4 stejné úchyty z plechu 4 mm. Vlastní dřevěná deska Ø ' + c.topD + ' × ' + c.motylekTopT + ' mm není součástí dodávky.',
        'Sestavit kolmé podnože A/B; jejich středový zámek má šířku 4,3 mm. Úchyty přiložit na horní konce podnoží v osových polohách ±' + fmt(B.mountTabs[0].x) + ' mm od středu a přivařit.',
        'Podnož s úchyty končí pod deskou ve výšce ' + (c.H - c.motylekTopT) + ' mm. Dřevěnou desku vystředit a připevnit čtyřmi vruty do dřeva (nejsou v ceně) přes radiální drážky; délku vrutů zvolit podle tloušťky desky tak, aby neprošly skrz.'
      ] : [
        'Vyříznout kruhovou desku Ø ' + c.topD + ' mm a podnože A/B z právě stažených DXF souborů.',
        'Sestavit kolmé podnože A/B; jejich středový zámek má šířku 4,3 mm podle původního CAD.',
        'Přiložit podnož k rubu desky tak, aby horní hrany lícovaly s její spodní plochou ve výšce ' + (c.H - 4) + ' mm, a dokončit svarové spoje.'
      ].map((t) => '<li>' + t + '</li>').join('');
      if (viewer) { viewer.update(B, { see, showDesk: true }); requestAnimationFrame(() => viewer.view()); }
      return;
    }
    $('sPriceTitle').textContent = 'Cena (podle ceníku podnoží, bez desky)';
    $('sCutTitle').textContent = 'Řezný plán – jekly pro Bodor K2';
    $('sFlatsTitle').textContent = 'Stěny jeklů a plechy';
    $('sCfg').textContent = S.describe(c) + ' · plotna ' + c.baseW + ' × ' + c.baseW + ' × ' + c.baseT + ' · rozteč noh ' + c.spread + ' · ' + c.qty + ' ks';
    $('sPrice').textContent = nf(X.vat) + ' Kč s DPH / ks · ' + nf(X.price) + ' Kč bez DPH';
    $('sFacts').innerHTML = [['Kosočtverec (v × š)', fmt(B.size.midH) + ' × ' + fmt(B.size.midW)], ['Výška noh', fmt(B.size.legH) + ' mm'],
      ['V háčku', B.sink > 0 ? 'zámeček ' + fmt(B.sink) + ' mm' : B.gap < 0.05 ? 'dosedají' : 'vůle ' + fmt(B.gap) + ' mm'], ['Hmotnost', fmt(B.kgBars) + ' + ' + fmt(B.kgPlates) + ' kg']]
      .map(([a, b]) => '<div class="fact"><b>' + b + '</b><span>' + a + '</span></div>').join('');
    $('sWarns').innerHTML = B.warn.map((w) => '<div>' + esc(w) + '</div>').join('');
    $('sCut').innerHTML = B.parts.map((p) => '<tr><td class="mono">' + p.id + '</td><td>' + esc(p.name) + '</td><td class="num">' + p.qty * c.qty + '</td><td class="num">' + fmt(p.lo) + ' / ' + fmt(p.li) + '</td><td>' + esc(p.ends[0]) + '</td><td>' + esc(p.ends[1]) + '</td></tr>').join('') +
      '<tr><td colspan="6" style="color:var(--muted)">Jekl ' + c.prof.replace(/x/g, '×') + ', celkem ' + B.parts.reduce((s, p) => s + p.qty, 0) * c.qty + ' kusů' + (c.qty > 1 ? ' (' + c.qty + ' stolky)' : '') + '. Pokos = úhel řezu proti ose jeklu, rohy jsou jen pokos (nic nepřečuhuje)' + (B.sink > 0 ? ', zámeček v háčku = zářez přes celou hloubku jeklu' : '') + '.</td></tr>';
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
    if (viewer) { viewer.update(B, { see, showDesk: true }); requestAnimationFrame(() => viewer.view()); }
  }

  function open(it) { current = it; cfg = S.normalize(it.config); render(); }
  function init(o) { dls = o.dls || null; }
  function setRates(r) { rates = r; }

  root.StoDilna = { init, open, render, setRates, describe: S.describe };
})(typeof window !== 'undefined' ? window : globalThis);
