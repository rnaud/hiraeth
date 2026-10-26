// User-starred takes only. House names remain source provenance, never routing.
const vocal = vol => ({ n: 1, ext: 'wav', vol, rate: 0, gain: 0 });
export const ACTION_SFX = {
  'hoverbike-glide': vocal(.075), 'temple-ambience': vocal(.085),
  'hologram-crt': vocal(.18), 'chest-open': vocal(.22), 'key-unlock': vocal(.2),
  // The eight NEXT takes are one shared action vocabulary, never world-specific.
  ...Object.fromEntries(['blade-form', 'shield-bloom', 'fluid-refill', 'voicemail-ready',
    'ship-confirm', 'discovery-reveal', 'low-fluid'].map(k => [k, vocal(.2)])),
  // (the pickup repeats more than any: a little apart each time, ±3 % pitch and ±6 % level, and 0.5 dB down into the
  // cue band; issue #638, docs/systems/audio.md "The mix's hierarchy")
  'small-pickup': { n: 1, ext: 'wav', vol: .19, rate: .03, gain: .06 },
  'vox-attack-light': vocal(.18), 'vox-attack-heavy': vocal(.22), 'vox-attack-follow': vocal(.17),
  'vox-jump-standing': vocal(.16), 'vox-jump-running': vocal(.18),
  // (a hop's soft landing stays with the footsteps: 1.5 dB down, a little apart each hop; issue #638)
  'vox-land-soft': { n: 1, ext: 'wav', vol: .11, rate: .025, gain: .12 }, 'vox-land-heavy': vocal(.2), 'vox-mantle': vocal(.18),
  'vox-run': vocal(.09), 'vox-recover': vocal(.12),
  'temple-slide-open': { n: 3, ext: 'wav', vol: .22, rate: 0, gain: .04 },
  'temple-locked': { n: 1, ext: 'wav', vol: .17, rate: 0, gain: 0 },
  'temple-mechanism': { n: 1, ext: 'wav', vol: .2, rate: 0, gain: 0 },
  'treasure-reveal': { n: 1, ext: 'wav', vol: .22, rate: 0, gain: 0 },
  'quest-important': { n: 2, ext: 'wav', vol: .2, rate: 0, gain: 0 },
};
