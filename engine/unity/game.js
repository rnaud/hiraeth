// The game, Unity side (docs/systems/engine-bridge.md): engine/game.js in Puerts' V8, the scene
// mirrored to Unity objects drawn by the C# port's own ink look (its URP renderer feature, its
// Surface shader and materials, MementoLook), the keys and pads from Unity's Input System.
// BridgeRunner.cs loads this bundle and calls start(args) once and frame(dt) every frame; a batch
// run (BridgeBatch.cs, scripts/unity-export/unity-batch.sh BridgeBatch.Run) passes its plan in args.
import { pads, host } from './host.js';
import { createGame } from '../game.js';
import { UnityBackend } from './backend.js';
import { portLook } from './port-format.js';

let S = null;
const now = () => host.Now();

function standardPad(state) {
  // (BridgeHost.Pad: "b0,b1,…,b16|a0,a1,a2,a3", the standard mapping's buttons as values, the sticks)
  const [b, a] = state.split('|');
  const values = b.split(',').map(Number), axes = a.split(',').map(Number);
  return { id: 'unity pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: values.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })), axes, vibrationActuator: null };
}

export function start(argsJson) {
  const args = JSON.parse(argsJson || '{}');
  const t0 = now();
  const backend = new UnityBackend(host);
  S = { args, backend, game: null, frames: 0, plan: null, results: [], keys: new Set(), lastT: 0 };
  createGame({ levelId: args.level ?? 'desert', backend, people: args.people !== false, log: (...a) => console.log('[game]', ...a) })
    .then((game) => {
      S.game = game;
      console.log(`[unity] ready in ${(now() - t0).toFixed(0)} ms (in the VM: ${JSON.stringify(game.T)})`);
      S.plan = makePlan(args);
    })
    .catch((e) => { console.error('[unity] the game failed to start', e?.stack ?? e); host.Exit(3); });
}

function makePlan(args) {
  const steps = [];
  for (const v of args.views ?? []) {
    steps.push({ kind: 'pin', view: v }, { kind: 'wait', frames: 12 });
    if (args.bench) steps.push({ kind: 'measure', view: v, secs: args.bench });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-${v.name}.png` });
  }
  if (args.walk) {
    steps.push({ kind: 'key', code: 'KeyW', down: true }, { kind: 'measure', view: { name: 'walk' }, secs: args.walk }, { kind: 'key', code: 'KeyW', down: false });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-walk.png` });
  }
  if (!steps.length) return null;
  steps.push({ kind: 'done' });
  return { steps, i: 0, wait: 0, t: 0, samples: null };
}

/** This frame's keys from Unity (BridgeHost.Keys: the KeyboardEvent codes held), as the page's keydown / keyup. */
function readInput(game) {
  const held = new Set((host.Keys() || '').split(',').filter(Boolean));
  for (const k of held) if (!S.keys.has(k)) game.key(k, true);
  for (const k of S.keys) if (!held.has(k)) game.key(k, false);
  S.keys = held;
  const pad = host.Pad();
  pads.length = 0;
  if (pad) pads.push(standardPad(pad));
  const look = host.MouseLook();   // (the right button held: "dx,dy" pixels)
  if (look) { const [dx, dy] = look.split(',').map(Number); if (dx || dy) game.look(dx, dy); }
}

export function frame(dt) {
  if (!S?.game) return;
  const { game, backend } = S;
  const tA = now();
  if (!S.plan) readInput(game);
  const r = game.frame(dt);
  backend.look(JSON.stringify(portLook(game.fullLook())));
  const tB = now();
  const lastT = S.lastT; S.lastT = tA;
  S.frames++;
  const P = S.plan;
  if (!P) return;
  const step = P.steps[P.i];
  const next = () => { P.i++; P.wait = 0; P.t = 0; };
  if (step.kind === 'pin') { game.pin(step.view); next(); }
  else if (step.kind === 'key') { game.key(step.code, step.down); next(); }
  else if (step.kind === 'wait') { if (++P.wait >= step.frames) next(); }
  else if (step.kind === 'measure') {
    P.samples ??= [];
    P.samples.push({ dt: lastT ? tA - lastT : dt * 1000, vm: tB - tA, update: r.ms.update, mirror: r.ms.mirror, cpu: host.LastFrameCpuMs(), gpu: host.LastFrameGpuMs(), moved: r.stats.moved });
    P.t += Math.min(dt, 0.1);   // (a load's long first frame counts as one)
    if (P.t >= step.secs) {
      const s = P.samples.slice(5);
      const q = (k, f) => { const a = s.map((x) => x[k]).sort((x, y) => x - y); return a.length ? +a[Math.floor(a.length * f)].toFixed(2) : 0; };
      const res = { view: step.view.name, frames: s.length, frame: q('dt', 0.5), frameP95: q('dt', 0.95), vm: q('vm', 0.5), update: q('update', 0.5), mirror: q('mirror', 0.5), cpu: q('cpu', 0.5), gpu: q('gpu', 0.5), moved: q('moved', 0.5), drawn: r.stats.drawn, commandBytes: backend.stats.commandBytes };
      S.results.push(res);
      console.log(`[bench] ${JSON.stringify(res)}`);
      P.samples = null;
      next();
    }
  } else if (step.kind === 'shot') {
    if (++P.wait < 3) return;   // (a frame for the pin to land, one for the shadows)
    host.Shot(step.file);
    console.log(`[unity] saved ${step.file}`);
    next();
  } else if (step.kind === 'done') {
    if (S.args.out && S.results.length) host.WriteText(`${S.args.out}/unity-bench.json`, JSON.stringify({ engine: 'unity', results: S.results, backend: backend.stats }, null, 1));
    console.log(`[unity] done after ${S.frames} frames; ${JSON.stringify(backend.stats)}`);
    host.Exit(0);
  }
}
