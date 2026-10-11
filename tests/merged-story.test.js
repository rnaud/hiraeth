import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pendingCall, callLines, recordingLabel, onHologram, PART_CALLS, REEL, CALL_COUNT } from '../src/story/calls.js';
import { peopleOf, WORLD_DATA } from '../src/story/ending.js';
import { sketchesData } from '../src/game-menu-data.js';
import { ORDER, SUB, PARTS } from '../src/levels/names.js';
import { parseLine } from '../src/story/tone.js';

// The story's loose ends from the merge (October 2026: Vael II into Vael, Lorn II into Lorn, the Sealed Hangar dismissed):
// the second stories close their own pages and have their own recordings, the reel's words bell, lamp and why are
// played, the credits know every place on the route and the train, and nobody speaks of the Hangar's Major as if it
// were still on the route.

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const said = (lines) => lines.map((l) => l.text).join(' ');

test('the merged worlds’ second stories have their own recordings, after the world’s own: bell; lamp, then why', () => {
  const flags = {}, flag = (k) => flags[k];
  for (let n = 1; n <= 3; n++) flags[`calls.${n}`] = true;
  assert.equal(pendingCall({ flag, completed: 3 }), null, 'nothing waits before a second story is done');
  flags['world.arzach2.done'] = true;
  assert.equal(pendingCall({ flag, completed: 4 }), 4, 'the world’s own recording first');
  flags['calls.4'] = true;
  assert.equal(pendingCall({ flag, completed: 4 }), PART_CALLS.arzach2);
  flags[`calls.${PART_CALLS.arzach2}`] = true;
  flags['world.perdide2.done'] = true;
  assert.equal(pendingCall({ flag, completed: 4 }), PART_CALLS.perdide2);
  flags[`calls.${PART_CALLS.perdide2}`] = true;
  assert.equal(pendingCall({ flag, completed: 4 }), null, 'each heard once');

  const bell = callLines(PART_CALLS.arzach2, { flag });
  assert.ok(said(bell).includes(parseLine(REEL.arzach2.find).text), 'the bell’s line plays');
  assert.ok(said(bell).includes(`anything about ${REEL.arzach2.word}`));
  const lamp = callLines(PART_CALLS.perdide2, { flag });
  for (const w of ['perdide2', 'garage']) assert.ok(said(lamp).includes(parseLine(REEL[w].find).text), `${w}: its reel line plays`);
  assert.ok(said(lamp).includes('anything about lamp') && /one more thing: why/.test(said(lamp)));
  assert.ok(!/Major|Hangar/.test(said(lamp)), 'why is answered by Hollin’s lamps now, not the Hangar’s Major');
  for (const id of Object.values(PART_CALLS)) {
    assert.match(recordingLabel(id), /^LOGGED \d+ YEARS AGO$/);
    assert.equal(onHologram(id), 'father');
    for (const l of callLines(id, { flag })) assert.ok(l.tone, `${id}: “${l.text}” has a tone`);
  }
  assert.equal(CALL_COUNT, ORDER.length, 'the numbered ones stay one per world on the route');
});

test('every reel word is asked for somewhere: the route’s worlds, the second stories, and the Hangar’s why', () => {
  const asked = new Set([...ORDER, ...Object.keys(PART_CALLS), 'garage']);
  for (const id of Object.keys(REEL)) assert.ok(asked.has(id), `${id}: its word (${REEL[id].word}) is never asked`);
});

test('a second story closes its own page: the part’s page in the sketchbook, after its world’s', () => {
  // (src/story/index.js partPage → src/quest.js Story.completePart)
  assert.match(src('src/story/index.js'), /story\.completePart\?\.\(part, CONTENT\[part\]\?\.story\)/);
  assert.match(src('src/quest.js'), /completePart\(part, def\) \{/);
  const levels = [{ id: 'arzach', title: 'Vael', relicNames: ['a', 'b'], storyTitle: 'THE BIRD', parts: [{ id: 'arzach2', storyTitle: 'THE BELL UNDER THE CLOUD' }] }];
  const sk = sketchesData({ data: { stories: { arzach2: { img: 'x.jpg', t: 1 } } }, levels });
  assert.deepEqual(sk.worlds[0].more, [{ id: 'arzach2', title: 'THE BELL UNDER THE CLOUD', img: 'x.jpg', told: true }]);
  assert.equal(sk.worlds[0].story.told, false, 'the world’s own page is the first part’s');
  for (const [w, parts] of Object.entries(PARTS)) assert.ok(parts.length > 1 && src('src/main.js').includes('parts: partsOf(l.id).slice(1)'), `${w}: its parts' pages listed`);
});

test('the credits know every world on the route, its parts and its sub-levels (the Overnight Train)', () => {
  for (const id of ORDER) {
    assert.ok(peopleOf(id).length >= 2, `${id}: its people in the credits`);
    for (const part of PARTS[id] ?? [id]) assert.ok(WORLD_DATA[part], `${id}: ${part}'s data`);
  }
  for (const [sub, world] of Object.entries(SUB)) {
    assert.ok(WORLD_DATA[sub], `${sub}: its data`);
    const train = peopleOf(sub).map((p) => p.name), market = peopleOf(world).map((p) => p.name);
    assert.ok(train.length && train.every((n) => market.includes(n)), `${sub}'s people (${train.join(', ')}) listed with ${world}'s`);
  }
});

test('nobody on the route speaks of the Hangar’s Major as if the Hangar were still there', () => {
  // (the Hangar's own people keep their pages, for a save that went there: people-book.js's garage cards, Lou's old drawing)
  for (const f of ['src/story/buried-data.js', 'src/story/people-book.js', 'src/story/home-data.js']) {
    const lines = src(f).split('\n').filter((l) => !/^\s*\/\//.test(l) && !/garage: "~playful~ The Major’s machine/.test(l) && (f !== 'src/story/people-book.js' || /drum wall/.test(l)));
    assert.ok(!lines.some((l) => /\bMajor\b|the Hangar is still/.test(l)), `${f}: ${lines.find((l) => /\bMajor\b|the Hangar is still/.test(l))?.trim().slice(0, 100)}`);
  }
});

test('Fen’s skiff is the one you whistle for in Lorn: no talk of it moored at the root cave, and its colours are the skiff’s', () => {
  const d = src('src/story/perdide2-data.js');
  assert.ok(!/moored at the root cave|Teal, white stripe|came back to the cave without them/.test(d));
  assert.match(d, /Orange, navy under the waterline, a cream rim/);
  for (const c of ["orange: '#d9643a'", "navy: '#34405e'", "cream: '#f3ead8'"]) assert.ok(src('src/levels/perdide.js').includes(c), `the skiff's ${c}`);
});
