// The desert's first steps teach the camera and the jump, once each, and only if you haven't
// used them yet (World 1-1: the world teaches; a line only when it hasn't). Out of the ship and
// down the ramp, before the makers' chest (item.backpack), the cue at the bottom of the screen
// (main.js cue) may say, for a few seconds, then never again:
//   - "Look around with the mouse" (the right stick, a drag on the right) after LOOK.after s
//     with no look input at all;
//   - "Jump with SPACE" (A / ×, ⤒) once you have walked JUMP.walk m without one.
// Using the camera or the jump at any time counts it as learnt (flags teach.look, teach.jump:
// per save, so a new save in another slot is taught again). The words name the input in your
// hands (src/prompt-keys.js verbKey; native-pad.js prints a pad's as the handheld does).
//
//   const steps = new FirstSteps(game)
//   steps.looked() · steps.jumped()          // input seen (main.js wraps rig.look; the player's jump)
//   steps.update(dt, { active, moved })  →  the line to show now, or ''

import { verbKey } from './prompt-keys.js';

export const LOOK = { after: 6, show: 5 };
export const JUMP = { walk: 25, show: 5 };
export const TAUGHT = { look: 'teach.look', jump: 'teach.jump' };

export const lookLine = (kind) => `Look around with ${verbKey('look', kind)}`;
export const jumpLine = (kind) => `Jump with ${verbKey('jump', kind)}`;

export class FirstSteps {
  constructor(state, { kind = undefined } = {}) {
    this.state = state; this.kind = kind;
    this.t = 0; this.walked = 0; this.line = null; this.left = 0;
  }
  get done() { return !!(this.state.flag(TAUGHT.look) && this.state.flag(TAUGHT.jump)); }
  looked() { if (!this.state.flag(TAUGHT.look)) this.state.set(TAUGHT.look, true); if (this.line === 'look') this.left = Math.min(this.left, 0.6); }
  jumped() { if (!this.state.flag(TAUGHT.jump)) this.state.set(TAUGHT.jump, true); if (this.line === 'jump') this.left = Math.min(this.left, 0.6); }

  /** active: on foot in the open, nothing else on the screen, before the chest; moved: metres walked this frame. */
  update(dt, { active = false, moved = 0 } = {}) {
    if (this.line) {
      this.left -= dt;
      if (this.left <= 0) this.line = null;
      else return this.line === 'look' ? lookLine(this.kind) : jumpLine(this.kind);
    }
    if (!active || this.done) return '';
    this.t += dt; this.walked += moved;
    if (!this.state.flag(TAUGHT.look)) {
      if (this.t < LOOK.after) return '';
      this.state.set(TAUGHT.look, true);   // (said once: it counts as taught)
      this.line = 'look'; this.left = LOOK.show; this.walked = 0;
      return lookLine(this.kind);
    }
    if (!this.state.flag(TAUGHT.jump) && this.walked >= JUMP.walk) {
      this.state.set(TAUGHT.jump, true);
      this.line = 'jump'; this.left = JUMP.show;
      return jumpLine(this.kind);
    }
    return '';
  }
}
