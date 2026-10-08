// Wing drop's star gates can be flown through (src/minigames/wingdrop.js): a pilot going for one star
// (climbing in the first thermal for the high one, swinging out for the one off the line, S-turning down
// to the one on the final approach) threads it with the game's own glider, on every drop, for most rounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dropPlan, glideStep, newGlider, starPilot, landingShot, LANDING_SHOT, MESA } from '../src/minigames/wingdrop.js';
import { crossRing } from '../src/minigames/rings.js';

function fly(seed, i, only, dt = 1 / 60) {
  const plan = dropPlan(i, seed);
  const S = newGlider(plan.start, plan.heading);
  const got = new Set(), mem = { only };
  for (let t = 0; t < 240 && !S.landed; t += dt) {
    const p0 = S.pos.clone();
    glideStep(S, starPilot(S, plan, got, mem), dt, { wind: plan.wind, thermals: plan.thermals });
    plan.stars.forEach((st, k) => { if (!got.has(k) && crossRing(st, p0, S.pos) === 'pass') got.add(k); });
  }
  return got;
}

test('every star gate of every drop can be flown through', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
    const n = seeds.filter((seed) => fly(seed, i, k).has(k)).length;
    assert.ok(n >= 3, `drop ${i + 1}, star ${k + 1}: threaded in ${n} of ${seeds.length} rounds`);
  }
});

test('the star on the final approach is taken at 30 fps too', () => {
  const n = [1, 2, 3, 4].filter((seed) => fly(seed, 0, 2, 1 / 30).has(2)).length;
  assert.ok(n >= 3, `${n} of 4`);
});

test('the landing shot: up and back from the target, over you at the bullseye; the last drop leaves the middle to the results card', () => {
  const S = newGlider(new THREE.Vector3(MESA.x + 10, MESA.top, MESA.z), 0);
  const eye = new THREE.Vector3(), look = new THREE.Vector3();
  landingShot(S, false, eye, look);
  assert.ok(eye.y >= MESA.top + LANDING_SHOT.up - 1e-9, 'well above the mesa (not skimming it)');
  assert.ok(eye.x > S.pos.x + 5, 'on the far side of you from the middle');
  assert.ok(look.x < S.pos.x && look.x > MESA.x, 'looking over you toward the bullseye');
  // the last drop: you sit left of the middle of the picture
  const cam = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1000);
  const shot = (last) => {
    landingShot(S, last, eye, look);
    cam.position.copy(eye); cam.lookAt(look); cam.updateMatrixWorld();
    return S.pos.clone().setY(S.pos.y + 1).project(cam);
  };
  const mid = shot(false), last = shot(true);
  assert.ok(Math.abs(mid.x) < 0.25, `in the middle between drops (${mid.x.toFixed(2)})`);
  assert.ok(last.x < -0.45 && last.x > -0.95, `left of the results card on the last (${last.x.toFixed(2)})`);
  // landed in the bull: from in front of you
  const B = newGlider(new THREE.Vector3(MESA.x + 0.5, MESA.top, MESA.z), Math.PI / 2);
  landingShot(B, false, eye, look);
  assert.ok(eye.x > B.pos.x + 5, 'the way you face');
});
