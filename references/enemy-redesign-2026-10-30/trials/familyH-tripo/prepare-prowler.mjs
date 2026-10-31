// #800 family H: the prowler's (the pod stalker's) rigged Tripo export (../../prowler/tripo/rigged.glb, untouched: Tripo's
// biped rig, Mixamo names, 23 joints) made into the game's asset (public/enemies/prowler/body.glb + skeleton.json) and the
// trial's (prowler-lod.glb, prowler-texture.png), by prep-biped.mjs's steps. Its own:
//
// - HEIGHT: the head's top in the T-pose (m at size 1): the clips lean it forward (PROWLER_STANCE), so it stands about
//   the traveller's height and a little more, as the legacy prowler did (1.85 m drawn);
// - the parts: the dusky mauve skin, the cream muzzle (its painted mouth line kept, ink), the sage belly from the throat
//   down between the legs and under the tail; Tripo's darker folds and specks (the k-means' ink off the face) skin;
// - the painted eyes (two black dots high on the head, either side) painted out: the game gives it real eyes on its
//   head's bone, measured here (skeleton.json eyes);
// - the tail: Tripo's rig has none (its tail hangs on the hips). Its centreline is measured from the mesh (the slabs
//   behind the hips: each slab's middle, from the root at the back of the hips to the tip on the ground), resampled into
//   TAIL.n segments of one length; five joints are added after Tripo's 23 (`Tail0`…), and every tail vertex (behind the
//   root under the hips' height, led by the hips) is weighted to them by where it lies along the line, blended
//   over a quarter segment either side of each joint and into the hips at the root.
//
//   node references/enemy-redesign-2026-10-30/trials/familyH-tripo/prepare-prowler.mjs
import { prepare } from './prep-biped.mjs';

const HEIGHT = 1.9;
/** The k-means' clusters (K 6, deterministic) and the part each one is. */
const CLUSTERS = { '#50453c': 'ink', '#8b6353': 'skin', '#926555': 'skin', '#8f6555': 'skin', '#868666': 'belly', '#dbbc87': 'muzzle' };
/** One flat colour a part, the reference's own (measured off the approved image). */
export const PALETTE = { skin: '#926456', muzzle: '#dcc99b', belly: '#767957', ink: '#1a1210' };
/** The painted eyes: the ink this high on the head (m), either side of the middle. */
const EYE_Y = 1.64;
/** The tail: its segments; the slabs it is measured in (m along z, from the root back); its root plane's z. */
export const TAIL = { n: 5, step: 0.05, root: -0.42, tip: -1.41, ground: 0.01 };

/** The tail's line through the slabs' middles (each slab's vertices led by the hips, below the hips' height). */
function tailLine({ P, J, W, nv, hipY }) {
  const mids = [];
  for (let z = TAIL.root; z > TAIL.tip; z -= TAIL.step) {
    let lo = Infinity, hi = -Infinity, sx = 0, k = 0;
    for (let v = 0; v < nv; v++) { const pz = P[v * 3 + 2], py = P[v * 3 + 1]; if (pz > z || pz <= z - TAIL.step || py > hipY * 0.85) continue; lo = Math.min(lo, py); hi = Math.max(hi, py); sx += P[v * 3]; k++; }
    if (k) mids.push([sx / k, (lo + hi) / 2, z - TAIL.step / 2, (hi - lo) / 2]);
  }
  return mids;
}
/** A polyline resampled into n segments of one length: n + 1 points, the length. */
function resample(pts, n) {
  const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const L = d.at(-1), out = [];
  for (let s = 0; s <= n; s++) { const want = (L * s) / n; let i = 1; while (i < d.length - 1 && d[i] < want) i++; const u = (want - d[i - 1]) / (d[i] - d[i - 1] || 1);
    out.push([0, 1, 2, 3].map((q) => pts[i - 1][q] + (pts[i][q] - pts[i - 1][q]) * u)); }
  return { pts: out, len: L / n };
}
const r4 = (x) => +x.toFixed(4);

function tail(L) {
  const { P, J, W, nv, names, joints } = L;
  const line = tailLine(L), { pts, len } = resample(line, TAIL.n);
  const hips = names.indexOf('Hips'), first = names.length;
  // (each vertex's place along the line: its nearest point on a segment; s in segments, 0 at the root; its distance off it)
  const along = (p) => { let best = { d: Infinity, s: 0 };
    for (let i = 0; i < TAIL.n; i++) { const a = pts[i], b = pts[i + 1], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      let u = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2; const raw = u; u = Math.max(i ? 0 : -1, Math.min(1, u));
      const q = [a[0] + ab[0] * u, a[1] + ab[1] * u, a[2] + ab[2] * u], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), r = a[3] + (b[3] - a[3]) * Math.max(0, Math.min(1, raw));
      if (d < best.d) best = { d, s: i + u, r }; }
    return best; };
  let moved = 0;
  for (let v = 0; v < nv; v++) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    if (p[2] > TAIL.root + 0.06) continue;
    // (only what the hips carry: never a thigh's)
    let lead = 0; for (let q = 1; q < 4; q++) if (W[v * 4 + q] > W[v * 4 + lead]) lead = q;
    if (J[v * 4 + lead] !== hips) continue;
    const { d, s, r } = along(p);
    // (every one behind the root under the hips' height: the tail's whole girth and its tip, however far off its line)
    if (s < -0.25 || p[1] > L.hipY * 0.85 + 0.05) continue;
    // (blended a quarter segment either side of each joint; at the root, into the hips)
    const k = Math.floor(s + 0.25), u = s + 0.25 - k;
    const wNext = u < 0.5 ? u / 0.5 : 1, a = k - 1, b = Math.min(TAIL.n - 1, k);
    const ja = a < 0 ? hips : first + a, jb = first + Math.max(0, b);
    const pairs = wNext >= 1 || ja === jb ? [[jb, 1]] : [[ja, 1 - wNext], [jb, wNext]];
    for (let q = 0; q < 4; q++) { J[v * 4 + q] = pairs[q]?.[0] ?? 0; W[v * 4 + q] = pairs[q]?.[1] ?? 0; }
    moved++;
  }
  const tailJoints = pts.slice(0, TAIL.n).map((p, i) => ({ name: `Tail${i}`, parent: i ? `Tail${i - 1}` : 'Hips', at: p.slice(0, 3).map(r4) }));
  joints.push(...tailJoints);
  return { tail: { n: TAIL.n, len: r4(len), points: pts.map((p) => p.slice(0, 3).map(r4)), radius: pts.map((p) => r4(p[3])), vertices: moved } };
}

const { report, skeleton } = await prepare({
  id: 'prowler', concept: 'prowler', rigged: 'references/enemy-redesign-2026-10-30/prowler/tripo/rigged.glb', height: HEIGHT, target: 12000, K: 6,
  tasks: { generation: '283212a4-4ece-4891-8f99-2a1682b2b69f', rig: '97ca2b8c-6833-462e-938c-4f2d88444a97' },
  clusters: CLUSTERS, palette: PALETTE,
  // (the muzzle's and the belly's own borders, smoothed through Tripo's ragged edges; the mouth line the ink across the
  //  muzzle, any other ink, Tripo's folds and specks, skin)
  cuts: [{ name: 'muzzle', roles: ['muzzle', 'ink'], smooth: 5, only: (p) => p[1] > 1.3 && p[1] < 1.66 && p[2] > 0.21 }, { name: 'belly', roles: ['belly'], smooth: 5 }],
  partAt: (role, group, p, L, inside) => (inside.muzzle ? 'muzzle' : inside.belly ? 'belly' : 'skin'),
  // (the mouth line: the ink across the muzzle, painted out and measured; the game draws it as an ink line on the head)
  marks: (p, role, L, inside) => (role === 'ink' && inside.muzzle && p[1] < EYE_Y ? 'mouth' : null), markPaint: 'muzzle',
  eyes: (p, role) => (role === 'ink' && p[1] > EYE_Y && Math.abs(p[0]) > 0.06 ? (p[0] > 0 ? 1 : 2) : 0), eyePaint: 'skin',
  extra: tail,
});
console.log(JSON.stringify({ ...report, tail: skeleton.tail }));
