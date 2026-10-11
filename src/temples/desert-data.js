// The desert temple's words (src/temples/desert.js builds the house): the
// local who points you there, and what she says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js;
// tests/temples.test.js checks them).

export const QUEST = {
  id: 'temple.desert', title: 'The Givers’ House', world: 'desert',
  outro: 'The water runs from the Givers’ House again, and the old fields round Qanat are green.',
  find: 'Find the Givers’ house east of Qanat',
  gadget: 'Find what the Givers left inside their house',
  keeper: 'Go down to what lives in the cistern',
};

export const PEOPLE = {
  sabri: {
    id: 'sabri', name: 'Sabri', title: 'who digs wells', color: '#5fb7ad', voice: 1.12, kind: 'f',
    palette: { cloak: '#5fb7ad', lining: '#2b211f', cloth: '#e6b86f', legs: '#5a4a3a', hat: '#f3ead8', hair: '#3a2a22' }, head: 'wrap', cape: 0.9,
    lines: ["~tired~ Another dry well. Excellent hole, though.", "~curious~ Seen the rose-stone house east of here?", "~neutral~ Dig. Listen. Mostly hear myself digging."],
    talk: {
      entry: [
        { if: { flag: 'temple.desert.done' }, node: 'after' },
        { if: { flag: 'temple.desert.entered' }, node: 'inside' },
        { if: { flag: 'met.sabri' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~curious~ Sabri. Well-digger. Currently specialising in holes that disappoint people.",
            "~solemn~ Our fields once took water from *the rose-stone house in the eastern dunes*. That great round drum of a building. You can still trace the channels back to its door.",
            "~sad~ Then the flow stopped. Sand buried the fields. Nobody enters the house now. You can hear something crying inside."],
          do: { set: { 'met.sabri': true } },
          choices: [
            { text: '~neutral~ I’ll go and look.', do: { start: 'temple.desert' }, goto: 'go' },
            { text: '~curious~ What lives in there?', goto: 'keeper' },
            { text: '~neutral~ Good luck with the wells.', end: true },
          ],
        },
        keeper: {
          say: ["~solemn~ Grandmother called it *the Keeper*. The Givers left it to tend the water. Children used to ride its shell out to the fields.",
            "~scared~ Now it cries down in the dark. I heard it through the sand once. I wasn’t brave enough to go closer."],
          choices: [
            { text: '~neutral~ I’ll go and look.', do: { start: 'temple.desert' }, goto: 'go' },
            { text: '~neutral~ Maybe it is only frightened.', goto: 'frightened' },
          ],
        },
        frightened: {
          say: ["~curious~ Something that big can be frightened?", "~tired~ Yes. Of course it can. Grandmother left a lamp for it at night. Said it hated the dark."],
          choices: [{ text: '~neutral~ I’ll go and look.', do: { start: 'temple.desert' }, goto: 'go' }, { text: '~neutral~ Goodbye, Sabri.', end: true }],
        },
        go: {
          say: ["~happy~ Go *east of Qanat into the high dunes*. Look for the rose-stone drum. *Its door faces the city.*", "~whisper~ Bring fluid. Look for the Givers’ fire inside; the Keeper may need light as well as water.",
            "~curious~ Grandmother swore the Givers left *their blade and their guard* in there. Nobody has been brave enough to fetch them.",
            { if: { flag: 'tool.empty' }, text: "~curious~ Your tank’s empty. Find the water through the giant’s mouth beyond Qanat’s back gate first. You’ll need fluid inside the house." },
            { if: { not: { flag: 'item.doublejump' } }, text: "~neutral~ They say the house’s old channel is a long jump wide. Longer than one jump, anyway." }],
          choices: [{ text: '~happy~ I’ll tell you what I find.', end: true }],
        },
        again: {
          say: ["~curious~ *East of the city, among the high dunes.* Enter on the side facing Qanat."],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.desert', started: false }, do: { start: 'temple.desert' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ["~surprised~ You went inside? What’s down there?", "~curious~ Did you find the Keeper?"],
          choices: [
            { text: "~solemn~ Something very large is breathing in the dark.", goto: 'breathes' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        breathes: { say: ["~whisper~ Still alive. All that time. Be gentle with it, please. It used to carry children."], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ["~happy~ The channel’s running! Look at the shoots. I thought that field was only sand now.",
            "~solemn~ They say the Keeper’s asleep beside its spout, legs in the water. No more crying.",
            "~playful~ Tomorrow I dig a well with water in it. May need to learn the second half of my job."],
          choices: [
            { text: '~solemn~ It was afraid of the dark. And thirsty.', goto: 'thirsty' },
            { text: '~happy~ Dig a good one, Sabri.', end: true },
          ],
        },
        thirsty: { say: ["~sad~ Thirsty and frightened. Just like us. We could have helped each other years ago.", "~happy~ You went in. Thank you for that."], choices: [{ text: '~happy~ Goodbye, Sabri.', end: true }] },
      },
    },
  },
};

/** What Qanat's crowd says once the fields are green (crowd lines are short, one tone each). */
export const LINES_AFTER = ['~happy~ The old fields are green!', '~surprised~ Water in the channel, from the Givers’ house!', '~happy~ Have you seen the shoots?', '~solemn~ The Keeper sleeps by its water.'];
