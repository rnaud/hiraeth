// The Whale-House's words (src/temples/underwater.js builds it, in the Underwater City): the local who sends you in,
// and what he says after. Old Anselme, a diver once, keeps the Whale-House's door at the end of the last tube. He
// speaks the city's tongue (src/levels/underwater.js). Maelle in the Whale Gallery gives the world's lead and its clue
// after (src/story/underwater-people.js): his after-dialogue sets none. Conversation format: src/story/dialogue.js.
// Every line carries a tone.

export const QUEST = {
  id: 'temple.underwater', title: 'The Whale-House', world: 'underwater', main: true,   // (the Underwater City's one thread: src/story/underwater.js)
  outro: 'The Listener sings the whales’ own song again, and the whales have come back to the glass.',
  find: 'Find the Whale-House north of the Plaza',
  gadget: 'Find what the makers left in the Whale-House',
  keeper: 'Go down to what sings at the whales',
};

export const PEOPLE = {
  anselme: {
    id: 'anselme', name: 'Anselme', title: 'who keeps the Whale-House’s door', color: '#3f8a8a', voice: 0.82, kind: 'm', lang: 'underwater',
    palette: { cloak: '#3f8a8a', lining: '#e0806a', cloth: '#efe2c8', legs: '#2e4a52', hat: '#c9973f', hair: '#d8d2c4' }, head: 'wrap', cape: 0.5,
    lines: ['~neutral~ Forty years on this door. It mostly keeps itself.', '~sad~ Listen. That hum in the glass. That’s not theirs.', '~playful~ Mind the step. It’s older than the city, and so am I.'],
    talk: {
      entry: [
        { if: { flag: 'temple.underwater.done' }, node: 'after' },
        { if: { flag: 'temple.underwater.entered' }, node: 'inside' },
        { if: { flag: 'met.anselme' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Anselme. I keep the Whale-House’s door. I dived, once. Now I sit.',
            '~solemn~ The makers built that house to talk to the whales. Shell and glass, and horns out into the sea. The whales came right up to it.',
            '~sad~ Since the night the sky rang, something in there sings the light’s note back at them. Every time they come near, it sends them off.'],
          do: { set: { 'met.anselme': true } },
          choices: [
            { text: '~neutral~ I’ll go in and stop it.', do: { start: 'temple.underwater' }, goto: 'go' },
            { text: '~curious~ Something in there?', goto: 'who' },
            { text: '~neutral~ Goodbye, Anselme.', end: true },
          ],
        },
        who: {
          say: ['~whisper~ The makers called it *the Listener*. A great old shell with an ear like a doorway. It answered the whales for them.',
            '~sad~ Now it only answers the light.'],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.underwater' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ *The door at the end of the tube.* It opens for anyone who walks up to it. It always did.',
            '~curious~ The old divers said the makers left a *whale-horn* in there. One note, the deep one, the whales’ own. Find it before you go down.'],
          choices: [{ text: '~happy~ A horn. Got it.', end: true }],
        },
        again: {
          say: ['~neutral~ *The door at the end of the tube.* Listen for the deep note in there.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.underwater', started: false }, do: { start: 'temple.underwater' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You’ve been in. Does it still smell of brass and salt?', '~curious~ And the Listener? Did it hear you?'],
          choices: [
            { text: '~solemn~ It shuts its ear to anything close.', goto: 'near' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        near: {
          say: ['~solemn~ It was built to hear the whales from far off. The makers never sang to its face. They sang into the dishes.',
            '~neutral~ A dish only carries with a weight on its footstone. Put one there, and sound the horn into it.'],
          choices: [{ text: '~neutral~ I’ll try that.', end: true }],
        },
        after: {
          say: ['~surprised~ (Through the glass, a long low note comes in out of the dark, and another answers it.)',
            '~happy~ They’re back. Right up to the horns, like when I was a boy.',
            '~solemn~ The house sings their song now, not the light’s. As it should.'],
          choices: [
            { text: '~curious~ What did the whales do, that night?', goto: 'night' },
            { text: '~happy~ Will you go out to them?', goto: 'out' },
            { text: '~neutral~ Goodbye, Anselme.', end: true },
          ],
        },
        night: {
          say: ['~whisper~ Sang the light’s note back to it, all together, the way they greet each other. Then they went where it went.',
            '~neutral~ Maelle in the Gallery has listened to them longer than I have. Ask her.'],
          choices: [{ text: '~neutral~ I will.', end: true }],
        },
        out: {
          say: ['~playful~ (He laughs.) At my age? I’ll sit by the door and let them come to me. They always did.'],
          choices: [{ text: '~neutral~ Goodbye.', end: true }],
        },
      },
    },
  },
};

/** What the city by the Whale-House says once the Listener is calmed. */
export const LINES_AFTER = ['~happy~ Hear that? Right against the glass.', '~solemn~ (he sits with his eyes shut, listening)', '~playful~ The big one has a crooked note. Always did.', '~happy~ The house is lit again. I’d forgotten the colour.'];
