// The Builders' Greenhouse round its Palm House (issue #411, docs/design/temple-best-practices.md): the builders' water up
// in the high troughs or let down into the low channels is the house's one state, set at a sluice wheel by either hub of
// the great hall and in the Bud Passage, read on a gauge in every room; the Cold Frame's disc rides only on the water let
// down; the drop off the gallery into the cistern; the vine that stays, grown down from the bridge, a climb back up for
// good; the Seed Vault's weight that only the hook brings down off its ledge; (issue #477) the bloom first, from the chest
// on the Palm House's floor, the Cold Frame's flower-door its first step. The house walked through with a real
// traveller: every wheel turned with the use button, every ball rolled, every climb climbed, every drop fallen. Its state
// machine is tests/temples.test.js's, its play-through by hits tests/temple-playthrough.test.js's; this is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf, nextSpot } from '../src/temples/attachment.js';
import { ROOMS, UP, GALLERY, BASIN, VINE, VAULT, FRAME_LIFT, SLUICE, SUN, CHEST, WaterGauge } from '../src/temples/edena.js';
import { createEdena } from '../src/levels/edena.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { HOOK } from '../src/gadgets/hook.js';
import { pickUp } from '../src/carry.js';
import { allTargets, hitTarget } from '../src/targets.js';
import { answerAsks } from './guardian-asks.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The Greenhouse built in its world, a traveller at its door, and his hands. */
function house() {
  game.reset();
  own('backpack', 'gun', 'hook');
  const scene = new THREE.Scene();
  const level = quiet(() => createEdena(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'edena');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers?.(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); level.update(DT, t, {}); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const local = () => rt.kit.local(P.pos);
  const via = (...pts) => pts.every((q) => walk(L(...q)));
  const sight = (to, from = P.pos.clone().add(V(0, 1.5, 0))) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  /** The use button by a sluice wheel: turned. */
  const turn = (wheel) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.edena.${wheel}`, `by ${wheel}, the button turns it (${where()})`); return near.entry.use(P); };
  const up = () => rt.logic.drumOn('sluice', 'wHigh'), down = () => rt.logic.drumOn('sluice', 'wLow');
  /** Push a ball along its groove (way +1: toward its b end, -1: toward a) until it rests on `plate`. */
  const roll = (id, plate, way = 1, n = 12) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) {
      const d = ball.dir.clone().multiplyScalar(way);
      walk(ball.center.clone().addScaledVector(d, -2.3).setY(P.pos.y), { tol: 0.5, max: 8 });
      ball.hit('push', d, { strength: 1 });
      wait(2.8);
    }
    return rt.logic.drumOn(id, plate);
  };
  /** Up a climbable face toward `to` (local), until standing at its top's height. */
  const climb = (to, top, s = 30) => { for (let i = 0; i < s / DT; i++) { frame({ KeyW: true }, toward(L(...to))); if (P.onGround && local().y > top - 0.5) return true; } return false; };
  return { level, physics, rt, P, notes, L, frame, walk, wait, where, local, via, sight, turn, up, down, roll, climb, said: (re) => notes.some((n) => re.test(n)) };
}

function openChest(rt, id, P) {
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, `temple.${rt.id}.${id}`, `by the chest of ${id}, the button opens it`);
  near.entry.use(P);
  assert.equal(rt.logic.isFound(id), true, `${id} taken`);
}

test('the Builders’ Greenhouse on foot (issues #411, #477): the bloom first, on the Palm House’s floor, the Cold Frame’s flower-door in the sun; the Palm House’s floor and gallery, the water let down for the Cold Frame’s disc and sent up for the bud, the bridge’s eye and the vine that stays, the drop into the cistern, the vault’s weight hooked down off its ledge, the window back to the hub, the climb up the vine, the Gardener calmed', () => {
  const H = house(), { rt, P, L, walk, wait, where, local, via, sight, turn, up, down, roll, climb, said, frame } = H;
  const PO = ROOMS.potting, GA = GALLERY, BR = GA.bridge, C3 = ROOMS.seed.z, A0 = ROOMS.bud.z0, G0 = ROOMS.gulf.z0, LIP = G0 + ROOMS.gulf.lip, FAR = G0 + ROOMS.gulf.far, GL = G0 + ROOMS.gulf.glass, HZ = ROOMS.hall.z - ROOMS.hall.r;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Threshold (${where()})`);
  assert.ok(up() && rt.sluice, 'the water starts up in the high troughs');
  // ---- G4: the Palm House, 78 m long, its gallery 18 m up round three sides and the bridge across its middle
  assert.ok(PO.z1 - PO.z0 >= 60 && PO.top - PO.y >= UP + 16, 'a great hall: 60 m and more, the gallery under 16 m of its own');
  assert.equal(walk(L(0, 0, 18)), true, `into the Palm House (${where()})`);
  // (the head of someone at the gallery's parapet, on its arms, its bridge and its north band, seen from the floor)
  for (const [ex, ez, x, z] of [[8, 40, GA.w - 0.3, 40], [-8, 40, GA.e + 0.3, 40], [0, 20, 0, BR.z0 + 0.5], [0, 40, 6, GA.n + 0.5]]) assert.ok(sight(L(x, UP + 2.2, z), L(ex, 1.7, ez)), `the gallery seen from the floor, both floors at once (${x}, ${z})`);
  // (G1, readable everywhere: a gauge in every room but the guardian's)
  const gauges = new Set(rt.placed.filter((p) => p.cls === 'WaterGauge').map((p) => p.o.room));
  for (const r of Object.keys(rt.def.logic.rooms)) if (!['hall', 'out', 'threshold', 'vaultTop'].includes(r)) assert.ok(gauges.has(r), `a gauge in ${r}`);
  // ---- (issue #477) the floor: the makers' chest on its mound in the middle, in sight from the way in: the bloom first
  assert.equal(rt.logic.next(), 'chest', 'the scout’s first place: the chest');
  assert.ok(sight(L(CHEST[0], 1.4, CHEST[1]), L(0, 1.7, 15)), 'the chest seen from the way in');
  assert.equal(walk(L(CHEST[0], 0.6, CHEST[1] - 2.2), { tol: 0.8 }), true, `up onto its mound (${where()})`);
  items.grant('bloom'); game.emit('box:opened', { id: 'edena.temple.bloom' });
  wait(0.5);
  assert.equal(rt.logic.store.get('gadget'), true, 'the bloom taken');
  // the Cold Frame's flower-door in the sun: bloomed, it opens (the house's first step a seed's, before any push)
  assert.equal(via([8, 0, 41], [13, 0, 41]), true, `before the flower-door (${where()})`);
  assert.equal(walk(L(24, 0, 41), { max: 3 }), false, 'shut, it keeps you out');
  rt.piece('dE').hit('bloom');
  wait(1.5);
  assert.ok(rt.logic.isLit('bE') && rt.logic.isOpen('dE'), 'bloomed in the sun: the Cold Frame’s flower-door opens');
  // ---- the Shade House (an arena): its key, and its north door into the Seed Vault
  const keepers = [{ room: 'shade', alive: true }, { room: 'shade', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(via([-12, 0, 41], [-26, 0, 41]), true, `into the Shade House (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dW'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dW') && rt.logic.isOpen('dV'), 'beaten: won, the door lets go, the north door opens');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kW', P);
  // ---- the Cold Frame: one ball, two eyes, the key; the disc dry on its column while the water is up
  assert.equal(via([-12, 0, 41], [12, 0, 41], [26, 0, 41]), true, `into the Cold Frame (${where()})`);
  rt.piece('sC2').hit('bloom');
  assert.equal(rt.logic.isLit('sC2'), false, 'in the shade the tray’s seed folds back');
  assert.equal(roll('ballC', 'pC1', 1), true, `the ball north (${where()})`);
  wait(2); rt.piece('sC1').hit('bloom');
  assert.equal(roll('ballC', 'pC2', -1), true, `the ball south (${where()})`);
  wait(2); rt.piece('sC2').hit('bloom');
  wait(1.5);
  assert.ok(rt.logic.isLit('sC1') && rt.logic.isLit('sC2'), 'both trays in flower');
  assert.equal(walk(rt.piece('kE').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);
  const disc = rt.piece('lift'), s0 = disc.s;
  wait(3);
  assert.equal(disc.s, s0, 'the water up: the disc lies dry on its column');
  // ---- the floor's sluice wheel: the water let down, and the disc rides
  const W0 = SLUICE.wheels[0];
  assert.equal(via([26, 0, 41], [12, 0, 41], [W0.at[0] - 1.5, 0, W0.at[2]]), true, `to the floor's wheel (${where()})`);
  assert.equal(turn('wheel.potting'), 'down');
  assert.ok(down(), 'turned: the water runs down into the low channels');
  wait(SLUICE.run + 0.5);
  assert.ok(rt.sluice.k < 0.01, 'and it has run');
  assert.equal(via([12, 0, 41], [26, 0, 41], [FRAME_LIFT.x + 4, 0, FRAME_LIFT.z + 4]), true, `back to the disc (${where()})`);
  wait(30, () => disc.s < 0.2 && disc.wait > 0.8);
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the disc (${where()})`);
  wait(30, () => disc.s > disc.total - 0.2);
  assert.ok(local().y > UP - 0.5, `carried up on its column (${where()})`);
  assert.equal(via([FRAME_LIFT.landing[0] + 2, UP, FRAME_LIFT.door], [15, UP, FRAME_LIFT.door]), true, `through the high door onto the gallery (${where()})`);
  // ---- the bridge: its ball onto the east plate, the eye on its post wakes; the Seed Chamber's door takes both keys and it
  assert.equal(via([15, UP, BR.z0 + 3], [9, UP, BR.z0 + 2]), true, `onto the bridge (${where()})`);
  rt.piece('s2').hit('shoot');
  assert.equal(rt.logic.isLit('s2'), false, 'the bridge’s eye in the shade');
  assert.equal(roll('ballL', 'pL2', 1), true, `the bridge's ball east (${where()})`);
  wait(2.5); rt.piece('s2').hit('shoot'); wait(1);
  assert.equal(rt.logic.isLit('s2'), true, 'woken in the sun');
  assert.equal(via([13, UP, BR.z1 + 2], [15, UP, GA.n - 2], [2, UP, GA.n + 3], [0, UP, PO.z1 - 1]), true, `to the Seed Chamber's door (${where()})`);
  wait(2.5);
  assert.ok(rt.logic.keysIn('d1') === 2 && rt.logic.isOpen('d1'), 'both keys in, the eye awake: it opens');
  // ---- (issue #477) the Seed Chamber: its seed in the oculus's sun, and dry: the water came up the disc let down. The
  // gallery's wheel outside its door sends it up; bloomed, the north door sinks
  assert.equal(walk(L(0, UP, C3 - 4)), true, `into the seed chamber (${where()})`);
  assert.equal(rt.logic.isOpen('dS'), false, 'its north door shut');
  rt.piece('seed0').hit('bloom'); wait(1);
  assert.ok(!rt.logic.isLit('seed0') && said(/trough is dry/i), 'in the sun, but dry: it wilts, and says why');
  const WL = SLUICE.wheels[1];
  assert.equal(via([0, UP, PO.z1 + 2], [0, UP, PO.z1 - 1.5], [WL.at[0], UP, WL.at[2] - 1.5]), true, `to the gallery's wheel (${where()})`);
  assert.equal(turn('wheel.landing'), 'up');
  wait(SLUICE.run + 0.5);
  assert.ok(up(), 'the water up in the high troughs');
  assert.equal(via([0, UP, PO.z1 - 1.5], [0, UP, C3 - 4]), true, `back into the chamber (${where()})`);
  rt.piece('seed0').hit('bloom'); wait(2.6);
  assert.ok(rt.logic.isLit('seed0') && rt.logic.isOpen('dS'), 'in the sun and wet: it flowers, and the north door sinks');
  // ---- the Bud Passage: the bud in the shade until the passage's ball turns its louvre; its own wheel (the water let down
  // and sent up again there)
  assert.equal(walk(L(0, UP, A0 + 4)), true, `into the passage (${where()})`);
  const WB = SLUICE.wheels[2];
  assert.equal(walk(L(WB.at[0] + 1.5, UP, WB.at[2]), { tol: 0.5 }), true, `to the passage's wheel (${where()})`);
  assert.equal(turn('wheel.bud'), 'down');
  assert.equal(turn('wheel.bud'), 'up');
  wait(SLUICE.run + 0.5);
  assert.ok(up(), 'the water up in the high troughs');
  const bud = rt.piece('d3');
  bud.hit('bloom'); wait(1);
  assert.ok(!rt.logic.isOpen('d3') && said(/in the shade/i), 'wet, but in the shade: it stays shut, and says why');
  assert.equal(roll('ballB', 'pB', 1), true, `the passage's ball onto its plate (${where()})`);
  wait(2.5);
  assert.equal(walk(L(0, UP, G0 - 4)), true, `back before the bud (${where()})`);
  bud.hit('bloom'); wait(2.6);
  assert.equal(rt.logic.isOpen('d3'), true, 'in the sun and wet, it opens');
  // ---- the Vine Gulf: the sun-ball, the seed at the lip, the bridge; across, the seed-ball into the light, its vine up the glass
  assert.equal(walk(L(0, UP, LIP - 4)), true, `to the gulf's edge (${where()})`);
  assert.equal(roll('sun', 'pS', 1), true, `the sun-ball onto its plate (${where()})`);
  wait(2.5); rt.piece('seed1').hit('bloom'); wait(3.5);
  assert.equal(rt.logic.isOpen('vine1'), true, 'the vine bridge');
  assert.equal(via([0, UP, LIP - 1.1], [0, UP, FAR + 2.8]), true, `over the vine bridge (${where()})`);
  const sb = rt.piece('sb');
  assert.equal(roll('sb', 'pG', 1), true, `the seed-ball into the sunbeam (${where()})`);
  sb.hit('bloom', null); wait(3);
  assert.equal(rt.logic.isOpen('d4'), true, 'its vine climbs into the bud, and the bud opens');
  // ---- back to the bridge: its ball onto the west plate, and the vine that stays grows down the glass
  assert.equal(via([0, UP, FAR - 0.5], [0, UP, LIP - 2], [0, UP, A0 + 4], [0, UP, C3 - 6], [0, UP, PO.z1 - 2], [10, UP, GA.n + 2], [14.5, UP, GA.n - 2], [14, UP, BR.z1 + 2], [9, UP, BR.z0 + 2]), true, `back onto the bridge (${where()})`);
  assert.equal(roll('ballL', 'pL1', -1), true, `the bridge's ball west (${where()})`);
  wait(2.5);
  rt.piece('seedS').hit('bloom'); wait(3);
  assert.ok(rt.logic.isLit('seedS') && rt.logic.isOpen('vineS'), 'in the sun and wet: the vine grows down the glass, for good');
  // ---- G6: the drop off the east arm into the cistern, unhurt
  const hearts0 = P.hearts;
  assert.equal(via([13.5, UP, BR.z1 + 2], [14.5, UP, (GA.drop[0] + GA.drop[1]) / 2]), true, `to the east arm's open edge (${where()})`);
  assert.equal(walk(L((BASIN.x0 + BASIN.x1) / 2, 0, (GA.drop[0] + GA.drop[1]) / 2), { tol: 1.2, max: 8, dy: 0.8 }), true, `down into the cistern (${where()})`);
  wait(1);
  assert.equal(P.hearts, hearts0, 'the cistern breaks the fall');
  assert.ok(said(/cistern breaks your fall/), `and says so (${where()}: ${H.notes.slice(-4).join(' / ')})`);
  // ---- the Seed Vault: the water let down at the floor's wheel; the weight hooked down off the ledge, onto its plate
  assert.equal(walk(L(W0.at[0] - 1.5, 0, W0.at[2]), { tol: 0.5 }), true, `to the floor's wheel (${where()})`);
  assert.equal(turn('wheel.potting'), 'down');
  assert.equal(via([-12, 0, 41], [-26, 0, 41], [-36, 0, 50], [-36, 0, 64]), true, `through the Shade House into the vault (${where()})`);
  const sdA = rt.piece('sdA');
  sdA.hit('bloom');
  assert.equal(rt.logic.isLit('sdA'), false, 'in the shade the vault’s seed folds back');
  const w = rt.piece('wV');
  assert.ok(w.prop.pos.y > L(0, VAULT.ledge, 0).y, 'the weight lies high on the ledge’s lip');
  assert.equal(walk(L(-42, 0, w.o.at[2]), { tol: 0.6 }), true, `back from the glass, in sight of the weight (${where()})`);
  const hand = P.pos.clone().add(V(0, 1.3, 0));
  assert.ok(w.prop.pos.distanceTo(hand) <= HOOK.range && sight(w.prop.pos, hand), 'the weight in the hook’s reach and sight');
  assert.ok(pickUp(P, w.prop, { from: 'hook' }), 'the hook brings it down into his hands');
  const plate = rt.piece('pVw'), dir = plate.pos.clone().sub(P.pos).setY(0).normalize();
  assert.equal(walk(plate.pos.clone().addScaledVector(dir, -1.6), { tol: 0.4, run: false }), true, `before its plate (${where()})`);
  const put = bestInteractable(P);
  assert.equal(put?.entry.id, 'carry.put', 'the button puts it down');
  put.entry.use(P);
  wait(1.5);
  assert.equal(rt.logic.weightOn('wV'), 'pVw', 'on its plate: the louvre turns');
  wait(2);
  sdA.hit('bloom'); wait(3);
  assert.ok(rt.logic.isLit('sdA') && rt.logic.isOpen('vineV'), 'in the sun and wet: the vine climbs the glass');
  assert.equal(walk(L(VAULT.face - 1.2, 0, VAULT.z)), true, `to the glass's foot (${where()})`);
  assert.ok(climb([VAULT.face + 2.2, VAULT.ledge, VAULT.z], VAULT.ledge), `up the vine (${where()})`);
  assert.equal(walk(rt.piece('kB').pos, { tol: 1.2, max: 6 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  // ---- the window: a drop back down to the hub's floor, unhurt
  const hearts1 = P.hearts;
  assert.equal(walk(L(-21, VAULT.ledge, VAULT.z), { max: 8 }), true, `to the window (${where()})`);
  assert.equal(walk(L(-14, 0, VAULT.z), { max: 6, dy: 0.8 }), true, `out of it, down to the floor (${where()})`);
  assert.equal(P.hearts, hearts1, 'unhurt');
  // ---- the vine that stays: up the glass from the floor to the bridge, the water let down and the disc as it may be
  assert.ok(down(), 'the water still down: the vine stays grown');
  assert.equal(walk(L(VINE.x, 0, VINE.face + 1.0), { tol: 0.5 }), true, `to the vine's foot (${where()})`);
  assert.ok(climb([VINE.x, UP, VINE.face - 2], UP), `up the vine to the bridge (${where()})`);
  // ---- up through the house again, the gulf's vines grown for good, the glass, the great door
  assert.equal(via([9, UP, BR.z0 + 2], [14, UP, BR.z1 + 2], [15, UP, GA.n - 2], [2, UP, GA.n + 3], [0, UP, C3 - 6], [0, UP, A0 + 4], [0, UP, LIP - 2], [0, UP, FAR + 2]), true, `back up and over the vine bridge (${where()})`);
  assert.equal(walk(L(1.5, UP, GL - 2.2), { tol: 0.8 }), true, `to the glass's foot (${where()})`);
  assert.ok(climb([1.5, 27, GL + 1.8], 27, 25), `up the vine (${where()})`);
  assert.equal(walk(L(0, 27, HZ + 1.7)), true, `through the great lock (${where()})`);
  assert.equal(rt.logic.keysIn('dB'), 1, 'the great key in it');
  // ---- the Gardener: the beds, then its back in the sun each time it kneels
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  P.opts.health = false;
  const glob = (mode) => { const tg = allTargets().find((x) => x.kind === 'guardian' && x.enabled() && x.position().distanceTo(G.model.pos) < 12 && x.position().distanceTo(G.model.mouth) > 0.5); assert.ok(tg, 'its body is a target'); hitTarget({ target: tg, point: tg.position() }, mode, V(0, 0, 1)); };
  wait(6, () => G.state === 'fight');
  for (const b of ['bed1', 'bed2', 'bed3', 'bed4']) rt.piece(b).hit('bloom');
  const sun = rt.gardenSun;
  const sunOnIt = () => {
    const fs = ['fs1', 'fs2', 'fs3', 'fs4'].map((id) => rt.piece(id)).sort((a, b) => a.pos.distanceTo(G.model.pos) - b.pos.distanceTo(G.model.pos))[0];
    P.teleport(fs.pos.clone().add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0);
    wait(4, () => sun.lights(G.model.pos, SUN.pad));
    P.teleport(G.arena.center.clone().add(V(0, 0.2, 0)).lerp(fs.pos, 0.3), V(0, 1, 0), V(0, 0, 1));
    return sun.lights(G.model.pos, SUN.pad);
  };
  for (let n = 0; n < 14 && G.state !== 'weary'; n++) {
    answerAsks({ G, P, frame }, { keep: true });
    assert.ok(wait(40, () => G.state === 'open'), `it kneels (${n})`);
    if (G.phaseIndex >= 1) sunOnIt();
    glob('bloom');
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  game.reset();
  own();
});

test('the Builders’ Greenhouse’s water reads the same everywhere (G1): every trough, fall, column and gauge follows the sluice as it runs', () => {
  const { rt, wait } = house();
  const S = rt.sluice;
  const gauges = rt.pieces.filter((p) => p instanceof WaterGauge);
  assert.ok(gauges.length >= 10, `a gauge in every room (${gauges.length})`);
  const levelOf = (g) => g.water.position.y - g.foot.y;
  const hi = gauges.map(levelOf);
  rt.logic.moveDrum('sluice', 0); rt.applyDoors();
  wait(SLUICE.run / 2);
  assert.ok(S.k > 0.2 && S.k < 0.8, `it runs (${S.k.toFixed(2)})`);
  wait(SLUICE.run);
  assert.equal(S.k, 0, 'and has run');
  gauges.forEach((g, i) => assert.ok(levelOf(g) < hi[i] - 0.5, 'every gauge’s water down in its lower bulb'));
  const troughs = rt.pieces.filter((p) => p.constructor.name === 'Trough');
  for (const t of troughs) assert.equal(t.water.visible, !t.o.high, `a ${t.o.high ? 'high' : 'low'} trough ${t.o.high ? 'dry' : 'full'} with the water down`);
  game.reset();
  own();
});
