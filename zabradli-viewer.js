/* 3D náhled zábradlí (three.js 0.147, globální THREE). Bez WebGL kreslí 2D náhled přes Podnoze.paint (core.js). */
(function (root) {
  'use strict';
  const Zb = root.Zabradli, V = Zb.V;
  const STEEL = { zn: ['#AEB3B6', 0.55, 0.42], znpu: ['#A2A9AE', 0.45, 0.32], prasek: ['#3B4148', 0.3, 0.55], duplex: ['#3E444B', 0.3, 0.52] };
  const DIRS = { iso: [-0.55, -1, 0.6], front: [0, -1, 0.08], side: [1, 0, 0.08], top: [0, -0.0001, 1] };

  function orient(P, f) {
    const nw = (lp) => { const n = [0, 0, 0]; lp.forEach((a, i) => { const A = P[a], B = P[lp[(i + 1) % lp.length]]; n[0] += (A[1] - B[1]) * (A[2] + B[2]); n[1] += (A[2] - B[2]) * (A[0] + B[0]); n[2] += (A[0] - B[0]) * (A[1] + B[1]); }); return n; };
    let outer = f.outer.slice(); if (V.dot(nw(outer), f.n) < 0) outer.reverse();
    const inner = f.inner.map((lp) => { lp = lp.slice(); if (V.dot(nw(lp), f.n) > 0) lp.reverse(); return lp; });
    return { outer, inner, n: f.n };
  }
  function triangles(solid, pos) {
    const P = solid.verts;
    solid.faces.forEach((f0) => {
      const f = orient(P, f0), n = V.unit(f.n);
      const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = V.unit(V.cross(n, ax)), e2 = V.cross(n, e1);
      const to2 = (i) => new THREE.Vector2(V.dot(P[i], e1), V.dot(P[i], e2));
      const idx = f.outer.concat(...f.inner);
      THREE.ShapeUtils.triangulateShape(f.outer.map(to2), f.inner.map((lp) => lp.map(to2))).forEach((tr) => {
        let [a, b, c] = tr.map((k) => P[idx[k]]);
        if (V.dot(V.cross(V.sub(b, a), V.sub(c, a)), n) < 0) { const t = b; b = c; c = t; }
        pos.push(...a, ...b, ...c);
      });
    });
  }
  function geo(solids) {
    const pos = []; solids.forEach((s) => triangles(s, pos));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  function bounds(A, withCtx) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    const take = (s) => s.verts.forEach((p) => { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); } });
    A.lay.members.forEach((m) => take(m.solid));
    if (withCtx) A.build.context.forEach((c) => take(c.solid));
    return { mn, mx };
  }

  function create(host) {
    const state = { A: null, view: 'iso', ctx: true, key: '' };
    let ok = false;
    try { if (root.THREE && THREE.OrbitControls) { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')); } } catch (e) { ok = false; }

    if (!ok) {
      const cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;height:100%;display:block'; host.appendChild(cv);
      const ang = { iso: [-35, 24], front: [0, 6], side: [90, 6], top: [0, 89] };
      const draw = () => {
        if (!state.A || !root.Podnoze) return;
        const r = host.getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
        cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
        const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
        const a = ang[state.view] || ang.iso;
        root.Podnoze.paint(x, cv.width, cv.height, bodies2d(state.A, state.ctx), { az: a[0], el: a[1], pad: 0.08 });
      };
      new ResizeObserver(draw).observe(host);
      return { mode: '2d', update(A, o) { state.A = A; Object.assign(state, o || {}); draw(); }, view(v) { state.view = v; draw(); }, snapshot() { return cv; } };
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 20, 200000); camera.up.set(0, 0, 1);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', () => render());
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun); scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(3000, 2500, 1200); scene.add(fill);
    let group = null;
    const render = () => renderer.render(scene, camera);
    function resize() {
      const r = host.getBoundingClientRect();
      renderer.setSize(Math.max(10, r.width), Math.max(10, r.height), false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = Math.max(10, r.width) / Math.max(10, r.height); camera.updateProjectionMatrix(); render();
    }
    new ResizeObserver(resize).observe(host);

    function fit(v) {
      const A = state.A; if (!A) return;
      const b = bounds(A, false), c = b.mn.map((x, i) => (x + b.mx[i]) / 2);
      const R = Math.max(b.mx[0] - b.mn[0], b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]) * 0.55 + 200;
      const dir = new THREE.Vector3().fromArray(DIRS[v] || DIRS.iso).normalize();
      const dist = R / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.aspect < 1 ? 1.25 / camera.aspect : 1.0);
      controls.target.set(c[0], c[1], c[2]);
      camera.position.copy(controls.target).addScaledVector(dir, dist);
      controls.update(); render();
    }

    function build() {
      const A = state.A;
      if (group) { scene.remove(group); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
      group = new THREE.Group();
      const st = STEEL[A.cfg.fin] || STEEL.zn;
      const mats = {
        steel: new THREE.MeshStandardMaterial({ color: st[0], metalness: st[1], roughness: st[2] }),
        anchor: new THREE.MeshStandardMaterial({ color: new THREE.Color(st[0]).multiplyScalar(0.62), metalness: st[1], roughness: 0.52,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        wood: new THREE.MeshStandardMaterial({ color: '#B98252', metalness: 0, roughness: 0.7 }),
        hw: new THREE.MeshStandardMaterial({ color: '#8E9196', metalness: 0.8, roughness: 0.3 }),
        pad: new THREE.MeshStandardMaterial({ color: '#7A6A55', metalness: 0, roughness: 0.9 })
      };
      const by = { steel: [], anchor: [], wood: [], hw: [], pad: [] };
      A.lay.members.forEach((m) => by[m.kind === 'plate' && m.role === 'patka' ? 'anchor' : m.kind === 'wood' ? 'wood' : m.kind === 'rod' ? 'hw' : m.kind === 'pad' ? 'pad' : 'steel'].push(m.solid));
      Object.keys(by).forEach((k) => { if (!by[k].length) return; const mesh = new THREE.Mesh(geo(by[k]), mats[k]); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); });
      const edgeMat = new THREE.LineBasicMaterial({ color: '#343b40', transparent: true, opacity: 0.9, depthTest: false });
      A.lay.members.filter((m) => m.kind === 'plate' && m.role === 'patka').forEach((m) => {
        const pos = [], f = m.solid.faces.find((x) => V.dot(x.n, m.ez) > 0.99);
        if (!f) return;
        [f.outer].concat(f.inner).forEach((loop) => loop.forEach((id, i) => pos.push(...m.solid.verts[id], ...m.solid.verts[loop[(i + 1) % loop.length]])));
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const lines = new THREE.LineSegments(g, edgeMat); lines.renderOrder = 5; group.add(lines);
      });
      const b = bounds(A, state.ctx);
      if (state.ctx) A.build.context.forEach((c) => {
        const mt = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.95, metalness: 0, transparent: c.alpha < 1, opacity: c.alpha, depthWrite: c.alpha >= 1, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo([c.solid]), mt); mesh.receiveShadow = true; group.add(mesh);
      });
      const gz = b.mn[2] - 1;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.ShadowMaterial({ opacity: 0.14 }));
      ground.position.z = gz; ground.receiveShadow = true; group.add(ground);
      const c = b.mn.map((x, i) => (x + b.mx[i]) / 2), span = Math.max(b.mx[0] - b.mn[0], b.mx[1] - b.mn[1]) * 0.8 + 1500;
      sun.position.set(c[0] - span, c[1] - span * 1.4, c[2] + span * 2); sun.target.position.set(c[0], c[1], c[2]);
      Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 10, far: span * 6 }); sun.shadow.camera.updateProjectionMatrix();
      scene.add(group);
    }

    return {
      mode: '3d',
      update(A, o) {
        const first = !state.A;
        Object.assign(state, o || {}); state.A = A;
        build();
        const b = bounds(A, false), key = b.mn.concat(b.mx).map((x) => Math.round(x / 50)).join();
        if (first || key !== state.key) fit(state.view); else render();
        state.key = key;
      },
      view(v) { state.view = v; fit(v); },
      snapshot() { render(); return renderer.domElement; }
    };
  }

  function bodies2d(A, ctx) {
    const col = (STEEL[A.cfg.fin] || STEEL.zn)[0];
    const out = A.lay.members.map((m) => ({ verts: m.solid.verts, faces: m.solid.faces, color: m.kind === 'wood' ? '#B98252' : m.kind === 'rod' ? '#8E9196' : m.kind === 'pad' ? '#7A6A55' : col }));
    if (ctx) A.build.context.forEach((c) => out.push({ verts: c.solid.verts, faces: c.solid.faces, color: c.color, alpha: c.alpha < 1 ? c.alpha : 0 }));
    return out;
  }

  root.ZabViewer = { create, bodies2d };
})(window);
