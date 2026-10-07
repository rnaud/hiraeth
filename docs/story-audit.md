# Story audit, October 2026

This audit covers all thirteen levels. Eleven are worlds on the route. Home is the twelfth. The Atelier is a hidden developer page.

For each world it sets the beat the bible asks for against what a player can do today. It lists what is thin or broken and how the world is paced. Each section ends with what the October 2026 story pass fixed and what is still open. The ranked additions and the proposals for the author come last.

## How it was checked

- **The node play-through** (`tests/playthrough.test.js`, run with `PLAYTHROUGH_VERBOSE=1`). It plays every main quest on the route from a new game through to the stone at home. It reports no soft-lock, no step without a target and nothing out of reach. The verbose log gives each stage's place, and the distances below come from it.
- **The browser pass** (`scripts/playthrough-browser.mjs`) runs in a headless, muted Chrome against a dev server. Before the pass 25 of its 26 checks passed; after it, all 26. The one failure was a real story bug: in Vael, an older save that already had the wings got sent by the drone to the Aerie, not to Oïa. That is now fixed and tested in `tests/story-arzach.test.js`.
- **Reading the data.** For every world: the quest data, the people and the temple guide, the errands, the boxes and the signs. Each was read against `docs/story-bible.md`, `lore/` (the voice guide, continuity, the character sheets) and the recent changes:
  - cabs drive themselves;
  - the leather glove and the glass flask in the rucksack;
  - the game menu in place of the sketchbook and journal;
  - pad prompts in Xbox / PlayStation form.
- **Out-of-order play.** Each side quest's giver, payoff line and reward was traced through. In five places, doing the steps in a different order than the writer expected locked a quest for good.

## The ten findings that mattered most

1. **Five soft-locks from playing out of order.** A quest stage waits for a flag that only one conversation node sets, and that node becomes unreachable once you have done the thing itself:
   - the desert's channel opened early;
   - Viridel's tallest tree, if Talo's note is read first;
   - the Signal Market, if you meet Kip before Sel;
   - the Garden of Spheres, if all three spheres are heard before Aube;
   - the Buried Machine, if the Wick is lit before Wen or Hask has sent you, and Ossa's gauges, if they are read before you meet her.

   The Market lock cut off the whole Ilen thread. *Fixed, with tests.*
2. **The drone pointed past a world's opening conversation.** The ship lands within 70 m of Vael's Aerie. A temple quest that started as you walked past it was not counted as "started on its own", so it took the drone away from Oïa. *Fixed* (`src/temples/index.js`).
3. **The route puts the Ilen revelation after the ending.** Home opens after six worlds. The Garden of Spheres is charted only after eight and the Signal Market after nine. So the broadcast, the mother's "For when he asks", and the recording lines written for the spheres and the market (`calls.js`) almost never play before the stone. The last recording's "I told your sister…" line cannot play at all. *Proposal for the author.*
4. **Contradictions with the bible's facts.**
   - A camp pilgrim saw "the light that fell" (the light never fell).
   - Ama arrived to find the tree already cold, though every other pilgrim watched it go out.
   - Ysse says Odile and Talo left Lorn "on foot", but they borrowed Fen's skiff.
   - Sol says they left "in the ship", but they left in the saucer.
   - Fen and Hollin call Viridel the couple's "home".
   - Mira's clock "rang this morning" while it was missing its gear.
   - Dov "remembers" Pip being shorter, though he left before Pip was born.
   - The rim says cabs stop for anyone; they stop only for a pass.
   - The Hangar uses Viridel's word "the Singer".
   - Vael II's belfry claims every stone in the world came down, when only the ones round it did.
   - Hask plans to light a wheel that never stopped turning.

   *Fixed.*
5. **Setups with no payoff.**
   - Ossa asks you to tell the palace "we are still down here, and we are still looking", and nobody could hear it.
   - Ondine promises to come when the bell rings, and Ysolde never notices.
   - Ivo's "you'll know where to bring them back" (the jar is never used).
   - Pell sends you to the sleeping mask, and nobody asks how it went.
   - Ilo's monster report.
   - Hask's "tell him I tipped".
   - Oum hands over her cord again on every talk.
   - Mira never reacts to her clock being mended.

   *Fixed*, except the jar, whose line now just lets you keep the fireflies.
6. **Esk's loss.** Esk's quest still read as a technique the player got wrong:
   - "turn the wheel a little";
   - Esk's own "carefully";
   - the player's reply "Gently";
   - a fail outro that misquoted her.

   The words now say what happened, and that nobody knew what the gate would do. The "Failed ✗" presentation in the menu is a proposal (below).
7. **Keyboard-only prompts.**
   - Vael's stone hand ("G, or left click").
   - The City-Shaft's call-lamp.
   - Lorn's skiff whistle ("E").
   - Lorn II's pool.
   - Viridel's clock ("(E)").
   - Ferro's antenna in the market.
   - The desert's empty-tank hint ("G" / "C").
   - The observatory's "E turn lens" and "J sketch".

   *Fixed:* they name the pad's buttons. Mixed prompts that already carry the pad form were left as they were.
8. **The game menu and the new kit.**
   - The hidden-box note still said "your sketchbook says where to look"; it now says the Quests page.
   - The errand toast said "J to see it in the sketchbook"; it now says View on a pad.
   - Lines said "jetpack" for the jets, "on your wrist" for the ember ring, "for the nozzle" for the glove's seed, and a "tank" that clicks into the bike's cradle.
   - Chests were described "with a star on its lid", though the bible says no lid and no seam.

   *Fixed.* No drivers are left anywhere in the game's text. `LORE.md` still had Wren as a driver; that is now fixed too.
9. **One-line people and stale lines.** These people had one or two balloon lines, some of which went stale:
   - in the desert: Rook, Tamsin, the sketcher and the six townspeople;
   - Vael's Hollin;
   - Vael II's Aube, Calix and Ondine;
   - Lorn II's Bram, Pim and Wick;
   - the City-Shaft's Lio and Hask;
   - the Hangar's Nikko and Ferrol.

   The townspeople's "Are you going to open it?" stayed even after the chest was open. *Fixed:* each has two to four lines in their own voice. Also, Hollin stood 290 m from the stone hand he keeps; he now stands beside it.
10. **Errands stopped at the Hangar.** Vael II, the Hangar, the Buried Machine and the Garden of Spheres gave nothing to carry, so the later half had no parcels. Some errand lines also did not land:
    - the taxi token went to "someone";
    - the crystal went to Bram "by the skiff", where he never is;
    - Hollin's feather was "grey", and its thanks spoke of a whistle post that doesn't exist.

    *Fixed:* four new errands by existing people, and tests that every world but the last gives one.

## World by world

Times are for a player who knows where to go: the main quest, then everything in the world.

### The Desert: "The Tree That Drinks"

- **The beat (bible, as built):**
  - The tree is cold and the makers' chest gives an empty tank.
  - Lever the giant's rib off the channel with the keepers' pole.
  - The water fills the pool, the tank and Ama's jar.
  - Nour sends you on Marrow's hoverbike to the Givers' Hearth for the spark-stone.
  - The tree burns and the jar wakes the ship.
  - Keepsakes: "What the giants left" (knowing) and Teo's walking rhythm (song).
  - Clue: the swamp of lights, which leads to Lorn.
- **What there is:**
  - Main quest: 16 stages.
  - Side quests: Teo's drum, Ilo at the skull, Oum home from the dunes, Marrow's bike, the sleeping mask.
  - The Givers' House temple (ember mode).
  - The observatory.
  - Boxes: two in the open, one in the temple.
  - 5 relics and 1 errand.
  - About 20 people with talk, plus the crowd.
- **What was thin:**
  - Opening the channel early (Ilo, Bako and Hessa all point at the giant's mouth) stranded the quest at Nour, the well, Ama or the Speaker.
  - The light "that fell".
  - Ama's timeline.
  - Marrow re-introducing himself on every talk.
  - Oum's cord given again on every talk.
  - The mask and Ilo's monster with no reaction.
  - Stale townspeople lines.
  - The observatory telling a first-world player to "glide home" before the wings exist.
- **Pacing:**
  - The main quest takes about 40–45 min; the whole world 1.5–2 h.
  - It sags in three places:
    - three "talk to X" stages in a row, crossing the gate twice;
    - the 1.6 km ride to the Hearth and back with nothing on the way;
    - the Hearth's stone ball, which repeats the temple's Hall of Weights.
- **Fixed now:**
  - The catch-up for the early channel (`desert.js` `caughtUp`), plus Ama's `lateJar` and a test.
  - The camp line, Ama's night, and Marrow's return greeting.
  - Oum's `after` node.
  - Pell's `washed` node.
  - The Speaker's monster verse.
  - Tone tags: Teo's jokes and Sefa no longer reading his grief.
  - New lines for the townspeople, Rook, Tamsin and the sketcher.
  - The observatory's words and prompts.
  - The bike line.
- **Still open:**
  - The bible's desert section still describes the burning-tree and fill-and-go sequence (`lore/continuity.md` notes the drift).
  - The Hearth has no carving or inscription.
  - The masked head's inner chamber has no words.
  - Oum's cord is never used.

### Vael: "The Waiting Bird"

- **The beat:**
  - Wings from the Aerie, the wind up the lone tower, the rider's flute on the sill.
  - Her call, and the bird chooses to come down.
  - Keepsake: her promise (person).
  - Clue: the sky-stone map, which leads to Vael II.
- **What there is:**
  - Main quest (5 stages).
  - Shed Feathers and the Stone Hand.
  - The Aerie temple (the wings).
  - One box (the hush-cloth on the needle spire).
  - 5 relics.
  - Oïa, Tam, Senn, Hollin and Lark.
- **What was thin:**
  - The drone found the Aerie before Oïa (see finding 2).
  - Hollin was far from his hand.
  - The hand's stage never said the order.
  - Feathers gathered before the call pointed at a bird who isn't there.
  - Chests with lids.
  - Senn's "The bird knows the way?" answered a question nobody had asked.
- **Pacing:** the main quest takes 8–12 min, the world 35–50. The main quest is short once you have the wings, the 2.6 km plain is empty, and the fallen colossus holds only a relic.
- **Fixed now:**
  - The drone.
  - Hollin's place and his lines.
  - The stage's order and buttons.
  - The feathers' marker waits at the balcony while the bird is away.
  - The lids.
  - Senn's choice.
  - The flask.
- **Still open:** the colossus has nothing to look at (a proposal below).

### Vael II: "The Bell Under the Cloud"

- **The beat:**
  - The bell has been silent for thirty years; the clapper "fell up" to the floating island.
  - Ring it and the cloud settles a hand's width.
  - Keepsake: the bell's note (song).
  - Clue: the tower's masked face, which points back to the desert.
- **What there is:**
  - Main quest (6 stages).
  - Ysolde's letter to Ondine (with the signal lamp).
  - Tiv's cairn.
  - The Founders' Belfry temple (bell whistle, the Cloud-Mother).
  - One box (the scarf).
  - 5 relics.
- **What was thin:**
  - Ysolde said Ondine's lamp flashed "three long, one short", which is the signal the toast gives to Ysolde's own light.
  - Ondine's "I'll come when the bell rings" had no answer.
  - The belfry's outro overclaimed what came down.
  - Ysel's "Now somebody has." was ambiguous.
  - Aube's directions said "west" (it is south-west) and gave no button.
  - Tiv's lines read as adult sarcasm.
  - Three people had only two balloon lines.
- **Pacing:** the main quest takes 10–15 min, the world 45–60. It sags on the long empty peach plain on the letter's way.
- **Fixed now:**
  - The signal.
  - Ysolde's supper line after the bell.
  - The belfry's words.
  - Ysel, Aube and Tiv.
  - New balloon lines.
  - The chest's lid.
  - The feather errand's thanks.
  - A new errand out to Lorn: Calix's muffled hand bell for Wendel.
- **Still open:** every Vael II voice ends on a dry quip, so they blur. A pass to vary them is for the author.

### Lorn: "The Great Crystal"

- **The beat:**
  - The crystal sings in the rain.
  - Its 213th phrase matches the singing light; that is Saba's theory, not the narrator's.
  - Keepsakes: the splinter (thing, plus a violet band) and Wendel's "The patient are never eaten" (word).
  - Clue: the fragment theory.
- **What there is:**
  - Main quest (7 stages).
  - Patience in the jaw-bed.
  - Ivo's fireflies, where the eggs hatch.
  - The Hush-House temple (stilling mode).
  - One box (the reed).
  - 5 relics and 1 errand.
- **What was thin:**
  - Ysse's "on foot".
  - Ivo's jar promise.
  - Sedge's keyboard prompt and "go past your chest".
  - "Follow them at dusk" (nothing is gated by time of day).
  - The outro and toast told the theory as fact.
  - The level intro sent you to Saba first, though Wendel opens the quest.
- **Pacing:** the main quest takes 12–15 min, the world about 40. The long skiff leg back west to the cave has nothing on the way.
- **Fixed now:**
  - All of the above.
  - Wendel's double "lighter" joke.
  - The continuity facts hold: the eggs do hatch, the light climbs away, and the couple's fate stays unknown.

### Lorn II: "The Lamps Are Kept"

- **The beat:**
  - Pools kept lit for travellers who never come.
  - Keepsake: Hollin's "come back" (person).
  - Clue: the saucer is Odile and Talo's lifeboat, which points to Viridel.
- **What there is:**
  - Main quest (4 stages, three pools).
  - Pim's latch.
  - Whose skiff.
  - The Lamp-House temple (lantern charm).
  - One box.
  - 5 relics and 1 errand.
- **What was thin:**
  - A keyboard-only pool prompt.
  - The saucer described as "couches", then as "worn seats".
  - Viridel called the couple's "home".
  - Pim's choice "Why not?" didn't follow.
  - Bram had no way back to his skiff question.
  - Wick still said "I'll brighten the lamps ahead" after all of them were lit.
  - One lamp had three names.
- **Pacing:** the main quest takes 10–12 min, the world about 35. There is one backtrack across the water, softened by the shellbacks.
- **Fixed now:** all of the above, plus Tamsy's echoing choice.

### Viridel: "The Garden Grows Over"

- **The beat:**
  - Odile and Talo's ship, let the garden take it.
  - Keepsake: "We tend the garden. The garden tends us." (word).
  - Clue: the same mark on their ship.
  - The quest that fails: Esk's terraces.
- **What there is:**
  - Main quest (8 stages).
  - The pyramid seed.
  - Esk's terraces (fails).
  - Mira's clock (the gear errand).
  - The tallest tree.
  - The Greenhouse temple (bloom mode).
  - One box.
  - 5 relics and 1 errand.
- **What was thin:**
  - The tallest-tree soft-lock (Talo's note can be read at any time).
  - Mira's clock lines.
  - No payoff when the clock is mended.
  - Esk's wording and fail outro (finding 6).
  - Sol's "the ship".
  - Oro's thousand years in one splash, against an outro that says a thousand years to be big.
  - Sorrel's mismatched choices.
- **Pacing:**
  - The main quest takes about 12 min, the world about 50.
  - Five of the eight main stages are look-or-read beats.
  - The four side quests point in four directions with no cross-references.
  - Viridel alone has no closing "Something of value?" toast.
- **Fixed now:**
  - The soft-lock, with a test.
  - Mira's lines, plus her `clockDone` node and a test.
  - Esk's words.
  - Sol, Oro and Sorrel.
  - The clock prompt.
- **Still open:** the closing toast, and the failure's presentation (both proposals).

### The City-Shaft: "The Light Nobody Looks At"

- **The beat:**
  - Carry the Lodestar's splinter and the bottom's message up the whole shaft, and look up.
  - Keepsakes: Nima's "Look up once a day" (word) and Dov's lift token.
  - Clue: the splinter hums Lorn's note.
  - Gift: the jets.
- **What there is:**
  - Main quest (5 stages over about 1.3 km of height).
  - The ration.
  - The cab pass.
  - Wren.
  - The Warden's Well temple.
  - One box.
  - 5 relics and 2 errands.
- **What was thin:**
  - Ossa's message never delivered.
  - Dov and Pip's ages.
  - The rim's "anyone".
  - Hask's tip.
  - Keepsake words that didn't match what Nima said.
  - "jetpack".
  - A keyboard-only lamp prompt.
  - The token errand that named nobody.
  - The glyph described upside down ("beneath the curve").
  - Lio and Hask with one balloon line each.
- **Pacing:** the main quest takes about 20 min, the world 50–60. The return to Nima is a pure walk back, and the middle levels have little to do.
- **Fixed now:** all of the above. Dov now has a node that answers Ossa's message.
- **Still open:** the repeated "eleven" (Pip's seconds, Wren's lamp, Dov's years, a commuter). Decide whether it means something; for the author.

### The Sealed Hangar: "The Major Forgot"

- **The beat:**
  - Carry the signal round the three zones.
  - The Major's note (knowing).
  - Clue: the coordinates of a buried wheel.
- **What there is:**
  - Main quest (4 stages, with its own catch-up).
  - Three machines.
  - Pip's ball.
  - The First Garage temple.
  - One box.
  - 5 relics.
- **What was thin:**
  - The temple guide says "the Singer".
  - Two choices that didn't answer what was said.
  - The page outro misquoted the note as a question.
  - Nikko and Ferrol had one line each.
  - No errand out.
- **Pacing:** the main quest takes about 12 min, the world 35–45. The main quest and the machines both walk the same three-zone tour, and the finale is an empty desk.
- **Fixed now:** all of the above, plus a new errand: Nikko's grease for Tull.

### The Buried Machine: "One Tooth a Year"

- **The beat:**
  - Light the Wick and watch the wheel turn.
  - The warm tooth (thing, plus an amber band).
  - The Maker's Thumb.
- **What there is:**
  - Main quest (9 stages).
  - Dun's key.
  - The gauges.
  - The warm window.
  - The Engine-House temple.
  - One box.
  - 5 relics.
- **What was thin:**
  - Two soft-locks (the Wick lit first; the gauges read first).
  - Hask's plan for a wheel that never stopped.
  - The intro sent you to Hask, but Wen opens the quest.
  - Wen's punchline right after the keepsake.
  - The guide's "forty-one years".
  - No errand in or out.
- **Pacing:** the main quest takes about 20 min, the world 45–55. The 330 m climb back from the oculus to the wheel sags until the pipe-cart runs.
- **Fixed now:** all of the above, with a test. Ossa gives a new errand: the pipe whistle for Aube.
- **Still open:**
  - The wheel now keeps turning, against Wen's "the city settles when the last tooth turns". What that means is for the author.
  - The bible's §9 still says one tooth a year.

### The Garden of Spheres: "What the Spheres Remember"

- **The beat:**
  - Splash three spheres and carry their sounds to Ume's pole.
  - The chord (song).
  - Clue: one sphere remembers the desert's drum.
- **What there is:**
  - Main quest (5 stages over about 1.4 km).
  - The lake's reflection.
  - The slow avenue.
  - The Footprint temple.
  - One box.
  - 5 relics.
- **What was thin:**
  - The Aube soft-lock.
  - Four replies that didn't answer the line before them.
  - The plaza stage named its places out of order.
  - The android wood and the meadow pyramid hold one relic each.
- **Pacing:** the main quest takes 15–20 min, the world about 45. It sags from the chant sphere east to the drum sphere and back west to the arch.
- **Fixed now:** all of the above, with a test. Nell gives a new errand: the lake mirror for Oyo.

### The Signal Market: "You Are Not Alone"

- **The beat:**
  - The silent tower.
  - The father's voice to Ilen.
  - Oyo's lantern band.
  - Keepsakes: "You are not alone" (word) and the quiet ones' hum (song).
- **What there is:**
  - Main quest (5 stages).
  - The oldest sign.
  - Ummu's bowl.
  - The Undertower temple.
  - 5 relics.
- **What was thin:**
  - The Kip soft-lock, which killed the Ilen thread.
  - The keepsake and a crowd line quoted words the broadcast never says.
  - Sel called Ilen "her" before anyone knew.
  - A canal the market doesn't have.
  - Ummu was "she" once and "it" everywhere else.
  - Ferro's keyboard prompt.
  - Two tone tags: the noodle joke was tagged sad, the father's plea happy.
- **Pacing:** the main quest takes 10–15 min, the world about 40. It is compact and doesn't sag.
- **Fixed now:** all of the above, with a test.

### Home

- **The beat:**
  - The dark round house and the stone.
  - Lou, Tove and Moustache in the small house.
  - The tokens, Lou's drawing, the oldest recording, the credits.
- **What there is:**
  - Lou (9 nodes), Tove, the dog, 8 things to look at, paying respects at the stone.
  - No quests by design.
- **What was thin:**
  - Lou's drawings named only 4 of the 11 worlds.
  - The round window told a memory the traveller could not have ("Near the end, your father stood here…").
  - The stone's tokens leave out the later charms (the listening shell, the echo shell).
  - "This space is for Ilen" exists only in the ending scene, so learning about Ilen afterwards never reaches the stone.
- **Fixed now:** Lou's drawings follow the furthest world written from, any of the eleven (tested), and the window speaks only once the reel has said it.
- **Still open:** the tokens and Ilen at the stone (proposals).

### The Atelier

It is a developer page: it is hidden, off the route and off the map, reachable only from the L picker or with `?level=atelier`. Its artist is unnamed and talks about the game itself. The completion page that points there still counted "seven worlds, thirty-five small things"; it now counts the real ones.

## The most valuable additions, ranked

1. *(done)* The five out-of-order soft-locks, with tests. These were the only places a player could lose a world's story for good.
2. *(done)* The drone finds the world's opener even when the ship lands beside a temple.
3. *(proposal)* A route to Ilen before Home (see below). It is the biggest gap between the story as written and as played.
4. *(done)* The setups now get their payoffs: Ossa's message, Ondine's supper, Mira's clock, the mask, Ilo's monster, Hask's tip.
5. *(done)* Errands in every world but the last, and the ones that didn't land now do.
6. *(done)* The contradictions with the bible and with October's cabs, glove, flask and game menu.
7. *(done)* Pad prompts wherever only keys were named.
8. *(done)* More lines for one-line and stale people, in their worlds' voices.
9. *(proposal)* Something to do in the empty stretches: Vael's colossus, the desert's far landmarks and the Hearth, the City-Shaft's middle levels, the spheres' android wood.
10. *(proposal)* Esk's loss presented as what happened rather than as a failure stamp.

## Proposals for the author (not done: each adds plot, changes a design decision, or renames)

- **Ilen before Home** (plot review §1). Today the Signal Market comes ninth and Home opens at six, so the revelation is post-game. Options:
  - chart the market earlier;
  - let a home-port signal show on the map after about four worlds;
  - have the ship say once, after the market, that the mother's recording waits ("Recording held. It will wait at the console.").

  Whichever you choose, test the ending with and without it. The dead line in the last recording ("I told your sister…", `calls.js`) could then play.
- **Ilen at the stone after the ending.** In `home.js` `homage()`, if `calls.ilen.told` and the ending didn't include her, say "And this space is for Ilen, wherever she is." once.
- **Lou seeded earlier** (plot review §2):
  - a drawing of hers on the ship ("The ship, and a small red hood waving at the edge. Signed LOU.");
  - or the traveller's own line in recording 3 ("I was seven. Younger than Lou is now.").

  Either one gives away the surprise at Home sooner. Also: one ordinary act with her at home, such as hanging a drawing or mending the swing.
- **The galley note** "We are proud of you already. — M." (`src/ship/art.js`) says the final recording's line in the first minute.
- **The stone's tokens.** Add the listening shell and the echo shell (and any later charms) to `TOKEN_ITEMS`, each with its own line.
- **Esk** (plot review §3):
  - the Quests panel's "Failed ✗" and the "Failed:" toast could read "What happened";
  - a return visit where Esk decides whether there is a small job.
- **Viridel's closing toast**, matching Lorn's and Lorn II's "Something of value?".
- **The wheel that keeps turning.** What does Wen's "the city settles when the last tooth turns" mean now? Revise the bible's §9.
- **Places to fill:**
  - a look-at on Vael's colossus;
  - a carving at the Givers' Hearth and words in the masked head's chamber (it could echo Vael II's tower face);
  - a find at the desert's second wreck;
  - something on the City-Shaft's middle levels;
  - a different puzzle at the Hearth than the temple's stone ball.
- **Shared names.** Renaming needs a coordinated text, save and export review, so for now each role is kept clear in its first greeting.
  - Shared names:
    - Pip (the City-Shaft's boy, the Hangar's girl);
    - Lio (the dispatcher, Viridel's child);
    - Hask (the seller of views, the Wick's keeper);
    - Ossa (the shrine, the walls);
    - Hollin (Vael, Lorn II);
    - Ivo (Lorn, the spheres);
    - Pim (Lorn II, the Buried Machine);
    - Aube (Vael II, the spheres);
    - Pell (the desert, the Undertower).
  - Near-misses: Ysel, Ysolde, Ysse, Ysa; Tamsy and Tamsin; Ferro and Ferrol; Brann and Bram; Wick and the Wick.
  - Three nine-year-olds run in a row.
  - The desert's sketcher is listed as "The traveller", the protagonist's own word.
- **Voices that blur:**
  - every Vael II speaker ends on a dry quip;
  - "sitting down" is the punchline in Lorn, Lorn II and Viridel alike;
  - "like a bowl rubbed with a wet finger" and "wet glass" repeat (the voice guide warns about this).
- **Docs.** The bible's desert section and its quotations predate the built sequence; continuity.md and the live data win. Two small doc points:
  - `lore/voice-guide.md` and `lore/characters/worlds.md` give Oïa's third word as "Blow", where the build says "Play";
  - `prompts/vael.md` gives Oïa the flute, which the build leaves on the sill.
