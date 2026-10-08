// The drum circle and the sketch hunt (docs/systems/minigames.md): the rhythm game's chart, timing windows,
// combo and clock (src/minigames/rhythm.js), the sketch hunt's framing, list and score (src/minigames/framing.js),
// and the start card's options in the kit (src/minigames/kit/flow.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGame } from '../src/minigames/index.js';
import { optionValue, stepOption, optionText, optionKey, scoreDef } from '../src/minigames/kit/flow.js';
import { recordScore, bestScore } from '../src/minigames/kit/scores.js';
import {
  LANES, LEVELS, JUDGE, POINTS, SONG, drumSong, eventsBetween, barEvents, songBars, heardSongTime, newRun, judgePress, sweepMisses,
  runDone, accuracy, rank, timingAdvice, fervour, multiplier, grade,
} from '../src/minigames/rhythm.js';
import { frameScore, pickList, huntScore, bestTarget, verdict, stars, FRAMING } from '../src/minigames/framing.js';
import drums, { SEATS, DANCERS, ringLayout } from '../src/minigames/drums.js';
import sketchhunt, { POOL, HUNT } from '../src/minigames/sketchhunt.js';

const fakeState = () => { const f = {}; return { flags: f, flag: (k) => f[k], set: (k, v) => { f[k] = v; } }; };
const seeded = (s = 1) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

// ------------------------------------------------------------------ the two games are complete
test('the drum circle and the sketch hunt are complete games, their prompts in pad form', () => {
  for (const g of [drums, sketchhunt]) {
    assert.deepEqual(checkGame(g), [], g.id);
    assert.ok(g.controls.pad.length && g.controls.keys.length && g.controls.touch.length, `${g.id}: controls for the pad, the keys, a touch screen`);
    for (const [k] of g.controls.pad) assert.doesNotMatch(k, /\b(Space|Shift|Esc|Enter|Click)\b/, `${g.id}: "${k}" is a key, not a pad button`);
  }
  assert.ok(drums.controls.pad.some(([k]) => k === 'A / ×') && drums.controls.pad.some(([k]) => k === 'Y / △'));
  assert.equal(sketchhunt.world, 'bazaar');
  assert.equal(sketchhunt.drives, false, 'the hunt is played on foot');
  assert.equal(sketchhunt.hud.countdown, HUNT.seconds);
  assert.ok(HUNT.seconds === 180 && HUNT.n === 6);
});

// ------------------------------------------------------------------ the start card's options
test('a game\'s options: the kept value if allowed, else the default; a stepper held in its range; a best per difficulty', () => {
  const S = fakeState();
  assert.equal(optionValue(drums, S, 'level'), 'normal');
  assert.equal(optionValue(drums, S, 'offset'), 0);
  S.set(optionKey('drums', 'level'), 'hard');
  S.set(optionKey('drums', 'offset'), 350);
  assert.equal(optionValue(drums, S, 'level'), 'hard');
  assert.equal(optionValue(drums, S, 'offset'), 200, 'held inside the range');
  S.set(optionKey('drums', 'level'), 'impossible');
  assert.equal(optionValue(drums, S, 'level'), 'normal', 'a value no longer offered: the default');
  const off = drums.options.find((o) => o.id === 'offset');
  assert.equal(stepOption(off, 20, 1), 30);
  assert.equal(stepOption(off, -195, -1), -200);
  assert.equal(optionText(off, 20), '+20 ms');
  assert.equal(optionText(off, -10), '-10 ms');
  // each difficulty keeps a best of its own
  S.set(optionKey('drums', 'level'), 'easy');
  assert.equal(scoreDef(drums, S).id, 'drums.easy');
  recordScore(S, scoreDef(drums, S), 900);
  S.set(optionKey('drums', 'level'), 'hard');
  assert.equal(bestScore(S, scoreDef(drums, S)), null, 'Hard has no best yet');
  recordScore(S, scoreDef(drums, S), 500);
  assert.equal(bestScore(S, scoreDef(drums, S)), 500);
  assert.equal(scoreDef(sketchhunt, S), sketchhunt, 'no bestBy: the game itself');
});

// ------------------------------------------------------------------ the song and its chart
test('the chart: three lanes on quarters for Easy, four on eighths for Normal, sixteenths and chords on Hard', () => {
  const songs = Object.fromEntries(Object.keys(LEVELS).map((l) => [l, drumSong(l)]));
  const e = songs.easy, n = songs.normal, h = songs.hard;
  assert.ok(e.notes.length < n.notes.length && n.notes.length < h.notes.length, 'harder, more notes');
  assert.ok(e.notes.every((q) => q.lane < 3), 'Easy: no top glyph');
  assert.ok(e.notes.every((q) => Math.abs(q.beat * 1 - Math.round(q.beat)) < 1e-9), 'Easy: on the beat');
  assert.ok(n.notes.every((q) => Math.abs(q.beat * 2 - Math.round(q.beat * 2)) < 1e-9), 'Normal: on the eighths');
  assert.ok(h.notes.some((q) => Math.abs(q.beat * 2 - Math.round(q.beat * 2)) > 0.1), 'Hard: sixteenths');
  assert.ok(new Set(n.notes.map((q) => q.lane)).size === 4 && new Set(e.notes.map((q) => q.lane)).size === 3);
  const chords = h.notes.filter((q, i) => i && h.notes[i - 1].beat === q.beat);
  assert.ok(chords.length > 4, 'Hard has two glyphs at once');
  assert.ok(!n.notes.some((q, i) => i && n.notes[i - 1].beat === q.beat), 'Normal: one at a time');
  for (const s of Object.values(songs)) {
    assert.ok(s.notes.every((q, i) => !i || q.t >= s.notes[i - 1].t), 'in order');
    assert.ok(s.notes.every((q) => q.t >= 0 && q.t < s.length));
    assert.ok(s.length > 60 && s.length < 120, `a song of a minute or two (${s.length.toFixed(0)} s)`);
    assert.equal(s.spb, 60 / SONG.bpm);
  }
  // the lanes are the face buttons, by position, each with its own drum and keys
  assert.deepEqual(LANES.map((l) => l.at), ['bottom', 'right', 'left', 'top']);
  assert.equal(new Set(LANES.flatMap((l) => l.keys)).size, 8);
});

test('the backing: the desert\'s instruments by section, scheduled in windows that add up to the whole', () => {
  const bars = songBars();
  const all = eventsBetween(0, bars.length * SONG.meter, bars);
  // in pieces, as the scheduler takes it (40 ms ahead at a time): the same events, none twice, none lost
  const pieces = [];
  for (let b = 0; b < bars.length * SONG.meter; b += 0.37) pieces.push(...eventsBetween(b, Math.min(b + 0.37, bars.length * SONG.meter), bars));
  assert.equal(pieces.length, all.length);
  assert.deepEqual(pieces.map((e) => e.beat), all.map((e) => e.beat));
  assert.equal(barEvents(0, bars).filter((e) => e.layer === 'oud').length, 0, 'the lead-in: the drone and the shaker only');
  const layers = (i) => new Set(barEvents(i, bars).map((e) => e.layer));
  const circle = bars.findIndex((b) => b.section.name === 'circle');
  for (const l of ['drone', 'bass', 'oud', 'frame', 'ney', 'shaker']) assert.ok([...Array(4).keys()].some((k) => layers(circle + k).has(l)), `the whole circle plays: ${l}`);
  assert.ok(all.every((e) => e.vol > 0 && e.vol < 0.2), 'levels under the score\'s own');
  assert.ok(all.every((e) => e.kind !== 'hit' || ['darbuka', 'knock', 'shaker'].includes(e.voice)));
});

test('the song\'s clock: what is heard, from the audio output\'s timestamp (or the context\'s time less its latency)', () => {
  const stamp = { contextTime: 10, performanceTime: 5000 };
  assert.ok(Math.abs(heardSongTime(5000, { t0: 9, stamp }) - 1) < 1e-9, 'at the stamp: its context time');
  assert.ok(Math.abs(heardSongTime(5250, { t0: 9, stamp }) - 1.25) < 1e-9, 'a press 250 ms later');
  // no stamp: the context's time, less the output's latency, carried to the moment asked
  assert.ok(Math.abs(heardSongTime(6100, { t0: 2, currentTime: 4, latency: 0.05, perfNow: 6000 }) - 2.05) < 1e-9);
  assert.ok(Math.abs(heardSongTime(6000, { t0: 2, stamp: { contextTime: 0, performanceTime: 0 }, currentTime: 4, latency: 0, perfNow: 6000 }) - 2) < 1e-9, 'an empty stamp is no stamp');
});

// ------------------------------------------------------------------ judging
test('a press on the beat is perfect, near it good, far off a stray; each glyph is played once', () => {
  assert.equal(grade(0.03), 'perfect');
  assert.equal(grade(-JUDGE.perfect), 'perfect');
  assert.equal(grade(0.09), 'good');
  assert.equal(grade(-0.105), 'good');
  assert.equal(grade(0.2), null);
  const song = drumSong('normal'), run = newRun(song), n0 = song.notes[0];
  assert.equal(judgePress(run, n0.lane, n0.t + 0.02).kind, 'perfect');
  assert.equal(run.score, POINTS.perfect);
  assert.equal(judgePress(run, n0.lane, n0.t + 0.03).kind, 'stray', 'the same glyph again: a stray');
  assert.equal(run.combo, 1, 'a stray breaks nothing');
  const other = song.notes.find((q) => q.lane !== n0.lane && q.t > n0.t + 0.5);
  assert.equal(judgePress(run, (other.lane + 1) % 4, other.t).kind, 'stray', 'the wrong lane');
  // the notes run past unplayed: missed, the combo broken
  const missed = sweepMisses(run, other.t + JUDGE.late + 0.01);
  assert.ok(missed.length >= 1 && run.combo === 0 && run.counts.miss === missed.length);
});

test('the combo multiplies the points, up to four times', () => {
  assert.deepEqual([0, 9, 10, 19, 20, 30, 99].map(multiplier), [1, 1, 2, 2, 3, 4, 4]);
  const song = drumSong('hard'), run = newRun(song);
  for (const n of song.notes.slice(0, 35)) judgePress(run, n.lane, n.t);
  const want = song.notes.slice(0, 35).reduce((a, _, i) => a + POINTS.perfect * multiplier(i), 0);
  assert.equal(run.score, want);
  assert.equal(run.best, 35);
  assert.ok(fervour(0) === 0 && fervour(20) > 0.4 && fervour(40) === 1 && fervour(80) === 1, 'the circle dances harder with the combo');
});

test('a perfect drummer plays every song through at every level; a sloppy one gets goods and misses', () => {
  for (const level of Object.keys(LEVELS)) {
    const song = drumSong(level), run = newRun(song);
    for (let t = -1; t < song.length + 1; t += 1 / 60) {
      for (const n of song.notes) if (!run.judged[n.i] && n.t <= t && n.t > t - 1 / 60) judgePress(run, n.lane, t);
      sweepMisses(run, t);
    }
    assert.ok(runDone(run), level);
    assert.equal(run.counts.miss, 0, level);
    assert.equal(run.counts.perfect + run.counts.good, song.notes.length);
    assert.equal(rank(accuracy(run)), 'S');
    assert.ok(run.counts.perfect / song.notes.length > 0.95, `${level}: at 60 fps the presses are within a frame (${run.counts.good} good)`);
  }
  // 80 ms late every time, and every fifth glyph not played
  const song = drumSong('normal'), run = newRun(song);
  song.notes.forEach((n, i) => { if (i % 5) judgePress(run, n.lane, n.t + 0.08); sweepMisses(run, n.t + 0.08); });
  sweepMisses(run, song.length + 1);
  assert.ok(runDone(run));
  assert.equal(run.counts.perfect, 0);
  assert.ok(run.counts.miss >= Math.floor(song.notes.length / 5));
  assert.ok(accuracy(run) < 0.5 && ['C', 'D'].includes(rank(accuracy(run))));
  // and the results tell them to move the timing: 80 ms late, try +80
  const adv = timingAdvice(run, 0);
  assert.equal(adv.ms, 80);
  assert.equal(adv.suggest, 80);
  assert.equal(timingAdvice(run, 30).suggest, 110, 'on top of the offset already set');
  assert.equal(timingAdvice(newRun(song), 0), null, 'no hits: nothing to say');
});

test('the Timing offset takes a steady lag off every press', () => {
  const song = drumSong('easy'), run = newRun(song), lag = 0.09, offset = 0.09;
  for (const n of song.notes) judgePress(run, n.lane, n.t + lag - offset);
  assert.equal(run.counts.perfect, song.notes.length);
});

// ------------------------------------------------------------------ the camp
test('the circle: seven places round the fire facing it, the dancers clear of the benches and the fire', () => {
  for (const s of SEATS) {
    assert.ok(Math.abs(Math.hypot(s.x, s.z) - 4.3) < 1e-6);
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    assert.ok(fx * -s.x + fz * -s.z > 4.2, 'facing the fire');
  }
  for (const d of DANCERS) {
    const r = Math.hypot(d.x, d.z);
    assert.ok(r > 2.2, 'clear of the fire');
    assert.ok(Math.abs(r - 4.3) > 0.6, 'clear of the benches');
  }
  const L = ringLayout(1280, 720);
  assert.ok(L.cy + L.R + L.L <= 720 - 20 && L.cy - L.R - L.L >= 60, 'the spokes on the screen, under the HUD');
  const P = ringLayout(720, 1280);
  assert.ok(P.cx + P.R + P.L <= 720 && P.cx - P.R - P.L >= 0, 'and on a phone held upright');
});

// ------------------------------------------------------------------ the sketch hunt
const eye0 = { x: 0, y: 1.6, z: 0 };
const view = (fwd = { x: 0, y: 0, z: -1 }, fov = 46, eye = eye0) => ({ eye, fwd, up: { x: 0, y: 1, z: 0 }, fov, aspect: 1.6 });
// a subject of radius 1 at a distance where it fills 60 % of the frame's height
const fitDist = (r, fill = FRAMING.fill, fov = 46) => r / Math.sin(Math.atan(fill * Math.tan((fov * Math.PI) / 360)));

test('a sketch scores by how well its subject fills and centres the frame', () => {
  const d = fitDist(1);
  const good = frameScore(view(), { c: { x: 0, y: 1.6, z: -d }, r: 1 });
  assert.ok(good.q > 0.98 && Math.abs(good.size - FRAMING.fill) < 1e-6, 'filling the frame, in the middle');
  const off = frameScore(view(), { c: { x: d * 0.25, y: 1.6, z: -d }, r: 1 });
  assert.ok(off.q < good.q && off.q > 0.3, 'off to the side: less');
  const edge = frameScore(view(), { c: { x: d * 0.62, y: 1.6, z: -d }, r: 1 });
  assert.ok(edge.q < off.q, 'at the edge: less still');
  const far = frameScore(view(), { c: { x: 0, y: 1.6, z: -d * 4 }, r: 1 });
  const near = frameScore(view(), { c: { x: 0, y: 1.6, z: -d / 3 }, r: 1 });
  assert.ok(far.q < 0.3 && near.q < 0.6, `too small (${far.q.toFixed(2)}) or too big (${near.q.toFixed(2)}) is a poor sketch`);
  // a zoom brings the far one back
  const zoomed = frameScore(view(undefined, 46 / 4.4), { c: { x: 0, y: 1.6, z: -d * 4 }, r: 1 });
  assert.ok(zoomed.q > 0.9, 'zoomed in on it');
  assert.equal(frameScore(view({ x: 0, y: 0, z: 1 }), { c: { x: 0, y: 1.6, z: -d }, r: 1 }).q, 0, 'behind you');
  assert.equal(frameScore(view({ x: 1, y: 0, z: 0 }), { c: { x: 0, y: 1.6, z: -d }, r: 1 }).q, 0, 'out of the frame');
});

test('a landmark from the side the list asks for, and only from where it says', () => {
  const d = fitDist(2);
  const t = { c: { x: 0, y: 1.6, z: -d }, r: 2 };
  const south = { from: { dir: { x: 0, y: 0, z: 1 }, within: 30 } };   // (to be seen from +z: where the eye is)
  assert.ok(frameScore(view(), t, south).q > 0.95);
  const north = { from: { dir: { x: 0, y: 0, z: -1 }, within: 30 } };
  assert.equal(frameScore(view(), t, north).q, 0, 'from the wrong side');
  // a screen seen square on: its own side (from 'normal')
  const screen = { ...t, n: { x: Math.sin(0.35), y: 0, z: Math.cos(0.35) } };
  assert.ok(frameScore(view(), screen, { from: 'normal', within: 24 }).q > 0.95, '20° off its face: within');
  assert.ok(frameScore(view(), { ...t, n: { x: 1, y: 0, z: 0 } }, { from: 'normal', within: 24 }).q < 0.2, 'side on: not');
  const there = { eye: (e) => e.z > -5 }, elsewhere = { eye: (e) => e.z < -100 };
  assert.ok(frameScore(view(), t, there).q > 0.95);
  assert.ok(frameScore(view(), t, elsewhere).q < 0.2, 'not from where you must stand');
  assert.ok(frameScore(view(), t, elsewhere).q < FRAMING.min);
});

test('the best target in the frame that can be seen', () => {
  const d = fitDist(1);
  const a = { c: { x: 0, y: 1.6, z: -d }, r: 1 }, b = { c: { x: 1.5, y: 1.6, z: -d }, r: 1 };
  assert.equal(bestTarget(view(), [b, a], {}).t, a);
  assert.equal(bestTarget(view(), [b, a], {}, (t) => t !== a).t, b, 'the best is behind a wall: the next');
  assert.equal(bestTarget(view(), [a], {}, () => false), null);
  assert.equal(bestTarget(view(), [], {}), null);
});

test('the list: six from the pool, a person always, the kinds mixed, never the same twice', () => {
  const kinds = new Set(POOL.map((s) => s.kind));
  assert.deepEqual([...kinds].sort(), ['animal', 'landmark', 'person', 'plant', 'thing']);
  assert.equal(new Set(POOL.map((s) => s.id)).size, POOL.length, 'ids unique');
  for (const s of POOL) assert.ok(s.name && s.hint && typeof s.targets === 'function', s.id);
  const lists = [];
  for (let k = 1; k <= 40; k++) {
    const L = pickList(POOL, seeded(k), 6);
    assert.equal(L.length, 6);
    assert.equal(new Set(L.map((s) => s.id)).size, 6, 'none twice');
    assert.ok(L.some((s) => s.kind === 'person'), 'someone doing something');
    assert.equal(new Set(L.map((s) => s.kind)).size, 5, 'every kind');
    lists.push(L.map((s) => s.id).sort().join());
  }
  assert.ok(new Set(lists).size > 30, `the list varies (${new Set(lists).size} different of 40)`);
  assert.deepEqual(pickList(POOL, seeded(7), 6), pickList(POOL, seeded(7), 6), 'the same seed, the same list');
  // what the world can't show is left off
  const L = pickList(POOL, seeded(3), 6, (s) => s.kind !== 'animal');
  assert.ok(!L.some((s) => s.kind === 'animal') && L.length === 6);
});

test('the pool finds its subjects in a world: creatures, plants, the crowd at what they do, cabs, screens, the tower', () => {
  const V = (x, y, z) => ({ x, y, z, clone() { return V(x, y, z); } });
  const W = {
    wildlife: { creatures: [{ species: { id: 'ticketFinch' }, pos: V(1, 0, 2), wpos: V(1, 0, 2), size: 1 }, { species: { id: 'signBug' }, pos: V(0, 0, 0), hidden: true }] },
    flora: { plants: [{ sp: { id: 'bazaar.lampflower' }, x: 3, y: 0, z: 4, height: 4 }] },
    crowd: { people: [] },
    level: { reactiveScreens: [{ pos: { x: 22, y: 6, z: 0, clone() { return { ...this }; } }, w: 4, h: 3, yaw: Math.PI / 2 }], flammables: [{ kind: 'lantern', at: { x: 1, y: 3, z: 1 } }], signal: { places: { oldSign: { x: -20, y: 21, z: -86 } } } },
    vehicles: [{ kind: 'taxi', mode: 'route', pos: V(0, 40, 0) }, { kind: 'taxi', mode: 'parked', pos: V(8, 2, 82) }],
  };
  const by = Object.fromEntries(POOL.map((s) => [s.id, s]));
  assert.equal(by.finch.targets(W).length, 1);
  assert.equal(by.signbug.targets(W).length, 0, 'a hidden bug is not there');
  const lamp = by.lampflower.targets(W)[0];
  assert.ok(lamp.c.y === 2 && lamp.r > 2);
  assert.equal(by.cab.targets(W).length, 1, 'the parked cab is not in flight');
  const sc = by.screen.targets(W)[0];
  assert.ok(sc.n.x < -0.99, 'a screen on the right-hand shops faces the avenue');
  assert.equal(by.lantern.targets(W).length, 1);
  assert.equal(by['tower-square'].targets(W).length, 1);
  assert.equal(by.oldsign.targets(W).length, 1);
  assert.equal(by.kerb.targets(W).length, 0);
});

test('the hunt\'s score: each subject\'s best, and the time left only for the whole list', () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ q: 0.5 + i * 0.05 }));
  const all = huntScore(six, 40, 6);
  assert.equal(all.base, [50, 55, 60, 65, 70, 75].reduce((a, b) => a + b, 0));
  assert.equal(all.bonus, 80);
  assert.equal(all.total, all.base + 80);
  const five = huntScore([...six.slice(0, 5), null], 40, 6);
  assert.equal(five.bonus, 0);
  assert.equal(five.found, 5);
  assert.equal(huntScore([{ q: 0.1 }], 100, 1).found, 0, 'too rough to count');
  assert.equal(stars(0.9), 3); assert.equal(stars(0.6), 2); assert.equal(stars(0.3), 1); assert.equal(stars(0.1), 0);
  assert.match(verdict(0.9), /fine/);
});
