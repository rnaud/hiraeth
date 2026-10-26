// Runtime material inventory, independent of source scanning and release packaging.
import { join } from 'node:path';

// ------------------------------------------------------------------ materials, by running the engines' game
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);

/**
 * Every world and minigame played a few frames in the engines' bundle; what the port can't take: `<key>` → { n, where }.
 * opts: { worlds, games } (default: all), log (each run's time).
 */
export async function gatherMaterials({ worlds = null, games = null, log = () => {} } = {}) {
  const { tmpdir } = await import('node:os');
  const { bundle, loadBundle } = await import('../engine/game-test-runtime.mjs');
  const { tempPath } = await import('./temp-dirs.mjs');
  const { portMaterial, unmappedKey } = await import('../engine/unity/port-format.js');
  const { LIVE_VECTORS } = await import('../engine/mirror.js');
  const { LEVELS } = await import('../src/levels/index.js'), { isDiscarded } = await import('../src/levels/names.js');
  // (sent besides the port's material: the live colour and glow, the moving vectors, the picture: engine/mirror.js, backend.js)
  const LIVE = new Set([...LIVE_VECTORS, 'uColor', 'uGlow', 'uWash', 'uMap', 'uHasMap']);
  const file = tempPath(join(tmpdir(), `hiraeth-bridge-gaps-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file, { pads: () => [] }).exports;
  // (the sword and the shield had: unarmed, no pack of foes comes in from the wilds, src/foes.js armed(), and the engines
  // keep to that since #427 (src/host/game-host.js wireKit); the foes' materials are what this run is for)
  for (const id of ['sword', 'shield']) B.items?.grant?.(id);
  const out = new Map();
  let at = '';
  const note = (key, name) => {
    let e = out.get(key);
    if (!e) out.set(key, e = { n: 0, where: new Set(), names: new Set() });
    e.n++; e.where.add(at); if (name && e.names.size < 3) e.names.add(name);
  };
  const tracked = (o, seen) => new Proxy(o, { get: (t, p) => { seen.add(p); return t[p]; }, has: (t, p) => { seen.add(p); return p in t; } });
  const backend = new Proxy({}, {
    get: (t, k) => (k === 'material' ? (mid, spec) => {
      const U = new Set(), D = new Set();
      const pm = portMaterial({ ...spec, u: tracked(spec.u, U), defines: tracked(spec.defines, D) }, mid);
      // (a surface whose shader text was rewritten after makeMaterial, or at compile: what it draws is in no define or uniform,
      // so only its own entry says whether the port draws it, issue #538: landmark-materials.js stone() hid this way)
      if (spec.patched) note(`patch:${spec.patched}`, spec.name);
      if (pm.port) return;
      if (spec.type === 'shader' || spec.type === 'other') { note(unmappedKey(spec), spec.name); return; }
      if (spec.type !== 'ink') return;   // (a plain colour: the Surface's plain, its picture sent: handled)
      for (const k of Object.keys(spec.defines)) if (!D.has(k)) note(`define:${k}`, spec.name);
      for (const k of Object.keys(spec.u)) if (!U.has(k) && !LIVE.has(k)) note(`uniform:${k}`, spec.name);
    } : UNSET.has(k) ? undefined : () => {}),
  });
  const menus = () => ({ shown: [], open: false, mode: null, show() {}, openShop() { return true; }, changed() {}, action() {}, navigate() {} });
  const play = async (label, opts) => {
    at = label;
    const t = Date.now();
    try {
      const g = await B.createGame({ backend, menus: menus(), ...opts });
      for (let f = 0; f < 8; f++) g.frame(1 / 20);
      await new Promise((r) => setTimeout(r, 30));
      for (let f = 0; f < 8; f++) g.frame(1 / 20);
      g.trials?.runner?.end?.();
    } catch (e) { log(`${label}: ${e?.message ?? e}`); }
    log(`${label} ${Date.now() - t} ms`);
  };
  // (the worlds' own chatter hushed the while: a world loads things a bare VM can't, and says so)
  const c = console, said = { warn: c.warn, info: c.info, log: c.log, error: c.error };
  const say = log === console.log ? said.log : log;
  log = say;
  c.warn = c.info = c.log = c.error = () => {};
  try {
    // (every world, or those named; not the discarded ones unless named: src/levels/names.js DISCARDED)
    for (const L of LEVELS) if (worlds ? worlds.includes(L.id) : !isDiscarded(L.id)) await play(L.id, { levelId: L.id });
    // the opening (the father's hologram, the wake), as a new game starts it
    if (!worlds || worlds.includes('prologue')) await play('prologue', { levelId: 'desert', prologue: true });
    for (const G of B.GAMES ?? []) if (!games || games.includes(G.id)) await play(`game ${G.id}`, { levelId: G.world ?? 'desert', game: G.id, from: G.world ?? 'desert' });
    await new Promise((r) => setTimeout(r, 200));
  } finally { Object.assign(c, said); }
  for (const e of out.values()) { e.where = [...e.where]; e.names = [...e.names]; }
  return out;
}

