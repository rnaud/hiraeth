// The sound QC's renderer (.claude/skills/sound-qc/SKILL.md): the game's own Sound (src/audio.js) on the in-memory Web
// Audio (engine/webaudio.js), calm, its score off, one call rendered from the moment it is made. The recorded takes
// (public/sfx/) read as PCM WAV or decoded by afconvert/ffmpeg into the content-hashed cache, so a sound is measured as the browser plays
// it; without them, the explicit decode-unavailable fallback (not current native decoder parity).
//
//   const R = await renderer({ samples: true, cache })
//   R.render((s) => s.fluidSlash(0), { level: 'desert', secs: 2, setup })  → { pcm, bed, rate }
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sfxFiles } from '../../src/sfx.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** A 16-bit PCM WAV's channels as Float32Arrays, and its rate. */
export function readWav(buf) {
  let p = 12, ch = 1, rate = 44100, bits = 16, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), n = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = buf.readUInt16LE(p + 10); rate = buf.readUInt32LE(p + 12); bits = buf.readUInt16LE(p + 22); }
    if (id === 'data') { data = buf.subarray(p + 8, p + 8 + n); break; }
    p += 8 + n + (n & 1);
  }
  if (!data || bits !== 16) throw new Error('not a 16-bit WAV');
  const frames = Math.floor(data.length / 2 / ch), out = Array.from({ length: ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) out[c][i] = data.readInt16LE((i * ch + c) * 2) / 32768;
  return { rate, channels: out };
}

/**
 * Each take/theme is read as WAV or decoded once (afconvert, then ffmpeg) into `cache`;
 * null only where decoding fails, retaining the explicit synth/procedural-score fallback.
 */
export function decodedTakes(cache, from = 'public/sfx', root = ROOT) {
  mkdirSync(cache, { recursive: true });
  const takes = new Map();
  return (name) => {
    let got = null, key = null;
    try {
      const source = join(root, from, name), bytes = readFileSync(source);
      const hash = createHash('sha256').update(bytes).digest('hex');
      key = `${name}:${hash}:${RATE}`;
      if (takes.has(key)) return takes.get(key);
      if (/\.wav$/i.test(name)) got = readWav(bytes);
      else {
        const wav = join(cache, `${name.replace(/\.mp3$/i, '')}-${hash}-${RATE}.wav`);
        if (!existsSync(wav)) {
          try { execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${RATE}`, source, wav], { stdio: 'ignore' }); }
          catch { execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-ar', String(RATE), '-c:a', 'pcm_s16le', wav], { stdio: 'ignore' }); }
        }
        got = readWav(readFileSync(wav));
      }
      takes.set(key, got);
    } catch { got = null; }
    if (key) takes.set(key, got);
    return got;
  };
}

/** Real-file decoder for the Node VM harness: decode the exact packaged bytes, never fake readiness. */
export function installEffectFileDecoder(AudioContext, { cache = join(tmpdir(), 'hiraeth-sound-qc-takes') } = {}) {
  const names = new Map(sfxFiles().map(name => [createHash('sha256').update(readFileSync(join(ROOT, 'public/sfx', name))).digest('hex'), name]));
  const read = decodedTakes(cache);
  AudioContext.prototype.decodeAudioData = async function(data) {
    const name = names.get(createHash('sha256').update(Buffer.from(data)).digest('hex'));
    const pcm = name && read(name);
    if (!pcm) throw new Error(`No packaged effect decoder result for ${name ?? 'unknown bytes'}`);
    const buffer = this.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.rate);
    pcm.channels.forEach((channel, i) => buffer.getChannelData(i).set(channel));
    return buffer;
  };
}

export { RATE, CALM, themeOf, seeded } from './render-core.mjs';
import { RATE, renderAudio } from './render-core.mjs';

export async function renderer({ samples = true, cache = join(tmpdir(), 'hiraeth-sound-qc-takes') } = {}) {
  return renderAudio({ take: samples ? decodedTakes(cache) : null, themes: decodedTakes(join(cache, 'music'), 'public/music') });
}
