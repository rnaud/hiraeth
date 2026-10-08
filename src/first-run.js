// A brand-new profile is not an update. The "Updated to v… · what's new is in the settings"
// toast (src/main.js) shows when the changelog's seen mark (src/changelog.js SEEN_KEY) differs
// from this version. A first-time player has no mark at all, and used to be greeted with it.
// boot.js calls quietFirstRun() before the title screen writes anything: no seen mark AND no
// save in any slot (nor the single save from before the slots) marks this version seen,
// silently. A player coming from an older version (a mark, or a save) still gets the toast.
//
//   import { quietFirstRun } from './first-run.js';
//   quietFirstRun(localStorage, VERSION)   // true when it was a fresh profile (and is now marked)

import { PROGRESS_KEYS, SLOT_COUNT, slotKey } from './save-slots.js';

/** The changelog's "seen" mark (the same key src/changelog.js reads; tests/first-run.test.js checks it). */
export const SEEN_KEY = 'moebius.changelog.seen';

const read = (storage, k) => { try { return storage?.getItem(k) ?? null; } catch { return null; } };

/** Any progress on this profile: a slot in use, or the save from before the slots. */
export function hasAnySave(storage) {
  for (const k of PROGRESS_KEYS) {
    if (read(storage, k) != null) return true;   // (before the slots)
    for (let n = 1; n <= SLOT_COUNT; n++) if (read(storage, slotKey(k, n)) != null) return true;
  }
  return false;
}

/** Never seen a version and never saved: a first visit, not an update. */
export const isFreshProfile = (storage) => read(storage, SEEN_KEY) == null && !hasAnySave(storage);

/** A first visit counts this version as seen (no "Updated to" toast). Returns whether it did. */
export function quietFirstRun(storage, version) {
  if (!storage || !isFreshProfile(storage)) return false;
  try { storage.setItem(SEEN_KEY, version); } catch { return false; }
  return true;
}
