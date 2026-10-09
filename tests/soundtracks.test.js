import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSoundtrack, loadSoundtrack, SOUNDTRACKS } from '../src/soundtracks.js';
import { AudioContext } from '../engine/webaudio.js';
import { statSync } from 'node:fs';

test('recordings join the tail to the opening and balance loudness', () => {
  const ctx = new AudioContext({ sampleRate: 100 });
  const original = ctx.createBuffer(2, 1000, 100);
  for (let ch = 0; ch < 2; ch++) original.getChannelData(ch).fill(0.5);
  const result = prepareSoundtrack(ctx, original);
  assert.equal(result.length, 800);
  assert.equal(result.numberOfChannels, 2);
  assert.ok(Math.abs(result.getChannelData(0)[0] - 10 ** (-27 / 20)) < 1e-6);
  assert.equal(original.getChannelData(0)[0], 0.5);
});

test('title screen and unmapped levels do not fetch music', async () => {
  const fail = () => { throw new Error('unexpected fetch'); };
  assert.equal(await loadSoundtrack({ score: false, levelId: 'desert' }, fail), false);
  assert.equal(await loadSoundtrack({ score: true, levelId: 'lab' }, fail), false);
});

test('a disposed world never starts a recording after its download', async () => {
  const sound = { score: true, levelId: 'desert', _disposed: true, ctx: { decodeAudioData: async () => ({}) } };
  assert.equal(await loadSoundtrack(sound, async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })), false);
  assert.equal(sound.recordedTrack, undefined);
});

test('registered soundtracks are packaged audio files', () => {
  for (const file of Object.values(SOUNDTRACKS)) assert.ok(statSync(new URL(`../public/music/${file}`, import.meta.url)).size > 100000);
});

// The named worlds exclude development fixtures such as the Lab and Arena.
test('every playable world has exactly one packaged soundtrack and source record', async () => {
  const { TITLES } = await import('../src/levels/names.js');
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(SOUNDTRACKS).sort(), Object.keys(TITLES).sort());
  assert.deepEqual(manifest.tracks.map(t => t.level).sort(), Object.keys(TITLES).sort());
  for (const track of manifest.tracks) {
    assert.equal(track.file, SOUNDTRACKS[track.level]);
    assert.match(track.source, /^https:\/\/suno\.com\/song\/[a-f0-9-]{36}$/);
    assert.ok(track.direction.length > 20);
  }
});

test('an unavailable download keeps the procedural score active', async () => {
  const sound = { score: true, levelId: 'desert', ctx: {} };
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await loadSoundtrack(sound, async () => ({ ok: false, status: 404 })), false);
    assert.equal(sound.recordedTrack, undefined);
  } finally { console.warn = warn; }
});

// A cue is not a world's theme: played once at a moment (the singing light's theme in the prologue). Its slot
// is ready before its recording: the game sings the synth version until the file is there.
test('the cues: each has its slot and its record; a missing recording keeps the synth', async () => {
  const { CUES, loadCue } = await import('../src/soundtracks.js');
  const { readFileSync, existsSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(CUES), manifest.cues.map((c) => c.cue));
  for (const c of manifest.cues) {
    assert.equal(c.file, CUES[c.cue]);
    assert.ok(c.direction.length > 20);
    if (c.source) {
      assert.match(c.source, /^https:\/\/suno\.com\/song\/[a-f0-9-]{36}$/);
      assert.ok(existsSync(new URL(`../public/music/${c.file}`, import.meta.url)), `${c.file}: recorded, so packaged`);
    }
  }
  const sound = { ctx: { decodeAudioData: async () => { throw new Error('not audio'); } } };
  const page = async () => ({ ok: true, headers: { get: () => 'text/html' }, blob: async () => new Blob(['<html>']) });
  assert.equal(await loadCue(sound, 'singing-light', page, { here: null, store: null }), false, 'a dev server’s page is not the file');
  assert.equal(sound.cues, undefined);
});

// The title screen's own recording (manifest.json "title"): it takes over from the procedural menu music once it
// has loaded; until then, and whenever it can't load or decode, the procedural tune plays.
test('the title\'s recording: its record, its file, carried by the devices', async () => {
  const { TITLE_THEME } = await import('../src/soundtracks.js');
  const { ON_DEVICE_THEMES } = await import('../src/music-store.js');
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.title.file, TITLE_THEME);
  assert.equal(manifest.title.title, 'Hiraeth - Distant Home');
  assert.ok(manifest.title.source === null || /^https:\/\/suno\.com\/song\/[a-f0-9-]{36}$/.test(manifest.title.source));
  assert.ok(manifest.title.direction.length > 20);
  assert.ok(statSync(new URL(`../public/music/${TITLE_THEME}`, import.meta.url)).size > 100000);
  assert.ok(ON_DEVICE_THEMES.includes(TITLE_THEME), 'the first thing a launch plays: in the package, not downloaded');
  assert.ok(!Object.values(SOUNDTRACKS).includes(TITLE_THEME), 'not a world\'s theme');
  const title = readFileSync(new URL('../src/title.js', import.meta.url), 'utf8');
  assert.match(title, /new Sound\('title', \{ score: false, titleTheme: true \}\)/);
});

test('loadTitleTheme hands the balanced, looped recording over; a failure keeps the procedural tune', async () => {
  const { loadTitleTheme, TITLE_THEME } = await import('../src/soundtracks.js');
  const ctx = new AudioContext({ sampleRate: 100 });
  const decoded = ctx.createBuffer(2, 1000, 100);
  for (let ch = 0; ch < 2; ch++) decoded.getChannelData(ch).fill(0.5);
  const file = async (url) => ({ ok: true, url, headers: { get: () => 'audio/mpeg' }, blob: async () => new Blob(['mp3']) });
  const urls = [];
  const fetcher = async (url, o) => { urls.push(url); return file(url, o); };
  const given = [];
  const sound = { ctx: { state: 'running', decodeAudioData: async () => decoded, createBuffer: (...a) => ctx.createBuffer(...a) }, playTitleTheme: (b) => (given.push(b), true) };
  assert.equal(await loadTitleTheme(sound, fetcher, { here: null }), true);
  assert.ok(urls[0].endsWith(`music/${TITLE_THEME}`), urls[0]);
  assert.equal(given.length, 1);
  assert.equal(given[0].length, 800, 'the last two seconds joined to the opening');
  assert.ok(Math.abs(given[0].getChannelData(0)[0] - 10 ** (-27 / 20)) < 1e-6, 'balanced like the worlds\' themes');

  const warn = console.warn;
  console.warn = () => {};
  try {
    const none = [];
    const quiet = { ctx: { state: 'running', decodeAudioData: async () => { throw new Error('not audio'); } }, playTitleTheme: (b) => none.push(b) };
    assert.equal(await loadTitleTheme(quiet, fetcher, { here: null }), false, 'a file that doesn\'t decode');
    assert.equal(await loadTitleTheme({ ...quiet, ctx: new AudioContext({ sampleRate: 100 }) }, fetcher, { here: null }), false, 'an engine bridge without a decoder');
    assert.equal(await loadTitleTheme({ ...sound, playTitleTheme: (b) => none.push(b) }, async () => ({ ok: false, status: 404 }), { here: null }), false, 'a failed download');
    const page = async () => ({ ok: true, headers: { get: () => 'text/html' }, blob: async () => new Blob(['<html>']) });
    assert.equal(await loadTitleTheme({ ...sound, playTitleTheme: (b) => none.push(b) }, page, { here: null }), false, 'a dev server\'s page is not the file');
    assert.equal(await loadTitleTheme({ ...sound, _disposed: true, playTitleTheme: (b) => none.push(b) }, fetcher, { here: null }), false, 'the title is gone');
    assert.equal(none.length, 0);
  } finally { console.warn = warn; }
});

test('the title\'s recording takes over from the procedural tune on the menu bus, faded, once', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const { Sound } = await import('../src/audio.js');
  const ctx = new AudioContext({ sampleRate: 8000 });
  const s = Object.create(Sound.prototype);
  Object.assign(s, { ctx, menuOn: false, musicVol: 0.8, master: ctx.createGain(), world: ctx.createGain(), reverb: ctx.createConvolver() });
  s.menuSchedule = () => {};   // (the tune's notes themselves: tests/menus.test.js)
  const buffer = ctx.createBuffer(2, 8000, 8000);
  s.menuMusic(true);
  assert.ok(s.menuTimer, 'the procedural tune plays until the recording is ready');
  assert.equal(s.menuSynth.gain.value, 1);
  assert.equal(s.playTitleTheme(buffer), true);
  assert.equal(s.titleTrack.buffer, buffer);
  assert.equal(s.titleTrack.loop, true, 'looped (its tail is joined to its opening)');
  assert.equal(s.playTitleTheme(buffer), false, 'once');
  t.mock.timers.tick(2600);
  assert.equal(s.menuTimer, null, 'the tune stops once it has faded out under the recording');
  s.menuMusic(true);
  assert.equal(s.menuTimer, null, 'and doesn\'t come back over it');
  // the title leaving: the bus fades out (and the sound is disposed); a recording arriving then doesn't start
  s.menuMusic(false);
  const late = Object.create(Sound.prototype);
  Object.assign(late, { ctx, menuOn: false, musicVol: 0.8, master: ctx.createGain(), world: ctx.createGain(), reverb: ctx.createConvolver() });
  assert.equal(late.playTitleTheme(buffer), false, 'no menu up: nothing starts');
  late.menuOn = true; late._disposed = true;
  assert.equal(late.playTitleTheme(buffer), false, 'disposed: nothing starts');
});
