import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, allInteractables, PRIORITY } from '../interact.js';
import { Banner } from '../life.js';
import { STORY } from '../desert-sites.js';
import { COOL_FIRE, SMOKE_COOL, Embers } from './flames.js';
import { setMagic } from './magic-water.js';
import { QUESTS, PEOPLE, THINGS, LINES, ITEMS, CROWD_TALK, STAGE_MIGRATION, STAGE_MERGE, DESERT_QUEST_V, SPARK_STAGES, VILLAGERS, MURMURS, VILLAGER_TALK, CALLS, REPAY, REPAY_CALL } from './desert-data.js';
import { setupDesertMoments } from './desert-moments.js';
import { verbKey, inputKind } from '../prompt-keys.js';
import { items } from '../items.js';
import { setupHoverbike } from './desert-bike.js';
import { setupDrum, setupMask } from './desert-errands.js';
import { setupHearth } from './desert-spark.js';
import { setupWay } from './desert-way.js';
import { bystanderSpot } from '../ship/landing.js';
import { setupRepay } from './desert-repay.js';

// The desert's story, alive: who stands where, what reacts to you, and the
// chain of the main quest (desert-data.js has the words).
//
//   the camps    Ama by the main fire; Sefa (oud), Bako (ney) and Teo on the
//                benches; Ilo running between the tents; Marrow by his crates
//   the circuit  the Speaker walks ahead of the procession (crowd.js column)
//   the city     Hessa keeps the dry well at the great tree's roots; beside
//                it, a few metres up the trunk, the makers' ledge with their
//                chest on it (src/boxes/: the backpack), Nour the eldest on her
//                bench below it, and a few people of Qanat about the terraces
//                and the avenue
//   the dunes    old Oum sits on a stone where she fell behind
//   the cave     the dry pool, the fallen rib across the channel, the mural (the keepers'
//                pole leaning on it), the carved post beside the channel
//   far away     the Givers' Hearth and its spark-stone (src/story/desert-spark.js)
//
// The tree is cold (src/desert-city.js city.setLit: no flame, no smoke column,
// no sparks, no burn, a lone bell for music) until the spark-stone is set in
// its full well; then the fire grows up out of the crown in the cool colours
// of the drinking, the smoke column climbs from it, and the feast begins
// (the procession sings, the bands play double time).
//
// The backpack comes out of its chest empty (game flag tool.empty, src/fluid-tool.js):
// no shot, no push, no boost. The rib is heaved off the channel with the old
// keepers' pole over the carved post (three heaves); the pool rises and the first
// wade fills the tank (and adds the giant's colour) and Ama's jar. The water climbs
// the roots into the well while you watch (desert.well.watched).
//
// The reaction at the tree: the first time you come near the closed chest, the
// people on the terrace turn and murmur and the tree flares; when it opens
// (box:opened), Qanat gathers at the tree's foot under the ledge, the tree
// flares high, everyone in the avenue looks up, and Nour gets up off her bench
// and waits for you to climb down, comes over and calls you ("Psst. Child."),
// a little sound and a turn of her head every few seconds, until you talk to her
// (the 'elder' stage: she never starts talking by herself). Until the
// chest is open, the camps, the gate and the procession wave you on toward
// the city.
//
// The cave is dry until the rib is off the channel: no pool, no stream,
// only damp stains. Then the stream runs out of the crack and down the gutter,
// and the pool fills the basin from its lowest point (desert-city.js setWater).
//
// Flags (game-state.js): desert.city.entered, desert.shrine.gathered (the
// reaction played; named for the shrine the chest once stood in), desert.elder.heard (Nour sent you on), desert.quest.v
// (the stage migrations), desert.camps.seen, desert.jar.given,
// desert.speaker.heard, desert.well.seen, desert.cave.seen, desert.pole.tried
// (the rib wouldn't move for your arms), desert.lever (heaves on the pole so far),
// desert.channel.open (the rib is clear: the water rises and the tree drinks),
// desert.jar.filled, desert.well.watched (you saw the well fill), desert.spark.heard
// (Nour told of the spark-stone), desert.hearth.seen / .open, desert.stone.taken
// (src/story/desert-spark.js), desert.tree.lit (the stone is in the well: it burns),
// desert.ship.fed, desert.pool.tinted (the first wade filled the tank and added a
// colour), desert.teo.drumming, desert.ilo.following, desert.ilo.atSkull,
// desert.oum.following, desert.oum.home, desert.drum.freed and desert.mask.eyes
// (src/story/desert-errands.js), and a few "read" flags for the carvings.
// tool.empty: the tank has never been filled. Items: jar, water, drum, cord, pole, stone.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = V(0, 0, 0), _w = V(0, 0, 0);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const EARLY = ['city', 'box'];   // the main quest's stages before the chest is open
const CATCH_UP = ['elder', 'ask', 'down'];   // the stages that lead to the channel (setupDesert caughtUp)

/** Where the traveller looks when he looks into the well: down the shaft, under the rim (the rim stands 1.15 m). */
export function wellInside(city) { return city.well.clone().add(V(0, 0.45, 0)); }

/**
 * Old saves. v < 2: the stages before the cave moved (the box is in the city
 * now, then Nour): an old stage goes where STAGE_MIGRATION says; the steps
 * already done advance at once on their flags. v < 3: the tree used to burn
 * from the start, and the water alone made it drink. A save whose water already
 * rose (the channel open, the ship fed, the desert done) saw it burn and turn
 * cool: it keeps burning there (desert.tree.lit), and the spark-stone's errand
 * is skipped (SPARK_STAGES: setupDesert jumps over them to the ship). A save
 * short of that finds the tree cold and does the new errand; its tank is full
 * already (it was never empty: tool.empty is only set for a chest opened now).
 * v < 4: the four talks in a row (elder, well, ama, speaker) are two now: a save at the
 * well, Ama or the Speaker goes to the merged stage (STAGE_MERGE), keeping what it did
 * (it needs only Ama's jar now: askedDone).
 * Returns the new stage, or null if the stage did not change.
 */
export function migrateDesertQuest(game) {
  const v = game.flag('desert.quest.v') ?? 0;
  if (v >= DESERT_QUEST_V) return null;
  const s = game.flag('quest.desert.power');
  // (a brand-new save has nothing to carry over)
  if (s === undefined && !game.flag('ship.powered')) { game.set('desert.quest.v', DESERT_QUEST_V); return null; }
  let to = null;
  if (v < 2) { to = STAGE_MIGRATION[s] ?? null; if (to) game.set('quest.desert.power', to); }
  if (v < 3 && (game.flag('desert.channel.open') || game.flag('desert.ship.fed') || game.flag('ship.powered') || s === 'done')) game.set('desert.tree.lit', true);
  const now = game.flag('quest.desert.power');
  if (STAGE_MERGE[now]) { to = STAGE_MERGE[now]; game.set('quest.desert.power', to); }
  game.set('desert.quest.v', DESERT_QUEST_V);
  return to;
}

/**
 * Ama still has her jar for you: until she has given it (and while the tree is cold), she calls you over to
 * her fire instead of waving you on to the city ("calling you over", below: twice at most, CALLS.ama).
 * Her talk gives it on the way in (jarEarly), after Nour (power), or late (lateJar).
 */
export function amaCallsYou(game) {
  return !game.flag('desert.jar.given') && !game.flag('desert.tree.lit');
}

/** What Ama shouts as you come up to the camps before the chest is open: the jar if she has it for you. */
export function amaCampShout(game) {
  return amaCallsYou(game) ? CALLS.ama[0] : '~shout~ To the city, sky-stranger! Up to the tree!';
}

/**
 * The stage after Nour ('ask') is done once Ama has given you her jar. Nour says the Speaker's verse herself
 * now (her `quest` node), so walking with the Speaker is for whoever wants the old words whole (October 2026:
 * the desert's first hour shorter, three talks in a row became two).
 */
export function askedDone(game) {
  if (game.flag('desert.asked') || !game.flag('desert.jar.given')) return false;
  game.set('desert.asked', true);
  return true;
}

/** The chest's gift: an empty tank but for one shot of the makers' old fluid, with the buttons as the player holds them. */
export function dregsText(kind = inputKind()) {
  const k = (v) => verbKey(v, kind);
  return `The tank on your back is nearly empty: one last swallow of the makers’ old fluid at the bottom of the glass. One shot. Aim with ${k('aim')}, then ${k('fire')}.`;
}

/** The tank's first fill at the pool: what it does now, with the buttons as the player holds them (src/prompt-keys.js verbKey). */
export function filledText(kind = inputKind()) {
  const k = (v) => verbKey(v, kind);
  return `The water climbs your hose, and the empty tank fills: cyan, violet, and the coral of the giant’s pool. Now it shoots (aim with ${k('aim')}, then ${k('fire')}) and pushes (switch the gun to push with ${k('mode')}, and shoot).`;
}

export function setupDesert(ctx) {
  const { level, physics, player, crowd, quests, dialogue, game, sound, story, spawn, talkable, scene, toast, tool, moments = null } = ctx;
  const Q = level.qanat;
  if (!Q) return null;
  const city = Q.city, camps = Q.camps, cave = Q.cave;
  migrateDesertQuest(game);
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = ITEMS;
  // the main quest: power for the ship (unless the ship already has it). It doesn't just appear: Marrow,
  // poking at your hull when you step out, tells you the ship is drained and only Qanat ever held that much, and
  // the quest starts in that talk (src/story/quests.js opensWith); or Ama, the Speaker, Nour or Hessa, if
  // you walk past him. Until then the scout finds Marrow.
  const opening = () => !quests.isStarted('desert.power') && !game.flag('ship.powered');
  if (opening()) quests.opensWith('desert.power', ['marrow', 'ama', 'speaker', 'nour', 'hessa'], { label: 'Marrow, by your ship', at: 'marrow' });
  // the tree already burns (a save from before the spark-stone's errand): its stages are passed over
  const lit = () => !!game.flag('desert.tree.lit');
  const skipSpark = () => { if (lit() && SPARK_STAGES.includes(quests.stage('desert.power'))) quests.set('desert.power', 'ship'); };
  skipSpark();
  // the water let out before anyone sent you down (Ilo, Bako and Hessa all point at the giant's mouth): the steps
  // that only lead there (Nour's sending, the dry well, the Speaker's old words, the way down) are passed over,
  // and the quest goes on from what you did. Ama still gives the jar (her `lateJar`), so it can be filled.
  const caughtUp = () => {
    if (!game.flag('desert.channel.open') || !CATCH_UP.includes(quests.stage('desert.power'))) return;
    for (const f of ['desert.elder.heard', 'desert.well.seen', 'desert.speaker.heard', 'desert.cave.seen']) if (!game.flag(f)) game.set(f, true);
  };
  caughtUp();
  quests.onChange(({ id }) => { if (id === 'desert.power') { skipSpark(); caughtUp(); } });
  game.on('flag:desert.channel.open', (v) => { if (v) caughtUp(); });
  // Ama's jar (the stage 'ask'): its flag once she has given it
  askedDone(game);
  game.on('flag:desert.jar.given', () => askedDone(game));

  const ground = (p, from = 4) => { const g = physics.groundAt(p.x, p.y + from, p.z); return Number.isFinite(g) ? g : p.y; };
  const onGround = (p) => V(p.x, ground(V(p.x, p.y, p.z), 3), p.z);
  const loop = (c, r, n = 4, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return onGround(V(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r)); });

  // ---------------------------------------------------------------- the people
  const seat = (i) => Q.seats.find((s) => s.fire.big && s.i === i);
  const people = {};
  const fire = camps.fires[0];
  people.ama = spawn(PEOPLE.ama, { route: loop(V(fire.x, fire.y, fire.z), 2.7, 5, 0.3), speed: 0.7 });
  for (const [id, k] of [['sefa', 0], ['bako', 1], ['teo', 2]]) {
    const s = seat(k);
    people[id] = spawn(PEOPLE[id], { route: [s.at.clone()], seat: 0.02, heading: s.heading });
  }
  const iloHome = camps.spot(9, 16);
  const iloRoute = loop(V(iloHome.x, iloHome.y, iloHome.z), 7, 5);
  people.ilo = spawn(PEOPLE.ilo, { route: iloRoute, speed: 2.4 });
  const marrowAt = camps.spot(-19, -14);
  const marrowHome = loop(marrowAt, 1.6, 3);
  // a new game: he is at your ship when you step out, looking over the mark on its hull (then home to his crates)
  const ramp = ctx.ship?.arrivalSpot?.() ?? null;
  const rampAt = ramp?.pos ?? (level.ship?.pos ?? level.spawn).clone();
  const out = V(Math.sin(ramp?.heading ?? 0), 0, Math.cos(ramp?.heading ?? 0));
  const hull = ctx.ship?.restPos?.clone() ?? rampAt.clone().addScaledVector(out, -14);
  // (well clear of where the ship comes down and ploughs in: he watched it land, src/ship/landing.js)
  const watch = bystanderSpot({ out, hull, travel: ctx.ship?.site?.crash?.travel ?? null });
  const wreckSpot = onGround(V(watch.x, rampAt.y, watch.z));
  people.marrow = spawn(PEOPLE.marrow, { route: opening() ? [wreckSpot] : marrowHome, speed: 0.6 });
  if (opening()) { people.marrow.facing = Math.atan2(hull.x - wreckSpot.x, hull.z - wreckSpot.z); people.marrow.heading = people.marrow.facing; }
  /** Marrow back to his crates: once the quest is under way and you are well away from him. */
  const marrowGoHome = () => {
    const m = people.marrow;
    if (m.route === marrowHome || opening() || flat(m.pos, player.pos) < 60) return;
    m.route = marrowHome; m.wp = 0; m.facing = null;
    m.pos.copy(marrowHome[0]);
  };
  // Hessa sweeps round the well on the top terrace
  const wellC = city.well;
  people.hessa = spawn(PEOPLE.hessa, { route: [0.9, 2.2, 3.6].map((a) => onGround(V(wellC.x + Math.sin(a + city.yaw) * 3.6, wellC.y, wellC.z + Math.cos(a + city.yaw) * 3.6))), speed: 0.5 });
  // the Speaker walks a few steps ahead of the procession
  const head = V(0, 0, 0);
  people.speaker = spawn(PEOPLE.speaker, {
    route: [onGround(crowd?.columnHead('procession', 4) ?? city.gate.clone())],
    follow: () => {
      if (!crowd?.route('procession')) return null;
      crowd.columnHead('procession', 4.5, head);
      head.y = ground(head, 3);
      return { pos: head, speed: crowd.route('procession').column.speed, near: 0.6, max: 3 };
    },
  });
  // Oum: on her stone in the dunes, or following you, or home by the fire
  const oumStone = onGround(V(STORY.pilgrim.x, 0, STORY.pilgrim.z).setY(level.ground.heightAt(STORY.pilgrim.x, STORY.pilgrim.z)));
  const oumSeat = seat(3);
  const oumFollow = V(0, 0, 0);
  let oumWaitT = 0;
  people.oum = spawn(PEOPLE.oum, {
    route: [game.flag('desert.oum.home') ? oumSeat.at.clone() : oumStone.clone()],
    seat: game.flag("desert.oum.home") ? 0.02 : game.flag('desert.oum.following') ? null : 0.45,
    heading: game.flag('desert.oum.home') ? oumSeat.heading : 1.2,
  });
  const oum = people.oum;
  // Nour: on her bench under the makers' ledge, keeping their chest company (desert-city.js)
  const ledge = city.ledge;
  people.nour = spawn(PEOPLE.nour, { route: [ledge.bench.at.clone()], seat: 0.02, heading: ledge.bench.heading, speed: 0.8 });
  const nour = people.nour;
  // the people of Qanat: two on the top terrace, the rest down in the avenue by the main stairs
  const T = city.top - city.center.y;
  const homes = [
    [[8.6, T, 2.5], [8.2, T, -3.5]], [[-9.6, T, -3.2], [-8.9, T, -6.4]],
    [[-4.4, 0, 35], [-3.8, 0, 41]], [[4.4, 0, 34], [4.8, 0, 39]], [[-2.8, 0, 46], [2.6, 0, 46]], [[3.2, 0, 52], [-3.0, 0, 50]],
  ].map((pts) => pts.map(([x, y, z]) => onGround(city.local(x, y + 1, z))));
  const villagers = VILLAGERS.map((v, i) => {
    const n = spawn({ ...VILLAGER_TALK, ...v }, { route: homes[i], speed: 0.9 });
    n.home = homes[i];
    n.below = i >= 2;   // down in the avenue: up the main stairs to gather
    return n;
  });
  // where they gather: on the terrace at the tree's foot, in front of the ledge and round its sides,
  // looking up at it; clear of the well, Nour's bench and the buttress's face (where you climb)
  // (ledge-local: x across, z out from the chest; the buttress's face is at ledge.face)
  const terraceY = ledge.foot.y;
  const gatherSpots = [[-2.3, 3.9], [1.9, 3.4], [-3.0, 2.2], [3.0, 2.0], [-0.6, 4.9], [0.9, 5.2], [-2.6, 5.4], [2.6, 4.5], [-3.6, 0.6], [3.6, 0.4]]
    .map(([x, z]) => ledge.at(x, 0, ledge.face + z - 2))
    .filter((p) => {
      const g = physics.groundAt(p.x, terraceY + 1.5, p.z, 3);
      return Number.isFinite(g) && Math.abs(g - terraceY) < 0.3 && flat(p, city.well) > 3.4 && flat(p, ledge.bench.at) > 1.3 && flat(p, ledge.foot) > 1.2;
    })
    .map((p) => p.setY(terraceY));
  // a stone for Oum to sit on, and her staff
  {
    const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0).scale(1.2, 0.8, 1), makeMaterial({ color: '#c9b8a0', flat: true }));
    st.position.copy(oumStone).add(V(0, 0.05, 0));
    st.userData.noCollide = true;
    scene.add(st);
  }

  // ---------------------------------------------------------------- following
  const iloFollow = V(0, 0, 0);
  const updateFollowers = (dt) => {
    // Ilo: at your heels on the way to the skull, then waiting on its lip
    const I = people.ilo;
    const iloQ = quests.stage('desert.ilo');
    if (iloQ === 'lead') {
      const d = player.frame?.dir ? player.frame.dir(player.heading, _w) : _w.set(Math.sin(player.heading), 0, Math.cos(player.heading));
      iloFollow.copy(player.pos).addScaledVector(d, -1.6).add(V(d.z * 0.9, 0, -d.x * 0.9));
      I.follow = () => (player.pos.y > 600 ? null : { pos: iloFollow, speed: Math.min(Math.hypot(player.vel.x, player.vel.z), 3.5), near: 1.0, max: 6 });
      if (flat(player.pos, Q.giant.door) < 9 && flat(I.pos, Q.giant.door) < 12) game.set('desert.ilo.atSkull', true);
    } else if (iloQ === 'below') {
      const wait = Q.giant.door.clone().add(V(Math.sin(Q.giant.yaw) * 4 + Math.cos(Q.giant.yaw) * 2.5, 0, Math.cos(Q.giant.yaw) * 4 - Math.sin(Q.giant.yaw) * 2.5));
      I.follow = () => ({ pos: wait, speed: 1.5, near: 0.8, max: 3, face: Q.giant.yaw + Math.PI });
    } else {
      I.follow = null;
      // back home between the tents once you've gone (no long walk through the walls)
      if (flat(I.pos, iloRoute[0]) > 30 && flat(I.pos, player.pos) > 50) I.pos.copy(iloRoute[0]);
    }
    // Oum: slow, and she sits down if you run off
    if (game.flag('desert.oum.following') && !game.flag('desert.oum.home')) {
      oum.seat = null;
      const far = flat(player.pos, oum.pos) > 22 || player.pos.y > 600;
      oumWaitT -= dt;
      if (far && oumWaitT <= 0 && flat(player.pos, oum.pos) < 60) { oum.shout = { text: '~shout~ Wait for me!', until: oum.time + 2.2 }; oumWaitT = 9; }
      const d = _w.set(oum.pos.x - player.pos.x, 0, oum.pos.z - player.pos.z).normalize();
      oumFollow.copy(player.pos).addScaledVector(d, 2.2);
      oum.follow = () => (far ? null : { pos: oumFollow, speed: 1.1, near: 1.2, max: 1.6 });
      if (flat(oum.pos, fire) < 14) {
        game.set('desert.oum.home', true);
        sound.chime();
      }
    } else if (game.flag('desert.oum.home')) {
      // to her seat by the fire
      if (!oum.seat) {
        if (flat(oum.pos, oumSeat.at) > 0.8) oum.follow = () => ({ pos: oumSeat.at, speed: 1, near: 0.3, max: 1.4 });
        else { oum.follow = null; oum.seat = 0.02; oum.heading = oumSeat.heading; }
      }
    }
  };

  // ---------------------------------------------------------------- things to look at
  const thing = (def, at, { range = 3, prompt, enabled = () => true, look = null, use } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < 4 ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at, look)),
  });
  // (asked from the terrace beside it, city.wellLook; he turns to the shaft itself and looks down into it, not
  // at the spot he was asked from: standing between that spot and the rim, he turned his back on the well)
  thing(THINGS.well, city.wellLook, { range: 3.4, prompt: 'look into the well', look: wellInside(city) });
  thing(THINGS.stele, city.stele, { range: 3.2, prompt: 'read the stele', look: city.stele.clone().add(V(0, 2.4, 0)) });
  const browAt = Q.giant.door.clone().add(V(Math.sin(Q.giant.yaw) * 3, 0, Math.cos(Q.giant.yaw) * 3));
  thing(THINGS.brow, browAt, { range: 4, prompt: 'look up at the skull', look: Q.giant.brow });
  thing(THINGS.mural, cave.mural.clone().setY(cave.origin.y), { range: 4, prompt: 'look at the mural', look: cave.local(-17.5, 3.2, 20.5) });
  // the little mask in the masked head's chamber (src/levels/desert.js maskRooms), and the salvager's slate at the crashed hull
  for (const r of level.maskRooms ?? []) thing(THINGS.smallMask, r.floor, { range: 3.4, prompt: 'look at the little mask', look: r.mask });
  const LM = level.landmarks ?? {};
  if (LM.wreckSlate) thing(THINGS.slate, LM.wreckSlateFoot, { range: 3.2, prompt: 'read the slate', look: LM.wreckSlate });

  // the story's running state; the water (open) and the fire (lit) are flags
  const st = { level: cave.levels.dry, flow: 0, flowT: 0, boneT: 0, flare: 0, drink: 0, approached: false, campsIn: false, clock: 0, fire: lit() ? 1 : 0 };
  const open = () => !!game.flag('desert.channel.open');

  // ---------------------------------------------------------------- the tank: empty until the giant's pool
  // (src/fluid-tool.js reads the same flag: no charges, no refill, a press only sputters)
  const dry = () => (tool ? !!tool.dry : items.has('backpack') && !!game.flag('tool.empty'));
  // the tool pushes once the backpack is found and filled; before that, hands (and the keepers' pole)
  const toolHasPush = () => !!tool && (tool.owned ?? items.has('backpack')) && !dry();
  let dryT = -1e9;
  game.on('tool:dry', () => {
    if (st.clock - dryT < 25) return;
    dryT = st.clock;
    if (game.flag('tool.dregs') > 0) { toast('The last swallow in the tank is too little to push with. It will make one shot, no more.'); return; }   // (the dregs only shoot: src/fluid-tool.js)
    toast(open() ? 'The tank is empty. Wade into the giant’s pool to fill it.' : 'The tank is empty: dry glass, not a drop. Where the water is, it fills (Nour says).');
  });

  // the Givers' House (src/temples/desert.js) wants the fluid from its first room (the push, the splash):
  // walked in with an empty tank, you are told where to fill it
  game.on('flag:temple.desert.entered', (v) => { if (v && dry()) setTimeout(() => toast('Your tank is empty, and nothing in the Givers’ House will answer an empty tank. Fill it first, at the giant’s pool past Qanat’s back gate.'), 2500); });

  // ---------------------------------------------------------------- the drum, and the mask's eyes
  // jammed against a rib by a knuckle of spine; drifted shut with sand (src/story/desert-errands.js)
  const drum = setupDrum(ctx, { toolHasPush: () => toolHasPush() });
  const mask = setupMask(ctx);

  // ---------------------------------------------------------------- the hoverbike
  // not yours from the start: Marrow hid it under a tarp in a hollow (src/story/desert-bike.js)
  const hollow = setupHoverbike(ctx);

  // ---------------------------------------------------------------- the channel and the pool
  // the water: dry (cave.levels.dry) until the channel opens; then the stream runs (flow 0..1) and the pool rises
  const clearChannel = (how) => {
    if (open()) return;
    game.set('desert.channel.open', true);
    st.boneT = 0.001;
    const said = how === 'push' ? 'The fluid shoves the rib: it rolls off the channel. Water runs.' : how === 'lever' ? 'You lean on the pole with all your weight. The rib tips up off the channel, rolls, and falls clear. Water runs.' : 'You heave. The rib grinds, tips, and rolls off the channel. Water runs.';
    sound.waterRise?.();
    sound.chime();
    // the first time the water runs, filmed (src/story/desert-moments.js); it says its toast at the end. Else at once.
    if (!film.flow(said)) toast(said);
  };
  // the desert's first times, filmed (src/story/desert-moments.js; set up below, once what they show exists)
  let film = { flow: () => false, fill: () => false };
  // the tool's push clears it (src/targets.js); a shot only rocks it
  const boneTarget = registerTarget({ kind: 'bone', radius: 2.6, position: () => cave.bone.position, enabled: () => !open() && player.pos.distanceTo(cave.origin) < 200,
    onHit: (mode) => {
      if (mode === 'push') { clearChannel('push'); return true; }
      st.wobble = 1;
      if (!st.hinted) { st.hinted = true; toast('The rib rocks, and settles. It needs a shove: switch the gun to push with {key:mode}, then aim and shoot.'); }
      return true;
    } });
  void boneTarget;
  // E: with a full tank, a look (it says push); without, you heave and it won't move: the keepers' pole
  registerInteractable({ id: 'bone', priority: PRIORITY.use, range: 4.2, at: () => cave.bone.position, enabled: () => !open(),
    prompt: () => (toolHasPush() ? 'look at the fallen rib' : 'heave the fallen rib'),
    distance: (p) => (p.pos.distanceTo(cave.origin) < 200 ? flat(p.pos, cave.bone.position) : Infinity),
    use: () => {
      if (toolHasPush()) { dialogue.start(THINGS.bone, null, cave.bone.position); return; }
      st.wobble = 0.6;
      sound.thud?.();
      game.set('desert.pole.tried', true);
      toast(quests.has('pole') ? 'Far too heavy for your arms. Set the keepers’ pole over the carved post beside the channel, and lean on it.'
        : 'You heave. It doesn’t even rock: it is far too heavy for your arms. The old keepers cleaned this channel; they must have had a way. Beside it stands a carved post, a notch worn smooth in its top.');
    } });
  const lever = setupLever();

  // the water: the pool, the stream and the well (the tree drinks, and stays cold until it is lit)
  const applyWater = (instant) => {
    city.wellWater.visible = true;
    // (the well rises while you watch it: the 'rise' stage; a save that saw it finds it full)
    if (instant && (game.flag('desert.well.watched') || lit())) city.wellWater.position.y = city.well.y + 0.95;
    if (instant) { st.level = cave.levels.high; st.flow = 1; st.boneT = 1; st.drink = 1; }
    else if (!st.boneT) st.boneT = 0.001;   // (the flag set some other way: the rib still rolls off)
    cave.setWater(st.flow, st.level);
    lever.settle();
  };
  // the fire: the tree burns (cool, every colour: the drinking's own fire), the feast begins
  const applyLit = (instant) => {
    city.flames.setPalette(COOL_FIRE, true);
    city.smoke?.setPalette(SMOKE_COOL, true, COOL_FIRE[1]);
    if (crowd) for (const p of crowd.people) if (p.spot?.id === 'procession') p.lines = LINES.drinking;
    sound.setBandMode('camp', 'feast'); sound.setBandMode('procession', 'feast'); sound.setBandMode('tree', 'feast');
    const tb = sound.band?.('tree');
    if (tb && !tb.parts.includes('chant')) tb.parts.unshift('chant');
    st.drinking = true;
    if (instant) { st.fire = 1; city.setLit(1); city.smoke.grow = Infinity; }
  };
  cave.setWater(st.flow, st.level);
  // the smoke column casts no shadow across the city (the renderer hides level.noShadow in its shadow passes)
  if (city.smoke) (level.noShadow ??= []).push(city.smoke.mesh);
  city.setLit?.(st.fire);
  if (open()) applyWater(true);
  if (lit()) applyLit(true);
  game.on('flag:desert.channel.open', (v) => { if (v) applyWater(false); });

  /**
   * The keepers' pole and the carved post. The pole leans on the mural; with it in your hands, E at the
   * post sets it under the rib's end and each press is a heave (desert.lever counts them): the rib lifts
   * a little more each time, and on the third it tips off the channel and rolls clear.
   */
  function setupLever() {
    const perp = V(-cave.chDir.z, 0, cave.chDir.x).normalize(), along = V(cave.chDir.x, 0, cave.chDir.z).normalize();
    const rib = cave.boneRest.pos, floorY = cave.origin.y;
    // (the rib lies along the gutter, in it: the post stands just off the gutter's side, chest high, so the
    // pole goes over the rim and under the rib's flank, and leaning on it tips the rib out over the far rim)
    const postAt = rib.clone().addScaledVector(perp, -2.45).setY(floorY);
    const HEAVES = 3;
    // the post: a carved block with a notch worn in its top
    const stoneM = makeMaterial({ color: '#c9b8a0', flat: true });
    const post = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(0.5, 1.62, 0.5).translate(0, 0.81, 0), new THREE.BoxGeometry(0.72, 0.14, 0.72).translate(0, 0.07, 0),
      new THREE.BoxGeometry(0.62, 0.1, 0.62).translate(0, 1.55, 0)].map((g) => g.toNonIndexed())), stoneM);
    post.position.copy(postAt); post.rotation.y = Math.atan2(perp.x, perp.z);
    // the pole: bone, two people long, a bronze shoe on its tip (+x)
    const pole = new THREE.Group();
    pole.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 4.4, 6).rotateZ(Math.PI / 2), makeMaterial({ color: '#efe4cc', flat: true })));
    pole.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.05, 0.45, 6).rotateZ(Math.PI / 2).translate(2.35, 0, 0), makeMaterial({ color: '#c9974a', flat: true, metal: 'brass' })));
    for (const o of [post, pole]) { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); cave.root.add(o); }
    // where it leans: against the mural's end (the mural faces n; tm runs along it)
    const n = V(Math.sin(Math.PI * 0.8), 0, Math.cos(Math.PI * 0.8)), tm = V(-n.z, 0, n.x);
    const m0 = cave.local(-17.5, 0, 20.5);
    const leanFoot = m0.clone().addScaledVector(tm, 5.1).addScaledVector(n, 1.1), leanTop = m0.clone().addScaledVector(tm, 4.95).addScaledVector(n, 0.32).add(V(0, 4.25, 0));
    // under the rib: through the post's notch (the pivot), the shoe under the rib's end, the grip out past the post
    const pivot = postAt.clone().setY(floorY + 1.72);
    const _d = V(0, 0, 0), _q = new THREE.Quaternion(), X = V(1, 0, 0);
    /** Lay the pole from a (its grip) to b (its shoe). */
    const lay = (a, b) => { pole.position.copy(a).add(b).multiplyScalar(0.5); pole.quaternion.copy(_q.setFromUnitVectors(X, _d.subVectors(b, a).normalize())); };
    const leverPose = (k) => {
      // k: 0 resting in the notch, 1 leaned on as far as it goes (the grip down, the shoe up under the rib)
      const tilt = 0.2 - k * 0.3;
      const tip = pivot.clone().addScaledVector(perp, 1.4).add(V(0, -1.4 * tilt, 0)), grip = pivot.clone().addScaledVector(perp, -2.9).add(V(0, 2.9 * tilt, 0));
      lay(grip, tip);
    };
    const L = { heave: 0, t: 1 };
    const placed = () => (game.flag('desert.lever') ?? 0) > 0 || open();
    const pose = () => {
      if (open()) {
        // left lying on the floor by the post once the rib is off
        lay(postAt.clone().addScaledVector(along, 0.9).addScaledVector(perp, -2.2).setY(floorY + 0.08), postAt.clone().addScaledVector(along, 0.6).addScaledVector(perp, 2.1).setY(floorY + 0.08));
        pole.visible = true;
      } else if (placed()) { pole.visible = true; leverPose(0); }
      else if (quests.has('pole')) pole.visible = false;   // (in your hands)
      else { pole.visible = true; lay(leanFoot, leanTop); }
    };
    pose();
    const take = () => {
      quests.give('pole');
      toast(`You take ${ITEMS.pole}: bone, two people long, shod in bronze, the Givers’ mark burned into its grip.`);
      sound.chime?.();
      pose();
    };
    const heave = () => {
      if (open()) return;
      const n0 = game.flag('desert.lever') ?? 0;
      if (n0 === 0) { quests.take('pole'); toast('You set the pole in the post’s notch, its bronze shoe under the rib’s end.'); }
      const k = n0 + 1;
      game.set('desert.lever', k);
      L.heave = k; L.t = 0;
      pose();
      sound.thud?.();
      if (k >= HEAVES) setTimeout(() => clearChannel('lever'), 450);
      else toast(k === 1 ? 'You lean on the pole. The rib’s end lifts a hand’s width, grinds, and settles back. Again.' : 'Again: the rib lifts, rocks on the gutter’s edge… nearly.');
    };
    registerInteractable({ id: 'keepers.pole', priority: PRIORITY.use, range: 2.6, at: () => leanFoot, enabled: () => !open() && !quests.has('pole') && !placed(),
      prompt: 'take the keepers’ pole', distance: (p) => (p.pos.distanceTo(cave.origin) < 200 ? flat(p.pos, leanFoot) : Infinity), use: take });
    registerInteractable({ id: 'keepers.post', priority: PRIORITY.use, range: 3.4, at: () => pivot, enabled: () => !open(),
      prompt: () => (placed() ? 'lean on the pole' : quests.has('pole') ? 'lever the rib with the keepers’ pole' : 'look at the carved post'),
      distance: (p) => (p.pos.distanceTo(cave.origin) < 200 ? flat(p.pos, postAt) : Infinity),
      use: () => {
        if (placed() || quests.has('pole')) heave();
        else { game.set('desert.pole.tried', true); toast('A post of carved stone beside the channel, a notch worn smooth in its top, as if something long had rested in it many times. Something long, to lever with.'); }
      } });
    return {
      postAt, pivot, leanFoot, pole, post, HEAVES, take, heave, placed,
      /** The rib is off: the pole lies on the floor (and leaves your hands). */
      settle() { if (quests.has('pole')) quests.take('pole'); pose(); },
      /** Per frame: a heave tilts the pole and lifts the rib's end, then lets it settle back. */
      update(dt) {
        if (L.t >= 1) return;
        if (open() && st.boneT > 0) { L.t = 1; return; }   // (the last heave: the rib rolls off on its own)
        L.t = Math.min(1, L.t + dt / 0.9);
        const k = Math.sin(Math.PI * L.t) * (0.55 + 0.15 * L.heave);
        leverPose(k);
        cave.bone.position.copy(cave.boneRest.pos).add(V(0, k * 0.22 * L.heave, 0));
        cave.bone.rotation.z = cave.boneRest.rot.z + k * 0.06 * L.heave;
        if (L.t >= 1) { cave.bone.position.copy(cave.boneRest.pos); cave.bone.rotation.z = cave.boneRest.rot.z; leverPose(0); }
      },
    };
  }

  // wading: the empty tank fills (and takes a colour, the first time); the jar fills
  /** The pool fills the tank (an empty one for good, a colour band the first time). Returns what changed. */
  const fillTank = () => {
    const wasDry = dry();
    const addColour = !game.flag('desert.pool.tinted') && items.has('backpack');   // (no tank, nothing to tint yet)
    // the fluid tool listens for this (fluid-tool.js): a full tank (an empty one fills for good), and a new colour band
    game.emit('tool:refill', { addColour });
    if (game.flag('tool.empty')) game.set('tool.empty', false);   // (no tool here, e.g. tests: the flag is the tank)
    if (addColour) game.set('desert.pool.tinted', true);
    return { wasDry, addColour };
  };
  // (the buttons as the player holds them: on a pad X is interact, the gun's mode is the D-pad: src/bindings.js)
  const FILLED = () => filledText();
  /** Ama's jar fills at the pool too. */
  const fillJar = () => {
    if (!quests.has('jar') || game.flag('desert.jar.filled')) return;
    quests.take('jar'); quests.give('water');
    game.set('desert.jar.filled', true);
    toast(`Ama’s jar fills: ${ITEMS.water}`);
    sound.chime();
  };
  let wasIn = false;
  const wade = () => {
    const c = cave.poolCenter;
    // in the water (once there is some), or down in the dry basin
    const inBasin = player.pos.distanceTo(cave.origin) < 200 && flat(player.pos, c) < cave.poolR && player.pos.y < cave.origin.y - 0.6;
    const wet = cave.wet && flat(player.pos, c) < cave.basinR(st.level) - 0.4 && player.pos.y < cave.origin.y + st.level + 0.25;
    const inPool = open() ? wet : inBasin;
    if (inPool && !wasIn) {
      if (!open()) toast('The basin is dry. Damp stains on the stone, a pale line where water stood. Something has stopped it coming.');
      // the empty tank's first fill, filmed (src/story/desert-moments.js): it fills on a beat and says the rest at its end
      else if (dry() && film.fill()) { /* (playing) */ }
      else {
        const { wasDry, addColour } = fillTank();
        if (wasDry) toast(FILLED());
        else if (addColour) toast('The water climbs your hose. The tank takes its colours.');
        fillJar();
      }
    }
    wasIn = inPool;
  };

  film = setupDesertMoments(ctx, { cave, st, tool, moments, fillTank, fillJar, FILLED });

  // ---------------------------------------------------------------- the ship
  const shipPos = () => {
    const s = level.ship?.pos ?? level.shipSite ?? level.spawn;
    return s.isVector3 ? s : V(s.x, s.y ?? level.ground.heightAt(s.x, s.z), s.z);
  };
  // Qanat repays you: once the tree burns, its people bring what they can spare to the ship and fill it
  // together (src/story/desert-repay.js). Your own jar alone would never have been enough; before the tree
  // burns it is dull water.
  let stillT = -1e9;
  const feedShip = () => {
    if (!quests.has('water') || game.flag('desert.ship.fed') || lit()) return false;
    if (st.clock - stillT > 30) { stillT = st.clock; toast('You tip the jar to the ship’s intake. The water lies still and dull in it: nothing in it wants to burn. Not yet.'); }
    return false;
  };
  const repay = setupRepay(ctx, {
    people: { ...people, ...Object.fromEntries(villagers.map((n, i) => [VILLAGERS[i].id, n])) },
    gifts: REPAY, call: REPAY_CALL,
    ramp: () => onGround((ctx.ship?.arrivalSpot?.()?.pos ?? shipPos()).clone()),
    hull: () => (ctx.ship?.restPos?.clone() ?? shipPos().clone()),
    onGround,
    lit, fed: () => !!game.flag('desert.ship.fed'),
    feed: () => { if (quests.has('water')) quests.take('water'); game.set('desert.ship.fed', true); },
  });
  game.on('ship:enter', () => { feedShip(); repay.enter(); });
  // the backpack found: its tank is empty but for the makers' dregs, one shot of old fluid (tool.dregs,
  // src/fluid-tool.js), so the shot is felt at once; the giant's pool fills it for good (a new save;
  // an older one carried a full tank already)
  game.on('box:opened', ({ item, id } = {}) => {
    if (item !== 'backpack') return;
    const empty = id === 'desert.backpack' && !open() && !game.flag('desert.pool.tinted');
    if (empty) { game.set('tool.empty', true); game.set('tool.dregs', 1); }
    setTimeout(() => toast(empty ? dregsText() : `Try shooting (aim ${verbKey('aim')}, shoot ${verbKey('fire')}) or pushing (switch the gun to push with ${verbKey('mode')}, and shoot).`), 3200);
  });
  // the dregs spent: the tank is dry glass until the pool (once)
  game.on('tool:dregs', ({ left } = {}) => {
    if (left > 0 || game.flag('desert.dregs.spent')) return;
    game.set('desert.dregs.spent', true);
    setTimeout(() => toast('The makers’ last swallow, gone in one splash. The tank is dry glass now: where the water is, it fills (Nour says).'), 900);
  });
  quests.def('desert.power').onDone = () => {
    game.set('ship.powered', true);
    game.set('world.desert.done', true);
    game.addKeepsake({ id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.' });
    toast('The ship hums awake. The galaxy is open.');
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('camps', () => camps.center);
  quests.locate('cityGate', () => city.gate);
  quests.locate('well', () => city.wellLook);
  quests.locate('caveIn', () => cave.inside);
  quests.locate('skull', () => Q.giant.door);
  quests.locate('bone', () => cave.bone.position);
  // the rib, until your arms have failed on it with an empty tank: then the keepers' pole (by the mural), then the post
  quests.locate('rib', () => (toolHasPush() || !game.flag('desert.pole.tried') ? cave.bone.position : lever.placed() || quests.has('pole') ? lever.pivot : lever.leanFoot));
  // something faster than walking: Marrow until he has told you, then the hollow
  quests.locate('bikeWay', () => (['find', 'wake'].includes(quests.stage('desert.bike')) || game.flag('desert.bike.uncovered') ? hollow.site.bike : people.marrow.pos));
  quests.locate('pool', () => cave.poolCenter);
  quests.locate('ship', shipPos);
  quests.locate('mask', () => V(-20, level.ground.heightAt(-20, -372), -372));
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);

  // ---------------------------------------------------------------- the procession's banners, lanterns and drum
  const props = [];
  if (crowd) {
    const pole = makeMaterial({ color: '#4a3a2a', flat: true }), lamp = makeMaterial({ color: '#fff3c4', glow: 1, flat: true }), brass = makeMaterial({ color: '#e2b552', flat: true, metal: 'brass' });
    const drumM = makeMaterial({ color: '#c8483a', flat: true });
    const colours = ['#c8483a', '#5fb7ad', '#f2c54b', '#8a6fb8', '#f3ead8', '#e6875f'];
    let ci = 0;
    for (const p of crowd.people) {
      if (!p.role) continue;
      const g = new THREE.Group();
      g.userData.noCollide = true;
      let banner = null, light = null;
      const one = (list) => mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)));
      if (p.role === 'banner') {
        g.add(new THREE.Mesh(one([new THREE.CylinderGeometry(0.035, 0.045, 4.4, 5).translate(0, 2.2, 0), new THREE.BoxGeometry(1.5, 0.06, 0.06).translate(0, 4.3, 0)]), pole));
        banner = new Banner(scene, V(0, 0, 0), 0, { width: 1.3, height: 2.6, color: colours[ci++ % colours.length] });
      } else if (p.role === 'lantern') {
        g.add(new THREE.Mesh(one([new THREE.CylinderGeometry(0.03, 0.04, 3.2, 5).translate(0, 1.6, 0),
          new THREE.TorusGeometry(0.35, 0.03, 4, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0.3, 3.2, 0), new THREE.CylinderGeometry(0.12, 0.2, 0.08, 6).translate(0.62, 3.15, 0)]), brass));
        g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0).scale(1, 1.4, 1).translate(0.62, 2.85, 0), lamp));
        light = new THREE.Vector4(0, -1e5, 0, 9);
        level.lights.push(light);
      } else if (p.role === 'drum') {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 14).rotateZ(Math.PI / 2 - 0.3).translate(0, 1.05, 0.32), drumM));
      }
      g.traverse((o) => { o.userData.noCollide = true; });
      scene.add(g);
      props.push({ p, g, banner, light, side: p.role === 'drum' ? 0 : 0.3 });
    }
  }
  const drummer = crowd?.people.find((p) => p.role === 'drum');
  const updateProps = (t, camPos) => {
    for (const pr of props) {
      const p = pr.p, far = p.pos.distanceToSquared(camPos) > 300 * 300;
      pr.g.visible = !far;
      if (pr.banner) pr.banner.mesh.visible = !far;
      if (far) { if (pr.light) pr.light.set(0, -1e5, 0, 0); continue; }
      const h = p.heading, rx = Math.cos(h), rz = -Math.sin(h);
      pr.g.position.set(p.pos.x + rx * pr.side, p.pos.y, p.pos.z + rz * pr.side);
      pr.g.rotation.y = h;
      pr.g.position.y += Math.abs(Math.sin(p.phase * Math.PI * 2)) * 0.04;
      if (pr.banner) {
        pr.banner.mesh.position.copy(pr.g.position).add(_v.set(0, 4.28, 0));
        pr.banner.mesh.rotation.y = h + Math.PI / 2;
        if (p.pos.distanceToSquared(camPos) < 120 * 120) pr.banner.update(t);
      }
      if (pr.light) pr.light.set(pr.g.position.x + rx * 0.62, pr.g.position.y + 2.9, pr.g.position.z + rz * 0.62, 9);
    }
  };

  // ---------------------------------------------------------------- music
  // (the cold tree has only a slow bell; once it burns, the chant comes back and everyone feasts)
  sound.setBands([
    { id: 'camp', pos: V(fire.x, fire.y + 1, fire.z), radius: 85, parts: game.flag('desert.teo.drumming') ? ['oud', 'ney', 'chant', 'drum'] : ['oud', 'ney', 'chant'], mode: lit() ? 'feast' : 'play' },
    { id: 'procession', pos: () => drummer?.pos ?? null, radius: 75, parts: ['drum', 'bell'], mode: lit() ? 'feast' : 'play', vol: 0.9, duck: 0.6 },
    { id: 'tree', pos: city.treeBase, radius: 110, parts: lit() ? ['chant', 'bell'] : ['bell'], mode: lit() ? 'feast' : 'play', vol: 0.55, duck: 0.4 },
  ]);
  game.on('flag:desert.teo.drumming', (v) => { const b = sound.band('camp'); if (v && b && !b.parts.includes('drum')) b.parts.push('drum'); });
  // Bako plays his ney for you when you ask: the one song it knows, slow and strange (sound.solo)
  game.on('music:solo', ({ who } = {}) => {
    const n = people[who];
    if (!n || !sound.solo) return;
    const len = sound.solo(() => V(n.pos.x, n.pos.y + 1.4, n.pos.z));
    if (len) n.shout = { text: '~solemn~ ♪  ♪', until: n.time + len };
  });

  // ---------------------------------------------------------------- the tree notices you
  // (cold, it takes an ember glob too, only to say why that is not enough: the Givers' House's ember mode
  // burns what is dry; the tree's wood never burned, only the living water in it, and that wants its spark)
  let emberT = -1e9;
  const treeTarget = registerTarget({ kind: 'tree', radius: 14, position: () => city.crown, accepts: ['fire'],
    onHit: (mode) => {
      st.flare = Math.max(st.flare, 1);
      if (mode === 'fire' && !lit() && st.clock - emberT > 8) {
        emberT = st.clock;
        toast(open() ? 'The ember hisses on the wet bark and dies. Living water won’t take the tank’s fire: it wants the spark it was first lit with.'
          : 'The ember spits on the bark and goes out. The tree’s wood never burned: only the water in it ever did, and there is none.');
      }
      return true;
    } });
  void treeTarget;

  // ---------------------------------------------------------------- the ledge: Qanat notices, gathers, and Nour comes
  const say = (n, text, secs = 3) => { n.shout = { text, until: n.time + secs }; };
  const pick = (list, i) => list[i % list.length];
  const boxAt = ledge.box;
  const faceBox = (p) => Math.atan2(boxAt.x - p.x, boxAt.z - p.z);
  /** Walk an NPC along points (the stairs), then stand at the last one facing `face`. */
  const walkPath = (n, pts, { speed = 1.25, face = null } = {}) => {
    let i = 0;
    n.follow = () => {
      while (i < pts.length - 1 && flat(n.pos, pts[i]) < 0.9) i++;
      return { pos: pts[i], speed, near: i < pts.length - 1 ? 0.5 : 0.35, max: speed + 0.6, face: face ?? undefined };
    };
  };
  const stairs = [city.plinthStair.clone(), city.local(0, T * 0.5, 22), city.stairTop.clone()];
  const sh = { noticed: false, gather: null, nour: null, timers: [] };
  const later = (secs, fn) => sh.timers.push({ at: secs, fn });
  const boxOpen = () => !!game.flag('box.desert.backpack') || items.has('backpack');
  // where Nour waits for you at the tree's foot, beside the buttress you climb, looking up at the chest
  const nourWait = ledge.at(-1.0, 0, ledge.face + 1.1).setY(terraceY);
  // (waiting there, she turns to you when you're about: a call is no use with her back to you)
  const nourToFoot = () => ({ pos: nourWait, speed: 0.95, near: 0.4, max: 1.4, face: flat(player.pos, nourWait) < 22 ? Math.atan2(player.pos.x - nourWait.x, player.pos.z - nourWait.z) : faceBox(nourWait) });
  // (to a step short of you, on her side: never onto you, even where a far follower just keeps up, npc.js)
  const nourBy = V(0, 0, 0), _nb = V(0, 0, 0);
  const nourToYou = () => {
    _nb.set(nour.pos.x - player.pos.x, 0, nour.pos.z - player.pos.z);
    if (_nb.lengthSq() < 1e-4) _nb.set(0, 0, 1);
    nourBy.copy(player.pos).addScaledVector(_nb.normalize(), 1.6);
    return { pos: nourBy, speed: 0.95, near: 0.3, max: 1.5 };
  };
  const notice = () => {
    // the first time you come near the closed chest: heads turn, a murmur, the tree flares a little
    sh.noticed = true;
    st.flare = Math.max(st.flare, 1.1);
    let k = 0;
    const climbing = player.climbing || player.pos.y > terraceY + 1.5;
    for (const n of [...villagers, people.hessa]) {
      if (flat(n.pos, boxAt) > 30) continue;
      const line = n === people.hessa ? (climbing ? '~shout~ Grandmother! The sky-stranger is climbing the tree!' : '~shout~ Grandmother! The sky-stranger is at the chest!') : pick(MURMURS.near, k);
      later(0.3 + k++ * 0.9, () => say(n, line, 3));
    }
    crowd?.lookAt(boxAt.clone().setY(boxAt.y + 1), 6, { near: boxAt, r: 60 });
  };
  const gather = () => {
    // the chest is open: everyone comes to the tree's foot to look up at it, the tree flares high, Nour gets up
    game.set('desert.shrine.gathered', true);
    sh.gather = { t: 0 };
    st.flare = Math.max(st.flare, 2.4);
    sound.chime?.();
    crowd?.lookAt(boxAt.clone().setY(boxAt.y + 2), 14, { near: boxAt, r: 90 });
    villagers.forEach((n, i) => {
      const spot = gatherSpots[i % Math.max(1, gatherSpots.length)];
      if (!spot) return;
      walkPath(n, n.below ? [...stairs, spot] : [spot], { speed: n.below ? 1.6 : 1.2, face: faceBox(spot) });
      later(0.6 + i * 0.75, () => say(n, pick(MURMURS.gather, i), 3.2));
    });
    later(1.2, () => say(people.hessa, '~shout~ Grandmother! It opened!', 3));
    // Nour: up off her bench, to the foot of the ledge (you come down to her, or she comes to you)
    sh.nour = { t: 0, talked: false, mode: 'foot' };
    nour.seat = null;
    later(0.4, () => say(nour, MURMURS.nour[0], 2));
    later(2.6, () => say(nour, MURMURS.nour[1], 3));
    nour.follow = nourToFoot;
  };
  const disperse = () => {
    // back to their doors and their sweeping, a while after
    for (const n of villagers) walkPath(n, n.below ? [...stairs].reverse().concat([n.home[0]]) : [n.home[0]], { speed: 1.0 });
    later(45, () => { for (const n of villagers) n.follow = null; });
  };
  const nourHome = () => {
    // back to her bench and down onto it
    sh.nour = null;
    nour.follow = () => {
      if (flat(nour.pos, ledge.bench.at) < 0.45) { nour.follow = null; nour.seat = 0.02; nour.heading = ledge.bench.heading; nour.pos.copy(ledge.bench.at); return null; }
      return { pos: ledge.bench.at, speed: 0.8, near: 0.3, max: 1.1 };
    };
  };
  game.on('box:opened', ({ id } = {}) => { if (id === 'desert.backpack' && !game.flag('desert.shrine.gathered')) gather(); });
  game.on('dialogue:end', ({ id } = {}) => {
    if (id !== 'nour') return;
    if (sh.nour) sh.nour.talked = true;
    if (sh.gather) sh.gather.talked = true;
  });
  const updateLedge = (dt, pp) => {
    for (const tm of sh.timers) tm.at -= dt;
    for (const tm of sh.timers.filter((x) => x.at <= 0)) { sh.timers.splice(sh.timers.indexOf(tm), 1); tm.fn(); }
    const dBox = flat(pp, boxAt);
    const onTerrace = Math.abs(pp.y - terraceY) < 1.2, up = !onTerrace && pp.y > terraceY;   // (up: on the ledge, or climbing to it)
    sh.up = up && dBox < 12;
    if (!sh.noticed && !boxOpen() && dBox < 13 && pp.y > terraceY - 1 && pp.y < boxAt.y + 2.5) notice();
    if (sh.gather) {
      sh.gather.t += dt;
      // they stay a while (all through Nour's talk), then drift back to their doors
      if (!sh.gather.dispersed && ((sh.gather.talked && sh.gather.t > 50) || sh.gather.t > 120)) { sh.gather.dispersed = true; disperse(); }
    }
    const N = sh.nour;
    if (N) {
      N.t += dt;
      if (!N.talked) {
        // you're still up there: she waits at the foot and calls you down (once); you walked off: she waits
        // there too, where the marker finds her; you're down on the terrace near the tree: she comes to you
        const want = up || dBox > (N.mode === 'you' ? 16 : 12) ? 'foot' : 'you';
        if (want !== N.mode) { N.mode = want; nour.follow = want === 'foot' ? nourToFoot : nourToYou; }
        if (up && !N.called && N.t > 6 && dBox < 6) { N.called = true; say(nour, MURMURS.nour[3], 3.5); }
        // (she reaches you and waits by you, calling you over: the talk is yours to start, below)
      }
      if (N.talked && dBox > 30) nourHome();
    }
  };

  // ---------------------------------------------------------------- calling you over
  // whoever has something for you doesn't start talking by themselves: every few seconds while you're
  // near and haven't come over, a word (a balloon, said in their own voice), Nour a little "psst"
  // (sound.psst), and they turn to you. The talk is yours to start, on the usual prompt.
  // (`max`: calls at most that many times, then leaves it to you: Ama and her jar)
  const calls = [];
  const live = (c) => c.when() && !(c.max && (c.calls ?? 0) >= c.max);
  const caller = (n, o) => {
    const c = { n, range: 16, every: 8, wait: 4, t: 4, k: 0, turn: null, ...o };
    calls.push(c);
    // while they call you, the prompt is theirs over anyone standing about them (the gathered villagers)
    const e = allInteractables().find((x) => x.npc === n && x.id?.startsWith('talk.'));
    if (e) Object.defineProperty(e, 'priority', { get: () => PRIORITY.talk + (live(c) ? 1 : 0), configurable: true });
    return c;
  };
  const called = (c) => { c.calls = (c.calls ?? 0) + 1; if (c.flag) game.set(c.flag, true); };
  const updateCalls = (dt, pp) => {
    const busy = dialogue.open || !!moments?.playing || !!ctx.ship?.playing || !!ctx.ship?.busy?.();
    for (const c of calls) {
      const on = live(c), d = flat(c.n.pos, pp), near = on && d < c.range && Math.abs(c.n.pos.y - pp.y) < 6;
      c.turn?.(near);
      if (!on) { c.t = c.wait; continue; }
      if (busy || !near) { c.t = Math.max(c.t, 1.5); continue; }
      if ((c.t -= dt) > 0) continue;
      c.t = c.every;
      say(c.n, pick(c.lines, c.k++), 2.8);
      called(c);
      if (c.psst) sound.psst?.(V(c.n.pos.x, c.n.pos.y + 1.5 * c.n.object.scale.y, c.n.pos.z));
    }
  };
  // Marrow at your ship, a new game: "Sky-person! Over here!" (he turns from the hull to you)
  const marrowCall = caller(people.marrow, { lines: CALLS.marrow, range: 30, every: 9, wait: 2.5, when: () => opening() && people.marrow.route !== marrowHome,
    turn: (near) => { const m = people.marrow; if (m.route === marrowHome) return; m.facing = near ? Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z) : Math.atan2(hull.x - m.pos.x, hull.z - m.pos.z); } });
  // Nour, when she has a word for you: the chest opened (she has come over), or the tree drank and stays cold
  const nourHasWord = () => (sh.nour && !sh.nour.talked) || quests.stage('desert.power') === 'spark';
  // (not while you're up on the ledge: she has called you down from there already)
  const nourCall = caller(nour, { lines: CALLS.nour, range: 15, every: 7, wait: 5, psst: true, when: () => nourHasWord() && !sh.up });
  // Ama, while her jar is still yours to take: she calls you to her fire (twice at most, the shout as you come
  // up to the camps counts), so the jar on the way in isn't only for whoever happens to stop (October 2026)
  const amaCall = caller(people.ama, { lines: CALLS.ama, range: 14, every: 12, wait: 3, max: 2, flag: 'desert.ama.called', when: () => amaCallsYou(game) });

  // ---------------------------------------------------------------- waved on toward the city
  const early = () => opening() || EARLY.includes(quests.stage('desert.power'));
  const setWaveOn = (on) => {
    if (!crowd) return;
    for (const p of crowd.people) {
      const id = p.spot?.id, extra = LINES.waveOn[id];
      if (!extra) continue;
      p.baseLines ??= p.lines;
      if (on && p.lines === p.baseLines) p.lines = p.baseLines.flatMap((l, i) => (i < extra.length ? [extra[(i + Math.floor(p.seed * 4)) % extra.length], l] : [l]));
      else if (!on && p.lines !== LINES.drinking) p.lines = p.baseLines;
    }
  };
  setWaveOn(early());
  quests.onChange(({ id }) => { if (id === 'desert.power') setWaveOn(early()); });

  // ---------------------------------------------------------------- the spark-stone's errand
  // Nour's word sends you for the stone: the hoverbike's errand starts then (if it hasn't), the Hearth waits
  const hearth = setupHearth(ctx, { hasPush: () => toolHasPush() || (!!tool && !dry()), lit });
  // the bowl, the camp and the bell on the long ride there (src/story/desert-way.js)
  const way = setupWay(ctx);

  // the well fills while you watch: the roots drink (pale motes climb the trunk), Hessa calls out, the tree stays cold
  const drinkAt = [0, 1, 2, 3, 4, 5].map((i) => { const a = i / 6 * Math.PI * 2; return city.treeBase.clone().add(V(Math.sin(a) * 4.2, 0.6, Math.cos(a) * 4.2)); });
  const motes = new Embers(scene, drinkAt, { count: 46, color: '#9ff0e6', rise: 2.6, life: 5, spread: 1.2, size: 0.22 });
  motes.mesh.visible = false;
  const rise = { on: false, t: 0, done: !!game.flag('desert.well.watched') };
  const startRise = () => {
    if (rise.on || rise.done) return;
    rise.on = true; rise.t = 0;
    city.wellWater.position.y = Math.min(city.wellWater.position.y, city.well.y + 0.12);
    sound.waterRise?.();
    later(1.0, () => say(people.hessa, '~shout~ Grandmother! The well! It’s coming up!', 3));
  };

  // the stone in the well: the spark runs up the roots and the trunk to the crown, and the tree catches
  const sparkM = makeMaterial({ color: '#fff6dc', glow: 1, flat: true });
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 1), sparkM);
  spark.visible = false; spark.userData.noCollide = true; spark.userData.dynamic = true;
  scene.add(spark);
  const sparkLight = new THREE.Vector4(0, -1e5, 0, 0);
  level.lights?.push(sparkLight);
  const LIGHT = { fly: 0.9, climb: 2.8, catch: 6 };   // s: the stone into the water, the spark up the trunk, the fire growing
  const lighting = { t: -1, from: V(0, 0, 0) };
  // (up the outside of the trunk on the well's side, where you see it climb, then into the crown)
  const toWell = V(city.well.x - city.treeBase.x, 0, city.well.z - city.treeBase.z).normalize();
  const bark = (r, y) => city.treeBase.clone().addScaledVector(toWell, r).add(V(0, y, 0));
  const sparkPath = [city.well.clone().add(V(0, 0.9, 0)), bark(6.4, 1.4), bark(5.4, 7), bark(5.1, 15), bark(4.9, 23), bark(4.2, 30), city.crown.clone()];
  const sparkCurve = new THREE.CatmullRomCurve3(sparkPath);
  const setStone = () => {
    if (lit() || !quests.has('stone') || !open()) return;
    quests.take('stone');
    lighting.t = 0;
    // out of your pack: in your hand, held out over the water (it was never drawn while you carried it)
    const hand = player.humanoid?.b?.hand_r;
    if (hand && player.object?.visible !== false) hand.getWorldPosition(lighting.from);
    else lighting.from.copy(player.pos).add(V(0, 1.15, 0)).addScaledVector(V(city.well.x - player.pos.x, 0, city.well.z - player.pos.z).normalize(), 0.45);
    if (level.hearth) level.hearth.stone.userData.placing = true;
    game.set('desert.tree.lit', true);
    sound.chime?.();
    toast('You let the spark-stone down into the well. It sinks, glowing, into the living water…');
  };
  registerInteractable({ id: 'well.stone', priority: PRIORITY.use + 1, range: 3.6, at: () => city.well, enabled: () => quests.has('stone') && !lit(),
    prompt: () => (open() ? 'set the spark-stone in the well' : 'look into the dry well'),
    distance: (p) => (Math.abs(p.pos.y - city.well.y) < 4 ? flat(p.pos, city.well) : Infinity),
    use: () => { if (open()) setStone(); else toast('The well is dry: the stone would only lie in the dust. The water must come up first.'); } });
  const updateLighting = (dt) => {
    if (lighting.t < 0) return;
    lighting.t += dt;
    const T = lighting.t, H = level.hearth;
    if (T < LIGHT.fly) {
      // the stone comes out of your pack and drops from your hand into the water
      const k = T / LIGHT.fly;
      if (H) { H.stone.visible = true; H.stone.position.lerpVectors(lighting.from, sparkPath[0], k).add(V(0, Math.sin(Math.PI * k) * 0.8, 0)); H.stoneLight.set(H.stone.position.x, H.stone.position.y, H.stone.position.z, 10); }
    } else if (T < LIGHT.fly + LIGHT.climb) {
      // a spark climbs out of the water, up the roots and the trunk, to the crown
      if (H) { H.stone.visible = false; H.stoneLight.w = 0; H.stone.userData.placing = false; }
      const k = (T - LIGHT.fly) / LIGHT.climb;
      spark.visible = true;
      sparkCurve.getPointAt(Math.min(1, k * k * (3 - 2 * k)), spark.position);
      spark.scale.setScalar(0.8 + 0.6 * Math.sin(T * 17) ** 2);
      sparkLight.set(spark.position.x, spark.position.y, spark.position.z, 16);
      // a trail of pale sparks behind it, up the bark
      motes.sources = [spark.position];
      motes.mesh.visible = true; motes.rate = 1.6; motes.update(dt, T, null);
      setMagic(city.wellMat, T * 3, { bright: 1, tones: 6 });
    } else {
      // it catches: the fire grows up out of the crown, cool and in every colour, and the smoke climbs from it
      if (spark.visible) {
        spark.visible = false; sparkLight.set(0, -1e5, 0, 0);
        motes.sources = drinkAt; motes.mesh.visible = false;
        applyLit(false);
        st.flare = Math.max(st.flare, 2.6);
        sound.whoosh?.(); sound.chime?.();
        crowd?.lookAt(city.crown.clone(), 12, { near: city.crown, r: 400 });
        villagers.forEach((n, i) => later(0.4 + i * 0.6, () => say(n, pick(MURMURS.lit, i), 3.2)));
        later(0.8, () => say(people.hessa, '~shout~ It burns! Grandmother, it burns!', 3));
        later(2.0, () => say(nour, '~happy~ Every colour. Every colour, like when I was a girl.', 3.5));
      }
      const k = Math.min(1, (T - LIGHT.fly - LIGHT.climb) / LIGHT.catch);
      st.fire = k * k * (3 - 2 * k);
      city.setLit(st.fire);
      if (k >= 1) {
        lighting.t = -1;
        toast(quests.has('water') ? 'The great tree burns again, cool, in every colour. The water in Ama’s jar glows with it: bring it to the ship.' : 'The great tree burns again, cool, in every colour.');
      }
    }
  };

  // ---------------------------------------------------------------- per frame
  const camPos = V(0, 0, 0);
  const update = (dt, t, { camera }) => {
    camPos.copy(camera.position);
    st.clock += dt;
    const pp = player.pos;
    // the camps: first sight sets the quest moving; people turn to look and wave
    const dCamps = flat(pp, camps.center);
    if (dCamps < 45 && !game.flag('desert.camps.seen')) game.set('desert.camps.seen', true);
    if (dCamps < 34 && !st.campsIn && crowd) {
      st.campsIn = true;
      const now = crowd.time;
      for (const p of crowd.people) {
        if (p.spot?.id !== 'camp' && p.spot?.id !== 'gate') continue;
        const d = flat(p.pos, pp);
        if (d > 30) continue;
        p.lookUntil = now + 4 + Math.random() * 2;
        if (!p.walk && Math.random() < 0.4 && d < 22) { p.faceUntil = now + 1.5 + Math.random(); p.greetT = now; }
      }
      for (const n of [people.ama, people.ilo]) n.greeted = 0;
      if (early()) {
        say(people.ama, amaCampShout(game), 3.5);
        if (live(amaCall)) { called(amaCall); amaCall.k = 1; amaCall.t = amaCall.every; }
        later(1.4, () => say(people.ilo, '~shout~ Nour’s chest is humming! Go and see!', 3)); }
    } else if (dCamps > 60) st.campsIn = false;
    // into the city: the walls are round it
    if (!game.flag('desert.city.entered') && flat(pp, city.center) < 60 && Math.abs(pp.y - city.center.y) < 30) game.set('desert.city.entered', true);
    // the Speaker waves you on too, as you come up to the procession
    if (early() && !st.speakerWaved && flat(pp, people.speaker.pos) < 14) { st.speakerWaved = true; say(people.speaker, '~happy~ Qanat is ahead, little star. Up to the tree!', 3.5); }
    updateLedge(dt, pp);
    updateCalls(dt, pp);
    marrowGoHome();
    if (pp.distanceTo(cave.origin) < 80 && !game.flag('desert.cave.seen')) game.set('desert.cave.seen', true);
    updateFollowers(dt);
    wade();
    // the ship: walk up with the jar before the tree burns (it won't take); after, Qanat brings its gift
    if (quests.has('water') && flat(pp, shipPos()) < 10) feedShip();
    repay.update(dt, pp);

    // the tree: once it burns, it flares when you first come near and glows warmer the closer you are;
    // cold, it gives no light at all (only the plaza's lamps, a little, at night)
    const dTree = flat(pp, city.treeBase);
    if (dTree < 95 && !st.approached) { st.approached = true; st.flare = 1.4; game.set('desert.tree.flared', true); }
    else if (dTree > 160) st.approached = false;
    st.flare = Math.max(0, st.flare - dt * 0.35);
    const near = THREE.MathUtils.clamp(1 - dTree / 120, 0, 1);
    city.flames.intensity = 1 + 0.25 * near + st.flare * 0.6 + (st.drinking ? 0.15 : 0);
    city.embers.rate = 1 + st.flare * 2.5;
    city.light.w = (70 + st.flare * 40) * st.fire;
    city.light2.w = 14 + 44 * st.fire;
    updateLighting(dt);

    // the channel: the rib rolls aside, the stream runs, the pool rises and brightens
    if (st.boneT > 0 && st.boneT < 1) {
      st.boneT = Math.min(1, st.boneT + dt / 1.6);
      const k = THREE.MathUtils.smootherstep(st.boneT, 0, 1);
      cave.bone.position.lerpVectors(cave.boneRest.pos, cave.boneAside, k);
      cave.bone.position.y += Math.sin(Math.PI * k) * 0.8;
      cave.bone.rotation.set(cave.boneRest.rot.x + k * 2.6, cave.boneRest.rot.y, cave.boneRest.rot.z + k * 0.4);
    } else if (st.boneT >= 1) {
      cave.bone.position.copy(cave.boneAside);
      cave.bone.rotation.set(cave.boneRest.rot.x + 2.6, cave.boneRest.rot.y, cave.boneRest.rot.z + 0.4);
    } else if (st.wobble > 0) {
      st.wobble = Math.max(0, st.wobble - dt * 2);
      cave.bone.rotation.x = cave.boneRest.rot.x + Math.sin(st.wobble * 20) * 0.06 * st.wobble;
    }
    if (open() && st.level < cave.levels.high) {
      // the stream runs out of the crack as the rib rolls clear, reaches the pool, and the pool fills
      st.flowT += dt;
      if (st.flowT > (st.flowDelay ?? 0.5)) st.flow = Math.min(1, st.flow + dt / 2.6);   // (a moment holds it back for its first panel)
      if (st.flow >= 1) st.level = Math.min(cave.levels.high, st.level + dt * (st.level < cave.levels.dry + 0.12 ? 0.06 : 0.15));
      st.drink = THREE.MathUtils.clamp((st.level - cave.levels.dry) / (cave.levels.high - cave.levels.dry), 0, 1);
      cave.setWater(st.flow, st.level);
    }
    cave.poolLight.w = 10 + 20 * st.drink + (st.glow ?? 0);   // (st.glow: a moment's light cue)
    const inCave = camPos.distanceTo(cave.origin) < 300;
    if (inCave) {
      // the same fluid as the tank: dull and slow while the channel is blocked, alive once the water runs
      st.poolT = (st.poolT ?? 0) + dt * (0.35 + 0.65 * st.drink);
      setMagic(cave.poolMat, st.poolT, { bright: 0.25 + 0.75 * st.drink, tones: st.drink > 0.5 ? 6 : 4 });
      if (st.flow > 0) setMagic(cave.streamMat, t * 2.2, { bright: 1, tones: 6 });
    }
    // the well: once the water is up, you come and watch it rise up the shaft (the 'rise' stage), slowly,
    // the roots drinking; then it stands brimming
    if (open() && !rise.done && !rise.on && flat(pp, city.well) < 14 && Math.abs(pp.y - city.well.y) < 5) startRise();
    if (city.wellWater.visible && flat(camPos, city.well) < 250) {
      const brim = city.well.y + 0.95;
      if (rise.on) {
        rise.t += dt;
        city.wellWater.position.y = Math.min(brim, city.wellWater.position.y + dt * 0.085);
        motes.mesh.visible = true;
        motes.rate = 1;
        motes.update(dt, t, null);
        if (city.wellWater.position.y >= brim - 1e-3 && rise.t > 4) {
          rise.on = false; rise.done = true; rise.endT = st.clock;
          game.set('desert.well.watched', true);
          sound.chime?.();
          say(people.hessa, '~sad~ It’s full. It’s full, and the tree… Grandmother?', 3.5);
          later(2.2, () => say(nour, '~solemn~ Come here, child. Let an old woman tell you a story.', 3.5));
          toast('The well brims with living water, and the roots drink it. The great tree stands as cold as before.');
        }
      } else {
        // (not seen yet: the water waits low in the shaft for you)
        city.wellWater.position.y = rise.done || lit() ? brim : city.well.y + 0.12;
        if (motes.mesh.visible) { motes.rate = 0.6; motes.update(dt, t, null); if (st.clock - (rise.endT ?? 0) > 6) motes.mesh.visible = false; }
      }
      setMagic(city.wellMat, t, { bright: 1, tones: 6 });
    }

    // the musicians pick up your tune when you stand with them
    if (!st.drinking) sound.setBandMode('camp', flat(pp, fire) < 9 ? 'near' : 'play');
    updateProps(t, camPos);
    hollow.update(dt, t, camPos);
    drum.update(dt);
    mask.update(dt);
    lever.update(dt);
    hearth?.update(dt, t);
    way?.update(dt, t, camPos);
  };

  return {
    people, update, state: st, villagers, ledge: sh, repay, gatherSpots, calls: { marrow: marrowCall, nour: nourCall, ama: amaCall }, hollow, drum, mask, lever, hearth, way, rise, lighting, setStone, applyLit, film,
    /** E on a crowd person: their short conversation (by where they stand). */
    crowdTalk(p) {
      const id = p.spot?.id, zone = id === 'procession' && st.drinking ? 'drinking' : id;
      const list = CROWD_TALK[zone] ?? null;
      if (!list) return null;
      const k = Math.floor(p.seed * list.length) % list.length, base = list[k];
      // a voice of their own (src/story/voice.js voiceOf hashes the seed); `heard`: where the lines they've said are kept (dialogue.js pickListen)
      return { id: `crowd.${id}`, heard: `crowd.${zone}.${k}`, color: p.style?.cloak ?? '#d8a24a', kind: p.kind, seed: `crowd:${p.id}`, scale: p.size, ...base };
    },
    onTalk(person, npc, on) {
      // the procession stops for you while you talk with someone in it (or its Speaker)
      if (on && (npc === people.speaker || person.id === 'crowd.procession')) st.holdProcession = true;
      if (!on) st.holdProcession = false;
    },
    hold() { if (st.holdProcession) crowd?.hold('procession', 0.4); },
    toolHasPush, dry, lit,
  };
}
