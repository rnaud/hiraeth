// Downloaded Suno originals; provenance is recorded in public/music/manifest.json.
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

/** Keep procedural music until a local recording has loaded and decoded successfully. */
export async function loadSoundtrack(sound, fetcher = globalThis.fetch) {
  const file = SOUNDTRACKS[sound.levelId];
  if (!sound.score || !file || !fetcher) return false;
  const ctx = sound.ctx;
  const abort = sound.trackAbort = typeof AbortController === 'function' ? new AbortController() : null;
  try {
    const response = await fetcher(`${import.meta.env?.BASE_URL ?? './'}music/${file}`, { signal: abort?.signal });
    if (!response.ok) throw new Error(`Soundtrack HTTP ${response.status}`);
    const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
    if (sound._disposed || ctx.state === 'closed') return false;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = prepareSoundtrack(ctx, decoded);
    source.loop = true;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    source.connect(gain).connect(sound.music);
    source.start(ctx.currentTime);
    sound.recordedTrack = source;
    return true;
  } catch (error) {
    if (!sound._disposed) console.warn('Recorded soundtrack unavailable; keeping the procedural score.', error);
    return false;
  }
}
