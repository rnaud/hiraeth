import * as THREE from 'three';
import { createNoise2D, mulberry32, smoothstep } from '../noise.js';
import { SandDrifts } from '../sand-drifts.js';

// ---------------------------------------------------------------------------
// The Glass Dunes' kit (references/The Glass Dunes/, docs/systems/worlds.md "The Glass Dunes"): the
// shapes the sheets draw, shared by the References views (reference-glassdunes.js) and the world
// (glass-dunes.js). Plain geometry; the look is the game's flat print, not refraction:
//
//   glassRidge    a ridge of fused sand turned to glass: a cross-section (its profile: a cliff, a
//                 frozen wave curling over, a billowing dome) swept along a path, folded into rounded
//                 lobes that lean as they rise (the frozen waves), its crest scalloped by them, both
//                 ends sinking into the sand. Opaque and lit as any surface; its colours are vertex
//                 colours: a lime foot where the low sun shines through the thin glass, a cooler teal
//                 up high, and the great dark silhouettes held inside it (giants, heads, trees) printed
//                 as soft darker masses, the same seen from either side.
//   glassArch     an archway in a ridge's foot: a glass rim, its opening lit green from beyond.
//   awningCamp    the glassworkers' camp: poles, sagging cloth awnings, crates, rugs, green glass
//                 floats on stands, a kiln.
//   boulders      dark wind-polished stones half sunk in the sand.
//
// Every builder takes a `kit` with { add(mat, geo, opts), H(x, z) } (lab-kit.js RoomKit, or the
// world's own) and works in that kit's frame. Colours are linear-free sRGB hex as everywhere.
// ---------------------------------------------------------------------------

/** The glass's tones (sRGB), read off the sheets' lit patches: lime at the foot, mint, teal up high. */
export const GLASS = { foot: '#d6f5a0', mid: '#7fd9a0', top: '#56b897', crest: '#c4f2c6', inside: [0.2, 0.36, 0.3] };
/** The sand's three tones (terrain mode), warm amber-peach. */
export const SAND = ['#f2c99c', '#eec092', '#e2ad80'];

/**
 * The glass's material options (makeMaterial): opaque, its colour in its vertices, a thin line in a dark
 * shade of its own colour (glass, as rendering.md "Lines by material"), few strokes, never a spot black,
 * a little self-light so its shade stays a luminous teal and it glows faintly at night.
 */
export const glassOptions = (o = {}) => ({ color: '#ffffff', vertexColors: true, line: 0.25, lineTint: 1, hatch: 0.22, spot: 0, glow: 0.12, shade: 0.25, ...o });

/** Profiles of a ridge's cross-section: [s (into the ridge, in depths), y (up, in heights)], front foot to back foot. */
export const PROFILES = {
  // the steep cliff with a rounded brow and a long top going back (the sheets' walls of glass)
  cliff: [[0, -0.05], [0.03, 0.25], [0.07, 0.6], [0.11, 0.88], [0.18, 0.98], [0.4, 1.0], [0.8, 0.99], [0.93, 0.7], [1, -0.05]],
  // a frozen wave: the face bellies out and its crest curls over the foot
  wave: [[0, -0.05], [0.12, 0.2], [0.14, 0.45], [0.06, 0.72], [0.02, 0.88], [0.1, 0.98], [0.28, 1.0], [0.55, 0.82], [0.85, 0.4], [1, -0.05]],
  // a billowing dome
  dome: [[0, -0.05], [0.04, 0.3], [0.13, 0.62], [0.27, 0.88], [0.45, 1.0], [0.65, 0.92], [0.85, 0.55], [1, -0.05]],
  // a wave breaking over its own hollow: the face sinks back under a lip that curls out past the foot
  curl: [[0, -0.05, 0.7], [0.35, 0.08, 0.42], [0.52, 0.32, 0.34], [0.5, 0.6, 0.38], [0.32, 0.8, 0.6], [0.06, 0.9, 0.9], [-0.2, 0.86], [-0.27, 0.78], [-0.2, 0.93], [0.02, 1.03], [0.3, 1.0], [0.6, 0.78], [1, -0.05]],
  // a low flow of glass over the sand (the sheets' green bands on the ground)
  flow: [[0, -0.3], [0.05, 0.6], [0.2, 1.0], [0.8, 1.0], [0.95, 0.6], [1, -0.3]],
};

const _c = new THREE.Color(), _a = new THREE.Color(), _b = new THREE.Color();
/** A soft inside-ness of a silhouette (a union of ellipses [u, y, rx, ry] in metres), 0..1, its edge `soft` m wide. */
export function silhouetteAt(sil, u, y, soft = 2) {
  let k = 0;
  for (const [cu, cy, rx, ry] of sil) {
    const d = Math.hypot((u - cu) / rx, (y - cy) / ry), r = Math.min(rx, ry);
    k = Math.max(k, smoothstep(1 + soft / r, 1 - soft / r, d));
    if (k >= 1) break;
  }
  return k;
}
/** The silhouettes the sheets hold in the glass, as unions of ellipses (u along the ridge, y up, m). */
export const SHAPES = {
  // a giant seated, shoulders and a round head
  giant: (u, y, s) => [[u, y + 0.5 * s, 0.55 * s, 0.6 * s], [u + 0.05 * s, y + 1.25 * s, 0.32 * s, 0.34 * s], [u - 0.35 * s, y + 0.25 * s, 0.35 * s, 0.4 * s], [u + 0.4 * s, y + 0.2 * s, 0.3 * s, 0.36 * s]],
  // a great round head and its neck
  head: (u, y, s) => [[u, y + 0.75 * s, 0.5 * s, 0.6 * s], [u, y + 0.2 * s, 0.28 * s, 0.35 * s]],
  // a tree-like crown of round masses on a trunk
  tree: (u, y, s) => [[u, y + 0.35 * s, 0.12 * s, 0.4 * s], [u, y + 0.85 * s, 0.38 * s, 0.3 * s], [u - 0.3 * s, y + 0.7 * s, 0.28 * s, 0.24 * s], [u + 0.32 * s, y + 0.72 * s, 0.26 * s, 0.25 * s], [u + 0.05 * s, y + 1.1 * s, 0.25 * s, 0.22 * s]],
  // a beast lying down
  beast: (u, y, s) => [[u, y + 0.35 * s, 0.9 * s, 0.38 * s], [u + 0.85 * s, y + 0.55 * s, 0.32 * s, 0.3 * s], [u - 0.7 * s, y + 0.25 * s, 0.35 * s, 0.25 * s]],
};

/**
 * A ridge of glass (see the head of the file). Returns its geometry (indexed, normals, colours) and
 * a few things a builder places by: `at(u, s)` the foot point u m along the path, s m into the ridge;
 * `length`, `heightAt(u)`.
 *
 * @param o.path     [[x, z], …] the front foot (local); the face looks to the right of the way it runs
 * @param o.height   m at the crest (before the lobes); o.taper [a, b]: times a at the path's start, b at its end
 * @param o.depth    m from the front foot to the back foot
 * @param o.profile  a PROFILES name or its points
 * @param o.folds    { width (m between lobes), amp (m they belly out), lean (m along per m up), crest (0..1: the crest scalloped) }
 * @param o.silhouettes  [{ shape: SHAPES name, u, y, s } | [[u, y, rx, ry]…]]
 * @param o.H        the ground (x, z) → y; the foot sinks `sink` m under it
 * @param o.ends     m over which each end sinks into the sand
 * @param o.colours  { foot, mid, top, crest } overrides of GLASS
 * @param o.step     m between the ridge's sections (along), o.rows: points down the profile; o.depthVary: the depth's wander (0..1)
 */
export function glassRidge(o) {
  const { path, height, depth, H = () => 0, seed = 1, sink = 1.6, ends = Math.min(40, height * 1.2) } = o;
  const prof = typeof o.profile === 'string' ? PROFILES[o.profile] : o.profile ?? PROFILES.cliff;
  const folds = { width: 14, amp: 3, lean: 0.35, crest: 0.25, ...(o.folds ?? {}) };
  const col = { ...GLASS, ...(o.colours ?? {}) };
  const noise = createNoise2D(9100 + seed), rng = mulberry32(seed);
  const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const sil = (o.silhouettes ?? []).flatMap((s) => (Array.isArray(s) ? s : SHAPES[s.shape](s.u, s.y, s.s)));
  // (finer where it holds silhouettes: their soft edges want a few points across)
  const L = curve.getLength(), step = o.step ?? Math.max(1.5, Math.min(sil.length ? 2.5 : 5, folds.width / 5));
  const nu = Math.max(4, Math.ceil(L / step)), rows = o.rows ?? (sil.length ? 44 : 30);
  const pcurve = new THREE.CatmullRomCurve3(prof.map(([s, y]) => new THREE.Vector3(s, y, 0)), false, 'centripetal');
  // (by the curve's own parameter: the control points' spacing sets the rows'; a third value is a tone, the hollow under a curl darker)
  const pts = Array.from({ length: rows }, (_, j) => pcurve.getPoint(j / (rows - 1)));
  const toneAt = (j) => { const t = (j / (rows - 1)) * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(t)), f = t - i; return (prof[i][2] ?? 1) * (1 - f) + (prof[i + 1][2] ?? 1) * f; };
  // where on the profile the face is (it bellies with the lobes), and where the top and back (less)
  const crestS = pts.reduce((m, p) => (p.y > m.y ? p : m), pts[0]).x;
  // lobe phases wander: each lobe its own width; a second, finer set of streaks over the great bellies
  const phase = (u, y) => (u + folds.lean * y) / folds.width + 0.35 * noise(u * 0.013, 7.1);
  const fine = (u, y) => (u + folds.lean * 1.3 * y) / (folds.width * 0.37) + 0.5 * noise(u * 0.03, 2.7);
  const lobe = (t) => Math.pow(Math.max(0, 0.5 + 0.5 * Math.cos(2 * Math.PI * t)), 0.7);   // rounded bellies, creased between
  const heightAt = (u) => {
    const end = Math.min(smoothstep(0, ends, u), smoothstep(0, ends, L - u));
    const tp = o.taper ? o.taper[0] + (o.taper[1] - o.taper[0]) * (u / L) : 1;
    return height * tp * (1 + 0.16 * noise(u * 0.008, 3.3)) * (0.08 + 0.92 * end);
  };
  const pos = new Float32Array(nu * rows * 3 + 0), colr = new Float32Array(nu * rows * 3);
  const P = new THREE.Vector3(), T = new THREE.Vector3();
  const frames = [];
  for (let i = 0; i < nu; i++) {
    const t = i / (nu - 1);
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    const nx = T.z, nz = -T.x;   // into the ridge (to the right of the way the path runs)
    const u = t * L, h = heightAt(u), end = Math.min(1, h / (height * (o.taper ? Math.max(...o.taper) : 1))), d = depth * (0.35 + 0.65 * Math.sqrt(Math.min(1, end * 1.1))) * (1 + (o.depthVary ?? 0) * noise(u * 0.02, 5.5));
    const g = Math.min(H(P.x, P.z), H(P.x + nx * d, P.z + nz * d));   // (a ramp of sand at its foot covers its lower face)
    frames.push({ x: P.x, z: P.z, nx, nz, h, d, g });
    for (let j = 0; j < rows; j++) {
      const p = pts[j], y0 = p.y * h;
      // the lobes belly out on the face (most at mid height), less over the top, a little on the back
      const onFace = p.x <= crestS ? 1 : 0.35;
      const ph = phase(u, y0), b = lobe(ph), bf = lobe(fine(u, y0));
      const belly = folds.amp * (b - 0.5 + 0.3 * (bf - 0.5)) * onFace * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, p.y))));
      // the crest scalloped: each lobe's top a rounded bump
      const scallop = 1 - folds.crest * (1 - b) * smoothstep(0.6, 1, p.y);
      const y = g + p.y * h * (p.y > 0 ? scallop : 1) - sink * (1 - smoothstep(-0.05, 0.06, p.y));
      const s = p.x * d - belly;
      const k = (i * rows + j) * 3;
      pos[k] = P.x + nx * s; pos[k + 1] = y; pos[k + 2] = P.z + nz * s;
      // colour: the foot's lime up to the mid's mint and the top's teal; a crest catches the light
      const hy = Math.max(0, p.y);
      _a.set(col.foot).lerp(_b.set(col.mid), smoothstep(0.0, 0.45, hy));
      _a.lerp(_b.set(col.top), smoothstep(0.45, 0.95, hy) * 0.85);
      if (p.x > crestS * 0.6 && p.x < crestS * 1.6 + 0.05) _a.lerp(_b.set(col.crest), 0.3 * smoothstep(0.85, 1, hy));
      // the lobes' creases a touch deeper, their bellies a touch lighter (the frozen waves' streaks)
      _a.multiplyScalar((0.92 + 0.08 * b + 0.06 * bf) * toneAt(j));
      // what the glass holds: dark soft masses
      const inside = sil.length ? silhouetteAt(sil, u, y0, o.soft ?? Math.max(1.0, height * 0.025)) : 0;
      if (inside > 0) _a.multiply(_c.setRGB(1 - (1 - col.inside[0]) * inside, 1 - (1 - col.inside[1]) * inside, 1 - (1 - col.inside[2]) * inside));
      colr[k] = _a.r; colr[k + 1] = _a.g; colr[k + 2] = _a.b;
    }
  }
  void rng;
  const idx = [];
  for (let i = 0; i < nu - 1; i++) for (let j = 0; j < rows - 1; j++) {
    const a = i * rows + j, b = a + rows;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  geo.setIndex(idx);
  // (which way round: the face looks out of the ridge; flip the winding if it came out inward)
  geo.computeVertexNormals();
  const f0 = frames[Math.floor(nu / 2)], nrm = geo.attributes.normal, k0 = Math.floor(nu / 2) * rows + Math.floor(rows * 0.3);
  if (nrm.getX(k0) * f0.nx + nrm.getZ(k0) * f0.nz > 0) {
    for (let q = 0; q < idx.length; q += 3) { const t = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t; }
    geo.setIndex(idx); geo.computeVertexNormals();
  }
  geo.computeBoundingSphere();
  const at = (u, s = 0) => {
    const f = frames[Math.max(0, Math.min(nu - 1, Math.round((u / L) * (nu - 1))))];
    return { x: f.x + f.nx * s, z: f.z + f.nz * s, y: f.g, nx: f.nx, nz: f.nz, h: f.h, d: f.d, yaw: Math.atan2(-f.nx, -f.nz) };
  };
  return { geo, length: L, heightAt, at, frames };
}

/**
 * Build without feeding the sand drifts (sand-drifts.js): a ridge's footprint is one convex hull, and a
 * long curved ridge's would bank sand over the whole valley it bends round. (Its own ramps are the ground's.)
 */
export function withoutDrifts(fn) {
  const open = SandDrifts.current;
  SandDrifts.current = null;
  try { return fn(); } finally { SandDrifts.current = open; }
}

/** A geometry painted one colour (for the glass's vertex-coloured material). */
export function painted(geo, color) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(color);
  for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/**
 * An archway in a ridge's foot at (x, z), its opening facing `yaw` (the way out): a rim of glass round a
 * round-headed opening, its inside lit green from beyond (self-lit), a dark ring just inside the rim.
 * M: { glass (vertex-coloured), light (self-lit), dark }.
 */
export function glassArch(kit, M, { x, z, yaw = 0, w = 6, h = 8, y = null }) {
  const y0 = y ?? kit.H(x, z) - 0.3, r = w / 2, nd = { solid: false, shadow: false };
  const sh = new THREE.Shape();
  sh.moveTo(-r, 0); sh.lineTo(-r, h - r); sh.absarc(0, h - r, r, Math.PI, 0, true); sh.lineTo(r, 0); sh.lineTo(-r, 0);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const place = (g, off) => g.rotateY(yaw).translate(x + s * off, y0, z + c * off);
  kit.add(M.light, place(new THREE.ShapeGeometry(sh, 12), -0.6), nd);
  const inner = new THREE.Shape(); const ri = r * 1.12;
  inner.moveTo(-ri, 0); inner.lineTo(-ri, h - r); inner.absarc(0, h - r, ri, Math.PI, 0, true); inner.lineTo(ri, 0); inner.lineTo(-ri, 0);
  kit.add(M.dark, place(new THREE.ShapeGeometry(inner, 12), -0.75), nd);
  // the rim: a thick glass band round the opening
  const rim = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI - (i / 16) * Math.PI; rim.push(new THREE.Vector3(Math.cos(a) * r * 1.2, h - r + Math.sin(a) * r * 1.2, 0)); }
  rim.unshift(new THREE.Vector3(-r * 1.2, -0.5, 0)); rim.push(new THREE.Vector3(r * 1.2, -0.5, 0));
  kit.add(M.glass, place(painted(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim), 36, r * 0.22, 8, false), GLASS.mid), 0), { solid: false });
}

/**
 * The glassworkers' camp: a row of awnings on poles along local +x (turned by yaw) at (x, z), w long,
 * d deep; crates, rugs, glass floats on stands, a kiln with its chimney. M: { pole, cloth: [..], rug: [..],
 * crate, float (self-lit green), kiln, dark }. Returns where its people may stand ([x, z] local).
 */
export function awningCamp(kit, M, rng, { x, z, yaw = 0, w = 16, d = 6, n = 4, h = 3.2 }) {
  const c = Math.cos(yaw), s = Math.sin(yaw), nd = { solid: false, shadow: true };
  const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const at = (lx, lz) => { const [px, pz] = W(lx, lz); return [px, kit.H(px, pz), pz]; };
  const spots = [];
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + (i + 0.5) * (w / n), aw = (w / n) * (0.9 + rng() * 0.25), ad = d * (0.8 + rng() * 0.3), ah = h * (0.85 + rng() * 0.3);
    const cloth = M.cloth[Math.floor(rng() * M.cloth.length)];
    // four corner poles
    const corners = [[-aw / 2, -ad / 2, ah * 0.5], [aw / 2, -ad / 2, ah * 0.5], [-aw / 2, ad / 2, ah * 0.5], [aw / 2, ad / 2, ah * 0.5]];
    for (const [px, pz, ph] of corners) { const [X, Y, Z] = at(cx + px, pz); kit.add(M.pole, new THREE.CylinderGeometry(0.05, 0.06, ph + 0.6, 5).translate(X, Y + (ph + 0.6) / 2 - 0.3, Z), nd); }
    // the cloth: a peaked sheet from the ridge pole's top down to the four corners, sagging between them
    const g = new THREE.PlaneGeometry(aw * 1.12, ad * 1.12, 10, 8).rotateX(-Math.PI / 2), p = g.attributes.position, base = at(cx, 0)[1];
    const eave = ah * 0.62, peak = ah;
    for (let k = 0; k < p.count; k++) {
      const lx = p.getX(k), lz = p.getZ(k), tx = lx / (aw * 0.56), tz = lz / (ad * 0.56), m = Math.max(Math.abs(tx), Math.abs(tz));
      const sag = 0.3 * Math.sin(Math.PI * Math.min(1, m)) * (1 - Math.abs(Math.abs(tx) - Math.abs(tz)));
      const [X, Z] = W(cx + lx, lz);
      p.setXYZ(k, X, base + eave + (peak - eave) * (1 - m) - sag - (m > 0.92 ? (m - 0.92) * 2.5 : 0), Z);
    }
    g.computeVertexNormals();
    kit.add(cloth, g, nd);
    // the ridge pole under the peak, now and then a pennant pole through it
    { const [X, Y, Z] = at(cx, 0), ph = rng() < 0.4 ? peak + 1.4 : peak; kit.add(M.pole, new THREE.CylinderGeometry(0.035, 0.045, ph, 5).translate(X, Y + ph / 2, Z), nd); }
    // under it: a rug, a crate or two, a float on its stand, a stool
    const rug = M.rug[Math.floor(rng() * M.rug.length)];
    { const [X, Y, Z] = at(cx, 0); kit.add(rug, new THREE.BoxGeometry(aw * 0.7, 0.04, ad * 0.6).rotateY(yaw + (rng() - 0.5) * 0.2).translate(X, Y + 0.03, Z), { solid: false, shadow: false }); }
    for (let k = 0; k < 1 + Math.floor(rng() * 3); k++) {
      const [X, Y, Z] = at(cx + (rng() - 0.5) * aw * 0.8, -ad * 0.3 + rng() * ad * 0.2), sz = 0.4 + rng() * 0.4;
      kit.add(M.crate, new THREE.BoxGeometry(sz * 1.3, sz, sz).rotateY(yaw + rng()).translate(X, Y + sz / 2, Z));
    }
    for (let k = 0; k < 2; k++) {
      const [X, Y, Z] = at(cx + (rng() - 0.5) * aw * 0.8, ad * (0.2 + rng() * 0.4)), r = 0.16 + rng() * 0.16;
      kit.add(M.float, new THREE.SphereGeometry(r, 12, 9).scale(1, 0.9 + rng() * 0.5, 1).translate(X, Y + r * 0.8, Z), { solid: false, shadow: false });
    }
    spots.push(W(cx, ad * 0.15));
  }
  // the kiln at one end: a squat dome of sand-brick, its mouth glowing, a chimney
  { const [X, Y, Z] = at(w / 2 + 2.5, 0);
    kit.add(M.kiln, new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.1, 1).translate(X, Y - 0.1, Z));
    kit.add(M.kiln, new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8).translate(X + 0.5, Y + 2.1, Z - 0.3));
    const [mx, mz] = W(w / 2 + 2.5, 1.45);
    kit.add(M.float, put2(new THREE.CircleGeometry(0.45, 12), mx, Y + 0.45, mz, yaw), { solid: false, shadow: false });
    kit.light?.(mx, Y + 0.8, mz, 7); }
  return spots;
}
const put2 = (g, x, y, z, yaw) => g.rotateY(yaw).translate(x, y, z);

/** Dark wind-polished stones half sunk in the sand: n of them round (x, z) within r, sizes s0..s1. */
export function boulders(kit, mat, rng, { x, z, r, n, s0 = 0.4, s1 = 2.2, flatness = 0.45 }) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    const s = s0 + (s1 - s0) * rng() ** 2;
    const g = new THREE.DodecahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const f = 0.8 + 0.4 * Math.abs(Math.sin(p.getX(k) * 3.1 + p.getZ(k) * 2.3 + i)); p.setXYZ(k, p.getX(k) * f, p.getY(k) * f, p.getZ(k) * f); }
    g.scale(s * (1 + rng() * 0.8), s * flatness, s).rotateY(rng() * 6.3).translate(px, kit.H(px, pz) - s * flatness * 0.25, pz);
    g.computeVertexNormals();
    kit.add(mat, g, { solid: s > 0.8, shadow: true });
  }
}
