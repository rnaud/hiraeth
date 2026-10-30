import * as THREE from 'three';
import { materials, add, pivot, finish, skinBy, merged } from '../../../../src/enemies/plans/kit.js';
import { gazePart } from '../../../../src/enemies/gaze.js';
import { humanoidSkeleton, HumanoidDriver } from '../../../../src/enemies/humanoid-rig.js';
import { Wielder } from '../../../../src/enemies/wield.js';
import { MUMMER_MOVES, MUMMER_HOLD } from '../../../../src/enemies/plans/mummer.js';
import { mummerLife, mummerProps, skinWith, GOURD_UP, UPRIGHT } from '../../../../src/enemies/plans/dune-mummer.js';

// The dune mummer from Tripo (issue #800 phase 2; a trial body, web only, behind the trial page): Tripo multiview task
// 126e68e7-… from the author's T-pose picks, rigged by Tripo (task 34054a6c-…, biped, Mixamo names, 23 joints, no
// fingers); the untouched exports in keep-mummer/tripo/, made into the game asset by prepare.mjs (the game's frame,
// 1.2 m at size 1, a flat 1024² texture, vertex colours, 12k triangles, Tripo's weights kept on every vertex).
//
// Posed directly: the humanoid foe rig's joints (humanoidSkeleton) stood where Tripo's rig put its joints
// (skeleton.json), the mesh skinned to them with Tripo's own weights, so the driver's clips pose the very bones the
// mesh hangs on (no hidden skeleton copied over, as #768's adapter did). Tripo's 23 joints fold onto the rig's 17:
// its three spine bones, the hips and the clavicles onto the torso, the neck and the head onto the head (its look: the
// gaze turns it toward the traveller, the gourd's top and the mask with it), the toes onto the feet. The bind pose is the
// rig's joints turned to the T-pose of the mesh (each limb's −y along Tripo's bone), then let down to the rig's rest.
//
// The mask is cut out of the mesh (its cream triangles high on the front) and rebuilt flat cream on its own pivot, so it
// can be knocked flying; under it the hole shows the black face (an ink oval). Two slit eyes fill Tripo's recesses (they
// take the wind-up's colour). The mittens are one piece (no finger bones): the haft goes through the mitten's measured
// centre (Wielder `at`), the club, spear and bow the mummer's own (mummerProps). The rest is the mummer's life
// (dune-mummer.js mummerLife): the same clips, holds, mask, disarm, lob and eyes as the direct body.

/**
 * The flat texture's parts (prepare.mjs PALETTE, skeleton.json palette: one flat colour a part, the reference's own, the
 * direct body's home skin's), for another skin's recolour.
 */
const ROLES = { body: '#879d88', mask: '#f3e4ad', patch: '#c9806a', glove: '#c46c3c', boot: '#bd6438', toe: '#dfb47c', band: '#2a2420', ink: '#17131f' };
/** The home skin's other colours (the direct body's: dune-mummer.js OWN.desert). */
const OWN = { desert: { ...ROLES, eye: '#1b1a1f', bare: '#fbf6e8' } };
/** A skin without its own colours: each part from its palette (as dune-mummer.js roles: the bleached mummer's cream, sky, saffron). */
const roles = (P) => ({ body: P.sack, mask: P.wood, patch: P.patch, glove: P.patch2, boot: P.rope, toe: P.rag, band: P.ink, ink: P.ink, eye: P.ink, bare: P.eye ?? '#fbf6e8' });

/** The trial's source, loaded once (browser): { geometry, map, skeleton }. base: this folder's URL. */
export async function loadTripoMummer(base) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const get = async (name) => { const r = await fetch(`${base}${name}`); if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${base}${name} (${r.status})`); return r; };
  const [bytes, skeleton] = await Promise.all([get('tripo-lod.glb').then((r) => r.arrayBuffer()), get('skeleton.json').then((r) => r.json())]);
  const gltf = await new GLTFLoader().parseAsync(bytes, base);
  let mesh = null; gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const map = mesh.material.map; if (map) { map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true; }
  return { geometry: mesh.geometry, map, skeleton };
}

const v3 = (a) => new THREE.Vector3(...a);
/** The rig's proportions from Tripo's joints (both sides' mean), and each joint's place. */
export function tripoBody(S) {
  const at = Object.fromEntries(S.joints.map((j) => [j.name, v3(j.at)]));
  const both = (f) => (f('Left') + f('Right')) / 2, d = (a, b) => at[a].distanceTo(at[b]);
  const hip = at.Hips.y;
  const D = { hip, hipX: both((s) => Math.abs(at[`${s}UpLeg`].x)), thigh: both((s) => d(`${s}UpLeg`, `${s}Leg`)), shin: both((s) => d(`${s}Leg`, `${s}Foot`)),
    chest: both((s) => at[`${s}Arm`].y) - hip, shoulder: both((s) => Math.abs(at[`${s}Arm`].x)), upper: both((s) => d(`${s}Arm`, `${s}ForeArm`)), fore: both((s) => d(`${s}ForeArm`, `${s}Hand`)), neck: 0 };
  D.neck = at.Neck.y - hip - D.chest;
  return { D, at };
}
/** Which rig joint carries each of Tripo's (by name). */
const FOLD = { Root: 'torso', Hips: 'torso', Spine: 'torso', Spine1: 'torso', Spine2: 'torso', LeftShoulder: 'torso', RightShoulder: 'torso', Neck: 'head', Head: 'head',
  LeftArm: 'arm1', LeftForeArm: 'elbow1', LeftHand: 'hand1', RightArm: 'arm0', RightForeArm: 'elbow0', RightHand: 'hand0',
  LeftUpLeg: 'leg1', LeftLeg: 'knee1', LeftFoot: 'foot1', LeftToeBase: 'foot1', RightUpLeg: 'leg0', RightLeg: 'knee0', RightFoot: 'foot0', RightToeBase: 'foot0' };

const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
/** j's world rotation made the one that points its −y along dir (world), its parent's read now. */
function pointAlong(j, dir) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_p);
  _q.setFromUnitVectors(DOWN, dir.clone().normalize());
  j.quaternion.copy(_p.invert().multiply(_q));
  j.updateWorldMatrix(false, true);
}

/** The trial body (the model contract of plans/index.js), from the loaded source (loadTripoMummer). */
export function tripoMummerModel(skin, src) {
  const home = skin.id === 'desert';
  const P = { ...skin.palette, ...roles(skin.palette), ...(home ? OWN.desert : {}) }, M = materials('mummer', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · dune mummer (Tripo)`;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const { D, at } = tripoBody(src.skeleton);
  const J = humanoidSkeleton(rig, D);
  // (each joint where Tripo put it: the torso at its hips, the limbs' roots at its, their lengths each side's own)
  J.torso.position.copy(at.Hips);
  J.head.position.copy(at.Neck).sub(at.Hips);
  const side = (i) => (i ? 'Left' : 'Right');
  for (const i of [0, 1]) {
    const s = side(i);
    J.legs[i].position.copy(at[`${s}UpLeg`]);
    J.knees[i].position.set(0, -at[`${s}UpLeg`].distanceTo(at[`${s}Leg`]), 0);
    J.feet[i].position.set(0, -at[`${s}Leg`].distanceTo(at[`${s}Foot`]), 0);
    J.arms[i].position.copy(at[`${s}Arm`]).sub(at.Hips);
    J.elbows[i].position.set(0, -at[`${s}Arm`].distanceTo(at[`${s}ForeArm`]), 0);
    J.hands[i].position.set(0, -at[`${s}ForeArm`].distanceTo(at[`${s}Hand`]), 0);
  }
  // the look (at rest: the gaze measures its frame now); its node is the head's bone
  const H = J.head, face = pivot(H, 0, 0, 0, 'face');
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.7, up: 0.35, down: 0.4 })], look = gaze[0].node;
  // ---------------------------------------------------------------- the bind pose: the rig's limbs along the mesh's T-pose
  g.updateMatrixWorld(true);
  const hc = src.skeleton.hands;
  for (const i of [0, 1]) {
    const s = side(i);
    pointAlong(J.arms[i], at[`${s}ForeArm`].clone().sub(at[`${s}Arm`]));
    pointAlong(J.elbows[i], at[`${s}Hand`].clone().sub(at[`${s}ForeArm`]));
    pointAlong(J.hands[i], v3(hc[s].centre).sub(at[`${s}Hand`]));
    pointAlong(J.legs[i], at[`${s}Leg`].clone().sub(at[`${s}UpLeg`]));
    pointAlong(J.knees[i], at[`${s}Foot`].clone().sub(at[`${s}Leg`]));
    J.feet[i].parent.getWorldQuaternion(_p); J.feet[i].quaternion.copy(_p.invert()); J.feet[i].updateWorldMatrix(false, true);
  }
  g.updateMatrixWorld(true);
  // ---------------------------------------------------------------- the body: Tripo's weights folded onto the rig's joints
  const rigJ = { torso: J.torso, head: look, arm0: J.arms[0], arm1: J.arms[1], elbow0: J.elbows[0], elbow1: J.elbows[1], hand0: J.hands[0], hand1: J.hands[1], leg0: J.legs[0], leg1: J.legs[1], knee0: J.knees[0], knee1: J.knees[1], foot0: J.feet[0], foot1: J.feet[1] };
  const bones = [...new Set(Object.values(rigJ))], of = src.skeleton.joints.map((j) => bones.indexOf(rigJ[FOLD[j.name]]));
  const src0 = src.geometry, pos = src0.attributes.position, col = src0.attributes.color, n = pos.count;
  const SI0 = src0.attributes.skinIndex, SW0 = src0.attributes.skinWeight, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const acc = new Map();
    for (let k = 0; k < 4; k++) { const w = SW0.getComponent(v, k); if (w <= 0) continue; const b = of[SI0.getComponent(v, k)]; acc.set(b, (acc.get(b) ?? 0) + w); }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, x) => s + x[1], 0) || 1;
    top.forEach(([b, w], k) => { SI[v * 4 + k] = b; SW[v * 4 + k] = w / sum; });
    if (!top.length) { SI[v * 4] = 0; SW[v * 4] = 1; }
  }
  // the colour roles (COLOR_0 nearest of ROLES): the mask's triangles cut out, another skin's colours
  // (COLOR_0 holds the texture's own bytes: matched against the roles' hex as they are, not turned linear)
  const keys = Object.keys(ROLES), ref = keys.map((k) => { const h = parseInt(ROLES[k].slice(1), 16); return { r: (h >> 16) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 }; }), role = new Uint8Array(n);
  for (let v = 0; v < n; v++) { let best = 0, dd = Infinity; ref.forEach((c, k) => { const e = (c.r - col.getX(v)) ** 2 + (c.g - col.getY(v)) ** 2 + (c.b - col.getZ(v)) ** 2; if (e < dd) { dd = e; best = k; } }); role[v] = best; }
  // (the mask: its cream and the painted slits (ink), high on the front; prepare.mjs painted its rim cream. A triangle
  //  with a slit's vertex is the mask's too: Tripo cut each slit as a recess 1.6 cm deep, a few sage vertices at its
  //  bottom, and those left on the body showed through the mask as dark holes under the eyes)
  const inFace = (v) => pos.getY(v) > at.Neck.y && pos.getZ(v) > 0.12 && Math.abs(pos.getX(v)) < 0.125;
  const isMask = (v) => inFace(v) && ['mask', 'ink'].includes(keys[role[v]]), isSlit = (v) => inFace(v) && keys[role[v]] === 'ink';
  const idx = src0.index.array, bodyTris = [], maskTris = [];
  for (let t = 0; t < idx.length; t += 3) { const tri = [idx[t], idx[t + 1], idx[t + 2]]; (tri.every(isMask) || (tri.some(isSlit) && tri.every(inFace)) ? maskTris : bodyTris).push(...tri); }
  const geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, src0.attributes[k]);
  if (!home) { const out = new Float32Array(n * 3), want = keys.map((k) => new THREE.Color(P[k] ?? ROLES[k])); for (let v = 0; v < n; v++) { const c = want[role[v]]; out[v * 3] = c.r; out[v * 3 + 1] = c.g; out[v * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(out, 3)); }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setIndex(bodyTris);
  const bodyM = M.mat(home ? 'tmTripo' : 'tmTripoTint', '#ffffff', home ? { map: src.map } : { vertexColors: true });
  // ---------------------------------------------------------------- the mask, the face under it, the eyes (on the look)
  const mb = new THREE.Box3(); for (const v of maskTris) mb.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, v));
  const mc = mb.getCenter(new THREE.Vector3()), ms = mb.getSize(new THREE.Vector3());
  look.updateWorldMatrix(true, false);
  const inLook = new THREE.Matrix4().copy(look.matrixWorld).invert();
  face.removeFromParent(); look.add(face); face.position.copy(mc).applyMatrix4(inLook);
  const builds = new Map(), tint = (_, hex) => { if (!builds.has(hex)) builds.set(hex, M.mat(`tmB${hex}`, hex)); return builds.get(hex); };
  const limbM = M.mat('tmLimb', '#ffffff', { vertexColors: true });
  // (its own vertices, indexed, with Tripo's smooth normals: recomputed per face it printed as two flat halves)
  const maskGeo = () => { const m = new THREE.BufferGeometry(), map = new Map(), p = [], nn = [], ix = [], N = src0.attributes.normal;
    for (const v of maskTris) { if (!map.has(v)) { map.set(v, map.size); p.push(pos.getX(v) - mc.x, pos.getY(v) - mc.y, pos.getZ(v) - mc.z); nn.push(N.getX(v), N.getY(v), N.getZ(v)); } ix.push(map.get(v)); }
    m.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3)); m.setIndex(ix); return m; };
  const mask = pivot(face, 0, 0, 0, 'mask');
  add(mask, maskGeo(), tint(0, P.mask));
  // (the hole the mask leaves: the black face, an ink oval sunk a little behind the mask's back)
  add(face, new THREE.SphereGeometry(1, 16, 10).scale(ms.x * 0.48, ms.y * 0.48, 0.03), tint(0, P.ink), 0, 0, -ms.z * 0.5 + 0.005);
  const flown = pivot(g, 0, 0, 0, 'dropped mask');
  add(flown, maskGeo(), tint(0, P.mask));
  // the slits: Tripo cut each as a recess about 1.6 cm deep, the ink painted at its bottom. Each side's recess is every
  // vertex of a mask triangle that touches the ink; its box (centre, breadth, height, bottom) and the mask's own surface
  // round it (its front: the highest z of the mask's vertices just about it)
  const slit = [1, -1].map((s) => { const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity), seen = new Set();
    for (let t = 0; t < maskTris.length; t += 3) { const tri = maskTris.slice(t, t + 3); if (!tri.some(isSlit) || tri.some((v) => pos.getX(v) * s <= 0.005)) continue;
      for (const v of tri) { seen.add(v); const q = new THREE.Vector3().fromBufferAttribute(pos, v).sub(mc); lo.min(q); hi.max(q); } }
    if (!seen.size) return { at: new THREE.Vector3(s * 0.045, 0.02, ms.z * 0.5), w: 0.04, h: 0.012, surf: ms.z * 0.5, n: 0 };
    const c = lo.clone().add(hi).multiplyScalar(0.5); let surf = lo.z;
    for (const v of maskTris) { const x = pos.getX(v) - mc.x, y = pos.getY(v) - mc.y; if (Math.abs(x - c.x) < (hi.x - lo.x) / 2 + 0.01 && Math.abs(y - c.y) < (hi.y - lo.y) / 2 + 0.01) surf = Math.max(surf, pos.getZ(v) - mc.z); }
    return { at: new THREE.Vector3(c.x, c.y, lo.z), w: Math.max(0.03, hi.x - lo.x), h: Math.max(0.008, hi.y - lo.y), surf, n: seen.size }; });
  const eyeM = M.own('eye', P.eye, { glow: 0.9 });
  // (each slit a black plug filling its recess, from the bottom out to the mask's surface: the wind-up's colour in it)
  const eyes = pivot(face, 0, 0, 0, 'eyes');
  add(eyes, merged(slit.map((e) => { const r = e.h / 2, depth = e.surf - e.at.z + 0.003;
    return new THREE.CapsuleGeometry(r, Math.max(0.001, e.w - 2 * r), 3, 8).rotateZ(Math.PI / 2).scale(1, 1, depth / (2 * r)).translate(e.at.x, e.at.y, (e.surf + e.at.z) / 2); })), eyeM);
  // ---------------------------------------------------------------- the weapons: through the mittens' centres
  const gripAt = [0, 1].map((i) => J.hands[i].worldToLocal(v3(hc[side(i)].centre)));
  const grip = pivot(J.hands[0], gripAt[0].x, gripAt[0].y, gripAt[0].z, 'grip'), gripL = pivot(J.hands[1], gripAt[1].x, gripAt[1].y, gripAt[1].z, 'grip l');
  const { held, lying, cord } = mummerProps(g, grip, gripL, P, tint, limbM);
  // ---------------------------------------------------------------- bound in the bind pose, then the rig's rest
  const body = skinWith(g, geo, bodyM, bones); body.name = 'tripo body';
  for (const j of [...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet]) j.quaternion.identity();
  g.updateMatrixWorld(true);
  skinBy(g, [{ from: [...builds.values()], into: limbM }]);
  const style = (_, want) => { if (want?.loop) J.torso.quaternion.slerp(UPRIGHT, GOURD_UP); J.arms[0].rotateZ(-0.42); J.arms[1].rotateZ(0.42); J.elbows[0].rotateZ(0.12); J.elbows[1].rotateZ(-0.12); J.legs[0].rotateZ(-0.05); J.legs[1].rotateZ(0.05); };
  const driver = new HumanoidDriver(J, rig, { moves: MUMMER_MOVES, speeds: { walk: 0.55, jog: 1.6, sprint: 3.3 }, style, seat: 0.2 });
  const wield = new Wielder(J, driver, { fists: [null, null], grips: [grip, gripL], at: gripAt.map((p) => p.toArray()), weapons: MUMMER_HOLD });
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [J.torso, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const anim = mummerLife({ J, driver, wield, fists: [null, null], held, lying, mask, flown, eyes, eyeM, P, skin, g, cord, eyeBack: ms.z * 0.6, gripAt: () => gripAt[0] });
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.body, P.mask, P.glove],
    driver, joints: J, wield, fists: [null, null], trial: 'tripo', tripo: { slits: slit.map((e) => ({ n: e.n, w: +e.w.toFixed(3), h: +e.h.toFixed(3), surf: +e.surf.toFixed(3), at: e.at.toArray().map((x) => +x.toFixed(3)) })), maskTris: maskTris.length / 3, bones: bones.length },
    tell: (id) => (id === 'volley' ? gripL : id === 'rock' ? J.hands[0] : grip),
    anim,
    dispose: M.dispose,
  };
}
