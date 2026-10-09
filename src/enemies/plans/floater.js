import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { VerletChain, Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, pivot, lerp, ease, eyeColor, finish } from './kit.js';

// Plan 11, the floater (docs/systems/procedural-animation.md §4): the lantern jelly (docs/design/enemy-roster.md,
// archetype 9), the support. A floating bell-cap with long trailing threads and two or three glowing lanterns hanging
// under it: from far off, a floating lamp.
//
// On the kit (phase 4, src/motion-kit/chain.js): the bell pulses on a phase accumulator (Wave) whose rate rises as it
// winds up (the telegraph), it bobs, tilts into its drift on a spring; its threads and its lanterns hang on verlet
// chains that trail behind as it moves and swing as it pulses.
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   ward     a lantern swells and brightens, the bell pulsing faster; then a thread of light runs to the foe it guards
//   mend     (tier-2 skins) it sinks low over a hurt foe (in reach), its lanterns pouring light
//   curtain  the bell clenches, its threads drawn up; then they drop to the ground, stinging, for two seconds
// A shot or the boomerang pops a lantern (the ward it held ends): Foe.pop.
// Skins (src/enemies/skins.js): a pink puffy cloud jelly with paper lanterns, a red lamp jelly with brass lanterns, a
// halo jelly with prism lanterns and a halo, a porcelain jelly with glass floats, a teal sun jelly with an orange core.
// Drawn to its picked sheet: references/enemy-archetypes/jelly/sheet-1.jpg (the cloud jelly).

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);

export function jellyModel(skin) {
  const PL = PLANS.floater, P = skin.palette, props = new Set(skin.props), M = materials('jelly', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  const bellM = M.mat('bell', P.bell, { color2: P.bell2, side: THREE.DoubleSide }), darkM = M.mat('dark', P.dark, { flat: true });
  const threadM = M.mat('thread', P.thread, { flat: true, line: 0.3, lineTint: 0.75 }), lanternM = M.mat('lantern', P.lantern), eyeM = M.own('eye', P.eye, { glow: 0.6 });
  const body = pivot(g, 0, 0, 0, 'body');
  const bell = pivot(body, 0, 0.6, 0, 'bell');
  // (the sheet's: a broad puffy dome, flat-bottomed, wider than the traveller is tall, pale underneath)
  const cap = add(bell, new THREE.SphereGeometry(1.1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(1, 0.78, 1), bellM);
  add(bell, new THREE.CircleGeometry(1.06, 22).rotateX(Math.PI / 2), M.mat('under', P.under ?? P.bell2, { side: THREE.DoubleSide }), 0, -0.04, 0);
  const rim = add(bell, new THREE.TorusGeometry(1.04, 0.09, 6, 28).rotateX(Math.PI / 2), bellM, 0, -0.02, 0);
  if (props.has('puffy')) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; add(bell, new THREE.SphereGeometry(0.34, 10, 8).scale(1, 0.7, 1), bellM, Math.sin(a) * 0.82, 0.18, Math.cos(a) * 0.82); }
  if (props.has('halo')) { const h = add(bell, new THREE.TorusGeometry(0.9, 0.035, 6, 28).rotateX(Math.PI / 2), M.own('halo', P.light, { glow: 0.8 }), 0, 1.15, 0); h.userData.halo = true; }
  const eyes = [-1, 1].map((s) => add(bell, new THREE.SphereGeometry(0.07, 8, 6), eyeM, s * 0.46, 0.2, 0.98));   // (wide-set, low on its front)
  const core = props.has('core') ? add(bell, new THREE.SphereGeometry(0.42, 12, 8), M.own('core', P.light, { glow: 0.9 }), 0, 0.12, 0) : null;
  // the threads: verlet chains hung round the rim, drawn as thin rods (in the foes' space)
  const TH = PL.threads, holder = pivot(g, 0, 0, 0, 'threads (foes space)'); holder.matrixAutoUpdate = false;
  const threads = Array.from({ length: TH.n }, (_, i) => {
    const a = (i / TH.n) * Math.PI * 2 + 0.3;
    const ch = new VerletChain({ n: TH.links, length: TH.length, stiffness: 0.06, damping: 0.9, gravity: 4 });
    const rods = Array.from({ length: TH.links }, (_, j) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028 - j * 0.002, 1, 5).translate(0, 0.5, 0), threadM); holder.add(m); return m; });
    return { a, ch, rods, root: pivot(bell, Math.sin(a) * (0.35 + (i % 2) * 0.45), -0.06, Math.cos(a) * (0.35 + (i % 2) * 0.45)) };
  });
  // the lanterns: two or three, each on a short chain from under the bell; their light is their own (it swells)
  const NL = 3;
  const lanterns = Array.from({ length: NL }, (_, i) => {
    const a = (i / NL) * Math.PI * 2;
    const light = M.own(`light${i}`, P.light, { glow: 0.75 });
    const ch = new VerletChain({ n: 3, length: [0.3, 0.42, 0.34][i], stiffness: 0.12, damping: 0.88, gravity: 5 });
    const cord = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4).translate(0, 0.5, 0), darkM); holder.add(m); return m; });
    const lamp = new THREE.Group(); holder.add(lamp);
    if (props.has('prism')) lamp.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0).scale(1, 1.4, 1), light));
    else if (props.has('float')) { lamp.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), light)); lamp.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 4, 14), darkM)); }
    else {
      lamp.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10).scale(1, 1.25, 1), light));
      for (const y of [-0.23, 0.23]) { const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 10), lanternM); cp.position.y = y; lamp.add(cp); }
    }
    return { light, ch, cord, lamp, root: pivot(bell, [-0.5, 0, 0.5][i], -0.06, [0.25, 0.55, 0.25][i]) };   // (spread under its front half)
  });
  // the ward's thread of light: a glowing rod from a lantern to the foe it guards (in the foes' space)
  const wardM = M.own('ward', P.light, { glow: 1 });
  const wardRods = Array.from({ length: NL }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).translate(0, 0.5, 0), wardM); m.visible = false; holder.add(m); return m; });
  finish(g);
  const wave = new Wave(Math.random());
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p, y: p.y ?? 0 }])), style: PL.style });
  const tiltX = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0), tiltZ = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0);
  const prev = { x: null, z: 0 };
  let clench = 0, swell = 0, curtain = 0;
  /** an object's position in the foes' space */
  const inFoes = (o, out) => { _m.identity(); for (let x = o; x && x !== g; x = x.parent) { if (x.matrixAutoUpdate) x.updateMatrix(); _m.premultiply(x.matrix); } return out.setFromMatrixPosition(_m.premultiply(g.matrix)); };
  const place = (rods, pts) => rods.forEach((m, j) => { m.position.copy(pts[j]); _a.subVectors(pts[j + 1], pts[j]); const l = _a.length(); m.scale.set(1, Math.max(1e-3, l), 1); if (l > 1e-6) m.quaternion.setFromUnitVectors(UP, _a.divideScalar(l)); });
  return {
    group: g, body, wave, parts: [cap, rim, ...lanterns.map((l) => l.lamp)], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.bell, P.light, P.thread],
    tell: (id) => (id === 'curtain' ? rim : lanterns[0].lamp),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z;
      const B = PL.body, P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      g.position.y += f.alt + Math.sin(c.now / 700 + f.home.x) * B.bob;
      // tilts into its drift (the velocity in its own frame)
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      body.rotation.set(tiltX.update(dt, THREE.MathUtils.clamp(fwd * B.tilt, -B.tiltMax, B.tiltMax)) + P0.pitch, 0, tiltZ.update(dt, THREE.MathUtils.clamp(-side * B.tilt, -B.tiltMax, B.tiltMax)) + P0.roll);
      body.position.y = id === 'mend' ? 0 : P0.y;   // (the mend's sink is the mind's: it comes down out of the air)
      // the pulse: its rate rises through a wind-up (the telegraph); the bell clenches for the curtain
      clench = ease(clench, id === 'curtain' && wind ? c.wind : 0, 10, dt);
      swell = ease(swell, (id === 'ward' || id === 'mend') && wind ? c.wind : 0, 8, dt);
      curtain = ease(curtain, id === 'curtain' && strike ? 1 : 0, strike ? 12 : 3, dt);
      const BL = PL.bell;
      wave.update(dt, lerp(BL.rate[0], BL.rate[1], Math.max(wind ? c.wind : 0, clench)));
      const pulse = Math.sin(wave.phase * Math.PI * 2);
      bell.scale.set((1 + pulse * BL.squash) * (1 - clench * 0.25), (1 - pulse * BL.squash * 0.7) * (1 + clench * 0.2), (1 + pulse * BL.squash) * (1 - clench * 0.25));
      bell.position.y = 0.6 + pulse * 0.04;
      if (core) core.scale.setScalar(1 + pulse * 0.1 + swell * 0.3);
      bell.children.forEach((x) => { if (x.userData.halo) x.rotation.z += dt * 0.6; });
      // the chains, in the foes' space
      g.updateMatrix(); holder.matrix.copy(_m.copy(g.matrix).invert()); holder.matrixWorldNeedsUpdate = true;
      threads.forEach((t, i) => {
        inFoes(t.root, _b);
        // drawn up into the clench, dropped to the ground in the curtain (the links stretched to reach it), else hanging
        const reach = f.alt + 0.5;
        t.ch.length = lerp(TH.length, Math.max(TH.length, reach / TH.links), curtain) * (1 - clench * 0.55);
        t.ch.stiffness = curtain > 0.5 ? 0.6 : 0.06;
        _d.set(Math.sin(t.a) * 0.15 - vx * 0.04, -1, Math.cos(t.a) * 0.15 - vz * 0.04);
        place(t.rods, t.ch.update(dt, _b, curtain > 0.5 ? DOWN : _d));
      });
      // the lanterns: one popped is gone; the warding one swells; the wards' threads of light to the foes they guard
      const left = f.lanterns ?? NL;
      lanterns.forEach((L, i) => {
        const on = i < left;
        L.lamp.visible = on; L.cord.forEach((m) => { m.visible = on; });
        if (!on) return;
        inFoes(L.root, _b);
        const pts = L.ch.update(dt, _b, DOWN);
        place(L.cord, pts);
        L.lamp.position.copy(pts.at(-1)); L.lamp.position.y -= 0.12;
        const warding = (f.wards ?? [])[i];
        const s = 1 + (i === (f.wards?.length ?? 0) ? swell * 0.5 : 0) + pulse * 0.04;
        L.lamp.scale.setScalar(s);
        L.light.uniforms.uGlow.value = 0.75 + (warding ? 0.25 : 0) + (i === (f.wards?.length ?? 0) ? swell * 0.25 : 0);
        const R = wardRods[i];
        R.visible = !!warding && warding.alive && warding.dead === undefined;
        if (R.visible) { _a.copy(warding.chest); _d.subVectors(_a, L.lamp.position); const l = _d.length(); R.position.copy(L.lamp.position); R.scale.set(1, l, 1); R.quaternion.setFromUnitVectors(UP, _d.divideScalar(l || 1)); }
      });
      for (let i = left; i < NL; i++) wardRods[i].visible = false;
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      if (id === 'mend' && wind && Math.random() < 0.6 && f.allyTarget) c.spray(f.allyTarget.chest, [P.light, '#ffffff'], 2, 1.5, -2);
    },
    dispose: M.dispose,
  };
}
