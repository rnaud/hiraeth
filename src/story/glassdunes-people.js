// The Glass Dunes' named people (on the route since October 2026, in the Sealed Hangar's place: src/levels/names.js).
// The world's thread is its temple, the Clock-House (src/temples/garage.js, Wim at its door: src/temples/garage-data.js);
// these are the glassworkers who carry the errands and speak for the makers' run, placed by src/levels/glass-dunes.js
// (GLASS_CONTENT npcs) and listed in the credits (src/story/ending.js). Every line carries a tone.

/** What the Glass Dunes give you to keep (src/story/glassdunes.js, when the Clock-House keeps time again): Wim's tick. */
export const KEEPSAKE = {
  id: 'glassdunes.tick', level: 'glassdunes', kind: 'song', name: 'Wim’s tick',
  text: '“Tick, tock, all together.” The Clock-House’s clock and every clock in the camps, keeping the same time at last. Wim counted it for you, twice.',
};

export const LOCALS = {
  // (an errand comes to Aster from the City-Shaft: src/levels/content.js 'token')
  aster: { id: 'aster', name: 'Aster', title: 'who blows the floats', kind: 'f',
    lines: ['~neutral~ We blow floats from the drifts. The dunes give the sand; the kiln does the rest.', '~curious~ Have you looked into the cliffs at dusk? The big ones are clearer then.'] },
  // (and one goes from Corin to the Buried Machine: 'grease')
  corin: { id: 'corin', name: 'Corin', title: 'who keeps the west camp’s kiln', kind: 'm',
    lines: ['~whisper~ My grandmother said they were asleep in there. My mother said they were only shapes.', '~playful~ I say they are good company. They never want the last float.'] },
  // (resting by the makers' discs east of the ship: src/trials/kit-data.js kit-glassdunes speaks in his voice)
  oren: { id: 'oren', name: 'Oren', title: 'who carries the floats', kind: 'm',
    lines: ['~playful~ Discs that ride themselves over the sand. The makers never walked anywhere, I think.', '~neutral~ The Clock-House is east, past the wave. Wim will talk your ear off about the time.'] },
};
