import * as THREE from 'three';

// The defeats (docs/systems/foes.md, "Hit and defeat", v1.35): each body plan goes down its own way over ~0.8-1.5 s, and
// then bursts as before (src/foes.js Foes.burst: the ink, the tank's charge, the chimes, the pieces). The killing blow
// starts it (Foes.defeat): the mind is done (state 'dead': no target, no blows, nothing blocks you, the lock moves on), and
// the look runs the model's own pose with the recipe's moves on top (Foes.look):
//
//   flip    onto its back (a hop up, half a turn about its length) and its legs curled (the crab, the skitters)
//   roll    over onto a side, `angle` rad about its length (side ±1), legs curling (the lizard, the centipede)
//   topple  over forward about its feet, `angle` rad (the heron off its stilts, the brute onto its face)
//   sag     its body sinks `y` m onto its legs (the kit re-solves them: knees buckle; a tripod's, a bell walker's)
//   squash  flattened to `sy` of its height, `sxz` wider (the blot into a puddle, the shade's cloak falling empty)
//   sink    into the ground `y` m (the worm back under the sand, the root knot)
//   land    a flyer comes down from its height to the ground (the moth spiralling, the jelly deflating, the ray gliding)
//   spin    turns about itself, rad/s (falling off to nothing: a spiral)
//   curl    [from, to, k]: its legs drawn up under the body over that share of the time (the rig's `air` above 1)
//   slack   the plan's own: its parts let go (the marionette's strings, the moth's wings folding: model.defeat)
//   ripple  the plan's own, in its pose (f.dying): the centipede's plates sink and roll over one after another
//   puff    what comes off it as it goes: 'dust' as it lands, 'vent' (a machine's steam), 'ink' (a spirit's drips)
// Each move has `at: [from, to]`, the share of the time it runs over (eased). Everything is the foe's own transform and a
// few numbers: no new meshes, no draws (cheap with many at once). The eyes go out over the first half.
// A foe that went out of the world (fell, swept away) or an old kind without a recipe bursts at once, as before.

export const DEFEATS = {
  crab: { time: 1.25, flip: { hop: 0.5, at: [0, 0.45] }, curl: [0.4, 1, 0.9], puff: 'dust' },
  skitter: { time: 0.8, flip: { hop: 0.3, at: [0, 0.4] }, curl: [0.25, 0.9, 1], puff: 'dust' },
  centipede: { time: 1.3, ripple: true, puff: 'dust' },   // (its own: a ripple from head to tail, each plate sinking and rolling over: centipede.js)
  toad: { time: 1.1, squash: { sy: 0.6, sxz: 1.22, at: [0, 0.3] }, roll: { side: -1, angle: 1.25, at: [0.25, 0.8] }, curl: [0.3, 0.8, 0.5], puff: 'dust' },
  lizard: { time: 1.0, roll: { side: -1, angle: 1.5, at: [0.05, 0.5] }, curl: [0.3, 0.9, 0.8], puff: 'dust' },
  heron: { time: 1.45, sag: { y: -1.9, at: [0.05, 0.55] }, curl: [0.05, 0.5, 1], topple: { angle: 1.25, at: [0.4, 0.92] }, puff: 'dust' },
  roller: { time: 1.0, roll: { side: 1, angle: 1.45, at: [0.05, 0.55] }, sag: { y: -0.15, at: [0, 0.4] }, puff: 'dust' },
  rootknot: { time: 1.3, sag: { y: -0.5, at: [0, 0.5] }, topple: { angle: 0.5, at: [0.1, 0.6] }, sink: { y: 0.7, at: [0.45, 1] }, curl: [0.1, 0.6, 0.6], puff: 'dust' },
  jelly: { time: 1.5, land: { at: [0, 1] }, squash: { sy: 0.45, sxz: 1.35, at: [0.05, 0.8] }, spin: 0.8, puff: null },
  moth: { time: 1.3, land: { at: [0, 0.95] }, spin: 7, roll: { side: 1, angle: 0.8, at: [0, 0.4] }, slack: true, puff: 'dust' },
  ray: { time: 1.4, land: { at: [0, 0.95] }, spin: 2.6, roll: { side: -1, angle: 0.5, at: [0, 0.5] }, puff: 'dust' },
  worm: { time: 1.1, sink: { y: 2.4, at: [0.1, 1] }, roll: { side: 1, angle: 0.35, at: [0, 0.4] }, puff: 'dust' },
  tripod: { time: 1.3, sag: { y: -0.95, at: [0.05, 0.6] }, topple: { angle: 0.45, at: [0.3, 0.9] }, puff: 'vent' },
  cart: { time: 1.1, sag: { y: -0.2, at: [0, 0.4] }, roll: { side: 1, angle: 0.35, at: [0.2, 0.7] }, puff: 'vent' },
  bell: { time: 1.5, sag: { y: -1.3, at: [0.05, 0.6] }, topple: { angle: 0.4, at: [0.35, 0.95] }, puff: 'vent' },
  drone: { time: 1.1, land: { at: [0, 0.85] }, spin: 9, roll: { side: 1, angle: 0.9, at: [0.1, 0.6] }, puff: 'vent' },
  brute: { time: 1.5, sag: { y: -0.75, at: [0, 0.4] }, topple: { angle: 1.4, at: [0.4, 0.95] }, puff: 'vent' },
  blot: { time: 0.9, squash: { sy: 0.12, sxz: 1.75, at: [0, 0.75] }, puff: 'ink' },
  shade: { time: 1.2, sag: { y: -0.55, at: [0.1, 0.7] }, squash: { sy: 0.4, sxz: 1.45, at: [0.15, 0.85] }, puff: 'ink' },
  hound: { time: 1.2, sag: { y: -0.3, at: [0, 0.35] }, roll: { side: 1, angle: 1.4, at: [0.25, 0.7] }, curl: [0.4, 0.9, 0.6], puff: 'ink' },
  marionette: { time: 1.3, land: { at: [0.15, 0.45], to: 0 }, slack: true, puff: 'ink' },
};

/** A move's eased progress at u (0..1 over the defeat) for its `at` window. */
export const stage = (m, u) => {
  if (!m) return 0;
  const [a, b] = m.at ?? [0, 1];
  const x = THREE.MathUtils.clamp((u - a) / Math.max(1e-6, b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

/** A defeat under way for foe f (recipe R): its clock and what it started from. */
export function startDefeat(f, R) {
  return { R, t: 0, u: 0, alt: f.alt ?? 0, over: f.over ?? 0, heading: f.heading, puffed: 0 };
}

/**
 * The recipe's moves at u: { body: { y, pitch, roll, sx, sy } on the body before its legs are solved, group (applied to
 * the root after the pose), curl (the rig's air), alt (a flyer's height), heading, flipped, k }.
 */
export function defeatPose(D, u, out = {}) {
  const R = D.R;
  const sag = R.sag ? R.sag.y * stage(R.sag, u) : 0;
  const sq = stage(R.squash, u);
  out.body = { y: sag, pitch: 0, roll: 0, sx: R.squash ? THREE.MathUtils.lerp(1, R.squash.sxz, sq) : 1, sy: R.squash ? THREE.MathUtils.lerp(1, R.squash.sy, sq) : 1 };
  // the root: a flip (a hop and half a turn about its length), a roll onto its side, a topple forward, a sink
  const fl = stage(R.flip, u);
  out.flip = fl * Math.PI;
  out.hop = R.flip ? R.flip.hop * Math.sin(Math.PI * fl) : 0;
  out.roll = R.roll ? R.roll.side * R.roll.angle * stage(R.roll, u) : 0;
  // (a flyer's bank comes out as it touches down: it lands flat on the ground, not on a wing's tip; issue #304)
  if (R.land && out.roll) { const e = R.land.at?.[1] ?? 1; out.roll *= 1 - stage({ at: [e - 0.3, e] }, u); }
  out.pitch = R.topple ? R.topple.angle * stage(R.topple, u) : 0;
  out.sink = R.sink ? R.sink.y * stage(R.sink, u) : 0;
  // the legs curled up under it
  if (R.curl) { const [a, b, k] = R.curl, x = THREE.MathUtils.clamp((u - a) / Math.max(1e-6, b - a), 0, 1); out.curl = 1 + k * x * x * (3 - 2 * x); } else out.curl = 0;
  // a flyer's height: from where it was down to the ground (or below its anchor: the marionette's `to`)
  out.alt = R.land ? THREE.MathUtils.lerp(D.alt, R.land.to ?? 0, stage(R.land, u)) : null;
  out.over = R.land ? D.over * (1 - stage(R.land, u)) : null;
  out.spin = R.spin ? R.spin * D.t * (1 - 0.5 * u) : 0;
  out.k = u;
  return out;
}

const _q = new THREE.Quaternion(), _x = new THREE.Vector3(1, 0, 0), _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0);

/** The root's moves (after the model posed itself): the flip and the roll about its length, the topple, the hop, the sink. */
export function defeatRoot(g, P, size = 1) {
  g.position.y += (P.hop - P.sink) * size;
  // (about its own axes: its heading kept, then rolled, flipped, toppled)
  if (P.roll || P.flip) g.quaternion.multiply(_q.setFromAxisAngle(_z, P.roll + P.flip));
  if (P.pitch) g.quaternion.multiply(_q.setFromAxisAngle(_x, P.pitch));
  // (flipped: lifted by its own height so its back, not its belly, is on the ground)
  if (P.flip) g.position.y += Math.sin(P.flip / 2) * 0.55 * size;
}

// ------------------------------------------------------------------ on the ground, never through it (issue #304)
// A roll, a topple or a flip turns the body about its feet, and a flyer comes down to its footing: left alone, half of
// a body rolled onto its side went under the ground (the crab on its back by 1.7 m). Each frame of a defeat the model's
// lowest point is found against the ground under it and the body lifted onto it (Foes.falling): it rolls over on the
// ground. The recipe's own sink (the worm under the sand, the root knot) is left to go down; what was already under
// the ground when the blow fell (a hem, a fist on the sand) comes up over the first share of it (GROUNDED.ease), no pop.

export const GROUNDED = {
  ease: [0, 0.3],    // the share of the defeat over which what was already under the ground comes up
  grid: 2,           // each part's outermost points are kept along the directions of a (2·grid+1)³ grid (98: its hull
                     // within a few millimetres, and a lowest point is one of its hull's)
};

const DIRS = (() => {
  const out = [], n = GROUNDED.grid, seen = new Set();
  for (let x = -n; x <= n; x++) for (let y = -n; y <= n; y++) for (let z = -n; z <= n; z++) {
    if (!x && !y && !z) continue;
    const d = new THREE.Vector3(x, y, z).normalize(), key = d.toArray().map((c) => c.toFixed(4)).join();
    if (!seen.has(key)) { seen.add(key); out.push(d); }
  }
  return out;
})();

const SMALL = DIRS.filter((d) => [d.x, d.y, d.z].every((c) => Math.abs(c) < 1e-6 || Math.abs(Math.abs(c) - Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z))) < 1e-6));   // (the 26 of a 3³ grid)
const DX = Float32Array.from(DIRS, (d) => d.x), DY = Float32Array.from(DIRS, (d) => d.y), DZ = Float32Array.from(DIRS, (d) => d.z);
const SX = Float32Array.from(SMALL, (d) => d.x), SY = Float32Array.from(SMALL, (d) => d.y), SZ = Float32Array.from(SMALL, (d) => d.z);

/** Into `keep`, the indices of points `ids` (of positions P) outermost along each direction (a part under 12 cm: 26 of them). */
function extremes(P, ids, keep, small) {
  const [X, Y, Z] = small ? [SX, SY, SZ] : [DX, DY, DZ], n = X.length, best = new Float64Array(n).fill(-Infinity), at = new Int32Array(n).fill(-1);
  const a = P.array, stride = P.isInterleavedBufferAttribute ? P.data.stride : 3, off = P.isInterleavedBufferAttribute ? P.offset : 0;
  const src = P.isInterleavedBufferAttribute ? P.data.array : a;
  // (a dense part read every few points: its neighbours are millimetres apart, 1500 points do)
  const step = Math.max(1, Math.floor(ids.length / 1500));
  for (let j = 0; j < ids.length; j += step) {
    const i = ids[j], b = i * stride + off, x = src[b], y = src[b + 1], z = src[b + 2];
    for (let d = 0; d < n; d++) { const v = X[d] * x + Y[d] * y + Z[d] * z; if (v > best[d]) { best[d] = v; at[d] = i; } }
  }
  for (let d = 0; d < n; d++) if (at[d] >= 0) keep.add(at[d]);
}

let _range = new Int32Array(0);
const range = (n) => { if (_range.length < n) { _range = new Int32Array(n); for (let i = 0; i < n; i++) _range[i] = i; } return _range.subarray(0, n); };

// (each geometry's points worked out once: the same legs on every crab, the same crab every wave)
const HULLS = new WeakMap();
function hullOf(o) {
  const g = o.geometry, P = g.attributes.position, skinned = !!(o.isSkinnedMesh && g.attributes.skinIndex);
  let h = HULLS.get(g);
  if (h && h.skinned === skinned && h.count === P.count) return h.ids;
  g.boundingSphere ?? g.computeBoundingSphere();
  const small = (g.boundingSphere?.radius ?? 1) < 0.12, keep = new Set();
  if (skinned) {
    // (a skinned part: its points along each direction for each bone that moves most of them, skinned each frame)
    const J = g.attributes.skinIndex, W = g.attributes.skinWeight, flat = !J.isInterleavedBufferAttribute && !W.isInterleavedBufferAttribute && J.itemSize === 4 && W.itemSize === 4;
    const bone = new Int32Array(P.count), count = new Map();
    for (let i = 0; i < P.count; i++) {
      let b = 0, w = -1;
      for (let k = 0; k < 4; k++) { const x = flat ? W.array[i * 4 + k] : W.getComponent(i, k); if (x > w) { w = x; b = flat ? J.array[i * 4 + k] : J.getComponent(i, k); } }
      bone[i] = b; count.set(b, (count.get(b) ?? 0) + 1);
    }
    const lists = new Map([...count].map(([b, n]) => [b, { ids: new Int32Array(n), n: 0 }]));
    for (let i = 0; i < P.count; i++) { const L = lists.get(bone[i]); L.ids[L.n++] = i; }
    for (const { ids } of lists.values()) extremes(P, ids, keep, small);
  } else extremes(P, range(P.count), keep, small);
  h = { skinned, count: P.count, ids: Int32Array.from(keep) };
  HULLS.set(g, h);
  return h.ids;
}

/**
 * The points of a model that can be its lowest however it is turned (once, at its defeat's first frame): each drawn
 * part's outermost vertices along DIRS (a skinned part's for each bone that moves most of it, skinned each frame).
 */
export function defeatHull(group) {
  const parts = [];
  group.updateMatrixWorld(true);
  group.traverseVisible((o) => {
    if (!o.isMesh || o.userData.noGround || !o.geometry?.attributes?.position?.count) return;
    const ids = hullOf(o);
    if (ids.length) parts.push({ mesh: o, ids, sphere: !o.isSkinnedMesh && !o.isInstancedMesh ? o.geometry.boundingSphere : null });
  });
  return { parts, group };
}

/** The ground under a defeat (once, at its first frame): a plane through the ground at its feet and round them. */
export function groundPlane(physics, at, r = 0.8) {
  const h = (x, z) => physics?.groundAt?.(x, at.y + 1 + r, z);
  const y0 = h(at.x, at.z);
  if (!Number.isFinite(y0)) return null;
  const xp = h(at.x + r, at.z), xm = h(at.x - r, at.z), zp = h(at.x, at.z + r), zm = h(at.x, at.z - r);
  const slope = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? (a - b) / (2 * r) : 0);
  // (a step beside it, a ledge's edge: no slope wilder than 45°, the ground at its feet kept)
  const k = (s) => THREE.MathUtils.clamp(s, -1, 1);
  return { x: at.x, z: at.z, y: y0, sx: k(slope(xp, xm)), sz: k(slope(zp, zm)) };
}

// (a rigid part whose hull comes within `near` m of the deepest found, with no more than `points` points, read whole)
const REFINE = { near: 0.05, points: 4000 };
const _p = new THREE.Vector3(), _im = new THREE.Matrix4(), _mm = new THREE.Matrix4();
/** How far the hull's lowest point is under the plane this frame (m; negative: all of it over the ground). */
export function belowGround(hull, plane) {
  if (!hull || !plane) return -Infinity;
  hull.group.updateMatrixWorld(true);
  const { y: py, sx, sz, x: px, z: pz } = plane, under = (x, y, z) => py + sx * (x - px) + sz * (z - pz) - y;
  // the parts shown, the deepest their bounding spheres could reach first: the rest skipped once none of theirs can
  // reach deeper than the deepest point found (most parts, high on the body, never read)
  const todo = hull.todo ??= [];
  todo.length = 0;
  for (const part of hull.parts) {
    let shown = true;
    for (let o = part.mesh; o && o !== hull.group.parent; o = o.parent) if (!o.visible) { shown = false; break; }
    if (!shown) continue;
    const m = part.mesh.matrixWorld;
    part.bound = part.sphere ? under(_p.copy(part.sphere.center).applyMatrix4(m).x, _p.y, _p.z) + part.sphere.radius * m.getMaxScaleOnAxis() : Infinity;
    todo.push(part);
  }
  todo.sort((a, b) => b.bound - a.bound);
  let worst = -Infinity;
  for (const { mesh, ids, bound } of todo) {
    if (bound <= worst) break;
    const P = mesh.geometry.attributes.position, n = mesh.isInstancedMesh ? mesh.count : 1;
    for (let k = 0; k < n; k++) {
      const M = mesh.isInstancedMesh ? _mm.multiplyMatrices(mesh.matrixWorld, (mesh.getMatrixAt(k, _im), _im)) : mesh.matrixWorld, e = M.elements;
      const deepest = (list, count) => {
        let best = -Infinity;
        for (let j = 0; j < count; j++) {
          const i = list ? list[j] : j;
          _p.fromBufferAttribute(P, i);
          if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, _p);
          const x = _p.x, y = _p.y, z = _p.z, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
          const d = under((e[0] * x + e[4] * y + e[8] * z + e[12]) * w, (e[1] * x + e[5] * y + e[9] * z + e[13]) * w, (e[2] * x + e[6] * y + e[10] * z + e[14]) * w);
          if (d > best) best = d;
        }
        return best;
      };
      let d = deepest(ids, ids.length);
      // (the hull's 98 directions miss a round part's lowest point by up to a few cm when the ground's normal falls
      //  between them, the brute's saw and the crab's shell on a slope by 2-3 cm: a rigid part that could be the
      //  deepest is read whole, its every point; a skinned one keeps its hull, its points skinned one by one)
      if (!mesh.isSkinnedMesh && P.count <= REFINE.points && d > worst - REFINE.near) d = Math.max(d, deepest(null, P.count));
      if (d > worst) worst = d;
    }
  }
  return worst;
}

/**
 * At the blow (Foes.defeat, the body as it was last drawn, before the blow's own shove): the ground under it, its
 * hull, and how far under the ground it already was (D.allow, let come up over GROUNDED.ease).
 */
export function groundStart(D, g, physics, at, radius = 0.8) {
  D.plane ??= groundPlane(physics, at, THREE.MathUtils.clamp(radius, 0.4, 1.2));
  if (!D.plane) return D;
  D.hull ??= defeatHull(g);
  D.allow ??= Math.max(0, belowGround(D.hull, D.plane));
  return D;
}

/**
 * Lift the falling body onto the ground (after defeatRoot and the plan's own letting go): its lowest point no deeper
 * than what was already under at the blow, coming up over GROUNDED.ease, the recipe's sink aside. Returns the lift (m).
 */
export function groundDefeat(D, g, P, physics, at, { size = 1, radius = 0.8 } = {}) {
  groundStart(D, g, physics, at, radius);
  if (!D.plane) return 0;
  const deep = belowGround(D.hull, D.plane) - (P.sink ?? 0) * size;
  D.allow ??= Math.max(0, deep);
  const allow = D.allow * (1 - stage({ at: GROUNDED.ease }, D.u));
  const lift = D.lift = deep > allow ? deep - allow : 0;
  g.position.y += lift;
  return lift;
}

/** The eyes going out: toward a dull tone, the glow gone, over the first half. */
export function dimEyes(model, u) {
  const U = model.eyeMat?.uniforms;
  if (!U?.uColor) return;
  const k = THREE.MathUtils.clamp(u * 2, 0, 1);
  U.uColor.value.lerp(_dull, k);
  if (U.uGlow) U.uGlow.value *= 1 - k;
}
const _dull = new THREE.Color('#3a332e');
