// Where the traveller's nose and mouth really are on head-v3's mesh (issue #266), measured on its own geometry
// in source-front space (x right, y up, z toward the viewer; the units bake-face-ink.mjs and portrait-head.js use).
// The face ink is the approved portrait's own pen lines, but the portrait and the mesh Tripo made from it do not
// agree: the mesh's nose is longer and sits a little right of the centre line, its mouth lower, its lower lip
// fuller. Front-projected unmoved, the portrait's nostrils sat on the nose's front and its mouth on the upper lip.
// bake-face-ink.mjs moves each stroke onto these landmarks; tests/portrait-face-ink.test.js measures the result,
// at rest and on the morphed face of each expression.
//
//   faceLandmarks(geometry)   (geometry: source-front positions and normals, optionally _portrait_hair)
//     ridge                   the nose's centre line (x where its normal turns from left to right)
//     tip, subnasale          [x, y, z] on the centre line: the nose's furthest point, the corner under it
//     wings                   { left, right: x of the groove round each wing, top, bottom: y } (bottom: the
//                             lowest the nose's underside reaches, as seen from in front)
//     mouth                   { stomion: y on the centre line, crease: [[x, y, depth]…] the valley between the
//                             lips column by column, corners: [x, x] where that valley fades }
//     lowerLip                [[x, y]…] the lower lip's lower edge (its normal turned furthest down)
//     fold                    [x, y] the hollow between the lower lip and the chin
//     surface(x, y)           { z, normal, face, bary } the frontmost skin under a point (null: nothing there)
import * as T from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const R = 0.001;   // the sampling step (source units: 0.26 mm)

export function faceLandmarks(geometry) {
  const bvh = new MeshBVH(geometry), pos = geometry.attributes.position, nrm = geometry.attributes.normal;
  const ray = new T.Ray(new T.Vector3(), new T.Vector3(0, 0, -1)), tri = new T.Triangle(), bary = new T.Vector3();
  const cache = new Map();
  function surface(x, y) {
    const key = `${Math.round(x / R * 4)},${Math.round(y / R * 4)}`;
    if (cache.has(key)) return cache.get(key);
    ray.origin.set(x, y, 2);
    const hit = bvh.raycastFirst(ray, T.DoubleSide);
    let out = null;
    if (hit) {
      const { a, b, c } = hit.face;
      tri.setFromAttributeAndIndices(pos, a, b, c); tri.getBarycoord(hit.point, bary);
      const n = new T.Vector3();
      for (const [v, w] of [[a, bary.x], [b, bary.y], [c, bary.z]]) n.x += nrm.getX(v) * w, n.y += nrm.getY(v) * w, n.z += nrm.getZ(v) * w;
      out = { z: hit.point.z, normal: n.normalize(), face: [a, b, c], bary: [bary.x, bary.y, bary.z] };
    }
    cache.set(key, out);
    return out;
  }
  const z = (x, y) => surface(x, y)?.z ?? NaN;
  // (z a little smoothed: the mesh's own facets are about 1 mm)
  const zs = (x, y, r = 0.001) => { let s = 0, n = 0; for (let a = -r; a <= r + 1e-9; a += R) for (let b = -r; b <= r + 1e-9; b += R) { const v = z(x + a, y + b); if (!Number.isNaN(v)) { s += v; n++; } } return n ? s / n : NaN; };
  const ny = (x, y) => surface(x, y)?.normal.y ?? 0, nx = (x, y) => surface(x, y)?.normal.x ?? 0;
  const median = (a) => [...a].sort((p, q) => p - q)[a.length >> 1];
  // the nose's centre line
  const ridge = median([0.38, 0.4, 0.43, 0.46].map((y) => { let m = 0; for (let x = -0.03; x <= 0.03; x += R) if (nx(x, y) >= 0 && nx(x - R, y) < 0) m = x; return m; }));
  // the centre line's profile, down from the nose to the chin
  const profile = [];
  for (let y = 0.47; y >= 0.17; y -= R) profile.push([y, zs(ridge, y, 0.002)]);
  const pick = (lo, hi, most) => profile.filter(([y]) => y >= lo && y <= hi).reduce((m, p) => ((most ? p[1] > m[1] : p[1] < m[1]) ? p : m));
  const tip = pick(0.35, 0.46, true), sub = pick(0.315, tip[0] - 0.01, false);
  const upper = pick(0.295, sub[0] - 0.005, true), lower = pick(0.24, upper[0] - 0.025, true);
  const stomion = pick(lower[0] + 0.004, upper[0] - 0.004, false)[0];
  // the valley between the lips, column by column (how far it sits under the mean of the lips 6 units of R above and below)
  const crease = [];
  for (let x = ridge - 0.1; x <= ridge + 0.1 + 1e-9; x += 0.005) {
    let best = null;
    for (let y = stomion + 0.015; y >= stomion - 0.015; y -= R) {
      const d = (zs(x, y + 0.006) + zs(x, y - 0.006)) / 2 - zs(x, y);
      if (!best || d > best[2]) best = [x, y, d];
    }
    crease.push(best);
  }
  // the corners: from the middle out, where the valley fades under 1.5 thousandths for good
  const deep = (c) => c[2] > 0.0015;
  const mid = crease.findIndex((c) => c[0] >= ridge - 1e-9);
  let l = mid, r = mid;
  while (l > 0 && crease.slice(Math.max(0, l - 2), l).some(deep)) l--;
  while (r < crease.length - 1 && crease.slice(r + 1, r + 3).some(deep)) r++;
  const corners = [crease[l][0], crease[r][0]];
  // the grooves round the nose's wings: the deepest horizontal valley each side, over the wing's height
  const rows = [];
  for (let y = 0.42; y >= sub[0]; y -= 0.0025) {
    const side = (s) => { let b = null; for (let ax = 0.035; ax <= 0.085; ax += R) { const x = ridge + s * ax, d = (z(x - 0.005, y) + z(x + 0.005, y)) / 2 - z(x, y); if (!b || d > b[1]) b = [x, d]; } return b; };
    rows.push({ y, left: side(-1), right: side(1) });
  }
  const strong = rows.filter((w) => Math.min(w.left[1], w.right[1]) > 0.005);
  const best = strong.reduce((m, w) => (Math.min(w.left[1], w.right[1]) > Math.min(m.left[1], m.right[1]) ? w : m));
  // the nose's lower outline (its underside, seen from in front): under the tip, and under the wings
  let bottom = 1, foot = 1;
  for (let y = tip[0]; y >= sub[0]; y -= R) for (let x = ridge - 0.06; x <= ridge + 0.06; x += 0.002) if (ny(x, y) < -0.5) {
    bottom = Math.min(bottom, y);
    if (Math.abs(x - ridge) > 0.03) foot = Math.min(foot, y);
  }
  const wings = { left: best.left[0], right: best.right[0], y: best.y, top: Math.max(...strong.map((w) => w.y)), bottom, foot };
  // the lower lip's lower edge, and the hollow under it
  const lowerLip = [-0.04, -0.02, 0, 0.02, 0.04].map((dx) => { let m = [0, 9]; for (let y = stomion - 0.015; y >= stomion - 0.07; y -= R) { const v = ny(ridge + dx, y); if (v < m[1]) m = [y, v]; } return [ridge + dx, m[0]]; });
  const fold = [ridge, pick(0.19, Math.min(...lowerLip.map((p) => p[1])) - 0.002, false)[0]];
  return {
    ridge, tip: [ridge, tip[0], tip[1]], subnasale: [ridge, sub[0], sub[1]], wings,
    mouth: { stomion, crease, corners }, lowerLip, fold, surface,
  };
}

/** head-v3's single mesh, as loaded (GLTFLoader's scene), in source-front space. */
export function headGeometry(scene) {
  let mesh = null;
  scene.traverse((o) => { if (o.isMesh) mesh = o; });
  if (!mesh) throw new Error('head-v3 has no mesh');
  return mesh.geometry;
}
