// The runner's pure pieces (kit/runner.js; tests/minigames.test.js): the countdown's timing, which
// controls a card lists, where Quit goes.

export const COUNT = { step: 0.8, from: 3, go: 0.7 };   // s a numeral, the first numeral, the GO's stay
export const FINISH_WAIT = 1.7;                        // s from the finish to the results card

/** The numeral the countdown shows with `left` seconds to go (0: GO). */
export const countNumeral = (left, C = COUNT) => (left <= 1e-9 ? 0 : Math.ceil(left / C.step - 1e-9));

/** The controls as the card lists them: the pad's (Xbox / PlayStation form), the touch screen's or the keys, by what is held. */
export function controlsFor(def, kind = 'keys') {
  const C = def.controls ?? {};
  return (kind === 'pad' ? C.pad : kind === 'touch' ? C.touch ?? C.pad : C.keys) ?? C.pad ?? C.keys ?? [];
}

/**
 * The touch screen's buttons a game keeps (src/ui.js TouchControls: 'jump', 'run', 'use', 'ping', 'book', 'aim',
 * 'fire', 'mode', 'blade', 'guard', 'evade', 'lock'), the others hidden while it runs: its own `touchButtons`,
 * else jump and run for a game that drives (the stick and the jump; run, a toggle, is Shift: a tuck, a boost),
 * else all of them (played on foot). [] keeps none (the drum circle: its sockets are tapped).
 */
export function touchButtons(def) {
  return def?.touchButtons ?? (def?.drives === false ? null : ['jump', 'run']);
}
/** The CSS that hides the others ('' : none hidden). */
export function touchButtonsCss(keep) {
  if (!keep) return '';
  return `body.minigame #touch button${keep.map((k) => `:not(.b-${k})`).join('')} { display: none !important; }`;
}

/** Where Quit goes: the world the game was entered from (its saved place), else the worlds list. */
export function quitHref(from) {
  return from ? `?level=${encodeURIComponent(from)}` : '?worlds=1';
}

// ------------------------------------------------------------------ the start card's options (def.options)
//   { id, label, choices: [[value, 'Label'], …], default }                 a row of choices (a difficulty)
//   { id, label, min, max, step, default, unit, hint }                    a stepper, − value + (a timing offset)
// Kept in the save's flags, minigame.<id>.opt.<option>; ctx.option(id) reads them. With def.bestBy (an
// option's id), each of its values keeps a best of its own (minigame.<id>.<value>.best).

export const optionKey = (gameId, optId) => `minigame.${gameId}.opt.${optId}`;

/** An option's value: the one kept (if still allowed), else its default (else its first choice, or 0). */
export function optionValue(def, state, optId) {
  const o = (def?.options ?? []).find((q) => q.id === optId);
  if (!o) return undefined;
  const kept = state?.flag?.(optionKey(def.id, optId));
  if (o.choices) return o.choices.some(([v]) => v === kept) ? kept : o.default ?? o.choices[0]?.[0];
  const v = Number.isFinite(kept) ? kept : o.default ?? 0;
  return Math.max(o.min ?? -Infinity, Math.min(o.max ?? Infinity, v));
}

/** A stepper's value moved by n steps, held inside its range. */
export function stepOption(o, v, n) {
  const step = o.step ?? 1, w = Math.round(((Number(v) || 0) + n * step) / step) * step;
  return Math.max(o.min ?? -Infinity, Math.min(o.max ?? Infinity, Math.round(w * 1000) / 1000));
}

/** A stepper's value as the card shows it: '+20 ms', '0 ms'. */
export const optionText = (o, v) => `${v > 0 ? '+' : ''}${v}${o.unit ? ` ${o.unit}` : ''}`;

/** The game as its scores are kept: with def.bestBy, one best for each value of that option. */
export function scoreDef(def, state) {
  if (!def?.bestBy) return def;
  return { ...def, id: `${def.id}.${optionValue(def, state, def.bestBy)}` };
}

/**
 * The results card's buttons, in order: [{ act, label, sub?, main? }]. Retry first, then the host's links and Quit;
 * a host's `links.win` ({ label, href }: a game on the way somewhere, the pirates between worlds) is the main button
 * after a run not failed (Retry beside it); `links.mandatory` (a game that must be won to go on: no Quit, no skip,
 * since v1.45) leaves Retry alone after a lost run (`links.retry.label`: what it says). (`fails` is kept for callers.)
 */
export function resultActions(r = {}, links = null, fails = 0) {   // eslint-disable-line no-unused-vars
  const quit = { act: 'quit', label: links?.quit?.label ?? 'Quit' };
  const extra = (links?.extra ?? []).map((l) => ({ act: `link:${l.id}`, label: l.label, sub: l.sub }));
  const retry = { act: 'retry', label: 'Retry' };
  if (!r.failed && links?.win) return [{ act: 'win', label: links.win.label, main: true }, retry];
  // (a game that must be played, links.mandatory: the pirates on the way to a world; lost, the one way is again)
  if (links?.mandatory) return [{ ...retry, label: links.retry?.label ?? retry.label, main: true }, ...extra];
  return [{ ...retry, main: true }, ...extra, quit];
}
