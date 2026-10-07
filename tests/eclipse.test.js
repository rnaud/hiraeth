import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { RoomKit } from '../src/levels/lab-kit.js';
import { makeMaterial } from '../src/materials.js';
import { PRESETS } from '../src/post.js';
import { eclipsePhase, eclipseSun, eclipseScript, applyEclipse, ECLIPSE_DEFAULTS } from '../src/eclipse.js';
import { eclipseMats, eclipseUniforms, house, terrace, stairFlight, table, lantern, paleFigure, flowerBox, laundry, farQuarter, ECLIPSE_LOOK, ECLIPSE_TOTAL, ECLIPSE_SKY } from '../src/levels/eclipse-kit.js';
import { eclipseAt } from '../src/levels/reference-eclipse.js';
import { sunTurn } from '../src/levels/references.js';

const kitOf = () => new RoomKit({ group: new THREE.Group(), centre: new THREE.Vector3(), seed: 5 });
const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };

test('the City During the Eclipse\'s pictures: four views, one per picture, in the References', async () => {
  const k = worldIndex('eclipse');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The City During the Eclipse');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['eclipse-1', 'eclipse-2', 'eclipse-3', 'eclipse-4']);
  for (const v of w.views) {
    assert.ok(w.sheets[v.sheet].name.startsWith('The City During the Eclipse / '));
    assert.deepEqual(v.crop, [0, 0, 1456, 816]);
    // each held in totality, its eclipse where its picture has it
    assert.equal(v.look.uEclipse[0], 1, 'the moon all over the sun');
    assert.ok(v.look.uEclipse[1] > 0.05 && v.look.uEclipse[1] < 0.2, 'a disc of a few degrees');
    assert.equal(v.look.uEclipseDir.length, 3);
  }
});

test('the eclipse in a view stands where its picture has it, beside the line of sight, apart from the sun', async () => {
  const w = await loadWorld(worldIndex('eclipse'));
  for (const v of w.views) {
    const d = new THREE.Vector3(...v.look.uEclipseDir);
    assert.ok(Math.abs(d.length() - 1) < 1e-3);
    // the camera's line of sight in the world: the view's -z turned by its yaw, then by the group's turn (references.js)
    const a = sunTurn(v.sun, v.camera.yaw ?? 0), yaw = ((v.camera.yaw ?? 0) * Math.PI) / 180;
    const sight = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    const el = Math.asin(d.y) * 180 / Math.PI, side = Math.acos(new THREE.Vector3(d.x, 0, d.z).normalize().dot(sight)) * 180 / Math.PI;
    assert.ok(Math.abs(el - v.eclipse.el) < 0.01, `${v.id}: ${el.toFixed(2)}° up`);
    assert.ok(Math.abs(side - Math.abs(v.eclipse.side)) < 0.05, `${v.id}: ${side.toFixed(2)}° aside`);
  }
  // (a point straight ahead of an unturned view)
  const ahead = eclipseAt({ camera: { yaw: 0 }, sun: { side: 0, el: 30 } }, 0, 0);
  assert.ok(Math.abs(ahead[1]) < 1e-6);
});

test('the eclipse by the hour: total at midday, partial round it, none in the morning; the sun on its low path', () => {
  const c = ECLIPSE_DEFAULTS;
  assert.deepEqual(eclipsePhase(12, c), { cover: 1, total: 1 });
  assert.equal(eclipsePhase(12 + c.total, c).cover, 1);
  const p = eclipsePhase(12 + (c.total + c.partial) / 2, c);
  assert.ok(p.cover > 0.3 && p.cover < 0.7 && p.total === 0, 'half covered, no corona');
  assert.equal(eclipsePhase(9, c).cover, 0);
  assert.equal(eclipsePhase(12 - c.partial - 0.1, c).cover, 0);
  const noon = eclipseSun(12, c);
  assert.ok(Math.abs(Math.asin(noon.y) * 180 / Math.PI - c.el) < 1e-6, 'as high as its path says at noon');
  assert.ok(eclipseSun(6.5, c).y > 0 && eclipseSun(19, c).y < 0, 'up by day, down at night');
  // the colour script: hours in order, the totality's colours at noon
  const keys = eclipseScript({ day: ECLIPSE_TOTAL, dusk: ECLIPSE_TOTAL, night: ECLIPSE_TOTAL, dim: ECLIPSE_TOTAL, total: ECLIPSE_TOTAL }, c);
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i][0] > keys[i - 1][0], 'the keys in order');
  assert.ok(keys.every((k) => k.length === 6));
});

test('applyEclipse: the uniforms for the hour, the light leaning up in totality', () => {
  const U = { uSunDisc: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3() }, uEclipse: { value: null }, uCorona: { value: null }, uEclipseGlow: { value: null }, uEclipseDir: { value: null }, uNight: { value: 0 } };
  const light = new THREE.Vector3();
  applyEclipse(12, ECLIPSE_SKY, U, light);
  assert.equal(U.uEclipse.value[0], 1);
  assert.ok(U.uCorona.value[3] > 0, 'stars in totality');
  assert.ok(light.y > U.uSunDisc.value.y, 'the light higher than the black sun');
  assert.ok(U.uNight.value > 0.3, 'night-like: the windows lit');
  applyEclipse(9, ECLIPSE_SKY, U, light);
  assert.equal(U.uEclipse.value[0], 0);
  assert.ok(Math.abs(light.dot(U.uSunDisc.value) - 1) < 1e-6, 'out of the eclipse the light is the sun\'s');
});

test('every preset turns the eclipse off: a world\'s never carries into the next', () => {
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.deepEqual(p.uEclipse, [0, 0, 0, 0], name);
    assert.deepEqual(p.uEclipseDir, [0, 0, 0], name);
  }
  const u = eclipseUniforms();
  assert.equal(u.uEclipse[0], 1);
  assert.equal(ECLIPSE_LOOK.uClouds, 0);
});

test('lampTint: a material whose lamplit pools take the lamps\' colour', () => {
  const m = makeMaterial({ color: '#f0f0f0', lampTint: ['#ffa25a', 0.8] });
  assert.equal(m.defines.LAMP_TINT, 1);
  assert.ok(Math.abs(m.uniforms.uLampTint.value.w - 0.8) < 1e-6);
  assert.equal(makeMaterial({ color: '#f0f0f0' }).defines.LAMP_TINT, undefined, 'off unless asked');
});

test('the city kit: houses, terraces, stairs, tables, lamps, pale figures, flowers, washing, the far city', () => {
  const kit = kitOf(), M = eclipseMats(kit), rng = () => 0.37;
  const H = house(kit, M, rng, { x: 0, z: 0, w: 7, h: 6, roof: 'dome', doors: 1, lit: 1 });
  assert.ok(H.top > 6, 'the dome over the walls');
  assert.ok(kit.lights.length >= 1, 'a lit door lights the street');
  house(kit, M, rng, { x: 20, z: 0, w: 10, h: 12, kind: 'tower', roof: 'flat', windows: 4 });
  terrace(kit, M, { x0: -10, x1: 10, z0: -20, z1: -10, y: 5, gaps: [[-2, 2]] });
  const S = stairFlight(kit, M, { x: 0, z: -10, y0: 0, y1: 5, w: 5 });
  assert.ok(Math.abs(S.top[1] - 5) < 1e-9 && S.top[2] < -10, 'climbing toward -z');
  table(kit, M, rng, 0, 0, 5, { seats: 4 });
  lantern(kit, M, 2, 0, 2, { kind: 'big' });
  for (const pose of ['lean', 'hang', 'stand']) paleFigure(kit, M, rng, 0, 3, -5, { pose });
  flowerBox(kit, M, rng, 0, 6, -10, { w: 3 });
  laundry(kit, M, rng, [0, 4, 0], [5, 4, 0], { n: 3 });
  farQuarter(kit, M, rng, { x0: -100, x1: 100, z0: -300, z1: -100, n: 20 });
  let solids = 0, faces = 0;
  for (const b of kit.buckets.values()) { for (const g of b.list) { assert.ok(finite(g)); faces += g.attributes.position.count / 3; } if (b.solid) solids++; }
  assert.ok(solids >= 3, 'walls, terraces and stairs collide');
  assert.ok(faces > 2000 && faces < 60000, `a modest count of faces: ${faces}`);
});
