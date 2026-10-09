import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePadId, pickProfile, remapPad, hatDirection, padState, axisMap, installPadMaps, PROFILES, describeSources } from '../src/pad-maps.js';
import { Controller } from '../src/controller.js';
import { actionLabel, pressLine, reverseSources } from '../src/input-display.js';
import { BINDINGS } from '../src/bindings.js';

// Fixtures: raw states as the browsers report them on a Mac (Chrome: axis = HID usage − 0x30, the hat on 9;
// Firefox / Safari: compact, in report order), from SDL's game controller database (Mac OS X rows) and the
// browsers' own remappers. Standard indices: 0 bottom, 1 right, 2 left, 3 top, 4 LB, 5 RB, 6 LT, 7 RT, 8 View,
// 9 Menu, 10 L3, 11 R3, 12–15 D-pad ↑ ↓ ← →, 16 Home.
const HAT = (dir) => (dir == null ? 3.2857 : -1 + dir * 2 / 7);   // 0 up, clockwise; null: neutral (Chrome's 15 → 3.29)
function raw(id, nButtons, nAxes, { hatAt = null, hat = null, rest = {} } = {}) {
  const pad = { id, index: 0, connected: true, mapping: '', timestamp: 1, buttons: Array.from({ length: nButtons }, () => ({ pressed: false, touched: false, value: 0 })), axes: Array(nAxes).fill(0) };
  if (hatAt != null) pad.axes[hatAt] = HAT(hat);
  for (const [i, v] of Object.entries(rest)) pad.axes[+i] = v;
  return pad;
}
const press = (pad, i, value = 1) => { pad.buttons[i] = { pressed: value > 0.5, touched: true, value }; return pad; };
const lit = (p) => p.buttons.map((b, i) => (b.pressed ? i : -1)).filter((i) => i >= 0);
/** each raw button pressed alone → the standard buttons lit */
function buttonMap(make) {
  const out = {};
  for (let i = 0; i < make().buttons.length; i++) { const s = padState(); remapPad(make(), s); out[i] = lit(remapPad(press(make(), i), s)); }
  return out;
}

test('ids: Chrome, Firefox and Safari forms', () => {
  assert.deepEqual(parsePadId('8BitDo SN30 Pro (Vendor: 2dc8 Product: 6101)'), { vendor: '2dc8', product: '6101', name: '8BitDo SN30 Pro', flavor: 'chrome' });
  assert.deepEqual(parsePadId('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), { vendor: '045e', product: '0b13', name: 'Xbox Wireless Controller', flavor: 'chrome' });
  assert.deepEqual(parsePadId('2dc8-6101-8BitDo SN30 Pro'), { vendor: '2dc8', product: '6101', name: '8BitDo SN30 Pro', flavor: 'firefox' });
  assert.deepEqual(parsePadId('54c-ce6-DualSense Wireless Controller'), { vendor: '054c', product: '0ce6', name: 'DualSense Wireless Controller', flavor: 'firefox' });
  assert.deepEqual(parsePadId('8BitDo SN30 Pro'), { vendor: null, product: null, name: '8BitDo SN30 Pro', flavor: 'name' });
});

test('profiles: chosen by vendor / product, else by name; standard pads keep theirs', () => {
  const p = (id, mapping = '') => pickProfile({ id, mapping }).key;
  for (const prod of ['6001', '6101', '6002', '6102', '6006', '5106']) assert.equal(p(`8BitDo (Vendor: 2dc8 Product: ${prod})`), '8bitdo', prod);
  assert.equal(p('8BitDo Ultimate (Vendor: 2dc8 Product: 3011)'), '8bitdo-xbox');
  assert.equal(p('2dc8-9012-8BitDo SN30'), '8bitdo-dpad');
  assert.equal(p('8BitDo SN30 Pro'), '8bitdo', 'Safari: by name');
  assert.equal(p('8BitDo Zero 2 gamepad'), '8bitdo-dpad');
  assert.equal(p('054c-0ce6-DualSense Wireless Controller'), 'dualsense');
  assert.equal(p('54c-5c4-Wireless Controller'), 'dualshock4');
  assert.equal(p('Pro Controller (Vendor: 057e Product: 2009)'), 'switchpro');
  assert.equal(p('USB Gamepad (Vendor: 0810 Product: e501)'), 'snes');
  assert.equal(p('Some Joystick (Vendor: 1234 Product: 5678)'), 'generic');
  assert.equal(p('8BitDo SN30 Pro (STANDARD GAMEPAD Vendor: 2dc8 Product: 6101)', 'standard'), 'standard');
});

test('hat switch: eight directions and neutral', () => {
  const want = [['up'], ['up', 'right'], ['right'], ['right', 'down'], ['down'], ['down', 'left'], ['left'], ['left', 'up']];
  want.forEach((dirs, k) => {
    const d = hatDirection(-1 + k * 2 / 7);
    assert.deepEqual(Object.keys(d).filter((n) => d[n]).sort(), dirs.slice().sort(), `step ${k}`);
  });
  assert.deepEqual(hatDirection(0.71), { up: false, right: false, down: false, left: true }, '0.71: left (the strip prints it so)');
  for (const neutral of [3.2857, 1.2857, -1.2857, 0, NaN, undefined]) assert.equal(hatDirection(neutral), null, `${neutral}: neutral`);
});

test('axes: Chrome places usages at fixed indices and the triggers in free slots; Firefox lists them in order', () => {
  assert.deepEqual(axisMap(['X', 'Y', 'Z', 'Rz', 'accel', 'brake', 'hat'], 'chrome'), { X: 0, Y: 1, Z: 2, Rz: 5, hat: 9, accel: 3, brake: 4 });
  assert.deepEqual(axisMap(['X', 'Y', 'Z', 'Rz', 'hat'], 'firefox'), { X: 0, Y: 1, Z: 2, Rz: 3, hat: 4 });
});

// the SN30 Pro in D-input (B + Start) in Chrome on a Mac: 15 buttons by HID usage, the hat on axis 9
const SN30_CHROME = () => raw('8BitDo SN30 Pro (Vendor: 2dc8 Product: 6101)', 15, 10, { hatAt: 9 });
const SN30_WANT = { 0: [1], 1: [0], 2: [16], 3: [3], 4: [2], 5: [], 6: [4], 7: [5], 8: [6], 9: [7], 10: [8], 11: [9], 12: [16], 13: [10], 14: [11] };

test('8BitDo SN30 Pro, Chrome: buttons by position, the hat is the D-pad, the right stick on axes 2 / 5', () => {
  assert.deepEqual(buttonMap(SN30_CHROME), SN30_WANT, 'raw 1 (B, the bottom) is the game\'s A / ×, raw 0 (A, the right) its B / ○, raw 4 (Y, left) X / □, raw 3 (X, top) Y / △');
  const s = padState(), pad = SN30_CHROME();
  pad.axes[0] = 0.5; pad.axes[1] = -0.25; pad.axes[2] = 0.75; pad.axes[5] = -1; pad.axes[3] = 0.3; pad.axes[4] = 0.3;
  const out = remapPad(pad, s);
  assert.equal(out.mapping, 'standard');
  assert.deepEqual(out.axes, [0.5, -0.25, 0.75, -1], 'Rz (axis 5) is the right stick\'s y; axes 3 / 4 are nothing (never seen at rest)');
  assert.equal(out.buttons.length, 17);
  const dirs = [[0, [12]], [1, [12, 15]], [2, [15]], [3, [13, 15]], [4, [13]], [5, [13, 14]], [6, [14]], [7, [12, 14]], [null, []]];
  for (const [d, want] of dirs) { const p = SN30_CHROME(); p.axes[9] = HAT(d); assert.deepEqual(lit(remapPad(p, s)), want, `hat ${d}`); }
  assert.equal(out.remap.hat, 9);
  assert.deepEqual(out.remap.sources[0], ['button 1']);
  assert.deepEqual(out.remap.sources[14], ['axis 9 (hat)']);
});

test('8BitDo SN30 Pro, Firefox and Safari (compact axes): the same buttons, the hat found where it is', () => {
  for (const id of ['2dc8-6101-8BitDo SN30 Pro', '8BitDo SN30 Pro']) {
    const make = () => raw(id, 15, 5, { hatAt: 4, hat: null, rest: { 4: 1.2857 } });
    assert.deepEqual(buttonMap(make), SN30_WANT, id);
    const s = padState(), p = make();
    p.axes = [0.1, 0.2, 0.6, -0.7, HAT(6)];
    const out = remapPad(p, s);
    assert.deepEqual(out.axes, [0.1, 0.2, 0.6, -0.7], `${id}: the right stick on 2 / 3`);
    assert.deepEqual(lit(out), [14], `${id}: the hat (axis 4) left`);
  }
});

test('8BitDo with analog triggers (Ultimate, Xbox letters): Accelerator / Brake from their rest, the digital ones too', () => {
  const make = () => raw('8BitDo Ultimate (Vendor: 2dc8 Product: 3011)', 15, 10, { hatAt: 9, rest: { 3: -1, 4: -1 } });
  const m = buttonMap(make);
  assert.deepEqual([m[0], m[1], m[3], m[4]], [[0], [1], [2], [3]], 'Xbox letters: raw 0 A bottom, 1 B right, 3 X left, 4 Y top');
  const s = padState(), p = make();
  remapPad(p, s);   // (seen at rest)
  p.axes[3] = 0.5; p.axes[4] = -0.6;
  const out = remapPad(p, s);
  assert.ok(Math.abs(out.buttons[7].value - 0.75) < 1e-9 && out.buttons[7].pressed, 'RT (Accelerator, axis 3): 0.75');
  assert.ok(Math.abs(out.buttons[6].value - 0.2) < 1e-9 && !out.buttons[6].pressed, 'LT (Brake, axis 4): 0.2');
  const cold = make(); cold.axes[3] = 0; cold.axes[4] = 0;
  assert.equal(remapPad(cold, padState()).buttons[7].value, 0, 'an axis never seen at rest (0 before the first report) is no squeeze');
});

test('DualSense on Firefox, DualShock 4 in Safari, Switch Pro and a USB SNES pad, raw', () => {
  const ds = () => raw('054c-0ce6-DualSense Wireless Controller', 15, 7, { hatAt: 6, rest: { 4: -1, 5: -1 } });
  const m = buttonMap(ds);
  assert.deepEqual([m[1], m[2], m[0], m[3], m[8], m[9], m[12]], [[0], [1], [2], [3], [8], [9], [16]], '× bottom, ○ right, □ left, △ top, Create, Options, PS');
  const s = padState(), p = ds(); remapPad(p, s); p.axes[5] = 1; p.axes[2] = 0.4; p.axes[3] = -0.4;
  const out = remapPad(p, s);
  assert.equal(out.buttons[7].value, 1, 'R2 analog (Ry)'); assert.deepEqual(out.axes.slice(2), [0.4, -0.4]);

  const ds4 = () => raw('Wireless Controller', 14, 7, { hatAt: 4, rest: { 5: -1, 6: -1 } });
  assert.deepEqual(buttonMap(ds4)[1], [0], 'DS4 by name: × (raw 1) is the bottom');

  const sw = () => raw('Pro Controller (Vendor: 057e Product: 2009)', 14, 10, { hatAt: 9 });
  const ms = buttonMap(sw);
  assert.deepEqual([ms[0], ms[1], ms[2], ms[3], ms[12], ms[13]], [[0], [1], [2], [3], [16], []], 'Switch Pro: already by position; Home 12, Capture nothing');
  const sp = sw(); sp.axes[3] = 0.5; sp.axes[4] = -0.5;
  assert.deepEqual(remapPad(sp, padState()).axes.slice(2), [0.5, -0.5], 'its right stick: Rx / Ry');

  const snes = () => raw('USB Gamepad (Vendor: 0810 Product: e501)', 10, 2);
  const mn = buttonMap(snes);
  assert.deepEqual([mn[2], mn[1], mn[3], mn[0], mn[8], mn[9]], [[0], [1], [2], [3], [8], [9]], 'B bottom, A right, Y left, X top, Select, Start');
  const sn = snes(); sn.axes = [-1, 1];
  assert.deepEqual(remapPad(sn, padState()).axes, [-1, 1, 0, 0], 'its D-pad walks as the left stick');
});

test('an unknown pad: read as standard, with a hat (once seen) as its D-pad', () => {
  const make = () => raw('Some Joystick (Vendor: 1234 Product: 5678)', 16, 10, { hatAt: 9 });
  const m = buttonMap(make);
  for (let i = 0; i < 12; i++) assert.deepEqual(m[i], [i]);
  assert.deepEqual(m[12], [], 'raw 12–15 are not the D-pad when there is a hat');
  const p = make(); p.axes[9] = HAT(4);
  assert.deepEqual(lit(remapPad(p, padState())), [13]);
  const firefox = () => raw('1234-5678-Joystick', 16, 4);   // no hat at all: 12–15 stay the D-pad
  assert.deepEqual(buttonMap(firefox)[13], [13]);
});

test('standard pads come out untouched, the very objects, and the list too', () => {
  const std = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, mapping: 'standard', connected: true, buttons: [], axes: [] };
  assert.equal(remapPad(std), std);
  const list = [std, null];
  const win = { navigator: { getGamepads: () => list } };
  installPadMaps(win);
  assert.equal(win.navigator.getGamepads(), list, 'nothing allocated when every pad is standard');
  installPadMaps(win);   // (once)
  let sn = SN30_CHROME();
  const odd = { navigator: { getGamepads: () => [std, sn] } };
  installPadMaps(odd);
  const [a, b] = odd.navigator.getGamepads();
  assert.equal(a, std);
  assert.equal(b.mapping, 'standard'); assert.equal(b.remap.profile, PROFILES['8bitdo']);
  assert.equal(odd.navigator.getGamepads()[1], b, 'the same frame (timestamp): the same remap');
  sn = press(SN30_CHROME(), 1); sn.timestamp = 2;
  assert.deepEqual(lit(odd.navigator.getGamepads()[1]), [0]);
});

test('the controller, on a raw SN30 Pro: the bottom button jumps, the hat\'s ↓ drinks a potion, LB guards', () => {
  let pad = SN30_CHROME(), t = 1;
  const win = { navigator: { getGamepads: () => [pad] } };
  installPadMaps(win);
  const actions = [];
  const c = new Controller({ pads: () => win.navigator.getGamepads(), context: () => 'game', action: (a) => actions.push(a), look: () => {}, navigate: () => {}, scroll: () => {} });
  const frame = (f) => { pad = SN30_CHROME(); pad.timestamp = ++t; f?.(pad); return c.update(1 / 60); };
  assert.ok(frame((p) => press(p, 1)).Space, 'raw 1 (printed B, the bottom one): jump');
  assert.ok(frame((p) => press(p, 0)).PadEvade, 'raw 0 (printed A, the right one): evade');
  assert.ok(frame((p) => press(p, 6)).PadGuard, 'raw 6 (L): guard');
  assert.ok(frame((p) => press(p, 7)).PadBlade, 'raw 7 (R): the blade');
  frame(); frame((p) => { p.axes[9] = HAT(4); }); frame();
  assert.deepEqual(actions, ['potion'], 'the hat\'s ↓: drink a potion');
});

test('the input display names each press from the bindings table', () => {
  for (const [key, what] of BINDINGS.foot) {
    const i = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→'].indexOf(key);
    if (i < 0) continue;
    assert.ok(actionLabel(i, 'game').endsWith(`→ ${what.split(' · ')[0]}`), `${key}: ${actionLabel(i, 'game')}`);
  }
  assert.equal(actionLabel(5, 'game'), 'RB / R1 → the fluid blade (again: the next swing)');
  assert.equal(actionLabel(1, 'menu'), `B / ○ → ${BINDINGS.menu.find(([b]) => b === 'B')[1]}`);
  assert.equal(actionLabel(0, 'ride'), `A / × → ${BINDINGS.ride.find(([b]) => b === 'A')[1].split(' · ')[0]}`);
  const rev = reverseSources(describeSources(PROFILES['8bitdo'], 'chrome', 9));
  assert.equal(pressLine('button 7', rev.get('button 7'), 'game'), 'button 7 → RB / R1 → the fluid blade (again: the next swing)');
  assert.equal(pressLine('button 5', rev.get('button 5') ?? [], 'game'), 'button 5 → not mapped');
  assert.deepEqual(rev.get('axis 9'), [12, 13, 14, 15]);
});
