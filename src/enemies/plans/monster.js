import * as THREE from 'three';
import { materials, add, many, merged, skinBy, pivot, tubeGeometry, ease, eyeColor, finish, plate, shellPlate } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver, Sway, HOLD_AT } from '../humanoid-rig.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { lathe, tatters, limb, spearParts, bowParts } from './mummer.js';

// Roster v4's monsters (issue #726; docs/design/enemy-roster-v4.md): one roster in every world, its skin's colour the
// tier (src/enemies/skins.js tierSkin: the darker, banded one). On the humanoid rig like the mummers
// (src/enemies/humanoid-rig.js: the traveller's clips on their own proportions, the procedural layers on top).
//
// The grunt (`grunt`), to its picked sheet (references/enemy-archetypes/grunt/sheet-1.jpg): 1.3 m, the traveller's
// chest. A tomato-red monster, all head and belly: a big round head with knobbly bumps on its scalp, long pointed ears
// straight out to the sides, round yellow eyes under a heavy brow, a flat pig snout, a wide grin with two small tusks
// up from its lower jaw; a pot belly on short bowed legs, wide three-toed clawed feet; arms to its thighs, four-fingered
// clawed hands; a khaki loincloth with a ragged hem, a brown leather strap across its chest from its left shoulder with an
// iron ring at the front. In its fist a knobbly grey-brown club (its sheet's attack pose: both fists high over its head),
// or a spear or a bow from the camp's rack, or nothing (then it digs up rocks).
//
// The hulk (`hulk`), to its picked sheet (references/enemy-archetypes/hulk/sheet-1.jpg): 2.7 m, half again the
// traveller. Slate-blue skin, a pale icy belly, a hunched back: a small head low and forward between its shoulders, a
// heavy jaw with two lower fangs, one ivory horn up from its brow; long heavy arms to its knees, big four-fingered hands;
// thick legs, broad bare feet; a ragged kilt of hide patches (brown, olive, tan) on a rope belt knotted at the front. A
// long dark club with iron bands, a few studs on its head (the brief's "spiked"; the sheet draws only bands).
//
// Draws: every part of a material one skinned mesh on the rig's joints (kit.js skinBy): eight (grunt) and nine (hulk).

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _w = new THREE.Vector3();
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

/** A clawed hand hanging down its joint: a palm, three fingers and a thumb, each tipped with a claw (claws: bone). */
function clawHand(s, size = 1) {
  const r = 0.03 * size, skin = [new THREE.SphereGeometry(r * 1.7, 8, 6).scale(1.05, 1.15, 0.75).translate(0, -r * 1.3, 0)], claw = [];
  for (let i = -1; i <= 1; i++) {
    skin.push(new THREE.CapsuleGeometry(r * 0.62, r * 2.2, 3, 6).rotateX(0.45).translate(i * r * 1.1, -r * 3.5, r * 0.7));
    claw.push(new THREE.ConeGeometry(r * 0.38, r * 1.0, 5).rotateX(Math.PI - 0.2).translate(i * r * 1.1, -r * 5.1, r * 1.4));
  }
  skin.push(new THREE.CapsuleGeometry(r * 0.6, r * 1.6, 3, 6).rotateZ(s * 0.75).translate(s * r * 1.6, -r * 1.9, r * 0.8));
  claw.push(new THREE.ConeGeometry(r * 0.34, r * 0.8, 5).rotateZ(s * 2.2).translate(s * r * 2.6, -r * 2.6, r * 0.9));
  return { skin, claw };
}
/** A wide clawed foot on its ankle, toes splayed forward (`toes` of them), each with a claw (or a toenail). */
function clawFoot(size = 1, toes = 3) {
  const s = size, skin = [new THREE.SphereGeometry(0.06 * s, 9, 6).scale(1.15, 0.5, 1.45).translate(0, -0.01 * s, 0.03 * s)], claw = [];
  const half = (toes - 1) / 2;
  for (let i = 0; i < toes; i++) {
    const u = i - half, a = u * (toes > 3 ? 0.2 : 0.36), x = u * (toes > 3 ? 0.03 : 0.036) * s;
    skin.push(new THREE.CapsuleGeometry(0.02 * s, 0.05 * s, 3, 6).rotateX(Math.PI / 2).rotateY(a).translate(x, -0.022 * s, 0.1 * s));
    claw.push(new THREE.ConeGeometry(0.012 * s, 0.03 * s, 5).rotateX(Math.PI / 2 + 0.15).rotateY(a).translate(x + Math.sin(a) * 0.04 * s, -0.02 * s, 0.135 * s));
  }
  return { skin, claw };
}
/** Points along a curve on an ellipsoid's front (centre c, radii r): a mouth line from x0 to x1 at y(x). */
function onFace(c, r, xs, y) {
  return xs.map((x) => { const yy = y(x), k = 1 - ((x - c[0]) / r[0]) ** 2 - ((yy - c[1]) / r[1]) ** 2; return new THREE.Vector3(x, yy, c[2] + r[2] * Math.sqrt(Math.max(0, k)) + 0.004); });
}
const span = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

/** The grunt's knobbly club along +y from the grip: a log thickening to a lumpy head, leather wound round its grip. */
function knobClub(L = 0.82) {
  const wood = [new THREE.CylinderGeometry(0.068, 0.03, L, 8, 4).translate(0, L * 0.4, 0), new THREE.SphereGeometry(0.075, 9, 7).scale(1, 1.4, 1).translate(0, L * 0.84, 0)];
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4, y = L * (0.5 + 0.4 * ((i * 0.37) % 1)), rr = 0.05 + 0.03 * ((y / L - 0.4) / 0.6);
    wood.push(new THREE.SphereGeometry(0.02 + 0.008 * (i % 3), 6, 4).translate(Math.sin(a) * rr, y, Math.cos(a) * rr));
  }
  return { wood, leather: [0, 0.05, 0.1].map((y) => new THREE.TorusGeometry(0.034, 0.011, 4, 10).rotateX(Math.PI / 2).translate(0, y - 0.03, 0)) };
}
/** The hulk's long club along +y from the grip: a dark log thickening to its end, iron bands near it and at the grip, studs. */
function bandedClub(L = 1.75) {
  const wood = [new THREE.CylinderGeometry(0.12, 0.055, L, 10, 3).translate(0, L * 0.38, 0), new THREE.CylinderGeometry(0.11, 0.12, 0.06, 10).translate(0, L * 0.88 + 0.03, 0)];
  const iron = [L * 0.6, L * 0.78, L * 0.86].map((y) => new THREE.CylinderGeometry(0.035 + 0.075 * (y / L) + 0.012, 0.035 + 0.075 * (y / L) + 0.012, 0.05, 10).translate(0, y - L * 0.12, 0));
  iron.push(new THREE.CylinderGeometry(0.064, 0.064, 0.05, 10).translate(0, -0.02, 0));
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3, y = L * (0.66 + 0.06 * (i % 2)) - L * 0.12, rr = 0.1; iron.push(new THREE.ConeGeometry(0.02, 0.06, 5).rotateZ(-Math.PI / 2).translate(rr + 0.02, 0, 0).rotateY(a).translate(0, y, 0)); }
  return { wood, iron };
}

// ------------------------------------------------------------------ the grunt

/** Its proportions (m, at size 1): humanoidSkeleton's D. 1.3 m to the bumps on its scalp. */
export const GRUNT_BODY = { hip: 0.46, hipX: 0.12, thigh: 0.2, shin: 0.19, chest: 0.34, shoulder: 0.215, upper: 0.22, fore: 0.2, neck: 0.07 };
/** Each attack's clip (humanoid-rig.js stateClip): its anticipation `from` → `load` (the held telegraph), its cut, its follow-through. */
export const GRUNT_MOVES = {
  // the club overhead: the great sword's overhead (the charged cut's), both fists high with the club over its head and
  // leaning back on its heels (the sheet's attack pose); the step forward is the mind's lunge
  club: { clip: 'gs_slash_1', from: 0.2, load: 0.53, cut: 0.62, to: 1.05, lean: -0.18, pose: 'overhead' },
  // the lunge: the great sword's slide attack, sunk low with the club cocked back by its hip, then the spring (the mind
  // carries it 3.4 m across the strike)
  lunge: { clip: 'gs_slide_attack', from: 0.7, load: 0.95, cut: 1.25, to: 1.45 },
  // the rack's spear: the sword's thrust (the dash cut's), the shaft drawn back under its arm
  jab: { clip: 'ss_attack_2', from: 0.05, load: 0.45, cut: 0.57, to: 0.95 },
  // the rack's bow: the mummer's volley (the guard's braced stance, the arms by hand: side-on, the cord drawn back)
  volley: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'bow' },
  // the rock: the jumping overhead without its hop, the rock in both hands high over its head, held, thrown as it leaves
  rock: { clip: 'gs_jump_attack', from: 0.15, load: 0.85, cut: 1.1, to: 1.45, ground: true, release: 0.78 },
};
const GRUNT_SPEEDS = { walk: 0.6, jog: 1.8, sprint: 3.6 };

export function gruntModel(skin) {
  const P = skin.palette, M = materials('grunt', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, GRUNT_BODY), D = GRUNT_BODY;
  const skinB = M.mat('skinBuild', P.skin), clothB = M.mat('clothBuild', P.cloth), leatherB = M.mat('leatherBuild', P.leather), ironB = M.mat('ironBuild', P.iron);
  const woodB = M.mat('woodBuild', P.wood), boneB = M.mat('boneBuild', P.bone), inkB = M.mat('inkBuild', P.ink);
  const eyeM = M.own('eye', P.eye, { glow: 0.55 });
  const T = J.torso;
  // the pot belly: a round barrel from the hips to the shoulders, the belly a ball pushed out before it, a little low
  add(T, lathe([[0.001, -0.08], [0.17, -0.06], [0.235, 0.02], [0.255, 0.12], [0.25, 0.22], [0.245, 0.29], [0.215, 0.35], [0.12, 0.42], [0.001, 0.44]], 20, 0.84), skinB);
  many(T, [new THREE.SphereGeometry(0.24, 16, 12).scale(1, 0.95, 0.9).translate(0, 0.1, 0.075),
    // (its chest a little fuller under the strap; the shoulders' round)
    new THREE.SphereGeometry(0.15, 10, 8).scale(1.3, 0.75, 0.8).translate(0, 0.28, 0.05)], skinB);
  // its navel
  add(T, new THREE.SphereGeometry(0.012, 6, 4).scale(1, 0.6, 0.5), inkB, 0, 0.06, 0.29);
  // the leather strap across its chest from its left shoulder to its right hip, an iron ring at the front
  many(T, [new THREE.CylinderGeometry(0.29, 0.29, 0.05, 28, 1, true).rotateZ(0.62).scale(1, 1, 0.93).translate(0, 0.17, 0.03)], leatherB);
  many(T, [new THREE.TorusGeometry(0.03, 0.009, 5, 12).rotateZ(0.62).translate(0.06, 0.22, 0.3)], ironB);
  // the loincloth: a wrap round its hips under the belly, a ragged hem, a flap hanging down the front
  const hem = pivot(T, 0, -0.06, 0, 'hem');
  const flap = [];
  for (let i = 0; i < 6; i++) {
    const a = -0.55 + 0.22 * i, l = 0.13 + 0.05 * Math.abs(Math.sin(i * 2.1 + 0.5));
    flap.push(new THREE.ConeGeometry(0.06, l, 3, 1).rotateY(Math.PI / 6).scale(1, 1, 0.25).rotateX(Math.PI).translate(0, -l / 2, 0).rotateX(-0.08).translate(0, 0, 0.275).rotateY(a).scale(1, 1, 0.86).translate(0, -0.1, 0));
  }
  many(hem, [lathe([[0.28, -0.11], [0.25, -0.02], [0.235, 0.06]], 18, 0.86), ...tatters(9, 0.28, -0.1, 0.06, 0.86, 0.12), ...flap], clothB);
  // arms: short, thick, to its thighs; four-fingered clawed hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1, h = clawHand(s, 1.35);
    many(arm, [limb(D.upper, 0.06, 0.05), new THREE.SphereGeometry(0.082, 9, 7).scale(1, 1, 0.95)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.05, 8, 6), limb(D.fore, 0.05, 0.044)], skinB);
    many(J.hands[i], h.skin, skinB); many(J.hands[i], h.claw, boneB);
  });
  // legs: short and bowed, thick thighs, wide clawed feet
  J.legs.forEach((leg, i) => {
    const f = clawFoot(1.25, 3);
    many(leg, [limb(D.thigh, 0.075, 0.06), new THREE.SphereGeometry(0.08, 9, 7)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.058, 8, 6), limb(D.shin, 0.058, 0.048)], skinB);
    many(J.feet[i], f.skin, skinB); many(J.feet[i], f.claw, boneB);
  });
  // the head: big and round, a heavy brow, the flat snout, the wide grin with two small tusks, long pointed ears out to
  // its sides, knobbly bumps over its scalp; round yellow eyes with black pupils
  const H = J.head;
  const face = [0, 0.075, 0.075], faceR = [0.19, 0.12, 0.17];
  many(H, [new THREE.CylinderGeometry(0.1, 0.13, 0.08, 10).translate(0, -0.01, 0),
    new THREE.SphereGeometry(0.21, 16, 12).scale(1.07, 0.95, 0.95).translate(0, 0.17, 0.02),
    new THREE.SphereGeometry(1, 14, 10).scale(...faceR).translate(...face),
    new THREE.CapsuleGeometry(0.035, 0.2, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.9, 0.8).translate(0, 0.235, 0.165),
    new THREE.CylinderGeometry(0.07, 0.085, 0.07, 14).rotateX(Math.PI / 2).scale(1.45, 0.95, 1).translate(0, 0.125, 0.21),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.065, 0.34, 6).scale(1, 1, 0.32).rotateZ(-s * (Math.PI / 2 - 0.22)).rotateY(-s * 0.18).translate(s * 0.34, 0.215, -0.02)),
    ...Array.from({ length: 9 }, (_, i) => { const a = -1.2 + (i % 5) * 0.6, b = 0.55 + Math.floor(i / 5) * 0.4, r = 0.2; return new THREE.SphereGeometry(0.022 + 0.008 * (i % 2), 6, 4).translate(Math.sin(a) * Math.cos(b) * r * 1.07, 0.17 + Math.sin(b) * r * 0.95, Math.cos(a) * Math.cos(b) * r * 0.95 - 0.02); })], skinB);
  // (the grin: an ink line across its lower face; the nostrils; the tusks up from its lower jaw)
  many(H, [tubeGeometry(onFace(face, faceR, span(-0.13, 0.13, 9), (x) => 0.04 + 1.6 * x * x), 0.0045),
    ...[-1, 1].map((s) => new THREE.SphereGeometry(0.015, 6, 4).scale(1, 1.2, 0.5).translate(s * 0.035, 0.122, 0.246))], inkB);
  many(H, [-1, 1].map((s) => new THREE.ConeGeometry(0.017, 0.055, 6).rotateZ(-s * 0.15).translate(s * 0.085, 0.085, 0.215)), boneB);
  const eyes = pivot(H, 0, 0, 0, 'eyes');
  for (const s of [-1, 1]) add(eyes, new THREE.SphereGeometry(0.034, 10, 8).scale(1, 1, 0.6), eyeM, s * 0.078, 0.2, 0.185);
  many(H, [-1, 1].map((s) => new THREE.SphereGeometry(0.014, 6, 5).scale(1, 1, 0.5).translate(s * 0.074, 0.2, 0.207)), inkB);
  // the weapons: the club, the spear in the right fist, the bow in the left; each its own pivot (shown, hidden, dropped)
  const grip = pivot(J.hands[0], 0, -0.06, 0.012, 'grip'), gripL = pivot(J.hands[1], 0, -0.06, 0.012, 'grip l');
  const club = pivot(grip, 0, 0, 0, 'club'), spear = pivot(grip, 0, 0, 0, 'spear'), bow = pivot(gripL, 0, 0, 0, 'bow');
  const build = (node, parts) => { for (const [k, geos] of Object.entries(parts)) many(node, geos, { wood: woodB, rope: leatherB, leather: leatherB, iron: ironB, rag: clothB }[k]); };
  build(club, knobClub()); build(spear, spearParts(1.55)); build(bow, bowParts(0.4));
  const dropped = pivot(g, 0, 0, 0, 'dropped weapon');
  const dClub = pivot(dropped, 0, 0, 0, 'dropped club'), dSpear = pivot(dropped, 0, 0, 0, 'dropped spear'), dBow = pivot(dropped, 0, 0, 0, 'dropped bow');
  build(dClub, knobClub()); build(dSpear, spearParts(1.55)); build(dBow, bowParts(0.4));
  const held = { club, spear, bow }, lying = { club: dClub, spear: dSpear, bow: dBow };
  // (its stance over the clip's: bow-legged, the feet turned out, a little hunched over its belly)
  const style = () => { J.legs[0].rotateZ(-0.12); J.legs[1].rotateZ(0.12); J.knees[0].rotateZ(0.08); J.knees[1].rotateZ(-0.08); J.feet[0].rotateZ(0.04); J.feet[1].rotateZ(-0.04); J.feet[0].rotateY(-0.2); J.feet[1].rotateY(0.2); };
  const driver = new HumanoidDriver(J, rig, { moves: GRUNT_MOVES, speeds: GRUNT_SPEEDS, style, seat: 0.14 });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.9, up: 0.5, down: 0.5 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [clothB], into: M.mat('cloth', P.cloth, vc) }, { from: [leatherB], into: M.mat('leather', P.leather, vc) },
    { from: [ironB], into: M.mat('iron', P.iron, vc) }, { from: [woodB], into: M.mat('wood', P.wood, vc) }, { from: [boneB], into: M.mat('bone', P.bone, vc) }, { from: [inkB], into: M.mat('ink', P.ink, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(2.6, 0.3, 0, 0.25);
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.cloth, P.ink],
    driver, joints: J,
    tell: (id) => (id === 'volley' ? gripL : id === 'rock' ? J.hands[0] : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      const want = driver.update(f, c);
      const sw = sway.update(dt, driver.speed, f.heading);
      hem.rotation.set(sw.x, 0, sw.z);
      // what it holds (f.weapon: 'club', 'spear', 'bow', or 'none'); nothing while it is disarmed or off to the rack
      const W = f.disarmed ? null : f.weapon ?? 'club';
      for (const [k, node] of Object.entries(held)) node.scale.setScalar(k === W ? 1 : 1e-3);
      const move = want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover' ? driver.moveW : 0;
      // (carried: the club down along its thigh, head forward; the spear upright; the bow upright before it)
      if (W === 'spear') grip.rotation.set(0.25, 0, 0.1); else grip.rotation.set(Math.PI / 2 - 0.3, 0, 0.1);
      // (the overhead: the arms are the pose's, the club up out of its fists and back over its head)
      if (want.pose === 'overhead') grip.rotation.set(Math.PI - 0.5, 0, 0);
      gripL.rotation.set(0.15, 0, Math.PI / 2 - 0.15);
      driver.gripFrom(grip, 0, move); driver.gripFrom(gripL, 1, move);
      // one it dropped lies where it fell (not one it is off to take from the rack)
      for (const node of Object.values(lying)) node.scale.setScalar(1e-3);
      const S = f.disarmed, lie = S && !S.rack ? lying[f.droppedWeapon ?? f.weapon] : null;
      if (lie) {
        g.updateMatrixWorld(true);
        const fly = f.def.disarm?.fly ?? 0.5, u = Math.min(1, S.t / fly);
        _w.lerpVectors(S.from, S.at, u); _w.y += Math.sin(Math.PI * u) * 1.1 + (u >= 1 ? 0.04 : 0);
        g.worldToLocal(lie.position.copy(_w));
        _e.set(u < 1 ? S.t * 12 : Math.PI / 2, Math.atan2(S.at.x - S.from.x, S.at.z - S.from.z), 0, 'YXZ');
        lie.quaternion.copy(g.getWorldQuaternion(_q).invert().multiply(new THREE.Quaternion().setFromEuler(_e)));
        lie.scale.setScalar(1 / (skin.scale ?? 1));
      }
      // the rock: dug up, held over its head, then flying to its mark (a lob: Foes.animKit, its landing shown)
      if (f.atk?.id === 'rock' && f.state === 'wind' && f.k > 0.78) c.lob(f, (f.k - 0.78) / 0.22, P.rock); else c.lob(f, -1, P.rock);
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

// ------------------------------------------------------------------ the hulk

export const HULK_BODY = { hip: 1.22, hipX: 0.25, thigh: 0.565, shin: 0.535, chest: 0.84, shoulder: 0.5, upper: 0.66, fore: 0.58, neck: 0.1 };
export const HULK_MOVES = {
  // the smash: the great sword's overhead, the club high behind its horn in both fists, leaning back
  smash: { clip: 'gs_slash_1', from: 0.25, load: 0.53, cut: 0.62, to: 1.05, lean: -0.12 },
  // the sweep: the great sword's wide third swing, its whole hunched back twisted away
  sweep: { clip: 'gs_slash_3', from: 0.1, load: 0.5, cut: 0.86, to: 1.15, pose: 'glaiveHigh' },
  // the stomp: no stomp clip: the guard's braced stance for the body, the arms flung up by hand (`stomp`), one foot raised
  // high by its model's style and stamped down in the strike
  stomp: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'stomp' },
  // the throw: the mummer king's (the jumping overhead without its hop), the grunt held high over its horn, then hurled
  // as it lets go (`release`: CARRY.fly, src/foes.js)
  throw: { clip: 'gs_jump_attack', from: 0.15, load: 0.85, cut: 1.1, to: 1.45, ground: true, release: 0.78, lean: -0.1 },
};
const HULK_SPEEDS = { walk: 1.0, jog: 2.4, sprint: 4.6 };
/** Its hunch over the clip's pose (rad: the chest forward, the head back up to look ahead); the stomp's foot (rad). */
export const HULK_STANCE = { hunch: 0.26, look: -0.3, stomp: { thigh: 1.5, knee: 1.55, foot: -0.1 } };

export function hulkModel(skin) {
  const P = skin.palette, M = materials('hulk', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, HULK_BODY), D = HULK_BODY;
  const skinB = M.mat('skinBuild', P.skin), bellyB = M.mat('bellyBuild', P.belly), hideB = M.mat('hideBuild', P.hide), ropeB = M.mat('ropeBuild', P.rope);
  const woodB = M.mat('woodBuild', P.wood), ironB = M.mat('ironBuild', P.iron), hornB = M.mat('hornBuild', P.horn), inkB = M.mat('inkBuild', P.ink);
  const eyeM = M.own('eye', P.eye, { glow: 0.5 });
  const T = J.torso;
  // a great barrel of a body: narrow hips, the chest and the shoulders broad, the hump of its back high
  add(T, lathe([[0.001, -0.1], [0.3, -0.08], [0.38, 0.04], [0.43, 0.22], [0.48, 0.44], [0.53, 0.62], [0.5, 0.76], [0.32, 0.88], [0.001, 0.92]], 24, 0.76), skinB);
  many(T, [new THREE.SphereGeometry(0.38, 12, 9).scale(1.35, 0.72, 0.85).translate(0, 0.76, -0.1)], skinB);
  // the pale belly pushed out before it
  add(T, new THREE.SphereGeometry(0.42, 18, 14).scale(1, 1.0, 0.74).translate(0, 0.26, 0.19), bellyB);
  add(T, new THREE.SphereGeometry(0.02, 6, 4).scale(1.4, 0.6, 0.5), inkB, 0, 0.2, 0.5);
  // the kilt of hide patches on its rope belt, a knot at the front, its hem ragged and longer before and behind
  const hem = pivot(T, 0, -0.06, 0, 'hem');
  const kiltFlap = [];
  for (let i = 0; i < 7; i++) {
    const a = -0.6 + 0.2 * i + (i % 2) * 0.03, l = 0.2 + 0.12 * Math.abs(Math.sin(i * 1.9 + 0.4));
    kiltFlap.push(new THREE.ConeGeometry(0.13, l, 3, 1).rotateY(Math.PI / 6).scale(1, 1, 0.25).rotateX(Math.PI).translate(0, -l / 2, 0).rotateX(-0.1).translate(0, 0, 0.6).rotateY(a).scale(1, 1, 0.8).translate(0, -0.38, 0));
  }
  many(hem, [lathe([[0.6, -0.4], [0.55, -0.24], [0.47, -0.06], [0.42, 0.08]], 24, 0.8),
    ...tatters(15, 0.6, -0.38, 0.16, 0.8, 0.17), ...kiltFlap], hideB);
  many(hem, [new THREE.TorusGeometry(0.45, 0.03, 5, 28).rotateX(Math.PI / 2).scale(1, 1, 0.8).translate(0, 0.02, 0),
    new THREE.SphereGeometry(0.055, 7, 5).translate(-0.05, 0.01, 0.37), ...[-0.08, -0.02].map((x, i) => new THREE.CylinderGeometry(0.022, 0.017, 0.4 + i * 0.1, 5).rotateX(-0.12).translate(x, -0.2 - i * 0.05, 0.4))], ropeB);
  // long heavy arms to its knees, big four-fingered hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1, h = clawHand(s, 2.5);
    many(arm, [limb(D.upper, 0.16, 0.13), new THREE.SphereGeometry(0.16, 11, 8).scale(1, 1.15, 1)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.13, 9, 7), limb(D.fore, 0.14, 0.11)], skinB);
    many(J.hands[i], h.skin, skinB); many(J.hands[i], h.claw, hornB);
  });
  // thick legs, broad bare feet with five toes
  J.legs.forEach((leg, i) => {
    const f = clawFoot(2.45, 5);
    many(leg, [limb(D.thigh, 0.24, 0.17), new THREE.SphereGeometry(0.25, 11, 8)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.17, 9, 7), limb(D.shin, 0.17, 0.12)], skinB);
    many(J.feet[i], f.skin, skinB); many(J.feet[i], f.claw, hornB);
  });
  // the head: small, low and forward on its thick neck; a heavy brow, a broad flat nose, the heavy jaw with two fangs
  // up from it, small pointed ears; one ivory horn up from its brow
  const H = J.head;
  const face = [0, 0.07, 0.1], faceR = [0.18, 0.12, 0.17];
  // (its head thrust forward of its neck: the sheet's side view)
  many(H, [new THREE.CylinderGeometry(0.17, 0.25, 0.26, 12).rotateX(0.5).translate(0, -0.04, 0.04)], skinB);
  const Hf = pivot(H, 0, -0.05, 0.13, 'face');
  many(Hf, [new THREE.SphereGeometry(0.2, 14, 11).scale(1, 1.02, 1).translate(0, 0.17, 0.04),
    new THREE.SphereGeometry(1, 14, 10).scale(...faceR).translate(...face),
    new THREE.CapsuleGeometry(0.035, 0.2, 4, 8).rotateZ(Math.PI / 2).translate(0, 0.21, 0.2),
    new THREE.SphereGeometry(0.045, 8, 6).scale(1.3, 0.9, 1).translate(0, 0.14, 0.26),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.045, 0.13, 5).scale(1, 1, 0.35).rotateZ(-s * 1.2).translate(s * 0.22, 0.2, 0.0))], skinB);
  many(Hf, [tubeGeometry(onFace(face, faceR, span(-0.11, 0.11, 7), (x) => 0.04 - 0.4 * x * x), 0.006),
    ...[-1, 1].map((s) => new THREE.SphereGeometry(0.012, 6, 4).translate(s * 0.022, 0.125, 0.295))], inkB);
  many(Hf, [...[-1, 1].map((s) => new THREE.ConeGeometry(0.022, 0.07, 6).translate(s * 0.07, 0.065, 0.255)),
    new THREE.ConeGeometry(0.05, 0.2, 8).rotateX(-0.25).translate(0, 0.43, 0.12)], hornB);
  const eyes = pivot(Hf, 0, 0, 0, 'eyes');
  for (const s of [-1, 1]) add(eyes, new THREE.SphereGeometry(0.026, 9, 7).scale(1, 0.8, 0.6), eyeM, s * 0.07, 0.18, 0.22);
  many(Hf, [-1, 1].map((s) => new THREE.SphereGeometry(0.015, 6, 5).scale(1, 1, 0.5).translate(s * 0.07, 0.178, 0.236)), inkB);
  // the club in its right fist
  const grip = pivot(J.hands[0], 0, -0.13, 0.02, 'grip');
  const club = pivot(grip, 0, 0, 0, 'club');
  { const p = bandedClub(); many(club, p.wood, woodB); many(club, p.iron, ironB); }
  let cur = null;
  // (its hunch over the clip's: the chest forward, the head brought back up to look ahead; the stomp's raised foot)
  const style = (Jt, want) => {
    J.torso.rotateX(HULK_STANCE.hunch); J.head.rotateX(HULK_STANCE.look);
    J.legs[0].rotateZ(-0.06); J.legs[1].rotateZ(0.06);
    if (cur?.atk?.id !== 'stomp' || !want.clip) return;
    const k = want.kind === 'wind' ? smooth(want.load) : want.kind === 'strike' ? 1 - smooth((cur.k ?? 0) * 3) : 0, S = HULK_STANCE.stomp;
    if (k <= 0) return;
    J.legs[0].rotateX(-S.thigh * k); J.knees[0].rotateX(S.knee * k); J.feet[0].rotateX(S.foot * k);
    J.body.rotateZ(0.08 * k);   // (its weight over the other foot)
  };
  const driver = new HumanoidDriver(J, rig, { moves: HULK_MOVES, speeds: HULK_SPEEDS, style, seat: 0.36 });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.6, up: 0.35, down: 0.45 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [bellyB], into: M.mat('belly', P.belly, vc) }, { from: [hideB], into: M.mat('hide', P.hide, vc) },
    { from: [ropeB], into: M.mat('rope', P.rope, vc) }, { from: [woodB], into: M.mat('wood', P.wood, vc) }, { from: [ironB], into: M.mat('iron', P.iron, vc) },
    { from: [hornB], into: M.mat('horn', P.horn, vc) }, { from: [inkB], into: M.mat('ink', P.ink, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(1.6, 0.35, 0, 0.22);
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.belly, P.ink],
    driver, joints: J,
    tell: (id) => (id === 'throw' ? J.hands[1] : id === 'stomp' ? J.feet[0] : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      const sw = sway.update(dt, driver.speed, f.heading);
      hem.rotation.set(sw.x - HULK_STANCE.hunch, 0, sw.z);   // (its kilt hangs from its hips, not its hunch)
      // the club: hanging along its fist, head down and forward; set down while it holds a grunt up
      grip.rotation.set(Math.PI / 2 - 0.35, 0, 0);
      driver.gripFrom(grip, 0, want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover' ? driver.moveW : 0);
      club.scale.setScalar(f.atk?.id === 'throw' && f.state !== 'chase' && f.state !== 'idle' ? 1e-3 : 1);
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

// ------------------------------------------------------------------ the third batch's shared parts (issue #726)

/**
 * A spin of the whole body about its feet (a move's `spin`: the prowler's tail sweep, the warlord's last stand): through
 * the wind-up it turns `coil` rad away (side-on, its tail or its glaive drawn round behind it), complete at HOLD_AT and
 * held; through the strike it turns back round through `turns` whole turns, ending as it began. Pure: the angle (rad).
 */
export function spinAngle(want, k, M) {
  if (!M?.spin) return 0;
  const coil = M.spin.coil ?? 1, turns = M.spin.turns ?? 1, sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  if (want.kind === 'wind') return -coil * sm((k ?? 0) / HOLD_AT);
  if (want.kind === 'strike') return -coil + (coil + Math.PI * 2 * turns) * sm((k ?? 0) / (M.spin.over ?? 0.9));
  return 0;
}

/**
 * A tail of segments on pivots (each the next's parent, each along -z from its own), sprung (docs/systems/procedural-
 * animation.md, "Secondary motion"): every segment's pitch and yaw follow a target through a SecondOrder, softer down the
 * tail so the tip lags the root. The targets: its rest curve (down from the hips to the ground and along it), the body's
 * turn flung out through it, a lash running down it (`lash` 0..1: idle a sway, winding up a lash), raised straight out
 * at knee height (`sweep` 0..1: the tail sweep), curled up over its back (`curl` 0..1: the back-flip). Kept off the
 * ground it stands on.
 */
export class TailSpring {
  constructor(segs, rest, { len, flat = null } = {}) {
    const n = segs.length;
    this.segs = segs; this.rest = rest; this.len = len; this.flat = flat ?? rest.map((_, i) => [0.95, -0.45, -0.5][i] ?? 0);
    this.yaw = segs.map((_, i) => new SecondOrder(3.2 - (2.0 * i) / n, 0.45, 0));
    this.pitch = segs.map((_, i, a) => new SecondOrder(3.6 - (2.0 * i) / n, 0.55, 0, rest[i]));
    this.t = 0; this.last = null;
  }
  update(dt, heading, speed, o = {}) {
    const n = this.segs.length;
    let rate = 0;
    if (dt > 0 && this.last != null) rate = Math.max(-6, Math.min(6, (THREE.MathUtils.euclideanModulo(heading - this.last + Math.PI, Math.PI * 2) - Math.PI) / dt));
    this.last = heading;
    this.t += Math.max(0, dt);
    const lash = o.lash ?? 0.15, sweep = o.sweep ?? 0, curl = o.curl ?? 0, run = Math.min(1, (speed ?? 0) / 4);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const yawT = Math.max(-0.32, Math.min(0.32, rate * 0.06)) * (0.4 + u) * (1 - sweep)
        + lash * 0.42 * Math.sin(this.t * (2.2 + 5 * lash) - i * 0.75) * (0.3 + u) * (1 - 0.7 * sweep);
      let pitchT = this.rest[i] + (this.flat[i] - this.rest[i]) * sweep - curl * (i ? 0.38 : 0.7) - run * 0.18 * (1 - u) * (i < 2 ? 1 : 0.3);
      if (i > 0) pitchT += run * 0.06 * u;
      const y = this.yaw[i].update(dt, yawT), x = this.pitch[i].update(dt, pitchT);
      this.segs[i].rotation.set(-x, y, 0, 'YXZ');
    }
  }
  /**
   * Lift any segment whose end went under the ground (m, in the world: `floor`, or `at(x, y, z)` under its end where the
   * ground slopes) back over it, root to tip (one pass).
   */
  keepUp(floor, r = 0.04, at = null) {
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      s.updateMatrixWorld(true);
      _w.set(0, 0, -this.len).applyMatrix4(s.matrixWorld);
      const g = _w.y < floor + 0.6 ? at?.(_w.x, _w.y + 0.6, _w.z) : null;
      const under = (g ?? floor) + r - _w.y;
      if (under > 0) { s.rotation.x += Math.min(0.6, under / this.len); s.updateMatrixWorld(true); }
    }
  }
}

/** A flat curved blade along +y from y0, `L` long and `w` wide at its belly, curving toward +z (its edge), `t` thick. */
function curvedBlade(L, w, curve = 0.12, y0 = 0, t = 0.008, hook = false) {
  const S = new THREE.Shape(), n = 10;
  // the back (spine) up one side, the edge down the other: a crescent, its point curving forward
  for (let i = 0; i <= n; i++) { const u = i / n, y = y0 + L * u, z = curve * L * u * u - w * 0.35 * Math.sin(Math.PI * u) * (1 - u * 0.5); if (i) S.lineTo(z, y); else S.moveTo(z, y); }
  for (let i = n; i >= 0; i--) { const u = i / n, y = y0 + L * u * (1 - 0.04 * u), z = curve * L * u * u + w * (0.65 * Math.sin(Math.PI * Math.min(1, u * 1.1)) + 0.25 * (1 - u)) * (1 - u * 0.75); S.lineTo(z, y); }
  if (hook) { S.lineTo(-w * 0.2, y0 + L * 0.2); S.lineTo(-w * 0.75, y0 + L * 0.12); S.lineTo(-w * 0.2, y0 + L * 0.05); }
  const g = new THREE.ExtrudeGeometry(S, { depth: t, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -t / 2);
  // (the shape's x is our z: turned so its flat faces ±x, the edge toward +z)
  g.rotateY(-Math.PI / 2);
  return g;
}
/** A spiral (the warlord's ram horns): from the brow up, back, down round the ear and out forward, `turns` of a turn. */
function ramHorn(s, c, R0 = 0.14, R1 = 0.06, x0 = 0.08, x1 = 0.2, turns = 1.05, r0 = 0.068, r1 = 0.02) {
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18, a = Math.PI / 2 + u * turns * Math.PI * 2, R = R0 + (R1 - R0) * u;
    pts.push(new THREE.Vector3(s * (x0 + (x1 - x0) * Math.pow(u, 0.8)), c[1] + Math.sin(a) * R, c[2] + Math.cos(a) * R));
  }
  return tubeGeometry(pts, r0, r1);
}

// ------------------------------------------------------------------ the prowler

// The prowler (`prowler`), to its picked sheet (references/enemy-archetypes/prowler/sheet-1.jpg): 1.8 m to its crest,
// the traveller's height and a head. A lean leaf-green lizard on two long digitigrade legs: a long narrow head with a
// crest of short spines and wide-set yellow eyes, a cream throat running down its chest and belly and under its tail; a
// long tail to the ground and along it; thin arms with three long clawed fingers; one steel shoulder guard on its left
// shoulder on a strap across its chest; a short curved blade in its right fist. Draws: seven (skin, belly, steel,
// leather, bone, ink skinned on the rig and the tail's own joints; the eyes).

export const PROWLER_BODY = { hip: 0.9, hipX: 0.1, thigh: 0.38, shin: 0.44, chest: 0.5, shoulder: 0.21, upper: 0.31, fore: 0.29, neck: 0.14 };
/** Its digitigrade shank in the shin's frame: the hock (m back and down from the knee) the shin bends back to, the instep
 * running forward and down from it to the ankle's joint (the ball of its foot). */
export const PROWLER_SHANK = { hock: [0, -0.27, -0.1], ball: 0.03 };
export const PROWLER_MOVES = {
  // the slash: the sword's quick cut, drawn back across its chest and out flat
  slash: { clip: 'ss_slash_1', from: 0.1, load: 0.45, cut: 0.6, to: 0.85 },
  // the dart: the great sword's slide attack, crouched low on its bent legs with the blade drawn back (the sheet's attack
  // pose), its tail lashing; the dash across the gap is the mind's lunge (3.6 m)
  dart: { clip: 'gs_slide_attack', from: 0.7, load: 0.95, cut: 1.25, to: 1.45 },
  // the tail sweep: the guard's braced crouch, side-on (spinAngle's coil); then a whole turn about its feet, the tail
  // swung straight out at knee height round it (TailSpring sweep)
  tail: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, spin: { coil: 1.2, turns: 1, over: 0.85 } },
  // the spit: its head reared back, its arms braced low (`spit`), the glob lobbed as it flies (`release`: CARRY.fly)
  spit: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'spit', release: 0.78 },
};
const PROWLER_SPEEDS = { walk: 0.8, jog: 2.6, sprint: 5.0 };
/** Its stance over the clip's (rad): leaning forward from the hips, the head brought back up level; its knees a little bent. */
export const PROWLER_STANCE = { lean: 0.2, look: -0.25, knee: 0.18, crouch: 0.55, flipTuck: 1.3, head: 1.2 };
/** The tail: segments, each `len` m, tapering `r0` → `r1`; its rest curve (rad down per segment, root to tip). */
export const PROWLER_TAIL = { n: 8, len: 0.17, r0: 0.075, r1: 0.014, rest: [0.45, 0.25, 0.15, 0.05, -0.1, -0.2, -0.2, -0.1] };

/** A long three-fingered lizard hand hanging down its joint: a narrow palm, three long fingers, each with a claw. */
function lizardHand(size = 1) {
  const r = 0.022 * size, skin = [new THREE.SphereGeometry(r * 1.6, 8, 6).scale(1, 1.3, 0.6).translate(0, -r * 1.2, 0)], claw = [];
  for (let i = -1; i <= 1; i++) {
    const a = i * 0.28, l = r * (i ? 3.4 : 4.2);
    skin.push(new THREE.CapsuleGeometry(r * 0.42, l, 3, 5).translate(0, -l / 2, 0).rotateX(0.3).rotateZ(a).translate(i * r * 0.7, -r * 2.2, r * 0.3));
    claw.push(new THREE.ConeGeometry(r * 0.32, r * 1.3, 5).rotateX(Math.PI - 0.5).translate(0, -l - r * 0.5, r * 0.25).rotateX(0.3).rotateZ(a).translate(i * r * 0.7, -r * 2.2, r * 0.3));
  }
  return { skin, claw };
}
/** A digitigrade foot on its ankle (the ball of the foot): a pad, three long toes on the ground, claws. */
function lizardFoot(size = 1) {
  const s = size, skin = [new THREE.SphereGeometry(0.036 * s, 8, 6).scale(1.2, 0.75, 1.3).translate(0, -0.03, 0.015)], claw = [];
  for (let i = -1; i <= 1; i++) {
    const a = i * 0.42, l = 0.11 * s * (i ? 0.85 : 1.1);
    skin.push(new THREE.CapsuleGeometry(0.016 * s, l, 3, 5).rotateX(Math.PI / 2).translate(0, 0, l / 2).rotateY(a).translate(0, -0.05, 0.02));
    claw.push(new THREE.ConeGeometry(0.01 * s, 0.035 * s, 5).rotateX(Math.PI / 2 + 0.3).translate(0, -0.012, l + 0.012).rotateY(a).translate(0, -0.05, 0.02));
  }
  return { skin, claw };
}
/** Points from a to b (arrays) for a capsule along them: its geometry, radius r. */
function bone(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
  return new THREE.CapsuleGeometry(r, Math.max(0.001, l - r * 2), 3, 8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(...A.add(B).multiplyScalar(0.5).toArray());
}

export function prowlerModel(skin) {
  const P = skin.palette, M = materials('prowler', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, PROWLER_BODY), D = PROWLER_BODY;
  const skinB = M.mat('skinBuild', P.skin), bellyB = M.mat('bellyBuild', P.belly), steelB = M.mat('steelBuild', P.steel), leatherB = M.mat('leatherBuild', P.leather);
  const boneB = M.mat('boneBuild', P.bone), inkB = M.mat('inkBuild', P.ink);
  const eyeM = M.own('eye', P.eye, { glow: 0.55 });
  const T = J.torso;
  // a long lean body: narrow hips, a slim waist, the chest a little deeper; the cream throat and belly down its front
  const prof = [[0.001, -0.1], [0.115, -0.08], [0.14, 0.0], [0.115, 0.13], [0.125, 0.24], [0.16, 0.35], [0.175, 0.43], [0.15, 0.5], [0.07, 0.55], [0.001, 0.56]];
  add(T, lathe(prof, 22, 0.72), skinB);
  add(T, lathe(prof.slice(1, 8).map(([r, y]) => [r + 0.005, y]), 14, 0.72, -0.45, 0.9), bellyB);
  // (its shoulders rounded over the arms' tops)
  many(T, [-1, 1].map((s) => new THREE.SphereGeometry(0.07, 10, 8).scale(1.2, 0.85, 1).translate(s * 0.15, D.chest - 0.03, -0.005)), skinB);
  // the neck: long, up and a little forward from the shoulders, its throat cream
  const neck = [new THREE.CylinderGeometry(0.052, 0.075, D.neck + 0.1, 12).rotateX(0.2).translate(0, D.chest + 0.04, 0.03)];
  many(T, neck, skinB);
  many(T, [new THREE.CylinderGeometry(0.054, 0.077, D.neck + 0.08, 12, 1, true, -0.8, 1.6).rotateX(0.2).translate(0, D.chest + 0.04, 0.004)], bellyB);
  // the strap across its chest from its left shoulder to its right hip, the steel guard on its left shoulder
  many(T, [new THREE.CylinderGeometry(0.18, 0.18, 0.028, 26, 1, true).rotateZ(-0.62).scale(1, 1, 0.78).translate(0, 0.3, 0.0)], leatherB);
  const guard = [new THREE.SphereGeometry(0.095, 14, 8, 0, Math.PI * 2, 0, 1.25).scale(1, 0.78, 1.05).rotateZ(-0.3).translate(0.015, 0.03, 0),
    new THREE.SphereGeometry(0.1, 14, 4, 0, Math.PI * 2, 1.15, 0.3).scale(1, 0.9, 1.08).rotateZ(-0.3).translate(0.02, 0.0, 0)];
  many(J.arms[1], guard.map((x) => x.scale(0.92, 0.92, 0.92).translate(0, -0.035, 0)), steelB);
  many(J.arms[1], [-0.5, 0, 0.5].map((a) => new THREE.SphereGeometry(0.008, 5, 4).translate(Math.sin(a) * 0.07 + 0.04, -0.035, Math.cos(a) * 0.075)), inkB);
  // arms: thin and long, to its thighs; three long clawed fingers
  J.arms.forEach((arm, i) => {
    const h = lizardHand(1.25);
    many(arm, [limb(D.upper, 0.048, 0.036), new THREE.SphereGeometry(0.056, 10, 8).scale(1, 1.15, 1), new THREE.SphereGeometry(0.042, 8, 6).scale(1, 2.2, 1).translate(0, -D.upper * 0.4, 0.005)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.036, 8, 6), limb(D.fore, 0.037, 0.026), new THREE.SphereGeometry(0.034, 8, 6).scale(1, 2.4, 1).translate(0, -D.fore * 0.3, 0)], skinB);
    many(J.hands[i], h.skin, skinB); many(J.hands[i], h.claw, boneB);
  });
  // legs (digitigrade): a thick thigh; the shin bent back from the knee to a raised hock, the long instep forward and down
  // from it to the ball of the foot (the ankle's joint), three long toes on the ground (PROWLER_SHANK)
  const K = PROWLER_SHANK.hock, ballAt = [0, -D.shin, PROWLER_SHANK.ball];
  J.legs.forEach((leg, i) => {
    const f = lizardFoot(1.2);
    many(leg, [new THREE.SphereGeometry(0.07, 12, 9).scale(1, 2.9, 1.1).translate(0, -D.thigh * 0.45, 0.01)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.044, 8, 6), bone([0, 0, 0], K, 0.04), new THREE.SphereGeometry(0.03, 8, 6).translate(...K), bone(K, ballAt, 0.027)], skinB);
    many(J.knees[i], [new THREE.ConeGeometry(0.009, 0.03, 5).rotateX(-2.3).translate(K[0], K[1] - 0.02, K[2] - 0.02)], boneB);
    many(J.feet[i], f.skin, skinB); many(J.feet[i], f.claw, boneB);
  });
  // the tail: from the back of its hips, down to the ground and along it, sprung (TailSpring)
  const TL = PROWLER_TAIL, segs = [];
  let at = J.body;
  for (let i = 0; i < TL.n; i++) {
    const s = pivot(at, 0, i ? 0 : D.hip - 0.04, i ? -TL.len : -0.08, `tail ${i}`);
    const r0 = TL.r0 + (TL.r1 - TL.r0) * (i / TL.n), r1 = TL.r0 + (TL.r1 - TL.r0) * ((i + 1) / TL.n);
    many(s, [new THREE.CylinderGeometry(r1, r0, TL.len * 1.04, 9, 1).rotateX(-Math.PI / 2).translate(0, 0, -TL.len / 2), new THREE.SphereGeometry(r0, 9, 6)], skinB);
    many(s, [new THREE.CylinderGeometry(r1 * 1.04, r0 * 1.04, TL.len, 8, 1, true, Math.PI - 0.95, 1.9).rotateX(-Math.PI / 2).translate(0, 0, -TL.len / 2)], bellyB);
    segs.push(s); at = s;
  }
  many(segs.at(-1), [new THREE.ConeGeometry(TL.r1, 0.09, 7).rotateX(-Math.PI / 2).translate(0, 0, -TL.len - 0.045)], skinB);
  const tail = new TailSpring(segs, TL.rest, { len: TL.len });
  // the head: a long narrow lizard head, the skull rounded behind, the snout long and flat; a crest of short spines over
  // its skull and down the back of its neck; wide-set yellow eyes on its sides under a brow ridge; a long mouth line
  const H = J.head, Hp = pivot(J.head, 0, 0, 0, 'skull');
  Hp.scale.setScalar(PROWLER_STANCE.head);
  many(Hp, [new THREE.SphereGeometry(0.105, 16, 12).scale(1, 0.85, 1.12).translate(0, 0.085, 0.0),
    new THREE.CylinderGeometry(0.05, 0.088, 0.2, 14).rotateX(Math.PI / 2).scale(1, 0.66, 1).translate(0, 0.07, 0.15),
    new THREE.SphereGeometry(0.05, 12, 8).scale(1, 0.66, 1.15).translate(0, 0.07, 0.25),
    ...[-1, 1].map((s) => new THREE.CapsuleGeometry(0.02, 0.08, 3, 6).rotateX(Math.PI / 2).translate(s * 0.062, 0.125, 0.07)),
    ...Array.from({ length: 9 }, (_, i) => { const u = i / 8, z = 0.07 - u * 0.26, y = 0.175 - u * u * 0.14, l = 0.085 - 0.04 * Math.abs(u - 0.25); return new THREE.ConeGeometry(0.013, l, 5).scale(0.5, 1, 1).rotateX(-0.5 - u * 0.4).translate(0, y + l * 0.4, z); })], skinB);
  // (the throat and the underside of the jaw: cream)
  many(Hp, [new THREE.SphereGeometry(0.094, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45).scale(1, 0.9, 1.12).translate(0, 0.083, 0.002),
    new THREE.CylinderGeometry(0.049, 0.084, 0.2, 14, 1, true, Math.PI - 1.0, 2.0).rotateX(Math.PI / 2).scale(1, 0.68, 1).translate(0, 0.067, 0.15)], bellyB);
  const mouth = (s) => [0, 1, 2, 3, 4].map((i) => new THREE.Vector3(s * (0.078 - i * 0.008), 0.048 + (i === 0 ? 0.012 : 0), -0.01 + i * 0.06));
  many(Hp, [tubeGeometry(mouth(-1), 0.0045), tubeGeometry(mouth(1), 0.0045), ...[-1, 1].map((s) => new THREE.SphereGeometry(0.007, 5, 4).translate(s * 0.02, 0.095, 0.29))], inkB);
  const eyes = pivot(Hp, 0, 0, 0, 'eyes');
  many(eyes, [-1, 1].map((s) => new THREE.SphereGeometry(0.036, 12, 9).scale(0.6, 1, 1).translate(s * 0.084, 0.105, 0.05)), eyeM);   // (both eyes one draw)
  many(Hp, [-1, 1].map((s) => new THREE.CapsuleGeometry(0.005, 0.026, 2, 4).translate(s * 0.106, 0.105, 0.053)), inkB);
  // the short curved blade in its right fist (its edge forward), a leather grip and a small steel guard
  const grip = pivot(J.hands[0], 0, -0.05, 0.012, 'grip');
  many(grip, [curvedBlade(0.42, 0.055, 0.18, 0.06, 0.008), new THREE.BoxGeometry(0.03, 0.012, 0.07).translate(0, 0.055, 0.005)], steelB);
  many(grip, [new THREE.CylinderGeometry(0.014, 0.016, 0.11, 7).translate(0, 0.0, 0), new THREE.SphereGeometry(0.018, 6, 5).translate(0, -0.06, 0)], leatherB);
  let cur = null;
  // (its stance over the clip's: leaning forward, the head back up level, the knees a little bent; the dart's crouch
  // deeper; the tail sweep's spin; the back-flip's tuck)
  const style = (Jt, want) => {
    const S = PROWLER_STANCE;
    J.torso.rotateX(S.lean); J.head.rotateX(S.look);
    for (const k of J.knees) k.rotateX(S.knee);
    const M = cur?.atk ? PROWLER_MOVES[cur.atk.id] : null;
    if (M && want.clip) J.body.rotateY(spinAngle(want, cur.k, M));
    if (cur?.atk?.id === 'spit' && want.clip) { const k = want.kind === 'wind' ? Math.min(1, want.load ?? 0) * (want.thrown > 0 ? 1 - want.thrown : 1) : 0; J.head.rotateX(-0.6 * k); J.torso.rotateX(-0.15 * k); }
  };
  const driver = new HumanoidDriver(J, rig, { moves: PROWLER_MOVES, speeds: PROWLER_SPEEDS, style, seat: 0.3 });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 1.0, up: 0.5, down: 0.6 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [bellyB], into: M.mat('belly', P.belly, vc) }, { from: [steelB], into: M.mat('steel', P.steel, vc) },
    { from: [leatherB], into: M.mat('leather', P.leather, vc) }, { from: [boneB], into: M.mat('bone', P.bone, vc) }, { from: [inkB], into: M.mat('ink', P.ink, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet, ...segs];
  let glow = 0;
  const _hinge = new THREE.Vector3(), _hq = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.belly, P.ink],
    driver, joints: J, tail,
    tell: (id) => (id === 'tail' ? segs[4] : id === 'spit' ? Hp : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      // the back-flip (its evade, fight.evade.flip): the whole body turned over backwards about its hips over the hop,
      // its legs tucked, its tail curled up over it
      const H_ = f.hopBack, flip = H_ && f.fight?.evade?.flip ? Math.min(1, H_.u ?? 0) : 0;
      if (flip > 0) {
        const e = flip * flip * (3 - 2 * flip), tuck = Math.sin(Math.PI * flip);
        _hinge.set(0, D.hip, 0);
        _hq.setFromAxisAngle(_ax, -Math.PI * 2 * e);
        J.body.position.sub(_hinge).applyQuaternion(_hq).add(_hinge);
        J.body.quaternion.premultiply(_hq);
        for (const l of J.legs) l.rotateX(-PROWLER_STANCE.flipTuck * tuck);
        for (const k of J.knees) k.rotateX(PROWLER_STANCE.flipTuck * 1.3 * tuck);
        for (const a of J.arms) a.rotateZ(0);
      }
      // grip: the blade hanging point-down by its leg; in a move, the clip's fist
      grip.rotation.set(Math.PI - 0.15, 0, 0.05);
      driver.gripFrom(grip, 0, want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover' ? driver.moveW : 0);
      // the tail: lashing as it winds up (the dart's: hard), straight out at knee height through the tail sweep, curled in the flip
      const id = f.atk?.id, active = f.state === 'wind' || f.state === 'strike';
      const sweep = id === 'tail' && active ? (f.state === 'strike' ? 1 : Math.min(1, (f.k ?? 0) / HOLD_AT)) : 0;
      tail.update(dt, f.heading + (rig.rotation.y ?? 0) + (sweep ? spinAngle(want, f.k, PROWLER_MOVES.tail) : 0), driver.speed,
        { lash: f.state === 'wind' ? (id === 'dart' ? 1 : 0.6) : f.rage ? 0.5 : 0.18, sweep, curl: flip > 0 ? Math.sin(Math.PI * flip) : 0 });
      if (!flip) tail.keepUp(f.pos.y, 0.04, c.ground);
      // the spit: lobbed from its mouth as it flies (a lob: Foes.animKit, its landing shown)
      if (id === 'spit' && f.state === 'wind' && f.k > PROWLER_MOVES.spit.release) c.lob(f, (f.k - PROWLER_MOVES.spit.release) / (1 - PROWLER_MOVES.spit.release), P.spit); else c.lob(f, -1, P.spit);
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

// ------------------------------------------------------------------ the warlord

// The warlord (`warlord`), to its picked sheet (references/enemy-archetypes/warlord/sheet-1.jpg): 2.5 m to its horns,
// broad and upright. Deep crimson skin, a dark brown mane round a great cat's face (a broad muzzle, a dark nose, a heavy
// brow, yellow eyes) and down its chest and back, two curled ram horns; rough bronze: a plate on each shoulder, bracers,
// greaves on its shins, plates on its wide leather belt; a brown loincloth; bare feet. A long glaive: a dark shaft with
// steel rings, a long curved blade. Draws: twelve (skin, mane, horn, bronze, cloth, wood, steel skinned on the rig; the
// eyes; its four plates, each its own mesh so it can come off: src/enemies/fight.js ARMOUR.warlord).

export const WARLORD_BODY = { hip: 1.18, hipX: 0.2, thigh: 0.55, shin: 0.52, chest: 0.78, shoulder: 0.42, upper: 0.5, fore: 0.46, neck: 0.12 };
export const WARLORD_MOVES = {
  // the sweep: the great sword's wide third swing, the glaive drawn back over its shoulder in both hands (the sheet's pose)
  sweep: { clip: 'gs_slash_3', from: 0.1, load: 0.5, cut: 0.86, to: 1.15 },
  // the overhead: the great sword's overhead, high over its horns, leaning back
  overhead: { clip: 'gs_slash_1', from: 0.25, load: 0.53, cut: 0.62, to: 1.05, lean: -0.14 },
  // the charge: the guard's braced stance, the glaive levelled like a lance (`lance`), its head down; then it runs
  // through on the library's sprint (`run`), the lance held
  charge: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'lance', run: true },
  // the roar: the yelling gesture, its arms flung wide (`roar`), its head thrown back
  roar: { clip: 'gesture_yelling', from: 0, load: 0.85, cut: 1.0, to: 1.2, pose: 'roar' },
  // the last stand: braced wide, the glaive swung back round behind it (`whirl`); two whole turns about its feet
  whirl: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'whirl', spin: { coil: 1.4, turns: 2, over: 0.9 } },
};
const WARLORD_SPEEDS = { walk: 1.0, jog: 2.6, sprint: 5.2 };
export const WARLORD_STANCE = { chest: -0.04, look: 0.02 };
/** Its head's size over the parts built at a person's (the sheet's maned head is big for its body). */
export const WARLORD_HEAD = { scale: 1.45 };
/** Where its glaive points in a held pose, in its body's frame (x its left, z ahead): the charge's lance, the whirl's reach. */
export const WARLORD_AIM = { lance: [0, -0.12, 1], whirl: [-1, 0.05, 0.25], glaiveHigh: [-0.7, 0.6, -0.4], glaiveHighStrike: [0.85, 0.1, 0.55], roar: [-0.35, 1, 0.25], carry: [-0.16, 1, 0.1] };
const _aq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _yUp = new THREE.Vector3(0, 1, 0);

export function warlordModel(skin) {
  const P = skin.palette, M = materials('warlord', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, WARLORD_BODY), D = WARLORD_BODY;
  const skinB = M.mat('skinBuild', P.skin), maneB = M.mat('maneBuild', P.mane), inkB = M.mat('inkBuild', P.ink), hornB = M.mat('hornBuild', P.horn);
  const bronzeB = M.mat('bronzeBuild', P.bronze), clothB = M.mat('clothBuild', P.cloth), leatherB = M.mat('leatherBuild', P.leather);
  const woodB = M.mat('woodBuild', P.wood), steelB = M.mat('steelBuild', P.steel);
  const plateM = M.mat('plate', P.bronze, { side: THREE.DoubleSide });   // (kit.js plateMat's, named here for its surface)
  const eyeM = M.own('eye', P.eye, { glow: 0.5 });
  const T = J.torso;
  // a broad upright body: the chest wide and deep over a narrower waist; pectorals and the ridges of its belly
  add(T, lathe([[0.001, -0.14], [0.2, -0.12], [0.25, -0.02], [0.225, 0.14], [0.245, 0.3], [0.3, 0.46], [0.345, 0.6], [0.335, 0.7], [0.24, 0.8], [0.11, 0.86], [0.001, 0.88]], 22, 0.7), skinB);
  many(T, [...[-1, 1].map((s) => new THREE.SphereGeometry(0.14, 12, 9).scale(1.05, 0.72, 0.6).translate(s * 0.13, 0.6, 0.15)),
    new THREE.CylinderGeometry(0.15, 0.2, 0.16, 12).translate(0, D.chest + 0.04, 0.0)], skinB);
  // the wide leather belt, bronze plates on it and a square buckle; the loincloth front and back, ragged
  many(T, [lathe([[0.262, -0.04], [0.27, 0.06], [0.258, 0.14]], 22, 0.74)], leatherB);
  many(T, [...[-0.85, -0.42, 0.42, 0.85].map((a) => new THREE.BoxGeometry(0.1, 0.11, 0.02).translate(0, 0.05, 0.268).rotateY(a).scale(1, 1, 0.74)),
    new THREE.TorusGeometry(0.045, 0.012, 4, 4).rotateZ(Math.PI / 4).translate(0, 0.05, 0.205), new THREE.BoxGeometry(0.06, 0.012, 0.015).translate(0, 0.05, 0.21)], bronzeB);
  const hem = pivot(T, 0, -0.04, 0, 'hem');
  const flap = (z, w, l) => { const geo = new THREE.PlaneGeometry(w, l, 4, 3).translate(0, -l / 2, 0); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (z > 0 ? 1 : -1) * (0.04 * Math.cos((x / w) * Math.PI)) - 0.02 * (y / l)); if (y < -l * 0.95) p.setY(i, y + 0.04 * Math.sin(x * 37)); } geo.computeVertexNormals(); return geo.translate(0, 0, z); };
  many(hem, [flap(0.2, 0.34, 0.5), flap(-0.18, 0.38, 0.46), ...tatters(10, 0.25, -0.02, 0.18, 0.74, 0.1)], clothB);
  // arms: thick and muscled; bronze bracers on the forearms; big hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1, h = clawHand(s, 2.0);
    many(arm, [limb(D.upper, 0.12, 0.095), new THREE.SphereGeometry(0.14, 11, 8).scale(1, 1.1, 1)], skinB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.095, 9, 7), limb(D.fore, 0.098, 0.072)], skinB);
    many(J.elbows[i], [new THREE.CylinderGeometry(0.098, 0.104, 0.22, 12).translate(0, -D.fore + 0.15, 0), ...[-0.06, 0.06].map((y) => new THREE.TorusGeometry(0.104, 0.012, 4, 14).rotateX(Math.PI / 2).translate(0, -D.fore + 0.15 + y, 0))], bronzeB);
    many(J.hands[i], [...h.skin, ...h.claw], skinB);
  });
  // legs: thick; bare broad feet; a bronze greave on each shin and its knee (plates)
  const plates = [];
  J.legs.forEach((leg, i) => {
    const f = clawFoot(2.1, 5);
    many(leg, [limb(D.thigh, 0.13, 0.1), new THREE.SphereGeometry(0.135, 11, 8)], skinB);
    many(J.knees[i], [new THREE.SphereGeometry(0.11, 9, 7), limb(D.shin, 0.105, 0.075)], skinB);
    many(J.feet[i], [...f.skin, ...f.claw], skinB);
    many(J.knees[i], [new THREE.TorusGeometry(0.088, 0.016, 4, 12).rotateX(Math.PI / 2).translate(0, -D.shin + 0.06, 0), new THREE.TorusGeometry(0.1, 0.016, 4, 12).rotateX(Math.PI / 2).translate(0, -0.2, 0)], leatherB);
  });
  // the head: a great cat's, big for its body (the sheet's): a broad skull, the muzzle, a dark nose, a heavy brow, small
  // ears; two ram horns curled back and down round them to the cheeks, their tips out and forward. All on a pivot at
  // WARLORD_HEAD's scale over the neck
  const H = J.head, Hf = pivot(H, 0, -0.02, 0.01, 'face');
  Hf.scale.setScalar(WARLORD_HEAD.scale);
  many(Hf, [new THREE.SphereGeometry(0.15, 16, 12).scale(1, 1.05, 1).translate(0, 0.16, 0.0),
    new THREE.SphereGeometry(0.1, 14, 10).scale(1.15, 0.82, 0.9).translate(0, 0.09, 0.115),
    new THREE.SphereGeometry(0.06, 10, 7).scale(1.35, 0.8, 0.95).translate(0, 0.035, 0.1),
    new THREE.CapsuleGeometry(0.034, 0.15, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.8, 0.9).translate(0, 0.2, 0.125),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.035, 0.07, 6).scale(1, 1, 0.5).rotateZ(-s * 1.3).translate(s * 0.15, 0.17, -0.01))], skinB);
  many(Hf, [new THREE.SphereGeometry(0.034, 8, 6).scale(1.35, 0.72, 0.9).translate(0, 0.128, 0.2),
    tubeGeometry([[-0.05, 0.066, 0.183], [-0.018, 0.055, 0.198], [0, 0.07, 0.205], [0.018, 0.055, 0.198], [0.05, 0.066, 0.183]], 0.005),
    new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4).translate(0, 0.094, 0.204)], inkB);
  many(Hf, [-1, 1].map((s) => ramHorn(s, [0, 0.16, -0.01], 0.125, 0.07, 0.13, 0.29, 0.82)), hornB);
  // the mane: a shaggy ruff round the face (never over it), over the crown between the horns, a beard down its throat to
  // its chest, long down its back; tufts of it as tapering cones, all one mesh
  const tufts = [], cone = (at, dir, l, r) => tufts.push(new THREE.ConeGeometry(r, l, 6).translate(0, l / 2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())).translate(...at));
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 20; i++) {
    const a = ((i + ring * 0.5) / 20) * Math.PI * 2, R = 0.15 + ring * 0.035, low = Math.max(0, -Math.cos(a)), side = Math.abs(Math.sin(a)) * Math.max(0, Math.cos(a) + 0.3);
    // (shorter at the sides by the horns, long under the jaw: its beard; swept back and down)
    const l = (0.12 + 0.05 * ((i * 7 + ring * 3) % 5) / 4 + low * 0.2 + ring * 0.05) * (1 - 0.45 * side);
    cone([Math.sin(a) * R, 0.12 + Math.cos(a) * R * 1.05, -0.04 - ring * 0.06], new THREE.Vector3(Math.sin(a) * 0.6, Math.cos(a) * 0.4 - 0.85 - low * 0.3 - ring * 0.35, -0.4 - ring * 0.1), l * (1 - ring * 0.12), 0.07 + ring * 0.01);
  }
  tufts.push(new THREE.SphereGeometry(0.165, 12, 9).scale(1.05, 1.1, 1.0).translate(0, 0.13, -0.08));
  many(Hf, tufts, maneB);
  many(T, Array.from({ length: 9 }, (_, i) => { const x = -0.2 + i * 0.05, l = 0.24 + 0.08 * ((i * 3) % 4) / 3; return new THREE.ConeGeometry(0.065, l, 5).scale(1, 1, 0.5).rotateX(Math.PI - 0.1).translate(x, D.chest + 0.04 - l / 2, 0.17 - Math.abs(x) * 0.3); })
    .concat(Array.from({ length: 7 }, (_, i) => { const x = -0.18 + i * 0.06, l = 0.42; return new THREE.ConeGeometry(0.09, l, 5).scale(1, 1, 0.45).rotateX(Math.PI - 0.12).translate(x, D.chest + 0.12 - l / 2, -0.2 - 0.02 * Math.cos(i)); })), maneB);
  const eyes = pivot(Hf, 0, 0, 0, 'eyes');
  many(eyes, [-1, 1].map((s) => new THREE.SphereGeometry(0.021, 9, 7).scale(1.25, 0.72, 0.6).translate(s * 0.055, 0.162, 0.162)), eyeM);   // (both eyes one draw)
  many(Hf, [-1, 1].map((s) => new THREE.SphereGeometry(0.009, 6, 5).scale(1, 1.4, 0.5).translate(s * 0.055, 0.162, 0.174)), inkB);
  // its plates (ARMOUR.warlord, in the order they fall): the right shoulder, the left, the right greave, the left. Rough
  // bronze, each a dome over the shoulder and a lame under it; a greave down each shin with its knee cop
  for (const [k, arm] of J.arms.entries()) {
    const s = k ? 1 : -1;
    const geo = merged([new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, 1.15).scale(1.05, 0.78, 1.05).rotateZ(s * 0.32).translate(s * 0.02, 0.05, 0),
      new THREE.SphereGeometry(0.2, 14, 3, 0, Math.PI * 2, 1.05, 0.3).scale(1.02, 1.0, 1.04).rotateZ(s * 0.32).translate(s * 0.03, -0.03, 0)]);
    plates.push(plate(arm, geo, plateM, 0, 0, 0, `pauldron ${s > 0 ? 'left' : 'right'}`));
  }
  for (const [k, knee] of J.knees.entries()) {
    const s = k ? 1 : -1, prof = Array.from({ length: 6 }, (_, i) => [0.095 - 0.022 * (i / 5), -0.04 - (D.shin - 0.12) * (i / 5)]).reverse();
    const geo = merged([shellPlate(prof, -1.15, 2.3, { out: 0.012, thick: 0.03, segs: 10 }), new THREE.SphereGeometry(0.11, 12, 7, -1.4, 2.8, 0.5, 1.6).translate(0, 0.0, 0.02)]);
    plates.push(plate(knee, geo, plateM, 0, 0, 0, `greave ${s > 0 ? 'left' : 'right'}`));
  }
  // the glaive in its right fist: the dark shaft held a third of the way up, steel rings, a long curved blade on top
  const grip = pivot(J.hands[0], 0, -0.1, 0.02, 'grip');
  const lo = -0.72, L = 2.4;   // (the butt kept a hand over the ground: a slope's rise beside it, tests/foe-slope.test.js)
  many(grip, [new THREE.CylinderGeometry(0.03, 0.033, L, 8).translate(0, lo + L / 2, 0)], woodB);
  many(grip, [curvedBlade(0.78, 0.16, 0.16, lo + L - 0.02, 0.012, true).rotateY(-Math.PI / 2), ...[lo + 0.04, lo + 0.55, lo + L - 0.32, lo + L - 0.06].map((y, i) => new THREE.CylinderGeometry(0.04, 0.04, i % 3 ? 0.04 : 0.08, 8).translate(0, y, 0)),
    new THREE.CylinderGeometry(0.03, 0.04, 0.06, 8).translate(0, lo - 0.02, 0)], steelB);
  let cur = null;
  const style = (Jt, want) => {
    J.torso.rotateX(WARLORD_STANCE.chest);
    const Mv = cur?.atk ? WARLORD_MOVES[cur.atk.id] : null;
    if (Mv && want.clip) J.body.rotateY(spinAngle(want, cur.k, Mv));
    if (cur?.atk?.id === 'roar' && want.kind === 'wind') J.head.rotateX(-0.5 * Math.min(1, want.load ?? 0));
    if (cur?.atk?.id === 'charge' && (want.kind === 'wind' || want.phase === 'strike')) J.head.rotateX(0.35 * (want.kind === 'wind' ? Math.min(1, want.load ?? 0) : 1));
  };
  const driver = new HumanoidDriver(J, rig, { moves: WARLORD_MOVES, speeds: WARLORD_SPEEDS, style, seat: 0.4 });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.7, up: 0.35, down: 0.45 })];
  const vc = { vertexColors: true };
  skinBy(g, [
    { from: [skinB], into: M.mat('skin', P.skin, vc) }, { from: [maneB, inkB], into: M.mat('mane', P.mane, vc) }, { from: [hornB], into: M.mat('horn', P.horn, vc) },
    { from: [bronzeB], into: M.mat('bronze', P.bronze, vc) }, { from: [clothB, leatherB], into: M.mat('cloth', P.cloth, vc) }, { from: [woodB], into: M.mat('wood', P.wood, vc) },
    { from: [steelB], into: M.mat('steel', P.steel, vc) },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(1.8, 0.35, 0, 0.25);
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, plates, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.mane, P.bronze],
    driver, joints: J,
    tell: (id) => (id === 'roar' ? H : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      const sw = sway.update(dt, driver.speed, f.heading);
      hem.rotation.set(sw.x, 0, sw.z);
      // the glaive: upright beside it in its fist, the butt by its foot; levelled like a lance in the charge; in a move
      // the clip's fists
      grip.rotation.set(0.08, 0, 0.06);
      driver.gripFrom(grip, 0, want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover' ? driver.moveW : 0);
      // (levelled at you for the charge, out to its right for the last stand: aimed in the body's own frame, eased in
      // with the pose's weight; WARLORD_AIM)
      // (standing or walking, the glaive upright at its side, a little out: carry)
      const posed = (want.phase === 'strike' && WARLORD_AIM[want.pose + 'Strike']) || WARLORD_AIM[want.pose];
      const aim = posed ?? WARLORD_AIM.carry, w = posed ? Math.min(1, driver.procW ?? 1) : 1 - (want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover' ? driver.moveW : 0);
      if (w > 0.01) {
        J.body.updateWorldMatrix(true, false); grip.parent.updateWorldMatrix(true, false);
        _w.set(...aim).normalize();
        _aq.setFromUnitVectors(_yUp, _w).premultiply(J.body.getWorldQuaternion(_bq));
        grip.parent.getWorldQuaternion(_pq).invert();
        grip.quaternion.slerp(_pq.multiply(_aq), w);
      }
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}
