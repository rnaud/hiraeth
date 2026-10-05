// The Garden of Spheres' temple words (src/temples/spheres.js builds the
// Footprint): the local who points you there, and what she says after.
// Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.spheres', title: 'The Footprint', world: 'spheres',
  outro: 'The Echo hums with the spheres, and the Footprint holds still water.',
  find: 'North of the umbrella grove the meadow carries a great three-toed footprint. Its heel is a sphere with a door',
  gadget: 'Find what the walker left inside the heel',
  keeper: 'Something sings at the heart of the heel, one loud lost note. Go to it',
};

export const PEOPLE = {
  tessa: {
    id: 'tessa', name: 'Tessa', title: 'who walks the Footprint’s rim', color: '#e8b9c4', voice: 1.1, kind: 'f',
    palette: { cloak: '#e8b9c4', lining: '#f7f3ea', cloth: '#a9c3cf', legs: '#3c4f80', hat: '#f7f3ea', hair: '#6b4a3a' }, head: 'hair', cape: 0.9,
    lines: ["~curious~ One circuit. Three toes, one heel. Large foot.", "~whisper~ Hear that note beneath the grass?", "~neutral~ Ivo found little Footprints. This is the big one."],
    talk: {
      entry: [
        { if: { flag: 'temple.spheres.done' }, node: 'after' },
        { if: { flag: 'temple.spheres.entered' }, node: 'inside' },
        { if: { flag: 'met.tessa' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~curious~ Tessa. I walk this rim every day. Most visitors think it’s an unfinished wall. I point out the toes. Politely, the first time.",
            "~solemn~ *The Footprint.* They say a sky-walker set the spheres down and stepped here. *The round heel has a door.*",
            "~whisper~ Something below keeps singing one note. Too loudly. As though it’s waiting for a reply that never comes."],
          do: { set: { 'met.tessa': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.spheres' }, goto: 'go' },
            { text: '~curious~ What sings down there?', goto: 'sings' },
            { text: '~neutral~ Goodbye, Tessa.', end: true },
          ],
        },
        sings: {
          say: ["~solemn~ Ume saw the Answerer turn over the plaza. I wonder if it left an echo here when it passed.", "~sad~ I can’t prove that. But it sounds lonely. Loud things sometimes are."],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.spheres' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ Enter the door in the heel, on the grove side.", "~curious~ There’s supposed to be a lens inside that reveals hidden marks. Look closely if you find it. A wall isn’t always just a wall."],
          choices: [{ text: '~happy~ I will.', end: true }],
        },
        again: {
          say: ['~neutral~ The door is in the heel, on the grove side.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.spheres', started: false }, do: { start: 'temple.spheres' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ["~surprised~ You went below? How far down does it go?", '~curious~ And the singing?'],
          choices: [
            { text: '~solemn~ It is lost. It wants an answer.', goto: 'answer' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        answer: { say: ["~solemn~ Try answering its notes in order. Listen first, then give each one back."], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ["~surprised~ Water in every toe! And the heel! I can see the sky from the whole rim now.",
            "~happy~ Light circles the spheres’ feet. They hum together at dusk. Aube cried. I walked another lap to hear it twice.",
            "~solemn~ No more single note. Whatever’s underneath has joined the others."],
          choices: [
            { text: '~solemn~ It only needed answering.', goto: 'needed' },
            { text: '~happy~ Walk the rim for me, Tessa.', end: true },
          ],
        },
        needed: { say: ["~happy~ Now it hears an answer every evening. I’ve changed my walking time so I can too."], choices: [{ text: '~neutral~ Goodbye, Tessa.', end: true }] },
      },
    },
  },
};

/** What the garden says once the Footprint holds water. */
export const LINES_AFTER = ['~surprised~ The Footprint is full of water!', '~happy~ The spheres hum together at dusk now.', '~solemn~ The singing under the grass has stopped.', '~curious~ A ring of light round every sphere.'];
