// The hum the people out on the route talk about, heard (playtest 8 October 2026): in the prologue under the
// father's charge until the strike, from the scar, near an unopened makers' box, and whenever words on the
// screen speak of it. The logic (src/story/hum.js) and the sound itself (src/audio.js makersHum / makersHumRise), rendered
// with the game's own Sound on engine/webaudio.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installAudio } from '../engine/webaudio.js';
import { HUM, mentionsHum, HumCue, callHum, callHumLevel, boxHumWait } from '../src/story/hum.js';
import { callTimeline } from '../src/ship/prologue.js';
import { PROLOGUE_CALL } from '../src/story/calls.js';
import { PEOPLE as DESERT_PEOPLE } from '../src/story/desert-data.js';

const G = globalThis;
G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
delete G.AudioContext; installAudio(G, { sampleRate: 48000 });
const { Sound } = await import('../src/audio.js');

test('which words speak of humming', () => {
  for (const t of ['~tired~ The chest started humming after the singing light passed.', 'It hums more when you are near.', 'The bell hummed by itself.',
    { text: 'Listen to it hum!' }, 'Hum it for me some time.']) assert.ok(mentionsHum(t), JSON.stringify(t));
  for (const t of ['A human shape.', 'Humid air.', 'A long hump of sand.', 'Hmmm-hm.', '', null, undefined, { text: 'No.' }]) assert.ok(!mentionsHum(t), JSON.stringify(t));
});

test('the story does talk about it: the desert says the chest hums, so the hum must be heard there', () => {
  const lines = JSON.stringify(DESERT_PEOPLE ?? {});
  assert.ok(/humm/i.test(lines), 'the desert people mention the humming chest');
});

test('words on the screen set it off softly, at most once every HUM.gap seconds', () => {
  const cue = new HumCue();
  assert.equal(cue.hear('Nour’s chest is humming! Go and see!', 10), true);
  assert.equal(cue.hear('Her chest has hummed since the light passed.', 12), false, 'not again so soon');
  assert.equal(cue.hear('Nothing here.', 100), false, 'only words about humming');
  assert.equal(cue.hear('It hums more when you are near.', 10 + HUM.gap + 0.1), true, 'again after the gap');
});

test('the prologue: the hum rises under the father’s charge and is loudest at the cut', () => {
  const tl = callTimeline(PROLOGUE_CALL);
  const w = callHum(tl);
  const charge = tl.lines.find((l) => l.line.text.includes('Bring back something of value'));
  assert.equal(w.from, charge.t0, 'it starts with the charge');
  assert.equal(w.to, tl.total, 'and runs to the strike');
  assert.equal(callHumLevel(w.from - 0.5, w), 0, 'nothing before');
  assert.ok(callHumLevel((w.from + w.to) / 2, w) > 0 && callHumLevel((w.from + w.to) / 2, w) < 0.5, 'creeping in');
  assert.equal(callHumLevel(w.to, w), 1, 'loudest at the cut');
});

test('a makers’ box hums every few seconds, sooner when near', () => {
  const [a, b] = HUM.every;
  for (const r of [0, 0.5, 1]) { const w = boxHumWait(1, r); assert.ok(w >= a && w <= b, `near ${w}`); }
  assert.ok(boxHumWait(0, 0.5) > boxHumWait(1, 0.5), 'further off, a longer wait');
});

// ------------------------------------------------------------------ the sound
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i += 2) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length / 2)); };
const peakRms = (a, w = 4800) => { let best = 0; for (let i = 0; i + w * 2 <= a.length; i += w * 2) best = Math.max(best, rms(a.subarray(i, i + w * 2))); return best; };
const dB = (x) => 20 * Math.log10(x + 1e-12);
const sounds = [];
const fresh = () => {
  const s = new Sound('desert', { score: false });
  s.muted = false; s.start(); clearInterval(s.scheduler); clearTimeout(s._preload);
  s.setVolumes?.(0, 1);
  s.ctx.render(4800);
  sounds.push(s);
  return s;
};
test.after(() => { for (const s of sounds) { clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.(); } });

test('the hum is heard, and subtle: under the music, about a footstep', () => {
  const s = fresh();
  const len = s.makersHum();
  assert.ok(len > 3 && len < 6, `about four seconds (${len})`);
  const out = s.ctx.render(48000 * 5);
  const loud = dB(peakRms(out));
  // (the score is about -27 dB, a synth footstep about -42 dB, the calm desert wind under -50 dB)
  assert.ok(loud > -48, `heard: ${loud.toFixed(1)} dB`);
  assert.ok(loud < -30, `subtle: ${loud.toFixed(1)} dB`);
  const tail = dB(rms(s.ctx.render(48000 * 2)));
  assert.ok(tail < -60, `and gone after (${tail.toFixed(1)} dB)`);
});

test('the prologue’s hum grows, and the strike cuts it off at once', () => {
  const s = fresh();
  const h = s.makersHumRise(4);
  const early = dB(rms(s.ctx.render(48000))), late = (s.ctx.render(48000 * 2), dB(rms(s.ctx.render(48000 * 0.8))));
  assert.ok(late > early + 6, `louder as it nears (${early.toFixed(1)} → ${late.toFixed(1)} dB)`);
  assert.ok(late < -26, `never over the music (${late.toFixed(1)} dB)`);
  h.stop();
  s.ctx.render(4800);
  const after = dB(rms(s.ctx.render(48000 * 0.5)));
  assert.ok(after < late - 15, `cut (${after.toFixed(1)} dB: only the room's tail)`);
});

test('near an unopened box the hum comes back by itself; out of reach it stops', () => {
  const s = fresh();
  const heard = [];
  s.makersHum = (o) => { heard.push(o.vol); return 4; };
  for (let i = 0; i < 30 * 10; i++) { s.boxHum(0.2, 0.8); s.ctx.render(4800); }   // 30 s within reach
  assert.ok(heard.length >= 2 && heard.length <= 4, `every few seconds (${heard.length} in 30 s)`);
  assert.ok(heard.every((v) => v > 0.35 && v <= 1));
  const n = heard.length;
  for (let i = 0; i < 20 * 10; i++) { s.boxHum(0, 0); s.ctx.render(4800); }
  assert.equal(heard.length, n, 'out of reach: silent');
});
