// The title screen's shots (src/title-shots.js): each a real world from a fixed camera framed like one
// of the covers; a different one each time the game opens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SHOTS, pickShot, shotProblems, shotCamera, shotById, chooseShot, REF_ASPECT, LAST_SHOT_KEY } from '../src/title-shots.js';
import { TITLES } from '../src/levels/names.js';
import { mulberry32 } from '../src/noise.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('every shot is complete: a known world, a camera, a cover that exists', () => {
  assert.ok(SHOTS.length >= 10, `${SHOTS.length} shots`);
  const ids = new Set();
  for (const s of SHOTS) {
    assert.deepEqual(shotProblems(s), [], s.id);
    assert.ok(!ids.has(s.id), `${s.id} twice`); ids.add(s.id);
    assert.ok(TITLES[s.level], s.level);
    assert.ok(existsSync(new URL(`../references/Title Screen/${s.ref}`, import.meta.url)), s.ref);
    assert.ok(s.ref.startsWith(s.id), `${s.id} follows ${s.ref}`);
  }
  // the world module the title builds for each of them is listed (src/title-world.js TITLE_LEVELS)
  const world = src('src/title-world.js');
  for (const level of new Set(SHOTS.map((s) => s.level))) assert.match(world, new RegExp(`\\n  ${level}: \\(\\) => import\\('\\./levels/`), level);
});

test('a broken shot is caught', () => {
  assert.ok(shotProblems({ id: 'x', level: 'nowhere', camera: { eye: [0, 0, 0], target: [0, 0, 1], fov: 50 } }).some((p) => /world/.test(p)));
  assert.ok(shotProblems({ id: 'x', level: 'desert', camera: { eye: [0, 0], target: [0, 0, 1], fov: 50 } }).includes('camera.eye'));
  assert.ok(shotProblems({ id: 'x', level: 'desert', camera: { eye: [0, 0, 0], target: [0, 0, 1], fov: 140 } }).some((p) => /fov/.test(p)));
  assert.ok(shotProblems({ id: 'x', level: 'desert', camera: { eye: [0, 0, 0], target: [0, 0, 1], fov: 50 }, traveller: { at: [1, 2] } }).includes('traveller.at'));
  assert.ok(shotProblems({ id: 'x', level: 'desert', hour: 25, camera: { eye: [0, 0, 0], target: [0, 0, 1], fov: 50 } }).some((p) => /hour/.test(p)));
  assert.deepEqual(shotProblems({ id: 'x', level: 'desert', camera: { eye: [0, 0, 0], target: [0, 0, 1], fov: 50 }, traveller: null }), []);
});

test('never the same shot twice in a row, and every shot comes up', () => {
  const rng = mulberry32(7);
  let last = null;
  const seen = new Map();
  for (let i = 0; i < 4000; i++) {
    const s = pickShot(SHOTS, { last, rng });
    assert.notEqual(s.id, last, `twice: ${s.id}`);
    seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
    last = s.id;
  }
  assert.equal(seen.size, SHOTS.length, 'all of them show');
  // one shot only: that one, again
  assert.equal(pickShot([SHOTS[0]], { last: SHOTS[0].id }).id, SHOTS[0].id);
  assert.equal(pickShot([], {}), null);
});

test('the worlds a save has reached come up more often, the others still do', () => {
  const rng = mulberry32(3), count = { reached: 0, other: 0 };
  const reached = ['desert'];
  const nDesert = SHOTS.filter((s) => s.level === 'desert').length, nOther = SHOTS.length - nDesert;
  assert.ok(nDesert > 0);
  for (let i = 0; i < 6000; i++) {
    const s = pickShot(SHOTS, { reached, rng });
    if (s.level === 'desert') count.reached++; else count.other++;
  }
  const perReached = count.reached / nDesert, perOther = count.other / nOther;
  assert.ok(perReached > perOther * 2.2 && perReached < perOther * 3.8, `${perReached.toFixed(0)} vs ${perOther.toFixed(0)}`);
});

test('the title remembers the shot it showed, and ?shot= picks one', () => {
  const title = src('src/title.js');
  assert.match(title, /chooseShot\(\{ storage: ls, search: win\.location\?\.search/);
  assert.equal(LAST_SHOT_KEY, 'moebius.title.shot');
  assert.ok(!/moebius\.s\d/.test(LAST_SHOT_KEY), 'a global key, not a save\'s');
  assert.equal(shotById(SHOTS[0].id).id, SHOTS[0].id);
  assert.equal(shotById('nope'), null);
});

test('chooseShot reads and writes the last shot and skips it; ?shot= wins and is not remembered', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const saves = [{ n: 1, empty: false, level: 'waterfall' }, { n: 2, empty: true, level: null }];
  let prev = null;
  for (let i = 0; i < 60; i++) {
    const s = chooseShot({ storage, saves });
    assert.equal(store.get(LAST_SHOT_KEY), s.id);
    assert.notEqual(s.id, prev);
    prev = s.id;
  }
  const id = SHOTS[1].id;
  assert.equal(chooseShot({ storage, search: `?shot=${id}` }).id, id);
  assert.equal(store.get(LAST_SHOT_KEY), prev, 'an asked-for shot is not remembered');
  assert.notEqual(chooseShot({ storage, search: '?shot=nope' }), null, 'an unknown id: a random one');
  // no storage (private mode): still a shot
  assert.ok(chooseShot({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } }));
});

test('the camera keeps the cover\'s framing on every screen shape', () => {
  const D = Math.PI / 180;
  for (const s of SHOTS) {
    const wide = shotCamera(s, REF_ASPECT);
    assert.equal(wide.fov, s.camera.fov, `${s.id} at 16:9 is the cover's`);
    assert.equal(shotCamera(s, 21 / 9).fov, s.camera.fov, `${s.id}: wider keeps the height`);
    // 4:3 and 16:10 keep the cover's width: the same horizontal field
    for (const a of [4 / 3, 16 / 10]) {
      const c = shotCamera(s, a);
      const h0 = Math.atan(Math.tan((s.camera.fov * D) / 2) * REF_ASPECT), h1 = Math.atan(Math.tan((c.fov * D) / 2) * a);
      assert.ok(Math.abs(h0 - h1) < 0.01 || c.fov === 88, `${s.id} at ${a.toFixed(2)}: ${(h0 / D).toFixed(1)} vs ${(h1 / D).toFixed(1)}`);
      assert.ok(c.fov >= s.camera.fov);
    }
    // upright: a framing of its own, or one derived from the cover's; sane either way
    for (const a of [375 / 812, 1080 / 2400]) {
      const c = shotCamera(s, a);
      assert.ok(c.fov > 10 && c.fov <= 90, `${s.id} portrait fov ${c.fov}`);
      assert.equal(c.eye.length, 3); assert.equal(c.target.length, 3);
      assert.ok(c.eye.every(Number.isFinite) && c.target.every(Number.isFinite));
    }
  }
});
