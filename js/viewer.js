/*
 * viewer.js – malý 3D prohlížeč (čisté WebGL, bez knihoven).
 * Otáčení: levé tlačítko / 1 prst · Posun: pravé tlačítko, Shift+levé / 2 prsty · Zoom: kolečko / sevření
 */
(function (root) {
  "use strict";

  // ---------- matice (sloupcové, jako WebGL) ----------
  const M4 = {
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
      }
      return o;
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f); return o;
    },
    lookAt(e, c, up) {
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const nrm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
      const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const z = nrm(sub(e, c)), x = nrm(cr(up, z)), y = cr(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dt(x, e), -dt(y, e), -dt(z, e), 1]);
    },
    xform(m, p) {
      const x = p[0], y = p[1], z = p[2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
    }
  };

  const VS = `
    attribute vec3 aPos; attribute vec3 aNor;
    uniform mat4 uVP; varying vec3 vN; varying vec3 vW;
    void main(){ vN = aNor; vW = aPos; gl_Position = uVP * vec4(aPos,1.0); }`;
  const FS = `
    precision mediump float;
    varying vec3 vN; varying vec3 vW;
    uniform vec3 uColor; uniform float uAlpha; uniform vec3 uEye; uniform float uHi; uniform float uMetal;
    void main(){
      vec3 n = normalize(vN);
      vec3 v = normalize(uEye - vW);
      if (dot(n, v) < 0.0) n = -n;
      vec3 l1 = normalize(vec3(0.45, -0.6, 0.85)), l2 = normalize(vec3(-0.7, 0.5, 0.35));
      float d = max(dot(n,l1),0.0)*0.75 + max(dot(n,l2),0.0)*0.3 + 0.28 + 0.12*n.z;
      vec3 h = normalize(l1 + v);
      float s = pow(max(dot(n,h),0.0), 40.0) * uMetal;
      vec3 c = uColor * d + vec3(s);
      c = mix(c, vec3(1.0,0.55,0.1), uHi*0.55);
      gl_FragColor = vec4(c, uAlpha);
    }`;
  const GVS = `
    attribute vec3 aPos; uniform mat4 uVP; varying vec2 vP;
    void main(){ vP = aPos.xy; gl_Position = uVP * vec4(aPos,1.0); }`;
  const GFS = `
    precision mediump float; varying vec2 vP;
    uniform vec4 uRect; uniform vec3 uCol; uniform float uFade;
    void main(){
      vec2 c = (uRect.xy + uRect.zw) * 0.5, hs = (uRect.zw - uRect.xy) * 0.5;
      vec2 q = abs(vP - c) - hs;
      float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float sh = 1.0 - smoothstep(-80.0, 260.0, dist);
      float edge = 1.0 - smoothstep(uFade*0.35, uFade, length(vP - c));
      float gx = abs(fract(vP.x/250.0 + 0.5) - 0.5) * 250.0, gy = abs(fract(vP.y/250.0 + 0.5) - 0.5) * 250.0;
      float grid = 1.0 - smoothstep(0.0, 3.0, min(gx, gy));
      vec3 col = uCol * (1.0 - 0.28*sh) - grid*0.035;
      gl_FragColor = vec4(col, edge);
    }`;
  const LVS = `attribute vec3 aPos; uniform mat4 uVP; void main(){ gl_Position = uVP * vec4(aPos,1.0); }`;
  const LFS = `precision mediump float; uniform vec4 uCol; void main(){ gl_FragColor = uCol; }`;

  function prog(gl, vs, fs) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, a = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const n = gl.getActiveAttrib(p, i).name; a[n] = gl.getAttribLocation(p, n); }
    return { p, u, a };
  }

  function hexRgb(h) { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

  class Viewer {
    constructor(canvas, overlay) {
      this.canvas = canvas; this.overlay = overlay;
      const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error("WebGL není k dispozici");
      this.gl = gl;
      this.pm = prog(gl, VS, FS); this.pg = prog(gl, GVS, GFS); this.pl = prog(gl, LVS, LFS);
      this.meshes = []; this.lines = null; this.labels = [];
      this.yaw = -0.62; this.pitch = 0.42; this.dist = 3000; this.target = [0, 0, 400]; this.panOff = [0, 0, 0];
      this.bbox = [[0, 0, 0], [1000, 1000, 1000]];
      this.highlight = null;
      this._bind();
      this._resize();
      new ResizeObserver(() => this._resize()).observe(canvas);
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.draw();
    }

    _bind() {
      const c = this.canvas;
      let drag = null, lastTouch = null;
      c.addEventListener("contextmenu", (e) => e.preventDefault());
      c.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") return;
        c.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.button === 1 || e.shiftKey };
      });
      c.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        if (drag.pan) this._pan(dx, dy); else this._orbit(dx, dy);
      });
      c.addEventListener("pointerup", () => { drag = null; });
      c.addEventListener("wheel", (e) => { e.preventDefault(); this.dist *= Math.exp(e.deltaY * 0.0012); this._clampDist(); this.draw(); }, { passive: false });
      c.addEventListener("dblclick", () => this.fit());
      // dotyk
      const tinfo = (ts) => {
        if (ts.length === 1) return { x: ts[0].clientX, y: ts[0].clientY, n: 1 };
        const a = ts[0], b = ts[1];
        return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), n: 2 };
      };
      c.addEventListener("touchstart", (e) => { e.preventDefault(); lastTouch = tinfo(e.touches); }, { passive: false });
      c.addEventListener("touchmove", (e) => {
        e.preventDefault();
        const t = tinfo(e.touches);
        if (lastTouch && t.n === lastTouch.n) {
          if (t.n === 1) this._orbit(t.x - lastTouch.x, t.y - lastTouch.y);
          else { this._pan(t.x - lastTouch.x, t.y - lastTouch.y); if (lastTouch.d > 0) { this.dist *= lastTouch.d / t.d; this._clampDist(); this.draw(); } }
        }
        lastTouch = t;
      }, { passive: false });
      c.addEventListener("touchend", (e) => { lastTouch = e.touches.length ? tinfo(e.touches) : null; });
    }

    _orbit(dx, dy) {
      this.yaw -= dx * 0.008;
      this.pitch = Math.max(-0.1, Math.min(1.45, this.pitch + dy * 0.006));
      this.draw();
    }
    _pan(dx, dy) {
      const s = this.dist * 0.0012;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const right = [cy, -sy, 0]; // kolmo na směr pohledu v půdorysu
      const up = [0, 0, 1];
      for (let i = 0; i < 3; i++) this.panOff[i] += -right[i] * dx * s + up[i] * dy * s;
      this.draw();
    }
    _clampDist() { const r = this._radius(); this.dist = Math.max(r * 0.6, Math.min(r * 12, this.dist)); }
    _radius() { const [a, b] = this.bbox, m = 2 * 170; return Math.hypot(b[0] - a[0] + m, b[1] - a[1] + m, b[2] - a[2]) / 2 || 1000; } // + okraj pro kóty

    fit(keepAngles) {
      const [a, b] = this.bbox;
      this.target = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      this.panOff = [0, 0, 0];
      if (!keepAngles) { this.yaw = -0.62; this.pitch = 0.42; }
      const asp = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
      this.dist = this._radius() * (asp < 1 ? 3.6 / Math.max(asp, 0.55) : 3.0);
      this.draw();
    }

    /* parts: [{id, color:'#hex', alpha, mesh:{pos,nor}, marks:{pos,nor}}], dims: {L,W,H,...} */
    setScene(parts, bbox, dims) {
      const gl = this.gl;
      for (const m of this.meshes) { gl.deleteBuffer(m.pb); gl.deleteBuffer(m.nb); }
      this.meshes = [];
      const mk = (id, mesh, color, alpha, metal) => {
        if (!mesh || !mesh.pos.length) return;
        const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.pos), gl.STATIC_DRAW);
        const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.nor), gl.STATIC_DRAW);
        this.meshes.push({ id, pb, nb, n: mesh.pos.length / 3, color: hexRgb(color), alpha, metal });
      };
      for (const p of parts) {
        mk(p.id, p.mesh, p.color, p.alpha == null ? 1 : p.alpha, p.metal == null ? 0.35 : p.metal);
        if (p.marks) mk(p.id + ":marks", p.marks, "#15171a", 1, 0);
      }
      const first = !this.hasScene;
      this.bbox = bbox; this.dims = dims; this.hasScene = true;
      this._buildDims();
      if (first) this.fit(); else { const [a, b] = bbox; this.target = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; this.draw(); }
    }

    setHighlight(id) { this.highlight = id; this.draw(); }

    _buildDims() {
      const d = this.dims; this.labels = [];
      if (!d) { this.lines = null; return; }
      const off = 90, pts = [];
      const seg = (a, b) => pts.push(...a, ...b);
      const tick = 22;
      // délka – podél přední spodní hrany (y = -off)
      seg([0, -off, 0], [d.L, -off, 0]); seg([0, -off + tick, 0], [0, -off - tick, 0]); seg([d.L, -off + tick, 0], [d.L, -off - tick, 0]);
      this.labels.push({ p: [d.L / 2, -off - 40, 0], t: Math.round(d.L) + "" });
      // šířka – podél pravé spodní hrany
      seg([d.L + off, 0, 0], [d.L + off, d.W, 0]); seg([d.L + off - tick, 0, 0], [d.L + off + tick, 0, 0]); seg([d.L + off - tick, d.W, 0], [d.L + off + tick, d.W, 0]);
      this.labels.push({ p: [d.L + off + 40, d.W / 2, 0], t: Math.round(d.W) + "" });
      // výška – svisle u levé přední nohy
      seg([-off, -off, 0], [-off, -off, d.H]); seg([-off - tick, -off, 0], [-off + tick, -off, 0]); seg([-off - tick, -off, d.H], [-off + tick, -off, d.H]);
      this.labels.push({ p: [-off - 30, -off - 30, d.H / 2], t: Math.round(d.H) + "" });
      const gl = this.gl;
      if (!this.lines) this.lines = { b: gl.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lines.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
      this.lines.n = pts.length / 3;
    }

    draw() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._draw(); });
    }

    _draw() {
      const gl = this.gl, W = this.canvas.width, H = this.canvas.height;
      if (!W || !H) return;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const t = [this.target[0] + this.panOff[0], this.target[1] + this.panOff[1], this.target[2] + this.panOff[2]];
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const eye = [t[0] + this.dist * cp * Math.sin(this.yaw) * -1, t[1] - this.dist * cp * Math.cos(this.yaw), t[2] + this.dist * sp];
      const r = this._radius();
      const P = M4.persp((32 * Math.PI) / 180, W / H, Math.max(10, this.dist - r * 6), this.dist + r * 8);
      const VP = M4.mul(P, M4.lookAt(eye, t, [0, 0, 1]));
      this._vp = VP;

      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // podlaha se stínem
      const [a, b] = this.bbox;
      const g = this.pg, S = r * 8;
      if (!this._ground) { this._ground = gl.createBuffer(); }
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      gl.bindBuffer(gl.ARRAY_BUFFER, this._ground);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([cx - S, cy - S, -0.5, cx + S, cy - S, -0.5, cx + S, cy + S, -0.5, cx - S, cy - S, -0.5, cx + S, cy + S, -0.5, cx - S, cy + S, -0.5]), gl.DYNAMIC_DRAW);
      gl.useProgram(g.p);
      gl.uniformMatrix4fv(g.u.uVP, false, VP);
      gl.uniform4f(g.u.uRect, a[0], a[1], b[0], b[1]);
      const bg = this.groundColor || [0.93, 0.935, 0.94];
      gl.uniform3f(g.u.uCol, bg[0], bg[1], bg[2]);
      gl.uniform1f(g.u.uFade, r * 3.2);
      gl.enableVertexAttribArray(g.a.aPos); gl.vertexAttribPointer(g.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.depthMask(true);

      // tělesa – nejdřív neprůhledná, pak průhledná
      const m = this.pm;
      gl.useProgram(m.p);
      gl.uniformMatrix4fv(m.u.uVP, false, VP);
      gl.uniform3f(m.u.uEye, eye[0], eye[1], eye[2]);
      gl.enableVertexAttribArray(m.a.aPos); gl.enableVertexAttribArray(m.a.aNor);
      const drawMesh = (o) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.pb); gl.vertexAttribPointer(m.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, o.nb); gl.vertexAttribPointer(m.a.aNor, 3, gl.FLOAT, false, 0, 0);
        gl.uniform3fv(m.u.uColor, o.color); gl.uniform1f(m.u.uAlpha, o.alpha); gl.uniform1f(m.u.uMetal, o.metal);
        gl.uniform1f(m.u.uHi, this.highlight && (o.id === this.highlight) ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, o.n);
      };
      for (const o of this.meshes) if (o.alpha >= 1) drawMesh(o);
      gl.depthMask(false);
      for (const o of this.meshes) if (o.alpha < 1) drawMesh(o);
      gl.depthMask(true);
      gl.disableVertexAttribArray(m.a.aNor);

      // kóty
      if (this.lines && this.showDims !== false) {
        const l = this.pl; gl.useProgram(l.p);
        gl.uniformMatrix4fv(l.u.uVP, false, VP);
        gl.uniform4f(l.u.uCol, 0.2, 0.36, 0.62, 0.9);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lines.b);
        gl.enableVertexAttribArray(l.a.aPos); gl.vertexAttribPointer(l.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, this.lines.n);
      }
      this._drawLabels();
    }

    _drawLabels() {
      const ov = this.overlay; if (!ov) return;
      while (ov.children.length < this.labels.length) { const d = document.createElement("div"); d.className = "dim-label"; ov.appendChild(d); }
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      [...ov.children].forEach((el, i) => {
        const L = this.labels[i];
        if (!L || this.showDims === false) { el.style.display = "none"; return; }
        const p = M4.xform(this._vp, L.p);
        if (p[3] <= 0) { el.style.display = "none"; return; }
        el.style.display = "";
        el.textContent = L.t;
        el.style.transform = "translate(" + ((p[0] * 0.5 + 0.5) * w).toFixed(1) + "px," + ((-p[1] * 0.5 + 0.5) * h).toFixed(1) + "px) translate(-50%,-50%)";
      });
    }

    snapshot(type) { this._draw(); return this.canvas.toDataURL(type || "image/png"); }
  }

  root.Viewer = Viewer;
})(typeof window !== "undefined" ? window : globalThis);
