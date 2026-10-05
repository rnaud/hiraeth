import * as THREE from 'three';

// Body and face morphology for the people's body (humanoid.js), tuned in the
// character studio (studio.html) and usable by the game: a person can carry
// `morph` (body) and `face` (face) objects next to their build.
//
// Three kinds of change, all on the same skeleton and the same skinned mesh:
//  - radial (girth): the body mesh is pulled toward / pushed away from the bones
//    it is skinned to, weighted, the way the builds are made (BUILD_SHAPE):
//    shoulders, chest, belly, hips, arm / leg / neck thickness
//  - bone scale (proportion): uniform scales on whole limbs and the head, so
//    nothing shears; a longer leg is thinned back by its radial factor and the
//    pelvis is lifted so the feet stay on the ground (Humanoid.lift)
//  - face (warpFace): bind-space warps of the head, eyes and brows: eye size,
//    spacing and height, nose, jaw, chin, cheeks, brow ridge, face length and
//    head width. The landmarks the face ink is drawn from (materials.js faceInk:
//    uFace) move with them (faceLandmarks).
// Neutral values change nothing: the body is exactly the build's.

// ---------------------------------------------------------------------------
// Builds (costumes.js BUILDS): per bone, radial factor sideways, forward and back.
// The head, hands and feet keep their size, so headwear and masks still fit.
export const BUILD_SHAPE = {
  slim: [[/^spine_0[123]$|^pelvis$/, 0.88, 0.88, 0.9], [/^clavicle_/, 0.94, 0.94, 0.94], [/^(upper|lower)arm_/, 0.86, 0.86, 0.86], [/^(thigh|calf)_/, 0.87, 0.87, 0.87], [/^neck_01$/, 0.9, 0.9, 0.9]],
  broad: [[/^spine_03$/, 1.24, 1.14, 1.12], [/^clavicle_/, 1.16, 1.1, 1.1], [/^spine_02$/, 1.14, 1.1, 1.08], [/^spine_01$|^pelvis$/, 1.06, 1.05, 1.05],
    [/^upperarm_/, 1.22, 1.22, 1.22], [/^lowerarm_/, 1.12, 1.12, 1.12], [/^thigh_/, 1.1, 1.1, 1.1], [/^calf_/, 1.06, 1.06, 1.06], [/^neck_01$/, 1.18, 1.18, 1.18]],
  heavy: [[/^spine_01$/, 1.42, 1.8, 1.2], [/^spine_02$/, 1.34, 1.62, 1.15], [/^spine_03$/, 1.16, 1.25, 1.08], [/^pelvis$/, 1.3, 1.4, 1.28], [/^clavicle_/, 1.06, 1.08, 1.08],
    [/^upperarm_/, 1.26, 1.26, 1.26], [/^lowerarm_/, 1.12, 1.12, 1.12], [/^thigh_/, 1.3, 1.3, 1.3], [/^calf_/, 1.12, 1.12, 1.12], [/^neck_01$/, 1.25, 1.25, 1.25]],
};

/** The body sliders: key, label, range, neutral value. */
export const BODY_MORPHS = [
  { key: 'height', label: 'Height', min: 0.8, max: 1.25, def: 1 },
  { key: 'shoulders', label: 'Shoulder width', min: 0.8, max: 1.3, def: 1 },
  { key: 'chest', label: 'Chest', min: 0.8, max: 1.4, def: 1 },
  { key: 'belly', label: 'Belly', min: 0.8, max: 1.7, def: 1 },
  { key: 'hips', label: 'Hips', min: 0.8, max: 1.4, def: 1 },
  { key: 'arms', label: 'Arm thickness', min: 0.7, max: 1.45, def: 1 },
  { key: 'legs', label: 'Leg thickness', min: 0.7, max: 1.45, def: 1 },
  { key: 'neck', label: 'Neck thickness', min: 0.75, max: 1.35, def: 1 },
  { key: 'neckLength', label: 'Neck length', min: 0.6, max: 1.6, def: 1 },
  { key: 'armLength', label: 'Arm length', min: 0.85, max: 1.15, def: 1 },
  { key: 'legLength', label: 'Leg length', min: 0.85, max: 1.18, def: 1 },
  { key: 'headSize', label: 'Head size', min: 0.82, max: 1.22, def: 1 },
  { key: 'handSize', label: 'Hand size', min: 0.8, max: 1.3, def: 1 },
  { key: 'footSize', label: 'Foot size', min: 0.8, max: 1.3, def: 1 },
];

/** The face sliders: geometry (warpFace) and ink (faceInk uniforms: uFaceKit). */
export const FACE_MORPHS = [
  { key: 'eyeSize', label: 'Eye size', min: 0.8, max: 1.3, def: 1 },
  { key: 'eyeSpacing', label: 'Eye spacing', min: -1, max: 1, def: 0 },
  { key: 'eyeHeight', label: 'Eye height', min: -1, max: 1, def: 0 },
  { key: 'noseLength', label: 'Nose length', min: 0.5, max: 1.7, def: 1 },
  { key: 'noseWidth', label: 'Nose width', min: 0.75, max: 1.5, def: 1 },
  { key: 'jaw', label: 'Jaw width', min: 0.8, max: 1.25, def: 1 },
  { key: 'chin', label: 'Chin', min: -1, max: 1, def: 0 },
  { key: 'cheeks', label: 'Cheeks (hollow – full)', min: -1, max: 1, def: 0 },
  { key: 'browRidge', label: 'Brow ridge', min: -1, max: 1, def: 0 },
  { key: 'faceLength', label: 'Face length', min: 0.9, max: 1.14, def: 1 },
  { key: 'headWidth', label: 'Head width', min: 0.9, max: 1.12, def: 1 },
  // ink only (no geometry)
  { key: 'lines', label: 'Age lines', min: 0, max: 2, def: 1, ink: true },
  { key: 'mouthWidth', label: 'Mouth width', min: 0.7, max: 1.4, def: 1, ink: true },
  { key: 'freckles', label: 'Freckles', min: 0, max: 1, def: 0, ink: true },
  { key: 'lidWeight', label: 'Lid line weight', min: 0.4, max: 2, def: 1, ink: true },
];

const neutralOf = (list) => Object.fromEntries(list.map((m) => [m.key, m.def]));
export const NEUTRAL_BODY = Object.freeze(neutralOf(BODY_MORPHS));
export const NEUTRAL_FACE = Object.freeze(neutralOf(FACE_MORPHS));

/** A morph with every key, clamped to its range (unknown keys dropped). */
export function cleanMorph(m, list = BODY_MORPHS) {
  const out = {};
  for (const d of list) {
    const v = Number(m?.[d.key]);
    out[d.key] = Number.isFinite(v) ? THREE.MathUtils.clamp(v, d.min, d.max) : d.def;
  }
  return out;
}

/** The keys that differ from neutral, as a stable string ('' when neutral). */
export function morphKey(m, list = BODY_MORPHS, only = null) {
  if (!m) return '';
  return list.filter((d) => (!only || only(d)) && Math.abs((m[d.key] ?? d.def) - d.def) > 1e-4)
    .map((d) => `${d.key}=${(+m[d.key]).toFixed(3)}`).join(',');
}
export const isNeutral = (m, list = BODY_MORPHS) => morphKey(m, list) === '';

// ---------------------------------------------------------------------------
// radial factors
const MORPH_BONES = /^(spine_0[123]|pelvis|clavicle_[lr]|(upper|lower)arm_[lr]|thigh_[lr]|calf_[lr]|neck_01)$/;

/**
 * The radial factors [sideways, forward, back] for a bone of this build and body
 * morph, or null when it isn't reshaped. Neutral morph: exactly BUILD_SHAPE.
 */
export function radialFactors(boneName, build, morph = null) {
  const rule = BUILD_SHAPE[build]?.find(([re]) => re.test(boneName));
  const f = rule ? [rule[1], rule[2], rule[3]] : null;
  if (!morph || isNeutral(morph)) return f;
  if (!MORPH_BONES.test(boneName)) return f;
  const m = { ...NEUTRAL_BODY, ...morph };
  const r = f ?? [1, 1, 1];
  const mul = (x, y, z) => { r[0] *= x; r[1] *= y; r[2] *= z; };
  const p = Math.pow;
  if (boneName === 'spine_03') mul(p(m.shoulders, 0.6) * p(m.chest, 0.3), m.chest, p(m.chest, 0.5));
  else if (/^clavicle_/.test(boneName)) mul(m.shoulders, p(m.chest, 0.3), 1);
  else if (boneName === 'spine_02') mul(p(m.chest, 0.2) * p(m.belly, 0.3), p(m.chest, 0.6) * p(m.belly, 0.5), p(m.belly, 0.2));
  else if (boneName === 'spine_01') mul(p(m.belly, 0.5), m.belly, p(m.belly, 0.3));
  else if (boneName === 'pelvis') mul(m.hips, p(m.belly, 0.4), p(m.hips, 0.7));
  else if (/^(thigh|calf)_/.test(boneName)) { const k = m.legs / m.legLength; mul(k, k, k); }
  else if (/arm_/.test(boneName)) { const k = m.arms / m.armLength; mul(k, k, k); }
  else if (boneName === 'neck_01') mul(m.neck, m.neck, m.neck);
  return r.every((x) => Math.abs(x - 1) < 1e-6) ? null : r;
}

// ---------------------------------------------------------------------------
// bone scales
/**
 * The per-bone transforms of a body morph: uniform scales, rest-position
 * multipliers, and how far the pelvis rises (m, character space) so the feet
 * stay on the ground. `legSpan` / `ankle`: the rest hip-to-ankle and ankle heights.
 */
export function boneMorph(morph, { legSpan = 0.885, ankle = 0.086 } = {}) {
  const m = { ...NEUTRAL_BODY, ...(morph ?? {}) };
  const scale = {
    Head: m.headSize,
    thigh_l: m.legLength, thigh_r: m.legLength,
    foot_l: m.footSize / m.legLength, foot_r: m.footSize / m.legLength,
    upperarm_l: m.armLength, upperarm_r: m.armLength,
    hand_l: m.handSize / m.armLength, hand_r: m.handSize / m.armLength,
  };
  // positions along the parent bone: the neck's length, the shoulders' breadth
  const position = { Head: m.neckLength, upperarm_l: 1 + (m.shoulders - 1) * 0.9, upperarm_r: 1 + (m.shoulders - 1) * 0.9 };
  const lift = (m.legLength - 1) * legSpan + (m.footSize - 1) * ankle;
  return { scale, position, lift, height: m.height };
}

// ---------------------------------------------------------------------------
// face
const sm = THREE.MathUtils.smoothstep;

/**
 * Where the face's landmarks go under a face morph: [eyeY, eyeX, noseY, noseZ, chinY]
 * (humanoid.js FACE, after reshape), for the face ink (uFace).
 */
export function faceLandmarks(face, f) {
  const m = { ...NEUTRAL_FACE, ...(f ?? {}) };
  const [eyeY, eyeX, noseY, noseZ, chinY] = face;
  const ey = eyeY + m.eyeHeight * 0.004;
  return [ey, (eyeX + m.eyeSpacing * 0.005) * m.headWidth, eyeY + (noseY - eyeY) * m.faceLength, noseZ, eyeY + (chinY - eyeY) * m.faceLength];
}

/**
 * Warp one head vertex (bind space, in place) by a face morph.
 * headW: the vertex's weight on the Head bone; eye: the right eyeball's centre
 * [|x|, y, z]; face: the landmarks; eyeball: true for the eyes' own mesh (moved whole).
 */
export function warpFaceVertex(v, headW, eye, face, f, eyeball = false) {
  if (headW < 0.3) return v;
  const k = sm(headW, 0.3, 0.8);
  const [eyeY, , noseY, noseZ, chinY] = face;
  const side = v.x < 0 ? -1 : 1;
  // the eyes first (round their own centres): size, spacing, height
  const cx = side * eye[0], dx = v.x - cx, dy = v.y - eye[1], dz = v.z - eye[2];
  const d = Math.hypot(dx, dy, dz);
  const near = eyeball ? 1 : 1 - sm(d, 0.014, 0.032), wide = eyeball ? 1 : 1 - sm(d, 0.02, 0.046);
  const s = 1 + (f.eyeSize - 1) * near * k;
  let x = cx + dx * s, y = eye[1] + dy * s, z = eye[2] + dz * s;
  x += side * f.eyeSpacing * 0.005 * wide * k;
  y += f.eyeHeight * 0.004 * wide * k;
  // the nose: further out, wider at the base
  const front = sm(z, noseZ - 0.045, noseZ - 0.01);
  const along = THREE.MathUtils.clamp((eyeY - 0.004 - y) / (eyeY - noseY + 0.012), 0, 1);
  const nose = eyeball ? 0 : Math.exp(-((x / 0.017) ** 2)) * front * (y > noseY - 0.022 && y < eyeY ? 1 : 0) * k;
  z += (f.noseLength - 1) * Math.max(0, z - (noseZ - 0.04)) * nose;
  x *= 1 + (f.noseWidth - 1) * nose * sm(along, 0.35, 1);
  if (!eyeball) {
    // cheeks under the cheekbones (hollow – full), a heavier or lighter brow, the chin
    const cheek = Math.exp(-(((Math.abs(x) - 0.052) / 0.016) ** 2) - (((y - (noseY - 0.018)) / 0.02) ** 2)) * k;
    z += f.cheeks * 0.008 * cheek;
    x += side * f.cheeks * 0.005 * cheek;
    const brow = Math.exp(-(((y - (eyeY + 0.017)) / 0.008) ** 2)) * sm(z, 0.03, 0.07) * k;
    z += f.browRidge * 0.004 * brow;
    const chin = Math.exp(-((x / 0.022) ** 2) - (((y - chinY) / 0.02) ** 2)) * sm(z, 0.02, 0.06) * k;
    z += f.chin * 0.008 * chin;
    y -= f.chin * 0.004 * chin;
    // the jaw, widening from the nose down to the chin
    x *= 1 + (f.jaw - 1) * sm(y, noseY, chinY + 0.005) * k;
  }
  // the whole face: longer below the eyes, the head wider
  if (y < eyeY) y = eyeY + (y - eyeY) * (1 + (f.faceLength - 1) * k);
  x *= 1 + (f.headWidth - 1) * k;
  return v.set(x, y, z);
}

/**
 * A copy of a skinned geometry with its head warped by a face morph (only the
 * geometry vertices weighted on the head move; normals recomputed).
 */
export function warpFace(geometry, headIndex, eye, face, f, { eyeball = false } = {}) {
  const m = { ...NEUTRAL_FACE, ...(f ?? {}) };
  const g = geometry.clone();
  const P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    let headW = 0;
    for (let c = 0; c < 4; c++) if (J.getComponent(i, c) === headIndex) headW += W.getComponent(i, c);
    if (headW < 0.3) continue;
    warpFaceVertex(v.fromBufferAttribute(P, i), headW, eye, face, m, eyeball);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  P.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** A copy of a geometry with plain (not interleaved) attributes, so its arrays can be written directly. */
export function plainGeometry(geometry) {
  const g = new THREE.BufferGeometry();
  if (geometry.index) g.setIndex(geometry.index.clone());
  for (const [k, a] of Object.entries(geometry.attributes)) {
    const n = a.count, size = a.itemSize, Arr = a.array.constructor, out = new Arr(n * size);
    for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) out[i * size + c] = a.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(out, size, a.normalized));
  }
  for (const gr of geometry.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.computeBoundingSphere();
  return g;
}

/**
 * The brows moved by an expression (bind space, in place): raised (brow > 0) or
 * lowered and drawn together (< 0), the inner ends up (tilt > 0: worry, sorrow)
 * or down (< 0: anger). base: the rest positions; centreX: where the inner end is (|x|).
 */
export function browPositions(base, out, { brow = 0, browTilt = 0 } = {}, inner = 0.018) {
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2], ax = Math.abs(x);
    const u = THREE.MathUtils.clamp((ax - inner) / 0.04, 0, 1);   // 0 inner end .. 1 outer
    const raise = brow > 0 ? brow * 0.0045 : brow * 0.0022 * (1 - 0.5 * u);
    const dy = raise + browTilt * 0.004 * (1 - u) - browTilt * 0.0012 * u;
    const dx = -Math.sign(x) * Math.max(-brow, 0) * 0.0025 * (1 - u);
    out[i] = x + dx; out[i + 1] = y + dy; out[i + 2] = z - Math.max(dy, 0) * 0.3;
  }
  return out;
}
