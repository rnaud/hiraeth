// The Signal Market's story as data: "You Are Not Alone" (docs/story-bible.md).
//
// A thousand signs speak; one tower is silent. For forty years the broadcast
// tower at the end of the avenue caught voices out of the dark (ships,
// colonies, people a long way from home) and played them to the square. The
// market believes it was the only sign that ever told the truth, because it
// only ever said one thing: somebody out there is talking to you.
// The night the sky rang, a singing light went over the market, every sign
// showed the same mark at once, and the tower caught one last message and went
// dumb: the antenna slipped out of tune, and the courier who should have run
// the recording up to the console ran off with it instead.
// Find Kip and the recording; tune the antenna (light its three bulbs at once:
// the tank holds three shots); play it at the console. The voice is your
// father's, years younger, speaking to a child called Ilen: someone else's
// child. Sel reads the header: it was sent from your home system.
//
// Side errands: Brush's oldest sign, dark under the second skybridge (shoot it
// awake: it says WE HEARD YOU); Ummu's listening bowl, under the crates that
// fell the night the sky rang (push them clear).
//
// Flags (game-state.js): bazaar.rumour.light, bazaar.kip.gave, bazaar.antenna.tuned,
// bazaar.broadcast.on (the tower speaks again), bazaar.oldsign.awake,
// bazaar.crates.clear; clue.bazaar.home. Items: recording, bowl.

const Q = 'bazaar.signal';

export const ITEMS = { recording: 'the unsent recording', bowl: 'Ummu’s listening bowl' };

/** The broadcast's words, the keepsake: kept here so the calls home can quote it. */
export const KEEPSAKE = { id: 'bazaar.word', level: 'bazaar', name: 'You are not alone', kind: 'word',
  text: '“Don’t bring anything. You are not alone. Someone is listening for you.” Your father’s voice, years younger, to a child called Ilen.' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'You Are Not Alone', world: 'bazaar', main: true,
    outro: 'The tower talks again. It said what it always said, to everyone at once.',
    stages: [
      { id: 'sel', text: 'A thousand signs speak; one tower is silent. Find whoever kept it, at its foot in Signal Square', label: 'Madame Sel, under the silent tower', talk: 'sel' },
      { id: 'kip', text: 'Find Kip the courier, up on the second skybridge, who never delivered the last recording', label: 'Kip, on the second skybridge', talk: 'kip' },
      { id: 'tune', text: 'Tune the antenna on the tower’s balcony: light its three bulbs at once', label: 'The antenna', flag: 'bazaar.antenna.tuned', at: 'antenna' },
      { id: 'play', text: 'Play the unsent recording at the balcony console', label: 'The console', flag: 'bazaar.broadcast.on', at: 'console' },
      { id: 'sel2', text: 'Go down to Madame Sel', label: 'Madame Sel', talk: 'sel' },
    ],
  },
  {
    id: 'bazaar.oldsign', title: 'The Oldest Sign', world: 'bazaar',
    outro: 'WE HEARD YOU, small, in the corner of sixty-one signs and counting.',
    stages: [
      { id: 'wake', text: 'Wake the oldest sign in the market, dark under the second skybridge (shoot it with the fluid)', label: 'The oldest sign', flag: 'bazaar.oldsign.awake', at: 'oldSign' },
      { id: 'tell', text: 'Tell Brush what the oldest sign says', label: 'Brush, the sign painter', talk: 'brush' },
    ],
  },
  {
    id: 'bazaar.bowl', title: 'The Quiet One’s Bowl', world: 'bazaar',
    outro: 'Ummu listens to the far dark again, and hums back what it hears.',
    stages: [
      { id: 'crates', text: 'Push the fallen crates away from Ummu’s alley (the fluid’s push)', label: 'The fallen crates', flag: 'bazaar.crates.clear', at: 'crates' },
      { id: 'bowl', text: 'Give Ummu back its listening bowl', label: 'Ummu', bring: 'bowl', at: 'bowl', to: 'ummu' },
    ],
  },
];

const ON_AIR = { flag: 'bazaar.broadcast.on' };

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  sel: {
    id: 'sel', name: 'Madame Sel', title: 'who kept the silent tower', color: '#88b4b5', voice: 0.75, kind: 'f',  age: 'elder', scale: 0.96,
    palette: { cloak: '#88b4b5', lining: '#465c65', cloth: '#f5dfab', legs: '#465c65', hat: '#f0a083', hair: '#e8dcc0' }, head: 'wrap', cape: 1.4,
    lines: ['~happy~ Mind the cables, love.', '~sad~ Forty years I ran that tower.', '~solemn~ Listen. No. Listen properly.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'sel2' }, node: 'told' },
        { if: { quest: Q, stage: ['kip', 'tune', 'play'] }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~playful~ Mind the cables, love. Nobody else does.',
            '~sad~ You’re looking at my tower. Everybody looks at the others: the noodle signs, the fortune signs, the signs that sell you signs. Nobody looks at the quiet one.',
            '~neutral~ I’m Sel. I ran this tower forty years. It caught voices out of the sky and played them to the square.'],
          choices: [
            { text: '~curious~ Why did it go quiet?', goto: 'quiet' },
            { text: '~curious~ Voices from where?', goto: 'where' },
            { text: '~curious~ What do the other signs say?', goto: 'others' },
          ],
        },
        others: {
          say: ['~angry~ Buy. Eat. Win. Love this, fear that, buy the cure. A thousand signs talking at once, and not one of them talking to you.',
            '~solemn~ The market says the silent tower was the only sign that ever told the truth. It only ever said one thing, in a thousand voices: *somebody out there is talking to you*.'],
          choices: [{ text: '~curious~ Why did it go quiet?', goto: 'quiet' }, { text: '~curious~ Voices from where?', goto: 'where' }],
        },
        where: {
          say: ['~neutral~ From anywhere. Ships, colonies, lighthouses, people a long way from home. They send a message and it crosses the dark for years, and when it reaches us the tower plays it to whoever is in the square.',
            '~happy~ Most of them aren’t for anyone here. People stop and listen anyway. That’s what a market is for, in the end: listening to strangers.'],
          choices: [{ text: '~curious~ Why did it go quiet?', goto: 'quiet' }],
        },
        quiet: {
          say: ['~solemn~ The night the sky rang. Something went over the market, low and singing, and every sign in the street showed the same picture at once: three dots over an arc. Then the tower caught one last message, and went dumb.',
            '~tired~ The antenna slipped out of tune. And the recording of that last message never reached the console. I gave it to Kip, my courier, to run it up. Kip ran off instead.'],
          do: { set: { 'bazaar.rumour.light': true } },
          choices: [{ text: '~neutral~ I’ll find Kip.', goto: 'kip' }, { text: '~curious~ Why not take it up yourself?', goto: 'self' }],
        },
        self: { say: ['~tired~ Look at my knees, love. Forty years of those blue ledges. Now I sit down here and watch other people climb.'], choices: [{ text: '~neutral~ I’ll find Kip.', goto: 'kip' }] },
        kip: {
          say: ['~neutral~ Kip lives on the skybridges and runs messages roof to roof for anyone who pays in fruit. Try the second bridge.',
            '~playful~ Get the recording and take it up to the console on the cream balcony. And mind Ferro up there: she’s been trying to tune that antenna every day since. She won’t admit she can’t.'],
          do: { advance: [Q, 'sel'] },
          choices: [{ text: '~solemn~ Then we listen.', end: true }],
        },
        again: {
          say: [{ if: { not: { has: 'recording' } }, text: '~neutral~ Kip first, love. The second skybridge. Then the antenna, then the console. Then we listen.' },
            { if: { has: 'recording' }, text: '~surprised~ You’ve got it? I can hear it humming from here. Up to the balcony, then: Ferro, the antenna, the console.' }],
          choices: [{ text: '~curious~ What’s that mark the signs showed?', goto: 'glyph', once: true }, { text: '~neutral~ On my way.', end: true }],
        },
        glyph: {
          say: ['~neutral~ {glyph} The First Sign, the painters call it. Three customers at a counter: the very first advertisement anybody ever drew.', '~playful~ Brush will tell you different. Brush tells everybody different.'],
          choices: [{ text: '~neutral~ On my way.', end: true }],
        },
        told: {
          say: ['~tired~ …', '~whisper~ That voice. You know it, don’t you? I saw your face. The whole square saw your face.'],
          choices: [
            { text: '~sad~ It was my father.', goto: 'father' },
            { text: '~sad~ It wasn’t my name.', goto: 'name' },
            { text: '~neutral~ (say nothing)', goto: 'still' },
          ],
        },
        father: {
          say: ['~solemn~ Then your father once had someone else to talk to, a long way away. Or he spoke for someone who couldn’t: the old relays did that, read out the words of families who couldn’t pay to send their own voices.',
            '~happy~ Either way, he meant it. You can hear when a man means it. The whole square heard.'],
          choices: [{ text: '~curious~ Where did it come from?', goto: 'origin' }],
        },
        name: {
          say: ['~sad~ No. It wasn’t, was it. *Ilen*. Every message is to somebody’s child, love. This one went looking for its child for forty years, and the one it found was you.'],
          choices: [{ text: '~curious~ Where did it come from?', goto: 'origin' }],
        },
        still: { say: ['~whisper~ All right. Sit with it a while. I’ll talk, you listen. It’s what this square is for.'], choices: [{ text: '~neutral~ (listen)', goto: 'origin' }] },
        origin: {
          say: ['~curious~ Here’s the strange part. The header on the recording says where it was sent from: a system nobody in this market has ever traded with.',
            '~surprised~ I looked it up while you stood there. It’s the same mark that’s stamped on your ship’s registry plate. It came from your home.'],
          do: { set: { 'clue.bazaar.home': true } },
          choices: [{ text: '~sad~ From home.', goto: 'home' }],
        },
        home: {
          say: ['~solemn~ From home. Forty years on the way, to tell somebody they’re not alone. And look: everybody heard it.',
            '~solemn~ (Across the square the signs have stopped selling. Every one of them says the same thing.)'],
          do: { advance: [Q, 'sel2'] },
          choices: [{ text: '~happy~ Thank you, Sel.', end: true }],
        },
        after: { say: ['~happy~ The tower’s talking again. Mostly noodle adverts, between the messages. But it’s talking.'], choices: [{ text: '~happy~ Keep listening, Sel.', end: true }] },
      },
    },
  },

  kip: {
    id: 'kip', name: 'Kip', title: 'courier of the skybridges', color: '#f0a083', voice: 1.5, kind: 'f', scale: 0.78,
    palette: { cloak: '#f0a083', lining: '#465c65', cloth: '#88b4b5', legs: '#465c65', hat: '#ebce98', hair: '#4a3226' }, head: 'hair', cape: 0.5,
    lines: ['~playful~ Fastest feet in the market!', '~playful~ I’m not in trouble. I’m resting.', '~shout~ Messages! Messages for fruit!'],
    talk: {
      entry: [
        { if: ON_AIR, node: 'heard' },
        { if: { flag: 'bazaar.kip.gave' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~scared~ Are you from the tower? Did Sel send you? I’m not in trouble. I’m resting.', '~happy~ I’m Kip. I run messages across the bridges. Fastest feet in the market.'],
          choices: [{ text: '~neutral~ Sel says you have the last recording.', goto: 'recording' }, { text: '~curious~ What do you run?', goto: 'run' }],
        },
        run: { say: ['~playful~ Love letters, bills, fish orders, threats. Mostly fish orders. People pay in fruit. I have a lot of fruit.'], choices: [{ text: '~neutral~ Sel says you have the last recording.', goto: 'recording' }] },
        recording: {
          say: ['~sad~ …Yes. Here. It’s been in my bag since the night the sky rang.',
            '~surprised~ When it came in off the antenna it was *singing*. Recordings aren’t supposed to sing. Like a glass bowl rubbed with a wet finger, all round the words. And every sign in the street blinked the same mark at once.',
            '~scared~ I got scared and ran. I’ve carried it ever since. It hums against my back when I sleep.'],
          do: [{ give: 'recording' }, { set: { 'bazaar.kip.gave': true } }, { advance: [Q, 'kip'] }],
          choices: [{ text: '~curious~ Did you hear what it said?', goto: 'said' }, { text: '~neutral~ I’ll take it up.', goto: 'up' }],
        },
        said: { say: ['~whisper~ Only the singing. And a voice under it, very small: a man’s voice, saying a name that isn’t anybody’s here.'], choices: [{ text: '~neutral~ I’ll take it up.', goto: 'up' }] },
        up: {
          say: ['~playful~ The console’s on the cream balcony, halfway up the tower. Blue ledges, or your jetpack, or a cab. But it won’t play until the antenna’s tuned. Ferro’s up there trying. Ferro’s always up there trying.'],
          choices: [{ text: '~happy~ Thanks, Kip.', end: true }],
        },
        again: { say: ['~curious~ Did you play it yet? Is it still singing?'], choices: [{ text: '~neutral~ Not yet.', end: true }] },
        heard: {
          say: ['~surprised~ I heard it from up here! Everybody stopped. Even the fish man stopped.', '~playful~ I’m glad I didn’t throw it in the canal. I nearly did. Twice.'],
          choices: [{ text: '~happy~ I’m glad too.', end: true }],
        },
      },
    },
  },

  ferro: {
    id: 'ferro', name: 'Ferro', title: 'who rigs the antenna', color: '#c99758', voice: 1.0, kind: 'f',
    palette: { cloak: '#c99758', lining: '#3a535b', cloth: '#3a535b', legs: '#465c65', hat: '#88b4b5', hair: '#2b211f' }, head: 'hat', cape: 0.4,
    lines: ['~angry~ Don’t touch that. That’s live.', '~angry~ Three bulbs. Three!', '~playful~ Hold still, you beautiful idiot of an antenna.'],
    talk: {
      entry: [{ if: { flag: 'bazaar.antenna.tuned' }, node: 'tuned' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~angry~ Don’t touch anything. Not that; that’s live. Not that either.', '~tired~ Ferro. I rig the antenna. I’ve been up here every day since the night the sky rang, and it won’t hold a tune.'],
          choices: [{ text: '~curious~ What’s wrong with it?', goto: 'wrong' }, { text: '~curious~ Did you see the singing light?', goto: 'light', once: true }],
        },
        wrong: {
          say: ['~neutral~ Look up at the top: three bulbs over a dish. The tuning mark. {glyph} They have to be lit all at once, or the dish can’t find the signal.',
            '~tired~ I light one, climb down, light the next, and the first has gone dark again. Nobody has three hands and a long enough ladder.'],
          choices: [{ text: '~playful~ I can hit all three from here.', goto: 'you' }],
        },
        you: {
          say: ['~surprised~ From here? With what, your— oh. That thing on your hand. That shoots? Go on, then. Three bulbs, quick as you like, before the first one fades.',
            '~neutral~ (*Shoot* each bulb: aim with R or the right mouse button, fire with G or a left click. The tank holds three.)'],
          choices: [{ text: '~playful~ Stand back.', end: true }],
        },
        light: {
          say: ['~solemn~ I was up here when it passed. Low over the square, ringing, turning slowly, as if it were reading the signs. Every bulb on the antenna lit by itself.', '~sad~ Then they all went out, and the dish slipped, and the tower went quiet.'],
          do: { set: { 'bazaar.rumour.light': true } },
          choices: [{ text: '~curious~ What’s wrong with it?', goto: 'wrong' }],
        },
        tuned: {
          say: [{ if: { not: ON_AIR }, text: '~happy~ Listen to that hum. That’s a tuned antenna. That’s the whole dark sky, ready to talk. The console’s right there: have you got something to play?' },
            { if: ON_AIR, text: '~happy~ Forty years old, that message, and it came in clear as a bell. Good antenna. Good, good antenna.' }],
          choices: [{ text: '~happy~ Thanks, Ferro.', end: true }],
        },
      },
    },
  },

  brush: {
    id: 'brush', name: 'Brush', title: 'who repaints the signs', color: '#e4bd83', voice: 1.05, kind: 'm',
    palette: { cloak: '#e4bd83', lining: '#465c65', cloth: '#f0a083', legs: '#3a535b', hat: '#88b4b5', hair: '#6e4a32' }, head: 'hat', cape: 0,
    lines: ['~neutral~ Careful, wet paint.', '~tired~ A thousand signs. One brush.', '~playful~ Nobody looks up. Good for business; bad for art.'],
    talk: {
      entry: [
        { if: { quest: 'bazaar.oldsign', done: true }, node: 'after' },
        { if: { flag: 'bazaar.oldsign.awake' }, node: 'read' },
        { if: { quest: 'bazaar.oldsign', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~playful~ Careful, wet paint. Everything in this market is wet paint; it’s the only way to keep up.', '~tired~ Brush. I repaint the signs. A thousand of them. By the time I finish the last one, the first needs doing again.'],
          choices: [{ text: '~curious~ Which is the oldest sign?', goto: 'oldest' }, { text: '~curious~ What’s the mark on the old shop?', goto: 'glyph', once: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        glyph: {
          say: ['~angry~ {glyph} Sel says three customers at a counter. Rubbish. It’s three listeners and the edge of the world: three heads, and the horizon they’re listening past.', '~solemn~ Nobody painted it. It was here when the first painters came. We just keep it fresh.'],
          choices: [{ text: '~curious~ Which is the oldest sign?', goto: 'oldest' }],
        },
        oldest: {
          say: ['~neutral~ The oldest sign in the market isn’t one of mine. Nobody paints it. It hangs under the second skybridge, back up the avenue, dark as a slate; everybody walks under it every day and nobody looks up.',
            '~curious~ They say it was the first sign ever hung here, before the market was a market. If you could wake it… a drop of something bright on its face, maybe. Those old plates drink light.'],
          do: { start: 'bazaar.oldsign' },
          choices: [{ text: '~neutral~ I’ll try.', end: true }],
        },
        waiting: { say: ['~playful~ Under the second bridge. Look up for once! Give it something bright.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        read: {
          say: ['~surprised~ You woke it? You actually— what does it say? Tell me exactly. Exactly!'],
          choices: [{ text: '~solemn~ The mark, and under it: WE HEARD YOU.', goto: 'meaning' }],
        },
        meaning: {
          say: ['~whisper~ *We heard you*. Not buy. Not eat. *We heard you.*',
            '~solemn~ So that’s what this place was, before it was a market: people who answered. The first thing anybody ever sold here was an answer.',
            '~happy~ I’m going to paint it on every sign I touch, in the corner, small. Nobody will notice. That’s fine.'],
          do: { advance: ['bazaar.oldsign', 'tell'] },
          choices: [{ text: '~happy~ I’ll notice.', end: true }],
        },
        after: { say: ['~happy~ Look: bottom corner. WE HEARD YOU. Sixty-one signs so far.'], choices: [{ text: '~happy~ I see it.', end: true }] },
      },
    },
  },
};

// The market's own people (content.js npcs 0–2).
export const STREET = {
  doss: {
    id: 'doss', name: 'Doss', title: 'who welcomes everyone', color: '#dca273',
    talk: { nodes: {
      hello: {
        say: ['~happy~ Welcome to the Signal Market! A thousand signs, a thousand voices, and one of them quiet.'],
        choices: [{ text: '~curious~ Which one is quiet?', goto: 'quiet' }, { text: '~curious~ How do I get up high?', goto: 'up' }, { text: '~neutral~ Goodbye.', end: true }],
      },
      quiet: { say: ['~sad~ The broadcast tower, at the end of the avenue. It went silent the night the sky rang. Madame Sel sits at its foot, waiting for someone to care.'], choices: [{ text: '~curious~ How do I get up there?', goto: 'up' }, { text: '~neutral~ Thanks.', end: true }] },
      up: { say: ['~neutral~ Blue ledges up the front of the tower, or the parked cab right here, or that pack on your back. The skybridges are for walking; mind the gaps.'], choices: [{ text: '~happy~ Thanks.', end: true }] },
    } },
  },
  oyo: {
    id: 'oyo', name: 'Oyo', title: 'who sells lanterns', color: '#84bab3',
    talk: { nodes: {
      hello: {
        say: ['~shout~ Every lantern holds a little sun. Fresh suns, cheap!', '~surprised~ The night the sky rang, every lantern on my stall went out at once. Then they lit again one by one, in a colour I’ve never sold.'],
        choices: [{ text: '~curious~ What colour?', goto: 'colour' }, { text: '~curious~ Any other rumours?', goto: 'rumours' }, { text: '~neutral~ Goodbye.', end: true }],
      },
      colour: { say: ['~playful~ The colour of a bruise when it’s healing. I sold them all by morning. People like a story.'], do: { set: { 'bazaar.rumour.light': true } }, choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      rumours: { say: ['~playful~ They say the silent tower was the only one that told the truth. They say the quiet ones can hear thoughts. They say the noodle man is three noodle men in a coat. One of those is true.'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
    } },
  },
  teb: {
    id: 'teb', name: 'Teb', title: 'cab tout', color: '#c3a9cc',
    talk: { nodes: {
      hello: {
        say: ['~neutral~ The cream balcony has the old transmitter. Want a lift? Cabs circle the tower all day. Wave at one.'],
        choices: [{ text: '~curious~ Who are the quiet ones?', goto: 'quiet' }, { text: '~neutral~ Goodbye.', end: true }],
      },
      quiet: { say: ['~whisper~ The lavender folk with the big heads? They came with the market, or the market came with them. They don’t talk. They listen. When they all turn their heads at once, something’s about to happen.'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
    } },
  },
};

// The scenery you can look at, and the quiet one who speaks through a screen.
export const THINGS = {
  console: {
    id: 'console', name: 'The console', title: 'on the broadcast balcony', color: '#f0a083', voice: 0.6,
    talk: {
      entry: [{ if: ON_AIR, node: 'on' }, { if: { has: 'recording' }, node: 'untuned' }, { node: 'dead' }],
      nodes: {
        dead: { say: ['~neutral~ An old console, warm under your hand. A slot for a recording cylinder, empty. A dial that should glow, dark.', '~neutral~ Above it the antenna creaks, out of tune.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
        untuned: { say: ['~tired~ You fit the recording into the slot. The console hisses, sings a little, and gives up: dead air. The antenna isn’t holding a tune.', '~neutral~ (Light the antenna’s three bulbs at once first.)'], choices: [{ text: '~neutral~ (take it out again)', end: true }] },
        on: { say: ['~solemn~ The console glows. Somewhere in the dark, someone is always talking.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  oldSign: {
    id: 'oldSign', name: 'The oldest sign', title: 'under the second skybridge', color: '#3b4547', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'bazaar.oldsign.awake' }, node: 'awake' }, { node: 'dark' }],
      nodes: {
        dark: { say: ['~neutral~ A dark plate hangs under the bridge on two straps, older than everything around it, the colour of slate.', '~neutral~ Old plates drink light. (*Shoot* it with the fluid.)'], choices: [{ text: '~neutral~ (step back)', end: true }] },
        awake: { say: ['~solemn~ The old plate glows: the mark, {glyph}, and under it, in block letters older than the market: WE HEARD YOU.'], choices: [{ text: '~neutral~ (read it again)', end: true }] },
      },
    },
  },
  crates: {
    id: 'crates', name: 'The fallen crates', title: 'in the alley mouth', color: '#c99758', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ Crates of seven-moon fruit, fallen in a heap against the shop front. Under them something brass catches the light.', '~neutral~ Far too heavy to shift by hand. A good shove of the fluid might do it. (*Push*: C, middle click, or B / ○.)'],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  ummu: {
    id: 'ummu', name: 'Ummu', title: 'one of the quiet ones', color: '#b9a9c5', voice: 0.45,
    talk: {
      entry: [
        { if: { quest: 'bazaar.bowl', done: true }, node: 'after' },
        { if: { has: 'bowl' }, node: 'give' },
        { if: { quest: 'bazaar.bowl', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ (The quiet one turns its whole broad head toward you, slowly. Its tiny eyes blink. On the little screen above it, letters crawl into place:)',
            '~playful~ YOU ARE LOUD. WE LIKE IT.',
            '~sad~ (The letters wipe, and write again:) WE LOST OUR BOWL WHEN THE SKY RANG. UNDER THE BOXES. TOO HEAVY FOR LISTENERS.'],
          do: [{ emit: ['bazaar:ummu', 'YOU ARE\nLOUD'] }, { start: 'bazaar.bowl' }],
          choices: [{ text: '~curious~ What do you listen to?', goto: 'listen' }, { text: '~neutral~ I’ll move the boxes.', end: true }],
        },
        listen: {
          say: ['~whisper~ EVERYTHING. THE SIGNS. THE CABS. YOUR HEART, A LITTLE FAST.', '~solemn~ THE BOWL HEARS FURTHER. FAR AWAY, SOMEONE IS CALLING A NAME.'],
          do: { emit: ['bazaar:ummu', 'WE\nLISTEN'] },
          choices: [{ text: '~neutral~ I’ll move the boxes.', end: true }],
        },
        waiting: {
          say: ['~playful~ UNDER THE BOXES. PUSH. YOU HAVE A PUSH. WE HEARD IT.', '~neutral~ (*Push*: C, middle click, or B / ○.)'],
          do: { emit: ['bazaar:ummu', 'PUSH'] },
          choices: [{ text: '~neutral~ All right.', end: true }],
        },
        give: {
          say: ['~solemn~ (You hold out the dented brass bowl. The quiet one takes it in both hands, lifts it to the side of its head, and goes very still.)',
            '~happy~ THANK YOU.',
            '~solemn~ IT IS QUIET UP THERE, AND VERY BIG. SOMEONE IS STILL CALLING. NOT FOR US. FOR SOMEONE LIKE YOU.',
            '~happy~ (It hums: a low, kind note. Along the avenue, one by one, the other quiet ones hum it back.)'],
          do: [{ take: 'bowl' }, { advance: 'bazaar.bowl' }, { emit: ['bazaar:ummu', 'THANK\nYOU'] },
            { keepsake: { id: 'bazaar.song', level: 'bazaar', name: 'The quiet ones’ hum', kind: 'song', text: 'The quiet ones don’t speak. They hum back what they hear, a little kinder than it was.' } }],
          choices: [{ text: '~happy~ (hum back)', end: true }],
        },
        after: {
          say: [{ if: { not: ON_AIR }, text: '~happy~ (The quiet one hums at you. On the screen: HELLO AGAIN, LOUD ONE.)' }, { if: ON_AIR, text: '~solemn~ (The screen writes, slowly:) WE HEARD IT TOO. YOU ARE NOT ALONE. NEITHER ARE WE.' }],
          do: { emit: ['bazaar:ummu', 'HELLO\nAGAIN'] },
          choices: [{ text: '~happy~ (hum)', end: true }],
        },
      },
    },
  },
  broadcast: {
    id: 'broadcast', name: 'The broadcast', title: 'from very far away', color: '#f3ead8', voice: 0.66, kind: 'm', narrator: true, lang: 'home',   // your father's voice, in your own tongue (only the *quoted* words are voiced)
    talk: { nodes: {
      play: {
        say: [
          '~solemn~ (The screens on the tower go white, every one of them at once. The square falls quiet under them. A hiss like rain on a roof, and then a voice fills the whole market: warm, a little hoarse, much younger than you have ever heard it.)',
          '~solemn~ *Ilen. If this reaches you, you are further out than anyone from home has ever gone. The relay says it will take years to get there. So I am talking to someone older than the child who left.*',
          '~sad~ *I said things at the port that I want back. I told you to make us proud. I told you to bring back something worth the trip.*',
          '~happy~ *Forget all that. Don’t bring anything. Nothing out there is worth more than you, walking back in through our door on your own two feet.*',
          '~whisper~ *And if it is dark where you are, and quiet, and nobody there knows your name: you are not alone. Someone is listening for you. I am. Every night, I am.*',
          '~whisper~ (A pause, and the long hiss of a very long way. Then, more quietly:) *Come home when you’re ready, Ilen. Not before.*',
          '~solemn~ (The voice stops. The screens stay white a moment longer. Nobody in the square moves.)',
          '~sad~ It was your father’s voice. It was not your name.',
        ],
        choices: [{ text: '~solemn~ (stand very still)', end: true }],
      },
    } },
  },
};

// What crowd people say when you stop beside them (balloons), by where they are.
export const LINES = {
  market: ['~shout~ Fruit from seven moons! Pick one.', '~neutral~ Hail a cab if your feet get tired.', '~curious~ Nobody remembers who drew the first advertisement.', '~whisper~ The quiet ones listen with their whole heads.', '~shout~ Noodles! Noodles that remember you!', '~curious~ Have you seen Madame Sel? She sits under the quiet tower.'],
  square: ['~sad~ The tower used to talk, you know.', '~playful~ One tower’s silent. Imagine that, here.', '~neutral~ Sel’s waiting for somebody to climb it.', '~curious~ Did the sky ring where you come from too?', '~sad~ The last broadcast is still up there, somewhere.'],
  bridge: ['~neutral~ Mind the gap, it’s a long way down.', '~neutral~ Kip runs these bridges faster than the cabs.', '~happy~ Best view of the signs is from up here.', '~playful~ Don’t look down. Or do; it’s pretty.'],
  onAir: ['~surprised~ Did you hear it?', '~sad~ Somebody’s child…', '~solemn~ The tower told the truth again.', '~solemn~ You are not alone. It said that. To all of us.', '~happy~ I’m going to call my mother.', '~surprised~ Forty years on the way!'],
  shout: ['~shout~ Listen!', '~shout~ The tower!', '~shout~ It’s talking!', '~whisper~ Shh! Listen!'],
};

const bye = { text: '~neutral~ Goodbye.', end: true };
/** Short conversations for people in the crowd, by where they are. Picked by their seed. */
export const CROWD_TALK = {
  market: [
    { name: 'A fruit seller', title: 'of seven moons', talk: { nodes: { hello: { say: ['~happy~ Fruit from seven moons! This one’s from the fourth moon. It tastes of rain on a hot roof.'], choices: [bye] } } } },
    { name: 'A noodle cook', title: 'at the counter', talk: { nodes: { hello: { say: ['~playful~ My noodles remember your order. That’s what the sign says. It isn’t true, but it’s a very good sign.'], choices: [bye] } } } },
    { name: 'A shopper', title: 'lost', talk: { nodes: { hello: { say: ['~tired~ A thousand signs and I still can’t find the soap.'], choices: [bye] } } } },
  ],
  square: [
    { name: 'A listener', title: 'in Signal Square', talk: { nodes: {
      hello: { say: ['~sad~ I used to come here every evening to hear the tower. Messages from nowhere, for nobody. I miss the nobody.'], choices: [{ text: '~curious~ For nobody?', goto: 'who' }, bye] },
      who: { say: ['~sad~ Well, for somebody. Just never for me. That was the nice part: you could listen to love with nobody asking you to give any back.'], choices: [bye] },
    } } },
    { name: 'An old trader', title: 'in Signal Square', talk: { nodes: {
      hello: { say: ['~solemn~ The night the sky rang, every sign showed the same mark: three dots over an arc. My grandmother said that mark was here before the market. Before the signs. Before us.'], choices: [bye] },
    } } },
  ],
  bridge: [
    { name: 'A bridge walker', title: 'high above the market', talk: { nodes: { hello: { say: ['~tired~ Kip went by a minute ago with a bag that was humming. Kids.'], choices: [bye] } } } },
    { name: 'A window cleaner', title: 'on a break', talk: { nodes: { hello: { say: ['~playful~ I clean the signs from up here. You see them backwards, from behind. They all say the same thing, backwards: nothing.'], choices: [bye] } } } },
  ],
  onAir: [
    { name: 'Someone in the square', title: 'still listening', talk: { nodes: { hello: { say: ['~sad~ You were up there. You played it. I don’t even know who it was for, and I cried.'], choices: [bye] } } } },
    { name: 'A fruit seller', title: 'giving fruit away', talk: { nodes: { hello: { say: ['~happy~ I gave away a whole crate after. Everybody was being kind to everybody. Terrible for business. Wonderful.'], choices: [bye] } } } },
    { name: 'A stranger', title: 'looking up at the tower', talk: { nodes: { hello: { say: ['~happy~ *Someone is listening for you.* I needed that today. I didn’t know I did.'], choices: [bye] } } } },
  ],
};
