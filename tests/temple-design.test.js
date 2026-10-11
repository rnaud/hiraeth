// The temple design audit's pure logic (scripts/temple-design/lib.mjs, .claude/skills/temple-design-qc):
// each function shown the case it is for, on small made-up temples, and once on a real temple's logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conditionKeys, reversible, mechanicOf, puzzleGraph, obviousness, templeMetrics, scoreTemple, skeleton, similarity, rankTrend, piecePos, planSvg } from '../scripts/temple-design/lib.mjs';

// a linear temple: a plate door, the chest, a gadget door, the guardian (the shape every temple had in October 2026)
const LINEAR = {
  id: 'lin', entry: 'a', gadget: 'fire',
  rooms: { a: {}, b: {}, c: {}, d: { boss: true }, out: {} },
  links: [{ a: 'a', b: 'b', door: 'd1' }, { a: 'b', b: 'c', door: 'd2' }, { a: 'c', b: 'd', door: 'd3' }, { a: 'd', b: 'out', door: 'd5' }],
  elements: {
    p1: { type: 'plate', room: 'a' },
    d1: { type: 'door', opens: { pressed: 'p1' }, latch: true },
    chest: { type: 'gadget', room: 'b', item: 'fire' },
    b1: { type: 'brazier', room: 'b', needs: ['fire'] },
    d2: { type: 'door', opens: { lit: 'b1' }, latch: true },
    d3: { type: 'door', opens: null },
    boss: { type: 'boss', room: 'd', needs: ['backpack', 'fire'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};
const LIN_PIECES = [
  { cls: 'Mark', o: { room: 'a', at: [0, 0, 5] } }, { cls: 'Plate', o: { id: 'p1', at: [2, 0, 12] } }, { cls: 'Door', o: { id: 'd1', at: [0, 0, 15] } },
  { cls: 'Mark', o: { room: 'b', at: [0, 0, 20] } }, { cls: 'Brazier', o: { id: 'b1', at: [2, 0, 27] } }, { cls: 'Door', o: { id: 'd2', at: [0, 0, 30] } },
  { cls: 'Mark', o: { room: 'c', at: [0, 0, 35] } }, { cls: 'Door', o: { id: 'd3', at: [0, 0, 40] } }, { cls: 'Mark', o: { room: 'd', at: [0, 0, 50] } },
  { cls: 'Door', o: { id: 'd5', at: [0, 0, 60] } },
];

test('a condition names its keys, a ball on a plate is a push, and a latched plate door never closes again', () => {
  assert.deepEqual(conditionKeys({ all: [{ pressed: 'p1' }, { lit: 's1' }, { drumOn: ['ball', 'p2'] }] }).map((k) => k.id), ['p1', 's1', 'ball', 'p2']);
  const E = { p1: { type: 'plate' }, p2: { type: 'plate' }, ball: { type: 'drum', plate: 'p2' } };
  assert.equal(reversible({ pressed: 'p1' }, E), true, 'a plate you stand on lets go when you step off');
  assert.equal(reversible({ pressed: 'p2' }, E), false, 'a ball resting on it holds it');
  assert.deepEqual(mechanicOf('p2', E.p2, { elements: E }), ['push']);
  assert.deepEqual(mechanicOf('p1', E.p1, { elements: E }), ['weight']);
  assert.deepEqual(mechanicOf('k1', { type: 'switch', needs: ['magic:4'] }, { piece: { cls: 'Bank' } }), ['gadget:cell', 'volley']);
  assert.deepEqual(mechanicOf('c2', { type: 'switch', after: 'c1' }), ['sequence']);
  // a held bell (it rings a while, then falls quiet): the door it holds is a timing, and a state that changes back
  const H = { e1: { type: 'bell', needs: ['bell'], hold: 8 }, e2: { type: 'bell', needs: ['bell'] } };
  assert.deepEqual(mechanicOf('e1', H.e1, { elements: H }), ['gadget:bell', 'timed']);
  assert.equal(reversible({ lit: 'e1' }, H), true, 'held: the door shuts when the note fades');
  assert.equal(reversible({ lit: 'e2' }, H), false, 'latched: rung once, open for good');
  assert.ok(obviousness({ keys: [{ rooms: 0, visible: true, metres: 5 }], mechanics: ['gadget:bell', 'timed'] }).why.some((w) => /while it rings/.test(w)));
  assert.deepEqual(piecePos({ a: [0, 0, 0], b: [0, 0, 10] }), [0, 0, 5]);
  assert.deepEqual(piecePos({ eyes: [{ at: [0, 2, 0] }, { at: [2, 2, 0] }] }), [1, 2, 0]);
});

test('a vane is a splash (or the jets’ wash) and a timing, and a ball whose groove crosses a bridge has that bridge’s key in its plate’s lock', () => {
  const E = {
    v1: { type: 'vane', room: 'a' }, vG: { type: 'vane', room: 'a', needs: ['jetpack'] },
    slot: { type: 'bridge', opens: { lit: 'v1' } },
    ball: { type: 'drum', room: 'a', plate: 'p1', gap: 'slot' }, p1: { type: 'plate', room: 'a' },
    d1: { type: 'door', opens: { pressed: 'p1' }, latch: true },
    discs: { type: 'bridge', opens: { lit: 'vG' } },
  };
  assert.deepEqual(mechanicOf('v1', E.v1, { elements: E }), ['shot', 'timed'], 'a small vane: a splash spins it a while');
  assert.deepEqual(mechanicOf('vG', E.vG, { elements: E }), ['gadget:jetpack', 'timed'], 'a great vane: only the jets turn it');
  assert.equal(reversible({ lit: 'v1' }, E), true, 'lit only while it turns');
  const logic = { id: 'v', entry: 'a', rooms: { a: {}, b: {}, c: {} }, links: [{ a: 'a', b: 'b', door: 'd1' }, { a: 'b', b: 'c', door: 'discs' }], elements: E };
  const g = puzzleGraph(logic, []);
  const d1 = g.locks.find((l) => l.id === 'd1');
  assert.deepEqual(d1.keys.map((k) => k.id).sort(), ['ball', 'v1'], 'the vane that stands the slot is a key of the plate’s door');
  assert.ok(d1.mechanics.includes('push') && d1.mechanics.includes('shot') && d1.mechanics.includes('timed'));
  assert.equal(g.locks.find((l) => l.id === 'discs').reversible, true, 'what a vane drives stops with it');
});

test('the linear temple: no loops, no hubs, every key beside its lock and in sight: painfully obvious', () => {
  const g = puzzleGraph(LINEAR, LIN_PIECES);
  assert.deepEqual(g.locks.map((l) => l.id), ['d1', 'd2', 'd3', 'd5']);
  assert.equal(g.locks.find((l) => l.id === 'd3').arena, true, 'the arena door is not a puzzle');
  const m = templeMetrics(g);
  assert.equal(m.structure.linear, true);
  assert.equal(m.steps.length, 2);
  assert.ok(m.steps.every((s) => s.obvious === 5), JSON.stringify(m.steps.map((s) => [s.lock, s.obvious, s.why])));
  assert.equal(skeleton(g), 'BCGK');
  const s = scoreTemple(m);
  assert.equal(s.criteria.structure.score, 1);
  assert.equal(s.criteria.nonObvious.score, 1);
  assert.equal(s.criteria.combination.score, 1);
});

test('a key out of sight, a room away, combined with an older verb, reads as less obvious', () => {
  const T = structuredClone(LINEAR);
  T.rooms.side = {};
  T.links.push({ a: 'b', b: 'side' });
  T.elements.b1.room = 'side';
  T.elements.ball = { type: 'drum', room: 'side', plate: 'p9' };
  T.elements.p9 = { type: 'plate', room: 'side' };
  T.elements.d2.opens = { all: [{ lit: 'b1' }, { pressed: 'p9' }] };
  const pieces = [...LIN_PIECES.filter((p) => p.o.id !== 'b1'), { cls: 'Mark', o: { room: 'side', at: [30, 0, 20] } }, { cls: 'Brazier', o: { id: 'b1', at: [34, 0, 22] } }, { cls: 'Plate', o: { id: 'p9', at: [30, 0, 25] } }];
  const wall = (a, b) => !(Math.max(a[0], b[0]) > 15);   // a wall at x = 15 hides the side room from the door
  const g = puzzleGraph(T, pieces, { los: wall });
  const d2 = g.locks.find((l) => l.id === 'd2');
  assert.deepEqual(d2.mechanics.sort(), ['gadget:fire', 'push']);
  assert.ok(d2.keys.every((k) => k.rooms === 1 && k.visible === false));
  const o = obviousness(d2);
  assert.ok(o.score <= 2.5, `${o.score}: ${o.why.join('; ')}`);
  const m = templeMetrics(g);
  assert.equal(m.structure.cycles, 0);
  assert.equal(m.structure.branches, 1, 'room b is a hub now: three ways out');
  assert.equal(m.combos, 1);
  assert.equal(m.gadget.withOld, 1, 'the ember and the push in one step');
  assert.equal(skeleton(g), 'BCXK');
});

test('the line of sight is drawn for a lock: it is told which link it faces (doors come through can stand open)', () => {
  const T = structuredClone(LINEAR);
  const asked = new Set();
  const los = (a, b, link) => { asked.add(link?.door ?? null); return link?.door !== 'd2'; };
  const g = puzzleGraph(T, LIN_PIECES, { los });
  assert.ok(asked.has('d2') && !asked.has(null), `every sight line knows its lock (${[...asked].join(', ')})`);
  assert.ok(g.locks.find((l) => l.id === 'd2').keys.every((k) => k.visible === false), 'and may answer for that lock alone');
  assert.ok(g.locks.filter((l) => l.id !== 'd2').every((l) => l.keys.every((k) => k.visible !== false)));
});

test('a loop back to the start counts, and a guardian that asks for the gadget and the push examines the temple', () => {
  const T = structuredClone(LINEAR);
  T.links.push({ a: 'c', b: 'a', door: 'sc' });
  T.elements.sc = { type: 'door', opens: { lit: 'b1' }, latch: true };
  const g = puzzleGraph(T, LIN_PIECES);
  const m = templeMetrics(g, { guardian: { kind: 'organic', phases: [{ hint: 'Light the brazier, then push the stone' }, { hint: 'Splash its mouth' }, { weary: true }], attacks: { a: { shape: 'ring' } } } });
  assert.equal(m.structure.cycles, 1);
  assert.equal(m.guardian.usesGadget, true);
  assert.ok(m.guardian.fightMechs.includes('push'));
  assert.ok(scoreTemple(m).criteria.structure.score >= 2);
});

test('the shapes: identical skeletons are alike, a rising complexity has a positive trend', () => {
  assert.equal(similarity('BCGGGK', 'BCGGGK'), 1);
  assert.ok(similarity('BCGGGK', 'XBCXRTK') < 0.6);
  assert.ok(rankTrend([1, 1, 2, 3, 4]) > 0.8);
  assert.ok(rankTrend([4, 3, 2, 1]) < 0);
});

test('a clue read a room back is a key of its lock; a plate only the lens shows is the push and the reveal; the lens stones are a traversal', () => {
  // the Footprint's: the stones' bridge names the mural (a `clue`) in the chest's room; the far door's plate is hidden
  const L = {
    id: 'clue', entry: 'a', gadget: 'lens',
    rooms: { a: {}, b: {}, c: {}, d: { boss: true } },
    links: [{ a: 'a', b: 'b', door: 'br1' }, { a: 'b', b: 'c', door: 'd4' }, { a: 'c', b: 'd', door: 'd5' }],
    elements: {
      chest: { type: 'gadget', room: 'a', item: 'lens' },
      mural: { type: 'clue', room: 'a' },
      br1: { type: 'bridge', opens: { item: 'lens' }, clue: 'mural' },
      p4: { type: 'plate', room: 'b' }, pf: { type: 'plate', room: 'b' },
      ball: { type: 'drum', room: 'b', stops: { p4: 0.6, pf: 0.3 } },
      d4: { type: 'door', opens: { drumOn: ['ball', 'p4'] }, latch: true },
      boss: { type: 'boss', room: 'd', needs: ['lens'] },
      d5: { type: 'door', opens: { resolved: true } },
    },
  };
  const pieces = [{ cls: 'Mural', o: { id: 'mural', at: [8, 3, 0] } }, { cls: 'LensStones', o: { id: 'br1', a: [0, 0, 10], b: [0, 0, 30] } },
    { cls: 'Plate', o: { id: 'p4', at: [2, 0, 36], hidden: true } }, { cls: 'Plate', o: { id: 'pf', at: [-2, 0, 36] } }, { cls: 'Ball', o: { id: 'ball', a: [-5, 0, 36], b: [5, 0, 36] } }];
  const g = puzzleGraph(L, pieces);
  const br1 = g.locks.find((l) => l.id === 'br1'), d4 = g.locks.find((l) => l.id === 'd4');
  assert.ok(br1.keys.some((k) => k.id === 'mural' && k.how === 'clue'), 'the mural is a key of the stones');
  assert.deepEqual(d4.keys.find((k) => k.id === 'ball').mech, ['push', 'gadget:lens', 'reveal'], 'the hidden plate: the push and the lens');
  assert.equal(skeleton(g)[1], 'R');
  assert.ok(g.traversal.a.includes('stones') || g.traversal.b.includes('stones'), 'the lens stones are a way across');
});

test('the plan draws every room and every lock', () => {
  const g = puzzleGraph(LINEAR, LIN_PIECES), m = templeMetrics(g);
  const svg = planSvg(g, m, { title: 'linear' });
  assert.match(svg, /^<svg/);
  for (const r of ['a', 'b', 'c', 'd']) assert.match(svg, new RegExp(`>${r}<`));
  assert.match(svg, /d1 5/);
});

test('every real temple builds a graph its measures can read (no layout needed)', async () => {
  await import('./register-gadgets.js');
  const { TEMPLES } = await import('../src/temples/index.js');
  for (const [id, { def }] of Object.entries(TEMPLES)) {
    const g = puzzleGraph(def.logic, []);
    const m = templeMetrics(g);
    assert.ok(m.steps.length >= 2, `${id}: ${m.steps.length} steps`);
    assert.ok(g.chestRoom, `${id}: a chest room`);
    assert.ok(skeleton(g).includes('C') && skeleton(g).endsWith('K'), `${id}: ${skeleton(g)}`);
  }
});

// The audit plays each temple with what the traveller carries in by then (the backpack, the gun, the double jump, and
// every gadget of the temples before it on the route): with the backpack alone no ball rolled and no eye was shot, no
// temple solved and every door counted shut for its sight lines (the three v1.40 temples' tongs, horn and tether among them).
test('the audit carries in the gadgets the route has given by then, and every temple it plays is solved', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const out = mkdtempSync(join(tmpdir(), 'temple-audit-'));
  try {
    const r = spawnSync(process.execPath, ['scripts/temple-design/audit.mjs', out, '--temples', 'moonfoundry,spacecity,bazaar'], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, r.stderr.slice(-400));
    const rep = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    for (const t of rep.temples) {
      assert.ok(t.solved, `${t.id}: not solved with ${t.carried.join(', ')}`);
      assert.ok(t.carried.includes('gun'), `${t.id}: the gun carried in`);
    }
    const by = Object.fromEntries(rep.temples.map((t) => [t.id, t.carried]));
    assert.ok(by.bazaar.includes('tether') && by.bazaar.includes('tongs'), 'the Signal Market: after the Moorings and the Casting-House');
    assert.ok(!by.moonfoundry.includes('tongs') && !by.spacecity.includes('tether'), 'never a temple’s own gadget before its chest');
  } finally { rmSync(out, { recursive: true, force: true }); }
});
