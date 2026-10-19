// The sound QC (.claude/skills/sound-qc, issue #379): its judgement (scripts/sound-qc/lib.mjs) on made-up sounds, and
// its list of actions (scripts/sound-qc/actions.mjs) against the code: every entry names a Sound call and where the
// game asks for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, variation, judge, envelope, kWeight, dB, ROLES, LIMITS } from '../scripts/sound-qc/lib.mjs';
import { readFileSync } from 'node:fs';
import { ACTIONS, loadKit } from '../scripts/sound-qc/actions.mjs';
import { SCENARIOS } from '../scripts/sound-qc/scenarios.mjs';

const RATE = 48000;
/** Interleaved stereo: `secs` of silence with a `f` Hz sine of amplitude `a` from `at` for `len` s (a short fade each end). */
function tone({ secs = 1, at = 0.2, len = 0.2, f = 1000, a = 0.1 } = {}) {
  const n = Math.round(secs * RATE), out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / RATE - at;
    if (t < 0 || t > len) continue;
    const env = Math.min(1, t / 0.002, (len - t) / 0.002);
    out[i * 2] = out[i * 2 + 1] = a * env * Math.sin(2 * Math.PI * f * t);
  }
  return out;
}

test('a tone is measured: its level, its start, its length and its brightness', () => {
  const m = measure(tone({ at: 0.2, len: 0.2, f: 1000, a: 0.1 }), RATE);
  // (a 1 kHz sine of 0.1: -23 dB RMS, the K-weighting lifts 1 kHz by about 0.7 dB)
  assert.ok(Math.abs(m.rms - (dB(0.1 / Math.SQRT2) + 0.7)) < 1, `level ${m.rms}`);
  assert.ok(Math.abs(m.peak - dB(0.1)) < 0.1, `peak ${m.peak}`);
  assert.ok(Math.abs(m.onset - 0.2) < 0.002, `onset ${m.onset}`);
  assert.ok(Math.abs(m.dur - 0.2) < 0.06, `length ${m.dur}`);
  assert.ok(Math.abs(m.centroid - 1000) < 120, `brightness ${m.centroid}`);
  assert.equal(measure(new Float32Array(RATE * 2), RATE), null, 'silence: nothing heard');
});

test('the bed is taken out: a tone over a steady hum is measured as the tone', () => {
  const bed = tone({ at: 0, len: 1, f: 200, a: 0.05 }), both = tone({ at: 0.3, len: 0.2, f: 2000, a: 0.1 }).map((x, i) => x + bed[i]);
  const m = measure(both, RATE, { bed });
  assert.ok(Math.abs(m.onset - 0.3) < 0.03, `onset ${m.onset}`);
});

test('a low thump counts for less than a mid tone of the same RMS (K-weighting)', () => {
  const lo = envelope(kWeight(tone({ f: 60, len: 0.5 })), RATE), mid = envelope(kWeight(tone({ f: 1000, len: 0.5 })), RATE);
  assert.ok(dB(Math.max(...mid)) - dB(Math.max(...lo)) > 1, 'the 60 Hz one quieter');
});

test('repeats: alike takes are repetitive, varied ones are not', () => {
  const same = [1, 2, 3].map(() => measure(tone({ at: 0, f: 1000, a: 0.1 }), RATE));
  const varied = [0.8, 1, 1.25].map((k) => measure(tone({ at: 0, f: 1000 * k, a: 0.1 * k }), RATE));
  assert.equal(judge(same[0], 'action', -20, { v: variation(same) }).verdict, 'repetitive');
  assert.equal(judge(varied[0], 'action', -20, { v: variation(varied) }).verdict, 'OK');
});

test('the verdicts: missing, too quiet, too loud, too late, too long, OK', () => {
  const m = measure(tone({ a: 0.1 }), RATE), ref = m.rms;
  assert.equal(judge(m, 'action', ref, { wired: false }).verdict, 'missing');
  assert.equal(judge(null, 'action', ref).verdict, 'missing');
  assert.equal(judge(m, 'action', ref + ROLES.action.hi + 30).verdict, 'too quiet');
  assert.equal(judge(m, 'foley', ref - 20).verdict, 'too loud');
  assert.equal(judge({ ...m, onset: 0 }, 'action', ref, { press: LIMITS.press + 0.05 }).verdict, 'too late');
  assert.equal(judge({ ...m, onset: 0, dur: 3 }, 'ui', ref + 15).verdict, 'too long');
  assert.equal(judge({ ...m, onset: 0 }, 'action', ref + 5).verdict, 'OK');
});

test('the list: every action has a role, a call, where the game asks for it, and a scenario that exists', () => {
  const ids = new Set();
  for (const a of ACTIONS) {
    assert.ok(!ids.has(a.id), `${a.id} once`); ids.add(a.id);
    assert.ok(ROLES[a.role], `${a.id}: a role`);
    assert.equal(typeof a.play, 'function', `${a.id}: a call`);
    assert.ok(a.web.length, `${a.id}: where the browser asks for it`);
    if (a.drive) assert.ok(SCENARIOS[a.drive] && a.calls?.length, `${a.id}: its scenario and calls`);
  }
  for (const k of ['swing-1', 'hit', 'jump', 'land-hard', 'evade', 'hurt', 'menu-move', 'menu-confirm', 'pickup']) assert.ok(ACTIONS.find((a) => a.id === k)?.key, `${k} is a key action`);
});

// issue #499: the code patterns went stale when the hurts and the fight moved into the one game setup (#427, #435): six
// heard sounds were called missing. Every pattern must match the code as it is, so a refactor fails here, not the QC.
test('the list against the code: every action\'s patterns match where the game asks for it, in the browser and the engines', () => {
  const src = new Map(), read = (f) => { if (!src.has(f)) src.set(f, readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')); return src.get(f); };
  const stale = [];
  for (const a of ACTIONS) {
    for (const [f, re] of a.web) if (!re.test(read(f))) stale.push(`${a.id}: web ${f} ${re}`);
    if (Array.isArray(a.engine)) { for (const [f, re] of a.engine) if (!re.test(read(f))) stale.push(`${a.id}: engine ${f} ${re}`); }
    else assert.ok(a.engine === 'shared' || a.engine === null, `${a.id}: engine is 'shared', null or its own wiring`);
  }
  assert.deepEqual(stale, [], 'patterns that no longer match the code');
  // what the one game setup wires for both hosts is looked for there, and in each host's use of it
  for (const id of ['hurt', 'potion-open', 'potion-heal', 'chime', 'potion-pickup', 'flurry']) {
    const a = ACTIONS.find((x) => x.id === id);
    assert.ok(a.web.some(([f]) => f === 'src/host/game-host.js') && a.engine.some(([f]) => f === 'src/host/game-host.js'), `${id}: found in game-host.js`);
    assert.ok(a.web.some(([f]) => f === 'src/main.js'), `${id}: and in the page's use of it`);
    assert.ok(a.engine.some(([f]) => f === 'engine/game.js' || f === 'engine/combat.js'), `${id}: and in the engines' use of it`);
  }
});

test('the mix\'s reference is the recording that plays: the world\'s theme at the engines\' gain (src/theme-levels.js)', async () => {
  const { themeOf } = await import('../scripts/sound-qc/render.mjs');
  const { SOUNDTRACKS } = await import('../src/soundtracks.js');
  const { THEME_LEVELS } = await import('../src/theme-levels.js');
  assert.deepEqual(themeOf('desert'), { file: SOUNDTRACKS.desert, gain: THEME_LEVELS[SOUNDTRACKS.desert] });
  for (const lv of ['desert', 'bazaar', 'home']) assert.ok(THEME_LEVELS[themeOf(lv).file] > 0, `${lv}: a measured gain`);
  assert.equal(themeOf('no-such-world'), null, 'no recording: the procedural score is the fallback');
});

test('the list covers the gadgets (fire, hold, switch), the glove\'s modes and the fight temples, and each action plays something', async () => {
  await loadKit();
  for (const id of ['gadget-switch', 'hook-fire', 'bomb-throw', 'boomerang-throw', 'magnet-grab', 'magnet-hold', 'bubble-blow', 'fan-swing', 'springs-wind', 'springs-launch', 'recall-start', 'recall-tick', 'lens-up', 'pen-draw',
    'glove-fluid', 'glove-push', 'glove-stilling', 'gun-mode', 'glove-bloom', 'glove-tether', 'push', 'foe-warn', 'foe-kill', 'room-cleared']) assert.ok(ACTIONS.find((a) => a.id === id), `${id} on the list`);
  // a stand-in Sound that writes down what it is asked (the synth's sweep and burst, or a method of its own)
  for (const a of ACTIONS) {
    const calls = [];
    const s = new Proxy({ ctx: { currentTime: 1 } }, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' ? (...args) => { calls.push([k, args]); } : undefined) });
    a.play(s);
    assert.ok(calls.length, `${a.id}: its play asks the Sound for a sound`);
  }
});

// Issue #531: the glove's modes each their own chirp, the gadgets' synths varied, their levels in band, judged as the
// QC judges them (the synth alone, what the engines play) against the procedural score round 1 balanced to.
test('the glove\'s modes sound apart, the gadgets\' synths vary, and their levels sit in their bands (issue #531)', async () => {
  await loadKit();
  const { renderer } = await import('../scripts/sound-qc/render.mjs');
  const R = await renderer({ samples: false });
  try {
    const sc = await R.score('desert', { secs: 20 });
    const lv = envelope(kWeight(sc.pcm), sc.rate).map(dB).sort((a, b) => a - b), ref = lv[Math.floor(0.95 * (lv.length - 1))];
    const ids = ['glove-fluid', 'glove-push', 'glove-stilling', 'gun-mode', 'glove-bloom', 'glove-tether', 'shoot-stun', 'push', 'hook-fire', 'hook-reel', 'hook-miss',
      'bomb-blast', 'magnet-grab', 'magnet-hold', 'magnet-shove', 'magnet-drop', 'springs-wind', 'springs-full', 'springs-stomp', 'lens-up', 'lens-down'];
    const m = {};
    for (const id of ids) {
      const a = ACTIONS.find((x) => x.id === id), takes = [];
      for (let k = 0; k < LIMITS.repeats; k++) { const r = await R.render((s) => a.play(s), { seed: 1000 + k * 37 }); takes.push(measure(r.pcm, r.rate, { bed: r.bed })); }
      m[id] = takes[0];
      const j = judge(takes[0], a.role, ref, { v: variation(takes), repeats: a.repeats });
      assert.equal(j.verdict, 'OK', `${id}: ${j.why.join('; ')}`);
    }
    const glove = ids.slice(0, 6);
    for (const [i, x] of glove.entries()) for (const y of glove.slice(i + 1)) {
      const a = m[x], b = m[y];
      const alike = Math.abs(a.centroid - b.centroid) / Math.max(a.centroid, b.centroid) < 0.05 && Math.abs(a.dur - b.dur) < 0.05 && Math.abs(a.rms - b.rms) < 1.5;
      assert.ok(!alike, `${x} and ${y} sound alike`);
    }
  } finally { R.close(); }
});
