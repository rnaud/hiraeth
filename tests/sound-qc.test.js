// The sound QC (.claude/skills/sound-qc, issue #379): its judgement (scripts/sound-qc/lib.mjs) on made-up sounds, and
// its list of actions (scripts/sound-qc/actions.mjs) against the code: every entry names a Sound call and where the
// game asks for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES } from '../scripts/sound-qc/lib.mjs';
import { gameText } from './game-text.js';
import { ACTIONS, loadKit } from '../scripts/sound-qc/actions.mjs';
import { SCENARIOS } from '../scripts/sound-qc/scenarios.mjs';

test('the list: every action has a role, a call, where the game asks for it, and a scenario that exists', () => {
  const ids = new Set();
  for (const a of ACTIONS) {
    assert.ok(!ids.has(a.id), `${a.id} once`); ids.add(a.id);
    assert.ok(ROLES[a.role], `${a.id}: a role`);
    assert.equal(typeof a.play, 'function', `${a.id}: a call`);
    assert.ok(a.web.length, `${a.id}: where the browser asks for it`);
    if (a.drive) assert.ok(SCENARIOS[a.drive] && a.calls?.length, `${a.id}: its scenario and calls`);
  }
  for (const k of ['swing-1', 'hit', 'jump', 'land-hard', 'evade', 'hurt', 'menu-move', 'menu-confirm', 'pickup']) assert.ok(ACTIONS.find((a) => a.id === k)?.key, `${k} is a key action`);
});

// issue #499: the code patterns went stale when the hurts and the fight moved into the one game setup (#427, #435): six
// heard sounds were called missing. Every pattern must match the code as it is, so a refactor fails here, not the QC.
test('the list against the code: every action\'s patterns match where the game asks for it, in the browser and the engines', () => {
  const src = new Map(), read = (f) => { if (!src.has(f)) src.set(f, gameText(f)); return src.get(f); };   // (the files the list names, through the source's literal catalogues: tests/game-text.js)
  const stale = [];
  for (const a of ACTIONS) {
    for (const [f, re] of a.web) if (!re.test(read(f))) stale.push(`${a.id}: web ${f} ${re}`);
    if (Array.isArray(a.engine)) { for (const [f, re] of a.engine) if (!re.test(read(f))) stale.push(`${a.id}: engine ${f} ${re}`); }
    else assert.ok(a.engine === 'shared' || a.engine === null, `${a.id}: engine is 'shared', null or its own wiring`);
  }
  assert.deepEqual(stale, [], 'patterns that no longer match the code');
  // what the one game setup wires for both hosts is looked for there, and in each host's use of it
  for (const id of ['hurt', 'potion-open', 'potion-heal', 'chime', 'potion-pickup', 'flurry']) {
    const a = ACTIONS.find((x) => x.id === id);
    assert.ok(a.web.some(([f]) => f === 'src/host/game-host.js') && a.engine.some(([f]) => f === 'src/host/game-host.js'), `${id}: found in game-host.js`);
    assert.ok(a.web.some(([f]) => f === 'src/main.js'), `${id}: and in the page's use of it`);
    assert.ok(a.engine.some(([f]) => f === 'engine/game.js' || f === 'engine/combat.js'), `${id}: and in the engines' use of it`);
  }
});

test('the list covers the gadgets (fire, hold, switch), the glove\'s modes and the fight temples, and each action plays something', async () => {
  await loadKit();
  for (const id of ['gadget-switch', 'hook-fire', 'bomb-throw', 'boomerang-throw', 'magnet-grab', 'magnet-hold', 'bubble-blow', 'fan-swing', 'springs-wind', 'springs-launch', 'recall-start', 'recall-tick', 'lens-up', 'pen-draw',
    'glove-fluid', 'glove-push', 'glove-stilling', 'gun-mode', 'glove-bloom', 'glove-tether', 'push', 'foe-warn', 'foe-kill', 'room-cleared']) assert.ok(ACTIONS.find((a) => a.id === id), `${id} on the list`);
  // a stand-in Sound that writes down what it is asked (the synth's sweep and burst, or a method of its own)
  for (const a of ACTIONS) {
    const calls = [];
    const s = new Proxy({ ctx: { currentTime: 1 } }, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' ? (...args) => { calls.push([k, args]); } : undefined) });
    a.play(s);
    assert.ok(calls.length, `${a.id}: its play asks the Sound for a sound`);
  }
});
