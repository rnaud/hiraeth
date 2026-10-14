// Rolling a built thing back to an earlier moment, for tests that would otherwise build it again for every case
// (a traveller costs about 0.5 s to build and warm). snapshot(...roots) records everything reachable from the roots:
// every object's and array's own properties, every Map's and Set's entries, every typed array's and ArrayBuffer's
// bytes; restore() puts all of it back as it was, so whatever was added since is unreachable again and whatever
// changed holds its old value. What it can't see: closures' variables, WeakMaps, module-level state not reachable
// from the roots. So a test using it compares a rolled-back run with a fresh build's, bitwise (with Math.random seeded
// alike), before relying on it (tests/talk-gesture.test.js, tests/blade-attacks.test.js).

const SKIP = (v) => v === globalThis || v instanceof Promise || v instanceof WeakMap || v instanceof WeakSet || (typeof WeakRef === 'function' && v instanceof WeakRef);

/** Record everything reachable from `roots`; returns { restore() }, which can be called any number of times. */
export function snapshot(...roots) {
  const seen = new Set(), queue = [...roots], objs = [], bufs = [], maps = [], sets = [];
  const visit = (v) => { if (v !== null && (typeof v === 'object' || typeof v === 'function') && !seen.has(v) && !SKIP(v)) { seen.add(v); queue.push(v); } };
  for (const r of roots) seen.add(r);
  while (queue.length) {
    const o = queue.pop();
    if (ArrayBuffer.isView(o)) {
      if (o instanceof DataView) { visit(o.buffer); continue; }
      bufs.push([o, o.slice()]);
      continue;
    }
    if (o instanceof ArrayBuffer) { bufs.push([new Uint8Array(o), new Uint8Array(o.slice(0))]); continue; }
    if (o instanceof Map) { const e = [...o]; maps.push([o, e]); for (const [k, v] of e) { visit(k); visit(v); } }
    else if (o instanceof Set) { const e = [...o]; sets.push([o, e]); for (const v of e) visit(v); }
    const desc = Object.getOwnPropertyDescriptors(o), keys = Reflect.ownKeys(desc);
    for (const k of keys) { const d = desc[k]; if ('value' in d) visit(d.value); else { visit(d.get); visit(d.set); } }
    objs.push([o, keys, desc, Object.getPrototypeOf(o)]);
    visit(Object.getPrototypeOf(o));
  }
  return {
    count: objs.length,
    restore() {
      for (const [a, b] of bufs) a.set(b);
      for (const [m, e] of maps) { m.clear(); for (const [k, v] of e) m.set(k, v); }
      for (const [s, e] of sets) { s.clear(); for (const v of e) s.add(v); }
      for (const [o, keys, desc, proto] of objs) {
        if (Object.getPrototypeOf(o) !== proto) Object.setPrototypeOf(o, proto);
        const now = Reflect.ownKeys(o);
        if (now.length !== keys.length || now.some((k, i) => k !== keys[i])) {
          // (keys added, gone or reordered: all of them put back in their order, as iteration would see them)
          if (Array.isArray(o)) { o.length = 0; for (const k of keys) if (k !== 'length') Object.defineProperty(o, k, desc[k]); o.length = desc.length.value; continue; }
          for (const k of now) if (Object.getOwnPropertyDescriptor(o, k).configurable) delete o[k];
          for (const k of keys) Object.defineProperty(o, k, desc[k]);
          continue;
        }
        for (const k of keys) {
          const d = desc[k];
          if ('value' in d) { if (!Object.is(o[k], d.value) && d.writable) o[k] = d.value; }
          else { const c = Object.getOwnPropertyDescriptor(o, k); if (c.get !== d.get || c.set !== d.set) Object.defineProperty(o, k, d); }
        }
      }
    },
  };
}
