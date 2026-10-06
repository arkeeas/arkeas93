/* Dílna – zábradlí: otevření poptávky, kusovník, 3D, stažení podkladů (.zip) a ceník zábradlí.
   Načítá se v interni.html za gen.js (Generator), zabradli-core.js a zabradli-viewer.js. */
(function (root) {
  'use strict';
  const Zb = root.Zabradli, G = root.Generator, nf = Zb.nf;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => { const d = new Date(); return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear(); };
  let rates = Zb.rates0(), cfg = Zb.normalize({}), A = null, current = null, viewer = null, db = null, dls = null, canEdit = false, ctx = true;

  /* ---------- PDF stránky (A4, 150 dpi) ---------- */
  const PW = 1240, PH = 1754, FONT = '"IBM Plex Sans", "Segoe UI", Arial, sans-serif';
  function page() { const c = document.createElement('canvas'); c.width = PW; c.height = PH; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, PW, PH); return [c, x]; }
  function txt(x, s, px, py, size, bold, color, align) { x.font = (bold ? '600 ' : '400 ') + size + 'px ' + FONT; x.fillStyle = color || '#111'; x.textAlign = align || 'left'; x.fillText(s, px, py); }
  function fit(x, s, maxw, size, bold) { x.font = (bold ? '600 ' : '400 ') + size + 'px ' + FONT; s = String(s); if (x.measureText(s).width <= maxw) return s; while (s.length > 3 && x.measureText(s + '…').width > maxw) s = s.slice(0, -1); return s + '…'; }

  function kusovnik(order, A) {
    const pages = [], M = 80, c0 = A.cfg;
    let [c, x] = page(); pages.push(c);
    txt(x, 'Kusovník zábradlí – ' + order.number, M, 120, 42, true);
    const info = [['Zákazník', order.customer.name], ['Objednávka', order.number], ['Konstrukce', (c0.sloupky ? 'sloupky po max. ' + c0.postPitch + ' mm' : 'bez sloupků') + ', ' + (c0.madlo ? 'dřevěné madlo' : 'rám = madlo')], ['Datum', order.date || ''],
      ['Délka', nf(A.lenM, 2) + ' m, ' + c0.segs.length + ' úsek(y)'], ['Výška', c0.vyska + ' mm'], ['Kotvení', Zb.ANCHOR.find((a) => a.id === c0.anchor).lab + (c0.anchor === 'bez' ? '' : ' – ' + Zb.BASE.find((b) => b.id === c0.base).lab.toLowerCase()) + (c0.anchor === 'bocni' ? ', fasáda ' + c0.facade + ', rameno ' + c0.arm : '') +
        (c0.anchor !== 'bez' && (c0.zed.start || c0.zed.end) ? ', ' + (c0.zed.start && c0.zed.end ? 'oba konce' : c0.zed.start ? 'začátek' : 'konec') + ' ke zdi (' + Zb.WALL_BASE.find((b) => b.id === c0.zedBase).lab.replace('Zeď – ', '') + ')' : '') + (c0.podlozka && Zb.padAllowed(c0) ? ', tepelné podložky' : '')],
      ['Povrch', Zb.FIN.find((f) => f.id === c0.fin).lab], ['Špruše', { drazka: 'v drážkách rámu', tupo: 'na tupo', zamek: 'se zámečky' }[A.locks.mode] + (c0.overTop || c0.overBot ? ', přesah ' + c0.overTop + ' / ' + c0.overBot + ' mm' : '')], ['Služby', A.svc.length ? A.svc.map((s) => s.id).join(', ') : '–'],
      ['Rozměry', c0.stavba && c0.stavba.on ? 'změřil zákazník' + (A.meas.remeasure.filter((m) => m.lvl !== 'info').length ? ' – ' + A.meas.remeasure.filter((m) => m.lvl !== 'info').length + '× nesedí, ZAMĚŘIT' : ' – před výrobou potvrdit') : 'zadané délky – ZAMĚŘIT'], ['Rám / špruše', 'jekl ' + c0.rail.replace(/x/g, '×') + ' / PL ' + c0.bar.replace(/x/g, '×')], ['Kotvy', c0.anchor === 'bez' ? '–' : A.lay.anch.used.length + ' ks' + (c0.kotvyPos ? ', rozmístěné ručně' : c0.kotvyRoztec ? ', rozteč ' + c0.kotvyRoztec + ' mm' : ', podle vzoru') + (A.kotvy.gaps.length ? ', max. mezera ' + Math.round(Math.max.apply(null, A.kotvy.gaps)) + ' mm' : '')]];
    info.forEach((r, i) => { const px = M + (i % 2) * 545, py = 175 + Math.floor(i / 2) * 34; txt(x, r[0], px, py, 20, true); txt(x, fit(x, r[1], 370, 20), px + 150, py, 20); });
    txt(x, 'Trasa (osa zábradlí): ' + c0.segs.map((s, i) => (i + 1) + ') ' + s.L + (s.rise ? ' ↑' + s.rise : '') + (s.turn ? ' ' + (s.turn > 0 ? 'vlevo ' : 'vpravo ') + Math.abs(s.turn) + '°' : '')).join('   '), M, 355, 18, false, '#444');
    const pv = document.createElement('canvas'); pv.width = 1080; pv.height = 560;
    const p2 = pv.getContext('2d'); p2.fillStyle = '#fff'; p2.fillRect(0, 0, 1080, 560);
    if (root.Podnoze) root.Podnoze.paint(p2, 1080, 560, root.ZabViewer.bodies2d(A, false), { az: -35, el: 24, pad: 0.05 });
    x.drawImage(pv, (PW - 1080) / 2, 380);
    const cols = [['Poz', 62], ['Díl', 230], ['Profil', 140], ['L [mm]', 100, 'r'], ['Řez 1 / 2', 120, 'r'], ['Ks', 50, 'r'], ['Stroj', 80], ['Pozn.', 0]];
    let y = 990;
    const head = () => { let px = M; cols.forEach((cc) => { const w = cc[1] || (PW - M - px); txt(x, cc[0], cc[2] ? px + w - 10 : px, y, 16, true, '#111', cc[2] ? 'right' : 'left'); px += w; }); x.fillStyle = '#111'; x.fillRect(M, y + 9, PW - 2 * M, 2); y += 38; };
    head();
    A.rows.forEach((r) => {
      if (y > PH - 120) { [c, x] = page(); pages.push(c); y = 110; txt(x, 'Kusovník zábradlí – ' + order.number + ' (pokračování)', M, 70, 24, true); head(); }
      const v = [r.poz, r.name, r.prof, r.len, r.cut, r.q * c0.qty, r.stroj, r.feat];
      let px = M; cols.forEach((cc, i) => { const w = cc[1] || (PW - M - px); txt(x, fit(x, v[i], w - 14, 16), cc[2] ? px + w - 10 : px, y, 16, false, '#111', cc[2] ? 'right' : 'left'); px += w; });
      x.fillStyle = '#ccc'; x.fillRect(M, y + 11, PW - 2 * M, 1); y += 34;
    });
    y += 16;
    if (y > PH - 140) { [c, x] = page(); pages.push(c); y = 110; }
    txt(x, 'Jekl ' + nf(A.tubeM, 2) + ' m · pásovina ' + nf(A.barM, 2) + ' m' + (A.woodM ? ' · dřevo ' + nf(A.woodM, 2) + ' m' : '') + ' · ocel ' + nf(A.kg, 1) + ' kg · ' + A.anchorsN + ' kotev · ' + A.slots + ' drážek pro zámky', M, y, 18);
    txt(x, 'Řez = odklon řezné roviny od kolmého řezu. L = nejdelší hrana dílu. Zinkovací otvory nejsou (doplnit podle povrchu).', M, y + 30, 17, false, '#555');
    if (order.note) txt(x, fit(x, 'Poznámka zákazníka: ' + order.note, PW - 2 * M, 18, true), M, y + 64, 18, true);
    return pages;
  }

  /* řezný plán: co objednat + tyče jako proužky (stejné tyče sloučené) */
  function reznyPlan(order, A) {
    const plan = Zb.cutPlan(A), pages = [], M = 80, W = PW - 2 * M;
    let [c, x] = page(); pages.push(c);
    let y = 120;
    const np = () => { [c, x] = page(); pages.push(c); y = 110; txt(x, 'Řezný plán – ' + order.number + ' (pokračování)', M, 70, 24, true); };
    txt(x, 'Řezný plán – ' + order.number, M, y, 42, true); y += 50;
    txt(x, fit(x, (order.customer.name || '') + ' · ' + Zb.describe(A.cfg), W, 17), M, y, 17, false, '#555'); y += 50;
    txt(x, 'Objednat materiál', M, y, 24, true); y += 36;
    plan.forEach((g) => {
      txt(x, g.prof + ' (' + g.stroj + ')', M, y, 20); txt(x, g.bars.length + ' × ' + nf(g.stock / 1000, 1) + ' m', M + 520, y, 20, true);
      txt(x, nf(g.n) + ' kusů · využití ' + Math.round(g.util * 100) + ' %' + (g.over.length ? ' · ' + g.over.length + ' kus(y) delší než tyč!' : ''), M + 700, y, 17, false, g.over.length ? '#B3261E' : '#555'); y += 32;
    });
    txt(x, 'Délka kusu = nejdelší hrana (pokos počítán celý). Prořez pily ' + A.R.prorezPila + ' mm, K2 řez ' + A.R.prorezK2 + ' mm + konec v upínači ' + A.R.zbytekK2 + ' mm. Nastavení: Dílna → Ceník.', M, y + 8, 15, false, '#777'); y += 50;
    const COL = ['#E8D6C8', '#D3DFE8', '#DCE8D3', '#E8E2C8', '#E2D3E8', '#C8E8E2'];
    plan.forEach((g) => {
      if (y > PH - 220) np();
      x.fillStyle = '#111'; x.fillRect(M, y, W, 2); y += 36;
      txt(x, g.prof + ' – ' + (g.stroj === 'K2' ? 'K2 (STEP díly v dily/K2)' : 'pila'), M, y, 24, true); y += 14;
      const pozCol = {}; let ci = 0;
      const pat = new Map();
      g.bars.forEach((b) => { const k = b.pieces.map((p) => p.poz + ':' + Math.round(p.L)).join('|'); if (!pat.has(k)) pat.set(k, { b, n: 0 }); pat.get(k).n++; });
      pat.forEach(({ b, n }) => {
        if (y > PH - 120) np();
        y += 24;
        txt(x, n + '× tyč', M, y + 30, 20, true);
        const bx = M + 110, bw = W - 110, sc = bw / g.stock;
        x.fillStyle = '#F2F2F2'; x.fillRect(bx, y + 6, bw, 40); x.strokeStyle = '#999'; x.lineWidth = 1; x.strokeRect(bx, y + 6, bw, 40);
        let px = bx;
        b.pieces.forEach((pc, i) => {
          if (i) px += g.kerf * sc;
          if (!(pc.poz in pozCol)) pozCol[pc.poz] = COL[ci++ % COL.length];
          const w = pc.L * sc;
          x.fillStyle = pozCol[pc.poz]; x.fillRect(px, y + 6, w, 40); x.strokeStyle = '#333'; x.strokeRect(px, y + 6, w, 40);
          const lab = pc.poz + ' ' + nf(pc.L, pc.L % 1 ? 1 : 0);
          x.font = '600 14px ' + FONT;
          if (x.measureText(lab).width < w - 6) txt(x, lab, px + w / 2, y + 31, 14, true, '#111', 'center');
          else if (x.measureText(pc.poz).width < w - 4) txt(x, pc.poz, px + w / 2, y + 31, 12, true, '#111', 'center');
          px += w;
        });
        if (g.end) { x.fillStyle = '#bbb'; x.fillRect(bx + bw - g.end * sc, y + 6, g.end * sc, 40); }
        y += 52;
        const list = []; b.pieces.forEach((pc) => { const l = list.find((q) => q.poz === pc.poz); if (l) l.q++; else list.push({ poz: pc.poz, q: 1, L: pc.L, cut: pc.cut }); });
        txt(x, fit(x, list.map((q) => q.q + '× ' + q.poz + ' ' + nf(q.L, q.L % 1 ? 1 : 0) + (q.cut && q.cut !== '0° / 0°' ? ' (' + q.cut + ')' : '')).join('  ·  ') + '   |   zbytek ' + nf(Math.max(0, Math.round(b.rest))) + ' mm', bw, 15), bx, y + 4, 15, false, '#333');
        y += 14;
      });
      g.over.forEach((pc) => { if (y > PH - 80) np(); y += 30; txt(x, pc.poz + ' ' + pc.name + ' ' + nf(pc.L) + ' mm – delší než tyč, potřeba styk', M, y, 17, true, '#B3261E'); });
      y += 30;
    });
    return pages;
  }

  function doklad(order, A) {
    const [c, x] = page(), M = 110;
    txt(x, 'TESTOVACÍ DOKLAD – NENÍ DAŇOVÝ DOKLAD', M, 140, 22, true, '#B3261E');
    txt(x, 'Doklad o zaplacení – ' + order.number, M, 200, 40, true);
    ['Dodavatel: [NÁZEV FIRMY], [ADRESA], IČO [IČO], DIČ [DIČ]', 'Odběratel: ' + order.customer.name + (order.customer.address ? ', ' + order.customer.address : '') + (order.customer.email ? ', ' + order.customer.email : ''),
      'Datum: ' + (order.date || '') + ' · Způsob úhrady: ' + (order.payment || '[DOPLNÍ PLATEBNÍ BRÁNA]')].forEach((s, i) => txt(x, fit(x, s, PW - 2 * M, 21), M, 260 + i * 34, 21));
    let y = 420;
    txt(x, 'Položka', M, y, 20, true); txt(x, 'Bez DPH', 900, y, 20, true, '#111', 'right'); txt(x, 'S DPH', PW - M, y, 20, true, '#111', 'right');
    x.fillStyle = '#111'; x.fillRect(M, y + 12, PW - 2 * M, 2); y += 50;
    [{ lab: 'Zábradlí – výroba' + (A.cfg.anchor !== 'bez' ? ' vč. kotev' : '') + ' (' + nf(A.lenM, 1) + ' m)', price: A.price * A.cfg.qty }].concat(A.svc).forEach((it) => {
      txt(x, fit(x, it.lab, 640, 19), M, y, 19); txt(x, nf(it.price) + ' Kč', 900, y, 19, false, '#111', 'right'); txt(x, nf(A.vatOf(it.price)) + ' Kč', PW - M, y, 19, false, '#111', 'right');
      x.fillStyle = '#ddd'; x.fillRect(M, y + 14, PW - 2 * M, 1); y += 44;
    });
    txt(x, 'Celkem s DPH 21 %: ' + nf(A.total) + ' Kč', PW - M, y + 50, 26, true, '#111', 'right');
    txt(x, fit(x, Zb.describe(A.cfg), PW - 2 * M, 17), M, y + 110, 17, false, '#555');
    return c;
  }

  /* ---------- celá objednávka -> zip ---------- */
  function generate(order, ratesIn) {
    const A = Zb.analyze(order.config, ratesIn);
    const num = G.asciiName(order.number) || 'OBJ', dir = G.asciiName(order.customer.name || 'Zakaznik') + '_' + num + '/';
    const files = [], problems = A.problems.slice();
    A.lay.members.forEach((m) => { if (!G.checkClosed(m.solid.verts, m.solid.faces)) problems.push((m.poz || m.role) + ': těleso není uzavřené'); });
    A.rows.forEach((r) => {
      if (!r.part || r.kind === 'wood') return;
      if (r.kind === 'plate') {
        const m = r.part;
        files.push({ name: dir + 'dily/C2/' + r.file, data: G.dxf({ w: m.w, l: m.l, holes: m.holes.map((h) => [h[0] + m.w / 2, h[1] + m.l / 2, h[2]]), poz: r.poz }) });
        return;
      }
      files.push({ name: dir + 'dily/' + (r.kind === 'tube' ? 'K2' : 'pasovina') + '/' + r.file, data: G.stepFile(r.poz + '_' + r.prof.replace(/\s/g, '').replace(/×/g, 'x') + '_L' + Math.round(r.L), [Zb.toLocal(r.part)]) });
    });
    files.push({ name: dir + num + '_sestava.step', data: G.stepFile(num + '_sestava', A.lay.members.map((m) => m.solid)) });
    if (typeof document !== 'undefined') {
      files.push({ name: dir + num + '_kusovnik.pdf', data: G.pdfFromCanvases(kusovnik(order, A)) });
      files.push({ name: dir + num + '_rezny_plan.pdf', data: G.pdfFromCanvases(reznyPlan(order, A)) });
      files.push({ name: dir + num + '_doklad_o_zaplaceni.pdf', data: G.pdfFromCanvases([doklad(order, A)]) });
    }
    return { filename: dir.slice(0, -1) + '.zip', bytes: G.zip(files), files: files.map((f) => f.name), problems, analysis: A };
  }

  /* ---------- panel v dílně ---------- */
  function order() {
    return { number: $('zNum').value.trim() || 'OBJ-BEZ-CISLA', date: $('zDate').value.trim() || today(), note: $('zNote').value.trim(), payment: current && current.paid ? current.paid : '',
      customer: { name: $('zName').value.trim() || 'Zakaznik', email: $('zEmail').value.trim(), phone: $('zPhone').value.trim(), address: $('zAddr').value.trim() }, config: cfg };
  }
  function renderFiles() {
    if (!A) return;
    const o = order(), num = G.asciiName(o.number), dir = G.asciiName(o.customer.name) + '_' + num + '/';
    const by = (k) => A.rows.filter((r) => r.kind === k && r.file).map((r) => '    ' + r.file).join('\n');
    $('zFiles').textContent = dir + '\n  ' + num + '_sestava.step\n  ' + num + '_kusovnik.pdf\n  ' + num + '_rezny_plan.pdf\n  ' + num + '_doklad_o_zaplaceni.pdf\n  dily/C2/\n' + by('plate') + '\n  dily/K2/\n' + by('tube') + '\n  dily/pasovina/\n' + by('bar');
  }
  function visible() { return $('p-zab') && !$('p-zab').hidden; }
  function render() {
    A = Zb.analyze(cfg, rates);
    $('zCfg').innerHTML = '<strong>' + esc(Zb.describe(cfg)) + '</strong><br><span style="color:var(--muted)">Trasa: ' + cfg.segs.map((s, i) => (i + 1) + ') ' + s.L + (s.rise ? ' ↑' + s.rise : '') + (s.turn ? ' ' + (s.turn > 0 ? '↰' : '↱') + Math.abs(s.turn) + '°' : '')).join(' · ') + ' · stavba ' + (cfg.side === 'L' ? 'vlevo' : 'vpravo') + '</span>' +
      (A.svc.length ? '<br>Služby: ' + A.svc.map((s) => esc(s.lab)).join(', ') : '');
    const facts = [['Délka', nf(A.lenM, 2) + ' m'], ['Ocel', nf(A.kg, 1) + ' kg'], ['Jekl', nf(A.tubeM, 1) + ' m'], ['Pásovina', nf(A.barM, 1) + ' m'], ['Kotvy', A.anchorsN], ['Zámky', A.locks.ok ? A.slots + ' drážek' + (A.tabs ? ', ' + A.tabs + ' zámečků' : '') : 'ne'], ['Tyče', Zb.cutPlan(A).map((g) => g.bars.length + '× ' + g.prof.replace('jekl ', '')).join(', ')], ['Svary (odhad)', A.welds], ['Dílů / pozic', A.parts.length + ' / ' + A.rows.length]];
    $('zFacts').innerHTML = facts.map((f) => '<div class="fact"><b>' + esc(f[1]) + '</b><span>' + f[0] + '</span></div>').join('');
    $('zWarns').innerHTML = A.warns.filter((w) => w.lvl !== 'info').map((w) => '<div>' + esc(w.t) + '</div>').join('') + '<div style="background:var(--line-soft);color:var(--ink)">' + esc(A.locks.why) + '</div>';
    $('zBom').innerHTML = A.rows.map((r) => '<tr><td class="mono">' + r.poz + '</td><td>' + esc(r.name) + (r.feat ? ' <span style="color:var(--muted);font-size:12px">(' + esc(r.feat) + ')</span>' : '') + '</td><td>' + esc(r.prof) + '</td><td class="num mono">' + r.len + '</td><td class="num mono">' + r.cut + '</td><td class="num">' + r.q + '</td><td>' + r.stroj + '</td><td class="mono">' + esc(r.file) + '</td></tr>').join('');
    $('zPrice').textContent = nf(A.price + A.svcPrice) + ' Kč bez DPH · ' + nf(A.total) + ' Kč s DPH';
    renderFiles();
    if (visible()) { if (!viewer) viewer = root.ZabViewer.create($('zviz')); viewer.update(A, { ctx }); }
  }
  function open(it) {
    current = it || null;
    cfg = Zb.normalize(it ? it.config : {});
    const c = (it && it.customer) || {};
    $('zNum').value = it ? 'OBJ-' + String(it.id).replace(/^Z/, 'Z') : 'OBJ-TEST-Z1'; $('zDate').value = today();
    $('zName').value = c.name || (it ? '' : 'Jan Novák'); $('zEmail').value = c.email || ''; $('zPhone').value = c.phone || ''; $('zAddr').value = c.address || ''; $('zNote').value = (it && it.note) || '';
    $('zMsg').hidden = true;
    render();
  }
  function msg(t, kind) { const m = $('zMsg'); m.hidden = false; m.innerHTML = t; m.style.background = kind === 'ok' ? 'var(--ok-bg)' : kind === 'bad' ? 'var(--bad-bg)' : 'var(--line-soft)'; m.style.color = kind === 'ok' ? 'var(--ok-ink)' : kind === 'bad' ? 'var(--bad-ink)' : 'var(--ink)'; }

  /* ---------- ceník zábradlí ---------- */
  const RF = [['kg', 'Materiál – ocel', 'Kč/kg'], ['rez', 'Řez / pálení dílu', 'Kč/ks'], ['svar', 'Svar (spoj)', 'Kč'], ['drazka', 'Drážka pro zámek', 'Kč/ks'], ['zamekSpruse', 'Zámeček na špruši (vyřezání)', 'Kč/ks'], ['podlozka', 'Tepelně oddělující podložka pod plotnu', 'Kč/ks'], ['kotvaMax', 'Kotvy – max. mezera (nad = nejde poptat)', 'mm'], ['kotvaDop', 'Kotvy – doporučená mezera (nad = varování)', 'mm'], ['kotvaKonecMax', 'Kotvy – max. přesah konce za kotvu', 'mm'], ['kotvaKonecDop', 'Kotvy – doporučený přesah konce', 'mm'], ['tycDelka', 'Řezný plán – délka tyče', 'mm'], ['prorezPila', 'Řezný plán – prořez pily', 'mm'], ['prorezK2', 'Řezný plán – řez K2', 'mm'], ['zbytekK2', 'Řezný plán – konec tyče v upínači K2', 'mm'], ['zinek', 'Žárový zinek', 'Kč/kg'], ['lak', 'PU lak', 'Kč/m²'], ['prasek', 'Prášková barva', 'Kč/m²'],
    ['madlo', 'Dřevěné madlo', 'Kč/m'], ['priprava', 'Příprava zakázky', 'Kč'], ['marze', 'Marže', '%'], ['zamereni', 'Zaměření', 'Kč'], ['kotveni', 'Pomoc s kotvením', 'Kč'], ['montazM', 'Montáž', 'Kč/m'], ['montazKotva', 'Montáž – kotva', 'Kč/ks']];
  const KF = [['beton', 'Kotva do betonu'], ['zdivo', 'Kotva do zdiva (sítko)'], ['ocel', 'Šroub do oceli']];
  function fillRates() {
    if (!$('zRateFields')) return;
    $('zRateFields').innerHTML = RF.map((f) => '<label class="f" for="zr-' + f[0] + '">' + f[1] + ' [' + f[2] + ']<input id="zr-' + f[0] + '" type="number" value="' + rates[f[0]] + '"></label>').join('') +
      KF.map((f) => '<label class="f" for="zk-' + f[0] + '">' + f[1] + ' [Kč/ks]<input id="zk-' + f[0] + '" type="number" value="' + rates.kotva[f[0]] + '"></label>').join('');
  }
  function readRates() {
    const r = { kotva: {} };
    RF.forEach((f) => { r[f[0]] = Number($('zr-' + f[0]).value) || 0; });
    KF.forEach((f) => { r.kotva[f[0]] = Number($('zk-' + f[0]).value) || 0; });
    return r;
  }

  function init(o) {
    db = o.db || null; dls = o.dls || null; canEdit = !!o.canEdit;
    if (db) db.doc('nastaveni/cenik-zabradli').onSnapshot((s) => { if (s.exists) { rates = Zb.rates0(s.data()); fillRates(); render(); } }, () => {});
  }

  function wire() {
    if (!$('p-zab')) return;
    ['zName', 'zNum'].forEach((k) => $(k).addEventListener('input', renderFiles));
    document.querySelectorAll('#p-zab .vbar button').forEach((b) => b.addEventListener('click', () => { if (viewer) viewer.view(b.dataset.view); }));
    $('zctx').addEventListener('change', (e) => { ctx = e.target.checked; render(); });
    $('zEdit').addEventListener('click', () => { try { localStorage.setItem('zabradli-cfg', JSON.stringify(cfg)); } catch (e) {} window.open('zabradli.html', '_blank'); });
    $('zDl').addEventListener('click', async () => {
      let g;
      try { g = generate(order(), rates); } catch (e) { msg('Generování selhalo: ' + esc(e.message), 'bad'); return; }
      if (g.problems.length) { msg('Kontrola našla chyby: ' + esc(g.problems.join(', ')) + '. Zip nestahuj, pošli konfiguraci k opravě.', 'bad'); return; }
      if (!dls) { msg('Stahování souborů není na tomto zobrazení dostupné.', 'bad'); return; }
      try { await dls.save({ filename: g.filename, data: new Blob([g.bytes]) }); msg('Staženo: <span class="mono">' + esc(g.filename) + '</span> – ' + g.files.length + ' souborů, kontrola těles bez chyb.', 'ok'); }
      catch (e) { msg(e && e.code === 'declined' ? 'Stažení jsi zrušil.' : 'Stažení se nepovedlo (' + esc(e && e.code || 'chyba') + ').', e && e.code === 'declined' ? '' : 'bad'); }
    });
    $('zCodeLoad').addEventListener('click', () => {
      try { const s = $('zCodeIn').value.trim().replace(/^ZABRADLI:/, ''); current = null; cfg = Zb.normalize(JSON.parse(decodeURIComponent(escape(atob(s))))); render(); $('zCodeMsg').textContent = 'Načteno: ' + Zb.describe(cfg); }
      catch (e) { $('zCodeMsg').textContent = 'Kód nejde přečíst – zkontroluj, že je zkopírovaný celý.'; }
    });
    $('zSaveRates').addEventListener('click', async () => {
      const r = readRates();
      if (!db || !canEdit) { $('zRateMsg').textContent = 'Uložit může jen editor.'; return; }
      try { await db.doc('nastaveni/cenik-zabradli').set(r); $('zRateMsg').textContent = 'Uloženo – platí i na stránce Zábradlí.'; } catch (e) { $('zRateMsg').textContent = 'Uložení se nepovedlo (' + (e && e.code) + ').'; }
    });
    $('zResetRates').addEventListener('click', () => { rates = Zb.rates0(); fillRates(); $('zRateMsg').textContent = 'Výchozí hodnoty – ulož, aby platily.'; });
    fillRates();
    open(null);
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire(); }

  root.ZabDilna = { init, open, render, generate, describe: (c) => Zb.describe(c) };
})(typeof window !== 'undefined' ? window : globalThis);
