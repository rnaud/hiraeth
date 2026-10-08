import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Cascade, ShadowCuller, shadowDirection, snapLightSpace, VIEW_SLACK, viewOf, viewLeft } from '../src/shadows.js';

const uniforms = () => ({ map: { value: null }, matrix: { value: new THREE.Matrix4() }, bias: { value: 0 }, offset: { value: 0 } });
const sun = new THREE.Vector3(0.6, 0.8, 0.1).normalize();
const frac = (v) => v - Math.floor(v);

test('snapLightSpace: x, y land on whole texels, z on whole depth steps', () => {
  const texel = 440 / 4096;
  for (const v of [[0.03, -17.31, 12.9], [1234.5678, 9.87654, -801.1], [-0.0537, 0.0537, 0]]) {
    const s = snapLightSpace(new THREE.Vector3(...v), texel, 50);
    for (const k of ['x', 'y']) {
      const n = s[k] / texel;
      assert.ok(Math.abs(n - Math.round(n)) < 1e-9, `${k} = ${n} texels`);
      assert.ok(Math.abs(s[k] - v[k === 'x' ? 0 : 1]) <= texel / 2 + 1e-12);
    }
    assert.ok(Math.abs(s.z / 50 - Math.round(s.z / 50)) < 1e-9);
  }
});

test('cascade: the window moves in whole texels while the player walks, and a fixed point keeps its sub-texel spot', () => {
  for (const [size, extent] of [[2048, 12], [4096, 220], [2048, 160], [2048, 1150]]) {
    const c = new Cascade({ size, extent, depth: 1600, uniforms: uniforms() });
    c.update(new THREE.Vector3(150, 2, 350), sun);
    const left0 = c.cam.left, bottom0 = c.cam.bottom, near0 = c.cam.near;
    const P = new THREE.Vector4(225, 5, 380, 1);
    const uv = () => { const v = P.clone().applyMatrix4(c.U.matrix.value); return [(v.x * 0.5 + 0.5) * size, (v.y * 0.5 + 0.5) * size, v.z]; };
    const [u0, v0] = uv();
    for (let k = 1; k <= 40; k++) {
      // a walk with arbitrary sub-texel steps
      c.place(new THREE.Vector3(150 + k * 0.0371, 2 + Math.sin(k) * 0.3, 350 + k * 0.0293));
      const dl = (c.cam.left - left0) / c.texel, db = (c.cam.bottom - bottom0) / c.texel;
      assert.ok(Math.abs(dl - Math.round(dl)) < 1e-6 && Math.abs(db - Math.round(db)) < 1e-6, `origin moved ${dl}, ${db} texels`);
      assert.equal(c.cam.right - c.cam.left, extent * 2);   // fixed size, whatever the view
      const [u, v] = uv();
      assert.ok(Math.abs(frac(u) - frac(u0)) < 1e-3 && Math.abs(frac(v) - frac(v0)) < 1e-3, `sub-texel drift ${frac(u) - frac(u0)}`);
    }
    // the depth window only moves in whole steps (stored depths don't drift either)
    const dz = (c.cam.near - near0) / (1600 / 32);
    assert.ok(Math.abs(dz - Math.round(dz)) < 1e-6);
  }
});

test('cascade: bias and normal offset are in texels, so a smaller map gets proportionally more', () => {
  const U = uniforms();
  const c = new Cascade({ size: 4096, extent: 220, depth: 1600, bias: 2, offset: 3, uniforms: U });
  const big = { bias: U.bias.value, offset: U.offset.value };
  assert.ok(Math.abs(big.offset - 3 * 440 / 4096) < 1e-12);
  assert.ok(Math.abs(big.bias * 1600 - 2 * 440 / 4096) < 1e-9);
  c.configure(2048, 220);
  assert.ok(Math.abs(U.offset.value / big.offset - 2) < 1e-9 && Math.abs(U.bias.value / big.bias - 2) < 1e-9);
  assert.equal(c.texel, 440 / 2048);
  c.disable();
  const v = new THREE.Vector4(10, 0, 10, 1).applyMatrix4(U.matrix.value);
  assert.ok(v.x / v.w * 0.5 + 0.5 > 1, 'a disabled cascade maps everything outside');
});

test('shadowDirection: a slowly moving sun turns the maps in rare steps, never every frame', () => {
  const out = new THREE.Vector3(), prev = new THREE.Vector3();
  let turns = 0;
  for (let i = 0; i <= 600; i++) {   // 10 s at 60 fps, the sun moving 0.25 deg / s
    const el = (40 + i * 0.25 / 60) * Math.PI / 180, az = 0.7;
    shadowDirection(new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)), out);
    if (i && !out.equals(prev)) turns++;
    prev.copy(out);
    assert.ok(Math.abs(out.length() - 1) < 1e-9);
  }
  assert.ok(turns <= 12 && turns >= 8, `${turns} turns`);
  // a still sun: the same direction every frame
  const a = shadowDirection(sun, new THREE.Vector3()), b = shadowDirection(sun.clone(), new THREE.Vector3());
  assert.ok(a.equals(b) && a.angleTo(sun) < 0.25 * Math.PI / 180);
});

test('ShadowCuller: casters whose shadow cannot reach the view, or smaller than a texel, are skipped', () => {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial();
  const box = (x, y, z, s = 2) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat); m.position.set(x, y, z); scene.add(m); return m; };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), mat);
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  camera.position.set(0, 2, 0); camera.lookAt(0, 2, -10);   // looking north (-z)
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const light = new THREE.Vector3(1, 1, 0).normalize();     // sun in the east: shadows fall west
  const inView = box(0, 1, -40);
  const behind = box(0, 1, 60);                             // behind the camera, shadow going west: never in view
  const eastTower = box(60, 30, -60, 6);                    // off screen to the right, its shadow falls west into view
  const pebble = box(0, 0.05, -20, 0.1);                    // in view but under a texel of a 1 m map
  scene.updateMatrixWorld();
  const cull = new ShadowCuller(scene);
  cull.begin(camera, light);
  const hidden = cull.hide(1000, 1.1, 1600);
  assert.ok(hidden.includes(behind), 'behind the camera');
  assert.ok(!hidden.includes(inView), 'in view');
  assert.ok(!hidden.includes(eastTower), 'its shadow reaches the view');
  assert.ok(hidden.includes(pebble), 'smaller than a texel');
  assert.ok(!hidden.includes(ground));
  for (const o of hidden) assert.equal(o.visible, false);
  for (const o of hidden) o.visible = true;
  // a fine map keeps the pebble
  cull.begin(camera, light);
  const fine = cull.hide(1000, 0.012, 1600);
  assert.ok(!fine.includes(pebble));
  for (const o of fine) o.visible = true;
});

test('a map kept over frames holds the casters of every view within VIEW_SLACK, and is redrawn once the view leaves it', () => {
  // the City-Shaft: the far map (drawn every 3rd frame) culled for one view and looked at from the next ones;
  // after a quick turn the towers whose shadows had been off screen were missing until it was drawn again
  const scene = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  camera.position.set(0, 2, 0); camera.lookAt(0, 2, -10);   // looking north (-z)
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const light = new THREE.Vector3(0, 1, 0);                 // the sun overhead: a shadow falls straight down
  // a tower just right of the view’s edge (its half-width is 43° at 16:9 and 55° tall): 4° out, 300 m off
  const out = (deg, d = 300) => { const a = THREE.MathUtils.degToRad(deg); return new THREE.Vector3(Math.sin(a) * d, 2, -Math.cos(a) * d); };
  const half = THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(27.5)) * 16 / 9));
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), mat); tower.position.copy(out(half + 4)); scene.add(tower);
  const far = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), mat); far.position.copy(out(half + 30)); scene.add(far);
  scene.updateMatrixWorld();
  const cull = new ShadowCuller(scene);
  cull.begin(camera, light);
  let hidden = cull.hide(5000, 1.1, 3200);
  assert.ok(hidden.includes(tower) && hidden.includes(far), 'drawn for this frame only: both out of the view');
  for (const o of hidden) o.visible = true;
  cull.begin(camera, light);
  hidden = cull.hide(5000, 1.1, 3200, 0.75, [], VIEW_SLACK);
  assert.ok(!hidden.includes(tower), 'kept: within the slack');
  assert.ok(hidden.includes(far), 'still left out: well beyond it');
  for (const o of hidden) o.visible = true;
  assert.ok(THREE.MathUtils.degToRad(4) < VIEW_SLACK.turn && VIEW_SLACK.turn < THREE.MathUtils.degToRad(30));

  // redrawn when the view turns or moves out of the slack
  const at = viewOf(camera);
  assert.equal(viewLeft(null, camera), true, 'never drawn');
  assert.equal(viewLeft(at, camera), false);
  camera.rotation.y -= VIEW_SLACK.turn * 0.8; camera.updateMatrixWorld();
  assert.equal(viewLeft(at, camera), false, 'a little turn: the kept casters cover it');
  camera.rotation.y -= VIEW_SLACK.turn * 0.4; camera.updateMatrixWorld();
  assert.equal(viewLeft(at, camera), true, 'past the slack');
  const at2 = viewOf(camera);
  camera.position.x += VIEW_SLACK.move + 0.5; camera.updateMatrixWorld();
  assert.equal(viewLeft(at2, camera), true, 'a cut or a teleport');
});

test('the far pass leaves out pebbles and shrubs, not a tile of boulders; self-lit things stay out unless they are solid', async () => {
  const { farPassSkips, largestInstance, selfLitSkips } = await import('../src/shadows.js');
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const tile = (scales) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), scales.length);
    scales.forEach((s, i) => m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(i * 3, 0, 0), new THREE.Quaternion(), new THREE.Vector3(s, s, s))));
    m.userData.tiled = true;
    m.updateMatrixWorld();
    return m;
  };
  const pebbles = tile([0.2, 0.3, 0.25]), boulders = tile([0.3, 4.4, 0.5]), hidden = tile([6]);
  hidden.visible = false;
  const plants = tile([3]); plants.userData.flora = true;
  const bush = new THREE.Mesh(geo);
  assert.ok(Math.abs(largestInstance(boulders) - 4.4) < 1e-6, 'the biggest instance');
  const texel = 2300 / 2048;
  const skip = farPassSkips([pebbles, boulders, hidden, plants, bush], texel);
  assert.ok(skip.includes(pebbles) && skip.includes(bush), 'pebbles and shrubs: no km-wide shadow');
  assert.ok(!skip.includes(boulders), 'a tile holding a 9 m boulder casts in the far map');
  assert.ok(!skip.includes(hidden), 'what is hidden is left alone');
  assert.ok(skip.includes(plants), 'plants keep their own rule');
  // self-lit
  const lit = (glow, ud = {}) => { const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { uGlow: { value: glow } } })); Object.assign(m.userData, ud); return m; };
  assert.equal(selfLitSkips(lit(0.3)), false, 'an ordinary surface casts');
  assert.equal(selfLitSkips(lit(1)), true, 'a flame or a lamp gives light, it does not block it');
  assert.equal(selfLitSkips(lit(0.8, { castShadow: true })), false, 'a glowing solid (the great crystal) casts');
  assert.equal(selfLitSkips(lit(0, { castShadow: false })), true, 'anything can opt out');
});
