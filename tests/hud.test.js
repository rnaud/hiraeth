import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cueText, PlaceName, Fader, Cue, findSummary, padCue, healthHud, staminaHud } from '../src/hud.js';
import { badgeLine } from '../src/prompt-keys.js';
const cueTextOf = cueText;
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

test('hints subtle (the default) or off: a prompt on the cue is its button alone, a small glyph, no words', () => {
  assert.equal(cueText({ prompt: 'turn the lens' }), 'E', 'the button, no sentence');
  assert.equal(cueText({ prompt: 'turn the lens', controller: true }), 'X / □');
  assert.equal(cueText({ shipHint: 'E galactic map' }), 'E');
  assert.equal(cueText({ lens: 'E (X / □) turn lens 2 · 1/3 beams aligned' }), 'E');
  assert.equal(cueText({ prompt: 'turn the lens', words: false }), 'E');
  assert.equal(cueText({ prompt: 'talk to Ama', promptAt: { x: 1 } }), '', 'the floating glyph over Ama says it');
  assert.equal(badgeLine('E'), '<b class="key">E</b>', 'drawn as the round badge');
  assert.match(src('src/story/index.js'), /const words = hintsFor\('words'\)/, 'the floating prompt: words only with hints full');
});

test('hints full: the cue says nothing at rest, and only what the use button does right here when nothing else does', () => {
  const cueText = (s) => cueTextOf({ words: true, ...s });
  assert.equal(cueText({}), '', 'walking about');
  assert.equal(cueText({ prompt: 'talk to Ama', promptAt: { x: 1 } }), '', 'the floating prompt over Ama says it');
  assert.equal(cueText({ prompt: 'turn the lens' }), 'E turn the lens', 'a prompt with nothing to float over');
  assert.equal(cueText({ prompt: 'turn the lens', controller: true }), 'X / □ turn the lens', 'in the pad\'s names');
  assert.equal(cueText({ shipHint: 'E step outside', prompt: 'talk to Ama' }), 'E step outside', 'aboard, E is the ship\'s');
  assert.equal(cueText({ shipHint: 'aboard the ship' }), '', 'not a prompt: nothing');
  assert.equal(cueText({ shipPlaying: true, prompt: 'go' }), '', 'in the ship\'s scenes E does nothing');
  assert.equal(cueText({ lens: 'E turn lens 2 · 1/3 beams aligned', prompt: 'turn the lens' }), 'E turn lens 2 · 1/3 beams aligned');
  assert.equal(cueText({ aiming: true, prompt: 'turn the lens' }), '', 'aiming: the crosshair speaks');
  assert.equal(cueText({ quiet: true, prompt: 'turn the lens' }), '', 'a menu, a conversation, photo mode');
  // bug (playtest 2026-10-08): getting into a vehicle listed its buttons; riding, the cue says nothing
  for (const ride of ['bike', 'skiff', 'bird', 'taxi']) {
    assert.equal(cueText({ ride, rideFor: 0 }), '', `no button hints getting on a ${ride}`);
    assert.equal(cueText({ ride, rideFor: 0, controller: true, prompt: 'turn the lens' }), '', 'nor a pad\'s, nor a prompt under it');
  }
  assert.equal(padCue('E go aboard · SPACE hop · SHIFT boost'), 'X / □ go aboard · A / × hop · L3 boost');
});

test('a region\'s name shows as you cross into it (and first where you arrive, not along a flickering border), then goes', () => {
  const p = new PlaceName({ settle: 1000, show: 3000 });
  assert.equal(p.update('Golden dunes', 0), 'Golden dunes', 'where you arrive: the first thing said (issue #78)');
  assert.equal(p.update('Golden dunes', 3100), '', 'and gone');
  assert.equal(p.update('Rose canyons', 4000), '');
  assert.equal(p.update('Golden dunes', 4300), '', 'back over the border at once: nothing');
  assert.equal(p.update('Rose canyons', 5000), '');
  assert.equal(p.update('Rose canyons', 6100), 'Rose canyons', 'held a second: named');
  assert.equal(p.update('Rose canyons', 8000), 'Rose canyons');
  assert.equal(p.update('Rose canyons', 9200), '', 'and gone');
});

test('a region\'s name waits while something else is on the screen, and shows for its full time after (issue #78)', () => {
  const p = new PlaceName({ settle: 1000, show: 3000 });
  assert.equal(p.update('Golden dunes', 0, { hold: true }), '', 'a scene plays: it waits');
  assert.equal(p.waiting, true, 'and says so: the other notices let it go first');
  assert.equal(p.update('Golden dunes', 5000, { hold: true }), '');
  assert.equal(p.update('Golden dunes', 6000), 'Golden dunes', 'the screen free: named');
  assert.equal(p.waiting, false);
  assert.equal(p.update('Golden dunes', 8900, { hold: true }), 'Golden dunes', 'once up, it keeps its time');
  assert.equal(p.update('Golden dunes', 9100), '');
  // the father's charge lettered just after the name came up: the name steps back and comes after it
  assert.equal(p.update('Rose canyons', 10000), '');
  assert.equal(p.update('Rose canyons', 11100), 'Rose canyons');
  p.defer(11200);
  assert.equal(p.update('Rose canyons', 11300, { hold: true }), '', 'waiting again');
  assert.equal(p.update('Rose canyons', 15000), 'Rose canyons', 'then its full time');
  assert.equal(p.update('Rose canyons', 17900), 'Rose canyons');
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
  assert.match(main, /healthHud\(\{ health: h, hearts: player\.hearts, max: player\.maxHearts, magic: R \? R\.level : null/, 'main.js shows the hearts by healthHud');
  assert.match(main, /down: player\.down, hurt: hpShown > 0/);
  const g = new Fader(3);
  assert.equal(healthHud({ health: 1 }, g, 0.1), null, 'unhurt: nothing');
  assert.deepEqual(healthHud({ hearts: 2.25, max: 3 }, g, 0.1), { value: 0.75, low: false, hearts: 2.25, max: 3 }, 'a heart missing: the hearts show');
  assert.deepEqual(healthHud({ hearts: 0.75, max: 3 }, g, 0.1), { value: 0.25, low: true, hearts: 0.75, max: 3 }, 'one heart or less: low');
  assert.deepEqual(healthHud({ health: 0.5 }, new Fader(3), 0.1), { value: 0.5, low: false, hearts: 1.5, max: 3 }, 'an old caller\'s share: as three hearts');
  assert.ok(healthHud({ health: 1, down: true }, new Fader(3), 0.1), 'knocked down');
  assert.equal(healthHud({ hearts: 2, quiet: true }, new Fader(3), 0.1), null, 'not over a scene or photo mode');
  assert.equal(healthHud({ hearts: 3, magic: 3, magicMax: 3 }, new Fader(3), 0.1), null, 'whole, the bar full: nothing');
  assert.deepEqual(healthHud({ hearts: 3, magic: 1.4, magicMax: 3, potions: 0, infinite: true }, new Fader(3), 0.1),
    { value: 1, low: false, hearts: 3, max: 3, magic: 1.4, magicMax: 3, potions: 0, infinite: true }, 'the magic bar spending or refilling: shown, with the potion');
  assert.ok(healthHud({ hearts: 3, combat: true }, new Fader(3), 0.1), 'a fight on: shown');
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
  assert.deepEqual(migrateSettings({ showFps: true, music: 0.5 }), { music: 0.5, hudV: 1, hints: 'subtle', hintsV: 1 }, 'saved before: the old default goes');
  assert.deepEqual(migrateSettings({ showFps: true, hudV: 1, hints: 'full', hintsV: 1 }), { showFps: true, hudV: 1, hints: 'full', hintsV: 1 }, 'turned on since: kept');
  // the Steam Deck started on High before its own preset: Auto once; a lighter choice is kept
  assert.equal(migrateSettings({ hudV: 1, quality: 'high' }, { deck: true }).quality, 'auto');
  assert.equal(migrateSettings({ hudV: 1, quality: 'low' }, { deck: true }).quality, 'low');
  assert.equal(migrateSettings({ hudV: 1, quality: 'high', deckV: 1 }, { deck: true }).quality, 'high', 'chosen again since: kept');
  assert.equal(migrateSettings({ hudV: 1, quality: 'high' }).quality, 'high', 'elsewhere: untouched');
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

// ---- the scout finds the objective: on foot and riding, R3 with no foe in reach

test('R3 sends the scout on foot and riding when there is no foe to lock on to; Q on the keyboard and the touch "ping" too', () => {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = []; let ctx = 'game';
  const c = new Controller({ pads: () => [pad], context: () => ctx, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {} });
  const tap = (i) => { pad.buttons[i] = { pressed: true, value: 1 }; c.update(0.016); pad.buttons[i] = { pressed: false, value: 0 }; c.update(0.016); };
  tap(11); assert.deepEqual(actions, ['lock'], 'on foot');
  ctx = 'ride'; c.update(0.016); tap(11); assert.deepEqual(actions, ['lock', 'lock'], 'riding (a bike, the bird: flying too)');
  ctx = 'photo'; c.update(0.016); tap(11); assert.equal(actions.length, 2, 'not in photo mode');
  tap(3); assert.equal(actions.length, 2, 'Y / △ is the whistle\'s: it never pings');
  const main = src('src/main.js');
  assert.match(main, /e\.code === 'KeyQ' && !e\.repeat && !busy\(\) && !photo\.on && !ship\.playing\) scout\.ping\(\)/);
  assert.match(main, /const had = foes\.lock;\s*if \(!foes\.cycleLock\(\) && !had && !minigame\) scout\.ping\(\);/, 'R3: nothing to lock on to, the scout');
  assert.match(src('src/ui.js'), /data-press="KeyQ" class="b-ping"/);
  // what it found: the cue, at once, and the quest marker for a while; nothing to find: a shrug, said
  // (said at the ping, issue #65: not when the drone gets there; and its distance as it is every frame: findLine)
  assert.match(main, /onPing: \(target\) => scoutSays\(findLine\(target\), FIND\.say \+ FIND\.seek, 'quest'\)/);
  assert.match(main, /onFind: \(target\) => \{ scoutSays\(findLine\(target\), FIND\.say, 'quest'\); storyRt\.marker\.reveal\(\); \}/);
  assert.match(main, /return findSummary\(\{ goal: findGoal\(t\), step: findText\(\{ \.\.\.t, rise \}, player\.pos\.distanceTo\(t\.position\)\) \}\);/);
  assert.match(main, /onShrug: \(\) => scoutSays\(guardianHint\(level\.temple\) \? '◇ …' : 'Nothing to find here', 2\.5\)/, 'in a fight with no hint open yet, it only watches');
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

test('the scout\'s find says the current quest as its overall goal over its next step, nothing more', () => {
  // one short line (issue #72): the goal is the quest log's, not the cue's
  assert.equal(findSummary({ goal: 'Wake your ship with the fire of Qanat’s great tree', step: 'The dry well · 320 m' }), '◆ The dry well · 320 m');
  assert.equal(findSummary({ step: 'Back to the ship · 80 m' }), '◆ Back to the ship · 80 m', 'no goal (the ship): the step alone');
  // the cue draws the one line (escaped)
  const el = { innerHTML: '', classList: { s: new Set(), toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); }, contains(c) { return this.s.has(c); } } };
  const cue = new Cue(el);
  cue.set(findSummary({ goal: 'Mend Mira’s clock', step: '<Mira> · 12 m' }), 'quest');
  assert.doesNotMatch(el.innerHTML, /goal|Mend/, 'no goal line');
  assert.match(el.innerHTML, /◆ &lt;Mira&gt; · 12 m/);
  assert.ok(el.classList.contains('quest') && el.classList.contains('show'));
  cue.set('E go aboard');
  assert.ok(!el.classList.contains('quest'), 'a prompt is a prompt again');
  // as the quest moves on, the find says the new step under the same goal: no steps done, no log
  const flags = {}, game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, emit() {} };
  const q = new Quests({ game });
  q.define({ id: 'desert.power', title: 'The Tree That Drinks', main: true, stages: [{ id: 'a', text: 'Walk to Qanat', label: 'Qanat', at: [0, 0, 0] }, { id: 'b', text: 'Listen at the dry well', label: 'The dry well', at: [5, 0, 0] }] });
  q.start('desert.power');
  const say = () => findSummary({ goal: q.goal(q.objective().quest), step: q.objective().label });
  assert.equal(say(), '◆ Qanat');
  q.advance('desert.power');
  assert.equal(say(), '◆ The dry well');
  assert.doesNotMatch(say(), /Qanat\n|Walk to Qanat/, 'the step done is gone');
  const main = src('src/main.js');
  assert.match(main, /findSummary\(\{ goal: findGoal\(t\), step: findText\(/);
});

test('the Start menu opens the game menu on its Items and Quests, has a Controls page, and H opens Controls', async () => {
  const ui = src('src/ui.js'), main = src('src/main.js');
  assert.match(ui, /<button data-a="book" data-panel="items">\$\{t\('menu\.items'\)\}\$\{F\}<\/button><button data-a="book" data-panel="quests">\$\{t\('menu\.quests'\)\}\$\{F\}<\/button>/);   // (F: the confirm glyph on the focused entry, src/pad-glyphs.js)
  assert.match(ui, /if \(a === 'book'\) \{ this\.toggle\(false\); onBook\?\.\(at\.dataset\.panel\); \}/);
  assert.match(ui, /go\('controls', t\('menu\.controls'\)\)/);
  assert.doesNotMatch(ui, /questlog/, 'no quest log page of its own any more');
  assert.match(ui, /e\.code === 'KeyH' && !isBusy\(\)\) \{ if \(this\.open && this\.current === 'controls'\) this\.toggle\(false\); else this\.toggle\(true, 'controls'\); \}/);
  assert.match(main, /onBook: \(panel\) => journal\.toggle\(true, panel\)/);
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
  assert.ok(L.pad.some(([what, how]) => /scout finds/.test(what) && /R3/.test(how)));
  assert.ok(L.keyboard.some(([what, how]) => /scout finds/.test(what) && how === 'Q'));
  assert.ok(L.touch.some(([what, how]) => /scout finds/.test(what) && how === 'ping'));
  const html = controlsHtml(L, 'touch');
  assert.ok(html.indexOf('<h2>Touch</h2>') < html.indexOf('<h2>Controller</h2>'), 'a touch screen: its controls first');
});
