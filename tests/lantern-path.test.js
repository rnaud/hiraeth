// Worlds seven to eleven pull toward the end (issue #127): the Lantern's light in every sky from the seventh world
// on, brighter as the end nears; the father's window recording, a new line in each world after the first
// homecoming; the Signal Market's silent tower named as the goal once home is done.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { lanternSky, applyLanternSky, LIGHT_FROM, LIGHT_MIN } from '../src/story/lantern-sky.js';
import { callLines, pendingCall, completedWorlds, applyCall, recordingLabel, onHologram, WINDOW, WINDOW_ANY } from '../src/story/calls.js';
import { chargeState, chargeStep, chargeHud } from '../src/story/charge.js';
import { towerDue, TOWER, ENDING_WORLDS } from '../src/story/ending.js';
import { parseLine, TONES } from '../src/story/tone.js';
import { inkFeatures } from '../src/post.js';
import { ORDER } from '../src/levels/names.js';
import { GameState } from '../src/game-state.js';

test('the Lantern’s light: in no sky before the seventh world, then in every world’s, brighter world by world', () => {
  assert.equal(LIGHT_FROM, ENDING_WORLDS, 'from the seventh world on: six done');
  for (let n = 0; n < LIGHT_FROM; n++) assert.equal(lanternSky({ level: ORDER[n], completed: n }), null, `${n} worlds done: no light`);
  let last = 0;
  for (let n = LIGHT_FROM; n < ORDER.length; n++) {
    const L = lanternSky({ level: ORDER[n], completed: n });
    assert.ok(L, `${ORDER[n]}, the ${n + 1}th world: the light is in its sky`);
    assert.ok(L.strength > last, `brighter than the world before (${L.strength.toFixed(2)} > ${last.toFixed(2)})`);
    last = L.strength;
  }
  assert.equal(lanternSky({ level: ORDER[LIGHT_FROM], completed: LIGHT_FROM }).strength, LIGHT_MIN, 'faint in the seventh');
  assert.ok(last >= 0.99, 'at its brightest by the last world');
  // every world's sky, the route's and the detours', in the half the sun and the moon never cross, clear of the skyline
  for (const id of [...ORDER, 'mangrove', 'overnighttrain']) {
    const L = lanternSky({ level: id, completed: 8 });
    assert.ok(L && L.az > 210 && L.az < 390 - 30 && L.el >= 15 && L.el <= 25, `${id}: ${JSON.stringify(L)}`);
  }
  // not at home (the light comes over the hill there itself), nor at the Lantern, nor once Ilen is found
  assert.equal(lanternSky({ level: 'home', completed: 9 }), null);
  assert.equal(lanternSky({ level: 'lantern', completed: 12 }), null);
  assert.equal(lanternSky({ level: 'bazaar', completed: 11, flag: (k) => k === 'finale.met' }), null);
  // the homecoming and the market heard lift it a little more
  const flags = (o) => (k) => o[k];
  const a = lanternSky({ level: 'buried', completed: 7 }).strength;
  const b = lanternSky({ level: 'buried', completed: 7, flag: flags({ 'ending.done': true }) }).strength;
  const c = lanternSky({ level: 'buried', completed: 7, flag: flags({ 'ending.done': true, 'clue.bazaar.home': true }) }).strength;
  assert.ok(a < b && b < c);
  // the ink pass draws it only where it is (its part compiled in: INK_LANTERN), a direction above the horizon
  const v = applyLanternSky(new THREE.Vector4(), lanternSky({ level: 'spheres', completed: 9 }));
  assert.ok(v.y > 0.25 && Math.abs(v.length() - Math.hypot(1, v.w)) < 1e-6);
  const U = (lantern) => ({ uLantern: { value: lantern }, uHazeLayers: { value: [0, 0, 0, 0] }, uHeightFog: { value: [0, 0, 0, 0] }, uCast: { value: [0, 0] }, uInkShadow: { value: [0, 0] } });
  assert.ok('INK_LANTERN' in inkFeatures(U(v)));
  assert.ok(!('INK_LANTERN' in inkFeatures(U(applyLanternSky(new THREE.Vector4(), null)))));
});

/** A save after the first homecoming with the first six worlds done; then each world after it, in order. */
function afterHome() {
  const store = new Map();
  const game = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, val) => store.set(k, val) });
  for (const id of ORDER.slice(0, ENDING_WORLDS)) game.set(`world.${id}.done`, true);
  for (let n = 1; n <= ENDING_WORLDS; n++) game.set(`calls.${n}`, true);
  game.set('calls.home', true); game.set('ending.done', true); game.set('calls.trace', true);
  return game;
}

test('the window recording: after the first homecoming, each world’s recording has its own new line in his voice, pointing on', () => {
  assert.deepEqual(Object.keys(WINDOW).sort(), [...ORDER].sort(), 'a line for every world on the route');
  assert.equal(new Set(Object.values(WINDOW)).size, ORDER.length, 'each its own');
  for (const t of [...Object.values(WINDOW), WINDOW_ANY]) {
    const p = parseLine(t);
    assert.ok(TONES.includes(p.tone) && p.text.length < 110, `tone-tagged and short: ${t}`);
    assert.ok(!/Ilen|sister|Lantern|daughter/.test(t), `points on, never explains: ${t}`);
  }
  const game = afterHome(), flag = (k) => game.flag(k);
  const heard = new Set();
  for (const w of ORDER.slice(ENDING_WORLDS)) {
    game.set(`world.${w}.done`, true);
    const done = completedWorlds(ORDER, { flag });
    const n = pendingCall({ flag, completed: done.length });
    assert.equal(n, done.length, `${w}: its recording waits`);
    const ctx = { flag, completed: done, lastWorld: w, keepsakes: [] };
    const lines = callLines(n, ctx);
    const win = lines.find((l) => l.who === 'father' && parseLine(WINDOW[w]).text === l.text);
    assert.ok(win, `${w}: the window recording's line for it`);
    assert.ok(!heard.has(win.text), `${w}: a new line`);
    heard.add(win.text);
    assert.ok(lines.every((l) => l.tone), `${w}: every line carries a tone`);
    assert.ok(!lines.some((l) => l.who === 'mother'), `${w}: his recording alone (no question from her over it)`);
    assert.equal(recordingLabel(n, ctx), 'LOGGED 3 YEARS AGO');
    assert.equal(onHologram(n, ctx), 'window');
    // it ends pointing on: the tower until the market is heard, then the light's trace
    const last = lines[lines.length - 1];
    assert.match(last.text, w === 'bazaar' ? /trace/ : /silent tower/, `${w}: ${last.text}`);
    applyCall(game, lines);
    game.set(`calls.${n}`, true);
  }
  assert.equal(heard.size, ORDER.length - ENDING_WORLDS);
  // the true ending over: the reel's oldest side again, no window
  game.set('ending.final', true);
  const after = callLines(12, { flag, completed: ORDER, lastWorld: 'bazaar' });
  assert.ok(!after.some((l) => Object.values(WINDOW).some((t) => parseLine(t).text === l.text)));
});

test('a world finished before home keeps its line for later: the window plays each world’s once, in any order', () => {
  const game = afterHome(), flag = (k) => game.flag(k);
  // the Garden first (out of order), then the Glass Dunes: each its own line, never the same twice
  const seen = [];
  for (const w of ['spheres', 'glassdunes', 'buried']) {
    game.set(`world.${w}.done`, true);
    const done = completedWorlds(ORDER, { flag });
    const lines = callLines(done.length, { flag, completed: done, lastWorld: done[done.length - 1] });
    const t = lines.find((l) => l.who === 'father' && Object.values(WINDOW).some((x) => parseLine(x).text === l.text)).text;
    assert.ok(!seen.includes(t), `${w}: a line not heard yet`);
    seen.push(t);
    applyCall(game, lines);
    game.set(`calls.${done.length}`, true);
  }
});

test('the silent tower: named as the goal once home is done, until the market is heard; reaching it completes the step', () => {
  const f = (o) => (k) => o[k];
  const before = chargeState({ flag: f({ 'charge.given': true, 'calls.home': true }), completed: 7 });
  assert.notEqual(chargeStep(before), TOWER.step, 'not before the homecoming');
  const home = { 'charge.given': true, 'calls.home': true, 'ending.done': true };
  assert.ok(towerDue({ flag: f(home), completed: 7 }));
  const st = chargeState({ flag: f(home), completed: 7 });
  assert.equal(chargeStep(st), 'Make the Signal Market’s silent tower speak');
  assert.ok(!chargeStep(st).includes('\n') && chargeStep(st).length < 60, 'one line');
  assert.equal(chargeHud(st), '✦ Make the Signal Market’s silent tower speak');
  // the tower speaking (the broadcast on) is the goal reached: the step moves on to the light's trace
  const spoke = { ...home, 'bazaar.broadcast.on': true };
  assert.ok(!towerDue({ flag: f(spoke), completed: 7 }));
  assert.match(chargeStep(chargeState({ flag: f(spoke), completed: 7 })), /trace/);
  // the market heard before home: never the tower, straight to the trace
  assert.ok(!towerDue({ flag: f({ ...home, 'world.bazaar.done': true }), completed: 8 }));
  // Ilen found, or the true ending: no tower
  assert.ok(!towerDue({ flag: f({ ...home, 'finale.met': true }), completed: 12 }));
});
