// The screen while you play holds nothing at rest (docs/systems/ui.md, "Nothing on the screen"). What used
// to sit in the status box comes only when it matters, then fades:
//   - the cue (index.html #cue): one short line at the bottom for what the use button does
//     right here when it has no person or thing to float over (the ship's hatch and console, a
//     lens), and a region's name as you cross into it; nothing while riding (no list of a
//     vehicle's buttons as you get on: the settings' Controls page has them);
//   - the health bar while hurt or healing, the stamina wheel while not full, the tank's gauge
//     while it is short (main.js, ui.js ToolHud), each lingering a moment (Fader);
//   - the objective: the scout finds it (Q, R3: src/scout.js) and the cue says its goal over its
//     next step (findSummary); the game menu's Quests panel shows the same for every quest (src/game-menu.js).
import { badgeLine, escapeHtml, keysHtml } from './prompt-keys.js';
import { page, screen } from './platform.js';
import { t, t as tr } from './i18n.js';

/** The keyboard's names in a prompt (on foot), as a pad's (by position: the bottom button jumps, the left one uses: src/bindings.js). */
export const padCue = (text) => text.replaceAll('SPACE', 'A / ×').replaceAll('SHIFT', 'L3').replaceAll('W/S', t('hud.leftStick')).replaceAll('A/D', t('hud.leftStick')).replace(/\bE\b/g, 'X / □');

/**
 * The cue's line for this frame ('' = nothing on the screen).
 * @param s.quiet      a menu, a conversation, photo mode: nothing
 * @param s.ride       the vehicle's kind while riding (null on foot): nothing (no button hints as you get on)
 * @param s.aiming     the fluid tool's own crosshair speaks
 * @param s.shipHint   ship.hud(): 'E go aboard', 'E galactic map', … (or another line: not a prompt)
 * @param s.shipPlaying one of the ship's scenes has the screen
 * @param s.prompt     what the use button does, s.promptAt: where it floats (then the floating prompt says it)
 * @param s.lens       the observatory's lens line, when one is in reach
 * @param s.boarding   the backpack slotting into a vehicle
 * @param s.controller a pad is in use: its button names
 */
export function cueText(s = {}) {
  if (s.quiet) return '';
  let t = '';
  if (s.ride || s.aiming) t = '';
  else if (s.shipHint || s.shipPlaying) t = /^E /.test(s.shipHint ?? '') ? s.shipHint : '';   // (inside and at its ramp, E is the ship's; in its scenes, nothing)
  else if (s.lens) t = s.lens;
  else if (s.prompt && !s.promptAt) t = `E ${s.prompt}`;
  else if (s.boarding) t = tr('hud.boarding');
  if (!t) return '';
  return s.controller ? padCue(t) : t;
}

/**
 * A region's name as you cross into it: it has to hold for `settle` ms (no flicker along a
 * border), the first one (where you arrive: the world's own words say it) is not shown, and a
 * name shows for `show` ms.
 */
export class PlaceName {
  constructor({ settle = 1500, show = 3500 } = {}) { Object.assign(this, { settle, show }); this.name = null; this.pending = null; this.at = 0; this.until = 0; }
  /** The name to show now, or ''. */
  update(name, now) {
    if (name && name !== this.name) {
      if (name !== this.pending) { this.pending = name; this.at = now; }
      else if (now - this.at >= this.settle) {
        const first = this.name === null;
        this.name = name; this.pending = null;
        if (!first) this.until = now + this.show;
      }
    } else if (name === this.name) this.pending = null;
    return now < this.until ? this.name : '';
  }
}

/** Shown while active, and `linger` seconds after: the health bar, the stamina wheel. */
export class Fader {
  constructor(linger = 1) { this.linger = linger; this.left = 0; }
  update(dt, active) { this.left = active ? this.linger : Math.max(0, this.left - dt); return this.left > 0; }
  get on() { return this.left > 0; }
}

/**
 * The health bar's state this frame (index.html #health; an engine draws it from platform.js screen):
 * shown while hurt or down and the fader's linger after, or null. `hurt`: a hurt or a knockdown just
 * now (shows it at once).
 */
export function healthHud({ health = 1, down = false, hurt = false, quiet = false } = {}, fader, dt) {
  if (hurt) fader.update(0, true);
  const on = fader.update(dt, health < 0.999 || !!down) && !quiet;
  return on ? { value: +health.toFixed(3), low: health < 0.3 } : null;
}

/**
 * The stamina wheel's state (index.html #stamina): while it isn't full and a moment after (`shown`,
 * the seconds left, carried by the caller), red while winded; null when hidden.
 */
export function staminaHud({ stamina = 1, winded = false, quiet = false } = {}, shown) {
  const k = Math.min(Math.max(stamina ?? 1, 0), 1);
  const on = shown > 0 && !quiet;
  return on ? { value: +k.toFixed(3), winded: !!winded } : null;
}

/** The cue's element (index.html #cue): set only when the line changes; fades in and out. Its state goes to platform.js screen.cue. */
export class Cue {
  constructor(el = page.byId('cue')) { this.el = el; this.text = ''; this.kind = ''; }
  set(text, kind = '') {
    screen.set('cue', text ? { text, kind } : null);
    if (!this.el) return;
    if (text && (text !== this.text || kind !== this.kind)) {
      // (the place name is a plain line; a prompt badges its button: native-pad.js renames it in place)
      // (the scout's find: its goal small, over its next step: findSummary)
      const [goal, step] = kind === 'quest' && text.includes('\n') ? text.split('\n') : [null, text];
      this.el.innerHTML = kind === 'place' ? `<span>${escapeHtml(text)}</span>`
        : goal != null ? `<small class="goal">${escapeHtml(goal)}</small><span class="step">${keysHtml(step)}</span>` : badgeLine(text);
      this.el.classList.toggle('place', kind === 'place');
      this.el.classList.toggle('quest', kind === 'quest');
    }
    if (!!text !== !!this.text) this.el.classList.toggle('show', !!text);
    this.text = text; this.kind = kind;
  }
}

/**
 * The scout's find, as the cue says it (rule: the current quest is its overall goal and its next step,
 * nothing else): the goal on a small line over "◆ the next step · how far". No goal (the ship, a bare
 * world): the step alone, as before.
 */
export function findSummary({ goal = '', step = '' } = {}) {
  return goal ? `${goal}\n◆ ${step}` : `◆ ${step}`;
}
