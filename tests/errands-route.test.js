// The between-world errands follow the route (src/levels/content.js ERRANDS, src/levels/names.js ORDER):
// each parcel goes on to a world still ahead, never back to one already done, and its lines name who it is for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripTone, TONES } from '../src/story/tone.js';

const stub = () => ({ getContext: () => null, style: {}, classList: { add() {}, remove() {} } });
globalThis.document ??= { createElement: stub, body: {}, getElementById: stub, querySelector: () => null };
const { CONTENT, ERRANDS, ORDER } = await import('../src/levels/content.js');
const { Errands } = await import('../src/quest.js');

test('every errand goes on to the next world on the route', () => {
  for (const e of ERRANDS) {
    const from = ORDER.indexOf(e.from[0]), to = ORDER.indexOf(e.to[0]);
    assert.ok(from >= 0 && to >= 0, `${e.id}: both worlds are on the route`);
    assert.equal(to, from + 1, `${e.id}: ${e.from[0]} → ${e.to[0]} is not the next world`);
    assert.ok(CONTENT[e.from[0]].npcs[e.from[1]], `${e.id}: its giver is in ${e.from[0]}`);
    assert.ok(CONTENT[e.to[0]].npcs[e.to[1]], `${e.id}: its receiver is in ${e.to[0]}`);
  }
  assert.equal(new Set(ERRANDS.map((e) => e.from[0])).size, ERRANDS.length, 'one errand per world at most');
  // every world but the last hands you something for the next (the later half too: Vael II, the Hangar, the Buried Machine, the spheres)
  for (const w of ORDER.slice(0, -1)) assert.ok(ERRANDS.some((e) => e.from[0] === w), `${w} has an errand for the next world`);
  assert.equal(new Set(ERRANDS.map((e) => e.to.join(':'))).size, ERRANDS.length, 'nobody receives two parcels');
});

test('the errands’ lines name the one it is for, and each carries a tone', () => {
  for (const e of ERRANDS) {
    for (const k of ['ask', 'wait', 'thanks']) {
      const m = /^~(\w+)~ /.exec(e[k]);
      assert.ok(m, `${e.id}.${k} has a tone`);
      assert.ok(TONES.includes(m[1]), `${e.id}.${k}: ${m[1]} is a tone`);
    }
    const npc = CONTENT[e.to[0]].npcs[e.to[1]];
    const name = npc.id?.split('.')[0];
    if (name) assert.match(stripTone(e.ask).toLowerCase(), new RegExp(name), `${e.id}: the ask names ${name}`);
  }
});

test('a parcel picked up on the old route is shown going to its new world, and delivers there', () => {
  const data = { errands: { token: { item: 'a taxi token', to: 'arzach', toTitle: 'Vael', done: false } } };
  const journal = { data, errand: (id) => data.errands[id], setErrand: (id, v) => { data.errands[id] = v; } };
  const receiver = { lines: ['~neutral~ hi'], greeted: 0, pos: { x: 0, y: 0, z: 0, clone() { return { ...this, add: () => this }; } }, heading: 0 };
  const npcs = [receiver];
  const er = new Errands({ levelId: 'garage', defs: ERRANDS, npcs, journal, titles: { garage: 'The Sealed Hangar', arzach: 'Vael' }, capture: () => '', sound: null });
  assert.match(er.hud(), /→ The Sealed Hangar$/);
  receiver.greeted = 1;
  er.update();
  assert.equal(data.errands.token.done, true);
});
