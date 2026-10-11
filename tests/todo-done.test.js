// TODO.md is open work only (issue #123): an item whose issue closed moves to DONE.md, ticked, with how it closed.
// The v1.49 game audit found about 30 open items there linking closed issues; this keeps the two files apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** The items of a file that link an issue: [{ done, n, line }] (an item starts "- [ ] [#n]" or "- [x] [#n]"). */
export function linkedItems(text) {
  return [...text.matchAll(/^\s*- \[([ x])\] \[#(\d+)\]/gm)].map((m) => ({ done: m[1] === 'x', n: +m[2], line: m[0].trim() }));
}

test('linkedItems reads the ticked and open items and their issues', () => {
  const items = linkedItems('- [ ] [#9](u) a\n  more\n- [x] [#22](u) b\n- [ ] no link\n  - [x] [#5](u) nested');
  assert.deepEqual(items.map(({ done, n }) => [done, n]), [[false, 9], [true, 22], [true, 5]]);
});

test('no open TODO.md item links an issue DONE.md lists as done (#123)', () => {
  const done = new Set(linkedItems(read('DONE.md')).filter((i) => i.done).map((i) => i.n));
  assert.ok(done.size >= 30, 'the items moved from TODO.md are in DONE.md');
  const stale = linkedItems(read('TODO.md')).filter((i) => done.has(i.n));
  assert.deepEqual(stale.map((i) => i.line), [], 'move these to DONE.md (or untick the DONE.md one if the issue reopened)');
});

test('TODO.md keeps no ticked item: a finished one moves to DONE.md', () => {
  assert.deepEqual(linkedItems(read('TODO.md')).filter((i) => i.done).map((i) => i.line), []);
});
