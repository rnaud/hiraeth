import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { createNoise2D, mulberry32, smoothstep } from './noise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crystalPrism, crystalRand } from './crystal-forms.js';

// The roots of the crystal (issue #188, the author's pick of Lorn's explorations, `crystal-roots`:
// references/levels/Lorn/environment/explorations/crystal-roots/). The Great Crystal is the tip of something huge: its
// roots run out under the swamp, veins of violet crystal with a teal light in them, branching across the basin like the
// veins of a leaf and all running back to it. Built into Lorn after the rest (src/levels/perdide.js), its own dice.
//
//   the veins        crystal under the water, seen through its surface: drawn by the water itself (water-shader.js
//                    WATER_VEINS) from a map of them baked here over the basin (`map`): soft, crackled edges that
//                    wobble as the water moves over them, wide by the Crystal and tapering out, branching into
//                    thinner twigs and twigs off those; faceted in violet, lavender and teal cells, finely inked, a
//                    teal halo round them; the deeper they lie (further out, and the twigs) the fainter; bands of light
//                    running along them in to the Crystal, the whole network breathing
//   the lit vein     the one you ride: from the Crystal south-west across the open water to the keepers' stakes, and
//                    on beside them into the drowned wood to Hollin's island (a leading line for the crossing)
//   the ringing groves  where veins meet: a cluster of crystal spikes breaking the water; it rings (brightens) as you come by
// The veins are drawn only (you ride and swim over them); the groves' spikes are solid as drawn.
//
//   buildCrystalVeins(scene, terrain, { great, water }) → { veins, lit, groves, sights, lights, map, update(dt, t, player) }

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
/** The map's texel (m) at most, and its size (texels a side) at most. */
export const VEIN_MAP = { texel: 0.5, max: 1024, margin: 14, band: 40, deep: 3 };

const spread = (pts, step) => {
  // resample a [x, z] line every `step` m
  const out = [V(pts[0][0], 0, pts[0][1])];
  for (let i = 1; i < pts.length; i++) {
    const a = V(pts[i - 1][0], 0, pts[i - 1][1]), b = V(pts[i][0], 0, pts[i][1]), L = a.distanceTo(b), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
};

export function buildCrystalVeins(scene, terrain, { great = { x: 120, z: -150 }, water = null } = {}) {
  const rng = mulberry32(1888), R = (a, b) => a + rng() * (b - a);
  const crackle = createNoise2D(1889);
  const UP = V(0, 1, 0);

  // ---------------------------------------------------------- the network: segments with their widths, run and depth
  const segs = [];   // [ax, az, bx, bz, wa, wb, sa, sb, under]
  // a vein: `w0` its half-width where it starts, thinning to w1 and to a point over its last fifth; `s0` how far its
  // start is from the Crystal (the light's bands run in along it); `under` how deep its start lies, deeper further out
  const vein = (pts, w0, w1, s0, under0, under1) => {
    const P = spread(pts, 2.6), n = P.length;
    let s = s0;
    const wAt = (k) => THREE.MathUtils.lerp(w0, w1, k) * (k > 0.8 ? THREE.MathUtils.lerp(1, 0.22, (k - 0.8) / 0.2) : 1);
    for (let i = 0; i < n - 1; i++) {
      const a = P[i], b = P[i + 1], ka = i / (n - 1), kb = (i + 1) / (n - 1), L = a.distanceTo(b);
      segs.push([a.x, a.z, b.x, b.z, wAt(ka), wAt(kb), s, s + L, THREE.MathUtils.lerp(under0, under1, (ka + kb) / 2)]);
      s += L;
    }
    return P;
  };
  // twigs off a vein: shorter, thinner veins branching out of it at an angle, deeper, and twigs off those
  const twigs = (P, w, s0, under, depth) => {
    if (depth > 2 || P.length < 8) return;
    const every = [9, 7, 5][depth];
    for (let i = 4; i < P.length - 3; i += every + Math.floor(rng() * 5)) {
      const a = P[i], t = V().subVectors(P[i + 1], P[i - 1]).normalize(), side = rng() < 0.5 ? -1 : 1;
      // (a twig leans back toward the Crystal's far side: the leaf's veins open away from its stem)
      const dir = t.clone().applyAxisAngle(UP, side * R(0.5, 1.0)), len = R(30, 70) * [1, 0.6, 0.35][depth], pts = [[a.x, a.z]];
      let p = a.clone();
      for (let k = 0; k < 4; k++) { dir.applyAxisAngle(UP, R(-0.25, 0.25)); p = p.clone().addScaledVector(dir, len / 4); pts.push([p.x, p.z]); }
      const k = i / (P.length - 1), ww = THREE.MathUtils.lerp(w, w * 0.4, k) * R(0.45, 0.6), u = under + 0.4;
      const Q = vein(pts, ww, ww * 0.4, s0 + i * 2.6, u, u + 0.5);
      twigs(Q, ww, s0 + i * 2.6, u, depth + 1);
    }
  };
  const lit = vein(LIT_VEIN, 4.2, 1.8, 0, 0.15, 0.55);
  twigs(lit, 3.4, 0, 0.3, 0);
  const others = VEINS.map((pts, k) => {
    const start = V(pts[0][0], 0, pts[0][1]), s0 = start.distanceTo(V(great.x, 0, great.z)) > 5 ? 180 : 0, w = k === 0 ? 3.2 : 3.6;
    const P = vein(pts, w, w * 0.4, s0, 0.3 + s0 / 400, 1.3);
    twigs(P, w, s0, 0.6, 0);
    return P;
  });

  // ---------------------------------------------------------- the map the water draws them from
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const s of segs) { x0 = Math.min(x0, s[0], s[2]); z0 = Math.min(z0, s[1], s[3]); x1 = Math.max(x1, s[0], s[2]); z1 = Math.max(z1, s[1], s[3]); }
  x0 -= VEIN_MAP.margin; z0 -= VEIN_MAP.margin; x1 += VEIN_MAP.margin; z1 += VEIN_MAP.margin;
  const span = Math.max(x1 - x0, z1 - z0), size = Math.min(VEIN_MAP.max, Math.ceil(span / VEIN_MAP.texel)), tx = span / size;
  const cov = new Float32Array(size * size), run = new Float32Array(size * size), dep = new Float32Array(size * size);
  for (const [ax, az, bx, bz, wa, wb, sa, sb, under] of segs) {
    const wm = Math.max(wa, wb) * 1.35, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - wm - x0) / tx)), i1 = Math.min(size - 1, Math.ceil((Math.max(ax, bx) + wm - x0) / tx));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - wm - z0) / tx)), j1 = Math.min(size - 1, Math.ceil((Math.max(az, bz) + wm - z0) / tx));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + (i + 0.5) * tx, z = z0 + (j + 0.5) * tx;
      const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2));
      const w = wa + (wb - wa) * u, d = Math.hypot(x - ax - dx * u, z - az - dz * u);
      // (crackled: the edge broken in and out, finer where it is narrow)
      const e = d * (1 + 0.3 * crackle(x * 0.31, z * 0.31) + 0.12 * crackle(x * 1.3 + 40, z * 1.3));
      const c = 1 - smoothstep(0.08 * w, 1.05 * w, e);   // (highest along its heart: the water draws a lit core there)
      const o = j * size + i;
      if (c > cov[o]) { cov[o] = c; run[o] = sa + (sb - sa) * u; dep[o] = under; }
    }
  }
  // (only where the water is open: they fade out as the bed comes up to the surface.) Bytes, with mipmaps (a far
  // vein stays whole, not a scatter of texels): r how much of a vein, g and b where the light's bands are along it
  // (the sine and cosine of its run from the Crystal, VEIN_MAP.band m a band), a how deep it lies (of VEIN_MAP.deep m)
  const bytes = new Uint8Array(size * size * 4), B = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const kb = (Math.PI * 2) / VEIN_MAP.band;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const o = j * size + i;
    let c = cov[o];
    if (c > 0) c *= smoothstep(0.05, -0.3, terrain.heightAt(x0 + (i + 0.5) * tx, z0 + (j + 0.5) * tx));
    cov[o] = c;
    bytes[o * 4] = B(c); bytes[o * 4 + 1] = B(0.5 + 0.5 * Math.sin(run[o] * kb)); bytes[o * 4 + 2] = B(0.5 + 0.5 * Math.cos(run[o] * kb)); bytes[o * 4 + 3] = B(dep[o] / VEIN_MAP.deep);
  }
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  const box = new THREE.Vector4(x0, z0, 1 / span, 1 / span);
  const map = {
    texture, box, size, texel: tx,
    /** How much of a vein is under the water at (x, z) (0..1), as the water draws it (but its wobble). */
    at(x, z) { const i = Math.floor((x - x0) / tx), j = Math.floor((z - z0) / tx); return i < 0 || j < 0 || i >= size || j >= size ? 0 : cov[j * size + i]; },
  };
  // the water's material (its own copy once the world's waters have it, water.js add): given the map, and again if it
  // is copied after this
  const bind = () => { const u = water?.material?.uniforms; if (u?.uVeinMap && u.uVeinMap.value !== texture) { u.uVeinMap.value = texture; u.uVeinBox.value.copy(box); } };
  bind();

  // ---------------------------------------------------------- the ringing groves, where the veins meet
  const groveMat = makeMaterial({ color: '#b4afd0', flat: true, glow: 0.55, lornGrove: true, crystalFacets: true });   // (faceted: surface-marks.js, issue #686)
  const groves = [];
  const GROVES = [[-32, -282], [-158, -132], [58, -152]];
  const spikes = [];   // (their uv kept: the facets' frame, src/crystal-forms.js)
  GROVES.forEach(([x, z]) => {
    const g0 = terrain.heightAt(x, z);
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 3.2, h = R(3, 9) * (i ? 1 : 1.4), r = R(0.4, 0.95);
      // a six-sided prism with its point, chipped (src/crystal-forms.js, issue #693), in its own dice
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const c = crystalPrism({ r: r * 0.62, h }, crystalRand(px, pz, 3)).rotateX(R(-0.3, 0.3)).rotateZ(R(-0.3, 0.3));
      spikes.push(c.translate(px, g0 - 0.4, pz));
    }
    groves.push({ at: V(x, Math.max(g0, 0), z), ring: 0 });
  });
  const g = new THREE.Group();
  g.name = 'The roots of the crystal';
  const spikeMesh = new THREE.Mesh(mergeGeometries(spikes), groveMat);
  spikeMesh.name = 'The ringing groves (grove)';
  g.add(spikeMesh);
  scene.add(g);
  const lights = groves.map((G) => new THREE.Vector4(G.at.x, 2.5, G.at.z, 14));
  const sights = groves.map((G, k) => ({ name: ['the ringing grove by the stakes', 'the ringing grove in the reeds', 'the ringing grove under the Crystal'][k], at: G.at.clone().setY(G.at.y + 1) }));
  const litPoints = LIT_VEIN.filter((_, i) => i >= 4).map(([x, z]) => [x, 0.5, z]);
  let ringT = 0;
  return {
    veins: [lit, ...others], lit: litPoints, groves, sights, lights, map, materials: { grove: groveMat },
    /** A grove you pass rings (brightens, then settles). (The light along the veins is the water's, on its clock.) */
    update(dt, t, player) {
      bind();
      let near = 0;
      if (player) for (const G of groves) { const d = Math.hypot(player.x - G.at.x, player.z - G.at.z); if (d < 18) near = Math.max(near, 1 - d / 18); }
      ringT += ((near > 0 ? 1 : 0) - ringT) * Math.min(1, dt * (near > 0 ? 3 : 0.6));
      groveMat.uniforms.uGlow.value = 0.55 + 0.45 * ringT * (0.7 + 0.3 * Math.sin(t * 9));
    },
  };
}
