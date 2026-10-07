import { TITLES } from './names.js';
import { createDesert, buildDesert } from './desert.js';
import { createIncal, buildIncal } from './incal.js';
import { createArzach, buildArzach } from './arzach.js';
import { createGarage, buildGarage } from './garage.js';
import { createEdena, buildEdena } from './edena.js';
import { createPerdide, buildPerdide } from './perdide.js';
import { createBazaar, buildBazaar } from './bazaar.js';
import { createAtelier, buildAtelier } from './atelier.js';
import { createLab, buildLab } from './lab.js';
import { createArzach2, buildArzach2 } from './arzach2.js';
import { createBuried, buildBuried } from './buried.js';
import { createSpheres, buildSpheres } from './spheres.js';
import { createPerdide2, buildPerdide2 } from './perdide2.js';
import { createHome, buildHome } from './home.js';
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
    id: 'arzach', create: createArzach, build: buildArzach,
    title: TITLES.arzach, source: 'a silent world of needles',
    blurb: 'A silent bone-white world of needle spires, floating ruins and a lone tower. Find the makers’ wings, ride the wind up the tower, and learn the call that brings the great bird down.',
    moves: 'glide · winds · climb · flying mount',
  },
  {
    id: 'arzach2', create: createArzach2, build: buildArzach2,
    title: TITLES.arzach2, source: 'stones that fell up',
    blurb: 'Bone-white needles and balanced stones rise from a sea of cloud. Ride the bird between cliff-top monasteries and broken aqueducts, then cross the peach plain to the lone tower.',
    moves: 'flying mount · climb',
  },
  {
    id: 'garage', create: createGarage, build: buildGarage,
    title: TITLES.garage, source: 'a pocket universe that keeps turning',
    blurb: "Major Brask's pocket universe: portals to an upside-down quarter and a ring where gravity points outward. Machines pass a signal between these strange places.",
    moves: 'portals · shifting gravity · jetpack',
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
    id: 'perdide2', create: createPerdide2, build: buildPerdide2,
    title: TITLES.perdide2, source: 'the wood under the swamp',
    blurb: 'A violet swamp under giant pale mushrooms. Glowing eggs, crystal reeds and moss domes line it. Follow the lit pools under root arches to the cave where the skiff waits.',
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
    id: 'atelier', create: createAtelier, build: buildAtelier, hidden: true,
    title: TITLES.atelier, source: 'the last page',
    blurb: 'A blank page where every world you crossed is sketched in pencil. Someone is still drawing. Pale paper-like growths stir when you look at them.',
    moves: 'off the route: a page for the curious',
  },
  {
    // a detour off the route (names.js SIDE): charted on the galactic map, no story to finish
    id: 'glassdunes', create: createGlassDunes, build: buildGlassDunes, hidden: true,
    title: TITLES.glassdunes, source: 'a desert that turned to glass',
    blurb: 'Dunes of fused green glass, great shapes held inside them, and the glassworkers’ camps at their feet. Walk the sandy paths between the walls while the low sun comes through.',
    moves: 'walk · climb',
  },
  {
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'underwater', create: createUnderwater, build: buildUnderwater, hidden: true,
    title: TITLES.underwater, source: 'a city on the sea floor',
    blurb: 'Salmon towers ringed with amber pods stand on the sea floor, light falling on them in shafts from the surface far above. Walk the lamplit avenue, step into the dry cafés under their domes, and swim up among the towers while a manta glides over.',
    moves: 'walk the sea floor · swim',
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
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'moonfoundry', create: createMoonFoundry, build: buildMoonFoundry, hidden: true,
    title: TITLES.moonfoundry, source: 'a workshop for making moons',
    blurb: 'Unfinished ivory moons hang from the cranes of a vast open hangar or rest in orange claws, and the workers live in the old machinery. Climb to the gantry and walk into the moon broken open round its courtyard; one furnace still pours.',
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
    // off the route (names.js SIDE): on the ship's map from the start, no story to follow
    id: 'spacecity', create: createSpaceCity, build: buildSpaceCity, hidden: true,
    title: TITLES.spacecity, source: 'a city of islands in the dark',
    blurb: 'Rounded houses in cream, salmon and coral heaped on islands that float in the black of space, joined by pale arched bridges, their machinery and cables hanging into the void, a great pale planet over the roofs. Cross the Market Bridge and look out from the Balcony.',
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
];

export const levelById = (id) => LEVELS.find((l) => l.id === id);
