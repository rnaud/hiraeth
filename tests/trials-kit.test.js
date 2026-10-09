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
import { findShipSite, siteAvoid } from '../src/ship/sites.js';
import { R as HULL } from '../src/ship/hull.js';
import { createEchoShell, ECHO } from '../src/echo-shell.js';
import { COURTS, COURT } from '../src/finds/courts.js';

// The makers' runs (docs/systems/challenges.md): the temples' kit stood in the open as optional challenges.
// The rules alone (src/trials/kit-run.js), then each run built in its own world with real collision and water,
// and played through as the runner would: start, the gates, the bank, a finish (its best kept, the word from
// whoever stands nearby), a fall (in the lake), and a Retry that starts clean.

/** Where the one who speaks lives in a world: a person of its own (CONTENT npcs, by id), or a story local
 * (src/story/<world>-data.js LOCALS, standing on the world's spawn spots in order) → [x, z], or null. */
const STORY = { arzach: await import('../src/story/arzach-data.js'), arzach2: await import('../src/story/arzach2-data.js') };
function homeOf(world, who) {
  const npcs = CONTENT[world].npcs;
  const own = npcs.filter((n) => n.id === who);
  if (own.length === 1) return own[0].at;
  const i = (STORY[world]?.LOCALS ?? []).findIndex((d) => d.id === who);
  return i >= 0 && npcs[i] && !npcs[i].id ? npcs[i].at : null;
}

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

test('out of a makers’ run: a knockout anywhere, the water only where the run is over it, the plain only once you are up', () => {
  const wet = KIT_TRIALS['kit-perdide'], dry = KIT_TRIALS['kit-desert'], high = KIT_TRIALS['kit-arzach'];
  assert.equal(outOfRun(high, {}, { passed: 0, height: 0 }), '', 'on the plinth before the first gate: fine');
  assert.equal(outOfRun(high, {}, { passed: 1, height: 12 }), '', 'on the terrace');
  assert.equal(outOfRun(high, {}, { passed: 2, height: 6 }), '', 'on the ledge');
  assert.equal(outOfRun(high, {}, { passed: 1, height: 0.2 }), 'Down on the plain');
  assert.equal(outOfRun(high, {}), '', 'no height given: no fall');
  assert.equal(outOfRun(dry, {}, { passed: 3, height: -5 }), '', 'the hall has nothing to fall from');
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
    assert.ok(T.onFoot, `${id}: walked (or flown on the wings), never on the jets`);
    assert.ok(homeOf(T.world, T.voice.who), `${id}: ${T.voice.who} lives in ${T.world}`);
    const def = trialGame(T, { par: T.par, session: () => ({}) });
    assert.equal(def.drives, false); assert.equal(def.score.kind, 'time'); assert.ok(def.trial);
    if (!['kitwings', 'kitbell'].includes(T.controls)) assert.ok(def.controls.pad.some(([b]) => b === 'RT / R2'), `${id}: the card names the pad’s splash`);
    if (T.controls === 'kitbell') assert.ok(def.controls.pad.some(([b, what]) => b === 'Y / △' && /bell/.test(what)), `${id}: the card names the bell’s button`);
    if (T.controls === 'kitecho') assert.ok(def.controls.pad.some(([b, what]) => b === 'Y / △' && /shell/.test(what)), `${id}: the card names the shell’s button`);
    if (T.controls === 'kitwings') assert.ok(def.controls.pad.some(([b, what]) => b === 'A / ×' && /wings/.test(what)), `${id}: the card names the wings`);
    assert.match(def.rules, /makers’ mark/);
  }
  assert.deepEqual(kitTrialsFor('desert').map((T) => T.id), ['kit-desert']);
  assert.deepEqual(kitTrialsFor('nowhere'), []);
  assert.match(lacks(KIT_TRIALS['kit-desert'], { has: () => false }), /fluid gun/);
  assert.equal(lacks(KIT_TRIALS['kit-desert'], { has: (i) => i === 'backpack' }), '');
  assert.equal(lacks(KIT_TRIALS['kit-perdide'], { has: () => false }), '', 'the Hush walk wants nothing but your feet');
  assert.match(lacks(KIT_TRIALS['kit-arzach'], { has: (i) => i === 'backpack' }), /wings/);
  assert.equal(lacks(KIT_TRIALS['kit-arzach'], { has: (i) => ['backpack', 'glider'].includes(i) }), '');
  assert.match(lacks(KIT_TRIALS['kit-arzach2'], { has: (i) => i === 'backpack' }), /bell/);
  assert.equal(lacks(KIT_TRIALS['kit-arzach2'], { has: (i) => i === 'bell' }), '', 'the bell crossing wants the whistle, not the gun');
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
/**
 * Roll a makers' ball home with the fluid's push (src/temples/pieces.js Ball), as a traveller behind it would: a
 * push whenever it lies still and the tank has a charge (src/fluid-tool.js FLUID: three, all back 2 s after the
 * last use), until it rests on its plate. tank: carried from one ball to the next. → { t: seconds, pushes }
 */
function rollHome(course, R, { strength = 1, wait = 0.4, tank = { charges: 3, since: 9 } } = {}) {
  const b = R.ball, dir = b.b.clone().sub(b.a).setY(0).normalize();
  let t = 0, pushes = 0, still = 0;
  while (!R.home() && t < 90) {
    still = b.rest ? still + 1 / 60 : 0;
    tank.since += 1 / 60;
    if (tank.charges === 0 && tank.since >= 2) tank.charges = 3;
    if (b.rest && still >= wait && tank.charges > 0) { b.hit('push', dir, { strength }); pushes++; still = 0; tank.charges--; tank.since = 0; }   // (a step up behind it, and aim)
    course.update(1 / 60, t); t += 1 / 60;
  }
  return { t, pushes };
}
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
    // clear of the ship where it lands in this world (src/ship/sites.js: Vael's search put it on the plain)
    const site = findShipSite({ level: worlds[T.world].level, physics, levelId: T.world, avoid: siteAvoid({ level: worlds[T.world].level, content: CONTENT[T.world] }) });
    if (site) {
      const lo = course.kit.local(V(site.x, course.start.y, site.z));
      const [[x0, , z0], [x1, , z1]] = [[-8, 0, -10], [8, 0, 105]];
      const dx = Math.max(x0 - lo.x, 0, lo.x - x1), dz = Math.max(z0 - lo.z, 0, lo.z - z1);
      assert.ok(Math.hypot(dx, dz) > HULL + 6, `clear of the ship (${Math.hypot(dx, dz).toFixed(0)} m from the course)`);
    }
    // clear of the world's makers' court (src/finds/courts.js: its pavement, its box and the ground it keeps clear)
    const court = COURTS[T.world];
    if (court) {
      const lo = course.kit.local(V(court.at[0], course.start.y, court.at[1])), cs = course.clear.map((p) => course.kit.local(p));
      const [x0, x1] = [Math.min(...cs.map((p) => p.x)), Math.max(...cs.map((p) => p.x))], [z0, z1] = [Math.min(...cs.map((p) => p.z)), Math.max(...cs.map((p) => p.z))];
      const d = Math.hypot(Math.max(x0 - lo.x, 0, lo.x - x1), Math.max(z0 - lo.z, 0, lo.z - z1));
      assert.ok(d > COURT.clear, `clear of the makers’ court (${d.toFixed(0)} m)`);
    }
    // the one who speaks lives within earshot of it (a short walk from the course)
    const [hx, hz] = homeOf(T.world, T.voice.who);
    const near = Math.min(...[W.start, ...W.gates, W.sign.position].map((p) => Math.hypot(p.x - hx, p.z - hz)));
    assert.ok(near < 60, `${T.voice.name} lives near it (${near.toFixed(0)} m)`);
    // its pieces are the world's workings (the foes feel them): the hall's gust, the causeway's crystals
    for (const g of course.gusts) assert.ok(workingsAt(course.kit.world(...g.box.getCenter(V(0, 0, 0)).toArray()), 'gust').length >= 1, 'the gust is a working');
    if (course.swings.length) assert.equal(course.swings.length, 3);
    for (const u of course.updrafts) assert.ok(workingsAt(u.foot.clone().add(V(0, 3, 0)), 'updraft').length >= 1, 'the column is a working');

    // ---- start
    const ctx = runnerCtx(player);
    let sess = W.session(ctx);
    assert.ok(W.running, 'a run is on');
    assert.ok(player.pos.distanceTo(W.start) < 0.01, 'the traveller at the start');
    sess.update(1 / 60, {}, { live: true, phase: 'play' });
    assert.equal(ctx.st, `gate 1 / ${W.gates.length}`, 'the goal under the clock');
    // ---- a fall (the Hush walk: knocked into the lake), or a knockout (the hall)
    if (T.wet) { player.swim = { t: 0 }; sess.update(1 / 60, {}, { live: true, phase: 'play' }); assert.equal(ctx.result?.failed, true); assert.equal(ctx.result.title, 'In the water'); player.swim = null; }
    else if (T.fall) {
      // past the first gates it asks, then down on the ground under the course
      if (T.fall.after) {
        walk(sess, ctx, player, V(W.gates[0].x, W.gates[0].y - 1, W.gates[0].z));
        assert.equal(ctx.result, null, 'up there: still running');
        assert.equal(ctx.st, `gate 2 / ${W.gates.length}`);
      }
      const under = course.kit.world(0, 0, (course.gulf.from + course.gulf.to) / 2 + 0.7);
      const gy = physics.groundAt(under.x, under.y - 1.5, under.z, 30);   // (the shaft: nothing within 30 m, so a few metres down it)
      player.pos.set(under.x, Number.isFinite(gy) ? gy : under.y - 6, under.z);
      sess.update(1 / 60, {}, { live: true, phase: 'play' });
      assert.equal(ctx.result?.failed, true); assert.equal(ctx.result.title, T.fall.words);
    } else { player.dead = true; sess.update(1 / 60, {}, { live: true, phase: 'play' }); assert.equal(ctx.result?.title, 'Knocked out'); player.dead = false; }
    assert.equal(W.done(), false, 'a fall finishes nothing');
    // ---- Retry: a clean run
    sess.end(); assert.equal(W.running, null);
    ctx.result = null; ctx.time = 0;
    sess = W.session(ctx);
    sess.update(1 / 60, {}, { live: true, phase: 'play' });
    assert.equal(ctx.st, `gate 1 / ${W.gates.length}`, 'from the first gate again');
    for (const R of course.rollers) assert.ok(R.ball.t === 0 && !R.home(), 'the balls back at the heads of their grooves');
    // ---- through the gates (the bank does not listen until the last)
    if (course.bank) {
      for (const i of course.bank.eyes.keys()) course.bank.hit(i);
      assert.equal(course.bank.done, false, 'the eyes woken from the door: they sleep again');
      course.bank.update(5, 0);   // (and the breath passes)
    }
    for (const gt of W.gates) { walk(sess, ctx, player, V(gt.x, gt.y - 1, gt.z)); if (ctx.result) break; }
    if (course.bank) {
      assert.equal(ctx.result, null, 'the hall walked: not yet finished');
      assert.match(ctx.st, /wake the eyes/);
      assert.ok(ctx.said.some((s) => /eyes/.test(s)), 'it says so');
      course.bank.update(0.5, 0);
      for (const i of course.bank.eyes.keys()) { course.bank.hit(i); course.bank.update(0.4, 0); }
      sess.update(1 / 60, {}, { live: true, phase: 'play' });
    }
    if (course.rollers.length) {
      assert.equal(ctx.result, null, 'the gates passed: not yet finished');
      assert.equal(ctx.st, `${course.task.goal} 0 / ${course.rollers.length}`);
      assert.ok(ctx.said.some((s) => /plate/.test(s)), 'it says so');
      for (const [i, R] of course.rollers.entries()) {
        ctx.time += rollHome(course, R).t;
        sess.update(1 / 60, {}, { live: true, phase: 'play' });
        if (i < course.rollers.length - 1) assert.equal(ctx.st, `${course.task.goal} ${i + 1} / ${course.rollers.length}`);
      }
    }
    if (course.ears.length) {
      assert.equal(ctx.result, null, 'the gates passed: not yet finished');
      assert.equal(ctx.st, `${course.task.goal} 0 / ${course.ears.length}`);
      assert.ok(ctx.said.some((s) => /horns/.test(s)), 'it says so');
      for (const [i, E] of course.ears.entries()) {
        game.emit('echo', { pos: E.ear.at.clone(), note: E.note });   // (its note, played back from the shell beside it)
        sess.update(1 / 60, {}, { live: true, phase: 'play' });
        if (i < course.ears.length - 1) assert.equal(ctx.st, `${course.task.goal} ${i + 1} / ${course.ears.length}`);
      }
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
    if (course.bank) { course.bank.update(0.5, 0); for (const i of course.bank.eyes.keys()) course.bank.hit(i); sess.update(1 / 60, {}, { live: true, phase: 'play' }); }
    for (const R of course.rollers) { assert.ok(!R.home(), 'the balls rolled back for the new run'); ctx.time += rollHome(course, R).t; }
    for (const E of course.ears) { assert.ok(!E.lit(), 'the horns asleep again for the new run'); game.emit('echo', { pos: E.ear.at.clone(), note: E.note }); }
    if (course.rollers.length || course.ears.length) sess.update(1 / 60, {}, { live: true, phase: 'play' });
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

test('the feather leap: the column lifts open wings onto the terrace, the gusts and their lees, a gulf the wings can cross', () => {
  const { scene, physics } = world('arzach');
  const C = createChallenges({ levelId: 'arzach', scene, physics, player: traveller(), items: { has: () => true }, game: new GameState(), kits: [KIT_TRIALS['kit-arzach']], trials: {} });
  const course = C.list[0].course, K = course.kit, [up] = course.updrafts, gust = course.gusts[0];
  // the column: a gliding traveller rises in it to over the terrace's parapet, and drifts out over the terrace
  const pl = { pos: up.foot.clone().add(V(0, 2, 0)), vel: V(0, -2, 0), dead: false, gliding: true, onGround: false, glideSpeed: 11 };
  course.rt.player = pl;
  for (let i = 0; i < 60 * 8; i++) { up.update(1 / 60, i / 60); pl.pos.addScaledVector(pl.vel, 1 / 60); }
  const top = K.local(pl.pos).y;
  assert.ok(top > 12 + 1.1 + 1.5, `lifted over the parapet (${top.toFixed(1)} m up in the frame)`);
  assert.ok(up.foot.distanceTo(K.world(0, 0, 25)) < up.r + 0.6, 'the column stands against the tower’s back');
  // without the wings it only ruffles you
  const walker = { pos: up.foot.clone().add(V(0, 0.5, 0)), vel: V(0, 0, 0), dead: false, gliding: false, onGround: true };
  course.rt.player = walker; up.update(1 / 60, 0);
  assert.equal(walker.vel.y, 0, 'no wings, no lift');
  // the terrace: a floor 12 m up, a way past every screen, the parapets hold
  const fwd = K.world(0, 0, 1).sub(K.world(0, 0, 0));
  for (const z of [31.5, 37.5, 43.5]) {
    let open = 0;
    for (let x = -3.2; x <= 3.2; x += 0.2) if (physics.rayDistance(K.world(x, 13.1, z - 1), fwd, 2) >= 2) open++;
    assert.ok(open * 0.2 >= 2.2 && open * 0.2 <= 3.4, `screen at ${z}: a way past it ${(open * 0.2).toFixed(1)} m wide`);
  }
  assert.ok(physics.rayDistance(K.world(0, 12.5, 27), K.world(0, 0, -1).sub(K.world(0, 0, 0)), 4) < 3, 'the back parapet stops a shoved walker');
  assert.ok(Math.abs(physics.groundAt(...K.world(0, 13, 36).toArray(), 3) - K.world(0, 12, 36).y) < 0.05, 'the terrace floor');
  // the gust: shoved back along the terrace in the open, calm in a lee
  gust.t = gust.calm + 0.1;
  const open = { pos: K.world(-1.5, 12, 35), vel: V(0, 0, 0), dead: false };
  course.rt.player = open; gust.update(0);
  assert.ok(open.vel.dot(fwd) < -5, 'shoved back');
  const lee = { pos: K.world(-2, 12, 30), vel: V(0, 0, 0), dead: false };
  course.rt.player = lee; gust.update(0);
  assert.equal(lee.vel.length(), 0, 'behind the screen: calm');
  // the gulf: open air from the terrace's front to the ledge (nothing to stand on), and a plain glide crosses it:
  // the wings at their steady 15 m/s sink 2.4 m/s (src/player.js), so the drop leaves room to spare
  const G = course.gulf;
  for (let z = G.from + 1; z < G.to - 1; z += 2) {
    const p = K.world(0, 12, z), g = physics.groundAt(p.x, p.y, p.z, 40);
    assert.ok(K.local(V(p.x, g, p.z)).y < 3, `nothing in the gulf at ${z} (ground ${K.local(V(p.x, g, p.z)).y.toFixed(1)} m in the frame)`);
  }
  const sinks = (G.to - G.from) / 15 * 2.4 + 1;   // (and a metre for the jump before the wings open)
  assert.ok(G.drop > sinks + 0.5, `the drop (${G.drop} m) beats the glide’s sink (${sinks.toFixed(1)} m)`);
  assert.ok(Math.abs(physics.groundAt(...K.world(0, 7, 80).toArray(), 3) - K.world(0, 6, 80).y) < 0.05, 'the ledge floor');
  C.dispose();
});

test('the furnace steps: every pillar a floor a jump from the last, the grate under them, a door of four eyes', () => {
  const { scene, physics } = world('buried');
  const C = createChallenges({ levelId: 'buried', scene, physics, player: traveller(), items: { has: () => true }, game: new GameState(), kits: [KIT_TRIALS['kit-buried']], trials: {} });
  const course = C.list[0].course, K = course.kit;
  const top = (p) => physics.groundAt(p.x, p.y + 1, p.z, 3);
  // a standing jump (13 m/s up, 32 m/s² down, src/player.js) at a walk carries you about 3 m and up 2.6:
  // every gap is under 2.6 m from edge to edge and every step up under a metre
  let prev = { x: 0, y: 0, z: 6 - 1.2, r: 1.2 };   // (the start platform's front edge, as a pillar)
  for (const [i, p] of course.pillars.entries()) {
    assert.ok(Math.abs(top(p.at) - p.at.y) < 0.05, `pillar ${i + 1}: its top a floor`);
    const gap = Math.hypot(p.x - prev.x, p.z - prev.z) - p.r - prev.r;
    assert.ok(gap > 1.2 && gap < 2.6, `pillar ${i + 1}: a jump from the last (${gap.toFixed(2)} m)`);
    assert.ok(p.y - prev.y < 1, `pillar ${i + 1}: not too high a step (${(p.y - prev.y).toFixed(1)} m)`);
    prev = p;
  }
  assert.ok(37.5 - (prev.z + prev.r) < 2.6, 'and a jump from the last to the landing');
  // between the pillars: the grate, four metres down (and that ends the run)
  const g = K.world(4.5, 0, 22), f = physics.groundAt(g.x, g.y, g.z, 10);
  assert.ok(Math.abs(K.local(V(g.x, f, g.z)).y - course.gulf.floor) < 0.05, 'the grate under them');
  assert.equal(outOfRun(KIT_TRIALS['kit-buried'], {}, { passed: 0, height: course.gulf.floor, along: 22 }), 'Down on the grate');
  assert.equal(outOfRun(KIT_TRIALS['kit-buried'], {}, { passed: 0, height: -6, along: -10 }), '', 'the sand by the stair is not the furnace');
  // the door's bank: four eyes, a breath too short to splash them all on three shots and a refill
  assert.equal(course.bank.eyes.length, 4);
  assert.ok(course.bank.window <= 2.6);
  for (const e of course.bank.eyes) assert.ok(K.local(e.center).z > 45, 'on the door’s wall');
  C.dispose();
});

test('a ball rolled onto a plate (the stand-in runtime’s roller): the push rolls it along its groove, a splash only nudges it, home it holds its plate, a reset rolls it back', () => {
  const { scene, physics } = world('spheres');
  const pl = Object.assign(traveller(), { opts: {} });
  const C = createChallenges({ levelId: 'spheres', scene, physics, player: pl, items: { has: () => true }, game: new GameState(), kits: [KIT_TRIALS['kit-spheres']], trials: {} });
  const course = C.list[0].course, L = course.rt.logic, [R] = course.rollers, b = R.ball;
  const along = b.b.clone().sub(b.a).setY(0).normalize(), side = V(along.z, 0, -along.x);
  assert.equal(L.el(R.id).type, 'drum', 'the temple logic’s own drum…');
  assert.equal(L.el(L.el(R.id).plate).type, 'plate', '…and its plate');
  assert.ok(b.t === 0 && !R.home() && !L.pressed(R.plate.id), 'at the head of its groove, the plate up');
  const settle = () => { for (let i = 0; i < 60 * 20 && !b.rest; i++) course.update(1 / 60, i / 60); };
  // a push across the groove only rocks it
  b.hit('push', side, { strength: 1 }); settle();
  assert.equal(b.t, 0, 'pushed sideways: it rocks in its groove');
  // a splash nudges it on a little
  b.hit('shoot', along); settle();
  const nudged = b.t * b.len;
  assert.ok(nudged > 0.2 && nudged < 1.5, `a splash nudges it (${nudged.toFixed(2)} m)`);
  assert.ok(!R.home());
  // the push rolls it a few metres at a time, and it settles on its plate and holds it down
  const { pushes } = rollHome(course, R);
  assert.ok(R.home(), 'home');
  assert.ok(pushes >= 1 && pushes <= 3, `${pushes} pushes for ${b.len.toFixed(0)} m`);
  assert.ok(L.pressed(R.plate.id), 'the plate held down by the ball');
  assert.ok(Math.hypot(b.center.x - R.plate.pos.x, b.center.z - R.plate.pos.z) < 0.1, 'resting on it');
  // pushed back off it, and home again with a hard push: the stop past the plate throws it back and it settles
  b.hit('push', along.clone().negate(), { strength: 1 }); settle();
  assert.ok(!R.home(), 'pushed off');
  rollHome(course, R, { strength: 2 });
  assert.ok(R.home(), 'home again after a hard push');
  // a reset (a new run): back at the head of its groove, the plate up
  course.reset();
  assert.ok(b.t === 0 && b.rest && !R.home() && !L.pressed(R.plate.id), 'rolled back, the plate up');
  // the balls and plates are floors and walls for the traveller, as in a temple (src/player.js opts.dynamic)
  const solids = pl.opts.dynamic();
  for (const r of course.rollers) { assert.ok(solids.includes(r.ball), 'the ball'); assert.ok(solids.includes(r.plate), 'its plate'); }
  assert.ok(Math.abs(b.solid.topAt(b.center.x, b.center.z) - (b.center.y + b.r)) < 0.1, 'stood on, its crown is a floor');
  C.dispose();
  assert.equal(pl.opts.dynamic, undefined, 'disposed: the traveller’s solids as they were');
});

/** A run as a steady traveller plays it: walked at 5 m/s from the start through each point in turn (the gates,
 * the place behind each ball), each ball pushed home from a step behind it. → its time (s) */
function scripted(course, legs) {
  let t = 0, at = course.start.clone();
  const tank = { charges: 3, since: 9 };
  for (const leg of legs) {
    if (leg.roll) { t += rollHome(course, leg.roll, { tank, strength: 0.75 }).t; continue; }   // (pushed from a step behind it: src/fluid-tool.js push)
    const p = course.kit.world(...leg), dt = Math.hypot(p.x - at.x, p.z - at.z) / 5;
    t += dt; tank.since += dt;
    if (tank.charges === 0 && tank.since >= 2) tank.charges = 3;
    at = p;
  }
  return t;
}

test('the sphere court: a slalom round solid spheres, two white spheres rolled opposite ways home, a fair makers’ mark', () => {
  const { scene, physics } = world('spheres');
  const T = KIT_TRIALS['kit-spheres'];
  const C = createChallenges({ levelId: 'spheres', scene, physics, player: traveller(), items: { has: () => true }, game: new GameState(), kits: [T], trials: {} });
  const W = C.list[0], course = W.course, K = course.kit, [west, east] = course.rollers;
  assert.equal(course.rollers.length, 2);
  // the grooves run opposite ways to the one dais: one sphere rolled from each end
  const dirOf = (R) => K.local(R.ball.b).z - K.local(R.ball.a).z;
  assert.ok(dirOf(west) > 0 && dirOf(east) < 0, 'one rolled up the court, one down it');
  assert.ok(Math.abs(K.local(west.ball.b).z - K.local(east.ball.b).z) < 0.01, 'their plates side by side at the dais');
  for (const R of course.rollers) assert.ok(Math.abs(K.local(R.ball.a).x) - R.ball.r - 0.45 > 1, 'the middle of the court clear of the grooves');
  // the slalom: each gate beside a solid stone sphere (its crown a floor over the plinth)
  for (const [i, g] of W.gates.slice(0, 4).entries()) {
    const l = K.local(V(g.x, g.y, g.z)), s = K.world(-Math.sign(l.x) * 2.6, 0, l.z);
    assert.ok(K.local(V(s.x, physics.groundAt(s.x, s.y + 4, s.z, 5), s.z)).y > 2, `gate ${i + 1}: round a solid sphere`);
  }
  // balls rolled home before the gates are walked wait there: the last gate finishes the run
  const pl = traveller(), ctx = runnerCtx(pl);
  const sess = W.session(ctx);
  for (const R of course.rollers) rollHome(course, R);
  sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.equal(ctx.result, null, 'home early: not finished');
  for (const gt of W.gates) walk(sess, ctx, pl, V(gt.x, gt.y - 1, gt.z));
  assert.ok(ctx.result && !ctx.result.failed, 'the last gate, both home: finished');
  sess.end();
  // the makers' mark: a steady scripted run plus slack
  course.reset();
  const t = scripted(course, [[2.4, 0, 5], [-2.4, 0, 9.5], [2.4, 0, 14], [-2.4, 0, 18.5], [0, 0, 43], [3.2, 0, 42.2], { roll: east }, [-3.2, 0, 17.8], { roll: west }]);
  assert.ok(T.par > t * 1.15 && T.par < t * 1.6 + 6, `the mark ${T.par} s over a scripted ${t.toFixed(1)} s`);
  C.dispose();
});

test('the long look: three stones out over the shaft, the ball rolled out to the end, down the shaft ends it', () => {
  const { scene, physics } = world('incal');
  const T = KIT_TRIALS['kit-incal'];
  const C = createChallenges({ levelId: 'incal', scene, physics, player: traveller(), items: { has: () => true }, game: new GameState(), kits: [T], trials: {} });
  const W = C.list[0], course = W.course, K = course.kit, [R] = course.rollers;
  /** The floor under (x, z) in the course's frame, up to 60 m down (-Infinity: nothing). */
  const floor = (x, z) => { const p = K.world(x, 1, z), g = physics.groundAt(p.x, p.y, p.z, 60); return Number.isFinite(g) ? K.local(V(p.x, g, p.z)).y : -Infinity; };
  assert.ok(Math.abs(floor(2, 4)) < 0.05, 'the plinth on the rim');
  for (const z of [17, 26, 34]) for (const x of [-1.6, 1.6]) assert.ok(Math.abs(floor(x, z)) < 0.05, `the stone at ${z}`);
  assert.equal(course.gaps.length, 2);
  for (const [z0, z1] of course.gaps) {
    assert.ok(z1 - z0 > 1.2 && z1 - z0 < 2.4, `a gap a walking jump clears (${(z1 - z0).toFixed(1)} m)`);
    assert.ok(floor(1.6, (z0 + z1) / 2) < -20, `nothing under the gap but the shaft (${floor(1.6, (z0 + z1) / 2).toFixed(0)} m)`);
    assert.ok(Math.abs(floor(0, (z0 + z1) / 2)) < 0.05, 'the ball’s rail across it');
  }
  assert.ok(floor(-3, 15) < -20 && floor(3, 15) < -20, 'the first stone stands out over the drop');
  const fwd = K.world(0, 0, 1).sub(K.world(0, 0, 0));
  for (const x of [-1.4, 1.4]) assert.ok(physics.rayDistance(K.world(x, 1, -2), fwd, 35) >= 35 - 0.01, 'nothing in the way out on either side of the ball');
  // the falls: fine on the rim and on the stones, over once down the shaft
  assert.equal(outOfRun(T, {}, { passed: 0, height: -0.4, along: 5 }), '', 'on the rim');
  assert.equal(outOfRun(T, {}, { passed: 2, height: 0, along: 26 }), '', 'on a stone');
  assert.equal(outOfRun(T, {}, { passed: 1, height: -4, along: 22 }), 'Down the shaft');
  // the ball: the push rolls it the whole way out, over the gaps on its rail, onto the plate at the end
  const y0 = K.local(R.ball.center).y;
  const { pushes } = rollHome(course, R);
  assert.ok(R.home(), 'home at the end');
  assert.ok(pushes >= 4 && pushes <= 9, `${pushes} pushes for ${R.ball.len.toFixed(0)} m`);
  assert.ok(Math.abs(K.local(R.ball.center).y - y0) < 1e-6, 'level all the way');
  assert.ok(K.local(R.ball.center).z > 33, 'at the end of the balcony');
  // the makers' mark: a steady scripted run plus slack (out behind the ball, pushing as it stops)
  course.reset();
  const t = scripted(course, [[0, 0, 2.4], { roll: R }, [1.4, 0, 33]]);
  assert.ok(T.par > t * 1.15 && T.par < t * 1.6 + 6, `the mark ${T.par} s over a scripted ${t.toFixed(1)} s`);
  C.dispose();
});

test('the echo relay: stones that sing, horns that listen only in a run, each note carried from its stone to its horn in the shell', () => {
  const { scene, physics } = world('bazaar');
  const T = KIT_TRIALS['kit-bazaar'];
  const game = new GameState(), items = { has: () => true }, said = [];
  const pl = traveller();
  const C = createChallenges({ levelId: 'bazaar', scene, physics, player: pl, items, game, kits: [T], trials: {}, notice: (t) => said.push(t) });
  const W = C.list[0], course = W.course, K = course.kit, L = course.rt.logic;
  const shell = createEchoShell({ player: pl, game, items });
  const stone = (n) => course.stones.find((s) => s.note === n), ear = (n) => course.ears.find((e) => e.note === n);
  const at = (x, z) => K.world(x, 0, z);
  const play = () => { shell.update(5); return shell.play(); };
  // three notes, a stone and a horn each, the logic's own switches; every stone further from its horn than the
  // shell's earshot and the horn's reach together: each note is carried
  assert.deepEqual(course.stones.map((s) => s.note).sort(), ['high', 'low', 'mid']);
  assert.deepEqual(course.ears.map((e) => e.note).sort(), ['high', 'low', 'mid']);
  for (const E of course.ears) {
    assert.equal(L.el(E.id).type, 'switch');
    const d = stone(E.note).center.distanceTo(E.ear.at);
    assert.ok(d > ECHO.reach + E.ear.reach + 3, `the ${E.note} stone ${d.toFixed(0)} m from its horn`);
  }
  // the stones and the horns' posts are solid; the walls leave a way 4 m wide past each
  const fwd = K.world(0, 0, 1).sub(K.world(0, 0, 0));
  assert.ok(physics.rayDistance(K.world(-3.4, 1, 1), fwd, 6) < 3.5, 'a stone stops you');
  assert.ok(physics.rayDistance(K.world(4, 1, 8), fwd, 6) < 3, 'a horn’s post stops you');
  for (const [i, z] of [16, 22.5, 29].entries()) {
    let open = 0;
    for (let x = -4.8; x <= 4.8; x += 0.2) if (physics.rayDistance(K.world(x, 1.1, z - 1.2), fwd, 2.4) >= 2.4) open++;
    assert.ok(open * 0.2 >= 3.4 && open * 0.2 <= 4.6, `wall ${i + 1}: a way past it ${(open * 0.2).toFixed(1)} m wide`);
  }
  // a stone sings when splashed; the shell catches it near enough, not from the far end
  pl.pos.copy(at(0, 40));
  stone('low').sing();
  assert.equal(shell.held, null, 'out of earshot at the far end');
  pl.pos.copy(course.start);
  stone('low').sing();
  assert.equal(shell.held?.note, 'low', 'caught at the start');
  // no run on: the horn hears its own note and stays still (and says why)
  pl.pos.copy(at(0, 37));
  assert.ok(play());
  assert.equal(ear('low').lit(), false, 'no run: it stays still');
  assert.ok(said.some((s) => /start at the sign/.test(s)), 'it says to start at the sign');
  // a run: the horns listen once the walls are behind you
  const ctx = runnerCtx(pl);
  const sess = W.session(ctx);
  stone('low').sing();
  play();
  assert.equal(ear('low').lit(), false, 'from the start: too far, and not yet listening');
  for (const gt of W.gates) walk(sess, ctx, pl, V(gt.x, gt.y - 1, gt.z));
  assert.equal(ctx.st, 'wake the horns 0 / 3');
  play();
  sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.ok(ear('low').lit(), 'the low horn hears its note played back beside it');
  assert.ok(!ear('mid').lit() && ear('mid').ear.shrug > 0, 'the middle one beside it only shrugs');
  assert.equal(ctx.st, 'wake the horns 1 / 3');
  // the high stone under the arch: its horn is back at the near end, out of reach from here
  stone('high').sing();
  assert.equal(shell.held.note, 'high', 'the shell holds one note: the high one now');
  play();
  assert.ok(!ear('high').lit(), 'too far from its horn');
  walk(sess, ctx, pl, at(3.5, 15.5));
  play();
  sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.ok(ear('high').lit(), 'carried back to its horn');
  stone('mid').sing();
  assert.equal(shell.held.note, 'mid', 'the middle stone caught from the first wall');
  walk(sess, ctx, pl, at(3, 35));
  play();
  sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.ok(ctx.result && !ctx.result.failed, 'all three: finished');
  sess.end();
  // a new run: the horns asleep again
  course.reset();
  assert.ok(course.ears.every((e) => !e.lit()));
  // the makers' mark: a steady scripted run (walked at 5 m/s; half a second to aim and splash or to play, six times) plus slack
  const legs = [[3, 0, 16], [-3, 0, 22.5], [3, 0, 29], [0, 0, 37], [3, 0, 29], [-3, 0, 22.5], [3.5, 0, 15.5], [-3, 0, 22.5], [3, 0, 29], [3, 0, 35]];
  const t = scripted(course, legs) + 6 * 0.5;
  assert.ok(T.par > t * 1.15 && T.par < t * 1.6 + 6, `the mark ${T.par} s over a scripted ${t.toFixed(1)} s`);
  shell.dispose();
  C.dispose();
});

test('the vine walk: a bloom grows each seed’s vine bridge over its gap, opens the flower-door; the meadow and the wings end it', () => {
  const { scene, physics } = world('edena');
  const T = KIT_TRIALS['kit-edena'];
  const game = new GameState(), said = [];
  const pl = traveller();
  const C = createChallenges({ levelId: 'edena', scene, physics, player: pl, items: { has: () => true }, game, kits: [T], trials: {}, notice: (t) => said.push(t) });
  const W = C.list[0], course = W.course, K = course.kit, L = course.rt.logic;
  /** The floor under (x, z) in the course's frame, up to 30 m down (-Infinity: nothing). */
  const floor = (x, z) => { const p = K.world(x, 1, z), g = physics.groundAt(p.x, p.y, p.z, 30); return Number.isFinite(g) ? K.local(V(p.x, g, p.z)).y : -Infinity; };
  const fwd = K.world(0, 0, 1).sub(K.world(0, 0, 0));
  const tick = () => course.update(1 / 60, 0);
  assert.equal(course.vines.length, 3);
  // the gaps: far wider than a jump, the meadow under them below the fall line, nothing across them yet
  for (const [z0, z1] of course.gaps) {
    assert.ok(z1 - z0 > 3 * 3, `a gap no jump crosses (${z1 - z0} m)`);
    for (const x of [-1.5, 0, 1.5]) assert.ok(floor(x, (z0 + z1) / 2) < T.fall.below, `nothing across the gap at ${(z0 + z1) / 2} yet (${floor(x, (z0 + z1) / 2).toFixed(1)} m)`);
  }
  for (const z of [5, 28, 52, 72]) assert.ok(Math.abs(floor(0, z)) < 0.05, `a deck at ${z}`);
  // the seeds are the temple logic's switches, wanting the bloom; plain fluid only soaks in
  const [v1, v2, v3] = course.vines;
  assert.equal(L.el(v1.id).type, 'switch'); assert.deepEqual(L.el(v1.id).needs, ['bloom']);
  v1.seed.hit('shoot'); tick();
  assert.ok(!v1.grown(), 'a splash: still a seed');
  assert.ok(said.some((s) => /stays a seed/.test(s)), 'it says so');
  // bloomed (no run on: the world's for good), the vine grows a floor across the gap
  v1.seed.hit('bloom'); tick();
  assert.ok(v1.grown(), 'the vine grows');
  assert.ok(Math.abs(floor(0, 17)) < 0.05, `a floor across the first gap (${floor(0, 17).toFixed(2)})`);
  assert.ok(floor(3, 17) < T.fall.below, 'and only as wide as the vine: off its side is the meadow');
  // the flower-door: solid while shut, a bloom opens it
  const door = course.bud;
  assert.ok(physics.rayDistance(K.world(0, 1.5, 44), fwd, 6) < 3.6, 'the bud shuts the doorway');
  door.bud.hit('shoot'); tick();
  assert.ok(!door.open(), 'water only beads on it');
  door.bud.hit('bloom'); tick();
  assert.ok(door.open(), 'bloomed: it opens');
  assert.ok(physics.rayDistance(K.world(0, 1.5, 44), fwd, 6) >= 6 - 0.01, 'the way through is open');
  // a new run: the vines taken back, the seeds closed, the door shut
  const ctx = runnerCtx(pl);
  let sess = W.session(ctx);
  assert.ok(!v1.grown() && !v1.seed.on && !door.open(), 'all as it was');
  assert.ok(floor(0, 17) < T.fall.below, 'the first gap open again');
  assert.ok(physics.rayDistance(K.world(0, 1.5, 44), fwd, 6) < 3.6, 'the door shut again');
  // the run: down in the meadow ends it (past the first deck's edge), and so do the wings
  pl.pos.copy(K.world(0, floor(0, 17), 17));
  sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.equal(ctx.result?.title, 'Down in the meadow');
  sess.end(); ctx.result = null;
  sess = W.session(ctx);
  pl.gliding = true;
  for (let i = 0; i < 20 && !ctx.result; i++) sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.equal(ctx.result?.title, 'Off your feet', 'the wings opened: over in a moment');
  pl.gliding = false;
  sess.end(); ctx.result = null;
  // played: each seed bloomed, each vine walked, the door bloomed, the arch
  sess = W.session(ctx);
  for (const v of course.vines) { v.seed.hit('bloom'); }
  door.bud.hit('bloom'); tick();
  for (const gt of W.gates) walk(sess, ctx, pl, V(gt.x, gt.y - 1, gt.z));
  assert.ok(ctx.result && !ctx.result.failed, 'finished');
  for (const [z0, z1] of course.gaps) assert.ok(Math.abs(floor(0, (z0 + z1) / 2)) < 0.05, `the vine over ${z0}–${z1}`);
  sess.end();
  // the makers' mark: a steady scripted run (walked at 5 m/s; the gun switched to bloom, the first two seeds bloomed
  // from the start, the door from the first deck, the third seed from behind the door: half a second each) plus slack
  const t = scripted(course, [[0, 0, 8], [0, 0, 50], [0, 0, 75]]) + 5 * 0.5;
  assert.ok(T.par > t * 1.15 && T.par < t * 1.6 + 6, `the mark ${T.par} s over a scripted ${t.toFixed(1)} s`);
  C.dispose();
});

test('the bell crossing: the bell brings each gap’s fallen-up stones down, the door opens to it; the cloud and the wings end it', () => {
  const { scene, physics } = world('arzach2');
  const T = KIT_TRIALS['kit-arzach2'];
  const game = new GameState(), said = [];
  const pl = traveller();
  const C = createChallenges({ levelId: 'arzach2', scene, physics, player: pl, items: { has: () => true }, game, kits: [T], trials: {}, notice: (t) => said.push(t) });
  const W = C.list[0], course = W.course, K = course.kit, L = course.rt.logic;
  const floor = (x, z) => { const p = K.world(x, 1, z), g = physics.groundAt(p.x, p.y, p.z, 30); return Number.isFinite(g) ? K.local(V(p.x, g, p.z)).y : -Infinity; };
  const fwd = K.world(0, 0, 1).sub(K.world(0, 0, 0));
  const tick = () => course.update(1 / 60, 0);
  const ring = (x, z) => { game.emit('bell', { pos: K.world(x, 0, z) }); tick(); };
  assert.equal(course.bells.length, 3);
  // the gaps: far wider than a jump, nothing under them but the cloud, a deck either side
  for (const [z0, z1] of course.gaps) {
    assert.ok(z1 - z0 > 3 * 3, `a gap no jump crosses (${z1 - z0} m)`);
    for (const x of [-1.5, 0, 1.5]) assert.ok(floor(x, (z0 + z1) / 2) < T.fall.below, `nothing across the gap at ${(z0 + z1) / 2} yet`);
  }
  for (const z of [5, 28, 50, 74]) assert.ok(Math.abs(floor(0, z)) < 0.05, `a deck at ${z}`);
  // the bells are the temple logic's bell elements, wanting the whistle; each far enough from the next that one note wakes one
  const [b1, b2, b3] = course.bells;
  assert.equal(L.el(b1.id).type, 'bell'); assert.deepEqual(L.el(b1.id).needs, ['bell']);
  const ears = [...course.bells.map((b) => b.ear), course.door.ear];
  for (let i = 1; i < ears.length; i++) assert.ok(ears[i].at.distanceTo(ears[i - 1].at) > ears[i].reach + ears[i - 1].reach, 'one ring never wakes two');
  // too far: nothing; the listening shell's soft hum: nothing; the bell beside it: the stones come down, a floor at once
  ring(0, 2);
  assert.ok(!b1.down(), 'rung from the far end of the deck: the stones stay up');
  game.emit('bell', { pos: K.world(0, 0, 10), soft: true }); tick();
  assert.ok(!b1.down(), 'the shell’s hum is not a bell');
  ring(0, 8);
  assert.ok(b1.down(), 'the bell rung at the edge (no run on: for anyone)');
  assert.ok(!b2.down(), 'only its own bridge');
  assert.ok(said.some((s) => /come down/.test(s)), 'it says so');
  assert.ok(Math.abs(floor(0, 17)) < 0.05, `a floor across the first gap (${floor(0, 17).toFixed(2)})`);
  assert.ok(floor(3.5, 17) < T.fall.below, 'only as wide as the stones: off their side is the cloud');
  // the door: solid while shut, the bell opens it
  assert.ok(physics.rayDistance(K.world(0, 1.5, 67), fwd, 6) < 3.6, 'the door shuts the doorway');
  ring(0, 60);
  assert.ok(!course.door.open(), 'from the third deck: too far');
  ring(0, 67);
  assert.ok(course.door.open(), 'rung before it: it opens');
  assert.ok(physics.rayDistance(K.world(0, 1.5, 67), fwd, 6) >= 6 - 0.01, 'the way through is open');
  // a new run: the stones back up, the door shut
  const ctx = runnerCtx(pl);
  let sess = W.session(ctx);
  assert.ok(!b1.down() && !course.door.open(), 'all as it was');
  assert.ok(floor(0, 17) < T.fall.below, 'the first gap open again');
  assert.ok(physics.rayDistance(K.world(0, 1.5, 67), fwd, 6) < 3.6, 'the door shut again');
  // down into the cloud past the first deck's edge ends it, and so do the wings
  pl.pos.copy(K.world(0, -8, 17));
  sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.equal(ctx.result?.title, 'Into the cloud');
  sess.end(); ctx.result = null;
  sess = W.session(ctx);
  pl.gliding = true;
  for (let i = 0; i < 20 && !ctx.result; i++) sess.update(1 / 60, {}, { live: true, phase: 'play' });
  assert.equal(ctx.result?.title, 'Off your feet', 'the wings opened: over in a moment');
  pl.gliding = false;
  sess.end(); ctx.result = null;
  // played: each bell rung at its edge, each bridge walked, the door rung open, the arch
  sess = W.session(ctx);
  ring(-2.6, 8); walk(sess, ctx, pl, V(W.gates[0].x, W.gates[0].y - 1, W.gates[0].z));
  ring(2.6, 31); walk(sess, ctx, pl, V(W.gates[1].x, W.gates[1].y - 1, W.gates[1].z));
  ring(-2.6, 53); ring(0, 67); walk(sess, ctx, pl, V(W.gates[2].x, W.gates[2].y - 1, W.gates[2].z));
  assert.ok(ctx.result && !ctx.result.failed, 'finished');
  for (const [z0, z1] of course.gaps) assert.ok(Math.abs(floor(0, (z0 + z1) / 2)) < 0.05, `the stones over ${z0}–${z1}`);
  sess.end();
  // the makers' mark: a steady scripted run (walked at 5 m/s; to each bell's edge and the door, half a second to sound each) plus slack
  const t = scripted(course, [[0, 0, 8], [0, 0, 30], [0, 0, 52], [0, 0, 67], [0, 0, 76.4]]) + 4 * 0.5;
  assert.ok(T.par > t * 1.15 && T.par < t * 1.6 + 6, `the mark ${T.par} s over a scripted ${t.toFixed(1)} s`);
  C.dispose();
});
