// The opening's beats photographed for the web-against-Unity check (issue #394): each a stage of the prologue
// (src/ship/prologue.js PROLOGUE_STAGES) and how far into it, the same on both sides. Since issue #429 they are the
// 'opening' sequence of engine/sequences.js (scripts/unity-compare/sequences.mjs; Unity's -opening is -sequence opening);
// at `console` the traveller is put at the cockpit's point (the voicemail's prompt over its button) and E plays the message.
export const OPENING_BEATS = [
  { name: 'wake', stage: 'wake', t: 3.5 },
  { name: 'walk', stage: 'walk', t: 1.5 },
  { name: 'console', stage: 'walk', t: 2.5, console: true },
  { name: 'call-rise', stage: 'call', t: 1.6 },
  { name: 'call-talk', stage: 'call', t: 8 },
  { name: 'call-late', stage: 'call', t: 20 },
  { name: 'pause-bust', stage: 'pause', t: 1.5 },
  { name: 'pause-window', stage: 'pause', t: 6 },
  { name: 'pass', stage: 'pass', t: 1.8 },
  { name: 'pass-out', stage: 'pass', t: 4.6 },
  { name: 'drain', stage: 'drain', t: 1.5 },
  { name: 'drain-late', stage: 'drain', t: 4.2 },
  { name: 'glide', stage: 'glide', t: 2.6 },
  { name: 'land', stage: 'land', t: 2.2 },
  { name: 'settle', stage: 'settle', t: 2 },
  // (Plumb wakes in its cradle and comes to his shoulder, issue #434)
  { name: 'drone-wake', stage: 'drone', t: 1.4 },
  { name: 'drone-lift', stage: 'drone', t: 3.0 },
  { name: 'drone-shoulder', stage: 'drone', t: 4.9 },
  { name: 'hatch', stage: 'hatch', t: 2.4 },
  { name: 'stepout', stage: 'stepout', t: 2.5 },
  // (down the ramp at a walk, the drone at his shoulder)
  { name: 'stepout-walk', stage: 'stepout', t: 6 },
];

/** Whether a beat is due: its stage reached and that far in, or a later stage already (a slow frame jumped it). */
export function beatDue(beat, stages, stage, t) {
  const want = stages.findIndex((s) => s.id === beat.stage), at = stages.findIndex((s) => s.id === stage);
  if (at < 0) return false;
  return at > want || (at === want && t >= beat.t);
}
