// The rumours' lines (issue #340, src/story/rumours.js): what the people outside the quests say of a thing near them not
// yet found, world by world, in their own voice. Every line carries a tone (src/story/tone.js; tests/tone.test.js).
// Filled in by rumourLine (src/story/rumours.js); each said line fits 120 characters (tests/rumours.test.js):
//
//   {where}  a fragment's place, in their words (src/story/rumour-places.js), with its landmark: "on a ledge with a long drop, north of the salt pan"
//   {dir}    which way from the speaker: "north-west of here", or "close by"; {Dir} the same, capitalised
//   {way}    the compass word alone: "north-west" (Vael's people point)
//   {place}  a place to stop for (the level's sights): "the giant’s hand"; {Place} capitalised
//   {who}    a game's host, named and placed: "Yusra, who fishes the basin,"; {Who} capitalised
//   {host}   a host that is a thing (a makers' post, a buoy): "the makers’ post"
//
// Each world's own word for the night the light went over (lore/voice-guide.md): the night the light passed (Qanat,
// the Glass Dunes), the night the sky rang (the City-Shaft), the night every sign showed the mark (the Signal Market),
// the night the whales went quiet (the Underwater City), the night the singing went over (the Moon Foundry), the night
// the cables sang (the City Floating in Space), the night the pools went dark (the Deep Wood). Vael hardly speaks: its
// people point, hum and mime (parenthesised, silent). A witness says what they heard, never what the fragments are.

export const RUMOUR_LINES = {
  desert: {
    fragment: [
      '~whisper~ Something sings {where}. Has since the night the light passed. The pilgrims walk round it.',
      '~curious~ There’s a hum {where}. Not the wind. The wind doesn’t keep a tune.',
      '~playful~ A pilgrim swears a star fell {where}. Hums, she says. She swears a lot of things.',
    ],
    host: [
      '~happy~ {Who} has a game going {dir}. Half the camps have lost a bet there.',
      '~curious~ Tired of walking? {Who} plays for chimes and pride, {dir}.',
    ],
    sight: [
      '~curious~ Seen {place} yet? {Dir}. Worth the sand in your boots.',
      '~solemn~ Go and stand by {place} once, {dir}. The old pilgrims did.',
    ],
  },
  arzach: {
    fragment: [
      '~curious~ (A finger points {way}, then cups an ear. Something sings {where}.)',
      '~whisper~ (A small star drawn in the dust. Then a finger points {way}: {where}.)',
      '~playful~ (Three hummed notes, and a nod {way}. Something {where} hums them too.)',
    ],
    host: [
      '~happy~ (A grin and a nod {way}. {Who} keeps a game there. Hands mime winning.)',
      '~playful~ (Two fingers race across a palm, then point {way}. {Who} plays there.)',
    ],
    sight: [
      '~solemn~ (A slow point {way}, at {place}. Then a hand on the heart: go.)',
      '~curious~ (Fingers walk through the air toward {place}, {way}. Eyebrows up: seen it?)',
    ],
  },
  perdide: {
    fragment: [
      '~whisper~ A little light hums {where}. The herons won’t nest by it.',
      '~curious~ Since the night the pools went dark, something’s glowed {where}. Lamps don’t sing. That does.',
      '~neutral~ The punters steer round a hum {where}. Can’t see it from a boat. Maybe on foot.',
    ],
    host: [
      '~happy~ {Who} keeps a game {dir}. Better than waiting for the water to drop.',
      '~playful~ Wet feet anyway? Then go and lose to {who} {dir}.',
    ],
    sight: [
      '~curious~ Ever poled out to {place}? {Dir}. Go while the lamps are lit.',
      '~whisper~ {Place}, {dir}. The old keepers liked it there.',
    ],
  },
  edena: {
    fragment: [
      '~curious~ Something glitters {where}. Hums like the seed-drill. Nobody planted it.',
      '~happy~ The bees go mad {where}. There’s a little light there that sings, they say.',
      '~neutral~ I heard humming {where}. Not mine. I hum flat.',
    ],
    host: [
      '~happy~ {Who} has a game {dir}. A break from the weeding.',
      '~playful~ Hands need a rest from the soil. {Who} keeps a game {dir}.',
    ],
    sight: [
      '~curious~ Seen {place}? {Dir}. The builders left it. We water round it.',
      '~solemn~ Walk up to {place} one evening, {dir}. It’s why we stayed.',
    ],
  },
  underwater: {
    fragment: [
      '~whisper~ Since the night the whales went quiet, something hums {where}. Divers swim round it.',
      '~curious~ A light sits {where}. It isn’t a lamp. The fish all face it.',
      '~neutral~ Divers’ gossip: a little light {where}. Sings in threes. Bring your helmet.',
    ],
    host: [
      '~happy~ {Who} runs a game {dir}. Dry hands optional.',
      '~playful~ Tired of the café? {Who} keeps a game {dir}.',
    ],
    sight: [
      '~curious~ Been out to {place} yet? {Dir}. Mind your air.',
      '~solemn~ {Place}, {dir}. Worth the swim.',
    ],
  },
  incal: {
    fragment: [
      '~playful~ Since the night the sky rang, something’s rung {where}. Nobody up here bends down to look.',
      '~whisper~ The lamplighters say a little light sings {where}. They’d know. Lights are their trade.',
      '~neutral~ A cab swore something hums {where}. Charged me extra for the story.',
    ],
    host: [
      '~playful~ {Who} keeps a game {dir}. Free, which up here is suspicious.',
      '~neutral~ Between cabs? {Who} has a game going {dir}.',
    ],
    sight: [
      '~curious~ Seen {place}? {Dir}. Even the rim goes down to look.',
      '~tired~ {Place}, {dir}. Tourists love it. Go on, be a tourist.',
    ],
  },
  glassdunes: {
    fragment: [
      '~curious~ A splinter of light sits {where}. It wasn’t there before the night the light passed.',
      '~whisper~ When the wind drops, the carriers hear a note {where}. It isn’t the glass.',
      '~neutral~ Something sings {where}. The float-blowers tune their pipes to it.',
    ],
    host: [
      '~happy~ {Who} has a game {dir}. Good for the hours the wind won’t blow.',
      '~playful~ Sand in everything anyway. {Who} keeps a game {dir}.',
    ],
    sight: [
      '~curious~ Seen {place}? {Dir}. The glass keeps it as it was.',
      '~solemn~ Stand by {place} a while, {dir}. Nothing moves there. That’s the point.',
    ],
  },
  buried: {
    fragment: [
      '~whisper~ Something hums {where}. Not the machine. The machine hums lower.',
      '~curious~ Put your ear to the pipes {where}. Something there sings in threes, and pipes don’t.',
      '~playful~ The ten-teeth-olds dare each other to touch the singing thing {where}. Nobody has.',
    ],
    host: [
      '~happy~ {Who} keeps a game {dir}. Something to do while the wheel thinks.',
      '~playful~ The wheel won’t turn today. {Who} plays {dir}, though.',
    ],
    sight: [
      '~curious~ Been to {place}? {Dir}. Put your ear to the wall there.',
      '~solemn~ {Place}, {dir}. Go on Tooth Day, or any day.',
    ],
  },
  moonfoundry: {
    fragment: [
      '~neutral~ Since the night the singing went over, a bit of it rings {where}. Like a casting cooling.',
      '~curious~ Something sings {where}. We checked: none of our moulds.',
      '~whisper~ Between shifts, the pourers hear a note {where}. Three notes. Then quiet.',
    ],
    host: [
      '~happy~ {Who} has a game {dir}. Good for the hands between pours.',
      '~playful~ Off shift? {Who} keeps a game {dir}.',
    ],
    sight: [
      '~curious~ Seen {place}? {Dir}. Best thing we ever cast. Or broke.',
      '~solemn~ Go and see {place}, {dir}. Every caster does, once.',
    ],
  },
  spheres: {
    fragment: [
      '~happy~ Something new hums {where}. We didn’t plant it. We’re letting it grow.',
      '~curious~ The garden sings {where}. Three notes, then it waits.',
      '~playful~ Ume says the little light {where} is a present. Ume says that about everything.',
    ],
    host: [
      '~happy~ {Who} keeps a game {dir}. The garden can tend itself an hour.',
      '~playful~ Done tending? {Who} has a game {dir}.',
    ],
    sight: [
      '~curious~ Seen {place}? {Dir}. Take your time there.',
      '~solemn~ {Place}, {dir}. Go in the morning, with the dew on it.',
    ],
  },
  spacecity: {
    fragment: [
      '~whisper~ Since the night the cables sang, one little note stayed behind {where}.',
      '~curious~ The moorers hear humming {where}. Not a cable. Cables don’t hum in threes.',
      '~neutral~ Something sings {where}. Hold the rail if you go. The void doesn’t care.',
    ],
    host: [
      '~happy~ {Who} keeps a game {dir}. Bring both feet back.',
      '~playful~ Off the ropes? {Who} has a game {dir}.',
    ],
    sight: [
      '~curious~ Seen {place}? {Dir}. Hold on to something.',
      '~solemn~ {Place}, {dir}. Go when the lamps come on.',
    ],
  },
  bazaar: {
    fragment: [
      '~playful~ Free tip, no charge: something sings {where}. Not one of ours. Ours charge.',
      '~whisper~ Since the night every sign showed the mark, a little light hums {where}. No plug.',
      '~curious~ The radio-menders pick up a note {where}. No station. Just three notes.',
    ],
    host: [
      '~happy~ {Who} runs a game {dir}. Cheapest show in the market: free.',
      '~playful~ Tired of shopping? Impossible. Anyway, {who} has a game {dir}.',
    ],
    sight: [
      '~curious~ Seen {place}? {Dir}. Even the screens go quiet there.',
      '~shout~ {Place}! {Dir}! No charge for looking!',
    ],
  },
};

/** A host that is a thing (a makers' post, a buoy): any world. */
export const RUMOUR_OBJECT_LINES = [
  '~neutral~ There’s {host} {dir}. Read it if you like a dare.',
  '~curious~ Seen {host} {dir}? Something to play, they say.',
];

/** The map's short name for a rumour of a fragment (a sight's or a host's is its own). */
export const RUMOUR_FRAGMENT_LABEL = 'Something singing, they say';
