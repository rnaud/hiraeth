// The sequences' state streams, the engines' bundle against the web's (issue #429; engine/sequences.js, docs/systems/
// engine-bridge.md "Sequences"), shared by tests/sequences-*.test.js (the sequences dealt over three files, so the shards
// run them side by side). The web's stream is recorded in headless Chrome on the Mac (tests/sequences-web.json:
// node scripts/unity-compare/sequences.mjs web, then record); here the engines' bundle plays the same sequences in node
// and each beat's state must match it, or the difference be named in engine/bridge-stream-gaps.js STREAM_DIFFS with its issue
// (a gap), why (web only) or where (handled).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBundle, runSequence } from '../engine/sequence-run.mjs';
import { SEQUENCES, compareStreams, listedDiff, glob as sequencePattern } from '../engine/sequences.js';
import { STREAM_DIFFS, PICTURE_DIFFS, STATUSES } from '../engine/bridge-stream-gaps.js';

export const WEB = JSON.parse(readFileSync(new URL('./sequences-web.json', import.meta.url), 'utf8'));
const HOW = 'a bridge bug: fix it; a known one: name it in engine/bridge-stream-gaps.js STREAM_DIFFS (gap + issue, web-only + why, handled + where); '
  + 'the web changed on purpose: record its stream again (node scripts/unity-compare/sequences.mjs web <ids> && node scripts/unity-compare/sequences.mjs record)';

/** The sequences with `pick(seq)`, each played by the engines' bundle and held to the web's recorded stream. */
export function checkSequences(pick) {
  const ids = SEQUENCES.filter(pick).map((s) => s.id);
  let file = null;
  const found = [];
  test.before(async () => { file = await buildBundle(); });
  for (const id of ids) {
    test(`${id}: the engines show what the web shows, beat by beat`, async () => {
      assert.ok(WEB.sequences[id], `no web stream recorded for ${id} (${HOW})`);
      const eng = await runSequence(file, id);
      assert.deepEqual(eng.errors, [], `${id}: the sequence ran into errors`);
      const diffs = compareStreams({ [id]: WEB.sequences[id] }, { [id]: eng });
      found.push(...diffs);
      const unlisted = diffs.filter((d) => !listedDiff(STREAM_DIFFS, d));
      assert.equal(unlisted.length, 0, `${id}:\n  ${unlisted.map((d) => `${d.beat}: ${d.key}: web ${JSON.stringify(d.web)?.slice(0, 160)} · engines ${JSON.stringify(d.engine)?.slice(0, 160)}`).join('\n  ')}\n(${HOW})`);
    });
  }
  test('the list names nothing these sequences no longer show', () => {
    // (an entry whose sequences are all played here and that matched none of their differences: take it out)
    const stale = STREAM_DIFFS.filter((e) => {
      const of = SEQUENCES.filter((s) => sequencePattern(e.seq ?? '*').test(s.id)).map((s) => s.id);
      return of.length && of.every((s) => ids.includes(s)) && !found.some((d) => listedDiff([e], d));
    });
    assert.deepEqual(stale.map((e) => `${e.seq} ${e.beat ?? '*'} ${e.keys.join(',')}`), []);
  });
}

/** Every entry of STREAM_DIFFS and PICTURE_DIFFS well formed. */
export function checkList() {
  const bad = [];
  for (const e of STREAM_DIFFS) {
    const id = `${e.seq} ${e.keys?.join(',')}`;
    if (!e.keys?.length) bad.push(`${id}: no keys`);
    if (!STATUSES.includes(e.status)) bad.push(`${id}: status ${e.status}`);
    if (!e.what) bad.push(`${id}: no 'what'`);
    if (e.status === 'gap' && !(e.issue > 0)) bad.push(`${id}: a gap without its issue`);
    if (e.status === 'web-only' && !e.why) bad.push(`${id}: web only, not said why`);
    if (e.status === 'handled' && !e.where) bad.push(`${id}: handled, not said where`);
    if (!SEQUENCES.some((s) => sequencePattern(e.seq ?? '*').test(s.id))) bad.push(`${id}: no such sequence`);
  }
  for (const e of PICTURE_DIFFS) {
    if (!e.what || !(e.issue > 0)) bad.push(`picture ${e.seq}: its what and its issue`);
    if (e.status != null && (e.status !== 'handled' || !e.where)) bad.push(`picture ${e.seq}: status is 'handled' with its where, or none (a gap)`);
    if (!SEQUENCES.some((s) => sequencePattern(e.seq).test(s.id))) bad.push(`picture ${e.seq}: no such sequence`);
  }
  return bad;
}
