import test from 'node:test';
import assert from 'node:assert/strict';
import { course, traveller, CAM_PLUS_Z } from './gait-sim.js';
import { BodyFoley } from '../src/foley.js';
import { Sound } from '../src/audio.js';

test('a real rig landing sounds its two contacts, not another pair from body foley', async () => {
  const p = await traveller(course(), undefined, { body: 'b3', moves: true });
  const contacts = [], landings = [], extraFeet = [], vocals = [];
  p.onStep = () => contacts.push(p.time);
  const sound = { ctx: { currentTime: 0 }, surface: 'stone', muted: false, actionVocal: group => vocals.push(group),
    step: () => extraFeet.push(p.time), sample: () => true, burst() {},
    land(arg) { landings.push({ ...arg, time: p.time }); Sound.prototype.land.call(this, arg); } };
  const foley = new BodyFoley(sound);
  for (const [frames, input] of [[60, {}], [6, { Space: true }], [180, {}]]) {
    for (let i = 0; i < frames; i++) {
      p.update(1 / 60, input, CAM_PLUS_Z);
      foley.update(p, 1 / 60);
    }
  }
  assert.equal(landings.length, 1);
  assert.equal(landings[0].feetPlanted, true);
  assert.equal(contacts.filter(t => t === landings[0].time).length, 2, 'both actual feet land');
  assert.equal(extraFeet.length, 0, 'no extra contacts layered over the real landing');
  assert.equal(vocals.length, 1, 'the real landing retains exactly one effort');
});
