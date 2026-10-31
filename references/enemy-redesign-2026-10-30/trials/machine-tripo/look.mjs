// #800 family D: a quick look at a prepared body without a browser: its triangles rasterised (orthographic, a z-buffer,
// lit from the upper left), in its vertex colours or each part in its own colour, from the front, the side, three
// quarters and above, in one picture.   node look.mjs <body.glb> <out.png> [--parts] [--yaw r]
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const [IN, OUT, ...rest] = process.argv.slice(2), byPart = rest.includes('--parts');
const b = readFileSync(IN), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return { arr: new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)), size: CO[a.type] }; };
const pr = j.meshes[0].primitives[0], P = acc(pr.attributes.POSITION).arr, C = pr.attributes.COLOR_0 !== undefined ? acc(pr.attributes.COLOR_0) : null, I = acc(pr.indices).arr;
const J = pr.attributes.JOINTS_0 !== undefined ? acc(pr.attributes.JOINTS_0).arr : null, Wt = pr.attributes.WEIGHTS_0 !== undefined ? acc(pr.attributes.WEIGHTS_0).arr : null;
/** A vertex's main bone (its largest weight). */
const boneOf = (v) => { let b = 0; for (let k = 1; k < 4; k++) if (Wt[v * 4 + k] > Wt[v * 4 + b]) b = k; return J[v * 4 + b]; };
const n = P.length / 3, T = I.length / 3;
const HUES = [[200, 200, 200], [230, 120, 90], [90, 160, 230], [240, 210, 80], [120, 200, 120], [200, 120, 220], [120, 220, 220], [250, 160, 60], [150, 110, 80], [90, 90, 200], [230, 90, 160], [160, 230, 90], [60, 140, 110], [210, 170, 140], [130, 130, 60], [100, 60, 150], [240, 240, 140]];
let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[v * 3 + k]); hi[k] = Math.max(hi[k], P[v * 3 + k]); }
const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1.1, mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
const S = 420, views = [['front', 0, 0], ['side', Math.PI / 2, 0], ['3q', Math.PI / 4, -0.35], ['rear', Math.PI, 0], ['top', 0, -Math.PI / 2 + 0.01]];
const img = Buffer.alloc(S * views.length * S * 3, 235);
const L = (() => { const l = [-0.5, 0.7, 0.6]; const s = Math.hypot(...l); return l.map((x) => x / s); })();
views.forEach(([name, yaw, pitch], vi) => {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // (the camera looks along -z from the front at yaw 0: the body's +z toward it)
  const xf = (p) => { const x = p[0] - mid[0], y = p[1] - mid[1], z = p[2] - mid[2]; const x1 = x * cy - z * sy, z1 = x * sy + z * cy; const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; return [x1, y2, z2]; };
  const Q = new Float32Array(n * 3); for (let v = 0; v < n; v++) { const q = xf([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]); Q.set(q, v * 3); }
  const zb = new Float32Array(S * S).fill(-Infinity);
  for (let t = 0; t < T; t++) {
    const a = I[t * 3], bb = I[t * 3 + 1], c = I[t * 3 + 2];
    const A = [Q[a * 3], Q[a * 3 + 1], Q[a * 3 + 2]], B = [Q[bb * 3], Q[bb * 3 + 1], Q[bb * 3 + 2]], D = [Q[c * 3], Q[c * 3 + 1], Q[c * 3 + 2]];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const ln = Math.hypot(...nn) || 1; nn = nn.map((x) => x / ln);
    if (nn[2] < 0) nn = nn.map((x) => -x);
    const lam = 0.45 + 0.55 * Math.max(0, nn[0] * L[0] + nn[1] * L[1] + nn[2] * L[2]);
    let col;
    if (byPart && J) col = HUES[boneOf(a) % HUES.length];
    else if (C) { const s = C.size, f = C.arr instanceof Uint8Array ? 1 : 255; col = [0, 1, 2].map((k) => (C.arr[a * s + k] + C.arr[bb * s + k] + C.arr[c * s + k]) / 3 * f); }
    else col = [180, 180, 180];
    const px = (p) => [((p[0] / span) + 0.5) * S, (0.5 - p[1] / span) * S];
    const pa = px(A), pb = px(B), pd = px(D);
    const area = (pb[0] - pa[0]) * (pd[1] - pa[1]) - (pb[1] - pa[1]) * (pd[0] - pa[0]); if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pd[0]))), x1 = Math.min(S - 1, Math.ceil(Math.max(pa[0], pb[0], pd[0])));
    const y0 = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pd[1]))), y1 = Math.min(S - 1, Math.ceil(Math.max(pa[1], pb[1], pd[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w1 = ((pb[0] - x) * (pd[1] - y) - (pb[1] - y) * (pd[0] - x)) / area, w2 = ((pd[0] - x) * (pa[1] - y) - (pd[1] - y) * (pa[0] - x)) / area, w3 = 1 - w1 - w2;
      if (w1 < 0 || w2 < 0 || w3 < 0) continue;
      const z = w1 * A[2] + w2 * B[2] + w3 * D[2], k = y * S + x;
      if (z <= zb[k]) continue; zb[k] = z;
      const o = (y * S * views.length + vi * S + x) * 3;
      img[o] = Math.min(255, col[0] * lam); img[o + 1] = Math.min(255, col[1] * lam); img[o + 2] = Math.min(255, col[2] * lam);
    }
  }
});
await sharp(img, { raw: { width: S * views.length, height: S, channels: 3 } }).png().toFile(OUT);
console.log(OUT, 'triangles', T, 'views', views.map((v) => v[0]).join(' '));
