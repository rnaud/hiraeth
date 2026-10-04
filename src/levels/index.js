import { TITLES } from './names.js';
import { createDesert } from './desert.js';
import { createIncal } from './incal.js';
import { createArzach } from './arzach.js';
import { createGarage } from './garage.js';
import { createEdena } from './edena.js';
import { createPerdide } from './perdide.js';
import { createBazaar } from './bazaar.js';
import { createAtelier } from './atelier.js';
import { createLab } from './lab.js';
import { createArzach2 } from './arzach2.js';
import { createBuried } from './buried.js';
import { createSpheres } from './spheres.js';
import { createPerdide2 } from './perdide2.js';
import { createHome } from './home.js';

// Level registry: shown in the picker and the panel, loaded with ?level=<id>.
export const LEVELS = [
  {
    id: 'desert', create: createDesert,
    title: TITLES.desert, source: 'after Sable (Shedworks)',
    blurb: 'Dunes, mesas and giant skeletons across three regions. Find a hoverbike and whistle for it; watch the salt blooms wake as you pass.',
    moves: 'walk · climb · glide · hoverbike',
  },
  {
    id: 'incal', create: createIncal,
    title: TITLES.incal, source: 'a city stacked down a pit',
    blurb: 'A city stacked down a 600 m pit to an acid lake. Jetpack between levels, hail a flying taxi. Quiet terminals recognize returning visitors.',
    moves: 'jetpack · climb · taxis',
  },
  {
    id: 'arzach', create: createArzach,
    title: TITLES.arzach, source: 'a silent world of needles',
    blurb: 'A silent bone-white world of needle spires, floating ruins and a lone tower. Ride the bird past pale fronds that turn and blush as you approach.',
    moves: 'flying mount · climb',
  },
  {
    id: 'arzach2', create: createArzach2,
    title: TITLES.arzach2, source: 'stones that fell up',
    blurb: 'Bone-white needles and balanced stones rise from a sea of cloud. Ride the bird between cliff-top monasteries and broken aqueducts, then cross the peach plain to the lone tower.',
    moves: 'flying mount · climb',
  },
  {
    id: 'garage', create: createGarage,
    title: TITLES.garage, source: 'a pocket universe that keeps turning',
    blurb: "Major Brask's pocket universe: portals to an upside-down quarter and a ring where gravity points outward. Machines pass a signal between these strange places.",
    moves: 'portals · shifting gravity · jetpack',
  },
  {
    id: 'buried', create: createBuried,
    title: TITLES.buried, source: 'a machine under the dunes',
    blurb: 'Domes and pipes surface from pale dunes. Below them lie rust-red machine canyons, giant ring windows, and a city hanging upside down from the sky.',
    moves: 'climb · jetpack',
  },
  {
    id: 'edena', create: createEdena,
    title: TITLES.edena, source: 'a garden that keeps what falls',
    blurb: 'A clean, colourful garden planet: giant umbrella trees, step pyramids and white android ruins to climb. Flowers unfold and answer one another.',
    moves: 'climbing · stamina',
  },
  {
    id: 'spheres', create: createSpheres,
    title: TITLES.spheres, source: 'spheres that answer',
    blurb: 'Umbrella trees shade white pyramids. Great pale spheres sink into a mirror lake, and cypress avenues lead to a round stone plaza.',
    moves: 'walk · climb',
  },
  {
    id: 'perdide', create: createPerdide,
    title: TITLES.perdide, source: 'a twilight swamp that hums',
    blurb: 'A twilight swamp of humming crystal forests, carnivorous plants and glowing eggs. Cross it by skiff; shy fungi close and send glowing spores through the reeds.',
    moves: 'hover-skiff · wading · caves',
  },
  {
    id: 'perdide2', create: createPerdide2,
    title: TITLES.perdide2, source: 'the wood under the swamp',
    blurb: 'A violet swamp under giant pale mushrooms. Glowing eggs, crystal reeds and moss domes line it. Follow the lit pools under root arches to the cave where the skiff waits.',
    moves: 'hover-skiff · wading · caves',
  },
  {
    id: 'bazaar', create: createBazaar,
    title: TITLES.bazaar, source: 'a city of a thousand broadcasts',
    blurb: 'Coral towers, illustrated signs and a busy alien bazaar. Climb the skybridges or hail a cab to the silent broadcast tower. Shop screens wake, recognize you and echo distant encounters.',
    moves: 'market streets · skybridges · jetpack · taxis',
  },
  {
    id: 'atelier', create: createAtelier, hidden: true,
    title: TITLES.atelier, source: 'the last page',
    blurb: 'A blank page where every world you crossed is sketched in pencil. Someone is still drawing. Pale paper-like growths stir when you look at them.',
    moves: 'unlocked by finishing every world',
  },
  {
    // a developer's world: the game's surfaces and giant faces side by side (in the worlds list, L, for testing; never on the route)
    id: 'lab', create: createLab, hidden: true, dev: true,
    title: 'The Lab', source: 'for looking closely',
    blurb: 'Every surface the game draws, on pedestals in a row, and four giant villagers to study faces by.',
    moves: 'walk · jetpack',
  },
  {
    // where the route begins: on the galactic map once enough worlds are done (src/story/ending.js)
    id: 'home', create: createHome, hidden: true,
    title: TITLES.home, source: 'where the route begins',
    blurb: 'A small round house on a small round hill, a lamp in the window, and two moons over it. They are waiting.',
    moves: 'walk · the bird, if she promised',
    lock: { text: 'Come home when you are ready: the ship’s map shows the way once six worlds are done.', moves: 'the way home' },
  },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id);
