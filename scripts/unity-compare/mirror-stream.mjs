// What the Unity bundle tells the C# host, frame by frame, over a scripted run, made deterministic (Math.random seeded,
// the host's clock a fixed step a call, Date fixed): the frame's command buffer (a hash of its bytes), each transform
// sent (id → a hash of its 16 floats), every other op (a hash of its words) and every other host call. Two runs compared
// say whether a change to the mirror changes what Unity receives (issue #455: the noticed mirror against the one that
// looks at everything, `-js-off noticed,quiet,still`, and against the bundle before).
//
//   node scripts/unity-compare/mirror-stream.mjs record <bundle.cjs> <level> <out.json> [--mode walk|views] [--views file]
//       [--off a,b] [--frames 600]
//   node scripts/unity-compare/mirror-stream.mjs compare <a.json> <b.json>
// walk: the traveller walks forward (-walk); views: the bench's views (pinned, then measured: the people and crowds about).
// The bundle: node -e "import('./scripts/engine-bundle.mjs').then((m) => m.bundle('unity', { out: ['/tmp/x.cjs'] }))".
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadBundle } from '../../engine/vm-run.mjs';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const H = (u8, n = 12) => createHash('sha1').update(u8).digest('hex').slice(0, n);

async function record(file, level, outFile) {
  const mode = opt('mode', 'walk'), FRAMES = +opt('frames', 600), off = opt('off', '');
  let seed = 12345, clock = 0, done = false, nFrame = 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const frames = [], calls = [];
  let cur = { t: {}, o: [] };
  const hashArg = (x) => (typeof x === 'number' ? x : typeof x === 'string' ? (x.length > 200 ? H(x, 40) : x) : x?.byteLength != null ? H(new Uint8Array(x.buffer ?? x, x.byteOffset ?? 0, x.byteLength), 40) : typeof x);
  const note = (name) => (...a) => { calls.push([nFrame, name, ...a.map(hashArg)]); };
  const BridgeHost = {
    Now: () => (clock += 0.002), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Geometry: note('Geometry'), Material: note('Material'), FaceKeys: note('FaceKeys'), Cloth: note('Cloth'), Create: note('Create'), SetMesh: note('SetMesh'), Cape: note('Cape'), CapeState: () => null,
    Texture: note('Texture'), TextureImage: note('TextureImage'), Look: note('Look'),
    Frame(buf) {
      nFrame++;
      frames.push({ h: H(new Uint8Array(buf.buffer ?? buf, buf.byteOffset ?? 0, buf.byteLength), 16), t: cur.t, o: cur.o });
      cur = { t: {}, o: [] };
    },
    Screen() {}, ApplyMs: () => 0, Keys: () => '', Menu() {}, MapImage() {}, AwayCount: () => 0, LoadStage() {},
    MenuWidth: () => 1280, MenuMapBox: () => '878,508', PadName: () => '', Platform: () => 'linux', Pad: () => null, MouseLook: () => null,
    Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0, Exit() { done = true; },
    AudioRate: () => 0, AudioQueued: () => 0, Audio() {}, AudioThreaded: () => false,
  };
  const SeededMath = {};
  for (const k of Object.getOwnPropertyNames(Math)) SeededMath[k] = k === 'random' ? rnd : Math[k];
  const DateFixed = class extends Date { constructor(...a) { super(...(a.length ? a : [1760000000000 + clock])); } static now() { return 1760000000000 + clock; } };
  // (each op the backend writes, tapped: the bundle's tally (engine/unity/backend.js) patched in a copy)
  const src = readFileSync(file, 'utf8');
  const TALLY = 'self._opWords[op] = (self._opWords[op] ?? 0) + self.w.n - before;';
  if (!src.includes(TALLY)) throw new Error('no tally in the bundle (engine/unity/backend.js)');
  const tapped = `${file.replace(/\.cjs$/, '')}.tap-${process.pid}.cjs`;
  writeFileSync(tapped, src.replace(TALLY, `${TALLY} globalThis.__tap?.(op, self.w, before);`));
  const __tap = (op, w, before) => {
    if (op === 'transforms') {
      for (let i = 0, k = w.u32[before + 1]; i < k; i++) { const at = before + 2 + i * 17; cur.t[w.i32[at]] = H(new Uint8Array(w.u32.buffer, (at + 1) * 4, 64)); }
    } else cur.o.push(`${op}:${H(new Uint8Array(w.u32.buffer, before * 4, (w.n - before) * 4))}@${w.i32[before + 1]}`);
  };
  const said = { log: console.log, warn: console.warn, info: console.info, error: console.error }, errs = [];
  try {
    const { exports, readFile } = loadBundle(tapped, {}, { __tap, CS: { Hiraeth: { Bridge: { BridgeHost } } }, Math: SeededMath, Date: DateFixed, setTimeout: undefined, setInterval: undefined, clearTimeout: undefined, clearInterval: undefined });
    BridgeHost.ReadFile = readFile;
    console.log = console.warn = console.info = () => {}; console.error = (...a) => errs.push(a.map(String).join(' ').slice(0, 300));
    const args = { level, quality: 'deck', off: off || undefined };
    if (mode === 'walk') args.walk = FRAMES / 30;
    else { args.views = JSON.parse(readFileSync(opt('views'), 'utf8')).views; args.bench = 4; }
    exports.start(JSON.stringify(args));
    for (let i = 0; i < 20000 && !done && nFrame < FRAMES + 400; i++) {
      exports.frame(1 / 30);
      if (i % 4 === 0) await new Promise((r) => setImmediate(r));
    }
  } finally { Object.assign(console, said); try { unlinkSync(tapped); } catch { /* gone */ } }
  writeFileSync(outFile, JSON.stringify({ level, mode, off, frames, calls, errs: errs.slice(0, 20) }));
  console.log(`${level} ${mode}${off ? ` (off: ${off})` : ''}: ${frames.length} frames, ${calls.length} other calls`);
}

function compare(fa, fb, max = 8) {
  const [a, b] = [fa, fb].map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const n = Math.min(a.frames.length, b.frames.length);
  let same = 0, tfDiff = 0, opDiff = 0, tfN = 0;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const A = a.frames[i], B = b.frames[i];
    tfN += Object.keys(A.t).length;
    if (A.h === B.h) { same++; continue; }
    const tdiff = [...new Set([...Object.keys(A.t), ...Object.keys(B.t)])].filter((k) => A.t[k] !== B.t[k]);
    if (tdiff.length) tfDiff++;
    if ([...A.o].sort().join() !== [...B.o].sort().join()) opDiff++;
    if (lines.length < max) lines.push(`  frame ${i + 1}: ${tdiff.length} transforms differ; ops only in A ${A.o.filter((x) => !B.o.includes(x)).slice(0, 4).join(' ') || '-'} | only in B ${B.o.filter((x) => !A.o.includes(x)).slice(0, 4).join(' ') || '-'}`);
  }
  const ca = a.calls.map((c) => JSON.stringify(c)), cb = b.calls.map((c) => JSON.stringify(c));
  const cs = ca.filter((c, i) => c === cb[i]).length;
  console.log(`${a.level} ${a.mode}: ${n} frames (${a.frames.length} / ${b.frames.length}), bytes identical ${same}; transforms different in ${tfDiff} (${tfN} sent in all); other ops different in ${opDiff}; host calls identical ${cs} of ${ca.length} / ${cb.length}`);
  for (const l of lines) console.log(l);
  return same === n && a.frames.length === b.frames.length && cs === ca.length && ca.length === cb.length;
}

const [cmd, ...rest] = argv.filter((x, i) => !x.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (cmd === 'record') await record(...rest);
else if (cmd === 'compare') process.exit(compare(...rest) ? 0 : 1);
else { console.log('usage: mirror-stream.mjs record <bundle.cjs> <level> <out.json> [--mode walk|views] [--views f] [--off a,b] [--frames N] | compare <a.json> <b.json>'); process.exit(2); }
