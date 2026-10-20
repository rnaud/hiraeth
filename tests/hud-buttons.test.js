// Issue #570: the HUD's own buttons for a pointer (src/hud-buttons.js). The page's minigames have a pause button (top right,
// shown with the mouse or a finger, gone with a pad in hand); Unity's HUD (BridgeHud.cs) took no pointer at all, so it had
// none. Now the engines publish the button as the screen's 'buttons' part under the page's rule, hit-test a press against
// it and pause as Start / Menu does (engine/game.js pointer), and BridgeHud draws it and hands it the mouse's and the
// fingers' presses through the Input System (BridgeHud.Pointer.cs, BridgeHost.Pointer). The C# isn't compiled here: its
// structure is checked, and the Unity batch run's -pointer plan presses it for real (docs/systems/engine-bridge.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PAUSE_BUTTON, typeS, hudButtons, buttonBox, hitHudButton, pressHudButton, parsePresses } from '../src/hud-buttons.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the pause button is where the page\'s is, and hidden with a pad in hand as the page hides it (minigames.css)', () => {
  const css = read('src/minigames/kit/minigames.css');
  const rule = css.match(/#minigame \.mg-pause \{([^}]*)\}/)[1];
  assert.match(rule, new RegExp(`right: ${PAUSE_BUTTON.right}px`));
  assert.match(rule, new RegExp(`top: ${PAUSE_BUTTON.top}px`));
  assert.match(rule, new RegExp(`width: ${PAUSE_BUTTON.em}em; height: ${PAUSE_BUTTON.em}em`));
  assert.match(rule, /border-radius: 50%/);
  assert.match(rule, /opacity: 0\.6/);
  assert.match(css, /body\.controller #minigame \.mg-pause \{ display: none; \}/, 'a pad in hand hides it');
  assert.match(css, /#minigame \{[^}]*font: var\(--type-s\)/, 'its em is --type-s');
  assert.match(read('index.html'), /--type-s: calc\(clamp\(13px, 1\.9vh, 28px\) \* var\(--ts, 1\)\)/, 'typeS mirrors --type-s');
  assert.equal(typeS(720), 720 * 0.019);
  assert.equal(typeS(400), 13);
  assert.equal(typeS(2000), 28);
  // (the page's own button, clicked: the same pause)
  assert.match(read('src/minigames/kit/runner.js'), /\.mg-pause'\)\.addEventListener\('click', \(e\) => \{ e\.stopPropagation\(\); this\.setPaused\(!this\.paused\); \}\)/);
});

test('hudButtons: the pause while a run is on, with the mouse or a finger; none with a pad in hand', () => {
  assert.deepEqual(hudButtons({}, { kind: 'keys' }), [], 'no run');
  assert.deepEqual(hudButtons({ minigame: null }, { kind: 'touch' }), []);
  assert.deepEqual(hudButtons({ minigame: { on: true } }, { kind: 'pad' }), [], 'a pad in hand');
  for (const kind of ['keys', 'touch']) {
    const [b, ...rest] = hudButtons({ minigame: { on: false } }, { kind });
    assert.equal(rest.length, 0);
    assert.deepEqual(b, { id: 'pause', right: 16, top: 64, size: 35.6 }, kind);
  }
  // (sized in em, as the page's: the Text size setting with it)
  assert.equal(hudButtons({ minigame: {} }, { kind: 'keys', ts: 1.45 })[0].size, 51.6);
  // (under a menu or a run's card: still drawn, under it, no hover)
  assert.equal(hudButtons({ minigame: {} }, { kind: 'keys', under: true })[0].under, true);
  assert.deepEqual(buttonBox(hudButtons({ minigame: {} })[0], 1280), { x: 1280 - 16 - 35.6, y: 64, w: 35.6, h: 35.6 });
});

test('hitHudButton: a press inside the round button, by the screen\'s width; its corners and the rest miss', () => {
  const bs = hudButtons({ minigame: {} }, { kind: 'keys' });
  const W = 1280, { x, y, w } = buttonBox(bs[0], W), cx = x + w / 2, cy = y + w / 2;
  assert.equal(hitHudButton(bs, cx, cy, W), 'pause');
  assert.equal(hitHudButton(bs, cx + w / 2 - 0.5, cy, W), 'pause', 'its edge');
  assert.equal(hitHudButton(bs, x + 1, y + 1, W), null, 'its box\'s corner: round, as the page\'s');
  assert.equal(hitHudButton(bs, cx, cy + w, W), null, 'under it');
  assert.equal(hitHudButton(bs, 640, 360, W), null, 'the middle of the screen');
  // (on the batch's 4:3 canvas, 960 wide: at its own right edge)
  assert.equal(hitHudButton(bs, 960 - 16 - w / 2, cy, 960), 'pause');
  assert.equal(hitHudButton(bs, cx, cy, 960), null);
  assert.equal(hitHudButton(null, cx, cy, W), null);
  assert.equal(hitHudButton([], cx, cy, W), null);
  assert.equal(hitHudButton(bs, NaN, cy, W), null);
});

test('pressHudButton: the pause is Start / Menu\'s (the runner\'s padAction), turned down when the run has a card up', () => {
  const asked = [];
  assert.equal(pressHudButton('pause', { trials: { padAction: (n) => { asked.push(n); return true; } } }), true);
  assert.deepEqual(asked, ['start']);
  assert.equal(pressHudButton('pause', { trials: { padAction: () => false } }), false, 'a menu or a card up: engine/trials.js says no');
  assert.equal(pressHudButton('pause', {}), false, 'no run');
  assert.equal(pressHudButton('other', { trials: { padAction: () => true } }), false);
});

test('parsePresses: BridgeHost.Pointer\'s presses', () => {
  assert.deepEqual(parsePresses(''), []);
  assert.deepEqual(parsePresses(null), []);
  assert.deepEqual(parsePresses('mouse,1236.2,81.8,1280,0;touch,10,20,960,0;mouse,5,6,1280,2'),
    [{ kind: 'mouse', x: 1236.2, y: 81.8, w: 1280, button: 0 }, { kind: 'touch', x: 10, y: 20, w: 960, button: 0 }, { kind: 'mouse', x: 5, y: 6, w: 1280, button: 2 }]);
  assert.deepEqual(parsePresses('pen,1,2,3,0;mouse,,2,3,0;mouse,1,2,0,0;mouse,1,2'), [], 'nothing it can\'t place');
});

// ------------------------------------------------------------------ the engines' game: the press as a player's

const PADS = [];
const button = (on) => ({ pressed: on, touched: on, value: on ? 1 : 0 });
const pad = (pressed = []) => ({ id: 'test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: Array.from({ length: 17 }, (_, i) => button(pressed.includes(i))), axes: [0, 0, 0, 0] });
let B = null;
async function load() {
  if (B) return B;
  const { bundle } = await import('../scripts/engine-bundle.mjs');
  const { loadBundle } = await import('../engine/vm-run.mjs');
  const { tempPath } = await import('../scripts/temp-dirs.mjs');
  const file = tempPath(join(tmpdir(), `hiraeth-hud-buttons-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  B = loadBundle(file, { pads: () => PADS });
  return B;
}
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames) => quietly(() => { for (let i = 0; i < frames; i++) g.frame(1 / 30); });
const plain = (x) => JSON.parse(JSON.stringify(x ?? null));

test('in the engines\' game: the button up in the pirates, a press on it pauses as Menu does, a pad hides it and a press brings it back', async () => {
  globalThis.matchMedia ??= () => ({ matches: false });
  globalThis.window ??= new EventTarget();
  const { EngineMenus } = await import('../engine/menus.js');
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const g = await quietly(() => X.createGame({ levelId: 'desert', game: 'pirates', from: 'desert', backend: new Proxy({}, { get: (t, k) => (['photo', 'then', 'shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices'].includes(k) ? undefined : () => {}) }), menus }));
  try {
    await run(g, 2);
    // (on the way somewhere the pirates have no start card: the run counts in at once, def.direct; the button up from then)
    const W = 1280, at = () => { const [b] = plain(g.screen().state.buttons) ?? []; const box = b && buttonBox(b, W); return box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : null; };
    assert.ok(at(), 'the button with the keys in hand');
    await run(g, 120);
    const R = g.trials.runner;
    assert.equal(R.phase, 'play');
    // a press elsewhere, or the camera's right button on it: left alone
    const p = at();
    assert.equal(g.pointer({ kind: 'mouse', x: 640, y: 360, w: W, button: 0 }), false);
    assert.equal(g.pointer({ kind: 'mouse', ...p, w: W, button: 2 }), false, 'the right button turns the camera');
    assert.equal(R.paused, false);
    // a pad pressed: in hand, the button gone; a press where it was does nothing but bring it back (the page's pointerdown)
    PADS.push(pad([8])); await run(g, 2); PADS[0] = pad(); await run(g, 2);
    assert.equal(g.inputKind, 'pad');
    assert.equal(g.screen().state.buttons, null, 'none with a pad in hand');
    assert.equal(g.pointer({ kind: 'touch', ...p, w: W, button: 0 }), false);
    assert.equal(R.paused, false, 'a hidden button takes nothing');
    await run(g, 1);
    assert.equal(g.inputKind, 'keys', 'the screen in hand (an engine has no touch layout: src/input-mode.js)');
    assert.ok(at(), 'back');
    // pressed: paused, as Menu: the pause card up (engine/menus.js card), the run held
    assert.equal(g.pointer({ kind: 'mouse', ...at(), w: W, button: 0 }), true);
    assert.equal(R.paused, true);
    await run(g, 2);
    assert.equal(menus.mode, 'card');
    assert.equal(R.cardModel?.kind, 'paused');
    assert.equal(plain(g.screen().state.buttons)?.[0]?.under, true, 'drawn under the card');
    assert.equal(g.pointer({ kind: 'mouse', ...at(), w: W, button: 0 }), false, 'the card up: the button under it takes nothing');
    assert.equal(R.paused, true);
    menus.key('Enter');   // (Resume)
    await run(g, 2);
    assert.equal(R.paused, false);
  } finally {
    PADS.length = 0;
    await quietly(() => g.trials?.runner?.end());
  }
  assert.equal(g.screen().state.minigame, null);
  await run(g, 1);
  assert.equal(g.screen().state.buttons, null, 'gone with the run');
});

test('Unity\'s HUD takes the mouse and the fingers through the Input System, and draws the button from the part (BridgeHud.Pointer.cs)', () => {
  const hud = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  const ptr = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Pointer.cs');
  const host = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  const game = read('engine/unity/game.js');
  // each frame: the presses read before the HUD is drawn; the part drawn with the minigame's HUD
  assert.match(hud, /void Update\(\) \{ PollPointer\(\);/);
  assert.match(hud, /DrawButtons\(state\.L\("buttons"\)\);/);
  // the Input System's current mouse and touch screen, pressed this frame; one press a frame for a finger and the mouse
  const poll = ptr.slice(ptr.indexOf('void PollPointer()'), ptr.indexOf('// ----', ptr.indexOf('void PollPointer()')));
  assert.match(poll, /Touchscreen\.current/);
  assert.match(poll, /primaryTouch\.press\.wasPressedThisFrame/);
  assert.match(poll, /Mouse\.current/);
  assert.match(poll, /leftButton\.wasPressedThisFrame\) BridgeHost\.PointerPress\("mouse", mp, W, 0\)/);
  assert.match(poll, /rightButton\.wasPressedThisFrame\) BridgeHost\.PointerPress\("mouse", mp, W, 2\)/);
  assert.match(poll, /BridgeHost\.PointerPress\("touch", tp, W, 0\); took = true;/);
  assert.match(poll, /if \(!took && on && m\.leftButton/);
  // (nothing taken from the camera or the pads: the right button's look and the pad are read as before)
  assert.doesNotMatch(ptr.replace(/\/\/.*$/gm, ''), /ReadMouseLook|Gamepad\.current|\.ReadPad\(/);
  assert.match(host, /if \(m == null \|\| !m\.rightButton\.isPressed\) return null;/);
  // placed as the HUD's canvas covers the camera's view (ToCanvas), the canvas' px from its top left
  assert.match(ptr, /cam\.ScreenToViewportPoint[\s\S]*p = new Vector2\(vp\.x \* W, \(1 - vp\.y\) \* H\);/);
  assert.match(hud, /return new Vector2\(vp\.x \* W, \(1 - vp\.y\) \* H\);/, 'as the world\'s points are placed');
  // drawn as the page's: right and top from the part, the disc, the bars, 0.6 and 1 under the mouse
  assert.match(ptr, /x = W - pause\.F\("right", 16\) - size, y = pause\.F\("top", 64\)/);
  assert.match(ptr, /Ui\.Panel\(root, "pause button", BtnPaper, Ui\.Ink, 2, 0, 0, radius\)/);
  assert.match(ptr, /BuildButtons\(Mathf\.CeilToInt\(size \/ 2\)\)/, 'round: its radius half its size');
  assert.match(ptr, /Ui\.Hex\("#f7ecd2", 0\.75f\)/);
  assert.match(ptr, /Ui\.Alpha\(btnPause\.rt, over \? 1 : 0\.6f\)/);
  assert.match(ptr, /bool over = hoverAt\.HasValue && !\(pause\.Get\("under"\) is bool u && u\)/);
  // to the script: queued on the main thread, taken with the frame's input (Snapshot), a few kept at most
  assert.match(host, /pointer = TakePointer\(\);/);
  assert.match(host, /public static string Pointer\(\) => OnMain \? TakePointer\(\) : pointer;/);
  assert.match(host, /if \(presses\.Count < MaxPresses\) presses\.Add\(e\);/);
  assert.match(game, /for \(const p of parsePresses\(host\.Pointer\?\.\(\)\)\) if \(!took\) took = game\.pointer\(p\);/);
  assert.match(game, /readPad\(\);\n  readPointer\(game\);\n  const look = host\.MouseLook\(\);/, 'each frame with the keys and the pad');
  // a batch run's press: through the Input System's own devices
  assert.match(ptr, /InputSystem\.AddDevice<Mouse>/);
  assert.match(ptr, /InputSystem\.AddDevice<Touchscreen>/);
  assert.match(ptr, /InputSystem\.QueueStateEvent\(simMouse, new MouseState \{ position = sp \}\.WithButton\(MouseButton\.Left, true\)\)/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeArgs.cs'), /args\["pointer"\] = Arg\("-pointer"\)/);
});
