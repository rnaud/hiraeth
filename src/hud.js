// The screen while you play holds nothing at rest (docs/systems/ui.md, "Nothing on the screen"). What used
// to sit in the status box comes only when it matters, then fades:
//   - the cue (index.html #cue): one short line at the bottom for what the use button does
//     right here when it has no person or thing to float over (the ship's hatch and console, a
//     lens), and a region's name as you cross into it; nothing while riding (no list of a
//     vehicle's buttons as you get on: the settings' Controls page has them);
//   - the hearts, the magic bar and the potion (index.html #health: heartsSvg, magicHud) while a heart is
//     missing, the bar is spending or refilling, or a fight is on; the chimes beside them, and the block
//     for a moment whenever they change (walletTick counts them up); the stamina wheel while not full
//     (main.js, ui.js ToolHud), each lingering a moment (Fader);
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
  /** The name to show now, or ''. `quiet`: take this name at once without showing it (back out of a building into the street you left). */
  update(name, now, { quiet = false } = {}) {
    if (quiet && name) { this.name = name; this.pending = null; this.until = 0; return ''; }
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
 * The hearts' state this frame (index.html #health: the hearts, the magic bar, the potion; an engine draws it
 * from platform.js screen): shown while a heart is missing, the magic bar is not full, a fight is on (`combat`)
 * or you are down, and the fader's linger after, or null. `hurt`: a hurt, a knockdown or a potion just now
 * (shows it at once). value: the hearts as a share (the old bar's), low: one heart or less left.
 * Without `hearts` (an old caller) the share `health` counts as HEARTS.start hearts.
 */
export function healthHud({ health = 1, hearts = null, max = 3, magic = null, magicMax = 3, potions = null, infinite = true, chimes = null, wallet = false, combat = false, down = false, hurt = false, quiet = false } = {}, fader, dt) {
  const h = hearts ?? health * max, share = max > 0 ? h / max : 0;
  const spending = magic !== null && magic < magicMax - 1e-3;
  if (hurt || wallet) fader.update(0, true);   // (wallet: the chimes just changed, or are still counting up)
  const on = fader.update(dt, share < 0.999 || !!down || spending || !!combat) && !quiet;
  if (!on) return null;
  const out = { value: +share.toFixed(3), low: h <= 1 + 1e-9 && h < max, hearts: +h.toFixed(2), max };
  if (magic !== null) Object.assign(out, { magic: +magic.toFixed(2), magicMax });
  if (potions !== null) Object.assign(out, { potions, infinite: !!infinite });
  if (chimes !== null) out.chimes = chimes;
  return out;
}

/**
 * The wallet's count on the screen ticking towards the real one (src/chimes.js, src/resources.js): at least
 * `rate` a second, quicker the further it has to go (a guardian's purse counts up in about half a second).
 * Returns the new shown value (a float: draw it rounded).
 */
export function walletTick(shown, target, dt, rate = 14) {
  const d = target - shown;
  if (Math.abs(d) < 0.5) return target;
  const step = Math.max(rate, Math.abs(d) * 5) * dt;
  return Math.abs(d) <= step ? target : shown + Math.sign(d) * step;
}

/** Each heart's quarters filled (0..4), for `hearts` (counted in quarters) out of `max` containers. */
export function heartQuarters(hearts, max) {
  const q = Math.max(0, Math.round((hearts ?? 0) * 4));
  return Array.from({ length: Math.max(0, Math.round(max)) }, (_, i) => Math.max(0, Math.min(4, q - i * 4)));
}

// One inked heart (a 20 x 18 box): the outline drawn thick in the ink, the fill in quarters (the quadrants
// round the middle: bottom left, top left, top right, bottom right, as a clock fills), a cream highlight.
const HEART = 'M10 17.2 C 6.2 14.1 1.4 10.6 1.4 6.1 C 1.4 3.2 3.6 1.2 6.1 1.2 C 7.8 1.2 9.2 2.2 10 3.6 C 10.8 2.2 12.2 1.2 13.9 1.2 C 16.4 1.2 18.6 3.2 18.6 6.1 C 18.6 10.6 13.8 14.1 10 17.2 Z';
const QUAD = ['M0 9H10V18H0Z', 'M0 0H10V9H0Z', 'M10 0H20V9H10Z', 'M10 9H20V18H10Z'];
/**
 * The hearts as one inline SVG (DOM-free: main.js puts it into #health .hearts, the tests read it): a heart
 * per container, each filled by its quarters; the last one pulses when `low`. Part-filled hearts show their
 * quarter lines, so a quarter reads at any size.
 */
export function heartsSvg(hearts, max, { low = false } = {}) {
  const qs = heartQuarters(hearts, max), W = 22;
  const body = qs.map((n, i) => {
    const id = `hq${i}`;
    const fill = n >= 4 ? `<path d="${HEART}" class="hf"/>` : n > 0 ? `<clipPath id="${id}"><path d="${QUAD.slice(0, n).join('')}"/></clipPath><path d="${HEART}" class="hf" clip-path="url(#${id})"/>` : '';
    const ticks = n > 0 && n < 4 ? '<path d="M10 3.6V17.2M1.6 9H18.4" class="hq"/>' : '';
    const last = low && n > 0 && (i === qs.length - 1 || qs[i + 1] === 0);
    return `<g transform="translate(${i * W} 0)" class="h${n === 0 ? ' empty' : ''}${last ? ' low' : ''}" data-q="${n}"><path d="${HEART}" class="he"/>${fill}${ticks}<path d="M5.2 4.4 C 4 4.9 3.4 6 3.5 7.2" class="hl"/><path d="${HEART}" class="ho"/></g>`;
  }).join('');
  return `<svg viewBox="-1 -1 ${qs.length * W} 20" width="${qs.length * W}" height="20" aria-hidden="true">${body}</svg>`;
}

/** The magic bar's fill and look: { fill 0..1, units (its length), short: can't pay for a shot (under one unit) }. */
export function magicHud(level, max) {
  const m = Math.max(0, max ?? 0);
  return { fill: m > 0 ? Math.min(1, Math.max(0, (level ?? 0) / m)) : 0, units: m, short: (level ?? 0) < 1 - 1e-6 };
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
