// The fight temples (issue #341; docs/design/fight-temples.md): a temple of another kind in each world, played as a
// Diablo is, from high above at a fixed angle, through a few linked rooms of many light foes, for a world's colours
// for the backpack, the sword and the shield (src/kit-colours.js). Each is a minigame (src/minigames/fight-<world>.js:
// one line, this factory over the world's table), so the start card, the pause, Retry, the best time and the host by
// its door are the kit's (docs/systems/minigames.md).
//
//   export default fightTempleGame(DESERT_FIGHT);      // src/minigames/fight-desert.js

import * as THREE from 'three';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { buildHall } from './rooms.js';
import { startFightTemple } from './session.js';

/**
 * The way in, in its world (the game's sign: kit/marker.js uses a game's `marker.model`): a makers' doorway half
 * sunk in the sand, its jambs and lintel burnt with the ember glyph, a dark veil of ink in it, steps down.
 */
export function entranceModel(def) {
  const P = def.palette;
  const g = new THREE.Group();
  const stone = makeMaterial({ color: P.wall, color2: P.wall2, color3: P.wall3, mode: MODE_STRATA, strataSize: 0.8 });
  const ink = makeMaterial({ color: P.ink, flat: true });
  const glow = makeMaterial({ color: P.glyph, flat: true, glow: 0.9 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.8, 3.2, 0.9), stone, sx * 1.6, 1.4, 0);
    add(new THREE.BoxGeometry(0.12, 1.6, 0.06), glow, sx * 1.6, 1.6, 0.48);
  }
  add(new THREE.BoxGeometry(4.2, 0.7, 1.1), stone, 0, 3.2, 0);
  add(new THREE.BoxGeometry(2.4, 0.1, 0.06), glow, 0, 3.2, 0.58);
  add(new THREE.PlaneGeometry(2.4, 2.9), ink, 0, 1.25, 0.05);
  // the steps down, sunk in the sand before the door
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(2.6, 0.2, 0.6), stone, 0, 0.04 - i * 0.18, 0.75 + i * 0.55);
  // a broken pillar beside it, fallen
  const p = add(new THREE.CylinderGeometry(0.5, 0.55, 2.6, 9), stone, 3.4, 0.4, 1.2); p.rotation.z = Math.PI / 2; p.rotation.y = 0.5;
  g.userData.lamp = null;
  g.userData.solid = true;   // (kit/marker.js: a collider of its own, placed after the world's is baked)
  return g;
}

/** A world's fight temple as a minigame (its table: src/fight-temples/<world>.js). */
export function fightTempleGame(def) {
  return {
    id: def.id, order: 30,
    name: def.name,
    blurb: def.blurb,
    rules: 'Clear the rooms one by one: the waves come up out of the ink springs, many foes at once, each felled in a cut or two. Hearts and chimes drop as they fall. The last room’s last wave is the hardest; then the reliquary on the altar holds new colours for your backpack, sword and shield. Best time kept.',
    drives: false,
    fightTemple: def.world,
    controls: {
      pad: [['Left stick', 'walk (up the screen is up)'], ['Right stick', 'aim (the blade and the gun take the foe that way)'], ['RB / R1', 'cut (again to chain)'], ['RT / R2', 'a quick shot of fluid'], ['LB / L1', 'guard (just as a blow lands: parry)'], ['B / ○', 'evade'], ['Menu', 'pause']],
      keys: [['W A S D', 'walk (up the screen is up)'], ['Mouse', 'aim (the ring on the floor)'], ['Left mouse or F', 'cut (again to chain)'], ['G, or right mouse + left mouse', 'shoot the fluid'], ['Ctrl or Z', 'guard (just as a blow lands: parry)'], ['Alt', 'evade'], ['Esc', 'pause']],
      touch: [['Stick', 'walk'], ['⚔', 'cut'], ['✺', 'a quick shot'], ['◇', 'guard'], ['↶', 'evade']],
    },
    touchButtons: ['jump', 'run', 'fire', 'blade', 'guard', 'evade'],
    score: { kind: 'time' },
    hud: { timer: true, score: true },
    color: def.palette.glyph,
    build: function* (scene) { return yield* buildHall(scene, def); },
    start: startFightTemple,
    markers: def.entrance ? [{ level: def.world, at: def.entrance.at, heading: def.entrance.heading }] : [],
    marker: { model: () => entranceModel(def), stand: def.entrance?.stand },
    table: def,
  };
}
