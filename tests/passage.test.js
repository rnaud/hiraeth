import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// The hand-over into another space (src/passage.js): the rigid move, what it carries across (the
// walk, the heading, the feet, the camera's place behind you), the order of things (the destination
// drawn before the move, the move only once covered, the reveal once the new place has settled),
// the unseen draw itself, and main.js / the Lab / the Hangar going through it.

globalThis.window ??= { addEventListener() {} };
const { passageTransform, carryAcross, Passage, WarmDraw, PASSAGE, sheetPath, writesGBuffer, warmPasses } = await import('../src/passage.js');
const { makeMaterial } = await import('../src/materials.js');
const { Player, CameraRig } = await import('../src/player.js');

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearV = (a, b, eps = 1e-6) => a.distanceTo(b) < eps;
const DT = 1 / 60;
const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: () => v(0, 1, 0) };

test('passageTransform: what stood at the door facing in stands at the arrival facing its way, the rest kept round it', () => {
  const X = passageTransform({ from: v(10, 0, 0), fwdFrom: v(1, 0, 0), to: v(0, 100, 50), fwdTo: v(0, 0, -1) });
  assert.ok(nearV(X.point(v(10, 0, 0)), v(0, 100, 50)), 'the place itself');
  assert.ok(nearV(X.dir(v(1, 0, 0)), v(0, 0, -1)), 'the facing');
  // 4 m behind and 2 up: still 4 m behind (along the new facing) and 2 up
  assert.ok(nearV(X.point(v(6, 2, 0)), v(0, 102, 54)), 'a point behind stays behind');
  assert.ok(nearV(X.dir(v(0, 1, 0)), v(0, 1, 0)), 'up stays up');
  // a portal into the upside-down: up turns over, what was above you is still above you
  const F = passageTransform({ from: v(0, 0, 0), fwdFrom: v(0, 0, 1), to: v(0, 50, 0), upTo: v(0, -1, 0), fwdTo: v(0, 0, 1) });
  assert.ok(nearV(F.point(v(0, 2, -3)), v(0, 48, -3)), 'two metres overhead, three behind');
});

function walker() {
  const p = new Player(flat, { health: false });
  p.pos.set(0, 0, 0); p.onGround = true;
  return p;
}

test('carryAcross: still walking at the same speed, the new way, with nothing that reads as a turn or a stop', () => {
  const p = walker();
  for (let i = 0; i < 90; i++) p.update(DT, { KeyW: true }, Math.PI);   // walk +z (the camera behind)
  const speed = Math.hypot(p.vel.x, p.vel.z);
  assert.ok(speed > 2, `walking (${speed.toFixed(2)} m/s)`);
  p._lastHeading = p.heading;
  p.loco = { lastHeading: p.heading };
  p._moveDir = p.frame.dir(p.heading, v());
  const camera = new THREE.PerspectiveCamera(55, 1.5, 0.3, 5000);
  const rig = new CameraRig(camera, { addEventListener() {} }, flat);
  rig.yaw = p.heading + Math.PI + 0.3;   // a little off behind
  rig.target.copy(p.pos).add(v(0, 0, -0.2));   // lagging a little
  camera.position.copy(p.pos).add(v(1, 2.5, -6));
  camera.lookAt(p.pos.clone().add(v(0, 1.6, 0)));
  // the planted feet and the hands' swing, in the world
  p.humanoid = { _feet: { l: { pos: p.pos.clone().add(v(0.1, 0, 0.3)), yaw: v(0, 0, 1), n: v(0, 1, 0), step: null }, r: { pos: p.pos.clone().add(v(-0.1, 0, -0.2)), yaw: v(0, 0, 1), n: null, step: { from: p.pos.clone(), fromYaw: v(0, 0, 1) } } }, hands: { sides: [{ last: p.pos.clone().add(v(0.3, 1, 0)), vel: v(0, 0, 2) }] } };
  const before = { cam: camera.position.clone().sub(p.pos), look: camera.getWorldDirection(v()), feetL: p.humanoid._feet.l.pos.clone().sub(p.pos), hand: p.humanoid.hands.sides[0].last.clone().sub(p.pos) };
  const to = v(500, 1500, -20), heading = Math.PI / 2;   // arriving facing +x
  carryAcross(p, rig, camera, { to, heading });
  assert.ok(nearV(p.pos, to), 'there');
  assert.ok(near(p.heading, heading), 'facing the arrival way');
  assert.ok(near(Math.hypot(p.vel.x, p.vel.z), speed, 1e-6), 'the same speed (it used to land at a dead stop)');
  assert.ok(p.vel.x > speed * 0.99, 'along the new facing');
  assert.equal(p.onGround, true, 'still on the ground: no frame of falling');
  assert.ok(near(p._lastHeading, heading) && near(p.loco.lastHeading, heading), 'the animation sees no sudden turn');
  assert.ok(nearV(p._moveDir, v(1, 0, 0)), 'still steering straight ahead');
  // the camera: the same offset behind, above and beside, turned with you, looking the same way relative to you
  const turn = new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), heading - 0);
  assert.ok(nearV(camera.position.clone().sub(to), before.cam.clone().applyQuaternion(turn), 1e-5), 'the camera keeps its place behind you');
  assert.ok(nearV(camera.getWorldDirection(v()), before.look.applyQuaternion(turn), 1e-5), 'and its look');
  assert.ok(near(rig.yaw - p.heading, Math.PI + 0.3), 'the rig keeps its angle off your back');
  assert.ok(nearV(rig.target.clone().sub(to), v(-0.2, 0, 0), 1e-6), 'and its lag behind you');
  assert.equal(rig._lastP, null, 'the camera looks for the new walls at once');
  // the feet stay planted where they were relative to you, the hand's swing goes on
  assert.ok(nearV(p.humanoid._feet.l.pos.clone().sub(to), before.feetL.applyQuaternion(turn), 1e-6), 'a planted foot carried, not let go');
  assert.ok(nearV(p.humanoid._feet.l.yaw, v(1, 0, 0)), 'pointing the new way');
  assert.ok(nearV(p.humanoid._feet.r.step.from, to), 'a step under way carried');
  assert.ok(nearV(p.humanoid.hands.sides[0].vel, v(2, 0, 0)), 'the hand swings on');
  assert.ok(nearV(p.humanoid.hands.sides[0].last.clone().sub(to), before.hand.applyQuaternion(turn), 1e-6));
});

test('carryAcross: an asked-for speed (a portal flings you out) and a new gravity', () => {
  const p = walker();
  p.vel.set(0, 0, 3);
  const rig = new CameraRig(new THREE.PerspectiveCamera(), { addEventListener() {} }, flat);
  carryAcross(p, rig, rig.camera, { to: v(0, 50, 0), up: v(0, -1, 0), fwd: v(0, 0, 1), heading: 0, speed: 5 });
  assert.ok(nearV(p.frame.up, v(0, -1, 0)), 'the new up');
  assert.ok(nearV(p.vel, v(0, 0, 5)), 'flung out along the far portal');
  assert.ok(rig.camera.up.dot(v(0, -1, 0)) > 0.999, 'the camera upright in the new gravity');
});

/** A pretend cover and warm-up, keeping a log of what was asked when. */
function harness({ meshes = 3, busy = () => false } = {}) {
  const log = [];
  const cover = { cover: (s) => log.push(['cover', s]), reveal: (s) => log.push(['reveal', s]) };
  const list = Array.from({ length: meshes }, (_, i) => ({ id: i }));
  const warm = { near: () => list.slice(), draw: (l) => { log.push(['draw', l.length]); return l.length; } };
  const passage = new Passage({ cover, warm, busy, carry: (c) => log.push(['move', c.to]) });
  return { log, passage };
}

test('Passage: covered, the destination drawn, then the move; held while it settles; then revealed', () => {
  const { log, passage } = harness({ meshes: PASSAGE.perFrame + 5 });
  assert.equal(passage.go({ to: 'room', heading: 0 }), true);
  assert.equal(passage.go({ to: 'elsewhere' }), false, 'one at a time');
  assert.deepEqual(log[0], ['cover', PASSAGE.cover]);
  let t = 0;
  while (!log.some((e) => e[0] === 'move')) { passage.update(DT); t += DT; assert.ok(t < 2, 'it moves'); }
  assert.ok(t >= PASSAGE.cover, `not before the screen is covered (${t.toFixed(3)} s)`);
  const moveAt = log.findIndex((e) => e[0] === 'move');
  const drawn = log.slice(0, moveAt).filter((e) => e[0] === 'draw').reduce((s, e) => s + e[1], 0);
  assert.equal(drawn, PASSAGE.perFrame + 5, 'every mesh of the destination drawn before the move');
  assert.ok(log.slice(0, moveAt).every((e) => e[0] !== 'draw' || e[1] <= PASSAGE.perFrame), 'a slice a frame');
  assert.ok(!log.some((e) => e[0] === 'reveal'));
  passage.update(DT);
  assert.ok(!log.some((e) => e[0] === 'reveal'), 'held at least a couple of frames at the destination');
  for (let i = 0; i < PASSAGE.holdMin; i++) passage.update(DT);
  assert.ok(log.some((e) => e[0] === 'reveal'), 'then revealed');
  for (let i = 0; i < 40; i++) passage.update(DT);
  assert.equal(passage.active, false, 'and done');
  assert.equal(passage.moves, 1);
});

test('Passage: held while the first frames at the new place are slow, revealed once they are back to pace', () => {
  const { log, passage } = harness({ meshes: 0 });
  passage.go({ to: 'room' });
  while (!log.some((e) => e[0] === 'move')) passage.update(DT);
  for (let i = 0; i < 4; i++) passage.update(0.05);   // (dt is clamped to 1/20 s: a long frame)
  assert.ok(!log.some((e) => e[0] === 'reveal'), 'still covered through the slow frames');
  passage.update(DT); passage.update(DT);
  assert.ok(log.some((e) => e[0] === 'reveal'), 'revealed after two at pace');
});

test('Passage: the reveal waits for the new place to settle (its grass placed), but not for ever', () => {
  let placing = true;
  const { log, passage } = harness({ meshes: 0, busy: () => placing });
  passage.go({ to: 'room' });
  for (let i = 0; i < Math.ceil((PASSAGE.cover + 0.05) / DT); i++) passage.update(DT);
  assert.ok(log.some((e) => e[0] === 'move'));
  for (let i = 0; i < 10; i++) passage.update(DT);
  assert.ok(!log.some((e) => e[0] === 'reveal'), 'still covered while the grass is placed');
  placing = false;
  passage.update(DT);
  assert.ok(log.some((e) => e[0] === 'reveal'), 'revealed once it is');
  const b = harness({ meshes: 0, busy: () => true });
  b.passage.go({ to: 'room' });
  for (let i = 0; i < Math.ceil((PASSAGE.cover + PASSAGE.holdMax + 0.2) / DT); i++) b.passage.update(DT);
  assert.ok(b.log.some((e) => e[0] === 'reveal'), 'at most holdMax');
});

test('Passage.prepare: as you come near, the destination is drawn ahead a slice a frame, once', () => {
  const { log, passage } = harness({ meshes: PASSAGE.perFrame * 2 + 1 });
  const to = v(1, 2, 3);
  passage.prepare(to);
  passage.prepare(to);   // (the same place again: not gathered twice)
  for (let i = 0; i < 4; i++) passage.update(DT);
  assert.deepEqual(log.map((e) => e[1]), [PASSAGE.perFrame, PASSAGE.perFrame, 1]);
});

test('WarmDraw: hidden meshes drawn once, as a batch of their own, everything put back as it was', () => {
  const scene = new THREE.Scene();
  const room = new THREE.Group(); room.visible = false; room.position.set(0, 1000, 0); scene.add(room);
  const a = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); room.add(a);
  const b = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); b.visible = false; b.position.set(5, 0, 0); room.add(b);
  const far = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); far.position.set(0, 0, 3000); scene.add(far);
  scene.updateMatrixWorld();
  const calls = [];
  const renderer = {
    target: null,
    getRenderTarget() { return this.target; }, setRenderTarget(t) { this.target = t; },
    render(sc, cam) {
      const seen = [];
      sc.traverseVisible((o) => { if (o.isMesh) seen.push(o); });
      calls.push({ target: this.target, seen, override: sc.overrideMaterial, culled: seen.map((o) => o.frustumCulled), parents: seen.map((o) => o.parent), auto: sc.matrixWorldAutoUpdate, world: sc === scene });
    },
  };
  const override = new THREE.MeshBasicMaterial();
  const passes = [{ target: 'gbuffer', camera: new THREE.PerspectiveCamera() }, { target: 'shadow', camera: new THREE.OrthographicCamera(), override }];
  const W = new WarmDraw(renderer, scene, { passes });
  const list = W.near([v(0, 1000, 0)], 50);
  assert.deepEqual(new Set(list), new Set([a, b]), 'what is round the destination, hidden or not');
  assert.equal(W.draw(list), 2);
  assert.equal(calls.length, 2, 'one draw per pass');
  assert.deepEqual(calls.map((c) => c.target), ['gbuffer', 'shadow']);
  for (const c of calls) assert.deepEqual(new Set(c.seen), new Set([a, b]), 'only the batch, the hidden shown for it');
  assert.ok(calls.every((c) => !c.world && c.auto === false), 'a scene of its own (not a walk over the world), its matrices left as they are');
  assert.ok(calls.every((c) => c.parents.every((p) => p === room)), 'each keeps its parent');
  assert.equal(calls[1].override, override, 'the shadow pass in its depth material');
  assert.ok(calls.every((c) => c.culled.every((x) => x === false)), 'never culled away');
  assert.equal(room.visible, false, 'hidden again');
  assert.equal(b.visible, false);
  assert.ok(a.frustumCulled && b.frustumCulled, 'culled as before');
  assert.deepEqual(room.children, [a, b], 'still in its room');
  assert.equal(scene.overrideMaterial, null);
  assert.equal(W.draw(list), 0, 'each mesh only once');
  assert.deepEqual(W.near([v(0, 1000, 0)], 50), [], 'and not gathered again');
  assert.deepEqual(W.of(scene), [far], 'of(): the rest under a root');
});

test('the camera comes level indoors over a few tenths of a second, not in one jump', () => {
  const rig = new CameraRig(new THREE.PerspectiveCamera(55, 1.5, 0.3, 5000), { addEventListener() {} }, flat);
  rig.pitch = 0.9;   // looking steeply down from outside
  rig.update(v(), DT);
  rig.indoor = true;
  rig.update(v(), DT);
  assert.ok(rig.pitch > 0.7, `no jump on the first frame (${rig.pitch.toFixed(3)})`);
  for (let i = 0; i < 60; i++) rig.update(v(), DT);
  assert.ok(rig.pitch < 0.2, `level after a second (${rig.pitch.toFixed(3)})`);
});

test('the sheet: a ragged inked edge down each side, none along the top and bottom', () => {
  const p = sheetPath();
  assert.ok(p.fill.endsWith('Z') && p.left.startsWith('M') && p.right.startsWith('M'));
  const xs = (d) => [...d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => +m[1]);
  assert.ok(Math.max(...xs(p.left)) < 12 && Math.min(...xs(p.right)) > 112, 'each edge within its margin');
});

test('main.js, the Lab and the Hangar hand over through the passage; it is warmed at load', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /passage\.go\(\{ to: pt\.to, heading: pt\.heading \}\)/, 'the doorways');
  assert.doesNotMatch(main, /rig\._curDist = 2/, 'no camera snapped in close');
  assert.ok(main.indexOf('passage.update(dt)') < main.indexOf('player.update(pdt, busy()'), 'the move before the traveller and the camera move');
  assert.ok(main.indexOf('warmDraw.draw(') < main.indexOf("stage('ready')"), 'destinations drawn during the load');
  assert.match(main, /level\.update\(dt, t, \{[^}]*passage/, 'levels get the passage');
  const lab = readFileSync(new URL('../src/levels/lab.js', import.meta.url), 'utf8');
  assert.match(lab, /P\.go\(\{ to, heading, speed/);
  const garage = readFileSync(new URL('../src/levels/dismissed/hangar/level.js', import.meta.url), 'utf8');
  assert.match(garage, /P\.go\(\{ to: po\.to, up: po\.toUp, fwd: po\.toFwd/);
});

test('WarmDraw: the G-buffer pass takes only what writes all three targets (a hidden collision stand-in is a GL error there)', () => {
  const gbuf = new THREE.Mesh(new THREE.BoxGeometry(), makeMaterial({ color: '#c8483a', flat: true }));
  const proxy = new THREE.Mesh(new THREE.BoxGeometry().toNonIndexed(), new THREE.MeshBasicMaterial()); proxy.visible = false;
  assert.equal(writesGBuffer(gbuf), true, 'a surface of materials.js');
  assert.equal(writesGBuffer(proxy), false, 'a plain MeshBasicMaterial');
  const passes = warmPasses({ makeGBuffer: () => new THREE.WebGLRenderTarget(1, 1, { count: 3 }), shadowOverride: new THREE.MeshBasicMaterial() });
  assert.equal(passes[0].accepts, writesGBuffer, 'the G-buffer pass filters');
  assert.equal(passes[1].accepts, undefined, 'the shadow pass (one depth material for all) takes everything');
  const scene = new THREE.Scene(); scene.add(gbuf, proxy); scene.updateMatrixWorld();
  const seen = [];
  const renderer = { t: null, getRenderTarget() { return this.t; }, setRenderTarget(t) { this.t = t; }, render(sc) { seen.push([this.t, sc.children.slice()]); } };
  new WarmDraw(renderer, scene, { passes }).draw([gbuf, proxy]);
  assert.deepEqual(seen[0][1], [gbuf], 'into the G-buffer: only the surface');
  assert.deepEqual(new Set(seen[1][1]), new Set([gbuf, proxy]), 'into the shadow map: both');
  assert.equal(proxy.visible, false, 'the stand-in hidden again');
});
