// Issue #274 (the author: "When I get a key in a temple there should be a sound effect, it should be in a little chest.
// And I should have a key counter on my screen. Like Zelda"): every temple key in a little makers' chest on flat floor
// (src/temples/pieces.js Key), its short opening (the latch, the halves, the light, the key rising and ringing,
// Sound.keyGet, then into the counter), the counter (src/hud.js keysHud, runtime.js keyCount: shown inside a house
// that keeps keys, at none too, never outside), and the soft click of a key in a lock (Sound.keyTurn).
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { Door, Key, KEY_CHEST } from '../src/temples/pieces.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { game } from '../src/game-state.js';
import { allInteractables } from '../src/interact.js';
import { keysHud, KEY_SVG, GREAT_KEY_SVG } from '../src/hud.js';
import { screen } from '../src/platform.js';
import { AudioContext, installAudio } from '../engine/webaudio.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

// (the Clock-House the opening's test built, kept for the next test to read its great key's id from)
let opened = null;
function world(id) {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  return { level, physics, rt: templeOf(level, id) ?? level.temple };
}

/** A sound that only writes down what it was asked to play. */
const recorder = () => { const said = []; return { said, sound: new Proxy({}, { get: (_, k) => (...a) => { said.push([k, ...a]); } }) }; };

// (that every temple key is in a little makers' chest, on flat floor, with room before it is checked in
// tests/temples.test.js, which builds every temple already: docs/systems/testing.md "Heavy tests")

test('a key chest opens with a short scene: latch, halves, light, the key rising and ringing, then into the counter; a lock clicks softly', () => {
  game.reset();
  const w = (opened = world('garage')), rt = w.rt, L = rt.logic;
  const { said, sound } = recorder();
  const toasts = [];
  const k = rt.pieces.find((p) => p instanceof Key && !p.o.big);
  const P = { pos: k.pos.clone().addScaledVector(V(Math.sin(k.yaw), 0, Math.cos(k.yaw)), 1.4), lastSafe: V(), opts: {} };
  rt.connect({ player: P, sound, toast: (x) => toasts.push(x) });
  let t = 0;
  const step = (secs) => { for (let i = 0; i < secs * 30; i++) rt.update(1 / 30, (t += 1 / 30)); };
  const chest = allInteractables().find((e) => e.id === `temple.${rt.id}.${k.id}`);
  assert.ok(chest, 'the chest is opened with the use button');
  assert.equal(chest.prompt, 'open the chest');
  step(0.5);
  assert.equal(chest.enabled(), false, 'caged: not yet');
  k.free = () => true;   // (its step done: the arena won)
  step(1.5);
  assert.ok(k.cage.visible === false, 'the bars sunk');
  assert.equal(chest.enabled(), true);
  assert.ok(rt.inside(P.pos));
  assert.deepEqual(rt.keyCount(), { small: 0, big: false });
  assert.deepEqual(keysHud({ inside: true, ...rt.keyCount() }), { small: 0, big: false }, 'the counter shows in the house at none');
  chest.use();
  assert.ok(L.isFound(k.id), 'the key is yours at once (saved)');
  assert.equal(chest.enabled(), false, 'opened once');
  assert.ok(said.some(([s]) => s === 'boxLatch'), 'the latch clicks');
  assert.equal(rt.keyCount().small, 0, 'still in the chest: not yet in the counter');
  step(KEY_CHEST.latch + KEY_CHEST.open * 0.6);
  assert.ok(k.chest.opened.visible, 'its halves part');
  assert.ok(k.lightK > 0.3 && k.light?.visible, `light out of it (${k.lightK.toFixed(2)})`);
  assert.ok(k.lamp.w > 0, 'its lamp lights round it');
  step(KEY_CHEST.rise[1] - (KEY_CHEST.latch + KEY_CHEST.open * 0.6));
  assert.ok(k.key.visible && k.key.position.y > k.H, 'the key risen clear of the chest');
  const rang = said.filter(([s]) => s === 'keyGet');
  assert.equal(rang.length, 1, 'it rings once');
  assert.equal(rang[0][1], false, 'a small key\'s chime');
  assert.equal(rt.keyCount().small, 0);
  step(KEY_CHEST.counted - KEY_CHEST.rise[1] + 0.05);
  assert.equal(rt.keyCount().small, 1, 'into the counter');
  assert.ok(toasts.some((x) => /small key/i.test(x)), 'it says what it is');
  step(KEY_CHEST.done - KEY_CHEST.counted + 0.1);
  assert.equal(k.opening, null, 'over in a couple of seconds');
  assert.equal(k.light, null, 'the light gone');
  assert.ok(k.chest.opened.visible && !k.chest.shell.visible, 'left open');
  assert.equal(k.key.visible, false);
  assert.ok(k.lamp.y < -1e4);
  // outside the house: no counter
  assert.equal(keysHud({ inside: rt.inside(V(1e4, 0, 1e4)), ...rt.keyCount() }), null);
  assert.equal(keysHud({ inside: true, small: 1, quiet: true }), null, 'not over a scene or photo mode');
  // a lock it fits: walked up to, the key turns with a soft click, and the counter goes down
  const door = rt.pieces.find((p) => p instanceof Door && L.el(p.id)?.lock === 'small' && L.canUnlock(p.id));
  assert.ok(door, 'a small lock the key fits');
  said.length = 0;
  P.pos.copy(door.group.position).add(V(0, 0.1, 0));
  step(0.6);
  assert.equal(L.keysIn(door.id), 1, 'the key went in');
  assert.ok(said.some(([s]) => s === 'keyTurn'), 'a soft click');
  assert.ok(!said.some(([s, kind]) => s === 'critter' && kind === 'clank'), 'not the clank');
  assert.equal(rt.keyCount().small, 0, 'out of the counter');
  rt.dispose?.();
});

test('a key chest opened, on a load: open and quiet; the great key counts in the counter too', () => {
  game.reset();
  // (the great key's id from the Clock-House the test before built and put away, or one built here)
  const w0 = opened ?? world('garage');
  const big = w0.rt.pieces.find((p) => p instanceof Key && p.o.big);
  w0.rt.logic.find(big.id) || game.set(`temple.garage.found.${big.id}`, true);
  if (w0 !== opened) w0.rt.dispose?.();
  const w = world('garage');
  const k = w.rt.pieces.find((p) => p.id === big.id);
  assert.ok(k.taken && k.chest.opened.visible && !k.key.visible, 'open, the key gone');
  assert.equal(allInteractables().find((e) => e.id === `temple.garage.${k.id}`).enabled(), false);
  assert.equal(w.rt.keyCount().big, true, 'the great key in hand');
  w.rt.dispose?.();
});

test('the counter: hud data for an engine, and its icons inked', () => {
  assert.equal(keysHud({}), null);
  assert.deepEqual(keysHud({ inside: true, small: 2.7, big: 1 }), { small: 2, big: true });
  assert.deepEqual(keysHud({ inside: true, small: -1 }), { small: 0, big: false });
  assert.ok('keys' in screen.state, 'platform.js screen carries it');
  for (const svg of [KEY_SVG, GREAT_KEY_SVG]) assert.match(svg, /^<svg viewBox="[\d .]+" aria-hidden="true">.*stroke="#2b211f".*<\/svg>$/);
});

test('the key\'s chime is short and bright, the lock\'s click soft and shorter (rendered silently, in memory)', async () => {
  const G = globalThis;
  const saved = { window: G.window, AudioContext: G.AudioContext };
  G.window = G; G.window.addEventListener ??= () => {}; G.window.removeEventListener ??= () => {};
  delete G.AudioContext; installAudio(G);
  const { Sound, KEY_GET } = await import('../src/audio.js');
  const s = new Sound('desert', { score: false });
  s.start();
  try {
    assert.ok(s.ctx instanceof AudioContext, 'the in-memory context, never a speaker');
    s.ctx.render(4800);
    const rms = (a, from = 0, to = a.length) => { let q = 0, m = 0; for (let i = from; i < to; i += 2) { q += a[i] * a[i]; m++; } return Math.sqrt(q / Math.max(m, 1)); };
    const made = [], make = s.ctx.createOscillator.bind(s.ctx);
    s.ctx.createOscillator = () => { const o = make(); made.push(o); return o; };
    s.keyGet(false);
    const f = made.map((o) => o.frequency.value);
    assert.ok(f.length >= KEY_GET.notes.length * 3, 'a struck bell a note');
    assert.ok(Math.min(...f) > 400, `bright (${Math.min(...f).toFixed(0)} Hz up)`);
    const out = s.ctx.render(48000 * 2);
    const head = rms(out, 0, 24000), end = rms(out, 120000);
    assert.ok(head > 1e-4, `heard (${head.toExponential(1)})`);
    assert.ok(end < head / 10, 'short: gone within two seconds');
    assert.ok(out.every(Number.isFinite));
    made.length = 0;
    s.keyGet(true);
    assert.ok(Math.min(...made.map((o) => o.frequency.value)) < Math.min(...f), 'the great key\'s lower, with a low bell');
    s.ctx.render(48000 * 3);
    const base = rms(s.ctx.render(24000));   // (the world's own air under it)
    s.keyTurn();
    const click = s.ctx.render(48000);
    const c = rms(click, 0, 9600);
    assert.ok(c > base * 1.5 && c < head, `the lock's click, heard and softer than the chime (${base.toExponential(1)} < ${c.toExponential(1)} < ${head.toExponential(1)})`);
    // (short: only the effects' room rings on after it, gone within the second)
    assert.ok(rms(click, 40000) < c / 6, `and short (${rms(click, 24000, 36000).toExponential(1)} after half a second, ${rms(click, 40000).toExponential(1)} after 0.8 s, the click ${c.toExponential(1)})`);
  } finally {
    clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.();
    if (saved.AudioContext) G.AudioContext = saved.AudioContext; else delete G.AudioContext;
    if (saved.window === undefined) delete G.window;
  }
});
