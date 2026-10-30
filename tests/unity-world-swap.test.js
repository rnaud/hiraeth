// Issue #792: in the Unity bridge a trip between worlds swaps the world in place, as the web's does since #790
// (src/world-travel.js, docs/systems/world-swap.md): the Unity bundle run in a bare V8 context against a stand-in of the
// C# host (as tests/engine-unity.test.js), on a -trip from one world to another. No reboot (BridgeHost.Reboot) and no
// second start of the script; BridgeHost.SwapWorld told once, between the last world's ops and the next's; the sound's
// one context carried over, its clock going on; the music's voices (BridgeMusic's natives) of the first world still
// sounding into the second, fading as the next world's theme comes up; the last world's scope let go.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { runInContext } from 'node:vm';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { AudioReplay } from '../engine/webaudio.js';
import { tempPath } from '../scripts/temp-dirs.mjs';

const ROOT = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

/** The Unity bundle with a stand-in host that records what the bridge would do; `withSwap` false: an older player. */
async function runTrip({ trip, withSwap = true, frames = 6000, setFlags = null }) {
  const file = tempPath(join(tmpdir(), `hiraeth-unity-swap-${process.pid}-${withSwap ? 1 : 0}.js`));
  await bundle('unity', { out: [file] });
  const log = [], calls = { Create: 0, Frame: 0, swaps: [], reboots: [], exit: null, loading: [], screens: [] };
  let world = 0;   // (the worlds made: the ops after each SwapWorld are the next one's)
  const perWorld = [{ Create: 0, Frame: 0 }];
  const sound = { queued: 0, frames: 0, batches: 0 };
  const store = new Map();   // (BridgeStore: the saves, the journal of worlds seen)
  let clock = 0;   // (the host's clock, a frame's 1/30 s each: the timers' (a released sound's last stop) as the frames go)
  const replay = new AudioReplay(48000), ended = [];
  const music = { loads: [], natives: [] };
  const BridgeHost = {
    Now: () => clock, ReadFile: null, StorageGet: (k) => store.get(k) ?? null, StorageSet: (k, v) => { store.set(k, v); }, StorageRemove: (k) => { store.delete(k); },
    Geometry() {}, Material() {}, FaceKeys() {}, Cloth() {}, Cape() {}, CapeState: () => null, SetMesh() {},
    Create() { calls.Create++; perWorld[world].Create++; },
    Frame() { calls.Frame++; perWorld[world].Frame++; },
    Look() {}, Screen(json) { const w = JSON.parse(json).warp ?? null; calls.screens.push({ world, warp: w }); }, ApplyMs: () => 0, Keys: () => '', Menu() {}, MapImage() {}, AwayCount: () => 0,
    LoadStage() {}, LoadProgress() {}, Loading(on) { calls.loading.push({ on, world }); },
    MenuWidth: () => 1280, MenuMapBox: () => '', PadName: () => '', Platform: () => 'osx', Pad: () => null, MouseLook: () => null,
    Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0,
    Exit(code) { calls.exit = code; },
    Reboot(json) { calls.reboots.push(JSON.parse(json)); },
    AudioRate: () => 48000, AudioQueued: () => sound.queued,
    Audio(buf) { const f = new Float32Array(buf); sound.queued += f.length / 2; sound.frames += f.length / 2; },
    AudioThreaded: () => true,
    AudioBatch(buf) { sound.batches++; const r = replay.apply(new Float64Array(buf)); if (r.pcm.length) BridgeHost.Audio(r.pcm.slice().buffer); if (r.ended.length) ended.push(...r.ended); if (replay.natives) music.natives.push({ text: replay.natives, world, frame: calls.Frame }); },
    SfxLoad() { return 1; }, SfxState: () => 'ok,1,4800,48000', SfxTake: () => effects.pcm,
    MusicLoad(path) { music.loads.push(path); return music.loads.length; }, MusicState: () => `ok,2,${48000 * 120},48000`,
    AudioNatives() {}, MusicFetch() {},
    AudioEndedTake: () => { const s = ended.join(','); ended.length = 0; return s; },
  };
  if (withSwap) BridgeHost.SwapWorld = () => { calls.swaps.push({ frame: calls.Frame, nodes: perWorld[world].Create }); perWorld.push({ Create: 0, Frame: 0 }); world++; };
  const effects = {};
  const { exports, readFile, ctx } = loadBundle(file, {}, { CS: { Hiraeth: { Bridge: { BridgeHost } } }, setTimeout: undefined, setInterval: undefined, clearTimeout: undefined, clearInterval: undefined });
  effects.pcm = runInContext('new Float32Array(4800).fill(.01).buffer', ctx);
  BridgeHost.ReadFile = readFile;
  const errors = [];
  const keep = { warn: console.warn, info: console.info, log: console.log, error: console.error };
  console.warn = console.info = () => {};
  console.log = (...a) => { const t = a.map(String).join(' '); if (t.startsWith('[unity]')) log.push(t); };
  console.error = (...a) => errors.push(a.map(String).join(' ').slice(0, 400));
  try {
    exports.start(JSON.stringify({ trip, tripFrames: 90, tripSecs: 3, ...(setFlags ? { setFlags } : {}) }));
    for (let i = 0; i < frames && calls.exit === null && !calls.reboots.length; i++) {
      clock += 1000 / 30;
      exports.frame(1 / 30);
      sound.queued = Math.max(0, sound.queued - 1600);
      await new Promise((r) => (calls.Frame ? setImmediate(r) : setTimeout(r, 5)));
    }
  } finally { Object.assign(console, keep); }
  return { calls, perWorld, log, errors, music, sound };
}

/** BridgeMusic's lines (engine/webaudio.js nativeText): `id,clip,pos,gain,lowpass,loop,join,length` a source. */
const sources = (text) => text.split(';').filter(Boolean).map((l) => l.split(',').map(Number)).map(([id, clip, pos, gain]) => ({ id, clip, pos, gain }));

test('a trip between worlds and back in Unity swaps in place: no reboot, one sound context, the music carried over', async () => {
  const { calls, perWorld, log, errors, music } = await runTrip({ trip: 'arzach:lantern:arzach', setFlags: 'ship.powered' });
  assert.deepEqual(errors, [], errors.join('\n'));
  assert.equal(calls.reboots.length, 0, `no reboot: ${JSON.stringify(calls.reboots)}`);
  assert.equal(calls.exit, 0, `the trip ran to its end: ${log.join('\n')}`);
  assert.equal(calls.swaps.length, 2, JSON.stringify(calls.swaps));
  // both worlds mirrored, each into its own scene (the second's ops after SwapWorld)
  // (and the first world again, its cached materials and skeletons made anew in the new scene: engine/mirror.js)
  assert.ok(perWorld[0].Create > 50 && perWorld[1].Create > 20 && Math.abs(perWorld[2].Create - perWorld[0].Create) < perWorld[0].Create * 0.2, JSON.stringify(perWorld));
  assert.ok(perWorld[1].Frame >= 20 && perWorld[2].Frame >= 20, JSON.stringify(perWorld));
  // the loading screen up again for the next world's build, and down once it plays
  assert.deepEqual(calls.loading.map((l) => `${l.world}:${l.on}`), ['0:true', '0:false', '1:true', '1:false', '2:true', '2:false']);
  // the trip's own lines: the same context in both worlds, its clock going on
  const states = log.filter((l) => l.startsWith('[unity] trip: world '));
  assert.equal(states.length, 3, log.join('\n'));
  const ctxOf = (l) => Number(/context #(\d+)/.exec(l)[1]), clockOf = (l) => Number(/clock at ([\d.]+) s/.exec(l)[1]);
  assert.ok(states.every((l) => ctxOf(l) === ctxOf(states[0])), states.join('\n'));
  assert.ok(clockOf(states[2]) > clockOf(states[1]) && clockOf(states[1]) > clockOf(states[0]), states.join('\n'));
  assert.ok(log.some((l) => /world swap 1: .*arzach → lantern in place, the sound carried over \(let go: \d+ listeners, \d+ timers, \d+ frames, [1-9]\d* entries\)/.test(l)), log.join('\n'));
  assert.ok(log.some((l) => /world swap 2: .*lantern → arzach in place/.test(l)) && log.some((l) => /world swap 2: arzach built in \d+ ms, no reboot; the sound's context the same/.test(l)), log.join('\n'));
  assert.ok(log.some((l) => /world swap 1: lantern built in \d+ ms, no reboot; the sound's context the same/.test(l)), log.join('\n'));
  // the way back by the ship's take-off: its warp on the screen as the lantern was let go, and gone from the next
  // world's first state (src/platform.js screen reset), so the HUD fades it as the arrival begins
  assert.ok(log.some((l) => l === '[unity] trip: the ship takes off'), log.join('\n'));
  assert.ok(calls.screens.some((x) => x.world === 1 && x.warp), 'the warp up before the swap');
  assert.equal(calls.screens.find((x) => x.world === 2)?.warp, null, 'and not in the next world\'s first state');
  // the music: the first world's theme (its loudest source as the swap came) still sounding after it, the same source
  // going on (not started again), then faded out and stopped as the next world's theme comes up on the same context
  const at = (w) => music.natives.filter((n) => n.world === w).map((n) => sources(n.text));
  const last = at(0).at(-1), theme = last.reduce((a, b) => (b.gain > a.gain ? b : a));
  assert.ok(theme.gain > 0.01, `the first world's theme heard: ${JSON.stringify(last)}`);
  const after = at(1).map((l) => l.find((x) => x.id === theme.id) ?? null);
  assert.ok(after[0], 'the same source in the first lines after the swap, not a new one');
  assert.ok(after[0].pos >= theme.pos, `its place going on: ${theme.pos} → ${after[0].pos}`);
  assert.ok(after.at(-1) === null, 'and let go once the next world plays (faded, stopped)');
  const before = new Set(at(0).flat().map((x) => x.id));
  const fresh = at(1).at(-1).filter((x) => !before.has(x.id));
  assert.ok(fresh.some((x) => x.gain > 0.01), `the next world's theme up: ${JSON.stringify(at(1).at(-1))}`);
});

test('an older player without BridgeHost.SwapWorld starts the engine again, as before', async () => {
  const { calls, errors } = await runTrip({ trip: 'lantern:desert', withSwap: false, frames: 1500 });
  assert.deepEqual(errors, [], errors.join('\n'));
  assert.equal(calls.reboots.length, 1, JSON.stringify(calls));
  assert.deepEqual(calls.reboots[0].boot, { slot: calls.reboots[0].boot.slot, level: 'desert', arrive: true, via: 'ship', resolved: true });
});

test('every way to another world in the Unity bridge goes by goWorld; a plan\'s run and -reboot start the engine again', () => {
  const src = read('engine/unity/game.js');
  for (const fn of ['playGame', 'leaveGame', 'flyTo', 'pageTo']) {
    const body = src.slice(src.indexOf(`function ${fn}(`), src.indexOf('\n}\n', src.indexOf(`function ${fn}(`)));
    assert.match(body, /goWorld\(/, fn);
    assert.doesNotMatch(body, /host\.Reboot/, fn);
  }
  assert.match(src, /if \(!S\?\.game \|\| planned\(S\.args\) \|\| S\.args\.reboot \|\| !host\.SwapWorld\)/);
  // the C# side: the mirrored scene made anew, no scene load, the sound kept
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  const swap = runner.slice(runner.indexOf('public void SwapWorld()'), runner.indexOf('public static int Swaps'));
  assert.match(swap, /DestroyImmediate\(scene\.gameObject\)/);
  assert.match(swap, /AddComponent<BridgeRenderer>\(\)/);
  assert.doesNotMatch(swap, /LoadScene|js\?\.Dispose|audioOut\s*=|music\s*=/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs'), /public static void SwapWorld\(\) => On\(\(\) => Runner\?\.SwapWorld\(\)\);/);
});
