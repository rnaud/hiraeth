// The guardians' turnaround renders (scripts/guardian-renders.mjs): the in-game bodies drawn from four sides at one
// scale, the base pictures of the "from the game's model" turnaround prompts (docs/design/guardian-turnaround-prompts.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SUBJECTS, VIEWS, viewCamera, sheetLayout, parseArgs, PORT } from '../scripts/guardian-renders.mjs';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('every subject is a guardian body the game builds, and its v3 prompt draws over its render', () => {
  const doc = src('docs/design/guardian-turnaround-prompts.md');
  for (const [id, s] of Object.entries(SUBJECTS)) {
    assert.match(src(s.module.slice(1)), new RegExp(`export function ${s.build}\\(`), `${id}: ${s.module} builds ${s.build}`);
    assert.ok(doc.includes(`(\`#${id}/v3\`, \`--refs references/guardians/${id}/game-render.jpg\`)`), `${id}: its v3 prompt names its render`);
    assert.ok(existsSync(new URL(`../references/guardians/${id}/game-render.jpg`, import.meta.url)), `${id}: the render is in the repository`);
  }
});

test('the four views are the prompts\' order: front, three-quarter, side facing left, back', () => {
  assert.deepEqual(VIEWS.map((v) => v.id), ['front', 'three-quarter', 'side', 'back']);
  assert.deepEqual(VIEWS.map((v) => +(v.yaw / Math.PI).toFixed(2)), [0, 0.25, 0.5, 1]);
});

test('the camera stands level with the body\'s middle, at one distance in every view, and the body fits', () => {
  const box = { centre: [0, 4, 0], size: [7.6, 8.7, 7.6], fov: 16, aspect: 0.75 };
  const cams = VIEWS.map((v) => viewCamera(box, v.yaw));
  for (const c of cams) {
    assert.equal(c.eye[1], 4, 'level');
    assert.ok(Math.abs(c.d - cams[0].d) < 1e-9, 'one scale');
    assert.ok(Math.abs(Math.hypot(c.eye[0], c.eye[2]) - c.d) < 1e-9);
  }
  // the box's half-height and horizontal half-diagonal inside the picture even at the distance of its near side
  const rh = Math.hypot(7.6, 7.6) / 2, near = cams[0].d - rh, vHalf = (16 * Math.PI) / 360, hHalf = Math.atan(Math.tan(vHalf) * 0.75);
  assert.ok(8.7 / 2 <= near * Math.tan(vHalf), 'its height fits');
  assert.ok(rh <= near * Math.tan(hHalf), 'its width fits from any side');
  assert.equal(cams[2].eye[0] > 0, true, 'the side view from +x: the body (facing +z) faces the picture\'s left');
});

test('the sheet is one row of four equal cells; the options are checked', () => {
  const l = sheetLayout(4, 1600, 0.75);
  assert.equal(l.width, 1600); assert.equal(l.height, 533);
  assert.deepEqual(l.cells.map((c) => c.x), [0, 400, 800, 1200]);
  assert.deepEqual(parseArgs(['--out', 'x']).ids, Object.keys(SUBJECTS));
  assert.deepEqual(parseArgs(['--out', 'x', '--ids', 'listener']).ids, ['listener']);
  assert.throws(() => parseArgs(['--out', 'x', '--ids', 'nobody']), /no guardian/);
  assert.throws(() => parseArgs([]), /--out/);
  assert.notEqual(PORT, 5173, 'never the author\'s own dev server');
});
