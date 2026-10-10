import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { registerGadget } from '../src/gadgets/registry.js';
import hook from '../src/gadgets/hook.js';
import bomb from '../src/gadgets/bomb.js';
import boomerang from '../src/gadgets/boomerang.js';
import magnet, { MAG, holdPoint, followVelocity, reachAfter, pickMetal, FieldLines } from '../src/gadgets/magnet.js';
import { tagMetal, metalSpots, isMetal } from '../src/gadgets/metal.js';
import { GadgetWorld } from '../src/gadgets/world.js';
import { Physics } from '../src/physics.js';
import { clearTargets } from '../src/targets.js';
import { ITEMS } from '../src/items.js';

for (const g of [hook, bomb, boomerang, magnet]) registerGadget(g);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

function sceneOf(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return scene;
}
function player(at = v()) {
  const frame = { up: v(0, 1, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) };
  return { pos: at, vel: v(), heading: 0, frame, object: { visible: true }, ride: null, onGround: true, opts: { climb: true }, stamina: 1, wallN: v(), aim: null, climbing: false,
    mantles: 0, climbs: 0, tryMantle() { this.mantles++; return false; }, startClimb() { this.climbs++; this.climbing = true; }, endJets() {} };
}
function cameraAt(eye, look) {
  const c = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  c.position.copy(eye); c.lookAt(look); c.updateMatrixWorld(true);
  return c;
}
function ctxOf({ scene = sceneOf(), P = player(), camera, world = null, foes = null, ...extra }) {
  const physics = new Physics(scene);
  physics.groundAt = physics.groundAt.bind(physics);
  const ctx = { scene, player: P, physics, camera, tool: null, sound: null, world, foes, level: null, hud: { reticle() {}, marks() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {}, ...extra };
  return ctx;
}
const crateMesh = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())); return g; };

test('the glove is a gadget; where a held thing is wanted, how it follows, how the stick moves it', () => {
  assert.equal(ITEMS.magnet.kind, 'gadget');
  assert.ok(ITEMS.magnet.use.includes('RT / R2'));
  const p = holdPoint(v(0, 1.5, 0), v(0, 0, -1), 6);
  assert.deepEqual(p.toArray(), [0, 1.5, -6]);
  const low = holdPoint(v(0, 1.5, 0), v(0, -0.8, -0.6).normalize(), 8, 0.5);
  assert.equal(low.y, 0.5, 'never pushed under the ground');
  const fv = followVelocity(v(), v(0, 0, -0.5));
  assert.ok(Math.abs(fv.length() - 0.5 * MAG.follow) < 1e-9, 'near: in proportion');
  assert.ok(Math.abs(followVelocity(v(), v(0, 0, -50)).length() - MAG.maxSpeed) < 1e-9, 'far: at its top speed');
  assert.equal(reachAfter(5, 1, 1), Math.min(MAG.max, 5 + MAG.reach));
  assert.equal(reachAfter(3, -1, 1), MAG.min, 'never nearer than its least');
});

test('the aim picks the metal it lands on first, else the nearest the line; nothing out of reach', () => {
  const a = { r: 0.6, pos: () => v(0, 1, -6) }, b = { r: 0.6, pos: () => v(0.5, 1, -10) }, far = { r: 0.6, pos: () => v(0, 1, -40) };
  assert.equal(pickMetal(v(0, 1, 0), v(0, 0, -1), [a, b, far], { aimHit: v(0.5, 1, -9.5) }).item, b, 'the aim landed on b');
  const assisted = pickMetal(v(0, 1, 0), v(0.03, 0, -1).normalize(), [b, far]);
  assert.equal(assisted.item, b); assert.equal(assisted.direct, false);
  assert.equal(pickMetal(v(0, 1, 0), v(0, 0, -1), [far]), null, `past ${MAG.range} m`);
});

test('metal is tagged where it is built: a block\'s middle, or spots of its own', () => {
  const block = tagMetal(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial()));
  block.position.set(5, 3, 0);
  const pumps = tagMetal(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()), { points: [[1, 0, 0], [0, 0, 4]], radius: 0.8 });
  pumps.position.set(0, 0, -10);
  const scene = sceneOf(block, pumps);
  assert.ok(isMetal(block) && !isMetal(scene.children[0]));
  const spots = metalSpots(scene, { metal: [{ pos: [9, 9, 9] }] });
  assert.equal(spots.length, 4);
  assert.ok(spots[0].pos.distanceTo(v(5, 3, 0)) < 1e-6 && Math.abs(spots[0].radius - 1) < 1e-6, 'the block: its middle, a face a metre out');
  assert.deepEqual(spots.slice(1, 3).map((s) => s.pos.toArray()), [[1, 0, -10], [0, 0, -6]]);
  // the Sealed Hangar's brass machinery is tagged
  assert.match(readFileSync(new URL('../src/levels/garage.js', import.meta.url), 'utf8'), /tagMetal\(new THREE\.Mesh\(mergeGeometries\(bits\), brass\), \{ points: pumps/);
});

test('held, a metal crate is lifted and follows the aim; the stick sends it out; let go, it drops', () => {
  clearTargets();
  const scene = sceneOf(), P = player(v(0, 0, 0));
  const camera = cameraAt(v(0, 2.2, 4), v(0, 1, -8));
  const ctx = ctxOf({ scene, P, camera });
  const world = new GadgetWorld({ physics: ctx.physics, player: P });
  ctx.world = world;
  const box = crateMesh(); box.position.set(0, 0.5, -8);
  const crate = world.addProp({ object: box, r: 0.62, h: 0.5, mass: 4, metal: true, light: false });
  const M = magnet.create(ctx);
  M.press(); M.update(DT);
  assert.equal(M.cand?.prop, crate, 'the aim found it');
  for (let t = 0; t < MAG.tap + 0.05; t += DT) { M.hold(DT); M.update(DT); world.update(DT); }
  assert.equal(M.state, 'hold');
  assert.equal(crate.held, M);
  // look up a little: it rises with the aim
  ctx.camera = cameraAt(v(0, 2.2, 4), v(0, 6, -8));
  for (let i = 0; i < 60; i++) { M.control(DT, {}); M.hold(DT); M.update(DT); world.update(DT); }
  assert.ok(crate.pos.y > 2.5, `lifted (${crate.pos.y.toFixed(2)} m)`);
  const before = M.dist;
  let input;
  for (let i = 0; i < 30; i++) { input = { KeyW: true }; M.control(DT, input); M.update(DT); world.update(DT); }   // (a fresh input each frame, as main.js merges it)
  assert.ok(M.dist > before + 2, `the stick forward sends it further (${before.toFixed(1)} → ${M.dist.toFixed(1)}, ${M.state})`);
  assert.equal(input.KeyW, false, 'and the traveller stands meanwhile');
  M.release();
  assert.equal(crate.held, null);
  for (let i = 0; i < 120; i++) { M.update(DT); world.update(DT); }
  assert.ok(Math.abs(crate.pos.y - 0.5) < 0.05, `dropped to the ground (${crate.pos.y.toFixed(2)})`);
  world.dispose(); clearTargets();
});

test('held level, a crate stays where it is held: its own top is not taken for the ground under it', () => {
  clearTargets();
  // a world whose ground query sees the crate's own collider while it is there (as the game's does)
  const marker = { crate: true };
  const physics = { extras: [], addMover: () => marker, groundAt(x, y, z) { return this.extras.includes(marker) && Math.hypot(x - box.position.x, z - box.position.z) < 0.6 ? box.position.y + 0.5 : 0; } };
  const box = crateMesh(); box.position.set(0, 0.5, -8);
  const P = player(v(0, 0, 0));
  const world = new GadgetWorld({ physics, player: P });
  const crate = world.addProp({ object: box, r: 0.62, h: 0.5, mass: 4, metal: true, light: false });
  physics.extras.push(marker);
  const ctx = { scene: new THREE.Scene(), player: P, physics, camera: cameraAt(v(0, 2.2, 4), v(0, 1.4, -8)), world, hud: { reticle() {}, marks() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {} };
  const M = magnet.create(ctx);
  M.grab({ kind: 'prop', prop: crate, r: crate.r, pos: () => crate.pos });
  for (let i = 0; i < 120; i++) { M.control(DT, {}); M.update(DT); world.update(DT); }
  assert.ok(crate.pos.y < 2.2, `held where the aim is, not climbing (${crate.pos.y.toFixed(2)} m)`);
  world.dispose(); clearTargets();
});

test('a tap throws loose metal away; a machine is knocked back and stunned', () => {
  clearTargets();
  const scene = sceneOf(), P = player(v(0, 0, 0));
  const ctx = ctxOf({ scene, P, camera: cameraAt(v(0, 2.2, 4), v(0, 1, -8)) });
  const world = new GadgetWorld({ physics: ctx.physics, player: P });
  ctx.world = world;
  const box = crateMesh(); box.position.set(0, 0.5, -8);
  const crate = world.addProp({ object: box, r: 0.62, h: 0.5, mass: 4, metal: true, light: false });
  const M = magnet.create(ctx);
  M.press(); M.update(DT); M.release();
  assert.ok(crate.vel.z < -8, `thrown away (${crate.vel.z.toFixed(1)} m/s)`);
  const f = { kind: 'machine', alive: true, pos: v(3, 0, -8), vel: v(), stunned: 0, flash: 0, alt: 0, def: { radius: 0.8, height: 1 }, get chest() { return v(this.pos.x, this.pos.y + 1 + this.alt, this.pos.z); } };
  crate.pos.set(0, 0.5, 30);
  const N = magnet.create({ ...ctx, foes: { list: [f] }, camera: cameraAt(v(0, 2.2, 4), v(3, 1, -8)) });
  N.press(); N.update(DT); N.release();
  assert.ok(f.stunned >= 1 && f.vel.length() > 5, 'knocked back, stunned');
  world.dispose(); clearTargets();
});

test('held, a machine is lifted off its feet; dropped from high it falls and is hurt', () => {
  clearTargets();
  const scene = sceneOf(), P = player(v(0, 0, 0));
  const hurt = [];
  const f = { kind: 'machine', alive: true, pos: v(0, 0, -7), vel: v(), stunned: 0, flash: 0, alt: 0, def: { radius: 0.8, height: 1 }, get chest() { return v(this.pos.x, this.pos.y + 1 + this.alt, this.pos.z); } };
  const ctx = ctxOf({ scene, P, camera: cameraAt(v(0, 2.2, 4), v(0, 1, -7)), foes: { list: [f], hurt: (foe, mode, dir, info) => hurt.push({ mode, damage: info.damage }) } });
  const M = magnet.create(ctx);
  M.press(); M.update(DT);
  for (let t = 0; t < MAG.tap + 0.05; t += DT) { M.hold(DT); M.update(DT); }
  assert.equal(M.state, 'hold');
  ctx.camera = cameraAt(v(0, 2.2, 4), v(0, 9, -7));
  for (let i = 0; i < 90; i++) { M.control(DT, {}); M.hold(DT); M.update(DT); }
  assert.ok(f.alt > 3, `lifted ${f.alt.toFixed(1)} m`);
  assert.ok(f.stunned > 0, 'helpless while held');
  M.release();
  for (let i = 0; i < 90; i++) M.update(DT);
  assert.equal(f.alt, 0, 'back on its feet');
  assert.equal(hurt.length, 1); assert.equal(hurt[0].mode, 'blade');
  clearTargets();
});

test('on heavy fixed metal the glove pulls the traveller to it, across a gap, and he takes hold', () => {
  clearTargets();
  const iron = tagMetal(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshBasicMaterial()));
  iron.position.set(0, 4, -12);
  const scene = sceneOf(iron), P = player(v(0, 0, 0));
  const ctx = ctxOf({ scene, P, camera: cameraAt(v(0, 2.2, 4), v(0, 4, -12)) });
  const M = magnet.create(ctx);
  M.press(); M.update(DT);
  assert.equal(M.cand?.kind, 'fixed');
  for (let t = 0; t < MAG.tap + 0.05; t += DT) { M.hold(DT); M.update(DT); }
  assert.equal(M.state, 'pull');
  let t = 0;
  while (M.state === 'pull' && t < 3) { M.control(DT, {}); P.pos.addScaledVector(P.vel, DT); P.vel.y -= 32 * DT; M.update(DT); t += DT; }
  assert.ok(t < 1.5, `there in ${t.toFixed(2)} s`);
  assert.ok(P.pos.z < -9.8, `across the gap (${P.pos.toArray().map((x) => x.toFixed(1))})`);
  assert.ok(P.mantles === 1 && P.climbs === 1, 'tried to haul over, then took hold');
  clearTargets();
});

test('the field is drawn as wavy dashes between glove and metal', () => {
  const g = new THREE.Group(), F = new FieldLines(g);
  F.draw(v(0, 1, 0), v(0, 1, -8), 0.5, { amp: 0.6 });
  assert.ok(F.mesh.count > 20 && F.mesh.count < F.strokes * F.segs, 'dashes, not whole lines');
  const m = new THREE.Matrix4(), p = v();
  let bowed = 0;
  for (let i = 0; i < F.mesh.count; i++) { F.mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); bowed = Math.max(bowed, Math.hypot(p.x, p.y - 1)); }
  assert.ok(bowed > 0.3 && bowed < 1.2, `they bow out round the line (${bowed.toFixed(2)} m)`);
  F.hide(); assert.equal(F.mesh.count, 0);
});

test('the yard\'s magnet bay: a plate only metal presses, a gate it opens, an iron block across a gap', async () => {
  const { createGadgetYard } = await import('../src/levels/gadget-yard.js');
  const scene = new THREE.Scene();
  const warn = console.warn; const warned = []; console.warn = (...a) => warned.push(a.join(' '));
  let level;
  try { level = createGadgetYard(scene); } finally { console.warn = warn; }
  assert.deepEqual(warned.filter((w) => /magnet|boomerang/.test(w)), [], 'its bay builds');
  const Y = level.gadgetYard;
  const metalPlate = Y.plates.find((p) => p.things);
  assert.ok(metalPlate && metalPlate.mass >= 3, 'a plate only something heavy presses');
  assert.ok(Y.gates.some((g) => g.plates.includes(Y.plates.indexOf(metalPlate))), 'and a gate it opens');
  assert.ok(metalSpots(scene).length >= 1, 'fixed iron to pull yourself to');
  // the plate: not pressed by the traveller, pressed by a metal crate
  const P = player(metalPlate.pos.clone());
  const world = new GadgetWorld({ physics: { groundAt: () => 0 }, player: P, spec: { plates: [metalPlate], gates: [], props: [] } });
  world.update(DT);
  assert.equal(world.plates[0].on, false, 'you are not heavy enough');
  world.props.push({ object: { visible: true }, pos: metalPlate.pos.clone().setY(0.5), h: 0.5, mass: 4 });
  world.updatePlates(DT);
  assert.equal(world.plates[0].on, true, 'a metal crate is');
  clearTargets();
});
