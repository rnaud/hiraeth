// The lore page's own words (lore.html, src/lore-page/, docs/systems/lore-page.md): what the game's data cannot say
// by itself, written short from docs/story-bible.md, lore/continuity.md and lore/characters/. Everything else on the
// page (each world's page, its people, its temples, its guardians and how they are calmed or stopped, the items) is
// read from the game's own data at build time (scripts/lore-data.mjs). tests/lore-page.test.js checks that every
// world on the route has its lore here.
//
// A part: { id, title, text: [paragraph] }; `ending: [paragraph]` is kept behind a "Show the ending" fold.

/** The game's lore: the thread through every world. */
export const THREAD = [
  { id: 'light', title: 'The singing light', text: [
    'One night a light crossed the worlds singing one long note, and every people names that night for what it saw: the night the light passed in Qanat, the night the sky rang in the City-Shaft, the night the whales went quiet under the sea. In every world someone saw it: it dipped low, turned “like it was looking for something”, and climbed away. It never fell.',
    'It passed so close to the traveller’s ship that it drank its power, and the ship came down on its reserve in the desert near Qanat: a forced landing, not a crash. Where it brushed the hull it left a scorched glyph, three dots over an arc that bows upward. The traveller chose to follow it.',
    'The scar is magnetised and beats slowly in threes. The ship charts only the worlds whose field carries the same signature: the worlds the light passed through. That is the route.',
  ], ending: [
    'The light was an answer. The makers’ lantern sends a light to bring in anyone a long way from home. When the father’s broadcast reached Ilen there, thirty years late, she sang his own message into one, put the makers’ sign on it, and sent it home. It sang over the round house, then went looking for the voice that had called her, and found the reel playing in his son’s cockpit. The glyph it scorched into the hull means *we heard you*.',
  ] },
  { id: 'father', title: 'The father and the reel', text: [
    'The traveller left home at seventeen after one fight too many, with his father’s words at the port: make us proud, bring back *something of value*. He means something impressive: power, rare matter, a prize. Every world offers one, and every world also offers something quieter. The keepsakes record both.',
    'He flies his father’s old ship and carries the reel: the house recorder’s spool, every message his parents ever left him. After each world he asks it for a word that belongs to where he has been, and it plays one. The recordings fit loosely, sometimes oddly. They never answer him, and they are older than they seem.',
  ], ending: [
    'His mother and father died two years ago, within a season of each other; he knows it from the start, and the player learns it last. The journey is a son trying to make them proud after the fact. At home, the round house is dark; across the yard, in the small house he and his father started, his daughter Lou lives with Aunt Tove and Moustache the dog. He sets his keepsakes on his parents’ stone, one by one.',
  ] },
  { id: 'makers', title: 'The makers (the Givers)', text: [
    'Nobody has seen a maker. They made the giants walk: the giants carried the makers’ water across the worlds and lay down where they could go no farther, and cities grew on their bones. They signed everything they made with the glyph, and every world has its own name for them and their sign; in the desert they are the Givers.',
    'They left gifts behind for travellers who would come a long way after them: the backpack and its jade fluid, its wings, its lenses, little charms. Each waits in a chest of pale ceramic with a four-point star on its lid, a traveller’s sign, “a small light, a long way from home”. They open only for someone who has come a long way: the traveller is the first in living memory.',
    'In every world the makers built one great house, a temple of rooms and puzzles in that world’s architecture. Half-way in waits a gadget that is the key to the rest; at the end, a guardian they left to keep the house, frightened or broken since the light went over. A guardian that lives is calmed; a machine is stopped. Either way the world outside changes.',
  ] },
  { id: 'fragments', title: 'The fragments of the singing light', text: [
    'The light sang so hard on its way, world to world, that it shed bits of itself wherever it passed: eight small pale splinters in each world on the route, 96 in all. Each glows and still sings faintly, three soft notes in the light’s beat of threes.',
    'Nobody sent the light anywhere, so nothing it shed lies on the way anyone sends you: they settled where its song rang longest, on ledges and high places, in nooks behind things, at the ends of side paths.',
    'Anselm Thrum, a thin man in a patched pale coat with a brass box that ticks near a splinter, has followed the song since the night it went over. The first fragment you take brings him at a run; he lives in the hold among the crates, keeps what you bring in a jar, and works them into your gear for a price in fragments. He never learns what the light was.',
  ], ending: [
    'At the Lantern Ilen knows the splinters for her own song. Bring none and “nobody stops for them”; bring them all and “then it’s whole again”.',
  ] },
  { id: 'lantern', title: 'The Lantern', text: [
    'Past the Signal Market, on no chart, there is a last place. It is charted only once the market’s silent tower has spoken, and only after the traveller has been home once.',
  ], ending: [
    'One small island in a still sea of light at dusk, the makers’ lantern on its crown, yellow flowers, a bench facing home and two stones on the point: Odile and Talo, who got there first, kept the lantern and kept Ilen, and are buried there.',
    'The light sings to three of the keepers’ lamps round the shore, one at a time; he whistles back by each with his own breath, no tool, no fight, and the lamp lights. With the third, Ilen, his elder sister, gone before he was born, comes out of the round house to see who answered: “Thirty years it’s sung, and nobody ever answered.” She learns their parents are dead, tells him what the light was, and comes home with him.',
  ] },
];

/** The main character. */
export const TRAVELLER = {
  id: 'traveller', title: 'The traveller',
  text: [
    'About twenty-six, unnamed; lean, long-limbed, with a mop of dark, uneven hair and a warm, expressive face. He looks as though he packed in ten minutes and has been putting off unpacking for several years. His clothes have travelled further than his confidence.',
    'He is good at helping strangers because their problems seem finishable. He collects proof of usefulness because usefulness feels safer than asking to be loved, but his curiosity is real. He speaks in short questions, plain thanks and the occasional dry reply.',
    'Nobody out there speaks his language. He wears a small translator at the ear, a thing from home: he hears each world’s own tongue, and reads it in his own words a moment later.',
  ],
  gear: [
    ['The look', 'An open, oversized, faded coral overshirt over an ivory undershirt, sleeves rolled; loose cream trousers rolled above bare ankles; low sand suede boots; a little tan neckerchief; a small round khaki satchel on a diagonal strap.'],
    ['The backpack', 'The makers’ backpack, found in Qanat under the great tree: a slim tank of living jade fluid that pushes, lifts and fills, the same water the giants carried. It starts two-tone; every world with a source adds a colour band, so by the end the tank is a record of the journey.'],
    ['The ship', 'His father’s old ship: the flight cap on the dash, the drawings under the bunk, three stools in the galley, the reel on the console, and the scorched glyph on its hull.'],
  ],
};

/** Each world on the route (src/levels/names.js ORDER): its lore, short. */
export const WORLD_LORE = {
  desert: [
    'Once a year Qanat’s burning tree “drinks”: water rises from beneath the giants and the fire burns cool and many-coloured, and pilgrims cross the dunes in procession to see it. This year the water has not risen.',
    'The giants carried the water from the swamp of lights and lay down where they could go no farther; the water pooled in their hearts. The tree grows from this giant’s heart, and Qanat was built round it. Nour, the eldest, has kept the Givers’ chest company for sixty years: it opens only for “one who fell from the sky”.',
  ],
  arzach: [
    'A silent plain of needle spires and a lone tower. The great bird has not come down since her rider left the tower long ago; she answers only the rider’s call, and nobody speaks much. The world is silent by choice.',
    'South, over a sea of cloud, hang the sky stones, where the monastery bell has not rung since the cloud rose thirty years ago. The monks believe its ringing kept the world down, and that when it stopped everything loose fell up.',
  ],
  perdide: [
    'A twilight swamp of humming crystal forests and carnivorous plants. The Great Crystal sings in the rain and the plants fall silent; the swamp people say it is a piece of something that fell, long before the night the light passed.',
    'North of the swamp, in the Deep Wood of half-transparent mushrooms, people keep the pools lit for travellers who never come. Hollin has kept a light for Odile and Talo for forty years.',
  ],
  edena: [
    'A clean, colourful garden planet of umbrella trees, step pyramids and white android ruins. Odile and Talo’s ship fell here forty years ago, and the gardeners let the garden take it: nothing that falls should be dug up again.',
    'The white builders found older spheres and pyramids and copied them, and the mark. “We tend the garden. The garden tends us.”',
  ],
  underwater: [
    'A city of glass domes on the sea floor, its halls joined by sealed tubes. Outside the glass the whales used to come close and sing. The night the whales went quiet, a light came down through the sea singing one note; the whales sang it back, all at once, and went away.',
    'Since then the glass hums that one note all over the city, and something in the makers’ Whale-House has been singing the light’s note back at the whales.',
  ],
  incal: [
    'A city stacked down a 600 m pit to an acid lake. The Lodestar turns above the palace: the upper city calls it a tourist story, the lower levels pray to it. A sweeper on the high terraces says it has faded a little every year since she was a girl, because nobody looks up.',
    'Cabs drive themselves and stop only for a pass; Wren, the old cab, still stops for the poor. “Look up once a day.”',
  ],
  glassdunes: [
    'Glassworkers camp in a sand valley walled by waves of green glass that broke and never fell. East of the valley stands the Clock-House, a round house of the makers with a clock over its door; its works set the pace for the camps’ clocks.',
    'Every clock in the dunes stopped the night the singing light passed, each at its own minute, and something underneath has been winding tighter ever since.',
  ],
  buried: [
    'Below the dunes a great wheel turned one tooth a year, and the dome people time their lives by it. The hanging city above is “its other half”; the old story says the city settles onto the wheel when the last tooth turns.',
    'Lit again, the wheel turns and does not stop. Wen’s reading, the morning after: a wheel has no last tooth; the last tooth is whichever one keeps it turning.',
  ],
  moonfoundry: [
    'Under a vast roof on rust pillars the founders cast small moons for somebody’s sky, and nobody came for them. They hang from the cranes and lie in orange claws, and the foundry’s folk live in the old machinery.',
    'The night the singing went over, every hung moon turned on its hook toward where the light went, and since then the makers’ Casting-House pours again by itself at night. Its ledger’s first page: the first moons were sent to a garden far off, and fell short.',
  ],
  spheres: [
    'Umbrella trees shade white pyramids, and great pale spheres sink into a mirror lake. They came down long ago, the first moons, sent and fallen short; each one “remembers” one sound, and the round plaza’s pole hums when the great sphere is on the horizon.',
  ],
  spacecity: [
    'Heaped houses on islands floating in the dark, joined by bridges, a great pale planet over the roofs. The islands are moored to each other by the moorers’ cables, held by the great capstan in the makers’ Mooring-House.',
    'The night the cables sang, the light’s note ran down every cable; since then the islands drift apart a hand’s width a night. The cables were never for holding the islands up: they listen.',
  ],
  bazaar: [
    'A thousand signs speak; one broadcast tower is silent. The market believes the silent tower was the only one that told the truth.',
    'Restarted, the broadcast is the father’s voice: a message from home, thirty years old, calling for someone named Ilen.',
  ],
};

/** The second verbs a guardian asks for before its gadget takes (v1.63, #257; docs/systems/foes.md "A second verb"). */
export const VERBS = { parry: 'the guard', dodge: 'a perfect dodge (the flurry)', push: 'the push', shot: 'a splash (the fluid shot)' };
