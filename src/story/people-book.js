// The People page of the game menu (src/game-menu.js peoplePanel, src/game-menu-data.js peopleData):
// who the named people of the route are, as far as the traveller knows them. Spoiler-safe by
// construction: a person is only listed once you have talked to them (`met.<id>`, set by the
// conversation panel, src/story/dialogue.js), and each part of their story only once what it says has
// been heard (a flag their conversation sets, a quest stage, a once-only answer). Nothing here is new
// lore: every line retells what they say in their own conversation (src/story/<world>-data.js and the
// people in src/levels/*), shortened. English only for now (the story is not localised yet: TODO fr).
//
//   BOOK            { world: [{ id, name, role, story: [part], now: [part] }] } in the route's order
//                   (a part: 'text' known once met, or [cond, 'text']); `now`: the first that holds says
//                   where they are and how they are doing
//   test(cond, flags)   a condition over the save's flags (the dialogue's own shapes: { flag, is },
//                   { quest, done | failed | started | stage | past }, { all }, { any }, { not })
//   personStory(p, flags) → [text]   the parts heard ·  personNow(p, flags) → text
//   ERRAND_PEOPLE   each errand's giver and receiver (ERRANDS in src/levels/content.js names them by index)
//   CHOICES         the choices a person remembers (Dov's token, Hollin's promise, Esk's hill…)

import { QUESTS as desertQ } from './desert-data.js';
import { QUESTS as arzachQ } from './arzach-data.js';
import { QUESTS as arzach2Q } from './arzach2-data.js';
import { QUESTS as perdideQ } from './perdide-data.js';
import { QUESTS as perdide2Q } from './perdide2-data.js';
import { QUESTS as edenaQ } from './edena-data.js';
import { QUESTS as incalQ } from './incal-data.js';
import { QUESTS as garageQ } from './garage-data.js';
import { QUESTS as buriedQ } from './buried-data.js';
import { QUESTS as spheresQ } from './spheres-data.js';
import { QUESTS as bazaarQ } from './bazaar-data.js';
import { QUESTS as lanternQ } from './lantern-data.js';
import { ORDER } from '../levels/names.js';

/** Every quest of the route (and the Lantern's), with its stages. */
const QUEST_DEFS = [desertQ, arzachQ, arzach2Q, perdideQ, perdide2Q, edenaQ, incalQ, garageQ, buriedQ, spheresQ, bazaarQ, lanternQ].flat();
export const QUEST_BY_ID = new Map(QUEST_DEFS.map((q) => [q.id, q]));

// ---- conditions (the save's flags only: a quest's stage is its flag quest.<id>, src/story/quests.js)
const f = (flag, is) => (is === undefined ? { flag } : { flag, is });
const not = (c) => ({ not: c });
const all = (...c) => ({ all: c });
const any = (...c) => ({ any: c });
const done = (quest) => ({ quest, done: true });
const failed = (quest) => ({ quest, failed: true });
const started = (quest) => ({ quest, started: true });
/** The quest has reached this stage (or gone past it, or ended). */
const past = (quest, stage) => ({ quest, past: stage });

const stagesOf = new Map(QUEST_DEFS.map((q) => [q.id, (q.stages ?? []).map((s) => s.id)]));

/** Does `cond` hold for these flags ({ name: value })? */
export function test(cond, flags = {}) {
  if (cond == null) return true;
  if (Array.isArray(cond)) return cond.every((c) => test(c, flags));
  if (cond.all) return cond.all.every((c) => test(c, flags));
  if (cond.any) return cond.any.some((c) => test(c, flags));
  if (cond.not) return !test(cond.not, flags);
  if (cond.flag) return 'is' in cond ? flags[cond.flag] === cond.is : !!flags[cond.flag];
  if (cond.quest) {
    const s = flags[`quest.${cond.quest}`];
    if ('done' in cond) return (s === 'done') === !!cond.done;
    if ('failed' in cond) return (s === 'failed') === !!cond.failed;
    if ('started' in cond) return (s != null) === !!cond.started;
    if ('stage' in cond) return Array.isArray(cond.stage) ? cond.stage.includes(s) : s === cond.stage;
    if ('past' in cond) {
      if (s == null) return false;
      if (s === 'done' || s === 'failed') return true;
      const list = stagesOf.get(cond.quest) ?? [];
      return list.indexOf(s) >= list.indexOf(cond.past) && list.indexOf(cond.past) >= 0;
    }
    return s != null && s !== 'done' && s !== 'failed';
  }
  return true;
}

const P = (id, name, role, story, now) => ({ id, name, role, story, now });

export const BOOK = {
  desert: [
    P('marrow', 'Marrow', 'A salvager who sells rumours by the camps', [
      'A salvager, and by his own account a liar. He was going over your crashed ship when you met, and saw the mark burned into its hull: three dots over an arc.',
      [f('desert.bike.found'), 'He gave you the hoverbike he had hidden under a tarp. It would not run for him; it needed a full tank.'],
      [f('desert.marrow.hull'), 'Since your crash he checks every wreck for the mark. Most ships that come down just come down. Yours did not.'],
    ], [
      [f('desert.marrow.bike'), 'At the pilgrims’ camps, claiming the bike’s success from a safe distance.'],
      'At the pilgrims’ camps near your crash site.',
    ]),
    P('ama', 'Ama', 'Keeps the pilgrims’ fires burning', [
      'Ama keeps the pilgrims fed and the fires burning while they walk round Qanat. At her fire, water comes before questions.',
      [f('desert.jar.given'), 'She gave you the drinking jar, empty, for the Drinking: the one jar the whole procession shares.'],
      [done('desert.power'), 'The tree burns again. She says the pilgrims will sing about you all the way home.'],
    ], [
      [done('desert.power'), 'At her fire by the camps; the Drinking can go on.'],
      'At her fire by the pilgrims’ camps, outside Qanat.',
    ]),
    P('nour', 'Nour', 'The eldest of Qanat, keeper of the Givers’ chest', [
      'The eldest of Qanat. She sat sixty years by the Givers’ chest on the great tree, as her mother did, waiting for “one who fell from the sky”.',
      [f('item.backpack'), 'The chest opened for you. She calls its makers the Givers: they made the giants walk and signed their work with three dots over an arc.'],
      [f('desert.spark.heard'), 'Her grandmother spoke of a spark-stone that first lit the tree, kept in the Givers’ Hearth in the red rocks.'],
      [f('desert.nour.ilen'), 'You told her your parents heard a singing light once. She thinks it sang over your house long before it sang over hers.'],
    ], [
      [f('desert.tree.lit'), 'Under the great tree in Qanat, which burns again.'],
      'Under the great tree in Qanat, beside the chest.',
    ]),
    P('hessa', 'Hessa', 'Keeper of Qanat’s well', [
      'Nour’s granddaughter keeps the well at the tree’s roots. Usually the water rises through the roots and feeds the tree’s fire; this year she was keeping dust.',
      [f('desert.channel.open'), 'The water came back through the roots, every colour.'],
    ], [
      [f('desert.tree.lit'), 'At the well; the tree burns, and she has put down her broom.'],
      'At the well beneath the great tree.',
    ]),
    P('speaker', 'The Speaker', 'Leads the procession round Qanat', [
      'He leads the pilgrims’ procession round the walls and keeps the old accounts. They circle the city until the tree drinks.',
      [f('desert.speaker.heard'), 'His old songs say giants carried water from the swamp of lights and lay down where they could go no farther. Qanat stands on one; the tree grows from its heart.'],
      [done('desert.power'), 'He needs a new verse for your part.'],
    ], [
      'At the head of the procession round Qanat’s walls.',
    ]),
    P('oum', 'Oum', 'A pilgrim who fell behind', [
      'An old pilgrim who fell behind the procession, then behind the stragglers.',
      [f('desert.rumour.light'), 'The night before your crash she watched a light cross the dunes singing one long note. It turned over Qanat, the tree went dark, and it climbed away.'],
      [f('desert.oum.thanked'), 'You walked her back to the fire. She gave you a cord with a knot for every circuit she walked, and asked you to find out why the light turned.'],
    ], [
      [f('desert.oum.home'), 'By Ama’s fire, with warm feet.'],
      'Out in the western dunes.',
    ]),
    P('teo', 'Teo', 'A drummer without a drum', [
      'The procession’s drummer. The wind rolled his drum off a camel on their last night crossing, south under the old ribcage.',
      [f('desert.teo.drumming'), 'You brought the drum back. He played you the walking rhythm a whole procession keeps step to.'],
    ], [
      [f('desert.teo.drumming'), 'By the big fire, drumming; the camp keeps time.'],
      'On the bench by the big fire at the camps.',
    ]),
    P('ilo', 'Ilo', 'A child of the camps, too curious', [
      'A pilgrim child with more questions than anyone. Ilo knew a secret way inside the giant, through its mouth beyond the back gate.',
      [past('desert.ilo', 'below'), 'Ilo came with you to the giant’s mouth and waited there while you went down.'],
      [f('desert.ilo.told', 'monster'), 'You told Ilo a monster lives down there. Nobody believes it yet.'],
      [f('desert.ilo.told', 'secret'), 'You kept what is down there a secret, until Ilo is older.'],
      [f('desert.ilo.told', 'true'), 'You told Ilo the truth: the giant carries the well inside it.'],
    ], [
      'Round the pilgrims’ camps.',
    ]),
    P('pell', 'Pell', 'Counts the giants’ bones', [
      'Pell counted the great ribcage south of the camps: forty ribs. The giant under Qanat is harder to count.',
      [done('desert.mask'), 'You cleaned the sleeping mask’s eyes in the south. Pell has only ever counted its teeth.'],
    ], [
      'Near your crash site in the desert.',
    ]),
    P('ysa', 'Rima', 'A dune walker', [
      'Rima walks the dunes; the wind erases the tracks every night. The old people say Qanat stayed above the sand because its tree’s roots hold it together.',
    ], [
      [f('desert.tree.lit'), 'Out in the dunes; she walks home by the burning tree again.'],
      'Out in the dunes near your crash site.',
    ]),
    P('rook', 'Rook', 'Looking for his bike', [
      'Rook is looking for his bike, which leaves without consulting him.',
    ], ['Wandering the desert near the camps.']),
    P('ennor', 'Ennor', 'A guide to the salt flats', [
      'A guide to the salt flats in the west. Everything here, he says, is measured from the tree.',
    ], ['In the desert near your crash site.']),
    P('tamsin', 'Dalia', 'Listens to the stones', [
      'The stones hum before a storm. The night before your crash they hummed under a clear sky: a light passed, singing their note.',
    ], ['In the desert near your crash site.']),
    P('traveller', 'Naji', 'Sketches the observatory', [
      'Naji has drawn the observatory east of camp a hundred times, always asleep, and would like one picture of it working.',
    ], ['East of the camps, by the sleeping observatory.']),
    P('sefa', 'Sefa', 'An oud player of the procession', [
      'Sefa plays for whoever stops. When the tree drinks, the musicians play all night.',
    ], ['With the musicians at the camps.']),
    P('bako', 'Bako', 'A ney player of the procession', [
      'He plays a ney cut from an oasis reed. He saw the burn on your ship: three dots over a curve, like the mark between the giant’s eyes.',
    ], ['With the musicians at the camps.']),
    P('haddu', 'Haddu', 'Weighs chimes and sells cures by the main gate', [
      'Haddu has kept his shop between the camps and Qanat’s main gate for forty Drinkings. He weighs every chime on his little scale and sells what the walk takes out of people: healing potions, a few hearts’ worth of courage, more room in your tank.',
      [f('desert.haddu.hearts'), 'His heart containers come up the salt road from past the flats. He only ever gets a couple, and each one costs more than the last.'],
    ], ['In his shop by Qanat’s main gate, behind the counter.']),
  ],
  arzach: [
    P('oia', 'Oïa', 'Watches the lone tower in Vael', [
      'Vael is quiet by choice, and Oïa says things with her hands. She watches the lone tower across the plain, where a great bird still waits.',
      [f('arzach.glyph.drawn'), 'The bird’s rider left, nobody knows where. In the sand she drew the bird’s track: three dots over an arc, the mark on your ship.'],
      [done('arzach.bird'), 'The bird comes to your whistle now. Oïa drew her in the sand with a small rider, and added your hood.'],
    ], ['On her stone seat facing the lone tower.']),
    P('senn', 'Senn', 'Listens to the stones', [
      'Senn listens to the standing stones with her ear against them. They have hummed since the light passed.',
      [f('arzach.rumour.light'), 'The light sang, the stones answered and the bird cried; it shook all night and lost feathers.'],
      [done('arzach.feathers'), 'You brought the bird’s three feathers back. Senn wears some in her hair.'],
    ], ['By the standing stones on Vael’s plain.']),
    P('hollin', 'Kesh', 'Keeps the stone hand', [
      'An old man who keeps the enormous stone hand of the giant sleeping in the sand. Once, he says, it rang; once, it moved.',
      [f('arzach.hand.rung'), 'You rang its knuckles, smallest to tallest, and the hand gave. He had waited to hear it.'],
    ], ['Beside the stone hand on Vael’s plain.']),
    P('tam', 'Tam', 'A boy who copies you', [
      'A boy who copies whatever you do and says nothing at all. He mimes directions: the stone hand, the needle spire, the white house with the stone wings.',
    ], ['Out on Vael’s plain.']),
  ],
  arzach2: [
    P('aube', 'Sister Aube', 'Hermit of the edge, watches the cloud', [
      'She keeps a hermitage on the edge and marks the cloud every spring on the same stalk. It has crept higher since she was young.',
      [f('arzach2.aube.heard'), 'The monks say their bell held the world down: when it stopped, loose things fell up and the cloud followed.'],
      [f('arzach2.bell.rung'), 'The bell rang and the cloud dropped a hand’s width; she can see the table stalks again.'],
    ], ['At her hermitage on the edge of the sky stones.']),
    P('calix', 'Brother Calix', 'Keeper of the silent bell', [
      'For thirty years he has oiled the yoke of a bell that does not ring, every morning, so it is ready when its day comes.',
      [f('arzach2.calix.asked'), 'The bell lost its clapper when the cloud rose; it fell up onto the floating island, with tiles and a goat.'],
      [f('arzach2.rumour.light'), 'His order calls the mark on the bell the Three Notes. The night the singing light passed, the bell hummed without its clapper.'],
      [f('arzach2.bell.note'), 'You brought the clapper back and rang it. The bell’s note stayed in your tank.'],
    ], [
      [done('arzach2.bell'), 'At the white monastery on the rose cliff. He rings the bell at dawn and dusk.'],
      'At the white monastery on the rose cliff.',
    ]),
    P('ysolde', 'Mother Ysolde', 'Writes letters to her sister', [
      'She writes to her sister every winter: thirty letters, none sent. Ondine left, she stayed, and since the cloud rose only the aqueduct lies between them.',
      [started('arzach2.letter'), 'She gave you the shortest letter to carry to Ondine on the plain.'],
      [f('arzach2.lamp.answered'), 'Ondine’s tower lamp lit up, and Ysolde answered the old way, three long flashes and one short.'],
      [done('arzach2.letter'), 'She has started another letter: “Come for supper.”'],
    ], ['At the monastery, watching the tower from its wall.']),
    P('ondine', 'Ondine', 'Studies the lone tower’s age', [
      'Ysolde’s sister has walked to the tower every day for thirty years to study how old it is. The face carved in its base was there long before the monastery, the same mark on its brow.',
      [past('arzach2.letter', 'lamp'), 'She read her sister’s letter twice, then sat down and laughed. She will come home when the bell rings.'],
      [all(started('arzach2.letter'), f('arzach2.bell.rung')), 'She heard the bell: that means supper.'],
    ], ['Out on the peach plain, by the lone tower.']),
    P('tiv', 'Tiv', 'A novice who balances stones', [
      'A novice whose cairn fell up the night the light went over: the bell hummed and three stones landed on the little sky stones.',
      [done('arzach2.cairn'), 'You brought the stones back and the cairn stands, widest first. It hums.'],
    ], ['By the stone table at the monastery.']),
  ],
  perdide: [
    P('wendel', 'Wendel', 'Egg-warden at Lorn’s landing', [
      'Wendel keeps the glowing eggs warm and the jaw-plants hungry. He says the patient are never eaten.',
      [f('perdide.glyph.heard'), 'Lorn calls the mark the Hush: three raindrops over a closed mouth, put on what the plants should leave alone.'],
      [done('perdide.fireflies'), 'He watched the eggs for thirty years without seeing one hatch. They hatch into fireflies.'],
      [past('perdide.patience', 'tell'), 'You stood still among the jaw-plants until they opened. He gave you his saying.'],
    ], ['At the landing, by the glowing eggs.']),
    P('saba', 'Saba', 'The Listener at the Great Crystal', [
      'Saba has sat at the foot of the Great Crystal for forty years and written down two hundred and twelve of its phrases. Rain makes it sing.',
      [f('perdide.clue.ship'), 'It sang a new phrase, the one you heard before your ship was struck. She thinks the crystal is a piece of the thing that struck you, fallen long ago.'],
      [f('said.saba.after.1'), 'Her first spring there, Odile and Talo came by skiff asking where the singing light had gone. They went east; the skiff came back alone.'],
    ], ['At the foot of the Great Crystal, east through the ford.']),
    P('corm', 'Corm', 'Feeds the jaw-plants', [
      'Corm feeds the jaw-plants (Margit, Big Ollo and a small one with no name yet), and argues with Wendel about it.',
      [past('perdide.patience', 'tell'), 'The plants opened peacefully for you. He is still feeding them.'],
    ], ['By the jaw-bed on the north shore.']),
    P('sedge', 'Sedge', 'Cuts reeds', [
      'Sedge cuts reeds, and the reeds cut back.',
      [f('perdide.rumour.light'), 'Cutting late, Sedge saw the light pass low over the reeds singing one high note. The Great Crystal answered without any rain.'],
    ], ['In the reeds near the landing.']),
    P('ysse', 'Ysse', 'Keeper of the crystal cave', [
      'Ysse cleans the crystals in the cave on the western island; dust muffles their sound. Her mother said the empty ring at its heart was waiting for something.',
      [f('clue.perdide.perdide2'), 'She told you of the deep wood, where lamp-keepers keep pools lit for two travellers whose sky-boat fell there.'],
      [done('perdide.crystal'), 'You raised the splinter in the ring and the whole cave hummed.'],
    ], ['In the crystal cave on the western island.']),
    P('ivo.perdide', 'Ivo', 'Watches the fireflies', [
      'Ivo watches the fireflies cross the water every dusk and wants to know where they go. Ysse brings Ivo over in her boat.',
      [done('perdide.fireflies'), 'You followed them: they hatch from Wendel’s glowing eggs. Ivo gave you a jar of fireflies.'],
    ], ['On the cave island, watching the water.']),
  ],
  perdide2: [
    P('hollin.perdide2', 'Hollin', 'Keeper of the lamps in the deep wood', [
      'For forty years Hollin has kept pools lit along the path, the Welcome, for two travellers who survived a sky-boat crash and asked for a light to be kept. You were his first visitor.',
      [f('perdide2.glyph.heard'), 'The deep wood calls the mark the Welcome: three lamps above a hull, painted by the pools.'],
      [f('perdide2.hollin.told'), 'In the boat were two worn seats, Odile and Talo’s names and a drawing of their garden with white pyramids. He never knew what they were trying to get back to.'],
      [f('perdide2.hollin.ilen'), 'You told him about your sister. He thinks someone at home kept a light for her.'],
      [f('perdide2.hollin.found'), 'You told him where Odile and Talo went. They got there, and kept a light at the end of it.'],
    ], [
      [f('perdide2.promise.kept'), 'In the deep wood. You came back, by a path you already knew.'],
      [f('perdide2.promise', 'yes'), 'In the deep wood, keeping the pool by the landing for you.'],
      [done('perdide2.lamps'), 'In the deep wood. The pools stay lit.'],
      'On the island at the start of the lamp path.',
    ]),
    P('wick', 'Robin', 'A young lamp-keeper', [
      'A young lamp-keeper who poured bucket after bucket into a pool that would not light.',
      [f('perdide2.rumour.light'), 'Robin saw the singing light come over the wood, low enough to light the leaves from underneath. Three pools went out as it passed.'],
      [done('perdide2.lamps'), 'Every pool is lit again.'],
    ], ['By the second pool, past the glass dome.']),
    P('pim.perdide2', 'Pim', 'Lives in a moss dome', [
      'Pim lives in a mossy dome whose door closes, then immediately reconsiders. The latch was left on top of the glass dome.',
      [done('perdide2.latch'), 'You fetched the latch and relit the moss lamp; the door shuts at last.'],
    ], ['At the moss dome on the lamp path.']),
    P('bram', 'Bram', 'Minds the root cave’s mouth', [
      'Bram watches the entrance to the root cave at the end of the path; sitting is an important part of the method. The two travellers slept in the cave before they left.',
    ], ['At the mouth of the root cave.']),
    P('fen', 'Fen', 'Lives in the far dome', [
      'The skiff is Fen’s. He lent it to Odile and Talo after their saucer crashed; they waited a season for the singing light, then crossed the swamp, and the skiff came back without them.',
      [f('clue.perdide2.edena'), 'Odile drew a garden with white pyramids inside the saucer, so as not to forget it.'],
      [f('perdide2.skiff.home'), 'You brought the skiff home under his old lamp. He will keep it lit this time.'],
    ], ['In the far dome, on the deep water.']),
  ],
  edena: [
    P('mira', 'Mira', 'Keeps Viridel’s water clock', [
      'Mira tends the water clock and the garden: the gardeners keep it alive, and it feeds them.',
      [f('edena.mira.heard'), 'When she was young, Odile and Talo’s ship crashed in the south meadow. They stayed a spring, then left in the small saucer carried inside it; the garden covered the wreck.'],
      [f('clue.edena.struck'), 'Talo called the light that struck their ship the Singer. They left to find out why it struck them, toward the deep wood beyond the swamp of lights.'],
      [done('edena.garden'), 'She gave you her words: we tend the garden; the garden tends us.'],
      [f('edena.mira.clock'), 'Her water clock rings on its own again, with the gear from Lorn’s domes.'],
    ], ['By the water clock near the landing.']),
    P('sol', 'Sol', 'Remembers Odile and Talo', [
      'As a boy Sol followed Odile and Talo everywhere. They said they would come back for tea, and he keeps quite a lot of tea.',
      [f('edena.rumour.light'), 'The night the light passed, every flower turned to follow it in the dark. Talo called it the Singer, never fondly.'],
      [done('edena.garden'), 'He knows now why they went, and still hopes they will come back.'],
    ], ['In Viridel’s garden, near the landing.']),
    P('vey', 'Vey', 'Tends the vines over the wreck', [
      'Vey has tended the vines over Odile and Talo’s ship for forty years. Viridel leaves fallen things to the garden.',
      [f('edena.veil.open'), 'The vines moved aside for you without cutting or tearing. In forty years Vey had never seen that.'],
    ], ['By the overgrown wreck in the south meadow.']),
    P('oro', 'Oro', 'Grows pyramids from seeds', [
      'Oro says the pyramids grow from seeds; the androids who built the white ruins only copied them. Oro’s first is knee-high.',
      [done('edena.seed'), 'You found the lost seed and watered it: a century’s growth in one splash.'],
    ], ['Among the pyramids of Viridel.']),
    P('lio.edena', 'Rue', 'Climbs every tree but the tallest', [
      'Rue has climbed every tree in Viridel except the tallest, whose crown Talo used to sit on.',
      [f('edena.lookout.read'), 'You reached the crown for Rue, and told what was up there.'],
    ], ['At the foot of the tallest tree, north-west.']),
    P('esk', 'Esk', 'Keeps the tea terraces', [
      'Esk’s family planted the tea terraces on steps the builders made; the top row goes back to her grandmother’s grandmother. Since the Singer passed, the spring barely runs.',
      [failed('edena.terraces'), 'She asked you to open the builders’ old gate a little. You turned it once, as she asked; it gave way, and the middle of her hill went down into the hollow with the water.'],
      [done('edena.cutting'), 'The cutting you pressed into the new mud has not died yet. She checks every morning.'],
    ], [
      [failed('edena.terraces'), 'At what is left of her terraces, south-east of the landing.'],
      'At her tea terraces, south-east of the landing.',
    ]),
  ],
  incal: [
    P('nima', 'Nima', 'Sweeps the high terrace', [
      'Nima has swept the high terrace’s steps for forty years, and before she starts she looks up at the Lodestar. It dimmed a little every year as people stopped looking up.',
      [f('incal.rumour.light'), 'The night the sky rang, a light flew low across the shaft singing one high note. The Lodestar answered, and a splinter broke off and fell to the bottom.'],
      [done('incal.light'), 'The Lodestar burns again and her steps turned gold. She gave you her words: look up once a day.'],
    ], ['On the high terrace, down the red stair from the rim.']),
    P('ossa', 'Ossa', 'Keeper of the Upward Shrine', [
      'Ossa keeps the Upward Shrine at the bottom of the shaft, built round the splinter that fell into Behla’s laundry. The bottom prays with its eyes shut; the smog stings.',
      [f('clue.incal.perdide'), 'A trader from the swamp of lights once brought a crystal that sang the same note as the splinter.'],
      [f('incal.splinter.given'), 'She gave you the splinter to carry up to the palace, with a message: we are still down here, and we are still looking.'],
      [f('incal.lit'), 'The light reached the bottom; she could open her eyes and look straight at it.'],
    ], ['At the Upward Shrine on the bottom terrace.']),
    P('dov', 'Dov', 'Guard at the palace gate', [
      'A palace guard who repeats the rules until supper: stay on the ring, no staring at the light.',
      [f('incal.dov.allowed'), 'He knew the splinter’s note: he heard it through the floor of the flat he grew up in, at the bottom. He let you up to the crown.'],
      [f('incal.dov.fed'), 'Pip is his nephew. He ate Pip’s ration tin at his post, and offered you the lift token he had carried for eleven years, meaning to visit.'],
    ], [
      [f('incal.token', 'returned'), 'At the palace gate. His rest day is the fourth: he is going down to see Pip.'],
      'At the palace gate, at the top of the shaft.',
    ]),
    P('pip', 'Pip', 'Has seen the sky once', [
      'Pip lives at the bottom and once saw the sky for eleven seconds. Uncle Dov guards the palace and has not visited in years.',
      [f('incal.lit'), 'The light came through the smog, longer than eleven seconds this time.'],
      [done('incal.ration'), 'You carried Pip’s ration tin to Dov, who sent word back: Pip is taller.'],
    ], ['On the bottom terrace, below the smog.']),
    P('perrine', 'Perrine', 'Keeps the halfway tea stall', [
      'Perrine pours halfway tea in the middle levels, where everyone passes and nobody stays. Her mother put up the mirror that threw a coin of the Lodestar’s light down to the bottom.',
      [done('incal.mirror'), 'The mirror faces up the shaft again.'],
    ], ['At her tea stall by the halfway cab stop.']),
    P('lio', 'Lio', 'Dispatches the City-Shaft’s cabs', [
      'Lio dispatches nine hundred cabs, which stop for passes, not people, and never below the smog. When the sky rang, every compass in them failed at once.',
      [done('incal.pass'), 'Lio wrote you a cab pass, paid with the fare Tobin owed.'],
    ], ['At the cab stand on the rim.']),
    P('hask', 'Tobin', 'Sells views along the rim', [
      'Tobin sells views of the abyss along the rim. Up is free, much to his regret.',
    ], ['Along the City-Shaft’s rim.']),
    P('corvin', 'Corvin Sale', 'Of the rim, third generation', [
      'A resident of the rim, third generation, who stopped noticing the view years ago and calls the Lodestar a light show.',
      [f('incal.lit'), 'He looked up too, like everyone else. Do not tell anyone he said it was beautiful.'],
    ], ['On the City-Shaft’s rim.']),
    P('wren', 'Wren', 'The old cab that still stops', [
      'Public cab nine-nine-one. Wren’s first fare was a mother going to a doctor at night; the palace’s update never arrived, so Wren still stops at the bottom’s call-lamp.',
    ], ['Round the City-Shaft, coming back to the call-lamp at the bottom.']),
  ],
  garage: [
    P('ambroise', 'Ambroise', 'Clerk of the round', [
      'Ambroise sends Major Brask’s signal round every day: from the board, to the upside-down relay, to the ring and back. Nobody knows what it says.',
      [f('garage.signal.given'), 'He let you carry the signal round.'],
      [done('garage.signal'), 'The board stopped blinking and shows the mark now: three dots above an arc.'],
    ], ['At the signal board by the start.']),
    P('ottla', 'Ottla', 'Mechanic of everything', [
      'Ottla decides when things are broken. Three machines stopped the night the ring’s slit sang, with no broken parts: the windmill, the upside-down lamp pump and the ring turbine.',
      [done('garage.machines'), 'You woke all three with a splash each; Ottla can hear them from the windmill.'],
    ], ['By the windmill on the plateau.']),
    P('lune', 'Lune', 'Reads the signal at the ring', [
      'Lune holds the signal up to the ring’s slit at noon and sends it on.',
      [f('garage.rumour.light'), 'Lune was beside the turbine when the singing light crossed the slit, low and slow, and turned, deliberately it seemed. The slit’s rim still pulls at compasses, as your ship’s scar does.'],
      [f('garage.signal.read'), 'You brought the stamped signal; nine dots of light fell on the floor, pointing to a place.'],
    ], ['At the ring, under the slit.']),
    P('pip.garage', 'Zazie', 'Does not trust down', [
      'Down follows your feet in the Hangar, and Zazie likes down to make a commitment. Zazie’s ball wanted to reach the plateau, where things stay put.',
      [done('garage.ball'), 'You pushed the ball up the curve and through the wall portal. Someday Zazie will follow it.'],
    ], ['On the curve below the wall portal.']),
    P('clemence', 'Clemence', 'Remembers the Major', [
      'Clemence knew Major Brask before he built the Hangar, when he was a man with a pencil and too many ideas. He remembered how he built it, every rivet, but forgot why.',
      [f('garage.note.read'), 'The Major spoke once of a wheel under a desert that turns one tooth a year.'],
    ], ['In the Sealed Hangar.']),
    P('nikko', 'Nikko', 'Greases the great machine', [
      'Nikko greases the great machine, all of it; by the top, the bottom wants greasing again. The best job in the world: it never ends.',
    ], ['By the great machine in the Hangar.']),
    P('ferrol', 'Gaspard', 'Walked round the ring', [
      'Gaspard walked the whole ring once and came back to his own footprints.',
    ], ['Resting on the ring.']),
  ],
  buried: [
    P('wen', 'Wen', 'Counts the teeth', [
      'Wen counts age in teeth: once a year, on Tooth Day, the great wheel turns one tooth and sheds a sliver of metal. Wen was forty-one teeth old when you came.',
      [f('buried.wen.heard'), 'The wheel needs light: every Tooth Day Hask lights the Wick in the oculus. This year he refused to go.'],
      [done('buried.tooth'), 'You found the year’s sliver at the wheel’s feet. By the domes’ reckoning you are one tooth old.'],
      [f('buried.wen.last'), 'A wheel has no last tooth, Wen worked out: it comes round. The Other Half stays up as long as it turns.'],
    ], ['Among the domes in the sand.']),
    P('hask.buried', 'Hask', 'Keeper of the Wick', [
      'Hask has lit the Wick in the oculus for fifty-two years, fifty-two turns of the wheel.',
      [f('buried.rumour.light'), 'That night a light crossed the dunes singing the wheel’s note and turned above the canyon, as if searching. His grandmother called such things Tuning Stars. He feared lighting the Wick would call it back.'],
      [f('buried.oculus.lit'), 'You lit the Wick for him. No light came back; just sky.'],
    ], ['On the bench beside his dome, watching the sky.']),
    P('dun', 'Dun', 'Keeps the domes breathing', [
      'Dun unlocks every chimney when the wheel turns, to let the air out. The key was left on the floating derrick’s crane hook the night Dun climbed up to watch the singing light.',
      [done('buried.key'), 'You brought the key down, and every chimney on the dunes is open.'],
    ], ['Climbing between the domes.']),
    P('ossa.buried', 'Ket', 'Listens to the walls', [
      'Ket listens to the machine through its warm pipes; it is usually a quiet neighbour.',
      [f('buried.gauges.read'), 'You read the three gauges for her: ninety, ninety-one, ninety. A full year of pressure, and the Maker’s Thumb below the needles.'],
    ], ['On her ledge in the canyon.']),
    P('tull', 'Tull', 'Oils the oval doors', [
      'Tull oils the oval doors, unpaid; the alternative was listening to them squeal. The window on the balcony is always warm, as if something is still working behind it.',
      [f('clue.buried.garage'), 'A man in a tall helmet came down once, a Major who had built a world and forgotten why. He wrote numbers on the drum wall, laughed once and left.'],
    ], ['At the oval doors in the canyon.']),
    P('pim', 'Jot', 'Nine teeth old', [
      'Jot was nine teeth old and waiting to be ten. Ten-teeth-olds are allowed down the ramp.',
      [f('world.buried.done'), 'The wheel turned: Jot is ten teeth old now.'],
    ], ['Among the domes in the sand.']),
  ],
  spheres: [
    P('aube.spheres', 'Linnet', 'Listens to the spheres', [
      'Linnet listens to the spheres: each holds the last sound it heard before it fell from the sky.',
      [f('spheres.aube.heard'), 'A splash makes a sphere play its sound: the pearl by the lake, the sphere west of the arch, the large one among the eastern pillars.'],
      [done('spheres.listen'), 'Linnet heard the chord from the grove: three lonely sounds introduced to each other.'],
    ], ['In the umbrella grove.']),
    P('ume', 'Ume', 'Keeps the humming pole', [
      'Ume looks after the pole on the round plaza, which hums when the great sphere is on the horizon.',
      [f('spheres.rumour.light'), 'The night the light passed, the pole hummed after dark. The old listeners called such a light an Answerer; it turned right over the plaza, as though it had heard a reply.'],
      [f('spheres.chord.heard'), 'The pole played the three sounds together: a bell, voices and a walking drum, the last things the spheres heard before they fell.'],
    ], ['Beside the pole on the round plaza.']),
    P('nell', 'Nell', 'Looks into the lake', [
      'Nell watches the lake’s reflections, where everything comes twice, except one bright thing that is not a reflection: a mirror pebble under the water.',
      [done('spheres.pebble'), 'You set the pebble at the pole’s foot, and the lake went still.'],
    ], ['On the lake shore.']),
    P('cael', 'Cael', 'Walks the avenue', [
      'Cael walks the avenue from the arch to the plaza every day, slowly. The white bells open for those who do not hurry.',
      [done('spheres.avenue'), 'You walked it slowly, and every bell opened behind you.'],
    ], ['Along the avenue between the arch and the plaza.']),
    P('ivo', 'Emrys', 'Climbs the white hill', [
      'Emrys climbs everything, and looks under spheres, where a mark is pressed into the ground like a footprint.',
    ], ['Near the white hill.']),
  ],
  bazaar: [
    P('sel', 'Madame Sel', 'Kept the broadcast tower', [
      'Sel ran the broadcast tower for forty years. It received voices from space, from ships, colonies and lonely stations, and played them to the square: the market’s only honest sign.',
      [f('bazaar.rumour.light'), 'The night the singing light passed, every sign showed three dots over an arc; the tower received one last message and went silent.'],
      [f('clue.bazaar.home'), 'The message’s header names the port it was sent from: your home. A voice you knew, saying the name Ilen.'],
      [f('bazaar.sel.ilen'), 'You told her Ilen was your sister. Some messages, she says, are poor at addresses and very good at families.'],
      [f('bazaar.sel.found'), 'You told her Ilen heard it, thirty years late. In forty years she had never learned how a message ended.'],
    ], ['At the foot of the broadcast tower.']),
    P('kip', 'Kip', 'Courier of the skybridges', [
      'The fastest courier on the bridges, paid in fruit.',
      [f('bazaar.kip.gave'), 'Kip ran off with the tower’s last message the night the sky rang: it arrived singing, and every sign flashed the same mark. Kip gave you the cylinder.'],
    ], ['On the second skybridge.']),
    P('ferro', 'Ferro', 'Rigs the antenna', [
      'Ferro has tried to tune the antenna since the singing light passed, but its three bulbs must be lit together.',
      [f('bazaar.antenna.tuned'), 'You lit all three at once, and the antenna is tuned.'],
    ], ['On the cream balcony, halfway up the tower.']),
    P('brush', 'Brush', 'Repaints the signs', [
      'Brush has a thousand signs to repaint and gave up on finishing years ago.',
      [f('bazaar.oldsign.awake'), 'You woke the oldest sign under the second skybridge: the mark, and under it, WE HEARD YOU.'],
      [done('bazaar.oldsign'), 'Brush paints those words small in the corner of every sign now.'],
    ], ['Along the market’s avenue.']),
    P('oyo', 'Oyo', 'Sells lanterns', [
      'Every lantern on Oyo’s stall holds a little sun. The night the light passed they all went out, then relit in a colour he had never stocked.',
      [f('bazaar.tank.lantern'), 'He kept one under the stall, and poured its light into your tank.'],
    ], ['At his lantern stall in the market.']),
    P('doss', 'Doss', 'Welcomes everyone to the market', [
      'Doss welcomes everyone to the Signal Market; it is the job.',
    ], ['At the market’s entrance.']),
    P('teb', 'Teb', 'A cab tout', [
      'Teb waves at the cabs circling the tower. The quiet ones, Teb says, don’t talk: they listen.',
    ], ['By the cabs in the market.']),
  ],
  lantern: [
    P('ilen', 'Ilen', 'Keeps the Lantern', [
      'She knew your father’s ship at once: he let her paint the stripe on it when she was nine. Ilen is your sister, who left before you were born and never came home.',
      [f('finale.met'), 'The makers’ lantern sends a light to bring in anyone a long way from home; one brought her in thirty years ago. When your father’s message reached her, thirty years late, she sang it into a light, put the makers’ sign on it and sent it home. That light was what struck your ship.'],
      [f('finale.met'), 'Odile and Talo reached the Lantern before her, kept it and kept her. They lie on the point under two stones.'],
      [f('finale.met'), 'She is coming home with you, to meet Lou.'],
    ], [
      [f('ending.final'), 'At home, in the round house.'],
      [f('finale.met'), 'Coming home with you on the ship.'],
      'At the Lantern’s step, on its island.',
    ]),
  ],
  home: [
    P('lou', 'Lou', 'Your daughter, seven and a half', [
      'Your daughter, seven and a half, who draws everything: one drawing for every card you sent, by the door. She chooses the flowers for her grandparents’ stone every Sunday.',
      [f('ending.done'), 'You promised her on the stone: once more, then you are staying.'],
    ], ['At home, with Aunt Tove and Moustache the dog.']),
    P('tove', 'Aunt Tove', 'Your mother’s sister', [
      'Your mother’s sister, at home with Lou. There is a place for you at the table.',
    ], ['At home.']),
  ],
};

/** The groups of the People page in order: the route's worlds, then home and the Lantern. */
export const WORLD_ORDER = [...ORDER, 'home', 'lantern'];

// ---- what passed between you (read off the save: src/game-menu-data.js peopleData)

/** The quests each person is part of (gave it, or it ends with them). */
export const QUESTS_OF = {
  nour: ['desert.power'], teo: ['desert.drum'], ilo: ['desert.ilo'], oum: ['desert.oum'], marrow: ['desert.bike'], pell: ['desert.mask'],
  oia: ['arzach.bird'], senn: ['arzach.feathers'], hollin: ['arzach.hand'],
  calix: ['arzach2.bell'], aube: ['arzach2.bell'], ysolde: ['arzach2.letter'], ondine: ['arzach2.letter'], tiv: ['arzach2.cairn'],
  wendel: ['perdide.patience'], corm: ['perdide.patience'], saba: ['perdide.crystal'], ysse: ['perdide.crystal'], 'ivo.perdide': ['perdide.fireflies'],
  'hollin.perdide2': ['perdide2.lamps'], 'pim.perdide2': ['perdide2.latch'], fen: ['perdide2.skiff'], bram: ['perdide2.skiff'],
  mira: ['edena.garden', 'edena.clock'], vey: ['edena.garden'], oro: ['edena.seed'], 'lio.edena': ['edena.tree'], esk: ['edena.terraces', 'edena.cutting'],
  nima: ['incal.light'], ossa: ['incal.light', 'incal.wren'], dov: ['incal.light', 'incal.ration'], pip: ['incal.ration'], perrine: ['incal.mirror'], lio: ['incal.pass'], hask: ['incal.pass'], wren: ['incal.wren'],
  ambroise: ['garage.signal'], lune: ['garage.signal'], ottla: ['garage.machines'], 'pip.garage': ['garage.ball'],
  wen: ['buried.tooth'], 'hask.buried': ['buried.tooth'], dun: ['buried.key'], 'ossa.buried': ['buried.gauges'], tull: ['buried.window'],
  'aube.spheres': ['spheres.listen'], ume: ['spheres.listen'], nell: ['spheres.pebble'], cael: ['spheres.avenue'],
  sel: ['bazaar.signal'], kip: ['bazaar.signal'], ferro: ['bazaar.signal'], brush: ['bazaar.oldsign'],
  ilen: ['lantern.ilen'],
};

/** What changed hands, once it has. */
export const GIFTS = {
  ama: [[f('desert.jar.given'), 'She gave you the drinking jar.']],
  oum: [[f('desert.oum.thanked'), 'She gave you her knotted cord.']],
  teo: [[f('desert.teo.drumming'), 'You brought back his drum.']],
  marrow: [[f('desert.bike.found'), 'He gave you the hoverbike from under his tarp.']],
  senn: [[done('arzach.feathers'), 'You found the bird’s three shed feathers.']],
  calix: [[f('arzach2.clapper.hung'), 'You brought back the bell’s clapper.']],
  ysolde: [[started('arzach2.letter'), 'She gave you a letter for her sister.']],
  ondine: [[past('arzach2.letter', 'lamp'), 'You gave her Ysolde’s letter.']],
  tiv: [[done('arzach2.cairn'), 'You brought back the three stones of the cairn.']],
  'ivo.perdide': [[done('perdide.fireflies'), 'Ivo gave you a jar of fireflies.']],
  'pim.perdide2': [[past('perdide2.latch', 'shut'), 'You brought back the dome latch.']],
  oro: [[past('edena.seed', 'water'), 'You brought back the pyramid seed.']],
  esk: [[started('edena.cutting'), 'She gave you a cutting from the rows that held.']],
  ossa: [[f('incal.splinter.given'), 'She gave you the Lodestar splinter to carry up.']],
  dov: [[f('incal.dov.fed'), 'You gave him Pip’s ration tin.']],
  lio: [[done('incal.pass'), 'Lio wrote you a cab pass.']],
  hask: [[past('incal.pass', 'back'), 'Tobin paid you the coin he owed Lio.']],
  ambroise: [[f('garage.signal.given'), 'He gave you the signal to carry round.']],
  lune: [[f('garage.signal.read'), 'You brought Lune the stamped signal.']],
  wen: [[done('buried.tooth'), 'You brought the year’s tooth sliver; Wen said to keep it.']],
  dun: [[done('buried.key'), 'You brought back the chimney key.']],
  kip: [[f('bazaar.kip.gave'), 'Kip gave you the tower’s last recording.']],
  oyo: [[f('bazaar.tank.lantern'), 'He poured his last lantern into your tank.']],
};

/** The keepsakes (game.keepsakes()) and who gave them. */
export const KEEPSAKE_FROM = {
  'desert.song': 'teo', 'perdide.word': 'wendel', 'perdide2.person': 'hollin.perdide2', 'edena.word': 'mira', 'incal.word': 'nima', 'incal.token': 'dov',
  'arzach2.song': 'calix', 'buried.thing': 'wen', 'spheres.song': 'ume', 'lantern.person': 'ilen',
};

/** Each errand (ERRANDS in src/levels/content.js names them by their world's npc index) as [giver, receiver]. */
export const ERRAND_PEOPLE = {
  sand: ['pell', 'senn'], feather: ['hollin', 'aube'], crystal: ['ivo.perdide', 'bram'], gear: ['pim.perdide2', 'mira'], seed: ['lio.edena', 'nima'],
  token: ['lio', 'clemence'], handbell: ['calix', 'wendel'], grease: ['nikko', 'tull'], pipewhistle: ['ossa.buried', 'aube.spheres'], mirror: ['nell', 'oyo'],
};

/** The choices the stone remembers, and a smaller one, as the person would remember them (the first that holds). */
export const CHOICES = {
  dov: [[f('incal.token', 'kept'), 'You kept the lift token he gave you.'], [f('incal.token', 'returned'), 'You pressed his lift token back into his hand: go down and see Pip.']],
  'hollin.perdide2': [[f('perdide2.promise.kept'), 'You promised to come back, and you came back.'], [f('perdide2.promise', 'yes'), 'You promised to come back.'], [f('perdide2.promise', 'maybe'), 'You would not promise to come back. A welcome isn’t a debt, he said.']],
  esk: [[failed('edena.terraces'), 'You turned the builders’ gate once, as she asked. Her hill went down into the hollow.']],
  ilo: [[f('desert.ilo.told', 'true'), 'You told Ilo the truth about the giant’s well.'], [f('desert.ilo.told', 'monster'), 'You told Ilo there is a monster under the city.'], [f('desert.ilo.told', 'secret'), 'You kept it a secret until Ilo is older.']],
};

const firstThat = (list, flags) => { for (const x of list ?? []) { if (typeof x === 'string') return x; if (test(x[0], flags)) return x[1]; } return null; };
const allThat = (list, flags) => (list ?? []).filter((x) => typeof x === 'string' || test(x[0], flags)).map((x) => (typeof x === 'string' ? x : x[1]));

/** The parts of their story the traveller has heard, in order. */
export const personStory = (p, flags = {}) => allThat(p.story, flags);
/** Where they are and how they are doing now. */
export const personNow = (p, flags = {}) => firstThat(p.now, flags) ?? '';

/** Every person in the book, with their world: [{ ...p, world }]. */
export const EVERYONE = WORLD_ORDER.flatMap((world) => (BOOK[world] ?? []).map((p) => ({ ...p, world })));
export const PERSON = new Map(EVERYONE.map((p) => [p.id, p]));

/** The people met so far (`met.<id>`), grouped by world in the route's order: [{ world, people }]. */
export function metPeople(flags = {}) {
  return WORLD_ORDER.map((world) => ({ world, people: (BOOK[world] ?? []).filter((p) => flags[`met.${p.id}`]).map((p) => ({ ...p, world })) }))
    .filter((g) => g.people.length);
}

/**
 * What passed between you, from the save: { talks, quests: [{ id, title, state }], things: [text], choices: [text] }.
 * `errands`: the journal's ({ id: { item, done } }); `keepsakes`: game.keepsakes(). `talks`: how many conversations
 * (talks.<id>, counted since October 2026; 1 for someone met before that).
 */
export function interactions(p, { flags = {}, errands = {}, keepsakes = [] } = {}) {
  const talks = +flags[`talks.${p.id}`] || (flags[`met.${p.id}`] ? 1 : 0);
  const quests = (QUESTS_OF[p.id] ?? []).map((id) => {
    const q = QUEST_BY_ID.get(id), s = flags[`quest.${id}`];
    if (!q || s == null) return null;
    return { id, title: q.title, state: s === 'done' ? 'done' : s === 'failed' ? 'failed' : 'active' };
  }).filter(Boolean);
  const things = allThat(GIFTS[p.id], flags);
  for (const [id, [from, to]] of Object.entries(ERRAND_PEOPLE)) {
    const e = errands?.[id];
    if (!e) continue;
    if (from === p.id) things.push(`${p.name} gave you ${e.item} to carry on.`);
    if (to === p.id && e.done) things.push(`You delivered ${e.item}.`);
  }
  for (const k of keepsakes ?? []) if (KEEPSAKE_FROM[k.id] === p.id) things.push(`Keepsake: ${k.name}.`);
  const choice = firstThat(CHOICES[p.id], flags);
  return { talks, quests, things, choices: choice ? [choice] : [] };
}
