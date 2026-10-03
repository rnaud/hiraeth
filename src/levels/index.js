import { createDesert } from './desert.js';
import { createIncal } from './incal.js';
import { createArzach } from './arzach.js';
import { createGarage } from './garage.js';
import { createEdena } from './edena.js';
import { createPerdide } from './perdide.js';
import { createBazaar } from './bazaar.js';
import { createAtelier } from './atelier.js';

// Level registry: shown in the picker and the panel, loaded with ?level=<id>.
export const LEVELS = [
  {
    id: 'desert', create: createDesert,
    title: 'The Desert', source: 'after Sable (Shedworks)',
    blurb: 'Dunes, mesas and giant skeletons across three regions. Whistle for the hoverbike; watch the salt blooms wake as you pass.',
    moves: 'walk · climb · glide · hoverbike',
  },
  {
    id: 'incal', create: createIncal,
    title: 'The City-Shaft', source: "L'Incal (Jodorowsky & Moebius, 1980)",
    blurb: 'A city stacked down a 600 m pit to an acid lake. Jetpack between levels, hail a flying taxi. Quiet terminals recognize returning visitors.',
    moves: 'jetpack · climb · taxis',
  },
  {
    id: 'arzach', create: createArzach,
    title: 'Arzach', source: 'Arzach (Moebius, 1975)',
    blurb: 'A silent bone-white world of needle spires, floating ruins and a lone tower. Ride the bird past pale fronds that turn and blush as you approach.',
    moves: 'flying mount · climb',
  },
  {
    id: 'garage', create: createGarage,
    title: 'The Airtight Garage', source: 'Le Garage hermétique (Moebius, 1976–79)',
    blurb: "Major Grubert's pocket universe: portals to an upside-down quarter and a ring where gravity points outward. Machines pass a signal between these strange places.",
    moves: 'portals · shifting gravity · jetpack',
  },
  {
    id: 'edena', create: createEdena,
    title: 'Edena', source: "Le Monde d'Edena (Moebius, 1983–2001)",
    blurb: 'A clean, colourful garden planet: giant umbrella trees, step pyramids and white android ruins to climb. Flowers unfold and answer one another.',
    moves: 'climbing · stamina',
  },
  {
    id: 'perdide', create: createPerdide,
    title: 'Perdide', source: 'Les Maîtres du temps (Laloux & Moebius, 1982)',
    blurb: 'A twilight swamp of humming crystal forests, carnivorous plants and glowing eggs. Cross it by skiff; shy fungi close and send glowing spores through the reeds.',
    moves: 'hover-skiff · wading · caves',
  },
  {
    id: 'bazaar', create: createBazaar,
    title: 'The Signal Market', source: 'a city of a thousand broadcasts',
    blurb: 'Coral towers, illustrated signs and a busy alien bazaar. Climb the skybridges or hail a cab to the silent broadcast tower. Shop screens wake, recognize you and echo distant encounters.',
    moves: 'market streets · skybridges · jetpack · taxis',
  },
  {
    id: 'atelier', create: createAtelier, hidden: true,
    title: 'The Atelier', source: 'the last page',
    blurb: 'A blank page where every world you crossed is sketched in pencil. Someone is still drawing. Pale paper-like growths stir when you look at them.',
    moves: 'unlocked by finishing every world',
  },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id);
