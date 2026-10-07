#!/usr/bin/env node
// The motion library: every take listed for the game, from wherever it came (CMU's ASF/AMC in
// data/mocap/raw/cmu/, BVH files in data/mocap/raw/bvh/, Mixamo's FBX in data/mocap/mixamo/),
// retargeted onto the UAL skeleton, cleaned, tagged and packed into public/anim/locomotion.glb (the
// matching database) and public/anim/walks.glb (the people's walks).
// Re-runnable: it rebuilds the file from the raw folders each time (same input, same bytes), so
// dropping Mixamo files in their folder and running it again is all it takes.
//
//   node scripts/mocap/fetch-cmu.mjs          # once: the CMU takes (git-ignored)
//   node scripts/mocap/build-library.mjs      # -> public/anim/locomotion.glb
//   node scripts/mocap/build-library.mjs --stats   # what each take became, nothing written
//   node scripts/mocap/build-library.mjs --add ss_slash_1,ss_slash_2   # only these Mixamo clips (use: clip),
//        converted and added to public/anim/moves.glb beside the clips already in it (the others are not
//        converted again: their sources need not be on this machine); the other two files are left as they are
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { asfAmcTake, CMU_MAP, CMU_POINTS } from './asf-amc.js';
import { bvhTake } from './bvh.js';
import { resampleTake, mirrorTake } from './take.js';
import { otherSide } from './maps.js';
import { targetSkeleton, retarget, BONES, TRACKS as TRACKS_DB } from './retarget.js';
// (a clip of its own keeps the head's turn too: the looking about, the petting)
const TRACKS_CLIP = [...TRACKS_DB.slice(0, 4), 'Head', ...TRACKS_DB.slice(4)];
import { footContacts, cleanClip, findLoop, wholeLoop, rootMotion, sliceClip } from './process.js';
import { writeGLB, readGLB, toBase64 } from './glb.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const RAW = resolve(ROOT, 'data/mocap/raw');
const MIXAMO = resolve(ROOT, 'data/mocap/mixamo');
const OUT = resolve(ROOT, 'public/anim/locomotion.glb'), WALKS = resolve(ROOT, 'public/anim/walks.glb'), MOVES = resolve(ROOT, 'public/anim/moves.glb');
const FPS = 30;
const args = process.argv.slice(2);
const STATS = args.includes('--stats');
const ADD = args.includes('--add') ? args[args.indexOf('--add') + 1].split(',') : null;

// how much of the matching database to ship (frames at 30 fps, before the runtime's mirrored copy)
const DB_BUDGET = 9000;   // (the CMU takes fill ~5900 of it, Mixamo's starts, stops and turns ~1300: the rest is room)

const parseGLB = async (file) => {
  const b = await readFile(file);
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};

const ual = await parseGLB(resolve(ROOT, 'public/anim/ual.glb'));
const T = targetSkeleton(ual.scene);

/** Every take to convert: { id, use, desc, load() -> take }. */
async function sources() {
  const list = [];
  const cmu = JSON.parse(await readFile(resolve(HERE, 'cmu-takes.json'), 'utf8'));
  if (!ADD) for (const [id, use, desc, opts = {}] of cmu.takes) {
    const s = id.split('_')[0];
    const asf = resolve(RAW, 'cmu', `${s}.asf`), amc = resolve(RAW, 'cmu', `${id}.amc`);
    if (!existsSync(asf) || !existsSync(amc)) continue;
    const fps = cmu.fps[String(+s)] ?? 120;
    list.push({ id: `cmu_${id}`, use, desc, opts, source: `CMU ${id}`, load: async () => {
      const t = asfAmcTake(await readFile(asf, 'utf8'), await readFile(amc, 'utf8'), { fps, name: id });
      t.map = CMU_MAP; t.landmarks = CMU_POINTS;
      return t;
    } });
  }
  // BVH: data/mocap/raw/bvh/*.bvh (role from bvh-clips.json if listed there, else for reference)
  const bvhDir = resolve(RAW, 'bvh');
  const bvhList = existsSync(resolve(HERE, 'bvh-clips.json')) ? JSON.parse(await readFile(resolve(HERE, 'bvh-clips.json'), 'utf8')) : {};
  if (existsSync(bvhDir) && !ADD) for (const f of (await readdir(bvhDir)).filter((x) => /\.bvh$/i.test(x)).sort()) {
    const key = basename(f, extname(f)), info = bvhList[key] ?? { use: 'ref', desc: key };
    list.push({ id: `bvh_${key.replace(/\W+/g, '_')}`, use: info.use, desc: info.desc, source: `BVH ${f}`, load: async () => bvhTake(await readFile(resolve(bvhDir, f), 'utf8'), { fps: FPS, name: key }) });
  }
  // Mixamo: data/mocap/mixamo/*.fbx, as listed in mixamo-clips.json (docs/mixamo-shopping-list.md)
  const mix = JSON.parse(await readFile(resolve(HERE, 'mixamo-clips.json'), 'utf8'));
  if (existsSync(MIXAMO)) for (const f of (await readdir(MIXAMO)).filter((x) => /\.fbx$/i.test(x)).sort()) {
    const key = basename(f, extname(f));
    const info = mix.clips.find((c) => c.file.toLowerCase() === key.toLowerCase());
    if (!info) { console.warn(`  mixamo: ${f} is not in scripts/mocap/mixamo-clips.json; skipped`); continue; }
    if (ADD && !ADD.includes(info.id)) continue;
    // (Mixamo's clips are single moves, many under a second: a loop is one whole cycle, a turn on the
    // spot 0.9 s. Standing ones (in place, or `root` in the table) keep their root still, so the hips'
    // sway and a get-up's rise stay in the pose instead of sliding the feet; `still`: an idle, smoothed
    // as the CMU idles are)
    const uses = info.use.split('+');
    list.push({ id: `mixamo_${info.id}`, use: uses[0], uses, desc: `${info.name}: ${info.desc}`, source: `Mixamo "${info.name}" (${info.desc})`, inPlace: info.inPlace, loop: info.loop, mixamo: true,
      still: info.still ?? (/idle/i.test(info.desc) && !/turn|walk|run/i.test(info.desc)), root: info.root ?? (info.inPlace && uses[0] !== 'mm' ? 'fixed' : null),
      opts: { loop: !!info.loop && uses.includes('mm'), minLength: 0.5 }, load: async () => {
      const { fbxTake } = await import('./fbx.js');
      const b = await readFile(resolve(MIXAMO, f));
      return fbxTake(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), { fps: FPS, name: key });
    } });
  }
  return list;
}

const idleLike = (src) => (src.mixamo ? src.still : /idle|stand|wait|shift|look/i.test(src.desc));
/** Does a take go to `use` (mm, npc, clip, ref)? Mixamo rows may list two ('mm+clip'). */
const goes = (src, use) => (src.uses ?? [src.use]).includes(use);

/** One source -> its cleaned clips (each with contacts and per-frame motion). */
async function convert(src) {
  let take = await src.load();
  take = resampleTake(take, FPS);
  // (standing still, the ground track is smoothed much more: the hips sway as the weight shifts,
  // the feet don't move, and a root that followed the hips would seem to slide them about)
  const r = retarget(take, T, { ...(idleLike(src) ? { posSigma: 0.8, yawSigma: 0.8 } : {}), root: src.root, head: goes(src, 'clip') });
  r.contact = footContacts(r);
  let clips = cleanClip(r, { idle: idleLike(src) || !goes(src, 'mm'), minLength: src.opts?.minLength ?? 1, turnMoves: !!src.mixamo }).map((c) => ({ ...c, contact: footContacts(c) }));
  // the take's options: skip `from` seconds, keep at most `max` (over its pieces, in order)
  const o = src.opts ?? {};
  if (o.from || o.max) {
    let skip = Math.round((o.from ?? 0) * FPS), left = o.max ? Math.round(o.max * FPS) : Infinity;
    const kept = [];
    for (const c of clips) {
      if (skip >= c.n) { skip -= c.n; continue; }
      const a = skip, b = Math.min(c.n, a + left);
      skip = 0;
      if (b - a >= FPS) { const s = sliceClip(c, a, b); kept.push(s); left -= s.n; }
      if (left <= 0) break;
    }
    clips = kept;
  }
  return { take, clips };
}

const quantile = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * q)] ?? 0; };

const list = await sources();
const results = [];
for (const src of list) {
  try {
    const { take, clips } = await convert(src);
    results.push({ src, take, clips });
    if (STATS) {
      for (const c of clips) {
        const m = rootMotion(c);
        const turn = c.root[(c.n - 1) * 3 + 2] - c.root[2];
        const on = (f) => Array.from(c.contact[f]).filter((x) => x > 0.5).length / c.n;
        console.log(`${src.id.padEnd(12)} ${src.use.padEnd(4)} ${(c.n / FPS).toFixed(1).padStart(5)} s  speed med ${quantile(m.speed, 0.5).toFixed(2)} p90 ${quantile(m.speed, 0.9).toFixed(2)} m/s  turn ${(turn * 180 / Math.PI).toFixed(0).padStart(5)}°  contact l ${on('l').toFixed(2)} r ${on('r').toFixed(2)}  scale ${c.scale.toFixed(3)}  ${src.desc}`);
      }
    }
  } catch (e) {
    console.warn(`  ${src.id}: ${e.message}`);
  }
}
if (STATS) {
  for (const use of ['mm', 'npc', 'ref']) {
    const frames = results.filter((r) => goes(r.src, use)).reduce((a, r) => a + r.clips.reduce((b, c) => b + c.n, 0), 0);
    console.log(`${use}: ${frames} frames (${(frames / FPS).toFixed(0)} s)`);
  }
  process.exit(0);
}

// ------------------------------------------------------------------ the library file
// nodes: root_motion (a clip's ground track) > root (the UAL rest) > pelvis > ... (BONES)
// animations: 'mm_database' (every matching clip end to end, `extras.segments` says where each one
// starts), 'walk_loops' (the people's walk cycles, likewise) and any other clip on its own. One
// long animation instead of many short ones keeps the file's JSON small.
const B = T.bones;
const order = ['root', ...BONES];
const nodes = [{ name: 'root_motion', parent: -1 }];
for (const n of order) nodes.push({ name: n, parent: n === 'root' ? 0 : 1 + order.indexOf(B[n].parent), translation: B[n].lp.toArray(), rotation: B[n].lq.toArray() });
const nodeOf = (n) => 1 + order.indexOf(n);
const u8 = (arr) => toBase64(Uint8Array.from(arr, (x) => Math.round(Math.max(0, Math.min(1, x)) * 255)));

/** Clips end to end as one animation; each segment's ground track starts at the origin facing +z. */
function packSheet(name, segs, extras, { rootMotion: withRoot = true, tracks: TRACKS = TRACKS_DB } = {}) {
  const n = segs.reduce((a, s) => a + s.c.n, 0);
  const rot = Object.fromEntries(TRACKS.map((k) => [k, new Float32Array(n * 4)]));
  const pel = new Float32Array(n * 3), t = new Float32Array(n * 3), q = new Float32Array(n * 4);
  const cl = new Float32Array(n), cr = new Float32Array(n);
  let at = 0;
  const segments = [];
  for (const { c, info } of segs) {
    for (const k of TRACKS) rot[k].set(c.local[k], at * 4);
    pel.set(c.pelvisPos, at * 3);
    cl.set(c.contact.l, at); cr.set(c.contact.r, at);
    const x0 = c.root[0], z0 = c.root[1], y0 = c.root[2], cy = Math.cos(y0), sy = Math.sin(y0);
    for (let i = 0; i < c.n; i++) {
      const dx = c.root[i * 3] - x0, dz = c.root[i * 3 + 1] - z0, yaw = c.root[i * 3 + 2] - y0;
      // (into the first frame's frame: turned by -yaw0 about +y)
      t[(at + i) * 3] = dx * cy - dz * sy; t[(at + i) * 3 + 2] = dx * sy + dz * cy;
      q[(at + i) * 4 + 1] = Math.sin(yaw / 2); q[(at + i) * 4 + 3] = Math.cos(yaw / 2);
    }
    segments.push({ ...info, start: at, n: c.n });
    at += c.n;
  }
  const channels = TRACKS.map((k) => ({ node: nodeOf(k), path: 'rotation', data: rot[k] }));
  channels.push({ node: nodeOf('pelvis'), path: 'translation', data: pel });
  if (withRoot) channels.push({ node: 0, path: 'translation', data: t }, { node: 0, path: 'rotation', data: q });
  return { name, fps: FPS, n, channels, extras: { ...extras, fps: FPS, segments, contact: { l: u8(cl), r: u8(cr) } } };
}

const sheets = [], report = { mm: [], npc: [] };
let dbFrames = 0;
const mm = [];
for (const { src, clips: cs } of results.filter((r) => goes(r.src, 'mm'))) {
  cs.forEach((c, k) => {
    if (dbFrames + c.n > DB_BUDGET) { console.warn(`  ${src.id}: over the database's budget, left out`); return; }
    dbFrames += c.n;
    const m = rootMotion(c);
    const name = `${src.id}${cs.length > 1 ? `_${k + 1}` : ''}`;
    mm.push({ c, info: { name, source: src.source, desc: src.desc, scale: +c.scale.toFixed(4), speed: +quantile(m.speed, 0.5).toFixed(3), turn: +(c.root[(c.n - 1) * 3 + 2] - c.root[2]).toFixed(3) } });
    report.mm.push(`${name} ${(c.n / FPS).toFixed(1)} s`);
  });
  // a steady walk or run: also one seamless cycle of it, which the matcher plays round and round
  // (the capture volume ends every take after a few strides)
  if (src.opts?.loop && cs.length) {
    const c = cs.reduce((a, b) => (b.n > a.n ? b : a), cs[0]);
    // (a Mixamo loop is a whole cycle as it is: its last frame is its first again, a cycle on)
    const loop = src.mixamo ? wholeLoop(c) : findLoop(c);
    if (!loop) console.warn(`  ${src.id}: no clean cycle for a loop`);
    else if (dbFrames + loop.n <= DB_BUDGET) {
      dbFrames += loop.n;
      // (its contacts: the take's own, as sliced)
      mm.push({ c: loop, info: { name: `${src.id}_loop`, source: src.source, desc: `${src.desc} (one cycle, looping)`, loop: true, scale: +loop.scale.toFixed(4), speed: +loop.loop.speed.toFixed(3), turn: 0 } });
      report.mm.push(`${src.id}_loop ${(loop.n / FPS).toFixed(2)} s (loop)`);
    }
  }
}
if (mm.length) sheets.push(packSheet('mm_database', mm, { use: 'mm' }));
const loops = [];
for (const { src, clips: cs } of results.filter((r) => goes(r.src, 'npc'))) {
  // the longest piece's best single cycle
  const c = cs.reduce((a, b) => (b.n > a.n ? b : a), cs[0]);
  const loop = c && findLoop(c);
  if (!loop) { console.warn(`  ${src.id}: no clean walking cycle found, left out`); continue; }
  loop.contact ??= footContacts(loop);
  loops.push({ c: loop, info: { name: src.id, source: src.source, desc: src.desc, scale: +loop.scale.toFixed(4), speed: +loop.loop.speed.toFixed(3) } });
  report.npc.push(`${src.id} ${(loop.n / FPS).toFixed(2)} s at ${loop.loop.speed.toFixed(2)} m/s (${src.desc})`);
}
const walkSheets = loops.length ? [packSheet('walk_loops', loops, { use: 'npc' }, { rootMotion: false })] : [];
// anything else that is shipped (Mixamo's get-ups, jumps, idles, ...: use 'clip'), one animation each
const moves = [];
for (const { src, clips: cs } of results.filter((r) => goes(r.src, 'clip'))) {
  for (const [k, c0] of cs.entries()) {
    const c = src.loop && src.mixamo ? wholeLoop(c0) ?? c0 : c0;
    moves.push(packSheet(`${src.id}${cs.length > 1 ? `_${k + 1}` : ''}`, [{ c, info: { name: src.id, source: src.source, desc: src.desc } }], { use: 'clip', loop: !!src.loop }, { rootMotion: !src.inPlace && !src.root, tracks: TRACKS_CLIP }));
  }
}
// three files: the people's walks and the traveller's own moves (small, loaded with the game), and
// the matching database (loaded when motion matching is on, and by the character studio)
const extras = { generator: 'scripts/mocap/build-library.mjs', fps: FPS, tracks: TRACKS_DB, credits: 'CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), created with funding from NSF EIA-0196217; Mixamo (Adobe) where listed. See docs/motion-data.md.' };
await mkdir(dirname(OUT), { recursive: true });
if (ADD) {
  // only the new clips, added to the moves already shipped (a clip of the same name is replaced)
  const old = readGLB(await readFile(MOVES));
  if (old.nodes.length !== nodes.length || old.nodes.some((n, i) => n.name !== nodes[i].name)) throw new Error('moves.glb has another skeleton: rebuild it whole');
  const names = new Set(moves.map((m) => m.name));
  const merged = [...old.clips.filter((c) => !names.has(c.name)), ...moves];
  const glb = writeGLB({ nodes, clips: merged, extras: { ...extras, ...old.extras } });
  await writeFile(MOVES, glb);
  console.log(`${MOVES}: ${(glb.length / 1024).toFixed(0)} KB, ${merged.length} clips (${moves.map((m) => m.name).join(', ')} added)`);
  process.exit(0);
}
for (const [file, list] of [[OUT, sheets], [WALKS, walkSheets], [MOVES, moves]]) {
  const glb = writeGLB({ nodes, clips: list, extras });
  await writeFile(file, glb);
  console.log(`${file}: ${(glb.length / 1024).toFixed(0)} KB`);
}
console.log(`matching database: ${report.mm.length} clips, ${dbFrames} frames (${(dbFrames / FPS).toFixed(0)} s; mirrored at load)`);
console.log(`walk loops: ${report.npc.length}\n  ${report.npc.join('\n  ')}`);
