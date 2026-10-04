import test from 'node:test';
import assert from 'node:assert/strict';
import { installNativePad, padText, padLayout } from '../src/native-pad.js';
import { Controller } from '../src/controller.js';

test('Android prompts use the handheld button names', () => {
  assert.equal(padText('A / × jump · X / □ use · Y / △ ping · RT / R2 run · B / ○ push'), 'A jump · X use · Y ping · R2 run · B push');
  assert.equal(padText('LT/L2 aim the fluid tool, RT/R2 shoot · View sketchbook · Menu settings'), 'L2 aim the fluid tool, R2 shoot · Select sketchbook · Start settings');
  assert.equal(padText('Left stick fly · LB/RB down/up · LT tool'), 'Left stick fly · L1/R1 down/up · L2 tool');
  assert.equal(padText('(*Shoot*: click, G, or RT.)'), '(*Shoot*: click, G, or R2.)');
  assert.equal(padText('A / × jump', 'standard'), 'A / × jump');
  assert.equal(padText('Menu of the day, View from the rim'), 'Menu of the day, View from the rim', 'ordinary words stay');
});

test('the app\'s native controls arrive as a standard gamepad that moves the traveller', () => {
  const win = { navigator: { getGamepads: () => [] }, performance: { now: () => 1 }, dispatchEvent() {}, document: null, location: { search: '' } };
  globalThis.Event ??= class { constructor(t) { this.type = t; } };
  installNativePad(win);
  assert.deepEqual(win.navigator.getGamepads(), [], 'nothing until the app sends input');
  const b = Array(17).fill(0); b[0] = 1;                       // A held
  win.__nativePad('Retroid Pocket Controller', [0, -1, 0.5, 0], b);   // left stick full forward
  const pads = win.navigator.getGamepads();
  assert.equal(pads[0].mapping, 'standard');
  assert.equal(padLayout(win), 'android');
  const c = new Controller({ pads: () => win.navigator.getGamepads(), context: () => 'game', action() {}, look() {}, navigate() {}, scroll() {} });
  const held = c.update(1 / 60);
  assert.ok(held.KeyW && held.stick.y > 0.9, 'the stick walks forward');
  assert.ok(held.Space, 'A jumps');
});

test('a pad without the standard mapping is still read', () => {
  const pad = { connected: true, mapping: '', index: 0, axes: [0.9, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
  const c = new Controller({ pads: () => [pad], context: () => 'game', action() {}, look() {}, navigate() {}, scroll() {} });
  assert.ok(c.update(1 / 60).KeyD);
});
