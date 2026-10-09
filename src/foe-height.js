// Foes over the world's height (v1.4, docs/systems/foes.md "Foes over height"): pure logic, no three.js.
//
// - **The way up and down** (`findRoute`): a walker that can't walk straight to you (you are up a ledge or
//   down off one, or something stands between) looks over a small grid round itself for a way: steps it can
//   walk (≤ CLIMB.step), ledges it can clamber (a blot, a shade, a stalker, a hound: ≤ CLIMB.clamber) and drops it
//   can hop down (≤ CLIMB.drop, a heavy one ≤ CLIMB.heavyDrop). Each clamber and drop is a hop with a crouch
//   first (HOP), so you see it coming. No way: it holds off below, in sight (Foe.holdOff), never pressed
//   against the wall.
// - **The high ground** (`findPerch`): a kind with `perch` (the spitting blot) climbs the steps and ramps near
//   it to a spot over you, in its reach and in sight, and lobs down from there; perched, it won't step down off
//   it while you are below.
// - **Knocked off** (KNOCK): a foe your blow or push carries off a ledge lands dazed a long while
//   (KNOCK.stun), with stars over it; from KNOCK.defeat up, the fall ends it.

/** How high a walker climbs and how far it drops: a step it walks; a clamber and a drop are hops. */
export const CLIMB = { step: 1.1, clamber: 2.4, drop: 4.5, heavyDrop: 2.6 };
/** A hop: crouched `crouch` s (the tell), then in the air `time` s plus `perM` s a metre of height, arcing `arc` m. */
export const HOP = { crouch: 0.32, time: 0.32, perM: 0.07, arc: 0.6 };
/**
 * The grid search: `cell` m cells, out to `radius` m, at most `budget` cells looked at; a route is planned at
 * most every `every` s. A walker straight at you is `stuck` after this long without getting on; a route still
 * holds while you stay within `drift` m of where it led. `flat`: within this much height it just walks at you.
 */
export const ROUTE = { cell: 1, radius: 13, budget: 520, every: 1.1, stuck: 0.4, drift: 3, flat: 1.15, hold: 5 };
/** The high ground: `rise` m over you at least (past a blow's reach, STRIKE_RISE), looked for every `every` s, the way no longer than `far` m. */
export const PERCH = { rise: 1.7, every: 2.5, far: 16 };
/** Knocked off a ledge by you: dazed `stun` s from `min` m; from `defeat` m it is over. `recent`: s a blow counts as yours. */
export const KNOCK = { min: 1.4, stun: 3.5, defeat: 4.5, recent: 0.9, charged: 2.2 };

/** What a kind can climb and drop (m): a hovering one flies, a burrowing one only walks. */
export function reachOf(def) {
  if (def.burrow) return { up: CLIMB.step, down: CLIMB.step };
  return { up: def.clamber ? CLIMB.clamber : CLIMB.step, down: def.heavy ? CLIMB.heavyDrop : CLIMB.drop };
}

/** How a link of height dy (m, + up) is crossed, for a walker with reach R: 'walk', 'clamber', 'drop', or null. */
export function linkOf(dy, R) {
  if (Math.abs(dy) <= CLIMB.step) return 'walk';
  if (dy > 0) return dy <= R.up ? 'clamber' : null;
  return -dy <= R.down ? 'drop' : null;
}

/**
 * A grid search (A*) from `from` for the nearest-by-way cell `goal(x, y, z)` accepts. env.ground(x, top, z, range)
 * gives the footing (null: none). R: reachOf. Options: top / bottom (the heights to look between), blocked(x, y, z)
 * (a hazard it won't walk into), h(x, y, z) (the estimate to the goal, 0 for a nearest search), canStep (env's:
 * a wall in the way of a level step).
 * Returns the cells after the start [{ x, y, z, how }] (how: the link into it) or null, and its cost on `.cost`.
 */
export function gridSearch(from, env, R, { goal, h = () => 0, top, bottom, blocked = null, canStep = null, far = ROUTE.radius, budget = ROUTE.budget } = {}) {
  if (!env.ground) return null;
  const C = ROUTE.cell, N = Math.ceil(far / C), range = top - bottom;
  const key = (i, j) => (i + N) * (2 * N + 1) + (j + N);
  const heights = new Map();
  const yAt = (i, j) => {
    const k = key(i, j);
    if (!heights.has(k)) heights.set(k, env.ground(from.x + i * C, top, from.z + j * C, range));
    return heights.get(k);
  };
  heights.set(key(0, 0), from.y);
  const open = [{ i: 0, j: 0, y: from.y, g: 0, f: h(from.x, from.y, from.z) }], came = new Map([[key(0, 0), null]]), cost = new Map([[key(0, 0), 0]]);
  let seen = 0;
  while (open.length && seen++ < budget) {
    let bi = 0;
    for (let n = 1; n < open.length; n++) if (open[n].f < open[bi].f) bi = n;
    const c = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (c.g > cost.get(key(c.i, c.j))) continue;
    const cx = from.x + c.i * C, cz = from.z + c.j * C;
    if ((c.i || c.j) && goal(cx, c.y, cz)) {
      const out = [];
      for (let k = key(c.i, c.j), n = came.get(k); n; k = n.prev, n = came.get(k)) out.unshift({ x: from.x + n.i * C, y: n.y, z: from.z + n.j * C, how: n.how });
      out.cost = c.g;
      return out;
    }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const i = c.i + di, j = c.j + dj;
      if (Math.abs(i) > N || Math.abs(j) > N) continue;
      const y = yAt(i, j);
      if (y == null) continue;
      const how = linkOf(y - c.y, R);
      if (!how) continue;
      // (a diagonal hop over a corner: only straight across an edge, so it never clips a wall)
      if (how !== 'walk' && di && dj) continue;
      if (di && dj && (yAt(c.i + di, c.j) == null || yAt(c.i, c.j + dj) == null || linkOf(yAt(c.i + di, c.j) - c.y, R) !== 'walk' || linkOf(yAt(c.i, c.j + dj) - c.y, R) !== 'walk')) continue;
      const x = from.x + i * C, z = from.z + j * C;
      if (blocked?.(x, y, z)) continue;
      // (a wall between the cells: the line to just short of the next centre, not the body's width, or the cell
      // at a wall's foot is lost; followRoute takes a hop from as near as the body gets)
      if (how === 'walk' && canStep && !canStep({ x: cx, y: c.y, z: cz }, x, z, -0.3, CLIMB.step + 0.1)) continue;
      const g = c.g + (di && dj ? Math.SQRT2 : 1) * C + (how === 'clamber' ? 3 : how === 'drop' ? 1.5 : 0);
      const k = key(i, j);
      if (cost.has(k) && cost.get(k) <= g) continue;
      cost.set(k, g); came.set(k, { prev: key(c.i, c.j), i, j, y, how });
      open.push({ i, j, y, g, f: g + h(x, y, z) });
    }
  }
  return null;
}

/**
 * A way from `from` to within `stopAt` m of `to`, on its level (within `rise` m of its height), or null.
 * R: reachOf(def); options as gridSearch (blocked, canStep).
 */
export function findRoute(from, to, env, R, { stopAt = 1, rise = 1, ...o } = {}) {
  const top = Math.max(from.y, to.y) + R.up + 1, bottom = Math.min(from.y, to.y) - R.down - 1;
  return gridSearch(from, env, R, {
    ...o, top, bottom,
    goal: (x, y, z) => Math.hypot(x - to.x, z - to.z) <= Math.max(stopAt, ROUTE.cell) && Math.abs(y - to.y) < rise,
    h: (x, y, z) => Math.max(0, Math.hypot(x - to.x, z - to.z) - stopAt) + Math.abs(y - to.y) * 0.5,
  });
}

/**
 * The high ground near `from` for a perching foe: a spot it can walk to (steps and ramps: R as reachOf, no hops)
 * at least PERCH.rise over `you`, `keep`–`reach` m from you, from which it sees you (env.seen(chest, you)), the
 * shortest way. `height`: its chest over its feet. Returns the route (as findRoute) or null.
 */
export function findPerch(from, you, env, { keep = 4, reach = 10, height = 0.6, ...o } = {}) {
  const R = { up: CLIMB.step, down: CLIMB.step };
  const top = Math.max(from.y, you.y) + 6, bottom = Math.min(from.y, you.y) - 2;
  const eye = { x: 0, y: 0, z: 0 };
  return gridSearch(from, env, R, {
    ...o, top, bottom, far: PERCH.far,
    goal: (x, y, z) => {
      if (y - you.y < PERCH.rise) return false;
      const d = Math.hypot(x - you.x, z - you.z);
      if (d < keep || d > reach - 1) return false;
      eye.x = x; eye.y = y + height; eye.z = z;
      return env.seen ? env.seen(eye, you) : true;
    },
  });
}

/** Where a hop is at u (0..1 of its time in the air): along from → to, arcing over the higher end. */
export function hopAt(from, to, u, out = { x: 0, y: 0, z: 0 }) {
  out.x = from.x + (to.x - from.x) * u;
  out.z = from.z + (to.z - from.z) * u;
  out.y = from.y + (to.y - from.y) * (to.y > from.y ? 1 - (1 - u) ** 3 : u * u) + 4 * u * (1 - u) * HOP.arc;
  return out;
}

/** How long a hop of dy m takes in the air (s). */
export const hopTime = (dy) => HOP.time + Math.abs(dy) * HOP.perM;

/** What landing h m down after your knock does: 'over' (it ends it), 'dazed' (a long stun), or null (an ordinary landing). */
export function knockedOff(h) { return h >= KNOCK.defeat ? 'over' : h >= KNOCK.min ? 'dazed' : null; }
