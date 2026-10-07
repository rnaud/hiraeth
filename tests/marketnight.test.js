// The Signal Market at night: its screens (src/levels/market-night-kit.js), the four References views of the night
// sheets (src/levels/reference-marketnight.js; docs/systems/references.md) and the market's own night (bazaar.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { createReferences, lensShift, frameBox, viewCamera } from '../src/levels/references.js';
import { sheetAt } from '../src/levels/reference-marketnight.js';
import { picture, PICTURES, crt, panel, roundScreen, nightPaint, SCREEN, FILL_COLOURS, vendor, tarp } from '../src/levels/market-night-kit.js';
import { sharedUniforms } from '../src/materials.js';
import { mulberry32 } from '../src/noise.js';

globalThis.window ??= { innerWidth: 1260, innerHeight: 800 };
const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };

test('the Signal Market at night: four views, one per picture, in the References, held at night', async () => {
  const k = worldIndex('marketnight');
  assert.ok(k >= 0, 'a References world');
  assert.equal(k, REFERENCE_WORLDS.findIndex((w) => w.id === 'moonfoundry') + 1, 'after the worlds before it: their views keep their numbers');
  assert.equal(REFERENCE_WORLDS[k].name, 'The Signal Market at night');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['marketnight-1', 'marketnight-2', 'marketnight-3', 'marketnight-4']);
  assert.equal(new Set(w.views.map((v) => v.id)).size, 4);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The Signal Market at night / '), 'the quick menu groups it under its world, not the day market');
    assert.deepEqual(S.size, [1456, 816]);
    assert.ok(S.url.includes('The%20Signal%20Market%20-%20Night') || S.url.includes('The Signal Market - Night'), 'its own folder');
    assert.equal(v.night, 1, `${v.id}: held at night`);
    assert.ok(v.camera.shift, `${v.id}: a shifted lens (the lane's verticals upright)`);
    assert.ok(Math.abs(v.sun.side) > 150, `${v.id}: the sun behind the camera, out of the frame`);
  }
});

test('a night view holds the night on, whatever the hour its sun picks', async () => {
  const k = worldIndex('marketnight');
  await loadWorld(k);
  const level = createReferences(new THREE.Scene(), { params: new URLSearchParams('world=marketnight'), search: '?level=references&world=marketnight', go: () => {} });
  const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, riding: false, object: new THREE.Object3D(), hidden: false, teleport(p) { this.pos.copy(p); } };
  const camera = new THREE.PerspectiveCamera(55, 1260 / 800, 0.3, 5000);
  sharedUniforms.uNight.value = 0;
  level.update(1 / 60, 0, { player, camera, rig: { yaw: 0, pitch: 0, _lastMouse: 0, target: new THREE.Vector3() } });
  assert.equal(sharedUniforms.uNight.value, 1, 'the screens glow, the stars are out');
  // its views: lit screens in one vertex-coloured material that glows, and the screens' pools of light
  const v = level.views[0];
  const screens = [];
  v.group.traverse((o) => { if (o.isMesh && o.material.vertexColors && o.material.uniforms?.uGlow?.value > 0.4) screens.push(o); });
  assert.equal(screens.length, 1, 'every lit screen and picture in one draw');
  assert.ok(screens[0].geometry.attributes.position.count > 20000, 'a lane full of screens');
  assert.ok(level.lights.length >= 4 * 4, 'each view lights its pools');
  sharedUniforms.uNight.value = 0;
});

test('the screens: every picture painted in flat colours, each body in its parts, the market\'s billboards by night', () => {
  for (const kind of PICTURES) {
    const parts = picture(kind, 2, 1.4, { seed: 3 });
    assert.ok(parts.length >= 2, `${kind}: a background and its picture`);
    for (const g of parts) { assert.ok(g.attributes.color, `${kind}: painted`); assert.ok(finite(g)); g.computeBoundingBox(); assert.ok(g.boundingBox.max.x <= 1.0001 && g.boundingBox.min.x >= -1.0001, `${kind}: inside its screen`); }
    // laid a hair apart in front of the screen (no two at one depth: no fighting)
    assert.ok(parts.every((g) => g.boundingBox.min.z >= 0), `${kind}: in front of z = 0`);
  }
  for (const make of [() => crt({ kind: 'desert' }), () => panel({ kind: 'glyphs' }), () => roundScreen({ kind: 'planet' })]) {
    const p = make();
    assert.ok(p.casing.length && p.screen.length && !p.off.length, 'a body and a lit screen');
    for (const list of Object.values(p)) for (const g of list) assert.ok(finite(g));
  }
  const off = crt({ on: false });
  assert.ok(!off.screen.length && off.off.length, 'switched off: a dark glass, no light');
  for (const c of FILL_COLOURS) assert.ok(SCREEN[c], `${c}: a screen colour`);
  for (let s = 0; s < 12; s++) { const n = nightPaint(s); for (const k of ['bg', 'fig', 'dark', 'light']) assert.match(n[k], /^#[0-9a-f]{6}$/); }
  const V = vendor(mulberry32(1), 0, 0, 0, 0);
  assert.ok(V.body.length >= 4 && V.seat.length === 1);
  assert.ok(finite(tarp([0, 3, 0], [2, 3, 0], [2, 2, 2], [0, 2, 2])));
});

test('the views\' lens: a sheet pixel lands where the picture draws it', () => {
  const cam = { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.73, shift: true };
  const c = viewCamera(cam), camera = new THREE.PerspectiveCamera(60, 1456 / 816, 0.1, 5000);
  camera.position.copy(c.eye); camera.lookAt(c.target); camera.updateMatrixWorld();
  lensShift(camera, cam, 1456, 816, frameBox(1456, 816, 1456 / 816, 60));
  for (const [px, py, d] of [[392, 175, 9], [212, 565, 4.2], [1365, 660, 4.3]]) {
    const p = sheetAt(cam, px, py, d).project(camera);
    assert.ok(Math.abs((p.x + 1) * 728 - px) < 0.5 && Math.abs((1 - p.y) * 408 - py) < 0.5, `${px}, ${py}`);
  }
});

// ------------------------------------------------------------------ the market's own night (bazaar.js)
import { createBazaar } from '../src/levels/bazaar.js';
import { Physics } from '../src/physics.js';
import { Crowd } from '../src/crowd.js';
import { clearTargets } from '../src/targets.js';
import { NIGHT_LIGHTS, NIGHT_CROWD_AWAY, MARKET_NIGHT } from '../src/levels/market-night-kit.js';

const market = (() => { let m; return () => { if (!m) { const scene = new THREE.Scene(), level = createBazaar(scene); m = { scene, level, physics: new Physics(scene, level.ground) }; } return m; }; })();

test('the market\'s billboards: painted as by day, and each part its night colour and glow', () => {
  const { scene } = market();
  const signs = [];
  scene.traverse((o) => { if (o.isMesh && o.material.defines?.NIGHT_PAINT) signs.push(o); });
  assert.ok(signs.length >= 1, 'the signs are night-painted');
  let lit = 0, colours = new Set();
  for (const m of signs) {
    const c = m.geometry.attributes.color, q = m.geometry.attributes.aNight;
    assert.ok(c && q && q.itemSize === 4 && q.count === c.count, 'a night colour for every vertex');
    for (let i = 0; i < q.count; i += 7) { if (q.getW(i) > 0.5) lit++; colours.add(`${q.getX(i).toFixed(2)},${q.getY(i).toFixed(2)},${q.getZ(i).toFixed(2)}`); }
  }
  assert.ok(lit > 1000, 'they glow by night');
  assert.ok(colours.size >= 10, `the sheets' many screen colours (${colours.size})`);
  // by day their colours are the shop colours they always were (the night colours replace them only as uNight comes up)
  const day = new Set();
  for (const m of signs) { const c = m.geometry.attributes.color; for (let i = 0; i < c.count; i += 7) day.add('#' + new THREE.Color(c.getX(i), c.getY(i), c.getZ(i)).getHexString()); }
  for (const hex of ['#f0a083', '#e4bd83', '#8dbbb9', '#94a9bd', '#ebce98', '#b9a9c5', '#f5dfab']) assert.ok(day.has(hex), `${hex}: a day colour kept`);
  assert.ok([...day].every((h) => ['#f0a083', '#e4bd83', '#8dbbb9', '#94a9bd', '#ebce98', '#b9a9c5', '#f5dfab'].includes(h)), 'and no other');
  assert.equal(MARKET_NIGHT.length, 5);
});

test('by night the lanterns light pools; by day none, and the Undertower\'s lights stay', () => {
  const { level } = market();
  const player = { pos: new THREE.Vector3(-20, 0.3, 30) };
  const temple = level.lights.length;
  sharedUniforms.uNight.value = 0;
  level.update(1 / 60, 0, { player });
  assert.equal(level.lights.length, temple, 'by day: no lantern light at all');
  assert.equal(sharedUniforms.uLampsOn.value, 0);
  level.update(1 / 60, 0, { player });
  sharedUniforms.uNight.value = 1;
  level.update(1 / 60, 1 / 60, { player });
  assert.equal(level.lights.length, temple + NIGHT_LIGHTS.count, 'the nearest lanterns');
  const mine = level.lights.slice(temple);
  for (const l of mine) assert.ok(Math.hypot(l.x - player.pos.x, l.z - player.pos.z) < 40 && l.w === NIGHT_LIGHTS.r, 'near the traveller, at full reach');
  level.update(1 / 60, 2 / 60, { player });
  assert.equal(level.lights.length, temple + NIGHT_LIGHTS.count, 'not piling up frame after frame');
  sharedUniforms.uNight.value = 0;
  level.update(1 / 60, 3 / 60, { player });
  assert.equal(level.lights.length, temple, 'gone at daybreak');
});

test('after midnight half the crowd goes home, never in front of the camera', () => {
  const { level, physics } = market();
  clearTargets();
  const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
  const crowd = new Crowd(new THREE.Scene(), physics, { spots: level.crowdSpots(), makeNPC: fakeNPC });
  const player = { pos: new THREE.Vector3(0, 0, 60), vel: new THREE.Vector3() };
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  cam.position.set(0, 2, 66); cam.lookAt(0, 1.5, 0); cam.updateMatrixWorld();
  sharedUniforms.uNight.value = 1;
  crowd.away = level.crowdAway();
  assert.equal(crowd.away, NIGHT_CROWD_AWAY);
  for (let f = 0; f < 3; f++) crowd.update(1 / 60, f / 60, player, cam);
  const gone = crowd.people.filter((p) => p.gone);
  assert.ok(gone.length > crowd.people.length * 0.3 && gone.length < crowd.people.length * 0.6, `${gone.length} of ${crowd.people.length} gone home`);
  assert.ok(gone.every((p) => p.pos.distanceTo(cam.position) > 45), 'only those far off');
  assert.ok(gone.every((p) => p.tier === 0), 'not drawn');
  sharedUniforms.uNight.value = 0;
  crowd.away = level.crowdAway();
  cam.position.set(0, 2, 400); cam.updateMatrixWorld();   // (out of the way: everyone far off)
  crowd.update(1 / 60, 1, player, cam);
  assert.ok(crowd.people.every((p) => !p.gone), 'back by day');
});
