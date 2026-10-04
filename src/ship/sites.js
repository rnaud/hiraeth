import * as THREE from 'three';
import { LIFT, R } from './hull.js';

// Where the ship stands in each world. A level can define `shipSite`
// ({ x, z, heading }) itself; otherwise the table below; otherwise a clear,
// flat spot near the spawn is searched for (away from the gate, the people,
// the relics and the story goal). `heading` is the direction the hatch and
// its ramp face (a player heading: 0 = +z, PI/2 = +x).
//
// The desert is special: the forced landing of the prologue. The ship lies
// half dug into a rising dune face, tilted, at the end of a long furrow
// ploughed from the north (it slid uphill, +z, and stopped). Sand is heaped
// against its leading (south) side; the hatch opens back onto the furrow.

export const SITE_OVERRIDES = {
  desert: {
    // the hatch faces back along the furrow (north-east, in the morning sun); the cockpit window looks north-west to the camp
    x: 58, z: 48, heading: (3 * Math.PI) / 4,
    crash: {
      travel: 0,          // the direction it was moving (heading): +z, up the dune, sliding on its side
      length: 118,        // furrow length behind it (m)
      pitch: 0.05,        // the cockpit side a little up (rad)
      roll: -0.15,        // tipped back with the slope of the dune (the hatch side lower)
      sink: 6,            // how far below its parked height it is dug in (clamped so the deck stays clear of the sand)
    },
  },
};

const TAU = Math.PI * 2;
const dirOf = (h) => [Math.sin(h), Math.cos(h)];

/** Everything the ship must keep clear of in a level: [{ x, z, r }]. */
export function siteAvoid({ level, content, gate, npcs }) {
  const out = [];
  const add = (x, z, r) => { if (Number.isFinite(x) && Number.isFinite(z)) out.push({ x, z, r }); };
  if (gate) add(gate.pos?.x ?? gate.at?.[0], gate.pos?.z ?? gate.at?.[1], 24);
  else if (content?.gate) add(content.gate.at[0], content.gate.at[1], 24);
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
      if (!best || score < best.score) best = { x, z, heading, ground: p.ground, spread: p.spread, score, source: 'search' };
    }
    if (best && d > best.score) break;   // nothing further out can beat it
  }
  return best;
}
