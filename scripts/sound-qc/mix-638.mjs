// The mix-hierarchy and repeated-event checks of issue #638 (docs/audits/mix-pacing-v2.28.md), offline on the
// in-memory Web Audio (engine/webaudio.js) through the sound QC's renderer: no browser, nothing played out loud.
//
//   node scripts/sound-qc/mix-638.mjs [--no-samples] > out.json
//
// 1. the hierarchy: each sound's loudest 50 ms (K-weighted), against a conversation's voice and the ambience bed
// 2. stacks: the same event fired for several foes in one frame (a guarded crowd in one swing, the shards' ring)
// 3. repeats: six takes of the guard's clang, a cut on armour (level / brightness spreads)
// 4. the voice against the ambience: a storm's wind with and without a line being spoken
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderer, RATE } from './render.mjs';
import * as L from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const samples = !process.argv.includes('--no-samples');
const R = await renderer({ samples });
const { planLine, voiceOf } = await import(join(ROOT, 'src/story/voice.js'));
const plan = planLine('~neutral~ We heard the tower speak tonight, all of us, over the market.', { voice: voiceOf({ id: 'qc', voice: 1 }), lang: 'desert' });
const peak = (pcm) => +L.measure(pcm, RATE).peak.toFixed(1);
const out = { samples: R.samples, hierarchy: {}, stacks: {}, repeats: {}, ambience: {} };

// 1. the hierarchy, each alone (bed subtracted)
const one = async (fn, secs = 2) => { const r = await R.render(fn, { secs }); return +L.measure(r.pcm, r.rate, { bed: r.bed }).peak.toFixed(1); };
const H = {
  'voice (a conversation line)': (s) => s.speak(plan, { channel: 'dialogue' }),
  'hit (a cut landing)': (s) => s.fluidSlashHit(true, false),
  'foe hurt': (s) => s.foeHurt('blot'),
  'guard clang': (s) => s.foeGlance(),
  'cut on armour': (s) => s.foeArmour(),
  'pickup': (s) => s.pickup(),
  'discovery': (s) => s.discovery(),
  'temple clock tick': (s) => s.templeTick('tick', 0.9),
  'temple clock urgent': (s) => s.templeTick('urgent', 0.9),
  'footstep, walking': (s) => s.step(3.6),
  'footstep, sprinting': (s) => s.step(8),
};
for (const [k, fn] of Object.entries(H)) out.hierarchy[k] = await one(fn, k.startsWith('voice') ? plan.total + 0.5 : 2);

// 2. stacks: n calls in the same frame (what the game does for n foes met at once)
const stack = async (fn, n) => one((s) => { for (let i = 0; i < n; i++) fn(s); });
out.stacks['guard clang ×1'] = await stack((s) => s.foeGlance(), 1);
out.stacks['guard clang ×3 (three guarded foes, one swing)'] = await stack((s) => s.foeGlance(), 3);
out.stacks['cut on armour ×3'] = await stack((s) => s.foeArmour(), 3);
// the shards' ring: SpellCaster.shardsCut on a fake ring of four foes, calls counted
{
  const { SpellCaster } = await import(join(ROOT, 'src/spells/caster.js'));
  const THREE = await import('three');
  const calls = [];
  const sound = new Proxy({}, { get: (_, k) => (...a) => calls.push(k) });
  const foes = Array.from({ length: 4 }, (_, i) => ({ alive: true, pos: new THREE.Vector3(Math.sin(i * 1.57) * 3, 0, Math.cos(i * 1.57) * 3), def: { radius: 0.6, height: 1 } }));
  const C = new SpellCaster({ sound, player: { pos: new THREE.Vector3() }, foes: () => ({ list: foes, hurt: () => {} }), game: { emit() {} } });
  C.active = { id: 'shards', cut: new Map() };
  C.shardsCut(0.016, { r: 3, reach: 0.6, damage: 1, every: 0.5 }, new THREE.Vector3(0, 1, 0));
  out.stacks['shards: slash-hit calls for four foes cut in one frame'] = calls.filter((c) => c === 'fluidSlashHit').length;
  const n = out.stacks['shards: slash-hit calls for four foes cut in one frame'];
  out.stacks['shards: four foes cut in one frame, level'] = await stack((s) => s.fluidSlashHit(true), n);
}

// 3. repeats: six takes on different seeds
for (const [k, fn] of Object.entries({ 'guard clang': (s) => s.foeGlance(), 'cut on armour': (s) => s.foeArmour() })) {
  const takes = [];
  for (let i = 0; i < 6; i++) { const r = await R.render(fn, { seed: 1000 + 37 * i }); takes.push(L.measure(r.pcm, r.rate, { bed: r.bed })); }
  const v = L.variation(takes);
  out.repeats[k] = { level: +v.level.toFixed(2), centroid: +v.centroid.toFixed(2) };
}

// 4. the ambience under a voice: a storm (gust 1, storm 1), the bed's loudest 50 ms and its RMS, with a line spoken
// (the duck held) and without
const STORM = { speed: 0, gust: 1, storm: 1, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };
const bed = async (talk, STATE = STORM) => {
  const s = await R.fresh('desert', 4242);
  s.update(STATE); s.ctx.render(RATE);   // (the layers settle: a second)
  if (talk) s._duckUntil = s.ctx.currentTime + 10;
  const chunks = [];
  for (let i = 0; i < 30; i++) { s.update(STATE); chunks.push(s.ctx.render(Math.round(RATE * 0.1))); }
  const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const tail = all.subarray(all.length / 2);   // (the last 1.5 s: the duck settled)
  const m = L.measure(tail, RATE);
  return { peak: +m.peak.toFixed(1), rms: +m.rms.toFixed(1) };
};
out.ambience['storm wind, nobody speaking'] = await bed(false);
out.ambience['storm wind, under a conversation line'] = await bed(true);
const FALLS = { ...STORM, gust: 0, storm: 0, roar: 1 };
out.ambience['a waterfall\'s roar close by, nobody speaking'] = await bed(false, FALLS);
out.ambience['a waterfall\'s roar close by, under a line'] = await bed(true, FALLS);
out.ambience['voice against the storm wind under it (rms dB)'] = +(L.measure((await R.render((s) => s.speak(plan, { channel: 'dialogue' }), { secs: plan.total + 0.5 })).pcm, RATE).rms - out.ambience['storm wind, under a conversation line'].rms).toFixed(1);
out.ambience['voice against the falls under it (rms dB)'] = +(out.ambience['voice against the storm wind under it (rms dB)'] + out.ambience['storm wind, under a conversation line'].rms - out.ambience['a waterfall\'s roar close by, under a line'].rms).toFixed(1);
R.close();
console.log(JSON.stringify(out, null, 2));
process.exit(0);
