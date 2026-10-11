// Vael's temple words (src/temples/arzach.js builds the Aerie): the local who
// points you there, and what she says after. Vael is a quiet country: people
// point, nod, say one word. Conversation format: src/story/dialogue.js. Every
// line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.arzach', title: 'The Aerie', world: 'arzach',
  outro: 'The Elder flies again, and the great birds have come back to the Aerie.',
  find: 'Find the white house west of the landing',
  gadget: 'Find what the makers left in the Aerie',
  keeper: 'Go up to what shifts at the top',
};

export const PEOPLE = {
  lark: {
    id: 'lark', name: 'Lark', title: 'who sweeps the steps', color: '#b98f9a', voice: 1.05, kind: 'f',
    palette: { cloak: '#e6dcc6', lining: '#b98f9a', cloth: '#f4efe2', legs: '#8a7a66', hat: '#f4efe2', hair: '#4a3a42' }, head: 'hood', cape: 1.2,
    lines: ['~neutral~ (she sweeps)', '~whisper~ Wings.', '~sad~ (she looks up at the stone wings, and sweeps)'],
    talk: {
      entry: [
        { if: { flag: 'temple.arzach.done' }, node: 'after' },
        { if: { flag: 'temple.arzach.entered' }, node: 'inside' },
        { if: { flag: 'met.lark' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~neutral~ (Lark stops sweeping the steps. She looks from you to your tank, then up at the stone wings.)",
            "~solemn~ *The Aerie.* Birds learned here.",
            "~sad~ (She spreads her arms, then lets them drop.) The old bird. Won’t fly."],
          do: { set: { 'met.lark': true } },
          choices: [
            { text: '~neutral~ I’ll go up to her.', do: { start: 'temple.arzach' }, goto: 'go' },
            { text: '~curious~ Stopped flying?', goto: 'stopped' },
            { text: '~neutral~ Goodbye.', end: true },
          ],
        },
        stopped: {
          say: ["~solemn~ Since the singing light. (She looks up.) Frightened.", "~whisper~ Others left. She stayed inside."],
          choices: [{ text: '~neutral~ I’ll go up to her.', do: { start: 'temple.arzach' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ (Three strokes of the broom clear a path to the entrance. Lark gestures: *go in*.)", '~whisper~ Wind, inside. Wait for it.'],
          choices: [{ text: '~happy~ Thank you, Lark.', end: true }],
        },
        again: {
          say: ['~neutral~ (She nods at the door, and goes on sweeping.)'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.arzach', started: false }, do: { start: 'temple.arzach' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~curious~ (She stops sweeping.) Her?'],
          choices: [
            { text: '~solemn~ She is afraid to fly alone.', goto: 'alone' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        alone: { say: ["~solemn~ (Lark spreads her arms and banks from side to side.) Fly with her."], choices: [{ text: '~neutral~ Together.', end: true }] },
        after: {
          say: ["~surprised~ (Her broom falls. Lark watches the sky.)",
            "~happy~ (White birds circle the Aerie. The old bird opens her wings on its crown.) Home.",
            "~solemn~ (Lark leans the broom against the wall.) Wings sweep better."],
          choices: [
            { text: '~happy~ She flew with me.', goto: 'flew' },
            { text: '~neutral~ Goodbye, Lark.', end: true },
          ],
        },
        flew: { say: ['~happy~ (She nods, and nods, and laughs without a sound.)'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the plain says once the Elder flies. */
export const LINES_AFTER = ['~happy~ (she watches the birds wheel)', '~surprised~ Back.', '~solemn~ (she points up at the old one, on the wings)', '~happy~ Together.'];
