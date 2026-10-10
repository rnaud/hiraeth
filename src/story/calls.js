// The recordings, played at the cockpit console (src/ship/ship.js plays them;
// the parents rise over the dash as a hologram, src/ship/hologram.js).
//
// The player is never told what these are: the console has a voicemail button that blinks
// when a message waits, and pressing it plays it. What they are shows over time (the date
// stamps, a child's voice), never in a prompt.
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
//  - After the first homecoming (src/story/ending.js: the light came over the hill; he kept the reel),
//    the ship has logged it (TRACE_CALL, `calls.trace`): the light's trace runs back out along the
//    route; he asks the reel for "singing" and finds the father at the window, years ago. Every
//    recording after that ends by pointing back out (the trace on the map, or the relay further on),
//    until the true ending (`ending.final`).
//  - Recording n becomes available once n worlds are complete (`world.<id>.done`
//    or the world's story page); each is heard once (flag `calls.<n>`).
//
// A line is { who: 'father' | 'mother' | 'ship' | 'you' | 'scene', text, tone, cut?, set? }.
// Each is written with its tone ('~sad~ …', src/story/tone.js); the helpers read it off, and
// the voice (src/story/voice.js speakLine) mumbles it in the home tongue. Lines in brackets are
// silent. `set` holds flags to set once the recording has been heard (applyCall).

import { ENDING_WORLDS, peopleOf, chosenKeepsake, finaleOpen, marketHeard } from './ending.js';
import { spoken } from './tone.js';
import { relaySignal, RELAY_COME_HOME } from './relay.js';
import { ORDER } from '../levels/names.js';

export const KINDS = ['thing', 'song', 'word', 'person', 'knowing'];
export const isQuiet = (k) => !!k && k.kind !== 'thing' && k.kind !== 'nothing' && k.kind !== 'all';

const F = (text, set) => spoken('father', text, set ? { set } : null);
const M = (text, set) => spoken('mother', text, set ? { set } : null);
const S = (text, set) => spoken('scene', text, set ? { set } : null);
const SHIP = (text, set) => spoken('ship', text, set ? { set } : null);
const YOU = (text, set) => spoken('you', text, set ? { set } : null);
const pick = (arr, i) => arr[Math.min(i, arr.length - 1)];

/**
 * The recording in the prologue: the father, years after the traveller left (story-bible.md, "The recordings":
 * "We haven't heard from you for so long"). He misses him and is still disappointed in him, and gives the
 * charge again: not to come home without *something of value* (the key phrase: src/story/key-phrase.js).
 * Under it the singing light's theme comes nearer (src/story/light-theme.js), and the traveller pauses the
 * recording to listen (the cut: src/ship/prologue.js, `pause`).
 */
export const PROLOGUE_CALL = [
  SHIP('~neutral~ First new message.'),
  F('~tired~ Is it on? Right. There you are. We haven’t heard from you for so long.'),
  F('~sad~ Your mother still lays your place at the table. We miss you. Both of us.'),
  F('~angry~ And I’m still disappointed in you. The boat, the school. You leave everything half done.'),
  // (the theme is nearest under these words: src/story/light-theme.js lightCues)
  F('~solemn~ My son, make us proud. Bring back *something of value*. Until then, don’t come home.'),
  spoken('father', '~neutral~ Keep the translator at your ear. Nobody out there talks like—', { cut: true }),
];

/**
 * The first messages are only that: a new message on the voicemail, nothing said about what
 * they are. The third gives their age away ("logged nineteen years ago"); from this one on he
 * asks the reel for the world's word himself.
 */
export const REEL_FROM = 4;

/** One recording per world on the route (nine since October 2026: Vael and Lorn each carry their second worlds); recording ENDING_WORLDS asks you home. */
export const CALL_COUNT = ORDER.length;
/** The mother's own recording, about Ilen ("For when he asks"). */
export const ILEN_CALL = 'ilen';
/** The father on Ilen, the next he finds after hers (it waits on its own when no world is left to finish). */
export const ILEN_AFTER_CALL = 'ilen.after';
/** The ship's log after the first homecoming: the light over the hill, its trace, and the father at the window. */
export const TRACE_CALL = 'trace';

// (the places whose people spoke of the light: the parts of merged worlds keep their own flags, and the Hangar's stay counted for a save that went there)
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
    find: "~tired~ …and turn the tap off. Water has to get here somehow. Somebody carries it. Don’t waste their work.",
    you: '~whisper~ (Somebody carried it. The giants did.)' },
  incal: { word: 'looking up',
    find: "~solemn~ Stop looking up at the lamps and watch the steps. And mind who you argue with at the top. They decide what reaches the bottom.",
    you: '~whisper~ (I looked up anyway.)' },
  arzach: { word: 'quiet',
    find: "~playful~ Quiet at dinner again. Your mother says you’re thinking. I’d be grateful for a noise when you’ve finished.",
    you: '~whisper~ (Nobody says much there. I liked it.)' },
  arzach2: { word: 'bell',
    find: "~tired~ Ring the bell once. Once is plenty. Some of us heard the first six demonstrations.",
    you: '~whisper~ (I rang it. The cloud came down.)' },
  garage: { word: 'why',
    find: "~tired~ Why did you start it? The boat, the radio. There’s no room in the shed for another thing you’ve given up on.",
    you: '~whisper~ (So did the Major. He kept going anyway.)' },
  // (the Glass Dunes, on the route since October 2026 in the Sealed Hangar's place: the Hangar's 'why' is kept above)
  glassdunes: { word: 'time',
    find: "~tired~ Every clock in this house says a different time. I’ve stopped asking them. Your mother goes by the kettle, and the kettle is always right.",
    you: '~whisper~ (The clocks agree there now. I wound the one they all listen to.)' },
  buried: { word: 'patience',
    find: "~neutral~ Patience. One tooth at a time, your grandfather said. Never explained the teeth. I suppose that was part of the lesson.",
    you: '~surprised~ (One tooth at a time.)' },
  edena: { word: 'garden',
    find: "~tired~ The garden has swallowed my cart again. Your mother says it’s a flowerbed now. It still has wheels.",
    you: '~whisper~ (They let the garden take the ships, there.)',
    // after the tea terraces went (src/story/terraces.js): the same words land differently
    youAfter: { flag: 'edena.terraces.flooded', you: "~sad~ (They left the wreck for the garden. I opened their gate, and Esk lost her hill.)" } },
  spheres: { word: 'remember',
    find: "~angry~ Stones that remember? Where did you hear that? And why are there six in your pockets?",
    you: '~whisper~ (One of them remembered a drum.)' },
  perdide: { word: 'rain',
    find: "~playful~ Out in the rain again. Were your boots dry for any part of the trip?",
    you: '~playful~ (No.)' },
  perdide2: { word: 'lamp',
    find: "~angry~ Your mother keeps that lamp burning. Every night. I tell her it’s only a habit. She doesn’t answer.",
    you: "~whisper~ (Hollin keeps his lamps lit too. He asked me to come back.)" },
  bazaar: { word: 'listening',
    find: "~tired~ Are you listening? I can never tell. Say something when I’ve finished, at least.",
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
    close: () => [F("~tired~ Keep looking, then. You always say there’s time. I hope you’re right.")],
    log: '~neutral~ End of message.', label: '',
  },
  2: {
    open: [F('~angry~ Your exams were today. You were not at your exams.')],
    close: (f) => [
      F("~angry~ The Orrin boy brought home a reactor core. Top of his year. I thought you should know."),
      F(f.shifted ? '~sad~ And mend the fence before you go. Please.' : '~angry~ And mend the fence before you go anywhere. Do better.'),
    ],
    you: '~whisper~ (The fence came down years ago.)',
    log: '~neutral~ End of message. The date stamp is worn off this one.', label: '·· WORN ··',
  },
  3: {
    open: [
      M('~happy~ Is it recording? Oh. Hello, love. It’s us.'),
      S("~solemn~ (A child’s voice behind them asks, “Is that for me?” It is your voice.)"),
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
      F("~tired~ A week at your grandfather’s and no message. Your mother says I should begin with something nice. I’m glad you arrived safely."),
      F("~tired~ Now report. Like a pilot. Where you went. What you saw. Tell us when you come back to the recorder."),
    ],
    close: (f) => [
      S("~neutral~ (The tape is worn here. His next words disappear beneath the hiss.)"),
      F('~solemn~ …when you are older, you will understand why I…'),
      F(f.shifted ? '~happy~ Call your mother. Never mind what it costs.' : '~angry~ Keep it short. These spools cost.'),
    ],
    you: '~whisper~ I know what it says. I just want to hear it.',
    log: "~neutral~ Logged sixteen years ago. You were ten, staying with your grandfather for the summer. Tape damage detected.", label: 'LOGGED 16 YEARS AGO',
  },
  5: {
    open: [
      M('~playful~ He is here. He just does not want to start.'),
      M("~happy~ Found your drawings in the hall cupboard. The ship with its stripe, the three of us holding hands. You gave everyone enormous fingers."),
      // Lou, three and a half, a year and a half on the hill (LORE.md §2): never named on the reel
      M("~whisper~ The little one looked through them with me. She has your hands, love. Same grip on a pencil."),
    ],
    close: (f) => [
      F(f.shifted ? '~sad~ Come back to us.' : '~angry~ Think about it.'),
      M("~sad~ Your father thinks I should stop recording. Says you don’t listen."),
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
    F("~happy~ Asleep in the cockpit chair again. My cap covers his whole head. Don’t move it; he insists he’s flying."),
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
    () => "~neutral~ Another river stone. Your mother puts them on the sill. We’ll soon have an indoor riverbank.",
    () => "~happy~ There. Something solid. Something to show for the work.",
    () => '~tired~ Keep it safe, then. Whatever it is.',
    () => "~sad~ Keep it if it matters to you. I wasn’t really waiting for a present.",
  ],
  song: [
    () => "~angry~ Stop drumming at dinner. Nobody ever fuelled a ship with a song.",
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
    () => "~angry~ Promises from friends. Easy words, son. See who actually comes back.",
    () => '~angry~ Out with your friends again. You collect them.',
    () => '~tired~ Another friend.',
    () => "~sad~ Someone wants you to come back. Keep that promise if you can.",
  ],
  knowing: [
    () => "~curious~ You understand it? Good. Now show me how it works.",
    () => '~angry~ An idea. I asked for something I could see.',
    () => '~tired~ Ideas.',
    () => "~solemn~ You’ve worked out something I haven’t. Tell me when you come home.",
  ],
};

// What the mother once said to the child bringing such a thing home (from the third on).
const MOTHER_ON = {
  thing: () => '~happy~ It’s lovely. Who made it? Did they mind you taking it?',
  song: () => '~happy~ Sing it for me again tonight. Just once, slowly.',
  word: () => '~happy~ Say it again. I want to remember it the way you said it.',
  person: () => '~happy~ Someone who wants you to come back. That is not nothing.',
  knowing: () => "~solemn~ You sound pleased with yourself. What did you figure out?",
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
    final: !!flag('ending.final'),
    met: !!flag('finale.met'),
    traced: finaleOpen({ flag, completed }),
    market: marketHeard({ flag, completed }),
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
      YOU("~solemn~ (You ask the reel to search for Ilen, the name from the market.)", { 'calls.ilen.asked': true, 'calls.ilen.at': f.here ?? true }),
      SHIP("~neutral~ One recording in your mother’s voice. Label: “For when he asks.” No match in your father’s voice."),
      YOU('~whisper~ Not here. Not yet.'),
      SHIP('~neutral~ Recording held. It will wait at the console.'),
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
      F("~sad~ I said the same words to you at the port that I said to your sister. Heard them leaving my mouth. I knew what they’d done before, and I said them again."),
      // (the line written for the last recording, which plays before the market in any run: it lives here now)
      F("~sad~ I would have welcomed her back with empty hands. I never told her that."),
    ],
  },
  {
    // the tea terraces: the quest that failed (src/story/terraces.js). Not a scolding: what he said once
    // about breaking things, which is the right thing for once
    id: 'broke', when: (f) => f.broke,
    lines: (f, n) => [
      F("~tired~ If you break something, you say sorry, and you mean it. Help if they ask. If they ask you to go, go. Don’t make them look after how sorry you feel.", { 'calls.beat.broke': true }),
      ...(n >= 3 ? [M("~sad~ They may need time, love. You can’t ask them to feel better because you’re sorry.")] : []),
      YOU("~whisper~ (Esk asked me to go. I still wish I could put it back.)"),
    ],
  },
  {
    // the singing light: a warning he could not have known to give
    id: 'light', when: (f) => f.lights >= 2,
    lines: (f, n) => [
      F("~scared~ If you hear something singing out there, turn the ship around. I mean it. Don’t go closer to find out.", { 'calls.beat.light': true }),
      ...(n >= 3 ? [S('~solemn~ (Your mother has stopped smiling.)')] : []),
      YOU('~surprised~ (How could he know?)'),
    ],
  },
  {
    // Odile and Talo's ship: brought down by the same light
    id: 'struck', when: (f) => f.struck,
    lines: () => [
      F("~angry~ Ships go dark out there. It happens. That’s what I told your mother. I don’t know what else to tell her.", { 'calls.beat.struck': true }),
      YOU('~whisper~ (Like Odile and Talo’s. Like mine.)'),
    ],
  },
  {
    id: 'glyph', when: (f) => f.glyph,
    lines: () => [
      F("~tired~ You’ve drawn those three dots and an arc on the landing ring again. Scrub them off before your mother sees.", { 'calls.beat.glyph': true }),
      YOU('~whisper~ (I drew that before I knew what it was.)'),
    ],
  },
  {
    // the harbour bell behind them, like the bell under the cloud
    id: 'bell', when: (f) => f.bell,
    lines: (f, n) => [
      ...(n >= 3 ? [
        M('~curious~ Hear that? Behind us. That low note.', { 'calls.beat.bell': true }),
        F("~sad~ The harbour bell. Another ship home. I always check which one."),
      ] : [F("~sad~ Hear the harbour bell? A ship’s come in. I always go to the window.", { 'calls.beat.bell': true })]),
      YOU('~whisper~ (It sounds like the bell under the cloud.)'),
    ],
  },
  {
    id: 'bird', when: (f) => f.bird,
    lines: (f, n) => [
      F('~playful~ A bird made you a promise? You and your stories.', { 'calls.beat.bird': true }),
      ...(n >= 3 ? [M("~curious~ How big is this bird? Big enough to come when you call?")] : []),
      YOU('~whisper~ (She would. She does.)'),
    ],
  },
  {
    id: 'lamps', when: (f) => f.lamps,
    lines: (f, n) => n >= 3 ? [
      M("~happy~ The lamp’s on in the round window. Let yourself in. And wake me, however late. I mean that.", { 'calls.beat.lamps': true }),
      F('~tired~ …'),
    ] : [F("~tired~ Your mother left the window lamp on again. For you.", { 'calls.beat.lamps': true })],
  },
  {
    id: 'things', when: (f) => f.things >= 2,
    lines: () => [
      F("~happy~ Two good marks. There we are. Proof you can do it when you try.", { 'calls.beat.things': true }),
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
    lines: () => [M("~whisper~ Your father stood at the window last night. Said he could hear singing. I couldn’t hear anything.", { 'calls.beat.light.late': true })],
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
    SHIP("~neutral~ Playing “For when he asks.” Your mother’s recording."),
    M("~whisper~ Hello, love. Your father’s asleep. I need to tell you something without him interrupting.", { 'calls.ilen.told': true, 'calls.ilen.told.at': f.here ?? true }),
    M("~neutral~ If you’re asking about Ilen, perhaps you heard his message on an old relay. I should have told you myself, years ago."),
    M("~solemn~ Ilen was your sister. Your elder sister. She had grown up and left before you were born."),
    M("~sad~ He sent her off with the same words. Make us proud. Bring back *something of value*."),
    M('~sad~ She never came home. We never found out why.'),
    M("~sad~ Every night for a year he sent that message after her. Then I asked him to stop. We couldn’t keep living at the receiver."),
    ...(f.lights >= 1 ? [M("~whisper~ The last sound from her ship was singing. No words. We never learned what it meant.")] : []),
    M("~solemn~ He wanted her home. He wants you home too. That doesn’t excuse what he said. I wish he’d learned to say what he meant."),
    M("~playful~ I’ll tell him I made this. We’ve kept enough quiet."),
    YOU('~whisper~ (She knew I would ask.)'),
    SHIP('~neutral~ Logged six years ago.'),
  ];
}

/** The ship's log after the first homecoming, and the one recording the reel finds for "singing". */
function traceCall(f) {
  return [
    SHIP('~neutral~ Log from the receiver, while you were at the stone. The singing light passed over home. Same signature as our scar.'),
    SHIP(f.market ? '~neutral~ Its trace runs back out along the route, past the Signal Market, to a world on no chart. Charted on the galactic map.'
      : '~neutral~ Its trace runs back out along the route, toward the faint signal on the old relay. Too faint to follow past it yet.'),
    YOU('~solemn~ (You ask the reel for anything about singing.)'),
    SHIP('~neutral~ One match. Your father, late at night.'),
    F('~whisper~ It came over the house again tonight. Singing. Your mother says I dream it. I don’t.'),
    F(f.ilenTold ? '~sad~ The last thing we heard from your sister’s ship sounded just like that. I stood at the window till it went.'
      : '~sad~ I stood at the window till it went. I don’t know why it makes me think of the port.'),
    YOU('~whisper~ (It was looking for them. It still is.)'),
    SHIP('~neutral~ Logged three years ago.'),
  ];
}

/** Where the recordings point after the first homecoming, until the true ending: back out. */
function pointOut(f) {
  if (f.final || !f.ended) return [];
  if (f.met) return [SHIP('~neutral~ Home is on the map. Ilen is aboard, whenever you are both ready.')];
  if (f.traced) return [SHIP('~neutral~ The light’s trace is on the galactic map, past the Signal Market.')];
  return [SHIP('~neutral~ The light went out along the route. The faint signal on the old relay is still out there.')];
}

/** The father's own, on Ilen: the 'ilen.after' beat as a recording of its own (src/story/relay.js). */
function fatherOnIlen(f) {
  const b = BEATS.find((x) => x.id === 'ilen.after');
  return [...b.intro(f), ...b.body(f), YOU('~whisper~ (Empty hands. He meant me too.)'), SHIP('~neutral~ Logged five years ago.')];
}

/** The label on the console's screen while recording n plays (src/ship/portrait.js). */
export function recordingLabel(n, ctx = {}) {
  if (n === 'prologue') return '';
  if (n === ILEN_CALL) return 'FOR WHEN HE ASKS';
  if (n === ILEN_AFTER_CALL) return 'LOGGED 5 YEARS AGO';
  if (n === TRACE_CALL) return 'LOGGED 3 YEARS AGO';
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
  if (n === 'prologue' || n === ILEN_AFTER_CALL || n === TRACE_CALL) return 'father';
  return typeof n === 'number' && n < 3 ? 'father' : 'both';
}

/**
 * The lines of recording n (1..CALL_COUNT, ILEN_CALL, ILEN_AFTER_CALL or TRACE_CALL).
 * @param ctx { keepsake (latest or null), keepsakes (all), worldTitle (just finished), flag(k),
 *              completed (world ids), lastWorld, here (the world the ship stands in), chosen (what was left at the stone) }
 */
export function callLines(n, ctx = {}) {
  const f = facts(ctx);
  if (n === ILEN_CALL) return motherAlone(f);
  if (n === ILEN_AFTER_CALL) return fatherOnIlen(f);
  if (n === TRACE_CALL) return traceCall(f);
  const { k, quiet, flag } = f;
  f.shifted = f.ilenTold;   // once the truth is told, the recordings he finds are the sorrier ones
  f.tier = f.shifted ? 3 : Math.min(2, Math.floor(quiet / 2) + (n >= 4 ? 1 : 0));
  const bs = beats(f, n, n >= 3 ? 1 : 2);
  const lead = bs.lead[0] ?? null;
  const leadIntro = lead?.intro?.(f, n) ?? [];
  const leadBody = lead?.body?.(f, n) ?? null;
  const rest = bs.rest.flatMap((b) => b.lines(f, n));
  const reel = REEL[f.lastWorld] ?? REEL_ANY;
  // the first ones are just a new message on the voicemail; once the date has given them away
  // (REEL_FROM), he asks the reel for the world's word himself
  const search = leadBody ? [] : n >= REEL_FROM ? [
    YOU(`~neutral~ (You ask the reel for anything about ${reel.word}.)`),
    SHIP('~neutral~ One match.'),
  ] : [SHIP('~neutral~ New message.')];
  const find = leadBody ?? [F(reel.find)];
  const you = reel.youAfter && flag(reel.youAfter.flag) ? reel.youAfter.you : reel.you;
  const react = !leadBody && you ? [YOU(you)] : [];
  // the keepsake: he holds it up to the projector; the recording happens to hold what the father once said about such things
  const shown = k ? [YOU(`~neutral~ (You lift ${nameIn(k)} into the projector’s light. The message goes on.)`), F(pick(FATHER_ON[k.kind] ?? FATHER_ON.thing, f.tier)(k))] : [];
  // the mother asks who he met; he answers with the names
  const met = f.lastWorld ? metIn(f.lastWorld, flag) : [];
  const ask = M('~curious~ Who did you meet today? Tell me one person. Just one.');
  const answer = met.length === 2 ? [YOU(`~whisper~ ${met[0]} and ${met[1]}.`)] : met.length === 1 ? [YOU(`~whisper~ ${met[0]}.`)] : [];
  const motherOn = k && MOTHER_ON[k.kind] && !answer.length ? [M(MOTHER_ON[k.kind](k))] : [];   // (she asks about the thing when there is nobody to name)

  // after the ending, and after the last recording: the reel's oldest side
  if (f.ended || (n >= ENDING_WORLDS && f.asked)) {
    const old = OLDER[(n - ENDING_WORLDS - 1 + OLDER.length * 4) % OLDER.length];
    const c = f.ended ? (f.chosen ?? chosenKeepsake({ flag, keepsakes: () => f.all })) : null;
    // the world's own word still finds its line (the later worlds' lines play here: their
    // recordings all come after the last one on the reel), then the oldest side
    const found = !leadBody && REEL[f.lastWorld] ? [...search, ...find, ...react] : [];
    return [
      ...leadIntro,
      ...(leadBody ?? []),
      ...found,
      SHIP(found.length ? (f.ended ? '~neutral~ Then the oldest side of the reel. Playing.' : '~neutral~ Nothing newer on this side. Turning to the oldest side of the reel.')
        : f.ended ? '~neutral~ The oldest side of the reel. Playing.' : "~neutral~ No recordings remain on this side. Turning to the oldest side of the reel."),
      ...old.lines,
      ...(k ? [YOU(`~neutral~ (You hold ${nameIn(k)} up to the projector anyway.)`)] : []),
      ...rest.slice(0, 1),
      ask, ...answer,
      ...(f.ended
        ? [YOU(c && c.id !== 'all' && c.id !== 'nothing' ? `~whisper~ (${name(c)} is on the stone on the hill.)`
          : f.final ? "~whisper~ (Your keepsakes rest on the stone at home, beneath the two moons.)" : '~whisper~ (Your keepsakes rest on the stone at home. The reel is still with you.)'), ...pointOut(f)]
        : [SHIP('~neutral~ Home is on the map, whenever you are ready.')]),
    ];
  }
  // the last recording on the reel: it asks you home (only the Ilen beats here)
  if (n >= ENDING_WORLDS) return [
    ...leadIntro,
    ...(leadBody ?? []),
    // the world's own word first, as every time (so the sixth world's line plays too), then the last of all
    ...(!leadBody && REEL[f.lastWorld] ? [...search, ...find, ...react] : []),
    YOU(`~neutral~ (${!leadBody && REEL[f.lastWorld] ? 'Then you' : 'You'} ask the reel for the last thing they recorded.)`),
    SHIP('~neutral~ The last recording on the reel. Playing.'),
    M('~solemn~ We are both here. He wants to say something.', { 'calls.home': true }),
    F('~solemn~ Son.'),
    F("~solemn~ I keep thinking about what I asked you to bring back. *Something of value*. I made it sound like you had to earn your way through the door."),
    ...(k ? [YOU(`~whisper~ (You hold ${nameIn(k)} up to them.)`)] : []),
    ...(f.ilenTold ? [F("~sad~ I told your sister the same thing. I would have welcomed her back with empty hands.")] : []),
    // Lou, five, across the yard: the drawings he keeps in his chair (src/story/home-data.js), not said
    F("~sad~ The little one puts you in all her drawings. At the edge, waving. She leaves a place for you."),
    F('~solemn~ Come home.'),
    M('~happy~ Bring whatever you have. Or nothing at all. Just come.'),
    S("~solemn~ (The picture holds on their faces, then folds into the projector.)"),
    SHIP("~neutral~ That was the last recording on the reel. Logged two years ago, eleven days before the house went quiet."),
    YOU('~whisper~ I’m coming home.'),
    SHIP('~neutral~ Course for home available on the galactic map.'),
    // the broadcast, still out there (src/story/relay.js): the way to Ilen before the stone
    ...(relaySignal({ flag, completed: f.completed.length || n })?.stage === 'far' ? [SHIP(RELAY_COME_HOME)] : []),
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
  // (it waits once he has stepped out of the ship, `calls.ilen.later`, or once the ship has flown)
  return at === true || at === undefined || !!flag('calls.ilen.later') || flag('ship.level') !== at;
}

/**
 * The father on Ilen waits on its own once the mother's has played and he has stepped out
 * (`calls.ilen.after.later`) or the ship has flown, if no world's recording has brought it first
 * (the market is the last world on the route, so in a run in order none is left to).
 */
export function ilenAfterPending(flag) {
  if (!flag('calls.ilen.told') || flag('calls.beat.ilen.after') || flag(`calls.${ILEN_AFTER_CALL}`)) return false;
  const at = flag('calls.ilen.told.at');
  return at === true || at === undefined || !!flag('calls.ilen.after.later') || flag('ship.level') !== at;
}

/** The ship's log of the light over the hill waits once the first homecoming is over (until heard; not after the true ending). */
export const tracePending = (flag) => !!flag('ending.done') && !flag(`calls.${TRACE_CALL}`) && !flag('ending.final');

/**
 * The recording waiting at the console, or null: the mother's own first (see
 * ilenPending), then the ship's log of the light over home (tracePending), then the first unheard
 * recording n with n <= the number of completed worlds (one per completion, in order), then the
 * father's own on Ilen (ilenAfterPending).
 */
export function pendingCall({ flag, completed }) {
  if (ilenPending(flag)) return ILEN_CALL;
  if (tracePending(flag)) return TRACE_CALL;
  for (let n = 1; n <= Math.min(CALL_COUNT, completed); n++) if (!flag(`calls.${n}`)) return n;
  if (ilenAfterPending(flag)) return ILEN_AFTER_CALL;
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

