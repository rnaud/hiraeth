import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { FollowChain, Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder, SecondOrderAngle } from '../../motion-kit/spring.js';
import { materials, add, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 14, the winged glider (docs/systems/procedural-animation.md §4): the sky ray (docs/design/enemy-roster.md,
// archetype 11), the air striker. A broad flat diamond against the sky with a long whip tail; two little horns at its
// front edge.
//
// On the kit (phase 4, src/motion-kit/chain.js): each wing is a chain of strips from the root to the tip, each turned
// by a travelling wave on a phase accumulator (Wave), so the tips lag behind the root and the beat's rate follows the
// speed without ever jumping; it banks into its turns (bank = turn rate × speed, on a spring) and pitches with its
// acceleration; the tail drags behind on a follow-the-leader chain with an angle limit (FollowChain).
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   skim    it climbs, banks round onto its line at you and sweeps its wings back, the beat stilled; then the run in low
//   lash    the whip tail lifts high behind it, then cracks down
//   draft   (Vael, Vael II) it stalls over you, its wings raised high, and beats them down hard
// Parried in a skim, it ploughs into the ground and lies there, wings flat, open (onParry 'ground').
// Skins (src/enemies/skins.js): a rust-red storm ray with dark spots, a pale cloud ray trailing mist, a scrap ray of
// patched canvas and wire, a faceted glass manta, a porcelain ray with ribbon fins, a dark abyss ray with a long tail.
// Drawn to its picked sheet: references/enemy-archetypes/ray/sheet-1.jpg (the storm ray).

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
// the diamond's outline (x out along the span, z ahead): the nose, the wing tip, the tail root
const NOSE = 0.85, TIP = [2.0, -0.15], TAILZ = -0.8;
/** The wing's leading and trailing edge (z) at span x. */
const lead = (x) => lerp(NOSE * 0.55, TIP[1], x / TIP[0]), trail = (x) => lerp(TAILZ, TIP[1], Math.pow(x / TIP[0], 0.8));

/** One strip of a wing from span x0 to x1 (the side s), as a flat quad in its own frame (pivot at x0). */
function strip(s, x0, x1) {
  const gq = new THREE.BufferGeometry();
  const v = [0, 0, lead(x0), s * (x1 - x0), 0, lead(x1), s * (x1 - x0), 0, trail(x1), 0, 0, trail(x0)];
  gq.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  gq.setIndex(s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  gq.computeVertexNormals();
  return gq;
}

export function rayModel(skin) {
  const PL = PLANS.glider, P = skin.palette, props = new Set(skin.props), M = materials('ray', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  const dark = props.has('dark');
  const topM = M.mat('top', P.top, { color2: P.top2, side: THREE.DoubleSide, lineWhite: dark });
  const underM = M.mat('under', P.under, { side: THREE.DoubleSide }), spotM = M.mat('spots', P.spots, { flat: true, side: THREE.DoubleSide });
  const tailM = M.mat('tail', P.tail, { flat: true, lineWhite: dark }), edgeM = M.mat('edge', P.edge ?? P.spots, { flat: true }), eyeM = M.own('eye', P.eye, { glow: 0.8 });
  const body = pivot(g, 0, 0, 0, 'body');
  const frame = pivot(body, 0, 0, 0, 'frame');   // (banked and pitched)
  // the body: a low ridge along the middle, pale under
  const ridge = add(frame, new THREE.SphereGeometry(1, 16, 8).scale(0.36, 0.07, 0.78), topM, 0, 0.01, -0.02);
  add(frame, new THREE.SphereGeometry(1, 14, 6).scale(0.4, 0.07, 0.78), underM, 0, -0.04, 0);
  // the head: a rounded lobe at the front edge with two bulging eyes on top (the sheet's)
  const lobe = add(frame, new THREE.SphereGeometry(1, 12, 8).scale(0.3, 0.13, 0.22), topM, 0, 0.03, NOSE * 0.62);
  const horns = pair((s) => add(frame, new THREE.SphereGeometry(0.085, 10, 8), topM, s * 0.14, 0.12, NOSE * 0.66));
  const eyes = pair((s) => add(frame, new THREE.SphereGeometry(0.05, 8, 6), eyeM, s * 0.14, 0.15, NOSE * 0.66 + 0.05));
  // the wings: strips root to tip, each a pivot on the last (the wave turns each a little more: the tip lags)
  const S = PL.wing.strips, x0 = 0.32;
  const wings = pair((s) => {
    const sweep = pivot(frame, s * x0, 0, 0, 'wing');   // (swept back about the root for the skim)
    let parent = sweep, at = x0;
    const strips = [];
    for (let k = 0; k < S; k++) {
      const x1 = x0 + ((TIP[0] - x0) * (k + 1)) / S;
      const pv = pivot(parent, k === 0 ? 0 : s * ((TIP[0] - x0) / S), 0, 0, `strip ${k}`);
      const top = new THREE.Mesh(strip(s, at, x1), topM); pv.add(top);
      const under = new THREE.Mesh(strip(s, at, x1), underM); under.position.y = -0.012; pv.add(under);
      // the pale margin along its edges (the sheet's blue rim)
      { const w = x1 - at; rod(pv, [0, 0, lead(at)], [s * w, 0, lead(x1)], 0.028, edgeM); rod(pv, [0, 0, trail(at)], [s * w, 0, trail(x1)], 0.028, edgeM); if (k === S - 1) rod(pv, [s * w, 0, lead(x1)], [s * w, 0, trail(x1)], 0.028, edgeM); }
      if (props.has('spots') || props.has('patches')) for (let j = 0; j < 2; j++) { const sx = s * ((x1 - at) * (0.3 + j * 0.4)), z = lerp(lead(at), trail(at), 0.35 + j * 0.2); add(pv, new THREE.CircleGeometry(props.has('patches') ? 0.12 : 0.07 + k * 0.01, props.has('patches') ? 4 : 8).rotateX(-Math.PI / 2), spotM, sx, 0.012, z); }
      if (props.has('facets')) add(pv, new THREE.OctahedronGeometry(0.06, 0), spotM, s * (x1 - at) * 0.5, 0.03, lerp(lead(at), trail(at), 0.5));
      if (props.has('ribbons') && k === S - 1) { const rb = add(pv, new THREE.PlaneGeometry(0.08, 0.9).rotateX(-Math.PI / 2).translate(0, 0, -0.45), M.mat('ribbon', P.spots, { flat: true, side: THREE.DoubleSide }), s * (x1 - at) * 0.6, 0, trail(x1)); rb.userData.ribbon = true; }
      strips.push(pv); parent = pv; at = x1;
    }
    if (props.has('wire')) add(sweep, new THREE.CylinderGeometry(0.01, 0.01, TIP[0], 4).rotateZ(Math.PI / 2).translate(s * TIP[0] * 0.5, 0.02, 0.1), tailM);
    return { sweep, strips };
  });
  // the tail: a follow-the-leader chain from the tail root, drawn as tapering rods, a barb at its end
  const T = PL.tail, tailN = props.has('long') ? T.n + 4 : T.n;
  const tail = new FollowChain({ n: tailN, length: T.length, maxBend: T.maxBend, straighten: 2 });
  const tailRoot = pivot(frame, 0, 0, TAILZ + 0.05, 'tail root');
  const holder = pivot(g, 0, 0, 0, 'tail (path space)'); holder.matrixAutoUpdate = false;
  const rods = Array.from({ length: tailN }, (_, i) => { const r = lerp(0.05, 0.012, i / tailN); const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, 1, 5).translate(0, 0.5, 0), tailM); holder.add(m); return m; });
  const barb = add(holder, new THREE.ConeGeometry(0.04, 0.2, 4), tailM);
  const beads = Array.from({ length: tailN }, (_, i) => add(holder, new THREE.SphereGeometry(lerp(0.06, 0.02, i / tailN), 6, 4), tailM));   // (the segmented whip)
  const mist = props.has('mist') ? Array.from({ length: 4 }, (_, i) => add(holder, new THREE.SphereGeometry(0.16 - i * 0.025, 8, 6), M.mat('mist', '#ffffff', { flat: true }))) : [];
  finish(g);
  const wave = new Wave(Math.random());
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const bank = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0), pitch = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0), yaw = new SecondOrderAngle(1.5, 0.8, 0);
  const prev = { x: null, z: 0, speed: 0, heading: 0 };
  let sweepK = 0, raise = 0, lashK = 0, grounded = 0;
  return {
    group: g, body, wave, tail, wings: wings.map((w) => w.strips[0].children[0]), parts: [ridge, ...wings.map((w) => w.sweep), ...rods], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.top, P.under, P.spots],
    tell: (id) => (id === 'lash' ? barb : id === 'draft' ? wings[1].strips[S - 1] : lobe),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      g.position.y += f.alt;
      // its motion: speed, turn rate, acceleration (in the foes' space)
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      const speed = Math.min(12, Math.hypot(vx, vz)), acc = (speed - prev.speed) / dt;
      const hd = yaw.update(dt, f.heading), turn = Math.atan2(Math.sin(f.heading - prev.heading), Math.cos(f.heading - prev.heading)) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z; prev.speed = speed; prev.heading = f.heading;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      // the skim: wings swept back, the beat stilled, banking round onto its line; the draft: wings raised high
      sweepK = ease(sweepK, id === 'skim' && (wind || strike) ? (wind ? c.wind : 1) : 0, 8, dt);
      raise = ease(raise, id === 'draft' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, 7, dt);
      lashK = ease(lashK, id === 'lash' ? (wind ? c.wind : strike ? -1 : 0) : 0, strike ? 20 : 9, dt);
      grounded = ease(grounded, f.stunned > 0 && f.alt < 0.6 ? 1 : 0, 6, dt);
      const B = PL.body, flying = 1 - grounded;
      const b = bank.update(dt, THREE.MathUtils.clamp(-turn * Math.max(speed, 2) * B.bank, -B.bankMax, B.bankMax) * flying + (id === 'skim' && wind ? Math.sin(c.wind * Math.PI) * 0.5 : 0));
      const pt = pitch.update(dt, THREE.MathUtils.clamp(acc * B.pitch, -0.3, 0.3) * flying);
      frame.rotation.set(pt + P0.pitch * flying, hd - f.heading, b + P0.roll, 'YXZ');
      body.position.set(0, P0.y * flying - grounded * (f.alt - 0.12), P0.z * flying);
      // the wave across the span: faster with speed and through the draft's beats, stilled in the skim's sweep and on the ground
      const W = PL.wing, rate = lerp(W.rate[0], W.rate[1], Math.min(1, speed / 6)) * (1 + raise * 0.8);
      wave.update(dt, rate * (1 - sweepK * 0.85) * flying);
      wings.forEach((w, i) => {
        const s = i ? 1 : -1;
        w.sweep.rotation.y = s * sweepK * 0.55;   // (swept back)
        w.strips.forEach((st, k) => {
          const amp = W.amp * (1 - sweepK * 0.8) * flying + raise * (k === 0 ? 0.55 : 0.12);
          st.rotation.z = s * (wave.angle(k, amp, W.lag) + (k === 0 ? raise * 0.5 - grounded * 0.05 : 0));
        });
        w.strips.at(-1).children.forEach((x) => { if (x.userData.ribbon) x.rotation.x = Math.sin(c.now / 200 + i) * 0.4; });
      });
      // the tail: from its root (in the foes' space) back along the body, lifted high for the lash, cracking down
      g.updateMatrix(); holder.matrix.copy(_m.copy(g.matrix).invert()); holder.matrixWorldNeedsUpdate = true;
      tailRoot.updateMatrix(); frame.updateMatrix(); body.updateMatrix();
      _a.set(0, 0, TAILZ + 0.05).applyMatrix4(frame.matrix).applyMatrix4(body.matrix).applyMatrix4(g.matrix);
      _d.set(-Math.sin(hd), lashK > 0 ? lashK * 1.4 : lashK * 0.6 - 0.05, -Math.cos(hd));
      const pts = tail.update(_a, _d, dt);
      rods.forEach((m, i) => { m.position.copy(pts[i]); _b.subVectors(pts[i + 1], pts[i]); const l = _b.length(); m.scale.set(1, l, 1); if (l > 1e-6) m.quaternion.setFromUnitVectors(UP, _b.divideScalar(l)); });
      beads.forEach((x, i) => x.position.copy(pts[i]));
      barb.position.copy(pts.at(-1)); barb.quaternion.copy(rods.at(-1).quaternion);
      mist.forEach((m, i) => { m.position.copy(pts[Math.min(pts.length - 1, 2 + i * 2)]); m.scale.setScalar(1 + Math.sin(c.now / 300 + i) * 0.2); });
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      if (grounded > 0.5 && Math.random() < 0.15) c.dust(f.pos, '#cdb89a', 1, 1);
    },
    dispose: M.dispose,
  };
}
