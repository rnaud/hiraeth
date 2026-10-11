// The Basic tier of the Game Accessibility Guidelines (docs/systems/ui.md "Accessibility", controls.md
// "Remapping", localisation.md): the player's own keys and buttons, hold or toggle, the motion setting, the
// language with English to fall back on, and the lock-on's states by shape as well as colour.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();

const { Controller } = await import('../src/controller.js');
const { KEYS, PAD_VERBS, PAD, BINDINGS, BUTTON_NAME } = await import('../src/bindings.js');
const remap = await import('../src/remap.js');
const { setControlPrefs, keyRoutes, keyConflicts, padConflicts, padMap, padRename, keyRename, keyLabel, normalisePrefs, installKeyRemap, captureKey } = remap;
const { promptText } = await import('../src/native-pad.js');
const i18n = await import('../src/i18n.js');
const { EN } = await import('../src/i18n/en.js');
const feel = await import('../src/feel.js');
const { reticleLook } = await import('../src/lock-reticle.js');

const IDX = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, View: 8, Menu: 9, L3: 10, R3: 11, '↑': 12, '↓': 13, '←': 14, '→': 15 };
function pad(prefs, context = 'game') {
  const p = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = [];
  const P = normalisePrefs(prefs);
  const c = new Controller({ pads: () => [p], context: () => context, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {}, prefs: () => P, padMap: () => padMap(P.pad) });
  const set = (b, on) => { p.buttons[IDX[b]] = { pressed: on, value: on ? 1 : 0 }; };
  c.update(0.016);
  return { c, p, set, actions, frame: () => ({ ...c.update(0.016) }) };
}

// ---------------------------------------------------------------- the defaults are the one table

test('the defaults: PAD is built from PAD_VERBS, which are the foot rows of the table; the keys conflict nowhere', () => {
  for (const [verb, b] of Object.entries(PAD_VERBS)) {
    assert.ok(BINDINGS.foot.some(([btn]) => btn === b), `${verb}: ${b} is on the foot table`);
    if (!verb.startsWith('mode')) assert.equal(PAD[verb], BUTTON_NAME[b]);
  }
  assert.equal(new Set(Object.values(PAD_VERBS)).size, Object.keys(PAD_VERBS).length, 'one verb a button');
  assert.equal(new Set(Object.values(KEYS)).size, Object.keys(KEYS).length, 'one verb a key');
  assert.equal(keyConflicts({}).size, 0);
  assert.equal(padConflicts({}).size, 0);
  assert.deepEqual(padMap({}), [...Array(16).keys()], 'no changes: every button is itself');
  assert.equal(keyRoutes({}).size, 0, 'no changes: every key goes on as it is');
});

// ---------------------------------------------------------------- the pad

test('a verb moved to another button: the controller reads it there, the old button does nothing, menus keep theirs', () => {
  const t = pad({ pad: { jump: 'Y' } });
  t.set('Y', true);
  assert.ok(t.frame().Space, 'Y jumps now');
  t.set('Y', false); t.frame();
  t.set('A', true);
  assert.ok(!t.frame().Space, 'A no longer jumps');
  // the whistle's own button (Y) is now the jump's, so the whistle is on no button: Y does both only when told to
  const both = pad({ pad: { jump: 'Y' } });
  both.set('Y', true);
  const h = both.frame();
  assert.ok(h.Space && h.PadWhistle, 'two verbs on one button: both');
  assert.deepEqual([...padConflicts({ jump: 'Y' })].sort(), ['jump', 'whistle']);
  // a swap: no conflict
  assert.equal(padConflicts({ jump: 'B', evade: 'A' }).size, 0);
  const sw = pad({ pad: { jump: 'B', evade: 'A' } });
  sw.set('B', true);
  const hs = sw.frame();
  assert.ok(hs.Space && !hs.PadEvade, 'B jumps');
  // menus: A still confirms
  const m = pad({ pad: { jump: 'B', evade: 'A' } }, 'menu');
  m.set('A', true); m.frame(); m.set('A', false); m.frame();
  assert.deepEqual(m.actions, ['confirm']);
  // riding follows the verbs: jump off is the jump's button
  const r = pad({ pad: { jump: 'B', evade: 'A' } }, 'ride');
  r.set('B', true);
  assert.ok(r.frame().JumpOff, 'B jumps off');
});

test('the D-pad moved under View is still View\'s layer (photo), and a trigger moved to a face keeps its analog throttle', () => {
  const t = pad({ pad: { pick: '→', potion: '↑' } });
  t.set('View', true); t.frame();
  t.set('↑', true);
  const h = t.frame();
  assert.ok(t.actions.includes('photo') && !t.actions.includes('potion') && !h.PadModeNext, 'View + ↑: photo, not the potion moved there');
  const f = pad({ pad: { fire: 'A', jump: 'RT' } });
  f.p.buttons[0] = { pressed: true, value: 1 };
  const hf = f.frame();
  assert.ok(hf.PadFire && hf.PadThrust === 1, 'A shoots and throttles');
});

test('run and guard: held, or toggled', () => {
  const hold = pad({ run: 'hold' });
  hold.p.axes = [0, -1, 0, 0];
  hold.set('L3', true); assert.ok(hold.frame().ShiftLeft);
  hold.set('L3', false); assert.ok(!hold.frame().ShiftLeft, 'hold: let go, walk');
  const tog = pad({ run: 'toggle' });
  tog.set('L3', true); assert.ok(tog.frame().ShiftLeft);
  tog.set('L3', false); assert.ok(tog.frame().ShiftLeft, 'toggle: still running, the stick at rest too');
  tog.set('L3', true); assert.ok(!tog.frame().ShiftLeft, 'pressed again: walk');
  const auto = pad({});
  auto.p.axes = [0, -1, 0, 0];
  auto.set('L3', true); auto.frame(); auto.set('L3', false);
  assert.ok(auto.frame().ShiftLeft, 'auto: runs on');
  auto.p.axes = [0, 0, 0, 0];
  assert.ok(!auto.frame().ShiftLeft, 'auto: the stick let go, it stops');
  const g = pad({ guard: 'toggle' });
  g.set('LB', true); assert.ok(g.frame().PadGuard);
  g.set('LB', false); assert.ok(g.frame().PadGuard, 'guard toggled: held up');
  g.set('LB', true); assert.ok(!g.frame().PadGuard, 'and down again');
  const gh = pad({});
  gh.set('LB', true); assert.ok(gh.frame().PadGuard);
  gh.set('LB', false); assert.ok(!gh.frame().PadGuard, 'hold: let go, down');
});

test('"press a button": the next new press is captured, nothing reaches the game', () => {
  const t = pad({});
  let got;
  remap.capturePad((b) => { got = b; });
  t.set('A', true);
  const h = t.frame();
  assert.equal(got, 'A');
  assert.ok(!h.Space, 'the press did not jump');
  t.set('A', true); assert.ok(!t.frame().Space, 'nor while it stays held');
  remap.capturePad((b) => { got = b; });
  t.set('A', false); t.frame();
  t.set('Menu', true); t.frame();
  assert.equal(got, null, 'Menu leaves it as it was');
});

// ---------------------------------------------------------------- the keyboard

test('keys moved: routes, swallowed defaults, conflicts, and what the keys are called', () => {
  const r = keyRoutes({ jump: 'KeyK' });
  assert.deepEqual(r.get('KeyK'), ['Space']);
  assert.deepEqual(r.get('Space'), [], 'Space no longer jumps');
  const c = keyRoutes({ jump: 'KeyE' });
  assert.deepEqual(c.get('KeyE').sort(), ['KeyE', 'Space'], 'on another verb\'s key: both');
  assert.deepEqual([...keyConflicts({ jump: 'KeyE' })].sort(), ['interact', 'jump']);
  const swap = keyRoutes({ interact: 'KeyF', blade: 'KeyE' });
  assert.deepEqual(swap.get('KeyF'), ['KeyE']); assert.deepEqual(swap.get('KeyE'), ['KeyF']);
  assert.equal(keyLabel('Space', null, false), 'SPACE');
  assert.equal(keyLabel('KeyQ', new Map([['KeyQ', 'a']])), 'A', 'an AZERTY: KeyQ is printed A');
  assert.deepEqual(normalisePrefs({ keys: { jump: 'Escape', nope: 'KeyK', run: 'ShiftLeft' } }).keys, {}, 'Esc is the menus\', unknown verbs and unchanged keys are dropped');
});

test('a pad layout from before PAD_SCHEME 4 (one job per button): brought up to date once, swaps kept, clashes back to the defaults', async () => {
  const { migratePad } = remap;
  // scheme 3 (v1.11's first build: the potion on ↓): a verb swapped onto ↓ goes to the potion's place now, ←
  assert.deepEqual(migratePad({ potion: 'LB', guard: '↓' }), { potion: 'LB', guard: '←' }, 'a swap stays a swap');
  assert.equal(padConflicts(migratePad({ potion: 'LB', guard: '↓' })).size, 0);
  assert.deepEqual(migratePad({ potion: 'R3', lock: '↓', jump: 'B', evade: 'A' }), { potion: 'R3', lock: '←', jump: 'B', evade: 'A' });
  assert.deepEqual(migratePad({ potion: '←' }), {}, 'the potion put on ← then: its default now');
  assert.deepEqual(migratePad({ jump: '→' }), {}, 'a verb on → (free then) would share the gun mode\'s button: back to its default');
  // schemes 1–2: the mount and the next gun mode where they were; the mode before is gone, its ← the potion's
  assert.deepEqual(migratePad({ call: 'LB', guard: '↓', modePrev: 'RB', blade: '←', modeNext: 'Y', gadget: '→' }), { call: 'LB', guard: '↓', modeNext: 'Y', whistle: '→' },
    'the swaps with the mount and the next mode kept; the blade on the mode before\'s ← would share the potion\'s: back to RB');
  assert.deepEqual(migratePad({ modePrev: 'LB', modeNext: 'RB', blade: '→', jump: 'B', evade: 'A' }), { modeNext: 'RB', blade: '→', jump: 'B', evade: 'A' }, 'modePrev dropped, the rest as chosen');
  for (const old of [{ potion: 'LB', guard: '↓' }, { call: 'LB', guard: '↓', modePrev: 'RB', blade: '←' }, { jump: '→', evade: '↓', potion: 'X', interact: '↓' }]) assert.equal(padConflicts(migratePad(old)).size, 0, JSON.stringify(old));
  const { migrateSettings } = await import('../src/ui.js');
  const m = migrateSettings({ hudV: 1, pad: { potion: 'LB', guard: '↓' } });
  assert.deepEqual(m.pad, { potion: 'LB', guard: '←' }, 'the saved settings, once');
  assert.equal(m.padV, 5);
  assert.deepEqual(migrateSettings({ hudV: 1, padV: 4, pad: { guard: '↓', call: 'LB' } }).pad, { guard: '↓', call: 'LB' }, 'saved since: as chosen');
  // scheme 4 (to v1.37): the top button's verb was the gadget in hand (or the whistle with none); it is the whistle now,
  // on the button chosen (using the gadget is RT's, 'fire')
  const s4 = migrateSettings({ hudV: 1, padV: 4, pad: { gadget: 'LB', guard: 'Y' } });
  assert.deepEqual(s4.pad, { whistle: 'LB', guard: 'Y' }, 'a swap of the top button stays a swap');
  assert.equal(s4.padV, 5);
  assert.equal(padConflicts(s4.pad).size, 0);
  assert.deepEqual(migratePad({ gadget: '↑', pick: 'Y' }, 4), { whistle: '↑', pick: 'Y' }, "not run through the old schemes' rules");
});

test('the key listener sends keys on as the verb\'s default key, toggles run, and hands one key to "press a key"', () => {
  const win = new EventTarget();
  win.KeyboardEvent = class extends Event { constructor(type, o = {}) { super(type, o); Object.assign(this, { code: o.code, key: o.key, repeat: !!o.repeat }); } };
  const key = (type, code, repeat = false) => { const e = new win.KeyboardEvent(type, { code, repeat, cancelable: true }); win.dispatchEvent(e); };
  installKeyRemap(win);
  const seen = [];
  win.addEventListener('keydown', (e) => seen.push(`down ${e.code}`));
  win.addEventListener('keyup', (e) => seen.push(`up ${e.code}`));
  setControlPrefs({ keys: { jump: 'KeyK' } });
  key('keydown', 'KeyK'); key('keyup', 'KeyK'); key('keydown', 'Space');
  assert.deepEqual(seen, ['down Space', 'up Space'], 'K jumps, Space does nothing');
  seen.length = 0;
  setControlPrefs({ run: 'toggle' });
  key('keydown', 'ShiftLeft'); key('keyup', 'ShiftLeft'); key('keydown', 'ShiftLeft'); key('keyup', 'ShiftLeft');
  assert.deepEqual(seen, ['down ShiftLeft', 'up ShiftLeft'], 'toggle: the first press holds it down, the second lets it go');
  seen.length = 0;
  let got;
  captureKey((c) => { got = c; });
  key('keydown', 'KeyL'); key('keyup', 'KeyL');
  assert.equal(got, 'KeyL'); assert.deepEqual(seen, [], 'the game saw nothing');
  setControlPrefs({});
});

// ---------------------------------------------------------------- the prompts

test('the prompts name the buttons and keys now bound, the menus\' own ones stay', () => {
  setControlPrefs({ pad: { jump: 'B', evade: 'A' } });
  assert.equal(padRename('A / × jump · B / ○ evade'), 'B / ○ jump · A / × evade', 'a swap renames both, once');
  assert.equal(promptText('A / × jump', { layout: 'standard', faces: 'xbox' }), 'B jump');
  assert.equal(promptText('A / × confirm', { layout: 'standard', faces: 'xbox', remap: false }), 'A confirm', '.pad-raw: not renamed (one half all the same)');
  assert.equal(promptText('A / × jump', { layout: 'android', faces: 'nintendo' }), 'A jump', 'then the handheld\'s letters (B / ○ is printed A on a Retroid)');
  setControlPrefs({ pad: { potion: 'LB', guard: '←' } });
  assert.equal(padRename('D-pad ← drink · LB / L1 guard · D-pad → gun mode'), 'LB / L1 drink · D-pad ← guard · D-pad → gun mode');
  setControlPrefs({ keys: { interact: 'KeyF', blade: 'KeyE' } });
  assert.equal(keyRename().get('E'), 'F');
  assert.equal(promptText('E', { layout: 'standard', faces: 'xbox', key: true }), 'F', 'a key badge');
  assert.equal(promptText('E go aboard', { layout: 'standard', faces: 'xbox' }), 'E go aboard', 'plain words are not keys');
  setControlPrefs({});
  assert.equal(padRename('A / × jump'), 'A / × jump', 'no changes: as written');
});

test('the Controls page lists every verb with its key or button, marks clashes in words, and has a reset', async () => {
  const { rebindHtml, REBIND_PAD, REBIND_KEYS } = await import('../src/ui.js');
  assert.deepEqual([...REBIND_PAD].sort(), Object.keys(PAD_VERBS).sort(), 'every pad verb');
  assert.deepEqual([...REBIND_KEYS].sort(), Object.keys(KEYS).sort(), 'every key verb');
  const html = rebindHtml('pad', normalisePrefs({ pad: { jump: 'Y' } }));
  assert.match(html, /data-rebind="pad" data-verb="jump"[^>]*>Y \/ △</);
  assert.match(html, /class="clash moved"/);
  assert.match(html, /⚠ also Whistle, echo shell/);
  assert.match(html, /data-a="rebind-reset" data-kind="pad"/);
  assert.match(html, /class="rebind pad-raw"/, 'its names are the bound ones already');
  assert.match(rebindHtml('keys', normalisePrefs({})), /data-verb="jump"[^>]*>SPACE</);
});

test('the settings keep the controls and the accessibility choices', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const { Settings } = await import('../src/ui.js');
    const s = new Settings();
    s.set('pad', { jump: 'B', evade: 'A' });
    s.set('keys', { jump: 'KeyK' });
    s.set('run', 'toggle');
    s.set('textSize', 'large');
    const saved = JSON.parse(store.get('moebius.settings.v1'));
    assert.deepEqual(saved.pad, { jump: 'B', evade: 'A' });
    assert.deepEqual(saved.keys, { jump: 'KeyK' });
    assert.equal(saved.run, 'toggle'); assert.equal(saved.textSize, 'large');
    const again = new Settings();
    assert.deepEqual(remap.controlPrefs(), { keys: { jump: 'KeyK' }, pad: { jump: 'B', evade: 'A' }, run: 'toggle', guard: 'hold' }, 'loaded: in force');
    assert.equal(again.reduceMotion, null, 'reduced motion: as the system asks until chosen');
    again.set('keys', {}); again.set('pad', {}); again.set('run', 'auto');
  } finally { delete globalThis.localStorage; setControlPrefs({}); }
});

// ---------------------------------------------------------------- motion

test('reduce motion: no hit-stop, no slow motion, no kick; camera shake scales the kick', async () => {
  const { reducedMotion } = await import('../src/ui.js');
  feel.resetFeel();
  feel.setMotion({ reduce: true, shake: 1 });
  feel.hitStop(0.1); feel.slowMo(0.4); feel.kick(0.5);
  const st = feel.feelState();
  assert.equal(st.stop, 0); assert.equal(st.slow, 0); assert.equal(st.shake, 0);
  assert.equal(feel.feelDt(0.016), 0.016, 'the world runs on');
  assert.equal(feel.shakeScale(), 0, 'the ship\'s scenes do not shake');
  feel.setMotion({ reduce: false, shake: 0.5 });
  feel.kick(0.4);
  assert.ok(Math.abs(feel.feelState().shake - 0.2) < 1e-9, 'half the kick');
  feel.hitStop(0.05);
  assert.ok(feel.feelDt(0.016) < 0.001, 'full motion: the frame freezes');
  feel.setMotion({ reduce: false, shake: 1 }); feel.resetFeel();
  const sys = (on) => ({ matchMedia: () => ({ matches: on }) });
  assert.equal(reducedMotion({ reduceMotion: null }, sys(true)), true, 'not chosen: prefers-reduced-motion');
  assert.equal(reducedMotion({ reduceMotion: false }, sys(true)), false, 'chosen: the choice');
  assert.equal(reducedMotion({ reduceMotion: true }, sys(false)), true);
});

// ---------------------------------------------------------------- the language

test('i18n: the language\'s words, English where it lacks them, the key where English does; French has every key', () => {
  i18n.setLanguage('fr');
  assert.equal(i18n.t('menu.resume'), 'Reprendre');
  assert.equal(i18n.t('title.deleteAsk', { n: 2 }), 'Supprimer la sauvegarde 2 ?');
  i18n.LANGUAGES.fr.table.__probe = undefined;
  EN['test.only'] = 'only in English';
  assert.equal(i18n.t('test.only'), 'only in English', 'missing in French: English');
  delete EN['test.only'];
  assert.equal(i18n.t('no.such.key'), 'no.such.key', 'missing everywhere: the key');
  assert.deepEqual(i18n.missing('fr'), [], 'the French table is complete');
  for (const [k, v] of Object.entries(i18n.LANGUAGES.fr.table)) {
    if (typeof v !== 'string') continue;
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    assert.equal(vars(v), vars(EN[k]), `${k}: the same {names}`);
  }
  i18n.setLanguage('xx');
  assert.equal(i18n.language(), 'en', 'an unknown language: English');
  assert.equal(i18n.t('menu.resume'), 'Resume');
});

test('the Controls page and the HUD speak the language', async () => {
  const { controlsList } = await import('../src/ui.js');
  const { cueText } = await import('../src/hud.js');
  i18n.setLanguage('fr');
  try {
    const L = controlsList('A / ×', 'B / ○');
    assert.ok(L.pad.some(([what, how]) => what.startsWith('Utiliser, parler') && how === 'X / □'));
    assert.ok(L.keyboard.some(([what, how]) => what.startsWith('Se déplacer') && how === 'WASD · MAJ'), 'the keys in French words');
    assert.equal(cueText({ prompt: 'tourner la lentille', controller: true, words: true }), 'X / □ tourner la lentille', 'hints full: the words too');
    assert.equal(cueText({ ride: 'bike', rideFor: 0, controller: true }), '', 'no button hints getting on a vehicle');
  } finally { i18n.setLanguage('en'); }
});

// ---------------------------------------------------------------- not by colour alone

test('the lock-on says nothing by colour: one look (four gold arrows), only dimmed out of the blade\'s reach', () => {
  // (v1.42: the author asked for Ocarina of Time's arrows with no red for an attack; a foe's wind-up is told by its body)
  for (const f of [{}, { state: 'wind', k: 0.5 }, { state: 'strike' }, { stunned: 1 }]) assert.equal(reticleLook({ hp: 3, def: { hp: 3 }, ...f }).mode, 'calm');
  assert.equal(reticleLook({ buried: true }).mode, 'veiled');
});
