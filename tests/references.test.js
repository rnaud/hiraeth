import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { ORDER, CONTENT } from '../src/levels/content.js';
import { createReferences, viewCamera, frameBox, sunHour, sunTurn, cropStyle, VIEW_EXTENT } from '../src/levels/references.js';
import { REFERENCE_VIEWS, REFERENCE_SHEETS } from '../src/levels/reference-views.js';
import { COSTUMES } from '../src/costumes.js';
import { applyTimeOfDay } from '../src/timeofday.js';

let built = null;
const refs = () => built ??= (() => { const scene = new THREE.Scene(); return { scene, level: createReferences(scene) }; })();
/** a stand-in player and camera the level can frame */
function walker() {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, riding: false, object: new THREE.Object3D(), hidden: false,
    teleport(p) { this.pos.copy(p); this.vel.set(0, 0, 0); },
  };
}
globalThis.window ??= { innerWidth: 1260, innerHeight: 800 };

test('the references: a developer world in the worlds list, never on the route or the star map', () => {
  const L = LEVELS.find((l) => l.id === 'references');
  assert.ok(L && L.dev && L.hidden, 'dev only (?level=references, the worlds list)');
  assert.ok(!ORDER.includes('references'), 'not on the route');
  assert.ok(CONTENT.references && COSTUMES.references, 'its content and its people\'s clothes');
  const { level } = refs();
  assert.equal(level.id, 'references');
  assert.equal(level.reactions, false, 'nothing grows into the panels');
});

test('IMG_3775 has six views, each with a camera framed like its panel', () => {
  const sheet = REFERENCE_VIEWS.filter((v) => v.sheet === 'IMG_3775');
  assert.equal(sheet.length, 6);
  assert.deepEqual(sheet.map((v) => v.panel), [1, 2, 3, 4, 5, 6]);
  const { level } = refs();
  assert.equal(level.views.length, REFERENCE_VIEWS.length);
  for (const v of level.views) {
    const d = v.def, [x, y, w, h] = d.crop, S = REFERENCE_SHEETS[d.sheet];
    assert.ok(x >= 0 && y >= 0 && x + w <= S.size[0] && y + h <= S.size[1], `${d.id}: the crop lies on its sheet`);
    const steep = d.camera.pitch !== undefined;   // (a view up or down a shaft: its pitch given outright)
    assert.ok(d.camera.fov > 15 && d.camera.fov < 90 && (steep ? Math.abs(d.camera.pitch) < 85 : d.camera.horizon > 0 && d.camera.horizon < 1), `${d.id}: a field of view and a horizon or pitch`);
    assert.equal(d.sky.length, 5, `${d.id}: its sky, shadow and light colours`);
    // the eye stands above its ground, in the world where the view is
    assert.ok(v.eye.y > level.ground.heightAt(v.eye.x, v.eye.z) + 1, `${d.id}: the eye clears the ground`);
    assert.ok(Math.abs(v.centre.x) <= VIEW_EXTENT && Math.abs(v.centre.z) <= VIEW_EXTENT && v.centre.length() > 1500, 'on the grid, clear of the ship at the origin');
    if (steep) continue;
    // the horizon lands where the panel has it: eye level projects to that height of the frame
    const cam = new THREE.PerspectiveCamera(d.camera.fov, w / h, 0.3, 5000);
    cam.position.copy(v.eye); cam.lookAt(v.target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const fwd = v.target.clone().sub(v.eye).setY(0).normalize();
    const p = v.eye.clone().addScaledVector(fwd, 1000).project(cam);
    assert.ok(Math.abs((1 - p.y) / 2 - d.camera.horizon) < 1e-3, `${d.id}: horizon at ${d.camera.horizon}`);
  }
  for (let i = 0; i < level.views.length; i++) for (let j = i + 1; j < level.views.length; j++)
    assert.ok(level.views[i].centre.distanceTo(level.views[j].centre) > 3000, 'views far apart: only one is drawn');
});

test('each view\'s sun comes from the side its panel is lit from', () => {
  const { level } = refs();
  const U = { uSunDisc: { value: new THREE.Vector3() }, uMoonDisc: { value: new THREE.Vector3() }, uFlatten: { value: 0 }, uNight: { value: 0 }, uMoonVis: { value: 0 },
    uSkyTop: { value: new THREE.Color() }, uSkyHorizon: { value: new THREE.Color() }, uFogMul: { value: 1 }, uShadowTint: { value: new THREE.Color() },
    uLightTint: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() } };
  for (const v of level.views) {
    const sun = new THREE.Vector3();
    applyTimeOfDay(v.hour, sun, U, v.atmo, v.atmo.script);
    assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.asin(sun.y)) - v.def.sun.el) < 0.5, `${v.def.id}: sun ${v.def.sun.el}° high`);
    const fwd = v.target.clone().sub(v.eye).setY(0).normalize(), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const side = THREE.MathUtils.radToDeg(Math.atan2(sun.dot(right), sun.dot(fwd)));
    assert.ok(Math.abs(side - v.def.sun.side) < 0.5, `${v.def.id}: sun ${v.def.sun.side}° to the right (${side.toFixed(1)})`);
    assert.equal(sunTurn(v.def.sun, v.def.camera.yaw), v.group.rotation.y);
    assert.ok(sunHour(v.def.sun.el).hour > 6 && sunHour(v.def.sun.el).hour < 12);
  }
});

test('[ and ] frame the next and previous view; walking lets the camera go; \\ cycles the comparison', () => {
  const { level } = refs();
  const player = walker(), camera = new THREE.PerspectiveCamera(55, 1260 / 800, 0.3, 5000);
  const rig = { yaw: 0, pitch: 0.2, _lastMouse: 0, target: new THREE.Vector3() };
  const step = (n = 2) => { for (let i = 0; i < n; i++) level.update(1 / 60, i / 60, { player, camera, rig }); };
  step();
  assert.equal(level.held, level.views[0], 'the first view is framed on arrival');
  assert.ok(camera.position.distanceTo(level.views[0].eye) < 1e-6 && player.hidden, 'the camera is the panel\'s, the traveller hidden');
  level.jump(1); step();
  assert.equal(level.held, level.views[1]);
  level.jump(-1); level.update(1 / 60, 0, { player, camera, rig }); level.jump(-1); step();
  assert.equal(level.held, level.views[level.views.length - 1], 'round from the first to the last');
  player.pos.x += 2; step();
  assert.equal(level.held, null, 'walking: the camera is yours');
  assert.ok(!player.hidden && camera.fov === 55, 'the traveller back, the usual field of view');
  level.jump(1); step();
  assert.equal(level.held, level.views[0], 'a switch frames the panel again');
  assert.deepEqual([level.compare(), level.compare(), level.compare(), level.compare()], ['corner', 'overlay', 'half', 'off']);
});

test('the frame on screen keeps the panel\'s proportions; the crop is drawn from the sheet', () => {
  const wide = frameBox(1920, 1080, 463 / 294, 40), tall = frameBox(800, 1000, 463 / 294, 40);
  assert.ok(Math.abs(wide.w / wide.h - 463 / 294) < 1e-9 && wide.h === 1080 && wide.fov === 40);
  assert.ok(tall.w === 800 && tall.fov > 40, 'narrower than the panel: a wider field of view keeps its width');
  const c = viewCamera({ eye: [0, 2, 0], yaw: 0, fov: 40, horizon: 0.5 });
  assert.ok(Math.abs(c.pitch) < 1e-9 && c.target.z < 0, 'the horizon in the middle: looking level, down -z');
  const css = cropStyle(REFERENCE_VIEWS[0], 463, 294);
  assert.match(css.backgroundImage, /IMG_3775\.JPG/);
  assert.equal(css.backgroundSize, '1024px 1024px');
  assert.equal(css.backgroundPosition, '-42px -44px');
});

test('the panels\' figures stand on their view\'s ground, in their own clothes', () => {
  const { level } = refs();
  const people = CONTENT.references.npcs;
  assert.ok(people.length >= 4);
  for (const p of people) {
    const v = level.viewAt(p.at[0], p.at[1]);
    assert.ok(v, 'in a view');
    assert.ok(Math.abs(level.ground.heightAt(p.at[0], p.at[1]) - p.y) < 0.05, 'on the ground');
    assert.ok(p.lines.every((l) => /^~\w+~ /.test(l)), 'every line has a tone');
  }
});

test('the other desert sheets: IMG_3772, 3773 and 3774 panel by panel, after IMG_3775, in order', () => {
  const counts = { IMG_3775: 6, IMG_3772: 6, IMG_3773: 8, IMG_3774: 7 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.deepEqual(views.map((v) => v.panel), Array.from({ length: n }, (_, i) => i + 1), `${s}: its panels in order`);
    assert.match(REFERENCE_SHEETS[s].url, new RegExp(`${s}\\.JPG$`));
    // no two panels of a sheet overlap
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  // [ ] cycles through all of them, sheet after sheet
  assert.deepEqual([...new Set(REFERENCE_VIEWS.map((v) => v.sheet))].slice(0, 4), ['IMG_3775', 'IMG_3772', 'IMG_3773', 'IMG_3774']);
  assert.equal(new Set(REFERENCE_VIEWS.map((v) => v.id)).size, REFERENCE_VIEWS.length, 'every view its own id');
  const { level } = refs();
  assert.equal(level.views.filter((v) => REFERENCE_SHEETS[v.def.sheet].name.startsWith('The Desert')).length, 27);
});

test('the City-Shaft\'s sheets after the desert\'s, grouped by world, each panel on its sheet', () => {
  const counts = { IMG_3778: 1, IMG_3779: 5, IMG_3780: 5, IMG_3781: 5, IMG_3782: 7 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.ok(REFERENCE_SHEETS[s].name.startsWith('The City-Shaft / '), 'the label names the world');
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  // grouped by world: every desert sheet before every City-Shaft one
  const world = REFERENCE_VIEWS.map((v) => REFERENCE_SHEETS[v.sheet].name.split(' / ')[0]);
  assert.deepEqual([...new Set(world)], ['The Desert', 'The City-Shaft']);
  for (let i = 1; i < world.length; i++) assert.ok(world[i] === world[i - 1] || !world.slice(0, i).includes(world[i]), 'a world\'s views together');
  // the views up or down the shaft frame with a roll and a pitch
  const steep = REFERENCE_VIEWS.filter((v) => v.camera.pitch !== undefined);
  assert.ok(steep.length >= 8);
  const c = viewCamera({ eye: [0, 0, 0], fov: 60, pitch: -60, roll: 10 });
  assert.ok(Math.abs(c.pitch + Math.PI / 3) < 1e-9 && c.target.y < -40 && Math.abs(c.roll - Math.PI / 18) < 1e-9);
});
