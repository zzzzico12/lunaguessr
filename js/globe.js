// The 3D Moon: textures, relief, picking, markers, labels and the zoom-in detail patch.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { R_KM, KM_PER_DEG, wmsBBox } from "./geo.js";
import { ELEVATION_RANGE_KM } from "./questions.js";

const RAD = Math.PI / 180;
const EXAGGERATION = 2.5;               // relief is real but stretched so it shows on the limb
const [ELO, EHI] = ELEVATION_RANGE_KM;  // km relative to the 1737.4 km sphere
const HOME = new THREE.Vector3(3.4, 0, 0);
const DETAIL_START = 1.9;               // camera distance (Moon radii) below which detail patches load

/** Texture convention: equirectangular, lon 0 at +X, north at +Y, lon -90 at +Z. */
export const toVec = (lat, lon, r = 1) => {
  const a = lat * RAD, b = lon * RAD;
  return new THREE.Vector3(r * Math.cos(a) * Math.cos(b), r * Math.sin(a), -r * Math.cos(a) * Math.sin(b));
};
export const toLatLon = v => {
  const n = v.clone().normalize();
  return { lat: Math.asin(n.y) / RAD, lon: Math.atan2(-n.z, n.x) / RAD };
};

export class Globe {
  constructor(container, { onPick, onHover, onDetail }) {
    this.container = container;
    this.onPick = onPick; this.onHover = onHover; this.onDetail = onDetail;
    this.labels = [];
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    this.camera.position.copy(HOME);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enablePan: false, minDistance: 1.08, maxDistance: 5, enableDamping: true, dampingFactor: 0.08 });

    this.#buildMoon();
    this.#buildStars();
    this.guessPin = this.#pin(0xffb15c);
    this.answerPin = this.#pin(0x7ee0b8);
    this.overlays = [];

    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "labels";
    container.appendChild(this.labelLayer);

    this.#bindPointer();
    new ResizeObserver(() => this.#resize()).observe(container);
    this.#resize();
    this.controls.addEventListener("start", () => clearTimeout(this.detailTimer));
    this.controls.addEventListener("end", () => this.#scheduleDetail());
    this.renderer.setAnimationLoop(() => this.#frame());
  }

  // ---------- setup ----------
  #buildMoon() {
    const loader = new THREE.TextureLoader();
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const prep = tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso; return tex; };
    // Unlit: the mosaic already carries its own shading. MeshBasicMaterial has no displacementMap,
    // so use Lambert with a black base color and the texture as the emissive map.
    this.material = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xffffff });
    // Show the 4k texture fast, then swap in the 8k one where the GPU supports it.
    loader.load("assets/moon_4k.jpg", tex => {
      this.material.emissiveMap = prep(tex); this.material.needsUpdate = true;
      if (this.renderer.capabilities.maxTextureSize >= 8192) {
        loader.load("assets/moon_8k.jpg", hi => { this.material.emissiveMap = prep(hi); this.material.needsUpdate = true; tex.dispose(); });
      }
    });
    // Elevation drives vertex displacement on the GPU; a CPU copy lets markers sit on the surface.
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      this.elev = { w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
      const tex = new THREE.Texture(img); tex.needsUpdate = true;
      Object.assign(this.material, {
        displacementMap: tex,
        displacementScale: ((EHI - ELO) / R_KM) * EXAGGERATION,
        displacementBias: (ELO / R_KM) * EXAGGERATION,
      });
      this.material.needsUpdate = true;
    };
    img.src = "assets/elevation.png";
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(1, 512, 256), this.material);
    this.scene.add(this.moon);
  }

  #buildStars() {
    const pts = Array.from({ length: 1500 }, () => new THREE.Vector3().randomDirection().multiplyScalar(40));
    this.scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.PointsMaterial({ color: 0x9aa4b8, size: 1.2, sizeAttenuation: false })));
  }

  #pin(color) {
    const g = new THREE.Group();
    const mat = { color, depthTest: false, transparent: true };
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial(mat)));
    g.add(new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), new THREE.MeshBasicMaterial({ ...mat, side: THREE.DoubleSide, opacity: 0.7 })));
    g.renderOrder = 10; g.children.forEach(m => (m.renderOrder = 10));
    g.visible = false; this.scene.add(g);
    return g;
  }

  /** Surface radius (in Moon radii) at lat/lon, matching the displaced mesh. */
  radiusAt(lat, lon) {
    if (!this.elev) return 1;
    const { w, h, data } = this.elev;
    const x = ((lon + 180) / 360) * w - 0.5, y = ((90 - lat) / 180) * h - 0.5;
    const x0 = Math.floor(x), y0 = Math.max(0, Math.min(h - 1, Math.floor(y))), y1 = Math.min(h - 1, y0 + 1);
    const fx = x - x0, fy = Math.max(0, Math.min(1, y - y0));
    const px = (xx, yy) => data[(yy * w + (((xx % w) + w) % w)) * 4] / 255;
    const v = (px(x0, y0) * (1 - fx) + px(x0 + 1, y0) * fx) * (1 - fy) + (px(x0, y1) * (1 - fx) + px(x0 + 1, y1) * fx) * fy;
    return 1 + ((ELO + v * (EHI - ELO)) / R_KM) * EXAGGERATION;
  }
  surface(lat, lon, lift = 0) { return toVec(lat, lon, this.radiusAt(lat, lon) + lift); }

  // ---------- input ----------
  #pick(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const hit = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), new THREE.Vector3());
    return hit ? toLatLon(hit) : null;
  }
  #bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener("pointerdown", e => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener("pointermove", e => this.onHover?.(this.#pick(e)));
    el.addEventListener("pointerleave", () => this.onHover?.(null));
    el.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const p = this.#pick(e); if (p) this.onPick?.(p);
    });
  }

  // ---------- markers ----------
  setGuess(ll) { this.#place(this.guessPin, ll); }
  #place(pin, ll) {
    if (!ll) { pin.visible = false; return; }
    const p = this.surface(ll.lat, ll.lon, 0.002);
    pin.position.copy(p); pin.lookAt(p.clone().multiplyScalar(2)); pin.visible = true; pin.userData.dir = p.clone().normalize();
  }
  clearResult() {
    this.overlays.forEach(o => { this.scene.remove(o); o.geometry.dispose(); });
    this.overlays = [];
    this.#place(this.guessPin, null); this.#place(this.answerPin, null);
    this.labels = this.labels.filter(l => { if (l.result) l.el.remove(); return !l.result; });
  }

  /** Show the answer pin, the arc from the guess, and the outline of the named feature. */
  showResult(guess, answer, feature, featureName) {
    this.#place(this.answerPin, answer);
    if (guess) this.#arc(guess, answer);
    if (feature) {
      this.#ring(feature.lat, feature.lon, feature.km / 2);
      this.addLabel(featureName, feature.lat, feature.lon, "answer", true);
    }
    const mid = guess ? toVec(guess.lat, guess.lon).add(toVec(answer.lat, answer.lon)) : toVec(answer.lat, answer.lon);
    const d = guess ? toVec(guess.lat, guess.lon).angleTo(toVec(answer.lat, answer.lon)) * R_KM : 0;
    this.flyTo(mid.lengthSq() < 1e-6 ? toVec(answer.lat, answer.lon) : mid, Math.min(4.2, 1.5 + d / 1200));
  }
  #line(points, opts) {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, opts.dashed
      ? new THREE.LineDashedMaterial({ color: opts.color, dashSize: 0.012, gapSize: 0.008 })
      : new THREE.LineBasicMaterial({ color: opts.color, transparent: true, opacity: 0.9 }));
    if (opts.dashed) line.computeLineDistances();
    line.renderOrder = 5; // after the detail patch, which does not write depth
    this.scene.add(line); this.overlays.push(line);
  }
  #arc(a, b) {
    const va = toVec(a.lat, a.lon), vb = toVec(b.lat, b.lon), ang = va.angleTo(vb), pts = [];
    for (let i = 0; i <= 128; i++) {
      const t = i / 128;
      const v = ang < 1e-6 ? va.clone()
        : va.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(vb.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang));
      const ll = toLatLon(v);
      pts.push(v.normalize().multiplyScalar(this.radiusAt(ll.lat, ll.lon) + 0.006 + Math.sin(t * Math.PI) * ang * 0.05));
    }
    this.#line(pts, { color: 0xffffff, dashed: true });
  }
  #ring(lat, lon, radiusKm) {
    const c = toVec(lat, lon), a = radiusKm / R_KM;
    const e1 = new THREE.Vector3(0, 1, 0).cross(c).normalize();
    if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
    const e2 = c.clone().cross(e1).normalize(), pts = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      const v = c.clone().multiplyScalar(Math.cos(a)).add(e1.clone().multiplyScalar(Math.cos(t) * Math.sin(a))).add(e2.clone().multiplyScalar(Math.sin(t) * Math.sin(a)));
      const ll = toLatLon(v);
      pts.push(v.normalize().multiplyScalar(this.radiusAt(ll.lat, ll.lon) + 0.006));
    }
    this.#line(pts, { color: 0x7ee0b8 });
  }

  // ---------- labels ----------
  addLabel(text, lat, lon, cls = "", result = false) {
    const el = document.createElement("div");
    el.textContent = text; el.className = cls;
    this.labelLayer.appendChild(el);
    const l = { el, lat, lon, result, dir: toVec(lat, lon) };
    this.labels.push(l);
    return l;
  }
  setMareLabels(list, visible) {
    this.labels.filter(l => l.mare).forEach(l => l.el.remove());
    this.labels = this.labels.filter(l => !l.mare);
    if (visible) list.forEach(m => (this.addLabel(m.text, m.lat, m.lon, "mare").mare = true));
  }

  // ---------- camera ----------
  flyTo(dir, dist) { this.fly = { from: this.camera.position.clone(), to: dir.clone().normalize().multiplyScalar(dist), t: 0 }; }
  reset() { this.flyTo(HOME, HOME.length()); }

  #resize() {
    const r = this.container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }

  #frame() {
    if (this.fly) {
      const f = this.fly; f.t = Math.min(1, f.t + 0.035);
      const e = 1 - Math.pow(1 - f.t, 3);
      const dist = THREE.MathUtils.lerp(f.from.length(), f.to.length(), e);
      this.camera.position.copy(f.from.clone().normalize().lerp(f.to.clone().normalize(), e).normalize().multiplyScalar(dist));
      if (f.t >= 1) { this.fly = null; this.#scheduleDetail(); }
    }
    const d = this.camera.position.length();
    this.controls.rotateSpeed = Math.max(0.03, Math.min(0.6, (d - 1) * 0.3));
    this.controls.zoomSpeed = d < 1.5 ? 0.5 : 1;
    this.controls.update();

    const cam = this.camera.position.clone().normalize();
    for (const pin of [this.guessPin, this.answerPin]) {
      if (!pin.visible) continue;
      pin.scale.setScalar((d - 1) * 0.012);
      pin.children.forEach(m => (m.material.opacity = pin.userData.dir.dot(cam) > 0.05 ? 1 : 0));
    }
    if (this.detail) this.detail.visible = d < DETAIL_START + 0.2 && this.detail.userData.dir.dot(cam) > 0.5;

    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight, v = new THREE.Vector3();
    for (const l of this.labels) {
      const vis = l.dir.dot(cam) > 0.25;
      l.el.hidden = !vis;
      if (vis) {
        v.copy(l.dir).multiplyScalar(this.radiusAt(l.lat, l.lon)).project(this.camera);
        l.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
        l.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- detail patch ----------
  // When zoomed in, fetch a sharper crop of the same mosaic for the area in view and drape it over the globe.
  #scheduleDetail() {
    clearTimeout(this.detailTimer);
    this.detailTimer = setTimeout(() => this.#loadDetail(), 350);
  }
  #loadDetail() {
    const d = this.camera.position.length();
    if (d >= DETAIL_START) return;
    const center = toLatLon(this.camera.position);
    const viewKm = 2 * (d - 1) * Math.tan((this.camera.fov / 2) * RAD) * R_KM * Math.max(1, this.camera.aspect) * 1.5;
    const km = Math.min(Math.max(viewKm, 60), 1400);
    const dLat = km / KM_PER_DEG / 2;
    if (Math.abs(center.lat) + dLat > 82) return;
    if (this.detail && this.detail.userData.km < km * 1.2 && this.detail.userData.km > km * 0.6 &&
        toVec(center.lat, center.lon).angleTo(this.detail.userData.dir) * R_KM < km * 0.25) return;
    const dLon = dLat / Math.cos(center.lat * RAD);
    const req = { lat: center.lat, lon: center.lon, dLat, dLon, km };
    this.detailReq = req;
    this.onDetail?.(true);
    new THREE.TextureLoader().load(
      wmsBBox(center.lon - dLon, center.lat - dLat, center.lon + dLon, center.lat + dLat, 1024, 1024),
      tex => { if (this.detailReq === req) this.#setDetail(req, tex); else tex.dispose(); this.onDetail?.(false); },
      undefined,
      () => this.onDetail?.(false),
    );
  }
  #setDetail(req, tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const N = 64, pos = [], uv = [], idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const lat = req.lat - req.dLat + (2 * req.dLat * j) / N, lon = req.lon - req.dLon + (2 * req.dLon * i) / N;
      pos.push(...this.surface(lat, lon, 0.0004).toArray()); uv.push(i / N, j / N);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, e = c + 1;
      idx.push(a, b, e, a, e, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    // Drawn over the base globe without depth testing; hidden whenever it turns away from the camera.
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false }));
    mesh.renderOrder = 1;
    mesh.userData = { dir: toVec(req.lat, req.lon), km: req.km };
    if (this.detail) { this.scene.remove(this.detail); this.detail.geometry.dispose(); this.detail.material.map.dispose(); this.detail.material.dispose(); }
    this.detail = mesh; this.scene.add(mesh);
  }
}
