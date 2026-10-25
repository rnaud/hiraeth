// The Warden's Well round its Well (issue #413, docs/design/temple-best-practices.md): the house's breath its one state,
// out or in, set at a lever by every hub and read on a gauge in every room; the Turning Floors' two vanes; two small keys
// and a choice of door at the hub; the Vane Room's chasm wider than the pen draws, its breath-stones standing on the
// out-breath, its great key's cage the fan comes back for; the Well, a great hall with its floors round an open core, and
// the view from the crown down it; the crown's eye woken by the hook and the fan at once (the ring let down on the
// in-breath); the high ledge on the draught; the drops down the core and the Flue, and the Flue's valve into the Bellows
// Chamber, the fast way back. The house walked through with a real traveller, a real gust fan, a real bridge pen, every
// lever pulled with the use button, the ring hooked from where he stands, every drop fallen with his hearts counted.
// Its state machine is tests/temples.test.js's, its play-through by hits tests/temple-playthrough.test.js's; this is the
// feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf } from '../src/temples/attachment.js';
import { BELLOWS_NEXT, BREATHE_OUT, upUsed, VANES, FLUE, ROOMS, FLOORS, CLIMB, WING, LEVERS, RING, VANE_ROOM, OUT, IN, BreathGauge, Breath } from '../src/temples/incal.js';
import { createIncal } from '../src/levels/incal.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { inColumn } from '../src/updraft.js';
import { HOOK } from '../src/gadgets/hook.js';
import fanGadget, { FAN } from '../src/gadgets/fan.js';
import bridgeGadget, { PEN } from '../src/gadgets/bridge.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The house built in its world, a traveller at its door, his hands, a real gust fan and a real bridge pen. */
function house() {
  game.reset();
  own('backpack', 'gun', 'glider', 'hook');
  const scene = new THREE.Scene();
  const level = quiet(() => createIncal(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'incal') ?? level.temple;
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, killY: level.killY });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const ctx = { player: P, physics, camera: null, tool: null, sound: null, world: null, hud: { reticle() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {}, notice: (s) => notes.push(s), game, bursts: { add() {} } };
  const fanG = fanGadget.create({ ...ctx });
  const pen = bridgeGadget.create({ ...ctx, scene: new THREE.Group() });
  // (the fan swung down at the great vane he hovers over, every swing: FAN.cool)
  let fanT = 0, fanAt = null;
  const fanDown = () => {
    const v = fanAt;
    if (!v || P.onGround || !items.has('fan') || (fanT -= DT) > 0) return;
    if (v.center.distanceTo(P.pos) > FAN.range - 1 || P.pos.y < v.center.y) return;
    const hand = P.pos.clone().add(V(0, 1.4, 0));
    fanG.gust(hand, v.center.clone().sub(hand).normalize());
    fanT = FAN.cool;
  };
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); fanDown(); pen.update?.(DT); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const path = (...pts) => pts.every((p) => walk(L(...p)));
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((n) => re.test(n));
  const ly = () => rt.kit.local(P.pos).y;
  const sight = (to, from = P.pos.clone().add(V(0, 1.5, 0))) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  const inAir = () => inColumn(P);
  /** Up the rising air from where you stand (a jump, the wings held open) until it holds you at its top, or s seconds. */
  const rise = (s = 16) => {
    for (let i = 0; i < 4; i++) frame({ Space: true }, 0);
    for (let i = 0; i < s / DT; i++) { frame({ Space: true }, 0); if (i > 30 && inAir() && Math.abs(P.vel.y) < 0.3) return true; }
    return inAir();
  };
  /** Off an edge into the rising air at `to` (local [x, z]): a jump toward it, the wings open, until it takes you; then up it. */
  const leapInto = (to, s = 16) => {
    const target = L(to[0], ly(), to[1]);
    for (let i = 0; i < 3 / DT && !inAir(); i++) { P.heading = P.frame.headingOf(target.clone().sub(P.pos).setY(0)); frame({ Space: true, KeyW: P.onGround }, toward(target)); }
    return inAir() && rise(s);
  };
  const holding = (s, fn = () => false) => { for (let i = 0; i < s / DT; i++) { frame({ Space: true }, 0); if (fn()) return true; } return false; };
  /** Out of the rising air toward `to` (local [x, y, z]): the stick while in it, the glide on, the wings folded over it. */
  const glideTo = (to, { max = 10, near = 1.2 } = {}) => {
    const target = L(...to);
    for (let i = 0; i < max / DT && !P.onGround; i++) {
      if (!inAir()) P.heading = P.frame.headingOf(target.clone().sub(P.pos).setY(0));
      frame(flat(target) < near ? {} : { Space: true, KeyW: inAir() }, toward(target));
    }
    return P.onGround && flat(target) < 2.6 && Math.abs(P.pos.y - target.y) < 0.6;
  };
  const land = () => { for (let i = 0; i < 12 / DT && !P.onGround; i++) frame({}, 0); return P.onGround; };
  const push = (ball, n = 8, until = () => false) => {
    for (let k = 0; k < n && !until(); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -2.0), { tol: 0.5 });
      ball.hit('push', ball.dir.clone(), { strength: 0.6 });
      wait(2.5);
    }
  };
  /** The use button by a lever: pulled (what it did). */
  const pull = (lever) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.incal.${lever}`, `by ${lever}, the button pulls it (${where()})`); return near.entry.use(P); };
  const toLever = (id) => { const lv = LEVERS.find((l) => l.id === id), [x, y, z] = lv.at, s = Math.sin(lv.yaw), c = Math.cos(lv.yaw); return walk(L(x + s * 1.3, y, z + c * 1.3), { tol: 0.45 }); };
  const openChest = (id) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.incal.${id}`, `by the chest of ${id}, the button opens it (${where()})`); near.entry.use(P); };
  /** A plank drawn with the pen from the feet toward `to` (a real pen, src/gadgets/bridge.js). */
  const drawTo = (to) => {
    const eye = P.pos.clone().add(V(0, 1.8, 0)), d = to.clone().sub(eye).setY(0).normalize();
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
    cam.position.copy(eye).addScaledVector(d, -3); cam.lookAt(cam.position.clone().add(d)); cam.updateMatrixWorld(true);
    pen.ctx.camera = cam; pen.ink = PEN.ink;
    const n0 = pen.bridges.length;
    pen.press();
    for (let i = 0; i < 3 / DT && pen.state === 'draw'; i++) { pen.hold(DT); pen.update(DT); if (pen.len > to.distanceTo(P.pos) + 0.6) break; }
    pen.release();
    return pen.bridges.length > n0;
  };
  /** The ring hooked from where he stands (src/gadgets/hook.js: its bite on a target, mode 'hook'), if in reach and sight. */
  const hook = (id) => { const b = rt.piece(id); assert.ok(b && b.group.visible && b.at.distanceTo(P.pos) <= HOOK.range && sight(b.at), `${id} in the hook’s reach and sight (${where()})`); b.hit('push', { mode: 'hook' }); };
  const hearts = () => P.hearts;
  /** Round one of the Well's floors (a ring round the open core) to `to` (local): along the ring 11 m out, then to it. */
  const around = (to, { r = 11.5 } = {}) => {
    const C = L(0, 0, ROOMS.chest.z), y = to[1], ang = (p) => Math.atan2(p.x - C.x, p.z - C.z);
    let a = ang(P.pos);
    const b = ang(L(...to));
    let d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const n = Math.ceil(Math.abs(d) / 0.4);
    if (!walk(L(Math.sin(a) * r, y, ROOMS.chest.z + Math.cos(a) * r), { tol: 0.8, max: 8 })) return false;
    for (let i = 1; i <= n; i++) { const u = a + (d * i) / n; if (!walk(L(Math.sin(u) * r, y, ROOMS.chest.z + Math.cos(u) * r), { tol: 0.9, max: 6 })) return false; }
    return walk(L(...to), { tol: 0.6, max: 8 });
  };
  return { level, physics, rt, P, notes, L, frame, walk, path, wait, where, said, ly, sight, inAir, rise, leapInto, holding, glideTo, land, push, pull, toLever, openChest, drawTo, hook, hearts, fanG, pen, around,
    fan: (v) => { fanAt = v; }, toward, flat };
}

const C2 = ROOMS.climb.z, C3 = ROOMS.chest.z, G0 = FLOORS.gallery, GC = FLOORS.loft, GK = FLOORS.crown, H0 = FLOORS.hall, WZ = WING.z, RX = WING.vane.x;

test('the Warden’s Well on foot (issue #413): the Turning Floors’ two vanes, the hub’s two keys and a choice of door, the breath let out at the hub’s lever and the Vane Room’s stones, the planks to them and on, the great key’s cage too heavy for a splash; the Climb’s ball and its key, the fan; back to the Vane Room for the great key; the Well and its floors, the eye and the ball, the view down the core; the crown’s ring let down on the in-breath and hooked, the great vane fanned, the eye; the breath let out and the draught to the high ledge; the drops down the core and the Flue, the valve, the ride up again; the warden; the shaft’s breath', () => {
  const H = house(), { rt, P, L, walk, path, wait, where, said, ly, sight, rise, leapInto, holding, glideTo, land, push, pull, toLever, openChest, drawTo, hook, hearts, fan, pen, notes, frame, flat } = H;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'in the tower');
  const B = rt.breath, out = () => rt.logic.check(OUT), inn = () => rt.logic.check(IN);
  assert.ok(B instanceof Breath && inn() && !out(), 'the house breathes in');
  // G1: a gauge in every room but the guardian's and the way in, a lever by every hub
  const gauged = new Set(rt.pieces.filter((p) => p instanceof BreathGauge).map((p) => p.o.room));
  for (const r of ['turning', 'climb', 'store', 'vane', 'vaneFar', 'jets', 'gallery', 'loft', 'crown', 'flue']) assert.ok(gauged.has(r), `a gauge in ${r}`);
  for (const r of ['climb', 'gallery', 'loft', 'crown']) assert.ok(LEVERS.some((l) => l.room === r), `a lever by the ${r}`);
  // the gauges' rings drift down while it breathes in
  const g0 = rt.pieces.find((p) => p instanceof BreathGauge && p.o.room === 'turning');
  const ringsY = () => g0.s;
  { const a = ringsY(); wait(0.2); const b = ringsY(); assert.ok(b < a || b > a + 0.3, `the rings sink (${a.toFixed(2)} → ${b.toFixed(2)})`); }

  // ---- the Turning Floors: each disc rides only while its own vane turns: the pillar's by the island, the far pillar's high
  assert.equal(walk(L(0, 0, 17)), true, `to the drop (${where()})`);
  const [discA, discB] = rt.pieces.filter((p) => p.path);
  const v1 = rt.piece('v1'), v1b = rt.piece('v1b');
  assert.ok(sight(v1.center) && sight(v1b.center), 'both vanes in sight from the near ledge');
  assert.ok(v1b.center.distanceTo(P.pos) > 20, `the far one high, over 20 m off (${v1b.center.distanceTo(P.pos).toFixed(1)})`);
  v1.hit('shoot');
  wait(0.2);
  assert.ok(v1.turning && !rt.logic.isOpen('discs'), 'one vane alone: not across');
  v1b.hit('shoot');
  wait(0.2);
  assert.ok(rt.logic.isOpen('discs'), 'both turn: the discs ride');
  const ride = (disc, vane, off) => {
    for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.3); i++) { frame(); if (!vane.turning) vane.hit('shoot'); }
    assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the disc (${where()})`);
    for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
    assert.equal(walk(off, { tol: 0.8 }), true, `off the disc (${where()})`);
  };
  ride(discA, v1, L(0, 0, 29));
  ride(discB, v1b, L(0, 0, 42.5));
  assert.ok(ly() > -1, 'across, not in the drop');

  // ---- the Climb, the hub: the Ash Store west (its keepers, its key, the pen)
  assert.equal(walk(L(0, 0, C2 - 1.6)), true, `into the well (${where()})`);
  const WS = WING.store.x;
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-5, 0, WZ)) && walk(L(-17, 0, WZ)) && walk(L(WS + 10, 0, WZ)), true, `into the Ash Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dW'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dW'), 'won');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest('kW');
  assert.equal(rt.logic.keys('small'), 1, 'a small key in hand');
  const penBox = PLACEMENTS.incal.find((b) => b.id === 'incal.bridge');
  assert.ok(penBox.ready(game), 'the pen’s chest opens once the store is won');
  items.grant('bridge'); game.set('box.incal.bridge', true); game.emit('box:opened', { id: 'incal.bridge', item: 'bridge' });
  // G3c: one key, two locked doors: the balcony's north door and the east way's; this time the east first
  assert.ok(rt.logic.canUnlock('d1') && rt.logic.canUnlock('dV'), 'one key in hand, two doors that take it');
  assert.equal(walk(L(-17, 0, WZ)) && walk(L(10, 0, WZ)), true, `back across the hub (${where()})`);
  assert.equal(walk(L(RX - 15.6 - 3, 0, WZ), { tol: 0.6, max: 8 }), true, `up to the Vane Room's door (${where()})`);
  wait(1.5);
  assert.ok(rt.logic.keysIn('dV') === 1 && rt.logic.isOpen('dV'), 'the key goes in, the door opens');
  assert.equal(rt.logic.keys('small'), 0);

  // ---- the Vane Room: its chasm 17 m across, wider than the pen draws; the breath-stones down while the house breathes in
  const [N0, N1] = WING.gap, [p0, p1] = VANE_ROOM.pier;
  assert.ok(N1 - N0 > PEN.max, `wider than one plank (${N1 - N0} m)`);
  assert.equal(walk(L(N0 - 0.6, 0, WZ), { tol: 0.4 }), true, `to the chasm's edge (${where()})`);
  assert.equal(rt.logic.isOpen('stones'), false, 'its breath-stones down in the dark');
  // back to the hub's lever: the house breathes out
  assert.equal(walk(L(10, 0, WZ)) && walk(L(-3, 0, C2)) && toLever('lever.climb'), true, `to the Climb's lever (${where()})`);
  assert.equal(pull('lever.climb'), 'out');
  wait(0.5);
  assert.ok(out() && said(/breathes out/), 'the house breathes out');
  { const a = ringsY(); wait(0.2); const b = ringsY(); assert.ok(b > a || b < a - 0.3, 'the gauges’ rings rise'); }
  assert.equal(walk(L(10, 0, WZ)) && walk(L(N0 - 0.6, 0, WZ), { tol: 0.4 }), true, `back to the chasm (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.isOpen('stones'), true, 'the breath-stones stand');
  // a plank to the stones, one on to the far floor
  assert.equal(drawTo(L(p0 + 1.2, 0, WZ)), true, 'a plank to the stones');
  assert.equal(walk(L(p0 + 1.2, 0, WZ)) && walk(L(p1 - 0.6, 0, WZ), { tol: 0.4 }), true, `onto the stones (${where()})`);
  assert.ok(ly() > -1, 'on them, not in the chasm');
  assert.equal(drawTo(L(N1 + 1.5, 0, WZ)), true, 'a plank on to the far floor');
  assert.equal(walk(L(N1 + 1.5, 0, WZ)), true, `across (${where()})`);
  assert.ok(ly() > -1, 'over the chasm, not in it');
  // the great key in its cage, and the great vane by it too heavy for a splash: the fan's work (come back)
  const vR = rt.piece('vR'), kG = rt.piece('kG');
  vR.hit('shoot');
  wait(0.3);
  assert.ok(!vR.turning && said(/too heavy/), 'a splash only rocks it');
  assert.equal(walk(kG.pos, { tol: 1.4, max: 6 }), true, `to the great key's cage (${where()})`);
  wait(0.4);
  assert.equal(rt.logic.isFound('kG'), false, 'its cage shut');
  // the planks back (the ink wears off: the way back is drawn again)
  for (let i = 0; i < (PEN.life + PEN.fade + 1) / DT && pen.bridges.length; i++) frame();
  assert.equal(walk(L(N1 + 0.6, 0, WZ), { tol: 0.4 }), true);
  assert.equal(drawTo(L(p1 - 1.2, 0, WZ)), true, 'a plank back to the stones');
  assert.equal(walk(L(p1 - 1.2, 0, WZ)) && walk(L(p0 + 0.6, 0, WZ), { tol: 0.4 }), true, `onto the stones (${where()})`);
  assert.equal(drawTo(L(N0 - 1.5, 0, WZ)), true, 'and back to the near floor');
  assert.equal(walk(L(N0 - 1.5, 0, WZ)) && walk(L(N0 - 3.5, 0, WZ)), true, `back (${where()})`);

  // ---- the Climb: up the block's face; the ball over the slot while the vane far below turns, onto its plate: the key's cage
  assert.equal(walk(L(10, 0, WZ)) && walk(L(0, 0, C2 - 1.6)), true, `back into the well (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, H.toward(L(0, 11, C2 + CLIMB.face + 3.4))); if (P.onGround && ly() > 10.5) { up = true; break; } }
  assert.ok(up, `up the face (${where()})`);
  const ball = rt.piece('ball1'), gap = ball.o.gap, v2 = rt.piece('v2'), kC = rt.piece('kC');
  push(ball, 2);
  assert.ok(ball.t <= gap.from + 1e-3 && said(/slot’s lip/), 'the ball stops at the slot’s lip');
  v2.hit('shoot');
  wait(0.2);
  assert.equal(rt.logic.isOpen('slot'), true, 'the slot stands while the vane turns');
  push(ball, 8, () => rt.logic.drumOn('ball1', 'p1'));
  assert.ok(rt.logic.drumOn('ball1', 'p1'), `onto its plate (${ball.t.toFixed(2)})`);
  if (!v2.turning) v2.hit('shoot');
  assert.equal(walk(kC.pos, { tol: 1.2, max: 8 }), true, `to the small key's cage (${where()})`);
  wait(0.4);
  openChest('kC');
  assert.equal(rt.logic.keys('small'), 1, 'the second small key');
  // the balcony's door: the key, and its leaves open on the out-breath
  assert.equal(walk(L(0, 11, C2 + ROOMS.climb.r - 1.3), { tol: 0.5 }), true, `to the door at the balcony's end (${where()})`);
  wait(2.5);
  assert.ok(rt.logic.keysIn('d1') === 1 && rt.logic.isOpen('d1'), 'the key goes in, and the door opens: the house breathes out');

  // ---- the Bellows Chamber: the gust fan; the plinth's draught rises while the house breathes out
  assert.equal(walk(L(0, 11, C3 - 6.4)), true, `into the chamber (${where()})`);
  const pings = [], offPing = game.on('scout:ping', (e) => pings.push(e));
  items.grant('fan'); game.emit('box:opened', { id: 'incal.temple.jetpack' });
  wait(1.6);
  assert.ok(notes.includes(BELLOWS_NEXT) && pings.length === 1, `the next step said, the drone sent up (${notes.at(-1)})`);
  offPing?.();
  const draft = rt.pieces.find((p) => p.lift && p.o.when?.all);
  assert.ok(draft?.on, 'the draught rises over the plinth');
  // the valve in the west wall: shut from this side
  assert.equal(walk(L(-7.5, 11, C3), { tol: 0.6, max: 6 }), true, `to the west wall's valve (${where()})`);
  assert.equal(walk(L(-14, 11, C3), { max: 3 }), false, 'the valve keeps you out from the chamber');
  assert.ok(said(/only from the Flue/), 'it says so');

  // ---- back to the Vane Room with the fan: down off the balcony, across on the stones and two planks, the great vane fanned
  assert.equal(path([0, 11, C3 - 8], [0, 11, C2 + ROOMS.climb.r - 1.5], [6, 11, C2 + CLIMB.face + 1.5]), true, `back onto the balcony (${where()})`);
  const h0 = hearts();
  assert.equal(walk(L(6, 0, C2 + 2), { max: 6 }), true, `off the balcony to the well's floor (${where()})`);
  assert.equal(hearts(), h0, '11 m: no harm');
  assert.equal(walk(L(10, 0, WZ)) && walk(L(N0 - 0.6, 0, WZ), { tol: 0.4 }), true, `to the chasm (${where()})`);
  for (let i = 0; i < 4 / DT && pen.ink < PEN.ink - 0.1; i++) frame();
  assert.equal(drawTo(L(p0 + 1.2, 0, WZ)) && walk(L(p0 + 1.2, 0, WZ)) && walk(L(p1 - 0.6, 0, WZ), { tol: 0.4 }), true, `onto the stones (${where()})`);
  assert.equal(drawTo(L(N1 + 1.5, 0, WZ)) && walk(L(N1 + 1.5, 0, WZ)), true, `across (${where()})`);
  assert.equal(walk(vR.center.clone().add(V(3.4, 0, 0)), { tol: 0.6, max: 6 }), true, `beside the great vane, on its far side (${where()})`);
  { const hand = P.pos.clone().add(V(0, 1.4, 0)); H.fanG.gust(hand, vR.center.clone().sub(hand).normalize()); }
  wait(0.2);
  assert.ok(vR.turning && said(/cage stirs/), 'the fan’s gust turns it');
  assert.equal(walk(kG.pos, { tol: 1.4, max: 4 }), true, `to the great key (${where()})`);
  wait(0.4);
  openChest('kG');
  assert.equal(rt.logic.isFound('kG'), true, 'the great key, while the vane turns and the house breathes out');
  // back over, up the face, through the balcony's door (open for good)
  for (let i = 0; i < (PEN.life + PEN.fade + 4) / DT && (pen.bridges.length || pen.ink < PEN.ink - 0.1); i++) frame();
  assert.equal(walk(L(N1 + 0.6, 0, WZ), { tol: 0.4 }), true, `to the far lip (${where()})`);
  assert.equal(drawTo(L(p1 - 1.2, 0, WZ)), true, `a plank back (${pen.ink.toFixed(1)} ink, ${pen.bridges.length} planks)`);
  assert.equal(walk(L(p1 - 1.2, 0, WZ)) && walk(L(p0 + 0.6, 0, WZ), { tol: 0.4 }), true, `back onto the stones (${where()})`);
  assert.equal(drawTo(L(N0 - 1.5, 0, WZ)) && walk(L(N0 - 1.5, 0, WZ)) && walk(L(10, 0, WZ)) && walk(L(0, 0, C2 - 1.6)), true, `back into the well (${where()})`);
  up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, H.toward(L(0, 11, C2 + CLIMB.face + 3.4))); if (P.onGround && ly() > 10.5) { up = true; break; } }
  assert.ok(up, `up the face again (${where()})`);
  assert.equal(path([0, 11, C2 + ROOMS.climb.r - 1.5], [0, 11, C3 - 6.4]), true, `into the chamber (${where()})`);

  // ---- up the plinth's draught into the Well: the gallery's floor
  assert.equal(walk(L(0, 11, C3), { tol: 0.8 }), true, `onto the plinth (${where()})`);
  assert.equal(H.rise(), true, `up the draught, held at its top (${where()})`);
  assert.ok(ly() > G0 + 1.5, `up through the oculus (${where()})`);
  assert.equal(glideTo([0, G0, C3 - 7.5]), true, `off it onto the gallery floor (${where()})`);
  assert.equal(upUsed(rt), true);
  // G4: the great hall: its floors rings round an open core (the crown's rim, below)
  assert.ok(ROOMS.drum.r * 2 >= 36 && H0 + 9 - 11 >= 60, 'a great hall: 36 m across, its core open 60 m and more');
  // the eye over the west shelf, hidden from the floor; the great vane too heavy for a splash; the fan's gust from the air
  const eye = rt.piece('s2'), vG = rt.piece('vG');
  assert.ok(!sight(eye.center, P.pos.clone().add(V(0, 1.5, 0))), 'the eye hidden from the floor');
  assert.equal(walk(vG.center, { tol: 0.6 }), true, `onto the great vane (${where()})`);
  fan(vG);
  assert.equal(rise(), true, `the breath holds you over it (${where()})`);
  assert.ok(holding(1, () => eye.lidK > 0.95), 'the fan turns it: the eye’s lids lift');
  eye.hit('shoot');
  assert.equal(rt.logic.isLit('s2'), true, 'the eye wakes');
  holding(1);
  assert.equal(rt.logic.isOpen('iris'), true, 'the draught is let on to the loft');
  land(); fan(null);
  // up to the loft on the core's draught
  assert.equal(walk(L(0, G0, C3 - 4.3), { tol: 0.4 }), true, `to the oculus' rim (${where()})`);
  assert.equal(leapInto([0, C3]), true, `into the draught (${where()})`);
  assert.ok(ly() > GC + 1, `up past the loft's floor (${where()})`);
  assert.equal(glideTo([-7, GC, C3 - 9]), true, `off it onto the loft (${where()})`);
  // ---- the loft: the ball stops at the gap; hover over the great vane, push it over from the air
  const ball3 = rt.piece('ball3'), vE = rt.piece('vE'), g3 = ball3.o.gap;
  assert.equal(walk(vE.center, { tol: 0.6 }), true, `onto the loft's vane (${where()})`);
  fan(vE);
  assert.equal(rise(), true, `held over it (${where()})`);
  assert.ok(holding(2, () => rt.logic.isOpen('span')), 'the gap’s stones stand while it turns');
  const aim = ball3.center.clone().sub(P.pos).normalize();
  assert.ok(Math.abs(aim.dot(ball3.dir)) > 0.5, 'the ball pushed along its groove from the air');
  ball3.hit('push', aim, { strength: 1 });
  holding(4, () => ball3.t > g3.to + 0.05);
  assert.ok(ball3.t > g3.to, `over the gap (${ball3.t.toFixed(2)})`);
  holding(10, () => rt.logic.isOpen('iris2'));   // (it rolls on onto its plate while the vane still turns under you)
  assert.ok(rt.logic.drumOn('ball3', 'p3') && rt.logic.isOpen('iris2'), `onto its plate while the vane turns: the draught let on past the crown (${ball3.t.toFixed(2)}, on ${rt.logic.drumOn('ball3', 'p3')}, vE ${rt.logic.isLit('vE')}, out ${out()}, open ${rt.logic.isOpen('iris2')}, ${where()})`);
  land(); fan(null);
  assert.ok(Math.abs(ly() - GC) < 0.6, `landed on the loft (${where()})`);

  // ---- the crown: up the core; the view down it
  assert.equal(path([3, GC, C3 - 11], [-6, GC, C3 - 9.5]) && walk(L(-7.8, GC, C3 - 2.5), { tol: 0.5 }), true, `round the core to the loft’s rim (${where()})`);
  assert.equal(leapInto([0, C3]), true, `into the draught (${where()})`);
  assert.equal(glideTo([-8, GK, C3 - 6]), true, `off it onto the crown (${where()})`);
  // the view down the shaft from the crown's rim: the loft's ring across the core, the gallery's floor, the plinth 57 m down
  const plinth = L(-0.5, 12.3, C3 - 0.2), rim = L(-7.2, GK + 1.8, C3 - 1.2);
  assert.ok(sight(plinth, rim), `from the crown's rim, the plinth ${(rim.y - plinth.y).toFixed(0)} m down the core`);
  assert.ok(sight(L(7.6, GC + 0.3, C3 + 1), rim) && sight(L(5, G0 + 0.3, C3 + 1.5), rim), 'and the loft’s ring and the gallery’s floor: the floors at once');
  // the crown's eye: two things at once. The great vane alone does nothing; the ring is drawn up while the house breathes out
  const s4 = rt.piece('s4'), vC = rt.piece('vC'), ring = rt.piece('ringS');
  assert.ok(!ring.group.visible, 'the ring drawn up into its sleeve on the out-breath');
  assert.equal(H.around([5, GK, C3 + 8.6]), true, `onto the crown's great vane (${where()})`);
  fan(vC);
  assert.equal(rise(), true);
  holding(1);
  assert.ok(vC.turning && s4.lidK < 0.05, 'the vane alone: the lids stay shut');
  s4.hit('shoot');
  assert.ok(!rt.logic.isLit('s4') && said(/ring on its chain/), 'and it says what they want');
  land(); fan(null);
  // the crown's lever: the house breathes in; the draught dies, the ring comes down
  assert.equal(H.around([3, GK, C3 - 13.8]) && toLever('lever.crown'), true, `to the crown's lever (${where()})`);
  assert.equal(pull('lever.crown'), 'in');
  wait(2.5);
  assert.ok(inn() && !draft.on, 'the house breathes in: the core’s draught gone');
  assert.ok(ring.group.visible && rt.kit.local(ring.at).y < GK + 9, 'the ring let down on its chain');
  // hooked from where he stands, then up the great vane's breath and the fan, and the eye splashed from the air
  assert.equal(H.around(RING.from), true, `to where the ring is hooked from (${where()})`);
  hook('ringS');
  wait(0.2);
  assert.ok(rt.logic.isLit('rS') && said(/lids lifts/), 'the chain runs: one lid up a while');
  assert.equal(H.around([5, GK, C3 + 8.6]), true, `back onto the great vane (${where()})`);
  fan(vC);
  assert.equal(rise(), true);
  assert.ok(holding(1.5, () => s4.lidK > 0.95), `both at once: the lids lift (${rt.piece('rS').left.toFixed(1)} s of the ring left)`);
  { const f2 = P.pos.clone().add(V(0, 0.6, 0)); assert.ok(sight(s4.center, f2), 'the eye in sight from the air'); }
  s4.hit('shoot');
  assert.equal(rt.logic.isLit('s4'), true, 'the crown’s eye wakes');
  land(); fan(null);
  // the breath let out again: the draught past the crown to the high ledge
  assert.equal(H.around([3, GK, C3 - 13.8]) && toLever('lever.crown'), true);
  assert.equal(pull('lever.crown'), 'out');
  wait(2.5);
  assert.ok(out() && draft.on && !ring.group.visible, 'the house breathes out: the draught again, the ring drawn up');
  assert.equal(rt.logic.isOpen('lift'), true);

  // ---- G6, the ways down: off the crown's rim through the core onto the gallery's floor, unhurt
  let h1 = hearts();
  assert.equal(H.around([-7.4, GK, C3 - 1.6]), true, `to the crown's rim (${where()})`);
  for (let i = 0; i < 2 / DT && P.onGround; i++) frame({ KeyW: true }, H.toward(L(-3.5, GK, C3 - 2)));
  assert.equal(land(), true);
  assert.ok(Math.abs(ly() - G0) < 0.6, `down the core to the gallery's floor, ${(GK - G0).toFixed(0)} m (${where()})`);
  assert.equal(hearts(), h1, 'unhurt');
  assert.ok(said(/breaks your fall/), 'the Well’s breath breaks the fall');
  // and west out of the gallery into the Flue: down it to its foot, and through the valve into the Bellows Chamber
  h1 = hearts();
  assert.equal(path([-12, G0, C3], [-17, G0, C3]), true, `to the gallery's west doorway (${where()})`);
  for (let i = 0; i < 3 / DT && ly() > G0 - 1; i++) frame({ KeyW: true }, H.toward(L(-24, G0, C3)));
  assert.equal(land(), true);
  assert.ok(Math.abs(ly() - FLUE.foot) < 0.6, `down the Flue to its foot (${where()})`);
  assert.equal(hearts(), h1, 'unhurt');
  assert.equal(path([FLUE.x + FLUE.r - 3, FLUE.foot, C3], [-14, FLUE.foot, C3], [-6, FLUE.foot, C3]), true, `through the valve into the chamber (${where()})`);
  wait(1.5);
  assert.equal(walk(L(-14, FLUE.foot, C3), { max: 3 }), false, 'and it shuts behind you');
  // the fast way back: up again on one ride, from the plinth past every floor to the high ledge
  assert.equal(walk(L(0, 11, C3), { tol: 0.8 }), true, `onto the plinth (${where()})`);
  assert.equal(rise(24), true, `up the draught (${where()})`);
  assert.ok(ly() > H0 + 1, `past the crown, up to the high ledge's height (${where()})`);
  assert.equal(glideTo([0, H0, C3 + ROOMS.drum.r - 4]), true, `off it onto the high ledge (${where()})`);
  // a drop from the high ledge to the crown, unhurt; and back up
  h1 = hearts();
  for (let i = 0; i < 3 / DT && ly() > H0 - 1; i++) frame({ KeyW: true }, H.toward(L(0, GK, C3 + 7)));
  assert.equal(land(), true);
  assert.ok(Math.abs(ly() - GK) < 0.6 && hearts() === h1, `down to the crown, ${H0 - GK} m, unhurt (${where()})`);
  assert.equal(H.around([-7.7, GK, C3 - 2]), true, `to the crown's rim (${where()})`);
  assert.equal(leapInto([0, C3], 20), true, `into the draught (${where()})`);
  assert.equal(glideTo([0, H0, C3 + ROOMS.drum.r - 4]), true, `onto the high ledge again (${where()})`);
  // (the crown's doorway down the Flue, the fast way back from the top: the next test)

  // ---- the Warden's Hall: the high door takes the great key
  const CW = C3 + ROOMS.drum.r + 25.8;
  assert.equal(walk(L(0, H0, CW - 17.2)), true, `into the hall (${where()})`);
  assert.equal(rt.logic.keysIn('d3'), 1, 'the great key went into the high door');
  const K = rt.guardian;
  wait(0.4);
  assert.notEqual(K.state, 'sleep', 'it wakes');
  P.opts.health = false;
  const nearest = () => rt.hallVanes.slice().sort((a, b) => a.center.distanceTo(K.model.pos) - b.center.distanceTo(K.model.pos))[0];
  const hoverOver = (v) => {
    P.teleport(v.center.clone().add(V(0, 4, 0)), V(0, 1, 0), V(0, 0, 1));
    for (let i = 0; i < 2.5 / DT && !(H.inAir() && Math.abs(P.vel.y) < 0.3 && i > 30); i++) frame({ Space: true }, 0);
  };
  for (let n = 0; n < 10 && K.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (K.state === 'open') { open = true; break; } }
    assert.ok(open, `its vents open (${n}, phase ${K.phaseIndex})`);
    if (K.phaseIndex >= 1) {
      wait(2.5);   // (it backs onto its nearest vane)
      const v = nearest();
      { const side = v.center.clone().sub(K.model.pos).setY(0).normalize(), at = v.center.clone().addScaledVector(side, 3.5);
        P.teleport(at.setY(v.center.y + 0.05), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0);
        const hand = P.pos.clone().add(V(0, 1.4, 0)); H.fanG.gust(hand, v.center.clone().sub(hand).normalize()); }
      fan(v);
      hoverOver(v);
      if (!P.hovering) hoverOver(v);
    }
    K.hit('mouth', 'shoot');
    for (let i = 0; i < 1 / DT && !P.onGround; i++) frame();
    fan(null);
  }
  assert.equal(K.state, 'resolved', `broken (${K.meter})`);
  land();
  assert.equal(game.flag('temple.incal.done'), true);
  // ---- the world changed: the shaft's breath carries you from the bottom terrace to the rim
  const Cg = rt.change;
  wait(4);
  P.opts.health = true;
  P.teleport(Cg.foot.clone().add(V(0, 1, 0)), V(0, 1, 0), V(0, 0, 1));
  let rimmed = false;
  for (let i = 0; i < 70 / DT; i++) { frame(); if (P.onGround && P.pos.y > 199 && Math.hypot(P.pos.x, P.pos.z) > 261) { rimmed = true; break; } }
  assert.ok(rimmed, 'carried up the shaft and set down on the rim');
  game.reset();
  own();
});

test('the Warden’s Well: the crown’s doorway down the Flue is the fast way back from the top, unhurt; the valve lets you out into the Bellows Chamber; the plinth’s line says where to let the house breathe out while it breathes in', () => {
  const H = house(), { rt, P, L, walk, path, wait, where, said, ly, land, hearts, notes } = H;
  own('backpack', 'gun', 'hook');   // (no wings: they would open by themselves on a fall this long)
  wait(0.5);
  // the crown's landing in the Flue, under its doorway: step off it
  P.teleport(L(FLUE.x + FLUE.landing.x0 + 2.5, GK + 0.1, C3), V(0, 1, 0), V(0, 0, 1));
  wait(0.4);
  assert.ok(P.onGround && Math.abs(ly() - (GK - 0.3)) < 0.6, `on the crown's landing in the Flue (${where()})`);
  const h = hearts();
  for (let i = 0; i < 3 / DT && ly() > GK - 2; i++) H.frame({ KeyW: true }, H.toward(L(FLUE.x, GK, C3)));
  let vmin = 0, caught = false; const sf = rt.pieces.find((p) => p.zones);
  for (let i = 0; i < 12 / DT && !P.onGround; i++) { H.frame({}, 0); vmin = Math.min(vmin, P.vel.y); caught ||= !!sf?.on; }
  assert.ok(caught && vmin < -30, `a fall at ${-vmin.toFixed(0)} m/s, caught over its last metres`);
  wait(0.3);
  assert.ok(Math.abs(ly() - FLUE.foot) < 0.6, `down the Flue, ${(GK - FLUE.foot).toFixed(0)} m, to its foot (${where()})`);
  assert.ok(hearts() === h && said(/Flue’s breath/), `unhurt: its breath breaks the fall (${h} → ${hearts()}, ${notes.slice(-3).join(' | ')})`);
  assert.equal(path([FLUE.x + FLUE.r - 3, FLUE.foot, C3], [-14, FLUE.foot, C3], [-6, FLUE.foot, C3]), true, `through the valve (${where()})`);
  // the chest taken while the house breathes in: where to let it breathe out, said
  items.grant('fan'); game.emit('box:opened', { id: 'incal.temple.jetpack' });
  rt.logic.takeGadget();
  wait(1.6);
  assert.ok(notes.includes(BREATHE_OUT) && !notes.includes(BELLOWS_NEXT), `breathing in: the lever by the hub said (${notes.at(-1)})`);
  rt.breath.set(true);
  wait(1.6);
  assert.ok(notes.includes(BELLOWS_NEXT), 'breathing out: the draught said');
  game.reset();
  own();
});
