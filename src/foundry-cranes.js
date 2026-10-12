import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { moon, beam } from './levels/moon-foundry-kit.js';
import { bar } from './levels/antennas-kit.js';

// ---------------------------------------------------------------------------
// The cranes still work (issue #193, the author's pick of the level explorations: references/levels/The Moon Foundry/
// environment/explorations/working-cranes/; docs/systems/worlds.md "The Moon Foundry: inside the moons, the cranes and
// the night pour"). The foundry is not still: under the roof two travelling cranes carry moons slowly up and down the
// hall on a timetable nobody set, their cabs lit, the moons' shadows sliding over the floor; at dusk both carry their
// moons to the end of their runs nearest the Casting-House and hold them there through the night. The old hoist is
// where the cranes are worked from: on its second deck, 54 m up, the signal box (its levers, the moon dial, a stove), and
// from its door the moon-carrier: a small moon on chains with a railed deck on its crown, that carries you between the
// signal box and the lookout on the pillar moon's pillar, 23 m lower, on its own timetable; a lever in the box (or the
// bell-pull at the lookout's jetty) calls it, or sends it off at once.
//
//   BOX, RIDE, CRANES                      where they are (pure)
//   rideStep(st, dt) / rideCall(st, end)   the carrier's timetable and its calls; ridePos(u) where it is
//   craneTarget(c, t, hour), craneStep(s, c, dt, t, hour)   a crane's timetable, dusk at the Casting-House
//   buildSignalBox(put, V)                 the box on the hoist's deck, the jetty at the lookout, the runway (static)
//   buildCranes(scene, T, noShadow)        → { ride, cranes, init(physics), update(dt, t, hour), call(end) }
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** The signal box: its floor (the hoist's second deck, made wider), its top; the cabin north of the hoist's top stage. */
export const BOX = { x0: 48.5, x1: 58.6, z0: -183, z1: -172.7, y: 53.85, cabin: -176.5, door: { west: -179.5, east: -179.5 }, roof: 3.1 };
/** The pillar moon's lookout (src/levels/moon-foundry.js PMOON: its platform 31.2 m up) and the carrier's dock off it. */
const PILLAR = { x: 108, z: -210, r: 3.2, y: 31.2 };
const toward = new THREE.Vector2(61 - PILLAR.x, -179.5 - PILLAR.z).normalize();
/** The moon-carrier: its docks (a by the signal box's east door, b off the lookout's jetty), deck tops, its moon, speed, waits. */
export const RIDE = {
  a: [61, -179.5], b: [PILLAR.x + toward.x * 16, PILLAR.z + toward.y * 16], yA: BOX.y, yB: PILLAR.y,
  R: 5.5, deck: 2.3, speed: 1.8, wait: 14, run: 79,
  jetty: { from: PILLAR.r + 1.2, to: 16 - 2.3 + 0.05, w: 2.2 },
};
/** The travelling cranes: their runway columns (x), the bridge's run (z), the trolley's (x), the moon's height and size, stops. */
export const CRANES = [
  { name: 'the west crane', rails: [-100, -50], z: [-96, -268], x: [-84, -64], y: 60, R: 8, dwell: 70, phase: 0,
    stops: [[-74, -110], [-66, -196], [-82, -262], [-70, -150]], dusk: [-64, -176] },
  { name: 'the east crane', rails: [50, 100], z: [-30, -150], x: [64, 86], y: 62, R: 7.5, dwell: 70, phase: 2,
    stops: [[70, -40], [84, -104], [66, -142], [80, -72]], dusk: [86, -150] },
];
/** The cranes carry their moons to the Casting-House from dusk to dawn (in-game hours). */
export const atHouseHour = (h) => h >= 17.4 || h < 5.6;

const rideLength = (R = RIDE) => Math.hypot(R.b[0] - R.a[0], R.yB - R.yA, R.b[1] - R.a[1]);
const ease = (u) => u * u * (3 - 2 * u);
/** The carrier's deck centre (its top) at u (0 docked at the box, 1 at the lookout). */
export function ridePos(u, R = RIDE, out = V()) {
  const e = ease(Math.min(1, Math.max(0, u)));
  return out.set(R.a[0] + (R.b[0] - R.a[0]) * e, R.yA + (R.yB - R.yA) * e, R.a[1] + (R.b[1] - R.a[1]) * e);
}
/** A fresh timetable: docked at the box, about to wait. */
export const rideState = () => ({ u: 0, to: 0, wait: RIDE.wait });
/** One step of the carrier's timetable: waits at a dock, then goes to the other; returns the state. */
export function rideStep(st, dt, R = RIDE) {
  if (st.u === st.to) {
    st.wait -= dt;
    if (st.wait <= 0) st.to = 1 - st.to;
    return st;
  }
  const du = (R.speed / rideLength(R)) * dt;
  st.u = st.to > st.u ? Math.min(st.to, st.u + du) : Math.max(st.to, st.u - du);
  if (st.u === st.to) st.wait = R.wait;
  return st;
}
/** A lever pulled at a dock (0 the box, 1 the lookout): docked there, it goes at once; elsewhere it comes. */
export function rideCall(st, end) {
  if (st.u === end && st.to === end) { st.to = 1 - end; return 'sent'; }
  st.to = end;
  return 'called';
}
/** Docked at an end (0, 1) or on its way (null). */
export const rideDocked = (st) => (st.u === st.to ? st.u : null);

/** Where a crane is headed: its stop of the moment, or by the Casting-House from dusk to dawn. */
export function craneTarget(c, t, hour) {
  if (atHouseHour(hour)) return c.dusk;
  const i = Math.floor(Math.max(0, t) / c.dwell);
  return c.stops[(i + c.phase) % c.stops.length];
}
/** One step toward the target, the bridge along z and the trolley along x each at its own pace; { x, z } in place. */
export function craneStep(s, c, dt, t, hour) {
  const [tx, tz] = craneTarget(c, t, hour);
  if (!s.started) { s.x = tx; s.z = tz; s.started = true; return s; }
  const mv = (v, to, sp) => (Math.abs(to - v) <= sp * dt ? to : v + Math.sign(to - v) * sp * dt);
  s.x = mv(s.x, tx, 0.9); s.z = mv(s.z, tz, 1.5);
  return s;
}

/**
 * The static pieces: the signal box on the hoist's second deck, the lookout's jetty, the carrier's runway under the roof
 * and the cranes' runway beams. put(x, z, parts, opts) as src/levels/moon-foundry.js's. Returns { levers, dial, stove, bell, operator }.
 */
export function buildSignalBox(put) {
  const B = BOX, y = B.y, cy = (B.z0 + B.cabin) / 2;
  // the floor round the hoist's top stage (its second deck, the same top), brackets under it to the stage below
  put(53.5, -178, { plank: [new THREE.BoxGeometry(B.x1 - B.x0, 0.3, B.z1 - B.z0).translate((B.x0 + B.x1) / 2, y - 0.15, (B.z0 + B.z1) / 2)] });
  put(53.5, -178, { dark: [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([ex, ez]) => beam(V(53 + ex * 1.9, y - 5, -175 + ez * 1.9), V(53 + ex * 4.6, y - 0.32, -178 + ez * 4.4), 0.25, 0.25)) });
  // the cabin: low walls round it under tall open windows, a band over them, its roof; doors west (the high walk) and
  // east (the carrier's dock), and south onto the balcony round the hoist's rungs
  const walls = [], posts = [], band = [], H = 1.05;
  const wallX = (x, z0, z1, gap) => { for (const [a, b] of gap ? [[z0, gap[0]], [gap[1], z1]] : [[z0, z1]]) if (b - a > 0.05) { walls.push(new THREE.BoxGeometry(0.2, H, b - a).translate(x, y + H / 2, (a + b) / 2)); } band.push(new THREE.BoxGeometry(0.24, 0.55, z1 - z0).translate(x, y + B.roof - 0.4, (z0 + z1) / 2)); for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 2) if (!gap || z < gap[0] - 0.1 || z > gap[1] + 0.1) posts.push(new THREE.BoxGeometry(0.14, B.roof, 0.14).translate(x, y + B.roof / 2, z)); };
  const wallZ = (z, x0, x1, gap) => { for (const [a, b] of gap ? [[x0, gap[0]], [gap[1], x1]] : [[x0, x1]]) if (b - a > 0.05) { walls.push(new THREE.BoxGeometry(b - a, H, 0.2).translate((a + b) / 2, y + H / 2, z)); } band.push(new THREE.BoxGeometry(x1 - x0, 0.55, 0.24).translate((x0 + x1) / 2, y + B.roof - 0.4, z)); for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) if (!gap || x < gap[0] - 0.1 || x > gap[1] + 0.1) posts.push(new THREE.BoxGeometry(0.14, B.roof, 0.14).translate(x, y + B.roof / 2, z)); };
  wallX(B.x0, B.z0, B.cabin, [B.door.west - 1, B.door.west + 1]);
  wallX(B.x1, B.z0, B.cabin, [B.door.east - 1, B.door.east + 1]);
  wallZ(B.z0, B.x0, B.x1);
  wallZ(B.cabin, B.x0, 51.6, [49.3, 51.2]);
  wallZ(B.cabin, 54.4, B.x1);
  put(53.5, cy, { rust: walls, wall: band }, { tones: { rust: 'rust2' } });
  put(53.5, cy, { rail: posts });
  put(53.5, cy, { roofing: [new THREE.BoxGeometry(B.x1 - B.x0 + 0.6, 0.25, B.cabin - B.z0 + 0.6).translate((B.x0 + B.x1) / 2, y + B.roof + 0.12, cy)] });
  // the balcony's rail round the hoist's top stage (open where the rungs come up its south face, and at the cabin's door)
  const rail = [], rr = (a, b) => { rail.push(bar(a.clone().add(V(0, 1.05, 0)), b.clone().add(V(0, 1.05, 0)), 0.04, 0.04, 4)); for (let k = 0; k <= 3; k++) { const p = a.clone().lerp(b, k / 3); rail.push(bar(p, p.clone().add(V(0, 1.05, 0)), 0.035, 0.035, 3)); } };
  rr(V(B.x0, y, B.cabin), V(B.x0, y, B.z1)); rr(V(B.x1, y, B.cabin), V(B.x1, y, B.z1));
  rr(V(B.x0, y, B.z1), V(52.2, y, B.z1)); rr(V(53.8, y, B.z1), V(B.x1, y, B.z1));
  put(53.5, -174, { rail });
  // the levers: a row of six along the north window, a brass-capped iron bar each in its quadrant, painted tags
  const levers = [], lx0 = 50.6, lz = B.z0 + 0.9;
  const base = new THREE.BoxGeometry(6.4, 0.5, 0.9).translate(lx0 + 2.6, y + 0.25, lz);
  const iron = [], tags = { wall: [], wall2: [], rust3: [] };
  for (let k = 0; k < 6; k++) {
    const x = lx0 + k * 1.05, tilt = k === 2 ? 0.35 : -0.22, top = V(x, y + 0.5 + Math.cos(tilt) * 1.6, lz + Math.sin(tilt) * 1.6);
    iron.push(bar(V(x, y + 0.5, lz), top, 0.05, 0.05, 4), new THREE.SphereGeometry(0.1, 6, 4).translate(top.x, top.y, top.z));
    tags[['wall2', 'rust3', 'wall', 'wall2', 'wall', 'rust3'][k]].push(new THREE.BoxGeometry(0.2, 0.38, 0.06).translate(x, y + 1.15, lz + Math.sin(tilt) * 0.65 + 0.06));
    iron.push(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 6, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, y + 0.55, lz));
    levers.push(top);
  }
  put(53.5, lz, { dark: [base, ...iron], wall: tags.wall, wall2: tags.wall2, rust: tags.rust3 }, { tones: { rust: 'rust3' } });
  // the moon dial on the west wall: a disc, its ring of moons, a hand
  const dial = V(B.x0 + 0.22, y + 2.1, -181.6);
  const dialParts = { dark: [new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24).rotateZ(Math.PI / 2).translate(dial.x, dial.y, dial.z)], wall2: [], dark: [] };
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; dialParts.wall2.push(new THREE.SphereGeometry(0.1, 8, 6).translate(dial.x + 0.06, dial.y + Math.cos(a) * 0.55, dial.z + Math.sin(a) * 0.55)); }
  dialParts.wall2.push(new THREE.SphereGeometry(0.22, 10, 8).translate(dial.x + 0.06, dial.y, dial.z));
  dialParts.rust = [new THREE.BoxGeometry(0.04, 0.5, 0.05).translate(dial.x + 0.1, dial.y + 0.25, dial.z)];
  put(dial.x, dial.z, dialParts);
  // the stove in the north-west corner, its pipe out through the roof, a mug on the sill
  const stove = V(B.x0 + 0.9, y, B.z0 + 0.9);
  put(stove.x, stove.z, { dark: [new THREE.CylinderGeometry(0.5, 0.55, 1.0, 14).translate(stove.x, y + 0.5, stove.z), new THREE.CylinderGeometry(0.12, 0.12, B.roof + 1.2, 8).translate(stove.x, y + 1 + (B.roof + 1.2) / 2, stove.z)],
    wall2: [new THREE.CylinderGeometry(0.07, 0.06, 0.12, 8).translate(B.x0 + 0.3, y + H + 0.06, -177.6)] });
  // the jetty off the lookout's platform out to the carrier's dock, its rails, a strut under it to the pillar
  const J = RIDE.jetty, d = V(toward.x, 0, toward.y), side = V(-d.z, 0, d.x), p0 = V(PILLAR.x, PILLAR.y, PILLAR.z).addScaledVector(d, J.from), p1 = V(PILLAR.x, PILLAR.y, PILLAR.z).addScaledVector(d, J.to);
  put(p1.x, p1.z, { plank: [beam(p0.clone().add(V(0, -0.15, 0)), p1.clone().add(V(0, -0.15, 0)), J.w, 0.3)], dark: [beam(V(PILLAR.x, PILLAR.y - 5, PILLAR.z).addScaledVector(d, PILLAR.r), p0.clone().lerp(p1, 0.55).add(V(0, -0.3, 0)), 0.3, 0.3)] });
  const jr = [];
  for (const e of [-1, 1]) { const a = p0.clone().addScaledVector(side, e * (J.w / 2 - 0.05)), b = p1.clone().addScaledVector(side, e * (J.w / 2 - 0.05)); jr.push(bar(a.clone().add(V(0, 1.05, 0)), b.clone().add(V(0, 1.05, 0)), 0.04, 0.04, 4)); for (let k = 0; k <= 4; k++) { const p = a.clone().lerp(b, k / 4); jr.push(bar(p, p.clone().add(V(0, 1.05, 0)), 0.035, 0.035, 3)); } }
  // the bell-pull at its end: a post, a bell, a cord
  const bell = p1.clone().addScaledVector(side, J.w / 2 - 0.15).addScaledVector(d, -0.6);
  jr.push(bar(bell, bell.clone().add(V(0, 2.4, 0)), 0.06, 0.06, 5));
  put(p1.x, p1.z, { rail: jr });
  put(p1.x, p1.z, { rust2: [new THREE.SphereGeometry(0.28, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6).translate(bell.x, bell.y + 2.3, bell.z)], strut: [bar(bell.clone().add(V(0, 2.1, 0)), bell.clone().add(V(0.05, 1.0, 0)), 0.015, 0.015, 3)] });
  // the carrier's runway: a girder under the roof from over the box's dock to over the lookout's, hung from the roof
  const A = V(RIDE.a[0], RIDE.run, RIDE.a[1]), Bq = V(RIDE.b[0], RIDE.run, RIDE.b[1]), dd = Bq.clone().sub(A).normalize();
  const r0 = A.clone().addScaledVector(dd, -4), r1 = Bq.clone().addScaledVector(dd, 4), hang = [];
  for (let k = 0; k <= 5; k++) { const p = r0.clone().lerp(r1, k / 5); hang.push(bar(p.clone().add(V(0, 0.6, 0)), V(p.x, 84.6, p.z), 0.08, 0.08, 4)); }
  put(A.x, A.z, { rust: [beam(r0, r1, 0.7, 1.3)], strut: hang }, { solid: false });
  // the travelling cranes' runway beams on their columns of pillars
  for (const c of CRANES) for (const x of c.rails) {
    const z0 = Math.max(...c.z) + 12, z1 = Math.min(...c.z) - 12;
    put(x, (z0 + z1) / 2, { rust: [beam(V(x, 80, z0), V(x, 80, z1), 0.9, 1.4)], strut: [...Array(6)].map((_, k) => { const z = z0 + ((z1 - z0) * k) / 5; return bar(V(x, 80.7, z), V(x, 84.6, z), 0.08, 0.08, 4); }) }, { solid: false });
  }
  return { levers, lever: V(lx0 + 2.6, y + 1.1, lz + 0.7), dial, stove, bell, operator: V(57.5, y, -182.1), stand: V(lx0 + 2.6, y, lz + 1.4), jetty: { from: p0, to: p1 } };
}

/** The moving pieces: the carrier and its trolley, the two travelling cranes. T: the foundry's tones. */
export function buildCranes(scene, T, noShadow) {
  const M = {
    ivory: makeMaterial({ color: T.ivory2, shade: 0.24, hatch: 0.25, line: 0.85 }),
    crater: makeMaterial({ color: T.crater, shade: 0.24, hatch: 0.25, line: 0.85 }),
    rust: makeMaterial({ color: T.rust, shade: 0.18, hatch: 0.38 }), rust2: makeMaterial({ color: T.rust2, shade: 0.18, hatch: 0.38 }),
    dark: makeMaterial({ color: T.dark, shade: 0.3, hatch: 0.3 }), plank: makeMaterial({ color: T.plank, flat: true }),
    strut: makeMaterial({ color: T.strut, flat: true, thin: 1.5 }), glow: makeMaterial({ color: T.glow, glow: 0.62, flat: true }),
  };
  /** Geometries gathered by material (and whether they collide, cast a shadow), merged into one mesh each under a group. */
  const parts = () => {
    const list = new Map();
    return {
      add(g, m, { collide = false, shadow = true } = {}) { const k = `${m.uuid}|${collide}|${shadow}`; if (!list.has(k)) list.set(k, { m, collide, shadow, geos: [] }); const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (a !== 'position' && a !== 'normal') n.deleteAttribute(a); if (!n.attributes.normal) n.computeVertexNormals(); list.get(k).geos.push(n); return this; },
      into(group) {
        for (const { m, collide, shadow, geos } of list.values()) {
          const o = new THREE.Mesh(mergeGeometries(geos), m);
          if (!collide) o.userData.noCollide = true;
          if (!shadow) noShadow.push(o);
          group.add(o);
        }
        return group;
      },
    };
  };
  const moonInto = (P, R, seed, dy, collide) => { const Mn = moon({ R, seg: 32, craters: Math.round(R * 2), seed, detail: 0.8 }); P.add(Mn.shell[0].translate(0, dy, 0), M.ivory, { collide }); if (Mn.crater[0]) P.add(Mn.crater[0].translate(0, dy, 0), M.ivory, { collide }); };   // (one draw: the craters in the shell's tone)
  const cabInto = (P, w, h, d, o, yaw = 0) => {
    const q = (g) => g.rotateY(yaw).translate(o.x, o.y, o.z);
    P.add(q(new THREE.BoxGeometry(w, h, d)), M.rust2);
    for (const [sx, sz] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) P.add(q(new THREE.PlaneGeometry(sx ? d * 0.7 : w * 0.7, h * 0.4).rotateY(Math.atan2(sx, sz)).translate(sx * (w / 2 + 0.02), h * 0.08, sz * (d / 2 + 0.02))), M.glow, { shadow: false });
    P.add(q(new THREE.BoxGeometry(w + 0.3, 0.2, d + 0.3).translate(0, h / 2 + 0.1, 0)), M.rust2);
  };

  // ---- the moon-carrier: a railed deck on a small moon's crown (a moving collider of its own: its holder is kept out
  //      of the level's bake), slung from a trolley on its runway
  const R = RIDE, dir = V(R.b[0] - R.a[0], 0, R.b[1] - R.a[1]).normalize(), dAz = Math.atan2(dir.x, dir.z);
  const holder = new THREE.Group(); holder.name = 'The moon-carrier (moving)'; holder.userData.noCollide = true;
  const piece = new THREE.Group(); piece.name = 'The moon-carrier';
  const P = parts();
  P.add(new THREE.CylinderGeometry(R.deck, R.deck, 0.25, 28).translate(0, -0.125, 0), M.plank, { collide: true });
  P.add(new THREE.CylinderGeometry(R.deck + 0.1, R.deck - 0.2, 0.7, 28).translate(0, -0.6, 0), M.rust, { collide: true });
  moonInto(P, R.R, 88, -0.1 - R.R, true);
  // its rail, open toward both docks (along the way it goes)
  const off = (q) => Math.min(Math.abs(Math.atan2(Math.sin(q - dAz), Math.cos(q - dAz))), Math.abs(Math.atan2(Math.sin(q - dAz - Math.PI), Math.cos(q - dAz - Math.PI))));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
    if (off(a) < 0.75 || off(a1) < 0.75) continue;
    const p = V(Math.sin(a) * (R.deck - 0.08), 0, Math.cos(a) * (R.deck - 0.08)), q = V(Math.sin(a1) * (R.deck - 0.08), 0, Math.cos(a1) * (R.deck - 0.08));
    P.add(bar(p, p.clone().add(V(0, 1.05, 0)), 0.04, 0.04, 3), M.rust, { collide: true });
    P.add(bar(p.clone().add(V(0, 1.05, 0)), q.clone().add(V(0, 1.05, 0)), 0.04, 0.04, 3), M.rust, { collide: true });
  }
  // the sling: four chains from the deck's rim up to the hook block (drawn only)
  for (let k = 0; k < 4; k++) { const a = dAz + Math.PI / 4 + (k * Math.PI) / 2; P.add(bar(V(Math.sin(a) * (R.deck - 0.1), 0.1, Math.cos(a) * (R.deck - 0.1)), V(0, 4.1, 0), 0.05, 0.05, 3), M.rust); }
  P.add(new THREE.BoxGeometry(0.7, 0.8, 0.5).translate(0, 4.4, 0), M.rust, { collide: true });
  P.into(piece);
  holder.add(piece); scene.add(holder);
  const trolley = new THREE.Group(); trolley.name = 'The moon-carrier’s trolley'; trolley.userData.noCollide = true;
  const TP = parts();
  TP.add(new THREE.BoxGeometry(2.4, 1.4, 3.2).rotateY(dAz).translate(0, -0.7, 0), M.rust2);
  cabInto(TP, 2.2, 2, 2.2, V(Math.cos(dAz) * 2.3, -2.6, -Math.sin(dAz) * 2.3), dAz);
  TP.into(trolley);
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1, 0.09).translate(0, 0.5, 0), M.strut); chain.name = 'the carrier’s chain'; chain.userData.noCollide = true; noShadow.push(chain);
  trolley.add(chain);
  scene.add(trolley);
  const st = rideState(), _p = V();
  const place = () => {
    ridePos(st.u, R, _p);
    piece.position.copy(_p); piece.updateMatrixWorld(true);
    trolley.position.set(_p.x, R.run - 0.7, _p.z);
    const top = R.run - 1.4, hook = _p.y + 4.8;
    chain.position.set(0, hook - trolley.position.y, 0); chain.scale.set(1, Math.max(0.1, top - hook), 1);
    trolley.updateMatrixWorld(true);
  };
  place();

  // ---- the travelling cranes: a bridge between two runway beams, a trolley with its lit cab, a moon on chains (drawn only)
  const cranes = CRANES.map((c, i) => {
    const span = c.rails[1] - c.rails[0], g = new THREE.Group(); g.name = `The Moon Foundry: ${c.name}`; g.userData.noCollide = true;
    const bridge = parts();
    bridge.add(new THREE.BoxGeometry(span + 2, 1.6, 1.4).translate(0, 0, -1.1), M.rust).add(new THREE.BoxGeometry(span + 2, 1.6, 1.4).translate(0, 0, 1.1), M.rust);
    for (const e of [-1, 1]) bridge.add(new THREE.BoxGeometry(2.2, 2, 5).translate(e * (span / 2), 0.2, 0), M.rust);
    bridge.into(g);
    const tr = new THREE.Group(), TQ = parts();
    TQ.add(new THREE.BoxGeometry(3.4, 1.6, 4.2).translate(0, 0.9, 0), M.rust2);
    cabInto(TQ, 2.6, 2.2, 2.4, V(1.4, -2.1, 2.6));
    const hangY = c.y + c.R + 1.2 - 80.8, ry = Math.sqrt(c.R * c.R - (c.R * 0.45) ** 2);
    for (const ex of [-0.6, 0.6]) TQ.add(bar(V(ex, -0.2, 0), V(ex * 0.4, hangY + 1, 0), 0.09, 0.09, 3), M.rust2);
    TQ.add(new THREE.BoxGeometry(1.4, 1.2, 1).translate(0, hangY + 0.4, 0), M.rust2);
    // the sling round its moon: a ring over its shoulders, four chains to the hook block
    TQ.add(new THREE.TorusGeometry(c.R * 0.45, 0.22, 6, 24).rotateX(Math.PI / 2).translate(0, c.y - 80.8 + ry, 0), M.rust2);
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + 0.4; TQ.add(bar(V(Math.sin(a) * c.R * 0.45, c.y - 80.8 + ry, Math.cos(a) * c.R * 0.45), V(0, hangY, 0), 0.07, 0.07, 3), M.rust2); }
    moonInto(TQ, c.R, 91 + i, c.y - 80.8, false);
    TQ.into(tr);
    g.add(tr);
    g.position.set((c.rails[0] + c.rails[1]) / 2, 80.8, 0);
    scene.add(g);
    return { def: c, group: g, trolley: tr, state: { x: 0, z: 0, started: false } };
  });
  const placeCrane = (C) => { C.group.position.z = C.state.z; C.trolley.position.x = C.state.x - C.group.position.x; C.group.updateMatrixWorld(true); };
  let collider = null;
  return {
    ride: { piece, trolley, state: st, get collider() { return collider; } },
    cranes,
    /** The carrier as a moving collider (the level's init). */
    init(physics) { collider = physics.addMover?.(piece) ?? null; },
    /** Once a frame: the carrier on its timetable, the cranes on theirs (hour: the sky's, in-game hours). */
    update(dt, t, hour = 10.5) {
      rideStep(st, Math.min(dt, 0.1));
      place();
      for (const C of cranes) { craneStep(C.state, C.def, Math.min(dt, 0.1), t, hour); placeCrane(C); }
    },
    /** A lever pulled at a dock (0 the signal box, 1 the lookout). */
    call: (end) => rideCall(st, end),
    docked: () => rideDocked(st),
  };
}
