import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cueText, PlaceName, Fader, Cue, questsPageHtml, padCue, RIDE_HINT_MS, healthHud, staminaHud } from '../src/hud.js';
import { Quests } from '../src/story/quests.js';
import { Controller, menuNavigate } from '../src/controller.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** ui.js reads matchMedia and window at import: a bare stand-in for the test. */
async function ui() {
  globalThis.matchMedia ??= () => ({ matches: false });
  globalThis.window ??= new EventTarget();
  return import('../src/ui.js');
}

// ---- nothing on the screen at rest

test('the page has no status box: no #hud, no #status, no scout label; only the cue, which starts empty', () => {
  const html = src('index.html');
  for (const id of ['hud', 'status', 'scout-label']) assert.doesNotMatch(html, new RegExp(`id="${id}"`), `#${id}`);
  assert.match(html, /<div id="cue" aria-live="polite"><\/div>/);
  assert.match(html, /#cue \{[^}]*opacity: 0;/, 'the cue is invisible until it has something to say');
  assert.match(html, /#cue\.show \{ opacity: 1; \}/);
  // the health bar, the stamina wheel and the tool are invisible at rest too
  assert.match(html, /#health \{[^}]*opacity: 0;/);
  assert.match(html, /#stamina \{[^}]*opacity: 0;/);
  assert.match(html, /#tool \{[^}]*opacity: 0; visibility: hidden;/);
  // the menu's button: only on a touch screen, and faint there
  assert.match(html, /body:not\(\.touch\) #gear \{ display: none; \}/);
  assert.match(html, /#gear \{[^}]*opacity: 0\.45;/);
  // no keyboard help on the screen (it is the menu's Controls page now: H)
  assert.doesNotMatch(html, /click to capture mouse/);
  const main = src('src/main.js');
  assert.doesNotMatch(main, /classList\.toggle\('help'\)/);
  assert.doesNotMatch(main, /getElementById\('status'\)|getElementById\('scout-label'\)/);
});

test('the cue says nothing at rest, and only what the use button does right here when nothing else does', () => {
  assert.equal(cueText({}), '', 'walking about');
  assert.equal(cueText({ prompt: 'talk to Ama', promptAt: { x: 1 } }), '', 'the floating prompt over Ama says it');
  assert.equal(cueText({ prompt: 'turn the lens' }), 'E turn the lens', 'a prompt with nothing to float over');
  assert.equal(cueText({ prompt: 'turn the lens', controller: true }), 'B / ○ turn the lens', 'in the pad\'s names');
  assert.equal(cueText({ shipHint: 'E go aboard', prompt: 'talk to Ama' }), 'E go aboard', 'at the ramp, E is the ship\'s');
  assert.equal(cueText({ shipHint: 'aboard the ship' }), '', 'not a prompt: nothing');
  assert.equal(cueText({ shipPlaying: true, prompt: 'go' }), '', 'in the ship\'s scenes E does nothing');
  assert.equal(cueText({ lens: 'E turn lens 2 · 1/3 beams aligned', prompt: 'turn the lens' }), 'E turn lens 2 · 1/3 beams aligned');
  assert.equal(cueText({ aiming: true, prompt: 'turn the lens' }), '', 'aiming: the crosshair speaks');
  assert.equal(cueText({ quiet: true, prompt: 'turn the lens' }), '', 'a menu, a conversation, photo mode');
  // a ride's controls for a few seconds after you get on, then nothing
  assert.match(cueText({ ride: 'bike', rideFor: 100 }), /^E dismount/);
  assert.match(cueText({ ride: 'bike', rideFor: 100, controller: true }), /^A \/ × jump off · B \/ ○ dismount · RT \/ R2 go/);
  assert.equal(cueText({ ride: 'bike', rideFor: RIDE_HINT_MS + 1 }), '');
  assert.equal(padCue('E go aboard · SPACE hop · SHIFT boost'), 'B / ○ go aboard · A / × hop · L3 boost');
});

test('a region\'s name shows as you cross into it (not where you arrive, not along a flickering border), then goes', () => {
  const p = new PlaceName({ settle: 1000, show: 3000 });
  assert.equal(p.update('Golden dunes', 0), '');
  assert.equal(p.update('Golden dunes', 1500), '', 'where you arrive: the world\'s own words say it');
  assert.equal(p.update('Rose canyons', 2000), '');
  assert.equal(p.update('Golden dunes', 2300), '', 'back over the border at once: nothing');
  assert.equal(p.update('Rose canyons', 3000), '');
  assert.equal(p.update('Rose canyons', 4100), 'Rose canyons', 'held a second: named');
  assert.equal(p.update('Rose canyons', 6000), 'Rose canyons');
  assert.equal(p.update('Rose canyons', 7200), '', 'and gone');
});

test('the health bar and the stamina wheel show while it matters and fade a moment after', () => {
  const f = new Fader(3);
  assert.equal(f.update(0.1, false), false, 'unhurt: nothing');
  assert.equal(f.update(0.1, true), true, 'hurt');
  for (let i = 0; i < 20; i++) f.update(0.1, true);   // healing
  assert.equal(f.update(2.9, false), true, 'a moment after');
  assert.equal(f.update(0.2, false), false, 'gone');
  const main = src('src/main.js');
  assert.match(main, /const hpFade = new Fader\(3\)/);
  // (the rule in hud.js healthHud, which main.js draws and an engine reads: platform.js screen.health)
  assert.match(main, /healthHud\(\{ health: h, down: player\.down, hurt: hpShown > 0/, 'main.js shows the bar by healthHud');
  const g = new Fader(3);
  assert.equal(healthHud({ health: 1 }, g, 0.1), null, 'unhurt: nothing');
  assert.deepEqual(healthHud({ health: 0.6 }, g, 0.1), { value: 0.6, low: false }, 'hurt or healing (health below full)');
  assert.deepEqual(healthHud({ health: 0.2 }, g, 0.1), { value: 0.2, low: true }, 'low');
  assert.ok(healthHud({ health: 1, down: true }, new Fader(3), 0.1), 'knocked down');
  assert.equal(healthHud({ health: 0.5, quiet: true }, new Fader(3), 0.1), null, 'not over a scene or photo mode');
  assert.equal(staminaHud({ stamina: 0.5 }, 0), null, 'the wheel: only while it has time left');
  assert.deepEqual(staminaHud({ stamina: 0.5, winded: true }, 0.9), { value: 0.5, winded: true });
});

test('no charge pips on the screen (the backpack\'s tank shows the level): only an empty tank says so, briefly', async () => {
  const { ToolHud, GAUGE_DRY } = await ui();
  const g = new ToolHud(null);
  const at = (o, now) => g.gaugeShown({ owned: true, dry: false, now, ...o });
  assert.equal(at({}, 0), false, 'a full tank: nothing');
  assert.equal(at({ level: 2 }, 1), false, 'a shot spent a charge: still nothing beside the traveller');
  assert.equal(at({ jets: true, level: 2.6 }, 10), false, 'the jets burning: nothing either');
  assert.equal(at({ dry: true }, 20), true, 'the tank ran dry: it says so');
  assert.equal(at({ dry: true }, 20 + GAUGE_DRY + 0.1), false, 'then lets it be (it waits for magical water)');
  assert.equal(g.gaugeShown({ owned: false, dry: true, now: 30 }), false, 'no backpack, no notice');
  // the crosshair's label holds the mode's name alone: no pips, no refill seconds
  const ui_ = src('src/ui.js'), html = src('index.html');
  assert.doesNotMatch(ui_, /class="pips"|class="wait"/, 'no pips in the tool\'s HUD');
  assert.doesNotMatch(html, /#tool \.pips/, 'nor their style');
  assert.match(src('src/fluid-tool.js'), /modeName: dry \? 'empty' : this\.modeName/, 'the empty tank names itself');
});

test('the frame readout is off unless asked for (F, the settings, ?fps=1), and older settings lose the old default once', async () => {
  const { Settings, migrateSettings } = await ui();
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  try { assert.equal(new Settings().showFps, false); } finally { delete globalThis.localStorage; }
  assert.deepEqual(migrateSettings({ showFps: true, music: 0.5 }), { music: 0.5, hudV: 1 }, 'saved before: the old default goes');
  assert.deepEqual(migrateSettings({ showFps: true, hudV: 1 }), { showFps: true, hudV: 1 }, 'turned on since: kept');
  assert.match(src('src/main.js'), /if \(query\.get\('fps'\) === '1'\) settings\.showFps = true;/);
  assert.match(src('scripts/handheld-perf/lib.mjs'), /showFps: true, hudV: 1/, 'the handheld measuring keeps it on');
});

test('the cue sets its line only when it changes and fades it in and out', () => {
  const cls = new Set(), el = { innerHTML: '', classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } };
  const c = new Cue(el);
  c.set('');
  assert.ok(!cls.has('show'));
  c.set('E go aboard');
  assert.ok(cls.has('show')); assert.equal(el.innerHTML, '<b class="key">E</b> go aboard');
  c.set('Rose canyons', 'place');
  assert.ok(cls.has('place')); assert.equal(el.innerHTML, '<span>Rose canyons</span>');
  c.set('');
  assert.ok(!cls.has('show'), 'faded out (the last words stay under the fade)');
});

// ---- the scout finds the objective: on foot and riding, the top button

test('the top button (Y / △) sends the scout on foot and riding; Q on the keyboard and the touch "ping" too', () => {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = []; let ctx = 'game';
  const c = new Controller({ pads: () => [pad], context: () => ctx, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {} });
  const tap = (i) => { pad.buttons[i] = { pressed: true, value: 1 }; c.update(0.016); pad.buttons[i] = { pressed: false, value: 0 }; c.update(0.016); };
  tap(3); assert.deepEqual(actions, ['ping'], 'on foot');
  ctx = 'ride'; c.update(0.016); tap(3); assert.deepEqual(actions, ['ping', 'ping'], 'riding (a bike, the bird: flying too)');
  ctx = 'photo'; c.update(0.016); tap(3); assert.equal(actions.length, 2, 'not in photo mode');
  const main = src('src/main.js');
  assert.match(main, /e\.code === 'KeyQ' && !e\.repeat && !busy\(\) && !photo\.on && !ship\.playing\) scout\.ping\(\)/);
  assert.match(main, /name === 'ping' && !ship\.playing\) scout\.ping\(\)/);
  assert.match(src('src/ui.js'), /data-press="KeyQ" class="b-ping"/);
  // what it found: the cue, at once, and the quest marker for a while; nothing to find: a shrug, said
  assert.match(main, /onFind: \(target, d\) => \{ scoutSays\(`◆ \$\{findText\(target, d\)\}`, 5\); storyRt\.marker\.reveal\(\); \}/);
  assert.match(main, /onShrug: \(\) => scoutSays\('Nothing to find here', 2\.5\)/);
});

test('the quest marker hangs over the objective only for a while after the scout has found it', async () => {
  const THREE = await import('three');
  const { QuestMarker, MARKER_SECONDS } = await import('../src/story/quests.js');
  const m = new QuestMarker(new THREE.Scene(), () => new THREE.MeshBasicMaterial());
  const ob = { position: new THREE.Vector3(40, 0, 0) }, player = { pos: new THREE.Vector3() };
  for (let i = 0; i < 60; i++) m.update(1 / 30, i / 30, ob, player, null);
  assert.equal(m.group.visible, false, 'not by itself');
  m.reveal();
  for (let i = 0; i < 60; i++) m.update(1 / 30, 2 + i / 30, ob, player, null);
  assert.equal(m.group.visible, true, 'found: it shows');
  for (let i = 0; i < (MARKER_SECONDS + 2) * 30; i++) m.update(1 / 30, 4 + i / 30, ob, player, null);
  assert.equal(m.group.visible, false, 'and fades after a while');
});

test('a makers\' box offered on arrival does not take the scout from the quest you are on; choosing it does', () => {
  const flags = {}, game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, emit() {} };
  const q = new Quests({ game });
  q.define({ id: 'main', title: 'Main', main: true, stages: [{ id: 'a', text: 'Go to the tree', goto: [100, 0, 0] }, { id: 'b', text: 'Talk to Sel', goto: [200, 0, 0] }] });
  q.define({ id: 'box', title: 'A Makers’ Box', background: true, stages: [{ id: 'roof', text: 'Climb to the roof', goto: [30, 0, 0] }] });
  q.define({ id: 'side', title: 'Pim’s latch', stages: [{ id: 'find', text: 'Find the latch', goto: [50, 0, 0] }] });
  q.start('main');
  q.start('box');
  assert.equal(q.objective().label, 'Go to the tree', 'the box found on arrival: still the main quest');
  q.track('box');
  assert.equal(q.objective().label, 'Climb to the roof', 'chosen in the quest log');
  q.advance('main');
  assert.equal(q.objective().label, 'Talk to Sel', 'the main quest moving on takes it back');
  q.start('side');
  assert.equal(q.objective().label, 'Find the latch', 'an errand you take on in a conversation: that one');
  assert.match(src('src/boxes/index.js'), /background: true/, 'the makers\' boxes start on their own');
});

// ---- the menu's Quests and Controls pages

test('the menu\'s Quests page: where to go, then the quest log, steps done struck through, done and failed ones marked', () => {
  const flags = {}, game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, emit() {} };
  const q = new Quests({ game });
  q.define({ id: 'p', title: 'Power for the ship', main: true, stages: [{ id: 'a', text: 'Follow the smoke' }, { id: 'b', text: 'Talk to Ama' }] });
  q.define({ id: 'd', title: 'The drum', outro: 'Teo drums again.', stages: [{ id: 'a', text: 'Find the drum' }] });
  q.define({ id: 'f', title: 'Water for the terraces', failOutro: 'The terraces slid.', stages: [{ id: 'a', text: 'Ask Mira' }] });
  q.start('p'); q.advance('p'); q.start('d'); q.complete('d'); q.start('f'); q.fail('f');
  const html = questsPageHtml({ objective: 'Ama, by the fires', distance: '320 m', charge: '<section class="charge">✦</section>', quests: q.journalHtml(), carrying: 'carrying a brass gear → Edena' });
  assert.match(html, /<h2>Where to<\/h2><p class="go">◆ Ama, by the fires <span>· 320 m<\/span><\/p>/);
  assert.match(html, /Q, Y \/ △ on a controller/, 'how to send the scout, in Xbox / PlayStation form');
  assert.match(html, /<li class="done">Follow the smoke<\/li><li class="now">Talk to Ama<\/li>/, 'a step done is struck through, the current one bold');
  assert.match(html, /The drum<b class="stamp">✓ Complete<\/b>/);
  assert.match(html, /Water for the terraces<b class="stamp failed">✗ Failed<\/b>/);
  assert.match(html, /The terraces slid\./);
  assert.ok(html.indexOf('class="charge"') < html.indexOf('class="quests"'), 'the father\'s charge first, as in the sketchbook');
  assert.match(html, /Carrying<\/h2><p>carrying a brass gear → Edena/);
  assert.match(questsPageHtml(), /Nothing to find here just now/);
  // the struck-through and failed looks are the sketchbook's own, on the menu's page as well
  const css = src('index.html');
  assert.match(css, /:is\(#journal, \.questlog\) \.quests li\.done \{ text-decoration: line-through;/);
  assert.match(css, /:is\(#journal, \.questlog\) \.quests \.stamp\.failed/);
});

test('the menu has Quests and Controls pages, reachable by controller, and H opens Controls', async () => {
  const ui = src('src/ui.js'), main = src('src/main.js');
  assert.match(ui, /go\('quests', 'Quests'\)/);
  assert.match(ui, /go\('controls', 'Controls'\)/);
  assert.match(ui, /<section class="panel questlog" data-page="quests" hidden><\/section>/);
  assert.match(ui, /q\.tabIndex = 0; q\.dataset\.nav = '';/, 'active quests are focusable: a pad moves onto them and confirm tracks one');
  assert.match(ui, /e\.code === 'KeyH' && !isBusy\(\)\) \{ if \(this\.open && this\.current === 'controls'\) this\.toggle\(false\); else this\.toggle\(true, 'controls'\); \}/);
  assert.match(main, /quests: \(\) => \{ const ob = scout\.getTarget\(\); return questsPageHtml\(\{[^}]*quests: storyRt\.quests\.journalHtml\(\)/, 'the journal\'s quest-log section');
  assert.match(main, /onTrack: \(id\) => storyRt\.quests\.choose\(id\)/);   // (chosen: src/story/quests.js choose)
  // menuNavigate moves onto [data-nav] (the quests) as well as buttons and inputs
  const mk = (name, nav = false) => ({ name, disabled: false, getClientRects: () => [1], focus() { globalThis.document.activeElement = this; }, scrollIntoView() {}, nav });
  const items = [mk('resume'), mk('quest', true)];
  const root = { querySelectorAll: (sel) => (sel.includes('[data-nav]') ? items : items.filter((i) => !i.nav)), contains: () => true };
  globalThis.document = { activeElement: items[0] };
  try { menuNavigate(root, 0, 1); assert.equal(globalThis.document.activeElement.name, 'quest'); } finally { delete globalThis.document; }
  // the Controls page: every control, the pad's in Xbox / PlayStation form, the one in your hands first
  const { controlsList, controlsHtml } = await (async () => { globalThis.matchMedia ??= () => ({ matches: false }); globalThis.window ??= new EventTarget(); return import('../src/ui.js'); })();
  const L = controlsList('A / ×', 'B / ○');
  assert.ok(L.pad.some(([what, how]) => /scout finds/.test(what) && /Y \/ △/.test(how)));
  assert.ok(L.keyboard.some(([what, how]) => /scout finds/.test(what) && how === 'Q'));
  assert.ok(L.touch.some(([what, how]) => /scout finds/.test(what) && how === 'ping'));
  const html = controlsHtml(L, 'touch');
  assert.ok(html.indexOf('<h2>Touch</h2>') < html.indexOf('<h2>Controller</h2>'), 'a touch screen: its controls first');
});
