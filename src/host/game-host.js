// One game setup for both hosts (issue #427; docs/systems/engine-bridge.md, "One host"). src/main.js (the page) and
// engine/game.js (the engines' VM: Unity through Puerts, Godot) each built the game's systems and joined them by hand,
// and drifted apart: armTool and the kit's colours were the page's alone, so Unity hung the sword on him before he had
// it (#394). What is here is the game's own wiring, made once and called by both hosts where the page made it; each
// host keeps only its own layer (the page: its DOM, input, the WebGL renderer and the browser's loop; the engines:
// the mirror, their screen parts and their pads). A group a function, each returning what the frame calls:
//
//   wireKit({ tool, game, armed, onArm })                  the sword and the shield only once found, the kit's colours
//   wireDangers({ scene, level })                          the fires that burn, a world's deadly void
//
// tests/game-host.test.js holds each group to both hosts; scripts/bridge-gaps.mjs reports a group main.js calls and
// engine/game.js doesn't as a host gap (engine/bridge-gaps.js `shared:`).

import { applyKitColours, coloursData, cycleColour } from '../kit-colours.js';
import { registerHazard, updateHazards } from '../hazards.js';
import { fireHazard } from '../story/flames.js';
import { worldVoid } from '../pit-void.js';
import { hintsFor } from '../hint-level.js';

// ------------------------------------------------------------------ the kit
/**
 * The sword and the shield's guard are found (v1.44, the Rose House): without them no cut, no guard, and neither drawn
 * on him (the tool's items: a game on foot lends them, src/minigames/kit/onfoot.js). `armed`: both whatever the save
 * (an engine's fight bench, -fight, as the Arena lends them). And the kit in the colours chosen (src/kit-colours.js, won
 * in the fight temples), again on the backpack worn once his body is up. `onArm(sword, shield)`: before the tool
 * takes them, so a host can compare with tool.swordOn (the page's touch buttons).
 *   kit.arm()          each frame, before the tool's update
 *   kit.colours()      the Items panel's Colours row (null until a second set is won)
 *   kit.cycle(piece)   the next colour won for that piece, worn at once
 */
export function wireKit({ tool, game, armed = false, onArm = null }) {
  if (!tool) return null;
  const arm = () => {
    const s = armed || !!tool.items?.has('sword'), g = armed || !!tool.items?.has('shield');
    onArm?.(s, g);
    tool.swordOn = s; tool.shieldOn = g;
  };
  const paint = () => applyKitColours(tool, game);
  arm();
  paint();
  const wear = tool.wear.bind(tool);
  tool.wear = () => { wear(); paint(); };
  return { arm, paint, colours: () => coloursData(game), cycle: (piece) => { cycleColour(game, piece); paint(); } };
}

// ------------------------------------------------------------------ the world's dangers
let offFire = null;   // (one game at a time: the last one's fires let go, an engine's next world or a test's next game)
/**
 * Every fire drawn in the world burns while you stand in it (src/story/flames.js fireHazard; issue #77), with the
 * hazards the levels registered as they built (spines, a temple's spike rows: src/hazards.js); and a world's deadly
 * void under its kill height (issue #312, src/pit-void.js: a wash in level.veils, made if need be).
 *   dangers.update(dt, player, { quiet, say })   the hazards biting while you touch them; `say` a lesson (hints full)
 *   dangers.voidFrame(t)                         the void's rings' clock
 */
export function wireDangers({ scene, level }) {
  offFire?.();
  offFire = registerHazard(fireHazard(scene));
  const deadlyVoid = worldVoid(level);
  return {
    deadlyVoid,
    update(dt, player, { quiet = false, say = () => {} } = {}) {
      if (!quiet) updateHazards(dt, player, { notice: (t) => { if (hintsFor('tip')) say(t); } });   // ("It burns!": the hurt says it; the line, hints full)
    },
    voidFrame(t) { deadlyVoid?.update(t); },
  };
}
