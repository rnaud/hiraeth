// User-starred takes only. House names remain source provenance, never routing.
const vocal = vol => ({ n: 1, ext: 'wav', vol, rate: 0, gain: 0 });
export const ACTION_SFX = {
  // The eight NEXT takes are one shared action vocabulary, never world-specific.
  ...Object.fromEntries(['blade-form', 'shield-bloom', 'fluid-refill', 'voicemail-ready',
    'ship-confirm', 'small-pickup', 'discovery-reveal', 'low-fluid'].map(k => [k, vocal(.2)])),
  'vox-attack-light': vocal(.18), 'vox-attack-heavy': vocal(.22), 'vox-attack-follow': vocal(.17),
  'vox-jump-standing': vocal(.16), 'vox-jump-running': vocal(.18),
  'vox-land-soft': vocal(.13), 'vox-land-heavy': vocal(.2), 'vox-mantle': vocal(.18),
  'vox-run': vocal(.09), 'vox-recover': vocal(.12),
  'temple-slide-open': { n: 3, ext: 'wav', vol: .22, rate: 0, gain: .04 },
  'temple-locked': { n: 1, ext: 'wav', vol: .17, rate: 0, gain: 0 },
  'temple-mechanism': { n: 1, ext: 'wav', vol: .2, rate: 0, gain: 0 },
  'treasure-reveal': { n: 1, ext: 'wav', vol: .22, rate: 0, gain: 0 },
  'quest-important': { n: 2, ext: 'wav', vol: .2, rate: 0, gain: 0 },
};
