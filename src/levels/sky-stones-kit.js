import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, mulberry32, lerp } from '../noise.js';

// The Sky Stones' rock builders (Vael II, src/levels/arzach2.js): mushroom tables,
// needle spires, boulders, all as position-only geometry ready to merge. Shared with
// the title screen's vista (src/title-vista.js), which raises a few of them out of
// its own sea of cloud. Pure geometry: no materials, no scene.

export const TAU = Math.PI * 2;
export const nA = createNoise2D(1975), nB = createNoise2D(2112), nC = createNoise2D(77);


/** Keep only positions (non-indexed) so everything merges; form: and a part's axis, if it has one (src/form.js). */
export function clean(g, form = false) {
  const n = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', n.getAttribute('position').clone());
  if (form && n.attributes.aFormC) for (const k of ['aFormC', 'aFormA']) out.setAttribute(k, n.getAttribute(k).clone());
  return out;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function place(g, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return g.applyMatrix4(_m4.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz)));
}
/** Tilt a built piece about the point (x, y, z): rx leans it along +z, rz along -x. */
export function tiltAbout(g, x, y, z, rx, rz) {
  if (!rx && !rz) return g;
  _q.setFromEuler(_e.set(rx, 0, rz));
  return g.translate(-x, -y, -z).applyMatrix4(_m4.makeRotationFromQuaternion(_q)).translate(x, y, z);
}
/** Lumpy displacement along the direction from the origin (position-based, so seams stay welded). */
export function lumpy(g, amt, freq, seed = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amt * (nA(x * freq + seed, y * freq - z * freq * 0.7) * 0.7 + nB(z * freq * 2.1 - seed, y * freq * 2.1 + x) * 0.3);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}

/**
 * A closed rock body made of horizontal rings. Each ring is {y, r, ox, oz};
 * shape(a, ring) -> [radius multiplier, y offset] gives the outline, flutes
 * and ribs. The profile runs from the foot, up the side, under any overhang,
 * over the rim and onto the top, so every face points outward.
 */
export function solid(rings, seg, shape, { top = null, bottom = null } = {}) {
  const P = rings.map((rg) => {
    const ring = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      const [m, dy] = shape ? shape(a, rg) : [1, 0];
      ring.push([rg.ox + Math.cos(a) * rg.r * m, rg.y + dy, rg.oz + Math.sin(a) * rg.r * m]);
    }
    return ring;
  });
  const pos = [];
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < P.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = P[i][j], b = P[i][j2], c = P[i + 1][j], d = P[i + 1][j2];
      tri(a, c, b); tri(b, c, d);
    }
  }
  if (top) { const L = P[P.length - 1]; for (let j = 0; j < seg; j++) tri(L[j], top, L[(j + 1) % seg]); }
  if (bottom) { const F = P[0]; for (let j = 0; j < seg; j++) tri(F[j], F[(j + 1) % seg], bottom); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * Mushroom table / plateau: an eroded, fluted stalk, a wide cap with a
 * ribbed (radiating) underside, a rounded rim and a gently domed top.
 * off shifts the cap relative to the stalk for one-sided overhangs.
 * lean [rx, rz] (radians) tips the whole piece about its neck, so the cap's plane goes off the
 * horizontal and the stalk slants under it: on the sheets no mushroom stands plumb.
 */
export function table(o) {
  const { x, z, R, stalk, top, base = -120, dome = 1, seed = 0, rib = 0, ribK = 24, flute = 0.08, fluteK = 11,
    outline = 0.14, waist = 0.12, foot = 1.25, neckR = 1, seg = 112, colSeg = 18, ledges = 0, lean = null } = o;
  const capT = o.capT ?? R * 0.16, under = o.under ?? R * 0.22, off = o.off ?? [0, 0];
  const neckY = top - capT - under;
  const rings = [];
  const NS = ledges ? 14 : 8;
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    const step = ledges * (i % 2 ? 1 : -0.4) * (0.5 + 0.5 * nC(i * 1.7, seed));   // strata ledges
    rings.push({ y: lerp(base, neckY, t) + (i % 2 || i === NS ? 0 : ledges * 30 * nC(i, seed + 3)), r: stalk * (lerp(foot, neckR, Math.pow(t, 0.7)) - waist * Math.sin(Math.PI * t) + step), ox: 0, oz: 0, kind: 's', u: t });
  }
  const NU = 10;
  for (let i = 1; i <= NU; i++) {
    const u = i / NU, w = Math.pow(u, 0.8);
    rings.push({ y: neckY + under * Math.pow(u, 1.9), r: lerp(stalk * neckR * 1.04, R, Math.pow(u, 0.7)), ox: off[0] * w, oz: off[1] * w, kind: 'u', u });
  }
  const [ox, oz] = off;
  rings.push({ y: top - capT * 0.55, r: R * 1.015, ox, oz, kind: 'c' });
  rings.push({ y: top - capT * 0.14, r: R * 0.975, ox, oz, kind: 'c' });
  for (const k of [0.9, 0.72, 0.5, 0.26]) rings.push({ y: top + dome * (1 - k * k), r: R * k, ox, oz, kind: 't' });
  const stalkLine = (ca, sa, y) => 1 + 0.13 * nB(ca * 1.4 + seed + y * 0.006, sa * 1.4 + y * 0.011);
  const capLine = (ca, sa) => 1 + outline * nA(ca * 1.1 + seed, sa * 1.1 - seed) + outline * 0.35 * nB(ca * 3 + seed, sa * 3 - seed);
  const shape = (detail) => (a, rg) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    if (rg.kind === 's') {
      const fl = detail ? 1 - flute * Math.pow(0.5 + 0.5 * Math.sin(fluteK * a + 2.5 * nA(ca + seed, sa + rg.y * 0.02)), 3) : 1;
      return [stalkLine(ca, sa, rg.y) * fl, 0];
    }
    if (rg.kind === 'u') {
      const m = lerp(stalkLine(ca, sa, rg.y), capLine(ca, sa), Math.pow(rg.u, 0.6));
      const dy = detail && rib && rg.u < 0.7 ? -rib * Math.pow(Math.abs(Math.sin(ribK * a)), 0.6) * Math.sin(Math.PI * rg.u / 0.7) * (0.55 + 0.45 * nB(ca * 5 + seed, sa * 5)) : 0;
      return [m, dy];
    }
    return [capLine(ca, sa), 0];
  };
  // the lean: the piece tips about its neck, where the stalk meets the cap, so the cap stays where asked
  const [lx, lz] = lean ?? [0, 0];
  const lean0 = (g) => tiltAbout(g, x, o.leanY ?? neckY, z, lx, lz);
  const apex = [x + ox, top + dome, z + oz];
  const visG = solid(rings, seg, shape(true), { top: [ox, top + dome, oz] });
  // shaded by its own round form, without the stalk's flutes and the underside's ribs (a twin of the same rings
  // without them, welded and smooth: needle's), so its terminator is one clean band; they stay in its outline
  if (o.axisShade !== false) {
    const twin = mergeVertices(solid(rings, seg, shape(false), { top: [ox, top + dome, oz] }), 1e-4);
    twin.computeVertexNormals();
    visG.setAttribute('normal', twin.toNonIndexed().getAttribute('normal'));
  }
  const vis = lean0(place(visG, x, 0, z));
  // the collision copy keeps every other stalk / underside ring
  const coarse = rings.filter((rg, i) => rg.kind === 'c' || rg.kind === 't' || i % 2 === 0 || i === NS || i === rings.length - 1);
  const col = lean0(place(solid(coarse, colSeg, shape(false), { top: [ox, top + dome, oz] }), x, 0, z));
  // a slightly shrunken copy that casts the shadow, so the cap never shadows its own rim
  const inner = coarse.map((rg) => ({ ...rg, r: rg.r * 0.95, y: rg.y - Math.min(0.8, R * 0.03) }));
  const shadow = lean0(place(solid(inner, colSeg, shape(false), { top: [ox, top + dome * 0.9, oz] }), x, 0, z));
  // drips { n, len (of R), r (of R), band (of the underside, 0 the neck … 1 the rim) }: stalactites
  // hung from the underside, the longest near the lip, as the sheets draw every overhang
  let drip = null;
  const spots = [];
  if (o.drips) {
    const D = { n: 16, len: [0.05, 0.14], r: 0.016, band: [0.45, 0.95], ...o.drips };
    const rng = mulberry32(Math.floor((seed + 11) * 613) + 5);
    for (let i = 0; i < D.n; i++) {
      const u = D.band[0] + rng() * (D.band[1] - D.band[0]), w = Math.pow(u, 0.8);
      // (rooted in the underside as it is drawn there: its outline and its ribs at this angle, a little
      //  inside its ring, so a drip never hangs off the rock by a gap where the outline draws in)
      const a = ((i + rng()) / D.n) * TAU, rg = { kind: 'u', u, y: neckY + under * Math.pow(u, 1.9) };
      const [m, dy] = shape(true)(a, rg);
      const rr = lerp(stalk * neckR * 1.04, R, Math.pow(u, 0.7)) * m * 0.95;
      spots.push([x + ox * w + Math.cos(a) * rr, rg.y + dy,
        z + oz * w + Math.sin(a) * rr, R * (D.len[0] + rng() * (D.len[1] - D.len[0])) * (0.35 + 0.85 * u)]);
    }
    drip = lean0(drips(spots, { r: R * D.r, seed: seed + 3 }));
  }
  // a point on the underside as drawn (u 0 the neck … 1 the rim, a the angle) and the way out of it, before the lean:
  // for what is hung from it or grows on it (arzach2.js: the knobs and ribs of rock under the overhangs)
  const underAt = (u, a) => {
    const w = Math.pow(u, 0.8), rg = { kind: 'u', u, y: neckY + under * Math.pow(u, 1.9) }, [m, dy] = shape(true)(a, rg);
    const rr = lerp(stalk * neckR * 1.04, R, Math.pow(u, 0.7)) * m;
    const p = new THREE.Vector3(x + ox * w + Math.cos(a) * rr, rg.y + dy, z + oz * w + Math.sin(a) * rr);
    const slope = under * 1.9 * Math.pow(Math.max(u, 0.05), 0.9) / Math.max(R - stalk * neckR, 1);   // (dy / dr, roughly)
    const n = new THREE.Vector3(Math.cos(a) * slope, -1, Math.sin(a) * slope).normalize();
    return { p, n };
  };
  return { vis, col, shadow, apex, drip, dripAt: drip ? spots : [], underAt, lean: lean0 };
}

/**
 * Drips and stalactites: tapering spikes of stone hung from the points `spots` ([x, y, z, length]),
 * each a swollen root in the rock, a waist and a long point. The sheets hang them under every dark
 * overhang and along a cave's mouth (IMG_3787 panels 2 and 4, IMG_3785 panel 2, IMG_3788 panel 4).
 * Drawn only: nothing walks under a cap, so they are never given to the collision.
 */
export function drips(spots, { r = 0.3, seg = 5, seed = 0 } = {}) {
  const rng = mulberry32(Math.floor(seed * 1000) + 131);
  const pos = [];
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (const [px, py, pz, L] of spots) {
    const rad = r * (0.55 + rng() * 0.8), bell = 0.7 + rng() * 0.6, twist = rng() * TAU;
    // (the root goes well up into the rock and is closed there: on a sloping underside its uphill side
    //  never shows an open end)
    const prof = [[-L, 0.05], [-L * 0.64, 0.3 * bell], [-L * 0.3, 0.62 * bell], [0, 1.05], [r * 0.8, 1.2], [r * 2.6, 1.1]];
    const rings = prof.map(([dy, k]) => Array.from({ length: seg }, (_, j) => {
      const t = (j / seg) * TAU + twist;
      return [px + Math.cos(t) * rad * k, py + dy, pz + Math.sin(t) * rad * k];
    }));
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg, a = rings[i][j], b = rings[i][j2], c = rings[i + 1][j], d = rings[i + 1][j2];
      tri(a, c, b); tri(b, c, d);
    }
    const tip = [px, py - L - rad * 0.1, pz], cap = [px, py + r * 2.8, pz], R = rings[rings.length - 1];
    for (let j = 0; j < seg; j++) { tri(rings[0][j], rings[0][(j + 1) % seg], tip); tri(R[(j + 1) % seg], R[j], cap); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // (their normals bent down, toward the underside's own: hung in its shade, they print in its tone,
  //  outlined, instead of catching the low sun on their flanks like scraps of paper)
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i) * 0.3, y = n.getY(i) * 0.3 - 0.7, z = n.getZ(i) * 0.3, l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  return g;
}

/** A needle spire: slender, lumpy, vertically fluted, with shoulders. */
export function needle(o) {
  const { x, y, z, H, R, seed = 0, seg = 16, rings = 24, flute = 0.16, lean = 0.06, axisShade = true } = o;
  const rng = mulberry32(Math.floor(seed * 1000) + 7);
  const k = 4 + Math.floor(rng() * 4);
  const sh = [[0.2 + rng() * 0.3, 0.12 + rng() * 0.2], [0.5 + rng() * 0.3, 0.08 + rng() * 0.15]];
  const la = rng() * TAU;
  // a stalagmite-like taper: a flared foot, waxy shoulders, a blunt rounded tip
  const prof = (t) => {
    let r = (1 + 0.45 * Math.pow(1 - t, 10)) * (1 - 0.86 * Math.pow(t, 1.15));
    for (const [t0, s] of sh) r *= 1 + s * Math.exp(-(((t - t0) / 0.06) ** 2));
    return r;
  };
  const make = (sg, nr, detail) => {
    const rs = [{ y: -R * 0.8, r: R * 1.35, ox: 0, oz: 0, t: 0 }];
    for (let i = 0; i < nr; i++) {
      const t = (i / nr) * 0.985;
      const bend = lean * H * t * t;
      const tip = t > 0.93 ? Math.sqrt(Math.max(1 - ((t - 0.93) / 0.07) ** 2, 0.08)) : 1;
      rs.push({ y: t * H, r: R * prof(t) * tip, ox: Math.cos(la) * bend, oz: Math.sin(la) * bend, t });
    }
    const shape = (a, rg) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      let m = 1 + 0.15 * nA(ca * 1.5 + seed * 3, sa * 1.5 + rg.t * 7);
      if (detail) {
        m += 0.07 * nB(ca * 3 + seed, sa * 3 + rg.t * 16);
        m *= 1 - flute * (1 - rg.t * 0.6) * Math.pow(0.5 + 0.5 * Math.cos(k * a + 1.6 * nB(rg.t * 2.5, seed * 5)), 3);
      }
      return [m, 0];
    };
    const bend = lean * H, top = [Math.cos(la) * bend, H * 0.997, Math.sin(la) * bend];
    const g = solid(rs, sg, shape, { top });
    // the shading normal of the needle without its flutes (the stalk's own round form): the sheets' terminator is
    // one clean band down a needle, where the flutes' facets broke ours into lit islands in the shade. The flutes
    // stay in its outline; its normals are a twin's, the same rings without them, welded and smooth.
    if (detail && axisShade) {
      const twin = mergeVertices(solid(rs, sg, (a, rg) => [1 + 0.15 * nA(Math.cos(a) * 1.5 + seed * 3, Math.sin(a) * 1.5 + rg.t * 7), 0], { top }), 1e-4);
      twin.computeVertexNormals();
      g.setAttribute('normal', twin.toNonIndexed().getAttribute('normal'));
    }
    return place(g, x, y, z);
  };
  return { vis: make(seg, rings, true), col: make(6, 5, false), tip: [x, y + H, z] };
}

/**
 * Rounded boulder / egg. `crack` (0 … 0.4) cuts two deep clefts round it and a seam down one side,
 * so the stone reads as an egg split into lobes, as the sheets draw the balanced ones (IMG_3786 p2).
 */
export function boulder(r, sx, sy, sz, egg = 0, seed = 0, detail = true, crack = 0) {
  const g = detail ? new THREE.SphereGeometry(1, crack ? 18 : 14, crack ? 16 : 10) : new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position;
  const rc = mulberry32(Math.floor(seed * 100) + 17);
  const c1 = -0.45 + rc() * 0.5, c2 = c1 + 0.4 + rc() * 0.3, a0 = rc() * TAU;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i);
    let k = 1 - egg * yy;
    if (crack && detail) {
      const ang = Math.atan2(p.getZ(i), p.getX(i));
      k *= 1 - crack * (Math.exp(-(((yy - c1) / 0.15) ** 2)) * (0.75 + 0.25 * Math.sin(ang * 3 + a0))
        + 0.75 * Math.exp(-(((yy - c2) / 0.12) ** 2)));
      const da = Math.atan2(Math.sin(ang - a0), Math.cos(ang - a0));
      k *= 1 - crack * 0.45 * Math.exp(-((da / 0.22) ** 2)) * (0.35 + 0.65 * Math.abs(yy));
    }
    p.setXYZ(i, p.getX(i) * k, yy, p.getZ(i) * k);
  }
  lumpy(g, detail ? 0.1 : 0.05, 1.3, seed);
  g.scale(r * sx, r * sy, r * sz);
  return clean(g);
}
