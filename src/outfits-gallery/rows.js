// The outfits gallery's layout and motions (outfits-gallery.html, issue #549; src/outfits-gallery/main.js): pure,
// for the page and its test.

/** How far apart the travellers stand (m): room for the pilgrim's robe swinging while they turn. */
export const SPACING = 1.15;

/** What they can do: the game's blend held at a speed (lib.native: each loop's own ground speed), on the spot. */
export const MOTIONS = [
  { id: 'idle', label: 'Standing' },
  { id: 'walk', label: 'Walking' },
  { id: 'jog', label: 'Running' },
  { id: 'sprint', label: 'Sprinting' },
];

/** The speed the Animator's blend is held at for a motion (as the character studio drives its gaits). */
export function motionSpeed(id, native = {}) {
  if (id === 'walk') return (native.walk ?? 1.4) * 1.3;
  if (id === 'jog') return native.jog ?? 3.5;
  if (id === 'sprint') return (native.sprint ?? 6) * 1.2;
  return 0;
}

/** One place in the row for every outfit of the list (outfits.json), in its order, centred on x = 0:
 * [{ id, name, x }]. */
export function galleryRows(list, spacing = SPACING) {
  const outfits = list?.outfits ?? [];
  return outfits.map((o, i) => ({ id: o.id, name: o.name, x: (i - (outfits.length - 1) / 2) * spacing }));
}
