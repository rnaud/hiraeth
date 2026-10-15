import * as THREE from 'three';

// Aiming locked on (LT / L2 with a lock, issue #362, the author: "When pressing L2 to aim we should always center to the
// center of the lock on and I should be able to use the right stick to slightly shift the aim like it's done in Metroid
// Prime games"; docs/systems/movement-and-camera.md "Aiming locked on: centred, then nudged"). The camera turns onto the
// lock's point (src/fluid-tool.js lockAim: its yaw and pitch from where the camera stands) and holds there exactly once
// the aim is up; the right stick (or the mouse, a touch drag) shifts it off within a small cone (AimNudge), and let go it
// eases back onto the centre. Without a lock, aiming is as it was (main.js).

/**
 * `cone` rad: how far off the lock's point the aim may be shifted (the stick at full tilt: about 7°, a body's width at
 * 10 m); the shift follows the stick at `follow` /s; a pointer's move (`px` rad a pixel, × the look's sensitivity) is
 * held while it moves and `hold` s after, then eases back at `back` /s; shifted past `snap` of the cone, the crosshair is
 * the player's own (the lock's snap onto its point is off: FluidTool.updateAimPoint); `ramp` the aim's camera ease
 * (FluidTool.camK) over which the camera comes onto the point, exactly there from its end.
 */
export const AIM_NUDGE = { cone: 0.12, follow: 14, back: 5, px: 0.0025, hold: 0.15, snap: 0.15, ramp: [0.2, 0.7] };

/** (x, y) kept within a circle of radius r. */
export function inCone(x, y, r) {
  const L = Math.hypot(x, y);
  return L > r ? [(x * r) / L, (y * r) / L] : [x, y];
}

/** The aim's shift off the lock's point (rad; `x` right, `y` up), from the right stick's tilt or a pointer's moves. */
export class AimNudge {
  constructor(N = AIM_NUDGE) { this.N = N; this.reset(); }
  reset() { this.x = 0; this.y = 0; this.mx = 0; this.my = 0; this.idle = Infinity; }
  /** A pointer's look (px, as CameraRig.look gets them: right and down positive), `sens` the look's sensitivity. */
  push(dx, dy, sens = 1) {
    const k = this.N.px * sens;
    [this.mx, this.my] = inCone(this.mx + dx * k, this.my - dy * k, this.N.cone);
    this.idle = 0;
  }
  /** A frame: `stick` the right stick ({ x, y }: right and up positive, −1..1) or null; let go, it eases back to the centre. */
  update(dt, stick) {
    const N = this.N;
    this.idle += dt;
    if (this.idle > N.hold) { const a = Math.exp(-N.back * dt); this.mx *= a; this.my *= a; }
    const [gx, gy] = inCone((stick?.x ?? 0) * N.cone + this.mx, (stick?.y ?? 0) * N.cone + this.my, N.cone);
    const a = 1 - Math.exp(-(gx || gy ? N.follow : N.back) * dt);
    this.x += (gx - this.x) * a; this.y += (gy - this.y) * a;
    if (Math.abs(this.x) < 1e-5 && Math.abs(this.y) < 1e-5 && !gx && !gy) { this.x = 0; this.y = 0; }
    return this;
  }
  /** Shifted off the point enough that the crosshair is the player's own. */
  get nudged() { return Math.hypot(this.x, this.y) > this.N.cone * this.N.snap; }
}

/**
 * One frame of the camera aiming locked on: the rig's yaw and pitch onto `aim` (lockAim's { yaw, pitch } toward the lock's
 * point from where the camera stands) shifted by `nudge` (CameraRig's convention: yaw falls looking right, pitch + looks
 * down; `invertY` the look's own), by `w` of the way (1: exactly there).
 */
export function lockAimStep(rig, aim, nudge, w, invertY = rig.invertY) {
  const yaw = aim.yaw - (nudge?.x ?? 0), pitch = aim.pitch - (nudge?.y ?? 0) * (invertY ? -1 : 1);
  const k = THREE.MathUtils.clamp(w, 0, 1);
  rig.yaw += Math.atan2(Math.sin(yaw - rig.yaw), Math.cos(yaw - rig.yaw)) * k;
  rig.pitch += (pitch - rig.pitch) * k;
  return rig;
}
