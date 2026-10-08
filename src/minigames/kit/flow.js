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

/** Where Quit goes: the world the game was entered from (its saved place), else the worlds list. */
export function quitHref(from) {
  return from ? `?level=${encodeURIComponent(from)}` : '?worlds=1';
}
