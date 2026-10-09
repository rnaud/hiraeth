import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tube, pivot, pair, ease, eyeColor, finish, V } from './kit.js';

// Plan 2, the tiny skitterers (docs/systems/procedural-animation.md §4): the skitter swarm (docs/design/enemy-roster.md,
// archetype 2), drawn to its sheets (references/enemy-archetypes/skitter/: sheet-1 the Desert's dune skitters, sheet-2
// the Moon Foundry's furnace beetles). One skitter: a smooth round dome half a metre long, six short hooked legs whose
// knees rise above the dome, pointed feet; two tiny black eyes at the front rim with a glint each, two short feelers.
// A flock of eight: from afar a moving speckle of humps along the ground (the sheet's silhouette).
//
// Each member steps a quick tripod on the kit at the mid tier at most (its planner every second frame), out of step with
// the next, so a flock running reads as a ripple; a light body on fast springs that twitches.
//
// Its attacks read from the body alone (src/telegraph.js):
//   rush   it rears up on its back legs, front legs raised, and clicks; then darts in
//   pile   (its flock climbs onto it: Foes.pile) braced wide under the heap, which wobbles as it grows; then topples
// A skitter in a heap (f.riding) is lifted by its place in it, its legs gripping the one under it.

const K = 1.3;   // (the sheet's silhouette: a dome to the traveller's knee; the prompt's fist would not read)

export function skitterModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('skitter', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const shell = pivot(body, 0, 0.07 * K, 0, 'shell');
  const domeM = M.mat('dome', P.dome, { color2: P.dome2 }), legM = M.mat('leg', P.leg), jointM = M.mat('joint', P.joint), darkM = M.mat('dark', P.dark, { flat: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.2 }), glintM = M.own('glint', P.glint, { glow: 0.9 });
  // the dome: smooth, round, a little longer than it is wide, its rim close to the ground
  const DOME = Array.from({ length: 12 }, (_, i) => { const t = i / 11, a = t * Math.PI / 2; return new THREE.Vector2(Math.max(0.001, Math.cos(a) * 0.25 * K), Math.sin(a) * 0.3 * K); });
  const dome = add(shell, new THREE.LatheGeometry(DOME, 22), domeM);
  dome.scale.set(1, 1, 1.22);
  const under = add(shell, new THREE.CircleGeometry(0.245 * K, 20).rotateX(Math.PI / 2), M.mat('under', P.band), 0, 0.002, 0); under.scale.set(1, 1.22, 1);
  // the seam (the furnace beetles', the ash grubs'): a glowing crack down its back, front to tail
  let seamM = null;
  if (props.has('seam')) {
    seamM = M.own('seam', P.seam, { glow: 0.9 });
    const arc = Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI; return [0, Math.sin(a) * 0.3 * K, Math.cos(a) * 0.3 * K]; });
    tube(shell, arc, 0.032 * K, seamM);
  }
  // two tiny eyes at the front rim, a glint in each; two short feelers forward
  const eyes = pair((s) => { const e = add(shell, new THREE.SphereGeometry(0.022 * K, 8, 6), eyeM, s * 0.075 * K, 0.035 * K, 0.295 * K); add(shell, new THREE.SphereGeometry(0.009 * K, 5, 4), glintM, s * 0.08 * K, 0.044 * K, 0.315 * K); return e; });
  const feelers = pair((s) => { const p = pivot(shell, s * 0.06 * K, 0.03 * K, 0.29 * K, 'feeler'); tube(p, [[0, 0, 0], [s * 0.02, -0.03, 0.07], [s * 0.05, -0.06, 0.15], [s * 0.09, -0.07, 0.2]].map((q) => q.map((x) => x * K)), 0.0045 * K, legM); return p; });
  // six short hooked legs from under the rim, the knees rising above the dome, pointed ivory feet; a tripod on the kit
  const legs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = (0.17 - k * 0.17) * K;
    const leg = planLeg(PLANS.skitterers, { group: g, body, hipParent: shell, hip: { x: s * 0.22 * K, y: 0.02 * K, z }, foot: { x: s * 0.42 * K, z: z * 1.6 + 0.02 }, pole: { x: s * 0.6, y: 1.4, z: z * 0.4 }, radius: 0.023 * K, pad: 'point', mats: { joint: jointM, thigh: legM, shin: legM, foot: legM }, name: `skitter leg ${legs.length}` });
    tube(leg.foot, [[0, 0.05 * K, 0], [s * 0.012 * K, 0.02 * K, 0.01 * K], [-s * 0.008 * K, 0, 0.012 * K]], 0.012 * K, legM, 0.003);   // (the hook)
    legs.push(leg);
  }
  const rig = new Rig({ plan: PLANS.skitterers, group: g, body, legs });
  finish(g);
  const parts = [dome, under, ...eyes, ...feelers, ...legs.map((l) => l.root)];
  let rear = 0, climb = 0, front = 0;
  const L = rig.length;
  return {
    group: g, body: shell, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.dome, P.band, P.leg],
    tell: (id) => (id === 'pile' ? dome : eyes[1]),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the rush: up on its back legs, the front pair raised and pawing, clicking
      rear = ease(rear, id === 'rush' && wind ? c.wind : 0, 14, dt);
      front = ease(front, rear > 0.3 ? 1 : 0, 12, dt);
      for (const i of [0, 3]) { legs[i].lift = front; legs[i].air.set(0, 0.2 + Math.sin(c.now / 45 + i) * 0.03 * front, 0.1); }
      // in a heap: climbing onto the one under it, lifted by its place in the heap, legs gripping (hanging from it)
      const R = f.riding;
      climb = ease(climb, R ? R.climb : 0, 10, dt);
      const level = R ? (0.2 + R.i * 0.17) * K : 0;
      const wob = R || (id === 'pile' && wind) ? Math.sin(c.now / 110 + (R?.i ?? 0) * 1.9) * 0.08 * (R ? 1 : c.wind) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: climb > 0.15 ? 1.3 : 0 });
      shell.position.set(o.x + wob * 0.3, 0.13 * K + o.y + climb * level, o.z + (R ? (R.i % 2 ? 0.06 : -0.06) * climb : 0));
      shell.rotation.set(o.pitch + (R ? 0.2 * climb : 0), o.yaw, o.roll + wob);
      feelers.forEach((p, i) => { p.rotation.set(Math.sin(c.now / 90 + i * 2) * (0.15 + rear * 0.4) - rear * 0.5, 0, 0); });
      rig.write();
      if (seamM) seamM.uniforms.uGlow.value = 0.75 + Math.sin(c.now / 260 + f.home.x) * 0.15 + (wind ? 0.2 : 0);
      if (props.has('dust') && f.flash > 0.7 && Math.random() < 0.6) c.spray(f.chest, [P.dome, P.dome2], 3, 1.2, -0.5);   // (the spore mites puff when cut)
      if (strike && id === 'rush' && Math.random() < 0.5) c.dust(f.pos, P.dome2, 1, 0.2 * L);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}
