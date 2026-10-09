/* 3D náhled konferenčního stolku (three.js) – stejné světlo, stín a barvy jako náhled podnoží (viewer.js).
   Používá ho zákaznická stránka (stolecky.html) i dílna (interni.html → Stolečky – podklady).
   StoViewer.create(host) → { update(B, { showDesk, see, person }), view(name) } ; B = Stolecky.build(cfg). */
(function (root) {
  'use strict';
  const METAL = { black: [0x26272A, 0.35, 0.55], anth: [0x3E444B, 0.4, 0.5], white: [0xE9E9E4, 0.1, 0.6], raw: [0x8A847B, 0.75, 0.38] };
  const VIEWS = { iso: [-0.62, -1, 0.5], front: [0, -1, 0.08], side: [1, 0, 0.08], top: [0, -0.0001, 1], bottom: [-0.55, -1, -0.62] };

  /* postava z figure.js (stejná jako u podnoží) – potřebuje jen obrys desky a výšku */
  function personBodies(c, person) {
    if (!person || !root.Postava || !root.Podnoze) return [];
    const A = { cfg: { shape: 'circle', H: c.H, size: 0 }, DL: c.topD, DW: c.topD, build: { dims: { Hf: c.H - c.topT } } };
    try { return root.Postava.build(A, person).bodies; } catch (e) { return []; }
  }

  function create(host) {
    const THREE = root.THREE;
    if (!THREE || !THREE.OrbitControls) { host.innerHTML = '<p class="nojs" style="padding:24px;color:#5E5A54">3D náhled se nenačetl (chybí připojení k internetu nebo WebGL).</p>'; return null; }
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { host.innerHTML = '<p class="nojs" style="padding:24px;color:#5E5A54">3D náhled nejde spustit (WebGL).</p>'; return null; }
    r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.outputEncoding = THREE.sRGBEncoding;
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
      const c = st.B.cfg, p = st.o.person, hh = p ? Math.max(c.H, p.S * (p.pose === 'sit' ? 0.75 : 1)) : c.H;
      const m = new THREE.Vector3(0, p ? -c.topD * 0.35 : 0, hh * 0.45), d = Math.max(hh, c.topD) * 2.4;
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
      const wood = new THREE.MeshStandardMaterial({ color: '#C39566', roughness: 0.78, metalness: 0, transparent: see, opacity: see ? 0.32 : 1, depthWrite: !see });
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x8A847B });
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
