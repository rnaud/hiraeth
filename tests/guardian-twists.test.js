// The guardians' last phases ask for their temple's one idea (docs/systems/foes.md "The guardians' last phases",
// docs/audits/temple-design-v1.12.md's addendum): each played through in its own arena with a real Player, the
// failure first (it costs nothing but time), then the way through; and each taught a phase earlier, where the old
// way still works too.
//   the Cloud-Mother (the Founders' Belfry: a bell holds things only while it rings)   a ring as she rises to dive
//                     brings a stone down where she will dive; she lies on it, and the bell calms her
//   the Lampless (the Lamp-House: light can be carried)   lured to the pools you lit earlier, it drinks there
//   the Mother Snapper (the Hush-House: low to high)   the crystals over her stilled in turn, smallest first
//   the First Sign (the Undertower: a note travels)   it hears only through the dishes on its hall's wall
//   the Clockwork Foreman (the First Garage: count round from where the hand points)   its numerals from four
//   the Gardener (the Builders' Greenhouse: nothing grows in the shade)   its back blooms only in the sun, brought onto
//                     the quarter it kneels in from that quarter's footstone
//   the Elder (the Aerie: one wind, out wherever no stone stops it)   she takes heart only in the wind, the roost's
//                     stone rolled so it rises by her
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { updateHazards } from '../src/hazards.js';
import { GROUNDED } from '../src/temples/arzach2.js';
import { LURE } from '../src/temples/perdide2.js';
import { SUN } from '../src/temples/edena.js';
import { ROOST } from '../src/temples/arzach.js';
import { allTargets, hitTarget } from '../src/targets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** A temple's world, a Player in its guardian's arena, and the guardian awake in phase `phase` (0, 1, 2…). */
function arena(id, gadget, phase) {
  game.reset();
  own('backpack', gadget);
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = level.temple;
  const G = rt.guardian;
  const notes = [];
  const P = new Player(physics, { spawn: G.arena.center.clone().add(V(0, 0.2, -G.arena.r * 0.6)), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  game.emit('box:opened', { id: rt.def.gadgetBox });
  let t = 0;
  const frame = (input = {}) => { t += DT; rt.update(DT, t); P.update(DT, input, 0); updateHazards(DT, P); level.update(DT, t, {}); };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  /** Frames until fn() is true (at most s seconds): true if it came. */
  const until = (fn, s = 40) => { for (let i = 0; i < s / DT; i++) { frame(); if (fn()) return true; } return false; };
  const said = (re) => notes.some((n) => re.test(n));
  /** Stand at a spot on the arena's floor (local to its centre: x, z). */
  const stand = (x, z) => { P.teleport(G.arena.center.clone().add(V(x, 0.2, z)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); };
  /** Stand d metres from a spot (world), on the arena's side of it. */
  const away = (spot, d = 9) => {
    const c = G.arena.center, o = V(c.x - spot.x, 0, c.z - spot.z);
    if (o.lengthSq() < 0.01) o.set(1, 0, 0); else o.normalize();
    const x = spot.x + o.x * d - c.x, z = spot.z + o.z * d - c.z, r = Math.hypot(x, z), m = G.arena.r - 3;
    stand(r > m ? x * m / r : x, r > m ? z * m / r : z);
  };
  wait(0.3);
  assert.notEqual(G.state, 'sleep', `${id}: it wakes`);
  P.opts.health = false;
  assert.equal(until(() => G.state === 'fight', 8), true, `${id}: it fights`);
  if (phase > 0) { G.meter = G.floor = G.def.phases[phase - 1].to; }
  assert.equal(G.phaseIndex, phase);
  return { level, rt, G, P, notes, frame, wait, until, said, stand, away, done: () => { rt.dispose?.(); game.reset(); own(); } };
}

// ------------------------------------------------------------------ the Cloud-Mother
test('the Cloud-Mother’s last phase: she never sinks to cry by herself; a ring as she rises to dive brings a stone down where she dives, she lies on it, and the bell calms her', () => {
  const A = arena('arzach2', 'bell', 2);
  const { rt, G, P, until, wait, said, away } = A;
  const ring = () => game.emit('bell', { pos: P.pos.clone() });
  const S = rt.hallStones;
  assert.ok(S?.list.length >= 3, 'stones hang under her dome');
  // the failure: left alone she cries and rises again, never open; a ring now brings nothing down
  let opened = false;
  until(() => { if (G.state === 'open') opened = true; return said(/rises again at once/); }, 40);
  assert.equal(opened, false, 'in her last phase she never sinks to cry by herself');
  assert.ok(said(/rises again at once/), 'it says she rises again');
  until(() => G.state === 'fight' && !G.attack, 10);
  ring();
  assert.ok(S.list.every((s) => s.held === 0), 'a ring between her moves brings no stone down');
  assert.ok(said(/rises out of its reach/), 'and says when to ring');
  assert.equal(G.meter, 0.7, 'nothing lost');
  // the way: ring as she rises to dive
  for (let n = 0; n < 4 && G.state !== 'weary'; n++) {
    assert.equal(until(() => G.attack?.over && !G.struck && G.at > 0.15 && G.at < G.windFor * 0.5, 40), true, `she rises to dive (${n})`);
    ring();
    const stone = S.list.find((s) => s.held > 0);
    assert.ok(stone, `the ring brings a stone down (${n})`);
    until(() => !G.attack || G.at > G.windFor * (G.attack.track ?? 0.5) + 0.05, 3);   // (she has picked her spot)
    const spot = G.attackAt.clone();
    away(G.attackAt);   // (out from under it)
    assert.equal(until(() => G.state === 'open', 6), true, `she dives onto it and lies there (${n})`);
    assert.ok(Math.hypot(stone.m.position.x - G.attackAt.x, stone.m.position.z - G.attackAt.z) < 0.5, 'the stone lies where she dived');
    assert.ok(Math.hypot(spot.x - G.attackAt.x, spot.z - G.attackAt.z) < 0.1, 'where she was going to dive');
    assert.ok(G.openFor >= GROUNDED, `held there a while (${G.openFor})`);
    const before = G.meter;
    ring();
    assert.ok(G.meter > before, `the bell calms her (${n}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  wait(HOLD_STONES + 3);
  assert.ok(S.list.every((s) => s.held === 0 && s.k < 0.05), 'the note gone, the stones fell up again');
  A.done();
});

test('the Cloud-Mother’s second phase teaches the stone: a ring as she rises to dive brings it down, and her own crying still opens her', () => {
  const A = arena('arzach2', 'bell', 1);
  const { rt, G, P, until, away } = A;
  const ring = () => game.emit('bell', { pos: P.pos.clone() });
  assert.equal(until(() => G.state === 'open', 40), true, 'she sinks to cry by herself');
  const m0 = G.meter;
  ring();
  assert.ok(G.meter > m0, 'and the bell calms her, as before');
  assert.equal(until(() => G.attack?.over && !G.struck && G.at > 0.15 && G.at < G.windFor * 0.5, 40), true, 'she rises to dive');
  ring();
  assert.ok(rt.hallStones.list.some((s) => s.held > 0), 'the ring brings a stone down');
  away(G.attackAt);
  assert.equal(until(() => G.state === 'open', 6), true, 'she lies on it');
  assert.ok(G.openFor >= GROUNDED);
  A.done();
});

const HOLD_STONES = 10;

// ------------------------------------------------------------------ the Lampless
test('the Lampless’s last phase: it shies from you; a pool lit earlier (your lantern held by it, or a splash) lures it down, and it drinks there if you stand back', () => {
  const A = arena('perdide2', 'lantern', 2);
  const { rt, G, P, until, wait, said, stand, frame } = A;
  const pools = rt.lurePools.list;
  assert.equal(pools.length, 3, 'three dark pools round the room');
  assert.ok(pools.every((p) => !p.lit));
  const c = G.arena.center, local = (p) => [p.at.x - c.x, p.at.z - c.z];
  // the failure: standing still by it as it searches, the old way, does nothing now
  assert.equal(until(() => G.state === 'open', 40), true, 'it hangs low, searching');
  stand(G.model.pos.x - c.x + 4, G.model.pos.z - c.z);
  const m0 = G.meter;
  until(() => G.state !== 'open', 6);
  assert.equal(G.meter, m0, 'it does not drink from you in its last phase');
  assert.ok(said(/shies from you/), 'it says so');
  // light a pool with the lantern: held by it a moment
  const [px, pz] = local(pools[0]);
  stand(px + 1, pz);
  wait(1.6);
  assert.equal(pools[0].lit, true, 'your lantern held by it lights the pool');
  // the second failure: stay by the lit pool and it will not come down to drink
  assert.equal(until(() => G.state === 'open', 40), true, 'it searches again');
  stand(px + 1, pz);
  until(() => Math.hypot(G.model.pos.x - pools[0].at.x, G.model.pos.z - pools[0].at.z) < LURE.reach, 8);
  wait(LURE.drink + 0.5);
  assert.equal(G.meter, m0, 'not while you stand by the pool');
  assert.equal(pools[0].lit, true, 'the pool still lit');
  assert.ok(said(/Stand back/), 'it says to stand back');
  // the way: stand back
  stand(px > 0 ? px - 9 : px + 9, pz + 4);
  assert.equal(until(() => G.meter > m0 || G.state === 'weary', 10), true, 'it drinks there');
  assert.equal(pools[0].lit, false, 'the pool drunk dark');
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  A.done();
});

test('the Lampless’s second phase teaches the pools: a splash lights one and it drinks there, and standing still by it still works', () => {
  const A = arena('perdide2', 'lantern', 1);
  const { rt, G, P, until, stand, frame } = A;
  const c = G.arena.center, pool = rt.lurePools.list[2];
  // the old way still: stand still by it as it searches
  assert.equal(until(() => G.state === 'open', 40), true, 'it searches');
  stand(G.model.pos.x - c.x + 4, G.model.pos.z - c.z);
  const m0 = G.meter;
  until(() => G.meter > m0 || G.state !== 'open', 6);
  assert.ok(G.meter > m0, 'it drinks your lantern’s light');
  // a splash lights a pool from afar
  const t = allTargets().find((x) => x.position() === pool.at);
  assert.ok(t, 'the pool is a target');
  hitTarget({ target: t, point: pool.at.clone() }, 'shoot');
  assert.equal(pool.lit, true, 'a splash lights it');
  stand(0, -10);
  const m1 = G.meter;
  assert.equal(until(() => G.meter > m1, 50), true, 'it goes down to the lit pool and drinks');
  assert.equal(pool.lit, false);
  A.done();
});

// ------------------------------------------------------------------ the Mother Snapper
test('the Mother Snapper’s last phase: the cold no longer eases her; the three crystals over her stilled in turn, smallest first, calm her, and out of turn they ring flat and start again', () => {
  const A = arena('perdide', 'stun', 2);
  const { rt, G, until, said } = A;
  const C = rt.motherCrystals.list, by = (rank) => C.find((s) => s.o.rank === rank);
  assert.equal(C.length, 3, 'three crystals swing over her');
  assert.ok(C.every((s) => s.center.y - G.arena.y > 5), 'well over your head: they knock nobody down');
  assert.deepEqual([0, 1, 2].map((r) => by(r).o.size), [0.6, 0.85, 1.15], 'smallest first');
  assert.notDeepEqual(C.map((s) => s.o.rank), [0, 1, 2], 'they hang out of order round the hall');
  // the failure: a stilling glob in her open mouth does nothing now
  A.stand(0, -2);   // (within her lunge)
  assert.equal(until(() => G.state === 'open', 40), true, 'she lies spent');
  const m0 = G.meter;
  G.hit('mouth', 'stun');
  assert.equal(G.meter, m0, 'the cold no longer eases her');
  assert.ok(said(/crystals ringing out of tune/), 'she looks up at the crystals');
  // out of turn: the middle first rings flat; the smallest, then the biggest: flat again, and the turn starts over
  by(1).hit('stun');
  assert.equal(by(1).taken ?? false, false, 'out of turn it rings flat');
  assert.ok(said(/smallest crystal first/), 'and says so');
  by(0).hit('stun');
  assert.equal(by(0).taken, true, 'the smallest rings true');
  by(2).hit('stun');
  assert.ok(C.every((s) => !s.taken), 'the biggest before the middle: flat, and the notes fade');
  assert.equal(G.meter, m0, 'nothing lost, nothing gained');
  // the way: smallest, middle, biggest
  for (const r of [0, 1, 2]) by(r).hit('stun');
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  A.done();
});

test('the Mother Snapper’s second phase teaches the crystals: stilled in turn they calm her a little, and the cold in her mouth still does', () => {
  const A = arena('perdide', 'stun', 1);
  const { rt, G, until } = A;
  const by = (rank) => rt.motherCrystals.list.find((s) => s.o.rank === rank);
  const m0 = G.meter;
  for (const r of [0, 1, 2]) by(r).hit('stun');
  assert.ok(G.meter > m0 + 0.09, `the crystals in turn calm her (${G.meter.toFixed(2)})`);
  A.stand(0, -2);
  assert.equal(until(() => G.state === 'open', 40), true, 'she lies spent');
  const m1 = G.meter;
  G.hit('mouth', 'stun');
  assert.ok(G.meter > m1, 'and a cold glob in her mouth still does');
  A.done();
});

// ------------------------------------------------------------------ the First Sign
/** Stand under one of the First Sign's hall's low dishes (its mouth within reach). */
function underDish(A, id) {
  const d = A.rt.piece(id), m = d.ends[0].mouth, c = A.G.arena.center;
  const o = V(c.x - m.x, 0, c.z - m.z).setLength(1.2);
  A.stand(m.x + o.x - c.x, m.z + o.z - c.z);
  return d;
}

test('the First Sign’s last phase: it turns its dish up and hears its word only through the low dishes on the wall; played to its face, or the wrong word into a dish, nothing', () => {
  const A = arena('bazaar', 'echo', 2);
  const { rt, G, P, until, wait, said, stand } = A;
  const echo = (note) => game.emit('echo', { pos: P.pos.clone(), note });
  const word = 'sign.3';
  assert.deepEqual(['signDishW', 'signDishE'].map((id) => !!rt.piece(id)), [true, true], 'two low dishes on the wall');
  // the failure: its word played close to it, as before
  assert.equal(until(() => G.state === 'open', 40), true, 'it stops to listen');
  stand(G.model.pos.x - G.arena.center.x + 4, G.model.pos.z - G.arena.center.z);
  echo(word);
  wait(1);
  assert.equal(G.meter, 0.75, 'it does not hear it: its dish is turned up');
  assert.ok(said(/only what its cables bring/), 'it says where it listens now');
  assert.ok(G.model.pitch < 0, 'its dish turned up to the dark as it listens');
  // the wrong word into a dish: carried, and refused
  until(() => G.state !== 'open', 10);
  underDish(A, 'signDishW');
  assert.equal(until(() => G.state === 'open', 40), true, 'it listens again');
  echo('sign.0');
  wait(1);
  assert.equal(G.meter, 0.75, 'its old word, through the dish: refused');
  assert.ok(said(/old word/), 'it shakes its dish');
  // the way: its word into the low dish
  until(() => G.state !== 'open', 10);
  underDish(A, 'signDishE');
  assert.equal(until(() => G.state === 'open', 40), true, 'it listens');
  echo(word);
  assert.equal(G.meter, 0.75, 'a moment on its way up the dish and down the cable');
  wait(1);
  assert.equal(G.state, 'resolved', `its whole line (${G.meter})`);
  assert.ok(said(/down the cable/), 'it says how it heard');
  A.done();
});

test('the First Sign’s second phase teaches the dishes: a word played into a low dish on the wall reaches it from across the hall', () => {
  const A = arena('bazaar', 'echo', 1);
  const { rt, G, P, until, wait, said } = A;
  assert.equal(until(() => G.state === 'open', 40), true, 'it listens');
  // (under the dish further from it: out of its own hearing)
  const far = ['signDishW', 'signDishE'].sort((a, b) => rt.piece(b).ends[0].mouth.distanceTo(G.model.mouth) - rt.piece(a).ends[0].mouth.distanceTo(G.model.mouth))[0];
  underDish(A, far);
  assert.ok(P.pos.distanceTo(G.model.mouth) > 14, `out of its own hearing (${P.pos.distanceTo(G.model.mouth).toFixed(1)} m)`);
  game.emit('echo', { pos: P.pos.clone(), note: 'sign.2' });
  wait(1);
  assert.ok(G.meter >= 0.75 - 1e-6, `its word, through the dish (${G.meter})`);
  assert.ok(said(/down the cable/), 'down the cable from the dish');
  A.done();
});

// ------------------------------------------------------------------ the Clockwork Foreman
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test('the Foreman’s last phase: open, its hands stop at four, and its six numerals take only in the clock’s order counted from four; out of step they all go dark', () => {
  const A = arena('garage', 'coil', 2);
  const { rt, G, until, wait, said } = A;
  const shots = (list) => { for (const i of list) { rt.volley(i); wait(0.35); } };
  const lit = () => G.model.steps.filter((r) => r.visible).length;
  A.stand(0, -6);
  assert.equal(until(() => G.state === 'open', 40), true, 'its face opens');
  wait(0.8);
  assert.ok(Math.abs(wrapA(G.model.hour.rotation.z + (4 / 12) * Math.PI * 2)) < 0.15, `its hour hand at four (${G.model.hour.rotation.z.toFixed(2)})`);
  // the failure: from twelve, round the clock
  shots([0, 1]);
  assert.equal(G.meter, 0.75, 'out of step: nothing');
  assert.equal(lit(), 0, 'and every numeral goes dark');
  assert.ok(said(/out of step/), 'it says to count from four');
  // the way: four, six, eight, ten, twelve, two (its lamps 2, 3, 4, 5, 0, 1)
  shots([2, 3, 4]);
  assert.equal(lit(), 3, 'three in step, their rings lit');
  shots([5, 0, 1]);
  assert.equal(G.state, 'resolved', `set right (${G.meter})`);
  A.done();
});

test('the Foreman’s second phase teaches the order: any order still sets it back, and six in step round from four ring true', () => {
  const A = arena('garage', 'coil', 1);
  const { rt, G, until, wait, said } = A;
  const shots = (list) => { for (const i of list) { rt.volley(i); wait(0.35); } };
  A.stand(0, -6);
  assert.equal(until(() => G.state === 'open', 40), true, 'its face opens');
  shots([0, 1, 2, 3, 4, 5]);
  assert.ok(G.meter > 0.5, `six from twelve still count here (${G.meter})`);
  assert.ok(!said(/in step, round from four/));
  A.done();
  const B = arena('garage', 'coil', 1);
  B.stand(0, -6);
  assert.equal(B.until(() => B.G.state === 'open', 40), true, 'its face opens');
  for (const i of [2, 3, 4, 5, 0, 1]) { B.rt.volley(i); B.wait(0.35); }
  assert.ok(B.G.meter > 0.5);
  assert.ok(B.said(/in step, round from four/), 'in step: it says so');
  B.done();
});

// ------------------------------------------------------------------ the Gardener
/** The Gardener's footstones, nearest its body first (or farthest, `far`). */
const footstones = (rt, G, far = false) => ['fs1', 'fs2', 'fs3', 'fs4'].map((id) => rt.piece(id)).sort((a, b) => (far ? -1 : 1) * (a.pos.distanceTo(G.model.pos) - b.pos.distanceTo(G.model.pos)));
/** A bloom glob on its back, as the tool fires it (through its own target). */
function bloomIt(G) {
  const tg = allTargets().find((x) => x.kind === 'guardian' && x.enabled() && x.position().distanceTo(G.model.pos) < 12 && x.position().distanceTo(G.model.mouth) > 0.5);
  assert.ok(tg, 'its body is a target');
  hitTarget({ target: tg, point: tg.position() }, 'bloom', V(0, 0, 1));
}

test('the Gardener’s last phase: nothing grows on it in the shade; the footstone of the quarter it kneels in turns the dome’s louvre onto it, and in the sun its back blooms', () => {
  const A = arena('edena', 'bloom', 2);
  const { rt, G, P, until, wait, said } = A;
  const sun = rt.gardenSun;
  const standOn = (fs) => { P.teleport(fs.pos.clone().add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); };
  assert.ok(sun && sun.spots.length === 4, 'the dome’s louvre has four quarters');
  // the failure: the sun turned away from where it kneels, a bloom only falls off it
  assert.equal(until(() => G.state === 'open', 40), true, 'it kneels');
  assert.ok(G.openFor >= SUN.open[2], `it kneels long enough to bring the sun (${G.openFor})`);
  standOn(footstones(rt, G, true)[0]);
  wait(2);
  assert.equal(sun.lights(G.model.pos, SUN.pad), false, 'the sun on the far quarter');
  const m0 = G.meter;
  bloomIt(G);
  assert.equal(G.meter, m0, 'in the shade nothing grows on it');
  assert.ok(said(/kneeling in the shade/), 'and it says to bring the sun');
  // the way: each time it kneels, the footstone of its quarter, the sun settles on it, then the bloom
  for (let n = 0; n < 4 && G.state !== 'weary'; n++) {
    if (G.state !== 'open') assert.equal(until(() => G.state === 'open', 40), true, `it kneels (${n})`);
    standOn(footstones(rt, G)[0]);
    assert.equal(until(() => sun.lights(G.model.pos, SUN.pad), 4), true, `the louvre turns the sun onto it (${n})`);
    const before = G.meter;
    bloomIt(G);
    assert.ok(G.meter > before, `in the sun its back blooms (${n}: ${G.meter.toFixed(2)})`);
    assert.ok(said(/In the sun the flowers take/), 'and it says so');
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  A.done();
});

test('the Gardener’s second phase teaches the sun: a bloom in the shade still counts, and in the sun it counts double', () => {
  const A = arena('edena', 'bloom', 1);
  const { rt, G, P, until, wait } = A;
  const sun = rt.gardenSun;
  const standOn = (fs) => { P.teleport(fs.pos.clone().add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); };
  assert.equal(until(() => G.state === 'open', 40), true, 'it kneels');
  standOn(footstones(rt, G, true)[0]);
  wait(2);
  const m0 = G.meter;
  bloomIt(G);
  assert.ok(Math.abs(G.meter - m0 - SUN.shade[1]) < 1e-6, `in the shade, as before (${(G.meter - m0).toFixed(2)})`);
  assert.equal(until(() => G.state === 'open', 40), true, 'it kneels again');
  standOn(footstones(rt, G)[0]);
  assert.equal(until(() => sun.lights(G.model.pos, SUN.pad), 4), true, 'the sun onto it');
  const m1 = G.meter;
  bloomIt(G);
  assert.ok(G.meter - m1 > SUN.shade[1] + 1e-6 || G.phaseIndex > 1, `in the sun, double (${(G.meter - m1).toFixed(2)})`);
  A.done();
});

// ------------------------------------------------------------------ the Elder
test('the Elder’s last phase: flown with on still air she does not follow; the roost’s stone rolled so the wind rises by her, ridden up beside her, and she takes heart', () => {
  const A = arena('arzach', 'glider', 2);
  const { rt, G, P, until, wait, said } = A;
  const winds = rt.roostWinds;
  const ball = rt.piece('ballR');
  assert.ok(winds?.length === 2 && ball, 'two vents and one stone');
  const nearest = () => winds.slice().sort((a, b) => Math.hypot(a.foot.x - G.model.pos.x, a.foot.z - G.model.pos.z) - Math.hypot(b.foot.x - G.model.pos.x, b.foot.z - G.model.pos.z));
  const fly = (at) => {
    const before = G.meter;
    P.teleport(at, V(0, 1, 0), V(0, 0, 1)); P.heading = 0;
    for (let i = 0; i < 2.5 / DT && G.meter === before && G.state === 'open'; i++) A.frame({ Space: true });
    for (let i = 0; i < 5 / DT && !P.onGround; i++) A.frame();
    return G.meter - before;
  };
  // the failure: beside her on still air (well away from the wind), she watches you sink
  assert.equal(until(() => G.state === 'open', 40), true, 'she looks up, afraid');
  assert.ok(G.openFor >= ROOST.open[2], `she hangs there long enough to bring the wind (${G.openFor})`);
  const off = G.model.pos.clone().add(V(0, 5, 0));
  const farFromWind = winds.every((w) => !w.on || Math.hypot(w.foot.x - off.x, w.foot.z - off.z) > w.r + 1);
  if (!farFromWind) { const dir = off.clone().sub(winds.find((w) => w.on).foot).setY(0).normalize(); off.addScaledVector(dir, 4); }
  assert.equal(fly(off), 0, 'on still air she does not take heart');
  assert.ok(said(/still air/), 'and it says to bring the wind');
  // the way: when the wind is on the far side, roll the stone across; then ride the column up beside her
  let rolled = false;
  for (let n = 0; n < 6 && G.state !== 'weary'; n++) {
    if (G.state !== 'open') assert.equal(until(() => G.state === 'open', 40), true, `she looks up (${n})`);
    const w = nearest()[0];
    if (!w.on) {
      const toward = Math.sign(rt.kit.local(w.foot).x);   // (the stone goes into the other vent: away from this one)
      const d = ball.dir.clone().multiplyScalar(-toward);
      P.teleport(ball.center.clone().addScaledVector(d, -2.3).setY(G.arena.y + 0.1), V(0, 1, 0), V(0, 0, 1));
      ball.hit('push', d, { strength: 1 });
      until(() => w.on, 8);
      assert.equal(w.on, true, `the stone rolled across: the wind rises by her (${n})`);
      rolled = true;
      if (G.state !== 'open') continue;
    }
    assert.ok(fly(w.foot.clone().add(V(0, 4, 0))) > 0, `ridden up the wind beside her (${n}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  if (!rolled) {
    // (she happened to open by the wind each time: the stone still carries the wind across)
    const before = winds.map((w) => w.on);
    const d = ball.dir.clone().multiplyScalar(rt.logic.drumOn('ballR', 'pRW') ? 1 : -1);
    P.teleport(ball.center.clone().addScaledVector(d, -2.3).setY(G.arena.y + 0.1), V(0, 1, 0), V(0, 0, 1));
    ball.hit('push', d, { strength: 1 });
    wait(4);
    assert.deepEqual(winds.map((w) => w.on), before.map((x) => !x), 'rolled across, the wind changes vents');
  }
  A.done();
});

test('the Elder’s second phase teaches the wind: flown with on still air she still takes heart, and in the wind twice as much', () => {
  const A = arena('arzach', 'glider', 1);
  const { rt, G, P, until } = A;
  const winds = rt.roostWinds;
  const fly = (at) => {
    const before = G.meter;
    P.teleport(at, V(0, 1, 0), V(0, 0, 1)); P.heading = 0;
    for (let i = 0; i < 2.5 / DT && G.meter === before && G.state === 'open'; i++) A.frame({ Space: true });
    for (let i = 0; i < 5 / DT && !P.onGround; i++) A.frame();
    return G.meter - before;
  };
  assert.equal(until(() => G.state === 'open', 40), true, 'she looks up');
  const off = G.model.pos.clone().add(V(0, 5, 0));
  const w = winds.find((x) => x.on);
  if (Math.hypot(w.foot.x - off.x, w.foot.z - off.z) < w.r + 1) off.addScaledVector(off.clone().sub(w.foot).setY(0).normalize(), 4);
  const still = fly(off);
  assert.ok(Math.abs(still - ROOST.still[1]) < 1e-6, `on still air, as before (${still.toFixed(2)})`);
  const ball = rt.piece('ballR');
  let gained = null;
  for (let n = 0; n < 5 && gained === null && G.phaseIndex === 1; n++) {
    assert.equal(until(() => G.state === 'open', 40), true, `she looks up again (${n})`);
    const w2 = winds.slice().sort((a, b) => Math.hypot(a.foot.x - G.model.pos.x, a.foot.z - G.model.pos.z) - Math.hypot(b.foot.x - G.model.pos.x, b.foot.z - G.model.pos.z))[0];
    if (w2.on) { gained = fly(w2.foot.clone().add(V(0, 4, 0))); break; }
    // the wind on her far side: the stone rolled across, for her next opening
    const d = ball.dir.clone().multiplyScalar(-Math.sign(rt.kit.local(w2.foot).x));
    P.teleport(ball.center.clone().addScaledVector(d, -2.3).setY(G.arena.y + 0.1), V(0, 1, 0), V(0, 0, 1));
    ball.hit('push', d, { strength: 1 });
    until(() => w2.on, 8);
    if (G.state === 'open') { gained = fly(w2.foot.clone().add(V(0, 4, 0))); break; }
  }
  assert.ok(gained !== null && (gained > ROOST.still[1] + 1e-6 || G.phaseIndex > 1), `in the wind, twice (${gained?.toFixed(2)})`);
  A.done();
});
