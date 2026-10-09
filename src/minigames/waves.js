// Ink tide (docs/systems/minigames.md): a round basin of sand in a sea of ink, and the ink keeps coming.
// Played on foot with the blade (attack RB / R1, guard LB / L1, evade B / ○) and the fluid gun (aim LT / L2,
// fire RT / R2): endless waves of the game's foes (src/foes.js: ink blots, spitters, swarms, winged blots,
// shades, the makers' machines; from wave 7 the worlds' own, src/foe-kinds.js: sign moths, dune rays, root
// stalkers, salt crabs, rust drones, slag walkers, glass golems, shadow hounds) out of the ink springs round
// the rim, more of them and more kinds as the waves go on. Between two waves a breather: some health back, and three small boons on the sigil in the
// middle (a longer blade, a deeper tank, quicker refills…): walk onto the one you want. The score is the
// waves cleared and the style of the fight (cuts in quick succession, perfect parries and dodges, a wave untouched).
// The Gentle enemies setting makes the waves smaller (and the foes slower, softer: src/foes.js GENTLE).
//
// The rules are pure (waveKinds, heads, chainMult, killPoints, boonChoice, boonTunings, tideScore:
// tests/minigames-waves.test.js); the basin and the breather are drawn here.

import * as THREE from 'three';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { waveWords } from '../foes.js';
import { BLADE, EVADE, GUARD } from '../fluid-blade.js';
import { FALL } from '../player.js';
import { MAGIC } from '../resources.js';
import { arenaLevel } from './kit/world.js';
import { lendTool, standAt, tune } from './kit/onfoot.js';
import { WorldLabels } from './kit/labels.js';

// ------------------------------------------------------------------ the rules (pure)
export const TIDE = {
  wavePoints: 150,       // each wave cleared
  untouched: 100,        // a wave cleared without a hurt
  parry: 30, block: 5,   // a perfect parry, a plain block
  dodge: 15,             // a perfect dodge: an evade whose i-frames swallowed a blow (src/fluid-blade.js)
  chainFor: 3,           // s: a cut down this soon after the last keeps the chain
  chainStep: 0.25, chainMax: 3,
  breather: 14,          // s at most to pick a boon before the next wave comes anyway
  after: 2.6,            // s from a boon taken to the next wave
  heal: 1,               // hearts back at each wave's end
  mend: 0.1,             // hearts a second each Second wind lends back (FALL.regen: none in the world)
  arena: 17,             // m: the basin's floor; the springs a little in from its rim
};
/**
 * What each foe costs a wave's budget, and the wave it first comes in. Some come as a group for one cost (GROUP:
 * a swarm is five little blots, sign moths three, shadow hounds two). After the shade (wave 6) one of the worlds'
 * own kinds comes in every wave or two, the plain ones first: all of them work on the basin's sand (a ray swims
 * under it), drones hover over it, and the hounds run as shadows between the pillars' long evening ones.
 */
export const COST = { blot: 1, spitter: 1.5, swarm: 2, flyer: 2, shade: 3, machine: 3.5, moth: 2.4, ray: 2, stalker: 2.5, crab: 2.5, drone: 2.5, lizard: 2.6, slag: 3.5, golem: 4, tripod: 3.2, hound: 3 };
export const FIRST = { blot: 1, spitter: 2, swarm: 3, machine: 4, flyer: 5, shade: 6, moth: 7, ray: 8, stalker: 9, crab: 11, drone: 12, lizard: 13, slag: 14, golem: 15, tripod: 16, hound: 17 };
export const GROUP = { swarm: 5, moth: 3, hound: 2, lizard: 2 };
/** Style points for each foe cut down (before the chain's multiplier). */
export const KILL = { blot: 10, spitter: 15, swarm: 4, flyer: 20, shade: 30, machine: 40, moth: 8, ray: 25, stalker: 25, crab: 30, drone: 30, lizard: 22, slag: 35, golem: 45, tripod: 35, hound: 18 };
/** How many a foe puts on the floor, for the crowd's cap (a swarm's little blots don't count). */
export const heads = (k) => (k === 'swarm' ? 0 : 1);

/** How much a wave may hold: grows by one and a half blots a wave (gentle: seven tenths). */
export const waveBudget = (n, gentle = false) => (2 + 1.6 * (n - 1)) * (gentle ? 0.7 : 1);

/** The crowd's cap for wave n: how many may be standing (heads) at once. */
export const waveCap = (n, gentle = false) => (gentle ? 5 + Math.floor(n / 4) : 6 + n);

/**
 * The foes of wave n (1, 2, …): the kind that is new this wave first, then picked at random among those
 * come in so far, the bigger ones more likely the further on (one of the worlds' kinds come in within the last
 * two waves a little likelier still), until the budget is spent or the crowd is full (waveCap: heads). A list of
 * kinds, a group kind as many times as GROUP says (a swarm is five 'swarm'). Gentle: smaller waves, at first
 * never more than five foes standing at once (bar a swarm; a golem counts as its splinters).
 */
export function waveKinds(n, { gentle = false, rng = Math.random } = {}) {
  const kinds = Object.keys(FIRST).filter((k) => FIRST[k] <= n);
  const fresh = kinds.find((k) => FIRST[k] === n);
  let budget = waveBudget(n, gentle), standing = 0;
  const out = [], cap = waveCap(n, gentle);
  const size = (k) => GROUP[k] ?? 1, load = (k) => heads(k) * size(k);
  const put = (k) => { budget -= COST[k]; standing += load(k); out.push(...Array(size(k)).fill(k)); };
  if (fresh && COST[fresh] <= budget + 1 && standing + load(fresh) <= cap) put(fresh);
  for (let guard = 0; guard < 60 && budget >= 1 - 1e-9; guard++) {
    const can = kinds.filter((k) => COST[k] <= budget + 1e-9 && standing + load(k) <= cap);
    if (!can.length) break;
    // the further on, the heavier the mix (weights: blots fade, the big ones grow; the newest kinds come back)
    const w = can.map((k) => (k === 'blot' ? Math.max(0.6, 3 - n * 0.25) : (1 + n * 0.12 * COST[k]) * (FIRST[k] > 6 && n - FIRST[k] <= 2 ? 1.5 : 1)));
    let x = rng() * w.reduce((a, b) => a + b, 0), pick = can[0];
    for (let i = 0; i < can.length; i++) { if ((x -= w[i]) <= 0) { pick = can[i]; break; } }
    put(pick);
  }
  if (!out.length) out.push('blot');
  return out;
}

/** The chain's multiplier: ×1, then a quarter more for each foe cut down in quick succession, up to ×3. */
export const chainMult = (chain, T = TIDE) => Math.min(T.chainMax, 1 + T.chainStep * Math.max(0, chain - 1));

/** The style of a foe cut down: its points × the chain (with the chain as it is after this one). */
export const killPoints = (kind, chain, T = TIDE) => Math.round((KILL[kind] ?? 10) * chainMult(chain, T));

/** The run's score: the waves cleared and the style. */
export const tideScore = ({ waves = 0, style = 0 } = {}, T = TIDE) => waves * T.wavePoints + style;

/** The boons: each can be taken a few times (max); `text` says what it does. */
export const BOONS = [
  { id: 'reach', name: 'Longer blade', text: 'cuts reach a fifth further', max: 3, color: '#71d7cf' },
  { id: 'ink', name: 'Deeper well', text: 'a longer magic bar', max: 3, color: '#52c8cf' },
  { id: 'refill', name: 'Quick refill', text: 'the magic bar fills sooner', max: 3, color: '#966ede' },
  { id: 'heavy', name: 'Heavy hand', text: 'every cut hits harder', max: 2, color: '#ef7e62' },
  { id: 'mend', name: 'Second wind', text: 'all your hearts back now, and they mend slowly', max: 3, color: '#83cf71' },
  { id: 'feet', name: 'Light feet', text: 'evade sooner and further', max: 2, color: '#f6c84e' },
  { id: 'parry', name: 'Keen guard', text: 'a wider moment to parry', max: 2, color: '#ed80b0' },
  // (only once the moths are about, and the drones and stalkers to come: from the moths' wave)
  { id: 'eyes', name: 'Steady eyes', text: 'flashes blind you less, lines and roots let go sooner', max: 2, color: '#f2f0e4', from: 7 },
];
export const boonById = (id) => BOONS.find((b) => b.id === id) ?? null;

/**
 * Three different boons to choose from (fewer when most are taken to the full): taken { id: count }; wave: the
 * wave just cleared (a boon with `from` is offered only once that wave is reached).
 */
export function boonChoice(taken = {}, rng = Math.random, n = 3, wave = Infinity) {
  const open = BOONS.filter((b) => (taken[b.id] ?? 0) < b.max && (b.from ?? 0) <= wave).map((b) => b.id);
  const out = [];
  while (out.length < n && open.length) out.push(open.splice(Math.floor(rng() * open.length), 1)[0]);
  return out;
}

/** What the boons taken make of the tunings (base: the game's own, src/fluid-blade.js, src/player.js, src/fluid-tool.js). */
export function boonTunings(taken = {}, base = { reach: BLADE.reach, length: BLADE.length, damage: BLADE.damage, charges: MAGIC.start, delay: MAGIC.delay, rate: MAGIC.start / MAGIC.fill, regen: FALL.regen, wait: FALL.wait, cooldown: EVADE.cooldown, speed: EVADE.speed, perfect: GUARD.perfect, blind: 1, hold: 1 }) {
  const n = (id) => taken[id] ?? 0;
  return {
    reach: base.reach * 1.2 ** n('reach'), length: base.length * 1.15 ** n('reach'),
    damage: base.damage.map((d) => d + 0.5 * n('heavy')),
    charges: base.charges + n('ink'), delay: base.delay * 0.7 ** n('refill'), rate: (base.rate ?? MAGIC.start / MAGIC.fill) * 1.3 ** n('refill'),
    regen: base.regen + TIDE.mend * n('mend'), wait: base.wait / (1 + 0.5 * n('mend')),
    cooldown: base.cooldown * 0.75 ** n('feet'), speed: base.speed * (1 + 0.12 * n('feet')),
    perfect: base.perfect * (1 + 0.5 * n('parry')),
    blind: (base.blind ?? 1) * 0.55 ** n('eyes'), hold: (base.hold ?? 1) * 0.6 ** n('eyes'),   // (shares of a flash's white, of a hold's time)
  };
}

// ------------------------------------------------------------------ the basin
const INK = '#2b211f';
/** The basin's height: a flat floor, a low rim, the shore down into the ink. */
export function basinHeight(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const ripple = 0.08 * Math.sin(x * 0.7) * Math.sin(z * 0.6);
  if (r < 18) return ripple * (r / 18);
  if (r < 21.5) { const k = (r - 18) / 3.5; return ripple * (1 - k) + (0.9 + 0.25 * Math.sin(a * 5)) * Math.sin(k * Math.PI / 2) ** 2; }
  const k = Math.min(1, (r - 21.5) / 5);
  return (0.9 + 0.25 * Math.sin(a * 5)) * (1 - k) - 1.8 * k * k;   // (the shore, down under the ink)
}
/** The four ink springs round the floor, where the foes come up. */
export const SPRINGS = [0.35, 1.95, 3.5, 5.0].map((a) => new THREE.Vector3(Math.cos(a) * 15.5, 0, Math.sin(a) * 15.5));

function* buildTide(scene) {
  const terrain = yield* Terrain.make({
    size: 120, seg: 120, height: basinHeight,
    material: { color: '#e9cf9e', color2: '#f2dfb8', color3: '#c9a27e', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const stone = makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66', mode: MODE_STRATA, strataSize: 1.2 });
  const ink = makeMaterial({ color: '#2a2440', flat: true }), inkLite = makeMaterial({ color: '#4a3d6e', flat: true, glow: 0.25 });
  const group = new THREE.Group();
  // the ink sea all round, and its tide line (it rises with a wave)
  const sea = new THREE.Mesh(new THREE.RingGeometry(22, 200, 128, 1).rotateX(-Math.PI / 2), ink);
  sea.position.y = -0.9; sea.userData.noCollide = true; group.add(sea);
  const foam = new THREE.Mesh(new THREE.RingGeometry(24.2, 24.6, 128, 1).rotateX(-Math.PI / 2), inkLite);
  foam.position.y = -0.85; foam.userData.noCollide = true; group.add(foam);
  // the tide's lines out on the ink: pale rings that close in on the basin while a wave is on
  const lines = [];
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.995, 1, 160, 1).rotateX(-Math.PI / 2), inkLite); m.position.y = -0.86; m.userData.noCollide = true; m.userData.r = 28 + i * 9; group.add(m); lines.push(m); }
  // broken pillars to fight round (solid), drums fallen beside them
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.6, r = 9.5 + (i % 2) * 2.2, h = 2.2 + (i * 1.7) % 2.6;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, h, 9), stone);
    p.position.set(Math.cos(a) * r, h / 2 - 0.1, Math.sin(a) * r); p.rotation.z = (i % 3 - 1) * 0.04; group.add(p);
    if (i % 2 === 0) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.1, 9), stone); d.rotation.z = Math.PI / 2; d.rotation.y = a; d.position.set(Math.cos(a + 0.25) * (r + 1.6), 0.7, Math.sin(a + 0.25) * (r + 1.6)); group.add(d); }
  }
  // the springs: a dark pool ringed with stones
  for (const s of SPRINGS) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24).rotateX(-Math.PI / 2), ink); pool.position.set(s.x, basinHeight(s.x, s.z) + 0.03, s.z); pool.userData.noCollide = true; group.add(pool);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.2, 5, 18).rotateX(Math.PI / 2), stone); lip.position.copy(pool.position); lip.userData.noCollide = true; group.add(lip);
  }
  // the sigil in the middle, where the boons rise: rings and three spokes, drawn in ink on the sand
  const sig = makeMaterial({ color: '#5b4a7a', flat: true });
  for (const [r0, r1] of [[5.6, 5.8], [3.2, 3.32], [0.6, 0.72]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72).rotateX(-Math.PI / 2), sig); m.position.y = 0.04; m.userData.noCollide = true; group.add(m); }
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4.9).rotateX(-Math.PI / 2), sig); const a = (i / 3) * Math.PI * 2; m.rotation.y = a; m.position.set(Math.sin(a) * 3.2, 0.045, Math.cos(a) * 3.2); m.userData.noCollide = true; group.add(m); }
  // far off: needles of rock standing out of the ink
  const rocks = [];
  for (let i = 0; i < 9; i++) { const a = i * 2.39 + 0.4, r = 60 + (i * 17) % 40, h = 7 + (i * 7) % 14; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.8 + (i % 3), 2 + (i % 4), h, 7), stone); m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); rocks.push(m); }
  for (const r of rocks) { r.userData.noCollide = true; group.add(r); }
  scene.add(group);
  yield;
  return arenaLevel({
    ground: terrain, name: 'The ink tide', hour: 17.4,
    spawn: new THREE.Vector3(0, 0, 4),
    features: { mount: false, wind: false, jetpack: false, climb: true },
    foes: { own: true, wild: false, noInk: true, chimes: false },   // (src/foes.js: on whatever the setting, added by the game, no ink for the blade's growth, no chimes: src/chimes.js)
    tide: { sea, foam, lines },
  });
}

// ------------------------------------------------------------------ a run
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function boonModel(def) {
  const g = new THREE.Group();
  const stone = makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66', mode: MODE_STRATA, strataSize: 0.6 });
  const glow = makeMaterial({ color: def.color, flat: true, glow: 0.9 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.7, 8), stone); plinth.position.y = 0.35;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glow); gem.position.y = 1.35;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 24), glow); ring.position.y = 1.35; ring.rotation.x = Math.PI / 2;
  const pad = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 32).rotateX(-Math.PI / 2), glow); pad.position.y = 0.05;
  g.add(plinth, gem, ring, pad);
  g.traverse((o) => { o.userData.noCollide = true; });
  return Object.assign(g, { gem, ring });
}

function start(ctx) {
  const { player, camera, level, sfx, sound, tool, foes, rig } = ctx;
  const giveBack = lendTool(tool, { max: MAGIC.start, delay: MAGIC.delay, rate: MAGIC.start / MAGIC.fill, mode: null });
  standAt(player, new THREE.Vector3(0, 0, 4), Math.PI, rig, 0);
  const words = new WorldLabels(camera);
  const gentle = foes?.difficulty !== 'normal';
  const run = { wave: 0, cleared: 0, style: 0, kills: 0, chain: 0, lastKill: -99, bestChain: 0, parries: 0, untouched: 0, taken: {}, hurtAt: player.hurtAt ?? -1e9 };
  const base = { reach: BLADE.reach, length: BLADE.length, damage: BLADE.damage.slice(), charges: MAGIC.start, delay: MAGIC.delay, rate: MAGIC.start / MAGIC.fill, regen: FALL.regen, wait: FALL.wait, cooldown: EVADE.cooldown, speed: EVADE.speed, perfect: GUARD.perfect, blind: 1, hold: 1 };
  // (the tunings as they were: put back at the end, whatever the boons did)
  const keep = [tune(BLADE, { reach: BLADE.reach, length: BLADE.length, damage: BLADE.damage }), tune(EVADE, { cooldown: EVADE.cooldown, speed: EVADE.speed }), tune(GUARD, { perfect: GUARD.perfect }), tune(FALL, { regen: FALL.regen, wait: FALL.wait })];
  let phase = 'rest', restT = 1.2, t = 0, mine = [], boons = [], deadT = 0, over = false;
  const sea = level.tide?.sea, foam = level.tide?.foam;

  let steady = { blind: 1, hold: 1 };   // (Steady eyes: a flash's white and a hold's time, cut as they land)
  function apply() {
    const T = boonTunings(run.taken, base);
    steady = { blind: T.blind, hold: T.hold };
    BLADE.reach = T.reach; BLADE.length = T.length; BLADE.damage = T.damage;
    EVADE.cooldown = T.cooldown; EVADE.speed = T.speed; GUARD.perfect = T.perfect;
    FALL.regen = T.regen; FALL.wait = T.wait;
    giveBack.set({ max: T.charges, delay: T.delay, rate: T.rate }); tool?.reserve?.fill();
  }
  apply();

  // Steady eyes: the white of a flash and the time of a line or a grip, cut as the foes land them
  const blind0 = foes?.blind, strike0 = foes?.strike;
  if (blind0) foes.blind = (s, tone) => blind0.call(foes, s * steady.blind, tone);
  if (strike0) foes.strike = (f, a) => {
    const held = foes.hold, r = strike0.call(foes, f, a);
    if (foes.hold && foes.hold !== held) foes.hold.t *= steady.hold;
    return r;
  };

  // the guard heard: a perfect parry and a plain block are style too
  const guard0 = player.guard;
  if (guard0) player.guard = (from) => {
    const r = guard0.call(player, from);
    if (r === 'perfect' && phase === 'fight') { run.parries++; addStyle(TIDE.parry, 'Parry!', from); }
    else if (r && phase === 'fight') addStyle(TIDE.block, null, from);
    return r;
  };
  // the evade heard: a blow its i-frames swallowed (the first of each evade) is style too
  const dodge0 = player.dodge;
  if (dodge0) player.dodge = (from, kind, gentle) => {
    const r = dodge0.call(player, from, kind, gentle);
    if (r === 'perfect' && phase === 'fight') { run.dodges = (run.dodges ?? 0) + 1; addStyle(TIDE.dodge, 'Dodge!', player.pos); }
    return r;
  };

  function addStyle(n, label, at) {
    run.style += n;
    ctx.setScore(tideScore({ waves: run.cleared, style: run.style }));
    if (label && at) words.pop(_v.copy(at).setY((at.y ?? 0) + 1.6), label, 'combo', 1.0);
  }

  function nextWave() {
    run.wave++;
    phase = 'fight';
    run.hurtAt = player.hurtAt ?? -1e9;
    const kinds = waveKinds(run.wave, { gentle });
    // out of the springs farthest from the traveller, a few at a time from each
    const springs = SPRINGS.slice().sort((a, b) => b.distanceTo(player.pos) - a.distanceTo(player.pos));
    kinds.forEach((kind, i) => {
      const s = springs[i % (kinds.length > 4 ? 3 : 2)];
      const a = (i * 2.4) % (Math.PI * 2), r = 0.5 + (i % 3) * 0.5;
      const at = new THREE.Vector3(s.x + Math.cos(a) * r, 0, s.z + Math.sin(a) * r);
      at.y = basinHeight(at.x, at.z);
      const f = foes?.add(kind, at);
      if (f) adopt(f, 1.2 + (i % 3) * 0.4);
    });
    for (const s of springs.slice(0, kinds.length > 4 ? 3 : 2)) splash(s);
    ctx.flash(`Wave ${run.wave}: ${waveWords(kinds)}`, 'big', 2.0);
    sound?.foeWarn?.('machine');
    sfx.whoosh();
  }

  /** One of the wave's: the basin is all in sight, so it keeps after you, wherever its spring was. */
  function adopt(f, cool = 0.6) {
    f.def = { ...f.def, sight: 80, giveUp: 1e9 };
    f.state = 'chase'; f.cool = cool;
    mine.push(f);
  }

  function splash(s) {
    const tones = ['#2a2440', '#4a3d6e', INK, '#6d4fa8'];
    for (let i = 0; i < 26; i++) tool?.drops?.add({ pos: _v.set(s.x, 0.3, s.z), vel: _w.set((Math.random() - 0.5) * 3, 3 + Math.random() * 5, (Math.random() - 0.5) * 3), drag: 1.5, grav: 12, size: 0.05 + Math.random() * 0.06, stretch: 2, life: 0.6 + Math.random() * 0.5, color: tones[i % 4] });
    tool?.rings?.add({ from: _v.set(s.x, 0.15, s.z), dir: _w.set(0, 1, 0), r0: 0.4, r1: 2.6, life: 0.6, color: '#6d4fa8', thick: 1.5 });
  }

  function cleared() {
    run.cleared++;
    const clean = (player.hurtAt ?? -1e9) === run.hurtAt;
    if (clean) { run.untouched++; run.style += TIDE.untouched; }
    ctx.setScore(tideScore({ waves: run.cleared, style: run.style }));
    ctx.flash(clean ? `Wave ${run.wave} cleared · untouched +${TIDE.untouched}` : `Wave ${run.wave} cleared`, 'good big', 1.8);
    sfx.checkpoint();
    if (player.restore) player.restore(TIDE.heal); else player.health = Math.min(1, (player.health ?? 1) + TIDE.heal / 3);
    phase = 'rest'; restT = TIDE.breather;
    offerBoons();
  }

  function offerBoons() {
    const ids = boonChoice(run.taken, Math.random, 3, run.wave);
    if (!ids.length) { restT = TIDE.after; return; }
    // in a row ahead of the traveller, as the camera looks (kept on the basin's floor)
    const fwd = camera.getWorldDirection(_w).setY(0);
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    const mid = _v.copy(player.pos).addScaledVector(fwd, 4.5).setY(0);
    if (mid.length() > 13) mid.setLength(13);
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    boons = ids.map((id, i) => {
      const def = boonById(id), m = boonModel(def);
      const off = (i - (ids.length - 1) / 2) * 3.0;
      m.position.set(mid.x + side.x * off, -1.5, mid.z + side.z * off);
      m.userData.floor = basinHeight(m.position.x, m.position.z);
      ctx.add(m);
      const n = run.taken[id] ?? 0;
      const tag = words.tag(`<b>${def.name}${n ? ` ${'I'.repeat(n + 1)}` : ''}</b>${def.text}`);
      return { def, m, tag, rise: 0 };
    });
    sound?.chime?.();
  }

  function take(b) {
    run.taken[b.def.id] = (run.taken[b.def.id] ?? 0) + 1;
    apply();
    if (b.def.id === 'mend') player.health = 1;
    for (let i = 0; i < 24; i++) tool?.glow?.add({ pos: b.m.gem.getWorldPosition(_v), vel: _w.randomDirection().multiplyScalar(2.5), drag: 2, size: 0.07, life: 0.7, color: b.def.color, grow: true });
    ctx.flash(`${b.def.name}: ${b.def.text}`, 'good', 1.8);
    sfx.coin(2); sfx.gate();
    clearBoons();
    restT = TIDE.after;
  }
  function clearBoons() { for (const b of boons) { b.tag.remove(); b.m.removeFromParent(); } boons = []; }

  function killed(f) {
    run.kills++;
    run.chain = t - run.lastKill <= TIDE.chainFor ? run.chain + 1 : 1;
    run.lastKill = t;
    run.bestChain = Math.max(run.bestChain, run.chain);
    const p = killPoints(f.kind, run.chain);
    run.style += p;
    ctx.setScore(tideScore({ waves: run.cleared, style: run.style }));
    words.pop(_v.copy(f.pos).setY(f.pos.y + 1.4), `+${p}`, run.chain >= 3 ? 'gold' : '', 0.9);
    if (run.chain >= 2) words.pop(_v.copy(f.pos).setY(f.pos.y + 2.0), `chain ×${chainMult(run.chain).toFixed(2).replace(/\.?0+$/, '')}`, 'combo', 1.0);
  }

  ctx.setScore(0);
  return {
    update(dt, inp, { live }) {
      t += dt;
      // the ink sea breathes; it rises while a wave is on
      const rise = phase === 'fight' ? 1 : 0;
      for (const L of level.tide?.lines ?? []) {
        L.userData.r -= dt * (rise ? 2.2 : -0.6);
        if (L.userData.r < 24.8) L.userData.r += 45; else if (L.userData.r > 70) L.userData.r -= 45;
        L.scale.setScalar(L.userData.r); L.position.y = (sea?.position.y ?? -0.9) + 0.03;
      }
      if (sea) { sea.position.y += ((-0.9 + 0.45 * rise + Math.sin(t * 0.8) * 0.05) - sea.position.y) * (1 - Math.exp(-1.5 * dt)); foam.position.y = sea.position.y + 0.04; foam.scale.setScalar(1 - 0.012 * rise + Math.sin(t * 1.3) * 0.004); }
      if (live && !over) {
        // what a foe broke into (a glass golem's splinters) is the wave's too: to cut down before it is cleared
        for (const f of foes?.list ?? []) if (f.alive && !f.counted && !mine.includes(f)) adopt(f);
        for (const f of mine) if (f.alive && (f.state === 'idle' || f.state === 'home') && !player.dead) f.state = 'chase';
        for (const f of mine) if (!f.alive && !f.counted) { f.counted = true; killed(f); }
        mine = mine.filter((f) => !f.counted);
        if (phase === 'fight' && !mine.length) cleared();
        else if (phase === 'rest') {
          restT -= dt;
          for (const b of boons) {
            b.rise = Math.min(1, b.rise + dt * 1.6);
            b.m.position.y = b.m.userData.floor - 1.5 + 1.5 * (1 - (1 - b.rise) ** 3);
            b.m.gem.rotation.y += dt * 1.8; b.m.gem.position.y = 1.35 + Math.sin(t * 2.2) * 0.08;
            b.m.ring.rotation.z += dt;
            b.tag.place(_v.copy(b.m.position).setY(b.m.position.y + 2.1));
            if (b.rise > 0.6 && Math.hypot(player.pos.x - b.m.position.x, player.pos.z - b.m.position.z) < 1.2) { take(b); break; }
          }
          if (restT <= 0) { clearBoons(); nextWave(); }
          ctx.status(boons.length ? `Breather · pick a boon · ${Math.ceil(restT)} s` : `Wave ${run.wave + 1} in ${Math.max(0, restT).toFixed(1)} s`);
        }
        if (phase === 'fight') ctx.status(`Wave ${run.wave} · ${mine.length} left · ${tideScore({ waves: run.cleared, style: run.style })} pts`);
        // knocked out: the tide has you
        if (player.dead) {
          over = true;
          clearBoons();
          ctx.finish({ failed: true, title: 'The tide took you', lines: [
            `Waves cleared ${run.cleared} (${run.cleared * TIDE.wavePoints} pts) · style ${run.style}`,
            `Foes cut down ${run.kills} · longest chain ${run.bestChain} · perfect parries ${run.parries} · perfect dodges ${run.dodges ?? 0}`,
            `Waves untouched ${run.untouched}${gentle ? ' · gentle foes' : ''}`,
            `Boons: ${Object.entries(run.taken).map(([id, n]) => `${boonById(id).name}${n > 1 ? ` ×${n}` : ''}`).join(', ') || 'none taken'}`,
          ] });
        }
      }
      // back on your feet for the results (the world's own restart card is not for a game)
      if (over && player.dead && (deadT += dt) > 1.2) player.restart?.();
      // the basin's edge: the ink does not let you out
      const r = Math.hypot(player.pos.x, player.pos.z);
      if (r > 21.5 && !player.dead) { const k = 21.5 / r; player.pos.x *= k; player.pos.z *= k; }
      words.update(dt);
    },
    end() {
      clearBoons();
      for (const f of foes?.list.slice() ?? []) foes.remove(f);
      if (foes) foes.lock = null;
      if (guard0) player.guard = guard0;
      if (dodge0) player.dodge = dodge0;
      if (blind0) foes.blind = blind0;
      if (strike0) foes.strike = strike0;
      for (const k of keep) k();
      words.dispose();
      giveBack();
      if (player.dead) player.restart?.();
    },
  };
}

export default {
  id: 'waves', order: 8,
  name: 'Ink tide',
  blurb: 'A basin of sand in a sea of ink, and the ink keeps coming: wave after wave of blots, spitters, swarms, shades and machines, and further on the worlds’ own foes: moths, rays, crabs, drones, golems, hounds…',
  rules: 'Cut down every wave. Between waves you get some health back and a choice of three boons: walk onto the one you want. Score: 150 a wave cleared, plus style (quick chains of cuts, perfect parries, perfect dodges, a wave untouched). It ends when the tide knocks you out.',
  drives: false,
  controls: {
    pad: [['RB / R1', 'attack (press again to chain)'], ['LB / L1', 'guard (just as a blow lands: parry)'], ['B / ○', 'evade'], ['LT / L2  +  RT / R2', 'aim and fire the fluid'], ['R3', 'lock on'], ['Menu', 'pause']],
    keys: [['F', 'attack (again to chain)'], ['Ctrl or Z', 'guard (just as a blow lands: parry)'], ['Alt', 'evade'], ['Right mouse + left mouse', 'aim and fire the fluid'], ['Tab', 'lock on'], ['Esc', 'pause']],
    touch: [['⚔', 'attack (again to chain)'], ['◇', 'guard (just as a blow lands: parry)'], ['↶', 'evade'], ['◎ then ✺', 'aim, fire the fluid'], ['◉', 'lock on']],
  },
  touchButtons: ['jump', 'run', 'aim', 'fire', 'mode', 'blade', 'guard', 'evade', 'lock'],
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: true, score: true },
  color: '#8e64d6',
  build: buildTide,
  start,
};
