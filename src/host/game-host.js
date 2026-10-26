// One game setup for both hosts (issue #427; docs/systems/engine-bridge.md, "One host"). src/main.js (the page) and
// engine/game.js (the engines' VM: Unity through Puerts, Godot) each built the game's systems and joined them by hand,
// and drifted apart: armTool and the kit's colours were the page's alone, so Unity hung the sword on him before he had
// it (#394). What is here is the game's own wiring, made once and called by both hosts where the page made it; each
// host keeps only its own layer (the page: its DOM, input, the WebGL renderer and the browser's loop; the engines:
// the mirror, their screen parts and their pads). A group a function, each returning what the frame calls:
//
//   wireKit({ tool, game, armed, onArm })                  the sword and the shield only once found, the kit's colours
//   wireDangers({ scene, level })                          the fires that burn, a world's deadly void
//   wirePeople({ levelId, errandDefs, npcs, journal, … })              the errands, the faces of whoever talks near, the hum
//   wireChemistry({ flammables, wildlife, tool, … })       fire, wind, creatures and foes on each other
//   wireShip({ level, ship })                              the ship's place for quests, the scout and the Map
//   wireMount({ levelId, level, flag })                    the bird's promise, the hoverbike (before the traveller)
//   wireVehicles({ bikeHere, player, … })                  the bike by the ramp, skimming water, no calls into rooms
//   wireLessons({ game, items, gadgets, sound, plumb, … }) what the save's events say and start (a gadget's line, Plumb)
//   wireCompanion({ game, plumb, scout, level, … })        Plumb each frame: its escort, its hints, its first word (#434)
//   wireCamera, wireHero, heroCutFrame                     the camera kept out of the cabs, the traveller's own surfaces
//   cameraFollow({ rig, player })                          the follow shot: a ride's, behind the jets, the wide arm
//   wireBenches({ levelId, scene, physics, …, rig })       the benches to sit on
//   wireTrails({ scene, player, physics, tool })           the hover vehicles' trails
//   wireOpenings({ scene }), wireEdge({ wind, … })         the walls' openings for their cracks, the ink at the world's edge
//   wireSky({ level, U, onPreset })                        the style preset, the planets, a level's zones
//   wirePotion({ game, toast }), wireNudges({ … })         the potion's glow and lesson, the world's nudges
//   fragmentsLine({ fragments, game, items, levelId })     the Start menu's line of the fragments
//   wireHealth, hurtReactions, wireFight, wireAmbush       the hearts, a hurt's answer, the foes and the lock-on, the pirates (#435)
//   toolGauge({ tool, player, camera })                    the tool's crosshair and notices to the screen, placed by him
//   wireJumpShade({ scene, level })                        the patch of shade under a jump
//
// tests/game-host.test.js holds each group to both hosts; scripts/bridge-gaps.mjs reports a group main.js calls and
// engine/game.js doesn't as a host gap (engine/bridge-gaps.js `shared:`).

import { applyKitColours, coloursData, cycleColour } from '../kit-colours.js';
import { registerHazard, updateHazards } from '../hazards.js';
import { fireHazard } from '../story/flames.js';
import { worldVoid } from '../pit-void.js';
import { hintsFor } from '../hint-level.js';
import { Errands } from '../quest.js';
import { talkFaces, TALK_FACE } from '../talk-face.js';
import { HumCue } from '../story/hum.js';
import { Chemistry } from '../chemistry.js';
import { birdAnswers, promisedBird } from '../bird.js';
import { bikeComes, parkedBike, trailVehicles, trailVehicle } from '../bike-worlds.js';
import { Trail } from '../trail.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { wallOpenings } from '../wall-openings.js';
import { EdgeInk } from '../edge.js';
import { PRESETS } from '../post.js';
import { t as tr } from '../i18n.js';
import { fragmentPurse } from '../fragment-shop.js';
import * as THREE from 'three';
import { gadgetFoundLine } from '../gadgets/index.js';
import { syncUpgrades } from '../trials/upgrades.js';
import { keyText } from '../prompt-keys.js';
import { placeOf, droneWorld, shown as droneShown, HAIL, PLUMB_PERSON, plumbTalk } from '../companion.js';
import { ESCORT, TALK } from '../scout.js';
import { ATTEND, AttendGate, AttendPicker, attendCandidates } from '../drone-attend.js';
import { guardianHint } from '../temples/hints.js';
import { createBenches } from '../benches.js';
import { cameraPhysics, keepLensOut } from '../carriers.js';
import { keepHero, markHero, sharedUniforms } from '../materials.js';
import { heroCut, jetCameraPitch, OPEN_DIST, WIDE } from '../player.js';
import { JumpShadow } from '../jump-shadow.js';
import { screen } from '../platform.js';
import { sceneHolds } from '../hud-shows.js';
import { Foes, lockFollow, LOCK_NEAR } from '../foes.js';
import { guardianBox } from '../lock-frame.js';
import { hopAxis } from '../jump.js';
import { lockAim } from '../fluid-tool.js';
import { AimNudge, AIM_NUDGE, lockAimStep } from '../lock-aim.js';
import { ChimeField, ChimeView, dropPolicy, connectDrops, purseSpot } from '../chimes.js';
import { PotionDrops } from '../potion-drops.js';
import { LowHealthCue } from '../low-health.js';
import { resources, POTION } from '../resources.js';
import { kick, flurry, endFlurry, flurryLeft } from '../feel.js';
import { FLURRY, nextFlurry } from '../flurry.js';
import { rumblePlay } from '../rumble.js';
import { lockLesson } from '../hook-foes.js';
import { items } from '../items.js';
import { Fader, healthHud, walletTick } from '../hud-state.js';
import * as shipSfx from '../ship/sfx.js';
import { ambushDue, ambushHref, ambushKey, transitLinks } from '../ambush.js';

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
export function wirePeople({ levelId, errandDefs, npcs, journal, toast, titles, capture = () => null, sound = null, ship = null, game = null }) {
  if (!Array.isArray(errandDefs)) throw new TypeError('wirePeople requires the host errandDefs array');
  const errands = new Errands({ levelId, defs: errandDefs, npcs, journal, toast, titles, capture, sound });
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
 *     from inside the ship (player.opts.canSummon);
 *   - E boards the nearest vehicle, and its prompt floats by it ("ride the bird", "get in the cab"), sharing the interact
 *     button with talking, nearest wins (src/interact.js; the engines boarded but showed no prompt before: issue #459).
 * → { rooms, inRoom() }: the rooms off the map (the page culls by them).
 */
export function wireVehicles({ bikeHere = false, player, physics, level, scene, waters = null, ship = null, items = null }) {
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
  // (as far as the vehicle lets you board from: a cab hovering beside a terrace is further off than a bike; measured to
  // its side, not its middle: a cab is four metres long, and a passer-by at your shoulder was nearer than its centre)
  registerInteractable({ id: 'vehicle', priority: PRIORITY.vehicle, range: 9, at: () => player.nearestVehicle()?.pos,
    prompt: () => boardPrompt(player.nearestVehicle(), level.mountName, !!items?.has?.('backpack')),
    distance: (p) => { const v = p.nearestVehicle(); const d = v && !p.boarding && !p.unboarding ? v.pos.distanceTo(p.pos) : Infinity; return d <= (v?.boardDistance ?? 6) ? Math.max(0.2, d - (v.halfWidth ?? 0)) : Infinity; },
    use: () => player.interact() });
  return { rooms, inRoom };
}

/** The vehicle's prompt: "get in the cab", "ride the bird" (the world's mount by its name), a bike unpowered without the pack. */
export function boardPrompt(v, mountName, pack) {
  if (v?.kind === 'taxi') return 'get in the cab';
  return v?.powered && !pack ? `ride the ${mountName ?? v?.kind} (it needs power)` : `ride the ${mountName ?? v?.kind ?? 'mount'}`;
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
    setTimeout(() => toast(found.text, { kind: 'hint' }), 4200);
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
 * names, the first Blade Gate near (issue #483), the makers' house you are in and its step, the guardian's phase, then its line and the ping's flight (its first
 * word, "the village on the horizon", starts the desert's quest: 'drone:village', src/story/desert.js).
 *   const plumbStep = wireCompanion({ game, plumb, scout, level, player, npcs, struggle, sound, dialogue: () => storyRt.dialogue, teach })
 *   plumbStep(dt, { canSpeak, fight, calm }) → its line as the cue shows it ('' none); the host puts it up
 *     (calm: no talk, scene, menu, photo or ship scene: Plumb may drift out to what matters, issue #662, `quests()`)
 *   plumbStep.press()                    Plumb's button (D-pad →, Q): true when it opened Plumb's talk (else the host pings)
 * `plumb` null (a host without the help): only the escort.
 *
 * Something critical (src/companion.js CRITICAL, issue #543) is not put on the cue: Plumb comes out of its light at your
 * shoulder (an escort), hops and turns to you with its mark over it (src/scout.js hail) and calls (sound.drone('call'));
 * the first time, `teach()` (the host puts the button's line on the cue, once a save). Plumb's button then opens the talk
 * in the dialogue box (its pages, its portrait and name: `plumbNpc`), and when it ends Plumb flies toward the goal (the
 * ping) with its pointing word ("This way.", "Look.": the talk's bark, src/companion.js splitBark) on the cue, as its other
 * lines show (issue #559); a talk with nowhere to point (the Blade Gate's: you are at it, #563) ends there. Unanswered for
 * HAIL.secs, it lets it go; a scene or a fight puts it away, and it comes again after.
 */
export function wireCompanion({ game, plumb = null, scout = null, level, player, npcs = [], struggle = null, sound = null, dialogue = () => null, teach = null, quests = () => null }) {
  if (scout) game.on('drone:out', (e) => scout.escort(ESCORT.secs, e?.pos ?? null));
  const at = { goalT: 0, goal: null, lookT: 0, place: null, world: { fight: null, house: null }, names: null };
  // the talk (issue #543): raised at your shoulder (up), how long it has waited; the talk under way
  const hail = { up: false, shown: 0, talking: null, opening: null, bark: '' };
  const OPEN_FRAMES = 2;
  const lower = () => { if (hail.up) { hail.up = false; scout?.hail?.(false); } };
  const npc = scout?.talk ? plumbNpc(scout, player) : null;
  game.on?.('dialogue:end', (e) => {
    if (e?.id !== PLUMB_PERSON.id || !hail.talking) return;
    const said = hail.talking;
    hail.talking = null;
    plumb?.progress();
    if (!said.point) { scout?.home?.(); return; }   // (nowhere to point: the Blade Gate's warning, said at the gate; it goes home)
    hail.bark = said.bark ?? '';
    scout?.ping();   // (then off toward the goal, as the button does: its bark, then the find's line, the flare, the marker)
  });
  const attend = attendStep({ scout, player, plumb, quests, hail });
  const step = (dt, { canSpeak = true, fight = false, calm = canSpeak } = {}) => {
    if (!plumb) return '';
    open();
    attend(dt, { calm, fight });
    // the first person near (the opening's line): now and then
    if ((at.lookT -= dt) <= 0) {
      at.lookT = 0.5;
      const metAnyone = Object.keys(game.data?.flags ?? {}).some((k) => k.startsWith('met.'));
      if (!metAnyone) for (const n of npcs) {
        if (!n.def?.id || n.pooled || !n.object?.visible) continue;
        if (n.pos.distanceTo(player.pos) < 8) { plumb.note('person'); break; }
      }
      // the first Blade Gate near (a fight temple's door: its host stands beside it, src/story/hosts-data.js FIGHT_STAND)
      if (!game.flag?.('drone.said.bladegate')) for (const n of npcs) {
        if (!n.def?.id?.startsWith?.('host.fight-') || n.pooled || !n.object?.visible) continue;
        if (n.pos.distanceTo(player.pos) < 12) { plumb.note('bladegate'); break; }
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
    // Automatic observations may advance the opening quest, but only a player's request sends a hint ping.
    // something to tell you: at your shoulder with its mark, until the button, a scene, a fight, or HAIL.secs unanswered
    if (plumb.pending && scout?.hail) {
      if (!hail.up) {
        const free = !scout.out || scout.phase === 'escort';
        if (canSpeak && !fight && free && !player.ride && !hail.talking) {
          if (scout.phase === 'escort') scout.escortT = Math.max(scout.escortT ?? 0, HAIL.secs + 1);
          else scout.escort(HAIL.secs + 1);
          scout.hail(true); hail.up = true; hail.shown = 0;
          sound?.drone?.('call');
          teach?.();
        }
      } else if (fight || scout.phase !== 'escort') { lower(); if (fight) scout.home?.(); }   // (put away: raised again after)
      else if ((hail.shown += dt) > HAIL.secs) { lower(); plumb.drop(); }   // (not wanted: let go)
    } else lower();
    if (!r.say && hail.bark) { const b = hail.bark; hail.bark = ''; return droneShown(b); }   // (the talk's pointing word, as it flies off)
    return ''; // Automatic companion observations still advance state; advice is heard by pressing Plumb.
  };
  /** Plumb's button: Plumb's talk when it has something to tell you (and the dialogue box is free), else false. */
  // (it is put before your face at once, the talk opened OPEN_FRAMES frames later: an engine's portrait is drawn from
  // the drawn scene, which has the drone where it was until the frame is over; Unity's chip was empty)
  step.press = () => {
    if (hail.opening) return true;
    if (!plumb?.pending || !hail.up || !npc) return false;
    const d = dialogue?.();
    if (!d || d.open) return false;
    hail.opening = { said: plumb.take(), frames: OPEN_FRAMES };
    lower();
    scout.talk();
    return true;
  };
  const open = () => {
    const o = hail.opening;
    if (!o || --o.frames > 0) return;
    hail.opening = null;
    const d = dialogue?.();
    hail.talking = o.said;
    if (!d || d.open || !d.start(plumbTalk(o.said.pages), npc)) { hail.talking = null; if (o.said.point) scout.ping(); else scout.home?.(); }   // (no talk after all: the ping)
  };
  Object.defineProperty(step, 'hailing', { get: () => hail.up });
  return step;
}

/**
 * Plumb drifts out to what matters (issue #662, src/drone-attend.js; docs/systems/scout.md "It shows you"): while you
 * dawdle, calm and on foot, the person or thing the quests want (the tracked step first, then a quest's giver, then
 * another step) within ATTEND.range, on your floor and in sight gets the drone over it a while (Scout.attend); it comes
 * home when you run or ride, in a fight, when it is done, reached or shown long enough, and is gone at once in a talk
 * or a scene. Never with the drone's hints off, nor while Plumb has something to tell you or is on another errand.
 * `scout.autoAttend = false` turns it off (the sequences' runs, engine/sequences.js: their streams predate it).
 */
function attendStep({ scout, player, plumb, quests, hail }) {
  if (!scout?.attend) return () => {};
  const gate = new AttendGate(), picker = new AttendPicker();
  const head = new THREE.Vector3(), aim = new THREE.Vector3(), dir = new THREE.Vector3();
  let pickT = 0, now = 0, cands = [], candT = 0, was = false;
  const up = () => player.frame?.up ?? THREE.Object3D.DEFAULT_UP;
  const sees = (c) => {
    const u = up();
    head.copy(player.pos).addScaledVector(u, 1.6);
    aim.copy(c.position).addScaledVector(u, 1.2);
    dir.subVectors(aim, head);
    const len = dir.length();
    if (len < 1e-3) return true;
    const hit = scout.obstacle?.(head, dir.divideScalar(len), len);
    return !hit || hit.distance >= len - 1.2;   // (the person's own body, the item's stand: as good as seen)
  };
  const comeHome = (now_) => {
    if (scout.attending) scout.unattend(now_);
    if (picker.current) picker.reset(false);   // (sent home by you: it may show it again once you dawdle)
    if (was) { gate.rest(); was = false; }
  };
  return (dt, { calm, fight }) => {
    now += dt;
    const say = plumb?.say ?? 'on';
    if (scout.autoAttend === false || say === 'off') { comeHome(true); return; }
    const v = player.ride?.vel ?? player.vel;
    const speed = v ? Math.sqrt(v.x * v.x + v.z * v.z + (player.ride ? v.y * v.y : 0)) : 0;
    const mine = scout.phase === 'attend' || !!scout.attending;
    if (was && !mine && !(scout.phase === 'leave' && scout.fromAttend)) comeHome(false);   // (put away under it: boxed in, a teleport)
    const other = scout.out && !mine && !(scout.phase === 'leave' && scout.fromAttend);   // (a find, a hint, an escort, a talk)
    const busy = !!plumb?.pending || hail.up || !!hail.talking || !!hail.opening || other;
    const g = gate.update(dt, { speed, calm, fight, riding: !!player.ride, busy });
    if (!calm) { comeHome(true); return; }   // (a talk, a scene: gone at once, as the scout is in them)
    if (g === 'home' || (mine && busy)) { comeHome(false); return; }
    if ((pickT -= dt) > 0 && !mine) return;
    if (pickT <= 0) pickT = 0.2;
    if ((candT -= dt) <= 0) { candT = 0.5; try { cands = attendCandidates(quests?.()); } catch { cands = []; } }
    if (g !== 'out' && !mine) return;
    const t = picker.pick(cands, { feet: player.pos, up: up(), dt: mine ? dt : 0.2, now, sees, again: say === 'fewer' ? ATTEND.againFewer : ATTEND.again });
    if (!t) { if (mine) comeHome(false); return; }
    if (scout.attending?.id === t.id) { scout.attending.position.copy(t.position); return; }
    if (scout.attend({ id: t.id, label: t.label, position: t.position.clone() })) was = true;
    else picker.reset();
  };
}

/**
 * Plumb as the one you talk to (src/story/index.js: the two-shot, its portrait, the traveller turned to it): the drone
 * where it hovers (src/scout.js talk), its face the drone itself, `pos` the point under it at your feet' level (the shot
 * and the spacing take a person's feet), and its portrait close on it from your side. It has no body to move about.
 */
export function plumbNpc(scout, player) {
  const feet = new THREE.Vector3(), eye = new THREE.Vector3(), look = new THREE.Vector3(), d = new THREE.Vector3(), side = new THREE.Vector3();
  const upOf = () => player.frame?.up ?? THREE.Object3D.DEFAULT_UP;
  return {
    def: PLUMB_PERSON, object: scout.object, person: { size: PLUMB_PERSON.scale }, talkGap: TALK.out,
    get pos() { const o = scout.object.position, up = upOf(); return feet.copy(o).addScaledVector(up, d.subVectors(player.pos, o).dot(up)); },
    faceAt: (out) => out.copy(scout.object.position),
    portraitShot: () => {
      const up = upOf();
      look.copy(scout.object.position);
      d.subVectors(player.pos, look); d.addScaledVector(up, -d.dot(up));
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
      d.normalize();
      side.crossVectors(up, d);
      eye.copy(look).addScaledVector(d, 0.85).addScaledVector(side, 0.18).addScaledVector(up, 0.1);
      return { look, eye };
    },
    express: (f) => scout.express?.(f),
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
    // An authored flight chamber can keep the Traveller close without changing outdoor glides.
    const glideShot = player.gliding && !player.riding
      ? player.houses?.find((h) => h.def?.glideCamera && h.inside?.(player.pos))?.def.glideCamera ?? null : null;
    const wide = player.riding ? null : player.gliding ? (glideShot?.arm != null ? glideShot.arm - OPEN_DIST : WIDE.glide) : jets || player.jetHold ? WIDE.jets + Math.min(jetSpeed, 30) * WIDE.jetsPerMs : player.climbing ? WIDE.climb : player.swim ? WIDE.swim : 0;
    const shot = jets ? (jetShot.pitch = jetCameraPitch(player.jetFlight.pitch), jetShot) : glideShot;
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

// ------------------------------------------------------------------ the hover trails
/** The jets' rear caps on a hover vehicle (unless the vehicle says: its `jets`). */
const JETS = [new THREE.Vector3(0.66, -0.08, -1.18), new THREE.Vector3(-0.66, -0.08, -1.18)];
/**
 * Two trails, one per hover jet, behind whichever hover vehicle you ride (the world's mount, or the bike by the ship
 * where the bird is the mount, as in Viridel: issue #376; src/bike-worlds.js trailVehicle), never under the ground or
 * the skiff's water, in the fluid's tones (the tool's powerTrails). Once the tool is made, after wireVehicles.
 * → null (no hover vehicle here), or { trails, update(dt) } for each frame.
 */
export function wireTrails({ scene, player, physics, tool = null }) {
  let by = trailVehicles(player)[0] ?? null;
  if (!by) return null;
  const ground = (x, y, z) => (by?.groundAt ? by.groundAt(x, y, z) : physics.groundAt(x, y, z));
  const trails = [new Trail(scene, { offset: 0, physics, ground }), new Trail(scene, { offset: 2.5, physics, ground })];
  tool?.powerTrails?.(trails);
  return {
    trails,
    update(dt) {
      const m = trailVehicle(player, by), moving = Math.hypot(m.vel.x, m.vel.z) > 3, jets = m.jets ?? JETS;
      if (m !== by) { for (const tr of trails) tr.samples.length = 0; by = m; }   // (another vehicle's: not joined to the last one's)
      m.body.updateMatrixWorld(true);
      trails.forEach((tr, i) => tr.update(dt, moving ? m.body.localToWorld(jets[i].clone()) : null));
    },
  };
}

// ------------------------------------------------------------------ the world's edges and its walls' openings
/**
 * Where the old walls' cracks may not run: their windows, doors and what is fixed on them (src/wall-openings.js; the
 * builders added their merged pieces as they laid them, the world's small meshes here), the table to the shaders'
 * uOpenings. Once the world is built. → how many pieces.
 */
export function wireOpenings({ scene }) {
  wallOpenings.collectScene(scene).flush(sharedUniforms);
  return wallOpenings.boxes;
}
/**
 * Leaning into the world's edge (src/edge.js): the wind that holds you back streams in round you (the wind's edgeGust)
 * and the ink shimmers where you touch it (EdgeInk, drawn with the wind's wisps: in `parent`, the wind's own scene on the
 * page, the mirrored one in the engines). → update(dt, camera, pxScale) for each frame, before the wind's own.
 */
export function wireEdge({ wind, player, parent }) {
  if (!wind) return null;
  const ink = new EdgeInk(wind.mesh.material);
  parent.add(ink.mesh);
  return {
    ink,
    update(dt, camera, pxScale) {
      if (player.edge?.k > 0.03 && !player.ride) wind.edgeGust(dt, player.edge.at, player.edge.n, player.edge.k);
      ink.update(dt, player.ride ? null : player.edge, player.frame.up, camera, pxScale);
    },
  };
}

// ------------------------------------------------------------------ the look: the preset, the planets, a level's zones
/** A style preset into the ink pass's uniforms (src/post.js PRESETS), with the world's own touches on its default one. */
export function presetInto(U, name, level) {
  for (const [k, v] of Object.entries(PRESETS[name] ?? {})) if (U[k]) U[k].value = v;
  if (name === (level.defaults?.preset ?? 'Moebius print')) for (const [k, v] of Object.entries(level.defaults?.look ?? {})) if (U[k]) U[k].value = v;
}
/** Up to three planets hanging in the sky (a level's, or a zone's: the Lab's biome rooms) into the ink pass's uniforms. */
export function planetsInto(U, list = []) {
  for (let i = 0; i < 3; i++) {
    const p = list[i];
    if (!p) { U.uPlanet?.value[i].set(0, -1, 0, 0); continue; }
    const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az);
    U.uPlanet?.value[i].set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), THREE.MathUtils.degToRad(p.size));
    const c = new THREE.Color(p.color);
    U.uPlanetColor?.value[i].set(c.r, c.g, c.b, p.ring ?? 0);
    U.uPlanetCraters?.value.setComponent(i, p.craters === false ? 0 : 1);
  }
}
/**
 * The world's look: its style preset and its planets, and, in a level with zones (the Hangar's styles, the Lab's biome
 * rooms, the References' panels), the zone you are in: its preset, its own look over it (never carried into the next
 * zone), its planets and its hour. `onPreset(name)`: after a preset or a zone's look is put on (the page's GUI, its
 * params). → { at: { preset, planets, zone }, setPreset(name), setPlanets(list), zones(pos, sky) each frame }.
 */
export function wireSky({ level, U, onPreset = () => {} }) {
  const at = { preset: level.defaults?.preset ?? 'Moebius print', planets: level.sky?.planets ?? [], zone: null };
  const setPreset = (name) => { at.preset = name; presetInto(U, name, level); onPreset(name); };
  const setPlanets = (list = []) => { at.planets = list; planetsInto(U, list); };
  if (at.planets.length) setPlanets(at.planets);
  return {
    at, setPreset, setPlanets,
    zones(pos, sky) {
      if (!level.zoneAt) return;
      const zone = level.zoneAt(pos), last = at.zone;
      if (zone.preset !== at.preset) setPreset(zone.preset);
      if (zone === last) return;
      if (zone.look) { if (last?.look) setPreset(at.preset); for (const [k, v] of Object.entries(zone.look)) if (U[k]) U[k].value = v; onPreset(at.preset); }
      else if (last?.look) setPreset(at.preset);
      if (zone.planets || last?.planets) setPlanets(zone.planets ?? level.sky?.planets ?? []);
      if (zone.hour !== undefined && last) sky.hour = zone.hour;
      at.zone = zone;
    },
  };
}

// ------------------------------------------------------------------ the potion's glow and lesson, the world's nudges
const _potP = new THREE.Vector3(), _potV = new THREE.Vector3();
/**
 * The potion (src/player.js drinkPotion): `glow(player, tool, got)` as the hearts come back, a warm glow rising round
 * him (the tool's glow particles); `hint(player)` once per save, the first time a hurt leaves him short: how to drink
 * (a new verb with nothing on the screen to find it by: taught, hints subtle or full).
 */
export function wirePotion({ game, toast }) {
  return {
    glow(player, tool, got) {
      if (!(got > 0) || !player.object?.visible) return;
      const U = player.frame.up;
      for (let i = 0; i < 26; i++) tool?.glow?.add({ pos: _potP.copy(player.pos).addScaledVector(U, 0.3 + Math.random() * 1.2).add(_potV.randomDirection().multiplyScalar(0.45)), vel: _potV.copy(U).multiplyScalar(0.8 + Math.random() * 1.4), drag: 1.5, size: 0.05 + Math.random() * 0.04, life: 0.7 + Math.random() * 0.5, color: i % 3 ? '#e8643c' : '#f6c84e', grow: true });
    },
    hint(player) {
      if (game.flag('hint.potion') || player.hearts > player.maxHearts - 1 || player.dead || !hintsFor('teach')) return;
      game.set('hint.potion', true);
      setTimeout(() => toast(tr('potion.hint'), { kind: 'hint' }), 900);
    },
  };
}
/**
 * A world that wants to show you the way at once (the City-Shaft's jets, just found: up through the ceiling) says so
 * with game.emit('scout:ping'): the scout pings, never over a scene or a conversation; a nudge (`why`) only at hints
 * that nudge and not over another notice (issue #78); one that `wait`s (the way on from a place reached, issue #349)
 * comes once the notices and the talk are done, within 30 s. `quiet()`: a scene playing or a conversation open;
 * `noticeBusy()`: a notice up or waiting. → frame(busy) each frame (null without a scout).
 */
export function wireNudges({ game, scout, quiet, noticeBusy }) {
  if (!scout) return null;
  const later = { until: 0 };
  game.on('scout:ping', (e) => { if (e?.wait && hintsFor('nudge')) later.until = performance.now() + 30000; });   // (kept until it is shown)
  game.on('scout:ping', (e) => { if (e?.why && (!hintsFor('nudge') || noticeBusy())) return; if (!quiet()) { scout.ping(); later.until = 0; } });
  return {
    later,
    frame(busy) {
      if (!later.until) return;
      if (performance.now() > later.until) { later.until = 0; return; }
      if (!quiet() && !noticeBusy() && !busy) { later.until = 0; scout.ping(); }
    },
  };
}

// ------------------------------------------------------------------ the fragments' line
/**
 * In the Start menu, under where you are: the fragments of the singing light found, and how many you hold to spend with
 * Anselm once he is met (src/fragment-shop.js), once one is found; '' before. Never how many there are, nor how many are
 * left here (issue #519: "I shouldn't be able to tell how many fragments of light there are in total").
 */
export function fragmentsLine({ fragments, game, items }) {
  const c = fragments?.counts?.();
  if (!c?.found) return '';
  const held = game.flag('frag.met') ? fragmentPurse(game.data.flags, (id) => items.has(id)).held : null;
  return `✧ ${c.found} fragment${c.found === 1 ? '' : 's'} found${held != null ? ` · ${held} to spend` : ''}`;
}

// ------------------------------------------------------------------ the fight (issue #435)
// The hearts on the screen, how a hurt is answered, the foes with their drops, the lock-on and its camera, the perfect
// dodge's flurry, the knock-out's card and the ambushes on a flight to a new world: main.js wired them and engine/combat.js
// again, apart (the engines' hazards bit twice a frame, their hurts had no thud, their wallet no count). Each host keeps
// how it draws them: the page its DOM (#health, #restart, the flurry's vignette), the engines the screen's parts.

/**
 * The hearts, the magic bar, the potions and the wallet (src/hud.js healthHud): shown while hurt, spending, fighting
 * (src/foes.js fighting) and a moment after; the wallet's count ticking up to the real one (walletTick). Made before
 * the traveller: a hurt, a drink, a chime picked up show it (`show()`).
 *   health.show()                                    a hurt, a knockdown, a potion, a chime: shown at once
 *   health.frame(dt, { player, fighting, quiet })    → { hp, wallet } each frame: the state drawn (null: hidden), the count shown
 */
export function wireHealth({ game, tool = null }) {
  let shown = 0, walletShown = resources.chimes;
  const fade = new Fader(3);
  game.on?.('wallet', () => { shown = 3; });
  return {
    show() { shown = 3; },
    frame(dt, { player, fighting = false, quiet = false }) {
      player.setMaxHearts?.(resources.maxHearts);
      const T = typeof tool === 'function' ? tool() : tool;
      const R = T?.owned && !T.dry ? T.reserve : null, pot = resources.potions, wallet = resources.chimes, ticking = walletShown !== wallet;
      walletShown = walletTick(walletShown, wallet, dt);
      const hp = healthHud({ health: player.health ?? 1, hearts: player.hearts ?? null, max: player.maxHearts ?? 3, magic: R ? R.level : null, magicMax: R?.max ?? 3,
        potions: pot.count, infinite: pot.infinite, chimes: Math.round(walletShown), wallet: ticking, combat: !!fighting, down: player.down, hurt: shown > 0,
        quiet: quiet || sceneHolds(screen.state) }, fade, dt);   // (a scene's letterbox: every scene's, a box's too: issue #501)
      shown = 0;
      return { hp, wallet: walletShown };
    },
  };
}

/**
 * How the traveller's hurts are answered (the Player's onHurt, onDrink, onKnockdown, onRestart): a thud under the hit
 * (src/ship/sfx.js rumble, heavier by the hearts it cost), its cry, the pad's rumble (a fall rumbles as its landing),
 * the screen's jolt for a foe's blow, the hearts shown, the potion's lesson; the drink's sound, glow and rumble; a
 * knockdown's heavier thud; up again after a knock-out, a quick fade. Spread into the Player's options. `player()`,
 * `sound()`, `tool()`: read when they happen (the engines make the sound after the traveller); `fade(k, secs)`: the
 * host's screen fade (null: none).
 */
export function hurtReactions({ player, sound, potion = null, tool = () => null, health = null, fade = null }) {
  return {
    onHurt: (h, why) => {
      const s = sound(), k = Math.min(1, h / 1.5);
      shipSfx.rumble(s, 0.35 + k * 0.4, 0.25 + k * 0.5); s?.hurt?.(h, why); health?.show();
      if (why === 'foe') kick(0.45 + k * 0.5);
      potion?.hint(player());
      if (why !== 'fall') rumblePlay('hurt', { h });   // (a fall rumbles as its landing: onKnockdown)
    },
    onDrink: (got) => { sound()?.potion?.('heal'); health?.show(); potion?.glow(player(), tool(), got); rumblePlay('potion'); },
    onKnockdown: (dead, why) => {
      shipSfx.rumble(sound(), dead ? 0.95 : 0.6, dead ? 0.9 : 0.45); health?.show();
      rumblePlay(why === 'fall' && !dead ? 'land' : 'knockdown', { dead, speed: player()?.lastLanding });
    },
    onRestart: () => { if (!fade) return; fade(1, 0.05); setTimeout(() => fade(0, 0.9), 120); },
  };
}

/**
 * The fight: the ink blots in the wilds and the makers' machines in the temples (src/foes.js Foes, the Enemies setting);
 * the chimes and potions they drop (src/chimes.js, potion-drops.js); the lock-on (R3 / Tab) with its lesson, a flick to
 * the next foe, and its camera (lockFollow; a guardian framed whole with you, lock-frame.js; the boss framing its fight
 * asks for; aiming locked on, lock-aim.js); the hops' perfect dodge and its flurry (src/flurry.js); the potion (D-pad ←);
 * the low-health cue (src/low-health.js) and the knock-out's card. `lowParent`: where the low-health edges are drawn
 * (left out: the page's body; null in the engines, which draw `low()`'s k).
 *   fight.update(dt, quiet)                        the foes, the flurry's end, the drops (quiet: a menu, a photo, a scene)
 *   fight.frame(realDt, { busy, still })           the lock's camera, after the rig (still: a photo held)
 *   fight.lock() → bool                            R3 / Tab (false: nothing in reach: the host turns the camera behind you)
 *   fight.drink() → bool                           D-pad ←: a potion drunk, or a word why not
 *   fight.low(dt, paused) → k                      the low-health cue (0..1: the edges)
 *   fight.knockout(why); fight.card(dt, paused)    knocked out: after 1.4 s the card (null, or { open, text } on a change)
 *   fight.restart() → bool                         the card's confirm: up again at the last safe place
 *   fight.padLook = () => stick                    the right stick's tilt (aiming locked on, it shifts the aim)
 */
export function wireFight({ scene, level, levelId, content, physics, player, tool = null, sound = null, npcs, settings, camera, rig, lib, humans, waters, game, toast = () => {}, teach = toast, health = null, lowParent = undefined }) {
  const foes = new Foes({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, lib, humans, waters, notice: teach });   // (its notices teach: paced as hints)
  // chimes, the currency: a foe cut down scatters a few (by its weight), a guardian a purse once; walked over or drawn
  // in, they ring into the wallet (src/resources.js); none from a game's own foes (Ink tide)
  const chimePolicy = dropPolicy(level);
  const groundAt = (x, y, z) => physics.groundAt(x, y + 2, z, 8);
  const chimes = new ChimeField({ groundAt, onTake: (p) => { resources.addChimes(p.value, { source: 'pickup', training: p.training }); sound?.chimePickup?.(p.value); rumblePlay('chime'); health?.show(); } });
  const chimeView = new ChimeView(scene);
  /** A guardian's purse: scattered on the floor between it and you, short of its body (a floating guardian's is out of reach). */
  const purseAt = (pos, body = null) => purseSpot(player.pos, pos, body);
  const offs = [connectDrops(game, chimes, { policy: chimePolicy, purseAt, sound })];
  // potions a foe leaves now and then: walked over, into the pack
  const potionDrops = new PotionDrops(scene, { groundAt, onTake: () => { if (resources.addPotions(1)) { sound?.potionPickup?.(); health?.show(); toast(tr('potion.found')); rumblePlay('chime'); } } });
  if (chimePolicy !== 'off') offs.push(game.on('foe:burst', (e) => { const pot = resources.potions; potionDrops.maybe(e, { hearts: player.hearts, max: player.maxHearts, potions: pot.count, cap: POTION.cap, infinite: pot.infinite }); }));
  // at one heart or less: a short heartbeat and the screen's edges darkening with it
  const lowHealth = new LowHealthCue(lowParent === undefined ? { sound } : { sound, parent: lowParent });
  if (tool) tool.lockOn = () => foes.lockTarget();   // (the blade and its guard turn to the locked foe)
  // Locked on, the back flip and the side hop (src/jump.js HOP): their dodge frames (FluidBlade.hop), and begun just
  // before a blow lands, a perfect dodge: the flurry, the world slowed round you a few seconds
  let flurryAgainAt = 0, flurryChain = null;
  function startFlurry() {
    const now = performance.now() / 1000;
    if (flurryLeft() > 0 || now < flurryAgainAt) return;
    const F = flurryChain = nextFlurry(flurryChain, now);   // (back to back, each shorter and the wait after it longer: CHAIN)
    flurry(F.time, FLURRY.rate, FLURRY.ease);
    flurryAgainAt = F.nextAt;
    sound?.flurry?.(true); kick(0.1); rumblePlay('flurry');
    if (!game.flag('hint.flurry') && hintsFor('tip')) { game.set('hint.flurry', true); teach(tr('hint.flurry')); }   // (said after the fact, hints full)
  }
  player.onHop = (kind, win) => { tool?.blade?.hop(win, kind); if (foes.perfectDodge(kind)) startFlurry(); };   // (a blow's `dodge` asks for its hop: src/flurry.js hopFits)
  if (tool?.blade) tool.blade.onHopDodge = () => startFlurry();
  player.untouchable = () => flurryLeft() > 0;   // (a guardian's blows and rings pass you by: src/temples/boss.js)
  const lockView = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 };   // (the lock camera's swing off the line: lockViewAngle)
  const lockBox = { min: new THREE.Vector3(), max: new THREE.Vector3() };
  const aimNudge = new AimNudge();
  const _hopView = new THREE.Vector3();
  let padLook = () => null, off = false;
  // aiming locked on (LT / L2): the aim on the lock's point, the right stick shifting it a little (issue #362)
  const aimingLocked = () => !!(foes.lock && !off && tool && tool.camK > 0.2 && tool.k > 0.2);
  // locked on, the look's sideways motion is the lock's: a quick flick switches to the next foe that way (FLICK);
  // aiming locked on, it shifts the aim off the lock's point instead, within its cone (the stick by its tilt, read each
  // frame; a pointer by its moves)
  const look = rig.look.bind(rig);
  rig.look = (dx, dy) => {
    if (aimingLocked()) { const s = padLook(); if (!(s?.x || s?.y)) aimNudge.push(dx, dy, rig.sensitivity); return; }
    if (foes.lock && !off && foes.flickLook(dx)) dx = 0;
    look(dx, dy);
  };
  let deadFor = 0, knockedOut = null, cardOpen = false;
  const F = {
    foes, chimes, potionDrops, lowHealth, lockView, startFlurry,
    set padLook(fn) { padLook = fn; },
    get cardOpen() { return cardOpen; },
    lock() {
      const had = foes.lock;
      const got = foes.cycleLock();
      if (foes.lock && !had && hintsFor('teach')) {
        // (locked on, a new verb, taught once: the hops, then, the hook owned, the hook at the lock: src/hook-foes.js)
        const lesson = lockLesson({ taught: (k) => !!game.flag(`${k}.taught`), hook: items.has('hook') });
        if (lesson) { game.set(`${lesson}.taught`, true); teach(keyText(tr(lesson), { teach: true })); }
      }
      return !!got || !!had;
    },
    /** R3 with no foe in reach turned the camera behind him (the host's rig.recentre): the first time, said once (#563). */
    recentred() {
      if (game.flag('hint.recentre.taught') || !hintsFor('teach')) return;
      game.set('hint.recentre.taught', true);
      teach(keyText(tr('hint.recentre'), { teach: true }));
    },
    drink() {
      const why = player.cantDrink?.();
      if (why === 'full') { sound?.potion?.('no'); toast(tr('potion.full')); health?.show(); return false; }
      if (why) return false;
      if (!resources.takePotion()) { sound?.potion?.('no'); toast(tr('potion.none')); return false; }
      player.drinkPotion();
      sound?.potion?.('open'); health?.show();
      return true;
    },
    low: (dt, paused) => lowHealth.update(dt, { hearts: player.hearts, max: player.maxHearts, dead: player.dead, paused }).k,
    knockout(why) { knockedOut = why; },
    card(dt, paused) {
      deadFor = player.dead ? deadFor + dt : 0;
      const want = player.dead && deadFor > 1.4 && !paused;
      if (want === cardOpen) return null;
      cardOpen = want;
      return { open: want, text: want ? tr(knockedOut === 'fall' ? 'restart.fall' : 'restart.out') : null };
    },
    restart() {
      if (!player.dead) return false;
      cardOpen = false; deadFor = 0; knockedOut = null;
      player.restart();
      rig.target?.copy?.(player.pos);
      return true;
    },
    near: (r = 20) => foes.near(r),
    update(dt, quiet = false) {
      foes.update(dt, quiet);
      if (flurryLeft() > 0 && !foes.anyFighting()) endFlurry();   // (nothing left to cut: the world comes back to speed)
      if (!quiet) { chimes.update(dt, player.dead ? null : player.pos); potionDrops.update(dt, player.dead ? null : player.pos); }
      chimeView.update(chimes, camera);
    },
    frame(realDt, { busy = false, still = false } = {}) {
      off = busy || still;
      // locked on: the traveller faces the foe, strafing round it (player.lockOn: src/player.js LOCK_MOVE); a guardian
      // through its steady stand-in (GuardianLock.steady, issue #321: its lunges no longer swing the line or the camera)
      player.lockOn = foes.lock && !busy ? Object.assign(player._lockOn ??= { dir: new THREE.Vector3() }, {}) : null;
      const L = foes.lock?.steady ? foes.lock.steady(off ? 0 : realDt) : foes.lock;
      if (player.lockOn) {
        player.lockOn.dir.set(L.pos.x - player.pos.x, 0, L.pos.z - player.pos.z).normalize();
        (player.lockOn.at ??= new THREE.Vector3()).copy(L.pos);   // (what a sidestep circles: Player.orbitLock)
        // (a hop read against the camera's look with the foe at his feet: src/jump.js hopAxis)
        camera.getWorldDirection(_hopView);
        const a = hopAxis(player.lockOn.dir, _hopView.setY(0).normalize(), Math.hypot(L.pos.x - player.pos.x, L.pos.z - player.pos.z), LOCK_NEAR);
        (player.lockOn.hop ??= new THREE.Vector3()).set(a.x, 0, a.z);
      }
      if (!foes.lock) { lockView.foe = null; lockView.angle = 0; }
      if (!foes.lock || off) lockView.vel = 0;
      rig.locked = !!(foes.lock && !off);
      rig.lockAt = rig.locked ? (L.chest ?? L.pos) : null;
      // (a guardian: its box round its steady stand-in, so the camera frames you both whole: CameraRig.fitFrame, #359)
      rig.frameWith = rig.locked && foes.lock.guardian && foes.lock.model?.group ? guardianBox(foes.lock.model, L.pos, lockBox, performance.now() / 1000) : null;
      rig.boss = off ? null : foes.bossFight()?.def.camera ?? null;   // (a guardian's arena, awake: further back and higher)
      if (!rig.locked) rig.lockRoom?.(realDt, null);
      if (foes.lock && !off) {
        const f = foes.lock, P = player.frame;
        // (aiming the gun locked on: the crosshair on the lock's own point, the camera turned from where it stands;
        // not aiming: the line to the foe, its stand-off swing, the room behind him: src/foes.js lockFollow)
        const aim = aimingLocked() ? lockAim(camera.position, f.aim ?? f.chest, P) : null;
        if (!aim) lockFollow(lockView, rig, L, player.pos, P, realDt);
        else {
          rig.lockRoom?.(realDt, null); lockView.vel = 0;
          aimNudge.update(realDt, padLook());
          lockAimStep(rig, aim, aimNudge, THREE.MathUtils.smoothstep(tool.camK, AIM_NUDGE.ramp[0], AIM_NUDGE.ramp[1]));
        }
      }
      if (!aimingLocked() && (aimNudge.x || aimNudge.y || aimNudge.mx || aimNudge.my)) aimNudge.reset();   // (each locked aim starts on the point)
      if (tool) tool.nudged = aimingLocked() && aimNudge.nudged;
    },
    dispose() { for (const o of offs) o?.(); foes.dispose?.(); chimeView.dispose?.(); },
  };
  return F;
}

/**
 * The chime-pirates on the first flight to a world never visited (src/ambush.js): `departure(to)` → the fight's page
 * ('?game=pirates&to=…&from=…') or null (straight there). On that page, `transit(to)` → what its runner takes (null on
 * a game's own page): the ways out (none but through it), the trip marked at once (a crash never sends you round it
 * again), `left()` as it goes, the chimes shot down into the wallet once won (`onResult`).
 */
export function wireAmbush({ game, levelId, seen = () => false, settings = null, titles = {} }) {
  return {
    departure: (to) => (ambushDue({ to, flag: (k) => game.flag(k), seen, settings }) ? ambushHref(to, levelId) : null),
    transit(to) {
      const links = to ? transitLinks({ get: (k) => (k === 'to' ? to : null) }, titles) : null;
      if (!links) return null;
      if (!game.flag(ambushKey(to))) game.set(ambushKey(to), 'met');
      return {
        links,
        left() { if (game.flag(ambushKey(to)) === 'met') game.set(ambushKey(to), 'skipped'); },
        onResult(r) {
          if (r.failed) return;
          if (r.chimes && game.flag(ambushKey(to)) !== 'won') resources.addChimes(r.chimes, { source: 'pirates' });   // (once: a Retry after the win flies it for the score)
          game.set(ambushKey(to), 'won');
        },
      };
    },
  };
}

// ------------------------------------------------------------------ round 4 (issue #427): the tool's notices, the jump's shade
// main.js placed the fluid tool's notices beside the traveller with its DOM (placeToolGauge) and made the jump's shade
// itself; the engines drew neither: no crosshair, no mode's name, no "empty", no patch of shade under a jump.

const _tgR = new THREE.Vector3(), _tgP = new THREE.Vector3();
/**
 * The fluid tool's HUD (src/ui.js ToolHud's state) to the screen's 'tool' each frame: while aiming as it is (the crosshair at
 * the screen's centre), else with `at`, its place by the traveller (left of his shoulders, as the camera sees them: a
 * switch's mode name, the tank's "empty"). `tool()`: the FluidTool (or null); `camera`: the view the place is taken from.
 *   gauge.frame() → the place (a Vector3 the page projects for its #tool) or null
 */
export function toolGauge({ tool, player, camera }) {
  return {
    frame() {
      const T = typeof tool === 'function' ? tool() : tool, st = T?.hud?.state ?? null, P = typeof player === 'function' ? player() : player;
      if (!st || !P) { screen.set('tool', null); return null; }
      if (st.aim) { screen.set('tool', st); return null; }
      _tgR.setFromMatrixColumn(camera.matrixWorld, 0);
      _tgP.copy(P.object?.position ?? P.pos).addScaledVector(P.frame?.up ?? THREE.Object3D.DEFAULT_UP, 1.45).addScaledVector(_tgR, -0.75);
      screen.set('tool', { ...st, at: _tgP.toArray().map((v) => +v.toFixed(2)) });
      return _tgP;
    },
  };
}

/**
 * The patch of shade under the traveller off the ground (src/jump-shadow.js): jumping, falling, gliding, the jets; made
 * with the world (kept out of the shadow casters: level.noShadow), each frame after he has moved.
 *   shade.update(player, physics)
 */
export function wireJumpShade({ scene, level }) {
  const shade = new JumpShadow(scene);
  (level.noShadow ??= []).push(shade.mesh);
  return shade;
}
