import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../materials.js';
import { SPECIES } from './species.js';

// The aliens' bodies (docs/systems/aliens.md): procedural, in the game's flat printed colours
// (one colour per piece, vertex colours, like the wildlife and the dog) and inked by the post
// pass like people (figure: true). No skeleton: each species is a few rigid parts moved by its
// motor (alien.js), and the soft parts (a drifter's threads, a shellback's foot) are bent on
// the CPU, only near the camera.
//
//   buildBody(species, { seed, tint })  → { root, parts, far, mats: { body, glow } }
//     root   the near body (a Group, origin on the ground under them, +z their front)
//     parts  the moving pieces, by name (each species' own)
//     far    one merged mesh of the body at rest, few triangles: drawn past SPECIES.lod.mid
//     mats   their own materials (cloned, so a tone, a splash or a stilling glob can tint them alone)

const _c = new THREE.Color(), _m = new THREE.Matrix4(), _e = new THREE.Euler(), _v = new THREE.Vector3();

/** A piece: scaled, turned, placed, flat-coloured (a colour or (x, y, z) => colour per vertex). */
export function piece(g, color, at = null, rot = null, scale = null) {
  if (scale) g.scale(...scale);
  if (rot) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0)));
  if (at) g.translate(at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  if (!out.attributes.normal) out.computeVertexNormals();
  const P = out.attributes.position, n = P.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    _c.set(typeof color === 'function' ? color(P.getX(i), P.getY(i), P.getZ(i)) : color);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const merge = (...list) => { const g = mergeGeometries(list.flat(3)); g.computeBoundingSphere(); return g; };
const ell = (r, color, at, rot, seg = [12, 8]) => piece(new THREE.SphereGeometry(1, seg[0], seg[1]), color, at, rot, r);
const cyl = (rt, rb, h, color, at, rot, seg = 8) => piece(new THREE.CylinderGeometry(rt, rb, h, seg, 1), color, at, rot);
const cone = (r, h, color, at, rot, seg = 8) => piece(new THREE.ConeGeometry(r, h, seg, 1), color, at, rot);
const torus = (R, r, color, at, rot, seg = [5, 20]) => piece(new THREE.TorusGeometry(R, r, seg[0], seg[1]), color, at, rot);
const tube = (pts, r, color, segs = 12, radial = 5) => piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), segs, r, radial, false), color);
/** A limb: a unit-long tapered cylinder from its root (0) up +y to its tip (1); placed by scaling y to the bone's length. */
const limb = (r0, r1, color, seg = 6) => piece(new THREE.CylinderGeometry(r1, r0, 1, seg, 1).translate(0, 0.5, 0), color);

/** Rest positions kept for bending a soft part on the CPU (alien.js), and the per-vertex weights. */
function soft(g, weights) {
  g.userData.rest = Float32Array.from(g.attributes.position.array);
  g.userData.w = weights;
  g.attributes.position.setUsage(THREE.DynamicDrawUsage);
  return g;
}

let BASE = null;
function baseMats() {
  BASE ??= { body: makeMaterial({ color: '#ffffff', vertexColors: true, figure: true }), side: makeMaterial({ color: '#ffffff', vertexColors: true, figure: true, side: THREE.DoubleSide }) };
  return BASE;
}
/** A material of their own (its uniforms theirs, the world's shared ones still shared: materials.js markHero). */
export function ownMaterial(mat) {
  const m = mat.clone();
  Object.assign(m.uniforms, sharedUniforms);
  m.defines = { ...mat.defines };
  return m;
}
const glowMat = (color) => ownMaterial(makeMaterial({ color, glow: 0.92, figure: true }));

function mesh(g, mat, name) {
  const o = new THREE.Mesh(g, mat);
  o.name = name;
  Object.assign(o.userData, { noCollide: true, dynamic: true, noLod: true });
  return o;
}
function group(name, at = null) {
  const g = new THREE.Group();
  g.name = name;
  if (at) g.position.set(...at);
  return g;
}

// ------------------------------------------------------------------ the drifter
const DRIFT = { bellR: 0.95, bellH: 0.78, threads: 9, threadLen: 2.0, arms: 4 };
function drifterBody({ tint = {}, lo = false }) {
  const A = tint.skin ?? '#e6cfe0', B = tint.rib ?? '#c9a3c4', R = tint.rim ?? '#b07ba9', S = '#3a2c3c';
  const seg = lo ? [10, 5] : [20, 10];
  // the bell: a little more than half a sphere, ribbed every 40°, a darker band at the rim
  const bell = piece(new THREE.SphereGeometry(1, seg[0], seg[1], 0, Math.PI * 2, 0, Math.PI * 0.6), (x, y) => (y < -0.12 ? R : y > 0.7 ? B : A), null, null, [DRIFT.bellR, DRIFT.bellH, DRIFT.bellR]);
  const rim = torus(DRIFT.bellR * 0.97, 0.07, R, [0, -DRIFT.bellH * 0.3, 0], [Math.PI / 2, 0, 0], lo ? [3, 12] : [5, 24]);
  // ribs from the crown down to the rim, like the gores of a parasol
  const ribs = lo ? [] : Array.from({ length: 9 }, (_, k) => {
    const a = (k / 9) * Math.PI * 2 + 0.17, pts = [];
    for (let j = 0; j <= 6; j++) { const t = 0.2 + (j / 6) * (Math.PI * 0.6 - 0.24); pts.push([Math.sin(a) * Math.sin(t) * DRIFT.bellR * 1.012, Math.cos(t) * DRIFT.bellH * 1.012, Math.cos(a) * Math.sin(t) * DRIFT.bellR * 1.012]); }
    return tube(pts, 0.022, B, 10, 3);
  });
  // eyespots round the bell, between the ribs: a ring of small dark marks (they see light, not faces)
  const spots = lo ? [] : Array.from({ length: 9 }, (_, k) => {
    const a = ((k + 0.5) / 9) * Math.PI * 2 + 0.17, t = 1.32, r = DRIFT.bellR * Math.sin(t) * 1.0, y = DRIFT.bellH * Math.cos(t) * 1.0;
    return ell([0.04, 0.055, 0.03], S, [Math.sin(a) * r, y, Math.cos(a) * r], [0, a, 0], [6, 4]);
  });
  const crown = ell([0.16, 0.12, 0.16], B, [0, DRIFT.bellH * 0.98, 0], null, lo ? [6, 4] : [10, 6]);
  return { shell: merge(bell, rim, ...ribs, ...spots, crown) };
}
function drifterThreads({ tint = {}, lo = false }) {
  const T = tint.thread ?? '#d8bcd6', T2 = tint.arm ?? '#f0d9ea';
  const pieces = [], w = [];
  const n = lo ? 6 : DRIFT.threads, segs = lo ? 4 : 14;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.2, r = DRIFT.bellR * 0.82, x = Math.sin(a) * r, z = Math.cos(a) * r;
    const L = DRIFT.threadLen * (0.8 + 0.2 * ((k * 7) % 5) / 4);
    const top = -DRIFT.bellH * 0.28;
    pieces.push(tube([[x, top, z], [x * 0.98, top - L * 0.35, z * 0.98], [x * 0.92, top - L * 0.7, z * 0.92], [x * 0.88, top - L, z * 0.88]], lo ? 0.03 : 0.026, T, segs, lo ? 3 : 4));
  }
  // the frilled arms round the heart: short, pale, wavy
  if (!lo) for (let k = 0; k < DRIFT.arms; k++) {
    const a = (k / DRIFT.arms) * Math.PI * 2 + 0.6, r = 0.2, x = Math.sin(a) * r, z = Math.cos(a) * r;
    pieces.push(tube([[x, -0.3, z], [x * 1.4 + 0.05, -0.65, z * 1.4], [x * 1.1 - 0.05, -1.0, z * 1.1], [x * 1.3, -1.3, z * 1.3]], 0.06, T2, 10, 5));
  }
  const g = merge(...pieces);
  // weights: how far down the thread a vertex is (0 at the bell, 1 at the tip)
  const P = g.attributes.position, top = -DRIFT.bellH * 0.28, wts = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) wts[i] = Math.min(1, Math.max(0, (top - P.getY(i)) / DRIFT.threadLen));
  return soft(g, wts);
}
function buildDrifter({ seed, tint, mats }) {
  const root = group('drifter');
  const body = group('bell', [0, SPECIES.drifter.hover, 0]);   // bobs, pulses, tilts
  root.add(body);
  const B = drifterBody({ tint });
  const shell = mesh(B.shell, mats.body, 'bell');
  body.add(shell);
  const threads = mesh(drifterThreads({ tint }), mats.body, 'threads');
  threads.frustumCulled = false;   // (bent on the CPU: its bounds move)
  body.add(threads);
  const heart = mesh(piece(new THREE.SphereGeometry(1, 14, 10), '#ffffff', [0, -0.42, 0], null, [0.26, 0.32, 0.26]), mats.glow, 'heart');
  body.add(heart);
  // far: the bell, a few straight threads and the heart, at rest
  const L = drifterBody({ tint, lo: true }), LT = drifterThreads({ tint, lo: true });
  const far = merge(L.shell, LT, piece(new THREE.SphereGeometry(1, 8, 6), tint?.glowFar ?? '#f7dc9c', [0, -0.42, 0], null, [0.26, 0.32, 0.26]));
  far.translate(0, SPECIES.drifter.hover, 0);
  return { root, parts: { body, shell, threads, heart }, far };
}

// ------------------------------------------------------------------ the stilt-walker
export const STILT = { hub: 2.3, thigh: 2.05, shin: 2.95, spread: 2.5, legs: 3, neck: 1.75, lamp: 1.35 };
/** The knee between a hip and a foot (two bones, the knee bent out and up: a harvestman's). */
export function kneeOf(hip, foot, thigh, shin, out, outward) {
  const d = _v.subVectors(foot, hip), len = Math.min(d.length(), thigh + shin - 1e-3);
  const dir = d.normalize();
  // along the line: the law of cosines; then out and up, perpendicular to the line
  const a = (thigh * thigh - shin * shin + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(0, thigh * thigh - a * a));
  const side = new THREE.Vector3().copy(outward).addScaledVector(dir, -outward.dot(dir));
  if (side.lengthSq() < 1e-6) side.set(0, 1, 0);
  side.normalize();
  if (side.y < 0.2) side.y += 0.6, side.normalize();
  return out.copy(hip).addScaledVector(dir, a).addScaledVector(side, h);
}
function stiltParts({ tint = {}, lo = false }) {
  const BONE = tint.bone ?? '#efe6d3', CLOTH = tint.cloth ?? '#c98f5a', BAND = tint.band ?? '#7c4f3a', DARK = '#3b302b';
  const seg = lo ? 6 : 12, L = STILT.lamp;
  const body = merge(
    ell([0.2, 0.16, 0.2], BONE, [0, 0, 0], null, [seg, 6]),                         // the hub the legs hang from
    cyl(0.12, 0.56, 1.55, CLOTH, [0, 0.27, 0], null, seg),                           // the robe, from the neck to below the hub (the legs come out through it)
    cyl(0.565, 0.58, 0.14, BAND, [0, -0.5, 0], null, seg),                           // its hem band
    ...(lo ? [] : Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2 + 0.2; return cyl(0.022, 0.012, 0.38, BAND, [Math.sin(a) * 0.55, -0.75, Math.cos(a) * 0.55], null, 4); })),   // tassels on the hem
    ell([0.2, 0.36, 0.19], BONE, [0, 1.1, 0.03], null, [seg, 8]),                    // the chest over it
    torus(0.17, 0.035, BAND, [0, 1.3, 0.02], [Math.PI / 2, 0, 0], [4, seg + 4]),       // a collar
    cyl(0.045, 0.06, 0.42, BONE, [0, 1.52, 0.05], [0.15, 0, 0], 6),                  // the neck
  );
  const head = merge(
    cone(0.3 * L, 0.3 * L, BAND, [0, 0.38 * L, 0], null, seg),                       // the lantern's cap
    ell([0.07, 0.07, 0.07], BAND, [0, 0.56 * L, 0]),                                // its knob
    torus(0.24 * L, 0.03, DARK, [0, 0.02, 0], [Math.PI / 2, 0, 0], [4, seg + 4]),     // the lower ring
    ...(lo ? [] : [0, 1, 2, 3].map((k) => { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; return cyl(0.02, 0.02, 0.26 * L, DARK, [Math.sin(a) * 0.24 * L, 0.13 * L, Math.cos(a) * 0.24 * L], null, 4); })),
  );
  return { body, head, BONE, DARK };
}
function buildStilt({ tint, mats }) {
  const root = group('stilt');
  const hub = group('hub', [0, STILT.hub, 0]);
  root.add(hub);
  const P = stiltParts({ tint });
  hub.add(mesh(P.body, mats.body, 'body'));
  const neck = group('neck', [0, STILT.neck, 0.08]);
  hub.add(neck);
  const head = group('head');   // the lantern: swings on the neck
  neck.add(head);
  head.add(mesh(P.head, mats.body, 'lantern'));
  const flame = mesh(piece(new THREE.SphereGeometry(1, 14, 10), '#ffffff', [0, 0.14 * STILT.lamp, 0], null, [0.19 * STILT.lamp, 0.17 * STILT.lamp, 0.19 * STILT.lamp]), mats.glow, 'flame');
  head.add(flame);
  // the legs: a thigh and a shin each, placed every frame (alien.js), a knee ball and a foot pad
  const thighG = limb(0.085, 0.055, P.BONE), shinG = limb(0.055, 0.024, P.BONE);
  const kneeG = ell([0.085, 0.085, 0.085], P.BONE), footG = merge(cone(0.09, 0.14, P.DARK, [0, 0.07, 0], [Math.PI, 0, 0], 6));
  // (one instanced draw for the three thighs, one for the shins, the knees, the feet: placed every frame by alien.js)
  const limbs = Object.fromEntries([['thighs', thighG], ['shins', shinG], ['knees', kneeG], ['feet', footG]].map(([name, g]) => {
    const m = new THREE.InstancedMesh(g, mats.body, STILT.legs);
    m.name = name;
    Object.assign(m.userData, { noCollide: true, dynamic: true, noLod: true });
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;   // (its bounds are the unit limb's, not where the legs are)
    root.add(m);
    return [name, m];
  }));
  const legs = Array.from({ length: STILT.legs }, (_, k) => ({ k, a: (k / STILT.legs) * Math.PI * 2 + Math.PI / 3 }));
  // far: at rest, legs straight from the hub to their feet over the knees
  const L = stiltParts({ tint, lo: true }), farParts = [L.body.clone().translate(0, STILT.hub, 0), L.head.clone().translate(0, STILT.hub + STILT.neck, 0.08),
    piece(new THREE.SphereGeometry(1, 8, 6), tint?.glowFar ?? '#ffc56a', [0, STILT.hub + STILT.neck + 0.14 * STILT.lamp, 0.08], null, [0.19 * STILT.lamp, 0.17 * STILT.lamp, 0.19 * STILT.lamp])];
  const hip = new THREE.Vector3(), foot = new THREE.Vector3(), knee = new THREE.Vector3(), out = new THREE.Vector3();
  for (const l of legs) {
    hip.set(Math.sin(l.a) * 0.15, STILT.hub, Math.cos(l.a) * 0.15);
    foot.set(Math.sin(l.a) * STILT.spread, 0, Math.cos(l.a) * STILT.spread);
    kneeOf(hip, foot, STILT.thigh, STILT.shin, knee, out.set(Math.sin(l.a), 0.7, Math.cos(l.a)));
    for (const [a, b, r] of [[hip, knee, 0.07], [knee, foot, 0.045]]) {
      const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r * 0.7, r, len, 4, 1).translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.subVectors(b, a).normalize())).translate(a.x, a.y, a.z);
      farParts.push(piece(g, P.BONE));
    }
  }
  return { root, parts: { hub, neck, head, flame, legs, limbs }, far: merge(...farParts) };
}

// ------------------------------------------------------------------ the shellback
/** The coil, on its side (its axis across the back, x): a run of spheres along a shrinking spiral, banded. */
function coil(lo) {
  const N = lo ? 9 : 30, out = [];
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1), a = Math.PI + t * Math.PI * 2 * 2.15;
    const R = 0.46 * Math.exp(-1.5 * t), r = 0.46 * Math.exp(-1.75 * t) + 0.035;
    out.push({ k, t, r, at: [0.2 * t, 0.78 + Math.cos(a) * R, -0.08 - Math.sin(a) * R] });
  }
  return out;
}
function shellWhorl({ tint = {}, lo = false }) {
  const MOSS = tint.moss ?? '#d8c48e', BAND = tint.band ?? '#8b6fae', PALE = tint.pale ?? '#9fb57a';
  const seg = lo ? [7, 5] : [12, 8];
  const parts = coil(lo).map((c) => ell([c.r * 1.08, c.r, c.r], Math.floor(c.k / (lo ? 1 : 3)) % 2 ? BAND : MOSS, c.at, null, seg));
  parts.push(torus(0.4, 0.05, PALE, [0, 0.32, 0.02], [Math.PI / 2, 0, 0], lo ? [3, 10] : [4, 18]));   // the lip over the foot
  if (!lo) for (let k = 0; k < 6; k++) {   // moss tufts along the top of the whorl
    const a = -0.9 + k * 0.36;
    parts.push(piece(new THREE.ConeGeometry(0.06, 0.16, 5, 1), PALE, [(k % 2 ? 0.12 : -0.12), 0.78 + Math.cos(a) * 0.9, -0.08 - Math.sin(a) * 0.9 * 0.55], [-a * 0.6, 0, 0]));
  }
  return merge(...parts);
}
/** Its moss lamps: a few warm dots on the sides of the coil. */
function shellLampDots() {
  return coil(false).filter((c) => c.k % 5 === 3).map((c, j) => piece(new THREE.SphereGeometry(1, 6, 4), '#ffffff', [c.at[0] + (j % 2 ? 1 : -1) * c.r * 1.02, c.at[1] + c.r * 0.3, c.at[2]], null, [0.055, 0.055, 0.055]));
}
function shellFoot({ tint = {}, lo = false }) {
  const SKIN = tint.skin ?? '#d9e2d0', DARK = tint.sole ?? '#9fb5a8';
  const g = piece(new THREE.SphereGeometry(1, lo ? 10 : 18, lo ? 6 : 10), (x, y, z) => (y < 0.05 ? DARK : SKIN), [0, 0.2, 0.1], null, [0.46, 0.24, 1.05]);
  if (lo) return g;
  const P = g.attributes.position, w = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) w[i] = (P.getZ(i) + 0.95) / 2.1;   // 0 at the tail .. 1 at the front
  return soft(g, w);
}
function shellHead({ tint = {}, lo = false }) {
  const SKIN = tint.skin ?? '#d9e2d0', DARK = '#2f3a3c';
  return merge(
    ell([0.2, 0.3, 0.23], SKIN, [0, 0.26, 0.02], [-0.25, 0, 0], lo ? [8, 5] : [12, 8]),
    ...(lo ? [] : [
      ell([0.1, 0.018, 0.03], DARK, [0, 0.14, 0.23], [-0.2, 0, 0], [6, 3]),                                   // a small mouth
      cone(0.03, 0.16, SKIN, [-0.09, 0.12, 0.26], [1.9, 0, 0.3], 5), cone(0.03, 0.16, SKIN, [0.09, 0.12, 0.26], [1.9, 0, -0.3], 5),   // two feelers
    ]),
  );
}
function buildShell({ tint, mats }) {
  const root = group('shellback');
  const lean = group('lean');     // rolls on a push, rocks as it walks
  root.add(lean);
  const foot = mesh(shellFoot({ tint }), mats.body, 'foot');
  foot.frustumCulled = false;
  lean.add(foot);
  const shell = group('shell', [0, 0.05, -0.15]);
  lean.add(shell);
  shell.add(mesh(shellWhorl({ tint }), mats.body, 'whorl'));
  // the moss lamps on the whorl: a few warm dots (one mesh, the glow material)
  const lamps = mesh(merge(...shellLampDots()), mats.glow, 'lamps');
  shell.add(lamps);
  const head = group('head', [0, 0.3, 0.88]);
  lean.add(head);
  head.add(mesh(shellHead({ tint }), mats.body, 'headMesh'));
  const SKIN = tint?.skin ?? '#d9e2d0';
  const stalkG = limb(0.032, 0.022, SKIN), eyeG = merge(ell([0.062, 0.062, 0.062], '#f4f1e6', [0, 0, 0]), ell([0.028, 0.032, 0.02], '#232022', [0, 0, 0.05], null, [8, 6]));
  const eyes = [-1, 1].map((s) => {
    const stalk = group(`stalk${s}`, [s * 0.07, 0.48, 0.06]);
    stalk.add(mesh(stalkG, mats.body, 'stalkMesh'));
    const eye = group('eye', [0, 1, 0]);   // (at the stalk's tip: the stalk group is scaled in y to its length)
    stalk.add(eye);
    eye.add(mesh(eyeG, mats.body, 'eyeMesh'));
    head.add(stalk);
    return { stalk, eye, s };
  });
  const far = merge(shellFoot({ tint, lo: true }), shellWhorl({ tint, lo: true }).translate(0, 0.05, -0.15), shellHead({ tint, lo: true }).translate(0, 0.3, 0.88));
  return { root, parts: { lean, foot, shell, lamps, head, eyes }, far };
}

// ------------------------------------------------------------------ the murmurs
/** One of them: a pale bulb, its soft tip bent forward like a hood, two dark eyes, a blush. Height 1 (scaled per member). */
export function murmurGeometry({ lo = false } = {}) {
  const prof = [[0, 0], [0.24, 0.02], [0.4, 0.12], [0.46, 0.3], [0.42, 0.5], [0.3, 0.68], [0.17, 0.82], [0.07, 0.94], [0.0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, lo ? 7 : 16);
  // the tip bends forward
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > 0.6) P.setZ(i, P.getZ(i) + (y - 0.6) ** 2 * 1.4); }
  g.computeVertexNormals();
  const SKIN = '#f3eee4', SOFT = '#ddd3e3';
  const body = piece(g, (x, y) => (y < 0.06 ? SOFT : SKIN));
  if (lo) return merge(body, ell([0.05, 0.07, 0.03], '#26232a', [-0.13, 0.5, 0.39], null, [4, 3]), ell([0.05, 0.07, 0.03], '#26232a', [0.13, 0.5, 0.39], null, [4, 3]));
  return merge(body,
    ell([0.055, 0.075, 0.03], '#26232a', [-0.13, 0.52, 0.385], [0, -0.3, 0], [8, 6]), ell([0.055, 0.075, 0.03], '#26232a', [0.13, 0.52, 0.385], [0, 0.3, 0], [8, 6]),
    ell([0.06, 0.03, 0.02], '#eab3bf', [-0.22, 0.42, 0.37], [0, -0.5, 0], [6, 4]), ell([0.06, 0.03, 0.02], '#eab3bf', [0.22, 0.42, 0.37], [0, 0.5, 0], [6, 4]),
  );
}
function buildMurmur({ mats, count = 5 }) {
  const root = group('murmurs');
  const near = new THREE.InstancedMesh(murmurGeometry(), mats.body, count);
  const far = new THREE.InstancedMesh(murmurGeometry({ lo: true }), mats.body, count);
  for (const m of [near, far]) {
    Object.assign(m.userData, { noCollide: true, dynamic: true, noLod: true });
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;   // (the members move about the cluster's centre)
    root.add(m);
  }
  near.name = 'murmurs'; far.name = 'murmurs far';
  far.visible = false;
  return { root, parts: { near, far }, far: null };
}

const BUILD = { drifter: buildDrifter, stilt: buildStilt, shell: buildShell, murmur: buildMurmur };

/** A body for one of `species` (SPECIES ids), with materials of its own. */
export function buildBody(species, { seed = 0, tint = {}, count } = {}) {
  const S = SPECIES[species];
  if (!S) throw new Error(`no species ${species}`);
  const base = baseMats();
  const mats = { body: ownMaterial(base.body), glow: glowMat(tint.glow ?? S.glow) };
  const made = BUILD[species]({ seed, tint, mats, count: count ?? S.members ?? 1 });
  let far = null;
  if (made.far) { far = mesh(made.far, mats.body, `${species} far`); far.visible = false; }
  made.root.userData.noCollide = true;
  if (S.scale) { made.root.scale.setScalar(S.scale); far?.scale.setScalar(S.scale); }   // (a species drawn bigger than it is modelled)
  return { root: made.root, parts: made.parts, far, mats };
}
