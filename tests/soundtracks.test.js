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
  const sound = { score: true, levelId: 'incal', _disposed: true, ctx: { decodeAudioData: async () => ({}) } };
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
  const worlds = Object.keys(TITLES).sort();
  assert.deepEqual(Object.keys(SOUNDTRACKS).sort(), worlds);
  assert.deepEqual(manifest.tracks.map(t => t.level).sort(), worlds);
  for (const track of manifest.tracks) {
    assert.equal(track.file, SOUNDTRACKS[track.level]);
    // a Suno song link; or, made by the author without one (the desert's, issue #207), the date and the prompt
    if (track.source === null) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(track.created) && track.prompt.length > 100 && track.note, track.level);
    else assert.match(track.source, /^https:\/\/suno\.com\/song\/[a-f0-9-]{36}$/);
    assert.ok(track.direction.length > 20);
  }
});

test('the desert\'s recording (issue #207): its own new name, its prompt recorded, carried by the devices', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url), 'utf8'));
  // (a new recording gets a new name: the kept copies and the caches key on it; the old D hijaz desert.mp3 is retired)
  assert.equal(SOUNDTRACKS.desert, 'desert-bayati.mp3');
  assert.ok(!Object.values(SOUNDTRACKS).includes('desert.mp3'));
  const t = manifest.tracks.find((x) => x.level === 'desert');
  assert.equal(t.title, 'Descent into D Bayati');
  assert.equal(t.created, '2026-10-12');
  assert.match(t.prompt, /D Bayati maqam[\s\S]*No drums, no percussion loops[\s\S]*Exclude: drums, darbuka, frame drum/);
  assert.match(t.note, /Suno/);
  const size = statSync(new URL('../public/music/desert-bayati.mp3', import.meta.url)).size;
  assert.ok(size > 2e6 && size < 6e6, `${size} bytes`);
  const { ON_DEVICE_THEMES } = await import('../src/music-store.js');
  assert.ok(ON_DEVICE_THEMES.includes('desert-bayati.mp3'), 'the first world\'s theme, offline from the first session');
});

test('an unavailable download keeps the procedural score active', async () => {
  const sound = { score: true, levelId: 'incal', ctx: {} };
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
  assert.match(title, /new Sound\('title', \{ score: false, titleTheme: true, autoStart: false \}\)/);
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

// Issue #471: every place the game takes you resolves to a recording that is there (the registry, its merged parts and
// sub-levels, the side worlds, home and the Lantern, the worlds a minigame is played in), and only the developers'
// worlds play the procedural score alone.
test('every level in the registry resolves to an existing recording, with its record and its engine level', async () => {
  const { LEVELS, levelById } = await import('../src/levels/index.js');
  const { ORDER, SIDE, SUB, MERGED, PARTS } = await import('../src/levels/names.js');
  const { THEME_LEVELS } = await import('../src/theme-levels.js');
  const { GAMES } = await import('../src/minigames/index.js');
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url), 'utf8'));
  const recorded = new Set(manifest.tracks.map((t) => t.file));
  const ids = new Set([
    ...LEVELS.filter((l) => !l.dev).map((l) => l.id), ...ORDER, ...SIDE, ...Object.keys(SUB), ...Object.values(SUB),
    ...Object.keys(MERGED), ...Object.values(PARTS).flat(), 'home', 'lantern',
    ...GAMES.map((g) => g.world).filter(Boolean),
  ]);
  assert.ok(ids.size >= 22, `${ids.size} places`);
  for (const id of ids) {
    // (the id a page's Sound is made with: main.js's levelById(...).id; a merged part's is the world it joined)
    const level = levelById(id);
    assert.ok(level, `${id}: a level`);
    const file = SOUNDTRACKS[level.id];
    assert.ok(file, `${id} (${level.id}): no recording in SOUNDTRACKS`);
    assert.ok(statSync(new URL(`../public/music/${file}`, import.meta.url)).size > 100000, `${id}: ${file} is not in public/music`);
    assert.ok(recorded.has(file), `${id}: ${file} has no record in manifest.json`);
    assert.ok(THEME_LEVELS[file] > 0, `${id}: ${file} has no level for the engines (scripts/theme-levels.mjs)`);
  }
  // (and the developers' worlds are the only levels without one)
  for (const l of LEVELS) if (!SOUNDTRACKS[l.id]) assert.ok(l.dev, `${l.id} plays no recording`);
});

/** A world's sound as loadSoundtrack sees it, on the in-memory Web Audio, its arrival moment long over. */
async function quietWorld(levelId = 'incal') {
  const { AudioContext } = await import('../engine/webaudio.js');
  const { MusicMoments } = await import('../src/music-moments.js');
  const ctx = new AudioContext({ sampleRate: 100 });
  ctx.decodeAudioData = async () => { const b = ctx.createBuffer(2, 1000, 100); b.getChannelData(0).fill(0.3); b.getChannelData(1).fill(0.3); return b; };
  const moments = new MusicMoments({ mode: 'moments', now: -10000, rand: () => 0.5 });
  moments.update(-10000 + 400);   // (the arrival over, the quiet's comeback drawn far ahead)
  return { score: true, levelId, ctx, music: ctx.createGain(), moments };
}
const missing = async () => ({ ok: false, status: 404 });
const ENGINE = { protocol: 'engine:', host: 'hiraeth' };

test('a theme an engine\'s player downloads takes over as soon as it is there (issue #471)', async () => {
  const sound = await quietWorld('incal');
  let asked = null;
  const wait = async (file, o) => { asked = file; assert.equal(o.gone(), false); return { arrayBuffer: async () => new ArrayBuffer(8) }; };
  // (an engine: its location is engine://, no IndexedDB, so no page store)
  assert.equal(await loadSoundtrack(sound, missing, { here: ENGINE, store: null, wait }), true);
  assert.equal(asked, 'incal.mp3');
  assert.equal(sound.trackFrom, 'site');
  assert.ok(sound.trackBuffer, 'the recording is ready');
  // and the moments bring it in now, not at the next moment minutes away
  assert.equal(sound.moments.playing(sound.ctx.currentTime), true, 'cued at once');
  assert.equal(sound.moments.why, 'arrival');
});

test('a page on a device: a download landing after the arrival hands over to the recording at once (issue #471)', async () => {
  const sound = await quietWorld('underwater');
  const downloader = { prefer() {}, arrived: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }) };
  const store = { get: async () => null, put: async () => {}, delete: async () => {} };
  assert.equal(await loadSoundtrack(sound, missing, { here: { protocol: 'hiraeth:', host: 'game' }, store, downloader }), true);
  assert.equal(sound.trackFrom, 'site');
  assert.equal(sound.moments.playing(sound.ctx.currentTime), true);
});

test('held back (the prologue\'s ship), a downloaded theme waits for the release', async () => {
  const sound = await quietWorld('desert');
  sound.themeHeld = true;
  const wait = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
  assert.equal(await loadSoundtrack(sound, missing, { here: ENGINE, store: null, wait }), true);
  assert.equal(sound.moments.playing(sound.ctx.currentTime), false);
});

test('the site reads its own files only: no wait there', async () => {
  const sound = await quietWorld('incal');
  const warn = console.warn; console.warn = () => {};
  try {
    const wait = async () => { throw new Error('the site never waits for a download'); };
    assert.equal(await loadSoundtrack(sound, missing, { here: { protocol: 'https:', host: 'hiraeth.example.org' }, wait }), false);
  } finally { console.warn = warn; }
});

test('Unity\'s wait looks again until its player has downloaded the theme, and stops when the world is gone', async () => {
  const { themeArrival } = await import('../engine/unity/music.js');
  let tries = 0;
  const fetcher = async (url) => {
    assert.match(String(url), /music\/spheres\.mp3$/);
    return ++tries < 3 ? { ok: false, status: 404 } : { ok: true, headers: { get: () => 'audio/mpeg' }, blob: async () => ({ size: 9 }) };
  };
  const wait = themeArrival({ fetcher, every: 0, sleep: async () => {} });
  assert.deepEqual(await wait('spheres.mp3', {}), { size: 9 });
  assert.equal(tries, 3);
  let gone = false;
  const never = themeArrival({ fetcher: missing, sleep: async () => { gone = true; } });
  assert.equal(await never('spheres.mp3', { gone: () => gone }), null);
});
