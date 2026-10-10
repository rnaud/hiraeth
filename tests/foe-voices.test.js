// Each archetype's hurt and burst (src/foe-voices.js, played by src/audio.js foeHurt / foeBurst / foeGlance): the
// enemy roster's step 8. Rendered silently, in memory, on the engine's Web Audio (engine/webaudio.js): nothing reaches a
// speaker. The checks are on the rendered samples (length, level, brightness) and on the graph the layers build.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AudioContext } from '../engine/webaudio.js';
import { FOE_VOICES, GLANCE, GLASS, BRONZE, voiceOf, voiceLength } from '../src/foe-voices.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { Sound } from '../src/audio.js';   // (its synthesis only, on a bare context: box())
import { Foe, Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';

const RATE = 24000;
/** A bare voice box: Sound's own synthesis on a fresh in-memory context, its fx bus straight to the output (no reverb, no score). */
function box() {
  const ctx = new AudioContext({ sampleRate: RATE });
  const fx = ctx.createGain(); fx.connect(ctx.destination);
  const nb = ctx.createBuffer(1, RATE * 2, RATE), d = nb.getChannelData(0);
  let s = 12345; for (let i = 0; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const made = { osc: [], flt: [] };
  const o = ctx.createOscillator.bind(ctx), b = ctx.createBiquadFilter.bind(ctx);
  ctx.createOscillator = () => { const x = o(); made.osc.push(x); return x; };
  ctx.createBiquadFilter = () => { const x = b(); made.flt.push(x); return x; };
  const S = Object.create(Sound.prototype);
  Object.assign(S, { ctx, fx, noiseBuf: nb, muted: false });
  return { S, ctx, made };
}
/** The left channel of `secs` s rendered. */
const left = (ctx, secs) => { const st = ctx.render(Math.round(secs * RATE)); const out = new Float32Array(st.length / 2); for (let i = 0; i < out.length; i++) out[i] = st[i * 2]; return out; };
const rms = (a, from = 0, to = a.length) => { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, to - from)); };
const peak = (a) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
/** Zero crossings a second over the loud part (a rough brightness: a hiss crosses often, a thud seldom). */
const brightness = (a) => { const top = peak(a) * 0.05; let n = 0, m = 0; for (let i = 1; i < a.length; i++) { if (Math.abs(a[i]) < top && Math.abs(a[i - 1]) < top) continue; m++; if ((a[i] >= 0) !== (a[i - 1] >= 0)) n++; } return (n / Math.max(1, m)) * RATE; };
/** A voice rendered: its noise's random start points seeded, so a render is the same every run. */
const play = (layers, secs = 2) => {
  const { S, ctx, made } = box(), rnd = Math.random; let s = 99;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  try { S.foeVoice(layers, 0); } finally { Math.random = rnd; }
  return { out: left(ctx, secs), made };
};
const at = (secs) => Math.round(secs * RATE);

const BUILT = Object.entries(ARCHETYPES).filter(([, A]) => A.status === 'built');

test('every archetype has a voice of its own, in its sound family (src/enemies/archetypes.js sound)', () => {
  assert.equal(BUILT.length, 21);
  const seen = { hurt: new Map(), burst: new Map() };
  for (const [id, A] of BUILT) {
    const V = FOE_VOICES[A.kind];
    assert.ok(V, `${id} has a voice`);
    assert.equal(V.family, A.sound, `${id}'s voice is its family's (${A.sound})`);
    assert.equal(voiceOf(A.kind, A.def?.sound), V, `${id}: its own, not its def's ${A.def?.sound ?? 'none'}`);
    for (const k of ['hurt', 'burst']) {
      const key = JSON.stringify(V[k]);
      assert.ok(!seen[k].has(key), `${id}'s ${k} is not ${seen[k].get(key)}'s`);
      seen[k].set(key, id);
      for (const L of V[k]) {
        assert.ok(['noise', 'tone', 'ring', 'clicks'].includes(L.p), `${id} ${k}: a known layer (${L.p})`);
        assert.ok(L.vol > 0 && L.vol <= 0.25, `${id} ${k}: a sane level (${L.vol})`);
        if (L.p === 'clicks') assert.ok(L.n >= 1 && L.dur > 0);
        else assert.ok(L.dur > 0 && L.f > 20 && L.f < 12000, `${id} ${k}: ${L.p} at ${L.f} Hz for ${L.dur} s`);
      }
    }
    assert.ok(voiceLength(V.hurt) <= 0.4, `${id}: a hurt is short (${voiceLength(V.hurt).toFixed(2)} s)`);
    assert.ok(voiceLength(V.burst) <= 1.6 && voiceLength(V.burst) > voiceLength(V.hurt), `${id}: a burst longer than its hurt (${voiceLength(V.burst).toFixed(2)} s)`);
  }
  // families shared only where the doc shares them (the crab's and the roller's shells, the skitters' and the centipede's chitin)
  const fam = {}; for (const [id, A] of BUILT) (fam[A.sound] ??= []).push(id);
  for (const [f, ids] of Object.entries(fam)) assert.ok(ids.length <= 2, `${f}: ${ids}`);
  // a kind without a voice: its def's sound (the makers' machine), else the ink's
  assert.equal(voiceOf('nobody', 'machine'), FOE_VOICES.machine);
  assert.equal(voiceOf('nobody'), FOE_VOICES.blot);
});

test('rendered in memory, each hurt and burst sounds, stays under the old sets\' level, and dies away when it should', () => {
  const old = play(FOE_VOICES.machine.burst).out, ceiling = Math.max(peak(old), peak(play(FOE_VOICES.blot.burst).out)) * 1.6;
  for (const [id, A] of BUILT) {
    const V = FOE_VOICES[A.kind];
    for (const k of ['hurt', 'burst']) {
      const len = voiceLength(V[k]), { out } = play(V[k], len + 0.6);
      assert.ok(out.every(Number.isFinite), `${id} ${k}: finite`);
      const head = rms(out, 0, at(Math.min(len, 0.25)));
      assert.ok(head > 2e-3, `${id} ${k}: audible (${head.toExponential(1)})`);
      assert.ok(peak(out) < ceiling, `${id} ${k}: no louder than the old sets (${peak(out).toFixed(3)} < ${ceiling.toFixed(3)})`);
      const tail = rms(out, at(len + 0.15), at(len + 0.5));
      assert.ok(tail < head / 30, `${id} ${k}: silent after its ${len.toFixed(2)} s (${tail.toExponential(1)})`);
    }
  }
});

test('each family has its character: shells clack short, glass and bronze ring on, a hiss is bright, a thud is dark', () => {
  const B = (kind, k = 'hurt') => { const V = FOE_VOICES[kind][k]; return play(V, Math.max(0.6, voiceLength(V) + 0.3)); };
  // the crab's clack: all over in a fifth of a second
  { const { out } = B('crab'); assert.ok(rms(out, at(0.2), at(0.4)) < rms(out, 0, at(0.1)) / 20, 'the clack is short'); }
  // the bell's bronze: still ringing at 0.6 s, its partials the bell's (the hum an octave under the strike)
  { const { out } = B('bell', 'burst'); assert.ok(rms(out, at(0.5), at(0.7)) > rms(out, 0, at(0.1)) / 25, 'the cracked bronze rings on'); }
  { const { made } = B('bell');
    const f = made.osc.map((o) => o.frequency.value).sort((a, b) => a - b), f0 = 330;
    BRONZE.forEach(([r]) => assert.ok(f.some((x) => Math.abs(x - f0 * r) < 1e-6), `the bell's partial ×${r}`)); }
  // the roller's burst: a shatter of glass (the glass partials, several strikes, higher ones later) over a low rumble
  { const { made } = B('roller', 'burst'); const f = made.osc.map((o) => o.frequency.value);
    for (const base of [1500, 1920, 2340, 2760]) GLASS.forEach(([r]) => assert.ok(f.some((x) => Math.abs(x - base * r) < 1e-6), `glass at ${base} ×${r}`));
    assert.ok(made.flt.some((n) => n.type === 'lowpass' && n.frequency.value <= 200), 'the rolling rumble under it'); }
  // the toad's bellows: a filter sweeping down through the wheeze
  { const { made } = B('toad'); assert.ok(made.flt.some((n) => n.type === 'bandpass' && n.frequency._events?.some?.((e) => e.type === 'exp' && e.v < 500)) || made.flt.some((n) => n.type === 'bandpass' && n.Q.value >= 3), 'a narrow wheeze, swept down'); }
  // brightness: the beetles' ticks, the moth's paper and the shade's cloth over the ink's splat, the worm's grit and the brute's iron
  const bright = (kind) => brightness(B(kind).out);
  for (const hi of ['skitter', 'moth', 'lizard']) for (const lo of ['blot', 'worm', 'brute']) assert.ok(bright(hi) > bright(lo) * 1.5, `${hi} (${bright(hi).toFixed(0)}/s) brighter than ${lo} (${bright(lo).toFixed(0)}/s)`);
  // no two archetypes sound alike: their loudness over time and their brightness apart
  const feat = (kind) => { const { out } = B(kind); const env = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => rms(out, at(i * 0.05), at((i + 1) * 0.05))); const top = Math.max(...env) || 1; return [...env.map((e) => e / top), Math.log2(brightness(out) + 1) / 2]; };
  const kinds = BUILT.map(([, A]) => A.kind), F = Object.fromEntries(kinds.map((k) => [k, feat(k)]));
  const alike = [];
  for (let i = 0; i < kinds.length; i++) for (let j = i + 1; j < kinds.length; j++) {
    const d = Math.hypot(...F[kinds[i]].map((x, n) => x - F[kinds[j]][n]));
    if (d <= 0.1) alike.push(`${kinds[i]} ~ ${kinds[j]} (${d.toFixed(3)})`);
  }
  assert.deepEqual(alike, [], 'every two hurts apart');
});

test('a glance: the spark\'s tick over the thunk, short', () => {
  const { out } = play(GLANCE, 0.6);
  assert.ok(rms(out, 0, at(0.08)) > 2e-3, 'audible');
  assert.ok(rms(out, at(0.25), at(0.5)) < rms(out, 0, at(0.08)) / 30, 'over at once');
  assert.ok(voiceLength(GLANCE) < 0.2);
});

// ---- the foes say it: their own kind's voice, and a shot that does nothing glances
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function arena() {
  clearTargets();
  const sounds = [], P = { pos: v(0, 0, 0), vel: v(), heading: 0, onGround: true, ride: null, down: null, dead: false, health: 1, opts: {}, hurt() {}, knockDown() { return true; } };
  const sound = { foeHurt: (k, s) => sounds.push(`hurt:${k}:${s ?? ''}`), foeBurst: (k, s) => sounds.push(`burst:${k}:${s ?? ''}`), foeGlance: () => sounds.push('glance'), foeArmour: () => sounds.push('armour'), whoosh() {}, foeWarn() {}, combat() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, sound,
    settings: { enemies: 'normal' }, game: new GameState(null), notice() {} });
  foes.waveRest = 1e9;
  return { foes, sounds };
}

test('a cut on a machine plays its own voice (the tripod\'s, not the machines\' one clang); its end, its own burst', () => {
  const { foes, sounds } = arena();
  const f = foes.add('tripod', v(0, 0, 4));
  foes.hurt(f, 'blade', v(0, 0, 1), { damage: 1, source: 'charge', breaks: true });   // (a charged cut: it reels, no armour's thunk)
  assert.ok(sounds.includes('hurt:tripod:machine'), sounds.join());
  foes.hurt(f, 'blade', v(0, 0, 1), { damage: 99, source: 'charge', breaks: true });
  for (let i = 0; i < 120 && f.dead === undefined; i++) foes.update(1 / 60);   // (it goes down first: src/enemies/defeat.js)
  assert.ok(sounds.includes('burst:tripod:machine'), sounds.join());
});

test('a shot that does nothing says so: a glance (spark and tick), no harm, no flinch; a shot that does something still lands', () => {
  for (const kind of ['drone', 'brute', 'tripod', 'bell']) {
    const f = new Foe(kind, v(0, 0, 4), { rng: () => 0.5 });
    f.state = 'wind'; f.k = 0.2; const hp = f.hp;
    assert.equal(f.hit('shoot', v(0, 0, 1), { source: 'shoot' }), 'glance', `${kind}: the shot glances`);
    assert.equal(f.hp, hp, `${kind}: no harm`);
    assert.equal(f.state, 'wind', `${kind}: its wind-up goes on (a shot that does nothing interrupts nothing)`);
  }
  // the cart's crust (a shot douses it), the hound and the shade lit by an ember: they do something, not a glance
  assert.notEqual(new Foe('cart', v(0, 0, 4)).hit('shoot', v(0, 0, 1), { source: 'shoot' }), 'glance');
  assert.notEqual(new Foe('shade', v(0, 0, 4)).hit('fire', v(0, 0, 1), { source: 'fire' }), 'glance');
  assert.notEqual(new Foe('blot', v(0, 0, 4)).hit('shoot', v(0, 0, 1), { source: 'shoot' }), 'glance');
  const { foes, sounds } = arena();
  const d = foes.add('drone', v(0, 0, 4));
  foes.hurt(d, 'shoot', v(0, 0, 1), { source: 'shoot' });
  assert.deepEqual(sounds, ['glance']);
});
