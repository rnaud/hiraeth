// Issue #379 (the author: "we have no sound effect for the character when he attacks and some other key actions"):
// the sounds the sound QC (.claude/skills/sound-qc) found missing, rendered with the game's own Sound on the in-memory
// Web Audio (engine/webaudio.js), the synth alone (as the engines play it): heard, bounded, varied. The blade's press
// (fluidWindup), his effort and hurt voice where there is no recording (grunt), the menus (ui, on their own bus, heard
// under a menu's hush), the lock-on, a quest's three moments told apart, the music stepping back under a conversation,
// and the shim's scheduled notes no longer clicking.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installAudio } from '../engine/webaudio.js';
import { measure, variation, dB } from '../scripts/sound-qc/lib.mjs';
import { seeded, CALM, decodedTakes } from '../scripts/sound-qc/test-runtime.mjs';

const G = globalThis;
G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
delete G.AudioContext; installAudio(G, { sampleRate: 48000 });
const { Sound, TALK_DUCK } = await import('../src/audio.js');
const { planLine, voiceOf } = await import('../src/story/voice.js');

const RATE = 48000, made = [];
// The shipping action path now requires its complete assigned bank. Render actual
// packaged takes instead of forcing the retired missing-recording synth substitute.
const { SampleBank } = await import('../src/sfx.js');
const { preparedBank } = await import('../src/effect-assets.js');
const decode = new G.AudioContext({ sampleRate: RATE });
const takesFromDisk = decodedTakes(join(tmpdir(), 'hiraeth-action-takes'));
decode.decodeAudioData = async name => {
  const pcm = takesFromDisk(name.split('/').pop());
  if (!pcm) throw new Error(`Missing packaged take ${name}`);
  const buffer = decode.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.rate);
  pcm.channels.forEach((channel, i) => buffer.getChannelData(i).set(channel));
  return buffer;
};
const prepared = new SampleBank(decode, { fetcher: async name => ({ ok: true, arrayBuffer: async () => name }) });
await prepared.preload();
const fresh = (score = false) => { const s = new Sound('desert', { score }); s.start(); s.bank.dispose(); s.bank = preparedBank(s.ctx, { ready: true, bank: prepared }); clearInterval(s.scheduler); clearTimeout(s._preload); s.update(CALM); s.ctx.render(RATE / 2); made.push(s); return s; };
test.after(() => { for (const s of made) { clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.(); } });
/** `fn`'s sound alone (the same render without it taken out), seeded: its measure. */
function heard(fn, { secs = 1.5, seed = 7, setup = null } = {}) {
  const run = (play) => seeded(() => { const s = fresh(); setup?.(s); if (play) fn(s); return s.ctx.render(RATE * secs); }, seed);
  return measure(run(true), RATE, { bed: run(false) });
}
const takes = (fn, n = 6) => Array.from({ length: n }, (_, i) => heard(fn, { seed: 100 + i * 977 }));

test('the intentional wind-up synthesis is immediate, short and varied beneath recorded cloth', () => {
  const windup = (n, seed = 7) => heard(s => s.fluidWindup(n), { seed, setup: s => { s.sample = () => false; } });
  const T = Array.from({ length: 6 }, (_, i) => windup(0, 100 + i * 977));
  for (const m of T) assert.ok(m && m.onset < 0.02 && m.dur < 0.5 && m.rms > -50 && m.peak < -1, JSON.stringify(m));
  const v = variation(T);
  assert.ok(v.level >= 1 || v.centroid >= 2, `varied: ${JSON.stringify(v)}`);
  const heavy = windup(2), light = windup(0);
  assert.ok(heavy.centroid < light.centroid, `the heavy one darker (${heavy.centroid} < ${light.centroid})`);
});

test('the assigned blade cut varies and remains louder than its wind-up', () => {
  const T = takes((s) => s.fluidSlash(0));
  const v = variation(T);
  assert.ok(v.level >= 1 || v.centroid >= 2, `varied: ${JSON.stringify(v)}`);
  assert.ok(T[0].rms > heard((s) => s.fluidWindup(0)).rms, 'the cut over its wind-up');
});

test('his voice without a recording: an effort and a hurt, heard, never two at once', () => {
  const e = heard((s) => s.grunt('effort', 1, 0)), h = heard((s) => s.grunt('hurt', 1, 0));
  assert.ok(e && h && e.rms > -45 && h.rms > -45 && e.dur < 0.4 && h.dur < 0.5, `${JSON.stringify(e)} ${JSON.stringify(h)}`);
  assert.ok(h.centroid < e.centroid, 'the hurt lower than the effort');
  const s = fresh();
  assert.equal(s.grunt('effort', 1, 1.4), true);
  assert.equal(s.grunt('effort', 1, 1.4), false, 'not twice within its gap');
});

test('a blow taken is heard in the engines too (it was a 40 ms burst 19 dB under the music)', () => {
  const m = heard((s) => s.hurt(1, 'foe'));
  assert.ok(m.rms > -32 && m.dur >= 0.15, JSON.stringify(m));
});

test('the menus: every kind heard, short and quieter than a cut, and heard under a menu\'s hush', () => {
  const cut = heard((s) => s.fluidSlash(0));
  for (const k of ['move', 'confirm', 'back', 'tab', 'open', 'close', 'no']) {
    const m = heard((s) => s.ui(k));
    assert.ok(m && m.onset < 0.02 && m.dur <= 0.6 && m.rms < cut.rms, `${k}: ${JSON.stringify(m)}`);
  }
  const under = heard((s) => s.ui('confirm'), { setup: (s) => { s.menuMusic(false); s.menuOn = true; s.world.gain.value = 0.16; } });
  const open = heard((s) => s.ui('confirm'));
  assert.ok(Math.abs(under.rms - open.rms) < 1, `not hushed with the world (${under.rms} / ${open.rms})`);
  assert.notEqual(heard((s) => s.ui('confirm')).centroid, heard((s) => s.ui('back')).centroid);
  const s = fresh(); let n = 0; const sw = s.sweep.bind(s); s.sweep = (...a) => { n++; return sw(...a); };
  s.ui('move'); s.ui('move');
  assert.equal(n, 1, 'a held stick does not rattle (once within 40 ms)');
  s.toolClick(true);
  assert.ok(n > 1, 'a conversation\'s answer heard (toolClick did not exist)');
});

test('the lock-on and its letting go; a quest given, a step and a quest done told apart', () => {
  const on = heard((s) => s.lockOn(true)), off = heard((s) => s.lockOn(false));
  assert.ok(on && off && off.rms < on.rms, 'letting go the softer');
  const [a, b, c] = ['start', 'step', 'done'].map((k) => heard((s) => s.quest(k), { secs: 3 }));
  assert.ok(a && b && c);
  assert.ok(Math.abs(a.dur - c.dur) > 0.05 || Math.abs(a.centroid - c.centroid) / c.centroid > 0.05, 'start and done differ');
  assert.ok(Math.abs(b.dur - c.dur) > 0.05 || Math.abs(b.centroid - c.centroid) / c.centroid > 0.05, 'a step and done differ');
});

test('the music steps back under a conversation\'s voice and comes back after it', () => {
  const s = fresh(true);
  const plan = planLine('~neutral~ The tower spoke tonight.', { voice: voiceOf({ id: 't', voice: 1 }), lang: 'desert' });
  const step = (secs) => { for (let i = 0; i < secs * 20; i++) { s.listen({ x: 0, y: 0, z: 0 }, 0); s.ctx.render(2400); } };
  step(2); const before = s.music.gain.value;
  s.speak(plan, { channel: 'dialogue' }); step(1.2);
  const during = s.music.gain.value;
  assert.ok(Math.abs(during / before - TALK_DUCK) < 0.08, `ducked ${dB(during / before).toFixed(1)} dB`);
  step(plan.total + 4);
  assert.ok(s.music.gain.value / before > 0.95, 'back after it');
});

test('the shim: a note scheduled inside a block starts there, with no click before it (the purchase peaked at +10 dBFS)', () => {
  const run = (notes) => seeded(() => {
    const s = fresh(), t = s.ctx.currentTime;
    if (notes) for (let i = 0; i < 3; i++) s.crystalTing(t + 0.013 + i * 0.055, s.freq(6 - i, 3), 0.024, 0.5);
    return s.ctx.render(RATE);
  }, 3);
  const pcm = run(true), bed = run(false);
  let peak = 0, before = 0;
  for (let i = 0; i < pcm.length; i++) { peak = Math.max(peak, Math.abs(pcm[i])); if (i < Math.floor(0.0125 * RATE) * 2) before = Math.max(before, Math.abs(pcm[i] - bed[i])); }
  assert.ok(peak < 0.3, `peak ${peak.toFixed(2)}`);
  assert.ok(before < 1e-4, `nothing of it before its first note (${before})`);
});
