// Viridel's temple words (src/temples/edena.js builds the Builders'
// Greenhouse): the local who points you there, and what she says after.
// Viridel's gardeners speak gently and say what they mean; they let what falls
// rest. Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.edena', title: 'The Builders’ Greenhouse', world: 'edena',
  outro: 'The Gardener sleeps in flower, and the white ruins all over the garden are green again.',
  find: 'Find the Greenhouse north of the white ruins',
  gadget: 'Find what the builders left in the Greenhouse',
  keeper: 'Go up to what moves at the top',
};

export const PEOPLE = {
  sorrel: {
    id: 'sorrel', name: 'Sorrel', title: 'who sows the Greenhouse beds', color: '#7fcfa8', voice: 1.0, kind: 'f',
    palette: { cloak: '#7fcfa8', lining: '#f2a7b5', cloth: '#f7f4ec', legs: '#8a5a3c', hat: '#f6c7a0', hair: '#4a3a42' }, head: 'hood', cape: 0.9,
    lines: ["~neutral~ Another row sown. Come on, little seeds.", "~sad~ Nothing growing. Not even weeds. I miss weeds.", "~curious~ Green on your hands. What did you find inside?"],
    talk: {
      entry: [
        { if: { flag: 'temple.edena.done' }, node: 'after' },
        { if: { flag: 'temple.edena.entered' }, node: 'inside' },
        { if: { flag: 'met.sorrel' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~neutral~ Sorrel. Mind these seed rows. I sow the beds around the Greenhouse. Lately it feels like burying tiny disappointments.",
            "~solemn~ The *Builders’ Greenhouse*. They left a great moss-covered gardener inside to tend the garden. Grandmother once saw it through the glass, flowering from head to foot.",
            "~sad~ When the light passed, every plant inside closed up. My seeds stopped sprouting too. Now the bare gardener paces at night and breaks the glass."],
          do: { set: { 'met.sorrel': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.edena' }, goto: 'go' },
            { text: '~curious~ Nothing ever falls here that you dig up again. Is going in digging?', goto: 'digging' },
            { text: '~neutral~ Goodbye, Sorrel.', end: true },
          ],
        },
        digging: {
          say: ["~solemn~ (Sorrel keeps one thumb in the soil while she thinks.) Going in isn’t digging. Nothing fell there. Something living needs help.", "~neutral~ Vey might agree. She might take longer to agree. I’d rather not wait for that discussion."],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.edena' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ *Up the white steps, through the door.* The builders left it unlocked.", "~whisper~ If the gardener attacks, try to calm it. It’s lost everything that grew on it. That would frighten me too."],
          choices: [{ text: '~solemn~ Frightened, not cruel. I’ll remember.', end: true }],
        },
        again: {
          say: ['~neutral~ Up the white steps. (She nods at the glass.)'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.edena', started: false }, do: { start: 'temple.edena' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~curious~ You went in! Is it all dead sticks, inside?', '~sad~ And the gardener?'],
          choices: [
            { text: "~solemn~ Flower doors. Water runs off, and they stay closed.", goto: 'buds' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        buds: { say: ["~curious~ Then they need more than water. The builders had a way to wake closed buds. A tool for telling them to grow.", "~neutral~ Look inside for that tool. They wouldn’t tend a whole garden without leaving something to work with."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ["~surprised~ (Green fills the seed rows. Sorrel stands with soil in both hands.) Every one. This morning. I didn’t have to beg a single seed.",
            "~happy~ Look at the ruins: vines to the top, flowers below. Oro hasn’t stopped staring. Says they were always meant to look like that.",
            "~solemn~ The gardener’s asleep beneath the glass. Covered in flowers, like Grandmother remembered."],
          choices: [
            { text: '~solemn~ It was only bare. It needed help to bloom.', goto: 'bare' },
            { text: '~sad~ And Esk’s hill?', if: { flag: 'edena.terraces.flooded' }, goto: 'esk' },
            { text: '~neutral~ Goodbye, Sorrel.', end: true },
          ],
        },
        bare: { say: ["~happy~ You helped it bloom, and it helped us grow. A practical exchange. I approve."], choices: [{ text: '~neutral~ Goodbye, Sorrel.', end: true }] },
        esk: { say: ["~solemn~ Esk came to look. Stayed a while, then asked for seeds for the mud. Took a whole bag back down.", "~neutral~ Her terraces aren’t restored. She’s deciding what can grow there now."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the hollow says once the Gardener sleeps. */
export const LINES_AFTER = ['~happy~ Every drill came up!', '~surprised~ Look at the ruins.', '~solemn~ (she kneels in the green beds, smiling)', '~happy~ In flower, head to foot.'];
