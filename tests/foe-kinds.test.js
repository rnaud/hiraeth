import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe, Foes, FOES, GENTLE, WAVES, attackOf, packKinds, waveWords } from '../src/foes.js';
import { KINDS, NOTES, kindModel } from '../src/foe-kinds.js';
import { ROSTERS, CLASSIC, GROUP, rosterOf, packOf, guardKinds, templeKind } from '../src/foe-worlds.js';
import { TITLES } from '../src/levels/names.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

// Each world's own foes (src/foe-kinds.js), the new attacks of the old ones, the world rosters (src/foe-worlds.js).

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const env = { ground: () => 0, seen: () => true };
function player(at = v(), o = {}) {
  return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: [], knocks: 0, flinches: 0,
    hurt(a) { this.health = Math.max(0, this.health - a); this.hurts.push(a); }, knockDown() { this.knocks++; return true; }, flinch() { this.flinches++; }, ...o };
}
/** Run a foe until it winds up attack `id` (or any), returning the frame's events on the way. */
function untilWind(f, P, id = null, secs = 12) {
  for (let i = 0; i < secs / DT; i++) { f.update(DT, P, env); if (f.state === 'wind' && (!id || f.atk.id === id)) return true; P.health = 1; }
  return false;
}
const runFor = (f, P, secs) => { const ev = []; for (let i = 0; i < secs / DT; i++) ev.push(...f.update(DT, P, env)); return ev; };
const strikes = (ev) => ev.filter((e) => e?.type === 'strike');
const world = (P, o = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), ...o });
/** A foe that only ever uses attack `id` (its others taken out of reach). */
function only(kind, id, at = v(), o = {}) {
  const f = new Foe(kind, at, { rng: () => 0.5, ...o });
  f.attacksAt = (d) => { const a = attackOf(kind, id); return d <= (a.max ?? f.def.reach) && d >= (a.min ?? 0) ? [a] : []; };
  return f;
}

test('eight new kinds (and the golem’s splinters), each with two or three telegraphed attacks, a note and a look of its own', () => {
  const fresh = Object.keys(KINDS);
  assert.ok(fresh.length >= 8, `${fresh.length} kinds`);
  for (const k of fresh) {
    const D = FOES[k];
    assert.ok(D.hp > 0 && D.radius > 0 && D.speed > 0 && D.name, k);
    const main = D.attacks.filter((a) => !a.chain);
    if (!D.noWild) assert.ok(main.length >= 2 && main.length <= 3, `${k}: ${main.length} attacks`);
    for (const a of D.attacks) {
      assert.ok(['ring', 'cone', 'lane'].includes(a.shape) && a.wind > 0 && a.damage >= 0, `${k}.${a.id}`);
      if (a.chain) assert.ok(a.wind < 0.5, `${k}.${a.id}: a follow-up is quick`);
      else assert.ok(a.wind >= 0.45, `${k}.${a.id}: a wind-up you can read (${a.wind} s)`);
      if (a.then) assert.ok(attackOf(k, a.then), `${k}.${a.id} → ${a.then}`);
      assert.ok((a.max ?? D.reach) <= D.reach + 1e-9, `${k}.${a.id} within its reach`);
      // ranged and area strikes are drawn on the floor; a lane or a lob always is
      if (a.shape === 'lane' || a.at === 'target' || a.at === 'behind') assert.ok(a.tele || a.at === 'target' || a.at === 'behind' || a.dive, `${k}.${a.id} drawn`);
    }
    if (!D.noWild) assert.ok(NOTES[k] && /LB \/ L1|move|cut|bomb|ember|shot|gust/i.test(NOTES[k]), `${k}: what beats it, said once`);
    const M = kindModel(k);
    let meshes = 0; M.group.traverse((o) => { meshes += o.isMesh ? 1 : 0; });
    assert.ok(meshes >= 2 && typeof M.anim === 'function', `${k} is drawn`);
  }
  assert.equal(waveWords(['crab', 'crab', 'hound']), '2 salt crabs and 1 shadow hound');
  for (const k of fresh) if (!FOES[k].noWild) assert.ok(WAVES.some((w) => w.includes(k)), `${k} in the Arena's waves`);
});

test('every kind moves and animates in a world without errors, through every attack', () => {
  clearTargets();
  for (const kind of Object.keys(FOES)) {
    const P = player(v(0, 0, 0)), foes = world(P);
    foes.waveRest = 1e9;
    const f = foes.add(kind, v(0, 0, 5));
    const seen = new Set();
    for (let i = 0; i < 25 / DT; i++) { foes.update(DT); P.health = 1; P.down = null; if (f.state === 'wind') seen.add(f.atk.id); if (i % 200 === 0) P.pos.set(Math.sin(i) * 3, 0, Math.cos(i) * 3); }
    assert.ok(seen.size >= 1, `${kind} attacked (${[...seen]})`);
    foes.dispose(); clearTargets();
  }
});

test('the dune ray swims under the sand: no blade reaches it there, its ring follows you then holds, and it bursts up there', () => {
  const r = only('ray', 'erupt'), P = player(v(0, 0, 6));
  assert.equal(r.buried, true);
  assert.equal(r.hit('blade', v(0, 0, 1), { damage: 2 }), false, 'the blade finds only sand');
  assert.ok(untilWind(r, P, 'erupt'));
  P.pos.set(1, 0, 6); runFor(r, P, 0.2);
  assert.ok(r.attackAt.distanceTo(v(1, 0, 6)) < 0.01, 'the ring follows you while it tracks');
  // past the tracking, it holds: step out and it misses; it is up and open after
  runFor(r, P, FOES.ray.attacks[0].wind * FOES.ray.attacks[0].track);
  const held = r.attackAt.clone();
  P.pos.set(6, 0, 6);
  const ev = runFor(r, P, 1);
  assert.ok(r.attackAt.distanceTo(held) < 0.01, 'then the ring holds');
  assert.equal(strikes(ev)[0]?.hit, false, 'stepped out: it misses');
  assert.equal(r.buried, false, 'it came up');
  assert.ok(r.pos.distanceTo(held) < 0.01, 'where the ring was');
  assert.equal(r.hit('blade', v(0, 0, 1), { damage: 1 }), true, 'surfaced, it can be cut');
  // a bomb or a stomp flushes a buried one out, dazed
  const s = new Foe('ray', v());
  assert.equal(s.hit('blade', v(1, 0, 0), { damage: 2, source: 'bomb' }), true);
  assert.ok(!s.buried && s.stunned > 1, 'flushed out and dazed');
  // standing in it: it lands, and knocks you down
  clearTargets();
  const Q = player(v(0, 0, 6)), foes = world(Q), g = foes.add('ray', v());
  g.attacksAt = (d) => [attackOf('ray', 'erupt')];
  let hit = false;
  for (let i = 0; i < 6 / DT && !hit; i++) { foes.update(DT); hit = Q.knocks > 0; }
  assert.ok(hit && Q.hurts.length === 1, 'burst up under you: knocked down');
  foes.dispose(); clearTargets();
});

test('the glass golem: shots turn off it, bombs crack it deep, a perfect parry chips it, and it breaks into splinters', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  foes.waveRest = 1e9;
  const g = foes.add('golem', v(0, 0, 2.5));
  foes.hurt(g, 'shoot', v(0, 0, 1)); assert.equal(g.hp, FOES.golem.hp, 'glass turns a shot');
  foes.hurt(g, 'blade', v(0, 0, 1), { damage: 1, source: 'bomb' }); assert.equal(g.hp, FOES.golem.hp - 2, 'a bomb: twice as deep');
  // a perfect parry of its slam breaks a piece off
  P.guard = () => 'perfect';
  const hp = g.hp;
  foes.strike(g, attackOf('golem', 'slam'));
  assert.equal(g.hp, hp - 1, 'chipped');
  assert.ok(g.stunned > 0 && P.hurts.length === 0, 'and stunned, no harm');
  P.guard = null;
  while (g.alive) foes.hurt(g, 'blade', v(0, 0, 1), { damage: 1 });
  const splinters = foes.list.filter((f) => f.kind === 'splinter' && f.alive);
  assert.equal(splinters.length, FOES.golem.splits.n, 'its splinters come on');
  assert.ok(splinters.every((s) => s.state === 'chase'));
  foes.dispose(); clearTargets();
});

test('sign moths: a flash blinds only when you look at it; a gust or a cut ends one', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  foes.camera = new THREE.PerspectiveCamera(); foes.camera.position.set(0, 1.6, -3); foes.camera.lookAt(0, 1.6, 10); foes.camera.updateMatrixWorld();
  const m = foes.add('moth', v(0, 0, 4)), flash = attackOf('moth', 'flash');
  assert.equal(foes.strike(m, flash), true, 'looking at it: blinded');
  assert.ok(foes.blinded > 1, 'for a while');
  const behind = foes.add('moth', v(0, 0, -4));
  foes.blinded = 0;
  assert.equal(foes.strike(behind, flash), false, 'behind you: nothing');
  assert.equal(foes.blinded, 0);
  assert.equal(new Foe('moth', v()).hit('push', v(0, 0, 1), { shove: 2, source: 'gust' }), 'burst', 'a gust ends it');
  // gentle: a shorter white
  const G = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'gentle' }, game: new GameState(null), camera: foes.camera });
  G.strike(G.add('moth', v(0, 0, 4)), flash);
  assert.ok(G.blinded < foes.blinded + flash.blind && G.blinded <= flash.blind * 0.6 + 1e-9, 'gentle: shorter');
  foes.dispose(); G.dispose(); clearTargets();
});

test('the rust drone: its harpoon line pulls you in until it is cut; guarded, the line is cut and the drone dazed; the magnet takes it', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  foes.waveRest = 1e9;
  const d = foes.add('drone', v(0, 0, 7)), harpoon = attackOf('drone', 'harpoon');
  assert.ok(FOES.drone.metal && FOES.drone.hover > 1.5, 'metal, out of the blade’s reach');
  assert.equal(foes.strike(d, harpoon), true);
  assert.equal(foes.hold?.f, d, 'the line holds you');
  for (let i = 0; i < 10; i++) foes.updateHold(DT);
  assert.ok(P.vel.z > 5, 'pulled toward it');
  foes.hurt(d, 'blade', v(0, 0, 1), { damage: 1 });
  foes.updateHold(DT);
  assert.equal(foes.hold, null, 'cut: it lets go');
  // guarded: no hold, the drone dazed
  P.guard = () => true;
  const e = foes.add('drone', v(3, 0, 7));
  assert.equal(foes.strike(e, harpoon), false);
  assert.equal(foes.hold, null);
  assert.ok(e.stunned >= 1, 'the line cut, it reels');
  foes.dispose(); clearTargets();
});

test('the root stalker: roots along the ground grab and drag you in, then it lashes; a cut breaks the hold; a bloom puts it to sleep; embers burn it', () => {
  const s = only('stalker', 'grab'), P = player(v(0, 0, 5));
  assert.ok(untilWind(s, P, 'grab'));
  assert.equal(s.atk.tele, true, 'its roots are drawn on the floor');
  const ev = runFor(s, P, attackOf('stalker', 'grab').wind + 0.4);
  assert.equal(strikes(ev)[0]?.hit, true);
  assert.equal(s.state, 'wind'); assert.equal(s.atk.id, 'lash', 'the grab runs straight into a lash');
  clearTargets();
  const Q = player(v(0, 0, 0)), foes = world(Q), t = foes.add('stalker', v(0, 0, 5));
  foes.strike(t, attackOf('stalker', 'grab'));
  assert.equal(foes.hold?.kind, 'grab');
  foes.hurt(t, 'blade', v(0, 0, 1), { damage: 1 }); foes.updateHold(DT);
  assert.equal(foes.hold, null, 'cut free');
  const b = new Foe('stalker', v());
  b.hit('bloom', v(0, 0, 1));
  assert.ok(b.sleep > 2 && b.stunned > 2, 'asleep in flower');
  assert.equal(b.hit('blade', v(0, 0, 1), { damage: 1 }), true); assert.equal(b.hp, FOES.stalker.hp - 2, 'and cut twice as deep');
  const c = new Foe('stalker', v()); c.hit('fire', v(0, 0, 1));
  assert.equal(c.hp, FOES.stalker.hp - 2, 'an ember burns it');
  foes.dispose(); clearTargets();
});

test('the salt crab: the blade glances off its shell from the front; from behind it cuts; a guarded spin flips it; a bomb cracks the shell', () => {
  const c = new Foe('crab', v()); c.heading = 0;   // (facing +z)
  assert.equal(c.hit('blade', v(0, 0, -1), { damage: 1 }), 'glance', 'from the front');
  assert.equal(c.hp, FOES.crab.hp);
  assert.equal(c.hit('blade', v(0, 0, 1), { damage: 1 }), true, 'from behind');
  assert.equal(c.hp, FOES.crab.hp - 1);
  clearTargets();
  const P = player(v(0, 0, 0), { guard: () => true }), foes = world(P);
  const s = foes.add('crab', v(0, 0, 3)); s.heading = Math.PI;
  assert.equal(foes.strike(s, attackOf('crab', 'spin')), false);
  assert.ok(s.flipped > 2 && s.stunned > 2, 'on its back');
  assert.equal(s.hit('blade', v(0, 0, 1), { damage: 1 }), true, 'flipped: the front is open');
  const b = new Foe('crab', v()); b.heading = 0;
  b.hit('blade', v(0, 0, -1), { damage: 2, source: 'bomb' });
  assert.equal(b.shelled, false, 'a bomb cracks it');
  assert.equal(b.hp, FOES.crab.hp - 3, 'and bites half again as deep');
  assert.equal(b.hit('blade', v(0, 0, -1), { damage: 1 }), 'burst', 'cracked: no more glancing');
  // the spin: a charge along its lane; stepping off the lane, it runs past
  const r = only('crab', 'spin'), Q = player(v(0, 0, 6));
  assert.ok(untilWind(r, Q, 'spin'));
  Q.pos.set(4, 0, 6);
  const ev = runFor(r, Q, 2);
  assert.equal(strikes(ev)[0]?.hit, false, 'off its lane: it misses');
  assert.ok(r.pos.z > 4, 'it ran on along the lane');
  foes.dispose(); clearTargets();
});

test('the slag walker: it treads burning slag; standing in it hurts (never all of a healthy bar), a shot cools its crust and cooled it cuts twice as deep', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  foes.waveRest = 1e9;
  const s = foes.add('slag', v(0, 0, 12));
  for (let i = 0; i < 3 / DT; i++) { foes.update(DT); P.health = 1; }
  assert.ok((foes.patches?.length ?? 0) >= 1, 'it leaves slag where it walks');
  const p = foes.patches[0];
  P.pos.copy(p.pos); P.hurts.length = 0;
  for (let i = 0; i < 1 / DT; i++) foes.updateHazards(DT);
  assert.ok(P.hurts.length >= 1 && P.hurts.length <= 2, 'standing in it burns, now and then');
  P.onGround = false; P.hurts.length = 0; foes.burnCool = 0;
  foes.updateHazards(DT);
  assert.equal(P.hurts.length, 0, 'in the air over it: nothing');
  const hp = s.hp;
  foes.hurt(s, 'shoot', v(0, 0, 1));
  assert.ok(s.crust > 0, 'a shot cools it');
  foes.hurt(s, 'blade', v(0, 0, 1), { damage: 1 });
  assert.equal(s.hp, hp - 3, 'the shot (1), then the cut twice as deep (2)');
  // a stomp leaves a ring of slag round it
  const n = foes.patches.length;
  foes.leaveSlag(s, attackOf('slag', 'stomp'));
  assert.ok(foes.patches.length >= Math.min(48, n + 5));
  foes.dispose(); clearTargets();
});

test('the shadow hound: running it is a shadow the blade passes through; an ember lights it solid; it steps through the shadow behind you, then bites', () => {
  const h = new Foe('hound', v(0, 0, 0), { rng: () => 0.5 }), P = player(v(0, 0, 12));
  runFor(h, P, 0.2);
  assert.equal(h.state, 'chase');
  assert.equal(h.phased, true);
  assert.equal(h.hit('blade', v(0, 0, 1), { damage: 1 }), false, 'the blade passes through');
  assert.equal(h.hit('fire', v(0, 0, 1)), true, 'an ember burns');
  assert.ok(h.lit > 0 && !h.phased, 'and lights it solid');
  assert.ok(h.hit('blade', v(0, 0, 1), { damage: 1 }), 'lit, the blade finds it');
  // the step: the pool is drawn past you, it comes out there and bites
  const s = only('hound', 'step'), Q = player(v(0, 0, 5));
  assert.ok(untilWind(s, Q, 'step'));
  assert.ok(s.attackAt.z > Q.pos.z + 1, 'the pool is behind you');
  runFor(s, Q, attackOf('hound', 'step').wind + DT * 2);
  assert.ok(s.pos.z > Q.pos.z, 'it stepped out behind you');
  assert.equal(s.atk.id, 'bite'); assert.equal(s.state, 'wind', 'and turns to bite');
  assert.ok(Math.abs(Math.atan2(Math.sin(s.attackH - Math.PI), Math.cos(s.attackH - Math.PI))) < 0.1, 'facing you');
});

test('old foes, new attacks: the blot’s lunge-combo (stopped by a guard), the spitter’s arc volley, the machine’s ground slam (jump the shockwave)', () => {
  // the combo: two lunges; a guarded first one ends it
  const b = only('blot', 'combo'), P = player(v(0, 0, 2.2));
  assert.ok(untilWind(b, P, 'combo'));
  const ev = runFor(b, P, attackOf('blot', 'combo').wind + 0.3);
  assert.equal(b.atk.id, 'again', 'the second lunge follows');
  assert.ok(strikes(ev).length >= 1);
  clearTargets();
  const Q = player(v(0, 0, 0), { guard: () => true }), foes = world(Q);
  foes.waveRest = 1e9;
  const c = foes.add('blot', v(0, 0, 2)); c.attacksAt = () => [attackOf('blot', 'combo')];
  let blocked = false, again = false;
  for (let i = 0; i < 6 / DT && !blocked; i++) { foes.update(DT); blocked = c.state === 'recover' && c.flash > 0; again ||= c.atk.id === 'again'; }
  assert.ok(blocked && !again, 'blocked: no second lunge');
  // the volley: three rings in a row across your way
  const s = only('spitter', 'volley', v(0, 0, 0)), R = player(v(0, 0, 9));
  assert.ok(untilWind(s, R, 'volley'));
  assert.equal(s.attackPts.length, 3);
  const xs = s.attackPts.map((p) => p.x).sort((a, b) => a - b);
  assert.ok(xs[2] - xs[0] > 4, 'spread across the line');
  R.pos.set(1.5, 0, 9);   // between two rings
  const miss = strikes(runFor(s, R, 2))[0];
  assert.equal(miss?.hit, false, 'between the rings: missed');
  // the quake: a ring of shock runs out; on your feet it catches you, a jump clears it
  const S = player(v(0, 0, 5)), F = world(S), m = F.add('machine', v());
  F.addWave(m, attackOf('machine', 'quake'));
  assert.ok(F.hitShapes().some((s) => s.tag === 'foe.shockwave'), 'the hitbox overlay draws its front');
  for (let i = 0; i < 1.2 / DT; i++) F.updateHazards(DT);
  assert.equal(S.hurts.length, 1, 'caught on your feet');
  assert.ok(Math.abs(S.hurts[0] - attackOf('machine', 'quake').wave.damage) < 1e-9);
  const J = player(v(0, 0, 5), { onGround: false }), F2 = world(J), m2 = F2.add('machine', v());
  F2.addWave(m2, attackOf('machine', 'quake'));
  for (let i = 0; i < 1.2 / DT; i++) F2.updateHazards(DT);
  assert.equal(J.hurts.length, 0, 'jumped: it runs under you');
  foes.dispose(); F.dispose(); F2.dispose(); clearTargets();
});

test('telegraphs: lanes, lobs and areas are drawn on the floor through the wind-up, plain melee is not; Gentle winds them up slower and halves every harm', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  foes.waveRest = 1e9;
  const d = foes.add('drone', v(0, 0, 6)), bl = foes.add('blot', v(3, 0, 1));
  d.attacksAt = () => [attackOf('drone', 'harpoon')];
  bl.attacksAt = () => [attackOf('blot', 'lunge')];
  let droneDrawn = false, blotDrawn = false;
  for (let i = 0; i < 4 / DT; i++) { foes.update(DT); P.health = 1; droneDrawn ||= d.state === 'wind' && d.tele.group.visible; blotDrawn ||= bl.state === 'wind' && bl.tele.group.visible; }
  assert.ok(droneDrawn, 'the harpoon’s lane is drawn');
  assert.equal(blotDrawn, false, 'the blot’s lunge reads from its body');
  foes.dispose(); clearTargets();
  // gentle: the same wind-up takes GENTLE.wind as long; a shockwave and slag bite half
  const G = player(v(0, 0, 0)), gentle = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'arena', physics: flat, player: G, settings: { enemies: 'gentle' }, game: new GameState(null) });
  const k = gentle.add('crab', v(0, 0, 5)); k.attacksAt = () => [attackOf('crab', 'spin')];
  for (let i = 0; i < 3 / DT && k.state !== 'wind'; i++) gentle.update(DT);
  let t = 0; while (k.state === 'wind' && t < 5) { gentle.update(DT); t += DT; }
  assert.ok(Math.abs(t - attackOf('crab', 'spin').wind * GENTLE.wind) < 0.05, `gentle wind-up ${t.toFixed(2)} s`);
  G.health = 0.2; G.hurts.length = 0;
  gentle.addWave(k, attackOf('machine', 'quake')); G.pos.set(0, 0, 8);
  for (let i = 0; i < 1.5 / DT; i++) gentle.updateHazards(DT);
  assert.ok(Math.abs(G.hurts[0] - attackOf('machine', 'quake').wave.damage * GENTLE.harm) < 1e-9, 'half the harm');
  gentle.strike(k, attackOf('stalker', 'grab'));
  assert.ok(gentle.hold.t <= attackOf('stalker', 'grab').grab.time * 0.6 + 1e-9, 'a shorter hold');
  gentle.dispose(); clearTargets();
});

test('the worlds’ rosters: each world draws its packs, its relic guards and its temple rooms from its own foes', () => {
  for (const [id, R] of Object.entries(ROSTERS)) {
    assert.ok(TITLES[id], `${id} is a world`);
    for (const k of [...Object.keys(R.wild), ...Object.keys(R.fill ?? {}), ...(R.guards ?? []), ...(R.temple ?? []), R.first]) assert.ok(FOES[k] && !FOES[k].noWild, `${id}: ${k}`);
  }
  // each new kind is somebody's own
  for (const k of Object.keys(KINDS)) if (!KINDS[k].noWild) assert.ok(Object.values(ROSTERS).some((R) => R.first === k || (R.wild[k] ?? 0) >= 3), `${k} has a home`);
  const signature = { desert: 'ray', glassdunes: 'golem', bazaar: 'moth', garage: 'drone', mangrove: 'stalker', saltharbour: 'crab', moonfoundry: 'slag', eclipse: 'hound', underwater: 'crab', buried: 'ray' };
  const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (const [id, k] of Object.entries(signature)) {
    const packs = []; for (let n = 1; n < 240; n++) packs.push(packOf(n, id, rng));
    const kinds = packs.flat();
    assert.ok(packs.filter((p) => p[0] === k).length > packs.length * 0.25, `${id}: ${k} leads its packs`);
    assert.ok(kinds.every((x) => !FOES[x].noWild), `${id}: never a splinter on its own`);
  }
  assert.deepEqual(packOf(0, 'desert'), ['blot'], 'the very first pack the game explains: a blot');
  assert.deepEqual(packOf(0, 'eclipse'), ['hound'], 'elsewhere, the world’s own kind first, alone');
  assert.deepEqual(packOf(2, 'bazaar', () => 0.1), Array(GROUP.moth).fill('moth'), 'moths come together');
  assert.ok(!packOf(1, 'nowhere', () => 0.05).includes('ray'), 'a world with no roster: the classic mix');
  assert.deepEqual(rosterOf('nowhere').wild, CLASSIC.wild);
  assert.deepEqual(guardKinds('saltharbour'), ['crab', 'crab']);
  assert.equal(templeKind('garage', 1), 'machine'); assert.equal(templeKind('garage', 2), 'drone');
  assert.equal(templeKind('desert', 3), 'machine');
  assert.ok(packKinds(4, 'eclipse', () => 0.05).includes('shade'), 'the eclipse’s shades');
});

test('placed encounters use the roster: relic guards are the world’s kind, the Hangar’s temple has drones among its machines, a Gentle pack is two at most', () => {
  clearTargets();
  const game = new GameState(null), P = player(v(0, 0, 395));
  const content = { npcs: [], relics: { spots: [{ at: [0, 0, 420] }] } };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'saltharbour', content, physics: flat, player: P, settings: { enemies: true }, game });
  foes.packRest = 999; foes.update(DT);
  assert.deepEqual(foes.list.filter((f) => f.guard).map((f) => f.kind), ['crab', 'crab']);
  foes.dispose(); clearTargets();
  const marks = [0, 1, 2, 3].map((i) => ({ pos: v(0, 0, i * 30), heading: 0 }));
  const H = new Foes({ scene: new THREE.Scene(), level: { spawn: v(), temple: { marks, inside: () => true } }, levelId: 'garage', physics: flat, player: player(v(0, 0, 300)), settings: { enemies: true }, game: new GameState(null) });
  assert.deepEqual(H.list.map((f) => f.kind), ['machine', 'drone', 'machine']);
  assert.ok(H.list.every((f) => f.placed && f.id));
  H.dispose(); clearTargets();
  const W = new Foes({ scene: new THREE.Scene(), level: { spawn: v() }, levelId: 'bazaar', physics: flat, player: player(v(0, 0, 400)), settings: { enemies: 'gentle' }, game: new GameState(null), rng: () => 0.1 });
  W.packs = 2; W.spawnPack();
  assert.ok(W.list.length <= GENTLE.pack, `gentle: ${W.list.length}`);
  W.dispose(); clearTargets();
});

test('the Arena’s foe list: choosing a kind stops the waves and brings it back each time it falls; the waves come back on request', async () => {
  const { mountFoeSpawner, SPAWN_KINDS } = await import('../src/foe-spawner.js');
  assert.ok(Object.keys(KINDS).every((k) => SPAWN_KINDS.includes(k)));
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  mountFoeSpawner({ foes, kind: 'crab' });
  assert.equal(foes.list.length, 1); assert.equal(foes.list[0].kind, 'crab');
  assert.ok(foes.list[0].pos.distanceTo(P.pos) > 5, 'ahead of you, not on you');
  for (let i = 0; i < 5 / DT; i++) { foes.update(DT); P.health = 1; }
  assert.ok(foes.list.every((f) => f.kind === 'crab'), 'no waves meanwhile');
  const c = foes.list[0]; c.flipped = 3;
  while (c.alive) foes.hurt(c, 'blade', v(0, 0, 1), { damage: 1 });
  for (let i = 0; i < 4 / DT; i++) foes.update(DT);
  assert.ok(foes.list.some((f) => f.kind === 'crab' && f.alive), 'it comes back');
  foes.setPractice(null);
  foes.list.slice().forEach((f) => foes.remove(f));
  for (let i = 0; i < 5 / DT; i++) foes.update(DT);
  assert.ok(foes.list.length > 0, 'and the waves again');
  foes.dispose(); clearTargets();
});
