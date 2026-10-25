// Native renderer source contracts; no world boot or VM is needed for these assertions.
// Actual loading progress, settings navigation and menu/VM behavior remain in their integration tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('native loading renderer preserves progress, layering and host reset contracts', () => {
  const runner = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs', import.meta.url), 'utf8');
  assert.match(runner, /\(!booted \|\| BridgeHost\.WorldLoading\) && !bootBlocking/, 'Unity draws on (the loading screen, the Xbox\'s pipelines warming) while the world builds');
  const hudLoad = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Loading.cs', import.meta.url), 'utf8');
  assert.match(hudLoad, /if \(world && !loadWorld\)/);
  assert.match(runner, /if \(yieldToLoad && BridgeHost\.WorldLoading\) \{ awaitYielded = true; return true; \}/, 'not waited out on the title as the build begins');
  assert.match(hudLoad, /overrideSorting = true/, 'over the title\'s canvas');
  // the C# draws it: the bar's red fill as far as BridgeHost.LoadP (eased, never past it), the why line from LoadWhy;
  // BridgeHost keeps the furthest and empties both as a load begins
  assert.match(hudLoad, /loadBarFill = Ui\.Rect\(loadBar, LoadNib/);
  assert.match(hudLoad, /loadShown = Mathf\.Min\(p, /);
  assert.match(hudLoad, /var why = BridgeHost\.LoadWhy/);
  const hostCs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs', import.meta.url), 'utf8');
  assert.match(hostCs, /public static void LoadProgress\(double p, string why\)\s*\{\s*if \(p > LoadP\)/);
  assert.match(hostCs, /public static void Loading\(bool on\) \{ if \(on\) LoadReset\(\);/);
});

test('native accessibility and rumble settings reach their renderer and host', () => {
  // BridgeHud honours them: the words' size, the plain background, the readout (engine/unity/game.js access)
  const g = src('engine/unity/game.js'), hud = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  assert.match(g, /state = \{ ts: TEXT_SIZES\[s\.textSize\] \?\? 1, solid: !!s\.speechBg, fps: !!s\.showFps \}/);
  assert.match(hud, /ts = Mathf\.Clamp\(acc\?\.F\("ts", 1\)/);
  assert.match(g, /playEffect\(kind, o = \{\}\) \{ host\.Rumble\(/, 'the pad\'s motors through BridgeHost.Rumble');
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs'), /g\.SetMotorSpeeds\(/);
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
