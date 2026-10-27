// Downloaded Suno originals; provenance is recorded in public/music/manifest.json. Device bundles carry the
// desert, title and scene cues; other world themes download in the background (src/music-store.js).
import { bundledGame } from './levels/reference-sheets.js';
import { keepTheme, pageThemeStore, startThemeDownload, themeKey, themeSources } from './music-store.js';
import { THEME_LEVELS } from './theme-levels.js';
import { runSteps, runStepsAsync } from './load-steps.js';
export const SOUNDTRACKS = {
  home: 'home.mp3',
  lantern: 'home.mp3',   // (the Lantern: home's own theme, at Ilen's)
  moonfoundry: 'moonfoundry-makers-groove.mp3',
  spacecity: 'spacecity-beyond-the-horizon.mp3',
  overnighttrain: 'overnighttrain.mp3',
  glassdunes: 'glassdunes-impossible-reflections.mp3',
  underwater: 'underwater-life-under-pressure.mp3',
  perdide: 'perdide-swamp-mischief.mp3',
  perdide2: 'perdide2.mp3',
  bazaar: 'bazaar.mp3',
  buried: 'buried.mp3',
  edena: 'edena-wild-bloom.mp3',
  spheres: 'spheres.mp3',
  desert: 'desert-bayati.mp3',   // (issue #207: "Descent into D Bayati", made to sit with its new score; the old desert.mp3 retired)
  incal: 'incal-streets-above-streets.mp3',
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

/**
 * The recordings' balance: each brought to THEME_RMS dB RMS (its tail joined to its opening), never past THEME_PEAK at
 * its loudest sample. -27 until issue #530: the Suno themes then played 6 to 7 dB under the procedural score the
 * effects and the voices were balanced against (the desert -31.6 dBFS against -24.6), so every effect sat over them.
 * At -21 none of them meets the cap (the loudest sample of all, the waterfall's, -5.8 dBFS against the cap's -1.9:
 * src/theme-levels.js THEME_PEAKS); scripts/theme-levels.mjs measures the engines' gains with this.
 */
export const THEME_RMS = -21;
export const THEME_PEAK = 0.8;

/** Join the last two seconds to the opening and balance the score beneath speech. */
export function prepareSoundtrack(ctx, original) { return runSteps(prepareSoundtrackSteps(ctx, original)); }

const CHUNK = 1 << 18;   // samples between yields (a few ms): a three-minute stereo track was one 170 ms task
/** prepareSoundtrack in steps (src/load-steps.js runStepsAsync): the page keeps answering while it runs. */
export function* prepareSoundtrackSteps(ctx, original) {
  if (original?.native) return nativeSoundtrack(original);
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
    for (let i = 0; i < output.length; i++) {
      const value = output[i];
      sum += value * value; peak = Math.max(peak, Math.abs(value));
      if (i % CHUNK === CHUNK - 1) yield;
    }
  }
  const rms = Math.sqrt(sum / (length * original.numberOfChannels));
  const gain = rms > 0 ? Math.min(10 ** (THEME_RMS / 20) / rms, THEME_PEAK / peak, 4) : 1;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) { data[i] *= gain; if (i % CHUNK === CHUNK - 1) yield; }
  }
  return buffer;
}

/**
 * An engine's recording (engine/webaudio.js NativeAudioBuffer: Unity decodes and streams the MP3, the script never holds
 * its samples): the same join and balance, the engine crossfading the tail into the opening as it loops, at the gain
 * prepareSoundtrack measured on the file (src/theme-levels.js, scripts/theme-levels.mjs).
 */
export function nativeSoundtrack(original) {
  const fade = Math.min(Math.floor(original.sampleRate * 2), Math.floor(original.length / 4));
  return original.joined(fade, THEME_LEVELS[themeKey(original.file ?? '')] ?? 1);
}

/**
 * The title screen's own recording (manifest.json "title"; carried by the devices: src/music-store.js
 * ON_DEVICE_THEMES, since it is the first thing the game plays). Not a world's theme: the title's Sound plays it
 * on the menu bus in place of the procedural menu music (src/audio.js playTitleTheme).
 */
export const TITLE_THEME = 'title-french-touch.mp3';
export const SCENE_THEMES = { battle: 'battle-trouble-finds-you.mp3', prologue: 'prologue-before-the-message.mp3' };

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
      const buffer = await runStepsAsync(prepareSoundtrackSteps(ctx, decoded));
      if (sound._disposed || ctx.state === 'closed') return false;
      return !!sound.playTitleTheme?.(buffer);
    }
  } catch (error) { lastError = error; }
  if (!sound._disposed) console.warn('Recorded title music unavailable; keeping the procedural menu music.', lastError ?? TITLE_THEME);
  return false;
}

let themeWait = null;
/**
 * Where a theme comes from when it is neither in the bundle nor kept and there is no page store: an engine's player
 * downloads it itself (Unity's BridgeMusic.Fetch), and `wait(file, { signal, gone })` resolves with its Blob once it is
 * there (null when the world is gone first). Before issue #471 nothing waited: the world played the procedural score
 * for its whole visit, the recording only from the next load.
 */
export function setThemeWait(wait) { themeWait = wait ?? null; }

/** The theme files, once each (home and the Lantern share one). */
export const THEME_FILES = [...new Set([...Object.values(SOUNDTRACKS), ...Object.values(SCENE_THEMES)])];

/**
 * Keep procedural music until a recording has loaded and decoded successfully: the bundle's, or the one a
 * device kept (src/music-store.js themeSources). On a device without it yet, the background download
 * (themeDownloader) fetches this world's first; in an engine its player does (setThemeWait). Either way it takes
 * over as soon as it arrives, faded in as on arriving (an arrival moment, src/music-moments.js; issue #471).
 * @param o.here the page's location, o.store the kept themes (default: IndexedDB on a device), o.downloader
 *   the page's background download (default: startThemeDownload), o.wait an engine's wait (default: setThemeWait's)
 */
export async function loadSoundtrack(sound, fetcher = globalThis.fetch, { here = globalThis.location, store, downloader, wait = themeWait } = {}) {
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
    // not here yet: the score plays meanwhile, and the recording takes over the moment it arrives (issue #471)
    let blob = null;
    if (device && store) {
      // a page on a device: the background download brings it (this world's first)
      downloader ??= startThemeDownload(THEME_FILES, { first: file });
      downloader.prefer?.(file);
      blob = await downloader.arrived(file, abort?.signal);
    } else if (wait) {
      // an engine whose player downloads it itself (Unity's APK and Xbox package: engine/unity/music.js themeArrival)
      blob = await wait(file, { signal: abort?.signal, gone: () => !!sound._disposed });
    }
    if (blob && !sound._disposed) { const ok = await play(blob, 'site', false); if (ok !== false) return !!ok; }
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
  gain.connect(sound.musicLane?.('theme') ?? sound.music);   // (the theme's lane: one music at a time, src/music-owner.js)
  sound.trackGain = gain;
  // (Sound.musicMomentsUpdate starts it, faded, when a moment wants it; held back, the prologue in the ship: issue #149)
  // (a recording that arrived while the score played, downloaded: it takes over now, faded in as on arriving, not at
  // the next moment minutes away; issue #471)
  if (late || sound.themeHeld || (sound.fightOn ?? sound.sceneMusic?.battleActive)) {
    sound.trackOn = false;
    if (late && !sound.themeHeld) sound.moments?.cue?.('arrival', ctx.currentTime);
    return;
  }
  sound.trackOn = true;   // (from here Sound.musicMomentsUpdate fades it in and out: src/music-moments.js)
  // (its lane fades it in once the score before it is out, src/music-owner.js: it starts there, from its opening)
  const at = sound.musicOwnerUpdate ? (sound.musicOwnerUpdate(), sound.musicOwner?.startAt('theme') ?? ctx.currentTime) : ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = sound.trackBuffer;
  source.loop = true;
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
  source.connect(gain);
  source.start(at);
  sound.recordedTrack = source;
}


/** Preload encounter cues so an enemy's appearance never waits for a network request. */
export async function loadSceneThemes(sound, fetcher = globalThis.fetch, { here = globalThis.location, store, wait = themeWait } = {}) {
  if (!sound.ctx || !sound.sceneMusic || !fetcher) return;
  const abort = sound.sceneAbort = typeof AbortController === 'function' ? new AbortController() : null;
  const device = bundledGame(here);
  if (store === undefined) store = device ? pageThemeStore() : null;
  for (const [id, file] of Object.entries(SCENE_THEMES)) {
    if (sound._disposed) return;
    if (id === 'prologue' && sound.levelId !== 'desert') continue;
    const adopt = async (blob) => {
      const decoded = await sound.ctx.decodeAudioData(await blob.arrayBuffer());
      if (sound._disposed || sound.ctx.state === 'closed') return false;
      const buffer = await runStepsAsync(prepareSoundtrackSteps(sound.ctx, decoded));
      if (sound._disposed) return false;
      sound.sceneMusic.install(id, buffer);
      return true;
    };
    try {
      let loaded = false;
      for await (const { blob } of themeSources(file, { here, store, fetcher, signal: abort?.signal })) {
        try { loaded = await adopt(blob); } catch { /* try the next source */ }
        if (loaded || sound._disposed) break;
      }
      if (!loaded && !sound._disposed) {
        // Retry through the shared theme loader when a source is temporarily unavailable.
        const pending = device && store ? startThemeDownload(THEME_FILES, { first: file }).arrived(file, abort?.signal)
          : wait ? wait(file, { signal: abort?.signal, gone: () => !!sound._disposed }) : null;
        if (pending) void Promise.resolve(pending).then(blob => blob && !sound._disposed && adopt(blob)).catch(() => {});
      }
    } catch { /* the existing procedural cue remains available offline */ }
  }
}
