import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { CATALOG, CONCEPTS, REVIEW_ROWS, filterRows, decisionFor, readReview, exportReview } from '../tools/enemy-review-data.js';
import { STYLE_PASSES } from '../tools/enemy-review-references.js';

test('all 45 current selections have intact full-resolution local originals', () => {
  const archive = new URL('../references/enemy-redesign-2026-10-30/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('originals.json', archive), 'utf8'));
  const selections = CONCEPTS.flatMap(c => c.selections.map(s => ({ c, s })));
  assert.equal(selections.length, 45);
  assert.equal(manifest.count, selections.length);
  assert.equal(manifest.images.length, selections.length);
  assert.equal(new Set(manifest.images.map(e => e.file)).size, selections.length);
  for (const { c, s } of selections) {
    const file = `${c.key}/${s.job}-${s.index}.png`;
    const entry = manifest.images.find(e => e.file === file);
    assert.ok(entry, file);
    assert.equal(entry.source, s.url);
    assert.equal(entry.job, s.job);
    assert.equal(entry.index, s.index);
    assert.equal(entry.concept, c.key);
    assert.equal(s.image, `../references/enemy-redesign-2026-10-30/${file}`);
    const bytes = readFileSync(new URL(file, archive));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1232, 928], file);
    assert.deepEqual([entry.width, entry.height], [1232, 928]);
    assert.equal(bytes.length, entry.bytes, file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, file);
  }
});

test('review covers every built archetype once in the main collection and every appearance has a unique id', () => {
  assert.deepEqual(filterRows({}, {}).map((r) => r.type).sort(), Object.keys(ARCHETYPES).filter((id) => ARCHETYPES[id].status === 'built').sort());
  assert.equal(new Set(CATALOG.map((r) => r.id)).size, CATALOG.length);
});
test('bird dismissal is explicit, persists through export, and can be overridden', () => {
  const bird = CATALOG.find((r) => r.type === 'heron');
  assert.equal(decisionFor({}, bird).status, 'dismiss');
  assert.equal(readReview(exportReview({}))[bird.id].status, 'dismiss');
  assert.equal(decisionFor({ [bird.id]: { status: 'undecided', note: '' } }, bird).status, 'undecided');
});
test('decisions remain independent between skins; export and import preserve notes literally', () => {
  const [a,b] = CATALOG.filter((r) => r.type === 'crab');
  const records = { [a.id]: { status: 'keep', note: '<script>not HTML</script>\nKeep the claws.' } };
  assert.equal(decisionFor(records, b).status, 'undecided');
  assert.deepEqual(readReview(exportReview(records))[a.id], records[a.id]);
  assert.deepEqual(filterRows({ world: 'all', status: 'keep' }, records).map((r) => r.id), [a.id]);
});
test('bad imports fail without accepting unknown keys or invalid statuses', () => {
  for (const decisions of [[], { unknown: { status:'keep',note:'' } }, { [CATALOG[0].id]: { status:'delete',note:'' } }, { [CATALOG[0].id]: { status:'keep',note:42 } }]) assert.throws(() => readReview({ version:1, decisions }));
  assert.throws(() => readReview({version:2,decisions:{}}));
});

test('old reviews retain model decisions while new concept feedback is independent', () => {
  const model = CATALOG.find((r) => r.type === 'hulk' && r.home);
  const concept = CONCEPTS.find((r) => r.key === 'hulk');
  const old = { version: 1, decisions: { [model.id]: { status: 'rework', note: 'Keep my existing note.\nBigger hands.' } } };
  const records = readReview(old);
  assert.equal(decisionFor(records, concept).status, 'keep');
  records[concept.id] = { status: 'rework', note: 'Change the palm colour only.' };
  const restored = readReview(exportReview(records));
  assert.deepEqual(restored[model.id], old.decisions[model.id]);
  assert.deepEqual(restored[concept.id], records[concept.id]);
});

test('new concepts do not replace kept archetypes and pending concepts have no selected images', () => {
  const news = filterRows({ view: 'new' }, {});
  assert.ok(news.length >= 8);
  assert.ok(news.every((r) => !r.type && r.newEnemy));
  assert.ok(news.some((r) => r.key === 'boar' && /Reserved/.test(r.note)));
  for (const c of CONCEPTS) {
    if (c.type) assert.ok(CATALOG.some((r) => r.type === c.type && r.home));
    if (c.stage === 'exploring') { assert.equal(c.selections.length, 0); assert.equal(decisionFor({}, c).status, 'undecided'); }
    for (const s of c.selections) { assert.match(s.job, /^[a-f0-9-]{36}$/); assert.ok(Number.isInteger(s.index) && s.index >= 0 && s.index < 4); assert.equal(new URL(s.url).searchParams.get('index'), String(s.index)); }
  }
  assert.equal(new Set(REVIEW_ROWS.map((r) => r.id)).size, REVIEW_ROWS.length);
  assert.ok(exportReview({}).references.every((r) => r.implemented === false));
});

test('reference filtering ignores world filters but respects family, notes and feedback', () => {
  const boar = CONCEPTS.find((r) => r.key === 'boar');
  assert.deepEqual(filterRows({ view: 'new', world: 'desert', search: 'explicitly not the grunt' }, {}), [boar]);
  const records = { [boar.id]: { status: 'dismiss', note: 'Later' } };
  assert.deepEqual(filterRows({ view: 'references', status: 'dismiss' }, records), [boar]);
  assert.ok(filterRows({ view: 'new', family: 'Robots' }, {}).every((r) => r.family === 'Robots'));
});

test('style redos retain earlier selections and do not approve unselected new images', () => {
  for (const [key, job] of Object.entries(STYLE_PASSES)) {
    const row = CONCEPTS.find((r) => r.key === key);
    assert.equal(row.stage, 'revising');
    assert.ok(row.selections.length > 0);
    assert.ok(row.selections.every((s) => s.job !== job));
    assert.equal(new URL(row.jobUrl).pathname, `/jobs/${job}`);
  }
  for (const [key, index] of [['shovel-mole',1], ['cistern-ram',1], ['pebble-hare',2], ['seed-splitter',1]]) {
    const row = CONCEPTS.find((r) => r.key === key);
    assert.equal(row.stage, 'selected');
    assert.equal(row.selections[0].index, index);
  }
});


test('approved style choices supersede old art without losing its provenance', () => {
  for (const [key, index] of [['shellback',2], ['bellows-toad',0], ['centipede',3], ['cloud-jelly',1], ['lamp-moth',1], ['storm-ray',0], ['hound',1], ['reed-knot',1], ['dune-worm',3], ['fencer',1], ['boar',3], ['blob',2]]) {
    const row = CONCEPTS.find((r) => r.key === key);
    assert.equal(row.stage, key === 'boar' ? 'reserved' : 'selected');
    assert.equal(row.selections[0].index, index);
    assert.ok(row.previousSelections.length);
    assert.notEqual(row.selections[0].job, row.previousSelections[0].job);
    assert.deepEqual(exportReview({}).references.find((r) => r.id === row.id).previousSelections, row.previousSelections);
  }
});


test('kept-model reference approval preserves the original model decisions', () => {
  const comparisons = filterRows({ view: 'kept' }, {});
  assert.equal(comparisons.length, 13);
  assert.equal(new Set(comparisons.map((r) => r.type)).size, 13);
  for (const row of comparisons) {
    const model = CATALOG.find((r) => r.type === row.type && r.home);
    const records = { [model.id]: { status: 'keep', note: 'Keep this until an alternative is approved.' } };
    assert.equal(row.newEnemy, false);
    assert.equal(row.selections.length, 1);
    assert.equal(row.stage, 'selected');
    assert.ok(row.jobUrl.startsWith('https://www.midjourney.com/jobs/'));
    assert.equal(decisionFor(records, row).status, 'keep');
    records[row.id] = { status: 'dismiss', note: 'Prefer the original.' };
    assert.deepEqual(readReview(exportReview(records))[model.id], records[model.id]);
    assert.equal(exportReview(records).references.find((r) => r.id === row.id).comparisonOnly, true);
  }
});


test('bell approval uses the clean-background revision, not the rejected batch', () => {
  const bell = CONCEPTS.find((r) => r.key === 'keep-bell');
  assert.equal(bell.selections[0].job, 'b4852320-c23b-4bf7-a8e2-10c9ede8cabd');
  assert.equal(bell.selections[0].index, 1);
});


test('committed handoff feedback imports without losing user notes or kept-model decisions', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../docs/handoffs/enemy-rebuild-2026-10-30.feedback.json', import.meta.url), 'utf8'));
  const imported = readReview(snapshot);
  assert.equal(Object.keys(imported).length, 178);
  assert.equal(imported['skitter@desert'].status, 'keep');
  assert.equal(imported['concept:keep-skitter'].status, 'keep');
  assert.ok(Object.values(imported).some((r) => r.note.includes('Midjourney')));
  // (a row the snapshot has not met yet, a foe added since, comes back undecided: the wood cutter, #800)
  const back = readReview(exportReview(imported));
  for (const [id, r] of Object.entries(imported)) assert.deepEqual(back[id], r, id);
  for (const id of Object.keys(back)) if (!imported[id]) assert.equal(back[id].status, id.startsWith('concept:') ? back[id].status : 'undecided', id);
});
