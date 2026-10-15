import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MARK_CANDIDATES, candidateGeometry, reviewMark, activeMark } from '../src/makers-mark/candidates.js';
import { glyphGeometry } from '../src/story/sign-text.js';
import { reviewStorage } from '../src/cinematics-page/storage.js';

test('option 4 is the live glyph; alternatives require an explicit review URL', () => {
  assert.equal(reviewMark('?mark=listening'), null);
  assert.equal(reviewMark('?markReview=1&mark=unknown'), null);
  assert.equal(reviewMark('?markReview=1&mark=current'), null);
  assert.equal(reviewMark('?markReview=1&mark=listening'), 'listening');
  assert.equal(activeMark(''), 'corner');
  assert.equal(activeMark('?mark=listening'), 'corner');
  assert.equal(activeMark('?markReview=1&mark=current'), null);
  assert.equal(activeMark('?markReview=1&mark=listening'), 'listening');
  const g = glyphGeometry(2); assert.equal(g.userData.makersMark, 'corner'); g.dispose();
});
test('all five selected silhouettes remain centred, finite and within their allotted square', () => {
  assert.equal(MARK_CANDIDATES.length, 5);
  for (const mark of MARK_CANDIDATES) for (const size of [.3, 3.5, 9]) {
    const g = candidateGeometry(mark.id, size, .08);
    assert.ok([...g.attributes.position.array, ...g.attributes.normal.array].every(Number.isFinite));
    g.computeBoundingBox(); const b = g.boundingBox, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(s.x,s.y)-size)<1e-5, mark.id);
    assert.ok(c.length()<1e-5, `${mark.id} is centred`);
    assert.ok(Math.abs(s.z-.08)<1e-6);
    assert.ok(s.x>size*.35 && s.y>size*.35);
    assert.ok(g.attributes.position.count>30); g.dispose();
  }
});
test('mark review storage is ephemeral even before save-slot initialization', () => {
  const a = reviewStorage('?markReview=1&mark=corner'); a.setItem('hiraeth.slot','3');
  assert.equal(a.getItem('hiraeth.slot'),'3');
  assert.equal(reviewStorage('?markReview=1').getItem('hiraeth.slot'),null);
  assert.equal(reviewStorage('?mark=corner'),null);
});
test('review mute is applied at audio construction, before later review staging', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url),'utf8');
  assert.match(main, /new Sound\(levelId, \{ muted:[^\n]+query\.has\('markReview'\)[^\n]+true/);
});


test('curved ink follows its surface and keeps the gap between the two strokes', async () => {
  const { markOnSurface } = await import('../src/makers-mark/surface.js');
  const g = markOnSurface(2, (x,y) => new THREE.Vector3(x,y,.2*(x*x+y*y)));
  const p=g.attributes.position;
  assert.ok(p.count>100);
  for(let i=0;i<p.count;i++) assert.ok(Math.abs(p.getZ(i)-.2*(p.getX(i)**2+p.getY(i)**2))<1e-6);
  assert.ok([...g.attributes.normal.array].every(Number.isFinite));g.dispose();
});

// The old mark (three dots over an arc) is drawn nowhere now but in the shared fallback a review URL can ask for
// (?markReview=1&mark=current): a run of three dots with a partial ring under it, in any source but the shared code.
// (The futuristic skins, src/temples/skins/, draw their own signs after their picked drawings; src/levels/dismissed/ is
// not in the game.)
test('no source draws the old dots-over-arc mark: every glyph is the shared one', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../src/', import.meta.url).pathname, files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/^(makers-mark|skins|dismissed)$/.test(f)) walk(p); } else if (p.endsWith('.js')) files.push(p); } };
  walk(root);
  // three dots in a row (x offsets -a, 0, a, or [x, y] pairs), each a disc, a cylinder seen end-on or a sphere
  const dots = /(for \(const [^)]*of |\(\[)\[\s*(\[\s*)?-[\d.]+[^\n]*?\b0\b[^\n]*?(Circle|Cylinder|Sphere)Geometry/;
  const arc = /TorusGeometry\([^\n]*Math\.PI(\s*\*\s*0?\.\d+)?\s*\)/;
  const found = [];
  for (const f of files) {
    const L = readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < L.length; i++) {
      if (!dots.test(L[i]) || !L.slice(i, i + 3).some((l) => arc.test(l))) continue;
      if (L.slice(Math.max(0, i - 3), i).some((l) => /if \(candidate\)/.test(l))) continue;   // (the review fallback)
      found.push(`${f.slice(root.length)}:${i + 1}`);
    }
  }
  assert.deepEqual(found, [], 'the old mark is still drawn here');
  // the pebble token at Home (three dots alone) is the shared mark too
  assert.doesNotMatch(readFileSync(new URL('../src/levels/home.js', import.meta.url), 'utf8'), /for \(const x of \[-0\.022, 0, 0\.022\]\)/);
});

test('the temple kit draws the shared mark along its friezes: the Greenhouse, and the Rose House’s carved one without its skin', async () => {
  const { TempleKit, templeMaterials, prep } = await import('../src/temples/kit.js');
  const { TEMPLES } = await import('../src/temples/index.js');
  const shape = (g) => { g.computeBoundingBox(); const s = g.boundingBox.getSize(new THREE.Vector3()); return [g.attributes.position.count, +(s.x / s.y).toFixed(3)]; };
  const local = (K, g) => g.clone().applyMatrix4(K.inv);
  for (const id of ['edena', 'desert']) {
    const M = templeMaterials(TEMPLES[id].def.palette);
    const K = new TempleKit(new THREE.Group(), `${id} frieze`, new THREE.Vector3(), 0, M);
    K.frieze([-9, 0], [9, 0], 5, 'n');
    const glyphs = K.batches.get(M.glyph);
    assert.equal(glyphs.length, 5, `${id}: one glyph each 4.5 m`);
    const want = shape(prep(glyphGeometry(1.0, 0.12)));
    for (const g of glyphs) assert.deepEqual(shape(local(K, g)), want, `${id}: its frieze glyphs are the shared mark`);
    if (id !== 'desert') continue;
    // the Rose House's ornament: the same mark again, smaller, carved under each lit one (no three dots, no arc)
    const carved = shape(prep(glyphGeometry(0.8, 0.02)));
    const orn = [...K.batches.values()].flat().filter((g) => !glyphs.includes(g));
    assert.equal(orn.length, 5, 'one carved mark under each glyph');
    for (const g of orn) assert.deepEqual(shape(local(K, g)), carved);
  }
});
