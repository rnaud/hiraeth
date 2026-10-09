// The shops' keepers (src/story/shops.js puts them behind their counters; src/shop.js is what they sell).
// Every line carries a tone (src/story/tone.js; tests/tone.test.js reads this file).
//
// Haddu keeps the shop by Qanat's main gate, between the camps and the walls: a broad, slow man in a deep
// teal coat over saffron, a red fez, a brass monocle, and a bell he rings for every sale. He weighs every
// chime (a small floating crystal since October 2026) on his little scale and taps it ("a chime rings true or
// it doesn't") and sells to pilgrims what the walk takes
// out of them: cures for the hurt, and now and then a heart's worth of something stronger. He has kept shop
// through forty Drinkings and talks about them as other people talk about the weather.

/**
 * A keeper of the later worlds (batch 4: docs/design/shop-prompts.md names them): their look and voice, and a
 * conversation of the same shape as Haddu's: hello (the first time), again (`met.<id>`), and one thing to ask
 * about (`topic`, its node setting `flag` for the People page when it has one). Every choice but the last ends
 * on "show me what you have" (the shop) or a goodbye.
 */
function keeper({ id, shop, hello, again, topic, show = '~curious~ Show me what you have.', bye, ...rest }) {
  const open = { text: show, do: { emit: ['shop:open', { shop }] }, end: true };
  return {
    id, range: 3.6, ...rest,
    talk: {
      entry: [{ if: { flag: `met.${id}` }, node: 'again' }, { node: 'hello' }],
      nodes: {
        // (two answers a node, as nearly everywhere: tests/dialogue-choices.test.js; B leaves a conversation anyway)
        hello: { say: hello, choices: [open, { text: topic.ask, goto: 'topic' }] },
        again: { say: again, choices: [open, { text: topic.ask, goto: 'topic' }] },
        topic: { ...(topic.flag ? { do: { set: { [topic.flag]: true } } } : {}), say: topic.say, choices: [open, { text: bye, end: true }] },
      },
    },
  };
}

/** Talking to a keeper: their conversation (src/story/dialogue.js). 'Show me your wares' opens the shop. */
export const SHOPKEEPERS = {
  haddu: {
    id: 'haddu', name: 'Haddu', title: 'chime-weigher and seller of cures', color: '#2f6f6a', voice: 0.78, kind: 'm', range: 3.8,
    palette: { cloak: '#2f6f6a', lining: '#2b211f', cloth: '#e8c66a', legs: '#4a3a2a', hat: '#b8432e', accent: '#c9974a', hair: '#2b211f' },
    head: 'fez', cape: 0.9, look: { mask: 'monocle', body: 'satchel', prop: 'bell', robe: 0.4, trim: 'stripes', build: 'heavy', mood: 'amused' },
    lines: ['~happy~ Come in out of the sun.', '~playful~ Every chime rings true in here. I check.', '~neutral~ Cures for the walk. Hearts for the brave.'],
    talk: {
      entry: [
        { if: { flag: 'met.haddu' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: [
            '~happy~ A customer from the sky! Come in, come in. I’m Haddu. Forty Drinkings I’ve kept this shop, and the sun has never once followed me inside.',
            '~playful~ I sell what the walk takes out of people. *Healing potions*, a few *hearts’ worth of courage*, a little more room in that tank of yours. All for chimes.',
          ],
          choices: [
            { text: '~curious~ Show me what you have.', do: { emit: ['shop:open', { shop: 'qanat' }] }, end: true },
            { text: '~curious~ Chimes?', goto: 'chimes' },
            { text: '~neutral~ Another time.', end: true },
          ],
        },
        again: {
          say: [{ if: { flag: 'desert.tree.lit' }, text: '~happy~ The tree burns and the pilgrims spend. Good for everyone’s heart. Especially mine.' }, '~happy~ Back again! The scale missed you.'],
          choices: [
            { text: '~curious~ Show me what you have.', do: { emit: ['shop:open', { shop: 'qanat' }] }, end: true },
            { text: '~curious~ Where do your hearts come from?', goto: 'hearts' },
            { text: '~neutral~ Just looking. Goodbye.', end: true },
          ],
        },
        chimes: {
          say: [
            '~neutral~ Shards of singing crystal, about as long as your hand. They float a little above the sand and ring like glass when you touch them, so you always know when you’ve dropped your fortune.',
            '~playful~ The creatures out in the dunes are full of them. Don’t ask me why. Clear a few of them off the road and bring me what rings.',
          ],
          choices: [{ text: '~curious~ Show me what you have.', do: { emit: ['shop:open', { shop: 'qanat' }] }, end: true }, { text: '~happy~ I’ll be back.', end: true }],
        },
        hearts: {
          do: { set: { 'desert.haddu.hearts': true } },   // (the People page: where his hearts come from)
          say: [
            '~whisper~ The salt pilgrims bring them from past the flats. Little red things that beat if you hold them. Swallow one and you can take a harder knock.',
            '~solemn~ I only ever get a couple. When they’re gone, they’re gone, and the next ones cost more. That’s not greed. That’s the salt road.',
          ],
          choices: [{ text: '~curious~ Show me what you have.', do: { emit: ['shop:open', { shop: 'qanat' }] }, end: true }, { text: '~neutral~ Goodbye, Haddu.', end: true }],
        },
      },
    },
  },

  // Vael: Brin keeps the Wind-Shelf, a shelter carved in a hoodoo's foot on the way to the lone tower. Tall and
  // still, in layered peach and ochre wraps, a scarf over her mouth; she says one word at a time, as Vael does,
  // and draws prices in a tray of sand with a stick. Her wares hang on cords and turn in the wind.
  brin: keeper({
    id: 'brin', shop: 'windshelf', name: 'Brin', title: 'keeper of the Wind-Shelf', color: '#dc9f52', voice: 1.04, kind: 'f',
    palette: { cloak: '#e8a07a', lining: '#c98a5a', cloth: '#e2b25e', legs: '#b07a5a', hat: '#e7b06a', accent: '#f3e6d0', hair: '#4a3328' },
    head: 'headcloth', cape: 1.1, look: { head: 'headcloth', mask: 'scarfmask', body: 'scarf', robe: 0.12, build: 'slim', height: 1.1, mood: 'calm' },
    lines: ['~neutral~ Wind.', '~whisper~ Shelf.', '~happy~ Welcome.'],
    hello: ['~happy~ Welcome. Brin.', '~neutral~ Cures. Hearts. Chimes. (She draws a flask in the sand, then a crystal beside it.)'],
    again: ['~happy~ Back.', '~neutral~ (She smooths the sand in her tray, ready to draw a price.)'],
    topic: { ask: '~curious~ Why one word at a time?', flag: 'arzach.brin.words', say: ['~whisper~ Wind. Carries. Words.', '~neutral~ (She points up at the cords turning under the cap.) Few words. Far.'] },
    bye: '~happy~ I understand. Goodbye.',
  }),

  // Vael II: Sister Perpetue is the monks' almoner: round and brisk, a grey habit and a white wimple like a bell.
  // She sells through a hatch in the monastery's gatehouse, rings one of the seven little bells over it for every
  // sale and seals each flask with wax pressed with the Three Notes.
  perpetue: keeper({
    id: 'perpetue', shop: 'almonry', name: 'Sister Perpetue', title: 'the almoner of the Sky Stones', color: '#8d8f96', voice: 1.12, kind: 'f',
    palette: { cloak: '#8d8f96', lining: '#6f7178', cloth: '#9a9ca2', legs: '#5a5c62', hat: '#f6f2ea', accent: '#f6f2ea', hair: '#6a5040' },
    head: 'headcloth', cape: 0.3, look: { head: 'headcloth', body: 'collar', trim: 'none', robe: 0.04, build: 'heavy', height: 0.94, mood: 'amused' },
    lines: ['~happy~ The almonry is open!', '~playful~ One bell for every sale. Ring me a tune.', '~neutral~ Sealed with the Three Notes, every one.'],
    hello: ['~happy~ A traveller from below the cloud! Come to the hatch, come. Sister Perpetue, almoner. I keep what the order gives to the road.', '~playful~ Cures, sealed in wax with the Three Notes. Now and then a heart, when the cloud brings one up. Chimes, if you please. The bells don’t ring themselves.'],
    again: [{ if: { quest: 'arzach2.bell', done: true }, text: '~happy~ The great bell rings again, and so do mine. What a noisy, happy house.' }, '~happy~ Back at the hatch! I kept the wax warm.'],
    topic: { ask: '~curious~ Why a bell for every sale?', flag: 'arzach2.perpetue.bells', say: ['~solemn~ Seven little bells, one for each founder. When I sell a cure I ring one, so the founders know something was given away and not kept.', '~playful~ Mother Ysolde says it’s the noisiest prayer in the monastery. She’s right. It’s also the only one that pays for the candles.'] },
    bye: '~happy~ Ring one for me. Goodbye.',
  }),

  // Lorn: Nettle keeps a raft-house moored in the reeds by the landing: an old, long-armed swamp woman under a
  // wide reed hat and a waxed moss-green cape. She keeps her accounts as knots on the cords at her belt (Lorn
  // writes in knots), and the Hush is painted on her door so the snappers leave her be.
  nettle: keeper({
    id: 'nettle', shop: 'float', name: 'Nettle', title: 'keeper of the Float', color: '#6f8a4a', voice: 0.9, kind: 'f',
    palette: { cloak: '#6f8a4a', lining: '#4f6a3a', cloth: '#8a8a5a', legs: '#4a4a3a', hat: '#c9b07a', accent: '#c9b07a', hair: '#5a6a5a', skin: '#b9b48e' },
    head: 'straw', cape: 1.3, look: { head: 'straw', body: 'reedcape', robe: 0.2, build: 'slim', height: 0.98, mood: 'amused' },
    lines: ['~whisper~ Hush now. The snappers are sleeping.', '~playful~ One knot for every cure sold.', '~neutral~ Mind the step. The float bobs.'],
    hello: ['~whisper~ Step soft, sky-child. The float bobs and the snappers listen. Nettle. I keep the shop on the water.', '~playful~ Cures for bites. A heart now and then. A little more room in that tank, if you can pay in chimes. Every sale’s a knot on my cord.'],
    again: [{ if: { quest: 'perdide.crystal', done: true }, text: '~happy~ The Great Crystal sings again. My knots are counting faster.' }, '~happy~ Back on my float. Mind the hatch, it’s wet.'],
    topic: { ask: '~curious~ What’s painted on your door?', flag: 'perdide.nettle.hush', say: ['~whisper~ The Hush. Three drops over a closed mouth. The snappers know it: whoever paints it means them no harm and makes no noise.', '~playful~ I keep quiet, they keep their teeth to themselves. Forty years of good neighbours.'] },
    bye: '~whisper~ I’ll keep quiet. Goodbye.',
  }),

  // Lorn II: Rowan, Hollin's cousin, keeps the Welcome-Shelf, a moss dome on the lit path: plump and flustered in a
  // quilted dusk-blue coat. He has kept a shop stocked for travellers for thirty years and never had one; everything
  // is dusted daily. Three little lamps hang over his door: the Welcome.
  rowan: keeper({
    id: 'rowan', shop: 'welcome', name: 'Rowan', title: 'keeper of the Welcome-Shelf', color: '#3f4f86', voice: 0.92, kind: 'm',
    palette: { cloak: '#3f4f86', lining: '#2f3a66', cloth: '#4a5a92', legs: '#3a3a4a', hat: '#2f3a66', accent: '#34437a', hair: '#b08a5a' },
    head: 'beanie', cape: 0, look: { head: 'beanie', body: 'collar', robe: 0.45, trim: 'diamonds', build: 'heavy', mood: 'curious' },
    lines: ['~surprised~ A customer! A real one!', '~happy~ Everything dusted this morning. And yesterday.', '~playful~ Three lamps over the door. That’s the Welcome.'],
    hello: ['~surprised~ Oh! Oh, a customer! Thirty years I’ve kept this shelf stocked for travellers, and you’re the first. Rowan. Hollin’s cousin. Do come in, mind the rug.', '~happy~ Cures, all dusted. A heart in a glass jar, the only one I have. Chimes, please. I had to look up what to charge.'],
    again: [{ if: { quest: 'perdide2.lamps', done: true }, text: '~happy~ The lamps are lit all the way down the path. More travellers, Hollin says. Imagine!' }, '~happy~ You came back! Twice is a regular, you know.'],
    topic: { ask: '~curious~ Why keep a shop nobody came to?', flag: 'perdide2.rowan.welcome', say: ['~solemn~ Because the Welcome says someone will come. Three lamps over a door mean a traveller can knock. You don’t take them down just because nobody has.', '~playful~ And I dust. A shop that’s ready is half a shop already. The other half is you.'] },
    bye: '~happy~ I’ll come back. Goodbye.',
  }),

  // Viridel: Clover keeps the Potting House, a lean-to of wood and glass against a fallen builders' slab under an
  // umbrella tree: a tall, gentle gardener-apothecary in a leaf-green smock and a wide straw hat, petals in her hair,
  // shears at her belt. She sells only what the garden gives and digs up nothing.
  clover: keeper({
    id: 'clover', shop: 'potting', name: 'Clover', title: 'gardener and apothecary', color: '#7fae6a', voice: 1.06, kind: 'f',
    palette: { cloak: '#7fae6a', lining: '#5f8a4e', cloth: '#7fae6a', legs: '#6a5a40', hat: '#e2c47a', accent: '#e98fb0', hair: '#3a2a22' },
    head: 'straw', cape: 0, look: { head: 'straw', body: 'garland', prop: 'flower', robe: 0.12, trim: 'bib', build: 'slim', height: 1.04, mood: 'kind' },
    lines: ['~happy~ Everything here grew. Nothing was dug up.', '~neutral~ Mind the seedlings.', '~happy~ The garden gives what it gives.'],
    hello: ['~happy~ Hello, you. Come in out of the light, the glass keeps it soft. I’m Clover. I pot what the garden gives and sell it to whoever needs it.', '~neutral~ Cures from the red-leaf. A heart, when one ripens. I dig up nothing the builders left. Chimes, please.'],
    again: [{ if: { quest: 'edena.garden', done: true }, text: '~happy~ The ship’s flank is in flower. Mira hasn’t stopped smiling. Neither have my pots.' }, '~happy~ Back again. The seedlings remember you.'],
    topic: { ask: '~curious~ A heart that ripens?', flag: 'edena.clover.hearts', say: ['~whisper~ Under the umbrella trees, once a season, a red thing grows in the moss, the size of a fist. It beats if you hold it.', '~solemn~ I take one and leave the rest. Mira says that’s the only rule the garden ever had: take, leave, and dig up nothing.'] },
    bye: '~happy~ Take one, leave the rest. Goodbye.',
  }),

  // The City-Shaft: Fausta keeps a narrow basket-shop on the middle terraces by the cab stop: a brisk, sharp-eyed
  // apothecary in a rust apron and rolled sleeves who sells to every level by a basket on a rope over the void.
  fausta: keeper({
    id: 'fausta', shop: 'basket', name: 'Fausta', title: 'apothecary of the middle terraces', color: '#b9532f', voice: 1.1, kind: 'f',
    palette: { cloak: '#efe6d4', lining: '#d8ccb6', cloth: '#efe6d4', legs: '#4a3a3a', hat: '#2b211f', accent: '#b9532f', hair: '#2b211f' },
    head: 'bun', cape: 0, look: { head: 'bun', body: 'toolbelt', trim: 'bib', robe: 0, build: 'average', mood: 'stern' },
    lines: ['~neutral~ Basket going up! Mind your heads.', '~playful~ Rim prices up, bottom prices down. You’re in the middle. Lucky you.', '~happy~ Fausta’s. Cures for every level.'],
    hello: ['~neutral~ In or out, the door’s letting the shaft in. Fausta. I sell to every level of this city with a basket and a rope.', '~playful~ Cures, a heart or two, a little room for that tank of yours. Chimes. Here in the middle you pay middle prices. Don’t tell the rim.'],
    again: [{ if: { quest: 'incal.light', done: true }, text: '~happy~ The Lodestar’s lit and the whole shaft is shopping. My rope’s worn thin.' }, '~neutral~ Back again. Good. The basket was getting bored.'],
    topic: { ask: '~curious~ Why a basket on a rope?', flag: 'incal.fausta.basket', say: ['~neutral~ The rim won’t come down and the bottom can’t come up. So the shop goes to them. A bell rings at the top, a bell rings at the bottom, the basket goes where it’s rung for.', '~playful~ Rim prices on the way up, bottom prices on the way down. Same cure. Nobody’s ever compared baskets.'] },
    bye: '~playful~ Your secret’s safe. Goodbye.',
  }),

  // The Sealed Hangar: Odo is the Major's quartermaster, stocky in a faded blue boiler suit with brass buttons and a
  // peaked cap; he keeps a hatch of riveted plate on the plateau under the keep and issues everything against
  // requisitions Major Brask signed decades ago, stamping each one.
  odo: keeper({
    id: 'odo', shop: 'hatch', name: 'Odo', title: 'the Major’s quartermaster', color: '#5a76a6', voice: 0.8, kind: 'm',
    palette: { cloak: '#5a76a6', lining: '#46608a', cloth: '#5a76a6', legs: '#46608a', hat: '#46608a', accent: '#c9973e', hair: '#5a4a3a' },
    head: 'peak', cape: 0, look: { head: 'peak', body: 'badge', trim: 'none', robe: 0, build: 'heavy', height: 0.97, mood: 'stern' },
    lines: ['~neutral~ Requisition first. Then the goods.', '~solemn~ Signed by the Major. Stamped by me.', '~neutral~ Quartermaster’s hatch. State your needs.'],
    hello: ['~neutral~ Halt. Quartermaster’s hatch. Odo, quartermaster to Major Brask. Everything here is issued against a signed requisition.', '~solemn~ The Major signed a great many before he forgot why. Cures, a heart, stamped and issued. The chimes go in the strongbox. Regulations.'],
    again: [{ if: { quest: 'garage.signal', done: true }, text: '~surprised~ The Major remembered his own desk, they say. Then my requisitions are good for another forty years.' }, '~neutral~ You again. Good. Repeat customers keep the ledger tidy.'],
    topic: { ask: '~curious~ Requisitions from decades ago?', flag: 'garage.odo.stamps', say: ['~solemn~ The Major signed a crate of blank requisitions before he went up into the keep. “For whatever the people need,” it says on each one. I stamp one for every sale.', '~neutral~ I have three thousand and six left. At one a sale, the regulations will outlast me.'] },
    bye: '~neutral~ Carry on, quartermaster.',
  }),

  // The Buried Machine: Mott keeps the Tooth-Counter, a small dome among the domes: an old dome-woman with brass
  // goggles pushed up on her forehead and a rust-orange quilted apron. She counts on an abacus of gear teeth and
  // dates every sale by the great wheel's tooth.
  mott: keeper({
    id: 'mott', shop: 'toothcounter', name: 'Mott', title: 'keeper of the Tooth-Counter', color: '#c9632f', voice: 1.0, kind: 'f',
    palette: { cloak: '#f0e6d4', lining: '#d8ccb6', cloth: '#efe2c8', legs: '#6a5040', hat: '#c9973e', accent: '#c9632f', hair: '#e8e2d6' },
    head: 'bun', cape: 0, look: { head: 'bun', mask: 'browgoggles', trim: 'bib', robe: 0.3, build: 'average', height: 0.95, mood: 'kind' },
    lines: ['~neutral~ Sale entered. Tooth nine hundred and twelve.', '~happy~ The wheel turns, the counter counts.', '~playful~ Shake the sand off before you come in.'],
    hello: ['~happy~ Come in, shake the sand off. Mott. I keep the Tooth-Counter, and I count the way the wheel does: one tooth at a time.', '~neutral~ Cures. A couple of hearts. A little room in that tank. Chimes, on the abacus. Every sale dated by the wheel’s tooth, so I always know how old a debt is.'],
    again: [{ if: { quest: 'buried.tooth', done: true }, text: '~happy~ The wheel turned its tooth. I wrote it down twice, in case I didn’t believe it.' }, '~happy~ Back again! Still the same tooth. Nothing changes fast down here.'],
    topic: { ask: '~curious~ Dated by the wheel’s tooth?', flag: 'buried.mott.teeth', say: ['~neutral~ The great wheel turns one tooth a year. My mother dated her sales by it, and her mother. This is tooth nine hundred and twelve.', '~playful~ A cure sold on tooth nine hundred and twelve is fresh. One from tooth eight hundred, I’d pour away.'] },
    bye: '~happy~ Tooth nine hundred and twelve. Goodbye.',
  }),

  // The Garden of Spheres: Hale keeps the Listening Stall, a round white pavilion by the cypress avenue: a lean,
  // soft-spoken old man in a cream robe with a tuning fork on a cord, who listens to every ware before he sells it
  // (a cure that hums flat is poured away).
  hale: keeper({
    id: 'hale', shop: 'listening', name: 'Hale', title: 'who listens to the cures', color: '#c9a24a', voice: 0.84, kind: 'm',
    palette: { cloak: '#efe6d2', lining: '#ddd2bc', cloth: '#f3ecdc', legs: '#cfc4ae', hat: '#e8e2d6', accent: '#c9a24a', hair: '#d8d2c6' },
    head: 'crop', cape: 0, look: { head: 'crop', body: 'none', trim: 'none', robe: 0.06, build: 'slim', height: 1.03, mood: 'calm' },
    lines: ['~whisper~ Listen. That one hums true.', '~neutral~ Every cure here has been listened to.', '~whisper~ The spheres are quiet today.'],
    hello: ['~whisper~ Softly, if you would. I am listening. Hale. I keep the Listening Stall.', '~neutral~ Every cure here has been struck and heard. A heart that beats in tune. Chimes, if you please. They ring, too. I listen to those as well.'],
    again: [{ if: { quest: 'spheres.listen', done: true }, text: '~happy~ The spheres remember aloud now. Everything in the stall hums a little sweeter.' }, '~whisper~ Ah. Your footsteps. I knew them.'],
    topic: { ask: '~curious~ You listen to the cures?', flag: 'spheres.hale.listen', say: ['~whisper~ Strike the fork, hold the flask to it. A good cure hums back the same note. One that hums flat has turned, and I pour it away.', '~solemn~ The spheres taught us. Everything that is well holds a note. Even you. Yours is a little tired, I think.'] },
    bye: '~neutral~ I’ll listen too. Goodbye.',
  }),

  // The Signal Market: Pashka keeps a cure-stall in a tower's foot on the market avenue: a big round lavender-skinned
  // trader with a voice that carries. An illustrated board over the stall shows a heart and a flask.
  pashka: keeper({
    id: 'pashka', shop: 'curestall', name: 'Pashka', title: 'cure-seller of the avenue', color: '#9a86c4', voice: 0.72, kind: 'm',
    palette: { cloak: '#efe2c8', lining: '#d8c8a8', cloth: '#f3e6c8', legs: '#7a6a9a', hat: '#9a86c4', accent: '#d6a13e', hair: '#9a86c4', skin: '#b9a3d6' },
    head: 'bald', cape: 0, look: { head: 'bald', body: 'badge', trim: 'bib', robe: 0, build: 'heavy', height: 1.12, mood: 'amused' },
    lines: ['~shout~ CURES! Hearts! Room in your tank!', '~happy~ Pashka’s, best on the avenue!', '~playful~ Look at the board, friend. It lights up when you buy.'],
    hello: ['~shout~ A NEW FACE! Step up, step up! Pashka’s Cure-Stall, the loudest on the avenue!', '~happy~ Cures in a crate, hearts in a glass case, vials to deepen that tank. Chimes, friend, chimes! The board lights up every time you buy. Everyone sees. Very good for business.'],
    again: [{ if: { quest: 'bazaar.signal', done: true }, text: '~happy~ The silent tower talks again and the whole market’s celebrating. Celebrations need cures, friend!' }, '~happy~ My favourite customer! I say that to everyone. But today it’s true.'],
    topic: { ask: '~curious~ Why the board?', flag: 'bazaar.pashka.board', say: ['~playful~ In a market of signals, a stall without one is a stall nobody hears. So: a heart and a flask, and lights.', '~whisper~ (He leans in.) Between us, the bulbs cost more than the cures. But nobody buys from a dark stall.'] },
    bye: '~playful~ Keep it lit. Goodbye.',
  }),
};

/**
 * What a keeper says at the counter while the shop is open (src/shop-panel.js shows it over the wares, in
 * their voice): a greeting, thanks for each kind of sale, short of chimes, sold out, your pack full, goodbye.
 * Picked in turn, so the same words don't come twice running.
 */
export const SHOP_LINES = {
  haddu: {
    open: ['~happy~ Look all you like. Touch what you’re buying.', '~playful~ Everything here works. Most of it twice.'],
    potion: ['~happy~ One cure, corked tight. Drink it before you need it, not after.', '~playful~ Sensible. The dunes bite.'],
    heart: ['~happy~ Swallow it whole. You’ll feel braver by sundown.', '~solemn~ A heart’s worth. Spend it well.'],
    magic: ['~happy~ A little more room in that tank. Fill it with something kind.', '~curious~ Feel that? Your pack just got deeper.'],
    short: ['~sad~ The scale says no. Come back with a few more chimes.', '~playful~ Close! But crystal doesn’t round up.'],
    soldOut: ['~sad~ That’s the last of them. The salt road brings no more.', '~neutral~ Gone, I’m afraid. Someone braver got there first.'],
    full: ['~surprised~ Your pack is full of my cures already. Drink one first.', '~playful~ Any more flasks and you’ll clink when you walk.'],
    bye: ['~happy~ Mind the sun on your way out.', '~playful~ Come back richer.'],
  },
  brin: {
    open: ['~neutral~ Look.', '~happy~ Choose. (She lifts her stick over the sand.)'],
    potion: ['~happy~ Cure. Good.', '~neutral~ Drink. Later.'],
    heart: ['~solemn~ Heart. Brave.', '~happy~ Yours. Now.'],
    magic: ['~curious~ Deeper. Feel?', '~happy~ More. Room.'],
    short: ['~sad~ Not enough. (She rubs out the price and draws it again, the same.)', '~neutral~ More chimes.'],
    soldOut: ['~sad~ Gone.', '~neutral~ None. Wind took it.'],
    full: ['~surprised~ Full. Drink first.', '~playful~ Clink. Too many.'],
    bye: ['~happy~ Wind. With you.', '~neutral~ Go well.'],
  },
  perpetue: {
    open: ['~happy~ There, all laid out on the board. Take your time, the bells can wait.', '~playful~ Everything sealed with the Three Notes. Don’t pick at the wax.'],
    potion: ['~happy~ One cure, sealed and blessed. (She rings a little bell.)', '~playful~ Ding! That’s the founders told.'],
    heart: ['~solemn~ A heart up from under the cloud. Carry it gently. (The deepest bell.)', '~happy~ There, now you’ve a braver chest than half the order.'],
    magic: ['~curious~ A little more room in your pack. Fill it with something kind.', '~happy~ Ding! And deeper you go.'],
    short: ['~sad~ Not quite, dear. The almonry gives, but it doesn’t give away.', '~playful~ A few chimes short. The bells stay quiet.'],
    soldOut: ['~sad~ That was the only one the cloud brought up this season.', '~neutral~ None left. I can pray for more, but I wouldn’t wait.'],
    full: ['~surprised~ Your pack is full of cures already. Drink one, then come back.', '~playful~ Any more and you’ll clink down the aqueduct.'],
    bye: ['~happy~ Go with the bells.', '~playful~ Mind the drop on the way out. It’s a long one.'],
  },
  nettle: {
    open: ['~whisper~ Look all you like. Touch soft.', '~playful~ Everything here floats. Even the prices.'],
    potion: ['~happy~ One cure. (She ties a knot in her cord.) Counted.', '~whisper~ For the bites. Lorn bites.'],
    heart: ['~solemn~ A heart from the reeds. Knot it close.', '~happy~ There. You’ll take a snapping better now.'],
    magic: ['~curious~ More room in the tank. Feel the water settle?', '~happy~ Deeper. Two knots for that one.'],
    short: ['~sad~ Not enough chimes. A knot needs a full count.', '~playful~ Short. The cord says no.'],
    soldOut: ['~sad~ Gone. The reeds give one a season.', '~neutral~ None left. Ask the snappers. They won’t know either.'],
    full: ['~surprised~ Full pack, sky-child. Drink one first.', '~playful~ Any more and you’ll sink my float.'],
    bye: ['~whisper~ Step soft on the way out.', '~happy~ Mind the snappers. Hush, and they mind you.'],
  },
  rowan: {
    open: ['~happy~ Have a look! Everything’s dusted. Twice.', '~surprised~ Oh, you’re actually looking. Lovely.'],
    potion: ['~happy~ A cure! My first sale! Well, another first sale.', '~playful~ Don’t drink it all at once. Or do. I’ll restock.'],
    heart: ['~surprised~ The heart! The jar’s been waiting thirty years for someone to open it.', '~solemn~ Take care of it. It’s been taken care of a long time.'],
    magic: ['~happy~ More room in that tank. Hollin would be pleased.', '~curious~ Feel deeper? I hope so. I’ve never tried one.'],
    short: ['~sad~ Oh dear, not quite enough. I could… no, I mustn’t. Hollin says I mustn’t.', '~neutral~ A few chimes short, I’m afraid. I’ll keep it dusted for you.'],
    soldOut: ['~sad~ That was my only one. The shelf looks so bare now.', '~neutral~ All gone. I’ll have to find something else to dust.'],
    full: ['~surprised~ Your pack’s full! Drink one first, then I’ll sell you another.', '~playful~ Any fuller and you’ll rattle down the path.'],
    bye: ['~happy~ Come back! The lamps will be lit.', '~playful~ Mind the rug on the way out. Everyone trips on it. Well, you would.'],
  },
  clover: {
    open: ['~happy~ Everything here grew. Take your time.', '~neutral~ Mind the seedlings when you reach.'],
    potion: ['~happy~ Red-leaf cure. Drink it when the garden scratches back.', '~neutral~ One cure. The red-leaf will grow another.'],
    heart: ['~solemn~ A ripe heart. One taken, the rest left. That’s the rule.', '~happy~ It beats. Feel it? Good. Now it’s yours.'],
    magic: ['~curious~ More room in your tank. Like a bigger watering can.', '~happy~ Deeper. The garden likes a full can.'],
    short: ['~sad~ Not enough. The garden’s patient. So am I.', '~neutral~ A few chimes short. Come back after a season. Or a fight.'],
    soldOut: ['~sad~ That was the only ripe one. The next is still green.', '~neutral~ None left. I don’t dig up what isn’t ready.'],
    full: ['~surprised~ Your pack is full of cures. Drink one, then come back.', '~playful~ Any more and you’ll slosh.'],
    bye: ['~happy~ Walk soft in the garden.', '~neutral~ Take one, leave the rest. Goodbye.'],
  },
  fausta: {
    open: ['~neutral~ There. Pick. The basket’s waiting.', '~playful~ Middle prices. Enjoy them.'],
    potion: ['~neutral~ One cure. Next.', '~playful~ That one would’ve cost double at the rim.'],
    heart: ['~solemn~ A heart. I keep only two. Don’t waste it.', '~happy~ Good choice. The jets don’t catch everyone.'],
    magic: ['~curious~ More room in your tank. Use it on the way down.', '~neutral~ Deeper. That’ll get you further up the shaft.'],
    short: ['~sad~ Short. I don’t lower a rope for less.', '~playful~ Even bottom prices are higher than that.'],
    soldOut: ['~sad~ Gone. The rim bought the rest.', '~neutral~ None left. Ask again when the basket comes back up.'],
    full: ['~surprised~ Full already? Drink one.', '~playful~ Any more and you’ll need your own basket.'],
    bye: ['~neutral~ Mind the edge.', '~playful~ Off you go. The shaft’s waiting.'],
  },
  odo: {
    open: ['~neutral~ Goods on the counter. State the item.', '~solemn~ Requisition at the ready. Choose.'],
    potion: ['~neutral~ One cure, issued. (Stamp.)', '~solemn~ Stamped and logged. Next.'],
    heart: ['~solemn~ One heart, issued against the Major’s signature. (Stamp.)', '~neutral~ Logged. Don’t lose it. There’s no form for that.'],
    magic: ['~neutral~ One tank expansion, issued. (Stamp.)', '~curious~ Deeper tank. The Major would approve. Probably.'],
    short: ['~sad~ Insufficient chimes. Regulations.', '~neutral~ Short. The strongbox doesn’t do credit.'],
    soldOut: ['~sad~ Out of stock. The requisition stands, the goods don’t.', '~neutral~ None left. Forms in triplicate won’t change it.'],
    full: ['~surprised~ Pack at capacity. Consume one first.', '~neutral~ Full. Regulations say drink before you buy.'],
    bye: ['~neutral~ Dismissed.', '~solemn~ Carry on.'],
  },
  mott: {
    open: ['~happy~ Look all you like. The abacus is ready.', '~neutral~ Everything dated. Everything fresh. This tooth.'],
    potion: ['~happy~ One cure. (Click of the abacus.) Tooth nine hundred and twelve.', '~neutral~ Counted. Drink it before the wheel turns.'],
    heart: ['~solemn~ A heart from deep in the machine. Counted, dated, yours.', '~happy~ Click. That’s a heart on the abacus, and one in you.'],
    magic: ['~curious~ More room in your tank. Two teeth on the abacus for that.', '~happy~ Deeper. The pressure suits you.'],
    short: ['~sad~ The abacus won’t close. A few chimes more.', '~playful~ Short. Even the wheel waits a year for its tooth.'],
    soldOut: ['~sad~ That’s the last until the wheel turns again.', '~neutral~ None left. Maybe next tooth.'],
    full: ['~surprised~ Your pack’s full. Drink one first.', '~playful~ Any more and you’ll clank like the derrick.'],
    bye: ['~happy~ Shake the sand off on the way out.', '~neutral~ Tooth nine hundred and twelve. Goodbye.'],
  },
  hale: {
    open: ['~whisper~ Take your time. Listen, if you like.', '~neutral~ Everything here hums true. I checked this morning.'],
    potion: ['~whisper~ (He strikes the fork, holds the flask to it.) True. Yours.', '~neutral~ One cure, in tune.'],
    heart: ['~solemn~ It beats in time. Carry it well.', '~whisper~ Hear that? It knows you already.'],
    magic: ['~curious~ More room in your tank. It hums lower now. A good sign.', '~whisper~ Deeper. Like a bigger bell.'],
    short: ['~sad~ The chimes don’t quite ring out. A few more.', '~neutral~ Not enough. I heard them, but they were few.'],
    soldOut: ['~sad~ None left that hum true. I poured the rest away.', '~neutral~ Gone. The next one is still settling its note.'],
    full: ['~surprised~ Your pack rings full. Drink one first.', '~whisper~ Too many and they’ll clash in there.'],
    bye: ['~whisper~ Go softly.', '~neutral~ Listen on the avenue. The spheres are speaking.'],
  },
  pashka: {
    open: ['~shout~ LOOK AT IT ALL! Choose, friend, choose!', '~happy~ Best cures on the avenue. Ask anyone. Loudly.'],
    potion: ['~shout~ ONE CURE! (The board lights up.) Everyone saw that!', '~happy~ Good choice, friend. Drink it when it counts.'],
    heart: ['~shout~ A HEART! The board’s never been so bright!', '~solemn~ A heart from the glass case. Don’t spend it cheap.'],
    magic: ['~happy~ More room in your tank! Deeper pockets, friend!', '~shout~ DEEPER! Board lights! Crowd cheers!'],
    short: ['~sad~ Short, friend. I love you, but the bulbs cost chimes.', '~playful~ Not enough! Come back louder. I mean richer.'],
    soldOut: ['~sad~ Gone! Sold! The case is empty, friend.', '~neutral~ None left. The board can’t light for nothing.'],
    full: ['~surprised~ Full pack! Drink one, friend, then buy another!', '~playful~ Any more and you’ll clink like my bulbs.'],
    bye: ['~shout~ COME BACK SOON!', '~happy~ Tell the avenue where you got it!'],
  },
};
