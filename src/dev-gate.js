// Who sees the debug entries: the title screen's Debug button (the worlds list) and the
// Start menu's "Debug: worlds". Players don't; the author does, through the same switch as
// the in-game Developer panel (Settings → Developer panel, src/ui.js `devPanel`), or:
//   - a dev build (`npx vite` / import.meta.env.DEV),
//   - ?dev=1 on the URL, remembered on this device ('moebius.dev'; ?dev=0 forgets it).
//
//   import { devMode } from './dev-gate.js';
//   devMode({ settings })   // true: show the debug entries

export const DEV_KEY = 'moebius.dev';

// For now (2026-10-08, the author's call) everyone sees the debug entries, the published game too.
// Set false to hide them from players again; the switches above then decide.
export const ALWAYS_DEV = true;

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
