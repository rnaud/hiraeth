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
// sliver of the tooth that turned; Wen gives it to you to keep. Its sand slides
// off into a long hollow, and from then on it keeps turning.
//
// The glyph is "the Maker's Thumb" here, pressed into every plate and gauge.
// The Major himself (a man in a tall helmet) once came down to see the wheel,
// left numbers on the drum wall and went back up very quiet (the Hangar's
// note led him here, and leads you; tell the wheel the Hangar is still turning). Conversations: src/story/dialogue.js; quests:
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
      // (new: a save already at 'find' with the jib still out is moved back here)
      { id: 'swing', text: 'Dun’s key hangs on the crane of the floating derrick, east of the domes, out over the drop. Splash the jib’s rusted collar (shoot), then shove the jib round over the platform (push: C, middle click, or RB / R1)', label: 'The derrick’s crane', flag: 'buried.jib.in', at: 'jib' },
      { id: 'find', text: 'The hook has swung in over the platform: take Dun’s key off it', label: 'The derrick’s crane hook', bring: 'key', at: 'key', to: 'dun' },
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
    palette: { cloak: '#e8b896', lining: '#2b211f', cloth: '#5f7488', legs: '#3a3a3a', hat: '#f3ead2', hair: '#3d2a22' }, head: 'wrap', cape: 1.1, look: { mask: 'breather', body: 'pauldrons' },
    lines: ['~neutral~ Tooth Day. Mind the sand.', '~happy~ Forty-one teeth, and every one counted.', '~neutral~ Watch the city when it turns.'],
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
          say: ["~happy~ Welcome down! I’m Wen. Sit anywhere you like sand. That gives you a good choice.", "~neutral~ Today is *Tooth Day*. Once a year the great wheel turns one tooth. I’m forty-one teeth old. Pim is nine and negotiating."],
          choices: [
            { text: '~curious~ What wheel?', goto: 'wheel' },
            { text: '~neutral~ I’m looking for something of value.', goto: 'value' },
          ],
        },
        wheel: {
          say: ["~neutral~ The wheel’s *east of the domes*. You can see its top above the sand. The rest goes farther down than we’ve ever dug.", "~solemn~ When it turns, our domes let out their air and the city overhead swings. That’s our new year."],
          choices: [{ text: '~curious~ And it turns today?', goto: 'today' }, { text: '~curious~ The city up there?', goto: 'city' }],
        },
        count0: {
          say: ["~neutral~ Each turn sheds a sliver of metal. We keep one on a string for each year we’ve lived.", "~playful~ Mine’s getting heavy. Hask made his into a belt. Age should at least keep your trousers up."],
          choices: [{ text: '~curious~ And the wheel turns today?', goto: 'today' }],
        },
        value: {
          say: ["~solemn~ Something of value? Here we value things that last.", "~playful~ The wheel does well by that measure. So does Hask. Don’t tell him; he’ll become a monument."],
          choices: [{ text: '~neutral~ Tell me about the wheel.', goto: 'wheel' }, { text: '~surprised~ You count your age in teeth?', goto: 'count0' }],
        },
        city: {
          say: ["~solemn~ The floating city is *the Other Half*. We say the wheel holds it up, and its weight steadies the wheel.", "~solemn~ The old story says the city will settle onto the wheel when the last tooth turns. We’re not clearing a space yet."],
          choices: [{ text: '~curious~ And the wheel turns today?', goto: 'today' }],
        },
        today: {
          say: ["~neutral~ The wheel needs light. Every Tooth Day Hask goes into the canyon and lights *the Wick*, a lamp inside the oculus.", "~scared~ This year he refuses to go. Won’t tell me why. *Ask him.* Strangers sometimes get the answers neighbours don’t."],
          do: { set: { 'buried.wen.heard': true } },
          choices: [{ text: '~curious~ Where is Hask?', goto: 'where' }, { text: '~neutral~ I’ll talk to him.', end: true }],
        },
        where: { say: ["~sad~ The bench beside his dome, just west of mine. Since the singing light passed, he watches the sky. He used to watch for people owing him things."], choices: [{ text: '~neutral~ I’ll go.', end: true }] },
        again: {
          say: [
            { if: { flag: 'buried.hask.asked' }, text: "~neutral~ He told you? Good. Take *the ramp south of the domes*, where the pipes go underground. Mind your footing." },
            { if: { not: { flag: 'buried.hask.asked' } }, text: "~scared~ Try *Hask’s bench, west of here*. We can’t have Tooth Day without a turn. I’ve made preparations for being forty-two." },
          ],
          choices: [
            { text: '~curious~ What’s the mark on your door?', goto: 'mark', once: true },
            { text: '~happy~ See you, Wen.', end: true },
          ],
        },
        mark: { say: ["~solemn~ {glyph} *The Maker’s Thumb.* It’s on the buried pipes and plates. We paint it on our doors, hoping the machine will recognise its neighbours.", "~neutral~ It’s on the old *blue star-chests* too. We call them thumb-boxes. There’s one *on the chimney ring*. It has never opened for us."], choices: [{ text: '~curious~ Does it work?', goto: 'works' }] },
        works: { say: ["~playful~ Has the machine knocked at the wrong house? Not once. Strong evidence."], choices: [{ text: '~happy~ See you, Wen.', end: true }] },
        lit: {
          say: ["~surprised~ I felt the Wick catch! Go *stand in front of the wheel* and watch. Nobody should miss their first turn."],
          choices: [{ text: '~neutral~ I’m going.', end: true }],
        },
        turned: { say: ["~surprised~ The city swung! And the wheel’s still turning! It’s meant to stop after one tooth. I’ll need to rethink my counting.", "~playful~ Look *at the wheel’s feet*. It usually drops a metal sliver when it turns."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        count: {
          say: ["~happy~ You found this year’s sliver. Still warm. They always are.", "~playful~ Forty-two for my string. Pim is ten now. He wanted the age until he heard about the water-carrying duties.", "~solemn~ Keep that sliver. You were here for the turn. It’s your year too."],
          do: [{ advance: [Q, 'count'] }, { keepsake: KEEPSAKE }],
          next: 'given',
        },
        given: { say: ["~happy~ By our reckoning, you’re one tooth old. Welcome! You’re doing very well at standing."], choices: [{ text: '~happy~ Thank you, Wen.', end: true }] },
        after: { say: ["~playful~ Come back when you’re two! The wheel’s still going. Pim says it’s catching up with you."], choices: [{ text: '~happy~ I will.', end: true }] },
      },
    },
  },

  hask: {
    id: 'hask.buried', name: 'Hask', title: 'keeper of the Wick', color: '#7f93a3', voice: 0.7, kind: 'm', scale: 0.96,
    palette: { cloak: '#7f93a3', lining: '#2b211f', cloth: '#c8643f', legs: '#4a3a2a', hat: '#e9dcc0', hair: '#e8dcc0' }, head: 'hat', cape: 1.3, look: { prop: 'lantern' },
    lines: ['~tired~ Mm.', '~tired~ Fifty-two Tooth Days.', '~neutral~ (he watches the sky)'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'buried.oculus.lit' }, node: 'felt' },
        { if: { flag: 'buried.hask.asked' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~tired~ Mm. The sky-child. Wen sent you.', "~solemn~ Hask. I tend *the Wick in the oculus*. Fifty-two years lighting it. Fifty-two turns of the wheel. I used to find that comforting."],
          choices: [
            { text: '~curious~ Why not this year?', goto: 'why' },
            { text: '~curious~ What is the oculus?', goto: 'oculus' },
          ],
        },
        oculus: { say: ["~neutral~ The oculus is *the open-topped drum at the canyon’s end*. The Wick stands in its centre. There’s a warm window above, on the balcony."], choices: [{ text: '~curious~ Why haven’t you gone down this year?', goto: 'why' }] },
        why: {
          say: ["~solemn~ That night, a light crossed the dunes singing the wheel’s note. My grandmother called such things *Tuning Stars*. She never said what they came to tune.", "~whisper~ It turned above the canyon, then climbed away. As if it had stopped to search.", "~scared~ What if it was looking for the wheel? Lighting the Wick might call it back. That is why I stayed up here."],
          do: { set: { 'buried.rumour.light': true } },
          choices: [{ text: '~neutral~ It struck my ship.', goto: 'struck' }, { text: '~neutral~ Then let me light it.', goto: 'light' }],
        },
        struck: { say: ["~sad~ It struck your ship? I’m glad it passed us by. I’m sorry it didn’t pass you by too."], choices: [{ text: '~neutral~ Let me light the Wick.', goto: 'light' }] },
        light: {
          say: ["~tired~ You’ll light it? Take *the ramp south of the domes*. Follow the canyon *through two oval doors to the oculus*.", "~neutral~ At the centre, *push the stuck oil valve*. Oil will fill the dish. Then *shoot the Wick* to light it."],
          do: { set: { 'buried.hask.asked': true } },
          choices: [{ text: '~curious~ A spark?', goto: 'spark' }, { text: '~neutral~ I’ll go.', end: true }],
        },
        spark: { say: ["~neutral~ Your bright fluid should do. *Shoot the Wick after opening the valve.* Then come back up to watch the wheel turn."], choices: [{ text: '~neutral~ I’ll go.', end: true }] },
        again: {
          say: ["~tired~ South ramp. Two oval doors. Push the valve, then shoot the Wick. Come back up afterwards."],
          choices: [
            { text: '~curious~ What is the mark on everything here?', goto: 'thumb', once: true },
            { text: '~neutral~ I’m going.', end: true },
          ],
        },
        thumb: {
          say: ["~solemn~ {glyph} The Maker’s Thumb. They say its builder pressed three fingers into soft iron and drew an arc. Every gauge carries it.", "~curious~ Wen says your ship has that mark. Was your ship built by the same hands?"],
          do: { set: { 'clue.buried.mark': true } },
          choices: [{ text: '~neutral~ No. Something hit it.', goto: 'hit' }, { text: '~neutral~ I don’t know.', goto: 'hit' }],
        },
        hit: { say: ["~tired~ Burned on by the thing that hit you? Same mark on a gift and a wound. I don’t like that. *Light the Wick.* Let’s learn what happens."], choices: [{ text: '~neutral~ I’m going.', end: true }] },
        felt: {
          say: [{ if: { flag: 'buried.wheel.turned' }, text: "~happy~ It turned. I felt the bench shake. My fifty-third year. And the sky stayed empty." }, { if: { not: { flag: 'buried.wheel.turned' } }, text: "~happy~ The Wick is burning. Go *stand before the wheel*. You’ve earned a view of what you helped wake." }],
          choices: [{ text: '~curious~ Did the light come back?', goto: 'back' }, { text: '~neutral~ Goodbye, Hask.', end: true }],
        },
        back: { say: ["~playful~ No light came back. Just sky. I might manage the walk myself next year. Might."], choices: [{ text: '~neutral~ Goodbye, Hask.', end: true }] },
        after: { say: ["~playful~ Next Tooth Day, I light it. You watch. Bring a seat. We can provide sand."], choices: [{ text: '~happy~ I’d like that.', end: true }] },
      },
    },
  },

  dun: {
    id: 'dun', name: 'Dun', title: 'who keeps the domes breathing', color: '#c8643f', voice: 1.15, kind: 'm',
    palette: { cloak: '#c8643f', lining: '#2b211f', cloth: '#34405e', legs: '#3a3a3a', hat: '#5f7488', hair: '#2b211f' }, head: 'hood', cape: 0.6,
    lines: ['~shout~ Mind the sand on my chimneys!', '~neutral~ Every dome has to breathe on Tooth Day.', '~scared~ Up there. Up there!'],
    talk: {
      entry: [
        { if: { quest: 'buried.key', done: true }, node: 'after' },
        { if: { has: 'key' }, node: 'back' },
        { if: { quest: 'buried.key', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~surprised~ Mind my chimneys! Oh, hello. Dun. I keep the domes breathing. Someone has to remember the practical end of a festival.", "~neutral~ When the wheel turns, air rises through the pipes. I unlock every chimney to let it out. Unfortunately, my key is currently sightseeing."],
          choices: [{ text: '~curious~ Up where?', goto: 'up' }, { text: '~curious~ What happens if they cough?', goto: 'cough' }],
        },
        cough: { say: ["~playful~ Closed chimneys mean soot in the beds, soot in the soup, soot in Wen’s hair. I can tolerate the first two complaints."], choices: [{ text: '~curious~ Where’s your key?', goto: 'up' }] },
        up: {
          say: ["~neutral~ My key’s on *the floating derrick’s crane hook, east of here*. Yes, up there.", "~scared~ I climbed up to watch the singing light and hung my key safely on the hook. Then I got frightened and climbed down. The key remains very safe."],
          choices: [
            { text: '~neutral~ I’ll fetch it.', do: { start: 'buried.key' }, goto: 'thanks' },
            { text: '~curious~ What did the light look like?', goto: 'light' },
          ],
        },
        light: { say: ["~scared~ It glowed and hummed like the wheel. Turned above the canyon, then went south. I’d had enough of looking by then."], choices: [{ text: '~neutral~ I’ll fetch your key.', do: { start: 'buried.key' }, goto: 'thanks' }] },
        thanks: { say: ["~playful~ You’ll fetch it? You’ve got a jetpack. I’ve got a newly discovered fear of heights. An excellent division of labour.",
          "~neutral~ The crane arm has swung over the drop. *Shoot its rusty collar*, then *push the arm sideways* until the hook is over the platform. The ratchet turns only one way."], choices: [{ text: '~neutral~ Back soon.', end: true }] },
        waiting: { say: [{ if: { flag: 'buried.jib.in' }, text: "~playful~ *The floating derrick, east.* My key hangs from *the crane hook*. Please bring both it and yourself down." },
          { if: { not: { flag: 'buried.jib.in' } }, text: "~playful~ *East, on the floating derrick.* Wet the rusty collar, then *push the crane arm sideways* until the key hangs over the platform." }], choices: [{ text: '~neutral~ On my way.', end: true }] },
        back: {
          say: ['~happy~ My key! Sand in the teeth and all. Stand back.', "~neutral~ (Dun climbs from dome to dome, unlocking chimneys. Air whistles through the pipes.)"],
          do: [{ take: 'key' }, { advance: 'buried.key' }, { set: { 'buried.chimneys.open': true } }],
          next: 'opened',
        },
        opened: { say: ["~happy~ All open! Now the domes can breathe when the wheel turns. You’ve saved a great many soups."], choices: [{ text: '~happy~ Happy Tooth Day, Dun.', end: true }] },
        after: { say: ['~happy~ Hear that whistle? That’s a happy chimney.'], choices: [{ text: '~playful~ It sounds happy.', end: true }] },
      },
    },
  },

  pim: {
    id: 'pim', name: 'Pim', title: 'nine teeth old', color: '#e9c9a8', voice: 1.7, kind: 'm', scale: 0.72,
    palette: { cloak: '#e9c9a8', lining: '#2b211f', cloth: '#5f7488', legs: '#3a3a3a', hat: '#c8643f', hair: '#4a3226' }, head: 'hair', cape: 0.4,
    lines: ["~neutral~ The domes are chimneys. Most of the machine is beneath us.", "~neutral~ Follow the sandy ramp. Those canyon walls are pipes.", '~shout~ I’m nine teeth old!'],
    talk: {
      entry: [{ if: { quest: Q, done: true }, node: 'ten' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~curious~ Are you a person? You arrived in a ball. I’m Pim. Nine teeth old. For now.", "~scared~ If the wheel turns, I’ll be ten! Wen says it might not. Can they do that? Cancel a birthday?"],
          choices: [
            { text: '~playful~ Is nine so bad?', goto: 'nine' },
            { text: '~curious~ Seen anything strange lately?', goto: 'strange' },
          ],
        },
        nine: { say: ["~whisper~ Ten-year-olds can go down the ramp. You can hear the machine through the pipes. I’ve been waiting a whole tooth to listen."], choices: [{ text: '~curious~ What’s up in the sky?', goto: 'city' }, { text: '~happy~ Bye, Pim.', end: true }] },
        city: { say: ["~happy~ The floating city rocks when the wheel turns. Last year a tower swung like a bell. Too high to hear it. Very unfair."], choices: [{ text: '~curious~ Seen anything strange?', goto: 'strange' }, { text: '~happy~ Bye, Pim.', end: true }] },
        strange: { say: ["~whisper~ Hask keeps watching the sky now. And Dun left his key on *the floating derrick*. Everyone knows. Especially the people he tells not to tell."], choices: [{ text: '~happy~ Bye, Pim.', end: true }] },
        ten: { say: ["~playful~ TEN! I’m ten teeth old! Wen says you’re one. You should listen to your elders. That’s me."], choices: [{ text: '~playful~ What do you say?', goto: 'say' }] },
        say: { say: ["~playful~ Come next Tooth Day. I want a witness for eleven."], choices: [{ text: '~happy~ Deal.', end: true }] },
      },
    },
  },

  ossa: {
    id: 'ossa.buried', name: 'Ossa', title: 'who listens to the walls', color: '#7f93a3', voice: 0.9, kind: 'f',
    palette: { cloak: '#7f93a3', lining: '#2b211f', cloth: '#c8643f', legs: '#2b2f45', hat: '#d8dcc8', hair: '#2b211f' }, head: 'hood', cape: 1.2,
    lines: ['~whisper~ Listen. The walls are still warm.', "~neutral~ Two oval doors. The open-roofed room is beyond them.", '~whisper~ Shh.'],
    talk: {
      entry: [
        { if: { quest: 'buried.gauges', done: true }, node: 'after' },
        { if: { flag: 'buried.gauges.read' }, node: 'tell' },
        { if: { quest: 'buried.gauges', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~whisper~ Listen here. The pipes are warm. Every Tooth Day, the pressure rises from below.", "~solemn~ Ossa. I listen to the machine. It’s usually a quiet neighbour. Today it has something to report."],
          choices: [
            { text: '~curious~ What do they say?', goto: 'say' },
            { text: '~curious~ Where does the canyon lead?', goto: 'lead' },
          ],
        },
        lead: { say: ["~neutral~ *Through the two oval doors to the oculus.* You’ll find the Wick in the open-roofed room. Hask usually tends it."], choices: [{ text: '~curious~ What do the walls say?', goto: 'say' }] },
        say: {
          say: ["~tired~ The pipes sound full, but I need the gauges to be sure. Their needles stick. They’re too high for me to tap.", "~neutral~ *Three gauges on canyon posts*: at the ramp, beyond my ledge, and between the oval doors."],
          choices: [
            { text: '~happy~ I’ll read them for you.', do: { start: 'buried.gauges' }, goto: 'how' },
            { text: '~neutral~ Maybe later.', end: true },
          ],
        },
        how: { say: ["~neutral~ *Shoot each gauge with fluid.* A splash should free the needle so you can read it."], choices: [{ text: '~neutral~ Back soon.', end: true }] },
        waiting: {
          say: [
            { if: { flag: 'buried.gauge.0' }, text: '~neutral~ The one on the ramp reads ninety. Good.' },
            { if: { flag: 'buried.gauge.1' }, text: '~happy~ The one past the ledge, ninety-one. Better than good.' },
            { if: { flag: 'buried.gauge.2' }, text: '~neutral~ The one between the doors, ninety.' },
            { if: { not: { flag: 'buried.gauges.read' } }, text: "~neutral~ *Shoot all three gauges*: ramp, past my ledge, between the oval doors. Bring me the readings." },
          ],
          choices: [{ text: '~neutral~ On it.', end: true }],
        },
        tell: {
          say: ["~happy~ Ninety, ninety-one, ninety. Good. A full year of pressure waiting to move.", "~solemn~ That mark below the needles? {glyph} They call it the Maker’s Thumb. Someone signed this work. I like to think they expected it to last."],
          do: [{ advance: ['buried.gauges', 'tell'] }, { set: { 'clue.buried.mark': true } }],
          next: 'tell2',
        },
        tell2: { say: ["~happy~ Still running after all this time. Thank you for checking. Now go see the wheel turn."], choices: [{ text: '~happy~ Thank you, Ossa.', end: true }] },
        after: { say: ["~whisper~ Quiet again. Sometimes a machine just needs someone to hear it."], choices: [{ text: '~neutral~ (listen with her)', end: true }] },
      },
    },
  },

  tull: {
    id: 'tull', name: 'Tull', title: 'who oils the oval doors', color: '#c9d4b8', voice: 1.2, kind: 'm',
    palette: { cloak: '#c9d4b8', lining: '#2b211f', cloth: '#2f5a5e', legs: '#4a3a2a', hat: '#c8643f', hair: '#6e4a32' }, head: 'hat', cape: 0.8,
    lines: ['~neutral~ Inside, look up. The lit window is on the balcony.', '~neutral~ The city up there? It has always hung like that.', '~playful~ Squeak. No squeak. Good.'],
    talk: {
      entry: [
        { if: { quest: 'buried.window', done: true }, node: 'after' },
        { if: { flag: 'met.tull' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~surprised~ A visitor! Tull. I oil the doors. Unpaid appointment. The alternative was listening to them squeal.", "~whisper~ Go in and look *at the window on the balcony*. It’s always warm. I think someone, or something, is still working behind it."],
          choices: [
            { text: '~curious~ What’s behind the window?', goto: 'behind' },
            { text: '~curious~ Has anyone else come down here?', goto: 'helmet' },
          ],
        },
        behind: {
          say: ["~curious~ Could be machinery. Could be a room. *Put your hand on the window.* Warm as another hand. I talk to it sometimes."],
          choices: [{ text: '~neutral~ I’ll climb up and see.', do: { start: 'buried.window' }, end: true }, { text: '~curious~ Has anyone else come down here?', goto: 'helmet' }],
        },
        helmet: {
          say: ["~solemn~ A man in a tall helmet visited once. Called himself a Major. He’d built a world and forgotten why. Wanted to see a machine that still knew its job.", "~sad~ He wrote *on the drum wall by the doorway*. Numbers. Then watched the Wick, laughed once, and left very quietly."],
          do: { set: { 'clue.buried.garage': true } },
          choices: [{ text: '~neutral~ I’ll look at them.', end: true }, { text: '~curious~ What’s behind the window?', goto: 'behind' }],
        },
        again: {
          say: [{ if: { flag: 'buried.oculus.lit' }, text: "~surprised~ You lit it! The whole drum is amber. Even the window’s warmer." }, { if: { not: { flag: 'buried.oculus.lit' } }, text: "~playful~ No squeak. Lovely. *The window is up on the balcony* if you’re going to look." }],
          choices: [
            { text: '~curious~ Tell me about the window.', if: { quest: 'buried.window', started: false }, goto: 'behind' },
            { text: '~curious~ The man in the helmet?', if: { all: [{ not: { flag: 'clue.buried.garage' } }, { quest: 'buried.window', started: true }] }, goto: 'helmet' },
            { text: '~happy~ Bye, Tull.', end: true },
          ],
        },
        after: { say: ["~whisper~ Warm, isn’t it? Please don’t tell everyone. They’ll start knocking. It’s a window, not a reception desk."], choices: [{ text: '~whisper~ Your secret is safe.', end: true }] },
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
          say: ["~neutral~ A dry wick coils in an iron dish. Old oil has blackened the rim.", "~neutral~ The oil valve beside it is rusted shut. *Push* it: C, middle click or RB / R1."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        oil: { say: ["~neutral~ Oil fills the dish and soaks the wick. *Shoot the Wick* to light it: aim with R, right click or LT / L2, then G, left click or RT / R2."], choices: [{ text: '~neutral~ (step back)', end: true }] },
        lit: { say: ["~solemn~ Amber light rises out of the oculus. *Stand in the light* to let your tank absorb its colour."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  window: {
    id: 'window', name: 'The warm window', title: 'on the oculus balcony', color: '#f3a57c', voice: 0.6,
    talk: { nodes: { touch: {
      say: [
        "~solemn~ You touch the peach-coloured window. Warm glass. Behind it, something turns slowly in the dark.",
        { if: { flag: 'buried.oculus.lit' }, text: "~whisper~ Now amber light moves behind the glass, too." },
        "~neutral~ The familiar mark is cast into the window’s rim: {glyph}",
      ],
      do: [{ set: { 'buried.window.touched': true } }, { set: { 'clue.buried.mark': true } }],
      choices: [{ text: '~neutral~ (take your hand away)', end: true }],
    } } },
  },
  crane: {
    id: 'crane', name: 'The derrick’s crane', title: 'on the floating derrick', color: '#c0603e', voice: 0.6,
    talk: { nodes: { look: {
      say: [
        { if: { not: { flag: 'buried.jib.in' } }, text: "~neutral~ Dun’s key hangs from the crane hook, out over the drop." },
        { if: { not: { flag: 'buried.jib.oiled' } }, text: "~neutral~ Rust locks the crane’s collar. *Shoot it with fluid*: aim with R, right click or LT / L2, then G, left click or RT / R2." },
        { if: { all: [{ flag: 'buried.jib.oiled' }, { not: { flag: 'buried.jib.in' } }] }, text: "~curious~ The wet collar is free. *Push the arm sideways* until the hook is above the platform: C, middle click or RB / R1. The ratchet permits only one direction." },
        { if: { flag: 'buried.jib.in' }, text: "~neutral~ The hook now hangs over the platform, with the key in reach." },
      ],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  numbers: {
    id: 'numbers', name: 'Scratched numbers', title: 'on the drum wall', color: '#c9d4b8', voice: 0.6,
    talk: { nodes: { read: {
      say: ["~neutral~ Someone has scratched bearings, depths and a date into the paint. A box surrounds several numbers. An arrow points down.", "~surprised~ Beneath them: FOUND IT. NOW WHAT? You recognise the Major’s approach to discovery."],
      do: { set: { 'clue.buried.garage': true } },
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  wheel: {
    id: 'wheelLook', name: 'The great wheel', title: 'sunk in the dunes', color: '#c0603e', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'buried.wheel.turned' }, node: 'after' }, { node: 'look' }],
      nodes: {
        look: { say: ["~solemn~ Each tooth is taller than you. Sand trickles down its worn face. The wheel’s low hum reaches your feet before your ears."], choices: [{ text: '~neutral~ (tell it the Hangar is still turning)', if: { all: [{ flag: 'clue.garage.buried' }, { not: { flag: 'buried.told.garage' } }] }, goto: 'garage' }, { text: '~neutral~ (step back)', end: true }] },
        after: { say: ["~solemn~ The wheel keeps turning. Tooth after tooth rises from the sand. Its hum has become a steady beat."], choices: [{ text: '~neutral~ (tell it the Hangar is still turning)', if: { all: [{ flag: 'clue.garage.buried' }, { not: { flag: 'buried.told.garage' } }] }, goto: 'garage' }, { text: '~neutral~ (step back)', end: true }] },
        garage: { say: ["~playful~ You tell the wheel, a little self-consciously: the Hangar is still turning.", "~solemn~ The hum changes for a moment. Almost long enough for an answer."], do: { set: { 'buried.told.garage': true } }, choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};
