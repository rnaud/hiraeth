// Shared HUD behavior and state. Browser markup/icons live in hud-view.js;
// both the browser Cue and the engine use this publisher and the same rules.
import { leadKey } from './prompt-keys.js';
import { screen } from './platform.js';
import { t, t as tr } from './i18n.js';
import { hintsFor } from './hint-level.js';

/** The keyboard's names in a prompt (on foot), as a pad's (by position: the bottom button jumps, the left one uses: src/bindings.js). */
export const padCue = (text) => text.replaceAll('SPACE', 'A / ×').replaceAll('SHIFT', 'L3').replaceAll('W/S', t('hud.leftStick')).replaceAll('A/D', t('hud.leftStick')).replace(/\bE\b/g, 'X / □');

/**
 * The cue's line for this frame ('' = nothing on the screen).
 * @param s.quiet      a menu, a conversation, photo mode: nothing
 * @param s.ride       the vehicle's kind while riding (null on foot): nothing (no button hints as you get on)
 * @param s.aiming     the fluid tool's own crosshair speaks
 * @param s.shipHint   ship.hud(): 'E galactic map', 'E step outside', … (or another line: not a prompt)
 * @param s.shipPlaying one of the ship's scenes has the screen
 * @param s.prompt     what the use button does, s.promptAt: where it floats (then the floating prompt says it)
 * @param s.lens       the observatory's lens line, when one is in reach
 * @param s.boarding   the backpack slotting into a vehicle
 * @param s.controller a pad is in use: its button names
 * @param s.words      the prompt's words as well as its button (hints full: src/hint-level.js 'words');
 *                     otherwise a prompt is its button alone, a small glyph
 */
export function cueText(s = {}) {
  if (s.quiet) return '';
  let t = '';
  if (s.ride || s.aiming) t = '';
  else if (s.shipHint || s.shipPlaying) t = /^E /.test(s.shipHint ?? '') ? s.shipHint : '';   // (inside, E is the ship's; in its scenes, nothing)
  else if (s.lens) t = s.lens;
  else if (s.prompt && !s.promptAt) t = `E ${s.prompt}`;
  else if (s.boarding) t = tr('hud.boarding');
  if (!t) return '';
  if (!(s.words ?? hintsFor('words'))) t = t.match(PROMPT_KEY)?.[1] ?? t;
  return s.controller ? padCue(t) : t;
}
// (a prompt's button at the start of the cue: kept alone when the words are not wanted)
const PROMPT_KEY = /^(E|SPACE|X \/ □|A \/ ×|B \/ ○|Y \/ △)(?=\s)/;

/**
 * A region's name as you cross into it: it has to hold for `settle` ms (no flicker along a
 * border), and a name shows for `show` ms. The first one, where you arrive, is the first thing
 * said on arriving (issue #78: the notices' order, src/ship/cinema.js NOTICE_ORDER): it needs no
 * settling. `hold`: something else is on the screen (a line, the objective card, a notice) or a
 * scene plays; a name ready to show waits for it (`waiting`) and shows after, for its full time.
 */
export class PlaceName {
  constructor({ settle = 1500, show = 3500 } = {}) { Object.assign(this, { settle, show }); this.name = null; this.pending = null; this.at = 0; this.until = 0; this.ready = false; }
  /** The name to show now, or ''. `quiet`: take this name at once without showing it (back out of a building into the street you left). */
  update(name, now, { quiet = false, hold = false } = {}) {
    if (quiet && name) { this.name = name; this.pending = null; this.until = 0; this.ready = false; return ''; }
    if (name && name !== this.name) {
      if (name !== this.pending) { this.pending = name; this.at = now; }
      if (this.name === null || now - this.at >= this.settle) { this.name = name; this.pending = null; this.ready = true; this.until = 0; }
    } else if (name === this.name) this.pending = null;
    if (this.ready && !hold) { this.ready = false; this.until = now + this.show; }
    return now < this.until ? this.name : '';
  }
  /** A name settled and waiting for the screen to be free (the others wait for it: it goes first). */
  get waiting() { return this.ready; }
  /** Something ahead of it came up after all (the father's charge, lettered as the crash scene hands over): the name up waits again, and shows its full time after. */
  defer(now) { if (now < this.until) { this.until = 0; this.ready = true; } }
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
  // (the bar's fill and its look, as the page draws it: magicHud, so every host draws the same bar: hatched short of a unit)
  if (magic !== null) { const M = magicHud(magic, magicMax); Object.assign(out, { magic: +magic.toFixed(2), magicMax, magicFill: +M.fill.toFixed(3), magicShort: M.short }); }
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

/**
 * The scout's find, as the cue says it: one short line, "◆ the next step · how far" (the author's rule, issue #72:
 * every quest hint one short line). The quest's overall goal (`goal`) was a small line over it until October 2026;
 * the game menu's Quests panel has it.
 */
export function findSummary({ goal = '', step = '' } = {}) {
  // one short line: the step and how far (the goal on a line over it was more than a hint needs, issue #72; the quest
  // log has the goal)
  void goal;
  return `◆ ${step}`;
}

/**
 * The key counter (issue #274, the author: "I should have a key counter on my screen. Like Zelda"): inside a temple
 * that keeps keys, a small brass key and "×N" (the small keys in hand: src/temples/runtime.js keyCount), and the great
 * key beside it once it is yours and not yet in its lock. Shown all the while you are in the house, at none too (as
 * Zelda's), never outside, nor over a conversation, a scene or photo mode. platform.js screen.keys carries it
 * ({ small, big }: an engine draws it), null when hidden.
 */
export function keysHud({ inside = false, small = 0, big = false, quiet = false } = {}) {
  if (!inside || quiet) return null;
  return { small: Math.max(0, small | 0), big: !!big };
}


/** Publishes cue state without requiring browser markup or a DOM element. */
export class CueState {
  constructor({ render = null, enabled = true } = {}) {
    this.render = render; this.enabled = enabled; this.text = ''; this.kind = '';
  }
  set(text, kind = '') {
    const lead = text && !kind ? leadKey(text) : null;
    screen.set('cue', text ? (lead ? { text, kind, key: lead.key, rest: lead.rest } : { text, kind }) : null);
    if (!this.enabled) return;
    this.render?.(text, kind, lead, this.text, this.kind);
    const moved = !!text !== !!this.text || (!!text && kind !== this.kind);
    this.text = text; this.kind = kind;
    if (moved) this.onChange?.();
  }
  dispose() {}
}
