import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { mulberry32, createNoise2D } from './noise.js';

// Grass blades round the camera, in the grassy worlds (the terrains drawn with grass ticks:
// Viridel, the Garden of Spheres, home, Lorn's mosses, their Lab rooms).
//
// A fixed set of tufts (instances of one small mesh, a few blades each) covers a square patch
// 2R across that wraps round the camera: each tuft has its own offset in the patch, and as the
// camera moves the tufts that fall off one side reappear on the other, a whole patch further
// on (wrapPatch). So a blade stays where it is in the world while you walk, and only the tufts
// that wrapped this frame are placed again (heightAt, the slope, the paths, the water, and a
// 2 m mask of where something is built: a single ray down per cell, cached).
// The vertex shader (grass-shader.js) bends them with the wind and round the traveller's feet,
// thins them with distance and sinks them into the ground towards the patch's edge, where the
// ground's own inked ticks take over. They cast no shadow and are one draw call.
// Presets (GRASS_QUALITY): fewer, closer blades on Low and the Handheld.

export const GRASS_QUALITY = {
  high: { radius: 26, density: 4.5 },
  medium: { radius: 22, density: 4 },
  auto: { radius: 22, density: 4 },
  low: { radius: 15, density: 2.8 },
  handheld: { radius: 13, density: 2.4 },
};

/** Where a tuft with patch offset o (0..S) lands, the patch of side S wrapped round the camera at c. */
export const wrapPatch = (o, c, S) => o + S * Math.round((c - o) / S);

/** One tuft: `blades` tapered strips, y 0 (root) to 1 (tip); x, z in metres round the root. */
export function tuftGeometry({ blades = 4, width = 0.032, spread = 0.07, seed = 3 } = {}) {
  const rng = mulberry32(seed);
  const pos = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = rng() * Math.PI * 2, r = spread * Math.sqrt(rng()), x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
    const face = rng() * Math.PI, fx = Math.cos(face), fz = Math.sin(face);   // the blade's flat side
    const lean = 0.05 + rng() * 0.07, h = 0.65 + rng() * 0.35;
    const w = width * (0.8 + rng() * 0.4);
    const v0 = pos.length / 3;
    const at = (t, s) => pos.push(x0 + fx * s + Math.cos(a) * lean * t * t, t * h, z0 + fz * s + Math.sin(a) * lean * t * t);
    at(0, -w); at(0, w); at(0.5, -w * 0.62); at(0.5, w * 0.62); at(1, 0);
    idx.push(v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2, v0 + 2, v0 + 3, v0 + 4);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

/** The grassy grounds of a level: its own list (level.grassFields, the Lab's rooms) or its terrain, if drawn with ticks. */
export function grassFields(level) {
  if (level.grassFields) return level.grassFields;
  const u = level.ground?.mesh?.material?.uniforms;
  if (!u?.uTicks?.value || !level.ground.heightAt) return [];
  return [{ heightAt: (x, z) => level.ground.heightAt(x, z), color: u.uColor.value, color2: u.uColor2.value, inside: () => true }];
}

const _o = new THREE.Vector3(), _dir = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
/** The patch's centre lies this many radii ahead of the camera. */
const AHEAD = 0.45;

export class Grass {
  /**
   * @param o.fields   [{ heightAt, color, color2, inside(x, z), water?, avoid?(x, z, r) }]
   * @param o.quality  GRASS_QUALITY entry: radius (m), density (tufts per m²)
   * @param o.physics  ray casts for the built-on mask (optional)
   */
  constructor({ scene, fields, quality, physics = null, avoid = null, water = -Infinity, height = 0.38, seed = 5 }) {
    this.fields = fields;
    this.physics = physics;
    this.avoid = avoid;
    this.water = water;
    this.R = quality.radius;
    this.S = this.R * 2;
    const S = this.S, g = Math.max(8, Math.round(S * Math.sqrt(quality.density)));
    const N = g * g;
    this.count = N;
    const rng = mulberry32(seed);
    this.off = new Float32Array(N * 2);
    this.base = new Float32Array(N);   // the tuft's own height factor
    const A = new Float32Array(N * 4), B = new Float32Array(N * 4);
    for (let iz = 0, i = 0; iz < g; iz++) for (let ix = 0; ix < g; ix++, i++) {
      this.off[i * 2] = ((ix + rng()) * S) / g;
      this.off[i * 2 + 1] = ((iz + rng()) * S) / g;
      this.base[i] = 0.6 + rng() * 0.4;
      B[i * 4] = rng() * Math.PI * 2;      // turn
      B[i * 4 + 1] = rng() < 0.7 ? rng() * 0.35 : 0.6 + rng() * 0.4;   // tint: mostly the first tone
      B[i * 4 + 2] = (rng() - 0.5) * 0.25; // lean
      B[i * 4 + 3] = rng();                // rank (thinning) and phase
      A[i * 4 + 1] = -1e4;
      A[i * 4] = A[i * 4 + 2] = NaN;       // (placed on the first update)
    }
    this.at = A;
    const geo = tuftGeometry();
    geo.instanceCount = N;
    this.aGrass = new THREE.InstancedBufferAttribute(A, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGrass', this.aGrass);
    geo.setAttribute('aGrass2', new THREE.InstancedBufferAttribute(B, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.material = makeMaterial({ color: '#8cc77e', color2: '#9fd08a', grass: true, side: THREE.DoubleSide, key: 'grass' });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'grass';
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    Object.assign(this.mesh.userData, { noCollide: true, dynamic: true });
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.height = height;
    this.noise = createNoise2D(seed + 11);
    this.mask = new Map();
    this.field = null;
    this.placed = 0;
  }

  /** Something built covers this 2 m cell (a rock, a floor, a roof): no grass. Cached. */
  built(x, z, y) {
    if (!this.physics) return false;
    const ix = Math.floor(x / 2), iz = Math.floor(z / 2), key = ix * 100003 + iz;
    let v = this.mask.get(key);
    if (v === undefined) {
      if (this.mask.size > 40000) this.mask.clear();
      const cx = ix * 2 + 1, cz = iz * 2 + 1, base = this.field.heightAt(cx, cz);
      const hit = this.physics.rayHit(_o.set(cx + 1.3e-4, base + 6, cz + 2.7e-4), DOWN, 6.5);
      v = !!hit && hit.point.y > base + 0.05;   // (the heightfield isn't in the collision: any hit is something built, a path, a slab)
      this.mask.set(key, v);
    }
    return v;
  }

  /** The tuft's height (m) at x, z on this field, or 0 where none grows. */
  heightAt(x, z, i) {
    const F = this.field, y = F.heightAt(x, z);
    if (!Number.isFinite(y)) return [0, -1e4];
    const e = 0.6, gx = F.heightAt(x + e, z) - F.heightAt(x - e, z), gz = F.heightAt(x, z + e) - F.heightAt(x, z - e);
    if (Math.max(Math.abs(gx), Math.abs(gz)) / (2 * e) > 0.75) return [0, y];   // steep: the ground's rock
    if (y < (F.water ?? this.water) + 0.12) return [0, y];
    const avoid = F.avoid ?? this.avoid;
    if (avoid?.(x, z, 0.2)) return [0, y];
    // meadows: taller in some places, cropped in others, bare here and there
    const m = this.noise(x * 0.07, z * 0.07) * 0.6 + this.noise(x * 0.23 + 40, z * 0.23) * 0.4;
    if (m < -0.45) return [0, y];
    if (this.built(x, z, y)) return [0, y];
    return [this.height * this.base[i] * (0.75 + 0.45 * Math.min(1, Math.max(0, m + 0.5))), y];
  }

  /**
   * Once a frame before rendering: wrap the patch round the camera (its centre a little ahead,
   * where you look: nothing grows behind you), place the tufts that moved.
   */
  update(camera) {
    const px = camera.position.x, pz = camera.position.z;
    const field = this.fields.find((f) => f.inside(px, pz)) ?? null;
    let cx = px, cz = pz;
    if (camera.getWorldDirection) {
      camera.getWorldDirection(_dir);
      const l = Math.hypot(_dir.x, _dir.z);
      if (l > 1e-3) { cx += (_dir.x / l) * this.R * AHEAD; cz += (_dir.z / l) * this.R * AHEAD; }
    }
    if (field !== this.field) {
      this.field = field;
      this.mask.clear();
      this.at.fill(NaN);
      if (field) {
        this.material.uniforms.uColor.value.set(field.color);
        this.material.uniforms.uColor2.value.set(field.color2);
      }
    }
    this.mesh.visible = !!field;
    if (!field) return 0;
    this.material.uniforms.uGrassView.value.set(cx, cz, this.R * 0.45, this.R * 0.9);
    const { off, at, S } = this;
    let lo = Infinity, hi = -1;
    for (let i = 0, n = this.count; i < n; i++) {
      const x = wrapPatch(off[i * 2], cx, S), z = wrapPatch(off[i * 2 + 1], cz, S);
      if (x === at[i * 4] && z === at[i * 4 + 2]) continue;
      const [h, y] = this.heightAt(x, z, i);
      at[i * 4] = x; at[i * 4 + 1] = y; at[i * 4 + 2] = z; at[i * 4 + 3] = h;
      if (i < lo) lo = i;
      hi = i;
    }
    if (hi >= 0) {
      const a = this.aGrass;
      a.clearUpdateRanges();
      a.addUpdateRange(lo * 4, (hi - lo + 1) * 4);
      a.needsUpdate = true;
      this.placed = hi - lo + 1;
    } else this.placed = 0;
    return this.placed;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}

/** Grass for this level, if it has grassy ground and the preset grows blades (main.js). */
export function buildGrass({ scene, level, physics, presetKey = 'medium', water }) {
  const quality = GRASS_QUALITY[presetKey] ?? GRASS_QUALITY.medium;
  const fields = grassFields(level);
  if (!fields.length || !quality) return null;
  return new Grass({ scene, fields, quality, physics, avoid: level.floraAvoid ?? null, water });
}
