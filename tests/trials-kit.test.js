import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { LEVELS } from '../src/levels/index.js';
import { ORDER } from '../src/levels/names.js';
import { Physics } from '../src/physics.js';
import { Waters } from '../src/water.js';
import { KIT_TRIALS, kitTrialsFor } from '../src/trials/kit-data.js';
import { COURSES } from '../src/trials/kit-courses.js';
import { KitRun, outOfRun, voiceLine } from '../src/trials/kit-run.js';
import { createChallenges, trialGame } from '../src/trials/index.js';
import { TRIALS } from '../src/trials/data.js';
import { lacks } from '../src/trials/course.js';
import { recordScore, bestScore } from '../src/minigames/kit/scores.js';
import { parseLine } from '../src/story/tone.js';
import { CONTENT } from '../src/levels/content.js';
import { clearInteractables, allInteractables } from '../src/interact.js';
import { clearTargets } from '../src/targets.js';
import { clearWorkings, workingsAt } from '../src/workings.js';
import { GameState } from '../src/game-state.js';

// The makers' runs (docs/systems/challenges.md): the temples' kit stood in the open as optional challenges.
// The rules alone (src/trials/kit-run.js), then each run built in its own world with real collision and water,
// and played through as the runner would: start, the gates, the bank, a finish (its best kept, the word from
// whoever stands nearby), a fall (in the lake), and a Retry that starts clean.

const quiet = (f) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return f(); } finally { console.warn = w; console.info = i; } };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = (x, y, z) => ({ x, y, z });

test('a makers’ run: the gates in order, then the bank listens, and wakes whole to finish', () => {
  const run = new KitRun({ gates: [{ x: 0, y: 0, z: 10, r: 2 }, { x: 0, y: 0, z: 20, r: 2 }], bank: 3 });
  assert.equal(run.goal(), 'gate 1 / 2');
  assert.equal(run.wake(3, 1), null, 'the bank does not listen before the gates are walked');
  assert.equal(run.step(P(0, 0, 18), P(0, 0, 21), 1), null, 'the second gate first: nothing');
  assert.equal(run.step(P(0, 0, 8), P(0, 0, 11), 2), 'gate');
  assert.equal(run.step(P(0, 0, 18), P(0, 0, 21), 3), 'ready');
  assert.ok(run.ready && !run.done);
  assert.equal(run.goal(), 'wake the eyes 0 / 3');
  assert.equal(run.wake(2, 4), null);
  assert.equal(run.goal(), 'wake the eyes 2 / 3');
  assert.equal(run.wake(3, 5), 'finish');
  assert.ok(run.done); assert.equal(run.finishedAt, 5);
  assert.equal(run.wake(3, 6), null, 'done is done');
  // with no bank, the last gate is the line
  const walk = new KitRun({ gates: [{ x: 0, y: 0, z: 10, r: 2 }] });
  assert.equal(walk.step(P(0, 0, 8), P(0, 0, 11), 7), 'finish');
  assert.equal(walk.finishedAt, 7);
});

test('out of a makers’ run: a knockout anywhere, the water only where the run is over it', () => {
  const wet = KIT_TRIALS['kit-perdide'], dry = KIT_TRIALS['kit-desert'];
  assert.equal(outOfRun(wet, { dead: false }), '');
  assert.equal(outOfRun(wet, { swim: { t: 0 } }), 'In the water');
  assert.equal(outOfRun(wet, { inWater: { depth: 1.2 } }), 'In the water');
  assert.equal(outOfRun(wet, { inWater: { depth: 0.3 } }), '', 'wading at the shore is not a fall');
  assert.equal(outOfRun(dry, { swim: { t: 0 } }), '', 'the desert run has no lake');
  assert.equal(outOfRun(dry, { dead: true }), 'Knocked out');
});

test('the word from whoever stands nearby: first finish, the makers’ mark beaten, later runs; every line with its tone', () => {
  const v = KIT_TRIALS['kit-desert'].voice;
  assert.equal(voiceLine(v, { first: true, beaten: true }), v.first, 'the first finish says the first line, beaten or not');
  assert.equal(voiceLine(v, { beaten: true, beatenBefore: false }), v.beaten);
  assert.equal(voiceLine(v, { beaten: true, beatenBefore: true }), v.again);
  assert.equal(voiceLine(v, {}), v.again);
  assert.equal(voiceLine(null, { first: true }), null);
  for (const T of Object.values(KIT_TRIALS)) for (const k of ['first', 'beaten', 'again']) assert.ok(parseLine(T.voice[k]).explicit, `${T.id} ${k}: a tone`);
});

test('the makers’ runs: in route worlds, beside their trials, each a course of its own, someone there to speak', () => {
  assert.ok(Object.keys(KIT_TRIALS).length >= 2);
  for (const [id, T] of Object.entries(KIT_TRIALS)) {
    assert.equal(T.id, id); assert.equal(id, `kit-${T.world}`);
    assert.ok(ORDER.includes(T.world), `${id}: on the route`);
    assert.ok(TRIALS[T.world], `${id}: its world has its ride’s trial too`);
    assert.notEqual(TRIALS[T.world].id, T.id);
    assert.equal(T.mode, 'kit');
    assert.ok(COURSES[T.course], `${id}: a course called ${T.course}`);
    assert.ok(T.par > 15 && T.par < 120, `${id}: a gentle mark (${T.par} s)`);
    assert.ok(T.onFoot, `${id}: walked`);
    const people = CONTENT[T.world].npcs.filter((n) => n.id === T.voice.who);
    assert.equal(people.length, 1, `${id}: ${T.voice.who} lives in ${T.world}`);
    const def = trialGame(T, { par: T.par, session: () => ({}) });
    assert.equal(def.drives, false); assert.equal(def.score.kind, 'time'); assert.ok(def.trial);
    assert.ok(def.controls.pad.some(([b]) => b === 'RT / R2'), `${id}: the card names the pad’s splash`);
    assert.match(def.rules, /makers’ mark/);
  }
  assert.deepEqual(kitTrialsFor('desert').map((T) => T.id), ['kit-desert']);
  assert.deepEqual(kitTrialsFor('nowhere'), []);
  assert.match(lacks(KIT_TRIALS['kit-desert'], { has: () => false }), /fluid gun/);
  assert.equal(lacks(KIT_TRIALS['kit-desert'], { has: (i) => i === 'backpack' }), '');
  assert.equal(lacks(KIT_TRIALS['kit-perdide'], { has: () => false }), '', 'the Hush walk wants nothing but your feet');
});

// ------------------------------------------------------------------------------- in their worlds
const worlds = {};
function world(id) {
  if (worlds[id]) return worlds[id];
  clearInteractables(); clearTargets(); clearWorkings();
  const meta = LEVELS.find((l) => l.id === id);
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const waters = quiet(() => new Waters(scene, { physics, drops: false }));
  const surfaceAt = (x, z, y, b) => waters.surfaceAt(x, z, y, b);
  return (worlds[id] = { scene, level, physics, surfaceAt });
}

/** A traveller as the session sees one: placed by standAt (respawn), moved by the test. */
function traveller() {
  return { pos: V(0, 0, 0), vel: V(0, 0, 0), heading: 0, health: 1, dead: false, down: null, respawn(p) { this.pos.copy(p); this.vel.set(0, 0, 0); } };
}
/** What the runner gives a session (src/minigames/kit/runner.js makeCtx), enough for a run. */
function runnerCtx(player) {
  return {
    player, rig: null, phase: 'play', time: 0, result: null, said: [], status(s) { this.st = s; }, flash(s) { this.said.push(s); },
    sfx: { checkpoint() {}, finish() {} }, add() {}, finish(r) { this.result = r; },
  };
}
/** Walk the traveller from where he is to p in small steps, a frame each. */
function walk(sess, ctx, player, p, step = 0.5) {
  const from = player.pos.clone(), d = from.distanceTo(p), n = Math.max(1, Math.ceil(d / step));
  for (let i = 1; i <= n && !ctx.result; i++) { player.pos.lerpVectors(from, p, i / n); ctx.time += step / 5; sess.update(1 / 60, {}, { live: true, phase: 'play' }); }
}

for (const T of Object.values(KIT_TRIALS)) {
  test(`${T.id}: the ${T.name.toLowerCase()} stands in ${T.world}, fair, and plays start to finish`, () => {
    const { scene, physics, surfaceAt } = world(T.world);
    const game = new GameState();
    const items = { has: () => true, grant() {} };
    const player = traveller();
    const pell = { def: { id: T.voice.who }, time: 10, shout: null };
    const C = createChallenges({ levelId: T.world, scene, physics, player, items, game, surfaceAt, npcs: [pell] });
    assert.equal(C.list.length, 2, 'its ride’s trial and its makers’ run');
    const W = C.byId(T.id);
    const course = W.course;
    assert.ok(allInteractables().some((e) => e.id === `trial.${T.id}`), 'its sign opens its card');
    assert.ok(allInteractables().some((e) => e.id === `trial.${T.world}`), 'and the ride’s trial is still there');
    // the sign on the ground, a few steps from the start, outside the course
    const g = physics.groundAt(W.sign.position.x, W.sign.position.y + 2, W.sign.position.z, 4);
    assert.ok(Math.abs(g - W.sign.position.y) < 0.3, `the sign stands on something (${g.toFixed(2)} vs ${W.sign.position.y.toFixed(2)})`);
    assert.ok(W.sign.position.distanceTo(W.start) < 12, 'a step from the start');
    // the start and every gate stand over the course's floor (y: the floor and the gate's height over it)
    const floorAt = (p) => physics.groundAt(p.x, p.y + 0.5, p.z, 4);
    assert.ok(Math.abs(floorAt(W.start) - W.start.y) < 0.35, `the start on the floor (${floorAt(W.start).toFixed(2)} vs ${W.start.y.toFixed(2)})`);
    for (const [i, gt] of W.gates.entries()) {
      const f = physics.groundAt(gt.x, gt.y, gt.z, 6);
      assert.ok(gt.y - f > 1 && gt.y - f < 2.6, `gate ${i + 1}: over the floor (${(gt.y - f).toFixed(2)} m)`);
      if (T.wet) assert.ok(!(surfaceAt(gt.x, gt.z, gt.y, 10)?.y > f), `gate ${i + 1}: dry`);
    }
    // nobody of the world's own stands in it
    for (const n of CONTENT[T.world].npcs) {
      const [x, z] = n.at.length === 2 ? n.at : [n.at[0], n.at[2]];
      assert.ok(!course.contains(V(x, course.start.y + 1, z)), `${n.id ?? 'someone'} is not standing in the course`);
    }
    // its pieces are the world's workings (the foes feel them): the hall's gust, the causeway's crystals
    if (course.gusts.length) assert.ok(workingsAt(course.kit.world(0, 1, 20), 'gust').length >= 1, 'the gust is a working');
    if (course.swings.length) assert.equal(course.swings.length, 3);

    // ---- start
    const ctx = runnerCtx(player);
    let sess = W.session(ctx);
    assert.ok(W.running, 'a run is on');
    assert.ok(player.pos.distanceTo(W.start) < 0.01, 'the traveller at the start');
    sess.update(1 / 60, {}, { live: true, phase: 'play' });
    assert.equal(ctx.st, `gate 1 / ${W.gates.length}`, 'the goal under the clock');
    // ---- a fall (the Hush walk: knocked into the lake), or a knockout (the hall)
    if (T.wet) { player.swim = { t: 0 }; sess.update(1 / 60, {}, { live: true, phase: 'play' }); assert.equal(ctx.result?.failed, true); assert.equal(ctx.result.title, 'In the water'); player.swim = null; }
    else { player.dead = true; sess.update(1 / 60, {}, { live: true, phase: 'play' }); assert.equal(ctx.result?.title, 'Knocked out'); player.dead = false; }
    assert.equal(W.done(), false, 'a fall finishes nothing');
    // ---- Retry: a clean run
    sess.end(); assert.equal(W.running, null);
    ctx.result = null; ctx.time = 0;
    sess = W.session(ctx);
    sess.update(1 / 60, {}, { live: true, phase: 'play' });
    assert.equal(ctx.st, `gate 1 / ${W.gates.length}`, 'from the first gate again');
    // ---- through the gates (the bank does not listen until the last)
    if (course.bank) {
      for (const i of [0, 1, 2]) course.bank.hit(i);
      assert.equal(course.bank.done, false, 'the eyes woken from the door: they sleep again');
      course.bank.update(5, 0);   // (and the breath passes)
    }
    for (const gt of W.gates) { walk(sess, ctx, player, V(gt.x, gt.y - 1, gt.z)); if (ctx.result) break; }
    if (course.bank) {
      assert.equal(ctx.result, null, 'the hall walked: not yet finished');
      assert.match(ctx.st, /wake the eyes/);
      assert.ok(ctx.said.some((s) => /eyes/.test(s)), 'it says so');
      course.bank.update(0.5, 0);
      for (const i of [0, 1, 2]) { course.bank.hit(i); course.bank.update(0.4, 0); }
      sess.update(1 / 60, {}, { live: true, phase: 'play' });
    }
    // ---- the finish: its lines, the word from nearby, the best kept
    assert.ok(ctx.result && !ctx.result.failed, 'finished');
    assert.match(ctx.result.lines.join(' '), /First finish/);
    assert.match(ctx.result.html, new RegExp(T.voice.name));
    assert.ok(!/~/.test(ctx.result.html), 'no tone tag on the card');
    assert.equal(pell.shout?.text, T.voice.first, `${T.voice.name} says it over their head`);
    assert.ok(W.done());
    const time = ctx.time;
    assert.ok(time > 0);
    const kept = recordScore(game, W.game, time);   // (what the runner does with a finish)
    assert.ok(kept.first);
    assert.equal(bestScore(game, W.game), time, 'the best is in the save');
    assert.equal(W.best(), time);
    sess.end();
    // ---- a second, slower run keeps the first best and says the later line
    ctx.result = null; ctx.time = 0; pell.shout = null;
    sess = W.session(ctx);
    assert.equal(course.bank?.done ?? false, false, 'the bank dark again');
    for (const gt of W.gates) { walk(sess, ctx, player, V(gt.x, gt.y - 1, gt.z), 0.1); if (ctx.result) break; }
    if (course.bank) { course.bank.update(0.5, 0); for (const i of [0, 1, 2]) course.bank.hit(i); sess.update(1 / 60, {}, { live: true, phase: 'play' }); }
    assert.ok(ctx.result && !ctx.result.failed);
    assert.ok(!/First finish/.test(ctx.result.lines.join(' ')));
    assert.ok([T.voice.again, T.voice.beaten].includes(pell.shout?.text));
    recordScore(game, W.game, ctx.time);
    assert.equal(bestScore(game, W.game), Math.min(time, ctx.time));
    sess.end();
    C.dispose();
    assert.ok(!allInteractables().some((e) => e.id === `trial.${T.id}`), 'disposed: its sign is gone');
  });
}

test('the wind hall: the gust shoves you back down the hall in the open, never behind a screen', () => {
  const { scene, physics } = world('desert');
  const C = createChallenges({ levelId: 'desert', scene, physics, player: traveller(), items: { has: () => true }, game: new GameState(), kits: [KIT_TRIALS['kit-desert']], trials: {} });
  const course = C.list[0].course, gust = course.gusts[0], K = course.kit;
  // a way past every screen at walking height, and the screens and walls stop a walker
  for (const z of [9, 18, 27, 36]) {
    let open = 0;
    for (let x = -3.3; x <= 3.3; x += 0.2) { const p = K.world(x, 1.1, z - 1); if (physics.rayDistance(p, K.world(0, 0, 1).sub(K.world(0, 0, 0)), 2) >= 2) open++; }
    assert.ok(open * 0.2 >= 2.2 && open * 0.2 <= 3.4, `screen at ${z}: a way past it ${(open * 0.2).toFixed(1)} m wide`);
  }
  const out = K.world(-3.2, 1.2, 20), side = K.world(-1, 0, 0).sub(K.world(0, 0, 0));
  assert.ok(physics.rayDistance(out, side, 6) < 1, 'the wall stops you');
  // the gust: shoved in the open, calm in a lee
  const pl = { pos: K.world(1, 0, 20), vel: V(0, 0, 0), dead: false };
  course.rt.player = pl;
  gust.t = gust.calm + 0.1;   // (blowing)
  gust.update(0);
  const back = K.world(0, 0, -1).sub(K.world(0, 0, 0));
  assert.ok(pl.vel.dot(back) > 5, `shoved back toward the door (${pl.vel.dot(back).toFixed(1)} m/s)`);
  const lee = { pos: K.world(2, 0, 17), vel: V(0, 0, 0), dead: false };
  course.rt.player = lee;
  gust.update(0);
  assert.equal(lee.vel.length(), 0, 'behind the screen: calm');
  C.dispose();
});

test('the Hush walk: a crystal knocks you off the causeway; a stilling burst stops it', () => {
  const { scene, physics } = world('perdide');
  const C = createChallenges({ levelId: 'perdide', scene, physics, player: traveller(), items: { has: () => true }, game: new GameState(), kits: [KIT_TRIALS['kit-perdide']], trials: {} });
  const course = C.list[0].course, s = course.swings[0];
  let knocked = null;
  const pl = { pos: V(), vel: V(), health: 1, dead: false, down: null, knockDown(v) { knocked = v.clone(); }, hurt() {} };
  course.rt.player = pl;
  // stand where the crystal will be, and let it come
  for (let i = 0; i < 400 && !knocked; i++) { s.update(1 / 60); pl.pos.set(s.center.x, s.center.y - 1.8, s.center.z); if (i < 1) continue; }
  assert.ok(knocked, 'knocked');
  assert.ok(Math.hypot(knocked.x, knocked.z) > 6, 'sideways, off the causeway');
  // stilled: it hangs there, harmless, for a while
  knocked = null;
  s.hit('stun');
  const c0 = s.center.clone();
  for (let i = 0; i < 120; i++) s.update(1 / 60);
  assert.ok(s.center.distanceTo(c0) < 1e-6, 'stilled, it does not move');
  s.cool = 0;
  pl.pos.set(s.center.x, s.center.y - 1.8, s.center.z); s.update(1 / 60);
  assert.equal(knocked, null, 'and does not knock');
  // a Retry sets it swinging again
  course.reset();
  assert.equal(s.still, 0);
  C.dispose();
});
