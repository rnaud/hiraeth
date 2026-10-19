// Issue #526: a conversation's answers carry their mark as the page draws it (src/story/dialogue.js choiceHtml): the
// keyboard's number, a › on a touch screen, and with a pad in hand the confirm button's badge on the answer it would
// pick. Unity's dialogue box wrote the number always ("1" where the web drew the pad's A).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { Dialogue } from '../src/story/dialogue.js';
import { screen } from '../src/platform.js';
import { promptText } from '../src/native-pad.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const ANA = { id: 'ana', name: 'Ana', kind: 'f', color: '#3a6ea5',
  talk: { nodes: { hello: { say: ['~neutral~ The well has gone quiet.'], choices: [{ text: '~curious~ Why?', end: true }, { text: '~neutral~ Goodbye.', end: true }] } } } };

test('the answers\' mark crosses to the engines: the input in hand and the confirm button (issue #526)', () => {
  const classes = new Set();
  const had = globalThis.document;
  globalThis.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { classList: { contains: (c) => classes.has(c), toggle() {}, add() {}, remove() {} } } };   // (the engines' body: engine/game.js inputMode.apply)
  try {
    const game = new GameState(memory());
    const d = new Dialogue({ game, quests: new Quests({ game }) });
    d.start(ANA, { talkTo: null, pos: { x: 1, y: 0, z: 0 } });
    d.update(10);
    assert.equal(screen.state.dialogue.choices.length, 2);
    assert.deepEqual(screen.state.dialogue.answerKey, { kind: 'keys', key: 'A / ×' }, 'the keyboard: its numbers');
    // a pad picked up mid-conversation: published again, its badge
    classes.add('controller');
    d.update(1 / 30);
    assert.equal(screen.state.dialogue.answerKey.kind, 'pad');
    // the engines print it as the pad in hand does (engine/unity/game.js forPad: promptText over the state's JSON)
    const json = JSON.stringify(screen.state.dialogue);
    assert.equal(JSON.parse(promptText(json, { layout: 'standard', faces: 'xbox', family: 'xbox', remap: false })).answerKey.key, 'A');
    assert.equal(JSON.parse(promptText(json, { layout: 'standard', faces: 'xbox', family: 'playstation', remap: false })).answerKey.key, '×');
    classes.clear(); classes.add('touch');
    d.update(1 / 30);
    assert.equal(screen.state.dialogue.answerKey.kind, 'touch');
    d.close?.();
  } finally {
    if (had === undefined) delete globalThis.document; else globalThis.document = had;
  }
});

test('BridgeHud draws the answers\' mark from it: the badge on the picked answer with a pad, › else, the number on keys', () => {
  const cs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs', import.meta.url), 'utf8');
  const talk = cs.slice(cs.indexOf('void DrawTalk('), cs.indexOf('Ui.Place(dlg, W / 2 - pw / 2'));
  assert.match(talk, /d\.O\("answerKey"\)/);
  assert.match(talk, /kind == "pad" && i == sel/, 'the badge on the answer the pad would pick');
  assert.match(talk, /MakeBadge\(box\.rt/, 'drawn as the page\'s .key badge');
  assert.match(talk, /"›"/, 'a mark on the others and on a touch screen');
  assert.match(talk, /\(i \+ 1\)\.ToString\(\)/, 'the keyboard\'s number');
});
