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
// taxi call-lamp at the bottom (shoot it) and Wren, the driver who still stops.
// Clue: the splinter carries the glyph and hums the same note as the singing
// crystals of the swamp of lights (Lorn).
//
// Flags (game-state.js): incal.rumour.light, incal.splinter.given, incal.dov.allowed,
// incal.lit (the Lodestar burns bright again), incal.lamp.lit, incal.wren.met,
// incal.dov.fed, incal.hoist.pin, incal.hoist.in (the goods hoist, swung in); clue.incal.perdide. Items: splinter, ration.

const Q = 'incal.light';

export const ITEMS = { splinter: 'the Lodestar splinter', ration: 'Pip’s ration tin' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Light Nobody Looks At', world: 'incal', main: true,
    outro: 'The Lodestar burns bright. For a moment, every level looked up.',
    stages: [
      { id: 'nima', text: 'The light above the palace is dimming. Find the sweeper on the high terrace, who still watches it', label: 'Nima, the sweeper', talk: 'nima' },
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
      { id: 'hoist', text: 'Pip’s tin hangs in the old goods hoist’s basket, out over the void. Knock out the rusted pin (shoot: aim with R, right click or LT / L2, then G, a click or RT / R2), push the hoist round (push: C, middle click, or RB / R1) and take the tin', label: 'The goods hoist', bring: 'ration', at: 'hoist', to: 'dov' },
      { id: 'carry', text: 'Carry Pip’s ration tin up to his uncle Dov, the palace guard', label: 'Dov, at the palace gate', bring: 'ration', to: 'dov' },
    ],
  },
  {
    id: 'incal.wren', title: 'The Driver Who Stops', world: 'incal',
    outro: 'One cab still stops at the bottom. Now you know her name.',
    stages: [
      { id: 'lamp', text: 'Light the dead taxi call-lamp at the edge of the bottom terrace (shoot it with the fluid)', label: 'The call-lamp', flag: 'incal.lamp.lit', at: 'lamp' },
      { id: 'wren', text: 'A cab is coming down to the lamp. Talk to its driver', label: 'The driver', talk: 'wren' },
    ],
  },
];

const LOOKED = { flag: 'incal.lit' };
const EARLY = { quest: Q, stage: ['nima', 'ossa'] };   // before the splinter is in your hands

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
        { if: { quest: Q, stage: 'ossa' }, node: 'again' },
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
          say: ["~solemn~ A light flew low across the shaft, singing like a finger round wet glass. Every window hummed.",
            "~surprised~ The Lodestar answered. Then a splinter broke off and fell all the way to the bottom. I heard it singing long after I lost sight of it."],
          do: { set: { 'incal.rumour.light': true } },
          choices: [{ text: '~neutral~ Something struck my ship that night.', goto: 'ship' }, { text: '~curious~ Where did the piece land?', if: EARLY, goto: 'where' },
            { text: '~neutral~ I have it. Ossa gave it to me.', if: { all: [{ has: 'splinter' }, { not: EARLY }] }, goto: 'carry' }],
        },
        ship: {
          say: ["~playful~ Struck your ship too? Whatever passed us has left quite a repair bill.",
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
          say: ["~angry~ *Glide down or take a cab.* Coming back is harder. Most drivers refuse to stop below the smog."],
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
          say: ["~happy~ My steps turned gold! Everyone looked up. Guards, drivers, rich men. One dropped his lunch. A generous day for the bottom.",
            '~curious~ What did you do, up there?'],
          choices: [
            { text: '~neutral~ I gave it back its splinter. And I looked up at it.', goto: 'keep' },
            { text: '~neutral~ Nothing much. I just looked.', goto: 'keep' },
          ],
        },
        keep: {
          say: ["~solemn~ So the light needed someone to look at it. I’ve been doing that forty years. Nice to know I wasn’t entirely wasting my mornings.",
            "~solemn~ Here’s something to take with you: *look up once a day*. Wherever you go. Give the sky a chance to surprise you."],
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
        { if: { quest: Q, stage: ['nima', 'ossa'] }, node: 'hello' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: [{ if: { quest: Q, stage: 'ossa' }, text: "~happy~ Nima still sweeps? Good. Someone up there remembers us." },
            { if: { not: { quest: Q, stage: 'ossa' } }, text: "~angry~ Here to admire the poor? Careful where you stand. Some of the scenery has washing to do." },
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
          say: ["~solemn~ {glyph} *The Three Who Look Up.* Three people beneath the curve of the world, looking for light.",
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
            "~neutral~ To get back up, light the old taxi call-lamp at the terrace edge. One driver used to answer it."],
          do: [{ give: 'splinter' }, { set: { 'incal.splinter.given': true } }, { start: 'incal.wren' }, { stage: [Q, 'palace'] }, { track: Q }],
          choices: [{ text: '~solemn~ I’ll carry it up.', end: true }],
        },
        later: {
          say: ["~happy~ Hear it? Louder already. *Take it up to the palace.* We’ll watch from here."],
          choices: [{ text: '~neutral~ I’m going.', end: true }],
        },
        after: {
          say: ["~happy~ The light reached us! I could open my eyes and look straight at it.",
            "~solemn~ The smog hasn’t gone. But now the people above know we’re here."],
          choices: [{ text: '~happy~ Keep looking, Ossa.', end: true }],
        },
      },
    },
  },

  pip: {
    id: 'pip', name: 'Pip', title: 'who has seen the sky once', color: '#e6875f', voice: 1.65, kind: 'm', scale: 0.7,
    palette: { cloak: '#e6875f', lining: '#2b211f', cloth: '#5a4a3a', legs: '#3a3a3a', hat: '#d8a24a', hair: '#4a3226' }, head: 'hair', cape: 0.5,
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

  dov: {
    id: 'dov', name: 'Dov', title: 'guard at the palace gate', color: '#f2c54b', voice: 0.85, kind: 'm', scale: 1.06,
    palette: { cloak: '#34405e', lining: '#f2c54b', cloth: '#f3ead8', legs: '#2b2f45', hat: '#f2c54b', hair: '#2b211f' }, head: 'hat', cape: 1.3, look: { body: 'collar', prop: 'staff' },
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
          choices: [{ text: '~neutral~ You’re from the bottom.', goto: 'caught' }, { text: '~happy~ Thank you, Dov.', end: true }],
        },
        caught: {
          say: ["~whisper~ Level minus two-nine-zero. Stall nineteen, above the cabbage man. That’s where I grew up. Go on. Before I start being a guard again."],
          choices: [{ text: '~whisper~ I won’t tell.', end: true }],
        },
        allowed: { say: ["~playful~ *Use your jetpack to reach the dome’s crown.* No stairs. Very exclusive, stairs apparently."], choices: [{ text: '~neutral~ (go up)', end: true }] },
        ration: {
          say: ["~surprised~ Smog-cabbage. My sister’s writing on the lid. I haven’t seen that in years.",
            "~sad~ Pip sent it? Says he’s taller? Eleven years. Of course he is."],
          do: [{ take: 'ration' }, { advance: 'incal.ration' }, { set: { 'incal.dov.fed': true } }],
          next: 'ration2',
        },
        ration2: {
          say: ["~neutral~ (Dov eats at his post. For a moment he closes his eyes.)",
            "~sad~ Take this *cable-lift token*. Bottom to top and back. I’ve kept it eleven years, meaning to visit. Someone should finally use it."],
          do: { keepsake: { id: 'incal.token', level: 'incal', name: 'Dov’s lift token', kind: 'thing', text: 'A brass lift token, bottom to top, worn smooth in a palace guard’s pocket. Kept eleven years for the trip home; never spent.' } },
          choices: [{ text: '~happy~ Thank you, Dov.', end: true }],
        },
        lit: {
          say: ["~playful~ I looked up on duty. In public. There will be paperwork. I might frame it.", '~happy~ Worth it.'],
          choices: [{ text: '~curious~ Was it?', goto: 'worth' }, { text: '~neutral~ Goodbye, Dov.', end: true }],
        },
        worth: { say: ["~solemn~ For a moment, everyone saw the same light. Top and bottom. Yes. Worth it."], choices: [{ text: '~happy~ Goodbye, Dov.', end: true }] },
      },
    },
  },

  wren: {
    id: 'wren', name: 'Wren', title: 'the driver who still stops', color: '#f2c54b', voice: 1.1, kind: 'f',
    palette: { cloak: '#f2c54b', lining: '#34405e', cloth: '#34405e', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'hat', cape: 0.5,
    lines: ['~curious~ Need a lift?', '~neutral~ Space to climb, Shift to drop.', '~playful~ Mind the laundry.'],
    talk: {
      entry: [{ if: { quest: 'incal.wren', done: true }, node: 'after' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~surprised~ You lit the lamp! I spotted it from the ninth lane. Nearly took someone’s trousers off a washing line.",
            "~neutral~ Wren. Driver. I still stop at this lamp. Nobody’s lit it for eleven years because everybody knows drivers don’t stop here. Round and round we go."],
          choices: [{ text: '~curious~ Why do you stop?', goto: 'why' }, { text: '~neutral~ I need to get to the top.', goto: 'ride' }],
        },
        why: {
          say: ["~happy~ I was born on minus two-nine-zero. A driver took my mother up to a doctor. Didn’t charge a thing.",
            "~solemn~ Can’t thank that driver now. Can stop for the next person."],
          choices: [{ text: '~curious~ Did you see the singing light?', goto: 'light', once: true }, { text: '~neutral~ I need to get to the top.', goto: 'ride' }],
        },
        light: {
          say: ["~scared~ The singing light passed above my cab. Slow, then a sharp turn. My compass spun for an hour. Worst directions I ever received.",
            "~sad~ It flew over the rim toward the deserts. Afterwards, the Lodestar was dimmer. That’s what I saw.",
            "~curious~ My compass twitches near your ship too. Whatever struck you left something in the metal."],
          do: { set: { 'incal.rumour.light': true } },
          choices: [{ text: '~neutral~ I need to get to the top.', goto: 'ride' }],
        },
        ride: {
          say: ["~neutral~ Borrow the cab. *W moves forward, Space climbs, Shift descends.* Leave her anywhere; she’ll return to this lamp. Better manners than most owners.",
            "~playful~ For the palace, fly straight up and land *beside the gate*. The guards will disapprove. They practise all day.",
            "~sad~ If you hail a cab down here, it’ll be me. I’ll keep coming."],
          do: [{ advance: ['incal.wren', 'wren'] }, { set: { 'incal.wren.met': true } }],
          choices: [{ text: '~happy~ Thank you, Wren.', end: true }],
        },
        after: { say: ["~happy~ Need a lift? The lamp works now. So do I."], choices: [{ text: '~happy~ Thanks, Wren.', end: true }] },
      },
    },
  },
};

// The rim's people (content.js npcs 0–2): who they are, what they say.
export const RIM = {
  corvin: {
    id: 'corvin', name: 'Corvin Sale', title: 'of the rim, third generation', color: '#e88fa6', head: 'hat', cape: 0,
    talk: {
      entry: [{ if: LOOKED, node: 'lit' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~playful~ Enjoying the view? I stopped noticing it years ago. One of the privileges of an expensive address.", '~neutral~ Corvin Sale. Of the rim. Third generation.'],
          choices: [{ text: '~curious~ What is the light above the palace?', goto: 'incal' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        incal: { say: ["~tired~ The Lodestar? A palace display. The taxi tax pays for it, I’m told. I make a point of enjoying things I’ve paid for. Eventually.", '~playful~ Dimming, is it? Then the palace is economising. Good.'], choices: [{ text: '~curious~ What’s down there?', goto: 'down' }, { text: '~curious~ What’s that mark on the cabs?', goto: 'glyph' }] },
        down: { say: ["~angry~ Below the smog? Why would I go? Everything I order comes up."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
        glyph: { say: ["~neutral~ {glyph} The palace seal. It means *approved*. Quite comforting when you own a great deal that requires approval."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
        lit: { say: ["~surprised~ Yes, I looked up. Everyone else did. I wasn’t going to be the only one missing something.", '~whisper~ Don’t tell anyone I said it was beautiful.'], choices: [{ text: '~playful~ Your secret is safe.', end: true }] },
      },
    },
  },
  lio: {
    id: 'lio', name: 'Lio', title: 'cab dispatcher', color: '#62c3c9', head: 'hat', cape: 0,
    talk: {
      nodes: {
        hello: {
          say: ["~playful~ Mind the taxis. They stop for people who look like a fare. You’ll do.", "~neutral~ Nine hundred cabs. I dispatch every one. None stop below the smog. At least, that’s what my forms say."],
          choices: [{ text: '~curious~ Why not?', goto: 'why' }, { text: '~curious~ Seen anything strange lately?', goto: 'strange' }],
        },
        why: { say: ["~neutral~ No profitable fares down there. Wren still goes if someone *lights the old call-lamp*. Please don’t make me calculate whether kindness breaks even."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
        strange: { say: ["~scared~ When the sky rang, nine hundred compasses failed at once. You try routing nine hundred frightened drivers. I still hear the horns in my sleep."], do: { set: { 'incal.rumour.light': true } }, choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
  hask: {
    id: 'hask', name: 'Hask', title: 'seller of views', color: '#f2c54b', head: 'hair', cape: 0,
    talk: {
      nodes: {
        hello: {
          say: ["~shout~ Views of the abyss! Very reasonable! Stand here, look down, discover how reasonable!", "~playful~ Up is free. Please stop demonstrating that in front of customers."],
          choices: [{ text: '~curious~ What can you see from here?', goto: 'see' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        see: { say: ["~neutral~ Nine levels. Eleven if you count the lake and smog. Wealth above, poverty below, and a light nobody looks at because the view’s free."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
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
            "~whisper~ It hums like wet glass, leaning faintly toward the light above."],
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
            "~neutral~ Free the pin with *Shoot*: aim, then G, left click or RT / R2. Turn the arm with *Push*: C, middle click or RB / R1."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        loose: { say: ["~neutral~ The pin is out. *Push the counterweight sideways round the post* to swing the basket in. Pushing along the arm won’t help."], choices: [{ text: '~neutral~ (step back)', end: true }] },
        in: { say: ["~neutral~ The basket is safely over the terrace. On the tin’s lid, someone has scratched DOV."], choices: [{ text: '~neutral~ (step back)', end: true }] },
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
            "~neutral~ *Shoot the lamp with fluid* to light it: aim, then G or left click. Drivers above will see it."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        lit: { say: ["~neutral~ The yellow call-lamp shines up through the traffic lanes."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
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

const bye = { text: '~neutral~ Goodbye.', end: true };
/** Short conversations for people in the crowd, by where they live. Picked by their seed. */
export const CROWD_TALK = {
  rim: [
    { name: 'A rim resident', title: 'taking the air', talk: { nodes: {
      hello: { say: ["~tired~ It’s a palace light show, dear. There’s probably a switch somewhere. There generally is."], choices: [{ text: '~neutral~ It’s dimming.', goto: 'dim' }, bye] },
      dim: { say: ['~tired~ Is it? I hadn’t looked. One doesn’t, really.'], choices: [bye] },
    } } },
    { name: 'A tourist', title: 'from off-world', talk: { nodes: {
      hello: { say: ["~tired~ The Lodestar is smaller than the postcard. Greyer too. I’d like to visit wherever they printed the postcard."], choices: [bye] },
    } } },
  ],
  upper: [
    { name: 'A roof gardener', title: 'of the high terraces', talk: { nodes: {
      hello: { say: ["~playful~ We grow rooftop lemons. They get more sky than most people. Excellent lemons, though."], choices: [bye] },
    } } },
    { name: 'A flower seller', title: 'of the high terraces', talk: { nodes: {
      hello: { say: ["~sad~ It used to shine brighter. I know everyone says that about their childhood. This time it’s measurable."], choices: [{ text: '~curious~ The night the sky rang?', goto: 'rang' }, bye] },
      rang: { say: ["~angry~ Every vase on my stall sang. Six broke. The palace called it fireworks. I sent them a bill for six fireworks."], choices: [bye] },
    } } },
  ],
  middle: [
    { name: 'A cable mender', title: 'between the levels', talk: { nodes: {
      hello: { say: ["~tired~ I mend the cables. Up a level, down a level. The middle is somewhere everybody passes and nobody asks about."], choices: [bye] },
    } } },
    { name: 'A commuter', title: 'in a hurry', talk: { nodes: {
      hello: { say: ["~tired~ I pass the light twice a day. Its colour? I… couldn’t tell you. That’s odd."], choices: [bye] },
    } } },
  ],
  lower: [
    { name: 'A worshipper', title: 'of the bottom terraces', talk: { nodes: {
      hello: { say: ["~whisper~ Eyes shut, face up. The smog hurts, but we can still look toward the light."], choices: [{ text: '~curious~ Why with your eyes shut?', goto: 'why' }, bye] },
      why: { say: ['~angry~ You try keeping them open down here.'], choices: [bye] },
    } } },
    { name: 'A laundry hanger', title: 'of the bottom terraces', talk: { nodes: {
      hello: { say: ["~playful~ The splinter landed in Behla’s washing. She now describes her vests as historically significant."], choices: [bye] },
    } } },
    { name: 'A child', title: 'who wants to go up', talk: { nodes: {
      hello: { say: ["~curious~ Is there really sun at the top? Every day? What do they do with so much of it?"], choices: [{ text: '~happy~ Every day.', goto: 'yes' }, bye] },
      yes: { say: ["~happy~ When I’m big, I’m going up there. I’ll look until my neck aches."], choices: [bye] },
    } } },
  ],
  lit: [
    { name: 'Someone looking up', title: 'with everyone else', talk: { nodes: {
      hello: { say: ["~surprised~ Look at the light. I’d forgotten how far it could reach."], choices: [{ text: '~solemn~ Look up once a day.', goto: 'once' }, bye] },
      once: { say: ['~happy~ Once a day. Yes. I could manage once a day.'], choices: [bye] },
    } } },
    { name: 'Someone from the bottom', title: 'eyes wide open', talk: { nodes: {
      hello: { say: ["~happy~ You carried it up? I could see it. I opened my eyes and it didn’t hurt."], choices: [bye] },
    } } },
  ],
};
