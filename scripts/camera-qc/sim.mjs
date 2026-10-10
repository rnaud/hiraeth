// The camera QC's walk without a browser (.claude/skills/camera-qc/SKILL.md): a traveller moved along waypoints at a
// walking or running pace, the real CameraRig following him through the real collision, recorded as the browser run
// records (scripts/camera-qc/lib.mjs samples). Quick to run in node: the tests use it on the Overnight Train's carriages
// (tests/camera-qc.test.js), and it is the loop to try a fix in before the browser run confirms it.
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);

/**
 * Walk `path` ([[x, z] | [x, y, z] | { wait: s }, …]; y from the collision, the floor under the point) at `speed` m/s, the camera
 * turned after the way at up to `steer` deg/s (0: never), `dt` a frame. `turns`: [{ at (s), for (s), rate (deg/s) }],
 * the camera turned by hand while walking. `stand` (s) at the start and the end. Returns the samples.
 */
export function walk(rig, physics, camera, path, { speed = 3.8, steer = 120, dt = 1 / 60, turns = [], stand = 0.5, yaw = null, floor = null } = {}) {
  const at = (p) => {
    const y = p.length === 3 ? p[1] : floor ?? physics.groundAt(p[0], 30, p[p.length - 1], 60);
    return new THREE.Vector3(p[0], y, p[p.length - 1]);
  };
  const pos = at(path[0]);
  pos.y = floor ?? physics.groundAt(pos.x, pos.y + 1.5, pos.z, 4);
  if (yaw != null) rig.yaw = yaw;
  rig._lastP = null;
  rig.update(pos, dt, null);
  for (let i = 0; i < 30; i++) rig.update(pos, dt, null);   // (settled where he starts)
  const S = [], fwd = new THREE.Vector3(), up = Y;
  const head = new THREE.Vector3(), chest = new THREE.Vector3(), n = new THREE.Vector3(), to = new THREE.Vector3();
  let t = 0, wp = 1, still = stand, end = stand, steerRate = 0;
  const ndc = (p) => { n.copy(p).project(camera); return n.z > 1 ? null : [n.x, n.y]; };
  for (let f = 0; f < 60 * 600; f++) {
    // the traveller: toward the next waypoint at the pace, held on the floor
    let want = null;
    if (still > 0) still -= dt;
    else if (wp < path.length && path[wp].wait) { still = path[wp].wait; wp++; }
    else if (wp < path.length) {
      const goal = at(path[wp]);
      const d = new THREE.Vector3(goal.x - pos.x, 0, goal.z - pos.z), L = d.length();
      if (L < speed * dt + 1e-3) { pos.x = goal.x; pos.z = goal.z; wp++; }
      else { want = d.divideScalar(L); pos.addScaledVector(want, speed * dt); }
      const g = physics.groundAt(pos.x, pos.y + 1.2, pos.z, 3);
      if (Number.isFinite(g)) pos.y = g;
    } else if ((end -= dt) <= 0) break;
    // the hands: the camera turned after the way, and by hand
    let cmdYaw = 0;
    const y0 = rig.yaw;
    if (want && steer) {
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const err = Math.atan2(want.x * fwd.z - want.z * fwd.x, want.dot(fwd));
      const goal = Math.min(Math.abs(err) * 2.5, (steer * Math.PI) / 180) * Math.sign(err);
      steerRate += (goal - steerRate) * (1 - Math.exp(-8 * dt));   // (a thumb on the stick: it doesn't jump to full turn)
      rig.yaw += steerRate * dt;
    }
    for (const tr of turns) if (t >= tr.at && t < tr.at + tr.for) rig.yaw += (tr.rate * Math.PI / 180) * dt;
    if (rig.yaw !== y0) rig._lastMouse = rig._now;   // (a hand on the stick: the rig doesn't swing it about meanwhile)
    cmdYaw = rig.yaw - y0;
    t += dt;
    rig.update(pos, dt, null);
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(fwd);
    head.copy(pos).addScaledVector(up, 1.6); chest.copy(pos).addScaledVector(up, 1.1);
    to.copy(head).sub(camera.position); const Lh = to.length();
    let clear = 1;
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) clear = Math.min(clear, physics.rayDistance(camera.position, n.set(...d), 1));
    S.push({
      t, dt, cam: camera.position.toArray(), look: rig._look.toArray(), pos: pos.toArray(), fwd: fwd.toArray(), cmdYaw, cmdPitch: 0, clear,
      occl: Lh > 0.4 && physics.rayDistance(camera.position, to.divideScalar(Lh), Lh) < Lh - 0.25,
      head: ndc(head), chest: ndc(chest), tight: rig.tightK, side: rig._side, shoulder: rig.shoulder, cur: rig._curDist,
    });
  }
  return S;
}
