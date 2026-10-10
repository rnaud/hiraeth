// The fellow traveller as data: Tansy, from the Salt Harbour (docs/fun-and-story-review.md, problem 4: "one
// person who travels too"; docs/systems/story.md, "A fellow traveller").
//
// Tansy is about nineteen. The Salt Harbour is a harbour with no sea (src/levels/salt-harbour.js), and its
// harbour book has an old line in home letters, half eaten by the salt: *…where the singing goes.* The night
// the sky rang, every compass in the harbour swung round the same way; by morning the others swung back,
// hers never did. She left her aunt Hesper (who keeps the harbour book) one line in it, *Gone where the singing
// goes*, took the coins in Hesper's biscuit tin, and has hitched from world to world ever since on whatever
// was going (traders, a postal hulk, a ship full of goats), following the needle. She means to get where the
// singing goes first, so they will write her name in the book in letters the salt can't eat.
//
// She is met four times, in the first four of her stops the traveller lands in (STOPS: Vael, Lorn, the
// City-Shaft, the Signal Market, in the route's order), a few steps from his ship: she saw it come down.
// Each meeting is changed by what he said at the last:
//   1. "A world ahead": brash, a race. What is he after (fellow.after)? Will he sign her book (fellow.signed)?
//   2. "The needle stops": her needle has stopped pointing and her ride left without her. His answer from
//      last time colours how she opens; then she asks whether to send word home (fellow.advice).
//   3. "Looking up": the letter written and not sent (write), the needle back and her alone with it (go), or
//      a mind made up eleven times (self). Who is waiting for him (fellow.told)? Does Hesper still read her
//      page (fellow.heart: home, or on: find where it goes first, then you'll have something to show her)?
//   4. "Something to show" (the payoff): home, she has sent word ahead and gives him her compass, which still
//      points after the light; on, she goes past where the charts end and gives him a letter for Hesper. If
//      he told her someone was waiting he never said goodbye to, she sends him to say it.
// Afterwards, in the Salt Harbour, Hesper has a word for him (the letter given, or Tansy home).
//
// Flags (game-state.js): fellow.meet (meetings had, 0..4), fellow.stop.<world> (the meeting held there),
// fellow.late (an older save had already finished one of her stops: src/save-migrate.js step 7; she has been a
// world behind him, not ahead), fellow.after ('value' | 'light' | 'unsure'), fellow.signed, fellow.advice
// ('write' | 'go' | 'self'), fellow.told ('nobody' | 'someone' | 'quiet'), fellow.heart ('home' | 'on'),
// fellow.end ('home' | 'on'), fellow.letter.given (Hesper has it); met.tansy, talks.tansy (the panel's).
// Items: saltcompass (home), saltletter (on).
//
// A page with `world` is only said in that world (src/story/fellow.js fellowPerson keeps the ones for the
// world she stands in); a node with `meet` is a meeting, and marks it had (and where) as it opens.

/** Her stops, in the route's order: she is met in the first four of these the traveller lands in. */
export const STOPS = ['arzach', 'perdide', 'incal', 'bazaar'];   // (her Lorn stop was the Deep Wood's landing until it became part of Lorn: October 2026)
/** How many meetings there are. */
export const MEETINGS = 4;

export const ITEMS = { saltcompass: 'Tansy’s compass', saltletter: 'Tansy’s letter, for Hesper' };

const is = (flag, v) => ({ flag, is: v });
const not = (c) => ({ not: c });

/** What she calls out as you come near, by the meeting she has for you (her greeting balloon). */
export const GREETING_LINES = {
  1: ['~shout~ Hey! Sky-ship! Over here!', '~happy~ You came down the singing’s way too!'],
  2: ['~tired~ Oh. It’s you. Hello, you.', '~sad~ Have you got a minute? I’ve got lots.'],
  3: ['~curious~ There you are. I wondered when.', '~solemn~ Come and look up with me.'],
  4: ['~happy~ I waited! I never wait. Come here!', '~shout~ Over here! I’ve got something for you!'],
};

// ------------------------------------------------------------------ the person
export const TANSY = {
  id: 'tansy', name: 'Tansy', title: 'from the Salt Harbour, following the singing', color: '#c4664a', voice: 1.25, kind: 'f', scale: 0.97,
  // the same in every world: dressed as the harbour folk dress (src/costumes.js saltharbour), a sailcloth coat too
  // big for her, a basil-green tunic, a terracotta knitted cap over a copper braid, a satchel for her book
  palette: { cloak: '#efe2cc', lining: '#4d6a9a', cloth: '#6f8f5a', legs: '#3a3448', hat: '#c4664a', hair: '#a8532e', skin: '#e8c0a0' },
  head: 'hair', cape: 1.1, world: 'saltharbour',
  look: { head: 'beanie', under: 'braid', mask: 'none', body: 'satchel', prop: 'none', trim: 'none', robe: 0, mood: 'curious' },
  lines: GREETING_LINES[1],
  talk: {
    // (the meetings, by the save alone; in the game src/story/fellow.js fellowPerson builds the entries for the stop she
    // stands in: again<k> where meeting k was had, else the next meeting)
    entry: [
      ...[1, 2, 3, 4].map((k) => ({ if: { flag: 'fellow.meet', is: k }, node: `again${k}` })),
      { if: { not: { flag: 'fellow.meet' } }, node: 'm1' },
      { if: { flag: 'fellow.heart', is: 'on' }, node: 'm4.on' },
      { node: 'm2' }, { node: 'm3' }, { node: 'm4.home' },
    ],
    nodes: {
      // ---------------------------------------------------------------- 1. a world ahead
      m1: {
        meet: 1,
        say: [
          { world: 'arzach', text: '~whisper~ (A girl in a sailcloth coat too big for her is writing in a book. She waves at you with her whole arm, remembers where she is, and waves smaller.)' },
          { world: 'perdide', text: '~curious~ (A girl in a sailcloth coat too big for her stands with a book open on her arm. She looks up at your footsteps as if she has been listening for some.)' },
          { world: 'incal', text: '~curious~ (A girl in a sailcloth coat too big for her stands with a book open on her arm, well back from the drop. She looks at your ship, then at you.)' },
          { world: 'bazaar', text: '~curious~ (A girl in a sailcloth coat too big for her stands under the dishes, counting coins into her palm. There are not many to count.)' },
          { if: not({ flag: 'fellow.late' }), text: '~happy~ I saw your ship come down. You’re following the singing too! I’m Tansy, from the Salt Harbour. I’ve been a world ahead of you the whole way.' },
          { if: { flag: 'fellow.late' }, text: '~playful~ So it’s you! I’m Tansy, from the Salt Harbour. I’ve been a world behind you the whole way. You leave very clear footprints.' },
          '~curious~ (She holds up a brass compass on a cord. The needle points up and away. It shivers three times, then holds still.)',
          '~solemn~ The night the sky rang, every compass in our harbour swung round the same way. By morning the others had swung back. Mine never did.',
        ],
        choices: [
          { text: '~curious~ So you followed the needle?', goto: 'm1.follow' },
          { text: '~surprised~ Whatever it points at drained my ship.', goto: 'm1.drained' },
        ],
      },
      'm1.follow': {
        say: [
          '~happy~ I took the coins from my aunt’s biscuit tin and went where it pointed. Traders, a postal hulk, a ship full of goats. Whatever was going.',
          '~solemn~ There’s an old line in our harbour book, half eaten by the salt: *where the singing goes*. That’s where I’m going. First.',
          '~playful~ Then they’ll write my name in the book in letters the salt can’t eat.',
        ],
        next: 'm1.ask',
      },
      'm1.drained': {
        say: [
          '~surprised~ Drained it? It only turned my needle. (She writes that down quickly and underlines it twice.)',
          '~curious~ Then you’ve got a better reason to follow it than me. I’ve only got a good one: there’s an old line in our harbour book, *where the singing goes*. I’m going there. First.',
        ],
        next: 'm1.ask',
      },
      'm1.ask': {
        say: ['~curious~ What are you after, out here? Everybody’s after something.'],
        choices: [
          { text: '~neutral~ Something of value.', do: { set: { 'fellow.after': 'value' } }, goto: 'm1.value' },
          { text: '~neutral~ Whatever brought my ship down.', do: { set: { 'fellow.after': 'light' } }, goto: 'm1.light' },
          { text: '~tired~ I’m not sure any more.', do: { set: { 'fellow.after': 'unsure' } }, goto: 'm1.unsure' },
        ],
      },
      'm1.value': { say: ['~playful~ Everybody says that. I want something nobody’s got yet. That’s worth more than value.'], next: 'm1.book' },
      'm1.light': { say: ['~happy~ Then it’s a race. Fair warning: I’m a world ahead, and I don’t sleep much.'], next: 'm1.book' },
      'm1.unsure': { say: ['~curious~ (She looks at you for a long moment.) Is that allowed? Nobody told me that was allowed.'], next: 'm1.book' },
      'm1.book': {
        say: ['~neutral~ Sign my book before you go. Everybody signs, where I’m from. (A few names in a few hands, in a few worlds’ letters. The first page is hers, written large.)'],
        choices: [
          { text: '~happy~ (Sign it.)', do: { set: { 'fellow.signed': true } }, goto: 'm1.signed' },
          { text: '~neutral~ Another time.', goto: 'm1.later' },
        ],
      },
      'm1.signed': { had: 1, say: ['~happy~ There. Now if the salt gets me, somebody will know I got this far.', '~playful~ See you a world on. I’ll be there first.'] },
      'm1.later': { had: 1, say: ['~playful~ Next world, then. I’ll be there first. I always am.'] },
      again1: {
        say: [
          { world: 'arzach', text: '~whisper~ They keep shushing me here. I’ve learned their word for sorry. It’s a nod. (She nods at you, very sorry.)' },
          { world: 'perdide', text: '~curious~ The lamp-keeper in the wood asked if I was the traveller he keeps the lamps for. I said probably not. He lit one anyway.' },
          { world: 'incal', text: '~playful~ Nobody up here looks up. I’ve been doing it for them. My neck hurts.' },
          { world: 'bazaar', text: '~playful~ Everybody here is selling something. I tried to sell my book. Nobody wanted the names.' },
          '~neutral~ I learn three words first in every world: water, sorry, and which way. You’d be surprised how far they go.',
        ],
      },

      // ---------------------------------------------------------------- 2. the needle stops
      m2: {
        meet: 2,
        say: [
          { world: 'arzach', text: '~tired~ (Tansy stands hugging her coat round herself. Nobody here has said a word to her in days, and it shows.)' },
          { world: 'perdide', text: '~tired~ (Tansy stands hugging her coat round herself in the twilight under a fungus tree. The compass lies open in her palm.)' },
          { world: 'incal', text: '~tired~ (Tansy stands hugging her coat round herself in the wind off the shaft. The compass lies open in her palm.)' },
          { world: 'bazaar', text: '~tired~ (Tansy stands hugging her coat round herself, the compass open in her palm. All round her a thousand signs are shouting.)' },
          { if: is('fellow.after', 'value'), text: '~playful~ Found your something of value yet? (She pats her pockets: a feather, a stone that hums, a twist of water that glows a little less every day.) Pockets full. None of it’s the thing.' },
          { if: is('fellow.after', 'light'), text: '~tired~ Still racing? You’re winning. I stopped.' },
          { if: is('fellow.after', 'unsure'), text: '~solemn~ You said you weren’t sure any more. I’ve thought about that every night since. I think I’m not either.' },
          '~sad~ (The needle turns slowly round, and round, and doesn’t settle.) It’s stopped pointing. And the goat ship I came on left this morning. Without me, it turns out.',
          '~solemn~ Thirty-one days since the harbour. Hesper doesn’t know where I am. All I left her was a line in the harbour book: *Gone where the singing goes.*',
          '~curious~ How long since you were home?',
        ],
        choices: [
          { text: '~sad~ Too long.', goto: 'm2.ask' },
          { text: '~neutral~ That’s not really what you’re asking.', goto: 'm2.ask' },
        ],
      },
      'm2.ask': {
        say: ['~solemn~ (She nods, as if that were an answer. Perhaps it was.)', '~curious~ Should I send word home? Or is that giving up?'],
        choices: [
          { text: '~solemn~ Send word. Tonight.', do: { set: { 'fellow.advice': 'write' } }, goto: 'm2.write' },
          { text: '~neutral~ You’ve come this far. Keep going.', do: { set: { 'fellow.advice': 'go' } }, goto: 'm2.go' },
          { text: '~neutral~ That’s yours to decide.', do: { set: { 'fellow.advice': 'self' } }, goto: 'm2.self' },
        ],
      },
      'm2.write': { had: 2, say: ['~sad~ (She is quiet a moment.) Hesper will be so angry. (She smiles, a little.) She’ll be so angry.', '~neutral~ All right. I’ll write it, and find somewhere that sends things. Thank you. I think.'] },
      'm2.go': { had: 2, say: ['~happy~ That’s what I hoped you’d say. (She snaps the compass shut.) It’ll point again. It always does in the end.', '~playful~ Race you to the next world.'] },
      'm2.self': { had: 2, say: ['~angry~ That’s what everybody says when they won’t say. (She kicks at the ground.)', '~tired~ Fine. It is. I’ll decide. I’m very good at deciding. I decided to come out here, didn’t I?'] },
      again2: {
        say: [
          { if: is('fellow.advice', 'write'), text: '~neutral~ I’ve written the first line eleven times. *Dear Hesper* is fine. It’s the next bit.' },
          { if: is('fellow.advice', 'go'), text: '~playful~ The needle moved! A little. That way, probably.' },
          { if: is('fellow.advice', 'self'), text: '~tired~ I’m deciding. Leave me to it. Thank you for asking.' },
          { if: not({ flag: 'fellow.advice' }), text: '~tired~ (She is watching the needle go round.) It’ll stop somewhere. Everything does.' },
        ],
      },

      // ---------------------------------------------------------------- 3. looking up
      m3: {
        meet: 3,
        say: [
          { world: 'arzach', text: '~solemn~ (Tansy stands with her head tipped right back, looking up at the haze where the great bird flies.)' },
          { world: 'perdide', text: '~solemn~ (Tansy stands with her head tipped right back, looking up past the glowing caps at the twilight that never quite ends here.)' },
          { world: 'incal', text: '~solemn~ (Tansy stands with her head tipped right back. High over the shaft the Lodestar turns.)' },
          { world: 'bazaar', text: '~solemn~ (Tansy stands with her head tipped right back, looking up at the dishes while the market shouts round her.)' },
          { if: is('fellow.advice', 'write'), text: '~sad~ I wrote it. (A folded letter, soft from her pocket.) I haven’t sent it. Every word I wrote is the wrong one.' },
          { if: is('fellow.advice', 'write'), text: '~solemn~ (She reads you the start.) *Hesper. I’m alive. I’m sorry about the biscuit tin. I’m sorry about the note. I saw a bird nearly as big as a ship.* It goes on about the bird for a page.' },
          { if: is('fellow.advice', 'go'), text: '~happy~ My needle came back! (It points up and away, and shivers in threes.) Two worlds since I saw you. I’m nearly there. I can feel it.' },
          { if: is('fellow.advice', 'go'), text: '~tired~ I talk to the compass now. It’s a terrible listener. It only ever points.' },
          { if: is('fellow.advice', 'self'), text: '~neutral~ I made up my own mind, like you said. Then I made it up again. Eleven times so far.' },
          { if: is('fellow.advice', 'self'), text: '~solemn~ I wrote a letter and didn’t send it. I bought passage home and sold it back. I’m very good at deciding. I just keep doing it.' },
          '~curious~ Who’s waiting for you? Back home?',
        ],
        choices: [
          { text: '~sad~ Nobody. Not any more.', do: { set: { 'fellow.told': 'nobody' } }, goto: 'm3.nobody' },
          { text: '~neutral~ Someone I didn’t say goodbye to.', do: { set: { 'fellow.told': 'someone' } }, goto: 'm3.someone' },
          { text: '~neutral~ I’d rather not say.', do: { set: { 'fellow.told': 'quiet' } }, goto: 'm3.quiet' },
        ],
      },
      'm3.nobody': { say: ['~sad~ (She doesn’t say anything for a while. Then she bumps her shoulder against yours.) Sorry.'], next: 'm3.look' },
      'm3.someone': { say: ['~solemn~ Me too. (She looks at her hands.) That’s the worst way to leave. You keep on leaving, every day after.'], next: 'm3.look' },
      'm3.quiet': { say: ['~playful~ Fair. I’d rather not say lots of things. I say them anyway. It’s a problem.'], next: 'm3.look' },
      'm3.look': {
        say: [
          { world: 'incal', text: '~solemn~ A sweeper up here told me a light nobody looks at goes out. (She looks up at the Lodestar a long time.)' },
          { world: 'arzach', text: '~solemn~ The bird keeps to the sky because nobody called her down, they say. (She looks up at the haze a long time.)' },
          { world: 'perdide', text: '~solemn~ The lamp-keeper in the wood keeps his lamps lit for travellers who never come. Forty years. (She looks toward the wood a long time.)' },
          { world: 'bazaar', text: '~solemn~ They say the silent tower was the only one here that told the truth. (She looks up at it a long time.)' },
          '~solemn~ At home we say the salt eats every name in the end, if nobody reads it. Do you think Hesper still reads mine? At night, when she does the book?',
        ],
        choices: [
          { text: '~solemn~ Every night. Go and show her you’re still here.', do: { set: { 'fellow.heart': 'home' } }, goto: 'm3.home' },
          { text: '~neutral~ Find where it goes first. Then you’ll have something to show her.', do: { set: { 'fellow.heart': 'on' } }, goto: 'm3.on' },
        ],
      },
      'm3.home': { had: 3, say: ['~sad~ (She blinks hard, and laughs at herself for it.) Every night. Yes. She would, wouldn’t she.', '~neutral~ One more world. I want to see one more. Then home. I mean it this time.'] },
      'm3.on': { had: 3, say: ['~happy~ Yes. That’s it. You can’t go home with empty pockets, can you? Not after all this. (She bounces on her toes.)', '~playful~ One more world, and I’ll know where it goes. Race you.'] },
      again3: {
        say: [
          { if: is('fellow.heart', 'home'), text: '~neutral~ One more world. I promised myself. And you, I suppose.' },
          { if: is('fellow.heart', 'on'), text: '~happy~ Nearly there. I can feel it in the needle.' },
          { if: not({ flag: 'fellow.heart' }), text: '~solemn~ (She is still looking up.) Go on. I’ll catch you up.' },
        ],
      },

      // ---------------------------------------------------------------- 4. something to show (home)
      'm4.home': {
        meet: 4,
        say: [
          { world: 'bazaar', text: '~happy~ (Tansy is waiting under the market’s dishes with her book under her arm. She waves with her whole arm and doesn’t make it smaller.)' },
          { world: 'arzach', text: '~happy~ (Tansy is waiting near your ship with her book under her arm. She waves with her whole arm, and this time she doesn’t make it smaller.)' },
          { world: 'perdide', text: '~happy~ (Tansy is waiting under a fungus tree with her book under her arm. She waves with her whole arm.)' },
          { world: 'incal', text: '~happy~ (Tansy is waiting on the rim with her book under her arm. She waves with her whole arm.)' },
          { world: 'bazaar', text: '~happy~ I bought a minute on one of the towers. It cost everything left in Hesper’s biscuit tin, and my boot laces. (She shows you: no laces.)' },
          { world: 'bazaar', text: '~solemn~ I said: *Hesper, it’s Tansy. I’m coming home. Keep the lamp lit.* Then I told her about the bird. That used most of the minute.' },
          { notWorld: 'bazaar', text: '~happy~ There’s a postal hulk going near the harbour. My passage cost everything left in Hesper’s biscuit tin, and my boot laces. (She shows you: no laces.)' },
          { notWorld: 'bazaar', text: '~solemn~ I sent a letter on ahead: *Hesper, it’s Tansy. I’m coming home. Keep the lamp lit.* Then a page about the bird.' },
        ],
        next: 'm4.compass',
      },
      'm4.compass': {
        had: 4,
        do: [{ set: { 'fellow.end': 'home' } }, { give: 'saltcompass' }],
        say: ['~neutral~ Here. (She lifts the compass off over her head and puts it in your hand. The needle points up and away, and shivers in threes.) I know where I’m going now. You still need it.'],
        choices: [
          { if: not({ flag: 'fellow.signed' }), text: '~happy~ (Sign the last page of her book.)', do: { set: { 'fellow.signed': true } }, goto: 'm4.signed' },
          { if: not({ flag: 'fellow.signed' }), text: '~neutral~ Keep the page for someone else.', goto: 'm4.bye' },
          { if: { flag: 'fellow.signed' }, text: '~happy~ Safe home, Tansy.', goto: 'm4.kept' },
        ],
      },
      // ---------------------------------------------------------------- 4. something to show (on)
      'm4.on': {
        meet: 4,
        say: [
          { world: 'bazaar', text: '~happy~ (Tansy is waiting under the market’s dishes with her book under her arm. She waves with her whole arm and doesn’t make it smaller.)' },
          { world: 'arzach', text: '~happy~ (Tansy is waiting near your ship with her book under her arm and her pack on her back.)' },
          { world: 'perdide', text: '~happy~ (Tansy is waiting under a fungus tree with her book under her arm and her pack on her back.)' },
          { world: 'incal', text: '~happy~ (Tansy is waiting on the rim with her book under her arm and her pack on her back.)' },
          { world: 'bazaar', text: '~happy~ This is where the charts stop. Past the market nobody’s drawn anything. (She taps her book.) Except me, soon.' },
          { notWorld: 'bazaar', text: '~happy~ My needle points somewhere no chart goes. Past the last world anybody’s drawn. (She taps her book.) I’ll draw it.' },
        ],
        next: 'm4.letter',
      },
      'm4.letter': {
        had: 4,
        do: [{ set: { 'fellow.end': 'on' } }, { give: 'saltletter' }],
        say: [
          '~solemn~ Will you take this to my aunt? Hesper, at the Salt Harbour. (A page torn from her book, folded small.) It says where I went, and that I’m well. And the bit about the bird.',
          '~neutral~ I’m keeping the compass. Sorry. I still need it.',
        ],
        choices: [
          { if: not({ flag: 'fellow.signed' }), text: '~happy~ (Sign the last page of her book.)', do: { set: { 'fellow.signed': true } }, goto: 'm4.signed' },
          { if: not({ flag: 'fellow.signed' }), text: '~neutral~ Keep the page for someone else.', goto: 'm4.bye' },
          { if: { flag: 'fellow.signed' }, text: '~solemn~ I’ll take it to her.', goto: 'm4.kept' },
        ],
      },
      'm4.signed': { say: ['~happy~ There. Me on the first page, you on the last. The salt can have the harbour’s book. This one stays with me.'], next: 'm4.bye' },
      'm4.kept': { say: ['~happy~ Your name’s in my book, from that first world. The salt can have the harbour’s. This one stays with me.'], next: 'm4.bye' },
      'm4.bye': {
        say: [
          { if: is('fellow.told', 'someone'), text: '~solemn~ And you. Go and say goodbye to your someone. Properly. Or hello. Whichever one it is.' },
          { if: is('fellow.end', 'home'), text: '~playful~ If you’re ever at the Salt Harbour, come and eat with us. Hesper will shout at me the whole time. Come anyway.' },
          { if: is('fellow.end', 'on'), text: '~playful~ Race you. (She grins.) You’ll lose. I’ll tell you all about it.' },
        ],
      },
      again4: {
        say: [
          { if: is('fellow.end', 'home'), text: '~happy~ Go on, then. I’ve got a hulk to catch, and no laces to catch it in.' },
          { if: is('fellow.end', 'on'), text: '~playful~ Still here? I’m going. I’m going. I’m only looking at it first.' },
        ],
      },
    },
  },
};

/** Hesper's word, in the Salt Harbour, once Tansy has gone home or on (src/levels/salt-harbour.js: her listen). */
export const HESPER_AFTER = [
  { if: { flag: 'item.saltletter' }, after: { flag: 'item.saltletter' }, say: [
    '~surprised~ (Hesper unfolds the page. Her hand goes to her mouth.) That’s Tansy’s writing. That’s my niece.',
    '~sad~ *Gone where the singing goes.* She took my biscuit tin. (She reads on, and laughs once, wetly.) A bird nearly as big as a ship.',
    '~solemn~ I’ll put it in the book, after her line. Thank you for carrying it.',
  ], do: { set: { 'item.saltletter': 0, 'fellow.letter.given': true } } },   // (the letter out of his bag: its item flag, as quests.take leaves it)
  { if: { flag: 'fellow.end', is: 'home' }, after: { flag: 'fellow.end', is: 'home' }, say: [
    '~happy~ You’re the one she talks about. My niece came home on a postal hulk with no laces in her boots.',
    '~playful~ I shouted for an hour. Then I made soup. Sit. Eat. She’ll tell you about the bird.',
  ] },
];

/** Home: once she has gone home, Tansy is at the Salt Harbour beside Hesper's book (src/story/fellow.js). */
export const HOME = { world: 'saltharbour', at: [-5.5, -13], heading: -2.2 };
export const HOME_TALK = { listen: [
  { after: () => true, say: ['~shout~ You came! Hesper! Hesper, it’s them! (From the book, Hesper shouts something back.)', '~happy~ She says sit. She says it like that to everybody. It means she likes you.'] },
  '~playful~ I’ve told everyone about the bird. Twice. They’ve started leaving when I start.',
  '~solemn~ I wrote my name in the harbour book again, under the old line. Bigger this time. The salt will have to work for it.',
  '~curious~ Does the compass still point? (She nods before you answer.) Good. It knows where it’s going. One of us should.',
  { if: { flag: 'fellow.told', is: 'someone' }, say: '~curious~ Did you say it? Goodbye, or hello? (She waits.) You don’t have to tell me. I only hope you did.' },
] };
