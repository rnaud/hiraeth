// Where a minigame runs (docs/systems/minigames.md):
//   - its own small arena, built on the fly as the page's level: the game's build(scene) generator returns
//     the level, and arenaLevel() fills in what every level needs (the desert's print look by default);
//   - or a corner of an existing world: the game's `world` (a level id), the traveller put at its `at`.
// (the way into a game from inside a world, an arcade sign: kit/marker.js placeGameMarker)

import * as THREE from 'three';
import { DESERT_WORLD_LOOK } from '../../desert-sites.js';

/** The level a game is played in (main.js): the world it names, or its own arena under its host's id. */
export function levelMetaFor(def, levelById) {
  if (def.world) return levelById(def.world);
  const host = levelById(def.host ?? 'arena');   // (whose save corner, sound and story slot the arena borrows: the Arena's, a developer's world)
  // (the level answers to its host's id, which the world's other systems know: the sound, the edge, the costumes)
  const build = function* (scene) { const L = yield* def.build(scene); L.id ??= host.id; return L; };
  return { ...host, build, create: null, title: def.name, source: 'a game', blurb: def.blurb };
}

/** The desert's print sky (the Arena's): a flat cerulean over cream sand. */
export const DESERT_SKY = {
  script: {
    day: ['#92b6c5', '#d7dfd9', '#93a6cf', '#fff9ee', '#fff6dc'],
    dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
    night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
  },
};

/**
 * A minigame arena's level, everything main.js asks of a level with sensible defaults:
 * { ground (a Terrain, or anything with heightAt), spawn, name, … any level field }.
 */
export function arenaLevel({ ground, spawn = new THREE.Vector3(), name = 'A game', hour = 10, look = DESERT_WORLD_LOOK, sky = DESERT_SKY, ...rest }) {
  return {
    ground,
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: false, climb: false },
    defaults: { hour, preset: 'Moebius print', cloudShadows: 0, look },
    killY: -Infinity,
    shipSite: { x: spawn.x + 3000, z: spawn.z + 3000, heading: 0 },   // (the ship far out of the picture; the runner hides it too)
    sky,
    edgeHint: 'The game ends here.',
    atmo: () => ({ tint: [1, 1, 1], fog: 1.0, name }),
    update() {},
    reactions: false,   // (no flowers waking along a race course: src/reactive-world.js)
    peaceful: true,     // (no ink blots coming out of the sand mid-race: src/foes.js)
    ...rest,
  };
}

