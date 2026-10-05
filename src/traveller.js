import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRAVELLER_PALETTE as PAL, TRAVELLER_TONES } from './traveller-style.js';
import { scalp, skullPoint } from './costumes.js';

// The traveller: the people's own body (humanoid.js, Quaternius' human, the
// one every NPC uses) in its own proportions and stance, dressed on top.
//
//   the suit     painted on the body by the outfit shader (MODE_OUTFIT: suit,
//                gloves, boots by body region; creases.js draws the folds), on
//                a copy of the body made baggy: every vertex stands off along
//                its (welded) normal, most on the legs, gathered at the ankles
//                and wrists, none at the head, hands and feet (suitGeometry)
//   the gear     the rigid pieces of traveller.glb (the bubble helmet, the
//                headphones, the scarf, the radio pack with its antenna and
//                pouches, the boots), each moved once onto this body (sized
//                to its head, its neck, its back, its feet) and skinned to one
//                of its bones, the way costume pieces are (humanoid.js dress)
//   the extras   built here on the suit's surface: the glove cuffs, the belt
//                and its pouches, the pack's shoulder straps, the trouser
//                cuffs over the boots; skinned like the suit beneath them
//
// Nothing is re-bound or stretched: the skeleton, its bind pose and the body's
// weights are exactly the NPCs', so every animation, IK and pose works as it
// does on them.

/** Fit settings, in metres on the body's bind pose (the T-pose, feet at 0, facing +z). */
export const TRAVELLER = {
  // MODE_OUTFIT zones: boot top, belt, neck, wrist
  outfit: [0.2, 0.97, 1.47, 0.64],
  // the baggy suit: how far it stands off the body
  swell: { torso: 0.06, arm: 0.052, forearm: 0.03, clavicle: 0.045, leg: 0.085, hand: 0.008 },
  helmet: 0.82,          // the bubble's scale (traveller.glb drew it round a cartoon's head)
  lift: 0.012,           // the bubble's centre above the head's
  earGap: 0.006,         // between the head and the headphones' cups
  scarf: [1.12, 0.8],    // the scarf round the neck, scaled from the glb's (across, up): on the shoulders, under the chin
  backGap: 0.008,
  antenna: 2.6,          // the pack's antenna, drawn out from the glb's        // between the suit's back and the pack's front
  boot: { margin: 0.014, sole: -0.012 },   // room round the foot; the sole's bottom (the foot's own pokes 1 cm under 0)
  // his own face (morph.js FACE_MORPHS, Humanoid.setFace): about twenty-six, so younger and warmer than the
  // people's modelled face (gaunt, long, hollow-cheeked): fuller cheeks, a shorter lower face and nose, a
  // softer brow and jaw, larger eyes, hardly a line on it, a few freckles
  face: { cheeks: 1, faceLength: 0.9, noseLength: 0.72, noseWidth: 0.94, jaw: 1.1, chin: -0.5, browRidge: -1, eyeSize: 1.15, eyeHeight: 0.15,
    lines: 0.1, lidWeight: 0.9, mouthWidth: 0.96, freckles: 0.35 },
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
    // the sleeves gather into the glove cuffs, the trousers into the boots
    const sleeve = 1 - smooth(ax, wristX - 0.15, wristX - 0.025);
    const trouser = smooth(y, bootTop - 0.01, bootTop + 0.17);
    // the legs' inner sides stand off less, so the trousers don't fuse between the knees
    const inner = THREE.MathUtils.clamp(-n.x * Math.sign(x || 1), 0, 1) * (1 - smooth(y, 0.8, 0.95));
    const d = (S.torso * w.torso + S.clavicle * w.clavicle) * collar + (S.arm * w.arm + S.forearm * w.forearm) * sleeve + S.leg * w.leg * trouser * (1 - 0.65 * inner) + S.hand * w.hand;   // (the gloves a little thicker than hands)
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
    const arr = new a.array.constructor(order.length * a.itemSize);
    order.forEach((v, i) => { for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.array[v * a.itemSize + c]; });
    g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
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
 * The traveller's hair (head frame): a short cut on the skull (costumes.js scalp) and a fringe of
 * flat locks falling over the brow from under the helmet's liner, each a little longer or shorter.
 */
export function travellerHair() {
  const parts = [scalp(1, { kind: 'm', t: 0.007, front: 24, side: -18, back: -40, crown: 0.004, quiff: 0.004, jag: 2.5 })];
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
  const ear = new THREE.Vector3(0, headC.y + 0.005, headC.z - 0.015);
  const earX = Math.max(...headPts.filter((p) => Math.abs(p.y - ear.y) < 0.03 && Math.abs(p.z - ear.z) < 0.04).map((p) => Math.abs(p.x)));
  const Head = bi('Head');
  // the bubble: centred on the head (the face inside it), the glb's cut at the neck
  const bubble = glb.get('Bubble_helmet');
  bubble.geometry.computeBoundingBox();
  const bubbleC = bubble.geometry.boundingBox.getCenter(new THREE.Vector3());
  const helmetM = new THREE.Matrix4().makeTranslation(headC.x, headC.y + F.lift, headC.z + 0.012)
    .multiply(new THREE.Matrix4().makeScale(F.helmet, F.helmet, F.helmet)).multiply(new THREE.Matrix4().makeTranslation(-bubbleC.x, -bubbleC.y, -bubbleC.z));
  const glass = rigid(glbGeo('Bubble_helmet', helmetM), Head);
  glass.computeBoundingBox();
  add('Bubble_helmet', glass, '#' + bubble.material.color.getHexString(), { glass: glass.boundingBox.getCenter(new THREE.Vector3()) });
  // the headphones: their cups just off the ears, the band over the top
  const cups = glb.get('Headphone_1');
  cups.geometry.computeBoundingBox();
  const cupBox = cups.geometry.boundingBox, cupC = cupBox.getCenter(new THREE.Vector3());
  const ps = (earX + F.earGap) / cupBox.min.x;
  const phonesM = new THREE.Matrix4().makeTranslation(0, ear.y, ear.z).multiply(new THREE.Matrix4().makeScale(ps, ps, ps)).multiply(new THREE.Matrix4().makeTranslation(0, -cupC.y, -cupC.z));
  for (const n of ['Headphone_1', 'Headphone_-1', 'Blue_headphone_band']) add(n, rigid(glbGeo(n, phonesM), Head), toneOf(glb.get(n)));
  // a grey liner over the back of the skull, as under the glb's helmet (the head anchor's frame), the brow bare
  const anchorHead = new THREE.Vector3(0, bindPos(body, 'Head').y + 0.1, bindPos(body, 'Head').z + 0.01);
  const anchorM = new THREE.Matrix4().makeTranslation(anchorHead.x, anchorHead.y, anchorHead.z);
  const liner = new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58).scale(1, 1.08, 1.12).rotateX(-0.32).translate(0, 0.012, -0.012)
    .rotateX(-0.75).translate(0, -0.01, 0.004);
  add('Helmet_liner', rigid(plain(liner, anchorM), Head), PAL.liner);
  // his own hair under it: short, a tousled fringe over the brow, the sideburns in front of the headphones
  add('Traveller_hair', rigid(plain(travellerHair(), anchorM), Head), PAL.hair);

  // ---- the scarf round the neck, on the chest (the head turns inside it)
  const neck = bindPos(body, 'neck_01'), chest = bi('spine_03');
  const neckPts = points(suit, (p) => Math.abs(p.y - (neck.y + 0.02)) < 0.03 && Math.abs(p.x) < 0.13);
  const neckZ = neckPts.length ? (Math.min(...neckPts.map((p) => p.z)) + Math.max(...neckPts.map((p) => p.z))) / 2 : neck.z;
  const scarfSrc = glb.get('Scarf_fold');
  scarfSrc.geometry.computeBoundingBox();
  const scarfBox = scarfSrc.geometry.boundingBox.clone().union(glb.get('Scarf_fold001')?.geometry.boundingBox ?? scarfSrc.geometry.boundingBox);
  const scarfC = scarfBox.getCenter(new THREE.Vector3());
  const scarfM = new THREE.Matrix4().makeTranslation(0, neck.y - 0.075, neckZ).multiply(new THREE.Matrix4().makeScale(F.scarf[0], F.scarf[1], F.scarf[0]))
    .multiply(new THREE.Matrix4().makeTranslation(-scarfC.x, -scarfBox.min.y, -scarfC.z));
  for (const n of ['Scarf_fold', 'Scarf_fold001']) if (glb.get(n)) add(n, rigid(glbGeo(n, scarfM), chest), toneOf(glb.get(n)));

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
  for (const n of ['Equipment_tan_pouches', 'Backpack_antenna_base']) add(n, rigid(glbGeo(n, packM), chest), toneOf(glb.get(n)));
  // the whip antenna, drawn out long and thin over the helmet as on the reference sheet
  const whip = glb.get('Backpack_antenna');
  whip.geometry.computeBoundingBox();
  const wb = whip.geometry.boundingBox, wc = wb.getCenter(new THREE.Vector3());
  add('Backpack_antenna', rigid(glbGeo('Backpack_antenna', packM.clone().multiply(new THREE.Matrix4().makeTranslation(wc.x, wb.min.y, wc.z))
    .multiply(new THREE.Matrix4().makeScale(0.6, F.antenna, 0.6)).multiply(new THREE.Matrix4().makeTranslation(-wc.x, -wb.min.y, -wc.z))), chest), PAL.dark);
  // the scout's place: the point on the radio's flat top its foot rests on, towards the back (clear of the helmet)
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

  // ---- the belt on the hips, and its pouches
  const hips = points(suit, (p) => Math.abs(p.y - beltY) < 0.03 && Math.abs(p.x) < 0.3);
  const hc = boxOf(hips).getCenter(new THREE.Vector3());
  const N = 28, ring = (y, out) => Array.from({ length: N }, (_, k) => {
    const a = (k / N) * Math.PI * 2, d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const from = new THREE.Vector3(hc.x, y, hc.z);
    return from.addScaledVector(d, reach(hips, from, d, 0.03) + out);
  });
  const beltRows = [ring(beltY - 0.028, 0.008), ring(beltY + 0.028, 0.008)];
  const beltIn = [ring(beltY + 0.028, 0.0), ring(beltY - 0.028, 0.0)];
  const beltGeo = mergeGeometries([band(beltRows), band([beltRows[1], beltIn[0]]), band([beltIn[1], beltRows[0]])]);
  add('Belt', conform(beltGeo, suit, body, /^(pelvis|spine_01)$/, bi('pelvis')), PAL.strap);
  for (const [a, w, h] of [[0.75, 0.1, 0.11], [1.25, 0.12, 0.13], [-0.85, 0.11, 0.12], [-1.4, 0.1, 0.1], [2.5, 0.12, 0.1]]) {
    const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), from = new THREE.Vector3(hc.x, beltY, hc.z);
    const at = from.clone().addScaledVector(d, reach(hips, from, d, 0.03) + 0.008);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    const g = mergeGeometries([
      plain(new THREE.BoxGeometry(w, h, 0.05).translate(0, -0.035, 0.025)),
      plain(new THREE.BoxGeometry(w + 0.008, 0.035, 0.058).translate(0, 0.012, 0.025)),   // the flap
    ]).applyMatrix4(new THREE.Matrix4().compose(at, q, new THREE.Vector3(1, 1, 1)));
    add(`Pouch_${a}`, conform(g, suit, body, /^(pelvis|spine_01)$/, bi('pelvis'), at), PAL.pouch);
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
    // the trouser cuff gathered over the boot's top
    const legAxis = (y) => { const c = bindPos(body, `calf_${s}`), f = bindPos(body, `foot_${s}`); return f.clone().lerp(c, (y - f.y) / (c.y - f.y)); };
    const bootTopY = F.boot.sole + bs.y;
    const shaft = points(plain(pick(parts[0][1].geometry, side(parts[0][1])(parts[0][1].geometry)), bootM), () => true);
    const legPts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^(calf|thigh|foot)_${s}$`))));
    const cuff = (y, out) => { const c = legAxis(y); return Array.from({ length: 20 }, (_, k) => {
      const a = (k / 20) * Math.PI * 2, d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const r = Math.max(reach(legPts, c, d, 0.03), reach(shaft.filter((p) => Math.abs(p.y - bootTopY) < 0.05), c.clone().setY(bootTopY - 0.02), d, 0.04));
      return c.clone().addScaledVector(d, r + out + 0.012 * Math.sin(a * 7) ** 2);
    }); };
    const y0 = bootTopY - 0.035, y1 = bootTopY + 0.03;
    add(`Trouser_cuff_${s}`, rigid(mergeGeometries([band([cuff(y0, 0.006), cuff(y1, 0.004)]), band([cuff(y1, 0.004), cuff(y1, -0.01)])]), calfB), PAL.suit);
    // the glove's cuff: a short flared gauntlet over the sleeve's end
    const arm = bindPos(body, `lowerarm_${s}`), hand = bindPos(body, `hand_${s}`), along = hand.clone().sub(arm).normalize();
    const armPts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^lowerarm_${s}|^hand_${s}$`), 0.3)));
    const axisAt = (x) => arm.clone().lerp(hand, (x - arm.x) / (hand.x - arm.x));
    const gauntlet = (x, out) => { const c = axisAt(x); return Array.from({ length: 18 }, (_, k) => {
      const a = (k / 18) * Math.PI * 2, d = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      return c.clone().addScaledVector(d, reach(armPts, c, d, 0.02) + out);
    }); };
    const g0 = sign * (wristX - 0.075), g1 = sign * (wristX + 0.008);
    add(`Glove_cuff_${s}`, rigid(mergeGeometries([band([gauntlet(g0, 0.016), gauntlet(g1, 0.006)]), band([gauntlet(g1, 0.006), gauntlet(g1, -0.004)]), band([gauntlet(g0, 0.0), gauntlet(g0, 0.016)])]), bi(`lowerarm_${s}`)), PAL.glove);
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
