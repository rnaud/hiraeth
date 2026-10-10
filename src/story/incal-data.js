// The City-Shaft's story as data: "The Light Nobody Looks At" (docs/story-bible.md).
//
// The Lodestar turns above the palace. The rim and the upper terraces call it a
// tourist story; the bottom levels pray to it, with their eyes shut, because
// the smog stings. Nima, who sweeps the high terrace, has looked up at it once
// a day for forty years: it has faded a little every year of her life, as the
// city stopped looking up, and since "the night the sky rang" it has been going
// out: something passed over the shaft, low and singing, the Lodestar rang
// back, and a splinter of it fell down the middle of the city to the bottom.
// The bottom caught it, as it catches everything, and built the Upward Shrine
// round it. Ossa, who keeps the shrine, knows why the light is going out: a
// light nobody looks at goes out. Carry the splinter (and the bottom's message)
// up the whole shaft to the palace, past the guard who is secretly from the
// bottom himself, and look up. The light burns again; for a moment every level
// looks up at once. Nima gives you the only thing she has: "look up once a day".
//
// Side errands: Pip's ration tin for his uncle Dov, the palace guard; the dead
// taxi call-lamp at the bottom (shoot it) and Wren, the old cab that still stops;
// a cab pass from Lio, the dispatcher on the rim (the cabs fly past anyone
// without one: src/taxi.js), for the fare Tobin, the seller of views, owes him.
// Clue: the splinter carries the glyph and hums the same note as the singing
// crystals of the swamp of lights (Lorn).
//
// Flags (game-state.js): incal.rumour.light, incal.splinter.given, incal.dov.allowed,
// incal.lit (the Lodestar burns bright again), incal.lamp.lit, incal.wren.met,
// incal.dov.fed, incal.hoist.pin, incal.hoist.in (the goods hoist, swung in); clue.incal.perdide. Items: splinter, ration,
// fare (Tobin's coin), cabpass (the cab pass: src/items.js lists it in the gear).

const Q = 'incal.light';

export const ITEMS = { splinter: 'the Lodestar splinter', ration: 'Pip’s ration tin', fare: 'Tobin’s bent coin', cabpass: 'a cab pass' };

/** What a cab says in the City-Shaft when you have no pass yet (src/taxi.js Taxi.refusal). */
export const PASS_REFUSAL = {
  hail: 'The cab slides past without slowing. A card in its window: PASS HOLDERS ONLY. Lio, the dispatcher on the rim, writes the passes.',
  board: 'The little screen on the dash blinks: PASS HOLDERS ONLY. Lio, the dispatcher on the rim, writes the passes.',
};

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Light Nobody Looks At', world: 'incal', main: true,
    outro: 'The Lodestar burns bright. For a moment, every level looked up.',
    stages: [
      { id: 'nima', text: 'The light above the palace is dimming. Find the sweeper on the high terrace, who still watches it', label: 'Nima, the sweeper', talk: 'nima' },
      // (the way down on the jets, marked terrace by terrace: src/shaft-ways.js; talking to Ossa first skips it)
      { id: 'down', text: 'Go down the shaft by the lamplighters’ drops: a red lamp on the edge of every terrace, landing to landing. Halfway, Perrine keeps a tea stall where they land', label: 'The lamplighters’ drops', goto: 'halfway', radius: 14, vertical: 6 },
      { id: 'ossa', text: 'Go down to the bottom terrace and ask at the Upward Shrine what fell the night the sky rang', label: 'Ossa, at the bottom of the shaft', talk: 'ossa' },
      { id: 'palace', text: 'Carry the splinter up the whole shaft to the palace, under the Lodestar', label: 'The palace gate', talk: 'dov' },
      { id: 'look', text: 'Stand on the palace and look up at the Lodestar', label: 'Look up', flag: 'incal.lit', at: 'crown' },
      { id: 'tell', text: 'The Lodestar burns again. Go down and tell Nima', label: 'Nima, on the high terrace', talk: 'nima' },
    ],
  },
  {
    id: 'incal.ration', title: 'A Ration for the Guard', world: 'incal',
    outro: 'Dov ate it at his post, standing up, with his eyes shut.',
    stages: [
      // (src/story/incal.js: the tin hangs in the old goods hoist's basket, out over the void; shoot the pin, push the weight round)
      { id: 'hoist', text: 'Pip’s tin hangs in the old goods hoist’s basket, out over the void. Knock out the rusted pin with a shot (aim with {key:aim}, fire with {key:fire}), push the hoist round (switch the gun to push with {key:mode}, then aim and shoot) and take the tin', label: 'The goods hoist', bring: 'ration', at: 'hoist', to: 'dov' },
      { id: 'carry', text: 'Carry Pip’s ration tin up to his uncle Dov, the palace guard', label: 'Dov, at the palace gate', bring: 'ration', to: 'dov' },
    ],
  },
  {
    // the middle levels, where everybody passes (src/story/halfway.js): Perrine's tea stall by the cab stop
    id: 'incal.mirror', title: 'The Halfway Mirror', world: 'incal',
    outro: 'The halfway mirror faces up the shaft again. When the Lodestar shines, a coin of its light goes down to the bottom terraces.',
    stages: [
      { id: 'wash', text: 'Wash the smog off the halfway mirror beside Perrine’s tea stall (shoot)', label: 'The halfway mirror', flag: 'incal.mirror.washed', at: 'mirror' },
      { id: 'turn', text: 'Turn the mirror round on its pole until it faces up the shaft, toward the Lodestar (push it from the side: switch the gun to push with {key:mode}, then aim and shoot)', label: 'The halfway mirror', flag: 'incal.mirror.turned', at: 'mirror' },
      { id: 'tell', text: 'Tell Perrine the mirror faces up again', label: 'Perrine, at the halfway stall', talk: 'perrine', at: 'perrine' },
    ],
  },
  {
    // the cabs fly past anyone without a pass (src/taxi.js): Lio writes one, for a fare paid in advance
    id: 'incal.pass', title: 'A Pass for the Cabs', world: 'incal',
    outro: 'A card with the palace seal and something like your name. The cabs stop for you now.',
    stages: [
      { id: 'lio', text: 'The cabs fly past you. Ask Lio, the cab dispatcher on the rim, how to get one to stop', label: 'Lio, the dispatcher', talk: 'lio' },
      // (walk up to Tobin and he pays as you come, grumbling: no conversation to sit through between Lio's two. The level
      // design audit v1.15 read three talks in a row here: Nima told, Lio, Tobin. src/story/incal.js; talking to him works too)
      { id: 'fare', text: 'Lio writes a pass for one fare, paid in advance. Tobin, who sells views along the rim, owes him one: go and collect it', label: 'Tobin, seller of views', goto: 'tobin', radius: 4.5, vertical: 4 },
      { id: 'back', text: 'Bring Tobin’s coin back to Lio for your cab pass, round the outer rim past Tobin’s telescopes', label: 'Lio, the dispatcher', bring: 'fare', to: 'lio', via: 'Tobin’s telescopes' },   // (via: the way his words send you, for the level design audit)
    ],
  },
  {
    // (Wren is the cab itself: cabs drive themselves; it speaks from the little screen on its dash, src/story/cab.js)
    id: 'incal.wren', title: 'The Cab That Stops', world: 'incal',
    outro: 'One cab still stops at the bottom. Now you know its name.',
    stages: [
      { id: 'lamp', text: 'Light the dead taxi call-lamp at the edge of the bottom terrace (shoot it with the fluid)', label: 'The call-lamp', flag: 'incal.lamp.lit', at: 'lamp' },
      { id: 'wren', text: 'A cab is coming down to the lamp. Get in, and hear what it has to say', label: 'Wren, the old cab', talk: 'wren' },
    ],
  },
];

const LOOKED = { flag: 'incal.lit' };
const EARLY = { quest: Q, stage: ['nima', 'down', 'ossa'] };   // before the splinter is in your hands

// ------------------------------------------------------------------ the people
// palettes: cloak / lining / cloth / legs / hat / hair (buildCharacter + Humanoid)
export const PEOPLE = {
  nima: {
    id: 'nima', name: 'Nima', title: 'who sweeps the high terrace', color: '#a99be0', voice: 0.95, kind: 'f',
    palette: { cloak: '#a99be0', lining: '#2b211f', cloth: '#e2d3b4', legs: '#4a3a2a', hat: '#f3ead8', hair: '#b0a89a' }, head: 'wrap', cape: 0.9, look: { prop: 'basket' },
    lines: ['~playful~ The rich live up here. Me, I just sweep.', '~neutral~ Mind the dust.', '~happy~ Look up once in a while. It’s free.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'tell' }, node: 'told' },
        { if: { quest: Q, stage: ['palace', 'look'] }, node: 'carry' },
        { if: { quest: Q, stage: ['down', 'ossa'] }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~angry~ Mind the dust. I just did that bit.',
            "~surprised~ Looking up, are you? Careful. People will think you’re visiting. Residents look down to check who’s poorer.",
            "~neutral~ Nima. Forty years sweeping these steps. Before I start, I look at the Lodestar. One small thing the palace hasn’t charged me for."],
          choices: [
            { text: '~curious~ What is it, the light?', goto: 'what' },
            { text: '~neutral~ It looks dim.', goto: 'dim' },
          ],
        },
        what: {
          say: ["~neutral~ That light is the *Lodestar*. The palace calls it a light show. The people at the bottom pray to it. Same light. Very different seats.",
            "~sad~ It was brighter when I was a girl. A little dimmer every year, as people stopped looking up. And since the night the sky rang, it’s been going out."],
          choices: [{ text: '~curious~ The night the sky rang?', goto: 'rang' }, { text: '~neutral~ It does look dim.', goto: 'dim' }],
        },
        dim: {
          say: ["~sad~ It used to cast shadows at noon. Now it flickers. Something changed the night the sky rang."],
          choices: [{ text: '~curious~ The night the sky rang?', goto: 'rang' }, { text: '~curious~ Who do you sweep for?', goto: 'sweep' }],
        },
        rang: {
          say: ["~solemn~ A light flew low across the shaft, singing one note so high the lamps rang with it. Every window hummed.",
            "~surprised~ The Lodestar answered. Then a splinter broke off and fell all the way to the bottom. I heard it singing long after I lost sight of it."],
          do: { set: { 'incal.rumour.light': true } },
          choices: [{ text: '~neutral~ Something drained my ship that night.', goto: 'ship' }, { text: '~curious~ Where did the piece land?', if: EARLY, goto: 'where' },
            { text: '~neutral~ I have it. Ossa gave it to me.', if: { all: [{ has: 'splinter' }, { not: EARLY }] }, goto: 'carry' }],
        },
        ship: {
          say: ["~playful~ Your ship too? Whatever passed us has left quite a repair bill.",
            "~angry~ The palace called it fireworks. Apparently fireworks don’t require anyone to check on the people below."],
          choices: [{ text: '~curious~ Where did the piece land?', if: EARLY, goto: 'where' }, { text: '~neutral~ I’ll take it up to the light.', if: { not: EARLY }, end: true }],
        },
        where: {
          say: ["~playful~ The splinter reached the bottom. Everything does eventually. Rain, soup, hats. The lower city has an excellent collection of hats.",
            "~neutral~ Go *below the smog to the bottom terrace*. Find *Ossa at the Upward Shrine*. She’ll know what landed.",
            "~whisper~ Tell her Nima still sweeps. She’ll understand."],
          do: { advance: [Q, 'nima'] },
          choices: [{ text: '~curious~ How do I get down?', goto: 'down' }, { text: '~neutral~ I’ll go down.', end: true }],
        },
        down: {
          say: ["~neutral~ *Follow the lamplighters’ drops.* A red lamp on the edge of every terrace, from my corner here down to the shrine. They dropped landing to landing before there were cabs.", "~angry~ *Glide down or take a cab*, if you like. Coming back is harder. Most cabs refuse to stop below the smog."],
          choices: [{ text: '~neutral~ I’ll manage.', end: true }],
        },
        sweep: {
          say: ["~neutral~ I work for the steps. They let anyone walk on them. I approve of that.",
            "~playful~ My cousin Pell counts desert bones. We specialise in jobs with no danger of completion."],
          choices: [{ text: '~curious~ What is the light?', goto: 'what' }, { text: '~happy~ Goodbye, Nima.', end: true }],
        },
        again: {
          say: ["~playful~ Find *Ossa at the Upward Shrine*, on *the bottom terrace across the shaft*. Below all that smog."],
          choices: [
            { text: '~neutral~ There’s a mark on the Lodestar’s lower facets.', goto: 'glyph', once: true },
            { text: '~neutral~ On my way.', end: true },
          ],
        },
        glyph: {
          say: ["~happy~ You spotted the mark! {glyph} It’s on the light’s underside, facing the people below.",
            "~neutral~ Up here it’s the palace seal. Down there, the Three Who Look Up. I’ve never seen a seal improve anyone’s view."],
          choices: [{ text: '~happy~ Goodbye, Nima.', end: true }],
        },
        carry: {
          say: [{ if: { has: 'splinter' }, text: "~surprised~ That’s the splinter? Look, it leans toward the light. *Take it to Dov, the palace guard.* There’s a person under all that uniform." },
            { if: { not: { has: 'splinter' } }, text: "~neutral~ Go *to Dov at the palace landing*. Tell him what you’re carrying." }],
          choices: [{ text: '~curious~ What happened, the night the sky rang?', if: { not: { flag: 'incal.rumour.light' } }, goto: 'rang' }, { text: '~neutral~ I will.', end: true }],
        },
        told: {
          say: ["~happy~ My steps turned gold! Everyone looked up. Guards, cab passengers, rich men. One dropped his lunch. A generous day for the bottom.",
            '~curious~ What did you do, up there?'],
          choices: [
            { text: '~neutral~ I gave it back its splinter. And I looked up at it.', goto: 'keep' },
            { text: '~neutral~ Nothing much. I just looked.', goto: 'keep' },
          ],
        },
        keep: {
          say: ["~solemn~ So the light needed someone to look at it. I’ve been doing that forty years. Nice to know I wasn’t entirely wasting my mornings.",
            "~solemn~ Here’s something to take with you: *look up once a day*. Wherever you are, whatever is up there. Give the sky a chance to surprise you."],
          do: [{ advance: [Q, 'tell'] },
            { keepsake: { id: 'incal.word', level: 'incal', name: 'Look up once a day', kind: 'word', text: '“Look up once a day. Wherever you are, whatever is up there.” Nima, who sweeps the high terrace.' } }],
          choices: [{ text: '~solemn~ I will, Nima.', end: true }],
        },
        after: { say: ["~playful~ Looked up today? Don’t just nod. You’ve got a neck. Use it."], choices: [{ text: '~neutral~ (look up)', end: true }] },
      },
    },
  },

  ossa: {
    id: 'ossa', name: 'Ossa', title: 'keeper of the Upward Shrine', color: '#cdb38e', voice: 0.8, kind: 'f', scale: 0.96,
    palette: { cloak: '#8a6a4a', lining: '#2b211f', cloth: '#cdb38e', legs: '#3a3a3a', hat: '#d9c3a0', hair: '#e8dcc0' }, head: 'hood', cape: 1.4, look: { prop: 'lantern' },
    lines: ['~solemn~ Eyes shut, face up.', '~solemn~ The smog stings. The light doesn’t.', '~whisper~ Hum with it. It hums back.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: LOOKED, node: 'after' },
        { if: { quest: Q, stage: ['palace', 'look'] }, node: 'later' },
        { if: { quest: Q, stage: ['nima', 'down', 'ossa'] }, node: 'hello' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: [{ if: { quest: Q, stage: ['down', 'ossa'] }, text: "~happy~ Nima still sweeps? Good. Someone up there remembers us." },
            { if: { not: { quest: Q, stage: ['down', 'ossa'] } }, text: "~angry~ Here to admire the poor? Careful where you stand. Some of the scenery has washing to do." },
            "~neutral~ I’m Ossa. We built *the Upward Shrine* around the splinter that fell into Behla’s laundry. She hasn’t let us forget whose laundry."],
          choices: [
            { text: '~curious~ What came down?', goto: 'splinter' },
            { text: '~curious~ Why “Upward”?', goto: 'upward' },
          ],
        },
        upward: {
          say: ["~neutral~ Everything reaches us from above. Rain. Rubbish. Lost hats. We thought we’d try asking for something better.",
            "~angry~ We pray with our eyes shut; the smog stings. At the top they can see perfectly, and choose to look at adverts."],
          choices: [{ text: '~curious~ What came down?', goto: 'splinter' }, { text: '~curious~ What’s the mark on your floor?', goto: 'glyph' }],
        },
        glyph: {
          say: ["~solemn~ {glyph} *The Three Who Look Up.* Three people standing on the curve of the world, looking up for light.",
            "~angry~ The palace stamps it on licences. We can see it under the Lodestar. Draw your own conclusion about who copied whom.", "~solemn~ It’s also on the blue star-box atop the lone stone pillar, up on the rim. They call it lost property. We think it’s waiting for someone."],
          choices: [{ text: '~curious~ What came down?', goto: 'splinter' }],
        },
        splinter: {
          say: ["~whisper~ Look in the bowl: *a splinter of the Lodestar*. Put your ear close. It still sings.",
            "~neutral~ A trader from *the swamp of lights* brought a crystal here once. It sang the same note. I wrote it down so nobody could tell me I’d imagined it."],
          do: { set: { 'clue.incal.perdide': true } },
          choices: [{ text: '~neutral~ The Lodestar is dimming. Nima thinks it’s because of this.', goto: 'why' }],
        },
        why: {
          say: ["~solemn~ A light nobody looks at goes out. We know that down here. We just can’t see through the smog to help it.",
            "~sad~ The splinter hums toward the palace every night. I think it wants to go back."],
          choices: [{ text: '~neutral~ Then let me carry it back up.', goto: 'give' }],
        },
        give: {
          say: ["~playful~ Take it *to the palace at the top*. The guards will object to your boots. Try showing them the miracle first.",
            "~solemn~ And tell them: *we are still down here, and we are still looking*. The light ought to hear it. So should the guards.",
            "~neutral~ To get back up, light the old taxi call-lamp at the terrace edge. One old cab used to answer it."],
          do: [{ give: 'splinter' }, { set: { 'incal.splinter.given': true } }, { start: 'incal.wren' }, { stage: [Q, 'palace'] }, { track: Q }],
          choices: [{ text: '~solemn~ I’ll carry it up.', end: true }],
        },
        later: {
          say: ["~happy~ Hear it? Louder already. *Take it up to the palace.* We’ll watch from here."],
          choices: [{ text: '~neutral~ I’m going.', end: true }],
        },
        after: {
          say: ["~happy~ The light reached us! I could open my eyes and look straight at it.",
            "~solemn~ The smog hasn’t gone. But now the people above know we’re here.",
            { if: { flag: 'incal.mirror.done' }, text: "~surprised~ And a coin of light has come back on Behla’s wall, from halfway up. Somebody in the middle remembered us." }],
          choices: [{ text: '~happy~ Keep looking, Ossa.', end: true }],
        },
      },
    },
  },

  pip: {
    // (a child of nine at the bottom of the shaft, in a knit cap: docs/makehuman.md stage 3)
    id: 'pip', name: 'Pip', title: 'who has seen the sky once', color: '#e6875f', voice: 1.65, kind: 'm', scale: 0.7, age: 'child', years: 9,
    palette: { cloak: '#e6875f', lining: '#2b211f', cloth: '#5a4a3a', legs: '#3a3a3a', hat: '#d8a24a', hair: '#4a3226' }, head: 'hair', cape: 0.5, look: { head: 'beanie', under: 'crop' },
    lines: ['~curious~ Are you from the top?', '~happy~ I saw the sky once. Eleven seconds.', '~happy~ My uncle is a palace guard!'],
    talk: {
      entry: [
        { if: { quest: 'incal.ration', done: true }, node: 'after' },
        { if: LOOKED, node: 'lit' },
        { if: { has: 'ration' }, node: 'waiting' },
        { if: { quest: 'incal.ration', stage: 'hoist' }, node: 'hoist' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~curious~ Have you been to the top? Do they really put trees on roofs? How do they water them without flooding the beds?",
            "~sad~ Uncle Dov guards the palace. He hasn’t visited in years. Mum says he’s ashamed of us. I think guarding must take ages."],
          choices: [
            { text: '~neutral~ I’m going up to the palace.', if: { has: 'splinter' }, goto: 'take' },
            { text: '~curious~ Why doesn’t he come down?', goto: 'why' },
          ],
        },
        why: {
          say: ["~sad~ Mum says people who move up pretend they were never down here. I’d forget to pretend."],
          choices: [{ text: '~happy~ I could take him something from you.', goto: 'take' }, { text: '~curious~ What’s it like, down here?', goto: 'here' }],
        },
        take: {
          say: ["~happy~ Take him *a ration tin*! Mum made smog-cabbage and the good bread. He used to eat three. Tell him I can eat two now.",
            { if: { not: { flag: 'incal.hoist.in' } }, text: "~neutral~ The tin’s in *the hoist basket over the edge*, safe from rats. *Shoot out the rusty pin*, then *push the weight round the post* to swing it in." },
            { if: { flag: 'incal.hoist.in' }, text: "~surprised~ You swung in *the hoist basket*? Brilliant! Mum keeps the tins out there to stop the rats. She also stopped everyone else." },
            '~playful~ Tell him it’s from Pip. Tell him I’m taller.'],
          do: [{ start: 'incal.ration' }],
          choices: [{ text: '~happy~ I’ll tell him.', end: true }],
        },
        hoist: {
          say: ["~curious~ Free *the rusty pin first*. Then *push the weight sideways round the post*. Pushing it toward the edge won’t turn the arm."],
          choices: [{ text: '~neutral~ I’ll try.', end: true }],
        },
        here: {
          say: ["~neutral~ It’s wet and green down here. Grandma never saw the sky. I saw it for eleven seconds once. I counted very slowly."],
          choices: [{ text: '~curious~ What did it look like?', goto: 'sky' }],
        },
        sky: { say: ["~solemn~ It was blue, with a light in it. Ossa says that was the Lodestar. I wish I’d had twelve seconds."], choices: [{ text: '~neutral~ I could take something up to your uncle.', if: { quest: 'incal.ration', started: false }, goto: 'take' }, { text: '~happy~ Bye, Pip.', end: true }] },
        waiting: { say: ["~curious~ Did Uncle Dov get his tin? He’s *at the palace, right at the top*."], choices: [{ text: '~neutral~ Not yet.', end: true }] },
        lit: {
          say: ["~shout~ I SAW IT! The light came through the smog! Longer than eleven seconds this time!", '~happy~ Twelve seconds this time. No: more. I stopped counting.'],
          choices: [{ text: '~neutral~ I could take something up to your uncle.', if: { quest: 'incal.ration', started: false }, goto: 'take' }, { text: '~happy~ I saw it too.', end: true }],
        },
        after: { say: ["~happy~ Uncle Dov sent a message! TELL PIP HE IS TALLER. How does he know? Tell him he’s right!"], choices: [{ text: '~happy~ You are.', end: true }] },
      },
    },
  },

  perrine: {
    // the middle levels' tea stall, by the cab stop (src/story/halfway.js)
    id: 'perrine', name: 'Perrine', title: 'who keeps the halfway tea stall', color: '#c8483a', voice: 1.0, kind: 'f', scale: 0.98,
    palette: { cloak: '#c8483a', lining: '#2b211f', cloth: '#f3ead8', legs: '#4a3a2a', hat: '#e2b9a6', hair: '#5a3a2a' }, head: 'wrap', cape: 0.7, look: { prop: 'basket', under: 'bun' },
    lines: ['~happy~ Halfway tea! Hot at the top, warm at the bottom.', '~tired~ Up or down? Everyone’s one or the other.', '~neutral~ Mind the cups. They’re my only ones.'],
    talk: {
      entry: [
        { if: { all: [{ quest: Q, stage: 'palace' }, { has: 'splinter' }] }, node: 'carrying' },
        { if: { quest: 'incal.mirror', stage: 'tell' }, node: 'turned' },
        { if: { quest: 'incal.mirror', done: true }, node: 'after' },
        { if: { quest: 'incal.mirror', active: true }, node: 'busy' },
        { if: { all: [{ flag: 'incal.mirror.washed' }, { flag: 'incal.mirror.turned' }] }, node: 'already' },
        { if: { flag: 'met.perrine' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~happy~ Tea? Halfway tea. Hot at the top of the cup and warm at the bottom, like the city.",
            "~neutral~ I’m Perrine. Everybody passes the middle levels on the way to somewhere else. I stop them one cup at a time."],
          do: { set: { 'met.perrine': true } },
          choices: [
            { text: '~curious~ What’s the mirror on the pole?', goto: 'mirror' },
            { text: '~curious~ Who stops here?', goto: 'who' },
          ],
        },
        who: {
          say: ["~neutral~ Porters going down with crates and coming up with nothing. Clerks from the rim who missed their cab. A guard on his day off, once, who wouldn’t say which gate.",
            "~tired~ Nobody stays. That’s what the middle is for. I don’t mind. The tea goes on being hot."],
          choices: [{ text: '~curious~ And the mirror?', goto: 'mirror' }, { text: '~neutral~ Some other time.', end: true }],
        },
        again: {
          say: ["~happy~ Back again? Up or down today?"],
          choices: [{ text: '~curious~ Tell me about the mirror.', goto: 'mirror' }, { text: '~neutral~ Just passing.', end: true }],
        },
        mirror: {
          say: ["~solemn~ My mother put it up. It caught the Lodestar and threw a coin of its light down to the bottom terraces, so they could see it there without breaking their necks.",
            "~sad~ Then the smog greased it over, and someone at the top had it turned to shine on a billboard. The bottom has had the billboard’s light ever since.",
            "~curious~ Would you *wash it* for me with that gun of yours, then *push it round from the side* until it faces up the shaft? My arms are for pouring."],
          choices: [
            { text: '~neutral~ I’ll see to it.', do: { start: 'incal.mirror' }, goto: 'thanks' },
            { text: '~neutral~ Maybe later.', end: true },
          ],
        },
        thanks: { say: ["~happy~ It clicks when it’s right. My mother said it sounded like someone remembering something."], choices: [{ text: '~neutral~ Wash, then turn.', end: true }] },
        busy: {
          say: [{ if: { not: { flag: 'incal.mirror.washed' } }, text: "~neutral~ *Wash it first*, a good splash. You can’t send light down through twenty years of smog." },
            { if: { flag: 'incal.mirror.washed' }, text: "~neutral~ Clean as a cup. Now *push it round from the side*, one notch at a time, until it faces up the shaft." }],
          choices: [{ text: '~neutral~ On it.', end: true }],
        },
        already: {
          say: ["~surprised~ Somebody’s washed my mother’s mirror and turned it up again. Was that you? Without even stopping for tea?",
            "~happy~ Then this one’s on the stall."],
          do: [{ set: { 'met.perrine': true } }, { start: 'incal.mirror' }, { stage: ['incal.mirror', 'tell'] }],
          next: 'turned',
        },
        turned: {
          say: [{ if: { flag: 'incal.lit' }, text: "~surprised~ Look at that. A coin of the Lodestar, going down past every level. Somebody at the bottom has it on their wall right now." },
            { if: { not: { flag: 'incal.lit' } }, text: "~happy~ It faces up again. Now it only needs something up there worth catching. The light’s gone dim, they say." },
            "~solemn~ My mother would have stood here all night watching it. I’ll stand here for both of us. I’m here anyway."],
          do: [{ advance: 'incal.mirror' }, { set: { 'incal.mirror.done': true } }],
          choices: [{ text: '~happy~ I’ll take that tea now.', goto: 'tea' }, { text: '~neutral~ Goodbye, Perrine.', end: true }],
        },
        tea: { say: ["~happy~ (Perrine pours. It is hot at the top and warm at the bottom, as promised.)", "~playful~ No charge. Halfway prices: half of nothing."], choices: [{ text: '~happy~ Thank you.', end: true }] },
        carrying: {
          say: ["~surprised~ That’s humming. Is that a piece of the light? Then don’t stop for tea. *Go up.* The tea will still be here when you come down."],
          choices: [{ text: '~neutral~ I’m going up.', end: true }],
        },
        after: {
          say: [{ if: { flag: 'incal.lit' }, text: "~happy~ The bottom sent a thank-you up on the goods hoist. A smog-cabbage. I’m choosing to take it kindly." },
            { if: { not: { flag: 'incal.lit' } }, text: "~neutral~ The mirror’s waiting. All it needs is the Lodestar to wake up and give it something to catch." },
            "~happy~ Up or down today?"],
          choices: [{ text: '~neutral~ A bit of both.', end: true }],
        },
      },
    },
  },

  dov: {
    id: 'dov', name: 'Dov', title: 'guard at the palace gate', color: '#f2c54b', voice: 0.85, kind: 'm', scale: 1.06,
    palette: { cloak: '#34405e', lining: '#f2c54b', cloth: '#f3ead8', legs: '#2b2f45', hat: '#f2c54b', hair: '#2b211f' }, head: 'hat', cape: 1.3, look: { body: 'collar', prop: 'staff', mood: 'stern' },
    lines: ['~angry~ Keep to the ring.', '~neutral~ Eyes on the visitors.', '~tired~ Palace rules.'],
    talk: {
      entry: [
        { if: { all: [{ quest: Q, stage: 'palace' }, { has: 'splinter' }] }, node: 'splinter' },
        { if: { all: [{ has: 'ration' }, { quest: 'incal.ration', active: true }] }, node: 'ration' },
        { if: LOOKED, node: 'lit' },
        { if: { flag: 'incal.dov.allowed' }, node: 'allowed' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~angry~ Palace landing. Stay on the ring. No climbing the dome. No staring at the light. I don’t write the rules. I repeat them until supper."],
          choices: [
            { text: '~curious~ Nobody looks at the light?', goto: 'rule' },
            { text: '~curious~ The night the sky rang: were you on duty?', goto: 'night', once: true },
          ],
        },
        rule: { say: ["~neutral~ Officially, it’s a light show. Officially, I watch the visitors. This is my official face.", '~neutral~ (He keeps his eyes very carefully on you.)'], choices: [{ text: '~curious~ Where are you from?', goto: 'from' }, { text: '~tired~ Fine.', end: true }] },
        night: {
          say: ["~solemn~ I was on night watch. The singing light passed just over the palace. The whole shaft rang like a bell.",
            "~whisper~ When it turned, I saw this mark on it. {glyph} Same as the Lodestar. We were told it was weather. Very purposeful weather."],
          do: { set: { 'incal.rumour.light': true } },
          choices: [{ text: '~curious~ Where did it go?', goto: 'went' }],
        },
        went: { say: ["~neutral~ It flew over the rim *toward the deserts*. It didn’t fall."], choices: [{ text: '~neutral~ That’s where my ship fell.', goto: 'fell' }] },
        fell: { say: ["~playful~ Then you survived it. Glad to hear that. I mean, keep to the ring."], choices: [{ text: '~neutral~ Fine.', end: true }] },
        from: { say: ['~neutral~ Up here. Top level. Born on the gold.', "~neutral~ (He gives the practised answer a fraction too quickly.)"], choices: [{ text: '~playful~ Fine.', end: true }] },
        splinter: {
          say: ["~surprised~ Wait. That note. I heard it through the floor of our flat when I was little.",
            "~solemn~ The splinter from Behla’s laundry. You brought it up from the bottom.",
            "~whisper~ Go *up the dome to the crown*, beneath the light. I’ll face the other way. Lots of visitors to inspect over there."],
          do: [{ advance: [Q, 'palace'] }, { set: { 'incal.dov.allowed': true } }],
          choices: [{ text: '~solemn~ Ossa says: we are still down here, and we are still looking.', goto: 'message' }, { text: '~neutral~ You’re from the bottom.', goto: 'caught' }, { text: '~happy~ Thank you, Dov.', end: true }],
        },
        message: {
          say: ["~whisper~ (Dov’s jaw works under the helmet strap.) Still looking. We said that at the bottom every night, eyes shut.", "~solemn~ Go *up the dome to the crown* and say it to the light. The guards will hear it from me."],
          choices: [{ text: '~neutral~ You’re from the bottom.', goto: 'caught' }, { text: '~happy~ Thank you, Dov.', end: true }],
        },
        caught: {
          say: ["~whisper~ Level minus two-nine-zero. Stall nineteen, above the cabbage man. That’s where I grew up. Go on. Before I start being a guard again."],
          choices: [{ text: '~whisper~ I won’t tell.', end: true }],
        },
        allowed: { say: ["~playful~ *Use your jets to reach the dome’s crown.* No stairs. Very exclusive, stairs apparently."], choices: [{ text: '~neutral~ (go up)', end: true }] },
        ration: {
          say: ["~surprised~ Smog-cabbage. My sister’s writing on the lid. I haven’t seen that in years.",
            "~sad~ Pip sent it? Says he’s taller? I left before he was born. Of course he’s taller."],
          do: [{ take: 'ration' }, { advance: 'incal.ration' }, { set: { 'incal.dov.fed': true } }],
          next: 'ration2',
        },
        // a choice the stone remembers (src/story/ending.js choicesMade): keep the token, or press it back
        // into his hand so he goes home himself (`incal.token`: 'kept' | 'returned')
        ration2: {
          say: ["~neutral~ (Dov eats at his post. For a moment he closes his eyes.)",
            "~sad~ Take this *cable-lift token*. Bottom to top and back. I’ve kept it eleven years, meaning to visit. Someone should finally use it."],
          choices: [
            { text: '~happy~ Thank you, Dov. I’ll keep it safe.', do: [{ set: { 'incal.token': 'kept' } }, { keepsake: { id: 'incal.token', level: 'incal', name: 'Dov’s lift token', kind: 'thing', text: 'A brass lift token, bottom to top, worn smooth in a palace guard’s pocket. Kept eleven years for the trip home; never spent.' } }], end: true },
            { text: '~solemn~ Keep it. Use it. Go down and see Pip.', do: { set: { 'incal.token': 'returned' } }, goto: 'tokenBack' },
          ],
        },
        tokenBack: {
          say: ["~surprised~ (He turns the token over in his fingers, as if it has changed weight.)",
            "~sad~ Eleven years I carried it so I wouldn’t have to decide. And you hand the deciding straight back.",
            "~solemn~ My rest day is the fourth. Bottom to top and back. I’ll bring Pip something he didn’t grow himself."],
          choices: [{ text: '~happy~ Tell him the sky-person says hello.', end: true }],
        },
        lit: {
          say: ["~playful~ I looked up on duty. In public. There will be paperwork. I might frame it.", '~happy~ Worth it.',
            { text: '~whisper~ (He pats his pocket.) Rest day’s the fourth. I’ve told the lift.', if: { flag: 'incal.token', is: 'returned' } },
            { text: '~neutral~ (He nods at your pocket.) Keep that token somewhere dry. Eleven years in mine, and it never once got used.', if: { flag: 'incal.token', is: 'kept' } }],
          choices: [{ text: '~curious~ Was it?', goto: 'worth' }, { text: '~neutral~ Goodbye, Dov.', end: true }],
        },
        worth: { say: ["~solemn~ For a moment, everyone saw the same light. Top and bottom. Yes. Worth it."], choices: [{ text: '~happy~ Goodbye, Dov.', end: true }] },
      },
    },
  },
};

/**
 * Wren: the old cab that still stops at the bottom's call-lamp (src/story/incal.js). Cabs drive
 * themselves; Wren speaks from the little screen on its dash when you get in (src/story/cab.js
 * asks where to after: each node here ends in its `where`). Its stops: every one, the bottom too.
 */
export const WREN = {
  id: 'wren', name: 'Wren', title: 'the old cab that still stops', color: '#f2c54b', voice: 1.1, kind: 'f', lang: 'ship', speaks: true,
  talk: {
    entry: [{ if: { quest: 'incal.wren', done: true }, node: 'after' }, { if: { flag: 'incal.lamp.lit' }, node: 'hello' }, { node: 'early' }],
    nodes: {
      hello: {
        say: ["~surprised~ (The screen on the dash flickers on, then steadies.) You lit the lamp! I saw it from the ninth lane. Nearly took a shirt off a washing line, coming down.",
          "~neutral~ Wren. Public cab, nine-nine-one. I still stop at this lamp. Nobody has lit it in eleven years, because everybody knows cabs don’t stop down here. Round and round I go."],
        choices: [{ text: '~curious~ Why do you still stop?', goto: 'why' }, { text: '~neutral~ I need to get to the top.', goto: 'ride' }],
      },
      why: {
        say: ["~happy~ My first fare was from minus two-nine-zero: a mother, to a doctor, at night. My meter was broken. I never had it mended.",
          "~solemn~ After the smog, the palace rewrote every cab: no stops below it. My update never arrived. So I stop for the next person."],
        choices: [{ text: '~curious~ Did you see the singing light?', goto: 'light', once: true }, { text: '~neutral~ I need to get to the top.', goto: 'ride' }],
      },
      light: {
        say: ["~scared~ The singing light passed right over my canopy. Slow, then a sharp turn. My compass spun for an hour. Worst directions I ever received.",
          "~sad~ It flew over the rim toward the deserts. Afterwards, the Lodestar was dimmer. That’s what I saw.",
          "~curious~ My compass twitches near your ship too. Whatever passed you left something in the metal."],
        do: { set: { 'incal.rumour.light': true } },
        choices: [{ text: '~neutral~ I need to get to the top.', goto: 'ride' }],
      },
      ride: {
        say: ["~neutral~ Sit back; I do the flying. Tell me a stop and I’ll take you there, then come home to this lamp.",
          "~playful~ For the palace, I set you down *beside the gate*. The guards will disapprove. They practise all day.",
          "~solemn~ If you hail a cab down here, it’ll be me. I’ll keep coming."],
        do: [{ advance: ['incal.wren', 'wren'] }, { set: { 'incal.wren.met': true } }],
        next: 'where',
      },
      early: { say: ["~surprised~ (The screen on the dash flickers.) A passenger? Down here? Nobody calls me any more."], next: 'where' },
      after: { say: ["~happy~ (The screen brightens.) Need a lift? The lamp works now. So do I."], next: 'where' },
    },
  },
};

// The rim's people (content.js npcs 0–2): who they are, what they say.
export const RIM = {
  corvin: {
    id: 'corvin', name: 'Corvin Sale', title: 'of the rim, third generation', color: '#e88fa6', head: 'hat', cape: 0, look: { head: 'bowler', under: 'swept', mask: 'monocle', body: 'collar' },
    talk: { listen: [
      ["~playful~ Enjoying the view? I stopped noticing it years ago. One of the privileges of an expensive address.", '~neutral~ Corvin Sale. Of the rim. Third generation.'],
      { if: { not: LOOKED }, say: ['~tired~ The Lodestar? A light show. A story for tourists, and for the lower levels, who need stories.', '~playful~ Dimming, is it? Then the palace is economising. Good.'] },
      "~angry~ Below the smog? Why would I go? Everything I order comes up.",
      '~neutral~ {glyph} The palace seal. It’s on every cab licence, every permit, every gate. It means *approved*. You, for instance, are not stamped.',
      { if: { not: { flag: 'temple.incal.done' } }, say: '~playful~ That tower round the rim from your ship? *The makers’ tower*. A folly. Somebody built a well that goes up. We don’t talk about it.' },
      { after: LOOKED, say: ["~surprised~ Yes, I looked up. Everyone else did. I wasn’t going to be the only one missing something.", '~whisper~ Don’t tell anyone I said it was beautiful.'] },
      { after: { flag: 'temple.incal.done' }, say: '~surprised~ The air rises up the shaft now, by the old shrine, and the lower levels ride it all the way to the rim. Uninvited. In their slippers.' },
    ] },
  },
  lio: {
    id: 'lio', name: 'Lio', title: 'cab dispatcher', color: '#62c3c9', head: 'hat', cape: 0, look: { head: 'peak', under: 'swept' },
    talk: {
      entry: [
        { if: { all: [{ quest: 'incal.pass', stage: 'back' }, { has: 'fare' }] }, node: 'paid' },
        { if: { quest: 'incal.pass', stage: ['fare', 'back'] }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: [{ if: { has: 'cabpass' }, text: "~playful~ Pass holder! Wave it about. The cabs adore paperwork." },
            { if: { not: { has: 'cabpass' } }, text: "~playful~ Mind the taxis. They stop for passes, not people. Palace rule. You haven’t got one; I can tell from here." },
            "~neutral~ Nine hundred cabs. I dispatch every one. None stop below the smog. At least, that’s what my forms say."],
          choices: [{ text: '~curious~ How do I get a pass?', if: { not: { has: 'cabpass' } }, goto: 'pass' }, { text: '~curious~ Why not below the smog?', goto: 'why' }, { text: '~curious~ Seen anything strange lately?', goto: 'strange' }],
        },
        pass: {
          say: ["~neutral~ I write them. One fare, paid in advance, and a name. Any name. Most people pick their own.",
            "~playful~ No coin? Then fetch me one I’m owed. *Tobin, who sells views along the rim*, took a cab on Tuesday and paid in compliments. *Collect his fare*, and the pass is yours."],
          do: [(ctx) => { const q = ctx.quests; if (!q.isStarted('incal.pass')) q.start('incal.pass'); if (q.stage('incal.pass') === 'lio') q.advance('incal.pass', 'lio'); }],
          choices: [{ text: '~happy~ I’ll collect it.', end: true }, { text: '~curious~ Why don’t the cabs stop below the smog?', goto: 'why' }],
        },
        waiting: {
          say: [{ if: { quest: 'incal.pass', stage: 'fare' }, text: "~neutral~ *Tobin, along the rim*, selling views of a hole. One fare. He’ll pretend he’s forgotten. He hasn’t." },
            { if: { not: { quest: 'incal.pass', stage: 'fare' } }, text: "~curious~ Got Tobin’s coin? No? Then the cabs and I will go on ignoring you together." }],
          choices: [{ text: '~neutral~ On my way.', end: true }],
        },
        paid: {
          say: ["~surprised~ Tobin paid? In a coin? And he says he tipped? I’ll frame it, next to the compliments.",
            "~neutral~ (Lio stamps a card with the palace seal and punches a name into it, more or less yours.) *Your cab pass.* Whistle when a cab goes by, and it stops. Get in one that waits, and it goes."],
          do: [{ take: 'fare' }, { give: 'cabpass' }, { advance: ['incal.pass', 'back'] }],
          choices: [{ text: '~happy~ Thank you, Lio.', end: true }],
        },
        why: { say: ["~neutral~ No profitable fares down there. Wren still goes if someone *lights the old call-lamp*. Please don’t make me calculate whether kindness breaks even."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
        strange: { say: ["~scared~ When the sky rang, nine hundred compasses failed at once. You try routing nine hundred lost cabs, every horn in the shaft going at once. I still hear them in my sleep."], do: { set: { 'incal.rumour.light': true } }, choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
  hask: {
    id: 'hask', name: 'Tobin', title: 'seller of views', color: '#f2c54b', head: 'hair', cape: 0,
    talk: { listen: [
      ["~shout~ Views of the abyss! Very reasonable! Stand here, look down, discover how reasonable!", "~playful~ Up is free. Please stop demonstrating that in front of customers."],
      '~neutral~ Nine levels. Eleven if you count the smog and the lake. The rich at the top, the poor at the bottom, and a light in the middle that nobody pays for, so nobody looks at it.',
      '~angry~ No looking without paying. That was a look. That’s one coin.',
      { if: { not: { flag: 'box.incal.soles' } }, say: '~whisper~ A free one, since you’re not buying: there’s a box on top of *the lone stone pillar*, round the rim from your ship. A good climb. A terrible view, of a box.' },
      { after: LOOKED, if: { not: { quest: 'incal.pass', stage: 'fare' } }, say: '~playful~ Now they all look up, and for free. I’m ruined. I sell views of the light now. Same price.' },
      // (last: the list's places are the save's memory of what was said)
      { after: { quest: 'incal.pass', stage: 'fare' }, say: ["~angry~ Lio sent you? For one fare? I was going to pay. Eventually. Possibly in views.", "~tired~ (Tobin counts out one bent coin, slowly, as if it were the last view on the rim.) *Take it to Lio, round the outer rim past my telescopes.* Have a look on the house. Tell him I tipped."],
        do: [{ give: 'fare' }, { advance: ['incal.pass', 'fare'] }] },
    ] },
  },
};

/** What Tobin says as he pays Lio's fare, when you walk up to him for it (src/story/incal.js). */
export const TOBIN_PAYS = '~angry~ Lio sent you? For one fare? I was going to pay. Eventually. Possibly in views.';

// The middle levels' cab stop (src/levels/content.js): Basile waits there with Fausta's baskets for a cab up, beside her
// Basket-Shop (level design audit v1.15: since Perrine's stall moved onto the lamplighters' drops, the shop stood alone)
export const MIDDLE = {
  basile: {
    id: 'basile', name: 'Basile', title: 'carries Fausta’s baskets', color: '#c98a4b', head: 'wrap', cape: 0, look: { prop: 'basket', under: 'crop' },
    talk: { listen: [
      ["~tired~ Waiting for a cab up. That’s the third gone past. They see the baskets and decide I’m scenery.", '~neutral~ Basile. I carry for Fausta. The small orders go down on her rope; the big ones go up the shaft on my back.'],
      '~playful~ Rim prices on the way up, bottom prices on the way down. Same basket, same cure. I carry both, and I say nothing.',
      { if: { not: { has: 'cabpass' } }, say: '~curious~ No pass either? Lio writes them, up at the rim’s cab stand. One fare, paid in advance. I paid mine in baskets.' },
      { if: { has: 'cabpass' }, say: '~surprised~ A pass? Then wave for both of us. They might stop for the pair.' },
      { after: { flag: 'incal.lit' }, say: ['~happy~ When the light came back, the whole terrace stopped and looked up. I put my baskets down for it.', '~neutral~ Missed two cabs. Worth it.'] },
    ] },
  },
};

// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  bowl: {
    id: 'bowl', name: 'The Upward Shrine', title: 'a bowl held up to the light', color: '#b5862f', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'incal.splinter.given' }, node: 'empty' }, { node: 'full' }],
      nodes: {
        full: {
          say: ["~neutral~ A brass bowl holds a hand-long splinter of the Lodestar. The familiar mark is cut into one facet: {glyph}",
            "~whisper~ It hums, thin as a held breath, leaning faintly toward the light above."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        empty: { say: ["~solemn~ The bowl is empty of the splinter. Someone has put a candle in its place."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  hoist: {
    id: 'hoist', name: 'The goods hoist', title: 'at the edge', color: '#34405e', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'incal.hoist.in' }, node: 'in' }, { if: { flag: 'incal.hoist.pin' }, node: 'loose' }, { node: 'stuck' }],
      nodes: {
        stuck: {
          say: ["~neutral~ A *ration tin* hangs in a hoist basket over the drop. *A rusty pin* locks the hoist arm in place.",
            "~curious~ The pin looks brittle with rust. Free of it, the arm would swing round its post."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        loose: { say: ["~neutral~ The pin is out. The counterweight hangs on the arm, ready to go round the post."], choices: [{ text: '~neutral~ (step back)', end: true }] },
        in: { say: ["~neutral~ The basket is safely over the terrace. On the tin’s lid, someone has scratched DOV."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  mirror: {
    id: 'mirror', name: 'The halfway mirror', title: 'on its pole by the tea stall', color: '#d8a24a', voice: 0.6,
    talk: {
      entry: [{ if: { all: [{ flag: 'incal.mirror.washed' }, { flag: 'incal.mirror.turned' }] }, node: 'up' }, { if: { flag: 'incal.mirror.washed' }, node: 'clean' }, { node: 'grimy' }],
      nodes: {
        grimy: {
          say: ["~neutral~ A round mirror on a pole, in a brass frame that turns on a ring of eight notches. Smog has greased it over until it reflects nothing at all.",
            "~neutral~ It would take a good splash to see anything in it."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        clean: {
          say: [{ if: { not: { flag: 'incal.mirror.turned' } }, text: "~neutral~ Clean now. It faces sideways, at a billboard selling something bright. The frame turns on its ring, one notch at a time." }],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        up: {
          say: [{ if: { flag: 'incal.lit' }, text: "~solemn~ The mirror looks up the shaft, at the Lodestar. A coin of its light goes down past you, toward the bottom." },
            { if: { not: { flag: 'incal.lit' } }, text: "~neutral~ The mirror looks up the shaft, at the dim Lodestar, and holds what little it has." }],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
      },
    },
  },
  lamp: {
    id: 'lamp', name: 'The call-lamp', title: 'at the edge', color: '#5d574b', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'incal.lamp.lit' }, node: 'lit' }, { node: 'dark' }],
      nodes: {
        dark: {
          say: ["~neutral~ TAXI, in flaking paint. The call-lamp’s dark glass contains a small history of unsuccessful moths.",
            "~neutral~ Lit, the cabs above would see it."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        lit: { say: ["~neutral~ The yellow call-lamp shines up through the traffic lanes."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  // the ways down and up (src/shaft-ways.js): the climb's floating pad, the relay lamp on the spire's ring, Tobin's view pad
  pad: {
    id: 'pad', name: 'The lamplighters’ pad', title: 'a quarter of the way up', color: '#9fc8c4', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ A round pad hanging in the air, a red lamp on its pole. Rows of tally marks are scratched into the rail, hundreds of them, in fives.",
        "~curious~ Someone has written beside the newest ones: *halfway to the spire. breathe.*"],
      do: { set: { 'incal.pad.seen': true } },
      choices: [{ text: '~neutral~ (breathe)', end: true }],
    } } },
  },
  upperPad: {
    id: 'upperPad', name: 'The lamplighters’ upper pad', title: 'three quarters of the way up', color: '#9fc8c4', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ A second pad, smaller, its rail worn bright where hands have held it. Fewer tally marks here, in the same fives.",
        "~playful~ Beside the newest, in the same hand as below: *nearly. don’t look down. (you looked.)*"],
      do: { set: { 'incal.upper.seen': true } },
      choices: [{ text: '~neutral~ (look up instead)', end: true }],
    } } },
  },
  locker: {
    id: 'locker', name: 'The lamplighters’ locker', title: 'on a landing below the smog', color: '#d0694a', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~curious~ A red cabinet by the lamp-post, its door hanging open. Inside: a coil of rope, a wick-trimmer, a tin of matches gone soft in the damp.",
        "~sad~ A card is pinned to the back of the door, in a careful hand: *Last round, down to the shrine and back. Eleven years ago next spring. Lamps still lit.*",
        "~neutral~ Someone has kept them lit since. The wick in the post’s lamp is new."],
      do: { set: { 'incal.locker.seen': true } },
      choices: [{ text: '~neutral~ (close the door)', end: true }],
    } } },
  },
  relay: {
    id: 'relay', name: 'The relay lamp', title: 'on the spire’s ring', color: '#d8a24a', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'incal.relay.lit' }, node: 'lit' }, { node: 'dark' }],
      nodes: {
        dark: {
          say: ["~neutral~ An old brass lamp on the ring round the spire, its glass turned up the shaft. Three small figures looking up are stamped on its foot: the Three Who Look Up.",
            "~curious~ It is dark. It looks as if it was made to catch a light, not to make one."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        lit: { say: ["~happy~ The relay lamp burns with the splinter’s light, a small star halfway up the shaft. Down on the bottom terrace someone will be looking up at it."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  viewPad: {
    id: 'viewPad', name: 'Tobin’s view pad', title: 'halfway down from the palace', color: '#f2c54b', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~playful~ A brass telescope on a floating pad, aimed straight up. A painted sign: TOBIN’S VIEWS. THE ABYSS, ONE COIN. UP: FREE.",
        { if: { flag: 'incal.lit' }, text: "~happy~ Through it the Lodestar fills the glass, turning, its glyph lit on every facet." },
        { if: { not: { flag: 'incal.lit' } }, text: "~sad~ Through it the Lodestar fills the glass, turning, and guttering." }],
      do: { set: { 'incal.view.seen': true } },
      choices: [{ text: '~neutral~ (look a while longer)', end: true }],
    } } },
  },
};

// What crowd people say when you stop beside them (balloons), by where they live.
export const LINES = {
  rim: ['~happy~ Lovely day for looking down.', '~neutral~ Mind the edge, it’s a long way down.', '~tired~ The Lodestar? A light show.', '~playful~ Have you been to the palace? Neither have I.', '~shout~ Taxi! Oh. Not you.', '~angry~ Laundry? Up here? Never.'],
  upper: ['~neutral~ Laundry dries fast up here.', '~tired~ The light? The tourists like it.', '~neutral~ I never go below the smog.', '~neutral~ Mind the edge.', '~shout~ Fresh figs! Fresh figs!', '~playful~ The taxis stop for us. Naturally.'],
  middle: ['~tired~ Busy day.', '~neutral~ Excuse me.', '~tired~ Up a level, down a level, that’s my life.', '~curious~ Have you seen the light above the palace?', '~neutral~ Mind the cables.'],
  lower: ['~angry~ The taxis never stop for us lower folk.', '~sad~ My grandmother never saw the sky.', '~solemn~ We pray with our eyes shut. The smog stings.', '~whisper~ A piece of the light fell down here, you know.', '~solemn~ Hum with it. It hums back.', '~solemn~ Up. Everything good is up.'],
  carrying: ['~surprised~ It hums! You’ve got it!', '~curious~ Is that the light?', '~shout~ Take it up! Take it home!', '~shout~ Hold it higher!'],
  lit: {
    rim: ['~surprised~ Did you see that?', '~happy~ The palace has outdone itself.', '~curious~ I looked up. Did you?', '~surprised~ It throws shadows again!'],
    upper: ['~surprised~ Look at it!', '~happy~ It’s so bright!', '~sad~ I’d forgotten it did that.', '~shout~ Look up, everyone!'],
    middle: ['~shout~ Look up! Look!', '~surprised~ It reaches all the way down!', '~happy~ I can see my own shadow!'],
    lower: ['~surprised~ It sees us!', '~shout~ Light! Down here!', '~happy~ Open your eyes, it doesn’t sting!', '~solemn~ The Three Who Look Up!', '~shout~ We’re still down here!'],
  },
  shout: ['~shout~ Look! Look up!', '~shout~ The light!', '~shout~ Up there!', '~shout~ It’s burning again!'],
};

/** What people in the crowd say when you stop and listen (no answers: src/story/dialogue.js pickListen), by where they live. Picked by their seed. */
export const CROWD_TALK = {
  rim: [
    { name: 'A rim resident', title: 'taking the air', talk: { listen: [
      "~tired~ It’s a palace light show, dear. There’s probably a switch somewhere. There generally is.",
      { if: { not: LOOKED }, say: '~tired~ Dimming, is it? I hadn’t looked. One doesn’t, really.' },
      '~angry~ Please don’t stand so near the edge. It makes the rest of us look reckless.',
      '~neutral~ The cabs stop for anyone up here with a pass. Wave it. Not at me.',
    ] } },
    { name: 'A tourist', title: 'from off-world', talk: { listen: [
      { if: { not: LOOKED }, say: "~tired~ The Lodestar is smaller than the postcard. Greyer too. I’d like to visit wherever they printed the postcard." },
      '~curious~ I asked a cab to take me to the bottom. Its little screen laughed for a whole level.',
      ['~playful~ Tip from one stranger to another: up here it’s rude to look up.', '~playful~ Down at the bottom it’s rude not to. I’ve had a stiff neck all week.'],
      '~tired~ I’m on holiday. Please don’t ask me for directions; I’ve been lost since I landed.',
    ] } },
  ],
  upper: [
    { name: 'A roof gardener', title: 'of the high terraces', talk: { listen: [
      "~playful~ We grow rooftop lemons. They get more sky than most people. Excellent lemons, though.",
      '~neutral~ The rain falls past us on its way to the bottom. We catch what we can. The bottom gets the rest, and the smog.',
      '~angry~ Mind the lemons! Not that one, it’s having a hard year.',
      '~whisper~ Don’t look down too long. The shaft looks back, and it has six hundred metres of patience.',
    ] } },
    { name: 'A flower seller', title: 'of the high terraces', talk: { listen: [
      "~sad~ It used to shine brighter. I know everyone says that about their childhood. This time it’s measurable.",
      ['~curious~ The night the sky rang, every glass vase on my stall sang at once, and six of them broke.', '~angry~ Fireworks, the palace said. Fireworks don’t sing.'],
      '~playful~ Flowers for someone? No? For you, then. No? Then step aside, darling, you’re blocking the tulips.',
      { after: LOOKED, say: '~happy~ I sold every yellow flower I had this morning. Everyone wants something the colour of the Lodestar.' },
    ] } },
  ],
  middle: [
    { name: 'A cable mender', title: 'between the levels', talk: { listen: [
      "~tired~ I mend the cables. Up a level, down a level. The middle is somewhere everybody passes and nobody asks about.",
      { if: { not: { quest: 'incal.ration', done: true } }, say: ['~neutral~ The old goods hoist, down low? There’s a rusted pin in it. *Shoot the pin out* and it swings free.', '~neutral~ Then push the weight round its post. Round, mind. Not toward the edge.'] },
      '~angry~ I’m on a cable. You’re on my cable. One of us has to move, and I’m working.',
      '~solemn~ Everything in this city hangs from something. Don’t think about what the top one hangs from.',
    ] } },
    { name: 'A commuter', title: 'in a hurry', talk: { listen: [
      "~tired~ I pass the light twice a day. Its colour? I… couldn’t tell you. That’s odd.",
      '~tired~ Up a level, down a level. I have been late on every level of this city.',
      '~angry~ Excuse me. Excuse me! Some of us have a cab to catch.',
      { after: LOOKED, say: '~surprised~ I stopped on the stairs this morning to look at it. First time in eleven years. I was late. I didn’t mind.' },
    ] } },
  ],
  lower: [
    { name: 'A worshipper', title: 'of the bottom terraces', talk: { listen: [
      ['~whisper~ Shh. We’re praying. Eyes shut, face up.', '~whisper~ The smog stings, but the light can still feel you looking.'],
      '~angry~ Why eyes shut? You try keeping them open down here.',
      '~solemn~ {glyph} Three heads over a hill: the Three Who Look Up. They’re cut into the light itself, underneath, where only we can see them.',
      '~solemn~ A light nobody looks at goes out. That is the whole of the teaching. The rest is singing.',
    ] } },
    { name: 'A laundry hanger', title: 'of the bottom terraces', talk: { listen: [
      "~playful~ The splinter landed in Behla’s washing. She now describes her vests as historically significant.",
      '~playful~ Down here the laundry never dries. We hang it out anyway. It’s a kind of prayer.',
      { if: { not: { quest: 'incal.wren', done: true } }, say: '~neutral~ No cab stops below the smog. Except old Wren, they say, a cab that still answers *the old call-lamp* at the edge of the terrace. Light it. Give it a shot.' },
      '~tired~ Mind the sheets. That one is drier than you, and it’s still wet.',
    ] } },
    { name: 'A child', title: 'who wants to go up', talk: { listen: [
      "~curious~ Is there really sun at the top? Every day? What do they do with so much of it?",
      '~happy~ When I’m big I’m going to go up and stand right under it and look.',
      '~playful~ I can hold my breath for a whole level of smog. Watch. (He can’t.)',
      '~curious~ Is it true the people at the top have never seen the bottom? Not even once? Not even by falling?',
    ] } },
  ],
  lit: [
    { name: 'Someone looking up', title: 'with everyone else', talk: { listen: [
      "~surprised~ Look at the light. I’d forgotten how far it could reach.",
      '~solemn~ Look up once a day. Yes. I could manage once a day.',
      '~happy~ My shadow! I haven’t had a shadow since I was a girl. It’s taller than I remembered.',
      { after: { flag: 'temple.incal.done' }, say: '~surprised~ The air rises by the old shrine now, all the way to the rim. My neighbour rode it up in his slippers.' },
    ] } },
    { name: 'Someone from the bottom', title: 'eyes wide open', talk: { listen: [
      "~happy~ You carried it up? I could see it. I opened my eyes and it didn’t hurt.",
      '~shout~ It reaches all the way down! Look at the lake! The lake has a colour!',
      '~playful~ The rim says the palace fixed it. Let them. We know who looked.',
    ] } },
  ],
};
