/* 3D náhled konferenčního stolku (three.js) – stejné světlo, stín a barvy jako náhled podnoží (viewer.js).
   Používá ho zákaznická stránka (stolecky.html) i dílna (interni.html → Stolečky – podklady).
   StoViewer.create(host) → { update(B, { showDesk, see, person }), view(name) } ; B = Stolecky.build(cfg). */
(function (root) {
  'use strict';
  const METAL = { black: [0x26272A, 0.35, 0.55], anth: [0x3E444B, 0.4, 0.5], white: [0xE9E9E4, 0.1, 0.6], raw: [0x8A847B, 0.75, 0.38] };
  const VIEWS = { iso: [-0.62, -1, 0.5], front: [0, -1, 0.08], side: [1, 0, 0.08], top: [0, -0.0001, 1], bottom: [-0.55, -1, -0.62] };
  let butterflyMeshes = null, butterflyLoad = null;

  /* postava z figure.js (stejná jako u podnoží) – potřebuje jen obrys desky a výšku */
  function personBodies(c, person) {
    if (!person || !root.Postava || !root.Podnoze) return [];
    const H = c.H, D = c.topD, T = c.model === 'motylek' ? (c.motylekTop === 'vlastni' ? c.motylekTopT : 4) : c.topT;
    const A = { cfg: { shape: 'circle', H, size: 0 }, DL: D, DW: D, build: { dims: { Hf: H - T } } };
    try { return root.Postava.build(A, person).bodies; } catch (e) { return []; }
  }

  function ashTexture(THREE, renderer, oak) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d'), base = ctx.createLinearGradient(0, 0, 0, canvas.height);
    base.addColorStop(0, oak ? '#875632' : '#BFA77D'); base.addColorStop(0.24, oak ? '#C08A55' : '#E1D0AA'); base.addColorStop(0.58, oak ? '#A87545' : '#CFB98D'); base.addColorStop(1, oak ? '#704526' : '#B59B6E');
    ctx.fillStyle = base; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let seed = 1618;
    const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 260; i++) {
      const y = rand() * 512, amp = 1 + rand() * 7, phase = rand() * 6.28, freq = 0.003 + rand() * 0.014;
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 8) {
        const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 0.29 + phase * 1.4) * amp * 0.75;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      const dark = rand() > 0.47;
      ctx.strokeStyle = dark ? `rgba(75,57,34,${0.07 + rand() * 0.18})` : `rgba(255,246,221,${0.09 + rand() * 0.2})`;
      ctx.lineWidth = 0.6 + rand() * (oak ? 4.2 : 3.2); ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const x = rand() * 1024, y = rand() * 512, rx = 12 + rand() * 34, ry = 3 + rand() * 8;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.beginPath(); ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(80,61,38,0.2)'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function epoxyTexture(THREE, renderer, oak) {
    const wood = ashTexture(THREE, renderer, oak), canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d'); ctx.drawImage(wood.image, 0, 0);
    ctx.beginPath();
    for (let y = -10; y <= 522; y += 10) { const x = 512 + Math.sin(y * .013) * 55 + Math.sin(y * .037) * 18; if (y === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    for (let y = 522; y >= -10; y -= 10) ctx.lineTo(512 + Math.sin(y * .013 + 1.6) * 55 + Math.sin(y * .037 + 1.6) * 18, y);
    ctx.closePath(); const g = ctx.createLinearGradient(420, 0, 620, 0); g.addColorStop(0, '#063246'); g.addColorStop(.3, '#0D7180'); g.addColorStop(.62, '#168C91'); g.addColorStop(1, '#082E48'); ctx.fillStyle = g; ctx.fill();
    for (let i = 0; i < 24; i++) { const y = i * 22, x = 510 + Math.sin(i * .8) * 43; ctx.beginPath(); ctx.ellipse(x, y, 15 + (i % 4) * 8, 3 + (i % 3) * 2, .2, 0, Math.PI * 2); ctx.fillStyle = i % 3 ? 'rgba(120,235,219,.15)' : 'rgba(1,34,55,.25)'; ctx.fill(); }
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); wood.dispose(); return texture;
  }

  function mapDeskUv(THREE, geometry) {
    const positions = geometry.attributes.position;
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox, width = Math.max(1, bounds.max.x - bounds.min.x), depth = Math.max(1, bounds.max.y - bounds.min.y);
    const uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {
      uv[i * 2] = (positions.getX(i) - bounds.min.x) / width;
      uv[i * 2 + 1] = (positions.getY(i) - bounds.min.y) / depth;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  function create(host) {
    const THREE = root.THREE;
    if (!THREE || !THREE.OrbitControls) { host.innerHTML = '<p class="nojs" style="padding:24px;color:#5E5A54">3D náhled se nenačetl (chybí připojení k internetu nebo WebGL).</p>'; return null; }
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { host.innerHTML = '<p class="nojs" style="padding:24px;color:#5E5A54">3D náhled nejde spustit (WebGL).</p>'; return null; }
    r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.outputEncoding = THREE.sRGBEncoding;
    const deskTextures = { ash: ashTexture(THREE, r, false), oak: ashTexture(THREE, r, true), epoxy: epoxyTexture(THREE, r, true) };
    host.appendChild(r.domElement); r.domElement.style.display = 'block'; r.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 1, 12000); cam.up.set(0, 0, 1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(-1500, -2200, 3200); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -1600, right: 1600, top: 1600, bottom: -1600, near: 100, far: 9000 }); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(2000, 1500, 800); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.ShadowMaterial({ opacity: 0.16 })); ground.receiveShadow = true; scene.add(ground);
    const ctl = new THREE.OrbitControls(cam, r.domElement); ctl.enableDamping = true;
    const grp = new THREE.Group(); scene.add(grp);
    const st = { B: null, o: {}, v: 'iso', fitted: false };
    const size = () => { const w = host.clientWidth || 600, h = host.clientHeight || 400; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    root.addEventListener('resize', size); size();
    (function loop() { ctl.update(); r.render(scene, cam); requestAnimationFrame(loop); })();

    function view(v) {
      st.v = v || st.v;
      if (!st.B) return;
      size();
      const c = st.B.cfg, H = c.H, D = c.topD;
      const p = st.o.person, hh = p ? Math.max(H, p.S * (p.pose === 'sit' ? 0.75 : 1)) : H;
      const m = new THREE.Vector3(0, p ? -D * 0.35 : 0, hh * 0.45), d = Math.max(hh, D) * 2.4;
      cam.position.copy(m).add(new THREE.Vector3(...VIEWS[st.v]).normalize().multiplyScalar(d)); ctl.target.copy(m); ctl.update();
    }
    function bodyMesh(b) {
      const pos = [];
      b.faces.forEach((f) => { const o = f.outer; for (let i = 1; i + 1 < o.length; i++) [o[0], o[i], o[i + 1]].forEach((k) => pos.push(...b.verts[k])); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: b.color || '#B7BEC6', roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }));
      m.castShadow = true; return m;
    }
    function update(B, o) {
      st.B = B; st.o = o || {};
      while (grp.children.length) { const x = grp.children.pop(); x.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); }
      const c = B.cfg, G = B.G, see = !!st.o.see, M = METAL[c.fin] || METAL.black;
      const steel = new THREE.MeshStandardMaterial({ color: M[0], metalness: M[1], roughness: M[2] });
      const board = ['oak', 'epoxy'].includes(st.o.boardMaterial) ? st.o.boardMaterial : 'ash';
      const wood = new THREE.MeshStandardMaterial({ map: deskTextures[board], color: '#FFFFFF', roughness: board === 'epoxy' ? 0.24 : 0.66, metalness: board === 'epoxy' ? 0.08 : 0, transparent: see, opacity: see ? 0.32 : 1, depthWrite: !see });
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x8A847B });
      if (B.model === 'motylek') {
        const ownTop = c.motylekTop === 'vlastni';
        const show = (meshes) => {
          if (st.B !== B) return;
          meshes.forEach((sourcePart) => {
            if (ownTop && /deska/i.test(sourcePart.name)) return;
            const part = root.Stolecky ? root.Stolecky.transformMotylekMesh(sourcePart, sourcePart.name, c) : sourcePart;
            const isDesk = /deska/i.test(part.name);
            if (st.o.showDesk === false && isDesk) return;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
            g.setIndex(part.indices);
            g.computeVertexNormals();
            // Zde je deska vždy ocelová (vlastní dřevěná se vykresluje níže jako válec) → ocelový materiál se zvoleným povrchem, žádná textura dřeva.
            const transparent = see && isDesk;
            const mat = new THREE.MeshStandardMaterial({ color: M[0], metalness: M[1], roughness: M[2], side: THREE.DoubleSide, transparent, opacity: transparent ? 0.4 : 1, depthWrite: !transparent });
            const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
          });
          if (ownTop) {
            const topT = c.motylekTopT;
            if (st.o.showDesk !== false) {
              const top = new THREE.Mesh(new THREE.CylinderGeometry(c.topD / 2, c.topD / 2, topT, 96), wood);
              top.rotation.x = Math.PI / 2; top.position.set(0, 0, c.H - topT / 2); top.castShadow = !see; grp.add(top);
            }
            const tabShape = new THREE.Shape();
            tabShape.moveTo(-22, -22); tabShape.lineTo(22, -22); tabShape.lineTo(22, 22); tabShape.lineTo(-22, 22); tabShape.closePath();
            const hole = new THREE.Path();
            hole.moveTo(-6.25, -2.75); hole.lineTo(6.25, -2.75); hole.absarc(6.25, 0, 2.75, -Math.PI / 2, Math.PI / 2, false);
            hole.lineTo(-6.25, 2.75); hole.absarc(-6.25, 0, 2.75, Math.PI / 2, 3 * Math.PI / 2, false); tabShape.holes.push(hole);
            const tabGeometry = new THREE.ExtrudeGeometry(tabShape, { depth: 4, bevelEnabled: false });
            const tabMaterial = new THREE.MeshStandardMaterial({ color: M[0], metalness: M[1], roughness: M[2], side: THREE.DoubleSide });
            B.mountTabs.forEach((p) => {
              const tab = new THREE.Mesh(tabGeometry, tabMaterial); tab.position.set(p.x, p.y, p.z); tab.rotation.z = p.rotation; tab.castShadow = true; tab.receiveShadow = true; grp.add(tab);
            });
          }
          personBodies(c, st.o.person).forEach((b) => grp.add(bodyMesh(b)));
          if (!st.fitted) { st.fitted = true; view('iso'); }
        };
        if (butterflyMeshes) show(butterflyMeshes);
        else {
          if (!butterflyLoad) butterflyLoad = fetch(B.meshAsset).then((res) => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          }).then((asset) => { butterflyMeshes = asset.meshes; return butterflyMeshes; });
          butterflyLoad.then(show).catch(() => {
            if (st.B === B) { const hint = host.parentElement.querySelector('#hint'); if (hint) { hint.hidden = false; hint.textContent = '3D model Motýlek se nepodařilo načíst.'; } }
          });
        }
        return;
      }
      const ccw = (q) => { let pts = q.map((p) => new THREE.Vector2(p[0], p[1])); if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.reverse(); return pts; };
      const bars = (polys, plane, zc) => polys.forEach((q) => {
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(ccw(q)), { depth: G.hd, bevelEnabled: false });
        g.translate(0, 0, -G.hd / 2);
        const m = new THREE.Matrix4();
        if (plane === 'xz') m.set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, zc, 0, 0, 0, 1);
        else m.set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, zc, 0, 0, 0, 1);
        g.applyMatrix4(m);
        const mesh = new THREE.Mesh(g, steel); mesh.castShadow = true;
        grp.add(mesh, new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), edgeMat));
      });
      bars(B.cut.lam, 'xz', G.zl); bars(B.cut.mid, 'yz', G.zm); bars(B.cut.vee, 'xz', G.zu);
      /* plechy: obrys s otvory pro nohy a dírami pro vruty */
      const plate = (pl, z) => {
        const sh = new THREE.Shape(ccw(pl.outline));
        pl.holes.forEach((h) => sh.holes.push(new THREE.Path(ccw(h).reverse())));
        pl.circles.forEach((cc) => { const p = new THREE.Path(); p.absarc(cc[0], cc[1], cc[2], 0, Math.PI * 2, true); sh.holes.push(p); });
        const g = new THREE.ExtrudeGeometry(sh, { depth: pl.t, bevelEnabled: false, curveSegments: 16 });
        g.translate(0, 0, z);
        const mesh = new THREE.Mesh(g, steel); mesh.castShadow = true; grp.add(mesh);
      };
      plate(B.plates.base, 0);
      const zt = c.H - c.topT - c.plT;
      plate(B.plates.top, zt);
      (B.plates.top.studs || []).forEach((p) => {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 20, 16), steel);
        s.rotation.x = Math.PI / 2; s.position.set(p[0], p[1], zt + c.plT + 10); grp.add(s);
      });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(c.topD / 2, c.topD / 2, c.topT, 72), wood);
      top.rotation.x = Math.PI / 2; top.position.set(0, 0, c.H - c.topT / 2); top.visible = st.o.showDesk !== false; top.castShadow = !see; grp.add(top);
      personBodies(c, st.o.person).forEach((b) => grp.add(bodyMesh(b)));
      if (!st.fitted) { st.fitted = true; view('iso'); }
    }
    return { update, view, resize: size };
  }

  root.StoViewer = { create, METAL };
})(typeof window !== 'undefined' ? window : globalThis);
