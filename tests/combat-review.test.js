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

test('every guardian\'s quickest move tells for 1.2 s or more, so each reads 4 or better (v1.63, #258); its round of moves is measured', async () => {
  const { GUARDIANS } = await import('../src/arena-guardians.js');
  const { guardianRound } = await import('../scripts/combat-review/lib.mjs');
  assert.equal(GUARDIANS.length, 14);
  for (const G of GUARDIANS) {
    const F = guardianFacts(G.id, G.def), S = scoreGuardian(F);
    assert.ok(F.teleMin >= 1.2, `${G.id}: its quickest move ${F.teleMin} s`);
    assert.ok(S.readability >= 4 && S.fairness >= 4, `${G.id}: read ${S.readability}, fair ${S.fairness}`);
    const R = guardianRound(G.def);
    assert.equal(R.phases.length, F.phases, `${G.id}: a round a phase`);
    assert.ok(R.total > 30 && R.total < 120, `${G.id}: its rounds ${R.total} s`);
  }
});

test('the report\'s table and median', () => {
  assert.equal(table(['a', 'b'], [[1, 'x|y']]), '| a | b |\n| --- | --- |\n| 1 | x/y |');
  assert.equal(median([3, 1, 2, NaN]), 2);
  assert.equal(median([]), null);
});

test('guard, parry and evade: the windows found from the tries, and the report grouped (defend.mjs)', async () => {
  const { defenceWindows, defenceMarkdown, groupRows } = await import('../scripts/combat-review/lib.mjs');
  const tries = [
    { action: 'guard', lead: 0.5, outcome: 'hit' }, { action: 'guard', lead: 0.3, outcome: 'block' }, { action: 'guard', lead: 0.12, outcome: 'parry' }, { action: 'guard', lead: 0.06, outcome: 'parry' },
    { action: 'evade', lead: 0.35, outcome: 'hit' }, { action: 'evade', lead: 0.15, outcome: 'evaded' }, { action: 'evade', lead: 0.08, outcome: 'evaded' }, { action: 'evade', lead: 0.03, outcome: 'missed' },
  ];
  const w = defenceWindows(tries);
  assert.equal(w.guardHolds, 0.3, 'the guard holds when raised 0.3 s ahead, not 0.5');
  assert.deepEqual(w.parry, [0.06, 0.12]);
  assert.deepEqual(w.evade, [0.08, 0.15]);
  assert.equal(w.through, 2); assert.equal(w.missed, 1);
  assert.deepEqual(defenceWindows([]), { guardHolds: null, parry: null, evade: null, through: 0, missed: 0 });
  const rows = [{ name: 'a', role: 'melee', worlds: ['desert'], atk: 'bite', wind: 0.6, tries, ...w }, { name: 'b', role: 'ranged', worlds: [], atk: 'spit', wind: 0.8, tries: [], ...defenceWindows([]) }];
  const md = defenceMarkdown(rows, { leads: { guard: [0.5, 0.3, 0.12, 0.06], evade: [0.35, 0.15, 0.08, 0.03] } });
  assert.match(md, /### Role: melee/); assert.match(md, /### Role: ranged/);
  assert.match(md, /\| a \| bite \| 0\.6 \| - \| H \| B \| P \| P \| H \| E \| E \| · \| 0\.3 \| 0\.06–0\.12 \| 0\.08–0\.15 \| 2 \|/);
  assert.match(defenceMarkdown(rows, { group: 'world' }), /First fielded in: desert[\s\S]*First fielded in: the Arena only/);
  const g = groupRows([{ facts: { role: 'air' } }, { facts: { role: 'air' } }, { facts: { role: 'heavy' } }], 'role');
  assert.deepEqual(Object.keys(g), ['air', 'heavy']); assert.equal(g.air.length, 2);
});

test('the curve takes a pack cleared by a scripted traveller, and the lock-on look (arena.mjs --pack-clear, --pack-look)', async () => {
  const { curveTable, curveMarkdown } = await import('../scripts/combat-review/lib.mjs');
  const rows = [
    { world: 'w', pack: ['a', 'b'], heartsPerMin: 6, attacksPerMin: 20, ttkBest: 4, ttkCombo: 5, look: 'lock', clear: { cleared: true, s: 10, hearts: 1.5 } },
    { world: 'w', pack: ['a'], heartsPerMin: 4, attacksPerMin: 10, ttkBest: 2, ttkCombo: 3, look: 'lock', clear: { cleared: false, s: 90, hearts: 2.5 } },
  ];
  const [c] = curveTable(rows, { order: ['w'], hearts: { w: { arrival: 5 } } });
  assert.equal(c.clearS, 50); assert.equal(c.clearHearts, 2); assert.equal(c.clearShare, 40); assert.equal(c.cleared, 1); assert.equal(c.clearRuns, 2);
  const md = curveMarkdown([c]);
  assert.match(md, /hearts\/min \(locked on\)/); assert.match(md, /cleared in \(s\)/); assert.match(md, /\| 50 \| 2 \| 40 % \| 1 of 2 \|/);
  // a run without them reads as before
  const [d] = curveTable(rows.map(({ clear, look, ...r }) => r), { order: ['w'], hearts: { w: { arrival: 5 } } });
  assert.equal(d.clearS, undefined); assert.doesNotMatch(curveMarkdown([d]), /cleared in/); assert.match(curveMarkdown([d]), /hearts\/min \(still\)/);
});
