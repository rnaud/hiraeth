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
import { keyText } from '../src/prompt-keys.js';
import { Door, Key, KEY_CHEST, MapChest, MAP_CHEST, GREAT_KEY_CHEST, keyGeometry, greatKeyGeometry } from '../src/temples/pieces.js';
import { createBoxes } from '../src/boxes/index.js';
import { CARD_MIN } from '../src/boxes/scene.js';
import { markShape } from '../src/makers-mark/shape.js';
import { parseLine, TONES } from '../src/story/tone.js';
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
    // Unlocking is now the selected three-second magical gesture; key-get bells stay distinct.
    const plays = []; s.bank = { start(group, options) { plays.push({ group, options }); return { duration: 3, stop() {} }; } };
    const before = made.length; s.keyTurn();
    assert.deepEqual(plays.map(p => p.group), ['key-unlock']);
    assert.equal(made.length, before, 'no mechanical oscillators layered over the recording');

  } finally {
    clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.();
    if (saved.AudioContext) G.AudioContext = saved.AudioContext; else delete G.AudioContext;
    if (saved.window === undefined) delete G.window;
  }
});

// Issue #486 (the author: "The map and the house great key should have a message when it's found. Like when you open any
// other major chest. The great key should have a distinctive design vs regular keys"): the great key after its sheet
// (references/objects/great-key/sheet-1.jpg), and the map's and the great key's card, a makers' box's (src/boxes/card.js).
const tris = (geos) => geos.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
const bounds = (geos) => { const b = new THREE.Box3(); for (const g of geos) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };

test('the great key: the makers\' mark for a bow, brass, pale stone and the house\'s light, a stepped ward; the small key as it was', () => {
  const small = keyGeometry(), G = greatKeyGeometry();
  assert.equal(small.length, 4, 'the small key: a ring, a shaft, two bits');
  assert.equal(tris(small), 272, 'the small key unchanged');
  assert.deepEqual(Object.keys(G), ['brass', 'stone', 'light'], 'three meshes: brass, stone, the light');
  const all = [...G.brass, ...G.stone, ...G.light];
  assert.ok(!all.some((g) => g.type === 'TorusGeometry'), 'no ring: its bow is the mark');
  const bows = G.stone.filter((g) => g.type === 'ExtrudeGeometry');
  assert.equal(bows.length, markShape().length, 'the bow: the shared mark\'s own contours, one solid each');
  assert.equal(G.brass.filter((g) => g.type === 'ExtrudeGeometry').length, markShape().length, 'and its brass rim');
  assert.ok(G.stone.filter((g) => g.type === 'BoxGeometry').length >= 3, 'a ward of three steps or more');
  assert.ok(G.light.length >= 3, 'the light: the collar\'s band, the shaft\'s channel, the steps\' edges');
  const B = bounds(all), b = bounds(small);
  assert.ok(B.max.y - B.min.y > (b.max.y - b.min.y) * 1.6, `longer than the small key (${(B.max.y - B.min.y).toFixed(2)} m)`);
  assert.ok(B.max.y - B.min.y < 2.2, 'and about the old great key\'s length');
  assert.ok(tris(all) < 1200, `cheap (${tris(all)} triangles)`);
});

test('the great key\'s chest and the map\'s: a card as a makers\' box\'s, once; the key hangs over its chest till it is put away', () => {
  game.reset();
  const w = world('garage'), rt = w.rt;
  const P = { pos: V(), lastSafe: V(), opts: {} };
  const toasts = [];
  rt.connect({ player: P, sound: recorder().sound, toast: (x) => toasts.push(x) });
  const boxes = quiet(() => createBoxes({ levelId: TEMPLE_HOME.garage ?? 'garage', scene: new THREE.Scene(), physics: w.physics, level: w.level, table: {} }));
  const heard = [];
  const off = game.on('temple:found', (e) => heard.push(e.kind));
  try {
    for (const chest of [rt.pieces.find((p) => p instanceof Key && p.o.big), rt.pieces.find((p) => p instanceof MapChest)]) {
      const C = chest.o.map ? MAP_CHEST : GREAT_KEY_CHEST;
      for (const line of [C.found, C.line]) assert.ok(TONES.includes(parseLine(line).tone) && parseLine(line).explicit, `${line}: a tone`);
      assert.ok(parseLine(C.found).text.length < 50, 'terse');
      P.pos.copy(chest.pos);
      heard.length = 0; toasts.length = 0;
      let t = 0;
      const step = (secs) => { for (let i = 0; i < secs * 30; i++) { rt.update(1 / 30, (t += 1 / 30)); boxes.update(1 / 30, t); } };
      assert.ok(chest.openIt());
      step(KEY_CHEST.rise[1] + 0.1);
      assert.deepEqual(heard, [chest.o.map ? 'map' : 'big'], 'its card asked for once');
      assert.ok(boxes.busy() && boxes.told, 'the card is up: the game waits on it, as on a box\'s');
      const st = screen.state.boxCard;
      assert.equal(st?.name, C.name, 'its name on the card (the engines draw it: screen \'boxCard\')');
      assert.equal(st?.text, keyText(parseLine(C.found).text, { teach: true }), 'its line, the tone left off, a {key:…} the player\'s own (#563)');
      step(KEY_CHEST.done + 1);
      assert.ok(chest.key.visible && chest.opening, 'the key hangs over its chest while the card is up');
      if (!chest.o.map) assert.equal(rt.keyCount().big, false, 'not yet in the counter');
      assert.equal(heard.length, 1, 'once');
      boxes.dismiss();
      assert.ok(!boxes.busy() && !screen.state.boxCard, 'put away');
      step(KEY_CHEST.done);
      assert.equal(chest.opening, null, 'then on: into the counter');
      if (!chest.o.map) assert.equal(rt.keyCount().big, true, 'the great key in hand');
      assert.ok(!toasts.some((x) => x === parseLine(C.line).text), 'said on its card, not twice');
      assert.equal(heard.length, 1, 'once, the card put away');
    }
    // a press too soon doesn't put it away (CARD_MIN, as a box's card); skip does
    assert.ok(boxes.announce({ name: 'x', text: 'y' }));
    assert.equal(boxes.dismiss(), false);
    boxes.update(CARD_MIN + 0.01, 0);
    assert.equal(boxes.dismiss(), true);
    assert.ok(boxes.announce({ name: 'x' })); boxes.skip(); assert.equal(boxes.busy(), false);
  } finally { off(); boxes.dispose(); rt.dispose?.(); }
});

test('the three map displays retain optional collection and opened-save state without enlarging keys', () => {
  for(const id of ['desert','bazaar','arzach']) {
    game.reset();
    const first=world(id), rt=first.rt;
    const map=rt.pieces.find(p=>p instanceof MapChest);
    const e=rt.def.logic.elements[map.id];
    assert.equal(map.scale,1.5);
    assert.ok(map.pos.distanceTo(rt.kit.world(e.at[0],e.at[1]+.24,e.at[2]))<1e-6);
    for(const key of rt.pieces.filter(p=>p instanceof Key && !(p instanceof MapChest))) {
      assert.equal(key.scale,key.o.big?KEY_CHEST.big:KEY_CHEST.small,'unrelated key size preserved');
    }
    const before=rt.keyCount();
    assert.ok(map.openIt(),'optional map opens through its actual interaction handler');
    assert.equal(map.openIt(),false,'cannot grant twice');
    assert.deepEqual(rt.keyCount(),before,'map is not a puzzle key');
    rt.dispose?.();
    const loaded=world(id);
    const old=loaded.rt.pieces.find(p=>p instanceof MapChest);
    assert.equal(old.taken,true,'existing saved map stays opened at its new display');
    assert.equal(old.openIt(),false,'reload cannot reannounce or grant the map');
    loaded.rt.dispose?.();
  }
});
