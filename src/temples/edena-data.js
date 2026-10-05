// Viridel's temple words (src/temples/edena.js builds the Builders'
// Greenhouse): the local who points you there, and what she says after.
// Viridel's gardeners speak gently and say what they mean; they let what falls
// rest. Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.edena', title: 'The Builders’ Greenhouse', world: 'edena',
  outro: 'The Gardener sleeps in flower, and the white ruins all over the garden are green again.',
  find: 'In the meadow hollow north of the white ruins, a round house of the builders stands under a dome of glass: the Greenhouse. Nothing grows in it',
  gadget: 'Find what the builders left in the Greenhouse',
  keeper: 'Something vast and bare is moving at the top of the Greenhouse. Go up to it',
};

export const PEOPLE = {
  sorrel: {
    id: 'sorrel', name: 'Sorrel', title: 'who sows the Greenhouse beds', color: '#7fcfa8', voice: 1.0, kind: 'f',
    palette: { cloak: '#7fcfa8', lining: '#f2a7b5', cloth: '#f7f4ec', legs: '#8a5a3c', hat: '#f6c7a0', hair: '#4a3a42' }, head: 'hood', cape: 0.9,
    lines: ['~neutral~ Sown again. We’ll see.', '~sad~ Not a shoot. Not one.', '~curious~ You’ve got green on your hands. Have you been in?'],
    talk: {
      entry: [
        { if: { flag: 'temple.edena.done' }, node: 'after' },
        { if: { flag: 'temple.edena.entered' }, node: 'inside' },
        { if: { flag: 'met.sorrel' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Mind the drills, I’ve just sown them. (A woman kneels by a bare bed at the foot of the white steps, pressing seeds into it with her thumb.) I’m Sorrel. I sow the beds round the Greenhouse.',
            '~solemn~ The *Builders’ Greenhouse*. The white builders grew the whole garden from in there, Oro says, and left a gardener in it to keep it growing: a great thing all of moss, older than the pyramids. My grandmother saw it once through the glass, in flower from head to foot.',
            '~sad~ The night the light passed, everything in there closed up and dropped. Since then nothing I sow round it comes up. Not a shoot. And something in there walks about at night, bare as a stick, and breaks the panes.'],
          do: { set: { 'met.sorrel': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.edena' }, goto: 'go' },
            { text: '~curious~ Nothing ever falls here that you dig up again. Is going in digging?', goto: 'digging' },
            { text: '~neutral~ Goodbye, Sorrel.', end: true },
          ],
        },
        digging: {
          say: ['~solemn~ (She thinks about it, a long time, her thumb in the earth.) No. Nothing fell in there. It just stopped. A garden that stops isn’t resting. It’s waiting for someone to tell it to go on.', '~neutral~ Vey would say the same. Probably. Don’t ask him.'],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.edena' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ The door at the top of the steps. It isn’t locked; nothing the builders made is.', '~whisper~ If the gardener comes at you, don’t hurt it. It’s only bare. Nobody’s at their best bare.'],
          choices: [{ text: '~happy~ Not at their best. I’ll remember.', end: true }],
        },
        again: {
          say: ['~neutral~ Up the white steps. (She nods at the glass.)'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.edena', started: false }, do: { start: 'temple.edena' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~curious~ You went in! Is it all dead sticks, inside?', '~sad~ And the gardener?'],
          choices: [
            { text: '~solemn~ Doors of flowers that won’t open. Water only runs off them.', goto: 'buds' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        buds: { say: ['~curious~ Water’s for drinking. A bud wants telling. The builders could tell a seed to grow, Oro says, and it would.', '~neutral~ They’d have kept something for telling with. They kept everything.'], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ['~surprised~ (Sorrel is standing up in the beds, her hands full of earth. Every drill she sowed is green.) They came up. All at once, this morning, every one.',
            '~happy~ And look at the ruins. (Over the meadow the white slabs of the builders are green to the top, vines all up them, flowers round their feet.) Oro sat down in the grass and wouldn’t get up. He says they were always meant to look like that.',
            '~solemn~ The gardener’s asleep up there under the glass. I saw it. In flower from head to foot, like my grandmother said.'],
          choices: [
            { text: '~solemn~ It was only bare. I bloomed it.', goto: 'bare' },
            { text: '~sad~ And Esk’s hill?', if: { flag: 'edena.terraces.flooded' }, goto: 'esk' },
            { text: '~neutral~ Goodbye, Sorrel.', end: true },
          ],
        },
        bare: { say: ['~happy~ (She laughs.) Then we’re even. You brought it flowers; it brought the garden back. That’s how it goes, here.'], choices: [{ text: '~neutral~ Goodbye, Sorrel.', end: true }] },
        esk: { say: ['~solemn~ She came up to see the ruins. She stood a long time. Then she asked me for seed, for the mud, and took a whole bag down with her.', '~neutral~ It isn’t mended. It’ll be something else. That’s all right.'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the hollow says once the Gardener sleeps. */
export const LINES_AFTER = ['~happy~ Every drill came up!', '~surprised~ Look at the ruins.', '~solemn~ (she kneels in the green beds, smiling)', '~happy~ In flower, head to foot.'];
