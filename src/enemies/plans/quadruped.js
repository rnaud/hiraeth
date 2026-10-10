import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { VerletChain } from '../../motion-kit/chain.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 6, the quadruped beast (docs/systems/procedural-animation.md §4), one rig in two archetypes
// (docs/design/enemy-roster.md, the build plan's "one quadruped plan, two skins of the rig"), each drawn to its sheets
// (references/enemy-archetypes/<id>/):
//   the horn lizard (archetype 5)   a salamander hugging the ground, three metres with its tail and its back at your
//                                   knee: four short legs sprawled out to the sides, elbows and knees out like a
//                                   crocodile's, splayed toes; a long low neck level with the back and a flat wedge of
//                                   a head whose snout grows into a curved brass horn with a flared mouth; a heavy tail
//                                   lying on the ground and coiling up into a tight spiral at its tip
//   the antler hound (archetype 20) a lean deer-like hound of shadow, 1.3 m at the shoulder on long legs, elbows back
//                                   and hocks back; a deep chest and a narrow waist, a long muzzle carried low, a
//                                   crown of branching antlers far wider than its body, smoke streaming off its back
//                                   like a mane; running, only a shadow on the ground with its crown rising out of it
// Both trot on diagonal pairs on the kit (the lizard's knees out to the sides, the hound's front knees forward and
// hocks back); the head is held steady against the body's bob; the tail (or the smoke) follows on a verlet chain
// (src/motion-kit/chain.js).

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
/** Put a chain's beads (in group space) along its points (world space). */
function placeBeads(beads, points, g) {
  g.updateMatrixWorld(true);
  _m.copy(g.matrixWorld).invert();
  beads.forEach((b, i) => { _p.lerpVectors(points[i], points[i + 1], 0.5).applyMatrix4(_m); b.position.copy(_p); });
}

/**
 * A body lofted through cross-sections along z: each [z, half-width, top y, bottom y] an ellipse (the sheet's side
 * view gives the top and bottom lines, its front view the width), closed at both ends; one geometry.
 */
function loftGeometry(sections, radial = 12) {
  const pos = [], idx = [], n = sections.length;
  for (const [z, w, top, bot] of sections) {
    const cy = (top + bot) / 2, ry = (top - bot) / 2;
    for (let k = 0; k < radial; k++) { const a = (k / radial) * Math.PI * 2; pos.push(Math.sin(a) * w, cy + Math.cos(a) * ry, z); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * radial + k, b = i * radial + ((k + 1) % radial), c = a + radial, d = b + radial;
    idx.push(a, c, b, b, c, d);
  }
  // (the end caps: a fan to each end's centre)
  for (const [i, flip] of [[0, true], [n - 1, false]]) {
    const [z, , top, bot] = sections[i], ci = pos.length / 3;
    pos.push(0, (top + bot) / 2, z);
    for (let k = 0; k < radial; k++) { const a = i * radial + k, b = i * radial + ((k + 1) % radial); idx.push(...(flip ? [ci, a, b] : [ci, b, a])); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
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
  finish(g);
  const parts = [trunk, chestM, ...spots, neck, ...beads, coil, ...legs.map((l) => l.root)];
  const tw = new THREE.Vector3(), td = new THREE.Vector3(), tip = new THREE.Vector3(), dir = new THREE.Vector3();
  let rear = 0, flat = 0, swing = 0, swell = 0, lift = 0;
  return {
    group: g, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.hide, P.belly, P.horn],
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

// --------------------------------------------------------------------------------------- the antler hound
/** A flame of smoke for the mane: a tongue rising and streaming back (x forward, y up; laid in the body's yz plane). */
const FLAME = (() => { const s = new THREE.Shape(); s.moveTo(0.12, 0); s.bezierCurveTo(0.12, 0.18, -0.05, 0.3, -0.35, 0.46); s.bezierCurveTo(-0.25, 0.32, -0.3, 0.28, -0.42, 0.3); s.bezierCurveTo(-0.5, 0.32, -0.6, 0.38, -0.8, 0.36); s.bezierCurveTo(-0.58, 0.25, -0.54, 0.18, -0.62, 0.14); s.bezierCurveTo(-0.68, 0.12, -0.78, 0.11, -0.94, 0.08); s.bezierCurveTo(-0.62, 0.02, -0.4, 0, -0.2, 0); s.lineTo(0.12, 0); return s; })();

/** A crown of branching antlers on `parent`: a beam each side sweeping out and up, tines rising off it. */
function antlerCrown(parent, props, mat, glintM) {
  const tines = [], glints = [];
  for (const s of [-1, 1]) {
    if (props.has('crescent')) {
      tines.push(tube(parent, [[s * 0.05, 0, 0], [s * 0.35, 0.18, -0.05], [s * 0.55, 0.45, 0.02], [s * 0.48, 0.72, 0.12], [s * 0.3, 0.86, 0.16]], 0.03, mat, 0.012));
      continue;
    }
    if (props.has('wire')) {
      for (let k = 0; k < 3; k++) tines.push(tube(parent, [[s * 0.05, 0, 0], [s * (0.22 + k * 0.08), 0.2 + k * 0.05, -0.04], [s * (0.18 + k * 0.17), 0.45 + k * 0.05, 0.05 * k], [s * (0.42 + k * 0.1), 0.62 - k * 0.04, -0.03], [s * (0.6 + k * 0.05), 0.55 + k * 0.1, 0.04]], 0.009, mat));
      continue;
    }
    const thick = props.has('bleached') ? 0.036 : 0.03;
    const beam = [[s * 0.04, 0, 0], [s * 0.2, 0.17, -0.07], [s * 0.4, 0.4, -0.1], [s * 0.56, 0.66, -0.06], [s * 0.66, 0.92, 0.02]];
    tines.push(tube(parent, beam, thick, mat, thick * 0.4));
    // a brow tine forward over the face, then three tines up off the beam, the last forking the top
    tines.push(tube(parent, [[s * 0.12, 0.1, -0.04], [s * 0.2, 0.2, 0.12], [s * 0.18, 0.3, 0.22]], thick * 0.7, mat, thick * 0.3));
    const curve = new THREE.CatmullRomCurve3(beam.map((p) => V(...p)));
    for (const [t, up, out] of [[0.38, 0.3, -0.06], [0.58, 0.32, 0.02], [0.78, 0.28, 0.1], [0.92, 0.22, 0.14]]) {
      const b = curve.getPoint(t);
      tines.push(tube(parent, [[b.x, b.y, b.z], [b.x + s * out * 0.5, b.y + up * 0.6, b.z + 0.06], [b.x + s * out, b.y + up, b.z + 0.1]], thick * 0.65, mat, thick * 0.25));
      if (glintM) for (let k = 0; k < 2; k++) glints.push(add(parent, new THREE.SphereGeometry(0.011, 5, 4), glintM, b.x + s * out * (0.3 + k * 0.4), b.y + up * (0.3 + k * 0.4), b.z + 0.03 + k * 0.04));
    }
    if (glintM) for (let k = 1; k < 5; k++) { const b = curve.getPoint(k / 5); glints.push(add(parent, new THREE.SphereGeometry(0.012, 5, 4), glintM, b.x, b.y + 0.01, b.z + 0.025)); }
  }
  return { tines, glints };
}

export function houndModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('hound', skin);
  const g = new THREE.Group(); g.name = skin.name;
  // its ink is drawn with a white contour, as the shade's: black on the Eclipse's dark streets it would be only a
  // hole (playtest 2026-10-08, no invisible foes: src/foe-presence.js)
  // (the Garden of Spheres' hound is inked black on its pale world, as drawn: its gold glints, halo and eyes are its light parts)
  const white = !props.has('glints');
  const inkM = M.mat('ink', P.ink, { flat: true, lineWhite: white }), rimM = M.mat('rim', P.rim, { flat: true, lineWhite: white });
  const antlerM = M.mat('antler', P.antler, { flat: true, lineWhite: white }), eyeM = M.own('eye', P.eye, { glow: 0.95 });
  const smokeM = M.mat('smoke', P.smoke, { flat: true, side: THREE.DoubleSide }), smoke2M = M.mat('smoke2', P.smoke2 ?? P.smoke, { flat: true, side: THREE.DoubleSide });
  const glintM = props.has('glints') ? M.own('glint', P.glow, { glow: 0.9 }) : null;
  const Q = quadBody(g, { name: 'hound', hipY: 1.18, hips: [0.55, -0.55], halfWidth: 0.11, feet: [0.14, 0.62, -0.68], legR: 0.046, knee: { lenA: 0.57, lenB: 0.56 }, mats: { joint: inkM, thigh: inkM, shin: inkM, foot: rimM } });
  const { body, torso, legs, rig } = Q;
  // one lean body from the breast to the rump (the sheet's side view): the deep keel of the chest behind the front
  // legs, the belly tucking up sharply to a narrow waist, the loins and haunches rising again, the back line nearly level
  const chest = pivot(torso, 0, 0.0, 0.5, 'chest');
  add(torso, loftGeometry([
    [0.86, 0.02, -0.07, -0.11], [0.8, 0.09, 0.0, -0.22], [0.68, 0.15, 0.12, -0.36], [0.5, 0.17, 0.16, -0.45], [0.3, 0.16, 0.15, -0.42],
    [0.08, 0.13, 0.12, -0.27], [-0.16, 0.11, 0.1, -0.12], [-0.38, 0.13, 0.13, -0.13], [-0.58, 0.14, 0.12, -0.18], [-0.74, 0.1, 0.07, -0.13], [-0.82, 0.03, 0.02, -0.05],
  ]), inkM);
  // the muscle of each leg: the shoulder and forearm in front, the great hams behind, thinning to the sheet's bony shins
  legs.forEach((l, i) => {
    const hind = i >= 2;
    add(l.thigh, new THREE.SphereGeometry(1, 10, 8).scale(hind ? 0.085 : 0.065, hind ? 0.26 : 0.2, hind ? 0.13 : 0.095), inkM, 0, hind ? 0.17 : 0.13, hind ? -0.02 : 0.01);
    add(l.shin, new THREE.SphereGeometry(1, 8, 6).scale(0.05, 0.16, 0.06), inkM, 0, 0.12, 0);
  });
  // the neck forward and up off the chest, deep at its root, the head carried low on it with a long muzzle
  const neck = pivot(chest, 0, 0.08, 0.2, 'neck');
  tube(neck, [[0, -0.06, -0.1], [0, 0.08, 0.08], [0, 0.17, 0.26]], 0.15, inkM, 0.075);
  const head = pivot(neck, 0, 0.18, 0.3, 'head');
  add(head, new THREE.SphereGeometry(1, 10, 8).scale(0.095, 0.1, 0.15), inkM);
  const muzzle = add(head, new THREE.ConeGeometry(0.07, 0.46, 7).rotateX(Math.PI / 2), inkM, 0, -0.06, 0.25); muzzle.rotation.x = 0.42;
  pair((s) => { const ear = add(head, new THREE.ConeGeometry(0.035, 0.14, 5), inkM, s * 0.07, 0.11, -0.04); ear.rotation.set(-0.5, 0, -s * 0.5); });
  const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.03, 8, 6), eyeM, s * 0.07, 0.02, 0.1));
  // the crown of antlers, far wider than its body (a crescent in the Eclipse, bleached driftwood in the Mangrove, a
  // tangle of wire in the Market; in the Garden of Spheres black, glinting gold, a pearl-and-gold halo caught in them)
  const crown = pivot(head, 0, 0.08, -0.03, 'antlers'); crown.scale.setScalar(1.18);   // (the sheet's crown nearly as wide as the body is long)
  const { tines } = antlerCrown(crown, props, antlerM, glintM);
  if (props.has('halo')) {
    const h = pivot(crown, 0, 0.5, 0.0, 'halo'); h.rotation.set(-0.12, 0, 0.06);
    add(h, new THREE.TorusGeometry(0.62, 0.011, 5, 48).rotateX(Math.PI / 2), M.own('halo', P.glow, { glow: 0.8 }));
    add(h, new THREE.SphereGeometry(0.04, 10, 8), M.mat('pearl', '#f2eee6'), 0.0, 0, 0.62);
    tines.push(h);
  }
  // dripping like wet ink (the Mangrove): drops hanging off its chin, neck, chest and belly
  if (props.has('drips')) {
    for (const [p, x, y, z, l] of [[head, 0, -0.1, 0.12, 0.14], [head, 0.05, -0.12, 0.3, 0.1], [neck, 0.06, 0.02, 0.12, 0.16], [neck, -0.06, 0.08, 0.2, 0.12], [chest, 0.1, -0.42, 0.0, 0.2], [chest, -0.08, -0.43, -0.12, 0.16], [torso, 0.08, -0.22, 0.05, 0.18], [torso, -0.07, -0.12, -0.2, 0.14], [torso, 0.06, -0.16, -0.5, 0.12], [crown, 0.3, 0.3, -0.06, 0.12], [crown, -0.42, 0.5, -0.08, 0.14]])
      add(p, new THREE.ConeGeometry(0.018, l, 5).rotateX(Math.PI).translate(0, -l / 2, 0), inkM, x, y, z);
  }
  // the mane: tongues of smoke streaming off its back from the withers to the rump
  const mane = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7, z = lerp(0.62, -0.62, t), size = 0.55 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.55;
    const fl = add(torso, new THREE.ShapeGeometry(FLAME).rotateY(-Math.PI / 2), i % 2 ? smoke2M : smokeM, (i % 2 ? 0.03 : -0.03), 0.12 + (i % 2 ? 0.07 : 0) + Math.sin(Math.PI * t) * 0.05, z);
    fl.scale.setScalar(size * (i % 2 ? 0.85 : 1));   // (the second smoke riding higher among the first)
    fl.userData.yaw = (i % 2 ? 1 : -1) * (0.18 + (i % 3) * 0.08);
    mane.push(fl);
  }
  // a thin long tail hanging behind
  tube(torso, [[0, 0.04, -0.76], [0, -0.08, -0.92], [0, -0.34, -1.02], [0, -0.6, -1.04]], 0.028, inkM, 0.008);
  // its shadow form: a ragged pool of shadow on the ground with its head and crown rising out of it, the eyes over the rim
  const poolShape = new THREE.Shape(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = 0.55 * (1 + (i % 2 ? 0.18 : -0.05) + Math.sin(i * 2.3) * 0.08); poolShape[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r); }
  const pool = add(g, new THREE.ShapeGeometry(poolShape).scale(0.9, 1.6, 1).rotateX(-Math.PI / 2), inkM, 0, 0.03, 0);
  const glowRim = add(g, new THREE.RingGeometry(0.62, 0.72, 24).scale(0.9, 1.6, 1).rotateX(-Math.PI / 2), M.own('glow', P.glow, { glow: 0.8, side: THREE.DoubleSide }), 0, 0.04, 0);
  const rising = pivot(g, 0, 0, 0.35, 'rising');
  add(rising, new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.13, 0.14, 0.2), inkM);
  const risingCrown = pivot(rising, 0, 0.1, -0.03); risingCrown.scale.setScalar(0.85);
  antlerCrown(risingCrown, props, antlerM, glintM);
  const poolEyes = pair((s) => add(rising, new THREE.SphereGeometry(0.045, 8, 6).scale(1, 0.6, 1), eyeM, s * 0.08, 0.07, 0.15));
  finish(g);
  let solid = 1, crouch = 0, rake = 0;
  return {
    group: g, body, rig, parts: [], mane, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, shadowy: true, tones: [P.ink, P.rim, P.antler],
    tell: (id) => (id === 'rake' ? tines[0] : head),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // stepping through the shadow (its 'step'): it sinks into its own pool as it winds up, nothing drawn behind you
      const sinking = wind && f.atk?.blink;
      // lying in wait (calm, unprovoked): only its shadow under a tree, until it stands up to watch you
      const lying = f.state === 'idle' && !f.provoked && !f.watcher;
      solid = ease(solid, f.phased || sinking || lying ? 0 : 1, f.phased || sinking || lying ? 6 : 14, dt);
      body.visible = solid > 0.08; body.scale.set(1, Math.max(0.05, solid), 1);
      pool.visible = solid < 0.9; pool.scale.setScalar(1.2 - solid * 0.5);
      glowRim.visible = rising.visible = solid < 0.6;
      rising.position.y = -0.12 + (1 - solid) * 0.12 + Math.sin(c.now / 140) * 0.015;
      glowRim.scale.setScalar(1 + Math.sin(c.now / 200) * 0.06);
      // the pounce: crouched low, the head down by the ground, the antlers dipped forward, the shoulders bunched
      crouch = ease(crouch, id === 'pounce' && wind ? c.wind : 0, 10, dt);
      rake = ease(rake, id === 'rake' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, 12, dt);
      const leap = strike && f.atk?.lunge ? Math.min(1, Math.sin(Math.PI * Math.min(1, f.k * 1.4)) * 3) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: leap });
      body.position.set(o.x, -(1 - solid) * 0.3 + o.y - crouch * 0.2, o.z);
      body.rotation.set(o.pitch + crouch * 0.12, o.yaw + rake * (strike ? -0.5 : 0.25), o.roll);
      chest.scale.set(1 + crouch * 0.12, 1 - crouch * 0.06, 1);
      neck.rotation.x = crouch * 1.0 + rake * 0.7 - o.pitch * 0.6;
      neck.rotation.z = rake * 0.45;
      head.rotation.x = crouch * 0.25 + rake * 0.25 + (strike && id === 'bite' ? -0.4 * Math.sin(Math.PI * f.k) : 0);
      g.position.y += leap ? Math.sin(Math.PI * f.k) * 0.5 : 0;
      rig.visible = body.visible;
      rig.write();
      // the mane streams back off its back, flickering, flattened by its speed
      const run = c.moving ? Math.min(1, (f.def.speed ?? 5) / 5) : 0;
      mane.forEach((m, i) => { m.rotation.set(Math.sin(c.now / 260 + i * 0.9) * 0.1 - run * 0.3 - crouch * 0.2, m.userData.yaw + Math.sin(c.now / 330 + i) * 0.08, 0); m.scale.y = m.scale.x * (1 + Math.sin(c.now / 180 + i * 1.7) * 0.1); });
      eyeM.uniforms.uColor.value.set(eyeColor(f, f.lit > 0 ? '#ffe2a8' : P.eye, '#ff6a8a'));
      if (solid > 0.5 && Math.random() < (props.has('drips') ? 0.25 : 0.12)) c.drip(f, P.ink);
    },
    dispose: M.dispose,
  };
}
