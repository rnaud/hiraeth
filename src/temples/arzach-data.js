// Vael's temple words (src/temples/arzach.js builds the Aerie): the local who
// points you there, and what she says after. Vael is a quiet country: people
// point, nod, say one word. Conversation format: src/story/dialogue.js. Every
// line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.arzach', title: 'The Aerie', world: 'arzach',
  outro: 'The Elder flies again, and the great birds have come back to the Aerie.',
  find: 'A great white house of the makers stands on the plain west of the landing, a crown of stone wings on top',
  gadget: 'Find what the makers left in the Aerie',
  keeper: 'Something heavy shifts at the top of the house. Go up to it',
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
          say: ['~neutral~ (A woman sweeps sand off the great steps, slowly. She stops, and looks at you, and at your tank.)',
            '~solemn~ The Aerie. (She points up, at the crown of stone wings.) Where the birds were given wings.',
            '~sad~ (She puts down her broom and spreads her arms, and lets them fall.) The old one. Up there. She stopped.'],
          do: { set: { 'met.lark': true } },
          choices: [
            { text: '~neutral~ I’ll go up to her.', do: { start: 'temple.arzach' }, goto: 'go' },
            { text: '~curious~ Stopped flying?', goto: 'stopped' },
            { text: '~neutral~ Goodbye.', end: true },
          ],
        },
        stopped: {
          say: ['~solemn~ The night the light went over. (She looks at the sky a long time.) Afraid.', '~whisper~ The others left. She stayed. She does not come down.'],
          choices: [{ text: '~neutral~ I’ll go up to her.', do: { start: 'temple.arzach' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ (She sweeps a path to the door with three strokes, and nods at it.)', '~whisper~ Wind, inside. Wait for it.'],
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
        alone: { say: ['~solemn~ (Lark spreads her arms again, and this time holds them out, and tilts, like something riding the wind.) Together.'], choices: [{ text: '~neutral~ Together.', end: true }] },
        after: {
          say: ['~surprised~ (Lark has dropped her broom. She is looking up.)',
            '~happy~ (Over the Aerie the great birds are wheeling, white against the sky, and on the crown of stone wings the old one sits with her wings open.) Back.',
            '~solemn~ (She picks up the broom, looks at it, and leans it against the wall.) No more sand. They fan it off.'],
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
