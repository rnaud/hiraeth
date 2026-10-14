import * as THREE from 'three';

// Ways through (issue #305, the author: "Some doors/gates look weird. Leaving the skull cave it looks like it's blocked
// but it works. There should be a shader to show that I can go through. And maybe an animation showing me going through
// the portal/door."). Every doorway, cave mouth, hatch, lift door and temple door that carries you to another space
// (a level's `portals`, src/passage.js) wears one look: a soft veil of light hanging in its opening, brightest at the
// sill and fading up, streaked into slow drifting rays and stepped into flat bands as the pictures draw light, with a
// pale pool of it on the floor across the sill. Drawn as the game draws every shaft of light (src/veil.js: washes laid
// over the finished picture after the ink pass, additive, the chest light's program with its rays on, issue #285), so
// no ink round it, no shadow, nothing to bump into, no new program. A way that won't take you yet (`when` false: the
// skull's mouth before the backpack, a sea lock before its suit) wears none: it stays as solid as it is drawn.
//
// Going through: the veil flares, a warm light washes over the screen for a moment (THRESHOLD.lead, the traveller still
// walking into it), then the paper sweeps across as before (PassageCover), and on the far side the way back you came
// out of glows and settles.
//
//   const T = new Thresholds({ veils, parent: scene, portals: level.portals, physics })   main.js, once
//   T.update(dt, t, camera.position)                                                       each frame
//   T.flare(portal); T.arrive(point)                                                       going through, arriving
//
// A portal says where its opening is with `door: { at (the sill's middle, on the floor), yaw (the way through), w, h }`
// (src/interiors.js, the temples, the desert's caves); one that doesn't is measured from the walls round it
// (measureDoor), and in the open (nothing round it to measure) it wears a soft round column of the same light.

/** Its look: colours, alphas (a layer), the rays (how many across, how strongly, the soft edge, how fast they drift),
 *  how far from the eye it shows (m), how bright it flares going through, and how long that lasts before the paper (s). */
export const THRESHOLD = {
  color: '#ffe3a6', floor: '#fff1c8',
  alpha: 0.36, floorAlpha: 0.34,
  rays: { count: 5, strength: 0.8, soft: 0.45, speed: 0.55 },
  breathe: 0.12,      // its alpha's slow swell (a share)
  far: 48,            // m: beyond this from the eye it is off (one draw a way, only the near ones)
  fadeIn: 0.6,        // s: as it comes on (a way that has just opened) or goes off
  flare: 2.6,         // its alpha × at the step-through
  flareFade: 0.9,     // s: the flare settling on the far side
  lead: 0.2,          // s: the flare and the light on the screen before the paper comes across
  floorDepth: 0.9,    // m: the pool on the floor, front to back
  size: { w: [1.0, 5.5], h: [2.0, 5.0] },
};

const _Y = new THREE.Vector3(0, 1, 0);

/** True while a portal takes you (no `when`, or its `when` says so). */
export const passable = (p) => !p.when || !!p.when();

/**
 * The opening round a portal's point, from the walls about it: rays out level, 1.2 m over the floor, every 10°; the
 * jambs are the nearest pair of opposite hits (the opening's width across them), the way through square to them, the
 * lintel a ray up. Null in the open (no pair within 3 m each side) or when it is not a doorway's shape.
 */
export function measureDoor(physics, at) {
  if (!physics?.rayDistance) return null;
  const g = physics.groundAt(at.x, at.y + 0.6, at.z, 3);
  const floor = Number.isFinite(g) && g > at.y - 3 ? g : at.y - 0.5;
  const o = new THREE.Vector3(at.x, floor + 1.2, at.z), d = new THREE.Vector3();
  const N = 36, far = 3.2, dist = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; dist.push(physics.rayDistance(o, d.set(Math.sin(a), 0, Math.cos(a)), far)); }
  let best = null;
  for (let i = 0; i < N / 2; i++) {
    const s = dist[i] + dist[i + N / 2];
    if (Number.isFinite(s) && (!best || s < best.s)) best = { i, s };
  }
  if (!best) return null;
  const a = (best.i / N) * Math.PI * 2, across = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  const w = best.s;
  if (w < THRESHOLD.size.w[0] || w > THRESHOLD.size.w[1]) return null;
  // the way through is square to the jambs; it must be open at least one way along it (or it is a corner, not a door)
  const ia = (best.i + N / 4) % N, ib = (best.i + (3 * N) / 4) % N;
  if (Number.isFinite(dist[ia]) && Number.isFinite(dist[ib]) && dist[ia] + dist[ib] < w) return null;
  const mid = o.clone().addScaledVector(across, (dist[best.i] - dist[best.i + N / 2]) / 2);
  const up = physics.rayDistance(o, _Y, 6);
  const h = THREE.MathUtils.clamp(Number.isFinite(up) ? 1.2 + up : 3.2, THRESHOLD.size.h[0], THRESHOLD.size.h[1]);
  return { at: new THREE.Vector3(mid.x, floor, mid.z), yaw: a + Math.PI / 2, w, h, measured: true };
}

/**
 * An opening whose way through is known (`yaw`) fitted to the walls round `at`: its width across between the jambs and
 * its height to the lintel, each unless given (`w`, `h`), else `fallback`'s. A point a little out of its doorway (a
 * temple's way out, in the hall before it) finds its jambs a step or two along the way through.
 */
export function fitDoor(physics, at, yaw, { w = null, h = null } = {}, fallback = { w: 2.2, h: 3.2 }) {
  const g = physics?.groundAt?.(at.x, at.y + 0.6, at.z, 3);
  const floor = Number.isFinite(g) && g > at.y - 3 ? g : at.y;
  const o = new THREE.Vector3(at.x, floor + 1.2, at.z), across = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const back = across.clone().negate(), mid = o.clone();
  if (w == null && physics?.rayDistance) {
    for (const s of [0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2]) {
      const q = o.clone().addScaledVector(n, s), a = physics.rayDistance(q, across, 3.2), b = physics.rayDistance(q, back, 3.2);
      if (Number.isFinite(a) && Number.isFinite(b) && a + b >= THRESHOLD.size.w[0] && a + b <= THRESHOLD.size.w[1]) { w = a + b; mid.copy(q).addScaledVector(across, (a - b) / 2); break; }
    }
  }
  if (h == null && physics?.rayDistance) {
    const up = physics.rayDistance(mid, _Y, 6);
    h = Number.isFinite(up) ? THREE.MathUtils.clamp(1.2 + up, THRESHOLD.size.h[0], THRESHOLD.size.h[1]) : 4.2;   // (no lintel within 6 m: a tall dark doorway)
  }
  return { at: new THREE.Vector3(mid.x, floor, mid.z), yaw, w: w ?? fallback.w, h: h ?? fallback.h };
}

/** Where a portal's light hangs: its own `door` (filled in from the walls where it leaves its size out), or measured, or
 *  a column round its point. */
export function doorOf(p, physics = null) {
  const d = p.door;
  if (d?.at && d.yaw != null && d.w && d.h) return { ...d, at: d.at.clone() };
  if (d?.yaw != null) return { ...fitDoor(physics, d.at ?? p.at, d.yaw, d), ...(d.column ? { column: true } : {}) };
  const m = measureDoor(physics, p.at);
  if (m) return m;
  const g = physics?.groundAt?.(p.at.x, p.at.y + 0.6, p.at.z, 3);
  const floor = Number.isFinite(g) && g > p.at.y - 3 ? g : p.at.y - 0.5;
  return { at: new THREE.Vector3(p.at.x, floor, p.at.z), yaw: 0, w: Math.max(1.2, (p.r ?? 1.4) * 1.3), h: 2.8, column: true };
}

/** A flat or curved mesh drawn only as its wash (layer 31: no camera draws it into the G-buffer). */
function washMesh(geo, parent) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  m.layers.set(31);
  m.userData.noCollide = true; m.userData.dynamic = true; m.castShadow = false;
  parent.add(m);
  m.updateMatrixWorld(true);
  return m;
}

export class Thresholds {
  /**
   * @param o.veils   the level's Veils (null: a test, the meshes alone)
   * @param o.parent  a group at the world's origin
   * @param o.portals the level's portals (src/passage.js); each one's light is its `_threshold`
   * @param o.physics to measure an opening a portal doesn't give
   */
  constructor({ veils = null, parent, portals = [], physics = null } = {}) {
    const C = THRESHOLD;
    this.group = new THREE.Group();
    this.group.name = 'Thresholds (washes)';
    parent?.add(this.group);
    this.veils = veils;
    this.list = [];
    for (const p of portals) {
      if (!p?.at || !p.to) continue;
      const door = doorOf(p, physics);
      const g = new THREE.Group();
      g.position.copy(door.at); g.rotation.y = door.yaw ?? 0;
      this.group.add(g);
      const meshes = [];
      if (door.column) {
        const r = door.w / 2;
        meshes.push([washMesh(new THREE.CylinderGeometry(r * 0.8, r, door.h, 20, 1, true).translate(0, door.h / 2, 0), g), C.color, C.alpha]);
        meshes.push([washMesh(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2).translate(0, 0.04, 0), g), C.floor, C.floorAlpha]);
      } else {
        // the veil in the opening (square to the way through), and the pool across the sill, a little each side of it
        meshes.push([washMesh(new THREE.PlaneGeometry(door.w, door.h).translate(0, door.h / 2, 0), g), C.color, C.alpha]);
        meshes.push([washMesh(new THREE.PlaneGeometry(door.w * 0.92, C.floorDepth).rotateX(-Math.PI / 2).translate(0, 0.04, 0), g), C.floor, C.floorAlpha]);
      }
      g.updateMatrixWorld(true);
      const washes = veils ? meshes.map(([m, color, alpha], i) => {
        const w = veils.add(m, { color, glow: 1, alpha, near: 0 });
        w.material.blending = THREE.AdditiveBlending;   // (light only adds: the chest light's way)
        if (i === 0) w.material.uniforms.uRays.value.set(C.rays.strength, 0, C.rays.count, C.rays.soft);
        w.userData.off = true;
        return w;
      }) : [];
      const T = { portal: p, door, group: g, meshes: meshes.map(([m]) => m), alphas: meshes.map(([, , a]) => a), washes, k: 0, flare: 0, phase: this.list.length * 1.7, on: false };
      p._threshold = T;
      this.list.push(T);
    }
  }

  /** The light of the way through nearest `point` (within `r` m), or null. */
  near(point, r = 6) {
    let best = null, bd = r;
    for (const T of this.list) { const d = T.door.at.distanceTo(point); if (d < bd) { bd = d; best = T; } }
    return best;
  }

  /** Going through `portal`: its veil flares. */
  flare(portal) { const T = portal?._threshold; if (T) { T.flare = 1; T.k = Math.max(T.k, 0.6); } return T ?? null; }

  /** Arrived at `point` (the far side): the way back you came out of glows and settles. */
  arrive(point) { const T = this.near(point, 6); if (T && passable(T.portal)) { T.flare = 1; T.k = 1; } return T; }

  /** Per frame: each way's light on while it takes you and is near the eye, its rays drifting, its flare settling. */
  update(dt, t, eye = null) {
    const C = THRESHOLD;
    for (const T of this.list) {
      T.on = passable(T.portal) && (!eye || T.door.at.distanceTo(eye) < C.far);
      T.k = THREE.MathUtils.clamp(T.k + (T.on ? dt : -dt) / C.fadeIn, 0, 1);
      T.flare = Math.max(0, T.flare - dt / C.flareFade);
      const shown = T.k > 0.002;
      const swell = 1 + C.breathe * Math.sin(t * 0.9 + T.phase), flare = 1 + (C.flare - 1) * T.flare * T.flare;
      T.washes.forEach((w, i) => {
        w.userData.off = !shown;
        if (!shown) return;
        const u = w.material.uniforms;
        u.uWash.value.x = T.alphas[i] * T.k * swell * flare;
        if (i === 0) u.uRays.value.y = t * C.rays.speed + T.phase;
      });
    }
    return this;
  }

  /** How many are lit now (tests, the dev panel). */
  get lit() { return this.list.filter((T) => T.k > 0.002).length; }

  dispose() {
    for (const T of this.list) for (const w of T.washes) this.veils?.remove?.(w);
    this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.group.removeFromParent();
    this.list = [];
  }
}
