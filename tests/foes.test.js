import test from 'node:test';
import assert from 'node:assert/strict';
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
  const P = { pos: at, vel: v(), heading: 0, frame, vehicles: [], object: { visible: true }, ride: null, onGround: true, aim: null, opts: {}, health: 1, down: null, dead: false,
    hurts: [], knocks: 0,
    hurt(a) { this.health = Math.max(0, this.health - a); this.hurts.push(a); },
    knockDown() { this.knocks++; return true; } };
  return P;
}
const run = (f, P, secs) => { const ev = []; for (let i = 0; i < secs / DT; i++) ev.push(...f.update(DT, P, env)); return ev; };

test('an ink blot notices you, comes, draws its lunge on the ground first, and the lunge lands only where it was drawn', () => {
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
  const miss = run(g, Q, FOES.blot.attack.wind + 0.1).find((e) => e.type === 'strike');
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
  assert.match(notes[0], /LB \/ L1/, 'in the pad form native-pad.js rewrites');
  // a strike at full health leaves at least the floor
  foes.strike(foes.list[0]);
  assert.ok(P.health >= HIT.floor - 1e-9, 'never all of a healthy bar');
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

test('held, the blade button raises the guard after the swing: a strike from in front is blocked for a charge, the foe reels; from behind, or with the tank empty, it gets through', async () => {
  const { GUARD, inGuard } = await import('../src/fluid-blade.js');
  assert.ok(inGuard(v(), v(0, 0, 1), v(1, 0, 3)) && !inGuard(v(), v(0, 0, 1), v(0, 0, -3)), 'in front, not behind');
  clearTargets();
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.6, 10); camera.updateMatrixWorld();
  const P = player(v()); P.heading = 0; P.flinches = 0; P.flinch = function () { this.flinches++; };
  const tool = new FluidTool({ scene: new THREE.Scene(), player: P, physics: flat, camera, rig: { aimK: 0 }, state: new GameState(null) });
  for (let i = 0; i < 1.2 / DT; i++) tool.update(DT, { KeyF: true });   // the swing, then held: the guard
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
  // let go: the guard comes down
  for (let i = 0; i < 0.6 / DT; i++) tool.update(DT, {});
  assert.equal(tool.blade.guarding, false);
  tool.dispose(); foes.dispose(); clearTargets();
});
