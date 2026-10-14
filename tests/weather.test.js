import test from 'node:test';
import assert from 'node:assert/strict';
import { Weather } from '../src/weather.js';

// The weather (src/weather.js): clear spells and episodes of a world's own weather. The desert's first arrival
// is held clear until the makers' chest in Qanat is opened (issue #139: "don't start with a bad weather when
// I'm out of the ship first").
const { CONTENT } = await import('../src/levels/content.js');

/** Run the weather `secs` seconds; the worst it got. */
const run = (w, secs) => { let worst = 0; for (let i = 0; i < secs * 10; i++) { const s = w.update(0.1); worst = Math.max(worst, s.storm, s.rain, s.fog); } return worst; };

test('the desert keeps its sandstorms, held off until the first chest is opened', () => {
  assert.deepEqual(CONTENT.desert.weather, ['storm'], 'the desert still has its storms (later visits)');
  assert.equal(CONTENT.desert.calmUntil, 'item.backpack', 'clear until the makers’ chest has given the backpack');
});

test('the first arrival is clear: no storm while calm, however long it takes to reach the chest', () => {
  const flags = {};
  for (let seed = 0; seed < 20; seed++) {
    const w = new Weather(CONTENT.desert.weather, { calm: () => !flags[CONTENT.desert.calmUntil] });
    assert.equal(w.state.storm, 0, 'clear from the first frame (stepping out of the ship)');
    assert.equal(run(w, 15 * 60), 0, 'still clear after a quarter of an hour without the backpack');
  }
});

test('once the chest is open, a whole clear spell passes, then the storms come as before', () => {
  const flags = {};
  const w = new Weather(['storm'], { calm: () => !flags['item.backpack'] });
  run(w, 200);
  flags['item.backpack'] = true;
  assert.ok(run(w, 60) < 0.05, 'no storm in the first minute after the chest (a clear spell is 70–150 s)');
  assert.ok(run(w, 20 * 60) > 0.5, 'and storms after that');
});

test('a world without a calm has its first episode a little sooner, as designed', () => {
  const w = new Weather(['storm']);
  assert.ok(w.timer >= 35 && w.timer <= 75, `the first clear spell is half a long one (${w.timer.toFixed(0)} s)`);
  assert.ok(run(w, 10 * 60) > 0.5, 'a storm within ten minutes');
});

// Issue #308, "the desert has storms too often": count the desert's sandstorms over a simulated week of play.
/** Storm episodes (rising past half strength) over `secs`, with the shortest clear gap between two and the first's start. */
const storms = (w, secs) => {
  let n = 0, on = false, lastEnd = null, minGap = Infinity, first = null;
  for (let i = 0; i < secs * 4; i++) {
    const t = i / 4, s = w.update(0.25).storm;
    if (!on && s > 0.5) { on = true; n++; first ??= t; if (lastEnd !== null) minGap = Math.min(minGap, t - lastEnd); }
    else if (on && s < 0.1) { on = false; lastEnd = t; }
  }
  return { n, minGap, first };
};

test('the desert’s storms are rare: at most one every eight minutes or so over a week, never back to back', () => {
  const pace = CONTENT.desert.weatherPace;
  assert.ok(pace, 'the desert paces its weather');
  const week = 7 * 24 * 3600;
  const w = new Weather(CONTENT.desert.weather, pace);
  const { n, minGap, first } = storms(w, week);
  const perHour = n / (week / 3600);
  assert.ok(perHour <= 6.5 && perHour >= 3, `${perHour.toFixed(1)} storms an hour (it was ~25 before #308)`);
  assert.ok(minGap >= 7 * 60, `at least seven minutes of clear sky between two storms (${(minGap / 60).toFixed(1)} min)`);
  assert.ok(first >= 4 * 60, `no storm in the first four minutes of a visit (${(first / 60).toFixed(1)} min)`);
  // and the old pace, for the record: about four times as many
  const old = storms(new Weather(['storm']), week).n;
  assert.ok(old > n * 3, `the old pace had ${old} storms a week against ${n}`);
});

test('once the first chest lets the desert’s storms in, the first still waits a few minutes', () => {
  const flags = {};
  const w = new Weather(CONTENT.desert.weather, { ...CONTENT.desert.weatherPace, calm: () => !flags['item.backpack'] });
  run(w, 300);
  flags['item.backpack'] = true;
  assert.ok(run(w, 4 * 60) < 0.05, 'four minutes of clear sky after the chest');
  assert.ok(run(w, 30 * 60) > 0.5, 'and a storm after that');
});

test('the dev panel’s forced weather still wins over a calm', () => {
  const w = new Weather(['storm'], { calm: () => true });
  w.mode = 'storm';
  assert.ok(run(w, 60) > 0.9, 'forced storm');
});
