/*
 * export.js – výstupy pro dílnu: DXF (C2), STEP (K2 + sestava), kusovník PDF/CSV,
 *             text objednávky a ZIP balík. Vše běží v prohlížeči, bez knihoven.
 */
(function (root) {
  "use strict";
  const B = root.BREP;

  // ---------- pomůcky ----------
  const r1 = (x) => Math.round(x * 10) / 10;
  const fmtLen = (x) => typeof x === "string" ? x : (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : String(r1(x)).replace(".", ","));
  const kg = (x) => x.toFixed(2).replace(".", ",");
  const ascii = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/×/g, "x");
  const safe = (s) => ascii(s).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const pad = (n) => String(n).padStart(2, "0");

  function orderNumber(d) {
    d = d || new Date();
    return "K" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes());
  }

  // ---------- DXF (R12, mm) ----------
  function dxfPlate(plate, name) {
    const L = [];
    const w = (code, val) => L.push(String(code), String(val));
    const num = (x) => (Math.abs(x) < 1e-9 ? 0 : x).toFixed(4);
    w(999, ascii(name || "dil"));
    w(0, "SECTION"); w(2, "HEADER");
    w(9, "$ACADVER"); w(1, "AC1009");
    w(9, "$INSUNITS"); w(70, 4);
    w(9, "$EXTMIN"); w(10, 0); w(20, 0); w(30, 0);
    w(9, "$EXTMAX"); w(10, num(plate.b)); w(20, num(plate.h)); w(30, 0);
    w(0, "ENDSEC");
    w(0, "SECTION"); w(2, "TABLES");
    w(0, "TABLE"); w(2, "LAYER"); w(70, 1);
    w(0, "LAYER"); w(2, "0"); w(70, 0); w(62, 7); w(6, "CONTINUOUS");
    w(0, "ENDTAB"); w(0, "ENDSEC");
    w(0, "SECTION"); w(2, "ENTITIES");
    const P = [[0, 0], [plate.b, 0], [plate.b, plate.h], [0, plate.h]];
    for (let i = 0; i < 4; i++) {
      const a = P[i], b = P[(i + 1) % 4];
      w(0, "LINE"); w(8, "0"); w(10, num(a[0])); w(20, num(a[1])); w(30, 0); w(11, num(b[0])); w(21, num(b[1])); w(31, 0);
    }
    for (const h of plate.holes || []) {
      w(0, "CIRCLE"); w(8, "0"); w(10, num(h.x + plate.b / 2)); w(20, num(h.y + plate.h / 2)); w(30, 0); w(40, num(h.d / 2));
    }
    w(0, "ENDSEC"); w(0, "EOF");
    return L.join("\r\n") + "\r\n";
  }

  // ---------- ZIP (bez komprese) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const enc = (s) => new TextEncoder().encode(s);
  function toBytes(d) { return d instanceof Uint8Array ? d : enc(d); }

  function zip(files, date) {
    date = date || new Date();
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc(f.path), data = toBytes(f.data), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      chunks.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, a) => s + a.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    const all = chunks.concat(central, [new Uint8Array(e.buffer)]);
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  // ---------- PDF (A4 na šířku, vložené písmo Liberation Sans) ----------
  function makePdf(draw) {
    const FD = root.PDF_FONT;
    const codeOf = {};
    [...FD.chars].forEach((ch, i) => { codeOf[ch] = i < 95 ? 32 + i : 128 + (i - 95); });
    const nExtra = FD.chars.length - 95;
    const encodeText = (s) => {
      let out = "";
      for (const ch of String(s)) {
        let c = codeOf[ch];
        if (c === undefined) c = codeOf[ascii(ch)[0]] || 63;
        if (c === 40 || c === 41 || c === 92) out += "\\" + String.fromCharCode(c);
        else if (c < 128) out += String.fromCharCode(c);
        else out += "\\" + c.toString(8).padStart(3, "0");
      }
      return out;
    };
    const widthOf = (s, font, size) => {
      const f = FD.fonts[font]; let wsum = 0;
      for (const ch of String(s)) { const i = FD.chars.indexOf(ch); wsum += i >= 0 ? f.widths[i] : 556; }
      return (wsum * size) / 1000;
    };

    // stránky
    const pages = [];
    let cur = null;
    const W = 842, H = 595;
    const api = {
      W, H,
      newPage() { cur = []; pages.push(cur); },
      text(x, y, s, o) {
        o = o || {}; const size = o.size || 9, font = o.bold ? "F2" : "F1";
        let tx = x; const w = widthOf(s, o.bold ? "bold" : "regular", size);
        if (o.align === "right") tx = x - w; else if (o.align === "center") tx = x - w / 2;
        cur.push((o.color || "0 0 0") + " rg BT /" + font + " " + size + " Tf " + tx.toFixed(2) + " " + (H - y).toFixed(2) + " Td (" + encodeText(s) + ") Tj ET");
      },
      width: (s, size, bold) => widthOf(s, bold ? "bold" : "regular", size || 9),
      line(x1, y1, x2, y2, o) { o = o || {}; cur.push((o.color || "0 0 0") + " RG " + (o.w || 0.5) + " w " + x1.toFixed(2) + " " + (H - y1).toFixed(2) + " m " + x2.toFixed(2) + " " + (H - y2).toFixed(2) + " l S"); },
      rect(x, y, w, h, fill) { cur.push(fill + " rg " + x.toFixed(2) + " " + (H - y - h).toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re f"); }
    };
    draw(api);

    // objekty
    const objs = []; // {id, parts:[string|Uint8Array]}
    const addObj = (parts) => { objs.push(parts); return objs.length; };
    const fontObjs = {};
    for (const [key, res] of [["regular", "F1"], ["bold", "F2"]]) {
      const f = FD.fonts[key];
      const bin = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
      const ff = addObj(["<< /Length " + bin.length + " /Length1 " + bin.length + " >>\nstream\n", bin, "\nendstream"]);
      const psName = "AAAAAA+" + f.psName.replace(/[^A-Za-z0-9-]/g, "");
      const fd = addObj(["<< /Type /FontDescriptor /FontName /" + psName + " /Flags 32 /FontBBox [" + f.bbox.join(" ") + "] /ItalicAngle 0 /Ascent " + f.ascent + " /Descent " + f.descent + " /CapHeight " + f.capHeight + " /StemV " + (key === "bold" ? 140 : 80) + " /FontFile2 " + ff + " 0 R >>"]);
      const widths = [];
      for (let c = 32; c < 128 + nExtra; c++) {
        if (c < 127) widths.push(f.widths[c - 32]); else if (c < 128) widths.push(0); else widths.push(f.widths[95 + c - 128]);
      }
      const diffs = "128 " + f.names.slice(95).map((n) => "/" + n).join(" ");
      // ToUnicode pro kopírování textu
      let cmap = "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange\n";
      const pairs = [...FD.chars].map((ch, i) => [i < 95 ? 32 + i : 128 + i - 95, ch.codePointAt(0)]);
      for (let i = 0; i < pairs.length; i += 100) {
        const chunk = pairs.slice(i, i + 100);
        cmap += chunk.length + " beginbfchar\n" + chunk.map(([c, u]) => "<" + c.toString(16).padStart(2, "0") + "> <" + u.toString(16).padStart(4, "0") + ">").join("\n") + "\nendbfchar\n";
      }
      cmap += "endcmap CMapName currentdict /CMap defineresource pop end end";
      const tu = addObj(["<< /Length " + cmap.length + " >>\nstream\n" + cmap + "\nendstream"]);
      fontObjs[res] = addObj(["<< /Type /Font /Subtype /TrueType /BaseFont /" + psName + " /FirstChar 32 /LastChar " + (127 + nExtra) + " /Widths [" + widths.join(" ") + "] /FontDescriptor " + fd + " 0 R /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [" + diffs + "] >> /ToUnicode " + tu + " 0 R >>"]);
    }
    const pagesId = objs.length + 1 + pages.length * 2; // rezervace
    const pageIds = [];
    for (const pg of pages) {
      const content = pg.join("\n");
      const cId = addObj(["<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream"]);
      pageIds.push(addObj(["<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 " + fontObjs.F1 + " 0 R /F2 " + fontObjs.F2 + " 0 R >> >> /Contents " + cId + " 0 R >>"]));
    }
    const pid = addObj(["<< /Type /Pages /Kids [" + pageIds.map((i) => i + " 0 R").join(" ") + "] /Count " + pageIds.length + " >>"]);
    if (pid !== pagesId) throw new Error("PDF: chybné číslování objektů");
    const cat = addObj(["<< /Type /Catalog /Pages " + pid + " 0 R >>"]);

    // serializace
    const bytes = [];
    let pos = 0;
    const push = (x) => { const b = typeof x === "string" ? Uint8Array.from(x, (c) => c.charCodeAt(0) & 0xff) : x; bytes.push(b); pos += b.length; };
    push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    const offs = [];
    objs.forEach((parts, i) => { offs.push(pos); push((i + 1) + " 0 obj\n"); parts.forEach(push); push("\nendobj\n"); });
    const xref = pos;
    push("xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join(""));
    push("trailer\n<< /Size " + (objs.length + 1) + " /Root " + cat + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    const out = new Uint8Array(pos); let p = 0; for (const b of bytes) { out.set(b, p); p += b.length; }
    return out;
  }

  // ---------- kusovník ----------
  function bomRows(model, pocet) {
    return model.parts.map((p) => ({
      pos: p.pos, name: p.name, profil: p.kind === "C2" ? "plech " + p.profile.id : "jekl " + p.profile.id,
      delka: p.kind === "C2" ? p.plate.b + "×" + p.plate.h + "×" + p.plate.t : p.length, ksPodnoz: p.qty, ksCelkem: p.qty * pocet,
      kg1: p.mass1, kgCelkem: p.mass1 * p.qty * pocet, stroj: p.kind === "K2" ? "Bodor K2" : "Bodor C2",
      rez: p.cut || "", pozn: p.note || "", soubor: p.fileName
    }));
  }

  function bomCsv(model, order) {
    const rows = bomRows(model, order.pocet);
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const head = ["Pozice", "Název", "Materiál / profil", "Délka [mm]", "Ks / podnož", "Ks celkem", "kg / ks", "kg celkem", "Stroj", "Řez", "Poznámka", "Soubor"];
    const lines = [head.map(q).join(";")];
    for (const r of rows) lines.push([r.pos, r.name, r.profil, fmtLen(r.delka), r.ksPodnoz, r.ksCelkem, kg(r.kg1), kg(r.kgCelkem), r.stroj, r.rez, r.pozn, r.soubor].map(q).join(";"));
    lines.push(["", "Celkem", "", "", model.pieces, model.pieces * order.pocet, "", kg(model.mass * order.pocet), "", "", "", ""].map(q).join(";"));
    return "﻿" + lines.join("\r\n") + "\r\n";
  }

  function bomPdf(model, order) {
    const rows = bomRows(model, order.pocet);
    const d = model.dims, par = model.params;
    return makePdf((pdf) => {
      pdf.newPage();
      const M = 36;
      pdf.rect(0, 0, pdf.W, 64, "0.13 0.16 0.20");
      pdf.text(M, 30, "Kusovník – podnož stolu", { size: 17, bold: true, color: "1 1 1" });
      pdf.text(M, 48, "Zakázka " + order.cislo + "   ·   " + order.datumText, { size: 10, color: "0.8 0.84 0.9" });
      pdf.text(pdf.W - M, 30, order.zakaznik.jmeno || "", { size: 12, bold: true, color: "1 1 1", align: "right" });
      pdf.text(pdf.W - M, 48, [order.zakaznik.email, order.zakaznik.telefon].filter(Boolean).join("   ·   "), { size: 9, color: "0.8 0.84 0.9", align: "right" });

      let y = 92;
      const info = [
        ["Podnož (vnější rozměr)", fmtLen(d.L) + " × " + fmtLen(d.W) + " × " + fmtLen(d.H) + " mm"],
        ["Deska (není součástí)", fmtLen(d.deskaL) + " × " + fmtLen(d.deskaW) + " × " + fmtLen(d.deskaT) + " mm, přesah " + par.presah + " mm"],
        ["Profil nohy / rámu", par.profilNohy + "  /  " + par.profilRamu],
        ["Povrch", order.povrchNazev],
        ["Počet podnoží", String(order.pocet) + " ks"],
        ["Hmotnost", kg(model.mass) + " kg / podnož,  " + kg(model.mass * order.pocet) + " kg celkem"]
      ];
      info.forEach(([k, v], i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = M + col * 390, yy = y + row * 17;
        pdf.text(x, yy, k, { size: 9, color: "0.4 0.43 0.48" });
        pdf.text(x + 140, yy, v, { size: 9.5, bold: true });
      });
      y += 3 * 17 + 18;

      const cols = [
        { k: "pos", t: "Poz.", w: 34 }, { k: "name", t: "Název", w: 92 }, { k: "profil", t: "Materiál / profil", w: 108 },
        { k: "delka", t: "Délka", w: 50, r: true, f: (v) => fmtLen(v) }, { k: "ksPodnoz", t: "Ks/podn.", w: 50, r: true },
        { k: "ksCelkem", t: "Ks celk.", w: 50, r: true, b: true }, { k: "kg1", t: "kg/ks", w: 46, r: true, f: kg },
        { k: "kgCelkem", t: "kg celk.", w: 52, r: true, f: kg }, { k: "stroj", t: "Stroj", w: 62 }, { k: "rez", t: "Řez", w: 58 },
        { k: "pozn", t: "Poznámka", w: 168 }
      ];
      const tableW = cols.reduce((s, c) => s + c.w, 0);
      pdf.rect(M, y - 13, tableW, 19, "0.92 0.93 0.95");
      let x = M;
      for (const c of cols) { pdf.text(c.r ? x + c.w - 6 : x + 5, y, c.t, { size: 8.5, bold: true, align: c.r ? "right" : "left" }); x += c.w; }
      y += 6;
      pdf.line(M, y, M + tableW, y, { w: 0.8 });
      rows.forEach((r, i) => {
        y += 18;
        if (i % 2) pdf.rect(M, y - 12.5, tableW, 18, "0.975 0.978 0.985");
        x = M;
        for (const c of cols) {
          let v = c.f ? c.f(r[c.k]) : String(r[c.k]);
          const maxW = c.w - 10;
          while (v.length > 3 && pdf.width(v, 8.5, c.b) > maxW) v = v.slice(0, -2) + "…";
          pdf.text(c.r ? x + c.w - 6 : x + 5, y, v, { size: 8.5, bold: !!c.b || c.k === "pos", align: c.r ? "right" : "left" });
          x += c.w;
        }
      });
      y += 8;
      pdf.line(M, y, M + tableW, y, { w: 0.8 });
      y += 16;
      pdf.text(M + 5, y, "Celkem", { size: 9, bold: true });
      pdf.text(M + 34 + 92 + 108 + 50 + 50 + 50 - 6, y, String(model.pieces * order.pocet), { size: 9, bold: true, align: "right" });
      pdf.text(M + 34 + 92 + 108 + 50 + 50 + 50 + 46 + 52 - 6, y, kg(model.mass * order.pocet) + " kg", { size: 9, bold: true, align: "right" });

      y += 30;
      pdf.text(M, y, "Soubory pro výrobu", { size: 10, bold: true });
      y += 15;
      for (const r of rows) { pdf.text(M, y, r.pos + "   " + r.stroj + "   dily/" + (r.stroj.endsWith("K2") ? "K2" : "C2") + "/" + r.soubor, { size: 8.5, color: "0.25 0.28 0.32" }); y += 13; }
      y += 6;
      pdf.text(M, y, "Materiál " + root.KATALOG.material.nazev + ". Délky jeklů jsou přířezové (řez 90°). Hmotnost vypočtena z geometrie (7850 kg/m³).", { size: 8, color: "0.4 0.43 0.48" });
      if (order.poznamka) { y += 14; pdf.text(M, y, "Poznámka zákazníka: " + order.poznamka, { size: 8.5 }); }
      pdf.text(pdf.W - M, pdf.H - 20, "Vygenerováno konfigurátorem – TESTOVACÍ VERZE", { size: 7.5, color: "0.55 0.58 0.62", align: "right" });
    });
  }

  // ---------- balík zakázky ----------
  function buildPackage(model, order) {
    const pocet = order.pocet;
    const folder = safe(order.zakaznik.jmeno || "zakaznik") + "_" + order.cislo;
    const files = [];
    // názvy souborů dílů (délka + počet kusů)
    for (const p of model.parts) {
      const ks = p.qty * pocet;
      p.fileName = p.kind === "K2"
        ? safe(p.pos + "_" + p.name + "_" + p.profile.id + "_L" + fmtLen(p.length).replace(",", "-")) + "_" + ks + "ks.step"
        : safe(p.pos + "_" + p.name + "_" + p.profile.id.replace(/\s/g, "_")) + "_" + ks + "ks.dxf";
    }
    // sestava
    const bodies = [];
    for (const p of model.parts) p.instances.forEach((xf, i) => bodies.push({ solid: p.solid, xf, name: p.pos + " " + p.name + " " + (i + 1) + "/" + p.qty }));
    files.push({ path: folder + "/sestava.step", data: B.toStep(bodies, { name: folder + "_sestava", fileName: "sestava.step", org: order.firma || "" }), mime: "application/step" });
    // kusovník
    files.push({ path: folder + "/kusovnik.pdf", data: bomPdf(model, order), mime: "application/pdf" });
    files.push({ path: folder + "/kusovnik.csv", data: bomCsv(model, order), mime: "text/csv" });
    // díly
    for (const p of model.parts) {
      if (p.kind === "K2") {
        files.push({ path: folder + "/dily/K2/" + p.fileName, data: B.toStep([{ solid: p.solid, xf: p.productionXf, name: p.pos + " " + p.name }], { name: p.pos + "_" + safe(p.name), fileName: p.fileName }), mime: "application/step" });
      } else {
        files.push({ path: folder + "/dily/C2/" + p.fileName, data: dxfPlate(p.plate, p.pos + " " + p.name + " " + p.profile.id), mime: "application/dxf" });
      }
    }
    const mail = mailText(model, order, files, folder);
    files.push({ path: folder + "/objednavka.txt", data: "﻿" + mail.subject + "\r\n\r\n" + mail.body.replace(/\n/g, "\r\n"), mime: "text/plain" });
    files.push({ path: folder + "/objednavka.json", data: JSON.stringify({ cislo: order.cislo, datum: order.datum, zakaznik: order.zakaznik, pocet, povrch: order.povrch, poznamka: order.poznamka, parametry: model.params, rozmery: model.dims, hmotnost_kg: +(model.mass * pocet).toFixed(3), kusovnik: bomRows(model, pocet) }, null, 2), mime: "application/json" });
    return { folder, files, mail, zipName: folder + ".zip" };
  }

  function mailText(model, order, files, folder) {
    const d = model.dims, par = model.params;
    const subject = "Nová objednávka " + order.cislo + " – " + (order.zakaznik.jmeno || "?") + " – podnož " + fmtLen(d.L) + "×" + fmtLen(d.W) + "×" + fmtLen(d.H) + ", " + order.pocet + " ks";
    const rows = bomRows(model, order.pocet).map((r) => "  " + r.pos.padEnd(4) + r.name.padEnd(16) + r.profil.padEnd(22) + (fmtLen(r.delka) + " mm").padStart(10) + (r.ksCelkem + " ks").padStart(8) + "   " + r.stroj);
    const body = [
      "Zákazník:  " + (order.zakaznik.jmeno || ""),
      "E-mail:    " + (order.zakaznik.email || ""),
      "Telefon:   " + (order.zakaznik.telefon || ""),
      order.zakaznik.adresa ? "Adresa:    " + order.zakaznik.adresa : null,
      "",
      "Konfigurace",
      "  Deska:      " + fmtLen(d.deskaL) + " × " + fmtLen(d.deskaW) + " × " + fmtLen(d.deskaT) + " mm (dodá zákazník), přesah " + par.presah + " mm",
      "  Podnož:     " + fmtLen(d.L) + " × " + fmtLen(d.W) + " × " + fmtLen(d.H) + " mm (výška stolu " + par.vyskaStolu + " mm)",
      "  Nohy:       jekl " + par.profilNohy + (par.patky ? ", patky s maticí M8" : ", zátky"),
      "  Rám:        jekl " + par.profilRamu + (par.otvoryDeska ? ", otvory pro šrouby desky" : ""),
      "  Spodní příčky: " + (par.spodniPricky ? "ano, " + par.vyskaPricky + " mm nad podlahou" : "ne"),
      "  Povrch:     " + order.povrchNazev,
      "  Počet:      " + order.pocet + " ks",
      "  Hmotnost:   " + kg(model.mass) + " kg / ks, celkem " + kg(model.mass * order.pocet) + " kg",
      "",
      "Kusovník",
      ...rows,
      "",
      order.poznamka ? "Poznámka zákazníka: " + order.poznamka + "\n" : null,
      "Přílohy (složka " + folder + "):",
      ...files.map((f) => "  " + f.path.slice(folder.length + 1)),
      "",
      "Platba: zatím není zapojena (testovací verze) – faktura se doplní později.",
      "Cena: bude doplněna z ceníku."
    ].filter((x) => x !== null).join("\n");
    return { subject, body };
  }

  root.EXPORT = { dxfPlate, zip, crc32, makePdf, bomCsv, bomPdf, buildPackage, orderNumber, fmtLen, kg, safe };
})(typeof window !== "undefined" ? window : globalThis);
