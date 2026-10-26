// Audited loader boundaries, read from the same Git snapshot as the source. A
// stale/missing fingerprint never grants a narrower graph. No repository code is
// executed to discover dependencies.
import { createHash } from 'node:crypto';
export const CONTRACT_FILE = 'scripts/test-loader-contract.json';
export const GAME_ADAPTER = 'engine/game-test-runtime.mjs';
const validPath = s => typeof s === 'string' && s && !s.startsWith('/') && !s.split('/').includes('..') && !s.includes('\\');
const match = (pattern, path) => new RegExp('^' + pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '(?:/.*)?$').test(path);
export function boundedGameInputs({ read, exists, files, analyze }) {
  try {
    const c = JSON.parse(read(CONTRACT_FILE));
    if (c.version !== 1 || c.module !== GAME_ADAPTER || c.entry !== 'engine/game.js' ||
        JSON.stringify(c.assets) !== JSON.stringify(['public', 'data']) || !c.fingerprints ||
        JSON.stringify(c.hostReaders) !== JSON.stringify(['engine/boot.js', 'engine/platform.js'])) return null;
    const required = [GAME_ADAPTER, 'scripts/engine-bundle-core.mjs', 'engine/vm-run.mjs', 'engine/boot.js', 'engine/platform.js'];
    if (Object.keys(c.fingerprints).length !== required.length || required.some(p => !c.fingerprints[p])) return null;
    for (const [path, hash] of Object.entries(c.fingerprints)) {
      if (!validPath(path) || !/^[a-f0-9]{64}$/.test(hash) || createHash('sha256').update(read(path)).digest('hex') !== hash) return null;
    }
    const resources = new Set([CONTRACT_FILE, ...required, ...c.assets]);
    const patterns = [], seen = new Set(), stack = [c.entry];
    let unknown = false, unknownExistence = false;
    while (stack.length) {
      let path = stack.pop();
      if (!exists(path)) {
        const found = [path + '.js', path + '.mjs', path + '/index.js'].filter(exists);
        if (found.length !== 1) { resources.add(path); unknown = true; continue; }
        path = found[0];
      }
      if (seen.has(path)) continue;
      seen.add(path); resources.add(path);
      if (!/\.(?:js|mjs|cjs)$/.test(path)) continue;
      const d = analyze(path, read(path), { explain: true });
      // These exact host shims only read assets through the adapter's bounded
      // reader. A changed shim invalidates the entire contract above.
      const hostRead = c.hostReaders.includes(path) && (d.opaqueReasons ?? []).every(r => r.reason === 'unresolved-path-expression');
      unknown ||= d.unknown && !hostRead;
      unknownExistence ||= d.unknownExistence;
      for (const r of d.resources) resources.add(r);
      for (const p of d.patterns) {
        patterns.push({ ...p, executable: false });
        if (p.executable) {
          if (!files) unknown = true;
          else for (const file of files) if (match(p.pattern, file)) stack.push(file);
        }
      }
      stack.push(...d.imports);
    }
    return { imports: [], resources: [...resources], patterns, unknown: !!unknown, unknownExistence: !!unknownExistence,
      opaqueReasons: unknown ? [{ reason: 'opaque-game-input', line: null, offset: null }] : [],
      loaderContract: CONTRACT_FILE };
  } catch { return null; }
}

export const AUDIO_ADAPTER = 'scripts/sound-qc/test-runtime.mjs';
export const AUDIO_CONTRACT_FILE = 'scripts/test-audio-contract.json';
export function boundedAudioInputs({ read, exists, files, analyze }) {
  try {
    const c = JSON.parse(read(AUDIO_CONTRACT_FILE));
    const required = [AUDIO_ADAPTER, 'scripts/sound-qc/render.mjs'];
    if (c.version !== 1 || c.module !== AUDIO_ADAPTER || c.entry !== 'scripts/sound-qc/render.mjs' ||
        JSON.stringify(c.assets) !== JSON.stringify(['public/sfx', 'public/music']) || !c.fingerprints ||
        Object.keys(c.fingerprints).length !== required.length || required.some(p => !c.fingerprints[p])) return null;
    for (const [path, hash] of Object.entries(c.fingerprints)) {
      if (!validPath(path) || !/^[a-f0-9]{64}$/.test(hash) || createHash('sha256').update(read(path)).digest('hex') !== hash) return null;
    }
    const resources = new Set([AUDIO_CONTRACT_FILE, ...required, ...c.assets]);
    const patterns = [], seen = new Set(), stack = [c.entry, AUDIO_ADAPTER];
    let unknown = false, unknownExistence = false;
    while (stack.length) {
      let path = stack.pop();
      if (!exists(path)) {
        const found = [path + '.js', path + '.mjs', path + '/index.js'].filter(exists);
        if (found.length !== 1) { resources.add(path); unknown = true; continue; }
        path = found[0];
      }
      if (seen.has(path)) continue;
      seen.add(path); resources.add(path);
      if (!/\.(?:js|mjs|cjs)$/.test(path)) continue;
      const d = analyze(path, read(path), { explain: true });
      // Only the guarded adapter and exact decoder are trusted for IO. Their
      // static imports still participate, and changed bytes invalidate the boundary.
      const hostRead = required.includes(path); // exact audited decoder bytes; generic callers stay opaque
      unknown ||= d.unknown && !hostRead;
      unknownExistence ||= d.unknownExistence && !hostRead;
      for (const r of d.resources) resources.add(r);
      for (const p of d.patterns) {
        patterns.push({ ...p, executable: false });
        if (p.executable) {
          if (!files) unknown = true;
          else for (const file of files) if (match(p.pattern, file)) stack.push(file);
        }
      }
      stack.push(...d.imports);
    }
    return { imports: [], resources: [...resources], patterns, unknown: !!unknown, unknownExistence: !!unknownExistence,
      opaqueReasons: unknown ? [{ reason: 'opaque-audio-input', line: null, offset: null }] : [], loaderContract: AUDIO_CONTRACT_FILE };
  } catch { return null; }
}
