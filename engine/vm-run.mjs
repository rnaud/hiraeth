// Run an engine bundle (scripts/engine-bundle.mjs) in a bare V8 context, as an engine's VM would
// hold it: only console and the timers, no Node, no page. The tests use it (tests/engine-bridge.test.js);
// by hand:  node engine/vm-run.mjs godot/js/memento-spike.js
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Load a bundle into a fresh context. Returns its exports and the context. */
export function loadBundle(file, host = {}) {
  const code = readFileSync(resolve(ROOT, file), 'utf8');
  const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.__MEMENTO_HOST__ = {
    engine: 'node-vm',
    // (the bytes in the context's own ArrayBuffer: three checks `instanceof ArrayBuffer`)
    readFile: (p) => { try { const b = readFileSync(resolve(ROOT, 'public', p)); const U8 = vm.runInContext('Uint8Array', ctx); return new U8(b).buffer; } catch { return null; } },
    ...host,
  };
  const module = { exports: {} };
  const fn = vm.runInContext(`(function (module, exports, require) {${code}\n})`, ctx, { filename: file });
  fn(module, module.exports, (n) => { throw new Error(`the bundle asked for '${n}'`); });
  return { exports: module.exports, ctx };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { exports } = loadBundle(process.argv[2] ?? 'godot/js/memento-spike.js');
  const counts = {};
  const backend = { create(id, d) { counts[d.kind] = (counts[d.kind] ?? 0) + 1; }, transforms(ids, m, n) { counts.moved = n; } };
  const r = exports.buildSpike({ backend });
  console.log(counts, r.stats, r.ms);
}
