// The coral-shirt traveller's overshirt done by an engine (src/characters/tripo-cloth.js CLOTH_HOST): the cage's
// steps (tripo-cloth-sim.js simulate), the garment's vertices from the cage and the bones, their normals. The
// module works out each frame's packet on the VM's thread (the targets, the capsules, the bones' matrices: the
// cheap part); this is the rest, as the module itself does it, in plain arrays, so an engine can run it apart:
// Unity in a Burst job (BridgeCloth.cs, the same steps in the same order), a test here against the module.
//
//   const st = clothState(desc)                  desc: tripo-cloth.js offload.init's
//   clothFrame(desc, st, packet, pos, nrm)       pos, nrm: the garment's positions and normals (3 a vertex), written
//
// The description's flags (the fit's, traveller-b3.js): preservePinNormals (map.pin: the pinned vertices keep their own
// skinned normals, eased into the faces' by their freedom) and detailCollisions (false: no free vertex pushed out of the
// leg capsules; the cage alone meets the legs). A description without them is a v1 garment's: every normal from the
// faces, the free vertices pushed out.
import { simulate, pushOut, CAP } from '../src/characters/tripo-cloth-sim.js';

/** What the engine keeps between frames: the cage's positions, the previous ones, the targets they were stepped against. */
export function clothState(desc) {
  const n = desc.N * 3;
  return { sim: { ...desc.constants, P: new Float64Array(n), Q: new Float64Array(n) }, target: new Float64Array(n), D: new Float64Array(n) };
}

/** One frame (tripo-cloth.js update, from the step on): packet { G, simCaps, mapCaps, boneMesh, attach, steps, reset, simulated }. */
export function clothFrame(desc, st, pk, out, nrm) {
  const { sim, target, D } = st, N3 = desc.N * 3, K = desc.caps;
  if (pk.reset || !pk.simulated) { sim.P.set(pk.G); sim.Q.set(pk.G); target.set(pk.G); }
  if (pk.simulated && pk.steps) { simulate(sim, pk.G, pk.simCaps, pk.steps); target.set(pk.G); }
  const P = sim.P, M = desc.map, e = pk.attach, B = pk.boneMesh, mapCaps = pk.mapCaps;
  for (let j = 0; j < N3; j++) D[j] = P[j] - target[j];
  for (let v = 0; v < M.count; v++) {
    const l = v * 3, lx = M.local[l], ly = M.local[l + 1], lz = M.local[l + 2], free = M.free[v];
    let x = e[0] * lx + e[4] * ly + e[8] * lz + e[12], y = e[1] * lx + e[5] * ly + e[9] * lz + e[13], z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
    if (free < 1) {
      let sx = 0, sy = 0, sz = 0;
      const bx = M.base[l], by = M.base[l + 1], bz = M.base[l + 2];
      for (let k = v * 4, end = k + 4; k < end; k++) {
        const w = M.skinW[k]; if (w === 0) continue;
        const c = M.skinB[k] * 16;
        sx += (B[c] * bx + B[c + 4] * by + B[c + 8] * bz + B[c + 12]) * w; sy += (B[c + 1] * bx + B[c + 5] * by + B[c + 9] * bz + B[c + 13]) * w; sz += (B[c + 2] * bx + B[c + 6] * by + B[c + 10] * bz + B[c + 14]) * w;
      }
      const t = 1 - free; x += (sx - x) * t; y += (sy - y) * t; z += (sz - z) * t;
    }
    if (free > 0) for (let k = v * 4, end = k + 4; k < end; k++) { const j = M.ids[k], w = M.weights[k]; x += D[j] * w; y += D[j + 1] * w; z += D[j + 2] * w; }
    if (pk.simulated && desc.detailCollisions !== false && free > 0.95) {
      const ox = M.outward[l], oy = M.outward[l + 1], oz = M.outward[l + 2];
      for (let k = 0; k < K; k++) { const hi = pushOut(x, y, z, ox, oy, oz, mapCaps, k); if (hi) { x += ox * hi; y += oy * hi; z += oz * hi; } }
    }
    const o = M.out[v]; out[o] = x; out[o + 1] = y; out[o + 2] = z;
  }
  // the normals (tripo-cloth.js vertexNormals: the same sums in the same order)
  const index = desc.index;
  nrm.fill(0);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const bx = out[b], by = out[b + 1], bz = out[b + 2];
    const cbx = out[c] - bx, cby = out[c + 1] - by, cbz = out[c + 2] - bz, abx = out[a] - bx, aby = out[a + 1] - by, abz = out[a + 2] - bz;
    const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx;
    nrm[a] += x; nrm[a + 1] += y; nrm[a + 2] += z; nrm[b] += x; nrm[b + 1] += y; nrm[b + 2] += z; nrm[c] += x; nrm[c + 1] += y; nrm[c + 2] += z;
  }
  for (let i = 0; i < nrm.length; i += 3) { const x = nrm[i], y = nrm[i + 1], z = nrm[i + 2], s = 1 / (Math.sqrt(x * x + y * y + z * z) || 1); nrm[i] = x * s; nrm[i + 1] = y * s; nrm[i + 2] = z * s; }
  // the pinned vertices' own (fit.preservePinNormals, tripo-cloth.js update): the detailed mesh's rest normal turned by
  // each of its bones (three's transformDirection: the matrix's 3×3, then normalised), weighted, normalised; the
  // face normal eased that far towards it (map.pin's fourth: 1 - smoothstep(free, 0, .4)), normalised again
  if (desc.preservePinNormals) pinNormals(M, B, nrm);
}

/** Map.pin's normals into nrm (clothFrame's last step; BridgeCloth.cs PinNormal the same). */
function pinNormals(M, B, nrm) {
  const R = M.pin;
  for (let v = 0; v < M.count; v++) {
    const q = v * 4, t = R[q + 3]; if (t === 0) continue;
    const rx = R[q], ry = R[q + 1], rz = R[q + 2];
    let x = 0, y = 0, z = 0;
    for (let k = v * 4, end = k + 4; k < end; k++) {
      const w = M.skinW[k]; if (!w) continue;
      const c = M.skinB[k] * 16;
      const dx = B[c] * rx + B[c + 4] * ry + B[c + 8] * rz, dy = B[c + 1] * rx + B[c + 5] * ry + B[c + 9] * rz, dz = B[c + 2] * rx + B[c + 6] * ry + B[c + 10] * rz;
      const s = 1 / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
      x += dx * s * w; y += dy * s * w; z += dz * s * w;
    }
    let s = 1 / (Math.sqrt(x * x + y * y + z * z) || 1); x *= s; y *= s; z *= s;
    const o = M.out[v];
    const nx = nrm[o] + (x - nrm[o]) * t, ny = nrm[o + 1] + (y - nrm[o + 1]) * t, nz = nrm[o + 2] + (z - nrm[o + 2]) * t;
    s = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
    nrm[o] = nx * s; nrm[o + 1] = ny * s; nrm[o + 2] = nz * s;
  }
}

/** The floats a capsule takes (tripo-cloth-sim.js CAP), for the engines' layouts. */
export { CAP };

/**
 * The description as one ArrayBuffer for an engine (BridgeCloth.cs reads it), all little-endian 32-bit:
 *   u32 N, E (edges), M (garment vertices mapped), V (garment vertices), T (index count), K (capsules), Bn (bones),
 *       flags (CLOTH_PIN_NORMALS: map.pin follows; CLOTH_NO_DETAIL_COLLISIONS: no free vertex pushed out of the legs)
 *   f32 pins N, outwards 3N, i32 edgeA E, edgeB E, f32 edgeLength E, edgeK E,
 *   f32 local 3M, i32 ids 4M (particle offsets × 3), f32 weights 4M, free M, outward 3M, i32 out M (vertex offset × 3),
 *   f32 base 3M, i32 skinB 4M, f32 skinW 4M, i32 index T,
 *   with CLOTH_PIN_NORMALS: f32 pin 4M (each mapped vertex's rest normal in the detailed mesh, mesh space, and how far
 *       its normal goes to it skinned by skinB / skinW: 0 for a vertex whose normal is its faces' alone)
 */
export const CLOTH_PIN_NORMALS = 1, CLOTH_NO_DETAIL_COLLISIONS = 2;
export function packClothDesc(d) {
  const C = d.constants, M = d.map, N = d.N, E = C.edgeA.length, Mc = M.count, T = d.index.length;
  const pin = !!d.preservePinNormals, flags = (pin ? CLOTH_PIN_NORMALS : 0) | (d.detailCollisions === false ? CLOTH_NO_DETAIL_COLLISIONS : 0);
  if (pin && M.pin?.length !== 4 * Mc) throw new Error('cloth: preservePinNormals without map.pin');
  const words = 8 + N + 3 * N + 4 * E + 3 * Mc + 4 * Mc + 4 * Mc + Mc + 3 * Mc + Mc + 3 * Mc + 4 * Mc + 4 * Mc + T + (pin ? 4 * Mc : 0);
  const buf = new ArrayBuffer(words * 4), u = new Uint32Array(buf), i32 = new Int32Array(buf), f = new Float32Array(buf);
  let o = 0;
  for (const v of [N, E, Mc, d.vertices, T, d.caps, d.bones, flags]) u[o++] = v;
  const F = (a) => { f.set(a, o); o += a.length; }, I = (a) => { i32.set(a, o); o += a.length; };
  F(C.pins); F(C.outwards); I(C.edgeA); I(C.edgeB); F(C.edgeLength); F(C.edgeK);
  F(M.local); I(M.ids); F(M.weights); F(M.free); F(M.outward); I(M.out); F(M.base); I(M.skinB); F(M.skinW);
  I(d.index);
  if (pin) F(M.pin);
  return buf;
}

/** packClothDesc's buffer read back (as BridgeCloth.cs reads it): the description's arrays, as floats and ints. */
export function unpackClothDesc(buf) {
  const u = new Uint32Array(buf), i32 = new Int32Array(buf), f = new Float32Array(buf);
  let o = 0;
  const [N, E, Mc, vertices, T, caps, bones, flags] = u.subarray(0, 8); o = 8;
  const F = (n) => f.slice(o, o += n), I = (n) => i32.slice(o, o += n);
  const constants = { pins: F(N), outwards: F(3 * N), edgeA: I(E), edgeB: I(E), edgeLength: F(E), edgeK: F(E) };
  const map = { count: Mc, local: F(3 * Mc), ids: I(4 * Mc), weights: F(4 * Mc), free: F(Mc), outward: F(3 * Mc), out: I(Mc), base: F(3 * Mc), skinB: I(4 * Mc), skinW: F(4 * Mc) };
  const index = I(T);
  if (flags & CLOTH_PIN_NORMALS) map.pin = F(4 * Mc);
  if (o !== u.length) throw new Error(`cloth: the description is ${u.length} words, its layout ${o}`);
  return { N, caps, bones, vertices, constants, map, index, preservePinNormals: !!(flags & CLOTH_PIN_NORMALS), detailCollisions: !(flags & CLOTH_NO_DETAIL_COLLISIONS) };
}
