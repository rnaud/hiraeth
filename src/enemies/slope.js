import * as THREE from 'three';

// Living foes on a slope (issue #332): a body drawn square to the world on a 14° slope had its uphill side 20-100 cm
// under the ground (the cart's tracks, a lizard's tail, the heron's long toes, the toad's webbed feet). Each foe on the
// ground reads the plane under it (five ground rays round its feet, once it has moved a little: `SLOPE.every`, `moved`) and eases toward it
// (`SLOPE.rate`), its tilt capped (`SLOPE.max`): the model's root is turned onto the plane, so wheels, tracks, a foot
// that slides on its sole, a tail, a hem, a skirt of feet lie on it as they do on flat ground. Legs stay the kit's:
// every foot is planted on the ground where it lands (src/motion-kit/gait.js, one ray a step) and solved to by IK, and
// the body rides on them measured against that plane (src/motion-kit/body.js `plane`), so only the bumps beyond it tip
// it. A tall body on long legs is turned back toward upright by `upright` of the slope (the heron's, the tripod's, the
// bell walker's: they stand up straight on a hillside, their legs reaching down to it), about its hips.
//
//   follow   share of the ground's tilt the root takes (1: square to the ground)
//   upright  share of that the body is turned back toward upright, on its legs (rigged plans only)
// Not here (left level): the flyers and floaters (over the ground, not on it), the worm (under its sand) and the
// guardians (their own fights: src/temples/boss.js).

export const SLOPE = {
  every: 3,        // frames between ground reads at most (staggered per foe); eased in between
  moved: 0.25,     // m it must have gone since the last read for a new one (a foe standing still reads none)
  stale: 60,       // frames: read again anyway (the ground under it moved: a lift, a platform)
  rate: 7,         // 1/s: how fast the tilt follows the ground (a step, a ledge's edge: no snap)
  max: 0.45,       // rad: the steepest it tilts (about 26°)
  step: 1,         // rise per m: a side of the ground steeper than this (45°) is a step or a drop, not its slope
  kink: 0.3,       // two sides' slopes further apart than this: a ridge or a step's edge, the gentler is kept
  kinds: {
    crab: { follow: 1 }, skitter: { follow: 1 }, centipede: { follow: 1 }, toad: { follow: 1 }, lizard: { follow: 1 },
    hound: { follow: 1 }, heron: { follow: 1, upright: 0.8 }, roller: { follow: 1 }, rootknot: { follow: 1 },
    tripod: { follow: 1, upright: 0.6 }, cart: { follow: 1 }, bell: { follow: 1, upright: 0.5 }, brute: { follow: 1, upright: 0.5 }, woodcutter: { follow: 1, upright: 0.5 },
    blot: { follow: 1 }, shade: { follow: 1, upright: 0.3 }, fencer: { follow: 1, upright: 0.4 },
    // (the humanoids on clips stand upright and reach the slope with their feet: src/enemies/humanoid-rig.js PLANT)
    mummer: { follow: 1, upright: 1 }, mummerking: { follow: 1, upright: 1 }, grunt: { follow: 1, upright: 1 }, hulk: { follow: 1, upright: 1 },
    sentinel: { follow: 1, upright: 1 }, crawler: { follow: 1 }, prowler: { follow: 1, upright: 1 }, warlord: { follow: 1, upright: 1 },   // (issue #726; the oracle hovers: level)
  },
};

let stagger = 0;
const UP = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3(), _q = new THREE.Quaternion();

/** This foe's slope setting, or null (it keeps level). */
export const slopeOf = (f) => (f.def?.hover || f.def?.burrow ? null : SLOPE.kinds[f.archetype] ?? null);

/**
 * Ease f.slope ({ sx, sz }: the ground's rise per m along x and z, eased) toward the plane under it. Off the ground (in
 * the air, leaping, flying off) it eases back to level. Returns f.slope, or null when it keeps level.
 */
export function readSlope(f, physics, dt) {
  const S = slopeOf(f);
  if (!S) return null;
  const s = (f.slope ??= { sx: 0, sz: 0, tx: 0, tz: 0, x: 0, z: 0, k: (stagger++) % SLOPE.every, ready: false });
  const off = !!(f.air || f.hop || f.flight || f.riding || f.alt > 0.05);
  if (off) { s.tx = 0; s.tz = 0; }
  else if (!s.ready || (++s.k % SLOPE.every === 0 && (Math.hypot(f.pos.x - s.x, f.pos.z - s.z) > SLOPE.moved || s.k % SLOPE.stale === 0))) {
    s.x = f.pos.x; s.z = f.pos.z;
    const P = planeUnder(physics, f.pos, THREE.MathUtils.clamp(f.def.radius ?? 0.8, 0.4, 1.2));
    if (P) {
      // (capped: the plane's tilt no steeper than SLOPE.max, its direction kept)
      const g = Math.hypot(P.sx, P.sz), cap = Math.tan(SLOPE.max), k = g > cap ? cap / g : 1;
      s.tx = P.sx * k * S.follow; s.tz = P.sz * k * S.follow;
    } else { s.tx = 0; s.tz = 0; }
  }
  if (!s.ready) { s.sx = s.tx; s.sz = s.tz; s.ready = true; }   // (a new foe: on its slope at once)
  else { const e = 1 - Math.exp(-SLOPE.rate * dt); s.sx += (s.tx - s.sx) * e; s.sz += (s.tz - s.sz) * e; }
  return s;
}

/**
 * The ground's plane at `at` ({ sx, sz }: its rise per m along x and z) from five rays: its feet and r m round them.
 * Each axis takes the slope of either side that reads as ground it stands on, not a step or a ledge's drop: a side
 * steeper than SLOPE.step is left out, and of two sides that disagree (a ridge, the edge of a step) the gentler kept.
 * Null when there is no ground under it.
 */
export function planeUnder(physics, at, r = 0.8) {
  const h = (x, z) => physics?.groundAt?.(x, at.y + 1 + r, z);
  const y0 = h(at.x, at.z);
  if (!Number.isFinite(y0)) return null;
  const axis = (a, b) => {
    const up = Number.isFinite(a) ? (a - y0) / r : NaN, down = Number.isFinite(b) ? (y0 - b) / r : NaN;
    const ok = (d) => Number.isFinite(d) && Math.abs(d) <= SLOPE.step;
    if (ok(up) && ok(down)) return Math.abs(up - down) > SLOPE.kink ? (Math.abs(up) < Math.abs(down) ? up : down) : (up + down) / 2;
    return ok(up) ? up : ok(down) ? down : 0;
  };
  return { sx: axis(h(at.x + r, at.z), h(at.x - r, at.z)), sz: axis(h(at.x, at.z + r), h(at.x, at.z - r)) };
}

/** Turn the root g onto the slope (premultiplied: about the foe's feet, its heading kept). */
export function tiltRoot(g, s) {
  if (!s || (Math.abs(s.sx) < 1e-5 && Math.abs(s.sz) < 1e-5)) return;
  _n.set(-s.sx, 1, -s.sz).normalize();
  g.quaternion.premultiply(_q.setFromUnitVectors(UP, _n));
}

/** The slope along a heading: { ahead (rise per m ahead), side (rise per m to its +x side) }. */
export function slopeAlong(s, heading, out = {}) {
  const sn = Math.sin(heading), c = Math.cos(heading);
  out.ahead = (s?.sx ?? 0) * sn + (s?.sz ?? 0) * c;
  out.side = (s?.sx ?? 0) * c - (s?.sz ?? 0) * sn;
  return out;
}
