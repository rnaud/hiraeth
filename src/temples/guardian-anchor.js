import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { ell, dome, cyl, box, torus, merge } from '../wildlife/geo.js';
import { quantise } from '../motion-kit/spring.js';
import { tellFrame } from './guardian-motion.js';

// The City Floating in Space's Anchor-Warden (src/temples/spacecity.js), the makers' machine in the Mooring-House:
// a great capstan that walks on nothing, gliding on its iron skirt over the Capstan Floor. A drum of brass wound with
// the moorers' cable, a teal crown with one starlight eye, four capstan bars through its head (the moorers pushed
// them round to haul the islands home) and an anchor hanging from two of them. The night the singing light passed,
// the note ran down its cables and it began letting them out, a hand's width a night. A robot: its meter is damage,
// and its end is a break (it locks).
//
// The model (the interface of src/temples/guardians.js): { group, pos, heading, home, rest, restHeading, mouth (its eye),
// mouthR, radius, height, bodyR, tellRig, marks, part(name, out, side), animate(dt, t, opts) } and, for its temple:
//   bar(i, out)       the end of capstan bar i in the world (the pushes find them)
//   drumAt(out)       where its cable comes off the drum (a thrown anchor's cable runs from here)
//   hang(i, on)       anchor i (0, 1) hanging from its bar, or not (thrown)
//   jam(k)            0..1: an anchor pulled home jams the drum (it shudders, its pawl lamp flares)
// anchorGeometry(): one anchor (a ring, a shank, a stock and two flukes), vertex-coloured, for a thrown one.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let uid = 0;
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };

/** One anchor, its ring at the origin and its crown 2.6 m below, vertex-coloured (merge with the wildlife kit's pieces). */
export function anchorGeometry({ iron = '#3d3f4c', brass = '#d2a648', s = 1 } = {}) {
  const g = merge(
    torus(0.28 * s, 0.07 * s, brass, [0, 0, 0], [0, Math.PI / 2, 0], [4, 12]),
    box([0.22 * s, 2.3 * s, 0.22 * s], iron, [0, -1.4 * s, 0]),
    box([1.3 * s, 0.16 * s, 0.16 * s], iron, [0, -0.55 * s, 0]),
    // the crown and its two arms, bent up to the flukes
    box([1.9 * s, 0.24 * s, 0.24 * s], iron, [0, -2.55 * s, 0]),
    box([0.24 * s, 0.8 * s, 0.24 * s], iron, [0.95 * s, -2.2 * s, 0], [0, 0, -0.35]),
    box([0.24 * s, 0.8 * s, 0.24 * s], iron, [-0.95 * s, -2.2 * s, 0], [0, 0, 0.35]),
    ell([0.32 * s, 0.22 * s, 0.1 * s], iron, [1.15 * s, -1.75 * s, 0], [0, 0, -0.35], [6, 4]),
    ell([0.32 * s, 0.22 * s, 0.1 * s], iron, [-1.15 * s, -1.75 * s, 0], [0, 0, 0.35], [6, 4]),
  );
  return g;
}

/**
 * The Anchor-Warden (robot: damage; final 'break'). No legs: it glides on its skirt (the fight moves `pos`), its bars
 * turning slowly the while, faster as it winds up a spin.
 */
export function anchorModel({ brass = '#d2a648', brass2 = '#b08433', iron = '#3d3f4c', teal = '#4f9a98', cream = '#efe7da', cable = '#6a5844', eye = '#7fe3ec' } = {}) {
  const group = new THREE.Group();
  const mat = makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, key: `anchor.${uid++}` });
  const eyeM = makeMaterial({ color: eye, glow: 0.8, flat: true, key: `anchor.eye.${uid++}` });
  const pawlM = makeMaterial({ color: '#ffd27a', glow: 0.1, flat: true, key: `anchor.pawl.${uid++}` });
  const body = new THREE.Group();
  group.add(body);
  // the skirt it glides on, the drum wound with cable, the head ring the bars go through, the crown
  body.add(new THREE.Mesh(merge(
    cyl(3.0, 3.3, 1.0, iron, [0, 0.5, 0], null, 16),
    cyl(2.7, 2.95, 0.4, brass2, [0, 1.2, 0], null, 16),
    cyl(2.1, 2.1, 3.6, brass, [0, 3.2, 0], null, 16),
    ...Array.from({ length: 6 }, (_, i) => torus(2.16, 0.13, cable, [0, 1.8 + i * 0.5, 0], [Math.PI / 2, 0, 0], [4, 22])),
    cyl(2.55, 2.3, 0.6, iron, [0, 5.25, 0], null, 16),
    dome([2.05, 1.3, 2.05], teal, [0, 5.55, 0], null, [14, 5]),
    cyl(0.28, 0.28, 1.3, iron, [0, 7.3, 0], null, 8),
    cyl(0.75, 0.45, 0.45, brass, [0, 8.0, 0], null, 10),
    // the pawl's housing on its front, and the starlight eye's hood over it
    box([1.0, 0.9, 0.5], iron, [0, 1.9, 2.25]),
    box([1.1, 0.25, 0.5], cream, [0, 4.95, 2.1]),
  ), mat));
  const eyeMesh = new THREE.Mesh(merge(ell([0.5, 0.32, 0.22], '#ffffff', [0, 4.55, 2.16])), eyeM);
  body.add(eyeMesh);
  const pawl = new THREE.Mesh(merge(ell([0.3, 0.3, 0.14], '#ffffff', [0, 1.9, 2.52])), pawlM);
  body.add(pawl);
  // the capstan bars: four through the head, a brass cap on each; anchors hang from bars 0 and 2
  const bars = new THREE.Group();
  bars.position.y = 5.25;
  body.add(bars);
  const BAR = 5.4;
  bars.add(new THREE.Mesh(merge(...[0, 1, 2, 3].flatMap((i) => {
    const a = (i / 4) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    return [box([0.34, 0.34, BAR - 2.2], brass2, [sx * (BAR + 2.2) / 2, 0, cz * (BAR + 2.2) / 2], [0, a, 0]), cyl(0.3, 0.3, 0.5, brass, [sx * BAR, 0, cz * BAR], [Math.PI / 2, a, 0], 8)];
  })), mat));
  const hanging = [0, 2].map((i) => {
    const a = (i / 4) * Math.PI * 2, g = new THREE.Group();
    g.position.set(Math.sin(a) * (BAR - 0.3), -0.2, Math.cos(a) * (BAR - 0.3));
    g.add(new THREE.Mesh(merge(cyl(0.05, 0.05, 0.9, cable, [0, -0.45, 0], null, 4)), mat));
    const an = new THREE.Mesh(anchorGeometry({ iron, brass, s: 0.55 }), mat);
    an.position.y = -0.9;
    g.add(an);
    bars.add(g);
    return g;
  });
  const tellRig = tellFrame(group);
  noCollide(group);
  const mouth = V(), _w = V();
  let turn = 0, jamK = 0;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 1.0, radius: 3.3, height: 8.4, bodyR: 2.6, tellRig,
    body, bars, hanging, eyeM, pawlM, open: 0, slump: 0, marks: { c: [0, 3.4, 0], r: [2.3, 2.0, 2.3] },
    part(name, out, side = 1) {
      if (name === 'arms') return M.bar(side > 0 ? 1 : 3, out);
      if (name === 'head' || name === 'eye') return out.copy(mouth);
      if (name === 'feet') return out.copy(body.localToWorld(_w.set(side * 2.2, 0.3, 1.6)));
      return null;
    },
    /** The end of capstan bar i (0..3), in the world. */
    bar(i, out = V()) { const a = (i / 4) * Math.PI * 2; return out.copy(bars.localToWorld(_w.set(Math.sin(a) * BAR, 0, Math.cos(a) * BAR))); },
    /** Where its cable comes off the drum (the front, waist high). */
    drumAt(out = V()) { return out.copy(body.localToWorld(_w.set(0, 2.6, 2.2))); },
    /** Anchor i hanging from its bar, or thrown. */
    hang(i, on) { if (hanging[i]) hanging[i].visible = !!on; },
    /** An anchor pulled home: the drum jams (k 1, easing off). */
    jam(k = 1) { jamK = Math.max(jamK, k); },
    animate(dt, t, opts) {
      const { state, attack, k = 0, meter = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      M.open = ease(M.open, state === 'open' ? 1 : 0, 5);
      M.slump = ease(M.slump, state === 'resolved' ? 1 : state === 'sleep' ? 0.4 : 0, 1.4);
      jamK = Math.max(0, jamK - dt * 0.7);
      // the bars turn: slowly as it glides, stalled when it is open (its cable slack), not at all once it has locked
      const rate = state === 'resolved' || state === 'sleep' ? 0 : state === 'open' ? 0.05 : attack?.rig === 'coil' ? (k < 1 ? -0.6 * k : 4) : 0.35;
      turn += rate * dt;
      bars.rotation.y = quantise(turn, 0.04) + Math.sin(t * 40) * 0.03 * jamK;
      // asleep and locked it leans on its skirt; a jam shudders it
      body.rotation.z = M.slump * 0.12 + Math.sin(t * 31) * 0.04 * jamK;
      body.rotation.x = meter * 0.08 * Math.sin(t * 0.6);
      body.position.y = -M.slump * 0.4;
      // the anchors swing a little as it glides and winds up
      for (const [n, h] of hanging.entries()) h.rotation.x = Math.sin(t * 1.3 + n * 2) * 0.12 + (attack && k < 1 ? -0.6 * k : 0);
      const off = state === 'sleep' || state === 'resolved';
      eyeM.uniforms.uGlow.value = off ? (state === 'resolved' ? 0.25 : 0.1) : attack ? 0.6 + 0.4 * Math.sin(t * (10 + 25 * Math.min(1, k))) : 0.85;
      eyeM.uniforms.uColor.value.set(state === 'resolved' ? '#7fe3ec' : attack ? '#ffb07a' : '#7fe3ec');
      pawlM.uniforms.uGlow.value = 0.08 + 0.85 * Math.max(M.open * (0.75 + 0.25 * Math.sin(t * 9)), jamK);
      group.updateMatrixWorld(true);
      mouth.copy(eyeMesh.localToWorld(_w.set(0, 4.55, 2.3)));
    },
  };
  return M;
}
