// Downloaded Suno originals; provenance is recorded in public/music/manifest.json. On a device only the desert's (and the title's)
// is in the bundle; the others are downloaded from the site in the background and kept (src/music-store.js).
import { bundledGame } from './levels/reference-sheets.js';
import { keepTheme, pageThemeStore, startThemeDownload, themeSources } from './music-store.js';
export const SOUNDTRACKS = {
  home: 'home.mp3',
  lantern: 'home.mp3',   // (the Lantern: home's own theme, at Ilen's)
  moonfoundry: 'moonfoundry.mp3',
  underside: 'underside.mp3',
  spacecity: 'spacecity.mp3',
  overnighttrain: 'overnighttrain.mp3',
  glassdunes: 'glassdunes.mp3',
  underwater: 'underwater.mp3',
  eclipse: 'eclipse.mp3',
  fallenring: 'fallenring.mp3',
  saltharbour: 'saltharbour.mp3',
  waterfall: 'waterfall.mp3',
  antennas: 'antennas.mp3',
  atelier: 'atelier.mp3',
  perdide: 'perdide.mp3',
  perdide2: 'perdide2.mp3',
  bazaar: 'bazaar.mp3',
  mangrove: 'mangrove.mp3',
  garage: 'garage.mp3',
  buried: 'buried.mp3',
  edena: 'edena.mp3',
  spheres: 'spheres.mp3',
  desert: 'desert.mp3',
  incal: 'incal.mp3',
  arzach: 'arzach.mp3',
  arzach2: 'arzach2.mp3',
};

/**
 * Short recorded cues, not a world's theme: played once at a moment, not looped (src/audio.js playCue). A cue's
 * file may not be there yet: the game sings its synth version until it is (the singing light's theme:
 * src/story/light-theme.js; its Suno brief is in docs/systems/audio.md). Dropping the file into public/music/
 * (and its entry into manifest.json) is all a recording needs.
 */
export const CUES = {
  'singing-light': 'singing-light.mp3',
};

/**
 * Load a cue into `sound.cues[id]` if its file is there (the bundle, else a copy a device kept): true when it
 * decoded. Never throws; a missing file (a dev server answers with its page) is simply false.
 */
export async function loadCue(sound, id, fetcher = globalThis.fetch, { here = globalThis.location, store } = {}) {
  const file = CUES[id];
  if (!file || !sound?.ctx || !fetcher) return false;
  if (sound.cues?.[id]) return true;
  if (store === undefined) store = bundledGame(here) ? pageThemeStore() : null;
  try {
    for await (const { blob } of themeSources(file, { here, store, fetcher })) {
      try {
        const buf = await sound.ctx.decodeAudioData(await blob.arrayBuffer());
        (sound.cues ??= {})[id] = buf;
        return true;
      } catch { /* not audio: try the next */ }
    }
  } catch { /* offline, or no store today */ }
  return false;
}

/** Join the last two seconds to the opening and balance the score beneath speech. */
export function prepareSoundtrack(ctx, original) {
  const fade = Math.min(Math.floor(original.sampleRate * 2), Math.floor(original.length / 4));
  const length = original.length - fade;
  const buffer = ctx.createBuffer(original.numberOfChannels, length, original.sampleRate);
  let sum = 0, peak = 0;
  for (let ch = 0; ch < original.numberOfChannels; ch++) {
    const input = original.getChannelData(ch), output = buffer.getChannelData(ch);
    output.set(input.subarray(0, length));
    for (let i = 0; i < fade; i++) {
      const mix = i / Math.max(1, fade - 1);
      output[i] = input[length + i] * (1 - mix) + input[i] * mix;
    }
    for (const value of output) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
  }
  const rms = Math.sqrt(sum / (length * original.numberOfChannels));
  const gain = rms > 0 ? Math.min(10 ** (-27 / 20) / rms, 0.8 / peak, 4) : 1;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  return buffer;
}

/**
 * The title screen's own recording (manifest.json "title"; carried by the devices: src/music-store.js
 * ON_DEVICE_THEMES, since it is the first thing the game plays). Not a world's theme: the title's Sound plays it
 * on the menu bus in place of the procedural menu music (src/audio.js playTitleTheme).
 */
export const TITLE_THEME = 'title.mp3';

/**
 * Load the title's recording and hand it, balanced and joined for looping (prepareSoundtrack), to
 * sound.playTitleTheme. Until then, and for good when it can't (a failed download, a file that doesn't decode, an
 * engine bridge without a decoder), the procedural menu music plays. Never throws; true when it is playing.
 */
export async function loadTitleTheme(sound, fetcher = globalThis.fetch, { here = globalThis.location } = {}) {
  const ctx = sound?.ctx;
  if (!ctx || !fetcher || typeof ctx.decodeAudioData !== 'function' || sound._disposed) return false;
  const abort = sound.titleAbort = typeof AbortController === 'function' ? new AbortController() : null;
  let lastError = null;
  try {
    for await (const { blob } of themeSources(TITLE_THEME, { here, store: null, fetcher, signal: abort?.signal })) {
      let decoded;
      try { decoded = await ctx.decodeAudioData(await blob.arrayBuffer()); }
      catch (error) { lastError = error; continue; }
      if (sound._disposed || ctx.state === 'closed') return false;
      return !!sound.playTitleTheme?.(prepareSoundtrack(ctx, decoded));
    }
  } catch (error) { lastError = error; }
  if (!sound._disposed) console.warn('Recorded title music unavailable; keeping the procedural menu music.', lastError ?? TITLE_THEME);
  return false;
}

/** The theme files, once each (home and the Lantern share one). */
export const THEME_FILES = [...new Set(Object.values(SOUNDTRACKS))];

/**
 * Keep procedural music until a recording has loaded and decoded successfully: the bundle's, or the one a
 * device kept (src/music-store.js themeSources). On a device without it yet, the background download
 * (themeDownloader) fetches this world's first, and it comes in on the next moment the theme plays
 * (src/music-moments.js), faded, not on top of what is playing.
 * @param o.here the page's location, o.store the kept themes (default: IndexedDB on a device), o.downloader
 *   the page's background download (default: startThemeDownload)
 */
export async function loadSoundtrack(sound, fetcher = globalThis.fetch, { here = globalThis.location, store, downloader } = {}) {
  const file = SOUNDTRACKS[sound.levelId];
  if (!sound.score || !file || !fetcher) return false;
  const ctx = sound.ctx;
  const abort = sound.trackAbort = typeof AbortController === 'function' ? new AbortController() : null;
  const device = bundledGame(here);
  if (store === undefined) store = device ? pageThemeStore() : null;
  let lastError = null;
  /** @returns true (playing), false (didn't decode: try the next), null (the world is gone) */
  const play = async (blob, from, keep) => {
    let decoded;
    try { decoded = await ctx.decodeAudioData(await blob.arrayBuffer()); }
    catch (error) {
      lastError = error;
      if (from === 'stored') void store?.delete?.(file)?.catch?.(() => {});   // (a damaged copy: the download fetches it again)
      return false;
    }
    if (sound._disposed || ctx.state === 'closed') return null;
    if (keep) void keepTheme(store, file, blob);
    startTrack(sound, decoded, { late: from === 'site' });
    sound.trackFrom = from;
    return true;
  };
  try {
    for await (const { from, blob, keep } of themeSources(file, { here, store, fetcher, signal: abort?.signal })) {
      const ok = await play(blob, from, keep);
      if (ok !== false) return !!ok;
    }
    if (device && store) {
      // not here yet: the background download brings it (this world's first); the score plays meanwhile
      downloader ??= startThemeDownload(THEME_FILES, { first: file });
      downloader.prefer?.(file);
      const blob = await downloader.arrived(file, abort?.signal);
      if (blob && !sound._disposed) { const ok = await play(blob, 'site', false); if (ok !== false) return !!ok; }
    }
    if (!sound._disposed) console.warn('Recorded soundtrack unavailable; keeping the procedural score.', lastError ?? file);
    return false;
  } catch (error) {
    if (!sound._disposed) console.warn('Recorded soundtrack unavailable; keeping the procedural score.', error);
    return false;
  }
}

/** Play a decoded theme: at once (faded in over 2 s), or `late`: ready for the moments to bring in. */
function startTrack(sound, decoded, { late = false } = {}) {
  const ctx = sound.ctx;
  const gain = ctx.createGain();
  sound.trackBuffer = prepareSoundtrack(ctx, decoded);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.connect(sound.music);
  sound.trackGain = gain;
  if (late) { sound.trackOn = false; return; }   // (Sound.musicMomentsUpdate starts it, faded, when a moment wants it)
  const source = ctx.createBufferSource();
  source.buffer = sound.trackBuffer;
  source.loop = true;
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
  source.connect(gain);
  source.start(ctx.currentTime);
  sound.recordedTrack = source;
  sound.trackOn = true;   // (from here Sound.musicMomentsUpdate fades it in and out: src/music-moments.js)
}
