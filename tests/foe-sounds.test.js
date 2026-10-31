// The foes' voices and movement (issue #771, src/foe-sounds.js): every foe calls, cries, strikes, idles, moves and dies
// with a sound of its body; under the traveller's, never machine-gunning (caps, gaps, variation). Rendered silently, in
// memory, on the engine's Web Audio (engine/webaudio.js): nothing reaches a speaker.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AudioContext, AudioReplay } from '../engine/webaudio.js';
import { Sound } from '../src/audio.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { voiceLength } from '../src/foe-voices.js';
import { FOE_TRIM } from '../src/foe-sound-trims.js';
import { FOE_CALLS, FOE_MOVES, FOE_BLOWS, FOE_SOUND, FoeSounds, attackSort, blowLayers, callKey, callsOf, moveKey, movesOf, isMetal, dying, bodyPitch, bodyLoud, trimOf } from '../src/foe-sounds.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const fightRng = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const RATE = 24000;
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const BUILT = Object.entries(ARCHETYPES).filter(([, A]) => A.status === 'built');
const EVENTS = ['alert', 'cry', 'bark', 'idle'];
const LAYERS = ['noise', 'tone', 'ring', 'clicks', 'growl'];
const foeOf = (id, at = v()) => { const A = ARCHETYPES[id]; return { kind: A.kind, archetype: id, def: A.def, pos: at, get chest() { return this.pos; }, state: 'chase', alive: true }; };

/** A stand-in Sound that writes down what it is asked (foeSay): the layers, where, how loud; each sounds its layers' length. */
function ear() {
  const calls = [];
  return { calls, sound: { foeSay: (layers, pos, o) => { calls.push({ layers, pos, k: o?.k ?? 1, warn: !!o?.warn }); return voiceLength(layers); } } };
}

test('every archetype has a full set: a call, a cry, an effort, an idle, a death cry, its steps, and a sound for every blow', () => {
  assert.ok(BUILT.length >= 25);
  for (const [id, A] of BUILT) {
    const f = foeOf(id), V = callsOf(f), M = movesOf(f);
    assert.ok(V, `${id}: a voice`);
    assert.equal(callKey(f), FOE_CALLS[A.kind] ? A.kind : A.sound, `${id}: its kind's own voice, else its family's (${A.sound})`);
    for (const e of EVENTS) {
      assert.ok(V[e]?.length, `${id}: its ${e}`);
      for (const L of V[e]) assert.ok(LAYERS.includes(L.p), `${id} ${e}: a known layer (${L.p})`);
      assert.equal(typeof FOE_TRIM.calls[callKey(f)]?.[e], 'number', `${id}: its ${e} trimmed (scripts/sound-qc/foe-levels.mjs)`);
    }
    assert.equal(typeof FOE_TRIM.calls[callKey(f)]?.death, 'number', `${id}: its death cry trimmed`);
    assert.ok(M?.step?.length && (M.stride > 0 || M.period > 0), `${id}: how it moves (${A.plan})`);
    assert.equal(moveKey(f), A.plan, `${id}: its plan's movement`);
    assert.equal(typeof FOE_TRIM.moves[moveKey(f)], 'number', `${id}: its steps trimmed`);
    for (const a of A.def.attacks ?? []) {
      const sort = attackSort(a, isMetal(f));
      assert.ok(sort in FOE_BLOWS, `${id} ${a.id}: a blow (${sort})`);
      if (sort !== 'call' && sort !== 'none') assert.equal(typeof FOE_TRIM.blows[sort], 'number', `${id} ${a.id}: its ${sort} trimmed`);
    }
  }
  // (every voice written has its trims, none stale)
  for (const k of Object.keys(FOE_CALLS)) assert.ok(FOE_TRIM.calls[k], `${k} trimmed`);
  for (const k of Object.keys(FOE_MOVES)) assert.equal(typeof FOE_TRIM.moves[k], 'number', `${k} trimmed`);
  for (const k of Object.keys(FOE_TRIM.calls)) assert.ok(FOE_CALLS[k], `no stale trim (${k})`);
});

test('short enough: a call, a cry and an idle under a second, an effort and a step a short one, a death cry under 1.5 s', () => {
  const most = { alert: 1, cry: 1, bark: 0.5, idle: 1 };
  for (const [k, V] of Object.entries(FOE_CALLS)) {
    for (const e of EVENTS) assert.ok(voiceLength(V[e]) <= most[e] + 1e-9, `${k} ${e}: ${voiceLength(V[e]).toFixed(2)} s`);
    assert.ok(voiceLength(dying(V.alert)) <= 1.5, `${k} death`);
  }
  for (const [k, M] of Object.entries(FOE_MOVES)) assert.ok(voiceLength(M.step) <= 0.6, `${k} step: ${voiceLength(M.step)} s`);
  for (const s of Object.keys(FOE_BLOWS)) assert.ok(voiceLength(blowLayers(s, { strike: 0.7, contact: 0.6 })) <= 1.2, `${s} blow`);
});

test('a blow sounds as what it is, by its keys and shape, not its id or its roster: a melee foe given a shot sounds a shot', () => {
  const metal = true;
  assert.equal(attackSort({ id: 'lash', shape: 'cone', range: 2.9, damage: 0.5 }), 'swing');
  assert.equal(attackSort({ id: 'lash', shape: 'cone', range: 2.9, damage: 0.5 }, metal), 'swing-metal');
  assert.equal(attackSort({ id: 'lash', shape: 'lane', range: 10, width: 0.8, damage: 0.5 }), 'spit', 'the root knot turned ranged: a shot');
  assert.equal(attackSort({ id: 'x', shape: 'lane', range: 14, damage: 0.5 }, metal), 'bolt', 'a machine\'s: a bolt');
  assert.equal(attackSort({ id: 'x', shape: 'ring', at: 'target', lob: true, instant: true, damage: 0.5 }), 'lob');
  assert.equal(attackSort({ id: 'x', shape: 'ring', at: 'self', wave: {}, damage: 1 }), 'slam');
  assert.equal(attackSort({ id: 'x', shape: 'lane', lunge: 8, sweep: true, damage: 1 }), 'charge');
  assert.equal(attackSort({ id: 'x', shape: 'ring', at: 'self', damage: 1 }), 'blast');
  assert.equal(attackSort({ id: 'volley', weapon: 'bow', shape: 'lane', range: 16, damage: 0.5 }), 'bow');
  assert.equal(attackSort({ id: 'x', ball: {}, damage: 1 }), 'none', 'the fireball has its own');
  assert.equal(attackSort({ id: 'x', ward: {}, damage: 0 }), 'cast');
  assert.equal(attackSort({ id: 'roar', horn: 12, damage: 0 }), 'call');
  // the slam's weight lands at its contact
  const L = blowLayers('slam', { strike: 0.5, contact: 0.6 });
  assert.ok(L.some((x) => Math.abs(x.at - 0.3) < 1e-9), 'the impact at strike x contact');
  assert.ok(blowLayers('slam', {}, true).every((x) => (x.at ?? 0) < 0.05), 'instant: at once');
});

test('a body sounds its size: a hulk is a grunt\'s voice, lower and a little louder; a skitter quieter', () => {
  const g = foeOf('grunt'), h = foeOf('hulk'), s = foeOf('skitter');
  assert.equal(callKey(g), callKey(h));
  assert.ok(bodyPitch(h, callsOf(h).ref) < bodyPitch(g, callsOf(g).ref) * 0.8);
  assert.ok(bodyLoud(h) > bodyLoud(g) && bodyLoud(s) < bodyLoud(g));
  for (const id of Object.keys(ARCHETYPES)) { const f = foeOf(id), p = bodyPitch(f, callsOf(f).ref); assert.ok(p >= FOE_SOUND.pitch[0] && p <= FOE_SOUND.pitch[1], id); }
});

test('never machine-gunning: a pack spotting you calls once or twice, never all at once; cries and blows capped; each take apart', () => {
  // six of one kind notice at once: one call (kindGap)
  let E = ear(), fs = new FoeSounds(() => E.sound);
  const pack = [0, 1, 2, 3, 4, 5].map((i) => foeOf('grunt', v(i, 0, 5)));
  for (const f of pack) fs.call(f, 'alert');
  assert.equal(E.calls.length, 1, 'one kind: one call');
  // six of six kinds: no more than `low` calls over each other
  E = ear(); fs = new FoeSounds(() => E.sound);
  for (const id of ['grunt', 'crab', 'tripod', 'blot', 'hound', 'drone']) fs.call(foeOf(id, v(0, 0, 5)), 'alert');
  assert.equal(E.calls.length, FOE_SOUND.low, `at most ${FOE_SOUND.low} calls at once`);
  // five winding up together: at most `cap` cries
  E = ear(); fs = new FoeSounds(() => E.sound);
  const five = ['grunt', 'crab', 'tripod', 'blot', 'hound'].map((id) => foeOf(id, v(0, 0, 4)));
  for (const f of five) fs.event(f, ['warn']);
  assert.equal(E.calls.length, FOE_SOUND.cap, `at most ${FOE_SOUND.cap} cries`);
  // and once they have died away, the next is heard again
  fs.frame(1.5, null, []);
  fs.event(five[0], ['warn']);
  assert.equal(E.calls.length, FOE_SOUND.cap + 1, 'heard again once the others are over');
  // blows: at most `blows` at once
  E = ear(); fs = new FoeSounds(() => E.sound);
  for (const f of five) fs.blow(f, { id: 'club', shape: 'cone', range: 2, damage: 0.5 });
  assert.equal(E.calls.length, FOE_SOUND.cap + FOE_SOUND.blows, `five blows at once: ${FOE_SOUND.cap} efforts and ${FOE_SOUND.blows} blows (${E.calls.length})`);
  // each take a little apart: the same call twice, in pitch and level
  E = ear(); fs = new FoeSounds(() => E.sound);
  const g = foeOf('grunt');
  fs.voice(g, 'alert'); fs.frame(2, null, []); fs.voice(g, 'alert');
  assert.equal(E.calls.length, 2);
  assert.notEqual(E.calls[0].layers.find((L) => L.p === 'growl').f, E.calls[1].layers.find((L) => L.p === 'growl').f, 'pitched apart');
  assert.notEqual(E.calls[0].k, E.calls[1].k, 'levelled apart');
});

test('gaps: one foe never calls twice within its alert gap, nor cries twice within its cry gap', () => {
  const E = ear(), fs = new FoeSounds(() => E.sound), f = foeOf('hound', v(0, 0, 5));
  fs.call(f, 'alert'); fs.frame(1, null, []); fs.call(f, 'alert');
  assert.equal(E.calls.length, 1, 'no second call a second later');
  fs.frame(FOE_SOUND.alertGap, null, []); fs.call(f, 'alert');
  assert.equal(E.calls.length, 2, 'again after its gap');
  const n = E.calls.length;
  fs.frame(2, null, []);
  fs.event(f, ['warn']); fs.frame(0.3, null, []); fs.event(f, ['warn']);
  assert.equal(E.calls.filter((c) => c.warn).length, 1, 'one cry within its gap');
  assert.ok(E.calls.length >= n + 1);
});

test('steps: only the nearest few movers, within reach, and never more than so many a second', () => {
  const E = ear(), fs = new FoeSounds(() => E.sound, { rng: () => 0.5 });
  const P = { pos: v() };
  const near = [1, 2, 3, 4, 5, 6].map((i) => foeOf('grunt', v(i, 0, 2)));
  const far = foeOf('hulk', v(30, 0, 0));
  const all = [...near, far];
  for (const f of all) f.state = 'chase';
  fs.frame(0, P, all);
  for (let i = 0; i < 120; i++) { for (const f of all) f.pos.z += 4 / 60; fs.frame(1 / 60, P, all); }   // (2 s, walking at 4 m/s)
  const steps = E.calls.filter((c) => typeof c.pos === 'function' && near.slice(3).some((f) => c.pos() === f.pos));
  assert.equal(steps.length, 0, 'none from the fourth nearest and on');
  assert.ok(!E.calls.some((c) => typeof c.pos === 'function' && c.pos() === far.pos), 'none from one 30 m off');
  const stepCalls = E.calls.filter((c) => typeof c.pos === 'function' && near.slice(0, 3).some((f) => c.pos() === f.pos));
  assert.ok(stepCalls.length > 4, `the near ones are heard (${stepCalls.length})`);
  assert.ok(stepCalls.length <= FOE_SOUND.steps.perSec * 2 + 1, `at most ${FOE_SOUND.steps.perSec} a second (${stepCalls.length} in 2 s)`);
});

test('idles: now and then while near, never from far off; a fallen foe cries out once', () => {
  let E = ear(), fs = new FoeSounds(() => E.sound);
  const P = { pos: v() }, f = foeOf('toad', v(0, 0, 6));
  f.state = 'idle';
  for (let i = 0; i < 60 * 40; i++) fs.frame(1 / 60, P, [f]);
  assert.ok(E.calls.length >= 2 && E.calls.length <= 6, `a few idles in 40 s (${E.calls.length})`);
  E = ear(); fs = new FoeSounds(() => E.sound);
  f.pos.set(0, 0, 40);
  for (let i = 0; i < 60 * 40; i++) fs.frame(1 / 60, P, [f]);
  assert.equal(E.calls.length, 0, 'none 40 m off');
  E = ear(); fs = new FoeSounds(() => E.sound);
  const g = foeOf('grunt', v(0, 0, 4));
  fs.frame(1 / 60, P, [g]);
  g.dying = { t: 0 }; g.alive = false;
  for (let i = 0; i < 30; i++) fs.frame(1 / 60, P, [g]);
  assert.equal(E.calls.length, 1, 'one death cry');
});

test('the foes voice it: spotting you, winding up, striking, each at its chest; a fallen one cries out; the burst where it fell', () => {
  clearTargets();
  const said = [], other = [];
  const P = { pos: v(0, 0, 0), vel: v(), heading: 0, onGround: true, ride: null, down: null, dead: false, health: 1, opts: {}, hurt() {}, knockDown() { return true; }, guard: () => null, dodge: () => false };
  const sound = { foeSay: (layers, pos, o) => { said.push({ layers, pos, warn: !!o?.warn }); return voiceLength(layers); }, foeHurt() {}, foeBurst: (k, s, pos) => other.push({ e: 'burst', pos }), foeGlance() {}, foeArmour() {}, whoosh() {}, foeWarn() {}, combat() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, sound,
    settings: { enemies: 'normal' }, game: new GameState(null), notice() {}, rng: fightRng() });
  foes.waveRest = 1e9;
  const f = foes.add('grunt', v(0, 0, 3));
  for (let i = 0; i < 1500 && !said.some((c) => c.warn); i++) foes.update(1 / 60);
  assert.ok(said.length >= 2, `a call and a cry (${said.length})`);
  assert.ok(said.some((c) => c.warn), 'its wind-up cry');
  for (const c of said) { const p = typeof c.pos === 'function' ? c.pos() : c.pos; assert.ok(p && p.distanceTo(f.chest) < 1e-6 || p.distanceTo(f.pos) < 1e-6, 'at the foe'); }
  const n = said.length;
  for (let i = 0; i < 240 && said.length < n + 2; i++) foes.update(1 / 60);
  assert.ok(said.length >= n + 1, 'its blow');
  foes.hurt(f, 'blade', v(0, 0, 1), { damage: 99, source: 'charge', breaks: true });
  const m = said.length;
  for (let i = 0; i < 240 && f.dead === undefined; i++) foes.update(1 / 60);
  assert.ok(said.length > m, 'its death cry');
  const b = other.find((x) => x.e === 'burst');
  assert.ok(b && (typeof b.pos === 'function' ? b.pos() : b.pos), 'the burst placed');
});

// ---- rendered: the growl, and the trimmed voices sitting together
function box(record = false) {
  const ctx = new AudioContext({ sampleRate: RATE, record });
  const fx = ctx.createGain(); fx.connect(ctx.destination);
  const nb = ctx.createBuffer(1, RATE * 2, RATE), d = nb.getChannelData(0);
  let s = 12345; for (let i = 0; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const S = Object.create(Sound.prototype);
  Object.assign(S, { ctx, fx, noiseBuf: nb, muted: false });
  return { S, ctx };
}
const left = (ctx, secs) => { const st = ctx.render(Math.round(secs * RATE)); const out = new Float32Array(st.length / 2); for (let i = 0; i < out.length; i++) out[i] = st[i * 2]; return out; };
const loudest = (a) => { const n = Math.round(0.05 * RATE); let top = 0; for (let i = 0; i + n <= a.length; i += n >> 1) { let s = 0; for (let j = i; j < i + n; j++) s += a[j] * a[j]; top = Math.max(top, Math.sqrt(s / n)); } return 20 * Math.log10(Math.max(top, 1e-9)); };
const seeded = (f) => { const rnd = Math.random; let s = 7; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); try { return f(); } finally { Math.random = rnd; } };

test('rendered: a growl sounds and dies away, no sample over full scale; placed, it is heard from its side', () => {
  const { S, ctx } = box();
  seeded(() => S.foeSay(FOE_CALLS.flesh.alert, null));
  const out = left(ctx, 1);
  const pk = out.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  assert.ok(pk > 0.005 && pk < 0.9, `heard, under full scale (${pk})`);
  assert.ok(loudest(out.subarray(Math.round(0.8 * RATE))) < loudest(out) - 30, 'over by 0.8 s');
  const B = box(); B.S._ear = { x: 0, y: 0, z: 0, yaw: 0 };
  seeded(() => B.S.foeSay(FOE_CALLS.flesh.alert, v(6, 0, -1)));
  const st = B.ctx.render(Math.round(0.6 * RATE)); let l = 0, r = 0;
  for (let i = 0; i < st.length; i += 2) { l += st[i] * st[i]; r += st[i + 1] * st[i + 1]; }
  assert.ok(r > l * 4, 'on the right');
});

test('rendered and trimmed: each event\'s voices sit within a few dB of each other across every family (none lost, none blaring)', () => {
  for (const e of ['alert', 'cry', 'idle']) {
    const lv = {};
    for (const [k, V] of Object.entries(FOE_CALLS)) {
      const { S, ctx } = box();
      seeded(() => S.foeSay(V[e], null, { k: trimOf('calls', k, e) }));
      lv[k] = loudest(left(ctx, 1.2));
    }
    const vals = Object.values(lv), mid = vals.slice().sort((a, b) => a - b)[vals.length >> 1];
    for (const [k, x] of Object.entries(lv)) assert.ok(Math.abs(x - mid) < 8, `${e} ${k}: ${x.toFixed(1)} dB against the median ${mid.toFixed(1)}`);
  }
  // and the targets keep the order: an idle under a call, a step under both
  const T = FOE_SOUND.target;
  assert.ok(T.idle < T.alert && T.step < T.idle && T.bark < T.alert);
});

test('the Unity bridge plays it the same: a growl and a blow recorded, replayed on the audio thread, render as here', () => {
  const blocks = Math.ceil((0.8 * RATE) / 128);
  const play = (S) => seeded(() => { S.foeSay(FOE_CALLS.hide.alert, null); S.foeSay(blowLayers('slam', { strike: 0.4, contact: 0.5 }), null); });
  const here = box(); play(here.S);
  const a = here.ctx.render(blocks * 128);
  const there = box(true); play(there.S);
  const b = new AudioReplay(RATE).apply(there.ctx.takeOps(blocks)).pcm;
  assert.equal(b.length, a.length);
  let most = 0, top = 0;
  for (let i = 0; i < a.length; i++) { most = Math.max(most, Math.abs(a[i] - b[i])); top = Math.max(top, Math.abs(a[i])); }
  assert.ok(top > 0.01 && most < top * 1e-3, `the same samples (${most} off, of ${top})`);
});
