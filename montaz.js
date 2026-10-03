/* Stránka Testing: 3D rozložení podnože, postup skládání krok za krokem a sonda svářečky.
   Geometrie a výpočty jsou v core.js / vyvoj.js / montaz-core.js, tady je jen zobrazení a ovládání.
   Barvy dílů jsou jen pro dílnu (tahle stránka), zákaznická stránka je nepoužívá. */
(function () {
  'use strict';
  const K = window.Podnoze, Mz = window.Montaz, V = Mz.V, $ = (id) => document.getElementById(id);
  const WIP = (window.Vyvoj && window.Vyvoj.MODELS) || [];
  const isWip = (id) => WIP.some((m) => m.id === id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiště */ } }
  };
  const PAL = ['#4C78A8', '#E0823A', '#54A24B', '#B279A2', '#D65F5F', '#4FA3A0', '#C9A227', '#9D755D', '#E37FA0', '#7F7F9A', '#6BAF92', '#A0522D'];
  const COL = { ok: '#2E9E5B', tight: '#E08A00', no: '#D7263D', pend: '#A8A29A', seam: '#2F6FDE', tab: '#E8590C', slot: '#F2A900', steel: '#8E939A', sel: '#B8440F' };
  const ST_TXT = { ok: 'přístupný', tight: 'omezeně', no: 'nepřístupný' };
  const VIEWS = { iso: [-0.62, -1, 0.55], front: [0, -1, 0.12], side: [1, 0, 0.12], top: [0, -0.0001, 1], bottom: [-0.55, -1, -0.62] };

  /* ---------------- stav ---------------- */
  const ui0 = store.get('montaz-ui') || {};
  const ui = {
    tab: 'explode', explode: 0, sel: -1, pulled: new Set(), hidden: new Set(), isolate: -1,
    flip: !!ui0.flip, tabsHi: ui0.tabsHi !== false, seams: ui0.seams !== false, colors: ui0.colors !== false, desk: !!ui0.desk,
    ghost: ui0.ghost || 'ghost', step: 0, view: 'iso', torch: Object.assign({}, Mz.TORCH.mig, ui0.torch || {}), table: ui0.table !== false, probe: null
  };
  const saveUi = () => store.set('montaz-ui', { flip: ui.flip, tabsHi: ui.tabsHi, seams: ui.seams, colors: ui.colors, desk: ui.desk, ghost: ui.ghost, torch: ui.torch, table: ui.table });

  let src = store.get('montaz-src') === 'wip' ? 'wip' : 'std';
  let cfg;
  (function loadCfg() {
    const c = store.get(src === 'wip' ? 'podnoz-cfg-wip' : 'podnoz-cfg') || {};
    if (src === 'wip' && !isWip(c.model)) c.model = WIP.length ? WIP[0].id : 'U';
    try { cfg = K.normalize(c); } catch (e) { cfg = K.normalize({}); }
  })();
  function saveCfg() {
    src = isWip(cfg.model) ? 'wip' : 'std';
    store.set('montaz-src', src);
    store.set(src === 'wip' ? 'podnoz-cfg-wip' : 'podnoz-cfg', cfg);   // stejné nastavení jako záložka Zákazník / In progress
  }

  let A = null, M = null, seq = [], stepOf = {}, seqKey = '';

  /* ---------------- 3D ---------------- */
  const host = $('viz');
  let has3d = false;
  try { if (window.THREE && THREE.OrbitControls) { const c = document.createElement('canvas'); has3d = !!(c.getContext('webgl2') || c.getContext('webgl')); } } catch (e) { has3d = false; }
  if (!has3d) {
    host.innerHTML = '<p style="padding:110px 24px 0;color:#5E5A54">Stránka Testing potřebuje 3D (WebGL) a připojení k internetu kvůli knihovně three.js.</p>';
    return;
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 5, 60000);
  camera.up.set(0, 0, 1);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', () => requestRender());
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(-1500, -2200, 3200); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 2.5;      // bez pruhů (shadow acne) na jeklech
  Object.assign(sun.shadow.camera, { left: -2000, right: 2000, top: 2000, bottom: -2000, near: 100, far: 9000 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(2000, 1500, 900); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(4000, 40, 0xcfc9bf, 0xe2ddd5); grid.rotation.x = Math.PI / 2; grid.position.z = 0.2; scene.add(grid);

  let root = null, objs = [], seamObjs = [], deskObj = null, probeObj = null, arrowObj = null;
  let needRender = false;
  function requestRender() { if (!needRender) { needRender = true; requestAnimationFrame(frame); } }
  function frame(now) {
    needRender = false;
    let anim = false;
    objs.forEach((o) => {
      if (!o.anim) return;
      const k = Math.min(1, (now - o.anim.t0) / o.anim.dur), e = 1 - Math.pow(1 - k, 3);
      o.g.position.copy(o.anim.from).lerp(o.anim.to, e);
      if (k >= 1) o.anim = null; else anim = true;
    });
    renderer.render(scene, camera);
    if (anim) requestRender();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    renderer.setSize(Math.max(10, r.width), Math.max(10, r.height), false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = Math.max(10, r.width) / Math.max(10, r.height); camera.updateProjectionMatrix(); requestRender();
  }
  new ResizeObserver(resize).observe(host);

  /* tělesa -> trojúhelníky (obecné plochy s otvory) */
  function triangles(solid) {
    const pos = [], P = solid.verts;
    solid.faces.forEach((f0) => {
      const f = K.orientFace(P, f0), n = V.unit(f.n);
      const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = V.unit(V.cross(n, ax)), e2 = V.cross(n, e1);
      const to2 = (i) => new THREE.Vector2(V.dot(P[i], e1), V.dot(P[i], e2));
      const contour = f.outer.map(to2), holes = f.inner.map((lp) => lp.map(to2));
      const idx = f.outer.concat(...f.inner);
      THREE.ShapeUtils.triangulateShape(contour, holes).forEach((tr) => {
        let [a, b, c] = tr.map((k) => P[idx[k]]);
        if (V.dot(V.cross(V.sub(b, a), V.sub(c, a)), n) < 0) { const tmp = b; b = c; c = tmp; }
        pos.push(...a, ...b, ...c);
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);
  function cylinderBetween(p0, p1, r, mat) {
    const a = v3(p0), b = v3(p1), d = b.clone().sub(a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.1, L), 8, 1), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  function tabMesh(tb, mat) {
    const c = tb.quad.reduce((s, p) => V.add(s, p), [0, 0, 0]).map((x) => x / 4);
    const q = tb.quad.map((p) => V.add(c, V.mul(V.sub(p, c), 1.08)));
    const lo = q.map((p) => V.sub(p, V.mul(tb.d, 0.25))), hi = q.map((p) => V.add(p, V.mul(tb.d, tb.len + 0.25)));
    const quads = [[lo[0], lo[1], lo[2], lo[3]], [hi[3], hi[2], hi[1], hi[0]]];
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; quads.push([lo[k], hi[k], hi[k2], lo[k2]]); }
    const pos = [];
    quads.forEach(([a, b, cc, d]) => pos.push(...a, ...b, ...cc, ...a, ...cc, ...d));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return new THREE.Mesh(g, mat);
  }
  function labelSprite(n) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#17181A'; x.beginPath(); x.arc(32, 32, 29, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.font = '600 30px "Instrument Sans", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 32, 34);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false }));
    s.scale.set(0.028, 0.028, 1); s.renderOrder = 10;
    return s;
  }
  function disposeTree(o) {
    o.traverse((x) => {
      if (x.geometry) x.geometry.dispose();
      if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  function buildScene() {
    if (root) { scene.remove(root); disposeTree(root); }
    root = new THREE.Group(); scene.add(root);
    probeObj = null; arrowObj = null; ui.probe = null;
    const keys = [...new Set(M.items.map((it) => it.key))];
    const tabMat = new THREE.MeshBasicMaterial({ color: COL.tab });
    objs = M.items.map((it, i) => {
      const g = new THREE.Group();
      const color = PAL[keys.indexOf(it.key) % PAL.length];
      const mat = new THREE.MeshStandardMaterial({ color: ui.colors ? color : COL.steel, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 1 });
      const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2b2e, transparent: true, opacity: 0.4 });
      const meshes = it.solids.map((S) => {
        const geo = triangles(S);
        const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.idx = i; g.add(m);
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), lineMat));
        return m;
      });
      // zámky (kvádříky + značka stálé velikosti) a drážky/otvory (obrys + značka)
      const hi = new THREE.Group();
      const tabPts = [], slotPts = [], slotLines = [];
      it.tabs.forEach((tb) => {
        hi.add(tabMesh(tb, tabMat));
        const m = it.part.m, rel = V.sub(tb.c, m.p1), radial = V.sub(rel, V.mul(m.u, V.dot(rel, m.u)));
        tabPts.push(...V.add(V.add(tb.c, V.mul(tb.d, tb.len * 0.5)), V.mul(V.unit(radial), 1.5)));
      });
      it.faces.forEach((F) => {
        if (F.loops3.length < 2) return;
        if (it.kind === 'tube' && Math.abs(V.dot(F.n, it.part.m.u)) > 0.2) return;    // čelo jeklu s dutinou
        F.loops3.slice(1).forEach((L) => {
          for (let k = 0; k < L.length; k++) slotLines.push(...V.add(L[k], V.mul(F.n, 0.15)), ...V.add(L[(k + 1) % L.length], V.mul(F.n, 0.15)));
          const c = L.reduce((s, p) => V.add(s, p), [0, 0, 0]).map((x) => x / L.length);
          slotPts.push(...V.add(c, V.mul(F.n, 1.2)));
        });
      });
      if (tabPts.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(tabPts, 3)); hi.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: COL.tab, size: 10, sizeAttenuation: false }))); }
      if (slotPts.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(slotPts, 3)); hi.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: COL.slot, size: 7, sizeAttenuation: false }))); }
      if (slotLines.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(slotLines, 3)); hi.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: COL.tab }))); }
      g.add(hi);
      const label = labelSprite(''); label.visible = false; label.position.set(it.c[0], it.c[1], it.c[2]); g.add(label);
      root.add(g);
      return { g, meshes, mat, lineMat, hi, color, label, labelN: null, anim: null };
    });
    const r = Math.max(1.6, M.s * 0.07);
    seamObjs = M.seams.map((sm) => {
      const mat = new THREE.MeshBasicMaterial({ color: COL.seam });
      const mesh = cylinderBetween(sm.p0, sm.p1, r, mat); mesh.userData.seam = sm.id;
      objs[sm.a].g.add(mesh);
      return { mesh, mat };
    });
    if (ui.desk) {
      const outline = K.deskOutline(cfg.shape, A.DL, A.DW);
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map((p) => new THREE.Vector2(p[0], p[1]))), { depth: cfg.td, bevelEnabled: false, curveSegments: 4 });
      deskObj = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#C39566', roughness: 0.8, transparent: true, opacity: 0.35, depthWrite: false }));
      deskObj.position.z = A.build.dims.Hf; root.add(deskObj);
    } else deskObj = null;
    const R = Math.max(1200, M.maxDim * 1.3);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R }); sun.shadow.camera.updateProjectionMatrix();
    applyFlip();
  }
  function applyFlip() {
    if (!root) return;
    if (ui.flip) { root.rotation.set(Math.PI, 0, 0); root.position.set(0, 0, M.bb[1][2]); }
    else { root.rotation.set(0, 0, 0); root.position.set(0, 0, 0); }
    root.updateMatrixWorld(true);
  }
  function fit(dirName) {         // dirName = null: zachovat směr pohledu, jen vejít se do záběru
    if (!root) return;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    objs.forEach((o) => { if (o.g.visible) o.meshes.forEach((m) => box.expandByObject(m)); });
    if (box.isEmpty()) box.setFromObject(root);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const R = Math.max(sz.x, sz.y, sz.z) * 0.62 + 80;
    const dir = dirName ? new THREE.Vector3().fromArray(VIEWS[dirName] || VIEWS.iso).normalize() : camera.position.clone().sub(controls.target).normalize();
    const dist = R / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.aspect < 1 ? 1.3 / camera.aspect : 1.02);
    controls.target.copy(c);
    camera.position.copy(c).addScaledVector(dir, dist);
    controls.update(); requestRender();
  }

  /* ---------------- přístup hořáku (fronta výpočtů) ---------------- */
  const reachCache = new Map();
  let queue = [], qTimer = null;
  const tableCfg = () => (!ui.table ? null : ui.flip ? { z: M.bb[1][2], sign: 1 } : { z: 0, sign: -1 });
  const ctxSig = () => [ui.torch.r0, ui.torch.R, ui.torch.taper, ui.torch.so, ui.torch.L, ui.table ? (ui.flip ? 'f' : 'n') : '-'].join(',');
  function seamCtx(sm) {
    if (!seq.length) return { step: Infinity, obst: M.items.map((_, i) => i) };   // bez postupu: po smontování všeho
    const st = Mz.seamStep(M, sm, stepOf);
    return st == null ? null : { step: st, obst: seq.slice(0, st) };
  }
  function seamResult(sm) {
    const ctx = seamCtx(sm); if (!ctx) return null;
    const key = sm.id + '|' + ctx.obst.join(',') + '|' + ctxSig();
    const r = reachCache.get(key); if (r) return r;
    if (!queue.some((q) => q.key === key)) queue.push({ id: sm.id, key, ctx });
    if (!qTimer) qTimer = setTimeout(work, 0);
    return 'pend';
  }
  function work() {
    qTimer = null;
    const t0 = performance.now(), T = Object.assign({}, ui.torch), tb = tableCfg();
    while (queue.length && performance.now() - t0 < 25) {
      const q = queue.shift(); if (reachCache.has(q.key)) continue;
      const sm = M.seams[q.id]; if (!sm) continue;
      const r = Mz.reach(M, sm.mid, sm.ideal, q.ctx.obst, T, tb, { n: 48 });
      if (r.status !== 'ok') r.diag = Mz.diagnose(M, sm.mid, sm.ideal, [sm.a, sm.b], q.ctx.obst, T, tb, r);
      reachCache.set(q.key, r);
    }
    refreshStatus();
    if (queue.length) qTimer = setTimeout(work, 0);
  }
  function resetReach() { reachCache.clear(); queue = []; if (qTimer) { clearTimeout(qTimer); qTimer = null; } }
  const UP = () => (ui.flip ? [0, 0, -1] : [0, 0, 1]);
  const stOf = (r) => (r === 'pend' ? 'pend' : r ? r.status : null);
  function causeText(dg, short) {
    if (!dg) return '';
    if (dg.cause === 'table') return short ? 'překáží stůl' : 'Překáží stůl – po otočení podnože by to bylo: ' + ST_TXT[dg.better] + '.';
    if (dg.cause === 'shape') {
      if (short) return 'ostrý úhel' + (dg.angle ? ' ' + Math.round(dg.angle) + '°' : '');
      // tryska o poloměru r0 se do klínu s úhlem α vejde až ve vzdálenosti r0 / sin(α/2) od kořene
      const need = dg.angle > 1 && dg.angle < 179 ? Math.ceil(ui.torch.r0 / Math.sin(dg.angle * Math.PI / 360)) : null;
      return 'Ostrý úhel' + (dg.angle ? ' (' + Math.round(dg.angle) + '°)' : '') + ' – tryska Ø ' + K.nf(ui.torch.r0 * 2) + ' mm se ke kořeni nevejde v žádném pořadí' +
        (need && need > ui.torch.so ? '; vešla by se s výletem aspoň ' + need + ' mm (teď ' + K.nf(ui.torch.so) + ' mm), nebo užší tryskou' : '') + '. Jinak svar z druhé strany nebo jiné řešení spoje.';
    }
    const names = dg.blockers.map((j) => M.items[j].label);
    return short ? (names.length ? 'překáží ' + names.join(', ') : 'překáží jiné díly') : 'Překáží ' + (names.length ? names.join(', ') : 'jiné položené díly') + ' – bez nich by to bylo: ' + ST_TXT[dg.better] + '. Svař tenhle spoj dřív, než je položíš.';
  }

  /* ---------------- stav scény podle režimu ---------------- */
  const E = () => M.maxDim * 0.45;
  function placedAt(k) { return new Set(seq.slice(0, k)); }
  const ins = (i, k) => Mz.insertCheck(M, i, placedAt(k), UP());     // jak se díl na k-tém místě postupu nasazuje
  /* rozložení: každý díl odjede tou cestou, kterou přijel (opačně než nasazení v postupu), trochu i od středu */
  let exDirs = null, exOrder = null;
  function explodeOrder() { return seq.length === M.items.length ? seq : (exOrder = exOrder || Mz.suggestOrder(M)); }
  function explodeDirs() {
    if (exDirs) return exDirs;
    const order = explodeOrder(), placed = new Set();
    exDirs = M.items.map(() => [0, 0, 1]);
    order.forEach((i, k) => {
      const it = M.items[i], r = V.sub(it.c, M.center), rad = Math.hypot(r[0], r[1]) > 1 ? V.unit([r[0], r[1], 0]) : [0, 0, 0];
      const d = k === 0 ? (V.len(rad) ? rad : UP()) : V.unit(V.add(V.mul(Mz.insertCheck(M, i, placed, UP()).dir, -1), V.mul(rad, 0.35)));
      exDirs[i] = d; placed.add(i);
    });
    return exDirs;
  }
  function resetExplode() { exDirs = null; }
  function liftOffsets(offs, vis) {        // nic pod podlahu (stůl): celé rozložení zvednout
    let lift = 0;
    if (!ui.flip) { let mn = Infinity; offs.forEach((o, i) => { if (vis[i]) mn = Math.min(mn, M.items[i].bb[0][2] + o[2]); }); if (mn < 0) lift = -mn; }
    else { let mx = -Infinity; offs.forEach((o, i) => { if (vis[i]) mx = Math.max(mx, M.items[i].bb[1][2] + o[2]); }); if (mx > M.bb[1][2]) lift = M.bb[1][2] - mx; }
    return lift ? offs.map((o) => [o[0], o[1], o[2] + lift]) : offs;
  }
  function applyState(animIdx) {
    if (!M) return;
    const mode = ui.tab, k = ui.step;
    const neigh = ui.isolate >= 0 ? neighbours(ui.isolate) : null;
    // posunutí a viditelnost všech dílů najednou (kvůli zvednutí nad podlahu)
    const S = M.items.map((it, i) => {
      const st = stepOf[i];
      let vis = true, op = 1, off = [0, 0, 0];
      if (mode === 'explode') {
        const amt = ui.explode / 100 * E() + (ui.pulled.has(i) ? E() * 0.55 : 0);
        if (amt > 0) off = V.mul(explodeDirs()[i], amt);
        vis = !ui.hidden.has(i) && (!neigh || neigh.has(i));
      } else {
        const placed = mode === 'torch' && !seq.length ? true : st != null && st <= k;
        if (!placed) {
          if (mode === 'torch' || ui.ghost === 'hide') vis = false;
          else if (ui.ghost === 'explode') { op = 0.5; off = V.mul(explodeDirs()[i], E() * 0.6); }
          else op = 0.13;
        }
      }
      return { vis, op, off };
    });
    const offs = liftOffsets(S.map((x) => x.off), S.map((x) => x.vis));
    objs.forEach((o, i) => {
      const st = stepOf[i];
      let { vis, op } = S[i], off = offs[i], hl = false;
      if (mode === 'explode') hl = ui.sel === i;
      else {
        hl = mode === 'seq' && st === k && k > 0;
        o.label.visible = mode === 'seq' && st != null && st <= k;
        if (o.label.visible && o.labelN !== st) { const s2 = labelSprite(st); o.label.material.map.dispose(); o.label.material.dispose(); o.label.material = s2.material; o.labelN = st; }
      }
      if (mode === 'explode') o.label.visible = false;
      o.g.visible = vis;
      o.mat.opacity = op; o.mat.depthWrite = op > 0.9; o.lineMat.opacity = op > 0.9 ? 0.4 : op * 0.5;
      o.meshes.forEach((m) => { m.castShadow = op > 0.9; });
      o.mat.color.set(ui.colors ? o.color : COL.steel);
      o.mat.emissive.set(hl ? COL.sel : '#000000'); o.mat.emissiveIntensity = hl ? 0.45 : 0;
      o.hi.visible = ui.tabsHi && op > 0.4;
      const target = v3(off);
      if (animIdx === i) {
        const r = ins(i, stepOf[i] - 1), dist = Math.max(120, M.maxDim * 0.3);
        o.anim = { from: target.clone().addScaledVector(v3(r.dir), -dist), to: target, t0: performance.now(), dur: 750 };
        o.g.position.copy(o.anim.from);
      } else if (!o.anim) o.g.position.copy(target);
      else o.anim.to = target;
    });
    // svary
    seamObjs.forEach((so, id) => {
      const sm = M.seams[id];
      let vis = ui.seams, color = COL.seam, thick = false;
      if (mode === 'explode') { vis = vis && objs[sm.a].g.visible; }
      else {
        const r = seamResult(sm), s = stOf(r);
        if (!s) vis = false;
        else {
          const ctx = seamCtx(sm);
          if (seq.length && ctx.step > k) vis = false;
          color = COL[s];
          thick = mode === 'seq' && ctx.step === k;
        }
        if (ui.probe && ui.probe.seam === id) thick = true;
      }
      so.mesh.visible = vis;
      so.mat.color.set(color);
      so.mesh.scale.set(thick ? 1.9 : 1, 1, thick ? 1.9 : 1);
    });
    // šipka nasazení u aktuálního kroku
    if (arrowObj) { root.remove(arrowObj); arrowObj.dispose(); arrowObj = null; }
    if (mode === 'seq' && k > 1 && seq[k - 1] != null) {
      const i = seq[k - 1], r = ins(i, k - 1), dist = Math.max(120, M.maxDim * 0.3), c = V.add(M.items[i].c, offs[i]);
      const d = v3(r.dir).normalize(), from = v3(c).addScaledVector(d, -dist * 1.05);
      arrowObj = new THREE.ArrowHelper(d, from, dist * 0.8, r.conflict || (r.blocked && r.blocked.length) ? 0xD7263D : 0x17181A, Math.min(60, dist * 0.18), Math.min(34, dist * 0.1));
      root.add(arrowObj);
    }
    if (probeObj) probeObj.visible = mode === 'torch';
    renderLegend();
    requestRender();
  }
  function neighbours(i) {        // díl + vše, s čím je svařený, má zámky nebo na čem dosedá
    const s = new Set([i].concat(Mz.neighbours(M, i)));
    M.items[i].seams.forEach((sid) => { const sm = M.seams[sid]; s.add(sm.a); s.add(sm.b); });
    M.tabLinks.forEach((l) => { if (l.from === i) s.add(l.to); if (l.to === i) s.add(l.from); });
    return s;
  }
  /* popis nasazení dílu: směr + proč (zámky / dosedací plochy) + varování */
  const names = (js) => js.map((j) => M.items[j].label).join(', ');
  function insWarn(r) {
    if (r.conflict) return (r.tabs ? 'zámky a dosedací plochy jdou proti sobě (' : 'zaklíněný ze všech stran (') + names(r.against) + ') – nejde nasadit';
    if (r.blocked && r.blocked.length) return 'cestou narazí do ' + names(r.blocked);
    return '';
  }

  /* ---------------- slova pro směry ---------------- */
  function dirWord(d) {
    const w = ui.flip ? [d[0], -d[1], -d[2]] : d;      // směr pohybu ve světě (po otočení)
    const ax = [Math.abs(w[0]), Math.abs(w[1]), Math.abs(w[2])], m = Math.max(...ax);
    if (m === ax[2]) return w[2] < 0 ? 'shora' : 'zespodu';
    if (m === ax[0]) return w[0] < 0 ? 'zprava' : 'zleva';
    return w[1] < 0 ? 'zezadu' : 'zepředu';
  }

  /* ---------------- panel: konfigurace ---------------- */
  const svg = (d) => '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="' + d + '"></path></svg>';
  function syncInput(id, v) { const el = $(id); if (document.activeElement !== el) el.value = v; }
  let rebuildT = null;
  function set(p, now) {
    cfg = K.normalize(Object.assign({}, cfg, p));
    saveCfg();
    clearTimeout(rebuildT);
    if (now) rebuild(); else rebuildT = setTimeout(rebuild, 140);
    renderCfg();
  }
  function renderCfg() {
    const pick = (el, list, cur, cb, html) => {
      el.innerHTML = list.map(html).join('');
      el.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', () => cb(b.dataset.id)));
    };
    const mb = (m) => '<button type="button" class="opt" data-id="' + m.id + '" aria-pressed="' + (m.id === cfg.model) + '" title="' + esc(m.desc || '') + '">' + svg(m.icon) + '<span class="l">' + esc(m.lab) + '</span></button>';
    pick($('models'), K.MODELS, cfg.model, (id) => set({ model: id }, true), mb);
    $('wipHead').hidden = !WIP.length;
    pick($('modelsWip'), WIP, cfg.model, (id) => set({ model: id }, true), mb);
    const circle = cfg.shape === 'circle';
    $('lenLab').textContent = circle ? 'Průměr' : 'Délka';
    $('wField').hidden = circle;
    ['L', 'W', 'H'].forEach((k) => { syncInput(k, cfg[k]); syncInput(k + 'n', cfg[k]); });
    const sizes = isWip(cfg.model) ? window.Vyvoj.SIZES : K.SIZES;
    pick($('sizes'), sizes, cfg.size, (z) => set({ size: Number(z) }, true), (z) => '<button type="button" class="pill" data-id="' + z + '" aria-pressed="' + (z === cfg.size) + '">' + z + '×' + z + '</button>');
    pick($('thks'), K.THK[cfg.size], cfg.t, (t) => set({ t: Number(t) }, true), (t) => '<button type="button" class="pill" data-id="' + t + '" aria-pressed="' + (t === cfg.t) + '">stěna ' + t + ' mm</button>');
    const boltOK = !isWip(cfg.model) && K.boltAllowed(cfg, K.DEFAULT_RATES);
    if (boltOK) pick($('joins'), ['weld', 'bolt'], cfg.join, (j) => set({ join: j }, true), (j) => '<button type="button" class="pill" data-id="' + j + '" aria-pressed="' + (j === cfg.join) + '">' + (j === 'weld' ? 'Svařovaná' : 'Šroubovaná') + '</button>');
    else $('joins').innerHTML = '<span class="note">Jen svařovaná.</span>';
    const info = K.modelInfo(cfg.model) || {};
    const dims = circle ? 'Ø ' + K.nf(cfg.L) : K.nf(cfg.L) + ' × ' + K.nf(cfg.W);
    const sum = info.lab + ' · ' + dims + ' × ' + K.nf(cfg.H) + ' · jekl ' + cfg.size + '×' + cfg.size + '×' + cfg.t + (cfg.join === 'bolt' && boltOK ? ' · šroubovaná' : '');
    $('cfgSum').textContent = sum;
    $('mName').textContent = info.lab || cfg.model;
  }
  ['L', 'W', 'H'].forEach((k) => {
    $(k).addEventListener('input', (e) => set({ [k]: e.target.value }));
    $(k + 'n').addEventListener('change', (e) => set({ [k]: e.target.value }, true));
  });

  /* ---------------- přestavba modelu ---------------- */
  let lastModelKey = '';
  function rebuild() {
    try { A = K.analyze(cfg, K.DEFAULT_RATES); } catch (e) { console.error(e); return; }
    M = Mz.prepare(A);
    seqKey = 'montaz-seq:' + cfg.model + ':' + (A.bolted ? 'bolt' : 'weld') + ':' + M.items.length;
    const saved = store.get(seqKey);
    seq = Array.isArray(saved) ? saved.filter((i, k, arr) => Number.isInteger(i) && i >= 0 && i < M.items.length && arr.indexOf(i) === k) : [];
    reindex();
    exOrder = null; resetExplode();
    ui.step = Math.min(ui.step, seq.length);
    if (ui.sel >= M.items.length) ui.sel = -1;
    if (ui.isolate >= M.items.length) ui.isolate = -1;
    ui.pulled = new Set([...ui.pulled].filter((i) => i < M.items.length));
    ui.hidden = new Set([...ui.hidden].filter((i) => i < M.items.length));
    resetReach();
    buildScene();
    const d = A.build.dims;
    $('mSub').textContent = 'podnož ' + K.nf(d.Lf) + ' × ' + K.nf(d.Wf) + ' × ' + K.nf(d.Hf) + ' mm · ' + M.items.length + ' dílů · ' + M.seams.length + ' svarových úseků · ' + M.tabLinks.length + ' zámkových spojů' + (A.bolted ? ' · šroubované spojky' : '');
    const mk = cfg.model + (A.bolted ? 'b' : 'w');
    if (mk !== lastModelKey) { ui.sel = -1; ui.isolate = -1; ui.pulled.clear(); ui.hidden.clear(); ui.probe = null; }
    applyState();
    renderPanels();
    if (mk !== lastModelKey) { lastModelKey = mk; fit(ui.view); }
  }
  function reindex() { stepOf = {}; seq.forEach((i, k) => { stepOf[i] = k + 1; }); resetExplode(); }
  function saveSeq() { store.set(seqKey, seq); }

  /* ---------------- panely ---------------- */
  function swatch(i) { return '<span class="sw" style="background:' + (ui.colors ? objs[i].color : COL.steel) + '"></span>'; }
  function partSub(it, i) {
    const bits = [];
    if (it.row) bits.push(it.row.len + ' mm', it.row.cut);
    const nT = M.tabLinks.filter((l) => l.from === i).length, nS = M.tabLinks.filter((l) => l.to === i).length;
    if (nT) bits.push('zámky do ' + nT + (nT === 1 ? ' dílu' : ' dílů'));
    if (nS) bits.push('drážky pro ' + nS);
    if (it.bolted) bits.push('šroubovaná – bez svaru');
    else bits.push(it.seams.length + ' svar. úseků');
    return bits.join(' · ');
  }
  function renderPanels() {
    if (!M) return;
    renderExplode(); renderSeq(); renderTorch();
    $('hint').textContent = ui.tab === 'explode' ? 'Klikni na díl – vybereš ho. Tažením otáčíš, kolečkem přibližuješ.' : ui.tab === 'seq' ? 'Klikej na díly v pořadí skládání. Kliknutí na položený díl skočí na jeho krok.' : 'Klikni na svar nebo kamkoli na díl – ukáže přístup hořáku.';
  }
  function renderExplode() {
    $('expV').textContent = ui.explode + ' %';
    $('exp').value = ui.explode;
    $('partList').innerHTML = M.items.map((it, i) => '<button type="button" class="it" data-i="' + i + '" aria-current="' + (ui.sel === i) + '"><span class="n">' + (i + 1) + '</span>' + swatch(i) +
      '<span class="tx' + (ui.hidden.has(i) ? ' muted' : '') + '">' + esc(it.label) + '<small>' + esc(partSub(it, i)) + '</small></span><span class="st">' + (ui.pulled.has(i) ? 'vysunutý' : ui.hidden.has(i) ? 'skrytý' : '') + '</span></button>').join('');
    $('partList').querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => selectPart(+b.dataset.i)));
    const box = $('selInfo');
    if (ui.sel < 0) { box.className = 'info'; box.innerHTML = '<span>Klikni na díl v 3D nebo v seznamu. Vybraný díl jde vysunout zvlášť – uvidíš jeho zámky a drážky v protikusu.</span>'; return; }
    const i = ui.sel, it = M.items[i];
    const partners = [...new Set(it.seams.map((sid) => { const sm = M.seams[sid]; return sm.a === i ? sm.b : sm.a; }))].map((j) => M.items[j].label);
    const tabsTo = [...new Set(M.tabLinks.filter((l) => l.from === i).map((l) => M.items[l.to].label))];
    const tabsFrom = [...new Set(M.tabLinks.filter((l) => l.to === i).map((l) => M.items[l.from].label))];
    const kv = [];
    if (it.row) { kv.push(['Profil', it.row.prof], ['Délka', it.row.len + ' mm'], ['Řezy', it.row.cut]); if (it.row.feat) kv.push(['Prvky', it.row.feat]); }
    if (tabsTo.length) kv.push(['Zámky do', tabsTo.join(', ')]);
    if (tabsFrom.length) kv.push(['Drážky pro', tabsFrom.join(', ')]);
    kv.push(['Svařeno s', it.bolted ? '— (šroubovaný spoj)' : partners.length ? partners.join(', ') : '—']);
    box.className = 'info';
    box.innerHTML = '<b>' + esc(it.label) + '</b><div class="kv">' + kv.map(([a, b]) => '<span>' + esc(a) + '</span><span>' + esc(b) + '</span>').join('') + '</div>' +
      '<div class="row-btns"><button class="btn sm" type="button" id="bPull">' + (ui.pulled.has(i) ? 'Zasunout' : 'Vysunout') + '</button><button class="btn sm" type="button" id="bIso">' + (ui.isolate === i ? 'Zobrazit vše' : 'Jen tento a navazující') + '</button><button class="btn sm" type="button" id="bHide">' + (ui.hidden.has(i) ? 'Zobrazit' : 'Skrýt') + '</button></div>';
    $('bPull').addEventListener('click', () => { ui.pulled.has(i) ? ui.pulled.delete(i) : ui.pulled.add(i); animateTo(i); renderExplode(); });
    $('bIso').addEventListener('click', () => { ui.isolate = ui.isolate === i ? -1 : i; applyState(); renderExplode(); fit(null); });
    $('bHide').addEventListener('click', () => { ui.hidden.has(i) ? ui.hidden.delete(i) : ui.hidden.add(i); applyState(); renderExplode(); });
  }
  function animateTo(i) {     // plynulý přesun dílu na nové místo (vysunout / zasunout)
    const o = objs[i], from = o.g.position.clone();
    applyState();
    const to = o.g.position.clone();
    o.anim = { from, to, t0: performance.now(), dur: 500 }; o.g.position.copy(from); requestRender();
  }
  function selectPart(i) { ui.sel = ui.sel === i ? -1 : i; applyState(); renderExplode(); }

  function stepSummary(k) {      // svary vzniklé v kroku k
    const c = { ok: 0, tight: 0, no: 0, pend: 0 };
    M.seams.forEach((sm) => { const ctx = seamCtx(sm); if (!ctx || ctx.step !== k) return; const s = stOf(seamResult(sm)); if (s) c[s]++; });
    return c;
  }
  function dots(c) {
    const out = [];
    ['ok', 'tight', 'no', 'pend'].forEach((s) => { if (c[s]) out.push('<span class="dot d-' + s + '"></span>' + c[s]); });
    return out.join(' ');
  }
  function renderSeq() {
    $('stepCnt').textContent = ui.step + ' / ' + seq.length;
    $('stepR').max = seq.length; $('stepR').value = ui.step;
    ['first', 'prev'].forEach((id) => { $(id).disabled = ui.step <= 0; });
    ['next', 'last', 'play'].forEach((id) => { $(id).disabled = ui.step >= seq.length; });
    $('undo').disabled = !seq.length; $('clear').disabled = !seq.length;
    document.querySelectorAll('#ghostSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.ghost)));
    const rows = seq.map((i, k) => {
      const r = ins(i, k), warn = k ? insWarn(r) : '';
      const sub = (k === 0 ? 'první díl' : 'nasadit ' + dirWord(r.dir) + (r.tabs ? ' (zámky)' : r.guided ? ' (jinak nejde – dosedací plochy)' : '')) + (warn ? ' · ⚠ ' + warn : '');
      return '<button type="button" class="it" data-k="' + (k + 1) + '" aria-current="' + (ui.step === k + 1) + '"><span class="n">' + (k + 1) + '.</span>' + swatch(i) +
        '<span class="tx' + (k + 1 > ui.step ? ' muted' : '') + '">' + esc(M.items[i].label) + '<small' + (warn ? ' style="color:var(--bad-ink)"' : '') + '>' + esc(sub) + '</small></span><span class="st">' + dots(stepSummary(k + 1)) + '</span></button>';
    });
    $('seqList').innerHTML = rows.length ? rows.join('') : '<div class="it" style="padding:12px;font-size:13px;color:var(--muted)">Zatím prázdné – klikni na první díl, nebo nech pořadí navrhnout.</div>';
    $('seqList').querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => goStep(+b.dataset.k)));
    const rest = M.items.map((it, i) => i).filter((i) => stepOf[i] == null);
    $('restList').innerHTML = rest.length ? rest.map((i) => '<button type="button" class="it" data-i="' + i + '"><span class="n">+</span>' + swatch(i) + '<span class="tx">' + esc(M.items[i].label) + '<small>' + esc(partSub(M.items[i], i)) + '</small></span><span class="st"></span></button>').join('') : '<div class="it" style="padding:12px;font-size:13px;color:var(--muted)">Všechny díly jsou zařazené.</div>';
    $('restList').querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => appendStep(+b.dataset.i)));
    // aktuální krok
    const box = $('stepInfo');
    if (!seq.length) { box.className = 'info'; box.innerHTML = 'Postup je prázdný.'; return; }
    if (ui.step === 0) { box.className = 'info'; box.innerHTML = 'Krok 0 – nic není položené. Klikni ▶ nebo Přehrát.'; return; }
    const i = seq[ui.step - 1], r = ins(i, ui.step - 1), c = stepSummary(ui.step);
    const nS = c.ok + c.tight + c.no + c.pend;
    const bad = M.seams.filter((sm) => { const ctx = seamCtx(sm); return ctx && ctx.step === ui.step && stOf(seamResult(sm)) === 'no'; });
    const first = ui.step === 1, blocked = !first && r.blocked && r.blocked.length, conflict = !first && r.conflict;
    box.className = 'info' + (conflict || blocked || c.no ? ' bad' : c.tight ? ' warn' : '');
    box.innerHTML = '<b>Krok ' + ui.step + ': ' + esc(M.items[i].label) + '</b>' +
      '<span>' + (first ? 'Položit jako základ.' : 'Nasadit ' + dirWord(r.dir) + (r.tabs ? ' – směr dávají zámky (' + esc(r.why.join('; ')) + ')' : r.guided ? ' – shora to nejde, směr dávají ' + esc(r.why.join('; ')) + ' (pokos / výřez)' : '') + '.') + '</span>' +
      (!first && !ui.flip && dirWord(r.dir) === 'zespodu' ? '<span class="fine">Tip: zapni „Vzhůru nohama“ – rám leží na stole a díl nasadíš shora.</span>' : '') +
      (conflict ? '<span><b>Tímhle pořadím díl nejde nasadit</b> – ' + (r.tabs ? 'zámky ho vedou jedním směrem a dosedací plochy jiným' : 'je zaklíněný ze všech stran') + ' (' + esc(names(r.against)) + '). Polož ho dřív než ' + (r.against.length > 1 ? 'aspoň jeden z nich' : 'tenhle díl') + '.</span>' : '') +
      (blocked ? '<span><b>Cestou na místo narazí do: ' + esc(names(r.blocked)) + '.</b> Polož ho dřív než ' + (r.blocked.length > 1 ? 'ně' : 'něj') + ', nebo zkus jiné pořadí.</span>' : '') +
      '<span>Svary v tomhle kroku: ' + (nS ? nS + ' úseků – ' + ['ok', 'tight', 'no'].filter((s) => c[s]).map((s) => c[s] + ' ' + ST_TXT[s]).join(', ') + (c.pend ? ', počítám…' : '') : 'žádné (jen položení / zámky)') + '</span>' +
      (bad.length ? '<span>Nedosáhneš na: ' + esc([...new Set(bad.map((sm) => { const r = seamResult(sm); return M.items[sm.a === i ? sm.b : sm.a].label + ' (' + sm.kind + (r && r.diag ? ', ' + causeText(r.diag, true) : '') + ')'; }))].join('; ')) + '. Detail: záložka Svářečka → klik na červený svar.</span>' : '');
  }
  function goStep(k, anim) {
    const prev = ui.step;
    ui.step = Math.max(0, Math.min(seq.length, k));
    applyState(anim && ui.step === prev + 1 ? seq[ui.step - 1] : undefined);
    renderSeq();
  }
  function appendStep(i) {
    if (stepOf[i] != null) { goStep(stepOf[i]); return; }
    seq = seq.slice(0, Math.max(ui.step, seq.length)); seq.push(i); reindex(); saveSeq();
    ui.step = seq.length - 1;
    goStep(seq.length, true);
    renderTorch();
  }
  let playT = null;
  function play() {
    if (playT) { stopPlay(); return; }
    if (ui.step >= seq.length) goStep(0);
    $('play').textContent = 'Zastavit'; $('play').disabled = false;
    const tick = () => { if (ui.step >= seq.length) { stopPlay(); return; } goStep(ui.step + 1, true); $('play').disabled = false; playT = setTimeout(tick, 1050); };
    tick();
  }
  function stopPlay() { clearTimeout(playT); playT = null; $('play').textContent = 'Přehrát'; renderSeq(); }

  function renderTorch() {
    document.querySelectorAll('#torchSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.torch.id)));
    $('tr0').value = ui.torch.r0 * 2; $('tR').value = ui.torch.R * 2; $('tso').value = ui.torch.so; $('tL').value = ui.torch.L;
    $('tTable').checked = ui.table;
    const c = { ok: 0, tight: 0, no: 0, pend: 0 }, bad = [];
    let skipped = 0;
    M.seams.forEach((sm) => { const r = seamResult(sm), s = stOf(r); if (!s) { skipped++; return; } c[s]++; if (s === 'no' || s === 'tight') bad.push([sm, s]); });
    const box = $('torchSum'), tot = c.ok + c.tight + c.no + c.pend;
    box.className = 'info' + (c.no ? ' bad' : c.tight ? ' warn' : tot && !c.pend ? ' ok' : '');
    box.innerHTML = '<b>' + (seq.length ? 'Svary podle postupu (každý v kroku, kdy vzniká)' : 'Bez postupu: svary po smontování všech dílů') + '</b>' +
      '<span>' + tot + ' úseků: ' + dots(c) + (c.pend ? ' · počítám…' : '') + (skipped ? ' · ' + skipped + ' čeká na zařazení dílů do postupu' : '') + '</span>' +
      (bad.length ? '<div class="list" style="margin-top:4px">' + bad.slice(0, 12).map(([sm, s]) => '<button type="button" class="it" data-s="' + sm.id + '"><span class="n">' + (seq.length ? seamCtx(sm).step + '.' : '') + '</span><span class="dot d-' + s + '"></span><span class="tx">' + esc(M.items[sm.a].label) + ' × ' + esc(M.items[sm.b].label) + '<small>' + esc(sm.kind) + ' · ' + K.nf(sm.length) + ' mm' + (seamResult(sm).diag ? ' · ' + esc(causeText(seamResult(sm).diag, true)) : '') + '</small></span><span class="st">' + ST_TXT[s] + '</span></button>').join('') + '</div>' : '');
    box.querySelectorAll('button[data-s]').forEach((b) => b.addEventListener('click', () => probeSeam(+b.dataset.s)));
  }
  function refreshStatus() {
    if (!M) return;
    applyState();
    if (ui.tab === 'seq') renderSeq();
    if (ui.tab === 'torch') renderTorch();
  }
  function renderLegend() {
    const L = $('legend');
    if (ui.tab === 'explode') L.innerHTML = (ui.seams ? '<span><i style="background:' + COL.seam + '"></i>svar</span>' : '') + (ui.tabsHi ? '<span><i style="background:' + COL.tab + ';width:9px;height:9px;border-radius:50%"></i>zámek</span><span><i style="background:' + COL.slot + ';width:8px;height:8px;border-radius:50%"></i>drážka / otvor</span>' : '');
    else L.innerHTML = '<span><i style="background:' + COL.ok + '"></i>přístupný</span><span><i style="background:' + COL.tight + '"></i>omezeně</span><span><i style="background:' + COL.no + '"></i>nepřístupný</span><span><i style="background:' + COL.pend + '"></i>počítám</span>';
    L.hidden = !L.innerHTML;
  }

  /* ---------------- sonda svářečky ---------------- */
  function clearProbe() { if (probeObj) { root.remove(probeObj); disposeTree(probeObj); probeObj = null; } }
  function drawProbe(P, D0, r) {
    clearProbe();
    const g = new THREE.Group(), T = ui.torch, Ls = Math.max(28, M.s * 1.1);
    const pos = [], col = [];
    const cOk = new THREE.Color(COL.ok), cNo = new THREE.Color(COL.no);
    r.samples.forEach((sm) => { const q = V.add(P, V.mul(sm.d, Ls)); pos.push(...P, ...q); const c = sm.free ? cOk : cNo; col.push(c.r, c.g, c.b, c.r, c.g, c.b); });
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ vertexColors: true })));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(Math.max(2, M.s * 0.08), 14, 10), new THREE.MeshBasicMaterial({ color: '#17181A' })); dot.position.copy(v3(P)); g.add(dot);
    const idl = new THREE.BufferGeometry(); idl.setAttribute('position', new THREE.Float32BufferAttribute([...P, ...V.add(P, V.mul(D0, Ls * 1.6))], 3));
    const dl = new THREE.Line(idl, new THREE.LineDashedMaterial({ color: 0x17181A, dashSize: 4, gapSize: 3 })); dl.computeLineDistances(); g.add(dl);
    if (r.best) {
      const prof = [new THREE.Vector2(0, T.so), new THREE.Vector2(T.r0, T.so), new THREE.Vector2(T.R, T.so + T.taper), new THREE.Vector2(T.R, T.L), new THREE.Vector2(0, T.L)];
      const torch = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), new THREE.MeshStandardMaterial({ color: r.status === 'ok' ? '#3E8E5E' : r.status === 'tight' ? '#C77B00' : '#B3261E', transparent: true, opacity: 0.55, roughness: 0.5, depthWrite: false }));
      torch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(r.best).normalize());
      torch.position.copy(v3(P)); g.add(torch);
      const wire = new THREE.BufferGeometry(); wire.setAttribute('position', new THREE.Float32BufferAttribute([...P, ...V.add(P, V.mul(r.best, T.so))], 3));
      g.add(new THREE.Line(wire, new THREE.LineBasicMaterial({ color: 0x17181A })));
    }
    probeObj = g; root.add(g); requestRender();
  }
  function probeText(r, head, dg) {
    const box = $('probeInfo');
    box.className = 'info ' + (r.status === 'ok' ? 'ok' : r.status === 'tight' ? 'warn' : 'bad');
    box.innerHTML = head + '<span><b>' + (r.status === 'ok' ? 'Dosáhneš' : r.status === 'tight' ? 'Jen hodně skloněným hořákem' : 'Nedosáhneš') + '</b> – volných ' + r.nFree + ' z ' + r.n + ' směrů' + (r.best ? ', nejlepší ' + Math.round(r.bestAng) + '° od ideálního úhlu' : '') + '.</span>' +
      (dg ? '<span>' + esc(causeText(dg)) + '</span>' : '') +
      '<div class="row-btns"><button class="btn sm" type="button" id="zoomP">Přiblížit na místo</button><button class="btn sm" type="button" id="clrP">Zrušit</button></div>';
    $('zoomP').addEventListener('click', zoomProbe);
    $('clrP').addEventListener('click', () => { ui.probe = null; clearProbe(); box.className = 'info'; box.textContent = 'Zatím nic nevybráno.'; applyState(); });
  }
  function zoomProbe() {
    if (!ui.probe) return;
    const p = root.localToWorld(v3(ui.probe.P)), off = camera.position.clone().sub(controls.target).setLength(Math.max(260, M.s * 9));
    controls.target.copy(p); camera.position.copy(p).add(off); controls.update(); requestRender();
  }
  function probeSeam(id) {
    const sm = M.seams[id], ctx = seamCtx(sm); if (!ctx) return;
    if (seq.length && ui.step !== ctx.step) { ui.step = ctx.step; }
    if (ui.tab !== 'torch') setTab('torch');
    const r = Mz.reach(M, sm.mid, sm.ideal, ctx.obst, ui.torch, tableCfg(), { n: 60 });
    const dg = Mz.diagnose(M, sm.mid, sm.ideal, [sm.a, sm.b], ctx.obst, ui.torch, tableCfg(), r);
    ui.probe = { P: sm.mid, seam: id };
    applyState(); drawProbe(sm.mid, sm.ideal, r);
    probeText(r, '<b>Svar: ' + esc(M.items[sm.a].label) + ' × ' + esc(M.items[sm.b].label) + '</b><span>' + esc(sm.kind) + ' · délka úseku ' + K.nf(sm.length) + ' mm' + (seq.length ? ' · krok ' + ctx.step + ' (položeno ' + ctx.obst.length + ' dílů)' : ' · po smontování všeho') + '</span>', dg);
    renderTorch();
  }
  function probePoint(pw) {
    const pl = root.worldToLocal(pw.clone()), p = [pl.x, pl.y, pl.z];
    const sn = Mz.surfaceNormalAt(M, p); if (!sn) return;
    const P = V.add(p, V.mul(sn.n, 0.05));
    const obst = seq.length ? seq.slice(0, ui.step) : M.items.map((_, i) => i);
    const r = Mz.reach(M, P, sn.n, obst, ui.torch, tableCfg(), { n: 60 });
    const dg = Mz.diagnose(M, P, sn.n, [sn.item], obst, ui.torch, tableCfg(), r);
    ui.probe = { P, seam: -1 };
    applyState(); drawProbe(P, sn.n, r);
    probeText(r, '<b>Bod na dílu ' + esc(M.items[sn.item].label) + '</b><span>ideální směr = kolmo na plochu' + (seq.length ? ' · krok ' + ui.step + ' (položeno ' + obst.length + ' dílů)' : '') + '</span>', dg);
  }

  /* ---------------- klikání v 3D ---------------- */
  const ray = new THREE.Raycaster();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || !M) return;
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const targets = [];
    objs.forEach((o) => { if (o.g.visible) o.meshes.forEach((m) => targets.push(m)); });
    seamObjs.forEach((so) => { if (so.mesh.visible && so.mesh.parent.visible) targets.push(so.mesh); });
    const hits = ray.intersectObjects(targets, false).filter((h) => !(ui.tab === 'torch' && h.object.material.opacity < 0.9));
    if (!hits.length) return;
    const h = hits[0], seamId = h.object.userData.seam, idx = seamId != null ? M.seams[seamId].a : h.object.userData.idx;
    if (ui.tab === 'explode') selectPart(idx);
    else if (ui.tab === 'seq') appendStep(idx);
    else if (seamId != null) probeSeam(seamId);
    else probePoint(h.point);
  });

  /* ---------------- ovládání ---------------- */
  function setTab(t) {
    ui.tab = t;
    if (t === 'torch' && seq.length && ui.step === 0) ui.step = seq.length;
    ['explode', 'seq', 'torch'].forEach((x) => { $('tab-' + x).setAttribute('aria-selected', String(x === t)); $('pane-' + x).hidden = x !== t; });
    if (t !== 'torch') { ui.probe = null; clearProbe(); }
    objs.forEach((o) => { o.anim = null; });
    applyState(); renderPanels();
  }
  ['explode', 'seq', 'torch'].forEach((x) => $('tab-' + x).addEventListener('click', () => setTab(x)));
  $('exp').addEventListener('input', (e) => { ui.explode = +e.target.value; $('expV').textContent = ui.explode + ' %'; objs.forEach((o) => { o.anim = null; }); applyState(); });
  $('exp').addEventListener('change', () => fit(null));
  let disT = null;
  $('pullAll').addEventListener('click', () => {      // rozebrat po jednom: v opačném pořadí skládání
    clearTimeout(disT);
    const order = explodeOrder().slice().reverse();
    let k = 0;
    const tick = () => { if (k >= order.length) { fit(null); return; } ui.pulled.add(order[k]); animateTo(order[k]); k++; renderExplode(); disT = setTimeout(tick, 420); };
    tick();
  });
  $('resetAll').addEventListener('click', () => { clearTimeout(disT); ui.pulled.clear(); ui.hidden.clear(); ui.isolate = -1; ui.explode = 0; objs.forEach((o, i) => animateTo(i)); renderExplode(); disT = setTimeout(() => fit(null), 560); });
  $('suggest').addEventListener('click', () => { seq = Mz.suggestOrder(M); reindex(); saveSeq(); goStep(0); renderTorch(); });
  $('undo').addEventListener('click', () => { seq.pop(); reindex(); saveSeq(); goStep(Math.min(ui.step, seq.length)); renderTorch(); });
  $('clear').addEventListener('click', () => { seq = []; reindex(); saveSeq(); goStep(0); renderTorch(); });
  $('first').addEventListener('click', () => goStep(0));
  $('prev').addEventListener('click', () => goStep(ui.step - 1));
  $('next').addEventListener('click', () => goStep(ui.step + 1, true));
  $('last').addEventListener('click', () => goStep(seq.length));
  $('play').addEventListener('click', play);
  $('stepR').addEventListener('input', (e) => goStep(+e.target.value));
  document.querySelectorAll('#ghostSeg button').forEach((b) => b.addEventListener('click', () => { ui.ghost = b.dataset.v; saveUi(); applyState(); renderSeq(); }));
  document.querySelectorAll('#torchSeg button').forEach((b) => b.addEventListener('click', () => { ui.torch = Object.assign({}, Mz.TORCH[b.dataset.v]); saveUi(); resetReach(); ui.probe = null; clearProbe(); refreshStatus(); renderTorch(); }));
  [['tr0', 'r0', 0.5], ['tR', 'R', 0.5], ['tso', 'so', 1], ['tL', 'L', 1]].forEach(([id, key, k]) => $(id).addEventListener('change', (e) => {
    const v = Number(e.target.value); if (!(v > 0)) return;
    ui.torch = Object.assign({}, ui.torch, { [key]: v * k, id: 'vlastni' }); saveUi(); resetReach(); refreshStatus(); renderTorch();
  }));
  $('tTable').addEventListener('change', (e) => { ui.table = e.target.checked; saveUi(); resetReach(); refreshStatus(); });
  const toggle = (id, key, after) => { const el = $(id); el.checked = ui[key]; el.addEventListener('change', () => { ui[key] = el.checked; saveUi(); if (after) after(); applyState(); renderPanels(); }); };
  toggle('tFlip', 'flip', () => { applyFlip(); resetReach(); exOrder = null; resetExplode(); ui.probe = null; clearProbe(); fit(ui.view); });
  toggle('tTabs', 'tabsHi');
  toggle('tSeams', 'seams');
  toggle('tColors', 'colors');
  toggle('tDesk', 'desk', () => { buildScene(); });
  document.querySelectorAll('.views button').forEach((b) => b.addEventListener('click', () => {
    ui.view = b.dataset.view;
    document.querySelectorAll('.views button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fit(ui.view);
  }));
  document.addEventListener('keydown', (e) => {
    if (ui.tab !== 'seq' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') { goStep(ui.step + 1, true); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { goStep(ui.step - 1); e.preventDefault(); }
  });

  renderCfg();
  resize();
  rebuild();
})();
