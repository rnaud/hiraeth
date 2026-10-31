import * as THREE from 'three';
import { materials, add, many, pivot, finish, skinBy, merged, tubeGeometry, ease, eyeColor } from './kit.js';
import { HumanoidDriver, PROC_POSES } from '../humanoid-rig.js';
import { Wielder } from '../wield.js';
import { KING_MOVES, KING_HOLD } from './mummer.js';
import { skinWith } from './dune-mummer.js';
import { tripoBiped, gripAt, roleColours, surfaceAt, discOn, sideName } from './tripo-biped.js';

// The mummer king's body (issue #800, family G): the approved redesign (references/enemy-redesign-2026-10-30/
// keep-mummerking/71c2e792-…-1.png: a big teal pear that is head and body at once, three ochre crown rods, a cream oval
// mask with two black eyes, a terracotta belly patch and knee pads, huge cream gauntlets, cream boots with terracotta
// cuffs, a paddle club), modelled by Tripo from the agent's T-pose picks (keep-mummerking/tpose/; multiview task
// 43a873a0-…, biped rig 8dbd9159-…, Mixamo names, 23 joints, no fingers; the untouched exports in keep-mummerking/tripo/),
// made the game's asset by the trial's prepare.mjs (references/enemy-redesign-2026-10-30/trials/familyG-tripo/: 2.7 m to
// the crown's top, ten flat colours by part in the vertex colours, 12k triangles, Tripo's weights on every vertex),
// public/enemies/mummerking/, loaded by src/enemies/foe-assets.js. Posed directly on the humanoid foe rig
// (plans/tripo-biped.js): the clips move the very bones the mesh hangs on. Its old junk king (mummer.js
// legacyMummerKingModel) stands in while the asset loads.
//
// Kept from the junk king: its moves and holds (KING_MOVES, KING_HOLD: the smash and the royal swing in both fists, the
// horn call, the mummer held over its crown and thrown), its look (the head bone: the pear's top, mask, eyes and crown
// turn to the traveller), its eyes taking the wind-up's colour, its sitting by the fire. Its weapon is the approved
// image's paddle club (the door beam's length and reach: KING_HOLD's `beam`); the brass horn it calls the camp with is
// slung on its back as before (no horn in the approved image: the horn call is kept), brought round to its mask as it
// calls. The eyes: Tripo's painted ones painted out of the mask (prepare.mjs) and rebuilt as two black ovals a little
// proud of it, on the head bone (they glow as it winds up).

/** The reference's flat colours a part (prepare.mjs, skeleton.json palette), the roles' names. */
export const KING_TRIPO_HEIGHT = 2.7;
/** The paddle club's wood and the horn's brass (the reference's paddle, measured; the junk king's brass). */
const PADDLE = { wood: '#8f563a', band: '#5a3424', brass: '#d9b048', brassDark: '#9c7a2c' };

// (its horn call's arms by hand: the junk king's horn pose reached its cauldron 0.4 m before its chest; this pear stands
// out 0.35 m before its spine, so the horn's hands reach further forward and lean back less, to the mask's front)
Object.assign(PROC_POSES, { hornDeep: { l: [[0.3, 0.15, 0.94], [-0.45, 0.6, 0.66]], r: [[-0.3, 0.15, 0.94], [0.45, 0.6, 0.66]], lean: -0.1 } });
/** Its moves: the junk king's (KING_MOVES), the horn's arms its own. */
export const KING_TRIPO_MOVES = { ...KING_MOVES, horn: { ...KING_MOVES.horn, pose: 'hornDeep' } };

const BACK = new WeakMap();
/** How far back the pear's back is (m, z) at each height (once a source): where the horn is slung. */
function backOf(src) {
  const hit = BACK.get(src); if (hit) return hit;
  const P = src.geometry.attributes.position, back = (y0, y1) => { let z = 0; for (let v = 0; v < P.count; v++) { const y = P.getY(v); if (y > y0 && y < y1 && Math.abs(P.getX(v)) < 0.25) z = Math.min(z, P.getZ(v)); } return z; };
  const out = { low: back(1.0, 1.2), high: back(1.7, 1.9) };
  BACK.set(src, out);
  return out;
}

/** The paddle club along +y from the grip: a knob at the butt, a round haft, a band, the broad flat blade (the reference's). */
function paddleParts() {
  const wood = [
    new THREE.SphereGeometry(0.07, 10, 8).scale(1, 0.8, 1).translate(0, -0.3, 0),
    new THREE.CylinderGeometry(0.042, 0.048, 1.12, 10).translate(0, 0.27, 0),
    // (the blade: a rounded flat board, broad at its end, its edge toward the swing)
    new THREE.CylinderGeometry(0.17, 0.12, 0.44, 14, 1).scale(1, 1, 0.22).translate(0, 1.04, 0),
    new THREE.SphereGeometry(0.17, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 0.22).translate(0, 1.26, 0),
  ];
  const band = [new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10).translate(0, 0.8, 0), new THREE.CylinderGeometry(0.052, 0.052, 0.05, 10).translate(0, -0.2, 0)];
  return { wood, band };
}

/** The mummer king's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoMummerKingModel(skin, src) {
  const M = materials('mummerking', skin), S = src.rig, pal = S.palette;
  const g = new THREE.Group(); g.name = `${skin.name} · mummer king (Tripo)`;
  const B = tripoBiped(g, src, roleColours(skin, pal, 'desert'), { rigid: { glove: 'hand' }, gaze: { yaw: 0.6, up: 0.35, down: 0.45 } });
  const { J, look, gaze } = B, H = J.head;

  const builds = new Map(), tint = (hex) => { if (!builds.has(hex)) builds.set(hex, M.mat(`mkB${hex}`, hex)); return builds.get(hex); };
  const limbM = M.mat('mkLimb', '#ffffff', { vertexColors: true }), bodyM = M.mat('mkTripo', '#ffffff', { vertexColors: true });
  const dark = skin.tier ? 0.52 : 1, shade = (hex) => (dark === 1 ? hex : `#${new THREE.Color(hex).multiplyScalar(dark).getHexString()}`);
  // ---------------------------------------------------------------- the eyes: two black ovals on the head bone, proud of the mask
  const eyes = pivot(look, 0, 0, 0, 'eyes'), E = B.landmarks.eyes;
  look.updateWorldMatrix(true, false);
  const inLook = new THREE.Matrix4().copy(look.matrixWorld).invert();
  const eyeGeos = [E.left, E.right].map((e) => { const c = new THREE.Vector3(e.centre[0], e.centre[1], e.front + 0.004).applyMatrix4(inLook);
    return new THREE.SphereGeometry(1, 12, 8).scale(Math.max(0.022, e.w * 0.55), Math.max(0.04, e.h * 0.55), 0.012).translate(c.x, c.y, c.z); });
  const eyeM = M.own('eye', '#000000', { glow: 0.9 });
  add(eyes, merged(eyeGeos), eyeM);
  // ---------------------------------------------------------------- the belly patch and the knee pads: clean discs on the mesh
  // (the reference's: a broad terracotta disc low on the belly, a little to its right, a fifth of the way from the pear's
  // bottom to its eyes; a round pad on each knee's front; measured off the approved image by its eyes' spacing)
  const col = (role) => (B.colours ? B.colours(role) : pal[role]);
  const belly = surfaceAt(src, -0.05, 1.22, 0.05);
  if (belly) many(J.torso, [discOn(belly, 0.2, 0.165, 0.035, J.torso)], tint(col('patch')));
  for (const i of [0, 1]) {
    const k = B.at[`${sideName(i)}Leg`], pad = surfaceAt(src, k.x, k.y - 0.03, 0.06);
    if (pad) many(J.knees[i], [discOn(pad, 0.09, 0.09, 0.04, J.knees[i])], tint(col('knee')));
  }
  // ---------------------------------------------------------------- the paddle club through the right gauntlet's centre
  const R = gripAt(J, B.hands, 0, 'grip'), L = gripAt(J, B.hands, 1, 'grip l');
  const beam = pivot(R.grip, 0, 0, 0, 'beam');
  { const p = paddleParts(); many(beam, p.wood, tint(shade(PADDLE.wood))); many(beam, p.band, tint(shade(PADDLE.band))); }
  // ---------------------------------------------------------------- the horn slung across its back (the call: brought round to its mask)
  const back = backOf(src), hornNode = pivot(J.torso, 0, 0, 0, 'horn');
  const h0 = J.torso.position, hornPts = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8, y = 1.05 + 0.85 * u, z = THREE.MathUtils.lerp(back.low, back.high, u) - 0.06 - 0.08 * Math.sin(Math.PI * u); hornPts.push(new THREE.Vector3(0.38 - 0.75 * u, y - h0.y, z - h0.z)); }
  const bell = hornPts[8];
  many(hornNode, [tubeGeometry(hornPts, 0.035, 0.07), new THREE.CylinderGeometry(0.22, 0.07, 0.3, 16, 1, true).rotateZ(0.6).translate(bell.x - 0.1, bell.y + 0.08, bell.z)], tint(shade(PADDLE.brass)));
  many(hornNode, [new THREE.TorusGeometry(0.22, 0.018, 5, 18).rotateX(Math.PI / 2).rotateZ(0.6).translate(bell.x - 0.19, bell.y + 0.2, bell.z)], tint(shade(PADDLE.brassDark)));
  // ---------------------------------------------------------------- bound in the bind pose, then the rig's rest
  const body = skinWith(g, B.geo, bodyM, B.bones); body.name = 'tripo body';
  B.rest();
  skinBy(g, [{ from: [...builds.values()], into: limbM }]);
  const style = () => { J.legs[0].rotateZ(-0.06); J.legs[1].rotateZ(0.06); J.arms[0].rotateZ(-0.18); J.arms[1].rotateZ(0.18); };
  const driver = new HumanoidDriver(J, B.rig, { moves: KING_TRIPO_MOVES, speeds: { walk: 1.0, jog: 2.6, sprint: 5 }, style, seat: 0.3 });
  const wield = new Wielder(J, driver, { fists: [null, null], grips: [R.grip, L.grip], at: [R.at.toArray(), L.at.toArray()], weapons: KING_HOLD });
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [J.torso, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  let glow = 0;
  return {
    group: g, gaze, body: B.rig, rig: null, body3d: 'tripo', upright: true, ownRest: true, parts, eyeMat: eyeM, base: '#000000', size: skin.scale, skin: skin.id, tones: [pal.body, pal.mask, pal.crown],
    driver, joints: J, wield, fists: [null, null], archetype: 'mummerking', height: KING_TRIPO_HEIGHT,
    tripo: { eyes: eyeGeos.length, bones: B.bones.length, back },
    tell: (id) => (id === 'horn' ? hornNode : id === 'throw' ? J.hands[1] : R.grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      const want = driver.update(f, c);
      // the horn to its mask while it calls: brought round from its back, over its shoulder
      const calling = f.atk?.id === 'horn' && (f.state === 'wind' || f.state === 'strike'), k = calling ? Math.min(1, (f.k ?? 0) * 2) : 0;
      hornNode.position.set(0.1 * k, 0.28 * k, (0.75 - back.high) * k);
      hornNode.rotation.set(-0.3 * k, 0, 0);
      // the paddle in its fists (KING_HOLD); set down while it holds a mummer up or blows its horn, its hands open
      const away = !!(f.atk && (f.atk.id === 'throw' || f.atk.id === 'horn') && f.state !== 'chase' && f.state !== 'idle');
      beam.scale.setScalar(away ? 1e-3 : 1);
      wield.update(f, want, c, away ? null : 'beam');
      // the eyes: brighter as it winds up; red enraged
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, '#000000', '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.6 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}
