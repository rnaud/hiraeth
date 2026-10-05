// Lorn II's temple words (src/temples/perdide2.js builds the Lamp-House): the
// local who points you there, and what she says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.perdide2', title: 'The Lamp-House', world: 'perdide2',
  outro: 'The Lampless is calm, and the Lamp-House’s beam turns over the wood again.',
  find: 'A dark tower stands in the shallows east of the root cave, a causeway of stones out to it from the end of the lit path',
  gadget: 'Find what the makers left in the dark of the Lamp-House',
  keeper: 'Wings, high in the lamp-room. Go up to them',
};

export const PEOPLE = {
  tamsy: {
    id: 'tamsy', name: 'Tamsy', title: 'who counts the lamps', color: '#f0927a', voice: 1.14, kind: 'f',
    palette: { cloak: '#4a4f7a', lining: '#f0927a', cloth: '#c9b8d8', legs: '#2f3560', hat: '#ece2f2', hair: '#2a2030' }, head: 'wrap', cape: 1.0,
    lines: ['~neutral~ Forty-one pools. And one more, out there, that nobody counts.', '~whisper~ The tower used to have a light on top. Grandfather said.', '~curious~ Did you hear wings?'],
    talk: {
      entry: [
        { if: { flag: 'temple.perdide2.done' }, node: 'after' },
        { if: { flag: 'temple.perdide2.entered' }, node: 'inside' },
        { if: { flag: 'met.tamsy' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~curious~ Another one who came! Hollin will be beside himself. I’m Tamsy. I count the lamps, every night, all forty-one pools, and I write the number down.',
            '~solemn~ That tower in the water is *the Lamp-House*. Grandfather said it had a lamp on top once that lit the whole wood, bigger than all our pools together. Nobody alive has seen it lit.',
            '~whisper~ The night the sky rang, three pools went out, and something flew down out of the tower’s top and went back up. Big. Pale. Like a moth as big as a skiff.'],
          do: { set: { 'met.tamsy': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide2' }, goto: 'go' },
            { text: '~curious~ A moth?', goto: 'moth' },
            { text: '~neutral~ Goodbye, Tamsy.', end: true },
          ],
        },
        moth: {
          say: ['~solemn~ Moths go to the light. That one drank it, Grandfather would have said. Drank the lamp, and our three pools, and it is still hungry, up there in the dark.', '~sad~ It must be awful, to put out the thing you wanted most.'],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide2' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ *The causeway* starts at the end of the lit path, by the root cave. Step stone to stone.', '~whisper~ It is dark in there. Bring a light, if you have one. If you don’t, maybe the makers do.'],
          choices: [{ text: '~happy~ I’ll find one.', end: true }],
        },
        again: {
          say: ['~neutral~ The causeway, from the end of the lit path. Stone to stone.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.perdide2', started: false }, do: { start: 'temple.perdide2' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in! Is it all dark? Did you see the wings?'],
          choices: [
            { text: '~solemn~ It’s hungry for light, and frightened.', goto: 'hungry' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        hungry: { say: ['~solemn~ Then give it a little of yours. Slowly. A frightened thing can’t take much at once.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ['~surprised~ The lamp! The Lamp-House is lit! Its beam goes round over the whole wood, slow, every night. I tried to count it and gave up.',
            '~happy~ And the moth: it sits on the lamp now, all gold, like a cat on a warm stove. Hollin says that is the forty-second lamp, and I am to write it down.',
            '~solemn~ Forty-two. I wrote it down.'],
          choices: [
            { text: '~solemn~ It only needed a little light.', goto: 'light' },
            { text: '~happy~ Keep counting, Tamsy.', end: true },
          ],
        },
        light: { say: ['~happy~ Everyone does. That is why we keep the pools.'], choices: [{ text: '~neutral~ Goodbye, Tamsy.', end: true }] },
      },
    },
  },
};

/** What the wood says once the Lamp-House burns. */
export const LINES_AFTER = ['~surprised~ The Lamp-House is lit!', '~happy~ Forty-two lamps now.', '~solemn~ The moth sleeps on the lamp, gold.', '~curious~ Did you see the beam go round?'];
