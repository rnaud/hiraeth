import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { Paint, paintMaterial, plate, spindle } from './vehicle-kit.js';
import { sweepCapsule, unbury } from './physics.js';
import { game } from './game-state.js';

// A flying cab (the City-Shaft's and the Signal Market's). Cabs drive themselves: nobody sits up
// front, a small screen on the dash speaks for the cab, and you ride seated inside it, in an open
// cabin under its striped canopy. Modes:
//   lane    follows its circular traffic lane (set by the level)
//   hail    flies to where the player whistled, then parks
//   parked  hovers in place, waiting
//   aboard  you are seated; it hovers where it is until you choose a stop (src/story/cab.js asks
//           "where to?" as you get in; SPACE / X / □ asks again)
//   route   flies itself to the stop you chose, along a path it checked was clear (planRoute),
//           then waits there (aboard) for you to get out
//   return  chases its lane again after it was left somewhere
// Cabs are excluded from the static collision (they move), but a cab on a route still sweeps
// itself against the level, and stops (and says so) if something it did not see is in the way.
//
// No pass, no cab: a cab neither answers your whistle nor lets you aboard until you carry a
// cab pass (the item `cabpass`, flag item.cabpass: Lio, the City-Shaft's dispatcher, writes it,
// src/story/incal-data.js). Until then it flies on and says why (Taxi.refusal; the City-Shaft
// names Lio). A `free` cab (Wren, the old cab that stops for anyone at its lamp) never asks.

const _v = new THREE.Vector3(), _from = new THREE.Vector3(), _a = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3(), _s = new THREE.Vector3(), _t = new THREE.Vector3();

// The cab's palette (its body takes the colour it is given)
const INK = '#34405e', CREAM = '#f3ead8', RED = '#c8483a', GLASS = '#a9d3cc', SKIN = ['#e9cfb4', '#c99a7a', '#8a5a44', '#f0d8c0'];
const COATS = ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#f3ead8', '#34405e'];
const SEAT_RED = '#a8433a', LINING = '#dcc7a4';
// the body, along +z: fat in the middle, rounded at the stern, a blunt nose
const HULL = [[0.001, -2.0], [0.5, -1.85], [0.82, -1.3], [0.9, -0.4], [0.88, 0.6], [0.72, 1.35], [0.42, 1.85], [0.001, 2.1]];
const SY = 0.55;
/** The open cabin: the hull is open on top between these z (cab units), OPEN_HALF rad either side of the top. */
export const CABIN = { z0: -0.8, z1: 0.3, half: 0.85 };
/** The striped canopy over the cabin (cab units): its posts' top, its half-width, how flat its arch, where and how long. */
export const CANOPY = { y: 1.05, r: 0.8, sy: 0.42, z: (CABIN.z0 + CABIN.z1) / 2, len: CABIN.z1 - CABIN.z0 + 0.3 };
/** The seat, in cab units: your (and a passenger's) hips on its cushion. */
export const SEAT = { y: 0.12, z: -0.45 };
/** Seat to hip joint when standing: the traveller's origin is at his feet, his hips this far up (m). */
const HIP_H = 0.9;
const rAt = (z) => {
  for (let i = 1; i < HULL.length; i++) if (z <= HULL[i][1]) { const [r0, z0] = HULL[i - 1], [r1, z1] = HULL[i]; return r0 + (r1 - r0) * (z - z0) / (z1 - z0); }
  return 0;
};
const half = (pts, phi, sy, seg = 14) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg, -phi, phi * 2).rotateX(Math.PI / 2).scale(1, sy, 1);
/** The hull's profile between z0 and z1 (cut where they fall between its points). */
const slice = (z0, z1) => {
  const pts = [[rAt(z0), z0]];
  for (const p of HULL) if (p[1] > z0 && p[1] < z1) pts.push(p);
  pts.push([rAt(z1), z1]);
  return pts.map(([r, z]) => [Math.max(r, 0.001), z]);
};

/**
 * The cab, in flat comic colours: a round-bellied body in its own colour with a checker band at
 * the waist and a navy belly, open on top in the middle: a cabin, its walls lined, a cream dash
 * with a small screen (the cab's voice) and a low windscreen in front, a striped canopy over it on
 * four posts. No one drives: a round sensor eye on the nose looks where it goes. V-fins at the
 * tail, stub wings with lamps at their tips, a "for hire" sign on the canopy and glowing hover
 * rings underneath. Its static parts are built once per colour and shared (two draw calls); the
 * seat (people-sized in a cab of any size), the moving and the lit parts are small meshes of their own.
 */
const CABS = new Map();

/** The drawn cab's top in its own units on a grid (built once: TOP.map), for its solid (Taxi.topLocal). */
const TOP = { map: null };
function cabTop() {
  const b = buildTaxi('#c8483a', { fares: false, scale: 1 });
  const meshes = [];
  b.root.updateMatrixWorld(true);
  // (what stands still on every cab: the hull and its trims, the fins; not the lamps, the seat or a passenger)
  b.root.traverse((o) => { if (o.isMesh && !b.mid.includes(o) && o !== b.seat && o !== b.pax && !(b.pax && o.parent === b.pax)) meshes.push(o); });
  const step = 0.05, x0 = -1.5, z0 = -2.15, nx = Math.round(3 / step) + 1, nz = Math.round(4.4 / step) + 1;
  const h = new Float32Array(nx * nz).fill(-1e10), rc = new THREE.Raycaster(), o = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    rc.set(o.set(x0 + i * step, 5, z0 + j * step), down); rc.far = 10;
    const hit = rc.intersectObjects(meshes, false)[0];
    if (hit) h[j * nx + i] = hit.point.y;
  }
  return (TOP.map = { x0, z0, step, nx, nz, h });
}
function cabParts(color) {
  if (CABS.has(color)) return CABS.get(color);
  const smooth = new Paint(), flat = new Paint();
  const { z0, z1, half: H } = CABIN;
  // the hull in three: the stern and the nose whole, the middle open on top (the cabin)
  smooth.add(spindle(slice(-2.0, z0), { seg: 16, sy: SY }), color, { at: [0, -0.1, 0] });
  smooth.add(spindle(slice(z1, 2.1), { seg: 16, sy: SY }), color, { at: [0, -0.1, 0] });
  smooth.add(half(slice(z0, z1), Math.PI - H, SY, 16), color, { at: [0, -0.1, 0] });
  // its lining, a little inside (seen from in the cabin), and the floor of the well
  smooth.add(half(slice(z0, z1).map(([r, z]) => [r * 0.95, z]), Math.PI - H, SY, 12), LINING, { at: [0, -0.1, 0] });
  smooth.add(half(HULL.map(([r, z]) => [r * 1.02, z * 1.005]), 0.75, SY * 1.02), INK, { at: [0, -0.1, 0] });
  // the bulkheads closing the cabin fore and aft: the front one is the dash
  for (const [z, c, turn] of [[z0, INK, 0], [z1, CREAM, Math.PI]]) {
    smooth.add(new THREE.CircleGeometry(rAt(z) * 0.99, 18), c, { at: [0, -0.1, z], rot: [0, turn, 0], scale: [1, SY, 1] });
  }
  // the cabin's rim: a cream piping along both edges of the opening
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const z = z0 + (z1 - z0) * (i / 6), r = rAt(z) * 1.01;
      pts.push(new THREE.Vector3(side * r * Math.sin(H), r * Math.cos(H) * SY - 0.1, z));
    }
    flat.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.035, 4, false), CREAM);
  }
  // the checker band round the waist
  for (const side of [-1, 1]) {
    for (let i = 0; i < 15; i++) {
      const z = -1.5 + i * 0.22, r = rAt(z), r2 = rAt(z + 0.05) - rAt(z - 0.05);
      flat.add(new THREE.BoxGeometry(0.04, 0.16, 0.22), i % 2 ? INK : CREAM, { at: [side * (r + 0.005), -0.08, z], rot: [0, side * Math.atan2(r2, 0.1), 0] });
    }
  }
  // the nose cap and the bumper ring
  smooth.add(new THREE.SphereGeometry(0.3, 10, 6), CREAM, { at: [0, -0.12, 1.98], scale: [1.1, 0.7, 0.6] });
  smooth.add(new THREE.TorusGeometry(0.45, 0.05, 4, 16), INK, { at: [0, -0.1, 1.82], scale: [1, SY * 1.1, 1] });
  // a low windscreen just ahead of the cabin; the sensor eye's housing on the nose
  smooth.add(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 8, 1, true, -0.85, 1.7), GLASS, { at: [0, 0.47, -0.08], rot: [-0.3, 0, 0] });
  flat.add(new THREE.TorusGeometry(0.62, 0.03, 3, 10, 1.7), INK, { at: [0, 0.59, -0.05], rot: [Math.PI / 2 - 0.3, 0, Math.PI / 2 - 0.85] });
  smooth.add(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), INK, { at: [0, 0.27, 1.35], scale: [1, 0.75, 1] });
  // the canopy over the cabin on four posts, in red and cream stripes
  const cz = CANOPY.z, cl = CANOPY.len, CY = CANOPY.y;
  for (const x of [-0.62, 0.62]) for (const z of [z0 - 0.06, z1 + 0.06]) {
    const r = rAt(z), foot = Math.sqrt(Math.max(0, 1 - (x / r) ** 2)) * r * SY - 0.12;
    flat.add(new THREE.CylinderGeometry(0.025, 0.025, CY - foot, 4), INK, { at: [x, (CY + foot) / 2, z] });
  }
  const BANDS = 7;
  for (let i = 0; i < BANDS; i++) {
    const t0 = Math.PI / 2 + (i / BANDS) * Math.PI;
    smooth.add(new THREE.CylinderGeometry(0.8, 0.8, cl, 3, 1, true, t0, Math.PI / BANDS).rotateX(Math.PI / 2), i % 2 ? CREAM : RED, { at: [0, CY, cz], scale: [1, 0.42, 1] });
  }
  // a scalloped valance along the canopy's sides
  const n = 6;
  for (const side of [-1, 1]) for (let i = 0; i < n; i++) flat.add(new THREE.ConeGeometry(0.09, 0.14, 3), i % 2 ? CREAM : RED, { at: [side * 0.8, CY - 0.07, cz - cl / 2 + (i + 0.5) * cl / n], rot: [Math.PI, 0, 0] });
  // stub wings, the sign's base, and the hover rings' mounts
  for (const side of [-1, 1]) flat.add(plate([[0, -0.2], [0.55, -0.05], [0.55, 0.12], [0, 0.25]], 0.06), color, { at: [side * 0.85, -0.05, -0.25], rot: [Math.PI / 2, 0, side > 0 ? 0 : Math.PI], scale: [1, 1, 1] });
  flat.add(new THREE.BoxGeometry(0.62, 0.06, 0.16), INK, { at: [0, CY + 0.36, cz] });
  const tail = new Paint();
  for (const side of [-1, 1]) {
    tail.add(plate([[0, 0], [0.4, 0], [0.62, 0.72], [0.4, 0.75]], 0.05).rotateY(Math.PI / 2), color, { at: [side * 0.2, 0, 0], rot: [0, 0, side * 0.55] });
    tail.add(plate([[0.5, 0.45], [0.62, 0.72], [0.4, 0.75], [0.36, 0.5]], 0.07).rotateY(Math.PI / 2), RED, { at: [side * 0.2, 0, 0], rot: [0, 0, side * 0.55] });
  }
  // what glows: the headlamps, the hover rings, the sensor eye and the dash's screen (always); the sign
  // and the wing-tip lamps (for hire)
  const glow = mergeGeometries([
    ...[-0.32, 0.32].map((x) => new THREE.CircleGeometry(0.11, 10).translate(x, 0.02, 1.95).toNonIndexed()),
    ...[-1.0, 1.0].map((z) => new THREE.TorusGeometry(0.42, 0.06, 3, 12).rotateX(Math.PI / 2).translate(0, -0.62, z).toNonIndexed()),
    new THREE.SphereGeometry(0.075, 8, 5).translate(0, 0.33, 1.42).toNonIndexed(),
    new THREE.PlaneGeometry(0.34, 0.12).rotateY(Math.PI).rotateX(0.25).translate(0, 0.2, z1 - 0.012).toNonIndexed(),
  ].map((g) => { g.deleteAttribute('uv'); return g; }));
  const lamps = mergeGeometries([
    new THREE.BoxGeometry(0.52, 0.2, 0.1).translate(0, CY + 0.5, cz).toNonIndexed(),
    ...[-1, 1].map((side) => new THREE.SphereGeometry(0.07, 6, 4).translate(side * 1.42, -0.04, -0.2).toNonIndexed()),
  ]);
  const parts = { smooth: smooth.geometry(), flat: flat.geometry(), tail: tail.geometry(), glow, lamps };
  CABS.set(color, parts);
  return parts;
}

/**
 * The seat, people-sized (metres), its origin at the hips on the cushion: the cushion and a tall
 * back in red, a navy base down to the floor of the well, and a footrest where seated feet rest.
 * Drawn at 1 / the cab's scale, so it fits you in a cab of any size.
 */
let SEAT_GEO = null;
function seatGeometry() {
  if (SEAT_GEO) return SEAT_GEO;
  const p = new Paint();
  p.add(new THREE.BoxGeometry(1.0, 0.12, 0.52), SEAT_RED, { at: [0, -0.07, -0.04] });
  p.add(new THREE.BoxGeometry(1.0, 0.62, 0.1), SEAT_RED, { at: [0, 0.28, -0.33], rot: [-0.14, 0, 0] });
  p.add(new THREE.CylinderGeometry(0.06, 0.06, 1.04, 6).rotateZ(Math.PI / 2), CREAM, { at: [0, 0.6, -0.38] });
  p.add(new THREE.BoxGeometry(0.86, 0.4, 0.44), INK, { at: [0, -0.33, -0.06] });
  p.add(new THREE.BoxGeometry(1.1, 0.05, 0.5), INK, { at: [0, -0.52, 0.42] });
  for (const x of [-0.55, 0.55]) p.add(new THREE.BoxGeometry(0.1, 0.1, 0.5), CREAM, { at: [x, 0.12, -0.05] });
  return (SEAT_GEO = p.geometry());
}

/**
 * A seated passenger in a hat, one vertex-coloured mesh, its origin at the hips. Built a metre
 * from seat to crown and drawn at FIGURE_H of it, divided by the cab's scale: people are
 * people-sized in a cab of any size.
 */
export const FIGURE_H = 0.9;   // seat to crown, in metres (the traveller, seated, is ~0.9)
function figure({ coat, skin, hat }) {
  const p = new Paint();
  p.add(new THREE.CapsuleGeometry(0.21, 0.3, 2, 7), coat, { at: [0, 0.36, 0] });
  p.add(new THREE.SphereGeometry(0.16, 8, 6), skin, { at: [0, 0.84, 0.02] });
  if (hat) {
    p.add(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 12), hat, { at: [0, 0.96, 0] });
    p.add(new THREE.ConeGeometry(0.13, 0.24, 10), hat, { at: [0, 1.08, 0] });
  }
  return p.mesh({ smooth: true });
}

function buildTaxi(color, { fares = true, scale = 1 } = {}) {
  const P = cabParts(color);
  const grp = new THREE.Group();
  const body = new THREE.Mesh(P.smooth, paintMaterial({ smooth: true, side: THREE.DoubleSide, metal: 'painted' }));
  const trim = new THREE.Mesh(P.flat, paintMaterial({ metal: 'painted' }));
  const tail = new THREE.Group();
  tail.position.set(0, 0.2, -1.7);
  tail.add(new THREE.Mesh(P.tail, paintMaterial({ metal: 'painted' })));
  const glow = new THREE.Mesh(P.glow, makeMaterial({ color: '#fff3c4', glow: 1, flat: true }));
  const lamps = new THREE.Mesh(P.lamps, makeMaterial({ color: '#f6c84e', glow: 1, flat: true }));
  const k = 1 / scale;
  const seat = new THREE.Mesh(seatGeometry(), paintMaterial({ metal: 'painted' }));
  seat.scale.setScalar(k);
  seat.position.set(0, SEAT.y, SEAT.z);
  grp.add(body, trim, tail, glow, lamps, seat);
  const rnd = Math.random;
  // a passenger in the seat, now and then (human-sized whatever the cab's scale: FIGURE_H / scale)
  let pax = null;
  if (fares && rnd() < 0.6) {
    const coat = COATS[Math.floor(rnd() * COATS.length)];
    pax = figure({ coat, skin: SKIN[Math.floor(rnd() * SKIN.length)], hat: rnd() < 0.6 ? coat : null });
    pax.scale.setScalar(FIGURE_H * k);
    pax.position.set(0, SEAT.y, SEAT.z);
    grp.add(pax);
  }
  grp.traverse((o) => { o.userData.noCollide = true; });
  return { root: grp, tail, glow, lamps, seat, pax, near: [tail, seat, pax].filter(Boolean), mid: [glow, lamps] };
}

/** The cab as a still model (no physics, no lane), at its scale: the References' panels draw the game's own cab. */
export function cabModel(color, scale = 1, { fares = true } = {}) {
  const b = buildTaxi(color, { fares, scale });
  b.root.scale.setScalar(scale);
  return b.root;
}

/** The cab pass's item id (quests.give: a flag item.cabpass; src/items.js lists it in the gear). */
export const CAB_PASS = 'cabpass';
/** What a cab says when it won't stop for you, by what you tried: hailing it, or getting in. */
export const PASS_REFUSAL = {
  hail: 'The cab slides past without slowing. A card in its window reads: PASS HOLDERS ONLY.',
  board: 'The little screen on the dash blinks: PASS HOLDERS ONLY. No pass, no ride.',
};

// ---------------------------------------------------------------- the autopilot's path
/** How fast a cab flies itself (m/s), and how hard it speeds up and slows down (m/s²). */
export const ROUTE = { speed: 38, accel: 14, brake: 10, arrive: 0.5, stuck: 2.5 };

/**
 * Is the straight flight from a to b clear for a cab of radius r? Five rays: the centre, either
 * side, above and a little below (the hull's belly sits lower than its middle).
 */
export function clearPath(physics, a, b, r) {
  if (!physics?.rayDistance) return true;
  _d.subVectors(b, a);
  const len = _d.length();
  if (len < 1e-3) return true;
  _d.divideScalar(len);
  // across the way (level), and its other side (up, for a level flight)
  _s.set(-_d.z, 0, _d.x);
  if (_s.lengthSq() < 1e-6) _s.set(1, 0, 0);
  _s.normalize();
  _t.crossVectors(_s, _d).normalize();
  if (_t.y < 0) _t.negate();
  for (const [sx, sy] of [[0, 0], [1, 0], [-1, 0], [0, 0.8], [0, -0.45]]) {
    _o.copy(a).addScaledVector(_s, sx * r).addScaledVector(_t, sy * r);
    if (physics.rayDistance(_o, _d, len + r) < len + r * 0.5) return false;
  }
  return true;
}

/** The first of the candidate paths (lists of points) that is clear all along (clearPath), or null. */
export function planRoute(physics, candidates, r) {
  for (const pts of candidates) {
    let ok = pts.length > 1;
    for (let i = 1; ok && i < pts.length; i++) ok = clearPath(physics, pts[i - 1], pts[i], r);
    if (ok) return pts;
  }
  return null;
}

/**
 * Paths up to a cruising height, across and down to the stop (by its approach, if it has one),
 * trying each height in turn (none given: a little and a lot above the higher end), then straight.
 */
export function cruiseRoutes(heights = null) {
  return (from, stop) => {
    const to = stop.at, out = stop.approach ?? to, top = Math.max(from.y, to.y);
    const list = [];
    for (const y of heights ?? [top + 8, top + 25]) {
      list.push([from.clone(), new THREE.Vector3(from.x, y, from.z), new THREE.Vector3(out.x, y, out.z), out.clone(), to.clone()]);
    }
    list.push([from.clone(), out.clone(), to.clone()]);
    return list;
  };
}
/** The paths a cab tries when its world says nothing. */
export const defaultRoutes = cruiseRoutes();

export class Taxi {
  // set by the level each frame so idle taxis don't leave while you're beside them
  static playerPos = null;
  /** Do you carry a cab pass? */
  static hasPass = () => !!game.flag(`item.${CAB_PASS}`);
  /** The refusal's words ({ taxi, how: 'hail' | 'board' }); a world may set its own. */
  static refusal = ({ how }) => PASS_REFUSAL[how] ?? PASS_REFUSAL.hail;
  /** Called on a refusal (taxi, how): the City-Shaft starts the pass's errand. */
  static onRefuse = null;
  /** The paths a cab may fly from `from` to `stop` (the world's own: the City-Shaft's go round its shaft). */
  static routes = defaultRoutes;

  /**
   * @param lane  (t, taxi) => void, writes taxi.pos / heading / bank / pitch
   * @param fares false: a cab that never carries anyone but you (Wren)
   * @param free  true: it stops for you with or without a pass (Wren)
   */
  constructor(physics, color, scale, lane, { fares = true, free = false } = {}) {
    this.physics = physics;
    this.kind = 'taxi';
    this.free = free;
    this.color = color;
    const b = buildTaxi(color, { fares, scale });
    this.object = b.root;
    this.parts = b;
    this.time = Math.random() * 10;
    this.scale = scale;
    this.object.scale.setScalar(scale);
    this.lane = lane;
    this.mode = 'lane';
    // a passenger aboard (shown in traffic only): a cab that comes when you call is free, its seat yours
    this.fare = !!b.pax;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.yawRate = 0;
    this.vy = 0;
    this.bank = 0;
    this.pitch = 0;
    // the ride camera's view (CameraRig.follow): from beside and behind, a little above, closer than a bike's
    this.shot = { side: 1.05, boost: 0.5, pitch: 0.1 };
    this.boardDistance = 3 + 2.2 * scale;
    this.exitOffset = 1.6 * scale;
    this.routes = null;      // (from, stop, taxi) => candidate paths: its world's (the City-Shaft's go round the shaft), else Taxi.routes
    this.route = null;       // { stop, pts, i, stuckT } while it flies you somewhere
    this.stop = null;        // the stop it waits at (aboard, arrived): where you step out
    this.asking = false;     // you've just got in (or pressed SPACE / X / □): src/story/cab.js asks where to
    this.arrivals = 0;       // counts the stops it has reached (the ride's cue shows again on each)
    this.onArrive = null;    // (taxi, stop) => void, src/story/cab.js: the cab says where you are
    this.onBlocked = null;   // (taxi, stop, why: 'none' | 'stuck') => void
    this._push = new THREE.Vector3();
    this._prev = new THREE.Vector3();
  }

  get forward() {
    return [Math.sin(this.heading), Math.cos(this.heading)];
  }

  /** How wide the cab is, for its clearance (m). */
  get radius() { return 1.5 * this.scale; }

  /**
   * No pass, no cab: true when it won't stop for you (or take you aboard), and then, now and
   * again, the refusal as a notice to `who` (the player). False for a free cab, or with a pass.
   */
  refuses(who = null, how = 'hail') {
    if (this.free || Taxi.hasPass()) return false;
    const now = Date.now();
    if (now - (Taxi._refusedAt ?? -1e9) > 3500) {
      Taxi._refusedAt = now;
      who?.notice?.(Taxi.refusal({ taxi: this, how }));
      Taxi.onRefuse?.(this, how);
    }
    return true;
  }

  hail(playerPos, playerHeading) {
    if (this.mode === 'aboard' || this.mode === 'route' || !(this.free || Taxi.hasPass())) return;
    this.fare = false;   // it's coming for you: no one else aboard
    // stop beside the player, slightly above, facing the same way
    const fx = Math.sin(playerHeading), fz = Math.cos(playerHeading);
    this.target = new THREE.Vector3(playerPos.x + fz * 4 + fx * 3, playerPos.y + 1.2 * this.scale, playerPos.z - fx * 4 + fz * 3);
    this.targetHeading = playerHeading;
    this.stop = null;
    this.mode = 'hail';
  }

  /** You get in (from where you stood): seated, it waits (and asks where to). */
  board(from = null) {
    // (where you stood, if you stood beside it: you step back out there if it goes nowhere)
    this.boardedAt = from?.isVector3 && from.distanceTo(this.pos) < this.boardDistance + 2 ? from.clone() : null;
    this.boardedPos = this.pos.clone();
    this.mode = 'aboard';
    this.speed = 0;
    this.parkY = this.pos.y;
    this.route = null;
    this.stop = null;
    this.asking = true;
    this.boardings = (this.boardings ?? 0) + 1;
  }

  /** You got out: it waits where it is a while, then goes back to its lane. */
  leave() {
    this.mode = 'parked';
    this.parkY = this.pos.y;
    this.route = null;
    this.asking = false;
  }

  /**
   * Fly to `stop` ({ id, name, at, heading, step, approach }) along a clear path (Taxi.routes,
   * planRoute). False (and onBlocked 'none') if no path it knows is clear.
   */
  goTo(stop) {
    // the world's ways from here; failing those, the same from a little and a lot higher (a cab
    // waiting low beside a parapet first rises clear of it)
    const routes = this.routes ?? Taxi.routes;
    let pts = null;
    for (const lift of [0, 6, 15]) {
      const from = this.pos.clone().add(_v.set(0, lift, 0));
      if (lift && !clearPath(this.physics, this.pos, from, this.radius)) break;
      pts = planRoute(this.physics, routes(from, stop, this), this.radius);
      if (pts) { if (lift) pts.unshift(this.pos.clone()); break; }
    }
    if (!pts) { this.onBlocked?.(this, stop, 'none'); return false; }
    pts[0] = this.pos.clone();
    this.route = { stop, pts, i: 1, stuckT: 0, left: 0 };
    this.stop = null;
    this.mode = 'route';
    this.asking = false;
    return true;
  }

  /**
   * Where you step out while it waits: at a stop, the stop's own spot on the ground; not yet gone
   * anywhere, back where you got in. Null on the way (you jump off: player.jumpOff).
   */
  exitAt() {
    if (this.mode !== 'aboard') return null;
    const S = this.stop;
    if (S?.step && this.pos.distanceTo(S.at) < 3) return S.step.clone();
    if (this.boardedAt && this.boardedPos && this.pos.distanceTo(this.boardedPos) < 3) return this.boardedAt.clone();
    return null;
  }

  seatTransform(pos, quat) {
    const s = this.scale;
    _v.set(0, SEAT.y - HIP_H / s, SEAT.z); // the passenger's feet (hips on the seat's cushion), in taxi-local units
    pos.copy(_v).applyMatrix4(this.object.matrixWorld);
    quat.copy(this.object.quaternion);
  }

  /**
   * The cab's moving details: the tail fins trim into turns, the "for hire" lamps are lit while
   * it's free (blinking while it waits for you) and dark while you ride. A passenger rides only in
   * traffic: a cab that answers your call (or Wren, coming to its lamp) comes empty, and one back
   * in its lane picks up a new fare out of sight. Far away only its painted body is drawn.
   */
  animate(dt) {
    const P = this.parts;
    this.time += dt;
    let dh = this.heading - (this._lastHeading ?? this.heading);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = this.heading;
    const turn = THREE.MathUtils.clamp(dt > 0 ? dh / dt : 0, -1.5, 1.5);
    this._turn = (this._turn ?? 0) + (turn - (this._turn ?? 0)) * (1 - Math.exp(-4 * dt));
    // (levels of detail: the glow and the lamps from mid range, the fins, the seat and the people up close)
    const d2 = Taxi.playerPos ? Taxi.playerPos.distanceToSquared(this.pos) : 0, s = this.scale;
    const far = d2 > (60 + 15 * s) ** 2;
    for (const o of P.mid) o.visible = d2 < (110 + 25 * s) ** 2;
    for (const o of P.near) o.visible = !far;
    if (this.mode !== 'lane') this.fare = false;
    else if (far && P.pax) this.fare = true;
    if (P.pax) P.pax.visible = !far && this.fare;
    if (far) return;
    P.tail.rotation.set(Math.sin(this.time * 1.7) * 0.04, -this._turn * 0.3, 0);
    const waiting = this.mode === 'parked' || this.mode === 'hail';
    const ridden = this.mode === 'aboard' || this.mode === 'route';
    P.lamps.visible &&= !ridden && !this.fare && (!waiting || Math.sin(this.time * 6) > -0.3);   // (not for hire with a fare aboard)
  }

  update(dt, input, t) {
    this._prev.copy(this.pos);
    if (this.mode === 'parked') this.idle = (this.idle ?? 0) + dt; else this.idle = 0;
    // left parked long enough with nobody nearby: fly back into traffic
    const near = Taxi.playerPos && Taxi.playerPos.distanceTo(this.pos) < 25;
    if (this.mode === 'parked' && this.idle > 30 && !near) this.mode = 'return';
    // seated: SPACE (X / □ on a pad) asks where to again, at a stop or on the way
    const ask = !!input?.Space;
    if (ask && !this._askHeld && (this.mode === 'aboard' || this.mode === 'route')) this.asking = true;
    this._askHeld = ask;
    if (this.mode === 'route') this.fly(dt);
    else if (this.mode === 'lane') this.lane(t, this);
    else if (this.mode === 'hail') this.flyToTarget(dt);
    else if (this.mode === 'return') this.returnToLane(dt, t);
    else {
      // parked, or waiting with you aboard: hover in place
      this.speed *= Math.exp(-2 * dt);
      this.bank *= Math.exp(-3 * dt);
      this.pitch *= Math.exp(-3 * dt);
      this.pos.y = (this.parkY ?? this.pos.y) + Math.sin(t * 1.3) * 0.15;
    }
    if (dt > 0) this.vel.subVectors(this.pos, this._prev).divideScalar(dt);
    this.object.position.copy(this.pos);
    this.object.rotation.set(this.pitch, this.heading, this.bank, 'YXZ');
    this.object.updateMatrixWorld();
    this.animate(dt);
  }

  /**
   * The autopilot: along the route's points, speeding up to ROUTE.speed and slowing down for the
   * stop; facing the way it flies (a climb or a drop keeps the heading it had), turning to the
   * stop's own heading as it comes in. It sweeps itself against the level as it goes: held up by
   * something it did not see, it stops where it is and says so (onBlocked 'stuck').
   */
  fly(dt) {
    const R = this.route, s = this.scale;
    const last = R.pts.length - 1;
    // what is left of the way: to the next point, then the rest of the polyline
    let left = this.pos.distanceTo(R.pts[R.i]);
    for (let k = R.i; k < last; k++) left += R.pts[k].distanceTo(R.pts[k + 1]);
    const want = Math.min(ROUTE.speed, Math.sqrt(2 * ROUTE.brake * left) + 0.6);
    this.speed = want > this.speed ? Math.min(want, this.speed + ROUTE.accel * dt) : want;
    let move = this.speed * dt;
    const from = _from.copy(this.pos);
    while (move > 0 && R.i <= last) {
      _a.subVectors(R.pts[R.i], this.pos);
      const d = _a.length();
      if (d <= move) { this.pos.copy(R.pts[R.i]); move -= d; R.i++; }
      else { this.pos.addScaledVector(_a, move / d); move = 0; }
    }
    // heading: along a level stretch; into the stop's own on the way in
    const seg = R.pts[Math.min(R.i, last)], prev = R.pts[Math.max(0, Math.min(R.i, last) - 1)];
    _a.subVectors(seg, prev);
    const flatLen = Math.hypot(_a.x, _a.z);
    let face = this.heading;
    if (flatLen > 0.35 * _a.length() && flatLen > 1) face = Math.atan2(_a.x, _a.z);
    if (left < 14 * s && R.stop.heading != null) face = R.stop.heading;
    let dh = face - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const turn = dh * (1 - Math.exp(-2.5 * dt));
    this.heading += turn;
    this.yawRate = dt > 0 ? turn / dt : 0;
    this.vy = dt > 0 ? (this.pos.y - from.y) / dt : 0;
    // the level: swept, so a fast frame can't jump through anything it did not see
    if (this.physics?.pushCapsule && sweepCapsule(this.physics, this.pos, from, 1.1 * s, -0.6 * s, 0.9 * s, this._push)) {
      if (this.physics.embedded?.(this.pos)) unbury(this, from, 1.1 * s);
    }
    const k = 1 - Math.exp(-4 * dt);
    this.bank += (THREE.MathUtils.clamp(-this.yawRate * this.speed * 0.012, -0.25, 0.25) - this.bank) * k;
    this.pitch += (THREE.MathUtils.clamp(-this.vy * 0.008, -0.14, 0.14) - this.pitch) * k;
    // held up: no headway for a while
    const made = this.pos.distanceTo(from), meant = Math.max(this.speed * dt, 1e-6);
    R.stuckT = made < meant * 0.25 && this.speed > 2 ? R.stuckT + dt : 0;
    if (R.stuckT > ROUTE.stuck) {
      this.route = null; this.mode = 'aboard'; this.parkY = this.pos.y; this.speed = 0;
      this.onBlocked?.(this, R.stop, 'stuck');
      return;
    }
    if (R.i > last || this.pos.distanceTo(R.stop.at) < ROUTE.arrive) {
      this.pos.copy(R.stop.at);
      this.route = null;
      this.mode = 'aboard';
      this.parkY = this.pos.y;
      this.speed = 0;
      this.stop = R.stop;
      this.arrivals++;
      this.onArrive?.(this, R.stop);
    }
  }

  /** Chase where the lane would put us now; rejoin traffic when caught up. */
  returnToLane(dt, t) {
    const ghost = this._ghost ??= { pos: new THREE.Vector3(), heading: 0, bank: 0, pitch: 0 };
    this.lane(t, ghost);
    _v.subVectors(ghost.pos, this.pos);
    const d = _v.length();
    if (d < 2) { this.mode = 'lane'; return; }
    this.pos.addScaledVector(_v.normalize(), Math.min(Math.max(30, d * 0.8) * dt, d));
    let dh = (d > 20 ? Math.atan2(_v.x, _v.z) : ghost.heading) - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-3 * dt));
    this.bank = THREE.MathUtils.clamp(-dh * 0.6, -0.4, 0.4);
    this.pitch = -_v.y * 0.3;
  }

  /**
   * Solid for characters (src/carriers.js): the cab as drawn, closely and cheaply, where the
   * cylinder it was had its top at the canopy's crest all round (you stood 1.4 m over the nose):
   * its top (topAt) is the hull's spindle, the canopy's arch over the cabin and the sign on it, and
   * a character beside it is pushed out of the hull's outline (pushOut). The seated rider is not
   * pushed (Player leaves out the vehicle it rides). r: the radius it all fits in.
   */
  get solid() {
    const s = this.scale, d = (this._solid ??= {
      pos: this.pos, vel: this.vel, r: 2.15, top: 0, bottom: 0,
      topAt: (x, z) => this.topAt(x, z), pushOut: (p, r) => this.pushOut(p, r),
    });
    d.r = 2.15 * s; d.top = this.pos.y + (CANOPY.y + 0.6) * s; d.bottom = this.pos.y - 0.6 * s;
    return d;
  }

  /**
   * The cab's top in its own units at (lx, lz), or -Infinity off it: read from TOP, the drawn cab's
   * own top (its hull, canopy, sign, windscreen, fins and wings, rays straight down the built model
   * once), so you stand on what is drawn to a few centimetres.
   */
  static topLocal(lx, lz) {
    const T = TOP.map ?? cabTop();
    const fx = (lx - T.x0) / T.step, fz = (lz - T.z0) / T.step;
    if (fx < 0 || fz < 0 || fx > T.nx - 1 || fz > T.nz - 1) return -Infinity;
    const ix = Math.min(Math.floor(fx), T.nx - 2), iz = Math.min(Math.floor(fz), T.nz - 2), u = fx - ix, v = fz - iz;
    const h = (i, j) => T.h[j * T.nx + i];
    const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
    // (across an edge, where a corner is off the cab or a cliff down from the canopy, the nearest corner's: no blending into the air)
    if (!(a > -1e9 && b > -1e9 && c > -1e9 && d > -1e9) || Math.max(a, b, c, d) - Math.min(a, b, c, d) > 0.25) { const n = h(Math.round(fx), Math.round(fz)); return n > -1e9 ? n : -Infinity; }
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  /** Height of the cab's top over world (x, z), as it is posed now (pitched and banked), or -Infinity. */
  topAt(x, z) {
    const M = this.object.matrixWorld, inv = (this._inv ??= new THREE.Matrix4()).copy(M).invert();
    // (banked or pitched, the vertical through (x, z) is not the cab's: found again at the height it meets)
    let wy = this.pos.y, y = -Infinity;
    for (let k = 0; k < 3; k++) {
      _o.set(x, wy, z).applyMatrix4(inv);
      y = Taxi.topLocal(_o.x, _o.z);
      if (!Number.isFinite(y)) return k ? wy : -Infinity;
      wy = _a.set(_o.x, y, _o.z).applyMatrix4(M).y;
    }
    return wy;
  }

  /**
   * Push a character's foot point p (radius r) out of the hull's outline (an ellipse round it) where
   * it stands lower than a step under the cab's top there. Returns whether it moved p.
   */
  pushOut(p, r) {
    const M = this.object.matrixWorld, inv = (this._inv ??= new THREE.Matrix4()).copy(M).invert();
    _o.copy(p).applyMatrix4(inv);
    const R = r / this.scale, a = 0.92 + R, b = 2.05 + R, c = 0.05;
    const qx = _o.x / a, qz = (_o.z - c) / b, q = Math.hypot(qx, qz);
    if (q >= 1 || q < 1e-6) return false;
    // (the top over the nearest point of the hull: standing on it is the carrier's business)
    const top = Taxi.topLocal(Math.sign(_o.x) * Math.min(Math.abs(_o.x), 0.98 * rAt(_o.z)), THREE.MathUtils.clamp(_o.z, -1.95, 2.05));
    if (Number.isFinite(top) && _a.set(_o.x, top, _o.z).applyMatrix4(M).y - p.y < 0.5) return false;
    _o.set((qx / q) * a, _o.y, c + (qz / q) * b).applyMatrix4(M);
    p.x = _o.x; p.z = _o.z;
    return true;
  }

  flyToTarget(dt) {
    _v.subVectors(this.target, this.pos);
    const d = _v.length();
    if (d < 0.6) {
      this.mode = 'parked';
      this.parkY = this.target.y;
      return;
    }
    const sp = Math.min(45, d * 1.2 + 4);
    this.pos.addScaledVector(_v.normalize(), Math.min(sp * dt, d));
    // face the direction of travel, turning to the player's heading on arrival
    const want = d > 15 ? Math.atan2(_v.x, _v.z) : this.targetHeading;
    let dh = want - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-3 * dt));
    this.bank = THREE.MathUtils.clamp(-dh * 0.6, -0.4, 0.4);
    this.pitch = -_v.y * 0.3;
  }
}
