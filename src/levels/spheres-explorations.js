import * as THREE from 'three';
import { createNoise2D, mulberry32, smoothstep } from '../noise.js';
import { crescentSphere, paintTris } from './garden-kit.js';

// ---------------------------------------------------------------------------
// The Garden of Spheres' explorations (issue #190; the author's three picks of #170, the sheets in
// references/levels/The Garden of Spheres/environment/explorations/, docs/systems/worlds.md "The Garden's
// explorations"), woven into one way from the lake to the plaza rather than three places:
//
//   what the lake remembers  a causeway of white stepping stones across the mirror lake from the south shore, and in
//                            the water a garden that is not on the shore: a white town, domes, a great step pyramid
//                            (drawn only in the reflection); once a sphere's sound has been played at the lake (the
//                            pearl's bell), the spheres hang in the reflected sky again round the middle stone
//   where the moons fell     every great sphere lies at the end of the furrow it ploughed, the furrows all pointing
//                            back to the great sphere on the horizon (seen from the belvedere); two lie in craters of
//                            ringed terraces, bowls that carry sound: the sphere west of the arch (its memory louder
//                            the lower you go), and past the lake's far shore the moon that cracked open on landing,
//                            a hollow room inside it, its last sound humming within, the founders' mark on its shell
//   the pillar forest        out of that crater, a spiral stair up the first of six tall white pillars, spheres in
//                            cups on their tops, narrow walkways from top to top along the cracked moon's furrow
//                            toward the plaza, and down the last one's stair; splash a high sphere and its note runs
//                            down the walkways to the lower ones (src/story/spheres-explorations.js)
//
// The ground's part (furrows and craters) is cut before the terrain is made (fallsGround); the rest is built by
// buildExplorations with the world's own batching kit (src/levels/spheres.js).
// ---------------------------------------------------------------------------

const lerp = THREE.MathUtils.lerp;
const noise = createNoise2D(1907);

/** Where the moons fell from: the great sphere setting on the horizon (src/levels/spheres.js). */
export const GREAT = { x: 0, z: -1320 };
/** The way from (x, z) back to where they fell from, a unit [dx, dz]. */
export const toGreat = (x, z) => { const dx = GREAT.x - x, dz = GREAT.z - z, l = Math.hypot(dx, dz); return [dx / l, dz / l]; };

/**
 * The craters with their ringed terraces (bowls that carry sound): [floor, first terrace, second terrace, rim] radii, each
 * terrace `drop` m under the one outside it; the rim level with the meadow round it. `stairs`: the azimuths of the
 * flights down (x = cos a, z = sin a).
 */
export const CRATERS = {
  // the cracked moon, past the lake's far shore: in from the causeway (north-east), out toward the first pillar
  cracked: { x: 100, z: -272, rings: [22, 29, 36, 50], drop: 2.5, R: 13, sink: 0.2 },
  // the sphere west of the arch (the far voices), its stair toward the arch
  chant: { x: -120, z: -262, rings: [26, 33, 40, 54], drop: 2.5, R: 18, sink: 0.25 },
};
/** The cracked moon's crack faces the way in from the causeway's landing. */
export const LANDING = [157, -181];
CRATERS.cracked.face = Math.atan2(LANDING[1] - CRATERS.cracked.z, LANDING[0] - CRATERS.cracked.x);

/** The six pillars of the forest: on the cracked moon's furrow's west bank, 44 m apart, toward the plaza. */
const FD = toGreat(CRATERS.cracked.x, CRATERS.cracked.z), WEST = [FD[1], -FD[0]];   // (west of the furrow: its left)
const pillarAt = (s) => [CRATERS.cracked.x + FD[0] * s + WEST[0] * 22, CRATERS.cracked.z + FD[1] * s + WEST[1] * 22];
/** { x, z, h (over its foot), R (its sphere), deg (its note: a degree of the garden's scale), plat (its top's radius) } */
export const PILLARS = [
  [60, 34, 3.0, 7], [104, 42, 3.4, 4], [148, 52, 4.2, 0], [192, 46, 3.6, 2], [236, 38, 3.2, 5], [280, 30, 2.8, 9],
].map(([s, h, R, deg], i) => { const [x, z] = pillarAt(s); return { i, x, z, h, R, deg, plat: R > 4 ? 9 : 8.2 }; });
FD.west = WEST;
CRATERS.cracked.stairs = [CRATERS.cracked.face, Math.atan2(PILLARS[0].z - CRATERS.cracked.z, PILLARS[0].x - CRATERS.cracked.x)];
CRATERS.chant.stairs = [Math.atan2(-262 - CRATERS.chant.z, 0 - CRATERS.chant.x)];
/** The spiral stairs round the first pillar (up) and the last (down): their radius, width and grade. */
export const SPIRAL = { r: 9.4, w: 2.2, grade: 0.5 };

/**
 * The fallen spheres and their furrows, [x, z, R, length]: the long scars they ploughed when they came down, from each
 * back toward the great sphere (src/levels/spheres.js places the spheres; these are where they stand).
 */
export const FURROWS = [
  [CRATERS.cracked.x, CRATERS.cracked.z, 13, 320], [CRATERS.chant.x, CRATERS.chant.z, 18, 210], [380, -320, 36, 240],
  [-310, -260, 46, 110], [-330, 80, 30, 170], [250, 60, 22, 150], [300, -450, 15, 120], [450, -440, 24, 150],
].map(([x, z, R, len]) => { const [dx, dz] = toGreat(x, z); return { x, z, R, len, dx, dz, half: Math.max(10, R * 0.9), depth: Math.min(4, 1.8 + R * 0.06) }; });

/** A furrow's cut at (x, z): how far the ground is lowered there (negative), or raised on its banks. */
function furrowAt(f, x, z) {
  const px = x - f.x, pz = z - f.z, s = px * f.dx + pz * f.dz, u = Math.abs(px * f.dz - pz * f.dx) / f.half;
  if (s < 0 || s > f.len + 40 || u > 2.2) return 0;
  // (starting past the sphere's own footing, so it sits as it always sat: src/levels/spheres.js sphere, baseAt)
  const along = smoothstep(f.R * 0.75, f.R * 1.5, s) * smoothstep(f.len + 40, f.len - 20, s) * (1 - 0.45 * s / f.len);
  return along * f.depth * (-smoothstep(1.05, 0.5, u) + 0.32 * Math.exp(-(((u - 1.35) / 0.32) ** 2)));
}
/** Every furrow's cut together, for the world's height (before it is levelled for the paths, the lake and the hill). */
export const furrowsAt = (x, z) => { let h = 0; for (const f of FURROWS) h += furrowAt(f, x, z); return h; };

/**
 * The craters cut into the ground (src/levels/spheres.js height): inside, the terrain far under the terraces (the
 * meshes are the ground there); round the rim, level a little under it; then eased back into the meadow. `base`: the
 * ground as it would be. The rim's level is the ground round it (its 80th percentile, so little of it stands over).
 */
export function fallsGround(base) {
  const levels = {};
  for (const [id, C] of Object.entries(CRATERS)) {
    const rr = C.rings[3], hs = [];
    for (let k = 0; k < 48; k++) for (const r of [rr + 10, rr + 16, rr + 22]) { const a = (k / 48) * Math.PI * 2; hs.push(base(C.x + Math.cos(a) * r, C.z + Math.sin(a) * r)); }
    hs.sort((a, b) => a - b);
    levels[id] = hs[Math.floor(hs.length * 0.8)];
  }
  const height = (x, z) => {
    let h = base(x, z);
    for (const [id, C] of Object.entries(CRATERS)) {
      const r = Math.hypot(x - C.x, z - C.z), rr = C.rings[3];
      if (r > rr + 22) continue;
      const y0 = levels[id];
      if (r < rr - 1) h = y0 - C.drop * 4;
      else h = lerp(y0 - 0.45, Math.min(h, y0 - 0.2), smoothstep(rr + 8, rr + 22, r));
    }
    return h;
  };
  return { height, levels };
}
/** In a crater (its rim and skirt within `pad` m more): what the meadow's scatter keeps out of. */
export const inCrater = (x, z, pad = 0) => Object.values(CRATERS).some((C) => Math.hypot(x - C.x, z - C.z) < C.rings[3] + 13 + pad);

/** The causeway's stepping stones across the lake, south shore to far shore: { x, z, r, top }. */
export function causewayStones(W) {
  const A = [175, -63], B = [LANDING[0], LANDING[1] + 4], n = 24, out = [];   // (the first on the south shore's edge)
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), mid = i === 12;
    // (each just touching the next: a gap is a step into the water, and the lake puts you back on the shore)
    out.push({ i, x: lerp(A[0], B[0], t) + 5 * Math.sin(t * Math.PI), z: lerp(A[1], B[1], t), r: 0, top: W + 0.75 + (mid ? 0.05 : 0.05 * Math.sin(i * 1.9)), mid });
  }
  // (each half the way to the farther of its two neighbours and a little over, so they overlap a hand's width)
  const d = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.z - b.z) : 0);
  for (const q of out) q.r = q.mid ? 3.4 : Math.max(d(q, out[q.i - 1]), d(q, out[q.i + 1])) / 2 + 0.12 + 0.08 * Math.abs(Math.sin(q.i * 2.7));
  return out;
}

/** The pillars' tops: their feet on the ground `H`, and each top over it. */
export const pillarTop = (p, H) => H(p.x, p.z) - 0.5 + p.h;

// ------------------------------------------------------------------ geometry helpers
/** Turn a mesh's faces round (an open cylinder seen from inside). */
function inward(g) {
  const geo = g.index ? g.toNonIndexed() : g, p = geo.attributes.position;
  for (let i = 0; i < p.count; i += 3) for (let k = 0; k < 3; k++) { const a = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, a); }
  geo.deleteAttribute('normal'); geo.computeVertexNormals();
  return geo;
}
/** A box from a to b (centres of its top's two ends), w wide, `th` thick: a walkway's deck, a ramp's tread. */
function beam(a, b, w, th) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dz), len = Math.hypot(L, dy);
  return new THREE.BoxGeometry(w, th, len).translate(0, -th / 2, 0).rotateX(-Math.atan2(dy, L)).rotateY(Math.atan2(dx, dz))
    .translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
/** A crescent's outline: the part of a disc of radius R left lit by a second disc `off` over toward +x. */
function crescentShape(R, off) {
  const s = new THREE.Shape(), y = Math.sqrt(Math.max(0, R * R - (off * off) / 4)), a = Math.atan2(y, off / 2), n = 28;
  for (let i = 0; i <= n; i++) { const t = a + (i / n) * (Math.PI * 2 - 2 * a); (i ? s.lineTo : s.moveTo).call(s, R * Math.cos(t), R * Math.sin(t)); }
  for (let i = 1; i < n; i++) { const t = Math.PI + a - (i / n) * 2 * a; s.lineTo(off + R * Math.cos(t), R * Math.sin(t)); }
  return s;
}

/**
 * Build the three explorations into the world. `k`: the world's kit (src/levels/spheres.js): { add, proxy,
 * sphere, path, M, H, terrain, reflect, orbs, W, levels (the craters' rims, fallsGround), grass (the ground's look),
 * makeMaterial, CRESCENT, keep }. Returns the handles the story and the audit use.
 */
export function buildExplorations(k) {
  const { add, proxy, M, H, W } = k;
  const rng = mulberry32(19070);
  const out = { craters: {}, pillars: [], walkways: [], stones: [], lines: [], sights: [], beacons: [] };
  const stone = k.makeMaterial({ color: '#f1ece0', plates: 1.6, ...k.WHITE_SHADE });

  // ================================================================ the craters: ringed terraces, stairs down
  for (const [id, C] of Object.entries(CRATERS)) {
    const y0 = k.levels[id], [rf, r1, r2, rr] = C.rings, d = C.drop, lv = [y0 - 3 * d, y0 - 2 * d, y0 - d, y0];
    const seg = 72;
    // the floor and the two terraces (the ground's own look), the rim and its skirt down into the meadow
    add(k.grass, new THREE.CircleGeometry(rf + 0.4, seg).rotateX(-Math.PI / 2).translate(C.x, lv[0], C.z), true);
    add(k.grass, new THREE.RingGeometry(rf, r1 + 0.4, seg, 1).rotateX(-Math.PI / 2).translate(C.x, lv[1], C.z), true);
    add(k.grass, new THREE.RingGeometry(r1, r2 + 0.4, seg, 1).rotateX(-Math.PI / 2).translate(C.x, lv[2], C.z), true);
    add(k.grass, new THREE.RingGeometry(r2, rr + 10, seg, 1).rotateX(-Math.PI / 2).translate(C.x, lv[3], C.z), true);
    add(k.grass, inward(new THREE.CylinderGeometry(rr + 10, rr + 12.5, 0.9, seg, 1, true).translate(C.x, lv[3] - 0.45, C.z)), true);
    // the walls between them: white stone in courses, as the sheets' (seen from inside)
    for (const [r, lo, hi] of [[rf, lv[0], lv[1]], [r1, lv[1], lv[2]], [r2, lv[2], lv[3]]]) {
      const wall = inward(new THREE.CylinderGeometry(r, r, hi - lo + 0.5, seg, 1, true).translate(C.x, (hi + lo) / 2 - 0.25, C.z));
      add(stone, wall); proxy(wall.clone());
    }
    // the flights down, one per wall on each stair's line: white steps, each solid as drawn (a step 0.36 m, under the
    // traveller's stride)
    for (const a of C.stairs) {
      const ca = Math.cos(a), sa = Math.sin(a), n = Math.ceil(d / 0.4), h = d / n, tread = 0.5;
      for (const [r, lo] of [[rf, lv[0]], [r1, lv[1]], [r2, lv[2]]]) {
        for (let i = 0; i < n; i++) {
          const rr0 = r - (n - i) * tread, hy = (i + 1) * h + 0.3;
          const g = new THREE.BoxGeometry(4, hy, tread + 0.02).translate(0, hy / 2 - 0.3, 0).rotateY(Math.atan2(ca, sa)).translate(C.x + ca * (rr0 + tread / 2), lo, C.z + sa * (rr0 + tread / 2));
          add(M.white, g); proxy(g.clone());
        }
      }
    }
    out.craters[id] = { ...C, y0, levels: lv };
  }

  // ---------------------------------------------------------------- the cracked moon in its crater
  {
    const C = out.craters.cracked, R = C.R, floor = C.levels[0], cy = floor + C.sink * R, face = C.face;
    const lit = '#f6efd0', shade = '#a9c9c4', t = 0.7;
    // the crack: a tall jagged doorway on the side facing the way in, widest at the floor, closing toward the crown
    const inCrack = (c) => {
      const u = c.clone().normalize(), az = Math.atan2(u.z, u.x), off = Math.abs(Math.atan2(Math.sin(az - face), Math.cos(az - face)));
      const h = u.y, w = 0.34 * Math.pow(Math.max(0, 1 - (h + 0.25) / 1.12), 0.8) + 0.05 * Math.sin(h * 23) + 0.035 * Math.sin(h * 41 + 1.3);
      return h < 0.86 && off < Math.max(0, w);
    };
    const shell = (r, side) => {
      const g = new THREE.SphereGeometry(r, 48, 32).toNonIndexed(), p = g.attributes.position, keep = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
        const m = a.clone().add(b).add(c).divideScalar(3);
        if (!inCrack(m) && m.y > -C.sink * r - 0.6) keep.push(i);
      }
      const pos = new Float32Array(keep.length * 9);
      keep.forEach((i, j) => { for (let q = 0; q < 9; q++) pos[j * 9 + q] = p.array[i * 3 + q]; });
      const o = new THREE.BufferGeometry();
      o.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      o.computeVertexNormals();
      return side < 0 ? inward(o) : o;
    };
    const L = k.CRESCENT;
    const outer = paintTris(shell(R, 1), (cen) => (cen.clone().normalize().dot(L) > 0 ? lit : shade)).translate(C.x, cy, C.z);
    add(M.cream, outer); proxy(outer.clone());
    const inner = shell(R - t, -1).translate(C.x, cy, C.z);
    add(k.shellInside, inner); proxy(inner.clone());
    // the crack's broken edges: the shell's thickness, a jagged band of pale stone round the doorway
    {
      const edge = [], steps = 60;
      for (const s of [-1, 1]) {
        let prev = null;
        for (let i = 0; i <= steps; i++) {
          const h = -C.sink - 0.02 + (i / steps) * (0.86 + C.sink);
          // find the crack's edge at this height
          let w = 0;
          for (let q = 0; q < 40; q++) { const tt = (q / 40) * 0.6, v = new THREE.Vector3(Math.cos(face + s * tt) * Math.sqrt(1 - h * h), h, Math.sin(face + s * tt) * Math.sqrt(1 - h * h)); if (inCrack(v)) w = tt; }
          if (w <= 0) { prev = null; continue; }
          const az = face + s * (w + 0.012), ch = Math.sqrt(Math.max(0, 1 - h * h));
          const pt = new THREE.Vector3(Math.cos(az) * ch, h, Math.sin(az) * ch);
          if (prev) {
            const a0 = prev.clone().multiplyScalar(R + 0.05), a1 = pt.clone().multiplyScalar(R + 0.05), b0 = prev.clone().multiplyScalar(R - t - 0.05), b1 = pt.clone().multiplyScalar(R - t - 0.05);
            edge.push(...a0.toArray(), ...b0.toArray(), ...a1.toArray(), ...a1.toArray(), ...b0.toArray(), ...b1.toArray());
          }
          prev = pt;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
      g.computeVertexNormals();
      const m = k.makeMaterial({ color: '#efe6c8', flat: true });
      m.side = THREE.DoubleSide;
      // (the shell's broken thickness, between the two shells that collide: drawn only)
      const band = new THREE.Mesh(g.translate(C.x, cy, C.z), m);
      band.name = 'The cracked moon’s broken edge';
      band.userData.noCollide = true;
      k.scene.add(band);
    }
    // the founders' mark: a crescent cast into the inner shell, opposite the crack, at a person's eye and over
    const back = face + Math.PI, markY = floor + 4.6, mr = R - t - 0.06, el = Math.asin((markY - cy) / mr);
    const markAt = new THREE.Vector3(C.x + Math.cos(back) * mr * Math.cos(el), markY, C.z + Math.sin(back) * mr * Math.cos(el));
    {
      const g = new THREE.ShapeGeometry(crescentShape(2.3, 1.7), 2).toNonIndexed();
      g.rotateZ(Math.PI * 0.65);
      const dot = new THREE.CircleGeometry(0.4, 12).translate(2.3, 1.4, 0).toNonIndexed();
      const mark = new THREE.BufferGeometry();
      const pa = g.attributes.position.array, pb = dot.attributes.position.array, all = new Float32Array(pa.length + pb.length);
      all.set(pa); all.set(pb, pa.length);
      mark.setAttribute('position', new THREE.BufferAttribute(all, 3));
      mark.computeVertexNormals();
      // (facing into the room, toward the crack)
      mark.lookAt(new THREE.Vector3(-Math.cos(back), 0, -Math.sin(back)));
      add(k.makeMaterial({ color: '#d8c48e', flat: true, glow: 0.5 }), mark.translate(markAt.x, markAt.y, markAt.z));
    }
    k.orbs.push({ x: C.x, z: C.z, R, y: cy, yellow: false, cracked: true });
    const stand = new THREE.Vector3(C.x + Math.cos(back) * (R - 3.2), floor, C.z + Math.sin(back) * (R - 3.2));
    out.cracked = { x: C.x, z: C.z, y: cy, R, floor, face, mark: { at: markAt, stand, look: markAt.clone() }, inside: (p) => Math.hypot(p.x - C.x, p.z - C.z) < R - t - 1.2 && p.y < floor + 6 && p.y > floor - 1 };
  }

  // ================================================================ the furrows' cypresses (the sheets' rows along them)
  {
    const items = [];
    for (const f of FURROWS) {
      // (every 24 m or so, a few left out: each collides as drawn, ~120 faces, the collision budget)
      for (let s = f.R + 18; s < f.len; s += 24) for (const side of [-1, 1]) {
        if (rng() < 0.3) continue;
        const off = f.half * (1.55 + rng() * 0.3) * side, x = f.x + f.dx * s + f.dz * off, z = f.z + f.dz * s - f.dx * off;
        if (!k.keep(x, z, 4)) continue;
        items.push([x, z, 1 + rng() * 0.5]);
      }
    }
    out.cypresses = items;
    // and the furrows drawn: the bed a deeper green, a dark line along each bank (the sheets' long strips, all running
    // to the great sphere), laid on the ground; left out in the craters, the lake and on the paths
    const bed = k.makeMaterial({ color: '#bdc357', flat: true }), bank = k.makeMaterial({ color: '#8ea24c', flat: true }), strips = { bed: [], bank: [] };
    const strip = (f, off, w, kind) => {
      const pos = [], step = 3, cols = Math.max(1, Math.ceil(w / 4));
      // (a quad every 3 m along and 4 m across, laid on the ground at its corners: it follows the trench's curve)
      const at = (s, u) => { const o = off + (u - 0.5) * w, x = f.x + f.dx * s + f.dz * o, z = f.z + f.dz * s - f.dx * o; return [x, H(x, z) + 0.12, z]; };
      for (let s = f.R * 1.6; s < f.len - step; s += step) {
        const cx = f.x + f.dx * (s + step / 2) + f.dz * off, cz = f.z + f.dz * (s + step / 2) - f.dx * off;
        if (!k.open(cx, cz)) continue;
        for (let j = 0; j < cols; j++) {
          const a = at(s, j / cols), b = at(s, (j + 1) / cols), c = at(s + step, j / cols), d = at(s + step, (j + 1) / cols);
          pos.push(...a, ...c, ...b, ...b, ...c, ...d);
        }
      }
      if (!pos.length) return;
      strips[kind].push(...pos);
    };
    for (const f of FURROWS) { strip(f, 0, f.half * 0.9, 'bed'); for (const side of [-1, 1]) strip(f, side * f.half * 1.02, 1.1, 'bank'); }
    // (paint on the ground, as the paths are: drawn only, a mesh of their own so the contact audit can leave them out)
    for (const [kind, mat] of [['bed', bed], ['bank', bank]]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(strips[kind], 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.name = kind === 'bed' ? 'The furrows’ beds' : 'The furrows’ banks';
      m.userData.noCollide = true; m.userData.flora = true;   // (walked over as the grass is: src/contact-audit.js)
      k.scene.add(m);
    }
  }

  // ================================================================ the lake: the causeway, and what the water remembers
  {
    /** Positions only, merged (with upward normals for the shapes lying on the water). */
    const join = (list, up = true) => { const m = new THREE.BufferGeometry(), arrs = list.map((g) => (g.index ? g.toNonIndexed() : g).attributes.position.array), n = arrs.reduce((s, a) => s + a.length, 0), pos = new Float32Array(n); let o = 0; for (const a of arrs) { pos.set(a, o); o += a.length; } m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); if (up) { const nr = new Float32Array(n); for (let i = 1; i < n; i += 3) nr[i] = 1; m.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); } return m; };
    const stones = causewayStones(W);
    for (const s of stones) {
      const g = new THREE.CylinderGeometry(s.r, s.r * 1.04, s.top - (W - 3.6), 20, 1).translate(s.x, (s.top + W - 3.6) / 2, s.z);
      add(M.white, g); proxy(g.clone());
    }
    out.stones = stones;
    // the garden before the fall, drawn only in the water: a white town on the far shore, domes, towers and a great
    // stepped pyramid behind the shore that is there, the lines of a road along the water (reflect: src/levels/spheres.js)
    const town = [];
    const mergeTwo = (...gs) => join(gs, false);
    const domeAt = (x, z, r, drum = 0) => {
      const b = H(x, z) - 0.3, dome = new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, b + drum, z);
      town.push(drum ? mergeTwo(new THREE.CylinderGeometry(r, r, drum, 20, 1).translate(x, b + drum / 2, z), dome) : dome);
    };
    const block = (x, z, w, h, dd) => { const g = new THREE.BoxGeometry(w, h, dd).translate(x, H(x, z) - 0.3 + h / 2, z); g.userData.shore = true; town.push(g); };
    const tower = (x, z, r, h) => { const b = H(x, z) - 0.3; town.push(mergeTwo(new THREE.CylinderGeometry(r * 0.8, r, h, 10, 1).translate(x, b + h / 2, z), new THREE.ConeGeometry(r * 1.3, r * 2.4, 10).translate(x, b + h + r * 1.2, z))); };
    // the great stepped pyramid (the sheet's), its temple on top
    // (on the shore itself, where the shore that is there is only grass: between the far shore's pyramid, temple and
    // sphere and round both ends of the water; low, for tall things reflect right up to your feet)
    const Lk = k.lake, shoreAt = (deg, e = 1.2) => { const a = (deg * Math.PI) / 180; return [Lk.x + Math.cos(a) * Lk.rx * e, Lk.z + Math.sin(a) * Lk.rz * e]; };
    const pyramid = (x, z, half, tiers, th) => { const b = H(x, z) - 0.5, list = []; for (let i = 0; i < tiers; i++) { const hw = half - (i * (half - 2)) / tiers; list.push(new THREE.BoxGeometry(hw * 2, th, hw * 2).translate(x, b + th / 2 + i * th, z)); } town.push(mergeTwo(...list)); };
    // the west end: a domed hall with its towers, a little pyramid
    { const [x, z] = shoreAt(203, 1.22); domeAt(x, z, 7, 3); tower(x + 7, z - 6, 1.3, 13); tower(x - 6, z + 5, 1.1, 10); block(x + 2, z + 8, 9, 4, 6); }
    { const [x, z] = shoreAt(214, 1.24); pyramid(x, z, 8, 5, 2.2); }
    // between the pyramid and the temple: a gate and a dome
    { const [x, z] = shoreAt(252, 1.16); domeAt(x, z, 5, 2); tower(x + 4, z + 2, 1.0, 11); }
    // between the temple and the sphere: a row of little domes on the water's edge
    { for (const [deg, r] of [[300, 3.6], [305, 4.4], [309, 3.2]]) { const [x, z] = shoreAt(deg, 1.14); domeAt(x, z, r, 1.2); } }
    // the east end: the great stepped pyramid of the sheet, smaller, its town round it
    { const [x, z] = shoreAt(334, 1.25); pyramid(x, z, 13, 7, 2.2); tower(x - 10, z + 8, 1.4, 15); domeAt(x + 9, z + 10, 5.5, 2.5); block(x - 4, z + 13, 12, 4, 6); }
    { const [x, z] = shoreAt(345, 1.22); domeAt(x, z, 6, 3); tower(x + 3, z - 7, 1.2, 12); }
    // (each piece its own layer of the reflection, so the ink draws one against another; the blocks along the shore
    // as one: about twenty layers more, laid far to near)
    const shore = [];
    for (const g of town) { const n = g.index ? g.toNonIndexed() : g; if (g.userData?.shore) shore.push(n); else k.reflect.push({ geo: n, key: 'memory' }); }
    if (shore.length) k.reflect.push({ geo: join(shore, false), key: 'memory' });
    // the spheres hanging in the reflected sky round the middle stone (shown once a sphere's sound has been played at
    // the lake: the story's): pale discs in the water, each with its lit crescent
    const mid = stones.find((s) => s.mid), discs = [], lits = [];
    for (const [dx, dz, r] of [[-10, -6, 2.6], [8, -15, 3.4], [-15, 9, 1.8], [10, 6, 2.2], [-12, -24, 4.2], [17, -4, 1.4], [-20, -12, 2.0], [14, 20, 2.8]]) {
      const x = mid.x + dx, z = mid.z + dz;
      if (stones.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r + 0.6)) continue;
      // (over every layer of the reflection, under the stones' tops)
      discs.push(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2).translate(x, W + 0.55, z));
      lits.push(new THREE.ShapeGeometry(crescentShape(r * 0.98, r * 0.55), 3).rotateX(-Math.PI / 2).rotateY(0.7).translate(x, W + 0.57, z));
    }
    const moons = new THREE.Group();
    moons.name = 'the lake’s moons';
    const shadeM = k.makeMaterial({ color: '#d9e6dc', color2: '#d2e2d8', mode: k.MODE_WATER, waterPrint: true }), litM = k.makeMaterial({ color: '#f3efd2', color2: '#eeead0', mode: k.MODE_WATER, waterPrint: true });
    moons.add(new THREE.Mesh(join(discs), shadeM), new THREE.Mesh(join(lits), litM));
    for (const m of moons.children) m.userData.noCollide = true;
    moons.visible = false;
    k.scene.add(moons);
    out.lake = { stones, mid, moons, look: { at: new THREE.Vector3(mid.x, mid.top, mid.z), stand: new THREE.Vector3(mid.x, mid.top, mid.z), look: new THREE.Vector3(mid.x - 6, W, mid.z - 14) } };
  }

  // ================================================================ the pillar forest: pillars, spheres high up, walkways
  {
    const tops = PILLARS.map((p) => pillarTop(p, H));
    const az = (a, b) => Math.atan2(b.z - a.z, b.x - a.x);
    PILLARS.forEach((p, i) => {
      const base = H(p.x, p.z) - 0.5, top = tops[i], rs = i === 0 || i === 5 ? 4.4 : 3.1, pr = p.plat;
      const shaft = new THREE.CylinderGeometry(rs, rs * 1.12, top - base - 5.5, 28, 1).translate(p.x, base + (top - base - 5.5) / 2, p.z);
      const capital = new THREE.CylinderGeometry(pr - 0.5, rs, 4.8, 28, 1).translate(p.x, top - 0.8 - 2.4, p.z);
      const deck = new THREE.CylinderGeometry(pr, pr, 0.8, 40, 1).translate(p.x, top - 0.4, p.z);
      const foot = new THREE.CylinderGeometry(rs * 1.5, rs * 1.7, 1.4, 28, 1).translate(p.x, base + 0.7, p.z);
      for (const g of [shaft, capital, deck, foot]) { add(M.pole, g); proxy(g.clone()); }
      // the sphere in its stone cup, to one side of the way across the top
      const prev = PILLARS[i - 1], next = PILLARS[i + 1];
      const along = next ? az(p, next) : az(prev, p), side = along + Math.PI / 2 * (i % 2 ? 1 : -1), off = p.R + 1.9;
      const cx = p.x + Math.cos(side) * off, cz = p.z + Math.sin(side) * off;
      const cup = new THREE.LatheGeometry([[0.01, 0], [p.R * 0.5, 0.05], [p.R * 0.74, 0.5], [p.R * 0.8, 1.1], [p.R * 0.72, 1.15]].map(([r, y]) => new THREE.Vector2(r, y)), 28).translate(cx, top, cz);
      add(M.pole, cup); proxy(cup.clone());
      const sy = k.sphere(cx, cz, p.R, 0, { y: top + 1.1 + p.R * 0.6, seg: 20 });
      out.pillars.push({ ...p, top, base, rs, cup: { x: cx, z: cz }, sphere: { x: cx, z: cz, y: sy, R: p.R } });
    });
    // the walkways from top to top, a low kerb each side
    for (let i = 0; i + 1 < PILLARS.length; i++) {
      const a = out.pillars[i], b = out.pillars[i + 1], u = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      const A = new THREE.Vector3(a.x + u.x * (a.plat - 0.6), a.top, a.z + u.z * (a.plat - 0.6)), B = new THREE.Vector3(b.x - u.x * (b.plat - 0.6), b.top, b.z - u.z * (b.plat - 0.6));
      const deck = beam(A, B, 3.2, 0.55);
      add(M.pole, deck); proxy(deck.clone());
      const n = new THREE.Vector3(-u.z, 0, u.x);
      for (const s of [-1, 1]) {
        const o = n.clone().multiplyScalar(s * 1.45), kerb = beam(A.clone().add(o).setY(A.y + 0.4), B.clone().add(o).setY(B.y + 0.4), 0.3, 0.4);
        add(M.pole, kerb); proxy(kerb.clone());
      }
      // a thin rib under its middle, as the sheets' bridges
      const keel = beam(A.clone().setY(A.y - 0.55), B.clone().setY(B.y - 0.55), 1.2, 0.5);
      add(M.pole, keel); proxy(keel.clone());
      out.walkways.push({ from: i, to: i + 1, a: A, b: B, length: A.distanceTo(B) });
    }
    // the spiral stairs: up round the first pillar from the meadow, down round the last
    const spiral = (p, end) => {
      const { r, w, grade } = SPIRAL, rise = p.top - (H(p.x, p.z) + 0.1), len = rise / grade, turn = len / r, n = Math.ceil(turn / (Math.PI / 18));
      const a0 = end - turn, pts = [];
      const at = (i) => { const a = a0 + (turn * i) / n, y = p.top - rise + (rise * i) / n; return new THREE.Vector3(p.x + Math.cos(a) * r, y, p.z + Math.sin(a) * r); };
      for (let i = 0; i < n; i++) {
        const A = at(i), B = at(i + 1), tread = beam(A, B, w, 0.45);
        // (each piece a hair longer, so they close up round the turn)
        add(M.pole, tread); proxy(tread.clone());
        const am = a0 + (turn * (i + 0.5)) / n;
        for (const [rk, hk] of [[r + w / 2 + 0.15, 0.55], [r - w / 2 - 0.15, 0.55]]) {
          const o = (q) => new THREE.Vector3(p.x + Math.cos(Math.atan2(q.z - p.z, q.x - p.x)) * rk, q.y + hk / 2 + 0.05, p.z + Math.sin(Math.atan2(q.z - p.z, q.x - p.x)) * rk);
          const kerb = beam(o(A), o(B), 0.3, hk);
          add(M.pole, kerb); proxy(kerb.clone());
        }
        if (i % 6 === 0) {
          // a rib back to the shaft under it
          const m = at(i + 0.5), ib = new THREE.Vector3(p.x + Math.cos(am) * (p.rs - 0.2), m.y - 0.5, p.z + Math.sin(am) * (p.rs - 0.2)), ob = new THREE.Vector3(p.x + Math.cos(am) * (r - w / 2), m.y - 0.5, p.z + Math.sin(am) * (r - w / 2));
          const rib = beam(ib, ob, 0.5, 0.6);
          add(M.pole, rib); proxy(rib.clone());
        }
        pts.push(A);
      }
      pts.push(at(n));
      // (and a lead onto its foot along its own line, on the meadow: the kerbs leave no way on from the side)
      const t0 = new THREE.Vector3(-Math.sin(a0), 0, Math.cos(a0)), lead = pts[0].clone().addScaledVector(t0, -4);
      lead.y = H(lead.x, lead.z);
      pts.unshift(lead);
      return pts;
    };
    const P1 = out.pillars[0], P6 = out.pillars[5];
    // (each ends a quarter turn past the walkway's own side, so the turn under it clears your head)
    const up = spiral(P1, az(P1, out.pillars[1]) + Math.PI / 2);
    const down = spiral(P6, az(out.pillars[4], P6) + Math.PI + Math.PI / 2);
    out.spirals = { up, down };
    // the broken pillars standing among them (no spheres: broken off), and little copies set up on thin shafts
    for (const [s, off, h] of [[86, 40, 22], [130, -6, 48], [170, 48, 16], [214, -10, 36], [258, 44, 26], [124, 64, 56], [204, 70, 40]]) {
      const x = CRATERS.cracked.x + FD[0] * s + WEST[0] * off, z = CRATERS.cracked.z + FD[1] * s + WEST[1] * off;
      if (!k.keep(x, z, 3)) continue;
      const b = H(x, z) - 0.5, r = 1.3 + (h % 5) * 0.15;
      const g = new THREE.CylinderGeometry(r * 0.9, r, h, 16, 1).translate(x, b + h / 2, z);
      // (broken off: its top cut at a slant)
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > b + h - 0.01) p.setY(i, b + h - 1.2 + (p.getX(i) - x) / r * 1.2);
      g.computeVertexNormals();
      add(M.pole, g); proxy(g.clone());
    }
    // the way up and over, for the audit and the tests: from the crater's south stair to the first pillar's foot, up, along
    // the tops, down the last
    out.walk = [...up, ...out.pillars.slice(1, 5).map((p) => new THREE.Vector3(p.x, p.top, p.z)), ...down.slice().reverse()];
    out.sights.push(...out.pillars.map((p, i) => ({ name: i ? `a sphere high on the pillars (${i + 1})` : 'the first sphere on the pillars', at: new THREE.Vector3(p.x, p.top, p.z) })));
    out.beacons.push(...out.pillars.map((p, i) => ({ name: `a pillar of the forest (${i + 1})`, top: [p.sphere.x, p.sphere.y + p.R, p.sphere.z], height: p.sphere.y + p.R - p.base })));
  }
  return out;
}
