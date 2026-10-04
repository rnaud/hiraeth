import * as THREE from 'three';

// Shelter: the weather stays outdoors. Rain (and the blown sand of a storm) is
// drawn over the whole frame by the post pass (src/post.js), so on its own it
// would fall in the crashed ship's cabin, in houses, in the traveller's ship.
// Each frame this works out how sheltered the camera is:
//   - indoors: inside any registered interior volume (every room built by
//     src/interiors.js buildRoom, the traveller's ship, anything a level adds
//     with addIndoors). No rain or sand is drawn at all, and the rain is only a
//     muffled drumming on the roof.
//   - under a roof: something solid straight overhead (a porch, an arch, a
//     canopy of stone). Rain is only drawn beyond `dryNear` metres (the open
//     ground past the roof's edge), and sounds a little muffled.
// The result eases in and out, so walking through a doorway fades the rain.

const INDOORS = new Set();

/** Register an interior: `test(point)` says whether a world point is inside it. Returns an unregister function. */
export function addIndoors(test) {
  INDOORS.add(test);
  return () => INDOORS.delete(test);
}

/** Is this world point inside any registered interior? */
export function isIndoors(p) {
  for (const test of INDOORS) if (test(p)) return true;
  return false;
}

export const ROOF_REACH = 30;   // m: a roof higher over the camera than this is sky as far as the rain cares
const PROBE_EVERY = 0.2;        // s between roof probes

/**
 * How far out a roof keeps the rain off, from its height over the camera: a
 * porch 3 m up keeps the near ground dry, a high arch more of the view.
 * (Infinity: nothing overhead.)
 */
export function dryReach(roof) {
  if (!Number.isFinite(roof) || roof >= ROOF_REACH) return 0;
  return THREE.MathUtils.clamp(3 + roof * 1.2, 3, 30);
}

export class Shelter {
  /** @param physics  for the roof probe (rayDistance); optional */
  constructor(physics = null) {
    this.physics = physics;
    this.indoor = 0;     // eased 0 (outdoors) .. 1 (indoors)
    this.roofed = 0;     // eased 0 .. 1: under a roof (outdoors)
    this.dryNear = 0;    // m: no rain nearer than this (under a roof)
    this._roof = Infinity;
    this._probeT = 0;
    this._last = null;
  }

  /**
   * @param dt
   * @param cam     the camera's world position (the rain is drawn in front of it)
   * @param up      world up for the roof probe (gravity can turn in the Hangar)
   * @param others  more points that count as "where we are" for the interiors (the player)
   */
  update(dt, cam, up = THREE.Object3D.DEFAULT_UP, others = []) {
    const inside = isIndoors(cam) || others.some((p) => p && isIndoors(p));
    // a portal or a teleport: snap rather than fade
    const jumped = !this._last || this._last.distanceToSquared(cam) > 100;
    (this._last ??= new THREE.Vector3()).copy(cam);
    this._probeT -= dt;
    if (this.physics && (this._probeT <= 0 || jumped)) {
      this._probeT = PROBE_EVERY;
      this._roof = inside ? Infinity : this.physics.rayDistance(cam, up, ROOF_REACH);
    }
    const roofed = !inside && this._roof < ROOF_REACH;
    const k = jumped ? 1 : 1 - Math.exp(-dt * 4);
    this.indoor += ((inside ? 1 : 0) - this.indoor) * k;
    this.roofed += ((roofed ? 1 : 0) - this.roofed) * k;
    if (roofed) this.dryNear = dryReach(this._roof);
    return this;
  }

  /**
   * The weather as it reaches the camera: { rain, storm } for the picture,
   * { rainOut, rainRoof } for the sound (the open hiss, the muffled drumming),
   * and dryNear for the post pass.
   */
  apply(W) {
    const open = 1 - this.indoor;
    return {
      rain: W.rain * open,
      storm: W.storm * open,
      dryNear: this.roofed > 0.01 ? this.dryNear * this.roofed : 0,
      rainOut: W.rain * open * (1 - 0.6 * this.roofed),
      rainRoof: W.rain * Math.max(this.indoor, this.roofed * 0.6),
    };
  }
}
