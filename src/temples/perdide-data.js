// Lorn's temple words (src/temples/perdide.js builds the Hush-House): the
// local who points you there, and what he says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.perdide', title: 'The Hush-House', world: 'perdide',
  outro: 'The Mother Snapper sleeps, and every snapping plant in the swamp has a flower at its foot.',
  find: 'Find the violet dome on the cave island',
  gadget: 'Find what the makers left in the Hush-House',
  keeper: 'Go to what snaps behind the last door',
};

export const PEOPLE = {
  teasel: {
    id: 'teasel', name: 'Teasel', title: 'who cuts the reeds', color: '#a99be0', voice: 0.92, kind: 'm',
    palette: { cloak: '#4f6a5e', lining: '#a99be0', cloth: '#d8c8e8', legs: '#3a4a46', hat: '#c9b8d8', hair: '#3a2a30' }, head: 'hood', cape: 0.9,
    lines: ["~neutral~ Reeds for roofs. Reeds for mats. None from that shore.", '~whisper~ Do you hear it snapping, in there?', '~curious~ You came by skiff? Or did you swim it?'],
    talk: {
      entry: [
        { if: { flag: 'temple.perdide.done' }, node: 'after' },
        { if: { flag: 'temple.perdide.entered' }, node: 'inside' },
        { if: { flag: 'met.teasel' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~curious~ Teasel. Reed-cutter. I work round the cave island, except beside that dome. Prefer my reeds without screaming in the background.",
            "~solemn~ *The Hush-House.* The makers taught jaw-plants to settle there, Wendel says. Their mark is the Hush, the one we paint on our doors.",
            "~whisper~ Something inside woke when the sky rang. It’s been snapping ever since. You can hear the jaws through stone."],
          do: { set: { 'met.teasel': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide' }, goto: 'go' },
            { text: '~curious~ What is snapping?', goto: 'what' },
            { text: '~neutral~ Goodbye, Teasel.', end: true },
          ],
        },
        what: {
          say: ["~solemn~ Grandmother called her *the Mother*, the first snapper. The makers raised her to guard their house. Our plants came from her seeds.", "~sad~ She may be frightened. Or hungry. I’d prefer not to settle that question with a leg."],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ Use *the east door facing the channel*. Listen to the crystals inside; each has a different note.", "~whisper~ Wendel recommends patience. I recommend patience at a sensible distance."],
          choices: [{ text: '~happy~ I will.', end: true }],
        },
        again: {
          say: ["~neutral~ *East door, channel side.* Listen as you go."],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.perdide', started: false }, do: { start: 'temple.perdide' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ["~surprised~ You went in? Is the Mother still snapping?"],
          choices: [
            { text: "~solemn~ She’s frightened. Everything around her moves too fast.", goto: 'still' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        still: { say: ["~solemn~ Find the makers’ cold tool inside. Something to slow her while you calm her. Wendel said they had a way."], choices: [{ text: '~neutral~ I’ll find it.', end: true }] },
        after: {
          say: ["~surprised~ No snapping! And the dome’s flowering. White and blue, all opening at dusk.",
            "~happy~ Every jaw-plant has flowers around its roots now. Wendel laughed out loud, and every jaw on the bed turned to look at him.",
            "~solemn~ The Mother’s sleeping. You can hear slow breathing through the stone."],
          choices: [
            { text: '~solemn~ She only wanted it quiet.', goto: 'quiet' },
            { text: '~happy~ Good reeds this year, Teasel.', end: true },
          ],
        },
        quiet: { say: ["~happy~ I thought the Hush was a warning. Perhaps it was meant to soothe. I like it better on my door now."], choices: [{ text: '~neutral~ Goodbye, Teasel.', end: true }] },
      },
    },
  },
};

/** What the swamp says once the Mother sleeps. */
export const LINES_AFTER = ['~happy~ The dome is all in flower!', '~surprised~ Every snapper has flowers at its foot.', '~solemn~ Hear her breathe? Very slow.', '~curious~ It was a lullaby, the Hush.'];
