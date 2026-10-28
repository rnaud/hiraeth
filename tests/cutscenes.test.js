import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship, doorPhases } from '../src/ship/ship.js';
import { HALF_W, HATCH, SHIP_SCALE, doorGeometry } from '../src/ship/hull.js';
import { buildSpace, rampPhases, rampSections, poseRamp } from '../src/ship/model.js';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';
import { THRUSTERS, exhaust, blast, BLAST_H } from '../src/ship/exhaust.js';
import { buildApproach, planetMaterial, MARK_IDS } from '../src/ship/approach.js';
import { PLANETS } from '../src/ship/planets.js';
import { ArrivalDirector, TakeoffDirector, APPROACH, landingK, planetDistance, PLANET_NEAR, callShot, callAngle, tableShot } from '../src/ship/cinematics.js';
import { TAKEOFF, LANDING, takeoffPose, landingPose, landingDur } from '../src/ship/flight.js';
import { inRooms } from '../src/ship/interior.js';
import { FlameBody, FIRE, COOL_FIRE } from '../src/story/flames.js';

// The ship's cutscenes and the desert's burning tree, from player feedback:
// the planet's pattern swam during the crash; take-off and landing smoke came from
// the wrong places; the hatch looked odd opening; between worlds there was no
// approach from space; the burning tree was many little 3D flames.

globalThis.window ??= { addEventListener() {} };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

function flatWorld(levelId = 'edena') {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId, content: { npcs: [] } }));
  return { scene, physics, ship };
}

test('the prologue planet keeps its bands as it turns past the window (object space, not world space)', () => {
  const m = makeMaterial({ color: '#efd29b', mode: MODE_STRATA, strataObject: true });
  assert.equal(m.defines.STRATA_OBJECT, 1);
  assert.ok(m.fragmentShader.includes('strata(vObjPos)'), 'the bands are taken from the object\'s own position');
  assert.ok(!makeMaterial({ color: '#efd29b', mode: MODE_STRATA }).defines.STRATA_OBJECT, 'mesas keep world bands');
  const planet = buildSpace().userData.planet;
  assert.equal(planet.material.defines.STRATA_OBJECT, 1, 'the planet in the prologue\'s window');
  assert.ok(m.fragmentShader.includes('wp.y > 900.0'), 'no cloud shadows drifting over it in orbit');
});

test('the ground under the ship is found from below the hull, not on top of it', () => {
  const { ship } = flatWorld();
  const c = ship.restPos;
  assert.ok(ship.groundAt(c.x + 2, c.z + 1) > 5, 'from above, the parked hull is in the way');
  for (const [dx, dz] of [[0, 0], [2.6, 0], [8, 3], [12.5, 0], [15, 4], [30, 0]]) {
    assert.ok(Math.abs(ship.floorAt(c.x + dx, c.z + dz)) < 0.4, `the ground at ${dx}, ${dz}: ${ship.floorAt(c.x + dx, c.z + dz).toFixed(2)}`);
  }
});

test('landing: the jets come out of the lift jets under the belly, and the dust blows out along the ground from under them', () => {
  const { ship } = flatWorld();
  const m = ship.parked;
  const bells = THRUSTERS.map((p) => ship.world(m, p));
  for (const b of bells) assert.ok(b.y - ship.floorAt(b.x, b.z) < 0.8, 'the bells hang just over the ground when parked');
  // hovering 6 m up on its jets
  m.group.position.copy(ship.restPos).add(v(0, 6, 0));
  const dust = [], flame = [];
  ship.dust.emit = (p, vel) => dust.push({ p: p.clone(), v: vel.clone() });
  ship.jets.emit = (p, vel) => flame.push({ p: p.clone(), v: vel.clone() });
  for (let i = 0; i < 60; i++) exhaust(ship, m, 1 / 60, { power: 1, palette: ['#ccbb99'] });
  assert.ok(flame.length > 20 && dust.length > 20, `jets ${flame.length}, dust ${dust.length}`);
  const hover = THRUSTERS.map((p) => ship.world(m, p));
  for (const f of flame) {
    const near = Math.min(...hover.map((b) => Math.hypot(f.p.x - b.x, f.p.z - b.z)));
    assert.ok(near < 0.8 && f.p.y < hover[0].y && f.v.y < -5, 'each tongue of flame leaves a bell, downward');
  }
  for (const d of dust) {
    const r = Math.hypot(d.p.x - ship.restPos.x, d.p.z - ship.restPos.z);
    const nearBell = Math.min(...THRUSTERS.map((p) => { const b = ship.world(m, p); return Math.hypot(d.p.x - b.x, d.p.z - b.z); }));
    assert.ok(r < 12 * SHIP_SCALE && nearBell < 4, `the dust starts under the bells (${nearBell.toFixed(1)} m from one), not on a ring round the ship`);
    assert.ok(d.p.y < 0.8, `on the ground (${d.p.y.toFixed(2)}), not on the hull`);
    assert.ok(Math.hypot(d.v.x, d.v.z) > 3 * Math.abs(d.v.y), 'blown flat along the ground');
  }
  // high up, the jets no longer reach the ground
  dust.length = 0;
  m.group.position.copy(ship.restPos).add(v(0, BLAST_H + 10, 0));
  for (let i = 0; i < 60; i++) exhaust(ship, m, 1 / 60, { power: 1, palette: ['#ccbb99'] });
  assert.equal(dust.length, 0);
  assert.ok(blast(0) === 1 && blast(BLAST_H) === 0 && blast(10) > blast(20));
});

test('coming down fast, the jets’ flame stays under the bells and never stands up through the hull (issue #89)', async () => {
  const { Puffs } = await import('../src/ship/fx.js');
  const { ship } = flatWorld();
  const m = ship.parked;
  ship.jets = new Puffs(new THREE.Scene(), { count: 400, glow: 1 });
  ship.jets.drag = 0;
  // the landing's way down, as cinematics.js plays it (src/ship/flight.js landingPose: the glide in, the hover, the drop),
  // its heights alone (over 150 m/s at first): every tongue of flame stays below the belly's bells, in the ship's frame
  const dt = 1 / 60;
  const radius = (p) => { const k = Math.min(p.age / p.life, 1); return p.size * Math.min(1, k * 6 + 0.25) * (1 + k * 1.4) * (1 - k ** 3); };   // (as Puffs.update draws it)
  let worst = -Infinity;
  for (let i = 0; i <= landingDur() * 60; i++) {
    const t = i * dt;
    const y = landingPose(t).up;
    m.group.position.copy(ship.restPos).add(v(0, y, 0));
    exhaust(ship, m, dt, { power: 1 });
    ship.jets.update(dt);
    // (the bells' mouths hang 0.5 m under the belly, BELLY in src/ship/hull.js: a tongue may swell round the mouth it leaves)
    const mouth = Math.min(...THRUSTERS.map((p) => ship.world(m, p).y)), belly = mouth + 0.5;
    for (const p of ship.jets.items) if (p.age < p.life) {
      worst = Math.max(worst, p.pos.y + radius(p) * 0.85 - belly);
      assert.ok(p.pos.y < mouth, `t ${t.toFixed(2)}: a tongue's middle ${(p.pos.y - mouth).toFixed(2)} m over the bells`);
    }
  }
  assert.ok(worst < 0, `the flame reaches ${worst.toFixed(2)} m over the belly`);
});

test('the hatch door pops out of its frame and slides along the hull, never through it', () => {
  const { ship } = flatWorld();
  const m = ship.parked;
  const { out } = doorGeometry();
  const P = out.attributes.position;
  let lastZ = Infinity;
  for (let i = 0; i <= 20; i++) {
    const k = i / 20;
    ship.setDoor(m, k);
    m.door.updateMatrix();
    let inner = -Infinity, maxZ = -Infinity;
    for (let j = 0; j < P.count; j++) {
      const p = v(P.getX(j), P.getY(j), P.getZ(j)).applyMatrix4(m.door.matrix);
      inner = Math.max(inner, p.x); maxZ = Math.max(maxZ, p.z);
    }
    assert.ok(inner < -HALF_W - 0.005, `k ${k}: outside the hull's side (${inner.toFixed(3)} vs ${-HALF_W})`);
    assert.ok(maxZ <= lastZ + 1e-6, `k ${k}: it only ever slides one way, forward`);
    lastZ = maxZ;
  }
  assert.ok(lastZ < HATCH.z0, 'open: clear of the doorway');
  assert.deepEqual(doorPhases(0), { pop: 0, slide: 0 });
  assert.ok(doorPhases(0.25).pop === 1 && doorPhases(0.25).slide < 0.05, 'it pops out before it slides');
});

test('the ramp slides out of the doorway, tips down, then telescopes to the ground', () => {
  const { ship } = flatWorld();
  const m = ship.parked, r = m.ramp, n = r.userData.sections.length;
  assert.equal(n, rampSections(r.userData.length));
  const end = (k) => {
    poseRamp(r, k);
    r.updateMatrixWorld(true);
    const last = r.userData.sections[n - 1];
    const L = r.userData.length - last.userData.reach;   // the last section's length
    return ship.world(m, v(0, 0, 0)).copy(v(L * (r.userData.axis ?? 1), 0, 0).applyMatrix4(last.matrixWorld));
  };
  poseRamp(r, 0); assert.equal(r.visible, false, 'stowed: out of sight');
  // slid out: level, nested, its tip just past the sill
  poseRamp(r, 0.3);
  assert.ok(r.quaternion.angleTo(new THREE.Quaternion()) < 1e-6, 'level while it slides out');
  assert.ok(r.userData.sections.every((s) => Math.abs(s.position.x) < 1e-6), 'the sections still nested');
  // down on the ground at the end, where the ramp's foot is
  const foot = end(1);
  const want = ship.rampFoot.clone().addScaledVector(ship.outDir, -1.6);
  assert.ok(foot.distanceTo(want) < 0.6, `the foot reaches the ground (${foot.distanceTo(want).toFixed(2)} m off)`);
  // the phases come in order and each eases
  const a = rampPhases(0.2, n), b = rampPhases(0.45, n), c = rampPhases(0.8, n);
  assert.ok(a.tilt === 0 && a.ext.every((e) => e === 0), 'slide first');
  assert.ok(b.slide === 1 && b.tilt > 0 && b.tilt < 1 && b.ext.every((e) => e === 0), 'then the tilt');
  assert.ok(c.tilt === 1 && c.ext[0] > 0, 'then the sections');
  assert.ok(c.ext.every((e, i) => i === 0 || e <= c.ext[i - 1]), 'each one after the one before');
  assert.deepEqual(rampPhases(1, n).ext, new Array(n - 1).fill(1));
});

test('every world has its own planet for the approach, in the map\'s colours', () => {
  for (const [id, p] of Object.entries(PLANETS)) {
    const m = planetMaterial(id);
    assert.equal(m.uniforms.uKind.value, MARK_IDS[p.mark], id);
    assert.equal('#' + m.uniforms.uBody.value.getHexString(), p.body, id);
    assert.equal(m.uniforms.uGlow?.value, 1, `${id}: self-lit, no shadow`);
  }
  const a = buildApproach('arzach2');
  assert.ok(a.planet.children.length >= 3, 'a ringed world shows its ring');
});

test('arriving by ship opens with a short approach from space, and holding skip cleans it all away', () => {
  const { ship } = flatWorld('incal');
  ship.player = new Player(ship.physics);
  ship.rig = { yaw: 0, pitch: 0.2, target: v(), indoor: false };
  ship.camera = new THREE.PerspectiveCamera();
  ship.sound = {};   // (no audio in node)
  const total = APPROACH.space + APPROACH.entry + APPROACH.sky;
  assert.ok(total >= 5 && total <= 8, `the approach takes ${total.toFixed(1)} s`);
  const d = new ArrivalDirector(ship);
  let ready = false;
  ship.onReady = () => { ready = true; };
  d.start();
  assert.ok(ship.approach, 'space round the ship');
  const sizes = [];
  for (let t = 0; t < APPROACH.space + APPROACH.entry - 0.1; t += 1 / 30) { d.update(1 / 30, false); if (ship.approach) sizes.push(ship.approach.planet.scale.x / ship.approach.planet.position.clone().add(ship.approach.group.position).distanceTo(ship.cam.pos)); }
  assert.ok(sizes.at(-1) > sizes[0] * 5, 'the planet grows in the view as the ship comes in');
  assert.ok(ship.parked.group.position.y > ship.restPos.y + 1000, 'still in space');
  for (let t = 0; t < 0.3; t += 1 / 30) d.update(1 / 30, false);
  assert.equal(ship.approach, null, 'through the air: space is put away');
  assert.ok(ship.parked.group.position.y > ship.restPos.y + 140, 'falling through the sky, above the landing');
  for (let i = 0; i < 40; i++) d.update(1 / 30, true);   // hold skip
  assert.ok(d.done && ready);
  assert.ok(ship.parked.group.position.distanceTo(ship.restPos) < 1e-6, 'parked');
  assert.equal(ship.parked.doorK, 1);
});

test('arriving at another world is a landing, not a crash: no shaking, nothing burning, at rest on its feet', () => {
  const { ship } = flatWorld('incal');
  ship.player = new Player(ship.physics);
  ship.rig = { yaw: 0, pitch: 0.2, target: v(), indoor: false };
  ship.camera = new THREE.PerspectiveCamera();
  ship.sound = {};
  const said = [];
  const say = ship.cinema.say.bind(ship.cinema);
  ship.cinema.say = (l, o) => { if (l) said.push(l.text); return say(l, o); };
  const d = new ArrivalDirector(ship);
  ship.onReady = () => {};
  d.start();
  let shake = 0, last = null, speed = 0;
  for (let t = 0; t < 30 && !d.done; t += 1 / 30) {
    d.update(1 / 30, false);
    shake = Math.max(shake, ship.shakeK);
    const y = ship.parked.group.position.y;
    assert.ok(Number.isFinite(y), `the ship is somewhere at step ${d.i}`);
    if (d.down && last !== null && speed === 0) speed = (last - y) * 30;   // the speed it touched down at
    last = y;
    if (d.down && ship.auto) ship.auto = null;   // (the walk out: let it end)
  }
  assert.ok(d.down, 'it touched down');
  assert.equal(shake, 0, 'no shaking anywhere in the arrival');
  assert.ok(speed < 1, `it settles onto its feet (${speed.toFixed(2)} m/s at touchdown)`);
  assert.ok(!said.some((t) => /crash|hull breach|emergency/i.test(t)), `nothing about a crash: ${said.join(' | ')}`);
  assert.ok(landingK(0) === 0 && landingK(1) === 1 && landingK(0.99) > 0.9999, 'the last of the descent arrives at rest');
});

test('touchdown: the blown dust settles and the ship’s feet read within a second (QC v1.66, issue #299)', () => {
  const { ship } = flatWorld('incal');
  ship.player = new Player(ship.physics);
  ship.rig = { yaw: 0, pitch: 0.2, target: v(), indoor: false };
  ship.camera = new THREE.PerspectiveCamera();
  ship.sound = {};
  const d = new ArrivalDirector(ship);
  ship.onReady = () => {};
  d.start();
  const radius = (p) => { const k = Math.min(p.age / p.life, 1); return p.size * Math.min(1, k * 6 + 0.25) * (1 + k * 1.4) * (1 - k ** 3); };
  const feet = () => (ship.parked.hull?.feet ?? []).map((f) => f.clone().applyMatrix4(ship.parked.group.matrixWorld));
  let down = null, most = 0, after = 0;
  for (let t = 0; t < 30 && !d.done; t += 1 / 30) {
    d.update(1 / 30, false);
    ship.dust.update(1 / 30);
    if (d.down && down === null) { down = t; most = ship.dust.items.filter((p) => p.age < p.life).length; }
    if (down !== null && t - down >= 1 && !after) {
      after = 1;
      const live = ship.dust.items.filter((p) => p.age < p.life);
      for (const p of live) {
        const near = Math.min(...feet().map((f) => f.distanceTo(p.pos)));
        assert.ok(radius(p) < 0.45 || near > 6, `a second on, no boulder of dust by the feet (${radius(p).toFixed(2)} m, ${near.toFixed(1)} m off a foot)`);
      }
    }
    if (d.down && ship.auto) ship.auto = null;
  }
  assert.ok(down !== null && most > 10, `it touched down in its own dust (${most} puffs)`);
  assert.ok(after, 'and was watched a second on');
});

test('the burning tree is one great 3D flame with a living fire shader, and still flares and turns cool for the feast', () => {
  const group = new THREE.Group();
  const f = new FlameBody(group, { at: v(0, 20, 0), width: 40, height: 50 });
  assert.equal(group.children.length, 1, 'one flame');
  assert.equal(f.group.children.length, 3, 'three nested shells: the red outside, the body, the pale heart');
  for (const m of f.group.children) assert.ok(m.geometry.attributes.position.count > 400, 'a real shape, not a card');
  assert.equal(f.material.uniforms.uGlow.value, 1, 'self-lit: it glows and casts no shadow');
  assert.ok(f.material.vertexShader.includes('fbm3') && f.material.fragmentShader.includes('discard'), 'tongues lifted by noise, opening at the top');
  f.intensity = 2.6;
  for (let i = 0; i < 60; i++) f.update(1 / 60, i / 60);
  assert.ok(f.material.uniforms.uK.value > 2.2, 'a flare makes it bigger and hotter');
  f.setPalette(COOL_FIRE);
  for (let i = 0; i < 200; i++) f.update(1 / 60, i / 60);
  assert.equal('#' + f.material.uniforms.uPal.value[1].getHexString(), COOL_FIRE[1], 'the feast: cool fire');
  f.setPalette(FIRE, true); f.update(0, 0);
  assert.equal('#' + f.material.uniforms.uPal.value[0].getHexString(), FIRE[0]);
});

test('the approach planet\'s face never comes in front of the ship, however big it grows (the cinematics QC pass)', () => {
  for (const ang of [0.05, 0.4, 0.9, 1.2, 1.32]) {
    const D = planetDistance(700, ang);
    assert.ok(D * (1 - Math.sin(ang)) >= PLANET_NEAR - 1e-6, `near surface at ${(D * (1 - Math.sin(ang))).toFixed(0)} m for ${ang}`);
    assert.ok(D * Math.cos(ang) < 5000, 'its visible face stays inside the far plane');
  }
  assert.equal(planetDistance(1250, 0.08), 1250, 'small and far: unchanged');
});

test('the shots inside the ship stay in its rooms, the lens clear of every wall (the recordings, the course set at the table)', () => {
  const { physics, ship } = flatWorld();
  const m = ship.parked, P = m.interior.points;
  ship.player = new Player(physics);
  const check = (name, shot) => {
    const l = ship.local(m, shot.pos);
    assert.ok(inRooms(l, { margin: -0.15 }), `${name}: the camera in the rooms (${l.toArray().map((n) => n.toFixed(2))})`);
    for (const d of [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)]) {
      assert.ok(physics.rayDistance(shot.pos, d, 0.25) >= 0.25 - 1e-6, `${name}: the lens 25 cm clear of everything`);
    }
    // and what it looks at is in sight (nothing solid in between)
    const to = shot.look.clone().sub(shot.pos), len = to.length();
    assert.ok(physics.rayDistance(shot.pos, to.normalize(), len - 0.6) >= len - 0.6 - 1e-6, `${name}: the subject in sight`);
  };
  for (const t of [0, 5]) for (const close of [0, 1]) check(`call ${t} ${close}`, callShot(ship, m, t, close));
  for (const a of ['bust', 'listen', 'window']) check(a, callAngle(ship, m, a, 3));
  // the course set at the holo table, wherever he stands: by it on either side, at the dash, outside by the ramp
  for (const at of [P.tableFoot.clone().add(v(1.1, 0, 0)), P.tableFoot.clone().add(v(-1.1, 0, 0.4)), P.cockpit]) {
    ship.player.pos.copy(ship.world(m, at));
    check(`table from ${at.toArray().map((n) => n.toFixed(1))}`, tableShot(ship, m, 1));
  }
  ship.player.pos.copy(ship.rampFoot);
  check('table, him outside', tableShot(ship, m, 1));
});

// ------------------------------------------------------------------ issue #354: up on the jets, then forward; the reverse to land
test('the take-off: straight up on its jets to a hover first, then tipped forward and away along its bow (issue #354)', () => {
  const dt = 1 / 60;
  let last = takeoffPose(0), most = 0;
  for (let t = dt; t <= TAKEOFF.dur + 1e-9; t += dt) {
    const p = takeoffPose(t);
    if (t <= TAKEOFF.rise) assert.equal(p.ahead, 0, `t ${t.toFixed(2)}: only up while it lifts off`);
    // (no jump anywhere: its speed changes smoothly from frame to frame)
    most = Math.max(most, Math.hypot(p.ahead - last.ahead, p.up - last.up) / dt);
    assert.ok(Math.abs(p.pitch - last.pitch) < 0.02, `t ${t.toFixed(2)}: the nose turns smoothly`);
    last = p;
  }
  assert.ok(Math.abs(takeoffPose(TAKEOFF.rise).up - TAKEOFF.hover) < 1e-9, 'it hangs at its hover');
  assert.ok(takeoffPose(TAKEOFF.rise + 0.3).pitch < -0.05, 'the nose dips as it tips forward');
  assert.ok(takeoffPose(TAKEOFF.dur).pitch > 0, 'and comes up as it climbs away');
  const end = takeoffPose(TAKEOFF.dur), atWarp = takeoffPose(TAKEOFF.warp);
  assert.ok(end.ahead > 2 * end.up, `forward more than up (${end.ahead.toFixed(0)} m ahead, ${end.up.toFixed(0)} up)`);
  assert.ok(atWarp.ahead > 100, `well away when the warp opens (${atWarp.ahead.toFixed(0)} m)`);
  assert.ok(most < 250, `${most.toFixed(0)} m/s at most`);
});

test('the landing: in nose first along its bow, a hover over its spot, then straight down onto its feet (issue #354)', () => {
  const dt = 1 / 60, T = landingDur();
  let last = landingPose(0);
  assert.ok(last.back > 200 && last.up > 140, 'it starts far back and high, out of the clouds');
  for (let t = dt; t <= T + 1e-9; t += dt) {
    const p = landingPose(t);
    assert.ok(p.back <= last.back + 1e-9 && p.up <= last.up + 1e-9, `t ${t.toFixed(2)}: only ever in and down`);
    if (t >= LANDING.glide) assert.equal(p.back, 0, `t ${t.toFixed(2)}: over its spot, straight down`);
    assert.ok(Math.abs(p.pitch - last.pitch) < 0.02, 'the flare comes and goes smoothly');
    last = p;
  }
  assert.ok(landingPose(LANDING.glide * 0.6).pitch > 0.1, 'its nose flared up as it brakes');
  assert.ok(Math.abs(landingPose(LANDING.glide).up - LANDING.hover) < 1e-9 && landingPose(LANDING.glide).pitch < 1e-9, 'level, at its hover');
  const s = (landingPose(T - 0.1).up - landingPose(T - 0.1 + dt).up) / dt;
  assert.ok(s < 1, `onto its feet with next to no speed (${s.toFixed(2)} m/s)`);
  assert.equal(landingPose(T).up, 0);
});

test('the take-off as the director plays it: up off its feet with no step forward, then away along its bow, and the warp (issue #354)', () => {
  const { ship } = flatWorld('incal');
  ship.player = new Player(ship.physics);
  ship.rig = { yaw: 0, pitch: 0.2, target: v(), indoor: false };
  ship.camera = new THREE.PerspectiveCamera();
  ship.sound = {};
  let warped = false, done = false;
  ship.warp = { start: () => { warped = true; }, update() {} };
  const fwd = v(0, 0, -1).applyQuaternion(ship.restQuat).setY(0).normalize();
  const d = new TakeoffDirector(ship, { to: 'edena', title: 'Edena', onDone: () => { done = true; } });
  d.start();
  const at = () => ship.parked.group.position.clone().sub(ship.restPos);
  let lifted = null, gone = null;
  for (let t = 0; t < 12 && !d.done; t += 1 / 30) {
    d.update(1 / 30, false);
    if (d.i !== 1) continue;
    const p = at();
    if (d.t <= TAKEOFF.rise) assert.ok(Math.hypot(p.x, p.z) < 1e-6, `straight up while it lifts (${Math.hypot(p.x, p.z).toFixed(3)} m aside)`);
    if (d.t >= TAKEOFF.rise - 1 / 30 && lifted === null) lifted = p.y;
    gone = p;
  }
  assert.ok(lifted > TAKEOFF.hover * 0.9, `it hovered ${lifted?.toFixed(1)} m up`);
  assert.ok(gone.dot(fwd) > 150 && gone.dot(fwd) > 2 * gone.y, `then away along its bow (${gone.dot(fwd).toFixed(0)} m ahead, ${gone.y.toFixed(0)} up)`);
  assert.ok(warped && done, 'then the warp, and on to the next world');
});

