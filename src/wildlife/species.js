import * as THREE from 'three';
import { ell, dome, box, cyl, cone, torus, oct, tube, leg, both, merge } from './geo.js';

// The species of every world, and their surprises.
//
// A species is a handful of instanced parts (body, head, legsA / legsB which
// step in alternation, tail, plus pieces only its surprise shows) with a gait
// for the shared idle / wander animation, and a `trick`:
//   dur    seconds
//   end    'gone' (it leaves; comes back later out of sight) or 'recover'
//   start  (creature, ctx) once, when scared: pick a landing spot (data.to), burst FX
//   pose   (creature, k 0..1, pose, ctx) every frame: offset / rotate / scale /
//          show parts; pose.root moves the whole creature in its local frame
//          (x right, y up, z forward = away from what scared it)
// Parts marked `free` ignore the root (a dropped tail stays where it fell).

const PI = Math.PI;
const INK = '#2b211f';
const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (k, a, b) => cl((k - a) / (b - a));
const sm = (x) => x * x * (3 - 2 * x);
const back = (x) => (x <= 0 ? 0 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2);   // ease out, overshooting
const bell = (k, a, b) => Math.sin(PI * seg(k, a, b));
const once = (c, key) => !c.data[key] && (c.data[key] = true);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const hideParts = (P, ...names) => { for (const n of names) if (P[n]) P[n].show = false; };
const shrink = (P, f, ...names) => { for (const n of names) if (P[n]) { P[n].s.multiplyScalar(Math.max(1e-3, f)); if (f < 0.02) P[n].show = false; } };
const eyes = (x, y, z, r = 0.022, color = INK) => both((s) => ell([r, r, r], color, [s * x, y, z], null, [6, 4]));
/** four legs, alternating pairs: A = front-left + back-right, B = front-right + back-left */
const quad = (hipX, hipY, front, backZ, footX, color, r = 0.022) => ({
  legsA: merge(leg([-hipX, hipY, front], [-footX, 0, front + 0.04], r, color), leg([hipX, hipY, backZ], [footX, 0, backZ - 0.02], r, color)),
  legsB: merge(leg([hipX, hipY, front], [footX, 0, front + 0.04], r, color), leg([-hipX, hipY, backZ], [-footX, 0, backZ - 0.02], r, color)),
});
/** six (or eight) legs, alternating tripods */
function insectLegs(hipX, hipY, zs, footX, color, r = 0.016, knee = 0) {
  const A = [], B = [];
  zs.forEach((z, i) => both((s) => {
    const hip = [s * hipX, hipY, z], foot = [s * footX, 0, z * 1.35];
    const pieces = knee ? [leg(hip, [s * (hipX + footX) * 0.6, hipY + knee, z * 1.15], r, color), leg([s * (hipX + footX) * 0.6, hipY + knee, z * 1.15], foot, r * 0.8, color)] : [leg(hip, foot, r, color)];
    ((i + (s > 0 ? 1 : 0)) % 2 ? A : B).push(...pieces);
  }));
  return { legsA: merge(A), legsB: merge(B) };
}
/** relocating surprises: pick the landing spot, turn to it, remember it in local space */
function landing(c, X, min, max, opts) {
  const to = X.world.spotNear(c, min, max, opts);
  c.data.to = to;
  c.data.L = to ? X.world.aim(c, to) : new THREE.Vector3();
  return c.data.L;
}
const dust = (c, X, at, color = '#e3c58f', n = 10, size = 0.05) =>
  X.fx.burst(at, c.up, { n, color: [color, '#f3ead8'], speed: 1.2, rise: 0.8, size: size * c.size, life: 0.8, gravity: 1.5, grow: 1.5 });

// =================================================================== the desert
const SAND = '#d9b77a', TEAL = '#5fb7ad', OCHRE = '#d8a24a';

const puffLizard = {
  id: 'puffLizard', name: 'puff lizard', main: SAND, size: 1.25, height: 0.15, radius: 0.35,
  gait: 'walk', speed: 1.6, cadence: 16, lift: 0.04, stride: 0.05, notice: 8, wary: 4,
  parts: {
    body: merge(ell([0.13, 0.085, 0.27], SAND, [0, 0.12, 0]), ell([0.11, 0.05, 0.22], '#efdcb0', [0, 0.085, 0.01]),
      [-0.13, 0, 0.13].map((z) => ell([0.05, 0.022, 0.055], TEAL, [0, 0.198, z]))),
    head: { at: [0, 0.14, 0.24], geo: merge(ell([0.08, 0.06, 0.11], SAND, [0, 0, 0.07]), eyes(0.055, 0.03, 0.09),
      ell([0.075, 0.05, 0.014], TEAL, [0, 0.015, -0.005])) },
    tail: { at: [0, 0.11, -0.25], geo: merge(cone(0.06, 0.5, SAND, [0, 0, -0.25], [-PI / 2, 0, 0]), ell([0.03, 0.012, 0.05], TEAL, [0, 0.03, -0.12])) },
    ...quad(0.09, 0.1, 0.14, -0.13, 0.2, SAND),
  },
  trick: {
    name: 'balloons up and floats away', dur: 8, end: 'gone', sound: 'inflate', reach: 6,
    start: (c, X) => dust(c, X, c.toWorld(0, 0.05, 0), '#e3c58f', 6),
    pose(c, k, P, X) {
      const inf = back(seg(k, 0, 0.18));
      P.body.s.set(1 + 2.3 * inf, 1 + 3.6 * inf, 1 + 0.6 * inf);
      P.body.p.y += 0.26 * inf;
      shrink(P, 1 - seg(k, 0, 0.12), 'legsA', 'legsB');
      P.head.p.y += 0.5 * inf; P.head.p.z += 0.06 * inf; P.head.r.x -= 0.4 * inf;
      P.tail.p.y += 0.2 * inf; P.tail.r.x = 0.7 * inf + Math.sin(X.t * 3) * 0.15;
      const f = seg(k, 0.16, 1);
      P.root.p.y += f * f * 26 + f * 1.6 + Math.sin(X.t * 3) * 0.05 * inf;
      P.root.p.z += f * f * 10;
      P.root.p.x += Math.sin(f * 5) * 0.8 * f;
      P.root.r.z = Math.sin(X.t * 2) * 0.15 * f;
      P.root.r.y = f * 1.6;
      P.root.s.multiplyScalar(1 - seg(k, 0.88, 1));
    },
  },
};

const sandCrab = {
  id: 'sandCrab', name: 'dune crab', main: '#c8643f', size: 1.2, height: 0.13, radius: 0.35,
  gait: 'scuttle', speed: 1.8, cadence: 24, lift: 0.04, stride: 0.03, notice: 7, wary: 3.5,
  parts: {
    body: merge(ell([0.24, 0.085, 0.17], '#c8643f', [0, 0.13, 0]), ell([0.2, 0.05, 0.14], '#efd3a8', [0, 0.09, 0]),
      both((s) => ell([0.05, 0.02, 0.04], '#efd3a8', [s * 0.1, 0.205, -0.03]))),
    eyes: { at: [0, 0.18, 0.12], geo: merge(both((s) => [cyl(0.012, 0.014, 0.13, '#c8643f', [s * 0.06, 0.065, 0]), ell([0.03, 0.03, 0.03], INK, [s * 0.06, 0.14, 0])])) },
    claws: { at: [0, 0.12, 0.15], geo: merge(both((s) => [ell([0.07, 0.045, 0.08], '#d9643a', [s * 0.17, 0, 0.06], [0, s * 0.4, 0]), ell([0.03, 0.02, 0.06], '#d9643a', [s * 0.21, 0.025, 0.13], [0, -s * 0.3, 0])])) },
    ...insectLegs(0.17, 0.12, [0.08, 0, -0.08], 0.33, '#c8643f', 0.016, 0.06),
  },
  idle(c, P, t) { P.eyes.r.y = Math.sin(t * 0.9 + c.seed) * 0.3; P.claws.s.x = 1 + Math.sin(t * 6 + c.seed) * 0.05; },
  trick: {
    name: 'digs itself into the sand, eyes up', dur: 7.5, end: 'recover', sound: 'poof', reach: 2,
    start(c, X) { X.fx.burst(c.toWorld(0, 0.1, 0), c.up, { n: 18, color: ['#e3c58f', '#d8b884', '#f0dcb0'], speed: 1.6, rise: 1.2, size: 0.06 * c.size, life: 1.1, gravity: 2, grow: 1.5 }); },
    pose(c, k, P, X) {
      P.root.r.z = Math.sin(X.t * 40) * 0.08 * bell(k, 0, 0.12);
      const sink = sm(seg(k, 0.08, 0.3)), rise = sm(seg(k, 0.86, 1)), d = (sink - rise) * 0.34;
      P.root.p.y -= d;
      P.eyes.p.y += d * 0.85;
      P.eyes.r.y = Math.sin(X.t * 2) * 0.7 * (sink - rise);
      for (const n of ['legsA', 'legsB', 'claws']) P[n].s.multiplyScalar(1 - 0.4 * (sink - rise));
      if (k > 0.08 && k < 0.3 && Math.random() < X.dt * 30) dust(c, X, c.toWorld((Math.random() - 0.5) * 0.4, 0.02, (Math.random() - 0.5) * 0.4), '#e3c58f', 1);
      if (k > 0.86 && once(c, 'out')) dust(c, X, c.toWorld(0, 0.05, 0), '#e3c58f', 10);
    },
  },
};

const jerboa = {
  id: 'jerboa', name: 'dune jerboa', main: '#ecd6a8', size: 1.2, height: 0.2, radius: 0.3,
  gait: 'hop', speed: 2.2, cadence: 9, hopHeight: 0.18, notice: 9, wary: 5,
  parts: {
    body: merge(ell([0.12, 0.12, 0.14], '#ecd6a8', [0, 0.17, 0]), ell([0.09, 0.09, 0.1], '#f7ecd2', [0, 0.15, 0.05])),
    head: { at: [0, 0.25, 0.11], geo: merge(ell([0.08, 0.075, 0.09], '#ecd6a8', [0, 0.02, 0.05]), ell([0.018, 0.015, 0.015], '#c8483a', [0, 0.01, 0.135]), eyes(0.045, 0.04, 0.1, 0.02)) },
    ears: { at: [0, 0.31, 0.12], geo: merge(both((s) => [ell([0.055, 0.13, 0.018], '#ecd6a8', [s * 0.05, 0.1, -0.005], [0, 0, -s * 0.3]), ell([0.035, 0.09, 0.012], '#e6875f', [s * 0.052, 0.1, 0.008], [0, 0, -s * 0.3])])) },
    tail: { at: [0, 0.12, -0.12], geo: merge(tube([[0, 0, 0], [0, 0.02, -0.2], [0, -0.03, -0.4], [0, -0.08, -0.52]], 0.014, '#ecd6a8'), ell([0.04, 0.04, 0.07], '#f7ecd2', [0, -0.09, -0.55]), ell([0.035, 0.035, 0.04], INK, [0, -0.1, -0.61])) },
    legsA: merge(both((s) => [ell([0.04, 0.08, 0.06], '#ecd6a8', [s * 0.08, 0.09, -0.04]), ell([0.03, 0.02, 0.09], '#ecd6a8', [s * 0.08, 0.015, 0.02])])),
    legsB: merge(both((s) => ell([0.015, 0.04, 0.015], '#ecd6a8', [s * 0.05, 0.12, 0.12]))),
  },
  idle(c, P, t) { const tw = Math.max(0, Math.sin(t * 2.7 + c.seed)) ** 12; P.ears.r.x = -tw * 0.3; },
  trick: {
    name: 'vaults on its tail and parachutes down on its ears', dur: 4.6, end: 'recover', sound: 'boing', reach: 9,
    start(c, X) { landing(c, X, 5, 8); dust(c, X, c.toWorld(0, 0.02, -0.2)); },
    pose(c, k, P, X) {
      const L = c.data.L;
      const crouch = bell(k, 0, 0.14);
      P.root.s.y *= 1 - 0.3 * crouch;
      P.tail.r.x = 0.5 * crouch;
      const f = seg(k, 0.12, 0.95);
      const h = f < 0.22 ? 7 * sm(f / 0.22) : 7 * (1 - sm((f - 0.22) / 0.78));
      P.root.p.copy(L).multiplyScalar(sm(f)).y += h;
      const chute = sm(seg(k, 0.22, 0.32)) * (1 - sm(seg(k, 0.9, 0.97)));
      P.ears.s.set(1 + 3.2 * chute, 1 + 0.6 * chute, 1);
      P.ears.p.y += 0.06 * chute; P.ears.r.x = -0.25 * chute;
      P.root.r.z = Math.sin(X.t * 3) * 0.25 * chute;
      P.legsA.r.x = 0.5 * chute;
      P.tail.r.y = Math.sin(X.t * 15) * 0.7 * chute;
      if (k > 0.95 && once(c, 'land')) dust(c, X, c.toWorld(L.x, L.y + 0.02, L.z));
    },
  },
};

// =================================================================== the City-Shaft
const snailShell = merge(ell([0.14, 0.15, 0.17], '#f2c54b', [0, 0.06, 0]), ell([0.145, 0.035, 0.175], '#62c3c9', [0, 0.03, 0]),
  both((s) => [torus(0.065, 0.012, INK, [s * 0.138, 0.08, 0], [0, PI / 2, 0]), cyl(0.032, 0.04, 0.09, '#8a8f9c', [s * 0.07, 0.02, -0.17], [PI / 2, 0, 0])]),
  [-0.06, 0, 0.06].map((z) => box([0.02, 0.02, 0.02], INK, [0, 0.215, z])));

const taxiSnail = {
  id: 'taxiSnail', name: 'taxi snail', main: '#f2c54b', size: 1.25, height: 0.2, radius: 0.35,
  gait: 'slither', speed: 0.4, cadence: 7, notice: 7, wary: 3.2, backoff: 1.2,
  parts: {
    body: merge(ell([0.1, 0.06, 0.3], '#bdb4c8', [0, 0.05, 0.02]), ell([0.075, 0.08, 0.09], '#bdb4c8', [0, 0.1, 0.24]),
      both((s) => [cyl(0.01, 0.013, 0.13, '#bdb4c8', [s * 0.04, 0.2, 0.28], [0.35, 0, -s * 0.25]), ell([0.025, 0.025, 0.025], INK, [s * 0.06, 0.26, 0.31])])),
    shell: { at: [0, 0.13, -0.05], geo: snailShell },
    jets: { at: [0, 0.15, -0.27], glow: true, hidden: true, geo: merge(both((s) => cone(0.035, 0.24, '#ffb35a', [s * 0.07, 0, -0.08], [-PI / 2, 0, 0]))) },
  },
  trick: {
    name: 'its shell lights two jets and flies off like a taxi', dur: 6.5, end: 'gone', sound: 'jet', reach: 12,
    pose(c, k, P, X) {
      const ret = sm(seg(k, 0, 0.15));
      P.body.s.set(1 - 0.5 * ret, 1 - 0.6 * ret, 1 - 0.75 * ret); P.body.p.z -= 0.08 * ret;
      if (k > 0.12) {
        P.jets.show = true;
        P.jets.s.set(1, 1, seg(k, 0.12, 0.2) * (0.8 + 0.4 * Math.sin(X.t * 60)));
      }
      const fly = seg(k, 0.18, 1), a = fly ** 1.3 * 2.4 * PI, R = 2.5;
      P.root.p.set((1 - Math.cos(a)) * R, 0.3 * seg(k, 0.15, 0.2) + fly * fly * 16, Math.sin(a) * R + fly * fly * 14);
      P.root.r.y = a; P.root.r.z = -0.4 * fly;
      P.root.s.multiplyScalar(1 - seg(k, 0.9, 1));
      if (fly > 0 && Math.random() < X.dt * 30) X.fx.one(c.wpos.clone(), _v.set(0, 0, 0), c.up, { color: '#d6d0c8', size: 0.07 * c.size, life: 0.9, gravity: -0.4, drag: 2, grow: 2 });
    },
  },
};

const gecko = {
  id: 'gecko', name: 'terrace gecko', main: '#e88fa6', size: 1.3, height: 0.08, radius: 0.3,
  gait: 'walk', speed: 2.4, cadence: 22, lift: 0.035, stride: 0.05, turn: 8, notice: 8, wary: 4.5, skittish: 1.2,
  parts: {
    body: merge(ell([0.07, 0.05, 0.2], '#e88fa6', [0, 0.07, 0]), ell([0.06, 0.03, 0.17], '#f3ead8', [0, 0.05, 0]),
      [-0.1, 0, 0.1].map((z) => both((s) => ell([0.022, 0.012, 0.022], '#62c3c9', [s * 0.04, 0.11, z])))),
    head: { at: [0, 0.08, 0.19], geo: merge(ell([0.06, 0.04, 0.08], '#e88fa6', [0, 0, 0.05]), both((s) => [ell([0.026, 0.026, 0.026], '#f2c54b', [s * 0.045, 0.025, 0.06]), ell([0.008, 0.02, 0.012], INK, [s * 0.066, 0.025, 0.066])])) },
    tail: { at: [0, 0.07, -0.19], free: true, geo: merge(cone(0.035, 0.45, '#62c3c9', [0, 0, -0.225], [-PI / 2, 0, 0]), [-0.08, -0.18, -0.28].map((z) => torus(0.03 + z * 0.06, 0.008, '#e88fa6', [0, 0, z], null, [3, 10]))) },
    ...quad(0.06, 0.07, 0.1, -0.1, 0.17, '#e88fa6', 0.016),
  },
  idle(c, P, t) { P.root.p.y += Math.max(0, Math.sin(t * 3 + c.seed)) ** 6 * 0.03 * (1 - c.moveAmt); },
  trick: {
    name: 'drops its wriggling tail and dashes into a crack', dur: 5, end: 'gone', sound: 'squeak', reach: 8,
    start(c, X) { landing(c, X, 3, 6); },
    pose(c, k, P, X) {
      const L = c.data.L, dash = sm(seg(k, 0.04, 0.42));
      P.root.p.copy(L).multiplyScalar(dash);
      P.root.r.set(0, 0, 0);
      for (const n of ['legsA', 'legsB']) P[n].p.z += Math.sin(X.t * 45 + (n === 'legsA' ? 0 : PI)) * 0.05 * (1 - seg(k, 0.4, 0.42));
      const gone = seg(k, 0.4, 0.48);
      shrink(P, 1 - gone, 'body', 'head', 'legsA', 'legsB');
      if (k > 0.46 && once(c, 'crack')) dust(c, X, c.toWorld(L.x, L.y + 0.02, L.z), '#d8c8b0', 6, 0.05);
      // the tail stays behind (a free part), wriggling
      P.tail.r.y = Math.sin(X.t * 26) * 0.7 * (1 - seg(k, 0.8, 1));
      P.tail.p.y += Math.abs(Math.sin(X.t * 19)) * 0.03 - 0.05;
      P.tail.s.multiplyScalar(1 - seg(k, 0.9, 1));
    },
  },
};

// =================================================================== Vael
const BONE = '#f4efe2', ROSE = '#b98f9a', PEACH = '#f4d4b6';

const boneKite = {
  id: 'boneKite', name: 'bone kite', main: BONE, size: 1.3, height: 0.08, radius: 0.35,
  gait: 'walk', speed: 1.1, cadence: 18, lift: 0.03, stride: 0.035, notice: 9, wary: 5,
  parts: {
    body: merge(oct([0.2, 0.05, 0.28], BONE, [0, 0.085, 0]), oct([0.21, 0.03, 0.29], ROSE, [0, 0.06, 0]), eyes(0.04, 0.12, 0.17, 0.018)),
    tail: { at: [0, 0.07, -0.27], geo: merge(tube([[0, 0, 0], [0.05, 0, -0.15], [-0.05, 0, -0.3], [0, 0, -0.45]], 0.008, INK, 10, 3),
      [[0.04, -0.12], [-0.04, -0.27], [0, -0.43]].map(([x, z]) => oct([0.035, 0.01, 0.025], '#e8a68e', [x, 0, z]))) },
    sail: { at: [0, 0.12, 0], hidden: true, geo: merge(oct([0.45, 0.6, 0.012], PEACH, [0, 0, 0]), oct([0.3, 0.4, 0.016], '#f8eadb', [0, 0.05, 0]),
      box([0.9, 0.016, 0.03], INK), box([0.016, 1.2, 0.03], INK), ell([0.09, 0.06, 0.02], ROSE, [0, 0.12, 0.012]), ell([0.03, 0.03, 0.02], INK, [0, 0.12, 0.02])) },
    ...quad(0.1, 0.07, 0.12, -0.12, 0.18, ROSE, 0.012),
  },
  trick: {
    name: 'unfolds into a paper kite and rides the wind', dur: 9, end: 'gone', sound: 'flutter', reach: 5,
    pose(c, k, P, X) {
      const u = back(seg(k, 0, 0.2));
      P.sail.show = true; P.sail.s.setScalar(Math.max(1e-3, u)); P.sail.p.y += 0.45 * u; P.sail.r.y = PI;   // its painted eye looks back at you
      shrink(P, 1 - 0.75 * u, 'body');
      P.body.p.y += 0.35 * u;
      if (u > 0.3) hideParts(P, 'legsA', 'legsB');
      P.tail.p.y += -0.05 * u; P.tail.s.z = 1 + 2.5 * u; P.tail.r.x = -1.2 * u + Math.sin(X.t * 5) * 0.2 * u;
      P.tail.p.z += 0.27 * u;
      const f = seg(k, 0.15, 1);
      P.root.r.x = -0.45 * u;
      P.root.p.y += f * f * 28 + f * 2;
      P.root.p.z += f * f * 16; P.root.p.x += Math.sin(f * 7) * 1.5 * f;
      P.root.r.z = Math.sin(X.t * 2.2) * 0.35 * f; P.root.r.y = Math.sin(X.t * 1.3) * 0.2 * f;
      P.root.s.multiplyScalar(1 - seg(k, 0.9, 1));
    },
  },
};

const needleWalker = {
  id: 'needleWalker', name: 'needle walker', main: BONE, size: 1.35, height: 0.18, radius: 0.3,
  gait: 'walk', speed: 0.7, cadence: 14, lift: 0.05, stride: 0.06, bob: 0.02, notice: 8, wary: 4,
  parts: {
    body: merge(cyl(0.022, 0.03, 0.6, BONE, [0, 0.17, -0.03], [PI / 2, 0, 0]), ell([0.04, 0.035, 0.09], '#e6dccb', [0, 0.17, 0.15]),
      cone(0.022, 0.12, '#b0705a', [0, 0.17, -0.38], [-PI / 2, 0, 0])),
    head: { at: [0, 0.17, 0.29], geo: merge(ell([0.035, 0.03, 0.045], BONE, [0, 0, 0.02]), eyes(0.026, 0.01, 0.035, 0.015, '#b0705a'),
      both((s) => tube([[s * 0.01, 0.02, 0.03], [s * 0.05, 0.12, 0.15], [s * 0.09, 0.15, 0.3]], 0.004, '#b0705a', 6, 3))) },
    ...insectLegs(0.025, 0.16, [0.12, 0, -0.12], 0.22, BONE, 0.01, 0.1),
  },
  idle(c, P, t) { P.root.r.z += Math.sin(t * 1.6 + c.seed) * 0.06; P.root.p.x += Math.sin(t * 1.6 + c.seed) * 0.01; },
  trick: {
    name: 'stands up stiff as a tiny needle spire', dur: 9, end: 'recover', sound: 'creak', reach: 2,
    pose(c, k, P, X) {
      const up = back(seg(k, 0, 0.15)) * (1 - sm(seg(k, 0.85, 1)));
      const st = 1 + 1.3 * up;
      P.root.s.z *= st;
      P.root.r.x = -1.5 * up + Math.sin(X.t * 0.8) * 0.02 * up;
      P.root.p.y += (0.45 * st + 0.02) * up;
      P.root.p.z += 0.17 * up;
      for (const n of ['legsA', 'legsB']) { P[n].s.x = 1 - 0.85 * up; P[n].s.y = 1 - 0.5 * up; }
      P.head.s.multiplyScalar(1 - 0.3 * up);
    },
  },
};

// =================================================================== Vael II
const STONE = '#d8d2c4', CREAM = '#e6dccb', SALMON = '#e8a68e', SHADE = '#8f95a3';

const cairnCrab = {
  id: 'cairnCrab', name: 'cairn crab', main: STONE, size: 1.3, height: 0.25, radius: 0.35,
  gait: 'scuttle', speed: 1.0, cadence: 20, lift: 0.035, stride: 0.03, notice: 8, wary: 4,
  parts: {
    stone1: { at: [0, 0.14, 0], geo: merge(ell([0.22, 0.1, 0.2], STONE, [0, 0, 0])) },
    stone2: { at: [0, 0.31, 0], geo: merge(ell([0.16, 0.08, 0.15], CREAM, [0, 0, 0], [0, 0.5, 0.08])) },
    stone3: { at: [0, 0.44, 0], geo: merge(ell([0.1, 0.07, 0.1], SALMON, [0, 0, 0])) },
    eyes: { at: [0, 0.12, 0.17], geo: merge(both((s) => [cyl(0.01, 0.01, 0.08, SHADE, [s * 0.05, 0.03, 0]), ell([0.022, 0.022, 0.022], INK, [s * 0.05, 0.08, 0])])) },
    ...insectLegs(0.14, 0.1, [0.08, 0, -0.08], 0.27, SHADE, 0.014, 0.05),
  },
  idle(c, P, t) {
    const m = 1 + 2 * c.moveAmt;
    P.stone2.r.z = Math.sin(t * 2 + c.seed) * 0.05 * m; P.stone2.p.x += Math.sin(t * 2 + c.seed) * 0.01 * m;
    P.stone3.r.z = Math.sin(t * 2 + c.seed + 0.6) * 0.09 * m; P.stone3.p.x += Math.sin(t * 2 + c.seed + 0.6) * 0.02 * m;
  },
  trick: {
    name: 'topples into a pile of pebbles, then restacks itself', dur: 7.5, end: 'recover', sound: 'clack', reach: 2,
    start(c) { c.data.a2 = c.rng() * PI * 2; c.data.a3 = c.data.a2 + 2 + c.rng() * 2; },
    pose(c, k, P, X) {
      const fall = seg(k, 0, 0.12), hold = seg(k, 0.15, 0.4) * (1 - seg(k, 0.6, 0.7));
      shrink(P, 1 - 0.8 * fall * (1 - seg(k, 0.88, 0.98)), 'legsA', 'legsB');
      P.stone1.p.y -= 0.06 * fall * (1 - seg(k, 0.9, 1)); P.stone1.r.z = 0.15 * fall * (1 - seg(k, 0.9, 1));
      P.eyes.p.y -= 0.05 * fall * (1 - seg(k, 0.9, 1)); P.eyes.r.y = Math.sin(X.t * 1.5) * 0.6 * hold;
      for (const [n, a, t0, back0, R, y0] of [['stone3', c.data.a3, 0, 0.82, 0.38, 0.44], ['stone2', c.data.a2, 0.04, 0.7, 0.32, 0.31]]) {
        const out = sm(seg(k, t0, t0 + 0.14)), home = sm(seg(k, back0, back0 + 0.12));
        const e = out * (1 - home);
        const q = P[n];
        q.p.set(Math.cos(a) * R * e, y0 + (0.07 - y0) * e + Math.sin(PI * out) * 0.12 * (1 - home) + Math.sin(PI * home) * 0.35, Math.sin(a) * R * e);
        q.r.z = (n === 'stone2' ? 1.2 : -1.0) * e; q.r.y = a * e;
        if (out >= 1 && once(c, n)) { dust(c, X, c.toWorld(q.p.x, 0.04, q.p.z), '#efe6d6', 6, 0.05); X.fx.play('clack', c.pos, X.world.ear); }
      }
    },
  },
};

const cloudRay = {
  id: 'cloudRay', name: 'cloud ray', main: '#f4e9da', size: 1.45, height: 0.03, radius: 0.45,
  gait: 'hover', hover: 0.9, flap: 2.4, flapAmp: 0.35, speed: 1.2, cadence: 3, notice: 9, wary: 5, turn: 2.5,
  parts: {
    body: merge(oct([0.16, 0.05, 0.24], '#f4e9da', [0, 0, 0]), oct([0.15, 0.04, 0.22], SALMON, [0, -0.012, 0]), eyes(0.06, 0.035, 0.13, 0.018),
      both((s) => cone(0.02, 0.09, SALMON, [s * 0.06, 0, 0.25], [PI / 2, 0, 0]))),
    wingL: { at: [-0.1, 0, 0], geo: merge(oct([0.25, 0.03, 0.18], '#f4e9da', [-0.18, 0, -0.03]), oct([0.12, 0.031, 0.08], SALMON, [-0.22, 0.003, -0.05])) },
    wingR: { at: [0.1, 0, 0], geo: merge(oct([0.25, 0.03, 0.18], '#f4e9da', [0.18, 0, -0.03]), oct([0.12, 0.031, 0.08], SALMON, [0.22, 0.003, -0.05])) },
    tail: { at: [0, 0, -0.2], geo: merge(tube([[0, 0, 0], [0, 0.02, -0.25], [0, -0.02, -0.5]], 0.008, ROSE, 8, 3)) },
  },
  trick: {
    name: 'puffs itself into a little cloud and drifts away', dur: 6, end: 'gone', sound: 'puff', reach: 3,
    start(c, X) {
      c.data.cp = c.center.clone();
      X.fx.burst(c.center, c.up, { n: 30, color: ['#ffffff', '#f6f1ea', '#ece6f0'], speed: 1.1, rise: 0.25, size: 0.13 * c.size, life: 5, gravity: -0.04, drag: 1.4, grow: 1.6, dir: _v.copy(c.fwd).multiplyScalar(0.4) });
    },
    pose(c, k, P, X) {
      const p = seg(k, 0, 0.25);
      P.root.s.multiplyScalar(1 - sm(p)); P.root.p.y += p * 0.3;
      if (P.wingL) { P.wingL.r.z += Math.sin(X.t * 20) * 0.6 * p; P.wingR.r.z -= Math.sin(X.t * 20) * 0.6 * p; }
      if (k > 0.25) P.root.show = false;
      const cp = c.data.cp;
      cp.addScaledVector(c.fwd, 0.5 * X.dt).addScaledVector(c.up, 0.12 * X.dt);
      if (k < 0.6 && Math.random() < X.dt * 10) X.fx.one(_v.copy(cp).add(_w.set(Math.random() - 0.5, Math.random() * 0.3, Math.random() - 0.5).multiplyScalar(c.size * 0.6)),
        _w.copy(c.fwd).multiplyScalar(0.5), c.up, { color: '#ffffff', size: 0.16 * c.size, life: 3.5, gravity: -0.04, drag: 0.5, grow: 1.4 });
    },
  },
};

// =================================================================== the Sealed Hangar
const LILAC = '#a99be0', CYAN = '#62c3c9', GOLD = '#f2c54b';
const portalRing = merge(torus(0.36, 0.045, CYAN, [0, 0, 0], null, [5, 24]), ell([0.32, 0.32, 0.012], '#d6fff8', [0, 0, 0], null, [14, 6]));

const portalHopper = {
  id: 'portalHopper', name: 'portal hopper', main: LILAC, size: 1.2, height: 0.15, radius: 0.35,
  gait: 'hop', speed: 1.6, cadence: 8, hopHeight: 0.16, notice: 8, wary: 4,
  parts: {
    body: merge(ell([0.17, 0.13, 0.17], LILAC, [0, 0.15, 0]), ell([0.13, 0.09, 0.12], GOLD, [0, 0.11, 0.07]),
      both((s) => [ell([0.05, 0.05, 0.05], '#f3ead8', [s * 0.08, 0.27, 0.08]), ell([0.025, 0.025, 0.02], INK, [s * 0.09, 0.28, 0.125])]),
      [[0.08, 0.22, -0.08], [-0.1, 0.19, -0.04], [0.02, 0.27, -0.06]].map((p) => ell([0.025, 0.012, 0.025], '#e88fa6', p))),
    legsA: merge(both((s) => [ell([0.06, 0.05, 0.1], LILAC, [s * 0.13, 0.06, -0.06]), ell([0.04, 0.015, 0.08], '#8a7fc0', [s * 0.15, 0.012, 0.03])])),
    legsB: merge(both((s) => ell([0.025, 0.06, 0.025], LILAC, [s * 0.08, 0.05, 0.12]))),
    ringA: { at: [0, 0.36, 0.5], glow: true, hidden: true, free: true, geo: portalRing },
    ringB: { at: [0, 0.36, 0], glow: true, hidden: true, free: true, geo: portalRing },
  },
  trick: {
    name: 'opens a little portal, dives in and pops out of another', dur: 3.4, end: 'recover', sound: 'portal', reach: 16,
    start(c, X) { const L = landing(c, X, 9, 14); if (!c.data.to) landing(c, X, 4, 7); c.data.L = c.data.L ?? L; },
    pose(c, k, P, X) {
      const L = c.data.L;
      const closeAll = 1 - sm(seg(k, 0.9, 1));
      P.ringA.show = k < 0.75; P.ringA.s.setScalar(Math.max(1e-3, back(seg(k, 0, 0.16)) * (1 - sm(seg(k, 0.5, 0.7)))));
      P.ringA.r.z = X.t * 3;
      P.ringB.show = k > 0.3; P.ringB.p.copy(L).y += 0.36; P.ringB.s.setScalar(Math.max(1e-3, back(seg(k, 0.32, 0.48)) * closeAll)); P.ringB.r.z = -X.t * 3;
      const hin = seg(k, 0.16, 0.4);
      if (k < 0.45) {
        P.root.p.z += 0.5 * hin; P.root.p.y += Math.sin(PI * hin) * 0.35;
        P.root.s.multiplyScalar(1 - sm(seg(k, 0.3, 0.44)));
      } else if (k < 0.55) P.root.show = false;
      else {
        const out = seg(k, 0.55, 0.8);
        P.root.p.copy(L); P.root.p.z += 0.45 * out; P.root.p.y += Math.sin(PI * out) * 0.35;
        P.root.s.multiplyScalar(sm(seg(k, 0.55, 0.68)));
      }
      if (k > 0.4 && once(c, 'in')) X.fx.burst(c.toWorld(0, 0.36, 0.5), c.up, { n: 10, color: ['#d6fff8', CYAN], speed: 1.4, rise: 0.2, size: 0.04, life: 0.6, gravity: 0, glow: true });
      if (k > 0.56 && once(c, 'out')) X.fx.burst(c.toWorld(L.x, L.y + 0.36, L.z), c.up, { n: 10, color: ['#d6fff8', CYAN], speed: 1.4, rise: 0.2, size: 0.04, life: 0.6, gravity: 0, glow: true });
    },
  },
};

const cogGeo = merge(cyl(0.11, 0.11, 0.04, GOLD, [0, 0, 0], [0, 0, PI / 2], 14), cyl(0.035, 0.035, 0.07, '#d9643a', [0, 0, 0], [0, 0, PI / 2], 8),
  Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * PI * 2; return box([0.04, 0.035, 0.035], GOLD, [0, Math.cos(a) * 0.125, Math.sin(a) * 0.125], [a, 0, 0]); }));

const cogMouse = {
  id: 'cogMouse', name: 'cog mouse', main: '#f3ead8', size: 1.25, height: 0.12, radius: 0.3,
  gait: 'scuttle', speed: 2.0, cadence: 26, lift: 0.03, stride: 0.035, notice: 8, wary: 4.5,
  parts: {
    body: merge(ell([0.1, 0.09, 0.16], '#f3ead8', [0, 0.1, 0]), ell([0.05, 0.045, 0.07], '#f3ead8', [0, 0.08, 0.16]), ell([0.02, 0.018, 0.015], '#e88fa6', [0, 0.085, 0.23]),
      eyes(0.04, 0.13, 0.15, 0.018), both((s) => ell([0.045, 0.045, 0.012], '#e88fa6', [s * 0.06, 0.18, 0.08], [0, s * 0.4, 0]))),
    cog: { at: [0, 0.21, -0.03], geo: cogGeo },
    tail: { at: [0, 0.08, -0.15], geo: tube([[0, 0, 0], [0, 0.03, -0.15], [0.06, 0.06, -0.28], [0.1, 0.1, -0.3]], 0.01, '#e88fa6', 10, 4) },
    legsA: merge(ell([0.025, 0.02, 0.04], '#e88fa6', [-0.06, 0.02, 0.08]), ell([0.025, 0.02, 0.04], '#e88fa6', [0.06, 0.02, -0.08])),
    legsB: merge(ell([0.025, 0.02, 0.04], '#e88fa6', [0.06, 0.02, 0.08]), ell([0.025, 0.02, 0.04], '#e88fa6', [-0.06, 0.02, -0.08])),
  },
  idle(c, P) { P.cog.r.x = c.phase * 0.4; },
  trick: {
    name: 'winds its cog and whirls away like a spinning top', dur: 4.8, end: 'recover', sound: 'whirr', reach: 9,
    start(c, X) { landing(c, X, 4, 7); c.data.spin = 0; },
    pose(c, k, P, X) {
      const L = c.data.L, tilt = sm(seg(k, 0, 0.12)) * (1 - sm(seg(k, 0.85, 0.95)));
      c.data.spin += X.dt * 28 * tilt;
      P.body.s.multiplyScalar(1 - 0.3 * tilt);
      P.cog.r.set(0, 0, (PI / 2) * tilt); P.cog.p.y += 0.06 * tilt;   // the disc lies flat; the whole mouse spins
      if (tilt > 0.5) hideParts(P, 'legsA', 'legsB');
      const f = seg(k, 0.1, 0.85), rr = 0.7 * Math.sin(PI * f);
      P.root.p.copy(L).multiplyScalar(sm(f)); P.root.p.x += Math.cos(f * 14) * rr; P.root.p.z += Math.sin(f * 14) * rr;
      P.root.r.y = c.data.spin; P.root.r.x = 0.12 * tilt * Math.sin(c.data.spin * 0.13);
      const wob = seg(k, 0.82, 0.96);
      P.root.r.z = Math.sin(wob * PI * 3) * 0.4 * (1 - wob);
      if (tilt > 0.5 && Math.random() < X.dt * 40) X.fx.one(c.wpos.clone(), _v.set(0, 0, 0), c.up, { glow: true, color: '#ffb35a', size: 0.03 * c.size, life: 1.2, gravity: 0, drag: 3 });
    },
  },
};

// =================================================================== the Buried Machine
const RUST = '#b5523a', PIPE = '#8c9c98', DARK = '#3d4a4f';

const pipeBeetle = {
  id: 'pipeBeetle', name: 'pipe beetle', main: RUST, size: 1.25, height: 0.14, radius: 0.35,
  gait: 'walk', speed: 1.0, cadence: 22, lift: 0.03, stride: 0.04, notice: 8, wary: 4,
  parts: {
    body: merge(dome([0.2, 0.15, 0.24], RUST, [0, 0.08, 0], null, [12, 5]),
      [-0.14, -0.04, 0.06, 0.15].map((z) => torus(0.2 * Math.sqrt(1 - (z / 0.25) ** 2) + 0.004, 0.012, PIPE, [0, 0.08, z], null, [4, 16])),
      [-0.09, 0.02, 0.11].map((z) => ell([0.016, 0.016, 0.016], '#e9d9b8', [0, 0.08 + 0.15 * Math.sqrt(1 - (z / 0.24) ** 2), z]))),
    belly: { at: [0, 0.08, 0], hidden: true, geo: merge(dome([0.2, 0.15, 0.24], PIPE, [0, 0, 0], [PI, 0, 0], [12, 5])) },
    head: { at: [0, 0.08, 0.22], geo: merge(ell([0.08, 0.06, 0.06], DARK, [0, 0, 0.01]), ell([0.035, 0.035, 0.02], '#f3a57c', [0, 0.01, 0.06]),
      both((s) => tube([[s * 0.03, 0.04, 0.03], [s * 0.07, 0.12, 0.1], [s * 0.1, 0.13, 0.16]], 0.006, DARK, 6, 3))) },
    ...insectLegs(0.15, 0.09, [0.1, 0, -0.1], 0.28, DARK, 0.016, 0.05),
  },
  trick: {
    name: 'rolls into an armoured ball and bounces off', dur: 4.2, end: 'recover', sound: 'clank', reach: 10,
    start(c, X) { landing(c, X, 6, 10); },
    pose(c, k, P, X) {
      const L = c.data.L, curl = sm(seg(k, 0, 0.1)) * (1 - sm(seg(k, 0.9, 1)));
      shrink(P, 1 - curl, 'head', 'legsA', 'legsB');
      P.belly.show = curl > 0.01; P.belly.s.y = Math.max(1e-3, curl);
      const f = seg(k, 0.08, 0.88), B = [0, 0.42, 0.72, 1], H = [0.9, 0.45, 0.2];
      let h = 0;
      for (let j = 0; j < 3; j++) if (f >= B[j] && f <= B[j + 1]) { const u = (f - B[j]) / (B[j + 1] - B[j]); h = H[j] * 4 * u * (1 - u); }
      for (let j = 1; j < 4; j++) if (f >= B[j] && once(c, 'b' + j)) { dust(c, X, c.toWorld(L.x * B[j], L.y * B[j], L.z * B[j]), '#e8dcc0', 7, 0.06); X.fx.play('clank', c.pos, X.world.ear); }
      P.root.p.copy(L).multiplyScalar(f); P.root.p.y += h + 0.08 * curl;
      P.root.r.x = (f * L.length()) / 0.2;
    },
  },
};

const coil = (() => {
  const pts = [];
  for (let i = 0; i <= 72; i++) { const z = -0.2 + (i / 72) * 0.4, a = (i / 72) * PI * 2 * 6; pts.push([Math.cos(a) * 0.07, 0.08 + Math.sin(a) * 0.07, z]); }
  return tube(pts, 0.017, '#3f8f8a', 96, 4);
})();

const springWorm = {
  id: 'springWorm', name: 'spring worm', main: '#3f8f8a', size: 1.3, height: 0.08, radius: 0.3,
  gait: 'inch', speed: 0.6, cadence: 11, notice: 7, wary: 3.5,
  parts: {
    body: merge(coil, ell([0.055, 0.055, 0.03], '#efe3c8', [0, 0.08, -0.22])),
    head: { at: [0, 0.08, 0.23], geo: merge(ell([0.065, 0.065, 0.06], '#efe3c8', [0, 0, 0]), ell([0.03, 0.03, 0.02], '#f3a57c', [0, 0.015, 0.05]), ell([0.012, 0.012, 0.01], INK, [0, 0.015, 0.068])) },
  },
  idle(c, P, t) { P.head.p.z += Math.sin(c.phase) * 0.03 * c.moveAmt; },
  trick: {
    name: 'stretches like a slinky and flips away end over end', dur: 3.6, end: 'recover', sound: 'boing', reach: 4,
    start(c, X) { landing(c, X, 0.85, 1.1); },
    pose(c, k, P, X) {
      const L = c.data.L, D = Math.hypot(L.x, L.z), l = D / 2;
      const f = seg(k, 0.05, 0.92), i = Math.min(1, Math.floor(f * 2)), u = f * 2 - i, th = PI * sm(u);
      if (D < 0.2) { P.root.p.y += Math.sin(PI * u) * 0.3; return; }
      const piv = i * l + l / 2;
      P.root.p.set(0, (l / 2) * Math.sin(th), piv - (l / 2) * Math.cos(th));
      P.root.p.y += L.y * f;
      P.root.r.x = (i + sm(u)) * PI;
      P.root.s.z *= 1 + 0.6 * Math.sin(th);
      if (u > 0.05 && once(c, 'f' + i)) X.fx.play('boing', c.pos, X.world.ear);
    },
  },
};

// =================================================================== Viridel
const WHITE = '#f7f4ec', MINT = '#8bb7a1', PINK = '#f2a7b5';

const pyramidTortoise = {
  id: 'pyramidTortoise', name: 'pyramid tortoise', main: WHITE, size: 1.35, height: 0.18, radius: 0.4,
  gait: 'walk', speed: 0.45, cadence: 10, lift: 0.025, stride: 0.03, notice: 7, wary: 3, backoff: 1.1,
  parts: {
    shell: merge(box([0.42, 0.07, 0.5], WHITE, [0, 0.135, 0]), box([0.32, 0.07, 0.38], WHITE, [0, 0.205, 0]), box([0.22, 0.07, 0.26], WHITE, [0, 0.275, 0]),
      box([0.1, 0.05, 0.12], CYAN, [0, 0.335, 0]), box([0.43, 0.018, 0.51], CYAN, [0, 0.1, 0])),
    head: { at: [0, 0.12, 0.25], geo: merge(cyl(0.035, 0.04, 0.1, MINT, [0, 0, 0.02], [PI / 2 - 0.4, 0, 0]), ell([0.06, 0.05, 0.08], MINT, [0, 0.03, 0.08]), eyes(0.04, 0.05, 0.12, 0.014)) },
    tail: { at: [0, 0.1, -0.25], geo: cone(0.03, 0.08, MINT, [0, 0, -0.04], [-PI / 2, 0, 0]) },
    legsA: merge(cyl(0.04, 0.045, 0.12, MINT, [-0.15, 0.06, 0.17]), cyl(0.04, 0.045, 0.12, MINT, [0.15, 0.06, -0.17])),
    legsB: merge(cyl(0.04, 0.045, 0.12, MINT, [0.15, 0.06, 0.17]), cyl(0.04, 0.045, 0.12, MINT, [-0.15, 0.06, -0.17])),
    temple: { hidden: true, geo: merge([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => cyl(0.025, 0.028, 0.32, WHITE, [x * 0.16, 0.16, z * 0.19], null, 8)),
      box([0.46, 0.03, 0.56], '#e9e3d3', [0, 0.015, 0]), box([0.3, 0.03, 0.1], '#e9e3d3', [0, 0.015, 0.33]), box([0.22, 0.03, 0.07], '#e9e3d3', [0, 0.045, 0.31])) },
    lamp: { at: [0, 0.13, 0], hidden: true, glow: true, geo: ell([0.06, 0.08, 0.06], '#ffe9a0', [0, 0, 0]) },
  },
  trick: {
    name: 'its shell unfolds into a little temple', dur: 10, end: 'recover', sound: 'chime', reach: 2,
    pose(c, k, P, X) {
      const hide = sm(seg(k, 0, 0.12)) * (1 - sm(seg(k, 0.88, 1)));
      shrink(P, 1 - hide, 'head', 'legsA', 'legsB', 'tail');
      const rise = back(seg(k, 0.1, 0.3)) * (1 - sm(seg(k, 0.78, 0.9)));
      P.shell.p.y += 0.24 * rise;
      P.temple.show = rise > 0.01; P.temple.s.set(1, Math.max(1e-3, rise), 1);
      P.lamp.show = rise > 0.3; P.lamp.s.setScalar(rise * (1 + Math.sin(X.t * 3) * 0.1)); P.lamp.p.y += 0.03 * Math.sin(X.t * 2);
      if (rise > 0.6 && Math.random() < X.dt * 4) X.fx.one(c.toWorld((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3), _v.copy(c.up).multiplyScalar(0.3), c.up, { glow: true, color: '#ffe9a0', size: 0.025 * c.size, life: 2, gravity: 0, drag: 0.5 });
    },
  },
};

const petals = merge(Array.from({ length: 6 }, (_, i) => ell([0.07, 0.13, 0.025], PINK, [0, 0.11, 0.035]).rotateX(-0.25).rotateY((i / 6) * PI * 2)));

const bloomMimic = {
  id: 'bloomMimic', name: 'bloom mimic', main: PINK, size: 1.3, height: 0.15, radius: 0.35,
  gait: 'hop', speed: 1.3, cadence: 10, hopHeight: 0.1, notice: 8, wary: 4,
  parts: {
    body: merge(ell([0.14, 0.12, 0.15], WHITE, [0, 0.14, 0]), eyes(0.05, 0.18, 0.125, 0.018), both((s) => ell([0.025, 0.015, 0.01], PINK, [s * 0.08, 0.14, 0.125]))),
    petals: { at: [0, 0.22, -0.01], geo: petals },
    heart: { at: [0, 0.26, -0.01], hidden: true, glow: true, geo: ell([0.08, 0.04, 0.08], '#f2c54b', [0, 0, 0]) },
    tail: { at: [0, 0.1, -0.13], geo: merge(tube([[0, 0, 0], [0, 0.05, -0.08], [0, 0.12, -0.12]], 0.012, MINT, 6, 4), ell([0.05, 0.01, 0.03], MINT, [0.02, 0.12, -0.13])) },
    legsA: merge(both((s) => ell([0.04, 0.025, 0.05], MINT, [s * 0.08, 0.025, -0.04]))),
    legsB: merge(both((s) => ell([0.025, 0.02, 0.03], MINT, [s * 0.07, 0.03, 0.09]))),
  },
  idle(c, P, t) { P.petals.r.z = Math.sin(t * 1.5 + c.seed) * 0.05; },
  trick: {
    name: 'blossoms into a big flower and holds still', dur: 9, end: 'recover', sound: 'bloom', reach: 2,
    pose(c, k, P, X) {
      const sit = sm(seg(k, 0, 0.1)) * (1 - sm(seg(k, 0.9, 1)));
      const open = back(seg(k, 0.06, 0.25)) * (1 - sm(seg(k, 0.82, 0.95)));
      P.body.s.y *= 1 - 0.35 * sit; P.root.p.y -= 0.04 * sit;
      shrink(P, 1 - sit, 'legsA', 'legsB');
      P.petals.s.set(1 + 2.4 * open, 1 - 0.6 * open, 1 + 2.4 * open); P.petals.p.y -= 0.07 * open;
      P.petals.r.y = 0.4 * open + Math.sin(X.t * 0.8) * 0.04;
      P.heart.show = open > 0.05; P.heart.s.setScalar(Math.max(1e-3, open)); P.heart.p.y -= 0.06 * open;
      if (open > 0.7 && Math.random() < X.dt * 6) X.fx.one(c.toWorld((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4), _v.copy(c.up).multiplyScalar(0.25), c.up, { glow: true, color: '#f2c54b', size: 0.02 * c.size, life: 2.2, gravity: 0, drag: 0.3, flutter: 0.3 });
    },
  },
};

const pondSkipper = {
  id: 'pondSkipper', name: 'pond skipper', main: '#9fd6c9', size: 1.3, height: 0.08, radius: 0.3, habitat: 'shore',
  gait: 'hop', speed: 1.2, cadence: 9, hopHeight: 0.12, notice: 8, wary: 4,
  anchors: () => [{ p: new THREE.Vector3(-120, 0, -160), r: [40, 110], w: 1 }],
  parts: {
    body: merge(ell([0.15, 0.06, 0.18], '#9fd6c9', [0, 0.07, 0]), ell([0.12, 0.035, 0.15], '#e7f2e9', [0, 0.05, 0.01]),
      [[0.06, -0.06], [-0.07, -0.02], [0.02, 0.06]].map(([x, z]) => ell([0.03, 0.01, 0.03], CYAN, [x, 0.125, z])),
      both((s) => [ell([0.035, 0.035, 0.035], '#f7f4ec', [s * 0.06, 0.12, 0.1]), ell([0.018, 0.018, 0.012], INK, [s * 0.066, 0.13, 0.13])])),
    legsA: merge(both((s) => ell([0.06, 0.03, 0.08], '#9fd6c9', [s * 0.13, 0.04, -0.08]))),
    legsB: merge(both((s) => ell([0.03, 0.02, 0.04], '#9fd6c9', [s * 0.09, 0.02, 0.12]))),
  },
  trick: {
    name: 'skips across the pond like a thrown stone', dur: 3.6, end: 'gone', sound: 'skip', reach: 18,
    start(c, X) {
      if (c.water) { c.fwd.copy(c.water); c.orient(); }
      const W = X.world, p = c.toWorld(0, 0, 3 / c.size);
      const wy = W.waterAt(p.x, p.z);
      c.data.wl = Number.isFinite(wy) ? (wy - c.pos.y) / c.size : 0;
      const g = [3.5, 3, 2.4, 1.8, 1.3].map((x) => x / c.size);
      c.data.marks = g.reduce((a, x) => (a.push((a.at(-1) ?? 0) + x), a), []);
    },
    pose(c, k, P, X) {
      const { wl, marks } = c.data, n = marks.length, H = [0.7, 0.5, 0.35, 0.22, 0.12];
      P.root.s.y *= 1 - 0.5 * seg(k, 0, 0.1);
      if (k > 0.1) hideParts(P, 'legsA', 'legsB');
      const f = seg(k, 0.08, 0.9) * n, j = Math.min(n - 1, Math.floor(f)), u = f - j;
      const a = j ? marks[j - 1] : 0, b = marks[j];
      const base = j === 0 ? wl * u : wl;
      P.root.p.set(0, base + H[j] * 4 * u * (1 - u), a + (b - a) * u);
      P.root.r.y = f * 6;
      for (let i = 0; i < n; i++) if (f >= i + 1 && once(c, 's' + i)) {
        X.fx.burst(c.toWorld(0, wl + 0.02, marks[i]), c.up, { n: 9, color: ['#ffffff', '#9ad3d9'], speed: 1.2, rise: 1.6, size: 0.05 * c.size, life: 0.6, gravity: 6 });
        if (i < n - 1) X.fx.play('skip', c.pos, X.world.ear);
      }
      if (k > 0.9) { P.root.p.set(0, wl - 0.3 * seg(k, 0.9, 1), marks[n - 1]); P.root.s.multiplyScalar(1 - seg(k, 0.9, 1)); }
    },
  },
};

// =================================================================== the Garden of Spheres
const PEARL = '#f3efe4';

const sphereMimic = {
  id: 'sphereMimic', name: 'sphere mimic', main: PEARL, size: 1.4, height: 0.19, radius: 0.35,
  gait: 'walk', speed: 0.9, cadence: 16, lift: 0.03, stride: 0.04, bob: 0.02, notice: 8, wary: 4,
  parts: {
    body: { at: [0, 0.19, 0], geo: ell([0.17, 0.17, 0.17], PEARL, [0, 0, 0], null, [16, 11]) },
    face: merge(eyes(0.055, 0.24, 0.155, 0.02), both((s) => ell([0.025, 0.014, 0.01], '#f2c5b0', [s * 0.09, 0.2, 0.145]))),
    crest: { at: [0, 0.355, 0], geo: merge([-0.05, 0, 0.05].map((z, i) => ell([0.03, 0.03 + 0.012 * (i === 1), 0.03], '#f6e2a0', [0, 0.01 * (i === 1), z]))) },
    ...quad(0.07, 0.05, 0.07, -0.07, 0.09, '#d8d0bf', 0.03),
  },
  idle(c, P, t) { P.body.r.x = Math.sin(t + c.seed) * 0.05; },
  trick: {
    name: 'curls into a perfect sphere and sinks half into the grass', dur: 10, end: 'recover', sound: 'plop', reach: 2,
    pose(c, k, P, X) {
      const curl = sm(seg(k, 0, 0.1)) * (1 - sm(seg(k, 0.9, 1)));
      shrink(P, 1 - curl, 'crest', 'legsA', 'legsB', 'face');
      const peek = k > 0.6 && k < 0.64;
      if (peek) { P.face.show = true; P.face.s.setScalar(1.1); P.face.p.z += 0.045; P.face.p.y -= 0.02; }
      const sink = sm(seg(k, 0.1, 0.32)) * (1 - sm(seg(k, 0.82, 0.92)));
      P.root.p.y -= 0.21 * sink;
      P.body.s.setScalar(1 + 0.15 * curl);
      P.body.p.y -= 0.02 * curl;
      if (k > 0.12 && once(c, 'sink')) X.fx.burst(c.toWorld(0, 0.03, 0), c.up, { n: 12, color: ['#a8c48a', '#8aa86e', '#c9b48a'], speed: 1.1, rise: 1, size: 0.05 * c.size, life: 0.8, gravity: 4, flat: 1, spin: 6 });
      if (k > 0.82 && once(c, 'pop')) X.fx.burst(c.toWorld(0, 0.03, 0), c.up, { n: 8, color: ['#a8c48a', '#8aa86e'], speed: 1, rise: 1.2, size: 0.05 * c.size, life: 0.7, gravity: 4, flat: 1, spin: 6 });
    },
  },
};

const striderLegs = (side) => merge(
  leg([side * 0.04, 0.12, 0.06], [side * 0.2, 0.18, 0.12], 0.008, '#34407a'), leg([side * 0.2, 0.18, 0.12], [side * 0.32, 0, 0.22], 0.006, '#34407a'),
  leg([-side * 0.04, 0.12, -0.04], [-side * 0.22, 0.17, -0.12], 0.008, '#34407a'), leg([-side * 0.22, 0.17, -0.12], [-side * 0.36, 0, -0.3], 0.006, '#34407a'),
  torus(0.035, 0.006, PEARL, [side * 0.32, 0.004, 0.22], [PI / 2, 0, 0], [3, 12]), torus(0.035, 0.006, PEARL, [-side * 0.36, 0.004, -0.3], [PI / 2, 0, 0], [3, 12]));

const lakeStrider = {
  id: 'lakeStrider', name: 'lake strider', main: '#34407a', size: 1.45, height: 0.12, radius: 0.35, habitat: 'water', depth: 0.25,
  gait: 'walk', speed: 1.2, cadence: 10, lift: 0.04, stride: 0.06, notice: 9, wary: 5,
  anchors: () => [{ p: new THREE.Vector3(190, -0.8, -120), r: [8, 60], w: 1 }],
  parts: {
    body: merge(ell([0.05, 0.035, 0.14], '#34407a', [0, 0.12, 0]), ell([0.03, 0.012, 0.12], PEARL, [0, 0.152, 0]),
      ell([0.035, 0.03, 0.05], '#34407a', [0, 0.125, 0.15]), eyes(0.03, 0.14, 0.18, 0.012, '#f6e2a0')),
    legsA: striderLegs(-1),
    legsB: striderLegs(1),
  },
  trick: {
    name: 'its legs telescope into stilts and it strides away tall', dur: 6, end: 'recover', sound: 'creak', reach: 9,
    start(c, X) { landing(c, X, 5, 8); },
    pose(c, k, P, X) {
      const L = c.data.L, tall = back(seg(k, 0, 0.18)) * (1 - sm(seg(k, 0.85, 1)));
      const f = seg(k, 0.15, 0.85), w = Math.sin(f * 12);
      for (const [n, sgn] of [['legsA', 1], ['legsB', -1]]) {
        const q = P[n];
        q.s.set(1 + 0.8 * tall, 1 + 10 * tall, 1 + 0.8 * tall);
        q.p.z += sgn * w * 0.15 * tall; q.p.y += Math.max(0, sgn * w) * 0.1 * tall;
      }
      P.body.p.y += 1.25 * tall;
      P.root.p.copy(L).multiplyScalar(sm(f));
      if (tall > 0.5 && Math.random() < X.dt * 8) X.fx.one(c.toWorld((Math.random() - 0.5) * 0.8, 0.01, L.z * f + (Math.random() - 0.5) * 0.8), _v.set(0, 0, 0), c.up, { color: PEARL, size: 0.03 * c.size, life: 0.8, grow: 2, gravity: 0 });
    },
  },
};

// =================================================================== Lorn
const moth = merge(ell([0.05, 0.05, 0.05], '#f3efe8', [0, 0, 0]), ell([0.028, 0.028, 0.01], '#62c3c9', [0, 0, 0.045]), ell([0.014, 0.014, 0.008], INK, [0, 0, 0.052]),
  both((s) => oct([0.1, 0.008, 0.07], '#c7a6f2', [s * 0.09, 0.01, 0], [0, s * 0.3, 0])));

const eyeMoth = {
  id: 'eyeMoth', name: 'eye-moth', main: '#c7a6f2', size: 1.35, height: 0, radius: 0.4,
  gait: 'hover', hover: 1.3, flap: 14, flapAmp: 0.6, speed: 0.9, cadence: 3, notice: 9, wary: 5, turn: 3,
  parts: {
    body: merge(ell([0.1, 0.1, 0.1], '#f3efe8', [0, 0, 0], null, [12, 8]), ell([0.056, 0.056, 0.02], '#62c3c9', [0, 0, 0.088]), ell([0.028, 0.028, 0.012], INK, [0, 0, 0.1]),
      ell([0.11, 0.06, 0.08], '#7a6a86', [0, -0.04, -0.045])),
    wingL: { at: [-0.07, 0, -0.02], geo: merge(oct([0.2, 0.015, 0.13], '#c7a6f2', [-0.17, 0.02, 0], [0, 0.3, 0]), ell([0.04, 0.017, 0.04], '#7fe0d0', [-0.2, 0.03, 0])) },
    wingR: { at: [0.07, 0, -0.02], geo: merge(oct([0.2, 0.015, 0.13], '#c7a6f2', [0.17, 0.02, 0], [0, -0.3, 0]), ell([0.04, 0.017, 0.04], '#7fe0d0', [0.2, 0.03, 0])) },
    m1: { hidden: true, geo: moth }, m2: { hidden: true, geo: moth }, m3: { hidden: true, geo: moth },
  },
  trick: {
    name: 'splits into three little moths that scatter', dur: 6, end: 'gone', sound: 'pop', reach: 9,
    pose(c, k, P, X) {
      P.root.r.z += Math.sin(X.t * 60) * 0.12 * seg(k, 0, 0.12);
      if (k > 0.12) hideParts(P, 'body', 'wingL', 'wingR');
      if (k > 0.11 && once(c, 'flash')) X.fx.burst(c.center, c.up, { n: 14, color: ['#d6ff9a', '#c7a6f2', '#ffffff'], speed: 1.3, rise: 0.3, size: 0.035 * c.size, life: 0.8, gravity: 0, glow: true });
      const f = seg(k, 0.1, 1);
      ['m1', 'm2', 'm3'].forEach((n, j) => {
        if (k < 0.1) return;
        const q = P[n], a = (j * PI * 2) / 3 + 0.3;
        q.show = true;
        q.p.set(Math.sin(a) * (0.15 + f * 4.5), f * f * 5 + Math.sin(X.t * 4 + j) * 0.12, Math.cos(a) * (0.15 + f * 4.5));
        q.r.set(0, a, Math.sin(X.t * 30 + j) * 0.5);
        q.s.setScalar(1 - seg(k, 0.88, 1));
      });
    },
  },
};

const ridges = merge([-0.08, 0, 0.08].map((x) => {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const z = -0.17 + (i / 8) * 0.34, h2 = 1 - (x / 0.18) ** 2 - (z / 0.2) ** 2; pts.push([x, 0.1 * Math.sqrt(Math.max(0, h2)) + 0.006, z + 0.17]); }
  return tube(pts, 0.009, '#7fe0d0', 10, 3);
}));

const sporeShell = {
  id: 'sporeShell', name: 'spore shell', main: '#a99be0', size: 1.3, height: 0.1, radius: 0.35,
  gait: 'walk', speed: 0.6, cadence: 14, lift: 0.03, stride: 0.03, notice: 7, wary: 3.5,
  parts: {
    body: merge(dome([0.18, 0.08, 0.2], '#6a5a7e', [0, 0.08, 0], [PI, 0, 0]), eyes(0.05, 0.1, 0.18, 0.02, '#d6ff9a')),
    lid: { at: [0, 0.08, -0.17], geo: dome([0.18, 0.1, 0.2], '#a99be0', [0, 0, 0.17]) },
    ridges: { at: [0, 0.08, -0.17], glow: true, geo: ridges },
    pearl: { at: [0, 0.1, 0.02], glow: true, hidden: true, geo: ell([0.06, 0.06, 0.06], '#d6ff9a', [0, 0, 0]) },
    ...insectLegs(0.12, 0.06, [0.08, -0.08], 0.2, '#4f4466', 0.016),
  },
  idle(c, P, t) { P.lid.r.x = -(0.04 + 0.04 * Math.sin(t * 1.5 + c.seed)); P.ridges.r.x = P.lid.r.x; },
  trick: {
    name: 'pops open into a spray of glowing spores, then reforms', dur: 8.5, end: 'recover', sound: 'spores', reach: 3,
    pose(c, k, P, X) {
      const pop = back(seg(k, 0, 0.08)) * (1 - sm(seg(k, 0.85, 1)));
      P.lid.r.x = -1.4 * pop; P.ridges.r.x = P.lid.r.x;
      P.pearl.show = pop > 0.1; P.pearl.s.setScalar(Math.max(1e-3, pop));
      if (k > 0.05 && once(c, 'burst')) X.fx.burst(c.center, c.up, { n: 56, color: ['#d6ff9a', '#94ebd3', '#c7a6f2'], speed: 1.6, rise: 1.3, size: 0.028 * c.size, life: 3.4, gravity: -0.12, drag: 1.2, glow: true, flutter: 0.4 });
      P.root.s.multiplyScalar(1 - sm(seg(k, 0.08, 0.16)) * (1 - sm(seg(k, 0.74, 0.9))));
      if (k > 0.16 && k < 0.74) P.root.show = false;
      if (k > 0.6 && once(c, 'gather')) {
        for (let i = 0; i < 30; i++) {
          const p = _v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar((1 + Math.random() * 0.6) * c.size).add(c.center);
          X.fx.one(p.clone(), _w.subVectors(c.center, p).divideScalar(1.1), c.up, { glow: true, color: i % 2 ? '#d6ff9a' : '#94ebd3', size: 0.03 * c.size, life: 1.1, gravity: 0, drag: 0 });
        }
      }
    },
  },
};

// =================================================================== Lorn II
const CORAL = '#ffb38a';
const PATH2 = [[0, -10], [4, -34], [-6, -70], [-22, -108], [-15, -148], [6, -188], [21, -228], [13, -268], [-9, -304], [-23, -340], [-19, -376], [-7, -408]];

const poolFish = {
  id: 'poolFish', name: 'lantern fish', main: CORAL, size: 1.5, height: 0, radius: 0.3, habitat: 'water', depth: 0.3,
  gait: 'swim', speed: 0.8, cadence: 6, notice: 6, wary: 3, turn: 4,
  anchors: () => [...PATH2.map(([x, z]) => ({ p: new THREE.Vector3(x, 0, z), r: [2, 18], w: 1 })), { p: new THREE.Vector3(58, 0, -262), r: [4, 16], w: 2 }, { p: new THREE.Vector3(8, 0, -403), r: [0, 10], w: 2 }],
  parts: {
    body: { glow: true, geo: merge(ell([0.05, 0.06, 0.15], CORAL, [0, -0.02, 0]), ell([0.04, 0.03, 0.12], '#ffe2c8', [0, -0.05, 0.01]), oct([0.008, 0.06, 0.05], CYAN, [0, 0.05, -0.01]),
      both((s) => oct([0.04, 0.006, 0.025], CYAN, [s * 0.05, -0.03, 0.04], [0, 0, s * 0.4]))) },
    head: { at: [0, -0.02, 0.1], geo: merge(eyes(0.038, 0.012, 0.0, 0.014)) },
    tail: { at: [0, -0.02, -0.14], glow: true, geo: oct([0.008, 0.06, 0.06], CYAN, [0, 0, -0.05]) },
  },
  trick: {
    name: 'leaps from pool to pool', dur: 4.2, end: 'recover', sound: 'splash', reach: 14,
    start(c, X) {
      const W = X.world, hops = [];
      let from = c.pos.clone(), dir = c.fwd.clone();
      for (let j = 0; j < 3; j++) {
        const s = W.spotNear(c, 2, 3.4, { from, dir });
        if (!s) break;
        hops.push(c.toLocal(s.pos)); dir.subVectors(s.pos, from).normalize(); from = s.pos.clone(); c.data.to = s;
      }
      c.data.hops = hops.length ? hops : [new THREE.Vector3()];
    },
    pose(c, k, P, X) {
      const hops = c.data.hops, n = hops.length;
      const f = k * n, j = Math.min(n - 1, Math.floor(f)), u = f - j;
      const a = j ? hops[j - 1] : _w.set(0, 0, 0), b = hops[j];
      const H = 0.5 + 0.12 * a.distanceTo(b);
      P.root.p.lerpVectors(a, b, u); P.root.p.y += H * 4 * u * (1 - u) + 0.04;
      P.root.r.set(-(1 - 2 * u) * 0.9, Math.atan2(b.x - a.x, b.z - a.z), 0);
      P.tail.r.y = Math.sin(X.t * 22) * 0.5;
      for (let i = 0; i <= n; i++) if (f >= i && once(c, 'sp' + i)) {
        const at = i ? hops[i - 1] : _w.set(0, 0, 0);
        X.fx.burst(c.toWorld(at.x, at.y + 0.02, at.z), c.up, { n: 8, color: ['#ffffff', '#9ad3d9', CORAL], speed: 1, rise: 1.5, size: 0.04 * c.size, life: 0.6, gravity: 6 });
        if (i) X.fx.play('splash', c.pos, X.world.ear);
      }
    },
  },
};

const lanternGrub = {
  id: 'lanternGrub', name: 'lantern grub', main: '#d8d0ea', size: 1.35, height: 0.1, radius: 0.35,
  gait: 'inch', speed: 0.5, cadence: 10, notice: 7, wary: 3.5,
  parts: {
    body: merge([-0.12, 0, 0.12].map((z) => ell([0.09, 0.08, 0.09], '#d8d0ea', [0, 0.08, z])), [-0.06, 0.06].map((z) => torus(0.083, 0.012, '#9a92c4', [0, 0.08, z], null, [3, 14])),
      ell([0.07, 0.065, 0.07], '#d8d0ea', [0, 0.09, 0.2]), tube([[0, 0.15, 0.2], [0, 0.3, 0.22], [0, 0.36, 0.3]], 0.008, '#9a92c4', 8, 3)),
    eyes: { at: [0, 0.12, 0.26], glow: true, geo: merge(both((s) => ell([0.022, 0.03, 0.015], '#fff1c8', [s * 0.035, 0, 0]))) },
    lantern: { at: [0, 0.36, 0.33], glow: true, geo: ell([0.06, 0.07, 0.06], CORAL, [0, -0.02, 0]) },
    legsA: merge([-0.12, 0.12].map((z) => both((s) => ell([0.02, 0.02, 0.02], '#9a92c4', [s * 0.07, 0.015, z])))),
    legsB: merge(both((s) => ell([0.02, 0.02, 0.02], '#9a92c4', [s * 0.07, 0.015, 0]))),
  },
  idle(c, P, t) { P.lantern.p.x += Math.sin(t * 1.3 + c.seed) * 0.02; P.lantern.s.setScalar(1 + 0.08 * Math.sin(t * 3 + c.seed)); },
  trick: {
    name: 'flashes, goes dark and sneaks off as two blinking eyes', dur: 8.5, end: 'recover', sound: 'flash', reach: 7,
    start(c, X) { landing(c, X, 2.5, 4); },
    pose(c, k, P, X) {
      const L = c.data.L, flare = bell(k, 0, 0.1);
      P.lantern.s.multiplyScalar(1 + 2.5 * flare);
      if (k > 0.03 && once(c, 'flash')) X.fx.burst(c.toWorld(0, 0.36, 0.33), c.up, { n: 20, color: [CORAL, '#fff1c8'], speed: 2.5, rise: 0.3, size: 0.035 * c.size, life: 0.5, drag: 4, gravity: 0, glow: true });
      if (k > 0.09 && k < 0.88) {
        hideParts(P, 'body', 'legsA', 'legsB', 'lantern');
        const e = sm(seg(k, 0.15, 0.8));
        P.eyes.p.addScaledVector(L, e);
        P.eyes.p.y += Math.abs(Math.sin(e * 20)) * 0.02;
        P.eyes.s.multiplyScalar(1.7);
        if ((X.t * 1.3 + c.seed) % 1 < 0.07) P.eyes.s.y = 0.1;
      } else if (k >= 0.88) {
        P.root.p.copy(L);
        P.root.s.multiplyScalar(Math.max(0.02, sm(seg(k, 0.88, 0.98))));
      }
    },
  },
};

// =================================================================== the Signal Market
const MTEAL = '#88b4b5', BRASS = '#c99758', SLATE = '#465c65';

const signBug = {
  id: 'signBug', name: 'sign bug', main: MTEAL, size: 1.3, height: 0.14, radius: 0.35,
  gait: 'scuttle', speed: 1.1, cadence: 20, lift: 0.03, stride: 0.035, notice: 8, wary: 4,
  parts: {
    body: merge(box([0.26, 0.12, 0.34], MTEAL, [0, 0.13, 0]), dome([0.13, 0.06, 0.17], MTEAL, [0, 0.19, 0]), box([0.27, 0.02, 0.35], BRASS, [0, 0.075, 0]),
      both((s) => [ell([0.03, 0.03, 0.02], '#fff0bd', [s * 0.06, 0.16, 0.17]), ell([0.014, 0.014, 0.01], INK, [s * 0.06, 0.16, 0.188])])),
    pole: { at: [0, 0.22, -0.04], hidden: true, geo: merge(cyl(0.012, 0.012, 0.42, SLATE, [0, 0.21, 0]), box([0.38, 0.22, 0.03], SLATE, [0, 0.52, 0])) },
    sign: { at: [0, 0.22, -0.04], hidden: true, glow: true, geo: merge(box([0.33, 0.17, 0.036], '#fff0bd', [0, 0.52, 0]),
      both((s) => [box([0.035, 0.09, 0.01], '#f0a083', [0, 0.545, s * 0.02]), box([0.035, 0.028, 0.01], '#f0a083', [0, 0.465, s * 0.02])])) },
    ...insectLegs(0.13, 0.08, [0.1, 0, -0.1], 0.2, BRASS, 0.012),
  },
  trick: {
    name: 'pops up a little glowing sign and trundles off', dur: 5.5, end: 'recover', sound: 'blip', reach: 4,
    start(c, X) { landing(c, X, 3.5, 6); },
    pose(c, k, P, X) {
      const L = c.data.L, up = back(seg(k, 0, 0.14)) * (1 - sm(seg(k, 0.85, 0.97)));
      const flick = k < 0.3 && Math.floor(X.t * 14) % 5 === 0;
      for (const n of ['pole', 'sign']) {
        const q = P[n];
        q.show = up > 0.01 && !(n === 'sign' && flick);
        q.s.set(Math.max(1e-3, up), Math.max(1e-3, up), Math.max(1e-3, up));
        q.r.y = Math.sin(X.t * 3) * 0.3;
      }
      const f = seg(k, 0.15, 0.85);
      P.root.p.copy(L).multiplyScalar(sm(f));
      for (const n of ['legsA', 'legsB']) P[n].p.y += Math.max(0, Math.sin(X.t * 40 + (n === 'legsA' ? 0 : PI))) * 0.03 * bell(f, 0, 1);
    },
  },
};

const ticketFinch = {
  id: 'ticketFinch', name: 'ticket finch', main: '#b9a9c5', size: 1.25, height: 0.17, radius: 0.3,
  gait: 'hop', speed: 1.4, cadence: 12, hopHeight: 0.07, notice: 8, wary: 4.5,
  parts: {
    body: merge(ell([0.11, 0.11, 0.14], '#b9a9c5', [0, 0.15, 0]), ell([0.08, 0.08, 0.07], '#f0a083', [0, 0.13, 0.08]),
      both((s) => ell([0.03, 0.07, 0.1], '#94a9bd', [s * 0.1, 0.16, -0.02])), box([0.08, 0.012, 0.12], SLATE, [0, 0.17, -0.16], [0.35, 0, 0])),
    head: { at: [0, 0.24, 0.09], geo: merge(ell([0.07, 0.065, 0.07], '#b9a9c5', [0, 0, 0]), cone(0.018, 0.06, BRASS, [0, -0.01, 0.08], [PI / 2, 0, 0]),
      eyes(0.045, 0.015, 0.045, 0.012), ell([0.02, 0.03, 0.04], '#f0a083', [0, 0.06, -0.01])) },
    legsA: leg([-0.04, 0.06, 0], [-0.045, 0, 0.02], 0.009, BRASS),
    legsB: leg([0.04, 0.06, 0], [0.045, 0, 0.02], 0.009, BRASS),
  },
  idle(c, P, t) { P.head.r.x += Math.max(0, Math.sin(t * 3 + c.seed)) ** 6 * 0.9 * (1 - c.moveAmt); },
  trick: {
    name: 'bursts into a flurry of paper tickets', dur: 2.4, end: 'gone', sound: 'flutter', reach: 2,
    start(c, X) {
      X.fx.burst(c.center, c.up, { n: 34, color: ['#f5dfab', '#f0a083', MTEAL, '#fff6e0'], speed: 2.2, rise: 2.4, size: 0.09 * c.size, life: 3.4, gravity: 0.6, drag: 1.6, flat: 1, spin: 6, flutter: 1.2 });
    },
    pose(c, k, P, X) {
      P.root.s.multiplyScalar((1 + 0.3 * bell(k, 0, 0.08)) * (1 - sm(seg(k, 0.05, 0.12))));
      if (k > 0.12) P.root.show = false;
      if (k < 0.35 && Math.random() < X.dt * 10) X.fx.one(c.center.clone(), _v.set(Math.random() - 0.5, 1.5, Math.random() - 0.5), c.up, { color: '#f5dfab', size: 0.09 * c.size, life: 2.5, gravity: 0.6, drag: 1.4, flat: 1, spin: 5, flutter: 1 });
    },
  },
};

// =================================================================== the Atelier
const PAPER = '#f4ecd8';

const doodleMouse = {
  id: 'doodleMouse', name: 'doodle mouse', main: PAPER, size: 1.35, height: 0.1, radius: 0.3,
  gait: 'scuttle', speed: 1.3, cadence: 20, lift: 0.03, stride: 0.035, notice: 6, wary: 3,
  parts: {
    body: merge(ell([0.09, 0.08, 0.15], PAPER, [0, 0.09, 0]), [-0.06, 0.04].map((z) => torus(0.085 * Math.sqrt(1 - (z / 0.16) ** 2), 0.005, INK, [0, 0.09, z], null, [3, 14])),
      ell([0.045, 0.04, 0.06], PAPER, [0, 0.08, 0.15]), ell([0.014, 0.014, 0.014], INK, [0, 0.085, 0.21]), eyes(0.035, 0.11, 0.15, 0.012),
      both((s) => [ell([0.04, 0.04, 0.008], PAPER, [s * 0.05, 0.16, 0.08], [0, s * 0.4, 0]), torus(0.04, 0.004, INK, [s * 0.05, 0.16, 0.08], [0, s * 0.4, 0], [3, 12])])),
    tail: { at: [0, 0.07, -0.15], geo: tube([[0, 0, 0], [0.04, 0.02, -0.12], [-0.03, 0.05, -0.24], [0.02, 0.09, -0.3]], 0.005, INK, 10, 3) },
    legsA: merge(ell([0.02, 0.015, 0.03], INK, [-0.05, 0.015, 0.07]), ell([0.02, 0.015, 0.03], INK, [0.05, 0.015, -0.07])),
    legsB: merge(ell([0.02, 0.015, 0.03], INK, [0.05, 0.015, 0.07]), ell([0.02, 0.015, 0.03], INK, [-0.05, 0.015, -0.07])),
  },
  trick: {
    name: 'gets rubbed out, leaving eraser crumbs', dur: 3.2, end: 'gone', sound: 'scribble', reach: 2,
    pose(c, k, P, X) {
      P.root.p.x += Math.sin(X.t * 70) * 0.015 * seg(k, 0, 0.1);
      const e = sm(seg(k, 0.1, 0.8));
      P.root.s.x *= Math.max(0.01, 1 - e); P.root.s.y *= 1 - 0.3 * e;
      if (k > 0.1 && k < 0.8 && Math.random() < X.dt * 40) X.fx.one(c.toWorld((Math.random() - 0.5) * 0.25, 0.1, (Math.random() - 0.5) * 0.3), _v.set((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6), c.up,
        { color: Math.random() < 0.5 ? '#5a5450' : '#e8b4b0', size: 0.022 * c.size, life: 1.2, gravity: 2.5, drag: 1 });
      if (k > 0.8) P.root.show = false;
    },
  },
};

// =================================================================== per world
// Counts: about 10 to 16 creatures in each world.
const canyonX = (z) => 28 * Math.sin((z + 40) / 95);
const desertLizard = { ...puffLizard, count: 5 };

export const WILDLIFE = {
  desert: [desertLizard, { ...sandCrab, count: 5 }, { ...jerboa, count: 4 }],
  incal: [
    { ...taxiSnail, count: 6, anchors: (L) => [{ p: L.spawn.clone(), r: [9, 40], w: 3 }, { p: new THREE.Vector3(-30, 150, 150), r: [3, 22], w: 1 }] },
    { ...gecko, count: 6, anchors: (L) => [{ p: L.spawn.clone(), r: [9, 45], w: 3 }, { p: new THREE.Vector3(-30, 150, 150), r: [3, 22], w: 1 }] },
  ],
  arzach: [{ ...boneKite, count: 6 }, { ...needleWalker, count: 6 }],
  arzach2: [{ ...cairnCrab, count: 7 }, { ...cloudRay, count: 5 }],
  garage: [
    { ...portalHopper, count: 6, anchors: (L) => [{ p: L.spawn.clone(), r: [9, 45], w: 3 }, ...(L.navigationPortals ?? []).filter((p) => !p.temple).map((p) => ({ p: p.to.clone(), up: p.toUp.clone(), r: [6, 25], w: 1 }))] },
    { ...cogMouse, count: 6, anchors: (L) => [{ p: L.spawn.clone(), r: [9, 45], w: 3 }, ...(L.navigationPortals ?? []).filter((p) => !p.temple).map((p) => ({ p: p.to.clone(), up: p.toUp.clone(), r: [6, 25], w: 1 }))] },
  ],
  buried: [
    { ...pipeBeetle, count: 6, anchors: (L) => [{ p: L.spawn.clone(), r: [10, 45], w: 2 }, ...[-200, -260, -320, -380].map((z) => ({ p: new THREE.Vector3(canyonX(z), -34, z), r: [0, 14], w: 1 }))] },
    { ...springWorm, count: 6 },
  ],
  edena: [{ ...pyramidTortoise, count: 5 }, { ...bloomMimic, count: 5 }, { ...pondSkipper, count: 4 }],
  spheres: [{ ...sphereMimic, count: 7 }, { ...lakeStrider, count: 5 }],
  perdide: [{ ...eyeMoth, count: 6 }, { ...sporeShell, count: 6 }],
  perdide2: [{ ...poolFish, count: 6 }, { ...lanternGrub, count: 6, anchors: (L) => [{ p: L.spawn.clone(), r: [9, 35], w: 2 }, ...PATH2.slice(2).map(([x, z]) => ({ p: new THREE.Vector3(x, 0.45, z), r: [2, 10], w: 1 }))] }],
  bazaar: [
    { ...signBug, count: 6, anchors: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ p: new THREE.Vector3(0, 0, 80 - i * 40), r: [3, 14], w: 1 })) },
    { ...ticketFinch, count: 7, anchors: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ p: new THREE.Vector3(0, 0, 70 - i * 40), r: [3, 14], w: 1 })) },
  ],
  atelier: [{ ...doodleMouse, count: 5 }],
  // a detour (src/levels/glass-dunes.js): the desert's crabs and jerboas, come over the glass
  glassdunes: [{ ...sandCrab, count: 6 }, { ...jerboa, count: 5 }],
};

/** every species definition by id */
export const SPECIES = Object.fromEntries(Object.values(WILDLIFE).flat().map((d) => [d.id, d]));
