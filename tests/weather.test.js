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

test('the dev panel’s forced weather still wins over a calm', () => {
  const w = new Weather(['storm'], { calm: () => true });
  w.mode = 'storm';
  assert.ok(run(w, 60) > 0.9, 'forced storm');
});
