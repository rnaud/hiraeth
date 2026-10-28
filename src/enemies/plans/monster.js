import * as THREE from 'three';
import { materials, add, many, merged, skinBy, pivot, tubeGeometry, ease, eyeColor, finish, plate, shellPlate } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver, Sway, HOLD_AT } from '../humanoid-rig.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { twoBone } from '../../motion-kit/ik.js';
import { lathe, tatters, spearParts, bowParts, bowCord, drawCord, drawOf, spearHold, bowHold } from './mummer.js';
import { Fist, fingerPivots, Wielder, SWORD_WRIST } from '../wield.js';

// Roster v4's monsters (issue #726; docs/design/enemy-roster-v4.md): one roster in every world, one look each (its sheet's,
// in its stronger tier too: #748). On the humanoid rig like the mummers
// (src/enemies/humanoid-rig.js: the traveller's clips on their own proportions, the procedural layers on top).
//
// The grunt (`grunt`), to its picked sheet (references/enemy-archetypes/grunt/sheet-1.jpg): 1.3 m, the traveller's
// chest. A tomato-red monster, all head and belly: a big round head with knobbly bumps on its scalp, long pointed ears
// straight out to the sides, round yellow eyes under a heavy brow, a flat pig snout, a wide grin with two small tusks
// up from its lower jaw; a pot belly on short bowed legs, wide three-toed clawed feet; arms to its thighs, four-fingered
// clawed hands; a khaki loincloth with a ragged hem, a brown leather strap across its chest from its left shoulder with an
// iron ring at the front. In its fist a knobbly grey-brown club (its sheet's attack pose: both fists high over its head),
// or a spear or a bow from the camp's rack, or nothing (then it digs up rocks).
//
// The hulk (`hulk`), to its picked sheet (references/enemy-archetypes/hulk/sheet-1.jpg): 2.7 m, half again the
// traveller. Slate-blue skin, a pale icy belly, a hunched back: a small head low and forward between its shoulders, a
// heavy jaw with two lower fangs, one ivory horn up from its brow; long heavy arms to its knees, big four-fingered hands;
// thick legs, broad bare feet; a ragged kilt of hide patches (brown, olive, tan) on a rope belt knotted at the front. A
// long dark club with iron bands (the brief's "spiked"; the sheet draws only bands, and so does the game since the shape pass).
//
// Draws: every part of a material one skinned mesh on the rig's joints (kit.js skinBy): eight (grunt) and nine (hulk).

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _w = new THREE.Vector3();
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

/** A cone of radius r, l long, its base at `at` and its point along dir (arrays): a claw, a spine. */
function spike(at, dir, r, l, n = 5) {
  const d = new THREE.Vector3(...dir).normalize();
  return new THREE.ConeGeometry(r, l, n).translate(0, l / 2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)).translate(...at);
}
/**
 * A clawed hand on its joint, hanging down it: a palm, three jointed fingers a little splayed and curled in, a thumb, each
 * tipped with a claw. Long thin fingers with knuckles, not a mitten (the shape pass, #726). The fingers on the fist's two
 * pivots (src/enemies/wield.js Fist, #744): they close round what the hand holds. Returns the Fist.
 */
function clawHand(hand, s, size, skinM, clawM) {
  const r = 0.03 * size, palm = [new THREE.SphereGeometry(r * 1.55, 9, 7).scale(1.08, 1.25, 0.62).translate(0, -r * 1.25, r * 0.05)];
  const K0 = [0, -r * 2.45, r * 0.2], M0 = [0, K0[1] - r * 1.85, K0[2] + r * 0.45], E0 = [0, M0[1] - r * 1.05, M0[2] + r * 1.0];
  const { knuckles, tips } = fingerPivots(hand, K0, M0);
  const sub = (p, o) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const prox = [], dist = [], claw = [];
  for (let i = -1; i <= 1; i++) {
    const sp = i * 0.2, x = i * r * 1.0, l = i ? 0.9 : 1;
    const k = [x, -r * 2.45, r * 0.2], m = [x + Math.sin(sp) * r * 1.8 * l, k[1] - r * 1.85 * l, k[2] + r * 0.45], e = [m[0] + Math.sin(sp) * r * 1.2 * l, m[1] - r * 1.05 * l, m[2] + r * 1.0 * l];
    prox.push(new THREE.SphereGeometry(r * 0.5, 5, 4).translate(...sub(k, K0)), bone(sub(k, K0), sub(m, K0), r * 0.46, 5));
    dist.push(bone(sub(m, M0), sub(e, M0), r * 0.38, 5));
    claw.push(spike(sub(e, M0), [e[0] - m[0], e[1] - m[1] - r * 0.4, e[2] - m[2]], r * 0.3, r * 1.25));
  }
  const t0 = [s * r * 1.35, -r * 1.2, r * 0.55], t1 = [s * r * 2.2, -r * 2.4, r * 1.25];
  many(hand, [...palm, bone(t0, t1, r * 0.4, 5)], skinM);
  many(hand, [spike(t1, [s * 0.4, -0.7, 0.6], r * 0.28, r * 1.0)], clawM);
  many(knuckles, prox, skinM); many(tips, dist, skinM); many(tips, claw, clawM);
  // (the haft across the palm's lower half, in front of it, just under the knuckles)
  return new Fist(knuckles, tips, { K: [K0[1], K0[2]], M: [M0[1], M0[2]], E: [E0[1], E0[2]], finger: r * 0.42, haft: (rh) => [0, K0[1] - r * 0.35, r * 0.72 + rh * 0.92] });
}
/** A wide clawed foot on its ankle, toes splayed forward (`toes` of them), each with a claw (or a toenail). */
function clawFoot(size = 1, toes = 3) {
  const s = size, skin = [new THREE.SphereGeometry(0.06 * s, 9, 6).scale(1.15, 0.5, 1.45).translate(0, -0.01 * s, 0.03 * s)], claw = [];
  const half = (toes - 1) / 2;
  for (let i = 0; i < toes; i++) {
    const u = i - half, a = u * (toes > 3 ? 0.2 : 0.36), x = u * (toes > 3 ? 0.03 : 0.036) * s;
    skin.push(new THREE.CapsuleGeometry(0.02 * s, 0.05 * s, 3, 6).rotateX(Math.PI / 2).rotateY(a).translate(x, -0.022 * s, 0.1 * s));
    claw.push(new THREE.ConeGeometry(0.012 * s, 0.03 * s, 5).rotateX(Math.PI / 2 + 0.15).rotateY(a).translate(x + Math.sin(a) * 0.04 * s, -0.02 * s, 0.135 * s));
  }
  return { skin, claw };
}
/** Points along a curve on an ellipsoid's front (centre c, radii r): a mouth line from x0 to x1 at y(x). */
function onFace(c, r, xs, y) {
  return xs.map((x) => { const yy = y(x), k = 1 - ((x - c[0]) / r[0]) ** 2 - ((yy - c[1]) / r[1]) ** 2; return new THREE.Vector3(x, yy, c[2] + r[2] * Math.sqrt(Math.max(0, k)) + 0.004); });
}
const span = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

/**
 * A lofted limb down its joint (-y), `len` long (the shape pass, #726: muscle masses, a knee, a calf, an ankle, not a
 * cylinder): rings at shares t of its length, each an ellipse rx across × rz front to back about a centre moved dz
 * forward (+z) and dx out (× s, the side: + its left); between two keys the radii ease (smoothstep), so a mass swells and
 * falls off. prof: [[t, rx, rz, dz = 0, dx = 0], …] from the joint (t 0) to the far end (t 1). Capped at both ends.
 */
export function loftLimb(len, prof, s = 1, sides = 8, sub = 2) {
  const rings = [];
  for (let k = 0; k < prof.length; k++) {
    const a = prof[k], b = prof[k + 1];
    if (!b) { rings.push(a); break; }
    for (let j = 0; j < sub; j++) { const u = j / sub, e = u * u * (3 - 2 * u); rings.push(a.map((x, n) => (n ? (x ?? 0) + ((b[n] ?? 0) - (x ?? 0)) * e : x + (b[0] - x) * u))); }
  }
  const pos = [], uv = [], idx = [], n = rings.length;
  for (let i = 0; i < n; i++) {
    const [t, rx, rz, dz = 0, dx = 0] = rings[i];
    for (let j = 0; j < sides; j++) { const a = (j / sides) * Math.PI * 2; pos.push(s * dx + Math.sin(a) * rx, -t * len, dz + Math.cos(a) * rz); uv.push(j / sides, t); }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
    idx.push(a, c, b, b, c, d);
  }
  // (the caps: a point at each end's centre)
  for (const [i, flip] of [[0, true], [n - 1, false]]) {
    const [t, , , dz = 0, dx = 0] = rings[i], o = pos.length / 3;
    pos.push(s * dx, -t * len, dz); uv.push(0.5, t);
    for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + ((j + 1) % sides); if (flip) idx.push(o, a, b); else idx.push(o, b, a); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/**
 * A tube lofted along a curve (points), its section an ellipse `w(u)` across × `h(u)` (u 0..1 along it), the section's
 * h along the curve's normal: a ram's horn (flattened, ridged, tapering), a lizard's head, a lock of a mane, a claw.
 * Frames: the curve's Frenet frames (smooth on a spiral), or with `up` the section's h kept along that axis. Capped at
 * its root; its far end as thin as w and h make it.
 */
export function loftAlong(points, w, h = w, sides = 9, steps = 28, up = null) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p)));
  const F = up ? null : curve.computeFrenetFrames(steps, false), pos = [], uv = [], idx = [], U = up && new THREE.Vector3(...up).normalize();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, p = curve.getPointAt(u), rw = w(u), rh = h(u);
    let N, B;
    if (F) { N = F.normals[i]; B = F.binormals[i]; } else { const T = curve.getTangentAt(u); N = U.clone().addScaledVector(T, -U.dot(T)).normalize(); B = new THREE.Vector3().crossVectors(T, N); }
    for (let j = 0; j < sides; j++) { const a = (j / sides) * Math.PI * 2, cx = Math.cos(a) * rh, cy = Math.sin(a) * rw; pos.push(p.x + N.x * cx + B.x * cy, p.y + N.y * cx + B.y * cy, p.z + N.z * cx + B.z * cy); uv.push(j / sides, u); }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
    idx.push(a, b, c, b, d, c);
  }
  const p0 = curve.getPointAt(0), o = pos.length / 3;
  pos.push(p0.x, p0.y, p0.z); uv.push(0.5, 0);
  for (let j = 0; j < sides; j++) idx.push(o, (j + 1) % sides, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A value eased between keys [[u, v], …] (u rising): a profile along a loft. */
export function keyed(u, K) {
  if (u <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (u <= K[i][0]) { const a = K[i - 1], b = K[i], x = (u - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * x * x * (3 - 2 * x); }
  return K.at(-1)[1];
}
/** loftLimb's profile laid from a to b (arrays) instead of down -y: a bent limb's segment, a digitigrade shank. */
function loftBone(a, b, prof, s = 1, sides = 9) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), l = d.length();
  return loftLimb(l, prof, s, sides).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize())).translate(...a);
}
/** A curved claw from `at` along dir (arrays), hooking down toward `hook` (its tip bending that way), r at its root. */
function hookClaw(at, dir, hook, r, l) {
  const A = new THREE.Vector3(...at), D = new THREE.Vector3(...dir).normalize(), H = new THREE.Vector3(...hook).normalize();
  const pts = [A, A.clone().addScaledVector(D, l * 0.5).addScaledVector(H, l * 0.05), A.clone().addScaledVector(D, l * 0.85).addScaledVector(H, l * 0.3)];
  return loftAlong(pts, (u) => r * (1 - u * 0.92), (u) => r * 1.25 * (1 - u * 0.92), 5, 5, hook);
}
/**
 * The hips raised `up` m (the rig's; less where the leg would not reach) over a leg whose foot stays where the clip
 * planted it (leg i reaches it again by two-bone IK, the knee forward, the sole's turn kept): a standing leg straightened
 * under a lifted body (`tilt`: the body first leant about z that much, rad).
 */
const _bq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _h0 = new THREE.Vector3(), _f0 = new THREE.Vector3(), _kn = new THREE.Vector3(), _fwd = new THREE.Vector3(), _fq = new THREE.Quaternion(), _down = new THREE.Vector3(0, -1, 0);
function liftOver(J, i, up, tilt = 0) {
  const leg = J.legs[i], knee = J.knees[i], foot = J.feet[i];
  J.body.updateWorldMatrix(true, true);
  foot.getWorldPosition(_f0); foot.getWorldQuaternion(_fq);
  if (tilt) { J.body.rotateZ(tilt); J.body.updateMatrixWorld(true); }   // (its weight leant over that foot, the foot kept)
  const s = J.body.getWorldScale(_kn).y || 1;
  // (no higher than the leg reaches, a little bent: the foot never pulled off the ground)
  leg.getWorldPosition(_h0);
  const R = (J.D.thigh + J.D.shin) * s * 0.96, h2 = (_h0.x - _f0.x) ** 2 + (_h0.z - _f0.z) ** 2, dy = _h0.y - _f0.y;
  up = Math.max(0, Math.min(up, (Math.sqrt(Math.max(0, R * R - h2)) - dy) / s));
  J.body.position.y += up; J.body.updateMatrixWorld(true);
  leg.getWorldPosition(_h0);
  _fwd.set(0, 0, 1).applyQuaternion(J.body.getWorldQuaternion(_pq));
  twoBone(_h0, _f0, J.D.thigh * s, J.D.shin * s, _fwd, _kn);
  const aim = (j, dir) => { j.parent.getWorldQuaternion(_pq).invert(); j.quaternion.setFromUnitVectors(_down, dir.normalize().applyQuaternion(_pq)); j.updateMatrixWorld(true); };
  aim(leg, _kn.clone().sub(_h0));
  knee.getWorldPosition(_h0); aim(knee, _f0.clone().sub(_h0));
  foot.parent.getWorldQuaternion(_pq).invert(); foot.quaternion.copy(_pq.multiply(_fq)); foot.updateMatrixWorld(true);
}
/** A hem (a kilt, a loincloth) on the torso hung from the hips instead: its turn the hips' (body's), then its sway. */
function hangFromHips(hem, body, sx, sz) {
  hem.parent.updateWorldMatrix(true, false); body.updateWorldMatrix(true, false);
  hem.quaternion.copy(hem.parent.getWorldQuaternion(_pq).invert().multiply(body.getWorldQuaternion(_bq)));
  hem.rotateX(sx); hem.rotateZ(sz);
}

/** The grunt's knobbly club along +y from the grip: a log thickening to a lumpy head, leather wound round its grip. */
function knobClub(L = 0.82) {
  const wood = [new THREE.CylinderGeometry(0.068, 0.03, L, 8, 4).translate(0, L * 0.4, 0), new THREE.SphereGeometry(0.075, 9, 7).scale(1, 1.4, 1).translate(0, L * 0.84, 0)];
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4, y = L * (0.5 + 0.4 * ((i * 0.37) % 1)), rr = 0.05 + 0.03 * ((y / L - 0.4) / 0.6);
    wood.push(new THREE.SphereGeometry(0.02 + 0.008 * (i % 3), 6, 4).translate(Math.sin(a) * rr, y, Math.cos(a) * rr));
  }
  return { wood, leather: [0, 0.05, 0.1].map((y) => new THREE.TorusGeometry(0.034, 0.011, 4, 10).rotateX(Math.PI / 2).translate(0, y - 0.03, 0)) };
}
/** The hulk's long club along +y from the grip: a dark log thickening to its end, iron bands near it and at the grip (the
 * sheet draws bands only, no studs). */
function bandedClub(L = 1.75) {
  const wood = [new THREE.CylinderGeometry(0.12, 0.055, L, 10, 3).translate(0, L * 0.38, 0), new THREE.CylinderGeometry(0.11, 0.12, 0.06, 10).translate(0, L * 0.88 + 0.03, 0)];
  const iron = [L * 0.6, L * 0.78, L * 0.86].map((y) => new THREE.CylinderGeometry(0.035 + 0.075 * (y / L) + 0.012, 0.035 + 0.075 * (y / L) + 0.012, 0.05, 10).translate(0, y - L * 0.12, 0));
  iron.push(new THREE.CylinderGeometry(0.064, 0.064, 0.05, 10).translate(0, -0.02, 0));
  return { wood, iron };
}

// ------------------------------------------------------------------ the grunt

/** Its proportions (m, at size 1): humanoidSkeleton's D. 1.3 m to the bumps on its scalp. */
export const GRUNT_BODY = { hip: 0.46, hipX: 0.12, thigh: 0.2, shin: 0.19, chest: 0.34, shoulder: 0.215, upper: 0.22, fore: 0.2, neck: 0.07 };
/** Each attack's clip (humanoid-rig.js stateClip): its anticipation `from` → `load` (the held telegraph), its cut, its follow-through. */
export const GRUNT_MOVES = {
  // the club overhead: the great sword's overhead (the charged cut's), both fists high with the club over its head and
  // leaning back on its heels (the sheet's attack pose); the step forward is the mind's lunge
  club: { clip: 'gs_slash_1', from: 0.2, load: 0.53, cut: 0.62, to: 1.05, lean: -0.18, pose: 'overhead' },
  // the lunge: the great sword's slide attack, sunk low with the club cocked back by its hip, then the spring (the mind
  // carries it 3.4 m across the strike)
  lunge: { clip: 'gs_slide_attack', from: 0.7, load: 0.95, cut: 1.25, to: 1.45 },
  // the rack's spear: the sword's thrust (the dash cut's), the shaft drawn back under its arm
  jab: { clip: 'ss_attack_2', from: 0.05, load: 0.45, cut: 0.57, to: 0.95 },
  // the rack's bow: the mummer's volley (the guard's braced stance, the arms by hand: side-on, the cord drawn back)
  volley: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'bow' },
  // the rock: the jumping overhead without its hop, the rock in both hands high over its head, held, thrown as it leaves
  rock: { clip: 'gs_jump_attack', from: 0.15, load: 0.85, cut: 1.1, to: 1.45, ground: true, release: 0.78 },
};
const GRUNT_SPEEDS = { walk: 0.6, jog: 1.8, sprint: 3.6 };
/**
 * How it holds what it holds (src/enemies/wield.js, #744; dirs in the chest's frame, x its left, y up, z ahead, unless
 * the key says): the club in its right fist, its head down and forward off the swinging arm; the overhead both fists
 * stacked on the haft, the club up and back over its right shoulder (the sheet's attack pose), over its head and down
 * before it; the lunge cocked back by its hip, then swung through ahead. The spear and the bow the mummer's.
 */
export const GRUNT_HOLD = {
  club: { side: 0, r: 0.045, reach: [0.8, 0.09], head: 0.1, carry: { dir: [0.12, -0.5, 0.86] },
    moves: {
      club: { wind: [-0.4, 0.72, -0.56], via: [-0.1, 0.85, 0.5], hit: [0, -0.55, 0.84], follow: [0, -0.8, 0.6], both: { at: 0.11, from: -0.07, to: 0.4, phases: ['wind', 'strike'] } },
      lunge: { wind: [-0.35, 0.25, -0.9], via: [-0.6, 0.1, 0.8], hit: [0.25, -0.2, 0.95] },
    },
    poses: { clutch: { dir: [0.1, -0.5, 0.86] } } },
  spear: spearHold(1.55),
  bow: bowHold(0.4),
};

export function gruntModel(skin) {
  const P = skin.palette, M = materials('grunt', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, GRUNT_BODY), D = GRUNT_BODY;
  const skinB = M.mat('skinBuild', P.skin), clothB = M.mat('clothBuild', P.cloth), leatherB = M.mat('leatherBuild', P.leather), ironB = M.mat('ironBuild', P.iron);
  const woodB = M.mat('woodBuild', P.wood), boneB = M.mat('boneBuild', P.bone), inkB = M.mat('inkBuild', P.ink);
  const eyeM = M.own('eye', P.eye, { glow: 0.55 });
  const T = J.torso;
  // the pot belly: a round barrel from the hips to the shoulders, the belly a ball pushed out before it, a little low
  add(T, lathe([[0.001, -0.08], [0.17, -0.06], [0.235, 0.02], [0.255, 0.12], [0.25, 0.21], [0.232, 0.27], [0.2, 0.32], [0.155, 0.37], [0.09, 0.42], [0.001, 0.44]], 20, 0.84), skinB);
  many(T, [new THREE.SphereGeometry(0.24, 16, 12).scale(1, 0.95, 0.9).translate(0, 0.1, 0.075),
    // (its chest a little fuller under the strap; the shoulders sloping down into its arms, not a block)
    new THREE.SphereGeometry(0.15, 12, 8).scale(1.2, 0.62, 0.78).translate(0, 0.3, 0.04)], skinB);
  // its navel
  add(T, new THREE.SphereGeometry(0.012, 6, 4).scale(1, 0.6, 0.5), inkB, 0, 0.06, 0.29);
  // the leather strap across its chest from its left shoulder to its right hip, an iron ring at the front
  many(T, [new THREE.CylinderGeometry(0.29, 0.29, 0.05, 28, 1, true).rotateZ(0.62).scale(1, 1, 0.93).translate(0, 0.17, 0.03)], leatherB);
  many(T, [new THREE.TorusGeometry(0.03, 0.009, 5, 12).rotateZ(0.62).translate(0.06, 0.22, 0.3)], ironB);
  // the loincloth: a wrap round its hips under the belly, a ragged hem, a flap hanging down the front
  const hem = pivot(T, 0, -0.06, 0, 'hem');
  const flap = [];
  for (let i = 0; i < 6; i++) {
    const a = -0.55 + 0.22 * i, l = 0.09 + 0.04 * Math.abs(Math.sin(i * 2.1 + 0.5)) - 0.025 * Math.abs(i - 2.5) / 2.5;
    flap.push(new THREE.ConeGeometry(0.06, l, 3, 1).rotateY(Math.PI / 6).scale(1, 1, 0.25).rotateX(Math.PI).translate(0, -l / 2, 0).rotateX(-0.08).translate(0, 0, 0.27).rotateY(a).scale(1, 1, 0.86).translate(0, -0.075, 0));
  }
  // (short at its sides, the hem at mid-thigh: its legs show to the hips, as the sheet draws them)
  many(hem, [lathe([[0.27, -0.08], [0.25, -0.02], [0.235, 0.06]], 18, 0.86), ...tatters(9, 0.27, -0.075, 0.045, 0.86, 0.11), ...flap], clothB);
  const fists = [null, null];
  // arms: short, thick, to its thighs (lofted: a round shoulder falling into the upper arm, a fleshy forearm narrowing to
  // the wrist); four-fingered clawed hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    fists[i] = clawHand(J.hands[i], s, 1.35, skinB, boneB);
    many(arm, [loftLimb(D.upper, [[-0.27, 0.008, 0.008], [-0.2, 0.042, 0.041], [-0.1, 0.058, 0.057, 0, 0.003], [0.04, 0.064, 0.062, 0, 0.006], [0.35, 0.06, 0.058, 0.006], [0.75, 0.05, 0.05], [1, 0.046, 0.046]], s, 10)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.046, 8, 6), loftLimb(D.fore, [[0, 0.046, 0.046], [0.3, 0.053, 0.05, 0.005], [0.8, 0.036, 0.032], [1.02, 0.033, 0.03]], s)], skinB);
  });
  // legs: short and bowed, thick thighs, wide clawed feet
  J.legs.forEach((leg, i) => {
    const f = clawFoot(1.25, 3), s = i ? 1 : -1;
    // (lofted: a round thigh falling to a knobbed knee, a calf behind the shin, a narrow ankle over the wide foot)
    many(leg, [loftLimb(D.thigh, [[-0.15, 0.04, 0.04], [0.05, 0.082, 0.08], [0.45, 0.074, 0.074, 0.008], [0.9, 0.054, 0.054], [1.05, 0.05, 0.05]], s)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0, 0.012), loftLimb(D.shin, [[0, 0.05, 0.05], [0.3, 0.052, 0.058, -0.012], [0.75, 0.036, 0.036], [1, 0.034, 0.034]], s)], skinB);
    many(J.feet[i], f.skin, skinB); many(J.feet[i], f.claw, boneB);
  });
  // the head: big and round, a heavy brow, the flat snout, the wide grin with two small tusks, long pointed ears out to
  // its sides, knobbly bumps over its scalp; round yellow eyes with black pupils
  const H = J.head;
  const face = [0, 0.075, 0.075], faceR = [0.19, 0.12, 0.17];
  many(H, [new THREE.CylinderGeometry(0.1, 0.13, 0.08, 10).translate(0, -0.01, 0),
    new THREE.SphereGeometry(0.21, 16, 12).scale(1.07, 0.95, 0.95).translate(0, 0.17, 0.02),
    new THREE.SphereGeometry(1, 14, 10).scale(...faceR).translate(...face),
    new THREE.CapsuleGeometry(0.035, 0.2, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.9, 0.8).translate(0, 0.235, 0.165),
    new THREE.CylinderGeometry(0.07, 0.085, 0.07, 14).rotateX(Math.PI / 2).scale(1.45, 0.95, 1).translate(0, 0.125, 0.21),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.065, 0.34, 6).scale(1, 1, 0.32).rotateZ(-s * (Math.PI / 2 - 0.22)).rotateY(-s * 0.18).translate(s * 0.34, 0.215, -0.02)),
    ...Array.from({ length: 9 }, (_, i) => { const a = -1.2 + (i % 5) * 0.6, b = 0.55 + Math.floor(i / 5) * 0.4, r = 0.2; return new THREE.SphereGeometry(0.022 + 0.008 * (i % 2), 6, 4).translate(Math.sin(a) * Math.cos(b) * r * 1.07, 0.17 + Math.sin(b) * r * 0.95, Math.cos(a) * Math.cos(b) * r * 0.95 - 0.02); })], skinB);
  // (the grin: an ink line across its lower face; the nostrils; the tusks up from its lower jaw)
  many(H, [tubeGeometry(onFace(face, faceR, span(-0.13, 0.13, 9), (x) => 0.04 + 1.6 * x * x), 0.0045),
    ...[-1, 1].map((s) => new THREE.SphereGeometry(0.015, 6, 4).scale(1, 1.2, 0.5).translate(s * 0.035, 0.122, 0.246))], inkB);
  many(H, [-1, 1].map((s) => new THREE.ConeGeometry(0.017, 0.055, 6).rotateZ(-s * 0.15).translate(s * 0.085, 0.085, 0.215)), boneB);
  const eyes = pivot(H, 0, 0, 0, 'eyes');
  for (const s of [-1, 1]) add(eyes, new THREE.SphereGeometry(0.034, 10, 8).scale(1, 1, 0.6), eyeM, s * 0.078, 0.2, 0.185);
  many(H, [-1, 1].map((s) => new THREE.SphereGeometry(0.014, 6, 5).scale(1, 1, 0.5).translate(s * 0.074, 0.2, 0.207)), inkB);
  // the weapons: the club, the spear in the right fist, the bow in the left; each its own pivot (shown, hidden, dropped)
  const grip = pivot(J.hands[0], 0, -0.06, 0.012, 'grip'), gripL = pivot(J.hands[1], 0, -0.06, 0.012, 'grip l');
  const club = pivot(grip, 0, 0, 0, 'club'), spear = pivot(grip, 0, 0, 0, 'spear'), bow = pivot(gripL, 0, 0, 0, 'bow');
  const build = (node, parts) => { for (const [k, geos] of Object.entries(parts)) if (geos.length) many(node, geos, { wood: woodB, rope: leatherB, leather: leatherB, iron: ironB, rag: clothB }[k]); };
  build(club, knobClub()); build(spear, spearParts(1.55)); build(bow, bowParts(0.4, false));
  const cord = bowCord(bow, 0.4, leatherB);
  const dropped = pivot(g, 0, 0, 0, 'dropped weapon');
  const dClub = pivot(dropped, 0, 0, 0, 'dropped club'), dSpear = pivot(dropped, 0, 0, 0, 'dropped spear'), dBow = pivot(dropped, 0, 0, 0, 'dropped bow');
  build(dClub, knobClub()); build(dSpear, spearParts(1.55)); build(dBow, bowParts(0.4));
  const held = { club, spear, bow }, lying = { club: dClub, spear: dSpear, bow: dBow };
  // (its stance over the clip's: bow-legged, the feet turned out, a little hunched over its belly)
  const style = () => { J.legs[0].rotateZ(-0.12); J.legs[1].rotateZ(0.12); J.knees[0].rotateZ(0.08); J.knees[1].rotateZ(-0.08); J.feet[0].rotateZ(0.04); J.feet[1].rotateZ(-0.04); J.feet[0].rotateY(-0.2); J.feet[1].rotateY(0.2); };
  const driver = new HumanoidDriver(J, rig, { moves: GRUNT_MOVES, speeds: GRUNT_SPEEDS, style, seat: 0.14 });
  const wield = new Wielder(J, driver, { fists, grips: [grip, gripL], weapons: GRUNT_HOLD });
  let draw = 0;
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.9, up: 0.5, down: 0.5 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [clothB], into: M.mat('cloth', P.cloth, vc) }, { from: [leatherB], into: M.mat('leather', P.leather, vc) },
    { from: [ironB], into: M.mat('iron', P.iron, vc) }, { from: [woodB], into: M.mat('wood', P.wood, vc) }, { from: [boneB], into: M.mat('bone', P.bone, vc) }, { from: [inkB], into: M.mat('ink', P.ink, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(2.6, 0.3, 0, 0.25);
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.cloth, P.ink],
    driver, joints: J, wield, fists,
    tell: (id) => (id === 'volley' ? gripL : id === 'rock' ? J.hands[0] : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      const want = driver.update(f, c);
      const sw = sway.update(dt, driver.speed, f.heading);
      hangFromHips(hem, J.body, sw.x, sw.z);
      // what it holds (f.weapon: 'club', 'spear', 'bow', or 'none'); nothing while it is disarmed or off to the rack
      const W = f.disarmed ? null : f.weapon ?? 'club';
      for (const [k, node] of Object.entries(held)) node.scale.setScalar(k === W ? 1 : 1e-3);
      // (its fists closed round it, its line aimed by what the body does: GRUNT_HOLD; the bow's cord drawn back by the
      // right fist through the volley's draw)
      wield.update(f, want, c, held[W] ? W : null, { pinch: [W === 'bow' && draw > 0.05, false] });
      draw = drawOf(f, want, dt, 'volley', draw);
      drawCord(cord, W === 'bow' && draw > 0.001 ? J.hands[0].localToWorld(_w.copy(fists[0].fit(0.006).at)) : null, draw);
      // one it dropped lies where it fell (not one it is off to take from the rack)
      for (const node of Object.values(lying)) node.scale.setScalar(1e-3);
      const S = f.disarmed, lie = S && !S.rack ? lying[f.droppedWeapon ?? f.weapon] : null;
      if (lie) {
        g.updateMatrixWorld(true);
        const fly = f.def.disarm?.fly ?? 0.5, u = Math.min(1, S.t / fly);
        _w.lerpVectors(S.from, S.at, u); _w.y += Math.sin(Math.PI * u) * 1.1 + (u >= 1 ? 0.04 : 0);
        g.worldToLocal(lie.position.copy(_w));
        _e.set(u < 1 ? S.t * 12 : Math.PI / 2, Math.atan2(S.at.x - S.from.x, S.at.z - S.from.z), 0, 'YXZ');
        lie.quaternion.copy(g.getWorldQuaternion(_q).invert().multiply(new THREE.Quaternion().setFromEuler(_e)));
        lie.scale.setScalar(1 / (skin.scale ?? 1));
      }
      // the rock: dug up, held over its head, then flying to its mark (a lob: Foes.animKit, its landing shown)
      if (f.atk?.id === 'rock' && f.state === 'wind' && f.k > 0.78) c.lob(f, (f.k - 0.78) / 0.22, P.rock); else c.lob(f, -1, P.rock);
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

// ------------------------------------------------------------------ the hulk

export const HULK_BODY = { hip: 1.22, hipX: 0.25, thigh: 0.565, shin: 0.535, chest: 0.84, shoulder: 0.5, upper: 0.66, fore: 0.58, neck: 0.1 };
export const HULK_MOVES = {
  // the smash: the great sword's overhead, the club high behind its horn in both fists, leaning back
  smash: { clip: 'gs_slash_1', from: 0.25, load: 0.53, cut: 0.62, to: 1.05, lean: -0.12 },
  // the sweep: the great sword's wide third swing, its whole hunched back twisted away
  sweep: { clip: 'gs_slash_3', from: 0.1, load: 0.5, cut: 0.86, to: 1.15, pose: 'glaiveHigh' },
  // the stomp: no stomp clip: the guard's braced stance for the body, the arms flung up by hand (`stomp`), one foot raised
  // high by its model's style and stamped down in the strike
  stomp: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'stomp' },
  // the throw: the mummer king's (the jumping overhead without its hop), the grunt held high over its horn, then hurled
  // as it lets go (`release`: CARRY.fly, src/foes.js)
  throw: { clip: 'gs_jump_attack', from: 0.15, load: 0.85, cut: 1.1, to: 1.45, ground: true, release: 0.78, lean: -0.1 },
};
const HULK_SPEEDS = { walk: 1.0, jog: 2.4, sprint: 4.6 };
/** Its hunch over the clip's pose (rad: the chest forward, the head back up to look ahead); the stomp's foot (rad). */
export const HULK_STANCE = { hunch: 0.26, look: -0.3, stomp: { thigh: 1.05, out: 0.55, knee: 0.95, foot: -0.1, rise: 0.22 } };
/** Its head (the face's pivot under the neck's, m) and its size over the parts built at a person's: thrust forward and low. */
export const HULK_HEAD = { at: [0, -0.1, 0.22], scale: 1.18 };
/**
 * How it holds its club (src/enemies/wield.js, #744): by the butt in its right fist, the head down and forward across
 * its front, toward the ground (the sheet's); the smash both fists stacked at the butt, the club up and back over its
 * right shoulder (the sheet's attack pose), over its horn and down before it; the sweep drawn back high over its right
 * shoulder in both fists, swung across before it; the stomp raised in its fist as its arms fly up, brought down with it.
 */
export const HULK_HOLD = {
  club: { side: 0, r: 0.064, reach: [1.56, 0.22], head: 0.13, carry: { dir: [0.25, -0.55, 0.8] },
    moves: {
      smash: { wind: [-0.42, 0.62, -0.66], via: [-0.05, 0.9, 0.45], hit: [0, -0.5, 0.86], follow: [0, -0.75, 0.66], both: { at: -0.17, from: -0.2, to: 0.6, phases: ['wind', 'strike'] } },
      sweep: { frame: 'body', wind: [-0.62, 0.55, -0.56], via: [-0.7, 0.15, 0.7], hit: [0.8, 0.02, 0.6], follow: [0.75, -0.25, -0.6], both: { at: -0.17, from: -0.2, to: 0.6, phases: ['wind', 'strike'] } },
      stomp: { wind: [-0.25, 0.35, -0.9], hit: [-0.35, -0.3, 0.88] },
    } },
};

export function hulkModel(skin) {
  const P = skin.palette, M = materials('hulk', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, HULK_BODY), D = HULK_BODY;
  const skinB = M.mat('skinBuild', P.skin), bellyB = M.mat('bellyBuild', P.belly), hideB = M.mat('hideBuild', P.hide), ropeB = M.mat('ropeBuild', P.rope);
  const woodB = M.mat('woodBuild', P.wood), ironB = M.mat('ironBuild', P.iron), hornB = M.mat('hornBuild', P.horn), inkB = M.mat('inkBuild', P.ink);
  const eyeM = M.own('eye', P.eye, { glow: 0.5 });
  const T = J.torso;
  // a great barrel of a body: narrow hips, the chest and the shoulders broad, the hump of its back high
  add(T, lathe([[0.001, -0.1], [0.3, -0.08], [0.38, 0.04], [0.43, 0.22], [0.48, 0.44], [0.53, 0.62], [0.5, 0.76], [0.32, 0.88], [0.001, 0.92]], 24, 0.76), skinB);
  many(T, [new THREE.SphereGeometry(0.38, 12, 9).scale(1.35, 0.72, 0.85).translate(0, 0.76, -0.1)], skinB);
  // the pale belly pushed out before it
  add(T, new THREE.SphereGeometry(0.42, 18, 14).scale(1, 1.0, 0.74).translate(0, 0.26, 0.19), bellyB);
  add(T, new THREE.SphereGeometry(0.02, 6, 4).scale(1.4, 0.6, 0.5), inkB, 0, 0.2, 0.5);
  // the kilt of hide patches on its rope belt, a knot at the front, its hem ragged and longer before and behind
  const hem = pivot(T, 0, -0.06, 0, 'hem');
  const kiltFlap = [];
  for (let i = 0; i < 7; i++) {
    const a = -0.6 + 0.2 * i + (i % 2) * 0.03, l = 0.2 + 0.12 * Math.abs(Math.sin(i * 1.9 + 0.4));
    kiltFlap.push(new THREE.ConeGeometry(0.13, l, 3, 1).rotateY(Math.PI / 6).scale(1, 1, 0.25).rotateX(Math.PI).translate(0, -l / 2, 0).rotateX(-0.1).translate(0, 0, 0.6).rotateY(a).scale(1, 1, 0.72).translate(0, -0.38, 0.03));
  }
  // (close round its hips before and behind, the sheet's side view: not a bell out behind it)
  many(hem, [lathe([[0.6, -0.4], [0.55, -0.24], [0.47, -0.06], [0.42, 0.08]], 24, 0.72).translate(0, 0, 0.03),
    ...tatters(15, 0.6, -0.38, 0.16, 0.72, 0.17).map((x) => x.translate(0, 0, 0.03)), ...kiltFlap], hideB);
  many(hem, [new THREE.TorusGeometry(0.45, 0.03, 5, 28).rotateX(Math.PI / 2).scale(1, 1, 0.7).translate(0, 0.02, 0.04),
    new THREE.SphereGeometry(0.055, 7, 5).translate(-0.05, 0.01, 0.36), ...[-0.08, -0.02].map((x, i) => new THREE.CylinderGeometry(0.022, 0.017, 0.4 + i * 0.1, 5).rotateX(-0.12).translate(x, -0.2 - i * 0.05, 0.39))], ropeB);
  const fists = [null, null];
  // long heavy arms to its knees, muscled (lofted: the deltoid's mass over the shoulder, the biceps before, the forearm
  // swelling below the elbow and narrowing to the wrist); big four-fingered hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    fists[i] = clawHand(J.hands[i], s, 2.6, skinB, hornB);
    many(arm, [loftLimb(D.upper, [[-0.14, 0.09, 0.09], [0.04, 0.2, 0.19, -0.005, 0.025], [0.24, 0.18, 0.175, 0, 0.02], [0.52, 0.145, 0.168, 0.035], [0.86, 0.12, 0.125], [1.02, 0.115, 0.115]], s, 9)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.12, 9, 7), loftLimb(D.fore, [[0, 0.12, 0.12], [0.2, 0.152, 0.14, 0.012, 0.012], [0.5, 0.128, 0.115, 0.005], [0.88, 0.09, 0.076], [1.02, 0.085, 0.07]], s, 9)], skinB);
  });
  // thick legs, broad bare feet with five toes
  J.legs.forEach((leg, i) => {
    const f = clawFoot(2.45, 5), s = i ? 1 : -1;
    many(leg, [loftLimb(D.thigh, [[-0.15, 0.15, 0.15], [0.04, 0.25, 0.24], [0.45, 0.22, 0.225, 0.02], [0.88, 0.165, 0.165], [1.03, 0.155, 0.155]], s, 9)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.16, 9, 7).translate(0, 0, 0.02), loftLimb(D.shin, [[0, 0.16, 0.16], [0.25, 0.165, 0.185, -0.03], [0.7, 0.12, 0.12], [1, 0.1, 0.1]], s, 9)], skinB);
    many(J.feet[i], f.skin, skinB); many(J.feet[i], f.claw, hornB);
  });
  // the head: small, low and forward on its thick neck; a heavy brow, a broad flat nose, the heavy jaw with two fangs
  // up from it, small pointed ears; one ivory horn up from its brow
  const H = J.head;
  const face = [0, 0.07, 0.1], faceR = [0.18, 0.12, 0.17];
  // (its head thrust well forward of its neck, low between its shoulders: the sheet's side view; a little bigger than a
  // person's: HULK_HEAD)
  many(H, [new THREE.CylinderGeometry(0.19, 0.28, 0.36, 12).rotateX(0.95).translate(0, -0.06, 0.1)], skinB);
  const Hf = pivot(H, ...HULK_HEAD.at, 'face');
  Hf.scale.setScalar(HULK_HEAD.scale);
  many(Hf, [new THREE.SphereGeometry(0.2, 14, 11).scale(1, 1.02, 1).translate(0, 0.17, 0.04),
    new THREE.SphereGeometry(1, 14, 10).scale(...faceR).translate(...face),
    new THREE.CapsuleGeometry(0.044, 0.2, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.9, 1).translate(0, 0.215, 0.2),
    new THREE.SphereGeometry(0.045, 8, 6).scale(1.3, 0.9, 1).translate(0, 0.14, 0.26),
    // (the heavy underslung jaw, wider than its skull)
    new THREE.SphereGeometry(1, 12, 8).scale(0.165, 0.085, 0.13).translate(0, 0.035, 0.135),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.045, 0.13, 5).scale(1, 1, 0.35).rotateZ(-s * 1.2).translate(s * 0.22, 0.2, 0.0))], skinB);
  many(Hf, [tubeGeometry(onFace(face, faceR, span(-0.11, 0.11, 7), (x) => 0.04 - 0.4 * x * x), 0.006),
    ...[-1, 1].map((s) => new THREE.SphereGeometry(0.012, 6, 4).translate(s * 0.022, 0.125, 0.295))], inkB);
  many(Hf, [...[-1, 1].map((s) => new THREE.ConeGeometry(0.022, 0.07, 6).translate(s * 0.07, 0.065, 0.255)),
    new THREE.ConeGeometry(0.05, 0.2, 8).rotateX(-0.25).translate(0, 0.43, 0.12)], hornB);
  const eyes = pivot(Hf, 0, 0, 0, 'eyes');
  for (const s of [-1, 1]) add(eyes, new THREE.SphereGeometry(0.026, 9, 7).scale(1, 0.8, 0.6), eyeM, s * 0.07, 0.18, 0.22);
  many(Hf, [-1, 1].map((s) => new THREE.SphereGeometry(0.015, 6, 5).scale(1, 1, 0.5).translate(s * 0.07, 0.178, 0.236)), inkB);
  // the club in its right fist
  const grip = pivot(J.hands[0], 0, -0.13, 0.02, 'grip');
  const club = pivot(grip, 0, 0, 0, 'club');
  { const p = bandedClub(); many(club, p.wood, woodB); many(club, p.iron, ironB); }
  let cur = null;
  // (its hunch over the clip's: the chest forward, the head brought back up to look ahead; the stomp's raised foot)
  const style = (Jt, want) => {
    J.torso.rotateX(HULK_STANCE.hunch); J.head.rotateX(HULK_STANCE.look);
    J.legs[0].rotateZ(-0.06); J.legs[1].rotateZ(0.06);
    if (cur?.atk?.id !== 'stomp' || !want.clip) return;
    const k = want.kind === 'wind' ? smooth(want.load) : want.kind === 'strike' ? 1 - smooth((cur.k ?? 0) * 3) : 0, S = HULK_STANCE.stomp;
    if (k <= 0) return;
    // (the body raised off the guard's crouch over its standing leg, straightened: the legs seen long, not squatting)
    liftOver(J, 1, S.rise * k, 0.08 * k);   // (its weight over the other foot)
    // (a wrestler's stamp: the leg swung up and out to its side, the knee only half bent: the whole leg seen, long)
    J.legs[0].rotateX(-S.thigh * k); J.legs[0].rotateZ(-S.out * k); J.knees[0].rotateX(S.knee * k); J.feet[0].rotateX(S.foot * k);
  };
  const driver = new HumanoidDriver(J, rig, { moves: HULK_MOVES, speeds: HULK_SPEEDS, style, seat: 0.36 });
  const wield = new Wielder(J, driver, { fists, grips: [grip, null], weapons: HULK_HOLD });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.6, up: 0.35, down: 0.45 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [bellyB], into: M.mat('belly', P.belly, vc) }, { from: [hideB], into: M.mat('hide', P.hide, vc) },
    { from: [ropeB], into: M.mat('rope', P.rope, vc) }, { from: [woodB], into: M.mat('wood', P.wood, vc) }, { from: [ironB], into: M.mat('iron', P.iron, vc) },
    { from: [hornB], into: M.mat('horn', P.horn, vc) }, { from: [inkB], into: M.mat('ink', P.ink, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(1.6, 0.35, 0, 0.22);
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.belly, P.ink],
    driver, joints: J, wield, fists,
    tell: (id) => (id === 'throw' ? J.hands[1] : id === 'stomp' ? J.feet[0] : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      const sw = sway.update(dt, driver.speed, f.heading);
      hangFromHips(hem, J.body, sw.x, sw.z);   // (its kilt hangs from its hips, not its hunched chest nor the clip's bend)
      // the club in its fist (HULK_HOLD); set down while it holds a grunt up, its hands open
      const throwing = f.atk?.id === 'throw' && f.state !== 'chase' && f.state !== 'idle';
      club.scale.setScalar(throwing ? 1e-3 : 1);
      wield.update(f, want, c, throwing ? null : 'club');
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

// ------------------------------------------------------------------ the third batch's shared parts (issue #726)

/**
 * A spin of the whole body about its feet (a move's `spin`: the prowler's tail sweep, the warlord's last stand): through
 * the wind-up it turns `coil` rad away (side-on, its tail or its glaive drawn round behind it), complete at HOLD_AT and
 * held; through the strike it turns back round through `turns` whole turns, ending as it began. Pure: the angle (rad).
 */
export function spinAngle(want, k, M) {
  if (!M?.spin) return 0;
  const coil = M.spin.coil ?? 1, turns = M.spin.turns ?? 1, sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  if (want.kind === 'wind') return -coil * sm((k ?? 0) / HOLD_AT);
  if (want.kind === 'strike') return -coil + (coil + Math.PI * 2 * turns) * sm((k ?? 0) / (M.spin.over ?? 0.9));
  return 0;
}

/**
 * A tail of segments on pivots (each the next's parent, each along -z from its own), sprung (docs/systems/procedural-
 * animation.md, "Secondary motion"): every segment's pitch and yaw follow a target through a SecondOrder, softer down the
 * tail so the tip lags the root. The targets: its rest curve (down from the hips to the ground and along it), the body's
 * turn flung out through it, a lash running down it (`lash` 0..1: idle a sway, winding up a lash), raised straight out
 * at knee height (`sweep` 0..1: the tail sweep), curled up over its back (`curl` 0..1: the back-flip). Kept off the
 * ground it stands on.
 */
export class TailSpring {
  constructor(segs, rest, { len, flat = null } = {}) {
    const n = segs.length;
    this.segs = segs; this.rest = rest; this.len = len; this.flat = flat ?? rest.map((_, i) => [0.95, -0.45, -0.5][i] ?? 0);
    this.yaw = segs.map((_, i) => new SecondOrder(3.2 - (2.0 * i) / n, 0.45, 0));
    this.pitch = segs.map((_, i, a) => new SecondOrder(3.6 - (2.0 * i) / n, 0.55, 0, rest[i]));
    this.t = 0; this.last = null;
  }
  update(dt, heading, speed, o = {}) {
    const n = this.segs.length;
    let rate = 0;
    if (dt > 0 && this.last != null) rate = Math.max(-6, Math.min(6, (THREE.MathUtils.euclideanModulo(heading - this.last + Math.PI, Math.PI * 2) - Math.PI) / dt));
    this.last = heading;
    this.t += Math.max(0, dt);
    const lash = o.lash ?? 0.15, sweep = o.sweep ?? 0, curl = o.curl ?? 0, run = Math.min(1, (speed ?? 0) / 4);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const yawT = Math.max(-0.32, Math.min(0.32, rate * 0.06)) * (0.4 + u) * (1 - sweep)
        + lash * 0.42 * Math.sin(this.t * (2.2 + 5 * lash) - i * 0.75) * (0.3 + u) * (1 - 0.7 * sweep);
      let pitchT = this.rest[i] + (this.flat[i] - this.rest[i]) * sweep - curl * (i ? 0.38 : 0.7) - run * 0.18 * (1 - u) * (i < 2 ? 1 : 0.3);
      if (i > 0) pitchT += run * 0.06 * u;
      const y = this.yaw[i].update(dt, yawT), x = this.pitch[i].update(dt, pitchT);
      this.segs[i].rotation.set(-x, y, 0, 'YXZ');
    }
  }
  /**
   * Lift any segment whose end went under the ground (m, in the world: `floor`, or `at(x, y, z)` under its end where the
   * ground slopes) back over it, root to tip (one pass).
   */
  keepUp(floor, r = 0.04, at = null) {
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      s.updateMatrixWorld(true);
      _w.set(0, 0, -this.len).applyMatrix4(s.matrixWorld);
      const g = _w.y < floor + 0.6 ? at?.(_w.x, _w.y + 0.6, _w.z) : null;
      const under = (g ?? floor) + r - _w.y;
      if (under > 0) { s.rotation.x += Math.min(0.6, under / this.len); s.updateMatrixWorld(true); }
    }
  }
}

/** A flat curved blade along +y from y0, `L` long and `w` wide at its belly, curving toward +z (its edge), `t` thick. */
function curvedBlade(L, w, curve = 0.12, y0 = 0, t = 0.008, hook = false) {
  const S = new THREE.Shape(), n = 10;
  // the back (spine) up one side, the edge down the other: a crescent, its point curving forward
  for (let i = 0; i <= n; i++) { const u = i / n, y = y0 + L * u, z = curve * L * u * u - w * 0.35 * Math.sin(Math.PI * u) * (1 - u * 0.5); if (i) S.lineTo(z, y); else S.moveTo(z, y); }
  for (let i = n; i >= 0; i--) { const u = i / n, y = y0 + L * u * (1 - 0.04 * u), z = curve * L * u * u + w * (0.65 * Math.sin(Math.PI * Math.min(1, u * 1.1)) + 0.25 * (1 - u)) * (1 - u * 0.75); S.lineTo(z, y); }
  if (hook) { S.lineTo(-w * 0.2, y0 + L * 0.2); S.lineTo(-w * 0.75, y0 + L * 0.12); S.lineTo(-w * 0.2, y0 + L * 0.05); }
  const g = new THREE.ExtrudeGeometry(S, { depth: t, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -t / 2);
  // (the shape's x is our z: turned so its flat faces ±x, the edge toward +z)
  g.rotateY(-Math.PI / 2);
  return g;
}
/**
 * A ram's horn (the warlord's, the shape pass #726): from its root on the crown up, back, down round behind the ear and
 * forward under it, its tip flaring out by the cheek; the coil's axis out to its side and a little forward, so from the
 * front each horn is a big curl standing out past the mane (WARLORD_HORN). Lofted: broad and flattened, thick at the
 * root, tapering to its tip, ridged across.
 */
export function ramHorn(s, H = WARLORD_HORN) {
  const A = new THREE.Vector3(s, 0, H.fwd).normalize(), e1 = new THREE.Vector3(0, 1, 0).addScaledVector(A, -A.y).normalize(), e2 = new THREE.Vector3().crossVectors(A, e1).multiplyScalar(-s);
  const C = new THREE.Vector3(s * H.c[0], H.c[1], H.c[2]), pts = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14, th = u * H.turns * Math.PI * 2 - H.start, R = H.r0 + (H.r1 - H.r0) * u;
    pts.push(C.clone().addScaledVector(e1, Math.cos(th) * R).addScaledVector(e2, Math.sin(th) * R).addScaledVector(A, H.x0 + (H.x1 - H.x0) * Math.pow(u, 1.6)));
  }
  const ridge = (u) => 1 + 0.07 * Math.max(0, Math.cos(u * Math.PI * 2 * H.ridges)) * (1 - u);
  return loftAlong(pts, (u) => keyed(u, H.w) * ridge(u), (u) => keyed(u, H.h) * ridge(u), 8, 30, A.toArray());
}

// ------------------------------------------------------------------ the prowler

// The prowler (`prowler`), to its picked sheet (references/enemy-archetypes/prowler/sheet-1.jpg): 1.8 m to its crest,
// the traveller's height and a head. A lean leaf-green lizard on two long digitigrade legs: a long narrow head with a
// crest of short spines and wide-set yellow eyes, a cream throat running down its chest and belly and under its tail; a
// long tail to the ground and along it; thin arms with three long clawed fingers; one steel shoulder guard on its left
// shoulder on a strap across its chest; a short curved blade in its right fist. Draws: seven (skin, belly, steel,
// leather, bone, ink skinned on the rig and the tail's own joints; the eyes).

export const PROWLER_BODY = { hip: 0.9, hipX: 0.1, thigh: 0.38, shin: 0.44, chest: 0.5, shoulder: 0.21, upper: 0.31, fore: 0.29, neck: 0.14 };
/** Its digitigrade shank in the shin's frame: the hock (m back and down from the knee) the shin bends back to, the instep
 * running forward and down from it to the ankle's joint (the ball of its foot). */
export const PROWLER_SHANK = { hock: [0, -0.27, -0.1], ball: 0.03 };
export const PROWLER_MOVES = {
  // the slash: the sword's quick cut, drawn back across its chest and out flat
  slash: { clip: 'ss_slash_1', from: 0.1, load: 0.45, cut: 0.6, to: 0.85 },
  // the dart: the great sword's slide attack, crouched low on its bent legs with the blade drawn back (the sheet's attack
  // pose), its tail lashing; the dash across the gap is the mind's lunge (3.6 m)
  dart: { clip: 'gs_slide_attack', from: 0.7, load: 0.95, cut: 1.25, to: 1.45 },
  // the tail sweep: the guard's braced crouch, side-on (spinAngle's coil); then a whole turn about its feet, the tail
  // swung straight out at knee height round it (TailSpring sweep)
  tail: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, spin: { coil: 1.2, turns: 1, over: 0.85 } },
  // the spit: its head reared back, its arms braced low (`spit`), the glob lobbed as it flies (`release`: CARRY.fly)
  spit: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'spit', release: 0.78 },
};
const PROWLER_SPEEDS = { walk: 0.8, jog: 2.6, sprint: 5.0 };
/** Its stance over the clip's (rad): leaning forward from the hips, the head brought back up level; its knees a little bent. */
export const PROWLER_STANCE = { lean: 0.2, look: -0.25, knee: 0.18, crouch: 0.55, flipTuck: 1.3, head: 1.3 };
/** The tail: segments, each `len` m, tapering `r0` → `r1`; its rest curve (rad down per segment, root to tip). */
/** Its head (m, before PROWLER_STANCE.head's scale): from its nape (z0) to its snout (z1), the centre's height, the half
 * width and half height along it (keys: [u, value]); its jaw that much lower. Long and narrow (the sheet's). */
export const PROWLER_HEAD = { z0: -0.09, z1: 0.32, jaw: 0.026,
  y: [[0, 0.1], [0.35, 0.098], [0.75, 0.08], [1, 0.072]],
  w: [[0, 0.03], [0.1, 0.075], [0.33, 0.088], [0.6, 0.064], [0.88, 0.045], [1, 0.016]],
  h: [[0, 0.03], [0.1, 0.07], [0.33, 0.072], [0.6, 0.052], [0.88, 0.036], [1, 0.014]] };
/**
 * How it holds its blade (src/enemies/wield.js, #744): hanging point down and forward by its leg; the slash drawn back
 * across its chest to its left shoulder, then out flat across before it; the dart drawn back along its side as it sinks,
 * then straight ahead with it.
 */
export const PROWLER_HOLD = {
  blade: { side: 0, r: 0.016, wrist: SWORD_WRIST, edge: [0, 1], reach: [0.52, 0.08], carry: { dir: [0.05, -0.72, 0.7] },
    moves: {
      slash: { wind: [0.55, 0.5, -0.67], via: [0.1, 0.35, 0.93], hit: [-0.8, 0.05, 0.6], follow: [-0.85, -0.2, -0.3] },
      dart: { wind: [-0.25, 0.15, -0.95], hit: [0, 0.05, 1] },
    } },
};
export const PROWLER_TAIL = { n: 8, len: 0.17, r0: 0.075, r1: 0.014, rest: [0.45, 0.25, 0.15, 0.05, -0.1, -0.2, -0.2, -0.1] };

/**
 * A long three-fingered lizard hand on its joint, hanging down it: a narrow palm, three long fingers, each with a hooked
 * claw curling in toward the palm (the sheet's); the fingers in two segments on the fist's pivots (#744). Returns the Fist.
 */
function lizardHand(hand, size, skinM, clawM) {
  const r = 0.022 * size, K0 = [0, -r * 2.2, r * 0.3];
  const tilt = (a) => new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(-0.3, 0, a));
  const M0 = new THREE.Vector3(...K0).addScaledVector(tilt(0), r * 4.2 * 0.55).toArray(), E0 = new THREE.Vector3(...K0).addScaledVector(tilt(0), r * 4.2).toArray();
  const { knuckles, tips } = fingerPivots(hand, K0, M0);
  const sub = (p, o) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const prox = [], dist = [], claw = [];
  for (let i = -1; i <= 1; i++) {
    const a = i * 0.28, l = r * (i ? 3.4 : 4.2), d = tilt(a), k = [i * r * 0.7, K0[1], K0[2]];
    const m = new THREE.Vector3(...k).addScaledVector(d, l * 0.55).toArray(), e = new THREE.Vector3(...k).addScaledVector(d, l).toArray();
    prox.push(bone(sub(k, K0), sub(m, K0), r * 0.42, 5));
    dist.push(bone(sub(m, M0), sub(e, M0), r * 0.4, 5));
    // (a long hooked claw, curling in toward the palm: the sheet's)
    claw.push(hookClaw(sub(e, M0), d.clone().add(new THREE.Vector3(0, 0, 0.35)).toArray(), [0, -0.2, 1], r * 0.4, r * 2.1));
  }
  many(hand, [new THREE.SphereGeometry(r * 1.6, 8, 6).scale(1, 1.3, 0.6).translate(0, -r * 1.2, 0)], skinM);
  many(knuckles, prox, skinM); many(tips, dist, skinM); many(tips, claw, clawM);
  return new Fist(knuckles, tips, { K: [K0[1], K0[2]], M: [M0[1], M0[2]], E: [E0[1], E0[2]], finger: r * 0.42, haft: (rh) => [0, K0[1] - r * 0.4, r * 0.75 + rh * 0.92] });
}
/** A digitigrade foot on its ankle (the ball of the foot): a pad, three long toes on the ground, claws. */
function lizardFoot(size = 1) {
  const s = size, skin = [new THREE.SphereGeometry(0.036 * s, 8, 6).scale(1.2, 0.75, 1.3).translate(0, -0.03, 0.015)], claw = [];
  for (let i = -1; i <= 1; i++) {
    const a = i * 0.42, l = 0.11 * s * (i ? 0.85 : 1.1);
    skin.push(new THREE.CapsuleGeometry(0.016 * s, l, 3, 5).rotateX(Math.PI / 2).translate(0, 0, l / 2).rotateY(a).translate(0, -0.05, 0.02));
    claw.push(hookClaw([Math.sin(a) * l, -0.044, 0.02 + Math.cos(a) * l], [Math.sin(a), 0, Math.cos(a)], [0, -1, 0.3], 0.011 * s, 0.045 * s));
  }
  return { skin, claw };
}
/** Points from a to b (arrays) for a capsule along them: its geometry, radius r (n round it: a finger's few). */
function bone(a, b, r, n = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
  return new THREE.CapsuleGeometry(r, Math.max(0.001, l - r * 2), n > 6 ? 3 : 2, n).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(...A.add(B).multiplyScalar(0.5).toArray());
}

export function prowlerModel(skin) {
  const P = skin.palette, M = materials('prowler', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, PROWLER_BODY), D = PROWLER_BODY;
  const skinB = M.mat('skinBuild', P.skin), bellyB = M.mat('bellyBuild', P.belly), steelB = M.mat('steelBuild', P.steel), leatherB = M.mat('leatherBuild', P.leather);
  const boneB = M.mat('boneBuild', P.bone), inkB = M.mat('inkBuild', P.ink);
  const eyeM = M.own('eye', P.eye, { glow: 0.55 });
  const T = J.torso;
  // a long lean body: narrow hips, a slim waist, the chest a little deeper; the cream throat and belly down its front
  const prof = [[0.001, -0.1], [0.115, -0.08], [0.14, 0.0], [0.115, 0.13], [0.125, 0.24], [0.16, 0.35], [0.175, 0.43], [0.15, 0.5], [0.07, 0.55], [0.001, 0.56]];
  add(T, lathe(prof, 22, 0.72), skinB);
  add(T, lathe(prof.slice(1, 8).map(([r, y]) => [r + 0.005, y]), 14, 0.72, -0.45, 0.9), bellyB);
  // (its shoulders rounded over the arms' tops)
  many(T, [-1, 1].map((s) => new THREE.SphereGeometry(0.07, 10, 8).scale(1.2, 0.85, 1).translate(s * 0.15, D.chest - 0.03, -0.005)), skinB);
  // the neck: long, up and a little forward from the shoulders, its throat cream
  const neck = [new THREE.CylinderGeometry(0.052, 0.075, D.neck + 0.1, 12).rotateX(0.2).translate(0, D.chest + 0.04, 0.03)];
  many(T, neck, skinB);
  many(T, [new THREE.CylinderGeometry(0.054, 0.077, D.neck + 0.08, 12, 1, true, -0.8, 1.6).rotateX(0.2).translate(0, D.chest + 0.04, 0.004)], bellyB);
  // the strap across its chest from its left shoulder to its right hip, the steel guard on its left shoulder
  many(T, [new THREE.CylinderGeometry(0.18, 0.18, 0.028, 26, 1, true).rotateZ(-0.62).scale(1, 1, 0.78).translate(0, 0.3, 0.0)], leatherB);
  const guard = [new THREE.SphereGeometry(0.095, 14, 8, 0, Math.PI * 2, 0, 1.25).scale(1, 0.78, 1.05).rotateZ(-0.3).translate(0.015, 0.03, 0),
    new THREE.SphereGeometry(0.1, 14, 4, 0, Math.PI * 2, 1.15, 0.3).scale(1, 0.9, 1.08).rotateZ(-0.3).translate(0.02, 0.0, 0)];
  many(J.arms[1], guard.map((x) => x.scale(0.92, 0.92, 0.92).translate(0, -0.035, 0)), steelB);
  many(J.arms[1], [-0.5, 0, 0.5].map((a) => new THREE.SphereGeometry(0.008, 5, 4).translate(Math.sin(a) * 0.07 + 0.04, -0.035, Math.cos(a) * 0.075)), inkB);
  const fists = [null, null];
  // arms: thin and long, to its thighs; three long clawed fingers
  J.arms.forEach((arm, i) => {
    fists[i] = lizardHand(J.hands[i], 1.25, skinB, boneB);
    // (lean muscle, lofted: a round deltoid, the biceps' swell before and the triceps' behind, a forearm thick below the
    // elbow and thin at the wrist)
    const s = i ? 1 : -1;
    many(arm, [loftLimb(D.upper, [[-0.12, 0.03, 0.03], [0.04, 0.056, 0.056, 0, 0.006], [0.2, 0.048, 0.05, 0], [0.45, 0.04, 0.048, 0.004], [0.82, 0.03, 0.031], [1.03, 0.028, 0.028]], s)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.031, 8, 6), loftLimb(D.fore, [[0, 0.031, 0.031], [0.2, 0.038, 0.036, -0.003, 0.004], [0.5, 0.031, 0.028], [0.85, 0.021, 0.019], [1.02, 0.019, 0.017]], s)], skinB);
  });
  // legs (digitigrade): a thick thigh; the shin bent back from the knee to a raised hock, the long instep forward and down
  // from it to the ball of the foot (the ankle's joint), three long toes on the ground (PROWLER_SHANK)
  const K = PROWLER_SHANK.hock, ballAt = [0, -D.shin, PROWLER_SHANK.ball];
  J.legs.forEach((leg, i) => {
    const f = lizardFoot(1.2);
    // (lofted: a thigh thick with muscle at the hip, before and behind, falling to a lean knee; the shank's calf high
    // behind it, the instep a lean bone to the ball of its foot)
    const s = i ? 1 : -1;
    many(leg, [loftLimb(D.thigh, [[-0.18, 0.04, 0.05], [0.0, 0.075, 0.085, 0.005], [0.3, 0.07, 0.085, 0.015], [0.65, 0.055, 0.062, 0.008], [0.95, 0.042, 0.044], [1.06, 0.038, 0.04]], s, 8)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.04, 8, 6), loftBone([0, 0, 0], K, [[0, 0.04, 0.04], [0.25, 0.042, 0.05, -0.012], [0.7, 0.03, 0.032], [1.03, 0.026, 0.028]], s),
      new THREE.SphereGeometry(0.027, 8, 6).translate(...K), loftBone(K, ballAt, [[0, 0.026, 0.028], [0.5, 0.022, 0.024], [1.02, 0.024, 0.022]], s, 8)], skinB);
    many(J.knees[i], [new THREE.ConeGeometry(0.009, 0.03, 5).rotateX(-2.3).translate(K[0], K[1] - 0.02, K[2] - 0.02)], boneB);
    many(J.feet[i], f.skin, skinB); many(J.feet[i], f.claw, boneB);
  });
  // the tail: from the back of its hips, down to the ground and along it, sprung (TailSpring)
  const TL = PROWLER_TAIL, segs = [];
  let at = J.body;
  for (let i = 0; i < TL.n; i++) {
    const s = pivot(at, 0, i ? 0 : D.hip - 0.04, i ? -TL.len : -0.08, `tail ${i}`);
    const r0 = TL.r0 + (TL.r1 - TL.r0) * (i / TL.n), r1 = TL.r0 + (TL.r1 - TL.r0) * ((i + 1) / TL.n);
    many(s, [new THREE.CylinderGeometry(r1, r0, TL.len * 1.04, 9, 1).rotateX(-Math.PI / 2).translate(0, 0, -TL.len / 2), new THREE.SphereGeometry(r0, 9, 6)], skinB);
    many(s, [new THREE.CylinderGeometry(r1 * 1.04, r0 * 1.04, TL.len, 8, 1, true, Math.PI - 0.95, 1.9).rotateX(-Math.PI / 2).translate(0, 0, -TL.len / 2)], bellyB);
    segs.push(s); at = s;
  }
  many(segs.at(-1), [new THREE.ConeGeometry(TL.r1, 0.09, 7).rotateX(-Math.PI / 2).translate(0, 0, -TL.len - 0.045)], skinB);
  const tail = new TailSpring(segs, TL.rest, { len: TL.len });
  // the head: a long narrow lizard head, the skull rounded behind, the snout long and flat; a crest of short spines over
  // its skull and down the back of its neck; wide-set yellow eyes on its sides under a brow ridge; a long mouth line
  const H = J.head, Hp = pivot(J.head, 0, 0, 0, 'skull');
  Hp.scale.setScalar(PROWLER_STANCE.head);
  // (lofted, nape to snout: deep behind the eyes and tapering to a rounded snout: PROWLER_HEAD; its jaw a second loft a
  // little lower, the cream showing under it; the crest's spines down from the crown over its nape)
  const HD = PROWLER_HEAD, zAt = (u) => HD.z0 + (HD.z1 - HD.z0) * u, cy = (u) => keyed(u, HD.y), hw = (u) => keyed(u, HD.w), hh = (u) => keyed(u, HD.h);
  const line = (f) => span(0, 1, 6).map((u) => new THREE.Vector3(0, f(u), zAt(u)));
  many(Hp, [loftAlong(line(cy), hw, hh, 10, 14, [0, 1, 0]),
    ...[-1, 1].map((s) => new THREE.CapsuleGeometry(0.019, 0.08, 3, 6).rotateX(Math.PI / 2).translate(s * 0.064, 0.13, 0.06)),
    ...Array.from({ length: 9 }, (_, i) => { const u = i / 8, z = 0.06 - u * 0.2, y = 0.175 - u * u * 0.09, l = 0.12 - 0.06 * Math.abs(u - 0.3); return new THREE.ConeGeometry(0.016, l, 5).scale(0.45, 1, 1).rotateX(-0.75 - u * 0.5).translate(0, y + l * 0.35, z); })], skinB);
  // (the jaw and the throat: cream)
  many(Hp, [loftAlong(line((u) => cy(u) - HD.jaw), (u) => hw(u) * 0.93, (u) => hh(u) * 0.78, 10, 12, [0, 1, 0])], bellyB);
  const mouth = (s) => span(0.12, 0.97, 6).map((u) => new THREE.Vector3(s * (hw(u) * 0.9 + 0.003), cy(u) - hh(u) * 0.42, zAt(u)));
  many(Hp, [tubeGeometry(mouth(-1), 0.0045), tubeGeometry(mouth(1), 0.0045), ...[-1, 1].map((s) => new THREE.SphereGeometry(0.007, 5, 4).translate(s * 0.02, cy(0.96) + hh(0.96) * 0.6, zAt(0.96)))], inkB);
  const eyes = pivot(Hp, 0, 0, 0, 'eyes');
  many(eyes, [-1, 1].map((s) => new THREE.SphereGeometry(0.036, 12, 9).scale(0.6, 1, 1).translate(s * 0.084, 0.105, 0.05)), eyeM);   // (both eyes one draw)
  many(Hp, [-1, 1].map((s) => new THREE.CapsuleGeometry(0.005, 0.026, 2, 4).translate(s * 0.106, 0.105, 0.053)), inkB);
  // the short curved blade in its right fist (its edge forward), a leather grip and a small steel guard
  const grip = pivot(J.hands[0], 0, -0.05, 0.012, 'grip');
  // (a short broad blade curving forward to its point, a hand wide at its belly: no stick)
  many(grip, [curvedBlade(0.44, 0.1, 0.3, 0.06, 0.011), new THREE.BoxGeometry(0.034, 0.016, 0.1).translate(0, 0.058, 0.01)], steelB);
  many(grip, [new THREE.CylinderGeometry(0.014, 0.016, 0.11, 7).translate(0, 0.0, 0), new THREE.SphereGeometry(0.018, 6, 5).translate(0, -0.06, 0)], leatherB);
  let cur = null;
  // (its stance over the clip's: leaning forward, the head back up level, the knees a little bent; the dart's crouch
  // deeper; the tail sweep's spin; the back-flip's tuck)
  const style = (Jt, want) => {
    const S = PROWLER_STANCE;
    J.torso.rotateX(S.lean); J.head.rotateX(S.look);
    for (const k of J.knees) k.rotateX(S.knee);
    const M = cur?.atk ? PROWLER_MOVES[cur.atk.id] : null;
    if (M && want.clip) J.body.rotateY(spinAngle(want, cur.k, M));
    if (cur?.atk?.id === 'spit' && want.clip) { const k = want.kind === 'wind' ? Math.min(1, want.load ?? 0) * (want.thrown > 0 ? 1 - want.thrown : 1) : 0; J.head.rotateX(-0.6 * k); J.torso.rotateX(-0.15 * k); }
  };
  const driver = new HumanoidDriver(J, rig, { moves: PROWLER_MOVES, speeds: PROWLER_SPEEDS, style, seat: 0.3 });
  const wield = new Wielder(J, driver, { fists, grips: [grip, null], weapons: PROWLER_HOLD });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 1.0, up: 0.5, down: 0.6 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [bellyB], into: M.mat('belly', P.belly, vc) }, { from: [steelB], into: M.mat('steel', P.steel, vc) },
    { from: [leatherB], into: M.mat('leather', P.leather, vc) }, { from: [boneB], into: M.mat('bone', P.bone, vc) }, { from: [inkB], into: M.mat('ink', P.ink, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet, ...segs];
  let glow = 0;
  const _hinge = new THREE.Vector3(), _hq = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.belly, P.ink],
    driver, joints: J, tail, wield, fists,
    tell: (id) => (id === 'tail' ? segs[4] : id === 'spit' ? Hp : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      // the back-flip (its evade, fight.evade.flip): the whole body turned over backwards about its hips over the hop,
      // its legs tucked, its tail curled up over it
      const H_ = f.hopBack, flip = H_ && f.fight?.evade?.flip ? Math.min(1, H_.u ?? 0) : 0;
      if (flip > 0) {
        const e = flip * flip * (3 - 2 * flip), tuck = Math.sin(Math.PI * flip);
        _hinge.set(0, D.hip, 0);
        _hq.setFromAxisAngle(_ax, -Math.PI * 2 * e);
        J.body.position.sub(_hinge).applyQuaternion(_hq).add(_hinge);
        J.body.quaternion.premultiply(_hq);
        for (const l of J.legs) l.rotateX(-PROWLER_STANCE.flipTuck * tuck);
        for (const k of J.knees) k.rotateX(PROWLER_STANCE.flipTuck * 1.3 * tuck);
        for (const a of J.arms) a.rotateZ(0);
      }
      // the blade in its fist (PROWLER_HOLD)
      wield.update(f, want, c, 'blade');
      // the tail: lashing as it winds up (the dart's: hard), straight out at knee height through the tail sweep, curled in the flip
      const id = f.atk?.id, active = f.state === 'wind' || f.state === 'strike';
      const sweep = id === 'tail' && active ? (f.state === 'strike' ? 1 : Math.min(1, (f.k ?? 0) / HOLD_AT)) : 0;
      tail.update(dt, f.heading + (rig.rotation.y ?? 0) + (sweep ? spinAngle(want, f.k, PROWLER_MOVES.tail) : 0), driver.speed,
        { lash: f.state === 'wind' ? (id === 'dart' ? 1 : 0.6) : f.rage ? 0.5 : 0.18, sweep, curl: flip > 0 ? Math.sin(Math.PI * flip) : 0 });
      if (!flip) tail.keepUp(f.pos.y, 0.04, c.ground);
      // the spit: lobbed from its mouth as it flies (a lob: Foes.animKit, its landing shown)
      if (id === 'spit' && f.state === 'wind' && f.k > PROWLER_MOVES.spit.release) c.lob(f, (f.k - PROWLER_MOVES.spit.release) / (1 - PROWLER_MOVES.spit.release), P.spit); else c.lob(f, -1, P.spit);
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

// ------------------------------------------------------------------ the warlord

// The warlord (`warlord`), to its picked sheet (references/enemy-archetypes/warlord/sheet-1.jpg): 2.5 m to its horns,
// broad and upright. Deep crimson skin, a dark brown mane round a great cat's face (a broad muzzle, a dark nose, a heavy
// brow, yellow eyes) and down its chest and back, two curled ram horns; rough bronze: a plate on each shoulder, bracers,
// greaves on its shins, plates on its wide leather belt; a brown loincloth; bare feet. A long glaive: a dark shaft with
// steel rings, a long curved blade. Draws: twelve (skin, mane, horn, bronze, cloth, wood, steel skinned on the rig; the
// eyes; its four plates, each its own mesh so it can come off: src/enemies/fight.js ARMOUR.warlord).

export const WARLORD_BODY = { hip: 1.18, hipX: 0.2, thigh: 0.55, shin: 0.52, chest: 0.78, shoulder: 0.42, upper: 0.5, fore: 0.46, neck: 0.12 };
export const WARLORD_MOVES = {
  // the sweep: the great sword's wide third swing, the glaive drawn back over its shoulder in both hands (the sheet's pose)
  sweep: { clip: 'gs_slash_3', from: 0.1, load: 0.5, cut: 0.86, to: 1.15 },
  // the overhead: the great sword's overhead, high over its horns, leaning back
  overhead: { clip: 'gs_slash_1', from: 0.25, load: 0.53, cut: 0.62, to: 1.05, lean: -0.14 },
  // the charge: the guard's braced stance, the glaive levelled like a lance (`lance`), its head down; then it runs
  // through on the library's sprint (`run`), the lance held
  charge: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'lance', run: true },
  // the roar: the yelling gesture, its arms flung wide (`roar`), its head thrown back
  roar: { clip: 'gesture_yelling', from: 0, load: 0.85, cut: 1.0, to: 1.2, pose: 'roar' },
  // the last stand: braced wide, the glaive swung back round behind it (`whirl`); two whole turns about its feet
  whirl: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'whirl', spin: { coil: 1.4, turns: 2, over: 0.9 } },
};
const WARLORD_SPEEDS = { walk: 1.0, jog: 2.6, sprint: 5.2 };
export const WARLORD_STANCE = { chest: -0.04, look: 0.02 };
/** Its head's size over the parts built at a person's (the sheet's maned head is big for its body). */
export const WARLORD_HEAD = { scale: 1.45 };
/** Its ram horns (m, in the head's frame before WARLORD_HEAD's scale): the coil's centre (x out to its side), its axis'
 * lean forward, its radius root to tip, how far out along the axis root to tip, a share of a turn, where it starts (rad
 * back from the top), the section's half width (in the coil) and half height (along its axis) by keys, its ridges. */
export const WARLORD_HORN = { c: [0.17, 0.17, -0.02], fwd: 0.4, r0: 0.13, r1: 0.1, x0: -0.06, x1: 0.14, turns: 0.82, start: 0.35, ridges: 9,
  w: [[0, 0.058], [0.5, 0.05], [1, 0.014]], h: [[0, 0.07], [0.5, 0.058], [1, 0.016]] };
/**
 * How it holds its glaive (src/enemies/wield.js, #744; dirs in the chest's frame unless the key says): upright beside it
 * in its right fist, the forearm brought up before it, the butt by its foot; the sweep drawn back up over its right
 * shoulder in both fists, the left hand up the shaft (the sheet's attack pose), swung across before it; the overhead high
 * over its horns, then down; levelled like a lance at you for the charge, the left hand forward along the shaft; the roar
 * raised in its fist; the last stand swung back round behind it in both fists, then out at its full reach as it whirls.
 */
export const WARLORD_HOLD = {
  glaive: { side: 0, r: 0.032, wrist: SWORD_WRIST, edge: [-1, 0], reach: [2.45, 0.8], carry: { frame: 'body', dir: [-0.1, 1, 0.06], fore: [-0.05, -0.35, 0.94] },
    moves: {
      sweep: { frame: 'body', wind: [-0.55, 0.6, -0.58], via: [-0.62, 0.12, 0.78], hit: [0.8, 0.02, 0.6], follow: [0.9, -0.15, -0.35], both: { at: 0.5, from: -0.6, to: 1.0 } },
      overhead: { wind: [-0.12, 0.45, -0.88], via: [0, 0.95, 0.3], hit: [0, -0.45, 0.89], both: { at: -0.35, from: -0.6, to: 1.0 } },
      charge: { frame: 'body', wind: [0, -0.12, 1], hit: [0, -0.12, 1], both: { at: 0.6, from: 0.4, to: 1.0 } },
      roar: { frame: 'body', wind: [-0.35, 1, 0.25], hit: [-0.35, 1, 0.25] },
      whirl: { frame: 'body', wind: [-0.45, 0.05, -0.9], hit: [-1, 0.05, 0.2], both: { at: 0.5, from: 0.3, to: 1.0 } },
    } },
};
export function warlordModel(skin) {
  const P = skin.palette, M = materials('warlord', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, WARLORD_BODY), D = WARLORD_BODY;
  const skinB = M.mat('skinBuild', P.skin), maneB = M.mat('maneBuild', P.mane), inkB = M.mat('inkBuild', P.ink), hornB = M.mat('hornBuild', P.horn);
  const bronzeB = M.mat('bronzeBuild', P.bronze), clothB = M.mat('clothBuild', P.cloth), leatherB = M.mat('leatherBuild', P.leather);
  const woodB = M.mat('woodBuild', P.wood), steelB = M.mat('steelBuild', P.steel);
  const plateM = M.mat('plate', P.bronze, { side: THREE.DoubleSide });   // (kit.js plateMat's, named here for its surface)
  const eyeM = M.own('eye', P.eye, { glow: 0.5 });
  const T = J.torso;
  // a broad upright body: the chest wide and deep over a narrower waist; pectorals and the ridges of its belly
  add(T, lathe([[0.001, -0.14], [0.2, -0.12], [0.25, -0.02], [0.225, 0.14], [0.245, 0.3], [0.3, 0.46], [0.345, 0.6], [0.335, 0.7], [0.24, 0.8], [0.11, 0.86], [0.001, 0.88]], 22, 0.7), skinB);
  many(T, [...[-1, 1].map((s) => new THREE.SphereGeometry(0.14, 12, 9).scale(1.05, 0.72, 0.6).translate(s * 0.13, 0.6, 0.15)),
    new THREE.CylinderGeometry(0.15, 0.2, 0.16, 12).translate(0, D.chest + 0.04, 0.0)], skinB);
  // the wide leather belt, bronze plates on it and a square buckle; the loincloth front and back, ragged
  many(T, [lathe([[0.262, -0.04], [0.27, 0.06], [0.258, 0.14]], 22, 0.74)], leatherB);
  many(T, [...[-0.85, -0.42, 0.42, 0.85].map((a) => new THREE.BoxGeometry(0.1, 0.11, 0.02).translate(0, 0.05, 0.268).rotateY(a).scale(1, 1, 0.74)),
    new THREE.TorusGeometry(0.045, 0.012, 4, 4).rotateZ(Math.PI / 4).translate(0, 0.05, 0.205), new THREE.BoxGeometry(0.06, 0.012, 0.015).translate(0, 0.05, 0.21)], bronzeB);
  const hem = pivot(T, 0, -0.04, 0, 'hem');
  const flap = (z, w, l) => { const geo = new THREE.PlaneGeometry(w, l, 4, 3).translate(0, -l / 2, 0); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (z > 0 ? 1 : -1) * (0.04 * Math.cos((x / w) * Math.PI)) - 0.02 * (y / l)); if (y < -l * 0.95) p.setY(i, y + 0.04 * Math.sin(x * 37)); } geo.computeVertexNormals(); return geo.translate(0, 0, z); };
  many(hem, [flap(0.2, 0.34, 0.5), flap(-0.18, 0.38, 0.46), ...tatters(10, 0.25, -0.02, 0.18, 0.74, 0.1)], clothB);
  const fists = [null, null];
  // arms: thick and muscled; bronze bracers on the forearms; big hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    fists[i] = clawHand(J.hands[i], s, 2.0, skinB, skinB);
    // (lofted: the deltoid under its pauldron, the biceps' swell, the forearm thick below the elbow)
    many(arm, [loftLimb(D.upper, [[-0.14, 0.07, 0.07], [0.04, 0.14, 0.135, 0, 0.015], [0.3, 0.12, 0.13, 0.015], [0.55, 0.105, 0.125, 0.025], [0.88, 0.09, 0.092], [1.03, 0.088, 0.088]], s, 9)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.09, 9, 7), loftLimb(D.fore, [[0, 0.09, 0.09], [0.2, 0.108, 0.1, 0.006, 0.008], [0.55, 0.09, 0.08], [0.9, 0.07, 0.062], [1.02, 0.068, 0.06]], s, 9)], skinB);
    many(J.elbows[i], [new THREE.CylinderGeometry(0.098, 0.104, 0.22, 12).translate(0, -D.fore + 0.15, 0), ...[-0.06, 0.06].map((y) => new THREE.TorusGeometry(0.104, 0.012, 4, 14).rotateX(Math.PI / 2).translate(0, -D.fore + 0.15 + y, 0))], bronzeB);
  });
  // legs: thick; bare broad feet; a bronze greave on each shin and its knee (plates)
  const plates = [];
  J.legs.forEach((leg, i) => {
    const f = clawFoot(2.1, 5), s = i ? 1 : -1;
    // (lofted: a heavy thigh, the calf's mass high behind the shin, the ankle narrow over the broad foot)
    many(leg, [loftLimb(D.thigh, [[-0.15, 0.09, 0.09], [0.04, 0.14, 0.14], [0.45, 0.125, 0.13, 0.012], [0.9, 0.095, 0.095], [1.04, 0.09, 0.09]], s, 9)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.1, 9, 7).translate(0, 0, 0.01), loftLimb(D.shin, [[0, 0.1, 0.1], [0.25, 0.105, 0.118, -0.02], [0.7, 0.08, 0.08], [1, 0.07, 0.07]], s, 9)], skinB);
    many(J.feet[i], [...f.skin, ...f.claw], skinB);
    many(J.knees[i], [new THREE.TorusGeometry(0.088, 0.016, 4, 12).rotateX(Math.PI / 2).translate(0, -D.shin + 0.06, 0), new THREE.TorusGeometry(0.1, 0.016, 4, 12).rotateX(Math.PI / 2).translate(0, -0.2, 0)], leatherB);
    // (a bronze buckle on each strap, on its outer side: the sheet's)
    many(J.knees[i], [[0.088, -D.shin + 0.06], [0.1, -0.2]].flatMap(([r, y]) => [new THREE.BoxGeometry(0.014, 0.042, 0.04).translate(r + 0.012, y, 0), new THREE.BoxGeometry(0.008, 0.012, 0.03).translate(r + 0.02, y, 0)].map((g) => g.rotateY(s > 0 ? -0.3 : Math.PI + 0.3))), bronzeB);
  });
  // the head: a great cat's, big for its body (the sheet's): a broad skull, the muzzle, a dark nose, a heavy brow, small
  // ears; two ram horns curled back and down round them to the cheeks, their tips out and forward. All on a pivot at
  // WARLORD_HEAD's scale over the neck
  const H = J.head, Hf = pivot(H, 0, -0.02, 0.01, 'face');
  Hf.scale.setScalar(WARLORD_HEAD.scale);
  many(Hf, [new THREE.SphereGeometry(0.15, 16, 12).scale(1, 1.05, 1).translate(0, 0.16, 0.0),
    new THREE.SphereGeometry(0.1, 14, 10).scale(1.15, 0.82, 0.9).translate(0, 0.09, 0.115),
    new THREE.SphereGeometry(0.06, 10, 7).scale(1.35, 0.8, 0.95).translate(0, 0.035, 0.1),
    new THREE.CapsuleGeometry(0.034, 0.15, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.8, 0.9).translate(0, 0.2, 0.125),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.035, 0.07, 6).scale(1, 1, 0.5).rotateZ(-s * 1.3).translate(s * 0.15, 0.17, -0.01))], skinB);
  many(Hf, [new THREE.SphereGeometry(0.034, 8, 6).scale(1.35, 0.72, 0.9).translate(0, 0.128, 0.2),
    tubeGeometry([[-0.05, 0.066, 0.183], [-0.018, 0.055, 0.198], [0, 0.07, 0.205], [0.018, 0.055, 0.198], [0.05, 0.066, 0.183]], 0.005),
    new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4).translate(0, 0.094, 0.204)], inkB);
  many(Hf, [-1, 1].map((s) => ramHorn(s)), hornB);
  // the mane: a shaggy ruff round the face (never over it), over the crown between the horns, a beard down its throat to
  // its chest, long down its back: long flat locks (the shape pass, #726: not cone tufts), each out from its root, then
  // falling, swept back, its tip curling, all one mesh; a cap of it over the crown
  const locks = [], lock = (root, out, l, wd, back = 0.3) => {
    const o = new THREE.Vector3(...out).normalize(), R = new THREE.Vector3(...root);
    const p1 = R.clone().addScaledVector(o, l * 0.2).add(new THREE.Vector3(0, -0.04 * l, -back * 0.25 * l));
    const p2 = p1.clone().addScaledVector(o, l * 0.06).add(new THREE.Vector3(0, -0.42 * l, -back * 0.3 * l));
    const p3 = p2.clone().add(new THREE.Vector3(o.x * 0.05 * l, -0.36 * l, -back * 0.06 * l));
    locks.push(loftAlong([R, p1, p2, p3], (u) => wd * (1 - 0.85 * u), (u) => wd * 0.4 * (1 - 0.8 * u), 4, 5, out));
  };
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 16; i++) {
    const a = ((i + ring * 0.5) / 16) * Math.PI * 2, R = 0.14 + ring * 0.045, low = Math.max(0, -Math.cos(a)), side = Math.abs(Math.sin(a)) * Math.max(0, Math.cos(a) + 0.3);
    // (shorter at the sides by the horns, long under the jaw: its beard; the crown's swept back over its head)
    const l = (0.2 + 0.05 * ((i * 7 + ring * 3) % 5) / 4 + low * 0.18 + ring * 0.1) * (1 - 0.5 * side);
    lock([Math.sin(a) * R, 0.12 + Math.cos(a) * R * 1.05, -0.03 - ring * 0.08], [Math.sin(a), Math.cos(a) * (Math.cos(a) > 0 ? 0.3 : 0.8), -0.35 - ring * 0.3 - 0.3 * Math.max(0, Math.cos(a))], l, 0.06 + ring * 0.012, 0.25 + 0.5 * Math.max(0, Math.cos(a)) + ring * 0.25);
  }
  // (the mass of it the locks lie on: over the crown and down the back of its head and neck)
  locks.push(new THREE.SphereGeometry(0.16, 12, 9).scale(1.05, 1.1, 1.0).translate(0, 0.13, -0.08), new THREE.SphereGeometry(0.17, 10, 8).scale(1.2, 1.35, 0.75).translate(0, -0.02, -0.14));
  many(Hf, locks, maneB);
  // (its chest's and its back's: locks down from the throat and the nape)
  const bodyLocks = [];
  for (let i = 0; i < 9; i++) { const x = -0.2 + i * 0.05, l = 0.3 + 0.08 * ((i * 3) % 4) / 3; bodyLocks.push(loftAlong([[x, D.chest + 0.06, 0.17 - Math.abs(x) * 0.3], [x * 1.05, D.chest - l * 0.45, 0.2 - Math.abs(x) * 0.3], [x * 1.1, D.chest - l * 0.95, 0.19 - Math.abs(x) * 0.3]], (u) => 0.045 * (1 - 0.85 * u), (u) => 0.018 * (1 - 0.8 * u), 4, 5, [0, 0, 1])); }
  for (let i = 0; i < 8; i++) { const x = -0.21 + i * 0.06, l = 0.46 + 0.06 * Math.cos(i * 2.1); bodyLocks.push(loftAlong([[x, D.chest + 0.14, -0.17], [x * 1.05, D.chest - l * 0.4, -0.24 - 0.02 * Math.cos(i)], [x * 1.1, D.chest - l, -0.23]], (u) => 0.06 * (1 - 0.8 * u), (u) => 0.022 * (1 - 0.8 * u), 4, 5, [0, 0, -1])); }
  many(T, bodyLocks, maneB);
  const eyes = pivot(Hf, 0, 0, 0, 'eyes');
  many(eyes, [-1, 1].map((s) => new THREE.SphereGeometry(0.021, 9, 7).scale(1.25, 0.72, 0.6).translate(s * 0.055, 0.162, 0.162)), eyeM);   // (both eyes one draw)
  many(Hf, [-1, 1].map((s) => new THREE.SphereGeometry(0.009, 6, 5).scale(1, 1.4, 0.5).translate(s * 0.055, 0.162, 0.174)), inkB);
  // its plates (ARMOUR.warlord, in the order they fall): the right shoulder, the left, the right greave, the left. Rough
  // bronze, each a dome over the shoulder and a lame under it; a greave down each shin with its knee cop
  for (const [k, arm] of J.arms.entries()) {
    const s = k ? 1 : -1;
    // (two layers, the sheet's: the dome, then a second, wider plate stepped out under it, and its lame)
    const geo = merged([new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, 1.12).scale(1.05, 0.78, 1.05).rotateZ(s * 0.32).translate(s * 0.02, 0.06, 0),
      new THREE.SphereGeometry(0.215, 14, 4, 0, Math.PI * 2, 0.95, 0.42).scale(1.04, 0.92, 1.06).rotateZ(s * 0.36).translate(s * 0.035, -0.03, 0),
      new THREE.SphereGeometry(0.225, 14, 3, 0, Math.PI * 2, 1.25, 0.28).scale(1.02, 1.0, 1.05).rotateZ(s * 0.4).translate(s * 0.05, -0.1, 0)]);
    plates.push(plate(arm, geo, plateM, 0, 0, 0, `pauldron ${s > 0 ? 'left' : 'right'}`));
  }
  for (const [k, knee] of J.knees.entries()) {
    const s = k ? 1 : -1, prof = Array.from({ length: 6 }, (_, i) => [0.095 - 0.022 * (i / 5), -0.04 - (D.shin - 0.12) * (i / 5)]).reverse();
    const geo = merged([shellPlate(prof, -1.15, 2.3, { out: 0.012, thick: 0.03, segs: 10 }), new THREE.SphereGeometry(0.11, 12, 7, -1.4, 2.8, 0.5, 1.6).translate(0, 0.0, 0.02)]);
    plates.push(plate(knee, geo, plateM, 0, 0, 0, `greave ${s > 0 ? 'left' : 'right'}`));
  }
  // the glaive in its right fist: the dark shaft held a third of the way up, steel rings, a long curved blade on top
  const grip = pivot(J.hands[0], 0, -0.1, 0.02, 'grip');
  const lo = -0.72, L = 2.4;   // (the butt kept a hand over the ground: a slope's rise beside it, tests/foe-slope.test.js)
  many(grip, [new THREE.CylinderGeometry(0.03, 0.033, L, 8).translate(0, lo + L / 2, 0)], woodB);
  many(grip, [curvedBlade(0.78, 0.16, 0.16, lo + L - 0.02, 0.012, true).rotateY(-Math.PI / 2), ...[lo + 0.04, lo + 0.55, lo + L - 0.32, lo + L - 0.06].map((y, i) => new THREE.CylinderGeometry(0.04, 0.04, i % 3 ? 0.04 : 0.08, 8).translate(0, y, 0)),
    new THREE.CylinderGeometry(0.03, 0.04, 0.06, 8).translate(0, lo - 0.02, 0)], steelB);
  let cur = null;
  const style = (Jt, want) => {
    J.torso.rotateX(WARLORD_STANCE.chest);
    const Mv = cur?.atk ? WARLORD_MOVES[cur.atk.id] : null;
    if (Mv && want.clip) J.body.rotateY(spinAngle(want, cur.k, Mv));
    if (cur?.atk?.id === 'roar' && want.kind === 'wind') J.head.rotateX(-0.5 * Math.min(1, want.load ?? 0));
    if (cur?.atk?.id === 'charge' && (want.kind === 'wind' || want.phase === 'strike')) J.head.rotateX(0.35 * (want.kind === 'wind' ? Math.min(1, want.load ?? 0) : 1));
  };
  const driver = new HumanoidDriver(J, rig, { moves: WARLORD_MOVES, speeds: WARLORD_SPEEDS, style, seat: 0.4 });
  const wield = new Wielder(J, driver, { fists, grips: [grip, null], weapons: WARLORD_HOLD });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.7, up: 0.35, down: 0.45 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [maneB, inkB], into: M.mat('mane', P.mane, vc) }, { from: [hornB], into: M.mat('horn', P.horn, vc) },
    { from: [bronzeB], into: M.mat('bronze', P.bronze, vc) }, { from: [clothB, leatherB], into: M.mat('cloth', P.cloth, vc) }, { from: [woodB], into: M.mat('wood', P.wood, vc) },
    { from: [steelB], into: M.mat('steel', P.steel, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(1.8, 0.35, 0, 0.25);
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, plates, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.mane, P.bronze],
    driver, joints: J, wield, fists,
    tell: (id) => (id === 'roar' ? H : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      const sw = sway.update(dt, driver.speed, f.heading);
      hangFromHips(hem, J.body, sw.x, sw.z);
      // the glaive in its fists (WARLORD_HOLD)
      wield.update(f, want, c, 'glaive');
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}
