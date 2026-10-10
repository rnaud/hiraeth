// The title's still: a picture of the shot's world, drawn by the game ahead of time (scripts/title-shots.mjs
// --stills, public/title-stills/<id>.jpg), shown the moment the title opens; the live world (src/title-world.js)
// fades in over it when it is ready, or never comes where building it costs too much (docs/systems/xbox.md,
// "The 100-second title").
//
// On the Xbox each world's GPU programs take 20-100 s to compile and link (ANGLE on D3D11: about a second for each
// surface program, 16-28 s for the ink pass; the driver's part isn't kept between launches), and every program's
// first use blocks the page for up to 4 s meanwhile: the title keeps its still there. Elsewhere a world whose build
// ran past TITLE_SLOW_MS is remembered for that GPU, and the titles after it keep the still too.

/** ms from the world's first stage to its first frame past which that GPU's later titles keep the still. */
export const TITLE_SLOW_MS = 25000;
/** Where the slow GPUs are remembered (a global key, not a save's): { [gpu]: ms of its last world build }. */
export const SLOW_KEY = 'moebius.title.slow';
/** The narrowest screen the still is shown on (width / height): it is framed at 16:9, a phone held upright crops it away. */
export const STILL_MIN_ASPECT = 1.2;

/** The still's file for a shot (relative to the page, as the saves' thumbnails). */
export const stillUrl = (shot) => `title-stills/${shot.id}.jpg`;

const read = (storage) => {
  try { const v = JSON.parse(storage?.getItem(SLOW_KEY) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};

/**
 * Is the live world worth building here? `?vista=live` builds it anyway, `?vista=still` never (testing). On the Xbox,
 * no. Elsewhere yes, unless `gpu` is given and its last build was remembered as slow (rememberBuild).
 */
export function liveWorld({ xbox = false, search = '', storage = null, gpu = null } = {}) {
  const asked = new URLSearchParams(search).get('vista');
  if (asked === 'live') return true;
  if (asked === 'still' || xbox) return false;
  if (gpu === null) return true;
  return !(read(storage)[gpu] > TITLE_SLOW_MS);
}

/** Remember how long the world took to build on this GPU (only a slow one is kept; a fast build forgets it). */
export function rememberBuild(storage, gpu, ms) {
  if (!storage || !gpu || !Number.isFinite(ms)) return;
  const all = read(storage);
  if (ms > TITLE_SLOW_MS) all[gpu] = Math.round(ms); else delete all[gpu];
  try { if (Object.keys(all).length) storage.setItem(SLOW_KEY, JSON.stringify(all)); else storage.removeItem(SLOW_KEY); } catch { /* full */ }
}

/** Show the still on this screen? (a shot, a screen wide enough for its 16:9 framing) */
export const showStill = (shot, w, h) => !!shot && h > 0 && w / h >= STILL_MIN_ASPECT;
