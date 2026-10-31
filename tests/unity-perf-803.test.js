// Issue #803, the Unity-specific performance pass measured on the AYN Odin 3 (docs/systems/unity.md, "Unity's own
// switches on the Odin 3"): what was kept, what was measured and dropped, and the bench's split that measured it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the GPU Resident Drawer is off on Android too, as on the Xbox and the Linux player (-grd keeps it)', () => {
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /#if \(UNITY_WSA \|\| UNITY_STANDALONE_LINUX \|\| UNITY_ANDROID\) && !UNITY_EDITOR\s*\n\s*if \(urp != null && !BridgeArgs\.Flag\("-grd"\)\) urp\.gpuResidentDrawerMode = GPUResidentDrawerMode\.Disabled;/);
  // (every quality level draws with PC_RPAsset, the one with the drawer on: the switch is at run time, not in Mobile_RPAsset)
  const q = read('unity/Hiraeth/ProjectSettings/QualitySettings.asset');
  const pc = read('unity/Hiraeth/Assets/Settings/PC_RPAsset.asset.meta').match(/guid: (\w+)/)[1];
  const levels = q.match(/customRenderPipeline: \{fileID: 11400000, guid: (\w+)/g);
  assert.ok(levels.length >= 2 && levels.every((l) => l.includes(pc)), 'both quality levels on PC_RPAsset');
  assert.match(read('unity/Hiraeth/Assets/Settings/PC_RPAsset.asset'), /m_SupportsHDR: 0/, 'no HDR target (the cameras ask for none either)');
  for (const f of ['BridgeRunner.cs']) assert.match(read(`unity/Hiraeth/Assets/HiraethJS/Runtime/${f}`), /cam\.allowMSAA = false; cam\.allowHDR = false;/);
});

test('graphics jobs stay off on Android (measured: the Odin\'s GPU 0.6-3.9 ms slower a frame with them)', () => {
  const ps = read('unity/Hiraeth/ProjectSettings/ProjectSettings.asset');
  assert.doesNotMatch(ps, /m_BuildTarget: AndroidPlayer\s*\n\s*m_GraphicsJobs: 1/);
  // (a bench build can still have them: -graphics-jobs [-graphics-job-mode split|native|legacy])
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs'), /if \(Flag\("-graphics-jobs"\)\)/);
});

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
