// Made by scripts/theme-levels.mjs: the gain src/soundtracks.js prepareSoundtrack gives each recording (THEME_RMS dB RMS
// with a peak cap, its tail joined to its opening), for the engines, which decode and stream the MP3s themselves and never
// hold their samples (engine/webaudio.js NativeAudioBuffer). Run it again when a recording is added or replaced, or the
// target changes (tests/soundtracks.test.js fails while THEME_TARGET is not src/soundtracks.js's).
export const THEME_TARGET = { rms: -21, peak: 0.8 };
export const THEME_LEVELS = {
  'arzach.mp3': 0.7451,
  'arzach2.mp3': 0.6826,
  'battle-trouble-finds-you.mp3': 0.7541,
  'bazaar.mp3': 0.6687,
  'buried.mp3': 0.6502,
  'desert-bayati.mp3': 0.6899,
  'edena-wild-bloom.mp3': 0.7538,
  'glassdunes-impossible-reflections.mp3': 0.5884,
  'home.mp3': 0.3778,
  'incal-streets-above-streets.mp3': 0.7064,
  'moonfoundry-makers-groove.mp3': 0.7654,
  'overnighttrain.mp3': 0.7235,
  'perdide-swamp-mischief.mp3': 0.5531,
  'perdide2.mp3': 0.7143,
  'prologue-before-the-message.mp3': 0.599,
  'spacecity-beyond-the-horizon.mp3': 0.6631,
  'spheres.mp3': 0.6396,
  'title-french-touch.mp3': 0.6107,
  'underwater-life-under-pressure.mp3': 0.5971,
};
// each recording's loudest sample at that gain, dBFS (under the cap, 20 log10(THEME_PEAK): nothing clips)
export const THEME_PEAKS = {
  'arzach.mp3': -6.8,
  'arzach2.mp3': -7.6,
  'battle-trouble-finds-you.mp3': -6.8,
  'bazaar.mp3': -7.5,
  'buried.mp3': -7.4,
  'desert-bayati.mp3': -7.2,
  'edena-wild-bloom.mp3': -5.7,
  'glassdunes-impossible-reflections.mp3': -8.2,
  'home.mp3': -11.2,
  'incal-streets-above-streets.mp3': -5.6,
  'moonfoundry-makers-groove.mp3': -6,
  'overnighttrain.mp3': -7.3,
  'perdide-swamp-mischief.mp3': -9.2,
  'perdide2.mp3': -7.2,
  'prologue-before-the-message.mp3': -8.8,
  'spacecity-beyond-the-horizon.mp3': -7.8,
  'spheres.mp3': -6.7,
  'title-french-touch.mp3': -8,
  'underwater-life-under-pressure.mp3': -8.6,
};
