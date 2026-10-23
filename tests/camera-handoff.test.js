// Camera ownership at flight -> walking/gliding boundaries (#634).
// These are deterministic host camera-state transitions, not a full flight playthrough.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraRig, OPEN_PITCH, PITCH_SETTLE } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { cameraFollow } from '../src/host/game-host.js';
import { BIKE_SHOT } from '../src/bike.js';

globalThis.window ??= { addEventListener() {} };
function flightCamera(hz) {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  const rig = new CameraRig(camera, { addEventListener() {} }, new Physics(new THREE.Scene()));
  const player = {
    pos: new THREE.Vector3(0, 30, 0), vel: new THREE.Vector3(0, -5, 12),
    heading: 0, onJets: true, jetFlight: { pitch: -1.2 }, onGround: false,
  };
  const follow = cameraFollow({ rig, player });
  const trace = [];
  const tick = (seconds) => {
    for (let i = 0; i < Math.round(seconds * hz); i++) {
      follow(1 / hz); rig.update(player.pos, 1 / hz);
      trace.push({ time: rig._now, pitch: rig.pitch, yaw: rig.yaw });
    }
  };
  const exit = (gliding = false) => {
    player.onJets = false; player.gliding = gliding; player.onGround = !gliding;
    player.vel.set(0, 0, 0);
  };
  return { rig, player, tick, exit, trace };
}

for (const hz of [30, 60]) {
  test(`${hz} Hz: looking around on the hoverbike remains yours after dismounting`, () => {
    const { rig, player, tick } = flightCamera(hz);
    player.onJets = false; player.riding = true; player.ride = { heading: 0, shot: BIKE_SHOT };
    tick(4); assert.ok(Math.abs(rig.pitch - BIKE_SHOT.pitch) < 0.001, 'real bike shot has settled');
    rig.look(0, 160); const manual = rig.pitch; tick(0.2);
    player.riding = false; player.ride = null; player.onGround = true;
    tick(PITCH_SETTLE.time + 0.5);
    assert.equal(rig.pitch, manual, 'getting off does not level the manual view');
  });
  for (const gliding of [false, true]) {
    test(`${hz} Hz: manual look just before leaving jets survives return to ${gliding ? 'glide' : 'walking'}`, () => {
      const { rig, tick, exit } = flightCamera(hz);
      tick(4);
      assert.ok(rig.pitch > 0.6, 'the chase first owned the diving view');
      rig.look(0, -160);
      const manual = rig.pitch;
      tick(0.2); // look happened while still flying, not on/after the exit frame
      assert.equal(rig.pitch, manual, 'manual view holds during flight');
      exit(gliding); tick(PITCH_SETTLE.time + 0.5);
      assert.equal(rig.pitch, manual, 'landing does not take back a pitch the player already chose');
    });
  }
  test(`${hz} Hz: an unopposed chase still levels after landing, and can regain ownership after manual look`, () => {
    const { rig, tick, exit, trace } = flightCamera(hz);
    tick(4); rig.look(0, -160); tick(3);
    assert.ok(rig.pitch > 0.6, 'after the usual manual grace, the flight chase resumed');
    const start = trace.length, before = rig.pitch;
    exit(); tick(0.2);
    assert.ok(rig.pitch < before && rig.pitch > OPEN_PITCH + 0.1, 'return is eased, not snapped');
    tick(PITCH_SETTLE.time);
    assert.ok(Math.abs(rig.pitch - OPEN_PITCH) < 1e-6, 'automatic flight view still returns to walking framing');
    assert.ok(trace.slice(start).every((f, i, a) => !i || f.pitch <= a[i - 1].pitch + 1e-10), 'return never reverses direction');
  });
  test(`${hz} Hz: an explicit scene placement does not inherit flight pitch return`, () => {
    const { rig, player, tick, exit } = flightCamera(hz);
    tick(4); exit(); tick(0.2); // an automatic return is already underway
    rig.pitch = 0.31; rig.snapTight(player.pos); // same ordered placement API as ship wake-up
    tick(PITCH_SETTLE.time + 0.5);
    assert.equal(rig.pitch, 0.31, 'the newly authored shot keeps its pitch');
  });
  test(`${hz} Hz: recentering yaw keeps the manual flight-return pitch`, () => {
    const { rig, tick, exit } = flightCamera(hz);
    tick(4); rig.look(120, -160); tick(0.2); exit();
    const manual = rig.pitch;
    rig.recentre(0.8); tick(1.5);
    assert.ok(Math.abs(Math.atan2(Math.sin(rig.yaw - 0.8 - Math.PI), Math.cos(rig.yaw - 0.8 - Math.PI))) < 0.02, 'explicit recenter finishes behind the traveller');
    assert.equal(rig.pitch, manual, 'yaw recenter does not take pitch ownership');
  });
  test(`${hz} Hz: manual input after the flight handoff still cancels its remaining return`, () => {
    const { rig, tick, exit } = flightCamera(hz);
    tick(4); exit(); tick(0.2);
    rig.look(0, -40); const manual = rig.pitch;
    tick(PITCH_SETTLE.time + 0.5);
    assert.equal(rig.pitch, manual, 'fresh input remains in charge after the handoff');
  });
}
