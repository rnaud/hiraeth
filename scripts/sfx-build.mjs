// The recorded sound effects (public/sfx/): small mono MP3s cut from CC0 recordings, and their manifest.
// Every source is public domain (CC0 1.0): Kenney's Impact Sounds and RPG Audio packs, and single
// Freesound sounds whose pages say "Creative Commons 0" (their HQ previews). docs/credits.md lists them.
//
//   node scripts/sfx-build.mjs <sources>     (needs sox and lame on the PATH)
//
// <sources> is a folder holding what was downloaded, as it was unpacked:
//   kenney-impact/Audio/*.ogg     https://kenney.nl/assets/impact-sounds
//   kenney-rpg/Audio/*.ogg        https://kenney.nl/assets/rpg-audio
//   freesound/<id>.mp3            https://freesound.org/s/<id>/ (HQ preview)
//   slices/<set>/eNN.wav          events cut from the longer Freesound takes (an RMS envelope above the
//                                 noise floor, 30 ms before, 80 ms after); the set says which take
// Each file is trimmed of leading silence, high-passed, peak-normalised to -1 dBFS, faded out, and
// encoded at 64 kb/s mono 44.1 kHz (the game sets each sound's level: src/sfx.js SFX).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'sfx');

const K = (f) => ({ src: `kenney-impact/Audio/${f}.ogg`, from: 'Kenney, Impact Sounds', url: 'https://kenney.nl/assets/impact-sounds' });
const R = (f) => ({ src: `kenney-rpg/Audio/${f}.ogg`, from: 'Kenney, RPG Audio', url: 'https://kenney.nl/assets/rpg-audio' });
const FS = { 504626: 'leonelmail', 346694: 'deleted_user_2104797', 444726: 'gtrempe', 610998: 'unfa', 547209: 'MrFossy', 569568: 'ValentinPetiteau', 146769: 'elle-trudgett', 60013: 'qubodup', 59988: 'qubodup', 389590: 'Jofae', 420668: 'SypherZent', 352719: 'Dalesome', 445109: 'Breviceps', 495118: 'nebulasnails', 495117: 'nebulasnails', 360942: 'gprosser', 19290: 'martian', 280205: 'memuse', 438845: 'craigsmith', 390391: 'N-RAZM', 683101: 'florianreichelt' };
const F = (id, slice = null) => ({ src: slice ? `slices/${slice}.wav` : `freesound/${id}.mp3`, from: `Freesound #${id} by ${FS[id]}`, url: `https://freesound.org/s/${id}/` });

// name: [source, { len: s at most, lp: low-pass Hz, hp: high-pass Hz, gain: dB after normalising }]
export const RECIPE = {
  // footsteps by ground (the level profile's: stone, grass, sand)
  ...Object.fromEntries([0, 1, 2, 3, 4].flatMap((i) => [
    [`step-stone-${i}`, [K(`footstep_concrete_00${i}`), { len: 0.25 }]],
    [`step-grass-${i}`, [K(`footstep_grass_00${i}`), { len: 0.45, lp: 7000 }]],
    [`step-sand-${i}`, [K(`footstep_snow_00${i}`), { len: 0.35, lp: 3800 }]],
  ])),
  // landings: a soft body thump, a heavy one; a body falling (knocked down)
  ...Object.fromEntries([0, 1, 2].map((i) => [`land-${i}`, [K(`impactSoft_medium_00${i}`), { len: 0.25 }]])),
  ...Object.fromEntries([0, 1, 2].map((i) => [`land-heavy-${i}`, [K(`impactSoft_heavy_00${i}`), { len: 0.5 }]])),
  'fall-0': [F(504626), { len: 1.2, lp: 6000 }],
  'fall-1': [F(346694), { len: 1.2, lp: 6000 }],
  // cloth and gear: the climb's grab, the roll, getting up, the jump's rustle, a pick-up
  ...Object.fromEntries([1, 2, 3, 4].map((i) => [`cloth-${i - 1}`, [R(`cloth${i}`), { len: 0.6 }]])),
  'belt-0': [R('clothBelt'), { len: 0.5 }],
  'belt-1': [R('clothBelt2'), { len: 0.5 }],
  'grab-0': [R('handleSmallLeather'), { len: 0.5 }],
  'grab-1': [R('handleSmallLeather2'), { len: 0.5 }],
  'drop-0': [R('dropLeather'), { len: 0.5 }],
  // boxes: the lid's creak, the knock of a wobble
  ...Object.fromEntries([1, 2, 3].map((i) => [`creak-${i - 1}`, [R(`creak${i}`), { len: 1.2 }]])),
  ...Object.fromEntries([0, 1, 2].map((i) => [`knock-${i}`, [K(`impactWood_light_00${i}`), { len: 0.3 }]])),
  // the wings: a cloth flap opening and folding
  'flap-0': [F(19290, 'flap/e01'), { len: 0.7, lp: 6000 }],
  'flap-1': [F(19290, 'flap/e02'), { len: 0.6, lp: 6000 }],
  'flap-2': [F(280205, 'flap2/e01'), { len: 0.7, lp: 6000 }],
  'flap-3': [F(280205, 'flap2/e04'), { len: 0.7, lp: 6000 }],
  // the traveller's breath: soft exhales (a jump, now and then), harder ones (a mantle, a heavy cut)
  'breath-0': [F(444726, 'effort/e03'), { len: 0.6, lp: 5000, hp: 150 }],
  'breath-1': [F(444726, 'effort/e04'), { len: 0.6, lp: 5000, hp: 150 }],
  'breath-2': [F(444726, 'effort/e12'), { len: 0.55, lp: 5000, hp: 150 }],
  'breath-3': [F(444726, 'effort/e19'), { len: 0.6, lp: 5000, hp: 150 }],
  'effort-0': [F(444726, 'effort/e26'), { len: 0.7, lp: 5000, hp: 120 }],
  'effort-1': [F(444726, 'effort/e27'), { len: 0.7, lp: 5000, hp: 120 }],
  'effort-2': [F(444726, 'effort/e29'), { len: 0.7, lp: 5000, hp: 120 }],
  // a hurt: a short pained grunt, a sharp breath; getting up: a sigh
  'hurt-0': [F(610998, 'hurt/e01'), { len: 0.5, lp: 4500, hp: 120 }],
  'hurt-1': [F(610998, 'hurt/e02'), { len: 0.5, lp: 4500, hp: 120 }],
  'hurt-2': [F(610998, 'hurt/e04'), { len: 0.5, lp: 4500, hp: 120 }],
  'hurt-3': [F(547209), { len: 0.4, lp: 4500, hp: 120 }],
  'sigh-0': [F(569568, 'sigh/e03'), { len: 0.9, lp: 5000, hp: 120 }],
  'sigh-1': [F(569568, 'sigh/e04'), { len: 0.9, lp: 5000, hp: 120 }],
  'sigh-2': [F(146769, 'sigh2/e02'), { len: 1.3, lp: 5000, hp: 120 }],
  // the blade: the swing's air, the wet ink of a hit
  'swing-0': [F(60013), { len: 0.45 }],
  'swing-1': [F(59988), { len: 0.3 }],
  'swing-2': [F(389590), { len: 0.35 }],
  'swing-3': [F(420668), { len: 0.25 }],
  'swing-heavy-0': [F(352719), { len: 0.55, lp: 8000 }],
  'swing-heavy-1': [F(683101), { len: 0.7, lp: 8000 }],
  'splat-0': [F(445109), { len: 0.4 }],
  'splat-1': [F(495118), { len: 0.6 }],
  'splat-2': [F(495117), { len: 0.5 }],
  'splat-3': [F(360942), { len: 0.6, lp: 7000 }],
  // swimming: a stroke's wash, a small splash
  'stroke-0': [F(438845, 'swim/e02'), { len: 0.55 }],
  'stroke-1': [F(438845, 'swim/e04'), { len: 0.7 }],
  'stroke-2': [F(438845, 'swim/e05'), { len: 0.6 }],
  'stroke-3': [F(438845, 'swim/e11'), { len: 0.6 }],
  'stroke-4': [F(438845, 'swim/e13'), { len: 0.7 }],
  'splash-0': [F(390391, 'smallsplash/e01'), { len: 0.55 }],
  'splash-1': [F(390391, 'smallsplash/e02'), { len: 0.6 }],
  'splash-2': [F(390391, 'smallsplash/e03'), { len: 0.65 }],
};

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`);
  return r;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const SRC = resolve(process.argv[2] ?? '.');
  mkdirSync(OUT, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'sfx-'));
  const manifest = { licence: 'CC0 1.0 (public domain): every source below', made: 'node scripts/sfx-build.mjs', files: {} };
  let total = 0;
  for (const [name, [s, o]] of Object.entries(RECIPE)) {
    const wav = join(tmp, `${name}.wav`), mp3 = join(OUT, `${name}.mp3`);
    const fx = ['silence', '1', '0.002', '0.5%', 'trim', '0', String(o.len ?? 1)];
    fx.push('highpass', String(o.hp ?? 50));
    if (o.lp) fx.push('lowpass', String(o.lp));
    fx.push('norm', String(-1 + (o.gain ?? 0)), 'fade', 't', '0.003', '0', String(Math.min(0.12, (o.len ?? 1) * 0.3)));
    run('sox', [join(SRC, s.src), '-c', '1', '-r', '44100', '-b', '16', wav, ...fx]);
    run('lame', ['--quiet', '-b', '64', '-m', 'm', '--resample', '44.1', wav, mp3]);
    const size = statSync(mp3).size;
    total += size;
    manifest.files[name] = { from: s.from, url: s.url, file: s.src.split('/').slice(-2).join('/'), bytes: size };
  }
  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${Object.keys(RECIPE).length} files, ${(total / 1024).toFixed(0)} KB in public/sfx/`);
}
