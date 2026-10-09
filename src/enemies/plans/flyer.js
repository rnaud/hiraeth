import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { FollowChain, Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, rod, pivot, pair, lerp, ease, eyeColor, finish } from './kit.js';

// Plan 13, the flyer (docs/systems/procedural-animation.md §4): the signal moth (docs/design/enemy-roster.md,
// archetype 10), the disruptor. A moth upright in the air, two broad wings that fold into a tent over its back,
// two feathery antennae like a tuning fork; opened toward you, a broad bright triangle with two eye-spots.
//
// On the kit (phase 4, src/motion-kit/chain.js): each wing is a chain of strips from the root to the tip turned by a
// travelling wave on a phase accumulator (Wave), so the tips lag the root and the beat quickens with its speed
// without a jump; the body pitches with its acceleration on a spring and bobs as it hovers; the antennae trail on
// follow-the-leader chains.
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   flash   it rears upright and snaps its wings open flat toward you, still, the eye-spots burning brighter
//   dart    its wings fold back along its body into a tent and it rears, nose high; then it dives
//   dust    (the lamp moth, the Antennas' moth) it hangs right over you fluttering fast, dust sifting off its wings
// Skins (src/enemies/skins.js): a dusty lamp moth lit from behind, a glass wasp with a long striped body, the neon
// sign moth with painted letters, a cream signal moth with dish antennae, a blue space moth with sail-like wings.
// Art match pending its sheet (docs/design/enemy-roster-prompts.md, `moth`).

const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/** A wing strip from span x0 to x1 (side s): its chord shrinks from the root's (broad) to the tip's. */
function strip(s, x0, x1, wasp) {
  const ch = (x) => (wasp ? lerp(0.22, 0.1, x / 0.7) : lerp(0.5, 0.18, x / 0.75)), lz = (x) => (wasp ? 0.06 : lerp(0.08, 0.22, x / 0.75));
  const gq = new THREE.BufferGeometry();
  const v = [0, 0, lz(x0), s * (x1 - x0), 0, lz(x1), s * (x1 - x0), 0, lz(x1) - ch(x1), 0, 0, lz(x0) - ch(x0)];
  gq.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  gq.setIndex(s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  gq.computeVertexNormals();
  return gq;
}

export function mothModel(skin) {
  const PL = PLANS.flyer, P = skin.palette, props = new Set(skin.props), M = materials('moth', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  const wasp = props.has('wasp'), neon = props.has('neon');
  const wingM = M.mat('wing', P.wing, { color2: P.wing2, side: THREE.DoubleSide, lineWhite: neon }), bodyM = M.mat('body', P.body, { lineWhite: neon });
  const antM = M.mat('antenna', P.antenna, { flat: true, glow: neon ? 0.8 : 0 }), spotM = M.own('spot', P.spot, { glow: 0.5 }), glowM = M.own('glow', P.glow, { glow: 0.8 });
  const eyeM = M.own('eye', P.eye, { glow: 0.85 });
  const body = pivot(g, 0, 0.5, 0, 'body');
  const frame = pivot(body, 0, 0, 0, 'frame');   // (pitched: nose up as it hovers)
  const thorax = add(frame, new THREE.SphereGeometry(0.14, 12, 8).scale(1, 1, 1.15), bodyM);
  const abdomen = wasp
    ? add(frame, new THREE.CapsuleGeometry(0.07, 0.5, 4, 8).rotateX(Math.PI / 2), bodyM, 0, -0.04, -0.4)
    : add(frame, new THREE.CapsuleGeometry(0.1, 0.32, 4, 8).rotateX(Math.PI / 2), bodyM, 0, -0.05, -0.3);
  abdomen.rotation.x = 0.25;
  if (wasp) { for (let k = 0; k < 3; k++) add(abdomen, new THREE.TorusGeometry(0.072, 0.016, 4, 12), spotM, 0, 0, -0.05 - k * 0.12); add(abdomen, new THREE.ConeGeometry(0.03, 0.16, 5).rotateX(-Math.PI / 2), bodyM, 0, 0, -0.38); }
  else add(frame, new THREE.SphereGeometry(0.12, 10, 6).scale(1.15, 0.9, 1), M.mat('ruff', P.wing2), 0, 0.03, 0.06);   // (the furry ruff)
  const head = add(frame, new THREE.SphereGeometry(0.09, 10, 8), bodyM, 0, 0.03, 0.18);
  const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.045, 8, 6), eyeM, s * 0.06, 0.02, 0.05));
  // the wings: strips root to tip, each a pivot on the last, a big eye-spot on the outer one
  const S = PL.wing.strips, span = wasp ? 0.7 : 0.75;
  const wings = pair((s) => {
    const root = pivot(frame, s * 0.1, 0.06, 0.02, 'wing');
    let parent = root, at = 0;
    const strips = [];
    for (let k = 0; k < S; k++) {
      const x1 = (span * (k + 1)) / S;
      const pv = pivot(parent, k === 0 ? 0 : s * (span / S), 0, 0, `strip ${k}`);
      pv.add(new THREE.Mesh(strip(s, at, x1, wasp), wingM));
      if (k === S - 1 && !wasp) {
        const spot = add(pv, new THREE.CircleGeometry(0.09, 14).rotateX(-Math.PI / 2), spotM, s * (x1 - at) * 0.35, 0.008, -0.02);
        add(spot, new THREE.CircleGeometry(0.045, 10).rotateX(-Math.PI / 2), bodyM, 0, 0.004, 0);
      }
      if (props.has('lit') || props.has('sail')) rod(pv, [0, 0.006, 0], [s * (x1 - at), 0.006, -0.08 - k * 0.04], 0.008, props.has('lit') ? glowM : antM);
      if (props.has('letters') && k === 1) for (let j = 0; j < 3; j++) add(pv, new THREE.PlaneGeometry(0.03, 0.09).rotateX(-Math.PI / 2), spotM, s * (0.04 + j * 0.06), 0.008, -0.12);
      strips.push(pv); parent = pv; at = x1;
    }
    // the neon sign moth: its wing's outline in a glowing tube
    if (neon) { const pts = [[0, 0.01, 0.08], [s * span * 0.5, 0.01, 0.16], [s * span, 0.01, 0.22], [s * span, 0.01, 0.04], [s * span * 0.5, 0.01, -0.22], [0, 0.01, -0.42]]; for (let j = 0; j < pts.length - 1; j++) rod(root, pts[j], pts[j + 1], 0.012, s > 0 ? glowM : spotM); }
    return { root, strips };
  });
  // the legs, tucked and dangling under the thorax
  const legs = [];
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) legs.push(rod(frame, [s * 0.06, -0.08, 0.08 - k * 0.08], [s * 0.14, -0.26, 0.02 - k * 0.12], 0.012, antM));
  // the antennae: follow-the-leader chains from the brow (feathered; dishes on the Antennas' moth)
  const antRoots = pair((s) => pivot(head, s * 0.04, 0.07, 0.05, 'antenna root'));
  const ants = pair(() => new FollowChain({ n: 4, length: wasp ? 0.08 : 0.1, maxBend: 0.45, straighten: 4 }));
  const holder = pivot(g, 0, 0, 0, 'antennae (foes space)'); holder.matrixAutoUpdate = false;
  const antRods = pair(() => Array.from({ length: 4 }, (_, j) => {
    const r = new THREE.Group(); holder.add(r);
    r.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 1, 4).translate(0, 0.5, 0), antM));
    if (!wasp && !props.has('dish')) for (const s of [-1, 1]) { const fe = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 3).translate(0, 0.045, 0), antM); fe.position.y = 0.5; fe.rotation.z = s * 1.0; r.add(fe); }
    if (props.has('dish') && j === 3) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.02, 0.03, 10), antM); d.position.y = 1; r.add(d); d.userData.dish = true; }
    return r;
  }));
  finish(g);
  const wave = new Wave(Math.random());
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const pitch = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0);
  const prev = { x: null, z: 0, speed: 0 };
  let open = 0, fold = 0, flutter = 0;
  return {
    group: g, body, wave, wings: wings.map((w) => w.strips[0].children[0]), parts: [thorax, abdomen, head, ...wings.map((w) => w.root)], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.wing, P.body, P.spot],
    tell: (id) => (id === 'flash' ? wings[1].strips[S - 1] : head),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      const speed = Math.min(10, Math.hypot(vx, vz)), acc = (speed - prev.speed) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z; prev.speed = speed;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      open = ease(open, id === 'flash' && wind ? c.wind : 0, 16, dt);       // (snapped open flat toward you)
      fold = ease(fold, id === 'dart' && (wind || strike) ? 1 : 0, 12, dt); // (folded back into a tent)
      flutter = ease(flutter, id === 'dust' && wind ? 1 : 0, 8, dt);
      const B = PL.body, bob = Math.sin(c.now / 300 + f.home.z) * B.bob;
      g.position.y += f.alt + bob;
      // nose up as it hovers, more as it brakes; upright to flash
      const pt = pitch.update(dt, THREE.MathUtils.clamp(-0.55 + acc * B.pitch + speed * 0.04, -B.pitchMax - 0.6, 0) - open * 0.85);
      frame.rotation.set(pt + P0.pitch, 0, P0.roll);
      body.position.set(0, 0.5 + P0.y, P0.z);
      // the beat: by speed, quicker in a flutter, stilled open for the flash, folded for the dart
      const W = PL.wing;
      wave.update(dt, lerp(W.rate[0], W.rate[1], Math.min(1, speed / 4)) * (1 + flutter * 0.8) * (1 - open) * (1 - fold * 0.9));
      wings.forEach((w, i) => {
        const s = i ? 1 : -1, amp = W.amp * (1 - open) * (1 - fold);
        w.root.rotation.set(0, s * fold * 1.1, s * (W.fold + wave.angle(0, amp, 0) + fold * 1.25));
        w.strips.forEach((st, k) => { if (k > 0) st.rotation.z = s * wave.angle(k, amp * 0.35, W.lag); });
      });
      // the antennae trail, lagging the head
      g.updateMatrix(); holder.matrix.copy(_m.copy(g.matrix).invert()); holder.matrixWorldNeedsUpdate = true;
      antRoots.forEach((r, i) => {
        _m.identity(); for (let o = r; o && o !== g; o = o.parent) { o.updateMatrix(); _m.premultiply(o.matrix); }
        _a.setFromMatrixPosition(_m.premultiply(g.matrix));
        _d.set(Math.sin(f.heading + (i ? -0.35 : 0.35)), 0.9 - open * 0.4, Math.cos(f.heading + (i ? -0.35 : 0.35)));
        const pts = ants[i].update(_a, _d, dt);
        antRods[i].forEach((m, j) => { m.position.copy(pts[j]); _a.subVectors(pts[j + 1], pts[j]); const l = _a.length(); m.children[0].scale.set(1, l, 1); if (l > 1e-6) m.quaternion.setFromUnitVectors(UP, _a.divideScalar(l)); m.children.forEach((x, n) => { if (n > 0 && !x.userData.dish) x.position.y = l * 0.5; if (x.userData.dish) x.position.y = l; }); });
      });
      // the eye-spots burn brighter through the flash's wind-up
      spotM.uniforms.uGlow.value = 0.5 + open * 0.5;
      spotM.uniforms.uColor.value.set(open > 0.75 ? '#ffffff' : P.spot);
      glowM.uniforms.uGlow.value = 0.8 + open * 0.2;
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      if (flutter > 0.3 && Math.random() < 0.5) c.dust(f.chest, P.wing2, 1, 0.5);
    },
    dispose: M.dispose,
  };
}
