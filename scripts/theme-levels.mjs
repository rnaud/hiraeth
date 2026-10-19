// The recorded themes' balance for the engines (docs/systems/audio.md, "The recordings in Unity"): the gain the web's
// prepareSoundtrack gives each file (src/soundtracks.js: THEME_RMS dB RMS, -21 since issue #530, with a peak cap,
// measured on the tail joined to the opening), measured once here and written to src/theme-levels.js. An engine decodes and streams the MP3 itself
// (engine/webaudio.js NativeAudioBuffer) and never holds its samples in the script, so it can't measure them there.
//
//   node scripts/theme-levels.mjs        # macOS: afconvert decodes the MP3s
//
// Run it again when a recording is added or replaced; tests/soundtracks.test.js fails while one is missing.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tempDir, removeTemp } from './temp-dirs.mjs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AudioContext } from '../engine/webaudio.js';
import { prepareSoundtrack, THEME_RMS, THEME_PEAK } from '../src/soundtracks.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MUSIC = join(ROOT, 'public', 'music');

/** A float WAV (afconvert -d LEF32) as { rate, channels: Float32Array[] }. */
function readWav(path) {
  const b = readFileSync(path);
  let i = 12, fmt = null;
  while (i + 8 <= b.length) {
    const id = b.toString('ascii', i, i + 4), size = b.readUInt32LE(i + 4), at = i + 8;
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(at + 2), rate: b.readUInt32LE(at + 4), bits: b.readUInt16LE(at + 14) };
    if (id === 'data') {
      if (!fmt || fmt.bits !== 32) throw new Error(`${path}: not float32`);
      const n = Math.floor(size / 4 / fmt.channels), all = new Float32Array(b.buffer.slice(b.byteOffset + at, b.byteOffset + at + n * 4 * fmt.channels));
      const channels = Array.from({ length: fmt.channels }, (_, c) => { const d = new Float32Array(n); for (let k = 0; k < n; k++) d[k] = all[k * fmt.channels + c]; return d; });
      return { rate: fmt.rate, channels };
    }
    i = at + size + (size & 1);
  }
  throw new Error(`${path}: no data`);
}

/** The gain prepareSoundtrack applies to this file, and the loudest sample it gives (its peak after the gain). */
export function themeLevel(path, tmp) {
  const wav = join(tmp, 'x.wav');
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEF32', path, wav]);
  const { rate, channels } = readWav(wav);
  rmSync(wav);
  const ctx = new AudioContext({ sampleRate: rate });
  const buf = ctx.createBuffer(channels.length, channels[0].length, rate);
  channels.forEach((d, c) => buf.getChannelData(c).set(d));
  const out = prepareSoundtrack(ctx, buf);
  // (past the joined opening the samples are the original's times the gain)
  const a = buf.getChannelData(0), o = out.getChannelData(0), from = buf.length - out.length;
  let best = from;
  for (let k = from; k < out.length; k++) if (Math.abs(a[k]) > Math.abs(a[best])) best = k;
  let peak = 0;
  for (let c = 0; c < out.numberOfChannels; c++) for (const v of out.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  return { gain: o[best] / a[best], peak };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tmp = tempDir('theme-levels-');
  const levels = {}, peaks = {};
  try {
    for (const f of readdirSync(MUSIC).filter((x) => x.endsWith('.mp3')).sort()) {
      const { gain, peak } = themeLevel(join(MUSIC, f), tmp);
      levels[f] = +gain.toFixed(4); peaks[f] = +(20 * Math.log10(peak)).toFixed(1);
      console.log(`${f}: ${levels[f]} (${(20 * Math.log10(levels[f])).toFixed(1)} dB), its loudest sample ${peaks[f]} dBFS`);
    }
  } finally { removeTemp(tmp); }
  const body = Object.entries(levels).map(([k, v]) => `  '${k}': ${v},`).join('\n');
  const peakBody = Object.entries(peaks).map(([k, v]) => `  '${k}': ${v},`).join('\n');
  writeFileSync(join(ROOT, 'src', 'theme-levels.js'), `// Made by scripts/theme-levels.mjs: the gain src/soundtracks.js prepareSoundtrack gives each recording (THEME_RMS dB RMS
// with a peak cap, its tail joined to its opening), for the engines, which decode and stream the MP3s themselves and never
// hold their samples (engine/webaudio.js NativeAudioBuffer). Run it again when a recording is added or replaced, or the
// target changes (tests/soundtracks.test.js fails while THEME_TARGET is not src/soundtracks.js's).
export const THEME_TARGET = { rms: ${THEME_RMS}, peak: ${THEME_PEAK} };
export const THEME_LEVELS = {
${body}
};
// each recording's loudest sample at that gain, dBFS (under the cap, 20 log10(THEME_PEAK): nothing clips)
export const THEME_PEAKS = {
${peakBody}
};
`);
  console.log(`src/theme-levels.js: ${Object.keys(levels).length} recordings`);
}
