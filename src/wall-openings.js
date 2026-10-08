import * as THREE from 'three';

// Where an old wall's cracks may not run (docs/systems/materials.md, "Weathered walls: hairline cracks"): its
// windows, doors and whatever else is fixed on it. Those are meshes of their own, so the wall's shader cannot see
// them; each world's builders hand their small pieces in here as they lay them (the kits' add, the Signal Market's
// add) and the scene's small meshes are added once the world is built (`collectScene`). Every box, grown by a
// margin, marks the voxels it covers in a hashed bit table (a false hit only leaves a crack out, never draws
// one over a window); the table goes to the shader as a texture (`uOpenings`), and `weatherInk` keeps a crack
// only if none of the points along it lands in a marked voxel.

export const OPENINGS = {
  voxel: 0.5,        // m: the table's cells
  margin: 0.25,      // m round every piece kept clear of cracks (and up to a voxel more)
  maxSize: 6,        // m: a piece longer than this on any side is a wall, a floor or a roof, not something on one
  maxVolume: 40,     // m³: nor anything as bulky
  side: 512,         // the texture's side, in RGBA8 texels: 32 bits each (2^23 bits, 1 MB)
  offset: 1 << 20,   // voxel indices made positive before hashing (the shader hashes unsigned ints)
};
const BITS = OPENINGS.side * OPENINGS.side * 32, MASK = BITS - 1;

/** The bit of voxel (ix, iy, iz): the shader's `openingBit`, the same unsigned arithmetic. */
export function openingBit(ix, iy, iz) {
  const x = (ix + OPENINGS.offset) >>> 0, y = (iy + OPENINGS.offset) >>> 0, z = (iz + OPENINGS.offset) >>> 0;
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x846ca68b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h & MASK;
}

/** The GLSL twin of openingBit and the lookup (materials.js includes it in weathered materials). */
export const OPENINGS_GLSL = `
  uniform highp sampler2D uOpenings;
  uniform float uOpeningsOn;
  bool openingAt(vec3 p) {
    if (uOpeningsOn < 0.5) return false;
    uvec3 v = uvec3(ivec3(floor(p / ${OPENINGS.voxel.toFixed(3)})) + ${OPENINGS.offset});
    uint h = (v.x * 73856093u) ^ (v.y * 19349663u) ^ (v.z * 83492791u);
    h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
    uint b = h & ${MASK}u, t = b >> 5u;
    vec4 c = texelFetch(uOpenings, ivec2(int(t % ${OPENINGS.side}u), int(t / ${OPENINGS.side}u)), 0);
    uint byteV = uint(c[int((b >> 3u) & 3u)] * 255.0 + 0.5);
    return ((byteV >> (b & 7u)) & 1u) == 1u;
  }
`;

const _box = new THREE.Box3(), _size = new THREE.Vector3();
/** Is a material weathered (the wall itself, not something on it)? */
const weathered = (m) => (Array.isArray(m) ? m.some(weathered) : !!m?.uniforms?.uWeather && m.uniforms.uWeather.value > 0);

export class WallOpenings {
  constructor() { this.reset(); }
  reset() {
    this.bits = new Uint8Array(BITS / 8);
    this.boxes = 0; this.voxels = 0; this.dirty = true;
    return this;
  }
  /** A piece's box (world, THREE.Box3 or min / max arrays), if it is small enough to be on a wall. */
  fits(box) {
    box.getSize(_size);
    return !box.isEmpty() && Math.max(_size.x, _size.y, _size.z) <= OPENINGS.maxSize && _size.x * _size.y * _size.z <= OPENINGS.maxVolume;
  }
  /** Mark a box (world), grown by the margin. Returns whether it was taken. */
  addBox(box, { force = false } = {}) {
    if (!force && !this.fits(box)) return false;
    const V = OPENINGS.voxel, m = OPENINGS.margin;
    const x0 = Math.floor((box.min.x - m) / V), x1 = Math.floor((box.max.x + m) / V);
    const y0 = Math.floor((box.min.y - m) / V), y1 = Math.floor((box.max.y + m) / V);
    const z0 = Math.floor((box.min.z - m) / V), z1 = Math.floor((box.max.z + m) / V);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const b = openingBit(x, y, z);
      this.bits[b >> 3] |= 1 << (b & 7);
    }
    this.voxels += (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1); this.boxes++; this.dirty = true;
    if (this.tex) { this.tex.needsUpdate = true; this.dirty = false; }   // (a piece laid once the table is on the GPU: sent again)
    return true;
  }
  /** A piece as a builder lays it: its geometry (in the world once moved by matrix) and its material. */
  addGeometry(geo, material, matrix = null) {
    if (weathered(material) || !geo?.attributes?.position) return false;
    if (!geo.boundingBox) geo.computeBoundingBox();
    _box.copy(geo.boundingBox);
    if (matrix) _box.applyMatrix4(matrix);
    return this.addBox(_box);
  }
  /** Every small static mesh of a built world (meshes of their own: home's windows, doors, lamps). */
  collectScene(root) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible || weathered(o.material)) return;
      if (o.material === undefined || o.userData?.noOpening) return;
      const g = o.geometry;
      if (!g?.attributes?.position) return;
      if (!g.boundingBox) g.computeBoundingBox();
      _box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      this.addBox(_box);
    });
    return this;
  }
  /** Is a point (world) in or near a piece? (the shader's openingAt) */
  has(x, y, z) {
    const V = OPENINGS.voxel, b = openingBit(Math.floor(x / V), Math.floor(y / V), Math.floor(z / V));
    return (this.bits[b >> 3] >> (b & 7) & 1) === 1;
  }
  /** Is every point of a path clear? */
  clear(points) { return points.every((p) => !this.has(p[0] ?? p.x, p[1] ?? p.y, p[2] ?? p.z)); }
  /** The share of the table's bits set: the chance a crack is left out for nothing. */
  get fill() { let n = 0; for (const v of this.bits) { let b = v; while (b) { n += b & 1; b >>= 1; } } return n / BITS; }
  /** The table as a texture (RGBA8, 32 bits a texel: byte (bit >> 3) & 3 of texel bit >> 5). */
  texture() {
    if (!this.tex) {
      this.tex = new THREE.DataTexture(this.bits, OPENINGS.side, OPENINGS.side, THREE.RGBAFormat, THREE.UnsignedByteType);
      this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
      this.tex.generateMipmaps = false; this.tex.flipY = false;
    }
    if (this.tex.image.data !== this.bits) this.tex.image.data = this.bits;
    if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; }
    return this.tex;
  }
  /** Hand the table to the shaders (uniforms: materials.js sharedUniforms). */
  flush(uniforms) {
    if (!this.boxes) { uniforms.uOpeningsOn.value = 0; return this; }
    uniforms.uOpenings.value = this.texture();
    uniforms.uOpeningsOn.value = 1;
    return this;
  }
}

/** The world's table: the builders add to it while a world is built; main.js flushes it once it is up. */
export const wallOpenings = new WallOpenings();
