// Per-level content: the story thread, relics, people and the gate onward.
// Coordinates are world space.
// Relic spots: [x, z] drops onto the highest surface there (often a rooftop
// or a mesa you have to climb); { at: [x, y, z], snap: true } lands on the
// surface just below y; { at: [x, y, z] } floats exactly there.
// Story goal y: a number, 'ground' (terrain height) or 'top' (highest surface).

const TUNICS = ['#343a56', '#5a4a3a', '#3f6f6a', '#6a3a4a', '#e2d3b4', '#4a5a3a'];
const TROUSERS = ['#2b2f45', '#4a3a2a', '#2f3f3a', '#5a4a40', '#3a3a3a'];
const any = (a) => a[Math.floor(Math.random() * a.length)];
const pal = (cloak, extra = {}) => ({ cloak, lining: extra.lining ?? '#2b211f', cloth: any(TUNICS), legs: any(TROUSERS), ...extra });

export const ORDER = ['desert', 'incal', 'arzach', 'garage', 'edena', 'perdide'];
export const nextLevel = (id) => ORDER[(ORDER.indexOf(id) + 1) % ORDER.length];

export const CONTENT = {
  atelier: {
    weather: [],
    story: {
      title: 'THE LAST PAGE',
      intro: 'Every world you crossed was drawn here.',
      outro: 'The pen lifts. The page is yours now.',
      label: 'the pen', goal: [0, 'ground', 0], radius: 18,
    },
    relics: { spots: [], names: [] },
    gate: { at: [0, 110], heading: 0 },
    npcs: [
      { at: [22, 26], radius: 3, palette: { cloak: '#2b211f', cloth: '#f3ead8', legs: '#2b2f45' },
        lines: ['Ah, you found the atelier.', 'I only draw the deserts. You walked them.', 'Every line starts as a wander.'] },
    ],
  },
  desert: {
    weather: ['storm'],
    story: {
      title: 'THE MASK IN THE SAND',
      intro: 'Something old sleeps beneath the dunes.',
      outro: 'It does not wake. But it saw you.',
      label: 'the masked head', goal: [-20, 'ground', -372], radius: 26,
    },
    relics: {
      spots: [[-180, -260], [70, -110], [-58, -44], [150, 60], [-262, 12]],
      names: ['Sun disc', 'Bone flute', 'Glass bead', 'Mask shard', 'Salt-polished coin'],
    },
    gate: { at: [24, 34], heading: Math.PI },
    npcs: [
      { at: [30, 12], palette: pal('#d8a24a', { cloth: '#5a4a3a' }), lines: ['The wind took my tracks again.', 'Every dune remembers a city.'] },
      { at: [-36, -86], palette: pal('#5fb7ad'), lines: ['The mask sleeps. Don’t wake it.', 'I counted the ribs once. Forty.'] },
      { at: [96, -60], palette: pal('#8a6fb8', { face: '#e6d3b8' }), lines: ['Have you seen my bike? It wanders off.'], shy: true },
      { at: [-120, 34], palette: pal('#e6875f'), lines: ['The salt flats are that way. Bring water.', 'At night the moon throws shadows too.'] },
      { at: [10, -200], palette: pal('#f3ead8', { cloth: '#7a4a35' }), lines: ['The stones hum when a storm comes.'] },
    ],
  },
  incal: {
    weather: ['fog'],
    story: {
      title: 'THE LIGHT IN THE SHAFT',
      intro: 'Above the palace, the Incal turns. Hail a taxi.',
      outro: 'For a moment, every level of the city looks up.',
      label: 'the Incal', goal: [0, 450, 0], radius: 34,
    },
    relics: {
      spots: [{ at: [320, 200, -80], snap: true }, { at: [-210, 150, 30], snap: true }, { at: [150, 36, -150], snap: true }, { at: [-60, -86, 205], snap: true }, { at: [205, -218, -40], snap: true }],
      names: ['Taxi token', 'Palace key', 'Smog lantern', 'Lower-levels ration', 'Incal splinter'],
    },
    gate: { at: [300, 60], heading: -Math.PI / 2 },
    npcs: [
      { at: [300, -40], palette: pal('#e88fa6', { cloth: '#3a3f5a' }), lines: ['Level −86? Never been below the smog.', 'The Incal? A story for tourists.'] },
      { at: [330, 40], palette: pal('#62c3c9'), lines: ['Mind the taxis. They don’t stop.'] },
      { at: [290, 110], palette: pal('#f2c54b', { cloth: '#5a3a3a' }), lines: ['I sell views of the abyss. Cheap.'], shy: true },
      { at: [-30, 150], y: 150, radius: 8, palette: pal('#a99be0'), lines: ['The rich live up here. Me, I just sweep.'] },
    ],
  },
  arzach: {
    weather: ['storm'],
    story: {
      title: 'THE LONE TOWER',
      intro: 'Ride the bird to the window.',
      outro: 'No one answers. The bird waits.',
      label: 'the lone tower', goal: [260, 'top', -420], drop: 40, radius: 30,   // the spike tip is ~40 m above the window room
    },
    relics: {
      spots: [[170, -260], [-150, -210], [300, 100], [-250, -80], [60, 300]],
      names: ['Bird feather', 'Bone needle', 'Tower brick', 'Pale stone eye', 'Wind charm'],
    },
    gate: { at: [26, 32], heading: Math.PI },
    npcs: [
      { at: [40, 44], palette: pal('#f4efe2', { cloth: '#8a7a66' }), lines: ['…'], shy: true },
      { at: [-60, -40], palette: pal('#d8c7a6'), lines: ['The bird knows the way.', 'She has waited in the tower a long time.'] },
      { at: [120, -100], palette: pal('#b0705a'), lines: ['Even the stone hand was alive, once.'] },
    ],
  },
  garage: {
    weather: ['rain'],
    story: {
      title: 'THE MAJOR’S MACHINE',
      intro: 'Climb to the crown of the great machine.',
      outro: 'Somewhere, Major Grubert smiles.',
      label: 'the great machine', goal: [90, 86, -60], radius: 12,
    },
    relics: {
      spots: [[0, -40], [-120, 60], [150, 40], { at: [60, 898.8, 2940] }, { at: [2940, -148.8, 0] }],
      names: ['Grubert’s cog', 'Portal fuse', 'Ring compass', 'Upside-down coin', 'Gravity marble'],
    },
    gate: { at: [-60, 112], heading: Math.PI },
    npcs: [
      { at: [40, 60], palette: pal('#e6875f', { cloth: '#3f8f8a' }), lines: ['Up is a matter of opinion here.', 'The Major built all of this. Then he forgot.'] },
      { at: [-80, -20], palette: pal('#62c3c9'), lines: ['Don’t lean on the gears.'] },
      { at: [120, -110], palette: pal('#f2c54b'), lines: ['The ring? Walk far enough and you’re back.'], shy: true },
    ],
  },
  edena: {
    weather: ['rain'],
    story: {
      title: 'STEL AND ATAN',
      intro: 'Their ship fell in the meadow. Find it.',
      outro: 'The garden has already begun to grow over it.',
      label: 'the crashed ship', goal: [40, 'ground', -210], radius: 28,
    },
    relics: {
      spots: [[60, -80], [-200, 220], [180, 120], [-300, 50], [240, -300]],
      names: ['Canopy blossom', 'Pyramid seed', 'Android sprocket', 'Glyph tablet', 'Ship rivet'],
    },
    gate: { at: [26, 34], heading: Math.PI },
    npcs: [
      { at: [30, 30], palette: pal('#f7f4ec', { cloth: '#62c3c9', face: '#dfe8ec' }), lines: ['We tend the garden. The garden tends us.'] },
      { at: [-60, 60], palette: pal('#9fd6c9', { cloth: '#f7f4ec' }), lines: ['Stel? Atan? They left in the ship.'] },
      { at: [150, 100], palette: pal('#f2a7b5'), lines: ['The pyramids are older than the androids.'], shy: true },
      { at: [-170, 190], palette: pal('#b5a7e6'), lines: ['Climb the trees. The view is worth it.'] },
    ],
  },
  perdide: {
    weather: ['rain', 'fog'],
    story: {
      title: 'THE GREAT CRYSTAL',
      intro: 'Cross the swamp. Follow the hum.',
      outro: 'The crystal sings. The plants fall silent.',
      label: 'the Great Crystal', goal: [120, 'ground', -150], radius: 30,
    },
    relics: {
      spots: [{ at: [-170, 3.6, 140], snap: true }, [-14, -30], [40, -70], [200, 60], [-90, -260]],
      names: ['Cave lantern', 'Egg shell', 'Crystal splinter', 'Plant tooth', 'Skiff charm'],
    },
    gate: { at: [22, 24], heading: Math.PI },
    npcs: [
      { at: [10, -18], radius: 7, palette: pal('#8a6fb8', { cloth: '#3f5a4a' }), lines: ['Don’t feed the plants.', 'The crystals hum when it rains.'] },
      { at: [-24, 12], radius: 6, palette: pal('#62c3c9', { cloth: '#3a3f5a' }), lines: ['The cave glows all night.'], shy: true },
      { at: [-150, 120], radius: 10, palette: pal('#d6ff9a', { cloth: '#3a3f5a' }), lines: ['Fireflies, or something else?'] },
    ],
  },
};
