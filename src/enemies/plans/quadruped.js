import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { VerletChain } from '../../motion-kit/chain.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 6, the quadruped beast (docs/systems/procedural-animation.md §4), one rig in two archetypes
// (docs/design/enemy-roster.md, the build plan's "one quadruped plan, two skins of the rig"):
//   the horn lizard (archetype 5)   long and low, a long neck, a brass trumpet for a snout, a curled tail on a chain:
//                                   from far off, a curl with a horn
//   the antler hound (archetype 20) lean and tall on long legs, hocks back, a crown of antlers wider than its body,
//                                   smoke on its back on a chain; running, only a shadow on the ground
// Both trot on diagonal pairs on the kit, front knees forward and hocks back; the head is held steady against the
// body's bob; the tail (or the smoke) follows on a verlet chain (src/motion-kit/chain.js).
// Art match pending their sheets (docs/design/enemy-roster-prompts.md, `lizard`, `hound`).

const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

/**
 * The shared body: a torso pivot riding on four kit legs, a neck and a head pivot (stabilised), a tail chain drawn
 * as linked beads. spec: { hipY, hips: [front z, hind z], halfWidth, feet: [x, front z, hind z], legR, mats, chain }
 */
function quadBody(g, spec) {
  const body = pivot(g, 0, 0, 0, 'body');
  const torso = pivot(body, 0, spec.hipY, 0, 'torso');
  const legs = [];
  for (const z of spec.hips) for (const s of [-1, 1]) {
    const front = z > 0;
    legs.push(planLeg(PLANS.quadruped, { group: g, body, hipParent: torso, hip: { x: s * spec.halfWidth, y: -0.04, z }, foot: { x: s * spec.feet[0], z: front ? spec.feet[1] : spec.feet[2] },
      radius: spec.legR, pad: 'pad', mats: spec.mats, name: `${spec.name} leg ${legs.length}` }));
  }
  const rig = new Rig({ plan: PLANS.quadruped, group: g, body, legs });
  return { body, torso, legs, rig };
}

/** A chain drawn as beads (spheres) between its points, sized from r0 to r1 (group frame). */
function chainBeads(parent, n, r0, r1, mat) {
  return Array.from({ length: n }, (_, i) => add(parent, new THREE.SphereGeometry(1, 8, 6), mat, 0, 0, 0)).map((m, i) => { m.scale.setScalar(lerp(r0, r1, i / Math.max(1, n - 1))); return m; });
}
/** Put a chain's beads (in group space) along its points (world space). */
function placeBeads(beads, points, g) {
  g.updateMatrixWorld(true);
  _m.copy(g.matrixWorld).invert();
  beads.forEach((b, i) => { _p.lerpVectors(points[i], points[i + 1], 0.5).applyMatrix4(_m); b.position.copy(_p); });
}

// --------------------------------------------------------------------------------------- the horn lizard
export function lizardModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('lizard', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  const hideM = M.mat('hide', P.hide, { color2: P.hide2 }), bellyM = M.mat('belly', P.belly), darkM = M.mat('dark', P.dark, { flat: true });
  const hornM = M.own('horn', P.horn, { glow: props.has('hot') ? 0.35 : 0.05 }), eyeM = M.own('eye', P.eye, { glow: props.has('glow') ? 0.95 : 0.7 });
  const Q = quadBody(g, { name: 'lizard', hipY: 0.52, hips: [0.42, -0.4], halfWidth: 0.24, feet: [0.42, 0.52, -0.5], legR: 0.05, mats: { joint: hideM, thigh: hideM, shin: hideM, foot: darkM } });
  const { body, torso, legs, rig } = Q;
  // the torso: long and low, scales on the back, an ivory belly
  const chest = pivot(torso, 0, 0.02, 0.28, 'chest');
  const trunk = add(torso, new THREE.SphereGeometry(1, 16, 10).scale(0.3, 0.22, 0.72), hideM, 0, 0.02, -0.02);
  const chestM = add(chest, new THREE.SphereGeometry(1, 14, 10).scale(0.3, 0.25, 0.32), hideM);
  add(torso, new THREE.SphereGeometry(1, 14, 8).scale(0.25, 0.12, 0.66), bellyM, 0, -0.1, 0);
  const spines = [];
  for (let i = 0; i < 7; i++) spines.push(add(torso, new THREE.ConeGeometry(0.045, 0.14, 5), darkM, 0, 0.24 - Math.abs(i - 3) * 0.012, 0.45 - i * 0.15));
  // the neck rises from the chest to the head; the head holds a brass trumpet where its snout should be
  const neck = pivot(chest, 0, 0.08, 0.22, 'neck');
  tube(neck, [[0, 0, 0], [0, 0.18, 0.12], [0, 0.32, 0.3]], 0.1, hideM, 0.075);
  const head = pivot(neck, 0, 0.34, 0.32, 'head');
  add(head, new THREE.SphereGeometry(1, 12, 10).scale(0.13, 0.11, 0.17), hideM);
  const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.035, 8, 6), eyeM, s * 0.09, 0.05, 0.06));
  // the trumpet: a brass pipe from the jaw flaring into a bell (an elbowed pipe in the City-Shaft)
  const horn = pivot(head, 0, -0.02, 0.12, 'horn');
  if (props.has('elbow')) tube(horn, [[0, 0, 0], [0, -0.02, 0.18], [0, 0.1, 0.3], [0, 0.12, 0.45]], 0.035, hornM);
  else rod(horn, [0, 0, 0], [0, 0.03, 0.42], 0.03, hornM, 0.045);
  const bellAt = props.has('elbow') ? [0, 0.12, 0.47] : [0, 0.035, 0.44];
  const bell = pivot(horn, ...bellAt, 'bell');
  add(bell, new THREE.CylinderGeometry(0.17, 0.045, 0.2, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.1), M.mat('bellIn', P.horn, { side: THREE.DoubleSide }));
  add(bell, new THREE.TorusGeometry(0.17, 0.018, 6, 18), hornM, 0, 0, 0.2);
  const mouth = pivot(bell, 0, 0, 0.22);   // (where the blare's glow gathers)
  if (props.has('coins')) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const cn = add(bell, new THREE.CylinderGeometry(0.03, 0.03, 0.008, 10).rotateX(Math.PI / 2), hornM, Math.sin(a) * 0.19, Math.cos(a) * 0.19 - 0.05, 0.2); cn.userData.coin = i; }
  // the tail: a curl on a verlet chain, drawn as beads tapering to a spiral tip
  const tailRoot = pivot(torso, 0, 0.04, -0.68, 'tail root');
  const tail = new VerletChain({ n: 9, length: 0.15, stiffness: 0.35, damping: 0.8, gravity: 1.2, curl: 0.42 });
  const beads = chainBeads(g, 9, 0.085, 0.03, hideM);
  const soot = props.has('soot');
  finish(g);
  const parts = [trunk, chestM, ...spines, neck, ...beads, ...legs.map((l) => l.root)];
  const tw = new THREE.Vector3(), td = new THREE.Vector3();
  let rear = 0, flat = 0, swing = 0, swell = 0, lift = 0;
  return {
    group: g, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.hide, P.belly, P.horn],
    tell: (id) => (id === 'blare' ? mouth : id === 'whip' ? beads[6] : head),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the blare: it rears onto its hind legs, chest swelling, the bell glowing; the bite: flat to the ground, tail
      // rigid; the whip: its hips swing out the other way first, then the tail sweeps through
      const blare = id === 'blare' ? (wind ? c.wind : strike ? 1 - c.release * 0.4 : 0) : 0;
      const bite = id === 'bite' ? (wind ? c.wind : 0) : 0;
      const whip = id === 'whip' ? (wind ? -c.wind * 0.55 : strike ? lerp(-0.55, 1.1, c.release) : 0) : 0;
      rear = ease(rear, blare, 9, dt); flat = ease(flat, bite, 10, dt); swing = ease(swing, whip, strike ? 18 : 8, dt);
      swell = ease(swell, blare + (f.state === 'idle' && !f.provoked ? Math.max(0, Math.sin(c.now / 900 + f.home.x)) * 0.35 : 0), 6, dt);
      // the front legs leave the ground as it rears (they hang from the chest), and come back to their spots
      lift = ease(lift, rear > 0.25 ? 1 : 0, 8, dt);
      legs[0].lift = legs[1].lift = lift;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: strike && id === 'bite' ? Math.min(1, Math.sin(Math.PI * Math.min(1, f.k * 1.3)) * 2) : 0 });
      body.position.set(o.x, o.y - flat * 0.2 + rear * 0.18, o.z - rear * 0.12);
      body.rotation.set(o.pitch - rear * 0.62 + flat * 0.05, o.yaw + swing * 0.45, o.roll);
      chest.scale.setScalar(1 + swell * 0.28);
      // the head stays steady against the body's bob and pitch (it aims the horn at you)
      neck.rotation.x = rear * 0.4 - flat * 0.5 - o.pitch * 0.6;
      head.rotation.x = rear * 0.25 + flat * 0.3 + (strike && id === 'bite' ? -0.3 : 0);
      head.rotation.y = -swing * 0.3;
      for (const s of spines) s.scale.y = 1 + bite * 0.6;
      hornM.uniforms.uGlow.value = (props.has('hot') ? 0.35 : 0.05) + rear * 0.9;
      rig.write();
      // the tail: rooted at the hips, at rest curling up behind it; rigid as it crouches to bite, swept by the whip
      tailRoot.getWorldPosition(tw);
      td.set(-Math.sin(f.heading + swing * 1.6), 0.15, -Math.cos(f.heading + swing * 1.6));
      placeBeads(beads, tail.update(dt, tw, td, bite > 0.2 ? 0.9 : id === 'whip' && strike ? 0.75 : 0.32), g);
      if (props.has('coins')) bell.children.forEach((x) => { if (x.userData.coin != null) x.rotation.y = Math.sin(c.now / 120 + x.userData.coin) * 0.8; });
      if (soot && (c.moving || rear > 0.5) && Math.random() < 0.1) c.spray(V().copy(f.chest), [P.horn, P.dark], 1, 0.8, -1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}

// --------------------------------------------------------------------------------------- the antler hound
export function houndModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('hound', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  // its ink is drawn with a white contour, as the shade's: black on the Eclipse's dark streets it would be only a
  // hole (playtest 2026-10-08, no invisible foes: src/foe-presence.js)
  const inkM = M.mat('ink', P.ink, { flat: true, lineWhite: true }), rimM = M.mat('rim', P.rim, { flat: true, lineWhite: true });
  const antlerM = M.mat('antler', P.antler, { flat: !props.has('bleached') }), eyeM = M.own('eye', P.eye, { glow: 0.95 });
  const Q = quadBody(g, { name: 'hound', hipY: 0.78, hips: [0.4, -0.4], halfWidth: 0.15, feet: [0.18, 0.44, -0.44], legR: 0.04, mats: { joint: inkM, thigh: inkM, shin: inkM, foot: rimM } });
  const { body, torso, legs, rig } = Q;
  const chest = pivot(torso, 0, 0.04, 0.24, 'chest');
  const trunk = add(torso, new THREE.SphereGeometry(1, 14, 10).scale(0.2, 0.22, 0.58), inkM, 0, 0.02, -0.05);
  const chestM = add(chest, new THREE.SphereGeometry(1, 12, 8).scale(0.22, 0.27, 0.26), inkM);
  const neck = pivot(chest, 0, 0.12, 0.18, 'neck');
  tube(neck, [[0, 0, 0], [0, 0.16, 0.08], [0, 0.3, 0.14]], 0.085, inkM, 0.06);
  const head = pivot(neck, 0, 0.32, 0.16, 'head');
  add(head, new THREE.SphereGeometry(1, 10, 8).scale(0.12, 0.11, 0.15), inkM);
  add(head, new THREE.ConeGeometry(0.075, 0.34, 7).rotateX(Math.PI / 2), inkM, 0, -0.03, 0.22);
  const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.034, 8, 6), eyeM, s * 0.075, 0.035, 0.11));
  // the crown of antlers, wider than its body: a beam each side branching into tines (a crescent in the Eclipse,
  // bleached driftwood in the Mangrove, a tangle of wire in the Market, a halo caught in them in the Garden)
  const crown = pivot(head, 0, 0.09, -0.02, 'antlers');
  const tines = [];
  for (const s of [-1, 1]) {
    if (props.has('crescent')) {
      tines.push(tube(crown, [[s * 0.05, 0, 0], [s * 0.35, 0.18, -0.05], [s * 0.55, 0.45, 0.02], [s * 0.48, 0.72, 0.12], [s * 0.3, 0.86, 0.16]], 0.03, antlerM, 0.012));
    } else if (props.has('wire')) {
      for (let k = 0; k < 3; k++) tines.push(tube(crown, [[s * 0.05, 0, 0], [s * (0.22 + k * 0.08), 0.2 + k * 0.05, -0.04], [s * (0.18 + k * 0.17), 0.45 + k * 0.05, 0.05 * k], [s * (0.42 + k * 0.1), 0.62 - k * 0.04, -0.03], [s * (0.6 + k * 0.05), 0.55 + k * 0.1, 0.04]], 0.009, antlerM));
    } else {
      const thick = props.has('bleached') ? 0.034 : 0.025;
      tines.push(tube(crown, [[s * 0.05, 0, 0], [s * 0.28, 0.24, -0.06], [s * 0.5, 0.5, -0.04], [s * 0.66, 0.78, 0.02]], thick, antlerM, thick * 0.45));
      for (let k = 0; k < 3; k++) { const t = 0.3 + k * 0.22, x = s * lerp(0.05, 0.66, t), y = lerp(0, 0.78, t);
        tines.push(tube(crown, [[x, y, -0.03], [x + s * 0.06, y + 0.2, 0.06], [x + s * 0.02, y + 0.33, 0.12]], thick * 0.7, antlerM, thick * 0.3)); }
    }
  }
  if (props.has('halo')) { const h = add(crown, new THREE.TorusGeometry(0.42, 0.025, 6, 30), M.own('halo', P.glow, { glow: 0.8 }), 0, 0.55, -0.02); h.rotation.x = 1.3; h.rotation.z = 0.3; tines.push(h); }
  const crownTip = pivot(crown, 0, 0.5, 0.1);
  // smoke on its back on a chain (it lags as it runs)
  const smokeRoot = pivot(torso, 0, 0.22, 0.1, 'smoke root');
  const smoke = new VerletChain({ n: 6, length: 0.17, stiffness: 0.12, damping: 0.82, gravity: -1.5, curl: 0.1 });
  const puffs = chainBeads(g, 6, 0.11, 0.05, rimM);
  // its shadow form: a dark pool sliding along the ground, a low hump of shadow with a glowing rim, the two eyes over it
  const pool = add(g, new THREE.CircleGeometry(0.55, 16).scale(0.8, 1.5, 1).rotateX(-Math.PI / 2), inkM, 0, 0.03, 0);
  const hump = add(g, new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.75, 1.2, 1.5), inkM);
  const glowRim = add(g, new THREE.RingGeometry(0.62, 0.74, 24).scale(0.8, 1.5, 1).rotateX(-Math.PI / 2), M.own('glow', P.glow, { glow: 0.8, side: THREE.DoubleSide }), 0, 0.04, 0);
  const poolEyes = pair((s) => add(g, new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.6, 1), eyeM, s * 0.12, 0.42, 0.42));
  finish(g);
  const sw = new THREE.Vector3(), sd = new THREE.Vector3();
  let solid = 1, crouch = 0, rake = 0;
  return {
    group: g, body, rig, parts: [], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, shadowy: true, tones: [P.ink, P.rim, P.antler],
    tell: (id) => (id === 'rake' ? crownTip : head),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // stepping through the shadow (its 'step'): it sinks into its own pool as it winds up, nothing drawn behind you
      const sinking = wind && f.atk?.blink;
      // lying in wait (calm, unprovoked): only its shadow under a tree, until it stands up to watch you
      const lying = f.state === 'idle' && !f.provoked && !f.watcher;
      solid = ease(solid, f.phased || sinking || lying ? 0 : 1, f.phased || sinking || lying ? 6 : 14, dt);
      body.visible = solid > 0.08; body.scale.set(1, Math.max(0.05, solid), 1);
      pool.visible = solid < 0.9; pool.scale.setScalar(1.2 - solid * 0.5); poolEyes.forEach((e) => { e.visible = solid < 0.6; });
      hump.visible = glowRim.visible = solid < 0.6;
      hump.scale.set(1, 1 - solid * 0.6 + Math.sin(c.now / 140) * 0.06, 1);
      glowRim.scale.setScalar(1 + Math.sin(c.now / 200) * 0.06);
      // the pounce: crouched back on its haunches, the antlers dipped forward, the shoulders bunched; then the leap
      crouch = ease(crouch, id === 'pounce' && wind ? c.wind : 0, 10, dt);
      rake = ease(rake, id === 'rake' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, 12, dt);
      const leap = strike && f.atk?.lunge ? Math.min(1, Math.sin(Math.PI * Math.min(1, f.k * 1.4)) * 3) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: leap });
      body.position.set(o.x, -(1 - solid) * 0.3 + o.y - crouch * 0.08, o.z);
      body.rotation.set(o.pitch - crouch * 0.18, o.yaw + rake * (strike ? -0.5 : 0.25), o.roll);
      chest.scale.set(1 + crouch * 0.12, 1 - crouch * 0.06, 1);
      neck.rotation.x = crouch * 0.5 + rake * 0.7 - o.pitch * 0.6;
      neck.rotation.z = rake * 0.45;
      head.rotation.x = crouch * 0.35 + rake * 0.25 + (strike && id === 'bite' ? -0.4 * Math.sin(Math.PI * f.k) : 0);
      g.position.y += leap ? Math.sin(Math.PI * f.k) * 0.5 : 0;
      rig.visible = body.visible;
      rig.write();
      // the smoke trails off its back, lagging as it runs
      smokeRoot.getWorldPosition(sw);
      sd.set(-Math.sin(f.heading) * 0.6, 1, -Math.cos(f.heading) * 0.6);
      placeBeads(puffs, smoke.update(dt, sw, sd), g);
      puffs.forEach((p, i) => { p.visible = body.visible; p.scale.setScalar(lerp(0.11, 0.05, i / 5) * (1 + Math.sin(c.now / 160 + i) * 0.15)); });
      eyeM.uniforms.uColor.value.set(eyeColor(f, f.lit > 0 ? '#ffe2a8' : P.eye, '#ff6a8a'));
      if (solid > 0.5 && Math.random() < 0.12) c.drip(f, P.ink);
    },
    dispose: M.dispose,
  };
}
