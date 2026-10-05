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
          say: ['~whisper~ (A man is lying on the paving with his ear to an old stone at the foot of the silent tower. He holds up one finger.) Shh. Wait for it.',
            '~solemn~ There. *Somebody*. That’s all it ever says. I’m Pell. I come and listen to it. Nobody else in this market listens to anything; they’re all too busy being heard.',
            '~curious~ Under the tower is the *Undertower*, the old people say: the foundations, here before the market. The first sign there ever was. It used to say a whole line. The night the sky rang it got stuck on one word of it.'],
          do: { set: { 'met.pell': true } },
          choices: [
            { text: '~neutral~ I’ll go down to it.', do: { start: 'temple.bazaar' }, goto: 'go' },
            { text: '~curious~ What was the whole line?', goto: 'line' },
            { text: '~neutral~ Goodbye, Pell.', end: true },
          ],
        },
        line: {
          say: ['~sad~ Nobody remembers. Sel says the tower above it only ever said one thing, in a thousand voices, *somebody out there is talking to you*. Maybe it learned that from the one underneath.', '~whisper~ Maybe the one underneath is still trying to say it, and can’t get past the first word.'],
          choices: [{ text: '~neutral~ I’ll go down to it.', do: { start: 'temple.bazaar' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ The doorway in the old stones, round the back. It isn’t locked. Nobody here would think of going down: there’s nothing to sell.',
            '~whisper~ Down there, I think, things want to be listened to, and then answered in their own voice. Don’t shout at it. Give it back what it says.'],
          choices: [{ text: '~happy~ In its own voice. I’ll try.', end: true }],
        },
        again: {
          say: ['~whisper~ (He points at the doorway without lifting his ear from the stone.)'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.bazaar', started: false }, do: { start: 'temple.bazaar' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went down! Is it loud, down there?', '~curious~ And the doors? Do they open for anybody?'],
          choices: [
            { text: '~solemn~ They listen for a note. Only a note played back to them.', goto: 'note' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        note: { say: ['~curious~ Played back… like an echo. The old people used to hold shells to their ears and say they could hear the first sign in them.', '~neutral~ The makers kept everything. They’d have kept a shell.'], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ['~surprised~ (Pell is sitting up, for once, looking up at the silent tower. There is a lamp burning on its crown.) It stopped. It stopped saying *somebody*.',
            '~happy~ And last night, all at once, the tower said it. The whole line, in that old voice, over the whole square. *Somebody out there is talking to you.* Everybody stopped selling. Even the noodle men.',
            '~solemn~ It’ll say it again tonight, the doorway says. Once a night. I’ll be here. I won’t need my ear on the stones any more.'],
          choices: [
            { text: '~solemn~ It was stuck. I gave it its words back.', goto: 'words' },
            { text: '~happy~ Somebody out there is talking to you, Pell.', goto: 'you' },
            { text: '~neutral~ Goodbye, Pell.', end: true },
          ],
        },
        words: { say: ['~solemn~ Then it’s said what it was made to say. That’s more than most of us get to do.'], choices: [{ text: '~neutral~ Goodbye, Pell.', end: true }] },
        you: { say: ['~happy~ (He laughs, a little embarrassed.) I know. You are.'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the square says once the tower speaks. */
export const LINES_AFTER = ['~happy~ Tonight it speaks again.', '~solemn~ (he looks up at the lamp on the tower)', '~whisper~ Somebody out there…', '~happy~ No more ear on the stones.'];
