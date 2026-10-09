import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe, Foes, FOES, STRIKE_RISE } from '../src/foes.js';
import { CLIMB, HOP, ROUTE, PERCH, KNOCK, reachOf, linkOf, findRoute, findPerch, hopAt, knockedOff, knockedInto } from '../src/foe-height.js';
import { WORKS } from '../src/foes.js';
import { foeStatus } from '../src/hitboxes.js';
import { presenceOf, presenceProblems } from '../src/foe-presence.js';
import { clearTargets } from '../src/targets.js';
import { clearHazards } from '../src/hazards.js';
import { clearWorkings, workingsAt, registerWorking } from '../src/workings.js';
import { GameState } from '../src/game-state.js';

// Foes over the world's height (v1.4, docs/systems/foes.md "Foes over height"): the way up and down, the high
// ground, knocked off a ledge.

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
function player(at = v()) {
  return { pos: at, vel: v(), heading: 0, onGround: true, ride: null, down: null, dead: false, health: 1, opts: {}, hurts: [],
    hurt(a) { this.health = Math.max(0, this.health - a); this.hurts.push(a); }, knockDown() { return true; }, flinch() {} };
}
/** A height field as the physics' downward ray sees it: from `top` down `range` m; a top under the ground (inside a wall) finds nothing. */
const groundOf = (h) => (x, top, z, range = 6) => { const y = h(x, z); return y == null || y > top + 1e-6 || y < top - range ? null : y; };
const run = (f, P, env, secs, each = null) => { const ev = []; for (let i = 0; i < secs / DT; i++) { ev.push(...f.update(DT, P, env)); each?.(f, i * DT); if (!f.alive) break; } return ev; };
const fresh = () => { clearTargets(); clearHazards(); clearWorkings(); };

/** The Arena's ledge: 2 m up for z < -40 (x within ±7), and (with `ramp`) a ramp up to it at x within ±3 from z -30. */
const arena = ({ ramp = true, high = 2 } = {}) => (x, z) => {
  if (Math.abs(x) <= 7 && z <= -40 && z >= -48) return high;
  if (ramp && Math.abs(x) <= 3 && z < -30 && z > -40) return high * (-30 - z) / 10;
  return 0;
};

test('what a walker can cross: steps it walks, ledges a climber clambers, drops it hops down; a heavy one drops less', () => {
  assert.equal(linkOf(0.9, reachOf(FOES.machine)), 'walk');
  assert.equal(linkOf(2, reachOf(FOES.machine)), null, 'a machine does not clamber');
  assert.equal(linkOf(2, reachOf(FOES.blot)), 'clamber', 'a blot clambers a 2 m ledge');
  assert.equal(linkOf(3, reachOf(FOES.blot)), null, 'not 3 m');
  assert.equal(linkOf(-4, reachOf(FOES.blot)), 'drop');
  assert.equal(linkOf(-4, reachOf(FOES.machine)), null, 'a machine drops less far');
  assert.equal(linkOf(-2, reachOf(FOES.worm)), null, 'a worm under the sand only walks');
  for (const k of ['blot', 'shade', 'stalker', 'hound']) assert.ok(FOES[k].clamber, `${k} clambers`);
  assert.ok(FOES.spitter.perch, 'the spitter takes the high ground');
  // a hop arcs over the higher end, and ends where it was going
  const a = hopAt({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 0 }, 0.5), b = hopAt({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 0 }, 1);
  assert.ok(a.y >= 2 * 0.7 && a.x === 0.5, 'half way over, already near the top');
  assert.deepEqual([b.x, b.y], [1, 2]);
  assert.equal(knockedOff(1), null); assert.equal(knockedOff(2), 'dazed'); assert.equal(knockedOff(KNOCK.defeat), 'over');
});

test('the way up: a route round by the ramp for a machine, straight up the ledge for a blot; none past a wall it cannot take', () => {
  const env = { ground: groundOf(arena()) };
  const from = v(5, 0, -37), you = v(5, 2, -44);
  const m = findRoute(from, you, env, reachOf(FOES.machine), { stopAt: 1.4, rise: STRIKE_RISE - 0.4 });
  assert.ok(m, 'a machine finds a way');
  assert.ok(m.every((p) => p.how === 'walk'), 'all walking');
  assert.ok(m.some((p) => Math.abs(p.x) <= 3 && p.z < -32 && p.z > -39), 'by the ramp');
  const b = findRoute(from, you, env, reachOf(FOES.blot), { stopAt: 1.4, rise: STRIKE_RISE - 0.4 });
  assert.ok(b.some((p) => p.how === 'clamber'), 'a blot clambers straight up');
  assert.ok(b.cost < m.cost + 6 && b.length < m.length, 'the shorter way');
  // a ledge too high to clamber, no ramp: no way
  const tall = { ground: groundOf(arena({ ramp: false, high: 3.2 })) };
  assert.equal(findRoute(from, v(5, 3.2, -44), tall, reachOf(FOES.blot), { stopAt: 1.4 }), null);
  // down: a blot hops off, a machine walks round by the ramp
  const down = findRoute(v(5, 2, -44), v(5, 0, -36), env, reachOf(FOES.blot), { stopAt: 1.4 });
  assert.ok(down.some((p) => p.how === 'drop'), 'a blot hops down');
  const mDown = findRoute(v(5, 2, -44), v(5, 0, -36), { ground: groundOf(arena({ high: 3 })) }, reachOf(FOES.machine), { stopAt: 1.4 });
  assert.ok(mDown, 'a 3 m ledge: a machine finds a way down');
  const drops = mDown.map((p, i) => (i ? mDown[i - 1].y : 3) - p.y);
  assert.ok(Math.max(...drops) <= CLIMB.heavyDrop, `never more than ${CLIMB.heavyDrop} m down at once (by the ramp, off its side)`);
  assert.ok(mDown.some((p) => Math.abs(p.x) <= 3 && p.y > 0.5 && p.y < 2.9), 'on the ramp');
  // walls on the flat (canStep): round them, never through
  const wall = (o, x, z) => !(Math.sign(o.x - 0.01) !== Math.sign(x - 0.01) && Math.abs(z) < 4);
  const round = findRoute(v(-3, 0, 0), v(3, 0, 0), { ground: groundOf(() => 0) }, reachOf(FOES.machine), { stopAt: 1, canStep: wall });
  assert.ok(round && round.some((p) => Math.abs(p.z) >= 4), 'round the end of the wall');
});

test('a blot follows you up the ledge: a crouch you can see, then the leap; a machine walks round by the ramp', () => {
  fresh();
  const env = { ground: groundOf(arena()) };
  const P = player(v(5, 2, -44));
  const b = new Foe('blot', v(5, 0, -37), { rng: () => 0.5 }); b.state = 'chase'; b.cool = 99;
  let crouchedAt = null, hopped = null;
  const ev = run(b, P, env, 6, (f) => {
    if (f.hop && f.hop.t < HOP.crouch && !crouchedAt) crouchedAt = f.pos.clone();
    if (f.hop && f.hop.t > HOP.crouch && crouchedAt && !hopped) hopped = true;
  });
  assert.ok(crouchedAt && crouchedAt.y === 0, 'it crouched at the foot of the ledge first');
  assert.ok(ev.some((e) => e.type === 'hop' && e.how === 'clamber'), 'then clambered up');
  assert.ok(b.pos.y === 2 && b.pos.distanceTo(P.pos) < FOES.blot.reach + 0.5, `up beside you (${b.pos.toArray().map((n) => n.toFixed(1))})`);
  // a machine: by the ramp, no hops
  const m = new Foe('machine', v(5, 0, -37), { rng: () => 0.5 }); m.state = 'chase'; m.cool = 99;
  let onRamp = false;
  const mev = run(m, P, env, 14, (f) => { if (Math.abs(f.pos.x) <= 3 && f.pos.y > 0.4 && f.pos.y < 1.6) onRamp = true; });
  assert.ok(!mev.some((e) => e.type === 'hop'), 'no hops for a machine');
  assert.ok(onRamp, 'it went up the ramp');
  assert.ok(Math.abs(m.pos.y - 2) < 0.05 && Math.hypot(m.pos.x - P.pos.x, m.pos.z - P.pos.z) < FOES.machine.reach + 0.5, 'and up to you');
});

test('a blot hops down off the ledge after you; one that cannot reach you holds off in sight, not against the wall, and never swings at air', () => {
  fresh();
  const env = { ground: groundOf(arena()) };
  const b = new Foe('blot', v(6, 2, -44), { rng: () => 0.5 }); b.state = 'chase'; b.cool = 99;
  const ev = run(b, player(v(6, 0, -34)), env, 5);
  assert.ok(ev.some((e) => e.type === 'hop' && e.how === 'drop'), 'it hopped down');
  assert.equal(b.pos.y, 0);
  // a ledge 3.2 m up, no ramp: a machine can't get up, nor a blot
  const tall = { ground: groundOf(arena({ ramp: false, high: 3.2 })) };
  for (const kind of ['machine', 'blot']) {
    const f = new Foe(kind, v(4, 0, -36), { rng: () => 0.5 }); f.state = 'chase'; f.cool = 0;
    // (the blot's spit, the spitting blot's move folded in, is a lob: it goes up over the ledge; tests/archetypes.test.js)
    const all = f.attacksAt.bind(f); f.attacksAt = (d, dy) => all(d, dy).filter((a) => !a.lob);
    const P = player(v(4, 3.2, -42));
    const fev = run(f, P, tall, 8);
    assert.ok(!fev.includes('warn'), `${kind}: no blow wound up at you out of its reach`);
    assert.ok(f.waiting, `${kind}: waiting it out`);
    assert.ok(f.state === 'chase' && f.pos.z > -39.2, `${kind}: holding off below, off the wall (z ${f.pos.z.toFixed(1)})`);
    assert.ok(Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z) > ROUTE.hold - 1.5, `${kind}: out where it can see you`);
    // you come down: it comes on again
    P.pos.set(4, 0, -30);
    run(f, P, tall, 2);
    assert.ok(!f.waiting && Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z) < FOES[kind].reach + 0.6, `${kind}: on at you again`);
  }
});

test('a spitting blot climbs the ramp to the high ground, lobs down from there, and keeps its perch while you are below', () => {
  fresh();
  const env = { ground: groundOf(arena()), seen: () => true };
  const P = player(v(2, 0, -30));
  assert.ok(findPerch(v(-4, 0, -33), P.pos, env, { keep: FOES.spitter.keep, reach: FOES.spitter.reach }), 'there is a perch near');
  const s = new Foe('spitter', v(-4, 0, -33), { rng: () => 0.5 }); s.state = 'chase'; s.cool = 4;
  const ev = run(s, P, env, 9, (f) => { P.health = 1; });
  assert.ok(s.pos.y - P.pos.y >= PERCH.rise - 0.3 && s.pos.y - P.pos.y > STRIKE_RISE, `up the ramp, out of a blow's reach (y ${s.pos.y.toFixed(2)})`);
  assert.ok(s.perched != null, 'perched');
  assert.ok(ev.some((e) => e.type === 'strike' && e.atk.id !== undefined) || ev.includes('warn'), 'it struck from up there');
  // you walk round below it, in its reach: it keeps the high ground, lobbing down
  const top = s.pos.y;
  P.pos.set(s.pos.x + 5, 0, s.pos.z + 2);
  s.cool = 2;
  run(s, P, env, 3, () => { P.health = 1; });
  assert.ok(s.pos.y >= top - 0.5, `it kept the high ground (y ${s.pos.y.toFixed(2)})`);
  // you go off out of its reach: it comes down after you, as any spitter
  P.pos.set(s.pos.x + 14, 0, s.pos.z + 12);
  run(s, P, env, 8, () => { P.health = 1; });
  assert.equal(s.perched, null);
  assert.ok(s.pos.y < top - 0.8, `down after you (y ${s.pos.y.toFixed(2)})`);
});

test('knocked off a ledge by your blow: dazed a long while with stars, a cut lands double; from high enough it is over; a gust is not you', () => {
  fresh();
  const P = player(v(0, 2, -30));
  const sounds = [], notes = [];
  const physics = (h) => ({ groundAt: (x, y, z, r = 600) => groundOf(h)(x, y, z, r) ?? -Infinity, rayDistance: () => Infinity, rayHit: () => null });
  const make = (h) => {
    const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: physics(h), player: P,
      sound: { foeHurt: (k) => sounds.push(`hurt:${k}`), foeBurst: (k) => sounds.push(`burst:${k}`), foeWarn() {}, combat() {}, whoosh() {} },
      settings: { enemies: 'normal' }, game: new GameState(null), notice: (t) => notes.push(t) });
    foes.waveRest = 1e9;
    return foes;
  };
  // a 2 m ledge (the Arena's): a cut toward the edge carries a blot off
  const foes = make(arena());
  const b = foes.add('blot', v(5, 2, -40.3)); b.state = 'chase'; b.cool = 5;
  foes.hurt(b, 'blade', v(0, 0, 1), { damage: 1, combo: 2 });
  for (let i = 0; i < 1.2 / DT; i++) foes.update(DT);
  assert.ok(b.alive && b.pos.y === 0, 'down on the sand');
  assert.ok(b.dazed > KNOCK.stun - 1.3 && b.stunned > 1.5, `dazed a long while (${b.dazed.toFixed(2)} s)`);
  assert.equal(b.hp, FOES.blot.hp - 1, 'its cut; the fall itself only dazes');
  assert.ok(b.stars?.visible, 'stars turn over it');
  assert.ok(notes.some((n) => /dazed/.test(n)), 'said once');
  const probs = presenceProblems(presenceOf(b.model.group, b.pos.y));
  assert.deepEqual(probs, [], 'still reads as itself');
  // a machine off a 6 m drop: over
  const deep = make(arena({ ramp: false, high: 6 }));
  const m = deep.add('machine', v(0, 6, -40.4)); m.state = 'chase';
  deep.hurt(m, 'push', v(0, 0, 1), { shove: 3 });
  for (let i = 0; i < 2 / DT; i++) deep.update(DT);
  assert.ok(!m.alive, 'a 6 m knock-off ends even a machine');
  // a gust carries one off: an ordinary landing, no daze (only your blows count)
  const g = make(arena());
  const c = g.add('blot', v(5, 2, -40.4)); c.state = 'chase'; c.cool = 5;
  c.vel.set(0, 0, 7);
  for (let i = 0; i < 1.2 / DT; i++) g.update(DT);
  assert.ok(c.pos.y === 0 && !(c.dazed > 0) && c.hp === FOES.blot.hp, 'just down');
  // the charged cut throws further than the first swing
  const t = (info) => { const f = new Foe('blot', v(0, 0, 0)); f.hit('blade', v(1, 0, 0), info); return f.vel.x; };
  assert.ok(t({ damage: 2, breaks: true }) > t({ damage: 1 }) * 2, 'the charged cut throws hard');
  for (const F of [foes, deep, g]) F.dispose();
  fresh();
});

test('struck in the middle of a hop: crouched it stays, in the air it falls from there (and dazed if you knocked it)', () => {
  fresh();
  const env = { ground: groundOf(arena()) };
  const P = player(v(5, 2, -44));
  const b = new Foe('blot', v(5, 0, -37), { rng: () => 0.5 }); b.state = 'chase'; b.cool = 99;
  let struck = false, crouched = null;
  const ev = run(b, P, env, 2.5, (f) => {
    if (f.hop && f.hop.t > HOP.crouch + 0.1 && !struck) { struck = true; f.hit('blade', v(0, 0, 1), { damage: 1 }); }
  });
  assert.ok(struck && b.alive, 'struck in the air');
  assert.ok(ev.some((e) => e.type === 'landed'), 'it fell back down from there, its hop broken off');
  // struck while crouched: it stays where it was, on its feet
  const c = new Foe('blot', v(5, 0, -37), { rng: () => 0.5 }); c.state = 'chase'; c.cool = 99;
  run(c, P, env, 2.5, (f) => { if (f.hop && f.hop.t < HOP.crouch * 0.5 && !crouched) { crouched = f.hop.from.clone(); f.hit('blade', v(0, 0, 1), { damage: 1 }); } });
  assert.ok(crouched && c.alive && !c.air, 'struck crouched: no fall');
});

test('knocked into deep water: swept away with a splash, off a bank or a ledge; shallow water, or a gust, not', () => {
  fresh();
  assert.equal(knockedInto(0.5), null); assert.equal(knockedInto(KNOCK.deep), 'swept');
  const P = player(v(0, 2, -30));
  const splashes = [], notes = [];
  const physics = (h) => ({ groundAt: (x, y, z, r = 600) => groundOf(h)(x, y, z, r) ?? -Infinity, rayDistance: () => Infinity, rayHit: () => null });
  // a pond for z > -40 (its surface `top`); the ground `h`
  const make = (h, top) => {
    const waters = { surfaceAt: (x, z, y) => (z > -40 && top >= y - 0.6 ? { y: top, body: {} } : null), splash: (p, s, k) => splashes.push({ s, k }) };
    const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: physics(h), player: P, waters,
      sound: { foeHurt() {}, foeBurst() {}, foeWarn() {}, combat() {}, whoosh() {} }, settings: { enemies: 'normal' }, game: new GameState(null), notice: (t) => notes.push(t) });
    foes.waveRest = 1e9;
    return foes;
  };
  const tick = (F, s) => { for (let i = 0; i < s / DT; i++) F.update(DT); };
  // off a low bank (0.9 m, a step: no fall) into water 1.4 m deep: swept
  const bank = make((x, z) => (z > -40 ? -0.9 : 0), 0.5);
  const b = bank.add('blot', v(0, 0, -40.3)); b.state = 'chase'; b.cool = 5;
  bank.hurt(b, 'push', v(0, 0, 1), { shove: 3 });
  tick(bank, 1);
  assert.ok(!b.alive, 'swept away');
  assert.ok(splashes.some((x) => x.k >= 2 && x.s === 0.5), 'a great splash on its surface');
  assert.ok(notes.some((n) => /swept/.test(n)), 'said once');
  // off the 2 m ledge into a pond 1.5 m deep: swept, not dazed; even a machine
  const ledge = make((x, z) => (z > -40 ? -2 : 0), -0.5);
  const m = ledge.add('machine', v(0, 0, -40.4)); m.state = 'chase';
  ledge.hurt(m, 'push', v(0, 0, 1), { shove: 3 });
  tick(ledge, 2);
  assert.ok(!m.alive, 'a machine knocked off into deep water is swept away');
  // shallow (0.5 m): it wades, alive
  const shallow = make((x, z) => (z > -40 ? -0.5 : 0), 0);
  const c = shallow.add('blot', v(0, 0, -40.3)); c.state = 'chase'; c.cool = 5;
  shallow.hurt(c, 'push', v(0, 0, 1), { shove: 3 });
  tick(shallow, 1);
  assert.ok(c.alive && c.pos.z > -40, 'wading in the shallows');
  // a gust carries one into deep water: not your knock, it lives
  const g = make((x, z) => (z > -40 ? -0.9 : 0), 0.5);
  const d = g.add('blot', v(0, 0, -40.3)); d.state = 'chase'; d.cool = 5;
  d.vel.set(0, 0, 7);
  tick(g, 1);
  assert.ok(d.alive, 'only your blows sweep a foe away');
  // a sea whose bed is walked (the Underwater City) is not water to knock into
  const sea = make((x, z) => (z > -40 ? -0.9 : 0), 0.5);
  sea.waters.surfaceAt = (x, z, y) => ({ y: 40, body: { sea: {} } });
  const e = sea.add('blot', v(0, 0, -40.3)); e.state = 'chase'; e.cool = 5;
  sea.hurt(e, 'push', v(0, 0, 1), { shove: 3 });
  tick(sea, 1);
  assert.ok(e.alive, 'on a sea bed: alive');
  for (const F of [bank, ledge, shallow, g, sea]) F.dispose();
  fresh();
});

test('a stilled temple crystal: its frost holds a foe that touches it a few seconds, no harm; it walks out after', () => {
  fresh();
  const S = { moving: false };
  const off = registerWorking({ kind: 'swing', center: v(0, 1, 0), radius: 1.9, contains: (p) => Math.hypot(p.x, p.z) < 1.9 && Math.abs(p.y + 0.9 - 1) < 2.6, moving: () => S.moving, push: (p, out) => out.set(1, 0, 0) });
  const env = { ground: groundOf(() => 0), workings: (p, kind) => workingsAt(p, kind) };
  const P = player(v(0, 0, 12));
  const f = new Foe('blot', v(0.4, 0, 0), { rng: () => 0.5 }); f.state = 'chase';
  const ev = f.update(DT, P, env);
  assert.ok(ev.some((e) => e.type === 'frosted'), 'frosted');
  assert.ok(Math.abs(f.stunned - WORKS.swing.frost) < 0.05 && f.hp === FOES.blot.hp, 'held, unharmed');
  assert.ok(f.vel.lengthSq() === 0, 'not knocked: held where it touched it');
  const was = f.pos.clone();
  run(f, P, env, WORKS.swing.frost - 0.2);
  assert.ok(f.pos.distanceTo(was) < 0.01 && f.stunned > 0, 'still held');
  const more = run(f, P, env, 2);
  assert.ok(!more.some((e) => e.type === 'frosted') && f.pos.distanceTo(was) > 0.5, 'then free, walking out, not taken again at once');
  // moving again, it knocks as ever
  S.moving = true;
  const g = new Foe('blot', v(0.4, 0, 0), { rng: () => 0.5 }); g.state = 'chase';
  assert.ok(g.update(DT, P, env).some((e) => e.type === 'swung'), 'a swinging crystal knocks');
  off(); fresh();
});

test('the debug overlay names a foe waiting, perched, dazed or hopping', () => {
  const f = new Foe('blot', v());
  f.dazed = 2; f.stunned = 2;
  assert.match(foeStatus(f), /dazed 2\.0s/);
  assert.doesNotMatch(foeStatus(f), /stunned/, 'dazed says so, not stunned');
  f.dazed = 0; f.stunned = 0; f.perched = 3;
  assert.match(foeStatus(f), /perched/);
  f.perched = null; f.waiting = true;
  assert.match(foeStatus(f), /waiting/);
  f.waiting = false; f.hop = { t: 0.1 };
  assert.match(foeStatus(f), /crouched/);
  f.hop.t = HOP.crouch + 0.1;
  assert.match(foeStatus(f), /hopping/);
});

test('the archetypes (src/enemies/archetypes.js) go by the same rules: up the ledge after you, no swing out of reach, swept away in deep water, held by a stilled crystal', async () => {
  fresh();
  // a horn lizard clambers the ledge; a lamp tripod comes round by the ramp
  const P = player(v(5, 2, -44)), env = { ground: groundOf(arena()) };
  const liz = new Foe('lizard', v(5, 0, -37), { rng: () => 0.5 }); liz.state = 'chase'; liz.cool = 99;
  const ev = run(liz, P, env, 6);
  assert.ok(ev.some((e) => e.type === 'hop' && e.how === 'clamber'), 'the lizard clambered up');
  assert.ok(liz.pos.y === 2, 'up beside you');
  const tri = new Foe('tripod', v(5, 0, -30), { rng: () => 0.5 }); tri.state = 'chase'; tri.cool = 99;
  const tev = run(tri, player(v(5, 2, -46)), env, 4);
  assert.ok(!tev.some((e) => e.type === 'hop'), 'no hops for a machine');
  // out of reach above it, no melee wind-up at air: a crab can't climb, it waits below
  const tall = { ground: groundOf(arena({ ramp: false, high: 3.2 })) };
  const crab = new Foe('crab', v(4, 0, -36), { rng: () => 0.5 }); crab.state = 'chase'; crab.cool = 0;
  const cev = run(crab, player(v(4, 3.2, -42)), tall, 8);
  assert.ok(!cev.includes('warn') && crab.waiting, 'waiting below, no blow at air');
  // a stilled crystal's frost holds an archetype too
  const S = { moving: false };
  const off = registerWorking({ kind: 'swing', center: v(0, 1, 0), radius: 1.9, contains: (p) => Math.hypot(p.x, p.z) < 1.9 && Math.abs(p.y + 0.9 - 1) < 2.6, moving: () => S.moving, push: (p, out) => out.set(1, 0, 0) });
  const hound = new Foe('hound', v(0.4, 0, 0), { rng: () => 0.5 }); hound.state = 'chase';
  assert.ok(hound.update(DT, player(v(0, 0, 12)), { ground: groundOf(() => 0), workings: (p, kind) => workingsAt(p, kind) }).some((e) => e.type === 'frosted'), 'frosted');
  off();
  // knocked off a bank into deep water: swept away
  const physics = { groundAt: (x, y, z, r = 600) => groundOf((x, z) => (z > -40 ? -0.9 : 0))(x, y, z, r) ?? -Infinity, rayDistance: () => Infinity, rayHit: () => null };
  const waters = { surfaceAt: (x, z, y) => (z > -40 && 0.5 >= y - 0.6 ? { y: 0.5, body: {} } : null), splash() {} };
  const F = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics, player: player(v(0, 2, -30)), waters,
    sound: { foeHurt() {}, foeBurst() {}, foeWarn() {}, combat() {}, whoosh() {} }, settings: { enemies: 'normal' }, game: new GameState(null), notice() {} });
  F.waveRest = 1e9;
  const crabby = F.add('crab@saltharbour', v(0, 0, -40.3)); crabby.state = 'chase'; crabby.cool = 5;
  assert.equal(crabby.skin, 'saltharbour');
  F.hurt(crabby, 'push', v(0, 0, 1), { shove: 3 });
  for (let i = 0; i < 1 / DT; i++) F.update(DT);
  assert.ok(!crabby.alive, 'the anchor crab is swept away');
  F.dispose(); fresh();
});
