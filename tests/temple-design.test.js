// The temple design audit's pure logic (scripts/temple-design/lib.mjs, .claude/skills/temple-design-qc):
// each function shown the case it is for, on small made-up temples, and once on a real temple's logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conditionKeys, reversible, mechanicOf, puzzleGraph, obviousness, templeMetrics, scoreTemple, skeleton, similarity, rankTrend, piecePos, planSvg, assignKeys } from '../scripts/temple-design/lib.mjs';

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
  assert.deepEqual(piecePos({ at: [[0, 0], [2, 4]], y: 9 }), [1, 9, 2], 'several places as [x, z] at one height (the Lamp-House’s lure pools: its plan was NaN)');
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

test('the line of sight is told the key it looks at (its own piece never hides it), and a keepers’ door opened from its far side with the gadget comes after the chest (v1.74)', () => {
  const T = structuredClone(LINEAR);
  const told = [];
  const los = (a, b, link, key) => { told.push(key); return true; };
  puzzleGraph(T, LIN_PIECES, { los });
  assert.ok(told.includes('b1') && told.includes('p1'), `the key, or the plate a ball is meant for (${told.join(', ')})`);
  // a keepers' door back to the first room, written from the side it is opened from (its far side), wanting the gadget
  T.links.push({ a: 'c', b: 'a', door: 'sc' });
  T.elements.b2 = { type: 'brazier', room: 'c', needs: ['fire'] };
  T.elements.sc = { type: 'door', opens: { lit: 'b2' }, latch: true };
  const g = puzzleGraph(T, [...LIN_PIECES, { cls: 'Brazier', o: { id: 'b2', at: [2, 0, 38] } }]);
  const sk = skeleton(g);
  assert.ok(sk.indexOf('C') < sk.indexOf('G'), `the gadget's steps after the chest (${sk})`);
  assert.equal((sk.match(/G/g) ?? []).length, 2, sk);
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

test('a hub with keys (issue #23): each key goes to a lock in the order they are met, its cage is the step, a lock a key alone opens and an arena’s way out are no puzzles, and keys fetched across rooms count as structure', () => {
  const H = {
    id: 'hub', entry: 'hub', gadget: 'fire',
    rooms: { hub: {}, west: {}, east: {}, chest: {}, big: {}, arena: { boss: true }, out: {} },
    links: [{ a: 'hub', b: 'west', door: 'dw' }, { a: 'west', b: 'hub', door: 'dwo' }, { a: 'hub', b: 'east' }, { a: 'hub', b: 'chest', door: 'd2' }, { a: 'chest', b: 'big' }, { a: 'chest', b: 'arena', door: 'dB' }, { a: 'arena', b: 'out', door: 'd5' }],
    elements: {
      ar: { type: 'arena', room: 'west' }, kw: { type: 'key', room: 'west', when: { lit: 'ar' } }, dw: { type: 'door', opens: null }, dwo: { type: 'door', opens: { lit: 'ar' }, latch: true },
      pe: { type: 'plate', room: 'east' }, be: { type: 'drum', room: 'east', plate: 'pe' }, se: { type: 'switch', room: 'east', when: { drumOn: ['be', 'pe'] } },
      ke: { type: 'key', room: 'east', when: { lit: 'se' } },
      d2: { type: 'door', lock: 'small', keys: 2, latch: true },
      chest: { type: 'gadget', room: 'chest', item: 'fire' },
      b1: { type: 'brazier', room: 'big', needs: ['fire'] }, kb: { type: 'key', kind: 'big', room: 'big', when: { lit: 'b1' } },
      dB: { type: 'door', lock: 'big' },
      boss: { type: 'boss', room: 'arena', needs: ['fire'] }, d5: { type: 'door', opens: { resolved: true } },
    },
  };
  assert.deepEqual(assignKeys(H), { d2: ['kw', 'ke'], dB: ['kb'] }, 'two small keys in the door of two keyholes, the great one in the great lock');
  assert.deepEqual(mechanicOf('ar', H.elements.ar), ['fight']);
  assert.deepEqual(mechanicOf('ke', H.elements.ke, { elements: H.elements }), ['key', 'shot', 'push']);
  const g = puzzleGraph(H, []);
  const d2 = g.locks.find((l) => l.id === 'd2');
  assert.deepEqual(d2.keys.map((k) => [k.id, k.how]), [['kw', 'key'], ['ke', 'key']], 'carried: only the keys, not what earned them');
  assert.equal(d2.fetched, 2);
  const cage = g.locks.find((l) => l.id === 'cage:ke');
  assert.ok(cage && cage.type === 'cage' && cage.keys.some((k) => k.id === 'se') && cage.mechanics.includes('push'), 'the key’s cage is a lock: the ball and the eye');
  assert.equal(g.locks.find((l) => l.id === 'dB').arena, false, 'a locked door is not the guardian’s arena door');
  const m = templeMetrics(g);
  const steps = m.steps.map((s) => s.lock);
  assert.ok(steps.includes('cage:ke') && steps.includes('cage:kb'), steps.join(', '));
  assert.ok(!steps.includes('d2') && !steps.includes('dB') && !steps.includes('dwo') && !steps.includes('cage:kw'), `no lock a key alone opens, no arena’s way out (${steps.join(', ')})`);
  assert.equal(m.structure.fetched, 3);
  assert.equal(m.structure.arenas, 1);
  assert.ok(m.structure.branches >= 1 && m.structure.degree.hub === 4, 'the hub, four ways out');
  assert.ok(m.structure.cycles >= 1, 'the arena’s way out back to the hub');
  assert.ok(obviousness({ keys: [{ how: 'key', rooms: 2, visible: false, metres: 40 }], mechanics: ['key'] }).score >= 4, 'a key from far away is no obscurity: the lock says what it wants');
  assert.match(skeleton(g), /A/); assert.match(skeleton(g), /L/);
  assert.equal(scoreTemple(m).criteria.structure.score, 5);
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
  const { solve } = await import('../src/temples/logic.js');
  for (const [id, { def }] of Object.entries(TEMPLES)) {
    // (its rooms in the order a player reaches them, as the audit reads it: the Footprint's guardian is a fall away from
    // the rim, in its well, but reached last, issue #401; the Greenhouse's, the Lamp-House's, the Warden's Well's, the Whale-House's and the Clock-House's late steps want the hook, an older tool, #411, #410, #413, #412, #414;
    // the Engine-House's clutch, #415; the Mooring-House's the lens, #417; the Undertower's exam the wings, the hook, the lens and the bombs, #418)
    const g = puzzleGraph(def.logic, [], { order: solve(def.logic, { items: ['backpack', 'doublejump', ...(id === 'desert' ? [] : ['gun', 'glider']), ...(['edena', 'perdide2', 'incal', 'underwater', 'moonfoundry', 'garage', 'buried'].includes(id) ? ['hook'] : []), ...(id === 'spacecity' ? ['monocle'] : []), ...(id === 'bazaar' ? ['hook', 'monocle', 'bomb'] : [])] }).order });
    const m = templeMetrics(g);
    assert.ok(m.steps.length >= 2, `${id}: ${m.steps.length} steps`);
    assert.ok(g.chestRoom, `${id}: a chest room`);
    assert.ok(skeleton(g).includes('C') && skeleton(g).endsWith('K'), `${id}: ${skeleton(g)}`);
  }
});

// The audit plays each temple with what the traveller carries in by then (the backpack, the gun, the double jump, and
// every gadget of the temples before it on the route): with the backpack alone no ball rolled and no eye was shot, no
// temple solved and every door counted shut for its sight lines (the three v1.40 temples' magnet glove, spring boots and tether among them, since issue #377).
test('the audit carries in the gadgets the route has given by then, and every temple it plays is solved', async () => {
  const { spawnSync } = await import('node:child_process');
  const { readFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tempDir } = await import('../scripts/temp-dirs.mjs');
  const out = tempDir('temple-audit-');
  try {
    const r = spawnSync(process.execPath, ['scripts/temple-design/audit.mjs', out, '--temples', 'moonfoundry,spacecity,bazaar'], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, r.stderr.slice(-400));
    const rep = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    for (const t of rep.temples) {
      assert.ok(t.solved, `${t.id}: not solved with ${t.carried.join(', ')}`);
      assert.ok(t.carried.includes('gun'), `${t.id}: the gun carried in`);
    }
    const by = Object.fromEntries(rep.temples.map((t) => [t.id, t.carried]));
    // (issue #377: the Casting-House's chest holds the magnet glove, the tongs before)
    assert.ok(by.bazaar.includes('tether') && by.bazaar.includes('magnet'), 'the Signal Market: after the Moorings and the Casting-House');
    assert.ok(!by.moonfoundry.includes('magnet') && !by.spacecity.includes('tether'), 'never a temple’s own gadget before its chest');
  } finally { rmSync(out, { recursive: true, force: true }); }
});

// (issue #477) The houses had converged on one order ("a few base steps, the chest, combinations, the great key, the
// guardian"): four shapes since (the gadget first, the great key mid-way, two wings, the guardian met early). No two houses
// may read more than 70 % alike again, measured as the audit measures them (each house built, its skeleton's edit distance).
test('no two houses read more than 70 % alike in the order of their steps (issue #477)', async () => {
  const { spawnSync } = await import('node:child_process');
  const { readFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tempDir } = await import('../scripts/temp-dirs.mjs');
  const out = tempDir('temple-alike-');
  try {
    const r = spawnSync(process.execPath, ['scripts/temple-design/audit.mjs', out], { encoding: 'utf8', timeout: 240000 });
    assert.equal(r.status, 0, r.stderr.slice(-400));
    const rep = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    const ids = rep.temples.map((t) => t.id);
    assert.ok(ids.length >= 14, `every house measured (${ids.length})`);
    for (const [i, a] of ids.entries()) for (const b of ids.slice(i + 1)) {
      const sim = rep.alike[a][b], skel = (id) => rep.temples.find((t) => t.id === id).skeleton;
      assert.ok(sim <= 0.7, `${a} ${skel(a)} and ${b} ${skel(b)}: ${Math.round(sim * 100)} % alike`);
    }
  } finally { rmSync(out, { recursive: true, force: true }); }
});
