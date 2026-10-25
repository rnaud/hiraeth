import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { questMark } from '../src/quest-mark.js';
import { questMark as legacyQuestMark } from '../src/hint-look.js';
import { screen } from '../src/platform.js';

test('the semantic category helper retains its public identity and existing label rules', () => {
  assert.equal(legacyQuestMark, questMark);
  assert.equal(questMark(), '◆');
  for (const head of ['New quest', 'Quest complete', '', null]) assert.equal(questMark(head), '◆');
  for (const head of ['New errand', 'ERRAND COMPLETE', 'An errand received']) assert.equal(questMark(head), '◇');
});

test('actual platform toasts retain category metadata and hidden automatic steps', t => {
  t.after(() => screen.reset());
  screen.toast('Parcel', 5, { kind: 'quest', head: 'New errand', title: 'Parcel', step: 'Do not reveal this' });
  const first = screen.state.toast;
  assert.deepEqual({ ...first, id: 0 }, { text: 'Parcel', secs: 5, id: 0, kind: 'quest', mark: '◇', head: 'New errand', title: 'Parcel', step: '' });
  screen.toast('A room', 4, { kind: 'quest', title: 'A room' });
  assert.equal(screen.state.toast.mark, '◆');
  assert.equal(screen.state.toast.head, 'New quest');
  assert.equal(screen.state.toast.step, '');
  assert.ok(screen.state.toast.id > first.id);
  screen.toast('Found a key', 3);
  assert.deepEqual(Object.keys(screen.state.toast).sort(), ['id', 'secs', 'text']);
});

test('shared platform category semantics do not import the visual hint palette', () => {
  const source = readFileSync(new URL('../src/platform.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:from\s*|import\s*\()(['"])[^'"]*hint-look\.js\1/);
});
