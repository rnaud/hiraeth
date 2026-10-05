// Build the desert headlessly, the way main.js does at load (and the tests do):
// the level, its physics, the ship at the arrival point, the story's people,
// the makers' boxes, the hoverbike and the flora. Returns everything the
// exporter needs to read back.
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

const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };

export async function buildDesertWorld() {
  const { createDesert } = await import('../../src/levels/desert.js');
  const { Physics } = await import('../../src/physics.js');
  const { Crowd } = await import('../../src/crowd.js');
  const { createStory } = await import('../../src/story/index.js');
  const { Ship } = await import('../../src/ship/ship.js');
  const { CONTENT } = await import('../../src/levels/content.js');
  const { createBoxes } = await import('../../src/boxes/index.js');
  const { buildFlora, floraKeep } = await import('../../src/flora.js');
  const { game } = await import('../../src/game-state.js');
  const { loadHuman } = await import('../../src/humanoid.js');
  const { loadAnimationLibrary } = await import('../../src/animator.js');
  // the people's bodies and their clips, as main.js loads them (the story's people are dressed on them)
  const humans = await Promise.all([loadHuman('m'), loadHuman('f')]);
  const lib = await loadAnimationLibrary('anim/ual.glb');
  const travellerTemplate = (await new GLTFLoader().loadAsync('anim/traveller.glb')).scene;

  const scene = new THREE.Scene();
  const level = quiet(() => createDesert(scene));
  const physics = new Physics(scene, level.ground);
  level.init?.(physics);
  const staticRoots = new Set(scene.children);
  // (with the prologue's copy of the ship out in space: the Unity port plays the opening too)
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'desert', content: CONTENT.desert, prologue: true }));
  level.ship ??= { pos: ship.rampFoot.clone() };
  const shipRoots = scene.children.filter((c) => !staticRoots.has(c));
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
  const crowd = new Crowd(scene, physics, { spots: level.crowdSpots(), makeNPC: fakeNPC });
  const bike = level.mount(physics);
  const player = {
    pos: V(level.spawn.x, level.spawn.y, level.spawn.z), vel: V(), wind: V(), heading: level.spawnHeading, riding: false, mount: bike,
    frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)), quaternion: (h, q) => q.setFromAxisAngle(V(0, 1, 0), h) },
  };
  const npcs = [];
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
  const beforeStory = new Set(scene.children);
  const rt = quiet(() => createStory({ levelId: 'desert', scene, physics, level, player, npcs, crowd, sound,
    journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} }, capture: null, lib, humans, toast() {}, tool: null }));
  const boxes = quiet(() => createBoxes({ levelId: 'desert', scene, physics, level, player, sound, quests: rt.quests, toast() {}, anchor: ship.arrivalSpot() }));
  const storyRoots = scene.children.filter((c) => !beforeStory.has(c));
  const flora = quiet(() => buildFlora({ scene, level, levelId: 'desert', physics, keep: floraKeep({ level, content: CONTENT.desert, ship, npcs, crowd, boxes }) }));
  // let the story settle one frame (people onto the ground, the hollow's bike at rest)
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(player.pos).add(V(0, 2, 4));
  quiet(() => { rt.update(1 / 30, 0, { camera }); crowd.update(1 / 30, 0, player, camera); });
  scene.updateMatrixWorld(true);
  const shipDirector = await import('../../src/ship/cinematics.js');
  const shipHull = await import('../../src/ship/hull.js');
  const shipTable = (await import('../../src/ship/interior.js')).TABLE;
  return { shipDirector, shipHull, shipTable, THREE, scene, level, physics, ship, shipRoots, crowd, bike, player, npcs, rt, boxes, flora, storyRoots, staticRoots, game, CONTENT, humans, lib, travellerTemplate, camera };
}
