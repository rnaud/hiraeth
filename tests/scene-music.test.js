import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneMusic, SCENE_FADE } from '../src/scene-music.js';
import { AudioContext } from '../engine/webaudio.js';
import { Sound } from '../src/audio.js';
import { MusicMoments } from '../src/music-moments.js';
import { prologueMusic } from '../src/ship/cinematics.js';
import { scoreFor } from '../src/score.js';
import { loadSceneThemes, SCENE_THEMES } from '../src/soundtracks.js';

function setup() {
  const ctx = new AudioContext({ sampleRate: 1000 });
  const s = Object.create(Sound.prototype);
  Object.assign(s, { ctx, levelId: 'desert', music: ctx.createGain(), scoreId: 'desert', S: scoreFor('desert'), profile: {}, voice: {}, moments: new MusicMoments({ mode: 'always' }) });
  s.music.connect(ctx.destination); s.sceneMusic = new SceneMusic(s);
  const buffer = ctx.createBuffer(1, 10000, 1000); buffer.getChannelData(0).fill(0.2);
  return { s, ctx, buffer, advance: seconds => { ctx.render(Math.round(seconds * 1000)); s.sceneMusic.update(); } };
}

test('battle starts on engagement, survives brief gaps, fades to silence and stops after combat', () => {
  const { s, buffer, advance } = setup();
  s.sceneMusic.install('battle', buffer); s.combat(true);
  const source = s.sceneMusic.voices.battle.source;
  assert.equal(s.sceneMusic.battleActive, true);
  advance(1); s.combat(false); advance(0.5); s.combat(true);
  assert.equal(s.sceneMusic.voices.battle.source, source, 'a brief gap does not restart the music');
  s.combat(false); advance(SCENE_FADE.battleRelease + 0.1);
  assert.equal(s.sceneMusic.battleActive, false);
  assert.equal(s.sceneMusic.voices.battle.to, 0, 'battle has begun fading');
  advance(SCENE_FADE.battleOut + 0.1);
  assert.equal(s.sceneMusic.voices.battle, undefined, 'no silent looping source left behind');
  s.combat(true);
  assert.notEqual(s.sceneMusic.voices.battle.source, source, 'next encounter starts at its opening');
  s.sceneMusic.dispose();
});

test('combat late loading honours the current encounter, and a new fight interrupts a fade smoothly', () => {
  const { s, buffer, advance } = setup();
  s.sceneMusic.fight(true); s.sceneMusic.fight(false); advance(2);
  s.sceneMusic.install('battle', buffer);
  assert.equal(s.sceneMusic.voices.battle, undefined, 'no late battle after enemies are gone');
  s.sceneMusic.fight(true); advance(1); s.sceneMusic.fight(false); advance(1.3); advance(1);
  s.sceneMusic.fight(true);
  assert.ok(s.sceneMusic.voices.battle.from > 0 && s.sceneMusic.voices.battle.from < 1, 'fade resumes from its audible gain');
  s.sceneMusic.dispose();
});

test('prologue recording is separate, quiets for the voicemail, and late decoding never plays after the ship phase', () => {
  const { s, buffer, advance } = setup();
  prologueMusic(s, 'ship'); s.sceneMusic.install('prologue', buffer);
  assert.ok(s.sceneMusic.voices.prologue); assert.equal(s.themeHeld, true);
  assert.equal(s.sceneMusic.suppressScore, true);
  prologueMusic(s, 'quiet'); advance(1.1);
  assert.equal(s.sceneMusic.voices.prologue, undefined); assert.equal(s.scoreOff, true);
  prologueMusic(s, 'desert'); assert.equal(s.themeHeld, false);
  s.sceneMusic.install('prologue', buffer);
  assert.equal(s.sceneMusic.voices.prologue, undefined);
});

test('recorded encounters honour music volume and disposal', () => {
  const { s, ctx, buffer, advance } = setup();
  s.music.gain.value = 0; s.sceneMusic.install('battle', buffer); s.sceneMusic.fight(true); advance(1);
  const output = ctx.render(1000);
  assert.ok(output.every(x => x === 0), 'muted bus stays silent');
  s.sceneMusic.dispose(); s.sceneMusic.install('battle', buffer); s.sceneMusic.fight(true);
  assert.deepEqual(s.sceneMusic.voices, {});
});

test('scene loading does not install decoded audio after disposal', async () => {
  const { s, ctx, buffer } = setup();
  let finish; ctx.decodeAudioData = () => new Promise(r => { finish = r; });
  const loading = loadSceneThemes(s, async () => ({ ok: true, headers: { get: () => 'audio/mpeg' }, blob: async () => new Blob(['audio']) }), { here: { protocol: 'https:', hostname: 'example.com' }, store: null });
  for (let i = 0; i < 20 && !finish; i++) await Promise.resolve();
  s._disposed = true; s.sceneMusic.dispose(); finish(buffer); await loading;
  assert.deepEqual(s.sceneMusic.buffers, {});
  assert.ok(SCENE_THEMES.battle && SCENE_THEMES.prologue);
});

test('every scene theme ships with provenance and measured Unity loudness', async () => {
  const { readFileSync, statSync } = await import('node:fs');
  const { THEME_LEVELS } = await import('../src/theme-levels.js');
  const { ON_DEVICE_THEMES } = await import('../src/music-store.js');
  const m = JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url)));
  for (const [id, file] of Object.entries(SCENE_THEMES)) {
    assert.equal(m.scenes.find(x => x.scene === id)?.file, file);
    assert.ok(m.scenes.find(x => x.scene === id)?.source.startsWith('https://suno.com/song/'));
    assert.ok(statSync(new URL('../public/music/' + file, import.meta.url)).size > 100000);
    assert.ok(THEME_LEVELS[file] > 0 && ON_DEVICE_THEMES.includes(file));
  }
});
