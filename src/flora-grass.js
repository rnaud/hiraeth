import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { mulberry32, createNoise2D } from './noise.js';
import { grassLod } from './grass-shader.js';

// Grass blades round the camera, in the grassy worlds (the terrains drawn with grass ticks:
// Viridel, the Garden of Spheres, home, Lorn's mosses, their Lab rooms).
//
// A fixed set of tufts (instances of one small mesh, a few blades each) covers a square patch
// 2R across that wraps round the camera: each tuft has its own offset in the patch, and as the
// camera moves the tufts that fall off one side reappear on the other, a whole patch further
// on (wrapPatch). So a blade stays where it is in the world while you walk, and only the tufts
// that wrapped this frame are placed again (heightAt, the slope, the paths, the water, and a
// 1 m mask of where something is built: a single ray down per cell, cached).
// The vertex shader (grass-shader.js) bends them with the wind and round the traveller's feet,
// and fades them out with distance, tuft by tuft (thinner, shorter, in the ground's colour,
// without their outline), so none pops in. Past the patch a far layer takes over: sparse low
// tufts of two blades, a patch about 2.5 times as wide, growing in where the near one thins and
// fading into the ground in turn, where its inked ticks carry on. No shadows; two draw calls.
// Presets (GRASS_QUALITY): fewer, closer blades on Low and the Handheld.

export const GRASS_QUALITY = {
  high: { radius: 22, density: 4.5, far: { radius: 58, density: 0.3 } },
  medium: { radius: 19, density: 4, far: { radius: 48, density: 0.26 } },
  auto: { radius: 19, density: 4, far: { radius: 48, density: 0.26 } },
  low: { radius: 13.5, density: 3.4, far: { radius: 30, density: 0.2 } },
  // (the handheld's patch reached barely past the traveller from the camera, so its meadows read as bare ground:
  // a wider patch at its density and a far layer further out, docs/systems/performance.md "What the Handheld and the Deck lose next to High")
  handheld: { radius: 14, density: 3, far: { radius: 36, density: 0.16 } },
  // (the Deck's had been Low's: widened the same way, its GPU has the room; perf.js QUALITY_PRESETS.deck)
  deck: { radius: 16, density: 3.4, far: { radius: 40, density: 0.2 } },
};

/** The far layer's tuft: two broader blades. */
export const FAR_TUFT = { blades: 2, width: 0.075, spread: 0.12, seed: 9 };
/** The far layer's tufts are this much shorter than the near ones. */
const FAR_HEIGHT = 0.9;
/** s: how quickly the patch's centre follows the camera's turn (a quick turn slides the fade, nothing pops). */
const FOLLOW = 0.35;

/** Where a tuft with patch offset o (0..S) lands, the patch of side S wrapped round the camera at c. */
export const wrapPatch = (o, c, S) => o + S * Math.round((c - o) / S);

/** One tuft: `blades` tapered strips, y 0 (root) to 1 (tip); x, z in metres round the root. */
export function tuftGeometry({ blades = 3, width = 0.055, spread = 0.09, seed = 3 } = {}) {
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
/** The built-on mask's cell (m). */
const MASK = 1;
/** The patch's centre lies this many radii ahead of the camera. */
const AHEAD = 0.45;
/** At most this long (ms) placing tufts in a frame, once the first patch is down (Grass.update). */
export const PLACE_MS = 3;

export class Grass {
  /**
   * @param o.fields   [{ heightAt, color, color2, inside(x, z), water?, avoid?(x, z, r), mask? }]
   *                   (mask: false when the ground itself is in the collision, like the Lab's meadow plot)
   * @param o.quality  GRASS_QUALITY entry: radius (m), density (tufts per m²)
   * @param o.physics  ray casts for the built-on mask (optional)
   */
  constructor({ scene, fields, quality, physics = null, avoid = null, keep = [], water = -Infinity, height = 0.38, seed = 5, near = null }) {
    this.fields = fields;
    this.layer = near ? 'far' : 'near';
    this.keep = keep.filter(Boolean);   // [{ x, z, r }]: the ship's footprint and the like
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
    const geo = tuftGeometry(near ? FAR_TUFT : undefined);
    geo.instanceCount = N;
    this.aGrass = new THREE.InstancedBufferAttribute(A, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGrass', this.aGrass);
    geo.setAttribute('aGrass2', new THREE.InstancedBufferAttribute(B, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.material = makeMaterial({ color: '#8cc77e', color2: '#9fd08a', grass: true, side: THREE.DoubleSide, key: near ? 'grass-far' : 'grass' });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = near ? 'grass (far)' : 'grass';
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    Object.assign(this.mesh.userData, { noCollide: true, dynamic: true });
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.height = near ? height * FAR_HEIGHT : height;
    this.noise = near?.noise ?? createNoise2D(seed + 11);   // (the far layer: the same meadows, bare in the same places)
    this.mask = near?.mask ?? new Map();
    // the fade's distances (grass-shader.js grassLod): the near layer's, or the far one's round the near
    this.lod = near ? grassLod(near.R, this.R, true) : grassLod(this.R, quality.far?.radius ?? null, false, quality.far ? quality.far.density / quality.density : 0);
    const U = this.material.uniforms;
    U.uGrassLod.value.set(...this.lod.lod);
    U.uGrassLook.value.set(...this.lod.look);
    this.ahead = null;        // the patch's centre's lead on the camera (x, z), following its look a little behind
    this.lastT = 0;
    // the far layer: sparse low tufts past this patch (the same fields, the same mask)
    this.far = !near && quality.far ? new Grass({ scene, fields, quality: quality.far, physics, avoid, keep, water, height, seed: seed + 101, near: this }) : null;
    this.field = null;
    this.placed = 0;
    this.cursor = 0;          // where the next frame's placement starts (a jump is placed over several)
    this.placedOnce = false;
    this.placeMs = near ? PLACE_MS / 3 : PLACE_MS;   // (the far layer: a third of it, after the near one)
  }

  /** Something built covers this 1 m cell (a rock, a floor, a roof): no grass. Cached. */
  built(x, z, y) {
    if (!this.physics || this.field.mask === false) return false;
    const ix = Math.floor(x / MASK), iz = Math.floor(z / MASK), key = ix * 100003 + iz;
    let v = this.mask.get(key);
    if (v === undefined) {
      if (this.mask.size > 60000) this.mask.clear();
      const cx = (ix + 0.5) * MASK, cz = (iz + 0.5) * MASK, base = this.field.heightAt(cx, cz);
      const hit = this.physics.rayHit(_o.set(cx + 1.3e-4, base + 6, cz + 2.7e-4), DOWN, 6.5);
      v = !!hit && hit.point.y > base - 0.03;   // (the heightfield isn't in the collision: any hit is something built, a path, a slab, a pad)
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
    for (const k of this.keep) if ((x - k.x) ** 2 + (z - k.z) ** 2 < k.r * k.r) return [0, y];
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
  update(camera, now = performance.now()) {
    const placed = this.place(camera, now);
    this.far?.update(camera, now);   // (the far layer after: its share of the frame's placing is smaller)
    this._placing = false;
    return placed;
  }

  /** This layer's part of update(): the tufts placed this frame. */
  place(camera, now) {
    const px = camera.position.x, pz = camera.position.z;
    const field = this.fields.find((f) => f.inside(px, pz)) ?? null;
    let ox = 0, oz = 0;
    if (camera.getWorldDirection) {
      camera.getWorldDirection(_dir);
      const l = Math.hypot(_dir.x, _dir.z);
      if (l > 1e-3) { ox = (_dir.x / l) * this.R * AHEAD; oz = (_dir.z / l) * this.R * AHEAD; }
    }
    // the centre's lead follows the look smoothly (turning round slides the fade across rather than
    // jumping it); the first frame and a new field take it at once
    const A = this.ahead, dtS = Math.min(Math.max((now - this.lastT) / 1000, 0), 0.25);
    this.lastT = now;
    if (A && field === this.field) {
      const k = 1 - Math.exp(-dtS / FOLLOW);
      ox = A[0] + (ox - A[0]) * k; oz = A[1] + (oz - A[1]) * k;
    }
    this.ahead = [ox, oz];
    const cx = px + ox, cz = pz + oz;
    if (field !== this.field) {
      this.field = field;
      this.mask.clear();
      this.at.fill(NaN);
      this.scanAt = null;
      if (field) {
        this.material.uniforms.uColor.value.set(field.color);
        this.material.uniforms.uColor2.value.set(field.color2);
      }
    }
    this.mesh.visible = !!field;
    if (!field) return 0;
    this.material.uniforms.uGrassView.value.set(cx, cz, ...this.lod.view);
    // Standing still (the centre within 2 cm of the last scan's, nothing left to place), no tuft can have
    // wrapped: skip the scan of every tuft (it was most of the grass's CPU a frame, and the handheld is
    // CPU-bound; a 2 cm lag of the patch's faded edge does not show)
    const sc = this.scanAt;
    if (sc && !this.pending && Math.abs(cx - sc[0]) < 0.02 && Math.abs(cz - sc[1]) < 0.02) { this.placed = 0; this._placing = false; return 0; }
    const { off, at, S } = this, n = this.count;
    // Walking, a few rows wrap a frame. After a jump (a door, a portal, a new field) every tuft
    // moves: that is placed over the next frames, PLACE_MS at a time, carrying on from where it
    // stopped (a whole patch at once was a 60 ms frame on High). A tuft not yet placed is either
    // nothing (NaN, a new field) or where it was, past the patch's faded edge: none shows.
    // The first placement, at load, is done at once.
    const t0 = this.placedOnce ? performance.now() : Infinity;
    let lo = Infinity, hi = -1, done = 0, k = 0;
    for (; k < n; k++) {
      const i = (this.cursor + k) % n;
      const x = wrapPatch(off[i * 2], cx, S), z = wrapPatch(off[i * 2 + 1], cz, S);
      // (compared as stored, in 32-bit floats: away from the origin x rarely survives the round trip,
      // and every tuft was placed again every frame, ~2 ms on High standing still)
      if (Math.fround(x) === at[i * 4] && Math.fround(z) === at[i * 4 + 2]) continue;
      const [h, y] = this.heightAt(x, z, i);
      at[i * 4] = x; at[i * 4 + 1] = y; at[i * 4 + 2] = z; at[i * 4 + 3] = h;
      if (i < lo) lo = i;
      if (i > hi) hi = i;
      if ((++done & 63) === 0 && performance.now() - t0 > this.placeMs) { k++; break; }
    }
    this.cursor = k < n ? (this.cursor + k) % n : 0;
    this.scanAt = [cx, cz]; this.pending = k < n;
    this._placing = k < n;
    this.placedOnce = true;
    if (hi >= 0) {
      const a = this.aGrass;
      a.clearUpdateRanges();
      a.addUpdateRange(lo * 4, (hi - lo + 1) * 4);
      a.needsUpdate = true;
      this.placed = hi - lo + 1;
    } else this.placed = 0;
    return this.placed;
  }

  /** A patch still being placed after a jump, either layer (the hand-over waits for it, src/passage.js; the load too). */
  get placing() { return !!this._placing || !!this.far?.placing; }

  /** The meshes (the near patch and the far layer: both kept out of the shadow passes). */
  get meshes() { return this.far ? [this.mesh, this.far.mesh] : [this.mesh]; }

  /** Triangles drawn a frame (both layers). */
  get triangles() { return this.meshes.reduce((n, m) => n + m.geometry.instanceCount * m.geometry.index.count / 3, 0); }

  dispose() {
    this.far?.dispose();
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}

/** Grass for this level, if it has grassy ground and the preset grows blades (main.js). */
export function buildGrass({ scene, level, physics, presetKey = 'medium', water, keep = [] }) {
  const quality = GRASS_QUALITY[presetKey] ?? GRASS_QUALITY.medium;
  const fields = grassFields(level);
  if (!fields.length || !quality) return null;
  return new Grass({ scene, fields, quality, physics, avoid: level.floraAvoid ?? null, keep, water });
}
