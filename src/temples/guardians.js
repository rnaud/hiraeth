import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { ell, dome, cyl, cone, box, tube, torus, merge } from '../wildlife/geo.js';
import { glyphGeometry } from '../story/sign-text.js';
import { GUARDIAN_PLANS } from '../motion-kit/plans.js';
import { SecondOrder, quantise } from '../motion-kit/spring.js';
import { Wave } from '../motion-kit/chain.js';
import { fabrik } from '../motion-kit/ik.js';
import { tellFrame, flatMats, GuardianLegs, TurnLag } from './guardian-motion.js';

// The bodies of what waits in the temples, built from the wildlife's little
// modelling kit (flat printed colours per piece, merged per moving part), and
// posed by hand: no skeleton, a few groups that sway, rear, open their mouths.
//
//   keeperModel()    the desert's Cistern-Keeper: a great pale beast of the Givers, a shell of bone
//                    plates on six long legs, a heron's neck and a long soft muzzle. It kept the
//                    cistern; the water stopped, the dark came, and it is afraid.
//   elderModel()     Vael's Elder: the oldest of the great birds, her feathers gone to stone, afraid to fly
//   snapperModel()   Lorn's Mother Snapper: the swamp's oldest carnivorous plant, rooted in the Hush's
//                    hall; a neck of beads and a great head of jaws that lunges, sweeps and spits seed
//   foremanModel()   the Sealed Hangar's Clockwork Foreman: a drum of brass with a clock for a chest, wound wrong
//   gardenerModel()  Viridel's Gardener: a moss giant of the white builders, bare and wild, calmed with flowers
//   signModel()      the Signal Market's First Sign: a mast with a listening dish, stuck on one word
//   sentinelModel()  the City-Shaft's sentinel: a tall machine of the makers on three legs, a ring
//                    of vents and a lamp-eye, broken and still guarding (see incal.js)
//
// A model: { group, pos (on the floor), heading, home, rest, restHeading, mouth (Vector3, world),
//            mouthR, radius, height, animate(dt, t, { state, attack, k, speed, meter, kit }) }
//
// They move on the locomotion kit (src/motion-kit/, docs/systems/procedural-animation.md "Phase 6, the guardians"):
// the walkers' legs are jointed and planted (GuardianLegs: two-bone IK from hips on the body to feet on the floor, a
// gait planner, the body riding on its feet), their heads and necks lag and steady on springs; the fliers' wings,
// fins and veils beat on travelling waves whose tips lag their roots; the Snapper's neck is a FABRIK chain. Each
// walker keeps its body in its own `tellRig` (the fight's generic wind-up motions move the body; the legs stay
// planted outside it). `kit` (from src/temples/boss.js): { eye, ground } for the kit's tiers and its foot rays.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let uid = 0;
const vc = () => makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, key: `guardian.${uid++}` });
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };
const lerp = THREE.MathUtils.lerp;
const _up = new THREE.Vector3(0, 1, 0);

const NECK_UP = [0.75, 0.2, -0.15, -0.25, -0.3], NECK_LOW = [1.0, 0.55, 0.3, 0.12, 0.0];

/** The Cistern-Keeper (organic: you calm it). */
export function keeperModel({ shell = '#efe2c6', plate = '#e2c9a2', belly = '#d9978a', skin = '#d8bf9a', dark = '#4a3a42', glow = '#70e7df' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const glowM = makeMaterial({ color: glow, glow: 0.15, flat: true, key: `keeper.glow.${uid++}` });
  const eyeM = makeMaterial({ color: dark, flat: true, key: `keeper.eye.${uid++}` });
  // the body: a shell of bone on a rose belly, plates in rows, a short tail
  const body = new THREE.Group();
  body.position.y = 3.4;
  group.add(body);
  const plates = [];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + row * 0.4, el = 0.35 + row * 0.28;
    const x = Math.cos(a) * Math.cos(el) * 2.9, z = Math.sin(a) * Math.cos(el) * 3.7, y = Math.sin(el) * 1.85;
    plates.push(ell([0.9, 0.22, 1.0], row % 2 ? plate : shell, [x, y, z], [Math.atan2(y, Math.hypot(x, z)) * 0.6, a, 0], [7, 4]));
  }
  body.add(new THREE.Mesh(merge(
    dome([3.0, 2.0, 3.8], shell, [0, 0, 0], null, [16, 6]),
    ell([2.8, 0.9, 3.6], belly, [0, -0.15, 0], null, [14, 6]),
    plates,
    tube([[0, 0.1, -3.4], [0, -0.3, -4.6], [0.2, -1.0, -5.6]], 0.45, skin, 10, 6),
    cone(0.35, 0.8, skin, [0.25, -1.3, -6.0], [-2.2, 0, 0]),
  ), mat));
  // glyph spots on the shell: dim while it is afraid, bright as it calms
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, x = Math.cos(a) * 2.2, z = Math.sin(a) * 2.8;
    spots.push(glyphGeometry(0.9, 0.08).rotateX(-Math.PI / 2 + 0.5).rotateY(-a + Math.PI / 2).translate(x, 1.45, z));
  }
  spots.push(glyphGeometry(1.6, 0.08).rotateX(-Math.PI / 2).translate(0, 2.02, 0));
  body.add(new THREE.Mesh(merge(...spots.map((g) => g.index ? g.toNonIndexed() : g)), glowM));
  // six long legs on the kit, each a thigh and a shin (knees out and up), planted, stepping in two tripods
  const tellRig = tellFrame(group);
  const legM = flatMats('keeper', { joint: skin, thigh: skin, shin: skin, foot: dark });
  const kit = new GuardianLegs({ plan: GUARDIAN_PLANS.keeper, group, body, legs: [[-1, 2.2], [1, 2.2], [-1, 0], [1, 0], [-1, -2.2], [1, -2.2]].map(([side, z]) => ({
    hip: { x: side * 2.3, y: -0.2, z }, foot: { x: side * 4.5, z: z * 1.25 }, radius: 0.3, mats: legM,
  })) });
  const legs = kit.legs;
  // the neck in five rings and the head: a long soft muzzle, a jaw that opens, two dark eyes
  const neck = [];
  let parent = body;
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    g.position.set(0, i === 0 ? 0.6 : 0.78, i === 0 ? 3.3 : 0);
    parent.add(g);
    g.add(new THREE.Mesh(merge(cyl(0.55 - i * 0.05, 0.62 - i * 0.05, 0.86, i % 2 ? plate : skin, [0, 0.4, 0], null, 9)), mat));
    neck.push(g);
    parent = g;
  }
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.1);
  parent.add(head);
  head.add(new THREE.Mesh(merge(
    ell([0.75, 0.62, 0.95], skin, [0, 0.1, 0.2]),
    ell([0.42, 0.3, 1.1], skin, [0, -0.05, 1.15]),          // the muzzle
    ell([0.5, 0.2, 0.6], shell, [0, 0.62, 0.0]),            // the brow plate (where a hand goes)
    cone(0.12, 0.7, shell, [-0.35, 0.75, -0.3], [-0.6, 0, 0.3]), cone(0.12, 0.7, shell, [0.35, 0.75, -0.3], [-0.6, 0, -0.3]),
  ), mat));
  const eyes = new THREE.Mesh(merge(ell([0.13, 0.15, 0.1], '#ffffff', [-0.48, 0.28, 0.55]), ell([0.13, 0.15, 0.1], '#ffffff', [0.48, 0.28, 0.55])), eyeM);
  head.add(eyes);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.25, 0.4);
  head.add(jaw);
  jaw.add(new THREE.Mesh(merge(ell([0.36, 0.14, 0.95], belly, [0, -0.08, 0.75])), mat));
  const mouth = V(), _w = V();
  noCollide(group);

  const neckLag = new TurnLag(0.9, 0.5);
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, tellRig, kit,
    mouth, mouthR: 1.3, radius: 3.4, height: 4.4,
    head, jaw, body, neck, legs, eyes, glowM, eyeM, gait: 0, rise: 0, open: 0, rear: 0, low: 0, sink: 0,
    marks: { c: [0, 3.9, 0], r: [2.9, 1.7, 3.6] },
    /** Where a move's glow gathers: its forefeet, its head (src/temples/boss.js partAt). */
    part(name, out, side = 1) {
      if (name === 'feet') return kit.footAt(side > 0 ? 1 : 0, out);
      if (name === 'head') return out.copy(head.localToWorld(_w.set(0, 0.7, 0.2)));
      return null;
    },
    animate(dt, t, opts) {
      const { state, attack, k = 0, meter = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, side = attack?.side ?? 1;
      // how it holds itself in each state
      const asleep = state === 'sleep', weary = state === 'weary' || state === 'resolved';
      M.rise = ease(M.rise, asleep ? 0 : state === 'wake' ? 0.85 : weary ? 0.35 : 1, state === 'wake' ? 0.8 : 2);
      M.open = ease(M.open, state === 'open' ? 1 : id === 'sweep' && k > 0.6 ? 0.7 : id === 'spit' ? Math.min(1, k * 1.4) : 0, 6);
      M.rear = ease(M.rear, id === 'stamp' ? (k < 1 ? k : 0) : 0, id === 'stamp' && k >= 1 ? 20 : 4);
      M.low = ease(M.low, state === 'open' || weary || id === 'sweep' || id === 'charge' ? 1 : id === 'spit' ? -0.3 * k : asleep ? 1.3 : 0, 3);
      M.sink = ease(M.sink, id === 'burrow' && k < 1 ? Math.min(1, k * 1.6) : 0, id === 'burrow' && k >= 1 ? 9 : 2.5);
      // the kit: the stamp lifts its forelegs off the floor (the other four planted), the burrow tucks them all under it
      for (const L of legs) { const front = L.home.z > 1; L.lift = front ? M.rear : 0; L.air.set(0, M.rear * 1.4, M.rear * 1.3); }
      const o = kit.update(M, dt, opts, { air: M.sink > 0.02 ? 1 + M.sink : 0 });
      const breathe = Math.sin(t * (asleep || weary ? 0.9 : 1.6)) * 0.06;
      body.position.set(o.x, lerp(1.55, 3.4, M.rise) + breathe - M.sink * 4.2 + o.y, o.z);
      body.rotation.set(-M.rear * 0.45 + o.pitch, o.yaw, o.roll);
      // the neck: up and searching when it fights, down to the floor asleep, low and open when it pants; it lags a turn
      const lag = neckLag.update(dt, M.heading);
      const sway = Math.sin(t * 0.7) * 0.2 + (id === 'sweep' ? side * Math.sin(Math.min(1, k) * Math.PI * 2.2) * (k >= 1 ? 0.2 : 0.7) : 0) - lag * 1.6;
      // a swan's neck: forward from the shell, then up, the head level; low, it droops to the ground ahead
      neck.forEach((g, i) => {
        g.rotation.x = lerp(NECK_UP[i], NECK_LOW[i], Math.min(1, M.low)) + (M.low > 1 ? (M.low - 1) * 0.3 : 0) + (i === 0 ? M.rear * 0.4 - o.pitch * 0.6 : 0);
        g.rotation.y = sway * (0.25 + i * 0.06);
      });
      // (the head held steady against the body's tilt)
      head.rotation.x = lerp(-0.1, -0.9, Math.min(1, M.low)) + (asleep ? 0.3 : 0) - o.pitch * 0.4;
      jaw.rotation.x = M.open * 0.75 + (state === 'open' ? Math.sin(t * 7) * 0.06 : 0);
      // the glyphs on its shell: dim and flickering afraid, steady and bright as it calms
      const calm = state === 'resolved' ? 1 : meter;
      glowM.uniforms.uGlow.value = 0.12 + 0.75 * calm + (calm < 0.5 ? Math.max(0, Math.sin(t * 9)) * 0.08 : 0.08 * Math.sin(t * 1.5));
      kit.write();
      // the mouth (for the fluid) is the muzzle's tip
      group.updateMatrixWorld(true);
      mouth.copy(jaw.localToWorld(_w.set(0, 0.1, 1.4)));
    },
  };
  return M;
}

/**
 * Vael II's Cloud-Mother (organic: you calm it): a great pale sky-whale that rose with the stones when the
 * bell stopped and has not come down since. She swims in the air of her hall, fins like sails, a fringe of
 * cloud along her back; when she cries she sinks low, her mouth open. Floating: `floats` (the guardian keeps
 * her at the arena's height plus `hover`).
 */
export function whaleModel({ skin = '#d8d4e6', belly = '#f3ead8', fin = '#c4bedb', dark = '#4a4a5e', puff = '#fbf7ee', glow = '#70e7df' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const glowM = makeMaterial({ color: glow, glow: 0.15, flat: true, key: `whale.glow.${uid++}` });
  const eyeM = makeMaterial({ color: dark, flat: true, key: `whale.eye.${uid++}` });
  const body = new THREE.Group();
  group.add(body);
  const puffs = [];
  for (let i = 0; i < 9; i++) puffs.push(ell([0.9 + (i % 3) * 0.25, 0.7, 0.9], puff, [Math.sin(i * 2.1) * 0.6, 2.35 + (i % 2) * 0.2, -3.5 + i * 0.95], null, [8, 5]));
  body.add(new THREE.Mesh(merge(
    ell([3.0, 2.5, 6.2], skin, [0, 0, 0], null, [18, 10]),
    ell([2.6, 1.6, 5.4], belly, [0, -0.95, 0.4], null, [16, 8]),
    puffs,
    cone(0.5, 2.2, fin, [-0.6, 2.6, -0.5], [-0.5, 0, 0.4]), cone(0.5, 2.2, fin, [0.6, 2.6, -0.5], [-0.5, 0, -0.4]),
  ), mat));
  // glyph spots along her flanks: dim while she is afraid
  const spots = [];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) spots.push(glyphGeometry(0.85, 0.08).rotateY(s * Math.PI / 2).translate(s * 2.95, 0.4 - (i % 2) * 0.5, -3.2 + i * 1.3));
  body.add(new THREE.Mesh(merge(...spots.map((g) => (g.index ? g.toNonIndexed() : g))), glowM));
  // the fins: long soft sails that row the air, each three strips hinged one to the next (a travelling wave runs out
  // along them, the tip behind the root: plan 14)
  const fins = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    f.position.set(s * 2.6, -0.4, 1.2);
    f.rotation.y = s * 0.3;
    body.add(f);
    const joints = [];
    let parent = f;
    for (let i = 0; i < 3; i++) {
      const j = i === 0 ? f : new THREE.Group();
      if (i > 0) { j.position.set(s * 1.55, 0, 0); parent.add(j); }
      j.add(new THREE.Mesh(merge(ell([1.0, 0.18 - i * 0.03, 1.5 - i * 0.28], fin, [s * 0.85, 0, -0.4 + i * 0.1])), mat));
      joints.push(j); parent = j;
    }
    fins.push({ f, s, joints });
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.2, -6.0);
  body.add(tail);
  tail.add(new THREE.Mesh(merge(ell([0.9, 0.7, 1.6], skin, [0, 0, -1.2])), mat));
  // (the fluke on its own hinge: it trails the tail's stroke)
  const fluke = new THREE.Group();
  fluke.position.set(0, 0.05, -2.1);
  tail.add(fluke);
  fluke.add(new THREE.Mesh(merge(ell([2.6, 0.16, 1.0], fin, [0, 0.05, -0.5])), mat));
  // the head end: small dark eyes, a long mouth that opens
  const eyes = new THREE.Mesh(merge(ell([0.2, 0.24, 0.12], '#ffffff', [-1.9, 0.5, 4.6]), ell([0.2, 0.24, 0.12], '#ffffff', [1.9, 0.5, 4.6])), eyeM);
  body.add(eyes);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.9, 3.4);
  body.add(jaw);
  jaw.add(new THREE.Mesh(merge(ell([2.0, 0.45, 2.6], belly, [0, -0.2, 1.4])), mat));
  noCollide(group);
  const mouth = V(), _w = V();
  const finWave = new Wave(), tailWave = new Wave(0.16);
  const bank = new SecondOrder(0.9, 0.6, 0), tilt = new SecondOrder(1.1, 0.55, 0), turn = new TurnLag(1.6, 1);
  let lastY = null;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: true, hover: 6,
    mouth, mouthR: 1.8, radius: 4.2, height: 5.2, bodyR: 3.4,
    body, fins, tail, fluke, jaw, glowM, eyeM, open: 0, low: 0, swim: 0, roll: 0,
    marks: { c: [0, 0.3, 0], r: [2.9, 2.3, 5.8] },
    part(name, out, side = 1) {
      // (the fin is turned on its hinge now: the same spot on it as before, out at its tip)
      if (name === 'wings') return out.copy(fins[side > 0 ? 1 : 0].f.localToWorld(_w.set(side * 4.6, 0, -0.4).applyAxisAngle(_up, -side * 0.3)));
      if (name === 'tail') return out.copy(tail.localToWorld(_w.set(0, 0.1, -2.8)));
      return null;
    },
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id;
      const asleep = state === 'sleep', weary = state === 'weary', resolved = state === 'resolved';
      // how high she swims: high and wary; low when she cries; on the floor, worn out; up again, calm
      M.low = ease(M.low, asleep ? 0.4 : weary ? 1 : state === 'open' ? 0.75 : id === 'dive' ? Math.min(1, k * 1.3) * (k >= 1 ? 1 : 0.6) : resolved ? 0.1 : 0, 2.5);
      M.hover = THREE.MathUtils.lerp(7.5, 2.3, M.low) + Math.sin(t * 0.8) * 0.4;
      M.open = ease(M.open, state === 'open' ? 1 : id === 'gust' && k > 0.5 ? 0.6 : id === 'wail' ? Math.min(1, k * 1.3) : 0, 5);
      M.roll = ease(M.roll, id === 'roll' ? (k >= 1 ? -1 : 1.1 * k) * (attack?.side ?? 1) : 0, k >= 1 ? 9 : 3);
      M.swim += dt * (0.8 + speed * 0.6);
      // she banks into her turns and tips with her climb and fall, on soft springs (the lag of something so big)
      const behind = turn.update(dt, M.heading);
      const vy = lastY == null || !(dt > 0) ? 0 : (M.pos.y - lastY) / dt; lastY = M.pos.y;
      const b = bank.update(dt, THREE.MathUtils.clamp(behind * 1.4, -0.3, 0.3)), p = tilt.update(dt, THREE.MathUtils.clamp(-vy * 0.08, -0.25, 0.25));
      body.rotation.z = Math.sin(M.swim * 0.7) * 0.08 + M.roll + b;
      body.rotation.x = Math.sin(M.swim * 0.5) * 0.05 + (state === 'open' ? -0.15 : 0) + p;
      // the fins row on a travelling wave, the tips a third of a beat behind the roots; the fluke trails the tail
      const rate = ((0.8 + speed * 0.6) * 1.6) / (Math.PI * 2), amp = 0.35 * (weary ? 0.3 : 1);
      finWave.update(dt, rate); tailWave.update(dt, rate);
      for (const F of fins) {
        F.f.rotation.z = F.s * (finWave.angle(0, amp, 0) - 0.1);
        for (let i = 1; i < F.joints.length; i++) F.joints[i].rotation.z = F.s * (finWave.angle(i, amp * 0.8, 0.7) - finWave.angle(i - 1, amp * 0.8, 0.7));
      }
      tail.rotation.x = tailWave.angle(0, 0.3, 0);
      fluke.rotation.x = tailWave.angle(1, 0.3, 0.9) - tailWave.angle(0, 0.3, 0.9);
      jaw.rotation.x = M.open * 0.5 + (state === 'open' ? Math.sin(t * 6) * 0.05 : 0);
      const calm = resolved ? 1 : meter;
      glowM.uniforms.uGlow.value = 0.12 + 0.75 * calm + (calm < 0.5 ? Math.max(0, Math.sin(t * 7)) * 0.08 : 0.06 * Math.sin(t * 1.3));
      group.updateMatrixWorld(true);
      mouth.copy(jaw.localToWorld(_w.set(0, 0, 2.6)));
    },
  };
  return M;
}

/**
 * The Spheres' Echo (organic, after its fashion: a being of sound; you calm it): what an Answerer left when it
 * turned over the plaza and went on. A pale core with three tilted rings of glass turning round it, a long soft
 * veil under it; it sings in notes the garden's spheres remember. Floating.
 */
export function echoModel({ core = '#fbf3d8', ring = '#d6e6ee', veil = '#e9dff2', glow = '#a8e6ee' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const coreM = makeMaterial({ color: core, glow: 0.4, flat: true, key: `echo.core.${uid++}` });
  const glowM = makeMaterial({ color: glow, glow: 0.2, flat: true, key: `echo.glow.${uid++}` });
  const body = new THREE.Group();
  group.add(body);
  const heart = new THREE.Mesh(merge(ell([1.6, 1.6, 1.6], '#ffffff', [0, 0, 0], null, [16, 12])), coreM);
  body.add(heart);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Group();
    r.rotation.set(0.6 + i * 0.9, i * 1.1, 0.3 * i);
    body.add(r);
    r.add(new THREE.Mesh(merge(T2(new THREE.TorusGeometry(3.0 + i * 0.7, 0.16, 5, 48), ring)), mat));
    const marks = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; marks.push(glyphGeometry(0.7, 0.06).rotateY(Math.PI / 2).rotateZ(a).translate(Math.cos(a) * (3.0 + i * 0.7), Math.sin(a) * (3.0 + i * 0.7), 0)); }
    r.add(new THREE.Mesh(merge(...marks.map((g) => (g.index ? g.toNonIndexed() : g))), glowM));
    rings.push(r);
  }
  // the veil: soft panels hanging under it, each three hinged lengths: a ripple runs down them (a travelling wave, the
  // hem behind the top) and they trail behind as it drifts (plan 11's threads)
  const veils = [];
  for (let i = 0; i < 7; i++) {
    const v = new THREE.Group();
    const a = (i / 7) * Math.PI * 2;
    v.position.set(Math.cos(a) * 1.0, -1.2, Math.sin(a) * 1.0);
    v.rotation.y = -a;
    body.add(v);
    const joints = [v];
    let parent = v;
    for (let s = 0; s < 3; s++) {
      if (s > 0) { const j = new THREE.Group(); j.position.y = -1.42; parent.add(j); joints.push(j); parent = j; }
      parent.add(new THREE.Mesh(merge(ell([0.5 - s * 0.05, 0.82, 0.08], veil, [0, -0.68, 0])), mat));
    }
    v.userData.a = a; v.userData.joints = joints;
    veils.push(v);
  }
  noCollide(group);
  const mouth = V();
  const veilWave = new Wave(), drift = { x: new SecondOrder(0.8, 0.45, 0), z: new SecondOrder(0.8, 0.45, 0) }, spinRate = new SecondOrder(0.7, 0.4, 0, 0.9);
  const lastPos = V(); let started = false;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: true, hover: 6,
    mouth, mouthR: 2.0, radius: 3.6, height: 5, bodyR: 2.2, touchR: 3.0,
    body, rings, veils, coreM, glowM, open: 0, low: 0, spin: 0, marks: { c: [0, 0, 0], r: [1.7, 1.7, 1.7] },
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const asleep = state === 'sleep', weary = state === 'weary', resolved = state === 'resolved';
      M.low = ease(M.low, weary ? 1 : state === 'open' ? 0.6 : asleep ? 0.3 : 0, 2.2);
      M.hover = THREE.MathUtils.lerp(6.5, 2.2, M.low) + Math.sin(t * 1.1) * 0.35;
      M.open = ease(M.open, state === 'open' ? 1 : 0, 4);
      // (the rings spin up on a spring as it winds up: they lag, overshoot a little, and settle)
      M.spin += dt * spinRate.update(dt, asleep || weary ? 0.2 : resolved ? 0.4 : 0.9 + (attack ? k * 2.5 : 0));
      // its chord: the rings tilt flat, one over another, into a single lens aimed at you
      M.align = ease(M.align ?? 0, attack?.id === 'chord' ? Math.min(1, k * 1.3) : 0, 4);
      rings.forEach((r, i) => { r.rotation.z = M.spin * (i % 2 ? -1 : 1) * (0.6 + i * 0.25); r.rotation.x = lerp(0.6 + i * 0.9, 0, M.align); r.rotation.y = lerp(i * 1.1, 0, M.align); });
      // the veils: its drift (in its own frame) trails them back on springs; a ripple runs down each, the hem last
      if (!started) { lastPos.copy(M.pos); started = true; }
      const vx = dt > 0 ? (M.pos.x - lastPos.x) / dt : 0, vz = dt > 0 ? (M.pos.z - lastPos.z) / dt : 0; lastPos.copy(M.pos);
      const sh = Math.sin(M.heading), ch = Math.cos(M.heading);
      const fwd = drift.z.update(dt, THREE.MathUtils.clamp(vx * sh + vz * ch, -6, 6)), side = drift.x.update(dt, THREE.MathUtils.clamp(vx * ch - vz * sh, -6, 6));
      veilWave.update(dt, 1.3 / (Math.PI * 2) + speed * 0.05);
      veils.forEach((v, i) => {
        const a = v.userData.a, J = v.userData.joints, off = i;
        // (how much of the drift sweeps this panel back: it hangs from the ring at angle a)
        const trail = (Math.cos(a) * fwd - Math.sin(a) * side) * 0.06;
        v.rotation.x = Math.sin(2 * Math.PI * veilWave.phase + off) * 0.18 + speed * 0.05 + trail;
        for (let s = 1; s < J.length; s++) J[s].rotation.x = (Math.sin(2 * Math.PI * veilWave.phase + off - s * 0.8) - Math.sin(2 * Math.PI * veilWave.phase + off - (s - 1) * 0.8)) * 0.18 + trail * 0.5;
      });
      const calm = resolved ? 1 : meter;
      coreM.uniforms.uGlow.value = 0.35 + 0.5 * M.open * (0.6 + 0.4 * Math.sin(t * 9)) + 0.15 * calm;
      glowM.uniforms.uGlow.value = 0.15 + 0.75 * calm;
      group.updateMatrixWorld(true);
      mouth.copy(group.position);
    },
  };
  return M;
}
const T2 = (g, color) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  const c = new THREE.Color(color), n = out.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return out;
};

/**
 * Lorn II's Lampless (organic: you calm it): a great pale moth that drank the Lamp-House's light the night
 * the sky rang, and the three pools' with it, and is still hungry, and frightened of how dark it made
 * everything. A furred body, four broad wings with glyph eye-spots, feathered antennae. Floating.
 */
export function mothModel({ fur = '#e9dff2', wing = '#d6c8e6', wing2 = '#b9a6d4', dark = '#2f3560', glow = '#f6c84e' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const glowM = makeMaterial({ color: glow, glow: 0.12, flat: true, key: `moth.glow.${uid++}` });
  const eyeM = makeMaterial({ color: dark, flat: true, key: `moth.eye.${uid++}` });
  const body = new THREE.Group();
  group.add(body);
  const tufts = [];
  for (let i = 0; i < 8; i++) tufts.push(ell([0.75, 0.55, 0.6], fur, [Math.sin(i * 2.4) * 0.3, 0.45 + (i % 2) * 0.1, -2.2 + i * 0.6], null, [7, 5]));
  body.add(new THREE.Mesh(merge(
    ell([0.95, 0.9, 2.6], fur, [0, 0, -0.6], null, [14, 10]),
    ell([0.85, 0.8, 0.9], fur, [0, 0.1, 1.7], null, [12, 8]),
    tufts,
  ), mat));
  body.add(new THREE.Mesh(merge(ell([0.24, 0.26, 0.2], '#ffffff', [-0.5, 0.3, 2.45]), ell([0.24, 0.26, 0.2], '#ffffff', [0.5, 0.3, 2.45])), eyeM));
  // antennae: feathered fronds
  for (const s of [-1, 1]) {
    const pts = [[s * 0.3, 0.7, 2.3], [s * 0.9, 1.6, 3.0], [s * 1.6, 2.2, 3.3]];
    body.add(new THREE.Mesh(merge(tube(pts, 0.05, fur, 8, 4), ell([0.5, 0.06, 0.25], fur, [s * 1.4, 2.0, 3.25], [0, s * 0.4, 0])), mat));
  }
  // four wings, each a broad flat oval with a glyph eye-spot, hinged at the shoulder and again halfway out (the outer
  // half trails the inner on a travelling wave: plan 13)
  const wings = [];
  for (const [s, z, len, back] of [[-1, 0.6, 4.6, 0], [1, 0.6, 4.6, 0], [-1, -0.9, 3.6, 1], [1, -0.9, 3.6, 1]]) {
    const w = new THREE.Group();
    w.position.set(s * 0.7, 0.35, z);
    body.add(w);
    const ry = s * (back ? -0.35 : 0.25), wd = back ? 1.6 : 2.2, z0 = back ? -0.6 : 0.2, col = back ? wing2 : wing;
    const u = V(Math.cos(ry), 0, -Math.sin(ry)).multiplyScalar(s * len), e0 = V(s * len * 0.95, 0, z0).sub(u);
    const at = (k) => e0.clone().addScaledVector(u, k);
    w.add(new THREE.Mesh(merge(ell([len * 0.55, 0.08, wd], col, at(0.55).toArray(), [0, ry, 0])), mat));
    const outer = new THREE.Group(); outer.position.copy(at(1.0)); w.add(outer);
    outer.add(new THREE.Mesh(merge(ell([len * 0.52, 0.08, wd * 0.92], col, at(1.48).sub(outer.position).toArray(), [0, ry, 0])), mat));
    outer.add(new THREE.Mesh(merge(glyphGeometry(back ? 1.0 : 1.4, 0.05).rotateX(-Math.PI / 2).translate(s * len * 1.1 - outer.position.x, 0.07, z0 - outer.position.z)), glowM));
    wings.push({ w, s, back, outer });
  }
  noCollide(group);
  const mouth = V(), _w = V();
  const flapWave = new Wave(), bank = new SecondOrder(1.8, 0.5, 0), tilt = new SecondOrder(2, 0.5, 0), turn = new TurnLag(2.4, 1);
  let lastY = null;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: true, hover: 6,
    mouth, mouthR: 1.6, radius: 3.4, height: 3.4, bodyR: 2.2, touchR: 1.6,
    body, wings, glowM, low: 0, flap: 0, marks: { c: [0, 0.2, -0.3], r: [1.0, 0.95, 2.6] },
    part(name, out, side = 1) {
      if (name === 'wings') { const W = wings.find((w) => w.s === side && !w.back); return out.copy(W.w.localToWorld(_w.set(side * 4.2, 0.1, 0.2))); }
      return null;
    },
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const asleep = state === 'sleep', weary = state === 'weary', resolved = state === 'resolved';
      M.low = ease(M.low, weary ? 1 : state === 'open' ? 0.65 : asleep ? 0.8 : attack?.id === 'swoop' ? Math.min(1, k * 1.2) : 0, 2.4);
      M.hover = THREE.MathUtils.lerp(7, 1.6, M.low) + Math.sin(t * 2.2) * 0.3;
      const rate = asleep || weary ? 1.2 : state === 'open' ? 3 : 7 + speed;
      M.flap += dt * rate;
      flapWave.update(dt, rate / (Math.PI * 2));
      const amp = asleep || weary ? 0.12 : state === 'open' ? 0.35 : 0.65;
      // the beat: the hind wings a little behind the fore, each outer half trailing its inner half
      for (const W of wings) {
        const ph = 2 * Math.PI * flapWave.phase + (W.back ? 0.5 : 0);
        W.w.rotation.z = W.s * (Math.sin(ph) * amp + (weary ? -0.25 : 0.15));
        W.outer.rotation.z = W.s * (Math.sin(ph - 0.9) - Math.sin(ph)) * amp * 0.55;
      }
      // it banks into its turns and noses up as it climbs, on quick light springs
      const behind = turn.update(dt, M.heading);
      const vy = lastY == null || !(dt > 0) ? 0 : (M.pos.y - lastY) / dt; lastY = M.pos.y;
      body.rotation.z = bank.update(dt, THREE.MathUtils.clamp(behind * 1.2, -0.35, 0.35));
      body.rotation.x = (state === 'open' ? -0.25 : 0) + tilt.update(dt, THREE.MathUtils.clamp(-vy * 0.1, -0.3, 0.3));
      const calm = resolved ? 1 : meter;
      glowM.uniforms.uGlow.value = 0.12 + 0.75 * calm + (state === 'open' ? 0.15 * Math.sin(t * 8) : 0);
      group.updateMatrixWorld(true);
      mouth.copy(body.localToWorld(_w.set(0, 0, 2.6)));
    },
  };
  return M;
}

/**
 * Vael's Elder (organic: you calm her): the oldest of the great birds, so old her feathers have gone to
 * stone, who kept the makers' Aerie and stopped flying the night the light went over. A heavy body on two
 * long legs, a long neck and a longer beak, wings of stone feathers that fold, spread and beat; glyph lines
 * along her wings glow as she calms. In her second phase she leaves the floor and hangs in the air
 * (`floats`), afraid, beating hard.
 */
export function elderModel({ stone = '#efe6d2', feather = '#e2d6bf', tip = '#b98f9a', beak = '#d8a24a', dark = '#4a4a5e', glow = '#7cc1c4' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const glowM = makeMaterial({ color: glow, glow: 0.15, flat: true, key: `elder.glow.${uid++}` });
  const rig = new THREE.Group();
  group.add(rig);
  // the body, the tail fan, the legs
  const tail = [];
  for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25; tail.push(ell([0.55, 0.12, 2.2], i % 2 ? feather : tip, [Math.sin(a) * 1.4, 3.9 + Math.abs(a) * 0.3, -3.6 - Math.cos(a) * 1.2], [0.25, a, 0])); }
  rig.add(new THREE.Mesh(merge(ell([2.3, 1.9, 3.4], stone, [0, 4.4, 0], null, [14, 9]), ell([1.7, 1.5, 1.6], feather, [0, 4.2, 2.2]), tail), mat));
  // the neck and the head: a long beak, dark eyes, a crest of three plumes
  const neck = new THREE.Group();
  neck.position.set(0, 5.4, 2.6);
  rig.add(neck);
  neck.add(new THREE.Mesh(merge(tube([[0, 0, 0], [0, 1.4, 0.5], [0, 2.8, 0.6]], 0.55, stone, 10, 7)), mat));
  const head = new THREE.Group();
  head.position.set(0, 3.0, 0.7);
  neck.add(head);
  head.add(new THREE.Mesh(merge(ell([0.75, 0.7, 0.95], stone, [0, 0, 0]), cone(0.32, 3.4, beak, [0, -0.15, 2.3], [Math.PI / 2, 0, 0]),
    ell([0.13, 0.17, 0.13], dark, [0.55, 0.15, 0.35]), ell([0.13, 0.17, 0.13], dark, [-0.55, 0.15, 0.35]),
    [-0.3, 0, 0.3].map((x, i) => ell([0.1, 0.12, 1.1], i === 1 ? tip : feather, [x, 0.75, -0.6], [0.7, x, 0]))), mat));
  // the wings: four long stone feathers each, hinged at the shoulder and at each other (nested), so a beat runs out
  // along the wing as a travelling wave, the tip behind the root; glyph lines along them
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 1.9, 5.1, 0.9);
    rig.add(w);
    const joints = [];
    let parent = w, at = 0;
    for (let i = 0; i < 4; i++) {
      const x = s * (1.4 + i * 1.5), z = -0.35 * i, jx = i === 0 ? 0 : s * (0.65 + i * 1.5);
      const p = new THREE.Group(); p.position.set(jx - at, 0, 0); parent.add(p); joints.push(p);
      p.add(new THREE.Mesh(merge(ell([1.6, 0.16, 1.1 - i * 0.12], i === 3 ? tip : i % 2 ? feather : stone, [x - jx, 0, z], [0, s * (0.15 + i * 0.12), 0])), mat));
      p.add(new THREE.Mesh(merge(box([1.8, 0.05, 0.08], '#ffffff', [x - jx, 0.17, z], [0, s * (0.15 + i * 0.12), 0])), glowM));
      parent = p; at = jx;
    }
    return { w, s, joints };
  });
  // two long bird's legs on the kit (plan 7: the joint two thirds up bends back), three toes on each foot
  const tellRig = tellFrame(group);
  const legM = flatMats('elder', { joint: beak, thigh: beak, shin: beak, foot: beak });
  const kit = new GuardianLegs({ plan: GUARDIAN_PLANS.elder, group, body: rig, legs: [-1, 1].map((s) => ({ hip: { x: s * 1.0, y: 3.6, z: 0.3 }, foot: { x: s * 1.05, z: 0.45 }, radius: 0.24, pad: 'point', mats: legM })) });
  const legs = kit.legs;
  for (const L of legs) for (const a of [-0.5, 0, 0.5]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.1, 6).rotateX(Math.PI / 2).translate(0, 0.08, 0.5).rotateY(a), legM.foot); L.foot.add(toe); }
  noCollide(group);
  const mouth = V(), _w = V();
  const beatWave = new Wave(), neckLag = new TurnLag(1, 0.5);
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: false, hover: 3.5, tellRig, kit,
    mouth, mouthR: 1.4, radius: 3.0, height: 7, bodyR: 2.6, touchR: 1.0,
    rig, neck, head, wings, legs, glowM, spread: 0, raise: 0, lift: 0, pitch: 0, beat: 0, marks: { c: [0, 4.4, 0], r: [2.3, 1.9, 3.4] },
    part(name, out, side = 1) {
      if (name === 'wings') { const W = wings.find((w) => w.s === side); return out.copy(W.w.localToWorld(_w.set(side * 5.8, 0, -1))); }
      if (name === 'mouth') return out.copy(head.localToWorld(_w.set(0, -0.15, 3.6)));
      if (name === 'feet') return kit.footAt(side > 0 ? 1 : 0, out);
      return null;
    },
    animate(dt, t, opts) {
      const { state, attack, k = 0, meter = 0, phase = 0 } = opts;
      const id = attack?.id, struck = !!attack && k >= 1;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      // in the air from her second phase (she has left the floor, but can't bring herself to fly)
      M.floats = phase >= 1 && (state === 'fight' || state === 'open');
      let spread = 0.35, raise = 0.1, lift = 0, pitch = 0, neckK = 0.2, beat = M.floats ? 1 : 0;
      if (state === 'sleep') { spread = 0; raise = -0.2; neckK = 0.9; pitch = 0.15; }
      else if (state === 'weary') { spread = 0.15; raise = -0.3; lift = -1.6; neckK = 1; pitch = 0.1; beat = 0; }
      else if (state === 'resolved') { spread = 0.7; raise = 0.2; neckK = 0; beat = 0; }
      else if (state === 'open') { spread = 1; raise = 0.35 + 0.08 * Math.sin(t * 14); neckK = -0.6; pitch = -0.15; beat = M.floats ? 0.6 : 0; }
      else if (id === 'buffet') { spread = 1; raise = struck ? -0.45 : 0.75 * k; pitch = struck ? 0.1 : -0.2 * k; beat = 0; }
      else if (id === 'stamp') { spread = 0.8; raise = 0.5; lift = struck ? 0 : 1.6 * k; pitch = struck ? 0.2 : -0.45 * k; }
      else if (id === 'peck') { spread = 0.5; raise = 0.3; neckK = struck ? 1.1 : -0.6 * k; pitch = struck ? 0.25 : -0.15 * k; }
      else if (id === 'dive') { spread = 1; raise = struck ? -0.2 : 0.6; lift = struck ? -M.hover + 0.4 : 2.8 * k; pitch = struck ? 0.3 : -0.2; beat = struck ? 0 : 1; }
      M.spread = ease(M.spread, spread, 5); M.raise = ease(M.raise, raise, struck ? 14 : 5);
      M.lift = ease(M.lift, lift, struck ? 12 : 3); M.pitch = ease(M.pitch, pitch, 5); M.beat = ease(M.beat, beat, 3);
      // the kit: her feet hang (tucked back) in the air, as she hops up to stamp, and as she rises to dive
      const rising = attack?.rig === 'rise' && state === 'fight' && !struck ? Math.min(1, k * 3) : 0;
      const air = M.floats ? 1 : Math.max(rising, THREE.MathUtils.clamp((M.lift - 0.35) / 0.8, 0, 1));
      const o = kit.update(M, dt, opts, { air });
      rig.position.set(o.x, M.lift + (M.floats ? Math.sin(t * 3.2) * 0.35 : 0) + o.y, o.z);
      rig.rotation.set(M.pitch + o.pitch, o.yaw, o.roll);
      // the beat runs out along each wing, the tip behind the root (a travelling wave: plan 14)
      beatWave.update(dt, 6.5 / (Math.PI * 2));
      const flap = M.beat * beatWave.angle(0, 0.55, 0);
      for (const { w, s, joints } of wings) {
        // folded: swept back along the body and down; spread: out and level; raise lifts them
        w.rotation.set(0, s * (1 - M.spread) * 1.25, s * (M.raise + flap) - s * (1 - M.spread) * 0.9, 'YXZ');
        for (let i = 1; i < joints.length; i++) joints[i].rotation.z = s * M.beat * (beatWave.angle(i, 0.55, 0.45) - beatWave.angle(i - 1, 0.55, 0.45)) * M.spread;
      }
      // the neck lags her turns; the head is held steady against her body's tilt
      neck.rotation.x = neckK * 0.7;
      neck.rotation.y = -neckLag.update(dt, M.heading) * 0.9;
      head.rotation.x = -neckK * 0.5 + Math.sin(t * 0.9) * 0.05 - o.pitch * 0.7;
      const calm = state === 'resolved' ? 1 : meter;
      glowM.uniforms.uGlow.value = 0.12 + 0.8 * calm + (state === 'open' ? 0.1 * Math.max(0, Math.sin(t * 5)) : 0);
      kit.write();
      group.updateMatrixWorld(true);
      mouth.copy(head.localToWorld(_w.set(0, 0, 0.6)));
    },
  };
  return M;
}

/**
 * Lorn's Mother Snapper (organic: you calm her): the oldest of the swamp's carnivorous plants, as big as a
 * house, rooted in the Hush's hall. The makers grew her to keep it; since the night the sky rang she snaps
 * at everything that moves. A bulb in a ring of broad leaves, a long neck of green beads, a great head of
 * two jaws ringed with teeth, a crown of crystal on it. She does not walk (her `pos` stays; she turns):
 * her head lunges along her facing (`reach` metres: the lane of her bite), sweeps low to the sides, or
 * rears up to spit seed. After a lunge it lies spent on the floor, agape: that is when a stilling glob in
 * her mouth calms her.
 */
export function snapperModel({ stalk = '#3f6a52', stalk2 = '#4c7d5c', leaf = '#5a8f5e', leaf2 = '#47784f', head = '#c94f6a', lip = '#ee93a2', inside = '#93304a', tooth = '#f3ead8', glow = '#a99be0', reach = 12 } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const glowM = makeMaterial({ color: glow, glow: 0.15, flat: true, key: `snapper.glow.${uid++}` });
  // the bulb and its leaves (they stay)
  const leaves = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; leaves.push(ell([1.5, 0.22, 3.4], i % 2 ? leaf : leaf2, [Math.sin(a) * 3.4, 0.35 + (i % 2) * 0.25, Math.cos(a) * 3.4], [-0.18, a, 0])); }
  group.add(new THREE.Mesh(merge(ell([2.6, 1.7, 2.6], stalk, [0, 1.0, 0], null, [12, 8]), ell([1.6, 1.0, 1.6], stalk2, [0, 2.2, 0]), leaves), mat));
  // the neck: beads along a curve from the bulb to the back of the head, set every frame
  const bead = ell([1, 1, 1], stalk, [0, 0, 0], null, [10, 7]), bead2 = ell([1, 1, 1], stalk2, [0, 0, 0], null, [10, 7]);
  const beads = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(i % 3 === 1 ? bead2 : bead, mat); const r = 1.05 - i * 0.03; m.scale.setScalar(r); group.add(m); beads.push(m); }
  // the head: two jaws hinged at the back, teeth round their rims, a crown of crystal on top
  const H = new THREE.Group();
  group.add(H);
  const teeth = (y, down) => { const t = []; for (let i = 0; i < 11; i++) { const a = -1.35 + (i / 10) * 2.7; t.push(cone(0.17, 0.62, tooth, [Math.sin(a) * 2.0, y, 1.6 + Math.cos(a) * 2.2], down ? [Math.PI, 0, 0] : null)); } return t; };
  const upper = new THREE.Group(), lower = new THREE.Group();
  upper.position.set(0, 0.05, -1.6); lower.position.set(0, -0.05, -1.6);
  H.add(upper, lower);
  upper.add(new THREE.Mesh(merge(dome([2.3, 1.4, 2.5], head, [0, 0, 1.6], null, [16, 6]), ell([2.25, 0.08, 2.45], lip, [0, 0, 1.6], null, [16, 3]), ell([1.9, 0.9, 2.1], inside, [0, -0.02, 1.6], [Math.PI, 0, 0], [12, 5]), teeth(-0.25, true)), mat));
  lower.add(new THREE.Mesh(merge(dome([2.2, 1.1, 2.4], head, [0, 0, 1.6], [Math.PI, 0, 0], [16, 6]), ell([2.15, 0.08, 2.35], lip, [0, 0, 1.6], null, [16, 3]), ell([1.8, 0.7, 2.0], inside, [0, 0.02, 1.6], null, [12, 5]), teeth(0.25, false)), mat));
  const crown = [];
  for (let i = 0; i < 5; i++) { const a = -0.8 + (i / 4) * 1.6; crown.push(new THREE.OctahedronGeometry(1, 0).scale(0.28, 0.9 + (i % 2) * 0.35, 0.28).rotateZ(-a * 0.5).translate(Math.sin(a) * 1.1, 1.55, 1.2 + Math.cos(a) * 0.3)); }   // (an octahedron has no index: no toNonIndexed)
  upper.add(new THREE.Mesh(merge(...crown), glowM));
  noCollide(group);
  // where the head goes (group frame), how wide the jaws, its pitch and turn: eased toward these
  const at = V(0, 3.5, 3), want = V(), ctrl = V(), root = V(0, 2.4, 0), back = V(), f = V(), _w = V();
  const chain = beads.map(() => V()).concat([V()]), shape = chain.map(() => V()), links = new Array(beads.length).fill(1);
  let neckSet = false;
  const mouth = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, rooted: true, reach,
    mouth, mouthR: 1.9, radius: 3.6, height: 6, bodyR: 2.8, touchR: 1.6,
    H, upper, lower, beads, neckChain: chain, neckShape: shape, glowM, gape: 0, pitch: 0.6, turn: 0, head: at, marks: { c: [0, 1.3, 0], r: [2.7, 1.8, 2.7] },
    animate(dt, t, { state, attack, k = 0, meter = 0 }) {
      const id = attack?.id, struck = !!attack && k >= 1;
      let gape = 0.12 + 0.06 * Math.sin(t * 2.2), pitch = 0.35, turn = 0, rate = 3.5;
      want.set(Math.sin(t * 0.7) * 0.6, 8 + Math.sin(t * 1.1) * 0.3, 2.2);
      if (state === 'sleep') { want.set(0, 3.2, 3.4); gape = 0.04; pitch = 0.9; rate = 1.5; }
      else if (state === 'weary' || state === 'resolved') { want.set(0, 1.8, 5.2); gape = 0.05; pitch = 0.15; rate = 1.2; }
      else if (state === 'open') { want.set(0, 1.85, reach - 1.2); gape = 0.55 + 0.08 * Math.sin(t * 3.4); pitch = 0.05; rate = 6; }
      else if (id === 'lunge') {
        if (!struck) { want.set(0, 9.6, -1.2); gape = 0.15 + 0.75 * k; pitch = -0.1; rate = 4; }
        else { want.set(0, 1.85, reach - 1.2); gape = 0; pitch = 0.05; rate = 16; }
      } else if (id === 'snap') {
        // a short snap: reared only half as high, struck only halfway out (the feint before the real lunge)
        if (!struck) { want.set(0, 7.5, 0.5); gape = 0.15 + 0.6 * k; pitch = -0.05; rate = 5; }
        else { want.set(0, 2.4, 6.5); gape = 0; pitch = 0.1; rate = 16; }
      } else if (id === 'thrash') {
        // the head pulled down into her leaves, then thrown up and round
        if (!struck) { want.set(0, 2.6, 1.6); gape = 0.3 * k; pitch = 0.7; rate = 4; }
        else { want.set(Math.sin(t * 9) * 4, 6, Math.cos(t * 9) * 4); gape = 0.5; pitch = 0.2; rate = 10; }
      } else if (id === 'sweep') {
        const sd = attack?.side ?? 1;
        if (!struck) { want.set(-5.5 * sd, 3.2, 3.5); gape = 0.6 * k; pitch = 0.2; turn = -0.9 * sd; rate = 4; }
        else { want.set(5.5 * sd, 2.6, 3.5); gape = 0.1; pitch = 0.2; turn = 0.9 * sd; rate = 9; }
      } else if (id === 'seed') {
        if (!struck) { want.set(0, 10.5, 0.2); gape = 0.2 + 0.5 * k; pitch = -1.15; rate = 3; }
        else { want.set(0, 10, 0.8); gape = 0.9; pitch = -0.9; rate = 8; }
      }
      const e = Math.min(1, dt * rate);
      at.lerp(want, e);
      M.gape += (gape - M.gape) * Math.min(1, dt * (struck && id === 'lunge' ? 30 : 7));
      M.pitch += (pitch - M.pitch) * e; M.turn += (turn - M.turn) * e;
      H.position.copy(at);
      H.rotation.set(M.pitch, M.turn, 0, 'YXZ');
      upper.rotation.x = -M.gape * 0.85; lower.rotation.x = M.gape * 0.45;
      // the neck: from the bulb up, then over, into the back of the head
      f.set(Math.sin(M.turn) * Math.cos(M.pitch), -Math.sin(M.pitch), Math.cos(M.turn) * Math.cos(M.pitch));
      back.copy(at).addScaledVector(f, -1.4);
      ctrl.set(back.x * 0.2, Math.max(back.y, 5) + 2.2, back.z * 0.25);
      // (the curve is the shape it wants; the neck itself is a FABRIK chain of beads that follows it, its middle a beat
      // behind its ends: it lags a lunge and whips after it, and never stretches past the curve's own length)
      const N = beads.length;
      let len = 0;
      for (let j = 0; j <= N; j++) {
        const u = j / N, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
        shape[j].set(root.x * a + ctrl.x * b + back.x * c, root.y * a + ctrl.y * b + back.y * c, root.z * a + ctrl.z * b + back.z * c);
        if (j) len += shape[j].distanceTo(shape[j - 1]);
      }
      if (!neckSet) { for (let j = 0; j <= N; j++) chain[j].copy(shape[j]); neckSet = true; }
      for (let j = 1; j < N; j++) chain[j].lerp(shape[j], 1 - Math.exp(-dt * lerp(16, 5, Math.sin((Math.PI * j) / N))));
      chain[0].copy(root);
      links.fill(len / N);
      chain[N].copy(chain[N - 1]);   // (off the target, so FABRIK runs at least once and the links come out even)
      fabrik(chain, links, back, 8, 1e-3);
      for (let i = 0; i < N; i++) beads[i].position.lerpVectors(chain[i], chain[i + 1], 0.6);
      const calm = state === 'resolved' ? 1 : meter;
      glowM.uniforms.uGlow.value = 0.15 + 0.75 * calm + (calm < 0.5 && state !== 'sleep' ? Math.max(0, Math.sin(t * 7)) * 0.12 : 0);
      group.updateMatrixWorld(true);
      mouth.copy(H.localToWorld(_w.set(0, 0, 0.7)));
    },
  };
  return M;
}

/** The sentinel (robot: you may break it). parts: a tall body on three legs, a ring of vents, a lamp-eye. */
export function sentinelModel({ hull = '#9fb2c6', hull2 = '#8aa0b8', dark = '#34405e', brass = '#e2b552', eye = '#f6c84e', vents: nV = 3, legs: nL = 3, guarded = true } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const eyeM = makeMaterial({ color: eye, glow: 0.9, flat: true, key: `sentinel.eye.${uid++}` });
  const ventM = makeMaterial({ color: '#e0644a', glow: 0.1, flat: true, key: `sentinel.vent.${uid++}` });
  const body = new THREE.Group();
  body.position.y = 5;
  group.add(body);
  body.add(new THREE.Mesh(merge(
    cyl(1.8, 2.3, 3.2, hull, [0, 0, 0], null, 12),
    cyl(2.5, 2.5, 0.5, dark, [0, -1.7, 0], null, 12),
    cyl(1.3, 1.8, 1.4, hull2, [0, 2.3, 0], null, 12),
    ell([1.3, 0.8, 1.3], hull, [0, 3.1, 0], null, [12, 6]),
    box([0.3, 2.2, 0.3], brass, [0, 4.4, 0]),
  ), mat));
  const vents = new THREE.Group();
  body.add(vents);
  const ventGeo = [];
  for (let i = 0; i < nV; i++) {
    const a = (i / nV) * Math.PI * 2;
    ventGeo.push(box([1.0, 0.9, 0.2], '#ffffff', [Math.sin(a) * 2.32, 0.4, Math.cos(a) * 2.32], [0, a, 0]));
  }
  vents.add(new THREE.Mesh(merge(...ventGeo), ventM));
  const shutters = [];
  for (let i = 0; i < nV; i++) {
    const a = (i / nV) * Math.PI * 2, s = new THREE.Group();
    s.position.set(Math.sin(a) * 2.42, 0.4, Math.cos(a) * 2.42);
    s.rotation.y = a;
    s.add(new THREE.Mesh(merge(box([1.2, 1.1, 0.16], dark, [0, 0, 0])), mat));
    body.add(s);
    shutters.push(s);
  }
  const head = new THREE.Group();
  head.position.y = 2.7;
  body.add(head);
  // the crown vent (it opens in the second phase, when its sides are shut)
  const topVent = new THREE.Mesh(merge(cyl(0.7, 0.8, 0.25, '#ffffff', [0, 0.6, 0], null, 12)), makeMaterial({ color: '#e0644a', glow: 0.1, flat: true, key: `sentinel.top.${uid++}` }));
  head.add(topVent);
  // its hatch, hinged at one side: guarded, it swings up when the crown vent opens, and a column of
  // the vent's glow rises out of it, tall enough to see from the floor (the only vent that opens then)
  const hatch = new THREE.Group();
  hatch.position.set(-0.82, 0.78, 0);
  hatch.add(new THREE.Mesh(merge(cyl(0.84, 0.84, 0.12, dark, [0.82, 0, 0], null, 12), box([0.18, 0.2, 0.5], brass, [0.05, 0.08, 0])), mat));
  head.add(hatch);
  const plumeM = makeMaterial({ color: '#f39a45', glow: 1, side: THREE.DoubleSide, key: `sentinel.plume.${uid++}` });
  const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.55, 1, 12, 1, true).translate(0, 0.5, 0), plumeM);
  plume.position.y = 0.8; plume.visible = false;
  head.add(plume);
  head.add(new THREE.Mesh(merge(cyl(0.9, 1.1, 0.9, hull2, [0, 0, 0], null, 12)), mat));
  head.add(new THREE.Mesh(merge(ell([0.45, 0.45, 0.25], '#ffffff', [0, 0, 1.0])), eyeM));
  // its legs on the kit (plan 18/19): a strut out of the hull to a high knee, a long column down to a round foot, a
  // piston from the hull to each strut; a wave on three legs (one at a time), diagonal pairs on four (the Tooth-Warden)
  const tellRig = tellFrame(group);
  const legM = flatMats('sentinel', { joint: dark, thigh: hull2, shin: dark, foot: dark, piston: brass, rod: dark });
  const kit = new GuardianLegs({ plan: GUARDIAN_PLANS.sentinel, group, body, legs: Array.from({ length: nL }, (_, i) => {
    const a = (i / nL) * Math.PI * 2 + Math.PI / nL, sx = Math.sin(a), cz = Math.cos(a);
    return { hip: { x: sx * 1.9, y: -1.7, z: cz * 1.9 }, foot: { x: sx * 4.4, z: cz * 4.4 }, radius: 0.35, pad: 'disc', mats: legM,
      piston: { at: { x: sx * 1.7, y: -0.8, z: cz * 1.7 } } };
  }) });
  const legs = kit.legs;
  noCollide(group);
  const mouth = V(), _w = V();
  let spinLift = 0;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 1.5, radius: 3.0, height: 9, tellRig, kit,
    head, body, vents, shutters, legs, eyeM, ventM, hatch, plume, open: 0, slump: 0, gait: 0, crown: 0, only: null, marks: { c: [0, 5, 0], r: [2.35, 1.7, 2.35] },
    part(name, out, side = 1) {
      if (name === 'eye') return out.copy(head.localToWorld(_w.set(0, 0, 1.25)));
      if (name === 'head') return out.copy(head.localToWorld(_w.set(0, 1.3, 0)));
      if (name === 'feet') return kit.footAt(side > 0 ? 0 : 1 % legs.length, out);
      return null;
    },
    /** Where vent i is, in the world (a target each, for a guardian that wants them all hit at once). */
    vent(i, out = V()) { const a = (i / nV) * Math.PI * 2; return body.localToWorld(out.set(Math.sin(a) * 2.5, 0.4, Math.cos(a) * 2.5)); },
    animate(dt, t, opts) {
      const { state, attack, k = 0, meter = 0, phase = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const off = state === 'sleep' || state === 'resolved' || state === 'weary';
      M.guard = ease(M.guard ?? 0, guarded && phase >= 1 && state !== 'resolved' ? 1 : 0, 3);   // the second phase: its sides shut, its top vent open
      M.open = ease(M.open, state === 'open' ? 1 : 0, 5);
      M.slump = ease(M.slump, state === 'resolved' ? 1 : state === 'sleep' ? 0.6 : 0, 1.5);
      // the kit: a spin (the Tooth-Warden's grind) lifts its feet and it turns on its struts
      spinLift = ease(spinLift, attack?.rig === 'spin' && state === 'fight' && k > 0.2 ? 1 : 0, 6);
      for (const L of legs) { L.lift = spinLift > 0.02 ? spinLift : 0; L.air.set(0, 0.5, 0); }
      const o = kit.update(M, dt, opts);
      body.position.set(o.x, 5 - M.slump * 2.2 + o.y + spinLift * 0.4, o.z);
      body.rotation.z = M.slump * 0.25 + o.roll;
      body.rotation.y = o.yaw;
      // (its head turns in a servo's notches)
      head.rotation.y = quantise(attack ? 0 : Math.sin(t * 0.8) * 0.5, 0.07);
      head.rotation.x = M.slump * 0.6;
      const sideOpen = M.open * (1 - M.guard);
      // (M.only: one vent open at a time, the rest shut: the Tooth-Warden turning on its gear, buried.js)
      shutters.forEach((s, i) => { const o = sideOpen * (M.only == null || M.only === i ? 1 : 0); s.position.y = 0.4 + o * 1.15; s.rotation.x = -o * 0.4; });
      topVent.scale.setScalar(0.3 + 0.7 * M.guard);
      topVent.material.uniforms.uGlow.value = 0.15 + 0.85 * M.open * M.guard * (0.7 + 0.3 * Math.sin(t * 12));
      // the crown open (guarded and open): its hatch up, the glow rising out of it
      M.crown = M.open * M.guard;
      // its flare (the third phase): the hatch rattles up and the vent's glow climbs out of it before it vents at the air over it
      if (attack?.id === 'flare') M.crown = Math.max(M.crown, Math.min(1, k) * Math.max(M.guard, 0.6));
      hatch.visible = M.guard > 0.05; hatch.scale.setScalar(Math.max(0.3, M.guard));
      hatch.rotation.z = M.crown * 1.9 + (M.crown > 0.5 ? Math.sin(t * 17) * 0.05 : 0);
      plume.visible = M.crown > 0.05;
      if (plume.visible) { plume.scale.set(0.8 + 0.2 * Math.sin(t * 9), 3.6 * M.crown, 0.8 + 0.2 * Math.sin(t * 9 + 1)); plumeM.uniforms.uGlow.value = 0.55 + 0.45 * Math.sin(t * 13); }
      // the damage shows: it leans, and its hull dulls toward soot
      body.rotation.x = meter * 0.12 * Math.sin(t * 0.7) + o.pitch;
      const blink = attack && (attack.shape === 'lane' || attack.part === 'eye') ? 0.6 + 0.4 * Math.sin(t * (10 + 30 * Math.min(1, k))) : 0.9;
      eyeM.uniforms.uGlow.value = off ? (state === 'resolved' ? 0 : 0.15) : blink;
      eyeM.uniforms.uColor.value.set(attack ? '#e0644a' : '#f6c84e');
      ventM.uniforms.uGlow.value = 0.2 + 0.8 * sideOpen * (0.7 + 0.3 * Math.sin(t * 12));
      kit.write();
      group.updateMatrixWorld(true);
      // the target: its side vents, then (guarded) the vent on its crown
      if (M.guard > 0.5) mouth.copy(head.localToWorld(_w.set(0, 1.25, 0))); else mouth.copy(body.localToWorld(_w.set(0, 0.4, 2.2)));
    },
  };
  return M;
}

/**
 * The Sealed Hangar's Clockwork Foreman (robot: you may stop it, or set it right): the makers' machine that
 * kept the time of everything that turns in the Major's pocket universe, wound wrong since the night the light
 * passed. A squat drum of brass on four short legs, a great clock face for a chest with six numeral lamps
 * round it, two arms with hammers, a little bell on its crown that it strikes the hour on. Its hands race and
 * stutter; when it has struck, the glass over its face swings up and the numerals glow: hit all six inside one
 * breath (two tanks' worth: the quick coil). Set right, its hands come round to the true time and stop.
 */
export function foremanModel({ brass = '#d8a24a', brass2 = '#b8862f', teal = '#62c3c9', dark = '#34405e', cream = '#f3ead8', glass = '#cfe9e0', lamp = '#f2c54b' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const lampM = makeMaterial({ color: lamp, glow: 0.1, flat: true, key: `foreman.lamp.${uid++}` });
  const eyeM = makeMaterial({ color: '#e0644a', glow: 0.8, flat: true, key: `foreman.eye.${uid++}` });
  const glassM = makeMaterial({ color: glass, glow: 0.15, flat: true, key: `foreman.glass.${uid++}` });
  const body = new THREE.Group();
  body.position.y = 4.4;
  group.add(body);
  // the drum, its bands, the face's rim and dial
  body.add(new THREE.Mesh(merge(
    cyl(2.5, 2.7, 3.6, brass, [0, 0, 0], null, 16),
    cyl(2.8, 2.8, 0.35, dark, [0, -1.8, 0], null, 16), cyl(2.62, 2.62, 0.3, dark, [0, 1.75, 0], null, 16),
    torus(2.05, 0.2, brass2, [0, 0.1, 2.62], null, [6, 28]),
    cyl(1.95, 1.95, 0.1, cream, [0, 0.1, 2.6], [Math.PI / 2, 0, 0], 28),
    ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return box([0.09, 0.32, 0.06], dark, [Math.sin(a) * 1.65, 0.1 + Math.cos(a) * 1.65, 2.67], [0, 0, -a]); }),
    // the crown: a dome, a post, the little bell it strikes the hour on, the winding key behind
    dome([1.9, 1.0, 1.9], teal, [0, 1.9, 0], null, [14, 5]),
    cyl(0.18, 0.18, 1.2, dark, [0, 3.2, 0], null, 8),
    cyl(0.12, 0.5, 0.7, brass, [0, 3.9, 0], null, 12),
    box([0.25, 1.4, 0.25], dark, [0, 0.4, -2.85], [Math.PI / 2, 0, 0]),
    torus(0.55, 0.14, brass2, [0, 0.4, -3.6], [0, Math.PI / 2, 0], [5, 14]),
  ), mat));
  // the six numeral lamps round the face (src/temples/garage.js makes each a target)
  const NUM = 6, numAt = (i) => { const a = (i / NUM) * Math.PI * 2; return V(Math.sin(a) * 2.05, 0.1 + Math.cos(a) * 2.05, 2.78); };
  body.add(new THREE.Mesh(merge(...Array.from({ length: NUM }, (_, i) => { const p = numAt(i); return ell([0.3, 0.3, 0.16], '#ffffff', [p.x, p.y, p.z]); })), lampM));
  // a ring round each numeral that lights when it is hit in step (counted round from four: src/temples/garage.js)
  const stepM = makeMaterial({ color: '#fff3c4', glow: 0.95, flat: true, key: `foreman.step.${uid++}` });
  const stepRing = new THREE.TorusGeometry(0.42, 0.07, 4, 16);
  const steps = Array.from({ length: NUM }, (_, i) => { const p = numAt(i), r = new THREE.Mesh(stepRing, stepM); r.position.set(p.x, p.y, p.z + 0.06); r.visible = false; body.add(r); return r; });
  // the eye: a lamp under the crown
  body.add(new THREE.Mesh(merge(ell([0.32, 0.22, 0.16], '#ffffff', [0, 1.45, 2.55])), eyeM));
  // the hands, on a pivot at the face's middle
  const hands = new THREE.Group(); hands.position.set(0, 0.1, 2.72); body.add(hands);
  const hour = new THREE.Mesh(merge(box([0.2, 1.05, 0.06], dark, [0, 0.45, 0])), mat), minute = new THREE.Mesh(merge(box([0.12, 1.55, 0.06], dark, [0, 0.7, 0.04]), cyl(0.16, 0.16, 0.12, brass2, [0, 0, 0.06], [Math.PI / 2, 0, 0], 10)), mat);
  hands.add(hour, minute);
  // the grille over the face, hinged at its top: it swings up when the Foreman is open (a pale gleam on its bars)
  const lid = new THREE.Group(); lid.position.set(0, 2.25, 2.85); body.add(lid);
  lid.add(new THREE.Mesh(merge(...Array.from({ length: 6 }, (_, i) => box([0.1, 4.0, 0.08], '#ffffff', [0, -2.15, 0.04], [0, 0, (i / 6) * Math.PI]))), glassM));
  lid.add(new THREE.Mesh(merge(torus(2.02, 0.12, brass2, [0, -2.15, 0.02], null, [5, 28]), torus(0.9, 0.08, brass2, [0, -2.15, 0.06], null, [4, 20])), mat));
  // two arms with hammers
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * 2.75, 0.9, 0.3); body.add(sh);
    sh.add(new THREE.Mesh(merge(ell([0.55, 0.55, 0.55], dark, [0, 0, 0]), box([0.38, 2.6, 0.38], brass2, [s * 0.25, -1.4, 0.4], [0.3, 0, 0]), cyl(0.5, 0.5, 1.5, dark, [s * 0.35, -2.75, 0.9], [0, 0, Math.PI / 2], 10), cyl(0.56, 0.56, 0.3, brass, [s * 1.1, -2.75, 0.9], [0, 0, Math.PI / 2], 10), cyl(0.56, 0.56, 0.3, brass, [s * -0.4, -2.75, 0.9], [0, 0, Math.PI / 2], 10)), mat));
    return sh;
  });
  // four short legs on the kit (plan 18 on four: diagonal pairs in a machine's straight moves), a piston to each thigh
  const tellRig = tellFrame(group);
  const legM = flatMats('foreman', { joint: dark, thigh: brass2, shin: dark, foot: dark, piston: brass, rod: dark });
  const kit = new GuardianLegs({ plan: GUARDIAN_PLANS.foreman, group, body, legs: [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, sx = Math.sin(a), cz = Math.cos(a);
    return { hip: { x: sx * 1.9, y: -1.9, z: cz * 1.9 }, foot: { x: sx * 3.1, z: cz * 3.1 }, radius: 0.32, pad: 'disc', mats: legM,
      piston: { at: { x: sx * 1.55, y: -1.2, z: cz * 1.55 } } };
  }) });
  const legs = kit.legs;
  noCollide(group);
  const mouth = V(), _w = V();
  let race = 0, hourA = 0, minA = 0;
  const armLag = [new SecondOrder(1.8, 0.3, 0), new SecondOrder(1.8, 0.3, 0)];
  let spinLift = 0;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 0.01, radius: 3.0, height: 8.5, bodyR: 2.4, tellRig, kit,
    body, hands, hour, minute, lid, arms, legs, lampM, eyeM, steps, open: 0, slump: 0, gait: 0, numbers: NUM, marks: { c: [0, 4.4, 0], r: [2.7, 1.8, 2.7] },
    /** Numeral i's ring lit (hit in step) or dark. */
    step(i, on) { if (steps[i]) steps[i].visible = !!on; },
    part(name, out, side = 1) {
      if (name === 'arms') return out.copy(arms[side > 0 ? 1 : 0].localToWorld(_w.set(side * 0.35, -2.75, 0.9)));
      if (name === 'head') return out.copy(body.localToWorld(_w.set(0, 3.9, 0)));
      return null;
    },
    /** Where numeral lamp i is, in the world. */
    vent(i, out = V()) { const p = numAt(i); return body.localToWorld(out.set(p.x, p.y, p.z + 0.1)); },
    animate(dt, t, opts) {
      const { state, attack, k = 0, speed = 0, meter = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1;
      M.open = ease(M.open, state === 'open' ? 1 : 0, 6);
      M.slump = ease(M.slump, state === 'resolved' ? 1 : state === 'sleep' ? 0.5 : 0, 1.5);
      // the kit: its spin lifts its feet off the floor and it turns on its pistons (they hang and turn with the drum)
      spinLift = ease(spinLift, attack?.rig === 'spin' && state === 'fight' && (k > 0.2) ? 1 : 0, 6);
      for (const L of legs) { L.lift = spinLift > 0.02 ? spinLift : 0; L.air.set(0, 0.45, 0); }
      const o = kit.update(M, dt, opts);
      body.position.set(o.x, 4.4 - M.slump * 1.6 + o.y + spinLift * 0.4, o.z);
      body.rotation.set(o.pitch, o.yaw, o.roll);
      // the hands: wound wrong they race and stutter; asleep they twitch; set right they come round to the true time and stop
      if (state === 'resolved') {
        const now = new Date(), wantH = -((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, wantM = -(now.getMinutes() / 60) * Math.PI * 2;
        hourA = ease(hourA, wantH, 1.2); minA = ease(minA, wantM, 1.2);
      } else if (state === 'sleep') { minA = -0.4 + Math.sin(t * 9) * 0.06; hourA = -2.1; }
      else if (state === 'open') {
        // its face open, its hands come round to four, the hour every clock in the house stopped at: count from there
        const four = -(4 / 12) * Math.PI * 2, wrap = (a, to) => to + Math.atan2(Math.sin(a - to), Math.cos(a - to));
        hourA = ease(wrap(hourA, four), four, 6); minA = ease(wrap(minA, 0), 0, 6); race = -hourA / 0.4;
      } else { race += dt * (4 + 3 * Math.sin(t * 1.7)); minA = -race * 2.2 + Math.sin(t * 11) * 0.3; hourA = -race * 0.4; }
      minute.rotation.z = minA; hour.rotation.z = hourA;
      lid.rotation.x = -M.open * 1.6;
      // the arms: raised for the hammer, one up for the cog, both down asleep; the hammer comes down at the strike
      let up = 0.15 + Math.sin(t * 2) * 0.08, one = 0;
      if (id === 'hammer') up = struck ? -0.4 : 0.15 + 2.4 * k;
      if (id === 'cog') one = struck ? -0.2 : 2.0 * k;
      if (state === 'sleep' || state === 'resolved') up = -0.25;
      // (the hammers are its loose parts: they swing on a spring as it walks and lag the drum's lean)
      const walk = Math.sin((kit.rig.walked / Math.max(0.5, kit.length * 0.75)) * Math.PI) * Math.min(1, speed * 0.5);
      const lag0 = armLag[0].update(dt, walk * 0.14 + o.pitch * 1.5), lag1 = armLag[1].update(dt, -walk * 0.14 + o.pitch * 1.5);
      M.armL = ease(M.armL ?? 0, -up - one, struck ? 18 : 6);
      M.armR = ease(M.armR ?? 0, -up, struck ? 18 : 6);
      arms[0].rotation.x = M.armL + lag0;
      arms[1].rotation.x = M.armR + lag1;
      lampM.uniforms.uGlow.value = state === 'resolved' ? 0.25 : 0.08 + 0.9 * M.open * (0.75 + 0.25 * Math.sin(t * 10));
      if (state !== 'open') for (const r of steps) r.visible = false;
      const off = state === 'sleep' || state === 'resolved';
      eyeM.uniforms.uGlow.value = off ? (state === 'resolved' ? 0 : 0.12) : id === 'chime' ? 0.6 + 0.4 * Math.sin(t * 30) : 0.85;
      eyeM.uniforms.uColor.value.set(state === 'resolved' ? '#f6c84e' : '#e0644a');
      glassM.uniforms.uGlow.value = 0.15 + 0.2 * (1 - meter);
      kit.write();
      group.updateMatrixWorld(true);
      mouth.copy(body.localToWorld(_w.set(0, 0.1, 2.9)));
    },
  };
  return M;
}

/**
 * Viridel's Gardener (organic: you calm it): the moss giant the white builders left to keep their
 * Greenhouse, gone wild and bare since the night the light passed, when every flower on it closed and
 * fell. A great hunched mound of moss on four root legs, two long arms ending in root-claws, a face of the
 * builders' white stone. Brown bare patches on its back where nothing grows; as it calms, flowers come up
 * over them. It sweeps, stamps, and sends roots up under you; spent, it kneels, its bare back to the sky:
 * a bloom glob there calms it. Calm, it lies down: lay a hand on its brow.
 */
export function gardenerModel({ moss = '#5f9a52', moss2 = '#4f8a5a', moss3 = '#7fb86a', bark = '#8a5a3c', bare = '#9a7448', stone = '#f7f4ec', glow = '#7fcfa8' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const eyeM = makeMaterial({ color: glow, glow: 0.4, flat: true, key: `gardener.eye.${uid++}` });
  const bareM = makeMaterial({ color: bare, flat: true, key: `gardener.bare.${uid++}` });
  const bloomM = vc();
  const body = new THREE.Group();
  body.position.y = 3.4;
  group.add(body);
  // the mound: moss in three greens, lumpy
  const lumps = [ell([4.2, 3.0, 3.8], moss, [0, 0, 0], null, [14, 10])];
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 2.6 + (i % 3) * 0.4; lumps.push(ell([1.4, 1.0, 1.3], i % 2 ? moss2 : moss3, [Math.sin(a) * r, 0.6 + Math.cos(i * 1.7) * 1.4, Math.cos(a) * r * 0.9], null, [8, 6])); }
  body.add(new THREE.Mesh(merge(...lumps), mat));
  // the bare patches on its back (they shrink as it calms) and the flowers that come up there
  const bareMesh = new THREE.Mesh(merge(ell([1.6, 0.5, 1.4], '#ffffff', [-1.2, 2.6, -0.6]), ell([1.3, 0.45, 1.2], '#ffffff', [1.5, 2.4, 0.4]), ell([1.1, 0.4, 1.0], '#ffffff', [0.2, 2.8, 1.4])), bareM);
  body.add(bareMesh);
  const flowers = [];
  const COLS = ['#f2a7b8', '#f6d36a', '#ffffff', '#b7a0cf', '#ef7e62'];
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996, r = Math.sqrt(i / 46) * 3.4, x = Math.sin(a) * r, z = Math.cos(a) * r * 0.9;
    const y = 3.0 * Math.sqrt(Math.max(0, 1 - (x * x) / 17.6 - (z * z) / 14.4)) + 0.05;
    flowers.push(ell([0.32, 0.12, 0.32], COLS[i % COLS.length], [x, y, z], null, [6, 3]), ell([0.1, 0.1, 0.1], '#f6d36a', [x, y + 0.08, z], null, [4, 3]));
  }
  const bloom = new THREE.Mesh(merge(...flowers), bloomM);
  bloom.scale.setScalar(0.001);
  body.add(bloom);
  // the face: a mask of white stone, two eye holes that glow
  const head = new THREE.Group();
  head.position.set(0, 1.4, 3.7);
  body.add(head);
  head.add(new THREE.Mesh(merge(ell([1.25, 1.45, 0.7], stone, [0, 0, 0], null, [12, 8]), box([0.3, 0.9, 0.3], moss2, [0, 1.5, -0.3]), ell([1.5, 0.5, 1.0], moss, [0, 1.25, -0.4])), mat));
  head.add(new THREE.Mesh(merge(ell([0.24, 0.32, 0.1], '#ffffff', [-0.45, 0.25, 0.64]), ell([0.24, 0.32, 0.1], '#ffffff', [0.45, 0.25, 0.64])), eyeM));
  // two long arms, root-claws at their ends
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * 3.6, 1.0, 1.6); body.add(sh);
    sh.add(new THREE.Mesh(merge(
      tube([[0, 0, 0], [s * 1.0, -1.4, 0.9], [s * 1.2, -2.8, 1.8]], 0.7, moss2, 10, 6),
      ...[-0.5, 0, 0.5].map((d) => cone(0.22, 1.4, bark, [s * 1.2 + d * 0.7, -3.6, 2.2], [0.4, 0, d])),
    ), mat));
    return sh;
  });
  // four root legs on the kit (plan 8 on four: diagonal pairs, the front knees forward and the hind hocks back), planted
  const tellRig = tellFrame(group);
  const legM = flatMats('gardener', { joint: bark, thigh: bark, shin: bark, foot: bark });
  const kit = new GuardianLegs({ plan: { ...GUARDIAN_PLANS.gardener, knee: { ...GUARDIAN_PLANS.gardener.knee, lenA: 0.72, lenB: 0.72 } }, group, body, legs: [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return { hip: { x: Math.sin(a) * 2.6, y: -1.6, z: Math.cos(a) * 2.3 }, foot: { x: Math.sin(a) * 3.3, z: Math.cos(a) * 3.0 }, radius: 0.5, taper: 0.8, mats: legM };
  }) });
  const legs = kit.legs;
  noCollide(group);
  const mouth = V(), _w = V();
  const headLag = new TurnLag(1.1, 0.5);
  const armSwing = [new SecondOrder(1.6, 0.35, 0), new SecondOrder(1.6, 0.35, 0)];
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 1.6, radius: 4.4, height: 7, bodyR: 3.8, touchR: 1.4, tellRig, kit,
    body, head, arms, legs, bloom, bareMesh, eyeM, kneel: 0, rear: 0, gait: 0, marks: { c: [0, 3.4, 0], r: [4.0, 2.9, 3.7] },
    part(name, out, side = 1) {
      if (name === 'arms') return out.copy(arms[side > 0 ? 1 : 0].localToWorld(_w.set(side * 1.2, -3.6, 2.2)));
      return null;
    },
    animate(dt, t, opts) {
      const { state, attack, k = 0, speed = 0, meter = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1;
      const calm = state === 'resolved' ? 1 : meter;
      M.kneel = ease(M.kneel, state === 'open' ? 1 : state === 'weary' || state === 'resolved' ? 1.4 : state === 'sleep' ? 0.8 : 0, 3);
      M.rear = ease(M.rear, id === 'stamp' ? (struck ? -0.4 : k) : 0, struck ? 14 : 4);
      // the kit: the stamp lifts its forelegs off the floor (it rears on the hind pair); the body rides on the feet
      for (const L of legs) { const front = L.home.z > 0; L.lift = front ? Math.max(0, M.rear) : 0; L.air.set(0, Math.max(0, M.rear) * 1.2, Math.max(0, M.rear) * 0.8); }
      const o = kit.update(M, dt, opts);
      body.position.set(o.x, 3.4 - M.kneel * 1.3 + M.rear * 1.6 + o.y, o.z);
      body.rotation.set(-M.rear * 0.35 + M.kneel * 0.18 + o.pitch, o.yaw, o.roll);
      // (its stone face steadied against the body's tilt, lagging a turn)
      head.rotation.x = M.kneel * 0.45 + Math.sin(t * 0.9) * 0.04 - o.pitch * 0.6;
      head.rotation.y = -headLag.update(dt, M.heading) * 0.8;
      // the long arms swing from the shoulders against the legs by the distance walked, loose on springs
      const walk = Math.sin((kit.rig.walked / Math.max(0.5, kit.length * 0.9)) * Math.PI) * Math.min(1, speed * 0.5);
      const sw0 = armSwing[0].update(dt, walk * 0.22), sw1 = armSwing[1].update(dt, -walk * 0.22);
      // the arms: one raised then swept across for the sweep; both dug in for the roots
      let lx = 0, rx = 0, rz = 0;
      let lz = 0;
      if (id === 'sweep' && (attack?.side ?? 1) > 0) { rx = struck ? -0.6 : -1.6 * k; rz = struck ? 1.2 : -0.6 * k; }
      if (id === 'sweep' && (attack?.side ?? 1) < 0) { lx = struck ? -0.6 : -1.6 * k; lz = struck ? -1.2 : 0.6 * k; }
      if (id === 'roots') { lx = rx = struck ? 0.9 : -1.2 * k; }
      if (state === 'open' || state === 'weary' || state === 'resolved') { lx = rx = 0.5; }
      M.armL = ease(M.armL ?? 0, lx + Math.sin(t * 1.3) * 0.05, struck ? 12 : 5);
      M.armR = ease(M.armR ?? 0, rx + Math.sin(t * 1.1 + 1) * 0.05, struck ? 12 : 5);
      arms[0].rotation.x = M.armL + sw0;
      arms[1].rotation.x = M.armR + sw1;
      arms[1].rotation.z = ease(arms[1].rotation.z, rz, struck ? 12 : 5);
      arms[0].rotation.z = ease(arms[0].rotation.z, lz, struck ? 12 : 5);
      // calmer: the bare patches close over, the flowers come up, its eyes go from ember to leaf
      M.bareMesh.scale.setScalar(Math.max(0.05, 1 - calm * 0.95));
      M.bloom.scale.setScalar(Math.max(0.001, calm));
      eyeM.uniforms.uColor.value.set(calm > 0.5 || state === 'sleep' ? '#7fcfa8' : '#ef7e62');
      eyeM.uniforms.uGlow.value = state === 'sleep' ? 0.12 : 0.45 + (calm < 0.5 && state !== 'resolved' ? Math.max(0, Math.sin(t * 6)) * 0.3 : 0.2);
      kit.write();
      group.updateMatrixWorld(true);
      mouth.copy(head.localToWorld(_w.set(0, 0.2, 0.4)));
    },
  };
  return M;
}

/**
 * The Signal Market's First Sign (robot: you may retune it, or stop it): the oldest broadcasting machine of
 * the makers, here before the market, under its silent tower. A mast on three legs, a great listening dish
 * on a yoke for a head, a ring of lamps round its rim, a horn at its focus. It was made to say one line;
 * since the night the sky rang it has been stuck on one word of it. It cries its word (a ring of sound),
 * beams, and throws static where you stand; after crying it lowers its dish to listen: play its word back
 * into it (the echo shell) and it moves on to the next word.
 */
export function signModel({ hull = '#88b4b5', hull2 = '#6f9a9b', dark = '#3a535b', brass = '#c99758', dish = '#f5dfab', lamp = '#fff0bd' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const lampM = makeMaterial({ color: lamp, glow: 0.2, flat: true, key: `sign.lamp.${uid++}` });
  const hornM = makeMaterial({ color: '#f0a083', glow: 0.3, flat: true, key: `sign.horn.${uid++}` });
  const body = new THREE.Group();
  body.position.y = 4.2;
  group.add(body);
  // the mast: a drum on the legs, a tall column, cable wound round it, a yoke at its top
  body.add(new THREE.Mesh(merge(
    cyl(1.9, 2.3, 1.6, hull2, [0, 0, 0], null, 12),
    cyl(2.5, 2.5, 0.4, dark, [0, -0.9, 0], null, 12),
    cyl(0.9, 1.2, 6.2, hull, [0, 3.9, 0], null, 10),
    ...Array.from({ length: 5 }, (_, i) => torus(1.05 - i * 0.03, 0.12, dark, [0, 1.6 + i * 1.1, 0], [Math.PI / 2, 0, 0], [4, 16])),
    box([3.6, 0.5, 0.6], brass, [0, 7.2, 0]),
    box([0.4, 1.8, 0.5], brass, [-1.7, 8.0, 0]), box([0.4, 1.8, 0.5], brass, [1.7, 8.0, 0]),
  ), mat));
  // the head: a great dish on the yoke, its rim of lamps, the horn at its focus
  const head = new THREE.Group();
  head.position.set(0, 8.4, 0);
  body.add(head);
  const prof = [];
  for (let i = 0; i <= 10; i++) { const r = (i / 10) * 3.2; prof.push(new THREE.Vector2(Math.max(0.01, r), (r * r) / (4 * 2.2))); }
  const dishGeo = new THREE.LatheGeometry(prof, 28).rotateX(-Math.PI / 2).translate(0, 0, -0.6);
  head.add(new THREE.Mesh(merge(finishColor(dishGeo, dish), torus(3.2, 0.14, brass, [0, 0, 0.56], null, [5, 36]), cyl(0.5, 0.7, 0.9, dark, [0, 0, -1.0], [Math.PI / 2, 0, 0], 10),
    ...[0, 1, 2].map((k) => { const a = (k / 3) * Math.PI * 2; return box([0.12, 0.12, 2.6], dark, [Math.sin(a) * 1.4, Math.cos(a) * 1.4, 0.9], [Math.cos(a) * 0.45, -Math.sin(a) * 0.45, 0]); })), mat));
  head.add(new THREE.Mesh(merge(cone(0.45, 1.1, '#ffffff', [0, 0, 2.0], [-Math.PI / 2, 0, 0], 10)), hornM));
  head.add(new THREE.Mesh(merge(...Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return ell([0.2, 0.2, 0.14], '#ffffff', [Math.sin(a) * 3.25, Math.cos(a) * 3.25, 0.62]); })), lampM));
  // three legs on the kit (the sentinel's plan): a strut to a high knee, a column down to a round foot, one at a time
  const tellRig = tellFrame(group);
  const legM = flatMats('sign', { joint: dark, thigh: hull2, shin: dark, foot: dark, piston: brass, rod: dark });
  const kit = new GuardianLegs({ plan: GUARDIAN_PLANS.sign, group, body, legs: [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3, sx = Math.sin(a), cz = Math.cos(a);
    return { hip: { x: sx * 1.8, y: -0.9, z: cz * 1.8 }, foot: { x: sx * 3.9, z: cz * 3.9 }, radius: 0.34, pad: 'disc', mats: legM,
      piston: { at: { x: sx * 1.5, y: 0.1, z: cz * 1.5 } } };
  }) });
  const legs = kit.legs;
  noCollide(group);
  const mouth = V(), _w = V();
  const mastLag = new SecondOrder(1.1, 0.35, 0), dishLag = new TurnLag(1.4, 0.45);
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 1.4, radius: 3.4, height: 12, bodyR: 2.4, tellRig, kit,
    body, head, legs, lampM, hornM, open: 0, slump: 0, gait: 0, pitch: 0.6, marks: { c: [0, 4.2, 0], r: [2.1, 0.9, 2.1] },
    animate(dt, t, opts) {
      const { state, attack, k = 0, meter = 0, phase = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1;
      M.open = ease(M.open, state === 'open' ? 1 : 0, 5);
      M.slump = ease(M.slump, state === 'sleep' ? 0.6 : 0, 1.5);
      const o = kit.update(M, dt, opts);
      body.position.set(o.x, 4.2 - M.slump * 1.2 + o.y, o.z);
      body.rotation.y = o.yaw; body.rotation.z = o.roll;
      // the dish: slumped toward the floor asleep; up and searching in the fight; drawn back, then thrust, for its cry;
      // lowered to you, listening, when it is open (in its last phase turned up instead: it listens only through its
      // cables, to the dishes on the wall, src/temples/bazaar.js); turned up to the sky once it has its whole line again
      let pitch = -0.1 + Math.sin(t * 0.7) * 0.15, yaw = Math.sin(t * 0.5) * 0.3;
      if (state === 'sleep') { pitch = 0.9; yaw = 0; }
      else if (state === 'open') { pitch = phase >= 2 ? -0.8 : 0.45; yaw = 0; }
      else if (state === 'resolved' || state === 'weary') { pitch = -1.05; yaw = 0; }
      else if (id === 'cry') { pitch = struck ? 0.1 : -0.5 * k; yaw = 0; }
      else if (id === 'beam') { pitch = 0.15; yaw = 0; }
      M.pitch = ease(M.pitch, pitch, struck ? 14 : 3);
      // (the heavy dish nods on its yoke after the mast's lean, and lags its turns)
      const nod = mastLag.update(dt, o.pitch) - o.pitch;
      M.yaw = ease(M.yaw ?? 0, yaw, 3);
      head.rotation.set(M.pitch + nod * 1.4, M.yaw - dishLag.update(dt, M.heading) * 0.6, 0);
      const flash = (id === 'cry' || id === 'beam') && !struck ? (0.4 + 0.6 * Math.max(0, Math.sin(t * (10 + 20 * k)))) * Math.min(1, 0.4 + k) : 0;
      hornM.uniforms.uColor.value.set(attack && !struck ? '#ffd0a0' : '#f0a083');
      lampM.uniforms.uGlow.value = state === 'resolved' ? 0.9 : state === 'sleep' ? 0.08 : 0.25 + flash + 0.5 * M.open;
      hornM.uniforms.uGlow.value = state === 'resolved' ? 0.6 : 0.2 + 0.8 * M.open * (0.7 + 0.3 * Math.sin(t * 8));
      body.rotation.x = meter * 0.05 * Math.sin(t * 0.9) + o.pitch;
      kit.write();
      group.updateMatrixWorld(true);
      mouth.copy(head.localToWorld(_w.set(0, 0, 2.2)));
    },
  };
  return M;
}

/** Paint a plain geometry one colour (the wildlife kit's way: a vertex colour per piece). */
function finishColor(g, color) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  const c = new THREE.Color(color), n = out.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
