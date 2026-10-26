// Fixed packaged-audio inputs for tests. Generic sound tools keep render.mjs.
// The selector verifies this wrapper and the decoder's exact fingerprints before
// narrowing their filesystem/subprocess reads to public/sfx and public/music.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodedTakes as decodeFiles } from './render.mjs';
import { RATE } from './render-core.mjs';
import { sfxFiles } from '../../src/sfx.js';
export { RATE, CALM, seeded } from './render-core.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const inside = (root, file) => { const rel = relative(root, file); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); };
function sourceFile(name, from) {
  if (!['public/sfx', 'public/music'].includes(from) || typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(mp3|wav)$/.test(name)) throw Error('Packaged audio filename required');
  const root = resolve(ROOT, from), file = join(root, name);
  if (!inside(root, realpathSync(file))) throw Error('Audio asset outside packaged directory');
  return file;
}
function cacheRoot(cache) {
  const target = resolve(cache);
  if ((!inside(resolve(tmpdir()), target) && !inside(realpathSync(tmpdir()), target)) || inside(ROOT, target)) throw Error('Audio cache must be outside the repository in the temporary directory');
  mkdirSync(cache, { recursive: true });
  const real = realpathSync(cache);
  if (!inside(realpathSync(tmpdir()), real) || inside(ROOT, real)) throw Error('Audio cache must be outside the repository in the temporary directory');
  return real;
}
/** Identical real decoder/cache implementation, with fixed roots and guarded names. */
export function decodedTakes(cache, from = 'public/sfx') {
  if (!['public/sfx', 'public/music'].includes(from)) throw Error('Packaged audio directory required');
  const dir = cacheRoot(cache), decode = decodeFiles(dir, from, ROOT);
  return name => {
    const file = sourceFile(name, from);
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    const wav = join(dir, `${name.replace(/\.mp3$/i, '')}-${hash}-${RATE}.wav`);
    if (existsSync(wav) && !inside(dir, realpathSync(wav))) throw Error('Audio cache symlink escaped its directory');
    return decode(name);
  };
}
/** Browser-compatible fetch bytes from exactly the packaged effect directory. */
export const effectBytes = name => readFileSync(sourceFile(name, 'public/sfx'));
export function installEffectFileDecoder(AudioContext, { cache = join(tmpdir(), 'hiraeth-test-effect-takes') } = {}) {
  const names = new Map(sfxFiles().map(name => [createHash('sha256').update(effectBytes(name)).digest('hex'), name]));
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
