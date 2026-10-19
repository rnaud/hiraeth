import * as THREE from 'three';
import { frameIn } from './plans/kit.js';

// A foe's eyes on the traveller (issue #508). Once it has noticed him (chasing, winding up, striking, getting its breath
// back, a watcher watching him go, a shy one backing off), its eyes turn to his chest; idle, wandering or going home,
// they look where it is going. Only transforms move (never a shared geometry's vertices: the foes of one kind and skin
// draw the same geometry, src/foe-shapes.js), so no new draw and every eye crosses the bridge as a world matrix (a
// skinned one as its bone's).
//
// An eye (gazePart, at the build) is one of:
//   turn   an eyeball with a pupil, or a head with its eyes fixed on it: its contents turn about its origin (an inner
//          group: the toad's bulging eyes, the blot's, the roller's eyeballs on their stalks, the lizard's head)
//   lean   an eye on a stalk: the stalk leans toward him (the crab's)
//   slide  a glowing spot with no pupil: it slides over its surface toward him (the wisp's eyes on its petals, the
//          brute's brass eye in the boss of its belt, the shade's eyes in the dark of its hood)
// Each eye measures the target in its own host's frame (the joint it hangs on, as last drawn: one inverse a joint a
// frame), against the model's forward and up there at rest, eased, and held within its reach.

/** The gaze's numbers: how far an eye reaches (rad), how fast it follows (per s), where it looks. */
export const GAZE = {
  reach: { yaw: 0.7, up: 0.4, down: 0.5 },   // (rad, the default reach from straight ahead)
  rate: 9,          // per s: how fast an eye eases to where it looks
  chest: 1.25,      // m over the traveller's feet: where it looks at him
  ahead: 4,         // m ahead along its way, when it has not noticed him
  low: 0.08,        // rad under level it looks along its way
  far: 45,          // m: further from the traveller, its eyes are left as they are (not seen)
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();

/**
 * At the build: obj's look follows the gaze. A group gets an inner group holding its contents (turned or leaned about
 * its origin: the group's own pose stays its anim's); a mesh is slid (its position is the gaze's: nothing else may move
 * it). root: the model's group (its forward +z, up +y). o: { mode: 'turn' | 'lean' | 'slide', yaw, up, down (rad),
 * slide (m at the reach), lean (rad at the reach) }. Returns the eye; its `node` is what moves.
 */
export function gazePart(root, obj, o = {}) {
  const mode = o.mode ?? (obj.isMesh ? 'slide' : 'turn');
  let node = obj, host = obj.parent;
  if (!obj.isMesh) {
    node = new THREE.Group(); node.name = 'gaze';
    for (const c of obj.children.slice()) node.add(c);
    obj.add(node); host = obj;
    node.userData.noCollide = true; node.userData.dynamic = true;
  }
  // the model's forward and up in the host's frame, at rest (its rotation to the root, inverted)
  frameIn(host, root, _m).decompose(_p, _q, _s);
  _q.invert();
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(_q), u = new THREE.Vector3(0, 1, 0).applyQuaternion(_q);
  const r = new THREE.Vector3().crossVectors(u, f).normalize();
  // (a spot slides over its own surface: along the model's right and up with the part across it taken off, its facing
  // its +z; on a petal turned 45° from the front, the plain right would push it into the petal)
  const sr = r.clone(), su = u.clone();
  if (mode === 'slide') {
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion);
    if (node !== obj || !obj.isMesh) n.copy(f);
    for (const a of [sr, su]) { a.addScaledVector(n, -a.dot(n)); if (a.lengthSq() > 1e-6) a.normalize(); }
  }
  const R = GAZE.reach;
  return { node, host, mode, rest: node.position.clone(), f, u, r, sr, su, yawMax: o.yaw ?? R.yaw, up: o.up ?? R.up, down: o.down ?? R.down,
    slide: o.slide ?? 0, lean: o.lean ?? 0.45, yaw: 0, pitch: 0 };
}

/**
 * Where a foe looks this frame (before its pose): the traveller's chest once it has noticed him, else ahead along its
 * way. Kept on f.gaze: { at (world), watching, yaw (rad from its heading, eased: a headless body's twist) }.
 */
export function gazeAim(f, player, dt) {
  const G = (f.gaze ??= { at: new THREE.Vector3(), watching: false, yaw: 0, px: f.pos.x, pz: f.pos.z, dir: f.heading });
  const watching = G.watching = watchingHim(f, player);
  // (its way: the direction it moved, eased; standing, its heading)
  const mx = f.pos.x - G.px, mz = f.pos.z - G.pz;
  G.px = f.pos.x; G.pz = f.pos.z;
  const moved = Math.hypot(mx, mz) > 0.15 * Math.max(dt, 1e-3);
  const want = moved ? Math.atan2(mx, mz) : f.heading;
  G.dir += wrap(want - G.dir) * (1 - Math.exp(-6 * dt));
  const chest = f.pos.y + (f.over ?? 0) + (f.def?.height ?? 1) + (f.alt ?? 0);   // (its way's height: gazeApply holds it a little under level)
  if (watching) G.at.set(player.pos.x, player.pos.y + GAZE.chest, player.pos.z);
  else G.at.set(f.pos.x + Math.sin(G.dir) * GAZE.ahead, chest, f.pos.z + Math.cos(G.dir) * GAZE.ahead);
  const yaw = THREE.MathUtils.clamp(wrap(Math.atan2(G.at.x - f.pos.x, G.at.z - f.pos.z) - f.heading), -GAZE.reach.yaw, GAZE.reach.yaw);
  G.yaw += (yaw - G.yaw) * (1 - Math.exp(-GAZE.rate * dt));
  return G;
}

/** Has it noticed him, and is he someone to look at? */
export function watchingHim(f, P) {
  if (!P?.pos || P.dead || f.dying || !f.alive || f.dead !== undefined || f.stunned > 0) return false;
  if (f.dist > GAZE.far) return false;
  if (f.state === 'chase' || f.state === 'wind' || f.state === 'strike' || f.state === 'recover') return true;
  if (f.state !== 'idle') return false;
  const C = f.def?.calm, sight = f.def?.sight ?? 12;
  return (f.watcher && f.dist < sight) || (!!C?.shy && f.dist < C.shy) || (f.provoked && f.dist < sight);
}

/**
 * The eyes turned, leaned or slid toward `at` (world), eased, within their reach (after the pose: the eye's own); `way`:
 * `at` is a point on its way, looked at a little under level whatever its height.
 */
export function gazeApply(eyes, at, dt, way = false) {
  let host = null;
  const k = 1 - Math.exp(-GAZE.rate * dt);
  for (const E of eyes) {
    if (E.host !== host) { host = E.host; _m.copy(host.matrixWorld).invert(); }
    _d.copy(at).applyMatrix4(_m).sub(E.rest);
    const x = _d.dot(E.r), y = _d.dot(E.u), z = _d.dot(E.f);
    // (behind it: held at the side it is on, not swung across)
    const yaw = THREE.MathUtils.clamp(Math.atan2(x, z), -E.yawMax, E.yawMax);
    const pitch = THREE.MathUtils.clamp(way ? -GAZE.low : Math.atan2(y, Math.hypot(x, z)), -E.down, E.up);
    E.yaw += (yaw - E.yaw) * k; E.pitch += (pitch - E.pitch) * k;
    place(E);
  }
}

/** Each eye back to rest at once (a gallery's picture, a foe let go). */
export function gazeRest(eyes) { for (const E of eyes) { E.yaw = 0; E.pitch = 0; place(E); } }

function place(E) {
  const n = E.node;
  if (E.mode === 'slide') {
    const sx = E.yaw / E.yawMax, sy = E.pitch >= 0 ? E.pitch / Math.max(E.up, 1e-3) : E.pitch / Math.max(E.down, 1e-3);
    n.position.copy(E.rest).addScaledVector(E.sr, sx * E.slide).addScaledVector(E.su, sy * E.slide * 0.7);
  } else if (E.mode === 'lean') {
    // (the stalk's tip toward him: rolled to his side, tipped back as he is higher)
    const a = E.lean / E.yawMax;
    n.quaternion.setFromAxisAngle(E.f, -E.yaw * a).multiply(_q2.setFromAxisAngle(E.r, -E.pitch * a));
  } else {
    // (yaw about its up, then pitch: forward tipped up toward him)
    n.quaternion.setFromAxisAngle(E.u, E.yaw).multiply(_q2.setFromAxisAngle(E.r, -E.pitch));
  }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
