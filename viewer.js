/* 3D náhled podnože (three.js). Bez WebGL nebo bez knihovny kreslí 2D náhled přes Podnoze.paint. */
(function (root) {
  'use strict';
  const K = root.Podnoze;
  const METAL = { black: ['#26272A', 0.35, 0.55], anth: ['#3E444B', 0.4, 0.5], white: ['#E9E9E4', 0.1, 0.6], raw: ['#8A847B', 0.75, 0.38] };
  const VIEWS = { iso: [-0.62, -1, 0.55], front: [0, -1, 0.12], side: [1, 0, 0.12], top: [0, -0.0001, 1], bottom: [-0.55, -1, -0.62] };

  function deskSolid(outline, z0, z1) {
    const n = outline.length, verts = [];
    outline.forEach((p) => verts.push([p[0], p[1], z0]));
    outline.forEach((p) => verts.push([p[0], p[1], z1]));
    const faces = [{ outer: outline.map((_, i) => i), inner: [], n: [0, 0, -1] }, { outer: outline.map((_, i) => n + i), inner: [], n: [0, 0, 1] }];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = outline[i], b = outline[j];
      faces.push({ outer: [i, j, n + j, n + i], inner: [], n: K.V.unit([b[1] - a[1], -(b[0] - a[0]), 0]) });
    }
    return { verts, faces };
  }

  function ashTexture(THREE, renderer) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d'), base = ctx.createLinearGradient(0, 0, 0, canvas.height);
    base.addColorStop(0, '#BFA77D'); base.addColorStop(0.24, '#E1D0AA'); base.addColorStop(0.58, '#CFB98D'); base.addColorStop(1, '#B59B6E');
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
      ctx.lineWidth = 0.6 + rand() * 3.2; ctx.stroke();
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

  /* obecné plochy (nekonvexní, s otvory) -> trojúhelníky přes ShapeUtils v rovině plochy */
  function triangles(solid) {
    const pos = [], P = solid.verts;
    solid.faces.forEach((f0) => {
      const f = K.orientFace(P, f0), n = K.V.unit(f.n);
      const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = K.V.unit(K.V.cross(n, ax)), e2 = K.V.cross(n, e1);
      const to2 = (i) => new THREE.Vector2(K.V.dot(P[i], e1), K.V.dot(P[i], e2));
      const contour = f.outer.map(to2), holes = f.inner.map((lp) => lp.map(to2));
      const idx = f.outer.concat(...f.inner);
      const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
      tris.forEach((tr) => {
        let [a, b, c] = tr.map((k) => P[idx[k]]);
        if (K.V.dot(K.V.cross(K.V.sub(b, a), K.V.sub(c, a)), n) < 0) { const tmp = b; b = c; c = tmp; }
        pos.push(...a, ...b, ...c);
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  function create(host, opts) {
    opts = opts || {};
    const state = { view: 'iso', A: null, showDesk: true, see: false, fitted: false, person: null };
    const fig = () => (state.person && root.Postava && state.A) ? root.Postava.build(state.A, state.person) : null;
    let three = null;
    try {
      if (root.THREE && root.THREE.OrbitControls) {
        const c = document.createElement('canvas');
        if (c.getContext('webgl2') || c.getContext('webgl')) three = true;
      }
    } catch (e) { three = null; }

    if (!three) {
      const cv = document.createElement('canvas');
      cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
      host.appendChild(cv);
      const angles = { iso: [-35, 22], front: [0, 12], side: [90, 12], top: [0, 89], bottom: [-35, -30] };
      const draw = () => {
        if (!state.A) return;
        const r = host.getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
        cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
        const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
        const A = state.A, bodies = K.previewBodies(A);
        if (state.showDesk) bodies.push(Object.assign(deskSolid(K.deskOutline(A.cfg.shape, A.DL, A.DW), A.build.dims.Hf, A.cfg.H), { color: A.build.glassTop ? '#CFE8EE' : '#D5BD91', alpha: A.build.glassTop ? 0.3 : state.see ? 0.3 : 1 }));
        const F = fig(); if (F) F.bodies.forEach((b) => bodies.push(b));
        const a = angles[state.view] || angles.iso;
        K.paint(x, cv.width, cv.height, bodies, { az: a[0], el: a[1], pad: 0.1 });
      };
      new ResizeObserver(draw).observe(host);
      return {
        mode: '2d',
        update(A, o) { state.A = A; Object.assign(state, o || {}); draw(); },
        view(v) { state.view = v; draw(); },
        snapshot() { return cv; }
      };
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    const deskTexture = ashTexture(THREE, renderer);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 10, 50000);
    camera.up.set(0, 0, 1);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.addEventListener('change', () => render());
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(-1500, -2200, 3200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -2000, right: 2000, top: 2000, bottom: -2000, near: 100, far: 9000 });
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(2000, 1500, 800); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.ShadowMaterial({ opacity: 0.16 }));
    ground.receiveShadow = true; scene.add(ground);
    let group = null;

    function render() { renderer.render(scene, camera); }
    function resize() {
      const r = host.getBoundingClientRect();
      renderer.setSize(Math.max(10, r.width), Math.max(10, r.height), false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = Math.max(10, r.width) / Math.max(10, r.height); camera.updateProjectionMatrix(); render();
    }
    new ResizeObserver(resize).observe(host);

    function fit(dirName) {
      const A = state.A; if (!A) return;
      const d = A.build.dims, F = fig();
      let R = Math.max(A.DL, A.DW, d.Lf, d.Wf, A.cfg.H) * 0.62 + 120, ty = 0, tz = A.cfg.H * 0.45;
      if (F) {
        const y0 = F.info.yMin, y1 = A.DW / 2, zm = Math.max(A.cfg.H, F.info.zMax);
        ty = (y0 + y1) / 2; tz = zm * 0.47;
        R = Math.max(R, Math.max(A.DL, y1 - y0, zm) * 0.62 + 120);
      }
      const dir = new THREE.Vector3().fromArray(VIEWS[dirName] || VIEWS.iso).normalize();
      const dist = R / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.aspect < 1 ? 1.35 / camera.aspect : 1.05);
      controls.target.set(0, ty, tz);
      camera.position.copy(controls.target).addScaledVector(dir, dist);
      controls.update(); render();
    }

    function build() {
      const A = state.A;
      if (group) { scene.remove(group); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
      group = new THREE.Group();
      const m = METAL[A.cfg.fin] || METAL.black;
      const steel = new THREE.MeshStandardMaterial({ color: m[0], metalness: m[1], roughness: m[2] });
      A.build.parts.forEach((mb) => { const mesh = new THREE.Mesh(triangles(mb.solid), steel); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); });
      const plateMat = new THREE.MeshStandardMaterial({ color: m[0], metalness: m[1], roughness: m[2] });
      A.build.plateBoxes.forEach((b) => { const mesh = new THREE.Mesh(triangles(b), plateMat); mesh.castShadow = true; group.add(mesh); });
      if (A.build.hwBodies) {   // nakupované díly (závitové tyče, matice)
        const hm = new THREE.MeshStandardMaterial({ color: '#4A4C50', metalness: 0.7, roughness: 0.45 });
        A.build.hwBodies.forEach((b) => { const mesh = new THREE.Mesh(triangles(b), hm); mesh.castShadow = true; group.add(mesh); });
      }
      if (A.build.boltPts.length) {
        const bm = new THREE.MeshStandardMaterial({ color: '#C9C4BA', metalness: 0.8, roughness: 0.3 });
        A.build.boltPts.forEach((p) => { const s = new THREE.Mesh(new THREE.SphereGeometry(Math.max(6, A.cfg.size * 0.22), 16, 12), bm); s.position.set(p[0], p[1], p[2]); group.add(s); });
      }
      const F = fig();
      if (F) {
        const mats = {};
        F.bodies.forEach((b) => {
          const mt = mats[b.color] || (mats[b.color] = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85, metalness: 0.05 }));
          const mesh = new THREE.Mesh(triangles(b), mt); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
        });
      }
      if (state.showDesk) {
        const outline = K.deskOutline(A.cfg.shape, A.DL, A.DW);
        const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p[0], p[1])));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: A.cfg.td, bevelEnabled: false, curveSegments: 4 });
        if (!A.build.glassTop) mapDeskUv(THREE, geo);
        const glass = !!A.build.glassTop;   // čiré sklo (Infinity Cube)
        const wood = glass ? new THREE.MeshStandardMaterial({ color: '#CFE8EE', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false })
          : new THREE.MeshStandardMaterial({ map: deskTexture, color: '#FFFFFF', roughness: 0.66, metalness: 0, transparent: state.see, opacity: state.see ? 0.32 : 1, depthWrite: !state.see });
        const desk = new THREE.Mesh(geo, wood);
        desk.position.z = A.build.dims.Hf; desk.castShadow = !state.see; desk.receiveShadow = true;
        group.add(desk);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: glass ? '#7FA9B3' : '#816B48', transparent: true, opacity: glass ? 0.9 : state.see ? 0.9 : 0.35 }));
        edges.position.z = A.build.dims.Hf; group.add(edges);
      }
      scene.add(group);
    }

    return {
      mode: '3d',
      update(A, o) {
        const first = !state.A;
        const key = () => [state.A.DL, state.A.DW, state.A.cfg.H, JSON.stringify(state.person)].join();
        const prevSize = state.A ? key() : '';
        state.A = A; Object.assign(state, o || {});
        build();
        if (first || prevSize !== key()) fit(state.view); else render();
      },
      view(v) { state.view = v; fit(v); },
      snapshot() { render(); return renderer.domElement; }
    };
  }

  root.Viewer3D = { create };
})(window);
