// The way into a minigame from inside a world (docs/systems/minigames.md): an arcade sign that glows,
// with "play …" on the interact button (B / ○, E). The game's page opens (?game=<id>&from=<world>); its
// Quit comes back to the world, where the traveller was standing.
//
//   import { placeGameMarker } from './minigames/kit/marker.js';
//   placeGameMarker({ scene, levelId, lights: level.lights }, 'ski', new THREE.Vector3(12, 0, -40), { heading: 0.4 });

import * as THREE from 'three';
import { makeMaterial } from '../../materials.js';
import { registerInteractable, PRIORITY } from '../../interact.js';
import { gameById, gameHref } from '../index.js';

// ------------------------------------------------------------------ the arcade sign
/** The sign's model: a stone post, a slanted board with the game's glyph glowing, a lamp on top. */
export function gameMarkerModel(color = '#71d7cf') {
  const g = new THREE.Group();
  const stone = makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66' });
  const ink = makeMaterial({ color: '#3b2f2a', flat: true });
  const glow = makeMaterial({ color, glow: 1, flat: true });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.1, 8), stone);
  post.position.y = 1.05;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.12), stone);
  board.position.set(0, 2.05, 0.05); board.rotation.x = -0.2;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.68), ink);
  face.position.set(0, 2.06, 0.13); face.rotation.x = -0.2;
  // the glyph: a ring and a stroke through it, as the makers write "play"
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 24), glow);
  ring.position.set(0, 2.07, 0.17); ring.rotation.x = -0.2;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.04), glow);
  bar.position.copy(ring.position); bar.rotation.set(-0.2, 0, 0.5);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), glow);
  lamp.position.y = 2.72;
  g.add(post, board, face, ring, bar, lamp);
  g.userData.lamp = lamp;
  g.userData.ring = ring;
  return g;
}

/**
 * An arcade sign in a world that starts a game: walk up and press the interact button (B / ○, E).
 * @param world   { scene, levelId, lights? (the level's light list: the sign lights its ground), go? (href) => void }
 * @param gameId  a game's id (src/minigames/<id>.js)
 * @param pos     where it stands (a Vector3 or [x, y, z]); heading (radians) which way it faces
 * @returns { object, remove() }
 */
export function placeGameMarker(world, gameId, pos, { heading = 0, games } = {}) {
  const def = gameById(gameId, games);
  if (!def) throw new Error(`no minigame "${gameId}"`);
  const at = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos.clone();
  const object = gameMarkerModel(def.color);
  object.position.copy(at);
  object.rotation.y = heading;
  world.scene.add(object);
  const light = new THREE.Vector4(at.x, at.y + 2.7, at.z, 5);
  world.lights?.push(light);
  const go = world.go ?? ((href) => { location.href = href; });
  const off = registerInteractable({
    id: `minigame.${gameId}`, priority: PRIORITY.use, range: 3.2,
    at: () => object.position.clone().add(new THREE.Vector3(0, 2.9, 0)),
    prompt: `play ${def.name}`,
    distance: (p) => p.pos.distanceTo(object.position),
    use: () => go(gameHref(gameId, world.levelId)),
  });
  return {
    object,
    remove() { off(); object.removeFromParent(); const i = world.lights?.indexOf(light) ?? -1; if (i >= 0) world.lights.splice(i, 1); },
  };
}
