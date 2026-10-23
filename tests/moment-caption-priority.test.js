import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Cinema } from '../src/ship/cinema.js';
import { MomentStage } from '../src/story/moment.js';
import { PlaceName } from '../src/hud.js';
import { screen } from '../src/platform.js';
import { spoken } from '../src/story/tone.js';

const water = spoken('scene', '~happy~ Water reaches the dry basin again.');
const ordinary = spoken('scene', '~neutral~ A traveller waits nearby.');
function returnedWorld() {
  screen.reset();
  const cinema = new Cinema(), place = new PlaceName();
  const flags = new Map(), game = { flag: k => flags.get(k), set: (k, v) => flags.set(k, v) };
  const ship = { cinema, shot() {}, release() {}, busy: () => false };
  const moments = new MomentStage({ ship, game });
  const m = moments.play({ id: 'temple.desert.finale',
    shots: [{ dur: 11, from: { pos: new THREE.Vector3(0, 4, 8), look: new THREE.Vector3() } }],
    beats: [{ t: 5.75, secs: 2.7, line: water }] });
  let elapsed = 0;
  function step() {
    const dt = 1 / 60; elapsed += dt;
    // Production order: story's Moment, ship's Cinema, then HUD place-name state.
    moments.update(dt); cinema.update(dt);
    const name = place.update('Rose House', elapsed * 1000, { hold: moments.playing });
    cinema.setCaption(moments.playing ? false : !!name, place.waiting);
  }
  return { cinema, place, moments, m, step, advance(t) { while (elapsed + 1e-8 < t) step(); } };
}

test('a return-film beat appears while the new region name waits, then hands priority back', () => {
  const r = returnedWorld(); r.advance(5.7);
  assert.equal(r.place.waiting, true);
  assert.equal(r.cinema.subs.line, null);
  r.advance(7.1);
  assert.equal(r.cinema.subs.line?.text, water.text, 'actual authored beat must be visible during its panel');
  assert.equal(r.cinema._held.some(x => x.line === water), false, 'the film beat must not wait behind its own held region name');
  assert.equal(r.place.waiting, true, 'the scene does not consume the region caption');
  r.advance(8.6); assert.equal(r.cinema.subs.line, null, 'the beat keeps its authored duration');
  r.advance(11.1); assert.equal(r.m.done, true);
  assert.equal(r.cinema.caption.up, true, 'the original region name gets its full turn after the scene');
  r.cinema.say(ordinary);
  assert.equal(r.cinema.subs.line, null, 'ordinary speech still waits for the region name');
  assert.equal(r.cinema._held[0]?.line, ordinary);
});

test('skipping a film clears its active caption without releasing a late victory line', () => {
  const r = returnedWorld(); r.advance(6.2);
  assert.equal(r.cinema.subs.line?.text, water.text);
  assert.equal(r.m.skip(), true); r.step();
  assert.equal(r.m.done, true); assert.equal(r.m.skipped, true);
  assert.equal(r.cinema.subs.line, null); assert.equal(r.cinema._held.length, 0);
  r.advance(15); assert.equal(r.cinema.subs.line, null);
});


test('authored metadata outside a letterboxed scene cannot bypass ordinary notice order', () => {
  screen.reset(); const c = new Cinema(); c.setCaption(false, true);
  c.say(water, { secs: 2.7, authored: true, queue: false });
  assert.equal(c.subs.line, null); assert.equal(c._held[0]?.line, water);
  c.setCaption(false, false); c.update(1 / 60);
  assert.equal(c.subs.line, water, 'the queued line is released only when its ordinary priority permits');
});
