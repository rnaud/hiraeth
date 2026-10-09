import * as THREE from 'three';
import { materials, add, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 20, the blob (docs/systems/procedural-animation.md §4): the ink blot (docs/design/enemy-roster.md,
// archetype 18), the rusher and the game's first teacher. Loose ink with no body borrowed: a squat wobbling drop
// with two white eyes, 0.8 m, drips of ink round it, and at its foot a rim of the ground's own colour (sand in the
// Desert, moss in Lorn, rust in the Hangar: src/enemies/skins.js).
//
// It hops with squash and stretch, the hop's phase following the distance it covers (not a clock: it never skates);
// left alone it pools into a low stain with its eyes on top, and stands up as you come near. Its wind-ups:
//   lunge, combo   it coils into a flat puddle, leaning back, then springs
//   spit           it rears up tall and thin, and lobs a glob (the one move with a landing mark: it is thrown)
// Art match pending its sheet (docs/design/enemy-roster-prompts.md, `blot`).

const STRIDE = 0.9, HOP = 0.28;

export function blotModel(skin) {
  const P = skin.palette, M = materials('blot', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  const inkM = M.mat('ink', P.ink, { flat: true }), edgeM = M.mat('edge', P.edge, { flat: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.6 });
  const body = pivot(g, 0, 0, 0, 'drop');
  const drop = add(body, new THREE.IcosahedronGeometry(0.55, 2), inkM, 0, 0.55, 0);
  // drips and spikes of ink off it, never the same twice
  const drips = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5, len = 0.3 + Math.random() * 0.4;
    const c = add(body, new THREE.ConeGeometry(0.08 + Math.random() * 0.05, len, 5), inkM, Math.sin(a) * 0.45, 0.32 + Math.random() * 0.45, Math.cos(a) * 0.45);
    c.lookAt(c.position.x * 3, c.position.y - 0.6 + Math.random(), c.position.z * 3); c.rotateX(Math.PI / 2);
    drips.push(c);
  }
  // the rim of the ground's colour at its foot: where the ink has soaked up the world
  const rim = add(body, new THREE.TorusGeometry(0.5, 0.09, 6, 22).rotateX(Math.PI / 2), edgeM, 0, 0.1, 0);
  rim.scale.set(1, 1, 0.5);
  const flecks = Array.from({ length: 5 }, (_, i) => { const a = i * 1.3; return add(body, new THREE.SphereGeometry(0.06, 6, 4), edgeM, Math.sin(a) * 0.48, 0.22 + (i % 2) * 0.12, Math.cos(a) * 0.48); });
  const eyes = pair((s) => add(body, new THREE.SphereGeometry(0.075, 8, 6), eyeM, s * 0.17, 0.72, 0.46));
  const mouth = pivot(body, 0, 0.6, 0.55);   // (where the spit gathers)
  finish(g);
  let phase = Math.random(), up = 1, last = null, coil = 0, rear = 0;
  return {
    group: g, body, parts: [drop, ...drips, rim, ...eyes], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.ink, '#3b3350', P.edge],
    tell: (id) => (id === 'spit' ? mouth : eyes[0]),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the hop's phase by the distance covered
      const moved = last ? Math.hypot(f.pos.x - last.x, f.pos.z - last.z) : 0;
      last = (last ?? V()).copy(f.pos);
      if (moved < 1) phase = (phase + moved / STRIDE) % 1;
      const hopping = c.moving && moved > 1e-4;
      const h = hopping ? Math.sin(Math.PI * phase) : 0;
      // pooled while calm, standing as it comes for you
      up = ease(up, f.state === 'idle' && !f.provoked ? 0 : 1, f.provoked ? 6 : 2, dt);
      coil = ease(coil, (id === 'lunge' || id === 'combo' || id === 'again') && wind ? c.wind : 0, 14, dt);
      rear = ease(rear, id === 'spit' && wind ? c.wind : 0, 9, dt);
      const stretch = strike && f.atk?.lunge ? Math.sin(Math.PI * f.k) : 0;
      const land = hopping ? Math.max(0, 1 - phase * 5) + Math.max(0, phase * 5 - 4) : 0;   // (squashed as it lands and takes off)
      const wob = Math.sin(c.now / 160 + f.home.x) * 0.05;
      const sy = lerp(0.42, 1, up) * (1 - coil * 0.42 - land * 0.14 + h * 0.12 + rear * 0.55 - stretch * 0.12) - wob;
      const sxz = lerp(1.45, 1, up) * (1 + coil * 0.32 + land * 0.12 - rear * 0.28 - stretch * 0.1) + wob;
      body.scale.set(sxz, sy, sxz * (1 + stretch * 0.6));
      body.position.y = h * HOP + (strike && f.atk?.lunge ? Math.sin(Math.PI * f.k) * 0.25 : 0);
      body.rotation.x = -coil * 0.25 + stretch * 0.35 - rear * 0.15;
      rim.scale.set(1 + coil * 0.2, 1 + coil * 0.2, 0.5);
      // the spit: the glob in the air over the last half of the wind-up, onto its landing mark
      if (id === 'spit' && wind && f.k > 0.45) c.lob(f, (f.k - 0.45) / 0.55, P.ink); else c.lob(f, -1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#f05a3c'));
    },
    dispose: M.dispose,
  };
}
