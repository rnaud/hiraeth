// The stutter harness (issue #468, docs/systems/performance.md "Stutters"): hitches, single long frames and frame-time
// spikes on the Unity players, not the mean. Two recorders write side by side and this file joins and reads them:
//   Unity   BridgeStutter.cs (-stutter <prefix>): every frame of the main thread, <prefix>.unity.tsv: its length, the wait on
//           the script, the script's own time, the ops applied, the managed collections and allocations, what the mirror
//           made, FrameTimingManager's CPU and GPU times, the profiler's markers (a shader's first use, uploads, loads …)
//           and, for a long one, the engine's steps (BridgeLoopTimer)
//   script  StutterLog below (engine/unity/game.js, the same flag): every script frame, <prefix>.js.json: its update and
//           mirror ms, the game's sections (engine/game.js sectionsOn), what it handed over (command bytes, nodes,
//           geometries, uploads), V8's full collections (gc-watch.js), and what was happening (the events: a world
//           loading, a region's name, a spawn, a scene, a conversation, a menu, a way through)
// The two are joined by the script frame each Unity frame waited on (`js`), then every frame over the spike line is given
// a cause (`causeOf`) and the causes ranked by how much time they cost (`rank`). scripts/stutter/run.mjs plays the
// routes (engine/stutter-routes.js) on the Mac player; scripts/stutter/report.mjs prints the table.

/** The seconds after the world's first played frame kept apart as the load's tail. */
export const TAIL_SECS = 2;
/** Frames from this long are spikes (ms): two refreshes at 60 Hz. */
export const SPIKE_MS = 33;
/** And these (ms): three. */
export const BAD_MS = 50;
/** V8's full collection is seen up to this many frames after it ended (engine/unity/gc-watch.js's lag). */
export const GC_LAG = 8;
/** Events this close to a spike (frames either side) are what was happening at it. */
export const NEAR_FRAMES = 3;

// ------------------------------------------------------------------ the script's side

/** The script's columns, a row a frame. */
export const JS_COLS = ['n', 'update', 'mirror', 'vm', 'cmdKb', 'nodes', 'geoms', 'mats', 'upKb', 'sentKb', 'fullGc', 'all'];

/**
 * What the game is doing, as a few short words that change only when it does: the world, a load, a scene, a box, a
 * conversation, a menu and its page, a way through, a run, how many foes. `screen` is engine/game.js screen().state.
 */
export function stutterState(game, menus = null) {
  const st = game.screen?.().state ?? {};
  const out = [`level:${game.level?.id ?? '?'}`];
  if (menus?.open) out.push(`menu:${menus.mode ?? '?'}${menus.state?.panel?.id ? `/${menus.state.panel.id}` : ''}`);
  if (game.scenePlaying) out.push(`scene:${game.ship?.cinematic?.constructor?.name ?? game.ship?.prologue?.stage ?? 'ship'}`);
  const m = game.story?.moments?.current;
  if (m) out.push(`moment:${m.id}`);
  if (game.boxPlaying) out.push('box');
  if (st.dialogue) out.push('dialogue');
  if (st.cine) out.push('cine');
  if (game.passage?.active || st.passage) out.push('passage');
  if (game.doorWalk?.active) out.push('door');
  if (game.minigameOn) out.push('run');
  const foes = game.foes?.list?.filter?.((f) => f.alive).length ?? 0;
  if (foes) out.push(`foes:${foes}`);
  return out.join(' ');
}

/**
 * The script's frames, kept in memory (a run writes them once at its end: a file written mid-run would be a spike of
 * its own). `frame` once a script frame, after game.frame; `event` for what the route says.
 */
export class StutterLog {
  constructor() { this.rows = []; this.sections = []; this.events = []; this.n = 0; this.state = ''; this.region = ''; this.last = null; }
  /**
   * n: the script frame's number (Hiraeth.frame's calls, as BridgeRunner counts them); r: game.frame's result ({ ms, stats }); backend: the Unity backend (its stats); vm: the whole script frame (ms);
   * sections: game.sections() (ms by part, this frame); fullGc: frames since the last full collection, when one was
   * seen this frame (0 otherwise); state: stutterState; region: the region's name on the screen ('' none).
   */
  frame({ n = this.n + 1, r, backend, vm, sections = null, fullGc = 0, state = '', region = '' }) {
    this.n = n;
    const s = r?.stats ?? {}, b = backend?.stats ?? {};
    const now = { nodes: s.nodes ?? 0, geoms: s.geometries ?? 0, mats: s.materials ?? 0, up: s.uploadedBytes ?? 0, sent: b.bytes ?? 0 };
    const was = this.last ?? now;
    this.rows.push([n, r2(r?.ms?.update), r2(r?.ms?.mirror), r2(vm), r2((b.commandBytes ?? 0) / 1024), now.nodes - was.nodes, now.geoms - was.geoms, now.mats - was.mats,
      r2((now.up - was.up) / 1024), r2((now.sent - was.sent) / 1024), fullGc ? 1 : 0, r2(vm)]);
    this.last = now;
    this.sections.push(sections);   // (one a row, null without: join reads them by the row's place)
    if (state !== this.state) { this.events.push([n, `state ${state}`, diffState(this.state, state)]); this.state = state; }
    if (region && region !== this.region) { this.events.push([n, `region ${region}`, 'region']); this.region = region; }
  }
  /** The whole script frame `n` (Hiraeth.frame, the plan's step in it: a route's act), ms, once it is over. */
  whole(n, ms) { const row = this.rows[this.rows.length - 1]; if (row && row[0] === n) row[row.length - 1] = r2(ms); }
  /** Something the route did or the game said (a beat, a set-down). */
  event(text, kind = 'beat') { this.events.push([this.n, text, kind]); }
  json() { return JSON.stringify({ cols: JS_COLS, rows: this.rows, sections: this.sections, events: this.events }); }
}
const r2 = (v) => Math.round((v ?? 0) * 100) / 100;

/** What changed between two states, as the kind of event it is (load, spawn, scene, dialogue, menu, passage …). */
export function diffState(a, b) {
  const A = new Set(a.split(' ').filter(Boolean)), B = new Set(b.split(' ').filter(Boolean));
  const kinds = new Set();
  for (const w of [...B].filter((x) => !A.has(x))) kinds.add(kindOf(w, true, A));
  // (a word gone whose key is still there with another value, foes:3 for foes:1, is the change said above)
  const key = (w) => w.split(':')[0], keys = new Set([...B].map(key));
  for (const w of [...A].filter((x) => !B.has(x) && !keys.has(key(x)))) kinds.add(kindOf(w, false, B));
  kinds.delete(null);
  return [...kinds].join(',') || 'state';
}
function kindOf(word, on, other) {
  const [k, v] = word.split(':');
  if (k === 'level') return on ? 'load' : null;
  if (k === 'foes') {
    const before = [...other].find((x) => x.startsWith('foes:'));
    return on && (!before || +v > +before.split(':')[1]) ? 'spawn' : 'foe gone';
  }
  if (k === 'menu') return on ? 'menu' : 'menu closed';
  if (k === 'scene' || k === 'moment' || k === 'cine' || k === 'box') return on ? 'cinematic' : 'cinematic over';
  if (k === 'dialogue') return on ? 'dialogue' : 'dialogue over';
  if (k === 'passage' || k === 'door') return on ? 'passage' : null;
  if (k === 'run') return on ? 'run' : 'run over';
  return k;
}

// ------------------------------------------------------------------ reading them

/** A tab-separated table with a header line → rows of objects (numbers where they are numbers). */
export function parseTsv(text) {
  const lines = text.split('\n').filter((l) => l.length);
  const head = lines.shift()?.split('\t') ?? [];
  return lines.map((l) => {
    const c = l.split('\t'), o = {};
    head.forEach((h, i) => { const v = c[i] ?? ''; o[h] = v !== '' && Number.isFinite(+v) ? +v : v; });
    return o;
  });
}

/** The p-th quantile (0..1) of numbers. */
export function quantile(values, p) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
}

/** Frame-time numbers: p50, p99, max, how many over SPIKE_MS and BAD_MS. */
export function frameStats(ms) {
  return { frames: ms.length, p50: r2(quantile(ms, 0.5)), p99: r2(quantile(ms, 0.99)), max: r2(ms.length ? Math.max(...ms) : 0), over33: ms.filter((x) => x > SPIKE_MS).length, over50: ms.filter((x) => x > BAD_MS).length };
}

/**
 * The Unity frames joined with the script frame each waited on, from the world's first played frame on (`play`); the
 * load before it is kept apart (`load`): its frames are behind the loading screen.
 */
export function join(unity, js) {
  const byN = new Map();
  if (js) for (const row of js.rows) byN.set(row[0], Object.fromEntries(js.cols.map((c, i) => [c, row[i]])));
  const sec = new Map();
  if (js?.sections?.length) js.rows.forEach((row, i) => sec.set(row[0], js.sections[i]));
  const frames = unity.map((u) => ({ ...u, s: byN.get(u.js) ?? null, sections: sec.get(u.js) ?? null }));
  const first = frames.findIndex((f) => f.s);
  return { load: first < 0 ? frames : frames.slice(0, first), play: first < 0 ? [] : frames.slice(first) };
}

/** The median of each section over the frames (ms): what a section usually costs. */
function sectionMedians(frames) {
  const by = {};
  for (const f of frames) for (const [k, v] of Object.entries(f.sections ?? {})) (by[k] ??= []).push(v);
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, quantile(v, 0.5)]));
}

/** The profiler's markers in a Unity row (columns `m:<name>`, ms), the longest first. */
function markers(u) {
  return Object.entries(u).filter(([k, v]) => k.startsWith('m:') && v > 0).map(([k, v]) => [k.slice(2), v]).sort((a, b) => b[1] - a[1]);
}

const SHADER = /Shader|GPUProgram|Pipeline|PSO|Variant|Compile/i;
const UPLOAD = /Upload|AwakeFromLoad|CreateTexture|Texture2D\.Apply|Mesh\.Upload|SetVertexBuffer|UploadMesh/i;
const LOAD = /Loading|ReadFile|AsyncRead|LoadAsset|Deserialize/i;
const INSTANTIATE = /Instantiate|AddComponent|CreateGameObject|Awake/i;
const PRESENT = /PresentFrame|WaitForPresent|WaitForGfxCommands|WaitForRenderThread|WaitForTargetFPS/i;

/**
 * Why a frame was long: one cause, and its evidence. i: the frame's index in `frames`; med: the frames' median (ms);
 * secMed: the sections' medians; gcAt: the script frames a full collection was seen at.
 * The order: the script (the main thread waited on it most of the frame) — a full V8 collection, else its section
 * that grew most, else the mirror; then Unity's own: a managed collection, a shader's or a pipeline's first use, uploads,
 * objects made, loads, the ops applied, the GPU, else the engine's longest step.
 */
export function causeOf(frames, i, { med, secMed = {}, gcAt = new Set() }) {
  const f = frames[i], dur = f.dur, s = f.s;
  // (the main thread applies the script's ops while it waits on it: the wait on the script itself is the rest)
  const wait = Math.max(0, (f.wait ?? 0) - (f.ops ?? 0));
  const extra = dur - med;
  if (wait > Math.max(0.5 * extra, 8) && s) {
    for (let k = 0; k <= GC_LAG; k++) if (gcAt.has(f.js + k)) return { cause: 'script: V8 full GC', evidence: `full collection seen ${k} frames on; the wait ${wait.toFixed(1)} ms` };
    const grew = Object.entries(f.sections ?? {}).map(([k, v]) => [k, v - (secMed[k] ?? 0)]).sort((a, b) => b[1] - a[1])[0];
    const mirror = (s.mirror ?? 0) - 0;
    if (s.nodes > 20 || s.geoms > 10 || s.upKb > 512) {
      if (mirror > (grew?.[1] ?? 0)) return { cause: 'script: mirror (objects made)', evidence: `${s.nodes} nodes, ${s.geoms} geometries, ${s.upKb} kB uploaded; mirror ${mirror} ms` };
    }
    if (grew && grew[1] > 2) return { cause: `script: ${grew[0]}`, evidence: `${grew[0]} +${grew[1].toFixed(1)} ms over its median; the wait ${wait.toFixed(1)} ms` };
    if (mirror > 4) return { cause: 'script: mirror', evidence: `mirror ${mirror} ms` };
    const whole = s.all ?? s.vm ?? 0;
    if (whole > (s.vm ?? 0) + Math.max(4, 0.4 * wait)) return { cause: 'script: the route\'s act (spawn, set-down)', evidence: `the script frame ${whole} ms, its game frame ${s.vm} ms` };
    if (whole < wait * 0.6 && (f.script ?? 0) < wait * 0.6) return { cause: 'script: V8 pause (GC or compile)', evidence: `the wait ${wait.toFixed(1)} ms, the script's own frame ${whole} ms: the rest outside its measured work` };
    if (whole < wait * 0.6) return { cause: 'script: host calls (bridge marshalling)', evidence: `the script's thread ${f.script} ms for a frame the script measured at ${whole} ms` };
    return { cause: 'script: update', evidence: `update ${s.update} ms, the wait ${wait.toFixed(1)} ms` };
  }
  // (a collection in the frame is its cause when the profiler's GC.Collect says it took the time, or no profiler is there)
  const gcMs = f['m:GC.Collect'];
  if ((f.gc ?? 0) > 0 && (!(gcMs >= 0) || gcMs > Math.max(4, 0.35 * extra))) return { cause: 'C#: managed GC', evidence: `${f.gc} collections${f.made ? `; ${f.made} made by the mirror, ${f.madeKb} kB of geometry` : ''}${f.allocKb > 0 ? `; ${f.allocKb} kB allocated on the main thread` : ''}` };
  const mk = markers(f);
  const pick = (re) => mk.find(([k, v]) => re.test(k) && v > Math.max(2, 0.25 * extra));
  let m;
  if ((m = pick(SHADER))) return { cause: 'C#: shader / pipeline first use', evidence: `${m[0]} ${m[1].toFixed(1)} ms` };
  if ((m = pick(UPLOAD))) return { cause: 'C#: uploads (textures, meshes)', evidence: `${m[0]} ${m[1].toFixed(1)} ms` };
  if ((m = pick(LOAD))) return { cause: 'C#: synchronous load', evidence: `${m[0]} ${m[1].toFixed(1)} ms` };
  if ((m = pick(INSTANTIATE))) return { cause: 'C#: instantiate', evidence: `${m[0]} ${m[1].toFixed(1)} ms` };
  if ((f.ops ?? 0) > Math.max(0.4 * extra, 4)) return { cause: (f.made ?? 0) > 0 ? 'C#: objects made (ops)' : 'C#: ops applied (bridge burst)', evidence: `ops ${f.ops} ms${f.made ? `, ${f.made} made, ${f.madeKb} kB of geometry` : ''}${f.gc ? `, ${f.gc} collections${gcMs >= 0 ? ` (${gcMs.toFixed(1)} ms)` : ''}` : ''}` };
  if ((f.gpu ?? 0) > Math.max(dur * 0.8, med + 8)) return { cause: 'GPU', evidence: `gpu ${f.gpu} ms` };
  // (the main thread waiting on the present or the render thread: the GPU's or the compositor's, not the frame's own work)
  if ((m = pick(PRESENT))) return { cause: 'GPU / present wait', evidence: `${m[0]} ${m[1].toFixed(1)} ms, gpu ${f.gpu} ms` };
  if (mk[0] && mk[0][1] > 0.4 * extra) return { cause: `C#: ${mk[0][0]}`, evidence: `${mk[0][1].toFixed(1)} ms` };
  if (f.steps) return { cause: `C#: ${String(f.steps).split(',')[0].replace(/ [\d.]+$/, '').trim()}`, evidence: `steps ${f.steps}` };
  return { cause: 'unknown', evidence: `wait ${wait} ms, ops ${f.ops ?? 0} ms, gpu ${f.gpu ?? 0} ms` };
}

/**
 * One run read: its play frames' numbers, and every spike with its cause and what was happening (the script's events
 * within NEAR_FRAMES frames). route: its id.
 */
export function analyse(unity, js, route = '', { spikeMs = SPIKE_MS, tailSecs = TAIL_SECS } = {}) {
  const { load, play: all } = join(unity, js);
  // (the first seconds after the first played frame: the load's tail, the world still landing; kept apart as the load is)
  const t0 = all[0]?.t ?? 0, tail = all.filter((f) => f.t < t0 + tailSecs), play = all.filter((f) => f.t >= t0 + tailSecs);
  const ms = play.map((f) => f.dur);
  const med = quantile(ms, 0.5);
  const secMed = sectionMedians(play);
  const gcAt = new Set((js?.rows ?? []).filter((r) => r[js.cols.indexOf('fullGc')]).map((r) => r[0]));
  const events = js?.events ?? [];
  const spikes = [];
  play.forEach((f, i) => {
    if (f.dur <= spikeMs) return;
    const c = causeOf(play, i, { med, secMed, gcAt });
    const near = events.filter(([n]) => Math.abs(n - (f.js ?? -1e9)) <= NEAR_FRAMES).map(([, text, kind]) => (kind === 'beat' ? text : kind)).filter((k) => k !== 'state');
    spikes.push({ route, frame: f.f, t: f.t, ms: r2(f.dur), ...c, at: [...new Set(near)].join(', ') });
  });
  return { route, spikeMs, play: frameStats(ms), load: frameStats(load.map((f) => f.dur)), tail: frameStats(tail.map((f) => f.dur)), spikes, fullGcs: gcAt.size };
}

/**
 * The spikes of every run grouped by cause: how many, the worst, the time they cost above the run's median, and the
 * routes and moments they came at; the costliest first.
 */
export function rank(results) {
  const by = new Map();
  for (const r of results) {
    const med = r.play.p50;
    for (const s of r.spikes) {
      const g = by.get(s.cause) ?? { cause: s.cause, n: 0, max: 0, lost: 0, routes: new Set(), at: new Map(), worst: null };
      g.n++; g.lost += s.ms - med; g.routes.add(s.route);
      if (s.ms > g.max) { g.max = s.ms; g.worst = s; }
      for (const a of String(s.at).split(', ').filter(Boolean)) g.at.set(a, (g.at.get(a) ?? 0) + 1);
      by.set(s.cause, g);
    }
  }
  return [...by.values()].sort((a, b) => b.lost - a.lost).map((g) => ({
    cause: g.cause, n: g.n, max: r2(g.max), lost: r2(g.lost), routes: [...g.routes].join(', '),
    at: [...g.at.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ×${v}`).join(', '), evidence: g.worst?.evidence ?? '',
  }));
}
