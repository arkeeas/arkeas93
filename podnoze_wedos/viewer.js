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

  function clipPolygon(outline, axis, bound, keepGreater) {
    const inside = (p) => keepGreater ? p[axis] >= bound : p[axis] <= bound;
    const out = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length], ai = inside(a), bi = inside(b);
      if (ai) out.push(a);
      if (ai !== bi) {
        const t = (bound - a[axis]) / (b[axis] - a[axis]);
        const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        p[axis] = bound; out.push(p);
      }
    }
    return out;
  }

  function polygonShape(points) {
    const shape = new THREE.Shape();
    points.forEach((p, i) => i ? shape.lineTo(p[0] / 1000, p[1] / 1000) : shape.moveTo(p[0] / 1000, p[1] / 1000));
    shape.closePath();
    return shape;
  }

  function extrudedBoard(points, thickness) {
    if (points.length < 3) return null;
    const geo = new THREE.ExtrudeGeometry(polygonShape(points), { depth: thickness / 1000, bevelEnabled: false, curveSegments: 4 });
    geo.scale(1000, 1000, 1000);
    return geo;
  }

  function seeded(seed) {
    let x = seed >>> 0;
    return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 4294967296; };
  }

  function woodTexture(kind, renderer) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d'), oak = kind === 'oak';
    const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
    (oak ? [['#9A6338', 0], ['#C08A55', 0.48], ['#875632', 1]] : [['#D0B184', 0], ['#E6D3AA', 0.5], ['#B99769', 1]])
      .forEach(([color, stop]) => base.addColorStop(stop, color));
    ctx.fillStyle = base; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rand = seeded(oak ? 2718 : 1618);
    for (let i = 0; i < 150; i++) {
      const y = rand() * canvas.height, amp = 1 + rand() * 8, phase = rand() * 8, freq = 0.004 + rand() * 0.018;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 12) {
        const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 0.31 + phase) * amp * 0.7;
        if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      const dark = rand() > 0.48;
      ctx.strokeStyle = dark ? `rgba(72,42,22,${0.035 + rand() * 0.11})` : `rgba(255,231,184,${0.04 + rand() * 0.13})`;
      ctx.lineWidth = 0.5 + rand() * (oak ? 3.5 : 2.2); ctx.stroke();
    }
    // Dlouhé jemné póry a několik oválných letokruhů dodají desce kresbu i při oddáleném pohledu.
    for (let k = 0; k < 9; k++) {
      const x = rand() * canvas.width, y = rand() * canvas.height, rx = 18 + rand() * 48, ry = 5 + rand() * 13;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.beginPath(); ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(71,42,22,0.15)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    }
    const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function epoxyTexture(renderer) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1024, 512);
    g.addColorStop(0, '#063246'); g.addColorStop(0.28, '#0D7180'); g.addColorStop(0.57, '#075064'); g.addColorStop(0.82, '#168C91'); g.addColorStop(1, '#082E48');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
    const rand = seeded(9071);
    // Měkké barevné proudy se skládají do nepravidelných tůní a vírů, ne do jednolitého pruhu.
    for (let i = 0; i < 90; i++) {
      const x = rand() * 1024, y = rand() * 512, r = 18 + rand() * 115;
      const glow = ctx.createRadialGradient(x, y, 1, x, y, r);
      const palette = rand() > 0.56 ? [100, 229, 211] : rand() > 0.48 ? [3, 31, 53] : [35, 167, 179];
      glow.addColorStop(0, `rgba(${palette[0]},${palette[1]},${palette[2]},${0.06 + rand() * 0.16})`);
      glow.addColorStop(1, 'rgba(4,34,50,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Dlouhé rozvětvené pigmentové žíly sledují tok pryskyřice; některé jsou tmavé, jiné perleťové.
    for (let i = 0; i < 32; i++) {
      const y = rand() * 512, amp = 8 + rand() * 75, phase = rand() * 6.28, freq = 0.003 + rand() * 0.0003;
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 16) {
        const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * 0.011 + phase * 1.7) * amp * 0.18;
        if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      const pale = rand() > 0.7;
      ctx.strokeStyle = pale ? `rgba(175,246,234,${0.08 + rand() * 0.18})` : `rgba(2,42,66,${0.1 + rand() * 0.2})`;
      ctx.lineWidth = 2 + rand() * (pale ? 10 : 22); ctx.lineCap = 'round';
      ctx.filter = 'blur(4px)'; ctx.stroke(); ctx.filter = 'none';
    }
    // Jemné lesklé linky a drobné pigmentové body dodají hloubku při přiblížení.
    for (let i = 0; i < 24; i++) {
      const y = rand() * 512, phase = rand() * 6.28, amp = 6 + rand() * 12;
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 12) {
        const yy = y + Math.sin(x * 0.009 + phase) * amp + Math.sin(x * 0.021 + phase) * 3;
        if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = `rgba(188,250,239,${0.06 + rand() * 0.14})`; ctx.lineWidth = 0.6 + rand() * 2.6; ctx.stroke();
    }
    for (let i = 0; i < 1300; i++) {
      const x = rand() * 1024, y = rand() * 512, r = 0.4 + rand() * 1.8;
      ctx.fillStyle = rand() > 0.7 ? `rgba(190,247,236,${0.035 + rand() * 0.12})` : `rgba(2,26,41,${0.05 + rand() * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
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
        if (state.showDesk) {
          const outline = K.deskOutline(A.cfg.shape, A.DL, A.DW), alpha = A.build.glassTop || state.see ? 0.3 : 1;
          if (!A.build.glassTop && state.boardMaterial === 'epoxy') {
            const half = Math.min(90, Math.max(45, A.DW * 0.085));
            [clipPolygon(outline, 1, -half, false), clipPolygon(outline, 1, half, true)].filter((p) => p.length >= 3)
              .forEach((p) => bodies.push(Object.assign(deskSolid(p, A.build.dims.Hf, A.cfg.H), { color: '#A97749', alpha })));
            const river = clipPolygon(clipPolygon(outline, 1, -half, true), 1, half, false);
            if (river.length >= 3) bodies.push(Object.assign(deskSolid(river, A.build.dims.Hf, A.cfg.H), { color: '#0D7180', alpha }));
          } else bodies.push(Object.assign(deskSolid(outline, A.build.dims.Hf, A.cfg.H), {
            color: A.build.glassTop ? '#CFE8EE' : state.boardMaterial === 'ash' ? '#D5BD91' : '#A97749', alpha
          }));
        }
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
    const boardTextures = { oak: null, ash: null, epoxy: null };

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
        const glass = !!A.build.glassTop;   // čiré sklo (Infinity Cube)
        const translucent = state.see && !glass, alpha = translucent ? 0.34 : 1;
        const addBoardPiece = (points, material) => {
          const geo = extrudedBoard(points, A.cfg.td); if (!geo) return;
          const mesh = new THREE.Mesh(geo, material);
          mesh.position.z = A.build.dims.Hf; mesh.castShadow = !state.see; mesh.receiveShadow = true; group.add(mesh);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({
            color: glass ? '#7FA9B3' : state.boardMaterial === 'epoxy' ? '#61442E' : '#7A5634',
            transparent: true, opacity: glass ? 0.9 : state.see ? 0.7 : 0.22
          }));
          edges.position.z = A.build.dims.Hf; group.add(edges);
        };
        if (glass) {
          const mat = new THREE.MeshPhysicalMaterial({ color: '#CFE8EE', roughness: 0.06, metalness: 0.08, transparent: true, opacity: 0.28, depthWrite: false, clearcoat: 1 });
          addBoardPiece(outline, mat);
        } else if (state.boardMaterial === 'epoxy') {
          const half = Math.min(90, Math.max(45, A.DW * 0.085));
          const left = clipPolygon(outline, 1, -half, false), right = clipPolygon(outline, 1, half, true);
          const river = clipPolygon(clipPolygon(outline, 1, -half, true), 1, half, false);
          const woodMap = boardTextures.oak || (boardTextures.oak = woodTexture('oak', renderer));
          const resinMap = boardTextures.epoxy || (boardTextures.epoxy = epoxyTexture(renderer));
          woodMap.repeat.set(1000 / A.DL, 1000 / A.DW); woodMap.offset.set(0.5, 0.5);
          resinMap.repeat.set(1000 / A.DL, 1000 / (2 * half)); resinMap.offset.set(0.5, 0.5);
          const wood = new THREE.MeshPhysicalMaterial({ map: woodMap, roughness: 0.48, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.28, transparent: translucent, opacity: alpha, depthWrite: !translucent });
          const resin = new THREE.MeshPhysicalMaterial({ map: resinMap, color: '#FFFFFF', roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.09, transparent: translucent, opacity: alpha, depthWrite: !translucent });
          addBoardPiece(left, wood); addBoardPiece(right, wood); addBoardPiece(river, resin);
        } else {
          const woodMap = boardTextures[state.boardMaterial] || (boardTextures[state.boardMaterial] = woodTexture(state.boardMaterial, renderer));
          const material = new THREE.MeshPhysicalMaterial({ map: woodMap, roughness: state.boardMaterial === 'ash' ? 0.57 : 0.51, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.32, transparent: translucent, opacity: alpha, depthWrite: !translucent });
          addBoardPiece(outline, material);
        }
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
