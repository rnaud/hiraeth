import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, pivot, ease, eyeColor, finish, merged } from './kit.js';
import { gazePart } from '../gaze.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset, surfaceNormal } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { rootknotLegacyModel, THROW } from './tentacled-legacy.js';

export { THROW };

// The reed knot (issue #800): the game's `rootknot`, the root knot, the mortar, everywhere it is fielded (Lorn, Lorn II,
// Viridel, the White Mangrove, the Waterfall, the Arena, the gallery). Its body is Tripo's (task 6e112a46-…, from the
// approved image, references/enemy-redesign-2026-10-30/reed-knot/0de92fb6-…-1.png: a broad mauve mushroom cap tipped over a
// sage-green bulb with two pale slit eyes, on long orange legs with big flat feet), made into the game's asset by the
// family F trial's prepare-rootknot.mjs (references/enemy-redesign-2026-10-30/trials/familyF-tripo/: the game's frame, 3.2 m
// to the cap's top, 12k triangles, the cap, its gills, the bulb and the legs by their creases, the reference's flat colours,
// the painted eyes painted out) and shipped by scripts/tripo/ship-body.mjs as public/enemies/rootknot/body.glb. Tripo drew
// five legs (the picture hides a sixth behind the bulb; a second try drew five too), as the legacy's five root-arms.
//
// Its rig, the many-legged family's (a custom skin on the game's legs, the shellback's route): the tentacled plan's slow wave,
// one leg at a time round the ring, on the mesh's five legs (each fitted to its measured hip, knee, ankle and foot, two
// segments: the plan's third, the root-arm's tip, left out), SkinLegs bones in each leg's bend plane, the feet flat on
// their pads; the bulb rides them; the cap its own bone on the bulb's top: it turns to follow you (calm too), tips back to
// throw, shudders, droops asleep; the eyes their own parts, two pale slits on the bulb sliding toward the traveller (the
// author's rule, #800). Rooted: nothing knocks it back (its def).
//
// Its attacks read from the body (src/telegraph.js), and the lobs' landing marks from the ground, as the legacy's (#769):
//   pod    its cap tips back and a pod of spores fattens under the rim; over the wind-up's last third (THROW) the cap snaps
//          forward and flings the pod in a high arc onto its mark
//   seeds  it rises up on its legs, the cap shuddering, three seeds rattling under the rim; then they fly, one after
//          the other, onto their row of marks
//   puff   (Lorn II) it squats and its cap shudders, the gills swelling; a cloud of spores
// Where the body is not loaded, the legacy root knot (plans/tentacled-legacy.js) stands in.

/** The shipped body, under public/. */
export const ROOTKNOT_BODY = 'enemies/rootknot/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js), or null. */
export function rootknotSource() { const S = foeSource('rootknot'); return S ? (S.rootknot ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The root knot's builder (src/enemies/plans/index.js): the Tripo body, or the legacy root knot where it is not loaded. */
export function rootknotModel(skin) {
  const src = rootknotSource();
  return src ? tripoRootknotModel(skin, src) : rootknotLegacyModel(skin);
}

/** The reference's flat colours (prepare-rootknot.mjs PALETTE): the home skin's (skins.js SKINS.rootknot.perdide). */
export const ROOTKNOT_ROLES = { cap: '#b57f77', gill: '#8e5f5a', bulb: '#88ac95', leg: '#f6bf78' };
const PLAN = PLANS.tentacled;
/** The legs' solve a little longer than the mesh's (a planted foot stays in reach through the wave's long stance). */
const SLACK = 1.12;
/** The cap at rest, tipped back off the face (rad): Tripo's cap hangs over the front (the picture's tilt, seen from aside), its rim under the eyes. */
const CAP_REST = -0.3;
const BLEND = 0.05;   // m over which a vertex is shared by its two nearest parts
const EYE = { w: 0.035, h: 0.09, slide: 0.035 };

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();
const vec = (a) => new THREE.Vector3(...a);
const segDist = (p, a, b) => { _a.subVectors(b, a); const t = THREE.MathUtils.clamp(_v.subVectors(p, a).dot(_a) / Math.max(1e-9, _a.lengthSq()), 0, 1); return _v.copy(a).addScaledVector(_a, t).distanceTo(p); };

const CACHE = new WeakMap();
/** The weights of one source geometry (once): bones { body, cap, leg: [{ thigh, shin, foot }] }. */
function weigh(src, bones) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count, I = geo.index.array;
  const segs = [];
  L.legs.forEach((l, k) => {
    segs.push({ b: bones.leg[k].thigh, a: vec(l.hip), z: vec(l.knee) });
    segs.push({ b: bones.leg[k].shin, a: vec(l.knee), z: vec(l.ankle) });
    segs.push({ b: bones.leg[k].foot, a: vec(l.ankle), z: vec(l.foot), foot: true });
  });
  const role = new Uint8Array(n);   // 1 a leg's, 2 the cap's (or its gills')
  const mark = (name, x) => { const r = L.parts[name]; if (!r) return; for (let t = r[0] * 3; t < (r[0] + r[1]) * 3; t++) role[I[t]] = x; };
  mark('leg', 1); mark('cap', 2); mark('gill', 2);
  const hingeY = L.cap.hinge[1];
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    const parts = new Map(), put = (b, x) => { if (x > 1e-4) parts.set(b, (parts.get(b) ?? 0) + x); };
    if (role[i] === 1) {
      let best = { d: Infinity, b: 0 }, second = { d: Infinity, b: 0 };
      for (const s of segs) { const d = segDist(p, s.a, s.z); if (d < best.d) { second = best; best = { d, b: s.b }; } else if (d < second.d && s.b !== best.b) second = { d, b: s.b }; }
      let w = THREE.MathUtils.clamp(0.5 + (second.d - best.d) / (2 * BLEND), 0.5, 1);
      // (a foot's pad: all its foot bone's, flat on the ground)
      if (p.y < 0.12) { const k = L.legs.reduce((j, l, q) => (Math.hypot(p.x - l.foot[0], p.z - l.foot[2]) < Math.hypot(p.x - L.legs[j].foot[0], p.z - L.legs[j].foot[2]) ? q : j), 0); best = { b: bones.leg[k].foot }; w = 1; }
      // (where a leg goes into the bulb: eased onto the body over its top few centimetres)
      const into = THREE.MathUtils.smoothstep(p.y, Math.min(...L.legs.map((l) => l.hip[1])) - 0.12, Math.max(...L.legs.map((l) => l.hip[1])) + 0.05);
      put(best.b, w * (1 - into)); put(second.b, (1 - w) * (1 - into)); put(bones.body, into);
    } else if (role[i] === 2) put(bones.cap, 1);
    else { const c = THREE.MathUtils.smoothstep(p.y, hingeY - 0.25, hingeY + 0.05); put(bones.cap, c); put(bones.body, 1 - c); }
    const top = [...parts].sort((u, v) => v[1] - u[1]).slice(0, 4), sum = top.reduce((s, [, x]) => s + x, 0) || 1;
    if (!top.length) top.push([bones.body, 1]);
    top.forEach(([b, x], j) => { SI[i * 4 + j] = b; SW[i * 4 + j] = x / sum; });
  }
  const out = { SI, SW };
  CACHE.set(src.geometry, out);
  return out;
}

/** The root knot's body (the model contract of plans/index.js), from the loaded source (rootknotSource). */
export function tripoRootknotModel(skin, src) {
  const L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('rootknot', skin);
  const bodyY = L.legs.reduce((s, l) => s + l.hip[1], 0) / L.legs.length;
  const g = new THREE.Group(); g.name = `${skin.name} · reed knot`;
  const core = pivot(g, 0, bodyY, 0, 'core');
  const B = (o) => new THREE.Vector3(o[0], o[1] - bodyY, o[2]);
  // ---------------------------------------------------------------- the kit's legs on the mesh's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), off = knee.clone().sub(hip);
    const pole = off.addScaledVector(along, -off.dot(along) / along.lengthSq());
    if (pole.lengthSq() < 1e-6) pole.set(l.foot[0], 0.5, l.foot[2]);
    pole.normalize();
    const leg = planLeg(PLAN, { group: g, body: core, hipParent: core, hip: B(l.hip), foot: { x: l.foot[0], z: l.foot[2] }, lenA: hip.distanceTo(knee) * SLACK, lenB: knee.distanceTo(ankle) * SLACK, lenC: 0, pole, ankle: ankle.y, radius: 0.01, mats: { joint: hide }, name: `root leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: PLAN, group: g, body: core, legs, scale: skin.scale ?? 1 });
  // ---------------------------------------------------------------- the bones: the bulb, the cap on its top, the legs (bend-plane framed)
  const list = [core], index = (o) => { list.push(o); return list.length - 1; };
  const capP = pivot(core, ...B(L.cap.hinge).toArray(), 'cap');
  const capBone = index(capP);
  const legBones = legs.map((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); return b; };
    const thigh = mk('thigh', hip, knee.clone().sub(hip)), shin = mk('shin', knee, ankle.clone().sub(knee)), foot = mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null);
    return { thigh: index(thigh), shin: index(shin), foot: index(foot), objs: { [`leg${k}_thigh`]: thigh, [`leg${k}_shin`]: shin, [`leg${k}_foot`]: foot } };
  });
  legs.forEach((leg, k) => { const foot = legBones[k].objs[`leg${k}_foot`]; leg.root.lowest = (out) => foot.getWorldPosition(out); });
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.assign({}, ...legBones.map((x) => x.objs)), group: g, body: core });
  // ---------------------------------------------------------------- the meshes: one a part, on one skeleton
  const prep = weigh(src, { body: 0, cap: capBone, leg: legBones });
  const geo = src.geometry, I = geo.index.array;
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) };
  const gillM = props.has('glow') ? M.own('gill', P.gill, { glow: 0.55 }) : M.mat('gill', P.gill);
  const PARTS = { cap: M.mat('cap', P.cap, { color2: P.cap2 }), gill: gillM, bulb: M.mat('bulb', P.bulb, { color2: P.bulb2 }), leg: M.mat('root', P.root, { color2: P.root2 }) };
  const meshes = Object.entries(L.parts).filter(([, [, count]]) => count > 0).map(([part, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), PARTS[part]);
    sm.name = `rootknot ${part}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  // ---------------------------------------------------------------- the eyes: two pale slits where the painted ones were, on the bulb
  const eyeM = M.own('eye', P.eye, { glow: 0.95 }), Z = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion();
  const slits = L.eyes.map((e) => {
    const at = vec(e.at), n = surfaceNormal(geo, at, 0.08); q.setFromUnitVectors(Z, n);
    return new THREE.SphereGeometry(1, 10, 8).scale(EYE.w, EYE.h, 0.014).applyQuaternion(q).translate(at.x + n.x * 0.012, at.y - bodyY + n.y * 0.012, at.z + n.z * 0.012);
  });
  const eyes = add(core, merged(slits), eyeM); eyes.name = 'eyes';
  // what it throws, under the front of the rim: the spore pod fattening, and the three seeds rattling (hidden at rest)
  const rimZ = Math.max(0.7, (L.cap.reach ?? 1.4) * 0.6), darkM = M.mat('dark', P.dark, { flat: true });
  const pod = add(capP, new THREE.IcosahedronGeometry(1, 1).scale(1, 0.85, 1), M.mat('pod', P.spore, { color2: P.gill, glow: 0.3 }), 0, -0.42, rimZ); pod.visible = false;
  const seeds = [-1, 0, 1].map((s) => { const m = add(capP, new THREE.IcosahedronGeometry(0.11, 0).scale(1, 1.3, 1), darkM, s * 0.3, -0.24, rimZ - 0.12 - Math.abs(s) * 0.06); m.visible = false; return m; });
  // its eyes on you once it has noticed you, on its way before (src/enemies/gaze.js, issue #508): they slide across the bulb
  const gaze = [gazePart(g, eyes, { mode: 'slide', slide: EYE.slide })];
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, list, prep.SI, RENDER_FRAME); }
  if (props.has('clipped')) capP.scale.set(1, 0.85, 1);   // (the topiary knot's clipped cap)
  const parts = [...meshes, eyes, ...legs.map((l) => l.root)];
  let turn = 0, tip = 0, draw = 0, rise = 0, shudder = 0, droop = 0;
  return {
    group: g, gaze, body: core, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.cap, P.bulb, P.root], spore: P.spore,
    tripo: 'tripo',
    tell: (id) => (id === 'pod' ? pod : capP),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind';
      // the cap follows you (calm too: the lens shows it), droops asleep
      if (c.eye) {
        g.updateMatrixWorld(true); _m.copy(g.matrixWorld).invert(); _a.copy(c.eye).applyMatrix4(_m);
        turn = ease(turn, Math.max(-1, Math.min(1, Math.atan2(_a.x, _a.z))), 2.5, dt);
      }
      // the pod drawn back under the tipped cap, or the body raised on its legs for the volley; over the wind-up's
      // last third (THROW) the cap snaps forward and what it holds flies onto its mark
      const pod_ = id === 'pod' && wind, seeds_ = id === 'seeds' && wind, out = wind ? Math.max(0, (f.k - THROW) / (1 - THROW)) : 0;
      draw = ease(draw, pod_ ? c.wind * (1 - out) : 0, out > 0 ? 22 : 8, dt);
      rise = ease(rise, seeds_ ? c.wind : 0, 8, dt);
      shudder = (id === 'puff' || id === 'seeds') && wind ? c.wind * (id === 'seeds' ? 0.6 : 1) : ease(shudder, 0, 6, dt);
      droop = ease(droop, f.sleep > 0 ? 1 : 0, 4, dt);
      tip = CAP_REST + droop * 0.55 - draw * 0.6 + (pod_ || seeds_ ? out * 0.4 : 0);
      // (its legs stay planted as it rises, straightening under it: lifted, as the legacy's front root-arms were, the mesh's
      // long shins swung a pad through the ground)
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery });
      core.position.set(o.x, bodyY + o.y - shudder * (id === 'puff' ? 0.18 : 0) + rise * 0.32 - draw * 0.12, o.z);
      core.rotation.set(o.pitch - draw * 0.12, o.yaw, o.roll);
      capP.rotation.set(tip + Math.sin(c.now / 28) * 0.05 * shudder, turn * (1 - Math.max(draw, rise)), Math.sin(c.now / 33) * 0.05 * shudder);
      rig.write();
      skinLegs.write(f.heading);
      // the pod fattening under the rim until it is flung; the seeds rattling there until they fly
      pod.visible = pod_ && out <= 0;
      if (pod.visible) pod.scale.setScalar(0.1 + 0.32 * c.wind + Math.sin(c.now / 60) * 0.015 * c.wind);
      seeds.forEach((m, i) => {
        m.visible = seeds_ && out <= i * 0.08;
        if (m.visible) m.position.y = -0.24 + Math.sin(c.now / 23 + i * 2.1) * 0.03 * c.wind;
      });
      // in flight: the pod (glob 0) and the seeds (globs 1-3), from under the cap to their marks (each seed a little behind)
      const pts = f.attackPts ?? [f.attackAt];
      if (pod_ || seeds_ || f.globs) {
        const from = capP.getWorldPosition(_a);
        c.lob(f, pod_ ? out : -1, P.spore, 0, f.attackAt, from);   // (the pod's glob first, always: the seeds' 1-3 after it, no hole in f.globs for Foes.remove)
        for (let i = 0; i < 3; i++) if (seeds_ || f.globs?.[i + 1]) c.lob(f, seeds_ && pts[i] ? out - i * 0.08 : -1, P.root2, i + 1, pts[i] ?? f.attackAt, from);
      }
      if (id === 'puff' && f.state === 'recover' && f.timer > (f.atk.recover ?? f.def.recover) - 0.35) c.spray(capP.getWorldPosition(_a), [P.spore, P.gill], 4, 3, -0.3);   // (the cloud of spores)
      if (shudder > 0.5 && Math.random() < 0.3) c.spray(capP.getWorldPosition(_a), [P.spore], 1, 1, -0.5);
      if (pod_ && out <= 0 && c.wind > 0.5 && Math.random() < 0.25) c.spray(pod.getWorldPosition(_b), [P.spore, P.gill], 1, 0.8, -0.4);   // (spores sifting off the pod)
      eyeM.uniforms.uColor.value.set(f.sleep > 0 ? P.dark : eyeColor(f, P.eye));
      for (const e of [eyes]) e.scale.y = f.sleep > 0 ? 0.25 : 1;
      if (props.has('glow')) gillM.uniforms.uGlow.value = 0.45 + shudder * 0.5 + Math.sin(c.now / 500 + f.home.z) * 0.08;
    },
    dispose() { M.dispose(); hide.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}
