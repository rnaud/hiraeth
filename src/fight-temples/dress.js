// A fight temple's world, round its rooms (issue #341): the pillars in the world's own shape, and the things standing
// round the hall that say where it is. Everything here is out of the level's bake (noCollide) but the pillars (their
// colliders are the rooms', rooms.js), and stands only on the far side of the walls from the camera (rules.js ISO: what
// stood on its side would hide him), or below the rooms (Vael's cloud).
//
//   pillar 'column' (the desert's)  a round column and a square cap
//          'stack'  (Lorn's mill)    three millstones stacked, a timber cap
//          'post'   (the Foundry)    a square iron post, a brass band, a cap
//          'pipe'   (Viridel's vault) a boiler pipe: a slim column in bands, a valve wheel
//          'crate'  (the market)      a stack of two crates, the top one turned
//          'chimney' (the Kiln Yard)  a kiln chimney: a tapering stack, its mouth glowing
//          'tree'   (the Orchard)     a tree: its trunk, a round crown for its cap
//          'drum'   (the Oil Exchange) two oil drums stacked, banded
//   dress  'cloister'  (Vael)        the sea of cloud far under the cliff, the riders' pennant poles, broken arches
//          'mill'      (Lorn)        reed beds on the banks, the great wheel, sluice posts
//          'foundry'   (the Foundry) crucibles on the banks, hoist frames, cooling slag
//          'greenhouse' (Viridel)    the greenhouse's glass ribs over the cellars, potted trees
//          'shaft'     (the City-Shaft) the shaft's far wall of lit windows, crane jibs over the bays
//          'teeth'     (the Buried Machine) the canyon's teeth round the gear-house, a great gear
//          'market'    (the Signal Market) the shops' neon signs on poles, awnings
//          'deep'      (the Underwater City) the domes' white ribs, kelp, bubbles rising
//          'kiln'      (the Glass Dunes) chimneys and glass shards on the dunes round the sheds
//          'orchard'   (the Garden of Spheres) rows of trees beyond the walls, spheres on their stands
//          'islands'   (the City Floating in Space) the rock under the depot, cables strung off it, lamps

import * as THREE from 'three';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { ISO } from './rules.js';
import { outside, hallHeight } from './rooms.js';

/** A pillar of the world's shape, `h` tall, standing at the origin (its materials the rooms', seen through with it). */
export function pillarModel(kind = 'column', h, mat, capMat) {
  let m;
  if (kind === 'stack') {
    // three millstones, a little turned on one another, a beam across the top
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.92, h * 0.34, 14).translate(0, h * 0.17, 0), mat);
    for (let i = 1; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.86 - i * 0.04, 0.9 - i * 0.04, h * 0.3, 14).translate(0, h * (0.34 + (i - 1) * 0.33) + h * 0.15, 0), mat);
      d.rotation.y = i * 0.6; d.userData.noCollide = true; m.add(d);
    }
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 0.5).translate(0, h + 0.14, 0), capMat); c.userData.noCollide = true; m.add(c);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 2.1).translate(0, h + 0.14, 0), capMat); c2.userData.noCollide = true; m.add(c2);
    return m;
  }
  if (kind === 'pipe') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, h, 12).translate(0, h / 2, 0), mat);
    for (const y of [0.4, h * 0.4, h * 0.8]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.18, 12).translate(0, y, 0), capMat); b.userData.noCollide = true; m.add(b); }
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 5, 14), capMat); w.position.set(0, h * 0.6, 0.62); w.userData.noCollide = true; m.add(w);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.3, 12).translate(0, h + 0.15, 0), capMat); c.userData.noCollide = true; m.add(c);
    return m;
  }
  if (kind === 'chimney') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, h, 10).translate(0, h / 2, 0), mat);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.22, 10).translate(0, h * 0.55, 0), capMat); b.userData.noCollide = true; m.add(b);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.68, 0.35, 10).translate(0, h + 0.17, 0), capMat); c.userData.noCollide = true; m.add(c);
    return m;
  }
  if (kind === 'tree') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, h, 8).translate(0, h / 2, 0), mat);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1).translate(0, h + 0.6, 0), capMat); c.userData.noCollide = true; m.add(c);
    return m;
  }
  if (kind === 'drum') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, h * 0.5, 14).translate(0, h * 0.25, 0), mat);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, h * 0.46, 14).translate(0, h * 0.74, 0), mat); t.userData.noCollide = true; m.add(t);
    for (const y of [h * 0.1, h * 0.4, h * 0.6, h * 0.9]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.1, 14).translate(0, y, 0), capMat); b.userData.noCollide = true; m.add(b); }
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.12, 14).translate(0, h + 0.06, 0), capMat); c.userData.noCollide = true; m.add(c);
    return m;
  }
  if (kind === 'crate') {
    m = new THREE.Mesh(new THREE.BoxGeometry(1.7, h * 0.5, 1.7).translate(0, h * 0.25, 0), mat);
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.5, h * 0.45, 1.5).translate(0, h * 0.725, 0), mat); t.rotation.y = 0.5; t.userData.noCollide = true; m.add(t);
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.14, 1.56).translate(0, h * 0.96, 0), capMat); c.rotation.y = 0.5; c.userData.noCollide = true; m.add(c);
    return m;
  }
  if (kind === 'post') {
    m = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 1.3).translate(0, h / 2, 0), mat);
    for (const y of [0.25, h * 0.62]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 1.5).translate(0, y, 0), capMat); b.userData.noCollide = true; m.add(b); }
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 1.9).translate(0, h + 0.15, 0), capMat); c.userData.noCollide = true; m.add(c);
    return m;
  }
  m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, h, 10).translate(0, h / 2, 0), mat);
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 1.9).translate(0, h + 0.15, 0), capMat); c.userData.noCollide = true; m.add(c);
  return m;
}

/** A small seeded random (the dressing the same every run). */
function seeded(seed = 7) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/**
 * Spots round the hall, `from`–`to` m out from the rooms, on the far side from the camera only (the way out from the
 * rooms facing away from it), at least `apart` m from one another: [x, z, the way out's angle].
 */
export function farSpots(def, n, { from = 3, to = 12, apart = 4, seed = 7 } = {}) {
  const rng = seeded(seed), out = [];
  const xs = def.rooms.flatMap((r) => r.x), zs = def.rooms.flatMap((r) => r.z);
  const box = [Math.min(...xs) - to, Math.max(...xs) + to, Math.min(...zs) - to, Math.max(...zs) + to];
  const cx = Math.sin(ISO.yaw), cz = Math.cos(ISO.yaw);
  for (let tries = 0; out.length < n && tries < n * 200; tries++) {
    const x = box[0] + rng() * (box[1] - box[0]), z = box[2] + rng() * (box[3] - box[2]);
    const o = outside(def, x, z);
    if (o.d < from || o.d > to || o.nx * cx + o.nz * cz > -0.35) continue;
    // (nor between any room and the camera: a few metres on toward the far side, a room would be behind it)
    let before = false;
    for (let k = 1; k <= 16 && !before; k += 1.5) before = def.rooms.some((r) => x - cx * k > r.x[0] - 1 && x - cx * k < r.x[1] + 1 && z - cz * k > r.z[0] - 1 && z - cz * k < r.z[1] + 1);
    if (before) continue;
    if (out.some(([a, b]) => Math.hypot(a - x, b - z) < apart)) continue;
    out.push([x, z, Math.atan2(o.nx, o.nz)]);
  }
  return out;
}

const own = (o) => { const m = makeMaterial(o); return m; };
const put = (group, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.traverse((o) => { o.userData.noCollide = true; }); group.add(mesh); return mesh; };

/** The world's things round the hall (def.dress), added to `group`. */
export function dressHall(group, def, terrain) {
  const P = def.palette, D = DRESS[def.dress];
  if (!D) return;
  const ground = (x, z) => terrain?.heightAt?.(x, z) ?? hallHeight(def, x, z);
  D(group, def, P, ground);
}

const DRESS = {
  // the Underwater City: the domes' white ribs over the halls, kelp on the sea floor round them, bubbles rising
  deep(group, def, P, ground) {
    const white = own({ color: '#f2f6f4', flat: true }), kelp = own({ color: '#3f8a6a', color2: '#5aa880', flat: true }), bubble = own({ color: '#e8fbff', flat: true, glow: 0.5 });
    for (const [i, [x, z, a]] of farSpots(def, 6, { from: 2.5, to: 4, apart: 7, seed: 71 }).entries()) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.16, 5, 20, Math.PI), white); rib.rotation.y = a + Math.PI / 2 + (i % 2) * 0.15;
      put(group, rib, x, ground(x, z), z);
    }
    for (const [i, [x, z]] of farSpots(def, 24, { from: 3, to: 13, apart: 2.4, seed: 73 }).entries()) {
      const h = 2.5 + (i % 4) * 1.1, g = new THREE.Group();
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 4).translate(0, h / 2, 0), kelp); b.position.set((k - 1) * 0.25, 0, (k % 2) * 0.2); b.rotation.z = (k - 1) * 0.12; g.add(b); }
      if (i % 3 === 0) for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.08 + k * 0.03, 6, 5), bubble); s.position.set(0.3, h + 0.6 + k * 0.9, 0); g.add(s); }
      put(group, g, x, ground(x, z), z);
    }
  },
  // the Glass Dunes: kiln chimneys behind the sheds, glass shards standing in the dunes
  kiln(group, def, P, ground) {
    const brick = own({ color: P.wall, color2: P.wall2, color3: P.wall3, mode: MODE_STRATA, strataSize: 0.6 }), mouth = own({ color: P.slag ?? P.glyph, flat: true, glow: 0.9 });
    const glass = [own({ color: '#bfe8dc', flat: true, glow: 0.2 }), own({ color: '#e8d48a', flat: true, glow: 0.2 }), own({ color: '#9ad0e8', flat: true, glow: 0.2 })];
    for (const [i, [x, z]] of farSpots(def, 5, { from: 3.5, to: 8, apart: 9, seed: 81 }).entries()) {
      const h = 8 + (i % 3) * 2, g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, h, 10).translate(0, h / 2, 0), brick));
      g.add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 10).rotateX(-Math.PI / 2).translate(0, h + 0.01, 0), mouth));
      put(group, g, x, ground(x, z), z);
    }
    for (const [i, [x, z]] of farSpots(def, 16, { from: 3, to: 13, apart: 3, seed: 83 }).entries()) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 + (i % 3) * 0.35, 0), glass[i % 3]); m.scale.set(0.5, 1.6, 0.5); m.rotation.set(0.2 * (i % 3), i, 0.25);
      put(group, m, x, ground(x, z) + 0.6, z);
    }
  },
  // the Garden of Spheres: rows of trees beyond the garden walls, the spheres on their stands
  orchard(group, def, P, ground) {
    const bark = own({ color: '#6a5a4a', flat: true }), leaf = own({ color: '#6a9a5a', color2: '#8ab86a', flat: true }), sphere = own({ color: '#f4f0e6', flat: true, glow: 0.25 }), stand = own({ color: P.cap, flat: true });
    for (const [i, [x, z]] of farSpots(def, 18, { from: 2.6, to: 12, apart: 3.6, seed: 91 }).entries()) {
      const g = new THREE.Group(), h = 2.4 + (i % 3) * 0.6;
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, h, 6).translate(0, h / 2, 0), bark));
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + (i % 2) * 0.3, 1).translate(0, h + 0.7, 0), leaf));
      put(group, g, x, ground(x, z), z);
    }
    for (const [x, z] of farSpots(def, 4, { from: 5, to: 12, apart: 12, seed: 93 })) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 4, 6).translate(0, 2, 0), stand));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12).translate(0, 5.4, 0), sphere));
      put(group, g, x, ground(x, z), z);
    }
  },
  // the City Floating in Space: the rock the depot stands on, cables strung off its edge, lamps on posts
  islands(group, def, P, ground) {
    const rock = own({ color: '#8a7a6a', color2: '#a89888', color3: '#5a4e44', mode: MODE_STRATA, strataSize: 1.6 }), cable = own({ color: P.ink, flat: true }), lamp = own({ color: P.glyph, flat: true, glow: 0.95 });
    const xs = def.rooms.flatMap((r) => r.x), zs = def.rooms.flatMap((r) => r.z), mx = (Math.min(...xs) + Math.max(...xs)) / 2, mz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const under = new THREE.Mesh(new THREE.ConeGeometry(34, 40, 9).rotateX(Math.PI), rock); put(group, under, mx, -36 - 20, mz);
    for (const [i, [x, z, a]] of farSpots(def, 6, { from: 2.4, to: 3.2, apart: 9, seed: 95 }).entries()) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 6).translate(0, 2, 0), cable));
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), lamp); l.position.y = 4.1; g.add(l);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 30, 4).rotateZ(Math.PI / 2 - 0.25).translate(15, 1, 0), cable); g.add(c);
      g.rotation.y = a - Math.PI / 2 + (i % 2) * 0.3;
      put(group, g, x, ground(x, z), z);
    }
  },
  // Viridel: the Builders' greenhouse over its cellars, its white ribs, potted trees on the banks
  greenhouse(group, def, P, ground) {
    const white = own({ color: '#f4f2ea', flat: true }), glass = own({ color: '#cfe8d8', flat: true, glow: 0.2 });
    const leaf = own({ color: '#6aa85a', color2: '#8cc46a', flat: true }), pot = own({ color: P.cap, flat: true });
    for (const [i, [x, z, a]] of farSpots(def, 6, { from: 2.5, to: 4, apart: 6, seed: 31 }).entries()) {
      const g = new THREE.Group();
      const rib = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 5, 18, Math.PI), white); rib.position.y = 0.2; g.add(rib);
      const pane = new THREE.Mesh(new THREE.CircleGeometry(3.1, 18, 0, Math.PI), glass); pane.position.set(0, 0.2, -0.05); g.add(pane);
      g.rotation.y = a + Math.PI / 2 + (i % 2) * 0.2;
      put(group, g, x, ground(x, z), z);
    }
    for (const [x, z] of farSpots(def, 10, { from: 3, to: 10, apart: 4, seed: 37 })) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.7, 10).translate(0, 0.35, 0), pot));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5).translate(0, 1.4, 0), pot));
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 2.4, 0), leaf));
      put(group, g, x, ground(x, z), z);
    }
  },
  // the City-Shaft: the shaft's far wall of lit windows round the depot, crane jibs over it
  shaft(group, def, P, ground) {
    const wall = own({ color: P.wall3, color2: P.wall2 }), lit = own({ color: '#ffe8a0', flat: true, glow: 0.85 }), iron = own({ color: P.ink, flat: true }), cab = own({ color: P.cap, flat: true });
    for (const [i, [x, z, a]] of farSpots(def, 9, { from: 6, to: 14, apart: 7, seed: 41 }).entries()) {
      const h = 14 + (i % 4) * 5, g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(5, h, 4).translate(0, h / 2 - 20, 0), wall));
      for (let y = -16; y < h - 21; y += 2.6) for (const sx of [-1.4, 0, 1.4]) if ((Math.round(y) + i + sx * 3) % 3) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.1).translate(sx, y, 2.02), lit));
      g.rotation.y = a + Math.PI;
      put(group, g, x, 0, z);
    }
    for (const [x, z, a] of farSpots(def, 3, { from: 2.4, to: 3.4, apart: 14, seed: 43 })) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4).translate(0, 4.5, 0), iron));
      const jib = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 0.35).translate(2.6, 9, 0), iron); g.add(jib);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2).translate(5.6, 7.2, 0), cab));
      g.rotation.y = a + Math.PI;
      put(group, g, x, ground(x, z), z);
    }
  },
  // the Buried Machine: the canyon's teeth standing round the gear-house, one great gear half sunk
  teeth(group, def, P, ground) {
    const rock = own({ color: P.wall, color2: P.wall2, color3: P.wall3, mode: MODE_STRATA, strataSize: 1.4 }), brass = own({ color: P.cap, flat: true });
    for (const [i, [x, z]] of farSpots(def, 9, { from: 4, to: 13, apart: 6, seed: 51 }).entries()) {
      const h = 7 + (i % 3) * 3;
      put(group, new THREE.Mesh(new THREE.ConeGeometry(1.8 + (i % 2), h, 6).translate(0, h / 2, 0), rock), x, ground(x, z) - 0.3, z);
    }
    const [gx, gz, ga] = farSpots(def, 1, { from: 3, to: 4.5, apart: 1, seed: 53 })[0] ?? [0, -20, 0];
    const gear = new THREE.Group();
    gear.add(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.6, 24).rotateX(Math.PI / 2), brass));
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.6), brass); t.position.set(Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0); t.rotation.z = a; gear.add(t); }
    gear.rotation.y = ga + Math.PI / 2;
    put(group, gear, gx, ground(gx, gz) + 1.6, gz);
  },
  // the Signal Market: the shops' signs on poles behind the back rooms, lit; awnings
  market(group, def, P, ground) {
    const pole = own({ color: P.ink, flat: true });
    const neon = [own({ color: '#ff5fa2', flat: true, glow: 0.95 }), own({ color: '#62c3c9', flat: true, glow: 0.95 }), own({ color: '#ffd36a', flat: true, glow: 0.95 })];
    const awn = [own({ color: '#c94a6a', flat: true }), own({ color: '#3a8a9a', flat: true })];
    for (const [i, [x, z, a]] of farSpots(def, 10, { from: 2.4, to: 6, apart: 5, seed: 61 }).entries()) {
      const g = new THREE.Group(), h = 4.5 + (i % 3);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, h, 0.15).translate(0, h / 2, 0), pole));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.12).translate(0, h - 0.4, 0), neon[i % 3]));
      if (i % 2) { const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.4).translate(0, 2.6, 0.7), awn[i % 2 ? 0 : 1]); w.rotation.x = 0.2; g.add(w); }
      g.rotation.y = a + Math.PI;
      put(group, g, x, ground(x, z), z);
    }
  },
  // Vael: the court is on a cliff over the sea of cloud; the riders' pennants on the ledge, two arches left standing
  cloister(group, def, P, ground) {
    const cloud = own({ color: '#f6f4ee', flat: true, glow: 0.35 }), cloud2 = own({ color: '#e4e6ec', flat: true, glow: 0.2 });
    const rng = seeded(11);
    const xs = def.rooms.flatMap((r) => r.x), zs = def.rooms.flatMap((r) => r.z), mx = (Math.min(...xs) + Math.max(...xs)) / 2, mz = (Math.min(...zs) + Math.max(...zs)) / 2;
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, r = 30 + rng() * 55, R = 7 + rng() * 14;
      const m = new THREE.Mesh(new THREE.CircleGeometry(R, 20).rotateX(-Math.PI / 2), i % 3 ? cloud : cloud2);
      m.scale.set(1, 1, 0.55 + rng() * 0.4);
      put(group, m, mx + Math.cos(a) * r, -24 - rng() * 6, mz + Math.sin(a) * r);
    }
    const stone = own({ color: P.wall, color2: P.wall2, color3: P.wall3, mode: MODE_STRATA, strataSize: 0.9 });
    const pole = own({ color: P.cap, flat: true }), cloth = [own({ color: P.glyph, flat: true, glow: 0.3 }), own({ color: '#f4efe2', flat: true }), own({ color: '#c94a3a', flat: true })];
    for (const [i, [x, z, a]] of farSpots(def, 9, { from: 2.2, to: 3.4, apart: 7, seed: 5 }).entries()) {
      const y = ground(x, z), g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6.5, 6).translate(0, 3.25, 0), pole));
      // a long streamer down the wind, three narrow bands
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6 - k * 0.6, 0.18, 0.03).translate(1.3 - k * 0.3, 6.1 - k * 0.22, 0), cloth[(i + k) % 3]); g.add(b); }
      g.rotation.y = 0.9 + (i % 3) * 0.15;
      put(group, g, x, y, z);
    }
    for (const [x, z, a] of farSpots(def, 2, { from: 2.4, to: 3.2, apart: 20, seed: 3 })) {
      const g = new THREE.Group();
      for (const s of [-1, 1]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.6, 0.7).translate(s * 1.6, 2.3, 0), stone));
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 6, 14, Math.PI), stone); arch.position.y = 4.6; g.add(arch);
      g.rotation.y = a + Math.PI / 2;
      put(group, g, x, ground(x, z), z);
    }
  },
  // Lorn: the mill stands in its race; reeds on the banks, the great wheel turning no more, sluice posts
  mill(group, def, P, ground) {
    const reed = own({ color: '#7e9a52', color2: '#a3b86a', flat: true }), head = own({ color: '#6a4a33', flat: true });
    const rng = seeded(21);
    for (const [x, z] of farSpots(def, 40, { from: 2.5, to: 14, apart: 2.2, seed: 9 })) {
      const g = new THREE.Group();
      for (let k = 0; k < 7; k++) {
        const h = 1.2 + rng() * 1.4, a = rng() * Math.PI * 2, r = rng() * 0.7;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, h, 4).translate(0, h / 2, 0), reed);
        b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); b.rotation.z = (rng() - 0.5) * 0.3; g.add(b);
        if (k % 3 === 0) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 5), head); c.position.set(b.position.x, h - 0.1, b.position.z); g.add(c); }
      }
      put(group, g, x, ground(x, z), z);
    }
    const timber = own({ color: P.cap, color2: P.wall3, color3: '#4e3a2a', mode: MODE_STRATA, strataSize: 0.4 });
    const [wx, wz, wa] = farSpots(def, 1, { from: 3.2, to: 4.2, apart: 1, seed: 4 })[0] ?? [0, -20, 0];
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.22, 6, 28), timber));
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 5, 24), timber));
    for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 7.2, 0.18), timber); s.rotation.z = (k / 8) * Math.PI; wheel.add(s); }
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.1), timber); b.position.set(Math.cos(a) * 3.7, Math.sin(a) * 3.7, 0); b.rotation.z = a; wheel.add(b); }
    wheel.rotation.y = wa + Math.PI / 2;
    put(group, wheel, wx, ground(wx, wz) + 2.4, wz);
    for (const [x, z] of farSpots(def, 8, { from: 2.2, to: 3, apart: 6, seed: 13 })) put(group, new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 0.4).translate(0, 1.3, 0), timber), x, ground(x, z), z);
  },
  // the Moon Foundry: the casting floor's crucibles on the banks, the hoist frames over them, slag cooling in the dust
  foundry(group, def, P, ground) {
    const ivory = own({ color: P.wall, color2: P.wall2, color3: P.wall3, mode: MODE_STRATA, strataSize: 0.7 });
    const brass = own({ color: P.cap, flat: true }), slag = own({ color: P.slag ?? P.glyph, flat: true, glow: 0.9 }), crust = own({ color: P.crust ?? '#6a5a50', flat: true });
    for (const [i, [x, z]] of farSpots(def, 7, { from: 3, to: 9, apart: 7, seed: 17 }).entries()) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.0, 2.2, 14).translate(0, 1.1, 0), ivory));
      const lip = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.14, 5, 20).rotateX(Math.PI / 2), brass); lip.position.y = 2.2; g.add(lip);
      const brew = new THREE.Mesh(new THREE.CircleGeometry(1.32, 18).rotateX(-Math.PI / 2), i % 2 ? slag : crust); brew.position.y = 2.1; g.add(brew);
      if (i % 2 === 0) {
        // a hoist frame over it, its chain down to the pot's lugs
        for (const s of [-1, 1]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.8, 0.25).translate(s * 2.2, 2.9, 0), brass));
        g.add(new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 0.3).translate(0, 5.8, 0), brass));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4).translate(0, 4.0, 0), brass));
      }
      put(group, g, x, ground(x, z), z);
    }
    for (const [x, z] of farSpots(def, 10, { from: 2.5, to: 12, apart: 4, seed: 23 })) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.6 + (Math.abs(x * 7 + z) % 1) * 0.9, 12).rotateX(-Math.PI / 2), (Math.round(x + z) % 3) ? crust : slag);
      put(group, m, x, ground(x, z) + 0.06, z);
    }
  },
};
