import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { leafCrown } from './garden-kit.js';

// ---------------------------------------------------------------------------
// Lorn II's shapes, shared by the world (perdide2.js) and its reference views (reference-lorn.js), after
// the sheets (references/Lorn II The Deep Wood/IMG_3797 … 3800):
//   braid      a root as a tangle: strands twisting round its course, splitting off and rejoining it
//   caveFrame  a cave mouth framed in roots: arches of tangled roots over a dark hollow, roots hanging in it
//   bankBush   a bush on the bank: a mass of small leaf clumps (drawn in dense hatching: its material's)
//   nest       the nest in a great cap: a woven bowl of roots heaped with eggs under a ribbed glass dome
// Each returns plain geometries in the caller's frame (no materials, no placing in a scene).
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** A tube along points, tapering from r at its start to r × end at its finish. */
export function taper(pts, r, end = 0.35, tubular = 24, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(curve, tubular, r, radial, false), P = g.attributes.position;
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular, c = curve.getPointAt(u), k = 1 - (1 - end) * u;
    for (let j = 0; j <= radial; j++) {
      const v = i * (radial + 1) + j;
      P.setXYZ(v, c.x + (P.getX(v) - c.x) * k, c.y + (P.getY(v) - c.y) * k, c.z + (P.getZ(v) - c.z) * k);
    }
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/**
 * A root drawn as a tangle (the sheets' roots are bundles, never one smooth tube): n strands twisting round
 * the course `pts` (radius r), each wandering in and out of the bundle, a few splitting off at the ends to
 * dig into the ground. Returns [geometry…], the strands (no core: the strands are the root).
 */
export function braid(pts, r, { n = 5, seed = 1, turns = 2.5, tubular = 40, radial = 6, splay = 1.2 } = {}) {
  const rng = mulberry32(Math.floor(seed * 7307) + 11), curve = new THREE.CatmullRomCurve3(pts), L = curve.getLength(), out = [];
  const steps = Math.max(10, Math.round(L / Math.max(r, 0.4)));
  const up = V(0, 1, 0), side = V(), nrm = V();
  for (let s = 0; s < n; s++) {
    const ph = (s / n) * Math.PI * 2 + rng() * 0.6, tw = turns * (0.7 + rng() * 0.6) * (rng() < 0.5 ? -1 : 1), off = 0.45 + rng() * 0.45, sp = [];
    const a0 = rng() * 0.15, a1 = 1 - rng() * 0.15;
    for (let i = 0; i <= steps; i++) {
      const u = a0 + (a1 - a0) * (i / steps), p = curve.getPointAt(u), t = curve.getTangentAt(u);
      side.crossVectors(t, up); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
      nrm.crossVectors(side, t).normalize();
      const a = ph + tw * u * Math.PI * 2, d = r * off * (0.75 + 0.35 * Math.sin(u * 9 + ph * 2));
      // (toward the ends the strands splay out of the bundle, as roots open into the ground)
      const end = Math.max(0, 1 - Math.min(u, 1 - u) * 6) * splay;
      sp.push(p.clone().addScaledVector(side, Math.cos(a) * d * (1 + end)).addScaledVector(nrm, Math.sin(a) * d * (1 + end * 0.3)));
    }
    out.push(taper(sp, r * (0.38 + rng() * 0.22), 0.55 + rng() * 0.3, Math.round(tubular * (0.8 + rng() * 0.4)), radial));
  }
  return out;
}

/**
 * A cave mouth framed in roots, facing +z, its opening r wide and 1.25 r high from y = 0: arches of tangled roots
 * over and round it (`arches` of them, the outer ones larger and further back), roots hanging in the mouth, the
 * dark hollow behind (`depth` × r deep) and, at its back, a glowing end (when `glow`).
 * { roots: [geo], face: the root mass's face round the mouth, dark: [geo], glow: [geo], hang: [geo] }.
 */
export function caveFrame({ r, depth = 2.2, arches = 7, hang = 14, feet = 6, seed = 1, glow = false, strands = [3, 5], tubular = 40 }) {
  const ns = (k) => strands[0] + Math.floor(mulberry32(seed * 31 + k)() * (strands[1] - strands[0] + 1));
  const rng = mulberry32(Math.floor(seed * 4129) + 7), roots = [], dark = [], glowG = [], hangG = [];
  const H = r * 1.25, D = r * depth;
  // the hollow: a dark half-tunnel (seen from inside) closed at its back
  // (mirrored, so its faces look inward: seen from the mouth)
  const tunnel = new THREE.CylinderGeometry(r * 0.98, r * 0.98, D, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).scale(-1, H / r, 1).translate(0, 0, -D / 2);
  dark.push(tunnel);
  // the face of the root mass round the mouth, out to 3 r (the arches lie over it)
  const face = new THREE.RingGeometry(r * 0.97, r * 3, 28, 3, 0, Math.PI), fp = face.attributes.position;
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i), d = Math.hypot(x, y); fp.setXYZ(i, x, y * (H / r), -Math.max(0, d - r) * 0.35 + (rng() - 0.5) * r * 0.08); }
  face.computeVertexNormals();

  const back = new THREE.CircleGeometry(r, 20, 0, Math.PI).scale(1, H / r, 1).translate(0, 0, -D + 0.05);
  (glow ? glowG : dark).push(back);
  // the frame: arches of tangled roots, each from the ground beside the mouth up over it and down the other side
  for (let k = 0; k < arches; k++) {
    const t = k / Math.max(arches - 1, 1), R = r * (1.08 + t * 1.3 + rng() * 0.15), z = -t * r * 1.4 + (rng() - 0.5) * r * 0.25, lean = (rng() - 0.5) * 0.3;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (i / 8), w = 1 + (rng() - 0.5) * 0.12;
      pts.push(V(-Math.cos(a) * R * w, Math.sin(a) * R * (H / r) * (0.92 + rng() * 0.12) - 0.4, z + Math.sin(a) * R * lean));
    }
    pts[0].y = pts[8].y = -0.8;
    roots.push(...braid(pts, r * (0.16 + t * 0.12) * (0.8 + rng() * 0.4), { n: ns(k), seed: seed + k * 1.7, turns: 1.6, tubular }));
  }
  // roots crawling over the mass from the frame to the ground, round the sides
  for (let k = 0; k < 6; k++) {
    const sd = k % 2 ? 1 : -1, a = 0.25 + rng() * 0.5, R = r * (1.3 + rng() * 0.8);
    const p0 = V(-Math.cos(Math.PI * a) * R * sd * -1, Math.sin(Math.PI * a) * R * 1.1, -r * (0.2 + rng() * 1.2));
    const p2 = V(sd * R * (1.5 + rng() * 0.6), -0.6, p0.z + (rng() - 0.3) * r * 1.4);
    roots.push(...braid([p0, p0.clone().lerp(p2, 0.5).add(V(0, R * 0.25, 0)), p2], r * 0.14, { n: ns(20 + k), seed: seed + 20 + k, turns: 1.2, tubular: tubular * 0.6 }));
  }
  // the mass's feet: roots crawling out along the ground on either side of the mouth, toward the onlooker
  for (let k = 0; k < feet; k++) {
    const sd = k % 2 ? 1 : -1, x0 = sd * r * (1.05 + rng() * 0.5), y0 = H * (0.3 + rng() * 0.5), out = r * (0.9 + rng() * 1.4);
    roots.push(...braid([V(x0, y0, -r * 0.2), V(x0 + sd * r * 0.3, y0 * 0.4, out * 0.4), V(x0 + sd * r * (0.5 + rng()), -0.5, out)], r * (0.16 + rng() * 0.1), { n: ns(40 + k), seed: seed + 40 + k, turns: 1, tubular: tubular * 0.6 }));
  }
  // roots hanging in the mouth from its lintel
  for (let i = 0; i < hang; i++) {
    const x = (rng() - 0.5) * r * 1.6, top = Math.sqrt(Math.max(0, 1 - (x / (r * 1.05)) ** 2)) * H, l = H * (0.2 + rng() * 0.55), z = -rng() * r * 0.6;
    hangG.push(taper([V(x, top + 0.2, z), V(x + (rng() - 0.5) * 0.4, top - l * 0.5, z + 0.1), V(x + (rng() - 0.5) * 0.6, top - l, z)], r * (0.025 + rng() * 0.03), 0.3, 8, 4));
  }
  return { roots, face, dark, glow: glowG, hang: hangG };
}

/** A bank bush: a low mass of small leaf clumps, about a unit round, its foot at y ≈ −0.5 (garden-kit.js leafCrown). */
export function bankBush(seed, detail = 1, { fronds = detail ? 30 : 10 } = {}) {
  const crown = leafCrown(seed, { lobes: detail ? 7 : 4, detail, core: 0.66, flat: 0.62, size: [0.3, 0.46] });
  return fronds ? mergeGeometries([crown, frondTuft(seed, fronds)]) : crown;
}
/**
 * A bush's broken outline: n blades (each a thin two-sided triangle) springing out of its clumps' top and sides,
 * leaning out, so its silhouette is the sheets' ragged leafy edge, not a smooth lump, and the ink draws each blade.
 * Indexed (to merge with the welded clumps); about a unit round, as bankBush.
 */
export function frondTuft(seed, n = 12) {
  const rng = mulberry32(Math.floor(seed * 9173) + 29), pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 * 3.1 + rng() * 0.8, el = 0.45 + rng() * 0.9, r0 = 0.5 + rng() * 0.2;
    const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const base = dir.clone().multiplyScalar(r0).multiply(V(1, 0.62, 1)), len = 0.22 + rng() * 0.3, w = 0.025 + rng() * 0.03;
    const side = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(w), tip = base.clone().addScaledVector(dir.clone().add(V(0, 0.8, 0)).normalize(), len);
    const k = pos.length / 3;
    for (const p of [base.clone().sub(side), base.clone().add(side), tip]) pos.push(p.x, p.y, p.z);
    for (const p of [base.clone().sub(side), base.clone().add(side), tip]) pos.push(p.x, p.y, p.z);
    idx.push(k, k + 1, k + 2, k + 3, k + 5, k + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * The nest in a great cap: a woven bowl R wide of root strands, heaped with eggs, under a glass dome drawn as its
 * ribs. Its foot on y = 0. { bowl: [geo], ribs: [geo], eggs: [[x, y, z, s]…] }.
 */
export function nest(R, { seed = 1, eggs = 26 } = {}) {
  const rng = mulberry32(Math.floor(seed * 6007) + 5), bowl = [], ribs = [], heap = [];
  for (let k = 0; k < 5; k++) {
    const pts = [], h = R * 0.12 * k, rr = R * (0.78 + 0.06 * k);
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2 + k; pts.push(V(Math.cos(a) * rr, h + Math.sin(a * 3 + k) * R * 0.04, Math.sin(a) * rr)); }
    bowl.push(...braid(pts, R * 0.07, { n: 2, seed: seed + k, turns: 4, splay: 0 }));
  }
  const dome = R * 0.92, base = R * 0.5;
  for (let i = 0; i < 8; i++) ribs.push(new THREE.TorusGeometry(dome, R * 0.025, 4, 18, Math.PI).rotateY((i / 8) * Math.PI).scale(1, 0.85, 1).translate(0, base, 0));
  ribs.push(new THREE.TorusGeometry(dome * 0.75, R * 0.025, 4, 28).rotateX(Math.PI / 2).translate(0, base + dome * 0.55, 0));
  for (let i = 0; i < eggs; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * R * 0.7, s = R * (0.1 + rng() * 0.06);
    heap.push([Math.cos(a) * d, base * 0.5 + s + (R * 0.7 - d) * 0.35, Math.sin(a) * d, s]);
  }
  return { bowl, ribs, eggs: heap };
}
