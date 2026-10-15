// The recorded music in Unity (docs/systems/engine-bridge.md, "The recorded music"): Unity decodes the game's MP3s (the
// worlds' themes, the title's, the cues), which the Web Audio shim can't, and plays them where the game's graph says
// (BridgeMusic.cs). Here: the shim's decoder (engine/webaudio.js setAudioDecoder), which hands a fetched music file over
// to Unity by its path and answers with a NativeAudioBuffer once Unity has it; and the themes the package doesn't carry,
// downloaded once as the web app does (src/music-store.js).
import { fetchedPath } from '../platform.js';
import { THEME_FILES } from '../../src/soundtracks.js';
import { ON_DEVICE_THEMES } from '../../src/music-store.js';
import { SHEET_SITE } from '../../src/levels/reference-sheets.js';

const pending = new Map();   // Unity's clip id → the decodes waiting on it [{ resolve, reject, path }]

/** Only music: the effects (src/sfx.js) stay as they are in the engines. */
export const MUSIC_FILE = /^music\/[^/]+\.mp3$/i;

/**
 * decodeAudioData's engine side: the bytes fetch gave (their path under public/, engine/platform.js fetchedPath) opened by
 * Unity (BridgeHost.MusicLoad). Resolves { native, file, numberOfChannels, length, sampleRate } when Unity has decoded it
 * (pollMusic), rejects for anything else (the procedural score goes on, as before).
 */
export function musicDecoder(host) {
  return (data) => {
    const path = fetchedPath(data);
    if (!path || !MUSIC_FILE.test(path) || !host?.MusicLoad) throw new Error(`decodeAudioData: the engine decodes only the music (${path ?? 'bytes from nowhere'})`);
    const id = host.MusicLoad(path);
    if (!(id > 0)) throw new Error(`decodeAudioData: no music in this player (${path})`);
    return new Promise((resolve, reject) => { const w = pending.get(id) ?? []; w.push({ resolve, reject, path }); pending.set(id, w); });
  };
}

/** Every frame: the decodes Unity has finished (BridgeHost.MusicState: "" not yet, "ok,channels,samples,frequency", "fail,why"). */
export function pollMusic(host) {
  if (!pending.size) return;
  for (const [id, waits] of pending) {
    const s = String(host.MusicState(id) ?? '');
    if (!s) continue;
    pending.delete(id);
    const [k, ...rest] = s.split(',');
    for (const w of waits) {
      if (k === 'ok') w.resolve({ native: id, file: w.path, numberOfChannels: +rest[0], length: +rest[1], sampleRate: +rest[2] });
      else w.reject(new Error(`Unity could not decode ${w.path}: ${rest.join(',')}`));
    }
  }
}

/**
 * The themes to download where the package has none (BridgeMusic.Fetch: into persistentDataPath, once, from 8 s on, the
 * world being played first), as "file url;…", and the ones every package carries (ON_DEVICE_THEMES).
 */
export function themeDownloads(first = null) {
  const files = THEME_FILES.filter((f) => !ON_DEVICE_THEMES.includes(f));
  if (first && files.includes(first)) files.sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
  const site = SHEET_SITE.replace(/\/?$/, '/');
  return { list: files.map((f) => `${f} ${site}music/${f}`).join(';'), carried: ON_DEVICE_THEMES.join(',') };
}
