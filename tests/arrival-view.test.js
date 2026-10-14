// Issue #327: "The first arrival on all planets should have a wow effect. The landing view and the first exit out of
// the ship should show a beautiful view of the landscape with points of interest visible." Every route world has
// two first views (src/ship/arrival-view.js, picked in the game by scripts/arrival-views.mjs into
// src/ship/arrival-views.js): the establishing shot of the first landing, its landmarks and the ship coming down in
// its frame; and the first step out's framing (the rig behind him, turned to the view), its main landmarks in frame
// and not behind him. Both play once per world per save; later arrivals are the short one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player, CameraRig, OPEN_DIST, OPEN_LOOK } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { ArrivalDirector, APPROACH } from '../src/ship/cinematics.js';
import { LANDING, landingDur } from '../src/ship/flight.js';
import { buildableById } from '../src/levels/buildable.js';
import { ORDER } from '../src/levels/names.js';
import { game } from '../src/game-state.js';
import * as AV from '../src/ship/arrival-view.js';
import { ARRIVAL_VIEWS } from '../src/ship/arrival-views.js';

globalThis.window ??= { addEventListener() {} };
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

test('the exit is scored with the rig\'s own framing and the game\'s lens', () => {
  assert.equal(AV.RIG.arm, OPEN_DIST);
  assert.equal(AV.RIG.look, OPEN_LOOK);
  const fov = +readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').match(/new THREE\.PerspectiveCamera\((\d+)/)[1];
  assert.equal(AV.RIG.fov, fov);
});

test('every route world has its first views picked, for where its ship stands', () => {
  for (const id of ORDER) {
    const v = ARRIVAL_VIEWS[id];
    assert.ok(v?.wide && v?.exit, `${id}: views picked (node scripts/arrival-views.mjs)`);
    assert.ok(v.wide.pos.every(Number.isFinite) && v.wide.look.every(Number.isFinite) && v.wide.fov > 30 && v.wide.fov < 70, `${id}: a lens`);
    assert.ok(Number.isFinite(v.exit.heading) && AV.EXIT_PITCHES.includes(v.exit.pitch), `${id}: a heading and one of the pitches`);
    assert.ok(Math.hypot(v.stand[0] - v.ship[0], v.stand[2] - v.ship[2]) < 30, `${id}: he stands at the ramp's foot`);
    assert.ok(AV.arrivalViews(id, V(v.ship)), `${id}: found for its ship`);
    assert.equal(AV.arrivalViews(id, V(v.ship).add(new THREE.Vector3(40, 0, 0))), null, `${id}: a ship moved since: none (the short arrival)`);
  }
});

// each world built as the tests build it (the level, its collision); the sightlines against what it draws
const built = new Map();
const world = (id) => { if (!built.has(id)) built.set(id, quiet(async () => {
  const scene = new THREE.Scene();
  const level = await buildableById(id).create(scene);
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  level.init?.(physics);
  const footAt = (x, z) => Math.min(...[[20, 0], [-20, 0], [0, 20], [0, -20]].map(([dx, dz]) => physics.groundAt(x + dx, 1500, z + dz, 3000)).filter(Number.isFinite));
  return { level, physics, marks: AV.marksOf(id, level, footAt), ...AV.losOf(AV.sightPhysics(scene, level, Physics)) };
})); return built.get(id); };

for (const id of ORDER) {
  test(`${id}: the first landing's establishing shot shows the world's landmarks, and the ship coming down in it`, async () => {
    const v = ARRIVAL_VIEWS[id], { marks, los } = await world(id);
    assert.ok(marks.length >= 1 && marks.some((m) => m.main), `${id}: its landmarks from its data`);
    // at the start of the shot and at its end (the camera drifts)
    for (const k of [0, 1]) {
      const view = { pos: v.wide.pos.map((p, i) => p + v.wide.drift[i] * k), look: v.wide.look.map((p, i) => p + v.wide.drift[i] * k), fov: v.wide.fov };
      const f = AV.framed(view, marks, los);
      for (const m of f.filter((x) => x.main)) assert.ok(m.seen, `${id}: ${m.name} in the frame and in sight (${k ? 'end' : 'start'}: at ${m.at})`);
      const seen = f.filter((x) => x.seen).length;
      assert.ok(seen >= Math.min(2, marks.length), `${id}: ${seen} landmarks in sight`);
      const cam = AV.viewCamera(view), low = AV.screenOf(cam, [v.ship[0], v.ship[1] + AV.WIDE.to, v.ship[2]]);
      assert.ok(AV.inFrame(low), `${id}: the ship in the frame as it comes down (${low.x.toFixed(2)}, ${low.y.toFixed(2)})`);
      assert.ok(los(view.pos, [v.ship[0], v.ship[1] + 12, v.ship[2]]), `${id}: nothing between the lens and the ship`);
    }
    // (issue #354) it glides in nose first along its bow from well back, in the frame for the last 60 % of the way
    // (the bow: the hatch faces the ship's left, so the bow is the ramp's way turned a quarter round)
    const o = [v.stand[0] - v.ship[0], v.stand[2] - v.ship[2]], n = Math.hypot(...o), fwd = [-o[1] / n, 0, o[0] / n];
    const back = AV.wideBack(v.wide, v.ship, fwd);
    assert.ok(back >= 150, `${id}: it glides in from ${back} m back`);
  });

  test(`${id}: the first step out faces the world's best view, its main landmarks in the rig's frame`, async () => {
    const v = ARRIVAL_VIEWS[id], { marks, los, physics, level } = await world(id);
    // the picked framing
    const f = AV.framed(AV.rigView(v.stand, v.exit.heading, v.exit.pitch), marks, los, { figure: true });
    for (const m of f.filter((x) => x.main)) assert.ok(m.seen, `${id}: ${m.name} in the frame, in sight and not behind him (at ${m.at})`);
    // and the real camera rig settled behind him there, turned so (src/player.js CameraRig)
    const cam = new THREE.PerspectiveCamera(AV.RIG.fov, AV.ASPECT, 0.3, 6000);
    const rig = new CameraRig(cam, { addEventListener() {} }, physics);
    rig.yaw = v.exit.heading + Math.PI; rig.pitch = v.exit.pitch; rig._lastP = null;
    const P = new Player(physics, { gravityAt: level.gravityAt });
    P.respawn(V(v.stand).add(new THREE.Vector3(0, 0.05, 0)));
    for (let i = 0; i < 30; i++) P.update(1 / 60, {}, rig.yaw);
    for (let i = 0; i < 120; i++) rig.update(P.pos, 1 / 60, null);
    cam.updateMatrixWorld(true);
    const main = marks.filter((m) => m.main);
    for (const m of main) {
      const r = AV.seenIn(cam, m, AV.sightLines(cam.position.toArray(), m, los));
      assert.ok(r.inFrame, `${id}: ${m.name} in the rig's frame`);
    }
  });
}

// a flat world with its ship where one world's views were picked (Ship.place: the site the level names)
function flatAt(id) {
  const v = ARRIVAL_VIEWS[id];
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: new THREE.Vector3(v.ship[0], 0, v.ship[2] + 80), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: v.ship[0], z: v.ship[2], heading: 0 } };
  const ship = new Ship({ scene, physics, level, levelId: id, content: { npcs: [], relics: { spots: [] } } });
  ship.player = new Player(physics);
  ship.rig = { yaw: 0, pitch: 0.2, target: new THREE.Vector3(), indoor: false };
  ship.camera = new THREE.PerspectiveCamera();
  ship.sound = {};
  ship.onReady = () => {};
  return ship;
}
const play = (ship, { skip = false } = {}) => {
  const d = new ArrivalDirector(ship);
  d.start();
  for (let t = 0; t < 40 && !d.done; t += 1 / 30) { d.update(1 / 30, skip && t > 0.5); if (ship.auto && d.i >= 5) ship.auto = null; }
  assert.ok(d.done, 'the arrival ends');
  return d;
};

test('the establishing descent and the first step out play once per world per save; later arrivals are short', () => {
  game.reset();
  const id = 'glassdunes', ship = flatAt(id);
  assert.ok(!game.flag(AV.WIDE_FLAG(id)) && !game.flag(AV.VIEW_FLAG(id)));
  const first = new ArrivalDirector(ship);
  assert.equal(first.steps[2].dur, AV.WIDE.dur, 'the first: the establishing descent');
  assert.equal(first.steps[3].dur, AV.WIDE.land, 'and the last of the landing from where it leaves off');
  assert.ok(game.flag(AV.WIDE_FLAG(id)), 'seen (skipped or not, it was this arrival)');
  first.start();
  for (let t = 0; t < 40 && !first.done; t += 1 / 30) { first.update(1 / 30, false); if (ship.auto && first.i >= 5) ship.auto = null; }
  assert.ok(game.flag(AV.VIEW_FLAG(id)), 'the first step out seen');
  assert.ok(ship.reveal, 'the camera drifts into the view');
  assert.ok(Math.abs(Math.atan2(Math.sin(ship.rig.yaw - ARRIVAL_VIEWS[id].exit.heading - Math.PI), Math.cos(ship.rig.yaw - ARRIVAL_VIEWS[id].exit.heading - Math.PI))) < 1e-6, 'the rig turned to the view');
  assert.ok(Math.abs(ship.player.heading - ARRIVAL_VIEWS[id].exit.heading) < 1e-6, 'and he faces it');
  ship.reveal = null;
  // again in the same save: the short arrival, no drift
  const again = new ArrivalDirector(ship);
  assert.equal(again.steps[2].dur, APPROACH.sky, 'the short drop out of the clouds');
  assert.ok(Math.abs(again.steps[3].dur - (landingDur(LANDING) - APPROACH.sky)) < 1e-9, 'the rest of the way in, the hover and the drop');
  play(ship);
  assert.equal(ship.reveal, null, 'no drift the second time');
  // another world: its own first time
  const other = flatAt('buried');
  assert.equal(new ArrivalDirector(other).steps[2].dur, AV.WIDE.dur, 'another world has its own first arrival');
  // a new save: the first time again
  game.reset();
  assert.equal(new ArrivalDirector(ship).steps[2].dur, AV.WIDE.dur, 'a new save sees it again');
  game.reset();
});

test('the first arrival held to skip still ends turned to the view; a world with no views picked arrives as before', () => {
  game.reset();
  const ship = flatAt('desert');
  play(ship, { skip: true });
  assert.ok(ship.reveal && game.flag(AV.VIEW_FLAG('desert')), 'skipped: the drift into the view is his to cut short');
  const p = ship.player.pos, s = AV.exitStops(ship.rampFoot, ship.outDir, ARRIVAL_VIEWS.desert.exit.heading)[1];
  assert.ok(Math.hypot(p.x - s.x, p.z - s.z) < 0.5, 'stood where the walk out would have left him');
  game.reset();
  const none = flatAt('desert');
  none.restPos.x += 500;   // (a ship that stands elsewhere: its views were not picked for this spot)
  assert.equal(new ArrivalDirector(none).steps[2].dur, APPROACH.sky);
  game.reset();
});

test('the drift gives way at once to his input, but not to the skip still held', () => {
  const ship = flatAt('desert');
  ship.camera.position.set(0, 2, 0);
  const exit = ARRIVAL_VIEWS.desert.exit;
  ship.revealView(exit);
  ship.input({ Escape: true, KeyE: false });
  ship.updateReveal(1 / 60);
  assert.ok(ship.reveal && !ship.reveal.cut, 'the skip held from the arrival does not cut it');
  ship.input({ Escape: true, stick: { x: 0, y: -1 } });
  ship.updateReveal(1 / 60);
  assert.equal(ship.reveal, null, 'the stick pushed: control is his');
  assert.ok(ship.blend && ship.blend.dur <= 0.5, 'eased back to the rig quickly');
  assert.equal(ship.cam, null, 'its last shot no longer the camera (left there, it held the view still for good: issue #264)');
  ship.revealView(exit);
  ship.updateReveal(1 / 60);
  ship.rig.yaw += 0.2;   // the camera turned by hand (the mouse, the right stick)
  ship.updateReveal(1 / 60);
  assert.equal(ship.reveal, null, 'the camera turned: his');
  ship.revealView(exit);
  for (let t = 0; t <= AV.REVEAL.dur + 0.1 && ship.reveal; t += 1 / 30) ship.updateReveal(1 / 30);
  assert.equal(ship.reveal, null, 'and it ends by itself');
  assert.equal(ship.cam, null, 'the rig\'s camera again');
  assert.ok(AV.anyInput({ KeyW: true }) && AV.anyInput({ lookStick: { x: 0.6, y: 0 } }) && !AV.anyInput({ lookStick: { x: 0, y: 0 }, stick: null }));
});
