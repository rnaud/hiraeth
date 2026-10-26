// Shared scenario execution; VM loading and file decoding are supplied by the caller.
export const FPS = 30;
const RATE = 48000, BLOCK = RATE / FPS;

/** The Sound's own plumbing (called every frame, or by the sounds themselves): left out of a scenario's calls. */
export const PLUMBING = new Set(['prepareEffects', 'listenForInput', 'assignedEffect', 'assignedVoice', 'update', 'listen', 'follow', 'schedule', 'ambienceTick', 'houseTick', 'set', 'musicLevel', 'seatedK', 'levels', 'masterLevel',
  'musicMomentsUpdate', 'moveFoeSpots', 'railsUpdate', 'underwater', 'combat', 'combatSchedule', 'rand', 'placeAt', 'freq', 'burst', 'sweep', 'sample', 'pluck',
  'noiseGlide', 'struck', 'ting', 'crystalTing', 'keyBell', 'foeEar', 'foeSpot', 'foeVoice', 'instrument', 'playEvent', 'setBandMode', 'band', 'boxHum', 'canSpeak',
  'holdFloor', 'utterance', 'trace', 'start', 'startIfAllowed', 'noiseLayer', 'menuSchedule', 'menuPad', 'menuBusEnsure', 'bandBeat', 'makeBands', 'setBands', 'vocal',
  'spot', '_humVoice', '_humOut', 'ring', 'drip', 'moan', 'creak', 'clack', 'chirp', 'horn', 'croak', 'tuning', 'pad', 'bass', 'dum', 'tek', 'clap', 'noiseHit', 'solo',
  'soloPhrase', 'soloDrone', 'setVolumes', 'setVoices', 'setMusicMode', 'setScore', 'holdTheme', 'musicCue', 'dispose', 'toggleMute', '_away']);

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });

/** Quiet while `fn` runs (the VM's loaders complain about what a VM has none of: textures, Blob). */
async function hushed(fn) {
  const w = console.warn, i = console.info, l = console.log, e = console.error;
  console.warn = console.info = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
}

/**
 * A game to drive. play(sc): a fresh game for each scenario (sc.level, default the driver's), `sc.setup(g)` once it has
 * settled `sc.settle` frames, then `sc.steps`: [frames, { key: down }, tag?] in order (keys stay as set until changed);
 * `sc.each(g, f)` every frame. The calls are counted from the first step's first frame.
 */
export async function driveVm(vm, { level = 'desert', installEffectFileDecoder } = {}) {
  const mod = vm.exports;
  const probe = mod.makeSound(level, { sampleRate: RATE, prepareOnly: true });
  installEffectFileDecoder(vm.ctx.window.AudioContext);
  probe.dispose();
  const make = (o) => hushed(() => mod.createGame({ levelId: level, backend, fight: true, audio: { sampleRate: RATE }, ...o }));
  async function play(sc) {
    const g = await make({ levelId: sc.level ?? level, ...(sc.game ?? {}) });
    const S = g.sound, calls = [];
    let f = -1, recording = false;
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(S))) {
      if (k === 'constructor' || typeof S[k] !== 'function') continue;
      const fn = S[k];
      S[k] = function (...args) { if (recording && !PLUMBING.has(k)) calls.push({ f, t: +(f / FPS).toFixed(3), name: k, args: args.map(brief) }); return fn.apply(this, args); };
    }
    const frames = [];
    const frame = (keys = {}) => { for (const [k, v] of Object.entries(keys)) g.key(k, v); sc.each?.(g, f); g.frame(1 / FPS); const p = g.audio?.render(BLOCK); if (recording && p) frames.push(p.slice(0, BLOCK * 2)); };
    await hushed(async () => {
      for (let i = 0; i < (sc.settle ?? 45); i++) frame();
      await sc.setup?.(g);
      for (let i = 0; i < 6; i++) frame();
      recording = true;
      for (const [n, keys] of sc.steps) { for (let i = 0; i < n; i++) { f++; frame(i === 0 ? keys : {}); } }
    });
    const pcm = new Float32Array(frames.length * BLOCK * 2);
    frames.forEach((p, i) => pcm.set(p, i * BLOCK * 2));
    try { g.dispose?.(); } catch { /* gone */ }
    clearInterval(S.scheduler);
    return { calls, pcm, rate: RATE, game: g };
  }
  return { play };
}

/** An argument as the report shows it (numbers rounded, objects by their keys' simple values). */
function brief(a) {
  if (typeof a === 'number') return +a.toFixed(2);
  if (a && typeof a === 'object') { const o = {}; for (const [k, v] of Object.entries(a)) if (typeof v !== 'object' && typeof v !== 'function') o[k] = typeof v === 'number' ? +v.toFixed(2) : v; return o; }
  return a;
}
