// Viridel's temple words (src/temples/edena.js builds the Builders'
// Greenhouse): the local who points you there, and what she says after.
// Viridel's gardeners speak gently and say what they mean; they let what falls
// rest. Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.edena', title: 'The Builders’ Greenhouse', world: 'edena',
  outro: 'The Gardener sleeps in flower, and the white ruins all over the garden are green again.',
  find: 'Follow the water up to the Greenhouse',
  gadget: 'Find what the builders left in the Greenhouse',
  keeper: 'Go up to what moves at the top',
};

export const PEOPLE = {
  sorrel: {
    id: 'sorrel', name: 'Sorrel', title: 'who sows the Greenhouse beds', color: '#7fcfa8', voice: 1.0, kind: 'f',
    palette: { cloak: '#7fcfa8', lining: '#f2a7b5', cloth: '#f7f4ec', legs: '#8a5a3c', hat: '#f6c7a0', hair: '#4a3a42' }, head: 'hood', cape: 0,
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
          say: ["~neutral~ Mind these seed rows. I sow the beds round the Greenhouse. Lately it feels like burying tiny disappointments.",
            "~solemn~ The *Builders’ Greenhouse*. They left a great moss-covered gardener inside to tend the garden. Grandmother once saw it through the glass, flowering from head to foot.",
            "~sad~ When the light passed, every plant inside closed up. My seeds stopped sprouting too. Now the bare gardener paces at night and breaks the glass."],
          do: { set: { 'met.sorrel': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.edena' }, goto: 'go' },
            { text: '~curious~ Would going inside disturb the garden?', goto: 'digging' },
            { text: '~solemn~ Tiny disappointments. I’ll think on it.', end: true },
          ],
        },
        digging: {
          say: ["~solemn~ (Sorrel keeps one thumb in the soil while she thinks.) Going in isn’t digging. Nothing fell there. Something living needs help.", "~neutral~ Vey might agree. She might take longer to agree. I’d rather not wait for that discussion."],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.edena' }, goto: 'go' }, { text: '~playful~ I’ll leave that to Vey.', end: true }],
        },
        go: {
          say: ["~neutral~ *Up the white steps, through the door.* The builders left it unlocked.", "~whisper~ If the gardener attacks, try to calm it. It’s lost everything that grew on it. That would frighten me too."],
          choices: [{ text: '~solemn~ Frightened, not cruel. I’ll remember.', end: true }],
        },
        again: {
          say: ['~neutral~ Up the white steps. (She nods at the glass.)'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.edena', done: false }, do: { start: 'temple.edena' }, end: true }, { text: '~neutral~ Let me water something first.', end: true }],
        },
        inside: {
          say: ['~curious~ You went in. Are the beds in there as dry as mine?', '~sad~ And the gardener?'],
          choices: [
            // (issue #477: the bloom's chest stands in the Greenhouse's first hall now)
            { if: { has: 'bloom' }, text: '~curious~ Drier. But the builders left a tool in the first hall. It tells seeds to grow.', goto: 'tool' },
            { if: { not: { has: 'bloom' } }, text: '~solemn~ Drier. Flower doors, and a chest in the first hall I left shut.', goto: 'buds' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        tool: { say: ["~happy~ A tool for telling them to grow. Of course they left one. Nobody tends a garden with bare hands.", "~neutral~ Then try it on the gardener too. Gently, though."], choices: [{ text: '~neutral~ Gently.', end: true }] },
        buds: { say: ["~curious~ Then open it. The builders wouldn’t tend a whole garden without leaving something to work with.", "~neutral~ Water won’t open those flower doors. Whatever is in that chest might."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ["~surprised~ (Green fills the seed rows. Sorrel stands with soil in both hands.) Every one. This morning. I didn’t have to beg a single seed.",
            "~happy~ Look at the ruins: vines to the top, flowers below. Oro hasn’t stopped staring. Says they were always meant to look like that.",
            "~solemn~ The gardener’s asleep beneath the glass. Covered in flowers, like Grandmother remembered.",
            "~happy~ Go home by *the long seed row*. It’s come up all the way down, past Oro’s ruins to your ship."],
          choices: [
            { text: '~solemn~ It was bare when I went in. It’s flowering now.', goto: 'bare' },
            { text: '~sad~ And Esk’s hill?', if: { flag: 'edena.terraces.flooded' }, goto: 'esk' },
            { text: '~happy~ The long seed row, then.', end: true },
          ],
        },
        bare: { say: ["~happy~ You helped it bloom, and it helped us grow. A practical exchange. I approve."], choices: [{ text: '~playful~ I’ll take payment in seeds.', end: true }] },
        esk: { say: ["~solemn~ Esk came to look. Stayed a while, then asked for seeds for the mud. Took a whole bag back down.", "~neutral~ Her terraces aren’t restored. She’s deciding what can grow there now."], choices: [{ text: '~solemn~ That’s hers to decide.', end: true }] },
      },
    },
  },
};

/** What the hollow says once the Gardener sleeps. */
export const LINES_AFTER = ['~happy~ Every drill came up!', '~surprised~ Look at the ruins.', '~solemn~ (she kneels in the green beds, smiling)', '~happy~ In flower, head to foot.'];
