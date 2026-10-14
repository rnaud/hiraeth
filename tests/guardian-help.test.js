// Helping a guardian instead of fighting it (issue #339, two prototypes: src/guardian-help/, docs/design/helper-guardians.md).
// Each played in its own arena with a real Player by a scripted player: through to the end (the shipped hand on its brow
// resolving the temple), failing gently on the way (nothing lost for good, the step again), and the shipped fight left
// as it was when the prototype is not asked for.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { updateHazards } from '../src/hazards.js';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { FluidTool } from '../src/fluid-tool.js';
import { MODES, ownedModes } from '../src/fluid-kit.js';
import { bestInteractable } from '../src/interact.js';
import { attachHelp, helpKind, helpHref, HELPS } from '../src/guardian-help/index.js';
import { FLIGHT, routeAt, flightTime } from '../src/guardian-help/elder.js';
import { VESSELS, LEAK, arcCatch } from '../src/guardian-help/keeper.js';
import { menuSections } from '../src/world-picker.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** A temple's world, a Player in its guardian's arena, and (kind) the prototype attached; a FluidTool for the Keeper's. */
function world(id, kind, { tool = false } = {}) {
  game.reset();
  own(...HELPS[kind ?? (id === 'arzach' ? 'elder' : 'keeper')].items);
  game.set('gadget.equipped', 'gun');
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, id) ?? level.temple;
  const G = rt.guardian;
  const notes = [];
  const P = new Player(physics, { spawn: G.arena.center.clone().add(V(0, 0.2, -G.arena.r * 0.6)), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  P.opts.health = false;
  scene.add(P.object);
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  game.emit('box:opened', { id: rt.def.gadgetBox });
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const T = tool ? new FluidTool({ scene, player: P, physics, camera, rig: { aimK: 0 }, state: game }) : null;
  const enc = kind ? attachHelp(rt, kind, { tool: T }) : null;
  enc?.enter(P);
  let t = 0;
  const frame = (input = {}, camYaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, camYaw); scene.updateMatrixWorld(); T?.update(DT, input); updateHazards(DT, P); level.update(DT, t, {}); };
  const said = (re) => notes.some((n) => re.test(n));
  return { level, rt, G, P, T, enc, camera, notes, frame, said, done: () => { enc?.dispose(); rt.dispose?.(); game.reset(); own(); } };
}

// ------------------------------------------------------------------ the Elder
/**
 * A scripted pilot: on the floor it walks into the east vent's wind and holds the wings open; aloft it glides for the
 * falling feather it can reach first (diving onto one below it), else back into her wake, steering with the stick.
 * `skip` feathers it lets fall (to fail on purpose).
 */
function pilot(W, { let: skip = () => false } = {}) {
  const { enc, P, G } = W, c = enc.c, v0 = enc.ventNow(), vent = V(c.x + v0.x, 0, c.z + v0.z);
  return () => {
    const m = G.model;
    if (P.onGround) {
      // (to the vent's foot, then up its wind with the wings open)
      const dx = vent.x - P.pos.x, dz = vent.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.5) return [{ stick: { x: 0, y: 1 } }, Math.atan2(-dx, -dz)];
      return [{ Space: true }, 0];
    }
    if (['ground', 'rise', 'shaken', 'falter', 'land'].includes(enc.phase)) {
      // (aloft while she is not flying: back over the vent, into its wind)
      const dx = vent.x - P.pos.x, dz = vent.z - P.pos.z;
      if (P.hovering || Math.hypot(dx, dz) < 2) return [{ Space: true }, 0];
      const err = wrap(Math.atan2(dx, dz) - P.heading);
      return [{ Space: true, stick: { x: THREE.MathUtils.clamp(-err * 2.2, -1, 1), y: 0 } }, 0];
    }
    const chest = V(P.pos.x, P.pos.y + 0.9, P.pos.z);
    // (the feather it can reach soonest, ahead of it: a nudge of the stick toward it)
    let target = null, best = Infinity;
    for (const f of enc.feathers) {
      if (f.state !== 'fall' || skip(f)) continue;   // (loose ones: below)
      const dx = f.pos.x - chest.x, dz = f.pos.z - chest.z, flat = Math.hypot(dx, dz), time = flat / Math.max(8, P.glideSpeed ?? 12);
      if (time > enc.leftOf(f) + 0.3 || time > best || Math.abs(wrap(Math.atan2(dx, dz) - P.heading)) > 1.2) continue;
      best = time; target = f.pos;
    }
    // (one loosening on her wing: into the slot behind that wingtip)
    const loose = enc.feathers.find((f) => f.state === 'loose' && !skip(f));
    if (!target && loose && enc.inWake) {
      const fx = Math.sin(m.heading), fz = Math.cos(m.heading);
      target = V(m.pos.x + fz * loose.side * 3.2 + fx * 1.5, 0, m.pos.z - fx * loose.side * 3.2 + fz * 1.5);
    }
    // (none: in her wake let it carry you; out of it, fly to meet her where she will be)
    if (!target && enc.inWake) return [{ Space: true }, 0];
    if (!target) {
      let s2 = 0.5;
      for (let k = 0; k < 4; k++) s2 = Math.min(4, enc.ahead(s2).distanceTo(P.pos) / Math.max(9, P.glideSpeed ?? 12));
      target = enc.ahead(Math.max(0, s2 - 0.3));
    }
    const dx = target.x - P.pos.x, dz = target.z - P.pos.z;
    // (in rising air the stick drifts you: across, toward it, with the camera turned so)
    if (P.hovering) return [{ Space: true, stick: { x: 1, y: 0 } }, Math.atan2(-dz, dx)];
    const err = wrap(Math.atan2(dx, dz) - P.heading);
    return [{ Space: true, stick: { x: THREE.MathUtils.clamp(-err * 2.2, -1, 1), y: 0 } }, 0];
  };
}

test('fly with the Elder: a scripted pilot takes off in the vent’s wind, flies the three flights in her wake catching her feathers, and the hand on her neck calms her', () => {
  const W = world('arzach', 'elder');
  const { enc, G, P, frame, said, rt } = W;
  assert.equal(G.state, 'help', 'the prototype has her: no fight');
  assert.equal(enc.phase, 'ground');
  const fly = pilot(W);
  let inWake = 0, aloft = 0;
  for (let i = 0; i < 300 / DT && !['settle', 'done'].includes(enc.phase); i++) {
    const [inp, yaw] = fly();
    frame(inp, yaw);
    if (enc.inWake) inWake++;
    if (enc.phase === 'fly' && !P.onGround) aloft++;
  }
  assert.equal(enc.phase, 'settle', `she flies her three flights and settles (${enc.phase}, flight ${enc.flight}, ${enc.caught} caught, ${enc.lost} lost, ${enc.tries} tries)`);
  assert.ok(enc.caught >= enc.total - FLIGHT.flights.length * FLIGHT.miss, `most of her feathers caught on the wing (${enc.caught} / ${enc.total})`);
  assert.ok(inWake * DT > 20, `her wake held the wings up (${(inWake * DT).toFixed(1)} s)`);
  assert.ok(said(/rising out of the vent/) && said(/loosens on her (left|right) wing/) && said(/catch the stone feather/i), 'it says what to do');
  assert.equal(G.state, 'weary');
  // the shipped hand on her neck
  P.teleport(G.model.mouth.clone().setY(G.arena.y + 0.1).add(V(1.4, 0, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0);
  frame();
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.arzach.touch', 'lay a hand on her neck');
  near.entry.use(P);
  frame();
  assert.equal(G.state, 'resolved');
  assert.equal(game.flag('temple.arzach.done'), true, 'the Aerie is resolved as the fight would');
  assert.equal(rt.logic.isOpen('d5'), true, 'its far door opens');
  assert.ok(aloft * DT > 40, `a real flight: ${(aloft * DT).toFixed(0)} s aloft`);
  W.done();
});

test('fly with the Elder fails gently: feathers let fall, she falters, sits shaking, and the same flight is flown again', () => {
  const W = world('arzach', 'elder');
  const { enc, frame, said, G } = W;
  // (the pilot lets every feather of the first flight fall, the first try)
  const fly = pilot(W, { let: (f) => f.flight === 0 && enc.tries === 1 });
  let faltered = false, sat = false;
  for (let i = 0; i < 120 / DT; i++) {
    const [inp, yaw] = fly();
    frame(inp, yaw);
    if (enc.phase === 'falter') faltered = true;
    if (enc.phase === 'shaken') sat = true;
    if (enc.tries >= 2 && enc.phase === 'fly') break;
  }
  assert.ok(faltered && sat, 'she falters and sits shaking');
  assert.ok(said(/shatters on the floor/) && said(/That flight again/), 'it says why, and that it is to be flown again');
  assert.equal(enc.flight, 0, 'the same flight');
  assert.equal(enc.tries, 2, 'flown again once you glide past her');
  assert.ok(G.meter < 0.1, 'nothing kept of the flight that failed');
  assert.notEqual(G.state, 'resolved');
  W.done();
});

test('her route stays inside the roost, under its roof, and each flight is long enough to be flown', () => {
  for (const F of FLIGHT.flights) {
    for (let th = 0; th < F.turns * Math.PI * 2; th += 0.05) {
      const p = routeAt(F, th, th / (F.turns * Math.PI * 2));
      assert.ok(Math.hypot(p.x, p.z) < 19 - 4, 'clear of the wall (her wings)');
      assert.ok(p.y > 3 && p.y < 24 - 3, 'under the roof');
    }
    assert.ok(flightTime(F) > 12 && flightTime(F) < 30, `a flight of ${flightTime(F).toFixed(0)} s`);
  }
});

// ------------------------------------------------------------------ the Keeper
/** Aim the camera so the cannon's arc from the muzzle reaches `to` (the lower of the two angles), and pour for `secs`. */
function pour(W, to, secs, { aimOnly = false } = {}) {
  const { T, P, camera, frame } = W;
  let poured = 0;
  for (let i = 0; i < secs / DT; i++) {
    const from = T.muzzle(V()), d = V(to.x - from.x, 0, to.z - from.z), x = d.length(), y = to.y - from.y;
    const v = 21, g = 9.8, disc = v ** 4 - g * (g * x * x + 2 * y * v * v);
    const ang = Math.atan2(v * v - Math.sqrt(Math.max(0, disc)), g * x);
    const dir = d.normalize().multiplyScalar(Math.cos(ang)).add(V(0, Math.sin(ang), 0));
    P.heading = Math.atan2(dir.x, dir.z);
    camera.position.copy(from).addScaledVector(dir, -0.6); camera.lookAt(camera.position.clone().add(dir)); camera.updateMatrixWorld();
    frame({ KeyR: true, KeyG: !aimOnly && i > 20 });
    if (T.streaming) poured += DT;
  }
  frame({});
  return poured;
}

test('water for the Keeper: the gun lends a water cannon; a scripted player fills the jars and the trough, the Keeper lifts the tank’s lid, the tank fills, it drinks deep, and the hand on its brow calms it', () => {
  const W = world('desert', 'keeper', { tool: true });
  const { enc, G, P, T, frame, said, rt } = W;
  assert.equal(G.state, 'help');
  assert.ok(T.modes.includes('cannon') && T.mode === 'cannon', 'the cannon lent, in hand');
  const at = (v) => enc.mouthOf(v);
  const standBy = (v, d = 7) => { const p = enc.at(...v.at); const o = V(enc.c.x - p.x, 0, enc.c.z - p.z).normalize(); P.teleport(V(p.x + o.x * d, enc.floor + 0.2, p.z + o.z * d), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); };
  const rest = (s) => { for (let i = 0; i < s / DT; i++) frame({}); };
  const keeperOff = () => { G.model.pos.copy(enc.at(0, 0, -9.5)); };   // (out of the line of fire, as a player would wait for)
  for (const id of ['jar', 'high', 'wheel']) {
    const v = enc.vessel(id);
    standBy(v, id === 'high' ? 9 : 7);
    for (let k = 0; k < 4 && !v.full; k++) { rest(4.2); keeperOff(); pour(W, at(v), 5.5); }
    assert.equal(v.full, true, `${v.name} filled (${v.level.toFixed(2)})`);
  }
  assert.ok(said(/old wheel turns/) && rt.logic.isOpen('d5'), 'the wheel turns: power, the far door open');
  assert.ok(['b6', 'b7', 'b8', 'b9'].every((id) => rt.piece(id).flames), 'the four braziers catch');
  // the Keeper drinks at each runnel, then goes to the tank and lifts its lid
  const tank = enc.vessel('tank');
  for (let i = 0; i < 40 / DT && !tank.open; i++) frame({});
  assert.equal(tank.open, true, 'the Keeper heaves the tank’s lid off');
  assert.ok(said(/heaves the stone lid/));
  assert.ok(G.meter >= 0.5, `it drank, calmer (${G.meter.toFixed(2)})`);
  standBy(tank, 8);
  for (let k = 0; k < 4 && !tank.full; k++) { rest(4.2); keeperOff(); pour(W, at(tank), 6.5); }
  assert.equal(tank.full, true, 'the tank filled, in more than one bar');
  for (let i = 0; i < 30 / DT && G.state !== 'weary'; i++) frame({});
  assert.equal(G.state, 'weary', 'it drinks deep and lies down');
  P.teleport(G.model.mouth.clone().setY(G.arena.y + 0.1).add(V(1.2, 0, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0);
  frame({});
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.desert.touch', 'lay a hand on its brow');
  near.entry.use(P);
  frame({});
  assert.equal(game.flag('temple.desert.done'), true, 'the Rose House resolved as the fight would');
  enc.dispose();
  assert.equal(T.modes.includes('cannon'), false, 'the cannon given back');
  W.done();
});

test('water for the Keeper fails gently: a jar left leaks back down, and a blast in its face startles it and spills the jar by it', () => {
  const W = world('desert', 'keeper', { tool: true });
  const { enc, G, P, frame, said } = W;
  const jar = enc.vessel('jar');
  const p = enc.at(...jar.at), o = V(enc.c.x - p.x, 0, enc.c.z - p.z).normalize();
  P.teleport(V(p.x + o.x * 7, enc.floor + 0.2, p.z + o.z * 7), V(0, 1, 0), V(0, 0, 1));
  G.model.pos.copy(enc.at(0, 0, -9.5));
  pour(W, enc.mouthOf(jar), 1.6);
  const half = jar.level;
  assert.ok(half > 0.2 && !jar.full, `part full (${half.toFixed(2)})`);
  for (let i = 0; i < (LEAK.hold + 2) / DT; i++) frame({});
  assert.ok(jar.level < half - 0.2, `it leaks back down (${jar.level.toFixed(2)})`);
  // fill it part way again, the Keeper beside it, and blast its face
  pour(W, enc.mouthOf(jar), 1.6);
  G.model.pos.copy(enc.at(jar.at[0] + 3.5, 0, jar.at[2] - 1.5));
  for (let i = 0; i < 3 && !said(/frightens it/); i++) { for (let k = 0; k < 160; k++) frame({}); pour(W, enc.bodyOf(), 1.2); }
  assert.ok(said(/frightens it/), 'it rears');
  assert.ok(enc.startles >= 1);
  assert.equal(jar.level, 0, 'the jar by it spilt');
  assert.ok(!jar.full && G.state === 'help', 'nothing lost for good: the jar to fill again');
  W.done();
});

test('the cannon’s arc: a stream caught at the first mouth it passes, the world behind it left dry', () => {
  const pts = [V(0, 1, 0), V(2, 2, 0), V(4, 2.4, 0), V(6, 2.2, 0), V(8, 1.4, 0)];
  const hit = arcCatch(pts, [{ c: V(6, 2.2, 0.4), r: 0.9 }, { c: V(2, 2, 0), r: 0.5 }], 0.1);
  assert.equal(hit.i, 0, 'the nearer mouth along the arc');
  assert.equal(arcCatch(pts, [{ c: V(4, 5, 0), r: 1 }], 0.1), null, 'over it: nothing');
  assert.ok(VESSELS.some((v) => v.lid) && VESSELS.filter((v) => v.leaks).length === 3, 'three cracked vessels and a lidded tank');
});

test('the cannon is lent, never owned: no item, not among the modes without the encounter', () => {
  assert.equal(MODES.cannon.lent, true);
  assert.equal(ITEMS.cannon, undefined, 'no item of its own');
  const has = (id) => ['gun', 'backpack', 'cannon'].includes(id);
  assert.equal(ownedModes(has).includes('cannon'), false, 'not owned by having an item called so');
  assert.equal(ownedModes(has, new Set(['cannon'])).includes('cannon'), true, 'lent: there');
});

// ------------------------------------------------------------------ the shipped fights untouched
test('without ?guardianHelp the shipped fights are as they were: the Elder and the Keeper wake and fight', () => {
  assert.equal(helpKind(new URLSearchParams('level=arzach')), null);
  assert.equal(helpKind(new URLSearchParams('guardianHelp=elder')), 'elder');
  assert.equal(helpKind(new URLSearchParams('guardianHelp=nope')), null);
  assert.equal(helpHref('keeper'), '?level=desert&guardianHelp=keeper');
  for (const id of ['arzach', 'desert']) {
    const W = world(id, null);
    const { G, P, frame, rt } = W;
    P.teleport(G.arena.center.clone().add(V(0, 0.2, -8)), V(0, 1, 0), V(0, 0, 1));
    for (let i = 0; i < 6 / DT && G.state !== 'fight'; i++) frame({});
    assert.equal(G.state, 'fight', `${id}: its guardian wakes and fights`);
    assert.ok(!rt.root.children.some((o) => /prototype/.test(o.name)), `${id}: nothing of the prototypes in its temple`);
    assert.ok(G.attack || G.cool > 0 || G.state === 'fight', `${id}: its moves come`);
    W.done();
  }
});

test('the Debug menu has both prototypes', () => {
  const s = menuSections({ levels: [], dev: false, games: [] }).find((x) => x.key === 'prototypes');
  assert.ok(s, 'a Prototypes section');
  for (const k of Object.keys(HELPS)) assert.ok(s.html.includes(helpHref(k).replace(/&/g, '&amp;')) || s.html.includes(helpHref(k)), `${k} listed`);
});
