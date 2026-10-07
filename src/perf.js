import * as THREE from 'three';
import { runSteps } from './load-steps.js';

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

export function tileScene(scene, o = {}) { return runSteps(tileSceneSteps(scene, o)); }
/** tileScene a mesh a step (src/load-steps.js: the terrain-sized ones are cut a few thousand triangles a step). */
export function* tileSceneSteps(scene, { tile = 260, propTile = 110 } = {}) {
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
    yield;
    const size = !o.isInstancedMesh && triangleCount(o.geometry) >= 150000 ? tile : propTile;
    const tiles = o.isInstancedMesh ? tileInstances(o, size) : yield* tileTriangles(o, size);
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

function* tileTriangles(mesh, size) {
  const g = mesh.geometry, P = g.attributes.position;
  const idx = g.index ? g.index.array : Array.from({ length: P.count }, (_, i) => i);
  const buckets = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    if (i % 30000 === 0) yield;
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const cx = (P.getX(a) + P.getX(b) + P.getX(c)) / 3, cz = (P.getZ(a) + P.getZ(b) + P.getZ(c)) / 3;
    const k = `${Math.floor(cx / size)},${Math.floor(cz / size)}`;
    let arr = buckets.get(k);
    if (!arr) buckets.set(k, (arr = []));
    arr.push(a, b, c);
  }
  const out = [];
  for (const arr of buckets.values()) {
    yield;
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
 * sub-pixel pebbles and shrubs under the haze (a tile's userData.drawFar, if set, is its own distance). Call once a frame before rendering;
 * returns what it hid, to be shown again after the frame (a level's own hiding is kept). */
export function cullFar(tiles, camera, distance = 520, hidden = []) {
  const cam = camera.position;
  for (const t of tiles) {
    if (!t.visible || t.userData.dynamic) continue;   // (refilled meshes keep their own distance: flora.js)
    let c = t.userData.cullCentre;
    if (!c) {
      if (!t.boundingSphere) t.computeBoundingSphere?.();
      const s = t.boundingSphere ?? t.geometry.boundingSphere;
      if (!s) continue;
      t.updateWorldMatrix(true, false);
      c = t.userData.cullCentre = s.center.clone().applyMatrix4(t.matrixWorld);
      t.userData.cullRadius = s.radius * t.matrixWorld.getMaxScaleOnAxis();
    }
    if (cam.distanceTo(c) - t.userData.cullRadius > (t.userData.drawFar ?? distance)) { t.visible = false; hidden.push(t); }
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
    // (a pool with nothing placed yet, every instance scaled to nothing: its bounds would be a point)
    if (!o.boundingSphere || !Number.isFinite(o.boundingSphere.radius) || o.boundingSphere.radius < 1e-6) return;
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

// ------------------------------------------------------------------ inside a room off the map
const _ib = new THREE.Box3(), _is = new THREE.Sphere(), _ip = new THREE.Vector3();
/**
 * The other way round: while the camera is inside a room off the map (the cave in the giant's
 * chest, the Hearth's hall, a temple's rooms: all built a kilometre or more over the map, walled
 * in, with only a door veil and oculi to the sky), nothing on the map can be seen, but without
 * this all of it in the camera's frustum was still drawn and shadowed behind the walls: in the
 * desert's cave, 340 draws and 0.37 M triangles of dunes, city and flora a kilometre below, more
 * than the open dunes themselves. Each room's extent is found once, the first time it is wanted:
 * the static meshes near its door that stand well clear of the ground, grown room by room (a
 * temple's rooms in a row). While the camera is in that box, every mesh, point cloud or line
 * whose bounds don't reach the box is hidden in every pass of the frame (and shown again after
 * it, like the other cullers): the map, people and mounts left outside, other rooms. The traveller
 * and whoever is in the room with them stay.
 * @param rooms  [Vector3] the rooms' doors (the portals' destinations)
 * @param o.ground (x, z) => the map's height there (what "well clear of the ground" is measured from)
 * @param o.seed   m: meshes this near the door start the room
 * @param o.grow   m: a mesh this near the room so far is part of it (the next room along)
 * @param o.lift   m: how far over the ground a room's mesh stands at least
 * @param o.margin m: the box grows by this much for the camera's test and for what it keeps
 */
export class InteriorCuller {
  constructor(scene, rooms, { ground = () => 0, seed = 60, grow = 30, lift = 150, margin = 4, maxRadius = 400 } = {}) {
    this.scene = scene;
    this.rooms = rooms.map((at) => ({ at: at.clone(), box: null }));
    Object.assign(this, { ground, seed, grow, lift, margin, maxRadius });
    this.list = null; this.n = -1; this.active = null; this.age = 0; this.frame = 0;
  }
  /** a renderable's bounds in the world (instanced: all its instances; skinned: its bind pose where it stands) */
  static bounds(o, out) {
    if (o.isInstancedMesh || o.isBatchedMesh) {
      if (!o.boundingSphere) o.computeBoundingSphere();
      return out.copy(o.boundingSphere).applyMatrix4(o.matrixWorld);
    }
    const g = o.geometry;
    if (!g) return null;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere || !Number.isFinite(g.boundingSphere.radius)) return null;
    return out.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
  }
  /** every mesh, point cloud, line and sprite in the scene (again when the scene changes or every few seconds) */
  collect() {
    const list = [];
    this.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.geometry) list.push(o); });
    this.list = list; this.n = this.scene.children.length; this.age = 0;
  }
  /** The room's box: the static meshes near its door clear of the ground, then those near them, until none is added. */
  extent(room) {
    if (room.box) return room.box;
    this.scene.updateMatrixWorld();
    if (!this.list) this.collect();
    const cand = [];
    for (const o of this.list) {
      if (o.isSkinnedMesh || o.userData.dynamic) continue;
      const s = InteriorCuller.bounds(o, new THREE.Sphere());
      if (!s || s.radius > this.maxRadius) continue;
      if (s.center.y - s.radius - this.ground(s.center.x, s.center.z) < this.lift) continue;
      cand.push(s);
    }
    const box = new THREE.Box3().setFromCenterAndSize(room.at, new THREE.Vector3(1, 1, 1).multiplyScalar(0.5));
    const used = new Uint8Array(cand.length);
    for (let i = 0; i < cand.length; i++) if (cand[i].center.distanceTo(room.at) - cand[i].radius < this.seed) { used[i] = 1; box.union(cand[i].getBoundingBox(_ib)); }
    for (let added = true; added;) {
      added = false;
      const reach = box.clone().expandByScalar(this.grow);
      for (let i = 0; i < cand.length; i++) if (!used[i] && reach.intersectsSphere(cand[i])) { used[i] = 1; box.union(cand[i].getBoundingBox(_ib)); added = true; }
    }
    return (room.box = box);
  }
  /** The room the camera is in (its box), or null. */
  roomAt(p) {
    for (const room of this.rooms) {
      if (p.y - this.ground(p.x, p.z) < this.lift) continue;   // (on the map: no room is anywhere near)
      const box = this.extent(room);
      if (box.distanceToPoint(p) <= this.margin) return box;
    }
    return null;
  }
  /** Hide what the room hides (returns what it hid, to be shown again after the frame). */
  hide(camera, out = []) {
    if (!this.rooms.length) return out;
    const box = this.roomAt(camera.position);
    if (box !== this.active) { this.active = box; if (box) this.collect(); }   // (what's there now, on the way in)
    if (!box) return out;
    if (++this.age > 180 || this.n !== this.scene.children.length) this.collect();   // (anything added since, every few seconds)
    this.frame++;
    const keep = _ib.copy(box).expandByScalar(this.margin);
    for (const o of this.list) {
      if (!o.visible) continue;
      // Left unculled (frustumCulled false): drawn wherever it is, its bounds not kept (the fluid's
      // rings and spray, the hose, splats, splashes). Their cached bounds are stale or empty, and
      // hid the push's shock front in every temple: an instanced one is measured where its
      // instances are now (none: nothing to draw; a big set, the Givers' water's thousands, every
      // 16th frame), anything else stays.
      if (o.frustumCulled === false) {
        if (!o.isInstancedMesh || o.count === 0) continue;
        if (o.count <= 512 || !o.boundingSphere || (this.frame & 15) === 0) o.computeBoundingSphere();
      }
      const s = InteriorCuller.bounds(o, _is);
      if (s && !keep.intersectsSphere(s)) { o.visible = false; out.push(o); }
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
 *    to keep the frame rate between low and high fps; steady / hold: also step down for
 *    missed refreshes (that many in half a second) and wait that many half-seconds before
 *    climbing back (adaptScale)
 *  - shadow: map size per cascade (fine 24 m, near, far 2.3 km), 0 = no such cascade;
 *    nearExtent: half-size of the near map (m)
 *  - nearEvery / farEvery: refresh the near / far map every n-th frame
 *  - crowdFar: crowd figures drawn up to (m); crowdMid: full-figure range (m)
 *  - propFar: pebbles and shrubs drawn up to (m); propPx: props smaller than this on screen (px) are skipped
 *  - postLite: one ink-line pass instead of two
 *  - floraFar: plants drawn up to this share of their own distance (flora.js); floraDensity: how many
 *    small plants grow in a clump (read when the world loads; large plants always grow)
 *  - lodPx: levels of detail (lod.js): a distant mesh may lose detail smaller than this many pixels
 *    on screen (0 = always full detail)
 */
// (cpuBound's probe, adaptScale: a step of 0.1 tried where the main thread looks like the limit, judged over
//  5 windows, kept for 3 fps more or 2 missed refreshes fewer a window, else not tried again for 240 windows, 2 min)
const PROBE = { step: 0.1, windows: 5, fps: 3, missed: 2, hold: 240 };
const FULL = { dynamic: null, shadow: { fine: 2048, near: 4096, far: 2048 }, nearExtent: 220, nearEvery: 1, farEvery: 3, taps: 9, ao: true, cloudShadows: true, lowDetail: false, crowdFar: null, crowdMid: null, propFar: 520, propPx: 1, postLite: false, floraFar: 1, floraDensity: 1, lodPx: 1 };
export const QUALITY_PRESETS = {
  auto:     { ...FULL, label: 'Auto (adapts to keep it smooth)', scale: 1, dynamic: { min: 0.5, max: 1, low: 40, high: 56 } },
  handheld: { label: 'Handheld (Retroid, phones)', scale: 0.75, dynamic: { min: 0.5, max: 0.9, low: 34, high: 55, steady: 3, hold: 40, cpuBound: 0.85, probe: PROBE },
    shadow: { fine: 0, near: 2048, far: 2048 }, nearExtent: 160, nearEvery: 2, farEvery: 4, taps: 4,
    ao: false, cloudShadows: false, lowDetail: true, crowdFar: 220, crowdMid: 40, propFar: 320, propPx: 2, postLite: true, floraFar: 0.65, floraDensity: 0.55, lodPx: 2 },
  low:      { ...FULL, label: 'Low (fast)', scale: 0.7, shadow: { fine: 1024, near: 2048, far: 2048 }, nearEvery: 2, taps: 4,
    ao: false, cloudShadows: false, lowDetail: true, crowdFar: 300, crowdMid: 45, propFar: 420, propPx: 1.5, floraFar: 0.8, floraDensity: 0.75, lodPx: 1.5 },
  // the Steam Deck at its own 1280×800: the handheld's lighter recipe where the Deck's CPU pays for
  // it (crowd, props, flora, the fine cascade), the full image otherwise (native resolution, crease
  // shading, both ink passes), adapting down to 0.6 when a scene is too much
  deck:     { label: 'Steam Deck', scale: 1, dynamic: { min: 0.6, max: 1, low: 40, high: 56, steady: 3, hold: 40, cpuBound: 0.85, probe: PROBE },
    shadow: { fine: 1024, near: 2048, far: 2048 }, nearExtent: 180, nearEvery: 2, farEvery: 4, taps: 4,
    ao: true, cloudShadows: false, lowDetail: true, crowdFar: 260, crowdMid: 45, propFar: 380, propPx: 1.5, postLite: false, floraFar: 0.75, floraDensity: 0.65, lodPx: 1.5 },
  medium:   { ...FULL, label: 'Medium', scale: 1 },
  high:     { ...FULL, label: 'High (smooth lines)', scale: 1.5 },
};

/**
 * Dynamic resolution, one step per measuring window (~0.5 s): the render scale to use next.
 * Too slow (fps under D.low) three windows running: down a step (a bigger one when well under).
 * Fast (over D.high) for twelve windows: up 0.05. With D.steady set (the handheld), frames that
 * missed the display's refresh count too: `missed` of them in a window (frames over 1.5x the
 * window's quickest) is slow however high the average, it only climbs through windows with
 * none, and after a drop for missed frames it holds for D.hold windows before trying higher
 * again (a 60 Hz screen that drops one frame in four reads as 45 fps: smooth on paper, a stutter
 * in the hand).
 * @param s  state { slow, fast, hold }, updated in place
 * @returns { scale, dropped } (dropped: this step went down)
 */
export function adaptScale(s, { fps, missed = 0, cpu = 0, period = 1000 / 60 }, D, scale) {
  // (D.cpuBound: the main thread's own time a frame over that share of the refresh means the CPU is what's
  //  slow, and fewer pixels can't help: no drop then, for missed refreshes or a low frame rate; GeckoView on
  //  the handheld fell to its floor at no gain in fps, docs/systems/performance.md)
  const cpuBound = D.cpuBound ? cpu > D.cpuBound * period : false;
  if (s.probe) return judgeProbe(s, fps, missed, D, scale);
  if (s.noProbe > 0) s.noProbe--;
  const jerky = D.steady && !cpuBound ? missed >= D.steady : false;
  const clean = !D.steady || missed === 0;
  if (s.hold > 0) s.hold--;
  // Slow, but the main thread looks like the limit: its time can be the GPU's too (GeckoView's main thread
  // waits when the GPU process is behind: the City-Shaft looking down the shaft, 17 ms a frame whatever the
  // scale, 44 fps at 0.75 and 55 at 0.5). So try one step down, and keep it only if it helped (D.probe).
  const slowAnyway = fps < D.low || (D.steady && missed >= D.steady);
  if (cpuBound && D.probe && slowAnyway && !(s.noProbe > 0) && scale > D.min) {
    s.cpuSlow = (s.cpuSlow ?? 0) + 1; s.cpuFps = (s.cpuFps ?? 0) + fps; s.cpuMissed = (s.cpuMissed ?? 0) + missed;
    if (s.cpuSlow >= 3) {
      s.probe = { from: scale, fps: s.cpuFps / s.cpuSlow, missed: s.cpuMissed / s.cpuSlow, n: 0, f: 0, m: 0 };
      s.cpuSlow = s.cpuFps = s.cpuMissed = 0; s.slow = s.fast = 0;
      return { scale: Math.max(D.min, +(scale - D.probe.step).toFixed(2)), dropped: true };
    }
  } else s.cpuSlow = s.cpuFps = s.cpuMissed = 0;
  if ((fps < D.low && !cpuBound) || jerky) { s.slow++; s.fast = 0; } else if (fps > D.high && clean) { s.fast++; s.slow = 0; } else s.slow = s.fast = 0;
  if (s.slow >= 3 && scale > D.min) {
    const step = fps < D.low * 0.7 ? 0.1 : 0.05;   // well under: a bigger step
    s.slow = 0;
    if (jerky && fps >= D.low) s.hold = D.hold ?? 0;
    return { scale: Math.max(D.min, +(scale - step).toFixed(2)), dropped: true };
  }
  if (s.fast >= 12 && scale < D.max && !(s.hold > 0)) {
    s.fast = 0;
    return { scale: Math.min(D.max, +(scale + 0.05).toFixed(2)), dropped: false };
  }
  return { scale, dropped: false };
}

/**
 * A probe's windows (adaptScale): the first one left out (the resize's own hitch), the rest against the three
 * slow windows before it. Better by D.probe.fps frames a second, or by D.probe.missed missed refreshes a window:
 * the scale stays (and holds, as after a stutter). Not: back to where it was, and no probe for D.probe.hold windows.
 */
function judgeProbe(s, fps, missed, D, scale) {
  const p = s.probe;
  if (++p.n > 1) { p.f += fps; p.m += missed; }
  if (p.n < D.probe.windows) return { scale, dropped: false };
  const k = p.n - 1, better = p.f / k - p.fps >= D.probe.fps || p.missed - p.m / k >= D.probe.missed;
  s.probe = null; s.slow = s.fast = 0;
  if (better) { s.hold = D.hold ?? 0; return { scale, dropped: false }; }
  s.noProbe = D.probe.hold;
  return { scale: p.from, dropped: false };
}

/**
 * The browser engine, first on the frame readout (F), so a screenshot or someone watching a
 * benchmark can tell them apart: "GECKO 157" (the Android app's GeckoView), "WEBVIEW 109" (the
 * system WebView), "CHROME 154", "FIREFOX 157", "EDGE 141", "SAFARI 18", "ELECTRON 38", else "WEB".
 * @param ua      navigator.userAgent
 * @param search  location.search: ?engine=… overrides it (a benchmark's own name)
 * @param app     window.Capacitor (the Android app says which engine it runs the page in)
 */
export function engineLabel(ua = '', search = '', app = null) {
  const forced = new URLSearchParams(search).get('engine');
  if (forced) return forced.toUpperCase();
  const v = (re) => ua.match(re)?.[1];
  if (v(/Firefox\/(\d+)/)) return `${app?.engine === 'gecko' ? 'GECKO' : 'FIREFOX'} ${v(/Firefox\/(\d+)/)}`;
  if (v(/Electron\/(\d+)/)) return `ELECTRON ${v(/Electron\/(\d+)/)}`;
  if (v(/Edg\w*\/(\d+)/)) return `EDGE ${v(/Edg\w*\/(\d+)/)}`;
  if (v(/Chrome\/(\d+)/)) return `${/; wv\)/.test(ua) ? 'WEBVIEW' : 'CHROME'} ${v(/Chrome\/(\d+)/)}`;
  if (v(/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/)) return `SAFARI ${v(/Version\/(\d+)/)}`;
  return 'WEB';
}

/**
 * A handheld or a weak GPU: the Android app (Capacitor), a mobile or software GPU, or an
 * old integrated one on a touch device.
 * @param o.native  window.Capacitor?.isNativePlatform?.()
 * @param o.touch   coarse pointer / touch events
 * @param o.gpu     the WebGL renderer string (WEBGL_debug_renderer_info when available)
 */
/** The Steam Deck: its app (desktop/main.mjs, the game at moebius:), or its GPU (Van Gogh, 'AMD Custom GPU 0405' / '0932' for the OLED). */
export function detectDeck({ app = false, gpu = '' } = {}) {
  return app || /AMD Custom GPU 0(405|932)|VANGOGH/i.test(gpu);
}

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
export function resolveQuality(name, { handheld = false, deck = false, hiDPI = false } = {}) {
  const key = name === 'auto' && deck ? 'deck' : name === 'auto' && handheld ? 'handheld' : QUALITY_PRESETS[name] ? name : 'medium';
  const p = { ...QUALITY_PRESETS[key], key, setting: name };
  if (key === 'high' && hiDPI) p.scale = 1;
  if (name === 'auto' && (key === 'handheld' || key === 'deck')) p.label = `Auto: ${QUALITY_PRESETS[key].label}`;
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

// ------------------------------------------------------------------ uniform arrays sent once
/**
 * three.js keeps a single uniform's value per program but not an array's: every material switch
 * sends the shared light list (uLights, 8 vec4) and each material's palette (uPalette, 12 vec3)
 * again, unchanged: ~300 redundant GL calls a frame in a busy world, each a round through Chrome's
 * GPU process and ANGLE. This keeps the last values sent to each uniform location (one per program
 * and uniform) and skips a call that would send the same ones. Only the plain (location, array)
 * form is kept; any other form goes through and forgets the location's values.
 * docs/systems/performance.md
 */
export const CACHED_UNIFORM_ARRAYS = ['uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv'];
export function cacheUniformArrays(gl) {
  if (!gl || gl.__uniformArraysCached) return gl;
  const last = new WeakMap();
  for (const name of CACHED_UNIFORM_ARRAYS) {
    const send = gl[name];
    if (typeof send !== 'function') continue;
    gl[name] = function (loc, data, ...rest) {
      if (!loc || rest.length || !data || typeof data.length !== 'number') {
        if (loc) last.delete(loc);
        return send.call(this, loc, data, ...rest);
      }
      const prev = last.get(loc);
      if (prev && prev.length === data.length) {
        let same = true;
        for (let i = 0; i < data.length; i++) if (prev[i] !== data[i]) { same = false; break; }
        if (same) return undefined;
        prev.set(data);
      } else last.set(loc, Float32Array.from(data));
      return send.call(this, loc, data);
    };
  }
  gl.__uniformArraysCached = true;
  return gl;
}

// ------------------------------------------------------------------ one frame's passes share one renderer frame
/**
 * three.js counts a "frame" per renderer.render() call (info.render.frame), and once per such frame it brings
 * every skinned mesh's skeleton up to date and uploads its bone texture again (WebGLObjects.update). A game frame
 * makes three to five calls (the shadow maps, the G-buffer, the overlays), so every visible person's bones were
 * worked out and uploaded two or three times a frame, unchanged: 41 texture uploads a frame in the desert's camps
 * on the handheld. Between begin() and end() every call sees the same frame number; end() moves on by one, so the
 * next game frame updates them again. Anything rendered outside (a capture, a portrait) counts as before.
 */
export function pinRenderFrame(renderer) {
  const render = renderer.render;
  let pinned = null;
  renderer.render = function (scene, camera) {
    if (pinned !== null) this.info.render.frame = pinned;   // (render() adds one: every pass sees pinned + 1)
    return render.call(this, scene, camera);
  };
  return {
    begin() { pinned = renderer.info.render.frame; },
    end() { if (pinned !== null) { renderer.info.render.frame = pinned + 1; pinned = null; } },
  };
}
