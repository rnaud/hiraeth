// Every guardian's blow lands on its body (issue #558; #319 made it so in v1.71, and nothing kept it: by v1.87 the
// Gardener's, the Listener's, the Foreman's, the Tooth-Warden's and the Last Founder's blows landed 1.6-2.7 m past their
// bodies, a sweep's frame widening every sphere of the arm all round). Each guardian in its own temple, each move at its
// strike at 60 frames a second: the floor its hit takes (Guardian.wouldHit) against the floor its posed mesh and its drawn
// blow sweep at a traveller's height, the combat review's own measure (scripts/combat-review/reach.mjs; the skill's
// guardian.mjs reports it): no more than 15 % of a hit more than 1 m from its body, none more than 1.5 m.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageGuardian, hitboxes, reachFails } from '../scripts/combat-review/reach.mjs';
import { GUARDIANS } from '../src/arena-guardians.js';

test('every guardian’s blows land on its body: at most 15 % of a hit over 1 m from it, none over 1.5 m', async () => {
  const fails = [];
  for (const G of GUARDIANS) {
    const S = await stageGuardian(G);
    const rows = hitboxes(S);
    assert.ok(rows.some((r) => r.hit), `${G.id}: none of its moves hit anything (the measure found no blow)`);
    for (const f of reachFails(rows)) fails.push(`${G.name} (${S.where}): ${f}`);
    S.rt?.dispose?.();
  }
  assert.deepEqual(fails, []);
});
