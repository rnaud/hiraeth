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
import { LAB_FACES } from './lab.js';
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
      intro: 'A thousand signs are speaking. One tower has fallen silent. Somebody at its foot is waiting for someone to care.',
      outro: 'A voice crossed the square: you are not alone. For a moment, everyone stopped to listen. Something of value? Someone was listening.',
      label: 'the broadcast balcony', goal: [0, 45, -234], radius: 5, verticalRadius: 5, manual: true,
    },
    relics: {
      spots: [{at:[18,1.1,48]}, {at:[-29,6.2,-35]}, {at:[0,26.1,-90]}, {at:[12,45.1,-232]}, {at:[0,65.1,-330]}],
      names: ['Lantern seed', 'Market stamp', 'Skybridge ticket', 'Cracked valve', 'Pigeon’s message ring'],
    },
    // the market's own people; the story's (Sel, Kip, Ferro, Brush, Ummu) are in src/story/bazaar-data.js
    npcs: [
      {at:[12,105],radius:2,palette:pal('#dca273'),lines:['~happy~ Welcome to the Signal Market. The broadcast tower is straight ahead.','~neutral~ Climb its blue ledges, use your jetpack, or take the parked taxi.'],...BAZAAR_STREET.doss},
      {at:[-17,42],radius:1,palette:pal('#84bab3'),lines:['~shout~ Every lantern holds a little sun.','~whisper~ Somebody dropped a lantern seed on the other side of the street.'],...BAZAAR_STREET.oyo},
      {at:[14,-203],radius:1,palette:pal('#c3a9cc'),lines:['~neutral~ The cream balcony has the old transmitter.','~neutral~ The taxis can take you above the bridges.'],...BAZAAR_STREET.teb},
    ],
  },
  // src/levels/lab.js: no story, no relics; four giant villagers to study faces by
  lab: {
    weather: [],
    story: { title: 'THE LAB', intro: 'Surfaces in a row, and faces as big as houses.', outro: 'Done looking.', label: 'the row', goal: [0, 'ground', -24], radius: 6, manual: true },
    relics: { spots: [], names: [] },
    npcs: LAB_FACES.map(([x, z], i) => ({
      at: [x, z], radius: 0, scale: 4, shy: false,
      palette: [{ cloak: '#d8a24a', cloth: '#f3ead8', legs: '#2b2f45' }, { cloak: '#8a6fb8', cloth: '#e2d3b4', legs: '#2b2f45', hat: '#62c3c9' },
        { cloak: '#5fb7ad', cloth: '#5a4a3a', legs: '#3a3a3a', hat: '#f3ead8' }, { cloak: '#c8483a', cloth: '#f3ead8', legs: '#2b211f' }][i],
      head: ['hair', 'hair', 'hat', 'hair'][i],
      lines: ['~happy~ Look closely.', '~curious~ Is it the eyes, or the ink?', '~neutral~ Hold still.', '~playful~ My good side is this one.'],
    })),
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
        lines: ['~happy~ Ah, you found the atelier.', '~playful~ I only draw the deserts. You walked them.', '~solemn~ Every line starts as a wander.'] },
    ],
  },
  desert: {
    weather: ['storm'],
    // the desert's story is a quest (src/story/desert-data.js): this page
    // opens on the first visit and closes when the ship has power again
    story: {
      title: 'THE TREE THAT DRINKS',
      intro: 'The ship is dark. Beyond the dunes, smoke rises, and a tree is burning.',
      outro: 'The water rose, the tree drank, and the ship woke. Something of value? Ask the pilgrims.',
      label: 'the burning tree', goal: [230, 'ground', 400], radius: 20, manual: true,
    },
    relics: {
      spots: [[-260, -330], [150, -210], [-150, -112], [150, 60], [-262, 12]],
      names: ['Sun disc', 'Bone flute', 'Glass bead', 'Mask shard', 'Salt-polished coin'],
    },
    // the people near the start (indices matter: errands and the observatory use them);
    // the camps' people are in src/story/desert-data.js
    npcs: [
      { at: [30, 12], palette: pal('#d8a24a', { cloth: '#5a4a3a' }), lines: ['~tired~ The wind took my tracks again.', '~solemn~ Every dune remembers a city.'],
        id: 'ysa', name: 'Ysa', title: 'dune walker', color: '#d8a24a', talk: { nodes: {
          hello: { say: ['~tired~ The wind took my tracks again. Every morning I walk out, every evening the dunes pretend I never did.'], choices: [
            { text: '~curious~ Where is everyone?', goto: 'where' }, { text: '~curious~ What do the dunes remember?', goto: 'city' }, { text: '~neutral~ Bye, Ysa.', end: true }] },
          where: { say: ['~neutral~ At Qanat, the old city, north-east past the low dunes. You can see the tree burning from here, look. The pilgrims are camped at its gate, waiting for the drinking.'], choices: [{ text: '~happy~ Thanks.', end: true }] },
          city: { say: ['~solemn~ Every dune remembers a city. Walls under the sand, everywhere. Qanat is the one that didn’t sink: the tree holds it up by the roots, the old people say.'], choices: [{ text: '~happy~ Thanks.', end: true }] },
        } } },
      { at: [-140, -80], palette: pal('#5fb7ad'), lines: ['~whisper~ The mask sleeps. Don’t wake it.', '~neutral~ I counted the ribs once. Forty.'],
        id: 'pell', name: 'Pell', title: 'counter of bones', color: '#5fb7ad', talk: { nodes: {
          hello: { say: ['~playful~ I counted the ribs once. The big beast south of here: forty. The giant under Qanat must have more, but you can’t count what you’re standing on.'], choices: [
            { text: '~surprised~ There’s a giant under the city?', goto: 'giant' }, { text: '~curious~ What sleeps in the south?', goto: 'mask' }, { text: '~neutral~ Bye, Pell.', end: true }] },
          giant: { say: ['~solemn~ Its head sticks out by the back gate. The rest of it is the hill the city stands on. Big things lie down and become places. Give it time.'], choices: [{ text: '~curious~ And the south?', goto: 'mask' }, { text: '~neutral~ Bye.', end: true }] },
          mask: { say: ['~whisper~ The mask sleeps, past the ribs, face to the sky. Don’t wake it. Or do; I don’t think it can.'], do: { start: 'desert.mask' }, choices: [{ text: '~neutral~ I’ll look at it.', end: true }] },
        } } },
      { at: [110, -150], palette: pal('#8a6fb8', { face: '#e6d3b8' }), lines: ['~curious~ Have you seen my bike? It wanders off.'], shy: true,
        id: 'rook', name: 'Rook', title: 'who lost a bike', color: '#8a6fb8', talk: { nodes: {
          hello: { say: ['~playful~ Have you seen my bike? It wanders off. Yours comes when you whistle, I saw. Mine has opinions.'], choices: [{ text: '~playful~ What does yours think?', goto: 'op' }, { text: '~happy~ Good luck, Rook.', end: true }] },
          op: { say: ['~tired~ That I walk too slowly and talk too much. It went to see the procession, I bet. Everyone goes to see the procession.'], choices: [{ text: '~happy~ Good luck.', end: true }] },
        } } },
      { at: [-120, 34], palette: pal('#e6875f'), lines: ['~neutral~ The salt flats are that way. Bring water.', '~solemn~ At night the moon throws shadows too.'],
        id: 'ennor', name: 'Ennor', title: 'guide to the salt', color: '#e6875f', talk: { nodes: {
          hello: { say: ['~neutral~ The salt flats are west. Bring water. Bring two waters. At night the moon throws shadows too, and they don’t always point away from it.'], choices: [{ text: '~curious~ Where can I find water?', goto: 'water' }, { text: '~neutral~ Bye.', end: true }] },
          water: { say: ['~playful~ Ha. Ask the pilgrims at Qanat; they’ve been waiting eleven days for water themselves. The tree gets the first drink. Always has.'], choices: [{ text: '~happy~ Thanks, Ennor.', end: true }] },
        } } },
      { at: [10, -200], palette: pal('#f3ead8', { cloth: '#7a4a35' }), lines: ['~neutral~ The stones hum when a storm comes.'],
        id: 'tamsin', name: 'Tamsin', title: 'listener to stones', color: '#f3ead8', talk: { nodes: {
          hello: { say: ['~curious~ The stones hum when a storm comes. Three nights ago they hummed with no storm at all, and a light went over, singing the same note.'], choices: [{ text: '~curious~ The same note?', goto: 'note' }, { text: '~neutral~ Bye, Tamsin.', end: true }] },
          note: { say: ['~scared~ Low, then rising. Like a question. The stones answered it. I didn’t like the answer, and I don’t speak stone.'], choices: [{ text: '~neutral~ Bye.', end: true }] },
        } } },
      { at: [-18, 18], radius: 2, palette: pal('#697a98'), lines: ['~neutral~ A sleeping observatory stands east of camp.'],
        id: 'traveller', name: 'The traveller', title: 'sketching', color: '#697a98', talk: { nodes: {
          hello: { say: ['~sad~ A sleeping observatory stands east of camp: a tower crowned by a brass ring. I’ve drawn it a hundred times. I’ve never seen it awake.'], choices: [{ text: '~curious~ How do I wake it?', goto: 'how' }, { text: '~neutral~ Bye.', end: true }] },
          how: { say: ['~playful~ Climb its six ledges. Turn the three lenses toward the heart. Then come back and tell me; I’m too old for ledges.'], choices: [{ text: '~happy~ I will.', end: true }] },
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
      outro: 'For a moment, every level of the city looked up. Something of value? Look up once a day.',
      label: 'the Lodestar', goal: [0, 450, 0], radius: 34, manual: true,
    },
    relics: {
      spots: [{ at: [320, 200, -80], snap: true }, { at: [-210, 150, 30], snap: true }, { at: [150, 36, -150], snap: true }, { at: [-60, -86, 205], snap: true }, { at: [205, -218, -40], snap: true }],
      names: ['Taxi token', 'Palace key', 'Smog lantern', 'Smog-cabbage seed', 'Prayer bead'],
    },
    // the rim's people, and Nima on the high terrace (index 3: the desert's errand of
    // singing sand is for her); the rest of the city's people are in src/story/incal-data.js
    npcs: [
      { at: [300, -40], y: 200, palette: pal('#e88fa6', { cloth: '#3a3f5a' }), lines: ['~angry~ Level −86? Never been below the smog.', '~tired~ The Lodestar? A story for tourists.'], ...INCAL_RIM.corvin },
      { at: [330, 40], y: 200, palette: pal('#62c3c9'), lines: ['~playful~ Mind the taxis. They don’t stop.'], ...INCAL_RIM.lio },
      { at: [290, 110], y: 200, palette: pal('#f2c54b', { cloth: '#5a3a3a' }), lines: ['~shout~ I sell views of the abyss. Cheap.'], shy: true, ...INCAL_RIM.hask },
      { ...INCAL_PEOPLE.nima, at: [112.1, 165.8], y: 150, radius: 1.8, speed: 0.45 },
    ],
  },
  arzach: {
    weather: ['storm'],
    // the story is a quest (src/story/arzach-data.js): this page closes when the bird has made her promise
    story: {
      title: 'THE WAITING BIRD',
      intro: 'Nobody here says much. A bird waits beside you, and keeps turning to look at a lone tower.',
      outro: 'The rider is not coming back. The bird has chosen to come when you call.',
      label: 'the lone tower', goal: [260, 'top', -420], drop: 40, radius: 30, manual: true,   // the spike tip is ~40 m above the window room
    },
    relics: {
      spots: [[170, -260], [-150, -210], [300, 100], [-250, -80], [60, 300]],
      names: ['Bird feather', 'Bone needle', 'Tower brick', 'Pale stone eye', 'Wind charm'],
    },
    npcs: [
      { at: [40, 44], palette: pal('#f4efe2', { cloth: '#8a7a66' }), lines: ['~tired~ …'], shy: true },
      { at: [-60, -40], palette: pal('#d8c7a6'), lines: ['~solemn~ The bird knows the way.', '~sad~ She has waited in the tower a long time.'] },
      { at: [120, -100], palette: pal('#b0705a'), lines: ['~sad~ Even the stone hand was alive, once.'] },
    ],
  },
  garage: {
    weather: ['rain'],
    // the story is a quest (src/story/garage-data.js): this page closes when the Major's note is found
    story: {
      title: 'THE MAJOR FORGOT',
      intro: 'Major Grubert built this pocket universe, and forgot why. His people keep the machines turning, and pass round a signal nobody can read.',
      outro: '“I built it to see what I would do with it. I still don’t know. That is the point.” Somewhere, Major Grubert smiles.',
      label: 'the great machine', goal: [90, 86, -60], radius: 12, manual: true,
    },
    relics: {
      spots: [[0, -40], [-120, 60], [150, 40], { at: [60, 898.8, 2940] }, { at: [2940, -148.8, 0] }],
      names: ['Grubert’s cog', 'Portal fuse', 'Ring compass', 'Upside-down coin', 'Gravity marble'],
    },
    npcs: [
      { at: [40, 60], palette: pal('#e6875f', { cloth: '#3f8f8a' }), lines: ['~playful~ Up is a matter of opinion here.', '~tired~ The Major built all of this. Then he forgot.'] },
      { at: [-80, -20], palette: pal('#62c3c9'), lines: ['~angry~ Don’t lean on the gears.'] },
      { at: [120, -110], palette: pal('#f2c54b'), lines: ['~playful~ The ring? Walk far enough and you’re back.'], shy: true },
    ],
  },
  edena: EDENA_CONTENT,
  // the swamp's story and its people: src/levels/perdide.js, src/story/perdide-data.js
  perdide: PERDIDE_CONTENT,
};

// Errands: villagers asking you to carry something to someone in another
// world. Greeting the giver hands you the parcel; greeting the receiver
// (npc index into that world's `npcs`) delivers it. A loop through every world.
export const ERRANDS = [
  { id: 'sand', item: 'a jar of singing sand', from: ['desert', 1], to: ['incal', 3],
    ask: '~curious~ My cousin sweeps the high terraces of the city. Take her this jar of singing sand?',
    wait: '~neutral~ The terraces, up by the palace. She sweeps there.',
    thanks: '~happy~ Sand from home! It still hums. Thank you, traveller.' },
  { id: 'token', item: 'a taxi token', from: ['incal', 1], to: ['arzach', 1],
    ask: '~neutral~ Someone out in the bone country wants a ride. Give them this token.',
    wait: '~neutral~ Arzach’s country. Fly out past the bones.',
    thanks: '~sad~ A token for a city I’ll never see. I’ll keep it anyway.' },
  { id: 'feather', item: 'a feather from the bird', from: ['arzach', 2], to: ['garage', 0],
    ask: '~neutral~ The Major collects feathers. Bring this one to his people in the Garage.',
    wait: '~neutral~ The hollow world. Someone there will know the Major.',
    thanks: '~playful~ Ha! The Major will pretend he never asked for it.' },
  { id: 'gear', item: 'a brass gear', from: ['garage', 1], to: ['edena', 0],
    ask: '~playful~ A gardener in Edena needs a gear for her water clock. Don’t lean on it.',
    wait: '~neutral~ Edena. The garden with the white pyramids.',
    thanks: '~happy~ It fits. The garden can keep time again.' },
  { id: 'seed', item: 'a glass seed', from: ['edena', 3], to: ['perdide', 0],
    ask: '~neutral~ Carry this seed to the egg-warden in the swamp. He knows where it grows.',
    wait: '~whisper~ Perdide. Follow the glow.',
    thanks: '~solemn~ We don’t feed the plants. But this one we will plant.' },
  { id: 'crystal', item: 'a humming crystal', from: ['perdide', 2], to: ['desert', 0],
    ask: '~neutral~ Bring this crystal to the dune walker. It hums before storms.',
    wait: '~neutral~ The golden dunes, near where you first woke.',
    thanks: '~happy~ Now I’ll hear the storms before they find me. Thank you.' },
];
