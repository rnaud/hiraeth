// The Settings' controls on a controller (menuNavigate in src/controller.js, the menus' A and B in
// src/main.js and src/title.js, SettingsMenu.back in src/ui.js). Playtest 2026-10-08: the dropdowns
// could not be changed with a pad (A did nothing on them), and the language switched to French on its
// own: holding → from the menu's last button stepped onto the Language dropdown, the first setting,
// and the same push, repeating, changed it.
//
//   ↑ / ↓          move between the controls
//   ← / →          change a slider or a dropdown (a step each push, repeating while held), but never with
//                  the push that brought the focus onto it: a new push is needed
//   A / ×          on a dropdown: open it (its row is marked); ↑ ↓ ← → then go through its choices, A / ×
//                  keeps the one shown, B / ○ puts back the one it had. A checkbox or a button: pressed
//   B / ○          out of an open dropdown first, then out of the menu as before
//
// The Language dropdown (data-pad="open") only changes by opening it: one stray push would turn every
// word on the screen into a language the player may not read.
// Pure over element-like objects ({ tagName, type, value, min, max, step, options, selectedIndex,
// dataset, classList, dispatchEvent }), so the tests drive it without a page.

let holdOn = null;   // the control that had the focus when the direction now held began
let open = null;     // { el, index }: a dropdown opened with A, and the choice it had

/** A control ← / → change (a slider, a dropdown). */
export const adjustable = (el) => !!el && (el.type === 'range' || el.tagName === 'SELECT');
/** A dropdown that only changes once opened with A (the language). */
export const opensOnly = (el) => el?.tagName === 'SELECT' && el.dataset?.pad === 'open';
/** The dropdown open now, or null. */
export const padOpen = () => open?.el ?? null;

const changed = (el) => {
  const Ev = globalThis.Event;
  if (Ev) el.dispatchEvent?.(new Ev('input', { bubbles: true }));
};
const mark = (el, on) => { el.classList?.toggle?.('pad-open', on); el.closest?.('.row')?.classList?.toggle?.('pad-open', on); };

/** One step of a slider or a dropdown (dir ±1); true if its value moved. */
export function padStep(el, dir) {
  if (!dir) return false;
  if (el.type === 'range') {
    const before = +el.value, step = +el.step || 1;
    const next = Math.max(+el.min, Math.min(+el.max, before + Math.sign(dir) * step));
    el.value = String(+next.toFixed(6));
    return +el.value !== before;
  }
  const n = el.options?.length ?? 0, i = el.selectedIndex;
  const next = Math.max(0, Math.min(n - 1, i + Math.sign(dir)));
  el.selectedIndex = next;
  return next !== i;
}

/** Close the open dropdown: keep its choice (`keep`, told as a change) or put the old one back. */
function close(keep) {
  const o = open;
  open = null;
  if (!o) return false;
  mark(o.el, false);
  if (keep) { if (o.el.selectedIndex !== o.index) changed(o.el); }
  else o.el.selectedIndex = o.index;
  return true;
}

/**
 * A direction in a menu, before it moves the focus (`current`: the focused control in the menu, or null;
 * `fresh`: a new push, not the held one repeating). True: handled here (a value changed, or a push
 * swallowed); false: move the focus as usual.
 */
export function padDirection(current, x, y, fresh = true) {
  if (fresh) holdOn = current;
  if (open && open.el !== current) close(false);   // (the focus went elsewhere: as it was)
  if (open) { padStep(open.el, y || x); return true; }
  if (!x || !adjustable(current)) return false;
  if (current !== holdOn || opensOnly(current)) return true;   // (the push that landed here, or the language: A opens it)
  if (padStep(current, x)) changed(current);
  return true;
}

/** A / × on a control: true when handled here (a dropdown opened or kept, a slider); false: click it. */
export function padConfirm(el) {
  if (!el) return false;
  if (el.tagName === 'SELECT') {
    if (open?.el === el) return close(true);
    if (open) close(false);
    open = { el, index: el.selectedIndex };
    mark(el, true);
    return true;
  }
  return el.type === 'range';
}

/** B / ○: out of an open dropdown, its old choice back. True if there was one. */
export const padCancel = () => close(false);

/** (tests) as a fresh page */
export function padReset() { holdOn = null; open = null; }
