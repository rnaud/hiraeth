// The Unity player's way out (issue #438: Steam's Exit Game hung on a black screen on the Deck): BridgeQuit.cs takes
// SIGTERM / SIGINT / SIGHUP, ends the process 2 s after a quit at the latest, and the bridge's frame stops waiting
// when a quit is asked. The C# isn't compiled here: its structure is checked (the Deck's runs are in docs/systems/unity.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const quit = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeQuit.cs');
const runner = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');

test('the signals Steam sends are the bridge\'s, on the Linux player only', () => {
  const linux = quit.indexOf('#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR');
  assert.ok(linux > 0);
  for (const s of ['SIGTERM', 'SIGINT', 'SIGHUP']) assert.match(quit, new RegExp(`foreach \\(int s in new\\[\\] \\{[^}]*${s}`));
  assert.match(quit, /\[AOT\.MonoPInvokeCallback\(typeof\(Handler\)\)\]\s*static void OnSignal/);
  // glibc's x86_64 struct sigaction: 152 bytes, the flags at 136
  assert.match(quit, /LayoutKind\.Explicit, Size = 152/);
  assert.match(quit, /\[FieldOffset\(136\)\] public int flags/);
  assert.ok(runner.includes('BridgeQuit.Install()'), 'installed at the runner\'s Start');
});

test('the handler only notes the signal, turns core dumps off and sets the last-resort alarm', () => {
  const body = quit.slice(quit.indexOf('static void OnSignal'), quit.indexOf('#else'));
  assert.doesNotMatch(body, /Debug\.|new |\$"/, 'nothing logged or allocated in the handler');
  assert.match(body, /PR_SET_DUMPABLE, 0/);
  assert.match(body, /alarm\(LastResortSeconds\)/);
  assert.match(quit, /public const uint LastResortSeconds = 2;/);
  assert.match(quit, /signal\(SIGALRM, IntPtr\.Zero\)/, 'SIGALRM at its default action: the process ends');
  // (each call the handler makes bound before a signal can come)
  const install = quit.slice(quit.indexOf('public static void Install'));
  assert.ok(install.indexOf('alarm(0)') < install.indexOf('sigaction('));
  assert.ok(install.indexOf('prctl(PR_GET_DUMPABLE') < install.indexOf('sigaction('));
});

test('every quit stops the threads, writes the saves, and ends at once when the script is mid-frame', () => {
  const q = quit.slice(quit.indexOf('static void Quitting'));
  assert.match(quit, /Application\.quitting \+= Quitting/);
  assert.ok(q.indexOf('StopThreads(') < q.indexOf('FlushStore()') && q.indexOf('FlushStore()') < q.indexOf('HardExit('));
  assert.match(runner, /public bool StopThreads\(int ms\)/);
  assert.match(runner, /internal static void HardExit\(int code\)/);
});

test('a quit asked is not waited out behind the script\'s frame', () => {
  const wait = runner.slice(runner.indexOf('bool Await('), runner.indexOf('bool Await(') + 600);
  assert.match(wait, /if \(BridgeQuit\.Asked != 0\) return true;/);
  const update = runner.slice(runner.indexOf('void Update()'), runner.indexOf('void Update()') + 800);
  assert.match(update, /if \(BridgeQuit\.Asked != 0\) \{ if \(!exiting\) Exit\(0\); return; \}/);
  assert.match(runner, /if \(BridgeQuit\.Asked != 0 && !exiting\) \{ Exit\(0\); return; \}/);
});
