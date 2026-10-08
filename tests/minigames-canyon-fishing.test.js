// Two of the minigames (docs/systems/minigames.md): the Canyon run (the loop and its canyon, the bike on
// it, the race's splits, a rider that drives three laps) and Fishing (the cast, the bite, the fight's
// tension, the fish's kinds and the journal).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGame } from '../src/minigames/index.js';
import canyon, { makeTrack, makeCourse, nearest, pointAt, profileHeight, inGap, rampAt, newBike, bikeStep, botInput, newRace, raceStep, splitAt, splitDelta, fmtDelta, BIKE } from '../src/minigames/canyon.js';
import fishing, { SPECIES, castPower, castDistance, biteSchedule, hookResult, newFight, fightStep, botFight, recordCatch, pickSpecies, rollWeight, oasisHeight, POND, FIGHT, speciesById } from '../src/minigames/fishing.js';

const seeded = (s = 1) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const K = makeCourse();

test('both games are complete definitions, their prompts in the pad\'s form', () => {
  for (const g of [canyon, fishing]) {
    assert.deepEqual(checkGame(g), [], g.id);
    assert.ok(g.controls.pad.length && g.controls.keys.length && g.controls.touch.length);
    for (const [k] of g.controls.pad) assert.doesNotMatch(k, /\b(Space|Shift|Esc|Enter)\b/, `${g.id}: "${k}"`);
    assert.ok(g.controls.pad.some(([k]) => /RT \/ R2/.test(k)) && g.controls.pad.some(([k]) => /A \/ ×/.test(k)));
  }
  assert.equal(canyon.score.kind, 'time');
  assert.equal(fishing.score.kind, 'points');
  assert.equal(fishing.score.format(4.25), '4.3 kg');
});

// ------------------------------------------------------------------ the canyon
test('the loop: closed, about 1.2 km, and every place found back along and across it', () => {
  const T = makeTrack();
  assert.ok(T.L > 1000 && T.L < 1500, `${T.L}`);
  for (const s of [0, 100, 377, 640, 1100]) for (const d of [-9, 0, 6]) {
    const p = pointAt(T, s), x = p.x + p.tz * d, z = p.z - p.tx * d;
    const n = nearest(T, x, z);
    assert.ok(Math.abs(K.ds(n.s, s)) < 1.5, `s ${s} d ${d}: found ${n.s}`);
    assert.ok(Math.abs(n.d - d) < 0.3, `d ${d}: found ${n.d}`);
  }
  // (d > 0 is outward, away from the loop's middle)
  const p = pointAt(T, 200), out = nearest(T, p.x * 1.03, p.z * 1.03);
  assert.ok(out.d > 0);
});

test('the canyon: a floor, sand banks up to cliffs, kickers before the chasms', () => {
  const s = 120, hw = K.halfW(s);
  const floor = profileHeight(K, s, 0), bank = profileHeight(K, s, hw + K.C.bank * 0.8), cliff = profileHeight(K, s, hw + K.C.bank + K.C.cliff + 2);
  assert.ok(bank > floor + 2 && cliff > bank + 15, `${floor} ${bank} ${cliff}`);
  for (const j of K.jumps) {
    assert.ok(inGap(K, j.s + 2) && !inGap(K, j.s - 2) && !inGap(K, j.s + j.gap + 1));
    assert.ok(profileHeight(K, j.s + 3, 0) < K.floorY(j.s) - 15, 'a chasm right across');
    assert.ok(rampAt(K, j.s - 0.5) > 3 && rampAt(K, j.ramp0 + 2) < 0.2, 'the kicker rises to its lip');
  }
});

test('a rider on the bike drives three laps through the splits, at any frame rate, with no fall', () => {
  for (const fps of [120, 60, 30, 20]) {
    const B = newBike(K, 6), R = newRace(K), dt = 1 / fps, seen = {};
    let t = 0;
    while (!R.done && t < 300) {
      for (const e of bikeStep(B, botInput(B, K), dt, K)) seen[e.kind] = (seen[e.kind] ?? 0) + 1;
      t += dt;
      raceStep(R, K, B.prog, t);
    }
    assert.ok(R.done, `${fps} fps: finished`);
    assert.equal(R.splits.length, K.C.laps * K.C.checkpoints);
    assert.equal(R.laps.length, K.C.laps);
    assert.ok(t > 80 && t < 140, `${fps} fps: ${t.toFixed(1)} s`);
    assert.ok(!seen.fell && !seen.wall, `${fps} fps: ${JSON.stringify(seen)}`);
    assert.ok(seen.boost >= 6 && seen.air >= 6, `${fps} fps: boosts and jumps ${JSON.stringify(seen)}`);
  }
});

test('too slow off a kicker and the bike drops into the chasm', () => {
  const j = K.jumps[0], B = newBike(K, j.ramp0 - 8);
  B.speed = 9;
  let fell = false;
  for (let i = 0; i < 600 && !fell; i++) fell = bikeStep(B, { x: botInput(B, K).x, throttle: 0.26 }, 1 / 60, K).some((e) => e.kind === 'fell');
  assert.ok(fell);
  // fast, it clears it
  const F = newBike(K, j.ramp0 - 30);
  F.speed = 34;
  let s = 0;
  for (let i = 0; i < 300; i++) { assert.ok(!bikeStep(F, botInput(F, K), 1 / 60, K).some((e) => e.kind === 'fell')); s = F.prog; }
  assert.ok(s > j.s + j.gap);
});

test('the cliffs throw the bike back and slow it; the sand banks drag', () => {
  const B = newBike(K, 60);
  B.speed = 30; B.heading += 0.9;   // (aimed at the wall)
  B.vx = Math.sin(B.heading) * 30; B.vz = Math.cos(B.heading) * 30;
  let wall = null, sand = 0;
  for (let i = 0; i < 240 && !wall; i++) { const ev = bikeStep(B, { x: 0, throttle: 1 }, 1 / 60, K); wall = ev.find((e) => e.kind === 'wall'); sand = Math.max(sand, B.sand); }
  assert.ok(wall, 'hit the cliff');
  assert.ok(sand > 0.3, 'up the bank first');
  assert.ok(B.speed < 20, `${B.speed}`);
  assert.ok(Math.abs(B.d) <= K.halfW(B.s) + K.C.bank + 0.01, 'kept out of the cliff');
});

test('a sand drift bogs the bike down, unless it hops over; a pad boosts it', () => {
  const D = K.drifts[0];
  const at = (hop) => {
    const B = newBike(K, D.s - 25, D.side * K.halfW(D.s) * 0.5);   // (in line with the drift)
    B.speed = 30; B.vx = Math.sin(B.heading) * 30; B.vz = Math.cos(B.heading) * 30;
    const seen = [];
    for (let i = 0; i < 90; i++) {
      const u = K.ds(D.s, B.s);
      for (const e of bikeStep(B, { x: 0, throttle: 1, hop: hop && u < 15 && u > 9 }, 1 / 60, K)) seen.push(e.kind);
    }
    return { seen, B };
  };
  const into = at(false);
  assert.ok(into.seen.includes('drift'));
  const over = at(true);
  assert.ok(over.seen.includes('hop') && !over.seen.includes('drift'), over.seen.join(','));
  assert.ok(over.B.speed > into.B.speed + 5);
  const P = K.pads[0], B = newBike(K, P.s - 20, P.df * K.halfW(P.s));
  B.speed = 25; B.vx = Math.sin(B.heading) * 25; B.vz = Math.cos(B.heading) * 25;
  let boost = false;
  for (let i = 0; i < 120 && !boost; i++) boost = bikeStep(B, { x: 0, throttle: 1 }, 1 / 60, K).some((e) => e.kind === 'boost');
  assert.ok(boost && B.speed >= BIKE.boostKick - 1 && B.boost > 0);
});

test('the race: splits in order, laps timed, each against the best run', () => {
  const R = newRace(K);
  assert.deepEqual(raceStep(R, K, splitAt(K, 1) - 1, 5), []);
  const a = raceStep(R, K, splitAt(K, 2) + 1, 12);   // (two at once: a slow frame)
  assert.deepEqual(a.map((e) => e.n), [1, 2]);
  const lap = raceStep(R, K, splitAt(K, 5) + 0.5, 30);
  assert.equal(lap.at(-1).lapTime, 30);
  assert.equal(R.laps.length, 1);
  assert.equal(splitDelta(29, [10, 20, 25, 28, 30.5], 5), -1.5);
  assert.equal(splitDelta(29, null, 5), null);
  assert.equal(fmtDelta(-1.5), '−1.50');
  assert.equal(fmtDelta(0.25), '+0.25');
  raceStep(R, K, splitAt(K, 15) + 1, 100);
  assert.ok(R.done && R.laps.length === 3);
});

// ------------------------------------------------------------------ fishing
test('the cast: a meter that swings up and down, the float as far as it says', () => {
  assert.equal(castPower(0), 0);
  assert.ok(Math.abs(castPower(0.65) - 0.5) < 1e-9);
  assert.ok(Math.abs(castPower(1.3) - 1) < 1e-9);
  assert.ok(Math.abs(castPower(1.95) - 0.5) < 1e-9);
  assert.ok(castPower(2.6) < 1e-9);
  assert.equal(castDistance(0), 4);
  assert.equal(castDistance(1), 22);
  assert.equal(castDistance(3), 22);
  // the whole cast's reach is water, from the pier's end
  for (const a of [-0.6, 0, 0.6]) for (const d of [4, 13, 22]) {
    const x = -Math.sin(a) * d, z = POND.pierEnd - Math.cos(a) * d;
    if (Math.hypot(x, z) < POND.shore(Math.atan2(z, x)) - 1.5) assert.ok(oasisHeight(x, z) < -0.2, `${x} ${z}`);
  }
  assert.ok(oasisHeight(0, POND.pierStart + 4) > 0.2, 'the beach is dry');
});

test('eight strange kinds, each with its ways; the deep holds the heavy ones', () => {
  assert.ok(SPECIES.length >= 6 && SPECIES.length <= 8);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, SPECIES.length);
  for (const s of SPECIES) {
    assert.ok(s.name && s.note && s.w[1] > s.w[0] && s.pull > 0 && s.pull <= 1 && s.window > 0.25, s.id);
    const r = seeded(7);
    for (let i = 0; i < 20; i++) { const w = rollWeight(s, r); assert.ok(w >= s.w[0] && w <= s.w[1], `${s.id} ${w}`); }
  }
  const r = seeded(3), counts = {};
  for (let i = 0; i < 2000; i++) { const s = pickSpecies('deep', r); counts[s.id] = (counts[s.id] ?? 0) + 1; }
  assert.ok(!counts.glassfin && !counts.ribbon, 'no shallow kinds in the deep');
  assert.ok(counts.hermit > 0 && counts.hermit < counts.bishop, JSON.stringify(counts));
  const sh = {};
  for (let i = 0; i < 500; i++) { const s = pickSpecies('shallow', r); sh[s.id] = 1; }
  assert.ok(!sh.hermit && !sh.shellback && sh.glassfin);
});

test('the bite: nibbles first, then it takes the bait; strike too soon, in time or too late', () => {
  const r = seeded(11);
  for (const sp of SPECIES) for (let i = 0; i < 10; i++) {
    const b = biteSchedule(sp, r);
    assert.ok(b.nibbles.length >= sp.nibbles[0] && b.nibbles.length <= sp.nibbles[1]);
    assert.ok(b.nibbles.every((t, k) => k === 0 || t > b.nibbles[k - 1]));
    assert.ok(b.bite > (b.nibbles.at(-1) ?? 0));
  }
  assert.equal(hookResult(1.9, 2, 0.4), 'early');
  assert.equal(hookResult(2.3, 2, 0.4), 'hooked');
  assert.equal(hookResult(2.5, 2, 0.4), 'late');
});

test('the fight: played well every kind is landed; reeled flat out the big ones snap the line; left slack they get away', () => {
  const r = seeded(5);
  const play = (sp, who) => {
    const F = newFight(sp, 14, r);
    for (let t = 0; t < 120; t += 1 / 60) {
      const inp = who === 'well' ? botFight(F) : who === 'greedy' ? { reel: 1, pull: 0 } : { reel: 0, pull: 0 };
      const e = fightStep(F, inp, 1 / 60, r).find((x) => ['landed', 'snap', 'slip'].includes(x.kind));
      if (e) return { end: e.kind, t, F };
    }
    return { end: 'none' };
  };
  for (const sp of SPECIES) for (let i = 0; i < 6; i++) {
    const g = play(sp, 'well');
    assert.equal(g.end, 'landed', sp.id);
    assert.ok(g.t > 3 && g.t < 60, `${sp.id}: ${g.t}`);
  }
  for (const id of ['bishop', 'shellback', 'hermit', 'skyeye']) for (let i = 0; i < 4; i++) assert.equal(play(speciesById(id), 'greedy').end, 'snap', id);
  for (const sp of SPECIES) assert.notEqual(play(sp, 'lazy').end, 'landed', sp.id);
});

test('the line strains only in the red, and the stick against a run spares it', () => {
  const sp = speciesById('bishop');
  const F = newFight(sp, 12, () => 0.5);
  F.running = true; F.left = 99; F.dir = 1;
  const G = { ...F };
  for (let i = 0; i < 60; i++) { fightStep(F, { reel: 1, pull: 0 }, 1 / 60); fightStep(G, { reel: 1, pull: -1 }, 1 / 60); }
  assert.ok(G.tension < F.tension, `${G.tension} < ${F.tension}`);
  assert.ok(G.dist < F.dist, 'held against, it takes less line');
  const E = newFight(sp, 12, () => 0.5);
  for (let i = 0; i < 60; i++) fightStep(E, { reel: 0.3, pull: 0 }, 1 / 60);
  assert.ok(E.tension < FIGHT.red && E.strain === 0);
});

test('the journal: each kind once, its count and its heaviest', () => {
  let r = recordCatch({}, 'lantern', 2.1);
  assert.ok(r.isNew && !r.isRecord);
  r = recordCatch(r.journal, 'lantern', 1.4);
  assert.ok(!r.isNew && !r.isRecord);
  r = recordCatch(r.journal, 'lantern', 3.0);
  assert.ok(r.isRecord);
  assert.deepEqual(r.journal.lantern, { n: 3, best: 3.0 });
  r = recordCatch(r.journal, 'hermit', 12.5);
  assert.deepEqual(Object.keys(r.journal).sort(), ['hermit', 'lantern']);
});
