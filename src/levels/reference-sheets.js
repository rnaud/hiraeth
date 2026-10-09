// The reference sheets (about 39 MB of JPEGs) never go to the devices: the over-the-air zip skips them
// (scripts/web-update.mjs, SHEET_FILE; Workers serve at most 25 MiB a file) and the APK and the Deck package
// strip them (scripts/site-only.mjs). The site still serves them, so a bundled game (the Android app at
// 127.0.0.1:41730, the Deck at moebius://game) reads them from there. The recorded themes but the desert's
// are fetched from the site the same way, and kept (src/music-store.js).

export const SHEET_SITE = 'https://memento.alexandria-rnaud.workers.dev/';
const APP_HOST = '127.0.0.1:41730';
const XBOX_HOST = 'hiraeth.example';   // (the Xbox app's virtual host: src/xbox.js XBOX_HOST)

/**
 * Is this page a game carried by a device (the APK or one of its over-the-air bundles, the Deck's package or
 * its downloaded game, the Xbox app), rather than the site or the dev server? GeckoView's loopback server (127.0.0.1:41730),
 * the Xbox app's https://hiraeth.example,
 * the Deck's moebius://game, any other non-http page, and the Android WebView fallback (Capacitor's
 * https://localhost, no port).
 */
export function bundledGame(here = globalThis.location) {
  if (!here) return false;
  return !/^https?:$/.test(here.protocol) || here.host === APP_HOST || here.host === XBOX_HOST || (here.protocol === 'https:' && here.host === 'localhost');
}

/** Where a sheet's image is read from: its own URL on the site and the dev server, the site's in a bundle. */
export function sheetSrc(url, here = globalThis.location) {
  if (!url || !here) return url;
  if (!bundledGame(here)) return url;
  const path = new URL(url, here.href).pathname.replace(/^\/+/, '');
  return new URL(path, SHEET_SITE).href;
}
