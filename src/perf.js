import * as THREE from 'three';

// Split world-spanning meshes into tiles so frustum culling can skip what's
// off-screen in each pass (main view and each shadow cascade). Without this
// the terrain and every merged prop set are drawn in full, four times a
// frame: one merged mesh that touches the 24 m fine cascade is drawn whole.
// Tiles share the original buffers, so this costs little memory.
//  - big meshes (terrain, merged rocks and props): triangles grouped by centroid
//  - big InstancedMeshes (rocks, plants, scrub, clouds): instances grouped by position
// Tiles become children of the original (which then draws nothing), so a mesh
// a level moves or hides keeps doing so. Meshes flagged userData.dynamic, or
// with instances rewritten every frame, are left alone.

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _c = new THREE.Color();

const triangleCount = (g) => (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
function spread(o) {
  const g = o.geometry;
  if (o.isInstancedMesh) { o.computeBoundingSphere(); return o.boundingSphere.radius; }
  if (!g.boundingSphere) g.computeBoundingSphere();
  return g.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
}

export function tileScene(scene, { tile = 260, propTile = 110 } = {}) {
  const small = [];   // tiles of small props (excluded from the far shadow pass)
  const todo = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.userData.dynamic || o.userData.tiled || !o.geometry.attributes.position) return;
    if (o.isInstancedMesh) {
      if (o.instanceMatrix.usage === THREE.DynamicDrawUsage) return;
      const total = o.count * triangleCount(o.geometry);
      if ((o.count > 300 || (o.count >= 48 && total >= 30000)) && spread(o) > propTile * 0.6) todo.push(o);
    } else {
      const tris = triangleCount(o.geometry);
      if (tris >= 150000 || (tris >= 20000 && spread(o) > propTile * 0.6)) todo.push(o);
    }
  });
  for (const o of todo) {
    const size = !o.isInstancedMesh && triangleCount(o.geometry) >= 150000 ? tile : propTile;
    const tiles = o.isInstancedMesh ? tileInstances(o, size) : tileTriangles(o, size);
    if (tiles.length < 2) continue;
    for (const t of tiles) {
      t.userData = { ...o.userData, tiled: true };
      t.castShadow = o.castShadow; t.receiveShadow = o.receiveShadow; t.renderOrder = o.renderOrder;
      o.add(t);
      if (o.isInstancedMesh) small.push(t);
    }
    // the original keeps its transform and visibility; its own draw becomes empty
    if (o.isInstancedMesh) o.count = 0;
    else {   // same buffers (anything reading them still works), nothing drawn; shared geometries stay intact
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(o.geometry.attributes)) g.setAttribute(name, attr);
      g.setIndex(o.geometry.index); g.boundingSphere = o.geometry.boundingSphere; g.boundingBox = o.geometry.boundingBox;
      g.setDrawRange(0, 0);
      o.geometry = g;
    }
    o.userData.tiled = true;
  }
  return { small };
}

function tileTriangles(mesh, size) {
  const g = mesh.geometry, P = g.attributes.position;
  const idx = g.index ? g.index.array : Array.from({ length: P.count }, (_, i) => i);
  const buckets = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const cx = (P.getX(a) + P.getX(b) + P.getX(c)) / 3, cz = (P.getZ(a) + P.getZ(b) + P.getZ(c)) / 3;
    const k = `${Math.floor(cx / size)},${Math.floor(cz / size)}`;
    let arr = buckets.get(k);
    if (!arr) buckets.set(k, (arr = []));
    arr.push(a, b, c);
  }
  const out = [];
  for (const arr of buckets.values()) {
    const tg = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) tg.setAttribute(name, attr);
    tg.setIndex(new THREE.BufferAttribute(new Uint32Array(arr), 1));
    // bounding volume from just this tile's vertices
    const box = new THREE.Box3();
    for (const v of arr) box.expandByPoint(_p.fromBufferAttribute(P, v));
    tg.boundingBox = box;
    tg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    for (const [name, morph] of Object.entries(g.morphAttributes)) tg.morphAttributes[name] = morph;
    out.push(new THREE.Mesh(tg, mesh.material));
  }
  return out;
}

function tileInstances(mesh, size) {
  const buckets = new Map();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, _m);
    _p.setFromMatrixPosition(_m);
    const k = `${Math.floor(_p.x / size)},${Math.floor(_p.z / size)}`;
    let arr = buckets.get(k);
    if (!arr) buckets.set(k, (arr = []));
    arr.push(i);
  }
  const out = [];
  for (const ids of buckets.values()) {
    const t = new THREE.InstancedMesh(mesh.geometry, mesh.material, ids.length);
    ids.forEach((src, j) => {
      mesh.getMatrixAt(src, _m);
      t.setMatrixAt(j, _m);
      if (mesh.instanceColor) { mesh.getColorAt(src, _c); t.setColorAt(j, _c); }
    });
    t.computeBoundingSphere();
    t.frustumCulled = true;
    out.push(t);
  }
  return out;
}

/** Hide small-prop tiles far from the camera in every pass: beyond this they are
 * sub-pixel pebbles and shrubs under the haze. Call once a frame before rendering;
 * returns what it hid, to be shown again after the frame (a level's own hiding is kept). */
export function cullFar(tiles, camera, distance = 520) {
  const cam = camera.position, hidden = [];
  for (const t of tiles) {
    if (!t.visible) continue;
    let c = t.userData.cullCentre;
    if (!c) {
      if (!t.boundingSphere) t.computeBoundingSphere?.();
      const s = t.boundingSphere ?? t.geometry.boundingSphere;
      if (!s) continue;
      t.updateWorldMatrix(true, false);
      c = t.userData.cullCentre = s.center.clone().applyMatrix4(t.matrixWorld);
      t.userData.cullRadius = s.radius * t.matrixWorld.getMaxScaleOnAxis();
    }
    if (cam.distanceTo(c) - t.userData.cullRadius > distance) { t.visible = false; hidden.push(t); }
  }
  return hidden;
}

// ------------------------------------------------------------------ bounds
/**
 * Bounding spheres for InstancedMeshes that were left unculled (frustumCulled = false, drawn
 * in every pass wherever they are): those whose instances don't move get their real bounds and
 * are culled like everything else. Rewritten-every-frame ones (dynamic usage) are left alone.
 * Returns how many it fixed.
 */
export function fitBounds(scene, { pad = 1 } = {}) {
  let n = 0;
  scene.traverse((o) => {
    if (!o.isInstancedMesh || o.frustumCulled || o.userData.dynamic || o.instanceMatrix.usage === THREE.DynamicDrawUsage || o.count === 0) return;
    o.computeBoundingSphere();
    if (!o.boundingSphere || !Number.isFinite(o.boundingSphere.radius)) return;
    o.boundingSphere.radius += pad;   // vertex sway (grass, scrub)
    o.frustumCulled = true;
    n++;
  });
  return n;
}

// ------------------------------------------------------------------ small props by projected size
const _wc = new THREE.Vector3();
/**
 * Small single meshes (posts, crates, lamps, pebbles…) the camera sees at under `minPx`
 * pixels across are hidden in every pass of this frame. Candidates are collected once
 * (radius under `maxRadius`, frustum-culled, not self-lit) and their centres cached until
 * they move. Returns what it hid, to be shown again after the frame.
 */
export class SmallCuller {
  constructor(scene, { maxRadius = 3 } = {}) { this.scene = scene; this.maxRadius = maxRadius; this.items = null; this.n = -1; }
  collect() {
    const items = [];
    this.scene.updateMatrixWorld();
    this.scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.frustumCulled || o.userData.tiled || !o.geometry?.attributes?.position) return;
      if ((o.material?.uniforms?.uGlow?.value ?? 0) >= 0.8) return;   // lamps stay as points of light
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const r = (g.boundingSphere?.radius ?? Infinity) * o.matrixWorld.getMaxScaleOnAxis();
      if (!(r < this.maxRadius)) return;
      const e = o.matrixWorld.elements;
      items.push({ o, r, c: g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld), m: e[12] + e[13] * 3 + e[14] * 7 });
    });
    this.items = items;
    this.n = this.scene.children.length;
  }
  /** @param pxPerRad pixels per radian at the render resolution (height / fov) */
  hide(camera, pxPerRad, minPx = 1, out = []) {
    if (this.n !== this.scene.children.length || !this.items) this.collect();
    const cam = camera.position, k = (2 * pxPerRad) / minPx;   // hidden when 2 r / d * pxPerRad < minPx
    for (const it of this.items) {
      const o = it.o;
      if (!o.visible) continue;
      const e = o.matrixWorld.elements, m = e[12] + e[13] * 3 + e[14] * 7;
      if (m !== it.m) { it.m = m; it.c.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld); }   // it moved
      if (it.r * k < cam.distanceTo(it.c)) { o.visible = false; out.push(o); }
    }
    return out;
  }
}

// ------------------------------------------------------------------ rooms off the map
/**
 * Rooms built far from the map and reached through a portal (the desert's chambers, the cave
 * in the giant's chest) are hidden in every pass unless the camera is near one of them.
 * @param rooms  [Vector3] room centres (the portals' destinations)
 */
export class RoomCuller {
  constructor(scene, rooms, { radius = 90, near = 160, keep = [] } = {}) {
    this.rooms = rooms.map((at) => ({ at, meshes: [] }));
    this.near = near;
    if (!rooms.length) return;
    scene.updateMatrixWorld();
    const kept = new Set(keep.filter(Boolean));   // whatever moves (the player, people, mounts) is never a room's
    const isKept = (o) => { for (let p = o; p; p = p.parent) if (kept.has(p)) return true; return false; };
    scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.userData.dynamic || !o.geometry?.attributes?.position || isKept(o)) return;
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (!g.boundingSphere) return;
      _wc.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
      const R = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
      for (const room of this.rooms) if (R < radius && _wc.distanceTo(room.at) < radius) { room.meshes.push(o); break; }
    });
  }
  get count() { return this.rooms.reduce((s, r) => s + r.meshes.length, 0); }
  hide(camera, out = []) {
    for (const room of this.rooms) {
      if (camera.position.distanceTo(room.at) < this.near) continue;
      for (const o of room.meshes) if (o.visible) { o.visible = false; out.push(o); }
    }
    return out;
  }
}

// ------------------------------------------------------------------ graphics presets
/**
 * The Graphics setting. Each preset is the whole recipe: render scale (and a dynamic
 * resolution range, if any), the shadow maps (size per cascade, 0 = off; how often
 * the near and far ones refresh), PCF taps, crease shading, cloud shadows, people
 * (NPC detail, how far the crowd is drawn) and props (how far / how small).
 *  - scale: render resolution × device pixels (0.75 = 75 %)
 *  - dynamic: { min, max, low, high } adapt the scale between min and max, aiming
 *    to keep the frame rate between low and high fps
 *  - shadow: map size per cascade (fine 24 m, near, far 2.3 km), 0 = no such cascade;
 *    nearExtent: half-size of the near map (m)
 *  - nearEvery / farEvery: refresh the near / far map every n-th frame
 *  - crowdFar: crowd figures drawn up to (m); crowdMid: full-figure range (m)
 *  - propFar: pebbles and shrubs drawn up to (m); propPx: props smaller than this on screen (px) are skipped
 *  - postLite: one ink-line pass instead of two
 */
const FULL = { dynamic: null, shadow: { fine: 2048, near: 4096, far: 2048 }, nearExtent: 220, nearEvery: 1, farEvery: 3, taps: 9, ao: true, cloudShadows: true, lowDetail: false, crowdFar: null, crowdMid: null, propFar: 520, propPx: 1, postLite: false };
export const QUALITY_PRESETS = {
  auto:     { ...FULL, label: 'Auto (adapts to keep it smooth)', scale: 1, dynamic: { min: 0.5, max: 1, low: 40, high: 56 } },
  handheld: { label: 'Handheld (Retroid, phones)', scale: 0.75, dynamic: { min: 0.5, max: 0.9, low: 34, high: 55 },
    shadow: { fine: 0, near: 2048, far: 2048 }, nearExtent: 160, nearEvery: 1, farEvery: 4, taps: 4,
    ao: false, cloudShadows: false, lowDetail: true, crowdFar: 220, crowdMid: 40, propFar: 320, propPx: 2, postLite: true },
  low:      { ...FULL, label: 'Low (fast)', scale: 0.7, shadow: { fine: 1024, near: 2048, far: 2048 }, nearEvery: 2, taps: 4,
    ao: false, cloudShadows: false, lowDetail: true, crowdFar: 300, crowdMid: 45, propFar: 420, propPx: 1.5 },
  medium:   { ...FULL, label: 'Medium', scale: 1 },
  high:     { ...FULL, label: 'High (smooth lines)', scale: 1.5 },
};

/**
 * A handheld or a weak GPU: the Android app (Capacitor), a mobile or software GPU, or an
 * old integrated one on a touch device.
 * @param o.native  window.Capacitor?.isNativePlatform?.()
 * @param o.touch   coarse pointer / touch events
 * @param o.gpu     the WebGL renderer string (WEBGL_debug_renderer_info when available)
 */
export function detectHandheld({ native = false, touch = false, gpu = '' } = {}) {
  if (native) return true;
  if (/SwiftShader|llvmpipe|softpipe/i.test(gpu)) return true;
  if (/Mali|Adreno|PowerVR|Xclipse|Immortalis|Maleoon|VideoCore|Tegra/i.test(gpu)) return true;
  return touch && /Intel\(R\) HD Graphics/i.test(gpu);
}

/**
 * The preset to run for a Graphics setting: Auto is the handheld recipe on a handheld and the
 * full one elsewhere (adapting its resolution either way). High renders 1.5× unless the
 * screen is already HiDPI.
 */
export function resolveQuality(name, { handheld = false, hiDPI = false } = {}) {
  const key = name === 'auto' && handheld ? 'handheld' : QUALITY_PRESETS[name] ? name : 'medium';
  const p = { ...QUALITY_PRESETS[key], key, setting: name };
  if (key === 'high' && hiDPI) p.scale = 1;
  if (name === 'auto' && key === 'handheld') p.label = `Auto: ${QUALITY_PRESETS.handheld.label}`;
  return p;
}


// ------------------------------------------------------------------ GPU frame time
/** GPU time of the frame where the browser allows it (EXT_disjoint_timer_query_webgl2); else take() is null. */
export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2') ?? null;
    this.enabled = false; this.active = null; this.pending = []; this.free = []; this.sum = 0; this.n = 0;
  }
  begin() {
    if (!this.ext || !this.enabled || this.active || this.pending.length > 6) return;
    const q = this.free.pop() ?? this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }
  end() {
    const gl = this.gl;
    if (this.active) { gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.pending.push(this.active); this.active = null; }
    while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = this.pending.shift();
      if (!gl.getParameter(this.ext.GPU_DISJOINT_EXT)) { this.sum += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; this.n++; }
      this.free.push(q);
    }
  }
  /** Mean GPU ms since the last take (null if none). */
  take() { const v = this.n ? this.sum / this.n : null; this.sum = this.n = 0; return v; }
}
