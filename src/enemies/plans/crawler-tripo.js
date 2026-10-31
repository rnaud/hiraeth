import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, pivot, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { crawlerLegacyModel } from './crawler-legacy.js';

// The survey crawler (issue #800): the game's `crawler`, the makers' defunct scout (roster v4, issue #726: the Arena and
// its staged sites). Its body is Tripo's (task c7b50a5d-…, the second take from the approved image, references/
// enemy-redesign-2026-10-30/keep-crawler/22d8861b-…-0.png), made into the game's asset by the family E trial's
// prepare-crawler.mjs (references/enemy-redesign-2026-10-30/trials/familyE-tripo/: the game's frame, 0.66 m to its
// antenna's knob as built, drawn ×1.5 (GROWN, #741): its dome at the traveller's thigh, the knob at his hip; 12k
// triangles cut into rigid parts by geometry; four legs of Tripo's six, the reference's note's; the reference's five flat
// colours, the painted eye out) and shipped by scripts/tripo/ship-body.mjs as public/enemies/crawler/body.glb, loaded by
// src/enemies/foe-assets.js.
//
// A low ceramic scout: a cream dome over a navy band, a round head at its front under the dome's lip, a thin antenna with
// a knob, and four sage legs out of pink sockets in its sides, each a thigh out to the knee, a shin down to a dark stem
// and a domed foot pad. A machine's rig (the wood cutter's route): each part rigid on its own joint, blended across its
// cuts (the prepare script's weights); the motion kit's crawler plan (a quick trot on diagonal pairs) on SkinLegs bones
// fitted to the mesh's own joints; the head turns to the traveller (the author's rule, #800), two amber eyes on it
// sliding the rest of the way; the antenna sways on its own joint. Five skinned meshes on one skeleton, one a colour
// role (the ceramic, the legs, the joints, the band, the sockets), each with its painted surface, the eyes, and dark
// ports where the back pair of Tripo's legs were.
//
// What the body says (nothing on the ground), as the legacy crawler's:
//   bite     sunk back on its hind legs, the head tipped up at you; then it springs in
//   call     reared up on its hind pair, the front legs raised, the eyes flashing white and the antenna sparking: every
//            sleeping droid near it wakes
//   blast    (low health, fight.low 'last') its fuse: squatting braced and shaking, its band and its eyes blinking red,
//            faster and faster, as it scuttles at you; then it bursts (roll out of it)
// Where the body is not loaded, the legacy crawler (plans/crawler-legacy.js) stands in.

/** The shipped body, under public/. */
export const CRAWLER_BODY = 'enemies/crawler/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js), or null. */
export function crawlerSource() { const S = foeSource('crawler'); return S ? (S.crawler ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The crawler's builder (src/enemies/plans/index.js): the Tripo body, or the legacy crawler where it is not loaded. */
export function crawlerModel(skin) {
  const src = crawlerSource();
  return src ? tripoCrawlerModel(skin, src) : crawlerLegacyModel(skin);
}

/** Its size as built (m): the dome's top, the antenna's knob (prepare-crawler.mjs; drawn ×1.5, GROWN). */
export const CRAWLER_SIZE = { top: 0.54, antenna: 0.66 };
/** The reference's flat colours (prepare-crawler.mjs PALETTE): the crawler's own skin (skins.js SKINS.crawler.desert). */
export const CRAWLER_ROLES = { ceramic: '#e4cdb6', leg: '#7e8d7c', joint: '#3a4640', band: '#1a2230', socket: '#a06a66' };
const HEAD = { yaw: 0.45, up: 0.18, down: 0.2 };
const _v = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(...a);

/** The crawler's body (the model contract of plans/index.js), from the loaded source (crawlerSource). */
export function tripoCrawlerModel(skin, src) {
  const L = src.landmarks, P = skin.palette, M = materials('crawler', skin), PLAN = PLANS.crawler;
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  // ---------------------------------------------------------------- the head (it looks at you) and the antenna, on the body
  const headRoot = pivot(body, ...L.head.pivot, 'head');
  const headGaze = gazePart(g, headRoot, { mode: 'turn', yaw: HEAD.yaw, up: HEAD.up, down: HEAD.down });
  const antenna = pivot(body, ...L.antenna.at, 'antenna');
  // ---------------------------------------------------------------- the kit's legs on the mesh's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), pole = knee.clone().sub(hip);
    pole.addScaledVector(along, -pole.dot(along) / along.lengthSq()).normalize();   // (the knee's side of the hip-to-ankle line: its bend plane)
    const leg = planLeg(PLAN, { group: g, body, hip: { x: hip.x, y: hip.y, z: hip.z }, foot: { x: l.foot[0], z: l.foot[2] }, lenA: hip.distanceTo(knee), lenB: knee.distanceTo(ankle), pole, ankle: ankle.y, radius: 0.01, mats: { joint: hide }, name: `crawler leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: PLAN, group: g, body, legs, scale: skin.scale ?? 1 });   // (the kit's steps in m: drawn grown, issue #741)
  // ---------------------------------------------------------------- the bones, in the asset's order (landmarks.bones)
  const byName = { body, head: headGaze.node, antenna }, legBones = {};
  legs.forEach((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); legBones[b.name] = b; return b; };
    byName[`thigh${k}`] = mk('thigh', hip, knee.clone().sub(hip));
    byName[`shin${k}`] = mk('shin', knee, ankle.clone().sub(knee));
    byName[`foot${k}`] = mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null);
    leg.root.lowest = (out) => byName[`foot${k}`].getWorldPosition(out);
  });
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: legBones, group: g, body });
  const bones = L.bones.map((b) => byName[b]);
  // ---------------------------------------------------------------- the meshes: one a colour role, on one skeleton
  const geo = src.geometry, I = geo.index.array, n = geo.attributes.position.count;
  const J8 = geo.attributes.skinIndex, W8 = geo.attributes.skinWeight, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 4; k++) { SI[i * 4 + k] = J8.array[i * 4 + k]; s += W8.array[i * 4 + k]; } for (let k = 0; k < 4; k++) SW[i * 4 + k] = W8.array[i * 4 + k] / (s || 1); }
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(SI, 4), skinWeight: new THREE.BufferAttribute(SW, 4) };
  // (the band is the seam that blinks red in its fuse: its own material)
  const seamM = M.own('seam', P.band, { glow: 0 });
  const ROLE = { ceramic: M.mat('ceramic', P.ceramic), leg: M.mat('leg', P.leg), joint: M.mat('joint', P.joint, { flat: true }), band: seamM, socket: M.mat('socket', P.socket) };
  // (the dark ports where the back pair of Tripo's legs left their sockets: in the joints' mesh, on the body's bone)
  const portGeo = mergeTwo(L.dropped.map((d) => new THREE.CircleGeometry(0.046, 14).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vec(d.out))).translate(d.at[0] - d.out[0] * 0.012, d.at[1], d.at[2] - d.out[2] * 0.012)));
  const meshes = Object.entries(L.parts).filter(([, [, count]]) => count > 0).map(([role, [first, count]]) => {
    const tris = Array.from(I.subarray(first * 3, (first + count) * 3));
    const sm = new THREE.SkinnedMesh(role === 'joint' ? withPorts(geo, tris, SI, SW, portGeo) : subset(geo, tris, attrs), ROLE[role]);
    sm.name = `crawler ${role}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  portGeo.dispose();
  // ---------------------------------------------------------------- the eyes: two amber discs on the head's sides, sliding on toward him
  const eyeM = M.own('eye', P.eye, { glow: 0.7 }), H0 = vec(L.head.pivot);
  const eyeGeo = L.eyes.map((e) => { const at = vec(e).sub(H0), out = new THREE.Vector3(Math.sign(e[0]) * 0.9, 0, 0.45).normalize();
    return new THREE.CircleGeometry(0.021, 14).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out)).translate(at.x + out.x * 0.009, at.y, at.z + out.z * 0.009); });
  const eyesGeo = mergeTwo(eyeGeo);
  const eyes = add(headGaze.node, eyesGeo, eyeM); eyes.name = 'eyes';
  const gaze = [headGaze, gazePart(g, eyes, { mode: 'slide', slide: 0.01 })];
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, bones, sm.geometry.attributes.skinIndex.array, RENDER_FRAME); }
  // (the small parts cast no shadow of their own: the dome's and the legs' are the crawler's)
  for (const m of [eyes, ...meshes.filter((x) => x.material !== ROLE.ceramic && x.material !== ROLE.leg)]) m.castShadow = false;
  const parts = [...meshes, eyes, ...legs.map((l) => l.root)];
  const st = { glow: 0 };
  let rear = 0, fuse = 0, blink = 0, rigid = false;
  return {
    group: g, gaze, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.ceramic, P.leg, P.joint], tripo: 'tripo',
    height: CRAWLER_SIZE.top,
    tell: (id) => (id === 'call' ? antenna : eyes),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind';
      // (going down or bursting: the cuts' blends let go, each vertex all its own part's, so the pieces come apart clean)
      if (f.dying && !rigid) { rigid = true; for (const sm of meshes) { const w = sm.geometry.attributes.skinWeight; for (let i = 0; i < w.count; i++) w.setXYZW(i, 1, 0, 0, 0); w.needsUpdate = true; } }
      // the call: up on its hind pair, the front legs raised and pawing
      rear = ease(rear, id === 'call' && wind ? c.wind : 0, 12, dt);
      for (const i of [0, 1]) { legs[i].lift = rear > 0.3 ? 1 : 0; legs[i].air.set(0, 0.16 + Math.sin(c.now / 60 + i * 2) * 0.03 * rear, 0.09); }
      // the fuse: its blinking quickens through the wind-up
      fuse = id === 'blast' && wind ? f.k : 0;
      blink += dt * (2 + fuse * fuse * 22);
      const on = fuse > 0 && Math.sin(blink * Math.PI * 2) > 0;
      const shake = fuse > 0 ? Math.sin(c.now / 18) * 0.02 * (0.3 + fuse) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery });
      body.position.set(o.x + shake, o.y, o.z);
      body.rotation.set(o.pitch, o.yaw, o.roll + shake * 2);
      antenna.rotation.set(Math.sin(c.now / 120 + f.home.x) * 0.15 - rear * 0.4, 0, Math.sin(c.now / 170) * 0.1);
      rig.write();
      skinLegs.write(f.heading, {});
      // its eyes: amber, flaring as it winds up, white as it calls, pale blue stunned; red as its fuse burns
      const wound = wind ? 0.5 + 0.5 * Math.min(1, f.k / 0.75) : 0;
      st.glow = ease(st.glow, wound, 6, dt);
      const broke = f.reel === 'guardbroken' || f.stunned > 0 || f.downT > 0, call = id === 'call' && wind ? (Math.sin(c.now / 50) > 0 ? rear : 0) : 0;
      eyeM.uniforms.uColor.value.set(on ? '#ff3a24' : broke ? '#bfe9ff' : call > 0.3 ? P.flare : eyeColor(f, P.eye, P.flare));
      eyeM.uniforms.uGlow.value = on ? 1 : 0.75 + st.glow * 0.25 + call * 0.3 - (broke ? 0.3 : 0);
      seamM.uniforms.uColor.value.set(on ? '#ff4a2e' : P.band); seamM.uniforms.uGlow.value = on ? 1 : 0;
      if (fuse > 0 && c.spray && Math.random() < dt * 8 * fuse) c.spray(antenna.localToWorld(_v.set(0, 0.11, 0)), ['#ffd27a', '#ff6a3a'], 2, 1.2, -1);
      if (call > 0.3 && c.spray && Math.random() < dt * 10) c.spray(antenna.localToWorld(_v.set(0, 0.11, 0)), ['#fff0b8', '#ffd27a'], 1, 0.8, -1);
    },
    dispose() { M.dispose(); hide.dispose(); for (const sm of meshes) sm.geometry.dispose(); eyesGeo.dispose(); },
  };
}

/** A role's triangles of the source (de-indexed) with the extra triangles of `extra` (on bone 0, the body) after them, skinned. */
function withPorts(geo, tris, SI, SW, extra) {
  const P = geo.attributes.position, N = geo.attributes.normal, E = extra.attributes, ne = E.position.count, n = tris.length + ne;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  tris.forEach((v, i) => { pos.set([P.getX(v), P.getY(v), P.getZ(v)], i * 3); nor.set([N.getX(v), N.getY(v), N.getZ(v)], i * 3); si.set(SI.subarray(v * 4, v * 4 + 4), i * 4); sw.set(SW.subarray(v * 4, v * 4 + 4), i * 4); });
  for (let k = 0; k < ne; k++) { const i = tris.length + k; pos.set([E.position.getX(k), E.position.getY(k), E.position.getZ(k)], i * 3); nor.set([E.normal.getX(k), E.normal.getY(k), E.normal.getZ(k)], i * 3); sw[i * 4] = 1; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  out.setIndex(Array.from({ length: n }, (_, i) => i));
  return out;
}

/** Two non-indexed geometries of position and normal (and uv) as one. */
function mergeTwo(geos) {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) { const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g).attributes[k]); out.setAttribute(k, new THREE.Float32BufferAttribute(parts.flatMap((a) => Array.from(a.array)), parts[0].itemSize)); }
  for (const g of geos) g.dispose();
  return out;
}
