// The detour worlds' traces of the singing light and of whoever came this way before (src/levels/names.js
// SIDE): one a world, each a small find in that world's voice, written down in the Sightings page
// (src/story/sightings.js; same shape). Each is met by its own flag, sight.<id>, set by the line that tells it
// (a person's first listen entry, in their world's content, or a trace's look: its content's `traces`).
export const DETOUR_SIGHTINGS = [
  // ---------------------------------------------------------------- someone came this way before
  { id: 'mangrove.liss', thread: 'before', world: 'mangrove', who: 'Liss', line: 'Long ago a woman came down alone and learned the mark on the roots, drawing it on her knee until her hand knew it.' },
  { id: 'saltharbour.book', thread: 'before', world: 'saltharbour', who: 'the harbour book', line: 'The line before yours is in home letters, a woman’s, who came alone. The salt has eaten her name.' },
  { id: 'underwater.coralie', thread: 'before', world: 'underwater', who: 'Coralie', line: 'A woman from up top listened all night to the whales. One sang something she knew, and she hummed it back.' },
  { id: 'moonfoundry.bertil', thread: 'before', world: 'moonfoundry', who: 'Bertil', line: 'He cast the mark on a plate for a lone woman’s ship. “So they’ll know me,” she said.' },
  // ---------------------------------------------------------------- the father's signal
  { id: 'antennas.grete', thread: 'signal', world: 'antennas', who: 'Grete', line: 'An old dish caught a man’s voice from very far, and under the hiss something singing his words back, as if learning them.' },
  { id: 'underside.maudie', thread: 'signal', world: 'underside', who: 'Maudie', line: 'A woman wintered here alone, listening every night to a receiver’s hiss, as if waiting for a voice.' },
  // ---------------------------------------------------------------- the singing light
  { id: 'waterfall.pell', thread: 'light', world: 'waterfall', who: 'Aldo', line: 'The night the falls went quiet, a light hung singing off the balcony, as if waiting for an answer.' },
  { id: 'eclipse.ansel', thread: 'light', world: 'eclipse', who: 'Ansel', line: 'It hung singing where the black sun sits. By morning every figure on the walls leaned the way it went.' },
  { id: 'spacecity.tamar', thread: 'light', world: 'spacecity', who: 'Tamar', line: 'A ship with no name once hailed with one sung note. The night the sky rang, the same note passed again, going somewhere.' },
  // ---------------------------------------------------------------- the makers' sign
  { id: 'glassdunes.mark', thread: 'glyph', world: 'glassdunes', who: 'a mark in the glass', line: 'Fused into the sand from above, in a skin of glass newer than the dunes. The camp leaves the sand round it untouched.' },
  { id: 'fallenring.mark', thread: 'glyph', world: 'fallenring', who: 'a mark on the fallen ring', line: 'Burned into the hull, and not long ago: by a hand that learned it, the arc drawn twice.' },
  { id: 'overnighttrain.chalk', thread: 'glyph', world: 'overnighttrain', who: 'a mark on the last carriage', line: 'Chalked on the last carriage’s roof, drawn again over the old chalk many times, by someone who keeps it.' },
];
