// The serendipity map's world (issue #381; docs/systems/dev-tools.md "The serendipity map"): a world built as the
// play-through builds it (tests/playthrough-agent.js loadWorld), minus everything that moves: the level and its
// temples, the collision, its people, the story runtime with its quests and locators, the makers' boxes. Nothing is
// drawn here and nothing updates: the page (src/serendipity-page/main.js) draws the scene in a cheap look of its own,
// the collector (collect.js) reads the places off it. The same in node (tests/serendipity-map.test.js) and in the page.
//
// The page sandboxes the save (src/save-slots.js) before this module loads: the story's set-up writes flags, never to
// the player's slots.
//
//   const W = buildWorld('desert')   → { id, meta, scene, level, physics, npcs, quests, boxes, content }

import * as THREE from 'three';
import { LEVELS } from '../levels/index.js';
import { buildableById } from '../levels/buildable.js';
import { CONTENT } from '../levels/content.js';
import { Physics } from '../physics.js';
import { Player } from '../player.js';
import { spawnNPCs } from '../npc.js';
import { createStory } from '../story/index.js';
import { createBoxes } from '../boxes/index.js';
import { clearInteractables } from '../interact.js';
import { clearTargets } from '../targets.js';
import { ORDER, SIDE } from '../levels/names.js';
import { takeHosts } from '../minigames/kit/hosts.js';

/** The worlds the map offers: the route in its order, the side worlds, then the special places (no dev rooms). */
export function mapWorlds(levels = LEVELS) {
  const rank = (id) => { const i = ORDER.indexOf(id); if (i >= 0) return i; const j = SIDE.indexOf(id); return j >= 0 ? 100 + j : 200; };
  return levels.filter((l) => !l.dev).map((l) => ({ id: l.id, title: l.title ?? l.id, route: ORDER.includes(l.id) })).sort((a, b) => rank(a.id) - rank(b.id));
}

const silent = () => new Proxy({ tune: () => true }, { get: (o, k) => (k in o ? o[k] : () => null) });
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };

/** Build a world (see the head of this file). */
export function buildWorld(id) {
  clearInteractables(); clearTargets(); takeHosts();
  const meta = LEVELS.find((l) => l.id === id) ?? buildableById(id);
  if (!meta) throw new Error(`no world "${id}"`);
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const player = quiet(() => new Player(physics, { mount: level.mount, jetpack: level.features?.jetpack, climb: level.features?.climb ?? true, spawn: level.spawn, spawnHeading: level.spawnHeading,
    gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic, killY: level.killY, health: false }));
  const npcs = quiet(() => spawnNPCs(scene, physics, CONTENT[id]?.npcs ?? []));
  const journal = { done: new Set(), seen: new Set([id]), storyDone: () => false, sections: [], el: { addEventListener() {} } };
  const story = { complete() {}, completePart: () => true, def: CONTENT[id]?.story ?? {}, done: false, goal: null };
  const rt = quiet(() => createStory({ levelId: id, scene, physics, level, player, npcs, crowd: null, sound: silent(), journal, story, capture: null, lib: null, humans: null,
    toast: () => {}, tool: null, isNight: () => false }));
  level.ship ??= { pos: level.spawn.clone() };
  const anchor = { pos: level.spawn.clone(), heading: level.spawnHeading ?? 0 };
  const boxes = quiet(() => createBoxes({ levelId: id, scene, physics, level, player, sound: silent(), quests: rt.quests, toast: () => {}, anchor, quiet: () => true }));
  // (the games' signs a level placed itself ask for their hosts: main.js hands them to the story; the map marks them)
  const hosts = takeHosts();
  return { id, meta, scene, level, physics, player, npcs, quests: rt.quests, boxes, content: CONTENT[id] ?? null, rt, hosts };
}
