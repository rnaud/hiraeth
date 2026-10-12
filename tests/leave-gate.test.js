import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORE, missingCore, leaveRefusal } from '../src/story/leave-gate.js';
import { ORDER, partsOf } from '../src/levels/names.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ITEMS } from '../src/items.js';
import { parseLine } from '../src/story/tone.js';
import { progressBefore } from '../src/debug-save.js';

// Issue #217: "I shouldn't be able to leave the desert without getting all the core gadgets from that level. I was able
// to leave without a sword and shield right now." The ship (src/ship/ship.js travel) asks src/story/leave-gate.js.

const owning = (...ids) => (id) => ids.includes(id);
const DESERT_MAIN = ['backpack', 'doublejump', 'gun'];

test('the desert: not without the Givers’ blade and guard; the ship says where they are, in one line with a tone', () => {
  const no = leaveRefusal('desert', 'arzach', owning(...DESERT_MAIN));
  assert.ok(no, 'refused without the blade and the guard');
  assert.deepEqual(no.missing, ['sword', 'shield']);
  assert.equal(no.quest, 'temple.desert', 'the Rose House’s quest leads there');
  assert.equal(no.line.who, 'ship');
  assert.equal(no.line.tone, 'neutral');
  assert.match(no.line.text, /Rose House/);
  assert.ok(!/\n/.test(no.line.text) && no.line.text.length < 90, `one short line: ${no.line.text}`);
  // only the guard missing: it names the guard alone
  const one = leaveRefusal('desert', 'perdide', owning(...DESERT_MAIN, 'sword'));
  assert.deepEqual(one.missing, ['shield']);
  assert.match(one.line.text, /guard is still in the Rose House/);
  // everything had: it goes, anywhere on the chart
  for (const to of ['arzach', 'perdide', 'home']) assert.equal(leaveRefusal('desert', to, owning(...DESERT_MAIN, 'sword', 'shield')), null, to);
  // (never stopped from going nowhere)
  assert.equal(leaveRefusal('desert', 'desert', owning()), null);
});

test('Vael: not without the fluid wings, from either of its parts; the other worlds leave whenever', () => {
  for (const from of ['arzach', 'arzach2']) {
    const no = leaveRefusal(from, 'perdide', owning());
    assert.deepEqual(no?.missing, ['glider'], from);
    assert.match(no.line.text, /^Not yet\. The fluid wings are still in the Aerie\.$/);
  }
  assert.equal(leaveRefusal('arzach', 'perdide', owning('glider')), null);
  for (const w of ORDER.filter((id) => !CORE[id])) assert.deepEqual(missingCore(w, owning()), [], `${w}: no core gadgets`);
  assert.deepEqual(Object.keys(CORE).sort(), ['arzach', 'desert']);
});

test('every core gadget is an item found in its own world, so no save is kept where it cannot get it', () => {
  for (const [w, list] of Object.entries(CORE)) {
    const boxes = partsOf(w).flatMap((p) => PLACEMENTS[p] ?? []);
    for (const c of list) {
      assert.ok(ITEMS[c.item], `${c.item}: an item`);
      assert.ok(boxes.some((b) => b.item === c.item), `${w}: a chest of ${c.item} in the world`);
    }
  }
});

test('the debug saves of every world after them carry the core gadgets, so they leave as before', () => {
  for (const [i, w] of ORDER.entries()) {
    const flags = progressBefore(w).flags;
    for (const before of ORDER.slice(0, i)) assert.deepEqual(missingCore(before, (id) => !!flags[`item.${id}`]).map((c) => c.item), [], `${w}'s debug save, leaving ${before}`);
  }
});

test('the ship asks before it takes off, and the play-through checks it between worlds', () => {
  const ship = readFileSync(new URL('../src/ship/ship.js', import.meta.url), 'utf8');
  assert.match(ship, /travel\(to\) \{\n\s+if \(!game\.flag\('ship\.powered'\)\) return;[\s\S]{0,200}leaveRefusal\(this\.levelId, to,/);
  const agent = readFileSync(new URL('./playthrough-agent.js', import.meta.url), 'utf8');
  assert.match(agent, /leaveRefusal\(from, to,/);
  // a refusal starts the quest that leads to what is missing (main.js)
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /game\.on\('travel:refused', \(\{ quest \}\) => \{ if \(quest && !storyRt\.quests\.isStarted\(quest\)\) storyRt\.quests\.start\(quest\)/);
  assert.match(ship, /game\.emit\('travel:refused', \{ to, missing: no\.missing, quest: no\.quest \}\)/);
  // and the line parses as a tagged one (tests/tone.test.js's rule for every line)
  assert.ok(parseLine(`~neutral~ ${leaveRefusal('desert', 'arzach', owning()).line.text}`).explicit);
});
