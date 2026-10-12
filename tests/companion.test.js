// Plumb, the drone's own mind (src/companion.js): the lost watch, the opening's lines, the setting, its moods.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Companion, LostWatch, Opening, Mood, LOST, MOOD, DRONE_LINES, OPENING, DRONE_HINTS, droneSay, shown } from '../src/companion.js';
import { parseLine } from '../src/story/tone.js';

/** A save's flags, as the game state keeps them. */
const state = () => { const flags = {}; return { flags, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } }; };

/** Walk round a ring (radius r m, at `speed` m/s) round c for `secs`, a step of dt; returns the first reason and when. */
function walk(w, secs, { c = { x: 12, y: 12, z: 12 }, r = 4, speed = 1.5, goal = { x: 12, y: 12, z: 12 }, say = 'on', seen = new Set(), dt = 0.25, t0 = 0 } = {}) {
  for (let t = t0; t < t0 + secs; t += dt) {
    const a = (t * speed) / r;
    const why = w.update(dt, { pos: { x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r }, goal, say, seen });
    if (why) return { why, at: t + dt };
  }
  return null;
}

test('lost: not before the threshold, then once (going round in one place is circling)', () => {
  const w = new LostWatch(), seen = new Set();
  assert.equal(walk(w, LOST.after.on - 1, { seen }), null, 'nothing before the threshold');
  const hit = walk(w, 5, { t0: LOST.after.on - 1, seen });
  assert.ok(hit, 'it speaks up after the threshold');
  assert.equal(hit.why, 'circling');
});

test('lost: standing still (away from the keys) is not lost', () => {
  const w = new LostWatch();
  for (let t = 0; t < 600; t += 0.5) assert.equal(w.update(0.5, { pos: { x: 3, y: 0, z: 3 }, goal: { x: 100, y: 0, z: 0 } }), null);
});

test('lost: nothing to find, never lost; paused (a scene, a menu), the clock waits', () => {
  const w = new LostWatch();
  assert.equal(walk(w, 900, { goal: null }), null);
  const v = new LostWatch();
  walk(v, LOST.after.on - 10);
  for (let t = 0; t < 300; t += 0.5) assert.equal(v.update(0.5, { active: false, pos: { x: 0, y: 0, z: 0 }, goal: { x: 1, y: 0, z: 0 } }), null);
  assert.ok(v.t < LOST.after.on, 'the paused time did not count');
});

test('lost: walking away from the goal runs the clock faster', () => {
  const w = new LostWatch(), seen = new Set();
  // first a look at the goal from near it, then off 100 m away, round and round there
  w.update(0.25, { pos: { x: 12, y: 12, z: 12 }, goal: { x: 0, y: 12, z: 0 }, seen });
  const hit = walk(w, 400, { c: { x: 112, y: 12, z: 12 }, goal: { x: 0, y: 12, z: 0 }, seen });
  assert.ok(hit);
  assert.equal(hit.why, 'away');
  assert.ok(hit.at < LOST.after.on / LOST.awayRate + 30, `sooner (${hit.at.toFixed(0)} s)`);
});

test('lost: new places give time back, and progress starts the clock over', () => {
  const w = new LostWatch(), seen = new Set();
  // a straight walk into new country: a new place every 16 s gives 40 s back; never lost while exploring
  let why = null;
  for (let t = 0; t < 900 && !why; t += 0.25) why = w.update(0.25, { pos: { x: 12 + t * 1.5, y: 12, z: 12 }, goal: { x: 12 + t * 1.5 + 20, y: 12, z: 12 }, seen });
  assert.equal(why, null, 'exploring is not lost');
  const v = new LostWatch(), known = new Set();
  walk(v, LOST.after.on - 20, { seen: known });
  v.reset();
  assert.equal(walk(v, LOST.after.on - 5, { seen: known }), null, 'progress: the clock started over');
});

test('lost: the cooldown holds between two', () => {
  const w = new LostWatch(), seen = new Set();
  const first = walk(w, LOST.after.on + 10, { seen });
  assert.ok(first);
  // straight after: a full threshold more, still inside the cooldown
  assert.equal(walk(w, LOST.cool.on - 5, { t0: first.at, seen }), null, 'not again within the cooldown');
  const again = walk(w, LOST.after.on + 20, { t0: first.at + LOST.cool.on - 5, seen });
  assert.ok(again, 'after the cooldown (and a fresh threshold) it may');
});

test('the setting: on, fewer (twice as long, rests twice as long), off (never); hints off silences it', () => {
  assert.deepEqual(DRONE_HINTS, ['on', 'fewer', 'off']);
  assert.ok(LOST.after.fewer >= LOST.after.on * 2 && LOST.cool.fewer >= LOST.cool.on * 2);
  const fewer = new LostWatch(), seen = new Set();
  assert.equal(walk(fewer, LOST.after.on + 30, { say: 'fewer', seen }), null, 'fewer: not at the usual threshold');
  assert.ok(walk(fewer, LOST.after.fewer, { say: 'fewer', t0: LOST.after.on + 30, seen }), 'fewer: later');
  const off = new LostWatch();
  assert.equal(walk(off, 2000, { say: 'off' }), null, 'off: never');
  assert.equal(droneSay('on', 'off'), 'off');
  assert.equal(droneSay('fewer', 'subtle'), 'fewer');
  assert.equal(droneSay('nonsense', 'full'), 'on');
  // the companion with the setting off: no lost line, no opening line
  const s = state();
  let setting = 'off';
  const c = new Companion({ state: s, setting: () => setting, hints: () => 'subtle' });
  c.note('out');
  for (let t = 0; t < 1000; t += 0.5) assert.equal(c.update(0.5, { pos: { x: Math.cos(t), y: 0, z: Math.sin(t) }, goal: { x: 50, y: 0, z: 0 } }).say, '');
  assert.equal(s.flags['drone.said.out'], undefined, 'off: the opening line was not used up');
  setting = 'on';
  c.note('out');
  assert.equal(c.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).say, DRONE_LINES.out);
});

test('the opening: each line once, kept in the save; it waits until it can be said', () => {
  const s = state(), o = new Opening(s);
  o.note('out'); o.note('out'); o.note('chest');
  assert.equal(o.take(), DRONE_LINES.out);
  assert.equal(o.take(), DRONE_LINES.chest);
  assert.equal(o.take(), '');
  o.note('out'); o.note('chest');
  assert.equal(o.take(), '', 'said once: never again');
  assert.equal(new Opening(s).said('out'), true, 'kept in the save');
  o.note('nonsense');
  assert.equal(o.take(), '');
  // the companion holds a line while it can't speak
  const c = new Companion({ state: state(), hints: () => 'subtle' });
  c.note('person');
  assert.equal(c.update(0.5, { canSpeak: false, pos: { x: 0, y: 0, z: 0 } }).say, '');
  assert.equal(c.update(0.5, { canSpeak: true, pos: { x: 0, y: 0, z: 0 } }).say, DRONE_LINES.person);
  assert.equal(c.update(0.5, { canSpeak: true, pos: { x: 0, y: 0, z: 0 } }).say, '');
});

test('the first time it finds you lost it says the pointer line; after that the lost lines, in turn', () => {
  const s = state(), c = new Companion({ state: s, hints: () => 'subtle' });
  assert.equal(c.lostLine('still'), DRONE_LINES.pointer);
  assert.equal(s.flags['drone.said.pointer'], true);
  assert.equal(c.lostLine('still'), DRONE_LINES.still[0]);
  assert.equal(c.lostLine('still'), DRONE_LINES.still[1]);
  assert.equal(c.lostLine('away'), DRONE_LINES.away[0]);
  // the whole run: lost after the threshold, a line and a point
  const d = new Companion({ state: state(), hints: () => 'subtle' });
  let r = null;
  for (let t = 0; t < LOST.after.on + 10 && !r?.point; t += 0.25) r = d.update(0.25, { pos: { x: 12 + Math.cos(t), y: 12, z: 12 + Math.sin(t) }, goal: { x: 80, y: 12, z: 12 } });
  assert.ok(r.point);
  assert.equal(r.say, DRONE_LINES.pointer);
});

test('every line carries a tone, is short, and never names a button (the R3 line is the hint system\'s, #151)', () => {
  const all = [...OPENING.map((k) => DRONE_LINES[k]), ...['still', 'away', 'circling'].flatMap((k) => DRONE_LINES[k])];
  assert.ok(all.length >= 10);
  for (const l of all) {
    assert.ok(parseLine(l).explicit, `${l}: a tone`);
    assert.ok(parseLine(l).text.split(/\s+/).length <= 9, `${l}: terse`);
    assert.ok(!/R3|\{key|Q\b/.test(l), `${l}: no button`);
    assert.ok(shown(l).startsWith('◇ ') && !shown(l).includes('~'), 'shown without its tag');
  }
  assert.ok(OPENING.length >= 3 && OPENING.length <= 5, 'three to five opening lines');
});

test('moods: a hop on a find, a look toward something, a shiver in a storm; nothing with Reduce motion', () => {
  const m = new Mood();
  let p = m.step(0.016);
  assert.equal(m.busy, false, 'at rest: nothing');
  m.hop();
  let top = 0;
  for (let t = 0; t < MOOD.hop.time; t += 0.016) top = Math.max(top, m.step(0.016).lift);
  assert.ok(top > MOOD.hop.height * 0.5, 'it hops');
  assert.equal(m.step(0.016).lift, 0, 'and lands');
  // something behind the lens' way (in front of you): it turns round to it the short way, and tips toward it
  for (let i = 0; i < 120; i++) p = m.step(0.016, { dir: { x: 0.2, z: -1 } });
  assert.ok(Math.abs(Math.abs(p.yaw) - Math.abs(Math.atan2(0.2, -1))) < 0.1, `it looks at it (${p.yaw.toFixed(2)})`);
  assert.ok(p.tilt > MOOD.lean.tilt * 0.8 && p.awake);
  for (let i = 0; i < 200; i++) p = m.step(0.016);
  assert.ok(Math.abs(p.yaw) < 0.05 && p.tilt < 0.02, 'back at rest');
  // a storm
  let shake = 0;
  for (let i = 0; i < 60; i++) shake = Math.max(shake, Math.abs(m.step(0.016, { storm: 1 }).shake));
  assert.ok(shake > MOOD.shiver.amp * 0.3, 'a shiver');
  for (let i = 0; i < 60; i++) assert.equal(m.step(0.016, { storm: 0.1 }).shake, 0, 'a breeze: none');
  // Reduce motion: still
  m.hop();
  p = m.step(0.016, { dir: { x: 1, z: 0 }, storm: 1, still: true });
  assert.deepEqual([p.lift, p.yaw, p.tilt, p.shake], [0, 0, 0, 0]);
  assert.equal(m.busy, false);
});
