// The foes' voices brought to their levels (issue #771, src/foe-sounds.js): each voice's call, cry, effort, idle and
// death cry, each body plan's step and each blow rendered on the game's own Sound (the sound QC's renderer:
// engine/webaudio.js in memory, nothing played out loud), measured as the QC measures (K-weighted, the loudest 50 ms,
// against the desert's music), and the dB that brings each to FOE_SOUND.target written to src/foe-sound-trims.js.
// It starts from the trims there (--fresh: from none) and corrects them `--passes` times, so the master's compressor
// (src/audio.js, -18 dBFS) squeezing a loud first take does not leave a voice too loud once trimmed.
//
//   node scripts/sound-qc/foe-levels.mjs [--takes 3] [--passes 2] [--fresh] [--check]   (--check: measure, write nothing)
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderer } from './render.mjs';
import { measure, envelope, kWeight, dB } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const TAKES = Number(arg('--takes', 3)), CHECK = has('--check'), PASSES = CHECK ? 1 : Number(arg('--passes', 2));
const R = await renderer({ samples: false });   // (the foes' voices are all synthesised: no takes to decode into every Sound)
const { FOE_CALLS, FOE_MOVES, FOE_BLOWS, FOE_SOUND, FoeSounds, blowLayers, trimOf } = await import('../../src/foe-sounds.js');
const { FOE_TRIM } = await import('../../src/foe-sound-trims.js');
const { pitched } = await import('../../src/foe-voices.js');
FOE_SOUND.loud.range = [1, 1];   // (each voice measured at its own body's loudness: the body's comes on top in the game)
if (has('--fresh')) { FOE_TRIM.calls = {}; FOE_TRIM.moves = {}; FOE_TRIM.blows = {}; }

// the music's reference, as the QC takes it (run.mjs): the desert's recording through the music bus, its 95th percentile
const ref = await (async () => {
  const s = await R.score('desert', { recording: true });
  if (!s.recorded) throw new Error('no recording');
  const lv = envelope(kWeight(s.pcm), s.rate).map(dB).sort((a, b) => a - b);
  return lv[Math.floor(lv.length * 0.95)];
})().catch(() => -25.7);   // (the desert's recording measured so on 29 October 2026, where it can't be decoded)

const median = (a) => { const v = a.filter((x) => x != null).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
/** The loudest 50 ms of `play(fs, foe, sound)` against the music, the median of TAKES takes; a foe at its voice's own height. */
async function level(play, height = 1) {
  const f = { kind: '-', archetype: '-', def: { height }, pos: { x: 0, y: 0, z: 0 }, chest: { x: 0, y: 0, z: 0 }, state: 'chase', alive: true };
  const got = [];
  for (let i = 0; i < TAKES; i++) {
    const r = await R.render((s) => play(new FoeSounds(() => s), f, s), { secs: 2.5, seed: 4100 + i * 31 });
    const m = measure(r.pcm, r.rate, { bed: r.bed });
    got.push(m ? m.rms - ref : null);
  }
  R.close();   // (let the rendered Sounds go: hundreds of them would fill the heap)
  return median(got);
}

function write() {
  const line = (o) => `{ ${Object.entries(o).map(([k, x]) => `${/^[a-z]+$/.test(k) ? k : `'${k}'`}: ${typeof x === 'number' ? x : line(x)}`).join(', ')} }`;
  const calls = Object.entries(FOE_TRIM.calls).filter(([k]) => FOE_CALLS[k]).map(([k, o]) => `    ${k}: ${line(o)},`).join('\n');
  writeFileSync(resolve(ROOT, 'src/foe-sound-trims.js'), `// Written by scripts/sound-qc/foe-levels.mjs (issue #771): the dB each foe voice, movement and blow of src/foe-sounds.js
// needs to land at its target against the music (FOE_SOUND.target), measured silently on the in-memory Web Audio.
// Rerun it after changing a voice there; tests/foe-sounds.test.js checks that every voice has its trims.
export const FOE_TRIM = {
  calls: {
${calls}
  },
  moves: ${line(Object.fromEntries(Object.entries(FOE_TRIM.moves).filter(([k]) => FOE_MOVES[k])))},
  blows: ${line(Object.fromEntries(Object.entries(FOE_TRIM.blows).filter(([k]) => FOE_BLOWS[k])))},
};
`);
  console.log('written src/foe-sound-trims.js');
}
const T = FOE_SOUND.target, rows = [];
const fix = (old = 0, got, target) => (got == null ? old : +(old + target - got).toFixed(1));
for (let pass = 0; pass < PASSES; pass++) {
  rows.length = 0;
  for (const [key, V] of Object.entries(FOE_CALLS)) {
    const row = FOE_TRIM.calls[key] ??= {};
    for (const ev of ['alert', 'cry', 'bark', 'idle', 'death']) {
      const got = await level((fs, f) => { f.kind = key; fs.voice(f, ev); }, V.ref);
      rows.push([`${key} ${ev}`, got, T[ev]]);
      if (!CHECK) row[ev] = fix(row[ev], got, T[ev]);
    }
  }
  for (const [key, M] of Object.entries(FOE_MOVES)) {
    const got = await level((fs, f, s) => s.foeSay(pitched(M.step, 1), f.pos, { k: trimOf('moves', key) }));
    rows.push([`${key} step`, got, T.step]);
    if (!CHECK) FOE_TRIM.moves[key] = fix(FOE_TRIM.moves[key], got, T.step);
  }
  for (const sort of Object.keys(FOE_BLOWS)) {
    if (['call', 'none', 'impact'].includes(sort)) continue;
    const got = await level((fs, f) => fs.say(f, blowLayers(sort), { voice: false, ref: 1, k: trimOf('blows', sort) }));
    rows.push([`${sort} blow`, got, T.blow]);
    if (!CHECK) FOE_TRIM.blows[sort] = fix(FOE_TRIM.blows[sort], got, T.blow);
  }
  const off = rows.filter(([, got, t]) => got != null).map(([, got, t]) => Math.abs(got - t));
  if (!CHECK) write();
  console.log(`pass ${pass + 1}: measured ${rows.length}, off its target by ${(off.reduce((a, b) => a + b, 0) / off.length).toFixed(1)} dB on average, ${Math.max(...off).toFixed(1)} at most${rows.some(([, g]) => g == null) ? '; silent: ' + rows.filter(([, g]) => g == null).map(([w]) => w).join(', ') : ''}`);
}
if (CHECK || has('--verbose')) for (const [what, got, t] of rows) console.log(`${what.padEnd(22)} ${got == null ? 'silent' : got.toFixed(1)} dB (target ${t})`);
console.log(`(the music's reference ${ref.toFixed(1)} dBFS)`);
process.exit(0);
