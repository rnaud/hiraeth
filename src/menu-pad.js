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

// ---- grids (the worlds list, the items page): the D-pad and the stick move in 2D, to the card that is
// that way on the screen, as a console's menus do (a list's next / previous would walk a row of three
// cards to reach the one below). Opted into by the menu's root: data-grid-nav (menuNavigate).

/**
 * The index of the box to go to from `index` towards (x, y) (each -1, 0 or 1), or `index` if none.
 * `rects`: [{ left, top, width, height }] in the page's order. A box counts when its centre lies that
 * way (by a third of the current box at least) and, for ← →, it shares the current one's row; for ↑ ↓
 * one in its column wins, else the nearest anywhere below / above. The nearest wins, sideways distance
 * counting double. Past the last row ↓ wraps to the first (↑ to the last), the column kept; ← → stop at
 * the ends of a row.
 */
export function gridStep(rects, index, x, y) {
  const n = rects.length;
  if (!n) return -1;
  if (index < 0 || index >= n) return 0;
  if (!x && !y) return index;
  const c = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const cur = rects[index], cc = c(cur);
  const along = (p) => (x ? (p.x - cc.x) * x : (p.y - cc.y) * y);   // how far that way
  const side = (p) => (x ? Math.abs(p.y - cc.y) : Math.abs(p.x - cc.x));
  const overlaps = (r) => (x ? r.top < cur.top + cur.height && r.top + r.height > cur.top : r.left < cur.left + cur.width && r.left + r.width > cur.left);
  // (a third of the box's own size: the focused card is drawn lifted and a little larger, its neighbours in
  // the same column must not count as "to the right")
  const min = Math.max(1, (x ? cur.width : cur.height) / 3);
  let best = -1, bestScore = Infinity, bestBand = false;
  rects.forEach((r, i) => {
    if (i === index) return;
    const p = c(r), a = along(p);
    if (a < min) return;
    const band = overlaps(r);
    if (x && !band) return;   // (← → stay in the row: a list of one column doesn't jump up to the header)
    const score = a + 2 * side(p);
    if ((band && !bestBand) || (band === bestBand && score < bestScore)) { best = i; bestScore = score; bestBand = band; }
  });
  if (best >= 0 || x) return best >= 0 ? best : index;
  // ↓ from the last row: the first row's box nearest the column (↑ from the first: the last row's)
  const edge = (r) => (y > 0 ? r.top : -(r.top + r.height));   // (smallest: the first row going ↓, the last going ↑)
  let far = -1, farEdge = Infinity, farSide = Infinity;
  rects.forEach((r, i) => {
    if (i === index) return;
    const e = edge(r), s = side(c(r));
    if (e < farEdge - 4 || (Math.abs(e - farEdge) <= 4 && s < farSide)) { far = i; farEdge = Math.min(e, farEdge); farSide = s; }
  });
  if (far < 0 || edge(cur) <= farEdge + 4) return index;   // (one row: nowhere to wrap to)
  return far;
}
