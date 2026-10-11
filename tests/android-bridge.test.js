// The Unity bridge's player on a handheld (scripts/bench/android-bridge.sh, BridgeArgs.cs): its plan, -mute with
// it, must reach the player through the activity's `unity` extra (on the Retroid it didn't, and the player played
// the desert aloud: docs/systems/engine-bridge.md, "On the Retroid").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('android-bridge.sh passes the plan quoted, stops a player that did not read it, and refuses a locked screen', () => {
  const sh = read('scripts/bench/android-bridge.sh');
  assert.match(sh, /-e unity "'\$ARGS'"/, 'adb shell re-splits its words: the extra quoted for the device shell');
  assert.match(sh, /ARGS="-level \$LEVEL -mute /, 'always muted');
  assert.match(sh, /the plan from the intent: -level/);
  assert.match(sh, /am force-stop "\$PKG"\s*\n\s*echo "the player did not read its plan/);
  assert.match(sh, /grep -q "mIsShowing=true"/, 'the keyguard itself (showingAndNotOccluded stays true unlocked on the Retroid)');
  assert.match(sh, /the plan from the intent: -level\.\* -mute/, 'the plan it read must carry -mute');
  assert.match(sh, /^PKG=com\.rnaud\.memento\.bridge$/m, 'its own package, never the web game\'s');
});

test('android-bridge.sh stops a player whose audio stream starts; the bench\'s APK is built without Unity\'s audio', () => {
  const sh = read('scripts/bench/android-bridge.sh');
  const build = read('unity/Memento/Assets/MementoJS/Editor/BridgeBuild.cs');
  const checks = sh.match(/dumpsys audio \| grep "u\/pid:\$UID_\/" \| grep -q "state:started"/g) ?? [];
  assert.equal(checks.length, 2, 'once after the plan, then every 5 s while it runs');
  assert.match(sh, /am force-stop "\$PKG"\s*\n\s*echo "the player is playing sound despite -mute: stopped"/);
  assert.match(build, /if \(!release\) UnityAudio\(true\);/, 'only the bench build, not the testers\'');
  assert.match(build, /UnityAudio\(null\);\s*\n\s*Exit\(/, 'the project setting restored before the editor exits');
});

test('the bridge reads its arguments, the intent\'s on Android, in one place', () => {
  const args = read('unity/Memento/Assets/MementoJS/Runtime/BridgeArgs.cs');
  const runner = read('unity/Memento/Assets/MementoJS/Runtime/BridgeRunner.cs');
  assert.match(args, /public static string\[\] CommandLine\(\)/);
  assert.match(args, /#if UNITY_ANDROID && !UNITY_EDITOR[\s\S]*getStringExtra", "unity"[\s\S]*#endif/);
  assert.match(args, /Memento bridge: the plan from the intent: /);
  assert.ok(!/Environment\.GetCommandLineArgs\(\)/.test(runner), 'BridgeRunner reads BridgeArgs.CommandLine()');
  assert.match(runner, /bool mute = Application\.isBatchMode \|\| Array\.IndexOf\(BridgeArgs\.CommandLine\(\), "-mute"\) >= 0;/);
  // the reads outside CommandLine itself go through it
  const body = args.replace(/public static string\[\] CommandLine\(\)[\s\S]*?return line = a;\s*\}/, '');
  assert.ok(!/GetCommandLineArgs\(\)\s*[,;)]/.test(body.replace(/\/\/\/.*$/gm, '')), 'Arg, Flag and -freeze read CommandLine()');
});
