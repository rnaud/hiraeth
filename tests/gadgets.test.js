import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GADGETS, registerGadget, checkGadget, nextGadget, wheelSlot, gadgetById } from '../src/gadgets/registry.js';
import hook, { HOOK, reelTarget, reelVelocity, inReach } from '../src/gadgets/hook.js';
import bomb, { BOMB, refillPouch } from '../src/gadgets/bomb.js';
import { assistPick, throwVelocity, arcPoints, bounce, blastFalloff, blastDamage, blast, traceAim } from '../src/gadgets/kit.js';
import { GadgetWorld, Prop, stepProp } from '../src/gadgets/world.js';
import { Gadgets, gadgetInput, WHEEL_HOLD, EQUIPPED_FLAG } from '../src/gadgets/index.js';
import { pips } from '../src/gadgets/hud.js';
import { ITEMS, items } from '../src/items.js';
import { buildItemModel } from '../src/boxes/model.js';
import { Physics } from '../src/physics.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { Controller } from '../src/controller.js';
import { itemsData } from '../src/game-menu-data.js';

registerGadget(hook);
registerGadget(bomb);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const DT = 1 / 60;

/** A world of one ground plane (and whatever else is given) with real collision. */
function physicsOf(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return new Physics(scene);
}
function player(at = v()) {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) };
  return { pos: at, vel: v(), heading: 0, frame, object: { visible: true }, ride: null, onGround: true, opts: { climb: true }, stamina: 1, wallN: v(), aim: null, climbing: false,
    mantles: 0, climbs: 0, tryMantle() { this.mantles++; return this.canMantle ?? false; }, startClimb(n) { this.climbs++; this.climbN = n.clone(); this.climbing = true; }, endJets() {} };
}

// ------------------------------------------------------------------ the registry

test('every module in src/gadgets with a default export is a whole gadget, and becomes an item with a model', () => {
  const dir = new URL('../src/gadgets/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'all.js');
  let n = 0;
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    if (!/export default/.test(src)) continue;
    n++;
    assert.match(src, /create\(ctx\)/, `${f}: create(ctx)`);
  }
  assert.ok(n >= 2, `${n} gadget modules`);
  for (const g of GADGETS) {
    assert.deepEqual(checkGadget({ ...g, id: g.id }).filter((e) => !e.includes('already')), [], g.id);
    assert.equal(ITEMS[g.id].kind, 'gadget', `${g.id} is an item`);
    assert.ok(/RT \/ R2|LT \/ L2|\{key:fire\}/.test(ITEMS[g.id].use), `${g.id}: its use says the pad's trigger in Xbox / PlayStation form (or the player's own)`);
    assert.ok(['aim', 'use', 'look', 'tool'].includes(g.trigger), `${g.id}: how it takes the triggers (${g.trigger})`);
    const m = buildItemModel(g.id);
    assert.ok(m.children.length >= 2, `${g.id} has a model of its own (not the gem)`);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(v());
    assert.ok(Math.max(size.x, size.y, size.z) < 0.6, `${g.id}'s model is item-sized`);
  }
  // all.js finds them by their default export (Vite's import.meta.glob), nothing keeps a list
  assert.match(readFileSync(new URL('all.js', dir), 'utf8'), /import\.meta\.glob\(\['\.\/\*\.js', '!\.\/all\.js'\], \{ eager: true \}\)/);
});

test('a bad gadget is refused; registering keeps the order and replaces an id given again', () => {
  assert.ok(checkGadget({ id: 'Hook!', name: 'x' }).length >= 3);
  assert.ok(checkGadget({ id: 'backpack', name: 'x', text: 'x', use: 'x', model: () => null, create: () => ({}) }).some((e) => e.includes('already an item')));
  assert.throws(() => registerGadget({ id: 'nope' }));
  assert.deepEqual(GADGETS.map((g) => g.id).slice(0, 2), ['hook', 'bomb']);
  registerGadget({ ...hook });
  assert.equal(GADGETS.filter((g) => g.id === 'hook').length, 1);
  assert.equal(gadgetById('bomb').name, 'Ink bombs');
});

test('choosing: the round goes through nothing in hand, and the wheel reads the stick clockwise from the top', () => {
  const owned = ['hook', 'bomb'];
  assert.equal(nextGadget(owned, null, 1), 'hook');
  assert.equal(nextGadget(owned, 'hook', 1), 'bomb');
  assert.equal(nextGadget(owned, 'bomb', 1), null);
  assert.equal(nextGadget(owned, null, -1), 'bomb');
  assert.equal(nextGadget(owned, 'bomb', 1, { none: false }), 'hook');
  assert.equal(nextGadget([], null, 1), null);
  assert.equal(wheelSlot(0, 0, 3), -1, 'resting stick: nothing');
  assert.equal(wheelSlot(0, 1, 3), 0, 'up');
  assert.equal(wheelSlot(1, -0.6, 3), 1, 'right and down');
  assert.equal(wheelSlot(-1, -0.6, 3), 2, 'left and down');
  assert.equal(wheelSlot(1, 0, 4), 1);
  assert.equal(pips(2, 3), '●●○');
});

test('the pad: LT / L2 aims and RT / R2 uses the gadget in hand, Y / △ whistles, D-pad ↑ chooses, → its mode; the keyboard R, T / G and B, the mouse, touch', () => {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = [];
  const c = new Controller({ pads: () => [pad], context: () => 'game', action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {} });
  pad.buttons[3] = { pressed: true, value: 1 };
  assert.equal(c.update(DT).PadWhistle, true, 'Y held: the whistle');
  pad.buttons[3] = { pressed: false, value: 0 }; pad.buttons[12] = { pressed: true, value: 1 };
  const h = c.update(DT);
  assert.equal(h.PadWhistle, false); assert.equal(h.PadGadgetPick, true, 'D-pad up held');
  pad.buttons[12] = { pressed: false, value: 0 }; pad.buttons[6] = { pressed: true, value: 1 }; pad.buttons[7] = { pressed: true, value: 1 }; pad.buttons[15] = { pressed: true, value: 1 };
  const t = c.update(DT);
  assert.ok(t.PadAim && t.PadFire && t.PadModeNext, 'LT, RT and D-pad →');
  assert.deepEqual(actions, [], 'none of them pings or calls (src/bindings.js)');
  const none = { aim: false, use: false, pick: false, back: false, mode: false, whistle: false, touch: false };
  assert.deepEqual(gadgetInput({ KeyT: true }), { ...none, use: true });
  assert.deepEqual(gadgetInput({ PadFire: true }), { ...none, use: true }, 'RT');
  assert.deepEqual(gadgetInput({ PadAim: true }), { ...none, aim: true }, 'LT');
  assert.deepEqual(gadgetInput({ MouseRight: true, MouseLeft: true }), { ...none, aim: true, use: true }, 'a left click uses it only while aiming');
  assert.equal(gadgetInput({ MouseLeft: true }).use, false, 'else it swings the sword');
  assert.equal(gadgetInput({ MouseMiddle: true }).use, true);
  assert.equal(gadgetInput({ KeyG: true }).use, true);
  assert.equal(gadgetInput({ TouchFire: true }).use, true);
  assert.deepEqual(gadgetInput({ TouchGadget: true }), { ...none, use: true, touch: true });
  assert.deepEqual(gadgetInput({ PadWhistle: true }), { ...none, whistle: true });
  assert.deepEqual(gadgetInput({ PadModeNext: true }), { ...none, mode: true });
  assert.deepEqual(gadgetInput({ KeyB: true, ShiftLeft: true }), { ...none, pick: true, back: true });
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /ring: \(\) => itemFx\.ring\(\)/, 'with nothing in hand the use button sounds the whistle (V)');
  assert.ok(main.indexOf('gadgets.control(') < main.indexOf('player.update(pdt, busy() ? noInput : ctl'), 'the reel acts before the traveller moves');
  assert.ok(main.indexOf('tool.update(dt, ctl') < main.indexOf('gadgets.update('), 'the gadgets aim after the fluid tool');
});

// ------------------------------------------------------------------ the runtime

function runtime({ owned = ['hook', 'bomb'], defs = null } = {}) {
  const game = new GameState(null);
  const listeners = new Set();
  const its = { has: (id) => !!game.flag(`item.${id}`), grant(id) { game.set(`item.${id}`, true); for (const f of listeners) f(id, true); }, on(f) { listeners.add(f); return () => listeners.delete(f); } };
  const log = [];
  const spy = (id) => ({ create: () => ({ press: () => log.push(`${id} press`), hold: () => log.push(`${id} hold`), release: () => log.push(`${id} release`), cancel: () => log.push(`${id} cancel`), equip: () => log.push(`${id} equip`), unequip: () => log.push(`${id} unequip`) }), id, name: id, text: '', use: '', model: () => new THREE.Group() });
  const G = new Gadgets({ defs: defs ?? [spy('hook'), spy('bomb')], scene: new THREE.Scene(), physics: physicsOf(), player: player(), game, items: its });
  for (const id of owned) its.grant(id);
  return { G, game, its, log };
}

test('one job per button: D-pad ↑ takes the next gadget aiming or not, and its wheel holds the gadgets only', () => {
  const { G } = runtime();
  assert.equal(G.equipped, 'hook');
  G.control(DT, { PadGadgetPick: true, PadAim: true }); G.control(DT, { PadAim: true });
  assert.equal(G.equipped, 'bomb', 'aiming (LT): the tap is still the next gadget');
  for (let t = 0; t < WHEEL_HOLD + 0.05; t += DT) G.control(DT, { PadGadgetPick: true });
  assert.ok(G.wheelOn);
  assert.deepEqual(G.wheelList().map((l) => l.id), ['hook', 'bomb'], 'the gadgets only (the whistle has Y / △), no modes');
  G.control(DT, {});
});

test('the runtime: the first gadget found is taken in hand; the use button presses, holds and lets go; a tap of choose takes the next', () => {
  const { G, game, log } = runtime();
  assert.equal(G.equipped, 'hook', 'the first found is in hand');
  assert.equal(game.flag(EQUIPPED_FLAG), 'hook', 'kept in the save');
  log.length = 0;
  G.control(DT, { KeyT: true }); G.control(DT, { KeyT: true }); G.control(DT, {});
  assert.deepEqual(log, ['hook press', 'hook hold', 'hook release']);
  G.control(DT, { KeyB: true }); G.control(DT, {});
  assert.equal(G.equipped, 'bomb', 'a tap: the next');
  G.control(DT, { KeyB: true }); G.control(DT, {});
  assert.equal(G.equipped, 'hook', 'then round again (nothing in hand is no stop: the whistle has its own button)');
  // held: the wheel; the stick points at a slot, letting go takes it
  for (let t = 0; t < WHEEL_HOLD + 0.05; t += DT) G.control(DT, { KeyB: true });
  assert.ok(G.wheelOn, 'the wheel is open');
  const input = { KeyB: true, stick: { x: 1, y: -0.6 } };
  G.control(DT, input);
  assert.equal(input.stick, null, 'the stick chooses: the traveller does not walk');
  G.control(DT, {});
  assert.ok(!G.wheelOn);
  assert.equal(G.equipped, 'bomb', 'the slot down (hook at the top, bomb under it)');
  // a menu opening lets go of everything
  log.length = 0;
  G.control(DT, { KeyT: true }, true);
  assert.deepEqual(log, ['hook cancel', 'bomb cancel']);
});

test('the triggers by the gadget: an aiming one takes aim on LT, lets fly on RT, puts an unused aim away; RT alone is a quick use; Y whistles; → its mode', () => {
  const game = new GameState(null);
  const listeners = new Set();
  const its = { has: (id) => !!game.flag(`item.${id}`), grant(id) { game.set(`item.${id}`, true); for (const f of listeners) f(id, true); }, on(f) { listeners.add(f); return () => listeners.delete(f); } };
  const log = [];
  const spy = (id, trigger, extra = {}) => ({ id, name: id, text: '', use: '', trigger, model: () => new THREE.Group(),
    create: () => ({ press: () => log.push(`${id} press`), hold: () => log.push(`${id} hold`), release: () => log.push(`${id} release`), lower: () => log.push(`${id} lower`), cancel() {}, equip() {}, unequip() {}, ...extra }) });
  let rang = 0;
  const G = new Gadgets({ defs: [spy('thrower', 'aim'), spy('fan', 'use'), spy('glass', 'look'), spy('gun', 'tool'), spy('dial', 'use', { modes: ['a', 'b'], cycleMode: () => { log.push('dial mode'); return true; } })], scene: new THREE.Scene(), physics: physicsOf(), player: player(), game, items: its, ring: () => rang++ });
  for (const id of ['thrower', 'fan', 'glass', 'gun', 'dial']) its.grant(id);
  assert.equal(G.equipped, 'thrower');
  const run = (...frames) => { log.length = 0; for (const f of frames) G.control(DT, f); return log.slice(); };
  assert.deepEqual(run({ PadAim: true }, { PadAim: true }, { PadAim: true, PadFire: true }, { PadAim: true }, {}), ['thrower press', 'thrower hold', 'thrower hold', 'thrower release'], 'LT aims, RT lets fly');
  assert.deepEqual(run({ PadAim: true }, { PadAim: true }, {}), ['thrower press', 'thrower hold', 'thrower lower'], 'LT let go: put away unused');
  assert.deepEqual(run({ PadFire: true }, {}), ['thrower press', 'thrower release'], 'RT alone: at once');
  run({ PadWhistle: true }, {});
  assert.equal(rang, 1, 'Y: the whistle, whatever is in hand');
  G.equip('fan');
  assert.deepEqual(run({ PadFire: true }, { PadFire: true }, {}), ['fan press', 'fan hold', 'fan release'], 'held on RT');
  assert.deepEqual(run({ PadAim: true }, {}), [], 'LT does nothing to it');
  G.equip('glass');
  assert.deepEqual(run({ PadAim: true }, { PadAim: true }, {}), ['glass press', 'glass hold', 'glass release'], 'the lens on either trigger');
  G.equip('gun');
  assert.deepEqual(run({ PadAim: true }, { PadAim: true, PadFire: true }, {}), [], 'the gun: the fluid tool reads them');
  G.equip('dial');
  assert.deepEqual(run({ PadModeNext: true }, { PadModeNext: true }, {}), ['dial mode'], '→: its next mode, once a press');
  G.equip('fan');
  const said = [];
  G.ctx.notice = (t) => said.push(t);
  run({ KeyX: true }, {});
  assert.match(said[0] ?? '', /no modes/, 'one without modes says so');
});

test('the menu shows a gadget in hand, and lets you take another', () => {
  const d = itemsData({ owned: ['backpack', 'hook', 'bomb'], gadget: 'hook', gadgets: ['hook', 'bomb'] });
  const h = d.gear.find((x) => x.id === 'hook'), b = d.gear.find((x) => x.id === 'bomb');
  assert.ok(h.inUse && !h.usable); assert.ok(b.usable && !b.inUse);
  assert.equal(d.gear[0].id, 'backpack');
});

// ------------------------------------------------------------------ the grappling hook

test('the hook: where it reels you to on a floor, a wall and under a ledge; the reel slows over the last metres', () => {
  const floor = reelTarget(v(0, 5, 0), v(0, 1, 0));
  assert.ok(Math.abs(floor.y - 5.05) < 1e-6 && floor.x === 0, 'a floor: on it');
  const wall = reelTarget(v(0, 7, -10), v(0, 0, 1));
  assert.ok(Math.abs(wall.z - (-10 + HOOK.stand)) < 1e-6, 'a wall: out from it');
  assert.ok(Math.abs(wall.y - (7 - HOOK.hang)) < 1e-6, '…and a hand\'s reach below the hook');
  const ceil = reelTarget(v(0, 7, 0), v(0, -1, 0));
  assert.ok(ceil.y < wall.y - 0.5, 'under a ceiling: hanging lower');
  const far = reelVelocity(v(), v(0, 0, -20));
  assert.ok(Math.abs(far.length() - HOOK.pull) < 1e-6 && far.z < 0, 'full speed far off, toward it');
  const near = reelVelocity(v(), v(0, 0, -1));
  assert.ok(near.length() < HOOK.pull * 0.5 && near.length() >= 3, 'slower near');
  assert.equal(reelVelocity(v(1, 1, 1), v(1, 1, 1)).length(), 0);
  assert.ok(inReach(25) && !inReach(25.5) && !inReach(0.3) && !inReach(NaN));
});

test('the aim assist finds a ring near the line, nearest the line first, never behind or past reach', () => {
  const rings = [{ pos: v(0.5, 0, -10) }, { pos: v(0.1, 0, -20) }, { pos: v(0, 0, 10) }, { pos: v(0, 0, -40) }];
  const a = assistPick(v(), v(0, 0, -1), rings, { range: 25, cone: 0.07 });
  assert.equal(a.item, rings[1], 'the one closest to the line (by angle)');
  assert.equal(assistPick(v(), v(1, 0, 0), rings, { range: 25 }), null, 'none near the line');
  assert.equal(assistPick(v(), v(0, 0, -1), [rings[3]], { range: 25 }), null, 'past reach');
  // through the world: a wall between the eye and a ring hides it
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.5).translate(0, 1, -6), new THREE.MeshBasicMaterial());
  const ph = physicsOf(wall);
  const seen = traceAim(ph, v(0, 1, 0), v(0, 0, -1), 25, { anchors: [{ pos: v(0.3, 1, -10) }] });
  assert.equal(seen.kind, 'world', 'the wall, not the ring behind it');
  const clear = traceAim(ph, v(0, 1, 0), v(0, 0, -1), 25, { anchors: [{ pos: v(0.3, 1, -4) }] });
  assert.equal(clear.kind, 'anchor');
});

function hookCtx(P, physics, extra = {}) {
  return { player: P, physics, camera: null, tool: null, sound: null, world: null, hud: { reticle() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {}, ...extra };
}

test('the hook reels the traveller in along the line, and at a wall he takes hold (or hauls over its top)', () => {
  const P = player(v(0, 0, 0)), H = hook.create(hookCtx(P, physicsOf()));
  H.fire({ kind: 'world', ok: true, point: v(0, 6, -12), normal: v(0, 0, 1), reach: 13 });
  assert.equal(H.state, 'out');
  for (let i = 0; i < 30 && H.state === 'out'; i++) H.update(DT);
  assert.equal(H.state, 'pull', 'it bit');
  let t = 0;
  while (H.state === 'pull' && t < 3) {
    H.control(DT, {});
    if (H.state !== 'pull') break;
    assert.ok(Math.abs(P.vel.length() - Math.min(HOOK.pull, Math.max(3, P.pos.distanceTo(H.goal) * HOOK.ease))) < 1, 'at the reel\'s speed');
    P.pos.addScaledVector(P.vel, DT); P.vel.y -= 32 * DT;   // (his own step: gravity, which the reel gives back)
    H.update(DT); t += DT;
  }
  assert.ok(t < 1.4, `there in ${t.toFixed(2)} s`);
  assert.ok(P.pos.distanceTo(v(0, 6 - HOOK.hang, -12 + HOOK.stand)) < 1, 'below the hook, out from the wall');
  assert.equal(P.mantles, 1, 'tried to haul over the top first');
  assert.equal(P.climbs, 1, 'then took hold of the wall');
  assert.ok(P.climbN.z > 0.9, 'facing it');
});

test('jump while reeling lets go with the reel\'s speed; caught on nothing the hook comes back', () => {
  const P = player(v(0, 0, 0)), H = hook.create(hookCtx(P, physicsOf()));
  H.fire({ kind: 'anchor', ok: true, point: v(0, 10, -20), normal: v(0, 1, 0), reach: 22 });
  while (H.state === 'out') H.update(DT);
  H.control(DT, {}); H.control(DT, {});
  H.control(DT, { Space: true });
  assert.equal(H.state, 'back');
  assert.ok(P.vel.z < -HOOK.pull * HOOK.fling * 0.8 && P.vel.y > 6, 'flung on and up');
  const Q = player(v()), M = hook.create(hookCtx(Q, physicsOf()));
  M.fire({ kind: 'none', ok: false, point: v(0, 2, -100), normal: v(0, 0, 1), reach: 100 });
  let t = 0;
  while (M.state !== 'idle' && t < 2) { M.update(DT); t += DT; }
  assert.equal(M.state, 'idle', 'back in hand');
  assert.ok(t > (HOOK.range / HOOK.fly) && t < 1, `out to its reach and back in ${t.toFixed(2)} s`);
  assert.equal(Q.pos.length(), 0, 'the traveller never moved');
});

test('the hook drags a loose crate to you, and stuns a foe it pulls in', () => {
  clearTargets();
  const ph = physicsOf();
  const P = player(v(0, 0, 0));
  const crate = new Prop({ object: Object.assign(new THREE.Group(), {}), r: 0.5, h: 0.45 });
  crate.pos.set(0, 0.45, -15);
  const H = hook.create(hookCtx(P, ph));
  H.fire({ kind: 'target', ok: true, target: { kind: 'prop', prop: crate, position: () => crate.pos }, point: crate.pos.clone(), normal: v(0, 0, 1), reach: 15 });
  for (let i = 0; i < 400 && H.state !== 'back' && H.state !== 'idle'; i++) { H.update(DT); stepProp(crate, DT, ph); }
  assert.ok(Math.hypot(crate.pos.x, crate.pos.z) < HOOK.dragTo + 0.6, `at your feet: ${crate.pos.toArray().map((x) => x.toFixed(1))}`);
  assert.equal(crate.held, null, 'let go');
  const foe = { kind: 'foe', foe: { alive: true, pos: v(0, 0, -10), vel: v(), stunned: 0, flash: 0, def: { height: 0.5 } } };
  const F = hook.create(hookCtx(player(v()), ph));
  F.fire({ kind: 'target', ok: true, target: foe, point: v(0, 0.5, -10), normal: v(0, 0, 1), reach: 10 });
  while (F.state === 'out') F.update(DT);
  assert.equal(F.state, 'drag');
  F.update(DT);
  assert.ok(foe.foe.stunned > 0 && foe.foe.vel.z > 0, 'held, coming toward you');
});

// ------------------------------------------------------------------ ink bombs

test('a throw goes along the aim tipped up, and its arc lands where the maths says', () => {
  const vel = throwVelocity(v(0, 0, -1), UP, BOMB.speed, BOMB.lift);
  assert.ok(Math.abs(vel.length() - BOMB.speed) < 1e-6);
  assert.ok(Math.abs(Math.atan2(vel.y, -vel.z) - BOMB.lift) < 1e-6, 'tipped up by the lift');
  const steep = throwVelocity(v(0, 0.8, -0.6).normalize(), UP, 10, 0.32);
  assert.ok(Math.atan2(steep.y, Math.hypot(steep.x, steep.z)) <= 1.35 + 1e-6, 'never past straight up');
  // from 1.5 m over a flat floor: the analytic range of the arc, against arcPoints with a floor
  const from = v(0, 1.5, 0), g = BOMB.gravity;
  const arc = arcPoints(from, vel, UP, g, { step: 0.02, n: 400, hit: (a, b) => (b.y <= 0 ? a.clone().lerp(b, a.y / (a.y - b.y)) : null) });
  const vy = vel.y, vz = -vel.z, tFlight = (vy + Math.sqrt(vy * vy + 2 * g * 1.5)) / g;
  assert.ok(arc.landed);
  assert.ok(Math.abs(-arc.end.z - vz * tFlight) < 0.15, `lands ${(-arc.end.z).toFixed(2)} m out (${(vz * tFlight).toFixed(2)})`);
});

test('a bomb bounces lower each time, the blast is felt less with distance and nothing past its edge', () => {
  const b = bounce(v(3, -10, 0), v(0, 1, 0), 0.4, 0.7);
  assert.ok(Math.abs(b.y - 4) < 1e-9 && Math.abs(b.x - 2.1) < 1e-9);
  assert.equal(blastFalloff(0, 4.5), 1);
  assert.equal(blastFalloff(4.5, 4.5), 0);
  assert.equal(blastFalloff(9, 4.5), 0);
  let last = 2;
  for (let d = 0; d <= 4.5; d += 0.25) { const k = blastFalloff(d, 4.5); assert.ok(k <= last && k >= 0); last = k; }
  assert.ok(blastFalloff(2.25, 4.5) > 0.5, 'half way out it is still most of a blow');
  assert.equal(blastDamage(1), 2); assert.equal(blastDamage(0.05), 1); assert.equal(blastDamage(0), 0);
  const p = refillPouch(1, 0, BOMB.refill * 1.5);
  assert.deepEqual([p.count, +p.t.toFixed(3)], [2, +(BOMB.refill * 0.5).toFixed(3)]);
  assert.deepEqual(refillPouch(3, 2, 10), { count: 3, t: 0 });
});

test('a blast cuts and throws a foe, throws a crate, breaks a cracked wall in reach, throws the traveller and leaves what is far alone', () => {
  clearTargets();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.6), new THREE.MeshBasicMaterial());
  wall.position.set(2, 1.5, 0);
  const ph = physicsOf();
  const P = player(v(0, 0, 3));
  const world = new GadgetWorld({ physics: ph, player: P, spec: { breakables: [{ object: wall, center: v(2, 1.5, 0), radius: 1.5, regrow: 5 }], props: [] } });
  assert.ok(ph.rayDistance(v(2, 1.5, 3), v(0, 0, -1), 10) < 3.1, 'the cracked wall is solid');
  const box = new THREE.Group(); box.position.set(-2, 0.45, 0);
  const crate = world.addProp({ object: box, r: 0.55, h: 0.45 });
  const hits = [];
  const foe = { alive: true, kind: 'blot', vel: v(), pos: v(0, 0, -2) };
  registerTarget({ kind: 'foe', foe, radius: 0.6, position: () => v(0, 0.6, -2), onHit: (mode, point, dir, info) => hits.push({ mode, dir, info }) });
  const farHits = [];
  registerTarget({ kind: 'wildlife', radius: 0.3, position: () => v(30, 0, 0), onHit: () => farHits.push(1) });
  const res = blast({ physics: ph, player: P, world }, v(0, 0.3, 0), { radius: BOMB.radius, damage: BOMB.damage });
  assert.equal(res.foes, 1); assert.equal(hits[0].mode, 'blade'); assert.ok(hits[0].info.damage >= 2, 'close in: a heavy cut (an ink blot is gone)');
  assert.ok(foe.vel.z < -3, 'thrown away from the blast');
  assert.ok(crate.vel.x < -2 && crate.vel.y > 0, 'the crate is thrown up and away');
  assert.equal(res.broken, 1); assert.equal(wall.visible, false);
  assert.ok(ph.rayDistance(v(2, 1.5, 3), v(0, 0, -1), 10) > 5, 'and no longer stands in the way');
  assert.ok(P.vel.z > 1 && P.vel.y > 1 && !P.onGround, 'the traveller is thrown back, not hurt');
  assert.equal(farHits.length, 0);
  for (let t = 0; t < 6; t += 0.1) world.update(0.1);
  assert.equal(wall.visible, true, 'in the yard a broken wall grows back');
  clearTargets();
});

test('a loose crate falls, lands, slides to a stop; walked into, it is pushed along', () => {
  const ph = physicsOf();
  const p = new Prop({ object: new THREE.Group(), r: 0.5, h: 0.45 });
  p.pos.set(0, 3, 0); p.vel.set(4, 0, 0);
  for (let t = 0; t < 3; t += DT) stepProp(p, DT, ph);
  assert.ok(Math.abs(p.pos.y - 0.45) < 0.02, 'on the ground');
  assert.ok(p.resting && p.pos.x > 0.5 && p.pos.x < 6, `slid and stopped at ${p.pos.x.toFixed(2)}`);
  const P = player(v(0, 0, 0)); P._moveDir = v(0, 0, -1);
  const W = new GadgetWorld({ physics: ph, player: P, spec: null });
  const c = W.addProp({ object: new THREE.Group(), r: 0.5, h: 0.45 });
  c.pos.set(0, 0.45, -0.9);
  W.update(DT);
  assert.ok(c.vel.z < -1, 'pushed along the way you walk');
});

test('a thrown bomb flies, bounces, fizzes and goes off after its fuse; another in its blast goes off just after', () => {
  clearTargets();
  const ph = physicsOf();
  const P = player(v(0, 0, 10));
  const blasts = [];
  const ctx = hookCtx(P, ph, { world: new GadgetWorld({ physics: ph, player: P }), bursts: { add: (at) => blasts.push(at.clone()) }, game: { emit() {} } });
  const B = bomb.create(ctx);
  const a = B.spawn(v(0, 1.5, 0), v(0, 2, -8));
  const second = B.spawn(v(1, 0.2, -8), v(), 9);
  let t = 0, bounced = false, lowest = 9;
  while (B.live.length && t < 4) { B.update(DT); t += DT; if (a.vel.y > 0.5 && a.pos.y < 0.5) bounced = true; lowest = Math.min(lowest, a.pos.y); }
  assert.ok(bounced, 'it bounced');
  assert.ok(lowest >= BOMB.r - 0.02, 'never through the floor');
  assert.equal(blasts.length, 2, `both went off (the first at ${blasts[0]?.toArray().map((x) => x.toFixed(1))}, the second at ${second.pos.toArray().map((x) => x.toFixed(1))})`);
  assert.ok(t < BOMB.fuse + BOMB.chain + 0.2, `the second just after the first (${t.toFixed(2)} s)`);
  // the pouch: three, one used per throw, one back every few seconds
  assert.equal(B.count, BOMB.max);
});

// ------------------------------------------------------------------ the Gadget Yard

test('the Gadget Yard: a dev world in the list, a bay per gadget with its own props, nothing out where wild packs come', async () => {
  const { LEVELS } = await import('../src/levels/index.js');
  const { bayFrame, YARD } = await import('../src/levels/gadget-yard.js');
  const meta = LEVELS.find((l) => l.id === 'gadgetyard');
  assert.ok(meta && meta.dev && meta.hidden, 'a developer\'s world');
  const scene = new THREE.Scene();
  const warn = console.warn; console.warn = () => {};
  let level;
  try { level = meta.create(scene); } finally { console.warn = warn; }
  assert.equal(level.gadgets, 'all', 'every gadget is granted there');
  const Y = level.gadgetYard;
  assert.ok(Y.anchors.length >= 4, 'rings for the hook');
  assert.ok(Y.breakables.length >= 3, 'cracked walls for the bombs');
  assert.ok(Y.props.some((p) => p.metal) && Y.props.some((p) => p.light), 'crates and metal crates');
  assert.ok(Y.plates.length >= 1 && Y.gates.length >= 1 && level.targets.length >= 3, 'a plate and its gate, targets');
  assert.ok(Y.pen && Y.pen.count >= 1, 'a pen of foes');
  // every bay on the ring, inside the yard; the yard's edge never far enough from the spawn for a wild pack
  for (let i = 0; i < YARD.bays; i++) assert.ok(bayFrame(i).origin.length() < YARD.radius - 8);
  assert.equal(level.foes.wild, false, 'no wild packs, only the pen');
  const F = new (await import('../src/foes.js')).Foes({ scene: new THREE.Scene(), level, levelId: 'gadgetyard', physics: { groundAt: () => 0 }, player: player(v(0, 0, 45)), settings: { enemies: true }, game: new GameState(null) });
  assert.equal(F.wild(v(0, 0, 160)), false);
  assert.ok(Math.hypot(level.shipSite.x, level.shipSite.z) > YARD.radius + 18, 'the ship stands outside the wall');
  // what moves or breaks is kept out of the baked collision (it brings its own)
  for (const p of Y.props) p.object.traverse((m) => { if (m.isMesh) assert.ok(m.userData.noCollide); });
  for (const b of Y.breakables) b.object.traverse((m) => { if (m.isMesh) assert.ok(m.userData.noCollide); });
});
