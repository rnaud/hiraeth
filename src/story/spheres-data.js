// The Garden of Spheres' story as data: "What the Spheres Remember"
// (docs/story-bible.md).
//
// The spheres came down long ago, and each one remembers one sound: the last
// thing it heard before it fell, the listeners say. Every sphere rings its
// own note when the fluid touches it (bigger ones lower); three of them still
// remember more than a note: the pearl by the lake (a glass
// bell), the sphere west of the arch (far voices singing one note), and the
// great one among the pillars in the east (a drum: dum, tek-dum, and many
// feet in sand; the desert's procession drum, though nobody here has ever
// heard of the desert). Carry the three sounds down the avenue to the round
// plaza and splash the pole, which hums while the great sphere is on the
// horizon: it plays them back together as one little tune, and the chord is
// the keepsake.
//
// The glyph is "the Footprint" here (on the underside of every sphere, where
// it touches the ground). Ume, who keeps the pole, heard the singing light
// sing the pole's own note. Flags (game-state.js): spheres.* below;
// clue.spheres.desert (one sphere remembers the desert's drum).

const Q = 'spheres.listen';

export const ITEMS = { pebble: 'a mirrored pebble' };
export const SOUNDS = {
  bell: { name: 'a bell of glass', part: 'bell', text: 'a bell of glass, struck once, ringing on and on' },
  chant: { name: 'far voices', part: 'chant', text: 'voices, a long way off, singing one note together' },
  drum: { name: 'a walking drum', part: 'drum', text: 'a drum: dum, tek-dum, and the shuffle of many feet in sand' },
};
export const KEEPSAKE = { id: 'spheres.song', level: 'spheres', name: 'The chord of the spheres', kind: 'song', text: 'A glass bell, far voices and a walking drum, sounding together at the pole on the round plaza while the great sphere stood on the horizon.' };
// Every great sphere sounds one note when the fluid touches it, in the garden's
// own (pentatonic) scale: the bigger the sphere, the lower its note (a degree
// of the scale from its middle octave; 0 is the lowest, for the giants).
export const orbDegree = (R) => Math.max(0, Math.min(9, Math.round(9 - ((R - 12) / 34) * 9)));

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'What the Spheres Remember', world: 'spheres', main: true,
    outro: 'Three sounds, carried to the pole, sounding together.',
    stages: [
      { id: 'aube', text: 'Talk to Aube, the listener, in the umbrella grove', label: 'Aube, the listener', flag: 'spheres.aube.heard', at: 'aube' },
      { id: 'listen', text: 'Splash the three spheres that remember with your fluid, and listen to each play its sound', label: 'A sphere that remembers', flag: 'spheres.heard.three', at: 'sphere' },
      { id: 'plaza', text: 'Carry the sounds down the avenue, through the sphere-arch, to the round plaza', label: 'The round plaza', goto: 'plaza', radius: 22, at: 'plaza' },
      { id: 'pole', text: 'Splash the humming pole, and listen', label: 'The humming pole', flag: 'spheres.chord.heard', at: 'pole' },
      { id: 'ume', text: 'Tell Ume, who keeps the pole, what you heard', label: 'Ume, on the plaza', talk: 'ume', at: 'ume' },
    ],
  },
  {
    id: 'spheres.pebble', title: 'The Lake’s Reflection', world: 'spheres',
    outro: 'The pole sees the sky twice now.',
    stages: [
      { id: 'glint', text: 'Splash the glint in the still water off the lake’s south shore (shoot)', label: 'The glint in the lake', flag: 'spheres.pebble.out', at: 'glint' },
      { id: 'pick', text: 'Pick up the mirrored pebble the lake gave back', label: 'The mirrored pebble', flag: 'spheres.pebble.taken', at: 'pebble' },
      { id: 'carry', text: 'Carry the lake’s reflection to the plaza and set it at the pole’s foot', label: 'The pole’s foot', flag: 'spheres.pebble.placed', at: 'pole' },
    ],
  },
  {
    id: 'spheres.avenue', title: 'That Kind of Road', world: 'spheres',
    outro: 'You walked the whole avenue slowly. The cypresses noticed.',
    stages: [
      { id: 'walk', text: 'Walk the avenue from the sphere-arch to the plaza without running or jumping', label: 'The avenue', flag: 'spheres.avenue.walked', at: 'avenue' },
      { id: 'tell', text: 'Tell Cael you walked it', label: 'Cael, on the avenue', talk: 'cael', at: 'cael' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  aube: {
    id: 'aube.spheres', name: 'Aube', title: 'the listener', color: '#9fd0c8', voice: 1.0, kind: 'f',
    palette: { cloak: '#f3efe2', lining: '#2b211f', cloth: '#9fd0c8', legs: '#7f9a90', hat: '#f6efd0', hair: '#3d2a22', face: '#e8dcc8' }, head: 'wrap', cape: 1.2, look: { prop: 'parasol' },
    lines: ["~neutral~ The spheres fell here long ago. Now we mow around them.", '~neutral~ *Follow the pale path*. It goes through the arch.', '~whisper~ Shh. Listen.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'spheres.heard.three' }, node: 'three' },
        { if: { flag: 'spheres.aube.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~playful~ You look busy. A difficult habit to keep here. I’m Aube. I listen to the spheres.", "~solemn~ Each sphere holds the last sound it heard before it fell from the sky. Most people walk past. I like to hear where they’ve been."],
          choices: [
            { text: '~curious~ How do you hear it?', goto: 'how' },
            { text: '~curious~ What sounds do they remember?', goto: 'what' },
          ],
        },
        how: {
          say: ["~whisper~ *Shoot a sphere with fluid*, then listen. It will play its sound for you.", "~neutral~ Try these three: *the pearl by the lake*, *the sphere west of the arch*, and *the large one among the eastern pillars*."],
          do: { set: { 'spheres.aube.heard': true } },
          choices: [{ text: '~curious~ And then?', goto: 'then' }, { text: '~neutral~ I’ll go and listen.', end: true }],
        },
        then: { say: ["~neutral~ After hearing all three, follow *the avenue to the round plaza*. Find *Ume beside the pole*. She can help you play the sounds together."], choices: [{ text: '~neutral~ I’ll go and listen.', end: true }] },
        what: { say: ["~playful~ A bell, voices, and a drum. We have no drums here. I’d like to know how one got into a stone."], choices: [{ text: '~curious~ How do I hear them?', goto: 'how' }, { text: '~curious~ Where did they come from?', goto: 'from' }] },
        from: { say: ["~curious~ Some think the huge sphere on the horizon dropped them like seeds. I only know they came from somewhere noisier than here."], choices: [{ text: '~curious~ How do I hear them?', goto: 'how' }] },
        again: {
          say: [
            { if: { flag: 'spheres.heard.bell' }, text: "~happy~ You heard the pearl’s bell. Let it ring a moment before you leave." },
            { if: { flag: 'spheres.heard.chant' }, text: "~playful~ You heard the western sphere sing. You’re standing straighter. Music does that without asking." },
            { if: { flag: 'spheres.heard.drum' }, text: "~curious~ A drum inside the eastern sphere. Someone once played where that stone could hear." },
            { if: { not: { any: [{ flag: 'spheres.heard.bell' }, { flag: 'spheres.heard.chant' }, { flag: 'spheres.heard.drum' }] } }, text: "~neutral~ Splash the lake pearl, the sphere west of the arch, and the large eastern sphere. Listen to each one." },
          ],
          choices: [{ text: '~whisper~ I’m listening.', end: true }],
        },
        three: { say: ["~surprised~ All three? Follow the pale path through the arch to the plaza. *Ume waits by the pole.* Take your time on the avenue."], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: { say: ["~happy~ I heard the chord from here. Three lonely sounds finally introduced to each other. Thank you."], choices: [{ text: '~happy~ So will I.', end: true }] },
      },
    },
  },

  nell: {
    id: 'nell', name: 'Nell', title: 'who looks into the lake', color: '#a9c9c4', voice: 1.15, kind: 'f',
    palette: { cloak: '#a9c9c4', lining: '#2b211f', cloth: '#f6efd0', legs: '#5a6a6a', hat: '#f3efe2', hair: '#2b211f' }, head: 'hood', cape: 0.9,
    lines: ["~happy~ Look in the lake. Twice the garden, no extra weeding.", '~playful~ Upside down is just another way up.', '~curious~ There. Did you see it glint?'],
    talk: {
      entry: [
        { if: { quest: 'spheres.pebble', done: true }, node: 'after' },
        { if: { quest: 'spheres.pebble', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~playful~ The lake gives us a second garden. Upside down, but very little maintenance.", "~whisper~ I’m Nell. I watch the reflections. There’s one bright thing down there that isn’t a reflection at all."],
          choices: [{ text: '~curious~ Except what?', goto: 'except' }, { text: '~curious~ Twice as large?', goto: 'twice' }],
        },
        twice: { say: ["~happy~ The shore sphere touches its reflection at the waterline. As a child I thought that was how spheres hatched. I still rather like the idea."], choices: [{ text: '~curious~ Except one thing, you said?', goto: 'except' }] },
        except: {
          say: ["~happy~ A *mirror pebble*, under the water off this shore. See the glint? It catches the sun every morning.", "~playful~ *Shoot the glint with fluid* to bring it up. Then *set the pebble at the plaza pole’s foot*. I’d like the pole to have a view of the sky too."],
          choices: [{ text: '~neutral~ I’ll try.', do: { start: 'spheres.pebble' }, goto: 'try' }, { text: '~neutral~ Maybe later.', end: true }],
        },
        try: { say: ["~neutral~ *Shoot, don’t push.* We want the pebble, not a large wave."], choices: [{ text: '~neutral~ A splash.', end: true }] },
        waiting: {
          say: [
            { if: { flag: 'spheres.pebble.taken' }, text: "~happy~ There it is! Hold it carefully. *Carry it down the avenue to the pole.*" },
            { if: { not: { flag: 'spheres.pebble.taken' } }, text: '~neutral~ The glint, off this shore. *Give it a splash*.' },
          ],
          choices: [{ text: '~neutral~ On my way.', end: true }],
        },
        after: { say: ["~whisper~ When you set it down, the lake went still. I don’t know why. I watched it for a long time."], choices: [{ text: '~solemn~ It was.', end: true }] },
      },
    },
  },

  ivo: {
    id: 'ivo', name: 'Ivo', title: 'who climbs the white hill', color: '#f2c5b0', voice: 1.25, kind: 'm',
    palette: { cloak: '#f2c5b0', lining: '#2b211f', cloth: '#4f6b3a', legs: '#3a3a3a', hat: '#f6efd0', hair: '#4a3226' }, head: 'hair', cape: 0.5,
    lines: ["~happy~ From the white hill’s middle terrace, you can reach the canopy.", '~curious~ Have you looked under a sphere?', '~shout~ The view! The VIEW.'],
    talk: {
      nodes: {
        hello: {
          say: ["~happy~ Try *the white hill*. Its middle terrace leads right onto the great canopy. A tree with a side entrance!", "~curious~ I’m Ivo. I climb, crawl, occasionally fall. Ever looked beneath a sphere?"],
          choices: [
            { text: '~curious~ Under a sphere?', goto: 'under' },
            { text: '~neutral~ I’ll climb the hill.', end: true },
          ],
        },
        under: {
          say: ["~whisper~ I squeezed under the lake pearl. Flat on my back. Found this pressed into its underside: {glyph}", "~playful~ *The Footprint.* Every sphere has one underneath. An excellent place to hide something from people with clean clothes.", "~playful~ There’s a *blue star-chest in the grove’s umbrella tree*, with Footprints round its sides. We call those left-behinds. Ume thinks they’re gifts. I hope so."],
          choices: [{ text: '~curious~ Whose footprint?', goto: 'whose' }],
        },
        whose: { say: ["~curious~ Perhaps something enormous walked through the sky, setting spheres down. Cups on a table. I’d rather not be here when it clears up."], choices: [{ text: '~curious~ Seen anything strange lately?', goto: 'strange' }, { text: '~happy~ Thanks, Ivo.', end: true }] },
        strange: { say: ["~playful~ Ask *Ume at the plaza*. The pole hummed at night when the singing light passed. She says that’s unusual. Ume is considerably harder to impress than I am."], choices: [{ text: '~happy~ Thanks, Ivo.', end: true }] },
      },
    },
  },

  cael: {
    id: 'cael', name: 'Cael', title: 'who walks the avenue', color: '#b7c46a', voice: 0.75, kind: 'm', scale: 1.04,
    palette: { cloak: '#b7c46a', lining: '#2b211f', cloth: '#f3efe2', legs: '#4a5a3a', hat: '#f6efd0', hair: '#e8dcc0' }, head: 'hat', cape: 1.3,
    lines: ['~neutral~ The cypresses lead to the rings.', '~solemn~ Walk slowly. It is that kind of road.', '~whisper~ Slowly. Slower.'],
    talk: {
      entry: [
        { if: { quest: 'spheres.avenue', done: true }, node: 'after' },
        { if: { flag: 'spheres.avenue.walked' }, node: 'walked' },
        { if: { quest: 'spheres.avenue', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~solemn~ Take *the avenue from the arch to the plaza*. Walk slowly. Watch the flowers as you pass.", "~neutral~ Cael. I walk this road every day. A runner gets there sooner. I see more on the way. We’ve agreed to stop arguing about who wins."],
          choices: [
            { text: '~curious~ How long is it?', goto: 'long' },
            { text: '~curious~ What happens if you walk it slowly?', goto: 'slowly' },
          ],
        },
        long: { say: ["~playful~ Long enough for the flowers to open. That’s the measurement I use."], choices: [{ text: '~curious~ What happens if you walk it slowly?', goto: 'slowly' }] },
        slowly: {
          say: ["~neutral~ The white bells open when you pass slowly. Run or jump, and they shut. The cypresses lean toward you too.", "~playful~ Walk from the arch to the plaza without running or jumping. See what opens. Consider it an invitation with conditions."],
          choices: [{ text: '~neutral~ I’ll walk it.', do: { start: 'spheres.avenue' }, goto: 'go' }, { text: '~neutral~ Maybe later.', end: true }],
        },
        go: { say: ["~neutral~ *Start at the arch*. I’ll be along the avenue, making excellent slow progress."], choices: [{ text: '~solemn~ (walk slowly)', end: true }] },
        waiting: { say: ["~neutral~ *Walk slowly from arch to plaza.* If you run or jump, return to the arch and try again."], choices: [{ text: '~solemn~ (walk slowly)', end: true }] },
        walked: {
          say: ["~happy~ Every bell opened behind you. That’s the whole avenue saying hello.", "~solemn~ Now you’ve seen what the hurry misses."],
          do: { advance: ['spheres.avenue', 'tell'] },
          choices: [{ text: '~tired~ It was long.', goto: 'longer' }, { text: '~playful~ It was short.', goto: 'shorter' }],
        },
        longer: { say: ['~happy~ Good. Long is the right answer, for a first time.'], choices: [{ text: '~neutral~ Goodbye, Cael.', end: true }] },
        shorter: { say: ["~surprised~ Slower than me? Wonderful. I may have a rival."], choices: [{ text: '~neutral~ Goodbye, Cael.', end: true }] },
        after: { say: ['~happy~ Slowly. It is that kind of road. You know now.'], choices: [{ text: '~neutral~ I know.', end: true }] },
      },
    },
  },

  ume: {
    id: 'ume', name: 'Ume', title: 'who keeps the pole', color: '#f6efd0', voice: 0.8, kind: 'f', scale: 0.96,
    palette: { cloak: '#f6efd0', lining: '#2b211f', cloth: '#a9c9c4', legs: '#5a6a6a', hat: '#e0d4bc', hair: '#e8dcc0' }, head: 'wrap', cape: 1.45, look: { prop: 'staff', body: 'ruff' },
    lines: ["~whisper~ Listen. The pole hums when the great sphere is visible.", '~neutral~ Bring it something to sing.', '~happy~ Hm-mm-mm.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'spheres.chord.heard' }, node: 'chord' },
        { if: { flag: 'spheres.heard.three' }, node: 'ready' },
        { if: { flag: 'met.ume' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~happy~ I’m Ume. This pole hums when the great sphere is on the horizon. I look after it. It requires very little dusting and a great deal of listening.", "~tired~ Aube sends listeners here with sounds from the smaller spheres. Have you heard them yourself? Descriptions won’t do."],
          choices: [
            { text: '~curious~ Why does the pole hum?', goto: 'why' },
            { text: '~curious~ Have you heard anything strange?', goto: 'strange' },
          ],
        },
        why: { say: ["~neutral~ The pole answers the great sphere. Like two bowls vibrating together. When the sphere sets, the pole usually falls quiet."], choices: [{ text: '~curious~ Mostly?', goto: 'strange' }] },
        strange: {
          say: ["~whisper~ But the night the light passed, it hummed after dark. A singing light crossed above us, matching its note. The old listeners called such a thing *an Answerer*.", "~scared~ It turned directly over this plaza. As though it had heard a reply. Then it flew on. I still catch myself looking up at night."],
          do: { set: { 'spheres.rumour.light': true } },
          choices: [{ text: '~neutral~ It struck my ship.', goto: 'struck' }, { text: '~neutral~ I’ll bring the pole three sounds.', end: true }],
        },
        struck: { say: ["~scared~ It hit your ship? I’m sorry. Then it can do more than answer. I don’t know what it wanted."], choices: [{ text: '~neutral~ I’ll bring it three sounds.', end: true }] },
        again: { say: ["~neutral~ *Splash and hear three spheres*: the lake pearl, the one west of the arch, and the large one among the eastern pillars. Then return here."], choices: [{ text: '~neutral~ I will.', end: true }] },
        ready: { say: ["~happy~ You’ve heard them all. Now *stand close and splash the pole*. Let it play the three sounds together."], choices: [{ text: '~whisper~ (splash the pole)', end: true }] },
        chord: {
          say: ["~surprised~ Hear that? Bell, voices, drum. They fit.", "~solemn~ Those were the last sounds the spheres heard before they fell. Somewhere along their journey: a bell, singers, and people marching through sand."],
          do: { set: { 'clue.spheres.desert': true } },
          choices: [{ text: '~surprised~ I know that drum. It’s from the desert.', if: { any: [{ flag: 'desert.teo.drumming' }, { flag: 'world.desert.done' }] }, goto: 'desert' }, { text: '~curious~ Where is that?', goto: 'where' }],
        },
        desert: { say: ["~surprised~ You heard that drum in the desert? Then both you and this sphere have been there. You’ve taken the longer route.", "~happy~ Keep the chord. You helped bring it together."], do: [{ advance: [Q, 'ume'] }, { keepsake: KEEPSAKE }], next: 'end' },
        where: { say: ["~curious~ I don’t know where they heard it. Have you been somewhere with sand and a procession drum? That might be part of their route.", "~happy~ Take the chord with you. Someone elsewhere may recognise another part."], do: [{ advance: [Q, 'ume'] }, { keepsake: KEEPSAKE }], next: 'end' },
        end: { say: ['~happy~ Hm-mm-mm. The pole will be humming that for a week.'], choices: [{ text: '~happy~ Thank you, Ume.', end: true }] },
        after: { say: ['~whisper~ Still humming it. Listen.'], choices: [{ text: '~whisper~ (listen)', end: true }] },
      },
    },
  },
};

export const THINGS = {
  pebble: {
    id: 'pebble', name: 'The mirrored pebble', title: 'at the pole’s foot', color: '#cfe6ea', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~solemn~ You set the mirror pebble by the pole. Its reflection stretches down into a tiny, impossible sky.", "~whisper~ The hum changes. A faint ripple enters the note."],
      do: { set: { 'spheres.pebble.placed': true } },
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
};
