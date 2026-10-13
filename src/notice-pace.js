// How often the notices may speak (issue #221: the hints at the top "appear too often"). The notices queue in
// src/ship/cinema.js (Cinema.toast) and show one at a time; this decides which waiting one goes next, and which are
// let go unsaid:
//
//   - a hint (a toast that teaches: `kind: 'hint'`, or one naming a control, `{key:verb}`) waits until `gap` seconds
//     after the last hint went up; the others (a find, a quest, a world's words) may go ahead of it meanwhile;
//   - a hint not said within `stale` seconds of being asked for is let go (the moment it was for has passed), and so
//     is one whose `done()` says the player has done it already (they found the move on their own);
//   - hints off (the settings' Hints, src/hint-level.js): no hint at all;
//   - the same words twice within `again` seconds: said once (a quest's start excepted).
//
// Pure: the queue's items are { text, kind?, done?, at } (at: when it was asked for, seconds). Tests: tests/notice-pace.test.js.

import { hasKeys } from './prompt-keys.js';

export const PACE = { gap: 20, stale: 45, again: 180 };

/** Is this waiting notice a hint? */
export const isHint = (item) => item?.kind === 'hint' || (item?.kind !== 'quest' && hasKeys(item?.text));

export class NoticePace {
  constructor(o = {}) { this.o = { ...PACE, ...o }; this.lastHint = -Infinity; this.said = new Map(); }

  /**
   * The next notice to show from `queue` at `now` (seconds), hints at `level` ('off' | 'subtle' | 'full'): its index,
   * or −1 for none yet. Takes the ones let go out of the queue (in place).
   */
  next(queue, now, level = 'subtle') {
    const { gap, stale, again } = this.o;
    for (let i = queue.length - 1; i >= 0; i--) {
      const it = queue[i], hint = isHint(it);
      const drop = (hint && (level === 'off' || now - (it.at ?? now) > stale || it.done?.()))
        || (it.kind !== 'quest' && now - (this.said.get(it.text) ?? -Infinity) < again);
      if (drop) queue.splice(i, 1);
    }
    return queue.findIndex((it) => !isHint(it) || now - this.lastHint >= gap);
  }

  /** `item` goes up now. */
  shown(item, now) {
    if (isHint(item)) this.lastHint = now;
    this.said.set(item.text, now);
    if (this.said.size > 200) for (const [k, t] of this.said) if (now - t > this.o.again) this.said.delete(k);
  }
}
