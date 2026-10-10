// The between-world errands follow the route (src/levels/content.js ERRANDS, src/levels/names.js ORDER):
// each parcel goes on to a world still ahead, never back to one already done, and its lines name who it is for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripTone, TONES } from '../src/story/tone.js';

const stub = () => ({ getContext: () => null, style: {}, classList: { add() {}, remove() {} } });
globalThis.document ??= { createElement: stub, body: {}, getElementById: stub, querySelector: () => null };
const { CONTENT, ERRANDS, ERRAND_PLACES, ORDER } = await import('../src/levels/content.js');
const { ROUTE_PARTS, partOf } = await import('../src/levels/names.js');
const { Errands } = await import('../src/quest.js');

// (by place: a merged world carries two, src/levels/names.js PARTS; an errand from Vael to its sky stones stays in the world)
test('every errand goes on to the next place on the route', () => {
  for (const [i, e] of ERRAND_PLACES.entries()) {
    const from = ROUTE_PARTS.indexOf(e.from[0]), to = ROUTE_PARTS.indexOf(e.to[0]);
    assert.ok(from >= 0 && to >= 0, `${e.id}: both places are on the route`);
    assert.equal(to, from + 1, `${e.id}: ${e.from[0]} → ${e.to[0]} is not the next place`);
    const E = ERRANDS[i];
    assert.equal(E.from[0], partOf(e.from[0])); assert.equal(E.to[0], partOf(e.to[0]));
    assert.ok(CONTENT[E.from[0]].npcs[E.from[1]], `${e.id}: its giver is in ${E.from[0]}`);
    assert.ok(CONTENT[E.to[0]].npcs[E.to[1]], `${e.id}: its receiver is in ${E.to[0]}`);
  }
  assert.equal(new Set(ERRAND_PLACES.map((e) => e.from[0])).size, ERRANDS.length, 'one errand per place at most');
  // every place but the last hands you something for the next (the later half too: the sky stones, the Glass Dunes, the Buried Machine, the spheres)
  for (const w of ROUTE_PARTS.slice(0, -1)) assert.ok(ERRAND_PLACES.some((e) => e.from[0] === w), `${w} has an errand for the next place`);
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
    const name = (npc.name ?? npc.id?.split('.')[0])?.split(' ').pop().toLowerCase();   // (by the name, not the id: ids outlive renames)
    if (name) assert.match(stripTone(e.ask).toLowerCase(), new RegExp(name), `${e.id}: the ask names ${name}`);
  }
});

test('a parcel picked up on the old route is shown going to its new world, and delivers there', () => {
  const data = { errands: { token: { item: 'a taxi token', to: 'arzach', toTitle: 'Vael', done: false } } };
  const journal = { data, errand: (id) => data.errands[id], setErrand: (id, v) => { data.errands[id] = v; } };
  const receiver = { lines: ['~neutral~ hi'], greeted: 0, pos: { x: 0, y: 0, z: 0, clone() { return { ...this, add: () => this }; } }, heading: 0 };
  const npcs = [receiver];
  const er = new Errands({ levelId: 'glassdunes', defs: ERRANDS, npcs, journal, titles: { glassdunes: 'The Glass Dunes', arzach: 'Vael' }, capture: () => '', sound: null });
  assert.match(er.hud(), /→ The Glass Dunes$/);
  receiver.greeted = 1;
  er.update();
  assert.equal(data.errands.token.done, true);
});
