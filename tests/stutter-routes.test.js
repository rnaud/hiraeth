// The stutter harness's play routes (engine/stutter-routes.js, issue #468) played by the engines' bundle in node, as the
// Unity player plays them (-sequence <id>): every run named exists, the fight's foes come and go, the traveller walks up
// the ship's ramp aboard and back out on the keys alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBundle, runSequence } from '../engine/sequence-run.mjs';
import { STUTTER_RUNS, routeById, ROUTES } from '../engine/stutter-routes.js';
import { sequenceById } from '../engine/sequences.js';

test('every run of the harness is a route or a sequence', () => {
  for (const r of STUTTER_RUNS) assert.ok(routeById(r.id) ?? sequenceById(r.id), r.id);
  for (const r of ROUTES) assert.ok(!sequenceById(r.id), `${r.id}: not a sequence's id (those are compared with the web's stream)`);
});

let file;
const bundle = async () => (file ??= await buildBundle());

test('the fight: its beats in time, no errors', { timeout: 240000 }, async () => {
  const r = await runSequence(await bundle(), 'route-fight');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.beats.map((b) => b.beat), routeById('route-fight').beats.map((b) => b.name));
  assert.ok(r.beats.every((b) => !b.late), r.beats.filter((b) => b.late).map((b) => b.beat).join(', '));
});

test('boarding: up the ramp into the ship and out again, walked', { timeout: 240000 }, async () => {
  const r = await runSequence(await bundle(), 'route-board');
  assert.deepEqual(r.errors, []);
  const at = Object.fromEntries(r.beats.map((b) => [b.beat, b]));
  assert.ok(!at.board.late && !at.out.late, 'both walks arrive');
  // (aboard: up on the ship's deck, ~6 m over the ramp's foot; out: back down past the foot)
  assert.ok(at.aboard.player[1] - at.settle.player[1] > 4, `aboard at ${at.aboard.player}`);
  assert.ok(at.outside.player[1] < at.aboard.player[1] - 4, `outside at ${at.outside.player}`);
});
