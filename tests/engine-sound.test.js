// Issue #379 (the sound QC, .claude/skills/sound-qc): the engines' game (engine/game.js, what Unity plays) hears what the
// page's does. Before, it had no BodyFoley (no jump, landing, roll, knock-out), no pick-up, no healing chord, no swimming
// sounds and no footing for the steps, and the blade's press was silent for its wind-up's 133 ms. engine/game.js in a
// bare V8 context with its sound on, driven by keys; every call into its Sound written down with its frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { driver } from '../scripts/sound-qc/drive.mjs';
import { SCENARIOS } from '../scripts/sound-qc/scenarios.mjs';
import { uiKind, wrapMenus, menusHeard } from '../src/ui-sound.js';

const file = tempPath(join(tmpdir(), `hiraeth-engine-sound-${process.pid}.js`));
let D = null;
const play = async (id) => { D ??= await (async () => { await bundle('godot', { input: 'engine/game.js', out: [file] }); return driver({ file }); })(); return (await D.play(SCENARIOS[id])).calls; };
const first = (calls, name, arg) => calls.find((c) => c.name === name && (arg === undefined || c.args[0] === arg));

test('the engines\' game: the blade\'s press heard in its frame, the cut at the end of its wind-up', async () => {
  const calls = await play('combo');
  const w = first(calls, 'fluidWindup'), s = first(calls, 'fluidSlash');
  assert.ok(w && w.f === 0, `the press answered at once: ${JSON.stringify(w)}`);
  assert.ok(s && s.f > w.f && s.f <= 6, `the cut's whoosh after it: ${JSON.stringify(s)}`);
  assert.ok(calls.filter((c) => c.name === 'fluidWindup').length >= 2, 'each swing of the combo');
});

test('the engines\' game: the body heard (a jump, its landing, the roll, a fall, a knock-out) and the hearts coming back', async () => {
  assert.ok(first(await play('jump'), 'jump'), 'a jump');
  const fall = await play('fall');
  assert.ok(first(fall, 'land'), 'a landing from a fall');
  assert.ok(first(await play('evade'), 'evade'), 'the roll');
  assert.ok(first(await play('knockout'), 'knockdown'), 'knocked down');
  assert.ok(first(await play('potion'), 'potion', 'heal'), 'a potion\'s healing chord');
});

test('the menus\' presses as sounds, the same for the page and the engines', () => {
  assert.equal(uiKind({ key: 'ArrowDown' }), 'move');
  assert.equal(uiKind({ key: 'Enter' }), 'confirm');
  assert.equal(uiKind({ key: 'Escape' }), 'back');
  assert.equal(uiKind({ action: 'tabNext' }), 'tab');
  assert.equal(uiKind({ nav: [0, 0] }), null);
  assert.equal(uiKind({ key: 'KeyZ' }), null);
  const heard = [];
  const menus = { open: false, key(c) { if (c === 'Escape') this.open = false; }, action() {}, navigate() {}, show() { this.open = true; } };
  wrapMenus(menus, (k) => heard.push(k));
  menus.key('ArrowDown');
  assert.deepEqual(heard, [], 'closed: nothing');
  menus.show(); menusHeard(menus);
  menus.navigate(0, 1); menus.action('confirm'); menus.key('KeyQ');
  menus.key('Escape'); menusHeard(menus);
  assert.deepEqual(heard, ['open', 'move', 'confirm', 'tab', 'close'], 'the press that closes it heard as it closing');
});
