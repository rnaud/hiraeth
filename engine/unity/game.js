// The game, Unity side (docs/systems/engine-bridge.md): engine/game.js in Puerts' V8, the scene
// mirrored to Unity objects drawn by the C# port's own ink look (its URP renderer feature, its
// Surface shader and materials, MementoLook), the keys and pads from Unity's Input System.
// BridgeRunner.cs loads this bundle and calls start(args) once and frame(dt) every frame; a batch
// run (BridgeBatch.cs, scripts/unity-export/unity-batch.sh BridgeBatch.Run) passes its plan in args.
import { pads, host, toHost } from './host.js';
import { createGame } from '../game.js';
import { UnityBackend } from './backend.js';
import { portLook } from './port-format.js';

let S = null;
const now = () => host.Now();
// the sound kept this far ahead of what Unity has played (BridgeAudio.cs's ring): frames
const AUDIO_AHEAD = 0.12;
// a run at fixed views starts from the web bench's save (scripts/bench/web-page.mjs prepareStorage): the backpack found
const BENCH_FLAGS = { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 };

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
  S = { args, backend, game: null, frames: 0, plan: null, results: [], keys: new Set(), lastT: 0, audioMs: 0 };
  // the sound at Unity's output rate (BridgeAudio: muted in batch runs, where it is only counted)
  const rate = args.sound === false ? 0 : host.AudioRate?.() ?? 0;
  createGame({ levelId: args.level ?? 'desert', backend, people: args.people !== false, audio: rate ? { sampleRate: rate } : null, flags: args.views?.length || args.play ? BENCH_FLAGS : null, log: (...a) => console.log('[game]', ...a) })
    .then((game) => {
      S.game = game;
      console.log(`[unity] ready in ${(now() - t0).toFixed(0)} ms (in the VM: ${JSON.stringify(game.T)})`);
      if (args.split) {
        // what a call into C# costs, and how fast plain JS runs here (against Node's numbers in the docs)
        const d0 = Date.now(); for (let i = 0; i < 2000; i++) performance.now(); const callUs = (Date.now() - d0) / 2;
        const d1 = Date.now(); let x = 0; for (let i = 0; i < 2e7; i++) x += Math.fround(i * 0.5) % 7; const loopMs = Date.now() - d1;
        console.log(`[unity] a clock read ${callUs} µs; 2e7 fround loop ${loopMs} ms (${x > 0})`);
      }
      S.plan = makePlan(args);
    })
    .catch((e) => { console.error('[unity] the game failed to start', e?.stack ?? e); host.Exit(3); });
}

function makePlan(args) {
  const steps = [];
  for (const v of args.views ?? []) {
    // (and a second and a half of the game's time: what wakes by the traveller's nearness, the answering plants, has woken
    // as on the web bench's view, which waits seconds)
    steps.push({ kind: 'pin', view: v }, { kind: 'wait', frames: 12, secs: args.settle ?? 1.5 });
    if (args.bench) steps.push({ kind: 'measure', view: v, secs: args.bench });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-${v.name}.png` });
  }
  if (args.talk) {
    // walk up to someone (args.talk: their id, or 'any'), press E, and photograph the conversation as it goes
    steps.push({ kind: 'approach', who: args.talk }, { kind: 'wait', frames: 20 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-prompt.png` });
    steps.push({ kind: 'key', code: 'KeyE', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'KeyE', down: false }, { kind: 'wait', frames: 30 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-talk.png` });
    steps.push({ kind: 'wait', frames: 240 });
    for (let k = 0; k < 3; k++) {
      steps.push({ kind: 'key', code: 'Space', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Space', down: false }, { kind: 'wait', frames: 240 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-talk-${k + 2}.png` });
    }
  }
  if (args.play) {
    // the fluid tool (aim with R, fire with G: a shot and its splat) and the drone (Q), photographed as they go
    steps.push({ kind: 'wait', frames: 40 });
    if (args.play.includes('tool')) {
      steps.push({ kind: 'key', code: 'KeyR', down: true }, { kind: 'wait', frames: 25 }, { kind: 'key', code: 'KeyG', down: true }, { kind: 'wait', frames: 3 }, { kind: 'key', code: 'KeyG', down: false }, { kind: 'wait', frames: 10 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-tool.png` });
      steps.push({ kind: 'wait', frames: 45 }, { kind: 'key', code: 'KeyR', down: false }, { kind: 'wait', frames: 20 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-splat.png` });
    }
    if (args.play.includes('cab')) {
      // the traveller seated in the market's parked cab (src/taxi.js), the ride camera on him
      steps.push({ kind: 'cab' }, { kind: 'wait', frames: 90 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-cab.png` });
      // and close, from beside him (the web's side: the same place from the traveller, scratch views)
      steps.push({ kind: 'cabClose' }, { kind: 'wait', frames: 6 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-cabclose.png` });
    }
    if (args.play.includes('drone')) {
      steps.push({ kind: 'key', code: 'KeyQ', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'KeyQ', down: false }, { kind: 'wait', frames: 75 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-drone.png` });
    }
  }
  if (args.walk) {
    steps.push({ kind: 'key', code: 'KeyW', down: true }, { kind: 'measure', view: { name: 'walk' }, secs: args.walk }, { kind: 'key', code: 'KeyW', down: false });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-walk.png` });
  }
  if (!steps.length) return null;
  steps.push({ kind: 'done' });
  return { steps, i: 0, wait: 0, t: 0, samples: null };
}

/**
 * A view aimed at someone (view.npc: their id; the side-by-sides' close-ups): the eye `dist` m off their front,
 * a little to the side, looking at their chest, wherever they have walked to by now. Other views as they are.
 */
function aimed(game, v) {
  if (!v?.npc) return v;
  const n = game.npcs.find((x) => x.def?.id === v.npc);
  if (!n) { console.log(`[unity] no ${v.npc} here`); return v; }
  const p = n.pos, h = n.heading ?? 0, d = v.dist ?? 2.8, side = v.side ?? 0.6;
  const fx = Math.sin(h), fz = Math.cos(h);
  return { ...v, player: null, hidePlayer: true, eye: [p.x + fx * d + fz * side, p.y + 1.5, p.z + fz * d - fx * side], target: [p.x, p.y + 1.1, p.z], fov: v.fov ?? 45 };
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

/** The sound's next PCM to Unity: what keeps its ring AUDIO_AHEAD seconds ahead (whole 128-frame blocks). */
function pumpAudio(game) {
  const ctx = game.audio;
  if (!ctx) return;
  const t0 = now();
  const want = Math.floor(ctx.sampleRate * AUDIO_AHEAD) - host.AudioQueued();
  if (want >= 128) {
    const pcm = ctx.render(want);
    if (pcm.length) host.Audio(toHost(pcm.buffer));
  }
  S.audioMs += now() - t0;
}

export function frame(dt) {
  if (!S?.game) return;
  const { game, backend } = S;
  const tA = now();
  if (!S.plan) readInput(game);
  const r = game.frame(dt);
  backend.lights(game.localLights());
  const tL = now();
  // (the look moves with the hour and the place: read every 4th frame is enough)
  if (S.frames % 4 === 0) backend.look(JSON.stringify(portLook(game.fullLook())));
  S.lookMs = (S.lookMs ?? 0) + now() - tL;
  // the HUD's state when it changed (src/platform.js screen: BridgeHud draws it in uGUI)
  const scr = game.screen();
  if (scr.version !== S.screenV) { S.screenV = scr.version; host.Screen(JSON.stringify(scr.state)); }
  pumpAudio(game);
  const tB = now();
  const lastT = S.lastT; S.lastT = tA;
  S.frames++;
  const P = S.plan;
  if (!P) return;
  const step = P.steps[P.i];
  const next = () => { P.i++; P.wait = 0; P.t = 0; };
  if (step.kind === 'pin') { game.pin(aimed(game, step.view)); next(); }
  else if (step.kind === 'key') { game.key(step.code, step.down); next(); }
  else if (step.kind === 'approach') {
    const people = game.npcs.filter((n) => n.def && !n.pooled);
    const n = people.find((x) => x.def.id === step.who) ?? people[0];
    if (n) {
      const V = n.pos.constructor, dir = new V(Math.sin(n.heading ?? 0), 0, Math.cos(n.heading ?? 0));
      const p = n.pos.clone().addScaledVector(dir, 1.6);
      game.player.teleport(p, new V(0, 1, 0), new V(0, 0, 1));
      game.player.heading = Math.atan2(n.pos.x - p.x, n.pos.z - p.z);
      game.rig.yaw = game.player.heading + Math.PI;
      console.log(`[unity] beside ${n.def.id}`);
    }
    next();
  }
  else if (step.kind === 'cab') {
    const v = game.player.vehicles.find((x) => x.kind === 'taxi' || x.constructor?.name === 'Taxi') ?? game.player.vehicles[0];
    game.pin(null);   // (the camera back on the rig: the ride camera)
    if (v) { game.player.mount_(v); console.log(`[unity] seated in the ${v.kind ?? 'vehicle'}`); } else console.log('[unity] no vehicle here');
    next();
  }
  else if (step.kind === 'cabClose') {
    const p = game.player.pos;
    game.pin({ eye: [p.x + 2.6, p.y + 1.9, p.z + 2.6], target: [p.x, p.y + 0.9, p.z], fov: 50, hidePlayer: false });
    next();
  }
  else if (step.kind === 'wait') { P.t += Math.min(dt, 0.05); if (++P.wait >= step.frames && P.t >= (step.secs ?? 0)) next(); }
  else if (step.kind === 'measure') {
    if (!P.samples) { game.mirror.profiling = !!S.args.split; game.mirror.profile(); backend.stats.hostMs = 0; host.ApplyMs(); host.ClothMs?.(); S.audioMs = 0; P.n0 = backend.stats.frames; S.lookMs = 0; S.looks = backend.stats.looks ?? 0; }
    P.samples ??= [];
    P.samples.push({ dt: lastT ? tA - lastT : dt * 1000, vm: tB - tA, update: r.ms.update, mirror: r.ms.mirror, cpu: host.LastFrameCpuMs(), gpu: host.LastFrameGpuMs(), moved: r.stats.moved });
    P.t += Math.min(dt, 0.1);   // (a load's long first frame counts as one)
    if (P.t >= step.secs) {
      const s = P.samples.slice(5);
      const q = (k, f) => { const a = s.map((x) => x[k]).sort((x, y) => x - y); return a.length ? +a[Math.floor(a.length * f)].toFixed(2) : 0; };
      const nf = Math.max(backend.stats.frames - P.n0, 1);
      const split = { ...game.mirror.profile(), audio: +(S.audioMs / nf).toFixed(3), host: +(backend.stats.hostMs / nf).toFixed(3), apply: +(host.ApplyMs() / nf).toFixed(3), look: +(S.lookMs / nf).toFixed(3), lookSent: (backend.stats.looks ?? 0) - S.looks, clothWait: +((host.ClothMs?.() ?? 0) / nf).toFixed(3) };   // (clothWait: the main thread waiting on the overshirt's job, BridgeCloth)
      const res = { split, view: step.view.name, frames: s.length, frame: q('dt', 0.5), frameP95: q('dt', 0.95), vm: q('vm', 0.5), update: q('update', 0.5), mirror: q('mirror', 0.5), cpu: q('cpu', 0.5), gpu: q('gpu', 0.5), moved: q('moved', 0.5), drawn: r.stats.drawn, commandBytes: backend.stats.commandBytes, opWords: backend.stats.opWords, visited: r.stats.visited };
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
