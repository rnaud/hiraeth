// The game, Godot side (docs/systems/engine-bridge.md): engine/game.js in GodotJS's V8, mirrored
// to Godot nodes each frame, the look as Godot's global shader parameters, the keys, mouse and
// pads from Godot's input.
//
//   godot/run.sh                                         play (WASD, Shift, Space; the right mouse button turns the camera)
//   godot/run.sh --views=/abs/viewpoints.json --out=/abs/dir     one PNG per viewpoint (scripts/bench/viewpoints.json)
//   godot/run.sh --bench=8 --views=… --out=…              frame times at each viewpoint, vsync off: <out>/godot-bench.json
//   godot/run.sh --walk=6 --out=…                        walk forward for 6 s from the spawn, a PNG at the end
import './host.js';
import godot from 'godot';   // (the default import: GodotJS's module is a lazy proxy, a namespace copy of it would be empty)
import { pads } from './host.js';
import { createGame } from '../game.js';
import { GodotBackend } from './backend.js';
import { makeStage, aimSun, savePng, userArgs, batchExit } from './stage.js';
import { godotParams } from './look.js';
import { lookGlobals } from '../ink-params.js';
import { godotKeyCode, standardPad } from '../keys.js';

let S = null;
const now = () => godot.Time.get_ticks_usec() / 1000;

function readJson(path) { return JSON.parse(godot.FileAccess.get_file_as_string(path)); }
function writeText(path, text) { const f = godot.FileAccess.open(path, godot.FileAccess.ModeFlags.WRITE); if (f) { f.store_string(text); f.close(); } }

export function start(owner) {
  const args = userArgs();
  const t0 = now();
  const stage = makeStage(owner);
  const backend = new GodotBackend(stage.root, { shaders: stage.shaders, materialParams: godotParams });
  backend.cam = stage.cam;
  const vp = owner.get_viewport().get_viewport_rid();
  godot.RenderingServer.viewport_set_measure_render_time(vp, true);
  if (args.bench) {
    // uncapped, as the web's benchmark runs Chrome (no vsync, no frame-rate limit)
    godot.DisplayServer.window_set_vsync_mode(0, 0);   // (DisplayServer.VSYNC_DISABLED)
    godot.Engine.max_fps = 0;
    console.log(`[godot] vsync ${godot.DisplayServer.window_get_vsync_mode(0)}, max fps ${godot.Engine.max_fps}`);
  }
  // (for a breakdown: --shadows=0 without the sun's shadows, --post=0 without the ink composite)
  if (args.shadows === '0') stage.sun.shadow_enabled = false;
  if (args.post === '0') stage.post.visible = false;
  const views = args.views ? readJson(args.views).views.filter((v) => !args.only || args.only.split(',').includes(v.name)) : null;
  S = { args, stage, backend, vp, views, game: null, frames: 0, t0, plan: null, times: [], results: [] };
  createGame({ levelId: args.level ?? 'desert', backend, people: args.people !== '0', log: (...a) => console.log('[game]', ...a) })
    .then((game) => {
      S.game = game;
      console.log(`[godot] ready in ${(now() - t0).toFixed(0)} ms (in the VM: ${JSON.stringify(game.T)})`);
      S.plan = makePlan(S);
    })
    .catch((e) => { console.error('[godot] the game failed to start', e?.stack ?? e); if (args.views || args.walk || args.shot) batchExit(owner); });
}

/** What a batch run does, frame by frame: pinned viewpoints, a walk, then leave. */
function makePlan(S) {
  const { args, views } = S;
  const steps = [];
  if (views) {
    for (const v of views) {
      steps.push({ kind: 'pin', view: v });
      steps.push({ kind: 'wait', frames: 12 });
      if (args.bench) steps.push({ kind: 'measure', view: v, secs: Number(args.bench) });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/godot-${v.name}.png` });
    }
  }
  if (args.walk) {
    steps.push({ kind: 'key', code: 'KeyW', down: true });
    steps.push({ kind: 'measure', view: { name: 'walk' }, secs: Number(args.walk) });
    steps.push({ kind: 'key', code: 'KeyW', down: false });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/godot-walk.png` });
  }
  if (args.shot) { steps.push({ kind: 'wait', frames: 12 }); steps.push({ kind: 'shot', file: args.shot }); }
  if (!steps.length) return null;
  steps.push({ kind: 'done' });
  return { steps, i: 0, wait: 0, t: 0 };
}

function readPads() {
  const ids = godot.Input.get_connected_joypads();
  pads.length = 0;
  for (let i = 0; i < ids.size(); i++) {
    const d = ids.get(i);
    pads.push(standardPad(d, (b) => godot.Input.is_joy_button_pressed(d, b), (a) => godot.Input.get_joy_axis(d, a), godot.Input.get_joy_name(d)));
  }
}

export function frame(owner, dt) {
  if (!S?.game) return;
  const { game, backend, stage } = S;
  const tA = now();
  readPads();
  const r = game.frame(dt);
  const look = lookGlobals(game.lookParams());
  backend.look(look);
  aimSun(stage.sun, look.g_sun_dir);
  const tB = now();
  S.frames++;
  const lastT = S.lastT;
  S.lastT = tA;
  const P = S.plan;
  if (!P) return;
  const step = P.steps[P.i];
  const next = () => { P.i++; P.wait = 0; P.t = 0; };
  if (step.kind === 'pin') { game.pin(step.view); next(); }
  else if (step.kind === 'key') { game.key(step.code, step.down); next(); }
  else if (step.kind === 'wait') { if (++P.wait >= step.frames) next(); }
  else if (step.kind === 'measure') {
    // a frame: the wall time since the last (vsync off in a benchmark), the VM's share (the game, the mirror,
    // Godot's calls from it), Godot's render on the CPU and the GPU
    const RS = godot.RenderingServer;
    P.samples ??= [];
    // (the wall clock: Godot's delta is smoothed to the display's refresh, application/run/delta_smoothing)
    const wall = lastT ? tA - lastT : dt * 1000;
    P.samples.push({ dt: wall, vm: tB - tA, update: r.ms.update, mirror: r.ms.mirror, cpu: RS.viewport_get_measured_render_time_cpu(S.vp), gpu: RS.viewport_get_measured_render_time_gpu(S.vp), moved: r.stats.moved });
    P.t += dt;
    if (P.t >= step.secs) {
      const s = P.samples.slice(5);
      const med = (k) => { const a = s.map((x) => x[k]).sort((x, y) => x - y); return a.length ? +a[Math.floor(a.length / 2)].toFixed(2) : 0; };
      const p95 = (k) => { const a = s.map((x) => x[k]).sort((x, y) => x - y); return a.length ? +a[Math.floor(a.length * 0.95)].toFixed(2) : 0; };
      const res = { view: step.view.name, frames: s.length, frame: med('dt'), frameP95: p95('dt'), vm: med('vm'), update: med('update'), mirror: med('mirror'), renderCpu: med('cpu'), renderGpu: med('gpu'), moved: med('moved'), drawn: r.stats.drawn };
      S.results.push(res);
      console.log(`[bench] ${JSON.stringify(res)}`);
      P.samples = null;
      next();
    }
  } else if (step.kind === 'shot') {
    if (++P.wait < 2) return;   // (a frame for the pin to land)
    const err = savePng(owner, step.file);
    console.log(`[godot] saved ${step.file} (${err === 0 ? 'ok' : 'error ' + err})`);
    next();
  } else if (step.kind === 'done') {
    if (S.args.out && S.results.length) writeText(`${S.args.out}/godot-bench.json`, JSON.stringify({ engine: 'godot', godot: godot.Engine.get_version_info().get('string'), adapter: godot.RenderingServer.get_video_adapter_name(), level: S.args.level ?? 'desert', backend: S.backend.stats, results: S.results }, null, 1));
    console.log(`[godot] done after ${S.frames} frames; Godot side ${JSON.stringify(S.backend.stats)}`);
    batchExit(owner);
  }
}

let rightHeld = false;
export function input(owner, e) {
  if (!S?.game) return;
  const cls = e.get_class();
  if (cls === 'InputEventKey') {
    if (e.echo) return;
    const code = godotKeyCode(e.physical_keycode || e.keycode, e.location);
    if (code) S.game.key(code, e.pressed);
  } else if (cls === 'InputEventMouseButton') {
    if (e.button_index === godot.MouseButton.MOUSE_BUTTON_RIGHT) rightHeld = e.pressed;
  } else if (cls === 'InputEventMouseMotion') {
    if (rightHeld || godot.Input.mouse_mode === godot.Input.MouseMode.MOUSE_MODE_CAPTURED) S.game.look(e.relative.x, e.relative.y);
  }
}
