// Moving solids with a shape (src/carriers.js solidTop; docs/systems/movement.md "Contact"): a cab's hull and
// canopy and a rolling ball's dome, where each was a disc at its crest (you stood 1.4 m over a cab's nose, on air
// at a ball's side). What you stand on is what is drawn, and walking into one stops you at its side.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { Taxi } = await import('../src/taxi.js');
const { Physics } = await import('../src/physics.js');
const { Player } = await import('../src/player.js');
const { solidTop } = await import('../src/carriers.js');
const { LEVELS } = await import('../src/levels/index.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

function cabWorld(scale = 2) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(80, 1, 80).translate(0, -0.5, 0), new THREE.MeshBasicMaterial()));
  const physics = new Physics(scene);
  const cab = new Taxi(physics, '#5fb7ad', scale, (t, c) => { c.pos.set(0, 2.5, 0); c.heading = 0.4; c.bank = 0; c.pitch = 0; });
  scene.add(cab.object);
  cab.update(DT, null, 0);
  cab.object.updateMatrixWorld(true);
  return { scene, physics, cab };
}
const drawnTop = (obj, x, z) => {
  const rc = new THREE.Raycaster(V(x, 50, z), V(0, -1, 0));
  const meshes = [];
  obj.traverse((o) => { let shown = true; for (let p = o; p; p = p.parent) if (p.visible === false) shown = false; if (o.isMesh && shown) meshes.push(o); });
  return rc.intersectObjects(meshes, false)[0]?.point.y ?? -Infinity;
};

test('a cab’s top is the drawn cab’s: its hull, its canopy and sign, not a disc at the canopy’s crest', () => {
  const { cab } = cabWorld(2);
  const d = cab.solid;
  let n = 0, near = 0;
  for (let i = 0; i < 400; i++) {
    const x = cab.pos.x + ((i % 20) / 9.5 - 1) * d.r, z = cab.pos.z + (Math.floor(i / 20) / 9.5 - 1) * d.r;
    const t = solidTop(d, x, z), g = drawnTop(cab.object, x, z);
    if (!Number.isFinite(t) || !Number.isFinite(g)) continue;
    n++;
    if (Math.abs(t - g) < 0.06) near++;
  }
  assert.ok(n > 80, `points over the cab: ${n}`);
  assert.ok(near / n > 0.9, `${near} of ${n} within 6 cm of the drawn top (the rest on the canopy's and the hull's edges)`);
  // over the nose: the hull, a metre and more under where the disc's top was
  const nose = cab.object.localToWorld(V(0, 0, 1.6));
  assert.ok(d.top - solidTop(d, nose.x, nose.z) > 1, 'the nose is low');
});

test('the traveller dropped on a cab stands on what is drawn there, and walking into its flank stops at the hull', () => {
  const { physics, cab } = cabWorld(2);
  for (const lz of [1.5, -1.5, -0.25]) {   // the nose, the stern, the canopy
    const at = cab.object.localToWorld(V(0, 0, lz));
    const P = new Player(physics, { health: false, dynamic: () => [cab] });
    P.respawn(V(at.x, cab.pos.y + 5, at.z));
    P.onGround = false;
    for (let f = 0; f < 120; f++) { P.update(DT, {}, 0); cab.update(DT, null, f * DT); }
    const g = drawnTop(cab.object, P.pos.x, P.pos.z);
    assert.ok(Math.abs(P.pos.y - g) < 0.12, `at ${lz}: the feet ${(P.pos.y - g).toFixed(2)} m off the drawn top`);
  }
  // beside it on the floor, walking at its middle from the side
  const side = cab.object.localToWorld(V(4, 0, -0.25)), mid = cab.object.localToWorld(V(0, 0, -0.25));
  const P = new Player(physics, { health: false, dynamic: () => [cab] });
  P.respawn(V(side.x, 0, side.z));
  const to = mid.clone().sub(side).setY(0).normalize(), yaw = Math.atan2(-to.x, -to.z);
  let inside = 0, closest = Infinity;
  const R = 0.4 / cab.scale;
  for (let f = 0; f < 180; f++) {
    P.update(DT, { KeyW: true }, yaw); cab.update(DT, null, f * DT);
    const l = cab.object.worldToLocal(P.pos.clone());
    inside = Math.max(inside, 1 - Math.hypot(l.x / (0.92 + R), (l.z - 0.05) / (2.05 + R)));
    closest = Math.min(closest, Math.hypot(P.pos.x - cab.pos.x, P.pos.z - cab.pos.z));
  }
  assert.ok(inside < 0.02, `never into the hull (${inside.toFixed(3)})`);
  assert.ok(closest < 1.45 * 2 + 0.4 - 0.5, `up to the hull's side, ${closest.toFixed(2)} m from its middle (the old cylinder stopped you ${(1.45 * 2 + 0.4).toFixed(2)} m out)`);
});

test('a rolling ball’s top is a dome: on its crest you stand on the stone, a little way down its side lower', () => {
  const scene = new THREE.Scene();
  const level = LEVELS.find((l) => l.id === 'arzach2').create(scene);
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  level.init?.(physics);
  const ball = level.temple.pieces.find((p) => p.solid?.topAt && p.spin);
  assert.ok(ball, 'a ball in the Belfry');
  const c = ball.center, r = ball.r;
  for (const [f, want] of [[0, c.y + r], [0.5, c.y + Math.sqrt(r * r - (0.5 * r) ** 2)]]) {
    const P = new Player(physics, { health: false, dynamic: () => [ball] });
    P.respawn(V(c.x + f * r, c.y + r + 2, c.z));
    P.onGround = false;
    for (let i = 0; i < 90; i++) P.update(DT, {}, 0);
    assert.ok(Math.abs(P.pos.y - want) < 0.08, `${f} r out: the feet at ${(P.pos.y - c.y).toFixed(2)} over its centre (the stone ${(want - c.y).toFixed(2)})`);
  }
});
