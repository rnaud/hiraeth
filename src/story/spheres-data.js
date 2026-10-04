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
    id: 'aube', name: 'Aube', title: 'the listener', color: '#9fd0c8', voice: 1.0, kind: 'f',
    palette: { cloak: '#f3efe2', lining: '#2b211f', cloth: '#9fd0c8', legs: '#7f9a90', hat: '#f6efd0', hair: '#3d2a22', face: '#e8dcc8' }, head: 'wrap', cape: 1.2, look: { prop: 'parasol' },
    lines: ['~neutral~ The spheres came down long ago. Nobody minds them now.', '~neutral~ *Follow the pale path*. It goes through the arch.', '~whisper~ Shh. Listen.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'spheres.heard.three' }, node: 'three' },
        { if: { flag: 'spheres.aube.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~playful~ You walk like someone who has somewhere to be. Here, nobody does. I’m Aube. I listen to the spheres.', '~solemn~ They came down long ago, out of the sky, and lay where they fell. Nobody minds them now. But each one remembers one sound, the last thing it heard before it came down.'],
          choices: [
            { text: '~curious~ How do you hear it?', goto: 'how' },
            { text: '~curious~ What sounds do they remember?', goto: 'what' },
            { text: '~curious~ Where did they come from?', goto: 'from' },
          ],
        },
        how: {
          say: ['~whisper~ You touch it. That’s all. *Give one a splash of your fluid*, and it remembers, for you, out loud. Every sphere has a note of its own.', '~neutral~ Three of them still remember anything you can hear: *the pearl by the lake*, *the one west of the arch*, and *the big one among the pillars*, far to the east.'],
          do: { set: { 'spheres.aube.heard': true } },
          choices: [{ text: '~curious~ And then?', goto: 'then' }, { text: '~neutral~ I’ll go and listen.', end: true }],
        },
        then: { say: ['~neutral~ Then carry what you heard *down the avenue to the round plaza*. The pole there hums while the great sphere is on the horizon. *Ume* keeps it. She says if you bring it three sounds, it will play them back together.'], choices: [{ text: '~neutral~ I’ll go and listen.', end: true }] },
        what: { say: ['~playful~ Each one something different. A bell. Singing. One of them remembers a drum, which is strange: nobody here has ever owned a drum. We whistle.'], choices: [{ text: '~curious~ How do I hear them?', goto: 'how' }] },
        from: { say: ['~curious~ From the sky. From the great one on the horizon, some say: seeds it dropped. From somewhere with bells and drums, I’d say, which is not here.'], choices: [{ text: '~curious~ How do I hear them?', goto: 'how' }] },
        again: {
          say: [
            { if: { flag: 'spheres.heard.bell' }, text: '~happy~ You heard the pearl’s bell. Good. It rings longer for the second listener.' },
            { if: { flag: 'spheres.heard.chant' }, text: '~playful~ You heard the singing in the one west of the arch. It made you stand straighter; I can see.' },
            { if: { flag: 'spheres.heard.drum' }, text: '~curious~ A drum, from the big one among the pillars. A drum. Where would a sphere have heard a drum?' },
            { if: { not: { any: [{ flag: 'spheres.heard.bell' }, { flag: 'spheres.heard.chant' }, { flag: 'spheres.heard.drum' }] } }, text: '~neutral~ *The pearl by the lake*, *the one west of the arch*, *the big one in the east*. *Splash each one*, and listen.' },
          ],
          choices: [{ text: '~whisper~ I’m listening.', end: true }],
        },
        three: { say: ['~surprised~ All three? Then go: down *the pale path*, through the arch, along the avenue. Walk slowly. *Ume will be at the pole*.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: { say: ['~happy~ You carried them to the pole and it played them back. I heard it from here, very faint. I’ll be listening to that for years.'], choices: [{ text: '~happy~ So will I.', end: true }] },
      },
    },
  },

  nell: {
    id: 'nell', name: 'Nell', title: 'who looks into the lake', color: '#a9c9c4', voice: 1.15, kind: 'f',
    palette: { cloak: '#a9c9c4', lining: '#2b211f', cloth: '#f6efd0', legs: '#5a6a6a', hat: '#f3efe2', hair: '#2b211f' }, head: 'hood', cape: 0.9,
    lines: ['~happy~ Look into the lake. The garden is twice as large there.', '~playful~ Upside down is just another way up.', '~curious~ There. Did you see it glint?'],
    talk: {
      entry: [
        { if: { quest: 'spheres.pebble', done: true }, node: 'after' },
        { if: { quest: 'spheres.pebble', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~playful~ Look into the lake. The garden is twice as large there. Half of it is upside down, but you get used to that.', '~whisper~ I’m Nell. I look. Everything in the lake is only a reflection, except one thing.'],
          choices: [{ text: '~curious~ Except what?', goto: 'except' }, { text: '~curious~ Twice as large?', goto: 'twice' }],
        },
        twice: { say: ['~happy~ The pyramid, the white houses, the cypresses: all of them twice. The sphere on the far shore is two spheres touching at the waterline. When I was little I thought that was where spheres came from.'], choices: [{ text: '~curious~ Except one thing, you said?', goto: 'except' }] },
        except: {
          say: ['~happy~ A pebble. A pebble that is a mirror all the way through, lying under the water off this shore. It glints, there, see? Every morning.', '~playful~ I can’t reach it; the water is cold and so am I. *Give the glint a splash*, and the lake might give it back. Then carry it to the plaza and *set it at the foot of the pole*, so the pole can see the sky twice.'],
          choices: [{ text: '~neutral~ I’ll try.', do: { start: 'spheres.pebble' }, goto: 'try' }, { text: '~neutral~ Maybe later.', end: true }],
        },
        try: { say: ['~neutral~ A splash. Not a shove; you’d only make waves. The lake doesn’t like being pushed.'], choices: [{ text: '~neutral~ A splash.', end: true }] },
        waiting: {
          say: [
            { if: { flag: 'spheres.pebble.taken' }, text: '~happy~ You have it! Don’t look into it too long; it shows you the sky behind you. *Down the avenue, to the pole’s foot*.' },
            { if: { not: { flag: 'spheres.pebble.taken' } }, text: '~neutral~ The glint, off this shore. *Give it a splash*.' },
          ],
          choices: [{ text: '~neutral~ On my way.', end: true }],
        },
        after: { say: ['~whisper~ I felt it, when you set it down. The lake went still all at once, as if it were listening to something far away.'], choices: [{ text: '~solemn~ It was.', end: true }] },
      },
    },
  },

  ivo: {
    id: 'ivo', name: 'Ivo', title: 'who climbs the white hill', color: '#f2c5b0', voice: 1.25, kind: 'm',
    palette: { cloak: '#f2c5b0', lining: '#2b211f', cloth: '#4f6b3a', legs: '#3a3a3a', hat: '#f6efd0', hair: '#4a3226' }, head: 'hair', cape: 0.5,
    lines: ['~happy~ Climb the white hill. From the middle terrace you can step out onto the great canopy.', '~curious~ Have you looked under a sphere?', '~shout~ The view! The VIEW.'],
    talk: {
      nodes: {
        hello: {
          say: ['~happy~ *Climb the white hill*! From the middle terrace you can step right out onto the great canopy. Nobody believes me until they do it.', '~curious~ I’m Ivo. I climb things. Have you ever looked under a sphere?'],
          choices: [
            { text: '~curious~ Under a sphere?', goto: 'under' },
            { text: '~curious~ Seen anything strange lately?', goto: 'strange' },
            { text: '~neutral~ I’ll climb the hill.', end: true },
          ],
        },
        under: {
          say: ['~whisper~ Where they touch the ground. I crawled under the pearl by the lake once, flat on my back. There’s a mark there, pressed into it, like where a foot came down. {glyph}', '~playful~ Three dots over an arc. We call it the Footprint. Every sphere has one, underneath, where nobody looks. Except me.', '~playful~ Sometimes there’s *a blue box near a Footprint*, with a star on the lid. A left-behind. Ume says they’re presents. Ume says everything is a present.'],
          choices: [{ text: '~curious~ Whose footprint?', goto: 'whose' }],
        },
        whose: { say: ['~curious~ Something that walked through the sky putting spheres down, I suppose, the way you’d put down cups. Some say the great one on the horizon, and that one day it will come back and collect them.'], choices: [{ text: '~curious~ Seen anything strange lately?', goto: 'strange' }, { text: '~happy~ Thanks, Ivo.', end: true }] },
        strange: { say: ['~playful~ *Ask Ume, at the plaza*. She says the pole hummed on its own three nights ago, with the great sphere dark. She doesn’t say things like that. I say things like that.'], choices: [{ text: '~happy~ Thanks, Ivo.', end: true }] },
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
          say: ['~solemn~ The cypresses lead to the rings. *Walk slowly*. It is that kind of road.', '~neutral~ I’m Cael. I walk it, up and down, every day. It takes me most of the morning. It could take a running man a minute, and he would never find out how long it is.'],
          choices: [
            { text: '~curious~ How long is it?', goto: 'long' },
            { text: '~curious~ What happens if you walk it slowly?', goto: 'slowly' },
          ],
        },
        long: { say: ['~playful~ Exactly as long as it takes you. That’s the answer. Nobody likes it.'], choices: [{ text: '~curious~ What happens if you walk it slowly?', goto: 'slowly' }] },
        slowly: {
          say: ['~neutral~ The little white bells along the edges open as you pass. The cypresses lean in to see who’s coming. Run, or jump about, and the bells shut and you’re just someone on a path.', '~playful~ Try it. *From the arch to the plaza*. Don’t run. Don’t jump. It isn’t a test. Well. It is a small test.'],
          choices: [{ text: '~neutral~ I’ll walk it.', do: { start: 'spheres.avenue' }, goto: 'go' }, { text: '~neutral~ Maybe later.', end: true }],
        },
        go: { say: ['~neutral~ *Start at the arch*. I’ll be somewhere along it, being slow.'], choices: [{ text: '~solemn~ (walk slowly)', end: true }] },
        waiting: { say: ['~neutral~ *From the arch to the plaza, slowly*. If you ran, *start again at the arch*. Nobody minds. The road doesn’t count.'], choices: [{ text: '~solemn~ (walk slowly)', end: true }] },
        walked: {
          say: ['~happy~ You walked it. All of it. I saw the bells open behind you, all the way down.', '~solemn~ Now you know how long the avenue is. Most people never find out.'],
          do: { advance: ['spheres.avenue', 'tell'] },
          choices: [{ text: '~tired~ It was long.', goto: 'longer' }, { text: '~playful~ It was short.', goto: 'shorter' }],
        },
        longer: { say: ['~happy~ Good. Long is the right answer, for a first time.'], choices: [{ text: '~neutral~ Goodbye, Cael.', end: true }] },
        shorter: { say: ['~surprised~ Then you walked it slower than I do. I’ll have to try harder.'], choices: [{ text: '~neutral~ Goodbye, Cael.', end: true }] },
        after: { say: ['~happy~ Slowly. It is that kind of road. You know now.'], choices: [{ text: '~neutral~ I know.', end: true }] },
      },
    },
  },

  ume: {
    id: 'ume', name: 'Ume', title: 'who keeps the pole', color: '#f6efd0', voice: 0.8, kind: 'f', scale: 0.96,
    palette: { cloak: '#f6efd0', lining: '#2b211f', cloth: '#a9c9c4', legs: '#5a6a6a', hat: '#e0d4bc', hair: '#e8dcc0' }, head: 'wrap', cape: 1.45, look: { prop: 'staff', body: 'ruff' },
    lines: ['~whisper~ Hear it? The pole hums while the great sphere is up.', '~neutral~ Bring it something to sing.', '~happy~ Hm-mm-mm.'],
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
          say: ['~happy~ Hear it? The pole hums while the great sphere is on the horizon. Hm-mm-mm. I’m Ume. I keep it. Keeping it means mostly listening to it.', '~tired~ Aube sends people down the avenue with sounds for it. Most never bring any. You can’t carry a sound you never went to.'],
          choices: [
            { text: '~curious~ Why does the pole hum?', goto: 'why' },
            { text: '~curious~ Have you heard anything strange?', goto: 'strange' },
          ],
        },
        why: { say: ['~neutral~ Because the great sphere is there, the way a bowl hums when you set another bowl beside it. When the great sphere sets, it stops. Mostly.'], choices: [{ text: '~curious~ Mostly?', goto: 'strange' }] },
        strange: {
          say: ['~whisper~ Three nights ago it hummed with the great sphere set and dark. I came out to see why. A light was going over, very high, singing: singing the pole’s own note, exactly. The old listeners had a name for such a thing: an Answerer.', '~scared~ It turned. Right over the plaza, it turned, as if the pole had answered it and it wanted to know who. Then it went on. I haven’t slept well since.'],
          do: { set: { 'spheres.rumour.light': true } },
          choices: [{ text: '~neutral~ It struck my ship.', goto: 'struck' }, { text: '~neutral~ I’ll bring the pole three sounds.', end: true }],
        },
        struck: { say: ['~scared~ Did it? Then it was looking, and it found you. I’m glad it didn’t find the pole. It is only a pole.'], choices: [{ text: '~neutral~ I’ll bring it three sounds.', end: true }] },
        again: { say: ['~neutral~ *The pearl by the lake*, *the one west of the arch*, *the big one in the east*. *Splash each one*, and listen. Then bring them here.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        ready: { say: ['~happy~ You woke all three. I can tell; you’re walking like a bell. *Give the pole a splash*, there, close. Let it hear what you carried.'], choices: [{ text: '~whisper~ (splash the pole)', end: true }] },
        chord: {
          say: ['~surprised~ There. All three at once. Did you hear it? The bell and the voices and that drum.', '~solemn~ The spheres remember the last thing they heard before they came down. So somewhere there is a glass bell, and people singing, and a whole crowd walking to a drum in sand. They passed over all of it, once, on their way here.'],
          do: { set: { 'clue.spheres.desert': true } },
          choices: [{ text: '~surprised~ I know that drum. It’s from the desert.', if: { any: [{ flag: 'desert.teo.drumming' }, { flag: 'world.desert.done' }] }, goto: 'desert' }, { text: '~curious~ Where is that?', goto: 'where' }],
        },
        desert: { say: ['~surprised~ From the desert? Then you’ve walked under where they flew. And now you’ve carried its drum back here, the long way round.', '~happy~ Take the chord with you. It’s yours as much as theirs, now.'], do: [{ advance: [Q, 'ume'] }, { keepsake: KEEPSAKE }], next: 'end' },
        where: { say: ['~curious~ I don’t know. Somewhere with bells, and singers, and sand. If you’ve been anywhere with sand and a drum, you’ve walked under where they flew.', '~happy~ Take the chord with you. It’s yours as much as theirs, now.'], do: [{ advance: [Q, 'ume'] }, { keepsake: KEEPSAKE }], next: 'end' },
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
      say: ['~solemn~ You set the pebble at the foot of the pole. It is a mirror all the way through: in it the pole goes up and up, and the sky goes down and down.', '~whisper~ The hum changes, very slightly, as if there were water in it now.'],
      do: { set: { 'spheres.pebble.placed': true } },
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
};
