// The sound QC's hands in the game (.claude/skills/sound-qc/SKILL.md): the whole game as the engines run it
// (engine/game.js bundled, in a bare V8 context: engine/vm-run.mjs), its own Sound on the in-memory Web Audio
// (engine/webaudio.js: what Unity plays), driven by keys as a player's hands, 30 frames a second. Every call into the
// Sound is written down with the frame it came in, and the master's PCM kept, so each scenario says which sounds the
// game asked for after the press, how soon, and how loud it came out.
//
//   const D = await driver({ out, level: 'desert' });
//   const r = D.play(scenario)   → { calls: [{ f, t, name, args }], pcm, rate, press: frame of the first press }
import { installEffectFileDecoder } from './render.mjs';
import { join, resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
import { driveVm } from './drive-core.mjs';
export { FPS, PLUMBING } from './drive-core.mjs';

/** The engine bundle at `file` (built once: `fresh` builds it again). */
export async function engineBundle(file, { fresh = false } = {}) {
  if (fresh || !existsSync(file)) {
    const { bundle } = await import(join(ROOT, 'scripts/engine-bundle.mjs'));
    await bundle('godot', { input: 'engine/game.js', out: [file] });
  }
  return file;
}

export async function driver({ file, level = 'desert' } = {}) {
  const { loadBundle } = await import(join(ROOT, 'engine/vm-run.mjs'));
  return driveVm(loadBundle(file), { level, installEffectFileDecoder });
}
