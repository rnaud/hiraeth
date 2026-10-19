// Issue #429 (bridge parity 2: sequences, not stills): a box, the ship's arrival and takeoff, the Start menu's pages, a
// fight, a makers' temple, a fight temple's first wave, two minigames and a conversation, the engines' bundle held to the
// web's recorded stream beat by beat; and the harness itself. tests/sequences-check.js; docs/systems/engine-bridge.md,
// "Sequences".
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSequences, checkList } from './sequences-check.js';
import { SEQUENCES, SequenceRun, compareBeat, compareStreams, listedDiff, webQuery } from '../engine/sequences.js';
import { loadBundle } from '../engine/vm-run.mjs';
import { SEED } from '../engine/sequence-run.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tempDir, removeTemp } from '../scripts/temp-dirs.mjs';

checkSequences((s) => !s.id.startsWith('moment-') && s.id !== 'opening' && s.id !== 'hold');   // (the hold: tests/sequences-ship.test.js)

test('every entry of the sequences\' list says its status, why or where, and a gap its issue', () => assert.deepEqual(checkList(), []));

test('the sequences cover what issue #429 asks for', () => {
  const ids = new Set(SEQUENCES.map((s) => s.id));
  for (const id of ['opening', 'box', 'arrival', 'takeoff', 'menus', 'house-map', 'fight', 'temple', 'fight-temple', 'talk']) assert.ok(ids.has(id), id);
  assert.ok(SEQUENCES.filter((s) => s.id.startsWith('game-')).length >= 2, 'two minigames');
  assert.ok(SEQUENCES.filter((s) => s.id.startsWith('moment-')).length >= 17, 'every world\'s moment');
  for (const s of SEQUENCES) assert.equal(new Set(s.beats.map((b) => b.name)).size, s.beats.length, `${s.id}: its beats' names are its pictures' names`);
  assert.equal(webQuery({ level: 'desert', game: 'rings' }), '?level=desert&game=rings&from=desert');
});

test('the engines\' VM seeded: its Math.random one fixed run each time, node\'s own left alone (issue #454)', () => {
  const dir = tempDir('hiraeth-seed-');
  try {
    const file = join(dir, 'b.js');
    writeFileSync(file, 'module.exports = { draw: () => [Math.random(), Math.random(), Math.random()] };');
    const host = Math.random;
    const draw = (seed) => [...loadBundle(file, {}, {}, { seed }).exports.draw()];   // (the VM's array, as one of node's)
    const a = draw(454);
    assert.deepEqual(draw(454), a);
    assert.notDeepEqual(draw(7), a);
    assert.ok(a.every((x) => x >= 0 && x < 1));
    assert.equal(Math.random, host);
    assert.equal(SEED, 454);
  } finally { removeTemp(dir); }
});

test('a beat: its act, its keys pressed and let go, its condition, its wait, then recorded (late when the condition never came)', () => {
  const G = { n: 0 };
  const seq = { id: 'x', beats: [
    { name: 'a', act: (g) => { g.n = 1; }, keys: ['KeyE'], until: (g) => g.n >= 1, wait: 0.2 },
    { name: 'b', until: () => false, timeout: 0.5 },
  ] };
  const run = new SequenceRun(G, seq), seen = [];
  for (let i = 0; i < 100; i++) {
    const r = run.tick(0.05);
    if (r) seen.push(r.keys ? r.keys.map(([c, d]) => `${c}${d ? '↓' : '↑'}`).join() : r.record ? `${r.record.name}${r.late ? ' late' : ''}` : 'done');
    if (r?.done) break;
  }
  assert.deepEqual(seen, ['KeyE↓', 'KeyE↑', 'a', 'b late', 'done']);
  assert.equal(G.n, 1);
});

test('two beats\' states against each other: the parts, the menu, what plays, the kinds in view, the camera; and the list', () => {
  const base = { hud: { cue: 'Golden dunes', prompt: { text: 'talk to Teo', key: 'E' } }, menu: null, playing: null, objects: { ink: 10, holo: 1 }, cam: [0, 0, 0, 50], player: [0, 0, 0] };
  const eng = { ...base, hud: { prompt: { text: 'talk', key: 'E' }, lock: true }, objects: { ink: 3 }, cam: [5, 0, 0, 50] };
  const keys = compareBeat(base, eng).map((d) => d.key).sort();
  assert.deepEqual(keys, ['cam', 'obj-:holo', 'part+:lock', 'part-:cue', 'part~:prompt']);
  const d = compareStreams({ s: { beats: [{ beat: 'a', ...base }] } }, { s: { beats: [{ beat: 'a', ...eng }] } });
  assert.equal(d.length, 5);
  assert.ok(listedDiff([{ seq: 's', keys: ['part+:*'] }], d.find((x) => x.key === 'part+:lock')));
  assert.equal(listedDiff([{ seq: 't*', keys: ['part+:*'] }], d.find((x) => x.key === 'part+:lock')), null);
});
