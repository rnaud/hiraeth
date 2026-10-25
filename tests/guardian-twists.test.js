// The guardians' last phases ask for their temple's one idea (docs/systems/foes.md "The guardians' last phases",
// docs/audits/temple-design-v1.12.md's addendum): each played through in its own arena with a real Player, the
// failure first (it costs nothing but time), then the way through; and each taught a phase earlier, where the old
// way still works too.
//   the Cloud-Mother (the Founders' Belfry: a bell holds things only while it rings)   a ring as she rises to dive
//                     brings a stone down where she will dive; she lies on it, and the bell calms her
//   the Lampless (the Lamp-House: light can be carried)   lured to the pools you lit earlier, it drinks there
//   (the Mother Snapper, the Hush-House: outwitted since v1.83, issue #409: tests/mother-snapper.test.js)
//   the First Sign (the Undertower: a note travels)   it hears only through the dishes on its hall's wall
//   the Clockwork Foreman (the First Garage: count round from where the hand points)   its numerals from four
//   the Gardener (the Builders' Greenhouse: nothing grows in the shade)   its back blooms only in the sun, brought onto
//                     the quarter it kneels in from that quarter's footstone
//   the Elder (the Aerie: one wind, out wherever no stone stops it)   she takes heart only in the wind, the roost's
//                     stone rolled so it rises by her
//   the warden (the Warden's Well: the tower breathes through its vanes)   its crown hatch opens only to the draught
//                     of a turning vane, and the great vanes turn only under the jets' wash
//   the Tooth-Warden (the Engine-House: a ball in the teeth stops the engine there)   it turns on the hall's great gear,
//                     one vent facing out at a time, until a ball sits in the gear's teeth
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
import { GROUNDED, MOTHER_GASP } from '../src/temples/arzach2.js';
import { LURE } from '../src/temples/perdide2.js';
import { SUN } from '../src/temples/edena.js';
import { HALL, draught } from '../src/temples/incal.js';
import { allTargets, hitTarget } from '../src/targets.js';
import { bestInteractable } from '../src/interact.js';
import { setHintLevel } from '../src/hint-level.js';
import { answerAsks } from './guardian-asks.js';
import { comboOf } from '../src/temples/boss.js';
import { LENS_VIEW } from '../src/gadgets/hidden.js';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLE_HOME, templeOf } from '../src/temples/attachment.js';

// (these check the game's words as hints full says them, every tip and step; subtle, the default, is checked in tests/hint-level.test.js)
setHintLevel('full');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** A temple's world, a Player in its guardian's arena, and the guardian awake in phase `phase` (0, 1, 2…). */
function arena(id, gadget, phase, { answer = true } = {}) {
  game.reset();
  own('backpack', 'gun', gadget);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, id) ?? level.temple;
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
  if (G.def.helper) {
    assert.equal(G.state, 'sleep', `${id}: the helper waits peacefully`);
    return { level, rt, G, P, notes, frame, wait, until, said, stand, away, done: () => { rt.dispose?.(); game.reset(); own(); } };
  }
  assert.notEqual(G.state, 'sleep', `${id}: it wakes`);
  P.opts.health = false;
  assert.equal(until(() => G.state === 'fight', 8), true, `${id}: it fights`);
  if (phase > 0) { G.meter = G.floor = G.def.phases[phase - 1].to; }
  assert.equal(G.phaseIndex, phase);
  // (a phase that asks for a second verb first, src/temples/boss.js asks: answered as play does, tests/guardian-asks.js)
  if (answer && G.asking) assert.ok(answerAsks({ G, P, frame }), `${id}: its second verb answered (${G.phase.asks.verb})`);
  return { level, rt, G, P, notes, frame, wait, until, said, stand, away, done: () => { rt.dispose?.(); game.reset(); own(); } };
}

// ------------------------------------------------------------------ the Keeper
// The room's physical spokes remain; its old combat phases were replaced by the
// helping game (#623). Goal/quit/return are exercised in helper-temple-runtime.test.js.
test('the Keeper’s room: the hooded bowls still need burning spokes, but lighting them cannot skip the helping game', () => {
  const A = arena('desert', 'sword', 0);
  try {
    const { rt, G } = A;
    rt.piece('b6').hit('fire');
    assert.equal(rt.logic.isLit('b6'), false, 'hooded: no ember reaches its coals');
    for (const ball of rt.spokes) {
      ball.hit('blade', ball.dir.clone().multiplyScalar(-1), {});
      assert.equal(A.until(() => ball.rest && ball.t < .05, 10), true);
    }
    assert.deepEqual(['b6', 'b7', 'b8', 'b9'].map(id => rt.logic.isLit(id)), [true, true, true, true]);
    assert.equal(G.meter, 0); assert.equal(G.state, 'sleep');
    assert.equal(rt.logic.resolved, false); assert.notEqual(game.flag('temple.desert.done'), true);
  } finally { A.done(); }
});

test('the Keeper’s room: fluid and guard combat cannot complete a helper encounter', () => {
  const A = arena('desert', 'sword', 0);
  try {
    const { G } = A;
    assert.equal(G.def.helper, 'cistern');
    assert.equal(G.hit('mouth', 'shoot'), false); assert.equal(G.add(1, 'water'), false);
    G.wake(); A.wait(12);
    assert.equal(G.state, 'sleep'); assert.equal(G.meter, 0);
    assert.equal(G.attack, null); assert.equal(A.rt.logic.resolved, false);
  } finally { A.done(); }
});

// ------------------------------------------------------------------ the Echo
/** (issue #377) Which resonators wear the walker's print, each looked at through the raised seeing lens in turn (LENS_VIEW). */
function printsSeen(A) {
  const { rt, P } = A, out = [];
  for (const r of rt.resonators) {
    LENS_VIEW.k = 1; LENS_VIEW.eye.copy(P.pos).add(V(0, 1.7, 0)); LENS_VIEW.dir.subVectors(r.center, LENS_VIEW.eye).normalize();
    A.frame();
    if (r.print.visible) out.push(r);
  }
  LENS_VIEW.k = 0; A.frame();
  return out;
}
test('the Echo’s last phase: it sings three notes at once and all three spheres glow; a glowing one without the walker’s print is the wrong note, the one wearing it (through the lens) calms it', () => {
  const A = arena('spheres', 'monocle', 2);
  const { rt, G, until, said } = A;
  for (let n = 0; n < 4 && G.state !== 'weary'; n++) {
    assert.equal(until(() => G.state === 'open', 40), true, `it sings (${n})`);
    A.wait(0.4);
    assert.ok(rt.resonators.every((r) => r.k > 0.5), 'all three glow');
    assert.equal(rt.resonators.filter((r) => r.print.visible).length, 0, 'to the eye, no print');
    const prints = printsSeen(A);
    assert.equal(prints.length, 1, 'through the lens, one wears the walker’s print');
    assert.equal(prints[0].i, rt.sing);
    if (n === 0) {
      // the failure: a glowing sphere without the print
      const m = G.meter;
      rt.resonators[(rt.sing + 1) % 3].hit('shoot');
      assert.ok(G.meter <= m, 'the wrong note: no answer, it flinches');
      assert.ok(said(/different note/), 'it says so');
    }
    const m = G.meter;
    prints[0].hit('shoot');
    assert.ok(G.meter > m || G.state === 'weary', 'the walker’s: an answer');
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  A.done();
});

test('the Echo’s second phase teaches the print: only the sphere that answers glows, and through the lens it wears the walker’s print; without the lens, no print', () => {
  const A = arena('spheres', 'monocle', 1);
  const { rt, G, until } = A;
  assert.equal(until(() => G.state === 'open', 40), true, 'it sings');
  A.wait(0.4);
  assert.equal(rt.resonators.filter((r) => r.k > 0.5).length, 1, 'one glows');
  assert.deepEqual(printsSeen(A).map((r) => r.i), [rt.sing], 'through the lens, wearing the walker’s print');
  assert.equal(rt.resonators.some((r) => r.print.visible), false, 'the print shows only through the lens');
  const m = G.meter;
  rt.resonators[rt.sing].hit('shoot');
  assert.ok(G.meter > m, 'answered');
  A.done();
});

// ------------------------------------------------------------------ the Cloud-Mother
/** (issue #377) Her hall's bell nearest her, rung by the hook's bite on its pull-ring (src/temples/pieces.js HookBell). */
function hallBell(rt, G) {
  const bells = rt.pieces.filter((p) => p.id?.startsWith?.('hb.hall.')).sort((a, b) => a.at.distanceTo(G.model.pos) - b.at.distanceTo(G.model.pos));
  assert.equal(bells.length, 4, 'four bells round her hall');
  bells[0].hit('push', { mode: 'hook' });
}
test('the Cloud-Mother’s last phase: she never sinks to cry by herself; a ring as she rises to dive brings a stone down where she dives, she lies on it, and the bell calms her', () => {
  const A = arena('arzach2', 'hook', 2);
  const { rt, G, P, until, wait, said, away } = A;
  const ring = () => hallBell(rt, G);
  const S = rt.hallStones;
  assert.ok(S?.list.length >= 3, 'stones hang under her dome');
  // left alone she only gasps (v1.70, #319: an opening in every phase): a moment's cry, and a ring then calms her a
  // little (MOTHER_GASP); a ring between her moves brings nothing down
  let gasp = null;
  until(() => { if (G.state === 'open' && gasp === null) gasp = G.openFor; return said(/rises again/) && G.state === 'open'; }, 40);
  assert.ok(gasp !== null && gasp <= MOTHER_GASP.open + 1e-9, `in her last phase she only gasps by herself (${gasp})`);
  const m0 = G.meter;
  ring();
  assert.ok(G.meter > m0 && G.meter - m0 <= 0.1 * MOTHER_GASP.bell + 1e-9, `a ring as she gasps calms her a little (${(G.meter - m0).toFixed(3)})`);
  until(() => G.state === 'fight' && !G.attack, 10);
  const m1 = G.meter;
  ring();
  assert.ok(S.list.every((s) => s.held === 0), 'a ring between her moves brings no stone down');
  assert.ok(said(/rises out of its reach/), 'and says when to ring');
  assert.equal(G.meter, m1, 'nothing gained');
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
  const A = arena('arzach2', 'hook', 1);
  const { rt, G, P, until, away } = A;
  const ring = () => hallBell(rt, G);
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
test('the Lampless’s last phase: it shies from you; a pool lit earlier (a splash) lures it down, and it drinks there if you stand back', () => {
  const A = arena('perdide2', 'bubble', 2);
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
  // light a pool: a splash
  const [px, pz] = local(pools[0]);
  stand(px + 1, pz);
  hitTarget({ target: allTargets().find((x) => x.position() === pools[0].at), point: pools[0].at.clone() }, 'shoot');
  wait(0.5);
  assert.equal(pools[0].lit, true, 'a splash lights the pool');
  // the second failure: stay by the lit pool and it will not come down to drink
  assert.equal(until(() => G.state === 'open', 40), true, 'it searches again');
  stand(px + 1, pz);
  until(() => Math.hypot(G.model.pos.x - pools[0].at.x, G.model.pos.z - pools[0].at.z) < LURE.reach, 8);
  wait(LURE.drink + 0.5);
  assert.equal(G.meter, m0, 'not while you stand by the pool');
  assert.equal(pools[0].lit, true, 'the pool still lit');
  assert.ok(said(/won’t drink while you stand by it/), 'it shows it will not come while you stand by (no longer told to stand back)');
  // the way: stand back
  stand(px > 0 ? px - 9 : px + 9, pz + 4);
  assert.equal(until(() => G.meter > m0 || G.state === 'weary', 10), true, 'it drinks there');
  assert.equal(pools[0].lit, false, 'the pool drunk dark');
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  A.done();
});

test('the Lampless’s second phase teaches the pools: a splash lights one and it drinks there, and a bubble of light still works', () => {
  const A = arena('perdide2', 'bubble', 1);
  const { rt, G, P, until, stand, frame } = A;
  const c = G.arena.center, pool = rt.lurePools.list[2];
  // the first phase's way still: a bubble of light (issue #377) bursting on it as it searches
  assert.equal(until(() => G.state === 'open', 40), true, 'it searches');
  stand(G.model.pos.x - c.x + 6, G.model.pos.z - c.z);
  const m0 = G.meter;
  game.emit('bubble:light', { pos: G.model.pos.clone().add(V(0, 2, 0)) });
  assert.ok(G.meter > m0, 'it drinks the bubble’s light');
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

// (the Mother Snapper, outwitted since v1.83 and never fought: tests/mother-snapper.test.js, issue #409)

// ------------------------------------------------------------------ the First Sign
/** Stand under one of the First Sign's hall's low dishes (its mouth within reach). */
function underDish(A, id) {
  const d = A.rt.piece(id), m = d.ends[0].mouth, c = A.G.arena.center;
  const o = V(c.x - m.x, 0, c.z - m.z).setLength(1.2);
  A.stand(m.x + o.x - c.x, m.z + o.z - c.z);
  return d;
}

test('the First Sign’s last phase: it turns its dish up and hears its word only through the low dishes on the wall; played to its face, or the wrong word into a dish, nothing', () => {
  const A = arena('bazaar', 'recall', 2);
  const { rt, G, P, until, wait, said, stand } = A;
  const echo = (note) => game.emit('echo', { pos: P.pos.clone(), note });
  const word = 'sign.0', start = G.def.phases[1].to;   // (its last fight goes round its line from its first word, issue #418)
  assert.deepEqual(['signDishW', 'signDishE'].map((id) => !!rt.piece(id)), [true, true], 'two low dishes on the wall');
  // the failure: its word played close to it, as before
  assert.equal(until(() => G.state === 'open', 40), true, 'it stops to listen');
  stand(G.model.pos.x - G.arena.center.x + 4, G.model.pos.z - G.arena.center.z);
  echo(word);
  wait(1);
  assert.equal(G.meter, start, 'it does not hear it: its dish is turned up');
  assert.ok(said(/only what its cables bring/), 'it says where it listens now');
  assert.ok(G.model.pitch < 0, 'its dish turned up to the dark as it listens');
  // the wrong word into a dish: carried, and refused
  until(() => G.state !== 'open', 10);
  underDish(A, 'signDishW');
  assert.equal(until(() => G.state === 'open', 40), true, 'it listens again');
  echo('sign.2');
  wait(1);
  assert.equal(G.meter, start, 'another word of its line, through the dish: refused');
  assert.ok(said(/old word/), 'it shakes its dish');
  // the way: its word into the low dish
  until(() => G.state !== 'open', 10);
  underDish(A, 'signDishE');
  assert.equal(until(() => G.state === 'open', 40), true, 'it listens');
  echo(word);
  assert.equal(G.meter, start, 'a moment on its way up the dish and down the cable');
  wait(1);
  assert.ok(G.meter > start + 0.05, `retuned through its cables (${G.meter})`);
  assert.ok(said(/down the cable/), 'it says how it heard');
  A.done();
});

test('the First Sign’s puzzle between its fights (issue #418, G3d): it floods the cables with its word and hears nothing until the word is shut out at its hall’s relay; then it turns its dish to the stone of the word it wants, and wants its line in order', () => {
  const A = arena('bazaar', 'recall', 1);
  const { rt, G, P, until, wait, said, stand } = A;
  const echo = (note, at = G.model.mouth.clone().add(V(3, 0, 0))) => game.emit('echo', { pos: at, note });
  wait(3);
  assert.equal(G.phase.puzzle, true, 'a puzzle, not a fight: no moves of its own');
  assert.deepEqual(G.phase.attacks, []);
  assert.ok(rt.logic.drumOn('line', 'lineSpeaking'), 'it floods the cables: the house speaks');
  assert.ok(said(/floods every cable/));
  const m0 = G.meter;
  echo('sign.1'); wait(0.5);
  assert.equal(G.meter, m0, 'over its own word in the cables it hears nothing');
  assert.ok(said(/roars in the cables/));
  // the hall's relay, by the way in
  const lever = rt.piece('lever.hall');
  assert.ok(lever && lever.pos.distanceTo(G.arena.center) > G.arena.r - 6, 'a relay lever in its hall, by the way in');
  lever.rt.line.toggle('lever.hall');
  assert.equal(until(() => G.state === 'open', 4), true, 'the word shut out: it listens');
  const stones = rt.wordStones;
  assert.deepEqual(stones.map((s) => s.i).sort(), [1, 2, 3], 'three stones round the wall, a word of its line each');
  for (const i of [1, 2, 3]) {
    const want = stones.find((s) => s.i === i), h = Math.atan2(want.center.x - G.model.pos.x, want.center.z - G.model.pos.z);
    wait(1.5);
    assert.ok(Math.abs(Math.atan2(Math.sin(G.model.heading - h), Math.cos(G.model.heading - h))) < 0.5, `its dish turned to the stone of “${i}”`);
    const before = G.meter;
    echo(`sign.${i === 3 ? 1 : 3}`); wait(0.3);
    assert.equal(G.meter, before, 'not that word, not yet');
    echo(`sign.${i}`); wait(0.5);
    assert.ok(G.meter > before, `it hears its word (${i}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.phaseIndex, 2, 'its line given back: on into its last fight');
  A.done();
});

// ------------------------------------------------------------------ the Clockwork Foreman
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test('the Foreman’s last phase: open, its hands stop at four, and its six numerals take only in the clock’s order counted from four; out of step they all go dark', () => {
  const A = arena('garage', 'boomerang', 2);
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
  const A = arena('garage', 'boomerang', 1);
  const { rt, G, until, wait, said } = A;
  const shots = (list) => { for (const i of list) { rt.volley(i); wait(0.35); } };
  A.stand(0, -6);
  assert.equal(until(() => G.state === 'open', 40), true, 'its face opens');
  shots([0, 1, 2, 3, 4, 5]);
  assert.ok(G.meter > 0.5, `six from twelve still count here (${G.meter})`);
  assert.ok(!said(/in step, round from four/));
  A.done();
  const B = arena('garage', 'boomerang', 1);
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
  assert.ok(said(/In the shade nothing grows/), 'and it says to bring the sun');
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
test('the Elder’s roost: the rolling stone still swaps the active vent without awarding a flight', () => {
  const A = arena('arzach', 'glider', 0);
  try {
    const { rt, G, P } = A, winds = rt.roostWinds, ball = rt.piece('ballR');
    assert.equal(winds.length, 2); assert.ok(ball);
    const before = winds.map(w => w.on);
    assert.equal(before.filter(Boolean).length, 1);
    const d = ball.dir.clone().multiplyScalar(rt.logic.drumOn('ballR', 'pRW') ? 1 : -1);
    P.teleport(ball.center.clone().addScaledVector(d, -2.3).setY(G.arena.y + .1), V(0, 1, 0), V(0, 0, 1));
    ball.hit('push', d, { strength: 1 }); A.wait(4);
    assert.deepEqual(winds.map(w => w.on), before.map(on => !on), 'physical stone swaps the vents');
    assert.equal(G.state, 'sleep'); assert.equal(G.meter, 0); assert.equal(rt.logic.resolved, false);
  } finally { A.done(); }
});

test('the Elder’s roost: gliding in its wind no longer substitutes for reaching the Old Roost', () => {
  const A = arena('arzach', 'glider', 0);
  try {
    const { G, P, rt } = A, wind = rt.roostWinds.find(w => w.on);
    P.teleport(wind.foot.clone().add(V(0, 4, 0)), V(0, 1, 0), V(0, 0, 1));
    for (let i = 0; i < 5 / DT; i++) A.frame({ Space: true });
    assert.equal(G.def.helper, 'elderflight'); assert.equal(G.meter, 0);
    assert.equal(G.state, 'sleep'); assert.equal(rt.logic.resolved, false);
  } finally { A.done(); }
});

// ------------------------------------------------------------------ the warden
/**
 * (issue #377: the gust fan is the Warden's Well's tool, the bellows and the jets before) A swing of the fan at the vane from
 * beside it (its 'gust': src/gadgets/fan.js), then up its breath on the wings, held over it level with the warden's crown.
 */
function hoverOver(A, v) {
  const { G, P } = A;
  items.grant('glider');
  v.hit('gust');
  P.teleport(v.center.clone().add(V(0, Math.max(6.5, G.model.mouth.y - v.center.y + 1.2), 0)), V(0, 1, 0), V(0, 0, 1));
  for (let i = 0; i < 2.5 / DT && !(P.hovering && Math.abs(P.vel.y) < 0.3 && i > 30); i++) A.frame({ Space: true });
}
const nearestVane = (rt, G) => rt.hallVanes.slice().sort((a, b) => Math.hypot(a.center.x - G.model.pos.x, a.center.z - G.model.pos.z) - Math.hypot(b.center.x - G.model.pos.x, b.center.z - G.model.pos.z))[0];

test('the warden’s last phase: over its crown in still air the hatch slams; it backs onto a vane, and over that vane, fanned, its draught lifts the hatch', () => {
  const A = arena('incal', 'fan', 2);
  const { rt, G, P, until, wait, said } = A;
  assert.equal(rt.hallVanes?.length, 4, 'four great vanes in the floor');
  let stillTried = false;
  for (let n = 0; n < 6 && G.state !== 'resolved'; n++) {
    assert.equal(until(() => G.state === 'open', 40), true, `its hatch opens (${n})`);
    assert.ok(G.openFor >= HALL.open[2], `long enough to fly to the vane (${G.openFor})`);
    wait(2.6);
    const v = nearestVane(rt, G);
    assert.ok(Math.hypot(v.center.x - G.model.pos.x, v.center.z - G.model.pos.z) < HALL.back + 0.6, 'it backs onto a vane');
    if (!stillTried) {
      // the failure: right over its crown, but in still air (no vane turning): the hatch slams; it costs the opening's time
      stillTried = true;
      assert.equal(draught(rt), null, 'no vane turns');
      P.teleport(G.model.mouth.clone().add(V(3, 1.5, 0)), V(0, 1, 0), V(0, 0, 1));
      const before = G.meter;
      G.hit('mouth', 'shoot');
      assert.equal(G.meter, before, 'in still air the shot does nothing');
      assert.ok(said(/still air/), 'and it says why');
    }
    // the way: fan that vane, and hover over it: its draught holds the hatch up
    hoverOver(A, v);
    assert.equal(v.turning, true, 'the vane turns in the fan’s gust');
    assert.ok(draught(rt), 'its draught reaches the warden');
    const before = G.meter;
    G.hit('mouth', 'shoot');
    assert.ok(G.meter > before, `a hit goes in (${before.toFixed(3)} -> ${G.meter.toFixed(3)})`);
    for (let i = 0; i < 4 / DT && !P.onGround; i++) A.frame();
  }
  assert.equal(G.state, 'resolved', `broken (${G.meter.toFixed(2)})`);
  A.done();
});

test('the warden’s second phase teaches the vanes: a plain hit in its crown still counts, and over a turning vane twice as much', () => {
  const A = arena('incal', 'fan', 1);
  const { rt, G, P, until, wait } = A;
  assert.equal(until(() => G.state === 'open', 40), true, 'its hatch opens');
  P.teleport(G.model.mouth.clone().add(V(3, 1.5, 0)), V(0, 1, 0), V(0, 0, 1));
  const m0 = G.meter;
  G.hit('mouth', 'shoot');
  assert.ok(Math.abs(G.meter - m0 - HALL.hit) < 1e-6, `in still air, as before (${(G.meter - m0).toFixed(3)})`);
  for (let i = 0; i < 4 / DT && !P.onGround; i++) A.frame();
  assert.equal(until(() => G.state === 'open', 40), true, 'it opens again');
  wait(2.6);
  const v = nearestVane(rt, G);
  hoverOver(A, v);
  assert.ok(draught(rt), 'over a turning vane');
  const m1 = G.meter;
  G.hit('mouth', 'shoot');
  assert.ok(G.meter - m1 > HALL.hit + 1e-6 || G.phaseIndex > 1, `twice (${(G.meter - m1).toFixed(3)})`);
  A.done();
});

// ------------------------------------------------------------------ the Tooth-Warden
/** Roll the hall's ball into the great gear's teeth (from behind it, a push or two). */
function jamGear(A) {
  const { rt, P } = A, b = rt.piece('bG');
  for (let k = 0; k < 6 && !rt.logic.drumOn('bG', 'pG'); k++) {
    P.teleport(b.center.clone().addScaledVector(b.dir, -2.2).setY(b.group.position.y + 0.1), V(0, 1, 0), V(0, 0, 1));
    A.frame();
    b.hit('push', b.dir.clone(), { strength: 1 });
    A.wait(2.4);
  }
  return rt.logic.drumOn('bG', 'pG');
}

test('the Tooth-Warden’s last phase: it opens turning on its gear, one vent at a time, and four in a breath can’t be had; the ball rolled into the gear’s teeth, all four face out', () => {
  const A = arena('buried', 'cell', 2);
  const { rt, G, until, said } = A;
  assert.equal(rt.gearJammed(), false, 'the gear is free');
  assert.equal(until(() => G.state === 'open', 40), true, 'it opens');
  A.wait(0.2);
  assert.ok(G.model.only != null, 'one vent faces out');
  const m = G.meter;
  for (let i = 0; i < 4; i++) rt.volley(i);
  assert.equal(G.meter, m, 'the four in a breath can’t be had: nothing');
  assert.ok(said(/turned away/), 'it says the vents turn away');
  assert.equal(jamGear(A), true, 'the ball in the gear’s teeth');
  for (let n = 0; n < 4 && G.state !== 'resolved'; n++) {
    assert.equal(until(() => G.state === 'open', 40), true, `it opens (${n})`);
    assert.equal(G.model.only, null, 'jammed: all four face out');
    for (let i = 0; i < 4; i++) rt.volley(i);
  }
  assert.equal(G.state, 'resolved', `stopped (${G.meter.toFixed(2)})`);
  A.done();
});

test('the Tooth-Warden’s second phase teaches the gear: free, a volley counts as before; jammed, twice; and shifting it stamps the ball out', () => {
  const A = arena('buried', 'cell', 1);
  const { rt, G, until, said } = A;
  assert.equal(until(() => G.state === 'open', 40), true, 'it opens');
  const m0 = G.meter;
  for (let i = 0; i < 4; i++) rt.volley(i);
  assert.ok(Math.abs(G.meter - m0 - 0.125) < 1e-6, `the gear free: as before (${(G.meter - m0).toFixed(3)})`);
  assert.equal(jamGear(A), true, 'jammed');
  assert.equal(until(() => G.state === 'open', 40), true, 'it opens again');
  G.meter = G.floor = G.def.phases[0].to;   // (back to the phase's start: one jammed volley is the whole phase)
  for (let i = 0; i < 4; i++) rt.volley(i);
  assert.ok(G.meter >= G.def.phases[1].to - 1e-6, `jammed: twice, the phase in one volley (${G.meter.toFixed(3)})`);
  A.wait(0.5);
  assert.equal(G.phaseIndex, 2, 'into its last phase');
  assert.equal(rt.gearJammed(), false, 'it stamped the ball out of the teeth');
  assert.ok(said(/jumps out of its teeth/), 'and it says so');
  A.done();
});

// ------------------------------------------------------------------ a second verb (v1.63, #257)
test('five guardians’ second phase asks for a second verb before the gadget (src/temples/boss.js asks): until it is answered no opening comes and the gadget takes nothing; answered, it reels open and the gadget takes', () => {
  // (the Mother Snapper's push left with her fight, v1.83: issue #409)
  // (the First Sign's in its last fight since issue #418: its second phase is a puzzle)
  const SIX = [['arzach2', 'hook', 'parry'], ['perdide2', 'bubble', 'dodge'], ['edena', 'bloom', 'shot'], ['garage', 'boomerang', 'parry'], ['bazaar', 'recall', 'dodge', 2]];
  for (const [id, gadget, verb, phase = 1] of SIX) {
    const A = arena(id, gadget, phase, { answer: false });
    const { G, P, frame, until, said } = A, Q = G.phase.asks;
    assert.equal(Q?.verb, verb, `${id}: asks for ${verb}`);
    // (a move of its combos too: the Mother Snapper's second snap, reared as the first, v1.79 #373)
    const combos = G.phase.attacks.flatMap((m) => comboOf(G.def, m));
    assert.ok(Q.moves.length && Q.moves.some((m) => G.phase.attacks.includes(m)) && Q.moves.every((m) => combos.includes(m)), `${id}: a move of this phase answers it`);
    assert.ok(Q.hint && Q.said && Q.lines.length === 3 && [Q.hint, Q.said].every((l) => !l.includes('\n') && l.length < 110), `${id}: its lines, one each`);
    assert.equal(G.asking, true);
    // the gadget first: nothing, and it says what it waits for
    const m0 = G.meter;
    assert.equal(G.add(0.1, gadget), false, `${id}: the gadget takes nothing yet`);
    assert.equal(G.meter, m0);
    assert.ok(said(new RegExp(Q.hint.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))), `${id}: it says so`);
    // no opening of its own (a round of its moves, kept clear of them)
    const away = P.untouchable; if (verb !== 'dodge') P.untouchable = () => true;   // (a dodge's flurry is that verb's answer: hit instead)
    assert.equal(until(() => G.state === 'open', 25), false, `${id}: no opening of its own while it asks`);
    P.untouchable = away;
    // the verb: it reels open, the gadget takes, and the phase goes on as before
    assert.ok(answerAsks({ G, P, frame }, { keep: true }), `${id}: answered with the ${verb}`);
    assert.equal(G.state, 'open'); assert.ok(G.openFor >= Q.open - 1e-9);
    assert.equal(G.asking, false);
    assert.equal(G.add(0.05, gadget), true, `${id}: then the gadget takes`);
    A.done();
  }
});
