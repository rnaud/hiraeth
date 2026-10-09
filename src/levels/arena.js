import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { DESERT_WORLD_LOOK } from '../desert-sites.js';
import { placeGameMarker } from '../minigames/kit/marker.js';
import { WORLDS } from '../foe-worlds.js';
import { parseKind } from '../enemies/archetypes.js';
import { FOES } from '../foes.js';
import { FoeList } from '../foe-spawner.js';
import { gameById } from '../minigames/index.js';   // (none in node's tests: there is no glob there)
import { placeHitboxBoard } from './arena-hitbox-board.js';

// ---------------------------------------------------------------------------
// The Arena: a developer's world for the fluid blade and the foes (src/fluid-blade.js, src/foes.js),
// reached only from the worlds list (?level=arena). A ring of golden sand under an open sky, a few
// standing stones to fight round, a low ramp and a ledge. The foes come in waves round you, one after
// another, whatever the Enemies setting (level.foes.waves: src/foes.js): one ink blot, then three,
// then a makers' machine, then two machines with blots, and round again.
// ---------------------------------------------------------------------------

export function* buildArena(scene) {
  const query=new URLSearchParams(typeof location==='undefined'?'':location.search);
  // (enemies.html's links: ?enemy=lizard@bazaar one archetype in a skin, again and again; ?enemyWorld=bazaar that world's waves)
  const world = WORLDS[query.get('enemyWorld')] ? query.get('enemyWorld') : null;
  const kind = FOES[parseKind(query.get('enemy')).kind] ? query.get('enemy') : null;
  // the FOES list (src/foe-spawner.js): a menu of the level's, as the Arcade's board (D-pad ↓, K), and the guardians' ring
  const foeList = new FoeList();
  const terrain = yield* Terrain.make({
    size: 900, seg: 90,
    height: (x, z) => { const r = Math.hypot(x, z); return r < 150 ? 0 : (r - 150) * 0.07; },   // flat out to 150 m, a low rise at the edge: the open sky all round
    // the desert's golden sand (its ripples and inked grain), bright under the open sky
    material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  const stone = makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66', mode: MODE_STRATA, strataSize: 1.2 });
  const parts = [];
  yield;
  // standing stones in a ring, to fight round and between
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, r = 26 + (i % 2) * 6, h = 3.5 + (i % 3);
    parts.push(new THREE.CylinderGeometry(1.1, 1.5, h, 7).translate(Math.cos(a) * r, h / 2, Math.sin(a) * r).toNonIndexed());
  }
  // a low ledge with a ramp up to it, on the far side
  parts.push(new THREE.BoxGeometry(14, 2, 8).translate(0, 1, -44).toNonIndexed());
  parts.push(new THREE.BoxGeometry(6, 0.6, 10).rotateX(-0.2).translate(0, 1, -35.5).toNonIndexed());
  scene.add(new THREE.Mesh(mergeGeometries(parts), stone));
  yield;
  // a ring drawn on the sand where the waves come in round
  const ring = new THREE.Mesh(new THREE.RingGeometry(17.6, 18, 96).rotateX(-Math.PI / 2), makeMaterial({ color: '#8a6a48', flat: true }));
  ring.position.y = 0.03; ring.userData.noCollide = true;
  scene.add(ring);
  // the arcade sign of Ink tide, the endless waves as a game with a score (src/minigames/waves.js), by the way in
  if (gameById('waves')) placeGameMarker({ scene, levelId: 'arena' }, 'waves', new THREE.Vector3(7.5, 0, 9), { heading: -2.4 });
  // the hitbox board (src/hitboxes.js), across the way in from it: show or hide the fight's hitboxes
  placeHitboxBoard(scene, new THREE.Vector3(-7.5, 0, 9), { heading: 2.4 });

  return {
    id: 'arena',
    ground: terrain,
    spawn: new THREE.Vector3(0, 0, 6),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 9.5, preset: 'Moebius print', cloudShadows: 0, look: DESERT_WORLD_LOOK },   // (the desert's print: bright sand, a blue sky)
    killY: -Infinity,
    foes: { waves: true, chimes: 'training', ...(world ? { world } : {}), ...(kind ? { kind } : {}) },   // (chimes: into the wallet, not counted as earned: src/chimes.js)
    lendTool: { mode: null },   // (main.js: the backpack lent for the visit, so the blade and the shield are there on any save; nothing written to it)
    // the desert's print: a flat cerulean sky over cream sand
    sky: {
      script: {
        day: ['#92b6c5', '#d7dfd9', '#93a6cf', '#fff9ee', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 1.0, name: 'The Arena' }),   // (as the desert's golden dunes)
    quickMenu: foeList,   // (main.js: one of its menus; D-pad ↓ opens it, the mount's call: there is none here; main.js attaches the foes)
    dynamic: () => foeList.solids(),   // (a guardian called into its ring is solid: src/arena-guardians.js)
    update(dt, t) { foeList.update(dt, t); },
  };
}
export const createArena = stepped(buildArena);
