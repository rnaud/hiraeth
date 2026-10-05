import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { ell, dome, cyl, cone, box, tube, merge } from '../wildlife/geo.js';
import { glyphGeometry } from '../story/sign-text.js';

// The bodies of what waits in the temples, built from the wildlife's little
// modelling kit (flat printed colours per piece, merged per moving part), and
// posed by hand: no skeleton, a few groups that sway, rear, open their mouths.
//
//   keeperModel()    the desert's Cistern-Keeper: a great pale beast of the Givers, a shell of bone
//                    plates on six long legs, a heron's neck and a long soft muzzle. It kept the
//                    cistern; the water stopped, the dark came, and it is afraid.
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
