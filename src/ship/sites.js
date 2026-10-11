import * as THREE from 'three';
import { LIFT, R } from './hull.js';

// Where the ship stands in each world. A level can define `shipSite`
// ({ x, z, heading }) itself; otherwise the table below; otherwise a clear,
// flat spot near the spawn is searched for (away from the people,
// the relics and the story goal). `heading` is the direction the hatch and
// its ramp face (a player heading: 0 = +z, PI/2 = +x).
//
// The desert is special: the forced landing of the prologue. The ship came
// in low from the south and lies half dug into the dune, upright, at the end of a
// long furrow (it slid toward Qanat and stopped short of it). Sand is heaped
// against its leading side; the hatch opens toward the city, so stepping out you
// see it, its walls whole and its great tree, across the dunes.

export const SITE_OVERRIDES = {
  desert: {
    // on the brow of the rise north of the old camp, on the line of the camps' lane to the gate (CAMP_WAY), where nothing hides the horizon: the hatch faces Qanat
    // (230, 400), so stepping out you see the city, its walls whole and its great tree, across the dunes, 210 m to
    // its gate (the author's playtest, issue #71: from (20, 120) the near dune hid the walls' lower 9 m, the city
    // 270 m off was a pale strip, and only the camps' huge smoke said where to go)
    x: 86, z: 149, heading: Math.atan2(230 - 86, 400 - 149),
    crash: {
      // the direction it was moving (heading): toward Qanat, a little west of the hatch's line, so its furrow runs back
      // behind the ship and to the right, out of the view from the ramp (it was -z, sliding away from the city, and
      // the furrow's ridge stood between the ramp and the city's walls: issue #71)
      travel: Math.atan2(230 - 86, 400 - 149) - 0.6,
      length: 52,         // the skid behind it (m): a forced landing on its belly, not a crash (it was 118 m)
      // it came to rest upright: a tilted hull tilts the deck, and walking it the traveller went up and down
      // (players: "the floor on the ship must be flat"). The skid, the heaped sand and the sink say "came down hard"
      pitch: 0,           // (rad: the cockpit side up)
      roll: 0,            // (rad: the hatch side down)
      sink: 6,            // how far below its parked height it is dug in (clamped so the deck stays clear of the sand)
    },
  },
  // the search's own pick crowded the pearl sphere, a listening spot of the main quest
  spheres: { x: 38, z: 81, heading: -2.7 },
  // where the search put the ship while it kept clear of the old stone gates (removed in v0.38):
  // without them it would pick other spots here, so these two stay where players know them
  bazaar: { x: 19.9, z: 150.9, heading: -2.835 },
  incal: { x: 331.1, z: -10.1, heading: -1.396 },
};

const TAU = Math.PI * 2;
const dirOf = (h) => [Math.sin(h), Math.cos(h)];

/** Everything the ship must keep clear of in a level: [{ x, z, r }]. */
export function siteAvoid({ level, content, npcs }) {
  const out = [];
  const add = (x, z, r) => { if (Number.isFinite(x) && Number.isFinite(z)) out.push({ x, z, r }); };
  for (const n of content?.npcs ?? []) add(n.at[0], n.at[1], 15);
  for (const n of npcs ?? []) if (n.pos) add(n.pos.x, n.pos.z, 12);
  const g = content?.story?.goal;
  if (g) add(g[0], g[2], (content.story.radius ?? 12) + 30);
  for (const s of content?.relics?.spots ?? []) {
    const p = Array.isArray(s) ? s : [s.at[0], s.at[2]];
    add(p[0], p[1], 17);
  }
  for (const p of level?.portals ?? []) add(p.at.x, p.at.z, 12);
  for (const v of level?.vehicles ?? []) if (v.pos) add(v.pos.x, v.pos.z, 14);
  if (level?.spawn) add(level.spawn.x, level.spawn.z, 17);
  // the reactive scenery's clusters (src/reactive-world.js seeds them along a line from the spawn)
  if (level?.spawn) {
    if (level.id === 'bazaar') for (let i = 0; i < 8; i++) add(i % 2 ? 23 : -23, 95 - i * 54, 9);
    else for (let i = 1; i <= 5; i++) add(level.spawn.x + (i % 2 ? 12 : -12) + 3, level.spawn.z - i * 30 - 6, 9);
  }
  return out;
}

/**
 * Scenery that doesn't collide (trees, crystals, columns drawn for looks)
 * still mustn't stand through the hull: circles round every sizeable
 * non-colliding mesh or instance near the ground.
 */
export function decorAvoid(scene, level, { near = null, reach = 260 } = {}) {
  const out = [];
  const skip = new Set([level.ground?.mesh].filter(Boolean));
  const s = new THREE.Sphere(), m = new THREE.Matrix4();
  const isOff = (o) => { for (let p = o; p; p = p.parent) if (p.userData.noCollide) return true; return false; };
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || skip.has(o) || o.isSkinnedMesh || !isOff(o) || !o.geometry?.attributes?.position) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const g = o.geometry.boundingSphere;
    if (!g || !Number.isFinite(g.radius)) return;
    const add = (mat) => {
      s.copy(g).applyMatrix4(mat);
      if (s.radius < 1.2 || s.radius > 60) return;
      if (near && Math.hypot(s.center.x - near.x, s.center.z - near.z) > reach) return;
      out.push({ x: s.center.x, z: s.center.z, r: s.radius * 0.8, y0: s.center.y - s.radius, y1: s.center.y + s.radius });
    };
    if (o.isInstancedMesh) {
      if (g.radius < 1.2 && o.count > 50) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); add(m.premultiply(o.matrixWorld)); }
    } else add(o.matrixWorld);
  });
  return out;
}

/**
 * How well the ship fits at (x, z): the ground under its feet, hull and ramp.
 * Returns null if it doesn't fit, else { ground, spread, ... }.
 */
export function probeSite(physics, x, z, heading, { refY = 0, tolerance = 2.6, unsafe = null } = {}) {
  const from = refY + 60;
  const G = (px, pz) => physics.groundAt(px, from, pz, 400);
  const pts = [[0, 0]];
  for (const [r, n] of [[4, 6], [8, 10], [12, 14], [15.5, 16]]) for (let k = 0; k < n; k++) { const a = (k / n) * TAU + r; pts.push([Math.sin(a) * r, Math.cos(a) * r]); }
  let lo = Infinity, hi = -Infinity;
  for (const [dx, dz] of pts) {
    const g = G(x + dx, z + dz);
    if (!Number.isFinite(g) || Math.abs(g - refY) > 45) return null;
    if (unsafe?.(new THREE.Vector3(x + dx, g, z + dz))) return null;   // deep water, lava…
    lo = Math.min(lo, g); hi = Math.max(hi, g);
  }
  if (hi - lo > tolerance) return null;
  // open sky over the hull (no arches, roofs or floating rocks)
  const up = new THREE.Vector3(0, 1, 0), o = new THREE.Vector3();
  for (const [dx, dz] of [[0, 0], [9, 0], [-9, 0], [0, 9], [0, -9], [6, 6], [-6, 6], [6, -6], [-6, -6]]) {
    o.set(x + dx, hi + 1.5, z + dz);
    if (physics.rayDistance(o, up, LIFT + R + 12) < Infinity) return null;
  }
  // nothing standing inside the hull's volume (trunks, pillars, overhangs)
  const cy = hi + LIFT, d = new THREE.Vector3();
  for (const dy of [-9, -4, 0, 5, 10]) {
    const reach = Math.sqrt(R * R - dy * dy) + 1.5;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      o.set(x, cy + dy, z);
      d.set(Math.sin(a), 0, Math.cos(a));
      if (physics.rayDistance(o, d, reach) < reach) return null;
    }
  }
  // the ramp: from the hatch outward, the ground must be reachable and not climb
  const [hx, hz] = dirOf(heading);
  for (let d = 12; d <= 24; d += 3) {
    const g = G(x + hx * d, z + hz * d);
    if (!Number.isFinite(g) || g > hi + 1.2 || g < lo - 4) return null;
    if (unsafe?.(new THREE.Vector3(x + hx * d, g, z + hz * d))) return null;
  }
  return { ground: hi, spread: hi - lo, lo };
}

/**
 * Find the ship's spot. Deterministic (same level -> same place).
 * @returns { x, z, heading, ground, crash? , source }
 */
export function findShipSite({ level, physics, levelId, avoid = [], spawn }) {
  const S = spawn ?? level.spawn ?? new THREE.Vector3();
  const fixed = level.shipSite ?? SITE_OVERRIDES[levelId];
  if (fixed) {
    const g = physics.groundAt(fixed.x, (fixed.y ?? S.y) + 60, fixed.z, 400);
    const probe = probeSite(physics, fixed.x, fixed.z, fixed.heading ?? 0, { refY: Number.isFinite(g) ? g : S.y, tolerance: 1e9 });
    return { ...fixed, ground: probe?.ground ?? g, source: level.shipSite ? 'level' : 'table' };
  }
  const clear = (x, z) => avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r + R + 3);   // (+3: the legs reach out past the hull)
  let best = null;
  for (let d = 34; d <= 150; d += 8) {
    const n = Math.max(12, Math.round((TAU * d) / 10));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = S.x + Math.sin(a) * d, z = S.z + Math.cos(a) * d;
      if (!clear(x, z)) continue;
      // hatch toward the spawn, so you step out facing where you came in
      const heading = Math.atan2(S.x - x, S.z - z);
      // and nothing standing on the ramp's way down
      const [hx, hz] = dirOf(heading);
      if (![14, 18, 22].every((k) => avoid.every((a) => Math.hypot(x + hx * k - a.x, z + hz * k - a.z) > a.r + 1.5))) continue;
      const p = probeSite(physics, x, z, heading, { refY: S.y, unsafe: level.unsafe });
      if (!p) continue;
      const score = d + p.spread * 14 + Math.abs(p.ground - S.y) * 1.5 + Math.max(0, S.y - 1.5 - p.ground) * 12;   // not down in a hollow (or a pond)
      // only a clearly better spot replaces the first found: on flat floors every candidate of a ring
      // scores the same give or take float noise (1e-14), and that noise differs between the browser's
      // collision (built in a worker) and node's, so the tests and the game chose different spots
      if (!best || score < best.score - 1e-3) best = { x, z, heading, ground: p.ground, spread: p.spread, score, source: 'search' };
    }
    if (best && d > best.score) break;   // nothing further out can beat it
  }
  return best;
}
