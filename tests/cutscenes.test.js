import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship, doorPhases } from '../src/ship/ship.js';
import { R, HATCH, doorGeometry } from '../src/ship/hull.js';
import { buildSpace, rampPhases, rampSections, poseRamp } from '../src/ship/model.js';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';
import { THRUSTERS, exhaust, blast, BLAST_H } from '../src/ship/exhaust.js';
import { buildApproach, planetMaterial, MARK_IDS } from '../src/ship/approach.js';
import { PLANETS } from '../src/ship/planets.js';
import { ArrivalDirector, APPROACH, landingK, planetDistance, PLANET_NEAR } from '../src/ship/cinematics.js';
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
  const ship = quiet(() => new Ship({ scene, physics, level, levelId, content: { npcs: [], relics: { spots: [] } } }));
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

test('landing: the jets come out of the three bells, and the dust blows out along the ground from under them', () => {
  const { ship } = flatWorld();
  const m = ship.parked;
  const bells = THRUSTERS.map((p) => ship.world(m, p));
  for (const b of bells) assert.ok(b.y - ship.floorAt(b.x, b.z) < 0.6, 'the bells hang just over the ground when parked');
  // hovering 6 m up on its jets
  m.group.position.copy(ship.restPos).add(v(0, 6, 0));
  const dust = [], flame = [];
  ship.dust.emit = (p, vel) => dust.push({ p: p.clone(), v: vel.clone() });
  ship.flame.emit = (p, vel) => flame.push({ p: p.clone(), v: vel.clone() });
  for (let i = 0; i < 60; i++) exhaust(ship, m, 1 / 60, { power: 1, palette: ['#ccbb99'] });
  assert.ok(flame.length > 20 && dust.length > 20, `jets ${flame.length}, dust ${dust.length}`);
  const hover = THRUSTERS.map((p) => ship.world(m, p));
  for (const f of flame) {
    const near = Math.min(...hover.map((b) => Math.hypot(f.p.x - b.x, f.p.z - b.z)));
    assert.ok(near < 0.8 && f.p.y < hover[0].y && f.v.y < -5, 'each tongue of flame leaves a bell, downward');
  }
  for (const d of dust) {
    const r = Math.hypot(d.p.x - ship.restPos.x, d.p.z - ship.restPos.z);
    assert.ok(r < 6, `the dust starts under the bells (${r.toFixed(1)} m from the centre), not on a ring round the ship`);
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

test('the hatch door pops out of its frame and slides up over the hull, never through it', () => {
  const { ship } = flatWorld();
  const m = ship.parked;
  const { out } = doorGeometry();
  const P = out.attributes.position;
  let lastY = -Infinity;
  for (let i = 0; i <= 20; i++) {
    const k = i / 20;
    ship.setDoor(m, k);
    m.door.updateMatrix();
    let minR = Infinity, minY = Infinity;
    for (let j = 0; j < P.count; j += 7) {
      const p = v(P.getX(j), P.getY(j), P.getZ(j)).applyMatrix4(m.door.matrix);
      minR = Math.min(minR, p.length()); minY = Math.min(minY, p.y);
    }
    assert.ok(minR > R + 0.03, `k ${k}: outside the hull (${minR.toFixed(3)} vs ${R})`);
    assert.ok(minY >= lastY - 1e-6, `k ${k}: it only ever goes up`);
    lastY = minY;
  }
  assert.ok(lastY > HATCH.y1, 'open: clear of the doorway');
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
    return ship.world(m, v(0, 0, 0)).copy(v(L, 0, 0).applyMatrix4(last.matrixWorld));
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
