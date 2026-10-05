// Home: the two houses you walk into (no rain indoors), the garden and its
// flowers, the cloth that hangs there, the stone and what is laid on it
// (src/levels/home.js, home-houses.js, home-garden.js, src/hanging-cloth.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState, game } from '../src/game-state.js';
import { Physics } from '../src/physics.js';
import { createHome, HOME_SPOTS, laidTokens, unlaidTokens, layTokens } from '../src/levels/home.js';
import { HangingCloth } from '../src/hanging-cloth.js';
import { isIndoors, Shelter } from '../src/shelter.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const memory = () => { const store = new Map(); return new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('home builds: the round house, the small house, the garden, the cloths', () => {
  const scene = new THREE.Scene();
  const level = quiet(() => createHome(scene));
  const H = level.home;
  assert.ok(H.parents && H.small && H.garden && H.cloths, 'everything is there');
  assert.ok(H.cloths.list.length >= 15, `${H.cloths.list.length} cloths`);
  assert.ok(H.garden.flowers.length >= 20, 'a border of flowers');
  assert.ok(level.tomb.group.parent === scene);
});

test('indoors (either house) the rain stays out; in the yard it falls', () => {
  const level = quiet(() => createHome(new THREE.Scene()));
  const { parents, small } = level.home;
  const inParents = parents.spots.inside.clone().add(V(0, 1.6, 0)), inSmall = small.spots.inside.clone().add(V(0, 1.6, 0));
  assert.equal(level.indoorAt(inParents), 'parents');
  assert.equal(level.indoorAt(inSmall), 'small');
  assert.equal(level.indoorAt(V(0, 1.6, 10)), null, 'the yard is outdoors');
  assert.equal(level.indoorAt(small.doorOut.clone().add(V(0, 1.6, 0))), null, 'the doorstep is outdoors');
  assert.ok(isIndoors(inParents) && isIndoors(inSmall), 'registered with the shelter');
  assert.ok(!isIndoors(V(0, 1.6, 10)));
  for (const p of [inParents, inSmall, small.spots.table, small.spots.seat.clone().add(V(0, 1.2, 0)), parents.spots.chair.clone().add(V(0, 1.2, 0))]) {
    const s = new Shelter(null).update(1 / 30, p).apply({ rain: 1, storm: 0 });
    assert.equal(s.rain, 0, 'no rain drawn indoors');
  }
  const out = new Shelter(null).update(1 / 30, V(0, 1.6, 8)).apply({ rain: 1, storm: 0 });
  assert.equal(out.rain, 1, 'rain in the yard');
});

test('you can walk into both houses: open doorways, floors to stand on, walls round them', () => {
  const scene = new THREE.Scene();
  const level = quiet(() => createHome(scene));
  const physics = new Physics(scene, level.ground);
  const { parents, small } = level.home;
  const DOWN = V(0, -1, 0);
  // the floors
  for (const [p, f] of [[parents.spots.inside, parents.floor], [small.spots.inside, small.floor]]) {
    const g = physics.groundAt(p.x, p.y + 2, p.z);
    assert.ok(Math.abs(g - f) < 0.12, `a floor at ${f.toFixed(2)} (found ${g?.toFixed?.(2)})`);
  }
  // nothing solid between the doorstep and the room (at chest height), walls elsewhere
  const clear = (a, b) => { const d = b.clone().sub(a), len = d.length(); return !physics.rayHit(a, d.normalize(), len); };
  const chest = (p, f) => V(p.x, f + 1.2, p.z);
  assert.ok(clear(chest(small.doorOut, small.floor), chest(small.spots.inside, small.floor)), 'the small house’s door stands open');
  assert.ok(clear(chest(parents.outside, parents.floor), chest(parents.spots.inside, parents.floor)), 'the round house’s doorway is open (its door holds you until you open it)');
  const c = HOME_SPOTS.small;
  const side = V(c.x + Math.cos(HOME_SPOTS.smallFacing) * 8, small.floor + 1.2, c.z - Math.sin(HOME_SPOTS.smallFacing) * 8);
  assert.ok(!clear(side, V(c.x, small.floor + 1.2, c.z)), 'walls everywhere else');
  void DOWN;
});

test('cloth hangs from its pins and stays put in a gusty wind, and the traveller pushes it aside', () => {
  const a = V(0, 3, 0), b = V(1.6, 3, 0);
  const cloth = new HangingCloth(null, { a, b, length: 1.8, cols: 9, rows: 10, pins: [0, 4, 8], floor: 0 });
  const pins = [0, 4, 8].map((c) => cloth.p.slice(c * 3, c * 3 + 3));
  let t = 0;
  for (let i = 0; i < 900; i++, t += 1 / 60) cloth.update(1 / 60, { wind: V(6 * Math.sin(t * 0.7), 0, 4 + 3 * Math.sin(t * 1.9)), gust: Math.max(0, Math.sin(t * 3)) });
  for (const [i, c] of [0, 4, 8].entries()) assert.deepEqual([...cloth.p.slice(c * 3, c * 3 + 3)], [...pins[i]], 'the pegs hold');
  assert.ok([...cloth.p].every(Number.isFinite), 'no blow-up');
  assert.ok(cloth.stretch() < 1.35, `it doesn't tear (${cloth.stretch().toFixed(2)})`);
  const lowest = Math.min(...Array.from({ length: cloth.cols }, (_, c) => cloth.p[((cloth.rows - 1) * cloth.cols + c) * 3 + 1]));
  assert.ok(lowest < 2.6 && lowest >= 0.03 - 1e-6, `it hangs (hem at ${lowest.toFixed(2)} m), above the floor`);
  // still air: it settles hanging straight down under its pegs
  for (let i = 0; i < 600; i++) cloth.update(1 / 60, { wind: V(0, 0, 0) });
  const hem = cloth.p.slice(((cloth.rows - 1) * cloth.cols + 4) * 3, ((cloth.rows - 1) * cloth.cols + 4) * 3 + 3);
  assert.ok(Math.abs(hem[0] - 0.8) < 0.15 && Math.abs(hem[2]) < 0.15 && hem[1] < 1.4, `at rest it hangs below its middle peg (${[...hem].map((v) => v.toFixed(2))})`);
  // a body walking into it pushes it away
  const body = [{ a: V(0.8, 1.6, -0.6), b: V(0.8, 2.6, -0.6), r: 0.3 }];
  for (let k = 0; k <= 30; k++) { const z = -0.6 + k * 0.04; body[0].a.z = body[0].b.z = z; cloth.update(1 / 60, { wind: V(0, 0, 0), capsules: body }); }
  let inside = 0;
  for (let i = cloth.cols; i < cloth.cols * cloth.rows; i++) {
    const x = cloth.p[i * 3], y = cloth.p[i * 3 + 1], z = cloth.p[i * 3 + 2];
    if (y > 1.6 && y < 2.6 && Math.hypot(x - 0.8, z - body[0].a.z) < 0.28) inside++;
  }
  assert.equal(inside, 0, 'nothing of the cloth inside the body');
});

test('the flag on its pole and the bunting: pinned on one side, they stream with the wind', () => {
  const a = V(0, 6, 0), b = V(1.9, 6, 0);
  const flag = new HangingCloth(null, { a, b, length: 1, cols: 9, rows: 5, pins: (r, c) => c === 0, damp: 0.98 });
  for (let i = 0; i < 600; i++) flag.update(1 / 60, { wind: V(0, 0, 8) });
  const tip = flag.p.slice(((2) * 9 + 8) * 3, ((2) * 9 + 8) * 3 + 3);
  assert.ok(tip[2] > 0.6, `the free edge streams downwind (z ${tip[2].toFixed(2)})`);
  for (let r = 0; r < 5; r++) assert.ok(Math.abs(flag.p[(r * 9) * 3]) < 1e-6, 'the pole side stays on the pole');
  assert.ok([...flag.p].every(Number.isFinite));
});

test('the garden: flowers to pick, one at a time, and back on the next visit', () => {
  const level = quiet(() => createHome(new THREE.Scene()));
  const G = level.home.garden;
  const at = G.spots.border;
  const f = G.pick(at);
  const e = new THREE.Matrix4(); f.im.getMatrixAt(f.index, e);
  assert.ok(f && f.picked && e.determinant() === 0, 'picked one: gone from the border');
  const n = G.flowers.filter((x) => !x.picked).length;
  assert.equal(n, G.flowers.length - 1);
  assert.equal(G.pick(V(-40, 0, -40)), null, 'nothing to pick far from the border');
  const again = quiet(() => createHome(new THREE.Scene()));
  assert.ok(again.home.garden.flowers.every((x) => !x.picked), 'they grow back');
});

test('the stone keeps what was laid on it: at the ending, and at every visit since', () => {
  const g = memory();
  g.addKeepsake({ id: 'a', level: 'desert', name: 'A', kind: 'song' });
  g.addKeepsake({ id: 'b', level: 'incal', name: 'B', kind: 'word', text: '“B.”' });
  assert.deepEqual(laidTokens(g), [], 'nothing before the ending');
  // an older save: only the count was kept
  g.set('ending.done', true); g.set('ending.tokens', 1);
  assert.deepEqual(laidTokens(g).map((t) => t.id), ['a']);
  assert.deepEqual(unlaidTokens(g).map((t) => t.id), ['b']);
  layTokens(g, unlaidTokens(g));
  assert.deepEqual(laidTokens(g).map((t) => t.id).sort(), ['a', 'b']);
  assert.deepEqual(unlaidTokens(g), []);
  g.addKeepsake({ id: 'c', level: 'arzach', name: 'C', kind: 'person' });
  assert.deepEqual(unlaidTokens(g).map((t) => t.id), ['c'], 'a keepsake found since is not on it yet');
  void game;
});
