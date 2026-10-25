import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { FINALE, finaleShots, keeperBox, wayOut } from '../src/temples/finale.js';
import { V, house, standBy, blocker, inFrame } from './temple-finale-house.js';

test('the Whale-House’s purse: close over it from the far side of the Listener’s shell, the chimes in the frame (#562)', () => {
  const { rt } = house('underwater');
  standBy(rt);
  const film = finaleShots(rt), B = film.shots[1];
  assert.ok(film.picked.reward, 'a lens found');
  const chimes = film.at.reward.clone().setY(film.at.reward.y + 0.3);
  for (const c of [B.from, B.to]) {
    assert.ok(c.pos.distanceTo(chimes) < 8, `close to the chimes (${c.pos.distanceTo(chimes).toFixed(1)} m; the shell's underside filled the frame from 11 m)`);
    assert.ok(inFrame(c, chimes), 'the chimes in the frame');
    assert.ok(!keeperBox(rt.guardian.model).containsPoint(c.pos), 'out of its body');
  }
});

// (issue #567) The Whale-House's way out: the Listener settles on its shell five metres before the door, and D was framed
// past it, the shell half the frame and a pod before the door. Now (FINALES.underwater.way.clear) the doorway is whole in
// the frame, nothing drawn before it, and the keeper's body as it stands through D clear of it.
test('the Whale-House’s way out: framed clear of the Listener’s shell (#567)', () => {
  const { rt } = house('underwater');
  standBy(rt);
  const film = finaleShots(rt), D = film.shots[3], way = wayOut(rt);
  assert.ok(film.picked.way, 'a lens found that frames the door clear');
  const tD = FINALE.keeper + FINALE.reward + FINALE.house, n = film.axis, across = V(-n.z, 0, n.x), dh = way.piece.h ?? 6, door = way.piece.group.position;
  const pts = [-1.2, -0.6, 0, 0.6, 1.2].flatMap((s) => [0.15, 0.45, 0.75].map((h) => door.clone().addScaledVector(across, s).addScaledVector(V(0, 1, 0), dh * h).addScaledVector(n, 0.3)));
  const ray = new THREE.Ray(), hit = V();
  let behind = 0;
  for (const k of [0, 0.5, 1]) {
    const cam = D.from.pos.clone().lerp(D.to.pos, k), body = film.bodyAt(tD + k * FINALE.way);
    for (const q of pts) { ray.set(cam, q.clone().sub(cam).normalize()); if (ray.intersectBox(body, hit) && hit.distanceTo(cam) < cam.distanceTo(q)) behind++; }
    assert.equal(blocker(rt, cam, door.clone().addScaledVector(n, 0.3).addScaledVector(V(0, 1, 0), dh * 0.45), [way.piece.group]), null, 'nothing drawn before the doorway');
  }
  assert.equal(behind, 0, `the doorway clear of the keeper's body (${behind} of ${pts.length * 3} sight lines through it; 27 before)`);
});


