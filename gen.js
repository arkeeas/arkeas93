/* Generátor výrobních podkladů v prohlížeči: STEP (jekly, sestava), DXF (plechy), PDF (kusovník, doklad), ZIP.
   Jen pro interní stránku dílny. Potřebuje core.js. */
(function (root) {
  'use strict';
  const K = root.Podnoze, V = K.V;

  /* ---------- STEP AP214, tělesa z rovinných ploch ---------- */
  function fnum(x) {
    let v = Number(x);
    if (Math.abs(v) < 1e-12) v = 0;
    let s = String(Math.round(v * 1e9) / 1e9);
    if (s.indexOf('e') >= 0) { const [m, e] = s.split('e'); return (m.indexOf('.') < 0 ? m + '.' : m) + 'E' + parseInt(e, 10); }
    return s.indexOf('.') < 0 ? s + '.' : s;
  }
  function newell(P) {
    const n = [0, 0, 0];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return n;
  }
  function orient(verts, f) {
    let outer = f.outer.slice();
    if (V.dot(newell(outer.map((i) => verts[i])), f.n) < 0) outer.reverse();
    const inner = f.inner.map((lp) => { lp = lp.slice(); if (V.dot(newell(lp.map((i) => verts[i])), f.n) > 0) lp.reverse(); return lp; });
    return { outer, inner, n: f.n };
  }
  function checkClosed(verts, faces) {
    const cnt = {};
    faces.forEach((f) => { const o = orient(verts, f); [o.outer].concat(o.inner).forEach((lp) => lp.forEach((a, i) => { const k = a + '>' + lp[(i + 1) % lp.length]; cnt[k] = (cnt[k] || 0) + 1; })); });
    return Object.keys(cnt).every((k) => { const [a, b] = k.split('>'); return cnt[k] === 1 && cnt[b + '>' + a] === 1; });
  }
  function stepFile(name, bodies) {
    const L = []; let n = 0;
    const add = (t) => { n++; L.push('#' + n + '=' + t + ';'); return '#' + n; };
    const pt = (p) => add("CARTESIAN_POINT('',(" + fnum(p[0]) + ',' + fnum(p[1]) + ',' + fnum(p[2]) + '))');
    const dir = (d) => { d = V.unit(d); return add("DIRECTION('',(" + fnum(d[0]) + ',' + fnum(d[1]) + ',' + fnum(d[2]) + '))'); };
    const axis = (p, z, x) => add("AXIS2_PLACEMENT_3D(''," + pt(p) + ',' + dir(z) + ',' + dir(x) + ')');
    const ac = add("APPLICATION_CONTEXT('automotive design')");
    add("APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000," + ac + ')');
    const pc = add("PRODUCT_CONTEXT(''," + ac + ",'mechanical')");
    const prod = add("PRODUCT('" + name + "','" + name + "','',(" + pc + '))');
    const pdf = add("PRODUCT_DEFINITION_FORMATION('',''," + prod + ')');
    const pdc = add("PRODUCT_DEFINITION_CONTEXT('part definition'," + ac + ",'design')");
    const pd = add("PRODUCT_DEFINITION('design',''," + pdf + ',' + pdc + ')');
    const pds = add("PRODUCT_DEFINITION_SHAPE(''," + "''," + pd + ')');
    const mm = add('( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )');
    const rad = add('( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )');
    const sr = add('( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )');
    const unc = add('UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),' + mm + ",'distance_accuracy_value','confusion accuracy')");
    const ctx = add('( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((' + unc + ')) GLOBAL_UNIT_ASSIGNED_CONTEXT((' + mm + ',' + rad + ',' + sr + ")) REPRESENTATION_CONTEXT('',''))");
    const origin = axis([0, 0, 0], [0, 0, 1], [1, 0, 0]);
    const solids = bodies.map((b) => {
      const vp = b.verts.map((p) => add("VERTEX_POINT(''," + pt(p) + ')'));
      const edges = {};
      const edge = (a, c) => {
        const lo = Math.min(a, c), hi = Math.max(a, c), key = lo + '_' + hi;
        if (!edges[key]) {
          const d = V.sub(b.verts[hi], b.verts[lo]);
          const vec = add("VECTOR(''," + dir(d) + ',' + fnum(V.len(d)) + ')');
          const line = add("LINE(''," + pt(b.verts[lo]) + ',' + vec + ')');
          edges[key] = add("EDGE_CURVE(''," + vp[lo] + ',' + vp[hi] + ',' + line + ',.T.)');
        }
        return [edges[key], a === lo ? '.T.' : '.F.'];
      };
      const fids = b.faces.map((f0) => {
        const f = orient(b.verts, f0);
        const bounds = [f.outer].concat(f.inner).map((lp, k) => {
          const oes = lp.map((a, i) => { const e = edge(a, lp[(i + 1) % lp.length]); return add("ORIENTED_EDGE('',*,*," + e[0] + ',' + e[1] + ')'); });
          const loop = add("EDGE_LOOP('',(" + oes.join(',') + '))');
          return add((k === 0 ? 'FACE_OUTER_BOUND' : 'FACE_BOUND') + "(''," + loop + ',.T.)');
        });
        const nrm = V.unit(f.n);
        let xd = V.sub(b.verts[f.outer[1]], b.verts[f.outer[0]]);
        xd = V.sub(xd, V.mul(nrm, V.dot(xd, nrm)));
        const pl = add("PLANE(''," + axis(b.verts[f.outer[0]], nrm, xd) + ')');
        return add("ADVANCED_FACE('',(" + bounds.join(',') + '),' + pl + ',.T.)');
      });
      const shell = add("CLOSED_SHELL('',(" + fids.join(',') + '))');
      return add("MANIFOLD_SOLID_BREP(''," + shell + ')');
    });
    const rep = add("ADVANCED_BREP_SHAPE_REPRESENTATION('" + name + "',(" + solids.concat([origin]).join(',') + '),' + ctx + ')');
    add('SHAPE_DEFINITION_REPRESENTATION(' + pds + ',' + rep + ')');
    const ts = new Date().toISOString().slice(0, 19);
    return ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('Konfigurator podnozi'),'2;1');",
      "FILE_NAME('" + name + ".step','" + ts + "',(''),(''),'konfigurator','konfigurator','');",
      "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));", 'ENDSEC;', 'DATA;']
      .concat(L, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n') + '\n';
  }

  /* ---------- DXF R12: vrstva REZ (obrys, otvory) + ZNACENI (číslo dílu) ---------- */
  function dxf(p) {
    const e = [];
    const line = (a, b) => e.push('0', 'LINE', '8', 'REZ', '10', a[0], '20', a[1], '30', 0, '11', b[0], '21', b[1], '31', 0);
    const pts = p.poly || [[0, 0], [p.w, 0], [p.w, p.l], [0, p.l]];   // obrys (obecný polygon nebo obdélník w × l)
    for (let i = 0; i < pts.length; i++) line(pts[i], pts[(i + 1) % pts.length]);
    (p.holes || []).forEach((hh) => e.push('0', 'CIRCLE', '8', 'REZ', '10', hh[0], '20', hh[1], '30', 0, '40', hh[2]));
    // podélné otvory (ovály) [cx, cy, délka, šířka] podél osy X
    (p.ovals || []).forEach(([cx, cy, L, w]) => {
      const r = w / 2, hl = (L - w) / 2;
      line([cx - hl, cy - r], [cx + hl, cy - r]); line([cx + hl, cy + r], [cx - hl, cy + r]);
      e.push('0', 'ARC', '8', 'REZ', '10', cx + hl, '20', cy, '30', 0, '40', r, '50', 270, '51', 90);
      e.push('0', 'ARC', '8', 'REZ', '10', cx - hl, '20', cy, '30', 0, '40', r, '50', 90, '51', 270);
    });
    e.push('0', 'TEXT', '8', 'ZNACENI', '10', 3, '20', 3, '30', 0, '40', 4, '1', p.poz);
    const lay = [];
    [['REZ', 7], ['ZNACENI', 1]].forEach(([nm, c]) => lay.push('0', 'LAYER', '2', nm, '70', 0, '62', c, '6', 'CONTINUOUS'));
    return ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', 4, '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', 2].concat(lay, ['0', 'ENDTAB', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES'], e, ['0', 'ENDSEC', '0', 'EOF']).join('\n') + '\n';
  }

  /* ---------- ZIP (bez komprese, názvy v UTF-8) ---------- */
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (d) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const parts = [], central = []; let off = 0;
    const now = new Date();
    const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    files.forEach((f) => {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    const csize = central.reduce((a, p) => a + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return concat(parts.concat(central, [new Uint8Array(e.buffer)]));
  }
  function concat(arrs) { const n = arrs.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0; arrs.forEach((p) => { out.set(p, o); o += p.length; }); return out; }

  /* ---------- PDF ze stránek vykreslených na canvas (JPEG na A4) ---------- */
  function pdfFromCanvases(canvases) {
    const chunks = [], offs = []; let pos = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); pos += b.length; };
    const obj = (id, body) => { offs[id] = pos; push(id + ' 0 obj\n'); body.forEach(push); push('\nendobj\n'); };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const W = 595.28, H = 841.89, np = canvases.length;
    const kids = []; for (let i = 0; i < np; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    obj(2, ['<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + np + ' >>']);
    canvases.forEach((cv, i) => {
      const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
      const b64 = cv.toDataURL('image/jpeg', 0.9).split(',')[1], bin = atob(b64), img = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) img[k] = bin.charCodeAt(k);
      const cs = 'q ' + W.toFixed(2) + ' 0 0 ' + H.toFixed(2) + ' 0 0 cm /Im0 Do Q';
      obj(pid, ['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>']);
      obj(cid, ['<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream']);
      obj(iid, ['<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n', img, '\nendstream']);
    });
    const n = 3 + np * 3, xref = pos;
    let x = 'xref\n0 ' + n + '\n0000000000 65535 f \n';
    for (let i = 1; i < n; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + n + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return concat(chunks);
  }

  /* ---------- stránky A4 (150 dpi) ---------- */
  const PW = 1240, PH = 1754, FONT = '"IBM Plex Sans", "Segoe UI", Arial, sans-serif';
  function page() { const c = document.createElement('canvas'); c.width = PW; c.height = PH; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, PW, PH); x.fillStyle = '#111'; x.textBaseline = 'alphabetic'; return [c, x]; }
  function txt(x, s, px, py, size, bold, color, align) { x.font = (bold ? '600 ' : '400 ') + size + 'px ' + FONT; x.fillStyle = color || '#111'; x.textAlign = align || 'left'; x.fillText(s, px, py); }
  function fit(x, s, maxw, size, bold) {
    if (size) x.font = (bold ? '600 ' : '400 ') + size + 'px ' + FONT; if (x.measureText(s).width <= maxw) return s; while (s.length > 3 && x.measureText(s + '…').width > maxw) s = s.slice(0, -1); return s + '…'; }

  function kusovnikPage(order, A) {
    const [c, x] = page(), cfg = A.cfg, d = A.build.dims, M = 90;
    const F = K.FIN.find((f) => f.id === cfg.fin), S = K.SHAPES.find((s) => s.id === cfg.shape), Mo = K.modelInfo(cfg.model);
    txt(x, 'Kusovník – ' + order.number, M, 130, 44, true);
    const desk = cfg.shape === 'circle' ? 'Ø ' + cfg.L : cfg.L + ' × ' + cfg.W;
    const info = [['Zákazník', order.customer.name], ['Objednávka', order.number], ['Model', Mo.lab], ['Datum', order.date || ''],
      ['Stůl (deska)', desk + ' × ' + cfg.H + ' mm, ' + S.lab], ['Podnož', d.Lf + ' × ' + d.Wf + ' × ' + d.Hf + ' mm'],
      ['Jekl', cfg.size + '×' + cfg.size + '×' + cfg.t], ['Provedení', A.bolted ? 'šroubované' : 'svařované'],
      ['Povrch', F.lab + ' (' + F.ral + ')'], ['Počet sad', String(cfg.qty)]];
    info.forEach((r, i) => { const col = i % 2, row = Math.floor(i / 2), px = M + col * 540, py = 190 + row * 36; txt(x, r[0], px, py, 22, true); txt(x, fit(x, r[1], 330, 22), px + 170, py, 22, false); });
    // náhled
    const pv = document.createElement('canvas'); pv.width = 1000; pv.height = 620;
    const px2 = pv.getContext('2d'); px2.fillStyle = '#fff'; px2.fillRect(0, 0, 1000, 620);
    K.paint(px2, 1000, 620, K.previewBodies(A), { az: -35, el: 24, pad: 0.05 });
    x.drawImage(pv, (PW - 1000) / 2, 390);
    // tabulka
    const cols = [['Poz', 60], ['Díl', 200], ['Profil', 125], ['L [mm]', 100, 'right'], ['Řez 1 / 2', 145, 'right'], ['Ks', 45, 'right'], ['Celkem', 80, 'right'], ['Stroj', 60, 'right'], ['Soubor', 0]];
    let y = 1060;
    const row = (vals, bold) => {
      let px = M;
      vals.forEach((v, i) => { const w = cols[i][1] || (PW - M - px); const al = cols[i][2]; const s = fit(x, String(v), w - 12, 17, bold); txt(x, s, al === 'right' ? px + w - 12 : px, y, 17, bold, '#111', al === 'right' ? 'right' : 'left'); px += w; });
    };
    row(cols.map((c2) => c2[0]), true);
    x.fillStyle = '#111'; x.fillRect(M, y + 10, PW - 2 * M, 2); y += 44;
    A.rows.forEach((r) => { row([r.poz, r.name + (r.feat ? ' (' + r.feat + ')' : ''), r.prof, r.len, r.cut, r.q, r.q * cfg.qty, r.stroj, r.file], false); x.fillStyle = '#ccc'; x.fillRect(M, y + 12, PW - 2 * M, 1); y += 42; });
    y += 20;
    txt(x, 'Jekl celkem ' + K.nf(A.tubeM, 2) + ' m na sadu · hmotnost ' + K.nf(A.kg, 1) + ' kg na sadu · svarů ' + A.welds + ' · šroubových spojů ' + A.bolts, M, y, 19);
    txt(x, 'Řez = odklon řezné roviny od kolmého řezu. L = celková délka dílu včetně zámků. Drážky pro zámky mají vůli ' + String(A.R.tabClear).replace('.', ',') + ' mm na stranu.', M, y + 32, 19, false, '#555');
    if (order.note) txt(x, fit(x, 'Poznámka zákazníka: ' + order.note, PW - 2 * M, 19, true), M, y + 70, 19, true);
    return c;
  }

  function dokladPage(order, A) {
    const [c, x] = page(), M = 110, cfg = A.cfg;
    txt(x, 'TESTOVACÍ DOKLAD – NENÍ DAŇOVÝ DOKLAD', M, 140, 22, true, '#B3261E');
    txt(x, 'Doklad o zaplacení – ' + order.number, M, 200, 40, true);
    const L = ['Dodavatel: [NÁZEV FIRMY], [ADRESA], IČO [IČO], DIČ [DIČ]',
      'Odběratel: ' + order.customer.name + (order.customer.address ? ', ' + order.customer.address : '') + (order.customer.email ? ', ' + order.customer.email : ''),
      'Datum: ' + (order.date || '') + ' · Způsob úhrady: ' + (order.payment || '[DOPLNÍ PLATEBNÍ BRÁNA]')];
    L.forEach((s, i) => txt(x, fit(x, s, PW - 2 * M, 21), M, 260 + i * 34, 21));
    let y = 420;
    txt(x, 'Položka', M, y, 20, true); txt(x, 'Množství', 760, y, 20, true, '#111', 'right'); txt(x, 'Bez DPH', 950, y, 20, true, '#111', 'right'); txt(x, 'S DPH', PW - M, y, 20, true, '#111', 'right');
    x.fillStyle = '#111'; x.fillRect(M, y + 12, PW - 2 * M, 2); y += 50;
    const words = ('Podnož ' + K.describe(cfg)).split(' '); let l1 = '';
    x.font = '400 19px ' + FONT;
    while (words.length && x.measureText(l1 + words[0] + ' ').width < 520) l1 += words.shift() + ' ';
    txt(x, l1.trim(), M, y, 19); if (words.length) txt(x, fit(x, words.join(' '), 520, 19), M, y + 28, 19);
    txt(x, cfg.qty + ' ks', 760, y, 20, false, '#111', 'right');
    txt(x, K.nf(A.price * cfg.qty) + ' Kč', 950, y, 20, false, '#111', 'right');
    txt(x, K.nf(A.vat * cfg.qty) + ' Kč', PW - M, y, 20, false, '#111', 'right');
    x.fillStyle = '#ccc'; x.fillRect(M, y + 44, PW - 2 * M, 1);
    txt(x, 'Celkem s DPH 21 %: ' + K.nf(A.vat * cfg.qty) + ' Kč', PW - M, y + 100, 26, true, '#111', 'right');
    return c;
  }

  const asciiName = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');

  /* Celá objednávka -> {filename, bytes, files, problems} */
  function generateOrder(order, rates) {
    const A = K.analyze(order.config, rates);
    const num = asciiName(order.number) || 'OBJ';
    const dir = asciiName(order.customer.name || 'Zakaznik') + '_' + num + '/';
    const files = [], problems = A.problems.slice();
    A.rows.forEach((r) => {
      if (r.kind === 'hw') return;
      if (r.kind === 'tube') {
        const loc = K.toLocal(r.part);
        if (!checkClosed(loc.verts, loc.faces)) problems.push(r.poz + ': těleso není uzavřené');
        files.push({ name: dir + 'dily/K2/' + r.file, data: stepFile(r.poz + '_' + r.prof.replace('jekl ', '').replace(/×/g, 'x') + '_L' + Math.round(r.L), [loc]) });
      } else {
        files.push({ name: dir + 'dily/C2/' + r.file, data: dxf(r.plate) });
      }
    });
    const bodies = A.build.parts.map((p) => p.solid).concat(A.build.plateBoxes);
    bodies.forEach((b, i) => { if (!checkClosed(b.verts, b.faces)) problems.push('sestava: těleso ' + (i + 1) + ' není uzavřené'); });
    files.push({ name: dir + num + '_sestava.step', data: stepFile(num + '_sestava', bodies) });
    files.push({ name: dir + num + '_kusovnik.pdf', data: pdfFromCanvases([kusovnikPage(order, A)]) });
    files.push({ name: dir + num + '_doklad_o_zaplaceni.pdf', data: pdfFromCanvases([dokladPage(order, A)]) });
    if (A.mount) {   // umělecké podnože: postup uchycení k desce pro truhláře
      const k = A.mount, t = ['Uchycení podnože k desce – ' + k.M.lab, K.describe(A.cfg), '', 'Postup:']
        .concat(k.steps.map((x, i) => (i + 1) + '. ' + x), ['', 'Přibaleno (na 1 podnož):'], k.hw.map((h) => '- ' + h.q + '× ' + h.name), k.warns.length ? ['', 'Pozor:'].concat(k.warns.map((w) => '- ' + w)) : []);
      files.push({ name: dir + num + '_pro_truhlare.txt', data: '\ufeff' + t.join('\r\n') + '\r\n' });
    }
    return { filename: dir.slice(0, -1) + '.zip', bytes: zip(files), files: files.map((f) => f.name), problems, analysis: A };
  }

  root.Generator = { stepFile, dxf, zip, pdfFromCanvases, generateOrder, asciiName, checkClosed };
})(typeof window !== 'undefined' ? window : globalThis);
