import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { BUILD_INPUT } from '../vite.config.js';
import { DEFAULTS, cleanState, encodeState, decodeState, parseWalkers, formatWalkers, RUN_IDS } from '../src/motion/state.js';
import { course, RUNS, PAGE_RUNS, scriptFrame, runFrames } from '../src/gait-course.js';
import { traveller, drive } from './gait-sim.js';

// The Motion page (motion.html, src/motion/): the traveller's loops against motion matching, and
// the people's walks. Its URL state, its build entry, and the course and runs it shares with the
// gait harness (src/gait-course.js).

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the Motion page is a page of the build, linked from the studio and the dev menu, and loads no world', () => {
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/motion.html')), 'vite builds motion.html');
  for (const p of Object.values(BUILD_INPUT)) assert.ok(existsSync(p), p);
  assert.match(read('../motion.html'), /src="\/src\/motion\/main\.js"/);
  assert.match(read('../studio.html'), /href="\.\/motion\.html"/);
  assert.match(read('../src/dev-menu.js'), /'motion\.html'/);
  const main = read('../src/motion/main.js');
  assert.doesNotMatch(main, /levels\/index\.js|from '\.\.\/main\.js'|boot\.js/);
  // the game's own pipeline, the shared course and measures
  assert.match(main, /from '\.\.\/pipeline\.js'/);
  assert.match(main, /from '\.\.\/gait-course\.js'/);
});

test('Motion page settings round-trip through the URL; only what differs is written', () => {
  assert.equal(encodeState(DEFAULTS), '');
  const s = cleanState({ mode: 'solo', mm: true, run: 'stairs', rate: 0.25, paused: true, follow: 'both', view: 'behind', yaw: 0.4, walkers: 'library:1.1,cmu_142_07:0.6' });
  const q = encodeState(s);
  assert.match(q, /mode=solo/);
  assert.match(q, /run=stairs/);
  assert.doesNotMatch(q, /feet=/, 'defaults are left out');
  assert.deepEqual(decodeState(q), s);
  assert.equal(decodeState(q).rate, 0.25);
  assert.equal(decodeState(q).mm, true);
  // junk is dropped or put back to the default
  const junk = decodeState('?mode=dance&run=nowhere&rate=3&follow=up&zoom=99&nonsense=1&mm=0');
  assert.equal(junk.mode, DEFAULTS.mode);
  assert.equal(junk.run, '');
  assert.equal(junk.rate, 1, 'only 1, 0.5 and 0.25');
  assert.equal(junk.follow, DEFAULTS.follow);
  assert.equal(junk.zoom, 6, 'clamped');
  assert.equal(junk.mm, false);
  assert.ok(!('nonsense' in junk));
});

test('the people lane: walkers as walk:speed, cleaned', () => {
  assert.deepEqual(parseWalkers('library:1.25,cmu_137_29:1.3'), [{ walk: 'library', speed: 1.25 }, { walk: 'cmu_137_29', speed: 1.3 }]);
  // a missing or silly speed, a bad name, too many
  assert.deepEqual(parseWalkers('cmu_91_29,cmu_82_10:abc,<b>:1,cmu_17_08:99'), [{ walk: 'cmu_91_29', speed: 1.25 }, { walk: 'cmu_82_10', speed: 1.25 }, { walk: 'cmu_17_08', speed: 3 }]);
  assert.equal(parseWalkers(Array(30).fill('library:1').join(',')).length, 16);
  assert.equal(formatWalkers(parseWalkers(DEFAULTS.walkers)), DEFAULTS.walkers);
  assert.equal(decodeState(`?mode=people&walkers=${encodeURIComponent('cmu_142_07:0.55,library:1.2')}`).walkers, 'cmu_142_07:0.55,library:1.2');
});

test('the page plays the harness’s runs, frame for frame as drive() steps them', () => {
  for (const name of Object.keys(RUNS)) assert.ok(PAGE_RUNS[name], name);
  for (const name of Object.values(RUN_IDS)) assert.ok(PAGE_RUNS[name], name);
  const run = PAGE_RUNS['walk → run → 180° turn → stop'];
  const n = runFrames(run);
  assert.equal(n, run.script.reduce((k, [s]) => k + Math.round(s * 60), 0));
  assert.equal(scriptFrame(run, 0).tag, 'idle');
  assert.equal(scriptFrame(run, 59).tag, 'idle');
  assert.equal(scriptFrame(run, 60).tag, 'walk');
  assert.equal(scriptFrame(run, n - 1).tag, 'stop');
  assert.ok(scriptFrame(run, n).done);
  const ss = PAGE_RUNS['start, stop, again (walk and run)'];
  assert.ok(ss.script.filter(([, , t]) => /^stop|^halt/.test(t)).length >= 5, 'starts and stops over and over');
});

test('the course’s obstacles stay out of the scripted runs’ way', async () => {
  // the same run on the course with and without the pillars and crates: the same steps
  for (const name of ['walk → run → 180° turn → stop', 'walk, 90° turn, stop', 'start, stop, again (walk and run)']) {
    const run = PAGE_RUNS[name], out = [];
    for (const obstacles of [false, true]) {
      const p = await traveller(course({ obstacles }), new THREE.Vector3(...run.at));
      const r = drive(p, run.script);
      out.push({ pos: p.pos.clone(), slide: r.maxSlide });
    }
    assert.ok(out[0].pos.distanceTo(out[1].pos) < 1e-9, `${name}: ends in the same place`);
    assert.equal(out[0].slide, out[1].slide, name);
  }
  const g = course({ obstacles: true });
  assert.ok(g.children.filter((o) => o.name === 'pillar').length >= 3);
});
