// Shared packaging policy, independent of archive IO, publishing and engine builds.
import { ON_DEVICE_THEMES } from '../src/music-store.js';

export const SITE = 'https://hiraeth.alexandria-rnaud.workers.dev/';
export const UPDATES = 'updates';
/** Workers static assets: 25 MiB per file, 20,000 files per version on the free plan. */
export const MAX_FILE = 25 * 1024 * 1024;
export const MAX_FILES = 20000;
export const UPDATE_PART = 20 * 1024 * 1024;

/** The References level's sheets (assets/IMG_<n>-<hash>.JPG, ~18 MB) stay out of the zip: the site serves
 * them to bundled games (src/levels/reference-sheets.js), and with them the zip passed Workers' 25 MiB. */
export const SHEET_FILE = /^assets\/(IMG_\d+|reference-\d+)-[\w-]+\.jpe?g$/i;   // (the new worlds' sheets are reference-1 … 4.jpeg)
/** The interactive changelog's pictures (changelog-media/, docs/systems/changelog.md) are the site's alone:
 * the build never holds them (the deploy copies them in after this zip and the Deck's runtime are made),
 * and if they ever were in dist/ they would still stay out of the zip, the APK and the Deck. */
export const MEDIA_FILE = /^changelog-media(\/|$)/;
/** The audits page's data and the reports' pictures (dist/audits/: scripts/audits-data.mjs) are the site's alone too:
 * audits.html, small, ships with the game and reads them from the site. */
export const AUDIT_FILE = /^audits\//;
/** The references page's index, thumbnails and web-size copies (dist/references/: scripts/references-site.mjs,
 * ≈ 70 MB) are the site's alone: references.html, small, ships with the game and reads them from the site. */
export const REFERENCE_FILE = /^references(\/|$)/;
/** The lore page's pictures (public/lore-pictures/: scripts/lore-pictures.mjs, the reference picks made small) are the
 * site's alone: lore.html, small, ships with the game and shows its words without them. */
export const LORE_FILE = /^lore-pictures(\/|$)/;
/** The walkthrough's daily result (dist/walkthrough/status.json: tests/playthrough.test.js writes walkthrough-status.json
 * beside its evidence) is the site's alone: walkthrough.html, small, ships with the game and shows its steps without it. */
export const WALKTHROUGH_FILE = /^walkthrough\//;
/** The site's own configuration (public/_headers: Cloudflare's headers by path, the themes' CORS). */
export const SITE_CONFIG = /^_headers$/;
/** The recorded themes a device fetches from the site the first time it needs one, and keeps (src/music-store.js):
 * every music/*.mp3 but ON_DEVICE_THEMES (the desert's, the title's, the singing light's cue). The zip, the APK and the Deck leave them out (about
 * 99 MB); the site serves them. OTA_MUSIC=1 puts them back in the zip, for a hand-over update: a game that finds
 * them in its bundle keeps them (adoptBundledThemes), so an install from before keeps its soundtrack for good. */
export const onDemand = (name) => /^music\/[^/]+\.mp3$/.test(name) && !ON_DEVICE_THEMES.includes(name.slice('music/'.length));

/** Is a file of dist/ (its path from dist/, with / between folders) one the devices never get? */
export const siteOnly = (rel) => SHEET_FILE.test(rel) || MEDIA_FILE.test(rel) || AUDIT_FILE.test(rel) || REFERENCE_FILE.test(rel) || LORE_FILE.test(rel) || WALKTHROUGH_FILE.test(rel) || SITE_CONFIG.test(rel);
/** Is it a recorded theme a device fetches from the site when it needs it (and keeps)? */
export const fetchedOnDemand = (rel) => onDemand(rel);
/** What the APK and the Deck package leave out: the site's own files and the themes fetched on demand. */
export const leftOff = (rel) => siteOnly(rel) || fetchedOnDemand(rel);

