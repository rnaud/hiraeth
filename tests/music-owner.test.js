// One music at a time (issue #711: "When the battle music comes on it layers up with the existing music? that's wrong,
// no two music should ever overlap"). Every music goes through one owner (src/music-owner.js): the old out before the
// new comes in. Checked on the owner alone, then on the game's own Sound on the engines' Web Audio (engine/webaudio.js)
// with Unity's decoder stood in, where nativeText says how loud each recording reaches the speakers through the graph:
// a fight starting and ending in two worlds, a moment's swell during a fight, a temple entered mid-fight, the menu, a
// minigame, the musicians, the prologue, and a fight with no recording (its drums).
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext, setAudioDecoder, installAudio } from '../engine/webaudio.js';
import { MusicOwner, MUSIC_LANES, MUSIC_EPS } from '../src/music-owner.js';

const RATE = 48000;
const G = globalThis;
G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
delete G.AudioContext; installAudio(G, { sampleRate: RATE });
const { Sound, BAND_FLOOR } = await import('../src/audio.js');
const { loadSoundtrack, loadSceneThemes, SOUNDTRACKS, SCENE_THEMES } = await import('../src/soundtracks.js');
const { MusicMoments, MUSIC_MOMENTS } = await import('../src/music-moments.js');
const { prologueMusic } = await import('../src/ship/cinematics.js');

test('the owner alone: whatever is wanted, in any order and as fast, never two lanes above MUSIC_EPS at once', () => {
  const ctx = new AudioContext({ sampleRate: 1000 });
  const O = new MusicOwner(ctx);
  const ids = Object.keys(MUSIC_LANES);
  for (const id of ids) O.node(id, ctx.destination);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let wants = { score: true }, worst = 0;
  for (let step = 0; step < 4000; step++) {
    if (rand() < 0.08) { wants = {}; for (const id of ids) if (rand() < 0.3) wants[id] = true; }
    O.update(wants);
    ctx.render(10);   // (10 ms)
    const t = ctx.currentTime, audible = O.audible(t);
    assert.ok(audible.length <= 1, `at ${t.toFixed(2)} s: ${audible.map((id) => `${id} ${O.level(id).toFixed(3)}`)}`);
    // (and the gains the graph plays are the envelopes')
    for (const id of ids) worst = Math.max(worst, Math.abs(O.lanes[id].dry.gain.value - O.level(id, t)));
  }
  assert.ok(worst < 1e-3, `the nodes follow the envelopes (${worst})`);
  // a lane wanted alone comes in fully; a fight's in a moment, the old out first
  O.update({ theme: true }); ctx.render(5000);
  assert.ok(O.level('theme') > 0.999);
  const t0 = ctx.currentTime;
  O.update({ theme: true, battle: true });
  ctx.render(384);   // (three blocks of 128)
  assert.ok(O.level('theme') <= MUSIC_EPS, `the theme out within a third of a second (${O.level('theme')} at ${ctx.currentTime - t0} s)`);
  ctx.render(256);
  assert.ok(O.level('battle') > 0.95, `the fight's in by ${ctx.currentTime - t0} s`);
});

/** The game's Sound on the shim, Unity's decoder stood in (each file its own clip id), its theme and scene themes loaded. */
async function world(levelId, { mode = 'always', battle = true } = {}) {
  const ids = new Map();
  setAudioDecoder(async (data) => {
    const file = new TextDecoder().decode(data);
    if (!ids.has(file)) ids.set(file, ids.size + 1);
    return { native: ids.get(file), file: `music/${file}`, numberOfChannels: 2, length: RATE * 60, sampleRate: RATE };
  });
  const s = new Sound(levelId, { autoStart: false, listen: false });
  s.start(); clearInterval(s.scheduler);
  s.moments = new MusicMoments({ mode, now: s.ctx.currentTime, T: { ...MUSIC_MOMENTS, returnAfter: [1e4, 1e4] } });
  const here = { protocol: 'https:', hostname: 'example.com' };
  const fetcher = async (url) => {
    const f = String(url).split('/').pop();
    if (!battle && f === SCENE_THEMES.battle) return { ok: false, status: 404, headers: { get: () => 'text/html' } };
    return { ok: true, headers: { get: () => 'audio/mpeg' }, blob: async () => ({ arrayBuffer: async () => new TextEncoder().encode(f).buffer }) };
  };
  const warn = console.warn; console.warn = () => {};
  try {
    await loadSoundtrack(s, fetcher, { here, store: null, wait: null });
    await loadSceneThemes(s, fetcher, { here, store: null, wait: null });
  } finally { console.warn = warn; }
  const names = new Map([...ids].map(([f, i]) => [i, f]));
  const state = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0, indoor: 0 };
  let fighting = false, ear = { x: 0, y: 0, z: 0 };
  const log = [];
  /** The recordings heard now: { file: gain at the speakers }. */
  const heard = () => Object.fromEntries(s.ctx.nativeText().split(';').filter(Boolean).map((l) => l.split(',')).map(([, clip, , gain]) => [names.get(+clip), +gain]));
  /** Play `secs` as the game does each frame (foes' combat, the sound's update, the ear), checking every 50 ms. */
  const play = (secs, during) => {
    for (let k = 0; k < secs * 20; k++) {
      during?.(k / 20);
      s.combat(fighting); s.update(state); s.listen(ear, 0); s.schedule();
      s.ctx.render(RATE / 20);
      const h = heard(), loud = Object.entries(h).filter(([, g]) => g > 0.01);
      const lanes = s.musicOwner.audible();
      log.push({ t: s.ctx.currentTime, h, lanes });
      assert.ok(loud.length <= 1, `two recordings at once at ${s.ctx.currentTime.toFixed(2)} s: ${JSON.stringify(h)}`);
      assert.ok(lanes.length <= 1, `two lanes at once at ${s.ctx.currentTime.toFixed(2)} s: ${lanes}`);
      if (loud.length) assert.equal(lanes[0], laneOf(loud[0][0]), `the recording heard is its lane's (${loud[0][0]}, ${lanes})`);
    }
  };
  const laneOf = (file) => (file === SCENE_THEMES.battle ? 'battle' : file === SCENE_THEMES.prologue ? 'prologue' : 'theme');
  return {
    s, state, log, heard, play,
    fight: (on) => { fighting = on; },
    at: (p) => { ear = p; },
    gain: (file) => heard()[file] ?? 0,
    done: () => { clearInterval(s.scheduler); clearInterval(s.combatTimer); clearInterval(s.menuTimer); clearTimeout(s._trackStop); clearTimeout(s._combatStop); clearTimeout(s._menuStop); s._unlisten?.(); setAudioDecoder(null); },
  };
}

for (const levelId of ['incal', 'spacecity']) {
  test(`${levelId}: a fight starts and ends, its music in a moment and the world's back after it, never the two at once`, async () => {
    const W = await world(levelId), theme = SOUNDTRACKS[levelId], battle = SCENE_THEMES.battle;
    try {
      W.play(6);
      assert.ok(W.gain(theme) > 0.1, `the world's theme in (${JSON.stringify(W.heard())})`);
      const t0 = W.s.ctx.currentTime;
      W.fight(true); W.play(1);
      const inAt = W.log.find((e) => e.t > t0 && (e.h[battle] ?? 0) > 0.01)?.t - t0;
      assert.ok(inAt < 0.5, `the fight's music within half a second (${inAt})`);
      assert.equal(W.gain(theme), 0, 'the world\'s theme out');
      assert.ok(W.gain(battle) > 0.1);
      // the foes break off and come back (a brief gap does not bring the world's music back), then give up
      W.fight(false); W.play(0.5); W.fight(true); W.play(2);
      assert.equal(W.gain(theme), 0); assert.ok(W.gain(battle) > 0.1);
      W.fight(false); W.play(8);
      assert.ok(W.gain(battle) === 0 && W.gain(theme) > 0.1, `the world's back (${JSON.stringify(W.heard())})`);
      // a recording that starts once its lane comes in plays from its opening
      assert.ok(W.s.recordedTrack, 'its theme again');
    } finally { W.done(); }
  });
}

test('a moment\'s swell during a fight: the fight\'s music steps out under it and comes back after', async () => {
  const W = await world('incal'), battle = SCENE_THEMES.battle;
  try {
    W.play(4); W.fight(true); W.play(2);
    assert.ok(W.gain(battle) > 0.1);
    const len = W.s.swell('father');
    W.play(1);
    assert.equal(W.s.musicOwner.floor, 'swell');
    assert.equal(W.gain(battle), 0, 'the fight\'s music out under the swell');
    assert.ok(W.s.musicOwner.level('swell') > 0.9);
    W.play(len + 3);
    assert.ok(W.gain(battle) > 0.1, 'the fight\'s music back after it');
    // the box's fanfare and the father's charge hold the floor the same way
    W.s.fanfare(); W.play(0.5);
    assert.equal(W.gain(battle), 0, 'under a fanfare');
    W.play(3.5);
    assert.ok(W.gain(battle) > 0.1);
  } finally { W.done(); }
});

test('a temple entered mid-fight (its guardian waking): one music, the fight\'s; out of the fight, the theme indoors', async () => {
  const W = await world('spacecity', { mode: 'moments' }), theme = SOUNDTRACKS.spacecity, battle = SCENE_THEMES.battle;
  try {
    W.play(4); W.fight(true); W.play(2);
    W.state.house = true; W.state.indoor = 1; W.play(3);   // (inside: the makers' ambience loop, the guardian's fight)
    assert.ok(W.gain(battle) > 0.1 && W.gain(theme) === 0);
    W.fight(false); W.play(8);
    assert.ok(W.gain(battle) === 0 && W.gain(theme) > 0.1, `indoors the theme (${JSON.stringify(W.heard())})`);
  } finally { W.done(); }
});

test('the menu during a fight, a minigame\'s music and the musicians: each alone', async () => {
  const W = await world('incal'), theme = SOUNDTRACKS.incal, battle = SCENE_THEMES.battle;
  try {
    W.play(4); W.fight(true); W.play(2);
    W.s.menuMusic(true); W.play(2);
    assert.equal(W.gain(battle), 0, 'the fight\'s music out under the menu');
    assert.equal(W.s.musicOwner.floor, 'menu');
    W.s.menuMusic(false); W.fight(false); W.play(8);
    assert.ok(W.gain(theme) > 0.1);
    // the drum circle (src/minigames/drums.js): the world's music out while it plays, though each frame sets the music bus
    W.s.musicTake('game', true); W.play(3);
    assert.equal(W.gain(theme), 0, 'the theme out under the minigame');
    W.s.musicTake('game', false); W.play(4);
    assert.ok(W.gain(theme) > 0.1, 'and back after');
    // musicians: near enough to hear, they take the floor; walked away, the theme is back
    W.s.setBands([{ id: 'camp', pos: { x: 0, y: 0, z: 0 }, radius: 80, parts: ['oud', 'ney'], mode: 'play' }]);
    W.at({ x: 200, y: 0, z: 0 }); W.play(1);
    assert.ok(W.gain(theme) > 0.1, 'far off: the theme');
    W.at({ x: 10, y: 0, z: 0 }); W.play(4);
    assert.equal(W.s.musicOwner.floor, 'bands');
    assert.equal(W.gain(theme), 0, 'among the musicians: theirs alone');
    assert.ok(W.s.bands[0].level > BAND_FLOOR.on);
    W.at({ x: 200, y: 0, z: 0 }); W.play(6);
    assert.ok(W.gain(theme) > 0.1);
  } finally { W.done(); }
});

test('no fight recording (not downloaded yet): the fight\'s drums still take the floor from the theme, not over it', async () => {
  const W = await world('incal', { battle: false }), theme = SOUNDTRACKS.incal;
  try {
    W.play(4);
    assert.ok(!W.s.sceneMusic.buffers.battle && W.gain(theme) > 0.1);
    W.fight(true); W.play(2);
    assert.equal(W.gain(theme), 0, 'the theme out');
    assert.equal(W.s.musicOwner.floor, 'battle');
    assert.ok(W.s.combatTimer, 'the drums play');
    W.fight(false); W.play(8);
    assert.ok(W.gain(theme) > 0.1);
  } finally { W.done(); }
});

test('the prologue: the ship\'s recording alone, then nothing for the message, then the desert\'s theme', async () => {
  const W = await world('desert'), prologue = SCENE_THEMES.prologue, theme = SOUNDTRACKS.desert;
  try {
    prologueMusic(W.s, 'ship'); W.play(4);
    assert.ok(W.gain(prologue) > 0.1 && W.gain(theme) === 0);
    assert.equal(W.s.musicOwner.floor, 'prologue', 'the ship\'s score out under its recording');
    prologueMusic(W.s, 'quiet'); W.play(3);
    assert.equal(W.s.musicOwner.audible().length, 0, 'silence for the message');
    prologueMusic(W.s, 'desert'); W.play(4);
    assert.ok(W.gain(theme) > 0.1 && W.gain(prologue) === 0);
  } finally { W.done(); }
});

test('the procedural score is not scheduled while another music has the floor', async () => {
  const W = await world('incal', { battle: false });
  try {
    W.s.trackOn = false; W.s.trackBuffer = null; W.s.musicOwnerUpdate(); W.play(2);
    assert.equal(W.s.musicOwner.floor, 'score');
    const played = [], real = W.s.playEvent;
    W.s.playEvent = function (...a) { played.push(a[0]); return real.apply(this, a); };
    W.play(2); const before = played.length;
    W.fight(true); W.play(4);
    assert.ok(before > 0 && played.length - before < 4, `${before} notes, then ${played.length - before} in the fight`);
    W.s.playEvent = real;
  } finally { W.done(); }
});
