import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { BREATHE_CLOCK, slideOut } from './breathe-shader.js';
import { motionState } from './feel.js';

// The machine breathes (issue #168, the author's pick of the Buried Machine's explorations:
// references/levels/The Buried Machine/environment/explorations/machine-breathes/). The rust canyon's walls move:
//   the breathing vents   round vents low on both walls puff steam in rhythm, slow by the sand ramp and quicker toward
//                         the oculus (warmer, colder); once the Wick is lit the whole canyon breathes at once
//   the great pistons     house-sized rods sliding out of the walls high up and back, each on its own slow beat
//   the oil fall          a thin amber fall from a broken pipe high on the west wall into a pool on the floor
//   the keepers' way      past the first cross-wall, the dome keepers' gangway up the east wall: a stair of three
//                         pistons breathing in turn (ride one up, step across when two meet) to a deck at mid-height,
//                         a gear door in a bulkhead that turns open for a while every half minute, a long ramp up the
//                         wall, a landing in the corner by the second cross-wall, and a ramp along that wall's face onto
//                         its crown, 8 m over the rim: a walk across the canyon on top of it, the keepers' log, the view
//                         both ways, and down onto the dunes either side (a short drop) - the quick way out after the Wick
// The vents, the great pistons and the gears move on the GPU (breathe-shader.js: one clock, nothing per instance on the
// CPU); the stair's pistons and the door are solid and move on the CPU (three discs and one moving collider). With
// Reduce motion the great pistons, the gears and the steam hold still and the door stands open; the stair keeps its
// beat (it is the way up; the wall beside it is a ladder too). The Deck's and the handheld's presets hold the GPU
// parts still past BREATHE_FAR (breathe-shader.js; main.js applyDetail). No rng.
//
//   buildMachineBreath(scene, M, ctx) → { update(dt, t, ctx), solids(), init(physics), setLit(lit), route, ... }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const nonIdx = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

/** The tunings. */
export const BREATH = {
  near: 260,                        // m: the stair's pistons and the door move (on the CPU) only within this of the camera
  vents: { from: -170, to: -446, every: 19, y: 6.5, blobs: 7, slow: 7.2, quick: 2.6, lit: 3.6, rise: 6.5 },
  pistons: { stroke: [3.5, 5.5], period: [9, 15] },
};

/**
 * The keepers' way, on the east wall (side +1) between the two cross-walls (src/levels/buried.js WALLS): the stair's
 * three pistons (z of each, how far out from the centreline, radius, the beat), the deck (its height over the floor,
 * where it runs), the gear door (where, its beat), the ramp, and the second cross-wall it climbs onto.
 */
export const KEEPERS = {
  side: 1,
  pistons: { z: [-269.6, -274.1, -278.6], d: 23, r: 2.2, period: 9, phase: [0, 0.5, 0], beat: { out: 0.22, hold: 0.28, back: 0.22 } },
  deck: { rise: 12.9, pad: [-280.9, -285], z1: -292, w: 2.8, bottom: 0.0 },
  door: { z: -288.2, period: 30, opening: 2.4, open: 13, closing: 2.4, w: 1.9, h: 3.0, warn: 3 },
  ramp: { slope: 0.55 },            // the face ramp's rise over its run (~29°); the wall ramp takes what is left
  crown: { wall: 1, face: { u1: 1 }, w: 2.8 },   // (the face ramp from the canyon's east wall to u1 on the crown)
};

/** Where the canyon walls' machinery (src/levels/buried.js) is left out for the keepers' way: [{ s, z0, z1 }]. */
export const WALL_CLEAR = [{ s: 1, z0: -264, z1: -348 }];
/**
 * The great pistons out of the walls: [z, side, height over the floor]. Between the walls' great pillars (7 m or more from
 * any: the pillars are landmarks the audit counts), clear of the ledge, the gauges and the cross-walls.
 */
export const GREAT_PISTONS = [[-186, -1, 24], [-197, 1, 21], [-243, -1, 26], [-342, -1, 22], [-380, 1, 24], [-390, -1, 20], [-413, 1, 26], [-426, -1, 23], [-440, 1, 20]];
/** Where only the walls' tanks and ducts are left out (round the great pistons and the oil fall; the pillars stay). */
export const WALL_CLEAR_LOW = GREAT_PISTONS.map(([z, s]) => ({ s, z0: z + 5, z1: z - 5 }));
/** Is (side s, z) where the walls' machinery is left out (low: its tanks and ducts only)? */
export const wallClear = (s, z, low = false) => [...WALL_CLEAR, ...(low ? WALL_CLEAR_LOW : [])].some((c) => c.s === s && z <= c.z0 && z >= c.z1);
/** The oil fall: on the west wall, its broken pipe this high over the floor, reaching this far out of it (to `d` off the centreline). */
export const OIL_FALL = { z: -281, side: -1, y: 19, d: 22.2, w: 2.2, pool: 4.8 };
WALL_CLEAR_LOW.push({ s: OIL_FALL.side, z0: OIL_FALL.z + 5, z1: OIL_FALL.z - 5 });
/**
 * No sand banked (src/sand-drifts.js mask: 0 there) round the keepers' stair (they keep its foot swept) or in the oil's
 * pool (the oil washed it out), so both stand on the canyon's floor.
 */
export function breathSand(x, z, cx) {
  const near = (zz, d, side, r) => { const dx = x - (cx(zz) + side * d), dz = z - zz, q = Math.hypot(dx, dz); return q < r ? 0 : q < r + 3 ? (q - r) / 3 : 1; };
  const K = KEEPERS.pistons;
  let m = near(OIL_FALL.z, OIL_FALL.d - 1, OIL_FALL.side, OIL_FALL.pool + 1.5);
  for (const zz of K.z) m = Math.min(m, near(zz, K.d, KEEPERS.side, K.r + 2.5));
  return m;
}

/** How far out the stair's piston k is at canyon time t (0 down .. 1 up). */
export const stairOut = (k, t, K = KEEPERS.pistons) => slideOut(t / K.period + K.phase[k], { out: K.beat.out, hold: K.beat.hold, back: K.beat.back });

/** The gear door at time t: { open (0 shut .. 1 open), warn (the gears hurry: the few seconds before it opens and while it moves) }. */
export function doorAt(t, D = KEEPERS.door) {
  const u = ((t % D.period) + D.period) % D.period;
  const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  let open;
  if (u < D.opening) open = sm(u / D.opening);
  else if (u < D.opening + D.open) open = 1;
  else if (u < D.opening + D.open + D.closing) open = 1 - sm((u - D.opening - D.open) / D.closing);
  else open = 0;
  const warn = u > D.period - D.warn || u < D.opening || (u > D.opening + D.open && u < D.opening + D.open + D.closing);
  return { open, warn };
}

/** A vent's breath period at z: slow by the ramp, quick by the oculus. */
export const ventPeriod = (z, B = BREATH.vents) => B.slow + (B.quick - B.slow) * clamp01((B.from - z) / (B.from - B.to));

/** A box from a to b (the middle of its top face), w wide (level across), t thick. */
function plank(a, b, w, t) {
  const along = b.clone().sub(a), L = along.length();
  along.normalize();
  const side = V(-along.z, 0, along.x).normalize(), up = new THREE.Vector3().crossVectors(along, side).negate();
  if (up.y < 0) up.negate();
  const m = new THREE.Matrix4().makeBasis(side, up, along);
  const c = a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, -t / 2);
  return nonIdx(new THREE.BoxGeometry(w, t, L + 0.12).applyMatrix4(m).translate(c.x, c.y, c.z));
}
/** A bar from a to b, r thick (square). */
function bar(a, b, r) {
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.BoxGeometry(r, L, r).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  return nonIdx(g.translate(a.x, a.y, a.z));
}
/** A cylinder about the axis a → b. */
function rod(a, b, r0, r1 = r0, seg = 12) {
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  return nonIdx(g.translate(a.x, a.y, a.z));
}
/** A gear, axle along y, radius 1, `teeth` teeth, thickness t (a hole of `hole` radius in the middle: a ring gear). */
function gearGeometry(teeth = 12, t = 0.3, hole = 0.22) {
  const sh = new THREE.Shape(), n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, q = i % 4, r = q === 1 || q === 2 ? 1 : 0.84;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); sh.holes.push(h);
  // spokes' windows in a big gear
  if (hole < 0.5) for (let k = 0; k < 5; k++) { const w = new THREE.Path(), a = (k / 5) * TAU; w.absellipse(Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0.16, 0.16, 0, TAU, true); sh.holes.push(w); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -t / 2).rotateX(-Math.PI / 2);
  return nonIdx(g);
}

/** An instanced mesh of breathing parts: one geometry, [{ m: Matrix4, b: [phase, period, stroke, kind] }]. */
function breathing(geo, mat, list, name) {
  const g = geo.clone();
  const mesh = new THREE.InstancedMesh(g, mat, list.length);
  const at = new Float32Array(list.length * 4);
  list.forEach((e, i) => { mesh.setMatrixAt(i, e.m); at.set(e.b, i * 4); });
  g.setAttribute('aBreathe', new THREE.InstancedBufferAttribute(at, 4));
  mesh.name = name;
  mesh.frustumCulled = false;   // (moved in the shader, out of its bounds)
  mesh.userData.noCollide = true; mesh.userData.dynamic = true; mesh.userData.castShadow = false;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * ctx: { cx, floorAt, terrain, wallFace(y, z, s), wallD(y, z, s), rimY(z, s), passages, crownTop(i), FLOOR }
 */
export function buildMachineBreath(scene, M, ctx) {
  const { cx, terrain, wallFace, wallD, rimY, passages, crownTop, FLOOR } = ctx;
  const H = (x, z) => terrain.heightAt(x, z);
  const s = KEEPERS.side;
  if (s !== 1) throw new Error('the keepers’ way is built for the east wall');
  const P = (z, d, y, side = s) => V(cx(z) + side * d, y, z);
  const group = new THREE.Group();
  group.name = 'The machine breathes';
  scene.add(group);
  const solid = { deck: [], rail: [], iron: [], rust: [], dark: [], brass: [] }, drawn = { rail: [], iron: [], dark: [], cream: [], peach: [], amber: [] };

  // ---------------------------------------------------------------- where the wall stands, for a deck at y
  // (the wall's face as drawn over a person's height above the deck, and the long pipes of its top band: the deck's
  // inner edge stands at the nearest of them, into the wall by 0.6 m)
  const tubes = (z) => Array.from({ length: 8 }, (_, k) => ({ y: rimY(z, s) - 1.2 - k * 1.55, r: 0.7 + ((k * 7) % 5) * 0.14 }));
  const inner = (y, z) => {
    let d = Infinity;
    for (let h = 0; h <= 2.6; h += 0.65) d = Math.min(d, wallFace(y + h, z, s));
    for (const tb of tubes(z)) if (tb.y + tb.r > y - 0.2 && tb.y - tb.r < y + 2.6) d = Math.min(d, wallD(tb.y, z, s) + tb.r * 0.1 - tb.r - 0.15);
    return d;
  };

  // ---------------------------------------------------------------- the stair's pistons
  const K = KEEPERS.pistons, Y = FLOOR + KEEPERS.deck.rise;
  const feet = K.z.map((z) => P(z, K.d, H(cx(z) + s * K.d, z)));
  // (the first one's low top a step over the lowest sand round it: walked onto from the floor, src/player.js moving solids)
  const ring0 = Array.from({ length: 12 }, (_, i) => H(feet[0].x + Math.cos((i / 12) * TAU) * (K.r + 1.2), feet[0].z + Math.sin((i / 12) * TAU) * (K.r + 1.2)));
  const L0 = Math.min(...ring0) + 0.3, S = (Y - L0) / 3;
  const pistons = K.z.map((z, k) => {
    const foot = feet[k], low = L0 + k * S, high = L0 + (k + 1) * S;
    const g = new THREE.Group();
    g.name = `A keepers' stair piston (${k + 1})`;
    // the drum it rises out of (to its low top), a collar, and the polished head (stroke + a hand's length)
    const drumTop = low - 0.25;
    const drum = [];
    if (drumTop - foot.y > 0.4) drum.push(rod(V(foot.x, foot.y - 0.6, foot.z), V(foot.x, drumTop, foot.z), K.r + 0.2, K.r + 0.15, 20));
    drum.push(rod(V(foot.x, drumTop - 0.05, foot.z), V(foot.x, drumTop + 0.18, foot.z), K.r + 0.32, K.r + 0.32, 20));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; drum.push(nonIdx(new THREE.BoxGeometry(0.3, Math.max(0.4, drumTop - foot.y), 0.3).translate(foot.x + Math.cos(a) * (K.r + 0.26), (foot.y + drumTop) / 2, foot.z + Math.sin(a) * (K.r + 0.26)))); }
    const drumMesh = new THREE.Mesh(mergeGeometries(drum), M.rustDark);
    drumMesh.userData.noCollide = true;   // (the piston's disc is the solid: src/carriers.js)
    group.add(drumMesh);
    const len = S + 0.9;
    const head = new THREE.Mesh(mergeGeometries([
      nonIdx(new THREE.CylinderGeometry(K.r, K.r, len, 24).translate(0, -len / 2, 0)),
      nonIdx(new THREE.CylinderGeometry(K.r * 0.7, K.r * 0.7, 0.04, 24).translate(0, 0.02, 0)),
    ]), M.pistonHead);
    const band = new THREE.Mesh(nonIdx(new THREE.TorusGeometry(K.r - 0.12, 0.09, 5, 28).rotateX(Math.PI / 2).translate(0, -0.12, 0)), M.ink);
    g.add(head, band);
    g.position.set(foot.x, low, foot.z);
    g.userData.noCollide = true;
    group.add(g);
    return { k, g, foot, low, high, solid: { pos: V(foot.x, low, foot.z), r: K.r + 0.15, top: low, bottom: foot.y - 1, vel: V(), flat: true } };
  });

  // ---------------------------------------------------------------- the deck at mid-height, the pad over the stair
  const W = KEEPERS.deck.w;
  const route = [];   // the way up, for the audit and the tests: [x, y, z]
  const rails = [];   // (where the rails run, as pairs: [a, b] at deck height)
  const deckRun = (z0, z1, y0, y1, step = 2) => {
    const n = Math.max(1, Math.ceil(Math.abs(z1 - z0) / step)), pts = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 + (z1 - z0) * (i / n), y = y0 + (y1 - y0) * (i / n), din = inner(y, z);
      pts.push({ z, y, din, mid: P(z, din - W / 2, y), out: P(z, din - W, y) });
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      // (the plank from the outer edge into the wall by 0.6 m: its middle is W/2 - 0.3 off the inner edge)
      solid.deck.push(plank(P(a.z, a.din - W / 2 + 0.3, a.y), P(b.z, b.din - W / 2 + 0.3, b.y), W + 0.6, 0.3));
      rails.push([a.out, b.out]);
      // brackets under it into the wall, every other span
      if (i % 2 === 0) drawn.dark.push(bar(P(a.z, a.din - W + 0.2, a.y - 0.3), P(a.z, wallFace(a.y - 3.2, a.z, s) + 0.3, a.y - 3.2), 0.22));
    }
    return pts;
  };
  const [pz0, pz1] = KEEPERS.deck.pad;
  // the pad: out over the floor to beside the third piston's head
  {
    const din = inner(Y, pz0), dOut = K.d - K.r - 0.4;
    solid.deck.push(plank(P(pz0, (dOut + din + 0.6) / 2, Y), P(pz1, (dOut + din + 0.6) / 2, Y), din + 0.6 - dOut, 0.3));
    // its struts down to the floor (they stand on the sand beside the stair)
    for (const dz of [-0.4, -3.7]) drawn.dark.push(rod(P(pz0 + dz, dOut + 0.4, H(cx(pz0 + dz) + s * (dOut + 0.4), pz0 + dz) - 0.3), P(pz0 + dz, dOut + 0.4, Y - 0.3), 0.18, 0.14, 6));
    rails.push([P(pz0 - 1.4, dOut, Y), P(pz1, dOut, Y)]);   // (open toward the stair: its first 1.4 m)
    rails.push([P(pz1, dOut, Y), P(pz1, din - W, Y)]);
  }
  const level = deckRun(pz1, KEEPERS.deck.z1, Y, Y);
  route.push(...pistons.map((p) => [p.foot.x, p.high, p.foot.z]), [cx(pz0 - 2) + s * (K.d - 0.5), Y, pz0 - 2]);

  // ---------------------------------------------------------------- the second cross-wall: its frame, the face ramp, the corner
  const wall = passages[KEEPERS.crown.wall], top = crownTop(KEEPERS.crown.wall);
  const WF = (u, v, y) => V(wall.x + u * wall.c + v * wall.s, y, wall.z - u * wall.s + v * wall.c);
  const uvOf = (x, z) => [(x - wall.x) * wall.c - (z - wall.z) * wall.s, (x - wall.x) * wall.s + (z - wall.z) * wall.c];
  const F = { ...KEEPERS.crown.face }, fw = KEEPERS.crown.w, vIn = 3.5, vOut = vIn + fw, vm = (vIn + vOut) / 2;
  // (the face ramp's foot: just short of the canyon's east wall, at the height it starts from)
  const inFront = (u, y) => { const p = WF(u, vm, y); return (p.x - cx(p.z)) * s < inner(y, p.z); };
  const wallU = (y) => { let lo = F.u1, hi = 60; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (inFront(m, y)) lo = m; else hi = m; } return lo; };
  let u0 = wallU(top - 15) - 2.2;
  for (let i = 0; i < 4; i++) u0 = wallU(top - (u0 - F.u1) * KEEPERS.ramp.slope) - 2.2;   // (room on the landing east of it)
  F.u0 = u0;
  const faceRun = Math.abs(F.u0 - F.u1), yCorner = top - faceRun * KEEPERS.ramp.slope;
  // the face ramp: along the wall's north face from the corner (u0) to the crown's north edge (u1)
  {
    const n = Math.ceil(faceRun / 2.5);
    for (let i = 1; i <= n; i++) {
      const ua = F.u0 + (F.u1 - F.u0) * ((i - 1) / n), ub = F.u0 + (F.u1 - F.u0) * (i / n), ya = yCorner + (top - yCorner) * ((i - 1) / n), yb = yCorner + (top - yCorner) * (i / n);
      solid.deck.push(plank(WF(ua, (vIn - 0.6 + vOut) / 2, ya), WF(ub, (vIn - 0.6 + vOut) / 2, yb), fw + 0.6, 0.3));
      rails.push([WF(ua, vOut, ya), WF(ub, vOut, yb)]);
      if (i % 2) drawn.dark.push(bar(WF(ua, vOut - 0.2, ya - 0.3), WF(ua, vIn, ya - 3.4), 0.22));
    }
  }
  // the wall ramp: from the deck's end up the east wall to the corner landing (its north edge where the ramp meets it)
  const z0r = KEEPERS.deck.z1;
  // (the landing: from the face ramp's foot east into the canyon wall, and north from the cross-wall's face)
  const vLand = (() => {   // the landing reaches north to where the wall ramp's middle line comes in
    let lo = z0r, hi = wall.z;   // (z: the ramp's middle crosses v = vLand)
    const vAt = (z) => uvOf(cx(z) + s * (inner(yCorner, z) - W / 2), z)[1];
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (vAt(m) > vOut + W / 2 + 0.6) lo = m; else hi = m; }
    return { z: lo, v: vAt(lo) };
  })();
  const zr1 = vLand.z, rampPts = deckRun(z0r, zr1, Y, yCorner);
  route.push(...level.filter((_, i) => i % 3 === 0).map((p) => p.mid.toArray()), ...rampPts.filter((_, i) => i % 3 === 0 || i === rampPts.length - 1).map((p) => p.mid.toArray()));
  // the corner landing: v from the cross-wall's face (into it 0.6 m) to past the ramp's end, u from the face ramp's foot
  // into the canyon wall
  {
    const end = rampPts.at(-1), [ue] = uvOf(end.out.x, end.out.z), uWall = uvOf(cx(zr1) + s * (end.din + 1.2), zr1)[0];
    const u0 = Math.min(F.u0 - 0.2, ue - 0.4), u1 = uWall, v0 = vIn - 0.6, v1 = vLand.v + 0.5;
    const c0 = WF(u0, (v0 + v1) / 2, yCorner), c1 = WF(u1, (v0 + v1) / 2, yCorner);
    solid.deck.push(plank(c0, c1, v1 - v0, 0.35));
    // rails: its open west edge north of the face ramp, its north edge west of the wall ramp
    rails.push([WF(u0, vOut, yCorner), WF(u0, v1, yCorner)]);
    rails.push([WF(u0, v1, yCorner), WF(ue, v1, yCorner)]);
    // its post into the floor far below: a tall iron leg against the cross-wall
    drawn.dark.push(rod(WF(u0 + 0.6, vIn + 0.5, FLOOR - 0.5), WF(u0 + 0.6, vIn + 0.5, yCorner - 0.35), 0.35, 0.28, 8));
    route.push(WF(F.u0 + 0.9, vm, yCorner).toArray(), WF(F.u0 - 4, vm, yCorner + 4 * KEEPERS.ramp.slope).toArray());
  }
  // the crown: rails along both edges, gaps where the face ramp comes up and at both ends (down onto the dunes)
  const half = 34, uGap = [F.u1 - 1.6, F.u1 + 2.2];
  for (const v of [-3.35, 3.35]) {
    const spans = v > 0 ? [[-half, uGap[0]], [uGap[1], half]] : [[-half, half]];
    for (const [a, b] of spans) rails.push([WF(a, v, top), WF(b, v, top)]);
  }
  route.push(WF(F.u1 + 0.6, (vIn + vOut) / 2, top).toArray(), WF(F.u1 - 0.5, 0, top).toArray());
  const crown = WF(-4, 0, top);
  route.push(crown.toArray());

  // the rails: a collided top bar at 1.1 m, posts every ~1.8 m, a drawn middle bar
  for (const [a, b] of rails) {
    const up = V(0, 1.1, 0), mid = V(0, 0.55, 0), L = a.distanceTo(b), n = Math.max(1, Math.round(L / 1.8));
    solid.rail.push(bar(a.clone().add(up), b.clone().add(up), 0.09));
    drawn.rail.push(bar(a.clone().add(mid), b.clone().add(mid), 0.05));
    for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); solid.rail.push(bar(p, p.clone().add(up), 0.07)); }
  }

  // ---------------------------------------------------------------- the gear door: a bulkhead across the deck
  // (in its own frame: x across the deck from the doorway's middle, toward the wall; z along the canyon, north +)
  const D = KEEPERS.door, zb = D.z, dinB = inner(Y, zb), dc = dinB - W / 2;
  const yaw = Math.atan((cx(zb - 1) - cx(zb + 1)) / -2);   // (square to the canyon's line here, as the cross-walls)
  const ax = V(Math.cos(yaw), 0, -Math.sin(yaw)), az = V(Math.sin(yaw), 0, Math.cos(yaw)), dcen = P(zb, dc, Y);
  const DF = (x, y, z) => dcen.clone().addScaledVector(ax, x).add(V(0, y, 0)).addScaledVector(az, z);
  const door = { at: dcen.clone(), open: 0, warn: false };
  {
    const x0 = (dinB - W - 2.0) - dc, x1 = (dinB + 0.9) - dc, hw = D.w / 2, hr = hw;
    const sh = new THREE.Shape();
    sh.moveTo(x0, -0.7); sh.lineTo(x1, -0.7); sh.lineTo(x1, 5.6); sh.lineTo(x0, 5.6); sh.lineTo(x0, -0.7);
    const hole = new THREE.Path();
    hole.moveTo(-hw, 0); hole.lineTo(hw, 0); hole.lineTo(hw, D.h - hr); hole.absarc(0, D.h - hr, hr, 0, Math.PI, false); hole.lineTo(-hw, 0);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -0.5).rotateY(yaw).translate(dcen.x, dcen.y, dcen.z);
    solid.rust.push(nonIdx(g));
    // the frame round the doorway's arch, on its north face
    drawn.dark.push(nonIdx(new THREE.TorusGeometry(hw + 0.18, 0.12, 6, 24, Math.PI).translate(0, D.h - hr, 0.56).rotateY(yaw).translate(dcen.x, dcen.y, dcen.z)));
    // the leaf: hinged on the wall side of the doorway, swinging south (away from whoever waits for it)
    const pivot = new THREE.Group();
    pivot.position.copy(DF(hw - 0.04, 0, 0));
    pivot.rotation.y = yaw;
    const lsh = new THREE.Shape(), lw = D.w - 0.08, lr = lw / 2;
    lsh.moveTo(0, 0.02); lsh.lineTo(-lw, 0.02); lsh.lineTo(-lw, D.h - hr); lsh.absarc(-lr, D.h - hr, lr - 0.02, Math.PI, 0, true); lsh.lineTo(0, 0.02);
    const leaf = new THREE.Mesh(nonIdx(new THREE.ExtrudeGeometry(lsh, { depth: 0.16, bevelEnabled: false, curveSegments: 12 }).translate(0, 0, -0.08)), M.doorLeaf);
    // its round boss and the maker's three studs
    const boss = new THREE.Mesh(mergeGeometries([nonIdx(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16).rotateX(Math.PI / 2).translate(-lr, 1.45, 0)),
      ...[-1, 0, 1].map((k) => nonIdx(new THREE.SphereGeometry(0.07, 6, 4).translate(-lr + k * 0.2, 2.15 + (k ? 0 : 0.08), 0.12)))]), M.brass);
    leaf.userData.noCollide = true; boss.userData.noCollide = true;
    pivot.add(leaf, boss);
    pivot.name = 'The gear door';
    group.add(pivot);
    door.pivot = pivot; door.yaw = yaw;
  }

  // ---------------------------------------------------------------- the gears round the door (GPU: they turn)
  const gears = [];
  {
    // [across, up, radius, way round]: on the bulkhead's north face, a hand off it; they mesh, each at its size's rate
    const list = [[0, 1.5, 2.6, 1], [-1.75, 4.53, 0.9, -1], [0.85, 4.69, 0.7, -1], [-2.96, 2.58, 0.55, -1]];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, yaw, 0, 'YXZ'));
    for (const [x, y, r, way] of list) {
      gears.push({ m: new THREE.Matrix4().compose(DF(x, y, 0.66), q, V(r, 1, r)), b: [0, way * r * 9, 0, 1], ring: r > 1.5 });
    }
  }
  const ringGeo = gearGeometry(36, 0.26, 0.72), gearGeo = gearGeometry(12, 0.3, 0.22);
  const gearRing = breathing(ringGeo, M.gear, gears.filter((g) => g.ring), 'The gear door’s ring');
  const gearSmall = breathing(gearGeo, M.gear, gears.filter((g) => !g.ring), 'The gear door’s gears');
  group.add(gearRing, gearSmall);

  // ---------------------------------------------------------------- the breathing vents (GPU: the steam)
  const VB = BREATH.vents, vents = [], blobs = [];
  for (const side of [-1, 1]) for (let z = VB.from - (side > 0 ? VB.every / 2 : 0); z >= VB.to; z -= VB.every) {
    if (passages.some((p) => Math.abs(z - p.z) < 8)) continue;
    // (over the sand banked against the wall's foot)
    const bank = H(cx(z) + side * (wallFace(FLOOR + 2, z, side) - 0.6), z);
    const y = Math.max(FLOOR + VB.y, bank + 1.8) + (Math.abs(z * 7.3) % 1.4), d = wallFace(y, z, side), c = P(z, d - 0.05, y, side);
    const n = V(-side, 0, 0), per = ventPeriod(z), phase = (Math.abs(z * 0.37 + side * 1.3) % 1) * per;
    vents.push({ z, side, at: c, per, phase });
    // the vent: a ring and its louvres, flush with the wall
    drawn.dark.push(nonIdx(new THREE.TorusGeometry(0.95, 0.2, 6, 20).rotateY(Math.PI / 2).translate(c.x, c.y, c.z)));
    for (let k = -2; k <= 2; k++) drawn.iron.push(nonIdx(new THREE.BoxGeometry(0.08, 0.16, 1.7 * Math.sqrt(1 - (k / 2.6) ** 2)).translate(c.x + n.x * 0.06, c.y + k * 0.32, c.z)));
    drawn.dark.push(nonIdx(new THREE.CircleGeometry(0.9, 16).rotateY(-side * Math.PI / 2).translate(c.x - n.x * 0.02, c.y, c.z)));
    // its puffs: out of the vent and up, each a little after the last
    const dir = V(n.x * 0.55, 1, 0).normalize(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
    for (let i = 0; i < VB.blobs; i++) {
      const size = 0.55 + ((i * 37 + Math.round(-z)) % 5) * 0.1, off = V(n.x * (0.5 + i * 0.1), (i - 3) * 0.12, ((i * 3) % 5 - 2) * 0.32);
      const m = new THREE.Matrix4().compose(c.clone().add(off), q, V(size, size, size));
      blobs.push({ m, b: [phase - i * 0.045 * per, per, VB.rise * (0.75 + i * 0.07), 2], vent: vents.length - 1, i });
    }
  }
  const steam = breathing(new THREE.IcosahedronGeometry(1, 1), M.steam, blobs, 'The vents’ breath');
  group.add(steam);
  const steamAttr = steam.geometry.getAttribute('aBreathe');
  let lit = false;
  const setLit = (on) => {
    if (on === lit) return;
    lit = on;
    blobs.forEach((bl, i) => {
      const v = vents[bl.vent], per = on ? VB.lit : v.per, ph = on ? 0 : v.phase;
      steamAttr.setXY(i, ph - bl.i * 0.045 * per, per);
    });
    steamAttr.needsUpdate = true;
  };

  // ---------------------------------------------------------------- the great pistons (GPU: they slide)
  const greats = [];
  const housing = [];
  GREAT_PISTONS.forEach(([z, side, rise], i) => {
    const y = FLOOR + rise, d = wallFace(y, z, side), n = V(-side, 0, 0);
    const c = P(z, d, y, side), R = 2.6 + (i % 3) * 0.4;
    // the housing: a drum on the wall, its collar, the hatch-ring round the rod (solid: you can climb past it)
    housing.push(rod(c.clone().addScaledVector(n, -0.8), c.clone().addScaledVector(n, 2.4), R, R * 0.92, 18));
    solid.dark.push(rod(c.clone().addScaledVector(n, 2.3), c.clone().addScaledVector(n, 2.8), R * 0.62, R * 0.62, 18));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; solid.dark.push(nonIdx(new THREE.BoxGeometry(0.4, 0.4, 0.4).translate(c.x + n.x * 2.45, c.y + Math.cos(a) * R * 0.85, c.z + Math.sin(a) * R * 0.85))); }
    const [s0, s1] = BREATH.pistons.stroke, [p0, p1] = BREATH.pistons.period;
    const stroke = s0 + ((i * 5) % 7) / 6 * (s1 - s0), per = p0 + ((i * 3) % 7) / 6 * (p1 - p0);
    // the rod (its rest: mostly in the housing) along local +y, pointing out of the wall
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
    greats.push({ m: new THREE.Matrix4().compose(c.clone().addScaledVector(n, 2.6), q, V(R / 2.6, 1, R / 2.6)), b: [i * 2.3, per, stroke, 0] });
  });
  const rodGeo = mergeGeometries([nonIdx(new THREE.CylinderGeometry(0.62, 0.62, 7, 16).translate(0, -3.0, 0)), nonIdx(new THREE.CylinderGeometry(1.25, 1.25, 1.1, 18).translate(0, 0.9, 0)), nonIdx(new THREE.CylinderGeometry(1.05, 1.25, 0.4, 18).translate(0, 1.65, 0))]);
  const rods = breathing(rodGeo, M.rod, greats, 'The great pistons’ rods');
  group.add(rods);

  // ---------------------------------------------------------------- the oil fall and its pool
  const O = OIL_FALL;
  const fall = {};
  {
    const y = FLOOR + O.y, d = wallFace(y, O.z, O.side), n = V(-O.side, 0, 0);
    const mouth = P(O.z, O.d, y, O.side);
    // the broken pipe out of the wall, a flange where it leaves it, a collar halfway, its torn lip
    solid.iron.push(rod(P(O.z, d + 0.5, y, O.side), mouth, 0.85, 0.85, 14));
    solid.dark.push(rod(P(O.z, d - 0.4, y, O.side), P(O.z, d - 0.9, y, O.side), 1.15, 1.15, 14));
    solid.dark.push(rod(P(O.z, (d + O.d) / 2 + 0.25, y, O.side), P(O.z, (d + O.d) / 2 - 0.25, y, O.side), 1.0, 1.0, 14));
    drawn.amber.push(nonIdx(new THREE.CircleGeometry(0.72, 14).rotateY(-O.side * Math.PI / 2).translate(mouth.x + n.x * 0.03, mouth.y, mouth.z)));
    // the fall: a sheet out of the lip, a little ahead of it, down to the floor
    const sx = mouth.x + n.x * 0.55, foot = H(sx, mouth.z), h = mouth.y - 0.4 - foot;
    const sheet = new THREE.PlaneGeometry(O.w, h, 2, Math.ceil(h / 3)).translate(0, h / 2, 0);
    const uv = sheet.attributes.uv, pp = sheet.attributes.position;
    for (let i = 0; i < pp.count; i++) { const u = pp.getY(i) / h; pp.setX(i, pp.getX(i) * (0.45 + 0.55 * (1 - u))); uv.setXY(i, pp.getX(i) + O.w / 2, pp.getY(i)); }
    sheet.rotateY(Math.PI / 2).translate(sx, foot, mouth.z);
    M.oilFall.uniforms.uFallB.value.z = h;   // (its lip under the pipe: waterfall-shader.js)
    const sheetMesh = new THREE.Mesh(sheet, M.oilFall);
    sheetMesh.name = 'The oil fall'; sheetMesh.userData.noCollide = true; sheetMesh.userData.castShadow = false;
    group.add(sheetMesh);
    // the pool: dark amber on the floor at its foot, a paler rim of spill
    const pc = V(sx + n.x * 0.6, 0, mouth.z);
    pc.y = H(pc.x, pc.z);
    const pool = new THREE.Mesh(nonIdx(new THREE.CircleGeometry(O.pool, 28).rotateX(-Math.PI / 2).translate(pc.x, pc.y + 0.13, pc.z)), M.oilPool);
    pool.name = 'The oil pool'; pool.userData.noCollide = true;
    group.add(pool);
    drawn.amber.push(nonIdx(new THREE.RingGeometry(O.pool, O.pool + 0.4, 28).rotateX(-Math.PI / 2).translate(pc.x, pc.y + 0.12, pc.z)));
    fall.mouth = mouth; fall.pool = pc.clone();
  }

  // ---------------------------------------------------------------- the keepers' things: gauges, cans, a ladder, the log
  {
    // three small dials on the wall over the deck, oil cans hung off the rail, a ladder from the floor to the pad
    for (const z of [-286.4, -303, -321]) {
      const y = z > -292 ? Y + 1.6 : Y + (yCorner - Y) * ((z0r - z) / (z0r - zr1)) + 1.6, d = inner(y - 1.6, z) + 0.05;
      const c = P(z, d, y);
      drawn.dark.push(nonIdx(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 16).rotateZ(Math.PI / 2).translate(c.x, c.y, c.z)));
      drawn.cream.push(nonIdx(new THREE.CircleGeometry(0.34, 16).rotateY(-s * Math.PI / 2).translate(c.x - s * 0.09, c.y, c.z)));
      drawn.dark.push(bar(V(c.x - s * 0.1, c.y, c.z), V(c.x - s * 0.1, c.y + 0.24, c.z + 0.12), 0.03));
    }
    for (const z of [-283.4, -296, -312, -327]) {
      const p = rampPts.find((q) => Math.abs(q.z - z) < 1.2) ?? level.find((q) => Math.abs(q.z - z) < 1.2);
      if (!p) continue;
      const c = p.out.clone().add(V(0, 0.75, 0));
      drawn.iron.push(nonIdx(new THREE.CylinderGeometry(0.17, 0.2, 0.42, 10).translate(c.x - s * 0.18, c.y, c.z)));
      drawn.dark.push(nonIdx(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 6).translate(c.x - s * 0.18, c.y + 0.3, c.z)));
    }
    const zl = pz0 + 1.6, ya = H(cx(zl) + s * 24.5, zl);
    for (const dz of [-0.3, 0.3]) drawn.rail.push(bar(P(zl + dz, wallFace(ya, zl, s) - 0.2, ya - 0.2), P(zl + dz, wallFace(Y, zl, s) - 0.2, Y + 1.0), 0.07));
    for (let y = ya + 0.3; y < Y; y += 0.4) drawn.rail.push(bar(P(zl - 0.3, wallFace(y, zl, s) - 0.2, y), P(zl + 0.3, wallFace(y, zl, s) - 0.2, y), 0.05));
  }
  // the keepers' bench on the crown, over the opening, with the log on its lectern, and a lamp on a post
  const log = WF(-4, -1.6, top + 1.1);
  {
    solid.rust.push(nonIdx(new THREE.BoxGeometry(3.2, 0.45, 0.8).translate(0, 0.45, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(wall.s, wall.c))).translate(...WF(-1.2, -2.2, top).toArray())));
    const lect = WF(-4, -1.6, top);
    solid.iron.push(rod(lect, lect.clone().add(V(0, 1.0, 0)), 0.12, 0.1, 6), nonIdx(new THREE.BoxGeometry(0.7, 0.08, 0.5).translate(lect.x, lect.y + 1.02, lect.z)));
    drawn.cream.push(nonIdx(new THREE.BoxGeometry(0.5, 0.06, 0.36).translate(lect.x, lect.y + 1.09, lect.z)));
    for (const k of [0, 1]) { const c = WF(0.6 + k * 0.5, -2.4, top); drawn.iron.push(nonIdx(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 10).translate(c.x, c.y + 0.25, c.z))); }
    const post = WF(-6, -2.6, top);
    solid.iron.push(rod(post, post.clone().add(V(0, 3.4, 0)), 0.1, 0.08, 6));
    drawn.peach.push(nonIdx(new THREE.SphereGeometry(0.28, 10, 6).translate(post.x, post.y + 3.5, post.z)));
  }

  // ---------------------------------------------------------------- the meshes
  const add = (list, mat, name, collide) => {
    if (!list.length) return null;
    const m = new THREE.Mesh(mergeGeometries(list), mat);
    m.name = name;
    if (!collide) m.userData.noCollide = true;
    group.add(m);
    return m;
  };
  add(solid.deck, M.deck, 'The keepers’ gangway', true);
  add(solid.rail, M.ink, 'The keepers’ gangway’s rails', true);
  add(drawn.rail, M.ink, 'The keepers’ gangway’s middle rails and ladder', false);
  add(solid.rust, M.rustDark, 'The gear door’s bulkhead and the keepers’ bench', true);
  add(solid.dark, M.rustDark, 'The great pistons’ collars and the broken pipe’s flange', true);
  add(solid.iron, M.hatch, 'The broken oil pipe and the keepers’ lectern', true);
  add(housing, M.housing, 'The great pistons’ housings', true);
  add(drawn.dark, M.rustDark, 'The vents, the brackets and the gauges', false);
  add(drawn.iron, M.hatch, 'The vents’ louvres and the oil cans', false);
  add(drawn.cream, M.cream, 'The keepers’ dials and their log', false);
  add(drawn.peach, M.peach, 'The keepers’ lamp', false);
  add(drawn.amber, M.oilPool, 'The oil’s spill', false);

  // ---------------------------------------------------------------- moving
  const clock = { t: 0, gear: 0, still: 0 };
  const near = (camera, p) => !camera || Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < BREATH.near;
  const placePiston = (p, dt, player) => {
    const out = stairOut(p.k, clock.t), y = p.low + (p.high - p.low) * out, prev = p.solid.top;
    p.g.position.y = y;
    p.solid.top = y; p.solid.pos.y = y;
    p.solid.vel.set(0, dt > 0 ? (y - prev) / dt : 0, 0);
    // going down with someone on it: they go down with it (as a temple's riding disc, src/temples/pieces.js Platform)
    if (player && p.solid.vel.y < 0 && !player.climbing && Math.hypot(player.pos.x - p.foot.x, player.pos.z - p.foot.z) < p.solid.r && Math.abs(player.pos.y - prev) < 0.4 && player.vel.y <= 0.5) player.vel.y = Math.min(player.vel.y, p.solid.vel.y);
  };
  const placeDoor = (reduce) => {
    const d = reduce ? { open: 1, warn: false } : doorAt(clock.t);
    door.open = d.open; door.warn = d.warn;
    door.pivot.rotation.y = -s * 1.72 * d.open;
    return d;
  };
  placeDoor(false);
  pistons.forEach((p) => placePiston(p, 0, null));

  return {
    group, pistons, door, vents, fall, route, log, crown, top, yCorner, deckY: Y, gangway: { level, ramp: rampPts },
    clock,
    /** The stair's pistons, solid (level.dynamic). */
    solids: () => pistons,
    /** The door's leaf collides as it swings (physics.addMover). */
    init(physics) { door.collider = physics.addMover?.(door.pivot, { all: true }) ?? null; },
    setLit,
    get lit() { return lit; },
    update(dt, t, o = {}) {
      const reduce = motionState().reduce;
      clock.t += dt;
      const cam = o.camera ?? null;
      const d = placeDoor(reduce);
      if (near(cam, door.at) || !cam) {
        for (const p of pistons) placePiston(p, dt, o.player ?? null);
      }
      // the GPU parts: the canyon's clock (still with Reduce motion), the gears' (hurrying before the door opens)
      if (!reduce) { clock.gear += dt * (d.warn ? 3.2 : 1); clock.still = clock.t; }
      const B = BREATHE_CLOCK.value;
      B.x = reduce ? clock.still : clock.t; B.w = clock.gear;
    },
  };
}

/** The materials (made once: makeMaterial caches them). */
export function breathMaterials(M) {
  const oil = makeMaterial({ color: '#c27a2a', color2: '#f2c060', color3: '#6b3412', fall: { speed: 3.2, column: 0.45, gaps: 0.24, mist: 2.2, ink: 1.0, lip: 0.9, height: 19, seed: 2 }, glow: 0.4, spot: 0, line: 0.5, lineTint: 0.6, side: THREE.DoubleSide });
  return {
    ...M,
    deck: makeMaterial({ color: '#c3c6b4', flat: true, grid: 0.7 }),
    pistonHead: makeMaterial({ color: '#7f93a3', color2: '#5f7488', color3: '#94a6b3', metal: 'steel', refl: 0.4, grid: 1.2 }),
    doorLeaf: makeMaterial({ color: '#5e9094', flat: true, metal: 'painted' }),
    brass: makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' }),
    gear: makeMaterial({ color: '#8c9aa4', flat: true, metal: 'steel', breathe: true }),
    rod: makeMaterial({ color: '#c3ccce', metal: 'steel', refl: 0.55, breathe: true }),
    housing: makeMaterial({ color: '#b35a3a', flat: true, metal: 'iron', refl: 0.15 }),
    steam: makeMaterial({ color: '#f4efe4', breathe: true }),
    cream: makeMaterial({ color: '#efe6d0', flat: true }),
    oilFall: oil,
    oilPool: makeMaterial({ color: '#8a4a1c', flat: true, metal: 'painted', refl: 0.5 }),
  };
}
