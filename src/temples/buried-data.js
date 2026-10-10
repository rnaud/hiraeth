// The Buried Machine's temple words (src/temples/buried.js builds the
// Engine-House): the local who points you there, and what he says after.
// Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.buried', title: 'The Engine-House', world: 'buried',
  outro: 'The Tooth-Warden is still, the engine runs, and the old pipe-cart rides the canyon again.',
  find: 'West of the domes a drum of rust-red iron stands out of the dunes, as tall as the oculus: the Engine-House. Its oval door looks toward the start',
  gadget: 'Find what the makers left inside the Engine-House',
  keeper: 'Something is jamming the engine at the heart of the house, grinding. Go to it',
};

export const PEOPLE = {
  brann: {
    id: 'brann', name: 'Fisk', title: 'who greases the Engine-House door', color: '#5fa6a0', voice: 0.92, kind: 'm',
    palette: { cloak: '#5fa6a0', lining: '#33485a', cloth: '#c9b896', legs: '#8e3a2b', hat: '#e9dcc0', hair: '#3a2a22' }, head: 'hair', cape: 0.6,
    lines: ["~neutral~ One yearly greasing. Door’s ready if anyone is.", "~tired~ Grinding every night since the sky rang. You learn to sleep badly.", '~curious~ You count your age in teeth too?'],
    talk: {
      entry: [
        { if: { flag: 'temple.buried.done' }, node: 'after' },
        { if: { flag: 'temple.buried.entered' }, node: 'inside' },
        { if: { flag: 'met.brann' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~neutral~ Fisk. Mind the grease. I oil this door each Tooth Day, like my father did. Nobody opens it. That doesn’t excuse a squeak.",
            "~solemn~ *The Engine-House.* The wheel once turned a tooth a day, they say. Its engine also powered a cart through the canyon to the oculus.",
            "~sad~ Something jammed inside. *The Tooth-Warden*, the machine tending the engine. At night its grinding gets right into your teeth."],
          do: { set: { 'met.brann': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.buried' }, goto: 'go' },
            { text: '~curious~ The pipe-cart?', goto: 'cart' },
            { text: '~neutral~ Goodbye, Fisk.', end: true },
          ],
        },
        cart: {
          say: ["~happy~ The pipe-cart was a round iron platform with a safety rail. Rode from the starting hollow to the oculus and back. Children spent whole days on it.", "~tired~ Now it sits in the sand near the hollow. Looks like a lid. A disappointing retirement."],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.buried' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ Enter *the oval door facing the hollow*. It opens smoothly. I am confident about exactly that much.", "~curious~ My father stopped the old cart’s gears with a cobble when the brake went. *A stone in the teeth*: every engine the makers built stops for that, he said. And starts again when you take it out.", "~whisper~ Watch the Warden for openings. When it exposes its weak points, hit them quickly. Its armour won’t be much use to argue with."],
          choices: [{ text: '~happy~ All at once. Got it.', end: true }],
        },
        again: {
          say: ['~neutral~ The oval door, toward the hollow. Greased.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.buried', started: false }, do: { start: 'temple.buried' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in! Is it all engine, inside?', '~curious~ And the warden?'],
          choices: [
            { text: '~solemn~ Grinding, like you said. It has four vents.', goto: 'four' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        four: { say: ["~curious~ Four targets? Your tank holds three shots. Look for *an extra chamber inside*. The makers tended to leave tools near their problems."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ["~surprised~ The grinding stopped! Then the dune hummed and the cart rose out of the sand. Went down the ramp as if it hadn’t missed a day.",
            "~happy~ Children are riding it to the oculus and back. Jot’s done nine trips. I suspect a tenth is already underway.",
            '~solemn~ I greased the door anyway. Habit.'],
          choices: [
            { text: '~solemn~ The warden was stuck. I stopped it.', goto: 'stopped' },
            { text: '~happy~ Ride the cart, Fisk.', end: true },
          ],
        },
        stopped: { say: ["~solemn~ It can finally stop straining. Whatever happened to it, it tended this engine for a very long time.", '~happy~ I’ll put a dab of grease on it too.'], choices: [{ text: '~neutral~ Goodbye, Fisk.', end: true }] },
      },
    },
  },
};

/** What the dunes say once the engine runs. */
export const LINES_AFTER = ['~surprised~ The pipe-cart runs again!', '~happy~ Down to the oculus and back!', '~solemn~ The grinding has stopped.', '~playful~ Jot rode it nine times.'];
