// The controller's rumble (src/rumble.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Rumble, PATTERNS, LEVELS, patternPulses, padActuator } from '../src/rumble.js';

const pad = (kind = 'dual') => {
  const played = [];
  const p = { connected: true, played };
  if (kind === 'dual') p.vibrationActuator = { effects: ['dual-rumble', 'trigger-rumble'], playEffect: (type, o) => { played.push({ type, ...o }); return Promise.resolve('complete'); }, reset: () => Promise.resolve() };
  if (kind === 'old') p.vibrationActuator = { type: 'dual-rumble', playEffect: (type, o) => { played.push({ type, ...o }); return Promise.resolve(); } };
  if (kind === 'haptic') p.hapticActuators = [{ pulse: (v, ms) => { played.push({ v, ms }); return Promise.resolve(true); } }];
  return p;
};
const now = (fn) => { fn(); return null; };   // every pulse at once (the tests don't wait)

test('every named pattern gives pulses in range', () => {
  for (const name of ['hurt', 'slam', 'land', 'knockdown', 'potion', 'charged', 'chime', 'takeoff', 'search', 'found']) assert.ok(PATTERNS[name], name);
  for (const [name, P] of Object.entries(PATTERNS)) {
    for (const opts of [{}, { h: 2, dist: 1, speed: 48, full: true, dead: true, s: 1 }]) {
      for (const p of P(opts)) {
        assert.ok(p.at >= 0 && p.dur > 0 && p.dur <= 1000, `${name}: timing`);
        assert.ok(p.strong >= 0 && p.strong <= 1 && p.weak >= 0 && p.weak <= 1, `${name}: magnitude`);
      }
    }
  }
});

test('the patterns say what happened: harder hits, nearer slams, a full charge, a chime barely there', () => {
  const peak = (ps) => Math.max(0, ...ps.map((p) => Math.max(p.strong, p.weak)));
  assert.ok(peak(PATTERNS.hurt({ h: 1.5 })) > peak(PATTERNS.hurt({ h: 0.25 })), 'by the hearts');
  assert.ok(PATTERNS.hurt({ h: 1.5 })[0].dur > PATTERNS.hurt({ h: 0.25 })[0].dur);
  assert.ok(peak(PATTERNS.slam({ dist: 2 })) > peak(PATTERNS.slam({ dist: 10 })), 'by how near');
  assert.deepEqual(PATTERNS.slam({ dist: 30 }), [], 'too far: nothing');
  assert.ok(peak(PATTERNS.charged({ full: true })) > peak(PATTERNS.charged({ full: false })));
  assert.ok(peak(PATTERNS.chime()) <= 0.15, 'very light');
  assert.equal(PATTERNS.potion().length, 2, 'two swallows');
  // the search: the signature's three pulses, stronger and closer together nearer, nothing far off
  assert.deepEqual(PATTERNS.search({ s: 0.05 }), []);
  const near = PATTERNS.search({ s: 1 }), far = PATTERNS.search({ s: 0.3 });
  assert.equal(near.length, 3);
  assert.ok(peak(near) > peak(far) && near[1].at < far[1].at);
});

test('settings: off plays nothing, the intensity scales every pulse', () => {
  assert.deepEqual(patternPulses('hurt', { h: 1 }, { on: false }), []);
  assert.deepEqual(patternPulses('nope', {}, { on: true }), []);
  const lo = patternPulses('hurt', { h: 1 }, { on: true, level: 'low' })[0], hi = patternPulses('hurt', { h: 1 }, { on: true, level: 'high' })[0];
  const raw = PATTERNS.hurt({ h: 1 })[0];
  assert.ok(Math.abs(lo.strong - raw.strong * LEVELS.low) < 1e-9);
  assert.ok(Math.abs(hi.strong - Math.min(1, raw.strong * LEVELS.high)) < 1e-9);
  assert.ok(LEVELS.low < LEVELS.medium && LEVELS.medium < LEVELS.high);
  assert.deepEqual(patternPulses('hurt', { h: 1 }), patternPulses('hurt', { h: 1 }, { on: true, level: 'medium' }), 'default: on, medium');
});

test('plays on a pad’s dual-rumble actuator (or its haptic one), at the setting’s strength', () => {
  const p = pad('dual');
  const r = new Rumble({ pads: () => [p], schedule: now, settings: () => ({ on: true, level: 'high' }) });
  assert.ok(r.supported() && r.active());
  r.play('found');
  assert.equal(p.played.length, PATTERNS.found().length);
  assert.equal(p.played[0].type, 'dual-rumble');
  assert.ok(p.played[0].duration > 0 && p.played[0].strongMagnitude > 0 && p.played[0].weakMagnitude > 0);
  const h = pad('haptic');
  new Rumble({ pads: () => [h], schedule: now }).play('hurt', { h: 1 });
  assert.equal(h.played.length, 1);
  assert.equal(padActuator(pad('old')), 'dual', 'Chrome’s older actuator (type only)');
  assert.equal(padActuator({ vibrationActuator: { effects: ['trigger-rumble'], playEffect() {} } }), null, 'no dual-rumble effect');
});

test('without a pad that can shake (or turned off) it does nothing, and says so', () => {
  const none = new Rumble({ pads: () => [null, { connected: true }], schedule: now });
  assert.equal(none.supported(), false);
  assert.deepEqual(none.play('hurt', { h: 1 }), []);
  const p = pad('dual');
  const off = new Rumble({ pads: () => [p], schedule: now, settings: () => ({ on: false, level: 'medium' }) });
  assert.deepEqual(off.play('hurt', { h: 1 }), []);
  assert.equal(p.played.length, 0);
  assert.equal(off.active(), false);
  // no navigator at all (node): still nothing, no throw
  assert.deepEqual(new Rumble({ schedule: now }).play('chime'), []);
});

test('the Android app’s bridge when no Gamepad API pad can (its pads are its own)', () => {
  const sent = [];
  const r = new Rumble({ pads: () => [], native: { ok: () => true, pulse: (p) => sent.push(p) }, schedule: now });
  assert.ok(r.supported());
  r.play('potion');
  assert.equal(sent.length, 2);
  const p = pad('dual');
  const both = new Rumble({ pads: () => [p], native: { ok: () => true, pulse: (x) => sent.push(x) }, schedule: now });
  both.play('chime');
  assert.equal(sent.length, 2, 'a Gamepad API pad first, not both');
  assert.equal(p.played.length, 1);
});
