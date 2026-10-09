import test from 'node:test';
import { DAMAGE } from '../src/resources.js';
import assert from 'node:assert/strict';
import { keyText } from '../src/prompt-keys.js';
import * as THREE from 'three';
import { Foe, Foes, FOES, PACK, PEACEFUL, WILD, inWilds } from '../src/foes.js';
import { FluidTool } from '../src/fluid-tool.js';
import { BLADE, bladeHits, lockTarget, swingArc } from '../src/fluid-blade.js';
import { clearTargets, registerTarget, allTargets } from '../src/targets.js';
import { HIT } from '../src/temples/boss.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';

items.grant('backpack');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const env = { ground: () => 0, seen: () => true };

function player(at = v()) {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) };
  const P = { pos: at, vel: v(), heading: 0, frame, vehicles: [], object: { visible: true }, ride: null, onGround: true, aim: null, opts: {}, hearts: 3, maxHearts: 3, down: null, dead: false,
    hurts: [], knocks: 0,
    get health() { return this.hearts / this.maxHearts; }, set health(k) { this.hearts = k * this.maxHearts; },
    hurt(a) { this.hearts = Math.max(0, this.hearts - a); this.hurts.push(a); },
    knockDown() { this.knocks++; return true; } };
  return P;
}
const run = (f, P, secs) => { const ev = []; for (let i = 0; i < secs / DT; i++) ev.push(...f.update(DT, P, env)); return ev; };

test('an ink blot notices you, winds up and commits to a lunge you can sidestep', () => {
  const P = player(v(0, 0, 10)), f = new Foe('blot', v(0, 0, 0), { rng: () => 0.5 });
  const ev = run(f, P, 0.1);
  assert.ok(ev.includes('notice'), 'it saw you');
  const later = run(f, P, 5);
  assert.ok(later.includes('warn'), 'it winds up once in reach');
  const strikes = later.filter((e) => e.type === 'strike');
  assert.ok(strikes.length >= 1 && strikes[0].hit, 'standing still in the ring, the lunge lands');
  // the next one: step out of the drawn ring while it winds up, and it misses
  const g = new Foe('blot', v(0, 0, 0), { rng: () => 0.5 }), Q = player(v(0, 0, 3));
  let warned = false;
  for (let i = 0; i < 6 / DT && !warned; i++) warned = g.update(DT, Q, env).includes('warn');
  assert.ok(warned);
  Q.pos.set(6, 0, 3);   // out of it
  const miss = run(g, Q, FOES.blot.attack.wind + FOES.blot.attack.strike + 0.1).find((e) => e.type === 'strike');
  assert.equal(miss?.hit, false, 'out of the ring: it misses');
});

test('the blade cuts a blot in two swings and a machine in a full combo; fluid washes a blot but only staggers a machine; stilling holds them', () => {
  const b = new Foe('blot', v());
  assert.equal(b.hit('blade', v(0, 0, 1), { damage: 1 }), true);
  assert.equal(b.hit('blade', v(0, 0, 1), { damage: 1 }), 'burst', 'two cuts');
  assert.equal(b.alive, false);
  const w = new Foe('blot', v());
  w.hit('shoot', v(0, 0, 1)); assert.equal(w.hit('fire', v(0, 0, 1)), 'burst', 'a fluid and an ember glob wash it out');
  const m = new Foe('machine', v());
  for (let i = 0; i < 3; i++) m.hit('shoot', v(0, 0, 1));
  assert.equal(m.hp, FOES.machine.hp, 'globs only stagger a machine');
  const dmg = BLADE.damage;
  assert.equal(dmg.reduce((a, b) => a + b, 0), FOES.machine.hp, 'a whole combo breaks one');
  for (const d of dmg.slice(0, -1)) assert.equal(m.hit('blade', v(), { damage: d }), true);
  assert.equal(m.hit('blade', v(), { damage: dmg.at(-1) }), 'burst');
  const s = new Foe('blot', v()), P = player(v(0, 0, 1.5));
  s.hit('stun');
  const ev = run(s, P, 3);
  assert.equal(ev.filter((e) => e === 'warn').length, 0, 'stilled: nothing for 3.5 s');
  assert.ok(run(s, P, 3).includes('warn'), 'then it comes on again');
});

test('a foe you lead too far goes home, and a cut interrupts a blot winding up', () => {
  const f = new Foe('blot', v()), P = player(v(0, 0, 5));
  run(f, P, 0.2);
  assert.equal(f.state, 'chase');
  P.pos.set(0, 0, 200);
  const ev = run(f, P, 1);
  assert.ok(ev.includes('home'), 'out of sight: back home');
  const g = new Foe('blot', v()), Q = player(v(0, 0, 1.5));
  for (let i = 0; i < 5 / DT && g.state !== 'wind'; i++) g.update(DT, Q, env);
  assert.equal(g.state, 'wind');
  g.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.equal(g.state, 'recover', 'the cut breaks its wind-up');
});

test('the wilds: away from people and from where the ship lands', () => {
  const people = [{ x: 100, z: 0 }], spawn = { x: 0, z: 0 };
  assert.equal(inWilds({ x: 0, z: WILD.spawn - 1 }, { people, spawn }), false, 'by the ship');
  assert.equal(inWilds({ x: 100 + WILD.people - 1, z: 0 }, { people, spawn }), false, 'among people');
  assert.equal(inWilds({ x: 0, z: 300 }, { people, spawn }), true);
  for (const id of ['home', 'lab', 'references', 'atelier']) assert.ok(PEACEFUL.has(id), id);
});

test('out in the wilds a pack of ink blots comes in (the first time one), out of reach at first; a strike never empties a healthy bar', () => {
  clearTargets();
  const game = new GameState(null), notes = [];
  const P = player(v(0, 0, 400));
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'desert', content: { npcs: [{ at: [0, 30] }] }, physics: flat, player: P, settings: { enemies: true }, game, notice: (t) => notes.push(t) });
  let t = 0;
  for (; t < 20 && !foes.list.length; t += DT) foes.update(DT);
  assert.ok(t > PACK.settle, 'not at once: a few seconds out there first');
  assert.equal(foes.list.length, PACK.first, 'the first pack is one blot');
  const d = foes.list[0].pos.distanceTo(P.pos);
  assert.ok(d >= PACK.near - 0.01 && d <= PACK.far + 0.01, `it comes in ${d.toFixed(1)} m out`);
  assert.equal(notes.length, 1, 'and the game says what they are, once');
  assert.match(keyText(notes[0], { kind: 'pad' }), /LB \/ L1/, 'with a pad in hand: its guard button (a {key:guard}, src/prompt-keys.js keyText)');
  // an ordinary blow: half a heart; and none takes you from more than a heart to nothing
  const first = foes.list[0], dmg = (first.atk ?? first.def.attack).damage;
  foes.strike(first);
  assert.ok(dmg >= 0.25 && dmg <= 0.5, `an ordinary foe's blow (or one contact of it): half a heart at most (${dmg})`);
  assert.equal(P.hearts, 3 - dmg, 'off three hearts');
  assert.equal(FOES.blot.attacks[0].damage, DAMAGE.blow, 'an ink blot\'s lunge: half a heart, the baseline');
  P.hearts = 1.5; foes.harm(5);
  assert.equal(P.hearts, HIT.floor, 'a huge blow from a heart and a half leaves a quarter');
  P.hearts = 1; foes.harm(1);
  assert.equal(P.hearts, 0, 'from one heart, a blow can knock you out');
  P.hearts = 3;
  // its target: the blade and the soft lock find it, people's targets don't count
  assert.ok(allTargets().some((t) => t.kind === 'foe' && t.lock && t.accepts.includes('blade')));
  // near the ship there are none
  clearTargets();
  const Q = player(v(0, 0, 5));
  const calm = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'desert', physics: flat, player: Q, settings: { enemies: true }, game });
  for (let i = 0; i < 10 / DT; i++) calm.update(DT);
  assert.equal(calm.list.length, 0, 'by the ship: none');
  // the Enemies setting off, or a peaceful world: none
  const off = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'desert', physics: flat, player: player(v(0, 0, 400)), settings: { enemies: false }, game });
  for (let i = 0; i < 10 / DT; i++) off.update(DT);
  assert.equal(off.list.length, 0, 'Enemies off: none');
  const home = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'home', physics: flat, player: player(v(0, 0, 400)), settings: { enemies: true }, game });
  for (let i = 0; i < 10 / DT; i++) home.update(DT);
  assert.equal(home.list.length, 0, 'at home: none');
  clearTargets();
});

test('cutting a foe down gives the tank a charge back; a broken machine stays broken', () => {
  clearTargets();
  const game = new GameState(null);
  const tool = { reserve: { level: 1, max: 3 }, drops: { add() {} }, glow: { add() {} }, modeTones: ['#fff'] };
  const marks = [{ pos: v(0, 0, 0), heading: 0 }, { pos: v(0, 0, 30), heading: 0 }];
  const level = { spawn: v(), temple: { marks, inside: () => true } };
  const P = player(v(0, 0, 30));
  const foes = new Foes({ scene: new THREE.Scene(), level, levelId: 'desert', physics: flat, player: P, tool, settings: { enemies: true }, game });
  assert.equal(foes.list.filter((f) => f.kind === 'machine').length, 1, 'one machine by the second room\'s mark (none by the first)');
  const m = foes.list[0];
  for (const d of BLADE.damage) foes.hurt(m, 'blade', v(0, 0, 1), { damage: d });
  assert.equal(tool.reserve.level, 2, 'a charge back');
  assert.equal(game.flag(m.id), true, 'remembered');
  clearTargets();
  const again = new Foes({ scene: new THREE.Scene(), level, levelId: 'desert', physics: flat, player: P, tool, settings: { enemies: true }, game });
  assert.equal(again.list.length, 0, 'broken, it stays broken');
  clearTargets();
});

test('the blade: three arcs, a soft lock on the nearest foe, and only targets that list the blade feel it', () => {
  for (const n of [0, 1, 2]) {
    const a = swingArc(n, 0), b = swingArc(n, 1);
    assert.ok(Math.abs(a.side - b.side) > 0.2 || Math.abs(a.rise - b.rise) > 0.8, `swing ${n} travels`);
  }
  assert.ok(swingArc(0, 0).side > 0 && swingArc(0, 1).side < 0, 'right to left first');
  clearTargets();
  const hits = [];
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.6, position: () => v(0, 1, 2), onHit: (m) => hits.push(['foe', m]) });
  registerTarget({ kind: 'switch', radius: 0.6, position: () => v(0.3, 1, 2), onHit: (m) => hits.push(['switch', m]) });
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.6, position: () => v(0, 1, 40), onHit: () => hits.push(['far']) });
  assert.deepEqual(bladeHits(v(0, 1, 0), v(0, 0, 1)).map((h) => h.target.kind), ['foe'], 'the switch never feels a blade');
  assert.equal(lockTarget(v(0, 0, 0)).position().z, 2, 'the nearest foe in reach');
  // the tool swings it: a press of F, and the foe in front is cut once the swing lands
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.6, 10); camera.updateMatrixWorld();
  const P = player(v()); P.heading = 0;
  const tool = new FluidTool({ scene: new THREE.Scene(), player: P, physics: flat, camera, rig: { aimK: 0 }, state: new GameState(null) });
  tool.update(DT, { KeyF: true });
  assert.ok(tool.blade.swinging, 'a press swings');
  for (let i = 0; i < BLADE.swing / DT + 2; i++) tool.update(DT, { KeyF: true });
  assert.deepEqual(hits, [['foe', 'blade']], 'it landed on the foe, once, as a blade; nothing else');
  assert.equal(tool.reserve.charges, 3, 'and cost nothing');
  // presses in quick succession chain the combo, the third swing heavier
  tool.update(DT, {}); tool.update(DT, { KeyF: true });
  assert.equal(tool.blade.n, 1, 'the second swing');
  tool.dispose();
  clearTargets();
});

test('held, the separate guard button raises the guard: a strike from in front is blocked for a charge, the foe reels; from behind, or with the tank empty, it gets through', async () => {
  const { GUARD, inGuard } = await import('../src/fluid-blade.js');
  assert.ok(inGuard(v(), v(0, 0, 1), v(1, 0, 3)) && !inGuard(v(), v(0, 0, 1), v(0, 0, -3)), 'in front, not behind');
  clearTargets();
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.6, 10); camera.updateMatrixWorld();
  const P = player(v()); P.heading = 0; P.flinches = 0; P.flinch = function () { this.flinches++; };
  const tool = new FluidTool({ scene: new THREE.Scene(), player: P, physics: flat, camera, rig: { aimK: 0 }, state: new GameState(null) });
  for (let i = 0; i < 1.2 / DT; i++) tool.update(DT, { KeyZ: true });   // holding guard costs a charge on contact
  assert.ok(tool.blade.guarding, 'the guard is up');
  assert.equal(typeof P.guard, 'function', 'the player asks the blade');
  const game = new GameState(null);
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'arena', physics: flat, player: P, tool, settings: { enemies: true }, game });
  const front = foes.add('blot', v(0, 0, 1.5)), charges = tool.reserve.charges;
  assert.equal(foes.strike(front), false, 'blocked');
  assert.deepEqual(P.hurts, [], 'no harm');
  assert.equal(tool.reserve.charges, charges - 1, 'a charge spent');
  assert.equal(front.state, 'recover', 'the foe reels');
  assert.ok(tool.blade.parry > 0 && tool.blade.parry <= GUARD.parryFor, 'the arm takes the blow');
  const behind = foes.add('blot', v(0, 0, -1.5));
  assert.equal(foes.strike(behind), true, 'from behind it gets through');
  assert.equal(P.hurts.length, 1);
  assert.equal(P.flinches, 1, 'and the traveller flinches');
  tool.reserve.level = 0;
  assert.equal(foes.strike(front), true, 'with the tank empty it gets through');
  // a perfect parry: the guard raised just as the strike comes costs nothing, and the foe is stunned
  tool.reserve.level = 1;
  for (let i = 0; i < 0.6 / DT; i++) tool.update(DT, {});
  let up = 0; while (!tool.blade.guarding && up++ < 60) tool.update(DT, { ControlLeft: true });
  const late = foes.add('blot', v(0, 0, 1.5));
  assert.equal(foes.strike(late), false, 'parried');
  assert.equal(tool.reserve.level, 1, 'for nothing');
  assert.ok(late.stunned > 1, 'and the foe is stunned');
  // let go: the guard comes down
  for (let i = 0; i < 0.6 / DT; i++) tool.update(DT, {});
  assert.equal(tool.blade.guarding, false);
  tool.dispose(); foes.dispose(); clearTargets();
});

test('feel: a hit-stop nearly stops the world for its length, then lets go; four foes round you take turns, two striking at most, and keep apart', async () => {
  const { hitStop, feelDt, resetFeel, FEEL } = await import('../src/feel.js');
  resetFeel();
  hitStop(0.05);
  assert.ok(feelDt(DT) <= Math.max(DT * FEEL.slow, 1e-5), 'the frame freezes');
  for (let i = 0; i < 5; i++) feelDt(DT);
  assert.equal(feelDt(DT), DT, 'and back to its pace');
  clearTargets();
  const P = player(v(0, 0, 0));
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: true }, game: new GameState(null) });
  foes.waveRest = 999;
  for (const [x, z] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) foes.add('blot', v(x, 0, z));
  let most = 0;
  for (let i = 0; i < 6 / DT; i++) { foes.update(DT); most = Math.max(most, foes.list.filter((f) => f.state === 'wind').length); P.health = 1; }
  assert.ok(most >= 1 && most <= 2, `at most two wind up at once (${most})`);
  const [a, b] = foes.list;
  a.pos.set(5, 0, 5); b.pos.set(5.1, 0, 5);
  foes.keepApart();
  assert.ok(a.pos.distanceTo(b.pos) > 1, 'pushed apart');
  foes.dispose(); clearTargets();
});

test('ink: each foe cut down leaves ink, and the blade grows at its steps (reach, whirl, lunge), each said once', async () => {
  const { gainInk, inkOf, hasUpgrade, UPGRADES } = await import('../src/ink.js');
  const game = new GameState(null), notes = [];
  assert.equal(hasUpgrade('reach', game), false);
  gainInk(1, { game, notice: (t) => notes.push(t) });
  assert.match(notes[0], /ink/i, 'the first ink is explained');
  const reached = [];
  for (let i = 1; i < 45; i++) reached.push(...gainInk(1, { game, notice: (t) => notes.push(t) }).map((u) => u.id));
  assert.deepEqual(reached, UPGRADES.map((u) => u.id), 'each step once, in order');
  assert.equal(inkOf(game), 45);
  for (const u of UPGRADES) assert.ok(hasUpgrade(u.id, game) && notes.includes(u.text), u.id);
});

test('a relic out in the wilds is guarded: its blots gather as you come near, and once cut down they are gone for good', async () => {
  clearTargets();
  const game = new GameState(null);
  const P = player(v(0, 0, 380));
  const content = { npcs: [], relics: { spots: [{ at: [0, 0, 420] }], names: ['r'] } };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'nowhere', content, physics: flat, player: P, settings: { enemies: true }, game });
  foes.packRest = 999;
  foes.update(DT);
  assert.equal(foes.list.length, 0, 'not yet: 40 m away');
  P.pos.set(0, 0, 395);
  foes.update(DT);
  const guards = foes.list.filter((f) => f.guard);
  assert.equal(guards.length, 2, 'two guards round it');
  for (const f of guards) for (let i = 0; i < 2; i++) foes.hurt(f, 'blade', v(0, 0, 1), { damage: 1 });
  assert.equal(game.flag('foes.nowhere.r0'), true, 'cleared (a world with no roster: two blots)');
  for (let i = 0; i < 1 / DT; i++) foes.update(DT);
  assert.equal(foes.list.filter((f) => f.guard && f.alive).length, 0, 'and they do not come back');
  foes.dispose(); clearTargets();
});

test('more foes: the spitter keeps its distance and lobs at where you stand, the flyer hovers out of reach and dives low, the swarm falls to a push; a stilled foe takes the blade double', async () => {
  const { packKinds, waveWords } = await import('../src/foes.js');
  // the spitter: it backs off when you come close, and its ring lands where you stood
  const s = new Foe('spitter', v(0, 0, 0), { rng: () => 0.5 }), P = player(v(0, 0, 4));
  run(s, P, 0.5);
  assert.ok(s.pos.distanceTo(P.pos) > 4.2, 'backs off');
  let warned = false; for (let i = 0; i < 6 / DT && !warned; i++) warned = s.update(DT, P, env).includes('warn');
  assert.ok(warned && s.attackAt.distanceTo(v(P.pos.x, 0, P.pos.z)) < 0.01, 'its ring is drawn under you');
  // the flyer: high, out of the blade's reach; after its dive, low
  const f = new Foe('flyer', v(0, 0, 0), { rng: () => 0.5 }), Q = player(v(0, 0, 5));
  run(f, Q, 0.3);
  assert.ok(f.chest.y > 3, 'flies high');
  let dove = false; for (let i = 0; i < 8 / DT && !dove; i++) dove = f.update(DT, Q, env).some((e) => e.type === 'strike');
  assert.ok(dove && f.alt < 1, 'dove, and low');
  // the swarm: a push ends one; a stilled blot takes a cut double
  const w = new Foe('swarm', v());
  assert.equal(w.hit('push', v(0, 0, 1), { shove: 2 }), 'burst');
  const b = new Foe('blot', v()); b.hit('stun');
  assert.equal(b.hit('blade', v(0, 0, 1), { damage: 1 }), 'burst', 'stilled: one cut is two');
  // packs: the first one blot; flyers only under open sky
  assert.deepEqual(packKinds(0, 'desert'), ['blot']);
  for (let i = 0; i < 40; i++) assert.ok(!packKinds(3, 'desert', () => (i % 10) / 10).includes('flyer'), 'no flyers in the desert');
  assert.ok([...Array(40)].some((_, i) => packKinds(3, 'arzach', () => (i % 10) / 10).includes('flyer')), 'flyers in Vael');
  assert.equal(waveWords(['machine', 'machine', 'blot', 'blot', 'flyer']), '2 machines, 1 winged blot and 2 ink blots');
});

test('difficulty: gentle halves the harm, slows the wind-ups and lets one strike at a time; off has none; an old on / off setting carries over', async () => {
  const { GENTLE } = await import('../src/foes.js');
  globalThis.matchMedia ??= () => ({ matches: false }); globalThis.window ??= new EventTarget();   // (ui.js reads them at import)
  const { migrateSettings } = await import('../src/ui.js');
  assert.equal(migrateSettings({ enemies: true }).enemies, 'normal');
  assert.equal(migrateSettings({ enemies: false }).enemies, 'off');
  clearTargets();
  const P = player(v(0, 0, 0));
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'desert', physics: flat, player: P, settings: { enemies: 'gentle' }, game: new GameState(null) });
  assert.equal(foes.strikers, 1);
  const f = foes.add('blot', v(0, 0, 1.5));
  P.health = 0.2; foes.strike(f);
  assert.ok(Math.abs(P.hurts.at(-1) - FOES.blot.attack.damage * GENTLE.harm) < 1e-9, 'half the harm');
  assert.equal(foes.env.slow(), GENTLE.wind);
  const off = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'desert', physics: flat, player: P, settings: { enemies: 'off' }, game: new GameState(null) });
  assert.equal(off.on, false);
  foes.dispose(); off.dispose(); clearTargets();
});

test('the shade: a person of living shadow, in later packs and in the Arena, tougher than a blot, cutting with a sword\'s swing', async () => {
  const { packKinds, WAVES, waveWords } = await import('../src/foes.js');
  const { SHADE_STRIKE } = await import('../src/shade.js');
  assert.ok(FOES.shade.hp > FOES.blot.hp && FOES.shade.attack.shape === 'cone');
  assert.ok(SHADE_STRIKE.from < SHADE_STRIKE.cut && SHADE_STRIKE.cut < SHADE_STRIKE.to, 'the clip winds up to its cut, then follows through');
  // (the enemy roster: shades walk only the worlds whose table lists them, from the fourth pack: src/foe-worlds.js)
  const rng = (() => { let k = 5; return () => ((k = (k * 16807) % 2147483647) / 2147483647); })();
  assert.ok(Array.from({ length: 300 }, (_, n) => packKinds(4 + (n % 6), 'eclipse', rng)).flat().includes('shade'), 'shades in the Eclipse’s later packs');
  assert.ok(!Array.from({ length: 100 }, (_, n) => packKinds(1 + (n % 6), 'desert', rng)).flat().includes('shade'), 'none in the Desert');
  assert.ok(!packKinds(1, 'eclipse', () => 0.05).includes('shade'), 'never early on');
  assert.ok(WAVES.some((w) => w.includes('shade')), 'and in the Arena');
  assert.equal(waveWords(['shade', 'shade', 'blot']), '2 shades and 1 ink blot');
  // without the game's bodies (here, in node) it still fights, drawn as a blot
  clearTargets();
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: player(v()), settings: { enemies: 'normal' }, game: new GameState(null) });
  const s = foes.add('shade', v(0, 0, 2));
  for (let i = 0; i < 4; i++) foes.hurt(s, 'blade', v(0, 0, 1), { damage: 1 });
  assert.equal(s.alive, true, 'four cuts are not enough');
  foes.hurt(s, 'blade', v(0, 0, 1), { damage: 1 });
  assert.equal(s.alive, false);
  foes.dispose(); clearTargets();
});

test('in a temple the machines meet its kit: a gust shoves them, and one standing on a plate presses it', () => {
  clearTargets();
  const pressed = new Set();
  const kit = { local: (p) => p.clone() };
  const gust = { dirW: v(1, 0, 0), push: 7.5, state: 1, box: new THREE.Box3(v(-5, -1, -5), v(5, 5, 5)), sheltered: () => false };
  const plate = { id: 'p1', pos: v(20, 0, 0), r: 1.3, solid: {}, weighed: () => false };
  const rt = { kit, pieces: [gust, plate], marks: [], logic: { press: (id, by) => pressed.add(`${id}:${by}`), release: (id, by) => pressed.delete(`${id}:${by}`) }, inside: () => true };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), temple: rt }, levelId: 'desert', physics: flat, player: player(v(0, 0, -30)), settings: { enemies: 'normal' }, game: new GameState(null) });
  const m = foes.add('machine', v(0, 0, 0)), n = foes.add('machine', v(20, 0, 0));
  foes.templeKit();
  assert.ok(m.vel.x > 4, 'shoved down the hall');
  assert.ok(pressed.has('p1:foe'), 'the plate pressed under the machine');
  n.pos.set(30, 0, 0); foes.templeKit();
  assert.ok(!pressed.has('p1:foe'), 'and let go when it walks off');
  foes.dispose(); clearTargets();
});
