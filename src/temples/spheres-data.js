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
    lines: ['~curious~ Round the rim once a day. Toes and heel.', '~whisper~ Hear that? One note, under the grass.', '~neutral~ Ivo says the boxes are near a Footprint. This is the Footprint.'],
    talk: {
      entry: [
        { if: { flag: 'temple.spheres.done' }, node: 'after' },
        { if: { flag: 'temple.spheres.entered' }, node: 'inside' },
        { if: { flag: 'met.tessa' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~curious~ You found it! Most people walk right past. They think the rim is a wall somebody started and got bored of. I’m Tessa. I walk it, once a day, toes and heel.',
            '~solemn~ It is *the Footprint*. Something walked through the sky putting the spheres down, and here it stepped. Three toes, like a bird. The heel is a sphere with *a door* in it.',
            '~whisper~ And under it something sings. One note, very loud, over and over, as if it had forgotten all the others.'],
          do: { set: { 'met.tessa': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.spheres' }, goto: 'go' },
            { text: '~curious~ What sings down there?', goto: 'sings' },
            { text: '~neutral~ Goodbye, Tessa.', end: true },
          ],
        },
        sings: {
          say: ['~solemn~ Ume says an Answerer turned over the plaza, the night the sky rang, and went on. I think it left something behind. An echo of itself.', '~sad~ An echo with nothing to answer. That would make anyone sing too loud.'],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.spheres' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ *The door is in the heel*, on the side toward the grove.', '~curious~ They say the walker kept a lens in there, to see what nobody looks at. If you find it, look at everything.'],
          choices: [{ text: '~happy~ I will.', end: true }],
        },
        again: {
          say: ['~neutral~ The door is in the heel, on the grove side.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.spheres', started: false }, do: { start: 'temple.spheres' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in. Is it hollow all the way down?', '~curious~ And the singing?'],
          choices: [
            { text: '~solemn~ It is lost. It wants an answer.', goto: 'answer' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        answer: { say: ['~solemn~ Then answer it. Note for note. That is all anyone wants.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ['~surprised~ The Footprint is full of water! The toes, the heel, all still, all sky. I walked the rim this morning and saw myself in every toe.',
            '~happy~ And the spheres: did you see? Every one has a ring of light round its foot now, breathing. At dusk they hum together. Aube cried.',
            '~solemn~ It stopped singing that one note. Now it hums with them.'],
          choices: [
            { text: '~solemn~ It only needed answering.', goto: 'needed' },
            { text: '~happy~ Walk the rim for me, Tessa.', end: true },
          ],
        },
        needed: { say: ['~happy~ Then it has something to answer now, every evening. So do we.'], choices: [{ text: '~neutral~ Goodbye, Tessa.', end: true }] },
      },
    },
  },
};

/** What the garden says once the Footprint holds water. */
export const LINES_AFTER = ['~surprised~ The Footprint is full of water!', '~happy~ The spheres hum together at dusk now.', '~solemn~ The singing under the grass has stopped.', '~curious~ A ring of light round every sphere.'];
