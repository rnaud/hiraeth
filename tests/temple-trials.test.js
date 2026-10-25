// The makers' trials (issue #660, src/temples/trials.js, docs/design/temple-puzzles.md): the makers' clock (a timed
// door, a timed bridge of light) and the glyph floor, and the three houses' side rooms built from them, the clock taught in
// the Hush-House, tested in the Warden's Well, twisted in the Engine-House. Fair: the clock counts down in the room (its
// lamps and bars, its ticks), restarts when woken again, and stops cleanly; nothing is saved of a run, a door never shuts
// on you, a bridge never sinks under you, the reward once had keeps the way open, and the glyph floor's steps are put out,
// never lost. Every room is done by the house's own solver, and its tests (completion, play-through) stay green.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES } from '../src/temples/index.js';
import { TempleLogic, memoryStore, solve } from '../src/temples/logic.js';
import { TempleRuntime } from '../src/temples/runtime.js';
import { Clock, GlyphFloor, CLOCK, lampLit, stepOn, wokenBy, alongLine } from '../src/temples/trials.js';
import { templeRules } from '../scripts/temple-design/rules.mjs';
import { recordTemple } from '../scripts/temple-design/record.mjs';

const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

test('the clock’s lamps go out from the eye’s end, as many lit as the share of time left', () => {
  const lit = (left) => Array.from({ length: 8 }, (_, i) => lampLit(i, 8, left, 8));
  assert.deepEqual(lit(8), Array(8).fill(true));
  assert.deepEqual(lit(4), [false, false, false, false, true, true, true, true]);
  assert.deepEqual(lit(0.01), [false, false, false, false, false, false, false, true], 'the door’s end is the last lamp');
  assert.deepEqual(lit(0), Array(8).fill(false));
  const { out, total } = alongLine([[0, 0, 0], [10, 0, 0], [10, 0, 10]], 4);
  assert.equal(total, 20);
  assert.deepEqual(out.map((o) => o.p.map((v) => +v.toFixed(2))), [[2.5, 0, 0], [7.5, 0, 0], [10, 0, 2.5], [10, 0, 7.5]]);
});

test('what wakes a clock: any hit, only the fan’s wind, only a bomb’s blast', () => {
  assert.ok(wokenBy(null, 'shoot'));
  assert.ok(wokenBy('gust', 'gust') && wokenBy('gust', 'push', { source: 'gust' }) && !wokenBy('gust', 'shoot') && !wokenBy('gust', 'push', { source: 'gun' }));
  assert.ok(wokenBy('bomb', 'push', { source: 'bomb' }) && !wokenBy('bomb', 'push') && !wokenBy('bomb', 'blade'));
});

test('the glyph floor: the next tile in turn takes, one stepped again changes nothing, one out of turn puts them out', () => {
  assert.equal(stepOn([2, 0, 3], 0, 2), 1);
  assert.equal(stepOn([2, 0, 3], 1, 2), 0);
  assert.equal(stepOn([2, 0, 3], 1, 3), -1);
  assert.equal(stepOn([2, 0, 3], 1, 1), -1, 'a tile not in the order at all (a decoy)');
});

// a timer, its door, its reward: held while it runs, not saved; the door shut again when it stops; open for good once had
const DEF = {
  id: 't', entry: 'a', rooms: { a: {}, b: {} }, links: [{ a: 'a', b: 'b', door: 'd' }],
  elements: { t: { type: 'timer', room: 'a', hold: 5, optional: true }, d: { type: 'door', opens: { any: [{ lit: 't' }, { found: 'c' }] } }, c: { type: 'cache', room: 'b' }, s: { type: 'switch', room: 'a' } },
};

test('a timer is lit only while it runs, nothing of a run is saved, and the reward once had keeps its door open', () => {
  const store = memoryStore(), L = new TempleLogic(DEF, { store });
  assert.equal(L.light('t'), true); L.update();
  assert.ok(L.isOpen('d') && L.reachable().has('b'));
  assert.equal(L.light('t'), false, 'woken again while it runs: the piece starts it over, the logic is already lit');
  assert.equal(Object.keys(store.data).some((k) => k.includes('t')), false, 'nothing of the run saved');
  L.quiet('t'); L.update();
  assert.ok(!L.isOpen('d'), 'stopped: the door shuts again');
  // a reload: a fresh logic on the same store, the clock still
  const L2 = new TempleLogic(DEF, { store });
  assert.ok(!L2.isLit('t') && !L2.isOpen('d'));
  L2.light('t'); L2.update(); L2.find('c'); L2.quiet('t'); L2.update();
  assert.ok(L2.isOpen('d'), 'the coffer had: the door stays open, nobody is shut in');
  assert.ok(new TempleLogic(DEF, { store }).isOpen('d'), 'and after a reload');
});

test('the marker and the scout never point at a side room’s optional pieces; the solver still does them', () => {
  const L = new TempleLogic(DEF, {});
  assert.equal(L.next(), 's', 'the main step, not the optional clock before it');
  L.light('s');
  assert.equal(L.next(), null);
  const r = solve(DEF, { items: [] });
  assert.ok(r.log.includes('timer t') && r.log.includes('open c'), r.log.join(' / '));
});

// the three houses' side rooms: who teaches, who tests, who twists (route order: the Hush-House third, the Well sixth,
// the Engine-House eighth)
const ROOMS = {
  perdide: { hub: 'choir', room: 'quick', far: 'quickIn', timer: 'tQ', cache: 'cQ', gate: 'dQ', glyphs: null, needs: [] },
  incal: { hub: 'gallery', room: 'clock', far: 'clockFar', timer: 'tW', cache: 'cW', gate: 'bW', glyphs: 'gW', needs: ['fan'] },
  buried: { hub: 'gov', room: 'fuse', far: 'fuseIn', timer: 'tF', cache: 'cV', gate: 'dV', glyphs: 'gF', needs: ['bomb'] },
};
const OLDER = { incal: ['hook'], buried: ['hook'] };

test('each house’s side room is done by its own solver, asks for the house’s gadget where it comes after the chest, and strands nobody', () => {
  for (const [id, R] of Object.entries(ROOMS)) {
    const def = TEMPLES[id].def, L = def.logic, base = ['backpack', 'gun', 'doublejump', ...(OLDER[id] ?? [])];
    for (const k of [R.timer, R.cache, R.glyphs].filter(Boolean)) assert.ok(L.elements[k], `${id}: ${k}`);
    assert.ok(L.elements[R.timer].optional && L.elements[R.timer].type === 'timer' && L.elements[R.timer].hold > 0, `${id}: an optional clock`);
    assert.ok(L.rooms[R.room].kind === 'puzzle' && L.rooms[R.far].kind === 'passage', `${id}: a puzzle room and its reward's`);
    const r = solve(L, { items: base });
    assert.equal(r.done, true, `${id}: still solved`);
    assert.ok(r.log.includes(`timer ${R.timer}`) && r.log.includes(`open ${R.cache}`), `${id}: the clock run and the coffer had (${r.log.join(' / ')})`);
    if (R.glyphs) assert.ok(r.log.indexOf(`glyphs ${R.glyphs}`) >= 0, `${id}: the glyph floor stepped`);
    for (const n of R.needs) {
      const no = solve(L, { items: base, withhold: [n] });
      assert.ok(!no.log.includes(`open ${R.cache}`), `${id}: not without the ${n}`);
    }
    // the reward room is never a trap: the house as the solver left it, the clock stopped and the coffer not yet had, and
    // you in the reward room: from there the way back to the room it hangs off opens (the coffer keeps the way open)
    const has = (i) => [...base, ...R.needs, def.gadget].includes(i);
    const data = { ...r.logic.store.data };
    delete data[`found.${R.cache}`];
    const back = solve({ ...L, entry: R.far }, { items: [], from: { data, has } });
    assert.ok(back.order.includes(R.hub), `${id}: back to the ${R.hub} from the ${R.far} (${back.log.join(' / ')})`);
  }
});

test('the early house’s clock asks for nothing but a splash; the later ones combine it with the glyphs and the gadget', () => {
  const E = (id, k) => TEMPLES[id].def.logic.elements[k];
  assert.deepEqual(E('perdide', 'tQ').needs ?? [], [], 'the Hush-House teaches it with the gun alone');
  assert.equal(E('perdide', 'tQ').when, undefined);
  assert.deepEqual(E('incal', 'tW').when, { lit: 'gW' }, 'the Well: the glyphs lift the clock’s lids');
  assert.deepEqual(E('buried', 'gF').when, { lit: 'tF' }, 'the Engine-House: the glyphs take only while the clock runs');
  // the clock runs longer than the run asks at a jog (6 m/s), with time to stop and look
  for (const [id, R] of Object.entries(ROOMS)) assert.ok(E(id, R.timer).hold >= 6, `${id}: ${E(id, R.timer).hold} s`);
});

test('the three side rooms keep the shrine rules (room sizes, doors, puzzles in the middle, the gadget after the chest)', () => {
  for (const id of Object.keys(ROOMS)) {
    const def = TEMPLES[id].def, { rt, pieces, spaces } = recordTemple(def);
    const r = templeRules({ logic: def.logic, pieces, spaces, order: solve(def.logic, { items: ['backpack', 'gun', 'doublejump', 'hook'] }).order });
    assert.deepEqual(r.violations, [], id);
    rt.dispose?.();
  }
});

// ---- the pieces, built in their houses in node (no world round them), driven a frame at a time
const DT = 1 / 30;
const QUICK_HOLD = TEMPLES.perdide.def.logic.elements.tQ.hold;
function house(id, items = []) {
  const def = TEMPLES[id].def;
  const rt = quiet(() => new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def: { ...def, exterior: null, change: null } }));
  rt.logic.has = (i) => items.includes(i);
  const said = [], heard = [];
  rt.notice = (s) => said.push(s);
  rt.sound = { templeTick: (k) => heard.push(k), templeMechanism: () => true, chime: () => {}, critter: () => {}, templeDoor: () => true, templeDoorUpdate: () => {} };
  rt.player = { pos: new THREE.Vector3(0, -999, 0), onGround: true, vel: new THREE.Vector3() };
  const run = (s) => { for (let t = 0; t < s; t += DT) { for (const p of rt.pieces) p.update(DT, t); rt.applyDoors(); } };
  const at = (x, y, z) => rt.player.pos.copy(rt.kit.world(x, y, z));
  return { rt, run, at, said, heard, L: rt.logic };
}

test('the Hush-House’s clock: a splash starts it, the door stands while the lamps last, ticks each second, quicker at the end, and shuts', () => {
  const { rt, run, said, heard, L } = house('perdide', ['gun']);
  const clock = rt.piece('tQ'), door = rt.piece('dQ');
  assert.ok(clock instanceof Clock && clock.lamps.length === 16 && clock.bars.length === 2);
  assert.ok(!door.open);
  clock.hit('shoot', {});
  run(0.1);
  assert.ok(L.isLit('tQ') && door.open, 'woken: the door sinks');
  assert.ok(said.some((s) => /lamps in the floor light/.test(s)));
  // the lamps: all lit at the start, about half at half time, the eye's end out first
  const lit = () => clock.lamps.map((l) => l.m.uniforms.uGlow.value > 0.3);
  assert.equal(lit().filter(Boolean).length, 16);
  run(4.4);
  const half = lit();
  assert.ok(half.filter(Boolean).length >= 7 && half.filter(Boolean).length <= 9 && !half[0] && half[15], half.join());
  // started over while it runs: the lamps fill again
  clock.hit('shoot', {});
  run(0.1);
  assert.equal(lit().filter(Boolean).length, 16, 'woken again: a full run');
  const ticks = heard.length;
  run(QUICK_HOLD - 0.4);
  assert.ok(heard.length - ticks >= QUICK_HOLD - 2, 'a tick each second');
  assert.ok(heard.includes('urgent'), 'quicker ticks in its last seconds');
  run(0.6);
  assert.ok(!L.isLit('tQ') && heard.includes('out') && said.some((s) => /door sinks shut/.test(s)), 'stopped: a clack, and it says so');
  run(1.5);
  assert.ok(!door.open, 'the door shut');
  assert.equal(lit().filter(Boolean).length, 0);
});

test('the Hush-House’s door never shuts on you: it waits while you stand in the doorway, and stays open once the coffer is had', () => {
  const { rt, run, at, L } = house('perdide', ['gun']);
  const clock = rt.piece('tQ'), door = rt.piece('dQ');
  clock.start(); run(0.2);
  const d = door.group.position, l = rt.kit.local(d);
  at(l.x, l.y, l.z);   // in the doorway
  run(QUICK_HOLD + 1);
  assert.ok(!L.isLit('tQ') && door.open, 'the clock has stopped, but it waits for you');
  at(l.x - 4, l.y, l.z);   // stepped through, into the vault
  run(0.2);
  assert.ok(!door.open, 'then it shuts');
  // the coffer: had, and the door opens for good (nothing to wake again to get out)
  assert.ok(L.find('cQ')); run(0.2);
  assert.ok(door.open);
});

test('the Warden’s Well: the glyphs in the panel’s order lift the clock’s lids; only the fan’s gust wakes it; the bridge of light stands while it runs, never sinking under you', () => {
  const { rt, run, at, said, L } = house('incal', ['gun', 'fan']);
  const floor = rt.piece('gW'), clock = rt.piece('tW'), bridge = rt.piece('bW');
  assert.ok(floor instanceof GlyphFloor && floor.tiles.length === 4 && floor.signs.length === 3);
  clock.hit('gust', {}); run(0.1);
  assert.ok(!L.isLit('tW') && said.some((s) => /Stone lids/.test(s)), 'lidded until the glyphs are stepped');
  const W = (i) => floor.tiles[i].at, step = (i) => { at(W(i)[0], W(i)[1] + 0.18, W(i)[2]); run(0.2); };
  const order = floor.o.order;
  step(order[0]); step(order[1]);
  assert.equal(floor.seq, 2);
  step([0, 1, 2, 3].find((i) => !order.includes(i)));   // the decoy
  assert.equal(floor.seq, 0, 'out of turn: the tiles go out');
  assert.ok(said.some((s) => /out of turn/.test(s)));
  for (const i of order) step(i);
  assert.ok(L.isLit('gW'), 'in the order: lit for good');
  at(0, -999, 0);
  clock.hit('shoot', {}); run(0.1);
  assert.ok(!L.isLit('tW') && said.some((s) => /want wind/.test(s)), 'a splash only runs off it');
  clock.hit('push', { source: 'gust' }); run(0.1);
  assert.ok(L.isLit('tW') && bridge.open, 'the gust: the bridge of light rises');
  // standing on the bridge when the clock stops: it waits for you to step off
  const a = bridge.span.a, b = bridge.span.b;
  at((a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
  run(L.el('tW').hold + 0.5);
  assert.ok(!L.isLit('tW') && bridge.open, 'stopped, but the bridge holds while you are on it');
  at(b.x + 3, b.y, b.z); run(0.2);
  assert.ok(!bridge.open, 'stepped off: it sinks');
  assert.ok(L.find('cW')); run(0.2);
  assert.ok(bridge.open, 'the coffer had: the bridge stands for good');
});

test('the Engine-House: the tiles are dead and the panel dark until a bomb wakes the clock; out of time, the steps go out; in time, the vault opens for good', () => {
  const { rt, run, at, said, L } = house('buried', ['gun', 'bomb']);
  const floor = rt.piece('gF'), clock = rt.piece('tF'), door = rt.piece('dV');
  const step = (i) => { const p = floor.tiles[i].at; at(p[0], p[1] + 0.18, p[2]); run(0.2); at(0, -999, 0); run(0.05); };
  const order = floor.o.order;
  run(0.1);
  assert.ok(floor.signs.every((s) => !s.sign.visible), 'the panel dark');
  step(order[0]);
  assert.equal(floor.seq, 0);
  assert.ok(said.some((s) => /tiles are dead/.test(s)));
  clock.hit('shoot', {}); run(0.1);
  assert.ok(!L.isLit('tF') && said.some((s) => /wants a blast/.test(s)));
  clock.hit('push', { source: 'bomb' }); run(0.1);
  assert.ok(L.isLit('tF') && floor.signs.every((s) => s.sign.visible), 'a blast: the clock runs, the panel shows the order');
  step(order[0]); step(order[1]); step(order[2]);
  assert.equal(floor.seq, 3);
  run(L.el('tF').hold);
  assert.ok(!L.isLit('tF') && floor.seq === 0 && floor.signs.every((s) => !s.sign.visible), 'out of time: the steps go out, the panel dark again');
  assert.ok(!door.open && !L.isLit('gF'));
  clock.hit('push', { source: 'bomb' }); run(0.1);
  for (const i of order) step(i);
  assert.ok(L.isLit('gF'), 'in time: lit for good');
  run(L.el('tF').hold + 1);
  assert.ok(door.open, 'and the vault’s door stays open when the clock stops');
});
