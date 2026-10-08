// The shooting gallery (src/minigames/gallery.js, docs/systems/minigames.md): the combo, the score of
// every kind of target, the shots that miss, the director's minute, the keeper's toned lines; and the kit
// for the games played on foot (src/minigames/kit/onfoot.js: the lent tank, the tunings put back).
import test from 'node:test';
import assert from 'node:assert/strict';
import gallery, { GALLERY, comboMult, newRun, scoreHit, ShotLedger, GalleryDirector, galleryPlan, swing, KEEPER_LINES, STAND } from '../src/minigames/gallery.js';
import { lendTool, tune } from '../src/minigames/kit/onfoot.js';
import { checkGame } from '../src/minigames/index.js';
import { parseLine } from '../src/story/tone.js';
import { mulberry32 } from '../src/noise.js';

test('the gallery is a complete game, played on foot, a minute on a countdown', () => {
  assert.deepEqual(checkGame(gallery), []);
  assert.equal(gallery.drives, false);
  assert.equal(gallery.hud.countdown, GALLERY.time);
  assert.equal(gallery.score.kind, 'points');
  for (const k of ['pad', 'keys']) assert.ok(gallery.controls[k].some(([b]) => /LT \/ L2|Right mouse/.test(b)), `${k}: the aim is listed`);
  assert.ok(gallery.controls.pad.some(([b]) => b === 'RT / R2'));
});

test('the multiplier: ×1 for three hits, then a step every three, up to ×5', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 12, 40].map((s) => comboMult(s)), [1, 1, 1, 2, 2, 3, 4, 5, 5]);
});

test('hits in a row pay more; a miss ends the run; a friend costs 50 and ends it too', () => {
  const run = newRun();
  const pts = [];
  for (let i = 0; i < 7; i++) pts.push(scoreHit(run, 'rail').points);
  assert.deepEqual(pts, [10, 10, 10, 20, 20, 20, 30]);
  assert.equal(run.streak, 7);
  assert.equal(run.maxMult, 3);
  const up = scoreHit(run, 'popup');
  assert.equal(up.points, 25 * 3);
  assert.equal(scoreHit(newRun(), 'gold').points, GALLERY.points.gold);
  const m = scoreHit(run, 'miss');
  assert.equal(m.broke, true, 'a miss after a run of hits says the combo broke');
  assert.equal(run.streak, 0);
  assert.equal(run.bestStreak, 8);
  const before = run.score;
  const f = scoreHit(run, 'friend');
  assert.equal(f.points, GALLERY.points.friend);
  assert.equal(run.score, before + GALLERY.points.friend);
  assert.equal(run.friends, 1);
  // never below nothing
  const poor = newRun();
  scoreHit(poor, 'friend');
  assert.equal(poor.score, 0);
  // the counts
  const c = newRun();
  for (const k of ['bell', 'plate', 'gold', 'fast']) scoreHit(c, k);
  assert.deepEqual([c.bells, c.plates, c.golds, c.hits], [1, 1, 1, 4]);
});

test('a shot is a hit if a target takes it in time, a miss once its life is out', () => {
  const L = new ShotLedger(1.5);
  L.fired(0); L.fired(0.3); L.fired(0.6);
  assert.equal(L.hit(), true);         // (the first shot found a target)
  assert.equal(L.update(1.0), 0);
  assert.equal(L.update(1.85), 1);     // (the second: out 1.55 s, a miss)
  assert.equal(L.update(3), 1);
  assert.equal(L.hit(), false, 'no shot in flight: not counted');
});

test('the director: a busy minute, busier at the end, golds and friends among the targets, one figure a slot', () => {
  const D = new GalleryDirector(mulberry32(7));
  const seen = { rail: 0, gold: 0, popup: 0, friend: 0, late: 0, early: 0 };
  const upTill = [0, 0, 0, 0];
  for (let i = 0; i < 60 * 60; i++) {
    const t = i / 60;
    for (const e of D.step(1 / 60)) {
      if (e.kind === 'rail') seen.rail++;
      if (e.gold) seen.gold++;
      if (e.friend) seen.friend++;
      if (e.kind === 'popup') {
        seen.popup++;
        assert.ok(t >= upTill[e.slot] - 1e-6, `slot ${e.slot} is free at ${t.toFixed(2)}`);
        upTill[e.slot] = t + e.up;
        assert.ok(['blot', 'auntie', 'cat'].includes(e.shape));
        assert.equal(e.friend, e.shape !== 'blot');
      }
      if (t < 20) seen.early++; else if (t > 40) seen.late++;
    }
  }
  assert.ok(seen.rail > 40 && seen.rail < 120, `rail ${seen.rail}`);
  assert.ok(seen.popup > 25 && seen.popup < 80, `popups ${seen.popup}`);
  assert.ok(seen.gold >= 6, `golds ${seen.gold}`);
  assert.ok(seen.friend >= 5 && seen.friend < seen.popup * 0.6, `friends ${seen.friend}`);
  assert.ok(seen.late > seen.early * 1.3, `busier at the end (${seen.early} → ${seen.late})`);
  const P0 = galleryPlan(0), P1 = galleryPlan(55);
  assert.ok(P1.popUp < P0.popUp && P1.railEvery[0] < P0.railEvery[0] && P1.last && !P0.last);
});

test('the bells swing as pendulums', () => {
  assert.equal(swing(0, 0.3), 0);
  assert.ok(Math.abs(swing(0.6, 0.3, 2.4) - 0.3) < 1e-9);
  assert.ok(Math.abs(swing(1.8, 0.3, 2.4) + 0.3) < 1e-9);
});

test('every one of the keeper’s lines carries a tone', () => {
  for (const [k, list] of Object.entries(KEEPER_LINES)) {
    assert.ok(list.length, k);
    for (const l of list) assert.ok(parseLine(l).explicit, `${k}: ${l}`);
  }
  assert.ok(STAND.z[0] > 0.9, 'the traveller stands behind the counter');
});

test('the tank lent for a game: worn, full, its size held against the save’s upgrades, all put back after', () => {
  const owned = new Set(['stun']);
  const items = { has: (id) => owned.has(id), on: () => () => {}, owned: () => [...owned] };
  const R = { max: 3, delay: 2, level: 1, fill() { this.level = this.max; } };
  // (as the FluidTool: its getters on the prototype)
  const proto = { get dry() { return true; }, get modes() { return this.items.has('backpack') ? ['shoot', 'stun'] : []; }, shimmer() { this.shimmered = true; } };
  const tool = Object.assign(Object.create(proto), { items, reserve: R, mode: 'stun', enabled: false });
  const back = lendTool(tool, { max: 6, delay: 1 });
  assert.equal(tool.items.has('backpack'), true);
  assert.equal(tool.items.has('stun'), true);
  assert.equal(tool.dry, false);
  assert.equal(tool.enabled, true);
  assert.equal(tool.mode, 'shoot');
  assert.equal(tool.shimmered, true);
  assert.equal(R.level, 6);
  R.max = 4; R.delay = 3;   // (the save's tank upgrades, every frame: src/boxes/effects.js)
  assert.deepEqual([R.max, R.delay], [6, 1]);
  back.set({ max: 8 });
  assert.equal(R.max, 8);
  back();
  assert.equal(tool.items, items);
  assert.equal(tool.dry, true);
  assert.deepEqual([R.max, R.delay], [3, 2]);
  R.max = 4;
  assert.equal(R.max, 4, 'writable again');
  assert.equal(tool.enabled, false);
  // tune: fields changed and put back
  const T = { a: 1, b: [1, 2] };
  const undo = tune(T, { a: 5, b: [3] });
  assert.deepEqual(T, { a: 5, b: [3] });
  undo();
  assert.deepEqual(T, { a: 1, b: [1, 2] });
});
