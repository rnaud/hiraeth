import * as THREE from 'three';
import { materials, add, many, skinBy, pivot, tubeGeometry, lerp, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver, Sway } from '../humanoid-rig.js';

// The mummers (issue #724; docs/design/enemy-roster-v2.md "The mummers", v3 "humanoid foes on clips"): the dark playing at
// being people, dressed up in what people throw away. The first foes on the humanoid rig (src/enemies/humanoid-rig.js):
// human proportions under the costume, moved by the traveller's clips, the procedural layers on top.
//
// The mummer (`mummer`), to its picked sheets (references/enemy-archetypes/mummer/: sheet-1 the dune mummer, the
// Desert's: a squat sack of sun-faded indigo and ochre patches with rope bindings; sheet-2 its paler twin, a bleached
// cream sack with sky-blue and saffron patches and a taller pot): 1.1 m, a head shorter than the traveller's shoulder.
// A round sack body stitched from patches and stuffed with ink, rag tatters at its hem dripping ink; two short bowed
// stick legs bound in rag, flat three-toed ink feet; long thin glossy ink arms to its knees with three-fingered hands;
// its whole head a dented brass coffee pot (lid, spout, handle) with two white eyes in its holes; under it, nothing
// but wet black. Always something in its hand, a separate part it drops and picks up: a driftwood club, a tent-pole
// spear with a rag pennant, or a short bow of a bent spring and a cord (f.weapon); with none, it digs up a rock.
// Low on health, or shot through the mask, or caught by a charged cut or a riposte, the pot is knocked flying
// (f.unmasked): it clutches its blank wet face, drops what it holds and scampers off.
//
// The mummer king (`mummerking`), to its sheet (references/enemy-archetypes/mummerking/sheet-1.jpg): 2.6 m, a pear of
// junk: an oak barrel for a chest bound in rope and patched rag, short thick rag-bound legs on wide flat ink feet, long
// heavy ink arms with big three-fingered hands, a green-copper cauldron for a mask with two white eyes, a cart wheel
// for a crown with its spokes up, a brass horn slung on its back, and a door beam for a club.
//
// Draws: every part of a material one skinned mesh on the rig's joints (kit.js skinBy): seven or eight a body.

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _w = new THREE.Vector3();

/** A lathe from (r, y) pairs (bottom to top), squashed front to back by `depth`. */
export function lathe(profile, seg = 18, depth = 1, phi0 = 0, phiLen = Math.PI * 2) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiLen);
  if (depth !== 1) geo.scale(1, 1, depth);
  geo.computeVertexNormals();
  return geo;
}
/** A ring of hanging rag strips (a torn hem): n strips round radius r at height y, `len` long, ragged. */
export function tatters(n, r, y, len, depth = 1, w = 0.08) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2, l = len * (0.65 + 0.35 * Math.abs(Math.sin(i * 2.3 + 1)));
    const g = new THREE.ConeGeometry(w * (0.8 + 0.4 * Math.abs(Math.sin(i * 1.7))), l, 3, 1).rotateY(Math.PI / 6).scale(1, 1, 0.25)
      .rotateX(Math.PI).translate(0, -l / 2, 0).rotateX(-0.12).translate(0, 0, r).rotateY(a);
    g.scale(1, 1, depth); g.translate(0, y, 0);
    out.push(g);
  }
  return out;
}
/** A three-fingered ink hand hanging down its joint (a palm, three fingers curled in a little, a thumb). */
function handParts(s, size = 1) {
  const r = 0.028 * size, out = [new THREE.SphereGeometry(r * 1.6, 8, 6).scale(1, 1.2, 0.8).translate(0, -r * 1.2, 0)];
  for (let i = -1; i <= 1; i++) out.push(new THREE.CapsuleGeometry(r * 0.6, r * 2.6, 3, 6).rotateX(0.35).translate(i * r * 1.05, -r * 3.6, r * 0.6));
  out.push(new THREE.CapsuleGeometry(r * 0.55, r * 1.8, 3, 6).rotateZ(s * 0.7).translate(s * r * 1.5, -r * 1.8, r * 0.8));
  return out;
}
/** A flat three-toed ink foot on its ankle (the toes splayed forward). */
function footParts(size = 1) {
  const s = size, out = [new THREE.SphereGeometry(0.05 * s, 8, 6).scale(1.15, 0.45, 1.3).translate(0, -0.006 * s, 0.025 * s)];
  for (let i = -1; i <= 1; i++) out.push(new THREE.CapsuleGeometry(0.018 * s, 0.07 * s, 3, 6).rotateX(Math.PI / 2).rotateY(i * 0.38).translate(i * 0.03 * s, -0.01 * s, 0.085 * s));
  return out;
}
/** A limb's tube from its joint down `len` (radius r → r1). */
export const limb = (len, r, r1 = r) => new THREE.CylinderGeometry(r1, r, len, 8, 1).translate(0, -len / 2, 0);
/** A rag binding round a limb: a few slightly askew bands down a length. */
function wraps(from, to, r, n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) { const y = lerp(from, to, (i + 0.5) / n); out.push(new THREE.CylinderGeometry(r * 1.08, r, (to - from) / n * 1.05, 8, 1).rotateZ((i % 2 ? 1 : -1) * 0.12).translate(0, y, 0)); }
  return out;
}

// ------------------------------------------------------------------ the weapons (each its own pivot: shown, hidden, dropped)

/** The driftwood club along +y from the grip: a knobbed pale log, rope wound round its grip and its head. */
function clubParts(L = 0.72) {
  return {
    wood: [new THREE.CylinderGeometry(0.05, 0.028, L, 7, 3).translate(0, L * 0.38, 0), new THREE.SphereGeometry(0.06, 7, 5).scale(1, 1.3, 0.9).translate(0.01, L * 0.82, 0),
      new THREE.SphereGeometry(0.03, 6, 4).translate(0.04, L * 0.55, 0.02), new THREE.SphereGeometry(0.025, 6, 4).translate(-0.035, L * 0.68, -0.01)],
    rope: [new THREE.TorusGeometry(0.035, 0.009, 4, 10).rotateX(Math.PI / 2).translate(0, 0.02, 0), new THREE.TorusGeometry(0.036, 0.009, 4, 10).rotateX(Math.PI / 2).translate(0, -0.03, 0),
      new THREE.TorusGeometry(0.05, 0.01, 4, 10).rotateX(Math.PI / 2 - 0.3).translate(0, L * 0.62, 0)],
  };
}
/** The tent-pole spear, held a third of the way up: a pole, a nail-iron head, a rag tied under it. */
export function spearParts(L = 1.5) {
  const lo = -0.12;   // (held low on the pole: its butt by its feet, the head well over its pot)
  return {
    wood: [new THREE.CylinderGeometry(0.016, 0.018, L, 6, 1).translate(0, lo + L / 2, 0)],
    iron: [new THREE.ConeGeometry(0.035, 0.16, 4).scale(1, 1, 0.4).translate(0, lo + L + 0.07, 0), new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6).translate(0, lo + L - 0.02, 0)],
    rag: [new THREE.BoxGeometry(0.1, 0.2, 0.006).translate(0.05, lo + L - 0.16, 0).rotateY(0.3)],
    rope: [new THREE.TorusGeometry(0.022, 0.006, 4, 8).rotateX(Math.PI / 2).translate(0, lo + L - 0.06, 0)],
  };
}
/** The short bow: a bent coil spring (an arc of tube), a cord across it; held upright in the left fist. */
export function bowParts(R = 0.36) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const a = -1.1 + 2.2 * (i / 10); pts.push(new THREE.Vector3(0, Math.sin(a) * R, (Math.cos(a) - Math.cos(1.1)) * R * 0.6)); }
  return {
    iron: [tubeGeometry(pts, 0.016)],
    rope: [new THREE.CylinderGeometry(0.004, 0.004, 2 * Math.sin(1.1) * R, 4).translate(0, 0, 0)],
  };
}

/** The coffee-pot mask: a dented brass pot on its side over the face, its lid and knob on top, a spout and a handle; two eye holes. */
function potParts(o = {}) {
  const tall = o.tall ?? 1;
  const pot = lathe([[0.17, -0.02], [0.2, 0.03], [0.205, 0.12 * tall], [0.19, 0.22 * tall], [0.14, 0.28 * tall], [0.08, 0.3 * tall], [0.001, 0.305 * tall]], 18, 0.95);
  // (a dent or two: pushed in on its brass)
  const P = pot.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); const d = Math.exp(-((x - 0.12) ** 2 + (y - 0.17) ** 2 + (z - 0.1) ** 2) / 0.004) * 0.025; P.setXYZ(i, x * (1 - d * 4), y, z * (1 - d * 4)); }
  pot.computeVertexNormals();
  const top = 0.3 * tall;
  const spout = [];
  for (let i = 0; i <= 5; i++) { const u = i / 5; spout.push(new THREE.Vector3(-0.17 - 0.13 * u, 0.06 + 0.2 * u * u + 0.04 * u, 0.02)); }
  const handle = new THREE.TorusGeometry(0.085, 0.016, 5, 12, Math.PI * 1.15).rotateZ(-Math.PI * 0.6).translate(0.2, 0.15 * tall, 0);
  return {
    brass: [pot, new THREE.CylinderGeometry(0.1, 0.11, 0.035, 14).translate(0, top + 0.01, 0), new THREE.SphereGeometry(0.03, 8, 6).translate(0, top + 0.05, 0),
      tubeGeometry(spout, 0.035, 0.018), handle, new THREE.TorusGeometry(0.2, 0.012, 4, 20).rotateX(Math.PI / 2).scale(1, 1, 0.95).translate(0, -0.01, 0)],
    // (the eye holes: dark, the eyes shine in them)
    ink: [-1, 1].map((s) => new THREE.CircleGeometry(0.042, 12).translate(s * 0.075, 0.12 * tall, 0.197)),
  };
}

// ------------------------------------------------------------------ the mummer

/** Its proportions (m, at size 1): humanoidSkeleton's D. 1.1 m to the pot's knob. */
export const MUMMER_BODY = { hip: 0.4, hipX: 0.085, thigh: 0.18, shin: 0.17, chest: 0.34, shoulder: 0.19, upper: 0.25, fore: 0.22, neck: 0.06 };
/** Each attack's clip (humanoid-rig.js stateClip): the clip's anticipation `from` → `load` (the held telegraph), its cut, its follow-through. */
export const MUMMER_MOVES = {
  // the overhead whack: the great sword's overhead (the charged cut's), both arms high with the club behind the mask,
  // leaning back on its heels (its own lean over the clip's); the hop forward is the mind's lunge
  whack: { clip: 'gs_slash_1', from: 0.2, load: 0.53, cut: 0.62, to: 1.05, lean: -0.18 },
  // the spear jab: the sword's thrust (the dash cut's), the pole drawn back under its arm
  jab: { clip: 'ss_attack_2', from: 0.05, load: 0.45, cut: 0.57, to: 0.95 },
  // the bow's volley: no bow clip in the libraries: the sword-and-shield guard's braced stance for its legs and body, the
  // arms by hand (`bow`: side-on, the bow arm out at you, the cord drawn back past its pot), loosed in the strike
  volley: { clip: 'ss_block_idle', from: 0, load: 0.4, cut: 0.5, to: 0.6, pose: 'bow' },
  // the rock lob: the great sword's jumping overhead (its own hop left out: `ground`), the rock in both hands high over
  // its pot and leaning back, held, then thrown as it leaves its hands (`release`: the rock flies from 78 % of the
  // wind-up, src/foes.js animKit lob)
  rock: { clip: 'gs_jump_attack', from: 0.15, load: 0.85, cut: 1.1, to: 1.45, ground: true, release: 0.78 },
};
const MUMMER_SPEEDS = { walk: 0.55, jog: 1.6, sprint: 3.3 };

export function mummerModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('mummer', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, MUMMER_BODY), D = MUMMER_BODY;
  const sackB = M.mat('sackBuild', P.sack), ragB = M.mat('ragBuild', P.rag), ropeB = M.mat('ropeBuild', P.rope), brassB = M.mat('brassBuild', P.brass);
  const inkB = M.mat('inkBuild', P.ink), woodB = M.mat('woodBuild', P.wood), ironB = M.mat('ironBuild', P.iron);
  const sackM = M.mat('sack', P.sack, { vertexColors: true }), ragM = M.mat('rag', P.rag, { vertexColors: true }), ropeM = M.mat('rope', P.rope, { vertexColors: true });
  const brassM = M.mat('brass', P.brass, { vertexColors: true }), inkM = M.mat('ink', P.ink, { vertexColors: true }), woodM = M.mat('wood', P.wood, { vertexColors: true });
  const ironM = M.mat('iron', P.iron, { vertexColors: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.95 });
  const T = J.torso, tall = props.has('tall') ? 1.25 : 1;
  // the sack: a round egg of patches from just over the hips to the shoulders, its belly out front
  add(T, lathe([[0.001, -0.13], [0.13, -0.115], [0.235, -0.04], [0.275, 0.07], [0.27, 0.18], [0.23, 0.29], [0.16, 0.37], [0.07, 0.405], [0.001, 0.41]], 20, 0.86), sackB, 0, 0, 0.015);
  // rope bound round it, one round the belly and one across the chest from a shoulder
  many(T, [new THREE.TorusGeometry(0.272, 0.012, 4, 24).rotateX(Math.PI / 2).scale(1, 1, 0.87).translate(0, 0.05, 0.015),
    new THREE.TorusGeometry(0.255, 0.011, 4, 24).rotateX(Math.PI / 2 - 0.55).rotateY(0.3).scale(1, 1, 0.87).translate(0, 0.17, 0.02)], ropeB);
  // the hem: rag tatters hanging from under the sack, swinging on a spring (its own pivot)
  const hem = pivot(T, 0, -0.04, 0, 'hem');
  many(hem, tatters(11, 0.215, 0, 0.14, 0.87, 0.1), ragB);
  // ink seeping: drips under the hem and the cuffs
  many(hem, [0.4, 1.9, 3.3, 4.6, 5.6].map((a, i) => new THREE.SphereGeometry(0.016, 6, 4).scale(1, 2.2, 1).translate(Math.sin(a) * 0.2, -0.1 - (i % 2) * 0.03, Math.cos(a) * 0.17)), inkB);
  // the shoulders' rag sleeves (short, torn) and the long thin ink arms, the three-fingered hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    many(arm, [new THREE.ConeGeometry(0.07, 0.13, 6, 1, true).translate(0, -0.03, 0), ...tatters(4, 0.06, -0.08, 0.07, 1, 0.04)], ragB);
    many(arm, [limb(D.upper, 0.026, 0.022), new THREE.SphereGeometry(0.028, 8, 6)], inkB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.024, 8, 6), limb(D.fore, 0.022, 0.018), new THREE.SphereGeometry(0.012, 6, 4).scale(1, 2, 1).translate(0.015 * s, -D.fore * 0.8, 0.012)], inkB);
    many(J.hands[i], handParts(s), inkB);
  });
  // the bowed legs: thin ink sticks bound in rag, bowed out (their own lean: the model's anim), flat three-toed feet
  J.legs.forEach((leg, i) => {
    many(leg, [limb(D.thigh, 0.026, 0.022), new THREE.SphereGeometry(0.03, 8, 6)], inkB);
    many(leg, wraps(-0.03, -D.thigh + 0.02, 0.03, 2), ragB);
    many(J.knees[i], [new THREE.SphereGeometry(0.024, 8, 6), limb(D.shin, 0.022, 0.02)], inkB);
    many(J.knees[i], [...wraps(-0.04, -D.shin + 0.025, 0.026, 3)], ragB);
    many(J.knees[i], [new THREE.TorusGeometry(0.03, 0.006, 4, 10).rotateX(Math.PI / 2).translate(0, -D.shin + 0.03, 0)], ropeB);
    many(J.feet[i], footParts(), inkB);
  });
  // the head: an ink knob on a short neck (the blank wet face under the mask), the two white eyes, the pot over them
  const H = J.head;
  many(H, [new THREE.CylinderGeometry(0.05, 0.07, 0.08, 8).translate(0, -0.02, 0), new THREE.SphereGeometry(0.15, 12, 9).scale(1, 0.9, 0.95).translate(0, 0.12, 0)], inkB);
  const eyes = pivot(H, 0, 0, 0, 'eyes');
  for (const s of [-1, 1]) add(eyes, new THREE.SphereGeometry(0.027, 10, 8).scale(1, 1, 0.5), eyeM, s * 0.075, 0.12 * tall, 0.205);
  const mask = pivot(H, 0, 0.01, 0, 'mask');
  const pot = potParts({ tall });
  many(mask, pot.brass, brassB); many(mask, pot.ink, inkB);
  // the weapons: a grip in the right fist (the club, the spear), the bow in the left; each its own pivot
  const grip = pivot(J.hands[0], 0, -0.045, 0.01, 'grip'), gripL = pivot(J.hands[1], 0, -0.045, 0.01, 'grip l');
  const club = pivot(grip, 0, 0, 0, 'club'), spear = pivot(grip, 0, 0, 0, 'spear'), bow = pivot(gripL, 0, 0, 0, 'bow');
  const build = (node, parts) => { for (const [k, geos] of Object.entries(parts)) many(node, geos, { wood: woodB, rope: ropeB, iron: ironB, rag: ragB }[k]); };
  build(club, clubParts()); build(spear, spearParts()); build(bow, bowParts());
  // the ones it drops (and the pot knocked off): copies on the model's root, placed in the world as they fly and lie
  const dropped = pivot(g, 0, 0, 0, 'dropped weapon');
  const dClub = pivot(dropped, 0, 0, 0, 'dropped club'), dSpear = pivot(dropped, 0, 0, 0, 'dropped spear'), dBow = pivot(dropped, 0, 0, 0, 'dropped bow');
  build(dClub, clubParts()); build(dSpear, spearParts()); build(dBow, bowParts());
  const flown = pivot(g, 0, 0, 0, 'dropped mask');
  { const p2 = potParts({ tall }); many(flown, p2.brass, brassB); }
  const held = { club, spear, bow }, lying = { club: dClub, spear: dSpear, bow: dBow };
  // (the rock it lobs: a stone in its hands, then in the air: Foes.animKit lob)
  // (its stance over the clip's: bow-legged, the knees out, the feet turned flat)
  const style = () => { J.legs[0].rotateZ(-0.16); J.legs[1].rotateZ(0.16); J.knees[0].rotateZ(0.1); J.knees[1].rotateZ(-0.1); J.feet[0].rotateZ(0.06); J.feet[1].rotateZ(-0.06); };
  const driver = new HumanoidDriver(J, rig, { moves: MUMMER_MOVES, speeds: MUMMER_SPEEDS, style, seat: 0.16 });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.9, up: 0.5, down: 0.5 })];
  skinBy(g, [
    { from: [sackB], into: sackM }, { from: [ragB], into: ragM }, { from: [ropeB], into: ropeM }, { from: [brassB], into: brassM },
    { from: [inkB], into: inkM }, { from: [woodB], into: woodM }, { from: [ironB], into: ironM },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(2.6, 0.3, 0, 0.3), maskFly = { t: -1, from: new THREE.Vector3(), at: new THREE.Vector3(), spin: 0 };
  let dim = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.sack, P.brass, P.ink],
    driver, joints: J,
    tell: (id) => (id === 'volley' ? gripL : id === 'rock' ? J.hands[0] : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0), unmasked = !!f.unmasked;
      const want = driver.update(f, c, { pose: unmasked && f.state !== 'wind' && f.state !== 'strike' && (f.fleeT > 0 || f.stunned > 0) ? 'clutch' : null });
      // the hem swings behind its moves (a spring on its speed and its turn)
      const sw = sway.update(dt, driver.speed, f.heading);
      hem.rotation.set(sw.x, 0, sw.z);
      // the weapon in hand (its own: f.weapon), turned as the clip's fist holds it; none disarmed or unmasked
      const W = f.disarmed || unmasked ? null : f.weapon ?? 'club';
      for (const [k, node] of Object.entries(held)) node.scale.setScalar(k === W ? 1 : 1e-3);
      // (carried: the club forward over its shoulder, the spear upright, its butt by its feet, the bow upright before it;
      // in a move, turned as the clip's fist holds the library's sword)
      const move = want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover' ? driver.moveW : 0;
      if (W === 'spear') grip.rotation.set(0.25, 0, 0.1); else grip.rotation.set(Math.PI / 2 - 0.5, 0, 0.15);
      gripL.rotation.set(0.15, 0, Math.PI / 2 - 0.15);   // (the bow held sideways before it, as the sheet's)
      driver.gripFrom(grip, 0, move); driver.gripFrom(gripL, 1, move);
      // one it dropped lies where it fell (f.disarmed: an arc to it, turning, then flat)
      for (const node of Object.values(lying)) node.scale.setScalar(1e-3);
      const S = f.disarmed, lie = S ? lying[f.droppedWeapon ?? f.weapon ?? 'club'] : null;
      if (lie) {
        g.updateMatrixWorld(true);
        const fly = f.def.disarm?.fly ?? 0.5, u = Math.min(1, S.t / fly);
        _w.lerpVectors(S.from, S.at, u); _w.y += Math.sin(Math.PI * u) * 1.1 + (u >= 1 ? 0.03 : 0);
        g.worldToLocal(lie.position.copy(_w));
        _e.set(u < 1 ? S.t * 12 : Math.PI / 2, Math.atan2(S.at.x - S.from.x, S.at.z - S.from.z), 0, 'YXZ');
        lie.quaternion.copy(g.getWorldQuaternion(_q).invert().multiply(new THREE.Quaternion().setFromEuler(_e)));
        lie.scale.setScalar(1 / (skin.scale ?? 1));
      }
      // the mask: on, or knocked flying when it is unmasked (an arc, spinning, then lying on the sand)
      mask.scale.setScalar(unmasked ? 1e-3 : 1);
      flown.scale.setScalar(1e-3);
      if (unmasked) {
        if (maskFly.t < 0) { maskFly.t = 0; H.getWorldPosition(maskFly.from); maskFly.at.set(maskFly.from.x - Math.sin(f.heading) * 1.6 + 0.6, f.pos.y + 0.12, maskFly.from.z - Math.cos(f.heading) * 1.6); maskFly.spin = 0; }
        maskFly.t += dt;
        const u = Math.min(1, maskFly.t / 0.7);
        _w.lerpVectors(maskFly.from, maskFly.at, u); _w.y += Math.sin(Math.PI * u) * 0.9;
        g.updateMatrixWorld(true);
        g.worldToLocal(flown.position.copy(_w));
        _e.set(u < 1 ? maskFly.t * 11 : Math.PI / 2, f.heading, u < 1 ? maskFly.t * 5 : 0.4, 'YXZ');
        flown.quaternion.copy(g.getWorldQuaternion(_q).invert().multiply(new THREE.Quaternion().setFromEuler(_e)));
        flown.scale.setScalar(1 / (skin.scale ?? 1));
      } else maskFly.t = -1;
      // the rock: dug up, held over the mask, then flying to its mark (a lob: Foes.animKit, its landing shown)
      if (f.atk?.id === 'rock' && f.state === 'wind' && f.k > 0.78) c.lob(f, (f.k - 0.78) / 0.22, P.rock); else c.lob(f, -1, P.rock);
      // its eyes: their white, dim and small unmasked (it can't see well); the wind-up's own colour
      dim = ease(dim, unmasked ? 1 : 0, 6, dt || 1);
      eyes.scale.setScalar(1 - 0.35 * dim); eyes.position.z = -0.045 * dim;   // (unmasked: on its wet black face)
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.9 - 0.4 * dim;
      return want;
    },
    dispose: M.dispose,
  };
}

// ------------------------------------------------------------------ the mummer king

export const KING_BODY = { hip: 0.95, hipX: 0.24, thigh: 0.43, shin: 0.41, chest: 0.92, shoulder: 0.58, upper: 0.6, fore: 0.55, neck: 0.1 };
export const KING_MOVES = {
  // the door-beam smash: the great sword's overhead (the charged cut's), the beam high behind the cauldron
  smash: { clip: 'gs_slash_1', from: 0.25, load: 0.53, cut: 0.62, to: 1.05 },
  // the royal swing: the great sword's wide third swing, the whole barrel twisted away
  swing: { clip: 'gs_slash_3', from: 0.1, load: 0.5, cut: 0.86, to: 1.15 },
  // the horn call: the yelling gesture's chest thrown out (gestures.glb) under the horn raised to its cauldron by hand
  horn: { clip: 'gesture_yelling', from: 0, load: 0.85, cut: 1.0, to: 1.2, pose: 'horn' },
  // the throw: the jumping overhead (its hop left out), the mummer held high over its crown in both fists, held, then
  // hurled as it lets go (`release`: CARRY.fly, src/foes.js)
  throw: { clip: 'gs_jump_attack', from: 0.15, load: 0.85, cut: 1.1, to: 1.45, ground: true, release: 0.78, lean: -0.1 },
};
const KING_SPEEDS = { walk: 1.0, jog: 2.6, sprint: 5 };

export function mummerKingModel(skin) {
  const P = skin.palette, M = materials('mummerking', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, KING_BODY), D = KING_BODY;
  const sackB = M.mat('sackBuild', P.sack), ragB = M.mat('ragBuild', P.rag), ropeB = M.mat('ropeBuild', P.rope), brassB = M.mat('brassBuild', P.brass);
  const inkB = M.mat('inkBuild', P.ink), woodB = M.mat('woodBuild', P.wood), ironB = M.mat('ironBuild', P.iron), copperB = M.mat('copperBuild', P.copper);
  const sackM = M.mat('sack', P.sack, { vertexColors: true }), ragM = M.mat('rag', P.rag, { vertexColors: true }), ropeM = M.mat('rope', P.rope, { vertexColors: true });
  const brassM = M.mat('brass', P.brass, { vertexColors: true }), inkM = M.mat('ink', P.ink, { vertexColors: true }), woodM = M.mat('wood', P.wood, { vertexColors: true });
  const ironM = M.mat('iron', P.iron, { vertexColors: true }), copperM = M.mat('copper', P.copper, { vertexColors: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.95 });
  const paleB = M.mat('paleBuild', P.wood2), paleM = M.mat('pale', P.wood2, { vertexColors: true });
  const T = J.torso;
  // a pear of junk: patched rag bulging round its belly and hips, the oak barrel for a chest above it (iron hoops), a
  // patched mantle over its shoulders; torn hems dripping ink
  add(T, lathe([[0.001, -0.2], [0.52, -0.18], [0.68, -0.02], [0.73, 0.14], [0.69, 0.28], [0.6, 0.36], [0.001, 0.38]], 26, 0.84), sackB, 0, 0, 0.03);
  add(T, lathe([[0.001, 0.32], [0.63, 0.34], [0.68, 0.56], [0.66, 0.76], [0.58, 0.92], [0.001, 0.94]], 26, 0.82), woodB, 0, 0, 0.03);
  many(T, [[0.42, 0.66], [0.86, 0.61]].map(([y, r]) => new THREE.TorusGeometry(r, 0.02, 4, 28).rotateX(Math.PI / 2).scale(1, 1, 0.82).translate(0, y, 0.03)), ironB);
  add(T, lathe([[0.62, 0.82], [0.62, 0.9], [0.52, 1.02], [0.32, 1.09], [0.001, 1.11]], 26, 0.86), sackB, 0, 0, 0.03);
  many(T, tatters(9, 0.61, 0.86, 0.13, 0.86, 0.15), ragB);
  const hem = pivot(T, 0, -0.17, 0, 'hem');
  many(hem, tatters(16, 0.56, 0, 0.2, 0.84, 0.15), ragB);
  many(hem, [0.3, 1.4, 2.6, 3.9, 5.1].map((a, i) => new THREE.SphereGeometry(0.03, 6, 4).scale(1, 2.4, 1).translate(Math.sin(a) * 0.52, -0.14 - (i % 2) * 0.04, Math.cos(a) * 0.44)), inkB);
  // a rope across the chest from the right shoulder (the horn's strap), the bells hung on it
  many(T, [new THREE.TorusGeometry(0.66, 0.022, 4, 28).rotateX(Math.PI / 2 - 0.7).rotateY(-0.2).scale(1, 1, 0.84).translate(0, 0.7, 0.03)], ropeB);
  many(T, [[0.26, 0.5], [0.4, 0.42]].map(([x, y]) => new THREE.CylinderGeometry(0.035, 0.06, 0.1, 8).translate(x, y, 0.6)), brassB);
  // the horn slung on its back: a long curved brass tube from the hip up past the shoulder to a wide bell
  const hornPts = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8; hornPts.push(new THREE.Vector3(0.4 - 0.85 * u, 0.15 + 1.1 * u, -0.56 - 0.14 * Math.sin(Math.PI * u))); }
  const hornNode = pivot(T, 0, 0, 0, 'horn');
  many(hornNode, [tubeGeometry(hornPts, 0.035, 0.08), new THREE.CylinderGeometry(0.25, 0.07, 0.3, 16, 1, true).rotateZ(0.6).translate(-0.55, 1.33, -0.6)], brassB);
  // the long heavy ink arms to its knees, the big three-fingered hands
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    many(arm, [limb(D.upper, 0.18, 0.15), new THREE.SphereGeometry(0.2, 10, 8)], inkB);
    many(J.elbows[i], [new THREE.SphereGeometry(0.15, 8, 6), limb(D.fore, 0.15, 0.12)], inkB);
    many(J.hands[i], handParts(s, 3.1), inkB);
  });
  // the short thick legs bound in rag, the wide flat feet
  J.legs.forEach((leg, i) => {
    many(leg, [limb(D.thigh, 0.17, 0.15), new THREE.SphereGeometry(0.18, 10, 8)], inkB);
    many(J.knees[i], [new THREE.SphereGeometry(0.14, 8, 6), limb(D.shin, 0.14, 0.12)], inkB);
    many(J.knees[i], wraps(-0.06, -D.shin + 0.05, 0.15, 4), ragB);
    many(J.knees[i], [new THREE.TorusGeometry(0.155, 0.016, 4, 12).rotateX(Math.PI / 2).translate(0, -D.shin * 0.5, 0)], ropeB);
    many(J.feet[i], footParts(3.1), inkB);
  });
  // the head: the cauldron for a mask (green copper, two lugs), a dark opening for a face with the white eyes in it,
  // the cart wheel for a crown with its spokes up
  const H = J.head;
  many(H, [new THREE.SphereGeometry(0.34, 12, 9).scale(1, 0.75, 0.95).translate(0, 0.16, 0)], inkB);
  const eyes = pivot(H, 0, 0, 0, 'eyes');
  for (const s of [-1, 1]) add(eyes, new THREE.SphereGeometry(0.05, 10, 8).scale(1, 1, 0.5), eyeM, s * 0.09, 0.18, 0.45);
  const mask = pivot(H, 0, 0, 0, 'mask');
  many(mask, [lathe([[0.4, -0.06], [0.44, 0.04], [0.465, 0.17], [0.445, 0.3], [0.38, 0.39], [0.3, 0.42], [0.001, 0.43]], 22, 0.96),
    new THREE.TorusGeometry(0.42, 0.025, 4, 24).rotateX(Math.PI / 2).scale(1, 1, 0.96).translate(0, -0.05, 0),
    ...[-1, 1].map((s) => new THREE.TorusGeometry(0.06, 0.015, 4, 10).rotateY(Math.PI / 2).translate(s * 0.47, 0.3, 0))], copperB);
  many(mask, [new THREE.CircleGeometry(0.17, 18).scale(1.2, 0.8, 1).translate(0, 0.18, 0.448)], inkB);
  const crown = pivot(H, 0, 0.43, 0, 'crown');
  const spokes = [new THREE.TorusGeometry(0.32, 0.035, 5, 22).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10)];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; spokes.push(new THREE.BoxGeometry(0.05, 0.05, 0.32).translate(0, 0, 0.16).rotateY(a)); }
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3, h = 0.2 + 0.1 * (i % 2); spokes.push(new THREE.BoxGeometry(0.06, h, 0.06).rotateZ(Math.sin(a) * 0.3).rotateX(-Math.cos(a) * 0.3).translate(Math.sin(a) * 0.3, h / 2, Math.cos(a) * 0.3)); }
  many(crown, spokes, paleB);
  // the door beam in its right fist: a long weathered plank bound with rope, iron straps and a nail or two
  const grip = pivot(J.hands[0], 0, -0.12, 0.02, 'grip');
  const beam = pivot(grip, 0, 0, 0, 'beam');
  many(beam, [new THREE.BoxGeometry(0.19, 1.6, 0.14).translate(0, 0.5, 0)], paleB);
  many(beam, [new THREE.BoxGeometry(0.2, 0.04, 0.15).translate(0, 0.9, 0), new THREE.BoxGeometry(0.2, 0.04, 0.15).translate(0, 1.18, 0)], ironB);
  many(beam, [0, 0.1, 0.2].map((y) => new THREE.TorusGeometry(0.11, 0.013, 4, 10).rotateX(Math.PI / 2).translate(0, y, 0)), ropeB);
  const style = () => { J.legs[0].rotateZ(-0.1); J.legs[1].rotateZ(0.1); J.feet[0].rotateZ(0.05); J.feet[1].rotateZ(-0.05); };
  const driver = new HumanoidDriver(J, rig, { moves: KING_MOVES, speeds: KING_SPEEDS, style, seat: 0.3 });
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.6, up: 0.35, down: 0.45 })];
  skinBy(g, [
    { from: [sackB], into: sackM }, { from: [ragB], into: ragM }, { from: [ropeB], into: ropeM }, { from: [brassB], into: brassM },
    { from: [inkB], into: inkM }, { from: [woodB], into: woodM }, { from: [ironB], into: ironM }, { from: [copperB], into: copperM }, { from: [paleB], into: paleM },
  ]);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const sway = new Sway(1.6, 0.35, 0, 0.25), bounce = new Sway(3.2, 0.25);
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.wood, P.copper, P.ink],
    driver, joints: J,
    tell: (id) => (id === 'horn' ? hornNode : id === 'throw' ? J.hands[1] : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      const want = driver.update(f, c);
      const sw = sway.update(dt, driver.speed, f.heading), b = bounce.update(dt, driver.speed, f.heading);
      hem.rotation.set(sw.x, 0, sw.z);
      crown.rotation.set(b.x * 0.6, 0, b.z * 0.8);
      hornNode.rotation.set(-b.x * 0.4, 0, b.z * 0.4);
      // the horn to its cauldron while it calls: brought round from its back
      const calling = f.atk?.id === 'horn' && (f.state === 'wind' || f.state === 'strike');
      hornNode.position.set(0, calling ? 0.25 * Math.min(1, (f.k ?? 0) * 2) : 0, calling ? 0.5 * Math.min(1, (f.k ?? 0) * 2) : 0);
      // the beam: along its fist's grip; set down while it holds a mummer up or blows its horn
      grip.rotation.set(Math.PI / 2 - 0.4, 0, 0);
      driver.gripFrom(grip, 0, want.kind === 'wind' || want.kind === 'strike' || want.kind === 'recover' ? driver.moveW : 0);
      beam.scale.setScalar(f.atk && (f.atk.id === 'throw' || f.atk.id === 'horn') && f.state !== 'chase' && f.state !== 'idle' ? 1e-3 : 1);
      // the eyes: brighter as it winds up; red enraged
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.8 + 0.2 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}
