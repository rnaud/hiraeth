// The Glass Dunes' named people (on the route since October 2026, in the Sealed Hangar's place: src/levels/names.js).
// The world's thread is its temple, the Clock-House (src/temples/garage.js, Wim at its door: src/temples/garage-data.js);
// these are the glassworkers who carry the errands and speak for the makers' run, placed by src/levels/glass-dunes.js
// (GLASS_CONTENT npcs) and listed in the credits (src/story/ending.js). Every line carries a tone.

/** What the Glass Dunes give you to keep (src/story/glassdunes.js, when the Clock-House keeps time again): Wim's tick. */
export const KEEPSAKE = {
  id: 'glassdunes.tick', level: 'glassdunes', kind: 'song', name: 'Wim’s tick',
  text: '“Tick, tock, all together.” The Clock-House’s clock and every clock in the camps, keeping the same time at last. Wim counted it for you, twice.',
};

// the dunes' own main quest (v1.48, issue #101): Halden by the makers' discs, the minute every clock stopped; the Clock-House's
// face read from the glass mound by the warm flow; and in at its door (src/story/glassdunes.js)
export const QUESTS = [
  {
    id: 'glassdunes.minute', title: 'The Minute It Stopped', world: 'glassdunes', main: true,
    outro: 'Seven minutes to the hour, over the Clock-House’s door: the minute the light passed. Every clock in the dunes stopped after it.',
    stages: [
      { id: 'oren', text: 'Hear Halden out by the makers’ discs', label: 'Halden, by the discs', flag: 'glassdunes.oren.heard', at: 'oren' },
      { id: 'mound', text: 'Climb the glass mound by the warm flow', label: 'The glass mound by the warm flow', goto: 'flowMound', radius: 5, vertical: 3, at: 'flowMound', via: 'the float-posts' },
      { id: 'house', text: 'Go in at the Clock-House’s door', label: 'The Clock-House’s door', flag: 'temple.garage.entered', at: 'temple.garage.door' },
    ],
  },
];

export const LOCALS = {
  // (an errand comes to Aster from the City-Shaft: src/levels/content.js 'token')
  aster: { id: 'aster', name: 'Aster', title: 'who blows the floats', kind: 'f',
    lines: ['~neutral~ We blow floats from the drifts. The dunes give the sand; the kiln does the rest.', '~curious~ Have you looked into the cliffs at dusk? The big ones are clearer then.'] },
  // (and one goes from Corin to the Buried Machine: 'grease')
  corin: { id: 'corin', name: 'Corin', title: 'who keeps the west camp’s kiln', kind: 'm',
    lines: ['~whisper~ My grandmother said they were asleep in there. My mother said they were only shapes.', '~playful~ I say they are good company. They never want the last float.'] },
  // (resting by the makers' discs east of the ship: src/trials/kit-data.js kit-glassdunes speaks in his voice)
  // (he opens the dunes' main quest: QUESTS above)
  oren: { id: 'oren', name: 'Halden', title: 'who carries the floats', color: '#5fb7ad', voice: 0.95, kind: 'm',
    lines: ['~playful~ Discs that ride themselves over the sand. The makers never walked anywhere, I think.', '~neutral~ The Clock-House is east, past the wave. Wim will talk your ear off about the time.'],
    talk: {
      entry: [
        { if: { flag: 'temple.garage.done' }, node: 'after' },
        { if: { flag: 'glassdunes.oren.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Halden. I carry the floats from the kilns to the camps. Mind the discs: they’ll carry you too, if you let them.',
            '~curious~ Ask anyone the time here and they’ll give you a different one. Every clock in the dunes stopped the night the light passed, each at its own minute.'],
          choices: [
            { text: '~curious~ Which one stopped first?', goto: 'first' },
            { text: '~playful~ I’ll find out the time myself.', end: true },
          ],
        },
        first: {
          say: ['~solemn~ The Clock-House’s, over its door. The camps’ clocks take their time from it. Nobody’s been near enough to read it since.',
            '~neutral~ *Climb the glass mound by the warm flow*, east along the float-posts. From the top you can read its face.'],
          do: { set: { 'glassdunes.oren.heard': true } },
          choices: [{ text: '~neutral~ I’ll read it.', end: true }],
        },
        again: { say: ['~neutral~ The glass mound by the warm flow, along the float-posts. Read the Clock-House’s face from the top.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        after: {
          say: ['~happy~ I asked three people the time this morning. Same answer, three times. I didn’t know what to do with myself.'],
          choices: [{ text: '~neutral~ Goodbye, Halden.', end: true }],
        },
      },
    },
  },
};
