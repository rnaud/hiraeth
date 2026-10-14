// The engines' menus (engine/menus.js): the title, the Start menu and the game menu as plain state, moved through as
// the web's are (src/title.js, src/ui.js SettingsMenu, src/game-menu.js), for the Unity bridge to draw (BridgeMenu.cs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus, SETTINGS_ROWS, START_SIDE, nextInto, settingStep, settingText } = await import('../engine/menus.js');
const { SlotStore, DEBUG_SLOT } = await import('../src/save-slots.js');
const { ORDER } = await import('../src/levels/names.js');
const { PANELS } = await import('../src/game-menu.js');

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** A store over memory, with save n played (a world, a little playtime). */
function memStore(played = []) {
  const m = new Map();
  const ls = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const s = new SlotStore(ls);
  for (const [n, level] of played) { s.view(n).setItem('hiraeth.save.v1', JSON.stringify({ level, pos: [0, 0, 0] })); s.touch(n, { addSeconds: 600 }); }
  return s;
}
function settingsStub() {
  const s = { music: 0.8, effects: 1, voices: 0.8, mute: false, sensitivity: 1, invertY: false, hints: 'subtle', quality: 'handheld', set(k, v) { this[k] = v; } };
  return s;
}

test('the title with no save: New game first, then Saves and Settings; New game starts the first empty slot', () => {
  let chose = null;
  const m = new EngineMenus({ store: memStore(), settings: settingsStub(), onStart: (c) => (chose = c) });
  m.show('title');
  const v = m.view();
  assert.equal(v.kind, 'title');
  assert.equal(v.logo, 'HIRAETH');
  assert.deepEqual(v.rows.map((r) => r.text), ['New game', 'Saves', 'Settings']);
  assert.ok(v.rows[0].on && v.rows[0].primary);
  m.action('confirm');
  assert.deepEqual(chose, { slot: 1, fresh: true });
  assert.ok(m.view().starting, 'the title stays up, saying it starts, while the world loads');
  m.action('confirm');
  assert.deepEqual(chose, { slot: 1, fresh: true }, 'a second press does nothing while it starts');
});

test('the title with a save: Continue (its world), up and down wrap round the entries', () => {
  let chose = null;
  const m = new EngineMenus({ store: memStore([[2, 'incal']]), settings: settingsStub(), onStart: (c) => (chose = c) });
  m.show('title');
  const v = m.view();
  assert.equal(v.rows[0].text, 'Continue');
  assert.ok(v.rows[0].sub, 'the world under it');
  m.navigate(0, -1);
  assert.ok(m.view().rows[2].on, 'up from the first: the last');
  m.navigate(0, 1);
  m.action('confirm');
  assert.deepEqual(chose, { slot: 2, fresh: false });
});

test('Saves: Back, the three slots, the folded Debug row; X deletes a save once asked; Debug opens the worlds', () => {
  let chose = null;
  const store = memStore([[1, 'desert']]);
  const m = new EngineMenus({ store, settings: settingsStub(), onStart: (c) => (chose = c) });
  m.show('title');
  m.navigate(0, 1); m.action('confirm');   // Saves
  let v = m.view();
  assert.equal(v.screen, 'saves');
  assert.deepEqual(v.rows.map((r) => r.text), ['Back', 'Save 1', 'Save 2', 'Save 3', 'Debug']);
  assert.ok(v.rows[1].on, 'on the first save');
  assert.match(v.hint, /X \/ □ delete/);
  assert.equal(v.rows[4].fold, 'shut', 'the debug saves folded shut (issue #227): the worlds not in the pad\'s path');
  m.action('x');
  assert.match(m.view().ask.q, /Delete Save 1/);
  assert.equal(m.view().ask.on, 0, 'Keep it picked first');
  m.action('confirm');
  assert.equal(store.summary(1).empty, false, 'Keep it: nothing deleted');
  m.action('x'); m.navigate(1, 0); m.action('confirm');
  assert.equal(store.summary(1).empty, true, 'Delete: gone');
  // Debug: opened, the slot it writes, every world of the route
  for (let i = 0; i < 3; i++) m.navigate(0, 1);
  m.action('confirm');
  v = m.view();
  assert.equal(v.rows[4].fold, 'open');
  assert.equal(v.rows.length, 5 + 1 + ORDER.length);
  assert.match(v.rows[5].text, /debug save/);
  m.navigate(0, 1); m.action('confirm');
  assert.match(m.view().rows[5].text, /Save 1/, 'A / × on Into: the next slot (the debug slot, then 1..3)');
  m.navigate(0, 1); m.navigate(0, 1);   // the second world
  m.action('confirm');
  assert.deepEqual(chose, { debug: ORDER[1], slot: 1 }, 'an empty slot is written without asking');
  assert.equal(nextInto(DEBUG_SLOT), 1);
  assert.equal(nextInto(3), DEBUG_SLOT);
});

test('a debug save into a slot that holds a save asks first', () => {
  let chose = null;
  const m = new EngineMenus({ store: memStore([[1, 'desert']]), settings: settingsStub(), onStart: (c) => (chose = c) });
  m.show('title');
  m.navigate(0, 1); m.action('confirm');
  for (let i = 0; i < 3; i++) m.navigate(0, 1);
  m.action('confirm');                       // Debug open
  m.navigate(0, 1); m.action('confirm');     // Into: Save 1
  m.navigate(0, 1); m.action('confirm');     // the first world
  assert.equal(chose, null);
  assert.match(m.view().ask.q, /Replace Save 1/);
  m.navigate(1, 0); m.action('confirm');
  assert.deepEqual(chose, { debug: ORDER[0], slot: 1 });
});

test('the settings: a slider steps with left / right, a switch flips with A / ×, a choice goes round', () => {
  const s = settingsStub();
  const changed = [];
  const m = new EngineMenus({ store: memStore(), settings: s, onSetting: (k, v) => changed.push([k, v]) });
  m.show('title');
  m.navigate(0, 1); m.navigate(0, 1); m.action('confirm');   // Settings
  let v = m.view();
  assert.equal(v.screen, 'settings');
  assert.deepEqual(v.page.rows.map((r) => r.text), SETTINGS_ROWS.map((r) => r.label()));
  m.navigate(-1, 0);
  assert.equal(s.music, 0.75);
  assert.equal(m.view().page.rows[0].val, '75 %');
  m.navigate(0, 1); m.navigate(0, 1); m.navigate(0, 1);   // Mute
  m.action('confirm');
  assert.equal(s.mute, true);
  assert.deepEqual(changed.at(-1), ['mute', true]);
  m.action('back');
  assert.equal(m.view().screen, 'main');
  assert.equal(settingStep(SETTINGS_ROWS[0], 1, 1), 1, 'clamped');
  assert.equal(settingStep(SETTINGS_ROWS.find((r) => r.k === 'hints'), 'full', 1), 'off', 'round');
  assert.equal(settingText(SETTINGS_ROWS.find((r) => r.k === 'sensitivity'), 1.25), '1.25×');
});

test('the Start menu: the sidebar and its page, as issue #210 has it; B in the page goes back to the sidebar first', () => {
  let resumed = 0, quit = 0;
  const s = settingsStub();
  const m = new EngineMenus({ store: memStore(), settings: s, onResume: () => resumed++, onQuit: () => quit++, where: () => 'The Desert' });
  m.show('start');
  let v = m.view();
  assert.equal(v.kind, 'start');
  assert.equal(v.head, 'The Desert');
  assert.deepEqual(v.side.map((e) => e.text), START_SIDE.map((e) => e.label()));
  assert.ok(v.side[0].on, 'on Resume');
  m.navigate(0, -1);
  assert.ok(m.view().side.at(-1).on, 'up from Resume: Quit to title (the sidebar wraps)');
  m.navigate(1, 0);
  assert.equal(m.view().page.rows[0].on, true, 'right: into the page');
  m.navigate(1, 0);
  assert.equal(s.music, 0.85, 'a slider\'s right is its value');
  m.action('back');
  v = m.view();
  assert.ok(v.side.find((e) => e.text === 'Settings').on, 'B: back to the page\'s entry on the sidebar');
  assert.equal(resumed, 0);
  m.action('back');
  assert.equal(m.mode, null, 'B on the sidebar: resumed');
  assert.equal(resumed, 1);
  // Items, Quests and Map open the game menu there; Quit to title
  m.show('start');
  m.navigate(0, 1); m.action('confirm');
  assert.equal(m.mode, 'game');
  assert.equal(m.view().panel, 'items');
  m.show('start');
  m.navigate(0, -1); m.action('confirm');
  assert.equal(quit, 1);
  // Controls: the pad's list
  m.show('start');
  for (let i = 0; i < 5; i++) m.navigate(0, 1);
  m.action('confirm');
  v = m.view();
  assert.equal(v.page.title, 'Your buttons (controller)');
  assert.ok(v.page.rows.filter((r) => r.plain && !r.head).length > 5, 'every control under the rebinding');
});

test('the Controls page rebinds the pad as the web\'s does (issue #264): a verb, the next press, the clash marked, Menu keeps it, the reset', async () => {
  const { padCaptured, capturingPad, controlPrefs } = await import('../src/remap.js');
  const { PAD_BUTTONS } = await import('../src/bindings.js');
  const { applyAccess } = await import('../src/ui.js');
  const s = settingsStub();
  s.pad = {}; s.run = 'auto'; s.guard = 'hold';
  s.set = function (k, v) { this[k] = v; applyAccess(this, null); };
  const m = new EngineMenus({ store: memStore(), settings: s });
  m.show('start');
  for (let i = START_SIDE.findIndex((e) => e.id === 'controls'); i > 0; i--) m.navigate(0, 1);
  m.action('confirm');
  let v = m.view();
  assert.equal(v.page.rows[0].text, 'Jump');
  assert.equal(v.page.rows[0].val, 'A / ×');
  assert.ok(v.page.rows[0].on, 'in the page, on its first verb');
  // A / × on Jump: waiting for a button; B / ○ pressed: jump is on B now, and evade (B's) shares it
  m.action('confirm');
  assert.ok(capturingPad());
  assert.equal(m.view().page.rows[0].val, 'press a button…');
  padCaptured(PAD_BUTTONS.indexOf('B'));
  assert.equal(s.pad.jump, 'B');
  assert.equal(controlPrefs().pad.jump, 'B', 'the controller reads through it (src/remap.js padMap)');
  v = m.view();
  assert.match(v.page.rows[0].val, /⚠ B \/ ○/);
  assert.match(v.page.rows[0].note, /Evade/);
  // Menu keeps it as it was
  m.action('confirm'); padCaptured(PAD_BUTTONS.indexOf('Menu'));
  assert.equal(s.pad.jump, 'B');
  // run and guard: held or toggled, left / right or A / ×
  const runAt = v.page.rows.findIndex((r) => r.control === 'run');
  for (let i = 0; i < runAt; i++) m.navigate(0, 1);
  m.navigate(1, 0);
  assert.equal(s.run, 'hold');
  // the reset: every verb on its own button again
  m.navigate(0, 1); m.navigate(0, 1); m.action('confirm');
  assert.deepEqual(s.pad, {});
  // a rebinding left waiting keeps the button after 8 s
  for (let i = 0; i < runAt + 2; i++) m.navigate(0, -1);
  m.action('confirm');
  assert.ok(m.rebinding);
  m.rebinding.until = Date.now() - 1; m.tick();
  assert.equal(m.rebinding, null);
  assert.ok(!capturingPad());
});

test('What\'s new in the Start menu (issue #264): the newest versions\' lines, newest first, as the changelog panel lists them', async () => {
  const { CHANGELOG, lineText, newestFirst } = await import('../src/changelog.js');
  const m = new EngineMenus({ store: memStore(), settings: settingsStub() });
  m.show('start');
  for (let i = START_SIDE.findIndex((e) => e.id === 'news'); i > 0; i--) m.navigate(0, 1);
  m.action('confirm');
  const v = m.view();
  assert.match(v.page.title, new RegExp(`v${CHANGELOG[0].v.replace('.', '\\.')}`));
  assert.equal(v.page.rows[0].text, `v${CHANGELOG[0].v}`);
  assert.ok(v.page.rows[0].head);
  assert.equal(v.page.rows[1].text, lineText(newestFirst(CHANGELOG[0])[0]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  assert.ok(v.page.rows.filter((r) => r.head).length >= 2);
  m.navigate(0, 1);
  assert.ok(m.view().page.rows[1].on, 'down: the next line (the page scrolls with it)');
});

/** Sources for the game menu as menuSources gives them, small. */
function sources(tracked = []) {
  const people = [{ id: 'ama', name: 'Ama', role: 'a weaver' }, { id: 'bo', name: 'Bo', role: 'a guard' }];
  return {
    quests: () => ({ charge: { title: 'The charge', goal: 'Go', step: 'Walk', worlds: '0 of 9' }, active: [{ id: 'q1', title: 'Water', goal: 'Find water', step: 'Look', main: true, tracked: false }, { id: 'q2', title: 'Sand', goal: 'Sweep', step: 'Sweep', tracked: true }], errands: [], done: [{ id: 'q0', title: 'Wake', outro: 'You woke.' }], failed: [] }),
    items: () => ({ gear: [{ id: 'backpack', name: 'Backpack', kind: 'core', text: 'It shoots.', usable: false }, { id: 'stun', name: 'Stun', kind: 'mode', text: 'It stuns.', usable: true }], slots: 14, pack: [{ id: 'pack.0', name: 'A jar' }], keepsakes: [{ id: 'k1', name: 'A shell', text: 'From the sea', world: 'The Desert' }], chimes: 3 }),
    worlds: () => [{ id: 'desert', n: 1, title: 'The Desert', current: true, told: false, relics: [0, 3], boxes: [1, 4], blurb: 'Sand.', relicList: [], people: ['Ama'], travel: false }, { id: 'incal', n: 2, title: 'City-Shaft', current: false, told: true, relics: [3, 3], boxes: null, blurb: 'A shaft.', relicList: [], people: [], travel: true }],
    people: (open) => ({ groups: [{ world: 'desert', title: 'The Desert', people }], person: open ? { ...people.find((p) => p.id === open), story: ['She weaves.'], now: 'At home', talks: 2, quests: [], things: [], prevId: null, prev: null, nextId: 'bo', next: 'Bo' } : null }),
    map: ({ zoom } = {}) => ({ world: 'The Desert', marks: [{ id: 'you', kind: 'you', name: 'You', sub: '', u: 0.5, v: 0.5, deg: 90, on: true }, { id: 'ship', kind: 'ship', name: 'Your ship', sub: '40 m', u: 0.6, v: 0.4, on: true }], zoom: zoom ?? null }),
  };
}

test('the game menu: opens on Quests at the tracked quest, LB / RB turn the five panels, the strip says the cell', () => {
  const tracked = [];
  const m = new EngineMenus({ store: memStore(), sources: sources(), onTrack: (id) => tracked.push(id) });
  m.show('game');
  let v = m.view();
  assert.equal(v.kind, 'game');
  assert.equal(v.panel, 'quests');
  assert.deepEqual(v.tabs.names, PANELS.map((p) => p.name));
  assert.ok(v.rows[2][0].on, 'the cursor on the tracked quest (questsPanel start)');
  assert.equal(v.strip.name, 'Sand');
  m.navigate(0, -1);
  assert.equal(m.view().strip.name, 'Water');
  assert.match(m.view().strip.act, /track/i);
  m.action('confirm');
  assert.deepEqual(tracked, ['q1']);
  m.action('tabNext');
  assert.equal(m.view().panel, 'map');
  assert.equal(m.view().map.marks.length, 2);
  m.action('tabPrev'); m.action('tabPrev');
  assert.equal(m.view().panel, 'people', 'round: Quests ← People');
  m.action('back');
  assert.equal(m.mode, null);
});

test('the game menu: a row\'s end rests on the side tab, once more turns; A / × opens a thing full screen, B back', () => {
  let used = null;
  const m = new EngineMenus({ store: memStore(), sources: sources(), onUse: (id) => (used = id) });
  m.show('game', 'items');
  let v = m.view();
  assert.equal(v.panel, 'items');
  assert.equal(v.slots, 14);
  m.navigate(-1, 0);
  assert.equal(m.view().tabs.edge, -1, 'on the left tab');
  m.navigate(-1, 0);
  assert.equal(m.view().panel, 'map', 'turned to the panel before');
  m.action('tabNext');
  m.navigate(1, 0);   // the Stun
  m.action('confirm');
  v = m.view();
  assert.equal(v.full.title, 'Stun');
  assert.equal(v.full.use, 'Use this mode');
  assert.equal(v.full.prev, 'Backpack');
  m.action('confirm');
  assert.equal(used, 'stun');
  m.navigate(-1, 0);
  assert.equal(m.view().full.title, 'Backpack', '← the one before');
  m.action('back');
  assert.equal(m.view().full, undefined);
  assert.equal(m.mode, 'game');
  // the pack and the keepsakes: a line each, side by side under the gear
  m.navigate(0, 1);
  v = m.view();
  // (after the gear's row and the slots still to find, drawn but never the cursor's)
  const carry = v.rows.find((r) => r[0]?.kind === 'pack');
  assert.equal(carry.length, 2);
  assert.ok(carry[0].span > 1);
  assert.ok(carry[0].on, 'down from the gear: the pack, past the empty slots');
});

test('the game menu: Worlds full view travels (or says why not); People opens a person, B back to the cards', () => {
  const asked = [];
  const m = new EngineMenus({ store: memStore(), sources: sources(), onTravel: (id) => { asked.push(id); return id === 'incal' ? null : 'You are here.'; } });
  m.show('game', 'worlds');
  m.action('confirm');
  let v = m.view();
  assert.equal(v.full.title, 'The Desert');
  assert.ok(v.full.facts.length >= 2);
  assert.equal(v.full.use, '', 'no Travel here where you are');
  m.navigate(1, 0);
  assert.equal(m.view().full.use, 'Travel here');
  m.action('confirm');
  assert.deepEqual(asked, ['incal']);
  assert.equal(m.mode, null, 'the menu closes as the ship goes');
  m.show('game', 'people');
  m.action('confirm');
  v = m.view();
  assert.equal(v.person.name, 'Ama');
  assert.equal(v.person.next, 'Bo');
  m.navigate(1, 0);
  assert.equal(m.view().person.name, 'Bo');
  m.action('back');
  assert.equal(m.view().person, undefined);
  assert.ok(m.view().rows[0][1].on, 'back on Bo\'s card');
});

test('keys: arrows move, Enter chooses, Esc goes back, Q / E turn, J closes the game menu', () => {
  const m = new EngineMenus({ store: memStore(), sources: sources() });
  assert.equal(m.key('Enter'), false, 'nothing open: not the menus\'');
  m.show('game');
  assert.equal(m.key('KeyE'), true);
  assert.equal(m.view().panel, 'map');
  m.key('KeyQ');
  assert.equal(m.view().panel, 'quests');
  m.key('ArrowUp');
  assert.equal(m.view().strip.name, 'Water');
  m.key('KeyJ');
  assert.equal(m.mode, null);
});

test('the Unity bridge draws the menus and feeds them the pad and the keys', () => {
  const g = src('engine/unity/game.js');
  assert.match(g, /new EngineMenus\(/);
  assert.match(g, /host\.Menu\?\.\(/, 'the menu\'s state to Unity when it changes');
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs'), /public static void Menu\(string json\)/);
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs'), /class BridgeMenu : MonoBehaviour/);
  const eg = src('engine/game.js');
  assert.match(eg, /context: \(\) => \(menus\?\.open \? 'menu'/, 'the controller in its menu context while a menu is open');
});

test('the pad\'s printed letters in an engine (issue #264): the Retroid\'s own names and Nintendo letters, the Xbox\'s, the Deck\'s', async () => {
  const { setEnginePad, setFaces, padLabels, padFaces, promptText } = await import('../src/native-pad.js');
  const { menuKeys } = await import('../engine/menus.js');
  const { Controller } = await import('../src/controller.js');
  const ids = [];
  const win = globalThis.window;
  win.navigator = { getGamepads: () => ids.map((id) => ({ id })) };
  win.location ??= { search: '' };
  const say = (text, remap = false) => promptText(text, { ...padLabels(), remap });
  try {
    // the Unity player on Android, the Retroid's pad: its letters Nintendo-style (A on the right), reported by letter
    ids.push('Retroid Pocket Controller');
    setEnginePad({ layout: 'android', family: '' });
    assert.deepEqual(padLabels(), { layout: 'android', faces: 'nintendo', family: 'handheld' });
    assert.equal(padFaces().byLabel, true, 'Unity\'s buttonSouth is the printed A: moved to its place (the right)');
    assert.equal(say('A / × jump · RT / R2 shoot · LB / RB turn · View gear'), 'B jump · R2 shoot · L1/R1 turn · Select gear', 'jump is the bottom button, printed B');
    assert.equal(say(menuKeys('A / × choose · B / ○ back')), 'A choose · B back', 'the menus confirm with the printed A, as the web\'s');
    // and the controller: the printed A (index 0) confirms in a menu, the bottom one (printed B, index 1) goes back
    let acted = null;
    const press = (i) => [{ id: ids[0], index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, (_, k) => ({ pressed: k === i, value: k === i ? 1 : 0 })), axes: [0, 0, 0, 0] }];
    let pads = press(0);
    const c = new Controller({ pads: () => pads, context: () => 'menu', action: (n) => { acted = n; }, navigate() {}, look() {}, scroll() {}, faces: () => padFaces() });
    c.update(1 / 60); assert.equal(acted, 'confirm');
    pads = press(-1); c.update(1 / 60); acted = null; pads = press(1); c.update(1 / 60); assert.equal(acted, 'back');
    // the Retroid set to its own "Xbox style": reported by position, Nintendo letters printed
    setFaces('nintendo-xbox');
    assert.equal(padFaces().byLabel, false);
    setFaces('auto');
    // an Xbox pad on the same handheld: Xbox letters, by position
    ids[0] = 'Xbox Wireless Controller'; setEnginePad({ layout: 'android', family: '' });
    assert.deepEqual(padFaces(), { faces: 'xbox', byLabel: false });
    // the Xbox: Xbox names, one half of each pair
    ids[0] = 'unity pad'; setEnginePad({ layout: 'standard', family: 'xbox' });
    assert.equal(say(menuKeys('A / × choose · B / ○ back · LB / RB turn')), 'A choose · B back · LB/RB turn');
    // the Deck's player: Steam's pad, drawn as an Xbox pad
    ids[0] = 'Valve Software Steam Virtual Gamepad'; setEnginePad({ layout: 'standard', family: '' });
    assert.equal(padLabels().family, 'xbox');
    assert.equal(say('A / × jump · RT / R2 shoot'), 'A jump · RT shoot');
    // a DualSense on a computer: its own symbols
    ids[0] = 'DualSense Wireless Controller'; setEnginePad({ layout: 'standard', family: '' });
    assert.equal(say('A / × jump · RT / R2 shoot'), '× jump · R2 shoot');
  } finally { setEnginePad(null); delete win.navigator; }
  // the bridge says its platform and the pad's name (BridgeHost.Platform, PadName), and the menus' keys go to BridgeMenu
  const host = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  assert.match(host, /public static string PadName\(\)/);
  assert.match(host, /public static string Platform\(\)/);
  assert.match(src('engine/unity/game.js'), /setEnginePad\(/);
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs'), /Key\("ok", "A"\)/);
});

test('the Items panel in an engine: as many tiles a row as fit, each with its picture, the slots to find drawn after them (issue #264)', async () => {
  const { existsSync } = await import('node:fs');
  const gear = ['backpack', 'stun', 'fire', 'bloom', 'bell', 'echo', 'glider', 'lamp', 'magnet', 'coil'].map((id, i) => ({ id, name: id, kind: i ? 'mode' : 'core', text: '', usable: false }));
  const s = sources();
  s.items = () => ({ gear, slots: 14, pack: [{ id: 'pack.0', name: 'A jar' }], keepsakes: [{ id: 'k1', name: 'A shell', text: '', world: 'The Desert' }], chimes: 3 });
  const m = new EngineMenus({ store: memStore(), sources: s, itemCols: () => 7 });
  m.show('game', 'items');
  const v = m.view();
  assert.equal(v.cols.length, 7, 'seven columns (the Retroid\'s 4:3 sheet), not the web\'s twelve');
  assert.deepEqual(v.rows.map((r) => r.map((c) => c.kind).join(',')), ['item,item,item,item,item,item,item', 'item,item,item,empty,empty,empty,empty', 'pack,keepsake']);
  assert.equal(v.rows[2][1].col, 4, 'the keepsakes from the middle');
  assert.equal(v.rows[2][0].span + v.rows[2][1].span, 7);
  assert.equal(v.rows[0][0].pic, 'backpack');
  assert.ok(existsSync(new URL('../public/item-pictures/backpack.webp', import.meta.url)), 'its picture, made a PNG for Unity by scripts/engine-bundle.mjs');
  assert.equal(v.rows[2][0].mark, '⧉', 'what you carry: its kind\'s mark where it has no picture');
  // the cursor goes by the new grid: right along the row, down onto the second row's nearest, the empties never
  for (let i = 0; i < 5; i++) m.navigate(1, 0);
  assert.equal(m.view().strip.name, 'echo');
  m.navigate(0, 1);
  assert.equal(m.view().strip.name, 'coil', 'down from the sixth column: the second row\'s last tile');
  m.action('confirm');
  assert.equal(m.view().full.pic, 'coil', 'the full view with its picture');
  // twelve columns (a wide screen, or no engine's say): the web's own rows
  const wide = new EngineMenus({ store: memStore(), sources: s });
  wide.show('game', 'items');
  assert.equal(wide.view().rows[0].filter((c) => c.kind === 'item').length, 10);
  assert.match(src('scripts/engine-bundle.mjs'), /export async function unityPictures/);
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs'), /item-pictures/);
});

test('a shop\'s sheet (issue #264): the web\'s ShopPanel\'s wares as a list, A / × asks, Buy buys, B / ○ backs out, Anselm\'s in fragments; Photo mode on the Start menu', async () => {
  const { ShopPanel } = await import('../src/shop-panel.js');
  // Anselm's logic as src/fragment-shop.js has it: two upgrades, one he can sell, one too dear; what you hold
  const owned = new Set(), held = { n: 6 };
  const logic = {
    get held() { return held.n; },
    view: () => [{ id: 'coil', price: 5 }, { id: 'lightcell', price: 25 }].map((w) => ({ ...w, kind: 'upgrade', limited: true, state: owned.has(w.id) ? 'owned' : held.n < w.price ? 'short' : 'ok', stock: owned.has(w.id) ? 0 : 1 })),
    buy: (id) => { owned.add(id); held.n -= 5; return { ok: true, state: 'ok', price: 5, ware: id }; },
  };
  const el = { classList: { add() {}, remove() {} }, setAttribute() {}, addEventListener() {}, querySelector: () => null, innerHTML: '' };
  const panel = new ShopPanel({ el, doc: null, game: null, resources: { chimes: 0 }, covered: () => true });
  let resumed = 0;
  const m = new EngineMenus({ store: memStore(), settings: settingsStub(), onResume: () => resumed++ });
  assert.ok(m.openShop(panel, { kind: 'fragments', shop: { id: 'thrum', label: 'Anselm Thrum' }, logic, keeper: { id: 'thrum', name: 'Anselm Thrum', title: 'scientist' }, lines: {} }));
  let v = m.view();
  assert.equal(v.kind, 'shop');
  assert.equal(v.head, 'Anselm Thrum');
  assert.deepEqual(v.rows.map((r) => [r.id, r.ok, r.on]), [['coil', true, true], ['lightcell', false, false]]);
  assert.match(v.wallet, /^6 /);
  assert.equal(v.ask, null);
  m.action('confirm');
  v = m.view();
  assert.ok(v.ask && v.ask.on === 1 && /5/.test(v.ask.q), JSON.stringify(v.ask));
  m.navigate(-1, 0); assert.equal(m.view().ask.on, 0, 'left: Not now');
  m.navigate(1, 0); m.action('confirm');
  v = m.view();
  assert.equal(v.ask, null);
  assert.ok(owned.has('coil') && /^1 /.test(v.wallet), 'bought: the price off what you hold');
  assert.equal(v.rows[0].state, 'owned');
  // the one too dear: asked, nothing to buy (the keeper says why); B / ○ leaves the shop
  m.navigate(0, 1); m.action('confirm');
  assert.equal(m.view().ask, null);
  m.action('back');
  assert.ok(!m.open && resumed === 1 && !panel.isOpen);
  // photo mode on the Start menu, between Controls and What's new (the web's order), closing it as it starts
  let photo = 0;
  const p = new EngineMenus({ store: memStore(), settings: settingsStub(), onPhoto: () => photo++ });
  const at = START_SIDE.findIndex((e) => e.id === 'photo');
  assert.deepEqual(START_SIDE.slice(at - 1, at + 2).map((e) => e.id), ['controls', 'photo', 'news']);
  p.show('start');
  for (let i = 0; i < at; i++) p.navigate(0, 1);
  p.action('confirm');
  assert.ok(photo === 1 && !p.open);
});
