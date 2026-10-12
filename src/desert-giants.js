import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { staticFlame } from './story/flames.js';
import { rough } from './desert-hearth.js';
import { finish, tube, band, ribcageMaterial } from './desert-ribcage.js';
import { GIANTS, STORY } from './desert-sites.js';
import { WASH } from './desert-landmarks.js';

// The giants' road (issue #167; references/levels/The Desert/environment/explorations/giants-road/; the Speaker's
// "the giants carried water from the swamp of lights"): the giants did not all lie down under Qanat. They fell one
// by one down the old river as it failed, and four of them lie out on the dunes between the ride to the Hearth and
// the marked stones home, the mid-distance landmarks the desert lacked (src/desert-sites.js GIANTS, DRY_WASH):
//
//   the hand    standing out of the dune by the wash like a ruin, 27 m to its longest finger, its palm to the hollow
//   the arm     lying across the dry wash, its shoulder sunk in the south bank and its hand open on the north one:
//               ride (or walk) up from the shoulder, over the elbow and across, 8 m over the bed. Broad and flat on
//               top, collided as drawn
//   the spine   up a dune's slope like a stair, a vertebra every 3.4 m, its skull a lookout on the crest
//   the jaw     standing over the wash's head like an arch, teeth down: the pilgrims' shelter, a rug and a fire under it
//
// Each has a pilgrims' shrine: a verse stone with its number cut in notches (I-IV, read outward from Qanat), a
// brazier burning and a pole of red and white cloth (src/story/desert-giants.js reads the verses). The arm's shrine
// stands on its elbow, beside the way over. Bone in the ribcage's own material (one per giant: each is culled on its
// own), the shrines in the road's stone, clay and cloth.
//
//   const road = buildGiantsRoad(scene, terrain)  →  { group, giants: { hand, arm, spine, jaw }, shrines, clear, avoid, sights }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const BONE = '#f2ead6', BONE2 = '#e9dec4', HOLE = '#7a6857', RED = '#c8483a', CREAM = '#f3ead8';

/** A closed loft along a curve: an ellipse a(u) wide (level) and b(u) high, through `pts` (u 0..1 along it). */
export function loft(pts, a, b, seg = 24, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(pts), pos = [], idx = [], T0 = V(), W = V(), H = V(), up = V(0, 1, 0);
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, c = curve.getPointAt(u);
    curve.getTangentAt(u, T0);
    W.crossVectors(T0, up); if (W.lengthSq() < 1e-6) W.set(1, 0, 0); W.normalize();
    H.crossVectors(W, T0).normalize();
    const au = a(u), bu = b(u);
    for (let j = 0; j <= radial; j++) {
      const t = (j % radial) / radial * Math.PI * 2;
      pos.push(c.x + W.x * Math.cos(t) * au + H.x * Math.sin(t) * bu, c.y + W.y * Math.cos(t) * au + H.y * Math.sin(t) * bu, c.z + W.z * Math.cos(t) * au + H.z * Math.sin(t) * bu);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const p = i * (radial + 1) + j, q = p + radial + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  for (const [i, sgn] of [[0, -1], [seg, 1]]) {
    const c = curve.getPointAt(i / seg), k = pos.length / 3, ring = i * (radial + 1);
    pos.push(c.x, c.y, c.z);
    for (let j = 0; j < radial; j++) idx.push(...(sgn > 0 ? [k, ring + j + 1, ring + j] : [k, ring + j, ring + j + 1]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A giant's local frame on the sand: x across, z forward (`yaw` turns +z), y absolute. */
function frame(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    x, z, yaw,
    w: (lx, y, lz) => V(x + lx * c + lz * s, y, z - lx * s + lz * c),
    dir: (lx, lz) => V(lx * c + lz * s, 0, -lx * s + lz * c),
  };
}

export function buildGiantsRoad(scene, terrain) {
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group(); group.name = 'The giants’ road';
  const stoneMat = makeMaterial({ color: '#cdb38f', color2: '#bfa27c', flat: true });
  const clayMat = makeMaterial({ color: '#b86a43', flat: true });
  const wood = makeMaterial({ color: '#8a6a4a', flat: true });
  const clothRed = makeMaterial({ color: '#c8483a', flat: true, side: THREE.DoubleSide });
  const clothCream = makeMaterial({ color: '#f3ead8', flat: true, side: THREE.DoubleSide });
  const flameMat = makeMaterial({ color: '#ffd27a', glow: 1, flat: true, key: 'desert.road.flame' });
  const shrineParts = { stone: [], clay: [], wood: [], red: [], cream: [] };
  const clear = [], shrines = [], giants = {};
  const flat = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

  /** One giant's bone: a mesh of its own in the ribcage's material (coloured per vertex), collided as drawn. */
  const bone = (name, geos) => {
    const m = new THREE.Mesh(mergeGeometries(geos), ribcageMaterial());
    m.name = name; m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  /** A cloth strip hanging from p down `len` m, turned to `yaw`, drawn only. */
  const strip = (p, yaw, len, red = true) => (red ? shrineParts.red : shrineParts.cream).push(new THREE.PlaneGeometry(0.42, len).translate(0, -len / 2, 0).rotateZ(0.06).rotateY(yaw).translate(p.x, p.y, p.z));

  /**
   * A pilgrims' shrine: its verse stone (n notches at the top of its face, `face` the way the face looks), a brazier
   * beside it, burning, and a pole of red and white cloth behind. `at` the stone's foot (world, on whatever it stands on).
   */
  function shrine(n, at, face, { pole = true, hand = false } = {}) {
    const fx = Math.sin(face), fz = Math.cos(face), sx = Math.cos(face), sz = -Math.sin(face);
    const p = (lx, ly, lz) => V(at.x + sx * lx + fx * lz, at.y + ly, at.z + sz * lx + fz * lz);
    // the stone: a slab to the chest, its top worn round, a little lean
    shrineParts.stone.push(rough(new THREE.CylinderGeometry(0.42, 0.52, 1.5, 6, 2).scale(1.15, 1, 0.45), 0.05, 1.2, 40 + n * 7).rotateZ(0.04).rotateY(face).translate(at.x, at.y + 0.68, at.z));
    // its number: n notches cut across the top of its face (clay-red in the cut), and the last one's carved hand
    for (let k = 0; k < n; k++) { const q = p((k - (n - 1) / 2) * 0.17, 1.12, 0.23); shrineParts.clay.push(new THREE.BoxGeometry(0.06, 0.26, 0.04).rotateY(face).translate(q.x, q.y, q.z)); }
    { const q = p(0, 0.7, 0.24); shrineParts.clay.push(new THREE.BoxGeometry(0.5, 0.04, 0.04).rotateY(face).translate(q.x, q.y, q.z), new THREE.BoxGeometry(0.42, 0.04, 0.04).rotateY(face).translate(q.x, q.y - 0.14, q.z)); }
    if (hand) {
      // a hand cut in the stone pointing on: a palm and four fingers, to the stone's right (the way on)
      const q = p(0.08, 0.38, 0.24);
      shrineParts.clay.push(new THREE.BoxGeometry(0.16, 0.12, 0.04).rotateY(face).translate(q.x, q.y, q.z));
      for (let k = 0; k < 4; k++) { const r = p(0.24, 0.42 - k * 0.03, 0.24); shrineParts.clay.push(new THREE.BoxGeometry(0.2, 0.025, 0.04).rotateY(face).translate(r.x, r.y, r.z)); }
    }
    // the brazier: a clay bowl on three legs, burning
    const b = p(-0.95, 0, 0.25);
    shrineParts.clay.push(new THREE.LatheGeometry([[0.05, 0], [0.32, 0.04], [0.38, 0.2], [0.33, 0.27]].map(([r, y]) => new THREE.Vector2(r, y)), 9).translate(b.x, b.y + 0.62, b.z));
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; shrineParts.wood.push(new THREE.CylinderGeometry(0.03, 0.04, 0.68, 4).rotateZ(0.18).rotateY(a).translate(b.x + Math.sin(a) * 0.16, b.y + 0.32, b.z + Math.cos(a) * 0.16)); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 6).translate(0, 0.31, 0), flameMat);
    flame.position.set(b.x, b.y + 0.82, b.z); flame.userData.noCollide = true; flame.name = 'Shrine brazier';
    staticFlame(flame, [V(0, 0.1, 0)], { r: 0.2, h: 0.6 });
    group.add(flame);
    // the pole of cloths, behind the stone
    if (pole) {
      const q = p(0.9, 0, -0.55);
      shrineParts.wood.push(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 5).translate(q.x, q.y + 1.8, q.z));
      for (let k = 0; k < 4; k++) strip(V(q.x, q.y + 3.45 - k * 0.12, q.z), face + k * 1.4, 1.4 - k * 0.15, k % 2 === 0);
    }
    const s = { n, at: at.clone(), look: p(0, 0.95, 0.25), stand: p(0, 0, 1.5), flame };
    shrines.push(s);
    clear.push({ x: at.x, z: at.z, r: 2.6 });
    return s;
  }

  // ---------------------------------------------------------------- I. the hand, standing out of the dune
  {
    const G = GIANTS.hand, face = Math.atan2(STORY.bike.x - G.x, STORY.bike.z - G.z);   // (its palm to Marrow's hollow, where the ride begins)
    const F = frame(G.x, G.z, face), g0 = Math.min(H(G.x, G.z), ...[0, 1, 2, 3, 4, 5].map((i) => H(G.x + Math.cos(i) * 6, G.z + Math.sin(i) * 6)));
    const geos = [], put = (g, c = BONE) => geos.push(finish(g, c));
    const K = 1.4, W = (lx, ly, lz) => F.w(lx * K, g0 + ly * K, lz * K);   // (drawn at 1: K its size, 38 m to the longest finger)
    // the wrist going down into the sand, the palm standing, tipped back a little
    put(loft([W(0, -6, -1.2), W(0, -1, -0.6), W(0, 3, 0)], () => 4.1 * K, () => 3.0 * K, 6, 12));
    const palm = new THREE.SphereGeometry(1, 16, 12).scale(6.6 * K, 7.4 * K, 2.7 * K).rotateX(-0.12).rotateY(face);
    { const c = W(0, 8, 0); put(palm.translate(c.x, c.y, c.z)); }
    // four fingers, curling a little toward the palm's side, the ring finger snapped short (a ruin)
    const FINGERS = [[-4.5, 0.85 * K, 11.5, 0.16], [-1.5, K, 14.5, 0.1], [1.5, 0.95 * K, 13.2, 0.12], [4.4, 0.8 * K, 9.5, 0.22]];
    FINGERS.forEach(([fx, r, len, curl], k) => {
      const base = W(fx, 14, 0.2), pts = [base];
      let dirY = 1, dirZ = 0.05, y = 14, z = 0.2;
      for (let j = 1; j <= 3; j++) { const l = len / 3; y += dirY * l; z += dirZ * l; pts.push(W(fx * (1 + 0.03 * j), y, z)); dirZ += curl; const n = Math.hypot(dirY, dirZ); dirY /= n; dirZ /= n; }
      if (k === 2) pts.pop();   // (snapped)
      put(tube(pts, 1.75 * r, 1.25 * r, 10, 8), k % 2 ? BONE : BONE2);
      for (const q of pts.slice(1)) put(new THREE.SphereGeometry(1.55 * r, 8, 6).translate(q.x, q.y, q.z), BONE);
      put(new THREE.SphereGeometry(1.9 * r, 8, 6).translate(base.x, base.y, base.z), BONE);
    });
    // the thumb, out to the side and up
    put(tube([W(-6, 6, 0.8), W(-8.6, 9.5, 2.2), W(-10, 13.5, 3.3), W(-10.2, 16.6, 3.6)], 2.0 * K, 1.3 * K, 10, 8), BONE2);
    // holes worn through the palm, a red cloth knotted round the first finger
    for (const [lx, ly] of [[2.6, 5.2], [-2.2, 10.2], [3.8, 11]]) { const c = W(lx, ly, 2.45); put(new THREE.SphereGeometry(1, 8, 4).scale(0.9 * K, 1.3 * K, 0.2 * K).rotateY(face).translate(c.x, c.y, c.z), HOLE); }
    put(loft([W(-4.55, 16.2, 0.4), W(-4.6, 17.1, 0.5)], () => 1.62 * K, () => 1.62 * K, 1, 10), RED);
    const mesh = bone('The giant’s hand', geos);
    const sp = W(3.2, 0, 5.4); sp.y = H(sp.x, sp.z);
    const s = shrine(1, sp, face + 0.25);
    giants.hand = { mesh, at: W(0, 0, 0).setY(g0), top: W(-1.5, 28.5, 1.4), shrine: s };
    clear.push({ x: G.x, z: G.z, r: 16 });
  }

  // ---------------------------------------------------------------- II. the arm across the dry wash
  {
    const G = GIANTS.arm, { i } = WASH.nearest(G.x, G.z), P = WASH.points;
    const along = V(P[i + 1][0] - P[i][0], 0, P[i + 1][1] - P[i][1]).normalize();
    const d = V(-along.z, 0, along.x); if (d.z < 0) d.negate();   // across the wash, toward the north bank (the shoulder on the ride's side)
    const side = V(d.z, 0, -d.x);
    const C = V(G.x, 0, G.z), at = (t, l = 0) => C.clone().addScaledVector(d, t).addScaledVector(side, l);
    const gy = (t) => { const p = at(t); return H(p.x, p.z); };
    const bank = (t0, t1) => { let m = -Infinity; for (let t = t0; t <= t1; t += 2) for (const l of [-3, 0, 3]) { const p = at(t, l); m = Math.max(m, H(p.x, p.z)); } return m; };
    // its top along it (where you ride): the shoulder sunk, out of the sand, up to the elbow on the south lip, over the
    // bed to the wrist on the north bank
    const TOP = [[-58, gy(-58) - 2.2], [-46, gy(-46) + 0.2], [-36, gy(-36) + 1.6], [-24, bank(-30, -18) + 4.2], [-8, bank(-30, -18) + 3.6], [10, Math.max(bank(18, 30) + 3.0, bank(-30, -18) + 2.6)], [30, gy(30) + 2.2]];
    const topAt = (t) => { for (let k = 0; k < TOP.length - 1; k++) if (t <= TOP[k + 1][0]) { const [t0, y0] = TOP[k], [t1, y1] = TOP[k + 1], u = (t - t0) / (t1 - t0); return y0 + (y1 - y0) * (3 * u * u - 2 * u * u * u); } return TOP[TOP.length - 1][1]; };
    // (a: half its width, b: half its height, along t from the shoulder at -58 to the wrist at 30)
    const aOf = (t) => (t < -24 ? THREE.MathUtils.lerp(4.6, 4.0, (t + 58) / 34) : THREE.MathUtils.lerp(3.9, 3.0, (t + 24) / 54));
    const bOf = (t) => (t < -24 ? THREE.MathUtils.lerp(3.3, 2.9, (t + 58) / 34) : THREE.MathUtils.lerp(2.8, 2.2, (t + 24) / 54));
    const T0 = -58, T1 = 31, N = 26, ts = Array.from({ length: N + 1 }, (_, k) => T0 + (T1 - T0) * k / N);
    const pts = ts.map((t) => at(t).setY(topAt(t) - bOf(t)));
    const geos = [], put = (g, c = BONE) => geos.push(finish(g, c));
    const tOf = (u) => T0 + (T1 - T0) * u;
    put(loft(pts, (u) => aOf(tOf(u)), (u) => bOf(tOf(u)), 44, 14));
    // the elbow's knob (the shoulder is under the sand)
    { const c = at(-24).setY(topAt(-24) - 3.0); put(new THREE.SphereGeometry(1, 12, 8).scale(4.3, 3.0, 4.6).translate(c.x, c.y, c.z), BONE2); }
    // the hand open on the north bank, palm up, its fingers curling up out of the sand
    const hy = gy(38) + 0.3, hc = at(37).setY(hy);
    put(new THREE.SphereGeometry(1, 14, 8).scale(5.2, 1.4, 6.2).rotateY(Math.atan2(d.x, d.z)).translate(hc.x, hc.y, hc.z));
    [[-3.6, 6.5, 0.75], [-1.2, 8.5, 0.85], [1.2, 8.0, 0.82], [3.5, 6.0, 0.7]].forEach(([l, len, r], k) => {
      const q = (t, y) => at(t, l * (1 + (t - 42) * 0.015)).setY(hy + y);
      const f = [q(42, 0.4), q(44.5, 1.6), q(46, 1.6 + len * 0.45), q(45.6, 1.6 + len * 0.8), q(44.2, 1.6 + len)];
      put(tube(f, 1.3 * r, 0.95 * r, 12, 8), k % 2 ? BONE2 : BONE);
      for (const p of f.slice(1, 4)) put(new THREE.SphereGeometry(1.15 * r, 8, 6).translate(p.x, p.y, p.z));
    });
    put(tube([at(33, -4.6).setY(hy + 0.6), at(35, -7.2).setY(hy + 2.2), at(38, -8.4).setY(hy + 5.2)], 1.4, 0.95, 8, 8), BONE2);   // the thumb
    // the pilgrims' cloths tied round it, red and white, and their loose ends hanging down its sides
    [-44, -38, -31, -14, -2, 9, 21].forEach((t, k) => {
      const a = aOf(t) + 0.07, b = bOf(t) + 0.07, c0 = at(t - 0.45).setY(topAt(t - 0.45) - bOf(t)), c1 = at(t + 0.45).setY(topAt(t + 0.45) - bOf(t));
      put(loft([c0, c1], () => a, () => b, 1, 14), k % 2 ? CREAM : RED);
      for (const sgn of [-1, 1]) { const e = at(t, sgn * (a + 0.02)).setY(topAt(t) - b - 0.1); strip(e, Math.atan2(d.x, d.z), 1.6 + (k % 3) * 0.5, k % 2 === 0); }
    });
    const mesh = bone('The giant’s arm', geos);
    // its shrine on the elbow, to one side of the way over (a bike passes it)
    const sAt = at(-24, 2.3); sAt.y = topAt(-24) - bOf(-24) + bOf(-24) * Math.sqrt(1 - (2.3 / aOf(-24)) ** 2);
    const s = shrine(2, sAt, Math.atan2(-side.x, -side.z), { pole: false });
    s.stand = at(-24, 0.6).setY(topAt(-24));   // (on the arm's top, before it)
    giants.arm = { mesh, at: at(0).setY(topAt(0)), shoulder: at(-46).setY(topAt(-46)), elbow: at(-24).setY(topAt(-24)), wrist: at(30).setY(topAt(30)), hand: hc, across: d.clone(), topAt, bed: at(0).setY(gy(0)), shrine: s };
    for (let t = T0; t <= 46; t += 6) { const p = at(t); clear.push({ x: p.x, z: p.z, r: 6 }); }
  }

  // ---------------------------------------------------------------- III. the spine up the dune's slope, its skull on the crest
  {
    const { foot: [ax, az], top: [bx, bz] } = GIANTS.spine, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    const at = (s, l = 0) => V(ax + ux * s - uz * l, 0, az + uz * s + ux * l);
    const geos = [], put = (g, c = BONE) => geos.push(finish(g, c));
    const heading = Math.atan2(ux, uz), STEP = 3.4, n = Math.floor((L - 4) / STEP);
    for (let k = 0; k <= n; k++) {
      const s = k * STEP, p = at(s), f = 0.85 + 0.3 * k / n, y = H(p.x, p.z) + 0.25, rb = 1.35 * f, len = 2.9 * f;
      // the spool, its axis along the spine
      put(new THREE.LatheGeometry([[0, -len / 2], [rb * 0.9, -len / 2], [rb, -len / 2 + 0.2], [rb * 0.8, 0], [rb, len / 2 - 0.2], [rb * 0.9, len / 2], [0, len / 2]].map(([r, h]) => new THREE.Vector2(Math.max(r, 0.001), h)), 9)
        .rotateX(Math.PI / 2).rotateY(heading).translate(p.x, y, p.z), k % 2 ? BONE : BONE2);
      // its spine standing up, leaning back down the slope, and its wings into the sand
      const hp = 1.9 * f;
      put(new THREE.CylinderGeometry(0.28 * f, 0.62 * f, hp, 6).scale(1, 1, 0.55).translate(0, hp / 2, 0).rotateX(-0.3).rotateY(heading).translate(p.x, y + rb * 0.75, p.z), k % 2 ? BONE : BONE2);
      for (const sgn of [-1, 1]) { const w = at(s, sgn * rb * 0.9); put(new THREE.CylinderGeometry(0.3 * f, 0.5 * f, 1.8 * rb, 5).rotateZ(sgn * (Math.PI / 2 + 0.35)).rotateY(heading).translate(w.x, y - 0.1, w.z), BONE2); }
    }
    // the skull on the crest, looking back down its spine to the wash: sockets, the snout down into the sand
    const sk = at(L + 3.6), sy = H(sk.x, sk.z), C = V(sk.x, sy + 2.4, sk.z), R = V(4.8, 4.0, 6.0);
    put(new THREE.SphereGeometry(1, 16, 11).scale(R.x, R.y, R.z).rotateX(0.12).rotateY(heading).translate(C.x, C.y, C.z));
    for (const sgn of [-1, 1]) { const q = at(L - 1.1, sgn * 1.9).setY(sy + 3.9); put(new THREE.SphereGeometry(1, 10, 6).scale(1.3, 1.1, 0.4).rotateY(heading).translate(q.x, q.y, q.z), HOLE); }
    put(tube([at(L + 0.4).setY(sy + 2.6), at(L - 3.2).setY(sy + 1.4), at(L - 5.6).setY(H(at(L - 5.6).x, at(L - 5.6).z) + 0.3)], 2.6, 1.4, 8, 9), BONE2);
    // a cloth tied to the tallest spine
    put(loft([at(n * STEP - 0.2).setY(H(at(n * STEP).x, at(n * STEP).z) + 2.5), at(n * STEP + 0.2).setY(H(at(n * STEP).x, at(n * STEP).z) + 2.5)], () => 0.5, () => 0.6, 1, 8), RED);
    const mesh = bone('The giant’s spine', geos);
    const f0 = at(-3.5, 3.2), s = shrine(3, f0.setY(H(f0.x, f0.z)), Math.atan2(-ux, -uz) + 0.4);
    giants.spine = { mesh, at: at(0).setY(H(ax, az)), top: V(C.x, C.y + R.y, C.z), skull: C, shrine: s };
    for (let s2 = -4; s2 <= L + 10; s2 += 5) { const p = at(s2); clear.push({ x: p.x, z: p.z, r: 4 }); }
  }

  // ---------------------------------------------------------------- IV. the jaw over the wash's head, the pilgrims' shelter
  {
    const G = GIANTS.jaw, { i } = WASH.nearest(G.x, G.z), P = WASH.points;
    const along = V(P[i + 1][0] - P[i][0], 0, P[i + 1][1] - P[i][1]).normalize();
    const yaw = Math.atan2(along.x, along.z);   // (its local x across the wash: the arch spans it)
    const F = frame(G.x, G.z, yaw), geos = [], put = (g, c = BONE) => geos.push(finish(g, c));
    const RX = 13, RY = 13, feet = [F.w(-RX, 0, 0), F.w(RX, 0, 0)].map((p) => H(p.x, p.z));
    const y0 = Math.min(...feet) - 1.2, top = Math.max(...feet) + RY;
    const arc = [];
    for (let k = 0; k <= 16; k++) { const th = Math.PI * k / 16, lx = -Math.cos(th) * RX, foot = k < 8 ? feet[0] : feet[1]; arc.push(F.w(lx, THREE.MathUtils.lerp(foot - 1.2, top, Math.sin(th) ** 0.85), 0)); }
    const curve = new THREE.CatmullRomCurve3(arc), axis = F.dir(0, 1).normalize();
    put(band(curve, 2.6, 1.5, 40, axis, 10));
    // the knobs at its feet (where it hinged), sunk; the teeth along its underside, hanging
    for (const [k, sgn] of [[0, -1], [1, 1]]) { const p = F.w(sgn * RX * 1.02, feet[k] + 0.2, 0.8); put(new THREE.SphereGeometry(1, 10, 7).scale(2.4, 2.0, 2.8).translate(p.x, p.y, p.z), BONE2); }
    for (let k = 0; k < 10; k++) {
      const u = 0.24 + 0.52 * k / 9, p = curve.getPointAt(u), T0 = curve.getTangentAt(u), down = V().crossVectors(axis, T0).normalize();
      if (down.y > 0) down.negate();
      for (const sgn of [-0.7, 0.7]) {
        const c = p.clone().addScaledVector(down, 1.5).addScaledVector(axis, sgn * 1.3), q = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), down);
        put(new THREE.ConeGeometry(0.5, 1.6 + (k % 3) * 0.3, 6).translate(0, -0.8, 0).applyQuaternion(q).translate(c.x, c.y, c.z), k % 2 ? BONE2 : BONE);
      }
    }
    // the pilgrims' cloths hung from it
    for (const u of [0.35, 0.5, 0.65]) { const p = curve.getPointAt(u); strip(V(p.x, p.y - 1.6, p.z), yaw, 2.4, u !== 0.5); }
    const mesh = bone('The giant’s jaw', geos);
    // under it, the shelter: a rug and a ring of fire stones (the shrine's brazier by the near foot)
    const rug = new THREE.PlaneGeometry(4.2, 2.8, 4, 3).rotateX(-Math.PI / 2).rotateY(yaw + 0.3), rp = rug.attributes.position, rc = F.w(-2.5, 0, 2.5);
    for (let k = 0; k < rp.count; k++) { const x = rp.getX(k) + rc.x, z = rp.getZ(k) + rc.z; rp.setXYZ(k, x, H(x, z) + 0.05, z); }
    shrineParts.red.push(rug);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, c = F.w(2.6 + Math.cos(a) * 0.9, 0, 2.2 + Math.sin(a) * 0.9); shrineParts.stone.push(rough(new THREE.IcosahedronGeometry(0.24, 0), 0.03, 3, k).translate(c.x, H(c.x, c.z) + 0.08, c.z)); }
    const s0 = F.w(-RX + 3.6, 0, 3.4), s = shrine(4, s0.setY(H(s0.x, s0.z)), yaw + Math.PI * 0.85, { hand: true });
    giants.jaw = { mesh, at: F.w(0, 0, 0).setY(H(G.x, G.z)), top: F.w(0, top, 0), shrine: s, way: F.dir(0, 1) };
    for (const lx of [-RX, -RX / 2, 0, RX / 2, RX]) { const p = F.w(lx, 0, 0); clear.push({ x: p.x, z: p.z, r: 4 }); }
  }

  // the shrines' stone, clay, wood and cloth: a mesh each for the four (small, drawn and culled together)
  for (const [k, mat, collide] of [['stone', stoneMat, true], ['clay', clayMat, false], ['wood', wood, false], ['red', clothRed, false], ['cream', clothCream, false]]) {
    if (!shrineParts[k].length) continue;
    const m = new THREE.Mesh(mergeGeometries(shrineParts[k].map(flat)), mat);
    m.name = `The giants’ shrines (${k})`;
    if (!collide) m.userData.noCollide = true;
    group.add(m);
  }
  scene.add(group);
  const sights = [
    { name: 'the giant’s hand', at: giants.hand.shrine.stand }, { name: 'the giant’s arm over the dry wash', at: giants.arm.shrine.stand },
    { name: 'the giant’s spine', at: giants.spine.shrine.stand }, { name: 'the giant’s jaw', at: giants.jaw.shrine.stand },
  ];
  return { group, giants, shrines, clear, sights, avoid: (x, z, r = 0) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) };
}
