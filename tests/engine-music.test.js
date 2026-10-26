// The recorded music in the engines (docs/systems/engine-bridge.md, "The recorded music"): Unity decodes the MP3s
// (BridgeMusic.cs); the Web Audio shim (engine/webaudio.js) gives the game a NativeAudioBuffer for each and says, after
// every render, where each source playing one is and how loud it reaches the speakers through the game's own graph.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext, AudioReplay, NativeAudioBuffer, setAudioDecoder, installAudio } from '../engine/webaudio.js';
import { prepareSoundtrack, loadSoundtrack, loadTitleTheme, THEME_FILES, TITLE_THEME } from '../src/soundtracks.js';
import { THEME_LEVELS } from '../src/theme-levels.js';
import { MusicMoments, MUSIC_MOMENTS } from '../src/music-moments.js';
import { themeDownloads, MUSIC_FILE } from '../engine/unity/music.js';
import { ON_DEVICE_THEMES } from '../src/music-store.js';
import { readFileSync } from 'node:fs';

const RATE = 48000;
/** nativeText's lines as objects. */
const natives = (text) => (text ? text.split(';').map((l) => { const [id, clip, pos, gain, lowpass, loop, join, length] = l.split(',').map(Number); return { id, clip, pos, gain, lowpass, loop: !!loop, join, length }; }) : []);
const clip = (over = {}) => ({ native: 7, file: 'music/incal-streets-above-streets.mp3', numberOfChannels: 2, length: RATE * 10, sampleRate: RATE, ...over });

test('a recording the engine decodes: no samples here, played where the graph says, as loud as its dry way there', async () => {
  setAudioDecoder(async () => clip());
  try {
    const ctx = new AudioContext({ sampleRate: RATE });
    const buf = await ctx.decodeAudioData(new ArrayBuffer(8));
    assert.ok(buf instanceof NativeAudioBuffer);
    assert.throws(() => buf.getChannelData(0), /not here/);
    const j = buf.joined(2 * RATE, 0.5);
    assert.deepEqual([j.length, j.join, j.level, j.native], [8 * RATE, 2 * RATE, 0.5, 7]);
    const src = ctx.createBufferSource(); src.buffer = j; src.loop = true;
    const fade = ctx.createGain(); fade.gain.setValueAtTime(0, 0); fade.gain.linearRampToValueAtTime(1, 2);
    const bus = ctx.createGain(); bus.gain.value = 0.62;
    const lp = ctx.createBiquadFilter(); lp.frequency.value = 800;
    src.connect(fade).connect(bus).connect(lp).connect(ctx.destination);
    // (the music's send into the room is left out: the engine plays it dry; a meter hears nothing on)
    const verb = ctx.createConvolver(); bus.connect(verb).connect(ctx.destination);
    bus.connect(ctx.createAnalyser());
    src.start(0.5);
    const out = ctx.render(4800);
    assert.equal(Math.max(...out.map(Math.abs)), 0, 'nothing rendered here');
    let [n] = natives(ctx.nativeText());
    assert.ok(n.pos < 0 && n.clip === 7 && n.loop && n.join === 2 && n.length === 8, JSON.stringify(n));
    ctx.render(RATE);
    [n] = natives(ctx.nativeText());
    const t = ctx.currentTime;
    assert.ok(Math.abs(n.pos - (t - 0.5)) < 1e-3, `its place: ${n.pos} at ${t}`);
    assert.ok(Math.abs(n.gain - 0.5 * (t / 2) * 0.62) < 1e-4, `the level, the fade, the bus: ${n.gain}`);
    assert.equal(n.lowpass, 800);
    // the bus down: the gain follows; suspended: silent; closed: gone
    bus.gain.setValueAtTime(0, ctx.currentTime);
    ctx.render(128);
    assert.equal(natives(ctx.nativeText())[0].gain, 0);
    bus.gain.setValueAtTime(0.62, ctx.currentTime);
    await ctx.suspend(); ctx.render(128);
    assert.equal(natives(ctx.nativeText())[0].gain, 0, 'suspended');
    await ctx.resume(); ctx.render(128);
    assert.ok(natives(ctx.nativeText())[0].gain > 0);
    src.stop(ctx.currentTime + 0.01); ctx.render(2048);
    assert.equal(ctx.nativeText(), '', 'stopped: gone');
  } finally { setAudioDecoder(null); }
});

test('a cue played once: it ends when its recording does, its onended called; without a decoder, decodes fail as before', async () => {
  const ctx = new AudioContext({ sampleRate: RATE });
  await assert.rejects(ctx.decodeAudioData(new ArrayBuffer(8)), /no decoder/);
  setAudioDecoder(async () => clip({ length: RATE / 2 }));
  try {
    const buf = await ctx.decodeAudioData(new ArrayBuffer(8));
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    let ended = 0; src.onended = () => ended++;
    src.start(0.1);
    ctx.render(RATE / 4);
    assert.equal(natives(ctx.nativeText()).length, 1);
    ctx.render(RATE / 2);
    await Promise.resolve();
    assert.equal(ctx.nativeText(), '');
    assert.equal(ended, 1, 'its onended');
  } finally { setAudioDecoder(null); }
});

test('recorded and replayed (Unity\'s audio thread): the same places and gains; a new context starts the replay afresh', async () => {
  setAudioDecoder(async () => clip());
  try {
    const run = async (record) => {
      const ctx = new AudioContext({ sampleRate: RATE, record });
      const buf = (await ctx.decodeAudioData(new ArrayBuffer(8))).joined(RATE, 0.4);
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; src.loop = true; g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 1);
      src.connect(g).connect(ctx.destination); src.start(0);
      return { ctx, g };
    };
    const A = await run(false), B = await run(true), replay = new AudioReplay(RATE);
    const a = [], b = [];
    for (let f = 0; f < 30; f++) {
      if (f === 10) { A.g.gain.setTargetAtTime(0.2, A.ctx.currentTime, 0.1); B.g.gain.setTargetAtTime(0.2, B.ctx.currentTime, 0.1); }
      A.ctx.render(6 * 128); a.push(A.ctx.nativeText());
      replay.apply(B.ctx.takeOps(6)); b.push(replay.natives);
    }
    const noId = (x) => x.replace(/(^|;)\d+,/g, '$1');   // (each side's own node ids)
    assert.deepEqual(b.map(noId), a.map(noId));
    assert.ok(natives(a.at(-1))[0].gain > 0.05 && natives(a.at(-1))[0].gain < 0.4 * 0.5, a.at(-1));
    // the title's context handing over to the world's: the replay lets the old graph go
    const C = await run(true);
    replay.apply(C.ctx.takeOps(6));
    const now = natives(replay.natives);
    assert.equal(now.length, 1);
    assert.ok(now[0].pos < 0.02, 'the new context\'s source, from its start');
  } finally { setAudioDecoder(null); }
});

test('the themes\' balance for the engines: every recording measured, prepareSoundtrack joins an engine\'s at that level', () => {
  for (const f of [...THEME_FILES, TITLE_THEME]) {
    assert.ok(THEME_LEVELS[f] > 0.05 && THEME_LEVELS[f] <= 4, `${f}: ${THEME_LEVELS[f]} (node scripts/theme-levels.mjs)`);
  }
  const ctx = new AudioContext({ sampleRate: RATE });
  const b = prepareSoundtrack(ctx, new NativeAudioBuffer(clip({ file: 'music/incal-streets-above-streets.mp3' })));
  assert.equal(b.join, 2 * RATE);
  assert.equal(b.length, 8 * RATE);
  assert.equal(b.level, THEME_LEVELS['incal-streets-above-streets.mp3']);
  assert.ok(MUSIC_FILE.test('music/title-french-touch.mp3') && !MUSIC_FILE.test('sfx/step-1.mp3'), 'the effects are not the engine\'s to decode');
});

test('the themes a Unity package lacks: downloaded from the site, the world played first, the carried ones not', () => {
  const d = themeDownloads('glassdunes-impossible-reflections.mp3');
  const items = d.list.split(';').map((e) => e.split(' '));
  assert.equal(items[0][0], 'glassdunes-impossible-reflections.mp3');
  assert.ok(items.every(([f, u]) => !ON_DEVICE_THEMES.includes(f) && u === `https://hiraeth.alexandria-rnaud.workers.dev/music/${f}`));
  assert.equal(items.length, THEME_FILES.filter((f) => !ON_DEVICE_THEMES.includes(f)).length);
  assert.equal(d.carried, ON_DEVICE_THEMES.join(','));
  // (the players carry the same: BridgeBuild.Common's list for the APK and the Xbox)
  const cs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs', import.meta.url), 'utf8');
  const carried = cs.match(/OnDeviceThemes = \{([^}]*)\}/)?.[1].match(/"[^"]+"/g).map((x) => x.slice(1, -1));
  assert.deepEqual(carried, ON_DEVICE_THEMES);
});

/** The game's own Sound on the shim, with Unity's decoder stood in: its theme's place and gain as the engine would read them. */
async function gameSound(levelId, opts) {
  const G = globalThis;
  G.window = G; G.window.addEventListener ??= () => {}; G.window.removeEventListener ??= () => {};
  delete G.AudioContext; installAudio(G, { sampleRate: RATE });
  setAudioDecoder(async (data) => clip({ file: `music/${new TextDecoder().decode(data)}` }));
  const { Sound } = await import('../src/audio.js');
  const s = new Sound(levelId, opts);
  s.start();
  const fetcher = async (url) => { const f = String(url).split('/').pop(); return { ok: true, headers: { get: () => 'audio/mpeg' }, blob: async () => ({ arrayBuffer: async () => new TextEncoder().encode(f).buffer }) }; };
  return { s, fetcher, done: () => { clearInterval(s.scheduler); clearInterval(s.menuTimer); clearTimeout(s._trackStop); s._unlisten?.(); setAudioDecoder(null); } };
}
const theme = (s) => natives(s.ctx.nativeText());
const run = (s, secs, update) => { for (let k = 0; k < secs * 10; k++) { update?.(); s.ctx.render(RATE / 10); } };

test('the game\'s Sound: the world\'s theme in Unity under the volumes, the menu, a bench, the mute, the moments and the away', async () => {
  const { s, fetcher, done } = await gameSound('incal');
  try {
    assert.equal(await loadSoundtrack(s, fetcher), true);
    assert.ok(s.trackBuffer instanceof NativeAudioBuffer && s.trackBuffer.level === THEME_LEVELS['incal-streets-above-streets.mp3']);
    // (Settings > Music plays: moments; an arrival of 3 s here, its theme for that long)
    s.moments = new MusicMoments({ mode: 'moments', now: s.ctx.currentTime, T: { ...MUSIC_MOMENTS, arrival: 3, returnAfter: [1e4, 1e4] } });
    const calm = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0, indoor: 0 };
    // (each frame, as the game: the sound's update, and the ear, which sets the music bus's level: src/story/index.js)
    const step = () => { s.update(calm); s.listen({ x: 0, y: 0, z: 0 }, 0); };
    const gain = () => theme(s)[0]?.gain ?? 0;
    run(s, 2.5, step);
    const [a] = theme(s);
    const L = THEME_LEVELS['incal-streets-above-streets.mp3'], full = L * 0.62 * s.musicVol * 0.9;   // (its level, the music bus, the master)
    assert.ok(a && a.loop && a.join === 2 && Math.abs(a.gain - full) / full < 0.05, `faded in, under the music volume: ${JSON.stringify(a)} against ${full}`);
    // the moments: the arrival over, it fades out over 10 s, the ambience carrying the world; a story moment brings it back
    run(s, 12, step);
    assert.ok(gain() < 1e-3, `the arrival over: faded out (${s.ctx.nativeText()})`);
    s.musicCue('moment'); run(s, 4, step);
    assert.ok(Math.abs(gain() - full) / full < 0.05, `a moment: back (${gain()})`);
    // the menu: the world's music out
    s.menuMusic(true); run(s, 2, step);
    assert.ok(gain() < full * 0.02, `under a menu: ${gain()}`);
    s.menuMusic(false); run(s, 3, step);
    assert.ok(Math.abs(gain() - full) / full < 0.05, `the menu closed: ${gain()}`);
    // the music volume is the ceiling: at 0, nothing; at a half, half
    s.setVolumes(0, 1); run(s, 6, step);
    assert.ok(gain() < full * 0.01, `music at 0: ${gain()}`);
    s.setVolumes(0.5, 1); run(s, 6, step);
    const half = gain(), atHalf = L * 0.62 * 0.5 * 0.9;
    assert.ok(Math.abs(half - atHalf) / atHalf < 0.05, `music at a half: ${half} against ${atHalf}`);
    // a bench: the swell (twice, eased in) on the recorded theme, and back as he stands
    s.seated(true); run(s, 8, step);
    assert.ok(gain() > half * 1.9, `sat: ${gain()} against ${half}`);
    s.seated(false); run(s, 8, step);
    assert.ok(gain() < half * 1.1, `stood: ${gain()}`);
    // the mute, and the game away (src/audio-guard.js: the master at 0 at once)
    s.toggleMute(); run(s, 1, step);
    assert.ok(gain() < 1e-3, 'muted');
    s.toggleMute(); run(s, 1, step);
    const away = s.guard.away; s.guard.away = () => true;
    s._away(true); run(s, 0.2, step);
    assert.equal(gain(), 0, 'away');
    s.guard.away = away; s._away(false); run(s, 1, step);
    assert.ok(gain() > half * 0.9, `back: ${gain()}`);
    // Always: it stays past the moment's end
    s.setMusicMode('always'); run(s, 3, step);
    assert.ok(gain() > half * 0.9);
  } finally { done(); }
});

test('the title\'s recording in Unity: over the menu music, on the menu bus, out as a save is chosen', async () => {
  const { s, fetcher, done } = await gameSound('title', { score: false, titleTheme: true, autoStart: false });
  try {
    s.menuMusic(true);
    assert.equal(await loadTitleTheme(s, fetcher), true);
    run(s, 3);
    const [a] = theme(s);
    assert.ok(a && a.loop && a.gain > 0.01 && a.length === 8, JSON.stringify(a));
    s.menuMusic(false); run(s, 3);
    assert.ok(theme(s)[0].gain < a.gain * 0.02, `faded with the menu: ${theme(s)[0].gain}`);
  } finally { done(); }
});
