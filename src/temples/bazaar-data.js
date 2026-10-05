// The Signal Market's temple words (src/temples/bazaar.js builds the
// Undertower): the local who points you there, and what he says after. The
// market talks fast and sells everything; Pell is the one who listens.
// Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.bazaar', title: 'The Undertower', world: 'bazaar',
  outro: 'The First Sign has its whole line back, and the silent tower speaks it, once a night.',
  find: 'In the back of the silent tower, where the square’s paving gives way to great old stones, a doorway older than the market goes down: the Undertower',
  gadget: 'Find what the makers left under the silent tower',
  keeper: 'Far down under the tower a voice says one word, and waits, and says it again. Go down to it',
};

export const PEOPLE = {
  pell: {
    id: 'pell', name: 'Pell', title: 'who listens at the old stones', color: '#88b4b5', voice: 0.95, kind: 'm',
    palette: { cloak: '#3a535b', lining: '#f0a083', cloth: '#f5dfab', legs: '#465c65', hat: '#88b4b5', hair: '#2b211f' }, head: 'hair', cape: 0.7,
    lines: ['~whisper~ Shh. There. Did you hear it?', '~neutral~ One word. All night. Every night.', '~curious~ You’ve got good ears. Have you been down?'],
    talk: {
      entry: [
        { if: { flag: 'temple.bazaar.done' }, node: 'after' },
        { if: { flag: 'temple.bazaar.entered' }, node: 'inside' },
        { if: { flag: 'met.pell' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~whisper~ (A man has his ear against the paving at the tower’s foot. One raised finger asks you to wait.) Nearly. Listen.",
            "~solemn~ *Somebody.* There it is again. I’m Pell. I listen to this stone. Everyone else here is trying to be louder than the next stall.",
            "~curious~ Below us is *the Undertower*, older than the market. They say it once spoke a whole sentence. Since the sky rang, it can only repeat that first word."],
          do: { set: { 'met.pell': true } },
          choices: [
            { text: '~neutral~ I’ll go down to it.', do: { start: 'temple.bazaar' }, goto: 'go' },
            { text: '~curious~ What was the whole line?', goto: 'line' },
            { text: '~neutral~ Goodbye, Pell.', end: true },
          ],
        },
        line: {
          say: ["~sad~ Sel’s tower tells people *somebody out there is talking to you*. Perhaps it learned that message from whatever is underneath.", "~whisper~ Perhaps it’s been trying to finish the sentence all this time."],
          choices: [{ text: '~neutral~ I’ll go down to it.', do: { start: 'temple.bazaar' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ Go round the back to the doorway in the old stones. Unlocked. Few people here explore where there’s nothing for sale.",
            "~whisper~ Listen to what you hear below, then play it back. I think it needs an answer in its own voice."],
          choices: [{ text: '~happy~ In its own voice. I’ll try.', end: true }],
        },
        again: {
          say: ["~whisper~ (Pell points to the rear doorway, keeping his ear on the stone.)"],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.bazaar', started: false }, do: { start: 'temple.bazaar' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went down! Is it loud, down there?', '~curious~ And the doors? Do they open for anybody?'],
          choices: [
            { text: "~solemn~ The doors need their own notes played back to them.", goto: 'note' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        note: { say: ["~curious~ An echo. People used to hear the first sign in shells held to their ears. Look for something that can catch a sound.", "~neutral~ A makers’ shell, perhaps. They seemed reluctant to let anything be forgotten."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ["~surprised~ (Pell sits upright beneath a newly lit tower lamp.) It stopped repeating. I thought it had gone silent for good.",
            "~happy~ Then the whole sentence came out: *Somebody out there is talking to you.* The market stopped to hear it. Even the noodle men.",
            "~solemn~ It will speak once each night now. I can listen standing up. My ear will appreciate the promotion."],
          choices: [
            { text: '~solemn~ It was stuck. I gave it its words back.', goto: 'words' },
            { text: '~happy~ Somebody out there is talking to you, Pell.', goto: 'you' },
            { text: '~neutral~ Goodbye, Pell.', end: true },
          ],
        },
        words: { say: ["~solemn~ At last it finished what it meant to say. I’m glad someone helped it."], choices: [{ text: '~neutral~ Goodbye, Pell.', end: true }] },
        you: { say: ["~happy~ (Pell laughs.) Yes. You’re talking to me. I’m listening."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the square says once the tower speaks. */
export const LINES_AFTER = ['~happy~ Tonight it speaks again.', '~solemn~ (he looks up at the lamp on the tower)', '~whisper~ Somebody out there…', '~happy~ No more ear on the stones.'];
