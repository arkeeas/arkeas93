/* Stránka Ostatní: přepínač výrobků (zástěna Motýli, ptačí věšák), cena, poptávka do dílny. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const nf = (n) => new Intl.NumberFormat('cs-CZ').format(n);
  const FIXED = { width: 800, height: 2000 };            // zástěna se vyrábí jen v jedné variantě
  let product = 'zastena', mode = 'kus', viewerZ = null, viewerP = null, db = null, uid = null;
  let rates = Object.assign({}, Zasteny.DEFAULT_RATES);

  const msg = (html, kind) => { const el = $(product === 'ptak' ? (mode === 'stena' ? 'sMessage' : 'pMessage') : 'message'); el.innerHTML = html; el.className = 'message ' + (kind || ''); el.hidden = false; };
  const codeFor = (item) => btoa(unescape(encodeURIComponent(JSON.stringify(item))));

  /* ---------- zástěna ---------- */
  const configZ = () => ({ width: FIXED.width, height: FIXED.height, finish: $('finish').value, qty: $('qty').value === '' ? '' : Number($('qty').value) });
  function updateZ() {
    const c = configZ(), v = Zasteny.validate(c), p = v.ok ? Zasteny.price(c, rates) : null;
    $('summary').textContent = Zasteny.describe(c);
    $('priceBox').innerHTML = p
      ? '<strong>Orientačně ' + nf(p.total) + ' Kč s DPH</strong><br>' + nf(p.price) + ' Kč bez DPH / ks · ' + nf(p.vat) + ' Kč s DPH / ks · cena pro ' + c.qty + ' ks<br><span class="muted">Výpočet používá dílenský ceník, ' + String(p.kg).replace('.', ',') + ' kg, ' + p.cuts + ' řezů a odhad plochy a svarů. Konečnou cenu potvrdí dílna.</span>'
      : '<strong>Zadejte počet kusů.</strong>';
    if (v.ok && viewerZ) viewerZ.update(c);
  }

  /* ---------- ptačí věšák ---------- */
  const configP = () => ({ pose: $('pPose').value, finish: $('pFinish').value, qty: $('pQty').value === '' ? '' : Number($('pQty').value) });
  function updateP() {
    const c = configP(), v = Ptaci.validate(c), p = v.ok ? Ptaci.price(c, rates) : null;
    $('pSummary').textContent = Ptaci.describe(c);
    $('pPriceBox').innerHTML = p
      ? '<strong>Orientačně ' + nf(p.total) + ' Kč s DPH</strong><br>' + nf(p.price) + ' Kč bez DPH / ks · ' + nf(p.vat) + ' Kč s DPH / ks · cena pro ' + c.qty + ' ks<br><span class="muted">Výpočet používá dílenský ceník, ' + String(p.kg).replace('.', ',') + ' kg, ' + p.cuts + ' průstřelů pálení a ' + p.bends + ' ohyby. Konečnou cenu potvrdí dílna.</span>'
      : '<strong>Zadejte počet kusů.</strong>';
    if (v.ok && viewerP) viewerP.update(c);
  }


  /* ---------- ptáci na stěně ---------- */
  const S = window.PtaciStena, ART = window.PtaciArtwork, POSE_NAME = (k) => Ptaci.POSES[k].label.split(' – ')[0];
  let layout = S.emptyLayout(), sel = null, wallKey = 'light';
  const FIN = Ptaci.FINISH_LABELS;
  const hostW = () => $('wallHost');
  function renderWall() { hostW().innerHTML = S.svg(layout, { art: ART, selected: sel, wall: wallKey }); }
  function markWall() {   // jen přebarví kusy podle kolizí (při tažení nepřekreslujeme celé SVG)
    const st = S.status(layout, ART), bad = new Set(st.overlap.flatMap((h) => [h.a, h.b]).concat(st.outside)), near = new Set(st.close.flatMap((h) => [h.a, h.b]));
    hostW().querySelectorAll('.bird').forEach((g) => { const i = Number(g.dataset.i); g.classList.toggle('bad', bad.has(i)); g.classList.toggle('near', !bad.has(i) && near.has(i)); g.classList.toggle('sel', i === sel); });
    return st;
  }
  function updateS() {
    const st = S.status(layout, ART), v = Ptaci.validateLayout(layout);
    $('sList').innerHTML = layout.pieces.map((p, i) => '<li data-i="' + i + '"' + (i === sel ? ' class="sel"' : '') + '><span class="n">' + (i + 1) + '</span><span>' + POSE_NAME(p.pose) + '</span><select data-fin aria-label="Povrch ptáka ' + (i + 1) + '">' +
      Ptaci.FINISHES.map((f) => '<option value="' + f + '"' + (f === p.finish ? ' selected' : '') + '>' + FIN[f] + '</option>').join('') + '</select><button type="button" data-del aria-label="Odebrat ptáka ' + (i + 1) + '">×</button></li>').join('') || '<li style="grid-template-columns:1fr;cursor:default" class="muted">Stěna je zatím prázdná – přidejte prvního ptáka.</li>';
    $('sPos').hidden = sel == null || !layout.pieces[sel];
    if (!$('sPos').hidden) { $('sX').value = layout.pieces[sel].x; $('sY').value = layout.pieces[sel].y; }
    const w = $('wallWarn'), msgs = [];
    if (st.errors.length) msgs.push(st.errors.join(' '));
    else if (st.close.length) msgs.push('Někteří ptáci jsou blíž než ' + S.GAP + ' mm od sebe (oranžově) – bude těsno na montáž i na lak.');
    w.hidden = !msgs.length; w.className = 'wwarn' + (st.errors.length ? '' : ' wnear'); w.textContent = msgs.join(' ');
    $('sSummary').textContent = layout.pieces.length ? Ptaci.describeLayout(layout) : 'Stěna ' + layout.wall.w + ' × ' + layout.wall.h + ' mm bez ptáků.';
    if (v.ok) {
      const p = Ptaci.priceLayout(layout, rates);
      $('sPriceBox').innerHTML = '<strong>Orientačně ' + nf(p.total) + ' Kč s DPH</strong><br>' + p.qty + ' ks · průměrně ' + nf(Math.round(p.total / p.qty)) + ' Kč s DPH / ks · ' + nf(p.price) + ' Kč bez DPH celkem<br>' +
        p.groups.map((g) => g.qty + '× ' + POSE_NAME(g.pose) + ', ' + FIN[g.finish] + ': ' + nf(g.vat) + ' Kč s DPH / ks').join('<br>') +
        '<br><span class="muted">' + String(p.kg).replace('.', ',') + ' kg oceli, ' + p.cuts + ' průstřelů pálení a ' + p.bends + ' ohybů. Konečnou cenu potvrdí dílna.</span>';
    } else $('sPriceBox').innerHTML = '<strong>' + v.errors.join(' ') + '</strong>';
  }
  function setLayout(next, keepSel) {
    const n = Ptaci.normalizeLayout(next);
    n.pieces = n.pieces.map((p) => S.clampPiece(ART, p, n.wall));
    layout = n; if (!keepSel || sel == null || sel >= layout.pieces.length) sel = keepSel && sel != null && sel < layout.pieces.length ? sel : null;
    $('sW').value = layout.wall.w; $('sH').value = layout.wall.h;
    renderWall(); updateS();
  }
  function select(i) { sel = i; markWall(); updateS(); }
  function movePiece(i, x, y, final) {
    const p = S.clampPiece(ART, { pose: layout.pieces[i].pose, x: S.snap(x), y: S.snap(y) }, layout.wall);
    layout.pieces[i] = Object.assign({}, layout.pieces[i], { x: p.x, y: p.y });
    const g = hostW().querySelector('.bird[data-i="' + i + '"]');
    if (final || !g) { renderWall(); updateS(); return; }
    g.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ')'); markWall();
  }
  function wallPoint(ev) {
    const svg = hostW().querySelector('svg'), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x, y: layout.wall.h - q.y };
  }
  let drag = null;
  hostW().addEventListener('pointerdown', (ev) => {
    const g = ev.target.closest && ev.target.closest('.bird');
    if (!g) { if (sel != null) { sel = null; markWall(); updateS(); } return; }
    const i = Number(g.dataset.i), pt = wallPoint(ev);
    drag = { i, dx: layout.pieces[i].x - pt.x, dy: layout.pieces[i].y - pt.y, moved: false };
    try { g.setPointerCapture(ev.pointerId); } catch (e) { /* starší prohlížeče */ }
    if (sel !== i) select(i);
    ev.preventDefault();
  });
  hostW().addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const pt = wallPoint(ev); drag.moved = true; movePiece(drag.i, pt.x + drag.dx, pt.y + drag.dy, false);
  });
  const endDrag = () => { if (!drag) return; const d = drag; drag = null; if (d.moved) { renderWall(); updateS(); } };
  hostW().addEventListener('pointerup', endDrag); hostW().addEventListener('pointercancel', endDrag);
  hostW().addEventListener('keydown', (ev) => {
    if (sel == null || !layout.pieces[sel]) return;
    const step = ev.shiftKey ? 25 : 5, p = layout.pieces[sel], d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[ev.key];
    if (d) { ev.preventDefault(); movePiece(sel, p.x + d[0], p.y + d[1], true); }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); const i = sel; setLayout({ wall: layout.wall, pieces: layout.pieces.filter((_, k) => k !== i) }); }
  });
  $('sList').addEventListener('click', (ev) => {
    const li = ev.target.closest('li[data-i]'); if (!li) return; const i = Number(li.dataset.i);
    if (ev.target.closest('[data-del]')) { setLayout({ wall: layout.wall, pieces: layout.pieces.filter((_, k) => k !== i) }); return; }
    if (ev.target.closest('select')) return;
    select(i);
  });
  $('sList').addEventListener('change', (ev) => {
    const li = ev.target.closest('li[data-i]'); if (!li || !ev.target.matches('[data-fin]')) return;
    const i = Number(li.dataset.i); layout.pieces[i] = Object.assign({}, layout.pieces[i], { finish: ev.target.value }); renderWall(); updateS();
  });
  $('sAdd').addEventListener('click', () => {
    const r = S.addPiece(layout, ART, $('sPose').value, $('sFinish').value);
    if (!r.added) { msg(r.reason === 'max' ? 'Na jednu stěnu lze přidat nejvýše ' + Ptaci.WALL_LIMITS.maxPieces + ' kusů.' : 'Na stěně už není volné místo – zvětšete stěnu nebo některého ptáka odeberte.', 'bad'); return; }
    $('sMessage').hidden = true; sel = r.layout.pieces.length - 1; setLayout(r.layout, true);
  });
  $('sDemo').addEventListener('click', () => {
    const f = $('sFinish').value, base = { wall: layout.wall, pieces: Object.keys(Ptaci.POSES).map((pose) => ({ pose, finish: f, x: 0, y: 0 })) };
    sel = null; setLayout(S.arrange(Ptaci.normalizeLayout(base), ART));
  });
  $('sArrange').addEventListener('click', () => { setLayout(S.arrange(layout, ART), true); });
  $('sClear').addEventListener('click', () => { sel = null; setLayout({ wall: layout.wall, pieces: [] }); });
  ['sW', 'sH'].forEach((id) => $(id).addEventListener('change', () => { setLayout({ wall: { w: $('sW').value, h: $('sH').value }, pieces: layout.pieces }, true); }));
  ['sX', 'sY'].forEach((id) => $(id).addEventListener('change', () => { if (sel != null && layout.pieces[sel] && $('sX').value !== '' && $('sY').value !== '') movePiece(sel, Number($('sX').value), Number($('sY').value), true); }));
  $('sWallColor').addEventListener('change', () => { wallKey = $('sWallColor').value; renderWall(); });
  Object.keys(S.WALLS).forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = S.WALLS[k][0]; $('sWallColor').appendChild(o); });
  Object.keys(Ptaci.POSES).forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = Ptaci.POSES[k].label; $('sPose').appendChild(o); });
  window.addEventListener('resize', () => {});

  /* ---------- přepínač výrobků ---------- */
  function show(name, newMode) {
    product = name === 'ptak' ? 'ptak' : 'zastena';
    if (product === 'ptak') mode = newMode === 'stena' ? 'stena' : (newMode === 'kus' ? 'kus' : mode);
    document.querySelectorAll('[data-prod]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.prod === product)));
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    $('ptakMode').hidden = product !== 'ptak';
    $('prod-zastena').hidden = product !== 'zastena';
    $('prod-ptak').hidden = !(product === 'ptak' && mode === 'kus');
    $('prod-stena').hidden = !(product === 'ptak' && mode === 'stena');
    try { history.replaceState(null, '', product === 'ptak' ? (mode === 'stena' ? '#stena' : '#ptak') : location.pathname + location.search); } catch (e) { /* file:// */ }
    if (product === 'ptak' && mode === 'kus') {
      if (!viewerP) {
        try { viewerP = PtaciViewer.create($('viewerP')); viewerP.update(configP()); }
        catch (e) { $('viewerP').textContent = '3D náhled se nepodařilo načíst. Nastavení a poptávka zůstávají dostupné.'; }
      } else viewerP.resize();
    }
  }
  const fromHash = () => (location.hash === '#stena' ? ['ptak', 'stena'] : location.hash === '#ptak' ? ['ptak', 'kus'] : ['zastena']);
  document.querySelectorAll('[data-prod]').forEach((b) => b.addEventListener('click', () => show(b.dataset.prod)));
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => show('ptak', b.dataset.mode)));
  window.addEventListener('hashchange', () => show(...fromHash()));

  /* ---------- ovládání ---------- */
  Object.keys(Ptaci.POSES).forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = Ptaci.POSES[k].label; $('pPose').appendChild(o); });
  ['finish', 'qty'].forEach((id) => { $(id).addEventListener('input', updateZ); $(id).addEventListener('change', updateZ); });
  ['pPose', 'pFinish', 'pQty'].forEach((id) => { $(id).addEventListener('input', updateP); $(id).addEventListener('change', updateP); });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewerZ && viewerZ.view(b.dataset.view)));
  document.querySelectorAll('[data-viewp]').forEach((b) => b.addEventListener('click', () => viewerP && viewerP.view(b.dataset.viewp)));

  const wallMode = () => product === 'ptak' && mode === 'stena';
  function openForm() {
    if (wallMode()) {
      const v = Ptaci.validateLayout(layout), st = S.status(layout, ART);
      if (!v.ok || !st.ok) { msg(v.errors.concat(st.errors).join(' '), 'bad'); return; }
      const p = Ptaci.priceLayout(layout, rates);
      $('formSummary').textContent = Ptaci.describeLayout(layout) + '. Orientačně ' + nf(p.total) + ' Kč s DPH celkem; dílna cenu potvrdí.';
      $('sMessage').hidden = true; $('modal').hidden = false; $('fName').focus(); return;
    }
    const c = product === 'ptak' ? configP() : configZ(), mod = product === 'ptak' ? Ptaci : Zasteny, v = mod.validate(c), p = v.ok ? mod.price(c, rates) : null;
    if (!v.ok) { msg(v.errors.join(' '), 'bad'); return; }
    $('formSummary').textContent = mod.describe(c) + '. ' + (p ? 'Orientačně ' + nf(p.total) + ' Kč s DPH za ' + c.qty + ' ks; dílna cenu potvrdí.' : 'Cenu stanoví dílna ručně.');
    $('message').hidden = true; $('pMessage').hidden = true; $('modal').hidden = false; $('fName').focus();
  }
  $('ask').addEventListener('click', openForm);
  $('pAsk').addEventListener('click', openForm);
  $('sAsk').addEventListener('click', openForm);
  $('cancel').addEventListener('click', () => { $('modal').hidden = true; });
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('modal').hidden = true; });

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('fName').value.trim(), email = $('fEmail').value.trim();
    const isP = product === 'ptak', isW = wallMode(), mod = isP ? Ptaci : Zasteny, raw = isW ? { layout } : isP ? configP() : configZ();
    if (isW ? !(Ptaci.validateLayout(layout).ok && S.status(layout, ART).ok) : !mod.validate(raw).ok) { msg('Zkontrolujte nastavení a počet kusů.', 'bad'); $('modal').hidden = true; return; }
    if (!name || !mod.validEmail(email)) { msg('Vyplňte jméno a platný e-mail.', 'bad'); return; }
    const now = new Date(), stamp = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const id = 'A' + stamp + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();   // server (dilna_api/poptavky.php) přijímá jen předpony P, S, Z, A
    const lay = isW ? Ptaci.normalizeLayout(layout) : null, c = isW ? { layout: lay, qty: lay.pieces.length } : mod.normalize(raw), p = isW ? Ptaci.priceLayout(lay, rates) : mod.price(c, rates);
    const item = { id, product: isP ? 'ptak' : 'zastena', created: now.toISOString(), status: 'nova', customer: { name, email, phone: $('fPhone').value.trim() }, note: $('fNote').value.trim(), config: c };
    if (p) {
      Object.assign(item, { price: p.price, vat: p.vat, total: p.total, priceEstimate: true });
      item.priceBreakdown = isW ? { kg: p.kg, cuts: p.cuts, bends: p.bends, cutMm: p.cutMm, surfaceM2: p.surfaceM2 } : isP ? { kg: p.kg, cuts: p.cuts, bends: p.bends, cutMm: p.cutMm, surfaceM2: p.surfaceM2 } : { kg: p.kg, cuts: p.cuts, welds: p.welds, surfaceM2: p.surfaceM2 };
    }
    if (!db || !uid) { $('modal').hidden = true; msg('Poptávku se nepodařilo připojit k dílně. Pošlete prosím tento kód na [E-MAIL FIRMY]:<div class="code">' + codeFor(item) + '</div>', 'bad'); return; }
    $('send').disabled = true;
    try {
      const ref = db.doc('poptavky/' + uid), snap = await ref.get(), items = snap.exists ? (snap.data().items || []).slice() : [];
      items.push(item); const result = await ref.set({ uid, updated: now.toISOString(), items });
      $('modal').hidden = true;
      msg(result && result.emailSkipped ? 'Testovací poptávka ' + id + ' byla uložena do Dílna. E-mail se neposílá.'
        : (result && result.emailAccepted === false ? 'Poptávka ' + id + ' je uložená, ale e-mailové upozornění se nepodařilo odeslat. Kontaktujte prosím firmu.'
        : 'Děkujeme, poptávka ' + id + ' je odeslaná. Dílna se ozve s potvrzením proveditelnosti a ceny.'), 'ok');
    } catch (err) {
      $('modal').hidden = true; msg('Odeslání se nepovedlo. Pošlete prosím tento kód na [E-MAIL FIRMY]:<div class="code">' + codeFor(item) + '</div>', 'bad');
    } finally { $('send').disabled = false; }
  });

  /* ---------- start ---------- */
  updateZ(); updateP(); setLayout(layout);
  try { viewerZ = ZastenyViewer.create($('viewer')); viewerZ.update(configZ()); }
  catch (e) { $('viewer').textContent = '3D náhled se nepodařilo načíst. Nastavení a poptávka zůstávají dostupné.'; }
  show(...fromHash());

  (async function connect() {
    if (!window.claude || !claude.use) return;
    try {
      const [d, u] = await Promise.all([claude.use('db'), claude.use('user')]);
      db = d; if (u) uid = await u.id();
      if (db) db.doc('nastaveni/cenik').onSnapshot((s) => { if (s.exists) { rates = Object.assign({}, Zasteny.DEFAULT_RATES, s.data()); updateZ(); updateP(); updateS(); } }, () => {});
    } catch (e) { db = null; uid = null; }
  })();
})();
