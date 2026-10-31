// Issue #803, the Unity-specific performance pass measured on the AYN Odin 3 (docs/systems/unity.md, "Unity's own
// switches on the Odin 3"): the bench's split that measured it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the bench\'s -split times the C# apply by op and the frame\'s threads', () => {
  const r = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
  const host = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  const game = read('engine/unity/game.js');
  assert.match(r, /public string TakeOpSplit\(\)/);
  assert.match(r, /OpTicks\[31\] \+= /, 'LateUpdate as "late"');
  assert.match(runner, /BridgeRenderer\.profileOps = BridgeArgs\.Flag\("-split"\);/);
  assert.match(runner, /mainMs = timing\[0\]\.cpuMainThreadFrameTime; renderMs = timing\[0\]\.cpuRenderThreadFrameTime;/);
  assert.match(host, /public static string ApplySplit\(\)/);
  assert.match(host, /public static double LastFrameMainMs\(\)/);
  // (an older player without them: the script asks with ?. and goes on)
  assert.match(game, /main: host\.LastFrameMainMs\?\.\(\) \?\? 0, render: host\.LastFrameRenderMs\?\.\(\) \?\? 0/);
  assert.match(game, /if \(S\.args\.split && host\.ApplySplit\)/);
  assert.match(game, /mainP95: q\('main', 0\.95\)/);
});
