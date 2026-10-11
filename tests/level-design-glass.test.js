// The level design audit sees through glass (scripts/level-design/audit.mjs: every mesh with the glass look, materials.js
// S_GLASS, left out of the sight rays' collision): the Underwater City's domes and tubes hid nothing and stood in the way
// of every ray, so it scored 2 on landmarks with its great column in sight from every hall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the Underwater City: its column and towers are seen through the glass from the landing and along the path', () => {
  const out = mkdtempSync(join(tmpdir(), 'level-glass-'));
  try {
    const r = spawnSync(process.execPath, ['scripts/level-design/audit.mjs', out, '--worlds', 'underwater'], { encoding: 'utf8', timeout: 180000 });
    assert.equal(r.status, 0, r.stderr.slice(-400));
    const w = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8')).worlds[0];
    assert.ok(w.metrics.landmarks.fromSpawn >= 1, `${w.metrics.landmarks.fromSpawn} landmarks from the landing`);
    assert.ok(w.metrics.landmarks.seenShare >= 0.9, `${Math.round(w.metrics.landmarks.seenShare * 100)} % of the path sees one`);
    assert.ok(w.scores.criteria.landmarks.score >= 4, w.scores.criteria.landmarks.from);
  } finally { rmSync(out, { recursive: true, force: true }); }
});
