// The combat review's pure part (scripts/combat-review/lib.mjs; .claude/skills/combat-review/SKILL.md): the moves from
// the game's own tuning, hits to kill, the rubric's scores, for any roster (it names no kind).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movesFrom, hitsToKill, timeToKill, openingTime, band, kindFacts, scoreKind, guardianFacts, scoreGuardian, table, median } from '../scripts/combat-review/lib.mjs';
import { BLADE, SWINGS, CHARGE, AIR, RIPOSTE, DASH } from '../src/fluid-blade.js';
import { MODES } from '../src/fluid-kit.js';
import { FOES } from '../src/foes.js';
import { ELDER } from '../src/temples/arzach.js';

const FLUID = { charges: 3, refillDelay: 2, shoot: { cooldown: 0.28 } };   // (src/fluid-tool.js FLUID: its module wants a page)

test('the moves come from the blade\'s and the gun\'s tuning, every one the review rates', () => {
  const M = movesFrom({ BLADE, SWINGS, CHARGE, AIR, RIPOSTE, DASH, FLUID, MODES });
  assert.deepEqual(M.map((m) => m.id), ['combo', 'charge', 'air', 'riposte', 'dash', 'shoot', 'fire', 'push']);
  const by = Object.fromEntries(M.map((m) => [m.id, m]));
  assert.deepEqual(by.combo.hits, BLADE.damage);
  assert.equal(by.charge.damage, CHARGE.damage.at(-1));
  assert.equal(by.riposte.gated, 'parry');
  assert.ok(M.every((m) => m.cycle > 0.2 && m.cycle < 5), M.map((m) => `${m.id} ${m.cycle}`).join(', '));
  // the gun: three charges 0.28 s apart, then two seconds' refill
  assert.ok(Math.abs(by.shoot.cycle - (3 * 0.28 + 2) / 3) < 1e-9);
  assert.ok(by.fire.cycle > by.shoot.cycle, 'an ember costs more of the tank');
});

test('hits to kill, and the time it takes', () => {
  const foe = (hp, glance = () => false) => (i) => (glance(i) ? 'glance' : --hp <= 0 ? 'dead' : 'hit');
  assert.deepEqual(hitsToKill(foe(3)), { hits: 3, landed: 3, wasted: 0, dead: true });
  assert.deepEqual(hitsToKill(foe(2, (i) => i < 2)), { hits: 4, landed: 2, wasted: 2, dead: true });
  assert.equal(hitsToKill(() => false, 5).dead, false);
  assert.equal(timeToKill({ dead: true, hits: 3 }, { cycle: 1 }), 3);
  assert.equal(timeToKill({ dead: true, hits: 2 }, { cycle: 0.5, gated: 'parry' }, 2), 5);
  assert.equal(timeToKill({ dead: false, hits: 40 }, { cycle: 1 }), null);
  // a clapper-only foe (the bell walker): its blows in its 2.5 s openings, each a wait of one attack cycle for its drop
  assert.equal(openingTime(6, { opens: 2.5, landed: 6 }, { cycle: 1 }, 4), 6 + 3 * 4, 'two blows an opening: three openings');
  assert.equal(openingTime(3, { opens: 0, landed: 3 }, { cycle: 1 }, 4), 3, 'any other foe: unchanged');
  assert.equal(openingTime(null, { opens: 2.5, landed: 3 }, { cycle: 1 }), null);
});

test('every kind the game has gets facts and six scores in 1..5, whatever the roster', () => {
  assert.equal(band(0.2, [0.35, 0.5, 0.7, 0.95]), 1);
  assert.equal(band(1, [0.35, 0.5, 0.7, 0.95]), 5);
  for (const [k, D] of Object.entries(FOES)) {
    const F = kindFacts(k, D), S = scoreKind(F, { windSeen: F.windMin, damagePerMin: 0.5 }, 2, 3);
    for (const key of ['readability', 'counterplay', 'space', 'fairness', 'identity', 'combines']) assert.ok(S[key] >= 1 && S[key] <= 5, `${k} ${key} ${S[key]}`);
    assert.ok(F.windMin > 0, `${k}: a wind-up`);
  }
  // a made-up kind of a bigger roster scores too
  const F = kindFacts('newcomer', { name: 'new', hp: 3, attacks: [{ id: 'a', wind: 0.3, damage: 0.2 }] });
  assert.equal(F.role, 'melee');
  // a big threat on a short telegraph is unfair; no threat at all is dull
  assert.ok(scoreKind(F, { windSeen: 0.3, damagePerMin: 3 }).fairness <= 2);
  assert.ok(scoreKind(F, { windSeen: 0.9, damagePerMin: 0 }).fairness <= 2);
  assert.ok(scoreKind(F, { windSeen: 0.9, damagePerMin: 1.6 }).fairness >= 3);
});

test('a guardian gets facts and scores from its temple\'s def', () => {
  const G = guardianFacts('arzach.ELDER', ELDER);
  assert.equal(G.kind, 'organic'); assert.equal(G.phases, 3);
  assert.ok(G.teleMin >= 1 && G.attacks.length >= 4 && G.combos >= 1 && G.floor === 0);
  const S = scoreGuardian(G);
  for (const k of ['readability', 'counterplay', 'space', 'fairness', 'phases']) assert.ok(S[k] >= 1 && S[k] <= 5);
});

test('the report\'s table and median', () => {
  assert.equal(table(['a', 'b'], [[1, 'x|y']]), '| a | b |\n| --- | --- |\n| 1 | x/y |');
  assert.equal(median([3, 1, 2, NaN]), 2);
  assert.equal(median([]), null);
});
