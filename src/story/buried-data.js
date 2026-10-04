// The Buried Machine's story as data: "One Tooth a Year" (docs/story-bible.md).
//
// Under the dunes a great wheel turns one tooth a year, and the dome people
// count their lives by it: Wen is forty-one teeth old, Pim is nine. The wheel
// turns when the Wick, the oil lamp at the bottom of the oculus, is lit, and
// every Tooth Day old Hask goes down the canyon to light it. This year he
// hasn't: a "Tuning Star" (the singing light) came over the canyon, humming
// the wheel's own note, and he is afraid it was looking for the wheel.
// Go down for him: shove the oil valve open, splash the wick alight (the
// oil-light adds an amber band to the tank), climb back out and watch the
// wheel turn one tooth. The hanging city above, "the Other Half", rocks like
// a cradle and every chimney on the dunes breathes out. The wheel sheds a
// sliver of the tooth that turned; Wen gives it to you to keep.
//
// The glyph is "the Maker's Thumb" here, pressed into every plate and gauge.
// The Major himself (a man in a tall helmet) once came down to see the wheel,
// left numbers on the drum wall and went back up very quiet (the Garage's
// note led him here, and leads you; tell the wheel the Garage is still turning). Conversations: src/story/dialogue.js; quests:
// src/story/quests.js. Flags (game-state.js): buried.* below.

const Q = 'buried.tooth';

export const ITEMS = { tooth: 'a warm gear tooth', key: 'Dun’s chimney key' };
export const AMBER = '#e9a53c';
export const KEEPSAKE = { id: 'buried.thing', level: 'buried', name: 'A rust gear tooth', kind: 'thing', text: 'Warm to the touch: a sliver of the tooth the great wheel turned the year you were there. The dome people would say you are one tooth old.' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'One Tooth a Year', world: 'buried', main: true,
    outro: 'The wheel turned one tooth. You were there.',
    stages: [
      { id: 'wen', text: 'Meet the dome people. Wen, who counts the teeth, lives in the great dome', label: 'Wen, by the great dome', flag: 'buried.wen.heard', at: 'wen' },
      { id: 'hask', text: 'Ask Hask, keeper of the Wick, why he hasn’t gone down this year', label: 'Hask, on his bench', flag: 'buried.hask.asked', at: 'hask' },
      { id: 'down', text: 'Go down the sand ramp into the rust canyon', label: 'The rust canyon', flag: 'buried.canyon.seen', at: 'canyon' },
      { id: 'oculus', text: 'Follow the canyon through the two oval doors to the oculus', label: 'The oculus', flag: 'buried.oculus.seen', at: 'oculus' },
      { id: 'valve', text: 'The Wick’s oil valve is rusted fast. Shove it open (push)', label: 'The oil valve', flag: 'buried.valve.open', at: 'valve' },
      { id: 'light', text: 'Give the Wick a spark: a shot of fluid', label: 'The Wick', flag: 'buried.oculus.lit', at: 'wick' },
      { id: 'watch', text: 'Climb back out and watch the great wheel', label: 'The great wheel', flag: 'buried.wheel.turned', at: 'watch' },
      { id: 'tooth', text: 'Something fell from the wheel when it turned. Pick it up', label: 'At the wheel’s foot', flag: 'buried.tooth.found', at: 'tooth' },
      { id: 'count', text: 'Bring the tooth to Wen to be counted', label: 'Wen, by the great dome', bring: 'tooth', to: 'wen' },
    ],
  },
  {
    id: 'buried.key', title: 'The Keeper’s Key', world: 'buried',
    outro: 'Every chimney on the dunes is open.',
    stages: [
      { id: 'find', text: 'Dun hung his key on the crane hook of the floating derrick, east of the domes', label: 'The derrick’s crane hook', bring: 'key', at: 'key', to: 'dun' },
      { id: 'return', text: 'Bring the key back to Dun', label: 'Dun, by his chimneys', bring: 'key', to: 'dun' },
    ],
  },
  {
    id: 'buried.gauges', title: 'A Year’s Breath', world: 'buried',
    outro: 'Ninety, ninety-one, ninety. Ossa says it is enough.',
    stages: [
      { id: 'read', text: 'Read the three pressure gauges along the canyon floor: splash each dial (shoot)', label: 'A pressure gauge', flag: 'buried.gauges.read', at: 'gauge' },
      { id: 'tell', text: 'Tell Ossa what the gauges say', label: 'Ossa, by the ledge', talk: 'ossa', at: 'ossa' },
    ],
  },
  {
    id: 'buried.window', title: 'The Warm Window', world: 'buried',
    outro: 'It is warm, like a hand.',
    stages: [
      { id: 'climb', text: 'Climb to the porthole on the oculus balcony and lay your hand on it', label: 'The warm window', flag: 'buried.window.touched', at: 'window' },
    ],
  },
];

// ------------------------------------------------------------------ the people
// palettes: cloak / lining / cloth / legs / hat / hair (buildCharacter + Humanoid)
export const PEOPLE = {
  wen: {
    id: 'wen', name: 'Wen', title: 'who counts the teeth', color: '#e8b896', voice: 1.0, kind: 'f',
    palette: { cloak: '#e8b896', lining: '#2b211f', cloth: '#5f7488', legs: '#3a3a3a', hat: '#f3ead2', hair: '#3d2a22' }, head: 'wrap', cape: 1.1,
    lines: ['Tooth Day. Mind the sand.', 'Forty-one teeth, and every one counted.', 'Watch the city when it turns.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { has: 'tooth' }, node: 'count' },
        { if: { flag: 'buried.wheel.turned' }, node: 'turned' },
        { if: { flag: 'buried.oculus.lit' }, node: 'lit' },
        { if: { flag: 'buried.wen.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['You came down out of the sky in a round thing. Sit, if you like sand. I’m Wen. I count the teeth.', 'Today is Tooth Day. Once a year the great wheel turns one tooth, and we count our lives by it. I’m forty-one teeth old. Pim over there is nine. The wheel is older than counting.'],
          choices: [
            { text: 'What wheel?', goto: 'wheel' },
            { text: 'You count your age in teeth?', goto: 'count0' },
            { text: 'I’m looking for something of value.', goto: 'value' },
          ],
        },
        wheel: {
          say: ['There, east of the domes, breaking the sand. That’s only the top of it. The rest goes down further than anyone has ever dug.', 'Once a year it turns one tooth, and when it does the domes breathe out and the city up there rocks like a cradle.'],
          choices: [{ text: 'And it turns today?', goto: 'today' }, { text: 'The city up there?', goto: 'city' }],
        },
        count0: {
          say: ['Every year the wheel sheds a sliver of the tooth that turned. We keep them, one for every year we’ve lived, on a string.', 'Mine is getting heavy. Hask’s is so heavy he wears it as a belt.'],
          choices: [{ text: 'And the wheel turns today?', goto: 'today' }],
        },
        value: {
          say: ['Value? Here we say a thing is worth the years it stood still for.', 'The wheel is worth a great deal, then. So is Hask, though don’t tell him I said so.'],
          choices: [{ text: 'Tell me about the wheel.', goto: 'wheel' }],
        },
        city: {
          say: ['The Other Half. The wheel holds it up and it holds the wheel down, my mother said.', 'When the last tooth has turned, the city will come down and sit on the wheel, and the year will be whole. Not for a long while. There are a great many teeth.'],
          choices: [{ text: 'And the wheel turns today?', goto: 'today' }],
        },
        today: {
          say: ['It should. But the wheel won’t turn in the dark. Every Tooth Day, Hask goes down into the canyon and lights the Wick, the lamp at the bottom of the oculus. The wheel feels it, and turns.', 'This year Hask hasn’t gone down. He won’t tell me why. Ask him; he might tell a stranger.'],
          do: { set: { 'buried.wen.heard': true } },
          choices: [{ text: 'Where is Hask?', goto: 'where' }, { text: 'I’ll talk to him.', end: true }],
        },
        where: { say: ['On the bench by his dome, just west of mine, staring at nothing. Since the night the sky rang he stares at nothing. It isn’t like him; he used to stare at people.'], choices: [{ text: 'I’ll go.', end: true }] },
        again: {
          say: [
            { if: { flag: 'buried.hask.asked' }, text: 'Hask told you? The ramp is south of the domes, where the pipes go under. Go carefully. The day is getting on.' },
            { if: { not: { flag: 'buried.hask.asked' } }, text: 'Has Hask said anything? His bench is just west of here. If the wheel doesn’t turn today I don’t know what I’ll count.' },
          ],
          choices: [
            { text: 'What’s the mark on your door?', goto: 'mark', once: true },
            { text: 'Tell me about the city up there.', goto: 'city' },
            { text: 'See you, Wen.', end: true },
          ],
        },
        mark: { say: ['{glyph} The Maker’s Thumb. It’s on every plate and pipe that comes up out of the sand. We paint it on our doors so the machine knows which domes are ours.'], choices: [{ text: 'Does it work?', goto: 'works' }] },
        works: { say: ['The machine has never once come to the wrong door. So yes.'], choices: [{ text: 'See you, Wen.', end: true }] },
        lit: {
          say: ['I felt it in my feet! The Wick is lit. Go, stand in front of the wheel. It turns better when someone is watching. Everyone says so; nobody knows why.'],
          choices: [{ text: 'I’m going.', end: true }],
        },
        turned: { say: ['Did you see it? The whole city swung! And it dropped something for you, I’d bet. It always drops a sliver by its feet. Go and look.'], choices: [{ text: 'I’ll look.', end: true }] },
        count: {
          say: ['You picked it up. It came off the wheel when it turned, didn’t it? Warm. They’re always warm.', 'Look: my string. Forty-one. Forty-two, now. Pim is ten, and furious about it, because now he has to carry water.', 'You were here the year it turned, so that one is yours. Don’t put it on a string. Just keep it.'],
          do: [{ advance: [Q, 'count'] }, { keepsake: KEEPSAKE }],
          next: 'given',
        },
        given: { say: ['There. Now I have to say you’re one tooth old. Welcome to the dunes, little one.'], choices: [{ text: 'Thank you, Wen.', end: true }] },
        after: { say: ['One tooth old! Come back when you’re two. The wheel will wait. It’s good at that.'], choices: [{ text: 'I will.', end: true }] },
      },
    },
  },

  hask: {
    id: 'hask', name: 'Hask', title: 'keeper of the Wick', color: '#7f93a3', voice: 0.7, kind: 'm', scale: 0.96,
    palette: { cloak: '#7f93a3', lining: '#2b211f', cloth: '#c8643f', legs: '#4a3a2a', hat: '#e9dcc0', hair: '#e8dcc0' }, head: 'hat', cape: 1.3,
    lines: ['Mm.', 'Fifty-two Tooth Days.', '(he watches the sky)'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'buried.oculus.lit' }, node: 'felt' },
        { if: { flag: 'buried.hask.asked' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Mm. The sky-child. Wen sent you.', 'I’m Hask. I keep the Wick, the lamp at the bottom of the oculus. Fifty-two Tooth Days I’ve gone down the ramp and lit it, and fifty-two times the wheel has turned.'],
          choices: [
            { text: 'Why not this year?', goto: 'why' },
            { text: 'What is the oculus?', goto: 'oculus' },
          ],
        },
        oculus: { say: ['A drum as big as a hill, at the end of the canyon, with no lid. The sky looks into it. The Wick stands in the middle, and on the balcony there’s a window that’s always warm.'], choices: [{ text: 'Why haven’t you gone down this year?', goto: 'why' }] },
        why: {
          say: ['Because of the night the sky rang. A light came over the dunes, low, humming. The same note the wheel hums in its sleep. We call that kind of thing a Tuning Star; my grandmother saw one once, and never said what it wanted.', 'It turned over the canyon, slow, like it was looking for something. Then it went on south. The next night your ship came down.', 'I’m not afraid of a light. I’m afraid it was looking for the wheel. If I light the Wick, maybe it comes back to see what woke.'],
          do: { set: { 'buried.rumour.light': true } },
          choices: [{ text: 'It struck my ship.', goto: 'struck' }, { text: 'Then let me light it.', goto: 'light' }],
        },
        struck: { say: ['Struck it? Then it found what it was looking for, and it wasn’t us. That’s a comfort to me and none to you. I’m sorry, child.'], choices: [{ text: 'Let me light the Wick.', goto: 'light' }] },
        light: {
          say: ['Will you? It isn’t hard. My knees made it hard. Go down the sand ramp, south of the domes, into the rust canyon. Follow it through the two oval doors to the oculus.', 'The Wick is in the middle. The oil valve beside it sticks; I used to kick it. You have that thing on your back that shoves. Shove the valve, the oil comes up, then give the wick a spark.'],
          do: { set: { 'buried.hask.asked': true } },
          choices: [{ text: 'A spark?', goto: 'spark' }, { text: 'I’ll go.', end: true }],
        },
        spark: { say: ['Anything bright. Your fluid’s bright enough, I’d think. Splash it. Then come up and watch, don’t stay down there. The wheel likes to be watched.'], choices: [{ text: 'I’ll go.', end: true }] },
        again: {
          say: ['Down the ramp, through the two oval doors. Shove the valve, splash the wick. Then come up and watch.'],
          choices: [
            { text: 'What is the mark on everything here?', goto: 'thumb', once: true },
            { text: 'I’m going.', end: true },
          ],
        },
        thumb: {
          say: ['Three dots over a curve. {glyph} The Maker’s Thumb. Whoever built the wheel pressed their thumb into the iron while it was soft, three times, and dragged it once. It’s on every plate, every gauge.', 'Wen says it’s burned into your ship, too. Did the Maker build your ship, child?'],
          do: { set: { 'clue.buried.mark': true } },
          choices: [{ text: 'No. Something hit it.', goto: 'hit' }, { text: 'I don’t know.', goto: 'hit' }],
        },
        hit: { say: ['Then someone signs their work, and someone else signs their damage, with the same hand. Hm. Go light the Wick. I’ve had enough thinking for a Tooth Day.'], choices: [{ text: 'I’m going.', end: true }] },
        felt: {
          say: [{ if: { flag: 'buried.wheel.turned' }, text: 'It turned. I felt the bench move. Fifty-three. And nothing came back for it.' }, { if: { not: { flag: 'buried.wheel.turned' } }, text: 'I felt it from here. The Wick is lit. Go up and stand in front of the wheel, child. I’ve seen it fifty-two times; you haven’t.' }],
          choices: [{ text: 'Did the light come back?', goto: 'back' }, { text: 'Goodbye, Hask.', end: true }],
        },
        back: { say: ['No. Just sky. Next year I’ll go down myself. Probably.'], choices: [{ text: 'Goodbye, Hask.', end: true }] },
        after: { say: ['Next Tooth Day the Wick is mine again. You can come and watch. Bring your own sand.'], choices: [{ text: 'I’d like that.', end: true }] },
      },
    },
  },

  dun: {
    id: 'dun', name: 'Dun', title: 'who keeps the domes breathing', color: '#c8643f', voice: 1.15, kind: 'm',
    palette: { cloak: '#c8643f', lining: '#2b211f', cloth: '#34405e', legs: '#3a3a3a', hat: '#5f7488', hair: '#2b211f' }, head: 'hood', cape: 0.6,
    lines: ['Mind the sand on my chimneys!', 'Every dome has to breathe on Tooth Day.', 'Up there. Up there!'],
    talk: {
      entry: [
        { if: { quest: 'buried.key', done: true }, node: 'after' },
        { if: { has: 'key' }, node: 'back' },
        { if: { quest: 'buried.key', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Mind the sand on my chim… oh. It’s you. The sky-person. I’m Dun. I keep the domes breathing.', 'When the wheel turns, the air in the deep pipes comes up, and every chimney on the dunes has to be open to let it out, or the domes cough for a year. I open them with my key. Which is up there.'],
          choices: [{ text: 'Up where?', goto: 'up' }, { text: 'What happens if they cough?', goto: 'cough' }],
        },
        cough: { say: ['Soot on the beds. Soot in the soup. Soot in Wen’s hair, and then I hear about it until the next Tooth Day.'], choices: [{ text: 'Where’s your key?', goto: 'up' }] },
        up: {
          say: ['On the crane hook of the floating derrick, east of here. You see it, hanging in the air like it forgot to fall.', 'The night the sky rang I climbed it to watch the light go over. I hung my key on the hook so I wouldn’t drop it. Then I saw the light, and forgot I had hands. Climbed down shaking. Left the key.'],
          choices: [
            { text: 'I’ll fetch it.', do: { start: 'buried.key' }, goto: 'thanks' },
            { text: 'What did the light look like?', goto: 'light' },
          ],
        },
        light: { say: ['Like a note, if you can see a note. Low and humming, the wheel’s note, and it turned over the canyon as if it heard something and went south. I’d rather not see it twice.'], choices: [{ text: 'I’ll fetch your key.', do: { start: 'buried.key' }, goto: 'thanks' }] },
        thanks: { say: ['Would you? Thirty metres up and floating. You have a jet on your back. I have a fear of heights I didn’t know about until that night.'], choices: [{ text: 'Back soon.', end: true }] },
        waiting: { say: ['The floating derrick, east. The key’s on the crane hook, the end of the long arm. Don’t look down. That’s my advice, and I didn’t take it.'], choices: [{ text: 'On my way.', end: true }] },
        back: {
          say: ['My key! Sand in the teeth and all. Stand back.', '(He climbs his dome, turns the key in the chimney, and slides down another, and another. Somewhere, a chimney whistles.)'],
          do: [{ take: 'key' }, { advance: 'buried.key' }, { set: { 'buried.chimneys.open': true } }],
          next: 'opened',
        },
        opened: { say: ['Every chimney on the dunes is open. When the wheel turns you’ll see the domes breathe out. You saved me the climb, and the embarrassment, which was worse.'], choices: [{ text: 'Happy Tooth Day, Dun.', end: true }] },
        after: { say: ['Hear that whistle? That’s a happy chimney.'], choices: [{ text: 'It sounds happy.', end: true }] },
      },
    },
  },

  pim: {
    id: 'pim', name: 'Pim', title: 'nine teeth old', color: '#e9c9a8', voice: 1.7, kind: 'm', scale: 0.72,
    palette: { cloak: '#e9c9a8', lining: '#2b211f', cloth: '#5f7488', legs: '#3a3a3a', hat: '#c8643f', hair: '#4a3226' }, head: 'hair', cape: 0.4,
    lines: ['The domes are only the chimneys. The machine is all underneath.', 'Follow the sand slope down. The canyon walls are pipes, not stone.', 'I’m nine teeth old!'],
    talk: {
      entry: [{ if: { quest: Q, done: true }, node: 'ten' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['Are you a person? You came out of a ball. I’m Pim. I’m nine teeth old.', 'If the wheel turns today I’ll be ten teeth. Wen says it might not. If it doesn’t I’ll be nine forever.'],
          choices: [
            { text: 'Is nine so bad?', goto: 'nine' },
            { text: 'What’s that, up in the sky?', goto: 'city' },
            { text: 'Seen anything strange lately?', goto: 'strange' },
          ],
        },
        nine: { say: ['Nine is fine. But ten-year-olds are allowed down the ramp. The canyon walls are pipes, not stone; you can put your ear on them and hear the machine thinking.'], choices: [{ text: 'What’s up in the sky?', goto: 'city' }, { text: 'Bye, Pim.', end: true }] },
        city: { say: ['The Other Half. When the wheel turns, it rocks. I watch from my roof. Last year a whole tower swung like a bell, and nobody heard anything, because it’s too high to hear.'], choices: [{ text: 'Seen anything strange?', goto: 'strange' }, { text: 'Bye, Pim.', end: true }] },
        strange: { say: ['Hask. Hask is strange now. He used to tell stories and now he just watches the sky. And Dun’s key is stuck up on the floating derrick, everyone knows, but he says it isn’t.'], choices: [{ text: 'Bye, Pim.', end: true }] },
        ten: { say: ['I’m TEN. I’m ten teeth! Wen says you’re only one. So I’m older than you, and you have to do what I say.'], choices: [{ text: 'What do you say?', goto: 'say' }] },
        say: { say: ['Come back next year so I can be eleven in front of you.'], choices: [{ text: 'Deal.', end: true }] },
      },
    },
  },

  ossa: {
    id: 'ossa', name: 'Ossa', title: 'who listens to the walls', color: '#7f93a3', voice: 0.9, kind: 'f',
    palette: { cloak: '#7f93a3', lining: '#2b211f', cloth: '#c8643f', legs: '#2b2f45', hat: '#d8dcc8', hair: '#2b211f' }, head: 'hood', cape: 1.2,
    lines: ['Listen. The walls are still warm.', 'Past the oval doors there is a room with no ceiling.', 'Shh.'],
    talk: {
      entry: [
        { if: { quest: 'buried.gauges', done: true }, node: 'after' },
        { if: { flag: 'buried.gauges.read' }, node: 'tell' },
        { if: { quest: 'buried.gauges', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Shh. Listen. The walls are warm. They’re warm every Tooth Day: the pressure comes up from below.', 'I’m Ossa. I listen to the walls. Most days they say nothing. Today they’re talking.'],
          choices: [
            { text: 'What do they say?', goto: 'say' },
            { text: 'Where does the canyon lead?', goto: 'lead' },
          ],
        },
        lead: { say: ['Through two oval doors to a room with no ceiling: the oculus. The Wick stands in it. If you’re going there, you’re doing Hask’s walk.'], choices: [{ text: 'What do the walls say?', goto: 'say' }] },
        say: {
          say: ['That they’re full. But I can’t read the gauges any more. The needles stick, and I can’t reach to knock them.', 'There are three, on posts along the canyon floor: one on the ramp, one past this ledge, one between the oval doors.'],
          choices: [
            { text: 'I’ll read them for you.', do: { start: 'buried.gauges' }, goto: 'how' },
            { text: 'Maybe later.', end: true },
          ],
        },
        how: { say: ['Give each dial a splash from your hand there, a sharp one. If there’s anything behind the needle, it’ll jump.'], choices: [{ text: 'Back soon.', end: true }] },
        waiting: {
          say: [
            { if: { flag: 'buried.gauge.0' }, text: 'The one on the ramp reads ninety. Good.' },
            { if: { flag: 'buried.gauge.1' }, text: 'The one past the ledge, ninety-one. Better than good.' },
            { if: { flag: 'buried.gauge.2' }, text: 'The one between the doors, ninety.' },
            { if: { not: { flag: 'buried.gauges.read' } }, text: 'Three gauges, on posts by the walls: on the ramp, past this ledge, between the oval doors. Splash each dial.' },
          ],
          choices: [{ text: 'On it.', end: true }],
        },
        tell: {
          say: ['Ninety. Ninety-one. Ninety. A full year’s breath, every one of them.', 'Did you see the mark under the needles? Three dots over a curve. {glyph} The dome people call it the Maker’s Thumb. I call it a signature. You don’t sign a thing you mean to throw away.'],
          do: [{ advance: ['buried.gauges', 'tell'] }, { set: { 'clue.buried.mark': true } }],
          next: 'tell2',
        },
        tell2: { say: ['So the machine was meant to last. And here it is, lasting. Thank you, sky-walker. Now go and watch it turn.'], choices: [{ text: 'Thank you, Ossa.', end: true }] },
        after: { say: ['The walls are quiet again. They said what they had to.'], choices: [{ text: '(listen with her)', end: true }] },
      },
    },
  },

  tull: {
    id: 'tull', name: 'Tull', title: 'who oils the oval doors', color: '#c9d4b8', voice: 1.2, kind: 'm',
    palette: { cloak: '#c9d4b8', lining: '#2b211f', cloth: '#2f5a5e', legs: '#4a3a2a', hat: '#c8643f', hair: '#6e4a32' }, head: 'hat', cape: 0.8,
    lines: ['Inside, look up. The lit window is on the balcony.', 'The city up there? It has always hung like that.', 'Squeak. No squeak. Good.'],
    talk: {
      entry: [
        { if: { quest: 'buried.window', done: true }, node: 'after' },
        { if: { flag: 'met.tull' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Oh! Visitors don’t come this far. I’m Tull. I oil the oval doors. Nobody asked me to, but they’d squeal.', 'Go in, go in. Look up: no lid. And up on the balcony, the window. It’s warm. Something in there is still alive, I’m sure of it. I talk to it some nights.'],
          choices: [
            { text: 'What’s behind the window?', goto: 'behind' },
            { text: 'Has anyone else come down here?', goto: 'helmet' },
            { text: 'I’ll go in.', end: true },
          ],
        },
        behind: {
          say: ['The rest of the machine, all the way down? Or a room where someone’s still working. Put your hand on it. It’s as warm as a hand.'],
          choices: [{ text: 'I’ll climb up and see.', do: { start: 'buried.window' }, end: true }, { text: 'Has anyone else come down here?', goto: 'helmet' }],
        },
        helmet: {
          say: ['Once, when I was young. A man in a tall helmet came down the ramp with a box that ticked. He called himself a Major. He said he had built a whole world of his own and forgotten why, and he wanted to see a machine that had never once forgotten what it was for.', 'He scratched numbers on the drum wall by the doorway, stood in front of the Wick for a long time, laughed once, and went back up very quiet. The numbers are still there.'],
          do: { set: { 'clue.buried.garage': true } },
          choices: [{ text: 'I’ll look at them.', end: true }, { text: 'What’s behind the window?', goto: 'behind' }],
        },
        again: {
          say: [{ if: { flag: 'buried.oculus.lit' }, text: 'The Wick! I saw it from the doors, the whole drum gone amber. The window’s even warmer now.' }, { if: { not: { flag: 'buried.oculus.lit' } }, text: 'Squeak? No squeak. Good. The window’s up on the balcony, if you’re climbing.' }],
          choices: [
            { text: 'Tell me about the window.', if: { quest: 'buried.window', started: false }, goto: 'behind' },
            { text: 'The man in the helmet?', if: { not: { flag: 'clue.buried.garage' } }, goto: 'helmet' },
            { text: 'Bye, Tull.', end: true },
          ],
        },
        after: { say: ['You felt it? Warm. I knew it. Don’t tell anyone; they’ll want to come and touch it, and it isn’t a door.'], choices: [{ text: 'Your secret is safe.', end: true }] },
      },
    },
  },
};

// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  wick: {
    id: 'wick', name: 'The Wick', title: 'at the bottom of the oculus', color: '#e9a53c', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'buried.oculus.lit' }, node: 'lit' }, { if: { flag: 'buried.valve.open' }, node: 'oil' }, { node: 'dry' }],
      nodes: {
        dry: {
          say: ['A shallow iron dish on a pedestal, black with old oil. A wick as thick as your arm lies coiled in it, dry.', 'Beside it a valve stands on a stem, its handwheel rusted fast. A good shove might turn it. (*Push*: C, middle click, or B / ○.)'],
          choices: [{ text: '(step back)', end: true }],
        },
        oil: { say: ['Oil has risen in the dish, dark and slow, smelling of warm iron. The wick drinks it. It only wants a spark. (*Shoot*: click, G, or RT.)'], choices: [{ text: '(step back)', end: true }] },
        lit: { say: ['The Wick burns amber, steady and quiet, and the light goes straight up out of the oculus into the sky. Stand in it, and your tank hums.'], choices: [{ text: '(step back)', end: true }] },
      },
    },
  },
  window: {
    id: 'window', name: 'The warm window', title: 'on the oculus balcony', color: '#f3a57c', voice: 0.6,
    talk: { nodes: { touch: {
      say: [
        'The porthole is as wide as a door and glows the colour of a peach. You lay your hand on the glass. It is warm, like a hand. Far behind it, very slowly, something turns.',
        { if: { flag: 'buried.oculus.lit' }, text: 'Amber light moves behind the glass now, as if something in there has lit a lamp of its own.' },
        'Cast into the rim above it, as big as your arm: three dots over an arc. {glyph}',
      ],
      do: [{ set: { 'buried.window.touched': true } }, { set: { 'clue.buried.mark': true } }],
      choices: [{ text: '(take your hand away)', end: true }],
    } } },
  },
  numbers: {
    id: 'numbers', name: 'Scratched numbers', title: 'on the drum wall', color: '#c9d4b8', voice: 0.6,
    talk: { nodes: { read: {
      say: ['Rows of numbers scratched into the teal paint, in a careful hand that isn’t from here: bearings, depths, a date. Round some of them, a box has been drawn, and round the box, an arrow pointing down.', 'At the bottom, in bigger letters: FOUND IT. NOW WHAT?'],
      do: { set: { 'clue.buried.garage': true } },
      choices: [{ text: '(step back)', end: true }],
    } } },
  },
  wheel: {
    id: 'wheelLook', name: 'The great wheel', title: 'sunk to its axle', color: '#c0603e', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'buried.wheel.turned' }, node: 'after' }, { node: 'look' }],
      nodes: {
        look: { say: ['Each tooth is taller than you, worn smooth on one face. Sand runs off them in thin streams. Deep inside, too low to hear with your ears, something hums.'], choices: [{ text: '(tell it the Garage is still turning)', if: { all: [{ flag: 'clue.garage.buried' }, { not: { flag: 'buried.told.garage' } }] }, goto: 'garage' }, { text: '(step back)', end: true }] },
        after: { say: ['One tooth further round than this morning. The worn face has moved on, and a new one waits for next year.'], choices: [{ text: '(tell it the Garage is still turning)', if: { all: [{ flag: 'clue.garage.buried' }, { not: { flag: 'buried.told.garage' } }] }, goto: 'garage' }, { text: '(step back)', end: true }] },
        garage: { say: ['You say it out loud, to a wheel, feeling foolish: the Garage is still turning.', 'Deep inside, the hum changes, very slightly, for about as long as it takes to say it back.'], do: { set: { 'buried.told.garage': true } }, choices: [{ text: '(step back)', end: true }] },
      },
    },
  },
};
