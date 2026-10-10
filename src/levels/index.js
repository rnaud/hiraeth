import { TITLES, worldFor } from './names.js';
import { createDesert, buildDesert } from './desert.js';
import { createIncal, buildIncal } from './incal.js';
import { createArzach, buildArzach } from './arzach.js';
import { createEdena, buildEdena } from './edena.js';
import { createPerdide, buildPerdide } from './perdide.js';
import { createBazaar, buildBazaar } from './bazaar.js';
import { createArena, buildArena } from './arena.js';
import { createArcade, buildArcade } from './arcade.js';
import { createGadgetYard, buildGadgetYard } from './gadget-yard.js';
import { createLab, buildLab } from './lab.js';
import { createBuried, buildBuried } from './buried.js';
import { createSpheres, buildSpheres } from './spheres.js';
import { createHome, buildHome } from './home.js';
import { createLantern, buildLantern } from './lantern.js';
import { createReferences, buildReferences } from './references.js';
import { createMangrove, buildMangrove } from './mangrove.js';
import { createGlassDunes, buildGlassDunes } from './glass-dunes.js';
import { createWaterfall, buildWaterfall } from './waterfall.js';
import { createSaltHarbour, buildSaltHarbour } from './salt-harbour.js';
import { createAntennas, buildAntennas } from './antennas.js';
import { createUnderwater, buildUnderwater } from './underwater.js';
import { createEclipse, buildEclipse } from './eclipse.js';
import { createFallenRing, buildFallenRing } from './fallen-ring.js';
import { createMoonFoundry, buildMoonFoundry } from './moon-foundry.js';
import { createUnderside, buildUnderside } from './underside.js';
import { createSpaceCity, buildSpaceCity } from './space-city.js';
import { createOvernightTrain, buildOvernightTrain } from './overnight-train.js';

// Level registry: shown in the picker and the panel, loaded with ?level=<id>.
export const LEVELS = [
  {
    id: 'desert', create: createDesert, build: buildDesert,
    title: TITLES.desert, source: 'after Sable (Shedworks)',
    blurb: 'Dunes, mesas and giant skeletons across three regions. Find a hoverbike and whistle for it; watch the salt blooms wake as you pass.',
    moves: 'walk · climb · glide · hoverbike',
  },
  {
    id: 'incal', create: createIncal, build: buildIncal,
    title: TITLES.incal, source: 'a city stacked down a pit',
    blurb: 'A city stacked down a 600 m pit to an acid lake. The makers’ jets wait in their tower on the rim; the flying taxis stop only for a pass. Quiet terminals recognize returning visitors.',
    moves: 'jetpack · climb · glide · taxis (with a pass)',
  },
  {
    // (with Vael II's sky stones since October 2026: names.js MERGED)
    id: 'arzach', create: createArzach, build: buildArzach,
    title: TITLES.arzach, source: 'a silent world of needles',
    blurb: 'A silent bone-white plain of needle spires and a lone tower, and past its cliff, stones that fell up over a sea of cloud. Find the makers’ wings, ride the wind up the tower, learn the call that brings the great bird down, and ride her to the silent bell on the rose cliff.',
    moves: 'glide · winds · climb · flying mount',
  },
  {
    // on the route since October 2026, in the Sealed Hangar's place (names.js ORDER), with its temple
    id: 'glassdunes', create: createGlassDunes, build: buildGlassDunes,
    title: TITLES.glassdunes, source: 'a desert that turned to glass',
    blurb: 'Dunes of fused green glass, great shapes held inside them, and the glassworkers’ camps at their feet. East of the valley a round house of the makers stands in the sand with a stopped clock over its door, and every clock in the camps keeps the wrong time.',
    moves: 'walk · climb · jetpack',
  },
  {
    id: 'buried', create: createBuried, build: buildBuried,
    title: TITLES.buried, source: 'a machine under the dunes',
    blurb: 'Domes and pipes surface from pale dunes. Below them lie rust-red machine canyons, giant ring windows, and a city hanging upside down from the sky.',
    moves: 'climb · jetpack',
  },
  {
    id: 'edena', create: createEdena, build: buildEdena,
    title: TITLES.edena, source: 'a garden that keeps what falls',
    blurb: 'A clean, colourful garden planet: giant umbrella trees, step pyramids and white android ruins to climb. Flowers unfold and answer one another.',
    moves: 'climbing · stamina',
  },
  {
    id: 'spheres', create: createSpheres, build: buildSpheres,
    title: TITLES.spheres, source: 'spheres that answer',
    blurb: 'Umbrella trees shade white pyramids. Great pale spheres sink into a mirror lake, and cypress avenues lead to a round stone plaza.',
    moves: 'walk · climb',
  },
  {
    id: 'perdide', create: createPerdide, build: buildPerdide,
    title: TITLES.perdide, source: 'a twilight swamp that hums',
    blurb: 'A twilight swamp of humming crystal forests, carnivorous plants and glowing eggs. Cross it by skiff; shy fungi close and send glowing spores through the reeds.',
    moves: 'hover-skiff · wading · caves',
  },
  {
    id: 'bazaar', create: createBazaar, build: buildBazaar,
    title: TITLES.bazaar, source: 'a city of a thousand broadcasts',
    blurb: 'Coral towers, illustrated signs and a busy alien bazaar. Climb the skybridges or hail a cab to the silent broadcast tower. Shop screens wake, recognize you and echo distant encounters.',
    moves: 'market streets · skybridges · jetpack · taxis',
  },
  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'mangrove', create: createMangrove, build: buildMangrove, hidden: true,
    title: TITLES.mangrove, source: 'a village in the white roots',
    blurb: 'Bone-white trees stand on arching roots in a black lake, and people live in them. Walk the lantern-lit planks, climb to the decks round the trunks, and look down: the lake glows like a second sky.',
    moves: 'walk · climb · swim',
  },  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'saltharbour', create: createSaltHarbour, build: buildSaltHarbour, hidden: true,
    title: TITLES.saltharbour, source: 'a street of ships in the salt',
    blurb: 'Huge old ships stand on their keels in a dry white salt basin, and people live in them. Walk the street between their hulls under the sailcloth, climb the stair to a deck, and cross the gangway to the next.',
    moves: 'walk · climb',
  },

  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'waterfall', create: createWaterfall, build: buildWaterfall, hidden: true,
    title: TITLES.waterfall, source: 'a city behind a curtain of water',
    blurb: 'A long cavern city hidden behind a towering waterfall. Terraced streets of rounded houses, amber lamps in the deep quarter, and balconies behind slits in the water, looking out over a sunlit valley.',
    moves: 'walk · climb · swim · jetpack',
  },
  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'antennas', create: createAntennas, build: buildAntennas, hidden: true,
    title: TITLES.antennas, source: 'a plain of listening masts',
    blurb: 'Abandoned masts by the thousand on a plain of violet grass, great dishes turned up like flowers, birds nesting in them. Walk to the workshops under the immense receiver and climb the stair to the observation deck.',
    moves: 'walk · climb',
  },
  {
    // on the route since v1.40, the fifth world (names.js ORDER), with its temple, the Whale-House
    id: 'underwater', create: createUnderwater, build: buildUnderwater,
    title: TITLES.underwater, source: 'a city under glass on the sea floor',
    blurb: 'A city of glass domes on the floor of the sea, its halls joined by sealed tubes, towers of amber pods and whales on the other side of the glass. The whales used to sing against it; since the night the sky rang they keep away, and the glass hums one wrong note.',
    moves: 'walk · climb · the lift',
  },
  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'eclipse', create: createEclipse, build: buildEclipse, hidden: true,
    title: TITLES.eclipse, source: 'a city at noon under a black sun',
    blurb: 'A city of white domes and round towers at midday, the moon over the sun: the lamps lit, people eating outside by lantern light, pale figures leaning from the walls. Walk the Lantern Square, climb the Great Stair and the tiers of the bowl, and look out over the lit city on the plain.',
    moves: 'walk · climb',
  },
  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'fallenring', create: createFallenRing, build: buildFallenRing, hidden: true,
    title: TITLES.fallenring, source: 'a ring that fell from the sky',
    blurb: 'The pieces of a broken orbital ring lie across a sage-green plain: arches higher than the clouds, tubes in the grass with villages along their feet, broken ends open on the streets inside. Walk among the grazing herds and climb onto the long tube’s crest.',
    moves: 'walk · climb',
  },
  {
    // on the route since v1.40, after the Buried Machine (names.js ORDER), with its temple, the Casting-House
    id: 'moonfoundry', create: createMoonFoundry, build: buildMoonFoundry,
    title: TITLES.moonfoundry, source: 'a workshop for making moons',
    blurb: 'Unfinished ivory moons hang from the cranes of a vast open hangar or rest in orange claws, and the workers live in the old machinery. Since the night the sky rang every hung moon has turned toward where the light went, and at night the makers’ Casting-House pours again by itself.',
    moves: 'walk · climb',
  },
  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'underside', create: createUnderside, build: buildUnderside, hidden: true,
    title: TITLES.underside, source: 'a town hung under a shelf of rock',
    blurb: 'A shelf of white rock juts out over a sea of cloud, and a town hangs under it: round white houses stuck to the rock, timber decks slung on rods, long red banners falling toward the cloud. Go down the great stair, walk the galleries under the shelf to its tip, and climb back up the timber stair.',
    moves: 'walk · climb',
  },
  {
    // on the route since v1.40, before the Signal Market (names.js ORDER), with its temple, the Mooring-House
    id: 'spacecity', create: createSpaceCity, build: buildSpaceCity,
    title: TITLES.spacecity, source: 'a city of islands in the dark',
    blurb: 'Rounded houses in cream, salmon and coral heaped on islands that float in the black of space, joined by pale arched bridges, a great pale planet over the roofs. The islands are drifting apart a hand’s width a night, and the moorers’ cables have hummed one note since the sky rang.',
    moves: 'walk · climb · glide',
  },
  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'overnighttrain', create: createOvernightTrain, build: buildOvernightTrain, hidden: true,
    title: TITLES.overnighttrain, source: 'a train across a plain by night',
    blurb: 'A long streamlined train crosses a lavender plain by night under two moons, its windows lit, gardens on its roofs. The ship comes down on its landing wagon at a station; walk forward through the library, the sleeping cars and the dining car to the lounge and its balcony at the nose, or climb a porch ladder and walk the roofs in the wind.',
    moves: 'walk · climb',
  },
  {
    // a developer's world: the game's surfaces and giant faces side by side (in the worlds list, L, for testing; never on the route)
    id: 'lab', create: createLab, build: buildLab, hidden: true, dev: true,
    title: 'The Lab', source: 'for looking closely',
    blurb: 'Every surface the game draws, on pedestals in a row, and four giant villagers to study faces by.',
    moves: 'walk · jetpack',
  },
  {
    // a developer's world: the fluid blade against the foes, wave after wave (in the worlds list, L; never on the route)
    id: 'arena', create: createArena, build: buildArena, hidden: true, dev: true,
    title: 'The Arena', source: 'for testing the blade',
    blurb: 'A ring of sand with a few standing stones, and the foes coming in waves round you: ink blots, then makers’ machines. RB / R1 (a left click) swings the fluid blade, LB / L1 (Ctrl) guards, B / ○ (Alt) evades.',
    moves: 'the blade · walk · jetpack',
  },
  {
    // a developer's world: every gadget (src/gadgets/) with something to try it on, a bay each (in the worlds list, L; never on the route)
    id: 'gadgetyard', create: createGadgetYard, build: buildGadgetYard, hidden: true, dev: true,
    title: 'The Gadget Yard', source: 'for trying the gadgets',
    blurb: 'A round yard with a bay for each gadget: rings to hook, towers across a gap, cracked walls to blow open, crates to drag about, a pen of ink blots. Every gadget is yours here: LT / L2 (R) aims the one in hand and RT / R2 (T) uses it, D-pad ↑ (B) changes it.',
    moves: 'the gadgets · walk · climb · jetpack',
  },
  {
    // a developer's world: every minigame (src/minigames/) with its arcade sign round a plaza, to try them one after another (in the worlds list, L; never on the route)
    id: 'arcade', create: createArcade, build: buildArcade, hidden: true, dev: true,
    title: 'The Arcade', source: 'for trying the games',
    blurb: 'A round plaza with an arcade sign for every game, its best on the sign: walk up and press the interact button to play, and Quit brings you back to it. The games board by the way in (Tab, D-pad ↓) jumps straight into any of them; in a game, Next game and Previous game (LB / RB, [ ]) go round them all.',
    moves: 'the games · walk',
  },
  {
    // a developer's world: the reference pages' scenes rebuilt in the game's ink, each framed like its panel (in the worlds list, L; never on the route)
    id: 'references', create: createReferences, build: buildReferences, hidden: true, dev: true,
    title: 'The References', source: 'the pages it is drawn after',
    blurb: 'The scenes of the reference pages rebuilt with the game’s own surfaces and ink, each seen as its panel frames it, the panel beside it to compare. [ and ] change the view.',
    moves: 'walk · jetpack',
  },
  {
    // where the route begins: on the galactic map once enough worlds are done (src/story/ending.js)
    id: 'home', create: createHome, build: buildHome, hidden: true,
    title: TITLES.home, source: 'where the route begins',
    blurb: 'A small round house on a small round hill, and two moons over it. Nobody lives in the round house now; there is a stone in its yard. Across the yard, a smaller house with its lamp lit.',   // (as on the ship's map: src/story/ending.js homeEntry)
    moves: 'walk · the bird, if she promised',
    lock: { text: 'Come home when you are ready: after any six worlds, a message on the ship’s voicemail asks you home, and the ship’s map shows the way.', moves: 'the way home' },
  },
  {
    // the last place: on the galactic map after the first homecoming, once the Signal Market has been heard (src/story/ending.js finaleOpen)
    id: 'lantern', create: createLantern, build: buildLantern, hidden: true,
    title: TITLES.lantern, source: 'where the singing light comes from',
    blurb: 'Past the Signal Market, off every chart: one small island in a still sea of light, and a white tower with a light in its crown that sings.',
    moves: 'walk · climb',
    lock: { text: 'The light’s trace: after the first homecoming, once you have heard the Signal Market’s broadcast, the ship’s map charts where the singing light comes from.', moves: 'the light’s trace' },
  },
];

/** A level by its id; a merged or dismissed world's id finds the world that took its place (names.js worldFor; nothing for one with none). */
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? (id != null && worldFor(id, null) !== id ? LEVELS.find((l) => l.id === worldFor(id, null)) : undefined);
