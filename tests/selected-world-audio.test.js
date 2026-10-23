import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SelectedWorldAudio } from '../src/selected-world-audio.js';
import { Sound } from '../src/audio.js';
import { Hologram } from '../src/ship/hologram.js';
import { StarMap } from '../src/ship/starmap.js';
import { EngineStarMap } from '../engine/starmap.js';
import { ACTION_SFX } from '../src/action-sfx.js';

function fixture() {
  const calls = [], active = new Set();
  const sound = { ctx: { currentTime: 0 }, fx: {}, uiOut() { return this.fx; }, muted: false, bank: {
    start(group, options) {
      const h = { duration: group === 'chest-open' ? 5 : 3, set(value) { h.value = value; }, stop() { active.delete(h); } };
      calls.push({ group, options, h }); active.add(h); return h;
    },
  } };
  const world = new SelectedWorldAudio(sound); sound._selectedWorldAudio = world;
  return { sound, world, calls, active };
}
test('one shared house loop survives changing temple identity, then stops outside and on pause', () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) f.world.update({ house: { bed: i % 2 ? 'fire' : 'deep' } });
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].group, 'temple-ambience');
  f.world.update({}); assert.equal(f.active.size, 0);
  f.world.update({ house: {} }); assert.equal(f.active.size, 1);
  Sound.prototype.pauseActionAudio.call(f.sound, true); assert.equal(f.active.size, 0);
  f.world.update({ house: {} }); assert.equal(f.active.size, 0);
  Sound.prototype.pauseActionAudio.call(f.sound, false); f.world.update({ house: {} }); assert.equal(f.active.size, 1);
  f.sound.muted = true; f.world.update({ house: {} }); assert.equal(f.active.size, 0);
  f.sound.muted = false; f.sound.guard = { away: () => true }; f.world.update({ house: {} }); assert.equal(f.active.size, 0);
  f.sound.guard = null; f.sound._disposed = true; f.world.update({ house: {} }); assert.equal(f.active.size, 0);
});
test('world and race use the same restrained glide without per-frame restart or duplicate ownership', () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) f.world.update({ rideKind: 'bike', rideSpeed: i });
  assert.equal(f.calls.length, 1); assert.equal(f.active.size, 1);
  assert.ok(f.calls[0].h.value.vol <= .75);
  const motor = f.world.motor();
  for (let i = 0; i < 100; i++) { f.world.update({}); motor.set(30, 1, true); }
  assert.equal(f.calls.length, 1, 'world update cannot stop the race-owned loop');
  assert.ok(f.calls[0].h.value.vol <= .8);
  motor.stop(); assert.equal(f.active.size, 0); motor.set(30, 1, true); assert.equal(f.active.size, 0);
  f.world.update({ rideKind: 'skiff' }); assert.equal(f.active.size, 1);
  f.world.dispose(); assert.equal(f.active.size, 0);
});
test('selected chest ceremony owns its full tail, retaining the reward music response without stacked fanfares', () => {
  const f = fixture(); let music = 0; f.sound.musicCue = () => music++;
  Sound.prototype.boxOpen.call(f.sound); f.sound.ctx.currentTime = 1.8;
  Sound.prototype.fanfare.call(f.sound); Sound.prototype.quest.call(f.sound, 'done');
  assert.deepEqual(f.calls.map(c => c.group), ['chest-open']); assert.equal(music, 1);
  f.sound.ctx.currentTime = 6; Sound.prototype.fanfare.call(f.sound);
  assert.equal(f.calls.at(-1).group, 'treasure-reveal'); assert.equal(music, 2);
});
test('key, CRT and ordinary doors use approved groups without synthesized additions', () => {
  const f = fixture();
  Object.assign(f.sound, { sweep() { throw Error('unexpected synth'); }, burst() { throw Error('unexpected synth'); } });
  Sound.prototype.keyTurn.call(f.sound); Sound.prototype.hologramOn.call(f.sound);
  Sound.prototype.doorway.call(f.sound); f.sound.ctx.currentTime = 2; Sound.prototype.doorOpen.call(f.sound);
  assert.deepEqual(f.calls.map(c => c.group), ['key-unlock', 'hologram-crt', 'temple-slide-open', 'temple-slide-open']);
});
test('only five approved masters are added, with exact hashes and full ceremonial lengths', () => {
  const source = JSON.parse(readFileSync(new URL('../references/audio/elevenlabs-revisions-2026-10-22/manifest.json', import.meta.url)));
  const runtime = JSON.parse(readFileSync(new URL('../public/sfx/manifest.json', import.meta.url))).files;
  assert.equal(source.sources.length, 5);
  const expected = ['6v8ydEBWhWfJKDVhhCyT', 'Ak7Yopx8iZoob3dziDFo', 'trmVin8bzPHwRKJDSVqN', 'um63HuXstJuaBAgHv8KQ', 'NgRi2FfFHOwQeBr2AZgh'];
  assert.deepEqual(source.sources.map(s => s.generationId), expected);
  for (const s of source.sources) {
    const master = readFileSync(new URL('../references/audio/elevenlabs-revisions-2026-10-22/' + s.file, import.meta.url));
    assert.equal(createHash('sha256').update(master).digest('hex'), s.sha256);
    const m = runtime[s.group + '-0'], wav = readFileSync(new URL('../public/sfx/' + s.group + '-0.wav', import.meta.url));
    assert.equal(createHash('sha256').update(wav).digest('hex'), m.sha256); assert.equal(m.sourceSha256, s.sha256);
    assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt32LE(24), 44100);
    assert.ok(m.peakDbfs <= -5.99); assert.ok(Number.isFinite(m.rmsDbfs)); assert.ok(ACTION_SFX[s.group]);
  }
  assert.equal(runtime['chest-open-0'].duration, 5); assert.equal(runtime['key-unlock-0'].duration, 3);
  assert.ok(ACTION_SFX['hoverbike-glide'].vol < .1); assert.ok(ACTION_SFX['temple-ambience'].vol < .1);
});

test('closing or skipping a projection stops only its CRT tail and permits immediate reopening', () => {
  for (const close of [
    sound => Hologram.prototype.hide.call({ onHide: () => Sound.prototype.hologramOff.call(sound) }),
    sound => Hologram.prototype.clear.call({ root: { visible: true }, onHide: () => Sound.prototype.hologramOff.call(sound) }),
    sound => StarMap.prototype.toggle.call({ open: true, o: { sound: () => sound } }, false),
    sound => EngineStarMap.prototype.close.call({ isOpen: true, o: { sound: () => sound }, held: new Set(), onClose() {} }),
  ]) {
    const f = fixture(); f.sound.hologramOff = () => Sound.prototype.hologramOff.call(f.sound);
    Sound.prototype.keyTurn.call(f.sound); Sound.prototype.hologramOn.call(f.sound, { ui: true });
    assert.equal(f.active.size, 2);
    close(f.sound); assert.equal(f.active.size, 1, 'unrelated key cue remains active');
    close(f.sound); assert.equal(f.active.size, 1, 'repeated cleanup is harmless');
    Sound.prototype.hologramOn.call(f.sound, { ui: true });
    assert.equal(f.active.size, 2, 'a new projection is not blocked by the old cooldown');
    assert.deepEqual(f.calls.map(c => c.group), ['key-unlock', 'hologram-crt', 'hologram-crt']);
  }
});
