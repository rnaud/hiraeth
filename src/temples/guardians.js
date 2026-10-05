import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { ell, dome, cyl, cone, box, tube, torus, merge } from '../wildlife/geo.js';
import { glyphGeometry } from '../story/sign-text.js';

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
//            mouthR, radius, height, animate(dt, t, { state, attack, k, speed, meter }) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let uid = 0;
const vc = () => makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, key: `guardian.${uid++}` });
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };
const lerp = THREE.MathUtils.lerp;

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
  // six long legs, each a thigh and a shin, stepping in two tripods
  const legs = [];
  for (const [side, z, ph] of [[-1, 2.2, 0], [1, 2.2, Math.PI], [-1, 0, Math.PI], [1, 0, 0], [-1, -2.2, 0], [1, -2.2, Math.PI]]) {
    const hip = new THREE.Group();
    hip.position.set(side * 2.3, -0.2, z);
    body.add(hip);
    hip.add(new THREE.Mesh(merge(cyl(0.32, 0.26, 2.2, skin, [0, -1.1, 0], null, 7), ell([0.4, 0.4, 0.4], skin, [0, -2.2, 0])), mat));
    const knee = new THREE.Group();
    knee.position.y = -2.2;
    hip.add(knee);
    knee.add(new THREE.Mesh(merge(cyl(0.24, 0.16, 2.0, skin, [0, -1.0, 0], null, 7), ell([0.38, 0.16, 0.5], dark, [0, -2.05, 0.1])), mat));
    legs.push({ hip, knee, side, ph });
  }
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

  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0,
    mouth, mouthR: 1.3, radius: 3.4, height: 4.4,
    head, jaw, body, neck, legs, eyes, glowM, eyeM, gait: 0, rise: 0, open: 0, rear: 0, low: 0, sink: 0,
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id;
      // how it holds itself in each state
      const asleep = state === 'sleep', weary = state === 'weary' || state === 'resolved';
      M.rise = ease(M.rise, asleep ? 0 : state === 'wake' ? 0.85 : weary ? 0.35 : 1, state === 'wake' ? 0.8 : 2);
      M.open = ease(M.open, state === 'open' ? 1 : id === 'sweep' && k > 0.6 ? 0.7 : 0, 6);
      M.rear = ease(M.rear, id === 'stamp' ? (k < 1 ? k : 0) : 0, id === 'stamp' && k >= 1 ? 20 : 4);
      M.low = ease(M.low, state === 'open' || weary || id === 'sweep' ? 1 : asleep ? 1.3 : 0, 3);
      M.sink = ease(M.sink, id === 'burrow' && k < 1 ? Math.min(1, k * 1.6) : 0, id === 'burrow' && k >= 1 ? 9 : 2.5);
      M.gait += dt * speed * 1.4;
      const breathe = Math.sin(t * (asleep || weary ? 0.9 : 1.6)) * 0.06;
      body.position.y = lerp(1.55, 3.4, M.rise) + breathe - M.sink * 4.2;
      body.rotation.x = -M.rear * 0.45;
      body.rotation.z = Math.sin(M.gait * 0.5) * 0.04 * Math.min(1, speed);
      for (const L of legs) {
        const sw = Math.sin(M.gait + L.ph) * Math.min(1, speed * 0.6);
        const front = L.hip.position.z > 1;
        L.hip.rotation.x = sw * 0.45 + (front ? -M.rear * 0.9 : 0);
        L.hip.rotation.z = L.side * lerp(1.15, 0.38, M.rise);
        L.knee.rotation.z = -L.side * lerp(1.3, 0.22, M.rise) + (front ? 0 : 0);
        L.knee.rotation.x = Math.max(0, -sw) * 0.5 + (front ? M.rear * 0.6 : 0);
      }
      // the neck: up and searching when it fights, down to the floor asleep, low and open when it pants
      const sway = Math.sin(t * 0.7) * 0.2 + (id === 'sweep' ? Math.sin(Math.min(1, k) * Math.PI * 2.2) * (k >= 1 ? 0.2 : 0.7) : 0);
      // a swan's neck: forward from the shell, then up, the head level; low, it droops to the ground ahead
      neck.forEach((g, i) => {
        g.rotation.x = lerp(NECK_UP[i], NECK_LOW[i], Math.min(1, M.low)) + (M.low > 1 ? (M.low - 1) * 0.3 : 0) + (i === 0 ? M.rear * 0.4 : 0);
        g.rotation.y = sway * (0.25 + i * 0.06);
      });
      head.rotation.x = lerp(-0.1, -0.9, Math.min(1, M.low)) + (asleep ? 0.3 : 0);
      jaw.rotation.x = M.open * 0.75 + (state === 'open' ? Math.sin(t * 7) * 0.06 : 0);
      // the glyphs on its shell: dim and flickering afraid, steady and bright as it calms
      const calm = state === 'resolved' ? 1 : meter;
      glowM.uniforms.uGlow.value = 0.12 + 0.75 * calm + (calm < 0.5 ? Math.max(0, Math.sin(t * 9)) * 0.08 : 0.08 * Math.sin(t * 1.5));
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
  // the fins: long soft sails that row the air
  const fins = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    f.position.set(s * 2.6, -0.4, 1.2);
    body.add(f);
    f.add(new THREE.Mesh(merge(ell([2.8, 0.18, 1.5], fin, [s * 2.4, 0, -0.4], [0, s * 0.3, 0])), mat));
    fins.push({ f, s });
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.2, -6.0);
  body.add(tail);
  tail.add(new THREE.Mesh(merge(ell([0.9, 0.7, 1.6], skin, [0, 0, -1.2]), ell([2.6, 0.16, 1.0], fin, [0, 0.1, -2.6])), mat));
  // the head end: small dark eyes, a long mouth that opens
  const eyes = new THREE.Mesh(merge(ell([0.2, 0.24, 0.12], '#ffffff', [-1.9, 0.5, 4.6]), ell([0.2, 0.24, 0.12], '#ffffff', [1.9, 0.5, 4.6])), eyeM);
  body.add(eyes);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.9, 3.4);
  body.add(jaw);
  jaw.add(new THREE.Mesh(merge(ell([2.0, 0.45, 2.6], belly, [0, -0.2, 1.4])), mat));
  noCollide(group);
  const mouth = V(), _w = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: true, hover: 6,
    mouth, mouthR: 1.8, radius: 4.2, height: 5.2, bodyR: 3.4,
    body, fins, tail, jaw, glowM, eyeM, open: 0, low: 0, swim: 0,
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id;
      const asleep = state === 'sleep', weary = state === 'weary', resolved = state === 'resolved';
      // how high she swims: high and wary; low when she cries; on the floor, worn out; up again, calm
      M.low = ease(M.low, asleep ? 0.4 : weary ? 1 : state === 'open' ? 0.75 : id === 'dive' ? Math.min(1, k * 1.3) * (k >= 1 ? 1 : 0.6) : resolved ? 0.1 : 0, 2.5);
      M.hover = THREE.MathUtils.lerp(7.5, 2.3, M.low) + Math.sin(t * 0.8) * 0.4;
      M.open = ease(M.open, state === 'open' ? 1 : id === 'gust' && k > 0.5 ? 0.6 : 0, 5);
      M.swim += dt * (0.8 + speed * 0.6);
      body.rotation.z = Math.sin(M.swim * 0.7) * 0.08;
      body.rotation.x = Math.sin(M.swim * 0.5) * 0.05 + (state === 'open' ? -0.15 : 0);
      for (const F of fins) F.f.rotation.z = F.s * (Math.sin(M.swim * 1.6) * 0.35 * (weary ? 0.3 : 1) - 0.1);
      tail.rotation.x = Math.sin(M.swim * 1.6 + 1) * 0.3;
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
  // the veil: soft panels hanging under it, swaying
  const veils = [];
  for (let i = 0; i < 7; i++) {
    const v = new THREE.Group();
    const a = (i / 7) * Math.PI * 2;
    v.position.set(Math.cos(a) * 1.0, -1.2, Math.sin(a) * 1.0);
    v.rotation.y = -a;
    body.add(v);
    v.add(new THREE.Mesh(merge(ell([0.5, 2.2, 0.08], veil, [0, -2.0, 0])), mat));
    veils.push(v);
  }
  noCollide(group);
  const mouth = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: true, hover: 6,
    mouth, mouthR: 2.0, radius: 3.6, height: 5, bodyR: 2.2, touchR: 3.0,
    body, rings, veils, coreM, glowM, open: 0, low: 0, spin: 0,
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const asleep = state === 'sleep', weary = state === 'weary', resolved = state === 'resolved';
      M.low = ease(M.low, weary ? 1 : state === 'open' ? 0.6 : asleep ? 0.3 : 0, 2.2);
      M.hover = THREE.MathUtils.lerp(6.5, 2.2, M.low) + Math.sin(t * 1.1) * 0.35;
      M.open = ease(M.open, state === 'open' ? 1 : 0, 4);
      M.spin += dt * (asleep || weary ? 0.2 : resolved ? 0.4 : 0.9 + (attack ? k * 2.5 : 0));
      rings.forEach((r, i) => { r.rotation.z = M.spin * (i % 2 ? -1 : 1) * (0.6 + i * 0.25); });
      veils.forEach((v, i) => { v.rotation.x = Math.sin(t * 1.3 + i) * 0.18 + speed * 0.05; });
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
  // four wings, each a broad flat oval with a glyph eye-spot, hinged at the shoulder
  const wings = [];
  for (const [s, z, len, back] of [[-1, 0.6, 4.6, 0], [1, 0.6, 4.6, 0], [-1, -0.9, 3.6, 1], [1, -0.9, 3.6, 1]]) {
    const w = new THREE.Group();
    w.position.set(s * 0.7, 0.35, z);
    body.add(w);
    w.add(new THREE.Mesh(merge(ell([len, 0.08, back ? 1.6 : 2.2], back ? wing2 : wing, [s * len * 0.95, 0, back ? -0.6 : 0.2], [0, s * (back ? -0.35 : 0.25), 0])), mat));
    w.add(new THREE.Mesh(merge(glyphGeometry(back ? 1.0 : 1.4, 0.05).rotateX(-Math.PI / 2).translate(s * len * 1.1, 0.07, back ? -0.6 : 0.2)), glowM));
    wings.push({ w, s, back });
  }
  noCollide(group);
  const mouth = V(), _w = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: true, hover: 6,
    mouth, mouthR: 1.6, radius: 3.4, height: 3.4, bodyR: 2.2, touchR: 1.6,
    body, wings, glowM, low: 0, flap: 0,
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const asleep = state === 'sleep', weary = state === 'weary', resolved = state === 'resolved';
      M.low = ease(M.low, weary ? 1 : state === 'open' ? 0.65 : asleep ? 0.8 : attack?.id === 'swoop' ? Math.min(1, k * 1.2) : 0, 2.4);
      M.hover = THREE.MathUtils.lerp(7, 1.6, M.low) + Math.sin(t * 2.2) * 0.3;
      M.flap += dt * (asleep || weary ? 1.2 : state === 'open' ? 3 : 7 + speed);
      const amp = asleep || weary ? 0.12 : state === 'open' ? 0.35 : 0.65;
      for (const W of wings) W.w.rotation.z = W.s * (Math.sin(M.flap + (W.back ? 0.5 : 0)) * amp + (weary ? -0.25 : 0.15));
      body.rotation.x = state === 'open' ? -0.25 : 0;
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
  const legs = [];
  for (const s of [-1, 1]) {
    legs.push(cyl(0.22, 0.3, 3.4, beak, [s * 1.0, 1.7, 0.4], [0, 0, s * 0.08]));
    for (const a of [-0.5, 0, 0.5]) legs.push(cyl(0.08, 0.12, 1.1, beak, [s * 1.0 + Math.sin(a) * 0.5, 0.08, 0.4 + Math.cos(a) * 0.5], [Math.PI / 2, a, 0]));
  }
  rig.add(new THREE.Mesh(merge(ell([2.3, 1.9, 3.4], stone, [0, 4.4, 0], null, [14, 9]), ell([1.7, 1.5, 1.6], feather, [0, 4.2, 2.2]), tail, legs), mat));
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
  // the wings: three long stone feathers each, hinged at the shoulder; glyph lines along them
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 1.9, 5.1, 0.9);
    rig.add(w);
    const parts = [], lines = [];
    for (let i = 0; i < 4; i++) {
      const x = s * (1.4 + i * 1.5), z = -0.35 * i;
      parts.push(ell([1.6, 0.16, 1.1 - i * 0.12], i === 3 ? tip : i % 2 ? feather : stone, [x, 0, z], [0, s * (0.15 + i * 0.12), 0]));
      lines.push(box([1.8, 0.05, 0.08], '#ffffff', [x, 0.17, z], [0, s * (0.15 + i * 0.12), 0]));
    }
    w.add(new THREE.Mesh(merge(parts), mat));
    w.add(new THREE.Mesh(merge(lines), glowM));
    return { w, s };
  });
  noCollide(group);
  const mouth = V(), _w = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, floats: false, hover: 3.5,
    mouth, mouthR: 1.4, radius: 3.0, height: 7, bodyR: 2.6, touchR: 1.0,
    rig, neck, head, wings, glowM, spread: 0, raise: 0, lift: 0, pitch: 0, beat: 0,
    animate(dt, t, { state, attack, k = 0, meter = 0, phase = 0 }) {
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
      else if (id === 'dive') { spread = 1; raise = struck ? -0.2 : 0.6; lift = struck ? -M.hover + 0.4 : 2.8 * k; pitch = struck ? 0.3 : -0.2; beat = struck ? 0 : 1; }
      M.spread = ease(M.spread, spread, 5); M.raise = ease(M.raise, raise, struck ? 14 : 5);
      M.lift = ease(M.lift, lift, struck ? 12 : 3); M.pitch = ease(M.pitch, pitch, 5); M.beat = ease(M.beat, beat, 3);
      rig.position.y = M.lift + (M.floats ? Math.sin(t * 3.2) * 0.35 : 0);
      rig.rotation.x = M.pitch;
      const flap = M.beat * Math.sin(t * 6.5) * 0.55;
      for (const { w, s } of wings) {
        // folded: swept back along the body and down; spread: out and level; raise lifts them
        w.rotation.set(0, s * (1 - M.spread) * 1.25, s * (M.raise + flap) - s * (1 - M.spread) * 0.9, 'YXZ');
      }
      neck.rotation.x = neckK * 0.7;
      head.rotation.x = -neckK * 0.5 + Math.sin(t * 0.9) * 0.05;
      const calm = state === 'resolved' ? 1 : meter;
      glowM.uniforms.uGlow.value = 0.12 + 0.8 * calm + (state === 'open' ? 0.1 * Math.max(0, Math.sin(t * 5)) : 0);
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
  for (let i = 0; i < 5; i++) { const a = -0.8 + (i / 4) * 1.6; crown.push(new THREE.OctahedronGeometry(1, 0).scale(0.28, 0.9 + (i % 2) * 0.35, 0.28).rotateZ(-a * 0.5).translate(Math.sin(a) * 1.1, 1.55, 1.2 + Math.cos(a) * 0.3).toNonIndexed()); }
  upper.add(new THREE.Mesh(merge(...crown), glowM));
  noCollide(group);
  // where the head goes (group frame), how wide the jaws, its pitch and turn: eased toward these
  const at = V(0, 3.5, 3), want = V(), ctrl = V(), root = V(0, 2.4, 0), back = V(), f = V(), _w = V();
  const mouth = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, rooted: true, reach,
    mouth, mouthR: 1.9, radius: 3.6, height: 6, bodyR: 2.8, touchR: 1.6,
    H, upper, lower, beads, glowM, gape: 0, pitch: 0.6, turn: 0, head: at,
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
      } else if (id === 'sweep') {
        if (!struck) { want.set(-5.5, 3.2, 3.5); gape = 0.6 * k; pitch = 0.2; turn = -0.9; rate = 4; }
        else { want.set(5.5, 2.6, 3.5); gape = 0.1; pitch = 0.2; turn = 0.9; rate = 9; }
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
      for (let i = 0; i < beads.length; i++) {
        const u = (i + 0.6) / beads.length, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
        beads[i].position.set(root.x * a + ctrl.x * b + back.x * c, root.y * a + ctrl.y * b + back.y * c, root.z * a + ctrl.z * b + back.z * c);
      }
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
  head.add(new THREE.Mesh(merge(cyl(0.9, 1.1, 0.9, hull2, [0, 0, 0], null, 12)), mat));
  head.add(new THREE.Mesh(merge(ell([0.45, 0.45, 0.25], '#ffffff', [0, 0, 1.0])), eyeM));
  const legs = [];
  for (let i = 0; i < nL; i++) {
    const a = (i / nL) * Math.PI * 2 + Math.PI / nL;
    const hip = new THREE.Group();
    hip.position.set(Math.sin(a) * 1.9, -1.7, Math.cos(a) * 1.9);
    hip.rotation.y = a;
    body.add(hip);
    hip.add(new THREE.Mesh(merge(box([0.5, 0.5, 3.2], hull2, [0, 0, 1.4], [-0.9, 0, 0]), cyl(0.35, 0.25, 3.4, dark, [0, -1.6, 2.6], null, 8), cyl(0.7, 0.8, 0.3, dark, [0, -3.3, 2.6], null, 10)), mat));
    legs.push(hip);
  }
  noCollide(group);
  const mouth = V(), _w = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 1.5, radius: 3.0, height: 9,
    head, body, vents, shutters, legs, eyeM, ventM, open: 0, slump: 0, gait: 0,
    /** Where vent i is, in the world (a target each, for a guardian that wants them all hit at once). */
    vent(i, out = V()) { const a = (i / nV) * Math.PI * 2; return body.localToWorld(out.set(Math.sin(a) * 2.5, 0.4, Math.cos(a) * 2.5)); },
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0, phase = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const off = state === 'sleep' || state === 'resolved' || state === 'weary';
      M.guard = ease(M.guard ?? 0, guarded && phase >= 1 && state !== 'resolved' ? 1 : 0, 3);   // the second phase: its sides shut, its top vent open
      M.open = ease(M.open, state === 'open' ? 1 : 0, 5);
      M.slump = ease(M.slump, state === 'resolved' ? 1 : state === 'sleep' ? 0.6 : 0, 1.5);
      M.gait += dt * speed * 2;
      body.position.y = 5 - M.slump * 2.2 + Math.sin(M.gait) * 0.08;
      body.rotation.z = M.slump * 0.25;
      head.rotation.y = attack ? 0 : Math.sin(t * 0.8) * 0.5;
      head.rotation.x = M.slump * 0.6;
      const sideOpen = M.open * (1 - M.guard);
      shutters.forEach((s) => { s.position.y = 0.4 + sideOpen * 1.15; s.rotation.x = -sideOpen * 0.4; });
      topVent.scale.setScalar(0.3 + 0.7 * M.guard);
      topVent.material.uniforms.uGlow.value = 0.15 + 0.85 * M.open * M.guard * (0.7 + 0.3 * Math.sin(t * 12));
      // the damage shows: it leans, and its hull dulls toward soot
      body.rotation.x = meter * 0.12 * Math.sin(t * 0.7);
      legs.forEach((L, i) => { L.rotation.x = Math.sin(M.gait + i * 2.1) * 0.15 * Math.min(1, speed) + M.slump * 0.3; });
      const blink = attack && attack.shape === 'lane' ? 0.6 + 0.4 * Math.sin(t * 30) : 0.9;
      eyeM.uniforms.uGlow.value = off ? (state === 'resolved' ? 0 : 0.15) : blink;
      eyeM.uniforms.uColor.value.set(attack ? '#e0644a' : '#f6c84e');
      ventM.uniforms.uGlow.value = 0.2 + 0.8 * sideOpen * (0.7 + 0.3 * Math.sin(t * 12));
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
  // four short legs
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const hip = new THREE.Group(); hip.position.set(Math.sin(a) * 1.9, -1.9, Math.cos(a) * 1.9); hip.rotation.y = a; body.add(hip);
    hip.add(new THREE.Mesh(merge(box([0.55, 0.55, 1.6], brass2, [0, -0.3, 0.6], [-0.6, 0, 0]), cyl(0.32, 0.26, 1.9, dark, [0, -1.4, 1.1], null, 8), cyl(0.75, 0.85, 0.3, dark, [0, -2.4, 1.1], null, 10)), mat));
    legs.push(hip);
  }
  noCollide(group);
  const mouth = V(), _w = V();
  let race = 0, hourA = 0, minA = 0;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 0.01, radius: 3.0, height: 8.5, bodyR: 2.4,
    body, hands, hour, minute, lid, arms, legs, lampM, eyeM, open: 0, slump: 0, gait: 0, numbers: NUM,
    /** Where numeral lamp i is, in the world. */
    vent(i, out = V()) { const p = numAt(i); return body.localToWorld(out.set(p.x, p.y, p.z + 0.1)); },
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1;
      M.open = ease(M.open, state === 'open' ? 1 : 0, 6);
      M.slump = ease(M.slump, state === 'resolved' ? 1 : state === 'sleep' ? 0.5 : 0, 1.5);
      M.gait += dt * speed * 2.4;
      body.position.y = 4.4 - M.slump * 1.6 + Math.abs(Math.sin(M.gait)) * 0.12;
      body.rotation.z = Math.sin(M.gait) * 0.05;
      // the hands: wound wrong they race and stutter; asleep they twitch; set right they come round to the true time and stop
      if (state === 'resolved') {
        const now = new Date(), wantH = -((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, wantM = -(now.getMinutes() / 60) * Math.PI * 2;
        hourA = ease(hourA, wantH, 1.2); minA = ease(minA, wantM, 1.2);
      } else if (state === 'sleep') { minA = -0.4 + Math.sin(t * 9) * 0.06; hourA = -2.1; }
      else { race += dt * (state === 'open' ? 0.3 : 4 + 3 * Math.sin(t * 1.7)); minA = -race * 2.2 + Math.sin(t * 11) * 0.3; hourA = -race * 0.4; }
      minute.rotation.z = minA; hour.rotation.z = hourA;
      lid.rotation.x = -M.open * 1.6;
      // the arms: raised for the hammer, one up for the cog, both down asleep; the hammer comes down at the strike
      let up = 0.15 + Math.sin(t * 2) * 0.08, one = 0;
      if (id === 'hammer') up = struck ? -0.4 : 0.15 + 2.4 * k;
      if (id === 'cog') one = struck ? -0.2 : 2.0 * k;
      if (state === 'sleep' || state === 'resolved') up = -0.25;
      arms[0].rotation.x = ease(arms[0].rotation.x, -up - one, struck ? 18 : 6);
      arms[1].rotation.x = ease(arms[1].rotation.x, -up, struck ? 18 : 6);
      legs.forEach((L, i) => { L.rotation.x = Math.sin(M.gait + i * 1.6) * 0.18 * Math.min(1, speed) + M.slump * 0.25; });
      lampM.uniforms.uGlow.value = state === 'resolved' ? 0.25 : 0.08 + 0.9 * M.open * (0.75 + 0.25 * Math.sin(t * 10));
      const off = state === 'sleep' || state === 'resolved';
      eyeM.uniforms.uGlow.value = off ? (state === 'resolved' ? 0 : 0.12) : id === 'chime' ? 0.6 + 0.4 * Math.sin(t * 30) : 0.85;
      eyeM.uniforms.uColor.value.set(state === 'resolved' ? '#f6c84e' : '#e0644a');
      glassM.uniforms.uGlow.value = 0.15 + 0.2 * (1 - meter);
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
  // four root legs
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const hip = new THREE.Group(); hip.position.set(Math.sin(a) * 2.6, -1.6, Math.cos(a) * 2.3); body.add(hip);
    hip.add(new THREE.Mesh(merge(cyl(0.7, 0.9, 2.0, bark, [0, -0.8, 0], null, 8), ell([1.0, 0.35, 1.2], bark, [0, -1.8, 0.2])), mat));
    legs.push(hip);
  }
  noCollide(group);
  const mouth = V(), _w = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 1.6, radius: 4.4, height: 7, bodyR: 3.8, touchR: 1.4,
    body, head, arms, legs, bloom, bareMesh, eyeM, kneel: 0, rear: 0, gait: 0,
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1;
      const calm = state === 'resolved' ? 1 : meter;
      M.kneel = ease(M.kneel, state === 'open' ? 1 : state === 'weary' || state === 'resolved' ? 1.4 : state === 'sleep' ? 0.8 : 0, 3);
      M.rear = ease(M.rear, id === 'stamp' ? (struck ? -0.4 : k) : 0, struck ? 14 : 4);
      M.gait += dt * speed * 1.8;
      body.position.y = 3.4 - M.kneel * 1.3 + M.rear * 1.6 + Math.abs(Math.sin(M.gait)) * 0.15;
      body.rotation.x = -M.rear * 0.35 + M.kneel * 0.18;
      body.rotation.z = Math.sin(M.gait) * 0.04;
      head.rotation.x = M.kneel * 0.45 + Math.sin(t * 0.9) * 0.04;
      // the arms: one raised then swept across for the sweep; both dug in for the roots
      let lx = 0, rx = 0, rz = 0;
      if (id === 'sweep') { rx = struck ? -0.6 : -1.6 * k; rz = struck ? 1.2 : -0.6 * k; }
      if (id === 'roots') { lx = rx = struck ? 0.9 : -1.2 * k; }
      if (state === 'open' || state === 'weary' || state === 'resolved') { lx = rx = 0.5; }
      arms[0].rotation.x = ease(arms[0].rotation.x, lx + Math.sin(t * 1.3) * 0.05, struck ? 12 : 5);
      arms[1].rotation.x = ease(arms[1].rotation.x, rx + Math.sin(t * 1.1 + 1) * 0.05, struck ? 12 : 5);
      arms[1].rotation.z = ease(arms[1].rotation.z, rz, struck ? 12 : 5);
      legs.forEach((L, i) => { L.rotation.x = Math.sin(M.gait + i * 1.6) * 0.2 * Math.min(1, speed); });
      // calmer: the bare patches close over, the flowers come up, its eyes go from ember to leaf
      M.bareMesh.scale.setScalar(Math.max(0.05, 1 - calm * 0.95));
      M.bloom.scale.setScalar(Math.max(0.001, calm));
      eyeM.uniforms.uColor.value.set(calm > 0.5 || state === 'sleep' ? '#7fcfa8' : '#ef7e62');
      eyeM.uniforms.uGlow.value = state === 'sleep' ? 0.12 : 0.45 + (calm < 0.5 && state !== 'resolved' ? Math.max(0, Math.sin(t * 6)) * 0.3 : 0.2);
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
  // three legs
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    const hip = new THREE.Group(); hip.position.set(Math.sin(a) * 1.8, -0.9, Math.cos(a) * 1.8); hip.rotation.y = a; body.add(hip);
    hip.add(new THREE.Mesh(merge(box([0.5, 0.5, 2.6], hull2, [0, 0, 1.1], [-0.7, 0, 0]), cyl(0.32, 0.24, 3.0, dark, [0, -1.6, 2.1], null, 8), cyl(0.8, 0.9, 0.3, dark, [0, -3.2, 2.1], null, 10)), mat));
    legs.push(hip);
  }
  noCollide(group);
  const mouth = V(), _w = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 1.4, radius: 3.4, height: 12, bodyR: 2.4,
    body, head, legs, lampM, hornM, open: 0, slump: 0, gait: 0, pitch: 0.6,
    animate(dt, t, { state, attack, k = 0, speed = 0, meter = 0 }) {
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1;
      M.open = ease(M.open, state === 'open' ? 1 : 0, 5);
      M.slump = ease(M.slump, state === 'sleep' ? 0.6 : 0, 1.5);
      M.gait += dt * speed * 2;
      body.position.y = 4.2 - M.slump * 1.2 + Math.sin(M.gait) * 0.08;
      // the dish: slumped toward the floor asleep; up and searching in the fight; drawn back, then thrust, for its cry;
      // lowered to you, listening, when it is open; turned up to the sky once it has its whole line again
      let pitch = -0.1 + Math.sin(t * 0.7) * 0.15, yaw = Math.sin(t * 0.5) * 0.3;
      if (state === 'sleep') { pitch = 0.9; yaw = 0; }
      else if (state === 'open') { pitch = 0.45; yaw = 0; }
      else if (state === 'resolved' || state === 'weary') { pitch = -1.05; yaw = 0; }
      else if (id === 'cry') { pitch = struck ? 0.1 : -0.5 * k; yaw = 0; }
      else if (id === 'beam') { pitch = 0.15; yaw = 0; }
      M.pitch = ease(M.pitch, pitch, struck ? 14 : 3);
      head.rotation.set(M.pitch, ease(head.rotation.y, yaw, 3), 0);
      legs.forEach((L, i) => { L.rotation.x = Math.sin(M.gait + i * 2.1) * 0.15 * Math.min(1, speed) + M.slump * 0.3; });
      const flash = id === 'cry' && !struck ? 0.4 + 0.6 * Math.max(0, Math.sin(t * 18)) : 0;
      lampM.uniforms.uGlow.value = state === 'resolved' ? 0.9 : state === 'sleep' ? 0.08 : 0.25 + flash + 0.5 * M.open;
      hornM.uniforms.uGlow.value = state === 'resolved' ? 0.6 : 0.2 + 0.8 * M.open * (0.7 + 0.3 * Math.sin(t * 8));
      body.rotation.x = meter * 0.05 * Math.sin(t * 0.9);
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
