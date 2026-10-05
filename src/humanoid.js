import { limbSegments } from './creases.js';
import { TRAVELLER_PALETTE } from './traveller-style.js';
import * as THREE from 'three';
import { plantFeet, resetFeet } from './feet.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeMaterial, MODE_OUTFIT, MODE_EYE } from './materials.js';
import { EAR_Z, noseSide, faceYouth } from './face-ink.js';
import { EyeLook, EYE_WHITE, EYE_TILT, TRAVELLER_IRIS, eyeballOf } from './eyes.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lookPieces, roleColor, BUILDS, browColour } from './costumes.js';
import { suitGeometry, travellerKit, TRAVELLER } from './traveller.js';
import { BUILD_SHAPE, radialFactors, boneMorph, warpFace, faceLandmarks, browPositions, plainGeometry, morphKey, cleanMorph, isNeutral, FACE_MORPHS, NEUTRAL_FACE } from './morph.js';
import { cleanExpression, NEUTRAL_EXPRESSION, PEOPLE_REST } from './expression.js';
import { sharedUniforms } from './materials.js';

// A real human body (Quaternius' Universal Base Characters, CC0) dressed in
// the rider's clothes by our inked material, driven every frame by the
// procedural rig. The rig keeps doing all the animation (mocap clips and the
// authored climb / ride / glide / jetpack poses) and stays invisible; each
// skinned bone is aimed along the matching rig limb, keeping its own rest
// twist. The hood, collar, cloth cape and jetpack stay ours and are moved
// onto the body's head and shoulders.

const MODELS = { m: 'anim/human_m.glb', f: 'anim/human_f.glb' };
const cache = {};
export function loadHuman(kind = 'm') {
  cache[kind] ??= new GLTFLoader().loadAsync(MODELS[kind]).then((g) => prepareHuman(g.scene, kind));
  return cache[kind];
}
/** A loaded human model made into a template, as loadHuman() does (tests and tools load their own). */
export function prepareHuman(scene, kind = 'm') {
  reshape(scene, kind);
  return scene;
}

// Rest-pose facial landmarks (metres): eyeY, eyeX, noseY, noseZ, chinY
export const FACE = { m: [1.699, 0.032, 1.657, 0.115, 1.577], f: [1.656, 0.032, 1.617, 0.112, 1.538] };

// ---------------------------------------------------------------------------
// Turn the stock "superhero" into a gaunt Moebius figure, in the rest pose:
//  - slim: every vertex is pulled toward the bones it's skinned to (weighted,
//    so joints stay smooth); the shoulders come in by moving the arm bones;
//  - face: narrower and longer, a long straight nose, lean (not hollow) cheeks,
//    a firm brow, the upper lids a little lifted (open, friendly eyes). The ink
//    lines of the face are drawn by the material (outfit mode).

/** How much longer the reshape makes the face below the eyes (was 1.22: long, somber faces). */
export const LOWER_FACE = 1.17;
/** How far (m) the reshape lifts the upper lids' rims off the irises (eyes a touch more open). */
export const UPPER_LID = 0.0018;
/**
 * The brows mesh's upper lashes: its vertices near an eyeball (within `rim` of its radii) and under
 * `y` m over its centre (both bodies' brows start higher: the man's at 8.3 mm, the woman's at 15).
 */
export const LASH = { rim: 1.75, y: 0.0078 };
/** How far a point is from an eyeball's centre, in its radii (eyes.js eyeballOf; the near eye of the pair). */
function rimOf(ball, x, y, z) {
  const [cx, cy, cz] = ball.center, [rx, ry, , rz] = ball.radii;
  return Math.hypot((x - Math.sign(x) * cx) / rx, (y - cy) / ry, (z - cz) / rz);
}

// radial factor per bone, and the bone that ends its segment
const SLIM = [
  [/^thigh_/, 0.74], [/^calf_/, 0.78], [/^upperarm_/, 0.66], [/^lowerarm_/, 0.74], [/^clavicle_/, 0.78],
  [/^spine_0[123]$/, [0.78, 0.84]], [/^pelvis$/, [0.86, 0.88]], [/^neck_01$/, 0.82],
];
const NEXT = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head',
  thigh_l: 'calf_l', calf_l: 'foot_l', thigh_r: 'calf_r', calf_r: 'foot_r',
  clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l',
  clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r' };
const SHOULDER_IN = { m: 0.045, f: 0.02 };

/**
 * Eyebrows drawn as one pen stroke each (the Moebius way): pulled toward their own arched centre
 * line, a little under half as tall as modelled at the inner end and tapering to a sixth at the outer
 * end (a fine stroke: a heavy dark bar over the eyes read as a scowl).
 * `brow(i)`: whether vertex i is the brow's (the model's brow mesh has the upper lashes in it too:
 * they are left out of the fit and the taper, reshape() folds them away).
 * (In place, on the shared template's geometry; returns the thickness factor's range for tests.)
 */
export function taperBrows(g, brow = () => true) {
  const P = g.attributes.position;
  // the brow's centre line: y = c0 + c1 |x| + c2 |x|^2, least squares over all its vertices
  const S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  let x0 = Infinity, x1 = 0;
  for (let i = 0; i < P.count; i++) {
    if (!brow(i)) continue;
    const x = Math.abs(P.getX(i)), y = P.getY(i);
    let xp = 1;
    for (let k = 0; k < 5; k++) { S[k] += xp; if (k < 3) T[k] += xp * y; xp *= x; }
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
  }
  const c = solve3([[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]], T);
  const span = Math.max(x1 - x0, 1e-6);
  let kMin = Infinity, kMax = 0;
  for (let i = 0; i < P.count; i++) {
    if (!brow(i)) continue;
    const x = Math.abs(P.getX(i)), cy = c[0] + c[1] * x + c[2] * x * x, u = (x - x0) / span;
    const k = 0.44 - 0.31 * Math.pow(u, 1.2);
    kMin = Math.min(kMin, k); kMax = Math.max(kMax, k);
    P.setY(i, cy + (P.getY(i) - cy) * k);
  }
  P.needsUpdate = true;
  return [kMin, kMax];
}
/** Solve a 3x3 linear system (Cramer). */
function solve3(A, b) {
  const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A) || 1e-12;
  return [0, 1, 2].map((j) => det(A.map((row, r) => row.map((v, k) => (k === j ? b[r] : v)))) / D);
}

/** Landmarks after reshape(): the lower face is longer (LOWER_FACE), x narrowed 10%. */
export function faceAfterReshape(kind) {
  const [eyeY, eyeX, noseY, noseZ, chinY] = FACE[kind];
  const longer = (y) => eyeY + (y - eyeY) * LOWER_FACE;
  return [eyeY, eyeX * 0.9, longer(noseY), noseZ, longer(chinY)];
}

function reshape(scene, kind) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const eyeMesh = meshes.find((m) => /eye/i.test(m.name) && !/brow/i.test(m.name));
  const skel = meshes[0].skeleton;
  const bones = skel.bones, idx = new Map(bones.map((b, i) => [b.name, i]));
  const bindPos = bones.map((b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld));
  const seg = bones.map((b) => {
    const rule = SLIM.find(([re]) => re.test(b.name));
    const next = NEXT[b.name] !== undefined ? idx.get(NEXT[b.name]) : undefined;
    if (!rule || next === undefined) return null;
    const f = Array.isArray(rule[1]) ? rule[1] : [rule[1], rule[1]];
    return { a: bindPos[bones.indexOf(b)], b: bindPos[next], fx: f[0], fz: f[1], vertical: /spine|pelvis|neck/.test(b.name) };
  });
  const armSide = bones.map((b) => {
    if (/(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)(_twist)?_?\d*_l$/.test(b.name)) return 1;
    if (/(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)(_twist)?_?\d*_r$/.test(b.name)) return -1;
    if (b.name === 'clavicle_l') return 0.5;
    if (b.name === 'clavicle_r') return -0.5;
    return 0;
  });
  const [eyeY, , noseY, noseZ, chinY] = FACE[kind];
  const headI = idx.get('Head');
  const shoulderIn = SHOULDER_IN[kind];
  const v = new THREE.Vector3(), out = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3();
  // the eyeballs as modelled (for the lids: below)
  const ball = eyeMesh ? eyeballOf(eyeMesh.geometry, eyeY) : null;

  for (const mesh of meshes) {
    const g = mesh.geometry;
    const isBrow = /hair/i.test(mesh.material?.name ?? '');
    const isEye = mesh === eyeMesh;
    // the brows mesh: the brows, and the upper lashes hugging the eyeballs (LASH). The lashes go
    // (folded into the eyeball's centre, out of sight): they were a second heavy arc over each eye,
    // and the eye's own lash line is the eyeball's (materials.js eyeball)
    if (isBrow) {
      const Pb = g.attributes.position, lash = (i) => ball && Pb.getY(i) - ball.center[1] < LASH.y && rimOf(ball, Pb.getX(i), Pb.getY(i), Pb.getZ(i)) < LASH.rim;
      taperBrows(g, (i) => !lash(i));
      for (let i = 0; i < Pb.count; i++) if (lash(i)) Pb.setXYZ(i, Math.sign(Pb.getX(i)) * ball.center[0], ball.center[1], ball.center[2]);
    }
    const P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      out.set(0, 0, 0);
      let wsum = 0, headW = 0, arm = 0;
      for (let k = 0; k < 4; k++) {
        const j = J.getComponent(i, k), w = W.getComponent(i, k);
        if (w <= 0) continue;
        wsum += w;
        if (j === headI) headW += w;
        arm += armSide[j] * w;
        const sg = seg[j];
        if (!sg) { out.addScaledVector(v, w); continue; }
        // closest point on the bone segment, then scale the offset from it
        ab.subVectors(sg.b, sg.a);
        const t = THREE.MathUtils.clamp(c.subVectors(v, sg.a).dot(ab) / ab.lengthSq(), 0, 1);
        c.copy(sg.a).addScaledVector(ab, t);
        if (sg.vertical) { c.x = sg.a.x; }   // torso: squeeze toward the spine's vertical axis
        const dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z;
        const fy = sg.vertical ? 1 : sg.fx;
        out.x += (c.x + dx * sg.fx) * w;
        out.y += (c.y + dy * fy) * w;
        out.z += (c.z + dz * sg.fz) * w;
      }
      if (wsum > 0) v.copy(out.divideScalar(wsum));
      // shoulders in: the arms (and half the clavicles) slide toward the body
      v.x -= Math.sign(arm) * Math.min(Math.abs(arm), 1) * shoulderIn;
      // the face
      if (headW > 0.3) {
        const k = THREE.MathUtils.smoothstep(headW, 0.3, 0.8);
        // the upper lids a little lifted (UPPER_LID): the lid's rim off the top of the iris, so the
        // eyes are open and easy, not hooded; the corners and the crease above move less
        if (ball && !isEye && !isBrow) {
          const ex = v.x - Math.sign(v.x) * ball.center[0], ey = v.y - ball.center[1], ez = v.z - ball.center[2];
          const rim = rimOf(ball, v.x, v.y, v.z);
          if (ey > 0 && ez > 0) v.y += UPPER_LID * k * THREE.MathUtils.smoothstep(ey, 0, 0.002) * (1 - THREE.MathUtils.smoothstep(rim, 1.1, 1.7)) * (1 - THREE.MathUtils.smoothstep(Math.abs(ex), 0.009, 0.015));
        }
        let x = v.x * (1 - 0.1 * k), y = v.y, z = v.z;
        if (y < eyeY) y = eyeY + (y - eyeY) * (1 + (LOWER_FACE - 1) * k);           // longer lower face
        const front = THREE.MathUtils.smoothstep(z, noseZ - 0.045, noseZ - 0.01);
        // long straight nose: a ridge from between the eyes to below the old tip
        const along = THREE.MathUtils.clamp((eyeY - 0.004 - y) / (eyeY - noseY + 0.012), 0, 1);
        const ridge = Math.exp(-((v.x / 0.013) ** 2)) * front * Math.sin(Math.PI * Math.min(along * 1.05, 1)) ** 0.6;
        z += ridge * 0.009 * k;
        y -= ridge * along * 0.004 * k;
        // lean cheeks under the cheekbones (a little in: hollow cheeks are an elder's, FACE_PRESETS)
        const cheek = Math.exp(-(((Math.abs(v.x) - 0.052) / 0.016) ** 2) - (((y - (noseY - 0.018)) / 0.02) ** 2));
        z -= cheek * 0.0035 * k;
        x -= Math.sign(v.x) * cheek * 0.002 * k;
        // a firm brow
        const brow = Math.exp(-(((y - (eyeY + 0.017)) / 0.008) ** 2)) * THREE.MathUtils.smoothstep(z, 0.03, 0.07);
        z += brow * 0.0012 * k;
        // a stronger, narrower chin
        const chin = Math.exp(-((v.x / 0.02) ** 2) - (((y - chinY) / 0.02) ** 2));
        z += chin * 0.006 * k;
        v.set(x, y, z);
      }
      P.setXYZ(i, v.x, v.y, v.z);
    }
    P.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }

  // the eyeballs as the reshape left them (narrower, longer below the eye line), for MODE_EYE
  if (eyeMesh) eyeMesh.userData.eyeball = eyeballOf(eyeMesh.geometry, eyeY);

  // move the arm bones in to match, then rebind
  for (const s of ['l', 'r']) {
    const ua = bones[idx.get(`upperarm_${s}`)];
    const parentQ = ua.parent.getWorldQuaternion(new THREE.Quaternion());
    const parentS = ua.parent.getWorldScale(new THREE.Vector3());
    const d = new THREE.Vector3(s === 'l' ? -shoulderIn : shoulderIn, 0, 0).applyQuaternion(parentQ.invert()).divide(parentS);
    ua.position.add(d);
  }
  scene.updateMatrixWorld(true);
  for (const m of meshes) { m.bind(m.skeleton, m.matrixWorld); m.skeleton.calculateInverses(); }
}

// ---------------------------------------------------------------------------
// Builds (costumes.js BUILDS) and body morphs (morph.js): the same skeleton, the body
// mesh made slimmer, broader or heavier around its bones, the way reshape() slims it
// (weighted, so joints stay smooth). The radial factors per bone are morph.js
// BUILD_SHAPE (the builds) times the body morph's (radialFactors).
export { BUILD_SHAPE };
const builds = new WeakMap();
/** The body geometry for a build and a body morph (morph.js; cached per source geometry). */
export function buildGeometry(body, build, morph = null) {
  const base = body.userData.baseGeometry ?? body.geometry;
  const bones = body.skeleton.bones, idx = new Map(bones.map((b, i) => [b.name, i]));
  const factors = bones.map((b) => radialFactors(b.name, build, morph));
  if (factors.every((f) => !f)) return base;
  const key = `${build}|${morphKey(morph)}`;
  const cache = builds.get(base) ?? new Map();
  builds.set(base, cache);
  if (cache.has(key)) return cache.get(key);
  const toGeo = body.bindMatrix.clone().invert();
  const bindPos = body.skeleton.boneInverses.map((m) => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()).applyMatrix4(toGeo));
  const seg = bones.map((b, i) => {
    const f = factors[i];
    const next = NEXT[b.name] !== undefined ? idx.get(NEXT[b.name]) : undefined;
    if (!f || next === undefined) return null;
    return { a: bindPos[i], b: bindPos[next], fx: f[0], ff: f[1], fb: f[2], vertical: /spine|pelvis|neck|clavicle/.test(b.name) };   // (collarbones widen the shoulders outward)
  });
  const g = base.clone();
  const P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  const v = new THREE.Vector3(), out = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    out.set(0, 0, 0);
    let wsum = 0;
    for (let k = 0; k < 4; k++) {
      const j = J.getComponent(i, k), w = W.getComponent(i, k);
      if (w <= 0) continue;
      wsum += w;
      const sg = seg[j];
      if (!sg) { out.addScaledVector(v, w); continue; }
      ab.subVectors(sg.b, sg.a);
      const t = THREE.MathUtils.clamp(c.subVectors(v, sg.a).dot(ab) / ab.lengthSq(), 0, 1);
      c.copy(sg.a).addScaledVector(ab, t);
      if (sg.vertical) c.x = sg.a.x;
      const dz = v.z - c.z;
      out.x += (c.x + (v.x - c.x) * sg.fx) * w;
      out.y += (sg.vertical ? v.y : c.y + (v.y - c.y) * sg.fx) * w;
      out.z += (c.z + dz * (dz > 0 ? sg.ff : sg.fb)) * w;
    }
    if (wsum > 0) P.setXYZ(i, out.x / wsum, out.y / wsum, out.z / wsum);
  }
  P.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  cache.set(key, g);
  return g;
}

// rest-pose regions per model (metres): bootTop, beltY, neckY, wristX
const OUTFIT = { m: [0.13, 0.97, 1.47, 0.64], f: [0.12, 0.95, 1.44, 0.58] };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _i1 = new THREE.Vector3(), _i2 = new THREE.Vector3(), _i3 = new THREE.Vector3(), _i4 = new THREE.Vector3(), _i5 = new THREE.Vector3();
const _i6 = new THREE.Vector3(), _i7 = new THREE.Vector3(), _i8 = new THREE.Vector3(), _i9 = new THREE.Vector3();
const _iq = new THREE.Quaternion(), _iq2 = new THREE.Quaternion(), _iq3 = new THREE.Quaternion(), _im = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _w1 = new THREE.Vector3(), _w2 = new THREE.Vector3(), _w3 = new THREE.Vector3();
const _wq1 = new THREE.Quaternion(), _wq2 = new THREE.Quaternion(), _wq3 = new THREE.Quaternion(), _wq4 = new THREE.Quaternion(), _wq5 = new THREE.Quaternion();
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _k3 = new THREE.Vector3(), _k4 = new THREE.Vector3(), _k5 = new THREE.Vector3(), _k6 = new THREE.Vector3();
const _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion(), _kq3 = new THREE.Quaternion(), _km = new THREE.Matrix4();

// held props: the idle clip's wrist tilts the hanging-arm frame back and out; this turns it upright again
const HAND_GRIP = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.45, 0.79, 0.41).normalize());

export class Humanoid {
  /**
   * @param template loadHuman() result
   * @param char     the rig from buildCharacter()
   * @param kind     'm' | 'f'
   */
  constructor(template, char, kind = 'm', { skin = '#e8c6a8', hair = '#8a6a55', gloves = null, suit = false, outfit = null, build = null } = {}) {
    this.char = char;
    this.kind = kind;
    // the traveller: the same body, skeleton and face as everyone, its suit painted on and its gear worn on top (traveller.js)
    this.outfit = !!outfit;
    if (outfit) ({ skin, hair } = { skin: TRAVELLER_PALETTE.skin, hair: TRAVELLER_PALETTE.brow });
    this.noShadow = [];
    const model = cloneSkinned(template);
    this.model = model;
    this.build = 'average';
    this.morph = null;        // body morph (morph.js BODY_MORPHS; setMorph)
    this.face = null;         // face morph (morph.js FACE_MORPHS; setFace)
    this.lift = 0;            // m the pelvis rises over the rig's hips (longer legs)
    // another body than the Quaternius ones (the MakeHuman prototype, src/makehuman/body.js) brings its own measurements
    const prof = (this.profile = template.userData.profile ?? null);
    this.faceRest = prof?.face ?? faceAfterReshape(kind);
    this.outfitRest = prof?.outfit ?? OUTFIT[kind];
    this.earZ = prof?.earZ ?? EAR_Z[kind];
    const C = char.colors;
    const body = makeMaterial({ color: C.cloth, color2: C.legs, color3: C.boot ?? '#6e3f2c', mode: MODE_OUTFIT, skin, outfit: this.outfitRest, face: this.faceRest, gloves, suit });
    body.uniforms.uFaceKit2.value.w = this.earZ;   // (the face ink's ears: face-ink.js)
    // the eyes (eyes.js): white, an iris (each person's own colour: NPC.restyle) that follows the gaze, blinking lids
    let eyeball = null;
    model.traverse((o) => { if (o.isMesh && /eye/i.test(o.name) && !/brow/i.test(o.name) && !eyeball) eyeball = o.userData.eyeball ?? null; });
    const eyes = makeMaterial({ color: EYE_WHITE, color2: outfit ? TRAVELLER_IRIS : '#5e3a24', mode: MODE_EYE, skin, eye: eyeball ? { ...eyeball, iris: 0.4 } : undefined, figure: true });
    this.eyeLook = new EyeLook();
    // (one flat stroke each: no hatching inside; the hair's colour softened toward the skin, costumes.js browColour)
    const brows = makeMaterial({ color: outfit ? hair : browColour(hair, skin), figure: true, facePart: true });
    model.traverse((o) => {
      if (!o.isMesh) return;
      const isBrow = /brow/i.test(o.name) || /hair/i.test(o.material?.name ?? '');
      o.material = isBrow ? brows : /eye/i.test(o.name) ? eyes : body;
      if (o.material === eyes) this.eyeMesh = o;
      if (isBrow) this.browMesh = o;
      // the body itself: costumes (dress()) are skinned onto its skeleton
      if (o.isSkinnedMesh && o.material === body && (!this.body || o.geometry.attributes.position.count > this.body.geometry.attributes.position.count)) this.body = o;
      o.frustumCulled = false;
      o.userData.noCollide = true;
    });
    if (outfit) this.wearOutfit(outfit);
    else if (build) this.setBuild(build);
    char.root.add(model);
    char.root.updateMatrixWorld(true);
    const rootInv = char.root.matrixWorld.clone().invert();

    // bones and their rest pose, in model (character) space
    this.b = {};
    model.traverse((o) => { if (o.isBone) this.b[o.name] = o; });
    this.rest = new Map();
    for (const bone of Object.values(this.b)) {
      const q = new THREE.Quaternion(), p = new THREE.Vector3();
      _m4.multiplyMatrices(rootInv, bone.matrixWorld).decompose(p, q, _c);   // character space
      this.rest.set(bone, { q, p });
    }
    this.restDir = (a, c) => this.rest.get(this.b[c]).p.clone().sub(this.rest.get(this.b[a]).p).normalize();

    const B = this.b;
    // [bone, child-for-rest-direction, rig points that give the desired direction]
    const chains = [];
    ['r', 'l'].forEach((s, i) => {      // rig index 0 is the character's right
      chains.push({ bone: `thigh_${s}`, child: `calf_${s}`, from: () => char.legs[i], to: () => char.knees[i] });
      chains.push({ bone: `calf_${s}`, child: `foot_${s}`, from: () => char.knees[i], to: () => char.feet[i] });
      chains.push({ bone: `upperarm_${s}`, child: `lowerarm_${s}`, from: () => char.arms[i], to: () => char.elbows[i] });
      chains.push({ bone: `lowerarm_${s}`, child: `hand_${s}`, from: () => char.elbows[i], hand: i });
    });
    this.chains = chains.filter((c) => B[c.bone] && B[c.child]).map((c) => ({ ...c, B: B[c.bone], dir: this.restDir(c.bone, c.child) }));
    // whole-segment orientation follows a rig joint's rotation
    this.follow = [
      ['pelvis', () => char.body], ['spine_01', () => char.torso], ['spine_02', () => char.torso], ['spine_03', () => char.torso],
      ['neck_01', () => char.head], ['Head', () => char.head],
      ['foot_r', () => char.feet[0]], ['foot_l', () => char.feet[1]],
    ].filter(([n]) => B[n]).map(([n, j]) => ({ B: B[n], j }));
    // each hand's anatomy at rest (character space): along the fingers, and the way the palm faces
    this.handFrames = Object.fromEntries(['r', 'l'].filter((s) => B[`middle_01_${s}`]).map((s) => {
      const origin = this.rest.get(B[`hand_${s}`]).p;
      const along = this.rest.get(B[`middle_01_${s}`]).p.clone().sub(origin).normalize();
      const span = this.rest.get(B[`index_01_${s}`]).p.clone().sub(this.rest.get(B[`pinky_01_${s}`]).p);
      const normal = new THREE.Vector3().crossVectors(along, span).normalize();
      if (normal.y > 0) normal.negate();   // palms face down in the T-pose
      return [s, { along, normal }];
    }));
    this.restHipMid = this.rest.get(B.thigh_l).p.clone().add(this.rest.get(B.thigh_r).p).multiplyScalar(0.5);
    this.restPelvis = this.rest.get(B.pelvis).p.clone();

    this.order = [];
    model.traverse((o) => { if (o.isBone) this.order.push(o); });   // parents before children
    this.charQ = new Map();
    this.chainOf = new Map(this.chains.map((c) => [c.B, c]));
    this.followOf = new Map(this.follow.map((f) => [f.B, f]));

    this.dressRig();
    // a face with shape keys wears its expressions on them (the MakeHuman prototype: src/makehuman/face-keys.js)
    this.faceKeys = prof?.faceKeys ? prof.faceKeys(this) : null;
    // the traveller's own face and its rest (traveller.js TRAVELLER.face / rest); everyone else's face is
    // as modelled (or their look's: NPC.restyle) and rests kindly (expression.js PEOPLE_REST: a slight smile)
    this.ownFace = outfit ? TRAVELLER.face : null;
    this.restExpression = cleanExpression(outfit ? TRAVELLER.rest : PEOPLE_REST);
    if (this.ownFace) this.setFace(this.ownFace);
    this.setExpression(this.restExpression);
  }

  /** Hide the rig's own body; move hood, collar, jetpack and satchel onto the human. */
  dressRig() {
    const c = this.char, B = this.b;
    const keep = new Set();
    // anchors at the head and shoulders, oriented like the character
    const anchor = (bone, charPos, q = null, scale = null) => {
      const g = new THREE.Group();
      g.position.copy(charPos);
      if (q) g.quaternion.copy(q);
      if (scale) g.scale.copy(scale);
      c.root.add(g);
      c.root.updateMatrixWorld(true);
      bone.attach(g);     // keeps its character-space placement at the rest pose
      return g;
    };
    this.update(true);  // make sure the skeleton is at rest before anchoring
    const restHead = this.rest.get(B.Head).p;
    const hf = this.profile?.headFrame ?? [0, 0.1, 0.01];   // (the skull's centre over the head bone)
    this.headAnchor = anchor(B.Head, new THREE.Vector3(hf[0], restHead.y + hf[1], restHead.z + hf[2]));
    const kit = this.kit;
    if (kit) {
      // the traveller: the chest frame behind the pack's front (the tank and the scout's dock sit there),
      // and on each forearm the bracer's frame (+y toward the hand, -x the thumb's side, out round the sleeve)
      this.chestAnchor = anchor(B.spine_03, new THREE.Vector3(0, kit.chestY, kit.chestZ));
      this.forearm = Object.fromEntries(['l', 'r'].map((s) => {
        const f = kit.forearm[s], o = anchor(B[`lowerarm_${s}`], f.position, f.quaternion, f.scale);
        o.name = `forearm frame ${s}`;
        return [s, o];
      }));
    } else this.chestAnchor = anchor(B.spine_03, new THREE.Vector3(0, this.rest.get(B.neck_01).p.y - 0.74 - 0.02, 0));
    const move = (obj, parent, pos) => { parent.add(obj); if (pos) obj.position.copy(pos); obj.traverse((o) => keep.add(o)); };
    this.hood = [];
    if (this.outfit) {
      move(c.jetpack, this.chestAnchor, new THREE.Vector3(0, 0.52, -0.33));
      c.root.traverse((o) => {
        if (o.isMesh && !keep.has(o) && !this.model.getObjectById(o.id)) o.visible = false;
      });
      c.capeAnchor = this.chestAnchor;
      return;
    }
    // the hood (and its peak) were children of the rig head
    for (const child of [...c.head.children]) {
      if (child.isMesh && child.geometry.type === 'SphereGeometry' && child.material.side === THREE.DoubleSide) {
        move(child, this.headAnchor, new THREE.Vector3(0, 0, -0.02));
        child.scale.multiplyScalar(0.92);
        this.hood.push(child);
      } else if (child.isGroup) { move(child, this.headAnchor, new THREE.Vector3(0, 0.12, -0.04)); this.hood.push(child); }
    }
    // collar + jetpack + satchel lived on the rig torso
    for (const child of [...c.torso.children]) {
      if (child.isMesh && child.geometry.type === 'TorusGeometry' && Math.abs(child.position.y - 0.74) < 0.01) move(child, this.chestAnchor);
      else if (child === c.jetpack) move(child, this.chestAnchor, new THREE.Vector3(0, 0.52, -0.33));
      else if (child === c.pack) move(child, this.chestAnchor, new THREE.Vector3(0, 0.3, 0));
    }
    c.jetpack.scale.setScalar(0.92);
    // everything else of the rig is now an invisible armature
    c.root.traverse((o) => {
      if (o.isMesh && !keep.has(o) && !this.model.getObjectById(o.id)) o.visible = false;
    });
    // the cape pins under the human's collar
    c.capeAnchor = this.chestAnchor;
  }

  /** Slim, average, broad or heavy (costumes.js BUILDS): the body mesh swaps to that shape; the skeleton stays. */
  setBuild(build = 'average') {
    if (!this.body || this.outfit) return;
    build = BUILDS[build] ? build : 'average';
    if (build === this.build) return;
    this.build = build;
    this.reshapeBody();
  }

  /** The body mesh for this build, body morph and face morph. */
  reshapeBody() {
    const body = this.body;
    if (!body) return;
    this.lod?.reset();   // (far away the body may be drawing a simpler copy: skinned-lod.js)
    body.userData.baseGeometry ??= body.geometry;
    let g = this.outfit ? this._suitGeometry ?? body.geometry : buildGeometry(body, this.build, this.morph);
    if (this.face) g = this.warped(body, g);
    body.geometry = g;
    this._robeExt = null;   // the robe measures the body again
    this._caps = null; this._spec = null;
  }

  /** A mesh's geometry under this face morph (cached per source geometry and morph). */
  warped(mesh, src, { eyeball = false } = {}) {
    const key = morphKey(this.face, FACE_MORPHS, (d) => !d.ink);
    if (!key) return src;
    const cache = (Humanoid._faces ??= new WeakMap());
    const per = cache.get(src) ?? new Map();
    cache.set(src, per);
    if (!per.has(key)) {
      const head = mesh.skeleton.bones.indexOf(this.b.Head);
      const eye = this.eyeMesh?.userData.eyeball?.center ?? [0.032, this.faceRest[0], 0.06];
      per.set(key, warpFace(src, head, eye, this.faceRest, this.face, { eyeball }));
    }
    return per.get(key);
  }

  /**
   * Own copies of the body, eye and brow materials (an expression, a face or a recolour then
   * touches only this person). NPC.restyle makes them too; either way, only once.
   */
  ownMaterials() {
    this.model.traverse((o) => {
      if (!o.isSkinnedMesh || !o.material?.uniforms || o.material.userData.own || this._costume?.includes(o) || this.outfitMeshes?.includes(o)) return;
      const m = o.material.clone();
      Object.assign(m.uniforms, sharedUniforms);
      m.userData.own = true;
      o.material = m;
    });
  }

  /**
   * Body morphology (morph.js BODY_MORPHS: null = none): the girth of the trunk and limbs on the
   * mesh, the proportions (limb length, head, hands and feet, neck, shoulders) on the bones.
   * The height is the caller's (the root's scale: boneMorph().height).
   */
  setMorph(morph = null) {
    this.morph = morph && !isNeutral(morph) ? cleanMorph(morph) : null;
    const B = this.b, R = this.rest;
    const legSpan = R.get(B.thigh_l).p.y - R.get(B.foot_l).p.y, ankle = R.get(B.foot_l).p.y;
    const bm = boneMorph(this.morph, { legSpan, ankle });
    this._boneRest ??= new Map();
    for (const [n, k] of Object.entries(bm.scale)) B[n]?.scale.setScalar(k);
    for (const [n, k] of Object.entries(bm.position)) {
      if (!B[n]) continue;
      if (!this._boneRest.has(n)) this._boneRest.set(n, B[n].position.clone());
      B[n].position.copy(this._boneRest.get(n)).multiplyScalar(k);
    }
    this.lift = bm.lift;
    this.legLen = undefined;   // (plantFeet measures the leg again)
    if (this.morph) this.legLen = (R.get(B.thigh_l).p.distanceTo(R.get(B.calf_l).p) + R.get(B.calf_l).p.distanceTo(R.get(B.foot_l).p)) * this.morph.legLength;
    if (!this.outfit) this.reshapeBody();
    return bm;
  }

  /**
   * The face (morph.js FACE_MORPHS: null = as modelled): the head, eyes and brows warped, the
   * face ink's landmarks moved with them, and its drawing (age lines, mouth width, freckles, lid weight).
   */
  setFace(face = null) {
    this.face = face && !isNeutral(face, FACE_MORPHS) ? cleanMorph(face, FACE_MORPHS) : null;
    this.ownMaterials();
    this.reshapeBody();
    const f = { ...NEUTRAL_FACE, ...(this.face ?? {}) };
    const L = faceLandmarks(this.faceRest, f);
    const eyes = this.eyeMesh;
    if (eyes) {
      eyes.userData.baseGeometry ??= eyes.geometry;
      eyes.geometry = this.face ? this.warped(eyes, eyes.userData.baseGeometry, { eyeball: true }) : eyes.userData.baseGeometry;
      const ball = this.face ? eyeballOf(eyes.geometry, L[0]) : eyes.userData.eyeball;
      const u = eyes.material.uniforms;
      if (ball && u?.uEyeC) { u.uEyeC.value.set(...ball.center, u.uEyeC.value.w); u.uEyeR.value.set(...ball.radii); }
    }
    const brows = this.browMesh;
    if (brows) {
      brows.userData.baseGeometry ??= brows.geometry;
      const g = this.face ? this.warped(brows, brows.userData.baseGeometry) : brows.userData.baseGeometry;
      // (brows with shape keys of their own keep them: the expression moves them, not poseBrows; any other
      // body gets its own copy, re-made for each face: a crowd body takes a new person's face often, so the last copy goes)
      const old = brows.geometry;
      brows.geometry = this.faceKeys?.brows ? g : plainGeometry(g);
      if (!this.faceKeys?.brows) {
        brows.geometry.userData.ownBrows = true;
        this._browBase = Float32Array.from(brows.geometry.attributes.position.array);
      }
      if (old !== brows.geometry && old?.userData.ownBrows) old.dispose();
    }
    const u = this.body?.material.uniforms;
    if (u?.uFace) {
      u.uFace.value.set(L[0], L[1], L[2], L[4]);
      u.uFaceKit.value.set(f.lines, f.mouthWidth, f.freckles, f.lidWeight);
      u.uFaceKit2.value.set(f.eyeSize, f.noseWidth, f.cheeks, this.earZ);
      // how young the face reads (face-ink.js faceYouth: a child's all but bare), on the skin and the eyes
      this.youth = faceYouth({ ...f, young: face?.young }, this.morph?.headSize ?? 1);
      u.uMood2.value.z = this.youth;
      const ue = this.eyeMesh?.material.uniforms;
      if (ue?.uMood2) ue.uMood2.value.z = this.youth;
    }
    this.poseBrows(true);
    this._browPosed = null;
  }

  /**
   * A facial expression (src/expression.js: smile, open, brow, browTilt, squint, gaze): the face
   * ink (uMood), the brows' shape, the lids (squint) and the gaze (updateEyes). Neutral: none.
   */
  setExpression(e = null) {
    const x = cleanExpression(e ?? {});
    this.expression = x;
    if (!this._ownMats) { this.ownMaterials(); this._ownMats = true; }   // (once: a talking face sets this every frame)
    const u = this.body?.material.uniforms;
    const ink = this.faceKeys ? this.faceKeys.set(x) : x;   // (shape keys take their share of it; the ink draws the rest)
    if (u?.uMood) { u.uMood.value.set(ink.smile, ink.open, ink.brow, ink.squint); u.uMood2.value.x = ink.browTilt; }
    this.squint = x.squint;
    this.gaze = x.gaze;
    // the brows' geometry only when they move (the mouth on the syllables doesn't touch them)
    const b = this._browPosed;
    if (!b || Math.abs(b[0] - x.brow) > 1e-3 || Math.abs(b[1] - x.browTilt) > 1e-3) { this.poseBrows(); this._browPosed = [x.brow, x.browTilt]; }
  }

  /** The brows raised, lowered or tilted by the expression (morph.js browPositions). */
  poseBrows(force = false) {
    const b = this.browMesh, e = this.expression ?? NEUTRAL_EXPRESSION;
    if (!b || this.faceKeys?.brows) return;
    if (!this._browBase) {
      if (!force && !e.brow && !e.browTilt) return;   // (never touched: the shared geometry stays)
      b.userData.baseGeometry ??= b.geometry;
      b.geometry = plainGeometry(b.geometry);   // (the model's arrays are interleaved)
      b.geometry.userData.ownBrows = true;
      this._browBase = Float32Array.from(b.geometry.attributes.position.array);
    }
    const P = b.geometry.attributes.position, base = this._browBase;
    let inner = Infinity;
    for (let i = 0; i < base.length; i += 3) inner = Math.min(inner, Math.abs(base[i]));
    browPositions(base, P.array, e, inner);
    P.needsUpdate = true;
    b.geometry.computeVertexNormals();
  }

  /**
   * Dress this body as the traveller (traveller.js): the suit painted on a baggy copy of the body
   * (the same vertices, weights and skeleton), the gear of traveller.glb (`scene`) and the extras
   * built on the suit, every piece skinned to this body's own bones like a costume.
   */
  wearOutfit(scene) {
    const body = this.body;
    body.userData.baseGeometry ??= body.geometry;
    body.geometry = this._suitGeometry = suitGeometry(body);
    const kit = (this.kit = travellerKit(scene, body));
    const P = TRAVELLER_PALETTE;
    body.material = makeMaterial({ color: P.suit, color2: P.suit, color3: P.boot, mode: MODE_OUTFIT, skin: P.skin, outfit: TRAVELLER.outfit,
      face: faceAfterReshape(this.kind), gloves: P.glove, creases: limbSegments(body) });
    body.material.uniforms.uFaceKit2.value.w = EAR_Z[this.kind];
    // one skinned mesh per colour (the radio pack and the glass apart: the tank hides the one, the other is see-through)
    const groups = new Map();
    for (const p of kit.pieces) {
      const k = p.glass ? 'glass' : `${p.color}|${p.pack ? 'pack' : ''}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    this.outfitMeshes = [];
    this.radioPack = [];
    for (const list of groups.values()) {
      const p = list[0];
      const geo = list.length > 1 ? mergeGeometries(list.map((q) => q.geometry)) : p.geometry;
      const mat = p.glass ? makeMaterial({ figure: true, color: p.color, glass: true, glassCenter: p.glass, glow: 0.35 })
        : makeMaterial({ figure: true, color: p.color, side: THREE.DoubleSide });
      const o = new THREE.SkinnedMesh(geo, mat);
      o.name = list.map((q) => q.name).join(' ');
      // each piece's vertices in the merged mesh: { name: [first, count] }
      let first = 0;
      o.userData.pieces = list.map((q) => q.name);
      o.userData.ranges = Object.fromEntries(list.map((q) => { const n = q.geometry.attributes.position.count; first += n; return [q.name, [first - n, n]]; }));
      o.position.copy(body.position); o.quaternion.copy(body.quaternion); o.scale.copy(body.scale);
      o.bind(body.skeleton, body.bindMatrix);
      o.frustumCulled = false;
      o.userData.noCollide = true;
      body.parent.add(o);
      this.outfitMeshes.push(o);
      if (p.glass) this.noShadow.push(o);
      if (p.pack) this.radioPack.push(o);
    }
  }

  /**
   * Swap the hood for other headwear: 'hood' | 'hat' | 'wrap' | 'hair'.
   * The head anchor sits at the centre of the skull, facing +z.
   */
  setHeadwear(kind, { color = '#d8a24a', hair = '#3a2a22', accent = '#c8483a' } = {}) {
    for (const h of this.hood) h.visible = kind === 'hood';
    if (kind === 'hood') return;
    const A = this.headAnchor;
    const mat = (c, o = {}) => makeMaterial({ color: c, figure: true, ...o });
    const add = (geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.userData.noCollide = true; A.add(mesh); return mesh; };
    // short hair under any hat, a fuller cut for bare heads
    const cap = new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
    cap.scale(1, 1.08, 1.12);
    add(cap, mat(hair), 0, 0.012, -0.012).rotation.x = -0.32;
    if (kind === 'short') { /* just the short crop */ }
    else if (kind === 'hair') {
      const style = Math.random();
      if (style < 0.5) add(new THREE.SphereGeometry(0.045, 10, 8), mat(hair), 0, 0.12, -0.06);                 // top-knot
      else {
        const tail = add(new THREE.CapsuleGeometry(0.03, 0.18, 4, 8), mat(hair), 0, -0.06, -0.12);              // ponytail
        tail.rotation.x = 0.35;
      }
    } else if (kind === 'hat') {
      // wide flat desert hat with a tall crown, tilted a little
      const brim = add(new THREE.CylinderGeometry(0.3, 0.3, 0.014, 22), mat(color), 0, 0.075, 0);
      const crown = add(new THREE.CylinderGeometry(0.075, 0.12, 0.17, 14), mat(color), 0, 0.16, 0);
      add(new THREE.CylinderGeometry(0.121, 0.124, 0.03, 14), mat(accent), 0, 0.09, 0);
      brim.rotation.z = crown.rotation.z = (Math.random() - 0.5) * 0.2;
    } else if (kind === 'wizard') {
      // the tall pointed hat with a wide brim, its tip bending back a little
      add(new THREE.CylinderGeometry(0.4, 0.4, 0.012, 28), mat(color), 0, 0.07, 0).rotation.x = -0.06;
      add(new THREE.CylinderGeometry(0.13, 0.142, 0.05, 18), mat(color), 0, 0.095, 0);
      const crown = add(new THREE.ConeGeometry(0.13, 0.42, 18, 1, true), mat(color, { side: THREE.DoubleSide }), 0, 0.33, -0.01);
      crown.rotation.x = -0.08;
      const tipPivot = new THREE.Group();
      tipPivot.position.set(0, 0.53, -0.03);
      tipPivot.rotation.x = -0.32;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 12), mat(color));
      tip.position.y = 0.13;
      tip.userData.noCollide = true;
      tipPivot.add(tip);
      A.add(tipPivot);
      this.hatTip = tipPivot;
    } else if (kind === 'wrap') {
      // head-wrap: stacked twisted rolls and a trailing tail
      for (let k = 0; k < 3; k++) {
        const t = add(new THREE.TorusGeometry(0.11 - k * 0.02, 0.032, 8, 18), mat(k % 2 ? accent : color, { flat: true }), 0, 0.045 + k * 0.045, -0.01);
        t.rotation.set(Math.PI / 2 + 0.15, 0, k * 0.4);
      }
      const tail = add(new THREE.BoxGeometry(0.07, 0.32, 0.01), mat(color, { side: THREE.DoubleSide }), 0.02, -0.08, -0.12);
      tail.rotation.set(0.25, 0.3, 0.1);
    }
  }

  /**
   * Dress the body in a costume look (costumes.js): headwear, mask, shoulder piece, held prop and
   * robe, merged into one skinned mesh on this body's own skeleton (one draw call; a second only
   * for glowing lanterns), coloured per vertex from the look. Replaces the rig's hood.
   */
  dress(look) {
    this.lod?.reset();
    for (const m of this._costume ?? []) { m.removeFromParent(); m.geometry.dispose(); }
    this._costume = [];
    for (const h of this.hood) h.visible = false;
    if (!look || this.outfit || !this.body) return;
    const base = this.costumeGeometry(look);
    const col = new THREE.Color();
    const make = (src, mat) => {
      if (!src) return;
      const geo = src.geo.clone();
      const c = new Float32Array(src.roles.length * 3);
      for (let i = 0; i < src.roles.length; i++) { col.set(roleColor(look, src.roles[i])); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const mesh = new THREE.SkinnedMesh(geo, mat);
      const body = this.body;
      mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); mesh.scale.copy(body.scale);
      mesh.bind(body.skeleton, body.bindMatrix);
      mesh.frustumCulled = false;
      mesh.userData.noCollide = true;
      body.parent.add(mesh);
      this._costume.push(mesh);
    };
    make(base.main, makeMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, figure: true }));
    make(base.glow, makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.85, side: THREE.DoubleSide, figure: true }));
  }

  /** The costume's merged geometry in this model's bind space (cached per body kind and look; colours added per person). */
  costumeGeometry(look) {
    const robe = look.robe > 0 ? `${look.robe.toFixed(2)}/${(look.flare ?? 0.3).toFixed(2)}` : '-';
    const key = `${this.profile?.id ?? this.kind}|${this.build}|${morphKey(this.morph)}|${look.head}|${look.mask}|${look.body}|${look.prop}|${robe}`;
    const cache = (this.constructor._costumes ??= new Map());
    if (cache.has(key)) return cache.get(key);
    const B = this.b, bones = this.body.skeleton.bones;
    const bi = (name) => Math.max(0, bones.indexOf(B[name]));
    const restHead = this.rest.get(B.Head).p;
    const handDir = this.restDir('lowerarm_r', 'hand_r');
    const frames = {
      head: { bone: bi('Head'), m: this.headFrame(restHead, look) },
      // (shoulder and chest pieces widen with the build)
      chest: { bone: bi('spine_03'), m: new THREE.Matrix4().makeTranslation(0, this.rest.get(B.neck_01).p.y - 0.76, 0).multiply(new THREE.Matrix4().makeScale(BUILDS[this.build].width * (this.morph?.shoulders ?? 1), 1, Math.sqrt(BUILDS[this.build].girth) * (this.morph?.chest ?? 1))) },
      // the hand frame: the arm hanging down; turned so a staff stands upright in the idle clip's grip
      hand: { bone: bi('hand_r'), m: new THREE.Matrix4().compose(this.rest.get(B.hand_r).p,
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), handDir).multiply(HAND_GRIP), new THREE.Vector3(1, 1, 1)) },
    };
    const out = { main: [], glow: [] };
    const push = (geo, role, joints, weights) => {
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
      if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
      const n = geo.attributes.position.count;
      const J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { const [j, w] = joints(i, geo); J.set(j, i * 4); W.set(w, i * 4); }
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(J, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
      (role === 'lamp' ? out.glow : out.main).push({ geo, role, n });
    };
    const pieces = lookPieces(look, 1);
    for (const [f, list] of Object.entries(pieces)) {
      const F = frames[f], rigid = () => [[F.bone, 0, 0, 0], [1, 0, 0, 0]];
      for (const pc of list) push(pc.geo.applyMatrix4(F.m), pc.role, rigid);
    }
    if (look.robe > 0) for (const part of this.robeGeometry(look.robe, look.flare ?? 0.3)) push(part.geo, part.role, part.joints);
    const merged = (list) => {
      if (!list.length) return null;
      const roles = [];
      for (const p of list) for (let i = 0; i < p.n; i++) roles.push(p.role);
      return { geo: mergeGeometries(list.map((p) => p.geo)), roles };
    };
    const r = { main: merged(out.main), glow: merged(out.glow) };
    cache.set(key, r);
    return r;
  }

  /** The head frame (the skull's centre, +z the face) in bind space; another body's skull scales the pieces to fit it (profile.headScale). */
  headFrame(restHead, look) {
    const hf = this.profile?.headFrame ?? [0, 0.1, 0.01];
    const m = new THREE.Matrix4().makeTranslation(hf[0], restHead.y + hf[1], restHead.z + hf[2]);
    const s = this.profile?.headScale?.(look?.kind === 'f' ? 'f' : 'm');
    return s ? m.multiply(new THREE.Matrix4().makeScale(...s)) : m;
  }

  /**
   * A robe from the belt to `hem` (m above the ground), flaring to `flare` (m): kept clear of this
   * body's hips and legs at rest, the lower part following the thighs as they swing.
   */
  robeGeometry(hem, flare) {
    const B = this.b, bones = this.body.skeleton.bones;
    const belt = this.outfitRest[1] - 0.005;
    // the body's extent at each height (bind pose), so the robe never cuts into the hips
    const ext = (this._robeExt ??= (() => {
      const P = this.body.geometry.attributes.position, rows = [];
      for (let k = 0; k < 24; k++) rows.push({ x: 0, z0: 0, z1: 0 });
      for (let i = 0; i < P.count; i++) {
        const y = P.getY(i);
        if (y > 1.15 || y < 0) continue;
        const r = rows[Math.min(23, Math.floor(y / 0.05))];
        r.x = Math.max(r.x, Math.abs(P.getX(i))); r.z0 = Math.min(r.z0, P.getZ(i)); r.z1 = Math.max(r.z1, P.getZ(i));
      }
      return rows;
    })());
    const at = (y) => ext[THREE.MathUtils.clamp(Math.floor(y / 0.05), 0, 23)];
    const left = Math.sign(this.rest.get(B.thigh_l).p.x) || 1;
    const jp = Math.max(0, bones.indexOf(B.pelvis)), jl = Math.max(0, bones.indexOf(B.thigh_l)), jr = Math.max(0, bones.indexOf(B.thigh_r));
    const ts = [0, 0.15, 0.32, 0.5, 0.7, 0.88];
    const cols = 18, len = belt - hem;
    const ring = (t) => {
      const y = belt - t * len, e = at(y), k = Math.pow(t, 0.85);
      const zc = (e.z0 + e.z1) / 2;
      return { y, zc: THREE.MathUtils.lerp(zc, zc - 0.02, t), rx: Math.max(THREE.MathUtils.lerp(0.165, flare, k), e.x + 0.03), rz: Math.max(THREE.MathUtils.lerp(0.14, flare * 0.86, k), (e.z1 - e.z0) / 2 + 0.03) };
    };
    const band = (t0, t1, steps) => {
      const pos = [], idx = [], rows = [];
      for (let r = 0; r <= steps; r++) rows.push(ring(t0 + (t1 - t0) * (r / steps)));
      rows.forEach((R) => { for (let c = 0; c <= cols; c++) { const a = (c / cols) * Math.PI * 2; pos.push(Math.sin(a) * R.rx, R.y, R.zc + Math.cos(a) * R.rz); } });
      for (let r = 0; r < steps; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const joints = (i, g) => {
      const P = g.attributes.position, t = (belt - P.getY(i)) / len;
      const wl = THREE.MathUtils.smoothstep(P.getX(i) * left, -0.12, 0.12), follow = 0.75 * THREE.MathUtils.smoothstep(t, 0, 0.5);
      return [[jp, jl, jr, 0], [1 - follow, follow * wl, follow * (1 - wl), 0]];
    };
    return [{ geo: band(0, 0.88, ts.length - 1), role: 'cloth', joints }, { geo: band(0.88, 1, 1), role: 'accent', joints }];
  }

  /**
   * The eyes: look at `target` (a world point: the player's face, someone talking) when it is in
   * reach of the eyes, else glance around; blink. Call after update(), only near the camera.
   */
  updateEyes(dt, target = null) {
    const m = this.eyeMesh, head = this.b.Head;
    if (!m || !head || !m.material.uniforms?.uEyeLook) return;
    let dir = null;
    if (target) {
      // bind space -> world for the eyeballs (skinned to the head alone)
      const i = m.skeleton.bones.indexOf(head);
      _m4.multiplyMatrices(head.matrixWorld, m.skeleton.boneInverses[i]).multiply(m.bindMatrix).premultiply(m.bindMatrixInverse).premultiply(m.matrixWorld);
      const c = m.material.uniforms.uEyeC.value;
      const at = _a.set(0, c.y, c.z).applyMatrix4(_m4);
      dir = _b.subVectors(target, at).transformDirection(_m4.invert());
    }
    this.eyeLook.update(dt, dir);
    // an expression's gaze (setExpression) holds the eyes there; a squint narrows the lids
    const L = (this.gaze ? EyeLook.fromAngles(this.gaze[0], this.gaze[1], _c) : _c.copy(this.eyeLook.look)).applyAxisAngle(_xAxis, EYE_TILT);
    const lid = Math.max(this.eyeLook.blink, (this.squint ?? 0) * 0.45);
    // (lids with shape keys close themselves: the eyeball's painted lid then only does what they don't)
    m.material.uniforms.uEyeLook.value.set(L.x, L.y, L.z, this.faceKeys ? this.faceKeys.eyes(this.eyeLook.blink, this.squint ?? 0) : lid);
    this.updateNoseSide(dt, m, head);
  }

  /**
   * The face ink's nose line goes down the shadow side of the nose (face-ink.js, uMood2.y): the
   * side of the head turned away from the sun. Held while the light is nearly frontal, eased over.
   */
  updateNoseSide(dt, m = this.eyeMesh, head = this.b.Head) {
    const u = this.body?.material.uniforms;
    if (!u?.uMood2 || !m || !head) return;
    const i = m.skeleton.bones.indexOf(head);
    _m4.multiplyMatrices(head.matrixWorld, m.skeleton.boneInverses[i]).multiply(m.bindMatrix).premultiply(m.bindMatrixInverse).premultiply(m.matrixWorld);
    const toward = _a.set(1, 0, 0).transformDirection(_m4).dot(sharedUniforms.uSunDir.value);   // the +x side's lighting
    const s = u.uMood2.value;
    const want = noseSide(toward, s.y);
    s.y += (want - s.y) * (1 - Math.exp(-5 * Math.max(dt, 0)));
  }

  /** Aim the skeleton along the rig (call after the rig's pose for this frame). */
  update(atRest = false) {
    const c = this.char, root = c.root;
    if (atRest) {   // restore the bind pose
      const rootInv = _m4.copy(root.matrixWorld).invert();
      for (const bone of this.order) {
        const r = this.rest.get(bone), pq = bone.parent?.isBone ? this.rest.get(bone.parent).q : _q.identity();
        bone.quaternion.copy(_qr.copy(pq).invert().multiply(r.q));
      }
      this.model.updateMatrixWorld(true);
      return;
    }
    root.updateMatrixWorld(true);
    const rootQi = root.getWorldQuaternion(_qp).invert();
    const charQOf = (o, out) => o.getWorldQuaternion(out).premultiply(rootQi);
    const charPosOf = (o, out) => root.worldToLocal(o.getWorldPosition(out));

    // pelvis position: the rig's hip midpoint, keeping the model's hip→pelvis offset
    const hipMid = charPosOf(c.legs[0], _a).add(charPosOf(c.legs[1], _b)).multiplyScalar(0.5);
    const pelvisChar = hipMid.add(_c.copy(this.restPelvis).sub(this.restHipMid));
    pelvisChar.y += this.lift;   // (longer legs: setMorph)

    for (const bone of this.order) {
      const parentQ = bone.parent?.isBone ? this.charQ.get(bone.parent) : _q.identity();
      const rest = this.rest.get(bone);
      let q = null;
      const f = this.followOf.get(bone), ch = this.chainOf.get(bone);
      if (ch) {
        // minimal rotation of the bone's rest direction onto the rig limb
        const from = charPosOf(ch.from(), _a);
        const to = ch.hand !== undefined ? root.worldToLocal(c.elbows[ch.hand].localToWorld(_b.set(0, -0.31, 0))) : charPosOf(ch.to(), _b);
        const want = to.sub(from).normalize();
        q = new THREE.Quaternion().setFromUnitVectors(ch.dir, want).multiply(rest.q);
      } else if (f) {
        // rig joint's rotation (its rest is identity in character space)
        q = charQOf(f.j(), new THREE.Quaternion()).multiply(rest.q);
      }
      if (q) {
        bone.quaternion.copy(_qr.copy(parentQ).invert().multiply(q));
        this.charQ.set(bone, q);
      } else {
        this.charQ.set(bone, (this.charQ.get(bone) ?? new THREE.Quaternion()).copy(parentQ).multiply(bone.quaternion));
      }
      if (bone === this.b.pelvis && !atRest) {
        bone.parent.updateMatrixWorld(true);
        _m4.copy(bone.parent.matrixWorld).invert().multiply(root.matrixWorld);
        bone.position.copy(pelvisChar).applyMatrix4(_m4);
      }
    }
    this.model.updateMatrixWorld(true);
  }

  /** Preserve wrist rotation from the source clip instead of leaving T-pose hands. */
  poseHands(animator) {
    const rootQ = this.char.root.getWorldQuaternion(new THREE.Quaternion());
    for (const s of ['r', 'l']) {
      const hand = this.b[`hand_${s}`];
      const q = animator.bone(`hand_${s}`).getWorldQuaternion(new THREE.Quaternion())
        .multiply(animator.restHands[s].clone().invert()).multiply(this.rest.get(hand).q).premultiply(rootQ);
      hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
      hand.updateMatrixWorld(true);
    }
  }

  // ------------------------------------------------------------------ IK
  /** Rotate a bone (in world space) so its direction `from` turns to `to`. */
  turnBone(bone, from, to) {
    if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
    const q = _iq.setFromUnitVectors(from.normalize(), to.normalize());
    const wq = bone.getWorldQuaternion(_iq2).premultiply(q);
    const pq = bone.parent.getWorldQuaternion(_iq3);
    bone.quaternion.copy(pq.invert().multiply(wq));
    bone.updateMatrixWorld(true);
  }

  /** Two-bone IK: a (root), b (mid), c (end) so c reaches `target`, bending toward `pole` (world). */
  solveTwoBone(a, b, c, target, pole, weight = 1) {
    if (weight <= 0.001) return;
    const A = a.getWorldPosition(_i1), B = b.getWorldPosition(_i2), C = c.getWorldPosition(_i3);
    const la = A.distanceTo(B), lb = B.distanceTo(C);
    const T = _i4.copy(C).lerp(target, weight);
    const dir = _i5.subVectors(T, A);
    const d = THREE.MathUtils.clamp(dir.length(), Math.abs(la - lb) + 1e-3, (la + lb) * 0.999);
    dir.normalize();
    const along = (la * la - lb * lb + d * d) / (2 * d), h = Math.sqrt(Math.max(la * la - along * along, 0));
    const pd = _i6.subVectors(pole, A);
    pd.addScaledVector(dir, -pd.dot(dir));
    if (pd.lengthSq() < 1e-8) pd.subVectors(B, A).addScaledVector(dir, -_i7.subVectors(B, A).dot(dir));
    pd.normalize();
    const newB = _i7.copy(A).addScaledVector(dir, along).addScaledVector(pd, h);
    this.turnBone(a, _i8.subVectors(B, A), _i9.subVectors(newB, A));
    const B2 = b.getWorldPosition(_i2), C2 = c.getWorldPosition(_i3);
    const endT = _i1.copy(A).addScaledVector(dir, d);
    this.turnBone(b, _i8.subVectors(C2, B2), _i9.subVectors(endT, B2));
  }

  /**
   * Plant the feet (src/feet.js): a foot the gait puts down is held on the real ground where it
   * lands while the body moves over it (no sliding, no sinking), the hips come down when it is out
   * of reach, and a standing body steps its feet back under it. Calls onStep(groundPoint, side,
   * normal) on each touchdown. o: { contact, warp, gait, pivot, scale } (feet.js plantFeet).
   */
  plantFeet(dt, physics, up, rootPos, fwd, onStep, o) { plantFeet(this, dt, physics, up, rootPos, fwd, onStep, o); }

  resetFeet() { resetFeet(this); }

  /** Match a contact's direction and surface normal, including its rest-pose twist. */
  orientContact(bone, restDirection, restNormal, direction, normal) {
    const basis = (along, facing) => {
      const y = along.clone().normalize();
      const z = facing.clone().addScaledVector(y, -facing.dot(y)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    };
    const world = basis(direction, normal).multiply(basis(restDirection, restNormal).invert()).multiply(this.rest.get(bone).q);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  /** Climbing: hands and feet onto wall points (world), elbows out, knees off the wall. */
  reach({ hands, feet, wallN, up, wallContact = false }) {
    const B = this.b;
    ['r', 'l'].forEach((s, i) => {
      const side = i === 0 ? -1 : 1;
      if (hands?.[i]) {
        const sh = B[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
        const right = _i5.crossVectors(up, wallN).normalize();   // character's left, seen from the wall
        const pole = sh.addScaledVector(right, side * 0.6).addScaledVector(up, -0.4).addScaledVector(wallN, 0.4);
        const hand = B[`hand_${s}`], q = hand.getWorldQuaternion(new THREE.Quaternion());
        this.solveTwoBone(B[`upperarm_${s}`], B[`lowerarm_${s}`], hand, hands[i], pole);
        hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
        hand.updateMatrixWorld(true);
        if (wallContact) {
          const { along, normal } = this.handFrames[s];
          this.orientContact(hand, along, normal, up, wallN.clone().negate());
        }
      }
      if (feet?.[i]) {
        // A knee only hinges forward: facing the wall, it comes toward the
        // wall surface, up and splayed out to its own side (a climber's frog
        // stance), so it never folds backward behind the hip-foot line. The
        // pole lies in front of the hip (into the wall), never behind it.
        const hip = B[`thigh_${s}`].getWorldPosition(new THREE.Vector3());
        const out = _i5.crossVectors(wallN, up).normalize().multiplyScalar(side);   // the character's right for 'r', left for 'l'
        const pole = hip.addScaledVector(wallN, -0.55).addScaledVector(up, 0.45).addScaledVector(out, 0.4);
        this.solveTwoBone(B[`thigh_${s}`], B[`calf_${s}`], B[`foot_${s}`], feet[i], pole);
        if (wallContact) {
          const foot = B[`foot_${s}`];
          const toes = this.rest.get(B[`ball_${s}`]).p.clone().sub(this.rest.get(foot).p).normalize();
          this.orientContact(foot, toes, new THREE.Vector3(0, 1, 0), wallN.clone().negate().addScaledVector(up, 0.35).normalize(), up);
        }
      }
    });
  }

  /**
   * Aiming the handheld tool at a world point, blended over the current pose
   * by k (0..1): spine, chest and head share the turn toward the target, the
   * right arm reaches along the line of fire with the fist's knuckles on it
   * (thumb up), and the left hand comes up under the wrist to steady it.
   */
  aimAt(point, k, up) {
    const B = this.b;
    if (k <= 0.001 || !B.upperarm_r || !B.lowerarm_r || !B.hand_r) return;
    const fwd = _w1.set(0, 0, 1).applyQuaternion(this.char.root.getWorldQuaternion(_wq1)).normalize();
    for (const [name, share, from] of [['spine_02', 0.3, 'upperarm_r'], ['spine_03', 0.35, 'upperarm_r'], ['Head', 0.55, 'Head']]) {
      const bone = B[name];
      if (!bone?.parent) continue;
      const to = _w2.subVectors(point, B[from].getWorldPosition(_w3)).normalize();
      const turn = _wq2.identity().slerp(_wq3.setFromUnitVectors(fwd, to), share * k);
      bone.quaternion.copy(bone.parent.getWorldQuaternion(_wq4).invert().multiply(bone.getWorldQuaternion(_wq5).premultiply(turn)));
      bone.updateMatrixWorld(true);
      fwd.applyQuaternion(turn);
    }
    const sh = B.upperarm_r.getWorldPosition(new THREE.Vector3());
    const to = new THREE.Vector3().subVectors(point, sh).normalize();
    const right = new THREE.Vector3().crossVectors(to, up).normalize();        // the character's right
    const len = (this._armLen ??= this.rest.get(B.upperarm_r).p.distanceTo(this.rest.get(B.lowerarm_r).p) + this.rest.get(B.lowerarm_r).p.distanceTo(this.rest.get(B.hand_r).p));
    const grip = sh.clone().addScaledVector(to, len * 0.9).addScaledVector(up, 0.03);
    const blendHand = (hand, along, palm, w) => {
      const s = hand === B.hand_r ? 'r' : 'l', F = this.handFrames[s];
      if (!F) return;
      const q0 = hand.getWorldQuaternion(new THREE.Quaternion());
      this.orientContact(hand, F.along, F.normal, along, palm);
      const q = q0.slerp(hand.getWorldQuaternion(_wq1), w);
      hand.quaternion.copy(hand.parent.getWorldQuaternion(_wq2).invert().multiply(q));
      hand.updateMatrixWorld(true);
    };
    // the fist along the line of fire, thumb up: its palm faces in, across the body
    this.solveTwoBone(B.upperarm_r, B.lowerarm_r, B.hand_r, grip, sh.clone().addScaledVector(up, -0.6).addScaledVector(right, 0.5), k);
    blendHand(B.hand_r, to, right.clone().negate(), k);
    if (B.upperarm_l && B.lowerarm_l && B.hand_l) {
      const shl = B.upperarm_l.getWorldPosition(new THREE.Vector3());
      const under = B.hand_r.getWorldPosition(new THREE.Vector3()).addScaledVector(up, -0.06).addScaledVector(to, -0.05).addScaledVector(right, -0.05);
      this.solveTwoBone(B.upperarm_l, B.lowerarm_l, B.hand_l, under, shl.addScaledVector(up, -0.6).addScaledVector(right, -0.6), k * 0.85);
      blendHand(B.hand_l, to.clone().addScaledVector(right, 1.2).normalize(), up, k * 0.85);   // cupped under it, palm up
    }
  }

  /**
   * Kneeling at something low in front (an item box), blended over the
   * current pose by k (0..1); call after the frame's pose (update, plantFeet).
   * The pelvis drops, the left knee goes down to the ground with the shin
   * lying back, the right foot plants ahead with its knee up, the back leans
   * in and the head looks down at `look`. `hands` ([right, left] world
   * points) pulls the hands there by `reach` (0..1): lifting a lid.
   * Every bone it turns is re-driven by update() next frame, so nothing
   * accumulates.
   */
  kneel(k, { up, fwd, ground, look = null, hands = null, reach = 0, lean = 0.42 }) {
    const B = this.b;
    if (k <= 0.001 || !B.pelvis || !B.thigh_l || !B.calf_l || !B.foot_l || !B.thigh_r || !B.calf_r || !B.foot_r) return;
    const F = _k1.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize();
    const right = _k2.crossVectors(F, up).normalize();          // the character's right
    const axis = _k3.crossVectors(up, F).normalize();           // turning about it tips up toward fwd
    const footQ = { l: B.foot_l.getWorldQuaternion(new THREE.Quaternion()), r: B.foot_r.getWorldQuaternion(new THREE.Quaternion()) };
    // 1. the pelvis drops (and sits back a little over the kneeling leg)
    const p = B.pelvis;
    const wp = p.getWorldPosition(_k4).addScaledVector(up, -0.43 * k).addScaledVector(F, -0.06 * k);
    p.position.copy(wp.applyMatrix4(_km.copy(p.parent.matrixWorld).invert()));
    p.updateMatrixWorld(true);
    // 2. the legs: left knee down, right foot ahead
    const gy = (v) => v.addScaledVector(up, ground - v.dot(up));   // onto the ground plane (along up)
    const hipL = B.thigh_l.getWorldPosition(new THREE.Vector3()), hipR = B.thigh_r.getWorldPosition(new THREE.Vector3());
    const knee = gy(hipL.clone().addScaledVector(F, 0.26)).addScaledVector(up, 0.07);
    const footL = gy(knee.clone().addScaledVector(F, -0.4)).addScaledVector(up, 0.12);
    this.solveTwoBone(B.thigh_l, B.calf_l, B.foot_l, footL, knee.clone().addScaledVector(F, 0.6).addScaledVector(up, -0.3), k);
    const footR = gy(hipR.clone().addScaledVector(F, 0.32)).addScaledVector(up, 0.09);
    this.solveTwoBone(B.thigh_r, B.calf_r, B.foot_r, footR, hipR.clone().addScaledVector(F, 1).addScaledVector(up, 0.5).addScaledVector(right, 0.15), k);
    // the right foot stays flat; the left one tips onto its toes behind
    const setWorldQ = (bone, q) => { bone.quaternion.copy(bone.parent.getWorldQuaternion(_kq).invert().multiply(q)); bone.updateMatrixWorld(true); };
    setWorldQ(B.foot_r, footQ.r);
    setWorldQ(B.foot_l, footQ.l.premultiply(_kq2.setFromAxisAngle(axis, 1.15 * k)));
    // 3. the back leans in, the head looks down at the box
    for (const [name, share] of [['spine_01', 0.25], ['spine_02', 0.4], ['spine_03', 0.35]]) {
      const bone = B[name];
      if (!bone?.parent) continue;
      setWorldQ(bone, bone.getWorldQuaternion(_kq3).premultiply(_kq2.setFromAxisAngle(axis, lean * share * k)));
    }
    if (look && B.Head?.parent) {
      const h = B.Head.getWorldPosition(_k4);
      const to = _k5.subVectors(look, h).normalize();
      const now = _k6.copy(F).applyAxisAngle(axis, lean * k);
      setWorldQ(B.Head, B.Head.getWorldQuaternion(_kq3).premultiply(_kq2.setFromUnitVectors(now, to).slerp(_kq.identity(), 1 - 0.6 * k)));
    }
    // 4. the hands
    if (hands && reach > 0.001 && B.upperarm_r && B.lowerarm_r && B.hand_r) {
      ['r', 'l'].forEach((s, i) => {
        const ua = B[`upperarm_${s}`], la = B[`lowerarm_${s}`], hd = B[`hand_${s}`];
        if (!ua || !la || !hd || !hands[i]) return;
        const sh = ua.getWorldPosition(new THREE.Vector3());
        const q = hd.getWorldQuaternion(new THREE.Quaternion());
        this.solveTwoBone(ua, la, hd, hands[i], sh.addScaledVector(right, i === 0 ? 0.6 : -0.6).addScaledVector(up, -0.5), reach * k);
        setWorldQ(hd, q);
      });
    }
  }

  /**
   * The backpack hand-off (fluid-tool.js, player.js): both hands on the tank
   * at a world point as it swings off the back into a vehicle's socket (or
   * back), blended over the current pose by k (0..1). The hands hold its
   * sides, elbows out and down; the chest turns a little toward it.
   */
  handOff(point, k, up) {
    const B = this.b;
    if (k <= 0.001 || !B.upperarm_r || !B.upperarm_l || !B.hand_r || !B.hand_l) return;
    const chest = B.spine_03;
    const fwd = _w1.set(0, 0, 1).applyQuaternion(this.char.root.getWorldQuaternion(_wq1)).normalize();
    if (chest?.parent) {
      const to = _w2.subVectors(point, chest.getWorldPosition(_w3)).addScaledVector(up, -_w2.dot(up));
      if (to.lengthSq() > 1e-4) {
        to.normalize();
        const turn = _wq2.identity().slerp(_wq3.setFromUnitVectors(fwd, to), 0.3 * k);
        chest.quaternion.copy(chest.parent.getWorldQuaternion(_wq4).invert().multiply(chest.getWorldQuaternion(_wq5).premultiply(turn)));
        chest.updateMatrixWorld(true);
      }
    }
    const mid = B.spine_03 ? B.spine_03.getWorldPosition(new THREE.Vector3()) : point.clone();
    const across = new THREE.Vector3().subVectors(point, mid).cross(up);
    if (across.lengthSq() < 1e-6) across.crossVectors(fwd, up);
    across.normalize();   // from the traveller's view: to their right of the tank
    for (const [s, side] of [['r', 1], ['l', -1]]) {
      const grip = point.clone().addScaledVector(across, side * 0.2);
      const sh = B[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
      const pole = sh.clone().addScaledVector(up, -0.6).addScaledVector(across, side * 0.5);
      this.solveTwoBone(B[`upperarm_${s}`], B[`lowerarm_${s}`], B[`hand_${s}`], grip, pole, k);
    }
  }

  /** Body capsules (world space) for cloth collision. */
  capsules() {
    const B = this.b;
    // [from bone, to bone (or point offset), radius]; radii include the cloth's thickness
    const spec = this._spec ??= [
      ['pelvis', 'spine_03', 0.2], ['spine_03', 'neck_01', 0.17], ['clavicle_l', 'clavicle_r', 0.12],
      ['thigh_l', 'calf_l', 0.12], ['calf_l', 'foot_l', 0.1], ['foot_l', 'ball_l', 0.08],
      ['thigh_r', 'calf_r', 0.12], ['calf_r', 'foot_r', 0.1], ['foot_r', 'ball_r', 0.08],
      ['upperarm_l', 'lowerarm_l', 0.08], ['lowerarm_l', 'hand_l', 0.07],
      ['upperarm_r', 'lowerarm_r', 0.08], ['lowerarm_r', 'hand_r', 0.07],
    ].filter(([a, b]) => B[a] && B[b]);
    const g = BUILDS[this.build]?.girth ?? 1;   // fuller bodies, wider colliders (the trunk and thighs most)
    if (!this._caps) this._caps = spec.map(([a, , r]) => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: r * (/spine|pelvis|clavicle|thigh/.test(a) ? g : Math.sqrt(g)) }));
    spec.forEach(([a, b], i) => { B[a].getWorldPosition(this._caps[i].a); B[b].getWorldPosition(this._caps[i].b); });
    return this._caps;   // the jetpack sits on top of the cloth, so it isn't a collider
  }
}
