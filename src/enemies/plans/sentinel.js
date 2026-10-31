import * as THREE from 'three';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, many, skinBy, pivot, ease, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver, PROC_POSES } from '../humanoid-rig.js';
import { Wielder, SWORD_WRIST } from '../wield.js';
import { droidMaterials, droidGlow, lathe, lensParts } from './droid.js';

// The sentinel (issue #726, docs/design/enemy-roster-v4.md; its sheet: a new `sentinel/` folder under the enemy
// references, sheet-1): the makers' defunct duelling droid. A slim 2 m humanoid of weathered ivory ceramic panels over
// dark joints: a narrow smooth egg of a head with one round amber eye a little above its middle, three dark pipes for a
// neck, a chest of two broad plates over a dark ribbed waist, ball pauldrons, plated thighs and shins over big dark knees,
// flat shoes; a round shield of concentric rings on its left forearm, a straight single-edged blade in its right fist; a
// little moss in the collar and the joints. On the humanoid foe rig (src/enemies/humanoid-rig.js), modelled on the
// fencer's (src/enemies/plans/fencer.js), a kind of its own.
//
// What the body says (src/telegraph.js; nothing on the ground):
//   guard     the shield brought up square before it, the blade drawn back over its shoulder, point at you; it raises it
//             at once after two light cuts in a row (guard.stings) and answers a third with its riposte
//   riposte   (its guard's answer) the backhand out of the guard, quick
//   thrust    the blade drawn back low at its hip, the shield forward: then straight in
//   cut       the blade raised up over its right shoulder (the sheet's wind-up): then across
//   bash      its shield shoulder drawn back, the chest turned away: a plain guard won't hold it
//   dash      it sinks low and still, the blade back along its side, the eye flaring: then a sudden rush past you
//   overload  (low health, fight.low 'enrage') its seams and eye burn red and it sparks: everything quicker

const D = { hip: 1.0, hipX: 0.11, thigh: 0.45, shin: 0.46, chest: 0.48, shoulder: 0.23, upper: 0.3, fore: 0.28, neck: 0.11 };
/** The sentinel's proportions on the humanoid rig (humanoidSkeleton's D, m at size 1): 2 m to the top of its head. */
export const SENTINEL_BODY = D;
export const SENTINEL_HEIGHT = 2.0;
const BLADE = 0.8;
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler(), _dir = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);

// (its own arm poses, by hand over the clips' bodies: added to the rig's table, PROC_POSES)
Object.assign(PROC_POSES, {
  // the thrust's wind-up: the blade drawn back low at its right hip, point ahead; the shield forward; then the arm straight out
  lowThrust: { turn: -0.35, r: [[-0.3, -0.75, -0.6], [0.1, -0.15, 1]], l: [[0.3, -0.35, 0.88], [-0.45, 0.35, 0.82]], strike: { turn: 0.25, r: [[-0.08, 0.05, 1], [0, 0.05, 1]] } },
  // the dash: sunk and still, the blade laid back along its right side, the shield before its chest
  dashLow: { lean: 0.25, r: [[-0.35, -0.8, -0.5], [-0.1, -0.2, -1]], l: [[0.3, -0.3, 0.9], [-0.5, 0.4, 0.75]], strike: { r: [[-0.6, -0.1, 0.8], [-0.2, -0.1, 1]] } },
});

/**
 * Each move's clip (src/enemies/humanoid-rig.js stateClip): the sword-and-shield moves the traveller fights with; `pose`
 * the arms by hand over the clip's body (PROC_POSES). guard: ss_block_idle above the legs, the blade back (swordBack).
 */
export const SENTINEL_MOVES = {
  cut: { clip: 'ss_slash_1', from: 0.1, load: 0.45, cut: 0.6, to: 0.85 },
  riposte: { clip: 'ss_slash_3', from: 0.2, load: 0.5, cut: 0.82, to: 1.05 },
  thrust: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.6, to: 0.9, pose: 'lowThrust' },
  bash: { clip: 'ss_block_1', from: 0, load: 0.1, cut: 0.4, to: 0.55, pose: 'bash' },
  dash: { clip: 'ss_block_idle', from: 0, load: 0.5, cut: 0.7, to: 1.0, pose: 'dashLow', lean: 0.2 },
};
const SPEEDS = { walk: 1.1, jog: 2.8, sprint: 5.5 };
/**
 * How it holds its blade (src/enemies/wield.js, #744; dirs in the chest's frame: x its left, y up, z ahead): carried
 * point down and forward; the cut raised up and back over its right shoulder (the sheet's wind-up), then across to its
 * left; the riposte's backhand from over its left shoulder out to its right; the thrust's point ahead, drawn back low at
 * its hip, then in; the dash laid back along its side, then swept past you; in its guard drawn back over its shoulder,
 * the point at you over the shield.
 */
export const SENTINEL_HOLD = {
  blade: { side: 0, r: 0.021, wrist: SWORD_WRIST, edge: [0, 1], reach: [1.03, 0.14], carry: { dir: [0, -0.6, 0.8] },
    moves: {
      cut: { wind: [-0.35, 0.8, -0.48], via: [-0.68, 0.3, 0.67], hit: [0.75, -0.1, 0.65], follow: [0.6, -0.6, 0.5] },
      riposte: { wind: [0.55, 0.62, -0.56], via: [0.4, 0.2, 0.9], hit: [-0.8, 0, 0.6] },
      thrust: { wind: [0, 0.03, 1], hit: [0, 0.05, 1] },
      dash: { wind: [-0.1, 0.05, -1], hit: [-0.45, 0, 0.9] },
    },
    poses: { swordBack: { dir: [0.12, 0.3, 1] }, flung: { dir: [-0.7, 0.55, 0.3] } } },
};

/** The round shield: a shallow dish with three raised rings and a boss, face +z, `r` its radius. */
function shieldParts(r) {
  const dish = lathe([[0.001, 0.035], [r * 0.3, 0.032], [r * 0.7, 0.022], [r, 0], [r * 0.98, -0.02], [r * 0.6, -0.012], [0.001, -0.01]], 28).rotateX(Math.PI / 2);
  const rings = [0.86, 0.6, 0.32].map((k) => new THREE.TorusGeometry(r * k, 0.012, 5, 28).translate(0, 0, 0.036 - k * 0.02));
  const boss = new THREE.SphereGeometry(r * 0.16, 12, 8).scale(1, 1, 0.5).translate(0, 0, 0.04);
  // (the sheet's panels: four short bars between the outer rings)
  const bars = [0, 1, 2, 3].map((i) => new THREE.BoxGeometry(0.02, r * 0.22, 0.016).translate(0, r * 0.73, 0.03).rotateZ(i * Math.PI / 2 + Math.PI / 4));
  return { dish, rings, boss, bars };
}
/** The blade along +y from the grip: a dark hilt and a straight single-edged blade, its lit back edge apart. */
function bladeParts(L = BLADE) {
  const blade = new THREE.BoxGeometry(0.06, L, 0.012).translate(0, 0.1 + L / 2, 0);
  const tip = new THREE.CylinderGeometry(0.001, 0.03, 0.12, 3).scale(1, 1, 0.2).translate(0.015, 0.1 + L + 0.06, 0);
  const hilt = [new THREE.CylinderGeometry(0.02, 0.022, 0.17, 8).translate(0, -0.02, 0), new THREE.BoxGeometry(0.1, 0.03, 0.05).translate(0, 0.08, 0), new THREE.SphereGeometry(0.03, 8, 6).translate(0, -0.11, 0)];
  const edge = [new THREE.BoxGeometry(0.008, L * 0.9, 0.016).translate(-0.031, 0.12 + L * 0.45, 0)];
  // (its sharp edge, +x as built, turned to +z: the grip's knuckles' way, so the edge leads the cut, #744)
  for (const geo of [blade, tip, ...hilt, ...edge]) geo.rotateY(-Math.PI / 2);
  return { steel: [blade, tip], hilt, edge };
}

/**
 * The slim duelling droid (#726), the game's sentinel until #800: kept as the stand-in while the approved cistern
 * keeper's Tripo body loads (plans/sentinel-tripo.js), and so it can come back as a foe of its own.
 */
export function legacySentinelModel(skin) {
  const P = skin.palette, M = materials('sentinel', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, D), hull = J.torso, head = J.head;
  const X = droidMaterials(M, P), C = X.ceramicB, K = X.jointB, S = X.seamB, Mo = X.mossB;
  const steelB = M.mat('steelBuild', P.steel), steelM = M.own('steel', P.steel, { vertexColors: true, flat: false });
  // ---- the torso (its frame at the hips): a pelvis plate, a dark ribbed waist, an abdomen plate, two broad chest plates
  add(hull, lathe([[0.1, -0.16], [0.15, -0.12], [0.17, -0.02], [0.16, 0.06], [0.001, 0.07]], 16, 0.72), C);   // (the pelvis: a brief of ceramic)
  add(hull, lathe([[0.1, 0.02], [0.115, 0.1], [0.105, 0.22], [0.13, 0.3], [0.001, 0.3]], 14, 0.78), K);         // (the waist's dark core)
  many(hull, [0.07, 0.12, 0.17].map((y) => new THREE.TorusGeometry(0.118, 0.012, 4, 16).rotateX(Math.PI / 2).scale(1, 1, 0.78).translate(0, y, 0)), K);
  add(hull, lathe([[0.001, 0.2], [0.14, 0.21], [0.18, 0.28], [0.2, 0.33], [0.001, 0.34]], 16, 0.7), C);         // (the abdomen's V plate)
  add(hull, lathe([[0.001, 0.3], [0.19, 0.31], [0.22, 0.4], [0.23, 0.48], [0.18, 0.55], [0.08, 0.58], [0.001, 0.58]], 20, 0.66), C);   // (the chest)
  many(hull, [new THREE.BoxGeometry(0.012, 0.16, 0.02).translate(0, 0.42, 0.155), new THREE.BoxGeometry(0.2, 0.012, 0.02).translate(0, 0.33, 0.135)], K);   // (the panel lines between its plates)
  // amber seams down its sides at the waist and under the chest (the sheet's little lit marks)
  many(hull, [-1, 1].flatMap((s) => [new THREE.BoxGeometry(0.012, 0.09, 0.02).translate(s * 0.115, 0.12, 0.04).rotateY(s * 0.4), new THREE.BoxGeometry(0.05, 0.01, 0.015).translate(s * 0.12, 0.31, 0.11)]), S);
  // (the collar: dark, the neck's three pipes up to the head)
  add(hull, lathe([[0.001, 0.54], [0.1, 0.55], [0.08, 0.6], [0.001, 0.61]], 12, 0.8), K);
  // ---- the head: a narrow smooth egg, wider up top, the lens a little above its middle; the pipes of its neck below
  many(head, [-0.035, 0, 0.035].map((x) => new THREE.CylinderGeometry(0.014, 0.016, D.neck + 0.06, 6).translate(x, -0.04, x === 0 ? -0.025 : 0)), K);
  add(head, lathe([[0.001, 0.02], [0.065, 0.03], [0.1, 0.1], [0.118, 0.21], [0.116, 0.31], [0.092, 0.38], [0.048, 0.415], [0.001, 0.42]], 20, 1.12, 0.92), C);
  many(head, [new THREE.BoxGeometry(0.006, 0.12, 0.008).translate(0, 0.35, 0.124), new THREE.BoxGeometry(0.006, 0.08, 0.008).translate(0, 0.12, 0.125)], K);   // (its centre line)
  const lens = lensParts(0.032);
  add(head, lens.socket, K, 0, 0.245, 0.126);
  const eyes = new THREE.Group(); head.add(eyes); eyes.name = 'eyes';
  add(eyes, lens.glass, X.eye, 0, 0.245, 0.126);
  // ---- the arms: a ball pauldron, a dark upper arm with a ceramic cuff, a dark elbow, a plated forearm, a dark fist
  J.arms.forEach((sh, i) => {
    const s = i ? 1 : -1, el = J.elbows[i];
    add(sh, new THREE.SphereGeometry(0.062, 10, 8), K);
    add(sh, new THREE.SphereGeometry(0.105, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1, 0.95, 1).translate(s * 0.015, 0.02, 0), C);
    add(sh, new THREE.CylinderGeometry(0.042, 0.038, D.upper, 8).translate(0, -D.upper / 2, 0), K);
    add(sh, new THREE.CylinderGeometry(0.06, 0.052, D.upper * 0.5, 10).translate(0, -D.upper * 0.45, 0), C);
    add(el, new THREE.SphereGeometry(0.048, 8, 6), K);
    add(el, new THREE.CylinderGeometry(0.06, 0.046, D.fore * 0.82, 10).translate(0, -D.fore * 0.45, 0), C);
    many(el, [new THREE.BoxGeometry(0.008, D.fore * 0.5, 0.012).translate(s * 0.058, -D.fore * 0.45, 0)], S);
    many(J.hands[i], [new THREE.BoxGeometry(0.07, 0.1, 0.075).translate(0, -0.045, 0.005), new THREE.BoxGeometry(0.03, 0.05, 0.04).translate(-s * 0.035, -0.02, 0.03)], K);
  });
  // ---- the blade in its right fist (along the grip's +y)
  const grip = pivot(J.hands[0], 0, -0.045, 0, 'grip');
  const bl = bladeParts();
  many(grip, bl.steel, steelB); many(grip, bl.hilt, K); many(grip, bl.edge, S);
  // ---- the round shield on its left forearm, kept facing out before it whatever the arm does (turned in the world: anim)
  const strap = pivot(J.elbows[1], 0, -D.fore * 0.5, 0.05, 'shield');
  const sh = shieldParts(0.33);
  add(strap, sh.dish, C, 0, 0, 0.06); many(strap, [...sh.rings, sh.boss, ...sh.bars].map((x) => x.translate(0, 0, 0.06)), C);
  many(strap, [new THREE.TorusGeometry(0.33 * 0.47, 0.006, 4, 28).translate(0, 0, 0.098)], S);   // (a lit ring between the panels)
  // ---- the legs: dark thighs under ceramic plates, big dark knees, ceramic shins, flat ceramic shoes on dark soles
  const ankle = D.hip - D.thigh - D.shin;
  J.legs.forEach((leg, i) => {
    const s = i ? 1 : -1;
    many(leg, [new THREE.SphereGeometry(0.06, 8, 6), new THREE.CylinderGeometry(0.045, 0.05, D.thigh, 8).translate(0, -D.thigh / 2, 0)], K);
    add(leg, lathe([[0.06, -D.thigh * 0.92], [0.075, -D.thigh * 0.6], [0.082, -D.thigh * 0.25], [0.07, -0.02], [0.001, 0]], 12, 0.95), C);
    many(leg, [new THREE.BoxGeometry(0.008, D.thigh * 0.4, 0.014).translate(s * 0.078, -D.thigh * 0.45, 0)], S);
    const kn = J.knees[i];
    many(kn, [new THREE.SphereGeometry(0.068, 10, 8).scale(1, 1, 1.1), new THREE.CylinderGeometry(0.04, 0.045, D.shin, 8).translate(0, -D.shin / 2, 0)], K);
    add(kn, lathe([[0.045, -D.shin * 0.95], [0.058, -D.shin * 0.7], [0.07, -D.shin * 0.35], [0.06, -0.08], [0.001, -0.06]], 12, 1.05), C);
    many(J.feet[i], [new THREE.SphereGeometry(0.04, 8, 6)], K);
    many(J.feet[i], [new THREE.BoxGeometry(0.1, 0.03, 0.24).translate(0, 0.015 - ankle, 0.05)], K);
    add(J.feet[i], new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.058, 0.06, 0.125).translate(0, 0.03 - ankle, 0.05), C);
  });
  // ---- a little moss: in the collar, on a hip, behind a knee (the sheet's tufts)
  many(hull, [new THREE.SphereGeometry(0.035, 6, 5).scale(1.4, 0.6, 1).translate(0.07, 0.565, 0.07), new THREE.SphereGeometry(0.03, 6, 5).scale(1.3, 0.6, 1).translate(-0.06, 0.57, 0.08), new THREE.SphereGeometry(0.03, 6, 5).scale(1, 0.7, 1.2).translate(0.13, 0.04, 0.06)], Mo);
  many(J.knees[0], [new THREE.SphereGeometry(0.025, 6, 5).scale(1.4, 0.7, 1).translate(0.03, -0.06, 0.05)], Mo);
  const driver = new HumanoidDriver(J, rig, { moves: SENTINEL_MOVES, speeds: SPEEDS });
  const wield = new Wielder(J, driver, { grips: [grip, null], at: [[0, -0.05, 0.01], null], weapons: SENTINEL_HOLD });
  const gaze = [gazePart(g, head, { mode: 'turn' })];
  skinBy(g, [...X.sets, { from: [steelB], into: steelM }]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [hull, head, ...J.arms, ...J.elbows, ...J.hands, strap, grip, ...J.legs, ...J.knees, ...J.feet];
  const lagS = new SecondOrder(3.6, 0.55, 0.2);   // (the shield's servo)
  const st = { glow: 0 };
  let guard = 0, broke = 0, over = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, parts, eyeMat: X.eye, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.ceramic, P.seam, P.joint],
    driver, joints: J, height: SENTINEL_HEIGHT, wield,
    tell: (id) => (id === 'bash' ? strap : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 1e-4);
      guard = THREE.MathUtils.clamp(lagS.update(dt, f.guardK ?? 0), 0, 1.15);
      broke = ease(broke, f.reel === 'guardbroken' && (f.stunned > 0 || f.state === 'recover') ? 1 : 0, f.reel === 'guardbroken' ? 14 : 4, dt);
      const guarding = guard > 0.01 && f.state !== 'wind' && f.state !== 'strike' && !(f.downT > 0);
      const want = driver.update(f, c, { upper: guard > 0.01 ? { clip: 'ss_block_idle', w: Math.min(1, guard) } : null, pose: broke > 0.01 ? 'flung' : guarding ? 'swordBack' : null, poseW: broke > 0.01 ? broke : Math.min(1, guard) });
      const moving = want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover';
      // the blade in its fist (SENTINEL_HOLD)
      wield.update(f, want, c, 'blade');
      // the shield kept facing out before it: the chest's heading, a little out to its left at rest, square in its guard
      // and its bash, flung out when broken; strapped along its forearm lying down
      g.updateMatrixWorld(true);
      hull.getWorldQuaternion(_qa); _eu.setFromQuaternion(_qa, 'YXZ');
      const bashing = f.atk?.id === 'bash' && moving;
      const out = 1.2 * (1 - Math.min(1, guard)) * (bashing ? 0.15 : moving ? 0.5 : 1) + broke * 0.9;   // (at rest on its arm's outside, edge on from the front)
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
