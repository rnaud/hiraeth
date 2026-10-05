// Lorn's temple words (src/temples/perdide.js builds the Hush-House): the
// local who points you there, and what he says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.perdide', title: 'The Hush-House', world: 'perdide',
  outro: 'The Mother Snapper sleeps, and every snapping plant in the swamp has a flower at its foot.',
  find: 'A great dome of violet stone stands on the cave island, crystals growing through it, its door looking east over the channel',
  gadget: 'Find what the makers left in the Hush-House',
  keeper: 'Something huge snaps behind the last door. Go to it',
};

export const PEOPLE = {
  teasel: {
    id: 'teasel', name: 'Teasel', title: 'who cuts the reeds', color: '#a99be0', voice: 0.92, kind: 'm',
    palette: { cloak: '#4f6a5e', lining: '#a99be0', cloth: '#d8c8e8', legs: '#3a4a46', hat: '#c9b8d8', hair: '#3a2a30' }, head: 'hood', cape: 0.9,
    lines: ['~neutral~ Reeds for roofs, reeds for mats. Never from the dome’s shore.', '~whisper~ Do you hear it snapping, in there?', '~curious~ You came by skiff? Or did you swim it?'],
    talk: {
      entry: [
        { if: { flag: 'temple.perdide.done' }, node: 'after' },
        { if: { flag: 'temple.perdide.entered' }, node: 'inside' },
        { if: { flag: 'met.teasel' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~curious~ Someone from off the swamp! I’m Teasel. I cut reeds round the cave island, all but here.',
            '~solemn~ That is *the Hush-House*. Wendel says the makers taught the plants of Lorn not to eat in there: the Hush is their sign, three drops over a shut mouth. We paint it on our doors.',
            '~whisper~ But the night the sky rang, something in there woke and started snapping, and it has not stopped. You can hear it through the stone. Snap. Snap.'],
          do: { set: { 'met.teasel': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide' }, goto: 'go' },
            { text: '~curious~ What is snapping?', goto: 'what' },
            { text: '~neutral~ Goodbye, Teasel.', end: true },
          ],
        },
        what: {
          say: ['~solemn~ Grandmother called her the Mother: the first snapper, the one all of ours are seeded from. The makers grew her in there to keep their house.', '~sad~ If she is snapping, she is frightened. Snappers only snap at what they fear, or what they want to eat.'],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ *The door* is on the east side, facing the channel. The crystals inside hum, each its own note.', '~whisper~ Wendel says the patient are never eaten. I would be very patient.'],
          choices: [{ text: '~happy~ I will.', end: true }],
        },
        again: {
          say: ['~neutral~ The door on the east side. Listen to the crystals.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.perdide', started: false }, do: { start: 'temple.perdide' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in! Is she there? Did she snap at you?'],
          choices: [
            { text: '~solemn~ She is frightened. Everything moves too fast for her.', goto: 'still' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        still: { say: ['~solemn~ Then be still with her. Or make her still. The makers had a way, Wendel says: something cold.'], choices: [{ text: '~neutral~ I’ll find it.', end: true }] },
        after: {
          say: ['~surprised~ It’s quiet in there! And look at the dome: flowers all over it, opening at dusk, white and blue.',
            '~happy~ And every snapper on the swamp has a ring of the same flowers round its foot now. Wendel came out to look at the one by the landing and laughed till he sat down.',
            '~solemn~ The Mother is sleeping. You can hear her breathe through the stone, very slow.'],
          choices: [
            { text: '~solemn~ She only wanted it quiet.', goto: 'quiet' },
            { text: '~happy~ Good reeds this year, Teasel.', end: true },
          ],
        },
        quiet: { say: ['~happy~ The Hush. Three drops over a shut mouth. I always thought it was a warning. It was a lullaby.'], choices: [{ text: '~neutral~ Goodbye, Teasel.', end: true }] },
      },
    },
  },
};

/** What the swamp says once the Mother sleeps. */
export const LINES_AFTER = ['~happy~ The dome is all in flower!', '~surprised~ Every snapper has flowers at its foot.', '~solemn~ Hear her breathe? Very slow.', '~curious~ It was a lullaby, the Hush.'];
