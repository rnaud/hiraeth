import * as THREE from 'three';
import { materials, add, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 20, the blob (docs/systems/procedural-animation.md §4): the ink blot (docs/design/enemy-roster.md,
// archetype 18), the rusher and the game's first teacher, drawn to its sheets (references/enemy-archetypes/blot/:
// sheet-1 the Desert's sand-edged blot, sheet-2 the Sealed Hangar's rust-edged one). Loose ink with no body borrowed:
// a glossy drop 0.8 m tall, at your thigh, round and heavy below and drawn up into a splashing point that sweeps
// back, violet light on its gloss, two big round cream eyes with dark pupils low on its front, droplets flying off
// it; at its foot it pools, and the pool's rim takes the ground's own colour (sand in the Desert, moss in Lorn, rust
// and oily teal in the Hangar: src/enemies/skins.js).
//
// It hops with squash and stretch, the hop's phase following the distance it covers (not a clock: it never skates);
// left alone it pools into a low stain with its eyes on top, and stands up as you come near. Its wind-ups:
//   lunge, combo   it coils down into a flattened spring of stacked rings, leaning back, then springs
//   spit           it rears up tall and thin, leaning over you, and lobs a glob (the one move with a landing mark)

const STRIDE = 1.2, HOP = 0.3;
/** The drop's profile, bottom up: a round heavy base drawn up into a point (its tip swept back after). */
const DROP = [[0.001, 0.02], [0.34, 0.04], [0.45, 0.13], [0.47, 0.25], [0.43, 0.38], [0.33, 0.52], [0.2, 0.64], [0.1, 0.74], [0.045, 0.83], [0.001, 0.9]].map(([r, y]) => new THREE.Vector2(r, y));
const radiusAt = (y) => { for (let i = 1; i < DROP.length; i++) if (DROP[i].y >= y) { const a = DROP[i - 1], b = DROP[i]; return lerp(a.x, b.x, (y - a.y) / (b.y - a.y)); } return 0; };
/** A ragged pool's outline (radius r, its splashes at every other point). */
function ragged(r, n, seed) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, k = r * (1 + (i % 2 ? 0.14 : -0.06) + Math.sin(i * 2.7 + seed) * 0.09); s[i ? 'lineTo' : 'moveTo'](Math.sin(a) * k, Math.cos(a) * k); }
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

export function blotModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('blot', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  const inkM = M.mat('ink', P.ink, { flat: true }), edgeM = M.mat('edge', P.edge, { flat: true }), shineM = M.mat('shine', P.shine ?? '#5a4a8a', { flat: true });
  const edge2M = P.edge2 ? M.mat('edge2', P.edge2, { flat: true }) : null, pupilM = M.mat('pupil', '#15121a', { flat: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.6 });
  const body = pivot(g, 0, 0, 0, 'drop');
  // the drop, its tip swept back and a little aside
  const geo = new THREE.LatheGeometry(DROP, 22), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = Math.max(0, (y - 0.42) / 0.48); pos.setZ(i, pos.getZ(i) - k * k * 0.2); pos.setX(i, pos.getX(i) + k * k * k * 0.05); }
  geo.computeVertexNormals();
  const drop = add(body, geo, inkM);
  // the gloss: violet light along its left flank and over its crown
  const shine = [[-0.62, 0.28, 0.022, 0.15], [-0.78, 0.47, 0.018, 0.12], [-0.35, 0.62, 0.014, 0.09], [0.8, 0.22, 0.016, 0.08]].map(([a, y, w, h]) => {
    const r = radiusAt(y) + 0.004, k = Math.max(0, (y - 0.42) / 0.48), m = add(body, new THREE.SphereGeometry(1, 8, 6).scale(w, h, 0.012), shineM, Math.sin(a) * r + k * k * k * 0.05, y, Math.cos(a) * r - k * k * 0.2);
    m.rotation.y = a; m.rotation.z = -0.25; return m; });
  // the splash at its tip, and droplets flung off it (never quite the same twice)
  const drips = [];
  for (const [x, y, z, s] of [[0.02, 0.97, -0.26, 0.03], [0.08, 1.05, -0.3, 0.02], [-0.06, 1.0, -0.12, 0.018], [0.36, 0.5, 0.05, 0.025], [-0.42, 0.36, -0.12, 0.022]]) drips.push(add(body, new THREE.SphereGeometry(s, 6, 4).scale(1, 1.4, 1), inkM, x, y + Math.random() * 0.03, z));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6 + Math.random() * 0.4, len = 0.12 + Math.random() * 0.1;
    const c = add(body, new THREE.ConeGeometry(0.035, len, 5), inkM, Math.sin(a) * 0.44, 0.14 + Math.random() * 0.12, Math.cos(a) * 0.44);
    c.lookAt(c.position.x * 3, c.position.y - 0.3, c.position.z * 3); c.rotateX(Math.PI / 2); drips.push(c);
  }
  // the pool at its foot: ink over a ragged rim of the ground's colour where the ink has soaked up the world
  const rim = add(body, ragged(0.62, 22, 1), edgeM, 0, 0.012, 0);
  const rim2 = edge2M ? add(body, ragged(0.5, 18, 4), edge2M, 0.08, 0.016, -0.05) : null;
  const pool = add(body, ragged(0.5, 20, 2), inkM, 0, 0.02, 0);
  const flecks = Array.from({ length: 7 }, (_, i) => { const a = i * 0.9 + 0.3, r = 0.46 + (i % 2) * 0.04; return add(body, new THREE.SphereGeometry(0.05, 6, 4).scale(1, 0.5, 1), i % 3 === 2 && edge2M ? edge2M : edgeM, Math.sin(a) * r, 0.04, Math.cos(a) * r); });
  // metal shavings stuck in it (the Hangar)
  if (props.has('shavings')) {
    const steelM = M.mat('steel', '#b8b0a0', { metal: 'brass', color: '#b89a6a' });
    for (const [a, y, l] of [[0.5, 0.42, 0.07], [-0.7, 0.3, 0.06], [1.6, 0.22, 0.08], [-1.9, 0.5, 0.05], [2.6, 0.34, 0.07], [0.1, 0.7, 0.05]]) {
      const r = radiusAt(y), k = Math.max(0, (y - 0.42) / 0.48), m = add(body, new THREE.CylinderGeometry(0.012, 0.012, l, 6), steelM, Math.sin(a) * r, y, Math.cos(a) * r - k * k * 0.2);
      m.rotation.set(0.6, a, 0.9); drips.push(m);
    }
  }
  // its coils: as it winds up a lunge it sinks into a flattened spring of stacked rings
  const coils = [0.07, 0.17, 0.27].map((y, i) => { const t = add(body, new THREE.TorusGeometry(0.44 - i * 0.07, 0.07, 8, 26).rotateX(Math.PI / 2), inkM, 0, y, -i * 0.03); t.visible = false; return t; });
  // two big round cream eyes, low on its front, dark pupils looking at you
  const eyes = pair((s) => { const x = s * 0.15, y = 0.3, z = Math.sqrt(Math.max(0, radiusAt(y) ** 2 - x * x)) - 0.01; const e = pivot(body, x, y, z);
    e.lookAt(V(x * 2.2, y, z + 1)); add(e, new THREE.SphereGeometry(0.078, 12, 8).scale(1, 1, 0.35), eyeM); add(e, new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1, 0.4), pupilM, 0, 0, 0.026); return e; });
  const mouth = pivot(body, 0, 0.55, 0.3);   // (where the spit gathers)
  finish(g);
  let phase = Math.random(), up = 1, last = null, coil = 0, rear = 0;
  return {
    group: g, body, parts: [drop, ...drips, rim, ...eyes], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.ink, P.shine ?? '#3b3350', P.edge],
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
      const wob = Math.sin(c.now / 160 + f.home.x) * 0.04;
      const sy = lerp(0.47, 1, up) * (1 - coil * 0.45 - land * 0.14 + h * 0.12 + rear * 0.6 - stretch * 0.12) - wob;
      const sxz = lerp(1.5, 1, up) * (1 + coil * 0.22 + land * 0.12 - rear * 0.3 - stretch * 0.1) + wob;
      body.scale.set(sxz, sy, sxz * (1 + stretch * 0.6));
      body.position.y = h * HOP + (strike && f.atk?.lunge ? Math.sin(Math.PI * f.k) * 0.25 : 0);
      body.rotation.x = -coil * 0.2 + stretch * 0.35 + rear * 0.42;
      // the coiled spring: its rings show as it sinks, the drop pressed down into them
      coils.forEach((t, i) => { t.visible = coil > 0.12; t.scale.set(1, 1 + coil * 0.6, 1); t.position.y = (0.07 + i * 0.1) * (0.6 + coil * 0.7); });
      drop.scale.set(1 - coil * 0.12, 1 - coil * 0.25, 1 - coil * 0.12);
      rim.scale.setScalar(1 + coil * 0.2); if (rim2) rim2.scale.setScalar(1 + coil * 0.2);
      pool.scale.setScalar(1 + coil * 0.15 + (1 - up) * 0.1);
      // the spit: the glob in the air over the last half of the wind-up, onto its landing mark
      if (id === 'spit' && wind && f.k > 0.45) c.lob(f, (f.k - 0.45) / 0.55, P.ink); else c.lob(f, -1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#f05a3c'));
    },
    dispose: M.dispose,
  };
}
