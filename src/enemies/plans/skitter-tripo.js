import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, pivot, ease, eyeColor, finish, merged, tubeGeometry, lowestIn } from './kit.js';
import { gazePart } from '../gaze.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { skitterLegacyModel } from './skitterers-legacy.js';

// The seedpod skitter (issue #800): the game's `skitter`, the skitter swarm, everywhere it is fielded (the Desert, Lorn,
// the Buried Machine, the Moon Foundry, the Underside, the centipede's shed tail, the Arena, the gallery). Its body is
// Tripo's (task 118d9422-…, from the approved image, references/enemy-redesign-2026-10-30/keep-skitter/711f83a4-…-1.png),
// made into the game's asset by the family A trial's prepare-skitter.mjs (references/enemy-redesign-2026-10-30/trials/
// familyA-tripo/: the game's frame, 0.55 m to the top of its shell, drawn ×1.75 (GROWN, #741: at the traveller's hip),
// 7.6k triangles (a flock of eight: half the others' budget), its eight legs cut out by geometry, the shell, the cream
// underside; the painted eye dots painted out) and shipped by scripts/tripo/ship-body.mjs as public/enemies/skitter/body.glb.
//
// Its rig, the many-legged family's (a custom skin on the game's legs, the shellback's route): the motion kit's skitterers
// plan (a quick alternating gait at the mid tier), its eight legs fitted to the mesh's own (each leg's hip under the rim,
// knee, ankle and foot pad), SkinLegs bones framed in each leg's bend plane (slack in the solve, the knees up and over
// their ankles); the shell rides the body; the head plate
// ahead of the seam its own bone, turned to the traveller (the author's rule, #800), with two dot eyes of their own on
// it, sliding the rest of the way (orange as it winds up). Three skinned meshes on one skeleton, one a part (the shell,
// the underside, the legs), each its part's flat colour and painted surface; the Moon Foundry's and the Buried
// Machine's glowing seam down its back, a tube on the body.
//
// Its attacks read from the body alone (src/telegraph.js), as the legacy skitter's:
//   rush   it rears up on its back legs, front legs raised and pawing, and clicks; then darts in
//   pile   (its flock climbs onto it: Foes.pile) braced wide under the heap, which wobbles as it grows; then topples
// Where the body is not loaded, the legacy skitter (plans/skitterers-legacy.js) stands in.

/** The shipped body, under public/. */
export const SKITTER_BODY = 'enemies/skitter/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js, as the toad's), or null. */
export function skitterSource() { const S = foeSource('skitter'); return S ? (S.skitter ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The skitter's builder (src/enemies/plans/index.js): the Tripo body, or the legacy skitter where it is not loaded. */
export function skitterModel(skin) {
  const src = skitterSource();
  return src ? tripoSkitterModel(skin, src) : skitterLegacyModel(skin);
}

/** The reference's flat colours (prepare-skitter.mjs PALETTE): the home skin's (skins.js SKINS.skitter.desert). */
export const SKITTER_ROLES = { shell: '#cf8553', under: '#efe6c3', leg: '#b8703f' };
const HEAD = { yaw: 0.35, up: 0.15, down: 0.2, blend: 0.04 };
const CLEAR = 0.02;
/** The share of the plan's pitch the long shell takes. */
const PITCH = 0.45;
/** The stubs stand nearly straight: their solve longer than the mesh's, so a planted foot stays in reach through a run's
 *  long stance (no slide, tests/foe-slide.test.js); the knees' blend takes the difference. */
const SLACK = 1.4, KNEE_UP = 0.8;
const PLAN = PLANS.skitterers;
/** The eyes on the head plate's front (m, unscaled): either side of the middle, at this height. */
const EYE = { x: 0.11, y: 0.3 };   // (m, unscaled: the rim's least height over the ground)
const BLEND = 0.03;   // m over which a vertex is shared by its two nearest parts (the body unscaled: ×1.75 drawn)

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _w = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(...a);
const segDist = (p, a, b) => { _a.subVectors(b, a); const t = THREE.MathUtils.clamp(_v.subVectors(p, a).dot(_a) / Math.max(1e-9, _a.lengthSq()), 0, 1); return _v.copy(a).addScaledVector(_a, t).distanceTo(p); };

const CACHE = new WeakMap();
/** The weights of one source geometry (worked out once): bones { body, head, leg: [{ thigh, shin, foot }] }. */
function weigh(src, bones) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count;
  const segs = [];
  L.legs.forEach((l, k) => {
    segs.push({ b: bones.leg[k].thigh, a: vec(l.hip), z: vec(l.knee), r: l.r });
    segs.push({ b: bones.leg[k].shin, a: vec(l.knee), z: vec(l.ankle), r: l.r });
    segs.push({ b: bones.leg[k].foot, a: vec(l.ankle).setY(l.ankle[1] * 0.6), z: vec(l.foot), r: l.r * 1.3, foot: true });
  });
  // (which triangles are a leg's: its own vertices only go to the legs, the shell's and the underside's never)
  const legV = new Uint8Array(n), [lf, lc] = L.parts.leg, I = geo.index.array;
  for (let t = lf * 3; t < (lf + lc) * 3; t++) legV[I[t]] = 1;
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    let best = { s: legV[i] ? Infinity : 0, b: bones.body }, second = { s: Infinity, b: bones.body };
    for (const s of segs) {
      let d = segDist(p, s.a, s.z) - s.r;
      if (!legV[i]) d = Math.max(d, 0) + 0.02;   // (the body's: a leg only blends in at its hip)
      if (d < best.s) { second = best; best = { s: d, b: s.b }; } else if (d < second.s && s.b !== best.b) second = { s: d, b: s.b };
    }
    let w = second.b === best.b ? 1 : THREE.MathUtils.clamp(0.5 + (second.s - best.s) / (2 * BLEND), 0.5, 1);
    // (a leg's lowest part eased onto its foot, so it tilts with the pad on a slope instead of the shin's swing)
    if (legV[i] && p.y < 0.14) { let k = 0, d = Infinity; L.legs.forEach((l, j) => { const e = Math.hypot(p.x - l.foot[0], p.z - l.foot[2]); if (e < d) { d = e; k = j; } });
      const f = 1 - THREE.MathUtils.smoothstep(p.y, 0.07, 0.14), foot = bones.leg[k].foot;
      if (f > 0.5) { second = best.b === foot ? second : best; best = { s: -1, b: foot }; w = f; } else if (best.b !== foot) { second = { s: 0, b: foot }; w = 1 - f; } }
    // (a pad's rim, wider than its leg, on the ground near a foot: that foot's)
    if (p.y < 0.05) { let k = -1, d = 0.13; L.legs.forEach((l, j) => { const e = Math.hypot(p.x - l.foot[0], p.z - l.foot[2]); if (e < d) { d = e; k = j; } }); if (k >= 0) { best = { s: -1, b: bones.leg[k].foot }; second = best; w = 1; } }
    // the head plate: what the body carries ahead of the seam, eased across it
    const h = THREE.MathUtils.smoothstep(p.z, L.head.seam - HEAD.blend, L.head.seam + HEAD.blend) * (p.y > L.rim - 0.05 ? 1 : THREE.MathUtils.smoothstep(p.y, L.rim - 0.15, L.rim - 0.05));
    const parts = new Map(), put = (b, x) => { if (x > 1e-4) parts.set(b, (parts.get(b) ?? 0) + x); };
    for (const [b, x] of [[best.b, w], [second.b, 1 - w]]) { if (b === bones.body) { put(bones.head, x * h); put(bones.body, x * (1 - h)); } else put(b, x); }
    const top = [...parts].sort((u, v) => v[1] - u[1]).slice(0, 4), sum = top.reduce((s, [, x]) => s + x, 0) || 1;
    if (!top.length) top.push([bones.body, 1]);
    top.forEach(([b, x], j) => { SI[i * 4 + j] = b; SW[i * 4 + j] = x / sum; });
  }
  // the shell's top along its middle (for the seam down its back): the highest point near x 0 per length
  const ridge = [];
  for (let z = -0.6; z <= 0.62; z += 0.06) { let y = -Infinity; for (let i = 0; i < n; i++) if (Math.abs(P.getX(i)) < 0.04 && Math.abs(P.getZ(i) - z) < 0.04) y = Math.max(y, P.getY(i)); if (Number.isFinite(y)) ridge.push([0, y, z]); }
  // the lowest of the body's own points (kept off the ground, issue #332): the shell's rim and the underside
  const low = [];
  for (let i = 0; i < n; i++) if (P.getY(i) < L.rim && SI[i * 4] === bones.body && SW[i * 4] > 0.9) low.push(new THREE.Vector3().fromBufferAttribute(P, i));
  // (the lowest in each 8 cm cell of its plan: the whole rim, not one stretch of it)
  const cells = new Map();
  for (const q of low) { const key = `${Math.round(q.x / 0.08)},${Math.round(q.z / 0.08)}`; if (!cells.has(key) || cells.get(key).y > q.y) cells.set(key, q); }
  const out = { SI, SW, ridge, low: [...cells.values()] };
  CACHE.set(src.geometry, out);
  return out;
}

/** The skitter's body (the model contract of plans/index.js), from the loaded source (skitterSource). */
export function tripoSkitterModel(skin, src) {
  const L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('skitter', skin);
  const bodyY = L.legs.reduce((s, l) => s + l.hip[1], 0) / L.legs.length;
  const g = new THREE.Group(); g.name = `${skin.name} · seedpod skitter`;
  const body = pivot(g, 0, bodyY, 0, 'shell');
  const B = (o) => new THREE.Vector3(o[0], o[1] - bodyY, o[2]);
  // ---------------------------------------------------------------- the kit's legs on the mesh's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), off = knee.clone().sub(hip);
    const pole = off.addScaledVector(along, -off.dot(along) / along.lengthSq());
    pole.set(l.side, KNEE_UP, 0).normalize();   // (knees out and up: folded with the solve's slack they rise, never sink to the ground)
    const leg = planLeg(PLAN, { group: g, body, hip: B(l.hip), foot: { x: l.foot[0], z: l.foot[2] }, lenA: hip.distanceTo(knee) * SLACK, lenB: knee.distanceTo(ankle) * SLACK, pole, ankle: ankle.y, radius: 0.01, mats: { joint: hide }, name: `skitter leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: PLAN, group: g, body, legs, scale: skin.scale ?? 1 });
  const KNEE_RISE = L.legs.map((l) => 0.5 * (l.knee[1] - l.ankle[1]));   // (each knee's least rise over its ankle, m)   // (the kit's steps in m: drawn grown, issue #741)
  // ---------------------------------------------------------------- the bones: the body, the head plate, the legs (group children, bend-plane framed)
  const list = [body], index = (o) => { list.push(o); return list.length - 1; };
  const headRoot = pivot(body, ...B(L.head.hinge).toArray(), 'head');
  const headGaze = gazePart(g, headRoot, { mode: 'turn', yaw: HEAD.yaw, up: HEAD.up, down: HEAD.down });
  const headBone = index(headGaze.node);
  const legBones = legs.map((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); return b; };
    const thigh = mk('thigh', hip, knee.clone().sub(hip)), shin = mk('shin', knee, ankle.clone().sub(knee)), foot = mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null);
    return { thigh: index(thigh), shin: index(shin), foot: index(foot), objs: { [`leg${k}_thigh`]: thigh, [`leg${k}_shin`]: shin, [`leg${k}_foot`]: foot } };
  });
  legs.forEach((leg, k) => { const foot = legBones[k].objs[`leg${k}_foot`]; leg.root.lowest = (out) => foot.getWorldPosition(out); });
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.assign({}, ...legBones.map((x) => x.objs)), group: g, body });
  // ---------------------------------------------------------------- the meshes: one a part, on one skeleton
  const prep = weigh(src, { body: 0, head: headBone, leg: legBones });
  const geo = src.geometry, I = geo.index.array;
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) };
  const PARTS = { shell: M.mat('dome', P.dome, { color2: P.dome2 }), under: M.mat('under', P.band), leg: M.mat('leg', P.leg) };
  const meshes = Object.entries(L.parts).filter(([, [, count]]) => count > 0).map(([part, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), PARTS[part]);
    sm.name = `skitter ${part}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  // the seam (the furnace beetles', the ash grubs'): a glowing crack down its back, front to tail, on the body
  let seamM = null;
  if (props.has('seam')) {
    seamM = M.own('seam', P.seam, { glow: 0.9 });
    const pts = prep.ridge.filter((q) => q[2] < L.head.seam - 0.02).map((q) => [q[0], q[1] - bodyY + 0.014, q[2]]);
    if (pts.length > 2) add(body, tubeGeometry(pts, 0.022), seamM).name = 'seam';
  }
  // the eyes: two dots on the head plate's front where the painted ones were, a little proud, sliding on toward him
  const eyeM = M.own('eye', P.eye, { glow: 0.2 });
  // (where the reference draws them: on the head plate's front, either side; on its own surface, the most forward point there)
  const H0 = B(L.head.hinge), eyeGeo = [-1, 1].map((s) => { const at = frontAt(src.geometry, s * EYE.x, EYE.y); return new THREE.SphereGeometry(0.026, 8, 6).scale(1, 1.3, 0.55).translate(at.x, at.y - bodyY - H0.y, at.z + 0.006 - H0.z); });
  const eyesGeo = merged(eyeGeo); eyesGeo.computeBoundingBox(); const mid = eyesGeo.boundingBox.getCenter(new THREE.Vector3()); eyesGeo.translate(-mid.x, -mid.y, -mid.z);
  const eyes = add(headGaze.node, eyesGeo, eyeM, mid.x, mid.y, mid.z); eyes.name = 'eyes';
  const gaze = [headGaze, gazePart(g, eyes, { mode: 'slide', slide: 0.012 })];
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, list, prep.SI, RENDER_FRAME); }
  const parts = [...meshes, eyes, ...legs.map((l) => l.root)];
  const lowPts = prep.low.map((q) => q.clone().setY(q.y - bodyY));   // (in the body's frame)
  const shell = meshes.find((m) => m.name === 'skitter shell');
  let rear = 0, climb = 0, front = 0;
  const legLen = rig.length;
  return {
    group: g, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.dome, P.band, P.leg], gaze,
    tripo: 'tripo',
    tell: (id) => (id === 'pile' ? shell : eyes),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the rush: up on its back legs, the front pair raised and pawing, clicking
      rear = ease(rear, id === 'rush' && wind ? c.wind : 0, 14, dt);
      front = ease(front, rear > 0.3 ? 1 : 0, 12, dt);
      for (const i of [0, 1]) { legs[i].lift = front; legs[i].air.set(0, 0.12 + Math.sin(c.now / 45 + i) * 0.03 * front, 0.06); }
      // in a heap: climbing onto the one under it, lifted by its place in the heap, legs gripping
      const R = f.riding;
      climb = ease(climb, R ? R.climb : 0, 10, dt);
      const level = R ? 0.12 + R.i * L.top * 0.62 : 0;
      const wob = R || (id === 'pile' && wind) ? Math.sin(c.now / 110 + (R?.i ?? 0) * 1.9) * 0.08 * (R ? 1 : c.wind) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: climb > 0.15 ? 1.3 : 0 });
      body.position.set(o.x + wob * 0.3, bodyY + o.y + climb * level, o.z + (R ? (R.i % 2 ? 0.06 : -0.06) * climb : 0));
      // (the plan's rear, its pitch, made for the legacy's round dome: on this long shell it stood the skitter on its tail)
      body.rotation.set(o.pitch * PITCH + (R ? 0.2 * climb : 0), o.yaw, o.roll + wob);
      // (its rim kept off the ground as it rears, banks and bobs: the shell hangs low, issue #332)
      if (!R) {
        let need = CLEAR - lowestIn(g, body, lowPts);
        // (on a slope, the ground's plane under it, src/enemies/slope.js: the rim measured against the hill, not the level)
        const SL = f.slope;
        if (SL) { g.updateMatrixWorld(true); const k = skin.scale ?? 1; for (const q of lowPts) { _w.copy(q).applyMatrix4(body.matrixWorld); need = Math.max(need, (f.pos.y + SL.sx * (_w.x - f.pos.x) + SL.sz * (_w.z - f.pos.z) + CLEAR * k - _w.y) / k); } }
        if (need > 0) body.position.y += need;
      }
      rig.write();
      // (each knee kept over its ankle by half its rest rise: a shin laid flat across a slope as the foot steps uphill
      // put the stub's side into the hill, tests/foe-slope.test.js)
      legs.forEach((l, k) => { const rise = l.shin.position.y - (l.foot.position.y + l.ankle), min = KNEE_RISE[k]; if (rise < min) l.shin.position.y += min - rise; });
      skinLegs.write(f.heading, { air: climb > 0.15 ? 1 : 0 });
      if (seamM) seamM.uniforms.uGlow.value = 0.75 + Math.sin(c.now / 260 + f.home.x) * 0.15 + (wind ? 0.2 : 0);
      if (props.has('dust') && f.flash > 0.7 && Math.random() < 0.6) c.spray(f.chest, [P.dome, P.dome2], 3, 1.2, -0.5);   // (the spore mites puff when cut)
      if (strike && id === 'rush' && Math.random() < 0.5) c.dust(f.pos, P.dome2, 1, 0.2 * legLen);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose() { M.dispose(); hide.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}

/** The body's front surface at (x, y): the mesh's most forward point near that column. */
function frontAt(geo, x, y) {
  const P = geo.attributes.position, out = new THREE.Vector3(x, y, -Infinity);
  for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - x) < 0.03 && Math.abs(P.getY(i) - y) < 0.03 && P.getZ(i) > out.z) out.z = P.getZ(i);
  if (!Number.isFinite(out.z)) out.z = 0;
  return out;
}
