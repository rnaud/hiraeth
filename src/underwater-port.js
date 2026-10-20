import * as THREE from 'three';
import { UW_PAL } from './levels/underwater-kit.js';

// ---------------------------------------------------------------------------
// The Underwater City's sea port and its lift (issue #572: "The ship needs to land in a spaceport above the water. then
// I take an elevator down to the underwater city"). Until then the ship set down on the Dock's dome, outside the glass,
// and its ramp let the traveller out on the dome in the sea, with no helmet and no way in.
//
//   the deck     a round coral deck on floats, three metres over the sea, railed in glass and brass all round, teal
//                lamp-columns banded in brass; the ship stands on its south half, its hatch north (the lock's columns
//                and lift plate on it: src/levels/ports.js UNDERWATER_PORT berth)
//   the lift     a glass shaft between four teal columns from the deck straight down through the sea and through the
//                Dock's crown (its oculus: underwater-kit.js bigDome) to the Dock's floor; a brass cupola over its head
//                on the deck, its door south toward the ship; its foot in the Dock, its door north toward the long tube
//   the cabin    a coral plate in the shaft that carries you (a moving solid: level.dynamic, src/carriers.js). Step on it
//                and stand: its gates close and down it goes, through the surface, the sea and the Dock's glass, in about
//                a quarter of a minute; at the other end the gate opens. Walk up to the end it isn't at and it comes.
//                A gate is shut (a solid: nobody walks into the empty shaft) while the cabin is away from its station.
//
// Pure numbers first (the run, the stations: tests/underwater-port.test.js), then the meshes (buildSeaPort).
// ---------------------------------------------------------------------------

/** The deck: its middle, its radius, its top (3 m over the sea's surface at 78). */
export const SEA_PORT = { x: 0, z: 150, r: 42, y: 81, thick: 1.2 };
/** The shaft: its axis (the Dock's middle), the glass's radius, the hole it leaves in the Dock's crown, its doors. */
export const SHAFT = { x: 0, z: 128, r: 3.6, oculus: 5.2, column: 4.5, door: { w: 2.8, h: 3.4 }, house: 4.6 };
/** The cabin: its plate's radius, its stations' heights (its top), how it runs, how long you stand before it goes. */
export const CABIN = { r: 3.3, foot: 0.3, top: SEA_PORT.y, speed: 8, accel: 2.4, board: 0.7, call: 7, clear: 3 };
/** Each station's door (its yaw from the axis: 0 is +z) and where you stand just outside it. */
export const STATIONS = {
  // (y: the cabin's top there; floor: the floor its door opens onto)
  top: { y: CABIN.top, floor: SEA_PORT.y, yaw: 0, label: 'the lift down to the city' },      // (south, toward the ship)
  foot: { y: CABIN.foot, floor: 0, yaw: Math.PI, label: 'the lift up to the sea port' },   // (north, toward the long tube)
};
/** Where the ship stands on the deck (its hatch north, toward the lift's house). */
export const PORT_SHIP = { x: 4.4, y: SEA_PORT.y, z: 164, heading: Math.PI };

/**
 * The cabin's run of `len` m, t s into it: up to `speed` at `accel`, on at speed, and down again (no jolt at either
 * end but the accel's). { s: metres along, v: m/s, T: the run's length in s, done }.
 */
export function liftRun(len, t, { speed = CABIN.speed, accel = CABIN.accel } = {}) {
  const ta = Math.min(speed / accel, Math.sqrt(len / accel)), va = accel * ta, da = 0.5 * accel * ta * ta;
  const tc = Math.max(0, (len - 2 * da) / va), T = 2 * ta + tc;
  if (t <= 0) return { s: 0, v: 0, T, done: false };
  if (t >= T) return { s: len, v: 0, T, done: true };
  if (t < ta) return { s: 0.5 * accel * t * t, v: accel * t, T, done: false };
  if (t < ta + tc) return { s: da + va * (t - ta), v: va, T, done: false };
  const u = T - t;
  return { s: len - 0.5 * accel * u * u, v: accel * u, T, done: false };
}

/** A point just outside a station's door (`out` m from the axis), at its floor. */
export function doorSpot(station, out = SHAFT.r + 1.6) {
  const S = STATIONS[station];
  return [SHAFT.x + Math.sin(S.yaw) * out, S.floor, SHAFT.z + Math.cos(S.yaw) * out];
}

/**
 * The lift: where the cabin is, its run, its gates. `update(dt, player)` each frame; `solids()` the moving solids
 * (level.dynamic): the cabin's plate, and each gate shut while the cabin is away from it.
 */
export class SeaLift {
  constructor({ at = 'top' } = {}) {
    const V = (y) => new THREE.Vector3(SHAFT.x, y, SHAFT.z);
    this.solid = { pos: V(0), r: CABIN.r, top: 0, bottom: 0, vel: new THREE.Vector3(), flat: true };
    this.gates = Object.fromEntries(Object.entries(STATIONS).map(([id, S]) => [id, {
      id, k: 1, shut: false,
      solid: { pos: V(S.y), r: SHAFT.r - 0.05, top: S.y + 3, bottom: S.y - 0.4, vel: new THREE.Vector3(), flat: true },
    }]));
    this.board = 0;      // s stood on it at rest
    this.armed = true;   // false while whoever rode it is still on it (stepped off: it may go again)
    this.run = null;     // { from, to, t, len }
    this.rides = 0;      // (how many runs with someone on it: the tests, the probes)
    this.place(at);
  }
  get moving() { return !!this.run; }
  /** At a station at once, its gate open. */
  place(station) {
    this.at = station; this.run = null; this.y = STATIONS[station].y; this.v = 0;
    for (const g of Object.values(this.gates)) g.k = g.id === station ? 1 : 0;
    this.sync();
  }
  /** Is p standing on the cabin? */
  carries(p) {
    if (!p?.pos) return false;
    return Math.hypot(p.pos.x - SHAFT.x, p.pos.z - SHAFT.z) < CABIN.r + 0.3 && Math.abs(p.pos.y - this.y) < 0.7 && !!p.onGround;
  }
  /** Is p by a station's door, outside the shaft (to call the cabin there)? */
  near(p, station) {
    const S = STATIONS[station], d = Math.hypot(p.pos.x - SHAFT.x, p.pos.z - SHAFT.z);
    return d > CABIN.r && d < CABIN.call && Math.abs(p.pos.y - S.y) < 3;
  }
  go(to, rider) {
    const from = this.at;
    if (to === from) return;
    this.run = { from, to, t: 0, len: Math.abs(STATIONS[to].y - STATIONS[from].y), dir: Math.sign(STATIONS[to].y - STATIONS[from].y) };
    this.at = null;
    this.board = 0;
    if (rider) { this.rides++; this.armed = false; }
    this.onStart?.(from, to, rider);
  }
  update(dt, p) {
    // (the first frame: the cabin waits at the end nearer whoever is there, the ship's deck or the Dock)
    if (!this.placed && p?.pos) { this.placed = true; this.place(p.pos.y > SEA_PORT.y / 2 ? 'top' : 'foot'); }
    if (this.run) {
      const R = this.run;
      R.t += dt;
      const r = liftRun(R.len, R.t);
      this.y = STATIONS[R.from].y + R.dir * r.s;
      this.v = R.dir * r.v;
      if (r.done) { this.at = R.to; this.run = null; this.v = 0; this.onArrive?.(R.to); }
    } else if (p) {
      const on = this.carries(p);
      if (!on) this.armed = true;
      if (on && this.armed) {
        this.board += dt;
        if (this.board >= CABIN.board) this.go(this.at === 'top' ? 'foot' : 'top', true);
      } else {
        this.board = 0;
        const other = this.at === 'top' ? 'foot' : 'top';
        if (!on && this.near(p, other)) this.go(other, false);
      }
    }
    // the gates: open at the cabin's station, shut (and solid) once it is `clear` m away from theirs
    for (const g of Object.values(this.gates)) {
      const open = !this.run && this.at === g.id;
      g.k += ((open ? 1 : 0) - g.k) * Math.min(1, dt * 3);
      if (open && g.k > 0.999) g.k = 1;
      g.shut = !open && Math.abs(this.y - STATIONS[g.id].y) > CABIN.clear;
    }
    this.sync();
  }
  sync() {
    const s = this.solid;
    s.pos.y = this.y; s.top = this.y; s.bottom = this.y - 0.5; s.vel.set(0, this.v, 0);
  }
  /** The moving solids for the player (level.dynamic). */
  solids() { return [this, ...Object.values(this.gates).filter((g) => g.shut)]; }
}

// ------------------------------------------------------------------ the meshes
const NS = { solid: false, shadow: false }, SOLID = { solid: true, shadow: true };
const TAU = Math.PI * 2;

/**
 * The sea port and the lift's shaft in the world (kit: the city's RoomKit; M its materials). `dockTop` the height of
 * the Dock's oculus (the shaft's glass runs from the Dock's floor through it). Returns { lift, air(x, y, z), meshes,
 * update(dt, player), beacon }.
 */
export function buildSeaPort(kit, M, { seaY, dockTop }) {
  const P = SEA_PORT, S = SHAFT, deckY = P.y;
  const brass = kit.mat({ color: '#c8a24e', metal: 'painted' });
  const coral = kit.mat({ color: '#e2806e', flat: true, grid: 3, weathered: 0.2 });
  const coralSide = kit.mat({ color: '#c96f5e', flat: true, weathered: 0.3 });
  const float = kit.mat({ color: '#f0aa98', flat: true, weathered: 0.25, shadeHue: 0.5 });
  const teal = kit.mat({ color: '#8fcabb', flat: true });
  const band = kit.mat({ color: '#5aa59a', flat: true });
  const glass = (cx, cy, cz) => kit.mat({ color: UW_PAL.domeGlass, glass: true, glassCenter: new THREE.Vector3(cx, cy, cz), line: 0.5, lineTint: 0.7, side: THREE.DoubleSide });

  // ---- the deck: a coral slab on floats, the shaft's hole in it
  {
    const shape = new THREE.Shape().absarc(0, 0, P.r, 0, TAU, false);
    shape.holes.push(new THREE.Path().absarc(S.x - P.x, -(S.z - P.z), S.r, 0, TAU, true));
    const slab = new THREE.ExtrudeGeometry(shape, { depth: P.thick, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2);
    // (rotateX(-π/2) takes the shape's (x, y) to (x, -z) and its depth up: the slab from deckY - thick to deckY)
    kit.add(coral, slab.translate(P.x, deckY - P.thick, P.z), SOLID);
    // its edge: a coral lip under a brass rim, and the floats round under it, half in the water, on brass legs
    kit.add(coralSide, new THREE.CylinderGeometry(P.r + 0.25, P.r - 0.6, 1.4, 64, 1, true).translate(P.x, deckY - P.thick - 0.5, P.z), NS);
    kit.add(brass, new THREE.TorusGeometry(P.r + 0.1, 0.16, 5, 72).rotateX(Math.PI / 2).translate(P.x, deckY + 0.02, P.z), NS);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.1, fx = P.x + Math.sin(a) * (P.r - 4.5), fz = P.z + Math.cos(a) * (P.r - 4.5);
      kit.add(float, new THREE.SphereGeometry(3.6, 16, 10).scale(1, 0.5, 1).translate(fx, seaY + 0.4, fz), NS);
      kit.add(brass, new THREE.TorusGeometry(3.55, 0.14, 4, 24).rotateX(Math.PI / 2).translate(fx, seaY + 0.5, fz), NS);
      kit.add(brass, new THREE.CylinderGeometry(0.22, 0.3, deckY - P.thick - seaY - 1.1, 6).translate(fx, (deckY - P.thick + seaY + 1.1) / 2, fz), NS);
    }
    // the paint on the deck: a teal band round the ship's berth and a brass ring round the lift's house
    kit.add(band, new THREE.RingGeometry(21, 22.2, 72).rotateX(-Math.PI / 2).translate(PORT_SHIP.x, deckY + 0.03, PORT_SHIP.z), NS);
    kit.add(brass, new THREE.RingGeometry(S.house + 1.6, S.house + 2.0, 48).rotateX(-Math.PI / 2).translate(S.x, deckY + 0.03, S.z), NS);
    // a path of teal studs from the ramp's way to the lift's door
    for (let z = S.z + S.house + 3; z < PORT_SHIP.z - 16; z += 2.5) kit.add(band, new THREE.CircleGeometry(0.32, 10).rotateX(-Math.PI / 2).translate(S.x, deckY + 0.03, z), NS);
  }

  // ---- the rail round the deck: a glass screen (not to be climbed over), a brass rail on posts
  {
    const screen = new THREE.CylinderGeometry(P.r - 0.5, P.r - 0.5, 1.6, 96, 1, true).translate(P.x, deckY + 0.8, P.z);
    const m = kit.mesh(screen, glass(P.x, deckY + 1, P.z), { solid: true, shadow: false });
    m.userData.noClimb = true;
    m.name = 'The sea port’s rail';
    kit.add(brass, new THREE.TorusGeometry(P.r - 0.5, 0.09, 5, 96).rotateX(Math.PI / 2).translate(P.x, deckY + 1.62, P.z), NS);
    kit.add(brass, new THREE.TorusGeometry(P.r - 0.5, 0.06, 4, 96).rotateX(Math.PI / 2).translate(P.x, deckY + 0.12, P.z), NS);
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      kit.add(brass, new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5).translate(P.x + Math.sin(a) * (P.r - 0.5), deckY + 0.8, P.z + Math.cos(a) * (P.r - 0.5)), NS);
    }
    // the lamp-columns round the deck: teal, banded in brass, a lantern on top
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6, x = P.x + Math.sin(a) * (P.r - 2.6), z = P.z + Math.cos(a) * (P.r - 2.6);
      kit.add(teal, new THREE.CylinderGeometry(0.34, 0.42, 7, 10).translate(x, deckY + 3.5, z), SOLID);
      for (const h of [1.2, 3.6, 6.0]) kit.add(brass, new THREE.CylinderGeometry(0.46, 0.46, 0.22, 10).translate(x, deckY + h, z), NS);
      kit.add(M.lamp, new THREE.SphereGeometry(0.42, 10, 8).translate(x, deckY + 7.45, z), NS);
      kit.add(brass, new THREE.CylinderGeometry(0.12, 0.6, 0.3, 10).translate(x, deckY + 7.95, z), NS);
      kit.light(x, deckY + 7.2, z, 11);
    }
  }

  // ---- the shaft: glass from the Dock's floor up through its crown and the sea to the house on the deck
  const top = deckY + S.house;
  {
    const half = Math.asin(S.door.w / 2 / S.r);
    const rows = [
      // [y0, y1, the door's yaw or null]
      [0, S.door.h, STATIONS.foot.yaw],
      [S.door.h, deckY, null],
      [deckY, deckY + S.door.h, STATIONS.top.yaw],
      [deckY + S.door.h, top, null],
    ];
    const gl = glass(S.x, deckY / 2, S.z), geos = [];
    for (const [y0, y1, yaw] of rows) {
      const h = y1 - y0, segs = Math.max(1, Math.round(h / 12));
      // (three.js's theta runs from +z round +x, as the yaws do: the door is the gap round its yaw)
      if (yaw == null) geos.push(new THREE.CylinderGeometry(S.r, S.r, h, 32, segs, true).translate(S.x, y0 + h / 2, S.z));
      else geos.push(new THREE.CylinderGeometry(S.r, S.r, h, 28, segs, true, yaw + half, TAU - 2 * half).translate(S.x, y0 + h / 2, S.z));
    }
    for (const g of geos) {
      const m = kit.mesh(g, gl, { solid: true, shadow: false });
      m.userData.noClimb = true;
      m.name = 'The lift’s shaft';
    }
    // the four teal columns round it, banded in brass, from the Dock's floor to the cupola
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4, x = S.x + Math.sin(a) * S.column, z = S.z + Math.cos(a) * S.column;
      kit.add(teal, new THREE.CylinderGeometry(0.3, 0.36, top, 10).translate(x, top / 2, z), SOLID);
      for (let y = 4; y < top - 1; y += 6) kit.add(brass, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10).translate(x, y, z), NS);
    }
    // brass hoops round the glass every 6 m, and a lamp in the shaft every 12 (its way down lit)
    for (let y = 6; y < top - 1; y += 6) kit.add(brass, new THREE.TorusGeometry(S.r + 0.08, 0.1, 4, 32).rotateX(Math.PI / 2).translate(S.x, y, S.z), NS);
    for (let y = 9; y < deckY - 2; y += 12) kit.light(S.x, y, S.z, 7);
    // the collar sealing the Dock's crown round it
    kit.add(brass, new THREE.RingGeometry(S.r, S.oculus + 0.35, 40).rotateX(-Math.PI / 2).translate(S.x, dockTop, S.z), NS);
    kit.add(brass, new THREE.TorusGeometry(S.oculus + 0.3, 0.22, 5, 40).rotateX(Math.PI / 2).translate(S.x, dockTop, S.z), NS);
    // the house's cupola over the shaft's head on the deck, a lantern on it
    kit.add(brass, new THREE.SphereGeometry(S.r + 0.9, 28, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.55, 1).translate(S.x, top, S.z), SOLID);
    kit.add(brass, new THREE.CylinderGeometry(S.r + 0.95, S.r + 0.95, 0.4, 28).translate(S.x, top, S.z), SOLID);
    kit.add(M.lamp, new THREE.SphereGeometry(0.5, 10, 8).translate(S.x, top + (S.r + 0.9) * 0.55 + 0.4, S.z), NS);
    kit.light(S.x, top + 2.2, S.z, 12);
    kit.light(S.x, deckY + 2.6, S.z, 6);
    // each door's frame: two brass posts and a lintel
    for (const st of Object.values(STATIONS)) {
      const dy = st.floor;
      for (const e of [-1, 1]) {
        const a = st.yaw + e * half;
        kit.add(brass, new THREE.BoxGeometry(0.3, S.door.h + 0.3, 0.3).translate(S.x + Math.sin(a) * S.r, dy + (S.door.h + 0.3) / 2, S.z + Math.cos(a) * S.r), SOLID);
      }
      kit.add(brass, new THREE.BoxGeometry(S.door.w + 0.6, 0.3, 0.3).rotateY(st.yaw).translate(S.x + Math.sin(st.yaw) * S.r, dy + S.door.h + 0.15, S.z + Math.cos(st.yaw) * S.r), NS);
      kit.add(M.lamp, new THREE.SphereGeometry(0.2, 8, 6).translate(S.x + Math.sin(st.yaw) * (S.r + 0.3), dy + S.door.h + 0.5, S.z + Math.cos(st.yaw) * (S.r + 0.3)), NS);
    }
  }

  // ---- what moves: the cabin and the two gates (meshes of their own, never baked into the collision)
  const lift = new SeaLift({ at: 'top' });
  const cabin = new THREE.Group();
  cabin.name = 'The lift’s cabin';
  {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(CABIN.r, CABIN.r - 0.2, 0.5, 32).translate(0, -0.25, 0), kit.mat({ color: '#e2806e', flat: true, grid: 1.6 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(CABIN.r, 0.1, 4, 32).rotateX(Math.PI / 2).translate(0, 0.02, 0), brass);
    cabin.add(plate, rim);
    // its rail: two brass arcs at the hip, east and west (open where the doors are), on four posts
    for (const side of [Math.PI / 2, -Math.PI / 2]) {
      const arc = new THREE.TorusGeometry(CABIN.r - 0.15, 0.06, 4, 16, 1.6).rotateX(Math.PI / 2).rotateY(side + 0.8 - Math.PI / 2).translate(0, 1.0, 0);
      cabin.add(new THREE.Mesh(arc, brass));
      for (const e of [-0.7, 0.7]) cabin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5).translate(Math.sin(side + e) * (CABIN.r - 0.15), 0.5, Math.cos(side + e) * (CABIN.r - 0.15)), brass));
    }
    cabin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16).translate(0, 0.03, 0), kit.mat({ color: '#c8a24e', metal: 'painted' })));
  }
  const gateMeshes = {};
  for (const [id, st] of Object.entries(STATIONS)) {
    // a sliding brass grille on the inside of the glass, across the door when shut, round beside it when open
    const half = Math.asin(S.door.w / 2 / S.r) + 0.04, g = new THREE.Group();
    g.name = `The lift’s gate (${id})`;
    const bars = [];
    for (let i = 0; i <= 8; i++) {
      const a = -half + (i / 8) * 2 * half;
      bars.push(new THREE.CylinderGeometry(0.035, 0.035, S.door.h - 0.2, 4).translate(Math.sin(a) * (S.r - 0.12), (S.door.h - 0.2) / 2 + 0.1, Math.cos(a) * (S.r - 0.12)));
    }
    for (const h of [0.1, S.door.h / 2, S.door.h - 0.1]) bars.push(new THREE.TorusGeometry(S.r - 0.12, 0.04, 3, 12, 2 * half).rotateX(Math.PI / 2).rotateY(half - Math.PI / 2).translate(0, h, 0));
    for (const b of bars) g.add(new THREE.Mesh(b, brass));
    g.position.set(S.x, st.floor, S.z);
    gateMeshes[id] = { group: g, yaw: st.yaw, open: 2 * half + 0.1 };
  }
  const movers = [cabin, ...Object.values(gateMeshes).map((g) => g.group)];
  for (const root of movers) {
    root.traverse((o) => { if (o.isMesh) { o.userData.noCollide = true; o.userData.dynamic = true; o.castShadow = false; o.receiveShadow = true; } });
    kit.group.add(root);
  }
  function draw() {
    cabin.position.set(S.x, lift.y, S.z);
    for (const [id, g] of Object.entries(gateMeshes)) g.group.rotation.y = g.yaw + g.open * lift.gates[id].k;
  }
  draw();

  const R2 = (S.r - 0.1) ** 2;
  return {
    lift, cabin, gates: gateMeshes, top,
    /** Inside the shaft (dry all the way down). */
    air: (x, y, z) => y > -1.5 && y < top + 1 && (x - S.x) ** 2 + (z - S.z) ** 2 < R2,
    /** On the deck or just over it (the open air over the sea). */
    onDeck: (x, y, z) => Math.hypot(x - P.x, z - P.z) < P.r + 0.5 && y > deckY - 1.5 && y < deckY + 12,
    update(dt, player) { lift.update(dt, player); draw(); },
    beacon: { name: 'the sea port’s lift', top: [S.x, top + (S.r + 0.9) * 0.55 + 0.9, S.z], height: S.house + 3 },
  };
}
