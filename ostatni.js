/* Stránka Ostatní: přepínač výrobků (zástěna Motýli, ptačí věšák), cena, poptávka do dílny. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const nf = (n) => new Intl.NumberFormat('cs-CZ').format(n);
  const FIXED = { width: 800, height: 2000 };            // zástěna se vyrábí jen v jedné variantě
  let product = 'zastena', viewerZ = null, viewerP = null, db = null, uid = null;
  let rates = Object.assign({}, Zasteny.DEFAULT_RATES);

  const msg = (html, kind) => { const el = $(product === 'ptak' ? 'pMessage' : 'message'); el.innerHTML = html; el.className = 'message ' + (kind || ''); el.hidden = false; };
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

  /* ---------- přepínač výrobků ---------- */
  function show(name) {
    product = name === 'ptak' ? 'ptak' : 'zastena';
    document.querySelectorAll('[data-prod]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.prod === product)));
    $('prod-zastena').hidden = product !== 'zastena';
    $('prod-ptak').hidden = product !== 'ptak';
    try { history.replaceState(null, '', product === 'ptak' ? '#ptak' : location.pathname + location.search); } catch (e) { /* file:// */ }
    if (product === 'ptak') {
      if (!viewerP) {
        try { viewerP = PtaciViewer.create($('viewerP')); viewerP.update(configP()); }
        catch (e) { $('viewerP').textContent = '3D náhled se nepodařilo načíst. Nastavení a poptávka zůstávají dostupné.'; }
      } else viewerP.resize();
    }
  }
  document.querySelectorAll('[data-prod]').forEach((b) => b.addEventListener('click', () => show(b.dataset.prod)));
  window.addEventListener('hashchange', () => show(location.hash === '#ptak' ? 'ptak' : 'zastena'));

  /* ---------- ovládání ---------- */
  Object.keys(Ptaci.POSES).forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = Ptaci.POSES[k].label; $('pPose').appendChild(o); });
  ['finish', 'qty'].forEach((id) => { $(id).addEventListener('input', updateZ); $(id).addEventListener('change', updateZ); });
  ['pPose', 'pFinish', 'pQty'].forEach((id) => { $(id).addEventListener('input', updateP); $(id).addEventListener('change', updateP); });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewerZ && viewerZ.view(b.dataset.view)));
  document.querySelectorAll('[data-viewp]').forEach((b) => b.addEventListener('click', () => viewerP && viewerP.view(b.dataset.viewp)));

  function openForm() {
    const c = product === 'ptak' ? configP() : configZ(), mod = product === 'ptak' ? Ptaci : Zasteny, v = mod.validate(c), p = v.ok ? mod.price(c, rates) : null;
    if (!v.ok) { msg(v.errors.join(' '), 'bad'); return; }
    $('formSummary').textContent = mod.describe(c) + '. ' + (p ? 'Orientačně ' + nf(p.total) + ' Kč s DPH za ' + c.qty + ' ks; dílna cenu potvrdí.' : 'Cenu stanoví dílna ručně.');
    $('message').hidden = true; $('pMessage').hidden = true; $('modal').hidden = false; $('fName').focus();
  }
  $('ask').addEventListener('click', openForm);
  $('pAsk').addEventListener('click', openForm);
  $('cancel').addEventListener('click', () => { $('modal').hidden = true; });
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('modal').hidden = true; });

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('fName').value.trim(), email = $('fEmail').value.trim();
    const isP = product === 'ptak', mod = isP ? Ptaci : Zasteny, raw = isP ? configP() : configZ();
    if (!mod.validate(raw).ok) { msg('Zkontrolujte nastavení a počet kusů.', 'bad'); $('modal').hidden = true; return; }
    if (!name || !mod.validEmail(email)) { msg('Vyplňte jméno a platný e-mail.', 'bad'); return; }
    const now = new Date(), stamp = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const id = 'A' + stamp + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();   // server (dilna_api/poptavky.php) přijímá jen předpony P, S, Z, A
    const c = mod.normalize(raw), p = mod.price(c, rates);
    const item = { id, product: isP ? 'ptak' : 'zastena', created: now.toISOString(), status: 'nova', customer: { name, email, phone: $('fPhone').value.trim() }, note: $('fNote').value.trim(), config: c };
    if (p) {
      Object.assign(item, { price: p.price, vat: p.vat, total: p.total, priceEstimate: true });
      item.priceBreakdown = isP ? { kg: p.kg, cuts: p.cuts, bends: p.bends, cutMm: p.cutMm, surfaceM2: p.surfaceM2 } : { kg: p.kg, cuts: p.cuts, welds: p.welds, surfaceM2: p.surfaceM2 };
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
  updateZ(); updateP();
  try { viewerZ = ZastenyViewer.create($('viewer')); viewerZ.update(configZ()); }
  catch (e) { $('viewer').textContent = '3D náhled se nepodařilo načíst. Nastavení a poptávka zůstávají dostupné.'; }
  show(location.hash === '#ptak' ? 'ptak' : 'zastena');

  (async function connect() {
    if (!window.claude || !claude.use) return;
    try {
      const [d, u] = await Promise.all([claude.use('db'), claude.use('user')]);
      db = d; if (u) uid = await u.id();
      if (db) db.doc('nastaveni/cenik').onSnapshot((s) => { if (s.exists) { rates = Object.assign({}, Zasteny.DEFAULT_RATES, s.data()); updateZ(); updateP(); } }, () => {});
    } catch (e) { db = null; uid = null; }
  })();
})();
