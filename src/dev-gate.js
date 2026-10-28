// Who sees the debug entries: the title screen's Debug button (the worlds list) and the
// Start menu's "Debug: worlds". Players don't; the author does, through the same switch as
// the in-game Developer panel (Settings → Developer panel, src/ui.js `devPanel`), or:
//   - L3 + R3 (F2, `) on the title, remembered on this device as ?dev=1 is (toggleDevMode),
//   - a dev build (`npx vite` / import.meta.env.DEV),
//   - ?dev=1 on the URL, remembered on this device ('hiraeth.dev'; ?dev=0 forgets it).
//
//   import { devMode } from './dev-gate.js';
//   devMode({ settings })   // true: show the debug entries

export const DEV_KEY = 'hiraeth.dev';

// Public play starts clean. Admin links deliberately open developer tools with ?dev=1.
// This is presentation gating, never authorization for private server data.
export const ALWAYS_DEV = false;

const env = () => { try { return import.meta.env ?? {}; } catch { return {}; } };
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const defaultSearch = () => globalThis.location?.search ?? '';

/** ?dev=1 / ?dev=0 on this page: remember it (or forget it). */
export function readDevParam(search = defaultSearch(), storage = defaultStorage()) {
  const v = new URLSearchParams(search).get('dev');
  try {
    if (v === '1') storage?.setItem(DEV_KEY, '1');
    else if (v === '0') storage?.removeItem(DEV_KEY);
  } catch { /* private mode */ }
}

/** Show the author's debug entries? */
export function devMode({ always = ALWAYS_DEV, settings = null, search = defaultSearch(), storage = defaultStorage(), dev = !!env().DEV } = {}) {
  readDevParam(search, storage);
  if (always || dev || settings?.devPanel) return true;
  try { return storage?.getItem(DEV_KEY) === '1'; } catch { return false; }
}

/** L3 + R3 (F2, `) on the title (issue #734): the debug entries on or off on this device, remembered. True: on now. */
export function toggleDevMode({ settings = null, storage = defaultStorage(), dev = !!env().DEV, always = ALWAYS_DEV } = {}) {
  const on = !devMode({ settings, storage, dev, always, search: '' });
  try {
    if (on) storage?.setItem(DEV_KEY, '1');
    else storage?.removeItem(DEV_KEY);
  } catch { /* private mode */ }
  return devMode({ settings, storage, dev, always, search: '' });
}
