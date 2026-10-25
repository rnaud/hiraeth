import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ATTEND, WEIGHT, AttendPicker, AttendGate, attendCandidates, attendSpot, attendScore, stageWorthShowing } from '../src/drone-attend.js';
import { Scout } from '../src/scout.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const C = (id, kind, at) => ({ id, kind, weight: WEIGHT[kind], position: at });

test('what matters: the tracked step first, then a quest\'s giver, then another step; places to walk to never', () => {
  const stages = { a: { talk: 'teo' }, b: { goto: [0, 0, 0], radius: 20 }, c: { bring: 'drum', to: 'ama' }, d: { flag: 'x', at: [1, 0, 1] } };
  const quests = {
    current: (q) => stages[q],
    objective: () => ({ id: 'quest-a-1', quest: 'a', label: 'Teo', position: v(5) }),
    giverMarks: () => [{ id: 'giver-sel', label: 'Sel', position: v(8) }],
    objectives: () => [
      { id: 'quest-a-1', quest: 'a', position: v(5) },
      { id: 'quest-b-1', quest: 'b', position: v(6) },
      { id: 'quest-c-1', quest: 'c', position: v(7) },
      { id: 'quest-d-1', quest: 'd', position: v(9) },
    ],
  };
  const list = attendCandidates(quests);
  assert.deepEqual(list.map((c) => [c.id, c.kind]), [['quest-a-1', 'tracked'], ['giver-sel', 'giver'], ['quest-c-1', 'step'], ['quest-d-1', 'step']]);
  assert.ok(WEIGHT.tracked > WEIGHT.giver && WEIGHT.giver > WEIGHT.step);
  assert.equal(stageWorthShowing({ goto: [0, 0, 0], at: [1, 1, 1] }), false, 'a place, even marked');
  assert.equal(attendCandidates(null).length, 0);
  // (the tracked objective a place to walk to: not shown, the rest still are)
  const q2 = { ...quests, objective: () => ({ id: 'quest-b-1', quest: 'b', position: v(6) }) };
  assert.equal(attendCandidates(q2).some((c) => c.id === 'quest-b-1'), false);
});

test('the pick: weight before nearness, nothing out of range, on another floor, out of sight or reached', () => {
  const p = new AttendPicker();
  const tracked = C('t', 'tracked', v(18)), giver = C('g', 'giver', v(6));
  // tracked at 18 m: 3 × (1 − 0.5·18/22) ≈ 1.77; giver at 6 m: 2 × (1 − 0.5·6/22) ≈ 1.73
  assert.equal(p.pick([tracked, giver], { feet: v(), up: UP }).id, 't');
  assert.ok(attendScore(tracked, 18) > attendScore(giver, 6));
  const q = new AttendPicker();
  assert.equal(q.pick([C('far', 'tracked', v(ATTEND.range + 1))], { feet: v(), up: UP }), null, 'out of range');
  assert.equal(q.pick([C('up', 'tracked', v(4, ATTEND.floor + 0.5))], { feet: v(), up: UP }), null, 'another floor');
  assert.equal(q.pick([C('hid', 'tracked', v(8))], { feet: v(), up: UP, sees: () => false }), null, 'out of sight');
  assert.equal(q.pick([C('here', 'tracked', v(1))], { feet: v(), up: UP }), null, 'reached already');
  // (a gravity well's up: "another floor" along its up, not along y)
  const side = v(1, 0, 0);
  assert.equal(new AttendPicker().pick([C('w', 'tracked', v(0, 6, 0))], { feet: v(), up: side }).id, 'w', 'level along its own up');
});

test('hysteresis: two near-equal targets never flip-flop; a much better one takes over only after the hold', () => {
  const p = new AttendPicker();
  const a = C('a', 'step', v(8, 0, 0)), b = C('b', 'step', v(-8, 0, 0));
  const feet = v();
  let flips = 0, last = null;
  // walking back and forth between the two: each in turn a little nearer
  for (let t = 0; t < 12; t += 0.2) {
    feet.x = Math.sin(t) * 2;
    const got = p.pick([a, b], { feet, up: UP, dt: 0.2, now: t });
    if (last && got && got.id !== last) flips++;
    last = got?.id ?? last;
  }
  assert.equal(flips, 0, 'one target held while the other is about as good');
  // a far better one (the tracked step) comes into range: it waits for the hold, then takes over
  const r = new AttendPicker();
  assert.equal(r.pick([a], { feet: v(), up: UP, dt: 0.2, now: 0 }).id, 'a');
  const t = C('t', 'tracked', v(0, 0, 4));
  let changedAt = null;
  for (let s = 0.2; s < 8; s += 0.2) { const got = r.pick([a, t], { feet: v(), up: UP, dt: 0.2, now: s }); if (got.id === 't' && changedAt == null) changedAt = s; }
  assert.ok(changedAt >= ATTEND.hold - 0.2 && changedAt < ATTEND.hold + 0.6, `took over after the hold (${changedAt})`);
  // the one shown is kept past `range` up to `keep`, and let go beyond
  const k = new AttendPicker();
  const m = C('m', 'tracked', v(20));
  k.pick([m], { feet: v(), up: UP, dt: 0.2 });
  assert.equal(k.pick([m], { feet: v(-6), up: UP, dt: 0.2 })?.id, 'm', '26 m: kept');
  assert.equal(k.pick([m], { feet: v(-12), up: UP, dt: 0.2 }), null, '32 m: let go');
  assert.equal(k.ended, 'far');
});

test('done, reached, unseen, shown long enough: let go and not shown again for a while', () => {
  const p = new AttendPicker();
  const a = C('a', 'tracked', v(10));
  assert.equal(p.pick([a], { feet: v(), up: UP, dt: 0.2, now: 0 }).id, 'a');
  assert.equal(p.pick([], { feet: v(), up: UP, dt: 0.2, now: 0.2 }), null, 'talked to: gone from the list');
  assert.equal(p.ended, 'done');
  // reached
  const r = new AttendPicker();
  r.pick([a], { feet: v(), up: UP, dt: 0.2, now: 0 });
  assert.equal(r.pick([a], { feet: v(8.5), up: UP, dt: 0.2, now: 1 }), null);
  assert.equal(r.ended, 'reached');
  assert.equal(r.pick([a], { feet: v(), up: UP, dt: 0.2, now: 2 }), null, 'not again so soon');
  assert.equal(r.pick([a], { feet: v(), up: UP, dt: 0.2, now: 2 + ATTEND.again }).id, 'a', 'again after a while');
  // out of sight a moment (someone behind a post): kept; longer: let go
  const b = new AttendPicker();
  b.pick([a], { feet: v(), up: UP, dt: 0.2, now: 0 });
  let seen = false;
  for (let s = 0.2; s <= 1.0; s += 0.2) assert.equal(b.pick([a], { feet: v(), up: UP, dt: 0.2, now: s, sees: () => seen })?.id, 'a');
  const ends = [];
  for (let s = 1.2; s <= 2.4; s += 0.2) { b.pick([a], { feet: v(), up: UP, dt: 0.2, now: s, sees: () => seen }); if (b.ended) ends.push(b.ended); }
  assert.equal(b.current, null); assert.deepEqual(ends, ['blind']);
  // shown long enough
  const l = new AttendPicker();
  let got = null; const ended = [];
  for (let s = 0; s < ATTEND.show + 1; s += 0.2) { got = l.pick([a], { feet: v(), up: UP, dt: 0.2, now: s }); if (l.ended) ended.push(l.ended); }
  assert.equal(got, null); assert.deepEqual(ended, ['shown']);
});

test('the gate: out only after dawdling a moment; home when you run, ride, fight or a scene begins; a rest after', () => {
  const g = new AttendGate();
  let r;
  for (let t = 0; t < ATTEND.settle - 0.2; t += 0.1) r = g.update(0.1, { speed: 1 });
  assert.equal(r, 'wait', 'not at once');
  for (let t = 0; t < 0.4; t += 0.1) r = g.update(0.1, { speed: 1 });
  assert.equal(r, 'out');
  assert.equal(g.update(0.1, { speed: 3.5 }), 'out', 'a brisker walk keeps it out');
  assert.equal(g.update(0.1, { speed: 6 }), 'out', 'a stumble is not a run');
  for (let t = 0; t < 0.5; t += 0.1) r = g.update(0.1, { speed: 6 });
  assert.equal(r, 'home', 'running');
  assert.equal(g.update(0.1, { speed: 0, fight: true }), 'home');
  assert.equal(g.update(0.1, { speed: 0, calm: false }), 'home');
  assert.equal(g.update(0.1, { speed: 0, riding: true }), 'home');
  // a walk from standing at 3 m/s does not bring it out
  const w = new AttendGate();
  for (let t = 0; t < 5; t += 0.1) r = w.update(0.1, { speed: 3 });
  assert.equal(r, 'wait');
  // rest after an outing
  const s = new AttendGate();
  s.rest();
  for (let t = 0; t < ATTEND.rest - 0.5; t += 0.1) r = s.update(0.1, { speed: 0 });
  assert.equal(r, 'wait');
  for (let t = 0; t < 1; t += 0.1) r = s.update(0.1, { speed: 0 });
  assert.equal(r, 'out');
});

test('the spot: over its head, a little toward you, under a ceiling', () => {
  const s = attendSpot({ feet: v(10), goal: v(), up: UP });
  assert.ok(Math.abs(s.y - ATTEND.over) < 1e-6);
  assert.ok(Math.abs(s.x - ATTEND.toward) < 1e-6, 'toward you');
  assert.ok(Math.abs(Math.abs(s.z) - ATTEND.side) < 1e-6, 'to its side');
  const low = attendSpot({ feet: v(10), goal: v(), up: UP, ray: () => 1.2 });
  assert.ok(low.y < 2 && low.y >= 1.2, `under a 2.2 m ceiling (${low.y})`);
});

function rig() {
  const player = { pos: v(), vel: v(), frame: { up: v(0, 1, 0) } };
  const scout = new Scout({ scene: new THREE.Scene(), player, physics: { rayDistance: () => Infinity }, getTarget: () => ({ id: 'q', label: 'Q', position: v(100) }) });
  return { player, scout };
}

test('Scout.attend: out of its light, over the target, lens on it; home, or gone at once; a ping takes over', () => {
  const { scout } = rig();
  const goal = v(8, 0, 4);
  assert.equal(scout.attend({ id: 'a', position: goal }), true);
  assert.equal(scout.phase, 'appear');
  for (let k = 0; k < 300; k++) scout.update(1 / 60);
  assert.equal(scout.phase, 'attend');
  const want = attendSpot({ feet: v(), goal, up: UP });
  assert.ok(scout.object.position.distanceTo(want) < 0.4, `hovers over it (${scout.object.position.distanceTo(want).toFixed(2)} m off)`);
  assert.ok(scout.ring.visible, 'its ring lit');
  for (let k = 0; k < 600; k++) scout.update(1 / 60);
  assert.equal(scout.phase, 'attend', 'stays while wanted (no FIND.max on it)');
  // retarget while hovering
  assert.equal(scout.attend({ id: 'b', position: v(-6, 0, 2) }), true);
  assert.equal(scout.phase, 'attend');
  scout.unattend();
  assert.equal(scout.phase, 'leave');
  assert.equal(scout.attend({ id: 'b', position: v(-6, 0, 2) }), true, 'turns back on its way home');
  assert.equal(scout.phase, 'attend');
  scout.unattend(true);
  assert.equal(scout.phase, 'away'); assert.equal(scout.object.visible, false);
  // busy on a find: not taken off it
  scout.ping();
  assert.equal(scout.attend({ id: 'a', position: goal }), false);
  scout.hide();
  scout.attend({ id: 'a', position: goal });
  scout.ping();
  assert.equal(scout.attending, null, 'the ping takes over');
  // a scene: gone
  const r2 = rig();
  r2.scout.attend({ id: 'a', position: goal });
  for (let k = 0; k < 60; k++) r2.scout.update(1 / 60);
  r2.scout.update(1 / 60, false, true);
  assert.equal(r2.scout.phase, 'away');
});

test('wireCompanion: dawdling near a quest\'s person brings Plumb over them; running, a talk, or done sends it home', async () => {
  const { wireCompanion } = await import('../src/host/game-host.js');
  const { Companion } = await import('../src/companion.js');
  const { GameState } = await import('../src/game-state.js');
  const game = new GameState({ getItem: () => null, setItem: () => {} });
  game.set('met.someone', true);
  const plumb = new Companion({ state: game, hints: () => 'subtle' });
  const { player, scout } = rig();
  let open = true;
  const teo = v(9, 0, 3);
  const quests = { current: () => ({ talk: 'teo' }), objective: () => (open ? { id: 'quest-a-1', quest: 'a', label: 'Teo', position: teo.clone() } : null), giverMarks: () => [], objectives: () => [] };
  const step = wireCompanion({ game, plumb, scout, level: {}, player, npcs: [], struggle: { t: 0 }, quests: () => quests });
  const run = (secs, o = {}) => { for (let t = 0; t < secs; t += 1 / 30) { scout.update(1 / 30, false, o.gone); step(1 / 30, { canSpeak: false, calm: !o.gone, ...o }); } };
  run(1.0);
  assert.equal(scout.phase, 'away', 'not at once');
  run(2.5);
  assert.equal(scout.phase, 'attend', 'over Teo');
  // running: home
  player.vel.set(6, 0, 0);
  run(1.5);
  assert.notEqual(scout.phase, 'attend');
  player.vel.set(0, 0, 0);
  run(3);
  assert.equal(scout.phase, 'away', 'a rest after it came home');
  run(10);
  assert.equal(scout.phase, 'attend', 'and out again (shown before, but only as long as you looked away: the run)');
  // a talk: gone at once
  run(0.1, { gone: true });
  assert.equal(scout.phase, 'away');
  // a fight: home
  run(12);
  assert.equal(scout.phase, 'attend');
  run(0.2, { fight: true });
  assert.equal(scout.phase, 'leave');
  run(12);
  // the step done: home
  assert.equal(scout.phase, 'attend');
  open = false;
  run(1);
  assert.notEqual(scout.phase, 'attend');
  // the drone's hints off: never
  const off = new Companion({ state: game, setting: () => 'off', hints: () => 'subtle' });
  const r3 = rig(); open = true;
  const s3 = wireCompanion({ game, plumb: off, scout: r3.scout, level: {}, player: r3.player, npcs: [], struggle: { t: 0 }, quests: () => quests });
  for (let t = 0; t < 6; t += 1 / 30) { r3.scout.update(1 / 30); s3(1 / 30, { canSpeak: false, calm: true }); }
  assert.equal(r3.scout.phase, 'away');
});
