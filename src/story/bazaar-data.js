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
// bazaar.crates.clear; bazaar.tank.lantern (Oyo's last lantern poured into the tank: its colour
// band); clue.bazaar.home. Items: recording, bowl.

const Q = 'bazaar.signal';

export const ITEMS = { recording: 'the unsent recording', bowl: 'Ummu’s listening bowl' };
/** Oyo's last lantern, relit the night the sky rang: its little sun goes into the tank as a band (src/story/bazaar.js). */
export const LANTERN_TONE = '#b9c25a';   // “the colour of a bruise when it’s healing”: a sallow yellow-green
export const LANTERN_FLAG = 'bazaar.tank.lantern';

/** The broadcast's words, the keepsake: kept here so the calls home can quote it. */
export const KEEPSAKE = { id: 'bazaar.word', level: 'bazaar', name: 'You are not alone', kind: 'word',
  text: '“Come with empty hands. Just come. You are not alone. I’m listening for you.” Your father’s voice, years younger, to a child called Ilen.' };

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
    palette: { cloak: '#88b4b5', lining: '#465c65', cloth: '#f5dfab', legs: '#465c65', hat: '#f0a083', hair: '#e8dcc0' }, head: 'wrap', cape: 1.4, look: { body: 'badge', robe: 0.12, mask: 'glasses' },
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
            "~playful~ You noticed the quiet tower. Good. The noodle signs usually win that contest.",
            "~neutral~ Sel. I ran this tower for forty years. It received voices from space and played them to the square."],
          choices: [
            { text: '~curious~ Why did it go quiet?', goto: 'quiet' },
            { text: '~curious~ Voices from where?', goto: 'where' },
          ],
        },
        others: {
          say: ["~angry~ Buy this. Fear that. Buy something for the fear. A thousand signs, all after your purse.",
            "~solemn~ This tower carried messages from real people. The market called it the only honest sign. Even when the message was just someone saying they’d be late."],
          choices: [{ text: '~curious~ Why did it go quiet?', goto: 'quiet' }],
        },
        where: {
          say: ["~neutral~ Ships, colonies, lonely stations. Messages travel for years before reaching us. We play whatever arrives.",
            "~happy~ Most are meant for someone elsewhere. People listen anyway. You don’t have to know a person to care what happened to them."],
          choices: [{ text: '~curious~ Why did it go quiet?', goto: 'quiet' }, { text: '~curious~ What do the other signs say?', goto: 'others' }],
        },
        quiet: {
          say: ["~solemn~ The night the singing light passed, every sign showed the same mark: three dots over an arc. The tower received one last message, then went silent.",
            "~tired~ The antenna lost its tuning. Kip took the message cylinder to carry upstairs, but ran off with it instead."],
          do: { set: { 'bazaar.rumour.light': true } },
          choices: [{ text: '~neutral~ I’ll find Kip.', goto: 'kip' }, { text: '~curious~ Why not take it up yourself?', goto: 'self' }],
        },
        self: { say: ["~tired~ Forty years climbing those ledges have collected their fee from my knees. I need someone else to go up."], choices: [{ text: '~neutral~ I’ll find Kip.', goto: 'kip' }] },
        kip: {
          say: ["~neutral~ Find *Kip on the second skybridge*. Fastest courier in the market, when travelling in the correct direction.",
            "~playful~ Take the cylinder to *the console on the cream balcony*. *Ferro is there with the antenna*. She’ll need help tuning it."],
          do: { advance: [Q, 'sel'] },
          choices: [{ text: '~solemn~ Then we listen.', end: true }],
        },
        again: {
          say: [{ if: { not: { has: 'recording' } }, text: "~neutral~ Kip, second skybridge. Ferro, cream balcony. Tune the antenna, then play the cylinder at the console." },
            { if: { has: 'recording' }, text: "~surprised~ That’s the cylinder. Take it *to Ferro on the cream balcony*. Tune the antenna before you play it." }],
          choices: [{ text: '~curious~ What’s that mark the signs showed?', goto: 'glyph', once: true }, { text: '~neutral~ On my way.', end: true }],
        },
        glyph: {
          say: ["~neutral~ {glyph} The painters call it *the First Sign*. I see three customers at a counter. Occupational habit.", "~playful~ Brush thinks I’m wrong. Brush has a thriving practice in thinking people wrong."],
          choices: [{ text: '~neutral~ On my way.', end: true }],
        },
        told: {
          say: ['~tired~ …', "~whisper~ You recognised that voice. I saw. We can talk here, away from the crowd."],
          choices: [
            { text: '~sad~ It was my father.', goto: 'father' },
            { text: '~sad~ It wasn’t my name.', goto: 'name' },
            { text: '~neutral~ (say nothing)', goto: 'still' },
          ],
        },
        father: {
          say: ["~solemn~ Perhaps your father sent it to someone else. Some old relays also hired people to read messages for families. I can’t tell you which this was.",
            "~happy~ But whoever he was speaking to, he wanted them home. I heard that much."],
          choices: [{ text: '~curious~ Where did it come from?', goto: 'origin' }],
        },
        name: {
          say: ["~sad~ He said a name: *Ilen*. This message travelled thirty years looking for them. Instead, it reached you."],
          choices: [{ text: '~curious~ Where did it come from?', goto: 'origin' }],
        },
        still: { say: ["~whisper~ You don’t have to answer. Sit awhile. The square can do without us for a moment."], choices: [{ text: '~neutral~ (listen)', goto: 'origin' }] },
        origin: {
          say: ["~curious~ I checked the message header. It names the port where it was sent.",
            "~surprised~ It matches the home port on your ship’s registry plate. That voice came from your home."],
          do: { set: { 'clue.bazaar.home': true } },
          choices: [{ text: '~sad~ From home.', goto: 'home' }],
        },
        home: {
          say: ["~solemn~ Thirty years crossing the dark, and it still found someone from the same house. I’ve never seen one do that.",
            "~solemn~ (Across the square, the signs stop advertising. For once they share a message.)"],
          do: { advance: [Q, 'sel2'] },
          choices: [{ text: '~happy~ Thank you, Sel.', end: true }],
        },
        after: {
          say: ["~happy~ The tower’s back. Messages, noodle adverts, messages. Life requires both, apparently."],
          choices: [
            // once he knows who Ilen was (the mother's recording, calls.ilen.told), and once he has found her
            // (finale.met): Sel had offered two readings, and hears which it was (October 2026)
            { text: '~sad~ Ilen was my sister. She left before I was born, and never came home.', if: { all: [{ any: [{ flag: 'calls.ilen.told' }, { flag: 'finale.met' }] }, { not: { flag: 'bazaar.sel.ilen' } }] }, goto: 'sister' },
            { text: '~happy~ Ilen heard it, Sel. Thirty years late. She’s coming home.', if: { all: [{ flag: 'finale.met' }, { not: { flag: 'bazaar.sel.found' } }] }, goto: 'found' },
            { text: '~happy~ Keep listening, Sel.', end: true },
          ],
        },
        sister: {
          say: ["~solemn~ Your sister. The first reading, then. I’d hoped it was the hired voice. That one costs nobody anything.",
            "~sad~ He sent it after her, and it found you. Some messages are poor at addresses and very good at families."],
          do: { set: { 'bazaar.sel.ilen': true } },
          choices: [{ text: '~happy~ Ilen heard it, Sel. Thirty years late. She’s coming home.', if: { all: [{ flag: 'finale.met' }, { not: { flag: 'bazaar.sel.found' } }] }, goto: 'found' }, { text: '~neutral~ Keep listening, Sel.', end: true }],
        },
        found: {
          say: ["~surprised~ She heard it? (Sel takes her glasses off, and puts them back on, and takes them off again.)",
            "~happy~ Forty years of messages, and I never once learned how one ended. I’ll tell the square. They’ll pretend not to cry. Badly."],
          do: { set: { 'bazaar.sel.found': true, 'bazaar.sel.ilen': true } },
          choices: [{ text: '~happy~ Keep listening, Sel.', end: true }],
        },
      },
    },
  },

  kip: {
    // (a child of eleven, running messages across the bridges: docs/makehuman.md stage 3)
    id: 'kip', name: 'Kip', title: 'courier of the skybridges', color: '#f0a083', voice: 1.5, kind: 'f', scale: 0.78, age: 'child', years: 11,
    palette: { cloak: '#f0a083', lining: '#465c65', cloth: '#88b4b5', legs: '#465c65', hat: '#ebce98', hair: '#4a3226' }, head: 'hair', cape: 0.5, look: { head: 'peak', under: 'bob', body: 'neckerchief' },
    lines: ['~playful~ Fastest feet in the market!', '~playful~ I’m not in trouble. I’m resting.', '~shout~ Messages! Messages for fruit!'],
    talk: {
      entry: [
        { if: ON_AIR, node: 'heard' },
        { if: { flag: 'bazaar.kip.gave' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~scared~ Sel sent you? I haven’t stolen anything. I’m late. There’s a professional distinction.", "~happy~ Kip. Fastest courier on the bridges. Currently resting the evidence."],
          choices: [{ text: '~neutral~ Sel says you have the last recording.', goto: 'recording' }, { text: '~curious~ What do you run?', goto: 'run' }],
        },
        run: { say: ["~playful~ Letters, bills, threats. Fish orders, mostly. People pay in fruit. I could retire if retirement accepted pears."], choices: [{ text: '~neutral~ Sel says you have the last recording.', goto: 'recording' }] },
        recording: {
          say: ["~sad~ I’ve got Sel’s cylinder. Here. Since the night the sky rang.",
            "~surprised~ It arrived *singing*. A note around the voice, like a tuning fork held to a speaker. Every street sign flashed the same mark. Cylinders aren’t supposed to do that.",
            "~scared~ I ran. Took it with me. It’s hummed against my back ever since. Not my cleverest escape."],
          do: [{ give: 'recording' }, { set: { 'bazaar.kip.gave': true } }, { advance: [Q, 'kip'] }],
          choices: [{ text: '~curious~ Did you hear what it said?', goto: 'said' }, { text: '~neutral~ I’ll take it up.', goto: 'up' }],
        },
        said: { say: ["~whisper~ A man underneath the singing. Saying a name. Nobody here answered to it."], choices: [{ text: '~neutral~ I’ll take it up.', goto: 'up' }] },
        up: {
          say: ["~playful~ *Cream balcony, halfway up the tower.* Climb the blue ledges, use your jets, or take a cab. *Help Ferro tune the antenna* before trying the console."],
          choices: [{ text: '~happy~ Thanks, Kip.', end: true }],
        },
        again: { say: ['~curious~ Did you play it yet? Is it still singing?'], do: { advance: [Q, 'kip'] }, choices: [{ text: '~neutral~ Not yet.', end: true }] },
        heard: {
          say: ["~surprised~ Heard it up here. Everyone stopped. Even the fish man, and silence costs him money.", "~playful~ Nearly threw the cylinder off the bridge. Glad I didn’t. Very glad."],
          do: { advance: [Q, 'kip'] },
          choices: [{ text: '~happy~ I’m glad too.', end: true }],
        },
      },
    },
  },

  ferro: {
    id: 'ferro', name: 'Ferro', title: 'who rigs the antenna', color: '#c99758', voice: 1.0, kind: 'f',
    palette: { cloak: '#c99758', lining: '#3a535b', cloth: '#3a535b', legs: '#465c65', hat: '#88b4b5', hair: '#2b211f' }, head: 'hat', cape: 0.4, look: { prop: 'wrench', mask: 'browgoggles', head: 'bandana', under: 'tail', body: 'toolbelt' },
    lines: ['~angry~ Don’t touch that. That’s live.', '~angry~ Three bulbs. Three!', '~playful~ Hold still, you beautiful idiot of an antenna.'],
    talk: {
      entry: [{ if: { flag: 'bazaar.antenna.tuned' }, node: 'tuned' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~angry~ Don’t touch that. Live wire. That one too. You may touch the floor.", "~tired~ Ferro. Antenna rigger. Been trying to tune it since the singing light passed. I’ve developed several new complaints about ladders."],
          choices: [{ text: '~curious~ What’s wrong with it?', goto: 'wrong' }, { text: '~curious~ Did you see the singing light?', goto: 'light', once: true }],
        },
        wrong: {
          say: ["~neutral~ See *three bulbs over the dish*? {glyph} All three must be lit together to tune the antenna.",
            "~tired~ By the time I climb to the next, the first goes dark. The designers appear to have expected a person with three bodies."],
          choices: [{ text: '~playful~ I can hit all three from here.', goto: 'you' }],
        },
        you: {
          say: ["~surprised~ You can shoot from here? Good. *Hit all three bulbs quickly*, before the first fades.",
            "~neutral~ Aim with {key:aim}, fire with {key:fire}. One shot a bulb, and your tank holds three, so don’t get creative."],
          choices: [{ text: '~playful~ Stand back.', end: true }],
        },
        light: {
          say: ["~solemn~ The light passed close above us. It turned as though inspecting the signs. All three antenna bulbs lit by themselves.", "~sad~ Then everything went dark. The dish shifted out of tune and the tower stopped broadcasting.", "~curious~ The dish still pulls toward where the light went. It pulls toward your ship too. Same magnetic trace, I’d say."],
          do: { set: { 'bazaar.rumour.light': true } },
          choices: [{ text: '~curious~ What’s wrong with it?', goto: 'wrong' }],
        },
        tuned: {
          say: [{ if: { not: ON_AIR }, text: "~happy~ That hum means we’re tuned. *Put the cylinder in the console beside us.* Let’s hear what survived." },
            { if: ON_AIR, text: "~happy~ Thirty-year-old message, perfectly clear. Good antenna. I’m going to say that again when nobody’s listening." }],
          choices: [{ text: '~happy~ Thanks, Ferro.', end: true }],
        },
      },
    },
  },

  brush: {
    id: 'brush', name: 'Brush', title: 'who repaints the signs', color: '#e4bd83', voice: 1.05, kind: 'm',
    palette: { cloak: '#e4bd83', lining: '#465c65', cloth: '#f0a083', legs: '#3a535b', hat: '#88b4b5', hair: '#6e4a32' }, head: 'hat', cape: 0, look: { head: 'beret', under: 'curls', body: 'neckerchief', trim: 'patches' },
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
          say: ["~playful~ Mind the paint. In this market, something is always newly improved and still wet.", "~tired~ Brush. A thousand signs to repaint. Finishing is a superstition I gave up years ago."],
          choices: [{ text: '~curious~ Which is the oldest sign?', goto: 'oldest' }, { text: '~curious~ What’s the mark on the old shop?', goto: 'glyph', once: true }],
        },
        glyph: {
          say: ["~angry~ {glyph} Customers at a counter? Sel would say that. I see three listeners above the horizon. An audience before there was anything to sell.", "~solemn~ That mark was here before the painters. We only keep the colour fresh."],
          choices: [{ text: '~curious~ Which is the oldest sign?', goto: 'oldest' }],
        },
        oldest: {
          say: ["~neutral~ Find *the oldest sign under the second skybridge*, back along the avenue. Dark slate. Nobody looks above their shopping.",
            "~curious~ Try *shooting bright fluid onto the sign*. The old plates absorb light. Maybe it still has something to say."],
          do: { start: 'bazaar.oldsign' },
          choices: [{ text: '~neutral~ I’ll try.', end: true }],
        },
        waiting: { say: ["~playful~ Under the second skybridge. Look up and shoot the dark sign with fluid."], choices: [{ text: '~neutral~ I will.', end: true }] },
        read: {
          say: ["~surprised~ It lit up? What did it say? Exact words, please. Lettering matters."],
          choices: [{ text: '~solemn~ The mark, and under it: WE HEARD YOU.', goto: 'meaning' }],
        },
        meaning: {
          say: ['~whisper~ *We heard you*. Not buy. Not eat. *We heard you.*',
            "~solemn~ WE HEARD YOU. So the first thing offered here was an answer. I’d like to put that back into circulation.",
            "~happy~ I’ll paint it in the corners of my signs. Small enough that they let it stay. Large enough to find."],
          do: { advance: ['bazaar.oldsign', 'tell'] },
          choices: [{ text: '~happy~ I’ll notice.', end: true }],
        },
        after: { say: ["~happy~ Bottom corner. WE HEARD YOU. Sixty-one signs so far. Quiet work adds up."], choices: [{ text: '~happy~ I see it.', end: true }] },
      },
    },
  },
};

// The market's own people (content.js npcs 0–2).
export const STREET = {
  doss: {
    id: 'doss', name: 'Doss', title: 'who welcomes everyone', color: '#dca273', head: 'wrap', look: { body: 'badge' },
    talk: { listen: [
        "~happy~ Signal Market! A thousand voices competing for your attention. One tower has gracefully withdrawn.",
        { if: { not: ON_AIR }, say: '~sad~ *The broadcast tower*, at the end of the avenue. It went silent the night the sky rang. *Madame Sel* sits at its foot, waiting for somebody to care.' },
        { if: { not: ON_AIR }, say: '~neutral~ Up the tower? *The blue ledges up its front*, or the parked cab right here, or that pack on your back. The skybridges are for walking; mind the gaps.' },
        '~playful~ Welcome! Welcome. Oh, you again. Welcome anyway; it’s my job.',
        '~curious~ The first thing anybody ever sold here was an answer. Then somebody sold the question, and we never looked back.',
        { after: ON_AIR, say: '~happy~ The tower spoke! I’ve been welcoming people all morning, and they keep welcoming me back.' },
        { after: { flag: 'temple.bazaar.done' }, say: '~solemn~ They say the tower says the whole line once a night now, from the old stones under it. I stay up for it. Everybody does.' },
      ] },
  },
  oyo: {
    id: 'oyo', name: 'Oyo', title: 'who sells lanterns', color: '#84bab3', look: { head: 'skullcap', under: 'crop', mask: 'glasses', prop: 'lantern' },
    talk: { nodes: {
      hello: {
        say: ['~shout~ Every lantern holds a little sun. Fresh suns, cheap!', "~surprised~ That night every lantern on my stall went out. Then they relit in a colour I’d never stocked."],
        choices: [{ text: '~curious~ What colour?', goto: 'colour' }, { text: '~curious~ Any other rumours?', goto: 'rumours' }],
      },
      colour: { say: ["~playful~ Like a bruise fading. Surprisingly popular. Sold the lot by morning, with a complimentary story."], do: { set: { 'bazaar.rumour.light': true } },
        choices: [{ text: '~curious~ All of them? Not one left, for my tank?', if: { all: [{ flag: 'item.backpack' }, { not: { flag: LANTERN_FLAG } }] }, goto: 'tank' }, { text: '~neutral~ Goodbye.', end: true }] },
      // the market's colour band for the tank (src/story/bazaar.js pours it in when the flag is set)
      tank: { say: ["~whisper~ Kept one under the stall. I’m allowed to be a collector occasionally."], next: 'pour' },
      pour: { say: ["~playful~ (He pours its light into your hose.) There. A little sun for the road. No returns on sunshine."], do: { set: { [LANTERN_FLAG]: true } },
        choices: [{ text: '~happy~ Thank you, Oyo.', end: true }] },
      rumours: { say: ["~playful~ They say the quiet ones read minds. They say the tower tells the truth. They say the noodle man is three people in a coat. I only trust the noodles."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
    } },
  },
  teb: {
    id: 'teb', name: 'Teb', title: 'cab tout', color: '#c3a9cc', look: { head: 'flatcap', body: 'muffler' },
    talk: { listen: [
        { if: { not: ON_AIR }, say: "~neutral~ The transmitter’s *on the cream balcony*. Need a cab? *Wave at one circling the tower.*" },
        ['~whisper~ The quiet ones? The lavender folk with the big heads. They came with the market, or the market came with them.', '~whisper~ They don’t talk. They listen. When they all turn their heads at once, something’s about to happen.'],
        '~shout~ Cab! Cab! Not you, you’re not a cab. Move, you’re in my wave.',
        { if: { not: { quest: 'bazaar.oldsign', done: true } }, say: '~curious~ The oldest sign in the market hangs *under the second skybridge*. Dark for years. Give it a shot of something; signs like attention.' },
        '~playful~ Fares are cheap, views are free, and the drop is extra.',
        { after: ON_AIR, say: '~happy~ Every cab in the sky stopped to listen. First traffic jam in thirty years. Beautiful.' },
      ] },
  },
};

// The scenery you can look at, and the quiet one who speaks through a screen.
export const THINGS = {
  console: {
    id: 'console', name: 'The console', title: 'on the broadcast balcony', color: '#f0a083', voice: 0.6,
    talk: {
      entry: [{ if: ON_AIR, node: 'on' }, { if: { has: 'recording' }, node: 'untuned' }, { node: 'dead' }],
      nodes: {
        dead: { say: ["~neutral~ An empty cylinder slot. A dark tuning dial. The old console is warm beneath your hand.", '~neutral~ Above it the antenna creaks, out of tune.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
        untuned: { say: ["~tired~ The cylinder fits. Hiss, a thin note, then silence. *The antenna needs tuning* before the message can play.", '~neutral~ (*Light the antenna’s three bulbs at once* first.)'], choices: [{ text: '~neutral~ (take it out again)', end: true }] },
        on: { say: ["~solemn~ The console glows. More voices are crossing the dark toward it."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  oldSign: {
    id: 'oldSign', name: 'The oldest sign', title: 'under the second skybridge', color: '#3b4547', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'bazaar.oldsign.awake' }, node: 'awake' }, { node: 'dark' }],
      nodes: {
        dark: { say: ["~neutral~ A slate-coloured sign hangs beneath the bridge. Its straps are newer than the plate, and very old themselves.", '~neutral~ Old plates drink light. (*Shoot* it with the fluid.)'], choices: [{ text: '~neutral~ (step back)', end: true }] },
        awake: { say: ["~solemn~ The plate lights up. Beneath {glyph}, four words: WE HEARD YOU."], choices: [{ text: '~neutral~ (read it again)', end: true }] },
      },
    },
  },
  crates: {
    id: 'crates', name: 'The fallen crates', title: 'in the alley mouth', color: '#c99758', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ Fruit crates block the shop front. *A brass bowl* glints beneath them.", "~neutral~ *Push the heavy crates aside with fluid*: switch the gun to push with {key:mode}, then aim and shoot."],
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
          say: ["~neutral~ (The listener turns its broad head. Words appear on the screen above it.)",
            '~playful~ YOU ARE LOUD. WE LIKE IT.',
            "~sad~ (New words appear.) OUR BOWL IS *UNDER THE BOXES*. IT FELL WHEN THE SKY RANG. WE CANNOT LIFT THEM."],
          do: [{ emit: ['bazaar:ummu', 'YOU ARE\nLOUD'] }, { start: 'bazaar.bowl' }],
          choices: [{ text: '~curious~ What do you listen to?', goto: 'listen' }, { text: '~neutral~ I’ll move the boxes.', end: true }],
        },
        listen: {
          say: ["~whisper~ SIGNS. TAXIS. YOUR HEART. IT HAS PICKED UP SPEED.", "~solemn~ THE BOWL HELPS US HEAR FARTHER. SOMEONE OUT THERE KEEPS CALLING A NAME."],
          do: { emit: ['bazaar:ummu', 'WE\nLISTEN'] },
          choices: [{ text: '~neutral~ I’ll move the boxes.', end: true }],
        },
        waiting: {
          say: ['~playful~ *UNDER THE BOXES*. PUSH. YOU HAVE A PUSH. WE HEARD IT.', '~playful~ (New words appear.) TURN YOUR GUN TO PUSH: {key:mode}. THEN AIM. THEN SHOOT. WE WILL LISTEN.'],
          do: { emit: ['bazaar:ummu', 'PUSH'] },
          choices: [{ text: '~neutral~ All right.', end: true }],
        },
        give: {
          say: ["~solemn~ (The listener accepts the dented bowl, raises it to one ear, and becomes completely still.)",
            '~happy~ THANK YOU.',
            "~solemn~ SO MUCH QUIET. ONE VOICE INSIDE IT. STILL CALLING FOR SOMEONE.",
            "~happy~ (It hums a low note. Other listeners answer along the avenue.)"],
          do: [{ take: 'bowl' }, { advance: 'bazaar.bowl' }, { emit: ['bazaar:ummu', 'THANK\nYOU'] },
            { keepsake: { id: 'bazaar.song', level: 'bazaar', name: 'The quiet ones’ hum', kind: 'song', text: 'The quiet ones don’t speak. They hum back what they hear, a little kinder than it was.' } }],
          choices: [{ text: '~happy~ (hum back)', end: true }],
        },
        after: {
          say: [{ if: { not: ON_AIR }, text: "~happy~ (A hum of recognition. The screen reads: HELLO AGAIN. YOUR HEART SOUNDS BETTER.)" }, { if: ON_AIR, text: "~solemn~ (The screen lights.) WE HEARD THE MESSAGE TOO. WE WILL REMEMBER IT." }],
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
          "~solemn~ (Every tower screen turns white. The square quiets. Through a hiss comes your father’s voice, younger than you remember.)",
          "~solemn~ *Ilen. They say this message may take years to reach you. You’ll be older when you hear it. I keep trying to picture you.*",
          "~sad~ *At the port, I told you to make us proud. Bring back something of value. I’ve wished I could take those words back every day since.*",
          "~solemn~ *You don’t owe us a prize. Nothing out there is worth more than you walking back through our door. Come with empty hands. Just come.*",
          "~whisper~ *If it’s dark where you are, and nobody knows your name: you are not alone. I’m listening for you. Every night.*",
          "~whisper~ (A long pause through the hiss.) *Come home when you’re ready, Ilen. We have room for you.*",
          "~solemn~ (The voice ends. White screens glow above a motionless square.)",
          '~sad~ It was your father’s voice. It was not your name.',
        ],
        choices: [{ text: '~solemn~ (stand very still)', end: true }],
      },
    } },
  },
};

// What crowd people say when you stop beside them (balloons), by where they are.
export const LINES = {
  market: ['~shout~ Fruit from seven moons! Pick one.', '~neutral~ Hail a cab if your feet get tired.', '~curious~ Nobody remembers who drew the first advertisement.', '~whisper~ The quiet ones listen with their whole heads.', '~shout~ Noodles! Noodles that remember you!', "~curious~ Find *Madame Sel beneath the silent broadcast tower*."],
  square: ['~sad~ The tower used to talk, you know.', '~playful~ One tower’s silent. Imagine that, here.', '~neutral~ Sel’s waiting for somebody to climb it.', '~curious~ Did the sky ring where you come from too?', '~sad~ The last broadcast is still up there, somewhere.'],
  bridge: ['~neutral~ Mind the gap, it’s a long way down.', '~neutral~ Kip runs these bridges faster than the cabs.', '~happy~ Best view of the signs is from up here.', '~playful~ Don’t look down. Or do; it’s pretty.'],
  onAir: ['~surprised~ Did you hear it?', '~sad~ Somebody’s child…', '~solemn~ The tower told the truth again.', '~solemn~ You are not alone. It said that. To all of us.', '~happy~ I’m going to call my mother.', '~surprised~ Thirty years on the way!'],
  shout: ['~shout~ Listen!', '~shout~ The tower!', '~shout~ It’s talking!', '~whisper~ Shh! Listen!'],
};

/** What people in the crowd say when you stop and listen (no answers: src/story/dialogue.js pickListen), by where they are. Picked by their seed. */
export const CROWD_TALK = {
  market: [
    { name: 'A fruit seller', title: 'of seven moons', talk: { listen: [
      "~happy~ Seven-moon fruit! This one tastes like rain on a hot roof. Yes, I checked the roof.",
      '~shout~ Seven moons of fruit! This one bites back. That one’s only shy.',
      '~angry~ Touch it, you buy it. You touched it. No, you looked at it in a touching way.',
      { if: { not: { quest: 'bazaar.bowl', done: true } }, say: '~curious~ Ummu’s crates came down in its alley, seven-moon fruit everywhere. The quiet one hasn’t found its bowl since. Somebody should *shift those crates*.' },
    ] } },
    { name: 'A noodle cook', title: 'at the counter', talk: { listen: [
      "~playful~ The sign says my noodles remember your order. The noodles are liars. Tell me again.",
      '~playful~ They say the noodle man is three noodle men in a coat. That’s a lie. It’s two.',
      '~neutral~ Every sign in this market is a promise. Mine is the only one that keeps it, with broth.',
    ] } },
    { name: 'A shopper', title: 'lost', talk: { listen: [
      '~tired~ A thousand signs and I still can’t find the soap.',
      '~tired~ I asked a sign for directions. It sold me a hat.',
      '~sad~ Everything here talks to you and nothing listens. Except the quiet ones, and they don’t sell soap.',
    ] } },
  ],
  square: [
    { name: 'A listener', title: 'in Signal Square', talk: { listen: [
      "~sad~ I used to listen to messages here every evening. People I’d never meet. I miss hearing how they got on.",
      '~sad~ For somebody, really. Just never for me. That was the nice part: you could listen to love with nobody asking you to give any back.',
      { if: { not: ON_AIR }, say: '~curious~ The antenna up there is *three bulbs over a dish*. Light all three before the first one fades, the old engineers said. Nobody since has had the reach.' },
      '~whisper~ Shh. I’m listening to the hum it makes now, and pretending.',
    ] } },
    { name: 'An old trader', title: 'in Signal Square', talk: { listen: [
      "~solemn~ That mark filled every sign when the sky sang. Grandmother says it was here before the market. Before there was anything to advertise.",
      '~solemn~ Every sign in this market lies a little. The silent tower was the only one that ever told the truth.',
      { if: { not: { flag: 'temple.bazaar.done' } }, say: '~whisper~ Round the back of the silent tower there’s *an old doorway*, where the paving turns to great old stones. Hobb sits by it, listening. Ask him what he hears. He’ll say one word.' },
      '~angry~ In my day a sign was a sign. Now they sing, they dance, they follow you home.',
    ] } },
  ],
  bridge: [
    { name: 'A bridge walker', title: 'high above the market', talk: { listen: [
      { if: { not: ON_AIR }, say: "~tired~ Kip ran past carrying a humming bag. I’m sure there’s a delivery surcharge for that." },
      '~neutral~ Mind the gap. It’s a long way down, and every sign watches you fall.',
      '~playful~ Don’t look down. Or do; it’s pretty.',
      '~tired~ I walk this bridge twice a day. It has never once been shorter.',
    ] } },
    { name: 'A window cleaner', title: 'on a break', talk: { listen: [
      "~playful~ I clean the signs from behind. BUY becomes YUB. I find it more persuasive.",
      '~playful~ From up here you can read every fortune sign at once. They all disagree. I take the nicest.',
      { if: { not: { quest: 'bazaar.oldsign', done: true } }, say: '~curious~ The oldest sign hangs right under the second bridge. Dark for years. I clean it anyway. Somebody should *wake it up*.' },
      '~angry~ Mind the bucket. No, the other bucket.',
    ] } },
  ],
  onAir: [
    { name: 'Someone in the square', title: 'still listening', talk: { listen: [
      "~sad~ I don’t know Ilen. Still cried. You played that message, didn’t you? Thank you.",
      '~solemn~ You are not alone, it said. To all of us at once. I’ve been looking at strangers all morning, wondering which of us it meant.',
      '~sad~ Thirty years on the way, that message. I hope whoever sent it is still listening.',
    ] } },
    { name: 'A fruit seller', title: 'giving fruit away', talk: { listen: [
      "~happy~ Gave away a crate afterwards. Everyone was kind. Terrible trading conditions. I hope they last.",
      '~happy~ Take a fruit. Take two. Today nobody pays. Tomorrow, double.',
      '~playful~ I cried into the noodle man’s broth. He says it’s improved.',
    ] } },
    { name: 'A stranger', title: 'looking up at the tower', talk: { listen: [
      "~happy~ I’m listening for you, it said. I needed to hear that. Thought I’d just come for fruit.",
      '~solemn~ I’m going to call my mother. I haven’t in years. I don’t know what I’ll say.',
      '~curious~ Who was it from, do you think? Does it matter? It doesn’t matter.',
    ] } },
  ],
};
