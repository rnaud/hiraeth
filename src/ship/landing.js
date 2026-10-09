// The first moments on the ground, as rules (pure: tests/landing.test.js):
//   - nobody talks over a ship's scene: no balloon and no talk prompt until the player has the
//     controls back (the crash, the landing, the take-off, a recording: main.js);
//   - whoever waits at the wreck in a new game (Marrow, src/story/desert.js) stands well clear of
//     where the ship comes down and ploughs in, in front of the hatch and away from its furrow;
//   - stepping out of the ship doesn't offer to go straight back in: the ramp's "go aboard" waits
//     until you have walked away from it once (ReboardGate, src/ship/ship.js).

/** Balloons and talk prompts may show: not while a ship's scene plays (the player isn't in control). */
export const talkAllowed = ({ shipPlaying = false } = {}) => !shipPlaying;

/** Where Marrow waits at the wreck: how far from the hull's centre (m); the furrow's half width (m). */
export const BYSTANDER = { dist: 22, furrow: 18, off: 0.7 };

/** Whether a point (relative to the hull's centre) is in the furrow the ship ploughed coming in along heading `travel`. */
export function inFurrow(dx, dz, travel, half = BYSTANDER.furrow) {
  const tx = Math.sin(travel), tz = Math.cos(travel);
  const along = dx * tx + dz * tz, lateral = Math.abs(dx * tz - dz * tx);
  return along < 0 && lateral < half;
}

/**
 * A spot by the wreck for someone who watched it come down: BYSTANDER.dist from the hull's centre, a
 * little to one side of the way the hatch faces (seen as you step out, not in your path: BYSTANDER.off
 * rad), never in the furrow behind the ship (it slid along `travel`, a heading). { x, z }.
 * @param o { out: {x,z} the way the ramp faces (unit), hull: {x,z} the hull's centre, travel?: heading }
 */
export function bystanderSpot({ out, hull, travel = null }, B = BYSTANDER) {
  let best = null, score = -Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, dx = Math.sin(a) * B.dist, dz = Math.cos(a) * B.dist;
    if (travel !== null && inFurrow(dx, dz, travel, B.furrow)) continue;
    // (the hatch's way turned B.off to either side: whichever is nearer)
    const c = Math.cos(B.off), sn = Math.sin(B.off);
    const s = Math.max(dx * (out.x * c + out.z * sn) + dz * (out.z * c - out.x * sn), dx * (out.x * c - out.z * sn) + dz * (out.z * c + out.x * sn)) / B.dist;
    if (s > score) { score = s; best = { x: hull.x + dx, z: hull.z + dz }; }
  }
  return best ?? { x: hull.x + out.x * B.dist, z: hull.z + out.z * B.dist };
}

/** How far from the ramp's foot (m) you must have walked before it offers to take you aboard again. */
export const REBOARD_AWAY = 7;

/**
 * The ramp's "go aboard" after stepping out: armed while you are in the ship or it walks you, it
 * stays quiet at the ramp's foot until you have been REBOARD_AWAY from it once.
 */
export class ReboardGate {
  constructor(away = REBOARD_AWAY) { this.away = away; this.armed = false; }
  /**
   * Each frame. `aboard`: inside, or a scene / the autopilot has you; `fromRamp`: metres from the ramp's foot.
   * Returns whether the ramp may offer to take you aboard.
   */
  update({ aboard = false, fromRamp = Infinity } = {}) {
    if (aboard) this.armed = true;
    else if (this.armed && fromRamp > this.away) this.armed = false;
    return !this.armed;
  }
  get open() { return !this.armed; }
}
