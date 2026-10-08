// Every gadget registered in node (tests): src/gadgets/all.js finds them through Vite's import.meta.glob,
// which node has not got, so a test that wants the gadgets as items (the makers' courts, their boxes, the
// play-through) imports this first. Not a test file itself (no .test.js).
import { readdirSync } from 'node:fs';
import { registerGadget, GADGETS } from '../src/gadgets/registry.js';

const dir = new URL('../src/gadgets/', import.meta.url);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'all.js').sort()) {
  const m = await import(new URL(f, dir));
  if (m.default?.id && typeof m.default.create === 'function') registerGadget(m.default);
}
export { GADGETS };
