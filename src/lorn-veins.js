import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { mulberry32 } from './noise.js';
import { Bucket, quads } from './lorn-kit.js';

// The roots of the crystal (issue #188, the author's pick of Lorn's explorations, `crystal-roots`:
// references/levels/Lorn/environment/explorations/crystal-roots/). The Great Crystal is the tip of something huge: its
// roots run out under the swamp, veins of violet crystal with a teal light in them, branching across the basin like the veins of a leaf and
// all running back to it. Built into Lorn after the rest (src/levels/perdide.js), its own dice.
//
//   the veins        ribbons of crackled crystal just under the water (drawn on it, where the water is open), wide by
//                    the Crystal and thinning out; a light runs along them toward it, band after band (pulse)
//   the lit vein     the one you ride: from the Crystal south-west across the open water to the keepers' stakes, and
//                    on beside them into the drowned wood to Hollin's island (a leading line for the crossing)
//   the ringing groves  where veins meet: a cluster of crystal spikes breaking the water; it rings (brightens) as you come by
// The veins are drawn only (you ride and swim over them); the groves' spikes are solid as drawn.
//
//   buildCrystalVeins(scene, terrain, { great }) → { veins, lit, groves, sights, lights, update(t, player) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The lit vein: from the Great Crystal to the stakes (J1, where it meets the vein back along them) and on into the wood. */
export const LIT_VEIN = [[120, -150], [86, -186], [46, -222], [4, -258], [-38, -288], [-57, -310], [-53, -342], [-44, -374], [-36, -404], [-26, -432], [-16, -452]];
/** The other veins ([x, z], each from where it leaves the one it grows from; the first point on the network). */
export const VEINS = [
  // back along the stakes from where the lit vein meets them, to the channel under the cave island
  [[-57, -310], [-82, -250], [-118, -196], [-150, -140], [-160, -100], [-140, -50], [-112, 0]],
  // the Crystal's other roots, every way out into the basin
  [[120, -150], [96, -108], [70, -82], [44, -70]],
  [[120, -150], [176, -120], [240, -104], [310, -70]],
  [[120, -150], [182, -196], [236, -262], [268, -340]],
  [[120, -150], [136, -220], [150, -300], [138, -378]],
  [[120, -150], [150, -86], [196, -34], [230, 20]],
  [[120, -150], [60, -150], [0, -160], [-50, -180], [-94, -206]],
];
const WATER_Y = 0.05;   // (just over the water's sheet: drawn on it, read as under it)
const BANDS = 3;

const spread = (pts, step) => {
  // resample a [x, z] line every `step` m
  const out = [V(pts[0][0], 0, pts[0][1])];
  for (let i = 1; i < pts.length; i++) {
    const a = V(pts[i - 1][0], 0, pts[i - 1][1]), b = V(pts[i][0], 0, pts[i][1]), L = a.distanceTo(b), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
};

export function buildCrystalVeins(scene, terrain, { great = { x: 120, z: -150 } } = {}) {
  const rng = mulberry32(1888), R = (a, b) => a + rng() * (b - a);
  const open = (x, z) => terrain.heightAt(x, z) < -0.3;
  const wash = Array.from({ length: BANDS }, (_, k) => makeMaterial({ color: '#7d7ad6', glow: 0.4, flat: true, lornVein: k }));
  const core = Array.from({ length: BANDS }, (_, k) => makeMaterial({ color: '#9ff0e0', glow: 1, flat: true, lornVeinCore: k }));
  for (const m of [...wash, ...core]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }
  const mats = Object.fromEntries([...wash.map((m, k) => [`w${k}`, m]), ...core.map((m, k) => [`c${k}`, m])]);
  const drawn = new Bucket();
  const UP = V(0, 1, 0);

  // a vein: a jagged ribbon (the crackle's cells, its edge broken every few metres), a zigzag core of light inside it;
  // `w0` its half-width where it starts, thinning to w1; `s0` how far its start is from the Crystal (for the pulse's bands)
  const vein = (pts, w0, w1, s0) => {
    const P = spread(pts, 2.6), n = P.length, L = [], C = [];
    let s = s0;
    for (let i = 0; i < n - 1; i++) {
      const a = P[i], b = P[i + 1], k = i / (n - 1), w = THREE.MathUtils.lerp(w0, w1, k), wn = THREE.MathUtils.lerp(w0, w1, (i + 1) / (n - 1));
      s += a.distanceTo(b);
      const mid = a.clone().lerp(b, 0.5);
      if (!open(mid.x, mid.z)) continue;
      const t = V().subVectors(b, a).normalize(), side = V(-t.z, 0, t.x);
      const j = () => R(0.7, 1.25);
      const band = Math.floor(s / 32) % BANDS;
      const la = a.clone().addScaledVector(side, w * j()).setY(WATER_Y), ra = a.clone().addScaledVector(side, -w * j()).setY(WATER_Y);
      const lb = b.clone().addScaledVector(side, wn * j()).setY(WATER_Y), rb = b.clone().addScaledVector(side, -wn * j()).setY(WATER_Y);
      (L[band] ??= []).push([la, ra, rb, lb, UP]);
      // the core: a zigzag of light down the middle
      const z0 = (i % 2 ? 1 : -1) * w * 0.3, z1 = -z0, cw = Math.max(0.16, w * 0.1);
      const ca = a.clone().addScaledVector(side, z0).setY(WATER_Y + 0.02), cb = b.clone().addScaledVector(side, z1).setY(WATER_Y + 0.02);
      (C[band] ??= []).push([ca.clone().addScaledVector(side, cw), ca.clone().addScaledVector(side, -cw), cb.clone().addScaledVector(side, -cw), cb.clone().addScaledVector(side, cw), UP]);
      // now and then a crack across it, a cell's edge
      if (rng() < 0.3) {
        const q = a.clone().lerp(b, rng()).setY(WATER_Y + 0.01), e0 = q.clone().addScaledVector(side, w * 0.95), e1 = q.clone().addScaledVector(side, -w * 0.95).addScaledVector(t, R(-1, 1));
        (C[band] ??= []).push([e0.clone().addScaledVector(t, 0.12), e0.clone().addScaledVector(t, -0.12), e1.clone().addScaledVector(t, -0.12), e1.clone().addScaledVector(t, 0.12), UP]);
      }
    }
    L.forEach((q, k) => q && drawn.add(`w${k}`, quads(q)));
    C.forEach((q, k) => q && drawn.add(`c${k}`, quads(q)));
    return P;
  };

  // twigs off a vein: shorter veins branching out of it at an angle, and twigs off those
  const twigs = (P, w, s0, depth) => {
    if (depth > 1 || P.length < 8) return;
    const every = depth ? 7 : 9;
    for (let i = 4; i < P.length - 3; i += every + Math.floor(rng() * 5)) {
      const a = P[i], t = V().subVectors(P[i + 1], P[i - 1]).normalize(), side = rng() < 0.5 ? -1 : 1;
      // (a twig leans back toward the Crystal's far side: the leaf's veins open away from its stem)
      const dir = t.clone().applyAxisAngle(UP, side * R(0.5, 1.0)), len = R(30, 70) * (depth ? 0.6 : 1), pts = [[a.x, a.z]];
      let p = a.clone();
      for (let k = 0; k < 4; k++) { dir.applyAxisAngle(UP, R(-0.25, 0.25)); p = p.clone().addScaledVector(dir, len / 4); pts.push([p.x, p.z]); }
      const ww = w * R(0.45, 0.6);
      const Q = vein(pts, ww, ww * 0.35, s0 + i * 2.6);
      twigs(Q, ww, s0 + i * 2.6, depth + 1);
    }
  };

  const lit = vein(LIT_VEIN, 4.2, 1.8, 0);
  twigs(lit, 3.4, 0, 0);
  const others = VEINS.map((pts, k) => {
    const start = V(pts[0][0], 0, pts[0][1]), s0 = start.distanceTo(V(great.x, 0, great.z)) > 5 ? 180 : 0, w = k === 0 ? 3.2 : 3.6;
    const P = vein(pts, w, w * 0.4, s0);
    twigs(P, w, s0, 0);
    return P;
  });

  // ---------------------------------------------------------- the ringing groves, where the veins meet
  const groveMat = makeMaterial({ color: '#c7a6f2', flat: true, glow: 0.55, lornGrove: true });
  const groves = [];
  const GROVES = [[-32, -282], [-158, -132], [58, -152]];
  const spikes = new Bucket();
  GROVES.forEach(([x, z]) => {
    const g0 = terrain.heightAt(x, z);
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 3.2, h = R(3, 9) * (i ? 1 : 1.4), r = R(0.4, 0.95);
      const c = new THREE.CylinderGeometry(0, r, h, 5, 1).translate(0, h / 2, 0).rotateX(R(-0.3, 0.3)).rotateZ(R(-0.3, 0.3));
      spikes.add('grove', c.translate(x + Math.cos(a) * d, g0 - 0.4, z + Math.sin(a) * d));
    }
    groves.push({ at: V(x, Math.max(g0, 0), z), ring: 0 });
  });
  const g = new THREE.Group();
  g.name = 'The roots of the crystal';
  for (const m of drawn.meshes(mats, { solid: false, name: 'The crystal’s veins' })) { m.userData.floats = true; g.add(m); }
  for (const m of spikes.meshes({ grove: groveMat }, { name: 'The ringing groves' })) g.add(m);
  scene.add(g);
  const lights = groves.map((G) => new THREE.Vector4(G.at.x, 2.5, G.at.z, 14));
  const sights = groves.map((G, k) => ({ name: ['the ringing grove by the stakes', 'the ringing grove in the reeds', 'the ringing grove under the Crystal'][k], at: G.at.clone().setY(G.at.y + 1) }));
  const litPoints = LIT_VEIN.filter((_, i) => i >= 4).map(([x, z]) => [x, 0.5, z]);
  let ringT = 0;
  return {
    veins: [lit, ...others], lit: litPoints, groves, sights, lights, materials: { wash, core, grove: groveMat },
    /** The light running along the veins toward the Crystal; a grove you pass rings (brightens, then settles). */
    update(dt, t, player) {
      for (let k = 0; k < BANDS; k++) {
        const p = 0.5 + 0.5 * Math.sin(t * 1.4 + k * 2.1);
        wash[k].uniforms.uGlow.value = 0.25 + 0.25 * p;
        core[k].uniforms.uGlow.value = 0.6 + 0.4 * p;
      }
      let near = 0;
      if (player) for (const G of groves) { const d = Math.hypot(player.x - G.at.x, player.z - G.at.z); if (d < 18) near = Math.max(near, 1 - d / 18); }
      ringT += ((near > 0 ? 1 : 0) - ringT) * Math.min(1, dt * (near > 0 ? 3 : 0.6));
      groveMat.uniforms.uGlow.value = 0.55 + 0.45 * ringT * (0.7 + 0.3 * Math.sin(t * 9));
    },
  };
}
