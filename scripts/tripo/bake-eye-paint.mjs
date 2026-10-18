// The portrait head's painted eyes and brows for the engines (issue #473): head-v3's own texture (a 2048 px JPEG the
// engines' VM cannot decode) front-projected once into source-front space over PORTRAIT_EYE_PAINT's box, the nearest
// surface at each point, as the page's shader reads it there through the mesh's UVs. Unity draws his eyes from this
// picture (PortraitFace.hlsl), where his vertex colours (a few vertices across an iris) had drawn them blurred.
// Display values (the JPEG's own); alpha the hair's share there (the mesh's _PORTRAIT_HAIR, which the page inks).
//   node scripts/tripo/bake-eye-paint.mjs [--check]
import fs from 'node:fs';
import sharp from 'sharp';
import { PORTRAIT_EYE_PAINT } from '../../src/characters/portrait-head.js';

const GLB = 'public/characters/traveller-v1/head-v3/model.glb';
const OUT = 'public/characters/traveller-v1/head-v3/eye-paint.png';
const { box: [X0, Y0, X1, Y1], size: [W, H] } = PORTRAIT_EYE_PAINT;

/** head-v3's single mesh: positions (source-front space), UVs, indices, and its base colour JPEG. */
export function readHead(file = GLB) {
  const b = fs.readFileSync(file);
  const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), bin = 20 + len + 8;
  const view = (i) => { const v = j.bufferViews[i]; return b.subarray(bin + (v.byteOffset ?? 0), bin + (v.byteOffset ?? 0) + v.byteLength); };
  const acc = (i, Type) => {
    const a = j.accessors[i], v = view(a.bufferView), n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type];
    const s = v.subarray(a.byteOffset ?? 0, (a.byteOffset ?? 0) + a.count * n * Type.BYTES_PER_ELEMENT);
    return new Type(s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength));
  };
  const prim = j.meshes[0].primitives[0];
  const ia = j.accessors[prim.indices];
  const index = acc(prim.indices, ia.componentType === 5125 ? Uint32Array : Uint16Array);
  return { P: acc(prim.attributes.POSITION, Float32Array), U: acc(prim.attributes.TEXCOORD_0, Float32Array), hair: acc(prim.attributes._PORTRAIT_HAIR, Float32Array), index, jpeg: view(j.images[0].bufferView) };
}

export async function bakeEyePaint() {
  const { P, U, hair, index, jpeg } = readHead();
  const { data: src, info } = await sharp(jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const SW = info.width, SH = info.height;
  // bilinear, the UV's v up (glTF: v down from the top row)
  const sample = (u, v, out) => {
    const px = u * SW - 0.5, py = v * SH - 0.5, x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    const at = (x, y, k) => src[(Math.min(SH - 1, Math.max(0, y)) * SW + Math.min(SW - 1, Math.max(0, x))) * 3 + k];
    for (let k = 0; k < 3; k++) out[k] = (at(x0, y0, k) * (1 - fx) + at(x0 + 1, y0, k) * fx) * (1 - fy) + (at(x0, y0 + 1, k) * (1 - fx) + at(x0 + 1, y0 + 1, k) * fx) * fy;
  };
  const rgba = new Uint8Array(W * H * 4), depth = new Float32Array(W * H).fill(-Infinity), c = [0, 0, 0];
  const sx = W / (X1 - X0), sy = H / (Y1 - Y0);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], d = index[t + 2];
    const X = [P[a * 3], P[b * 3], P[d * 3]], Y = [P[a * 3 + 1], P[b * 3 + 1], P[d * 3 + 1]], Z = [P[a * 3 + 2], P[b * 3 + 2], P[d * 3 + 2]];
    if (Math.max(...Z) < 0.08) continue;   // (the face's front only)
    // to the picture's pixels, its rows top down
    const px = X.map((x) => (x - X0) * sx), py = Y.map((y) => (Y1 - y) * sy);
    const area = (px[1] - px[0]) * (py[2] - py[0]) - (px[2] - px[0]) * (py[1] - py[0]);
    if (Math.abs(area) < 1e-9) continue;
    const i0 = Math.max(0, Math.floor(Math.min(...px))), i1 = Math.min(W - 1, Math.ceil(Math.max(...px)));
    const j0 = Math.max(0, Math.floor(Math.min(...py))), j1 = Math.min(H - 1, Math.ceil(Math.max(...py)));
    for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
      const x = ii + 0.5, y = jj + 0.5;
      const w0 = ((px[1] - x) * (py[2] - y) - (px[2] - x) * (py[1] - y)) / area;
      const w1 = ((px[2] - x) * (py[0] - y) - (px[0] - x) * (py[2] - y)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * Z[0] + w1 * Z[1] + w2 * Z[2], k = jj * W + ii;
      if (z <= depth[k]) continue;
      depth[k] = z;
      sample(w0 * U[a * 2] + w1 * U[b * 2] + w2 * U[d * 2], w0 * U[a * 2 + 1] + w1 * U[b * 2 + 1] + w2 * U[d * 2 + 1], c);
      rgba[k * 4] = Math.round(c[0]); rgba[k * 4 + 1] = Math.round(c[1]); rgba[k * 4 + 2] = Math.round(c[2]); rgba[k * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, w0 * hair[a] + w1 * hair[b] + w2 * hair[d])));
    }
  }
  // (the few pixels between triangles' edges, or past the hair's tips: their covered neighbours' paint)
  for (let left = 1, pass = 0; left && pass < 16; pass++) {
    left = 0;
    const was = depth.slice();
    for (let jj = 0; jj < H; jj++) for (let ii = 0; ii < W; ii++) {
      const k = jj * W + ii;
      if (was[k] !== -Infinity) continue;
      const s = [0, 0, 0, 0];
      let n = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i2 = ii + di, j2 = jj + dj, k2 = j2 * W + i2;
        if (i2 < 0 || j2 < 0 || i2 >= W || j2 >= H || was[k2] === -Infinity) continue;
        for (let c = 0; c < 4; c++) s[c] += rgba[k2 * 4 + c];
        n++;
      }
      if (!n) { left++; continue; }
      for (let c = 0; c < 4; c++) rgba[k * 4 + c] = Math.round(s[c] / n);
      depth[k] = 0;
    }
  }
  return sharp(Buffer.from(rgba.buffer), { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const png = await bakeEyePaint();
  if (process.argv.includes('--check')) {
    const { data: a } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const { data: b } = await sharp(OUT).raw().toBuffer({ resolveWithObject: true });
    process.exit(Buffer.compare(a, b) === 0 ? 0 : 1);
  }
  fs.writeFileSync(OUT, png);
  console.log(`${OUT}: ${W} × ${H}, ${(png.length / 1024).toFixed(0)} KB`);
}
