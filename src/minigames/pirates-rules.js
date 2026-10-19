// The chime-pirates' rules (src/minigames/pirates.js, docs/systems/minigames.md "Pirates between worlds"):
// a rail shooter, pure, on plain objects, so the tests can fly it at any frame rate (tests/pirates.test.js).
//
// The ship flies forward along a rail through space (railPoint: a long gentle wander along -z) at FLY.speed.
// Everything lives in the rail's own coordinates: s along it, u across (right), v up. The ship moves only
// across (u, v) inside a box; what flies with it (the pirates, their shots, the ship's bolts) is kept
// relative to it (ds = s - the ship's s, > 0 ahead); what hangs still in space (the rocks, the mines, the
// repair rings) has an absolute s.
//
//   const S = newRun({ seed, heat, gentle });
//   const ev = runStep(S, input, dt);        // input: { x, y, fire, fireHeld, auto, roll, missile } (pirateInput below)
//   ev: [{ kind: 'shot' | 'charged' | 'hit' | 'kill' | 'hurt' | 'deflect' | 'blast' | 'say' | 'repair' | 'part' | 'lock' | 'roll' | 'missile' | 'missileHit' | 'dry' | 'tell' | 'enemyShot' | 'win' | 'dead', … }]  ('tell': a pirate winding up to fire, ATTACKS)
//   newRun({ from, fails, score }): a lost run again from a checkpoint (CHECKPOINTS), kinder each time (MERCY)
//
// SCRIPT is the run, by the seconds since GO: the waves, the repair rings, the lines, the captain.

// The feel, after the audit against Star Fox 64 (issue #88, docs/systems/minigames.md "The controls, against Star
// Fox"): the stick sets where the ship is going, and it gets there with some weight (an easing, not a fixed
// acceleration: it starts briskly and settles); near the box's edge it slows to a stop instead of hitting a wall
// and bouncing; it banks hard into the turn and its nose points where it is going, and the bolts go where the nose
// points (`aim`), so the reticle swings ahead of the ship as it turns and you aim by steering, as there.
export const FLY = {
  speed: 42,                 // m/s along the rail
  boxU: 13, boxV: 7.5,       // m: how far across and up the ship may go from the rail
  steer: 19,                 // m/s across at full stick (up and down 0.8 of it)
  response: 6,               // 1/s: how quickly the ship takes up the stick's speed (70 % in 0.2 s, nearly all in 0.5 s; 5 until issue #326)
  brake: 10,                 // 1/s: the same when the stick is let go or turned back (issue #326: it stops where you leave it, tight)
  curve: 1.3,                // the stick's curve: |x|^curve (issue #326: a small push a fine correction, a full one as before)
  // aim assist (issue #326, "tighter controls"): a bolt fired with a pirate within `slack` m of the line of fire is bent
  // `k` of the way toward it (the reticle still shows the plain line; on a pad the stick is coarse)
  assist: { slack: 2.6, k: 0.7 },
  edge: 0.22,                // the last part of the box (of its half size) over which the way out slows to nothing
  bank: { max: 0.95, rate: 9 },   // rad of bank at full sideways speed, and how fast it follows (1/s)
  aim: 0.09,                 // the nose's slope at full stick: the bolts' own way across, besides the ship's speed
  hull: 6,                   // the hull's pips
  iframe: 1.1,               // s untouchable after a hit
  // the ship's half sizes (m), for what hits it: drawn 5.2 m long since issue #494 ("the ship is too big"; pirates.js
  // SHIP_LENGTH), 1.7 m across, its hit box a little inside that (1.8 × 0.9 × 3.0 until then)
  body: { u: 0.8, v: 0.5, s: 2.4 },
  bolt: { speed: 170, life: 1.25, every: 0.12, auto: 0.2, r: 0.7, spread: 0.6, lead: 0.5 },   // the twin bolts; `lead`: how much of the ship's sideways speed they keep (spread 0.9 until the ship was drawn smaller)
  // boost and brake (issue #495: "allow me to boost and slow down to avoid hazards"; Star Fox's C buttons): the ship's
  // speed along the rail times `boost` or `brake`, eased in at `rate` /s, the hazards hung in space (the rocks, the
  // mines, the rings, the drops) coming on that much quicker or slower; the pirates fly with the ship as before. Both
  // draw on one gauge (`drain` and `brakeDrain` a second of its whole), which fills again at `refill` /s `wait` s after
  // either is let go; emptied, neither works until it is back over `min`.
  throttle: { boost: 1.75, brake: 0.5, rate: 3.5, drain: 0.42, brakeDrain: 0.34, refill: 0.3, wait: 0.45, min: 0.25 },
  charge: { after: 0.28, full: 0.7, speed: 120, turn: 6, life: 2.4, blast: 9, dmg: 12 },   // hold to charge (s), the homing shot, its blast (m) and its harm
  roll: { dur: 0.45, cool: 0.5, push: 14 },   // the barrel roll: s, s before the next, m/s of sideways shove
  // the missiles (issue #224): a few a run on their own button, each locking the pirate nearest the reticle (a wider
  // cone than the charge's) and chasing it, slower off the rail than a bolt but turning after it; a hit does `dmg` to
  // it and `splash` round it. `count` a run (a repair ring gives one back, up to `count`); `cool` s between two
  missile: { count: 4, cool: 0.6, speed: 55, top: 115, accel: 140, turn: 4.5, life: 3.4, dmg: 14, splash: 5, splashDmg: 4, cone: 0.26, r: 1.6 },
  lock: { near: 12, far: 230, cone: 0.11 },     // a charged shot locks what lies within that slope of the reticle, between near and far (m ahead)
  enemyShot: { speed: 50, r: 0.9, life: 4.5 },
};

/**
 * The guns (issue #495: "enemies should drop gun upgrades so I become more powerful within the level (resets when
 * hit)"): the tiers a run climbs by flying through the drops (DROPS), from the twin bolts up. Each its tap's and its
 * stream's rate (s between two volleys: FLY.bolt's every and auto at the first), the bolts' size, and from the third
 * two more bolts fanned out either side (`fan`: their slope across, as the nose's). A pip of hull lost takes the gun
 * back to the first tier; a run (and a retry from a checkpoint) starts there.
 */
export const GUNS = [
  { id: 'twin', name: 'Twin bolts', every: 0.12, auto: 0.2, r: 0.7, fan: 0 },
  { id: 'rapid', name: 'Rapid fire', every: 0.09, auto: 0.14, r: 0.75, fan: 0 },
  { id: 'spread', name: 'Spread shot', every: 0.09, auto: 0.14, r: 0.8, fan: 0.055 },
  { id: 'storm', name: 'Storm guns', every: 0.075, auto: 0.11, r: 0.95, fan: 0.075 },
];
/**
 * The drops (issue #495): a gunboat, a bomber and each of the captain's turrets leave one where they go down, and so
 * does a wave of fighters downed to the last one. A drop hangs in space a little way ahead (at least `ahead` m), drifts
 * into the ship's box (`drift` /s) and is taken flying within `r` m of it; at the top tier it is worth `pts` (a token: the
 * run's points, and its chimes, stay where the bolts left them).
 */
export const DROPS = { from: { raider: true, hauler: true, part: true, wave: true }, ahead: 34, r: 2.8, drift: 1.4, pts: 5, life: 14 };
/** The gun's tier for a run's state (0: the twin bolts). */
export const gunOf = (S) => GUNS[Math.max(0, Math.min(GUNS.length - 1, S?.ship?.gun ?? 0))];

/**
 * Points, then chimes (issue #206: "don't show '+3 chimes', just have points and at the end they convert into
 * chimes"): the run counts only points (POINTS, S.score); won on the way to a world, the results tally them into
 * chimes at one chime for every CHIME_RATE points (chimesFor), and main.js onResult banks them. 20 keeps the economy
 * where the chimes per ship left it (v1.45, issue #88): the pilot's runs score about 1,650, 82 chimes, against 79.
 */
export const CHIME_RATE = 20;
/** The chimes a run's points are worth (whole chimes; what is left over is not). */
export const chimesFor = (score, rate = CHIME_RATE) => Math.max(0, Math.floor((score || 0) / rate));

/**
 * After each lost run (from the last checkpoint), the pirates fire less (`fire`, down to `least` of it) and the hull
 * has a pip more (`hull`, up to `most` more); from `safe` losses on the hull holds at its last pip. Every fight on the
 * way to a world can be won, and it must be: there is no skip.
 */
export const MERCY = { fire: 0.18, least: 0.45, hull: 1, most: 2, safe: 3 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The pirates' kinds as the player meets them (issue #326: "better enemy designs"): each its own silhouette (pirates.js
 * pirateShapes), its own attack and a telegraph before it (`tell` s: the rules' `tell` event, and `tellK` 0..1 on the
 * pirate or the captain while it winds up, which the page draws as its glow swelling and hears as a whine).
 *  - the fighter (skiff): one aimed shot, its eye flaring first;
 *  - the gunboat (raider): holds ahead and fires a fan of three (`n` shots `gap` s apart, `fan` m apart at the ship),
 *    its brow cannon glowing hot before;
 *  - the bomber (hauler): lays mines across the way, its bay lamp blinking before each drops;
 *  - the flagship (the captain's gunship): its wingtip turrets fire bursts, each turret glowing before its volley;
 *    once they are down, its bridge rings of slow shots, the lens swelling before each.
 */
export const ATTACKS = {
  skiff: { name: 'fighter', attack: 'aimed', tell: 0.4 },
  raider: { name: 'gunboat', attack: 'fan', tell: 0.6, n: 3, gap: 0.13, fan: 2.6 },
  hauler: { name: 'bomber', attack: 'mines', tell: 0.45 },
  mine: { name: 'mine', attack: 'contact', tell: 0 },
  boss: { name: 'flagship', attack: 'bursts, then rings', tell: 0.7, ringTell: 0.9 },
};

// ------------------------------------------------------------------ the rail
/** The rail's wander across (x) and up (y) at s (m along); it runs along -z. */
export const railX = (s) => 22 * Math.sin(s / 330) + 9 * Math.sin(s / 113 + 1.3);
export const railY = (s) => 12 * Math.sin(s / 470 + 0.6);
/** The world point at (s, u, v): { x, y, z } (or into `out`, a THREE.Vector3). */
export function railPoint(s, u = 0, v = 0, out = { x: 0, y: 0, z: 0 }) {
  out.x = railX(s) + u; out.y = railY(s) + v; out.z = -s;
  return out;
}

// ------------------------------------------------------------------ the run's script
/**
 * The lines said on the way (the ship's, the captain's): src/ambush.js AMBUSH_LINES has their words. 30 % shorter since
 * v1.45 (issue #88): the captain at 70 s, not 102 (a wave of skiffs, a hauler and a vee cut, the rest drawn closer).
 * `checkpoint`: a lost run starts again from the last one passed (newRun's `from`), the hull full.
 */
export const SCRIPT = [
  { t: 1.2, say: 'start' },
  { t: 4, wave: 'line', n: 5, side: -1 },
  { t: 10, wave: 'vee', n: 5 },
  { t: 17, wave: 'chase', n: 2 },
  { t: 25, wave: 'line', n: 6, side: 1, v: 2 },
  { t: 30, ring: true, u: -5, v: 2 },
  { t: 33, checkpoint: 1 },
  { t: 34, wave: 'vee', n: 7 },
  { t: 40, say: 'hauler' },
  { t: 41, wave: 'hauler', side: 1 },
  { t: 49, wave: 'line', n: 6, side: -1, v: -3 },
  { t: 55, wave: 'chase', n: 3 },
  { t: 63, ring: true, u: 4, v: -2 },
  { t: 66, checkpoint: 2 },
  { t: 67, say: 'captain' },
  { t: 70, boss: true },
];
/** Where a lost run can start again: the start, then each checkpoint's time (s). */
export const CHECKPOINTS = [0, ...SCRIPT.filter((e) => e.checkpoint).map((e) => e.t)];

/** The rocks along the way: [s0, s1, rocks per 100 m]. Between the belts, open space (drawn closer with the script, v1.45). */
export const BELTS = [[175, 875, 3.2], [1190, 1890, 4.6], [2100, 2450, 2.2], [2590, 2940, 3]];

/**
 * The levels (issue #494: "the space pirate mini game should have variation between levels"): each flight to a new
 * world is one of these (levelFor), its own formations, its own hazard and its own sky (pirates.js BACKDROPS). Every
 * one keeps the run's frame, so each is as fair as the first: the captain at 70 s, the checkpoints at 33 and 66, two
 * repair rings, a bomber, about thirty fighters and five gunboats (the points, and the chimes, where the first left
 * them: tests/pirates.test.js flies the pilot through each).
 *  - the open drift: the run as it was, lines and vees, rocks in four belts;
 *  - the minefield: fighters in pincers and walls, and two fields of mines hung across the way, each plane with one
 *    gap (`field`: thread it, or shoot a way through);
 *  - the ice belt: fighters circling in as they close (`spiral`), the rocks shards of ice drifting across the way
 *    (`drift`: slow down to pick a way through);
 *  - the wreck field: fighters diving from above (`dive`), old hulks turning over in the way, drifting up and down.
 * `drift`: how far (m) the hazards swing across (u) and up (v) and how quickly (rad/s); `shape` what they are drawn as.
 */
export const LEVELS = [
  { id: 'drift', name: 'The open drift', script: SCRIPT, belts: BELTS, shape: 'rock', drift: null },
  { id: 'mines', name: 'The minefield', shape: 'rock', drift: null,
    belts: [[175, 700, 2.2], [1300, 1800, 3], [2150, 2450, 2], [2600, 2940, 2.4]],
    script: [
      { t: 1.2, say: 'start' },
      { t: 4, wave: 'pincer', n: 3 },
      { t: 10, wave: 'wall', n: 6, v: 1.5 },
      { t: 15, say: 'mines' },
      { t: 16, field: [{ gapU: -6, gapV: 2 }, { gapU: 5, gapV: -2 }] },
      { t: 21, wave: 'chase', n: 2 },
      { t: 27, wave: 'vee', n: 5 },
      { t: 30, ring: true, u: 4, v: 2 },
      { t: 33, checkpoint: 1 },
      { t: 34, wave: 'wall', n: 6, v: -2 },
      { t: 40, say: 'hauler' },
      { t: 41, wave: 'hauler', side: -1 },
      { t: 48, field: [{ gapU: 6, gapV: 3 }, { gapU: -2, gapV: -3 }] },
      { t: 52, wave: 'pincer', n: 3, v: 2 },
      { t: 56, wave: 'chase', n: 3 },
      { t: 63, ring: true, u: -4, v: -2 },
      { t: 66, checkpoint: 2 },
      { t: 67, say: 'captain' },
      { t: 70, boss: true },
    ] },
  { id: 'ice', name: 'The ice belt', shape: 'ice', drift: { u: 6, v: 1.2, w: 0.42 },
    belts: [[150, 950, 3.6], [1150, 1950, 4.4], [2080, 2480, 3], [2580, 2940, 3.2]],
    script: [
      { t: 1.2, say: 'start' },
      { t: 4, wave: 'spiral', n: 6, u: -4, v: 1 },
      { t: 10, wave: 'line', n: 5, side: 1 },
      { t: 13, say: 'ice' },
      { t: 17, wave: 'chase', n: 2 },
      { t: 24, wave: 'spiral', n: 6, u: 4, v: -1 },
      { t: 30, ring: true, u: -5, v: 2 },
      { t: 33, checkpoint: 1 },
      { t: 34, wave: 'vee', n: 6 },
      { t: 40, say: 'hauler' },
      { t: 41, wave: 'hauler', side: 1 },
      { t: 49, wave: 'spiral', n: 6, u: 0, v: 2 },
      { t: 55, wave: 'chase', n: 3 },
      { t: 63, ring: true, u: 4, v: -2 },
      { t: 66, checkpoint: 2 },
      { t: 67, say: 'captain' },
      { t: 70, boss: true },
    ] },
  { id: 'wrecks', name: 'The wreck field', shape: 'wreck', drift: { u: 1, v: 3, w: 0.33 },
    belts: [[200, 850, 2.6], [1200, 1850, 3.4], [2100, 2450, 2], [2600, 2940, 2.6]],
    script: [
      { t: 1.2, say: 'start' },
      { t: 4, wave: 'dive', n: 5, side: -1 },
      { t: 10, wave: 'vee', n: 5 },
      { t: 13, say: 'wrecks' },
      { t: 17, wave: 'chase', n: 2 },
      { t: 24, wave: 'dive', n: 6, side: 1 },
      { t: 30, ring: true, u: 5, v: -2 },
      { t: 33, checkpoint: 1 },
      { t: 34, wave: 'pincer', n: 3 },
      { t: 40, say: 'hauler' },
      { t: 41, wave: 'hauler', side: -1 },
      { t: 49, wave: 'dive', n: 6, side: -1 },
      { t: 55, wave: 'chase', n: 3 },
      { t: 63, ring: true, u: -4, v: 2 },
      { t: 66, checkpoint: 2 },
      { t: 67, say: 'captain' },
      { t: 70, boss: true },
    ] },
];
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
/**
 * The level of the flight to `to` (issue #494): the worlds of the route in their order take the levels in turn (so two
 * flights one after the other are never alike), a detour by its name's letters; the Arcade's game (no `to`) whichever
 * `pick` gives (pirates.js: a new one each time the page opens), or `stage` (a level's id, ?stage=…) when given.
 */
export function levelFor(to = null, { stage = null, order = ROUTE_ORDER, pick = 0 } = {}) {
  if (stage && LEVELS.some((l) => l.id === stage)) return levelById(stage);
  if (!to) return LEVELS[Math.abs(Math.floor(pick)) % LEVELS.length];
  const i = order.indexOf(to);
  // (the route's second world, the first ambushed, flies the open drift: the run met first is the one it always was)
  return LEVELS[(i >= 1 ? i - 1 : seedOf(to)) % LEVELS.length];
}
/** The route's worlds in order (src/levels/names.js ORDER, copied here so the rules stay pure: tests/pirates.test.js holds them alike). */
export const ROUTE_ORDER = ['desert', 'arzach', 'perdide', 'edena', 'underwater', 'incal', 'glassdunes', 'buried', 'moonfoundry', 'spheres', 'spacecity', 'bazaar'];
/** What a kill is worth. */
export const POINTS = { skiff: 10, raider: 30, hauler: 60, mine: 5, rock: 5, turret: 150, core: 500, ring: 20, hull: 50, multi: 25 };
/**
 * A missile's kill is worth this share of its points (issue #224: the missiles make the big pirates quick to down, and
 * the run's total, and the chimes it makes, stay where the bolts alone left them: tests/pirates.test.js).
 */
export const MISSILE_POINTS = 0.75;
/** Each kind's health, size (m) and how often it fires (s, 0: never). */
export const KINDS = {
  skiff: { hp: 1, r: 2.6, fire: 3.4 },
  raider: { hp: 6, r: 3.6, fire: 3.4 },   // (a fan of three each time, ATTACKS: one shot every 1.5 s until issue #326)
  hauler: { hp: 9, r: 6.2, fire: 0 },
  mine: { hp: 1, r: 2.0, fire: 0 },
  boss: { hp: 0, r: 0, fire: 0 },   // (its parts are hit, not it: BOSS)
};
/** The captain's gunship (a pirate craft built for space since v1.59, issue #206; a galleon under solar sails before): where its parts sit (u, v from its middle: the turrets on its wingtips, the bridge on its spine), their health and size; how long it stays. */
export const BOSS = {
  at: 72, enter: 5,          // m ahead it holds, s to come in
  stay: 52,                  // s it fights before it breaks off (the run then ends all the same, without its bounty; 75 until v1.45)
  parts: [
    { id: 'gunL', u: -11, v: 0.9, r: 3.4, hp: 32 },
    { id: 'gunR', u: 11, v: 0.9, r: 3.4, hp: 32 },
    { id: 'core', u: 0, v: 2.7, r: 3.9, hp: 78, armoured: true },   // (shut until both guns are down; 45, 45 and 110 until v1.45)
  ],
  volley: 2.0, burst: 3, ring: 2.6, ringN: 10, ringSpeed: 34, skiffs: 9,
};

/** A small seeded random (the rocks' layout: one per destination). */
export function rng(seed = 1) {
  let x = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}
/** A destination's seed: its id's letters. */
export const seedOf = (id = '') => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7);

/**
 * The rocks hung along the rail: { s, u, v, r, kind (0..2: the shape), tone (0..4), hp, spin } sorted by s.
 * Inside the ship's box they are kept few and never in a wall (a gap at least the ship's size in each 120 m).
 */
export function courseRocks(seed = 7, belts = BELTS, F = FLY) {
  const rand = rng(seed), out = [];
  for (const [s0, s1, per] of belts) {
    const n = Math.round(((s1 - s0) / 100) * per);
    for (let i = 0; i < n; i++) {
      const s = s0 + rand() * (s1 - s0);
      const inBox = rand() < 0.7;
      const r = inBox ? 1.1 + Math.pow(rand(), 2) * 3.6 : 4 + rand() * 14;
      const u = inBox ? (rand() * 2 - 1) * (F.boxU + 2) : (rand() < 0.5 ? -1 : 1) * (F.boxU + r + 6 + rand() * 40);
      const v = inBox ? (rand() * 2 - 1) * (F.boxV + 1.5) : (rand() * 2 - 1) * (F.boxV + 26);
      out.push({ s, u, v, r, kind: Math.floor(rand() * 3), tone: Math.floor(rand() * 5), hp: r < 2.2 ? 2 : Infinity, spin: (rand() - 0.5) * 1.2, hit: false, u0: u, v0: v, ph: rand() * Math.PI * 2 });
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

/**
 * The hazards' drift (issue #494, a level's `drift`: the ice belt's shards across the way, the wreck field's hulks up
 * and down): where each rock is at the run's time t, its swing a function of t alone (the same at any frame rate).
 */
export function driftRocks(S, D = S.level?.drift) {
  if (!D) return;
  const ahead = S.s + 420;
  for (let i = S.rockI; i < S.rocks.length; i++) {
    const r = S.rocks[i];
    if (r.s > ahead) break;
    r.u = r.u0 + D.u * Math.sin(D.w * S.t + r.ph);
    r.v = r.v0 + D.v * Math.sin(D.w * 0.8 * S.t + r.ph * 1.7);
  }
}

/**
 * A field of mines hung across the way (issue #494, the minefield): for each plane, mines on a grid over the ship's box
 * and a little past it, but for a gap (2 × 2 cells round `gapU`, `gapV`) the ship flies through; the planes `gap` m
 * apart. Still in space (they come on as the ship flies: faster on a boost), shot down in one, worth `pts` each.
 */
export const FIELD = { ahead: 260, apart: 34, step: 5, pts: 1 };
function layField(S, planes) {
  const F = S.F, out = [];
  planes.forEach((p, k) => {
    const ds = FIELD.ahead + k * FIELD.apart;
    for (let u = -F.boxU; u <= F.boxU + 0.01; u += FIELD.step) for (let v = -F.boxV; v <= F.boxV + 0.01; v += FIELD.step) {
      if (Math.abs(u - p.gapU) < FIELD.step && Math.abs(v - p.gapV) < FIELD.step) continue;   // (the gap: a 2 × 2 cells' hole)
      S.foes.push({ id: S.nextId++, kind: 'mine', field: true, pts: FIELD.pts, hp: 1, r: KINDS.mine.r, age: 0, flash: 0, ds, u, v, face: 'ship' });
    }
    out.push({ s: S.s + ds, u: p.gapU, v: p.gapV });
  });
  S.fields.push(...out);
}

// ------------------------------------------------------------------ a run
/**
 * A new run. `seed`: the rocks' layout (seedOf(destination)); `heat` 0..: how many ambushes came before (their fire a
 * little quicker each time); `gentle`: the Enemies setting's gentle (slower shots, half as many).
 */
export function newRun({ seed = 7, heat = 0, gentle = false, from = 0, fails = 0, score = 0, level = LEVELS[0] } = {}, F = FLY) {
  // (a lost run, again: from the checkpoint at `from` s, the waves before it gone by; `fails` lost runs so far: MERCY)
  const mercy = Math.min(fails, MERCY.safe);
  const hull = F.hull + Math.min(MERCY.most, mercy * MERCY.hull);
  const L = typeof level === 'string' ? levelById(level) : (level ?? LEVELS[0]);
  const script = L.script.slice();
  const next = from > 0 ? script.findIndex((e) => e.t > from) : 0;
  return {
    t: from, s: from * F.speed, F, rand: rng(seed * 7 + 3 + Math.round(from)), level: L,
    ship: { u: 0, v: -1, vu: 0, vv: 0, hull, hull0: hull, iframe: from > 0 ? 1.5 : 0, roll: 0, rollDir: 1, rollCool: 0, heldT: 0, charge: 0, lock: null, boltT: 0, side: 1, bank: 0, aimU: 0, aimV: 0,
      missiles: F.missile.count, missileCool: 0, aim: null,   // (aim: what a missile would lock now, for the HUD's bracket)
      // (issue #495: the speed along the rail, 1 cruising; the boost and brake's gauge, 0..1; the gun's tier: GUNS)
      speedK: 1, meter: 1, meterWait: 0, spent: false, throttle: null, gun: 0, gunBest: 0 },
    rocks: courseRocks(seed, L.belts), rockI: 0,
    foes: [], shots: [], bolts: [], rings: [], missiles: [], drops: [], fields: [], waves: {},
    script, next: next < 0 ? script.length : next, nextId: 1,
    boss: null, score, kills: 0, hits: 0, fired: 0, done: null,
    from, checkpoint: from, scoreAt: score, safe: fails >= MERCY.safe,   // (scoreAt: the points at the last checkpoint, kept for a retry)
    fireK: (gentle ? 0.5 : 1) * (1 + 0.06 * Math.min(heat, 10)) * Math.max(MERCY.least, 1 - MERCY.fire * mercy), shotK: gentle ? 0.75 : 1,
  };
}

/**
 * The input the rules read: the game's merged controls through kit/input.js readInput, and the raw buttons.
 * `climb`: the stick forward climbs (the start card's choice, offered only once the pirates have been beaten: issue
 * #206); by default, and always the first time, pushing up dives, as a plane's, as in Star Fox 64 and as the jets fly.
 */
export function pirateInput(inp = {}, raw = {}, { climb = false } = {}) {
  const fire = !!(inp.jump || raw.TouchFire);
  return {
    // (a missile: LT / L2, F, or the touch ◇: issue #224)
    missile: !!(raw.PadAim || raw.KeyF || raw.TouchGuard),
    x: inp.x ?? 0,
    y: (climb ? 1 : -1) * (inp.y ?? 0),
    fire,
    auto: (inp.trigger ?? 0) > 0.5,         // RT / R2 held: a stream of bolts, no charge
    // (issue #495: RB / R1, Shift or the touch run toggle boosts; LB / L1, Z (the guard's key) or the touch ⚔ brakes. The roll left
    // LB and Shift for them: B / ○, X / □, E, the touch ↶)
    boost: !!(inp.boost || raw.PadBlade),
    brake: !!(raw.PadGuard || raw.KeyZ || raw.TouchBlade),
    roll: !!(inp.action || raw.PadEvade || raw.TouchEvade),
  };
}

/** Where a bolt fired now would be, `ds` m ahead: the reticle (the ship's place, its sideways speed kept in part, and the nose's slope). */
export function aimAt(P, ds, F = FLY) {
  const t = ds / F.bolt.speed;
  return { u: P.u + (P.vu * F.bolt.lead) * t + P.aimU * ds, v: P.v - 0.1 + (P.vv * F.bolt.lead) * t + P.aimV * ds };
}

function spawnWave(S, w) {
  const F = S.F;
  // (a wave of fighters: downed to the last one, it leaves a gun drop, issue #495)
  const wave = S.nextId;
  if (['line', 'vee', 'pincer', 'wall', 'spiral', 'dive'].includes(w.wave) && !w.noDrop) S.waves[wave] = { n: 0, down: 0, lost: false };
  const add = (o) => { const K = KINDS[o.kind]; const e = { id: S.nextId++, hp: K.hp, r: K.r, fireT: 0.6 + S.rand() * (K.fire || 1), age: 0, flash: 0, ...o }; if (S.waves[wave] && o.kind === 'skiff') { e.wave = wave; S.waves[wave].n++; } S.foes.push(e); return e; };
  if (w.wave === 'line') {
    // skiffs in a column, one behind the other, sweeping across the view as they close
    for (let i = 0; i < w.n; i++) add({ kind: 'skiff', path: 'line', side: w.side ?? 1, delay: i * 0.38, v0: w.v ?? 0, i, ds: 170, u: (w.side ?? 1) * 30, v: w.v ?? 0 });
  } else if (w.wave === 'pincer') {
    // (issue #494) two columns at once, one from either side, crossing in front of the ship
    for (const side of [-1, 1]) for (let i = 0; i < w.n; i++) add({ kind: 'skiff', path: 'line', side, delay: i * 0.42 + (side > 0 ? 0.2 : 0), v0: (w.v ?? 0) + side * 2.5, i, ds: 170, u: side * 30, v: (w.v ?? 0) + side * 2.5 });
  } else if (w.wave === 'wall') {
    // (issue #494) a row abreast across the whole box, sliding in, firing, peeling up and away as it comes close
    for (let i = 0; i < w.n; i++) { const k = i - (w.n - 1) / 2; add({ kind: 'skiff', path: 'wall', k, u0: k * (2 * F.boxU / Math.max(1, w.n - 1)) * 0.9, v0: w.v ?? 0, delay: Math.abs(k) * 0.12, ds: 200, u: k * 5, v: (w.v ?? 0) + 8 }); }
  } else if (w.wave === 'spiral') {
    // (issue #494) a ring of fighters turning round a point as they close: the gap in it comes round
    for (let i = 0; i < w.n; i++) add({ kind: 'skiff', path: 'spiral', a0: (i / w.n) * Math.PI * 2, cu: w.u ?? 0, cv: w.v ?? 0, ds: 190, u: w.u ?? 0, v: w.v ?? 0 });
  } else if (w.wave === 'dive') {
    // (issue #494) from high above, one after another, swooping down across the way and under it
    for (let i = 0; i < w.n; i++) add({ kind: 'skiff', path: 'dive', side: w.side ?? 1, i, delay: i * 0.45, u0: (w.side ?? 1) * (10 - i * 3.2), ds: 130, u: 0, v: 26 });
  } else if (w.wave === 'vee') {
    for (let i = 0; i < w.n; i++) { const k = i - (w.n - 1) / 2; add({ kind: 'skiff', path: 'vee', k, ds: 180 + Math.abs(k) * 7, u: k * 4.2, v: 1 + Math.abs(k) * 0.6 }); }
  } else if (w.wave === 'chase') {
    // raiders from behind: they overtake from under the ship and hold ahead, strafing, firing
    for (let i = 0; i < w.n; i++) { const side = i % 2 ? 1 : -1; add({ kind: 'raider', path: 'chase', ph: i * 2.1, side, ds: -30 - i * 8, u: side * (6 + i * 2), v: -F.boxV - 6 }); }
  } else if (w.wave === 'hauler') {
    add({ kind: 'hauler', path: 'hauler', side: w.side, ds: 240, u: w.side * 26, v: 4, mineT: 1.2 });
  }
}

function spawnBoss(S) {
  S.boss = {
    age: 0, ds: 260, u: 0, v: 3, parts: BOSS.parts.map((p) => ({ ...p, hp0: p.hp, flash: 0, gone: false })),
    volleyT: 2.5, gun: 0, burstLeft: 0, burstT: 0, ringT: 2, skiffT: 6, fled: false, dying: 0, open: false,
  };
}

/** Where a boss part is now (rail-relative: ds, u, v). */
export function partAt(B, p) { return { ds: B.ds, u: B.u + p.u, v: B.v + p.v }; }
const liveParts = (B) => B.parts.filter((p) => !p.gone && !(p.armoured && !B.open));

/** One step of the run (dt s). Returns the events of the step. */
export function runStep(S, inp = {}, dt = 1 / 60) {
  const F = S.F, P = S.ship, ev = [];
  if (S.done) return ev;
  S.t += dt;
  throttle(S, inp, dt, ev);
  S.s += F.speed * P.speedK * dt;
  driftRocks(S);

  // the script: waves, rings, lines, the captain
  while (S.next < S.script.length && S.script[S.next].t <= S.t) {
    const e = S.script[S.next++];
    if (e.wave) spawnWave(S, e);
    if (e.field) layField(S, e.field);
    if (e.ring) S.rings.push({ s: S.s + 230, u: e.u ?? 0, v: e.v ?? 0, r: 3.4, taken: false });
    if (e.say) ev.push({ kind: 'say', id: e.say });
    if (e.boss) spawnBoss(S);
    if (e.checkpoint) { S.checkpoint = e.t; S.scoreAt = S.score; ev.push({ kind: 'checkpoint', n: e.checkpoint }); }
  }

  // ---------------------------------------------------------------- the ship
  P.rollCool = Math.max(0, P.rollCool - dt);
  if (inp.roll && !P.rollHeld && P.rollCool <= 0) {
    P.rollDir = Math.sign(inp.x || 0) || -P.rollDir || 1;
    P.roll = F.roll.dur; P.rollCool = F.roll.dur + F.roll.cool;
    P.vu += P.rollDir * F.roll.push;
    ev.push({ kind: 'roll', dir: P.rollDir });
  }
  P.rollHeld = !!inp.roll;
  P.roll = Math.max(0, P.roll - dt);
  // the stick sets the speed across it goes at; the ship takes it up with some weight (an easing), and slows to a stop
  // over the box's last stretch instead of meeting a wall
  const soft = (pos, box, want) => (Math.sign(want) === Math.sign(pos) ? want * clamp((box - Math.abs(pos)) / (box * F.edge), 0, 1) : want);
  const curve = (x) => Math.sign(x) * Math.pow(Math.abs(clamp(x, -1, 1)), F.curve ?? 1);
  const tu = soft(P.u, F.boxU, curve(inp.x ?? 0) * F.steer), tv = soft(P.v, F.boxV, curve(inp.y ?? 0) * F.steer * 0.8);
  // (taken up with the response's easing; let go or turned back, the brake's, quicker: it stops where it is left)
  const ease = (want, have) => 1 - Math.exp(-(Math.abs(want) < Math.abs(have) - 0.5 || want * have < 0 ? F.brake ?? F.response : F.response) * dt);
  P.vu += (tu - P.vu) * ease(tu, P.vu) * (P.roll > 0 ? 0.4 : 1);   // (rolling, the shove carries it)
  P.vv += (tv - P.vv) * ease(tv, P.vv);
  P.u += P.vu * dt; P.v += P.vv * dt;
  if (Math.abs(P.u) > F.boxU) { P.u = Math.sign(P.u) * F.boxU; if (Math.sign(P.vu) === Math.sign(P.u)) P.vu = 0; }
  if (Math.abs(P.v) > F.boxV) { P.v = Math.sign(P.v) * F.boxV; if (Math.sign(P.vv) === Math.sign(P.v)) P.vv = 0; }
  // banked hard into the turn; the nose points the way it goes (the bolts follow it: aimAt)
  P.bank += (-(P.vu / F.steer) * F.bank.max - P.bank) * Math.min(1, dt * F.bank.rate);
  P.aimU = clamp(P.vu / F.steer, -1, 1) * F.aim;
  P.aimV = clamp(P.vv / (F.steer * 0.8), -1, 1) * F.aim * 0.8;
  P.iframe = Math.max(0, P.iframe - dt);

  // fire: a tap shoots the twin bolts; held, it charges (and locks); let go charged, the homing shot
  const B = F.bolt, gun = gunOf(S);
  P.boltT = Math.max(0, P.boltT - dt);
  const shoot = (every = gun.every) => {
    if (P.boltT > 0) return;
    P.boltT = every;
    // (aim assist, issue #326: a pirate near the line of fire draws the bolts part of the way to it)
    const A = F.assist, near = A ? aimTarget(S, A.slack) : null, at = near ? targetPos(S, near) : null;
    for (const side of [-1, 1]) {
      let vu = P.vu * B.lead + P.aimU * B.speed, vv = P.vv * B.lead + P.aimV * B.speed;
      const u0 = P.u + side * B.spread, v0 = P.v - 0.1;
      if (at && at.ds > 2) {
        const t = (at.ds - 2) / B.speed;
        vu += ((at.u + side * B.spread * 0.4 - u0) / t - vu) * A.k;
        vv += ((at.v - v0) / t - vv) * A.k;
      }
      S.bolts.push({ ds: 2, u: u0, v: v0, vu, vv, vds: B.speed, life: B.life, charged: false, r: gun.r, tier: P.gun });
      // (the spread's two more, fanned out either side of the nose: issue #495)
      if (gun.fan) S.bolts.push({ ds: 2, u: u0 + side * 0.3, v: v0, vu: P.vu * B.lead + (P.aimU + side * gun.fan) * B.speed, vv: P.vv * B.lead + P.aimV * B.speed, vds: B.speed, life: B.life * 0.8, charged: false, r: gun.r, tier: P.gun, fan: side });
    }
    S.fired++;
    ev.push({ kind: 'shot', assisted: !!at, tier: P.gun });
  };
  if (inp.fire && !P.fireHeld) { shoot(); P.heldT = 0; }
  if (inp.fire) {
    P.heldT += dt;
    if (P.heldT > F.charge.after) {
      P.charge = Math.min(1, P.charge + dt / F.charge.full);
      const was = P.lock;
      if (!P.lock || !targetAlive(S, P.lock)) P.lock = findLock(S);
      if (P.lock && P.lock !== was) ev.push({ kind: 'lock' });
    }
  } else if (P.fireHeld) {
    if (P.charge >= 1) {
      const lock = P.lock && targetAlive(S, P.lock) ? P.lock : null;
      S.bolts.push({ ds: 2.5, u: P.u, v: P.v, vu: 0, vv: 0, vds: F.charge.speed, life: F.charge.life, charged: true, target: lock });
      ev.push({ kind: 'charged', locked: !!lock });
    }
    P.charge = 0; P.heldT = 0; P.lock = null;
  }
  if (inp.auto && !inp.fire) shoot(gun.auto);   // (RT / R2 held: a steady stream, slower than tapping)
  P.fireHeld = !!inp.fire;
  if (P.lock && !targetAlive(S, P.lock)) P.lock = null;

  // a missile (issue #224): a press looses one at what lies nearest the reticle (or straight on, with nothing there)
  const M = F.missile;
  P.missileCool = Math.max(0, P.missileCool - dt);
  P.aim = P.missiles > 0 ? findLock(S, M.cone) : null;
  if (inp.missile && !P.missileHeld) {
    if (P.missiles <= 0) ev.push({ kind: 'dry' });
    else if (P.missileCool <= 0) {
      P.missiles--; P.missileCool = M.cool;
      const target = P.aim;
      S.missiles.push({ ds: 1.5, u: P.u, v: P.v - 0.6, vu: P.vu * 0.5, vv: -6, vds: M.speed, life: M.life, target, age: 0 });
      ev.push({ kind: 'missile', locked: !!target, left: P.missiles });
    }
  }
  P.missileHeld = !!inp.missile;

  // ---------------------------------------------------------------- the pirates
  for (const e of S.foes) moveFoe(S, e, dt, ev);
  if (S.boss) moveBoss(S, dt, ev);

  // their shots
  for (const b of S.shots) { b.ds += (b.vds - 0) * dt; b.u += b.vu * dt; b.v += b.vv * dt; b.life -= dt; }

  // the ship's bolts, and what they hit
  for (const b of S.bolts) {
    const ds0 = b.ds;
    if (b.charged && b.target) {
      const at = targetPos(S, b.target);
      if (at) {
        const dx = at.ds - b.ds, du = at.u - b.u, dv = at.v - b.v, d = Math.hypot(dx, du, dv) || 1;
        const sp = F.charge.speed, k = Math.min(1, F.charge.turn * dt);
        b.vds += (dx / d * sp - b.vds) * k; b.vu += (du / d * sp - b.vu) * k; b.vv += (dv / d * sp - b.vv) * k;
      }
    }
    b.ds += b.vds * dt; b.u += b.vu * dt; b.v += b.vv * dt; b.life -= dt;
    if (b.life <= 0) { if (b.charged) blast(S, b, ev); continue; }
    boltHits(S, b, ds0, ev);
  }

  // the missiles: they speed up and turn after their target; what they meet takes the hit
  for (const m of S.missiles) {
    const ds0 = m.ds;
    m.age += dt;
    const sp = Math.min(M.top, Math.hypot(m.vds, m.vu, m.vv) + M.accel * dt);
    const at = m.target ? targetPos(S, m.target) : null;
    if (!at && m.target) m.target = null;
    let dx = 1, du = 0, dv = 0;
    if (at) { dx = at.ds - m.ds; du = at.u - m.u; dv = at.v - m.v; }
    const d = Math.hypot(dx, du, dv) || 1, k = Math.min(1, M.turn * dt * (m.age < 0.15 ? 0.3 : 1));   // (a moment's drop off the rail before it turns)
    m.vds += (dx / d * sp - m.vds) * k; m.vu += (du / d * sp - m.vu) * k; m.vv += (dv / d * sp - m.vv) * k;
    const n = Math.hypot(m.vds, m.vu, m.vv) || 1;
    m.vds *= sp / n; m.vu *= sp / n; m.vv *= sp / n;
    m.ds += m.vds * dt; m.u += m.vu * dt; m.v += m.vv * dt; m.life -= dt;
    if (m.life <= 0) { ev.push({ kind: 'missileHit', at: { ds: m.ds, u: m.u, v: m.v }, n: 0 }); continue; }
    missileHits(S, m, ds0, ev);
  }
  S.missiles = S.missiles.filter((m) => m.life > 0);

  // the rocks, the mines' and the rings' still places, the drops (issue #495), the ship's knocks
  rocksAndRings(S, ev);
  moveDrops(S, dt, ev);
  shipHits(S, ev);

  // (a fighter of a wave gone by, or rammed, and the wave leaves no drop)
  for (const e of S.foes) if (e.wave != null && (e.gone || (e.dead && !e.downed)) && S.waves[e.wave]) S.waves[e.wave].lost = true;
  S.foes = S.foes.filter((e) => !e.dead && !e.gone);
  S.shots = S.shots.filter((b) => b.life > 0 && b.ds > -25 && b.ds < 320);
  S.bolts = S.bolts.filter((b) => b.life > 0);
  S.rings = S.rings.filter((r) => r.s - S.s > -20);
  S.drops = S.drops.filter((d) => !d.taken && d.s - S.s > -20 && d.age < DROPS.life);
  S.fields = S.fields.filter((f) => f.s - S.s > -20);

  // the end: the hull gone, or the captain sunk (or gone off) with the field clear
  if (P.hull <= 0) { S.done = 'dead'; ev.push({ kind: 'dead' }); }
  else if (S.boss && (S.boss.dying > 1.6 || S.boss.fled)) { S.done = 'won'; S.score += P.hull * POINTS.hull; ev.push({ kind: 'win', sunk: !S.boss.fled, hull: P.hull, score: S.score, chimes: chimesFor(S.score) }); }
  return ev;
}

function targetAlive(S, t) {
  if (t.part) return !!S.boss && !t.part.gone && !(t.part.armoured && !S.boss.open) && !S.boss.dying;
  return !t.foe.dead && !t.foe.gone;
}
export function targetPos(S, t) {
  if (!targetAlive(S, t)) return null;
  if (t.part) return partAt(S.boss, t.part);
  return t.foe;
}
/** What a charged shot locks now: the pirate nearest the aim, within FLY.lock's cone (or a missile's wider `cone`), or null. */
export function findLock(S, cone = S.F.lock.cone) {
  const P = S.ship, L = { ...S.F.lock, cone };
  let best = null, bd = Infinity;
  const consider = (t, at, r) => {
    if (at.ds < L.near || at.ds > L.far) return;
    const aim = aimAt(P, at.ds, S.F);   // (round the reticle at its distance: where the nose points)
    const off = Math.hypot(at.u - aim.u, at.v - aim.v) - r;
    const k = off / at.ds;
    if (k < L.cone && k < bd) { bd = k; best = t; }
  };
  for (const f of S.foes) if (!f.dead && f.kind !== 'mine') consider({ foe: f }, f, f.r);
  if (S.boss && !S.boss.dying && S.boss.age > BOSS.enter) for (const p of liveParts(S.boss)) consider({ part: p }, partAt(S.boss, p), p.r);
  return best;
}

/**
 * What the line of fire runs through now (issue #206, the reticle): the pirate or the captain's part whose body the
 * bolts' way (aimAt) passes within `slack` m of, nearest first, or null. The reticle tightens on it and turns coral.
 */
export function aimTarget(S, slack = 0.6) {
  const P = S.ship, L = S.F.lock;
  let best = null, bd = Infinity;
  const consider = (t, at, r) => {
    if (at.ds < L.near || at.ds > L.far) return;
    const aim = aimAt(P, at.ds, S.F);
    if (Math.hypot(at.u - aim.u, at.v - aim.v) < r + slack && at.ds < bd) { bd = at.ds; best = t; }
  };
  for (const f of S.foes) if (!f.dead && !f.hidden) consider({ foe: f }, f, f.r);
  if (S.boss && !S.boss.dying && S.boss.age > 1) for (const p of S.boss.parts) if (!p.gone) consider({ part: p }, partAt(S.boss, p), p.r);
  return best;
}

function fireAt(S, from, ev, { speed = S.F.enemyShot.speed * S.shotK, spread = 0, lead = 0.5, offset = 0, by = null } = {}) {
  const P = S.ship;
  // aimed where the ship will be (a little lead), its shots closing at `speed`
  const tx = -from.ds, d0 = Math.max(4, Math.abs(tx));
  const t = d0 / speed;
  const du = P.u + P.vu * t * lead - from.u + offset + spread * (S.rand() - 0.5), dv = P.v + P.vv * t * lead - from.v + spread * (S.rand() - 0.5);
  const d = Math.hypot(tx, du, dv) || 1;
  S.shots.push({ ds: from.ds, u: from.u, v: from.v, vds: (tx / d) * speed, vu: (du / d) * speed, vv: (dv / d) * speed, life: S.F.enemyShot.life, r: S.F.enemyShot.r });
  ev.push({ kind: 'enemyShot', at: { ds: from.ds, u: from.u, v: from.v }, by });
}

function moveFoe(S, e, dt, ev) {
  const F = S.F;
  e.age += dt; e.flash = Math.max(0, e.flash - dt); e.tellK = 0;
  const t = e.age - (e.delay ?? 0);
  if (e.kind === 'mine') { e.ds -= F.speed * S.ship.speedK * dt; if (e.ds < -15) e.gone = true; return; }   // (still in space: closing as fast as the ship flies, issue #495)
  if (t < 0) { e.hidden = true; return; }
  e.hidden = false;
  if (e.path === 'line') {
    e.ds = 150 - 36 * t;
    e.u = e.side * (24 - 11 * t);
    e.v = e.v0 + 2.2 * Math.sin(2.1 * t + e.i);
    e.face = 'ship';
    if (e.ds < -12 || Math.abs(e.u) > 40) e.gone = true;
  } else if (e.path === 'vee') {
    e.ds -= 33 * dt;
    if (e.ds < 55) { e.u += Math.sign(e.k || 0.5) * 18 * dt; e.v += 6 * dt; }
    e.face = 'ship';
    if (e.ds < -12 || Math.abs(e.u) > 40) e.gone = true;
  } else if (e.path === 'wall') {
    // (issue #494) abreast, dropping into place from above, closing slowly with a sway; close in, they peel up and over
    e.ds -= 30 * dt;
    e.u = e.u0 + 1.6 * Math.sin(1.3 * t + e.k);
    e.v += ((e.ds < 50 ? e.v0 + (50 - e.ds) * 0.45 : e.v0) - e.v) * Math.min(1, dt * 2.5);
    e.face = 'ship';
    if (e.ds < -12) e.gone = true;
  } else if (e.path === 'spiral') {
    // (issue #494) a ring turning round its middle as it closes, the ring tightening
    const R = 9 - 4 * Math.min(1, t / 5), a = e.a0 + 1.5 * t;
    e.ds = 190 - 34 * t;
    e.u = e.cu + R * Math.cos(a); e.v = e.cv + R * 0.62 * Math.sin(a);
    e.face = 'ship';
    if (e.ds < -12) e.gone = true;
  } else if (e.path === 'dive') {
    // (issue #494) down from high above in a swoop across the way, then out under it
    e.ds = 130 - 26 * t;
    e.u = e.u0 - e.side * 7 * Math.sin(Math.min(Math.PI, t * 0.9));
    e.v = 26 - 9.5 * t + 0.9 * t * t * 0.5;
    e.face = 'ship';
    if (e.ds < -12 || e.v < -30) e.gone = true;
  } else if (e.path === 'chase') {
    const hold = 50 + 6 * Math.sin(e.ph);
    if (!e.held) {
      e.ds += 34 * dt;
      e.v += (1.5 - e.v) * Math.min(1, dt * 1.2);
      e.face = 'away';
      if (e.ds >= hold) { e.held = e.age; }
    } else {
      const h = e.age - e.held;
      if (h < 10) {
        e.ds += (hold - e.ds) * Math.min(1, dt * 2);
        e.u += (e.side * 7 * Math.sin(0.8 * h + e.ph) - e.u) * Math.min(1, dt * 1.5);
        e.v += (3.5 * Math.sin(1.25 * h + e.ph) - e.v) * Math.min(1, dt * 1.5);
        e.face = 'ship';
      } else { e.ds += 45 * dt; e.v += 10 * dt; e.face = 'away'; if (e.ds > 300) e.gone = true; }
    }
  } else if (e.path === 'hauler') {
    if (e.ds > 95) { e.ds -= 22 * dt; e.u += (e.side * 20 - e.u) * Math.min(1, dt); }
    else {
      e.ds += (95 - e.ds) * Math.min(1, dt);
      e.u -= e.side * 4.6 * dt;
      e.v = 4 + 1.5 * Math.sin(e.age * 0.7);
      const lays = Math.abs(e.u) < F.boxU + 4, T = ATTACKS.hauler.tell;
      if (lays && e.mineT < T) {
        // (its bay lamp blinks before each mine: issue #326)
        e.tellK = clamp(1 - e.mineT / T, 0, 1);
        if (!e.told) { e.told = true; ev.push({ kind: 'tell', foe: 'hauler', id: e.id, dur: T, at: { ds: e.ds, u: e.u, v: e.v } }); }
      }
      if ((e.mineT -= dt) <= 0 && lays) {
        e.mineT = 1.15; e.told = false;
        S.foes.push({ id: S.nextId++, kind: 'mine', hp: 1, r: KINDS.mine.r, age: 0, flash: 0, ds: e.ds - 4, u: e.u, v: e.v - 3, face: 'ship' });
        ev.push({ kind: 'mine' });
      }
      if (Math.abs(e.u) > 34 && Math.sign(e.u) === -e.side) e.gone = true;
    }
    e.face = 'side';
  }
  // firing: aimed shots while ahead and in front of the ship
  // each kind its own attack, after its telegraph (ATTACKS, issue #326)
  const K = KINDS[e.kind], A = ATTACKS[e.kind];
  if (K.fire && e.ds > 18 && e.ds < 190 && !e.gone) {
    e.fireT -= dt * S.fireK;
    if (e.fireT < A.tell) {
      e.tellK = clamp(1 - e.fireT / A.tell, 0, 1);
      if (!e.told) { e.told = true; ev.push({ kind: 'tell', foe: e.kind, id: e.id, dur: A.tell / S.fireK, at: { ds: e.ds, u: e.u, v: e.v } }); }
    }
    if (e.fireT <= 0) {
      e.fireT = K.fire * (0.8 + 0.4 * S.rand()); e.told = false;
      if (A.attack === 'fan') { e.burstLeft = A.n; e.burstT = 0; }
      else fireAt(S, e, ev, { spread: 5, by: e.kind });
    }
  } else if (e.told && !e.burstLeft) { e.told = false; }
  // the gunboat's fan: three shots, a beat apart, left of the ship, at it, right of it
  if (e.burstLeft > 0 && !e.gone && (e.burstT -= dt) <= 0) {
    const i = A.n - e.burstLeft;
    fireAt(S, e, ev, { spread: 0.8, offset: (i - (A.n - 1) / 2) * A.fan, by: e.kind });
    e.burstLeft--; e.burstT = A.gap;
  }
}

function moveBoss(S, dt, ev) {
  const B = S.boss;
  B.age += dt; B.tellK = 0;
  for (const p of B.parts) p.flash = Math.max(0, p.flash - dt);
  if (B.dying) { B.dying += dt; B.ds += 6 * dt; B.v -= 2 * dt; return; }
  if (B.age < BOSS.enter) { B.ds = 260 - (260 - BOSS.at) * easeOut(B.age / BOSS.enter); return; }
  const t = B.age - BOSS.enter;
  if (t > BOSS.stay) {
    // breaking off: it climbs away ahead
    B.ds += 60 * dt; B.v += 12 * dt;
    if (B.ds > 340) B.fled = true;
    return;
  }
  B.ds = BOSS.at + 5 * Math.sin(t * 0.4);
  B.u = 6.5 * Math.sin(t * 0.42);
  B.v = 2.5 + 2.6 * Math.sin(t * 0.67);
  B.open = B.parts.filter((p) => p.id !== 'core').every((p) => p.gone);
  const guns = B.parts.filter((p) => p.id !== 'core' && !p.gone);
  // the guns: bursts of aimed shots, one gun then the other
  if (guns.length) {
    if (B.burstLeft > 0) {
      if ((B.burstT -= dt) <= 0) { const g = guns[B.gun % guns.length]; fireAt(S, partAt(B, g), ev, { spread: 1.2, by: g.id }); B.burstLeft--; B.burstT = 0.16; }
    } else {
      // (the next turret glows hot before its volley: issue #326)
      B.volleyT -= dt * S.fireK;
      const g = guns[(B.gun + 1) % guns.length], T = ATTACKS.boss.tell;
      if (B.volleyT < T) {
        B.tellK = clamp(1 - B.volleyT / T, 0, 1); B.tellPart = g.id;
        if (!B.told) { B.told = true; ev.push({ kind: 'tell', foe: 'boss', part: g.id, dur: T / S.fireK, at: partAt(B, g) }); }
      }
      if (B.volleyT <= 0) { B.volleyT = BOSS.volley; B.gun++; B.burstLeft = BOSS.burst; B.burstT = 0; B.told = false; }
    }
  } else {
    // the core open: rings of slow shots, and skiffs launched from the hold
    const T = ATTACKS.boss.ringTell;
    if (B.ringT - dt * S.fireK < T) {
      // (the bridge's lens swells before each ring)
      B.tellK = clamp(1 - B.ringT / T, 0, 1); B.tellPart = 'core';
      if (!B.toldRing) { B.toldRing = true; ev.push({ kind: 'tell', foe: 'boss', part: 'core', dur: T / S.fireK, at: partAt(B, B.parts.find((p) => p.id === 'core')) }); }
    }
    if ((B.ringT -= dt * S.fireK) <= 0) {
      B.ringT = BOSS.ring; B.toldRing = false;
      const c = partAt(B, B.parts.find((p) => p.id === 'core'));
      const sp = BOSS.ringSpeed * S.shotK, rot = S.rand() * Math.PI;
      for (let i = 0; i < BOSS.ringN; i++) {
        const a = rot + (i / BOSS.ringN) * Math.PI * 2;
        const du = Math.cos(a) * 0.32, dv = Math.sin(a) * 0.32, d = Math.hypot(1, du, dv);
        S.shots.push({ ds: c.ds, u: c.u, v: c.v, vds: -sp / d, vu: (du / d) * sp + (S.ship.u - c.u) / (c.ds / sp) * 0.5, vv: (dv / d) * sp + (S.ship.v - c.v) / (c.ds / sp) * 0.5, life: 4, r: 1.0, big: true });
      }
      ev.push({ kind: 'enemyShot', ring: true, at: c, by: 'core' });
    }
    if ((B.skiffT -= dt) <= 0) { B.skiffT = BOSS.skiffs; spawnWave(S, { wave: 'line', n: 3, side: S.rand() < 0.5 ? -1 : 1, v: B.v, noDrop: true }); }
  }
}
const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

function damage(S, target, dmg, ev, by = 'bolt') {
  const share = by === 'missile' ? MISSILE_POINTS : 1;   // (a missile's kill is worth less: the totals stay as they were)
  if (target.part) {
    const B = S.boss, p = target.part;
    if (p.gone || B.dying) return false;
    if (p.armoured && !B.open) { ev.push({ kind: 'clank', at: partAt(B, p) }); return true; }
    p.hp -= dmg; p.flash = 0.12;
    if (p.hp > 0) ev.push({ kind: 'hit', by, part: p.id, at: partAt(B, p) });
    if (p.hp <= 0) {
      p.gone = true;
      const pts = Math.round((p.id === 'core' ? POINTS.core : POINTS.turret) * share);
      S.score += pts; S.kills++;
      ev.push({ kind: 'part', id: p.id, at: partAt(B, p), pts });
      if (p.id !== 'core' && DROPS.from.part) drop(S, partAt(B, p), ev);
      if (p.id === 'core') { B.dying = 0.001; ev.push({ kind: 'sunk', at: partAt(B, p) }); }
      else if (B.parts.filter((q) => q.id !== 'core').every((q) => q.gone)) ev.push({ kind: 'say', id: 'open' });
    }
    return true;
  }
  const e = target.foe;
  if (e.dead || e.hidden) return false;
  e.hp -= dmg; e.flash = 0.12;
  if (e.hp > 0) ev.push({ kind: 'hit', by, foe: e.kind, at: { ds: e.ds, u: e.u, v: e.v } });
  if (e.hp <= 0) {
    e.dead = true; e.downed = true;
    const pts = Math.round((e.pts ?? POINTS[e.kind] ?? 0) * share);
    S.score += pts; S.kills++;
    ev.push({ kind: 'kill', foe: e.kind, at: { ds: e.ds, u: e.u, v: e.v }, pts, by });
    // (issue #495: a gunboat and a bomber leave a gun drop; so does a wave of fighters downed to the last)
    if (DROPS.from[e.kind]) drop(S, e, ev);
    const W = e.wave != null ? S.waves[e.wave] : null;
    if (W && !W.lost && ++W.down === W.n && DROPS.from.wave) drop(S, e, ev, 'wave');
  }
  return true;
}

/** Does a bolt, gone from ds0 to b.ds this step, pass within r of (ds, u, v)? */
function sweep(b, ds0, at, r) {
  const lo = Math.min(ds0, b.ds) - r, hi = Math.max(ds0, b.ds) + r;
  return at.ds >= lo && at.ds <= hi && Math.hypot(at.u - b.u, at.v - b.v) < r;
}

function boltHits(S, b, ds0, ev) {
  const R = b.charged ? 2.2 : (b.r ?? S.F.bolt.r);
  // the boss's parts
  if (S.boss && !S.boss.dying && S.boss.age > 1) {
    for (const p of S.boss.parts) {
      if (p.gone) continue;
      if (sweep(b, ds0, partAt(S.boss, p), p.r + R)) {
        if (b.charged) blast(S, b, ev); else damage(S, { part: p }, 1, ev);
        b.life = 0; return;
      }
    }
  }
  for (const e of S.foes) {
    if (e.dead || e.hidden) continue;
    if (sweep(b, ds0, e, e.r + R)) {
      if (b.charged) blast(S, b, ev); else damage(S, { foe: e }, 1, ev);
      b.life = 0; return;
    }
  }
  // the rocks absorb it (the small ones crack after two)
  const s = S.s;
  for (let i = S.rockI; i < S.rocks.length; i++) {
    const r = S.rocks[i];
    if (r.s - s > b.ds + 10) break;
    if (r.gone) continue;
    if (sweep(b, ds0, { ds: r.s - s, u: r.u, v: r.v }, r.r + R * 0.5)) {
      b.life = 0;
      if (b.charged) { blast(S, b, ev); return; }
      if (Number.isFinite(r.hp) && --r.hp <= 0) { r.gone = true; S.score += POINTS.rock; ev.push({ kind: 'rock', at: { ds: r.s - s, u: r.u, v: r.v }, r: r.r, pts: POINTS.rock }); }
      else ev.push({ kind: 'spark', at: { ds: r.s - s, u: r.u, v: r.v }, r: r.r });
      return;
    }
  }
}

/** A missile, gone from ds0 to m.ds this step: the first pirate, part or rock it meets takes it, a splash round it. */
function missileHits(S, m, ds0, ev) {
  const M = S.F.missile;
  let hit = null;
  if (S.boss && !S.boss.dying && S.boss.age > 1) for (const p of S.boss.parts) if (!p.gone && sweep(m, ds0, partAt(S.boss, p), p.r + M.r)) { hit = { part: p }; break; }
  if (!hit) for (const e of S.foes) if (!e.dead && !e.hidden && sweep(m, ds0, e, e.r + M.r)) { hit = { foe: e }; break; }
  if (!hit) {
    for (let i = S.rockI; i < S.rocks.length; i++) {
      const r = S.rocks[i];
      if (r.s - S.s > m.ds + 10) break;
      if (!r.gone && sweep(m, ds0, { ds: r.s - S.s, u: r.u, v: r.v }, r.r)) { m.life = 0; ev.push({ kind: 'missileHit', at: { ds: m.ds, u: m.u, v: m.v }, n: 0, rock: true }); return; }
    }
    return;
  }
  m.life = 0;
  const at = { ds: m.ds, u: m.u, v: m.v }, k = S.kills;
  damage(S, hit, M.dmg, ev, 'missile');
  // the splash: the other pirates close by take a little, their shots there are gone
  const near = (p, r) => Math.hypot(p.ds - at.ds, p.u - at.u, p.v - at.v) < M.splash + r;
  for (const e of S.foes) if (e !== hit.foe && !e.dead && !e.hidden && near(e, e.r)) damage(S, { foe: e }, M.splashDmg, ev, 'missile');
  for (const s of S.shots) if (near(s, 0)) s.life = 0;
  ev.push({ kind: 'missileHit', at, n: S.kills - k, part: hit.part?.id ?? null });
}

/** The charged shot bursts: harm to everything within its blast, their shots too; a bonus for each kill past the first. */
function blast(S, b, ev) {
  const C = S.F.charge, at = { ds: b.ds, u: b.u, v: b.v };
  b.life = 0;
  let n = 0;
  const near = (p, r) => Math.hypot(p.ds - at.ds, p.u - at.u, p.v - at.v) < C.blast + r;
  for (const e of S.foes) if (!e.dead && !e.hidden && near(e, e.r)) { const k = S.kills; damage(S, { foe: e }, C.dmg, ev, 'blast'); if (S.kills > k) n++; }
  if (S.boss && !S.boss.dying) for (const p of S.boss.parts) if (!p.gone && near(partAt(S.boss, p), p.r)) damage(S, { part: p }, C.dmg, ev, 'blast');
  for (const s of S.shots) if (near(s, 0)) s.life = 0;
  const bonus = n > 1 ? (n - 1) * POINTS.multi : 0;
  S.score += bonus;
  ev.push({ kind: 'blast', at, n, bonus });
}

function hurt(S, by, ev) {
  const P = S.ship;
  if (P.iframe > 0) return false;
  P.hull = Math.max(S.safe ? 1 : 0, P.hull - 1); P.iframe = S.F.iframe; S.hits++;   // (lost often enough, it holds at its last pip: MERCY)
  ev.push({ kind: 'hurt', by, hull: P.hull });
  // (issue #495: "resets when hit": the gun back to the twin bolts)
  if (P.gun > 0) { ev.push({ kind: 'gunLost', from: P.gun }); P.gun = 0; }
  return true;
}

/**
 * Boost and brake (issue #495): the speed along the rail eased toward the boost's or the brake's, while the gauge
 * lasts; the gauge drains as either is held and fills again a moment after. Events: 'boost' / 'brake' as each starts
 * ({ on: true }) and stops, 'spent' when the gauge runs out.
 */
function throttle(S, inp, dt, ev) {
  const P = S.ship, T = S.F.throttle;
  if (!T) return;
  if (P.spent && P.meter >= T.min) P.spent = false;
  const want = P.spent ? null : inp.boost ? 'boost' : inp.brake ? 'brake' : null;
  if (want !== P.throttle) {
    if (P.throttle) ev.push({ kind: P.throttle, on: false });
    if (want) ev.push({ kind: want, on: true });
    P.throttle = want;
  }
  if (want) {
    P.meter = Math.max(0, P.meter - dt * (want === 'boost' ? T.drain : T.brakeDrain));
    P.meterWait = T.wait;
    if (P.meter <= 0) { P.spent = true; ev.push({ kind: 'spent' }); }
  } else if ((P.meterWait -= dt) <= 0) P.meter = Math.min(1, P.meter + T.refill * dt);
  const k = want === 'boost' ? T.boost : want === 'brake' ? T.brake : 1;
  P.speedK += (k - P.speedK) * (1 - Math.exp(-T.rate * dt));
}

/**
 * A gun drop (issue #495) where `at` went down (rail-relative), hung in space at least DROPS.ahead m ahead of the ship
 * (a kill close by would leave it behind), its place across kept inside the box.
 */
function drop(S, at, ev, from = 'kill') {
  const F = S.F;
  const d = { id: S.nextId++, s: S.s + Math.max(DROPS.ahead, at.ds ?? 0), u: clamp(at.u, -F.boxU * 0.85, F.boxU * 0.85), v: clamp(at.v, -F.boxV * 0.85, F.boxV * 0.85), u1: 0, v1: 0, age: 0, taken: false, from };
  d.u1 = d.u; d.v1 = d.v;
  S.drops.push(d);
  ev.push({ kind: 'drop', at: { ds: d.s - S.s, u: d.u, v: d.v }, from });
}
/** The drops: drifting a little toward the box's middle (so one near its edge can be had), taken as the ship meets one. */
function moveDrops(S, dt, ev) {
  const P = S.ship;
  for (const d of S.drops) {
    if (d.taken) continue;
    d.age += dt;
    const k = 1 - Math.exp(-DROPS.drift * dt * 0.3);
    d.u += (d.u1 * 0.6 - d.u) * k; d.v += (d.v1 * 0.6 - d.v) * k;
    const ds = d.s - S.s;
    if (ds < 1.5 && ds > -2.5 && Math.hypot(P.u - d.u, P.v - d.v) < DROPS.r) {
      d.taken = true;
      if (P.gun < GUNS.length - 1) { P.gun++; P.gunBest = Math.max(P.gunBest, P.gun); ev.push({ kind: 'upgrade', gun: P.gun, name: GUNS[P.gun].name }); }
      else { S.score += DROPS.pts; ev.push({ kind: 'upgrade', gun: P.gun, name: GUNS[P.gun].name, pts: DROPS.pts }); }
    }
  }
}

/** Inside the ship's body (its half sizes grown by r)? */
function touches(P, at, r, Bd) {
  const ku = (at.u - P.u) / (Bd.u + r), kv = (at.v - P.v) / (Bd.v + r), ks = at.ds / (Bd.s + r);
  return ku * ku + kv * kv + ks * ks < 1;
}

function rocksAndRings(S, ev) {
  const P = S.ship, Bd = S.F.body, s = S.s;
  while (S.rockI < S.rocks.length && S.rocks[S.rockI].s - s < -30) S.rockI++;
  for (let i = S.rockI; i < S.rocks.length; i++) {
    const r = S.rocks[i];
    const ds = r.s - s;
    if (ds > 12) break;
    if (r.gone || r.hit) continue;
    if (touches(P, { ds, u: r.u, v: r.v }, r.r * 0.85, Bd)) {
      r.hit = true;
      // knocked off it, away from its middle
      const du = P.u - r.u, dv = P.v - r.v, d = Math.hypot(du, dv) || 1;
      P.vu += (du / d) * 16; P.vv += (dv / d) * 12;
      hurt(S, 'rock', ev);
    }
  }
  for (const g of S.rings) {
    if (g.taken) continue;
    const ds = g.s - s;
    if (ds < 0.5 && ds > -2.5) {
      g.taken = true;
      if (Math.hypot(P.u - g.u, P.v - g.v) < g.r + 0.4) {
        if (P.missiles < S.F.missile.count) { P.missiles++; ev.push({ kind: 'rearm', missiles: P.missiles }); }   // (and a missile back: issue #224)
        if (P.hull < (P.hull0 ?? S.F.hull)) { P.hull++; ev.push({ kind: 'repair', hull: P.hull }); }
        else { S.score += POINTS.ring; ev.push({ kind: 'repair', hull: P.hull, pts: POINTS.ring }); }
      } else g.missed = true;
    }
  }
}

function shipHits(S, ev) {
  const P = S.ship, Bd = S.F.body;
  for (const b of S.shots) {
    if (b.life <= 0 || Math.abs(b.ds) > 6) continue;
    if (touches(P, b, b.r, Bd)) {
      b.life = 0;
      if (P.roll > 0) { ev.push({ kind: 'deflect', at: { ds: b.ds, u: b.u, v: b.v } }); continue; }
      hurt(S, 'shot', ev);
    }
  }
  for (const e of S.foes) {
    if (e.dead || e.hidden || Math.abs(e.ds) > e.r + 4) continue;
    if (touches(P, e, e.r * 0.8, Bd)) {
      if (hurt(S, e.kind === 'mine' ? 'mine' : 'ram', ev) || e.kind === 'mine' || e.kind === 'skiff') {
        e.dead = true;
        ev.push({ kind: 'kill', foe: e.kind, at: { ds: e.ds, u: e.u, v: e.v }, pts: 0, by: 'ram' });
      }
    }
  }
}

// ------------------------------------------------------------------ a pilot for the tests and the screenshots
/**
 * A fair pilot: it steers for the nearest pirate ahead (or the captain's next part), slides away from a rock about to
 * be hit, rolls when a shot is close, streams bolts on RT, and looses a missile at a big one in its cone
 * (`missiles: false`: the bolts alone, as before issue #224).
 */
export function botInput(S, { missiles = true } = {}) {
  const P = S.ship;
  let tu = 0, tv = -1;
  let best = null, bd = Infinity;
  for (const e of S.foes) {
    if (e.dead || e.hidden || e.ds < 14 || e.ds > 170) continue;
    const d = e.ds + Math.abs(e.u - P.u) * 2;
    if (d < bd) { bd = d; best = e; }
  }
  if (S.boss && !S.boss.dying && S.boss.age > BOSS.enter) {
    const p = liveParts(S.boss).sort((a, b) => (a.id === 'core') - (b.id === 'core'))[0];
    if (p && !best) best = partAt(S.boss, p);
  }
  // (a pirate is aimed at with the reticle, which leads the ship as it turns: aimAt; a ring or a rock by the ship itself)
  let from = { u: P.u, v: P.v };
  if (best) { tu = best.u; tv = best.v; from = aimAt(P, Math.max(14, best.ds), S.F); from = { u: P.u + (from.u - P.u) * 0.5, v: P.v + (from.v - P.v) * 0.5 }; }
  // a repair ring ahead, when hurt
  const ring = S.rings.find((g) => !g.taken && g.s - S.s < 160 && g.s - S.s > 0);
  if (ring && P.hull < (P.hull0 ?? S.F.hull)) { tu = ring.u; tv = ring.v; from = { u: P.u, v: P.v }; }
  // a gun drop close ahead (issue #495), when nothing is shooting at it
  const gift = S.drops.find((d) => !d.taken && d.s - S.s < 70 && d.s - S.s > 0);
  if (gift && !(ring && P.hull < (P.hull0 ?? S.F.hull))) { tu = gift.u; tv = gift.v; from = { u: P.u, v: P.v }; }
  // a field of mines ahead (issue #494): for its gap
  const field = S.fields.find((f) => f.s - S.s < 110 && f.s - S.s > -3);
  if (field) { tu = field.u; tv = field.v; from = { u: P.u, v: P.v }; }
  // rocks just ahead in the way: slide off them
  for (let i = S.rockI; i < S.rocks.length; i++) {
    const r = S.rocks[i], ds = r.s - S.s;
    if (ds > 45) break;
    if (ds < -2 || r.gone || r.hit) continue;
    const du = P.u - r.u, dv = P.v - r.v;
    if (Math.abs(du) < r.r + 3.2 && Math.abs(dv) < r.r + 2.4) {
      if (Math.abs(du) / (r.r + 3.2) > Math.abs(dv) / (r.r + 2.4)) tu = P.u + Math.sign(du || 1) * 8;
      else tv = P.v + Math.sign(dv || 1) * 6;
      from = { u: P.u, v: P.v };
    }
  }
  // a shot about to land: roll
  const close = S.shots.some((b) => b.ds > 0 && b.ds < 12 && Math.hypot(b.u - P.u, b.v - P.v) < 2.6);
  const x = clamp((tu - from.u) / 4, -1, 1), y = clamp((tv - from.v) / 3, -1, 1);
  // a missile at a big one (a raider, a hauler, the captain's parts) when one is in its cone
  const big = P.aim && (P.aim.part || P.aim.foe.kind === 'raider' || P.aim.foe.kind === 'hauler');
  const missile = missiles && !!big && !P.missileHeld && P.missileCool <= 0 && P.missiles > 0;
  return { x, y, fire: false, auto: true, roll: close, missile };
}
