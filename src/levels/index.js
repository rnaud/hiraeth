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
    id: 'atelier', create: createAtelier, build: buildAtelier, hidden: true,
    title: TITLES.atelier, source: 'the last page',
    blurb: 'A blank page where every world you crossed is sketched in pencil. Someone is still drawing. Pale paper-like growths stir when you look at them.',
    moves: 'off the route: a page for the curious',
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
