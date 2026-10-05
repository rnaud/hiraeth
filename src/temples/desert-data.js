// The desert temple's words (src/temples/desert.js builds the house): the
// local who points you there, and what she says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js;
// tests/temples.test.js checks them).

export const QUEST = {
  id: 'temple.desert', title: 'The Givers’ House', world: 'desert',
  outro: 'The water runs from the Givers’ House again, and the old fields round Qanat are green.',
  find: 'Find the Givers’ house: a great drum of rose stone half sunk in the dunes east of Qanat',
  gadget: 'Find what the Givers left inside their house',
  keeper: 'Something lives in the dark at the heart of the house. Go down to the cistern',
};

export const PEOPLE = {
  sabri: {
    id: 'sabri', name: 'Sabri', title: 'who digs wells', color: '#5fb7ad', voice: 1.12, kind: 'f',
    palette: { cloak: '#5fb7ad', lining: '#2b211f', cloth: '#e6b86f', legs: '#5a4a3a', hat: '#f3ead8', hair: '#3a2a22' }, head: 'wrap', cape: 0.9,
    lines: ['~tired~ Dry again. Every well I dig is dry.', '~curious~ East, the Givers’ house. Have you seen it?', '~neutral~ Dig, and listen, and dig.'],
    talk: {
      entry: [
        { if: { flag: 'temple.desert.done' }, node: 'after' },
        { if: { flag: 'temple.desert.entered' }, node: 'inside' },
        { if: { flag: 'met.sabri' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~curious~ You’re the one out of the sky-ball. I’m Sabri. I dig wells. Every well I dig is dry.',
            '~solemn~ My grandmother said the water didn’t always come up under the tree. It came from *the Givers’ house*, out in *the eastern dunes*: a drum of rose stone as big as a hill. Channels ran from its door to the fields round the walls.',
            '~sad~ Then one year it stopped. The channels filled with sand, and so did the fields. Nobody goes in now. They say something lives in the dark in there, and cries.'],
          do: { set: { 'met.sabri': true } },
          choices: [
            { text: '~neutral~ I’ll go and look.', do: { start: 'temple.desert' }, goto: 'go' },
            { text: '~curious~ What lives in there?', goto: 'keeper' },
            { text: '~neutral~ Good luck with the wells.', end: true },
          ],
        },
        keeper: {
          say: ['~solemn~ Grandmother called it *the Keeper*. The Givers left it to keep their water. She said it was gentle: it let the children ride on its shell to the fields.',
            '~scared~ That was before the water stopped. Now it cries in the dark. I put my ear to the sand out there, once. I didn’t do it twice.'],
          choices: [
            { text: '~neutral~ I’ll go and look.', do: { start: 'temple.desert' }, goto: 'go' },
            { text: '~neutral~ Maybe it is only frightened.', goto: 'frightened' },
          ],
        },
        frightened: {
          say: ['~curious~ Frightened? Of what? It is bigger than a house.', '~tired~ …Although. Grandmother said it hated the dark. She left a lamp lit for it in the fields at night.'],
          choices: [{ text: '~neutral~ I’ll go and look.', do: { start: 'temple.desert' }, goto: 'go' }, { text: '~neutral~ Goodbye, Sabri.', end: true }],
        },
        go: {
          say: ['~happy~ Then go *east of the city*, where the dunes are highest: you can see its top from the walls. The door looks toward Qanat.', '~whisper~ Take your fluid. And something that burns, if you find it. Grandmother said the Givers kept their fires in there too.',
            { if: { flag: 'tool.empty' }, text: '~curious~ That glass on your back is dry, though. Fill it first: the old keepers went down to the water *through the giant’s mouth*, past the back gate. Nothing in the Givers’ house will answer an empty jar.' }],
          choices: [{ text: '~happy~ I’ll tell you what I find.', end: true }],
        },
        again: {
          say: ['~curious~ The Givers’ house is *east of the city*, in the high dunes. Its door looks toward us.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.desert', started: false }, do: { start: 'temple.desert' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in? Into the Givers’ house? What is it like?', '~curious~ Did you hear it? The Keeper?'],
          choices: [
            { text: '~solemn~ It’s dark, and very large. Something breathes down there.', goto: 'breathes' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        breathes: { say: ['~whisper~ Then it is still alive. Grandmother would have cried. Be kind to it, sky-child. It has been alone a long time.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ['~happy~ Look! Look at the fields! The old channel runs, all the way from the Givers’ house, and the sand is green with shoots.',
            '~solemn~ Somebody said they saw the Keeper lying round its spout, asleep, with water up to its knees. Asleep. Not crying.',
            '~playful~ I am going to dig a well that has water in it. Just to see what that’s like.'],
          choices: [
            { text: '~solemn~ It was afraid of the dark. And thirsty.', goto: 'thirsty' },
            { text: '~happy~ Dig a good one, Sabri.', end: true },
          ],
        },
        thirsty: { say: ['~sad~ So were we. All of us, for years, and nobody went to ask it.', '~happy~ You went. Thank you.'], choices: [{ text: '~happy~ Goodbye, Sabri.', end: true }] },
      },
    },
  },
};

/** What Qanat's crowd says once the fields are green (crowd lines are short, one tone each). */
export const LINES_AFTER = ['~happy~ The old fields are green!', '~surprised~ Water in the channel, from the Givers’ house!', '~happy~ Have you seen the shoots?', '~solemn~ The Keeper sleeps by its water.'];
