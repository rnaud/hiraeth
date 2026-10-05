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
    id: 'brann', name: 'Brann', title: 'who greases the Engine-House door', color: '#5fa6a0', voice: 0.92, kind: 'm',
    palette: { cloak: '#5fa6a0', lining: '#33485a', cloth: '#c9b896', legs: '#8e3a2b', hat: '#e9dcc0', hair: '#3a2a22' }, head: 'hair', cape: 0.6,
    lines: ['~neutral~ Grease the hinge, every Tooth Day. Nobody opens it.', '~tired~ Hear that? Grinding. Forty-one years of grinding.', '~curious~ You count your age in teeth too?'],
    talk: {
      entry: [
        { if: { flag: 'temple.buried.done' }, node: 'after' },
        { if: { flag: 'temple.buried.entered' }, node: 'inside' },
        { if: { flag: 'met.brann' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Mind the grease. I’m Brann. I grease the Engine-House door, every Tooth Day, the way my father did. Nobody opens it. A door wants grease anyway.',
            '~solemn~ The wheel’s engine is in there, the old people say. *The Engine-House*. It used to turn the wheel a tooth a day, not a tooth a year, and the pipe-cart ran down the canyon to the oculus and back.',
            '~sad~ Then something in there got stuck. The Tooth-Warden, Hask calls it: the makers’ machine that minds the engine. It grinds at night. You can feel it in your teeth.'],
          do: { set: { 'met.brann': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.buried' }, goto: 'go' },
            { text: '~curious~ The pipe-cart?', goto: 'cart' },
            { text: '~neutral~ Goodbye, Brann.', end: true },
          ],
        },
        cart: {
          say: ['~happy~ A round iron floor with a rail round it. It rode the canyon from the start hollow down to the oculus and back, my grandmother said, and the children rode it all day.', '~tired~ It hasn’t moved since the engine stuck. It sits in the sand by the hollow like a lid.'],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.buried' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ *The oval door*, on the side toward the hollow. It opens. I made sure.', '~whisper~ If you meet the warden, don’t argue with it. Machines don’t listen. Find where it opens, and hit it there, quick, all at once.'],
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
        four: { say: ['~curious~ Four? And your tank holds three, I saw. You’ll want a fourth. The makers usually leave you what you need, if you look.'], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ['~surprised~ It stopped! The grinding stopped, and then the whole dune hummed, and the pipe-cart lifted out of the sand like it had been asleep and went down the ramp on its own.',
            '~happy~ The children have been riding it all morning, down to the oculus and back. Pim rode it nine times. He says he is ten teeth old now, from the excitement.',
            '~solemn~ I greased the door anyway. Habit.'],
          choices: [
            { text: '~solemn~ The warden was stuck. I stopped it.', goto: 'stopped' },
            { text: '~happy~ Ride the cart, Brann.', end: true },
          ],
        },
        stopped: { say: ['~solemn~ Then it can rest. It minded the engine longer than any of us have counted teeth.', '~happy~ I’ll put a dab of grease on it too.'], choices: [{ text: '~neutral~ Goodbye, Brann.', end: true }] },
      },
    },
  },
};

/** What the dunes say once the engine runs. */
export const LINES_AFTER = ['~surprised~ The pipe-cart runs again!', '~happy~ Down to the oculus and back!', '~solemn~ The grinding has stopped.', '~playful~ Pim rode it nine times.'];
