// What the play-through's agent (tests/playthrough-agent.js) needs to know of each world, world by world:
//
//   SOLVERS  'quest:stage' → (W, { issue, … }): a step the agent can't guess (a puzzle, a place to stand)
//   WAYS     'quest:stage' → { needs | any, how, check?, air? }: how a high or far objective is reached,
//            and with what; `check(W)` tries it for real and returns why not (or null)
//   CHECKS   'quest:stage' → (W) => why | null: what must hold when that step comes up
//   ACTIONS  the route's own steps between quests (hailing a cab)
//   ROUTE    each world's quests in the order a player plays them ({ temple: 'gadget' }: its temple that far)
//
// Anything not in WAYS must be walkable from the open ground round it, or a climb where climbing is allowed.
// tests/playthrough.test.js plays the route from a new game; tests/playthrough-saves.test.js resumes old
// saves with the same knowledge. docs/systems/testing.md has the whole of it.

import * as THREE from 'three';
const A = await import('./playthrough-agent.js');
const { game, items, V } = A;
const { windContains, windLift } = await import('../src/story/arzach.js');

export const SOLVERS = {}, WAYS = {}, CHECKS = {};
const bird = (W) => (W.player.mount?.kind === 'bird' ? W.player.mount : null);

// ------------------------------------------------------------------ the desert
Object.assign(SOLVERS, {
  // through the gate and up the stairs: inside the walls
  'desert.power:city': (W) => { W.at(W.level.qanat.city.plinthStair); W.step(3); },
  // the chest beside the pool (v1.38): the lift valve, the double jump; until then, one jump
  'desert.power:valve': (W, { issue }) => {
    if (A.abilities(W).doublejump) issue('ability', 'the double jump before the chest by the pool');
    A.openBox(W, 'desert.lift', issue);
    if (!A.abilities(W).doublejump) issue('ability', 'no double jump out of the chest by the pool');
  },
  // the Givers' chest in the Hearth's hall (v1.38): the fluid gun, which the ball's push wants
  'desert.power:gun': (W, { issue }) => {
    if (items.has('gun')) issue('ability', 'the gun before the Givers’ chest');
    W.at(W.level.hearth.inside); W.step(2);
    A.openBox(W, 'desert.gun', issue);
    if (!A.abilities(W).gun) issue('ability', 'no fluid gun to push with out of the Givers’ chest');
  },
  // the Hearth: the ball rolled down its groove by a push lifts the grille; up on the shelf, E takes the stone
  'desert.power:stone': (W, { issue }) => {
    const H = W.level.hearth;
    W.at(H.inside); W.step(2);
    const weight = A.allTargets().find((t) => t.kind === 'weight');
    if (!weight) return issue('no-thing', 'no stone ball to push');
    if (!A.abilities(W).gun) return issue('ability', 'the stone ball wants the gun’s push, and he has no gun (or an empty tank)');
    W.at(H.plinthFront); W.step(1);
    weight.onHit('push');
    W.step(30 * 6);
    if (!game.flag('desert.hearth.open')) return issue('soft-lock', 'the push did not lift the grille');
    W.at(H.shelfFront.clone().add(V(0, 0, -1.6)));
    A.useHere(W, 'hearth.stone');
  },
  // back to the ship (its hatch says so: src/ship/ship.js emits ship:enter), where Qanat waits with its gift:
  // one by one they pour what they brought into it (src/story/desert-repay.js), and the ship wakes
  'desert.power:ship': (W) => { W.at(W.level.ship.pos); game.emit('ship:enter', { level: 'desert' }); W.step(30 * 26); },
});
Object.assign(CHECKS, {
  // the spark-stone goes into the pack, and nothing floats about him
  'desert.power:light': (W) => (!W.quests.has('stone') ? 'the stone is not in the pack' : W.level.hearth.stone.visible ? 'the stone still shows in the world' : !W.quests.carried().length ? 'the gear lists nothing carried' : null),
});

// ------------------------------------------------------------------ Vael: the wind up the lone tower, the steps, the flute, the bird
/** A fresh traveller with what this one carries, jumping into the wind and holding jump: does it set him on the balcony? */
function rideTheWind(W) {
  const T = W.level.arzach.tower, wnd = W.world.wind;
  const P = new A.Player(W.physics, { health: false });
  P.respawn(wnd.foot.clone().add(V(0, 0.6, 0)));
  for (let i = 0; i < 60 * 45; i++) {
    P.update(1 / 60, { Space: i > 2 && i < 6 ? true : i > 30, ShiftLeft: i > 30 }, 0);   // jump, then hold it as you fall: the wings (with run held: with the jets owned, jump held alone fires them, v1.38)
    if (windContains(wnd, P.pos) && P.gliding) windLift(wnd, P, 1 / 60, T.balcony);
    if (P.onGround && Math.abs(P.pos.y - T.floor) < 1 && A.flat(P.pos, T) < 21) return P.pos.clone();
    if (P.onGround && i > 60 && P.pos.y < wnd.foot.y + 3 && !P.canGlide) return null;
  }
  return null;
}
/** Run at the next stone, jump, and jump again in the air (the double jump, if he carries the lift valve): does he land on it? */
function hop(W, from, to) {
  const P = new A.Player(W.physics, { unsafe: W.level.unsafe, health: false });   // (his items: the game's own, items.js)
  P.respawn(from.clone());
  P.heading = Math.atan2(to.x - from.x, to.z - from.z);
  let phase = 0;
  for (let i = 0; i < 360; i++) {
    const input = { KeyW: Math.hypot(to.x - P.pos.x, to.z - P.pos.z) > 0.6 };
    if (phase === 0 && i > 5) { input.Space = true; phase = 1; } else if (phase === 1 && !P.onGround && P.vel.y < 3) phase = 2; else if (phase === 2) { input.Space = true; phase = 3; }
    P.update(1 / 60, input, Math.atan2(to.x - P.pos.x, to.z - P.pos.z) + Math.PI);
    if (phase >= 2 && P.onGround && i > 30) break;
  }
  return Math.abs(P.pos.y - to.y) < 0.6 && Math.hypot(P.pos.x - to.x, P.pos.z - to.z) < 3.5;
}
const towerSteps = (W) => { const T = W.level.arzach.tower; return [V(T.x + Math.sin(1.25) * 17.5, T.floor, T.z + Math.cos(1.25) * 17.5), ...T.steps, T.sill]; };
Object.assign(WAYS, {
  // (the wings, in the wind; a save from before the reorder that has the jets may fly up on them)
  'arzach.bird:tower': { any: ['glider', 'jetpack'], how: 'the wind, on wings', check: (W) => (!items.has('glider') || rideTheWind(W) ? null : 'the wind does not carry him up to the balcony with what he has') },
  'arzach.bird:window': { needs: ['doublejump'], how: 'double jumps up the steps', check: (W) => { const p = towerSteps(W); for (let i = 0; i < p.length - 1; i++) if (!hop(W, p[i], p[i + 1])) return `step ${i + 1} round the tower is out of a double jump's reach`; return null; } },
  'arzach.bird:call': { needs: ['doublejump'], how: 'on the sill' },
  'arzach.bird:promise': { air: true, needs: [], how: 'she comes down to the balcony' },
});
Object.assign(SOLVERS, {
  'arzach.bird:tower': (W, { issue }) => {
    if (!items.has('glider') && items.has('jetpack')) { W.at(W.level.arzach.tower.balcony.clone()); W.step(3); return; }   // (up on the jets)
    const at = rideTheWind(W);
    if (!at) return issue('unreachable', 'the wind never set him on the balcony');
    W.at(at); W.step(3);
  },
  'arzach.bird:window': (W) => { W.at(W.level.arzach.tower.sill.clone()); W.step(2); A.useHere(W, 'flute'); },
  'arzach.bird:call': (W, { issue }) => {
    W.at(W.level.arzach.tower.sill.clone());
    const n = W.sound.tunes.length;
    A.useHere(W, 'whistle');
    if (W.sound.tunes.length === n) issue('sound', 'the flute played no tune');
  },
  // she comes down out of the haze to the balcony, and bows
  'arzach.bird:promise': async (W) => { for (let i = 0; i < 40 && !game.flag('arzach.bird.promise'); i++) { W.step(30); await A.sleep(5); } },
});
const birdShows = (W) => bird(W) && (!bird(W).dormant || bird(W).object.visible);
Object.assign(CHECKS, {
  // the bird is nowhere until her call is played, then she comes
  'arzach.bird:tower': (W) => (birdShows(W) ? 'the bird is there before her call' : null),
  'arzach.bird:call': (W) => (birdShows(W) ? 'the bird is there before her call' : !items.has('glider') && !items.has('jetpack') ? 'up the tower with neither wings nor jets' : null),
  'arzach.bird:promise': (W) => (!bird(W) || bird(W).dormant || !bird(W).object.visible ? 'the flute played, and still no bird' : null),
});

// ------------------------------------------------------------------ Vael II: the monastery and the floating island are the bird's
Object.assign(WAYS, {
  'arzach2.bell:monastery': { needs: ['bird'], how: 'on the bird, up the rose cliff' },
  'arzach2.bell:clapper': { needs: ['bird'], how: 'on the bird, out to the floating island' },
});
Object.assign(CHECKS, {
  'arzach2.bell:monastery': (W) => (!bird(W) ? 'no bird in Vael II' : bird(W).dormant ? 'the bird sleeps in Vael II' : null),
});

// ------------------------------------------------------------------ the City-Shaft: 600 m deep, the wings down and its air pillars up
/**
 * A fresh traveller with what this one carries, in one of the City-Shaft's air pillars (src/shaft-pillars.js): from its
 * foot (a jump: falling, the wings open by themselves) up to its top, then the stick toward `onto` (a point on the
 * ground) out of it, the wings folded once over it. Where he lands (on the ground within 6 m of it), or null.
 */
function ridePillar(W, id, onto) {
  const pillars = W.level.shaft.pillars, c = pillars.pillars.find((p) => p.id === id);
  const P = new A.Player(W.physics, { health: false, climb: false });
  P.respawn(V(c.x, c.foot + 0.3, c.z));
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  let phase = 'jump';
  for (let i = 0; i < 60 * 120; i++) {
    let input = {}, yaw = 0;
    if (phase === 'jump') { if (P.gliding) phase = 'up'; else if (i > 120) return null; else input = { Space: P.onGround && i % 12 < 4 }; }   // (a jump; falling, the wings open by themselves)
    else if (phase === 'up') { if (P.pos.y > c.top - 2) phase = 'off'; else if (P.onGround) return null; }
    else {
      if (P.onGround) return flat(P.pos, onto) < 6 && Math.abs(P.pos.y - onto.y) < 1 ? P.pos.clone() : null;
      // (the stick toward it while in the column, out of it; then the glide carries him over it, and the wings fold)
      if (flat(P.pos, onto) > 3.5) { input = { Space: true, KeyW: !!P.updraft && P.time - P.updraft.at < 0.2 }; yaw = toward(onto); }
    }
    P.update(1 / 60, input, yaw);
    pillars.carry(1 / 60, P);
  }
  return null;
}
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Where the spire's pillar lets you off: the palace landing beside it. */
const palaceLanding = (W) => { const S = W.level.shaft, c = S.pillars.pillars.find((p) => p.id === 'spire'); return V(Math.cos(c.a) * 44, S.places.palace.y, Math.sin(c.a) * 44); };
Object.assign(WAYS, {
  // (the drone's first find, Nima on the high terrace 50 m under the rim, is reached on foot from the ship,
  // down the red stair in the shaft's wall: no way declared; tests/incal-stair.test.js walks it, and glides it)
  // (the cabs don't stop in the depths: src/story/incal.js)
  'incal.light:down': { needs: ['glider'], how: 'gliding down the lamplighters’ drops, landing to landing' },
  'incal.light:ossa': { needs: ['glider'], how: 'gliding down the shaft' },
  // up: the spire's air pillar from the bottom viaduct to the palace landing, the crown's from the landing past the dome
  // (v1.42: no jets; tests/shaft-pillars.test.js rides them all)
  'incal.light:palace': { needs: ['glider'], how: 'up the spire’s air pillar to the palace landing',
    check: (W) => (ridePillar(W, 'spire', palaceLanding(W)) ? null : 'the spire’s air pillar does not set him on the palace landing') },
  'incal.light:look': { needs: ['glider'], how: 'up the crown’s air pillar, and down onto the crown',
    check: (W) => (ridePillar(W, 'crown', W.level.shaft.places.palace.crown) ? null : 'the crown’s air pillar does not set him on the dome’s crown') },
});
Object.assign(SOLVERS, {
  // stand on the palace's crown and look up at the Lodestar
  'incal.light:look': async (W) => {
    const S = W.level.shaft;
    W.at(S.places.palace.crown.clone()); W.look = S.incal.pos;
    for (let i = 0; i < 12 && !game.flag('incal.lit'); i++) { W.step(30); await A.sleep(5); }
    W.look = null;
  },
});
/** The cabs: without the pass a hail is refused (and the refusal starts Lio's errand); with it, a cab comes. */
const cabOf = (W) => W.level.vehicles?.find((v) => v.kind === 'taxi' && !v.free);
export const ACTIONS = {
  hailCab: (W, issue) => {
    const cab = cabOf(W);
    if (!cab) return issue('no-thing', 'no cab to hail');
    if (game.flag('item.cabpass')) return;
    if (!cab.refuses(W.player, 'hail')) issue('cab', 'a cab stopped for him without a pass');
    if (!W.quests.isStarted('incal.pass')) issue('soft-lock', 'a cab refused him, and nothing says where a pass comes from');
  },
  // Vael: Oïa, by the landing, opens the main quest and sends you up the standing stones to the Aerie for the wings
  meetOia: (W, issue) => {
    const r = A.talkTo(W, 'oia', A.goalOf(W, 'arzach.bird'));
    if (r.error) return issue('soft-lock', r.error);
    if (!W.quests.isStarted('arzach.bird')) issue('soft-lock', 'talking to Oïa by the landing started nothing');
    if (!r.said.some((t) => /white streamer/.test(t))) issue('lead', 'Oïa did not point the way to the Aerie');
  },
  // Vael: with the bird's promise kept, the scout leads over the plain to the riders' gate at its edge, then on over the
  // cloud to Sister Aube, who opens the bell's quest (src/vael-crossing.js, src/story/arzach2.js aubeWay)
  crossGate: (W, issue) => {
    const gate = W.quests.resolve('gate');
    if (!gate) return issue('lead', 'no riders’ gate in Vael');
    const o = W.quests.objective();
    if (!o || !/riders’ gate/.test(o.label) || o.position.distanceTo(gate) > 3) issue('lead', `from the tower the scout finds ${o ? `“${o.label}”` : 'nothing'}, not the riders’ gate`);
    W.at(gate.clone()); W.step(2);
    const o2 = W.quests.objective();
    if (!o2 || /riders’ gate/.test(o2.label)) issue('lead', 'at the riders’ gate the scout does not move on to Sister Aube');
  },
  cabTakesYou: (W, issue) => {
    const cab = cabOf(W);
    if (cab && cab.refuses(W.player, 'hail')) issue('cab', 'with the pass, the cabs still refuse him');
  },
};

// ------------------------------------------------------------------ the Garden of Spheres: splash each sphere that remembers
Object.assign(SOLVERS, {
  'spheres.listen:listen': (W, { issue }) => {
    for (const s of W.world.listeners) {
      if (game.flag(`spheres.heard.${s.id}`)) continue;
      // (from the dry ground beside it, on the side facing the start)
      const d = V(-s.o.x, 0, -s.o.z).normalize(), x = s.o.x + d.x * (s.o.R + 5), z = s.o.z + d.z * (s.o.R + 5);
      const by = A.standNear(W, V(x, W.physics.groundAt(x, 60, z, 120), z));
      if (!by) issue('no-ground', `nowhere dry to stand beside the ${s.id} sphere`); else W.at(by);
      const t = A.allTargets().find((x) => x.kind === 'orb' && x.orb === s.o);
      if (!t) { issue('no-thing', `the ${s.id} sphere is not a target`); continue; }
      t.onHit('shoot', t.position().clone());
      W.step(3);
    }
  },
});

// ------------------------------------------------------------------ the Signal Market: the antenna's bulbs, shot from the broadcast balcony
/** From the console's balcony, is every bulb in sight and in a shot's reach? */
function bulbsInSight(W) {
  const bulbs = A.allTargets().filter((t) => t.kind === 'bulb');
  if (bulbs.length !== 3) return `${bulbs.length} bulbs on the antenna`;
  const from = A.standNear(W, A.objectiveAt(W, 'console') ?? bulbs[0].position(), { radius: 6, up: 6 });
  if (!from) return 'nowhere to stand on the balcony under the antenna';
  const eye = from.clone().add(V(0, 1.5, 0));
  for (const b of bulbs) {
    const to = b.position().clone().sub(eye), d = to.length();
    if (d > 60) return `a bulb is ${d.toFixed(0)} m from the balcony`;
    if (W.physics.rayDistance(eye, to.normalize(), d - 1) < d - 1.2) return 'a bulb is hidden from the balcony';
  }
  return null;
}
Object.assign(WAYS, {
  'bazaar.signal:tune': { air: true, needs: ['gun'], how: 'shot from the broadcast balcony', check: bulbsInSight },
});

// ------------------------------------------------------------------ the three worlds that joined the route in v1.40
// Each one's thread is its temple; on the way the agent runs the world's two errands, as a player meeting its people
// would (each started by talking to its giver: the act), so the route walks the world from its landing to its temple.
/** Talk to `who` with quest `qid` as the goal (it starts the errand): an act of the route. */
const meet = (who, qid) => (W, issue) => {
  const r = A.talkTo(W, who, A.goalOf(W, qid));
  if (r.error) return issue('soft-lock', r.error);
  if (!W.quests.isStarted(qid)) issue('soft-lock', `talking to ${who} did not start ${qid}`);
};
Object.assign(WAYS, {
  // (the Underwater City's Crown is up the lift in the Plaza's column: a doorway, src/levels/underwater.js level.portals)
  'underwater.kelp:lift': { needs: [], how: 'up the lift in the Plaza’s column' },
  'underwater.kelp:fabre': { needs: [], how: 'in the Crown, up the lift' },
  // (the Moon Foundry's lookout is on the pillar under the moon on its pillar: up its rungs, 31 m)
  'moonfoundry.count:climb': { needs: [], how: 'up the pillar’s rungs to the lookout' },
  // (the floating city's crow's nest is up the Balcony's lamp-mast, by its rungs)
  'spacecity.lamp:hang': { needs: [], how: 'up the lamp-mast’s rungs' },
});
Object.assign(SOLVERS, {
  // up the lift: through the doorway at the column's foot, out at its head in the Crown
  'underwater.kelp:lift': (W, { issue }) => {
    const lift = W.level.portals?.find((pt) => /up to the Crown/.test(pt.label ?? ''));
    if (!lift) return issue('no-thing', 'no lift in the column');
    W.at(lift.at.clone()); W.step(3);
    W.at(lift.to.clone()); W.step(3);
  },
  // the crow's nest: climbed (the agent stands where the rungs come out)
  'spacecity.lamp:hang': (W, { issue }) => {
    const at = A.objectiveAt(W, 'mast');
    if (!at) return issue('no-thing', 'no crow’s nest');
    const s = A.standNear(W, at, { radius: 2.2, up: 2 });
    if (!s) return issue('no-ground', 'nowhere to stand in the crow’s nest');
    W.at(s); W.step(3);
  },
  // the lookout: climbed (the agent stands where the climb comes out)
  'moonfoundry.count:climb': (W, { issue }) => {
    const at = A.objectiveAt(W, 'lookout');
    if (!at) return issue('no-thing', 'no lookout');
    const s = A.standNear(W, at, { radius: 6, up: 3 });
    if (!s) return issue('no-ground', 'nowhere to stand on the lookout');
    W.at(s); W.step(3);
  },
});
Object.assign(ACTIONS, {
  meetMireille: meet('mireille', 'underwater.kelp'),
  meetFabre: meet('fabre', 'underwater.lamps'),
  meetWen: meet('wen', 'moonfoundry.count'),
  meetOttilie: meet('ottilie', 'moonfoundry.hook'),
  meetSel: meet('sel', 'spacecity.notes'),
  meetKip: meet('kip', 'spacecity.lamp'),
});

// ------------------------------------------------------------------ the route
export const ROUTE = [
  { id: 'desert', play: ['desert.power'] },
  // (Oïa sits by the landing and opens the main quest: she points the way to the Aerie for the wings, then the tower)
  // (since October 2026 Vael carries the sky stones, Lorn the Deep Wood: each part's main quest in turn; src/levels/names.js PARTS)
  { id: 'arzach', play: [{ act: 'meetOia', at: 'oia', label: 'Oïa, by the landing' }, { temple: 'gadget' }, 'arzach.bird', { act: 'crossGate', at: 'gate', label: 'the riders’ gate' }, 'arzach2.bell'] },
  { id: 'perdide', play: ['perdide.crystal', 'perdide2.lamps'] },
  { id: 'edena', play: ['edena.garden'] },
  // (v1.40: the city under glass: the Garden's cutting up the lift to the Crown, Fabre's word down to the Whale Gallery, then the Whale-House)
  { id: 'underwater', play: [{ act: 'meetMireille', at: 'mireille', label: 'Mireille, in the kelp garden' }, 'underwater.kelp', { act: 'meetFabre', at: 'fabre', label: 'Fabre, in the Crown' }, 'underwater.lamps', { temple: 'done', id: 'underwater' }] },
  { id: 'incal', play: [{ temple: 'gadget' }, 'incal.light', { act: 'hailCab' }, 'incal.pass', { act: 'cabTakesYou' }] },   // the bellows, the light (the air pillars up), the pass
  // (the Glass Dunes in the Sealed Hangar's slot: its thread is the Clock-House, the Hangar's temple, to its guardian)
  { id: 'glassdunes', play: [{ temple: 'done', id: 'garage', home: 'the float-posts' }] },
  { id: 'buried', play: ['buried.tooth'] },
  // (v1.40: the foundry: Ottilie's hook to Bertil at the furnace, Wen's count from the pillar's lookout, then the Casting-House)
  { id: 'moonfoundry', play: [{ act: 'meetOttilie', at: 'ottilie', label: 'Ottilie, in the quarter' }, 'moonfoundry.hook', { act: 'meetWen', at: 'wen', label: 'Wen, in the broken moon' }, 'moonfoundry.count', { temple: 'done', id: 'moonfoundry' }] },
  { id: 'spheres', play: ['spheres.listen'] },
  // (v1.40: the floating city: Kip's lamp up the Balcony's mast, Sel by its foot with her notes for Tamar on the Towers, then
  // the Mooring-House north of the Towers)
  { id: 'spacecity', play: [{ act: 'meetKip', at: 'kip', label: 'Kip, on the Market Bridge' }, 'spacecity.lamp', { act: 'meetSel', at: 'sel', label: 'Madame Sel, on the Balcony' }, 'spacecity.notes', { temple: 'done', id: 'spacecity' }] },
  { id: 'bazaar', play: ['bazaar.signal'] },
];

// the sub-levels (src/levels/names.js SUB): reached from a route world's quest, not by the ship; the level design audit
// walks them from where you arrive (?from=<world>) to where you leave, by the quest's steps there (the night mail aboard
// the Overnight Train: Ambrose on the porch, Solange on the last roof, Ambrose again, the step down at the halt)
export const SUBROUTES = [
  { id: 'overnighttrain', from: 'bazaar', play: [{ act: 'askAmbrose', at: 'ambrose', label: 'Ambrose, the conductor' }, { act: 'letter', at: 'mireille', label: 'Solange, on the last roof' },
    { act: 'askStop', at: 'ambrose', label: 'Ambrose, asked to stop' }, { act: 'stepOff', at: 'stepOff', label: 'the step down at the halt' }] },
];

/** A step that asks, in its own words, for a way of getting about must come when he has it. */
export const SAYS = [
  [/\bjets?\b|jetpack/i, 'jetpack'],   // (not RT / R2 alone: it is also the shot)
  [/\bwings\b|glide/i, 'glider'],
  [/\b(ride|riding) the bird\b|\bon the bird\b/i, 'bird'],
  [/\b(cab|taxi)s?\b/i, 'cab'],
];
export const each = (W, st, qid) => {
  const means = A.owned(W), lacks = SAYS.filter(([re, m]) => re.test(st.text) && !means.includes(m) && !(m === 'cab' && qid === 'incal.pass')).map(([, m]) => m);
  return lacks.length ? `it says to use ${lacks.join(', ')}, which he does not have yet: “${st.text}”` : null;
};
/** Where each way of getting about is first had, by the route: nobody arrives anywhere before it with it. */
export const FIRST = { glider: 'arzach', bird: 'arzach', cab: 'incal' };   // (the jets: a debug item since v1.38, and the City-Shaft's own harness went in v1.42)   // (the double jump and the gun: the desert's own, checked by its steps)
export const before = (a, b) => A.ORDER.indexOf(a) < A.ORDER.indexOf(b);
