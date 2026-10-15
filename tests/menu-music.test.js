import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioContext } from '../engine/webaudio.js';

// Issue #243: "When in the pause menu we should not play both the level and menu music."
async function sound(t) {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const { Sound } = await import('../src/audio.js');
  const ctx = new AudioContext({ sampleRate: 8000 });
  const s = Object.create(Sound.prototype);
  Object.assign(s, { ctx, menuOn: false, musicVol: 0.8, master: ctx.createGain(), world: ctx.createGain(), reverb: ctx.createConvolver() });
  s.music = ctx.createGain(); s.music.gain.value = 0.62 * 0.8;
  s.fx = ctx.createGain(); s.fxRoom = ctx.createGain();
  s.menuSchedule = () => {};
  return s;
}
const last = (p) => p.events.at(-1);

test('a menu up: the level\'s music goes out, the menu\'s comes in; closed, the level\'s comes back', async (t) => {
  const s = await sound(t);
  s.menuMusic(true);
  assert.equal(last(s.music.gain).v, 0, 'the world\'s music bus to nothing');
  assert.ok(last(s.menuBus.gain).v > 0, 'the menu\'s bus up');
  assert.ok(Math.abs(last(s.world.gain).v - 0.16) < 1e-9, 'the world\'s own sounds hushed, not gone');
  s.menuMusic(false);
  assert.ok(Math.abs(last(s.music.gain).v - 0.62 * 0.8) < 1e-9, 'back at its volume');
  assert.equal(last(s.menuBus.gain).v, 0);
});

test('the music volume changed in the menu doesn\'t bring the level\'s music back under it', async (t) => {
  const s = await sound(t);
  s.menuMusic(true);
  s.setVolumes(0.5, 0.7);
  assert.equal(last(s.music.gain).v, 0);
  s.menuMusic(false);
  assert.ok(Math.abs(last(s.music.gain).v - 0.62 * 0.5) < 1e-9);
});

test('the score\'s per-frame level and a new start keep it out while a menu is up; every pausing menu asks for it', () => {
  const audio = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
  // (listen() sets the bus to musicLevel(), which is 0 under a menu: the musicians near, a moment's swell and a bench's lift after)
  assert.match(audio, /this\.music\?\.gain\.setTargetAtTime\(this\.musicLevel\(near, t\)/);
  assert.match(audio, /musicLevel\(near = 0[^\n]*\n[^\n]*\n[^\n]*\n\s*return this\.menuOn \? 0 : 0\.62 \* this\.musicVol \* \(1 - 0\.7/);
  assert.match(audio, /this\.music\.gain\.value = this\.menuOn \? 0 : 0\.62 \* this\.musicVol/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // (the Start menu, the game menu and what's new pause the game, and each toggles the menu music by paused())
  assert.match(main, /const panels = \[menu, journal, changelog\]/);
  assert.match(main, /sound\.menuMusic\(paused\(\)\)/);
});
