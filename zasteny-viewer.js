/* Three.js illustrative screen preview. Custom sizes are not production models. */
(function (root) {
  'use strict';
  function create(host) {
    if (!root.THREE || !host) throw new Error('Three.js a host kontejner jsou povinné.');
    const THREE = root.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth || 640, host.clientHeight || 520);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.replaceChildren(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f2f4f5');
    const camera = new THREE.PerspectiveCamera(34, (host.clientWidth || 640) / (host.clientHeight || 520), 1, 20000);
    const Controls = THREE.OrbitControls;
    const controls = Controls ? new Controls(camera, renderer.domElement) : null;
    if (controls) { controls.enableDamping = true; controls.dampingFactor = 0.08; }
    scene.add(new THREE.HemisphereLight(0xffffff, 0x68727a, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-1000, 1800, 2400); key.castShadow = true; scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const product = new THREE.Group(); scene.add(product);
    const colors = { black: 0x242629, anth: 0x41474e, white: 0xe4e4df, raw: 0x827d74 };
    let current = { width: 800, height: 2000, finish: 'black' }, animation = 0;
    function dispose(obj) {
      obj.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) => m.dispose());
      });
    }
    function bar(w, h, d, x, y, z, material) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; product.add(mesh);
    }
    function draw(config) {
      current = root.Zasteny.normalize(config);
      while (product.children.length) { const child = product.children.pop(); dispose(child); }
      const L = root.Zasteny.layout(current), W = L.outer.width, H = L.outer.height;
      const metal = new THREE.MeshStandardMaterial({ color: colors[current.finish], metalness: 0.68, roughness: 0.34 });
      const plate = new THREE.MeshStandardMaterial({ color: colors[current.finish], metalness: 0.45, roughness: 0.5, side: THREE.DoubleSide });
      const depth = 40, t = 2;
      // Hollow 40 × 40 mm frame, with the sheet inset into its front face.
      bar(W, depth, depth, W / 2, H - depth / 2, 0, metal);
      bar(W, depth, depth, W / 2, depth / 2, 0, metal);
      bar(depth, Math.max(1, H - 2 * depth), depth, depth / 2, H / 2, 0, metal);
      bar(depth, Math.max(1, H - 2 * depth), depth, W - depth / 2, H / 2, 0, metal);
      const art = root.ZastenyArtwork || {}, contourData = art.contours || [];
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(L.panel.width, 0); shape.lineTo(L.panel.width, L.panel.height); shape.lineTo(0, L.panel.height); shape.closePath();
      contourData.forEach((contour) => {
        if (!contour.pts || contour.pts.length < 3) return;
        const path = new THREE.Path();
        contour.pts.forEach((pt, i) => {
          const px = (pt[0] - Number(art.sheet_mm[0]) / 2) * L.motif.scale + L.panel.width / 2;
          const py = pt[1] * L.motif.scale + (L.panel.height - L.motif.height) / 2;
          if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
        });
        path.closePath(); shape.holes.push(path);
      });
      const panelMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1), plate);
      panelMesh.position.set(L.panel.x, L.panel.z, -depth / 2 - t / 2);
      panelMesh.scale.set(1, 1, 1); panelMesh.castShadow = true; product.add(panelMesh);
      // Two floor plates as shown in the fixed 800 × 2000 reference model.
      for (const x of [W * 0.18, W * 0.82]) {
        bar(Math.min(100, W * 0.22), 6, 220, x, 3, 0, metal);
      }
      camera.position.set(W * 1.1, H * 0.63, Math.max(W, H) * 1.28);
      camera.near = 1; camera.far = Math.max(20000, H * 10); camera.updateProjectionMatrix();
      if (controls) { controls.target.set(W / 2, H / 2, 0); controls.update(); }
      else camera.lookAt(W / 2, H / 2, 0);
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
    return {
      update: draw,
      view(name) {
        const W = current.width, H = current.height;
        if (name === 'front') camera.position.set(W / 2, H / 2, Math.max(W, H) * 1.8);
        else if (name === 'side') camera.position.set(W * 2.5, H / 2, 0);
        else camera.position.set(W * 1.1, H * 0.63, Math.max(W, H) * 1.28);
        if (controls) { controls.target.set(W / 2, H / 2, 0); controls.update(); } else camera.lookAt(W / 2, H / 2, 0);
      },
      destroy() { root.cancelAnimationFrame(animation); if (observer) observer.disconnect(); dispose(product); renderer.dispose(); host.replaceChildren(); }
    };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZastenyViewer = api;
})(typeof window !== 'undefined' ? window : globalThis);
