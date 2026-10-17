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
//   wireShip({ level, ship })                              the ship's place for quests, the scout and the Map
//   wireMount({ levelId, level, flag })                    the bird's promise, the hoverbike (before the traveller)
//   wireVehicles({ bikeHere, player, … })                  the bike by the ramp, skimming water, no calls into rooms
//   wireLessons({ game, items, gadgets, sound, plumb, … }) what the save's events say and start (a gadget's line, Plumb)
//   wireCompanion({ game, plumb, scout, level, … })        Plumb each frame: its escort, its hints, its first word (#434)
//   wireCamera, wireHero, heroCutFrame                     the camera kept out of the cabs, the traveller's own surfaces
//   cameraFollow({ rig, player })                          the follow shot: a ride's, behind the jets, the wide arm
//   wireBenches({ levelId, scene, physics, …, rig })       the benches to sit on
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
import { gadgetFoundLine } from '../gadgets/index.js';
import { syncUpgrades } from '../trials/upgrades.js';
import { keyText } from '../prompt-keys.js';
import { placeOf, droneWorld, shown as droneShown } from '../companion.js';
import { ESCORT } from '../scout.js';
import { guardianHint } from '../temples/hints.js';
import { createBenches } from '../benches.js';
import { cameraPhysics, keepLensOut } from '../carriers.js';
import { keepHero, markHero, sharedUniforms } from '../materials.js';
import { heroCut, jetCameraPitch, WIDE } from '../player.js';

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

// ------------------------------------------------------------------ the ship
/**
 * The ship at its site: where the world's "the ship" is, unless the level says (quests that say "return to the ship"
 * point at its ramp, the scout finds it, the Map's "Your ship" mark). Once the Ship is made.
 */
export function wireShip({ level, ship }) {
  if (ship?.rampFoot) level.ship ??= { pos: ship.rampFoot.clone() };
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

// ------------------------------------------------------------------ what the save's events say and start
/**
 * The game's events (game-state.js `game.on`), answered alike in both hosts:
 *   - a gadget found is in hand at once (issue #330): after its box's card, one line says so, or the item's own lesson,
 *     once (src/gadgets/index.js gadgetFoundLine; the first time two are carried, how to pick another)
 *   - a keepsake kept: the recorded theme comes back (src/music-moments.js), where the host has sound
 *   - the trials' rewards, upgrades to the gadgets' tuning while owned (src/trials/upgrades.js): before the gadgets are made
 *   - Plumb's lost clock starts over at a quest, a keepsake, a conversation, a box, an item had; its notes on the first
 *     chest and the first steps out of the crashed ship (src/companion.js), where the host has Plumb
 * `gadgets()` is asked when a box opens (the gadgets are made later than this).
 */
export function wireLessons({ game, items, levelId, gadgets = () => null, sound = null, toast, plumb = null }) {
  syncUpgrades((id) => items.has(id));
  items.on(() => syncUpgrades((id) => items.has(id)));
  game.on('box:opened', ({ item } = {}) => {
    const found = gadgetFoundLine(item, { owned: gadgets()?.owned?.() ?? [], taught: (k) => !!game.flag(`${k}.taught`), teach: hintsFor('teach'), tip: hintsFor('tip') });
    if (!found) return;
    if (found.key) game.set(`${found.key}.taught`, true);
    setTimeout(() => toast(keyText(found.text, { teach: true })), 4200);
  });
  if (sound) game.on('keepsake', () => sound.musicCue?.('moment', { delay: 1 }));
  if (plumb) {
    for (const ev of ['quest', 'keepsake', 'dialogue:start', 'box:opened']) game.on(ev, () => plumb.progress());
    game.on('item', (e) => { if (!(e?.n < 0)) plumb.progress(); });
    game.on('box:opened', () => plumb.note('chest'));
    game.on('ship:exit', () => { if (levelId === 'desert' && !game.flag('item.backpack')) plumb.note('out'); });   // (the first steps out of the crashed ship)
  }
}

// ------------------------------------------------------------------ Plumb's own mind, each frame
/**
 * Plumb, the drone (issue #434; src/companion.js, src/scout.js): handed over by the prologue's drone, it escorts you
 * (game 'drone:out'); each frame after the scout, the first person near (its opening line), the goal and the place it
 * names, the makers' house you are in and its step, the guardian's phase, then its line and the ping's flight (its first
 * word, "the village on the horizon", starts the desert's quest: 'drone:village', src/story/desert.js).
 *   const plumbStep = wireCompanion({ game, plumb, scout, level, player, npcs, struggle })
 *   plumbStep(dt, { canSpeak, fight })   → its line as the cue shows it ('' none); the host puts it up
 * `plumb` null (a host without the help): only the escort.
 */
export function wireCompanion({ game, plumb = null, scout = null, level, player, npcs = [], struggle = null }) {
  if (scout) game.on('drone:out', (e) => scout.escort(ESCORT.secs, e?.pos ?? null));
  const at = { goalT: 0, goal: null, lookT: 0, place: null, world: { fight: null, house: null }, names: null };
  return (dt, { canSpeak = true, fight = false } = {}) => {
    if (!plumb) return '';
    // the first person near (the opening's line): now and then
    if ((at.lookT -= dt) <= 0) {
      at.lookT = 0.5;
      const metAnyone = Object.keys(game.data?.flags ?? {}).some((k) => k.startsWith('met.'));
      if (!metAnyone) for (const n of npcs) {
        if (!n.def?.id || n.pooled || !n.object?.visible) continue;
        if (n.pos.distanceTo(player.pos) < 8) { plumb.note('person'); break; }
      }
    }
    const hint = level.temple ? guardianHint(level.temple) : null, secs = struggle?.t ?? 0;
    if ((at.goalT -= dt) <= 0) {
      at.goalT = 1;
      const target = fight ? null : scout?.getTarget?.() ?? null;
      at.goal = target?.position ?? null;
      // (the place it names when you look lost, never a person: src/companion.js placeOf)
      at.names ??= new Set(npcs.map((n) => n.def?.name).filter(Boolean));
      at.place = target ? placeOf(target.label, at.names) : null;
      at.world = droneWorld({ level, pos: player.pos, hint, secs });
    }
    const r = plumb.update(dt, { active: !fight && !(scout?.out && scout.phase !== 'escort'), canSpeak, pos: player.pos, goal: at.goal, place: at.place,
      house: at.world.house, fight: hint ? { id: hint.id, secs } : null });
    if (r.point === 'village') game.emit('drone:village');
    if (r.point) scout?.ping();   // (out toward the goal, a look, the flare, home; in a guardian's fight, the hint)
    return r.say ? droneShown(r.say) : '';
  };
}

// ------------------------------------------------------------------ the camera and the traveller's own surfaces
/**
 * The camera's view of the world: the level's collision and the cabs and carriers as drawn, never the one you ride
 * (src/carriers.js cameraPhysics), the lens kept out of them and inside the level's own bounds (keepLensOut,
 * level.constrainCamera). → { physics, constrain }: the CameraRig's physics and its constrain.
 */
export function wireCamera({ physics, level, player }) {
  return {
    physics: cameraPhysics(physics, () => player.vehicles, () => player.ride),
    constrain: (cam) => { level.constrainCamera?.(cam); keepLensOut(cam, () => player.vehicles, () => player.ride); },
  };
}
/**
 * The traveller's own surfaces marked his (materials.js uHero: his own shadow map, the lens cut), the gear hung on him
 * later too (keepHero watches him), and his cape. → the copies (a host may mark more with them).
 */
export function wireHero({ player }) {
  const copies = keepHero(player.char.root);
  markHero(player.gear?.device, copies);
  markHero(player.cape?.mesh, copies);
  return copies;
}
/**
 * Each frame, after the camera is placed: the lens inside the traveller (his back to a cabin's wall, the camera pressed
 * into him) leaves his own surfaces out of the view, his shadow kept (issue #324; src/player.js heroCut, the shared
 * uHeroCut). `off`: a scene, photo mode or a game that takes the camera.
 */
export function heroCutFrame({ camera, player, off = false }) {
  const U = sharedUniforms.uHeroCut;
  U.value = !off && heroCut(U.value > 0.5, camera.position, player.pos, player.frame?.up) ? 1 : 0;
}

/**
 * The follow camera's shot each frame, before rig.update: a ride's own shot (the bike's, the bird's); on the jets, round
 * behind the nose and tipped with it (jetCameraPitch); a wider arm for what needs to see ahead and below (gliding, the
 * jets the more the faster, a little climbing and swimming: WIDE); knocked down, low and soft; off the ground in a
 * hop, the view rising with it. → follow(dt) for the frame.
 */
export function cameraFollow({ rig, player }) {
  const jetShot = { pitch: 0, keepTight: true, yawRate: 4 };   // (behind the jets' nose: rig.follow's shot)
  return (dt) => {
    const jets = player.onJets, jetSpeed = jets ? player.vel.length() : 0;
    const wide = player.riding ? null : player.gliding ? WIDE.glide : jets || player.jetHold ? WIDE.jets + Math.min(jetSpeed, 30) * WIDE.jetsPerMs : player.climbing ? WIDE.climb : player.swim ? WIDE.swim : 0;
    const shot = jets ? (jetShot.pitch = jetCameraPitch(player.jetFlight.pitch), jetShot) : null;
    rig.follow(player.ride?.heading ?? player.heading, dt, player.riding || player.gliding || jets, player.ride?.shot ?? shot, wide);
    rig.down = !!player.down;
    rig.air = !player.onGround && !player.climbing && !player.swim && !player.riding;
  };
}

// ------------------------------------------------------------------ the benches
let lastBenches = null;   // (one game at a time: the last one's let go, its E's interactables with them)
/**
 * The benches to sit on (src/benches.js, issue #363): E by one sits him, the camera comes round behind and above, the
 * HUD fades (the body's 'seated'), a move, a jump, B or E stands him up. Once the camera rig is made. Each frame:
 * benches.update(dt, input, ePressed) after the story took E, benches.inputFor(input) as the traveller's input,
 * benches.frameCamera(camera) after the rig.
 */
export function wireBenches({ levelId, scene, physics, level, player, sound = null, rig }) {
  lastBenches?.dispose?.();
  return (lastBenches = createBenches({ levelId, scene, physics, level, player, sound, rig }));
}
