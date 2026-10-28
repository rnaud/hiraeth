// The pointer on the engines' menus (issue #574): the mouse and the fingers on what the Unity bridge drew (BridgeMenu.Pointer.cs
// places them and names the target the view gave it, `pt`) do what the web's click does (engine/menus.js pointer), through the
// pad's own actions; a tap on a handheld keeps its pad in hand (src/input-mode.js touchKeepsPad); the run's hint row stays as
// it was under the pause, as the page's (src/minigames/kit/runner.js publish). The C# isn't compiled here: its wiring is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus, parseMenuPointer, SETTINGS_ROWS } = await import('../engine/menus.js');
const { SlotStore } = await import('../src/save-slots.js');
const { InputMode } = await import('../src/input-mode.js');
const { hudButtons } = await import('../src/hud-buttons.js');

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const memStore = () => { const m = new Map(); return new SlotStore({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }); };
const settingsStub = () => ({ music: 0.8, effects: 1, voices: 0.8, mute: false, sensitivity: 1, invertY: false, hints: 'subtle', quality: 'handheld', set(k, v) { this[k] = v; } });
const press = (m, pt, x = 0.5, y = 0.5) => m.pointer({ how: 'press', pt, x, y });
const hover = (m, pt) => m.pointer({ how: 'hover', pt });
function sources() {
  return {
    quests: () => ({ charge: { title: 'The charge', goal: 'Go', step: 'Walk', worlds: '0 of 9' }, active: [{ id: 'q1', title: 'Water', goal: 'Find water', step: 'Look', main: true, tracked: false }, { id: 'q2', title: 'Sand', goal: 'Sweep', step: 'Sweep', tracked: true }], errands: [], done: [], failed: [] }),
    items: () => ({ gear: [{ id: 'backpack', name: 'Backpack', kind: 'core', text: 'It shoots.', usable: false }, { id: 'stun', name: 'Stun', kind: 'mode', text: 'It stuns.', usable: true }], slots: 14, pack: [], keepsakes: [], chimes: 3 }),
    worlds: () => [{ id: 'desert', n: 1, title: 'The Desert', current: true, told: false, boxes: [1, 4], blurb: 'Sand.', people: [], travel: false }],
    people: () => ({ groups: [], person: null }),
    map: () => ({ world: 'The Desert', marks: [{ id: 'you', kind: 'you', name: 'You', sub: '', u: 0.5, v: 0.5, deg: 90, on: true }] }),
  };
}

test('parseMenuPointer: BridgeHost.MenuPointer\'s events', () => {
  assert.deepEqual(parseMenuPointer('hover|row:1|0.5|0.25|0;press|cell:2,1|0.1|0.9|0;zoom|map|0.3|0.4|-1;scroll||0|0|0;bogus|x|1|1|1'), [
    { how: 'hover', pt: 'row:1', x: 0.5, y: 0.25, d: 0 }, { how: 'press', pt: 'cell:2,1', x: 0.1, y: 0.9, d: 0 },
    { how: 'zoom', pt: 'map', x: 0.3, y: 0.4, d: -1 }, { how: 'scroll', pt: '', x: 0, y: 0, d: 0 }]);
  assert.deepEqual(parseMenuPointer(''), []);
  assert.deepEqual(parseMenuPointer(null), []);
});

test('the title: the mouse over an entry picks it, a click on it chooses it (src/title.js click); the settings\' rows and sliders', () => {
  let chose = null;
  const s = settingsStub();
  const m = new EngineMenus({ store: memStore(), settings: s, onStart: (c) => (chose = c) });
  m.show('title');
  assert.deepEqual(m.view().rows.map((r) => r.pt), ['row:0', 'row:1', 'row:2'], 'each entry names its target');
  assert.equal(m.view().pointer, false);
  assert.equal(hover(m, 'row:2'), false, 'the mouse over an entry: its own look (#title .main-menu button:hover, BridgeMenu), the cursor where it was');
  assert.ok(m.view().rows[0].on);
  press(m, 'row:2');
  assert.equal(m.view().screen, 'settings', 'clicked: Settings, as A / × on it');
  const rows = m.view().page.rows;
  const at = (k) => SETTINGS_ROWS.filter((r) => !r.group && !r.when).findIndex((r) => r.k === k);
  const invert = rows.find((r) => r.pt === `set:${at('invertY')}`);
  assert.ok(invert && !invert.head, 'a setting names its target by its place among the settings (the headings are passed over)');
  assert.ok(rows.filter((r) => r.head).every((r) => !r.pt), 'a heading takes no pointer');
  press(m, invert.pt);
  assert.equal(s.invertY, true, 'a switch clicked: turned, as A / ×');
  const sens = rows.find((r) => r.pt === `set:${at('sensitivity')}`);
  assert.equal(sens.ptSlide, `slide:${at('sensitivity')}`, 'a slider\'s track is a target of its own');
  press(m, sens.ptSlide, 1);
  assert.equal(s.sensitivity, 3, 'pressed at its right end: its most');
  press(m, sens.ptSlide, 0);
  assert.equal(s.sensitivity, 0.3, 'at its left end: its least');
  press(m, sens.ptSlide, 0.5);
  assert.equal(s.sensitivity, 1.65, 'half way, in its steps');
  assert.equal(chose, null);
});

test('the title\'s question: the mouse over an answer picks it, a click answers', () => {
  const store = memStore();
  store.view(1).setItem('hiraeth.save.v1', JSON.stringify({ level: 'desert', pos: [0, 0, 0] })); store.touch(1, { addSeconds: 600 });
  const m = new EngineMenus({ store, settings: settingsStub() });
  m.show('title');
  press(m, 'row:1');
  assert.equal(m.view().screen, 'saves');
  assert.ok(hover(m, 'row:0'));
  assert.ok(m.view().rows[0].on, 'on Saves the mouse over a row picks it (#title .slot .pick:hover looks as its focus)');
  assert.equal(m.view().pointer, true, 'the view says the pointer moved it (BridgeMenu keeps its lists where it left them)');
  m.navigate(0, 1);
  assert.equal(m.view().pointer, false, 'the pad again: the lists round the cursor');
  m.navigate(0, 1); m.navigate(0, -1);
  const slot = m.view().rows.findIndex((r) => r.del);
  m.title.i = slot; m.action('x');
  assert.ok(m.view().ask);
  press(m, 'row:0');
  assert.ok(m.view().ask, 'a click on a row under the question: nothing (the question holds the screen)');
  hover(m, 'ask:1');
  assert.equal(m.view().ask.on, 1);
  press(m, 'ask:0');
  assert.equal(m.view().ask, null, 'Keep clicked: the question gone, the save kept');
  assert.ok(!store.summary(1).empty);
});

test('the Start menu: a click on a sidebar entry opens its page, the rows and sliders there, the mouse over a row picks it', () => {
  const s = settingsStub();
  let resumed = 0;
  const m = new EngineMenus({ store: memStore(), settings: s, onResume: () => resumed++ });
  m.show('start');
  const v = m.view();
  assert.ok(v.side.every((e, i) => e.pt === `side:${i}`));
  const controls = v.side.findIndex((e) => /controls/i.test(e.text));
  assert.equal(hover(m, `side:${controls}`), false, 'the mouse over an entry: its :hover look (BridgeMenu), the focus and the page where they were');
  assert.equal(m.view().page.id, 'settings');
  press(m, `side:${controls}`);
  assert.equal(m.view().page.id, 'controls', 'clicked: its page');
  assert.deepEqual(m.start.at, { in: 'side', i: controls }, 'the focus on its entry, as the page\'s click leaves it');
  press(m, 'side:1');
  assert.equal(m.view().page.id, 'settings');
  const news = v.side.findIndex((e) => /new/i.test(e.text));
  press(m, `side:${news}`);
  assert.equal(m.view().news, true, 'What\'s new clicked: its panel over the game, as the page\'s');
  press(m, 'close');
  assert.equal(m.mode, null, 'its Close');
  m.show('start');
  const music = SETTINGS_ROWS.filter((r) => !r.group && !r.when).findIndex((r) => r.k === 'music');
  press(m, `slide:${music}`, 0.25);
  assert.equal(s.music, 0.25);
  assert.equal(hover(m, 'set:0'), false, 'the mouse over a setting\'s row: nothing, as the page');
  press(m, 'set:0');
  assert.ok(m.view().page.rows.find((r) => r.pt === 'set:0').on, 'clicked: the cursor there (a choice stepped, as A / ×)');
  press(m, 'side:0');
  assert.equal(m.mode, null, 'Resume clicked: the game again');
  assert.equal(resumed, 2, 'What\'s new closed, then Resume');
  m.show('start');
  press(m, 'close');
  assert.equal(m.mode, null, 'the close button');
});

test('the game menu: a tap picks a cell, a tap on the one picked does it; the mouse over one picks it; tabs, sides, close', () => {
  const tracked = [];
  const m = new EngineMenus({ store: memStore(), sources: sources(), onTrack: (id) => tracked.push(id) });
  m.show('game');
  const v = m.view();
  assert.equal(v.panel, 'quests');
  const water = v.rows.flat().find((c) => c.text === 'Water');
  assert.ok(water.pt.startsWith('cell:'));
  press(m, water.pt);
  assert.equal(m.view().strip.name, 'Water', 'the first tap picks it');
  assert.deepEqual(tracked, []);
  press(m, water.pt);
  assert.deepEqual(tracked, ['q1'], 'a tap on the one picked: A / ×, tracked');
  const sand = m.view().rows.flat().find((c) => c.text === 'Sand');
  hover(m, sand.pt);
  assert.equal(m.view().strip.name, 'Sand', 'the mouse over a cell picks it (src/game-menu.js pointerover)');
  press(m, water.pt);
  assert.deepEqual(tracked, ['q1'], 'a tap on another: picks it only');
  hover(m, sand.pt); hover(m, water.pt);
  press(m, water.pt);
  assert.deepEqual(tracked, ['q1', 'q1'], 'the mouse over it first: a click does it at once');
  press(m, 'tab:2');
  assert.equal(m.view().panel, m.state.panels[2].id, 'a tab clicked: its panel');
  press(m, 'go:1');
  assert.equal(m.view().panel, m.state.panels[3].id, 'the side tab: the next panel, as RB');
  assert.equal(hover(m, 'tab:0'), false, 'the mouse over a tab picks nothing (the page\'s :hover only)');
  press(m, 'close');
  assert.equal(m.mode, null);
});

test('the game menu: the items\' tiles keep their places in the panel\'s rows (the empty slots between take no pointer); the full view\'s buttons', () => {
  let used = null;
  const m = new EngineMenus({ store: memStore(), sources: sources(), onUse: (id) => (used = id) });
  m.show('game', 'items');
  const cells = m.view().rows.flat();
  assert.ok(cells.filter((c) => c.empty).every((c) => !c.pt), 'a slot still to find is no target');
  const stun = cells.find((c) => c.text === 'Stun');
  press(m, stun.pt); press(m, stun.pt);
  assert.equal(m.view().full?.title, 'Stun', 'the thing full screen');
  press(m, stun.pt);
  assert.equal(m.view().full?.title, 'Stun', 'the cells under the full view take nothing');
  press(m, 'full:use');
  assert.equal(used, 'stun');
  press(m, 'full:back');
  assert.equal(m.view().full, undefined);
});

test('the Map: the mouse moves its cursor, a drag the map, the wheel zooms round the mouse, the zoom\'s buttons', () => {
  const m = new EngineMenus({ store: memStore(), sources: sources(), mapBox: () => ({ w: 800, h: 500 }) });
  m.show('game', 'map');
  m.view();
  const V = m.mapView, z0 = V.z;
  m.pointer({ how: 'zoom', pt: 'map', x: 0.5, y: 0.5, d: -1 });
  assert.ok(V.z > z0, 'the wheel up: closer');
  m.pointer({ how: 'point', pt: 'map', x: 0.2, y: 0.3 });
  const u0 = V.u0;
  m.pointer({ how: 'drag', pt: 'map', x: 0.1, y: 0 });
  assert.notEqual(V.u0, u0, 'dragged: the map moved under the pointer');
  const z1 = V.z;
  press(m, 'zoom:-1');
  assert.ok(V.z < z1, 'the − button: further');
  assert.equal(m.pointer({ how: 'point', pt: 'map', x: 0.5, y: 0.5 }), true);
  m.action('tabNext');
  assert.equal(m.pointer({ how: 'point', pt: 'map', x: 0.5, y: 0.5 }), false, 'off the Map: no map to point at');
});

test('a run\'s card: the mouse over a button picks it, a click or a tap does it (the pause\'s Resume and Retry, src/minigames/kit/runner.js click)', () => {
  const acts = [];
  const runner = { cardV: 1, cardModel: { kind: 'paused', title: 'Paused', buttons: [{ act: 'resume', label: 'Resume', main: true }, { act: 'retry', label: 'Retry' }] }, act(a) { acts.push(a); }, padAction() {}, stepCardOption() {} };
  const m = new EngineMenus({ store: memStore() });
  m.openCard(runner);
  const v = m.view();
  assert.deepEqual(v.card.buttons.map((b) => b.pt), ['act:resume', 'act:retry']);
  assert.equal(hover(m, 'act:retry'), false, 'the mouse over Retry: its :hover look (BridgeMenu draws it), the focus stays on Resume');
  assert.ok(m.view().card.buttons[0].on);
  press(m, 'act:resume');
  assert.deepEqual(acts, ['resume']);
  press(m, 'act:retry');
  assert.deepEqual(acts, ['resume', 'retry']);
  assert.equal(press(m, 'act:nothing'), false, 'a target the card hasn\'t: nothing');
});

test('the Arena\'s foes: a click on a foe fights it, the filter\'s ends turn it, the close button', async () => {
  const { FoeList } = await import('../src/foe-spawner.js');
  const list = new FoeList({ win: null, doc: null });
  list.foes = { practice: null, waves: 'on', setPractice(k) { this.practice = k ? { kind: k } : null; }, startWaves(w) { this.practice = null; this.waves = w ?? 'on'; } };
  list.guardians = { id: null, call(id) { this.id = id; }, dismiss() { this.id = null; } };
  const m = new EngineMenus({ store: memStore(), screen: () => ({ w: 1280, h: 720 }) });
  m.openFoes(list);
  const foe = m.view().rows.flat().find((c) => c.kind === 'foe');
  assert.match(foe.pt, /^item:\d+$/);
  assert.ok(m.view().rows.flat().filter((c) => c.kind === 'head').every((c) => !c.pt), 'a heading is no target');
  press(m, foe.pt);
  assert.ok(list.foes.practice, 'the foe practised');
  const was = m.view().filter.i;
  press(m, 'go:1');
  assert.notEqual(m.view().filter.i, was, 'RB\'s end: the next world');
  press(m, 'close');
  assert.equal(m.mode, null);
});

test('a tap on a handheld keeps its pad in hand; on a computer a click is the mouse in hand (issue #574)', () => {
  const hand = new InputMode({ storage: { get: () => null, set() {} }, touchKeepsPad: () => true });
  hand.frame(true);
  assert.equal(hand.kind, 'pad');
  hand.event({ type: 'pointerdown', pointerType: 'touch' });
  assert.equal(hand.kind, 'pad', 'the Retroid\'s screen tapped: its buttons\' names stay in the prompts');
  hand.frame(true);
  assert.equal(hand.kind, 'pad');
  assert.equal(hand.pointerKind, 'touch', 'the pointer\'s own buttons come back for the finger');
  assert.equal(hudButtons({ minigame: {} }, { kind: hand.pointerKind }).length, 1, 'the run\'s pause button shown after the tap');
  hand.pad();
  assert.equal(hand.pointerKind, 'pad', 'a pad\'s button again: gone again');
  hand.event({ type: 'pointerdown', pointerType: 'mouse' });
  assert.equal(hand.kind, 'keys', 'a mouse on the handheld is the mouse');
  const desk = new InputMode({ storage: { get: () => null, set() {} } });
  desk.frame(true);
  desk.event({ type: 'pointerdown', pointerType: 'mouse' });
  assert.equal(desk.kind, 'keys', 'a click on a computer: the keyboard and mouse');
  desk.pad();
  desk.event({ type: 'pointerdown', pointerType: 'touch' });
  assert.equal(desk.kind, 'keys', 'a touch screen there counts as the screen in hand, as before');
  // the engine: a handheld's own build (src/native-pad.js padLayout 'android') keeps the pad; the HUD's buttons by pointerKind
  const g = src('engine/game.js');
  assert.match(g, /touchKeepsPad: \(\) => padLayout\(\) === 'android'/);
  assert.match(g, /hudButtons\(screen\.state, \{ kind: inputMode\.pointerKind,/);
});

test('the run\'s hint row stays under the pause as it was, as the page\'s (its loop held under the card)', () => {
  const r = src('src/minigames/kit/runner.js');
  const pub = r.slice(r.indexOf('  publish(dt = 0) {'), r.indexOf('  bumpScore()'));
  assert.match(pub, /live = \['count', 'play'\]\.includes\(this\.phase\);/, 'paused does not turn the row off');
  assert.doesNotMatch(pub, /live = \['count', 'play'\]\.includes\(this\.phase\) && !this\.paused/);
});

test('the Unity side: BridgeMenu places the pointer on what it drew and hands it to the script each frame', () => {
  const p = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Pointer.cs');
  const menu = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs');
  const host = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  const game = src('engine/unity/game.js');
  assert.match(menu, /PollMenuPointer\(\);/, 'polled each frame a menu is up');
  assert.match(menu, /PointerDrawStart\(\);/, 'the targets put down again as each drawing starts');
  assert.doesNotMatch(menu, /static float Scroll\(/, 'one Scroll: round the cursor, or where the pointer left the list');
  assert.match(p, /RectTransformUtility\.ScreenPointToLocalPointInRectangle\(h\.rt, sp, cam, out var lp\)/);
  assert.match(p, /BridgeHost\.MenuEvent\("hover", pt, f\)/);
  assert.match(p, /BridgeHost\.MenuEvent\("press", downPt, f\)/);
  assert.match(host, /menuPointer = TakeMenuPointer\(\);/, 'taken with the frame\'s keys and pad');
  assert.match(host, /public static string MenuPointer\(\) => OnMain \? TakeMenuPointer\(\) : menuPointer;/);
  assert.match(game, /for \(const ev of parseMenuPointer\(text\)\) S\.menus\.pointer\(ev\);/);
  assert.match(game, /readPad\(\);\n  readMenuPointer\(\);/, 'the title\'s too, before a world');
  // every kind of menu puts its targets down
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Wardrobe.cs'), /Hit\(cell\.box\.rt, c\.S\("pt"\)\);/, 'the Wardrobe\'s lines too');
  const menuSources = [];
  for (const f of ['BridgeMenu.cs', 'BridgeMenu.Chrome.cs', 'BridgeMenu.Pause.cs', 'BridgeMenu.Shop.cs', 'BridgeMenu.Arcade.cs', 'BridgeMenu.StarMap.cs'])
    menuSources.push(src(`unity/Hiraeth/Assets/HiraethJS/Runtime/${f}`));
  const all = menuSources.join('\n');
  for (const t of ['"close"', '"tab:" + i', '"go:-1"', '"go:1"', '"ask:0"', '"ask:1"', '"map"', '"zoom:1"', '"full:use"', '"floor:" + i', '"star:go"', 'r.S("ptSlide")', 'b.S("pt")', 'o.S("pt")', 'e.S("pt")', 'c.S("pt")'])
    assert.ok(all.includes(t), `a target ${t}`);
});

test('wardrobe drag uses the shared turntable and is confined to its page', () => {
  const m = new EngineMenus({ store: memStore(), sources: sources() });
  m.show('game');
  const before = m.turntable.yaw;
  assert.equal(m.pointer({ how: 'drag', pt: 'wardrobe-turn', x: 80 }), false);
  m.state.i = m.state.panels.findIndex(p => p.id === 'wardrobe');
  assert.equal(m.pointer({ how: 'drag', pt: 'wardrobe-turn', x: 80 }), true);
  assert.ok(Math.abs(m.turntable.yaw - before - 80 * m.turntable.T.drag) < 1e-9);
  assert.equal(m.turntable.idle, 0);
  assert.equal(m.pointer({ how: 'drag', pt: 'wardrobe-turn', x: NaN }), false);
});

test('scanner pointer dispatch preserves hover versus touch placement', () => {
  const m = new EngineMenus({ store: memStore() });
  const calls = [];
  m.mode = 'starmap'; m.star = { pointer: (...args) => (calls.push(args), true) };
  m.pointer({ how: 'point', pt: 'scanner', x: .2, y: .3 });
  m.pointer({ how: 'press', pt: 'scanner', x: .4, y: .5 });
  assert.deepEqual(calls, [[.2, .3, false], [.4, .5, true]]);
});

test('native pointer targets include the wardrobe, scanner and explicit changelog browser link', () => {
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Wardrobe.cs'), /Hit\(wdFrame.rt, "wardrobe-turn"\)/);
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.StarMap.cs'), /Hit\(smField, "scanner"\)/);
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Pause.cs'), /Hit\(nwPics.rt, "news-pictures"\)/);
  const pointer = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Pointer.cs');
  assert.match(pointer, /downPt == "news-pictures"[\s\S]*Application.OpenURL\(url\)/);
  assert.match(pointer, /if \(!Application.isBatchMode\) Application.OpenURL/);
});

test('physical device menu review drains real input before any synthetic pointer step or hold', () => {
  const source = src('engine/unity/game.js');
  assert.match(source, /planPointer: String\(args\.menuPointer \?\? ''\)\.startsWith\('device-'\)/);
  const frame = source.slice(source.indexOf('function playFrame(dt)'), source.indexOf("else if (step.kind === 'key')"));
  assert.ok(frame.indexOf('readPointer(game)') < frame.indexOf("step.kind === 'hold'"));
  assert.match(frame, /else if \(S\.planPointer\) \{ readPad\(\); readPointer\(game\); \}/);
  assert.match(source, /!String\(args\.menuPointer\)\.startsWith\('device-'\)/, 'physical review does not inject a synthetic swipe');
});
