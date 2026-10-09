// The final chapter (src/story/ending.js): the first homecoming, the light's trace past the Signal Market,
// the Lantern and Ilen, the true ending; the choices the stone remembers; old saves that ended before.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState } from '../src/game-state.js';
import {
  finaleOpen, finalDue, homecomingKind, finaleEntry, FINALE_ID, choicesMade, choiceLines, ilenOnChoices, tombLines, tokenList, NOT_SET_DOWN, credits,
} from '../src/story/ending.js';
import { relaySignal, RELAY_TEXT } from '../src/story/relay.js';
import { pendingCall, callLines, TRACE_CALL, recordingLabel, onHologram } from '../src/story/calls.js';
import { mapEntries } from '../src/ship/starmap.js';
import { migrateFlags } from '../src/save-migrate.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { PEOPLE as LANTERN_PEOPLE, KEEPSAKE as ILEN, QUESTS } from '../src/story/lantern-data.js';
import { KEEPERS as LORN2, promiseDue } from '../src/story/perdide2-data.js';
import { PEOPLE as INCAL } from '../src/story/incal-data.js';
import { LEVELS } from '../src/levels/index.js';
import { ORDER } from '../src/levels/content.js';
import { lanternHeight, LANTERN, ISLE, LANTERN_SHIP, ILEN_SPOT } from '../src/levels/lantern.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const memory = (flags = {}) => { const store = new Map(); const g = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }); for (const [k, v] of Object.entries(flags)) g.set(k, v); return g; };
const at = (f) => (k) => f[k];

test('the finale opens after the first homecoming, once the market has been heard, in either order', () => {
  assert.equal(finaleOpen({ flag: at({ 'world.bazaar.done': true }) }), false, 'the market alone: home first');
  assert.equal(finaleOpen({ flag: at({ 'ending.done': true }) }), false, 'home alone: the market first');
  assert.equal(finaleOpen({ flag: at({ 'ending.done': true, 'world.bazaar.done': true }) }), true);
  assert.equal(finaleOpen({ flag: at({ 'ending.done': true }), completed: ['desert', 'bazaar'] }), true, 'the market\'s story page counts');
  assert.equal(finaleOpen({ flag: at({ 'finale.met': true }) }), true, 'been there: it stays');
  assert.equal(homecomingKind(at({})), 'first');
  assert.equal(homecomingKind(at({ 'ending.done': true })), null, 'after the first: just home');
  assert.equal(homecomingKind(at({ 'ending.done': true, 'finale.met': true })), 'final');
  assert.equal(homecomingKind(at({ 'ending.done': true, 'finale.met': true, 'ending.final': true })), null);
  assert.ok(finalDue(at({ 'finale.met': true })) && !finalDue(at({ 'finale.met': true, 'ending.final': true })));
  assert.equal(finaleEntry({ open: false }), null);
  assert.equal(finaleEntry({ open: true }).id, FINALE_ID);
  assert.ok(LEVELS.find((l) => l.id === FINALE_ID)?.hidden, 'a level of its own, off the picker');
});

test('the relay points back out: far before the market, the light\'s trace after the first homecoming, nothing once Ilen is found', () => {
  assert.equal(relaySignal({ flag: at({ 'ending.done': true }), completed: 6 }).stage, 'far', 'home, the market not heard: the signal further on');
  assert.deepEqual(relaySignal({ flag: at({ 'ending.done': true, 'world.bazaar.done': true }), completed: 11 }), { stage: 'trace', world: FINALE_ID });
  assert.deepEqual(relaySignal({ flag: at({ 'ending.done': true, 'world.bazaar.done': true, 'calls.ilen.told': true }), completed: 11 }), { stage: 'trace', world: FINALE_ID });
  assert.equal(relaySignal({ flag: at({ 'ending.done': true, 'world.bazaar.done': true, 'calls.ilen.asked': true }), completed: 11 }).stage, 'held', 'the mother\'s recording first');
  assert.equal(relaySignal({ flag: at({ 'ending.done': true, 'world.bazaar.done': true, 'calls.ilen.told': true, 'finale.met': true }), completed: 11 }), null);
  assert.ok(RELAY_TEXT.screen.trace && RELAY_TEXT.console.trace && RELAY_TEXT.trace);
});

test('the map charts the Lantern past the market, pulsing with the trace; after Ilen, home waits for both', () => {
  const levels = LEVELS;
  const f = { 'ending.done': true, 'world.bazaar.done': true, 'calls.home': true };
  const done = (id) => ORDER.includes(id);
  const flag = (k) => f[k] ?? (k.startsWith('world.') && done(k.slice(6, -5)) ? true : undefined);
  const entries = mapEntries({ order: ORDER, levels, flag, current: 'home', home: true, relay: relaySignal({ flag, completed: 11 }), finale: () => finaleOpen({ flag }) });
  const lantern = entries.find((e) => e.id === FINALE_ID);
  assert.ok(lantern?.known && lantern.finale && lantern.signal === 'trace', 'charted, the trace on it');
  assert.equal(mapEntries({ order: ORDER, levels, flag: at({}), current: 'desert', home: false, finale: false }).find((e) => e.id === FINALE_ID), undefined, 'not before');
  f['finale.met'] = true;
  const after = mapEntries({ order: ORDER, levels, flag, current: FINALE_ID, home: true, relay: null, finale: true });
  assert.ok(after.find((e) => e.home).waiting, 'home: Ilen aboard');
  assert.ok(after.find((e) => e.id === FINALE_ID).done);
});

test('after the first homecoming the ship\'s log waits: the light over the hill, its trace, the father at the window', () => {
  const f = { 'ending.done': true };
  assert.equal(pendingCall({ flag: at(f), completed: 0 }), TRACE_CALL);
  const lines = callLines(TRACE_CALL, { flag: at(f), completed: ['desert'] });
  assert.ok(lines.some((l) => l.who === 'ship' && /faint signal on the old relay/.test(l.text)), 'before the market: toward the relay');
  assert.ok(lines.some((l) => l.who === 'father' && /window/.test(l.text)));
  const marked = callLines(TRACE_CALL, { flag: at({ ...f, 'world.bazaar.done': true }), completed: ['bazaar'] });
  assert.ok(marked.some((l) => /past the Signal Market/.test(l.text)), 'after it: past the market, charted');
  assert.equal(onHologram(TRACE_CALL), 'father');
  assert.match(recordingLabel(TRACE_CALL), /LOGGED/);
  assert.equal(pendingCall({ flag: at({ ...f, 'calls.trace': true }), completed: 0 }), null, 'once');
  assert.equal(pendingCall({ flag: at({ ...f, 'ending.final': true }), completed: 0 }), null, 'not after the true ending');
  // the reel's oldest side, between the two homecomings, ends by pointing out
  const old = callLines(8, { flag: at({ ...f, 'calls.home': true, 'world.bazaar.done': true }), completed: ORDER.slice(0, 8), lastWorld: ORDER[7] });
  assert.ok(old.some((l) => l.who === 'ship' && /trace is on the galactic map/.test(l.text)));
  const done = callLines(8, { flag: at({ ...f, 'calls.home': true, 'ending.final': true }), completed: ORDER.slice(0, 8), lastWorld: ORDER[7] });
  assert.ok(!done.some((l) => /trace|old relay/.test(l.text)), 'after the true ending: nothing more to point at');
});

test('the choices the stone remembers: Dov\'s token, Hollin\'s promise, Esk\'s hill', () => {
  assert.deepEqual(choicesMade(at({})), { token: null, promise: null, broke: false });
  const all = choicesMade(at({ 'incal.token': 'returned', 'perdide2.promise': 'yes', 'perdide2.promise.kept': true, 'edena.terraces.flooded': true }));
  assert.deepEqual(all, { token: 'returned', promise: 'kept', broke: true });
  assert.equal(choicesMade(at({ 'perdide2.promise': 'yes' })).promise, 'made');
  assert.equal(choicesMade(at({ 'perdide2.promise': 'maybe' })).promise, 'declined');
  assert.equal(choiceLines(all).length, 3);
  assert.equal(ilenOnChoices(all).length, 3);
  assert.deepEqual(choiceLines({ token: 'kept', promise: 'declined' }), [], 'keeping, or not promising, is not remarked on');
  const first = tombLines([], { choices: all });
  assert.ok(first.some((l) => /Dov’s lift token isn’t here/.test(l.text)) && first.some((l) => /I went/.test(l.text)), 'the first homecoming: his words');
  const last = tombLines([], { choices: { ...all, promise: 'made' }, final: true });
  assert.ok(last.some((l) => l.who === 'ilen' && /owes a lamp-keeper/.test(l.text)), 'the true ending: hers');

  // Dov: keep the token, or press it back into his hand
  const runDov = (pick) => {
    const g = memory({ 'item.ration': 1, 'quest.incal.ration': 'dov' });
    const r = new DialogueRunner(INCAL.dov, { game: g, quests: { has: () => false, take() {}, isActive: () => false, stage: () => undefined, advance() {}, isStarted: () => false, isDone: () => false }, npc: {} });
    r.goto('ration2');
    while (!r.lastPage) r.advance();
    const c = r.choices().find((x) => pick.test(x.text));
    r.choose(c.index);
    return g;
  };
  const kept = runDov(/keep it safe/);
  assert.equal(kept.flag('incal.token'), 'kept');
  assert.ok(kept.keepsakes().some((k) => k.id === 'incal.token'));
  const back = runDov(/Go down and see Pip/);
  assert.equal(back.flag('incal.token'), 'returned');
  assert.ok(!back.keepsakes().some((k) => k.id === 'incal.token'), 'one fewer thing on the stone');

  // Hollin: a promise costs the coming back
  const g = memory({ 'perdide2.promise': 'yes', 'perdide2.promise.worlds': 5 });
  for (const w of ORDER.slice(0, 5)) g.set(`world.${w}.done`, true);
  assert.equal(promiseDue({ game: g }), false, 'not before he has been somewhere else');
  g.set(`world.${ORDER[6]}.done`, true);
  assert.equal(promiseDue({ game: g }), true, 'back after another world');
  const hollin = LORN2.find((p) => p.id === 'hollin.perdide2');
  const r = new DialogueRunner(hollin, { game: g, quests: { isDone: () => true, stage: () => 'done', isActive: () => false, isStarted: () => true }, npc: {} });
  assert.equal(r.nodeId, 'came');
  while (!r.lastPage) r.advance();
  assert.equal(g.flag('perdide2.promise.kept'), true);
});

test('the Lantern: Ilen tells him what the light was, why it struck, the makers\' sign, and comes home', () => {
  const g = memory({ 'ending.done': true, 'world.bazaar.done': true, 'calls.ilen.told': true, 'perdide2.hollin.told': true, 'perdide2.promise': 'yes', 'incal.token': 'returned', 'edena.terraces.flooded': true });
  const advanced = [];
  const quests = { advance: (q, s) => advanced.push([q, s]), isDone: () => false, stage: () => 'ilen', isActive: () => true, isStarted: () => true, has: () => false };
  const r = new DialogueRunner(LANTERN_PEOPLE.ilen, { game: g, quests, npc: {} });
  assert.equal(r.nodeId, 'hello');
  const said = [];
  const want = [/Ilen\?/, /Your brother/, /died two years ago/, /Your answer/, /Three dots/, /why did it strike/, /reel was playing/, /Odile and Talo\?/, /Hollin still keeps/, /brought some things/, /way home/, /couldn’t mend/, /Come home with me/];
  for (let i = 0; i < 200 && !r.ended; i++) {
    said.push(r.text);
    if (!r.lastPage) { r.advance(); continue; }
    const cs = r.choices();
    if (!cs.length) { r.advance(); continue; }
    const c = want.map((re) => cs.find((x) => re.test(x.text))).find(Boolean) ?? cs[0];
    r.choose(c.index);
  }
  const all = said.join(' ');
  assert.match(all, /makers built this lantern/, 'what the light is');
  assert.match(all, /sang his own message/, 'her answer');
  assert.match(all, /we heard you/i, 'the sign');
  assert.match(all, /trying to bring him here/, 'why it struck');
  assert.match(all, /Odile and Talo got here first/);
  assert.match(all, /Tell him they got here/, 'she asks him to keep the promise');
  assert.match(all, /Somebody should get to use one/, 'she hears about Dov');
  assert.equal(g.flag('finale.met'), true);
  assert.deepEqual(advanced, [[QUESTS[0].id, 'ilen']]);
  assert.ok(NOT_SET_DOWN.has(ILEN.id) && !tokenList([ILEN]).length, 'she is not set on the slab: she walks to it');
  const c = credits({ order: [...ORDER, FINALE_ID], flag: (k) => ({ 'finale.met': true, 'met.ilen': true })[k] });
  assert.ok(c.worlds.some((w) => w.id === FINALE_ID && w.people.some((p) => p.name === 'Ilen' && p.met)), 'in the credits');
  assert.ok(c.home.some((h) => /Ilen, who heard him/.test(h)));
});

test('the Lantern\'s island: the bar out of the water to the island, the lantern on its crown', () => {
  const H = lanternHeight;
  assert.ok(H(LANTERN_SHIP.x, LANTERN_SHIP.z) > 0.3, 'the landing flat is dry');
  assert.ok(H(LANTERN.x, LANTERN.z) > ISLE.top - 1.5, 'the lantern on the crown');
  assert.ok(H(ILEN_SPOT.x, ILEN_SPOT.z) > 2, 'Ilen above the water');
  for (let z = ISLE.z + ISLE.r; z < LANTERN_SHIP.z; z += 4) assert.ok(H(Math.sin(z * 0.035) * 5, z) > -0.4, `the bar at z ${z}: shallow enough to wade`);
  assert.ok(H(60, 60) < -1, 'water beside the bar');
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === FINALE_ID).create(scene));
  assert.ok(level.lantern?.crown && level.lantern.spots.ilen, 'the crown, and her place');
  assert.equal(level.id, FINALE_ID);
});

test('old saves that ended before: their ending was the first homecoming; the finale waits for the market', () => {
  const old = { 'save.migrated': 1, 'ending.done': true, 'ending.keepsake': 'all', 'ending.tokens': 9, 'home.lou.drawing': true };
  assert.equal(migrateFlags(old), true);
  assert.equal(old['ending.first'], 'old');
  assert.ok(!old['ending.final'], 'the true ending is still to come');
  assert.equal(homecomingKind(at(old)), null, 'flying home is just home');
  assert.equal(finaleOpen({ flag: at(old) }), false, 'the market not heard: not yet');
  assert.equal(pendingCall({ flag: at(old), completed: 6 }), TRACE_CALL, 'the voicemail points the way');
  const heard = { ...old, 'world.bazaar.done': true, 'save.migrated': 1 };
  delete heard['ending.first'];
  migrateFlags(heard);
  assert.equal(finaleOpen({ flag: at(heard) }), true, 'heard: the Lantern is on the map');
  // a save that never ended, and a new one, are left alone
  const mid = { 'save.migrated': 1, 'world.desert.done': true };
  migrateFlags(mid);
  assert.equal(mid['ending.first'], undefined);
  const fresh = {};
  migrateFlags(fresh);
  assert.equal(fresh['ending.first'], undefined);
  // the same through the game state as it loads
  const store = new Map([['moebius.game.v1', JSON.stringify({ flags: { 'save.migrated': 1, 'ending.done': true }, keepsakes: [] })]]);
  const g = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  assert.equal(g.flag('ending.first'), 'old');
});

test('the Lantern’s light glows from the start: never smaller on screen than its least angle far off (the QC pass)', async () => {
  const { orbScale, ORB } = await import('../src/story/lantern.js');
  const span = (d, k) => (2 * Math.atan((ORB.R * orbScale(d, k)) / d) * 180) / Math.PI;
  for (const d of [40, 80, 120]) assert.ok(span(d, 1) >= ORB.MIN_DEG - 0.01, `${d} m off: ${span(d, 1).toFixed(2)}°`);
  assert.equal(orbScale(5, 0.6), 0.6, 'its own size close to');
  assert.equal(orbScale(0, 1), 1);
});

test('frameBoth: the crown low and the light high, both inside the letterbox (the Lantern’s first panel, the QC pass)', async () => {
  const THREE = await import('three');
  const { frameBoth } = await import('../src/story/lantern.js');
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  const pos = V(0, 2, 0), top = V(0, 30, -40);
  for (const lit of [V(-20, 70, -85), V(-10, 50, -62), V(-2, 33, -44)]) {   // (from out past the crown, down to it)
    const f = frameBoth(pos, top, lit);
    cam.fov = f.fov; cam.position.copy(pos); cam.lookAt(f.look); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const yt = top.clone().project(cam).y, yl = lit.clone().project(cam).y;
    assert.ok(Math.abs(yt) < 0.78 && Math.abs(yl) < 0.78, `both inside the bars (${yt.toFixed(2)}, ${yl.toFixed(2)}, fov ${f.fov.toFixed(1)})`);
    if (f.fov > 48) assert.ok(yt < yl, 'the crown under the light');
  }
});
