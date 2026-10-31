import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder, quantise } from '../../motion-kit/spring.js';
import { materials, add, rod, pivot, lerp, ease, eyeColor, finish, skinBy, merged } from './kit.js';
import { gazePart } from '../gaze.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { droneLegacyModel } from './hover-legacy.js';

// The spool drone (issue #800): the game's `drone`, the ring drone, everywhere it is fielded (the City-Shaft, the Hangar,
// the Glass Dunes, the Garden of Spheres, the Antennas, Space City, the Fallen Ring, the temples' machines, the Arena,
// the gallery). Its body is Tripo's (task e25f40fd-…, from the approved image, references/enemy-redesign-2026-10-30/
// keep-drone/e708a0d0-…-0.png), made into the game's asset by the family E trial's prepare-drone.mjs (references/
// enemy-redesign-2026-10-30/trials/familyE-tripo/: the game's frame, its plates 1.4 m across, 12.8k triangles cut into
// its rigid parts by geometry, the reference's four flat colours, the painted eye out) and shipped by scripts/tripo/
// ship-body.mjs as public/enemies/drone/body.glb, loaded by src/enemies/foe-assets.js.
//
// A floating salvage spool: two thick cream plates, a slate cap on the top one, an olive-brown pod under the bottom one,
// and between them a dark core with one orange slit eye; a compact nozzle on the bottom plate's front, its retrieval
// line in it. No dangling arms (the reference's note: "remove dangling mechanisms and keep the tether role"). A machine's
// rig, rigid parts (the wood cutter's route, none bent: the plates part from the core, each whole on its own joint): the
// top plate spins on the axis, the bottom plate holds its nozzle to the front as it hunts and turns slowly as it idles,
// the core turns to look at the traveller (the author's rule, #800), its eye sliding the rest of the way. It hovers on
// springs, tilting into its drift with a servo's overshoot and turning in notches (the kit's `hover` plan, as the ring
// drone's). Five skinned meshes on one skeleton, one a colour role (each plate's cream, the cap, the core, the pod),
// each with its painted surface, the eye, and the fittings (the nozzle's reel ring, each world's dress) as one more.
//
// Its attacks read from the body (src/telegraph.js), as the ring drone's:
//   harpoon  the plates part and slow, the top tipping back, and the reel ring on its nozzle clicks round as the
//            nozzle turns on you; the harpoon flies out of it on its line and a hit reels you in (guard it to cut it)
//   ram      its plates lock and spin up, whining higher, as it rises rocked back; then it dives
// Between strikes it hides behind the world (foes.js COVER). Skins (src/enemies/skins.js): the reference's cream and
// slate in the City-Shaft, rust in its surface; mismatched plates (the Hangar); pearl (the Glass Dunes, the Garden of
// Spheres); a dish on its cap (the Antennas); a stripe round each plate (Space City); plates at odd angles (the Fallen
// Ring). Where the body is not loaded, the legacy ring drone (plans/hover-legacy.js) stands in.

/** The shipped body, under public/. */
export const DRONE_BODY = 'enemies/drone/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js), or null. */
export function droneSource() { const S = foeSource('drone'); return S ? (S.drone ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The drone's builder (src/enemies/plans/index.js): the Tripo body, or the legacy ring drone where it is not loaded. */
export function droneModel(skin) {
  const src = droneSource();
  return src ? tripoDroneModel(skin, src) : droneLegacyModel(skin);
}

/** The reference's flat colours (prepare-drone.mjs PALETTE): the home skin's (skins.js SKINS.drone.incal). */
export const DRONE_ROLES = { plate: '#ecc7a9', cap: '#4e5d63', core: '#1d2b26', pod: '#6a4a2e' };
/** The core's reach (rad): it turns between the plates (its yaw), hardly tips (its flat rim would touch them). */
const CORE = { yaw: 0.7, up: 0.04, down: 0.06 };
const _v = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(...a);

/** The drone's body (the model contract of plans/index.js), from the loaded source (droneSource). */
export function tripoDroneModel(skin, src) {
  const PL = PLANS.hover, L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('drone', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  // ---------------------------------------------------------------- the joints: the plates on the axis, the core about its own middle
  const YT = L.cuts.top, YB = L.cuts.bottom, coreAt = vec(L.core.at);
  const top = pivot(body, 0, YT, 0, 'top plate'), bottom = pivot(body, 0, YB, 0, 'bottom plate');
  const coreRoot = pivot(body, coreAt.x, coreAt.y, coreAt.z, 'core');
  const coreGaze = gazePart(g, coreRoot, { mode: 'turn', yaw: CORE.yaw, up: CORE.up, down: CORE.down });
  const bones = [body, top, coreGaze.node, bottom];
  // ---------------------------------------------------------------- the meshes: one a colour role, on one skeleton
  const geo = src.geometry, I = geo.index.array, n = geo.attributes.position.count;
  const J8 = geo.attributes.skinIndex, W8 = geo.attributes.skinWeight, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 4; k++) { SI[i * 4 + k] = J8.array[i * 4 + k]; s += W8.array[i * 4 + k]; } for (let k = 0; k < 4; k++) SW[i * 4 + k] = W8.array[i * 4 + k] / (s || 1); }
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(SI, 4), skinWeight: new THREE.BufferAttribute(SW, 4) };
  const tints = P.tints ?? [];   // (the scrap drone's mismatched plates: [bottom, —, top], the ring drone's three plates' order)
  const plateM = M.mat('plate', P.plate, { metal: P.metal ?? undefined, color: P.plate });
  const ROLE = {
    plateTop: tints[2] ? M.mat('plateTint2', tints[2]) : plateM, plateBottom: tints[0] ? M.mat('plateTint0', tints[0]) : plateM,
    cap: M.mat('cap', P.cap ?? P.under), core: M.mat('smoke', P.smoke, { flat: true }), pod: M.mat('pod', P.pod ?? P.brass),
  };
  // (the two plates one mesh where they wear one material: every skin but the Hangar's mismatched ones)
  const groups = [];
  for (const [role, range] of Object.entries(L.parts)) { if (!range[1]) continue; const same = groups.find((x) => x.mat === ROLE[role]); if (same) same.ranges.push(range); else groups.push({ role, mat: ROLE[role], ranges: [range] }); }
  const meshes = groups.map(({ role, mat, ranges }) => {
    const tris = ranges.flatMap(([first, count]) => Array.from(I.subarray(first * 3, (first + count) * 3)));
    const sm = new THREE.SkinnedMesh(subset(geo, tris, attrs), mat);
    sm.name = `drone ${role}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  // ---------------------------------------------------------------- the eye: an orange oval with a black slit on the core's front
  const eyeM = M.own('eye', P.eye, { glow: 0.3 }), slitM = M.mat('slit', P.dark ?? '#121410', { flat: true });
  const E = L.eye, eyeAt = vec(E.at).sub(coreAt);
  const eye = add(coreGaze.node, new THREE.CircleGeometry(0.5, 20).scale(E.w, E.h, 1), eyeM, eyeAt.x, eyeAt.y, eyeAt.z + 0.008); eye.name = 'eye';
  add(eye, new THREE.PlaneGeometry(0.016, E.h * 0.78), slitM, 0, 0, 0.003).name = 'slit';
  const gaze = [coreGaze, gazePart(g, eye, { mode: 'slide', slide: 0.03 })];
  // ---------------------------------------------------------------- the nozzle: its reel ring, its harpoon and line (shown as it fires)
  const brassB = M.mat('brassBuild', P.brass), accentB = M.mat('accentBuild', P.accent ?? P.brass), darkB = M.mat('darkBuild', P.dark);
  const mouth = vec(L.nozzle.mouth).sub(new THREE.Vector3(0, YB, 0)), root = vec(L.nozzle.root).sub(new THREE.Vector3(0, YB, 0));
  const gun = pivot(bottom, mouth.x, mouth.y, mouth.z, 'harpoon');
  gun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), mouth.clone().sub(root).normalize());
  const reel = pivot(gun, 0, 0, -0.035, 'reel');
  add(reel, new THREE.TorusGeometry(0.062, 0.016, 6, 14), brassB);
  for (let k = 0; k < 4; k++) add(reel, new THREE.BoxGeometry(0.018, 0.03, 0.03), darkB, Math.sin((k * Math.PI) / 2) * 0.075, Math.cos((k * Math.PI) / 2) * 0.075, 0);
  const steelM = M.mat('steel', P.steel ?? '#d0d4da');
  const harpoon = pivot(gun, 0, 0, -0.1, 'harpoon head');
  // (its shaft, its head and two barbs: one mesh)
  add(harpoon, merged([new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6).rotateX(Math.PI / 2), new THREE.ConeGeometry(0.045, 0.16, 4).rotateX(Math.PI / 2).translate(0, 0, 0.32),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.022, 0.1, 3).rotateX(-Math.PI / 2).rotateY(s * 0.5).translate(s * 0.04, 0, 0.22))]), steelM).name = 'harpoon';
  const line = add(gun, new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, 0.5, 0).rotateX(Math.PI / 2), M.mat('line', P.dark, { flat: true }), 0, 0, 0);
  line.visible = false; harpoon.visible = false;
  // ---------------------------------------------------------------- each world's dress
  const R = L.plates.top.r, TH = L.plates.top.hi - L.plates.top.lo;
  if (props.has('dish')) {
    // (the relay drone's: a shallow dish over its cap, a feed horn on three struts over it)
    const d = pivot(top, 0, L.plates.top.hi - YT + 0.02, 0, 'dish');
    add(d, new THREE.CylinderGeometry(R * 0.62, R * 0.2, 0.14, 24, 1, true), brassB, 0, 0.07, 0);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; rod(d, [Math.sin(a) * R * 0.5, 0.1, Math.cos(a) * R * 0.5], [0, 0.5, 0], 0.012, brassB); }
    add(d, new THREE.ConeGeometry(0.07, 0.16, 10).rotateX(Math.PI), brassB, 0, 0.56, 0);
  }
  if (props.has('stripe')) for (const [plate, B, y0] of [[top, L.plates.top, YT], [bottom, L.plates.bottom, YB]]) add(plate, new THREE.CylinderGeometry(B.r + 0.012, B.r + 0.012, (B.hi - B.lo) * 0.16, 32, 1, true), accentB, 0, (B.lo + B.hi) / 2 - y0, 0);
  // (the core's dark faces where the plates' flat faces met it: closing the plates and the core as they part)
  const coreB = M.mat('coreBuild', P.smoke), cr = L.core.r * 0.98;
  add(top, new THREE.CircleGeometry(cr, 28).rotateX(Math.PI / 2), coreB, coreAt.x, 0.004, coreAt.z);
  add(bottom, new THREE.CircleGeometry(cr, 28).rotateX(-Math.PI / 2), coreB, coreAt.x, -0.004, coreAt.z);
  add(coreRoot, new THREE.CircleGeometry(cr, 28).rotateX(-Math.PI / 2), coreB, 0, YT - coreAt.y - 0.006, 0);
  add(coreRoot, new THREE.CircleGeometry(cr, 28).rotateX(Math.PI / 2), coreB, 0, YB - coreAt.y + 0.006, 0);
  const tilt = props.has('gyro') ? { top: [-0.2, 0.25], bottom: [0.18, -0.22] } : { top: [0, 0], bottom: [0, 0] };
  const [fittings] = skinBy(g, [{ from: [brassB, accentB, darkB, coreB], into: M.mat('fittings', '#ffffff', { vertexColors: true }) }]);
  if (fittings) fittings.name = 'drone fittings';
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, bones, SI, RENDER_FRAME); }
  // (the small parts cast no shadow of their own: the plates' shadow is the drone's; the core hides between them)
  for (const m of [eye, eye.children[0], line, ...harpoon.children, fittings, ...meshes.filter((x) => x.material === ROLE.core)]) if (m) m.castShadow = false;
  const parts = [...meshes, eye];
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const B = PL.body, tiltX = new SecondOrder(B.spring.f, B.spring.z, B.spring.r), tiltZ = new SecondOrder(B.spring.f, B.spring.z, B.spring.r);
  const spin = [PL.plates.spin[2], PL.plates.spin[0]].map((x) => x * (0.85 + Math.random() * 0.3));
  const prev = { x: null, z: 0 };
  let part = 0, lock = 0, reach = 0, idleTurn = Math.random() * 6, aimTurn = 0;
  return {
    group: g, gaze, body, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.plate, P.cap ?? P.under, P.smoke], line, harpoon, tripo: 'tripo',
    tell: (id) => (id === 'harpoon' ? reel : top),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      g.position.y += f.alt + Math.sin(c.now / 520 + f.home.x) * B.bob;
      // it tilts into its drift with a servo's overshoot, and turns in notches (its aim moves in steps)
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      const tx = tiltX.update(dt, THREE.MathUtils.clamp(fwd * B.tilt, -B.tiltMax, B.tiltMax)), tz = tiltZ.update(dt, THREE.MathUtils.clamp(-side * B.tilt, -B.tiltMax, B.tiltMax));
      body.rotation.set(tx + P0.pitch, quantise(f.heading, PL.aim) - f.heading + P0.yaw, tz + P0.roll);
      body.position.set(0, P0.y, P0.z);
      // the plates: the top one spins; they part and slow for the harpoon, lock and spin up for the ram
      part = ease(part, (id === 'harpoon' && (wind || strike)) || c.tethered(f) ? 1 : 0, 6, dt);
      lock = ease(lock, id === 'ram' && (wind || strike) ? (strike ? 1 : c.wind) : 0, 5, dt);
      const still = f.stunned > 0 ? 0.15 : 1;
      top.rotation.y += dt * still * lerp(lerp(spin[0], PL.plates.lock, lock), spin[0] * 0.2, part);
      // (the bottom plate holds its nozzle ahead as it hunts, turns slowly round as it idles; locked, it spins with the top)
      const hunting = f.state !== 'idle' && f.state !== 'home';
      idleTurn += dt * still * spin[1] * 0.35;
      aimTurn = ease(aimTurn, hunting ? 0 : 1, 2, dt);
      const lockSpin = (bottom.userData.lockSpin = (bottom.userData.lockSpin ?? 0) + dt * PL.plates.lock * lock * -1.02);
      bottom.rotation.y = Math.atan2(Math.sin(idleTurn), Math.cos(idleTurn)) * aimTurn + (lock > 0.05 ? lockSpin : 0);
      if (lock <= 0.05) bottom.userData.lockSpin = 0;
      // (parted: the top plate lifts and tips back, the bottom one drops and tips forward, like jaws round the core)
      top.position.y = YT + 0.13 * part; top.rotation.x = tilt.top[0] - 0.26 * part; top.rotation.z = tilt.top[1];
      bottom.position.y = YB - 0.08 * part; bottom.rotation.x = tilt.bottom[0] + 0.14 * part; bottom.rotation.z = tilt.bottom[1];
      // the caught cloud leaks from the gap round the core as it breathes, more as the plates part
      if (Math.random() < 0.04 + part * 0.2) { const a = Math.random() * Math.PI * 2; c.spray(coreRoot.localToWorld(_v.set(Math.sin(a) * L.core.r, 0, Math.cos(a) * L.core.r)), [P.smoke, P.smoke2 ?? P.smoke], 1, 0.4, -1.2); }
      // the harpoon: the reel ring clicks round as it aims; the harpoon out along the line as it strikes
      reel.rotation.z = wind && id === 'harpoon' ? Math.floor(c.now / 90) * 0.5 : reel.rotation.z;
      reach = 0;
      if (id === 'harpoon' && strike) reach = (f.atk.range ?? 9) * Math.min(1, f.k / 0.7);
      const held = c.tethered(f);
      if (held) reach = held;
      harpoon.visible = part > 0.3 || reach > 0;
      harpoon.position.z = -0.1 + reach + part * 0.08;
      line.visible = reach > 0.2; line.scale.set(1, 1, Math.max(0.01, reach));
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#ff8a6a'));
    },
    dispose() { M.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}
