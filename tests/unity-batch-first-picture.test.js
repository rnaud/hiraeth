// Issue #798: a Unity batch run's first picture compiles the shader variants missing from Library/ShaderCache,
// synchronously (minutes on a new Library). It was read as a hang in the ink feature and killed, or the run's time
// limit ran out while the editor was busy. Source contracts; the batch run itself is checked by hand (unity-js-run.sh).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL(`../unity/Hiraeth/Assets/HiraethJS/${f}`, import.meta.url), 'utf8');

test('the batch limit moves on by a frame the editor was busy for, not counting it against the script', () => {
  const batch = src('Editor/BridgeBatch.cs');
  assert.match(batch, /const double BusyTick = 20;/);
  assert.match(batch, /gap = now - lastTick; lastTick = now;/);
  assert.match(batch, /if \(gap > BusyTick\) \{ started \+= gap;/, 'the deadline moved on by the busy frame');
  assert.match(batch, /if \(now - started > limit\) \{ Debug\.LogError\("Hiraeth bridge: timed out"\); EditorApplication\.Exit\(4\); \}/, 'a stuck script still times out');
});

test('the first picture in the editor says it compiles shader variants, and how long it took', () => {
  const runner = src('Runtime/BridgeRunner.cs');
  assert.match(runner, /bool firstPicture = Application\.isEditor && shots == 0;/);
  assert.match(runner, /if \(firstPicture\) Debug\.Log\(\$"Hiraeth bridge: the first picture \(.*not a hang\)"\);/);
  assert.match(runner, /if \(firstPicture\) Debug\.Log\(\$"Hiraeth bridge: the first picture drawn in /);
  assert.match(runner, /shots\+\+;/);
});
