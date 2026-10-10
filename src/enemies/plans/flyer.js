import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { FollowChain, VerletChain, Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, rod, pivot, pair, lerp, ease, eyeColor, finish } from './kit.js';

// Plan 13, the flyer (docs/systems/procedural-animation.md §4): the signal moth (docs/design/enemy-roster.md,
// archetype 10), the disruptor. Drawn to its picked sheet (references/enemy-archetypes/moth/sheet-1.jpg, the Deep
// Wood's lamp moth): an otherworldly lamp creature hovering upright, its body a slender ribbed paper lantern with a
// warm light inside, a small hooded face with two dark eyes, two antennae ending in glowing bulbs, two kite-like wings
// of membrane on fine rods hinged at the shoulders (folded, a tall tent round the lantern; snapped open, two signal
// panels with blazing eye-spots, 1.8 m across), and six long thin legs with knees and hooked feet hanging under it
// like a lantern's fringe.
//
// On the kit (phase 4, src/motion-kit/chain.js): each wing is a fan of strips from the shoulder out, each turned about
// the upright by a travelling wave on a phase accumulator (Wave), so the outer edge lags the root and the beat quickens
// with its speed without a jump; the body tilts with its acceleration on a spring and bobs as it hovers; the antennae
// and the six legs trail on follow-the-leader chains.
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   flash   it snaps both wings open flat toward you and holds them, still, the eye-spots burning white
//   dart    its wings close tight round the lantern and it tips forward, nose down; then it dives
//   dust    (the lamp moth, the Antennas' moth) it hangs right over you fanning fast, dust sifting off its wings
// Skins (src/enemies/skins.js): the lilac lamp moth lit from behind, a pink glass wasp with a slim body, the dark
// neon sign moth with painted letters, a cream signal moth with dish antennae, a blue space moth with sail wings.

const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const SPAN = 0.78;   // (each wing; the body between: 1.8 m across, open)
/** The wing's top and bottom edge (y, from the shoulder) at span x: a fan widening downward and out. */
const top = (x) => 0.06 + 0.12 * (x / SPAN), bot = (x) => -0.28 - 0.62 * (x / SPAN);

/** A wing strip from span x0 to x1 (side s), in the shoulder's XY plane (its face toward +z). */
function strip(s, x0, x1) {
  const gq = new THREE.BufferGeometry();
  const v = [0, top(x0), 0, s * (x1 - x0), top(x1), 0, s * (x1 - x0), bot(x1), 0, 0, bot(x0), 0];
  gq.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  gq.setIndex(s > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  gq.computeVertexNormals();
  return gq;
}

export function mothModel(skin) {
  const PL = PLANS.flyer, P = skin.palette, props = new Set(skin.props), M = materials('moth', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const wasp = props.has('wasp'), neon = props.has('neon');
  const wingM = M.mat('wing', P.wing, { color2: P.wing2, side: THREE.DoubleSide, lineWhite: neon });
  const rodM = M.own('rod', P.antenna, { glow: props.has('lit') || neon ? 0.6 : 0.1, line: 0.5, lineTint: 0.6 });
  const lanternM = M.own('lantern', P.body, { glow: 0.55 }), ribM = M.mat('rib', P.antenna, { flat: true, line: 0.35, lineTint: 0.7 });
  const hoodM = M.mat('hood', P.wing2, { lineWhite: neon }), spotM = M.own('spot', P.spot, { glow: 0.5, side: THREE.DoubleSide }), glowM = M.own('glow', P.glow, { glow: 0.85, side: THREE.DoubleSide });
  const eyeM = M.own('eye', P.eye, { glow: 0.3 });
  const body = pivot(g, 0, 0.9, 0, 'body');
  const frame = pivot(body, 0, 0, 0, 'frame');   // (tilted with its acceleration; tipped forward to dart)
  // the lantern: a slender ribbed shape, glowing inside (a slimmer, longer one for the wasp)
  const lw = wasp ? 0.15 : 0.2, lh = wasp ? 0.5 : 0.38;
  const lantern = add(frame, new THREE.SphereGeometry(1, 14, 12).scale(lw, lh, lw), lanternM, 0, -0.12, 0);
  for (let k = 0; k < 4; k++) { const t = (k - 1.5) * 0.42, r = lw * Math.sqrt(Math.max(0.05, 1 - t * t)); add(frame, new THREE.TorusGeometry(r * 1.01, 0.008, 4, 16).rotateX(Math.PI / 2), ribM, 0, -0.12 + t * lh, 0); }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const pts = Array.from({ length: 7 }, (_, i) => { const t = (i / 6) * Math.PI - Math.PI / 2; return [Math.cos(a) * Math.cos(t) * lw * 1.01, -0.12 + Math.sin(t) * lh, Math.sin(a) * Math.cos(t) * lw * 1.01]; });
    for (let i = 0; i < 6; i++) rod(frame, pts[i], pts[i + 1], 0.006, ribM);
  }
  add(frame, new THREE.CylinderGeometry(lw * 0.45, lw * 0.6, 0.06, 10), ribM, 0, -0.12 - lh - 0.01, 0);   // (its base)
  // the hooded face: a hood over the lantern's top, two big dark eyes in it
  const head = pivot(frame, 0, -0.12 + lh + 0.06, 0.02, 'head');
  add(head, new THREE.SphereGeometry(0.12, 12, 10).scale(1, 1.15, 1), hoodM);
  add(head, new THREE.SphereGeometry(0.085, 10, 8).scale(1, 1, 0.6), lanternM, 0, -0.02, 0.06);   // (the pale face inside the hood)
  pair((s) => add(head, new THREE.SphereGeometry(0.03, 8, 6), eyeM, s * 0.038, 0.0, 0.11));
  // the wings: from each shoulder a fan of strips, each a pivot on the last (turned about the upright: the outer lags);
  // rods along their edges (the kite's spars), a red-ringed eye-spot on the middle strip
  const S = PL.wing.strips;
  const wings = pair((s) => {
    const root = pivot(frame, s * 0.1, -0.12 + lh * 0.75, 0, 'wing');
    let parent = root, at = 0;
    const strips = [];
    for (let k = 0; k < S; k++) {
      const x1 = (SPAN * (k + 1)) / S;
      const pv = pivot(parent, k === 0 ? 0 : s * (SPAN / S), 0, 0, `strip ${k}`);
      pv.add(new THREE.Mesh(strip(s, at, x1), wingM));
      const w = x1 - at;
      rod(pv, [0, top(at), 0], [s * w, top(x1), 0], 0.009, rodM);
      rod(pv, [0, bot(at), 0], [s * w, bot(x1), 0], 0.007, rodM);
      rod(pv, [0, top(at), 0], [s * w, bot(x1), 0], 0.005, rodM);   // (a spar fanning across it)
      if (k === S - 1) rod(pv, [s * w, top(x1), 0], [s * w, bot(x1), 0], 0.009, rodM);
      if (k === S - 2 && !wasp) {
        const spot = pivot(pv, s * w * 0.55, (top(at) + bot(x1)) * 0.52, 0);
        add(spot, new THREE.RingGeometry(0.085, 0.13, 20), spotM, 0, 0, 0.006);
        add(spot, new THREE.CircleGeometry(0.085, 18), glowM, 0, 0, 0.008);
        add(spot, new THREE.RingGeometry(0.085, 0.13, 20), spotM, 0, 0, -0.006);
        add(spot, new THREE.CircleGeometry(0.085, 18), glowM, 0, 0, -0.008);
      }
      if (props.has('letters') && k === 0) for (let j = 0; j < 3; j++) add(pv, new THREE.PlaneGeometry(0.03, 0.1), spotM, s * (0.05 + j * 0.06), -0.18, 0.004);
      strips.push(pv); parent = pv; at = x1;
    }
    return { root, strips };
  });
  // the antennae: follow-the-leader chains up from the hood, a glowing bulb at each tip (a dish on the Antennas' moth);
  // the six legs: chains hanging from the lantern's base, knees and hooked feet
  const antRoots = pair((s) => pivot(head, s * 0.05, 0.11, 0.02, 'antenna root'));
  const ants = pair(() => new FollowChain({ n: 4, length: 0.11, maxBend: 0.15, straighten: 12 }));
  const legRoots = Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2 + 0.5; return pivot(frame, Math.sin(a) * lw * 0.45, -0.12 - lh, Math.cos(a) * lw * 0.45, 'leg root'); });
  const legs = legRoots.map(() => new VerletChain({ n: 3, length: 0.24, stiffness: 0.3, damping: 0.85, gravity: 6 }));   // (they hang, swinging)
  const holder = pivot(g, 0, 0, 0, 'antennae and legs (foes space)'); holder.matrixAutoUpdate = false;
  const seg = (r0, r1, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 5).translate(0, 0.5, 0), mat); holder.add(m); return m; };
  const antRods = pair(() => Array.from({ length: 4 }, () => seg(0.008, 0.006, rodM)));
  const bulbs = pair(() => { const b = new THREE.Mesh(props.has('dish') ? new THREE.CylinderGeometry(0.06, 0.015, 0.025, 10) : new THREE.SphereGeometry(0.03, 8, 6), props.has('dish') ? ribM : glowM); holder.add(b); return b; });
  const legRods = legs.map(() => Array.from({ length: 3 }, (_, j) => seg(0.012 - j * 0.003, 0.01 - j * 0.003, ribM)));
  const knees = legs.map(() => Array.from({ length: 2 }, () => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), ribM); holder.add(b); return b; }));
  const hooks = legs.map(() => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 8, Math.PI * 1.3), ribM); holder.add(h); return h; });
  finish(g);
  const wave = new Wave(Math.random());
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const tilt = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0);
  const prev = { x: null, z: 0, speed: 0 };
  let open = 0, fold = 0, flutter = 0;
  const inFoes = (o, out) => { _m.identity(); for (let x = o; x && x !== g; x = x.parent) { if (x.matrixAutoUpdate) x.updateMatrix(); _m.premultiply(x.matrix); } return out.setFromMatrixPosition(_m.premultiply(g.matrix)); };
  const place = (rods, pts) => rods.forEach((m, j) => { m.position.copy(pts[j]); _a.subVectors(pts[j + 1], pts[j]); const l = _a.length(); m.scale.set(1, Math.max(1e-3, l), 1); if (l > 1e-6) m.quaternion.setFromUnitVectors(UP, _a.divideScalar(l)); });
  return {
    group: g, body, wave, wings: wings.map((w) => w.strips[0].children[0]), parts: [lantern, head, ...wings.map((w) => w.root)], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.wing, P.body, P.spot],
    tell: (id) => (id === 'flash' ? wings[1].strips[S - 2] : head),
    /** Going down (src/enemies/defeat.js): its wings stop beating and fold back over its body as it spirals down. */
    defeat(f, c, u) {
      const k = THREE.MathUtils.smoothstep(u, 0.1, 0.6);
      wings.forEach((w, i) => {
        const s = i ? 1 : -1;
        w.root.rotation.y = lerp(w.root.rotation.y, s * 1.75, k); w.root.rotation.z = lerp(0, -s * 0.5, k);
        w.strips.forEach((st, j) => { if (j > 0) st.rotation.y = lerp(st.rotation.y, s * 0.2, k); });
      });
      lanternM.uniforms.uGlow.value *= 1 - k * 0.8;
    },
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      const speed = Math.min(10, Math.hypot(vx, vz)), acc = (speed - prev.speed) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z; prev.speed = speed;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      open = ease(open, id === 'flash' && wind ? c.wind : 0, 16, dt);       // (snapped open flat toward you)
      fold = ease(fold, id === 'dart' && (wind || strike) ? 1 : 0, 12, dt); // (closed tight round the lantern)
      flutter = ease(flutter, id === 'dust' && wind ? 1 : 0, 8, dt);
      const B = PL.body, bob = Math.sin(c.now / 300 + f.home.z) * B.bob;
      g.position.y += f.alt - 0.5 + bob;   // (its hooks just over its footing when it comes down)
      // upright, leaning a little into its flight and its braking; tipped forward to dart
      const lean = tilt.update(dt, THREE.MathUtils.clamp(acc * B.pitch + speed * 0.03, -B.pitchMax, B.pitchMax));
      frame.rotation.set(lean + P0.pitch * 0.5 + fold * 0.9, 0, P0.roll);
      body.position.set(0, 0.9 + P0.y, P0.z);
      // the beat: about the upright, by speed, quicker in a flutter; the wings half swept back as it flies, wide open
      // toward you for the flash (still), wrapped round the lantern for the dart
      const W = PL.wing;
      wave.update(dt, lerp(W.rate[0], W.rate[1], Math.min(1, speed / 4)) * (1 + flutter * 0.8) * (1 - open) * (1 - fold * 0.9));
      const rest = lerp(1.05, 0.15, open) + fold * 0.95;   // (rad swept back from facing you)
      wings.forEach((w, i) => {
        const s = i ? 1 : -1, amp = W.amp * 0.6 * (1 - open) * (1 - fold);
        w.root.rotation.set(0, s * (rest + wave.angle(0, amp, 0)), 0);
        w.strips.forEach((st, k) => { if (k > 0) st.rotation.y = s * (wave.angle(k, amp * 0.4, W.lag) + fold * 0.35); });
      });
      // the antennae and the legs trail, lagging the body
      g.updateMatrix(); holder.matrix.copy(_m.copy(g.matrix).invert()); holder.matrixWorldNeedsUpdate = true;
      antRoots.forEach((r, i) => {
        inFoes(r, _a);
        _d.set(Math.sin(f.heading + (i ? -0.25 : 0.25)) * 0.35, 1, Math.cos(f.heading + (i ? -0.25 : 0.25)) * 0.35);
        const pts = ants[i].update(_a, _d, dt);
        place(antRods[i], pts); bulbs[i].position.copy(pts.at(-1));
      });
      legRoots.forEach((r, i) => {
        inFoes(r, _a);
        _d.set(-vx * 0.05 + Math.sin(c.now / 500 + i) * 0.05, -1, -vz * 0.05);
        const pts = legs[i].update(dt, _a, _d);
        place(legRods[i], pts);
        knees[i].forEach((k, j) => k.position.copy(pts[j + 1]));
        hooks[i].position.copy(pts.at(-1)); hooks[i].rotation.y = f.heading + i;
      });
      // the eye-spots burn white through the flash's wind-up
      glowM.uniforms.uGlow.value = 0.85 + open * 0.15;
      glowM.uniforms.uColor.value.set(open > 0.6 ? '#ffffff' : P.glow);
      spotM.uniforms.uGlow.value = 0.5 + open * 0.5;
      lanternM.uniforms.uGlow.value = 0.55 + open * 0.3 + flutter * 0.2;
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#f05a3c'));
      if (flutter > 0.3 && Math.random() < 0.5) c.dust(f.chest, P.wing2, 1, 0.5);
    },
    dispose: M.dispose,
  };
}
