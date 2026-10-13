/* Three.js náhled ptačího věšáku: plech 4 mm + ohnutý háček, zeď vzadu (z = 0). Ilustrační model. */
(function (root) {
  'use strict';
  // Profil háčku v rovině (hloubka od zdi u, výška v) – stejná geometrie jako ptaci_fc.py (dva ohyby 90°, vnitřní R = ri).
  function hookProfile(P, tongue, z0, n) {
    const steps = n || 10, t = P.t, ri = P.ri, ro = ri + t, s2 = tongue.s[1], s3 = tongue.s[2];
    const cy = t + ri, y2 = cy + s2, pts = [];
    const arc = (cx, cz, r, a0, a1) => { for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
    arc(cy, z0, ro, Math.PI, 1.5 * Math.PI);          // vnější oblouk 1
    arc(y2, z0, ro, 1.5 * Math.PI, 2 * Math.PI);      // vnější oblouk 2
    pts.push([y2 + ro, z0 + s3], [y2 + ri, z0 + s3]); // zarážka
    arc(y2, z0, ri, 2 * Math.PI, 1.5 * Math.PI);      // vnitřní oblouk 2
    arc(cy, z0, ri, 1.5 * Math.PI, Math.PI);          // vnitřní oblouk 1
    pts.push([t, z0 + 0.5], [0, z0 + 0.5]);           // 0,5 mm přesah do rovné části
    return pts;
  }
  function geometryInfo(art, poseKey) {
    const P = art.params, TG = art.tongue, b = art.birds[poseKey], [ax, ay] = b.anchor;
    const z0 = ay - TG.s[0], w = P.tongue_w;
    const xs = [], ys = [];
    b.parts.forEach((p) => p.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
    ys.push(z0 - (P.ri + P.t));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { P, TG, b, ax, ay, z0, w, center: [(minX + maxX) / 2, (minY + maxY) / 2], size: Math.max(maxX - minX, maxY - minY) };
  }
  function create(host) {
    if (!root.THREE || !host) throw new Error('Three.js a host kontejner jsou povinné.');
    const THREE = root.THREE, art = root.PtaciArtwork;
    if (!art) throw new Error('Chybí obrysy ptáků (assets/ptaci/artwork.js).');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth || 640, host.clientHeight || 520);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.replaceChildren(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f2f4f5');
    const camera = new THREE.PerspectiveCamera(34, (host.clientWidth || 640) / (host.clientHeight || 520), 1, 5000);
    const Controls = THREE.OrbitControls;
    const controls = Controls ? new Controls(camera, renderer.domElement) : null;
    if (controls) { controls.enableDamping = true; controls.dampingFactor = 0.08; }
    scene.add(new THREE.HemisphereLight(0xffffff, 0x68727a, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-200, 300, 500); key.castShadow = true;
    key.shadow.camera.left = -250; key.shadow.camera.right = 250; key.shadow.camera.top = 250; key.shadow.camera.bottom = -250; key.shadow.camera.far = 1500;
    scene.add(key); scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const product = new THREE.Group(); scene.add(product);
    const colors = { black: 0x242629, anth: 0x41474e, white: 0xe4e4df, raw: 0x827d74 };
    let current = { pose: 'vzlet', finish: 'black' }, info = null, animation = 0;
    function dispose(obj) {
      obj.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) => m.dispose());
      });
    }
    const toShape = (poly) => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    function draw(config) {
      current = root.Ptaci ? root.Ptaci.normalize(config) : config;
      while (product.children.length) { const child = product.children.pop(); dispose(child); }
      info = geometryInfo(art, current.pose);
      const { P, TG, b, ax, ay, z0, w } = info, t = P.t;
      const metal = new THREE.MeshStandardMaterial({ color: colors[current.finish], metalness: 0.6, roughness: 0.38, side: THREE.DoubleSide });
      const add = (geo) => { const m = new THREE.Mesh(geo, metal); m.castShadow = true; m.receiveShadow = true; product.add(m); return m; };
      const ext = { depth: t, bevelEnabled: false, curveSegments: 1 };
      // Plech: tělo, hlava, zobák, ocas, křídla (ve stejné rovině) + rovná část jazýčku se dvěma děrami na vruty.
      b.parts.forEach((poly) => add(new THREE.ExtrudeGeometry(toShape(poly), ext)));
      const x0 = ax - w / 2, x1 = ax + w / 2, top = ay + 6;
      const tongue = toShape([[x0, top], [x0, z0], [x1, z0], [x1, top]]);
      [ay - 16, z0 + 14].forEach((y) => { const h = new THREE.Path(); h.absarc(ax, y, P.hole / 2, 0, Math.PI * 2, true); tongue.holes.push(h); });
      add(new THREE.ExtrudeGeometry(tongue, Object.assign({}, ext, { curveSegments: 16 })));
      // Ohnutý háček: profil (hloubka, výška) vytažený o šířku jazýčku, otočený tak, aby hloubka mířila k divákovi (+z).
      const hook = new THREE.ExtrudeGeometry(toShape(hookProfile(P, TG, z0)), { depth: w, bevelEnabled: false, curveSegments: 1 });
      hook.rotateY(-Math.PI / 2); hook.translate(x1, 0, 0);
      add(hook);
      // Zeď, na kterou věšák přichází.
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.95, metalness: 0 }));
      wall.position.set(info.center[0], info.center[1], -0.5); wall.receiveShadow = true; product.add(wall);
      view('iso');
    }
    function view(name) {
      if (!info) return;
      const [cx, cy] = info.center, d = info.size * 2.6;
      if (name === 'front') camera.position.set(cx, cy, d);
      else if (name === 'side') camera.position.set(d, cy, 20);
      else camera.position.set(cx + d * 0.45, cy + d * 0.22, d * 0.8);
      if (controls) { controls.target.set(cx, cy, 20); controls.update(); } else camera.lookAt(cx, cy, 20);
    }
    function resize() {
      const w = host.clientWidth || 640, h = host.clientHeight || 520;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(host);
    function frame() {
      animation = root.requestAnimationFrame(frame);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    draw(current); frame();
    return { update: draw, view, resize, destroy() { root.cancelAnimationFrame(animation); if (observer) observer.disconnect(); dispose(product); renderer.dispose(); host.replaceChildren(); } };
  }
  const api = { create, hookProfile, geometryInfo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PtaciViewer = api;
})(typeof window !== 'undefined' ? window : globalThis);
