import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { Crowd, holdAim } = await import('../src/crowd.js');
const { CROWD_POSES } = await import('../src/crowd-shader.js');
const { createBazaar } = await import('../src/levels/bazaar.js');
const { Dialogue } = await import('../src/story/dialogue.js');
const { clearTargets } = await import('../src/targets.js');

// "Pushing a character as I'm walking, or talking to them too close, makes them shake": walking
// into someone (nothing stops you) or talking nose to nose, the way to you was an atan2 of a few
// centimetres, and every small step swung them round and back; a crowd person stepping out of
// your way aimed straight away from you, so on their spot they flipped from side to side (their
// walk flickering on and off with it); a walker at the edge of the lane they keep clear stepped
// out of it and back every frame; and the conversation camera framed the line between you.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// small stick corrections: ±1.5 cm a frame, the same every run
const shuffler = () => { let r = 7; return () => { r = (r * 16807) % 2147483647; return (r / 2147483647 - 0.5) * 0.03; }; };
/** Total turning and the number of back-and-forth reversals of a list of headings. */
function wobble(hs) {
  let travel = 0, flips = 0;
  for (let i = 2; i < hs.length; i++) {
    const a = wrap(hs[i - 1] - hs[i - 2]), b = wrap(hs[i] - hs[i - 1]);
    travel += Math.abs(b);
    if (a * b < 0 && Math.abs(b) > 0.002) flips++;
  }
  return { travel, flips };
}
function flat() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  return { scene, physics: new Physics(scene) };
}

test('holdAim: follows you from afar, holds its way while you stand on top of them', () => {
  const o = {};
  assert.equal(holdAim(o, 'a', V(0, 0, 3), 3), 0);
  assert.ok(Math.abs(holdAim(o, 'a', V(3, 0, 0), 3) - Math.PI / 2) < 1e-9, 'tracks fully beyond 0.7 m');
  const held = o.a;
  assert.equal(holdAim(o, 'a', V(-0.05, 0, -0.02), 0.054), held, 'a few cm off: held');
});

for (const talking of [false, true]) {
  test(`a villager you walk into${talking ? ' and talk to' : ''} holds still while you shuffle inside them`, () => {
    const { scene, physics } = flat();
    const npc = new NPC(scene, physics, { route: [V(0, 0, 0)], cape: 0, lines: ['…'] });
    const player = { pos: V(0, 0, 1.6), vel: V(), riding: false, ride: null, wind: V() };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 2, 6);
    const noise = shuffler(), hs = [], heads = [];
    for (let f = 0; f < 480; f++) {
      const s = Math.min((f / 60) * 0.4, 1.7);   // creep in at 0.4 m/s to 10 cm past their middle
      player.pos.set(0, 0, 1.6 - s);
      if (s >= 1.7) { player.pos.x += noise(); player.pos.z += noise(); if (talking) npc.talkTo = { speaking: true }; }
      npc.update(1 / 60, player, camera);
      if (s >= 1.7 && f > 300) { hs.push(npc.heading); heads.push(npc.char.head.rotation.y); }
    }
    const w = wobble(hs), hw = wobble(heads);
    assert.ok(w.travel < 0.05 && w.flips < 3, `their heading: ${w.travel.toFixed(3)} rad of turning, ${w.flips} reversals`);
    assert.ok(hw.travel < 0.1, `their head: ${hw.travel.toFixed(3)} rad`);
  });
}

const bazaar = (() => { let c = null; return () => (c ??= (() => { const scene = new THREE.Scene(); const level = createBazaar(scene); return { scene, level, physics: new Physics(scene, level.ground.heightAt ? level.ground : null) }; })()); })();
function crowdOf() {
  clearTargets();
  const { scene, level, physics } = bazaar();
  return new Crowd(scene, physics, { spots: level.crowdSpots() });
}

test('a crowd person you push into steps round you, not through you, and stands still while you shuffle on their spot', () => {
  const crowd = crowdOf();
  const p = crowd.people.find((q) => !q.walk && q.pose === CROWD_POSES.stand && !q.group) ?? crowd.people.find((q) => !q.walk && q.pose === CROWD_POSES.stand);
  assert.ok(p, 'someone standing');
  const home = p.home.clone(), fwd = V(Math.sin(p.heading), 0, Math.cos(p.heading));
  const from = home.clone().addScaledVector(fwd, 1.6), noise = shuffler(), pp = V();
  let closest = Infinity, flick = 0, zig = 0, path = 0, last = null, lastStep = null, wasMoving = false;
  for (let f = 0; f < 600; f++) {
    const t = f / 60, s = Math.min(t * 0.4, 1.7);
    pp.copy(from).addScaledVector(fwd, -s);
    if (s >= 1.7) { pp.x += noise(); pp.z += noise(); }
    crowd.simulate(p, 1 / 60, t, pp, s < 1.7 ? 0.4 : 0.3, 20);
    closest = Math.min(closest, Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z));
    if (s >= 1.7 && t > 5.5) {
      const moving = p.speed > 0;
      if (last && moving !== wasMoving) flick++;
      wasMoving = moving;
      if (last) {
        const step = V(p.pos.x - last.x, 0, p.pos.z - last.z);
        path += step.length();
        if (lastStep && step.dot(lastStep) < 0 && step.length() > 0.002) zig++;
        lastStep = step;
      }
      last = p.pos.clone();
    }
  }
  assert.ok(closest > 0.6, `kept out of you as you came through (closest ${closest.toFixed(2)} m)`);
  assert.ok(zig < 5 && path < 0.15, `still while you shuffle: ${zig} zigzags, ${path.toFixed(2)} m of fidgeting`);
  assert.ok(flick < 3, `their walk doesn't flicker on and off (${flick} switches)`);
});

for (const [label, ahead, playerSpeed] of [['passing', 3, 2.5], ['stopping to greet you', 1.4, 0]]) {
  test(`a walker you stand near the edge of the path of (${label}) steps aside once, not in and out every frame`, () => {
    const crowd = crowdOf();
    const p = crowd.people.find((q) => q.walk && !q.walk.partner && !q.walk.route.column && q.walk.route.lateral >= 1);
    assert.ok(p, 'a walker');
    const t0 = 1;
    crowd.simulate(p, 1 / 60, t0, V(0, -500, 0), 0, 20);   // (walking along)
    const fwd = V(Math.sin(p.heading), 0, Math.cos(p.heading)), right = V(fwd.z, 0, -fwd.x);
    // you stand ahead near the edge of the lane they keep clear: judged from where the step had
    // taken them, it took them out of the lane and the fading step back in; turned to greet you,
    // judged along their heading (which is you), they swung from side to side
    const pp = p.pos.clone().addScaledVector(fwd, ahead).addScaledVector(right, -1.0);
    let zig = 0, lastD = null;
    const avoid = [];
    for (let f = 0; f < 240; f++) {
      crowd.simulate(p, 1 / 60, t0 + f / 60, pp, playerSpeed, 20);
      avoid.push(p.walk.avoid);
    }
    for (let i = 2; i < avoid.length; i++) {
      const d = avoid[i] - avoid[i - 1];
      if (lastD !== null && d * lastD < 0 && Math.abs(d) > 1e-4) zig++;
      lastD = d;
    }
    assert.ok(zig < 4, `${zig} reversals of their sidestep`);
  });
}

test('the conversation camera holds its shot when you stand nose to nose', () => {
  const d = new Dialogue({ game: null, quests: null });
  d.blend = 1;
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500);
  cam.position.set(0, 2.5, -4); cam.lookAt(0, 1.4, 0); cam.updateMatrixWorld();
  const player = { pos: V(0, 0, 0) }, npc = V(0.03, 0, 0.02), noise = shuffler();
  let path = 0, moved = 0;
  const last = V(), was = V();
  for (let f = 0; f < 240; f++) {
    was.copy(player.pos);
    player.pos.set(noise() * 0.5, 0, noise() * 0.5);   // (a hair of motion either side)
    last.copy(cam.position);
    d.frameCamera(cam, player, npc);
    if (f > 120) { path += cam.position.distanceTo(last); moved += player.pos.distanceTo(was); }
  }
  // (it may follow the midpoint between you, which moves half as much as you do; it must not swing round)
  assert.ok(path < moved * 0.75, `the camera moved ${path.toFixed(2)} m over 2 s while you shuffled ${moved.toFixed(2)} m`);
});
