import * as THREE from 'three';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, many, skinBy, pivot, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver } from '../humanoid-rig.js';
import { Wielder, SWORD_WRIST } from '../wield.js';

// The makers' fencer (issue #665; docs/design/combat-botw-study.md ranked changes 5-8; docs/systems/foes.md "The makers'
// fencer"): a sword-and-shield duelist that fights the way the traveller does. No design sheet was picked for it: it is
// built from the roster's parts (the humanoid's biped on the kit, the makers' plates and seams of their temples), kept
// simple so it reads at play distance: a little taller than you, ivory ceramic plates over a dark frame, a narrow helm
// with one round lens, a fin on top; a tall kite shield on its left forearm with a glowing seam down it, a straight
// blade with a glowing edge in its right hand. Futuristic ancient high tech, inked like the rest (no organic parts).
//
// On the humanoid foe rig (issue #724, src/enemies/humanoid-rig.js; it walked on the kit's `fencer` plan before): the
// traveller's sword-and-shield clips (FENCER_MOVES), its guard the block idle over its walk, its shield kept upright.
// Draws: every part of a material one skinned mesh on the rig's joints (kit.js skinBy), about eight.
//
// What the body says (src/telegraph.js; nothing on the ground):
//   guard     (f.guardK) the shield brought up square before it, the sword drawn back over its shoulder (#724: by hand,
//             `swordBack`, over the block's arms), its point at you: blows from the
//             front ring off; a charged cut throws the shield wide (f.reel 'guardbroken'): arms flung out, open
//   overhead  the sword raised high over its head in its fist, the shield lowered: answer it with the side hop
//   sweep     wound round to its right, the sword low behind its hip: answer it with the back flip
//   bash      its shield shoulder drawn back: a plain guard won't hold it (parry it, or hop away)
//   leap      crouched deep behind its shield, the sword back; then it leaps high and hangs (f.alt), the sword over
//             its head, and comes down on where you stood: a side hop, a parry, or an air cut to meet it in the air
//   disarmed  (f.disarmed) its sword flies out of its hand and lies where it fell; it fights with the shield alone and
//             runs for it, bends to pick it up (f.reel 'pickup': the long opening)

const HIP_Y = 0.92, SH = { x: 0.27, y: 1.5 }, NECK = 1.58, UPPER = 0.3, FORE = 0.3;
const BLADE = 0.95;
const _q = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _dir = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);

/** A lathe from (r, y) pairs (bottom to top), squashed front to back by `depth`. */
function lathe(profile, seg = 20, depth = 1) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (depth !== 1) geo.scale(1, 1, depth);
  geo.computeVertexNormals();
  return geo;
}
/** The kite shield's face: a tall plate rounded at the top, coming to a point below, a little curved; its long axis y, its face +z. */
export function shieldGeometry(w = 0.5, h = 0.86, t = 0.05) {
  const s = new THREE.Shape(), top = h * 0.5, low = -h * 0.5;
  s.moveTo(-w / 2, top * 0.55);
  s.quadraticCurveTo(-w / 2, top, 0, top);
  s.quadraticCurveTo(w / 2, top, w / 2, top * 0.55);
  s.lineTo(w / 2 * 0.86, low * 0.35);
  s.quadraticCurveTo(w / 2 * 0.5, low * 0.85, 0, low);
  s.quadraticCurveTo(-w / 2 * 0.5, low * 0.85, -w / 2 * 0.86, low * 0.35);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 8 });
  geo.translate(0, 0, -t / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) - (x * x) * 0.55); }   // (curved round the arm)
  geo.computeVertexNormals();
  return geo;
}
/** The sword along +y from the grip: pommel, grip, cross-guard, a straight blade to a point (its edge line apart). */
function swordParts(L = BLADE) {
  // (a diamond section, its flats facing ±x and its two edges ±z: the grip's knuckles' way, so an edge leads the cut,
  // #746; the cross-guard and the lit line down its middle across the edges)
  const blade = new THREE.CylinderGeometry(0.012, 0.035, L, 4, 1).scale(0.28, 1, 1).translate(0, 0.08 + L / 2, 0);
  const tip = new THREE.ConeGeometry(0.035, 0.12, 4).scale(0.28, 1, 1).translate(0, 0.08 + L + 0.06, 0);
  const hilt = [new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8).translate(0, -0.03, 0), new THREE.SphereGeometry(0.035, 8, 6).translate(0, -0.13, 0),
    new THREE.BoxGeometry(0.05, 0.035, 0.2).translate(0, 0.07, 0)];
  const edge = [new THREE.BoxGeometry(0.035, L * 0.92, 0.012).translate(0, 0.1 + L * 0.46, 0)];
  return { steel: [blade, tip], hilt, edge };
}

/** The fencer's proportions on the humanoid rig (humanoidSkeleton's D, m at size 1): a little taller than the traveller. */
export const FENCER_BODY = { hip: HIP_Y, hipX: 0.12, thigh: 0.42, shin: 0.42, chest: SH.y - HIP_Y, shoulder: SH.x, upper: UPPER, fore: FORE, neck: NECK - SH.y };
/**
 * Each move's clip (src/enemies/humanoid-rig.js stateClip; issue #724), the sword-and-shield and great-sword moves the
 * traveller fights with; `pose` a procedural pose of the shield arm over the clip's (two-handed clips: the shield kept
 * out of the sword's way):
 *   overhead  the charged cut's overhead (gs_slash_1): the sword high over its head, the shield lowered before its hip
 *   sweep     the slide attack's sweep (gs_slide_attack): sunk low, the sword wound back behind its right hip, then
 *             round at your knees; the shield held up before it
 *   leap      the jumping overhead (ss_attack_1), its own rise left out (the mind's arc lifts it): crouched behind the
 *             shield, both arms over its head at the top, down on the landing
 *   bash      the guard's block (ss_block_1) with the shield drawn back to its shoulder and punched out (`bash`)
 *   shove     the same with no sword
 * Its guard (f.guardK): the sword-and-shield block idle over everything, the shield square before it.
 */
export const FENCER_MOVES = {
  overhead: { clip: 'gs_slash_1', from: 0.2, load: 0.5, cut: 0.62, to: 0.95, pose: 'shieldDown' },
  sweep: { clip: 'gs_slide_attack', from: 0.7, load: 0.95, cut: 1.25, to: 1.45, pose: 'shieldUp' },
  leap: { clip: 'ss_attack_1', from: 0.1, load: 0.4, cut: 1.27, to: 1.5, ground: true },
  bash: { clip: 'ss_block_1', from: 0, load: 0.1, cut: 0.4, to: 0.55, pose: 'bash' },
  shove: { clip: 'ss_block_1', from: 0, load: 0.1, cut: 0.4, to: 0.55, pose: 'bash' },
};
const FENCER_SPEEDS = { walk: 1.0, jog: 2.6, sprint: 5 };
/**
 * How it holds its sword (src/enemies/wield.js, #744; dirs in the chest's frame: x its left, y up, z ahead): carried
 * forward and a little up out of its fist; the overhead raised high and back over its head, then down before it; the
 * sweep wound round low behind its right hip, swung across; the leap drawn back as it crouches, over its head in the
 * air, down on where you stood; its guard drawn back over its shoulder, the point at you over the shield.
 */
export const FENCER_HOLD = {
  sword: { side: 0, r: 0.022, wrist: SWORD_WRIST, edge: [0, 1], edges: 2, reach: [1.17, 0.17], carry: { dir: [0, 0.3, 0.95] },
    moves: {
      overhead: { wind: [-0.05, 0.5, -0.86], via: [0, 0.95, 0.3], hit: [0, -0.45, 0.89] },
      sweep: { wind: [-0.55, -0.15, -0.82], via: [-0.72, -0.1, 0.68], hit: [0.75, -0.1, 0.65] },
      leap: { wind: [-0.2, 0.25, -0.95], via: [-0.05, 0.95, -0.3], hit: [0, -0.5, 0.86] },
    },
    poses: { swordBack: { dir: [0.12, 0.3, 1] }, flung: { dir: [-0.7, 0.55, 0.3] } } },
};

export function fencerModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('fencer', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, FENCER_BODY), D = FENCER_BODY, hull = J.torso, head = J.head;
  // built in these; drawn as one skinned mesh a material on the rig's joints (kit.js skinBy)
  const plateB = M.mat('plateBuild', P.plate), frameB = M.mat('frameBuild', P.frame), trimB = M.mat('trimBuild', P.trim);
  const steelB = M.mat('steelBuild', P.steel), seamB = M.mat('seamBuild', P.seam), shieldB = M.mat('shieldBuild', P.shield);
  const plateM = M.mat('plate', P.plate, { vertexColors: true }), frameM = M.mat('frame', P.frame, { vertexColors: true });
  const trimM = M.mat('trim', P.trim, { vertexColors: true }), shieldM = M.mat('shield', P.shield, { vertexColors: true });
  const steelM = M.own('steel', P.steel, { vertexColors: true, flat: false });
  const seamM = M.own('seam', P.seam, { vertexColors: true, glow: 0.6, hatch: 0 });
  const eyeM = M.own('eye', P.eye, { glow: 0.95 });
  // (the torso's parts were drawn at their heights over the ground: the chest's joint is at the hips)
  const H0 = (geo) => geo.translate(0, -HIP_Y, 0);
  // the torso: a dark frame (the waist, the spine) under ivory plates (the chest, the back, a skirt of tassets)
  add(hull, H0(lathe([[0.12, 0.86], [0.17, 0.95], [0.15, 1.08], [0.14, 1.16], [0.17, 1.24], [0.001, 1.25]], 16, 0.8)), frameB);
  add(hull, H0(lathe([[0.001, 1.14], [0.19, 1.16], [0.25, 1.3], [0.27, 1.46], [0.22, 1.56], [0.1, 1.6], [0.001, 1.6]], 20, 0.72)), plateB);
  many(hull, [H0(new THREE.TorusGeometry(0.2, 0.02, 5, 20).rotateX(Math.PI / 2).scale(1, 1, 0.78).translate(0, 1.16, 0))], trimB);
  // the chest's seam: a line of light down its middle and round under the collar (the makers' glyph-lines, not the mark)
  many(hull, [H0(new THREE.BoxGeometry(0.025, 0.3, 0.02).translate(0, 1.33, 0.195)), H0(new THREE.TorusGeometry(0.14, 0.012, 4, 16, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI).scale(1, 1, 0.75).translate(0, 1.5, 0.04))], seamB);
  const skirt = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    skirt.push(H0(new THREE.BoxGeometry(0.15, 0.22, 0.03).translate(0, -0.11, 0).rotateX(0.18).translate(0, 0, 0.17).rotateY(a).translate(0, 0.98, 0)));
  }
  many(J.body, skirt.map((x) => x.translate(0, HIP_Y, 0)), plateB);   // (the tassets hang from the hips, not the chest)
  // the head: a narrow helm, one round lens in a dark visor band, a fin on top
  add(head, new THREE.CylinderGeometry(0.06, 0.08, 0.1, 10), frameB, 0, 0.02, 0);
  add(head, lathe([[0.001, 0.04], [0.11, 0.06], [0.135, 0.16], [0.13, 0.27], [0.09, 0.34], [0.001, 0.36]], 18, 0.92), plateB);
  add(head, new THREE.CylinderGeometry(0.128, 0.13, 0.07, 18, 1, true, -1.1, 2.2).scale(1, 1, 0.95).translate(0, 0.19, 0), frameB);
  many(head, [new THREE.BoxGeometry(0.02, 0.12, 0.26).translate(0, 0.38, -0.03), new THREE.BoxGeometry(0.02, 0.06, 0.14).translate(0, 0.42, -0.1)], trimB);
  const eyes = new THREE.Group(); head.add(eyes); eyes.name = 'eyes';
  add(eyes, new THREE.SphereGeometry(0.034, 12, 8).scale(1, 1, 0.5), eyeM, 0, 0.19, 0.125);
  // the arms on the rig's: a ball shoulder under a pauldron, an upper arm, an elbow, a plated forearm, a fist
  J.arms.forEach((sh, i) => {
    const s = i ? 1 : -1, el = J.elbows[i];
    add(sh, new THREE.SphereGeometry(0.075, 10, 8), frameB);
    add(sh, new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1.05, 0.9, 1).translate(s * 0.02, 0.02, 0), plateB);
    add(sh, new THREE.CylinderGeometry(0.06, 0.055, UPPER, 8).translate(0, -UPPER / 2, 0), frameB);
    add(el, new THREE.SphereGeometry(0.06, 8, 6), frameB);
    add(el, new THREE.CylinderGeometry(0.075, 0.06, FORE * 0.85, 10).translate(0, -FORE * 0.45, 0), plateB);
    many(el, [new THREE.TorusGeometry(0.07, 0.012, 4, 12).rotateX(Math.PI / 2).translate(0, -FORE * 0.82, 0)], trimB);
    add(J.hands[i], new THREE.SphereGeometry(0.055, 8, 6).scale(1, 1.1, 0.9), frameB);
  });
  // the sword in its right fist (along the grip's +y), and the one it drops (the same, its own node: f.disarmed)
  const grip = pivot(J.hands[0], 0, -0.02, 0, 'grip');
  const sw = swordParts(props.has('long') ? BLADE * 1.12 : BLADE);
  many(grip, sw.steel, steelB); many(grip, sw.hilt, trimB); many(grip, sw.edge, seamB);
  const dropped = pivot(g, 0, 0, 0, 'dropped sword');
  { const d = swordParts(props.has('long') ? BLADE * 1.12 : BLADE); many(dropped, [...d.steel, ...d.hilt], steelB); }
  // the shield strapped to its left forearm, kept upright before it whatever the arm does (turned in the world: anim)
  const strap = pivot(J.elbows[1], 0, -FORE * 0.55, 0.06, 'shield');
  const shG = shieldGeometry(props.has('round') ? 0.6 : 0.52, props.has('round') ? 0.66 : 0.88);
  add(strap, shG, shieldB, 0, 0, 0.11);
  // (its face: a lit seam down the middle from a brass ring at the top, two shorter ones either side of it)
  many(strap, [new THREE.BoxGeometry(0.022, 0.46, 0.02).translate(0, -0.08, 0.15), ...[-1, 1].map((s) => new THREE.BoxGeometry(0.018, 0.26, 0.02).translate(s * 0.1, -0.02, 0.14))], seamB);
  many(strap, [new THREE.TorusGeometry(0.07, 0.018, 5, 16).translate(0, 0.2, 0.15), new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1, 0.5).translate(0, 0.2, 0.15)], trimB);
  // (the Signal Market's banner: a pennant down the back)
  if (props.has('pennant')) many(hull, [H0(new THREE.BoxGeometry(0.22, 0.55, 0.01).translate(0, 1.18, -0.21))], trimB);
  // the legs on the rig's: dark thighs under ivory plates, ivory shin plates, flat plated feet
  const ankle = D.hip - D.thigh - D.shin;
  J.legs.forEach((leg, i) => {
    many(leg, [new THREE.SphereGeometry(0.065, 8, 6), new THREE.CylinderGeometry(0.05, 0.06, D.thigh, 8).translate(0, -D.thigh / 2, 0)], frameB);
    many(leg, [new THREE.CylinderGeometry(0.085, 0.07, D.thigh * 0.6, 10).translate(0, -D.thigh * 0.4, 0.01)], plateB);
    const kn = J.knees[i];
    many(kn, [new THREE.SphereGeometry(0.055, 8, 6), new THREE.CylinderGeometry(0.045, 0.05, D.shin, 8).translate(0, -D.shin / 2, 0)], frameB);
    many(kn, [new THREE.CylinderGeometry(0.075, 0.06, D.shin * 0.75, 10).translate(0, -D.shin * 0.5, 0.012), new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.8, 1.1).translate(0, -0.02, 0.03)], plateB);
    many(J.feet[i], [new THREE.SphereGeometry(0.05, 8, 6)], frameB);
    many(J.feet[i], [new THREE.BoxGeometry(0.11, 0.06, 0.24).translate(0, 0.04 - ankle, 0.06), new THREE.BoxGeometry(0.1, 0.03, 0.08).translate(0, 0.075 - ankle, 0.13)], plateB);
  });
  const driver = new HumanoidDriver(J, rig, { moves: FENCER_MOVES, speeds: FENCER_SPEEDS });
  const wield = new Wielder(J, driver, { grips: [grip, null], at: [[0, -0.03, 0.01], null], weapons: FENCER_HOLD });
  const gaze = [gazePart(g, head, { mode: 'turn' })];
  skinBy(g, [
    { from: [plateB], into: plateM }, { from: [frameB], into: frameM }, { from: [trimB], into: trimM },
    { from: [shieldB], into: shieldM }, { from: [steelB], into: steelM }, { from: [seamB], into: seamM },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [hull, head, ...J.arms, ...J.elbows, ...J.hands, strap, grip, ...J.legs, ...J.knees, ...J.feet];
  const lagS = new SecondOrder(3.2, 0.5, 0.2);   // (the shield's servo: a little overshoot as it comes up)
  let guard = 0, broke = 0, glow = 0;
  const local = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler(), _qy = new THREE.Vector3(0, 1, 0);
  return {
    group: g, gaze, body: rig, rig: null, upright: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.plate, P.seam, P.frame],
    driver, joints: J, wield,
    tell: (id) => (id === 'bash' || id === 'shove' ? strap : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind';
      const W = wind ? c.wind : 0;
      // the guard: the shield up square before it (the sword-and-shield block over the walk, on a servo with a little
      // overshoot); thrown wide when it is broken
      guard = THREE.MathUtils.clamp(lagS.update(dt, f.guardK ?? 0), 0, 1.15);
      broke = ease(broke, f.reel === 'guardbroken' && (f.stunned > 0 || f.state === 'recover') ? 1 : 0, f.reel === 'guardbroken' ? 14 : 4, dt);
      // (its sword drawn back over its right shoulder while it guards, #724: `swordBack`; not in a move of its own)
      const guarding = guard > 0.01 && f.state !== 'wind' && f.state !== 'strike' && !(f.downT > 0);
      const want = driver.update(f, c, { upper: guard > 0.01 ? { clip: 'ss_block_idle', w: Math.min(1, guard) } : null, pose: broke > 0.01 ? 'flung' : guarding ? 'swordBack' : null, poseW: broke > 0.01 ? broke : Math.min(1, guard) });
      g.position.y += f.alt;   // (the leap: up in the air over you, Foe.update's arc)
      // the sword: carried forward and up out of its fist; in a move or the guard, as the clip's fist holds the traveller's
      const moving = want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover';
      // (FENCER_HOLD; none in hand when it is knocked away)
      wield.update(f, want, c, f.disarmed ? null : 'sword');
      // the shield kept upright and facing out before it: its turn in the world the chest's heading, a little out to its
      // left at its side, square in its guard and its bash, flung out to its side when broken
      g.updateMatrixWorld(true);
      hull.getWorldQuaternion(_qa); _eu.setFromQuaternion(_qa, 'YXZ');
      const bashing = (f.atk?.id === 'bash' || f.atk?.id === 'shove') && moving;
      const out = 0.55 * (1 - Math.min(1, guard)) * (bashing ? 0.2 : 1) + broke * 0.9;
      _qb.setFromEuler(_eu.set(-0.08, _eu.y + out, 0, 'YXZ'));
      strap.parent.getWorldQuaternion(_qa).invert();
      strap.quaternion.copy(_qa.multiply(_qb));
      // (lying, kneeling, getting up: strapped along its forearm as the arm lies, not stood up)
      if (want.kind === 'down' || want.kind === 'pickup' || want.kind === 'sit' || want.kind === 'sleep') strap.quaternion.slerp(_qb.identity(), Math.min(1, driver.moveW));
      // the sword: in the hand, or flown out of it (f.disarmed): an arc to where it lands, turning, then lying flat
      const S = f.disarmed;
      // (skinned on the joints: a part is hidden by its joint shrunk to nothing, as the shade's sword)
      grip.scale.setScalar(S ? 1e-3 : 1);
      dropped.scale.setScalar(1e-3);
      if (S) {
        const fly = f.def.disarm?.fly ?? 0.6, u = Math.min(1, S.t / fly);
        local.lerpVectors(S.from, S.at, u); local.y += Math.sin(Math.PI * u) * 1.6 + (u >= 1 ? 0.03 : 0);
        g.worldToLocal(dropped.position.copy(local));
        // (its turn in the world: spinning end over end in the air, then lying on the ground pointing away)
        _eu.set(u < 1 ? S.t * 14 : Math.PI / 2, Math.atan2(S.at.x - S.from.x, S.at.z - S.from.z), 0, 'YXZ');
        // (turned on its haft first: its flats, ±x as built, up and down when it lies)
        _q.setFromEuler(_eu).multiply(_qb.setFromAxisAngle(_qy, Math.PI / 2));
        dropped.quaternion.copy(g.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(_q));
        dropped.scale.setScalar(1 / (skin.scale ?? 1));
      }
      // the lens and the seams: brighter as it winds up, dim when broken open
      glow = ease(glow, wind ? 0.5 + 0.5 * W : 0, 6, dt);
      eyeM.uniforms.uColor.value.set(broke > 0.5 || f.stunned > 0 ? '#bfe9ff' : eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.7 + glow * 0.3 - broke * 0.3;
      seamM.uniforms.uGlow.value = 0.45 + glow * 0.45 + Math.min(1, guard) * 0.15 - broke * 0.3;
      return want;
    },
    dispose: M.dispose,
  };
}
