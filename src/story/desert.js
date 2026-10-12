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
import { setupRoad } from './desert-road.js';
import { setupGiants } from './desert-giants.js';
import { setupDunes } from './desert-dunes.js';
import { setupWater } from './desert-water.js';
import { bystanderSpot } from '../ship/landing.js';
import { setupRepay } from './desert-repay.js';
import { quietOr } from '../hint-level.js';
import { missingCore } from './leave-gate.js';
import { t as tr } from '../i18n.js';

// The desert's story, alive: who stands where, what reacts to you, and the
// chain of the main quest (desert-data.js has the words).
//
//   the camps    Ama by the main fire; Sefa (oud), Bako (ney) and Teo on the
//                benches; Ilo running between the tents; Marrow by his crates
//   the circuit  the Speaker walks ahead of the procession (crowd.js column)
//   the city     Hessa sweeps round the great tree's roots; beside
//                them, at the trunk's foot, the makers' dais with their chest
//                on it (src/boxes/: the backpack), Nour the eldest on her
//                bench beside it, and a few people of Qanat about the terraces
//                and the avenue
//   the dunes    old Oum sits on a stone where she fell behind
//   the cave     the dry pool, the debris clogging its drain, the mural
//   far away     the Givers' Hearth and its spark-stone (src/story/desert-spark.js)
//
// The tree is cold (src/desert-city.js city.setLit: no flame, no smoke column,
// no sparks, no burn, a lone bell for music) until the spark-stone is set in
// its roots, the water up; then the fire grows up out of the crown in the cool colours
// of the drinking, the smoke column climbs from it, and the feast begins
// (the procession sings, the bands play double time).
//
// The traveller comes with his sword alone (the progression rewrite, v1.38: docs/systems/progression.md).
// The backpack comes out of its chest empty (game flag tool.empty, src/fluid-tool.js), and he has no gun yet.
// You pull the debris out of the drain yourself (issue #158: it was a rib levered off with the keepers' pole); the pool
// rises and the first wade fills the tank (and adds the giant's colour) and Ama's jar. The water climbs
// the roots while you watch (desert.well.watched: the flag kept its name from the well, gone in v1.49). Beside the pool a makers' chest holds the
// lift valve (the double jump, the backpack's first strength: src/boxes/placements.js 'desert.lift'); in the
// Givers' Hearth a chest holds the fluid gun (a gadget, 'desert.gun'), whose push rolls the stone ball.
//
// The reaction at the tree: the first time you come near the closed chest, the
// people in the square turn and murmur and the tree flares; when it opens
// (box:opened), the tree flares high and only Nour calls out ("Hey you!": no
// crowd comes over); she gets up off her bench and waits for you to climb down, comes over and calls you ("Psst. Child."),
// a little sound and a turn of her head every few seconds, until you talk to her
// (the 'elder' stage: she never starts talking by herself). Until the
// chest is open, the camps, the gate and the procession wave you on toward
// the city.
//
// The cave is dry until the drain is cleared: no pool, no stream,
// only damp stains. Then the stream runs out of the crack and down the gutter,
// and the pool fills the basin from its lowest point (desert-city.js setWater).
//
// Flags (game-state.js): desert.city.entered, desert.shrine.gathered (the
// reaction played; named for the shrine the chest once stood in), desert.elder.heard (Nour sent you on), desert.quest.v
// (the stage migrations), desert.camps.seen, desert.jar.given,
// desert.speaker.heard, desert.well.seen, desert.cave.seen,
// desert.channel.open (the rib is clear: the water rises and the tree drinks),
// desert.jar.filled, desert.well.watched (you saw the roots drink), desert.spark.heard
// (Nour told of the spark-stone), desert.hearth.seen / .open, desert.stone.taken
// (src/story/desert-spark.js), desert.tree.lit (the stone is in the roots: it burns),
// desert.ship.fed, desert.pool.tinted (the first wade filled the tank and added a
// colour), desert.teo.drumming, desert.ilo.following, desert.ilo.atSkull,
// desert.oum.following, desert.oum.home, desert.drum.freed and desert.mask.eyes
// (src/story/desert-errands.js), and a few "read" flags for the carvings.
// tool.empty: the tank has never been filled. Items: jar, water, drum, cord, stone (the keepers' pole went with the lever: issue #158).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = V(0, 0, 0), _w = V(0, 0, 0);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const EARLY = ['city', 'box'];   // the main quest's stages before the chest is open
const CATCH_UP = ['elder', 'down'];   // the stages that lead to the channel (setupDesert caughtUp)


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
 * v < 4: the four talks in a row (elder, well, ama, speaker) were two; v < 5: Ama's jar is no step of
 * the main quest any more (Nour points you at the skull herself, issue #63): a save at the well, Ama, the
 * Speaker or the jar's stage ('ask') goes on to the way down (STAGE_MERGE), keeping what it did.
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
 * Ama doesn't call you over for her jar any more: it pulled you off the way to the city, one more person to see
 * before the one who matters (the author's playthrough, October 2026, issue #63). The jar is hers to give whoever
 * sits at her fire (jarEarly, after the chest: power, late: lateJar), and no step of the quest. Kept, false, for
 * the callers below and the tests.
 */
export function amaCallsYou(game) {
  void game;
  return false;
}

/** What Ama shouts as you come up to the camps before the chest is open: the jar if she has it for you. */
export function amaCampShout(game) {
  return amaCallsYou(game) ? CALLS.ama[0] : '~shout~ To the city, sky-stranger! Up to the tree!';
}

/**
 * Ama has given you her jar (desert.asked): the jar's stage ('ask') was the step after Nour until Nour pointed you
 * at the skull herself (issue #63, DESERT_QUEST_V 5). The flag is still kept, for old saves and the journal.
 */
export function askedDone(game) {
  if (game.flag('desert.asked') || !game.flag('desert.jar.given')) return false;
  game.set('desert.asked', true);
  return true;
}

/** The chest's gift: the backpack, its round glass dry (since v1.38 no makers' dregs: there is no gun to shoot them yet). */
export function dregsText() {
  return 'The glass sphere on your back is dry: not a drop in it.';   // ("where the water is, it fills (Nour says)" came up before she had said it: issue #61)
}

/** The tank's first fill at the pool: what it does now (src/prompt-keys.js verbKey: the buttons as the player holds them). */
export function filledText(kind = inputKind()) {
  const k = (v) => verbKey(v, kind);
  const gun = items.has('gun');
  return gun ? tr('teach.filledGun', { aim: k('aim'), fire: k('fire'), mode: k('mode') }) : tr('teach.filled');   // (a teaching line: in the player's language, src/i18n.js)
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
  // Hessa sweeps round the tree's foot on the avenue's side, between the dais's clearing and the roots on the right
  // (tree-local angle, 0 toward the avenue, and metres from the trunk's axis: clear of the fins and the lanterns)
  const treeLocal = (a, r) => city.local(Math.sin(a) * r, city.top - city.center.y, -3 + Math.cos(a) * r);
  people.hessa = spawn(PEOPLE.hessa, { route: [[0.05, 8.6], [0.3, 8.9], [0.52, 8.6]].map(([a, r]) => onGround(treeLocal(a, r))), speed: 0.5 });
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
  // Nour: on her bench beside the makers' dais, keeping their chest company (desert-city.js)
  const ledge = city.shrine;
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
    return n;
  });
  const terraceY = ledge.foot.y;   // (the square at the tree's foot, round the dais)
  // a stone for Oum to sit on, and her staff
  {
    const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0).scale(1.2, 0.8, 1), makeMaterial({ color: '#c9b8a0', flat: true }));
    st.position.copy(oumStone).add(V(0, 0.05, 0));
    st.userData.noCollide = true;
    scene.add(st);
  }

  // ---------------------------------------------------------------- following
  const iloFollow = V(0, 0, 0);
  // (the giant's chest seen is Ilo's errand done, issue #183; she waits at the mouth to hear what was down there while you
  // are below or near, and goes home to the camps once you are off elsewhere: she asks you there)
  const iloWaits = () => quests.isDone('desert.ilo') && !game.flag('desert.ilo.told') && (player.pos.y > 600 || flat(player.pos, Q.giant.door) < 120);
  let iloCalled = false;
  const updateFollowers = (dt) => {
    // Ilo: at your heels on the way to the skull, then waiting on its lip
    const I = people.ilo;
    const iloQ = quests.stage('desert.ilo');
    if (iloQ === 'lead') {
      const d = player.frame?.dir ? player.frame.dir(player.heading, _w) : _w.set(Math.sin(player.heading), 0, Math.cos(player.heading));
      iloFollow.copy(player.pos).addScaledVector(d, -1.6).add(V(d.z * 0.9, 0, -d.x * 0.9));
      I.follow = () => (player.pos.y > 600 ? null : { pos: iloFollow, speed: Math.min(Math.hypot(player.vel.x, player.vel.z), 3.5), near: 1.0, max: 6 });
      if (flat(player.pos, Q.giant.door) < 9 && flat(I.pos, Q.giant.door) < 12) game.set('desert.ilo.atSkull', true);
    } else if (iloQ === 'below' || iloWaits()) {
      const wait = Q.giant.door.clone().add(V(Math.sin(Q.giant.yaw) * 4 + Math.cos(Q.giant.yaw) * 2.5, 0, Math.cos(Q.giant.yaw) * 4 - Math.sin(Q.giant.yaw) * 2.5));
      I.follow = () => ({ pos: wait, speed: 1.5, near: 0.8, max: 3, face: Q.giant.yaw + Math.PI });
    } else {
      I.follow = null;
      // back home between the tents once you've gone (no long walk through the walls)
      if (flat(I.pos, iloRoute[0]) > 30 && flat(I.pos, player.pos) > 50) I.pos.copy(iloRoute[0]);
    }
    // (her word not heard yet: she calls out as you come by, at the mouth or in the camps, once; issue #183)
    if (!iloCalled && quests.isDone('desert.ilo') && !game.flag('desert.ilo.told') && player.pos.y < 600 && flat(player.pos, I.pos) < 12) {
      iloCalled = true;
      I.shout = { text: '~shout~ You’re back! What’s down there?', until: I.time + 3 };
      I.waveOnce?.('desert.ilo.told');
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
  // (asked from the square in front of them, city.rootsLook; he turns to the bark itself, not to the spot he was asked from)
  thing(THINGS.roots, city.rootsLook, { range: 3.4, prompt: 'look at the roots', look: city.roots });
  // (no look at the giant's brow before its mouth: the only prompt there was one more button that added nothing, issue #155)
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
  // the tool pushes once the backpack is found and filled and the gun found (v1.38); before that, hands
  const toolHasPush = () => !!tool && (tool.owned ?? items.has('backpack')) && items.has('gun') && !dry();
  let dryT = -1e9;
  game.on('tool:dry', () => {
    if (st.clock - dryT < 25) return;
    dryT = st.clock;
    if (game.flag('tool.dregs') > 0) { toast('The last swallow in the tank is too little to push with. It will make one shot, no more.'); return; }   // (the dregs only shoot: src/fluid-tool.js)
    toast(open() ? 'The tank is empty. Wade into the giant’s pool to fill it.' : 'The tank is empty: dry glass, not a drop.');
  });

  // the Givers' House (src/temples/desert.js, remade in v1.44 for the blade) never asks for the gun, but its Keeper wants
  // water from your tank: walked in with an empty tank, you are told where to fill it (it once sent you for the gun)
  game.on('flag:temple.desert.entered', (v) => {
    if (!v) return;
    if (dry()) setTimeout(() => toast('Your tank is empty, and the Keeper deep in the Rose House will want water. Fill it at the giant’s pool past Qanat’s back gate.'), 2500);
  });

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
    const said = how === 'push' ? 'The fluid shoves the debris out of the drain. Water runs.' : 'You drag the debris out of the drain, armful by armful. Water runs.';
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
      if (!st.hinted) { st.hinted = true; toast(quietOr('The debris shifts, and settles.', `The debris shifts, and settles. It needs a shove. ${tr('teach.shove')}`)); }
      return true;
    } });
  void boneTarget;
  // E: what is clogging the drain, and a choice: remove it? (issue #158: no lever any more, "just have the player remove
  // the debris on his own"; the keepers' pole and the carved post are gone)
  registerInteractable({ id: 'bone', priority: PRIORITY.use, range: 4.2, at: () => cave.bone.position, enabled: () => !open(),
    prompt: 'look at the drain',
    distance: (p) => (p.pos.distanceTo(cave.origin) < 200 ? flat(p.pos, cave.bone.position) : Infinity),
    use: () => dialogue.start(THINGS.bone, null, cave.bone.position) });
  // Yes: you pull it clear (the conversation's answer emits it: desert-data.js THINGS.bone)
  game.on('desert:drain', () => { if (!open()) { st.wobble = 0.6; sound.thud?.(); clearChannel('hands'); } });
  // (a save from before, the keepers' pole in hand: put back, the lever gone; save-migrate.js step 18 does it too)
  if (quests.has('pole')) quests.take('pole');

  // the water: the pool, the stream, and up the roots (the tree drinks, and stays cold until it is lit)
  const applyWater = (instant) => {
    st.watered = true;   // (it climbs the roots while you watch: the 'rise' stage)
    if (instant) { st.level = cave.levels.high; st.flow = 1; st.boneT = 1; st.drink = 1; }
    else if (!st.boneT) st.boneT = 0.001;   // (the flag set some other way: the rib still rolls off)
    cave.setWater(st.flow, st.level);
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
  // nor do the tree's burning leaves (they glow: the square under them stays in the light, as drawn)
  if (city.foliage) (level.noShadow ??= []).push(city.foliage);
  city.setLit?.(st.fire);
  if (open()) applyWater(true);
  if (lit()) applyLit(true);
  game.on('flag:desert.channel.open', (v) => { if (v) applyWater(false); });

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
  // (the buttons as the player holds them: on a pad X is interact, the gun's mode is D-pad →: src/bindings.js)
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
        else if (addColour) toast('The water climbs into your tank. The tank takes its colours.');
        fillJar();
      }
    }
    wasIn = inPool;
  };

  film = setupDesertMoments(ctx, { cave, st, tool, moments, fillTank, fillJar, FILLED });

  // ---------------------------------------------------------------- the makers' shrine's door (issue #156)
  // A round shrine west of the pool keeps the lift valve's chest (src/desert-city.js SHRINE): its door is a slab of white
  // stone with a glass lens in it, dull until your tank is full; then it hums with your tank, and with E it drinks of it
  // and sinks into the floor. Until it is open the chest is out of sight and out of reach (no unopenable chest in view).
  const shrine = cave.shrine;
  const doorOpen = () => !!game.flag('desert.door.open');
  const tankFull = () => items.has('backpack') && !dry() && (!!game.flag('desert.pool.tinted') || open());
  const doorSt = { k: doorOpen() ? 1 : 0, opening: false };
  let doorHandle = null;
  if (shrine && physics?.addCollider) {
    const b = shrine.box, proxy = new THREE.Mesh(new THREE.BoxGeometry(b.size.x, b.size.y, b.size.z).translate(0, b.size.y / 2, 0));
    proxy.position.copy(b.at); proxy.rotation.y = b.yaw;
    if (!doorOpen()) doorHandle = physics.addCollider(proxy);
  }
  const layDoor = () => {
    if (!shrine) return;
    shrine.group.position.y = shrine.closedY - shrine.depth * THREE.MathUtils.smootherstep(doorSt.k, 0, 1);
    shrine.group.visible = doorSt.k < 1;
    const on = tankFull() && doorSt.k < 1;
    shrine.lit.visible = shrine.lines.visible = on;
    shrine.dull.visible = shrine.dullLines.visible = !on;
  };
  const openDoor = () => {
    if (doorOpen()) return;
    game.set('desert.door.open', true);
    doorSt.opening = true;
    if (doorHandle) { physics.removeCollider(doorHandle); doorHandle = null; }
    sound.rumble?.(1.8, 0.3); sound.chime?.();
    toast('The lens drinks from your tank, its lines light, and the door sinks into the floor.');
  };
  game.on('flag:desert.door.open', (v) => { if (v && doorSt.k < 1) { doorSt.opening = true; if (doorHandle) { physics.removeCollider(doorHandle); doorHandle = null; } } });
  if (shrine) {
    registerInteractable({ id: 'shrine.door', priority: PRIORITY.use, range: 3.2, at: () => shrine.box.at.clone().add(V(0, 1.75, 0)), enabled: () => !doorOpen(),
      prompt: () => (tankFull() ? 'open the makers’ door' : 'look at the makers’ door'),
      distance: (p) => (p.pos.distanceTo(cave.origin) < 200 ? flat(p.pos, shrine.front) : Infinity),
      use: () => { if (tankFull()) openDoor(); else toast('A makers’ door, a dull glass lens at its heart. It wants a full tank.'); } });
    layDoor();
  }
  st.door = doorSt;

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
  // the backpack found: its tank is empty (since v1.38 without the makers' dregs: no gun to shoot them with);
  // the giant's pool fills it for good (a new save; an older one carried a full tank already)
  game.on('box:opened', ({ item, id } = {}) => {
    if (item !== 'backpack') return;
    const empty = id === 'desert.backpack' && !open() && !game.flag('desert.pool.tinted');
    if (empty) game.set('tool.empty', true);
    if (empty) setTimeout(() => toast(dregsText()), 3200);
  });
  // the dregs spent: the tank is dry glass until the pool (once)
  game.on('tool:dregs', ({ left } = {}) => {
    if (left > 0 || game.flag('desert.dregs.spent')) return;
    game.set('desert.dregs.spent', true);
    setTimeout(() => toast('The makers’ last swallow, gone in one splash. The tank is dry glass now.'), 900);
  });
  // the ship wakes when Qanat has fed it; the quest ends once nothing the ship waits for is missing (its last step, the
  // Givers' blade and guard: src/story/leave-gate.js coreStage, issue #232), so a done quest always means it can fly
  const wake = (open) => {
    if (game.flag('ship.powered')) return;
    game.set('ship.powered', true);
    toast(open ? 'The ship hums awake. The galaxy is open.' : 'The ship hums awake.');
  };
  game.on('flag:desert.ship.fed', (v) => { if (v && missingCore('desert', (id) => quests.has(id)).length) wake(false); });
  quests.def('desert.power').onDone = () => {
    wake(true);
    game.set('world.desert.done', true);
    game.addKeepsake({ id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.' });
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('camps', () => camps.center);
  quests.locate('cityGate', () => city.gate);
  quests.locate('roots', () => city.rootsLook);
  quests.locate('caveIn', () => cave.inside);
  // the keepers' hatch in the back lane, where their stair from the cave comes up (the 'up' stage: src/desert-city.js HATCH)
  if (Q.hatch) quests.locate('hatch', () => Q.hatch.out);
  // out by the skull's mouth instead, the water climbing the roots while you watch passes the way up over
  game.on('flag:desert.well.watched', (v) => { if (v && quests.stage('desert.power') === 'up') quests.advance('desert.power', 'up'); });
  quests.locate('skull', () => Q.giant.door);
  quests.locate('bone', () => cave.bone.position);
  // the clogged drain (issue #158: no pole and post to go and find first)
  quests.locate('rib', () => cave.bone.position);
  // something faster than walking: Marrow until he has told you, then the hollow
  quests.locate('bikeWay', () => (['find', 'wake'].includes(quests.stage('desert.bike')) || game.flag('desert.bike.uncovered') ? hollow.site.bike : people.marrow.pos));
  quests.locate('bikeHollow', () => hollow.site.bike);   // (where that stage is done: the stage's `ends`, for the level design audit)
  quests.locate('pool', () => cave.poolCenter);
  if (shrine) quests.locate('shrineDoor', () => shrine.front);
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

  // ---------------------------------------------------------------- the dais: Qanat notices, and Nour calls out
  const say = (n, text, secs = 3) => { n.shout = { text, until: n.time + secs }; };
  const pick = (list, i) => list[i % list.length];
  const boxAt = ledge.box;
  const faceBox = (p) => Math.atan2(boxAt.x - p.x, boxAt.z - p.z);
  const sh = { noticed: false, gather: null, nour: null, timers: [] };
  const later = (secs, fn) => sh.timers.push({ at: secs, fn });
  const boxOpen = () => !!game.flag('box.desert.backpack') || items.has('backpack');
  // where Nour waits for you at the tree's foot, beside the dais, looking at the chest
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
    for (const n of [...villagers, people.hessa]) {
      if (flat(n.pos, boxAt) > 30) continue;
      const line = n === people.hessa ? '~shout~ Grandmother! The sky-stranger is at the chest!' : pick(MURMURS.near, k);
      later(0.3 + k++ * 0.9, () => say(n, line, 3));
    }
    crowd?.lookAt(boxAt.clone().setY(boxAt.y + 1), 6, { near: boxAt, r: 60 });
  };
  const gather = () => {
    // the chest is open: the tree flares, and only Nour gets up off her bench and calls out (the author's call,
    // October 2026: no crowd walking over, just her "hey you!"); she comes to the dais's side
    game.set('desert.shrine.gathered', true);
    sh.gather = { t: 0 };
    st.flare = Math.max(st.flare, 2.4);
    sound.chime?.();
    sh.nour = { t: 0, talked: false, mode: 'foot' };
    nour.seat = null;
    later(1.2, () => say(nour, MURMURS.nour[0], 3));
    nour.follow = nourToFoot;
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
    const onTerrace = Math.abs(pp.y - terraceY) < 1.2, up = !onTerrace && pp.y > terraceY;   // (up: climbed onto something by it, a root or the low arm)
    sh.up = up && dBox < 12;
    if (!sh.noticed && !boxOpen() && dBox < 13 && pp.y > terraceY - 1 && pp.y < boxAt.y + 2.5) notice();
    if (sh.gather) sh.gather.t += dt;
    const N = sh.nour;
    if (N) {
      N.t += dt;
      if (!N.talked) {
        // you're still up there: she waits at the foot and calls you down (once); you walked off: she waits
        // there too, where the marker finds her; you're down on the terrace near the tree: she comes to you
        const want = up || dBox > (N.mode === 'you' ? 16 : 12) ? 'foot' : 'you';
        if (want !== N.mode) { N.mode = want; nour.follow = want === 'foot' ? nourToFoot : nourToYou; }
        if (up && !N.called && N.t > 6 && dBox < 6) { N.called = true; say(nour, MURMURS.nour[0], 3.5); }
        // (she reaches you and waits by you, calling you over: the talk is yours to start, below)
      }
      if (N.talked && dBox > 30) nourHome();
    }
  };

  // ---------------------------------------------------------------- calling you over
  // whoever has something you need to hear doesn't start talking by themselves: once you're near, a word (a
  // balloon, said in their own voice) and a wave, Nour a little "psst" (sound.psst), and they turn to you. The
  // talk is yours to start, on the usual prompt. Once for each moment (`moment`: the flag desert.called.<who>.<moment>,
  // kept in the save), never on a loop (issue #79: "Psst. Child." every seven seconds until you came over).
  // (`max`: calls at most that many times, then leaves it to you: Ama and her jar)
  const calls = [];
  const calledFlag = (c) => (c.moment ? `desert.called.${c.n.def?.id ?? 'someone'}.${c.moment()}` : null);
  const live = (c) => c.when() && !(c.max && (c.calls ?? 0) >= c.max) && !(c.moment && game.flag(calledFlag(c)));
  const caller = (n, o) => {
    const c = { n, range: 16, every: 8, wait: 4, t: 4, k: 0, turn: null, ...o };
    calls.push(c);
    // while they call you, the prompt is theirs over anyone standing about them (the gathered villagers)
    const e = allInteractables().find((x) => x.npc === n && x.id?.startsWith('talk.'));
    if (e) Object.defineProperty(e, 'priority', { get: () => PRIORITY.talk + (live(c) ? 1 : 0), configurable: true });
    return c;
  };
  const called = (c) => { c.calls = (c.calls ?? 0) + 1; if (c.flag) game.set(c.flag, true); if (c.moment) { game.set(calledFlag(c), true); c.n.waveOnce?.(calledFlag(c), c.n.beckon); } };
  const updateCalls = (dt, pp) => {
    const busy = dialogue.open || !!moments?.playing || !!ctx.ship?.playing || !!ctx.ship?.busy?.() || !!ctx.ship?.cinema?.noticeBusy?.();   // (a call waits for the notices: issue #78)
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
  const marrowCall = caller(people.marrow, { lines: CALLS.marrow, range: 30, every: 9, wait: 2.5, moment: () => 'opening', when: () => opening() && people.marrow.route !== marrowHome,
    turn: (near) => { const m = people.marrow; if (m.route === marrowHome) return; m.facing = near ? Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z) : Math.atan2(hull.x - m.pos.x, hull.z - m.pos.z); } });
  // Nour, when she has a word for you: the chest opened (she has come over), or the tree drank and stays cold
  const nourHasWord = () => (sh.nour && !sh.nour.talked) || quests.stage('desert.power') === 'spark';
  // (not while you're up on something by the dais: she has called you down from there already)
  const nourCall = caller(nour, { lines: CALLS.nour, range: 15, every: 7, wait: 5, psst: true, moment: () => (sh.nour && !sh.nour.talked ? 'chest' : 'spark'), when: () => nourHasWord() && !sh.up });
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
  const hearth = setupHearth(ctx, { hasPush: () => toolHasPush() || (!!tool && !dry() && items.has('gun')), hasGun: () => items.has('gun'), lit });
  // the bowl, the camp and the bell on the long ride there (src/story/desert-way.js)
  const way = setupWay(ctx);
  const road = setupRoad(ctx);   // the pilgrims' road home, its lamps lit once the tree burns
  const giants = setupGiants(ctx);   // the verses at the giants out on the dunes (issue #167)
  const dunes = setupDunes(ctx);   // the walking dunes: this visit counted, the ruins that stand clear (issue #167)
  const water = setupWater(ctx);   // the qanat wells to listen at, the salt pan that floods when the tree drinks (issue #167)

  // the roots drink while you watch (pale motes climb the trunk), Hessa calls out, the tree stays cold
  const drinkAt = [0, 1, 2, 3, 4, 5].map((i) => { const a = i / 6 * Math.PI * 2; return city.treeBase.clone().add(V(Math.sin(a) * 4.2, 0.6, Math.cos(a) * 4.2)); });
  const motes = new Embers(scene, drinkAt, { count: 46, color: '#9ff0e6', rise: 2.6, life: 5, spread: 1.2, size: 0.22 });
  motes.mesh.visible = false;
  const rise = { on: false, t: 0, done: !!game.flag('desert.well.watched') };
  const RISE_T = 10;   // s: the water climbing the roots while you watch
  const startRise = () => {
    if (rise.on || rise.done) return;
    rise.on = true; rise.t = 0;
    sound.waterRise?.();
    later(1.0, () => say(people.hessa, '~shout~ Grandmother! The roots! They’re drinking!', 3));
  };

  // the stone in the roots: the spark runs up the roots and the trunk to the crown, and the tree catches
  const sparkM = makeMaterial({ color: '#fff6dc', glow: 1, flat: true });
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 1), sparkM);
  spark.visible = false; spark.userData.noCollide = true; spark.userData.dynamic = true;
  scene.add(spark);
  const sparkLight = new THREE.Vector4(0, -1e5, 0, 0);
  level.lights?.push(sparkLight);
  const LIGHT = { fly: 0.9, climb: 2.8, catch: 6 };   // s: the stone into the water, the spark up the trunk, the fire growing
  const lighting = { t: -1, from: V(0, 0, 0) };
  // (up the outside of the trunk on the avenue's side, where you see it climb, then into the crown)
  const toRoots = V(city.roots.x - city.treeBase.x, 0, city.roots.z - city.treeBase.z).normalize();
  const bark = (r, y) => city.treeBase.clone().addScaledVector(toRoots, r).add(V(0, y, 0));
  const sparkPath = [city.roots.clone(), bark(6.0, 1.4), bark(5.4, 7), bark(5.1, 15), bark(4.9, 23), bark(4.2, 30), city.crown.clone()];
  const sparkCurve = new THREE.CatmullRomCurve3(sparkPath);
  const setStone = () => {
    if (lit() || !quests.has('stone') || !open()) return;
    quests.take('stone');
    lighting.t = 0;
    // out of your pack: in your hand, held out over the water (it was never drawn while you carried it)
    const hand = player.humanoid?.b?.hand_r;
    if (hand && player.object?.visible !== false) hand.getWorldPosition(lighting.from);
    else lighting.from.copy(player.pos).add(V(0, 1.15, 0)).addScaledVector(V(city.roots.x - player.pos.x, 0, city.roots.z - player.pos.z).normalize(), 0.45);
    if (level.hearth) level.hearth.stone.userData.placing = true;
    game.set('desert.tree.lit', true);
    sound.chime?.();
    toast('You set the spark-stone in the wet roots. The living water draws it in, glowing…');
  };
  registerInteractable({ id: 'roots.stone', priority: PRIORITY.use + 1, range: 3.6, at: () => city.roots, enabled: () => quests.has('stone') && !lit(),
    prompt: () => (open() ? 'set the spark-stone in the roots' : 'look at the dry roots'),
    distance: (p) => (Math.abs(p.pos.y - city.roots.y) < 4 ? flat(p.pos, city.roots) : Infinity),
    use: () => { if (open()) setStone(); else toast('The roots are dry: the stone would only lie in the dust. The water must come up first.'); } });
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

    // the shrine's door: its lens lit with a full tank; opened, it sinks into the floor
    if (shrine) {
      if (doorSt.opening) { doorSt.k = Math.min(1, doorSt.k + dt / 1.8); if (doorSt.k >= 1) doorSt.opening = false; }
      layDoor();
    }
    // the channel: the debris is dragged aside, the stream runs, the pool rises and brightens
    if (st.boneT > 0 && st.boneT < 1) {
      st.boneT = Math.min(1, st.boneT + dt / 1.6);
      const k = THREE.MathUtils.smootherstep(st.boneT, 0, 1);
      cave.bone.position.lerpVectors(cave.boneRest.pos, cave.boneAside, k);
      // (the debris dragged off the trough and dumped beside it, a little lower: issue #157's heap, not a rolling bone)
      cave.bone.position.y += Math.sin(Math.PI * k) * 0.35 - 0.45 * k;
      cave.bone.rotation.set(cave.boneRest.rot.x, cave.boneRest.rot.y + k * 0.5, cave.boneRest.rot.z + Math.sin(Math.PI * k) * 0.12);
    } else if (st.boneT >= 1) {
      cave.bone.position.copy(cave.boneAside).add(V(0, -0.45, 0));
      cave.bone.rotation.set(cave.boneRest.rot.x, cave.boneRest.rot.y + 0.5, cave.boneRest.rot.z);
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
    // up the keepers' stair: you push the hatch up into the back lane, and it drops shut behind you
    if (Q.hatch && cave.stairTop) {
      if (pp.distanceTo(cave.stairTop) < 4) st.upT = st.clock;
      if (st.upT !== undefined && st.clock - st.upT < 4 && flat(pp, Q.hatch.out) < 3.5 && Math.abs(pp.y - Q.hatch.out.y) < 3) {
        st.upT = undefined;
        toast('You push up a heavy hatch into Qanat’s back lane, the tree ahead. It drops shut behind you: it only lifts from below.');
      }
    }
    const inCave = camPos.distanceTo(cave.origin) < 300;
    // the keepers' stair's fallen foot (v1.45, issue #68): said once, the first time you stand under it without the lift valve
    if (inCave && cave.stairFoot && !items.has('doublejump') && !game.flag('desert.stair.fallen') && flat(pp, cave.stairFoot) < 4 && Math.abs(pp.y - cave.stairFoot.y) < 2) {
      game.set('desert.stair.fallen', true);
      toast('The keepers’ stair has fallen at its foot. What still stands begins far over your head, and these walls give no grip.');
    }
    if (inCave) {
      // the same fluid as the tank: dull and slow while the channel is blocked, alive once the water runs
      st.poolT = (st.poolT ?? 0) + dt * (0.35 + 0.65 * st.drink);
      setMagic(cave.poolMat, st.poolT, { bright: 0.25 + 0.75 * st.drink, tones: st.drink > 0.5 ? 6 : 4 });
      if (st.flow > 0) setMagic(cave.streamMat, t * 2.2, { bright: 1, tones: 6 });
    }
    // the roots: once the water is up, you come and watch it climb them (the 'rise' stage), the tree drinking;
    // then, until it burns, they go on drinking (a few motes up the bark while you are near)
    if (open() && !rise.done && !rise.on && flat(pp, city.roots) < 14 && Math.abs(pp.y - city.roots.y) < 5) startRise();
    if (st.watered && flat(camPos, city.roots) < 250 && lighting.t < 0) {
      if (rise.on) {
        rise.t += dt;
        motes.mesh.visible = true;
        motes.rate = 1;
        motes.update(dt, t, null);
        if (rise.t > RISE_T) {
          rise.on = false; rise.done = true; rise.endT = st.clock;
          game.set('desert.well.watched', true);
          sound.chime?.();
          say(people.hessa, '~sad~ It’s drinking. It’s drinking, and the tree… Grandmother?', 3.5);
          later(2.2, () => say(nour, '~solemn~ Come here, child. Let an old woman tell you a story.', 3.5));
          toast('Living water climbs the roots, and the tree drinks it. It stands as cold as before.');
        }
      } else if (rise.done && !lit() && flat(camPos, city.roots) < 60) {
        motes.mesh.visible = true; motes.rate = 0.3; motes.update(dt, t, null);
      } else if (motes.mesh.visible) {
        motes.rate = 0.6; motes.update(dt, t, null);
        if (st.clock - (rise.endT ?? 0) > 6) motes.mesh.visible = false;
      }
    }

    // the musicians pick up your tune when you stand with them
    if (!st.drinking) sound.setBandMode('camp', flat(pp, fire) < 9 ? 'near' : 'play');
    updateProps(t, camPos);
    hollow.update(dt, t, camPos);
    drum.update(dt);
    mask.update(dt);
    hearth?.update(dt, t);
    way?.update(dt, t, camPos);
    road?.update(dt, t);
    water?.update(dt);
  };

  return {
    people, update, state: st, villagers, ledge: sh, repay, calls: { marrow: marrowCall, nour: nourCall, ama: amaCall }, hollow, drum, mask, hearth, way, road, giants, dunes, water, rise, lighting, setStone, applyLit, film,
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
