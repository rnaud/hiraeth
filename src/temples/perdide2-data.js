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
    lines: ["~neutral~ Forty-one pools. One dark tower. I count it separately.", "~whisper~ Grandfather remembered the tower’s light.", '~curious~ Did you hear wings?'],
    talk: {
      entry: [
        { if: { flag: 'temple.perdide2.done' }, node: 'after' },
        { if: { flag: 'temple.perdide2.entered' }, node: 'inside' },
        { if: { flag: 'met.tamsy' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~curious~ Tamsy. I count all forty-one pool lamps each night and write them down. Hollin calls it thorough. I call it knowing which ones went out.",
            "~solemn~ That tower in the water is *the Lamp-House*. Grandfather said its light once reached the whole wood. Nobody living has seen it burn.",
            "~whisper~ When three pools went dark, something pale flew out of the tower and back in. A moth as big as a skiff. I checked that measurement twice."],
          do: { set: { 'met.tamsy': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide2' }, goto: 'go' },
            { text: '~curious~ A moth?', goto: 'moth' },
            { text: '~neutral~ Goodbye, Tamsy.', end: true },
          ],
        },
        moth: {
          say: ["~solemn~ It seems to feed on light. Perhaps it drained the tower lamp long ago, and the pools that night. It’s still up there.", "~sad~ Imagine being hungry for the thing that helps you see. I keep thinking about that."],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.perdide2' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ Take the causeway beside the root cave, at the lit path’s end. Step from stone to stone.", "~whisper~ Bring a light into the tower. If you haven’t one, look for a gift the makers left inside."],
          choices: [{ text: '~happy~ I’ll find one.', end: true }],
        },
        again: {
          say: ["~neutral~ *The causeway starts by the root cave.* It leads to the Lamp-House."],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.perdide2', started: false }, do: { start: 'temple.perdide2' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ["~surprised~ You reached it? Did you see the moth?"],
          choices: [
            { text: '~solemn~ It’s hungry for light, and frightened.', goto: 'hungry' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        hungry: { say: ["~solemn~ Offer it a little light at a time. Wait for it to settle between tries."], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ["~surprised~ The tower’s lit! A beam sweeping the whole wood. I tried counting each turn and forgot to sleep.",
            "~happy~ The moth rests on the lamp, all gold. Hollin says put down forty-two lights now. Happiest correction I’ve made.",
            '~solemn~ Forty-two. I wrote it down.'],
          choices: [
            { text: '~solemn~ It only needed a little light.', goto: 'light' },
            { text: '~happy~ Keep counting, Tamsy.', end: true },
          ],
        },
        light: { say: ['~happy~ Everyone does. That is why we keep the pools.'], choices: [{ text: "~neutral~ Everyone needs a light to come toward. That’s why we keep them.", end: true }] },
      },
    },
  },
};

/** What the wood says once the Lamp-House burns. */
export const LINES_AFTER = ['~surprised~ The Lamp-House is lit!', '~happy~ Forty-two lamps now.', '~solemn~ The moth sleeps on the lamp, gold.', '~curious~ Did you see the beam go round?'];
