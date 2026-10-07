// Per-level content: the story thread, relics and people (worlds are reached by the ship).
// Coordinates are world space.
// Relic spots: [x, z] drops onto the highest surface there (often a rooftop
// or a mesa you have to climb); { at: [x, y, z], snap: true } lands on the
// surface just below y; { at: [x, y, z] } floats exactly there.
// Story goal y: a number, 'ground' (terrain height) or 'top' (highest surface).

// a person's own colours: the cloak (and any given here); the tunic, trousers, skin and hat
// come from their world's costumes when not set (src/costumes.js)
const pal = (cloak, extra = {}) => ({ cloak, lining: extra.lining ?? '#2b211f', ...extra });

import { ARZACH2_CONTENT } from './arzach2.js';
import { LAB_FACES, labPeople } from './lab.js';
import { REFERENCE_PEOPLE } from './references.js';
import { BURIED_CONTENT } from './buried.js';
import { EDENA_CONTENT } from './edena.js';
import { SPHERES_CONTENT } from './spheres.js';
import { PERDIDE2_CONTENT } from './perdide2.js';
import { PERDIDE_CONTENT } from './perdide.js';
import { HOME_CONTENT } from './home.js';
import { RIM as INCAL_RIM, PEOPLE as INCAL_PEOPLE } from '../story/incal-data.js';
import { STREET as BAZAAR_STREET } from '../story/bazaar-data.js';

import { ORDER } from './names.js';
export { ORDER };
export const nextLevel = (id) => ORDER[(ORDER.indexOf(id) + 1) % ORDER.length];

let labNpcs = null;
export const CONTENT = {
  arzach2: ARZACH2_CONTENT,
  buried: BURIED_CONTENT,
  spheres: SPHERES_CONTENT,
  perdide2: PERDIDE2_CONTENT,
  home: HOME_CONTENT,   // src/levels/home.js: the parents at the door
  bazaar: {
    weather: [],
    // the Signal Market's story is a quest (src/story/bazaar-data.js): this page opens on the
    // first visit and closes when the tower has spoken and Sel has read where it came from
    story: {
      title: 'YOU ARE NOT ALONE',
      intro: "A market full of shouting signs, and one silent broadcast tower. Sel waits at its foot with a message nobody has heard.",
      outro: "Your father’s voice filled the market, calling for someone named Ilen. The message came from home, thirty years ago.",
      label: 'the broadcast balcony', goal: [0, 45, -234], radius: 5, verticalRadius: 5, manual: true,
    },
    relics: {
      spots: [{at:[18,1.1,48]}, {at:[-29,6.2,-35]}, {at:[0,26.1,-90]}, {at:[12,45.1,-232]}, {at:[0,65.1,-330]}],
      names: ['Lantern seed', 'Market stamp', 'Skybridge ticket', 'Cracked valve', 'Pigeon’s message ring'],
    },
    // the market's own people; the story's (Sel, Kip, Ferro, Brush, Ummu) are in src/story/bazaar-data.js
    npcs: [
      {at:[12,105],radius:2,palette:pal('#dca273'),lines:["~happy~ Welcome! The broadcast tower is straight ahead.","~neutral~ Use the tower’s blue ledges, your jetpack, or the parked cab."],...BAZAAR_STREET.doss},
      {at:[-17,42],radius:1,palette:pal('#84bab3'),lines:["~shout~ Portable sunshine! Comes with a handle!","~whisper~ A lantern seed’s lying across the street. Go have a look."],...BAZAAR_STREET.oyo},
      {at:[14,-203],radius:1,palette:pal('#c3a9cc'),lines:["~neutral~ The old transmitter is on the cream balcony.","~neutral~ A taxi will get you above the bridges."],...BAZAAR_STREET.teb},
    ],
  },
  // src/levels/lab.js: no story, no relics; a gallery of giant villagers to study faces by (every face variant), and the
  // people of every biome room in their own world's clothes
  lab: {
    weather: [],
    story: { title: 'THE LAB', intro: 'Surfaces in a row, faces as big as houses, and a door to every world.', outro: 'Done looking.', label: 'the row', goal: [0, 'ground', -24], radius: 6, manual: true },
    relics: { spots: [], names: [] },
    // (a getter: the rooms' people are worked out only when the Lab, or a test, asks for them)
    get npcs() {
      return (labNpcs ??= [...LAB_FACES.map((g) => ({
        at: g.at, radius: 0, scale: 4, shy: false, kind: g.kind, palette: g.palette, head: g.head,
        face: g.face, expression: g.expression, facing: g.facing,
        lines: ['~happy~ Look closely.', '~curious~ Is it the eyes, or the ink?', '~neutral~ Hold still.', '~playful~ My good side is this one.'],
      })), ...labPeople()]);
    },
  },
  // src/levels/references.js: no story, no relics; the reference panels' small figures, standing where the panels have them
  references: {
    weather: [],
    story: { title: 'THE REFERENCES', intro: 'The pages this world is drawn after, rebuilt in its own ink. Hold them side by side.', outro: 'Done comparing.', label: 'the first panel', goal: [0, 'ground', 0], radius: 6, manual: true },
    relics: { spots: [], names: [] },
    npcs: REFERENCE_PEOPLE,
  },
  atelier: {
    weather: [],
    story: {
      title: 'THE LAST PAGE',
      intro: 'Every world you crossed was drawn here.',
      outro: 'The pen lifts. The page is yours now.',
      label: 'the pen', goal: [0, 'ground', 0], radius: 18,
    },
    relics: { spots: [], names: [] },
    npcs: [
      { at: [22, 26], radius: 3, palette: { cloak: '#2b211f', cloth: '#f3ead8', legs: '#2b2f45' },
        lines: ["~happy~ Found my atelier? Mind the ink.", "~playful~ I drew those deserts. You did the difficult walking bit.", "~solemn~ Go on. There’s room for another line."] },
    ],
  },
  desert: {
    weather: ['storm'],
    // the desert's story is a quest (src/story/desert-data.js): this page
    // opens on the first visit and closes when the ship has power again
    story: {
      title: 'THE TREE THAT DRINKS',
      intro: "Your ship needs fuel. Beyond the dunes, Qanat’s great tree stands dark above the walls. Start with the people there.",
      outro: "You cleared the water channel, brought back the spark-stone, and relit Qanat’s tree. Its glowing water has powered your ship.",
      label: 'the great dark tree', goal: [230, 'ground', 400], radius: 20, manual: true,
    },
    relics: {
      spots: [[-260, -330], [150, -210], [-150, -112], [150, 60], [-262, 12]],
      names: ['Sun disc', 'Bone flute', 'Glass bead', 'Mask shard', 'Salt-polished coin'],
    },
    // the people near the start (indices matter: errands and the observatory use them);
    // the camps' people are in src/story/desert-data.js
    npcs: [
      { at: [30, 12], palette: pal('#d8a24a', { cloth: '#5a4a3a' }), lines: ["~tired~ Wind’s erased my tracks. Again.", "~solemn~ Old walls under every dune."],
        id: 'ysa', name: 'Ysa', title: 'dune walker', color: '#d8a24a', talk: { listen: [
          "~tired~ Ysa. Dune walker. The wind erases my tracks every night. I try not to take it as criticism.",
          { if: { not: { flag: 'item.backpack' } }, say: '~neutral~ Qanat is *north-east, past the low dunes*. Look for the great dark tree over the walls; the pilgrims are camped at its gate.' },
          "~solemn~ There are buried cities under these dunes. Qanat stayed above the sand. The old people say its tree’s roots hold it together.",
          '~playful~ Lost? Good. Walking only works if you get a little lost.',
          { after: { flag: 'world.desert.done' }, say: '~happy~ The tree burns again. I can walk home by it at night, the way I used to.' },
        ] } },
      { at: [-140, -80], palette: pal('#5fb7ad'), lines: ['~whisper~ The mask sleeps. Don’t wake it.', '~neutral~ I counted the ribs once. Forty.'],
        id: 'pell', name: 'Pell', title: 'counter of bones', color: '#5fb7ad', talk: {
        entry: [{ if: { quest: 'desert.mask', done: true }, node: 'washed' }, { node: 'hello' }],
        nodes: {
          washed: { say: ["~surprised~ You cleaned its eyes? Both of them? I’ve walked past that face for twenty years and only ever counted its teeth.", "~whisper~ Did it look at you? Don’t answer. I’ll sleep better guessing."], choices: [
            { text: '~curious~ What sleeps under the city?', goto: 'giant' }, { text: '~neutral~ Bye, Pell.', end: true }] },
          hello: { say: ["~playful~ Pell. I counted the great ribcage south of here. Forty ribs. The giant beneath Qanat is harder; people object when you count under their kitchens."], choices: [
            { text: '~surprised~ There’s a giant under the city?', goto: 'giant' }, { text: '~curious~ What sleeps in the south?', goto: 'mask' }] },
          giant: { say: ["~solemn~ Its head sticks out beyond Qanat’s back gate. The city stands above its body. An entire neighbourhood on somebody’s chest."], choices: [{ text: '~curious~ And the south?', goto: 'mask' }, { text: '~neutral~ Bye.', end: true }] },
          mask: { say: ["~whisper~ Find *the sleeping mask south, past the ribs*. Face toward the sky. I wouldn’t assume it can’t notice you."], do: { start: 'desert.mask' }, choices: [{ text: '~neutral~ I’ll look at it.', end: true }] },
        } } },
      { at: [110, -150], palette: pal('#8a6fb8', { face: '#e6d3b8' }), lines: ["~curious~ Seen a riderless bike? Mine has gone exploring.", "~tired~ It had a red seat. It probably still thinks it has a red seat.", "~playful~ If you meet a bike with opinions, tell it I’ve forgiven it."], shy: true,
        id: 'rook', name: 'Rook', title: 'who lost a bike', color: '#8a6fb8', talk: {
          // before you have a hoverbike of your own, Rook sends you to Marrow for one (quest desert.bike)
          entry: [{ if: { not: { flag: 'desert.bike.found' } }, node: 'walk' }, { node: 'hello' }],
          nodes: {
          walk: { say: ["~curious~ I’m Rook. Looking for my bike. It leaves without consulting me. You’re walking too, I see.", "~whisper~ Try *Marrow at the camps*. He’s hidden a bike under a tarp. Not mine; I checked. Ask him where to find it."],
            do: (ctx) => { if (!ctx.quests?.isStarted('desert.bike') && ctx.quests?.def('desert.bike')) ctx.quests.start('desert.bike'); },
            choices: [{ text: '~happy~ I’ll ask him. Good luck, Rook.', end: true }] },
          hello: { say: ["~playful~ Your bike comes when called. Mine seems to consider that a suggestion. Seen it anywhere?"], choices: [{ text: '~playful~ What does yours think?', goto: 'op' }, { text: '~happy~ Good luck, Rook.', end: true }] },
          op: { say: ["~tired~ It thinks I’m slow and talk too much. Probably gone to the procession, where both are encouraged."], choices: [{ text: '~happy~ Good luck.', end: true }] },
        } } },
      { at: [-120, 34], palette: pal('#e6875f'), lines: ['~neutral~ The salt flats are that way. Bring water.', '~solemn~ At night the moon throws shadows too.'],
        id: 'ennor', name: 'Ennor', title: 'guide to the salt', color: '#e6875f', talk: { listen: [
          ['~neutral~ The salt flats are west. Bring water. Bring two waters.', '~solemn~ At night the moon throws shadows too, and they don’t always point away from it.'],
          '~playful~ Water? Ask the pilgrims at Qanat; they’ve waited eleven days for water themselves. The tree gets the first drink. It always has.',
          '~angry~ I’m a guide, not a well. Go and be thirsty somewhere else.',
          '~neutral~ Lost in the dunes? Climb the tallest one and look for the tree. Everything here is measured from the tree.',
          { after: { flag: 'temple.desert.done' }, say: '~surprised~ Green, round Qanat. Twenty years I’ve walked people past those fields, and I never once saw them green.' },
        ] } },
      { at: [10, -200], palette: pal('#f3ead8', { cloth: '#7a4a35' }), lines: ['~neutral~ The stones hum when a storm comes.', '~whisper~ Listen. Lower than that. That’s the stones.', '~neutral~ Clear sky today. The stones agree, for once.'],
        id: 'tamsin', name: 'Tamsin', title: 'listener to stones', color: '#f3ead8', talk: { listen: [
          "~curious~ The stones hum before a storm. But that night before your crash, they hummed under clear skies. A light passed, singing their note.",
          '~scared~ Low, then rising, like a question. The stones answered it. I didn’t like the answer, and I don’t speak stone.',
          '~whisper~ Shh. A storm is coming. Or that’s my stomach. One of the two.',
          '~neutral~ When the stones hum, get behind something. The storms come quick off the flats, and the sand gets everywhere. Everywhere.',
          { after: { flag: 'world.desert.done' }, say: '~solemn~ They hum softer since the tree burned. As if somebody had put a hand on them.' },
        ] } },
      { at: [-18, 18], radius: 2, palette: pal('#697a98'), lines: ['~neutral~ A sleeping observatory stands east of camp.', '~playful~ Hold still. No, you moved. Never mind, you’re a smudge now.'],
        id: 'traveller', name: 'The traveller', title: 'sketching', color: '#697a98', talk: { nodes: {
          hello: { say: ["~sad~ East of camp: an observatory with a brass ring on top. I’ve drawn it a hundred times, always asleep. I’d like one picture of it working."], choices: [{ text: '~curious~ How do I wake it?', goto: 'how' }, { text: '~neutral~ Bye.', end: true }] },
          how: { say: ["~playful~ Climb the six ledges and turn all three lenses toward its centre. Tell me what happens. My knees have retired from ledges."], choices: [{ text: '~happy~ I will.', end: true }] },
        } } },
    ],
  },
  incal: {
    weather: ['fog'],
    // the City-Shaft's story is a quest (src/story/incal-data.js): this page opens on
    // the first visit and closes when the light burns again and Nima has been told
    story: {
      title: 'THE LIGHT NOBODY LOOKS AT',
      intro: 'Above the palace, the Lodestar turns, dimmer than it should be. Nobody here looks up.',
      outro: "The Lodestar shines again. For a moment, the entire city shared a view. Nima asked you to remember: look up once a day.",
      label: 'the Lodestar', goal: [0, 450, 0], radius: 34, manual: true,
    },
    relics: {
      spots: [{ at: [320, 200, -80], snap: true }, { at: [-210, 150, 30], snap: true }, { at: [150, 36, -150], snap: true }, { at: [-60, -86, 205], snap: true }, { at: [205, -218, -40], snap: true }],
      names: ['Taxi token', 'Palace key', 'Smog lantern', 'Smog-cabbage seed', 'Prayer bead'],
    },
    // the rim's people, and Nima on the high terrace (index 3: the desert's errand of
    // singing sand is for her); the rest of the city's people are in src/story/incal-data.js
    npcs: [
      { at: [300, -40], y: 200, palette: pal('#e88fa6', { cloth: '#3a3f5a' }), lines: ["~angry~ Below the smog? I’ve never needed to go.", "~tired~ The Lodestar is a tourist attraction. So I’m told."], ...INCAL_RIM.corvin },
      { at: [330, 40], y: 200, palette: pal('#62c3c9'), lines: ["~playful~ Watch the taxis. Their hurry outranks yours."], ...INCAL_RIM.lio },
      { at: [290, 110], y: 200, palette: pal('#f2c54b', { cloth: '#5a3a3a' }), lines: ["~shout~ Views of the abyss! Looking up remains free!"], shy: true, ...INCAL_RIM.hask },
      { ...INCAL_PEOPLE.nima, at: [112.1, 165.8], y: 150, radius: 1.8, speed: 0.45 },
    ],
  },
  arzach: {
    weather: ['storm'],
    // the story is a quest (src/story/arzach-data.js): this page closes when the bird has made her promise
    story: {
      title: 'THE WAITING BIRD',
      intro: 'Nobody here says much. Somewhere over the haze a great bird waits for a call nobody has played since her rider left the lone tower.',
      outro: "The rider left a little flute and a map. When you played her call, the bird came down. A new promise, freely given.",
      label: 'the lone tower', goal: [260, 'top', -420], drop: 40, radius: 30, manual: true,   // the spike tip is ~40 m above the window room
    },
    relics: {
      spots: [[170, -260], [-150, -210], [300, 100], [-250, -80], [60, 300]],
      names: ['Bird feather', 'Bone needle', 'Tower brick', 'Pale stone eye', 'Wind charm'],
    },
    npcs: [
      // (Tam, who copies you: a boy of seven, src/story/arzach-data.js LOCALS)
      { at: [40, 44], palette: pal('#f4efe2', { cloth: '#8a7a66' }), lines: ['~tired~ …'], shy: true, kind: 'm', age: 'child', years: 7, scale: 0.72 },
      { at: [-60, -40], palette: pal('#d8c7a6'), lines: ["~solemn~ The wind climbs the tower. Wings climb with it.", "~sad~ Her rider left. She keeps to the sky now."] },
      { at: [120, -100], palette: pal('#b0705a'), lines: ["~sad~ That stone hand once moved. They say."] },
    ],
  },
  garage: {
    weather: ['rain'],
    // the story is a quest (src/story/garage-data.js): this page closes when the Major's note is found
    story: {
      title: 'THE MAJOR FORGOT',
      intro: 'Major Brask built this pocket universe, and forgot why. His people keep the machines turning, and pass round a signal nobody can read.',
      outro: "The Major’s note asks what his world might become. On its back: coordinates for a wheel buried in sand. The machines keep working.",
      label: 'the great machine', goal: [90, 86, -60], radius: 12, manual: true,
    },
    relics: {
      spots: [[0, -40], [-120, 60], [150, 40], { at: [60, 898.8, 2940] }, { at: [2940, -148.8, 0] }],
      names: ['Brask’s cog', 'Portal fuse', 'Ring compass', 'Upside-down coin', 'Gravity marble'],
    },
    npcs: [
      { at: [40, 60], palette: pal('#e6875f', { cloth: '#3f8f8a' }), lines: ["~playful~ Gravity is a local arrangement here.", "~tired~ The Major built this world and forgot its purpose."] },
      { at: [-80, -20], palette: pal('#62c3c9'), lines: ["~angry~ Hands clear of the gears, please!"] },
      { at: [120, -110], palette: pal('#f2c54b'), lines: ["~playful~ Walk round the ring and arrive where you left."], shy: true },
    ],
  },
  edena: EDENA_CONTENT,
  // the swamp's story and its people: src/levels/perdide.js, src/story/perdide-data.js
  perdide: PERDIDE_CONTENT,
};

// Errands: villagers asking you to carry something to someone in another
// world. Greeting the giver hands you the parcel; greeting the receiver
// (npc index into that world's `npcs`) delivers it. Each goes on to the next
// world on the route (ORDER): the desert, Vael, Vael II, Lorn, Lorn II, Viridel,
// the City-Shaft, the Sealed Hangar.
export const ERRANDS = [
  { id: 'sand', item: 'a jar of singing sand', from: ['desert', 1], to: ['arzach', 1],
    ask: "~curious~ Vael is next for you? Take this sand from between the great ribs. It sings when the wind crosses it. Give it to *Senn in Vael*, the woman who listens to stones. They say nothing there makes a sound. Let her hear something sing.",
    wait: "~neutral~ *Senn, in Vael.* The one with her ear to the stones.",
    // Vael is quiet by choice: Senn answers the way Vael says anything, with her hands and a word
    thanks: "~happy~ (Senn holds the jar to her ear. The sand hums. She hums back, very softly.) *It sings.*" },
  { id: 'feather', item: 'a feather from the bird', from: ['arzach', 2], to: ['arzach2', 0],
    ask: "~solemn~ (Hollin gives you a grey feather, then points past the tower, to the stones in the sky.) *The sky stones.*",
    wait: "~neutral~ (Hollin points to the sky again: the feather goes on, to the sky stones.)",
    thanks: "~happy~ One of her feathers, from Vael? Then she still flies. I’ll tie it to the whistle post, so she knows the way here." },
  { id: 'crystal', item: 'a humming crystal', from: ['perdide', 2], to: ['perdide2', 2],
    ask: "~neutral~ Going on into the deep wood? Take this crystal to *Bram, who keeps the skiff in Lorn II*. It hums before storms. Out on the water, he’ll want the warning.",
    wait: "~neutral~ *Bram, by the skiff in the shallows, in Lorn II.*",
    thanks: "~happy~ A storm stone, from Ivo? Now I’ll hear the weather coming before the skiff does. Thank you." },
  { id: 'gear', item: 'a brass gear', from: ['perdide2', 1], to: ['edena', 0],
    ask: "~neutral~ Take this brass gear to *Mira in Viridel*. It came out of an old dome pump we don’t use. Her water clock has been missing one for years.",
    wait: "~neutral~ *Mira, at the water clock in Viridel.*",
    thanks: "~happy~ A gear, from Lorn’s domes? *Fit it on the clock’s axle*, please. I’ve missed knowing when to water." },
  { id: 'seed', item: 'a glass seed', from: ['edena', 3], to: ['incal', 3],
    ask: "~neutral~ Take this glass seed to *Nima in the City-Shaft*. Nothing grows in that smog, they say. This one doesn’t need sun.",
    wait: "~neutral~ *Nima, who sweeps the high terrace, down the red stair from the City-Shaft’s rim.*",
    thanks: "~happy~ A seed, from Viridel’s gardens? Glass, so the smog can’t hurt it. I’ll keep it on my sill, where the Lodestar reaches. Thank you." },
  { id: 'token', item: 'a taxi token', from: ['incal', 1], to: ['garage', 0],
    ask: "~playful~ Take this taxi token to *the Sealed Hangar*. They’ve never seen a cab there. Show them what a real city runs on.",
    wait: "~neutral~ *Someone in the Sealed Hangar.* Anyone who’ll admire it.",
    thanks: "~playful~ A cab token? We don’t have cabs. We have walls that turn into floors. I’ll keep it for the day we do." },
];
