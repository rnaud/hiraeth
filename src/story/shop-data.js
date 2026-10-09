// The shops' keepers (src/story/shops.js puts them behind their counters; src/shop.js is what they sell).
// Every line carries a tone (src/story/tone.js; tests/tone.test.js reads this file).
//
// Haddu keeps the shop by Qanat's main gate, between the camps and the walls: a broad, slow man in a deep
// teal coat over saffron, a red fez, a brass monocle, and a bell he rings for every sale. He weighs every
// chime (a small floating crystal since October 2026) on his little scale and taps it ("a chime rings true or
// it doesn't") and sells to pilgrims what the walk takes
// out of them: cures for the hurt, and now and then a heart's worth of something stronger. He has kept shop
// through forty Drinkings and talks about them as other people talk about the weather.

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
            '~neutral~ Little splinters of singing crystal, no longer than your thumb. They float a hand above the sand and ring like glass when you touch them, so you always know when you’ve dropped your fortune.',
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
};
