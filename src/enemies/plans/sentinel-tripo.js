import * as THREE from 'three';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, many, pivot, ease, finish, skinBy, merged } from './kit.js';
import { HumanoidDriver } from '../humanoid-rig.js';
import { Wielder } from '../wield.js';
import { SENTINEL_MOVES, SENTINEL_HOLD } from './sentinel.js';
import { droidGlow } from './droid.js';
import { skinWith } from './dune-mummer.js';
import { tripoBiped, gripAt, roleColours } from './tripo-biped.js';

// The sentinel's body (issue #800, family G): the approved redesign, the cistern keeper
// (references/enemy-redesign-2026-10-30/sentinel/395884ff-…-0.png: a squat heavy ceramic robot, a pale pink barrel with one seam round it, a short
// upright cylinder head on its top front with a black visor slit and one amber eye, purple-black ball joints, pink
// ceramic cylinders for its limbs, a dark slate pelvis band, slate-blue shins on broad pointed feet, dark grey fists, a
// big oval ceramic shield on its left arm and a short blade in its right fist), modelled by Tripo from the agent's T-pose
// picks (sentinel/tpose/; multiview task e57405cc-…, biped rig 10734146-…, Mixamo names, 23 joints; the untouched exports
// in sentinel/tripo/), made the game's asset by the trial's prepare.mjs (trials/familyG-tripo/: 2 m to the head's top,
// six flat colours by part in the vertex colours, 12k triangles, Tripo's weights on every vertex), public/enemies/sentinel/,
// loaded by src/enemies/foe-assets.js. Posed directly on the humanoid foe rig (plans/tripo-biped.js), its fists carried
// whole on the hands. Its old slim duelling droid (plans/sentinel.js legacySentinelModel) stands in while it loads.
//
// Kept from the old droid: its moves and holds (SENTINEL_MOVES, SENTINEL_HOLD: the thrust low at its hip, the cut over
// its right shoulder, the bash, the dash, the riposte out of its guard), its guard (the shield brought square before it,
// snapped up by two stings in a row, the turtle's bash), its light (droidGlow: the eye's wind-up, stunned and overloaded
// colours; its sparks overloaded), its look (the head bone: the cylinder head and its eye turn to the traveller), its
// scorched tier (DROID_TIER's ceramic and joints, its red eye).

export const SENTINEL_TRIPO_HEIGHT = 2.0;
/** Its broad pointed feet carried whole on its ankles, everything under this (m): Tripo's blend bent them at the ankle and a heel went 3 cm into a slope. */
export const SENTINEL_SOLES = 0.12;
/** The blade's and the shield's colours (the reference's: a brown leaf blade on a dark haft, the shield the body's ceramic). */
const ARMS = { blade: '#6d441b', haft: '#303f3c', rim: '#c9a996' };
const BLADE = 0.8;

/** The short blade along +y from the grip: a dark haft and a brown leaf-shaped blade, its edge toward +z (as plans/sentinel.js's). */
function bladeParts(L = BLADE) {
  const leaf = new THREE.CylinderGeometry(0.001, 0.075, L * 0.75, 4, 1).scale(1, 1, 0.22).translate(0, 0.2 + L * 0.375 + 0.05, 0);
  const root = new THREE.CylinderGeometry(0.075, 0.03, 0.1, 4, 1).scale(1, 1, 0.22).translate(0, 0.2, 0);
  const haft = [new THREE.CylinderGeometry(0.022, 0.026, 0.36, 8).translate(0, 0.0, 0), new THREE.SphereGeometry(0.032, 8, 6).translate(0, -0.19, 0)];
  for (const geo of [leaf, root, ...haft]) geo.rotateY(-Math.PI / 2);
  return { blade: [leaf, root], haft };
}
/** The big oval shield (the reference's): a shallow ceramic dish, face +z, rx × ry. */
function shieldParts(rx, ry) {
  // (a shallow cap of a sphere, its back closed by a flat disc)
  const dish = merged([new THREE.SphereGeometry(1, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(rx, ry, 0.06), new THREE.CircleGeometry(1, 28).rotateY(Math.PI).scale(rx, ry, 1)]);
  const rim = new THREE.TorusGeometry(1, 0.012, 4, 36).scale(rx * 0.97, ry * 0.97, 1).translate(0, 0, 0.004);
  return { dish, rim };
}

/** The sentinel's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoSentinelModel(skin, src) {
  const P = skin.palette, M = materials('sentinel', skin), S = src.rig, pal = S.palette;
  const g = new THREE.Group(); g.name = `${skin.name} · sentinel (Tripo)`;
  const B = tripoBiped(g, src, roleColours(skin, pal, 'desert', { own: { ceramic: P.ceramic, joint: P.joint } }), { rigid: { fist: 'hand' }, soles: SENTINEL_SOLES, gaze: { yaw: 0.7, up: 0.35, down: 0.4 } });
  const { J, look, gaze } = B;
  const builds = new Map(), tint = (hex) => { if (!builds.has(hex)) builds.set(hex, M.mat(`snB${hex}`, hex)); return builds.get(hex); };
  const limbM = M.mat('snLimb', '#ffffff', { vertexColors: true }), bodyM = M.mat('snTripo', '#ffffff', { vertexColors: true });
  const col = (role) => (B.colours ? B.colours(role) : pal[role]);
  const eyeM = M.own('eye', P.eye, { glow: 0.95 }), X = { eye: eyeM, seam: { uniforms: { uGlow: { value: 0 } } } };
  // ---------------------------------------------------------------- the eye: one amber lens in the visor slit, on the head bone
  const V = B.landmarks.visor, eyes = pivot(look, 0, 0, 0, 'eyes');
  look.updateWorldMatrix(true, false);
  const lensAt = new THREE.Vector3(V.centre[0] + 0.02, V.centre[1], V.front + 0.002).applyMatrix4(new THREE.Matrix4().copy(look.matrixWorld).invert());
  const lensR = Math.max(0.014, Math.min(0.03, V.h * 0.55));
  add(eyes, merged([new THREE.SphereGeometry(lensR, 12, 8).scale(1, 1, 0.5).translate(lensAt.x, lensAt.y, lensAt.z)]), eyeM);
  // ---------------------------------------------------------------- the blade through its right fist's centre
  const R = gripAt(J, B.hands, 0, 'grip');
  const bl = bladeParts();
  many(R.grip, bl.blade, tint(ARMS.blade)); many(R.grip, bl.haft, tint(ARMS.haft));
  // ---------------------------------------------------------------- the oval shield on its left forearm (kept facing out before it: anim)
  const strap = pivot(J.elbows[1], 0, -B.D.fore * 0.55, 0.0, 'shield');
  const sh = shieldParts(0.36, 0.55);
  add(strap, sh.dish, tint(col('ceramic')), 0, 0, 0.27); add(strap, sh.rim, tint(skin.tier ? col('joint') : ARMS.rim), 0, 0, 0.28);
  // ---------------------------------------------------------------- bound in the bind pose, then the rig's rest
  const body = skinWith(g, B.geo, bodyM, B.bones); body.name = 'tripo body';
  B.rest();
  skinBy(g, [{ from: [...builds.values()], into: limbM }]);
  // (its arms held out from its barrel over the clips; its legs the clips' own: a splay laid over them slid its planted feet)
  const style = () => { J.arms[0].rotateZ(-0.22); J.arms[1].rotateZ(0.22); };
  const driver = new HumanoidDriver(J, B.rig, { moves: SENTINEL_MOVES, speeds: { walk: 1.1, jog: 2.8, sprint: 5.5 }, style });
  const wield = new Wielder(J, driver, { grips: [R.grip, null], at: [R.at.toArray(), null], weapons: SENTINEL_HOLD });
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [J.torso, J.head, ...J.arms, ...J.elbows, ...J.hands, strap, R.grip, ...J.legs, ...J.knees, ...J.feet];
  const lagS = new SecondOrder(3.6, 0.55, 0.2);   // (the shield's servo)
  const st = { glow: 0 }, _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler();
  let guard = 0, broke = 0, over = 0;
  return {
    group: g, gaze, body: B.rig, rig: null, body3d: 'tripo', upright: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [pal.ceramic, pal.shin, pal.joint],
    driver, joints: J, height: SENTINEL_TRIPO_HEIGHT, wield, archetype: 'sentinel', tripo: { bones: B.bones.length, lens: lensR },
    tell: (id) => (id === 'bash' ? strap : R.grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 1e-4);
      guard = THREE.MathUtils.clamp(lagS.update(dt, f.guardK ?? 0), 0, 1.15);
      broke = ease(broke, f.reel === 'guardbroken' && (f.stunned > 0 || f.state === 'recover') ? 1 : 0, f.reel === 'guardbroken' ? 14 : 4, dt);
      const guarding = guard > 0.01 && f.state !== 'wind' && f.state !== 'strike' && !(f.downT > 0);
      const want = driver.update(f, c, { upper: guard > 0.01 ? { clip: 'ss_block_idle', w: Math.min(1, guard) } : null, pose: broke > 0.01 ? 'flung' : guarding ? 'swordBack' : null, poseW: broke > 0.01 ? broke : Math.min(1, guard) });
      const moving = want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover';
      wield.update(f, want, c, 'blade');
      // the shield kept facing out before it: the chest's heading, a little out to its left at rest, square in its guard
      // and its bash, flung out when broken; strapped along its forearm lying down
      g.updateMatrixWorld(true);
      J.torso.getWorldQuaternion(_qa); _eu.setFromQuaternion(_qa, 'YXZ');
      const bashing = f.atk?.id === 'bash' && moving;
      const out = 1.2 * (1 - Math.min(1, guard)) * (bashing ? 0.15 : moving ? 0.5 : 1) + broke * 0.9;
      _qb.setFromEuler(_eu.set(-0.05, _eu.y + out, 0, 'YXZ'));
      strap.parent.getWorldQuaternion(_qa).invert();
      strap.quaternion.copy(_qa.multiply(_qb));
      if (want.kind === 'down' || want.kind === 'pickup' || want.kind === 'sit' || want.kind === 'sleep') strap.quaternion.slerp(_qb.identity(), Math.min(1, driver.moveW));
      // overloaded (its low change, f.rage): its light burns red and it sparks now and then
      over = ease(over, f.rage ? 1 : 0, 3, dt);
      if (over > 0.5 && c.spray && Math.random() < dt * 3) c.spray(f.chest, [P.seam, '#fff0c0'], 3, 1.5, -1);
      droidGlow(f, X, P, st, dt, { over });
      return want;
    },
    dispose: M.dispose,
  };
}
