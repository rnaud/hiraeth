// The Sealed Hangar's sightings (src/story/sightings.js format), as they stood until October 2026, when the world was
// dismissed (src/levels/names.js DISMISSED): nothing reads them now; kept to reuse. A save that met them keeps the flags.

export const HANGAR_SIGHTINGS = [
  { id: 'garage.lune', thread: 'light', world: 'garage', who: 'Lune', line: 'It crossed the ring’s slit, low and slow, and the metal sang back. Then it turned, deliberately.', heard: { who: 'lune', node: 'light' } },
  { id: 'garage.thumb', thread: 'glyph', world: 'garage', who: 'Clemence', line: 'The Major found it scratched on a stone and copied it onto everything. For luck. Or for somebody.', heard: { who: 'clemence', node: 'listen', has: 'thumbprint' } },
  { id: 'garage.signal', thread: 'signal', world: 'garage', who: 'Lune', line: 'A signal passed round for years that nobody could read, read at last through the slit.', heard: { who: 'lune', node: 'signal' } },
];
