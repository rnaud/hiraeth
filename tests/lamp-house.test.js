// The Lamp-House round its Lamp Hall (issue #410, docs/design/temple-best-practices.md): the great lamp lit or dark is the
// house's one state, kindled once with a bubble of light from its balcony, then set at a lever by every hub or with the hook
// at its pipe's ring on the Dark Gallery's far floor; lit, the Lamp Passage's door opens and a curtain of its light bars
// the Wick Room, dark, the curtain falls and the moss-stones rise; (issue #477) the Kennel's lamp-door woken by a pool-orb on
// the hall's floor before the wand, the great key fetched from the Wick Room straight after it, the lamp on the way back; the great hall seen on both floors at
// once; the drop from its gallery back to the hub's floor. The house walked through with a real traveller and a real bubble
// wand: every lever pulled with the use button, the ring hooked from where he stands, every bubble blown and flown, the drop
// fallen. Its state machine is tests/temples.test.js's, its play-through by hits tests/temple-playthrough.test.js's; this
// is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf, nextSpot } from '../src/temples/index.js';
import { ROOMS, KENNEL, KENNEL_ORB, WICK, ROOT_WAY, FOUNT, GALLERY, GREAT_LAMP, LEDGE, LEVERS, FAR, PIPE, LAMP_LOOK, LIT, DARK, GreatLamp } from '../src/temples/perdide2.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { HOOK } from '../src/gadgets/hook.js';
import bubbleGadget, { BUBBLE } from '../src/gadgets/bubble.js';
import { answerAsks } from './guardian-asks.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The house built in its world, a traveller at its door, his hands and a real bubble wand. */
function house() {
  game.reset();
  own('backpack', 'gun', 'hook');
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.perdide2 ?? 'perdide2').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'perdide2');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const wand = bubbleGadget.create({ player: P, physics, camera: null, tool: null, sound: null, world: null, hud: { reticle() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {}, notice: (s) => notes.push(s), game, bursts: { add() {} } });
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); wand.update(DT); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const path = (...pts) => pts.every((p) => walk(L(...p)));
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const sight = (to, from = P.pos.clone().add(V(0, 1.5, 0))) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  // a bubble blown from his hand toward `to` (a world point), flown for real until it bursts: was it glowing when it did?
  const blow = (to) => {
    let lit = false;
    const off = game.on('bubble:light', () => { lit = true; });
    const from = P.pos.clone().add(V(0, 1.45, 0)), b = wand.spawn('free', from), dir = to.clone().sub(from).normalize();
    b.blow.copy(dir).setY(0).normalize(); b.vel.copy(dir).multiplyScalar(BUBBLE.speed);
    for (let i = 0; i < 5 / DT && wand.bubble; i++) frame();
    off();
    return lit;
  };
  // stand within a light's reach (a pool-lamp's eye, the pipe's basin), on its side toward `to`
  const byLight = (c, to, d = 2.2) => { const n = to.clone().sub(c).setY(0).normalize(); return walk(c.clone().addScaledVector(n, d).setY(c.y - 0.9), { tol: 0.4 }); };
  const byPool = (id, to) => byLight(rt.piece(id).center, to);
  /** The use button by a lever: pulled (what it did). */
  const pull = (lever) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.perdide2.${lever}`, `by ${lever}, the button pulls it (${where()})`); return near.entry.use(P); };
  const toLever = (room) => { const lv = LEVERS.find((l) => l.room === room), [x, y, z] = lv.at, s = Math.sin(lv.yaw), c = Math.cos(lv.yaw); return walk(L(x - s * 1.3, y, z - c * 1.3), { tol: 0.45 }); };
  /** A ring hooked from where he stands (src/gadgets/hook.js: its bite on a target, mode 'hook'), if in the hook's reach and sight. */
  const hook = (id) => { const b = rt.piece(id); assert.ok(b && b.at.distanceTo(P.pos) <= HOOK.range && sight(b.at), `${id} in the hook’s reach and sight (${where()})`); b.hit('push', { mode: 'hook' }); };
  const lit = () => rt.logic.check(LIT), dark = () => rt.logic.check(DARK);
  return { level, physics, rt, P, notes, L, frame, walk, path, wait, where, sight, blow, byLight, byPool, pull, toLever, hook, lit, dark, toward };
}

test('the Lamp-House on foot (issues #410, #477): the hall’s three pools, the Kennel’s pool-orb and its keepers, the Root Stair, the wand, the ledge’s lamp-door, the drop to the hub, the great key from the Wick Room in the dark, the great lamp kindled from its balcony on the way back and its shutters opened, the curtain, the moss-stones risen in the dark, the far door’s lamp lit by a bubble of the great lamp’s light the hook let down its pipe, the Lampless calmed', () => {
  const H = house(), { rt, P, L, walk, path, wait, where, sight, blow, byLight, byPool, pull, toLever, hook, lit, dark, notes, frame, toward } = H;
  const R = ROOMS, PO = R.pools, RS = R.roots, P0 = RS.z0 + RS.near, P1 = P0 + RS.pit, C3 = R.lantern.z, GA = R.gallery, Q0 = GA.z0 + GA.near, Q1 = Q0 + GA.pit;
  const CL = GA.z1 + 0.6 + 7.4 + 1.2 + 19;
  const B = rt.greatLamp;
  wait(0.5);
  assert.equal(P.inDark, true, 'a dark house: the lantern charm glows in it');
  assert.ok(B instanceof GreatLamp && !B.kindled && dark() && !lit(), 'the great lamp hangs cold: the house is dark');
  // ---- the Lamp Hall (G4): 64 m long under 34, its gallery 9 m up along the west wall, both floors seen at once
  assert.ok(PO.z1 - PO.z0 >= 60 && PO.top - PO.y >= 30, 'a great hall: 60 m and more');
  const floorEye = L(8, 1.7, 45);
  // (the head of someone at the gallery's edge, along it: the balcony hides a stretch of it from the way in)
  const seenAt = [GALLERY.z0 + 1.5, 66, 71, 76].filter((z) => sight(L(GALLERY.x1 - 0.8, GALLERY.y + 1.8, z), floorEye));
  assert.ok(seenAt.length >= 2, `the gallery seen from the floor, both floors at once (${seenAt.join(', ')})`);
  assert.ok(sight(B.glass, floorEye), 'the great lamp seen from the way in');
  // the Kennel's lamp-door is cold; the Wick Room's way is open in the dark (its curtain is the lamp's light)
  assert.equal(path([0, 0, 18], [12, 0, KENNEL.z], [16, 0, KENNEL.z]), true, `to the Kennel's door (${where()})`);
  assert.equal(walk(L(24, 0, KENNEL.z), { max: 4 }), false, 'its lamp-door keeps you out');
  assert.ok(notes.some((s) => /lamp-door is cold/.test(s)), 'it says it wants the great lamp’s light');
  assert.equal(path([12, 0, 50], [12, 0, WICK.door], [31, 0, WICK.door + 2]), true, `into the Wick Room while the house is dark (${where()})`);
  assert.ok(!rt.logic.isOpen('cW'), 'its great key behind the grille');
  assert.equal(path([20, 0, WICK.door], [7, 0, WICK.door], [0, 0, 40]), true, `back into the hall (${where()})`);
  // the floor's lever, before the lamp is kindled: it opens its shutters on nothing
  assert.equal(toLever('pools'), true, `to the floor's lever (${where()})`);
  assert.equal(pull('lever.pools'), 'cold');
  assert.ok(dark(), 'still dark');
  // ---- three dark pools: two on the floor, the third up on the loft, out of sight from the floor
  for (const id of ['s1', 's2']) rt.piece(id).hit('shoot');
  wait(1);
  assert.equal(rt.logic.isOpen('d1'), false, 'two lamps of three');
  const eye3 = rt.piece('s3').center;
  for (const [x, z] of [[-3, 22], [6, 30], [0, 44], [16, 17]]) assert.ok(!sight(eye3, L(x, 1.7, z)), `the loft's pool hidden from the floor (${x}, ${z})`);
  assert.equal(walk(L(-3, 0, 33)), true, `to the loft's foot (${where()})`);
  let loft = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(-9, 8, 33))); if (P.onGround && rt.kit.local(P.pos).y > 7.6) { loft = true; break; } }
  assert.ok(loft, `up onto the loft (${where()})`);
  assert.equal(walk(L(-8, 8, 33), { tol: 0.8 }), true, `on the loft (${where()})`);
  assert.equal(walk(L(-14, 9, GALLERY.z0 + 2), { max: 6 }), false, 'the gallery is out of reach from the loft');
  P.teleport(L(-8, 8.1, 33), V(0, 1, 0), V(0, 0, 1)); wait(0.3);
  rt.piece('s3').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  P.teleport(L(0, 0.05, 36), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  // ---- (issue #477) the Kennel's pool-orb on the hall's floor: it drinks the near pool's light (the Root Stair door's), rolled
  // to its socket before it fades, and the socket's lamp wakes the Kennel's lamp-door across the floor
  const [kx, , kz1] = KENNEL_ORB;
  const oK = rt.piece('oK');
  wait(2.6);
  assert.ok(oK.charge > 0, 'the orb caught the near pool’s light');
  assert.ok(sight(L(kx, 2.3, kz1 + 1.6), L(PO.x1 - 2, 1.7, KENNEL.z)), 'the socket’s lamp seen from the Kennel’s door');
  const roll = (o, drum, plate) => { for (let k = 0; k < 8 && !rt.logic.drumOn(drum, plate); k++) { walk(o.center.clone().addScaledVector(o.dir, -(o.r + 1.3)).setY(L(0, 0, 0).y), { tol: 0.5, max: 6 }); o.hit('push', o.dir.clone(), { strength: 1 }); for (let i = 0; i < 5 / DT && !o.rest; i++) frame(); } };
  roll(oK, 'oK', 'pK');
  wait(0.5);
  assert.ok(rt.logic.isLit('lK') && rt.logic.isOpen('dK'), 'the glowing orb in its socket: its lamp catches, and the Kennel’s lamp-door opens');
  assert.ok(dark(), 'the great lamp still cold');
  // ---- the Kennel, in the dark: its keepers beaten, the small key
  const keepers = [{ room: 'kennel', alive: true }, { room: 'kennel', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(path([10, 0, KENNEL.z + 4], [12, 0, KENNEL.z], [20, 0, KENNEL.z], [31, 0, KENNEL.z]), true, `into the Kennel (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dK'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arK') && rt.logic.isOpen('dK'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  const k0 = bestInteractable(P); if (k0?.entry.id === 'temple.perdide2.kS') k0.entry.use(P);
  wait(0.5);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key, before the wand');
  assert.equal(path([31, 0, KENNEL.z], [20, 0, KENNEL.z], [12, 0, KENNEL.z], [12, 0, 50], [0, 0, PO.z1 - 3]), true, `back across the hall (${where()})`);
  // ---- the Root Stair: the orb lit by the small pool, rolled to the socket; the moss-stones; the root-wall
  assert.equal(walk(L(-1, 0, RS.z0 + 2.5)), true, `to the stair (${where()})`);
  const orb5 = rt.piece('orb5');
  rt.piece('s5').hit('shoot');
  wait(2.6);
  assert.ok(orb5.charge > 0, 'the orb caught the pool’s light');
  roll(orb5, 'orb5', 'p5');
  wait(0.5);
  assert.ok(rt.logic.isLit('l5') && rt.logic.isOpen('disc'), 'the glowing orb wakes the moss-stones');
  wait(2);
  assert.equal(walk(L(0, 0, P0 - 1.5)) && walk(L(0, 0, P1 - 0.6), { tol: 0.6 }), true, `over the moss-stones (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, P1 + 6))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  // the ledge back south along the west wall: its lamp-door into the hall's gallery is shut, its lamp cold
  const LX = LEDGE.door.x;
  assert.equal(path([LX, 9, P1 + 2], [LX, 9, RS.z0 + 2]), true, `along the ledge (${where()})`);
  assert.equal(walk(L(LX, 9, PO.z1 - 3), { max: 4 }), false, 'its lamp-door keeps you out');
  // ---- the Lantern Chamber: the wand; the lever by the Lamp Passage cold; the lamp by the dais lit by a bubble of the
  // fount's light, and down the ledge the door sinks
  assert.equal(path([LX, 9, P1 + 2], [0, 9, RS.z1 - 2], [0, 9, C3 - 8]), true, `into the chamber (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  items.grant('bubble'); game.emit('box:opened', { id: 'perdide2.temple.lantern' });
  wait(1);
  assert.equal(path([0, 9, C3 + 6]) && toLever('lantern'), true, `by the chamber's lever (${where()})`);
  assert.equal(pull('lever.lantern'), 'cold', 'the great lamp is cold: nothing behind its shutters');
  assert.equal(rt.logic.isOpen('d2'), false, 'the Lamp Passage’s lamp-door shut');
  const fount = rt.kit.world(...FOUNT);
  assert.equal(walk(fount.clone().add(rt.kit.world(-1.2, 0, 1.6).sub(rt.kit.world(0, 0, 0))), { tol: 0.5 }), true, `by the fount (${where()})`);
  assert.equal(blow(rt.piece('l0').glass), true, 'a bubble of the fount’s light to the lamp by the dais');
  wait(2.2);
  assert.ok(rt.logic.isLit('l0') && rt.logic.isOpen('dC'), 'it catches, and the ledge’s door opens');
  // ---- along the ledge into the gallery, and the drop (G6): off its edge to the hall's floor, the hub, unhurt
  assert.equal(path([0, 9, C3 - 8], [0, 9, RS.z1 - 2], [LX, 9, P1 + 2], [LX, 9, RS.z0 + 1], [LX, 9, PO.z1 - 3], [-13, 9, 66]), true, `through the ledge's door onto the gallery (${where()})`);
  assert.ok(sight(L(6, 1.7, 74), L(-12, 10.6, 71)) && sight(L(8, 1.7, 40), L(-6.2, 10.6, 60)), 'the hall’s floor seen from the gallery’s edge');
  const hearts = P.hearts;
  assert.equal(walk(L(-13, 9, 72), { tol: 0.5 }), true, `to the drop (${where()})`);
  assert.equal(walk(L(-5, 0, 72), { max: 8 }), true, `off the gallery's edge (${where()})`);
  wait(1);
  assert.ok(Math.abs(rt.kit.local(P.pos).y) < 0.5 && P.hearts === hearts, `down on the hall’s floor, unhurt (${where()}, ${P.hearts} of ${hearts})`);
  // ---- (issue #477) the great key straight after the wand: the Wick Room, the house still dark. Two niches, two orbs, one
  // pool-lamp: both burning at once, the Kennel's small key in the grille
  assert.ok(dark() && rt.logic.isOpen('cur'), 'dark: the Wick Room’s way open');
  assert.equal(path([12, 0, WICK.door], [20, 0, WICK.door], [31, 0, WICK.door + 2]), true, `into the Wick Room (${where()})`);
  assert.equal(walk(L(WICK.x, 0, WICK.face - 1.8), { tol: 0.8 }), true, `up to the grille (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('cW'), 1, 'the Kennel’s small key goes into the grille');
  rt.piece('sW').hit('shoot');
  const lightAndRoll = (id, plate) => {
    const o = rt.piece(id);
    assert.equal(byPool('sW', o.center), true, `by the wick-house's pool-lamp (${where()})`);
    assert.equal(blow(o.center), true, `a bubble of its light to ${id}`);
    for (let k = 0; k < 6 && !rt.logic.drumOn(id, plate); k++) { walk(o.center.clone().addScaledVector(o.dir, -(o.r + 1.3)).setY(L(0, 0, 0).y), { tol: 0.5, max: 4 }); o.hit('push', o.dir.clone(), { strength: 1 }); wait(2.4); }
    assert.equal(rt.logic.drumOn(id, plate), true, `${id} in its niche`);
    wait(0.6);
  };
  lightAndRoll('oW1', 'pW1');
  lightAndRoll('oW2', 'pW2');
  wait(2.2);
  assert.ok(rt.logic.isOpen('cW') && rt.logic.isOpen('dU'), 'both niches burn: the grille lifts, and the keepers’ door with it');
  assert.equal(walk(L(WICK.x, 0, WICK.face - 2)) && walk(rt.piece('kB').pos, { tol: 1.2 }), true, `to the great key (${where()})`);
  wait(0.3);
  const k1 = bestInteractable(P); if (k1?.entry.id === 'temple.perdide2.kB') k1.entry.use(P);
  wait(0.5);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key, half-way through the house');
  // the way back up: the stair, the balcony, the keepers' door, the ledge of roots to the root-wall's top, the chamber
  const [sx0, sx1, sz] = WICK.stair;
  const upToChamber = () => walk(L(WICK.x, 0, WICK.face - 2)) && path([41, 0, 83], [52, 0, 83], [52, 0, 102], [sx0 + 1.5, 0, sz]) && walk(L(sx1 + 0.4, 9, sz), { max: 12 }) && walk(L(28.5, 9, ROOT_WAY.z))
    && path([22, 9, ROOT_WAY.z], [15.8, 9, ROOT_WAY.z], [15.8, 9, P1 + 2], [6, 9, P1 + 4], [0, 9, RS.z1 - 2], [0, 9, C3 - 8]);
  assert.equal(upToChamber(), true, `up through the keepers' door, along the ledge, into the chamber (${where()})`);
  // ---- the way back: along the ledge into the gallery; the great lamp's balcony, its pool lit, a bubble of its light to the glass
  assert.equal(path([0, 9, RS.z1 - 2], [LX, 9, P1 + 2], [LX, 9, RS.z0 + 1], [LX, 9, PO.z1 - 3], [-13, 9, 60]), true, `back onto the gallery (${where()})`);
  rt.piece('s8').hit('shoot');
  wait(0.5);
  assert.equal(walk(L(GALLERY.pool[0] - 2.2, GALLERY.y, GALLERY.pool[1]), { tol: 0.4 }), true, `by the balcony's pool-lamp, the great lamp beyond it (${where()})`);
  assert.equal(blow(B.glass), true, 'a bubble of its light, out to the great lamp');
  wait(0.5);
  assert.ok(B.kindled && !lit(), 'it catches behind its shutters: the house still dark');
  assert.ok(notes.some((s) => /catches behind its shutters/.test(s)));
  assert.ok(!rt.logic.isOpen('d2'), 'the Lamp Passage’s lamp-door still shut');
  // the gallery's lever: the shutters open, the hall floods, the Lamp Passage opens, the curtain bars the Wick Room
  assert.equal(toLever('hallUp'), true, `by the gallery's lever (${where()})`);
  assert.equal(pull('lever.hallUp'), 'lit');
  wait(2.5);
  assert.ok(lit() && rt.logic.isOpen('d2') && !rt.logic.isOpen('cur'), 'lit: the Lamp Passage’s door open, the Wick Room curtained');
  assert.ok(B.k > 0.9 && B.light.w > 30, 'the great lamp blazes over the hall');
  // down to the floor again: the curtain of light across the Wick Room's way, the floor's lever darkens the house
  assert.equal(walk(L(-13, 9, 72), { tol: 0.5 }) && walk(L(-5, 0, 72), { max: 8 }), true, `off the gallery's edge (${where()})`);
  wait(1);
  assert.equal(path([12, 0, WICK.door]), true, `to the Wick Room's way (${where()})`);
  assert.equal(walk(L(24, 0, WICK.door), { max: 4 }), false, 'the curtain of light keeps you out');
  assert.ok(notes.some((s) => /curtain of the great lamp’s light/.test(s)), 'it says so');
  assert.equal(toLever('pools'), true, `to the floor's lever (${where()})`);
  assert.equal(pull('lever.pools'), 'dark');
  wait(2.5);
  assert.ok(dark() && rt.logic.isOpen('cur'), 'dark: the curtain falls');
  assert.ok(rt.logic.isOpen('dK') && rt.logic.isOpen('d2'), 'the lamp-doors stay open, for good');
  assert.ok(rt.logic.isOpen('br1'), 'and far off, in the dark, the moss-stones rise and take root');
  assert.equal(path([12, 0, WICK.door], [20, 0, WICK.door], [31, 0, WICK.door + 2]) && upToChamber() && path([0, 9, C3 + 10]), true, `through the Wick Room and its keepers' door, back into the chamber (${where()})`);
  // ---- the Dark Gallery, dark: the moss-stones up; over them
  assert.equal(path([0, 9, GA.z0 + 2], [0, 9, Q0 - 0.7]), true, `to the chasm (${where()})`);
  const ring = rt.piece('hb.pipe');
  assert.ok(ring.at.distanceTo(P.pos) > HOOK.range + 2, 'the pipe’s ring out of the hook’s reach from the near lip');
  // (and the chasm wider than the hook reels you: no way over it but the stones)
  assert.ok(GA.pit > HOOK.range, `the chasm ${GA.pit} m, the hook ${HOOK.range}`);
  assert.equal(walk(L(0, 9, Q1 + 1.3)), true, `over the moss-stones (${where()})`);
  assert.ok(P.pos.y > L(0, 8, 0).y, 'on them, not in the chasm');
  // ---- the far floor: the far door's lamp cold, the basin under the great lamp's pipe dry; a bubble blown there carries
  // nothing. The hook at the pipe's ring: the valve opens, the shutters too, and the light pours down for a few breaths
  const basin = rt.piece('pv').basin, l2 = rt.piece('l2');
  assert.equal(byLight(basin, l2.glass, 1.8), true, `by the basin (${where()})`);
  assert.equal(blow(l2.glass), false, 'a bubble blown at the dry basin carries no light');
  assert.equal(rt.logic.isLit('l2'), false);
  const from = rt.kit.world(...ring.o.from);
  assert.equal(walk(from, { tol: 0.6 }), true, `to where the ring is hooked from (${where()})`);
  hook('hb.pipe');
  wait(0.5);
  assert.ok(lit() && rt.piece('pv').pouring, 'hooked: the great lamp lit again, its light pouring into the basin');
  assert.ok(rt.logic.isOpen('br1'), 'the moss-stones keep their root behind him');
  assert.equal(byLight(basin, l2.glass, 1.8), true, `back by the basin (${where()})`);
  assert.equal(blow(l2.glass), true, 'a bubble of the poured light to the far door’s lamp');
  assert.equal(rt.logic.isLit('l2'), true, 'it catches');
  wait(PIPE.hold + 1);
  assert.ok(!rt.piece('pv').pouring, 'the valve shuts again');
  // ---- the great lock: the great key, the lamp lit
  assert.equal(walk(L(0, 9, GA.z1 - 1.5)), true, `to the far door (${where()})`);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d4'), 'the great key turns, its lamp lit: the far door opens');
  // ---- the Lamp-Room: send the Lampless light while it searches (a lure pool lit, from afar in its last phase)
  assert.equal(walk(L(0, 9, CL - 16.5)), true, `into the lamp-room (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const lure = rt.lurePools.list[0];
  for (let n = 0; n < 12 && G.state !== 'weary'; n++) {
    answerAsks({ G, P, frame }, { keep: true });
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it hangs low, searching (${n})`);
    const before = G.meter, body = G.model.pos.clone().add(V(0, 2, 0));
    if (!lure.lit) rt.lurePools.light(lure);
    const d = body.clone().sub(lure.at).setY(0).normalize();
    if (G.phaseIndex >= 2) P.teleport(lure.at.clone().setY(L(0, 9, 0).y).add(V(lure.at.x > L(0, 9, CL).x ? -9 : 9, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
    else {
      P.teleport(lure.at.clone().addScaledVector(d, -2.2).setY(L(0, 9, 0).y + 0.05), V(0, 1, 0), V(0, 0, 1));
      P.vel.set(0, 0, 0);
      if (P.pos.distanceTo(body) < 12) blow(G.model.pos.clone().add(V(0, 2, 0)));
    }
    for (let i = 0; i < 8 / DT && G.meter === before && G.state === 'open'; i++) frame();
    assert.ok(G.meter > before || G.state !== 'open', `it drank (${n}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 20 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  P.teleport(G.model.pos.clone().setY(L(0, 9, 0).y).add(V(0, 0.1, -2.4)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.perdide2.touch', 'a hand on its back');
  near.entry.use(P);
  assert.equal(game.flag('temple.perdide2.done'), true);
  game.reset();
  own();
});

test('the Lamp-House’s other way round (issue #410): into the Dark Gallery while the great lamp is lit, the moss-stones lie sunk; the chamber’s lever a room back darkens it, they rise and take root, and stay when it is lit again; the house’s lamps warm and cold with it', () => {
  const H = house(), { rt, L, P, walk, path, wait, where, pull, toLever, lit, dark, notes } = H;
  const R = ROOMS, GA = R.gallery, Q0 = GA.z0 + GA.near, C3 = R.lantern.z;
  for (const [k, v] of Object.entries({ 'lit.s1': true, 'lit.s2': true, 'lit.s3': true, 'open.d1': true, 'open.disc': true, gadget: true, 'lit.l0': true, 'open.dC': true, 'lit.s8': true, 'lit.lG': true })) game.set(`temple.perdide2.${k}`, v);
  items.grant('bubble');
  rt.logic.update(); rt.applyDoors();
  P.teleport(L(0, 9.1, C3 + 2), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  assert.ok(rt.greatLamp.kindled && dark(), 'kindled, its shutters shut');
  assert.ok(rt.greatLamp.lamp.uniforms.uColor.value.getHexString() === new THREE.Color(LAMP_LOOK.dark).getHexString(), 'the house’s lamps cold');
  assert.equal(toLever('lantern'), true, `by the chamber's lever (${where()})`);
  assert.equal(pull('lever.lantern'), 'lit');
  wait(2.5);
  assert.ok(lit() && rt.logic.isOpen('d2'), 'lit: the Lamp Passage’s door opens');
  assert.ok(rt.greatLamp.lamp.uniforms.uColor.value.getHexString() === new THREE.Color(LAMP_LOOK.lit).getHexString(), 'the house’s lamps warm');
  assert.equal(path([0, 9, C3 + 10], [0, 9, GA.z0 + 2], [-6, 9, GA.z0 + 4], [0, 9, Q0 - 0.7]), true, `by the gallery's mark to the chasm (${where()})`);
  assert.equal(rt.logic.isOpen('br1'), false, 'the moss-stones lie sunk in the lamp’s light');
  assert.ok(notes.some((s) => /moss-stones lie sunk/.test(s)), 'it says so');
  assert.equal(walk(L(0, 9, Q0 + 4), { max: 4 }), false, 'and there is nothing to stand on: he falls');
  wait(1);
  assert.ok(rt.kit.local(P.pos).y > 8 && rt.kit.local(P.pos).z < Q0 + 1, `back at the gallery's mark, not over the chasm (${where()})`);
  assert.equal(path([0, 9, GA.z0 + 2], [0, 9, C3 + 10]) && toLever('lantern'), true, `back to the chamber's lever (${where()})`);
  assert.equal(pull('lever.lantern'), 'dark');
  wait(2.5);
  assert.ok(dark() && rt.logic.isOpen('br1') && rt.logic.isOpen('d2'), 'dark: the moss-stones rise; the passage’s door stays open');
  assert.equal(pull('lever.lantern'), 'lit');
  wait(2.5);
  assert.ok(lit() && rt.logic.isOpen('br1'), 'lit again: the moss-stones keep their root');
  game.reset();
  own();
});

test('the Lamp-House’s scout (issue #410): with the great lamp cold it points at its glass; kindled, at the nearest lever (or the pipe’s ring, the hook in hand)', () => {
  const H = house(), { rt, L, P, wait } = H;
  wait(0.3);
  const B = rt.greatLamp;
  assert.ok(B.center.distanceTo(B.glass) < 0.01, 'cold: its glass');
  game.set('temple.perdide2.lit.lG', true);
  P.teleport(L(10, 0.1, 48), V(0, 1, 0), V(0, 0, 1)); wait(0.2);
  const [x, y, z] = LEVERS.find((l) => l.room === 'pools').at;
  assert.ok(B.center.distanceTo(L(x, y + 1.15, z)) < 0.2, 'kindled: the floor’s lever, the nearest');
  const far = ROOMS.gallery.z0 + ROOMS.gallery.near + ROOMS.gallery.pit;
  P.teleport(L(4, 9.1, far + 3), V(0, 1, 0), V(0, 0, 1)); wait(0.2);
  assert.ok(B.center.distanceTo(rt.piece('hb.pipe').at) < 0.8, 'on the far floor, the hook in hand: the pipe’s ring');
  assert.ok(nextSpot(rt), 'the marker has somewhere to point');
  game.reset();
  own();
});
