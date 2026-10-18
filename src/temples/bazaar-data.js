// The Signal Market's temple words (src/temples/bazaar.js builds the
// Undertower): the local who points you there, and what he says after. The
// market talks fast and sells everything; Hobb is the one who listens.
// Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.bazaar', title: 'The Undertower', world: 'bazaar',
  outro: 'The First Sign has its whole line back, and the silent tower speaks it, once a night.',
  find: 'Go down under the silent tower',
  gadget: 'Find what the makers left under the silent tower',
  keeper: 'Go up to the voice in the high hall',
};

export const PEOPLE = {
  // (Hobb was 'pell' until #251, the id of the desert's Pell: meeting one marked the other met)
  hobb: {
    id: 'hobb', name: 'Hobb', title: 'who listens at the old stones', color: '#88b4b5', voice: 0.95, kind: 'm',
    palette: { cloak: '#3a535b', lining: '#f0a083', cloth: '#f5dfab', legs: '#465c65', hat: '#88b4b5', hair: '#2b211f' }, head: 'hair', cape: 0,
    lines: ['~whisper~ Shh. There. Did you hear it?', '~neutral~ One word. All night. Every night.', '~curious~ You’ve got good ears. Have you been down?'],
    talk: {
      entry: [
        { if: { flag: 'temple.bazaar.done' }, node: 'after' },
        { if: { flag: 'temple.bazaar.entered' }, node: 'inside' },
        { if: { flag: 'met.hobb' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~whisper~ (A man has his ear against the paving at the tower’s foot. One raised finger asks you to wait.) Nearly. Listen.",
            "~solemn~ *Somebody.* There it is again. I listen to this stone. Everyone else here is trying to be louder than the next stall.",
            "~curious~ Below us is *the Undertower*, older than the market. They say it once spoke a whole sentence. Since the night every sign showed the mark, it can only repeat that first word."],
          do: { set: { 'met.hobb': true } },
          choices: [
            { text: '~neutral~ I’ll go down to it.', do: { start: 'temple.bazaar' }, goto: 'go' },
            { text: '~curious~ What was the whole line?', goto: 'line' },
            { text: '~whisper~ (listen at the paving with him)', end: true },
          ],
        },
        line: {
          say: ["~sad~ Sel’s tower tells people *somebody out there is talking to you*. Perhaps it learned that message from whatever is underneath.", "~whisper~ Perhaps it’s been trying to finish the sentence all this time."],
          choices: [{ text: '~neutral~ I’ll go down to it.', do: { start: 'temple.bazaar' }, goto: 'go' }, { text: '~solemn~ Then let it try a while longer.', end: true }],
        },
        go: {
          say: ["~neutral~ Go round the back to the doorway in the old stones. Unlocked. Few people here explore where there’s nothing for sale.",
            "~whisper~ Listen to what you hear below, then play it back. I think it needs an answer in its own voice."],
          choices: [{ text: '~happy~ In its own voice. I’ll try.', end: true }],
        },
        again: {
          say: ["~whisper~ (Hobb points to the rear doorway, keeping his ear on the stone.)"],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.bazaar', done: false }, do: { start: 'temple.bazaar' }, end: true }, { text: '~whisper~ (leave him listening)', end: true }],
        },
        inside: {
          say: ['~surprised~ You went down! Is it loud, down there?', '~curious~ And the doors? Do they open for anybody?'],
          choices: [
            { text: "~solemn~ The doors need their own notes played back to them.", goto: 'note' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        note: { say: ["~curious~ An echo. People said the first sign’s words ran back like sand in a glass. Look for something that can keep a sound.", "~neutral~ The makers seemed reluctant to let anything be forgotten."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ["~surprised~ (Hobb sits upright beneath a newly lit tower lamp.) It stopped repeating. I thought it had gone silent for good.",
            "~happy~ Then the whole sentence came out: *Somebody out there is talking to you.* The market stopped to hear it. Even the noodle men.",
            "~solemn~ It will speak once each night now. I can listen standing up. My ear will appreciate the promotion."],
          choices: [
            { text: '~solemn~ I played its own notes back to it.', goto: 'words' },
            { text: '~happy~ Somebody out there is talking to you, Hobb.', goto: 'you' },
            { text: '~playful~ Listen standing up, then.', end: true },
          ],
        },
        words: { say: ["~solemn~ At last it finished what it meant to say. I’m glad someone helped it."], choices: [{ text: '~happy~ Once a night, now.', end: true }] },
        you: { say: ["~happy~ (Hobb laughs.) Yes. You’re talking to me. I’m listening."], choices: [{ text: '~happy~ (listen with him)', end: true }] },
      },
    },
  },
};

/** What the square says once the tower speaks. */
export const LINES_AFTER = ['~happy~ Tonight it speaks again.', '~solemn~ (he looks up at the lamp on the tower)', '~whisper~ Somebody out there…', '~happy~ No more ear on the stones.'];
