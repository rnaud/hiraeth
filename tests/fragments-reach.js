// The walker's reach for the fragments of the singing light (src/fragments-data.js; docs/systems/fragments.md):
// a flood over the ground from a world's spawn, step by step as tests/playthrough-agent.js walkTo steps (a cell
// at a time, up what a double jump climbs, down what a fall doesn't hurt, with room to stand), and the checks a
// fragment's spot must pass. Shared by tests/fragments.test.js and scripts/fragment-spots.mjs.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** How high a step up may be: a plain jump, the lift valve's double jump (tests/playthrough-agent.js RISE). */
export const RISE = { jump: 1.4, doublejump: 4.8 };
/** The flood's cell (m), world by world: 1 m where the way up is a narrow stair a 2 m grid steps off (the floating city's
 * stack, the broken moon's street and spiral: v1.60, #228), else 2. */
export const REACH_CELL = { spacecity: 1, moonfoundry: 1 };
export const reachCell = (id) => REACH_CELL[id] ?? 2;

/**
 * Every spot reached from `from` (a spot, or several: a merged world's parts' spawns): [[x, y, z, steps, inside]] (inside: through a doorway, a room of its own). With `targets` ([Vector3]) it stops once each is within
 * `near` m of a spot reached, and says which were: { reached: [bool], nodes }.
 */
export function flood({ physics, level }, from, { cell = 2, rise = RISE.doublejump, drop = 6, radius = 700, max = 1500000, targets = null, near = 2.5, swim = true, slope = 0.7 } = {}) {
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(z / cell)},${Math.round(y / 4)}`;
  const starts = [from].flat();
  const seen = new Set(starts.map((s) => key(s.x, s.y, s.z)));
  const q = starts.map((s) => [s.x, s.y, s.z, 0, false]);
  const edge = (level.limit ?? 1900) - 4;   // (the world's edge: the traveller is turned back there, src/player.js keepInside)
  const far = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > edge || starts.every((s) => Math.hypot(x - s.x, z - s.z) > radius);
  const portals = (level.portals ?? []).filter((p) => p.at && p.to && (!p.when || p.when()));
  const hit = targets ? targets.map(() => false) : null;
  let left = targets?.length ?? 0;
  const touch = (x, y, z) => {
    for (let i = 0; i < targets.length; i++) {
      if (hit[i]) continue;
      const t = targets[i];
      if (Math.hypot(t.x - x, t.z - z) < near && Math.abs(t.y - y) < 1.6) { hit[i] = true; left--; }
    }
  };
  if (targets) for (const s of starts) touch(s.x, s.y, s.z);
  let n = 0;
  while (n < q.length && n < max && (!targets || left > 0)) {
    const [cx, cy, cz, d, inside] = q[n++];
    const next = [];
    // (the rays down start under the ceiling over you: from inside a glass tube, its roof is not a floor to step onto)
    const top = Math.min(rise + 0.2, physics.rayDistance(V(cx, cy + 0.3, cz), UP, rise + 1) + 0.15);
    for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
      const x = cx + dx, z = cz + dz;
      if (far(x, z)) continue;
      // (two ways on: level or down, from just over your feet, and up onto what is there, from under your ceiling: a tube's
      // floor and its roof are both at the tube's mouth)
      const level0 = physics.groundAt(x, cy + 0.6, z, 0.6 + drop), up0 = physics.groundAt(x, cy + top, z, top + drop);
      for (const g of new Set([level0, up0])) {
      if (!Number.isFinite(g) || g - cy > rise || cy - g > drop) continue;
      // (only what you can stand on: a dome's or a dune's steep flank is slid down, not stood on, so not climbed a step at a time)
      if (slope && g - cy > 0.6 && (physics.groundNormal(x, g + 0.5, z).y < slope)) continue;
      // (no walking through a wall: a glass tube's side, a house's: across at chest height over the higher of the two floors)
      { const h = Math.max(cy, g) + 0.9; if (physics.rayDistance(V(cx, h, cz), V(dx, 0, dz).normalize(), cell) < cell) continue; }
      // (and no climbing through your own ceiling: a room's roof, a dome's glass seen from inside, is not a step up)
      if (g - cy > 0.6 && physics.rayDistance(V(cx, cy + 0.3, cz), UP, g - cy + 1.6) < g - cy + 1.5) continue;
      if (physics.rayDistance(V(x, g + 0.3, z), UP, 1.9) < 1.5) continue;
      if (!swim && level.unsafe?.(V(x, g, z))) continue;   // (swim: deep water is crossed swimming, as Lorn's is)
      if (Number.isFinite(level.killY) && g < level.killY) continue;
      next.push([x, g, z, inside]);
      }
    }
    // (a doorway into a room of its own, a temple or a shop built far overhead, leads inside; a lock or a lift out into
    // the world, the Underwater City's divers' lock onto the seabed, doesn't)
    for (const p of portals) if (Math.hypot(cx - p.at.x, cz - p.at.z) < p.r + cell && Math.abs(cy - p.at.y) < 2.5) next.push([p.to.x, p.to.y, p.to.z, inside || !!p.temple || Math.abs(p.to.y - p.at.y) > 300]);
    for (const [x, y, z, inn] of next) {
      const k = key(x, y, z);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([x, y, z, d + 1, inn]);
      if (targets) touch(x, y, z);
    }
  }
  return targets ? { reached: hit, nodes: n } : q;
}

/**
 * A fragment's spot (on the ground, `p.y` the ground's height): solid ground just under it, near level, room over
 * it to stand, out of the water and the world's other harm. Returns why not, or null.
 */
export function spotWhyNot({ physics, level }, p) {
  const g = physics.groundAt(p.x, p.y + 1.5, p.z, 4);
  if (!Number.isFinite(g) || Math.abs(g - p.y) > 0.7) return `no ground under it (${Number.isFinite(g) ? (g - p.y).toFixed(2) : 'none'})`;
  if (physics.groundNormal(p.x, g + 1, p.z).y < 0.75) return 'on a slope';
  // (room for the feet: the same ground a step round it, not the top of a post or a rail)
  for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) {
    const h = physics.groundAt(p.x + dx, g + 1, p.z + dz, 2);
    if (!Number.isFinite(h) || Math.abs(h - g) > 0.5) return 'no footing round it';
  }
  if (physics.rayDistance(V(p.x, g + 0.3, p.z), UP, 2) < 1.9) return 'no room over it';
  if (level.unsafe?.(V(p.x, g, p.z))) return 'in harm’s way';
  return null;
}
export const spotOk = (W, p) => !spotWhyNot(W, p);

/** How near air a spot out in the sea must be (m): the helmet's 20 s run out there and back (the Underwater City, v1.56). */
export const AIR_NEAR = 35;
/**
 * A world under the sea (`level.sea`): a spot under the glass of a hall, or out on the seabed within AIR_NEAR m of air
 * (a bell, a café, a lock's drum: `level.air`), where the helmet's air takes you and back. Returns why not, or null.
 */
export function seaWhyNot({ physics, level }, p) {
  if (!level.sea || physics.rayDistance(V(p.x, p.y + 0.3, p.z), UP, 400) !== Infinity) return null;
  if (!level.air) return 'out in the sea, not under the glass';
  for (let r = 0; r <= AIR_NEAR; r += 5) for (let k = 0; k < (r ? 16 : 1); k++) {
    const a = (k / 16) * Math.PI * 2;
    if (level.air(p.x + Math.cos(a) * r, p.y + 1.2, p.z + Math.sin(a) * r)) return null;
  }
  return `out in the sea, over ${AIR_NEAR} m from air`;
}

/**
 * The real traveller (src/player.js) set down a metre over the spot: does he come to stand on it, close enough to take
 * it? (A post's top, an arch's crown, a lip too narrow for his feet, or rising air, and he slides off or is lifted.)
 * `Player` is passed in (the module is heavy to load for the flood's users who don't need it). → why not, or null.
 */
export function standWhyNot({ physics, level }, p, Player) {
  const P = new Player(physics, { unsafe: level.unsafe, health: false, spawn: p.clone() });
  P.respawn(new THREE.Vector3(p.x, p.y + 1, p.z));
  P.onGround = false;
  for (let f = 0; f < 90 && !(P.onGround && f > 20); f++) P.update(1 / 60, {}, 0);
  const off = Math.hypot(P.pos.x - p.x, P.pos.z - p.z), up = P.pos.y - p.y;
  if (!P.onGround || off > 1.2 || Math.abs(up) > 0.6) return `the traveller set down on it ends ${off.toFixed(1)} m off, ${up.toFixed(1)} m up${P.onGround ? '' : ', not standing'}`;
  return null;
}

// The new country, world by world (v1.60, #228; scripts/fragment-spots.mjs scores it, tests/fragments-route.test.js counts it): the level's sights (`level.sights`) whose names are its explorations' pieces (v1.55–
// v1.57), and how near one a spot must be to count as in it (m). The places built to be found.
export const NEW_COUNTRY = {
  arzach: { r: 40, sights: /stone ear|hour stone|broken slab|highest stone|stone that rises|table of the plain|riders’ shrine|riders’ gate/ },
  perdide: { r: 45, sights: /keepers’ (huts|winch|lookout|stair)|cap square|bridge over the lit path|egg isle|heron|drowned|root gate/ },
  edena: { r: 45, sights: /round ship|dish pond|split meteor|builders’ machine|old pyramid|nursery|great pyramids|water stair|seed-drill|Greenhouse water/ },
  underwater: { r: 40, sights: /pod tower|sunken cart|bridge over the canyon|far wall|whale bones|window over the deep/ },
  moonfoundry: { r: 40, sights: /street’s top|crown|signal box|hoist tower|footbridge|steps down|cracked mould/ },
  spheres: { r: 45, sights: /causeway|stepping|furrow|crater|cracked|pillar|walkway|belvedere/i },
  spacecity: { r: 35, sights: /underhouses|capstan|parted|stack|roof street|cables under|anchor/ },
  // (and Kip's skybridge, which the sign painters' gallery runs on to since v1.56: src/market-air.js KIP_BRIDGE)
  bazaar: { r: 30, sights: /gallery|mast|first stall|round grille|screen-mender|biggest set/, also: [[20, 25, -90]] },
};
/** A world's new country: the sights of its explorations (`level.sights`, named in NEW_COUNTRY, and its `also` points) and whether a spot is near one. */
export function newCountry(level, id) {
  const def = NEW_COUNTRY[id];
  const at = (p) => (Array.isArray(p) ? p : p?.isVector3 ? [p.x, p.y, p.z] : p?.at ? at(p.at) : null);
  const sights = def ? [...((typeof level.sights === 'function' ? level.sights() : level.sights) ?? []).filter((s) => def.sights.test(s.name)).map((s) => at(s.at)).filter(Boolean), ...(def.also ?? [])] : [];
  // (near in 3D, height counting half again: a deck 40 m over a sight is not beside it)
  const isNew = (x, y, z) => sights.some((s) => Math.hypot(s[0] - x, (s[1] - y) * 1.5, s[2] - z) < def.r);
  return { sights, isNew };
}
