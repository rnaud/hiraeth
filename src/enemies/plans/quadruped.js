import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { VerletChain } from '../../motion-kit/chain.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';
import { gazePart } from '../gaze.js';

// Plan 6, the quadruped beast (docs/systems/procedural-animation.md §4), drawn to its sheets
// (references/enemy-archetypes/<id>/). The plan's other archetype, the hound, is plans/hound-tripo.js since issue #800 (the
// broad-pawed Tripo hound; the antler hound drawn here before it is in the history, 192711a63):
//   the horn lizard (archetype 5)   a salamander hugging the ground, three metres with its tail and its back at your
//                                   knee: four short legs sprawled out to the sides, elbows and knees out like a
//                                   crocodile's, splayed toes; a long low neck level with the back and a flat wedge of
//                                   a head whose snout grows into a curved brass horn with a flared mouth; a heavy tail
//                                   lying on the ground and coiling up into a tight spiral at its tip
// It trots on diagonal pairs on the kit (its knees out to the sides); the head is held steady against the body's bob;
// the tail follows on a verlet chain (src/motion-kit/chain.js).

const _p = new THREE.Vector3(), _m = new THREE.Matrix4();

/**
 * The shared body: a torso pivot riding on four kit legs, a neck and a head pivot (stabilised), a tail chain drawn
 * as linked beads. spec: { hipY, hips: [front z, hind z], halfWidth, feet: [x, front z, hind z], legR, mats,
 * pole(s, front) (optional: where the knees point, body frame; the plan's rule otherwise), knee (optional: the thigh's
 * and shin's shares of the hip-to-foot distance, a straighter or more bent leg than the plan's) }
 */
function quadBody(g, spec) {
  const plan = spec.knee ? { ...PLANS.quadruped, knee: { ...PLANS.quadruped.knee, ...spec.knee } } : PLANS.quadruped;
  const body = pivot(g, 0, 0, 0, 'body');
  const torso = pivot(body, 0, spec.hipY, 0, 'torso');
  const legs = [];
  for (const z of spec.hips) for (const s of [-1, 1]) {
    const front = z > 0;
    legs.push(planLeg(plan, { group: g, body, hipParent: torso, hip: { x: s * spec.halfWidth, y: -0.04, z }, foot: { x: s * spec.feet[0], z: front ? spec.feet[1] : spec.feet[2] },
      pole: spec.pole?.(s, front), radius: spec.legR, pad: 'pad', mats: spec.mats, name: `${spec.name} leg ${legs.length}` }));
  }
  const rig = new Rig({ plan, group: g, body, legs });
  return { body, torso, legs, rig };
}

/** A chain drawn as beads (spheres) between its points, sized from r0 to r1 (group frame). */
function chainBeads(parent, n, r0, r1, mat) {
  return Array.from({ length: n }, () => add(parent, new THREE.SphereGeometry(1, 10, 8), mat, 0, 0, 0)).map((m, i) => { m.scale.setScalar(lerp(r0, r1, i / Math.max(1, n - 1))); return m; });
}
/**
 * Put a chain's beads (in group space) along its points (world space). Each point is kept on the ground first (the
 * root's frame is the ground's plane: y 0, src/enemies/slope.js), as high as its bead is thick: a tail lying along the
 * ground lies on it, never through it (the lizard's went 6 cm under on flat ground, 22 on a slope: issue #332).
 */
function placeBeads(beads, points, g) {
  g.updateMatrixWorld(true);
  _m.copy(g.matrixWorld).invert();
  for (let i = 0; i < points.length; i++) {
    const r = beads[Math.min(i, beads.length - 1)].scale.y;
    _p.copy(points[i]).applyMatrix4(_m);
    if (_p.y < r) { _p.y = r; points[i].copy(_p.applyMatrix4(g.matrixWorld)); }
  }
  beads.forEach((b, i) => { _p.lerpVectors(points[i], points[i + 1], 0.5).applyMatrix4(_m); b.position.copy(_p); });
}

// --------------------------------------------------------------------------------------- the horn lizard
/** The tail's tip: a tight spiral rising off the ground in the plane of the tail (local +z along it, +y up). */
function spiralPoints(r0, turns = 1.15, n = 22) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, a = t * turns * Math.PI * 2, r = r0 * (1 - 0.78 * t);
    return [0, r0 - r * Math.cos(a), r * Math.sin(a)];
  });
}

export function lizardModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('lizard', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const hideM = M.mat('hide', P.hide, { color2: P.hide2 }), bellyM = M.mat('belly', P.belly), darkM = M.mat('dark', P.dark, { flat: true });
  const spotM = M.mat('spot', P.accent, { flat: true }), verdM = M.mat('verd', P.verd, { flat: true });
  const hornM = M.own('horn', P.horn, { glow: props.has('hot') ? 0.35 : 0.05 }), eyeM = M.own('eye', P.eye, { glow: props.has('glow') ? 0.95 : 0.7 });
  // four short legs sprawled out to the sides: elbows back and out, knees forward and out, like a crocodile's
  const Q = quadBody(g, { name: 'lizard', hipY: 0.3, hips: [0.36, -0.38], halfWidth: 0.26, feet: [0.68, 0.46, -0.34], legR: 0.075,
    pole: (s, front) => ({ x: s * 1.6, y: 0.8, z: front ? -0.5 : 0.5 }), mats: { joint: hideM, thigh: hideM, shin: hideM, foot: hideM } });
  const { body, torso, legs, rig } = Q;
  // four splayed toes on each foot, fanned forward and out
  legs.forEach((l, i) => { const s = i % 2 ? 1 : -1; for (let k = 0; k < 4; k++) { const a = s * (-0.35 + k * 0.42) + (i < 2 ? 0 : s * 0.25); const toe = add(l.foot, new THREE.ConeGeometry(0.03, 0.15, 5).rotateX(Math.PI / 2).translate(0, 0, 0.07), hideM, 0, 0.02, 0.02); toe.rotation.y = a; } });
  // the torso: long and low, the belly almost on the ground: a mottled back over ivory belly plates
  const chest = pivot(torso, 0, 0.0, 0.4, 'chest');
  const trunk = add(torso, new THREE.SphereGeometry(1, 20, 12).scale(0.36, 0.23, 0.68), hideM, 0, 0.0, -0.08);
  const chestM = add(chest, new THREE.SphereGeometry(1, 16, 10).scale(0.32, 0.21, 0.32), hideM);
  add(torso, new THREE.SphereGeometry(1, 16, 8).scale(0.33, 0.14, 0.72), bellyM, 0, -0.08, -0.04);
  add(chest, new THREE.SphereGeometry(1, 12, 8).scale(0.28, 0.13, 0.3), bellyM, 0, -0.08, 0);
  // the throat sac under the neck: it swells into a great ivory balloon as it blares
  const sac = pivot(chest, 0, -0.04, 0.2, 'sac');
  add(sac, new THREE.SphereGeometry(1, 16, 12).scale(0.17, 0.12, 0.17), bellyM, 0, 0, 0);
  // the mottled bands: dark blotches down the back in two rows, and a line down the spine
  const spots = [];
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const z = 0.52 - i * 0.14, w = 0.19 * Math.sqrt(Math.max(0, 1 - ((z + 0.08) / 0.75) ** 2)); const y = 0.225 * Math.sqrt(Math.max(0, 1 - (w / 0.36) ** 2 - ((z + 0.08) / 0.68) ** 2)) - 0.005;
    const sp = add(torso, new THREE.SphereGeometry(1, 8, 4).scale(0.05 + (i % 3) * 0.012, 0.012, 0.045), spotM, s * w, Math.max(0.06, y), z); sp.rotation.z = s * 0.45; spots.push(sp); }
  spots.push(tube(torso, [[0, 0.21, 0.42], [0, 0.232, 0], [0, 0.205, -0.45]], 0.013, spotM));
  // the neck, long and low, stretched forward level with the back; a flat wedge of a head
  const neck = pivot(chest, 0, 0.02, 0.24, 'neck');
  tube(neck, [[0, 0, -0.02], [0, 0.0, 0.14], [0, 0.0, 0.3]], 0.17, hideM, 0.13);
  add(neck, new THREE.SphereGeometry(1, 10, 6).scale(0.14, 0.09, 0.18), bellyM, 0, -0.06, 0.16);
  const head = pivot(neck, 0, 0.0, 0.32, 'head');
  add(head, new THREE.SphereGeometry(1, 14, 10).scale(0.19, 0.1, 0.25), hideM, 0, 0.0, 0.08);
  add(head, new THREE.SphereGeometry(1, 10, 6).scale(0.15, 0.055, 0.2), bellyM, 0, -0.05, 0.09);
  tube(head, [[0, 0.01, 0.2], [0, 0.0, 0.3], [0, -0.005, 0.38]], 0.09, hideM, 0.06);
  // (its long mouth: a dark line each side of the wedge)
  pair((s) => tube(head, [[s * 0.16, -0.03, -0.02], [s * 0.13, -0.035, 0.15], [s * 0.06, -0.025, 0.33]], 0.007, darkM));
  const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.03, 8, 6), eyeM, s * 0.13, 0.065, 0.1));
  pair((s) => add(head, new THREE.SphereGeometry(1, 8, 6).scale(0.04, 0.02, 0.045), hideM, s * 0.13, 0.085, 0.1));   // (heavy lids)
  // the horn: the snout itself grows into a narrow brass horn fused to the skull, verdigris at the seam, curving a
  // little up to a small flared mouth
  const horn = pivot(head, 0, -0.005, 0.38, 'horn');
  add(horn, new THREE.TorusGeometry(0.062, 0.018, 6, 14), verdM, 0, 0, 0.0);
  tube(horn, [[0, 0, 0], [0, 0.008, 0.12], [0, 0.03, 0.24], [0, 0.07, 0.34]], 0.055, hornM, 0.04);
  add(horn, new THREE.TorusGeometry(0.036, 0.008, 5, 12).rotateX(-0.2), verdM, 0, 0.022, 0.2);
  const bell = pivot(horn, 0, 0.075, 0.345, 'bell');
  bell.rotation.x = -0.42;
  add(bell, new THREE.CylinderGeometry(0.13, 0.04, 0.16, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.07), M.mat('bellIn', P.horn, { side: THREE.DoubleSide }));
  add(bell, new THREE.TorusGeometry(0.13, 0.016, 6, 18), hornM, 0, 0, 0.155);
  const mouth = pivot(bell, 0, 0, 0.17);   // (where the blare's glow gathers)
  // the coin lizard's coins: little pierced coins hung on strings under the horn, swinging as it walks
  const coins = [];
  if (props.has('coins')) for (let i = 0; i < 5; i++) {
    const z = 0.06 + i * 0.07, y = 0.02 * i * i * 0.3;
    const hang = pivot(horn, (i % 2 ? 1 : -1) * 0.02, y - 0.03, z); coins.push(hang);
    rod(hang, [0, 0, 0], [0, -0.07 - (i % 3) * 0.03, 0], 0.003, darkM);
    add(hang, new THREE.CylinderGeometry(0.03, 0.03, 0.007, 12).rotateZ(Math.PI / 2), hornM, 0, -0.1 - (i % 3) * 0.03, 0);
  }
  // the coin lizard's wind-up key on its back (a clockwork toy of the market)
  if (props.has('key')) { const k = pivot(torso, 0, 0.16, -0.25, 'key'); rod(k, [0, 0, 0], [0, 0.12, 0], 0.018, hornM); for (const s of [-1, 1]) add(k, new THREE.TorusGeometry(0.045, 0.014, 6, 12), hornM, s * 0.05, 0.16, 0); spots.push(k); }
  // the tail: heavy, lying along the ground on a verlet chain, and its tip coiled up into a tight spiral
  const tailRoot = pivot(torso, 0, -0.03, -0.72, 'tail root');
  const tail = new VerletChain({ n: 13, length: 0.085, stiffness: 0.35, damping: 0.8, gravity: 0.6, curl: 0.028 });
  const beads = chainBeads(g, 13, 0.2, 0.075, hideM);
  const coil = new THREE.Group(); coil.name = 'tail coil'; g.add(coil);
  tube(coil, spiralPoints(0.21), 0.072, hideM, 0.016);
  const soot = props.has('soot');
  // its eyes on you once it has noticed you, on its way before (src/enemies/gaze.js, issue #508)
  const gaze = [gazePart(g, head, { mode: 'turn', yaw: 0.55, up: 0.3, down: 0.35 })];   // (the head turns: its eyes are fixed on it)
  finish(g);
  const parts = [trunk, chestM, ...spots, neck, ...beads, coil, ...legs.map((l) => l.root)];
  const tw = new THREE.Vector3(), td = new THREE.Vector3(), tip = new THREE.Vector3(), dir = new THREE.Vector3();
  let rear = 0, flat = 0, swing = 0, swell = 0, lift = 0;
  return {
    group: g, gaze, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.hide, P.belly, P.horn],
    tell: (id) => (id === 'blare' ? mouth : id === 'whip' ? beads[8] : head),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the blare: it lifts its front half off the ground, the throat sac swelling, the horn's mouth glowing; the
      // bite: flat to the ground, tail rigid; the whip: its hips swing out the other way first, then the tail sweeps
      const blare = id === 'blare' ? (wind ? c.wind : strike ? 1 - c.release * 0.4 : 0) : 0;
      const bite = id === 'bite' ? (wind ? c.wind : 0) : 0;
      const whip = id === 'whip' ? (wind ? -c.wind * 0.55 : strike ? lerp(-0.55, 1.1, c.release) : 0) : 0;
      rear = ease(rear, blare, 9, dt); flat = ease(flat, bite, 10, dt); swing = ease(swing, whip, strike ? 18 : 8, dt);
      swell = ease(swell, blare + (f.state === 'idle' && !f.provoked ? Math.max(0, Math.sin(c.now / 900 + f.home.x)) * 0.25 : 0), 6, dt);
      // the front legs leave the ground as it rears (they hang from the chest), and come back to their spots
      lift = ease(lift, rear > 0.25 ? 1 : 0, 8, dt);
      legs[0].lift = legs[1].lift = lift;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: strike && id === 'bite' ? Math.min(1, Math.sin(Math.PI * Math.min(1, f.k * 1.3)) * 2) : 0 });
      // (it rears about its hind hips: the back end stays on the ground as the front lifts)
      body.position.set(o.x, o.y - flat * 0.1 + rear * 0.27, o.z - rear * 0.08);
      body.rotation.set(o.pitch - rear * 0.62 + flat * 0.03, o.yaw + swing * 0.45, o.roll);
      chest.scale.setScalar(1 + swell * 0.12);
      sac.scale.set(1 + swell * 1.3, 1 + swell * 1.9, 1 + swell * 1.2);
      sac.position.y = -0.04 - swell * 0.12;
      // the head stays steady against the body's bob and pitch; rearing, it points the horn up
      neck.rotation.x = -rear * 0.25 - flat * 0.1 - o.pitch * 0.6;
      head.rotation.x = -rear * 0.15 + flat * 0.12 + (strike && id === 'bite' ? -0.3 : 0);
      head.rotation.y = -swing * 0.3;
      hornM.uniforms.uGlow.value = (props.has('hot') ? 0.35 : 0.05) + rear * 0.9;
      rig.write();
      // the tail: rooted at the hips, lying along the ground behind it; rigid as it crouches to bite, swept by the whip
      tailRoot.getWorldPosition(tw);
      const yaw = f.heading + swing * 1.6;
      td.set(-Math.sin(yaw), -0.32, -Math.cos(yaw));
      const pts = tail.update(dt, tw, td, bite > 0.2 ? 0.9 : id === 'whip' && strike ? 0.75 : 0.35);
      placeBeads(beads, pts, g);
      // the coil rides on the tail's tip, turned along its last link
      g.updateMatrixWorld(true); _m.copy(g.matrixWorld).invert();
      tip.copy(pts[pts.length - 1]).applyMatrix4(_m); dir.copy(pts[pts.length - 2]).applyMatrix4(_m);
      coil.position.copy(tip); coil.rotation.set(0, Math.atan2(tip.x - dir.x, tip.z - dir.z), 0);
      coil.scale.setScalar(1 + bite * 0.15);
      coins.forEach((x, i) => { x.rotation.x = Math.sin(c.now / 140 + i * 1.7) * (c.moving ? 0.5 : 0.15); x.rotation.z = Math.sin(c.now / 190 + i) * 0.2; });
      if (soot && (c.moving || rear > 0.5) && Math.random() < 0.1) c.spray(V().copy(f.chest), [P.horn, P.dark], 1, 0.8, -1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}
