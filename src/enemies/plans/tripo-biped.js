import * as THREE from 'three';
import { pivot } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton } from '../humanoid-rig.js';
import { TIER_LOOK } from '../skins.js';

// A two-legged foe's Tripo body on the humanoid foe rig (issue #800, family G: the mummer king, the sentinel, the hulk;
// the dune mummer's recipe, plans/dune-mummer-tripo.js, made shared): the rig's joints (humanoidSkeleton) stood where
// Tripo's biped rig put its joints (the asset's skeleton.json, made by the trial's prepare.mjs,
// references/enemy-redesign-2026-10-30/trials/familyG-tripo/), the mesh skinned to them with Tripo's own weights, so the
// driver's clips pose the very bones the mesh hangs on (never a hidden skeleton copied over, as #768's adapter did).
// Tripo's joints fold onto the rig's 14 (each joint's `fold` in skeleton.json: its spine, hips and clavicles onto the
// torso, its neck and head onto the head, the toes and a hand's tips onto the foot and the hand). The bind pose is the rig's
// joints turned to the mesh's T-pose (each limb's −y along Tripo's bone), then let down to the rig's rest by the caller
// once its own parts are on the bones (`rest`).
//
// Its colours: the asset's COLOR_0 holds the reference's flat colour a part (skeleton.json `palette`); the home skin draws
// them as they are, another skin (or the stronger tier) each part in `colours(role)`.
//
//   tripoBiped(g, src, colours, { rigid })  { rig, J, D, at, hands, look, bones, geo, role, keys, rest(), colours, landmarks }

const v3 = (a) => new THREE.Vector3(...a);
/** The rig's proportions from Tripo's joints (both sides' mean), and each joint's place. */
export function tripoBody(S) {
  const at = Object.fromEntries(S.joints.map((j) => [j.name, v3(j.at)]));
  // (the pelvis at the legs' roots, as a Mixamo rig's Hips are: a rig whose spine starts over them, the hulk's v2.5, put
  //  the ragdoll's pelvis 14 cm over its hips and its knees came up inside the pelvis's sphere and flung the body away)
  at.Hips = at.Hips.clone().setY(Math.min(at.Hips.y, (at.LeftUpLeg.y + at.RightUpLeg.y) / 2));
  const both = (f) => (f('Left') + f('Right')) / 2, d = (a, b) => at[a].distanceTo(at[b]);
  const hip = at.Hips.y;
  const D = { hip, hipX: both((s) => Math.abs(at[`${s}UpLeg`].x)), thigh: both((s) => d(`${s}UpLeg`, `${s}Leg`)), shin: both((s) => d(`${s}Leg`, `${s}Foot`)),
    chest: both((s) => at[`${s}Arm`].y) - hip, shoulder: both((s) => Math.abs(at[`${s}Arm`].x)), upper: both((s) => d(`${s}Arm`, `${s}ForeArm`)), fore: both((s) => d(`${s}ForeArm`, `${s}Hand`)), neck: 0 };
  D.neck = Math.max(0.02, at.Neck.y - hip - D.chest);
  return { D, at };
}

const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
/** j's world rotation made the one that points its −y along dir (world), its parent's read now. */
function pointAlong(j, dir) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_p);
  _q.setFromUnitVectors(DOWN, dir.clone().normalize());
  j.quaternion.copy(_p.invert().multiply(_q));
  j.updateWorldMatrix(false, true);
}
/** 'Left' for the rig's index 1 (its left, +x), 'Right' for 0. */
export const sideName = (i) => (i ? 'Left' : 'Right');

/** sRGB hex → { r, g, b } in 0..1 as COLOR_0 holds them (the texture's own bytes: not turned linear). */
const bytes = (hex) => { const h = parseInt(hex.slice(1), 16); return { r: (h >> 16) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 }; };

/**
 * The body on its source: the rig under g (its joints at Tripo's), the bind pose set, the skin geometry with Tripo's
 * weights folded onto the rig's bones and each vertex's colour role. `colours(role)` → a hex for a skin that is not the
 * home one (null: the asset's own colours). The caller adds its parts to the bones, then skins the geometry (in the
 * bind pose), then calls rest() to let the limbs down to the rig's rest.
 */
export function tripoBiped(g, src, colours = null, { rigid = null, soles = 0, gaze: look0 = {}, neck = new THREE.Vector3() } = {}) {
  const rig = pivot(g, 0, 0, 0, 'rig');
  const S = src.rig ?? src.skeleton, { D, at } = tripoBody(S);
  const J = humanoidSkeleton(rig, D);
  J.torso.position.copy(at.Hips);
  J.head.position.copy(at.Neck).sub(at.Hips).add(neck);
  for (const i of [0, 1]) {
    const s = sideName(i);
    J.legs[i].position.copy(at[`${s}UpLeg`]);
    // (each limb the two sides' mean length, as the rig's D: its IK, the two-handed grip and the stamp's lift reach with D;
    //  Tripo's sides differ by up to 5 cm, and the hulk's other fist missed its club's haft by as much)
    J.knees[i].position.set(0, -D.thigh, 0);
    J.feet[i].position.set(0, -D.shin, 0);
    J.arms[i].position.copy(at[`${s}Arm`]).sub(at.Hips);
    J.elbows[i].position.set(0, -D.upper, 0);
    J.hands[i].position.set(0, -D.fore, 0);
  }
  // the look (at rest: the gaze measures its frame now): its node, under the head's joint, carries the head's weights
  const gaze = [gazePart(g, J.head, { mode: 'turn', ...look0 })], look = gaze[0].node;
  // the bind pose: the rig's limbs along the mesh's T-pose (the hand toward its measured centre)
  g.updateMatrixWorld(true);
  const hc = S.hands;
  for (const i of [0, 1]) {
    const s = sideName(i);
    pointAlong(J.arms[i], at[`${s}ForeArm`].clone().sub(at[`${s}Arm`]));
    pointAlong(J.elbows[i], at[`${s}Hand`].clone().sub(at[`${s}ForeArm`]));
    pointAlong(J.hands[i], v3(hc[s].centre).sub(at[`${s}Hand`]));
    pointAlong(J.legs[i], at[`${s}Leg`].clone().sub(at[`${s}UpLeg`]));
    pointAlong(J.knees[i], at[`${s}Foot`].clone().sub(at[`${s}Leg`]));
    J.feet[i].parent.getWorldQuaternion(_p); J.feet[i].quaternion.copy(_p.invert()); J.feet[i].updateWorldMatrix(false, true);
  }
  g.updateMatrixWorld(true);
  // Tripo's weights folded onto the rig's bones (the four largest kept, normalised)
  const rigJ = { torso: J.torso, head: look, arm0: J.arms[0], arm1: J.arms[1], elbow0: J.elbows[0], elbow1: J.elbows[1], hand0: J.hands[0], hand1: J.hands[1], leg0: J.legs[0], leg1: J.legs[1], knee0: J.knees[0], knee1: J.knees[1], foot0: J.feet[0], foot1: J.feet[1] };
  const bones = [...new Set(Object.values(rigJ))], of = S.joints.map((j) => bones.indexOf(rigJ[j.fold]));
  const src0 = src.geometry, n = src0.attributes.position.count, col = src0.attributes.color;
  const SI0 = src0.attributes.skinIndex, SW0 = src0.attributes.skinWeight, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const acc = new Map();
    for (let k = 0; k < 4; k++) { const w = SW0.getComponent(v, k); if (w <= 0) continue; const b = of[SI0.getComponent(v, k)]; acc.set(b, (acc.get(b) ?? 0) + w); }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, x) => s + x[1], 0) || 1;
    top.forEach(([b, w], k) => { SI[v * 4 + k] = b; SW[v * 4 + k] = w / sum; });
    if (!top.length) { SI[v * 4] = 0; SW[v * 4] = 1; }
  }
  // each vertex's colour role: COLOR_0's nearest of the palette (as it is: sRGB bytes, not linear)
  const pal = S.palette, keys = Object.keys(pal), ref = keys.map((k) => bytes(pal[k])), role = new Uint8Array(n);
  for (let v = 0; v < n; v++) { let best = 0, dd = Infinity; ref.forEach((c, k) => { const e = (c.r - col.getX(v)) ** 2 + (c.g - col.getY(v)) ** 2 + (c.b - col.getZ(v)) ** 2; if (e < dd) { dd = e; best = k; } }); role[v] = best; }
  // a hard part (a gauntlet, a fist, a boot: `rigid` role → 'hand' | 'foot') carried whole on its side's bone, so it bends
  // at its rim, not through it (Tripo's blend across the wrist put the mummer king's gauntlet cuff 3 cm in the ground as it lay)
  const pos = src0.attributes.position;
  // (a stiff sole: everything under `soles` m carried whole on its foot, so a broad flat foot laid on a slope stays flat,
  //  not bent at the ankle with its heel in the ground: the sentinel's)
  if (soles) {
    const feet = [0, 1].map((i) => bones.indexOf(J.feet[i]));
    for (let v = 0; v < n; v++) if (pos.getY(v) < soles) { const b = feet[pos.getX(v) > 0 ? 1 : 0]; SI[v * 4] = b; SW[v * 4] = 1; for (let q = 1; q < 4; q++) { SI[v * 4 + q] = 0; SW[v * 4 + q] = 0; } }
  }
  for (const [r, part] of Object.entries(rigid ?? {})) {
    const k = keys.indexOf(r); if (k < 0) continue;
    for (let v = 0; v < n; v++) {
      if (role[v] !== k) continue;
      const i = pos.getX(v) > 0 ? 1 : 0, b = bones.indexOf(part === 'foot' ? J.feet[i] : J.hands[i]);
      SI[v * 4] = b; SW[v * 4] = 1; for (let q = 1; q < 4; q++) { SI[v * 4 + q] = 0; SW[v * 4 + q] = 0; }
    }
  }
  const geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) geo.setAttribute(k, src0.attributes[k]);
  if (!colours) geo.setAttribute('color', col);
  else {
    // (as the asset's own COLOR_0: the hex's sRGB bytes, so a skin's colour draws as the home skin's of the same hex)
    const out = new Float32Array(n * 3), want = keys.map((k) => bytes(colours(k) ?? pal[k]));
    for (let v = 0; v < n; v++) { const c = want[role[v]]; out[v * 3] = c.r; out[v * 3 + 1] = c.g; out[v * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setIndex(src0.index);
  /** The limbs let down to the rig's rest (after the skin is bound in the bind pose). */
  const rest = () => { for (const j of [...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet]) j.quaternion.identity(); g.updateMatrixWorld(true); };
  // each hand's centre: the middle of the vertices it carries whole (after a rigid gauntlet or fist: where a haft goes
  // through it), else the measured one (skeleton.json)
  const hands = {};
  for (const i of [0, 1]) {
    const b = bones.indexOf(J.hands[i]), c = new THREE.Vector3(); let k = 0;
    for (let v = 0; v < n; v++) if (SI[v * 4] === b && SW[v * 4] > 0.99) { c.x += pos.getX(v); c.y += pos.getY(v); c.z += pos.getZ(v); k++; }
    hands[sideName(i)] = k > 30 ? { ...hc[sideName(i)], centre: c.divideScalar(k).toArray() } : hc[sideName(i)];
  }
  return { rig, J, D, at, hands, look, gaze, bones, geo, role, keys, rest, colours, landmarks: S.landmarks ?? {} };
}

/**
 * The mesh's surface seen along +z (or −z: `dir` −1) at (x, y): the place and normal of the vertex nearest that line
 * within r, the one standing out furthest (m, the source's frame at size 1). For a part laid on the body (a patch, a pad).
 */
export function surfaceAt(src, x, y, r = 0.04, dir = 1) {
  const P = src.geometry.attributes.position, N = src.geometry.attributes.normal;
  let best = -1, far = -Infinity;
  for (let v = 0; v < P.count; v++) { if (Math.hypot(P.getX(v) - x, P.getY(v) - y) > r) continue; const z = P.getZ(v) * dir; if (z > far) { far = z; best = v; } }
  if (best < 0) return null;
  return { at: new THREE.Vector3(P.getX(best), P.getY(best), P.getZ(best)), normal: new THREE.Vector3(N.getX(best), N.getY(best), N.getZ(best)).normalize() };
}
/** A disc (a squashed sphere, rx × ry, t thick) laid on the surface at s, sunk `sink` of its thickness into it: its geometry in `frame`'s space. */
export function discOn(s, rx, ry, t, frame, sink = 0.45) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.normal), c = s.at.clone().addScaledVector(s.normal, t * (1 - 2 * sink));
  const m = new THREE.Matrix4().compose(c, q, new THREE.Vector3(rx, ry, t));
  frame.updateWorldMatrix(true, false);
  return new THREE.SphereGeometry(1, 20, 10).applyMatrix4(m).applyMatrix4(new THREE.Matrix4().copy(frame.matrixWorld).invert());
}

/** A grip on hand i at its measured centre (the mitten's middle: no fingers to close), and that point in the hand's frame. */
export function gripAt(J, hands, i, name) {
  const p = J.hands[i].worldToLocal(v3(hands[sideName(i)].centre));
  // (laid apart from the hand as it lies: what it holds flies as its own piece, src/enemies/foe-ragdoll.js layable)
  const grip = pivot(J.hands[i], p.x, p.y, p.z, name); grip.userData.layApart = true;
  return { grip, at: p };
}

/**
 * The colour of each role for a skin: null for the home skin (the asset's own colours); the stronger tier's (skins.js
 * tierSkin) the reference's colour a role dimmed as the tier dims a palette (TIER_LOOK: its eyes and glows kept), or
 * `own[role]` (a skin's own tier colours: the droids' scorched ceramic); another skin each role from `map` (role →
 * its palette key or a hex), else the reference's.
 */
export function roleColours(skin, palette, home, { own = {}, map = {} } = {}) {
  if (skin.id === home && !skin.tier) return null;
  if (skin.tier) return (role) => own[role] ?? (TIER_LOOK.keep.test(role) ? palette[role] : dim(palette[role]));
  return (role) => { const k = map[role]; return !k ? palette[role] : k.startsWith('#') ? k : skin.palette[k] ?? palette[role]; };
}
const dim = (hex) => { const h = parseInt(hex.slice(1), 16), k = TIER_LOOK.dark; return `#${[(h >> 16) & 255, (h >> 8) & 255, h & 255].map((x) => Math.round(x * k).toString(16).padStart(2, '0')).join('')}`; };
