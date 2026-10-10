import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { ell, dome, cyl, torus, merge } from '../wildlife/geo.js';
import { tellFrame } from './guardian-motion.js';

// The Underwater City's guardian (src/temples/underwater.js): the Listener, the makers' old shell-creature at the
// bottom of the Whale-House, built to hear the whales from far off and answer them. A soft coral body under a great
// whorled shell of ivory banded in coral; out of its front a vast ear like a conch's mouth, four lips round its rim
// that open wide when it listens and fold shut when it won't; two long fins it sweeps with; a row of small teal eyes
// round the ear's rim. Since the night the singing light passed it answers only the light's note. Built as the other
// guardians are (src/temples/guardians.js): flat printed colours merged per moving part, a few groups the fight poses
// (the lips, the fins, the shell), the body in its own `tellRig` for the generic wind-ups.
//
// A model: { group, pos, heading, home, rest, restHeading, mouth (the ear's mouth), mouthR, radius, height, bodyR,
//            touchR, tellRig, marks, part(name, out, side), ear(out) (the ear, in the world), animate() }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let uid = 0;
const vc = () => makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, key: `listener.${uid++}` });
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };
/** A lathe (profile [[r, y]...] round y) printed one colour, for merging. */
function lathed(pts, color, seg = 18) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.01), y)), seg).toNonIndexed();
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** The Listener (organic: its meter is calm; a hand on its shell, final 'touch'). */
export function listenerModel({ ivory = '#efe2c8', coral = '#e0806a', flesh = '#f0b8a0', deep = '#2f5f6a', teal = '#5fc4bd', brass = '#c9973f' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const eyeM = makeMaterial({ color: teal, glow: 0.6, flat: true, key: `listener.eye.${uid++}` });
  const earM = makeMaterial({ color: '#6f8fd8', glow: 0.25, flat: true, key: `listener.ear.${uid++}` });
  // the foot: a soft skirt on the floor, rippled at its edge
  const base = new THREE.Group(); group.add(base);
  base.add(new THREE.Mesh(merge(
    dome([3.2, 1.1, 3.6], flesh, [0, 0, 0], null, [16, 4]),
    torus(3.3, 0.28, coral, [0, 0.12, 0], [Math.PI / 2, 0, 0], [4, 20]),
  ), mat));
  // the body: a soft upright mantle, coral, rising out of the foot
  const body = new THREE.Group(); body.position.y = 0.9; group.add(body);
  body.add(new THREE.Mesh(merge(
    ell([2.3, 2.6, 2.2], flesh, [0, 2.0, 0.6], null, [14, 9]),
    ell([1.9, 1.2, 1.9], coral, [0, 0.6, 0.7], null, [12, 6]),
  ), mat));
  // the shell on its back: a whorl of ivory chambers along a rising helix, coral bands, its spire leaning back
  const shell = new THREE.Group(); shell.position.set(0, 2.2, -1.4); body.add(shell);
  const whorl = [];
  for (let i = 0; i < 11; i++) {
    const k = i / 10, a = i * 1.15, r = 2.9 * (1 - k * 0.78), rad = 2.6 * (1 - k * 0.8);
    whorl.push(ell([r, r * 0.85, r], i % 2 ? ivory : '#f7ecd6', [Math.sin(a) * rad * 0.45, 0.4 + k * 6.8, -0.4 - Math.cos(a) * rad * 0.45 - k * 1.6], null, [12, 8]));
    if (i % 2 === 0 && i < 9) whorl.push(torus(r * 0.98, 0.09, coral, [Math.sin(a) * rad * 0.45, 0.4 + k * 6.8, -0.4 - Math.cos(a) * rad * 0.45 - k * 1.6], [Math.PI / 2 + 0.2, 0, a * 0.3], [3, 18]));
  }
  whorl.push(ell([0.4, 0.9, 0.4], coral, [0, 8.0, -2.0], [-0.4, 0, 0]));   // (its spire's tip)
  shell.add(new THREE.Mesh(merge(...whorl), mat));
  // the ear: a vast conch's mouth facing forward, flared, ringed in brass, dark inside, a blue glow deep in it
  const ear = new THREE.Group(); ear.position.set(0, 3.4, 1.9); body.add(ear);
  ear.add(new THREE.Mesh(merge(
    lathed([[0.5, 0], [0.75, 0.6], [1.2, 1.2], [1.9, 1.7], [2.4, 1.95], [2.5, 2.05]], ivory, 20).rotateX(Math.PI / 2),
    lathed([[0.45, 0.05], [0.7, 0.62], [1.1, 1.18], [1.75, 1.68], [2.25, 1.93]], deep, 20).rotateX(-Math.PI / 2).scale(1, 1, -1),
    torus(2.5, 0.16, brass, [0, 0, 2.05], null, [4, 26]),
  ), mat));
  ear.add(new THREE.Mesh(merge(ell([0.6, 0.6, 0.3], '#ffffff', [0, 0, 0.35], null, [10, 6])), earM));
  // a row of small eyes round the ear's upper rim
  ear.add(new THREE.Mesh(merge(...[-0.9, -0.45, 0, 0.45, 0.9].map((a) => ell([0.14, 0.14, 0.1], '#ffffff', [Math.sin(a) * 2.75, Math.cos(a) * 2.75, 1.95], null, [6, 4]))), eyeM));
  // its four lips round the ear's rim: hinged at the rim, they fold in over the mouth (shut) or spread back (listening)
  const lips = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const l = new THREE.Group(); l.position.set(Math.sin(a) * 2.4, Math.cos(a) * 2.4, 2.0); l.rotation.z = -a; ear.add(l);
    l.add(new THREE.Mesh(merge(ell([1.2, 1.5, 0.22], flesh, [0, -1.25, 0.1], null, [10, 6]), ell([1.0, 0.25, 0.25], coral, [0, -0.1, 0.12], null, [8, 4])), mat));
    return l;
  });
  // two long fins at its sides: for the sweeps
  const fins = [-1, 1].map((s) => {
    const f = new THREE.Group(); f.position.set(s * 2.0, 2.4, 0.6); body.add(f);
    f.add(new THREE.Mesh(merge(
      ell([0.7, 0.7, 0.7], flesh, [0, 0, 0]),
      ell([2.6, 0.32, 0.95], coral, [s * 2.4, -0.5, 0.4], [0, 0, s * -0.35], [12, 6]),
      ell([1.0, 0.18, 0.5], ivory, [s * 4.4, -1.2, 0.6], [0, 0, s * -0.35], [8, 4]),
    ), mat));
    return f;
  });
  const tellRig = tellFrame(group);
  noCollide(group);
  const mouth = V(), _w = V();
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 2.4, radius: 3.6, height: 10, bodyR: 3.2, touchR: 2.8, tellRig,
    body, shell, ear, lips, fins, eyeM, earM, open: 0, slump: 0, marks: { c: [0, 5.5, -1.4], r: [3.2, 3.4, 3.2] },
    part(name, out, side = 1) {
      if (name === 'arms') return out.copy(fins[side > 0 ? 1 : 0].localToWorld(_w.set(side * 4.4, -1.2, 0.6)));
      if (name === 'mouth' || name === 'head' || name === 'eye') return out.copy(ear.localToWorld(_w.set(0, 0, 1.8)));
      if (name === 'core') return out.copy(shell.localToWorld(_w.set(0, 3, -1)));
      if (name === 'feet') return out.copy(base.localToWorld(_w.set(0, 0.4, 3)));
      return null;
    },
    /** Its ear, in the world (where a horn's note has to reach). */
    ear(out = V()) { return out.copy(mouth); },
    animate(dt, t, opts) {
      const { state, attack, k = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1;
      // listening: the lips spread wide; fighting: half shut, trembling; asleep: shut; calmed: open and slack
      const want = state === 'open' ? 1 : state === 'resolved' || state === 'weary' ? 0.75 : state === 'sleep' ? -0.1 : 0.25 + 0.06 * Math.sin(t * 5);
      M.open = ease(M.open, want, state === 'open' ? 6 : 3);
      for (const l of lips) l.rotation.x = -0.9 + M.open * 1.7;
      M.slump = ease(M.slump, state === 'resolved' || state === 'weary' ? 1 : state === 'sleep' ? 0.4 : 0, 1.3);
      body.position.y = 0.9 - M.slump * 0.35;
      body.rotation.x = M.slump * 0.12;
      ear.rotation.x = -M.slump * 0.25 + (id === 'song' && !struck ? -0.25 * k : 0);
      ear.scale.setScalar(1 + (id === 'song' && !struck ? 0.12 * k : 0));
      // the fins: swept for the sweeps, raised for the slam, tucked in for the roll
      for (const [i, f] of fins.entries()) {
        const s = i ? 1 : -1;
        let ry = Math.sin(t * 1.3 + i) * 0.08, rz = 0;
        if (id === 'sweep' || id === 'sweep2') { const side = id === 'sweep2' ? -1 : 1; ry = s === side ? (struck ? -1.4 * s : 1.0 * s * k) : 0; }
        if (id === 'slam') rz = struck ? s * 0.3 : -s * 1.3 * k;
        if (id === 'roll') rz = s * 0.9 * Math.min(1, k * 1.5);
        if (state === 'sleep' || state === 'resolved' || state === 'weary') { ry = 0; rz = s * 0.35; }
        f.rotation.y = ease(f.rotation.y, ry, struck ? 14 : 5);
        f.rotation.z = ease(f.rotation.z, rz, struck ? 14 : 5);
      }
      shell.rotation.x = (id === 'slam' ? (struck ? 0.15 : -0.35 * k) : 0) + Math.sin(t * 0.7) * 0.02;
      const off = state === 'sleep' || state === 'resolved';
      eyeM.uniforms.uGlow.value = off ? (state === 'resolved' ? 0.3 : 0.1) : 0.75;
      earM.uniforms.uGlow.value = state === 'open' ? 0.75 + 0.2 * Math.sin(t * 6) : state === 'resolved' ? 0.4 : 0.15 + (id === 'song' && !struck ? 0.6 * k : 0);
      group.updateMatrixWorld(true);
      mouth.copy(ear.localToWorld(_w.set(0, 0, 1.6)));
    },
  };
  return M;
}
