// The skull cave as a little temple with monsters (issue #730, docs/design/desert-red-temple.md): the level's own
// encounter site in the giant's chest (src/encounters/sites.js kind 'hall', src/levels/desert.js `sites`), three mummers
// and their king, the Desert's own troupe (issue #762), on its floor round the pool, on guard; each one cut down says so ('site:fell', the
// story lights a Givers' lamp for it: tests/desert-story.test.js); all down, the hall is cleared for good (the shrine's
// door: src/story/desert.js). With no foe about (the Enemies setting off, or unarmed), it counts as cleared as you come in.
// Far overhead, it wakes only from inside (`dy`).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { layoutSite, siteFlag, SITE } from '../src/encounters/sites.js';
import { Encounters } from '../src/encounters/index.js';
import { Foes } from '../src/foes.js';
import { WORLDS, worldArchetypes } from '../src/foe-worlds.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { clearInteractables } from '../src/interact.js';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 30;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (at) => ({ pos: at, vel: v(), heading: 0, hearts: 3, maxHearts: 3, down: null, dead: false, ride: null, onGround: true, hurt() {}, knockDown() { return true; }, frame: { up: v(0, 1, 0) } });

const HALL = { id: 'skull-hall', kind: 'hall', at: [0, 0, 0], foes: ['mummer', 'mummerking', 'mummer', 'mummer'], spots: [[12.7, 12.7], [15.6, -9], [-15.6, -9], [-12.7, 12.7]], coffer: [6.5, -16.5], dy: 25 };

function world({ at = v(0, 0, 20), enemies = true, armed = true, site = HALL } = {}) {
  clearTargets(); clearInteractables();
  const game = new GameState(null), P = player(at), toasts = [], fell = [];
  game.on('site:fell', (e) => fell.push(e));
  const tool = armed ? null : { swordOn: false };
  const level = { spawn: v(0, 0, -900), id: 'desert', sites: [site] };
  const foes = new Foes({ scene: new THREE.Scene(), level, levelId: 'desert', content: { npcs: [] }, physics: flat, player: P, tool, settings: { enemies: enemies ? 'normal' : 'off' }, game });
  const E = new Encounters({ foes, scene: new THREE.Scene(), level, levelId: 'desert', physics: flat, player: P, game, tool, toast: (t) => toasts.push(t), teach: (t) => toasts.push(t), rng: () => 0.5 });
  const step = (secs) => { for (let i = 0; i < secs / DT; i++) { foes.update(DT); E.update(DT, i * DT); } };
  return { game, P, foes, E, toasts, fell, step, restore: () => { E.dispose(); foes.dispose(); } };
}

test('the hall’s monsters are the Desert’s own: the mummers and their king, on guard at the places the level names, facing the pool', () => {
  const own = new Set(worldArchetypes('desert'));
  assert.ok(HALL.foes.every((a) => own.has(a)), 'of the Desert’s own roster');
  assert.equal(WORLDS.desert.stage, 0, 'the first world’s stage');
  const L = layoutSite(HALL);
  assert.equal(L.foes.length, 4);
  L.foes.forEach((f, i) => {
    assert.deepEqual(f.at, HALL.spots[i]);
    assert.equal(f.idle, 'guard');
    const toPool = Math.atan2(-f.at[0], -f.at[1]);
    assert.ok(Math.abs(Math.atan2(Math.sin(f.heading - toPool), Math.cos(f.heading - toPool))) < 1e-6, 'facing the middle');
  });
  assert.deepEqual(L.coffer.at, HALL.coffer);
  assert.equal(L.props.length, 0, 'the hall is the level’s: no props of its own');
});

test('the hall at work: out as you come in, each one down said, all down cleared for good (no camp’s words: the story’s lamps and door)', () => {
  const W = world();
  try {
    W.step(0.5);
    const out = W.foes.list.filter((f) => f.site?.id === 'skull-hall');
    assert.equal(out.length, 4, 'all four out as you come into the hall');
    assert.equal(new Set(out.map((f) => f.kind)).size, 2, 'two kinds: the mummers and their king');
    for (const [i, f] of out.entries()) {
      f.hp = 0; f.state = 'dead';
      W.step(0.2);
      assert.equal(W.fell.length, i + 1, `each one down is told (${i + 1})`);
      assert.equal(W.fell.at(-1).id, 'skull-hall');
      assert.equal(W.fell.at(-1).of, 4);
    }
    W.step(0.5);
    assert.equal(W.game.flag(siteFlag('desert', 'skull-hall')), true, 'cleared for good');
    assert.ok(!W.toasts.some((t) => /coffer is yours|camp is quiet/.test(t)), 'the hall’s words are the level’s own');
    W.step(1);
    assert.equal(W.foes.list.filter((f) => f.site && f.alive).length, 0, 'nothing comes out again');
  } finally { W.restore(); }
});

test('far overhead: the hall wakes only from inside it, never from the dunes under it', () => {
  const W = world({ at: v(0, -1000, 10) });
  try {
    W.step(1);
    assert.equal(W.foes.list.filter((f) => f.site).length, 0, 'nothing comes out for someone 1000 m below');
    W.P.pos.set(0, 0, 10);
    W.step(0.5);
    assert.equal(W.foes.list.filter((f) => f.site).length, 4, 'inside: they come out');
  } finally { W.restore(); }
});

test('no foe about (the Enemies setting off, or no blade): the hall counts as cleared as you come in, so its door is never kept shut', () => {
  for (const o of [{ enemies: false }, { armed: false }]) {
    const W = world({ ...o, at: v(0, 0, SITE.near + 30) });
    try {
      W.step(0.5);
      assert.equal(W.game.flag(siteFlag('desert', 'skull-hall')), undefined, 'not from outside its reach');
      W.P.pos.set(0, 0, 10);
      W.step(0.5);
      assert.equal(W.foes.list.length, 0, 'no foe');
      assert.equal(W.game.flag(siteFlag('desert', 'skull-hall')), true, `cleared (${JSON.stringify(o)})`);
      assert.equal(W.toasts.length, 0, 'quietly');
    } finally { W.restore(); }
  }
});

test('the desert’s level lists the hall in the giant’s chest: its monsters on the cave’s floor, clear of the shrine, the stair and the way in', async () => {
  const { createDesert } = await import('../src/levels/desert.js');
  const { Physics } = await import('../src/physics.js');
  const { SHRINE, HATCH } = await import('../src/desert-city.js');
  const scene = new THREE.Scene();
  const level = createDesert(scene);
  const physics = new Physics(scene, level.ground);
  const hall = level.sites.find((s) => s.id === 'skull-hall');
  assert.ok(hall && hall.kind === 'hall', 'the level’s own site');
  assert.deepEqual(hall.foes, ['mummer', 'mummerking', 'mummer', 'mummer']);
  const cave = level.qanat.cave, O = cave.origin;
  assert.ok(Math.abs(hall.at[1] - O.y) < 0.5 && hall.dy < 100, 'at the cave’s floor, far overhead');
  for (const [x, z] of [...hall.spots, hall.coffer]) {
    const g = physics.groundAt(x, O.y + 3, z, 8);
    assert.ok(Number.isFinite(g) && Math.abs(g - O.y) < 0.6, `on the floor at ${x.toFixed(1)}, ${z.toFixed(1)} (${g})`);
    const lx = x - O.x, lz = z - O.z;
    assert.ok(Math.hypot(lx - SHRINE.x, lz - SHRINE.z) > SHRINE.out + 2, 'clear of the shrine');
    assert.ok(!(Math.abs(lx) < 3 && lz < HATCH.stair.foot + 1), 'clear of the keepers’ stair');
    assert.ok(!(Math.abs(lx) < 4 && lz > 24), 'clear of the way in');
  }
  assert.equal(cave.hall.lamps.length, 4, 'four Givers’ lamps round the pool');
  for (const l of cave.hall.lamps) assert.equal(l.on, false, 'dark until the monsters fall');
});
