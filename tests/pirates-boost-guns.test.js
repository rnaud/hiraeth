// Issue #495: "Space chimes mini game should allow me to boost and slow down to avoid hazards. Enemies should drop gun
// upgrades so I become more powerful within the level (resets when hit)." (src/minigames/pirates-rules.js FLY.throttle,
// GUNS, DROPS; pirates.js hudNote, the hints; docs/systems/minigames.md "Boost, brake and the guns")
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLY, GUNS, DROPS, gunOf, newRun, runStep, botInput, pirateInput, seedOf, aimAt, KINDS } from '../src/minigames/pirates-rules.js';
import pirates, { hudNote, pirateControls, pirateHints, GAUGE_CELLS, CAM } from '../src/minigames/pirates.js';
import { pirateSounds, PIRATE_SOUNDS } from '../src/minigames/pirates-sfx.js';

const steps = (S, n, inp = {}, ev = []) => { for (let i = 0; i < n; i++) ev.push(...runStep(S, typeof inp === 'function' ? inp(S) : inp, 1 / 60)); return ev; };
/** A run with nothing in it: no script, no rocks. */
const empty = (o = {}) => { const S = newRun({ seed: 3, ...o }); S.script = []; S.rocks = []; return S; };
const park = (S, kind, o = {}) => { const e = { id: S.nextId++, kind, hp: KINDS[kind].hp, r: KINDS[kind].r, fireT: 99, age: 5, flash: 0, ds: 60, u: 0, v: 0, face: 'ship', ...o }; S.foes.push(e); return e; };

test('boost and brake: the ship flies faster or slower along the way, so what hangs in space comes on faster or slower', () => {
  const T = FLY.throttle;
  assert.ok(T.boost >= 1.5 && T.brake <= 0.6, 'a real difference either way');
  const go = (inp) => { const S = empty(); steps(S, 60, inp); return S.s; };
  const cruise = go({}), boost = go({ boost: true }), brake = go({ brake: true });
  assert.ok(boost > cruise * 1.35, `a second's boost: ${boost.toFixed(0)} m against ${cruise.toFixed(0)}`);
  assert.ok(brake < cruise * 0.8, `a second's brake: ${brake.toFixed(0)} m`);
  // a rock ahead is met sooner on the boost and later on the brake; the pirates fly with the ship either way
  const meet = (inp) => { const S = empty(); S.rocks = [{ s: 120, u: 0, v: -1, r: 2, kind: 0, tone: 0, hp: Infinity, spin: 0, hit: false, u0: 0, v0: -1, ph: 0 }]; for (let i = 1; i < 600; i++) if (runStep(S, inp, 1 / 60).some((e) => e.kind === 'hurt')) return i; return -1; };
  const a = meet({}), b = meet({ boost: true }), c = meet({ brake: true });
  assert.ok(a > 0 && b > 0 && c > 0);
  assert.ok(b < a * 0.8 && c > a * 1.2, `the rock met after ${b}, ${a}, ${c} steps`);
  const S = empty(); const f = park(S, 'raider', { ds: 80 }); f.path = 'none';
  steps(S, 30, { boost: true });
  assert.equal(f.ds, 80, 'a pirate keeps its place by the ship');
  // the mines too: still in space, closing at the ship's speed
  const M = empty(); const m = park(M, 'mine', { ds: 100 });
  steps(M, 30, { boost: true });
  assert.ok(100 - m.ds > FLY.speed * 0.5 * 1.2, `a mine closes ${(100 - m.ds).toFixed(1)} m in half a second's boost`);
});

test('the gauge: boost and brake draw on it, it fills again after; emptied, neither works until it is back', () => {
  const T = FLY.throttle, S = empty();
  const ev = steps(S, 60, { boost: true });
  assert.ok(ev.some((e) => e.kind === 'boost' && e.on));
  assert.ok(Math.abs(S.ship.meter - (1 - T.drain)) < 0.02, `a second's boost leaves ${S.ship.meter.toFixed(2)}`);
  let dry = false;
  for (let i = 0; i < 200 && !dry; i++) dry = runStep(S, { boost: true }, 1 / 60).some((e) => e.kind === 'spent');
  assert.ok(dry, 'run dry');
  assert.equal(S.ship.spent, true);
  steps(S, 45, { boost: true });
  assert.ok(S.ship.speedK < 1.1 && S.ship.spent, `spent, held: back to cruising (${S.ship.speedK.toFixed(2)})`);
  // let go: it fills again after its wait, and works again once over its least
  steps(S, 60 * (T.wait + T.min / T.refill) + 10, {});
  assert.equal(S.ship.spent, false);
  assert.ok(S.ship.meter >= T.min);
  const e2 = steps(S, 30, { brake: true });
  assert.ok(e2.some((e) => e.kind === 'brake' && e.on) && S.ship.speedK < 0.8, 'the brake works again');
  steps(S, 60 * 8, {});
  assert.equal(S.ship.meter, 1, 'full again');
});

test('the gun drops: a gunboat leaves one; flown through, the gun goes a tier up; its rate and its spread grow', () => {
  assert.equal(GUNS.length, 4);
  for (let i = 1; i < GUNS.length; i++) assert.ok(GUNS[i].every <= GUNS[i - 1].every && GUNS[i].auto <= GUNS[i - 1].auto && GUNS[i].r >= GUNS[i - 1].r, `${GUNS[i].id} stronger`);
  assert.ok(GUNS[0].fan === 0 && GUNS[2].fan > 0 && GUNS[3].fan > GUNS[2].fan, 'the spread from the third');
  const S = empty();
  const a = aimAt(S.ship, 60);
  park(S, 'raider', { ds: 60, u: a.u, v: a.v, hp: 1 });
  const ev = steps(S, 40, { fire: true }).concat(steps(S, 1, {}));
  const d = ev.find((e) => e.kind === 'drop');
  assert.ok(d, 'it left a drop');
  assert.equal(S.drops.length, 1);
  assert.ok(S.drops[0].s - S.s >= DROPS.ahead - FLY.speed * 1.2, 'ahead of the ship');
  // fly into it
  const up = steps(S, 240, (T) => { const g = T.drops[0]; return g ? { x: Math.max(-1, Math.min(1, (g.u - T.ship.u) / 2)), y: -Math.max(-1, Math.min(1, (g.v - T.ship.v) / 2)) } : {}; });
  const u = up.find((e) => e.kind === 'upgrade');
  assert.ok(u, 'taken');
  assert.equal(S.ship.gun, 1); assert.equal(u.name, GUNS[1].name);
  // the tiers' fire: volleys in two seconds of RT, bolts a volley
  const fire = (tier) => { const T = empty(); T.ship.gun = tier; const e = steps(T, 120, { auto: true }); const shots = e.filter((x) => x.kind === 'shot').length; return { shots, bolts: T.bolts.length + 0 }; };
  const t0 = fire(0), t1 = fire(1), t2 = fire(2), t3 = fire(3);
  assert.ok(t1.shots > t0.shots * 1.3, `rapid: ${t1.shots} volleys against ${t0.shots}`);
  const B = empty(); B.ship.gun = 2; steps(B, 1, { fire: true });
  assert.equal(B.bolts.length, 4, 'the spread: four bolts a volley');
  assert.ok(B.bolts.some((b) => b.fan === 1) && B.bolts.some((b) => b.fan === -1), 'fanned either side');
  assert.ok(t3.shots >= t2.shots && gunOf(B).id === 'spread');
});

test('a hit takes the gun back to the twin bolts; a run and a retry start there; at the top a drop is a token of points', () => {
  const S = empty();
  S.ship.gun = 3;
  S.shots.push({ ds: 1, u: S.ship.u, v: S.ship.v, vds: 0, vu: 0, vv: 0, life: 1, r: 0.9 });
  const ev = steps(S, 2, {});
  assert.ok(ev.some((e) => e.kind === 'hurt'));
  assert.ok(ev.some((e) => e.kind === 'gunLost' && e.from === 3));
  assert.equal(S.ship.gun, 0);
  assert.equal(newRun({ from: 33, fails: 1 }).ship.gun, 0, 'a retry from the checkpoint starts with the twin bolts');
  const T = empty(); T.ship.gun = GUNS.length - 1;
  T.drops.push({ id: 1, s: T.s + 3, u: T.ship.u, v: T.ship.v, u1: T.ship.u, v1: T.ship.v, age: 0, taken: false });
  const s0 = T.score, e2 = steps(T, 30, {});
  const up = e2.find((e) => e.kind === 'upgrade');
  assert.ok(up && up.pts === DROPS.pts && T.score === s0 + DROPS.pts && T.ship.gun === GUNS.length - 1);
});

test('a wave of fighters downed to the last leaves a drop; one that got away, none', () => {
  const clear = empty();
  clear.script = [{ t: 0.01, wave: 'vee', n: 3 }];
  const ev = steps(clear, 60 * 9, botInput);
  const kills = ev.filter((e) => e.kind === 'kill' && e.foe === 'skiff').length;
  assert.equal(kills, 3);
  assert.ok(ev.some((e) => e.kind === 'drop' && e.from === 'wave'), 'downed to the last: a drop');
  const left = empty();
  left.script = [{ t: 0.01, wave: 'vee', n: 3 }];
  const ev2 = steps(left, 60 * 9, { y: 0 });
  assert.ok(!ev2.some((e) => e.kind === 'drop'), 'none downed: no drop');
  // in a whole run the pilot takes them and climbs the tiers
  const R = newRun({ seed: seedOf('edena') });
  const all = [];
  while (!R.done) all.push(...runStep(R, botInput(R), 1 / 60));
  assert.ok(all.filter((e) => e.kind === 'drop').length >= 8, 'drops all through the run');
  assert.equal(R.ship.gunBest, GUNS.length - 1, 'the pilot reaches the top tier');
});

test('the HUD: the gun\'s tier and the gauge beside the missiles, the same on an engine; the controls in pad form', () => {
  const S = newRun({});
  let n = hudNote(S);
  assert.match(n.html, /pirates-gun/); assert.match(n.html, /pirates-gauge/); assert.match(n.html, /pirates-missiles/);
  assert.match(n.html, new RegExp(GUNS[0].name));
  assert.equal((n.html.match(/pirates-gun.*?<em>/)[0].match(/<i class="gone">/g) ?? []).length, GUNS.length - 1, 'no tier yet');
  assert.match(n.text, /GUN .*Twin bolts/); assert.match(n.text, /BOOST/);
  assert.equal(n.cells, GAUGE_CELLS);
  S.ship.gun = 2; S.ship.meter = 0.5;
  const m = hudNote(S);
  assert.notEqual(m.key, n.key, 'redrawn when it changes');
  assert.match(m.html, new RegExp(GUNS[2].name)); assert.equal(m.cells, GAUGE_CELLS / 2);
  S.ship.spent = true;
  assert.match(hudNote(S).html, /pirates-gauge spent/);
  // the controls: RB / R1 boosts, LB / L1 brakes, in the pad's own form; one entry in the small row for both
  const C = pirateControls('dive');
  assert.ok(C.pad.some(([k, v]) => k === 'RB / R1, held' && /boost/.test(v)) && C.pad.some(([k, v]) => k === 'LB / L1, held' && /brake/.test(v)));
  assert.ok(C.keys.some(([k]) => /Shift/.test(k)) && C.keys.some(([k]) => /\bZ\b/.test(k)));
  assert.ok(!C.pad.some(([k, v]) => /LB/.test(k) && /roll/.test(v)), 'the roll left LB');
  const H = pirateHints('dive');
  for (const kind of ['pad', 'keys', 'touch']) assert.ok(H[kind].some(([, w, id]) => id === 'speed' && /boost · brake/.test(w)), kind);
  assert.match(pirates.rules, /Boost or brake/); assert.match(pirates.rules, /stronger guns/);
  // the sounds of it
  for (const k of ['boost', 'brake', 'spent', 'upgrade', 'gunLost']) assert.ok(PIRATE_SOUNDS[k] && typeof pirateSounds(null)[k] === 'function', k);
});

test('on the page: the boost widens the view and stretches the dust, a drop is drawn, the guns\' words and sounds', () => {
  const was = globalThis.location;
  globalThis.location = { search: '?stage=drift' };
  try {
    const scene = new THREE.Scene(); const gen = pirates.build(scene); let r; while (!(r = gen.next()).done);
    const level = r.value, fovs = [], flashes = [], heard = [];
    const sound = { ctx: { currentTime: 0 }, muted: false, fx: {}, sweep: () => heard.push('sweep'), burst: () => heard.push('burst'), noiseGlide: () => heard.push('glide'), ting: () => heard.push('ting') };
    const ctx = { camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000), level, scene, player: { object: {} }, sound, state: { data: { flags: {} }, flag: () => undefined, set() {} }, settings: {},
      sfx: { hurt() {} }, setLives() {}, setScore() {}, setFov: (f) => fovs.push(f), flash: (t) => flashes.push(t), kick() {}, finish() {}, speed() {}, hintUsed() {}, hintNote() {} };
    const sess = pirates.start(ctx), S = sess.state;
    S.script = []; S.rocks = [];
    for (let i = 0; i < 60; i++) { sound.ctx.currentTime += 1 / 60; sess.update(1 / 60, {}, { live: true, phase: 'play', raw: { PadBlade: true } }); }
    assert.ok(S.ship.speedK > 1.5, 'RB boosts');
    assert.ok(Math.max(...fovs) > CAM.fov + 3, `the view widens to ${Math.max(...fovs).toFixed(1)}°`);
    let least = 9;
    for (let i = 0; i < 90; i++) { sess.update(1 / 60, {}, { live: true, phase: 'play', raw: { PadGuard: true } }); least = Math.min(least, S.ship.speedK); }
    assert.ok(least < 0.7, `LB brakes (${least.toFixed(2)})`);
    assert.ok(Math.min(...fovs) < CAM.fov - 2, 'the view narrows');
    // a drop, drawn; taken, the gun's name flashed
    S.drops.push({ id: 99, s: S.s + 20, u: S.ship.u, v: S.ship.v, u1: S.ship.u, v1: S.ship.v, age: 0, taken: false });
    sess.update(1 / 60, {}, { live: true, phase: 'play', raw: {} });
    assert.ok(level.pirates.gifts.parts[0].mesh.count === 1, 'the drop drawn');
    for (let i = 0; i < 90; i++) sess.update(1 / 60, {}, { live: true, phase: 'play', raw: {} });
    assert.equal(S.ship.gun, 1);
    assert.ok(flashes.includes(GUNS[1].name), `flashed: ${flashes.join(' | ')}`);
    assert.ok(heard.includes('ting'), 'heard');
    sess.end();
  } finally { if (was === undefined) delete globalThis.location; else globalThis.location = was; }
});
