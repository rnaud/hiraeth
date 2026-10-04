// Calls home, taken at the cockpit console (src/ship/ship.js plays them).
//
// The arc (docs/game-brief.md, working decision 1; docs/story-bible.md, "The thread"):
//  - The father is warm but exacting in the prologue. Disappointment is never
//    said outright at first; it shows in the calls, one after each world you
//    complete. He asks what you brought and weighs it against what he expected
//    (power, rare matter, a prize: a *thing*), and grows terser when the
//    keepsakes are quiet ones (a song, a word, a person, a knowing).
//  - The mother speaks from the third call on. She is gentler and asks other
//    questions: who did you meet, what did they say, are you eating.
//  - Each call reacts to the latest keepsake (game.keepsakes(), its `kind`).
//  - Call n becomes available once n worlds are complete (`world.<id>.done`
//    or the world's story page); each is heard once (flag `calls.<n>`).
//  - The last call, about the choice of what to bring home, is not built
//    (the ending isn't); call 6 only points at it.
//
// A line is { who: 'father' | 'mother' | 'ship', text, cut? }.

export const KINDS = ['thing', 'song', 'word', 'person', 'knowing'];
export const isQuiet = (k) => !!k && k.kind !== 'thing';

/** The call in the prologue: cut off by the impact. */
export const PROLOGUE_CALL = [
  { who: 'father', text: 'There you are. You slept through the last jump.' },
  { who: 'father', text: 'Listen to me. Out there, nobody owes you anything. Not the people, not the worlds.' },
  { who: 'father', text: 'You carry our name now. Your mother says to eat something warm.' },
  { who: 'father', text: 'My son, make us proud. Bring back something of value.' },
  { who: 'father', text: 'We will be waiting for you at the—', cut: true },
];

const name = (k) => k?.name ?? 'nothing';

// What each side says about the latest keepsake, by kind.
const FATHER_ON = {
  thing: [
    (k) => `${name(k)}. Good. Something you can hold. What would it fetch at the market?`,
    (k) => `${name(k)}. Better. That is the kind of thing I meant.`,
    (k) => `${name(k)}. Fine. Keep it safe.`,
  ],
  song: [
    (k) => `${name(k)}? A song. We cannot fuel a ship with a song, son.`,
    (k) => `Another song. ${name(k)}.`,
    () => 'A song.',
  ],
  word: [
    (k) => `Something someone said. "${k?.text ?? name(k)}" Words are cheap out there.`,
    (k) => `${name(k)}. Words again.`,
    () => 'Words.',
  ],
  person: [
    (k) => `${name(k)}. People make promises to travellers. They are easy to make.`,
    (k) => `${name(k)}. You collect friends now.`,
    () => 'Another friend.',
  ],
  knowing: [
    (k) => `So you have learned something. ${name(k)}. Can you show it to anyone?`,
    (k) => `${name(k)}. An idea. I asked for something I could see.`,
    () => 'Ideas.',
  ],
};

const MOTHER_ON = {
  thing: () => 'It is lovely. Who made it? Did they mind you taking it?',
  song: () => 'Will you sing it for me when you are home? Just once, slowly.',
  word: () => 'Say it again. I want to remember it the way they said it.',
  person: () => 'Someone who wants you to come back. That is not nothing.',
  knowing: () => 'You sound different. You understand something now that you did not before. I can hear it.',
};

const pick = (arr, i) => arr[Math.min(i, arr.length - 1)];

/**
 * The lines of call n (1..6).
 * @param ctx { keepsake (latest or null), keepsakes (all), worldTitle (just finished) }
 */
export function callLines(n, ctx = {}) {
  const k = ctx.keepsake ?? null;
  const all = ctx.keepsakes ?? (k ? [k] : []);
  const quiet = all.filter(isQuiet).length;
  const tier = Math.min(2, Math.floor(quiet / 2) + (n >= 4 ? 1 : 0));   // how terse he has become
  const on = (who) => (k ? (who === 'father' ? pick(FATHER_ON[k.kind] ?? FATHER_ON.thing, tier)(k) : (MOTHER_ON[k.kind] ?? MOTHER_ON.thing)(k)) : null);
  const where = ctx.worldTitle ? ` ${ctx.worldTitle}` : '';
  const F = (text) => ({ who: 'father', text }), M = (text) => ({ who: 'mother', text });
  const nothing = F('And? You have nothing to show me? Not one thing?');
  switch (n) {
    case 1: return [
      F(`You are flying again. Good. I knew you would find a way.`),
      F(`${where ? `So.${where}.` : 'So.'} What did you bring back?`),
      k ? F(on('father')) : nothing,
      F(isQuiet(k) ? 'Hm. Keep looking. There is time.' : 'Your mother sends her love. Do not waste the fuel.'),
    ];
    case 2: return [
      F('Another world behind you. What have you got this time?'),
      k ? F(on('father')) : nothing,
      F(isQuiet(k) ? 'I asked for something of value, son. Not a souvenir.' : 'The Orrin boy came home with a reactor core. Just so you know.'),
      F('Next world. Do better.'),
    ];
    case 3: return [
      M('Is that you? Oh, let me see your face. You look thin.'),
      F('Well? What have you brought.'),
      k ? F(on('father')) : nothing,
      M(k ? `Never mind that. Who gave it to you? Who did you meet${where ? ' on' + where : ''}?` : 'Never mind that. Who did you meet? Tell me one person.'),
      ...(k ? [M(on('mother'))] : []),
      F(tier >= 1 ? 'We will talk when there is more to talk about.' : 'Keep going. We are counting on you.'),
    ];
    case 4: return [
      F(tier >= 1 ? 'Report.' : 'Report, then.'),
      k ? F(on('father')) : nothing,
      M('Are you eating? Are you sleeping in the bunk, or in the chair again?'),
      M('Tell me about the people. Not the things. What do they laugh at?'),
      ...(k && isQuiet(k) ? [M(on('mother'))] : []),
      F('Keep the line short. Calls cost.'),
    ];
    case 5: return [
      M('He is here. He just does not want to start.'),
      M('I found your old drawings in the hall cupboard. The round ship, and the three of us, holding hands.'),
      k ? M(on('mother')) : M('Did anyone out there ask about home? About us?'),
      F(k ? (isQuiet(k) ? `${name(k)}. Is that what you mean to bring home?` : `${name(k)}. That might be enough. Might.`) : 'Is there anything you mean to bring home at all?'),
      F('Think about it.'),
    ];
    case 6: return [
      M('We are both here. He wants to say something.'),
      F('Son.'),
      F('I have been thinking about what I asked of you. I said something of value. I did not say what.'),
      ...(k ? [F(quiet >= 3 ? `You keep bringing back the quiet things. ${name(k)}. Your mother says that is an answer.` : `${name(k)}. You have a good eye. I see that now.`)] : []),
      M('Come home when you are ready. Bring whatever you choose. We will listen.'),
      F(quiet >= 3 ? 'Choose well.' : 'Bring the best of it.'),
    ];
    default: return [];
  }
}

export const CALL_COUNT = 6;

/** The worlds counted as complete. */
export function completedWorlds(ids, { flag, storyDone }) {
  return ids.filter((id) => flag?.(`world.${id}.done`) || storyDone?.(id));
}

/**
 * The call waiting at the console, or null: the first unheard call n with
 * n <= the number of completed worlds (one call per completion, in order).
 */
export function pendingCall({ flag, completed }) {
  for (let n = 1; n <= Math.min(CALL_COUNT, completed); n++) if (!flag(`calls.${n}`)) return n;
  return null;
}

/** Everything a call needs, from the shared game state. */
export function callContext(game, { titles = {}, lastWorld = null } = {}) {
  const ks = game.keepsakes() ?? [];
  const keepsake = ks.length ? ks[ks.length - 1] : null;
  return { keepsake, keepsakes: ks, worldTitle: titles[keepsake?.level ?? lastWorld] ?? null };
}
