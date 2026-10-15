// The temple redesign's rules (issue #336, the author: "The rooms should be much bigger, higher ceilings, larger doors,
// larger rooms. Think shrines in Breath of the Wild. Puzzles should never go through doors but be more centered in the
// rooms. Enemies should also be centered in rooms. Rooms should either be about puzzles or about combat but not both.
// Major gadgets like the grappling hook should be found in temples and should be put to use to solve puzzles as part of
// it."): docs/design/temple-redesign.md has the numbers, scripts/temple-design/rules.mjs checks them. A house redone to
// them (REDONE) breaks none; the others are reported, house by house, and may not break more than they do now
// (PENDING: lower a number when a house is redone in part, move it to REDONE when it is done).
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import { TEMPLES } from '../src/temples/index.js';
import { solve } from '../src/temples/logic.js';
import { templeRules, roomKinds, inMiddle, rulesText, RULES } from '../scripts/temple-design/rules.mjs';
import { recordTemple } from '../scripts/temple-design/record.mjs';

/** The houses redone to the rules: none broken. */
const REDONE = ['desert', 'incal', 'arzach2', 'edena', 'arzach', 'bazaar', 'spacecity', 'underwater', 'moonfoundry', 'perdide2', 'garage'];
/** The houses still to redo, and how many rules each breaks today (docs/design/temple-redesign.md, "The other houses"). */
const PENDING = { buried: 41, perdide: 36, spheres: 36 };

// a made-up house: a hall with a ball rolled through its door into the next, a machine by the second hall's mark, the chest
const LOGIC = {
  id: 'made', entry: 'a', gadget: 'sword',
  rooms: { a: {}, b: {}, c: { kind: 'puzzle' }, d: { boss: true } },
  links: [{ a: 'a', b: 'b', door: 'd1' }, { a: 'b', b: 'c', door: 'd2' }, { a: 'c', b: 'd', door: 'd3' }],
  elements: {
    p1: { type: 'plate', room: 'b' },
    ball: { type: 'drum', room: 'a', plate: 'p1', plateAt: 1, start: 0 },
    d1: { type: 'door', opens: { drumOn: ['ball', 'p1'] }, latch: true },
    chest: { type: 'gadget', room: 'b', item: 'sword' },
    e1: { type: 'switch', room: 'c' },
    d2: { type: 'door', opens: { item: 'sword' } },
    d3: { type: 'door', opens: { lit: 'e1' } },
    boss: { type: 'boss', room: 'd' },
  },
};
const SPACES = [
  { shape: 'box', x0: -10, x1: 10, z0: 0, z1: 20, y: 0, top: 10 },
  { shape: 'box', x0: -20, x1: 20, z0: 20, z1: 60, y: 0, top: 20 },
  { shape: 'box', x0: -20, x1: 20, z0: 60, z1: 100, y: 0, top: 20 },
  { shape: 'round', x: 0, z: 125, r: 20, y: 0, top: 24 },
];
const PIECES = [
  { cls: 'Mark', o: { room: 'a', at: [0, 0, 3] } },
  { cls: 'Ball', o: { id: 'ball', a: [0, 0, 8], b: [0, 0, 30] } },
  { cls: 'Plate', o: { id: 'p1', at: [0, 0, 30] } },
  { cls: 'Door', o: { id: 'd1', at: [0, 0, 20], w: 5, h: 6 } },
  { cls: 'Mark', o: { room: 'b', at: [-18, 0, 22] } },
  { cls: 'Door', o: { id: 'd2', at: [0, 0, 60], w: 7, h: 9 } },
  { cls: 'Mark', o: { room: 'c', at: [0, 0, 80] } },
  { cls: 'Switch', o: { id: 'e1', at: [19.5, 6, 70] } },
  { cls: 'Door', o: { id: 'd3', at: [0, 0, 100], w: 7, h: 9 } },
];

test('the rules on a made-up house: a ball through a door, a puzzle by the wall, a fight in a puzzle room, a small room and a small door', () => {
  const r = templeRules({ logic: LOGIC, pieces: PIECES, spaces: SPACES, order: ['a', 'b', 'c', 'd'], guardian: { center: [0, 0, 125] } });
  const of = (rule) => r.violations.filter((v) => v.rule === rule);
  assert.ok(of('door_thread').some((v) => /plate p1 is in the b/.test(v.what)) && of('door_thread').some((v) => /groove runs through the door d1/.test(v.what)), 'the ball is rolled from one room into the next, through its door');
  assert.ok(of('door').some((v) => /^d1/.test(v.what)) && !of('door').some((v) => /^d2|^d3/.test(v.what)), 'a 5 x 6 m door is too small; 7 x 9 is not');
  assert.ok(of('size').some((v) => v.room === 'a') && of('ceiling').some((v) => v.room === 'a'), 'a 20 m hall 10 m high is too small for a puzzle');
  assert.ok(of('both').some((v) => v.room === 'b' && /machine by its mark/.test(v.what)), 'a plate and a machine by its mark: both');
  assert.ok(of('foes').some((v) => v.room === 'b'), 'and the machine by the wall');
  assert.ok(of('centred').some((v) => v.room === 'c' && /^e1/.test(v.what)), 'an eye on the wall is not in the middle');
  assert.ok(of('gadget').some((v) => v.room === 'c'), 'the room after the chest never asks for the blade');
  assert.equal(roomKinds(LOGIC, PIECES).kinds.d, 'guardian');
  // tagged, moved, and the machine sent to a fight of its own: the house keeps to the rules
  assert.ok(inMiddle(SPACES[1], [0, 0, 40]) && !inMiddle(SPACES[1], [0, 0, 25]) && inMiddle(SPACES[3], [0, 0, 135]) && !inMiddle(SPACES[3], [0, 0, 140]));
  assert.equal(RULES.inset, 0.2);
});

/** Every house built in node as the game builds it, with its rules. */
const all = Object.keys(TEMPLES).map((id) => {
  const def = TEMPLES[id].def;
  const { rt, pieces, spaces } = recordTemple(def);
  const centre = rt.guardian?.arena?.center ? rt.kit.local(rt.guardian.arena.center).toArray() : null;
  const s = solve(def.logic, { items: ['backpack', 'doublejump', ...(id === 'desert' ? [] : ['gun', 'glider'])] });
  const r = templeRules({ logic: def.logic, pieces, spaces, order: s.order, guardian: centre ? { center: centre } : null, encounter: def.encounter ?? null });
  rt.dispose?.();
  return { id, r };
});

test('every house is reported against the rules, most broken first; the redone keep them all, the rest break no more than they did', (t) => {
  for (const { id, r } of [...all].sort((a, b) => b.r.count - a.r.count)) t.diagnostic(rulesText(id, r));
  const worse = [], unknown = [];
  for (const { id, r } of all) {
    if (REDONE.includes(id)) assert.deepEqual(r.violations.map((v) => `${v.rule} ${v.room}: ${v.what}`), [], `${id} is redone: every rule kept`);
    else if (PENDING[id] == null) unknown.push(id);
    else if (r.count > PENDING[id]) worse.push(`${id}: ${r.count} (was ${PENDING[id]})`);
  }
  assert.deepEqual(unknown, [], 'every house is redone or pending');
  assert.deepEqual(worse, [], 'a pending house breaks no more rules than it did');
});

test('a redone house tags every room with its kind, and each tag is true', () => {
  for (const id of REDONE) {
    const def = TEMPLES[id].def;
    const { rooms } = all.find((x) => x.id === id).r;
    for (const room of rooms) assert.ok(def.logic.rooms[room.id].kind, `${id} ${room.id}: tagged`);
    assert.ok(rooms.some((x) => x.kind === 'combat'), `${id}: a fight of its own`);
    assert.ok(!rooms.some((x) => x.kind === 'both'));
  }
});
