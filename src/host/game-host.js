// One game setup for both hosts (issue #427; docs/systems/engine-bridge.md, "One host"). src/main.js (the page) and
// engine/game.js (the engines' VM: Unity through Puerts, Godot) each built the game's systems and joined them by hand,
// and drifted apart: armTool and the kit's colours were the page's alone, so Unity hung the sword on him before he had
// it (#394). What is here is the game's own wiring, made once and called by both hosts where the page made it; each
// host keeps only its own layer (the page: its DOM, input, the WebGL renderer and the browser's loop; the engines:
// the mirror, their screen parts and their pads). A group a function, each returning what the frame calls:
//
//   wireKit({ tool, game, armed, onArm })                  the sword and the shield only once found, the kit's colours
//   wireDangers({ scene, level })                          the fires that burn, a world's deadly void
//   wirePeople({ levelId, npcs, journal, … })              the errands, the faces of whoever talks near, the hum
//   wireChemistry({ flammables, wildlife, tool, … })       fire, wind, creatures and foes on each other
//   wireMount({ levelId, level, flag })                    the bird's promise, the hoverbike (before the traveller)
//   wireVehicles({ bikeHere, player, … })                  the bike by the ramp, skimming water, no calls into rooms
//
// tests/game-host.test.js holds each group to both hosts; scripts/bridge-gaps.mjs reports a group main.js calls and
// engine/game.js doesn't as a host gap (engine/bridge-gaps.js `shared:`).

import { applyKitColours, coloursData, cycleColour } from '../kit-colours.js';
import { registerHazard, updateHazards } from '../hazards.js';
import { fireHazard } from '../story/flames.js';
import { worldVoid } from '../pit-void.js';
import { hintsFor } from '../hint-level.js';
import { Errands } from '../quest.js';
import { ERRANDS } from '../levels/content.js';
import { talkFaces, TALK_FACE } from '../talk-face.js';
import { HumCue } from '../story/hum.js';
import { Chemistry } from '../chemistry.js';
import { birdAnswers, promisedBird } from '../bird.js';
import { bikeComes, parkedBike } from '../bike-worlds.js';

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

// ------------------------------------------------------------------ the people
/**
 * The errands (src/quest.js Errands: a parcel from one world's person to another's, kept in the journal), the hum when
 * words on the screen speak of it (src/story/hum.js: a toast, a subtitle, a line of a conversation, a balloon), and the
 * face of whoever talks near you (src/talk-face.js; a conversation drives its own).
 *   people.hear(text)                 words that went up (a host's toasts, if they don't go through the ship's cinema)
 *   people.talk(dt, best, camera)     each frame, once the balloon is chosen (src/balloon-part.js pickBalloon)
 *   people.errands.update()           each frame, after the people
 */
export function wirePeople({ levelId, npcs, journal, toast, titles, capture = () => null, sound = null, ship = null, game = null }) {
  const errands = new Errands({ levelId, defs: ERRANDS, npcs, journal, toast, titles, capture, sound });
  const hum = new HumCue();
  const hear = (text) => { if (hum.hear(text, performance.now() / 1000)) sound?.makersHum?.({ vol: 0.7 }); };
  if (ship?.cinema) ship.cinema.onWords = hear;
  game?.on?.('words', ({ text } = {}) => hear(text));
  let lastBalloon = null;
  return {
    errands, hear,
    talk(dt, best, camera) {
      // (a balloon that speaks of humming: the hum, softly)
      if (best?._balloonLine && best._balloonLine !== lastBalloon) { lastBalloon = best._balloonLine; hear(best._balloonLine); }
      if (best?.humanoid && !best.talkTo && best.object?.visible && camera.position.distanceTo(best.pos) < TALK_FACE.near) talkFaces.drive(best.humanoid, best.balloonFace());
      talkFaces.update(dt);
    },
  };
}

// ------------------------------------------------------------------ the world's chemistry
/** Fire spreads on the wind, creatures flee it, foes catch it (src/chemistry.js); chemistry.update(dt, player.pos) after what burns. */
export function wireChemistry({ flammables = null, wildlife = null, tool = null, game = null, player }) {
  return new Chemistry({ flammables, wildlife, tool, game, wind: player.wind });
}

// ------------------------------------------------------------------ the mount and the vehicles
/**
 * The bird's promise: under open sky, in a world with no mount of its own, the whistle calls Vael's bird down (src/bird.js);
 * the hoverbike, found in the desert, comes out of the ship in the worlds made for riding (src/bike-worlds.js), called from
 * your pack unless the bird answers there. Sets level.mount and level.mountName, before the traveller is made (his
 * Player takes them). → { bikeHere }, for wireVehicles.
 */
export function wireMount({ levelId, level, flag }) {
  if (birdAnswers(levelId, level, flag)) { level.mount = (p) => promisedBird(p, level.spawn); level.mountName = 'bird'; }
  const bikeHere = bikeComes(levelId, level, flag);
  if (bikeHere && !level.mount) { level.mount = (p) => parkedBike(p, level.spawn, level.spawnHeading ?? 0); level.mountName = 'hoverbike'; }
  return { bikeHere };
}

/**
 * Once the traveller is made, with the world's own vehicles in player.vehicles (the cabs):
 *   - the hoverbike stands by the ramp to be boarded where the bird is this world's mount (Viridel: issue #376);
 *   - hoverbikes and skiffs skim over any water (bike.js groundAt, the waters' floor);
 *   - rooms off the map, reached through doorways (the desert's chambers, the cave in the giant's chest, ~1 km up): no
 *     whistling the mount or hailing a cab into them (it would come to the same x, z far below and wait there), nor
 *     from inside the ship (player.opts.canSummon).
 * → { rooms, inRoom() }: the rooms off the map (the page culls by them).
 */
export function wireVehicles({ bikeHere = false, player, physics, level, scene, waters = null, ship = null }) {
  if (bikeHere && player.mount?.kind !== 'bike') {
    const bike = parkedBike(physics, level.spawn, level.spawnHeading ?? 0);
    scene.add(bike.object);
    player.vehicles.push(bike);
  }
  if (waters?.floorAt) for (const v of player.vehicles) if (v.groundAt && !v.surface) v.surface = (x, y, z) => waters.floorAt(x, y, z);
  const ground = level.ground;
  const rooms = (level.portals ?? []).filter((p) => p.to && !p.toUp && p.to.y - (ground?.heightAt?.(p.to.x, p.to.z) ?? p.to.y) > 200).map((p) => p.to);
  const inRoom = () => rooms.some((r) => r.distanceToSquared(player.pos) < 90 * 90);
  player.opts.canSummon = () => !inRoom() && !ship?.inside;
  return { rooms, inRoom };
}
