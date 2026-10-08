// Ink tide (src/minigames/waves.js, docs/systems/minigames.md): the waves growing in size and mix, the
// Gentle setting's smaller ones, the chain and the style, the boons (choice and what they change), the basin.
import test from 'node:test';
import assert from 'node:assert/strict';
import waves, { TIDE, COST, FIRST, waveKinds, waveBudget, chainMult, killPoints, tideScore, BOONS, boonChoice, boonTunings, basinHeight, SPRINGS } from '../src/minigames/waves.js';
import { FOES, Foes } from '../src/foes.js';
import { BLADE, EVADE, GUARD } from '../src/fluid-blade.js';
import { checkGame } from '../src/minigames/index.js';
import { mulberry32 } from '../src/noise.js';

const costOf = (kinds) => kinds.reduce((a, k) => a + (k === 'swarm' ? COST.swarm / 5 : COST[k]), 0);

test('ink tide is a complete game, played on foot', () => {
  assert.deepEqual(checkGame(waves), []);
  assert.equal(waves.drives, false);
  for (const k of Object.keys(COST)) assert.ok(FOES[k], `${k} is one of the game's foes`);
  for (const b of ['RB / R1', 'LB / L1', 'X / □']) assert.ok(waves.controls.pad.some(([x]) => x === b), b);
});

test('the waves grow in size and in mix; each new kind comes in on its own wave', () => {
  const rng = mulberry32(3);
  let lastCost = 0;
  for (let n = 1; n <= 14; n++) {
    const kinds = waveKinds(n, { rng });
    const fresh = Object.keys(FIRST).find((k) => FIRST[k] === n);
    if (fresh) assert.ok(kinds.includes(fresh), `wave ${n} brings in the ${fresh}`);
    for (const k of kinds) assert.ok(FIRST[k] <= n, `wave ${n}: no ${k} before wave ${FIRST[k]}`);
    const c = costOf(kinds);
    assert.ok(c <= waveBudget(n) + 1 + 1e-9, `wave ${n} within its budget (${c})`);
    if (n > 2) assert.ok(c >= lastCost * 0.6, `wave ${n} is not much smaller than the last`);
    lastCost = c;
    if (kinds.includes('swarm')) assert.equal(kinds.filter((k) => k === 'swarm').length % 5, 0, 'a swarm is five');
  }
  assert.deepEqual(waveKinds(1, { rng: () => 0.5 }), ['blot', 'blot']);
  // over many runs the late waves are bigger and heavier than the early ones
  const avg = (n) => { let s = 0; for (let i = 0; i < 40; i++) s += costOf(waveKinds(n, { rng: mulberry32(i) })); return s / 40; };
  assert.ok(avg(10) > avg(3) * 2, `${avg(3)} → ${avg(10)}`);
});

test('gentle: smaller waves, never a crowd', () => {
  for (let n = 1; n <= 12; n++) for (let i = 0; i < 10; i++) {
    const g = waveKinds(n, { gentle: true, rng: mulberry32(i * 31 + n) }), N = waveKinds(n, { rng: mulberry32(i * 31 + n) });
    assert.ok(costOf(g) <= costOf(N) + 1.6, `wave ${n}`);
    assert.ok(g.filter((k) => k !== 'swarm').length <= 5 + Math.floor(n / 4), `wave ${n} gentle: ${g}`);
  }
  assert.ok(waveBudget(6, true) < waveBudget(6));
});

test('style: quick kills chain up to ×3; the score is the waves and the style', () => {
  assert.deepEqual([1, 2, 3, 5, 9, 20].map((c) => chainMult(c)), [1, 1.25, 1.5, 2, 3, 3]);
  assert.equal(killPoints('machine', 1), 40);
  assert.equal(killPoints('blot', 3), 15);
  assert.equal(tideScore({ waves: 4, style: 230 }), 4 * TIDE.wavePoints + 230);
});

test('the boons: three different ones, none past its limit, and what they change', () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 30; i++) {
    const c = boonChoice({}, rng);
    assert.equal(c.length, 3);
    assert.equal(new Set(c).size, 3);
  }
  const full = Object.fromEntries(BOONS.map((b) => [b.id, b.max]));
  assert.deepEqual(boonChoice(full, rng), []);
  const almost = { ...full, reach: 1 };
  assert.deepEqual(boonChoice(almost, rng), ['reach']);
  const base = boonTunings({});
  assert.equal(base.reach, BLADE.reach); assert.equal(base.charges, 3); assert.equal(base.cooldown, EVADE.cooldown); assert.equal(base.perfect, GUARD.perfect);
  const T = boonTunings({ reach: 2, ink: 1, refill: 1, heavy: 1, feet: 1, parry: 1, mend: 1 });
  assert.ok(Math.abs(T.reach - BLADE.reach * 1.44) < 1e-9);
  assert.equal(T.charges, 4);
  assert.ok(T.delay < 2 && T.cooldown < EVADE.cooldown && T.speed > EVADE.speed && T.perfect > GUARD.perfect && T.regen > base.regen && T.wait < base.wait);
  assert.deepEqual(T.damage, BLADE.damage.map((d) => d + 0.5));
  for (const b of BOONS) assert.ok(b.name && b.text && b.color && b.max >= 1, b.id);
});

test('the basin: a flat floor, a low rim, the shore down under the ink; the springs on the floor', () => {
  assert.ok(Math.abs(basinHeight(3, 4)) < 0.1);
  assert.ok(basinHeight(0, 20.5) > 0.4, 'the rim');
  assert.ok(basinHeight(0, 28) < -0.9, 'under the ink');
  for (const s of SPRINGS) { const r = Math.hypot(s.x, s.z); assert.ok(r > 12 && r < TIDE.arena); }
});

test('a game’s own foes: on whatever the Enemies setting, none from the wilds, no ink for the blade', () => {
  const level = { foes: { own: true, wild: false, noInk: true } };
  const F = new Foes({ scene: null, level, levelId: 'arena', physics: null, player: { pos: { x: 0, y: 0, z: 0 } }, settings: { enemies: 'off' } });
  assert.equal(F.on, true);
  assert.equal(F.waves, true);
  assert.equal(F.own, true);
  const plain = new Foes({ scene: null, level: { foes: { wild: false } }, levelId: 'arena', physics: null, player: {}, settings: { enemies: 'off' } });
  assert.equal(plain.on, false);
});

test('foes made and let go leave no materials behind (200 over a long Ink tide)', async () => {
  const THREE = await import('three');
  const { materialCount } = await import('../src/materials.js');
  const level = { foes: { own: true, wild: false, noInk: true } };
  const F = new Foes({ scene: new THREE.Scene(), level, levelId: 'arena', physics: null, player: { pos: { x: 0, y: 0, z: 0 } }, settings: { enemies: 'off' } });
  const kinds = ['blot', 'spitter', 'swarm', 'machine', 'flyer', 'shade'];
  const wave = (n) => { const fs = []; for (let i = 0; i < n; i++) fs.push(F.add(kinds[i % kinds.length], new THREE.Vector3(i, 0, 0))); for (const f of fs) F.remove(f); };
  wave(kinds.length);   // the shared ones made once
  const before = materialCount();
  wave(200);
  assert.equal(materialCount(), before, 'the material count stays flat');
  assert.equal(F.list.length, 0);
});
