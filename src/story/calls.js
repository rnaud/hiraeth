// Calls home, taken at the cockpit console (src/ship/ship.js plays them).
//
// The arc (docs/game-brief.md, working decision 1; docs/story-bible.md, "The thread"):
//  - The father is warm but exacting in the prologue. Disappointment is never
//    said outright at first; it shows in the calls, one after each world you
//    complete. He asks what you brought and weighs it against what he expected
//    (power, rare matter, a prize: a *thing*), and grows terser as the quiet
//    keepsakes (a song, a word, a person, a knowing) outnumber the things.
//  - The mother speaks from the third call on. She is gentler and asks other
//    questions: who did you meet (by name, the people you talked to), are you
//    eating.
//  - The calls react to what actually happened, not only to the latest
//    keepsake: the world just finished, the clues (`clue.*`), the bell's note
//    in the tank, the bird's promise, the glyph, the singing light (how many
//    people told you about it), and the Signal Market's broadcast.
//    Each of those is mentioned once (flags `calls.beat.<id>`).
//  - Ilen. Once the broadcast is heard (`clue.bazaar.home` or
//    `world.bazaar.done`), the next call asks about Ilen and the father
//    deflects: relays cross voices (`calls.ilen.asked`). After the ship has
//    flown somewhere else, the mother calls back on her own and tells the
//    truth (`calls.ilen.told`): Ilen was their first child, the traveller's
//    elder sister, sent out with the same words long before the traveller was
//    born. She never came home. The broadcast was the father's message after
//    her. The last thing that came back from her ship was a sound like singing.
//    After that, the father's next call says so himself, and he changes.
//  - The singing light: the parents have heard it too, on Ilen's last signal.
//    The father will not talk about it; the mother says only that much.
//  - Something shifts: once the truth is told, or at the call that asks you
//    home, the father stops weighing what you bring.
//  - The call after ENDING_WORLDS worlds (src/story/ending.js) asks the
//    traveller to come home; Home is then on the galactic map. Later calls
//    wait for you; after the ending they are calls from home.
//  - Call n becomes available once n worlds are complete (`world.<id>.done`
//    or the world's story page); each is heard once (flag `calls.<n>`). The
//    mother's own call is `calls.ilen`.
//
// A line is { who: 'father' | 'mother' | 'ship' | 'you' | 'scene', text, cut?, set? }.
// `set` holds flags to set once the call has been heard (applyCall).

import { ENDING_WORLDS, quoteOf, peopleOf, chosenKeepsake } from './ending.js';

export const KINDS = ['thing', 'song', 'word', 'person', 'knowing'];
export const isQuiet = (k) => !!k && k.kind !== 'thing' && k.kind !== 'nothing';

/** The call in the prologue: cut off by the impact. */
export const PROLOGUE_CALL = [
  { who: 'father', text: 'There you are. You slept through the last jump.' },
  { who: 'father', text: 'Listen to me. Out there, nobody owes you anything. Not the people, not the worlds.' },
  { who: 'father', text: 'You carry our name now. Your mother says to eat something warm.' },
  { who: 'father', text: 'My son, make us proud. Bring back something of value.' },
  { who: 'father', text: 'We will be waiting for you at the—', cut: true },
];

/** One call per world on the route; call ENDING_WORLDS asks you home. */
export const CALL_COUNT = 11;
/** The mother's own call, about Ilen. */
export const ILEN_CALL = 'ilen';

const WORLDS = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'];
const name = (k) => k?.name ?? 'nothing';
const F = (text, set) => ({ who: 'father', text, ...(set ? { set } : {}) });
const M = (text, set) => ({ who: 'mother', text, ...(set ? { set } : {}) });
const S = (text, set) => ({ who: 'scene', text, ...(set ? { set } : {}) });
const YOU = (text, set) => ({ who: 'you', text, ...(set ? { set } : {}) });
const pick = (arr, i) => arr[Math.min(i, arr.length - 1)];

// What each side says about the latest keepsake, by kind and by how terse he
// has become (0 warm and exacting .. 2 terse; 3: after something has shifted).
const FATHER_ON = {
  thing: [
    (k) => `${name(k)}. Good. Something you can hold. What would it fetch at the market?`,
    (k) => `${name(k)}. Better. That is the kind of thing I meant.`,
    (k) => `${name(k)}. Fine. Keep it safe.`,
    (k) => `${name(k)}. Keep it, if you like it. It is not what I am waiting for.`,
  ],
  song: [
    (k) => `${name(k)}? A song. We cannot fuel a ship with a song, son.`,
    (k) => `Another song. ${name(k)}.`,
    () => 'A song.',
    (k) => `${name(k)}. Hum it for me some time. Not now. Some time.`,
  ],
  word: [
    (k) => `Something someone said. “${quoteOf(k)}” Words are cheap out there.`,
    (k) => `${name(k)}. Words again.`,
    () => 'Words.',
    (k) => `“${quoteOf(k)}” Say it again. Slower.`,
  ],
  person: [
    (k) => `${name(k)}. People make promises to travellers. They are easy to make.`,
    (k) => `${name(k)}. You collect friends now.`,
    () => 'Another friend.',
    (k) => `${name(k)}. Someone who wants you back. I understand that better than you think.`,
  ],
  knowing: [
    (k) => `So you have learned something. ${name(k)}. Can you show it to anyone?`,
    (k) => `${name(k)}. An idea. I asked for something I could see.`,
    () => 'Ideas.',
    (k) => `${name(k)}. You understand something I don’t. Tell me when you are home.`,
  ],
};

const MOTHER_ON = {
  thing: () => 'It is lovely. Who made it? Did they mind you taking it?',
  song: () => 'Will you sing it for me when you are home? Just once, slowly.',
  word: () => 'Say it again. I want to remember it the way they said it.',
  person: () => 'Someone who wants you to come back. That is not nothing.',
  knowing: () => 'You sound different. You understand something now that you did not before. I can hear it.',
};

// The father on the world you just finished (what you told him about it).
const FATHER_ON_WORLD = {
  desert: 'Desert water in the ship’s heart. Resourceful. Your grandmother would have done the same.',
  incal: 'A city built down a hole. Mind the people at the top, son. They decide what the bottom eats.',
  arzach: 'A silent world. You must have liked that. You never said much at the table either.',
  arzach2: 'Monks, and a bell nobody rang. And you rang it. Hm.',
  garage: 'A man who built a whole world and forgot why. I have met one or two of those.',
  buried: 'A wheel that turns one tooth a year. Patience. I can respect patience.',
  edena: 'A garden that grows over fallen ships. Very pretty. Very slow.',
  spheres: 'Stones that remember sounds. And who told you that? The stones?',
  perdide: 'A swamp that sings. Did you keep your boots dry, at least?',
  perdide2: 'People keeping lamps lit for travellers who never come. That is not a trade, son. That is a habit.',
};

/** Everything the calls know about the journey, from the context. */
export function facts(ctx = {}) {
  const flag = ctx.flag ?? (() => undefined);
  const k = ctx.keepsake ?? null;
  const all = ctx.keepsakes ?? (k ? [k] : []);
  const has = (id) => all.some((x) => x.id === id);
  const completed = ctx.completed ?? [];
  const lastWorld = ctx.lastWorld ?? completed[completed.length - 1] ?? k?.level ?? null;
  return {
    flag, k, all, completed, lastWorld, here: ctx.here ?? flag('ship.level') ?? null,
    quiet: all.filter(isQuiet).length,
    things: all.filter((x) => x.kind === 'thing').length,
    lights: WORLDS.filter((w) => flag(`${w}.rumour.light`)).length + (flag('perdide.clue.ship') ? 1 : 0),
    bell: !!(flag('arzach2.bell.note') || has('arzach2.song')),
    bird: !!(flag('bird.promise') || has('arzach.person')),
    glyph: !!(flag('clue.buried.mark') || flag('perdide.glyph.ship') || flag('perdide.clue.ship')),
    struck: !!flag('clue.edena.struck'),
    lamps: !!(flag('perdide2.promise') || has('perdide2.person')),
    broadcast: !!(flag('clue.bazaar.home') || flag('world.bazaar.done')),
    ilenAsked: !!flag('calls.ilen.asked'),
    ilenTold: !!flag('calls.ilen.told'),
    heard: (id) => !!flag(`calls.beat.${id}`),
    asked: !!flag('calls.home'),
    ended: !!flag('ending.done'),
    chosen: ctx.chosen ?? null,
    worldTitle: ctx.worldTitle ?? null,
  };
}

/** The names of the people you talked to in a world (at most two). */
function metIn(world, flag) {
  return peopleOf(world).filter((p) => flag(`met.${p.id}`)).slice(0, 2).map((p) => p.name);
}

/**
 * The once-only things a call can bring up, most important first. Each is
 * { id, lines(f, n) }; the first line carries the flag that marks it heard.
 */
const BEATS = [
  {
    // the broadcast: you ask about Ilen, and he deflects
    id: 'ilen', when: (f) => f.broadcast && !f.ilenAsked,
    lines: (f, n) => [
      YOU('(You say a name into the line: Ilen.)', { 'calls.ilen.asked': true, 'calls.ilen.at': f.here ?? true }),
      F('…'),
      F('The old relays carry a great many voices. They get crossed. One man sounds much like another, that far out.'),
      ...(n >= 3 ? [S('(Your mother looks at him, and says nothing.)')] : []),
      F('What else did you bring back?'),
    ],
  },
  {
    // after the mother's call: he says it himself
    id: 'ilen.after', when: (f) => f.ilenTold,
    lines: () => [
      F('Your mother told you.', { 'calls.beat.ilen.after': true }),
      F('She was right to. It should have been me.'),
      F('I said the same words to you at the port that I said to her. I heard myself say them. I could not stop.'),
    ],
  },
  {
    // the singing light: he will not talk about it
    id: 'light', when: (f) => f.lights >= 2,
    lines: (f, n) => [
      F('A light that sings.', { 'calls.beat.light': true }),
      F('Who has been telling you that?'),
      F('Travellers’ tales. Do not go looking for it. Do you hear me? Do not.'),
      ...(n >= 3 ? [S('(Your mother has stopped smiling.)')] : []),
    ],
  },
  {
    // Stel and Atan's ship: struck by the same light
    id: 'struck', when: (f) => f.struck,
    lines: () => [
      F('Another ship, struck the same way as yours? Out there ships are struck. That is all it is.', { 'calls.beat.struck': true }),
    ],
  },
  {
    id: 'glyph', when: (f) => f.glyph,
    lines: () => [
      F('Three dots over an arc. Like the scar on your hull. You found it out there too?', { 'calls.beat.glyph': true }),
      F('Have the hull looked at when you are home. Not out there.'),
    ],
  },
  {
    // the bell's note: it sounds from the tank, and they hear it down the line
    id: 'bell', when: (f) => f.bell,
    lines: (f, n) => n >= 3 ? [
      M('What is that, behind you? That low note.', { 'calls.beat.bell': true }),
      F('A bell. The harbour bell sounded like that, once. They rang it when a ship came in.'),
    ] : [
      F('What is that hum on the line? A bell?', { 'calls.beat.bell': true }),
      F('The harbour bell sounded like that, once. They rang it when a ship came in.'),
    ],
  },
  {
    id: 'bird', when: (f) => f.bird,
    lines: (f, n) => [
      F('A bird. You let a bird make you a promise.', { 'calls.beat.bird': true }),
      ...(n >= 3 ? [M('Is she very big? Will she come here, if you call her?')] : []),
    ],
  },
  {
    id: 'lamps', when: (f) => f.lamps,
    lines: (f, n) => n >= 3 ? [
      M('Someone keeps a lamp lit for you now. Out there. Imagine that.', { 'calls.beat.lamps': true }),
      F('…'),
    ] : [F('A lamp-keeper asked you to come back. People out there ask a lot of you.', { 'calls.beat.lamps': true })],
  },
  {
    id: 'things', when: (f) => f.things >= 2,
    lines: () => [F('Two things you can hold. Now we are getting somewhere.', { 'calls.beat.things': true })],
  },
  {
    id: 'quiet', when: (f) => f.quiet >= 4 && f.things === 0,
    lines: () => [F('Not one thing you can hold. Not in all this time.', { 'calls.beat.quiet': true })],
  },
  {
    // the mother, later: he heard it too
    id: 'light.late', when: (f, n) => n >= 3 && f.heard('light') && (f.struck || f.lights >= 4),
    lines: () => [M('Your father stood at the window last night, a long time. He said he heard something singing. There was nothing there.', { 'calls.beat.light.late': true })],
  },
];

const LEAD = new Set(['ilen', 'ilen.after']);

/**
 * The beats of one call: { lead, rest }. A lead beat (Ilen) comes right after
 * the greeting and is the only one that call; otherwise up to `max` others,
 * after the keepsake.
 */
function beats(f, n, max = 2) {
  const due = BEATS.filter((b) => (b.id === 'ilen' || !f.heard(b.id)) && b.when(f, n));
  const lead = due.find((b) => LEAD.has(b.id));
  if (lead) return { lead: [lead], rest: [] };
  return { lead: [], rest: due.slice(0, max) };
}

/** The mother's own call: Ilen. */
function motherAlone(f) {
  return [
    M('It’s me. Your father is asleep. I wanted to call on my own.', { 'calls.ilen.told': true }),
    M('You asked him about Ilen. He told you about relays.'),
    M('Ilen was your sister. She was grown and gone before you were born.'),
    M('She went out, the way you did. He stood at the port and told her to make us proud. To bring back something of value.'),
    M('She never came home. We never found out why.'),
    M('He sent that message after her every night for a year. Then I asked him to stop, and he stopped.'),
    ...(f.lights >= 1 ? [M('The last thing that came back from her ship wasn’t a voice. It was a sound. Like something singing.')] : []),
    M('He isn’t asking you for something of value. He never was. He just doesn’t know how to ask for the other thing.'),
    M('Don’t tell him I called. Or do. I think he would be glad.'),
  ];
}

/**
 * The lines of call n (1..CALL_COUNT, or ILEN_CALL).
 * @param ctx { keepsake (latest or null), keepsakes (all), worldTitle (just finished), flag(k),
 *              completed (world ids), lastWorld, here (the world the ship stands in), chosen (the keepsake brought home) }
 */
export function callLines(n, ctx = {}) {
  const f = facts(ctx);
  if (n === ILEN_CALL) return motherAlone(f);
  const { k, quiet, flag } = f;
  const shifted = f.ilenTold && n >= 3;
  const tier = shifted ? 3 : Math.min(2, Math.floor(quiet / 2) + (n >= 4 ? 1 : 0));   // how terse he has become
  const bs = beats(f, n, 2);
  const talksIlen = bs.lead.some((b) => b.id === 'ilen');
  const lead = bs.lead.flatMap((b) => b.lines(f, n));
  const rest = bs.rest.flatMap((b) => b.lines(f, n));
  const bazaarWord = k?.id === 'bazaar.word';
  const onK = k && !(bazaarWord && talksIlen) ? F(bazaarWord ? 'Those words from the tower. Leave them where you found them.' : pick(FATHER_ON[k.kind] ?? FATHER_ON.thing, tier)(k)) : null;
  const motherOn = k && MOTHER_ON[k.kind] && !talksIlen ? M(MOTHER_ON[k.kind](k)) : null;
  const where = f.worldTitle ? ` ${f.worldTitle}` : '';
  const nothing = talksIlen ? null : F('And? You have nothing to show me? Not one thing?');
  const world = !talksIlen && n >= 2 && FATHER_ON_WORLD[f.lastWorld] ? [F(FATHER_ON_WORLD[f.lastWorld])] : [];
  const met = f.lastWorld ? metIn(f.lastWorld, flag) : [];
  const whoMet = met.length === 2 ? M(`${met[0]} and ${met[1]}. Say their names again, slowly. I want to remember them.`)
    : met.length === 1 ? M(`${met[0]}. Tell me about ${met[0]}. What do they laugh at?`)
      : M(k ? `Never mind that. Who gave it to you? Who did you meet${where ? ' on' + where : ''}?` : 'Never mind that. Who did you meet? Tell me one person.');
  const opt = (x) => (x ? [x] : []);

  // after the ending: calls from home
  if (f.ended) {
    const c = f.chosen ?? chosenKeepsake({ flag, keepsakes: () => f.all });
    return [
      M('There you are. Out again? Good. Tell me everything.'),
      F(c && c.id !== 'nothing' ? `${name(c)} is on the shelf by the round window. Your mother dusts it every morning.` : 'Your chair is where you left it. Nobody sits in it.'),
      ...lead,
      ...world,
      ...(k && !talksIlen ? [F(`And now ${name(k)}. Bring it, or don’t. Just call.`)] : []),
      ...rest.slice(0, 2),
      whoMet,
      F('Come home when you are ready. Not before.'),
    ];
  }
  // the call that asks you home (only the Ilen beats here), and the ones after it
  if (n >= ENDING_WORLDS) {
    if (!f.asked) return [
      M('We are both here. He wants to say something.', { 'calls.home': true }),
      F('Son.'),
      ...lead,
      F('I have been thinking about what I asked of you. Something of value. I never said what.'),
      ...(k && !talksIlen ? [F(isQuiet(k) && quiet >= 3 ? `You keep bringing back the quiet things. ${name(k)}. Your mother says that is an answer.` : `${name(k)}. You have a good eye. I see that now.`)] : []),
      ...(f.ilenTold ? [F('I asked your sister for the same thing. I would have taken her back with empty hands.')] : []),
      F('Come home.'),
      M('Bring one thing, if you like. Or nothing at all. Just come.'),
      { who: 'ship', text: 'Course for home available on the galactic map.' },
    ];
    return [
      M('Still out there? That’s all right. We are still here.'),
      ...lead,
      ...world,
      ...(talksIlen ? [] : onK && tier >= 3 ? [onK] : k ? [F(`${name(k)}. Bring it, if you like.`)] : []),
      ...rest.slice(0, 1),
      whoMet,
      F('Home is on your map. Whenever you are ready.'),
    ];
  }
  switch (n) {
    case 1: return [
      F('You are flying again. Good. I knew you would find a way.'),
      ...lead,
      F(`${where ? `So.${where}.` : 'So.'} What did you bring back?`),
      ...opt(onK ?? nothing),
      ...rest,
      F(isQuiet(k) ? 'Hm. Keep looking. There is time.' : 'Your mother sends her love. Do not waste the fuel.'),
    ];
    case 2: return [
      F('Another world behind you. What have you got this time?'),
      ...lead,
      ...world,
      ...opt(onK ?? nothing),
      ...rest,
      F(isQuiet(k) ? 'I asked for something of value, son. Not a souvenir.' : 'The Orrin boy came home with a reactor core. Just so you know.'),
      F('Next world. Do better.'),
    ];
    case 3: return [
      M('Is that you? Oh, let me see your face. You look thin.'),
      F('Well? What have you brought.'),
      ...lead,
      ...world,
      ...opt(onK ?? nothing),
      ...rest,
      whoMet,
      ...opt(motherOn),
      F(shifted ? 'Keep going. Carefully.' : tier >= 1 ? 'We will talk when there is more to talk about.' : 'Keep going. We are counting on you.'),
    ];
    case 4: return [
      F(shifted ? 'It’s me. Tell me where you are.' : tier >= 1 ? 'Report.' : 'Report, then.'),
      ...lead,
      ...world,
      ...opt(onK ?? nothing),
      ...rest,
      M('Are you eating? Are you sleeping in the bunk, or in the chair again?'),
      met.length ? whoMet : M('Tell me about the people. Not the things. What do they laugh at?'),
      ...(isQuiet(k) ? opt(motherOn) : []),
      F(shifted ? 'Call again soon. Never mind what it costs.' : 'Keep the line short. Calls cost.'),
    ];
    case 5: default: return [
      M('He is here. He just does not want to start.'),
      ...(lead.length ? [] : [M('I found your old drawings in the hall cupboard. The round ship, and the three of us, holding hands.')]),
      ...lead,
      ...(talksIlen ? [] : opt(motherOn ?? M('Did anyone out there ask about home? About us?'))),
      ...world,
      ...(talksIlen ? [] : [F(k ? (shifted ? `${name(k)}. Bring whatever you like.` : isQuiet(k) ? `${name(k)}. Is that what you mean to bring home?` : `${name(k)}. That might be enough. Might.`) : 'Is there anything you mean to bring home at all?')]),
      ...rest,
      F(shifted ? 'Come back to us.' : 'Think about it.'),
    ];
  }
}

/** Set the flags a heard call carries (who was asked about what). */
export function applyCall(game, lines) {
  for (const l of lines ?? []) for (const [k, v] of Object.entries(l.set ?? {})) game.set(k, v);
}

/** The worlds counted as complete. */
export function completedWorlds(ids, { flag, storyDone }) {
  return ids.filter((id) => flag?.(`world.${id}.done`) || storyDone?.(id));
}

/** The mother's own call is waiting: Ilen was asked about, and the ship has flown since. */
export function ilenPending(flag) {
  if (!flag('calls.ilen.asked') || flag('calls.ilen.told') || flag(`calls.${ILEN_CALL}`)) return false;
  const at = flag('calls.ilen.at');
  return at === true || at === undefined || flag('ship.level') !== at;
}

/**
 * The call waiting at the console, or null: the mother's own call first (see
 * ilenPending), then the first unheard call n with n <= the number of
 * completed worlds (one call per completion, in order).
 */
export function pendingCall({ flag, completed }) {
  if (ilenPending(flag)) return ILEN_CALL;
  for (let n = 1; n <= Math.min(CALL_COUNT, completed); n++) if (!flag(`calls.${n}`)) return n;
  return null;
}

/** Everything a call needs, from the shared game state. */
export function callContext(game, { titles = {}, lastWorld = null, completed = [] } = {}) {
  const ks = game.keepsakes() ?? [];
  const keepsake = ks.length ? ks[ks.length - 1] : null;
  const last = lastWorld ?? completed[completed.length - 1] ?? null;
  return {
    keepsake, keepsakes: ks, worldTitle: titles[keepsake?.level ?? last] ?? null,
    flag: (k) => game.flag(k), completed, lastWorld: last, here: game.flag('ship.level') ?? null,
    chosen: game.flag('ending.done') ? chosenKeepsake(game) : null,
  };
}
