import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { figureGeometry } from './crowd.js';
import { CROWD_PARTS as P, CROWD_SLOTS as SLOT, CROWD_ZONES as Z, CROWD_JOINTS as J, CROWD_CAPE } from './crowd-shader.js';
import { HEAD_IDS, HEAD_ID_LIMIT, PROP_IDS, BODY_IDS } from './costumes.js';
import { featherGeometry, smallWingGeometry } from './avian.js';
import { buildBird, poseWings } from './bird.js';

// ---------------------------------------------------------------------------
// The figures held in the Glass Dunes' glass (src/glass-dunes-frozen.js; issue #166): the game's own people and
// creatures, posed once and frozen, as static geometry in pale glass tones (vertex colours: the material keeps its ink).
//
//   frozenPerson(pose, dress)  the crowd's figure (src/crowd.js figureGeometry, the Glass Dunes' desert costume: its
//                              headwear, robe, cape, staff or basket), posed on the CPU as the crowd's vertex shader poses
//                              it (src/crowd-shader.js crowdAnimate: the same joints, angles and order) but held still
//   frozenFlockBird(flap)      a bird of the flocks overhead (src/life.js Flock: its body, src/avian.js its wings)
//   frozenGreatBird(step)      Vael's great bird (src/bird.js buildBird), the carriers' beast: mid-step, wings folded
//   clockParts(minute, kind)   a clock: its case or rim, its face with twelve ticks (the quarters longer), its hands
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The glass's tones for the people's colour zones (src/crowd-shader.js CROWD_ZONES): their clothes kept apart, all pale. */
export const GHOST_ZONES = {
  [Z.skin]: '#f2f7ec', [Z.cloak]: '#b9e2cc', [Z.cloth]: '#d9f0e1', [Z.legs]: '#a8d5bf', [Z.boots]: '#86b9a3', [Z.hat]: '#cbe9d8',
  [Z.accent]: '#9fd8bd', [Z.hair]: '#93c3ae', [Z.lining]: '#7fae9b', [Z.belt]: '#8dbfa8', [Z.cuff]: '#c5e6d4', [Z.dark]: '#5f8f7e',
  [Z.metal]: '#bfe0d0', [Z.wood]: '#9cc7b2', [Z.lamp]: '#f4ffe8', [Z.eye]: '#3f6a5c', [Z.brass]: '#d6ecd9', [Z.ivory]: '#eef6ea', [Z.clay]: '#9cc7b2',
};

/**
 * The poses (radians; crowdAnimate's names): hip / knee per leg [L, R], shoulder forward and out, elbow and its turn in
 * per arm, the torso's pitch / yaw / roll, the head's pitch (under 0 up) and yaw, the root's lift.
 */
export const FROZEN_POSES = {
  stride: { hip: [0.42, -0.42], knee: [0.06, 0.55], shF: [-0.36, 0.36], shA: [0.07, 0.07], elb: [0.45, 0.45], elbIn: [0.1, 0.1], tP: 0.08, tY: 0.09 },
  carry: { hip: [0.38, -0.4], knee: [0.08, 0.6], shF: [0.55, 0.3], shA: [0.12, 0.1], elb: [1.3, 0.6], elbIn: [0.5, 0.2], tP: 0.32, tY: 0.06, hP: -0.25 },
  reach: { hip: [0.55, -0.1], knee: [0.2, 0.35], shF: [1.25, 1.05], shA: [0.18, 0.24], elb: [0.25, 0.35], elbIn: [0.1, 0.1], tP: 0.5, hP: 0.25, lift: 0.25 },
  lookUp: { hip: [0.05, 0.0], knee: [0.08, 0.06], shF: [0.4, 2.3], shA: [0.15, 0.3], elb: [0.6, 0.2], elbIn: [0.4, 0.1], tP: -0.12, hP: -0.6 },
  armsUp: { hip: [0.0, 0.12], knee: [0.06, 0.2], shF: [2.5, 2.4], shA: [0.35, 0.4], elb: [0.3, 0.25], elbIn: [0.0, 0.0], tP: -0.15, hP: -0.55 },
  shield: { hip: [0.3, -0.25], knee: [0.15, 0.4], shF: [1.6, 1.4], shA: [0.25, 0.1], elb: [1.9, 1.7], elbIn: [0.9, 0.8], tP: 0.38, hP: 0.3, tR: 0.08 },
  point: { hip: [0.0, 0.08], knee: [0.06, 0.12], shF: [0.0, 2.0], shA: [0.08, 0.5], elb: [0.2, 0.1], elbIn: [0.1, 0.0], hP: -0.4, hY: 0.3 },
};

/** What a frozen person wears (the desert costume's own pieces: src/costumes.js ids), and how its cape and robe hang. */
export const FROZEN_DRESS = { head: 'headcloth', prop: 'none', body: 'none', cape: 0, wide: 1, robe: 0.62, flare: 0.3 };   // (no cape unless its scene gives one: issue #347)

const _figure = new Map();
const figure = (world) => { if (!_figure.has(world)) _figure.set(world, figureGeometry('mid', world)); return _figure.get(world); };
const rx = (a) => new THREE.Matrix3().set(1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a));
const ry = (a) => new THREE.Matrix3().set(Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a));
const rz = (a) => new THREE.Matrix3().set(Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1);
const mul = (A, B) => new THREE.Matrix3().multiplyMatrices(A, B);
const turn = (p, n, pivot, R) => { p.sub(pivot).applyMatrix3(R).add(pivot); n.applyMatrix3(R); };

/**
 * One of the crowd's people, posed and held still: a static, non-indexed geometry (position, normal, colour) in figure
 * space (feet at 0, facing +z), only the pieces it wears. `pose` a FROZEN_POSES name or its angles; `dress` over FROZEN_DRESS.
 */
export function frozenPerson(pose = 'stride', dress = {}, { world = 'desert', zones = GHOST_ZONES } = {}) {
  const q = { hip: [0, 0], knee: [0.06, 0.06], shF: [0, 0], shA: [0.07, 0.07], elb: [0.18, 0.18], elbIn: [0.1, 0.1], tP: 0, tY: 0, tR: 0, hP: 0, hY: 0, lift: 0, ...(typeof pose === 'string' ? FROZEN_POSES[pose] : pose) };
  const D = { ...FROZEN_DRESS, ...dress };
  const headId = HEAD_IDS.indexOf(D.head), propId = PROP_IDS.indexOf(D.prop), bodyId = BODY_IDS.indexOf(D.body);
  const src = figure(world), P0 = src.attributes.position, N0 = src.attributes.normal, R0 = src.attributes.aRig;
  const index = src.index ? src.index.array : null, count = index ? index.length : P0.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const HIP = J.hip, KNEE = J.knee, SHY = J.shoulder, ELB = J.elbow, NECK = J.neck, COLLAR = J.collar, shx = J.shoulderX, hipx = J.hipX * 1.17;
  const torso = mul(mul(ry(q.tY), rz(q.tR)), rx(q.tP));
  const robeTurn = (x, t) => { const a = THREE.MathUtils.lerp(q.hip[1], q.hip[0], THREE.MathUtils.smoothstep(x, -0.7, 0.7)); return (a > 0 ? a : a * 0.7) * 0.65 * THREE.MathUtils.smoothstep(t, 0, 0.5); };
  const c = new THREE.Color(), p = V(), n = V();
  let k = 0;
  for (let ii = 0; ii < count; ii++) {
    const i = index ? index[ii] : ii;
    const part = Math.round(R0.getX(i)), zone = Math.round(R0.getY(i)), code = Math.round(R0.getZ(i)), t = R0.getW(i);
    const slot = Math.floor(code / HEAD_ID_LIMIT), pid = code - slot * HEAD_ID_LIMIT;
    const show = slot === SLOT.always || (slot === SLOT.head && pid === headId) || (slot === SLOT.body && pid === bodyId) || (slot === SLOT.prop && pid === propId)
      || (slot === SLOT.cape && D.cape > 0.01) || (slot === SLOT.robe && D.robe > 0.01);
    p.fromBufferAttribute(P0, i); n.fromBufferAttribute(N0, i);
    const side = part % 2 === 0 ? 1 : -1;
    if (part === P.cape) {
      const kk = Math.pow(t, 0.8), below = t * D.cape;
      const wx = Math.max(THREE.MathUtils.lerp(CROWD_CAPE.collar, (0.25 + D.cape * 0.17) * D.wide, kk) + CROWD_CAPE.spread * t, THREE.MathUtils.lerp(CROWD_CAPE.collar, CROWD_CAPE.shoulders, THREE.MathUtils.smoothstep(below, 0, 0.16)));
      const dir = V(p.x, 0, p.z + 1e-5).normalize(), r = [wx, wx * CROWD_CAPE.depth];
      p.set(dir.x * r[0], COLLAR - below, dir.z * r[1] - 0.02); n.set(dir.x / r[0], 0, dir.z / r[1]).normalize();
      p.z -= t * t * 0.12;   // (held mid-swing, streaming a little behind)
    } else if (part === P.robe) {
      const dir = V(p.x, 0, p.z + 1e-5).normalize(), kk = Math.pow(t, 0.85);
      const r = [THREE.MathUtils.lerp(0.165, D.flare, kk), THREE.MathUtils.lerp(0.14, D.flare * 0.86, kk)];
      p.set(dir.x * r[0], HIP + 0.01 - t * D.robe, dir.z * r[1] - 0.01); n.set(dir.x / r[0], 0.25, dir.z / r[1]).normalize();
      turn(p, n, V(0, HIP, 0), rx(-robeTurn(dir.x, t)));
    }
    if (part >= P.thighL && part <= P.shinR) p.x = side * hipx + (p.x - side * J.hipX);
    else if (part >= P.armL && part <= P.foreR) p.x = side * shx + (p.x - side * J.shoulderX);
    if (part === P.shinL || part === P.shinR) {
      const L = part === P.shinL ? 0 : 1;
      turn(p, n, V(side * hipx, KNEE, 0), rx(q.knee[L]));
      turn(p, n, V(side * hipx, HIP, 0), rx(-q.hip[L]));
    } else if (part === P.thighL || part === P.thighR) {
      turn(p, n, V(side * hipx, HIP, 0), rx(-q.hip[part === P.thighL ? 0 : 1]));
    } else if (part >= P.armL && part <= P.foreR) {
      const L = part === P.armL || part === P.foreL ? 0 : 1;
      if (part >= P.foreL) turn(p, n, V(side * shx, ELB, 0), mul(ry(-side * q.elbIn[L]), rx(-q.elb[L])));
      turn(p, n, V(side * shx, SHY, 0), mul(rz(side * q.shA[L]), rx(-q.shF[L])));
    } else if (part === P.head) turn(p, n, V(0, NECK, 0), mul(ry(q.hY), rx(q.hP)));
    if (part < 2 || (part >= P.armL && part !== P.robe)) turn(p, n, V(0, HIP, 0), torso);
    p.y += q.lift;
    if (!show) continue;
    pos.set([p.x, p.y, p.z], k * 3); nor.set([n.x, n.y, n.z], k * 3);
    c.set(zones[zone] ?? zones[Z.cloth]); col.set([c.r, c.g, c.b], k * 3);
    k++;
  }
  const g = new THREE.BufferGeometry();
  // (a piece is shown or not whole: its triangles stay whole)
  g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, k * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor.slice(0, k * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(col.slice(0, k * 3), 3));
  return g;
}

/** Paint a geometry one colour (the frozen material reads vertex colours). */
export function tinted(g, color) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const key of Object.keys(n.attributes)) if (key !== 'position' && key !== 'normal') n.deleteAttribute(key);
  if (!n.attributes.normal) n.computeVertexNormals();
  const c = new THREE.Color(color), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return n;
}

/** A bird of the flocks overhead (src/life.js Flock), its wings at `flap` (rad: up over 0), as one coloured geometry. */
export function frozenFlockBird(flap = 0.5, { body = '#c9e8d6', wing = '#e3f4e8' } = {}) {
  const parts = [
    new THREE.SphereGeometry(1, 10, 7).scale(0.18, 0.2, 0.48),
    new THREE.SphereGeometry(1, 10, 7).scale(0.14, 0.15, 0.18).translate(0, 0.16, 0.42),
    new THREE.ConeGeometry(0.075, 0.26, 6).rotateX(Math.PI / 2).translate(0, 0.13, 0.66),
  ].map((g) => tinted(g, body));
  for (let i = -2; i <= 2; i++) parts.push(tinted(featherGeometry(0.53, 0.16).rotateY(i * 0.17).translate(i * 0.045, 0.03, -0.3), body));
  for (const side of [-1, 1]) parts.push(tinted(smallWingGeometry(side).applyMatrix4(new THREE.Matrix4().makeRotationZ(side * flap)), wing));
  return mergeGeometries(parts);
}

/**
 * Vael's great bird (src/bird.js buildBird), saddled, mid-step (one leg forward), its wings folded, its head turned by
 * `look` (rad), baked static, each of its materials in a glass tone a little apart from the next (lighter where it was).
 */
export function frozenGreatBird({ step = 0.45, look = 0 } = {}) {
  const b = buildBird();
  poseWings(b.wings, 1);
  b.legs[0].rotation.x = -step; b.legs[1].rotation.x = step * 0.7;
  b.body.rotation.y = look * 0.2;
  b.root.updateMatrixWorld(true);
  const mint = new THREE.Color('#bfe6cf'), parts = [];
  b.root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material?.uniforms?.uColor?.value ?? o.material?.color ?? new THREE.Color('#e9e3d4');
    const l = new THREE.Color(src).getHSL({ h: 0, s: 0, l: 0 }).l;
    const tone = mint.clone().lerp(new THREE.Color('#f1f8ee'), Math.min(1, Math.max(0, (l - 0.25) / 0.65)));
    parts.push(tinted(o.geometry.clone().applyMatrix4(o.matrixWorld), tone));
  });
  // (her feet on the ground: the root stands STAND over it in bird.js; here the lowest point at 0)
  const g = mergeGeometries(parts);
  g.computeBoundingBox();
  return g.translate(0, -g.boundingBox.min.y, 0);
}

/**
 * A clock stopped at `minute` to the hour, facing +z: `body` (a long case, or a round rim with a hanging ring), `face`
 * (its dial), `ticks` (twelve, the quarters longer, and a hub) and `hands` (minute and hour, tapered).
 */
export function clockParts({ minute = 7, kind = 'case' } = {}) {
  const tall = kind === 'case', at = tall ? V(0, 1.72, 0.19) : V(0, 0, 0.04), r = tall ? 0.26 : 0.46;
  const body = tall
    ? mergeGeometries([new THREE.BoxGeometry(0.58, 1.95, 0.34).translate(0, 0.98, 0), new THREE.BoxGeometry(0.7, 0.12, 0.4).translate(0, 0.06, 0), new THREE.BoxGeometry(0.7, 0.62, 0.4).translate(0, 1.72, 0),
      new THREE.CylinderGeometry(0.2, 0.36, 0.22, 4, 1).rotateY(Math.PI / 4).translate(0, 2.14, 0), new THREE.TorusGeometry(r + 0.04, 0.035, 5, 24).translate(at.x, at.y, at.z + 0.02),
      new THREE.CylinderGeometry(0.035, 0.035, 0.8, 5).translate(0, 1.0, 0.18), new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12).rotateX(Math.PI / 2).translate(0, 0.62, 0.18)].map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }))
    : mergeGeometries([new THREE.TorusGeometry(r + 0.03, 0.07, 6, 28), new THREE.TorusGeometry(0.07, 0.022, 4, 10).translate(0, r + 0.15, 0)].map((g) => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); return n; }));
  const face = new THREE.CylinderGeometry(r, r, 0.03, 28).rotateX(Math.PI / 2).translate(at.x, at.y, at.z);
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, long = i % 3 === 0, len = r * (long ? 0.22 : 0.12), w = r * (long ? 0.07 : 0.035);
    ticks.push(new THREE.BoxGeometry(w, len, 0.02).translate(0, r * 0.9 - len / 2, 0).rotateZ(-a).translate(at.x, at.y, at.z + 0.02));
  }
  ticks.push(new THREE.CylinderGeometry(r * 0.07, r * 0.07, 0.03, 10).rotateX(Math.PI / 2).translate(at.x, at.y, at.z + 0.045));
  // (the minute hand at 60 − minute, the hour hand just short of the next hour: tapered bars)
  const am = -((60 - minute) / 60) * TAU, ah = -((11 + (60 - minute) / 60) / 12) * TAU;
  const hand = (len, w, a) => new THREE.CylinderGeometry(w * 0.25, w, len, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.25).translate(0, len / 2 - len * 0.12, 0).rotateZ(a).translate(at.x, at.y, at.z + 0.035);
  const clean = (list) => mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));
  return { body, face: clean([face]), ticks: clean(ticks), hands: clean([hand(r * 0.86, r * 0.07, am), hand(r * 0.56, r * 0.1, ah)]) };
}
