import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRAVELLER_PALETTE as PAL, TRAVELLER_TONES } from './traveller-style.js';
import { scalp, skullPoint } from './costumes.js';

// The traveller wears the reference sheets' coral overshirt, cream trousers and
// round satchel. Clothes follow the people's original skeleton and weights so
// locomotion, climbing and equipment anchors keep their existing behaviour.
// traveller.glb supplies the radio and worn boots; the coat, hair and bag are
// built here in bind space, then skinned onto that same animation rig.

/** Fit settings, in metres on the body's bind pose (the T-pose, feet at 0, facing +z). */
export const TRAVELLER = {
  // MODE_OUTFIT zones: cropped trouser hem, waist, neck, rolled sleeve end
  outfit: [0.27, 0.97, 1.47, 0.52],
  // the baggy suit: how far it stands off the body
  swell: { torso: 0.012, arm: 0.018, forearm: 0.012, clavicle: 0.015, leg: 0.035, hand: 0 },
  backGap: 0.025,        // the tank clears the loose jacket
  boot: { margin: 0.014, sole: -0.012 },   // room round the foot; the sole's bottom (the foot's own pokes 1 cm under 0)
  // his own face (morph.js FACE_MORPHS, Humanoid.setFace): about twenty-six, so younger and warmer than the
  // people's modelled face (gaunt, long, hollow-cheeked): fuller cheeks, a shorter lower face and nose, a
  // softer brow and jaw, larger eyes, hardly a line on it, a few freckles
  // (on the people's gentler modelled face, humanoid.js reshape: the same face he had on the gaunt one;
  // `young` keeps his ink as it was, a little over half a child's: face-ink.js faceYouth)
  face: { cheeks: 0.45, faceLength: 0.94, noseLength: 0.72, noseWidth: 0.94, jaw: 1.1, chin: -0.5, browRidge: -0.8, eyeSize: 1.15, eyeHeight: 0.15,
    lines: 0.1, lidWeight: 0.9, mouthWidth: 0.96, freckles: 0.35, young: 0.57 },
  // and at rest the corners of his mouth a little up (src/expression.js; the conversations go from there)
  rest: { smile: 0.2 },
};

const BONE = (bones, name) => { const i = bones.findIndex((b) => b.name === name); if (i < 0) throw new Error(`no bone ${name}`); return i; };
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

/** Bind-pose position of a bone, in the body geometry's coordinates. */
function bindPos(body, name) {
  const i = BONE(body.skeleton.bones, name);
  return new THREE.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[i].clone().invert()).applyMatrix4(body.bindMatrixInverse);
}

// ------------------------------------------------------------------ the suit
const suits = new WeakMap();
/**
 * The body made into the traveller's baggy suit (cached per body geometry): the same vertices,
 * weights and skeleton, each vertex moved out along its welded normal by its region's swell.
 */
export function suitGeometry(body) {
  const base = body.userData.baseGeometry ?? body.geometry;
  if (suits.has(base)) return suits.get(base);
  const bones = body.skeleton.bones;
  const group = bones.map((b) => (/^upperarm/.test(b.name) ? 'arm' : /^lowerarm/.test(b.name) ? 'forearm' : /^clavicle/.test(b.name) ? 'clavicle'
    : /^(thigh|calf)/.test(b.name) ? 'leg' : /^(pelvis|spine)/.test(b.name) ? 'torso' : /^(hand|index|middle|ring|pinky|thumb)/.test(b.name) ? 'hand' : null));   // head, neck, feet: none
  const g = base.clone();
  const P = g.attributes.position, N = base.attributes.normal, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  // welded normals: the vertices split along the model's seams share one, so the suit doesn't crack open there
  const key = (i) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
  const sums = new Map(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const k = key(i);
    sums.set(k, (sums.get(k) ?? new THREE.Vector3()).add(n.fromBufferAttribute(N, i)));
  }
  const [bootTop, , neckY, wristX] = TRAVELLER.outfit, S = TRAVELLER.swell;
  for (let i = 0; i < P.count; i++) {
    const w = { arm: 0, forearm: 0, clavicle: 0, leg: 0, torso: 0, hand: 0 };
    for (let k = 0; k < 4; k++) { const gr = group[J.getComponent(i, k)]; if (gr) w[gr] += W.getComponent(i, k); }
    const x = P.getX(i), y = P.getY(i), ax = Math.abs(x);
    n.copy(sums.get(key(i))).normalize();
    // the collar comes in to the neck (the scarf hides the edge)
    const collar = 1 - smooth(y, neckY - 0.07, neckY) * (1 - smooth(ax, 0.1, 0.17));
    // sleeves gather at their rolled ends; trousers narrow toward the cropped hems
    const sleeve = 1 - smooth(ax, wristX - 0.15, wristX - 0.025);
    const trouser = smooth(y, bootTop - 0.01, bootTop + 0.17);
    // the legs' inner sides stand off less, so the trousers don't fuse between the knees
    const inner = THREE.MathUtils.clamp(-n.x * Math.sign(x || 1), 0, 1) * (1 - smooth(y, 0.8, 0.95));
    const d = (S.torso * w.torso + S.clavicle * w.clavicle) * collar + (S.arm * w.arm + S.forearm * w.forearm) * sleeve + S.leg * w.leg * trouser * (1 - 0.65 * inner) + S.hand * w.hand;   // hands stay bare
    if (d > 0) P.setXYZ(i, x + n.x * d, y + n.y * d, P.getZ(i) + n.z * d);
  }
  P.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  suits.set(base, g);
  return g;
}

// ------------------------------------------------------------------ geometry helpers
/** A geometry reduced to position + normal + an index, its vertices moved by m. */
function plain(geo, m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position.clone());
  g.setAttribute('normal', geo.attributes.normal ? geo.attributes.normal.clone() : geo.attributes.position.clone());
  g.setIndex(geo.index ? [...geo.index.array] : [...Array(geo.attributes.position.count).keys()]);
  if (!geo.attributes.normal) g.computeVertexNormals();
  if (m) g.applyMatrix4(m);
  return g;
}
/** The triangles of an indexed geometry that pass keep(a, b, c), with only the vertices they use. */
function pick(geo, keep) {
  const idx = geo.index.array, used = new Map(), out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]];
    if (!keep(...tri)) continue;
    for (const v of tri) { if (!used.has(v)) used.set(v, used.size); out.push(used.get(v)); }
  }
  const g = new THREE.BufferGeometry(), order = [...used.keys()];
  for (const [k, a] of Object.entries(geo.attributes)) {
    const arr = k === 'skinIndex' ? new Uint16Array(order.length * a.itemSize) : new Float32Array(order.length * a.itemSize);
    order.forEach((v, i) => { for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(v, c); });
    g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
  }
  g.setIndex(out);
  return g;
}
/** Skin every vertex of a piece to one bone. */
function rigid(g, bone) {
  const n = g.attributes.position.count, J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { J[i * 4] = bone; W[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(J, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
  return g;
}
/**
 * Skin a piece like the suit beneath it: each vertex takes the weights of the nearest suit vertex,
 * keeping only the bones `allow` names (renormalised; `fallback` if none is left). With `one`, the
 * whole piece takes the weights at that point (a rigid-ish pouch).
 */
function conform(g, suit, body, allow, fallback, one = null) {
  const bones = body.skeleton.bones, ok = bones.map((b) => allow.test(b.name));
  const SP = suit.attributes.position, SJ = suit.attributes.skinIndex, SW = suit.attributes.skinWeight;
  const weightsAt = (p) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < SP.count; i++) {
      const dx = SP.getX(i) - p.x, dy = SP.getY(i) - p.y, dz = SP.getZ(i) - p.z, d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    const js = [], ws = [];
    for (let k = 0; k < 4; k++) { const j = SJ.getComponent(best, k), w = SW.getComponent(best, k); if (w > 0 && ok[j]) { js.push(j); ws.push(w); } }
    const sum = ws.reduce((a, b) => a + b, 0);
    if (sum < 1e-6) return [[fallback, 0, 0, 0], [1, 0, 0, 0]];
    while (js.length < 4) { js.push(0); ws.push(0); }
    return [js, ws.map((w) => w / sum)];
  };
  const P = g.attributes.position, n = P.count, J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  const fixed = one ? weightsAt(one) : null, v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const [js, ws] = fixed ?? weightsAt(v.fromBufferAttribute(P, i));
    J.set(js, i * 4); W.set(ws, i * 4);
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(J, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
  return g;
}
/** A flat strap (width × thickness) along points on a surface, each with its outward normal. */
function ribbon(points, normals, width, thick) {
  const curve = new THREE.CatmullRomCurve3(points), nc = new THREE.CatmullRomCurve3(normals);
  const steps = Math.max(8, points.length * 6), pos = [], idx = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3(), nn = new THREE.Vector3(), b = new THREE.Vector3();
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    curve.getPoint(u, p); curve.getTangent(u, t); nc.getPoint(u, nn).normalize();
    b.crossVectors(t, nn).normalize();
    nn.crossVectors(b, t).normalize();
    for (const [cb, cn] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]) pos.push(p.x + b.x * cb * width + nn.x * cn * thick, p.y + b.y * cb * width + nn.y * cn * thick, p.z + b.z * cb * width + nn.z * cn * thick);
  }
  for (let s = 0; s < steps; s++) for (let k = 0; k < 4; k++) {
    const a = s * 4 + k, c = s * 4 + ((k + 1) % 4), d = a + 4, e = c + 4;
    idx.push(a, d, c, c, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A closed band through rings of points (rows of equal length): a belt, a cuff. */
function band(rows) {
  const cols = rows[0].length, pos = [], idx = [];
  for (const r of rows) for (const q of r) pos.push(q.x, q.y, q.z);
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols; c++) {
    const a = r * cols + c, b = r * cols + ((c + 1) % cols), d = a + cols, e = b + cols;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A cloth panel with open side edges (rows run across the fabric). */
function openPanel(rows) {
  const cols = rows[0].length, pos = [], idx = [];
  for (const row of rows) for (const p of row) pos.push(...p.toArray());
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols;
    idx.push(a, b, d, b, d + 1, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ measuring the body
/** Vertices of a geometry (bind pose) that pass test(p): an array of Vector3. */
function points(geo, test) {
  const P = geo.attributes.position, out = [], v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); if (test(v, i)) out.push(v.clone()); }
  return out;
}
const boxOf = (pts) => new THREE.Box3().setFromPoints(pts);
/** Vertices mostly skinned to the bones `re` names. */
function onBones(geo, body, re, min = 0.5) {
  const ok = body.skeleton.bones.map((b) => re.test(b.name)), J = geo.attributes.skinIndex, W = geo.attributes.skinWeight;
  return (p, i) => { let w = 0; for (let k = 0; k < 4; k++) if (ok[J.getComponent(i, k)]) w += W.getComponent(i, k); return w >= min; };
}
/** The furthest a surface reaches from a point along a direction, among vertices near that ray (radius r). */
function reach(pts, from, dir, r = 0.03) {
  let best = 0;
  const d = dir.clone().normalize(), v = new THREE.Vector3();
  for (const p of pts) {
    v.subVectors(p, from);
    const t = v.dot(d);
    if (t <= 0) continue;
    if (v.addScaledVector(d, -t).lengthSq() < r * r) best = Math.max(best, t);
  }
  return best;
}

// ------------------------------------------------------------------ his hair
/**
 * Tousled dark hair in the head frame: a ragged scalp, swept fringe and uneven crown locks.
 */
export function travellerHair() {
  const parts = [scalp(1, { kind: 'm', t: 0.016, front: 25, side: -22, back: -43, crown: 0.018, quiff: 0.014, jag: 5, bump: 0.004 })];
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), m = new THREE.Matrix4();
  for (let k = 0; k < 7; k++) {
    const az = -45 + k * 15, sway = (k % 2 ? 1 : -1) * 4 + (k - 3) * 2.5;
    const p0 = new THREE.Vector3(...skullPoint('m', az, 46, 0.011)), p1 = new THREE.Vector3(...skullPoint('m', az + sway, 15 + ((k * 5) % 7) * 1.6 + Math.abs(k - 3) * 2.5, 0.012));
    Y.subVectors(p1, p0);
    const len = Y.length();
    Y.normalize();
    Z.copy(p0).add(p1).normalize();                    // out from the skull
    Z.addScaledVector(Y, -Z.dot(Y)).normalize();
    X.crossVectors(Y, Z);
    const g = new THREE.ConeGeometry(0.022 - Math.abs(k - 3) * 0.0015, len, 5).rotateX(Math.PI).scale(1, 1, 0.3);
    g.applyMatrix4(m.makeBasis(X, Y, Z).setPosition(p0.clone().add(p1).multiplyScalar(0.5)));
    g.deleteAttribute('uv');
    parts.push(g);
  }
  // Uneven overlapping locks make the outline shaggy without a spherical helmet of hair.
  for (let k = 0; k < 28; k++) {
    const az = k * 137.5, el = 15 + ((k * 17) % 65);
    const p = new THREE.Vector3(...skullPoint('m', az, el, 0.025));
    const lock = new THREE.SphereGeometry(1, 7, 5).scale(0.024, 0.018, 0.04)
      .rotateX(0.3 + k * 0.37).rotateY(az * Math.PI / 180).rotateZ(k * 0.73).translate(p.x, p.y, p.z);
    lock.deleteAttribute('uv'); parts.push(lock);
  }
  return mergeGeometries(parts);
}

// ------------------------------------------------------------------ the kit
/** The traveller.glb meshes by name (the gear's art), with their bind-pose geometry. */
function glbParts(scene) {
  const out = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { if (o.isMesh) out.set(o.name, o); });
  return out;
}
const toneOf = (mesh) => {
  const t = TRAVELLER_TONES[mesh.material.name];
  return t ? PAL[t] : '#' + mesh.material.color.getHexString();
};

/**
 * Everything the traveller wears on a body (pure data, cached per outfit scene and body geometry):
 * { pieces: [{ name, geometry (skinned to the body's bones, bind space), color, glass?, pack? }],
 *   chestZ (the chest anchor's offset to the pack's front), dock (where the scout's foot rests on the pack,
 *   chest anchor frame), forearm: { r, l } (bracer frames: { position, quaternion, scale } in
 *   bind space), head: { centre, half } }.
 */
export function travellerKit(scene, body) {
  const base = body.userData.baseGeometry ?? body.geometry;
  const cache = (scene.userData.travellerKits ??= new Map());
  if (cache.has(base.uuid)) return cache.get(base.uuid);
  const suit = suitGeometry(body), bones = body.skeleton.bones, bi = (n) => BONE(bones, n);
  const glb = glbParts(scene), F = TRAVELLER;
  const [bootTop, beltY, neckY, wristX] = F.outfit;
  const pieces = [];
  const add = (name, geometry, color, o = {}) => pieces.push({ name, geometry, color, ...o });
  const glbGeo = (name, m) => { const src = glb.get(name); return src ? plain(src.geometry, new THREE.Matrix4().multiplyMatrices(m, src.bindMatrix ?? new THREE.Matrix4())) : null; };

  // ---- the head: centre and size of the human's, from its own vertices
  const headPts = points(base, onBones(base, body, /^Head$/));
  const headBox = boxOf(headPts), headC = headBox.getCenter(new THREE.Vector3()), headHalf = headBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const Head = bi('Head');
  const anchorHead = new THREE.Vector3(0, bindPos(body, 'Head').y + 0.1, bindPos(body, 'Head').z + 0.01);
  const anchorM = new THREE.Matrix4().makeTranslation(anchorHead.x, anchorHead.y, anchorHead.z);
  add('Traveller_hair', rigid(plain(travellerHair(), anchorM), Head), PAL.hair);

  // ---- the scarf round the neck, on the chest (the head turns inside it)
  const neck = bindPos(body, 'neck_01'), chest = bi('spine_03');
  const neckPts = points(suit, (p) => Math.abs(p.y - (neck.y + 0.02)) < 0.03 && Math.abs(p.x) < 0.13);
  const neckZ = neckPts.length ? (Math.min(...neckPts.map((p) => p.z)) + Math.max(...neckPts.map((p) => p.z))) / 2 : neck.z;
  for (let k = 0; k < 3; k++) {
    const fold = new THREE.TorusGeometry(0.076 + k * 0.006, 0.021, 7, 24).rotateX(Math.PI / 2)
      .scale(1.08, 0.64, 1.16).rotateZ(0.1 - k * 0.08).translate(0, neck.y - 0.026 - k * 0.022, neckZ + 0.008);
    add(`Scarf_fold_${k}`, rigid(plain(fold), chest), PAL.scarf);
  }
  const scarfTail = [new THREE.Vector3(-0.03, neck.y - 0.08, 0.105), new THREE.Vector3(-0.04, neck.y - 0.14, 0.12), new THREE.Vector3(-0.025, neck.y - 0.25, 0.145)];
  add('Scarf_tail', conform(ribbon(scarfTail, scarfTail.map(() => new THREE.Vector3(0, 0, 1)), 0.042, 0.004), suit, body, /^spine_0[123]$/, chest), PAL.scarf);
  // The translator remains a small earpiece from home, almost lost in his hair.
  add('Translator', rigid(plain(new THREE.SphereGeometry(1, 8, 6).scale(0.009, 0.017, 0.012).translate(-headHalf.x - 0.003, headC.y - 0.008, headC.z)), Head), PAL.teal);

  // ---- the radio pack, its front on the suit's back
  const backPts = points(suit, (p) => p.y > neck.y - 0.24 && p.y < neck.y - 0.07 && Math.abs(p.x) < 0.1);
  const backZ = Math.min(...backPts.map((p) => p.z));
  // the glb's suit back, and its chest frame's origin (y 0.74 below the collar): the chest anchor
  // goes as far behind the human's neck as the pack must move, so the tank keeps its place too
  const glbBackZ = -0.14, glbCollar = 0.73;
  const chestY = neck.y - 0.76, chestZ = backZ - F.backGap - glbBackZ;
  const packM = new THREE.Matrix4().makeTranslation(0, chestY - glbCollar, chestZ);
  const radio = glb.get('Equipment_ivory_radio');
  const tri = (pred) => (geo) => (a, b, c) => pred(geo, a) && pred(geo, b) && pred(geo, c);
  const onGlbBone = (mesh, re) => (geo, v) => { const J = geo.attributes.skinIndex, W = geo.attributes.skinWeight; for (let k = 0; k < 4; k++) if (W.getComponent(v, k) > 0.5) return re.test(mesh.skeleton.bones[J.getComponent(v, k)].name); return false; };
  const radioPack = pick(radio.geometry, tri(onGlbBone(radio, /^chest$/))(radio.geometry));
  const radioM = new THREE.Matrix4().multiplyMatrices(packM, radio.bindMatrix);
  add('Equipment_ivory_radio', rigid(plain(radioPack, radioM), chest), toneOf(radio), { pack: true });
  for (const n of ['Equipment_blue_metal', 'Equipment_cyan_glass']) add(n, rigid(glbGeo(n, packM), chest), toneOf(glb.get(n)), { pack: true });
  // the scout's place: the point on the radio's flat top its foot rests on, towards the back (clear of his hair)
  const radioBox = boxOf(points(plain(radioPack, radioM), () => true));
  const dock = new THREE.Vector3(0, radioBox.max.y - chestY, radioBox.min.z + 0.085 - chestZ);

  // ---- the shoulder straps: from the pack over the shoulders, down the front to the belt
  const torso = points(suit, onBones(suit, body, /^(pelvis|spine|clavicle|neck)/, 0.5));
  const strapPath = (sx) => {
    const x = sx * 0.105, pts = [], nrm = [];
    const at = (from, dir) => from.clone().addScaledVector(dir, reach(torso, from, dir, 0.025) + 0.004);
    pts.push(new THREE.Vector3(x, neck.y - 0.12, backZ - 0.01)); nrm.push(new THREE.Vector3(0, 0, -1));
    pts.push(at(new THREE.Vector3(x, neck.y - 0.25, -0.03), new THREE.Vector3(0, 1, -0.6))); nrm.push(new THREE.Vector3(0, 1, -0.6).normalize());
    pts.push(at(new THREE.Vector3(x, neck.y - 0.25, 0.0), new THREE.Vector3(0, 1, 0))); nrm.push(new THREE.Vector3(0, 1, 0));
    pts.push(at(new THREE.Vector3(x, neck.y - 0.25, 0.02), new THREE.Vector3(0, 1, 0.8))); nrm.push(new THREE.Vector3(0, 1, 0.8).normalize());
    for (const y of [neck.y - 0.12, neck.y - 0.24, neck.y - 0.36, neck.y - 0.46, beltY + 0.06]) {
      pts.push(at(new THREE.Vector3(x * (y < neck.y - 0.3 ? 1.06 : 1), y, 0), new THREE.Vector3(0, 0, 1))); nrm.push(new THREE.Vector3(0, 0, 1));
    }
    return [pts, nrm];
  };
  for (const sx of [-1, 1]) {
    const [pts, nrm] = strapPath(sx);
    add(`Strap_${sx}`, conform(ribbon(pts, nrm, 0.045, 0.01), suit, body, /^(pelvis|spine_0[123]|clavicle_[lr])$/, chest), PAL.strap);
  }

  // ---- the open overshirt: shoulder/sleeve shells and an open, thigh-length body.
  // The front opening grows toward the collar. Rows below the hips take each
  // thigh's weights, so the two skirts part when walking or kneeling.
  const coatRows = [
    [0.78, 0.21, 0.155, 0.36], [0.88, 0.205, 0.155, 0.32], [0.98, 0.19, 0.15, 0.3],
    [1.1, 0.185, 0.15, 0.32], [1.22, 0.20, 0.16, 0.36], [1.34, 0.22, 0.155, 0.43],
    [1.4, 0.19, 0.13, 0.6], [1.46, 0.105, 0.105, 0.68],
  ].map(([y, rx, rz, gap]) => Array.from({ length: 37 }, (_, k) => {
    const a = gap + (Math.PI * 2 - 2 * gap) * k / 36;
    const fold = 0.004 * Math.sin(a * 9 + y * 12);
    return new THREE.Vector3(Math.sin(a) * (rx + fold), y + (y < 0.8 ? 0.012 * Math.sin(a * 3) : 0), Math.cos(a) * (rz + fold) - 0.018);
  }));
  // Unlike a belt this is deliberately open: no triangle may bridge the shirt front.
  const coat = openPanel(coatRows);
  add('Coral_overshirt', conform(coat, suit, body, /^(pelvis|spine_0[123]|clavicle_[lr]|thigh_[lr])$/, chest), PAL.jacket);
  const sleeve = pick(suit, (a, b, c) => [a, b, c].every((i) => {
    const x = Math.abs(suit.attributes.position.getX(i));
    return x > 0.16 && x < wristX + 0.012 && suit.attributes.position.getY(i) > 1.15;
  }));
  for (const name of Object.keys(sleeve.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(name)) sleeve.deleteAttribute(name);
  const sp = sleeve.attributes.position, sn = sleeve.attributes.normal;
  for (let i = 0; i < sp.count; i++) sp.setXYZ(i, sp.getX(i) + sn.getX(i) * 0.008, sp.getY(i) + sn.getY(i) * 0.008, sp.getZ(i) + sn.getZ(i) * 0.008);
  sleeve.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sleeve.attributes.skinIndex.array, 4));
  add('Coral_sleeves', sleeve, PAL.jacket);
  // Turned-back lapels, a soft collar and a few small, dull buttons.
  for (const sign of [-1, 1]) {
    const lapel = openPanel([
      [new THREE.Vector3(sign * 0.06, 1.46, 0.07), new THREE.Vector3(sign * 0.13, 1.415, 0.1)],
      [new THREE.Vector3(sign * 0.058, 1.35, 0.13), new THREE.Vector3(sign * 0.117, 1.36, 0.135)],
      [new THREE.Vector3(sign * 0.067, 1.25, 0.145), new THREE.Vector3(sign * 0.076, 1.27, 0.153)],
    ]);
    add(`Lapel_${sign}`, conform(lapel, suit, body, /^(spine_0[123]|clavicle_[lr])$/, chest), PAL.jacketShade);
  }
  for (const y of [0.86, 1.0, 1.14]) add(`Shirt_button_${y}`, conform(plain(new THREE.SphereGeometry(0.005, 6, 4).scale(1, 1, 0.45).translate(-0.074, y, 0.138)), suit, body, /^(pelvis|spine_0[123])$/, chest), PAL.pouch);

  // One soft round satchel on a diagonal strap, rather than a utility belt.
  const bagAt = new THREE.Vector3(0.13, 0.985, 0.17);
  const bag = plain(new THREE.SphereGeometry(1, 16, 10).scale(0.105, 0.083, 0.044).translate(bagAt.x, bagAt.y, bagAt.z));
  add('Round_satchel', conform(bag, suit, body, /^(pelvis|spine_01)$/, bi('pelvis'), bagAt), PAL.pouch);
  const flap = plain(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.58).scale(0.109, 0.068, 0.044).translate(bagAt.x, bagAt.y + 0.025, bagAt.z + 0.016));
  add('Satchel_flap', conform(flap, suit, body, /^(pelvis|spine_01)$/, bi('pelvis'), bagAt), PAL.strap);
  const diagonal = [new THREE.Vector3(-0.14, 1.425, 0.11), new THREE.Vector3(-0.08, 1.32, 0.157), new THREE.Vector3(0.01, 1.19, 0.166), new THREE.Vector3(0.115, 1.04, 0.19)];
  add('Satchel_strap', conform(ribbon(diagonal, diagonal.map(() => new THREE.Vector3(0, 0, 1)), 0.028, 0.005), suit, body, /^(pelvis|spine_0[123]|clavicle_[lr])$/, chest), PAL.strap);

  // Faded cloth ties drape beside the pack, over the jacket's back.
  for (const [x, color, length] of [[0.18, PAL.teal, 0.55], [-0.17, PAL.lavender, 0.49]]) {
    const path = [new THREE.Vector3(x, 1.4, backZ - 0.015), new THREE.Vector3(x * 1.18, 1.25, backZ - 0.045), new THREE.Vector3(x * 1.05, 1.06, backZ - 0.035), new THREE.Vector3(x * 1.2, 1.4 - length, backZ - 0.05)];
    add(`Pack_cloth_${x}`, conform(ribbon(path, path.map(() => new THREE.Vector3(0, 0, -1)), 0.043, 0.003), suit, body, /^(pelvis|spine_0[123])$/, chest), color);
  }

  // ---- the boots: the glb's, on each foot, the soles just under the ground
  for (const [s, S, sign] of [['l', 'L', 1], ['r', 'R', -1]]) {
    const footPts = points(base, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(base, body, new RegExp(`^(foot|ball)_${s}$`))));
    const fb = boxOf(footPts), fc = fb.getCenter(new THREE.Vector3()), fs = fb.getSize(new THREE.Vector3());
    const parts = ['Equipment_dusty_pink_boots', 'Equipment_rubber_soles', 'Equipment_seam_ink'].map((n) => [n, glb.get(n)]).filter(([, m]) => m);
    parts.push(['Boot_buckles', radio]);
    const side = (m) => (geo) => (a, b, c) => [a, b, c].every((v) => geo.attributes.position.getX(v) * sign > 0) && (m !== radio || tri(onGlbBone(radio, /^foot/))(geo)(a, b, c));
    const bootBox = new THREE.Box3();
    for (const [, m] of parts.slice(0, 2)) bootBox.union(boxOf(points(pick(m.geometry, side(m)(m.geometry)), () => true)));
    const bc = bootBox.getCenter(new THREE.Vector3()), bs = bootBox.getSize(new THREE.Vector3());
    const sx = (fs.x + 2 * F.boot.margin) / bs.x, sz = Math.max(1, (fs.z + 2 * F.boot.margin) / bs.z);
    // (centred on the foot; the heel's end kept just behind the human's heel)
    const bootM = new THREE.Matrix4().makeTranslation(fc.x, F.boot.sole, fb.min.z - F.boot.margin + bs.z * sz / 2)
      .multiply(new THREE.Matrix4().makeScale(sx, 1, sz)).multiply(new THREE.Matrix4().makeTranslation(-bc.x, -bootBox.min.y, -bc.z));
    const footB = bi(`foot_${s}`), calfB = bi(`calf_${s}`);
    for (const [n, m] of parts) {
      const g = plain(pick(m.geometry, side(m)(m.geometry)), new THREE.Matrix4().multiplyMatrices(bootM, m.bindMatrix));
      // the glb's own weights: its foot follows the foot, the shaft above the ankle the shin
      const src = pick(m.geometry, side(m)(m.geometry)), J = src.attributes.skinIndex, W = src.attributes.skinWeight;
      const n4 = g.attributes.position.count, J2 = new Uint16Array(n4 * 4), W2 = new Float32Array(n4 * 4);
      for (let i = 0; i < n4; i++) {
        let shin = 0;
        for (let k = 0; k < 4; k++) if (/^shin/.test(m.skeleton.bones[J.getComponent(i, k)].name)) shin += W.getComponent(i, k);
        J2.set([footB, calfB, 0, 0], i * 4); W2.set([1 - shin, shin, 0, 0], i * 4);
      }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(J2, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(W2, 4));
      add(`${n}_${s}`, g, toneOf(m));
    }
    // The rolled trouser hem leaves an ankle-length gap above the boot.
    const legAxis = (y) => { const c = bindPos(body, `calf_${s}`), f = bindPos(body, `foot_${s}`); return f.clone().lerp(c, (y - f.y) / (c.y - f.y)); };
    const bootTopY = F.boot.sole + bs.y;
    const shaft = points(plain(pick(parts[0][1].geometry, side(parts[0][1])(parts[0][1].geometry)), bootM), () => true);
    const legPts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^(calf|thigh|foot)_${s}$`))));
    const cuff = (y, out) => { const c = legAxis(y); return Array.from({ length: 20 }, (_, k) => {
      const a = (k / 20) * Math.PI * 2, d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const r = Math.max(reach(legPts, c, d, 0.03), reach(shaft.filter((p) => Math.abs(p.y - bootTopY) < 0.05), c.clone().setY(bootTopY - 0.02), d, 0.04));
      return c.clone().addScaledVector(d, r + out + 0.012 * Math.sin(a * 7) ** 2);
    }); };
    const y0 = bootTop + 0.005, y1 = bootTop + 0.045;
    add(`Trouser_cuff_${s}`, rigid(mergeGeometries([band([cuff(y0, 0.006), cuff(y1, 0.004)]), band([cuff(y1, 0.004), cuff(y1, -0.01)])]), calfB), PAL.suit);
    // The overshirt rolls up just below the elbow, leaving the forearm bare.
    const arm = bindPos(body, `lowerarm_${s}`), hand = bindPos(body, `hand_${s}`), along = hand.clone().sub(arm).normalize();
    const armPts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^lowerarm_${s}|^hand_${s}$`), 0.3)));
    const axisAt = (x) => arm.clone().lerp(hand, (x - arm.x) / (hand.x - arm.x));
    const gauntlet = (x, out) => { const c = axisAt(x); return Array.from({ length: 18 }, (_, k) => {
      const a = (k / 18) * Math.PI * 2, d = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      return c.clone().addScaledVector(d, reach(armPts, c, d, 0.02) + out);
    }); };
    const g0 = sign * (wristX - 0.075), g1 = sign * (wristX + 0.008);
    add(`Rolled_sleeve_${s}`, rigid(mergeGeometries([band([gauntlet(g0, 0.016), gauntlet(g1, 0.006)]), band([gauntlet(g1, 0.006), gauntlet(g1, -0.004)]), band([gauntlet(g0, 0.0), gauntlet(g0, 0.016)])]), bi(`lowerarm_${s}`)), PAL.jacket);
  }

  // ---- the bracer's frame on each forearm (fluid-tool.js): +y toward the hand, -x the thumb's side,
  // scaled out so the bracer sits round the baggy sleeve, not in it
  const forearm = {};
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    const arm = bindPos(body, `lowerarm_${s}`), hand = bindPos(body, `hand_${s}`), thumb = bindPos(body, `thumb_01_${s}`);
    const y = hand.clone().sub(arm).normalize();
    const t = thumb.sub(hand), x = t.addScaledVector(y, -t.dot(y)).normalize().negate();
    const z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const sleevePts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^lowerarm_${s}`), 0.5)));
    const c = arm.clone().addScaledVector(y, 0.13);
    let r = 0;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; r = Math.max(r, reach(sleevePts, c, x.clone().multiplyScalar(Math.cos(a)).addScaledVector(z, Math.sin(a)), 0.02)); }
    const k = Math.max(1, (r + 0.006) / 0.05);
    forearm[s] = { position: arm, quaternion: q, scale: new THREE.Vector3(k, 1, k) };
  }

  const kit = { pieces, chestY, chestZ, dock, forearm, head: { centre: headC, half: headHalf }, backZ };
  cache.set(base.uuid, kit);
  return kit;
}
