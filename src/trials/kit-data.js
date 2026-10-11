// The makers' runs (docs/systems/challenges.md): optional challenges built from the temples' own kit, stood
// in the open world, a second kind of trial beside each world's ride (src/trials/data.js). Each is a short
// chain of temple pieces (gusts down a hall, a bank of eyes, crystal pendulums over a causeway) with a
// makers' sign a step from its start; the same start card, clock, best and Retry as the trials
// (src/minigames/kit/runner.js). Its reward is quiet: someone standing nearby has a word for you (on the
// results card and over their head), and the sign's plate keeps your best.
// Pure data (src/trials/kit-courses.js builds them; tests/trials-kit.test.js checks them in their worlds).
//
//   id       'kit-<world>' (its best: minigame.kit-<world>.best; its first finish: trial.kit-<world>.done)
//   course   which builder (src/trials/kit-courses.js COURSES): 'windhall', 'hushwalk', 'featherleap', 'furnacesteps',
//            'spherecourt', 'longlook', 'echorelay', 'vinewalk', 'bellcrossing', 'lampwalk', 'discrun', 'soundwalk',
//            'moonroll', 'moorleap'
//   origin   [x, y, z] the course's frame (its entrance, at floor level) and yaw (radians: its +z runs
//            into it); everything else is in that frame, metres
//   marker   [x, z] the sign, in the course's frame (on the ground there)
//   start    [x, z] and heading (in the frame): where the run begins
//   par      the makers' mark (s): a steady first run beats it
//   needs    items it wants (the fluid gun for a bank of eyes); lacks: the words when they are missing
//   wet      the run ends in the water (a causeway)
//   fall     the run ends down on the ground under it: { after: gates passed, below: height in the frame (m),
//            from: only this far along the frame (m, its z) or further, words } (the feather leap: the plain
//            under its tower and its gulf; the furnace steps: the grate under the pillars; the long look: the shaft)
//   onFoot   walked: up on the jets for more than a moment ends it (offFeet: the words on the card)
//   noWings  the wings opened end it at once too (the vine walk: a glide would carry you over its gaps)
//   controls the start card's controls (src/trials/index.js CONTROLS; default 'kit': walk, jump, splash;
//            'kitwings'; 'kitecho': walk, splash, play the shell back; 'kitbell': walk, jump, sound the bell;
//            'kitlamp': walk, jump, stand by a lamp with the lantern; 'kithorn': walk, jump, sound the whale-horn)
//   voice    who speaks when it ends well ({ who: the person's id, name, from: where they stand, and the
//            lines: first, beaten (the makers' mark, the first time), again }): every line carries its tone

import { partsOf, shiftAt } from '../levels/names.js';

export const KIT_TRIALS = {
  'kit-desert': {
    id: 'kit-desert', world: 'desert', mode: 'kit', course: 'windhall', name: 'Wind hall', color: '#9fd6ee',
    blurb: 'A roofless hall of the makers on a dune crest west of the landing, where the wind is kept and let go in gusts.',
    rules: 'Walk the hall to its far end through the gusts: when the streaks come, get behind a screen. Under the porch at its end, wake all three eyes with the fluid in one breath.',
    origin: [-135, 21.4, -64], yaw: 0,
    marker: [4.4, -7.2], start: [0, -1.4], heading: 0, par: 42,
    needs: ['backpack', 'gun'], lacks: 'The eyes at its end want the fluid gun.',
    onFoot: true,
    voice: {
      who: 'pell', name: 'Pell', from: 'at the foot of the dune',
      first: '~playful~ Forty-six steps, and most of them against the wind. I counted. Come back and make it fewer.',
      beaten: '~surprised~ Under the makers’ own mark! That hall hasn’t been walked so fast since it had a roof.',
      again: '~neutral~ I counted again. The wind lost.',
    },
  },
  'kit-perdide': {
    id: 'kit-perdide', world: 'perdide', mode: 'kit', course: 'hushwalk', name: 'Hush walk', color: '#c7a6f2',
    blurb: 'A causeway of the makers out over the lake south of the landing, with crystals of the Hush swinging across it.',
    rules: 'Walk out to the round stone at the end of the causeway and back to the shore. The crystals knock you into the lake: time them, or still one with a stilling burst.',
    origin: [4, 1.2, 24], yaw: 0,
    marker: [-3.6, -3.2], start: [0, -1.2], heading: 0, par: 48,
    wet: true, onFoot: true,
    voice: {
      who: 'sedge', name: 'Sedge', from: 'in the reeds by the shore',
      first: '~whisper~ Out and back, and dry. The crystals swing for the Hush, not for us. You made them look slow.',
      beaten: '~surprised~ That was quicker than the makers meant it. Don’t tell Wendel. He’ll want to try.',
      again: '~neutral~ Dry again. The reeds noticed.',
    },
  },
  'kit-arzach': {
    id: 'kit-arzach', world: 'arzach', mode: 'kit', course: 'featherleap', name: 'Feather leap', color: '#7cc1c4',
    blurb: 'The Aerie’s winds stood out on the plain north-west of the landing, by the stone hand: a rising column, a gusty terrace, a gulf.',
    rules: 'Open your wings in the column of wind at the tower’s foot and ride it up to the terrace. Cross the terrace through the gusts, screen to screen, then glide the gulf to the ledge. Down on the plain, and the run is over.',
    origin: [-104, 25, -202], yaw: 0,
    marker: [5.4, -8.2], start: [0, 1.5], heading: 0, par: 45,
    needs: ['backpack', 'glider'], lacks: 'It is flown as much as walked: it wants the fluid wings.',
    onFoot: true, offFeet: 'Wings and feet only: no jets.',
    fall: { after: 1, below: 3, words: 'Down on the plain' },
    controls: 'kitwings',
    voice: {
      who: 'hollin', name: 'Kesh', from: 'by the stone hand',
      first: '~solemn~ (Kesh points up the wind, along the terrace, over the gap, and nods.) Low to high. Then over. Good.',
      beaten: '~surprised~ Quicker than the makers. (He shows you three teeth.) Quicker.',
      again: '~tired~ Hm. (He taps one knuckle.) Again. Good.',
    },
  },
  'kit-buried': {
    id: 'kit-buried', world: 'buried', mode: 'kit', course: 'furnacesteps', name: 'Furnace steps', color: '#e07a4f',
    blurb: 'Iron pillars of the makers over a glowing grate on the sand east of the landing, and a door of four eyes beyond.',
    rules: 'Jump from pillar to pillar across the furnace to the landing at its end; down on the grate, and the run is over. Then wake the door’s four eyes in one breath.',
    origin: [40, 11, 66], yaw: 0,
    marker: [4.8, -6], start: [0, 1.5], heading: 0, par: 34,
    needs: ['backpack', 'gun', 'magic:4'], lacks: 'The door at its end has four eyes to wake in one breath: it wants a longer magic bar (the fourth chamber).',
    onFoot: true, offFeet: 'This one is jumped: no jets.',
    fall: { after: 0, below: -2.5, from: 6, words: 'Down on the grate' },
    voice: {
      who: 'pim', name: 'Jot', from: 'nine teeth old, by the landing',
      first: '~surprised~ You jumped ALL the pillars! I only jump the first one. Then I climb down. Wen says that counts.',
      beaten: '~playful~ Faster than the makers! I counted on my teeth. I ran out of teeth.',
      again: '~playful~ Again! Do it nine more times. Then ten.',
    },
  },
  'kit-spheres': {
    id: 'kit-spheres', world: 'spheres', mode: 'kit', course: 'spherecourt', name: 'Sphere court', color: '#a8e6ee',
    blurb: 'The Footprint’s hall of spheres stood out on the meadow south of the mirror lake: a slalom of stone spheres, two white ones in their grooves.',
    rules: 'Weave the slalom of stone spheres to the arch at the far end. Then roll both white spheres onto the plates at the dais with the fluid’s push: one from each end.',
    origin: [140, 0.4, -22], yaw: Math.PI / 2,
    marker: [4.4, -3.6], start: [0, -0.4], heading: 0, par: 42,
    needs: ['backpack', 'gun'], lacks: 'Its spheres are rolled with the fluid’s push: it wants the fluid gun.',
    onFoot: true,
    voice: {
      who: 'nell', name: 'Nell', from: 'who looks into the lake',
      first: '~happy~ Both home! In the lake it looked like four spheres rolling. Twice the work, and you did it in no time at all.',
      beaten: '~surprised~ Quicker than the makers! The reflection could hardly keep up with you.',
      again: '~playful~ Again? The lake says it’s getting dizzy. It’s smiling, though.',
    },
  },
  'kit-incal': {
    id: 'kit-incal', world: 'incal', mode: 'kit', course: 'longlook', name: 'Long look', color: '#9fdcef',
    blurb: 'A makers’ balcony out over the City-Shaft from the rim, three stones over the drop, a stone ball at its head.',
    rules: 'Roll the stone ball out along the balcony with the fluid’s push, walking (and jumping the gaps) behind it, onto the plate at the far end. There is no parapet: down the shaft, and the run is over.',
    origin: [266, 200.3, 61.44], yaw: -1.7978,
    marker: [4.2, -5.6], start: [0, -1.6], heading: 0, par: 40,
    needs: ['backpack', 'gun'], lacks: 'Its ball is rolled with the fluid’s push: it wants the fluid gun.',
    onFoot: true, offFeet: 'This one is walked: no jets.',
    fall: { after: 0, below: -3, from: 13.5, words: 'Down the shaft' },
    voice: {
      who: 'hask', name: 'Tobin', from: 'seller of views',
      first: '~shout~ Rolled a ball to the end of the world and walked out after it! That’s a view. That’s worth two coins. I’m keeping them.',
      beaten: '~surprised~ Faster than the makers, over that drop? Don’t do that in front of customers. They’ll want a discount.',
      again: '~playful~ Back for another look? First one’s free. That was the second. One coin.',
    },
  },
  'kit-bazaar': {
    id: 'kit-bazaar', world: 'bazaar', mode: 'kit', course: 'echorelay', name: 'Echo relay', color: '#62c3c9',
    blurb: 'The Undertower’s singing stones and listening horns stood out down the first side street west of the avenue, with old dishes on the walls between.',
    rules: 'Walk past the listening walls to the arch at the far end. Then give each horn its own note: splash a stone near enough for the echo shell to catch its song, carry it to the horn of its colour, and play it back. The shell holds one note at a time.',
    origin: [-42, 0.35, 75], yaw: -Math.PI / 2,
    marker: [4.4, -3.6], start: [0, -1.4], heading: 0, par: 38,
    needs: ['backpack', 'gun', 'echo'], lacks: 'Its stones sing for the fluid and its horns listen for the echo shell: it wants both.',
    onFoot: true, offFeet: 'This one is walked: no jets.',
    controls: 'kitecho',
    voice: {
      who: 'oyo', name: 'Oyo', from: 'who sells lanterns on the avenue',
      first: '~shout~ Low, high, middle, and every horn answering! I stopped selling to listen. Nobody bought a thing. Worth it.',
      beaten: '~surprised~ Quicker than the makers! I didn’t have time to light a single lantern.',
      again: '~playful~ Again? Play it slower next time. I sell more lanterns when there’s music.',
    },
  },
  'kit-edena': {
    id: 'kit-edena', world: 'edena', mode: 'kit', course: 'vinewalk', name: 'Vine walk', color: '#7fcfa8',
    blurb: 'The Greenhouse’s vine gulf stood out on the long slope east of Mira’s water clock: four white decks over the meadow, three gaps, a seed at each, and a flower-door.',
    rules: 'Cross the three gaps to the arch on the last deck. Switch the gun to bloom and wake the seed at each gap: its vine grows a bridge across. A bloom opens the flower-door too. Down in the meadow, or on your wings, and the run is over.',
    origin: [57, -3.2, 1], yaw: Math.PI / 2,
    marker: [4.4, -4.6], start: [0, 0.6], heading: 0, par: 28,
    needs: ['backpack', 'gun', 'bloom'], lacks: 'Its seeds and its flower-door want the bloom.',
    onFoot: true, noWings: true, offFeet: 'Feet only: the vines carry you over, not the wings or the jets.',
    fall: { after: 0, below: -2, from: 12, words: 'Down in the meadow' },
    voice: {
      who: 'mira', name: 'Mira', from: 'who keeps the water clock',
      first: '~happy~ Three bridges grown and walked before my clock dripped twice. The builders would have liked you.',
      beaten: '~surprised~ Quicker than the builders! The vines had hardly finished growing under your feet.',
      again: '~playful~ Again? The vines are getting used to you. Mind the flowers. They mind you.',
    },
  },
  'kit-arzach2': {
    id: 'kit-arzach2', world: 'arzach2', mode: 'kit', course: 'bellcrossing', name: 'Bell crossing', color: '#f6c84e',
    blurb: 'The Founders’ Belfry’s fallen-up bridges stood out over the sea of cloud from the south rim: four floating decks, three gaps, a bell at each, and a bell-tuned door.',
    rules: 'Cross the three gaps to the arch on the last deck. The stones of each bridge hang high over its gap: sound the bell-note whistle by the bell at the edge and they come down into place. The door on the last deck opens to the bell too. Into the cloud, or on your wings, and the run is over.',
    origin: [0, 40.5, 85], yaw: 0,
    marker: [-4.4, -4.6], start: [0, 0.6], heading: 0, par: 28,
    needs: ['bell'], lacks: 'Its bridges and its door answer the bell-note whistle.',
    onFoot: true, noWings: true, offFeet: 'Feet only: the stones carry you over, not the wings or the jets.',
    fall: { after: 0, below: -2, from: 12, words: 'Into the cloud' },
    controls: 'kitbell',
    voice: {
      who: 'aube', name: 'Sister Aube', from: 'the hermit of the edge',
      first: '~happy~ The stones came down for you, one bridge after another. I watched from my door. I wrote it down, next to the cloud.',
      beaten: '~surprised~ Quicker than the founders! The stones hardly had time to settle before you were off them.',
      again: '~playful~ Again? Mind the edges. The cloud is patient, and I am running out of page.',
    },
  },
  'kit-perdide2': {
    id: 'kit-perdide2', world: 'perdide2', mode: 'kit', course: 'lampwalk', name: 'Lamp walk', color: '#ffd6a0',
    blurb: 'The Lamp-House’s dark gallery stood out on the lake south of the landing: four decks out over the dark water, three gaps, and a keeper’s lamp at each.',
    rules: 'Cross the three gaps to the arch on the last deck. Stand by the lamp at each gap’s edge with the lantern charm until it wakes: its light raises a walkway of moss-stones out of the water. In the water, or on your wings, and the run is over.',
    origin: [-23.7, 1.3, 31.6], yaw: -0.436,
    marker: [-4.6, -5.4], start: [0, 0.6], heading: 0, par: 30,
    needs: ['lantern'], lacks: 'Its lamps wake only to the lantern charm.',
    wet: true, onFoot: true, noWings: true, offFeet: 'Feet only: the lamps’ stones carry you over, not the wings or the jets.',
    controls: 'kitlamp',
    voice: {
      who: 'hollin.perdide2', name: 'Hollin', from: 'the keeper of the lamps',
      first: '~happy~ Three lamps lit and walked before the stones had settled. Forty years I have kept lamps for travellers. That is the first time a traveller lit them for me.',
      beaten: '~surprised~ Quicker than the makers meant it! The moss hardly had time to glow under your feet.',
      again: '~solemn~ Again? Good. A lamp likes to be needed.',
    },
  },
  // (the Sealed Hangar's until October 2026, stood on its plain: its world dismissed, it moved to the Glass Dunes with the house)
  'kit-glassdunes': {
    id: 'kit-glassdunes', world: 'glassdunes', mode: 'kit', course: 'discrun', name: 'Disc run', color: '#62c3c9',
    blurb: 'The Clock-House’s riding discs stood out on the sand east of the ship: two islands and a landing on blocks over the sand, a disc shuttling across each gap, and a bank of eyes at the end.',
    rules: 'Ride the discs over to the landing: step on as one comes to you, step off at the far side. On the landing, wake all three eyes with the fluid in one breath. Down on the sand, or on your wings, and the run is over.',
    origin: [40, 7.5, 222], yaw: Math.PI / 2,
    marker: [4.6, -7.6], start: [0, 0.6], heading: 0, par: 54,
    needs: ['backpack', 'gun'], lacks: 'The eyes at its end want the fluid gun.',
    onFoot: true, noWings: true, offFeet: 'Feet only: the discs carry you over, not the wings or the jets.',
    fall: { after: 0, below: -2, from: 8, words: 'Down on the sand' },
    voice: {
      who: 'oren', name: 'Oren', from: 'who carries the floats',
      first: '~happy~ The old ones say the makers rode discs like those over the hot sand at noon. You kept your feet cooler than they did.',
      beaten: '~surprised~ Under the makers’ own mark! I’ll tell the kiln. The kiln will not care, but I’ll tell it.',
      again: '~playful~ Round again? The discs don’t mind. They have nowhere else to be either.',
    },
  },
  // (the three worlds that joined the route in v1.40, each from its temple's kit)
  'kit-underwater': {
    id: 'kit-underwater', world: 'underwater', mode: 'kit', course: 'soundwalk', name: 'Sounding walk', color: '#6f8fd8',
    blurb: 'The Whale-House’s brass horns stood out on a strip of its shell-pink floor in the Avenue’s north-west, under the dome: two listening screens and three horns that wait for the whales’ deep note.',
    rules: 'Walk the strip past the screens to the arch at its end. Then wake the three horns: sound the whale-horn by each, close enough for it to hear. Its note carries only a few steps.',
    origin: [-30, 0.12, 26], yaw: 0,
    marker: [-4.8, -4], start: [0, 0.6], heading: 0, par: 30,
    needs: ['horn'], lacks: 'Its horns answer only the whale-horn’s deep note.',
    onFoot: true, offFeet: 'Feet only: walked, not flown.',
    controls: 'kithorn',
    voice: {
      who: 'coralie', name: 'Coralie', from: 'who keeps the café',
      first: '~happy~ Three horns, one after another! The cups on my counter rattled with every note. I’ll call that a review.',
      beaten: '~surprised~ Quicker than the makers meant! The last horn was still humming when the first one woke.',
      again: '~playful~ Again? The regulars have started timing you. They bet in sugar lumps.',
    },
  },
  'kit-moonfoundry': {
    id: 'kit-moonfoundry', world: 'moonfoundry', mode: 'kit', course: 'moonroll', name: 'Moon roll', color: '#e89a5a',
    blurb: 'The Casting-House’s stone moons and cradles stood out on the foundry floor south of the last furnace: three hoist frames to weave round and two test casts to roll home.',
    rules: 'Weave round the hoist frames to the arch at the far end. Then roll both stone moons into their cradles with the fluid’s push, each its own way: a splash only nudges one.',
    origin: [78, 0.12, -22], yaw: Math.PI,
    marker: [5.4, -7], start: [0, 0.6], heading: 0, par: 50,
    needs: ['backpack', 'gun'], lacks: 'The moons roll only for the fluid gun’s push.',
    onFoot: true,
    voice: {
      who: 'bertil', name: 'Bertil', from: 'who pours at the last furnace',
      first: '~happy~ Both moons in their cradles, and neither one cracked. My first test casts went into the wall. Twice.',
      beaten: '~surprised~ Under the founders’ own mark! The furnace roared when the second one went home. It likes a good roll.',
      again: '~neutral~ Again? Mind the cradles. They’re older than the floor.',
    },
  },
  'kit-spacecity': {
    id: 'kit-spacecity', world: 'spacecity', mode: 'kit', course: 'moorleap', name: 'Moorers’ leap', color: '#f0c06a',
    blurb: 'The Mooring-House’s breath of the void stood out from the Towers’ east edge into the dark: a mooring post, a gulf of open dark and a landing with a capstan wall.',
    rules: 'Open your wings in the void’s breath beside the mooring post and ride it up to the deck. Glide the gulf to the landing, then wake the capstan wall’s three eyes with the fluid in one breath. Into the dark, and the run is over.',
    origin: [112, 6.1, -84], yaw: Math.PI / 2,
    marker: [5.4, -6.4], start: [0, 1.5], heading: 0, par: 45,
    needs: ['backpack', 'gun', 'glider'], lacks: 'It is flown as much as walked: it wants the fluid wings, and the gun for its eyes.',
    onFoot: true, offFeet: 'Wings and feet only: no jets.',
    fall: { after: 1, below: 3, words: 'Into the dark' },
    voice: {
      who: 'tamar', name: 'Tamar', from: 'who minds the cables',
      first: '~solemn~ Up the breath, over the dark, and all three eyes. The moorers used to do that with a rope round their waists.',
      beaten: '~surprised~ Quicker than the moorers! The cables hummed when you landed. I felt it in my teeth.',
      again: '~playful~ Again? The dark is patient. I am too, mostly.',
    },
  },
};

/** The makers' runs standing in a world (its parts': a merged world has two), each where its part lies in it (names.js PART_OFFSET). */
export const kitTrialsFor = (world) => {
  const parts = partsOf(world);
  return Object.values(KIT_TRIALS).filter((T) => parts.includes(T.world)).map((T) => ({ ...T, origin: shiftAt(T.world, T.origin) }));
};
