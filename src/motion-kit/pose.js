import { SecondOrder, quantise } from './spring.js';
import { POSE_DONE } from '../telegraph.js';

// Key poses blended by the foe's state (docs/systems/procedural-animation.md, "Anticipation, follow-through,
// telegraphs"; docs/systems/foes.md, "Telegraphs: the body, not the floor"). A plan authors a few strong poses
// (rest, coil, strike, recover, hurt; a coil per attack where they should read apart: `coil:<id>`) and the
// blend moves between them through springs:
//
//   wind     the coil builds with the telegraph's own timing (complete at POSE_DONE of the wind-up, then held
//            still: src/telegraph.js), the feet brace wide and stepping locks (lock, spread: the gait planner's
//            setStance), and the body moves against the strike first (the coil sits back, z < 0)
//   strike   snaps to the strike pose on a fast, underdamped spring: through, with overshoot
//   recover  slumps, then eases back to rest as the recovery runs out, the springs settling
//   hurt     a flinch while stunned
//
// Channels, offsets from the rest body in its frame: y (m), z (m, + towards the strike), pitch, roll, yaw (rad),
// and spread (the feet's homes ×). Machines move on harder springs and their yaw ticks like a servo.

export const REST = Object.freeze({ y: 0, z: 0, pitch: 0, roll: 0, yaw: 0, spread: 1 });
const CHANNELS = ['y', 'z', 'pitch', 'roll', 'yaw'];

/** Spring characters per phase and style: f (Hz), ζ, r. */
export const POSE_SPRINGS = {
  organic: { wind: [5, 1, 0], strike: [8, 0.38, 1.2], recover: [2.2, 0.6, 0], rest: [3, 0.8, 0] },
  machine: { wind: [6.5, 0.95, 0], strike: [10, 0.3, 1], recover: [3, 0.45, 0], rest: [4, 0.6, 0] },
};

const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** The share of the coil pose at wind-up progress k (as src/telegraph.js poseK: complete at POSE_DONE). */
export const coilK = (k) => smooth(k / POSE_DONE);

export class PoseBlend {
  /** poses: { coil, strike, recover, hurt, 'coil:<attack id>', 'strike:<attack id>' } (partial channels). */
  constructor({ poses = {}, style = 'organic' } = {}) {
    this.poses = poses; this.style = style;
    this.springs = Object.fromEntries(CHANNELS.map((c) => [c, new SecondOrder(...POSE_SPRINGS[style].rest)]));
    this.phase = 'rest';
    this.out = { ...REST, lock: false, wide: 1 };
    this.target = { ...REST };
  }
  pose(name, id) { return this.poses[`${name}:${id}`] ?? this.poses[name] ?? REST; }

  /**
   * One frame. s: { state ('wind' | 'strike' | 'recover' | …), k (0..1 through the phase), atk ({ id, lunge }),
   * recovery (1 → 0 through the recovery), stunned }.
   */
  update(dt, s) {
    const id = s.atk?.id;
    let phase = 'rest', a = REST, b = REST, w = 0;
    if (s.state === 'wind') { phase = 'wind'; b = this.pose('coil', id); w = coilK(s.k ?? 0); }
    else if (s.state === 'strike') { phase = 'strike'; b = this.pose('strike', id); w = 1; }
    else if (s.state === 'recover') { phase = 'recover'; b = this.pose('recover', id); w = Math.max(0, Math.min(1, s.recovery ?? 0)); }
    else if (s.stunned > 0) { phase = 'recover'; b = this.pose('hurt', id); w = 1; }
    if (phase !== this.phase) {
      const p = POSE_SPRINGS[this.style][phase];
      for (const c of CHANNELS) this.springs[c].set(...p);
      this.phase = phase;
    }
    const T = this.target, o = this.out;
    for (const c of CHANNELS) T[c] = (a[c] ?? 0) + ((b[c] ?? 0) - (a[c] ?? 0)) * w;
    for (const c of CHANNELS) o[c] = dt > 0 ? this.springs[c].update(dt, T[c]) : this.springs[c].y;
    if (this.style === 'machine') o.yaw = quantise(o.yaw, 0.05);   // (a servo's notches)
    // the feet: a wind-up braces them wide and locks stepping until the strike is through (a lunge travels: unlocked)
    const coil = this.pose('coil', id);
    o.lock = phase === 'wind' || (phase === 'strike' && !s.atk?.lunge);
    o.wide = o.lock ? coil.spread ?? 1.15 : 1;
    o.spread = o.wide;
    return o;
  }
}
