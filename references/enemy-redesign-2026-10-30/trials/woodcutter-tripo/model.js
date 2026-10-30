import * as THREE from 'three';
import { Rig, planLeg } from '../../../../src/motion-kit/rig.js';
import { materials, add, pivot, finish, plate, outerPoints } from '../../../../src/enemies/plans/kit.js';
import { gazePart } from '../../../../src/enemies/gaze.js';
import { SkinLegs, bendFrame } from '../../../../src/characters/creature-legs.js';
import { RENDER_FRAME } from '../../../../src/render-frame.js';
import { WOODCUTTER, WOODCUTTER_PLAN, woodcutterDef, woodcutterMotion } from '../../../../src/enemies/plans/woodcutter.js';

// The wood cutter from Tripo (issue #800 phase 2b; a trial body, web only, behind the trial page): Tripo task
// 32ba0f6c-… from the approved image (the untouched export in keep-brute/tripo/), made into the game asset by
// prepare.mjs (the game's frame, the direct body's 2.4 m, a flat 1024² texture of five colours, vertex colours, 12k
// triangles) and put on the brute's rig family here: the motion kit's brute plan for its legs (fitted to the mesh's own:
// landmarks.json), the direct wood cutter's arm pivots and its motion (woodcutterMotion: the same poses, ground contact
// and attacks), its def (woodcutterDef).
//
// A machine's rig, not a skinned humanoid: the mesh is cut at its joints into rigid parts, every triangle whole in one
// part (each vertex weighted 1 to one joint; a vertex the cut shares is copied, one for each side): the hull, the head,
// each arm's upper arm, forearm and hand (the saw arm's hub and clamp; the disc its own part, it spins), each leg's
// thigh, shin and boot (bones framed in the leg's bend plane, src/characters/creature-legs.js SkinLegs). Tripo stood the
// saw arm's forearm forward and level; its pivots are bound in that pose, so the shared motion's hanging rest lowers it.
// The head is its own part on a pivot the gaze turns (src/enemies/gaze.js, #508): it looks at you. The two pauldrons are
// cut out as the armour that falls (#722; a dark ball joint under each), the breastplate copied off the chest a little
// proud; a slit over the painted visor (orange as it winds up) and a glow over the vent (its weak point).

const _v = new THREE.Vector3(), _a = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(...a);
const segDist = (p, a, b) => { _a.subVectors(b, a); const t = THREE.MathUtils.clamp(_v.subVectors(p, a).dot(_a) / Math.max(1e-9, _a.lengthSq()), 0, 1); return _v.copy(a).addScaledVector(_a, t).distanceTo(p); };
/** The roles of the flat texture's colours (prepare.mjs), by the nearest of these. */
const ROLES = { body: '#55795e', dark: '#212417', rust: '#543b23', band: '#a79979', head: '#e6c7a1' };

/** The trial's source in the browser: { geometry, map, landmarks }. base: this folder's URL. */
export async function loadTripoWoodcutter(base) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const get = async (name) => { const r = await fetch(`${base}${name}`); if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${base}${name} (${r.status})`); return r; };
  const [bytes, landmarks] = await Promise.all([get('tripo-lod.glb').then((r) => r.arrayBuffer()), get('landmarks.json').then((r) => r.json())]);
  const gltf = await new GLTFLoader().parseAsync(bytes, base);
  let mesh = null; gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const map = mesh.material.map; if (map) { map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true; }
  return { geometry: mesh.geometry, map, landmarks };
}

/** A hex colour's own 0–1 channels (the vertex colours are the texture's printed values: no colour-space conversion). */
const raw = (hex) => { const h = parseInt(hex.slice(1), 16); return { r: (h >> 16) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 }; };
function rolesOf(geo) {
  const C = geo.attributes.color, n = C.count, out = new Uint8Array(n), keys = Object.keys(ROLES), ref = keys.map((k) => raw(ROLES[k]));
  for (let i = 0; i < n; i++) { const r = C.getX(i), g = C.getY(i), b = C.getZ(i); let best = 0, d = Infinity; ref.forEach((c, k) => { const e = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2; if (e < d) { d = e; best = k; } }); out[i] = best; }
  return { out, keys };
}

/** Part names, in bone order. */
export const PARTS = ['hull', 'head', 'upper0', 'fore0', 'hand0', 'saw', 'upper1', 'fore1', 'hand1', 'thigh0', 'shin0', 'foot0', 'thigh1', 'shin1', 'foot1', 'pauldron0', 'pauldron1'];
const PI = Object.fromEntries(PARTS.map((p, i) => [p, i]));
const CACHE = new WeakMap();
/**
 * Each triangle's part (worked out once a source: every wood cutter shares it). A vertex's part: the nearest of the
 * parts' capsules (the hull an ellipsoid), the head and the pauldrons by their own regions first; a triangle goes whole
 * to the part most of its corners are in (the head's and the pauldrons' only with all three).
 */
export function partsOf(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count, { out: role, keys } = rolesOf(geo);
  const H = L.head, hc = vec(H.centre);
  const A = L.arms.map((a) => ({ sh: vec(a.shoulder), el: vec(a.elbow), wr: vec(a.wrist), end: vec(a.end), tool: a.tool }));
  const G = L.legs.map((l) => ({ hip: vec(l.hip), knee: vec(l.knee), ankle: vec(l.ankle), foot: vec(l.foot) }));
  const saw = A[0], sawC = saw.end, sawN = sawNormal(P, role, keys, sawC);
  const vpart = new Uint8Array(n), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    const rk = keys[role[i]];
    // the head: its cream, and what is inside its sphere over the collar
    if ((rk === 'head' && p.y > 1.75) || (p.distanceTo(hc) < H.r && p.y > 1.9 && Math.abs(p.x) < 0.38)) { vpart[i] = PI.head; continue; }
    // the pauldrons: the great caps over the shoulders
    const pk = A.findIndex((a) => p.y > L.pauldronY && Math.sign(p.x) === Math.sign(a.sh.x) && Math.abs(p.x) > 0.42 && p.distanceTo(a.sh) < 0.62);
    if (pk >= 0) { vpart[i] = PI[`pauldron${pk}`]; continue; }
    // the saw's disc: rust in its plane, out from its hub
    const d = _v.subVectors(p, sawC);
    if (rk === 'rust' && Math.abs(d.dot(sawN)) < 0.07 && d.length() > 0.17 && d.length() < 0.5) { vpart[i] = PI.saw; continue; }
    const cand = [
      ['hull', Math.hypot(p.x / 0.6, (p.y - 1.48) / 0.66, (p.z + 0.06) / 0.58) * 0.6 - 0.6],
      ...A.flatMap((a, k) => [[`upper${k}`, segDist(p, a.sh, a.el) - 0.17], [`fore${k}`, segDist(p, a.el, a.wr) - 0.2], [`hand${k}`, a.tool === 'saw' ? p.distanceTo(a.end) - 0.42 : segDist(p, a.wr, a.end) - 0.16]]),
      ...G.flatMap((l, k) => [[`thigh${k}`, segDist(p, l.hip, l.knee) - 0.2 + (p.y > l.hip.y ? 0.15 : 0)], [`shin${k}`, segDist(p, l.knee, l.ankle) - 0.24], [`foot${k}`, p.y < l.ankle.y + 0.05 ? segDist(p, l.ankle.clone().setY(0.1), l.foot.clone().setY(0.1)) - 0.5 : 9]]),
    ];
    let best = cand[0]; for (const c of cand) if (c[1] < best[1]) best = c;
    vpart[i] = PI[best[0]];
  }
  const I = geo.index.array, tri = new Uint8Array(I.length / 3), votes = new Uint8Array(PARTS.length);
  const strict = new Set([PI.head, PI.pauldron0, PI.pauldron1, PI.saw]);
  for (let t = 0; t < tri.length; t++) {
    const a = vpart[I[t * 3]], b = vpart[I[t * 3 + 1]], c = vpart[I[t * 3 + 2]];
    let pick = a === b || a === c ? a : b === c ? b : a;
    if (strict.has(pick) && !(a === pick && b === pick && c === pick)) pick = [a, b, c].find((x) => !strict.has(x)) ?? pick;
    tri[t] = pick; votes[pick] = 1;
  }
  const out = { tri, vpart, role, keys, sawN, A, G, hc };
  CACHE.set(src.geometry, out);
  return out;
}
/** The disc's normal: the rust vertices round the saw's centre, their least spread direction. */
function sawNormal(P, role, keys, c) {
  const rust = keys.indexOf('rust'), pts = [], p = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) if (role[i] === rust && p.fromBufferAttribute(P, i).distanceTo(c) < 0.45) pts.push(p.clone().sub(c));
  // (power iteration on the inverse is awkward; the smallest of the covariance's directions by sweeping a hemisphere)
  let best = null, bv = Infinity;
  for (let a = 0; a < 90; a++) for (let b = 0; b <= 30; b++) {
    const th = (a / 90) * Math.PI * 2, ph = (b / 30) * Math.PI / 2, d = new THREE.Vector3(Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph));
    let v = 0; for (const q of pts) v += q.dot(d) ** 2;
    if (v < bv) { bv = v; best = d; }
  }
  return best.normalize();
}

/** The geometry of one part's triangles, its corners copied (non-indexed), with a colour attribute recoloured or kept. */
function partGeo(src, prep, ids, colour) {
  const geo = src.geometry, I = geo.index.array, pos = [], nor = [], uv = [], col = [];
  const PP = geo.attributes.position, NN = geo.attributes.normal, UU = geo.attributes.uv, CC = colour ?? geo.attributes.color;
  const skinI = [];
  for (let t = 0; t < prep.tri.length; t++) {
    if (!ids.includes(prep.tri[t])) continue;
    for (let k = 0; k < 3; k++) { const i = I[t * 3 + k]; pos.push(PP.getX(i), PP.getY(i), PP.getZ(i)); nor.push(NN.getX(i), NN.getY(i), NN.getZ(i)); uv.push(UU.getX(i), UU.getY(i)); col.push(CC.getX(i), CC.getY(i), CC.getZ(i)); skinI.push(prep.tri[t]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return { g, skinI };
}

/** A skin's colours over the mesh's roles (a world's own look on the same body). */
function skinColours(geo, prep, P) {
  const n = geo.attributes.position.count, out = new Float32Array(n * 3);
  const want = { body: P.body, dark: P.joint ?? P.dark, rust: P.saw ?? P.joint, band: P.brass, head: P.head ?? P.body2 };
  const cols = prep.keys.map((k) => new THREE.Color(want[k] ?? ROLES[k]));
  for (let i = 0; i < n; i++) { const c = cols[prep.role[i]]; out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  return new THREE.BufferAttribute(out, 3);
}

/** The trial body (the model contract of plans/index.js), from the loaded source (loadTripoWoodcutter). */
export function tripoWoodcutterModel(skin, src) {
  const L = src.landmarks, home = skin.id === 'perdide2', props = new Set(skin.props);
  const P = { ...skin.palette, ...(home ? { body: '#55795e', joint: '#212417', head: '#e6c7a1', visor: '#18161c', saw: '#543b23', core: '#f0b54a', dark: '#212417' } : {}) };
  P.visor ??= P.dark;
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
    if (a.tool === 'saw') {
      // (the disc's spin: a frame at its centre, its x along the disc's normal; the disc turns about it)
      g.updateMatrixWorld(true);
      const frame = new THREE.Object3D(); frame.name = 'saw frame'; fist.add(frame);
      frame.position.copy(fist.worldToLocal(a.end.clone()));
      fist.getWorldQuaternion(qW);
      const nLocal = prep.sawN.clone().applyQuaternion(qW.clone().invert());
      frame.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), nLocal);
      saw = new THREE.Bone(); saw.name = 'saw'; frame.add(saw);
    }
    return { sh, el, fist, hand: null, reach: null, saw, s };
  });
  // the head: a pivot at its foot the gaze turns, the head's own part a joint under it
  const headPivot = pivot(hull, prep.hc.x, 1.9, prep.hc.z - 0.05, 'head');
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
  // ---------------------------------------------------------------- the meshes: one rigid skin, the plates, the overlays
  const bones = [hull, headBone, arms[0].sh, arms[0].el, arms[0].fist, arms[0].saw, arms[1].sh, arms[1].el, arms[1].fist, ...legBones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  const colour = home ? null : skinColours(src.geometry, prep, P);
  const skinIds = PARTS.map((_, i) => i).filter((i) => i < PI.pauldron0);
  const { g: skinGeo, skinI } = partGeo(src, prep, skinIds, colour);
  const n = skinI.length, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { SI[i * 4] = skinI[i]; SW[i * 4] = 1; }
  skinGeo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); skinGeo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  // (both sides drawn: a cut part's open edge shows its inside, not a hole)
  const skinM = M.mat(home ? 'wcTripo' : 'wcTripoTint', '#ffffff', { side: THREE.DoubleSide, ...(home ? { map: src.map } : { vertexColors: true }) });
  const sm = new THREE.SkinnedMesh(skinGeo, skinM); sm.name = 'tripo skin'; sm.frustumCulled = false; g.add(sm);
  // the armour: the pauldrons cut out (on their shoulders), the breastplate copied off the chest, a little proud
  const plateM = M.mat(home ? 'wcTripoPlate' : 'wcTripoPlateTint', '#ffffff', { side: THREE.DoubleSide, ...(home ? { map: src.map } : { vertexColors: true }) });
  const jointM = M.mat('wcTripoJoint', P.joint);
  g.updateMatrixWorld(true);
  const plates = [];
  for (const k of [0, 1]) {
    const { g: pg } = partGeo(src, prep, [PI[`pauldron${k}`]], colour);
    pg.applyMatrix4(arms[k].sh.matrixWorld.clone().invert());
    plates.push(plate(arms[k].sh, pg, plateM, 0, 0, 0, `pauldron ${k ? 'left' : 'right'}`));
    add(arms[k].sh, new THREE.SphereGeometry(0.2, 12, 8), jointM, 0, -0.02, 0);   // (the ball joint the pauldron covers)
  }
  {
    const { g: hg } = partGeo(src, prep, [PI.hull], colour), HP = hg.attributes.position, HN = hg.attributes.normal, keep = [];
    for (let t = 0; t < HP.count; t += 3) { let ok = true; for (let q = 0; q < 3; q++) { const x = HP.getX(t + q), y = HP.getY(t + q), z = HP.getZ(t + q); if (!(y > L.chestY[0] && y < L.chestY[1] && z > 0.12 && Math.abs(x) < 0.45 && HN.getZ(t + q) > 0.3)) ok = false; } if (ok) keep.push(t); }
    const bp = new THREE.BufferGeometry(), A = {};
    for (const name of ['position', 'normal', 'uv', 'color']) { const src2 = hg.attributes[name], arr = []; for (const t of keep) for (let q = 0; q < 3; q++) for (let c = 0; c < src2.itemSize; c++) arr.push(src2.array[(t + q) * src2.itemSize + c] + (name === 'position' ? HN.array[(t + q) * 3 + c] * 0.008 : 0)); A[name] = new THREE.Float32BufferAttribute(arr, src2.itemSize); bp.setAttribute(name, A[name]); }
    plates.splice(1, 0, plate(hull, bp, plateM, 0, 0, 0, 'breastplate'));
    hg.dispose();
  }
  // the visor's slit over the painted one (its own material: it goes orange as it winds up), the vent's glow
  const eyeM = M.own('visor', P.visor, { glow: 0.2 }), coreM = M.own('core', P.core ?? '#f0b54a', { glow: 0.3 });
  const visor = add(headBone, new THREE.CapsuleGeometry(0.03, 0.2, 3, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.5), eyeM, 0, 0.25, 0.38 - (prep.hc.z - 0.05));
  visor.rotation.x = -0.35; visor.name = 'visor';
  const v = L.vent, core = add(hull, new THREE.PlaneGeometry(0.24, 0.2), coreM, v[0], v[1], v[2] + 0.025); core.name = 'vent';
  const gaze = [gazePart(g, headPivot, { mode: 'turn', yaw: 0.6, up: 0.2, down: 0.3 })];
  // the slab it hurls, in the clamp
  const slab = add(arms[1].fist, new THREE.DodecahedronGeometry(0.24, 0).scale(1.3, 0.7, 1), M.mat('slab', P.slab ?? '#8a7f70', { flat: true }), 0, -0.3, 0.12);
  slab.visible = false;
  finish(g);
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  boneBoxes(sm, bones, skinI);
  // each hand's outer points (the clamp's fingers, the saw's disc) in its fist's frame, for the ground contact
  for (const [k, a] of arms.entries()) {
    const ids = k ? [PI.hand1] : [PI.hand0, PI.saw], P0 = skinGeo.attributes.position, inv = a.fist.matrixWorld.clone().invert(), pts = [];
    for (let i = 0; i < n; i++) if (ids.includes(skinI[i])) pts.push(_v.fromBufferAttribute(P0, i).applyMatrix4(inv).toArray());
    const tmp = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3))); a.fist.add(tmp);
    a.reach = outerPoints(a.fist, (o) => o === tmp); tmp.removeFromParent(); tmp.geometry.dispose();
  }
  const parts = [hullTurn, headBone, ...arms.flatMap((a) => [a.sh, a.el, a.fist]), ...legBones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  const motion = woodcutterMotion({ g, hull: hullTurn, hullY: hipY, arms, rig, slab, coreM, eyeM, bodyM: null, P, props, saw: arms[0].saw, head: headPivot });
  return {
    group: g, gaze, body: hullTurn, rig, parts, eyeMat: eyeM, base: P.visor, size: skin.scale, skin: skin.id, tones: [P.body, P.brass, P.saw ?? P.joint],
    plates, weak: { obj: core, r: 0.2, name: 'vent' }, trial: 'tripo', trialDef: woodcutterDef, wcJoints: { arms, legs, head: headPivot, legBones },
    tell: (id) => (id === 'hurl' ? arms[1].fist : arms[0].fist),
    anim(f, c) { motion(f, c); skinLegs.write(f.heading, { air: f.alt > 0.05 ? 1 : 0 }); },
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
