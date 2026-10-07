import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installNativePad, padText, padLayout, padFaces, padIndex, confirmKey, backKey, setFaces, watchLabels } from '../src/native-pad.js';
import { Controller, padRide } from '../src/controller.js';
import { Hoverbike } from '../src/bike.js';
import { Bird } from '../src/bird.js';
import { Taxi } from '../src/taxi.js';

const fakeWin = (ids = [], search = '', extra = {}) => ({ location: { search }, localStorage: { getItem: () => null }, navigator: { getGamepads: () => ids.map((id) => ({ id })) }, ...extra });

test('Android prompts use the handheld button names', () => {
  assert.equal(padText('A / × jump · X / □ use · Y / △ ping · RT / R2 run · B / ○ push', 'android', 'xbox'), 'A jump · X use · Y ping · R2 run · B push');
  assert.equal(padText('LT/L2 aim the fluid tool, RT/R2 shoot · View sketchbook · Menu settings'), 'L2 aim the fluid tool, R2 shoot · Select sketchbook · Start settings');
  assert.equal(padText('View gear and sketchbook · RB / R1 push · LB / L1 zoom'), 'Select gear and sketchbook · R1 push · L1 zoom');
  assert.equal(padText('Left stick fly · LB/RB down/up · LT tool'), 'Left stick fly · L1/R1 down/up · L2 tool');
  assert.equal(padText('(*Shoot*: click, G, or RT.)'), '(*Shoot*: click, G, or R2.)');
  assert.equal(padText('A / × jump', 'standard', 'xbox'), 'A / × jump');
  assert.equal(padText('Menu of the day, View from the rim'), 'Menu of the day, View from the rim', 'ordinary words stay');
});

test('a Retroid prints its letters Nintendo-style: prompts written by position name the letter on that button', () => {
  // the prompts are by position (Xbox form): bottom A / ×, right B / ○, left X / □, top Y / △
  const hint = 'A / × jump · B / ○ talk · X / □ call your mount · Y / △ ping · A/× again';
  assert.equal(padText(hint, 'android', 'nintendo'), 'B jump · A talk · Y call your mount · X ping · B again');
  assert.equal(padText(hint, 'standard', 'nintendo'), 'B jump · A talk · Y call your mount · X ping · B again', 'a Nintendo pad on a computer too');
  assert.equal(padText(hint, 'standard', 'xbox'), hint, 'Xbox / PlayStation: as written');
  assert.equal(padText('A small box. B-side.', 'android', 'nintendo'), 'A small box. B-side.', 'ordinary words stay');
});

test('where the face buttons are: auto, and the "Controller buttons" setting', () => {
  // the Android app (or a Retroid in Chrome): Nintendo letters reported by letter
  assert.deepEqual(padFaces(fakeWin(['Retroid Pocket Controller'])), { faces: 'nintendo', byLabel: true });
  assert.deepEqual(padFaces(fakeWin([], '', { Capacitor: { isNativePlatform: () => true } })), { faces: 'nintendo', byLabel: true }, 'the app before the first press');
  assert.deepEqual(padFaces(fakeWin(['Xbox Wireless Controller'], '?pad=android')), { faces: 'xbox', byLabel: false }, 'an Xbox pad on a phone');
  assert.deepEqual(padFaces(fakeWin(['Xbox 360 Controller (STANDARD GAMEPAD)'])), { faces: 'xbox', byLabel: false }, 'a computer');
  // the setting
  const retroid = fakeWin(['Retroid Pocket Controller']);
  assert.deepEqual(padFaces(retroid, 'xbox'), { faces: 'xbox', byLabel: false });
  assert.deepEqual(padFaces(retroid, 'nintendo-xbox'), { faces: 'nintendo', byLabel: false }, 'a Retroid switched to its own Xbox style reports positions');
  assert.deepEqual(padFaces(fakeWin(['Pro Controller']), 'nintendo'), { faces: 'nintendo', byLabel: false }, 'a computer reports positions');
  // menus confirm with printed A: index 0, unless the pad reports positions with A on the right
  assert.equal(padIndex('ok', retroid), 0);
  assert.equal(padIndex('back', retroid), 1);
  assert.equal(padIndex('ok', fakeWin(['Xbox'])), 0);
  setFaces('nintendo-xbox');
  assert.equal(padIndex('ok', retroid), 1, 'printed A on the right, reported as button 1');
  setFaces('auto');
  // the menu prompts name printed A / B, whatever the layout
  assert.equal(padText(confirmKey(retroid), 'android', 'nintendo'), 'A');
  assert.equal(padText(backKey(retroid), 'android', 'nintendo'), 'B');
  assert.equal(confirmKey(fakeWin(['Xbox'])), 'A / ×');
  assert.equal(backKey(fakeWin(['Xbox'])), 'B / ○');
});

test('the page relabels when the setting changes, and back', () => {
  const text = (v) => ({ nodeType: 3, nodeValue: v });
  const nodes = [text('A / × jump · B / ○ talk'), text('Menu of the day')];
  const body = { nodeType: 1, tagName: 'BODY', childNodes: nodes };
  let observed = 0;
  const win = { document: { body }, location: { search: '' }, localStorage: { getItem: () => 'standard' }, navigator: {},
    MutationObserver: class { observe() { observed++; } } };
  const saved = globalThis.window; globalThis.window = win;
  try {
    watchLabels(win);
    assert.equal(observed, 0, 'standard layout, Xbox letters: nothing to watch');
    setFaces('nintendo', win);
    assert.equal(nodes[0].nodeValue, 'B jump · A talk');
    assert.equal(observed, 1);
    watchLabels(win);   // (as when the observer sees its own change) must not swap it back
    assert.equal(nodes[0].nodeValue, 'B jump · A talk');
    setFaces('auto', win);
    assert.equal(nodes[0].nodeValue, 'A / × jump · B / ○ talk', 'the prompt as the game wrote it');
    assert.equal(nodes[1].nodeValue, 'Menu of the day');
  } finally { globalThis.window = saved; }
});

test('the app\'s native controls arrive as a standard gamepad: on a Retroid, B (bottom) jumps and A (right) talks', () => {
  const win = { navigator: { getGamepads: () => [] }, performance: { now: () => 1 }, dispatchEvent() {}, document: null, location: { search: '' } };
  globalThis.Event ??= class { constructor(t) { this.type = t; } };
  installNativePad(win);
  assert.deepEqual(win.navigator.getGamepads(), [], 'nothing until the app sends input');
  const b = Array(17).fill(0); b[1] = 1;                       // KEYCODE_BUTTON_B held: the Retroid's bottom button
  win.__nativePad('Retroid Pocket Controller', [0, -1, 0.5, 0], b);   // left stick full forward
  const pads = win.navigator.getGamepads();
  assert.equal(pads[0].mapping, 'standard');
  assert.equal(padLayout(win), 'android');
  const c = new Controller({ pads: () => win.navigator.getGamepads(), context: () => 'game', action() {}, look() {}, navigate() {}, scroll() {}, faces: () => padFaces(win) });
  let held = c.update(1 / 60);
  assert.ok(held.KeyW && held.stick.y > 0.9, 'the stick walks forward');
  assert.ok(held.Space && !held.KeyE, 'B jumps');
  b[1] = 0; b[0] = 1;                                           // KEYCODE_BUTTON_A: the right button
  win.__nativePad('Retroid Pocket Controller', [0, 0, 0, 0], b);
  held = c.update(1 / 60);
  assert.ok(held.KeyE && !held.Space, 'A interacts');
});

test('a pad without the standard mapping is still read', () => {
  const pad = { connected: true, mapping: '', index: 0, axes: [0.9, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
  const c = new Controller({ pads: () => [pad], context: () => 'game', action() {}, look() {}, navigate() {}, scroll() {} });
  assert.ok(c.update(1 / 60).KeyD);
});

// ---- riding on the triggers

const flat = { groundAt: () => 0, pushCapsule: () => false, rayDistance: () => Infinity };
const ride = (o) => ({ PadRide: true, Throttle: 0, Brake: 0, stick: { x: 0, y: 0 }, ...o });

test('the hoverbike: RT goes (analog), LT brakes, the stick steers; pushing the stick alone does not drive', () => {
  const run = (input, n = 120) => { const b = new Hoverbike(flat); b.place(0, 0, 0, new THREE.Vector3()); b.board?.(); for (let i = 0; i < n; i++) b.update(1 / 60, input); return b; };
  assert.ok(Math.abs(run(ride({ stick: { x: 0, y: 1 } })).speed) < 0.5, 'the stick pushed forward: nothing');
  const full = run(ride({ Throttle: 1 })), half = run(ride({ Throttle: 0.5 }));
  assert.ok(full.speed > 15 && half.speed > 5 && half.speed < full.speed * 0.7, `${half.speed} < ${full.speed}`);
  const turn = run(ride({ Throttle: 1, stick: { x: 1, y: 0 } }));
  assert.ok(turn.heading < -0.5, 'the stick turns it (right)');
  const boost = run(ride({ Throttle: 1, Boost: true }), 300);
  assert.ok(boost.speed > run(ride({ Throttle: 1 }), 300).speed + 5, 'RB / L3 boosts');
  const b = run(ride({ Throttle: 1 }));
  for (let i = 0; i < 60; i++) b.update(1 / 60, ride({ Brake: 1 }));
  assert.ok(b.speed < 5, 'LT brakes');
  assert.ok(run({ KeyW: true }).speed > 15, 'the keyboard as before');
});

test('the bird: RT flies on and takes off, the stick dives (forward) and climbs (back)', () => {
  const bird = new Bird(flat); bird.board();
  for (let i = 0; i < 60; i++) bird.update(1 / 60, ride({ Throttle: 1 }));
  assert.equal(bird.landed, false, 'a full squeeze on the ground: she takes off');
  const fly = (y, throttle = 0.6) => { const b = new Bird(flat); b.mode = 'ridden'; b.landed = false; b.speed = 25; b.pos.set(0, 200, 0); for (let i = 0; i < 90; i++) b.update(1 / 60, ride({ Throttle: throttle, stick: { x: 0, y } })); return b; };
  assert.ok(fly(1).pos.y < fly(0).pos.y - 3 && fly(-1).pos.y > fly(0).pos.y, 'forward dives, back climbs');
  assert.ok(fly(0, 1).speed > fly(0, 0).speed + 3, 'RT: thrust');
  const bank = new Bird(flat); bank.mode = 'ridden'; bank.landed = false; bank.speed = 25; bank.pos.set(0, 200, 0);
  for (let i = 0; i < 60; i++) bank.update(1 / 60, ride({ stick: { x: -1, y: 0 } }));
  assert.ok(bank.bank < -0.3, 'the stick banks');
});

test('the cab drives itself: RT and the stick do nothing, X / □ asks where to', () => {
  const seated = (o, n = 90) => { const t = new Taxi(flat, '#fff', 1, () => {}); t.pos.set(0, 40, 0); t.heading = 0; t.board(); t.asking = false; for (let i = 0; i < n; i++) t.update(1 / 60, ride(o), i / 60); return t; };
  for (const o of [{ Throttle: 1 }, { stick: { x: 1, y: 1 } }, { Brake: 1, stick: { x: -1, y: -1 } }]) {
    const t = seated(o);
    assert.ok(t.speed < 0.01 && Math.hypot(t.pos.x, t.pos.z) < 0.01 && Math.abs(t.pos.y - 40) < 0.2 && t.heading === 0, `it waits where it is (${JSON.stringify(o)})`);
    assert.equal(t.asking, false);
  }
  assert.equal(seated({ Space: true }, 2).asking, true, 'X / □ (the pad\'s Space while riding): where to?');
  assert.equal(padRide({ KeyW: true }), null);
});

test('View / Select opens the game menu on your items: each one, the backpack first, the gun mode in use marked', async () => {
  const { itemsData } = await import('../src/game-menu-data.js');
  const { itemsPanel } = await import('../src/game-menu.js');
  const d = itemsData({ owned: ['bell', 'stun', 'backpack', 'jetpack'], mode: 'stun', modes: ['shoot', 'stun'] });
  assert.deepEqual(d.gear.map((g) => g.id), ['backpack', 'jetpack', 'stun', 'bell'], 'the backpack first, then by kind');
  assert.equal(d.gear.find((g) => g.id === 'stun').inUse, true);
  assert.equal(d.gear.find((g) => g.id === 'backpack').usable, true, 'plain fluid: A / × takes it');
  assert.equal(d.gear.find((g) => g.id === 'bell').usable, false);
  const { html, rows } = itemsPanel(d);
  assert.match(html, /Gear <span>4 of \d+<\/span>/);
  assert.match(html, /<em>in use<\/em>/);
  assert.equal(rows[0][0].name, 'Magic-fluid backpack');
  assert.match(rows[0][0].desc, /Aim \(LT \/ L2/, 'what it is and what it does, at the bottom');
  assert.match(itemsPanel(itemsData({ owned: [] })).html, /Nothing to deliver|Nothing of value yet/);
});
