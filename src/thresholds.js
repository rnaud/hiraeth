import * as THREE from 'three';
import { doorLightGeometry, doorLightMaterial, DOOR_LIGHT } from './door-light.js';

// Ways through (issue #305, the author: "Some doors/gates look weird. Leaving the skull cave it looks like it's blocked
// but it works. There should be a shader to show that I can go through. And maybe an animation showing me going through
// the portal/door."). Every doorway, cave mouth, hatch, lift door and temple door that carries you to another space
// (a level's `portals`, src/passage.js) wears its light. Since issue #391 ("it's not a very nice shader, can we do
// something nicer?") a glow filling the opening, sized and shaped to it, brightest round its frame in flat steps, the
// far side's colour faint in its middle, fading as you come close (src/door-light.js: one mesh, one draw, one program);
// a way in the open (no frame: the sinkhole, the divers' cage) keeps the veil of #305, a soft column of rays. Drawn as
// the game draws every shaft of light (src/veil.js: washes laid over the finished picture after the ink pass,
// additive), so no ink round it, no shadow, nothing to bump into. A way that won't take you yet (`when` false: the
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
  size: { w: [1.0, 5.5], h: [2.0, 5.0] },   // m: an opening measured blind (measureDoor: no way through given)
  // m: an opening whose way through is known (fitDoor), as wide and tall as doorways are drawn (a temple's 7 by 9):
  // each jamb looked for within `reach` of its middle, the lintel within `up`, the top's shape from `cols` rays up
  fit: { w: [0.8, 10], h: [1.8, 11], reach: 5.5, up: 11, cols: 8 },
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
 * An opening whose way through is known (`yaw`) fitted to the walls round `at` (issue #391: a temple's door 7 by 9 m
 * wore a veil of 2.2 by 4.2, the size it fell back to, standing in it like a cut-out): its width across between the
 * jambs, its height to the lintel and the top's shape (`top`: the height at `THRESHOLD.fit.cols` + 1 points across, an
 * arch's curve or a cave mouth's rock), and how deep its frame is (`depth`: [behind, in front] of the sill, m along the
 * way through), each unless given (`w`, `h`; `arch`: a round top of radius w/2), else `fallback`'s. A point a little out
 * of its doorway (a temple's way out, in the hall before it) finds its jambs a step or two along the way through.
 */
export function fitDoor(physics, at, yaw, { w = null, h = null, arch = false, keep = false } = {}, fallback = { w: 2.2, h: 3.2 }) {
  const F = THRESHOLD.fit, rays = !!physics?.rayDistance;
  const g = physics?.groundAt?.(at.x, at.y + 0.6, at.z, 3);
  const floor = Number.isFinite(g) && g > at.y - 3 ? g : at.y;
  const o = new THREE.Vector3(at.x, floor + 1.2, at.z), across = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const back = across.clone().negate(), mid = o.clone(), q = new THREE.Vector3();
  const jambs = (p) => { const a = physics.rayDistance(p, across, F.reach), b = physics.rayDistance(p, back, F.reach); return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null; };
  // (its hole: the narrowest slice along the way through, the nearest of the narrowest: a frame's pillars or a recess
  // round the hole are wider, and a veil hung between them stands in front of the hole. keep: `at` is the opening's own
  // sill, as its maker set it, in front of whatever shuts the way behind (a temple's dark): the veil stays on it, the
  // hole looked for within 1 m; else within 1.6 m, and the veil moved to it)
  let sAt = 0, plane = 0;
  if (w == null && rays) {
    let best = null;
    for (let k = 0; k <= (keep ? 10 : 16); k++) {
      const s = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.2, j = jambs(q.copy(o).addScaledVector(n, s));
      if (!j || j[0] + j[1] < F.w[0] || j[0] + j[1] > F.w[1]) continue;
      if (!best || j[0] + j[1] < best.w - 0.05) best = { w: j[0] + j[1], s, off: (j[0] - j[1]) / 2 };
    }
    if (best) { w = best.w; sAt = best.s; plane = keep ? 0 : best.s; mid.copy(o).addScaledVector(n, plane).addScaledVector(across, best.off); }
  }
  const W = w ?? fallback.w;
  // the frame's depth: from the slice its jambs were found at, along the way through each way while they stand (within
  // a hand's breadth more than its width: a recess, a passage), at most 3 m; [behind, in front] of the veil's plane
  let depth = null;
  const at0 = mid.clone();   // (the slice its jambs were found at: its frame, its lintel)
  if (rays) {
    at0.copy(mid).addScaledVector(n, sAt - plane);
    const reach = (sg) => {
      let d = 0;
      for (let k = 1; k <= 30; k++) { const j = jambs(q.copy(at0).addScaledVector(n, sg * k * 0.1)); if (!j || j[0] + j[1] > W + 0.3) break; d = k * 0.1; }
      return d;
    };
    if (jambs(at0)) depth = [reach(-1) - (sAt - plane), reach(1) + (sAt - plane)].map((x) => +x.toFixed(2));
  }
  // the top: rays up across the opening, a little in from each jamb (its middle the height, unless given)
  let top = null;
  if (h == null && rays) {
    top = [];
    for (let i = 0; i <= F.cols; i++) {
      const x = (i / F.cols - 0.5) * Math.max(0, W - 0.16);
      const up = physics.rayDistance(q.copy(at0).addScaledVector(across, x), _Y, F.up);
      top.push(Number.isFinite(up) ? THREE.MathUtils.clamp(1.2 + up, F.h[0], F.h[1]) : null);
    }
    const c = top[F.cols >> 1];
    h = c ?? (top.some((y) => y != null) ? Math.max(...top.filter((y) => y != null)) : 4.2);   // (no lintel within reach: a tall dark doorway)
    // (an open top, nothing over a column: the height of its neighbours; all alike: no shape of its own)
    for (let i = 0; i <= F.cols; i++) if (top[i] == null) top[i] = h;
    if (top.every((y) => Math.abs(y - h) < 0.05)) top = null;
    else top = top.map((y) => +y.toFixed(2));
  }
  const out = { at: new THREE.Vector3(mid.x, floor, mid.z), yaw, w: W, h: h ?? fallback.h };
  if (arch) out.arch = true;
  if (top) out.top = top;
  if (depth) out.depth = depth;
  return out;
}

/**
 * An opening's bottom and top (m over its sill) at x across it: its top square, round (`arch`: radius w/2), as measured
 * (`top`: heights at evenly spread points across), its corners rounded (`corner`: a radius), or a round door (`round`: a
 * disc w across whose top is at h).
 */
export function openingAt({ w, h, arch = false, top = null, round = false, corner = 0 }, x) {
  const r = w / 2, c = Math.sqrt(Math.max(0, r * r - x * x));
  if (top) {
    const f = THREE.MathUtils.clamp((x / w + 0.5) * (top.length - 1), 0, top.length - 1), i = Math.min(Math.floor(f), top.length - 2);
    return [0, top[i] + (top[i + 1] - top[i]) * (f - i)];
  }
  if (round) return [h - r - c, h - r + c];
  if (arch && h >= r) return [0, h - r + c];
  const k = Math.min(corner, r, h / 2), e = Math.abs(x) - (r - k), cut = e > 0 ? k - Math.sqrt(Math.max(0, k * k - e * e)) : 0;
  return [cut, h - cut];
}

/** The opening's sheet: its shape (openingAt) on the sill, x across, y up, uv 0..1 over its bounding box. */
export function openingGeometry(door) {
  const { w } = door, N = door.top ? door.top.length - 1 : door.arch || door.round || door.corner ? 24 : 1;
  const lo = [], hi = [];
  for (let i = 0; i <= N; i++) { const [a, b] = openingAt(door, (i / N - 0.5) * w); lo.push(a); hi.push(b); }
  const H = Math.max(...hi), B = Math.min(...lo), pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N - 0.5) * w, u = i / N;
    pos.push(x, lo[i], 0, x, hi[i], 0); uv.push(u, (lo[i] - B) / (H - B), u, (hi[i] - B) / (H - B));
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: pos.length }, (_, k) => (k % 3 === 2 ? 1 : 0)), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/**
 * The opening as a grid of points (each with its distance to the opening's edge, m) a `cell` m or so apart, and its
 * outline (up the left jamb, over the top, down the right one; a round door all round): src/door-light.js's looks.
 */
export function openingGrid(door, rows = 6, cell = 0.3) {
  const { w } = door, nx = Math.max(door.top ? door.top.length - 1 : 4, Math.ceil(w / cell)), points = [], index = [];
  let top = 0;
  const cols = [];
  for (let i = 0; i <= nx; i++) { const x = (i / nx - 0.5) * w; const [lo, hi] = openingAt(door, x); cols.push([x, lo, hi]); top = Math.max(top, hi); }
  const ny = Math.max(rows, Math.ceil(top / cell));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
    const [x, lo, hi] = cols[i], y = lo + (hi - lo) * (j / ny);
    let edge = Math.min(x + w / 2, w / 2 - x, y - lo, hi - y);
    // (and the nearest of the outline's points: an arch's or a cave's rock is near across, not only straight up)
    for (const [x2, lo2, h2] of cols) edge = Math.min(edge, Math.hypot(x - x2, y - h2), lo2 > 0.01 ? Math.hypot(x - x2, y - lo2) : Infinity);
    points.push({ x, y, u: i / nx, v: y / top, edge: Math.max(0, edge) });
    if (i < nx && j < ny) { const a = i * (ny + 1) + j, b = a + ny + 1; index.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const outline = [];
  if (door.round) {
    for (let k = 0; k <= 32; k++) { const t = (k / 32) * Math.PI * 2 + Math.PI, r = w / 2, x = Math.cos(t) * r, y = door.h - r + Math.sin(t) * r; outline.push({ x, y, u: x / w + 0.5, v: y / top }); }
  } else {
    outline.push({ x: -w / 2, y: cols[0][1], u: 0, v: 0 });
    for (const [x, , hi] of cols) outline.push({ x, y: hi, u: x / w + 0.5, v: hi / top });
    outline.push({ x: w / 2, y: cols[nx][1], u: 1, v: 0 });
  }
  return { points, index, outline, top };
}

/**
 * Which way a door is walked into from (+1: along its yaw, -1 against it): the side with a floor and room before it
 * (a room's way out has nothing outside its wall; a shop's front, its body behind), else away from the portal's point
 * (set a little through the door). A door's own `side` says it outright.
 */
export function approachSide(door, p, physics = null) {
  if (door.side) return Math.sign(door.side);   // (its maker says: `side`)
  const n = new THREE.Vector3(Math.sin(door.yaw ?? 0), 0, Math.cos(door.yaw ?? 0));
  const free = (sg) => {
    if (!physics?.rayDistance) return 0;
    const reachOut = Math.max(0, (sg > 0 ? door.depth?.[1] : door.depth?.[0]) ?? 0);
    const o = door.at.clone().addScaledVector(n, sg * (reachOut + 0.3)); o.y += 1.2;
    const f = physics.rayDistance(o, sg > 0 ? n : n.clone().negate(), 8);
    const q = door.at.clone().addScaledVector(n, sg * (reachOut + 1.5));
    const g = physics.groundAt?.(q.x, door.at.y + 1, q.z, 2.5);
    if (!Number.isFinite(g)) return 0;
    return Number.isFinite(f) ? f : 8;
  };
  const a = free(1), b = free(-1);
  if (Math.abs(a - b) > 0.8) return a > b ? 1 : -1;
  return new THREE.Vector3().subVectors(door.at, p.at).dot(n) >= 0 ? 1 : -1;
}

/** Where a portal's light hangs: its own `door` (filled in from the walls where it leaves its size out), or measured, or
 *  a column round its point. */
export function doorOf(p, physics = null) {
  const d = p.door;
  if (d?.at && d.yaw != null && d.w && d.h) return { ...d, at: d.at.clone(), ...(physics ? { depth: fitDoor(physics, d.at, d.yaw, d).depth } : {}) };
  if (d?.yaw != null) return { ...fitDoor(physics, d.at ?? p.at, d.yaw, { ...d, keep: !!d.at }), ...(d.column ? { column: true } : {}) };
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
      // (tilt: an opening leaning back from upright, a hatch in a ship's curved hull)
      g.position.copy(door.at); g.rotation.set(-(door.tilt ?? 0), door.yaw ?? 0, 0, 'YXZ');
      this.group.add(g);
      const meshes = [];
      if (!door.column) {
        const toRoom = !!p.toSpace || (!p.toUp && !p.fromSpace && !!p.temple);
        this.glowOf(p, door, g, approachSide(door, p, physics), toRoom);
        continue;
      }
      // (in the open: a soft round column of the veil's rays, and its pool)
      const r = door.w / 2;
      meshes.push([washMesh(new THREE.CylinderGeometry(r * 0.8, r, door.h, 20, 1, true).translate(0, door.h / 2, 0), g), C.color, C.alpha]);
      meshes.push([washMesh(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2).translate(0, 0.04, 0), g), C.floor, C.floorAlpha]);
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

  /** A way's light: a glow filling the opening, one mesh, one draw (src/door-light.js; issue #391). */
  glowOf(p, door, g, side, toRoom) {
    const geo = doorLightGeometry(door, side), m = washMesh(geo, g);
    g.updateMatrixWorld(true);
    let wash = null;
    if (this.veils) {
      wash = new THREE.Mesh(geo, doorLightMaterial({ far: toRoom ? DOOR_LIGHT.room : DOOR_LIGHT.sky }));
      wash.matrixAutoUpdate = false; wash.matrix.copy(m.matrixWorld); wash.matrixWorld.copy(m.matrixWorld);
      wash.frustumCulled = false; wash.userData.off = true;
      this.veils.addWash(wash, m);
    }
    const T = { portal: p, door, group: g, meshes: [m], alphas: [1], washes: wash ? [wash] : [], glow: true, side, k: 0, flare: 0, phase: this.list.length * 1.7, on: false };
    p._threshold = T;
    this.list.push(T);
    return T;
  }

  /**
   * The light of a doorway that is no portal (a fight temple's gatehouse, issue #384: its door opens a game's page):
   * door { at (the sill's middle, in the world), yaw, w, h, depth, side, room (its far side a room's lamp) }. Returns
   * its entry, and remove() takes it away again.
   */
  addDoor(door) {
    const p = { at: door.at.clone(), door }, g = new THREE.Group();
    g.position.copy(door.at); g.rotation.set(-(door.tilt ?? 0), door.yaw ?? 0, 0, 'YXZ');
    this.group.add(g);
    const T = this.glowOf(p, door, g, door.side ?? 1, door.room ?? true);
    T.remove = () => {
      const i = this.list.indexOf(T); if (i >= 0) this.list.splice(i, 1);
      for (const w of T.washes) this.veils?.remove?.(w);
      g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      g.removeFromParent();
    };
    return T;
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
        if (T.glow) { u.uDoor.value.set(T.k * swell * flare, eye ? T.door.at.distanceTo(eye) : 10, 0, 0); return; }
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
