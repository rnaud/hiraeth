import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, rod, tube, pivot, lerp, ease, eyeColor, finish, V, plate, shellPlate, shade, plateMat, skinBy, merged } from './kit.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { tripodLegacyModel, SPOT } from './piston-legacy.js';

export { SPOT };

// The inspection tripod (issue #800): the game's `tripod`, the lamp tripod, everywhere it is fielded (the City-Shaft, the
// Buried Machine, the Underwater City, the Fallen Ring, the Desert, the Arena, the gallery). Its body is Tripo's (task
// 75908627-…, the second take from the approved image, references/enemy-redesign-2026-10-30/keep-tripod/9bb4fd97-…-0.png),
// made into the game's asset by the family E trial's prepare-tripod.mjs (references/enemy-redesign-2026-10-30/trials/
// familyE-tripo/: the game's frame, 3.1 m to the top of its lamp head, 13k triangles cut into rigid parts by geometry, the
// reference's three flat colours, the painted lenses out, the skin's weights baked) and shipped by scripts/tripo/
// ship-body.mjs as public/enemies/tripod/body.glb, loaded by src/enemies/foe-assets.js.
//
// A machine's rig (the wood cutter's): each part rigid on its own joint, blended across its cuts (the prepare script's
// weights) so a bent joint stays closed. A camera of a head, a cream drum with a deep lens, on a dark neck over a round
// hub; three legs round the hub, the two in front either side of its axis and the third behind, each a dark hip ball,
// a sage bracket out to the knee, a cream shin down to a dark ankle ball and a domed foot: the motion kit's machine plan
// (one leg at a time, in hard straight moves) on SkinLegs bones fitted to the mesh's own joints. The head turns on its
// neck (its yaw and a little pitch, in a servo's notches): the lamp is its lens, and it looks at the traveller (the
// author's rule, #800) as it hunts. Three skinned meshes on one skeleton, one a colour role (the cream, the sage, the
// dark), each with its painted surface; the model's own parts on the bones they ride: the lens (it glows, the eye), the
// armour, the harpoon gun (shown as it aims), and its fittings (the shutter, the valves, each world's dress) as one more
// skinned mesh on their own pivots (kit.js skinBy): 8 drawn meshes.
//
// Its attacks read from the body (src/telegraph.js; the beam is its lamp's light, not a mark on the ground), as the
// legacy tripod's:
//   beam   the lens finds you and holds; the shutter closes in notches, the light narrowing and brightening, a harpoon
//          gun slides out under the hub, then a bolt flies down the beam
//   stamp  one front leg lifts high and black steam hisses from its hip
//   vent   the valves round its neck rattle open, then black steam bursts round its feet
// Its armour (#722): three plates bolted round the hub between the legs; its lens (the weak point) stays bare.
// Skins (src/enemies/skins.js): the reference's cream and sage in the City-Shaft, with an enamel band round the lens;
// a drill under the lens (the Buried Machine); portholes, a wind-up key and bubbles (Underwater); gyroscope rings round
// the head (the Fallen Ring); a cistern pump's handle and pipe (the Desert). Where the body is not loaded, the legacy
// tripod (plans/piston-legacy.js) stands in.

/** The shipped body, under public/. */
export const TRIPOD_BODY = 'enemies/tripod/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js), or null. */
export function tripodSource() { const S = foeSource('tripod'); return S ? (S.tripod ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The tripod's builder (src/enemies/plans/index.js): the Tripo body, or the legacy tripod where it is not loaded. */
export function tripodModel(skin) {
  const src = tripodSource();
  return src ? tripoTripodModel(skin, src) : tripodLegacyModel(skin);
}

/** The reference's flat colours (prepare-tripod.mjs PALETTE): the home skin's (skins.js SKINS.tripod.incal). */
export const TRIPOD_ROLES = { body: '#eac9ae', limb: '#5f7560', dark: '#2c2f33' };
/** The head's reach on its neck (rad): its yaw as it patrols, its pitch down (the beam's light tips the rest). */
const HEAD = { sweep: 0.9, yaw: 1.3, down: 0.2, up: 0.1 };
/** The machine plan, its poses small: its knees ride high over its hips, so a body sunk on its legs folds the shins in under the hub. */
const LEGS = { ...PLANS.machine, poses: { coil: { y: -0.04, z: -0.05, pitch: -0.06, spread: 1.0 }, strike: { y: 0.01, z: 0.06, pitch: 0.08 }, recover: { y: -0.03, pitch: 0.05 }, hurt: { y: -0.03, roll: 0.06 } } };
const _lf = new THREE.Vector3(), _ld = new THREE.Vector3(), _lm = new THREE.Matrix3();
const vec = (a) => new THREE.Vector3(...a);

const COLUMN = new WeakMap();
/** The column under the drum (the head's part over the neck, under the drum's belly): its front, middle height, width, height (m). */
function columnOf(src) {
  const hit = COLUMN.get(src.geometry); if (hit) return hit;
  const L = src.landmarks, P = src.geometry.attributes.position, y0 = L.neck[1] + 0.08, y1 = L.neck[1] + 0.42;
  let z = -Infinity, w = 0;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < y0 || y > y1 || Math.abs(P.getX(i)) > 0.12) continue; z = Math.max(z, P.getZ(i)); }
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < y0 || y > y1 || Math.abs(P.getZ(i) - z) > 0.08) continue; w = Math.max(w, Math.abs(P.getX(i)) * 2); }
  const out = { z, w, y: (y0 + y1) / 2, h: y1 - y0 };
  COLUMN.set(src.geometry, out);
  return out;
}

/** The tripod's body (the model contract of plans/index.js), from the loaded source (tripodSource). */
export function tripoTripodModel(skin, src) {
  const L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('tripod', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const hull = pivot(g, 0, 0, 0, 'hull');
  // ---------------------------------------------------------------- the head: it turns on its neck (yaw, then pitch)
  const neck = vec(L.neck), headYaw = pivot(hull, neck.x, neck.y, neck.z, 'lamp yaw'), head = pivot(headYaw, 0, 0, 0, 'lamp');
  const H = (a) => vec(a).sub(neck);   // (a point of the asset in the head's frame)
  // ---------------------------------------------------------------- the kit's legs on the mesh's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), pole = knee.clone().sub(hip);
    pole.addScaledVector(along, -pole.dot(along) / along.lengthSq()).normalize();   // (the knee's side of the hip-to-ankle line: its bend plane)
    const leg = planLeg(LEGS, { group: g, body: hull, hip: { x: hip.x, y: hip.y, z: hip.z }, foot: { x: l.foot[0], z: l.foot[2] }, lenA: hip.distanceTo(knee), lenB: knee.distanceTo(ankle), pole, ankle: ankle.y, radius: 0.02, mats: { joint: hide }, name: `tripod leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: LEGS, group: g, body: hull, legs });
  // ---------------------------------------------------------------- the bones, in the asset's order (landmarks.bones)
  const byName = { hull, head }, legBones = {};
  legs.forEach((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); legBones[b.name] = b; return b; };
    byName[`thigh${k}`] = mk('thigh', hip, knee.clone().sub(hip));
    byName[`shin${k}`] = mk('shin', knee, ankle.clone().sub(knee));
    byName[`foot${k}`] = mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null);
    leg.root.lowest = (out) => byName[`foot${k}`].getWorldPosition(out);
  });
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: legBones, group: g, body: hull });
  const bones = L.bones.map((b) => byName[b]);
  // ---------------------------------------------------------------- the meshes: one a colour role, on one skeleton
  const geo = src.geometry, I = geo.index.array;
  // (the baked weights as the skin's: bytes in the file, exact floats here)
  const J8 = geo.attributes.skinIndex, W8 = geo.attributes.skinWeight, n = geo.attributes.position.count;
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 4; k++) { SI[i * 4 + k] = J8.array[i * 4 + k]; s += W8.array[i * 4 + k]; } for (let k = 0; k < 4; k++) SW[i * 4 + k] = W8.array[i * 4 + k] / (s || 1); }
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(SI, 4), skinWeight: new THREE.BufferAttribute(SW, 4) };
  const ROLE = { body: M.mat('body', P.body, { color2: P.body2 }), limb: M.mat('leg', P.limb ?? P.accent), dark: M.mat('dark', P.dark, { flat: true }) };
  const meshes = Object.entries(L.parts).filter(([, [, count]]) => count > 0).map(([role, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), ROLE[role]);
    sm.name = `tripod ${role}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  // ---------------------------------------------------------------- the lens (the lamp, the eye), its shutter, its light
  // (the fittings, built in their own colours on the pivots that move them, then one skinned mesh: skinBy below)
  const brassM = M.mat('brassBuild', P.brass), darkM = M.mat('darkBuild', P.dark), accentM = M.mat('accentBuild', P.accent), rustM = M.mat('rustBuild', P.rust), glassM = M.mat('glassBuild', '#2a2238');
  const lensM = M.own('lamp', P.lens ?? '#d27f45', { glow: 0.85 }), beamM = M.own('beam', P.lamp, { glow: 0.7, side: THREE.DoubleSide });
  const lensAt = H(L.lens.at), lensR = L.lens.r;
  const lens = add(head, new THREE.CircleGeometry(lensR * 0.98, 28), lensM, lensAt.x, lensAt.y, lensAt.z + 0.006); lens.name = 'lens';
  // (four leaves at the lens's rim that close in notches toward its middle)
  const shutter = [0, 1, 2, 3].map((k) => { const s = pivot(head, lensAt.x, lensAt.y, lensAt.z + 0.02); s.rotation.z = (k * Math.PI) / 2; const leaf = pivot(s, 0, lensR * 1.32, 0, 'shutter leaf'); add(leaf, new THREE.BoxGeometry(lensR * 1.2, lensR * 0.55, 0.014), darkM); return leaf; });
  const light = pivot(head, lensAt.x, lensAt.y, lensAt.z + 0.03, 'light');
  const shaft = add(light, new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), beamM); shaft.visible = false;
  const bolt = pivot(light, 0, 0, 0, 'bolt');
  const gunM = M.mat('brass', P.brass, { metal: 'brass', color: P.brass });
  // (the bolt and the gun one mesh each: shown only as it aims and fires)
  add(bolt, merged([new THREE.ConeGeometry(0.06, 0.3, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.CylinderGeometry(0.018, 0.018, 0.46, 8).rotateX(Math.PI / 2).translate(0, 0, 0.13)]), gunM); bolt.visible = false;
  // (the exhaust at the back of the head: its black steam)
  const back = H([L.lens.at[0], L.lens.at[1], L.head.lo[2] + 0.1]);
  const vents = [-1, 1].map((s) => pivot(head, back.x + s * 0.22, back.y + 0.15, back.z - 0.05));
  // ---------------------------------------------------------------- the harpoon gun under the hub: it slides out, loaded, as the beam narrows
  const hub = L.hub, gun = pivot(hull, 0, hub.lo - 0.12, 0, 'harpoon');
  add(gun, merged([new THREE.CylinderGeometry(0.075, 0.075, 0.42, 12).rotateX(Math.PI / 2).translate(0, 0, 0.1), new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateX(Math.PI / 2).translate(0, 0, -0.14),
    new THREE.CylinderGeometry(0.016, 0.016, 0.4, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.ConeGeometry(0.05, 0.16, 4).rotateX(Math.PI / 2).translate(0, 0, 0.76)]), gunM);
  gun.visible = false;
  // ---------------------------------------------------------------- the valves round its neck (the vent's tell)
  const neckR = 0.3, valves = [0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; const v = pivot(hull, neck.x + Math.sin(a) * neckR, neck.y - 0.14, neck.z + Math.cos(a) * neckR);
    add(v, new THREE.CylinderGeometry(0.045, 0.045, 0.07, 8).rotateX(Math.PI / 2), brassM); add(v, new THREE.BoxGeometry(0.11, 0.02, 0.02), darkM, 0, 0.045, 0); v.rotation.y = a; return v; });
  // ---------------------------------------------------------------- its armour (issue #722, fight.js ARMOUR): three plates round the hub between its legs
  const plateM = plateMat(M, P.plate ?? shade(P.body, 0.9));
  const hubProf = [0, 0.25, 0.5, 0.75, 1].map((u) => [hub.r * 0.86, lerp(hub.lo + 0.14, hub.hi - 0.22, u)]);
  const legAz = L.legs.map((l) => Math.atan2(l.hip[0], l.hip[2])).sort((a, b) => a - b);
  const gaps = legAz.map((a, i) => { const b = legAz[(i + 1) % 3] + (i === 2 ? Math.PI * 2 : 0); return (a + b) / 2; });
  const plates = gaps.map((mid, k) => plate(hull, shellPlate(hubProf, mid - 0.45, 0.9, { out: 0.05, thick: 0.045, segs: 8 }), plateM, 0, 0, 0, `hub plate ${k}`));
  // ---------------------------------------------------------------- each world's dress
  const headR = (L.head.hi[0] - L.head.lo[0]) / 2, headY = lensAt.y;
  const rings = [];
  // (the City-Shaft's enamel: two slate-blue strips down the column's front, under the drum)
  if (props.has('enamel')) { const C = columnOf(src); for (const s of [-1, 1]) add(head, new THREE.BoxGeometry(0.05, C.h * 0.8, 0.012), accentM, s * C.w * 0.3, C.y - neck.y, C.z - neck.z + 0.008); }
  if (props.has('drill')) { const d = pivot(head, 0, headY - headR - 0.02, lensAt.z - 0.25); for (let i = 0; i < 4; i++) add(d, new THREE.ConeGeometry(0.11 - i * 0.022, 0.1, 8).rotateX(Math.PI / 2), rustM, 0, 0, 0.12 + i * 0.08); }
  if (props.has('portholes')) {
    for (const s of [-1, 1]) { const p = pivot(head, s * (headR + 0.005), headY - 0.05, lensAt.z - 0.9); p.rotation.y = s * Math.PI / 2; add(p, new THREE.TorusGeometry(0.13, 0.026, 8, 20), brassM); add(p, new THREE.CircleGeometry(0.12, 18), glassM, 0, 0, -0.005); }
  }
  if (props.has('key')) { const k = pivot(hull, -hub.r - 0.02, (hub.lo + hub.hi) / 2, 0); k.rotation.z = Math.PI / 2; rod(k, [0, 0, 0], [0, 0.14, 0], 0.02, brassM); for (const s of [-1, 1]) add(k, new THREE.TorusGeometry(0.06, 0.02, 6, 12), rustM, s * 0.065, 0.2, 0); valves.push(k); }
  if (props.has('gyro')) for (let k = 0; k < 2; k++) { const r = pivot(head, 0, headY, lensAt.z - 0.6); add(r, new THREE.TorusGeometry(headR + 0.16 + k * 0.09, 0.016, 6, 34), brassM); r.rotation.set(k ? 1.1 : 0.4, k * 0.8, 0); rings.push(r); }
  if (props.has('pump')) { const h = pivot(hull, hub.r * 0.9, hub.hi - 0.05, -0.1); rod(h, [0, 0, 0], [0.45, 0.35, -0.1], 0.035, brassM); add(h, new THREE.SphereGeometry(0.06, 8, 6), darkM, 0.45, 0.35, -0.1); rings.push(h);
    tube(hull, [[-hub.r * 0.8, (hub.lo + hub.hi) / 2, 0.1], [-hub.r - 0.3, hub.lo + 0.1, 0.2], [-hub.r - 0.4, 0.3, 0.25]], 0.06, brassM); }
  const [fittings] = skinBy(g, [{ from: [brassM, darkM, accentM, rustM, glassM], into: M.mat('fittings', '#ffffff', { vertexColors: true }) }]);
  if (fittings) fittings.name = 'tripod fittings';
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, bones, SI, RENDER_FRAME); }
  const parts = [...meshes, lens, ...legs.map((l) => l.root)];
  const sweepPhase = Math.random() * 6;
  let aimYaw = 0, aimPitch = 0, close = 0, stamp = 0, twitch = 0, twitchLeg = 0, nextTwitch = 2 + Math.random() * 3, rigid = false;
  const lampY = lensAt.y + neck.y;
  const spot = { on: false, from: new THREE.Vector3(), at: new THREE.Vector3(), r: 1, rTop: lensR * 0.9, n: new THREE.Vector3(0, 1, 0), color: P.lamp };
  return {
    group: g, body: hull, rig, parts, eyeMat: lensM, base: P.lens ?? '#d27f45', size: skin.scale, skin: skin.id, tones: [P.body, P.limb ?? P.accent, P.dark],
    plates, weak: { obj: lens, r: lensR + 0.14, name: 'lamp' }, lamp: spot, tripo: 'tripo', head: headYaw,
    gaze: [],   // (its gaze is its lamp head's own aim, in anim: the empty list asks the foes for where he is, src/foes.js gazeAim)
    tell: (id) => (id === 'beam' ? lens : id === 'stamp' ? byName.foot0 : valves[0]),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // (going down: the cuts' blends let go, each vertex all its own part's, so the parts come apart clean, not stretched)
      if (f.dying && !rigid) { rigid = true; for (const sm of meshes) { const w = sm.geometry.attributes.skinWeight; for (let i = 0; i < n; i++) { SW[i * 4] = 1; SW[i * 4 + 1] = SW[i * 4 + 2] = SW[i * 4 + 3] = 0; } w.needsUpdate = true; } }
      // the stamp: its front leg lifts high, steam hissing from its hip; the vent: valves rattling
      stamp = ease(stamp, id === 'stamp' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, wind ? 8 : 20, dt);
      legs[0].lift = stamp; legs[0].air.set(0, stamp * 0.75, stamp * 0.25);
      // possessed: now and then a leg twitches past its stop (not while it aims)
      nextTwitch -= dt;
      if (nextTwitch < 0 && !wind) { twitch = 0.18; twitchLeg = 1 + Math.floor(Math.random() * 2); nextTwitch = 2.5 + Math.random() * 4; }
      twitch = Math.max(0, twitch - dt);
      legs[1].lift = twitchLeg === 1 ? twitch * 2 : 0; legs[2].lift = twitchLeg === 2 ? twitch * 2 : 0;
      legs[1].air.set(0, 0.2, 0); legs[2].air.set(0, 0.2, 0);
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0 });
      const aimBack = id === 'beam' && wind ? c.wind : 0;
      hull.position.set(o.x, o.y - stamp * 0.05, o.z);
      hull.rotation.set(o.pitch - aimBack * 0.04 + (twitch > 0 ? Math.sin(c.now / 20) * 0.03 : 0), o.yaw, o.roll + stamp * 0.06);
      // the lamp head: it sweeps as it patrols, turns on you when it hunts, holds as it aims (in a servo's notches); the
      // head pitches a little on its neck, the light tips the rest of the way down to you
      const hunting = f.state !== 'idle' && f.state !== 'home', G = f.gaze, watching = !!G?.watching;
      const d = Math.max(1, f.dist === Infinity ? 10 : f.dist);
      // (watching him, src/enemies/gaze.js gazeAim: the head turned to him on its neck, whichever way its legs face)
      const toHim = watching ? THREE.MathUtils.clamp(Math.atan2(Math.sin(Math.atan2(G.at.x - f.pos.x, G.at.z - f.pos.z) - f.heading), Math.cos(Math.atan2(G.at.x - f.pos.x, G.at.z - f.pos.z) - f.heading)), -HEAD.yaw, HEAD.yaw) : 0;
      const wantYaw = watching ? toHim : hunting ? 0 : Math.sin(c.now / 1900 + sweepPhase) ** 3 * HEAD.sweep;   // (patrolling: it looks ahead, then sweeps to a side and back)
      const wantPitch = hunting || watching ? Math.atan2(lampY - 1.1, d) : SPOT.patrol + Math.sin(c.now / 900 + sweepPhase) * 0.12;
      aimYaw = ease(aimYaw, wantYaw, wind ? 12 : 3, dt); aimPitch = ease(aimPitch, wantPitch, 6, dt);
      headYaw.rotation.y = Math.round(aimYaw / 0.06) * 0.06;
      const pitch = Math.round(aimPitch / 0.04) * 0.04 - o.pitch, tip = THREE.MathUtils.clamp(pitch, -HEAD.up, HEAD.down);
      head.rotation.x = tip; light.rotation.x = pitch - tip;
      for (const r of rings) r.rotation.z += dt * (hunting ? 3 : 0.8);
      // the shutter closes in notches through the beam's wind-up: the light narrows to a shaft and brightens
      close = id === 'beam' && wind ? Math.floor(c.wind * 5) / 5 : id === 'beam' && strike ? 1 : 0;
      shutter.forEach((s) => { s.position.y = lerp(lensR * 1.32, lensR * 0.42, close); });
      const aiming = id === 'beam' && (wind || strike);
      shaft.visible = aiming;
      if (aiming) { const len = Math.min(f.atk.range ?? 18, Math.hypot(d, lampY - 1)); const r = lerp(lensR, 0.05, close); shaft.scale.set(r, r, len); }
      lensM.uniforms.uGlow.value = 0.7 + close * 0.3;
      lensM.uniforms.uColor.value.set(close > 0.7 ? '#ffffff' : eyeColor(f, P.lens ?? '#d27f45', '#ffb36a'));
      beamM.uniforms.uGlow.value = 0.45 + close * 0.5;
      // the harpoon gun slides out under the hub as it aims, and turns with the head
      gun.visible = aiming;
      if (aiming) { gun.position.z = lerp(-0.25, 0.2, wind ? Math.min(1, c.wind * 1.6) : 1); gun.rotation.set(Math.round(aimPitch / 0.04) * 0.04 * 0.6, headYaw.rotation.y, 0); }
      // the bolt flies down the beam as it strikes
      bolt.visible = id === 'beam' && strike;
      if (bolt.visible) bolt.position.z = Math.min(f.atk.range ?? 18, d) * Math.min(1, f.k / Math.max(0.05, f.atk.contact ?? 0.6));
      // the valves rattle before the vent; black steam from the head's exhaust as it walks, and a burst round its feet
      const rattle = id === 'vent' && wind ? c.wind : 0;
      valves.forEach((v, i) => { v.rotation.z = rattle ? Math.sin(c.now / 25 + i) * 0.5 * rattle : 0; });
      if ((c.moving && Math.random() < 0.06) || (rattle > 0.4 && Math.random() < 0.4) || Math.random() < 0.015) { const v = rattle > 0.4 ? valves[Math.floor(Math.random() * valves.length)] : vents[Math.floor(Math.random() * 2)]; c.spray(v.getWorldPosition(V()), ['#1a1620', '#3b2a4c'], 1, 0.6, -1.5); }
      if (props.has('bubbles') && Math.random() < 0.05) c.spray(vents[Math.floor(Math.random() * 2)].getWorldPosition(V()), ['#e4edf6', '#bccde2'], 1, 0.3, -2.5);
      if (id === 'vent' && strike && !f._vented) { f._vented = true; for (let i = 0; i < 6; i++) c.spray(V(f.pos.x + Math.sin(i) * 1.2, f.pos.y + 0.4, f.pos.z + Math.cos(i) * 1.2), ['#1a1620', '#3b2a4c', '#6a5a7a'], 6, 3, -1); }
      if (!strike) f._vented = false;
      if (stamp > 0.6 && Math.random() < 0.3) c.spray(byName.thigh0.getWorldPosition(V()), ['#1a1620', '#3b2a4c'], 1, 0.8, -1);
      g.position.y += f.alt;   // (held up off its feet by the magnet glove)
      rig.write();
      skinLegs.write(f.heading, { air: f.alt > 0.05 ? 1 : 0 });
      // its light's spot: where the lamp's axis meets the ground (a few reads along it), its pool as wide as the beam there
      g.updateMatrixWorld(true);
      light.getWorldPosition(spot.from);
      _ld.set(0, 0, 1).applyMatrix3(_lm.setFromMatrix4(light.matrixWorld)).normalize();
      let t = SPOT.far, hit = false;
      if (_ld.y < -0.04 && c.ground) {
        t = Math.min(SPOT.far, (spot.from.y - f.pos.y) / -_ld.y);
        for (let k = 0; k < 3; k++) {
          _lf.copy(spot.from).addScaledVector(_ld, t);
          const gy = c.ground(_lf.x, spot.from.y, _lf.z) ?? f.pos.y;
          t = (spot.from.y - gy) / -_ld.y;
        }
        hit = t > 0.3 && t < SPOT.far;
      }
      if (hit) spot.at.copy(spot.from).addScaledVector(_ld, t);
      // (hunting, its beam on you: the pool round your feet, where the beam reaches you, not on the ground past you)
      const reach = hunting && Number.isFinite(f.dist) ? Math.hypot(d, lampY * (skin.scale ?? 1) - 1.1) : Infinity;
      if (reach < (hit ? t : Infinity) && reach < SPOT.far) {
        t = reach; hit = true;
        spot.at.copy(spot.from).addScaledVector(_ld, t);
        spot.at.y = c.ground?.(spot.at.x, spot.at.y + 1, spot.at.z) ?? f.pos.y;
      }
      spot.on = hit && f.state !== 'dead';
      if (hit) {
        const half = lerp(SPOT.half, SPOT.narrow, close);
        spot.r = Math.min(SPOT.most, (t * Math.tan(half)) / Math.sqrt(Math.max(0.2, -_ld.y)));
        spot.rTop = lensR * 0.9 * lerp(1, 0.4, close) * (skin.scale ?? 1);
      }
    },
    dispose() { M.dispose(); hide.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}
