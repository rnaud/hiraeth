import * as THREE from 'three';
import { moverVelocity } from './physics.js';

// What the feet stand on, moving floors included. The level's collision (physics.js) is baked once
// and leaves out everything that moves: the riding discs of a temple, a taxi's roof, a ball. The
// body stands on those through level.dynamic() (Player.moveStep), but the feet (feet.js plantFeet)
// and anything else that asks the ground straight from the physics looked through them, down to the
// floor under the disc, and the feet went into it. standGround(physics, solids) answers the two
// questions the feet ask (heightAbove, groundNormal) with the moving solids' tops counted: a solid
// is a disc { pos, r, top } under its centre.

/**
 * @param physics  the level's Physics
 * @param solids   () => [{ solid: { pos, r, top } }] (level.dynamic), read on every query
 * @param skip     () => a solid's owner to leave out (the vehicle you ride)
 */
/**
 * A moving solid's top over (x, z): its own shape when it has one (d.topAt: a cab's hull and canopy,
 * a ball's dome), else its disc's level top within d.r. -Infinity off it.
 */
export function solidTop(d, x, z) {
  if (Math.hypot(x - d.pos.x, z - d.pos.z) > d.r) return -Infinity;
  return d.topAt ? d.topAt(x, z) : d.top;
}

export function standGround(physics, solids, skip = () => null) {
  const topUnder = (x, fromY, z) => {
    let best = -Infinity;
    for (const v of solids?.() ?? []) {
      const d = v?.solid;
      if (!d || v === skip()) continue;
      const t = solidTop(d, x, z);
      if (t > fromY || t <= best) continue;
      best = t;
    }
    return best;
  };
  return {
    physics,
    /** Height of pos above the ground along up (physics.heightAbove), a moving floor's top counted (only with +Y up). */
    heightAbove(pos, up, step = 0.6) {
      const h = physics.heightAbove(pos, up, step);
      if (up.y < 0.999) return h;
      const t = topUnder(pos.x, pos.y + step, pos.z);
      return Number.isFinite(t) && pos.y - t < h ? pos.y - t : h;
    },
    groundAt(x, fromY, z, maxDrop) { return Math.max(physics.groundAt(x, fromY, z, maxDrop), topUnder(x, fromY, z)); },
    groundNormal(x, fromY, z, out = new THREE.Vector3()) {
      const t = topUnder(x, fromY, z);
      if (Number.isFinite(t) && t >= physics.groundAt(x, fromY, z)) return out.set(0, 1, 0);   // (the discs are level; a shaped top, near enough under a foot)
      return physics.groundNormal(x, fromY, z, out);
    },
  };
}

/**
 * What carries you when the ground under you (or the wall you climb) is a moving collider
 * (physics.addMover: the Buried Machine's great wheel): { vel } of its surface at p, as a moving
 * solid's, or null. `mover` is physics.groundMover after a ground query, or a rayHit's mover.
 */
export function moverCarrier(mover, p, out = { vel: new THREE.Vector3() }) {
  if (!mover) return null;
  moverVelocity(mover, p, out.vel);
  return out;
}

/**
 * The level's Physics as the camera sees it: the same, but a ray also meets the moving things that
 * have a shape of their own (a cab's hull and canopy: Taxi.rayDistance), which the level's collision
 * leaves out, so stepping out of a cab beside a wall the camera does not end up inside its hull. Never
 * the one you ride (skip()). The cabs' own route checks and everyone's walking use the level's Physics
 * untouched; this is the camera's alone (main.js CameraRig).
 */
export function cameraPhysics(physics, things, skip = () => null) {
  const view = Object.create(physics);
  view.rayDistance = (origin, dir, far) => {
    let d = physics.rayDistance(origin, dir, far);
    const ride = skip();
    for (const v of things?.() ?? []) {
      if (v === ride || typeof v?.rayDistance !== 'function' || v.object?.visible === false) continue;
      d = Math.min(d, v.rayDistance(origin, dir, Math.min(far, d)));
    }
    return d;
  };
  return view;
}

/**
 * The camera's lens kept out of the moving things with a shape (a cab's hull and canopy: Taxi.pushPoint):
 * the rig keeps a short arm (it never comes closer than ~1.5 m), so a cab right behind you would still
 * have it inside; moved off its side or over its top. Never the one you ride. For CameraRig.constrain.
 */
export function keepLensOut(cam, things, skip = () => null, r = 0.25) {
  const ride = skip();
  for (const v of things?.() ?? []) if (v !== ride && typeof v?.pushPoint === 'function' && v.object?.visible !== false) v.pushPoint(cam, r);
}
