// Plumb, the drone's own mind (src/companion.js): the lost watch, the opening's lines, the setting, its moods.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Companion, LostWatch, Opening, LOST, DRONE_LINES, OPENING, ONCE, DRONE_HINTS, droneSay, shown, DRONE_NAME, FOLLOWS, OPENING_POINTS,
  PLACE_LINES, PLACE_MAX, placeOf, HOUSE_LINES, HOUSE, GAP, StepWatch, FightWatch, droneWorld, withPlace, CRITICAL, HAIL, talkPages, splitBark, plumbTalk, PLUMB_PERSON, PAGE_WORDS,
  LANDING_TALK, LANDING_FLAG, LANDING } from '../src/companion.js';
import { STRUGGLE } from '../src/hint-level.js';
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
  assert.equal(o.take(), DRONE_LINES.recharge, 'the village line brings the recharge line with it');
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
  // the whole run: lost after the threshold, something to tell you (not on the cue: a talk waiting, issue #543), then the flight
  const d = new Companion({ state: state(), hints: () => 'subtle' });
  let r = null;
  for (let t = 0; t < LOST.after.on + 10 && !r?.hail; t += 0.25) r = d.update(0.25, { pos: { x: 12 + Math.cos(t), y: 12, z: 12 + Math.sin(t) }, goal: { x: 80, y: 12, z: 12 } });
  assert.deepEqual([r.say, r.point], ['', null], 'nothing on the cue');
  assert.equal(r.hail.line, DRONE_LINES.pointer);
  assert.ok(CRITICAL.includes(r.hail.id) && r.hail.point, 'a lost reason, and the flight after the talk');
});

test('every line carries a tone, is short, and never names a button (the R3 line is the hint system\'s, #151)', () => {
  const all = [...OPENING.map((k) => DRONE_LINES[k]), ...ONCE.map((k) => DRONE_LINES[k]), ...['still', 'away', 'circling'].flatMap((k) => DRONE_LINES[k]),
    ...Object.values(PLACE_LINES).flat(), ...Object.values(HOUSE_LINES)];
  assert.ok(all.length >= 30);
  for (const l of all) {
    assert.ok(parseLine(l).explicit, `${l}: a tone`);
    assert.ok(parseLine(l).text.replace('{place}', '').split(/\s+/).filter(Boolean).length <= 9, `${l}: terse`);
    assert.ok(!/R3|\{key|Q\b/.test(l), `${l}: no button`);
    assert.ok(shown(l).startsWith(`◇ ${DRONE_NAME}: `) && !shown(l).includes('~'), 'shown in its name, without its tag');
    // (a notice's length, its name and the longest place in it)
    assert.ok(shown(withPlace(l, 'x'.repeat(PLACE_MAX))).length <= 72, `${l}: short enough for the cue (72, with the longest place)`);
  }
  assert.ok(OPENING.length >= 3 && OPENING.length <= 5, 'three to five opening lines');
});


test('its name: Plumb, on every line it says (issue #434)', () => {
  assert.equal(DRONE_NAME, 'Plumb');
  assert.equal(shown('~curious~ Best bet?'), '◇ Plumb: Best bet?');
});

test('the first steps out: the village on the horizon, someone there to recharge us, then it flies off toward it (issue #434)', () => {
  assert.match(DRONE_LINES.out, /village on the horizon/);
  assert.match(DRONE_LINES.recharge, /recharge/);
  assert.equal(FOLLOWS.out, 'recharge');
  assert.equal(OPENING_POINTS.recharge, 'village');
  const s = state(), c = new Companion({ state: s, hints: () => 'subtle' });
  c.note('out');
  const a = c.update(0.5, { pos: { x: 0, y: 0, z: 0 } });
  assert.equal(a.say, DRONE_LINES.out); assert.equal(a.point, null);
  const b = c.update(0.5, { pos: { x: 0, y: 0, z: 0 } });
  assert.equal(b.say, DRONE_LINES.recharge); assert.equal(b.point, 'village', 'the second line sends it toward the village');
  // hints off: none of it
  const off = new Companion({ state: state(), hints: () => 'off' });
  off.note('out');
  assert.equal(off.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).say, '');
});

test('where to go: a place it can name, never a person or a doing', () => {
  const people = new Set(['Marrow', 'Nour']);
  assert.equal(placeOf('Qanat, under the dark tree', people), 'Qanat, under the dark tree');
  assert.equal(placeOf('The giant’s skull', people), 'The giant’s skull');
  for (const l of ['Marrow, by your ship', 'Nour, the eldest', 'Back to the ship', 'Through the doorway', 'Climb to ledge 2', '', null, 'The ' + 'very '.repeat(8) + 'long way'])
    assert.equal(placeOf(l, people), null, `${l}: not a place to name`);
  const c = new Companion({ state: state(), hints: () => 'subtle' });
  c.lostLine('still');   // (the pointer line, the first time)
  assert.equal(c.lostLine('still', 'The giant’s skull'), withPlace(PLACE_LINES.still[0], 'The giant’s skull'));
  assert.match(c.lostLine('away', 'The pool'), /^~\w+~ .*The pool is back here\.$/);
  assert.equal(c.lostLine('circling', null), DRONE_LINES.circling[0], 'no place: the plain line');
});

test('a makers\' house: a long time on one step, a line about what waits there, then the cooldown', () => {
  const w = new StepWatch();
  let fired = -1;
  for (let t = 0; t < HOUSE.after.on + 5 && fired < 0; t += 0.5) if (w.update(0.5, { step: 'h.sw1' })) fired = t;
  assert.ok(fired >= HOUSE.after.on - 1, `not before ${HOUSE.after.on} s (${fired})`);
  // a new step starts the clock over; the cooldown holds
  for (let t = 0; t < HOUSE.cool.on - 10; t += 0.5) assert.equal(w.update(0.5, { step: 'h.sw2' }), false);
  // off: never; not active (a scene, a menu): the clock waits
  const off = new StepWatch();
  for (let t = 0; t < 2000; t += 1) assert.equal(off.update(1, { step: 'x', say: 'off' }), false);
  const idle = new StepWatch();
  for (let t = 0; t < 2000; t += 1) assert.equal(idle.update(1, { step: 'x', active: false }), false);
  // the companion: inside, the house's line and the ping's flight to the step
  const c = new Companion({ state: state(), hints: () => 'subtle' });
  let r = null;
  for (let t = 0; t < HOUSE.after.on + 5 && !r?.hail; t += 0.5) r = c.update(0.5, { pos: { x: Math.cos(t), y: 0, z: 0 }, goal: { x: 9, y: 0, z: 0 }, house: { step: 'h.p1', type: 'plate' } });
  assert.deepEqual([r.hail.id, r.hail.point, r.hail.line, r.say], ['house', 'house', HOUSE_LINES.plate, '']);
});

test('a guardian: its hints offered by themselves as the struggle goes on, once a threshold, fewer from the second', () => {
  const run = (say) => {
    const w = new FightWatch(), at = [];
    for (let t = 0; t < 240; t += 0.5) if (w.update({ id: 'desert.0', secs: t, say })) at.push(t);
    return at;
  };
  assert.deepEqual(run('on'), STRUGGLE);
  assert.deepEqual(run('fewer'), STRUGGLE.slice(1));
  assert.deepEqual(run('off'), []);
  // a new phase starts over; held while it can't speak
  const w = new FightWatch();
  assert.equal(w.update({ id: 'a.0', secs: 50, canSpeak: false }), false);
  assert.equal(w.update({ id: 'a.0', secs: 51 }), true);
  assert.equal(w.update({ id: 'a.1', secs: 1 }), false);
  assert.equal(w.update({ id: 'a.1', secs: 41 }), true);
  // the companion: the hint's flight, no line of its own (the hint's line is the ping's)
  const c = new Companion({ state: state(), hints: () => 'full' });
  const r = c.update(0.5, { pos: { x: 0, y: 0, z: 0 }, active: false, fight: { id: 'desert.0', secs: 41 } });
  assert.deepEqual([r.say, r.point], ['', 'hint']);
});

test('never chatty: no two of its own lines within GAP, whatever asks', () => {
  const c = new Companion({ state: state(), hints: () => 'subtle' });
  c.state.set('drone.said.pointer', true);
  const said = [];
  for (let t = 0; t < 1200; t += 0.5) {
    const r = c.update(0.5, { pos: { x: 12 + Math.cos(t), y: 12, z: 12 }, goal: { x: 90, y: 12, z: 12 }, fight: t > 600 ? { id: 'g.0', secs: t - 600 } : null, house: t > 300 && t <= 600 ? { step: `s${Math.floor(t / 400)}`, type: 'switch' } : null });
    if (r.point || r.say || r.hail) said.push(t);
    if (r.hail) c.take();   // (answered: the talk had)
  }
  assert.ok(said.length >= 3, `it spoke (${said.join(', ')})`);
  for (let i = 1; i < said.length; i++) assert.ok(said[i] - said[i - 1] >= GAP.on, `${said[i - 1]} then ${said[i]}`);
});

test('droneWorld: the guardian first, else the house you are in and its next step', () => {
  const rt = { id: 'buried', inside: () => true, logic: { resolved: false, next: () => 'sw2', el: () => ({ type: 'switch' }) } };
  assert.deepEqual(droneWorld({ level: { temples: [rt] }, pos: { x: 0, y: 0, z: 0 } }), { fight: null, house: { step: 'buried.sw2', type: 'switch' } });
  assert.deepEqual(droneWorld({ level: { temple: rt }, pos: { x: 0, y: 0, z: 0 }, hint: { id: 'buried.1' }, secs: 12 }), { fight: { id: 'buried.1', secs: 12 }, house: null });
  assert.deepEqual(droneWorld({ level: { temples: [{ ...rt, inside: () => false }] }, pos: { x: 0, y: 0, z: 0 } }), { fight: null, house: null });
});

test('the first Blade Gate near: its line once per save, as its host comes within 12 m (issue #483)', async () => {
  const { wireCompanion } = await import('../src/host/game-host.js');
  const flags = {};
  const game = { data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, on() {}, emit() {} };
  const plumb = new Companion({ state: game, hints: () => 'subtle' });
  const P = (x) => ({ x, y: 0, z: 0, distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); } });
  const host = { def: { id: 'host.fight-desert', name: 'Wafa' }, pos: P(30), object: { visible: true } };
  const player = { pos: P(0) };
  flags['met.someone'] = true;   // (the opening's person line already had)
  const step = wireCompanion({ game, plumb, level: {}, player, npcs: [host] });
  // (danger: something to tell you, issue #543: a talk waiting, never on the cue)
  const told = [];
  const run = () => { for (let k = 0; k < 6; k++) { assert.equal(step(0.5), ''); const p = plumb.take(); if (p) told.push(p); } };
  run();
  assert.equal(told.length, 0, 'not from 30 m');
  host.pos = P(9);
  run();
  assert.equal(told.length, 1);
  assert.equal(told[0].id, 'bladegate');
  assert.equal(told[0].line, '~whisper~ Those blades mark a dangerous entrance. Be careful.');
  assert.equal(parseLine(told[0].line).tone, 'whisper', 'a warning, not a curiosity (#563)');
  assert.equal(told[0].point, null, 'nowhere to fly: you are at the gate (#563)');
  assert.equal(flags['drone.said.bladegate'], true);
  run();
  assert.equal(told.length, 1, 'once');
});

// ---- Plumb talks (issue #543): something critical waits at your shoulder; its button opens a talk, then the flight

test('a talk\'s pages: one to three, each with the line\'s tone and a few words, every critical line; its pointing word the bark', () => {
  assert.deepEqual(talkPages('~curious~ Lost? A little. The giant’s skull: this way.'), ['~curious~ Lost? A little.', '~curious~ The giant’s skull: this way.']);
  assert.deepEqual(talkPages('~curious~ That plate wants a weight. Look.'), ['~curious~ That plate wants a weight. Look.'], 'a short last sentence stays with the one before');
  assert.deepEqual(talkPages(DRONE_LINES.bladegate), ['~whisper~ Those blades mark a dangerous entrance. Be careful.']);
  assert.deepEqual(talkPages('~whisper~ Blades on a gate. Keep out. Something got in.'), ['~whisper~ Blades on a gate.', '~whisper~ Keep out. Something got in.'], 'longer warnings still retain sentence grouping');
  // (issue #559: "Look.", "This way." point at nothing from a dialogue box: they are said as it flies off, on the cue)
  assert.deepEqual(splitBark('~curious~ Lost? A little. The giant’s skull: this way.'), { talk: '~curious~ Lost? A little.', bark: '~curious~ The giant’s skull: this way.' });
  assert.deepEqual(splitBark('~curious~ Wrong way, I think. Look.'), { talk: '~curious~ Wrong way, I think.', bark: '~curious~ Look.' });
  assert.deepEqual(splitBark(DRONE_LINES.bladegate), { talk: DRONE_LINES.bladegate, bark: '' }, 'a warning keeps its words');
  assert.deepEqual(splitBark(HOUSE_LINES.plate), { talk: HOUSE_LINES.plate, bark: '' }, '"I’ll show you" is said in the talk');
  const critical = [DRONE_LINES.pointer, DRONE_LINES.bladegate, ...['still', 'away', 'circling'].flatMap((k) => [...DRONE_LINES[k], ...PLACE_LINES[k].map((l) => withPlace(l, 'The giant’s skull'))]), ...Object.values(HOUSE_LINES)];
  for (const l of critical) {
    const { talk, bark } = splitBark(l);
    assert.ok(!/^(Look|This way|Over here|Back here)[.!]?$/.test(parseLine(talk).text.split(/(?<=[.?!])\s+/).at(-1)), `${l}: no pointing word left in the box`);
    const pages = talkPages(talk);
    assert.ok(pages.length >= 1 && pages.length <= 3, `${l}: ${pages.length} pages`);
    for (const p of pages) {
      const { text, tone, explicit } = parseLine(p);
      assert.ok(explicit && tone === parseLine(l).tone, `${p}: the line's tone`);
      const n = text.split(/\s+/).filter(Boolean).length;
      assert.ok(n <= 9 && (n >= PAGE_WORDS || pages.length === 1), `${p}: ${n} words`);
    }
    assert.equal([...pages, ...(bark ? [bark] : [])].map((p) => parseLine(p).text).join(' '), parseLine(l).text, 'the whole line, nothing lost: the talk, then the bark');
  }
  const t = plumbTalk(['~curious~ Lost? A little.']);
  assert.equal(t.name, 'Plumb'); assert.equal(t.id, PLUMB_PERSON.id); assert.ok(t.companion);
  assert.ok(t.talk.nodes.plumb.listen, 'no answers: the next press closes it');
});

test('the critical queue: one talk waits, nothing else of its own meanwhile; taken, dropped, or gone with the setting', () => {
  assert.deepEqual(CRITICAL, ['still', 'away', 'circling', 'house', 'bladegate']);
  const s = state(), c = new Companion({ state: s, hints: () => 'subtle' });
  s.set('met.x', true);
  c.note('bladegate');
  const r = c.update(0.5, { pos: { x: 0, y: 0, z: 0 } });
  assert.equal(r.say, ''); assert.equal(r.hail.id, 'bladegate'); assert.equal(c.pending, r.hail);
  // the opening's chatter and the lost watch wait while it does
  c.note('chest');
  for (let t = 0; t < LOST.after.on + 60; t += 0.5) {
    const q = c.update(0.5, { pos: { x: Math.cos(t), y: 0, z: Math.sin(t) }, goal: { x: 80, y: 0, z: 0 } });
    assert.ok(!q.say && !q.point && !q.hail, `${t}: quiet while a talk waits`);
  }
  assert.equal(c.take().id, 'bladegate'); assert.equal(c.pending, null);
  assert.equal(c.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).say, DRONE_LINES.chest, 'then the chatter, on the cue as before');
  // the opening's own lines stay on the cue (they come before the button is taught)
  const o = new Companion({ state: state(), hints: () => 'subtle' });
  o.note('out');
  assert.equal(o.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).say, DRONE_LINES.out);
  assert.equal(o.pending, null);
  // the setting off lets it go
  let setting = 'on';
  const d = new Companion({ state: state(), setting: () => setting, hints: () => 'subtle' });
  d.state.set('met.x', true); d.note('bladegate'); d.update(0.5, { pos: { x: 0, y: 0, z: 0 } });
  assert.ok(d.pending);
  setting = 'off'; d.update(0.5, { pos: { x: 0, y: 0, z: 0 } });
  assert.equal(d.pending, null);
});

/** wireCompanion with a stand-in scout, dialogue box and sound (what the hosts give it). */
async function talkRig({ speaking = () => false, met = true } = {}) {
  const { wireCompanion } = await import('../src/host/game-host.js');
  const THREE = await import('three');
  const { GameState } = await import('../src/game-state.js');
  const game = new GameState({ getItem: () => null, setItem: () => {} });
  if (met) game.set('met.someone', true);
  const calls = [];
  const scout = {
    out: false, phase: 'away', escortT: 0, hailing: false, object: new THREE.Object3D(),
    escort(s) { this.out = true; this.phase = 'escort'; this.escortT = s; calls.push('escort'); return true; },
    hail(on) { this.hailing = on; calls.push(on ? 'hail' : 'unhail'); },
    talk() { this.phase = 'talk'; calls.push('talk'); }, ping() { this.phase = 'seek'; calls.push('ping'); return true; },
    home() { this.phase = 'leave'; calls.push('home'); }, express() {},
    getTarget: () => ({ id: 'q', label: 'The giant’s skull', position: new THREE.Vector3(80, 0, 0) }),
  };
  const box = { open: false, said: null, start(person, npc) { this.open = true; this.said = { person, npc }; return true; }, close() { this.open = false; game.emit('dialogue:end', { id: this.said.person.id }); } };
  const sounds = [], taught = [];
  const plumb = new Companion({ state: game, hints: () => 'subtle' });
  const player = { pos: new THREE.Vector3(), frame: { up: new THREE.Vector3(0, 1, 0) } };
  const step = wireCompanion({ game, plumb, scout, level: {}, player, npcs: [], struggle: { t: 0 }, sound: { drone: (k) => sounds.push(k) }, dialogue: () => box, teach: () => taught.push(1), speaking });
  return { step, scout, box, sounds, taught, calls, plumb, game };
}

test('Plumb\'s button with nothing to tell: false, the host pings as before', async () => {
  const { step, calls } = await talkRig();
  for (let k = 0; k < 4; k++) assert.equal(step(0.5), '');
  assert.equal(step.press(), false);
  assert.equal(step.hailing, false);
  assert.deepEqual(calls, [], 'the scout untouched');
});

test('something critical: at your shoulder with its mark and a call; the button opens its talk, then the flight', async () => {
  const { step, scout, box, sounds, taught, calls, plumb } = await talkRig();
  plumb.note('bladegate');
  assert.equal(step(0.5), '', 'nothing on the cue');
  assert.deepEqual(calls, ['escort', 'hail']);
  assert.ok(scout.escortT > HAIL.secs, 'it waits at your shoulder');
  assert.deepEqual(sounds, ['call']); assert.equal(taught.length, 1);
  assert.equal(step.hailing, true);
  // the button: the talk in the dialogue box, Plumb's name and pages, its stand-in to frame and portray
  assert.equal(step.press(), true);
  assert.equal(scout.phase, 'talk', 'before your face at once');
  assert.equal(box.open, false, 'the talk a frame or two later (an engine\'s portrait draws the drone where it is drawn)');
  assert.equal(step.press(), true, 'a second press meanwhile does not ping');
  step(1 / 60); step(1 / 60);
  assert.equal(box.open, true);
  assert.equal(box.said.person.name, 'Plumb');
  assert.deepEqual(box.said.person.talk.nodes.plumb.say, talkPages(DRONE_LINES.bladegate));
  assert.equal(box.said.npc.object, scout.object);
  assert.ok(box.said.npc.portraitShot().eye, 'a portrait of it');
  assert.equal(plumb.pending, null); assert.equal(scout.hailing, false); assert.equal(scout.phase, 'talk');
  assert.equal(step.press(), false, 'pressed again mid-talk: nothing new');
  box.close();
  assert.equal(calls.at(-1), 'home', 'the gate\'s talk over: nowhere to fly, it goes home (#563)');
  assert.equal(step(0.5), '', 'and nothing on the cue');
});

test('a lost talk: the box says it, then Plumb flies toward the goal with its pointing word on the cue (issue #559)', async () => {
  const { step, box, calls, plumb, game } = await talkRig();
  game.set('drone.said.pointer', true);
  // (lost: the clock run out while walking; the pending talk as the companion makes it)
  let r = null;
  for (let t = 0; t < LOST.after.on + 10 && !r?.hail; t += 0.25) r = plumb.update(0.25, { pos: { x: 12 + Math.cos(t), y: 0, z: 12 + Math.sin(t) }, goal: { x: 80, y: 0, z: 12 }, place: 'The giant’s skull' });
  assert.ok(r?.hail, 'a talk waits');
  const { bark, pages } = r.hail;
  assert.match(bark, /^~\w+~ The giant’s skull: (this way|over here)\.$/, 'the place and the way: its bark');
  assert.ok(pages.length && pages.every((p) => !/giant’s skull/.test(p)), 'not in the box');
  step(0.5);
  assert.equal(step.press(), true);
  step(1 / 60); step(1 / 60);
  assert.deepEqual(box.said.person.talk.nodes.plumb.say, pages, 'the talk without its pointing word');
  box.close();
  assert.equal(calls.at(-1), 'ping', 'the talk over, it flies toward the goal as the button does');
  assert.equal(step(0.5), shown(bark), 'its pointing word on the cue as it goes, as its other lines show');
  assert.equal(step(0.5), '', 'once');
});

test('unanswered it lets the talk go; a scene puts it away and it comes again; never over another talk', async () => {
  const { step, scout, box, calls, plumb } = await talkRig();
  plumb.note('bladegate');
  step(0.5);
  // a scene: the scout hidden (away): the mark is lowered and raised again once it can be
  scout.phase = 'away'; scout.out = false;
  step(0.5);
  assert.equal(step.hailing, false); assert.ok(plumb.pending);
  step(0.5, { canSpeak: false });
  assert.equal(step.hailing, false, 'not while something else is up');
  step(0.5);
  assert.equal(step.hailing, true, 'back at your shoulder');
  assert.equal(calls.filter((c) => c === 'escort').length, 2);
  // the dialogue box busy: the button pings as before
  box.open = true;
  assert.equal(step.press(), false);
  box.open = false;
  // unanswered
  for (let t = 0; t <= HAIL.secs + 1; t += 0.5) step(0.5);
  assert.equal(plumb.pending, null); assert.equal(step.hailing, false);
  assert.equal(step.press(), false);
});

// ------------------------------------------------------------------ the landing's talk (issue #781)
test('the landing\'s talk: its lines carry tones, are terse, name no button, and the goal is one short line', () => {
  const lines = [...LANDING_TALK.pages, LANDING_TALK.answer];
  for (const l of lines) {
    assert.ok(parseLine(l).explicit, `${l}: a tone`);
    for (const sentence of parseLine(l).text.match(/[^.?!]+[.?!]/g)) assert.ok(sentence.trim().split(/\s+/).length <= 7, `${l}: terse (two to seven words a sentence, lore/characters/plumb.md)`);
    assert.ok(!/R3|\{key|Q\b|D-pad|[AXYB] \//.test(l), `${l}: no button`);
  }
  assert.match(LANDING_TALK.pages[0], /\*That city\*, under the dark tree/, 'where to go, as the quest\'s first step shows it (Qanat, under the dark tree)');
  assert.ok(!/Qanat/.test(LANDING_TALK.pages.join(' ')), 'knowledge before names: it points at the city it sees, nobody has named it yet (lore/voice-guide.md)');
  assert.ok(!/\b(ask|talk to|see|meet)\b/i.test(LANDING_TALK.pages.join(' ')), 'nobody sends you to somebody else');
  assert.match(LANDING_TALK.answer, /let’s go/i, 'his answer follows from what it just said (someone there might help: then let\'s go)');
  assert.equal(LANDING_TALK.emit, 'drone:village', 'the desert\'s quest starts as it ends');
  const t = plumbTalk(LANDING_TALK.pages, LANDING_TALK.answer).talk.nodes.plumb;
  assert.deepEqual(t.say, LANDING_TALK.pages);
  assert.deepEqual(t.choices, [{ text: LANDING_TALK.answer, end: true }], 'one answer, that ends it');
});

test('stepping out after the prologue, Plumb opens its talk by itself, once; the quest starts as it ends, then it flies the way', async () => {
  const { step, scout, box, calls, plumb, game, sounds } = await talkRig({ met: false });
  const village = [];
  game.on('drone:village', () => village.push(1));
  game.emit('drone:out', { pos: null });   // (the prologue's end: src/ship/cinematics.js finish)
  assert.equal(game.flag(LANDING_FLAG), 'due');
  game.emit('ship:exit');   // (the old silent lines would come from this: no longer)
  plumb.note('out');
  step(0.2, { canSpeak: false });
  assert.equal(box.open, false, 'not while something is on the screen');
  step(LANDING.after / 2); step(1 / 60); step(1 / 60);
  assert.equal(box.open, false, 'a moment of quiet first');
  for (let k = 0; k < 4 && !box.open; k++) step(LANDING.after / 2);
  assert.equal(scout.phase, 'talk', 'before your face');
  step(1 / 60); step(1 / 60);
  assert.equal(box.open, true, 'the talk, opened by itself: no button');
  assert.ok(!calls.includes('hail') && !sounds.includes('call'), 'no mark, no call: it does not wait to be asked');
  assert.equal(box.said.person.name, 'Plumb');
  assert.deepEqual(box.said.person.talk.nodes.plumb.say, LANDING_TALK.pages);
  assert.equal(box.said.person.talk.nodes.plumb.choices[0].text, LANDING_TALK.answer);
  assert.deepEqual([game.flag(LANDING_FLAG), game.flag('drone.said.out'), game.flag('drone.said.recharge')], [true, true, true], 'had: once a save');
  assert.equal(village.length, 0, 'the quest waits for the talk\'s end');
  box.close();
  assert.equal(village.length, 1, 'the desert\'s quest starts as the talk ends');
  assert.equal(calls.at(-1), 'ping', 'then it flies the way');
  assert.equal(step(0.5), '', 'nothing on the cue: the quest\'s card is up as it goes');
  // the opening's out and recharge lines, the old top-of-screen ones, never come after it
  for (let k = 0; k < 20; k++) { const r = plumb.update(0.5, { pos: { x: 0, y: 0, z: 0 } }); assert.ok(r.say !== DRONE_LINES.out && r.say !== DRONE_LINES.recharge && !r.talk); }
  // once a save: the prologue replayed (?prologue=1) on it does not bring it again
  game.emit('drone:out', { pos: null });
  for (let k = 0; k < 6; k++) step(0.5);
  assert.equal(box.open, false); assert.equal(plumb.pending, null);
});

test('the landing\'s talk never over a line being said, a fight or a ride, and not let go unanswered', async () => {
  let talking = true;
  const { step, box, plumb, game } = await talkRig({ speaking: () => talking });
  game.emit('drone:out', { pos: null });
  for (let t = 0; t < HAIL.secs + 5; t += 0.5) step(0.5);
  assert.equal(box.open, false, 'the ship\'s lines first');
  assert.ok(plumb.pending === null || plumb.pending.auto, 'still due');
  for (let t = 0; t < 3; t += 0.5) step(0.5, { fight: true });
  assert.equal(box.open, false, 'not in a fight');
  talking = false;
  for (let k = 0; k < 6 && !box.open; k++) step(0.5);
  step(1 / 60); step(1 / 60);
  assert.equal(box.open, true);
  // the drone's hints off: it is the quest's opening talk, not a hint
  const off = new Companion({ state: state(), setting: () => 'off', hints: () => 'subtle' });
  off.land();
  let r = null;
  for (let k = 0; k < 4 && !r?.talk; k++) r = off.update(0.5, { pos: { x: 0, y: 0, z: 0 } });
  assert.ok(r?.talk, 'said with the drone\'s hints off too');
  off.drop(); off.update(0.5, { pos: { x: 0, y: 0, z: 0 } });
  assert.ok(off.pending?.auto, 'never let go unsaid');
});

test('a save past the prologue from before the landing\'s talk never has it; its opening lines as they were', () => {
  // (prologue.done, no landing flag: the prologue never plays again, so drone:out never comes)
  const s = state(); s.set('prologue.done', true);
  const c = new Companion({ state: s, hints: () => 'subtle' });
  for (let k = 0; k < 6; k++) assert.ok(!c.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).talk);
  assert.equal(s.flags[LANDING_FLAG], undefined, 'the save untouched');
  c.note('out');
  assert.equal(c.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).say, DRONE_LINES.out, 'its own first steps out, as before');
  // and one that has had it keeps it had
  const h = state(); h.set(LANDING_FLAG, true);
  const d = new Companion({ state: h, hints: () => 'subtle' });
  d.land();
  assert.equal(h.flags[LANDING_FLAG], true);
  for (let k = 0; k < 6; k++) assert.ok(!d.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).talk);
  // a reload with the talk still due (closed before it opened) has it then
  const r = state(); r.set(LANDING_FLAG, 'due');
  const e = new Companion({ state: r, hints: () => 'subtle' });
  let got = null;
  for (let k = 0; k < 4 && !got; k++) got = e.update(0.5, { pos: { x: 0, y: 0, z: 0 } }).talk;
  assert.ok(got, 'still due after a reload');
});
