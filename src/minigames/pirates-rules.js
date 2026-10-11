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
//   const ev = runStep(S, input, dt);        // input: { x, y, fire, fireHeld, auto, roll } (pirateInput below)
//   ev: [{ kind: 'shot' | 'charged' | 'kill' | 'hurt' | 'deflect' | 'blast' | 'say' | 'repair' | 'part' | 'lock' | 'roll' | 'win' | 'dead', … }]
//
// SCRIPT is the run, by the seconds since GO: the waves, the repair rings, the lines, the captain.

export const FLY = {
  speed: 42,                 // m/s along the rail
  boxU: 13, boxV: 7.5,       // m: how far across and up the ship may go from the rail
  steer: 19, accel: 75,      // m/s across at full stick, m/s² to get there
  hull: 6,                   // the hull's pips
  iframe: 1.1,               // s untouchable after a hit
  body: { u: 1.8, v: 0.9, s: 3.0 },   // the ship's half sizes (m), for what hits it
  bolt: { speed: 170, life: 1.25, every: 0.12, auto: 0.2, r: 0.7, spread: 0.9, lead: 0.55 },   // the twin bolts; `lead`: how much of the ship's sideways speed they keep
  charge: { after: 0.28, full: 0.7, speed: 120, turn: 6, life: 2.4, blast: 9, dmg: 12 },   // hold to charge (s), the homing shot, its blast (m) and its harm
  roll: { dur: 0.55, cool: 0.85, push: 24 },   // the barrel roll: s, s before the next, m/s of sideways shove
  lock: { near: 12, far: 230, cone: 0.11 },     // a charged shot locks what lies within that slope of the aim, between near and far (m ahead)
  enemyShot: { speed: 50, r: 0.9, life: 4.5 },
  skipAfter: 2,              // failed runs before the skip is offered first (the transition: src/ambush.js)
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
/** The lines said on the way (the ship's, the captain's): src/ambush.js AMBUSH_LINES has their words. */
export const SCRIPT = [
  { t: 1.2, say: 'start' },
  { t: 5, wave: 'line', n: 5, side: -1 },
  { t: 11, wave: 'line', n: 5, side: 1, v: 3 },
  { t: 18, wave: 'vee', n: 5 },
  { t: 26, wave: 'chase', n: 2 },
  { t: 35, wave: 'line', n: 6, side: -1, v: -3 },
  { t: 41, wave: 'vee', n: 7 },
  { t: 47, ring: true, u: -5, v: 2 },
  { t: 51, wave: 'chase', n: 3 },
  { t: 61, say: 'hauler' },
  { t: 62, wave: 'hauler', side: 1 },
  { t: 69, wave: 'line', n: 6, side: 1, v: 2 },
  { t: 76, wave: 'hauler', side: -1 },
  { t: 80, wave: 'vee', n: 7 },
  { t: 88, wave: 'chase', n: 3 },
  { t: 95, ring: true, u: 4, v: -2 },
  { t: 99, say: 'captain' },
  { t: 102, boss: true },
];

/** The rocks along the way: [s0, s1, rocks per 100 m]. Between the belts, open space. */
export const BELTS = [[250, 1250, 3.2], [1700, 2700, 4.6], [3000, 3500, 2.2], [3700, 4200, 3]];
/** What a kill is worth. */
export const POINTS = { skiff: 10, raider: 30, hauler: 60, mine: 5, rock: 5, turret: 150, core: 500, ring: 20, hull: 50, multi: 25 };
/** Each kind's health, size (m) and how often it fires (s, 0: never). */
export const KINDS = {
  skiff: { hp: 1, r: 2.6, fire: 3.4 },
  raider: { hp: 6, r: 3.6, fire: 1.5 },
  hauler: { hp: 9, r: 6.2, fire: 0 },
  mine: { hp: 1, r: 2.0, fire: 0 },
  boss: { hp: 0, r: 0, fire: 0 },   // (its parts are hit, not it: BOSS)
};
/** The captain's galleon: where its parts sit (u, v from its middle), their health and size; how long it stays. */
export const BOSS = {
  at: 72, enter: 5,          // m ahead it holds, s to come in
  stay: 75,                  // s it fights before it breaks off (the run then ends all the same, without its bounty)
  parts: [
    { id: 'gunL', u: -11, v: 0.9, r: 3.4, hp: 45 },
    { id: 'gunR', u: 11, v: 0.9, r: 3.4, hp: 45 },
    { id: 'core', u: 0, v: 2.7, r: 3.9, hp: 110, armoured: true },   // (shut until both guns are down)
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
      out.push({ s, u, v, r, kind: Math.floor(rand() * 3), tone: Math.floor(rand() * 5), hp: r < 2.2 ? 2 : Infinity, spin: (rand() - 0.5) * 1.2, hit: false });
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

// ------------------------------------------------------------------ a run
/**
 * A new run. `seed`: the rocks' layout (seedOf(destination)); `heat` 0..: how many ambushes came before (their fire a
 * little quicker each time); `gentle`: the Enemies setting's gentle (slower shots, half as many).
 */
export function newRun({ seed = 7, heat = 0, gentle = false } = {}, F = FLY) {
  return {
    t: 0, s: 0, F, rand: rng(seed * 7 + 3),
    ship: { u: 0, v: -1, vu: 0, vv: 0, hull: F.hull, iframe: 0, roll: 0, rollDir: 1, rollCool: 0, heldT: 0, charge: 0, lock: null, boltT: 0, side: 1, bank: 0 },
    rocks: courseRocks(seed), rockI: 0,
    foes: [], shots: [], bolts: [], rings: [],
    script: SCRIPT.slice(), next: 0, nextId: 1,
    boss: null, score: 0, kills: 0, hits: 0, fired: 0, done: null,
    fireK: (gentle ? 0.5 : 1) * (1 + 0.06 * Math.min(heat, 10)), shotK: gentle ? 0.75 : 1,
  };
}

/** The input the rules read: the game's merged controls through kit/input.js readInput, and the raw buttons. */
export function pirateInput(inp = {}, raw = {}, { invert = false } = {}) {
  const fire = !!(inp.jump || raw.TouchFire);
  return {
    x: inp.x ?? 0,
    y: (invert ? 1 : -1) * (inp.y ?? 0),   // (as the jets fly: forward dives, unless the "invert flight" setting is on)
    fire,
    auto: (inp.trigger ?? 0) > 0.5,         // RT / R2 held: a stream of bolts, no charge
    roll: !!(inp.action || inp.boost || raw.PadEvade || raw.PadGuard || raw.TouchEvade),
  };
}

function spawnWave(S, w) {
  const F = S.F;
  const add = (o) => { const K = KINDS[o.kind]; const e = { id: S.nextId++, hp: K.hp, r: K.r, fireT: 0.6 + S.rand() * (K.fire || 1), age: 0, flash: 0, ...o }; S.foes.push(e); return e; };
  if (w.wave === 'line') {
    // skiffs in a column, one behind the other, sweeping across the view as they close
    for (let i = 0; i < w.n; i++) add({ kind: 'skiff', path: 'line', side: w.side ?? 1, delay: i * 0.38, v0: w.v ?? 0, i, ds: 170, u: (w.side ?? 1) * 30, v: w.v ?? 0 });
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
  S.s += F.speed * dt;

  // the script: waves, rings, lines, the captain
  while (S.next < S.script.length && S.script[S.next].t <= S.t) {
    const e = S.script[S.next++];
    if (e.wave) spawnWave(S, e);
    if (e.ring) S.rings.push({ s: S.s + 230, u: e.u ?? 0, v: e.v ?? 0, r: 3.4, taken: false });
    if (e.say) ev.push({ kind: 'say', id: e.say });
    if (e.boss) spawnBoss(S);
  }

  // ---------------------------------------------------------------- the ship
  const rolling = P.roll > 0;
  P.rollCool = Math.max(0, P.rollCool - dt);
  if (inp.roll && !P.rollHeld && P.rollCool <= 0) {
    P.rollDir = Math.sign(inp.x || 0) || -P.rollDir || 1;
    P.roll = F.roll.dur; P.rollCool = F.roll.dur + F.roll.cool;
    P.vu += P.rollDir * F.roll.push;
    ev.push({ kind: 'roll', dir: P.rollDir });
  }
  P.rollHeld = !!inp.roll;
  P.roll = Math.max(0, P.roll - dt);
  const tu = clamp(inp.x ?? 0, -1, 1) * F.steer, tv = clamp(inp.y ?? 0, -1, 1) * F.steer * 0.8;
  const a = F.accel * dt;
  P.vu += clamp(tu - P.vu, -a * (rolling ? 0.3 : 1), a * (rolling ? 0.3 : 1));
  P.vv += clamp(tv - P.vv, -a, a);
  P.u += P.vu * dt; P.v += P.vv * dt;
  if (Math.abs(P.u) > F.boxU) { P.u = Math.sign(P.u) * F.boxU; P.vu *= -0.2; }
  if (Math.abs(P.v) > F.boxV) { P.v = Math.sign(P.v) * F.boxV; P.vv *= -0.2; }
  P.bank += (-(P.vu / F.steer) * 0.7 - P.bank) * Math.min(1, dt * 6);
  P.iframe = Math.max(0, P.iframe - dt);

  // fire: a tap shoots the twin bolts; held, it charges (and locks); let go charged, the homing shot
  const B = F.bolt;
  P.boltT = Math.max(0, P.boltT - dt);
  const shoot = (every = B.every) => {
    if (P.boltT > 0) return;
    P.boltT = every;
    for (const side of [-1, 1]) S.bolts.push({ ds: 2, u: P.u + side * B.spread, v: P.v - 0.1, vu: P.vu * B.lead, vv: P.vv * B.lead, vds: B.speed, life: B.life, charged: false });
    S.fired++;
    ev.push({ kind: 'shot' });
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
  if (inp.auto && !inp.fire) shoot(B.auto);   // (RT / R2 held: a steady stream, slower than tapping)
  P.fireHeld = !!inp.fire;
  if (P.lock && !targetAlive(S, P.lock)) P.lock = null;

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

  // the rocks, the mines' and the rings' still places, the ship's knocks
  rocksAndRings(S, ev);
  shipHits(S, ev);

  S.foes = S.foes.filter((e) => !e.dead && !e.gone);
  S.shots = S.shots.filter((b) => b.life > 0 && b.ds > -25 && b.ds < 320);
  S.bolts = S.bolts.filter((b) => b.life > 0);
  S.rings = S.rings.filter((r) => r.s - S.s > -20);

  // the end: the hull gone, or the captain sunk (or gone off) with the field clear
  if (P.hull <= 0) { S.done = 'dead'; ev.push({ kind: 'dead' }); }
  else if (S.boss && (S.boss.dying > 1.6 || S.boss.fled)) { S.done = 'won'; S.score += P.hull * POINTS.hull; ev.push({ kind: 'win', sunk: !S.boss.fled, hull: P.hull }); }
  return ev;
}

function targetAlive(S, t) {
  if (t.part) return !!S.boss && !t.part.gone && !(t.part.armoured && !S.boss.open) && !S.boss.dying;
  return !t.foe.dead && !t.foe.gone;
}
function targetPos(S, t) {
  if (!targetAlive(S, t)) return null;
  if (t.part) return partAt(S.boss, t.part);
  return t.foe;
}
/** What a charged shot locks now: the pirate nearest the aim, within FLY.lock's cone (or null). */
export function findLock(S) {
  const P = S.ship, L = S.F.lock;
  let best = null, bd = Infinity;
  const consider = (t, at, r) => {
    if (at.ds < L.near || at.ds > L.far) return;
    const off = Math.hypot(at.u - P.u, at.v - P.v) - r;
    const k = off / at.ds;
    if (k < L.cone && k < bd) { bd = k; best = t; }
  };
  for (const f of S.foes) if (!f.dead && f.kind !== 'mine') consider({ foe: f }, f, f.r);
  if (S.boss && !S.boss.dying && S.boss.age > BOSS.enter) for (const p of liveParts(S.boss)) consider({ part: p }, partAt(S.boss, p), p.r);
  return best;
}

function fireAt(S, from, ev, { speed = S.F.enemyShot.speed * S.shotK, spread = 0, lead = 0.5 } = {}) {
  const P = S.ship;
  // aimed where the ship will be (a little lead), its shots closing at `speed`
  const tx = -from.ds, d0 = Math.max(4, Math.abs(tx));
  const t = d0 / speed;
  const du = P.u + P.vu * t * lead - from.u + spread * (S.rand() - 0.5), dv = P.v + P.vv * t * lead - from.v + spread * (S.rand() - 0.5);
  const d = Math.hypot(tx, du, dv) || 1;
  S.shots.push({ ds: from.ds, u: from.u, v: from.v, vds: (tx / d) * speed, vu: (du / d) * speed, vv: (dv / d) * speed, life: S.F.enemyShot.life, r: S.F.enemyShot.r });
  ev.push({ kind: 'enemyShot' });
}

function moveFoe(S, e, dt, ev) {
  const F = S.F;
  e.age += dt; e.flash = Math.max(0, e.flash - dt);
  const t = e.age - (e.delay ?? 0);
  if (e.kind === 'mine') { e.ds -= F.speed * dt; if (e.ds < -15) e.gone = true; return; }
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
      if ((e.mineT -= dt) <= 0 && Math.abs(e.u) < F.boxU + 4) {
        e.mineT = 1.15;
        S.foes.push({ id: S.nextId++, kind: 'mine', hp: 1, r: KINDS.mine.r, age: 0, flash: 0, ds: e.ds - 4, u: e.u, v: e.v - 3, face: 'ship' });
        ev.push({ kind: 'mine' });
      }
      if (Math.abs(e.u) > 34 && Math.sign(e.u) === -e.side) e.gone = true;
    }
    e.face = 'side';
  }
  // firing: aimed shots while ahead and in front of the ship
  const K = KINDS[e.kind];
  if (K.fire && e.ds > 18 && e.ds < 190 && !e.gone) {
    e.fireT -= dt * S.fireK;
    if (e.fireT <= 0) { e.fireT = K.fire * (0.8 + 0.4 * S.rand()); fireAt(S, e, ev, { spread: e.kind === 'skiff' ? 5 : 2.5 }); }
  }
}

function moveBoss(S, dt, ev) {
  const B = S.boss;
  B.age += dt;
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
      if ((B.burstT -= dt) <= 0) { const g = guns[B.gun % guns.length]; fireAt(S, partAt(B, g), ev, { spread: 1.2 }); B.burstLeft--; B.burstT = 0.16; }
    } else if ((B.volleyT -= dt * S.fireK) <= 0) { B.volleyT = BOSS.volley; B.gun++; B.burstLeft = BOSS.burst; B.burstT = 0; }
  } else {
    // the core open: rings of slow shots, and skiffs launched from the hold
    if ((B.ringT -= dt * S.fireK) <= 0) {
      B.ringT = BOSS.ring;
      const c = partAt(B, B.parts.find((p) => p.id === 'core'));
      const sp = BOSS.ringSpeed * S.shotK, rot = S.rand() * Math.PI;
      for (let i = 0; i < BOSS.ringN; i++) {
        const a = rot + (i / BOSS.ringN) * Math.PI * 2;
        const du = Math.cos(a) * 0.32, dv = Math.sin(a) * 0.32, d = Math.hypot(1, du, dv);
        S.shots.push({ ds: c.ds, u: c.u, v: c.v, vds: -sp / d, vu: (du / d) * sp + (S.ship.u - c.u) / (c.ds / sp) * 0.5, vv: (dv / d) * sp + (S.ship.v - c.v) / (c.ds / sp) * 0.5, life: 4, r: 1.0, big: true });
      }
      ev.push({ kind: 'enemyShot', ring: true });
    }
    if ((B.skiffT -= dt) <= 0) { B.skiffT = BOSS.skiffs; spawnWave(S, { wave: 'line', n: 3, side: S.rand() < 0.5 ? -1 : 1, v: B.v }); }
  }
}
const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

function damage(S, target, dmg, ev, by = 'bolt') {
  if (target.part) {
    const B = S.boss, p = target.part;
    if (p.gone || B.dying) return false;
    if (p.armoured && !B.open) { ev.push({ kind: 'clank', at: partAt(B, p) }); return true; }
    p.hp -= dmg; p.flash = 0.12;
    if (p.hp <= 0) {
      p.gone = true;
      const pts = p.id === 'core' ? POINTS.core : POINTS.turret;
      S.score += pts; S.kills++;
      ev.push({ kind: 'part', id: p.id, at: partAt(B, p), pts });
      if (p.id === 'core') { B.dying = 0.001; ev.push({ kind: 'sunk', at: partAt(B, p) }); }
      else if (B.parts.filter((q) => q.id !== 'core').every((q) => q.gone)) ev.push({ kind: 'say', id: 'open' });
    }
    return true;
  }
  const e = target.foe;
  if (e.dead || e.hidden) return false;
  e.hp -= dmg; e.flash = 0.12;
  if (e.hp <= 0) {
    e.dead = true;
    S.score += POINTS[e.kind] ?? 0; S.kills++;
    ev.push({ kind: 'kill', foe: e.kind, at: { ds: e.ds, u: e.u, v: e.v }, pts: POINTS[e.kind] ?? 0, by });
  }
  return true;
}

/** Does a bolt, gone from ds0 to b.ds this step, pass within r of (ds, u, v)? */
function sweep(b, ds0, at, r) {
  const lo = Math.min(ds0, b.ds) - r, hi = Math.max(ds0, b.ds) + r;
  return at.ds >= lo && at.ds <= hi && Math.hypot(at.u - b.u, at.v - b.v) < r;
}

function boltHits(S, b, ds0, ev) {
  const R = b.charged ? 2.2 : S.F.bolt.r;
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
  P.hull = Math.max(0, P.hull - 1); P.iframe = S.F.iframe; S.hits++;
  ev.push({ kind: 'hurt', by, hull: P.hull });
  return true;
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
        if (P.hull < S.F.hull) { P.hull++; ev.push({ kind: 'repair', hull: P.hull }); }
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
 * be hit, rolls when a shot is close, streams bolts on RT and charges a shot now and then at a group.
 */
export function botInput(S) {
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
  if (best) { tu = best.u; tv = best.v; }
  // a repair ring ahead, when hurt
  const ring = S.rings.find((g) => !g.taken && g.s - S.s < 160 && g.s - S.s > 0);
  if (ring && P.hull < S.F.hull) { tu = ring.u; tv = ring.v; }
  // rocks just ahead in the way: slide off them
  for (let i = S.rockI; i < S.rocks.length; i++) {
    const r = S.rocks[i], ds = r.s - S.s;
    if (ds > 45) break;
    if (ds < -2 || r.gone || r.hit) continue;
    const du = P.u - r.u, dv = P.v - r.v;
    if (Math.abs(du) < r.r + 3.2 && Math.abs(dv) < r.r + 2.4) {
      if (Math.abs(du) / (r.r + 3.2) > Math.abs(dv) / (r.r + 2.4)) tu = P.u + Math.sign(du || 1) * 8;
      else tv = P.v + Math.sign(dv || 1) * 6;
    }
  }
  // a shot about to land: roll
  const close = S.shots.some((b) => b.ds > 0 && b.ds < 12 && Math.hypot(b.u - P.u, b.v - P.v) < 2.6);
  const x = clamp((tu - P.u) / 4, -1, 1), y = clamp((tv - P.v) / 3, -1, 1);
  return { x, y, fire: false, auto: true, roll: close };
}
