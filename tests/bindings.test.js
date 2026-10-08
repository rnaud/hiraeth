// The controller's layout (src/bindings.js, docs/systems/controls.md "The layout"): one job per button per
// context, the controller doing what the table says, and every prompt in the game naming the new buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Controller } from '../src/controller.js';
import { BINDINGS, FREE, PAD } from '../src/bindings.js';

const IDX = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, View: 8, Menu: 9, L3: 10, R3: 11, '↑': 12, '↓': 13, '←': 14, '→': 15 };

function pad(context = 'game', faces = 'xbox') {
  const p = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = [];
  let ctx = context;
  const c = new Controller({ pads: () => [p], context: () => ctx, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {}, faces: () => ({ faces, byLabel: false }) });
  const set = (b, on) => { p.buttons[IDX[b]] = { pressed: on, value: on ? 1 : 0 }; };
  c.update(0.016);
  return {
    c, actions, p, set, ctx: (v) => { ctx = v; c.update(0.016); },
    /** Press (and hold for a frame) a button or a chord 'View + ↓'; what the controller held, and the actions after letting go. */
    press(name) {
      const parts = name.split(' + ');
      const before = actions.length;
      for (const b of parts) { set(b, true); }
      const held = { ...c.update(0.016) };
      for (const b of parts.reverse()) { set(b, false); c.update(0.016); }
      return { held, acts: actions.slice(before) };
    },
  };
}

// what a press shows up as: a held flag the game reads, or an action main.js runs
const FLAGS = ['Space', 'KeyE', 'PadEvade', 'PadGadget', 'PadBlade', 'PadGuard', 'PadAim', 'PadFire', 'PadGadgetPick', 'PadModeNext', 'PadModePrev', 'JumpOff', 'Throttle', 'Brake', 'Boost', 'KeyQ'];
const effects = ({ held, acts }) => [...FLAGS.filter((k) => held[k]), ...acts];

test('the table: no button does two things in one context, and the free chords are free', () => {
  for (const [ctx, rows] of Object.entries(BINDINGS)) {
    const seen = new Set();
    for (const [b, what] of rows) {
      assert.ok(!seen.has(b), `${ctx}: ${b} is bound twice`);
      seen.add(b);
      assert.ok(what && typeof what === 'string', `${ctx}: ${b} says what it does`);
    }
  }
  for (const f of FREE) assert.match(BINDINGS.foot.find(([b]) => b === f)?.[1] ?? '', /^free/, `${f} is listed as free`);
  // every verb's button names a real button in Xbox / PlayStation form
  for (const [verb, name] of Object.entries(PAD)) assert.match(name, /^(A \/ ×|B \/ ○|X \/ □|Y \/ △|[LR][BT] \/ [LR][12]|L3|R3|D-pad [↑↓←→ /]+|View|Menu|View \+ D-pad [↑↓←→])$/, verb);
});

test('on foot, each button does exactly what the table says, and only that', () => {
  const want = {
    A: ['Space'], B: ['PadEvade'], X: ['KeyE'], Y: ['PadGadget'], RB: ['PadBlade'], LB: ['PadGuard'], LT: ['PadAim'], RT: ['PadFire'],
    R3: ['lock'], '↑': ['PadGadgetPick'], '↓': ['call'], '←': ['PadModePrev'], '→': ['PadModeNext'], View: ['journal'], Menu: ['settings'],
    'View + ↑': ['photo'], 'View + ↓': ['viewDown'], 'View + ←': ['viewLeft'], 'View + →': ['viewRight'],
  };
  for (const [b] of BINDINGS.foot) {
    if (b === 'L3') continue;   // (below: it needs the stick)
    const t = pad('game');
    assert.deepEqual(effects(t.press(b)), want[b], `on foot: ${b}`);
  }
  const t = pad('game'); t.p.axes = [0, -1, 0, 0]; t.set('L3', true);
  assert.ok(t.c.update(0.016).ShiftLeft, 'L3 runs');
});

test('riding, each button does what the table says', () => {
  const want = { A: ['JumpOff'], B: ['KeyE'], X: ['Space'], RT: ['Throttle'], LT: ['Brake'], RB: ['Boost'], L3: ['Boost'], R3: ['lock'], View: ['journal'], Menu: ['settings'], 'View + ↑': ['photo'] };
  for (const [b] of BINDINGS.ride) {
    const t = pad('ride');
    assert.deepEqual(effects(t.press(b)), want[b], `riding: ${b}`);
  }
});

test('menus, talking and photo mode follow the table (Xbox faces; a Retroid swaps confirm and back)', () => {
  const menu = { A: 'confirm', B: 'back', LB: 'tabPrev', RB: 'tabNext', View: 'select', Menu: 'start' };
  for (const [b] of BINDINGS.menu) assert.deepEqual(pad('menu').press(b).acts, [menu[b]], `menu: ${b}`);
  const talk = { A: 'confirm', X: 'confirm', B: 'back', Menu: 'start' };
  for (const [b] of BINDINGS.talk) assert.deepEqual(pad('talk').press(b).acts, [talk[b]], `talk: ${b}`);
  const photo = { A: ['capture'], B: ['photo'], View: ['photo'], Menu: ['photo'] };
  for (const b of Object.keys(photo)) assert.deepEqual(pad('photo').press(b).acts, photo[b], `photo: ${b}`);
  assert.deepEqual(pad('menu', 'nintendo').press('B').acts, ['confirm'], 'a Retroid: printed A (right) confirms');
});

// ------------------------------------------------------------------ the prompts

function files(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(js|html)$/.test(f)) out.push(p);
  }
  return out;
}
const ROOT = new URL('..', import.meta.url).pathname;
// (the changelog keeps its old lines as they were released; the motion lab is a dev page with its own keys)
const SKIP = /src\/(changelog|changelog-media)\.js$|src\/motion\//;
const STALE = [
  [/\(E, or B \/ ○\)|E \(B \/ ○\)/, 'interact is X / □ now'],
  [/X \/ □[)\s,]*(evade|evades)\b|evades?\b[^.'"]{0,24}X \/ □/i, 'evade is B / ○ now'],
  [/Y \/ △[^.'"]{0,40}\b(pings?|scout)\b|\b(ping|scout)\b[^.'"]{0,30}Y \/ △/i, 'the scout is R3 (no foe near) now'],
  [/\bR3\b[^.'"]{0,30}\b(bell|shell|sound)|\b(bell|shell)\b[^.'"]{0,40}\bR3\b|RS \/ R3/i, 'the whistle is Y / △ with no gadget in hand now'],
  [/LT \/ L2 \+ X \/ □/, 'the mount is D-pad ↓ now'],
  [/[Ww]histle[^.'"]{0,40}\(X \/ □/, 'the mount is D-pad ↓ now'],
  [/D-pad (down|↓)[^.'"]{0,12}photo|photo[^.'"]{0,12}D-pad (down|↓)/i, 'photo mode is View + D-pad ↑ now'],
  [/LB \/ L1[^.'"]{0,12}swings/, 'the blade is RB / R1'],
  [/left mouse button[^.'"]{0,30}(thrust|jets|lift)|RT \/ R2 \(the left mouse button/i, 'the left mouse button is the blade now'],
];

test('every prompt names the buttons of the new layout', () => {
  const bad = [];
  for (const f of [...files(join(ROOT, 'src')), join(ROOT, 'index.html')]) {
    if (SKIP.test(f)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => { for (const [re, why] of STALE) if (re.test(line)) bad.push(`${f.slice(ROOT.length)}:${i + 1} ${why}: ${line.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(bad, []);
});

test('the Controls page names every verb\'s button, and the interact prompt is X / □', async () => {
  globalThis.matchMedia ??= () => ({ matches: false }); globalThis.window ??= new EventTarget();
  const { controlsList } = await import('../src/ui.js');
  const L = controlsList('A / ×', 'B / ○');
  const text = L.pad.map(([, how]) => how).join(' · ');
  for (const v of ['jump', 'evade', 'interact', 'gadget', 'blade', 'guard', 'aim', 'fire', 'run', 'lock', 'pick', 'call', 'mode', 'journal', 'menu']) assert.ok(text.includes(PAD[v]), `${v}: ${PAD[v]}`);
  assert.ok(L.pad.some(([what, how]) => /^Use, talk/.test(what) && how === 'X / □'));
  assert.ok(L.pad.some(([what, how]) => /^Evade/.test(what) && how === 'B / ○'));
  assert.ok(L.pad.some(([what, how]) => /^Call your mount/.test(what) && how === 'D-pad ↓'));
  const story = readFileSync(join(ROOT, 'src/story/index.js'), 'utf8');
  assert.match(story, /key: controller \? PAD\.interact : 'E'/);
});
