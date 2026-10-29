// Issue #788: Cistern channels against a clock (five minutes for the three floods), and only its own valve button
// opens the water: a pad's L3 (the run, which sets Shift) never does.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import cistern, { stoneAt, stoneUnder, TIME } from '../src/minigames/cistern.js';
import { botMove } from '../src/minigames/channels.js';
import { readInput, NO_INPUT } from '../src/minigames/kit/input.js';
import { Controller, mergeControls } from '../src/controller.js';

function court(seed, { difficulty = 'easy', helper = true, clock = false } = {}) {
  const scene = new THREE.Scene(), gen = cistern.build(scene); let step;
  do { step = gen.next(); } while (!step.done);
  const results = [], flashes = [], R = { time: 0 };
  const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), finishFrame() {} };
  const ctx = { scene, level: step.value, player, camera: new THREE.PerspectiveCamera(44, 16 / 9, .1, 1000),
    sfx: new Proxy({}, { get: () => () => {} }), sound: null, helper: helper ? { seed, temple: 'desert' } : null, option: () => difficulty,
    add: (o) => { scene.add(o); return o; }, setFov() {}, flash: (t) => flashes.push(t), status() {}, setScore() {}, finish: (r) => results.push(r) };
  if (clock) Object.defineProperty(ctx, 'time', { get: () => R.time });   // (the runner's clock, as kit/runner.js gives it)
  const session = cistern.start(ctx);
  const tick = (input = {}, dt = 1 / 30) => { R.time += dt; session.update(dt, { x: 0, y: 0, ...input }, { live: true, phase: 'play' }); };
  return { session, tick, results, flashes, R };
}

/** A player that knows the way: walks to the next wrong stone, turns it, `think` s of thought after each turn. */
function play(seed, { think = 0, hurry = true, fps = 30 } = {}) {
  const c = court(seed);
  try {
    let valve = false, cool = 0, wait = 0, t = 0;
    const dt = 1 / fps;
    for (; t < TIME.limit + 30 && !c.results.length; t += dt) {
      const { B, F, me, awaitingRetry } = c.session.state, input = { trigger: 0 };
      cool = Math.max(0, cool - dt);
      if (wait > 0) wait -= dt;
      else if (awaitingRetry) input.trigger = valve ? 0 : 1;
      else if (F.planning) {
        const s = stoneUnder(me.pos.x, me.pos.z) ?? { x: -1, y: -1 }, m = botMove(B, F, s.x, s.y);
        if (m.to) {
          const p = stoneAt(...m.to), dx = p.x - me.pos.x, dz = p.z - me.pos.z, d = Math.hypot(dx, dz);
          if (s.x === m.to[0] && s.y === m.to[1] && d < 1) { if (!cool) { input.jumpPressed = true; cool = 0.25; wait = think; } }
          else { input.x = dx / Math.max(d, 1); input.y = -dz / Math.max(d, 1); }
        } else input.trigger = valve ? 0 : 1;
      } else if (hurry) input.trigger = 1;
      valve = input.trigger > 0.3;
      c.tick(input, dt);
    }
    return { t, result: c.results[0] ?? null, floods: c.session.state.total.floods.length };
  } finally { c.session.end(); }
}

// the story's boards: the helper's seeds (helper-encounter.js: the encounter's serial × 2654435761)
const SEEDS = [1, 2, 3, 4].map((n) => Math.imul(n, 2654435761) >>> 0);

test('Cistern: five minutes on the clock, shown counting down in the HUD', () => {
  assert.equal(TIME.limit, 300);
  assert.equal(cistern.hud.timer, true);
  assert.equal(cistern.hud.countdown, TIME.limit, 'the runner draws the time left (web HUD and BridgeHud alike)');
  assert.match(cistern.rules, /5 minutes/);
});

test('Cistern: out of time, the run is lost (never the goal) and the time left is called out on the way', () => {
  const c = court(SEEDS[0]);
  try {
    for (let t = 0; t < TIME.limit - 1; t += 1 / 30) c.tick();
    assert.equal(c.results.length, 0, 'still running a second before the end');
    for (const w of ['One minute left!', '30 seconds left!', '10 seconds left!']) assert.ok(c.flashes.includes(w), w);
    assert.equal(c.flashes.filter((f) => /left!$/.test(f)).length, 3, 'each warning once');
    for (let t = 0; t < 2; t += 1 / 30) c.tick();
    assert.equal(c.results.length, 1);
    const r = c.results[0];
    assert.equal(r.failed, true); assert.equal(r.title, 'Out of time');
    assert.deepEqual(r.goal, { game: 'cistern', complete: false }, 'a lost run never completes the helper');
    assert.ok(r.lines.some((l) => /Retry: the same channels/.test(l)));
    c.tick(); assert.equal(c.results.length, 1, 'finished once');
  } finally { c.session.end(); }
});

test('Cistern: the clock is the runner\'s own when it has one (the HUD and the rule agree)', () => {
  const c = court(SEEDS[0], { clock: true });
  try {
    c.R.time = TIME.limit - 0.01; c.tick({}, 0.02);
    assert.equal(c.results[0]?.title, 'Out of time');
  } finally { c.session.end(); }
});

test('Cistern: a careful player wins in time; dawdling without hurrying the water does not', () => {
  for (const seed of SEEDS) {
    const quick = play(seed);
    assert.equal(quick.result?.failed, false, `${seed}: the way known, walked straight`);
    assert.ok(quick.t < 150, `${seed}: ${quick.t.toFixed(0)} s`);
    const careful = play(seed, { think: 2 });
    assert.equal(careful.result?.failed, false, `${seed}: two seconds' thought at each turn, the water hurried (${careful.t.toFixed(0)} s)`);
    assert.ok(careful.t < TIME.limit - 30, `${seed}: with time to spare for a spill (${careful.t.toFixed(0)} s)`);
    const slow = play(seed, { think: 4, hurry: false });
    assert.equal(slow.result?.title, 'Out of time', `${seed}: four seconds a turn, the water never hurried`);
  }
});

test('Cistern: the valve is RT / R2 or the keyboard\'s Shift; L3 (the run) never opens it', () => {
  // the pad's L3: Controller sets Shift for the run, and says it is the run's
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0.6, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const ctl = new Controller({ pads: () => [pad], context: () => 'game', action() {}, look() {}, navigate() {}, scroll() {} });
  pad.buttons[10] = { pressed: true, value: 1 };   // L3
  const held = ctl.update(1 / 60);
  assert.equal(held.ShiftLeft, true, 'L3 runs');
  assert.equal(held.PadRun, true);
  const l3 = readInput(mergeControls({}, held), NO_INPUT);
  assert.equal(l3.shiftKey, false); assert.equal(l3.trigger, 0);
  assert.equal(readInput({ ShiftLeft: true }, NO_INPUT).shiftKey, true, 'the keyboard\'s Shift');
  assert.equal(readInput({ PadFire: true }, NO_INPUT).trigger, 1, 'RT / R2');

  const c = court(SEEDS[0]);
  try {
    for (let i = 0; i < 60; i++) c.tick({ ...l3, tuck: 1 });
    assert.equal(c.session.state.F.planning, true, 'L3 held and pressed: the water waits');
    c.tick({ trigger: 0 }); c.tick({ trigger: 1 });
    assert.equal(c.session.state.F.planning, false, 'RT / R2 opens the valve');
  } finally { c.session.end(); }
  const k = court(SEEDS[1]);
  try { k.tick({ shiftKey: true }); assert.equal(k.session.state.F.planning, false, 'Shift on the keyboard opens it'); }
  finally { k.session.end(); }
});
