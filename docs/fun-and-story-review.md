# What would make Hiraeth more fun, and its story more engaging (October 2026)

A review of the game as built (the code, `docs/story-audit.md`, `docs/game-brief.md`, the story
bible), not a list of bugs: the October story audit already fixed the soft-locks, contradictions and
missing payoffs. This is about the shape of the experience. Recommendations are ranked at the end.

## What is already strong

- **The emotional core.** A son trying to make his parents proud after the fact, recordings that never
  answer, a daughter he left behind waiting at home, everything set down on the stone. That is a real
  ending, and the reel's slow reveal (old recordings, then dead parents, then Ilen) is a good engine.
- **Every world has a full set:** a main quest ending in a keepsake, two side quests, an errand to the
  next world, five relics, a temple with a gadget and a guardian, a reel line, a closing page.
- **Gentle, readable verbs:** climbing, the fluid tool (shoot, push, boost), wings, jets, the bird, the
  skiff, the bike, self-driving cabs. Guardians you calm rather than kill. It fits the Moebius tone.
- **Worlds people live in:** about 20 named people in the desert, crowds in the City-Shaft and the
  market, a translator that lets each world speak its own tongue.

## The six problems that matter most

### 1. Most players will reach the ending before the story's best parts

Home opens after **any six** route worlds (`ENDING_WORLDS = 6`, `src/story/ending.js`). The route
shows the next two unfinished worlds, so a player who goes straight on is choosing among the first
seven. As a result, a player can finish the game:

- without the **jets** (the City-Shaft, world 7), which are the most exhilarating verb in the game;
- without the **Signal Market** (world 11), which holds the biggest revelation: the father's
  30-year-old broadcast to **Ilen**, a sister the traveller never knew. The relay signal (from four
  worlds) hints at it, but the market itself is still last on the route;
- without the **Hangar's coordinates → Buried Machine** thread, the clearest "clue leads to the next
  world" chain in the game.

The ending is strong, but it arrives at roughly the halfway point of the content, and the reveal that
reframes the family (Ilen) is optional and late. A story that peaks after its own ending loses most
players at the wrong moment.

### 2. The central mystery never pays off

The **singing light** that struck the ship is the game's question: it shows up in nearly every world
(Dalia heard it, Oum and Oïa saw it, Odile and Talo were struck twice, Lorn's crystal sings its
phrase, the glyph is scorched into the hull). By design "it is never explained", and the bible leaves
the makers' link open.

A mystery planted in eleven worlds needs an answer, or at least a confrontation. Right now the player
gathers clues that lead nowhere, and the route's in-game reason (the strike's magnetic signature)
makes the light the reason the whole journey exists. There is an obvious, moving connection on the
table that the story hasn't used: **Ilen left home, the father broadcast to her, and a light that
"knew the makers' sign" was "looking for something"**. Whether the light *is* Ilen, carries her, or
is something she sent, tying the two threads together would turn eleven scattered sightings into one
story with a destination.

### 3. The traveller's choices don't shape anything

Nearly every choice is the order you hear things in. The two that carry forward are small: whether
your keepsakes are things or quieter gifts (it shifts the recordings' lines), and asking the reel about
Ilen. The only "consequence" is Viridel's tea terraces, which **fail whatever you do**: a strong idea,
but it teaches the player that their choices don't matter rather than that some things can't be saved.

For a story about "what counts as something of value", the player should sometimes have to decide:
give a keepsake away to someone who needs it more, take someone home vs. leave them, keep a promise
that costs something. A handful of real decisions (two or three across the route), each echoed at the
stone, would make the ending the player's own.

### 4. The worlds are islands

Each world's cast lives and dies inside it. What connects them is light: errands (a parcel to a named
person in the next world, then done), the bird, Odile and Talo (whose story the route tells backwards:
the saucer in Lorn II comes before their ship and log in Viridel), the Major's coordinates, Teo's drum
echoing in the spheres. The detour worlds borrow route characters as cameos, which is the only place
the casts meet.

What's missing is **one person who travels too**: a rival or a fellow seeker following the same light,
met three or four times along the route, whose own story changes because of what you did. That is the
cheapest way to make a sequence of worlds feel like a journey.

### 5. Low challenge, and the best tools mostly live inside temples

- **Nothing is ever lost:** a hit never takes a healthy bar below 8%, a knockout resets only the current
  phase, the drone always points at the objective (and gives three hints a phase in a fight), and only
  one quest can fail (by design).
- **The temple kit stays in the temples:** updrafts, gusts, swings, jaws, timed eye banks, echo and
  note puzzles appear only in temple rooms. The open world's quests are mostly talk, walk, splash, push.
- **Tools that don't matter after their temple:** stilling mode and most charms (hush-cloth, scarf,
  resin, reed, soles) are comfort passives with no use outside their own world.
- **Vehicles built for one world:** the hoverbike (desert), the skiff (Lorn), gravity portals (the
  Hangar), the observatory (desert).

The result is a calm game where mastery has nowhere to show. It doesn't need to be hard; it needs
**optional** places where the verbs combine and skill is rewarded: a wing-and-wind run in Vael, a jet
route up the City-Shaft against the clock, a bird race, a bike run, a temple-style puzzle in the open
that uses three tools at once.

### 6. Pacing: a long first world, then short ones, with empty stretches

- **The desert is 3–4× longer than any other world:** the main quest is 40–45 minutes (1.5–2 h for
  everything), with three "talk to X" stages in a row and a 1.6 km ride to the Hearth and back. Every
  later main quest is 8–20 minutes. The first hour is where players decide whether to keep playing.
- **The audit's sags are mostly empty travel:** Vael's 2.6 km plain, Vael II's peach plain, Lorn's
  skiff leg back, the City-Shaft's walk back, the Buried Machine's 330 m climb back, the Garden of
  Spheres' back-and-forth. Backtracking without anything new on the way is the commonest boredom.
- **Few staged moments:** only two filmed moments exist, both in the desert. The climaxes (the bird
  coming down, the bell ringing, the wheel turning, the broadcast) deserve to be seen, framed and felt.

## Smaller things worth doing

- **The eleven detour worlds** (the Mangrove, the Glass Dunes, the Eclipse, the Moon Foundry…) are
  beautiful and empty: a viewpoint page, 4–9 people with flavour lines, no relic, box or reason to
  stay. Each could hold **one small trace of the singing light or of Ilen** (a mark, a person who met
  her, a recording fragment). That turns tourism into a side mystery without writing twelve quests.
- **Rewards that change play:** after the core tools the item drip is mostly passives. Fewer, more
  visible upgrades (a longer jet burn, a fluid mode with a new verb) beat many quiet ones. The tank's
  colour bands (one per world's source) are a lovely record of the journey: make sure the player
  notices each new band when it arrives.
- **Let the drone guide less, on request:** an option where it only points when pinged would give
  exploration back to players who want it.
- **The Atelier** has no path in. Either cut it or make it the post-game secret.

## Recommendations, ranked

1. **Move the story's peak before the ending.** Either open Home only after the Signal Market (or after
   Ilen is known), or make the ending at six a "first homecoming" with a final chapter afterwards.
   Whichever, a player who sees the credits should have heard of Ilen and flown with the jets.
   *Cost: low to medium (route and ending rules, the relay, tests). Biggest effect per hour of work.*
2. **Answer the singing light, and tie it to Ilen.** Decide what it is; let the last stretch go and
   find it (a final world, or Home's sky). This gives the whole route a destination. *Cost: a writing
   decision for the author first, then one world's worth of content.*
3. **Add a fellow traveller who recurs.** Three or four meetings along the route, each changed by what
   you did last time, ending at the stone or the final chapter. *Cost: medium: dialogue and a few
   placements in existing worlds.*
4. **Add two or three real choices with consequences at the stone.** Keep Viridel's loss, but make it
   one of several decisions rather than the only one. *Cost: medium.*
5. **Tighten the desert's first hour.** Merge the three talk stages, put something on the Hearth ride
   (or shorten it), and get the backpack and the first fluid moment in the first 10 minutes. *Cost: low.*
6. **Optional mastery challenges in the open world,** built from the temple kit and the vehicles:
   one per world, rewarded with a relic or a visible upgrade. *Cost: medium, can be done world by world.*
7. **Stage each world's climax as a moment** (the existing desert moment system). *Cost: low per world.*
8. **One trace of the light or Ilen in each detour world.** *Cost: low per world.*

Before building any of these, a short playtest with two or three people who haven't seen the game
would tell which problems they actually feel: where they stop, what they skip, whether they reach Home
before the market. The play-through test proves the game can be finished; it doesn't say whether
people want to.
