// The City-Shaft's story as data: "The Light Nobody Looks At" (docs/story-bible.md).
//
// The Incal turns above the palace. The rim and the upper terraces call it a
// tourist story; the bottom levels pray to it, with their eyes shut, because
// the smog stings. Nima, who sweeps the high terrace, has looked up at it once
// a day for forty years, and says it has been dimming since "the night the sky
// rang": something passed over the shaft, low and singing, the Incal rang
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
// crystals of the swamp of lights (Perdide).
//
// Flags (game-state.js): incal.rumour.light, incal.splinter.given, incal.dov.allowed,
// incal.lit (the Incal burns bright again), incal.lamp.lit, incal.wren.met,
// incal.dov.fed; clue.incal.perdide. Items: splinter, ration.

const Q = 'incal.light';

export const ITEMS = { splinter: 'the Incal splinter', ration: 'Pip’s ration tin' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Light Nobody Looks At', world: 'incal', main: true,
    outro: 'The Incal burns bright. For a moment, every level looked up.',
    stages: [
      { id: 'nima', text: 'The light above the palace is dimming. Find the sweeper on the high terrace, who still watches it', label: 'Nima, the sweeper', talk: 'nima' },
      { id: 'ossa', text: 'Go down to the bottom terrace and ask at the Upward Shrine what fell the night the sky rang', label: 'Ossa, at the bottom of the shaft', talk: 'ossa' },
      { id: 'palace', text: 'Carry the splinter up the whole shaft to the palace, under the Incal', label: 'The palace gate', talk: 'dov' },
      { id: 'look', text: 'Stand on the palace and look up at the Incal', label: 'Look up', flag: 'incal.lit', at: 'crown' },
      { id: 'tell', text: 'The Incal burns again. Go down and tell Nima', label: 'Nima, on the high terrace', talk: 'nima' },
    ],
  },
  {
    id: 'incal.ration', title: 'A Ration for the Guard', world: 'incal',
    outro: 'Dov ate it at his post, standing up, with his eyes shut.',
    stages: [
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
    lines: ['The rich live up here. Me, I just sweep.', 'Mind the dust.', 'Look up once in a while. It’s free.'],
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
          say: ['Mind the dust. I just did that bit.',
            'You’re looking up. Nobody looks up. They look down to see who’s below them and across to see who’s richer. Up is for tourists.',
            'I’m Nima. I sweep the high terrace, forty years now, and every morning before the first step I look at that light. Once a day.'],
          choices: [
            { text: 'What is it, the light?', goto: 'what' },
            { text: 'It looks dim.', goto: 'dim' },
            { text: 'Who do you sweep for?', goto: 'sweep' },
          ],
        },
        what: {
          say: ['The Incal. Up here they’ll tell you it’s a palace light show, paid for out of the taxi tax. Down at the bottom they pray to it.',
            'I don’t know what it is. I know it was brighter when I was a girl, and I know it’s been going out since the night the sky rang.'],
          choices: [{ text: 'The night the sky rang?', goto: 'rang' }, { text: 'It does look dim.', goto: 'dim' }],
        },
        dim: {
          say: ['It is. It used to throw shadows at noon. Since the night the sky rang it gutters, like a lamp nobody trims.'],
          choices: [{ text: 'The night the sky rang?', goto: 'rang' }],
        },
        rang: {
          say: ['Something went over the shaft, low and slow, singing. Like the rim of a glass when you wet your finger and go round. Every window in the city hummed with it.',
            'And the Incal answered. I swear it did. It rang back, and a piece of it came away: a splinter of light, falling down the middle of the shaft. Past me. Past every level. Singing all the way to the bottom.'],
          do: { set: { 'incal.rumour.light': true } },
          choices: [{ text: 'Something struck my ship that night.', goto: 'ship' }, { text: 'Where did the piece land?', if: EARLY, goto: 'where' },
            { text: 'I have it. Ossa gave it to me.', if: { has: 'splinter' }, goto: 'carry' }],
        },
        ship: {
          say: ['Did it now. Then it’s been busy, whatever it is: a falling light that sings, and breaks things.',
            'Up here they called it fireworks. Nobody asked the bottom what fell on them.'],
          choices: [{ text: 'Where did the piece land?', if: EARLY, goto: 'where' }, { text: 'I’ll take it up to the light.', if: { not: EARLY }, end: true }],
        },
        where: {
          say: ['At the bottom. Where else does anything land? The lower levels catch everything that falls off the top: soup, rain, rich men’s hats.',
            'Go down, all the way down, and ask for Ossa. She keeps the Upward Shrine. If a piece of the light fell on them, she’ll have it, and she’ll have opinions.',
            'Tell her Nima still sweeps. She’ll know what that means.'],
          do: { advance: [Q, 'nima'] },
          choices: [{ text: 'How do I get down?', goto: 'down' }, { text: 'I’ll go down.', end: true }],
        },
        down: {
          say: ['Down is easy: step off and glide, or take a cab. Up is the hard part. The cabs don’t stop below the smog. Not for anybody from down there.'],
          choices: [{ text: 'I’ll manage.', end: true }],
        },
        sweep: {
          say: ['For the steps. Steps don’t care who walks on them. The rich walk here, the palace guard walks here, I walk here. It all needs sweeping.',
            'My cousin Pell counts bones in a desert somewhere. Our family is good at small jobs that never end.'],
          choices: [{ text: 'What is the light?', goto: 'what' }, { text: 'Goodbye, Nima.', end: true }],
        },
        again: {
          say: ['Still here? The bottom terrace is a long way down: across the shaft, under the smog. Ask for Ossa at the Upward Shrine.'],
          choices: [
            { text: 'There’s a mark on the Incal’s lower facets.', goto: 'glyph', once: true },
            { text: 'On my way.', end: true },
          ],
        },
        glyph: {
          say: ['{glyph} You’ve sharp eyes. It’s cut on the lower facets, where only the bottom can see it.',
            'Up here it’s the palace seal; they stamp it on every cab licence. Down there they call it the Three Who Look Up: three heads over a hill. I like theirs better.'],
          choices: [{ text: 'Goodbye, Nima.', end: true }],
        },
        carry: {
          say: [{ if: { has: 'splinter' }, text: 'Is that it? It’s humming. It’s leaning up, like a plant at a window. Take it to the palace. The guard there is called Dov; he’s not as stiff as he stands.' },
            { if: { not: { has: 'splinter' } }, text: 'Up to the palace, then. The guard there is called Dov. He’s not as stiff as he stands.' }],
          choices: [{ text: 'What happened, the night the sky rang?', if: { not: { flag: 'incal.rumour.light' } }, goto: 'rang' }, { text: 'I will.', end: true }],
        },
        told: {
          say: ['I saw it. I was sweeping and the steps went gold. I looked up, and so did, oh, everyone. The rich, the guards, the cab drivers. A man dropped his whole lunch over the rail.',
            'What did you do, up there?'],
          choices: [
            { text: 'I gave it back its splinter. And I looked up at it.', goto: 'keep' },
            { text: 'Nothing much. I just looked.', goto: 'keep' },
          ],
        },
        keep: {
          say: ['That’s it, then. That’s the whole secret, and I’ve been sweeping it into every step for forty years.',
            'Here. It’s all I have to give, and it costs nothing: *look up once a day*. Wherever you are. Whatever is up there. Once a day.'],
          do: [{ advance: [Q, 'tell'] },
            { keepsake: { id: 'incal.word', level: 'incal', name: 'Look up once a day', kind: 'word', text: '“Look up once a day. Wherever you are, whatever is up there.” Nima, who sweeps the high terrace.' } }],
          choices: [{ text: 'I will, Nima.', end: true }],
        },
        after: { say: ['Once a day. Did you do it today? Don’t lie to me; I can tell.'], choices: [{ text: '(look up)', end: true }] },
      },
    },
  },

  ossa: {
    id: 'ossa', name: 'Ossa', title: 'keeper of the Upward Shrine', color: '#cdb38e', voice: 0.8, kind: 'f', scale: 0.96,
    palette: { cloak: '#8a6a4a', lining: '#2b211f', cloth: '#cdb38e', legs: '#3a3a3a', hat: '#d9c3a0', hair: '#e8dcc0' }, head: 'hood', cape: 1.4, look: { prop: 'lantern' },
    lines: ['Eyes shut, face up.', 'The smog stings. The light doesn’t.', 'Hum with it. It hums back.'],
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
          say: [{ if: { quest: Q, stage: 'ossa' }, text: 'Nima still sweeps? Ha. Then the top hasn’t swallowed everybody.' },
            { if: { not: { quest: Q, stage: 'ossa' } }, text: 'Somebody from the top, come down to look at the poor. Look, then; we’re very picturesque.' },
            'I’m Ossa. This is the Upward Shrine. We built it the morning after the sky rang, round the thing that came down singing into Behla’s laundry.'],
          choices: [
            { text: 'What came down?', goto: 'splinter' },
            { text: 'Why “Upward”?', goto: 'upward' },
            { text: 'What’s the mark on your floor?', goto: 'glyph', once: true },
          ],
        },
        upward: {
          say: ['Because everything down here faces up. Rain comes from up, soup comes from up, rich men’s hats. The light came from up too, once, before the smog got thick.',
            'We pray to it with our eyes shut, because the smog stings. Up at the top they keep their eyes open, and look at the adverts.'],
          choices: [{ text: 'What came down?', goto: 'splinter' }],
        },
        glyph: {
          say: ['{glyph} The Three Who Look Up. Three of us, over the hill of the world, looking up.',
            'Somebody at the top stamps it on cab licences and calls it a seal. Let them. It was ours first; it’s on the light’s underside, where only we can see it.', 'It’s on the blue star-box up on the rim, too, behind the villas. The palace calls it lost property. Down here we call it a promise: somebody is coming for it.'],
          choices: [{ text: 'What came down?', goto: 'splinter' }],
        },
        splinter: {
          say: ['A piece of the light. Look in the bowl. It still hums: put your ear to it. A long note, like wet glass.',
            'A trader from the swamp of lights came through once, with a crystal that sang. The same note. Exactly the same. I wrote it down; I’m not a fool.'],
          do: { set: { 'clue.incal.perdide': true } },
          choices: [{ text: 'The Incal is dimming. Nima thinks it’s because of this.', goto: 'why' }],
        },
        why: {
          say: ['Of course it’s dimming. A light nobody looks at goes out. Everybody down here knows that. We just can’t see it to look.',
            'And now a piece of it lies in our bowl and hums toward the top all night, like a dog at a door.'],
          choices: [{ text: 'Then let me carry it back up.', goto: 'give' }],
        },
        give: {
          say: ['Up. All the way up, to the palace, past the guards, who will want to know why somebody with soot on their boots is walking on their gold.',
            'Take it. And carry this up with it, from us: *we are still down here, and we are still looking.* Say it to the light, if lights hear. Say it to the guards, if they don’t.',
            'One more thing. To get back up you’ll want a cab, and the cabs don’t stop down here. Light the old call-lamp at the edge, if you can. One driver used to come.'],
          do: [{ give: 'splinter' }, { set: { 'incal.splinter.given': true } }, { start: 'incal.wren' }, { stage: [Q, 'palace'] }, { track: Q }],
          choices: [{ text: 'I’ll carry it up.', end: true }],
        },
        later: {
          say: ['It hums louder the higher you hold it. Go on. Up. Past the smog, past the gold.'],
          choices: [{ text: 'I’m going.', end: true }],
        },
        after: {
          say: ['Did you see it? The light came all the way down. All the way. I opened my eyes for it, and it didn’t sting.',
            'The smog’s still here. But now everybody knows where to look.'],
          choices: [{ text: 'Keep looking, Ossa.', end: true }],
        },
      },
    },
  },

  pip: {
    id: 'pip', name: 'Pip', title: 'who has seen the sky once', color: '#e6875f', voice: 1.65, kind: 'm', scale: 0.7,
    palette: { cloak: '#e6875f', lining: '#2b211f', cloth: '#5a4a3a', legs: '#3a3a3a', hat: '#d8a24a', hair: '#4a3226' }, head: 'hair', cape: 0.5,
    lines: ['Are you from the top?', 'I saw the sky once. Eleven seconds.', 'My uncle is a palace guard!'],
    talk: {
      entry: [
        { if: { quest: 'incal.ration', done: true }, node: 'after' },
        { if: LOOKED, node: 'lit' },
        { if: { has: 'ration' }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Are you from the top? Is it true it’s sunny every day? Is it true they grow trees on the ROOFS?',
            'My uncle Dov is a guard at the palace. Right at the very top. He never comes down. Mum says he’s ashamed of us. I think he’s just busy.'],
          choices: [
            { text: 'I’m going up to the palace.', if: { has: 'splinter' }, goto: 'take' },
            { text: 'Why doesn’t he come down?', goto: 'why' },
            { text: 'What’s it like, down here?', goto: 'here' },
          ],
        },
        why: {
          say: ['Mum says when you go up, you’re not allowed to be from down. You have to take it off, like a coat.'],
          choices: [{ text: 'I could take him something from you.', goto: 'take' }, { text: 'Bye, Pip.', end: true }],
        },
        take: {
          say: ['You would? Take him this! It’s a ration tin; Mum makes them. Smog-cabbage and the good bread. He used to eat three.',
            'Tell him it’s from Pip. Tell him I’m taller.'],
          do: [{ give: 'ration' }, { start: 'incal.ration' }],
          choices: [{ text: 'I’ll tell him.', end: true }],
        },
        here: {
          say: ['Wet. Green. My grandmother never saw the sky. I saw it once, through a hole in the smog, for eleven seconds. I counted.'],
          choices: [{ text: 'What did it look like?', goto: 'sky' }],
        },
        sky: { say: ['Blue, with a light in it. Ossa says it was THE light. I think so too.'], choices: [{ text: 'I could take something up to your uncle.', if: { quest: 'incal.ration', started: false }, goto: 'take' }, { text: 'Bye, Pip.', end: true }] },
        waiting: { say: ['Did you give it to him yet? He’s at the very top. With all the gold.'], choices: [{ text: 'Not yet.', end: true }] },
        lit: {
          say: ['I SAW IT! The light! Through the smog, all the way down, like somebody opened a door in the ceiling!', 'Twelve seconds this time. No: more. I stopped counting.'],
          choices: [{ text: 'I could take something up to your uncle.', if: { quest: 'incal.ration', started: false }, goto: 'take' }, { text: 'I saw it too.', end: true }],
        },
        after: { say: ['Uncle Dov sent a message down the cable! It says TELL PIP HE IS TALLER. I am!'], choices: [{ text: 'You are.', end: true }] },
      },
    },
  },

  dov: {
    id: 'dov', name: 'Dov', title: 'guard at the palace gate', color: '#f2c54b', voice: 0.85, kind: 'm', scale: 1.06,
    palette: { cloak: '#34405e', lining: '#f2c54b', cloth: '#f3ead8', legs: '#2b2f45', hat: '#f2c54b', hair: '#2b211f' }, head: 'hat', cape: 1.3, look: { body: 'collar', prop: 'staff' },
    lines: ['Keep to the ring.', 'Eyes on the visitors.', 'Palace rules.'],
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
          say: ['Halt. This is the palace landing. Visitors keep to the ring. Nobody goes up the dome, and nobody looks at the light. Palace rules.'],
          choices: [
            { text: 'Nobody looks at the light?', goto: 'rule' },
            { text: 'The night the sky rang: were you on duty?', goto: 'night', once: true },
            { text: 'Where are you from?', goto: 'from' },
            { text: 'Fine.', end: true },
          ],
        },
        rule: { say: ['It’s a light show. It’s for the people below. Guards keep their eyes on the visitors.', '(He keeps his eyes very carefully on you.)'], choices: [{ text: 'Where are you from?', goto: 'from' }, { text: 'Fine.', end: true }] },
        night: {
          say: ['I was. Night watch. It went over the palace close enough to touch: slow, ringing, as if the whole shaft were a bell and somebody had struck it.',
            'When it turned I saw a mark on its side: three dots over an arc, like the one cut under the light. {glyph} The palace says it was weather. I have never seen weather turn round.'],
          do: { set: { 'incal.rumour.light': true } },
          choices: [{ text: 'Where did it go?', goto: 'went' }],
        },
        went: { say: ['Over the rim, toward the dry country. Toward the deserts.'], choices: [{ text: 'That’s where my ship fell.', goto: 'fell' }] },
        fell: { say: ['Then you and the light have something in common: you both came down hard and kept going. Keep to the ring.'], choices: [{ text: 'Fine.', end: true }] },
        from: { say: ['Up here. Top level. Born on the gold.', '(He says it the way people say a word they’ve practised in a mirror.)'], choices: [{ text: 'Fine.', end: true }] },
        splinter: {
          say: ['Wait. What is that you’re— I can hear it. That note. It used to come up through the floor of our flat all night, when I was small.',
            'That’s from the bottom. That’s the thing that fell into Behla’s laundry. You’ve carried it all the way up.',
            'Go on. Up the dome, to the crown, under the light. I didn’t see you. I’m looking at the visitors.'],
          do: [{ advance: [Q, 'palace'] }, { set: { 'incal.dov.allowed': true } }],
          choices: [{ text: 'You’re from the bottom.', goto: 'caught' }, { text: 'Thank you, Dov.', end: true }],
        },
        caught: {
          say: ['…Minus two-nine-zero. Stall nineteen, above the cabbage man. Don’t tell anyone up here. Go on, up. Before I remember the rules.'],
          choices: [{ text: 'I won’t tell.', end: true }],
        },
        allowed: { say: ['I didn’t see you. Up the dome, to the crown. Jetpack’s quicker than the stairs; there aren’t any stairs.'], choices: [{ text: '(go up)', end: true }] },
        ration: {
          say: ['Is that… that’s a smog-cabbage tin. That’s my sister’s handwriting on the lid.',
            'From Pip? He says he’s taller? Of course he’s taller. It’s been eleven years.'],
          do: [{ take: 'ration' }, { advance: 'incal.ration' }, { set: { 'incal.dov.fed': true } }],
          next: 'ration2',
        },
        ration2: {
          say: ['(He eats it standing up, at his post, with his eyes shut.)',
            'Here. Take this. A token for the old cable lift, bottom to top and back. I kept it eleven years to go home with. Never used it. You use it for me: go and look at something.'],
          do: { keepsake: { id: 'incal.token', level: 'incal', name: 'Dov’s lift token', kind: 'thing', text: 'A brass lift token, bottom to top, worn smooth in a palace guard’s pocket. Kept eleven years for the trip home; never spent.' } },
          choices: [{ text: 'Thank you, Dov.', end: true }],
        },
        lit: {
          say: ['I looked up. On duty. In front of the visitors. They’ll have me on night watch for a year.', 'Worth it.'],
          choices: [{ text: 'Was it?', goto: 'worth' }, { text: 'Goodbye, Dov.', end: true }],
        },
        worth: { say: ['From down there you see the underside of everything. From up here, you don’t see down at all. For a minute today everyone saw the same thing. Yes. Worth it.'], choices: [{ text: 'Goodbye, Dov.', end: true }] },
      },
    },
  },

  wren: {
    id: 'wren', name: 'Wren', title: 'the driver who still stops', color: '#f2c54b', voice: 1.1, kind: 'f',
    palette: { cloak: '#f2c54b', lining: '#34405e', cloth: '#34405e', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'hat', cape: 0.5,
    lines: ['Need a lift?', 'Space to climb, Shift to drop.', 'Mind the laundry.'],
    talk: {
      entry: [{ if: { quest: 'incal.wren', done: true }, node: 'after' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['Somebody lit the lamp. Somebody actually lit the lamp. I saw it from the ninth lane and nearly flew into a laundry line.',
            'Wren. I drive. I stop for anyone who lights that lamp. Nobody has, in eleven years, because everybody down here knows the cabs don’t stop.'],
          choices: [{ text: 'Why do you stop?', goto: 'why' }, { text: 'I need to get to the top.', goto: 'ride' }],
        },
        why: {
          say: ['Because I was born on minus two-nine-zero, and the night I was born a driver stopped for my mother and flew her up to a doctor. Free.',
            'You don’t pay a thing like that back. You pass it along.'],
          choices: [{ text: 'Did you see the singing light?', goto: 'light', once: true }, { text: 'I need to get to the top.', goto: 'ride' }],
        },
        light: {
          say: ['I was flying under it. It came over the rim slow and low, singing, and then it turned, like it was looking for something. My compass spun for an hour.',
            'Then it went off over the rim toward the deserts, and the shaft went quiet, and the light above the palace was dimmer. That’s all I know. It’s more than most.'],
          do: { set: { 'incal.rumour.light': true } },
          choices: [{ text: 'I need to get to the top.', goto: 'ride' }],
        },
        ride: {
          say: ['Take her, then. She knows the way home: leave her anywhere and she’ll come back to this lamp. W to go, Space to climb, Shift to drop. Mind the laundry.',
            'The palace? Straight up the middle, past the rings, and set her down on the landing by the gate. The guards hate that. Do it anyway.',
            'And if you hail a cab down here, it’ll be me. Nobody else is coming.'],
          do: [{ advance: ['incal.wren', 'wren'] }, { set: { 'incal.wren.met': true } }],
          choices: [{ text: 'Thank you, Wren.', end: true }],
        },
        after: { say: ['Lamp’s lit, the lane’s quiet. You want a lift, you know where I stop.'], choices: [{ text: 'Thanks, Wren.', end: true }] },
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
          say: ['Admiring the view? Everybody does, the first day. Then you stop seeing it. That’s how you know you live here.', 'Corvin Sale. Of the rim. Third generation.'],
          choices: [{ text: 'What is the light above the palace?', goto: 'incal' }, { text: 'What’s down there?', goto: 'down' }, { text: 'What’s that mark on the cabs?', goto: 'glyph', once: true }, { text: 'Goodbye.', end: true }],
        },
        incal: { say: ['The Incal? A light show. A story for tourists, and for the lower levels, who need stories. The palace pays for it out of the taxi tax.', 'Dimming, is it? Then the palace is economising. Good.'], choices: [{ text: 'What’s down there?', goto: 'down' }, { text: 'Goodbye.', end: true }] },
        down: { say: ['Level minus eighty-six? I’ve never been below the smog. Why would I? Everything I need comes up.'], choices: [{ text: 'Goodbye.', end: true }] },
        glyph: { say: ['{glyph} The palace seal. It’s on every cab licence, every permit, every gate. It means *approved*.'], choices: [{ text: 'Goodbye.', end: true }] },
        lit: { say: ['I looked up. I didn’t mean to. Everybody did; it would have been rude not to.', 'Don’t tell anyone I said it was beautiful.'], choices: [{ text: 'Your secret is safe.', end: true }] },
      },
    },
  },
  lio: {
    id: 'lio', name: 'Lio', title: 'cab dispatcher', color: '#62c3c9', head: 'hat', cape: 0,
    talk: {
      nodes: {
        hello: {
          say: ['Mind the taxis. They don’t stop. Well: up here they stop for you. You’ve got the face for it.', 'I dispatch. Every lane, every cab, every fare. Nine hundred cabs, and not one of them stops below the smog.'],
          choices: [{ text: 'Why not?', goto: 'why' }, { text: 'Seen anything strange lately?', goto: 'strange' }, { text: 'Goodbye.', end: true }],
        },
        why: { say: ['No fares down there. Well, no fares that pay. There’s a story about one driver who still stops at the bottom, if you light the old lamp. Wren, they call her. Drivers tell it to each other to feel bad.'], choices: [{ text: 'Goodbye.', end: true }] },
        strange: { say: ['The night the sky rang, every cab in the shaft lost its compass at once. Nine hundred cabs, spinning like leaves in a drain. I haven’t slept properly since.'], do: { set: { 'incal.rumour.light': true } }, choices: [{ text: 'Goodbye.', end: true }] },
      },
    },
  },
  hask: {
    id: 'hask', name: 'Hask', title: 'seller of views', color: '#f2c54b', head: 'hair', cape: 0,
    talk: {
      nodes: {
        hello: {
          say: ['Views of the abyss! Cheap! You stand here, you look down, you pay me.', 'You looked up. Nobody looks up. Up is free; I can’t sell up.'],
          choices: [{ text: 'What can you see from here?', goto: 'see' }, { text: 'Goodbye.', end: true }],
        },
        see: { say: ['Nine levels. Eleven if you count the smog and the lake. The rich at the top, the poor at the bottom, and a light in the middle of the sky that nobody pays for, so nobody looks at it.'], choices: [{ text: 'Goodbye.', end: true }] },
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
          say: ['A brass bowl, held up on a stone post. In it lies a splinter of light as long as your hand, faceted like the Incal far above, and cut with the mark: {glyph}',
            'It hums: a long note, like wet glass. And it leans, very slightly, toward the top of the shaft.'],
          choices: [{ text: '(step back)', end: true }],
        },
        empty: { say: ['The bowl is empty. Someone has put a candle in it, and it burns straight up.'], choices: [{ text: '(step back)', end: true }] },
      },
    },
  },
  lamp: {
    id: 'lamp', name: 'The call-lamp', title: 'at the edge', color: '#5d574b', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'incal.lamp.lit' }, node: 'lit' }, { node: 'dark' }],
      nodes: {
        dark: {
          say: ['An old taxi call-lamp on a post at the edge of the terrace: TAXI, in flaking letters. The glass is dark and full of dead moths.',
            'Lit, it would show from every lane in the shaft. (*Shoot* it with the fluid: aim, then G or left click.)'],
          choices: [{ text: '(step back)', end: true }],
        },
        lit: { say: ['The call-lamp burns yellow over the void, and every lane in the shaft can see it.'], choices: [{ text: '(step back)', end: true }] },
      },
    },
  },
};

// What crowd people say when you stop beside them (balloons), by where they live.
export const LINES = {
  rim: ['Lovely day for looking down.', 'Mind the edge, it’s a long way down.', 'The Incal? A light show.', 'Have you been to the palace? Neither have I.', 'Taxi! Oh. Not you.', 'Laundry? Up here? Never.'],
  upper: ['Laundry dries fast up here.', 'The light? The tourists like it.', 'I never go below the smog.', 'Mind the edge.', 'Fresh figs! Fresh figs!', 'The taxis stop for us. Naturally.'],
  middle: ['Busy day.', 'Excuse me.', 'Up a level, down a level, that’s my life.', 'Have you seen the light above the palace?', 'Mind the cables.'],
  lower: ['The taxis never stop for us lower folk.', 'My grandmother never saw the sky.', 'We pray with our eyes shut. The smog stings.', 'A piece of the light fell down here, you know.', 'Hum with it. It hums back.', 'Up. Everything good is up.'],
  carrying: ['It hums! You’ve got it!', 'Is that the light?', 'Take it up! Take it home!', 'Hold it higher!'],
  lit: {
    rim: ['Did you see that?', 'The palace has outdone itself.', 'I looked up. Did you?', 'It throws shadows again!'],
    upper: ['Look at it!', 'It’s so bright!', 'I’d forgotten it did that.', 'Look up, everyone!'],
    middle: ['Look up! Look!', 'It reaches all the way down!', 'I can see my own shadow!'],
    lower: ['It sees us!', 'Light! Down here!', 'Open your eyes, it doesn’t sting!', 'The Three Who Look Up!', 'We’re still down here!'],
  },
  shout: ['Look! Look up!', 'The light!', 'Up there!', 'It’s burning again!'],
};

const bye = { text: 'Goodbye.', end: true };
/** Short conversations for people in the crowd, by where they live. Picked by their seed. */
export const CROWD_TALK = {
  rim: [
    { name: 'A rim resident', title: 'taking the air', talk: { nodes: {
      hello: { say: ['The Incal? My dear, it’s a light show. The palace switches it on for the tourists.'], choices: [{ text: 'It’s dimming.', goto: 'dim' }, bye] },
      dim: { say: ['Is it? I hadn’t looked. One doesn’t, really.'], choices: [bye] },
    } } },
    { name: 'A tourist', title: 'from off-world', talk: { nodes: {
      hello: { say: ['I came all this way to see the Incal and, honestly? It’s smaller than on the postcards. And sort of grey.'], choices: [bye] },
    } } },
  ],
  upper: [
    { name: 'A roof gardener', title: 'of the high terraces', talk: { nodes: {
      hello: { say: ['We grow lemons on the roofs up here. The trick is never to look down. The lemons get nervous.'], choices: [bye] },
    } } },
    { name: 'A flower seller', title: 'of the high terraces', talk: { nodes: {
      hello: { say: ['The light? I remember it brighter. But everybody remembers everything brighter.'], choices: [{ text: 'The night the sky rang?', goto: 'rang' }, bye] },
      rang: { say: ['Oh, that. Every glass vase on my stall sang at once, and six of them broke. Fireworks, the palace said. Fireworks don’t sing.'], choices: [bye] },
    } } },
  ],
  middle: [
    { name: 'A cable mender', title: 'between the levels', talk: { nodes: {
      hello: { say: ['I mend the cables between the levels. Up a level, down a level. Nobody is from the middle; we’re all just passing through.'], choices: [bye] },
    } } },
    { name: 'A commuter', title: 'in a hurry', talk: { nodes: {
      hello: { say: ['The light? I see it every morning on my way up and every night on my way down. I couldn’t tell you what colour it is.'], choices: [bye] },
    } } },
  ],
  lower: [
    { name: 'A worshipper', title: 'of the bottom terraces', talk: { nodes: {
      hello: { say: ['Shh. We’re praying. Eyes shut, face up. The smog stings, but the light can still feel you looking.'], choices: [{ text: 'Why with your eyes shut?', goto: 'why' }, bye] },
      why: { say: ['You try keeping them open down here.'], choices: [bye] },
    } } },
    { name: 'A laundry hanger', title: 'of the bottom terraces', talk: { nodes: {
      hello: { say: ['Behla’s laundry caught the light when it fell. A splinter of god, in her vests. She’s been insufferable ever since.'], choices: [bye] },
    } } },
    { name: 'A child', title: 'who wants to go up', talk: { nodes: {
      hello: { say: ['Have you been to the top? Is it true there’s a sun up there every day? Every single day?'], choices: [{ text: 'Every day.', goto: 'yes' }, bye] },
      yes: { say: ['I’m going to go. When I’m big. I’m going to stand right under it and look.'], choices: [bye] },
    } } },
  ],
  lit: [
    { name: 'Someone looking up', title: 'with everyone else', talk: { nodes: {
      hello: { say: ['Look at it. I’d forgotten. I’d actually forgotten it could do that.'], choices: [{ text: 'Look up once a day.', goto: 'once' }, bye] },
      once: { say: ['Once a day. Yes. I could manage once a day.'], choices: [bye] },
    } } },
    { name: 'Someone from the bottom', title: 'eyes wide open', talk: { nodes: {
      hello: { say: ['You took it up? You did? I opened my eyes. I opened my eyes, and it didn’t sting.'], choices: [bye] },
    } } },
  ],
};
