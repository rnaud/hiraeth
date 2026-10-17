import * as THREE from 'three';
import { materials, add, pivot, ease, eyeColor, finish } from './kit.js';

// Plan 22, the ember shell: the ember wisp (issue #398; docs/design/fireball-foe.md), the bombardier. A STAND-IN body
// until the author picks its design sheet: a floating, slowly bobbing shell of hardened ink in two lids hinged at the
// back, a coal glowing inside it, two pale eyes on the upper lid, a tail of smoke beads hanging under it.
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   fireball  the lids part like a clam's, the coal swells and brightens white-hot, the body rears back; at the throw
//             it snaps forward, the lids clap shut (Foes.throwBall sends the ball from the coal)
//   flare     the lids clench shut and shake, the coal glowing through the seam; then the heat bursts round it
// Stunned by its own fire (src/fireballs.js), it drops low (the mind: Foe.update's HOVER), the lids hang open, the
// coal dimmed to an ember: cut it then.
// Skins (src/enemies/skins.js): the Moon Foundry's cinder wisp (orange coal), Lorn II's marsh wisp (a green
// marsh-light), the Eclipse's corona wisp (a ring of white fire round a black shell).

export const EMBER = {
  r: 0.55,            // the shell's radius (m)
  bob: 0.16,          // m it bobs, slowly
  open: [0.85, 0.5],  // rad the upper and the lower lid open at the full wind-up
  rear: 0.45,         // rad it rears back over the wind-up; snap: rad forward at the throw
  snap: 0.55,
  glow: [0.55, 1.25], // the coal's glow: at rest → the full wind-up (and the flare's seam)
  swell: 0.55,        // the coal's swelling at the full wind-up (share)
};

export function wispModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('wisp', skin), E = EMBER;
  const g = new THREE.Group(); g.name = skin.name;
  const shellM = M.mat('shell', P.shell, { color2: P.shell2, side: THREE.DoubleSide }), rimM = M.mat('rim', P.rim), smokeM = M.mat('smoke', P.smoke, { flat: true });
  const coreM = M.own('core', P.core, { glow: E.glow[0] }), eyeM = M.own('eye', P.eye, { glow: 0.7 });
  const body = pivot(g, 0, 0, 0, 'body');
  // the coal, in the middle of the shell; the ball is thrown from it
  const core = add(body, new THREE.IcosahedronGeometry(0.3, 2), coreM);
  // the two lids, hinged at the back (their geometry's centre 0.5 m in front of the hinge)
  const hinge = -E.r * 0.9;
  const lid = (top) => {
    const p = pivot(body, 0, 0, hinge, top ? 'upper lid' : 'lower lid');
    const geo = new THREE.SphereGeometry(E.r, 20, 10, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2).scale(1, top ? 0.85 : 0.7, 1).translate(0, 0, -hinge);
    add(p, geo, shellM);
    add(p, new THREE.TorusGeometry(E.r, 0.035, 5, 28).rotateX(Math.PI / 2).translate(0, 0, -hinge), rimM);
    return p;
  };
  const upper = lid(true), lower = lid(false);
  const eyes = [-1, 1].map((s) => add(upper, new THREE.SphereGeometry(0.06, 8, 6), eyeM, s * 0.19, E.r * 0.55, -hinge + E.r * 0.66));
  // a fin of hardened ink along the upper lid's crown (its silhouette's one point), a ring of fire for the corona wisp
  add(upper, new THREE.ConeGeometry(0.12, 0.42, 6).rotateX(-Math.PI / 2.4), shellM, 0, E.r * 0.82, -hinge - 0.15);
  const corona = props.has('corona') ? add(body, new THREE.TorusGeometry(E.r + 0.22, 0.03, 5, 32), M.own('corona', P.fire, { glow: 0.9 })) : null;
  // the smoke under it: beads hanging from the lower lid, swinging behind its drift
  const tail = [0, 1, 2].map((i) => add(body, new THREE.SphereGeometry(0.13 - i * 0.03, 8, 6), smokeM, 0, -E.r * 0.8 - i * 0.24, 0));
  finish(g);
  const prev = { x: null, z: 0, state: 'idle' };
  let open = 0, clench = 0, kick = 0, glowK = 0;
  return {
    group: g, body, parts: [upper.children[0], lower.children[0], core], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.core, P.fire],
    tell: () => core,
    /** Where the ball leaves it: the coal, in the world. */
    mouthAt: (out = new THREE.Vector3()) => { g.updateMatrixWorld(true); return core.getWorldPosition(out); },
    fire: P.fire, coreTone: P.core,
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', stunned = f.stunned > 0;
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z;
      // (out of the fireball's wind-up: thrown, it snaps forward)
      if (prev.state === 'wind' && !wind && f.atk?.ball && !stunned) kick = 1;
      prev.state = f.state;
      kick = Math.max(0, kick - dt * 3.5);
      g.position.y += f.alt + Math.sin(c.now / 650 + f.home.x) * E.bob * (stunned ? 0.3 : 1);
      const throwing = wind && id === 'fireball', flaring = wind && id === 'flare';
      open = ease(open, throwing ? THREE.MathUtils.smoothstep(f.k, 0, 0.85) : stunned ? 0.35 : 0, throwing ? 9 : kick > 0 ? 18 : 5, dt);
      clench = ease(clench, flaring ? 1 : 0, 10, dt);
      const shake = clench * Math.sin(c.now / 22) * 0.05;
      upper.rotation.x = -E.open[0] * open + clench * 0.06;
      lower.rotation.x = E.open[1] * open - clench * 0.04;
      // reared back through the wind-up, snapping forward at the throw; tilted into its drift
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      body.rotation.set(-E.rear * open + E.snap * Math.sin(Math.PI * kick) + THREE.MathUtils.clamp(fwd * 0.05, -0.3, 0.3), 0, THREE.MathUtils.clamp(-side * 0.05, -0.3, 0.3) + shake);
      body.position.y = clench * -0.1;
      // the coal: swelling and brightening through a wind-up, dimmed to an ember stunned
      const want = stunned ? 0.2 : throwing ? f.k : flaring ? f.k : 0;
      glowK = ease(glowK, want, 8, dt);
      core.scale.setScalar((1 + E.swell * glowK - (stunned ? 0.25 : 0)) * (1 + 0.05 * Math.sin(c.now / 90)));
      coreM.uniforms.uGlow.value = stunned ? 0.25 : THREE.MathUtils.lerp(E.glow[0], E.glow[1], glowK);
      if (corona) { corona.rotation.z += dt * (0.8 + 3 * glowK); corona.scale.setScalar(1 + 0.2 * glowK); }
      tail.forEach((b, i) => { b.position.x = -side * 0.03 * (i + 1) + Math.sin(c.now / 400 + i) * 0.03; b.position.z = -fwd * 0.04 * (i + 1); });
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      for (const e of eyes) e.scale.y = stunned ? 0.35 : 1;
      // embers off the coal as it winds up
      if (throwing && Math.random() < 0.5 * f.k) { core.getWorldPosition(_w); c.spray(_w, [P.core, P.fire], 1, 1.4, -1); }
    },
    dispose: M.dispose,
  };
}
const _w = new THREE.Vector3();
