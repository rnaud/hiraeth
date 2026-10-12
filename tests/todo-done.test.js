// TODO.md is open work only (issue #123): an item whose issue closed moves to DONE.md, ticked, with how it closed.
// The v1.49 game audit found about 30 open items there linking closed issues; this keeps the two files apart, and
// (issue #175) checks TODO.md against the issues closed on GitHub, kept offline in tests/closed-issues.json.
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

// An issue closed on GitHub without its DONE.md line slipped through the test above (the v1.53 game audit, issue #175:
// eight items). The tests can't ask GitHub, so the closed issues' numbers are kept in tests/closed-issues.json, written
// by `node scripts/closed-issues.mjs` (run it when issues close, as the hourly issue check can): no open TODO.md item
// links one of them.
test('no open TODO.md item links an issue closed on GitHub (tests/closed-issues.json, #175)', () => {
  const { closed, refreshed } = JSON.parse(read('tests/closed-issues.json'));
  assert.ok(closed.length >= 160 && closed.includes(137) && /^\d{4}-\d\d-\d\d$/.test(refreshed), 'the list as scripts/closed-issues.mjs writes it');
  const shut = new Set(closed);
  const stale = linkedItems(read('TODO.md')).filter((i) => !i.done && shut.has(i.n));
  assert.deepEqual(stale.map((i) => i.line), [], 'closed on GitHub: move these to DONE.md, ticked, with how each closed');
});

test('TODO.md keeps no ticked item: a finished one moves to DONE.md', () => {
  assert.deepEqual(linkedItems(read('TODO.md')).filter((i) => i.done).map((i) => i.line), []);
});
