// The fight temples (issue #341; docs/design/fight-temples.md): a temple of another kind in each world, played as a
// Diablo is, from high above at a fixed angle, through a few linked rooms of many light foes, for a world's colours
// for the backpack, the sword and the shield (src/kit-colours.js). Each is a minigame (src/minigames/fight-<world>.js:
// one line, this factory over the world's table), so the start card, the pause, Retry, the best time and the host by
// its door are the kit's (docs/systems/minigames.md).
//
//   export default fightTempleGame(DESERT_FIGHT);      // src/minigames/fight-desert.js

import { entranceModel } from './entrance.js';
import { buildHall } from './rooms.js';
import { startFightTemple } from './session.js';
import { drawRun, seedOf } from './generate.js';
import { rollKey } from './rules.js';
import { padFaces } from '../native-pad.js';

// The way in, in its world (the game's sign: kit/marker.js uses a game's `marker.model`): the Blade Gate (issue #384),
// a small makers' gatehouse crowned with two crossed blades and a shield, dressed in the world's palette.
export { entranceModel, ENTRANCE } from './entrance.js';

/** A world's fight temple as a minigame (its table: src/fight-temples/<world>.js). */
export function fightTempleGame(def) {
  return {
    id: def.id, order: 30,
    name: def.name,
    blurb: def.blurb,
    rules: 'Clear the rooms one by one: the waves come up out of the ink springs, many foes at once, each felled in a cut or two. Hearts and chimes drop as they fall. The last room’s last wave is the hardest; then the reliquary on the altar holds new colours for your kit. The rooms and their waves are different on every visit. Best time kept.',
    drives: false,
    fightTemple: def.world,
    controls: {
      // (the roll on the button printed B, wherever the pad has it: rules.js rollInput, issue #442)
      get pad() { return [['Left stick', 'walk (up the screen is up)'], ['Right stick', 'aim (the blade and the gun take the foe that way)'], ['RB / R1', 'cut (again to chain)'], ['RT / R2', 'a quick shot of fluid'], ['LB / L1', 'guard (just as a blow lands: parry)'], [rollKey(padFaces().faces), 'roll'], ['Menu', 'pause']]; },
      keys: [['W A S D', 'walk (up the screen is up)'], ['Mouse', 'aim (the ring on the floor)'], ['Left mouse or F', 'cut (again to chain)'], ['G, or right mouse + left mouse', 'shoot the fluid'], ['Ctrl or Z', 'guard (just as a blow lands: parry)'], ['Alt', 'roll'], ['Esc', 'pause']],
      touch: [['Stick', 'walk'], ['⚔', 'cut'], ['✺', 'a quick shot'], ['◇', 'guard'], ['↶', 'roll']],
    },
    touchButtons: ['run', 'fire', 'blade', 'guard', 'evade'],
    score: { kind: 'time' },
    hud: { timer: true, score: true },
    color: def.palette.glyph,
    // (each visit its own run, drawn from the table with a seed: generate.js; ?seed=<n> replays one)
    build: function* (scene) { return yield* buildHall(scene, drawRun(def, seedOf())); },
    start: startFightTemple,
    markers: def.entrance ? [{ level: def.entrance.level ?? def.world, at: def.entrance.at, heading: def.entrance.heading }] : [],
    marker: { model: () => entranceModel(def), stand: def.entrance?.stand, door: true },
    table: def,
  };
}
