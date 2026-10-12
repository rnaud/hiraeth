import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { jitter } from './world.js';
import { mulberry32 } from './noise.js';

// Where the stones fall up (issue #187, the author's pick "falling-up": references/levels/Vael/environment/explorations/):
// toward the cliff east of the riders' gate the plain is coming apart. First cracks in the ground, then slabs tipped
// up out of it, then slabs a metre over it at the lip, then whole tables of the plain hanging over the cloud, their
// needles still standing on them and roots of rock trailing below, a step of stones climbing out from the edge to the
// highest stone (CHAIN), where a rider's rope hangs from an iron ring: the plain and the sky stones one slope from the
// ground to the sky. Three of the stones rise while you stand still on them (RISERS: Vael's patience; each a moving
// collider, physics.addMover, that carries you: src/carriers.js), and sink back slowly when you have left. Loose
// pebbles drift up off the rims. Two more tables of the plain hang off the edge further west, on the bird's way home.
//
//   CRACKS, TILTED, CHAIN, RISERS, TABLES  (world coordinates; no rng but the scatter's own)
//   buildFallingUp(scene, terrain) → { slabs: [{ at, top, r }], risers: [{ piece, rest, up, top(), on }], high: { at, look, stand },
//                                       broken: { at, look, stand }, tables, init(physics), update(dt, t, player) }

/** The cracks in the plain toward the edge: [x0, z0, x1, z1] (world), drawn in the ground's dark ink. */
export const CRACKS = [[-60, -1074, -30, -999], [-30, -999, -8, -964], [-8, -964, 6, -949], [-30, -999, 12, -1004], [12, -1004, 40, -974], [40, -974, 30, -954], [-90, -1024, -55, -1004], [-55, -1004, -30, -999], [-8, -964, -26, -954], [6, -1054, 12, -1004], [-120, -994, -95, -964], [60, -1024, 40, -974]];
/** The slabs tipped out of the plain before the lip: [x, z, half width, half length, yaw, tilt (rad), lift (m)]. */
export const TILTED = [[-24, -1026, 5, 7, 0.4, 0.16, 0.4], [6, -998, 6, 4.5, -0.5, 0.22, 0.6], [26, -976, 4.5, 6, 1.1, 0.27, 0.8], [-12, -976, 5.5, 5, 0.9, 0.3, 1], [14, -958, 4, 4.5, 0.2, 0.12, 1.4], [-6, -957, 3.6, 4, -0.3, 0.08, 1.9]];
/** The gap between one stone of the step and the next (m): a running jump and a second in the air, the wings after. */
export const GAP = 3.2;
/**
 * The step of stones out over the cloud, [x, z, radius, top] (the last is the highest stone): the first hangs a metre
 * over the lip, the rest laid out from it GAP apart, each on its bearing (rad, from +z) from the one before.
 */
export const CHAIN = ((x, z, list) => list.map(([r, top, a], i) => {
  if (i) { const [px, pz, pr] = [x, z, list[i - 1][0]], d = pr + r + GAP; x = px + Math.sin(a) * d; z = pz + Math.cos(a) * d; }
  return [+x.toFixed(1), +z.toFixed(1), r, top];
}))(-8, -945, [[8, 26], [8.5, 27.5, -0.35], [7.5, 29.5, -0.45], [9, 40, 0.24], [8, 41.5, -0.4], [9.5, 43, 0.12], [8.5, 53.5, -0.46], [9, 55, 0.16], [8, 56.5, -0.34], [13, 68, 0.11]]);
/** The stones that rise while you stand on them: their index in CHAIN, and how far up (m). */
export const RISERS = [{ i: 2, up: 9 }, { i: 5, up: 9 }, { i: 8, up: 10 }];
/** How fast a riser lifts, and sinks back once left (m/s); how long it waits before sinking (s). */
export const RISE = { up: 0.8, down: 0.5, wait: 6 };
/** Whole tables of the plain hanging off the edge further west: [x, z, radius, top]. */
export const TABLES = [[-176, -818, 16, 52], [-120, -940, 11, 34]];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

/**
 * A slab of the plain, its top at y 0: { top: the flat top (the plain's peach), under: its broken sides, the rock
 * under it and the roots of rock trailing down (red-brown) }. r its radius, thick its sides' depth.
 */
function slabGeometry(r, thick, seed) {
  const rng = mulberry32(seed), n = 11, pts = [];
  for (let i = 0; i < n; i++) { const a = ((i + rng() * 0.6) / n) * Math.PI * 2, k = r * (i % 3 === 1 ? 0.74 + rng() * 0.12 : 0.9 + rng() * 0.18); pts.push(new THREE.Vector2(Math.cos(a) * k, Math.sin(a) * k)); }   // (a broken outline: every third corner bitten in)
  const shape = new THREE.Shape(pts);
  // (ShapeGeometry lies in xy facing +z: turned to lie flat, facing up; the shape's y becomes -z)
  const top = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const sides = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -thick - 0.03, 0);
  const under = [sides];
  // under it: the plain's rock broken off in a shallow, ragged cone, and roots of rock trailing down
  const deep = r * 0.32 + 1.6, rock = new THREE.ConeGeometry(r * 0.9, deep, 11, 3).rotateX(Math.PI).translate(0, -thick - deep / 2 + 0.3, 0);
  jitter(rock, 0.3, 0.06, seed * 0.37);
  under.push(rock);
  for (let k = 0; k < 5; k++) {
    const a = rng() * Math.PI * 2, d = r * (0.2 + rng() * 0.5), L = 3 + r * (0.4 + rng() * 0.8);
    const g = new THREE.ConeGeometry(0.25 + rng() * 0.35, L, 5, 2).rotateX(Math.PI).translate(Math.cos(a) * d, -thick - L / 2 - r * 0.25, Math.sin(a) * d);
    jitter(g, 0.2, 0.05, seed + k);
    under.push(g);
  }
  return { top: [flat0(top)], under: under.map(flat0) };
}

export function buildFallingUp(scene, terrain) {
  const H = (x, z) => terrain.heightAt(x, z);
  const peach = makeMaterial({ color: '#eda584', color2: '#f2b48f', color3: '#c97a5c', mode: MODE_STRATA, strataSize: 1.6, flat: true });
  const rose = makeMaterial({ color: '#c7735a', color2: '#d98a6c', color3: '#a65a46', mode: MODE_STRATA, strataSize: 1.8, flat: true });
  const bone = makeMaterial({ color: '#f4efe2', color2: '#e6dcc6', color3: '#d6c7a8', mode: MODE_STRATA, strataSize: 3, flat: true });
  const ink = makeMaterial({ color: '#8a5a48', flat: true });
  const iron = makeMaterial({ color: '#3c4660', flat: true });
  const rope = makeMaterial({ color: '#b89a6a', flat: true });

  // ---- the cracks: dark ribbons laid on the sand, wider toward the edge
  {
    const parts = [];
    for (const [x0, z0, x1, z1] of CRACKS) {
      const L = Math.hypot(x1 - x0, z1 - z0), k = Math.ceil(L / 3), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      const pos = [];
      for (let i = 0; i <= k; i++) {
        const t = i / k, x = x0 + (x1 - x0) * t + Math.sin(t * 9 + x0) * 0.8, z = z0 + (z1 - z0) * t + Math.cos(t * 7 + z0) * 0.8;
        const w = (0.18 + 0.55 * Math.max(0, Math.min(1, 1 - (-z - 950) / 130))) * (0.6 + 0.4 * Math.sin(t * 13));
        for (const s of [-1, 1]) { const px = x - uz * w * s, pz = z + ux * w * s; pos.push(px, H(px, pz) + 0.04, pz); }
      }
      const g = new THREE.BufferGeometry(), idx = [];
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      for (let i = 0; i < k; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      g.setIndex(idx); g.computeVertexNormals();
      parts.push(flat0(g));
    }
    const m = new THREE.Mesh(mergeGeometries(parts), ink);
    m.userData.noCollide = true; m.name = 'The cracks toward the edge';
    scene.add(m);
  }

  // ---- the slabs tipped up out of the plain (each its own block of the ground's stone, sunk at its low end)
  const tilted = [];
  {
    const parts = [];
    TILTED.forEach(([x, z, w, l, yaw, tilt, lift], i) => {
      const g = new THREE.BoxGeometry(w * 2, 2.6, l * 2, 2, 1, 2).translate(0, -1.3, 0);
      jitter(g, 0.12, 0.02, 90 + i);
      g.rotateX(-tilt).rotateY(yaw);
      // (its low edge sunk into the sand, the high edge lifted clear: set so its lowest corner is 0.5 m under the ground)
      g.computeBoundingBox();
      const y = H(x, z) + lift;
      parts.push(flat0(g).translate(x, y, z));
      tilted.push({ at: V(x, y, z), w, l });
    });
    const m = new THREE.Mesh(mergeGeometries(parts), peach);
    m.name = 'The slabs tipped out of the plain';
    scene.add(m);
  }

  // ---- the step of stones over the cloud, and the tables further west
  const slabs = [], risers = [], dressing = [], ropes = [], ironParts = [];
  const solid = [], solidUnder = [];
  const holder = new THREE.Group();
  holder.name = 'The rising stones'; holder.userData.noCollide = true;   // (moving colliders of their own: init)
  scene.add(holder);
  CHAIN.forEach(([x, z, r, top], i) => {
    const thick = 2.2 + r * 0.12, geo = slabGeometry(r, thick, 300 + i * 17);
    const extra = [];
    // what still stands on them: a needle on some, a little arch on the highest, a hoodoo stalk on another
    if (i === 3 || i === 6) { const h = 9 + i, g = new THREE.CylinderGeometry(0.35, 1.6, h, 8, 6).translate(r * 0.4, h / 2 - 0.3, -r * 0.3); jitter(g, 0.14, 0.03, i); extra.push(flat0(g)); }
    if (i === CHAIN.length - 1) {
      const lean = new THREE.CylinderGeometry(0.5, 2.6, 22, 9, 8).translate(0, 11, 0).rotateZ(-0.55).translate(r * 0.45, -0.3, r * 0.15);
      jitter(lean, 0.12, 0.03, 77);
      const arch = new THREE.TorusGeometry(1.8, 0.4, 6, 14, Math.PI).translate(-r * 0.5, -0.1, -r * 0.3);
      extra.push(flat0(lean), flat0(arch));
    }
    const riser = RISERS.find((q) => q.i === i);
    if (riser) {
      const piece = new THREE.Group();
      piece.position.set(x, top, z);
      const m = new THREE.Mesh(mergeGeometries(geo.top), peach); m.name = `A rising stone (${risers.length + 1})`;
      piece.add(m, new THREE.Mesh(mergeGeometries(geo.under), rose));
      holder.add(piece);
      risers.push({ piece, rest: top, up: riser.up, h: 0, wait: 0, on: false, r, x, z, i, collider: null });
    } else {
      for (const g of geo.top) solid.push(g.clone().translate(x, top, z));
      for (const g of geo.under) solidUnder.push(g.clone().translate(x, top, z));
      for (const g of extra) dressing.push(g.clone().translate(x, top, z));
    }
    slabs.push({ at: V(x, top, z), top, r, i, riser: !!riser });
  });
  const chainMesh = new THREE.Mesh(mergeGeometries(solid), peach);
  chainMesh.name = 'The stones that fell up';    // (stood on, so not marked floats: the contact audit checks them as drawn)
  const chainUnder = new THREE.Mesh(mergeGeometries(solidUnder), rose);
  chainUnder.name = 'The stones that fell up: their broken sides';
  scene.add(chainMesh, chainUnder);
  const dressMesh = new THREE.Mesh(mergeGeometries(dressing), bone);
  dressMesh.name = 'The stones that fell up: their needles';
  scene.add(dressMesh);
  // the tables of the plain off the edge further west: big, slow, their own needles on them
  const tableParts = [], tableTops = [], tableNeedles = [], tables = [];
  TABLES.forEach(([x, z, r, top], i) => {
    const geo = slabGeometry(r, 4 + r * 0.1, 700 + i * 31);
    for (const g of geo.top) tableTops.push(g.translate(x, top, z));
    for (const g of geo.under) tableParts.push(g.translate(x, top, z));
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i, d = r * (0.25 + 0.2 * k), h = 14 + k * 9 + i * 4;
      const g = new THREE.CylinderGeometry(0.4 + k * 0.1, 1.8 + k * 0.5, h, 8, 6).translate(Math.cos(a) * d, h / 2 - 0.3, Math.sin(a) * d);
      jitter(g, 0.15, 0.03, 120 + i * 7 + k);
      tableNeedles.push(flat0(g).translate(x, top, z));
    }
    tables.push({ at: V(x, top, z), r });
  });
  const tableMesh = new THREE.Mesh(mergeGeometries(tableParts), rose);
  tableMesh.name = 'The tables of the plain over the cloud';
  const tableTopMesh = new THREE.Mesh(mergeGeometries(tableTops), peach);
  const tableNeedleMesh = new THREE.Mesh(mergeGeometries(tableNeedles), bone);
  scene.add(tableMesh, tableTopMesh, tableNeedleMesh);

  // ---- the highest stone: an iron ring set in it, a frayed rider's rope from it down over the edge toward the cloud
  const last = CHAIN[CHAIN.length - 1], [lx, lz, lr, ly] = last;
  const toward = V(-8 - lx, 0, -950 - lz).normalize();   // (the plain, behind you)
  const ringAt = V(lx, ly, lz).addScaledVector(toward, lr * 0.78);
  ironParts.push(flat0(new THREE.TorusGeometry(0.35, 0.07, 6, 14).rotateY(Math.atan2(toward.x, toward.z)).translate(ringAt.x, ringAt.y + 0.3, ringAt.z)));
  ironParts.push(flat0(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 6).translate(ringAt.x, ringAt.y + 0.05, ringAt.z)));
  const ropeCurve = new THREE.CatmullRomCurve3([ringAt.clone().add(V(0, 0.25, 0)), ringAt.clone().addScaledVector(toward, 1.2).add(V(0, -0.3, 0)), ringAt.clone().addScaledVector(toward, 1.6).add(V(0, -3, 0)), ringAt.clone().addScaledVector(toward, 1.5).add(V(0.3, -7, 0))]);
  ropes.push(flat0(new THREE.TubeGeometry(ropeCurve, 24, 0.07, 5)));
  const ironMesh = new THREE.Mesh(mergeGeometries(ironParts), iron); ironMesh.name = 'The rider’s iron ring';   // (solid: a ring you would trip on)
  const ropeMesh = new THREE.Mesh(mergeGeometries(ropes), rope); ropeMesh.userData.noCollide = true; ropeMesh.name = 'The rider’s rope';
  scene.add(ironMesh, ropeMesh);

  // ---- loose pebbles drifting up off the stones' rims, over and over
  const N = 90, rngP = mulberry32(4471), pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0), peach, N), seeds = [];
  pebbles.userData.noCollide = true; pebbles.frustumCulled = false; pebbles.name = 'Pebbles falling up';
  for (let k = 0; k < N; k++) {
    const s = CHAIN[k % CHAIN.length], a = rngP() * Math.PI * 2;
    seeds.push({ x: s[0] + Math.cos(a) * s[2] * 0.95, z: s[1] + Math.sin(a) * s[2] * 0.95, y0: s[3] - 6 - rngP() * 10, span: 10 + rngP() * 12, speed: 0.25 + rngP() * 0.35, ph: rngP(), sc: 0.5 + rngP() * 1.4 });
  }
  scene.add(pebbles);
  const dummy = new THREE.Object3D();

  const high = slabs[slabs.length - 1];
  const highStand = ringAt.clone().addScaledVector(toward, -1.6);
  const brokenAt = tilted[0].at;
  const result = {
    slabs, risers, tables,
    high: { at: V(high.at.x, high.top, high.at.z), look: ringAt.clone().add(V(0, 0.4, 0)), stand: V(highStand.x, ly, highStand.z) },
    broken: { at: V(brokenAt.x, H(brokenAt.x, brokenAt.z), brokenAt.z), look: brokenAt.clone().add(V(0, 1.2, 0)), stand: V(brokenAt.x - 7, H(brokenAt.x - 7, brokenAt.z - 5), brokenAt.z - 5) },
    /** The rising stones as moving colliders (the level's init). */
    init(physics) { for (const q of risers) q.collider = physics.addMover?.(q.piece) ?? null; },
    /** The rising stones lift under whoever stands still on them, and sink back once left; the pebbles drift up. */
    update(dt, t, player) {
      for (const q of risers) {
        const p = player?.pos, top = q.rest + q.h;
        q.on = !!p && player.onGround && Math.hypot(p.x - q.x, p.z - q.z) < q.r * 0.95 && Math.abs(p.y - top) < 1.2;
        if (q.on) { q.wait = RISE.wait; q.h = Math.min(q.up, q.h + RISE.up * dt); } else if ((q.wait -= dt) <= 0) q.h = Math.max(0, q.h - RISE.down * dt);
        q.piece.position.y = q.rest + q.h;
      }
      for (let k = 0; k < N; k++) {
        const s = seeds[k], u = (t * s.speed / s.span + s.ph) % 1;
        dummy.position.set(s.x, s.y0 + u * s.span, s.z); dummy.rotation.set(t * 0.3 + k, k, 0); dummy.scale.setScalar(s.sc * Math.min(1, u * 6, (1 - u) * 6)); dummy.updateMatrix();
        pebbles.setMatrixAt(k, dummy.matrix);
      }
      pebbles.instanceMatrix.needsUpdate = true;
    },
  };
  return result;
}
