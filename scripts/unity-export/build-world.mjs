// Build a world headlessly, the way main.js does at load (and the tests do): the level, its
// physics and water, the ship at the arrival point, the crowd, the story's people, the makers'
// boxes, the mount and the flora (and the grass fields). Returns everything the exporter needs
// to read back.
//
//   const W = await buildWorld('incal');      // any id of src/levels/index.js
//
// The desert also builds the prologue's copy of the ship out in space (the Unity port plays the
// opening there); every other world is reached by ship, so its ship stands parked at its site.
import './shim.mjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// the game loads its characters by URL (anim/*.glb under public/): in Node, read them from disk
const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const b = readFileSync(resolve(PUBLIC, String(url).replace(/^\/+/, '')));
    this.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', onLoad, onError);
  } catch (e) { onError?.(e); }
};

// as the game (main.js): colours are authored as display values, not converted to linear
THREE.ColorManagement.enabled = false;

export const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };

let shared = null;
/** The people's bodies and the clips (the same for every world: loaded once per process). */
async function sharedAssets() {
  if (shared) return shared;
  const { loadHuman } = await import('../../src/humanoid.js');
  const { loadAnimationLibrary } = await import('../../src/animator.js');
  const humans = await Promise.all([loadHuman('m'), loadHuman('f')]);
  const lib = await loadAnimationLibrary('anim/ual.glb');
  const travellerTemplate = (await new GLTFLoader().loadAsync('anim/traveller.glb')).scene;
  shared = { humans, lib, travellerTemplate };
  return shared;
}

export async function buildWorld(levelId = 'desert') {
  const { levelById } = await import('../../src/levels/index.js');
  const { Physics } = await import('../../src/physics.js');
  const { Crowd } = await import('../../src/crowd.js');
  const { createStory } = await import('../../src/story/index.js');
  const { Ship } = await import('../../src/ship/ship.js');
  const { CONTENT } = await import('../../src/levels/content.js');
  const { createBoxes } = await import('../../src/boxes/index.js');
  const { buildFlora, floraKeep, FLORA_WORLDS } = await import('../../src/flora.js');
  const { game } = await import('../../src/game-state.js');
  const { clearInteractables, allInteractables } = await import('../../src/interact.js');
  const { clearTargets, allTargets } = await import('../../src/targets.js');
  const { Waters } = await import('../../src/water.js');
  const meta = levelById(levelId);
  if (!meta) throw new Error(`no level ${levelId}`);
  const content = CONTENT[levelId];
  // a fresh game for every world (the story's flags start from nothing, as a new save would arrive)
  game.data.flags = {}; game.data.keepsakes = [];
  clearInteractables(); clearTargets();
  const { humans, lib, travellerTemplate } = await sharedAssets();

  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  level.id ??= levelId;
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  level.init?.(physics);
  const waters = quiet(() => new Waters(scene, { physics, drops: false }));
  const staticRoots = new Set(scene.children);
  const prologue = levelId === 'desert';
  // (the desert: with the prologue's copy of the ship out in space: the Unity port plays the opening too)
  const ship = quiet(() => new Ship({ scene, physics, level, levelId, content, prologue }));
  level.ship ??= { pos: ship.rampFoot.clone() };
  const shipRoots = scene.children.filter((c) => !staticRoots.has(c));
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
  const crowd = level.crowdSpots ? quiet(() => new Crowd(scene, physics, { spots: { lines: level.crowdLines, ...level.crowdSpots() }, clear: content.npcs.map((s) => ({ x: s.at[0], y: s.y, z: s.at[1], r: 3 })), makeNPC: fakeNPC })) : null;
  const mounts = scene.children.length;
  const bike = level.mount ? quiet(() => level.mount(physics)) : null;
  if (bike?.object && !bike.object.parent) scene.add(bike.object);
  const spawn = level.spawn ?? V();
  const up = V(0, 1, 0);
  const player = {
    pos: V(spawn.x, spawn.y, spawn.z), vel: V(), wind: V(), heading: level.spawnHeading ?? 0, riding: false, mount: bike, vehicles: [...(level.vehicles ?? [])],
    frame: { up, dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)), quaternion: (h, q) => q.setFromAxisAngle(up, h), set() {} },
    respawn(p) { this.pos.copy(p); }, nearestVehicle: () => null, opts: {}, items: { has: () => false },
  };
  const npcs = [];
  const sound = new Proxy({}, { get: (t, k) => (k === 'ctx' ? null : k === 'band' ? () => null : () => {}) });
  // the people near the start (levels/content.js npcs, as main.js spawns them before the story)
  // (the desert's sketching traveller is exported as 'sketcher': 'traveller' is the player's figure)
  {
    const { spawnNPCs } = await import('../../src/npc.js');
    const spots = content.npcs.map((s) => ({ ...s, id: s.id === 'traveller' ? 'sketcher' : s.id }));
    const near = quiet(() => spawnNPCs(scene, physics, spots, { lib, humans }));
    near.forEach((n, i) => { n.def ??= spots[i]; n.contentNpc = true; npcs.push(n); });
  }
  const beforeStory = new Set(scene.children);
  const flagsBefore = { ...game.data.flags };
  const journal = { sections: [], el: { addEventListener() {} }, seen: () => false, storyDone: () => false, markSeen() {}, relicCount: () => 0, render() {} };
  const story = { complete() {}, start() {}, done: false, waitFor: null };
  const rt = quiet(() => createStory({ levelId, scene, physics, level, player, npcs, crowd, sound,
    journal, story, capture: null, lib, humans, toast() {}, tool: null, isNight: () => false, ship, drone: () => null }));
  const boxes = quiet(() => createBoxes({ levelId, scene, physics, level, player, sound, quests: rt.quests, toast() {}, anchor: () => ship.arrivalSpot() }));
  const storyRoots = scene.children.filter((c) => !beforeStory.has(c));
  const flora = quiet(() => buildFlora({ scene, level, levelId, physics, keep: floraKeep({ level, content, ship, npcs, crowd, boxes }) }));
  // the grass blades' fields (flora-grass.js grassFields): Unity grows its own blades round the camera
  const { grassFields } = await import('../../src/flora-grass.js');
  const grass = (() => { try { return grassFields(level); } catch { return []; } })();
  // let the story settle one frame (people onto the ground, a mount at rest)
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(player.pos).add(V(0, 2, 4));
  quiet(() => { try { rt.update(1 / 30, 0, { camera }); } catch (e) { console.error(e); } crowd?.update(1 / 30, 0, player, camera); });
  scene.updateMatrixWorld(true);
  // what the story set up as it started (its quests begun, flags it raised): the Unity port applies them on arrival
  const flagsAfter = { ...game.data.flags };
  const startFlags = Object.fromEntries(Object.entries(flagsAfter).filter(([k, v]) => JSON.stringify(flagsBefore[k]) !== JSON.stringify(v)));
  const shipDirector = await import('../../src/ship/cinematics.js');
  const shipHull = await import('../../src/ship/hull.js');
  const shipTable = (await import('../../src/ship/interior.js')).TABLE;
  return { levelId, meta, shipDirector, shipHull, shipTable, THREE, scene, level, physics, waters, ship, shipRoots, crowd, bike, player, npcs, rt, boxes, flora, grass, storyRoots, staticRoots,
    game, CONTENT, content, humans, lib, travellerTemplate, camera, startFlags, interactables: allInteractables(), targets: allTargets(), floraWorld: FLORA_WORLDS[levelId] ?? null, mounts };
}

/** The desert, as the first pass exported it. */
export const buildDesertWorld = () => buildWorld('desert');
