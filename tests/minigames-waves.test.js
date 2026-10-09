// Ink tide (src/minigames/waves.js, docs/systems/minigames.md): the waves growing in size and mix, the
// Gentle setting's smaller ones, the chain and the style, the boons (choice and what they change), the basin.
import test from 'node:test';
import assert from 'node:assert/strict';
import waves, { TIDE, COST, FIRST, GROUP, KILL, heads, waveCap, waveKinds, waveBudget, chainMult, killPoints, tideScore, BOONS, boonChoice, boonTunings, basinHeight, SPRINGS } from '../src/minigames/waves.js';
import { FOES, Foes, Foe, waveWords } from '../src/foes.js';
import { KINDS } from '../src/foe-kinds.js';
import { ARCHETYPE_KINDS } from '../src/enemies/archetypes.js';
import { BLADE, EVADE, GUARD } from '../src/fluid-blade.js';
import { checkGame } from '../src/minigames/index.js';
import { mulberry32 } from '../src/noise.js';

const costOf = (kinds) => kinds.reduce((a, k) => a + COST[k] / (GROUP[k] ?? 1), 0);
const standing = (kinds) => kinds.reduce((a, k) => a + heads(k), 0);

test('ink tide is a complete game, played on foot', () => {
  assert.deepEqual(checkGame(waves), []);
  assert.equal(waves.drives, false);
  for (const k of Object.keys(COST)) assert.ok(FOES[k], `${k} is one of the game's foes`);
  for (const k of Object.keys(FIRST)) assert.ok(COST[k] && KILL[k], `${k} has a cost and points`);
  for (const b of ['RB / R1', 'LB / L1', 'B / ○']) assert.ok(waves.controls.pad.some(([x]) => x === b), b);
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
    for (const [k, g] of Object.entries(GROUP)) assert.equal(kinds.filter((x) => x === k).length % g, 0, `a ${k} group is ${g}`);
  }
  assert.deepEqual(waveKinds(1, { rng: () => 0.5 }), ['blot', 'blot']);
  // over many runs the late waves are bigger and heavier than the early ones
  const avg = (n) => { let s = 0; for (let i = 0; i < 40; i++) s += costOf(waveKinds(n, { rng: mulberry32(i) })); return s / 40; };
  assert.ok(avg(10) > avg(3) * 2, `${avg(3)} → ${avg(10)}`);
});

test('the worlds’ own foes come in after the shade, one every wave or two, mixed in with the old ones', () => {
  const late = Object.keys(FIRST).filter((k) => FIRST[k] > 6).sort((a, b) => FIRST[a] - FIRST[b]);
  const worlds = [...Object.keys(KINDS), ...Object.keys(ARCHETYPE_KINDS).filter((k) => k !== 'blot')];
  assert.deepEqual(late.slice().sort(), worlds.filter((k) => !FOES[k].noWild && FIRST[k] > 6).sort(), 'every kind of the worlds that roams comes in, the built archetypes too');
  assert.equal(FIRST[late[0]], 7);
  for (let i = 1; i < late.length; i++) assert.ok(FIRST[late[i]] - FIRST[late[i - 1]] <= 2 && FIRST[late[i]] > FIRST[late[i - 1]], `${late[i]} a wave or two after ${late[i - 1]}`);
  for (const k of late) {
    // its wave brings it in, with old ones beside it; and later waves still hold it now and then
    for (let i = 0; i < 10; i++) {
      const w = waveKinds(FIRST[k], { rng: mulberry32(i + 7) });
      assert.ok(w.includes(k), `wave ${FIRST[k]} brings in the ${k}`);
      assert.ok(w.some((x) => FIRST[x] <= 6), `wave ${FIRST[k]}: the old foes too (${w})`);
      assert.ok(waveWords(w).length > 0);
    }
    let seen = 0;
    for (let i = 0; i < 40; i++) if (waveKinds(FIRST[k] + 3, { rng: mulberry32(i) }).includes(k)) seen++;
    assert.ok(seen >= 6, `the ${k} comes back after its wave (${seen}/40)`);
  }
  // the group kinds come as their groups
  assert.equal(waveKinds(FIRST.moth, { rng: () => 0.99 }).filter((k) => k === 'moth').length % 3, 0);
});

test('every new kind can fight in the basin: a ray buried in its sand, drones hovering, hounds running as shadows', async () => {
  const THREE = await import('three');
  const env = { ground: (x, z) => basinHeight(x, z), seen: () => true };
  const P = { pos: new THREE.Vector3(0, 0, 4), vel: new THREE.Vector3(), heading: 0, onGround: true, health: 1, hurt() {}, knockDown() { return true; }, flinch() {} };
  for (const k of Object.keys(FIRST).filter((x) => FIRST[x] > 6)) {
    const s = SPRINGS[0], f = new Foe(k, new THREE.Vector3(s.x, basinHeight(s.x, s.z), s.z), { rng: mulberry32(2) });
    f.def = { ...f.def, sight: 80, giveUp: 1e9 }; f.state = 'chase';
    let wound = false, minD = 1e9;
    for (let i = 0; i < 60 * 12 && !wound; i++) {
      f.update(1 / 60, P, env);
      minD = Math.min(minD, Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z));
      if (f.state === 'wind') wound = true;
      if (k === 'drone' && i === 120) assert.ok(f.alt > 1.5, 'a drone hovers over the sand');
      if (k === 'hound' && f.state === 'chase') assert.ok(f.phased, 'a hound running is a shadow');
      if (k === 'worm' && f.state === 'chase') assert.ok(f.buried, 'a ray chasing swims under the sand');
      assert.ok(Math.hypot(f.pos.x, f.pos.z) < TIDE.arena + 4, `${k} stays in the basin`);
    }
    assert.ok(wound, `a ${k} from a spring comes for you and winds up a strike (closest ${minD.toFixed(1)} m)`);
  }
});

test('gentle: smaller waves, never a crowd', () => {
  for (let n = 1; n <= 20; n++) for (let i = 0; i < 10; i++) {
    const g = waveKinds(n, { gentle: true, rng: mulberry32(i * 31 + n) }), N = waveKinds(n, { rng: mulberry32(i * 31 + n) });
    assert.ok(costOf(g) <= costOf(N) + 1.6, `wave ${n}`);
    assert.ok(standing(g) <= 5 + Math.floor(n / 4), `wave ${n} gentle: ${g}`);
    assert.ok(standing(N) <= waveCap(n), `wave ${n}: ${N}`);
  }
  assert.equal(waveCap(1, true), 5);
  assert.equal(heads('skitter'), 0); assert.equal(heads('golem'), 1, 'a golem is one (its splinters are retired)');
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
  // Steady eyes: only once the moths are about; it shortens a flash's white and a line's hold
  for (let i = 0; i < 40; i++) assert.ok(!boonChoice({}, mulberry32(i), 3, 6).includes('eyes'), 'not before the moths');
  let offered = 0;
  for (let i = 0; i < 40; i++) if (boonChoice({}, mulberry32(i), 3, 7).includes('eyes')) offered++;
  assert.ok(offered > 5, `offered from wave 7 (${offered}/40)`);
  const E = boonTunings({ eyes: 1 });
  assert.ok(E.blind < 1 && E.hold < 1 && boonTunings({}).blind === 1 && boonTunings({}).hold === 1);
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

test('foes made and let go leave no materials behind (200 over a long Ink tide, the worlds’ kinds too)', async () => {
  const THREE = await import('three');
  const { materialCount } = await import('../src/materials.js');
  const level = { foes: { own: true, wild: false, noInk: true } };
  const F = new Foes({ scene: new THREE.Scene(), level, levelId: 'arena', physics: null, player: { pos: { x: 0, y: 0, z: 0 } }, settings: { enemies: 'off' } });
  const kinds = Object.keys(FIRST).concat('crab@saltharbour', 'lizard@bazaar', 'tripod@underwater', 'hound@spheres');
  const wave = (n) => { const fs = []; for (let i = 0; i < n; i++) fs.push(F.add(kinds[i % kinds.length], new THREE.Vector3(i, 0, 0))); for (const f of fs) F.remove(f); };
  wave(kinds.length);   // the shared ones made once
  const before = materialCount();
  wave(200);
  assert.equal(materialCount(), before, 'the material count stays flat');
  assert.equal(F.list.length, 0);
});
