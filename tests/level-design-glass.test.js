// The level design audit sees through glass (scripts/level-design/audit.mjs: every mesh with the glass look, materials.js
// S_GLASS, left out of the sight rays' collision): the Underwater City's domes and tubes hid nothing and stood in the way
// of every ray, so it scored 2 on landmarks with its great column in sight from every hall.
import test from 'node:test';
import assert from 'node:assert/strict';
import {measureWorlds} from '../scripts/level-design/measure.mjs';

test('the Underwater City: its column and towers are seen through the glass from the landing and along the path', async () => {
  const {report}=await measureWorlds({worlds:['underwater']});
  const w=report.worlds[0];
  assert.ok(w.metrics.landmarks.fromSpawn >= 1, `${w.metrics.landmarks.fromSpawn} landmarks from the landing`);
  assert.ok(w.metrics.landmarks.seenShare >= 0.9, `${Math.round(w.metrics.landmarks.seenShare * 100)} % of the path sees one`);
  assert.ok(w.scores.criteria.landmarks.score >= 4, w.scores.criteria.landmarks.from);
});
