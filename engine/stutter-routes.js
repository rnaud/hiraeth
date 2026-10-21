// Play routes for the stutter harness (issue #468, docs/systems/performance.md "Stutters"): a few minutes of real play
// that load, stream, spawn, open the menus, film and board, each frame's time recorded (engine/stutter.js, BridgeStutter.cs).
// A route is a sequence of engine/sequences.js's shape (a setup, its beats), played by the same SequenceRun, but walked
// by the keys: the traveller runs on the stick (W, Shift) and the route steers the camera at its next point, so the
// physics, the camera, the streaming, the people and the regions' names all go as in play. A traveller who makes no
// headway for `STUCK` s is set down at his point (said in the log): the route goes on, the frames are still play.
// Not compared with the web's stream (they are not in SEQUENCES): only their frames are wanted.
//   Unity: scripts/unity-js-player.sh <name> -sequence route-border -stutter <file>   (scripts/stutter/run.mjs runs them all)
//   node:  node engine/sequence-run.mjs route-border   (that the route plays: tests/stutter-routes.test.js)
import * as THREE from 'three';

/** Seconds without 0.5 m of headway before the traveller is set down at his point. */
export const STUCK = 3;
/** How close to a point counts as there (m, on the ground's plane). */
export const NEAR = 2.5;

const tap = (...codes) => codes;
const flat = (p, q) => Math.hypot(q[0] - p.x, q[q.length - 1] - p.z);

/**
 * A beat that runs (or walks) through `points` ([x, z], or [x, y, z] for a set-down's height; or a function of G giving
 * them, worked out as the beat starts) on the keys: the camera turned at each point (the stick's forward is the
 * camera's), the keys held the whole way. Its state is kept on G.
 */
export function walkTo(name, points, { run = true, timeout = 90, near = NEAR } = {}) {
  return {
    name, timeout,
    hold: run ? { KeyW: true, ShiftLeft: true } : { KeyW: true },
    act: (G) => { G.route = { i: 0, best: Infinity, at: 0, stuck: 0, points: typeof points === 'function' ? points(G) : points }; },
    until: (G) => {
      const R = G.route, p = G.player.pos, q = R.points[R.i];
      if (!q) return true;
      const d = flat(p, q);
      if (d < near) { R.i++; R.best = Infinity; R.at = G.since; return R.i >= R.points.length; }
      if (d < R.best - 0.5) { R.best = d; R.at = G.since; }
      else if (G.since - R.at > STUCK) {
        // (no headway: set down at the point, on the ground there)
        const y = q.length > 2 ? q[1] : G.game?.physics?.groundAt?.(q[0], p.y + 30, q[q.length - 1], 80) ?? p.y;
        G.player.teleport(new THREE.Vector3(q[0], (Number.isFinite(y) ? y : p.y) + 0.1, q[q.length - 1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
        R.stuck++; R.best = Infinity; R.at = G.since;
        console.log(`[stutter] ${name}: stuck before point ${R.i}, set down there`);
      }
      // (the camera behind him, looking along the way: the stick's forward goes there)
      G.rig.yaw = Math.atan2(q[0] - p.x, q[q.length - 1] - p.z) + Math.PI;
      return false;
    },
  };
}
/** The keys let go. */
const stop = (name = 'stop', wait = 1.5) => ({ name, hold: { KeyW: false, ShiftLeft: false }, wait });
const kill = (G) => { for (const f of [...(G.foes?.list ?? [])]) if (f.alive) G.foes.hurt(f, 'blade', new THREE.Vector3(0, 0, 1), { damage: 99 }); };

// Follow the real porch and offset staircase rather than cutting diagonally through the rooms.
function shipWalkPoints(G) {
  const S=G.ship,m=S.parked,stairs=S.layout?.STAIRS;
  if(!stairs){const f=S.rampFoot,p=S.roomSpot('main').pos,c=S.roomSpot('cockpit')?.pos??p;return [[f.x,f.z],[p.x,p.z],[c.x,c.z]];}
  const world=(x,y,z)=>S.world(m,new THREE.Vector3(x,y,z));
  return [S.rampFoot,S.hinge,S.world(m,m.interior.points.hatchIn),S.world(m,m.interior.points.aboard),
    world(stairs.x,0,stairs.z1+.5),world(stairs.x,stairs.rise,stairs.z0-.6),S.roomSpot('cockpit').pos].map(p=>p.toArray());
}

export const ROUTES = [
  {
    // the desert from the ship's ramp into the Rose canyons (a region's border, its name), through the camps' crowd
    // round their fires and up to Qanat's burning tree: the streaming of a long run, the people met on the way
    id: 'route-border', title: 'Across a border: the dunes into the Rose canyons, the camps, Qanat', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'settle', wait: 3 },
      walkTo('canyons', [[140, 214], [175, 250]]),
      walkTo('camps', [[158, 282]]),
      walkTo('qanat', [[190, 330], [212, 368]]),
      stop('arrived', 3),
    ],
  },
  {
    // the City-Shaft at a walk and a run: round its ring's floor from the start, past the knots of people and back
    id: 'route-city', title: 'Walking through a city: the City-Shaft\'s ring', setup: { level: 'incal', debug: true },
    beats: [
      { name: 'settle', wait: 3 },
      walkTo('north', [[275, -50], [300, -50]], { run: false }),
      walkTo('east', [[319, -40], [319, 20]]),
      walkTo('back', [[300, 45], [275, 30], [275, 0]], { run: false }),
      stop('arrived', 3),
    ],
  },
  {
    // the Arena: foes come in (a pack of blots, a machine, then a brute and skitters), locked on, cut, killed
    id: 'route-fight', title: 'A fight with spawns: the Arena', setup: { level: 'arena', fight: true },
    beats: [
      { name: 'ready', act: (G) => { const F = G.foes; F.setPractice?.(''); F.waveRest = F.packRest = 1e9; for (const f of [...F.list]) F.remove(f); }, wait: 1.5 },
      { name: 'blots', act: (G) => { G.foes.spawnKind('blot', { n: 3, dist: 7 }); }, wait: 1 },
      { name: 'lock', keys: tap('Tab'), wait: 0.5 },
      { name: 'cuts', keys: tap('KeyF', 'KeyF', 'KeyF', 'KeyF', 'KeyF', 'KeyF'), wait: 0.5 },
      { name: 'machine', act: (G) => { G.foes.spawnKind('machine', { n: 1, dist: 9 }); }, keys: tap('KeyF', 'KeyF', 'KeyF'), wait: 1.5 },
      { name: 'killed', act: kill, wait: 2 },
      { name: 'brute', act: (G) => { G.foes.spawnKind('brute', { n: 1, dist: 9 }); G.foes.spawnKind('skitter', { dist: 8 }); }, wait: 1 },
      { name: 'lock2', keys: tap('Tab', 'KeyF', 'KeyF', 'KeyF', 'KeyF'), wait: 1.5 },
      { name: 'killed2', act: kill, wait: 3 },
    ],
  },
  {
    // the Start menu and the game menu's pages, twice (the Map's ground drawn, then drawn already), in the desert
    id: 'route-menus', title: 'The menus and the map, twice', setup: { level: 'desert', debug: true },
    beats: [0, 1].flatMap((k) => [
      { name: `play${k}`, wait: 1.5 },
      { name: `start${k}`, act: (G) => G.menu.open('start'), wait: 0.6 },
      { name: `items${k}`, act: (G) => { G.menu.close(); G.menu.open('game', 'items'); }, wait: 0.6 },
      { name: `map${k}`, act: (G) => { G.menu.close(); G.menu.open('game', 'map'); }, wait: 2.5 },
      { name: `quests${k}`, act: (G) => { G.menu.close(); G.menu.open('game', 'quests'); }, wait: 0.6 },
      { name: `settings${k}`, act: (G) => { G.menu.close(); G.menu.open('start', 'settings'); }, wait: 0.6 },
      { name: `closed${k}`, act: (G) => G.menu.close(), wait: 1 },
    ]),
  },
  {
    // the desert's ship: from the foot of its ramp up into the main room, to the cockpit, and back out down the ramp
    id: 'route-board', title: 'Boarding the ship', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'settle', wait: 3 },
      walkTo('board', (G) => shipWalkPoints(G), { run: false, timeout: 60, near: .45 }),
      stop('aboard', 3),
      walkTo('out', (G) => shipWalkPoints(G).reverse(), { run: false, timeout: 60, near: .45 }),
      stop('outside', 3),
    ],
  },
];

/** A route by its id, or null. */
export const routeById = (id) => ROUTES.find((r) => r.id === id) ?? null;

/**
 * The harness's runs, in order (scripts/stutter/run.mjs): the routes above, and sequences of engine/sequences.js that
 * already play what the brief names (a cinematic, a conversation, the ship's arrival and its takeoff).
 */
export const STUTTER_RUNS = [
  { id: 'route-city', what: 'walking through a city' },
  { id: 'route-border', what: 'crossing a region border' },
  { id: 'route-fight', what: 'a fight with spawns' },
  { id: 'route-menus', what: 'the menus and the map' },
  { id: 'moment-desert.lit', what: 'a cinematic (the desert\'s world moment, the tree lit)' },
  { id: 'talk', what: 'a conversation' },
  { id: 'route-board', what: 'boarding the ship' },
  { id: 'takeoff', what: 'the ship\'s takeoff' },
];
