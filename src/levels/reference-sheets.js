// The reference sheets (about 39 MB of JPEGs) never go to the devices: the over-the-air zip skips them
// (scripts/web-update.mjs, SHEET_FILE; Workers serve at most 25 MiB a file) and the APK and the Deck package
// strip them (scripts/site-only.mjs). The site still serves them, so a bundled game (the Android app at
// 127.0.0.1:41730, the Deck at moebius://game) reads them from there.

export const SHEET_SITE = 'https://memento.alexandria-rnaud.workers.dev/';
const APP_HOST = '127.0.0.1:41730';

/** Where a sheet's image is read from: its own URL on the site and the dev server, the site's in a bundle. */
export function sheetSrc(url, here = globalThis.location) {
  if (!url || !here) return url;
  const bundled = !/^https?:$/.test(here.protocol) || here.host === APP_HOST;
  if (!bundled) return url;
  const path = new URL(url, here.href).pathname.replace(/^\/+/, '');
  return new URL(path, SHEET_SITE).href;
}
