import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe, Foes, FOES, HOVER, COVER, FALL, WORLD_HARM, WORKS, KNOCKED_LOW, STRIKE_RISE } from '../src/foes.js';
import { clearTargets } from '../src/targets.js';
import { registerHazard, cylinderHazard, flameHazard, clearHazards } from '../src/hazards.js';
import { registerWorking, workingsAt, allWorkings, clearWorkings } from '../src/workings.js';
import { GameState } from '../src/game-state.js';
import { makeMaterial } from '../src/materials.js';
import { TempleKit } from '../src/temples/kit.js';
import { Updraft, Gust, Swing } from '../src/temples/pieces.js';

// Foes in the world's height and workings (v0.98, docs/systems/foes.md "Foes in the world's workings").

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

function player(at = v()) {
  return { pos: at, vel: v(), heading: 0, onGround: true, ride: null, down: null, dead: false, health: 1, opts: {}, hurts: [],
    hurt(a) { this.health = Math.max(0, this.health - a); this.hurts.push(a); }, knockDown() { return true; } };
}
const run = (f, P, env, secs, each = null) => { const ev = []; for (let i = 0; i < secs / DT; i++) { ev.push(...f.update(DT, P, env)); each?.(f, i * DT); } return ev; };
/** A world for Foes: ground(x, z) (null: nothing there), no walls. */
const physics = (ground = () => 0) => ({ groundAt: (x, y, z) => { const g = ground(x, z); return g == null ? -Infinity : g; }, rayDistance: () => Infinity, rayHit: () => null });
function foesIn({ ground, level = {}, settings = { enemies: 'normal' }, P = player(v(0, 0, -30)) } = {}) {
  const sounds = [], notes = [];
  const sound = { foeHurt: (k) => sounds.push(`hurt:${k}`), foeBurst: (k) => sounds.push(`burst:${k}`), whoosh: () => sounds.push('whoosh'), foeWarn() {}, combat() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true }, ...level }, levelId: 'arena', physics: physics(ground), player: P, sound,
    settings, game: new GameState(null), notice: (t) => notes.push(t) });
  foes.waveRest = 1e9;
  return { foes, sounds, notes, P };
}
const tick = (foes, secs) => { for (let i = 0; i < secs / DT; i++) foes.update(DT); };
const fresh = () => { clearTargets(); clearHazards(); clearWorkings(); };

/** A wall in the plane x = 0 (z within ±4, up to 12 m): the line of sight through it is blocked. */
const wallSeen = (from, to) => {
  const tx = to.x, ty = to.y + 1, tz = to.z;
  if (Math.sign(from.x) === Math.sign(tx) || from.x === tx) return true;
  const t = from.x / (from.x - tx), z = from.z + (tz - from.z) * t, y = from.y + (ty - from.y) * t;
  return !(Math.abs(z) < 4 && y > -1 && y < 12);
};

test('a hovering foe keeps its height over the higher of its footing and you: up to a ledge, and held over a drop', () => {
  // you stand on a ledge 3 m up: it rises to stay its hover over you
  const P = player(v(0, 3, 15));
  const f = new Foe('flyer', v(0, 0, 0), { rng: () => 0.5 });
  run(f, P, { ground: () => 0 }, 2.5);
  assert.ok(Math.abs(f.over - 3) < 0.15, `held 3 m over its footing (${f.over.toFixed(2)})`);
  assert.ok(f.chest.y > 3 + 2.5, 'its body over you, as on flat ground');
  // over a drop (the ground 10 m down from x 5 to 15), on to you on the far side: it holds its altitude
  const drop = (x) => (x > 5 && x < 15 ? -10 : 0);
  const Q = player(v(22, 0, 0)), g = new Foe('flyer', v(3, 0, 0), { rng: () => 0.5 });
  g.state = 'chase'; g.heading = Math.PI / 2;
  let lowest = Infinity, crossed = false;
  const env = { ground: (x) => drop(x) };
  run(g, Q, env, 4, (h) => { if (h.pos.y < -5) { crossed = true; lowest = Math.min(lowest, h.level); } });
  assert.ok(crossed, 'it flew out over the drop');
  assert.ok(lowest > -1.5, `it held its altitude (lowest level ${lowest.toFixed(2)}), not diving to the ground below`);
  // stilled up there, it drops all the way, and lands hard
  const s = new Foe('flyer', v(10, -10, 0)); s.over = 10; s.state = 'chase';
  s.hit('stun');
  const ev = run(s, Q, env, 2);
  assert.ok(s.over === 0, 'down on the ground below');
  assert.ok(ev.some((e) => e.type === 'landed' && e.hard && e.h > FALL.hard), 'a long drop is a hard landing');
  // a drop deeper than HOVER.max it does not fly out over on its own
  const deep = { ground: (x) => (x > 5 ? -30 : 0) }, d = new Foe('flyer', v(3, 0, 0), { rng: () => 0.5 });
  run(d, player(v(25, 0, 0)), deep, 3);
  assert.ok(d.pos.x <= 5.01 && d.pos.y === 0, 'it stops at the edge of a chasm past its reach');
  assert.ok(HOVER.max >= 8 && HOVER.max <= 15);
});

test('between strikes a hovering foe hides behind the world, then comes out to strike; Gentle hides less long', () => {
  const P = player(v(-8, 0, 0));
  const hideRun = (gentle) => {
    const f = new Foe('flyer', v(3, 0, 7), { rng: () => 0.5 });
    f.state = 'chase'; f.cool = 2.5;
    const env = { ground: () => 0, seen: wallSeen, gentle: () => gentle };
    let hidden = 0, inCover = 0, run = 0, warned = null, t = 0;
    for (let i = 0; i < 12 / DT; i++) {
      const ev = f.update(DT, P, env); t += DT;
      run = f.cover ? run + DT : 0; inCover = Math.max(inCover, run);   // (the longest time in one hiding place)
      if (!wallSeen(f.chest, P.pos)) hidden += DT;
      if (warned == null && ev.includes('warn')) warned = t;
    }
    return { hidden, inCover, warned, f };
  };
  const N = hideRun(false), G = hideRun(true);
  assert.ok(N.hidden > 0.5, `it spent a while out of your sight (${N.hidden.toFixed(2)} s)`);
  assert.ok(N.inCover <= COVER.hold + 0.05, `never more than COVER.hold in cover (${N.inCover.toFixed(2)})`);
  assert.ok(N.warned != null && N.warned < COVER.hold + 6, `it came out and wound up a strike (at ${N.warned?.toFixed(2)} s)`);
  assert.ok(G.inCover <= COVER.gentle + 0.05 && G.inCover < N.inCover, `Gentle: less long in cover (${G.inCover.toFixed(2)} < ${N.inCover.toFixed(2)})`);
  // one hide between two strikes: after it struck, it may hide again
  const h = new Foe('flyer', v()); h.hid = true; h.beginWind(FOES.flyer.attack, P);
  assert.equal(h.hid, false, 'it struck: it may hide again');
});

test('with nothing to hide behind it climbs higher instead, then still comes down within reach; the cut knocks it low', () => {
  const P = player(v(0, 0, 12)), f = new Foe('flyer', v(0, 0, 0), { rng: () => 0.5 });
  f.state = 'chase'; f.cool = 2.5;
  const env = { ground: () => 0, seen: () => true };
  let climbed = 0, hit = false;
  run(f, P, env, 10, (g) => { climbed = Math.max(climbed, g.over); });
  for (let i = 0; i < 10 / DT && !hit; i++) hit = f.update(DT, P, env).some((e) => e.type === 'strike' && e.hit);
  assert.ok(climbed > 1.5 && climbed <= COVER.climb + 1e-6, `it climbed out of reach a while (${climbed.toFixed(2)} m)`);
  assert.ok(hit, 'and still dived on you');
  // cut, it drops within reach (KNOCKED_LOW), and leaves off hiding
  const g = new Foe('flyer', v(0, 0, 6), { rng: () => 0.5 });
  g.state = 'chase'; g.cool = 2.5;
  run(g, P, env, 0.5);
  assert.ok(g.cover?.climb, 'climbing, nowhere to hide');
  g.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.equal(g.low, KNOCKED_LOW);
  run(g, P, env, 0.6);
  assert.equal(g.cover, null, 'it gave up hiding');
  assert.ok(g.chest.y < 1.6, 'low, in the blade’s reach');
});

test('a foe never walks into a hazard itself; shoved in, it is cut (at most once a short while) and thrown back out', () => {
  const spines = cylinderHazard({ kind: 'spikes', x: 3, z: 0, y0: 0, y1: 2, r: 1, dps: 0.1 });
  const env = { ground: () => 0, hazard: (p) => (spines.test(p) ? spines : null) };
  const P = player(v(8, 0, 0)), f = new Foe('blot', v(0, 0, 0), { rng: () => 0.5 });
  let entered = false;
  run(f, P, env, 4, (g) => { entered ||= spines.test(g.pos); });
  assert.equal(entered, false, 'it went round or stopped: never into the spines');
  const g = new Foe('blot', v(1.2, 0, 0)); g.state = 'recover'; g.timer = 9;
  g.vel.set(9, 0, 0);
  const ev = run(g, P, env, WORLD_HARM.every * 0.9);
  const cuts = ev.filter((e) => e.type === 'hazard');
  assert.equal(cuts.length, 1, 'one cut, not every frame');
  assert.equal(cuts[0].kind, 'spikes');
  assert.ok(g.vel.x < 0 || !spines.test(g.pos), 'thrown back out of them');
});

test('through Foes: spines and fire hurt a foe knocked into them as any blow does (its sound, a burst, a note once)', () => {
  fresh();
  const offs = [registerHazard(cylinderHazard({ kind: 'spikes', x: 3, z: 0, y0: 0, y1: 2, r: 1, dps: 0.1 })), registerHazard(flameHazard({ x: -3, z: 0, y0: -1, y1: 4, rMax: 1.5 }))];
  const { foes, sounds, notes } = foesIn();
  const m = foes.add('machine', v(1.4, 0, 0)); m.vel.set(9, 0, 0);
  tick(foes, 0.3);
  assert.equal(m.hp, FOES.machine.hp - WORLD_HARM.spikes, 'cut by the spines');
  assert.ok(sounds.includes('hurt:machine'), 'with its sound');
  const said = () => notes.filter((t) => /world hurts them/.test(t)).length;
  assert.equal(said(), 1, 'and the game says the world hurts them too, once');
  const b = foes.add('blot', v(-1.4, 0, 0)); b.vel.set(-9, 0, 0);
  tick(foes, 0.3);
  assert.equal(b.hp, FOES.blot.hp - WORLD_HARM.fire, 'burnt');
  b.pos.set(-3, 0, 0); b.hazCool = 0;
  tick(foes, 0.05);
  assert.ok(!b.alive && b.dead !== undefined, 'a second burn bursts it (ink, the tank’s charge)');
  assert.ok(sounds.includes('burst:blot'));
  assert.equal(said(), 1);
  foes.dispose(); offs.forEach((o) => o()); fresh();
});

test('knocked off a ledge a foe falls: a short drop is nothing, a long one a cut and a stun, out of the world it is gone', () => {
  fresh();
  // a ledge: 2 m down past x 5 (nothing), 10 m down past x 15
  const { foes } = foesIn({ ground: (x) => (x > 15 ? -12 : x > 5 ? -2 : 0) });
  const m = foes.add('machine', v(4.6, 0, 0)); m.state = 'recover'; m.timer = 99; m.vel.set(4, 0, 0);
  tick(foes, 1);
  assert.ok(m.pos.y === -2 && m.hp === FOES.machine.hp, 'down 2 m, unhurt');
  m.pos.set(14.6, -2, 0); m.vel.set(9, 0, 0); m.stunned = 0;
  tick(foes, 0.1);
  assert.ok(m.air, 'over the edge, in the air');
  tick(foes, 1.5);
  assert.equal(m.pos.y, -12);
  assert.equal(m.hp, FOES.machine.hp - 2, 'a 10 m fall: two cuts');
  // a walker does not walk off on its own
  const w = foes.add('blot', v(4, 0, 0)); w.state = 'chase';
  foes.player.pos.set(30, 0, 0);
  foes.dispose(); fresh();
  // off into nothing: gone (burst) once it has fallen too far, or below the world's killY, or into a temple's pit
  for (const level of [{}, { killY: -6 }, { temple: { pits: [{ contains: (p) => p.y < -3 }], inside: () => true } }]) {
    const { foes: F } = foesIn({ ground: (x) => (x > 5 ? null : 0), level });
    const b = F.add('blot', v(4.7, 0, 0)); b.state = 'recover'; b.timer = 99; b.vel.set(6, 0, 0);
    tick(F, 3);
    assert.ok(!b.alive && b.dead !== undefined, `gone (${Object.keys(level)[0] ?? 'fallen too far'})`);
    F.dispose(); fresh();
  }
  assert.ok(FALL.hard > 2 && FALL.lost > 20);
});

test('an updraft throws a walker up to land hard, tumbles a flyer up and stuns it; neither walks into one itself', () => {
  fresh();
  const off = registerWorking({ kind: 'updraft', contains: (p) => Math.hypot(p.x, p.z) < 2 && p.y > -1 && p.y < 20, foot: v(), r: 2, top: 20, lift: 7 });
  const { foes, sounds } = foesIn();
  const m = foes.add('machine', v(0.5, 0, 0));
  tick(foes, 0.1);
  assert.ok(m.air && m.air.hard, 'thrown up');
  assert.ok(sounds.includes('whoosh'));
  let top = 0;
  for (let i = 0; i < 2 / DT; i++) { foes.update(DT); top = Math.max(top, m.pos.y); }
  assert.ok(top > 2, `high up (${top.toFixed(1)} m)`);
  assert.ok(!m.air && m.hp === FOES.machine.hp - 1, 'landed hard: a cut');
  assert.ok(Math.hypot(m.pos.x, m.pos.z) > 0.5, 'thrown out of the column a little');
  const d = foes.add('drone', v(0, 0, 0.5));
  let high = 0, stunned = false;
  for (let i = 0; i < 0.9 / DT; i++) { foes.update(DT); high = Math.max(high, d.over); stunned ||= d.stunned > 0; }
  assert.ok(high > 3 && stunned, `a flyer tumbles up out of control (${high.toFixed(1)} m), stunned`);
  foes.dispose();
  // walking to you across it, a blot goes round or stops: never in
  const env = { ground: () => 0, workings: (p, k) => workingsAt(p, k) };
  const b = new Foe('blot', v(-5, 0, 0), { rng: () => 0.5 });
  let inside = false;
  run(b, player(v(6, 0, 0)), env, 4, (g) => { inside ||= workingsAt(g.pos, 'updraft').length > 0; });
  assert.equal(inside, false);
  off(); fresh();
});

test('a blowing gust shoves any foe in the open (a stilled one slides like a crate); sheltered or calm, nothing', () => {
  fresh();
  const G = { blowing: true, sheltered: false };
  const off = registerWorking({ kind: 'gust', dir: v(1, 0, 0), push: 7.5, contains: (p) => Math.abs(p.x) < 20 && Math.abs(p.z) < 5, blowing: () => G.blowing, sheltered: () => G.sheltered });
  const env = { ground: () => 0, workings: (p, k) => workingsAt(p, k) }, P = player(v(0, 0, -40));
  const shove = (kind, prep = () => {}) => { const f = new Foe(kind, v(0, 0, 0)); f.state = 'recover'; f.timer = 9; prep(f); f.update(DT, P, env); return f.vel.x; };
  const blot = shove('blot'), walking = shove('machine'), stilled = shove('machine', (f) => f.hit('stun'));
  assert.ok(blot > 6, 'a blot');
  assert.ok(walking > 4 && Math.abs(walking / blot - WORKS.gust.heavy) < 0.02, 'a machine (heavy: less)');
  assert.ok(stilled > blot, 'a stilled machine slides further, like a crate');
  assert.ok(shove('drone') > blot, 'a drone in the air');
  G.sheltered = true; assert.ok(shove('blot') < 0.01, 'sheltered: nothing');
  G.sheltered = false; G.blowing = false; assert.ok(shove('blot') < 0.01, 'calm: nothing');
  off(); fresh();
});

test('a swinging pendulum knocks a foe away hard (a cut, a stun); off a bridge, a machine falls into the pit and is gone', () => {
  fresh();
  const S = { moving: true };
  const off = registerWorking({ kind: 'swing', center: v(0, 1, 0), radius: 1.9, contains: (p) => Math.hypot(p.x, p.z) < 1.9 && Math.abs(p.y + 0.9 - 1) < 2.6, moving: () => S.moving, push: (p, out) => out.set(1, 0, 0) });
  // a bridge 4 m wide along z over a chasm (its pit under the lip)
  const temple = { pits: [{ contains: (p) => p.y < -3 }], inside: () => true };
  const { foes } = foesIn({ ground: (x) => (Math.abs(x) < 2 ? 0 : -40), level: { temple } });
  const m = foes.add('machine', v(0.3, 0, 0));
  tick(foes, 0.05);
  assert.equal(m.hp, FOES.machine.hp - 1, 'a cut');
  assert.ok(m.stunned > 0 && m.vel.x > 4, 'stunned, knocked away the way it swings');
  tick(foes, 2.5);
  assert.ok(!m.alive && m.dead !== undefined, 'off the bridge, into the pit: broken');
  foes.dispose();
  // on wide floor it lands and lives; a stilled pendulum knocks nothing
  const { foes: F } = foesIn();
  const n = F.add('machine', v(0.3, 0, 0));
  tick(F, 2);
  assert.ok(n.alive && n.hp < FOES.machine.hp && n.pos.x > 2, 'knocked away, cut, alive');
  S.moving = false;
  const q = F.add('machine', v(0, 0, 0.3)); q.state = 'recover'; q.timer = 9;
  tick(F, 0.2);
  assert.equal(q.hp, FOES.machine.hp, 'stilled: it hangs there, harmless');
  F.dispose(); off(); fresh();
});

test('a temple plate: a machine on it presses it, stilled it still weighs; a swarm blot or a flyer in the air does not', () => {
  fresh();
  const pressed = new Set();
  const plate = { id: 'p1', pos: v(0, 0, 0), r: 1.3, solid: {}, weighed: () => false };
  const rt = { kit: { local: (p) => p.clone() }, pieces: [plate], marks: [], logic: { press: (id, by) => pressed.add(`${id}:${by}`), release: (id, by) => pressed.delete(`${id}:${by}`) }, inside: () => true };
  const { foes } = foesIn({ level: { temple: rt } });
  const on = (kind, prep = () => {}) => { for (const f of foes.list.slice()) foes.remove(f); const f = foes.add(kind, v(0.4, 0, 0)); prep(f); foes.templeKit(); return pressed.has('p1:foe'); };
  assert.ok(on('machine'));
  assert.ok(on('machine', (f) => f.hit('stun')), 'stilled, it still weighs');
  assert.ok(on('blot'), 'a blot weighs too');
  assert.equal(on('swarm'), false, 'a swarm blot is too light');
  assert.equal(on('drone'), false, 'a drone in the air does not');
  assert.ok(on('drone', (f) => { f.alt = 0.3; }), 'stilled and fallen onto it, it does');
  assert.equal(on('machine', (f) => { f.air = { vy: 2, top: 0, base: 0 }; }), false, 'thrown, it is off it');
  foes.dispose(); fresh();
});

test('the temple pieces Updraft, Gust and Swing are workings: registered as built, let go when disposed', () => {
  fresh();
  const root = new THREE.Group(), trimMat = makeMaterial({ color: '#888888', flat: true, key: 'test-trim' });
  const rt = { root, kit: new TempleKit(root, 't', v(), 0, null), M: { trimMat }, P: {}, player: null, notice() {} };
  const up = new Updraft(rt, { at: [0, 0, 0], r: 3, h: 12 });
  const gust = new Gust(rt, { min: [10, 0, -3], max: [30, 6, 3], dir: [1, 0, 0], calm: 1, blow: 1, warn: 0.2, push: 7 });
  const swing = new Swing(rt, { at: [0, 12, 40], len: 10, amp: 0.9, period: 2.8 });
  assert.equal(allWorkings().length, 3);
  const [u] = workingsAt(v(0, 1, 0), 'updraft');
  assert.ok(u && u.top === 12 && u.lift === 7 && u.r === 3);
  const [g] = workingsAt(v(20, 0, 0), 'gust');
  assert.ok(g && g.push === 7 && Math.abs(g.dir.x - 1) < 1e-6);
  assert.equal(g.blowing(), false, 'calm at first');
  gust.update(1.2); assert.equal(g.blowing(), true, 'then it blows');
  swing.update(0.3);
  const [s] = workingsAt(swing.center.clone().setY(swing.center.y - 0.9), 'swing');
  assert.ok(s && s.moving(), 'the pendulum meets what stands at its bob');
  const dir = s.push(v(), v());
  assert.ok(Math.abs(Math.abs(dir.x) - 1) < 1e-6, 'it knocks along its swing');
  swing.hit('stun'); assert.equal(s.moving(), false, 'stilled, it is still');
  up.dispose(); gust.dispose(); swing.dispose();
  assert.equal(allWorkings().length, 0, 'all let go');
  fresh();
});

test('the Enemies setting: Off, nothing stirs or is moved; Gentle hides less long (COVER.gentle)', () => {
  fresh();
  const off = registerWorking({ kind: 'gust', dir: v(1, 0, 0), push: 7.5, contains: () => true, blowing: () => true });
  const { foes } = foesIn({ settings: { enemies: 'off' }, level: { foes: {} } });
  const f = foes.add('blot', v(0, 0, 0));
  tick(foes, 0.5);
  assert.ok(f.pos.x === 0 && f.vel.x === 0, 'off: nothing');
  foes.dispose(); off();
  const { foes: gentle } = foesIn({ settings: { enemies: 'gentle' } });
  assert.equal(gentle.env.gentle(), true);
  assert.ok(COVER.gentle < COVER.hold && COVER.hold <= 3);
  gentle.dispose(); fresh();
  assert.ok(STRIKE_RISE > 1);
});
