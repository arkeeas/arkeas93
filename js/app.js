/*
 * app.js – propojení formuláře, 3D náhledu a testovací objednávky.
 */
(function () {
  "use strict";
  const K = window.KATALOG, G = window.GEOMETRY, B = window.BREP, X = window.EXPORT;
  const $ = (s) => document.querySelector(s);
  const form = $("#cfg");
  const REPO = "arkeeas/arkeas93";
  const POS_COLORS = ["#3b7dd8", "#e8671c", "#2aa876", "#b54fc9", "#d4a017", "#d9434f", "#16a3b8", "#7a8b99"];

  // Dílenský režim: index.html?dilna → barvy pozic, sloupec stroj. Zákazník to nevidí.
  const DILNA = new URLSearchParams(location.search).has("dilna");
  document.body.classList.toggle("dilna", DILNA);

  let viewer = null, model = null, lastGood = null;
  const ui = { deska: true, dims: true, colors: false };

  // ---------- naplnění formuláře ----------
  const fillSelect = (el, list) => { el.innerHTML = list.map((p) => `<option value="${p.id}">${p.id}  (t = ${p.t} mm)</option>`).join(""); };
  fillSelect($("#profilNohy"), K.profilyNohy);
  fillSelect($("#profilRamu"), K.profilyRamu);
  $("#povrchy").innerHTML = K.povrchy.map((p) => `<button type="button" data-id="${p.id}" title="${p.nazev}" style="background:${p.barva}"></button>`).join("");

  const ranges = { deskaDelka: K.limity.deskaDelka, deskaSirka: K.limity.deskaSirka, vyskaStolu: K.limity.vyskaStolu };
  for (const [id, [a, b]] of Object.entries(ranges)) {
    const r = form.querySelector(`input[type=range][data-for=${id}]`);
    r.min = a; r.max = b; r.step = id === "vyskaStolu" ? 5 : 10;
    const n = $("#" + id); n.min = a; n.max = b;
    r.addEventListener("input", () => { n.value = r.value; update(); });
    n.addEventListener("input", () => { r.value = n.value; });
  }

  let povrch = K.vychozi.povrch;
  function setPovrch(id) {
    povrch = id;
    document.querySelectorAll("#povrchy button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === id));
    $("#povrchNazev").textContent = (K.povrchy.find((p) => p.id === id) || {}).nazev || "";
  }
  $("#povrchy").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { setPovrch(b.dataset.id); update(); } });

  function setForm(p) {
    for (const k of ["deskaDelka", "deskaSirka", "tloustkaDesky", "presah", "vyskaStolu", "vyskaPricky", "pocet"]) {
      $("#" + k).value = p[k];
      const r = form.querySelector(`input[type=range][data-for=${k}]`); if (r) r.value = p[k];
    }
    $("#profilNohy").value = p.profilNohy; $("#profilRamu").value = p.profilRamu;
    form.querySelector(`input[name=patky][value="${p.patky ? 1 : 0}"]`).checked = true;
    $("#otvoryDeska").checked = !!p.otvoryDeska; $("#spodniPricky").checked = !!p.spodniPricky;
    setPovrch(p.povrch);
  }

  function readForm() {
    const n = (id) => parseFloat($("#" + id).value);
    return {
      deskaDelka: n("deskaDelka"), deskaSirka: n("deskaSirka"), tloustkaDesky: n("tloustkaDesky"), presah: n("presah"),
      vyskaStolu: n("vyskaStolu"), profilNohy: $("#profilNohy").value, profilRamu: $("#profilRamu").value,
      patky: form.querySelector("input[name=patky]:checked").value === "1",
      otvoryDeska: $("#otvoryDeska").checked, spodniPricky: $("#spodniPricky").checked, vyskaPricky: n("vyskaPricky"),
      povrch, pocet: Math.max(1, Math.round(n("pocet") || 1))
    };
  }

  // ---------- URL (sdílení konfigurace) ----------
  const KEYS = { deskaDelka: "d", deskaSirka: "s", tloustkaDesky: "t", presah: "p", vyskaStolu: "v", profilNohy: "n", profilRamu: "r", patky: "pk", otvoryDeska: "o", spodniPricky: "sp", vyskaPricky: "vp", povrch: "c", pocet: "q" };
  function toHash(p) { return "#" + Object.entries(KEYS).map(([k, s]) => s + "=" + encodeURIComponent(typeof p[k] === "boolean" ? (p[k] ? 1 : 0) : p[k])).join("&"); }
  function fromHash() {
    const h = new URLSearchParams(location.hash.slice(1)); const p = Object.assign({}, K.vychozi);
    for (const [k, s] of Object.entries(KEYS)) {
      if (!h.has(s)) continue; const v = h.get(s);
      p[k] = typeof K.vychozi[k] === "boolean" ? v === "1" : typeof K.vychozi[k] === "number" ? parseFloat(v) : v;
    }
    if (!K.profilyNohy.some((x) => x.id === p.profilNohy)) p.profilNohy = K.vychozi.profilNohy;
    if (!K.profilyRamu.some((x) => x.id === p.profilRamu)) p.profilRamu = K.vychozi.profilRamu;
    if (!K.povrchy.some((x) => x.id === p.povrch)) p.povrch = K.vychozi.povrch;
    return p;
  }

  // ---------- přepočet ----------
  let timer = 0;
  function update() { clearTimeout(timer); timer = setTimeout(recompute, 40); }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.querySelectorAll(".qty button").forEach((b) => b.addEventListener("click", () => { const i = $("#pocet"); i.value = Math.max(1, (parseInt(i.value) || 1) + +b.dataset.q); update(); }));

  const fmt = X.fmtLen;

  function recompute() {
    const par = readForm();
    $("#prickyBox").style.display = par.spodniPricky ? "" : "none";
    model = G.build(par);
    history.replaceState(null, "", toHash(par));
    updateIssueLink(par);

    const msgs = model.errors.map((e) => `<div class="msg err">${e}</div>`).concat(model.warnings.map((w) => `<div class="msg warn">${w}</div>`));
    $("#msgs").innerHTML = msgs.join("");
    const ok = !model.errors.length;
    $("#btnOrder").disabled = !ok;
    if (!ok) { $("#sDims").textContent = "–"; $("#sMass").textContent = "–"; return; }
    lastGood = model;
    const d = model.dims;
    $("#sDims").textContent = `${fmt(d.L)} × ${fmt(d.W)} × ${fmt(d.H)} mm`;
    $("#sMass").textContent = `${X.kg(model.mass)} kg` + (par.pocet > 1 ? ` · ${X.kg(model.mass * par.pocet)} kg celkem` : "");
    renderParts(par);
    renderScene(par);
  }

  function renderParts(par) {
    $("#partsBody").innerHTML = model.parts.map((p, i) => `
      <tr data-id="${p.pos}">
        <td>${DILNA ? `<span class="sw" style="background:${POS_COLORS[i % POS_COLORS.length]}"></span>` : ""}<b>${p.pos}</b></td>
        <td>${p.name}${p.note ? `<div class="note">${p.note}</div>` : ""}</td>
        <td>${p.kind === "C2" ? "plech " + p.profile.id : "jekl " + p.profile.id}</td>
        <td class="r">${p.kind === "C2" ? p.plate.b + "×" + p.plate.h : fmt(p.length)}</td>
        <td class="r">${p.qty * par.pocet}</td>
        <td class="r">${X.kg(p.mass1)}</td>
        <td class="dilna-only">${p.kind === "K2" ? "K2 – trubky" : "C2 – plech"}</td>
      </tr>`).join("");
    $("#partsMeta").textContent = `${model.pieces} dílů na podnož` + (par.pocet > 1 ? ` · ${model.pieces * par.pocet} celkem` : "");
  }
  $("#partsBody").addEventListener("mouseover", (e) => { const tr = e.target.closest("tr"); if (viewer && tr) viewer.setHighlight(tr.dataset.id); });
  $("#partsBody").addEventListener("mouseleave", () => viewer && viewer.setHighlight(null));

  function renderScene(par, forCustomer) {
    if (!viewer) return;
    const colorByPos = DILNA && ui.colors && !forCustomer;
    const pov = K.povrchy.find((p) => p.id === par.povrch) || K.povrchy[0];
    const parts = model.parts.map((p, i) => {
      const mesh = { pos: [], nor: [] }, marks = { pos: [], nor: [] };
      for (const xf of p.instances) { B.toMesh(p.solid, xf, mesh); B.holeMarks(p.solid, xf, marks); }
      return { id: p.pos, mesh, marks, color: colorByPos ? POS_COLORS[i % POS_COLORS.length] : pov.barva, metal: par.povrch === "surovy" ? 0.55 : 0.25 };
    });
    const d = model.dims;
    const bbMin = [0, 0, 0], bbMax = [d.L, d.W, d.H];
    if (ui.deska && d.deskaT > 0) {
      const pr = par.presah;
      const top = { loops: [B.roundedRect(d.deskaL, d.deskaW, 4).segs], length: d.deskaT, wallHoles: [] };
      const mesh = B.toMesh(top, B.Xf.make([1, 0, 0], [0, 1, 0], [0, 0, 1], [d.L / 2, d.W / 2, d.H]));
      parts.push({ id: "deska", mesh, color: "#c9a27a", alpha: 0.5, metal: 0.05 });
      bbMin[0] = -pr; bbMin[1] = -pr; bbMax[0] = d.L + pr; bbMax[1] = d.W + pr; bbMax[2] = d.H + d.deskaT;
    }
    viewer.showDims = ui.dims;
    viewer.setScene(parts, [bbMin, bbMax], d);
  }

  // ---------- nástroje náhledu ----------
  $("#tDeska").addEventListener("change", (e) => { ui.deska = e.target.checked; recompute(); });
  $("#tDims").addEventListener("change", (e) => { ui.dims = e.target.checked; if (viewer) { viewer.showDims = ui.dims; viewer.draw(); } });
  $("#tColors").addEventListener("change", (e) => { ui.colors = e.target.checked; recompute(); });
  $("#tFit").addEventListener("click", () => viewer && viewer.fit());

  // ---------- sdílení a hlášení chyb ----------
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 2600); }
  $("#btnShare").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Odkaz na konfiguraci zkopírován"); }
    catch (e) { prompt("Zkopírujte odkaz:", location.href); }
  });
  function updateIssueLink(par) {
    const body = `**Co se stalo:**\n\n\n**Co jsem čekal:**\n\n\n---\nKonfigurace: ${location.href}\nProhlížeč: ${navigator.userAgent}`;
    $("#lnkIssue").href = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent("Chyba: ")}&body=${encodeURIComponent(body)}`;
  }

  // ---------- objednávka ----------
  const dlgOrder = $("#dlgOrder"), dlgResult = $("#dlgResult");
  let pkg = null, zipUrl = null, fileUrls = [];

  $("#btnOrder").addEventListener("click", () => {
    if (!lastGood || model.errors.length) return;
    const par = readForm(), d = model.dims;
    const pov = K.povrchy.find((p) => p.id === par.povrch);
    $("#orderSum").innerHTML = `<b>Podnož ${fmt(d.L)} × ${fmt(d.W)} × ${fmt(d.H)} mm</b> – ${par.pocet} ks<br>
      Nohy ${par.profilNohy}${par.patky ? " s patkou M8" : ""}, rám ${par.profilRamu}${par.spodniPricky ? ", spodní příčky" : ""}<br>
      ${pov.nazev} · ${X.kg(model.mass * par.pocet)} kg`;
    try { const s = JSON.parse(localStorage.getItem("zakaznik") || "{}"); for (const k of ["jmeno", "email", "telefon", "adresa"]) if (s[k]) dlgOrder.querySelector(`[name=${k}]`).value = s[k]; } catch (e) { /* bez úložiště */ }
    dlgOrder.showModal();
  });

  $("#orderForm").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value !== "send") return;
    const f = e.target;
    if (!f.reportValidity()) { e.preventDefault(); return; }
    e.preventDefault();
    const z = { jmeno: f.jmeno.value.trim(), email: f.email.value.trim(), telefon: f.telefon.value.trim(), adresa: f.adresa.value.trim() };
    try { localStorage.setItem("zakaznik", JSON.stringify(z)); } catch (err) { /* bez úložiště */ }
    const par = readForm();
    const now = new Date();
    const pov = K.povrchy.find((p) => p.id === par.povrch);
    const order = {
      cislo: X.orderNumber(now), datum: now.toISOString(), datumText: now.toLocaleString("cs-CZ"),
      zakaznik: z, pocet: par.pocet, povrch: par.povrch, povrchNazev: pov.nazev, poznamka: f.poznamka.value.trim()
    };
    $("#btnSend").disabled = true; $("#btnSend").textContent = "Generuji soubory…";
    setTimeout(() => {
      try {
        pkg = X.buildPackage(G.build(par), order);
        if (viewer) {
          // obrázek vždy v barvě povrchu (bez dílenských barev), celý stůl, výchozí pohled
          renderScene(par, true);
          const png = viewer.renderImage();
          renderScene(par);
          const bin = Uint8Array.from(atob(png.split(",")[1]), (c) => c.charCodeAt(0));
          pkg.files.splice(3, 0, { path: pkg.folder + "/nahled.png", data: bin, mime: "image/png" });
        }
        showResult(order);
        dlgOrder.close();
      } catch (err) {
        console.error(err); alert("Chyba při generování: " + err.message);
      } finally {
        $("#btnSend").disabled = false; $("#btnSend").textContent = "Odeslat objednávku (test)";
      }
    }, 30);
  });

  function blobOf(f) { return new Blob([f.data], { type: f.mime || "application/octet-stream" }); }
  function showResult(order) {
    fileUrls.forEach((u) => URL.revokeObjectURL(u)); fileUrls = [];
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    $("#rCislo").textContent = order.cislo;
    $("#rSubj").textContent = pkg.mail.subject;
    $("#rBody").textContent = pkg.mail.body;
    $("#rFolder").textContent = pkg.folder + "/";
    $("#rFiles").innerHTML = "";
    for (const f of pkg.files) {
      const rel = f.path.slice(pkg.folder.length + 1);
      const i = rel.lastIndexOf("/");
      const url = URL.createObjectURL(blobOf(f)); fileUrls.push(url);
      const ext = rel.split(".").pop().toUpperCase();
      const size = (f.data.length / 1024).toFixed(f.data.length < 10240 ? 1 : 0) + " kB";
      const li = document.createElement("li");
      li.innerHTML = `<span class="path"><span class="tag">${ext}</span>${i >= 0 ? `<span class="dir">${rel.slice(0, i + 1)}</span>` : ""}${rel.slice(i + 1)}</span>`;
      const a = document.createElement("a"); a.href = url; a.download = rel.slice(i + 1); a.textContent = "stáhnout · " + size;
      li.appendChild(a); $("#rFiles").appendChild(li);
    }
    zipUrl = URL.createObjectURL(new Blob([X.zip(pkg.files)], { type: "application/zip" }));
    dlgResult.showModal();
  }
  $("#btnZip").addEventListener("click", () => { const a = document.createElement("a"); a.href = zipUrl; a.download = pkg.zipName; document.body.appendChild(a); a.click(); a.remove(); });
  dlgResult.querySelector("[data-close]").addEventListener("click", () => dlgResult.close());

  // ---------- start ----------
  try {
    viewer = new window.Viewer($("#view"), $("#labels"));
  } catch (e) {
    const el = $("#viewErr"); el.hidden = false; el.textContent = "3D náhled není v tomto prohlížeči dostupný (" + e.message + "). Konfigurace a objednávka fungují i tak.";
  }
  setForm(fromHash());
  recompute();
  window.addEventListener("hashchange", () => { setForm(fromHash()); recompute(); });

  // pro testy / ladění z konzole
  window.APP = { get model() { return model; }, get pkg() { return pkg; }, readForm, viewer: () => viewer };
})();
