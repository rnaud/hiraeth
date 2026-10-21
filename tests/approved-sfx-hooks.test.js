import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.js';

function listener(ready = true) {
  const samples = [], synth = [];
  const s = { ctx: { currentTime: 0 }, sample: (name) => { samples.push(name); return ready; },
    vary: () => 1, rand: () => 1, sweep: () => synth.push('tone'), burst: () => synth.push('noise'), swish: () => synth.push('swish'), effort() {} };
  return { s, samples, synth };
}

test('blade cuts have dedicated approved groups, not the body-action swing bank', () => {
  const { s, samples } = listener();
  Sound.prototype.fluidSlash.call(s, 0); Sound.prototype.fluidSlash.call(s, 1); Sound.prototype.fluidSlash.call(s, 2);
  assert.deepEqual(samples, ['blade-light', 'blade-light', 'blade-heavy']);
});

test('approved blaster replaces only ordinary fluid shoot, keeping other mode identities', () => {
  for (const mode of ['shoot', 'stun', 'fire', 'push']) {
    const { s, samples, synth } = listener();
    Sound.prototype.fluidShoot.call(s, mode);
    assert.deepEqual(samples, mode === 'shoot' ? ['fluid-shot'] : []);
    assert.equal(synth.length > 0, mode !== 'shoot');
  }
  const fallback = listener(false);
  Sound.prototype.fluidShoot.call(fallback.s, 'shoot');
  assert.ok(fallback.synth.length > 0);
});

test('perfect parry uses its own cue without doubling synth ping; ordinary block is unchanged', () => {
  const perfect = listener(); assert.equal(Sound.prototype.fluidBlock.call(perfect.s, true), true);
  assert.deepEqual(perfect.samples, ['shield-parry']); assert.deepEqual(perfect.synth, []);
  const normal = listener(); Sound.prototype.fluidBlock.call(normal.s, false);
  assert.deepEqual(normal.samples, ['splat', 'knock']); assert.ok(normal.synth.length > 0);
  const fallback = listener(false); assert.notEqual(Sound.prototype.fluidBlock.call(fallback.s, true), true);
  assert.deepEqual(fallback.samples, ['shield-parry', 'splat', 'knock']); assert.ok(fallback.synth.length > normal.synth.length);
});

test('only mantle bounds the planted contact; ordinary walking keeps the full step', () => {
  const events = [];
  const s = { ctx: { currentTime: 0 }, muted: false, sample: () => true,
    step: (speed, options) => events.push({ speed, ...options }) };
  Sound.prototype.mantle.call(s);
  assert.deepEqual(events, [{ speed: 3, vol: 0.5, at: 0.45, maxDuration: 0.3 }]);
  const contacts = [];
  Sound.prototype.step.call({ ...s, surface: 'sand', sample: (group, options) => { contacts.push({ group, ...options }); return true; } }, 4);
  assert.equal(contacts[0].maxDuration, null);
  assert.equal(contacts[0].at, 0);
});
