import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { ell, dome, cyl, box, torus, merge } from '../wildlife/geo.js';
import { tellFrame } from './guardian-motion.js';

// The Moon Foundry's guardian (src/temples/moonfoundry.js): the Last Founder, the founders' casting machine at the
// bottom of the Casting-House. A heavy figure of cast iron on a carriage of four iron wheels: a crucible for a chest,
// its two doors swinging open on the molten heart when it pours; a long ladle for its left arm, a pair of founders'
// tongs for its right; a hooded head with one slit of an eye; a short chimney on its back. Since the night the singing
// light passed it has been casting moons that crack, one after another; a whole one, in its cradle, makes it stop to
// look. Built as the other guardians are (src/temples/guardians.js): flat printed colours merged per moving part, a
// few groups the fight poses (doors, ladle, tongs), the body in its own `tellRig` for the generic wind-ups.
//
// A model: { group, pos, heading, home, rest, restHeading, mouth, mouthR, radius, height, bodyR, tellRig, marks,
//            part(name, out, side), vent(i, out) (its heart, the target while its doors are open), animate() }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let uid = 0;
const vc = () => makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, key: `founder.${uid++}` });
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };

/** The Last Founder (a robot: its meter is damage; it is stopped, final 'break'). */
export function founderModel({ iron = '#45403f', iron2 = '#5b524c', rust = '#b5653a', ochre = '#d39a4a', ivory = '#efe6d2', ember = '#f08a3c' } = {}) {
  const group = new THREE.Group();
  const mat = vc();
  const heartM = makeMaterial({ color: ember, glow: 0.35, flat: true, key: `founder.heart.${uid++}` });
  const eyeM = makeMaterial({ color: ember, glow: 0.8, flat: true, key: `founder.eye.${uid++}` });
  const moltenM = makeMaterial({ color: '#ffb35c', glow: 0.7, flat: true, key: `founder.molten.${uid++}` });
  // the carriage: a heavy iron sledge on four wheels (they turn as it rolls)
  const base = new THREE.Group(); group.add(base);
  base.add(new THREE.Mesh(merge(
    box([4.2, 0.9, 4.6], iron, [0, 1.05, 0]),
    box([4.5, 0.25, 4.9], rust, [0, 1.55, 0]),
    cyl(1.4, 1.8, 0.8, iron2, [0, 1.95, 0], null, 12),
  ), mat));
  const wheels = [];
  for (const [x, z] of [[-2.25, 1.5], [2.25, 1.5], [-2.25, -1.5], [2.25, -1.5]]) {
    const w = new THREE.Mesh(merge(cyl(0.85, 0.85, 0.42, iron2, [0, 0, 0], [0, 0, Math.PI / 2], 12), cyl(0.3, 0.3, 0.5, rust, [0, 0, 0], [0, 0, Math.PI / 2], 8), box([0.46, 1.5, 0.16], iron, [0, 0, 0])), mat);
    w.position.set(x, 0.85, z); base.add(w); wheels.push(w);
  }
  // the body, on the carriage: the crucible chest, banded, its rim lipped like a pot's
  const body = new THREE.Group(); body.position.y = 2.3; group.add(body);
  const pot = new THREE.LatheGeometry([[1.2, 0], [2.1, 0.4], [2.5, 1.4], [2.55, 2.6], [2.3, 3.4], [2.6, 3.6], [2.6, 3.85], [1.9, 3.95]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
  body.add(new THREE.Mesh(merge(
    (() => { const g = pot.toNonIndexed(); g.deleteAttribute('uv'); const c = new THREE.Color(iron), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; })(),
    cyl(2.58, 2.58, 0.28, rust, [0, 1.05, 0], null, 18), cyl(2.62, 2.62, 0.28, rust, [0, 2.45, 0], null, 18),
    // rivets round its bands
    ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return ell([0.1, 0.1, 0.1], ochre, [Math.sin(a) * 2.66, 1.05, Math.cos(a) * 2.66], null, [5, 3]); }),
    // the dark mouth behind the doors, and the heart's hearth
    cyl(1.25, 1.25, 0.2, '#2a2224', [0, 1.75, 2.42], [Math.PI / 2, 0, 0], 16),
    // shoulders: two great round pauldrons; the neck's collar
    ell([1.05, 0.8, 1.05], iron2, [-2.75, 3.3, 0]), ell([1.05, 0.8, 1.05], iron2, [2.75, 3.3, 0]),
    cyl(1.0, 1.3, 0.5, rust, [0, 4.1, 0], null, 12),
    // the chimney on its back, its mouth ringed
    cyl(0.55, 0.65, 3.2, iron, [0, 4.6, -1.7], [-0.15, 0, 0], 10), cyl(0.75, 0.75, 0.3, rust, [0, 6.1, -1.95], [-0.15, 0, 0], 10),
  ), mat));
  // the heart: the molten core in the crucible's mouth (the target while it is open)
  const heartAt = V(0, 1.75, 2.35);
  const heart = new THREE.Mesh(merge(ell([0.95, 0.95, 0.5], '#ffffff', [heartAt.x, heartAt.y, heartAt.z], null, [12, 8])), heartM);
  body.add(heart);
  // its two doors, hinged at the mouth's sides: shut over the heart; they swing out when it pours
  const doors = [-1, 1].map((s) => {
    const d = new THREE.Group(); d.position.set(s * 1.45, 1.75, 2.35); body.add(d);
    d.add(new THREE.Mesh(merge(box([1.5, 2.7, 0.22], iron2, [-s * 0.75, 0, 0.12]), box([1.55, 0.2, 0.3], rust, [-s * 0.75, 0.8, 0.14]), box([1.55, 0.2, 0.3], rust, [-s * 0.75, -0.8, 0.14]), ell([0.14, 0.14, 0.1], ochre, [-s * 1.25, 0, 0.26], null, [5, 3])), mat));
    return d;
  });
  // the head: a hooded helmet of iron, its visor one slit of an eye
  const head = new THREE.Group(); head.position.set(0, 4.35, 0.2); body.add(head);
  head.add(new THREE.Mesh(merge(dome([1.05, 1.25, 1.1], iron2, [0, 0, 0], null, [12, 5]), box([1.7, 0.5, 0.3], iron, [0, 0.35, 0.95]), cyl(1.1, 1.1, 0.24, rust, [0, 0.02, 0], null, 12)), mat));
  head.add(new THREE.Mesh(merge(box([1.1, 0.14, 0.12], '#ffffff', [0, 0.38, 1.12])), eyeM));
  // the left arm: a long iron arm and the founders' ladle at its end, molten in its bowl
  const ladle = new THREE.Group(); ladle.position.set(-2.9, 3.3, 0.2); body.add(ladle);
  const bowl = new THREE.LatheGeometry([[0.15, -0.55], [0.85, -0.45], [1.05, 0], [1.1, 0.35], [0.98, 0.38]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  ladle.add(new THREE.Mesh(merge(
    ell([0.55, 0.55, 0.55], iron, [0, 0, 0]),
    box([0.42, 3.6, 0.42], iron2, [-0.2, -1.8, 0.2], [0.12, 0, 0.06]),
    cyl(0.32, 0.32, 0.6, rust, [-0.35, -3.6, 0.45], null, 8),
    box([0.24, 0.24, 2.2], iron, [-0.35, -3.8, 1.55]),
    (() => { const g = bowl.toNonIndexed(); g.deleteAttribute('uv'); g.translate(-0.35, -3.9, 2.9); const c = new THREE.Color(iron2), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; })(),
  ), mat));
  ladle.add(new THREE.Mesh(merge(cyl(0.9, 0.9, 0.08, '#ffffff', [-0.35, -3.55, 2.9], null, 14)), moltenM));
  // the right arm: the founders' tongs, two long jaws on a pin
  const tongs = new THREE.Group(); tongs.position.set(2.9, 3.3, 0.2); body.add(tongs);
  tongs.add(new THREE.Mesh(merge(
    ell([0.55, 0.55, 0.55], iron, [0, 0, 0]),
    box([0.42, 3.2, 0.42], iron2, [0.2, -1.6, 0.25], [0.15, 0, -0.06]),
    cyl(0.28, 0.28, 0.7, rust, [0.35, -3.3, 0.5], [0, 0, Math.PI / 2], 8),
  ), mat));
  const jaws = [-1, 1].map((s) => {
    const j = new THREE.Group(); j.position.set(0.35, -3.3, 0.5); tongs.add(j);
    j.add(new THREE.Mesh(merge(box([0.2, 0.22, 2.4], iron, [s * 0.18, 0, 1.2]), box([0.2, 0.6, 0.22], iron, [s * 0.18, -0.25, 2.35])), mat));
    return j;
  });
  // a few small moons, cracked, hung at its belt: the castings it kept
  body.add(new THREE.Mesh(merge(...[-1.3, 1.1].map((x, i) => ell([0.42, 0.42, 0.42], ivory, [x, 0.25, 2.25 - i * 0.2], null, [8, 6])), box([0.06, 0.4, 0.06], iron, [-1.3, 0.7, 2.25]), box([0.06, 0.4, 0.06], iron, [1.1, 0.7, 2.05])), mat));
  const tellRig = tellFrame(group);
  noCollide(group);
  const mouth = V(), _w = V();
  let rolled = 0, lastPos = null;
  const M = {
    group, pos: V(), heading: 0, home: null, rest: null, restHeading: 0, mouth, mouthR: 0.01, radius: 3.0, height: 8.4, bodyR: 2.6, tellRig,
    body, head, ladle, tongs, jaws, doors, heart, heartM, eyeM, moltenM, wheels, open: 0, slump: 0, marks: { c: [0, 4.2, 0], r: [2.8, 2.2, 2.8] },
    part(name, out, side = 1) {
      if (name === 'arms') return out.copy(side > 0 ? ladle.localToWorld(_w.set(-0.35, -3.6, 2.9)) : tongs.localToWorld(_w.set(0.35, -3.3, 2.0)));
      if (name === 'head' || name === 'eye') return out.copy(head.localToWorld(_w.set(0, 0.38, 1.1)));
      if (name === 'core') return out.copy(body.localToWorld(_w.copy(heartAt)));
      if (name === 'feet') return out.copy(base.localToWorld(_w.set(0, 0.6, 2.6)));
      return null;
    },
    /** Its heart, in the world (the one target, while its doors are open). */
    vent(i, out = V()) { return body.localToWorld(out.set(heartAt.x, heartAt.y, heartAt.z + 0.3)); },
    animate(dt, t, opts) {
      const { state, attack, k = 0, meter = 0 } = opts;
      const ease = (cur, want, rate) => cur + (want - cur) * Math.min(1, dt * rate);
      const id = attack?.id, struck = !!attack && k >= 1, fighting = state === 'fight';
      M.open = ease(M.open, state === 'open' ? 1 : 0, 5);
      M.slump = ease(M.slump, state === 'resolved' ? 1 : state === 'sleep' ? 0.35 : 0, 1.4);
      // the wheels: as far as it rolled
      if (lastPos) rolled += Math.hypot(M.pos.x - lastPos.x, M.pos.z - lastPos.z) * Math.sign(Math.cos(M.heading) * (M.pos.z - lastPos.z) + Math.sin(M.heading) * (M.pos.x - lastPos.x) || 1);
      lastPos = (lastPos ?? V()).copy(M.pos);
      for (const w of wheels) w.rotation.x = rolled / 0.85;
      body.position.y = 2.3 - M.slump * 0.5;
      body.rotation.x = M.slump * 0.22;
      head.rotation.x = M.slump * 0.35;
      // the doors swing out when it pours (open), a crack's width while it fights, shut asleep
      const crack = fighting ? 0.08 + 0.05 * Math.sin(t * 7) : 0;
      for (const [i, d] of doors.entries()) d.rotation.y = (i ? -1 : 1) * (crack + M.open * 1.5);
      // the ladle: raised and swung for the sweep, lifted forward and tipped for the pour, back to throw a cast
      let lx = -0.2 + Math.sin(t * 1.6) * 0.06, lz = 0.15, ly = 0;
      if (id === 'ladle' || id === 'ladle2') { const s = id === 'ladle2' ? -1 : 1; lx = struck ? 0.4 : -1.2 * k; ly = struck ? -0.9 * s : 0.9 * s * k; lz = 0.9 * (struck ? 0.6 : k); }
      if (id === 'pour') { lx = struck ? -1.0 : -1.45 * k; lz = struck ? 0.5 : 0.2; }
      if (id === 'cast' || id === 'casts') { lx = struck ? -1.6 : 0.9 * k; }
      if (id === 'slam') { lx = struck ? 0.5 : -2.2 * k; }
      if (state === 'sleep' || state === 'resolved') { lx = 0.25; ly = 0; lz = 0.1; }
      if (state === 'open') { lx = -1.2; lz = 0.4; }
      M.lx = ease(M.lx ?? 0, lx, struck ? 14 : 5); M.ly = ease(M.ly ?? 0, ly, struck ? 14 : 5); M.lz = ease(M.lz ?? 0, lz, 5);
      ladle.rotation.set(M.lx, M.ly, M.lz);
      // the tongs: up for the slam, open and shut as it walks
      let tx = -0.15 + Math.sin(t * 1.6 + 1) * 0.06;
      if (id === 'slam') tx = struck ? 0.5 : -2.2 * k;
      if (id === 'charge') tx = -1.2 * Math.min(1, k * 1.5);
      if (state === 'sleep' || state === 'resolved') tx = 0.25;
      M.tx = ease(M.tx ?? 0, tx, struck ? 14 : 5);
      tongs.rotation.x = M.tx;
      const gape = state === 'resolved' ? 0 : 0.12 + 0.1 * Math.sin(t * 3);
      for (const [i, j] of jaws.entries()) j.rotation.y = (i ? 1 : -1) * gape;
      // the heart glows through the crack, fully when open; its eye the fight's; resolved, both cool
      const off = state === 'sleep' || state === 'resolved';
      heartM.uniforms.uGlow.value = state === 'resolved' ? 0.05 : 0.3 + 0.65 * M.open * (0.8 + 0.2 * Math.sin(t * 9)) + (id === 'pour' && !struck ? 0.4 * k : 0);
      eyeM.uniforms.uGlow.value = off ? (state === 'resolved' ? 0 : 0.15) : 0.85;
      moltenM.uniforms.uGlow.value = state === 'resolved' ? 0.05 : 0.6 + 0.15 * (1 - meter);
      group.updateMatrixWorld(true);
      mouth.copy(body.localToWorld(_w.set(heartAt.x, heartAt.y, heartAt.z + 0.4)));
    },
  };
  return M;
}
