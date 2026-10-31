import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { materials, add, many, pivot, finish, plate, outerPoints } from './kit.js';
import { gazePart } from '../gaze.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { WOODCUTTER, WOODCUTTER_ID, WOODCUTTER_OWN, WOODCUTTER_PLAN, WOODCUTTER_TOOLS, woodcutterMotion, sawDisc } from './woodcutter.js';

// The wood cutter's body (issue #800: the author's pick of the trials, its own enemy `woodcutter` beside the furnace
// brute): Tripo task 32ba0f6c-… from the approved image (references/enemy-redesign-2026-10-30/keep-brute/, the untouched
// export in its tripo/), made into the game's asset by the trial's prepare.mjs (references/enemy-redesign-2026-10-30/trials/
// woodcutter-tripo/: the game's frame, 2.4 m, the texture repainted by part in the reference's flat colours and sampled
// into the vertex colours, about 11k triangles cut into parts by geometry, Tripo's saw hand dropped; public/foes/
// woodcutter/, loaded by src/enemies/foe-assets.js) and put on the brute's rig family here: the motion kit's brute plan
// for its legs (fitted to the mesh's own: landmarks.json), the direct wood cutter's arm pivots and its motion
// (woodcutter.js woodcutterMotion: the poses, the ground contact and the attacks), its def (woodcutterDef, in
// src/enemies/archetypes.js). Its direct body (woodcutter.js woodcutterModel) stands in only while the source loads.
//
// A machine's rig, not a skinned humanoid: every triangle whole in one rigid part (each vertex weighted 1 to one joint):
// the hull, the head, each arm's upper arm and forearm (the clamp arm's hand), each leg's thigh, shin and boot (bones
// framed in the leg's bend plane, src/characters/creature-legs.js SkinLegs). Tripo stood the saw arm's forearm forward
// and level; its pivots are bound in that pose, so the shared motion's hanging rest lowers it. The head is the dome
// itself and turns about its own sphere's centre (src/enemies/gaze.js, #508): it looks at you, and turning it opens no
// gap at the collar. The two pauldrons are cut out as the armour that falls (#722; a dark ball joint under each), the
// breastplate copied off the chest a little proud; a slit in the visor's groove (orange as it winds up) and a glow over
// the vent (its weak point).
//
// Its tools and joints are the model's own parts, in the same skinned mesh (no draws more): each world's tool on the
// saw arm's wrist (Lorn II's toothed rust disc on its clamp, the disc on its own joint that spins; Viridel's shears;
// elsewhere a clamp hand, the left one's mirrored, with the Moon Foundry's ladle in it), and a dark ball inside each
// joint (prepare.mjs cuts in Tripo's own bands and creases), so a bent joint shows no inside. Their colours: on the home skin a swatch of the flat texture each (landmarks.swatches), on the
// other skins their palette's, as vertex colours.

const _v = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(...a);
/** The asset's parts (prepare.mjs writes its triangles grouped in this order: landmarks.parts [first, count]). */
export const PARTS = ['hull', 'head', 'upper0', 'fore0', 'upper1', 'fore1', 'hand1', 'thigh0', 'shin0', 'foot0', 'thigh1', 'shin1', 'foot1', 'pauldron0', 'pauldron1'];
const PI = Object.fromEntries(PARTS.map((p, i) => [p, i]));
/** The skeleton's bones, in order; the asset's part each takes (the fist of the saw arm and its disc carry the tool). */
export const BONES = ['hull', 'head', 'upper0', 'fore0', 'fist0', 'saw', 'upper1', 'fore1', 'hand1', 'thigh0', 'shin0', 'foot0', 'thigh1', 'shin1', 'foot1'];
const BI = Object.fromEntries(BONES.map((p, i) => [p, i]));
/** The limbs' cuts blended across (prepare.mjs landmarks.cuts): [cut, the part before it, the part past it]. */
const JOINTS = [['elbow0', 'upper0', 'fore0'], ['elbow1', 'upper1', 'fore1'], ['wrist1', 'fore1', 'hand1'], ['hip0', 'hull', 'thigh0'], ['knee0', 'thigh0', 'shin0'], ['ankle0', 'shin0', 'foot0'], ['hip1', 'hull', 'thigh1'], ['knee1', 'thigh1', 'shin1'], ['ankle1', 'shin1', 'foot1']];
/** How far either side of a cut its vertices are blended (m). */
export const BLEND = 0.09;

/** A hex colour's own 0–1 channels (the vertex colours are the texture's printed values: no colour-space conversion). */
const raw = (hex) => { const h = parseInt(hex.slice(1), 16); return new THREE.Color((h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255); };

const CACHE = new WeakMap();
/**
 * Each triangle's part (from the asset's ranges) and each vertex's colour role (the nearest of the palette's), worked out
 * once a source: every wood cutter shares it.
 */
export function partsOf(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.rig ?? src.landmarks, C = geo.attributes.color, n = C.count, tri = new Uint8Array(geo.index.count / 3);
  for (const [name, [first, count]] of Object.entries(L.parts)) tri.fill(PI[name], first, first + count);
  smoothCreases(geo, tri);
  const keys = Object.keys(L.palette), ref = keys.map((k) => raw(L.palette[k])), role = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const r = C.getX(i), g = C.getY(i), b = C.getZ(i); let best = 0, d = Infinity; ref.forEach((c, k) => { const e = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2; if (e < d) { d = e; best = k; } }); role[i] = best; }
  const out = { tri, role, keys, A: L.arms.map((a) => ({ sh: vec(a.shoulder), el: vec(a.elbow), wr: vec(a.wrist), end: vec(a.end), tool: a.tool })),
    G: L.legs.map((l) => ({ hip: vec(l.hip), knee: vec(l.knee), ankle: vec(l.ankle), foot: vec(l.foot) })), hc: vec(L.head.centre), sawN: vec(L.saw.normal).normalize() };
  CACHE.set(src.geometry, out);
  return out;
}

/** The parts whose creases are smoothed (#800: Tripo's folds on the boots and the legs drew dark strokes), and the barrel's under it. */
const SMOOTH = ['thigh0', 'shin0', 'foot0', 'thigh1', 'shin1', 'foot1'], UNDER = 1.05;
/**
 * Tripo's own dark creases on the boots, the legs and under the barrel (folds of its geometry the ink and the light drew
 * as black strokes and shade), smoothed away once a source: those parts' vertices (welded by place, so a cut's two sides
 * move as one) relaxed by a Taubin smoothing that keeps their volume, the region's rim, the soles and the cuts' planes
 * held, then their normals made smooth across the welds. In place on the source's arrays.
 */
export function smoothCreases(geo, tri, { steps = 6, lambda = 0.55, mu = -0.58 } = {}) {
  const P = geo.attributes.position, N = geo.attributes.normal, I = geo.index.array, n = P.count;
  const sel = new Uint8Array(tri.length), want = new Set(SMOOTH.map((x) => PI[x]));
  for (let t = 0; t < tri.length; t++) {
    if (want.has(tri[t])) sel[t] = 1;
    else if (tri[t] === PI.hull && [0, 1, 2].every((k) => P.getY(I[t * 3 + k]) < UNDER)) sel[t] = 1;
  }
  // (welded: one group a place)
  const key = (i) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`, ids = new Map(), group = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = key(i); if (!ids.has(k)) ids.set(k, ids.size); group[i] = ids.get(k); }
  const G = ids.size, inSel = new Uint8Array(G), outSel = new Uint8Array(G), nb = Array.from({ length: G }, () => new Set());
  for (let t = 0; t < tri.length; t++) {
    const g3 = [0, 1, 2].map((k) => group[I[t * 3 + k]]);
    for (const a of g3) (sel[t] ? inSel : outSel)[a] = 1;
    if (sel[t]) for (const a of g3) for (const b of g3) if (a !== b) nb[a].add(b);
  }
  const pos = new Float64Array(G * 3), held = new Uint8Array(G);
  for (let i = 0; i < n; i++) { const g = group[i]; pos[g * 3] = P.getX(i); pos[g * 3 + 1] = P.getY(i); pos[g * 3 + 2] = P.getZ(i); }
  for (let g = 0; g < G; g++) held[g] = !inSel[g] || outSel[g] || pos[g * 3 + 1] < 0.03 ? 1 : 0;
  const tmp = new Float64Array(G * 3);
  for (let s = 0; s < steps * 2; s++) {
    const f = s % 2 ? mu : lambda;
    for (let g = 0; g < G; g++) {
      if (held[g] || !nb[g].size) { tmp.set(pos.subarray(g * 3, g * 3 + 3), g * 3); continue; }
      let x = 0, y = 0, z = 0; for (const b of nb[g]) { x += pos[b * 3]; y += pos[b * 3 + 1]; z += pos[b * 3 + 2]; }
      const k = nb[g].size;
      tmp[g * 3] = pos[g * 3] + f * (x / k - pos[g * 3]); tmp[g * 3 + 1] = pos[g * 3 + 1] + f * (y / k - pos[g * 3 + 1]); tmp[g * 3 + 2] = pos[g * 3 + 2] + f * (z / k - pos[g * 3 + 2]);
    }
    pos.set(tmp);
  }
  for (let i = 0; i < n; i++) { const g = group[i]; if (inSel[g]) P.setXYZ(i, pos[g * 3], pos[g * 3 + 1], pos[g * 3 + 2]); }
  // the normals: each welded place's, the area-weighted sum of its selected faces'
  const nor = new Float64Array(G * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tri.length; t++) {
    if (!sel[t]) continue;
    a.fromBufferAttribute(P, I[t * 3]); b.fromBufferAttribute(P, I[t * 3 + 1]); c.fromBufferAttribute(P, I[t * 3 + 2]);
    c.sub(b); b.sub(a); b.cross(c);   // (twice the face's area along its normal)
    for (let k = 0; k < 3; k++) { const g = group[I[t * 3 + k]]; nor[g * 3] += b.x; nor[g * 3 + 1] += b.y; nor[g * 3 + 2] += b.z; }
  }
  for (let i = 0; i < n; i++) { const g = group[i]; if (!inSel[g] || outSel[g]) continue; a.set(nor[g * 3], nor[g * 3 + 1], nor[g * 3 + 2]); if (a.lengthSq() > 0) { a.normalize(); N.setXYZ(i, a.x, a.y, a.z); } }
  P.needsUpdate = N.needsUpdate = true;
}

/** One part's triangles, their corners copied (non-indexed): position, normal, uv, colour (recoloured or kept). */
function partGeo(src, prep, ids, colour) {
  const geo = src.geometry, I = geo.index.array, pos = [], nor = [], uv = [], col = [], part = [];
  const PP = geo.attributes.position, NN = geo.attributes.normal, UU = geo.attributes.uv, CC = colour ?? geo.attributes.color;
  for (let t = 0; t < prep.tri.length; t++) {
    if (!ids.includes(prep.tri[t])) continue;
    for (let k = 0; k < 3; k++) { const i = I[t * 3 + k]; pos.push(PP.getX(i), PP.getY(i), PP.getZ(i)); nor.push(NN.getX(i), NN.getY(i), NN.getZ(i)); uv.push(UU.getX(i), UU.getY(i)); col.push(CC.getX(i), CC.getY(i), CC.getZ(i)); part.push(prep.tri[t]); }
  }
  return { pos, nor, uv, col, part };
}

/** A skin's colours over the mesh's roles (a world's own look on the same body). */
function skinColours(geo, prep, want) {
  const n = geo.attributes.position.count, out = new Float32Array(n * 3), cols = prep.keys.map((k) => raw(want[k]));
  for (let i = 0; i < n; i++) { const c = cols[prep.role[i]]; out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  return new THREE.BufferAttribute(out, 3);
}

/** The wood cutter's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js foeSource). */
export function tripoWoodcutterModel(skin, src) {
  const L = src.rig ?? src.landmarks, home = skin.id === 'perdide2', props = new Set(skin.props);
  const P = { ...skin.palette, ...(home ? WOODCUTTER_OWN.perdide2 : {}) };
  P.visor ??= P.dark; P.head ??= P.body2; P.band ??= P.brass; P.clamp ??= P.joint;
  const M = materials('brute', skin), prep = partsOf(src), hipY = WOODCUTTER.hipY;
  const g = new THREE.Group(); g.name = `${skin.name} · wood cutter (Tripo)`;
  const body = pivot(g, 0, 0, 0, 'body');
  const hullTurn = pivot(body, 0, hipY, 0, 'hull'), hull = pivot(hullTurn, 0, -hipY, 0, 'hull frame');
  // ---------------------------------------------------------------- the arms' pivots, bound in Tripo's pose
  const down = new THREE.Vector3(0, -1, 0), qW = new THREE.Quaternion();
  const arms = prep.A.map((a, k) => {
    const s = k ? 1 : -1;
    const sh = pivot(hull, ...a.sh.toArray(), 'shoulder');
    const upper = a.el.clone().sub(a.sh), fore = a.wr.clone().sub(a.el), tool = a.end.clone().sub(a.wr);
    const el = pivot(sh, 0, -upper.length(), 0, 'elbow'), fist = pivot(el, 0, -fore.length(), 0, 'fist');
    // (the rest: each pivot turned so its −y runs down its segment as Tripo posed it)
    const qs = new THREE.Quaternion().setFromUnitVectors(down, upper.clone().normalize());
    const qe = qs.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(down, fore.clone().normalize()));
    const qf = qs.clone().multiply(qe).invert().multiply(new THREE.Quaternion().setFromUnitVectors(down, tool.clone().normalize()));
    sh.quaternion.copy(qs); el.quaternion.copy(qe); fist.quaternion.copy(qf);
    let saw = null;
    if (k === 0) {
      // (the disc's joint: a frame at Tripo's disc centre, its x along the disc's normal; the disc turns about it)
      g.updateMatrixWorld(true);
      const frame = new THREE.Object3D(); frame.name = 'saw frame'; fist.add(frame);
      frame.position.copy(fist.worldToLocal(a.end.clone()));
      fist.getWorldQuaternion(qW);
      frame.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), prep.sawN.clone().applyQuaternion(qW.clone().invert()));
      saw = new THREE.Bone(); saw.name = 'saw'; frame.add(saw);
    }
    return { sh, el, fist, hand: null, reach: null, saw, s };
  });
  // the head: it turns about its dome's centre (the gaze), the head's own part a joint under it
  const headPivot = pivot(hull, ...prep.hc.toArray(), 'head');
  const headBone = pivot(headPivot, 0, 0, 0, 'head part');
  // ---------------------------------------------------------------- the kit's legs on the mesh's own (SkinLegs), segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = prep.G.map((l, k) => {
    const leg = planLeg(WOODCUTTER_PLAN, { group: g, body, hipParent: hull, hip: { x: l.hip.x, y: l.hip.y, z: l.hip.z }, foot: { x: l.foot.x, z: l.foot.z }, lenA: l.hip.distanceTo(l.knee), lenB: l.knee.distanceTo(l.ankle), ankle: l.ankle.y, radius: 0.02, mats: { joint: hide }, name: `wood cutter leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: WOODCUTTER_PLAN, group: g, body, legs });
  const legBones = legs.map((leg, k) => {
    const l = prep.G[k];
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); return b; };
    return { thigh: mk('thigh', l.hip, l.knee.clone().sub(l.hip)), shin: mk('shin', l.knee, l.ankle.clone().sub(l.knee)), foot: mk('foot', l.ankle.clone().setY(l.ankle.y - leg.ankle), null) };
  });
  legs.forEach((leg, k) => { const l = prep.G[k]; leg.root.position.copy(l.hip); leg.shin.position.copy(l.knee.clone().sub(l.hip)); leg.foot.position.copy(l.ankle.clone().sub(l.hip)).setY(l.ankle.y - leg.ankle - l.hip.y); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.assign({}, ...legBones.map((b, k) => ({ [`leg${k}_thigh`]: b.thigh, [`leg${k}_shin`]: b.shin, [`leg${k}_foot`]: b.foot }))), group: g, body: hullTurn });
  const bones = [hull, headBone, arms[0].sh, arms[0].el, arms[0].fist, arms[0].saw, arms[1].sh, arms[1].el, arms[1].fist, ...legBones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  g.updateMatrixWorld(true);
  // ---------------------------------------------------------------- the mesh: the asset's parts, then the model's own (tools, bands, balls)
  const want = { body: P.body, dark: P.joint ?? P.dark, band: P.band, vent: P.brass, head: P.head, visor: P.visor };
  const colour = home ? null : skinColours(src.geometry, prep, want);
  const boneOfPart = (p) => BI[PARTS[p]];
  const S = partGeo(src, prep, PARTS.map((_, i) => i).filter((i) => i < PI.pauldron0), colour);
  const skinI = S.part.map(boneOfPart);
  const ownCol = { saw: P.saw ?? P.joint, clamp: P.clamp, brass: P.brass, dark: P.joint ?? P.dark, band: P.band, body: P.body, blade: P.blade ?? '#cfd4d8', iron: P.dark };
  /** One of the model's own parts: `geo` in `obj`'s frame, on bone `bone`, in colour role `key` (a swatch at home). */
  const own = (geo, obj, bone, key) => {
    const gg = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(obj.matrixWorld);
    if (!gg.attributes.normal) gg.computeVertexNormals();
    const p = gg.attributes.position, nn = gg.attributes.normal, uv = L.swatches[key] ?? L.swatches.dark, c = home && L.swatches[key] ? raw(L.swatchColours[key]) : raw(ownCol[key]);
    for (let i = 0; i < p.count; i++) { S.pos.push(p.getX(i), p.getY(i), p.getZ(i)); S.nor.push(nn.getX(i), nn.getY(i), nn.getZ(i)); S.uv.push(uv[0], uv[1]); S.col.push(c.r, c.g, c.b); skinI.push(BI[bone]); }
    gg.dispose(); if (gg !== geo) geo.dispose();
  };
  // the saw arm's tool, at its wrist
  const fist0 = arms[0].fist, hub = fist0.worldToLocal(prep.A[0].end.clone());
  /** A box from a to b (fist frame), w × d across. */
  const strut = (a, b, w, d) => { const len = a.distanceTo(b); const geo = new THREE.BoxGeometry(w, len, d); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); return geo.translate(...a.clone().add(b).multiplyScalar(0.5).toArray()); };
  const wristCap = (key) => own(new THREE.CylinderGeometry(L.cuts.wrist0.r * 0.95, L.cuts.wrist0.r * 0.95, 0.12, 16).translate(0, -0.03, 0), fist0, 'fist0', key);
  if (props.has('saw')) {
    // the reference's: a rust clamp round the wrist, a bracket out to the disc's hub, the toothed disc (it spins)
    wristCap('band');
    own(new THREE.BoxGeometry(0.26, 0.16, 0.26).translate(0, -0.12, 0), fist0, 'fist0', 'clamp');
    own(strut(new THREE.Vector3(0, -0.14, 0), hub, 0.16, 0.12), fist0, 'fist0', 'clamp');
    own(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 18).rotateZ(Math.PI / 2), arms[0].saw, 'fist0', 'clamp');
    own(sawDisc(L.saw.r, 0.04, 12), arms[0].saw, 'saw', 'saw');
    own(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 10).rotateZ(Math.PI / 2), arms[0].saw, 'saw', 'brass');
  } else if (props.has('shears')) {
    wristCap('dark');
    const T = WOODCUTTER_TOOLS.shears(); for (const b of T.blades) own(b, fist0, 'fist0', 'blade'); own(T.pin, fist0, 'fist0', 'brass');
  } else {
    // a clamp hand: the left one's (Tripo's), mirrored across the body onto the right wrist and turned from the mirrored
    // left forearm's line onto the right's (#800: mirrored in the fists' own frames it took the left hand's twist, its
    // fingers turned back and in; now its palm faces in and its fingers curl forward, as the left one's do)
    const H = partGeo(src, prep, [PI.hand1], colour), [R0, L1] = prep.A, mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
    const wristL = L1.wr.clone().setX(-L1.wr.x), dirL = L1.wr.clone().sub(L1.el).setX(-(L1.wr.x - L1.el.x)).normalize(), dirR = R0.wr.clone().sub(R0.el).normalize();
    const turn = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(dirL, dirR));
    const toRight = new THREE.Matrix4().makeTranslation(R0.wr.x, R0.wr.y, R0.wr.z).multiply(turn).multiply(new THREE.Matrix4().makeTranslation(-wristL.x, -wristL.y, -wristL.z)).multiply(mirror), nm = new THREE.Matrix3().getNormalMatrix(toRight);
    for (let t = 0; t < H.part.length; t += 3) for (const k of [0, 2, 1]) {   // (mirrored: each triangle's winding turned)
      const i = t + k; _v.set(H.pos[i * 3], H.pos[i * 3 + 1], H.pos[i * 3 + 2]).applyMatrix4(toRight); S.pos.push(_v.x, _v.y, _v.z);
      _v.set(H.nor[i * 3], H.nor[i * 3 + 1], H.nor[i * 3 + 2]).applyMatrix3(nm).normalize(); S.nor.push(_v.x, _v.y, _v.z);
      S.uv.push(H.uv[i * 2], H.uv[i * 2 + 1]); S.col.push(H.col[i * 3], H.col[i * 3 + 1], H.col[i * 3 + 2]); skinI.push(BI.fist0);
    }
    if (props.has('ladle')) { const T = WOODCUTTER_TOOLS.ladle(); const lad = pivot(fist0, 0, -0.2, 0.08, 'ladle'); g.updateMatrixWorld(true); for (const x of T.iron) own(x, lad, 'fist0', 'iron'); T.melt.dispose(); }
  }
  // a dark ball inside each joint, on the part before it (the cuts lie in Tripo's own bands and creases: at rest the
  // ball is hidden in the limb; as the joint bends, it fills what opens)
  const BALL = { elbow0: 'upper0', elbow1: 'upper1', wrist1: 'fore1', knee0: 'thigh0', ankle0: 'shin0', knee1: 'thigh1', ankle1: 'shin1' };
  for (const [name, parent] of Object.entries(BALL)) { const c = L.cuts[name]; if (c) own(new THREE.SphereGeometry(c.inner * 0.8, 10, 7).translate(...c.at), g, parent, 'dark'); }
  // (inside the collar, under the dome: dark, should a turn of the head ever show past its rim)
  own(new THREE.SphereGeometry(L.head.r * 0.75, 12, 8).translate(...L.head.centre), g, 'hull', 'dark');
  const skinGeo = new THREE.BufferGeometry();
  skinGeo.setAttribute('position', new THREE.Float32BufferAttribute(S.pos, 3)); skinGeo.setAttribute('normal', new THREE.Float32BufferAttribute(S.nor, 3)); skinGeo.setAttribute('uv', new THREE.Float32BufferAttribute(S.uv, 2)); skinGeo.setAttribute('color', new THREE.Float32BufferAttribute(S.col, 3));
  const n = skinI.length, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { SI[i * 4] = skinI[i]; SW[i * 4] = 1; }
  // (across each cut of a limb, the asset's vertices blended between its two bones over BLEND m either side of the
  //  plane: the same weights for the corners either part has there, so the joint bends without opening; the model's
  //  own parts, the head and the pauldrons stay rigid)
  const pos = skinGeo.attributes.position;
  for (let i = 0; i < S.part.length; i++) {
    const own0 = skinI[i];
    for (const [cut, parent, child] of JOINTS) {
      if (own0 !== BI[parent] && own0 !== BI[child]) continue;
      const c = L.cuts[cut]; if (!c) continue;
      const s = (pos.getX(i) - c.at[0]) * c.n[0] + (pos.getY(i) - c.at[1]) * c.n[1] + (pos.getZ(i) - c.at[2]) * c.n[2];
      if (Math.abs(s) >= BLEND || _v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).distanceTo(vec(c.at)) > c.r + 0.15) continue;
      const w = THREE.MathUtils.smoothstep(s, -BLEND, BLEND);
      SI[i * 4] = BI[child]; SW[i * 4] = w; SI[i * 4 + 1] = BI[parent]; SW[i * 4 + 1] = 1 - w;
      if (own0 === BI[parent]) { SI[i * 4] = BI[parent]; SW[i * 4] = 1 - w; SI[i * 4 + 1] = BI[child]; SW[i * 4 + 1] = w; }
      break;
    }
  }
  skinGeo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); skinGeo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  // (both sides drawn: a pauldron's or a plate's open edge shows its inside, not a hole)
  // (every skin in vertex colours, the home skin's the flat texture's own: src/enemies/foe-assets.js)
  const skinM = M.mat('wcTripo', '#ffffff', { side: THREE.DoubleSide, vertexColors: true });
  const sm = new THREE.SkinnedMesh(skinGeo, skinM); sm.name = 'tripo skin'; sm.frustumCulled = false; g.add(sm);
  // the armour: the pauldrons cut out (on their shoulders), the breastplate copied off the chest, a little proud
  const plateM = M.mat('wcTripoPlate', '#ffffff', { side: THREE.DoubleSide, vertexColors: true });
  const jointM = M.mat('wcTripoJoint', P.joint);
  const geoOf = (A) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3)); b.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3)); b.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2)); b.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3)); return b; };
  const plates = [];
  for (const k of [0, 1]) {
    const pg = geoOf(partGeo(src, prep, [PI[`pauldron${k}`]], colour));
    pg.applyMatrix4(arms[k].sh.matrixWorld.clone().invert());
    plates.push(plate(arms[k].sh, pg, plateM, 0, 0, 0, `pauldron ${k ? 'left' : 'right'}`));
    add(arms[k].sh, new THREE.SphereGeometry(0.2, 12, 8), jointM, 0, -0.02, 0);   // (the ball joint the pauldron covers)
  }
  {
    const hg = geoOf(partGeo(src, prep, [PI.hull], colour)), HP = hg.attributes.position, HN = hg.attributes.normal, keep = [];
    for (let t = 0; t < HP.count; t += 3) { let ok = true; for (let q = 0; q < 3; q++) { const x = HP.getX(t + q), y = HP.getY(t + q), z = HP.getZ(t + q); if (!(y > L.chestY[0] && y < L.chestY[1] && z > 0.12 && Math.abs(x) < 0.45 && HN.getZ(t + q) > 0.3)) ok = false; } if (ok) keep.push(t); }
    const bp = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv', 'color']) { const src2 = hg.attributes[name], arr = []; for (const t of keep) for (let q = 0; q < 3; q++) for (let c = 0; c < src2.itemSize; c++) arr.push(src2.array[(t + q) * src2.itemSize + c] + (name === 'position' ? HN.array[(t + q) * 3 + c] * 0.008 : 0)); bp.setAttribute(name, new THREE.Float32BufferAttribute(arr, src2.itemSize)); }
    plates.splice(1, 0, plate(hull, bp, plateM, 0, 0, 0, 'breastplate'));
    hg.dispose();
  }
  // the visor's slit in its groove (its own material: it goes orange as it winds up), the vent's glow
  const eyeM = M.own('visor', P.visor, { glow: 0.2 }), coreM = M.own('core', P.core ?? '#f0b54a', { glow: 0.3 });
  {
    const V = L.visor, at = vec(V.at), nrm = at.clone().sub(prep.hc).normalize(), len = Math.min(0.24, V.size[0] * 0.6);
    const visor = add(headBone, new THREE.CapsuleGeometry(0.028, len, 3, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.45), eyeM, ...at.clone().addScaledVector(nrm, 0.006).sub(prep.hc).toArray());
    visor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm); visor.name = 'visor';
  }
  const v = L.vent, core = add(hull, new THREE.PlaneGeometry(0.24, 0.2), coreM, v[0], v[1], v[2] + 0.025); core.name = 'vent';
  // the other worlds' dress: the Waterfall's turbine on its chest, the Glass Dunes' furnace glow, the Moon Foundry's melt
  let fan = null;
  if (props.has('turbine')) { fan = pivot(hull, 0, 1.58, 0.56, 'turbine'); many(fan, WOODCUTTER_TOOLS.vanes(), M.mat('wcTurbine', P.brass)); }
  if (props.has('door')) add(hull, new THREE.CircleGeometry(0.11, 16), coreM, 0, 1.5, 0.565);
  if (props.has('ladle') && !props.has('saw') && !props.has('shears')) { const lad = fist0.getObjectByName('ladle'); if (lad) add(lad, WOODCUTTER_TOOLS.ladle().melt, coreM); }
  const gaze = [gazePart(g, headPivot, { mode: 'turn', yaw: 0.6, up: 0.2, down: 0.3 })];
  // the slab it hurls, in the clamp
  const slab = add(arms[1].fist, new THREE.DodecahedronGeometry(0.24, 0).scale(1.3, 0.7, 1), M.mat('slab', P.slab ?? '#8a7f70', { flat: true }), 0, -0.3, 0.12);
  slab.visible = false;
  finish(g);
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  boneBoxes(sm, bones, skinI);
  // each hand's outer points (the clamp's fingers, the saw's disc and bracket, the shears' tips) in its fist's frame, for the ground contact
  for (const [k, a] of arms.entries()) {
    const ids = k ? [BI.hand1] : [BI.fist0, BI.saw], P0 = skinGeo.attributes.position, inv = a.fist.matrixWorld.clone().invert(), pts = [];
    for (let i = 0; i < n; i++) if (ids.includes(skinI[i])) pts.push(_v.fromBufferAttribute(P0, i).applyMatrix4(inv).toArray());
    const tmp = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3))); a.fist.add(tmp);
    a.reach = outerPoints(a.fist, (o) => o === tmp); tmp.removeFromParent(); tmp.geometry.dispose();
  }
  const parts = [hullTurn, headBone, ...arms.flatMap((a) => [a.sh, a.el, a.fist]), ...legBones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  let rigid = false;
  const motion = woodcutterMotion({ g, hull: hullTurn, hullY: hipY, arms, rig, slab, coreM, eyeM, bodyM: null, P, props, saw: props.has('saw') ? arms[0].saw : null, fan, head: headPivot });
  return {
    group: g, gaze, body: hullTurn, rig, parts, eyeMat: eyeM, base: P.visor, size: skin.scale, skin: skin.id, tones: [P.body, P.brass, P.saw ?? P.joint],
    plates, weak: { obj: core, r: 0.2, name: 'vent' }, archetype: WOODCUTTER_ID, wcJoints: { arms, legs, head: headPivot, legBones },
    tell: (id) => (id === 'hurl' ? arms[1].fist : arms[0].fist),
    anim(f, c) {
      // (going down: the cuts' blends let go, each vertex all its own part's, so the parts come apart clean, not stretched)
      if (f.dying && !rigid) { rigid = true; const w = skinGeo.attributes.skinWeight, j = skinGeo.attributes.skinIndex; for (let i = 0; i < n; i++) { j.setXY(i, skinI[i], 0); w.setXY(i, 1, 0); } w.needsUpdate = j.needsUpdate = true; }
      motion(f, c); skinLegs.write(f.heading, { air: f.alt > 0.05 ? 1 : 0 });
    },
    dispose() { M.dispose(); hide.dispose(); skinGeo.dispose(); for (const x of plates) x.geometry.dispose(); },
  };
}

/** Each bone's box of its vertices (the body the blade meets, src/foe-body.js; the pieces' sizes), as kit.js skinned. */
function boneBoxes(sm, bones, skinI) {
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, v = new THREE.Vector3();
  sm.updateMatrixWorld(true);
  for (let i = 0; i < pos.count; i++) { const b = skinI[i]; local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}
