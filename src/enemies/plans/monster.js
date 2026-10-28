import * as THREE from 'three';
import { materials, add, many, skinBy, pivot, tubeGeometry, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver, Sway } from '../humanoid-rig.js';
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
  sweep: { clip: 'gs_slash_3', from: 0.1, load: 0.5, cut: 0.86, to: 1.15 },
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
