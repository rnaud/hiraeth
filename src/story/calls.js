// The recordings, played at the cockpit console (src/ship/ship.js plays them;
// the parents rise over the dash as a hologram, src/ship/hologram.js).
//
// There are no calls home. The traveller's parents are dead (docs/story-bible.md,
// "The recordings"): what he has is the reel, every message they ever left him
// on the old house recorder over twenty-odd years. Most of them are not happy
// with him. After each world he asks the reel for a word that belongs to the
// world just finished, and plays the one match, hoping it is about where he
// has been. It never answers him; it fits loosely, sometimes oddly.
//
//  - The age shows a little more each time (AGE, keyed to n, the recordings
//    heard): no date at first, then a worn date stamp, a child's voice behind
//    them (his own), "logged nineteen years ago", a worn tape, the mother
//    saying "one day you will listen to these". The recording after
//    ENDING_WORLDS worlds (src/story/ending.js) is the last on the reel: "Come
//    home", logged eleven days before the house went quiet. Home is then on the
//    galactic map. Later ones are from the reel's oldest side, happier.
//  - The world he asks about (REEL): the search word, the line it finds, his
//    own short reaction.
//  - What happened on the journey (BEATS, each once, flags `calls.beat.<id>`):
//    the singing light, the bell, Odile and Talo's ship, the glyph, the bird,
//    the lamps... a recording that happens to hold something he cannot explain.
//  - The keepsake he holds up to the projector: whatever its kind, the father
//    once said something about such things (FATHER_ON), more tersely as the
//    quiet keepsakes outnumber the things; once the truth about Ilen is told,
//    what he said later, sorrier.
//  - Lou, his daughter (home, src/story/home-data.js), is on the late recordings twice, never
//    by name ("the little one"): the mother, four years ago, "She has your hands"; the father,
//    in the last recording, her drawings with him in them, waving.
//  - The mother speaks from the third on. She asks who he met; he answers with
//    their names. She cannot hear him.
//  - Ilen. Once the broadcast is heard (`clue.bazaar.home` or
//    `world.bazaar.done`), he asks the reel for the name (`calls.ilen.asked`):
//    one recording in his mother's voice, "For when he asks". Not here, not
//    yet. After the ship has flown somewhere else it waits at the console
//    (`calls.ilen`, `calls.ilen.told`): Ilen was his elder sister. The next
//    recording he finds is the father saying it himself.
//  - Recording n becomes available once n worlds are complete (`world.<id>.done`
//    or the world's story page); each is heard once (flag `calls.<n>`).
//
// A line is { who: 'father' | 'mother' | 'ship' | 'you' | 'scene', text, tone, cut?, set? }.
// Each is written with its tone ('~sad~ …', src/story/tone.js); the helpers read it off, and
// the voice (src/story/voice.js speakLine) mumbles it in the home tongue. Lines in brackets are
// silent. `set` holds flags to set once the recording has been heard (applyCall).

import { ENDING_WORLDS, peopleOf, chosenKeepsake } from './ending.js';
import { spoken } from './tone.js';

export const KINDS = ['thing', 'song', 'word', 'person', 'knowing'];
export const isQuiet = (k) => !!k && k.kind !== 'thing' && k.kind !== 'nothing' && k.kind !== 'all';

const F = (text, set) => spoken('father', text, set ? { set } : null);
const M = (text, set) => spoken('mother', text, set ? { set } : null);
const S = (text, set) => spoken('scene', text, set ? { set } : null);
const SHIP = (text, set) => spoken('ship', text, set ? { set } : null);
const YOU = (text, set) => spoken('you', text, set ? { set } : null);
const pick = (arr, i) => arr[Math.min(i, arr.length - 1)];

/** The recording in the prologue: the father, the day the traveller left. The impact cuts it off. */
export const PROLOGUE_CALL = [
  SHIP('~neutral~ Playing from the reel.'),
  F('~neutral~ Is it on? The little light is on. Right. There you are.'),
  F('~solemn~ Listen to me. Out there, nobody owes you anything. Not the people, not the worlds.'),
  F('~neutral~ Keep the translator at your ear. Nobody out there talks like us, and you will want to know what they are saying about you.'),
  F('~angry~ You leave everything here half done. The boat. The school. Your mother.'),
  F('~solemn~ My son, make us proud. Bring back something of value.'),
  spoken('father', '~neutral~ We will be waiting for you at the—', { cut: true }),
];

/** One recording per world on the route; recording ENDING_WORLDS asks you home. */
export const CALL_COUNT = 11;
/** The mother's own recording, about Ilen ("For when he asks"). */
export const ILEN_CALL = 'ilen';

const WORLDS = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'];
const name = (k) => k?.name ?? 'nothing';
/** A keepsake's name inside a sentence: “a rust gear tooth”, “the bell’s note”. */
const nameIn = (k) => name(k).replace(/^(A|An|The) /, (m) => m.toLowerCase());

/**
 * What he asks the reel for after each world, what it finds, and what he makes of it.
 * The father never knew where his son would be: the lines are what he said about something
 * else, long ago, that happens to fit (or nearly).
 */
export const REEL = {
  desert: { word: 'water',
    find: '~tired~ …and turn the tap off when you are done. Water doesn’t come from nowhere, son. Somebody carries it.',
    you: '~whisper~ (Somebody carried it. The giants did.)' },
  incal: { word: 'looking up',
    find: '~solemn~ Stop staring up at the lamps and look where you are going. And mind the people at the top. They decide what the bottom eats.',
    you: '~whisper~ (I looked up anyway.)' },
  arzach: { word: 'quiet',
    find: '~playful~ Quiet again. You never said much at the table either. Your mother says you are thinking. I say you are sulking.',
    you: '~whisper~ (Nobody says much there. I liked it.)' },
  arzach2: { word: 'bell',
    find: '~tired~ Ring it once if you must. Once. Then put it back on the shelf.',
    you: '~whisper~ (I rang it. The cloud came down.)' },
  garage: { word: 'why',
    find: '~tired~ You start things and you forget why. The boat. The radio. Half of them are still in the shed.',
    you: '~whisper~ (So did the Major. He kept going anyway.)' },
  buried: { word: 'patience',
    find: '~neutral~ Patience. Everything worth having turns slowly. One tooth at a time, your grandfather used to say. I never knew what he meant.',
    you: '~surprised~ (One tooth at a time.)' },
  edena: { word: 'garden',
    find: '~tired~ Your mother’s garden has grown over the old cart again. She says leave it. I say it is a cart.',
    you: '~whisper~ (They let the garden take the ships, there.)',
    // after the tea terraces went (src/story/terraces.js): the same words land differently
    youAfter: { flag: 'edena.terraces.flooded', you: '~sad~ (They let the garden take the ships, there. I didn’t leave things be. I opened their gate.)' } },
  spheres: { word: 'remember',
    find: '~angry~ Stones that remember sounds? Who told you that? The stones?',
    you: '~whisper~ (One of them remembered a drum.)' },
  perdide: { word: 'rain',
    find: '~playful~ Did you keep your boots dry, at least? No. Of course not.',
    you: '~playful~ (No.)' },
  perdide2: { word: 'lamp',
    find: '~angry~ People who keep a light on for someone who never comes. That is not hope, son. That is a habit.',
    you: '~whisper~ (They keep the lamps lit there anyway. For whoever comes.)' },
  bazaar: { word: 'listening',
    find: '~tired~ You never listen. I say a thing and it goes past you like weather.',
    you: '~whisper~ (I’m listening now.)' },
};
const REEL_ANY = { word: 'home', find: '~neutral~ The house is quiet without you. I don’t mind. I don’t.', you: null };

/**
 * How old each recording is, and how it shows (n = 1 .. ENDING_WORLDS - 1): its greeting, its
 * goodbye, his reaction, the ship's note at the end, and the label on the console's screen.
 */
export const AGE = {
  1: {
    open: [F('~neutral~ It’s me. You didn’t call back, so I am leaving this.')],
    close: () => [F('~tired~ Keep looking, then. There is time. There is always time, you say.')],
    log: '~neutral~ End of recording.', label: '',
  },
  2: {
    open: [F('~angry~ Your exams were today. You were not at your exams.')],
    close: (f) => [
      F('~angry~ The Orrin boy came home with a reactor core, top of his year. Just so you know.'),
      F(f.shifted ? '~sad~ And mend the fence before you go. Please.' : '~angry~ And mend the fence before you go anywhere. Do better.'),
    ],
    you: '~whisper~ (The fence came down years ago.)',
    log: '~neutral~ End of recording. The date stamp is worn off this one.', label: '·· WORN ··',
  },
  3: {
    open: [
      M('~happy~ Is it recording? Oh. Hello, love. It’s us.'),
      S('~solemn~ (A child’s voice, somewhere behind them: “Is that for me?” It is your voice.)'),
      F('~tired~ Not now. Go and wash your hands.'),
    ],
    close: (f) => [F(f.shifted ? '~happy~ Go on, then. Carefully.' : f.tier >= 1 ? '~angry~ We will talk when there is more to talk about.' : '~solemn~ Go on, then. We are counting on you.')],
    you: '~whisper~ (I remember that day. I was seven.)',
    log: '~neutral~ Recording logged nineteen years ago.', label: 'LOGGED 19 YEARS AGO',
  },
  // an old one, made for him at ten, the summer he was sent to his grandfather's (the recordings
  // are numbered from the first after the prologue: 1..5 here, then the last one at ENDING_WORLDS)
  4: {
    open: [
      F('~tired~ You have been at your grandfather’s a week and we have not had one word. Your mother says I should say something nice first.'),
      F('~tired~ …Report, then. Like a pilot. Where you went, what you saw. Then come back to the recorder and tell us.'),
    ],
    close: (f) => [
      S('~neutral~ (The tape is worn here. A few words go under the hiss.)'),
      F('~solemn~ …when you are older, you will understand why I…'),
      F(f.shifted ? '~happy~ Call your mother. Never mind what it costs.' : '~angry~ Keep it short. These spools cost.'),
    ],
    you: '~whisper~ I know what it says. I just want to hear it.',
    log: '~neutral~ Logged sixteen years ago. You were ten, and away for the summer. The tape is wearing thin on this side.', label: 'LOGGED 16 YEARS AGO',
  },
  5: {
    open: [
      M('~playful~ He is here. He just does not want to start.'),
      M('~happy~ I found your old drawings in the hall cupboard. The round ship, and the three of us, holding hands.'),
      // Lou, three and a half, a year and a half on the hill (LORE.md §2): never named on the reel
      M('~whisper~ The little one sat with me and looked at every one. She has your hands, love.'),
    ],
    close: (f) => [
      F(f.shifted ? '~sad~ Come back to us.' : '~angry~ Think about it.'),
      M('~sad~ Your father says I shouldn’t make these. He says you never listen to them.'),
      M('~solemn~ I think one day you will.'),
    ],
    you: '~whisper~ (I am.)',
    log: '~neutral~ Logged four years ago.', label: 'LOGGED 4 YEARS AGO',
  },
};

/** The reel's oldest side, from when he was small: after the last recording, and after the ending. */
export const OLDER = [
  { label: 'LOGGED 21 YEARS AGO', lines: [
    M('~happy~ Say it again for the recorder. What did you see today?'),
    S('~playful~ (A small voice: “A bird as big as the house.”)'),
    F('~playful~ As big as the house. Well.'),
  ] },
  { label: 'LOGGED 22 YEARS AGO', lines: [
    F('~happy~ He fell asleep in the cockpit chair again. I have put my old cap on him.'),
    M('~happy~ Don’t wake him. Look at him.'),
  ] },
  { label: 'LOGGED 20 YEARS AGO', lines: [
    M('~playful~ He wants to be a pilot. Tell the recorder, love.'),
    S('~happy~ (A small voice: “I’m going to bring you back a star.”)'),
    F('~happy~ A star. We will need a bigger shelf.'),
  ] },
  { label: 'LOGGED 20 YEARS AGO', lines: [
    F('~happy~ First day of school. He didn’t cry. I did, a little.'),
    M('~playful~ More than a little.'),
  ] },
  { label: 'LOGGED 21 YEARS AGO', lines: [
    M('~happy~ Happy birthday, love. Five. Blow. Blow! There.'),
    F('~happy~ Make a wish. Don’t tell us. That is the rule.'),
  ] },
];

// What the father once said about such things, by kind and by how terse he has become
// (0 .. 2 more and more curt; 3: what he said later, once something had shifted).
const FATHER_ON = {
  thing: [
    () => '~neutral~ Another stone from the river. Your mother keeps them on the sill. I don’t know what for.',
    () => '~happy~ Now that is the kind of thing I mean. Something you can hold.',
    () => '~tired~ Keep it safe, then. Whatever it is.',
    () => '~sad~ Keep it, if you like it. It was never the thing I was waiting for.',
  ],
  song: [
    () => '~angry~ And stop drumming on the table. Nobody ever fuelled a ship with a song.',
    () => '~tired~ Humming again. All day, humming.',
    () => '~tired~ A song.',
    () => '~sad~ Hum it for me some time. Not now. Some time.',
  ],
  word: [
    () => '~angry~ Words. You always have words. Show me something.',
    () => '~tired~ Words again.',
    () => '~angry~ Words.',
    () => '~solemn~ Say it again. Slower.',
  ],
  person: [
    () => '~angry~ You and your friends. Friends make promises. They are easy to make.',
    () => '~angry~ Out with your friends again. You collect them.',
    () => '~tired~ Another friend.',
    () => '~sad~ Someone who wants you back. I understand that better than you think.',
  ],
  knowing: [
    () => '~curious~ So you understand how it works. Then build it. Show me.',
    () => '~angry~ An idea. I asked for something I could see.',
    () => '~tired~ Ideas.',
    () => '~solemn~ You understand something I don’t. Tell me, when you are home.',
  ],
};

// What the mother once said to the child bringing such a thing home (from the third on).
const MOTHER_ON = {
  thing: () => '~happy~ It’s lovely. Who made it? Did they mind you taking it?',
  song: () => '~happy~ Sing it for me again tonight. Just once, slowly.',
  word: () => '~happy~ Say it again. I want to remember it the way you said it.',
  person: () => '~happy~ Someone who wants you to come back. That is not nothing.',
  knowing: () => '~solemn~ You sound different today. You understand something you didn’t. I can hear it.',
};

/** Everything the recordings know about the journey, from the context. */
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
    broke: !!flag('edena.terraces.flooded'),
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
 * The once-only things a recording can bring up, most important first. Each is
 * { id, intro?(f, n), body?(f, n), lines?(f, n) }; the first line carries the flag that
 * marks it heard. A lead beat (Ilen) has an intro (before the search) and, for the one after
 * the truth, a body of its own (the recording it finds instead).
 */
const BEATS = [
  {
    // the broadcast: he asks the reel for the name, and is not ready for what it has
    id: 'ilen', when: (f) => f.broadcast && !f.ilenAsked,
    intro: (f) => [
      YOU('~solemn~ (You ask the reel for a name you heard at the market: Ilen.)', { 'calls.ilen.asked': true, 'calls.ilen.at': f.here ?? true }),
      SHIP('~neutral~ Nothing in your father’s voice. One recording in your mother’s, labelled “For when he asks.”'),
      YOU('~whisper~ Not here. Not yet.'),
    ],
  },
  {
    // after the mother's recording: the father, saying it himself
    id: 'ilen.after', when: (f) => f.ilenTold,
    intro: () => [
      YOU('~solemn~ (You ask the reel for her name, in his voice.)', { 'calls.beat.ilen.after': true }),
      SHIP('~neutral~ He never says it. One recording comes close.'),
    ],
    body: () => [
      F('~sad~ Your mother says I should make one of these. So.'),
      F('~sad~ I said the same words to you at the port that I said to your sister. I heard myself say them. I could not stop.'),
    ],
  },
  {
    // the tea terraces: the quest that failed (src/story/terraces.js). Not a scolding: what he said once
    // about breaking things, which is the right thing for once
    id: 'broke', when: (f) => f.broke,
    lines: (f, n) => [
      F('~tired~ And if you break something out there, and you will, you say sorry, and you mean it, and then you go. Standing about in their yard looking at it mends nothing.', { 'calls.beat.broke': true }),
      ...(n >= 3 ? [M('~sad~ Did they forgive you, love? People mostly do, if you let them.')] : []),
      YOU('~whisper~ (Esk did. I don’t think I have, yet.)'),
    ],
  },
  {
    // the singing light: a warning he could not have known to give
    id: 'light', when: (f) => f.lights >= 2,
    lines: (f, n) => [
      F('~scared~ And if you ever hear something singing out there, you turn the ship around. Do you hear me? You turn around.', { 'calls.beat.light': true }),
      ...(n >= 3 ? [S('~solemn~ (Your mother has stopped smiling.)')] : []),
      YOU('~surprised~ (How could he know?)'),
    ],
  },
  {
    // Odile and Talo's ship: struck by the same light
    id: 'struck', when: (f) => f.struck,
    lines: () => [
      F('~angry~ Ships get struck out there. That is all it is. That is what I told your mother.', { 'calls.beat.struck': true }),
      YOU('~whisper~ (Like Odile and Talo’s. Like mine.)'),
    ],
  },
  {
    id: 'glyph', when: (f) => f.glyph,
    lines: () => [
      F('~tired~ And you have drawn those three dots on the landing ring again. Over an arc. Scrub them off before your mother sees.', { 'calls.beat.glyph': true }),
      YOU('~whisper~ (I drew that before I knew what it was.)'),
    ],
  },
  {
    // the harbour bell behind them, like the bell under the cloud
    id: 'bell', when: (f) => f.bell,
    lines: (f, n) => [
      ...(n >= 3 ? [
        M('~curious~ Hear that? Behind us. That low note.', { 'calls.beat.bell': true }),
        F('~sad~ The harbour bell. They ring it when a ship comes in. I always look.'),
      ] : [F('~sad~ Hear that? The harbour bell. They ring it when a ship comes in. I always look.', { 'calls.beat.bell': true })]),
      YOU('~whisper~ (It sounds like the bell under the cloud.)'),
    ],
  },
  {
    id: 'bird', when: (f) => f.bird,
    lines: (f, n) => [
      F('~playful~ A bird made you a promise? You and your stories.', { 'calls.beat.bird': true }),
      ...(n >= 3 ? [M('~curious~ Is she very big, your bird? Will she come if you call her?')] : []),
      YOU('~whisper~ (She would. She does.)'),
    ],
  },
  {
    id: 'lamps', when: (f) => f.lamps,
    lines: (f, n) => n >= 3 ? [
      M('~happy~ I have left the lamp on in the round window. Come in whenever you like. Wake me.', { 'calls.beat.lamps': true }),
      F('~tired~ …'),
    ] : [F('~tired~ Your mother has left the lamp on in the window again. For you.', { 'calls.beat.lamps': true })],
  },
  {
    id: 'things', when: (f) => f.things >= 2,
    lines: () => [
      F('~happy~ Two good marks this term. Two things you can hold up. Now we are getting somewhere.', { 'calls.beat.things': true }),
      YOU('~whisper~ (Two things I can hold. Does that count?)'),
    ],
  },
  {
    id: 'quiet', when: (f) => f.quiet >= 4 && f.things === 0,
    lines: () => [
      F('~angry~ A whole year, and not one thing to show for it. Not one.', { 'calls.beat.quiet': true }),
      YOU('~whisper~ (Songs. Words. People. Do they count?)'),
    ],
  },
  {
    // the mother, later: he heard it too
    id: 'light.late', when: (f, n) => n >= 3 && f.heard('light') && (f.struck || f.lights >= 4),
    lines: () => [M('~whisper~ Your father stood at the window last night a long time. He said he heard something singing. There was nothing there.', { 'calls.beat.light.late': true })],
  },
];

const LEAD = new Set(['ilen', 'ilen.after']);

/**
 * The beats of one recording: { lead, rest }. A lead beat (Ilen) comes first and is the only
 * one that time; otherwise up to `max` others, after the keepsake.
 */
function beats(f, n, max = 2) {
  const due = BEATS.filter((b) => (b.id === 'ilen' || !f.heard(b.id)) && b.when(f, n));
  const lead = due.find((b) => LEAD.has(b.id));
  if (lead) return { lead: [lead], rest: [] };
  return { lead: [], rest: due.slice(0, max) };
}

/** The mother's own recording: Ilen. */
function motherAlone(f) {
  return [
    SHIP('~neutral~ The recording labelled “For when he asks.” Your mother’s voice.'),
    M('~whisper~ It’s me. Your father is asleep. I wanted to make this one on my own.', { 'calls.ilen.told': true }),
    M('~neutral~ If you are hearing this, you heard him on some old relay, and you asked about Ilen. He won’t have told you. He never could.'),
    M('~solemn~ Ilen was your sister. She was grown and gone before you were born.'),
    M('~sad~ She went out, the way you did. He stood at the port and told her to make us proud. To bring back something of value.'),
    M('~sad~ She never came home. We never found out why.'),
    M('~sad~ He sent that message after her every night for a year. Then I asked him to stop, and he stopped.'),
    ...(f.lights >= 1 ? [M('~whisper~ The last thing that came back from her ship wasn’t a voice. It was a sound. Like something singing.')] : []),
    M('~solemn~ He isn’t asking you for something of value. He never was. He just doesn’t know how to ask for the other thing.'),
    M('~playful~ I’ll tell him I made this. Or I won’t. I think he would be glad.'),
    YOU('~whisper~ (She knew I would ask.)'),
    SHIP('~neutral~ Logged six years ago.'),
  ];
}

/** The label on the console's screen while recording n plays (src/ship/portrait.js). */
export function recordingLabel(n, ctx = {}) {
  if (n === 'prologue') return '';
  if (n === ILEN_CALL) return 'FOR WHEN HE ASKS';
  if (n === 'final') return 'THE OLDEST RECORDING';
  const f = facts(ctx);
  if (typeof n === 'number' && n >= ENDING_WORLDS) {
    if (!f.asked && !f.ended) return 'THE LAST RECORDING';
    return OLDER[(n - ENDING_WORLDS - 1 + OLDER.length) % OLDER.length].label;
  }
  return AGE[n]?.label ?? '';
}

/** Who stands on the hologram for recording n: 'father' | 'mother' | 'both'. */
export function onHologram(n) {
  if (n === ILEN_CALL) return 'mother';
  if (n === 'prologue') return 'father';
  return typeof n === 'number' && n < 3 ? 'father' : 'both';
}

/**
 * The lines of recording n (1..CALL_COUNT, or ILEN_CALL).
 * @param ctx { keepsake (latest or null), keepsakes (all), worldTitle (just finished), flag(k),
 *              completed (world ids), lastWorld, here (the world the ship stands in), chosen (what was left at the stone) }
 */
export function callLines(n, ctx = {}) {
  const f = facts(ctx);
  if (n === ILEN_CALL) return motherAlone(f);
  const { k, quiet, flag } = f;
  f.shifted = f.ilenTold;   // once the truth is told, the recordings he finds are the sorrier ones
  f.tier = f.shifted ? 3 : Math.min(2, Math.floor(quiet / 2) + (n >= 4 ? 1 : 0));
  const bs = beats(f, n, n >= 3 ? 1 : 2);
  const lead = bs.lead[0] ?? null;
  const leadIntro = lead?.intro?.(f, n) ?? [];
  const leadBody = lead?.body?.(f, n) ?? null;
  const rest = bs.rest.flatMap((b) => b.lines(f, n));
  const reel = REEL[f.lastWorld] ?? REEL_ANY;
  const search = leadBody ? [] : [
    YOU(`~neutral~ (You ask the reel for anything about ${reel.word}.)`),
    SHIP(n === 1 ? '~neutral~ One match. Playing.' : '~neutral~ One match.'),
  ];
  const find = leadBody ?? [F(reel.find)];
  const you = reel.youAfter && flag(reel.youAfter.flag) ? reel.youAfter.you : reel.you;
  const react = !leadBody && you ? [YOU(you)] : [];
  // the keepsake: he holds it up to the projector; the recording happens to hold what the father once said about such things
  const shown = k ? [YOU(`~neutral~ (You hold ${nameIn(k)} up to the projector, where they would see it.)`), F(pick(FATHER_ON[k.kind] ?? FATHER_ON.thing, f.tier)(k))] : [];
  // the mother asks who he met; he answers with the names
  const met = f.lastWorld ? metIn(f.lastWorld, flag) : [];
  const ask = M('~curious~ Who did you meet today? Tell me one person. Just one.');
  const answer = met.length === 2 ? [YOU(`~whisper~ ${met[0]} and ${met[1]}.`)] : met.length === 1 ? [YOU(`~whisper~ ${met[0]}.`)] : [];
  const motherOn = k && MOTHER_ON[k.kind] && !answer.length ? [M(MOTHER_ON[k.kind](k))] : [];   // (she asks about the thing when there is nobody to name)

  // after the ending, and after the last recording: the reel's oldest side
  if (f.ended || (n >= ENDING_WORLDS && f.asked)) {
    const old = OLDER[(n - ENDING_WORLDS - 1 + OLDER.length * 4) % OLDER.length];
    const c = f.ended ? (f.chosen ?? chosenKeepsake({ flag, keepsakes: () => f.all })) : null;
    return [
      ...leadIntro,
      ...(leadBody ?? []),
      SHIP(f.ended ? '~neutral~ The oldest side of the reel. Playing.' : '~neutral~ Nothing left on this side. Turning the reel over: the oldest side.'),
      ...old.lines,
      ...(k ? [YOU(`~neutral~ (You hold ${nameIn(k)} up to the projector anyway.)`)] : []),
      ...rest.slice(0, 1),
      ask, ...answer,
      ...(f.ended
        ? [YOU(c && c.id !== 'all' && c.id !== 'nothing' ? `~whisper~ (${name(c)} is on the stone on the hill.)` : '~whisper~ (Everything you brought is on the stone on the hill, under the two moons.)')]
        : [SHIP('~neutral~ Home is on the map, whenever you are ready.')]),
    ];
  }
  // the last recording on the reel: it asks you home (only the Ilen beats here)
  if (n >= ENDING_WORLDS) return [
    ...leadIntro,
    ...(leadBody ?? []),
    YOU('~neutral~ (You ask the reel for the last thing they recorded.)'),
    SHIP('~neutral~ The last recording on the reel. Playing.'),
    M('~solemn~ We are both here. He wants to say something.', { 'calls.home': true }),
    F('~solemn~ Son.'),
    F('~solemn~ I have been thinking about what I asked of you. Something of value. I never said what.'),
    ...(k ? [YOU(`~whisper~ (You hold ${nameIn(k)} up to them.)`)] : []),
    ...(f.ilenTold ? [F('~sad~ I asked your sister for the same thing. I would have taken her back with empty hands.')] : []),
    // Lou, five, across the yard: the drawings he keeps in his chair (src/story/home-data.js), not said
    F('~sad~ The little one puts you in all her drawings. Somewhere at the edge, waving.'),
    F('~solemn~ Come home.'),
    M('~happy~ Bring whatever you have. Or nothing at all. Just come.'),
    S('~solemn~ (The picture holds on the two of them a moment, then folds away.)'),
    SHIP('~neutral~ That was the last recording on the reel. Logged two years ago, eleven days before the house went quiet.'),
    YOU('~whisper~ I’m coming home.'),
    SHIP('~neutral~ Course for home available on the galactic map.'),
  ];
  const A = AGE[n] ?? AGE[5];
  return [
    ...leadIntro,
    ...search,
    ...A.open,
    ...find,
    ...react,
    ...shown,
    ...rest,
    ...(n >= 3 ? [ask, ...answer, ...motherOn] : []),
    ...A.close(f),
    ...(A.you ? [YOU(A.you)] : []),
    SHIP(A.log),
  ];
}

/** The lines that come from the reel (the parents'), as a range of indices: [first, last] or null. */
export function recordingSpan(lines = []) {
  let a = -1, b = -1;
  lines.forEach((l, i) => { if (l.who === 'father' || l.who === 'mother') { if (a < 0) a = i; b = i; } });
  return a < 0 ? null : [a, b];
}

/** Set the flags a heard recording carries (what was asked about). */
export function applyCall(game, lines) {
  for (const l of lines ?? []) for (const [k, v] of Object.entries(l.set ?? {})) game.set(k, v);
}

/** The worlds counted as complete. */
export function completedWorlds(ids, { flag, storyDone }) {
  return ids.filter((id) => flag?.(`world.${id}.done`) || storyDone?.(id));
}

/** The mother's own recording is waiting: Ilen was asked about, and the ship has flown since. */
export function ilenPending(flag) {
  if (!flag('calls.ilen.asked') || flag('calls.ilen.told') || flag(`calls.${ILEN_CALL}`)) return false;
  const at = flag('calls.ilen.at');
  return at === true || at === undefined || flag('ship.level') !== at;
}

/**
 * The recording waiting at the console, or null: the mother's own first (see
 * ilenPending), then the first unheard recording n with n <= the number of
 * completed worlds (one per completion, in order).
 */
export function pendingCall({ flag, completed }) {
  if (ilenPending(flag)) return ILEN_CALL;
  for (let n = 1; n <= Math.min(CALL_COUNT, completed); n++) if (!flag(`calls.${n}`)) return n;
  return null;
}

/** Everything a recording needs, from the shared game state. */
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

