# Clarity ledger v2.27

<!-- audit-scores
overall: 4.61 / 5
label: the mean of eight areas (Plumb's three voices, the guardians' fight notices, the people of four world groups), after the sweep
date: 2026-10-25
-->

Issue #626, the author: *"Plumb's dialogs are really bad, they are unintelligible. All characters should speak in a way
that makes it easy to understand them. Clear and direct language."* This is the all-character coverage ledger and the
sweep that followed it. Earlier bounded passes are not redone here: Plumb's makers'-house lines and three temple guides
(v2.10), Fisk and Petra (v2.12), Wim and Tessa (v2.17), Teasel and Briony (v2.20), Achille (v2.23), Joss and Hobb
(v2.25), Abel and Sel (v2.26). They were scored again and left alone unless a line still hid an instruction.

## How it was read

- **Corpus:** every conversation, listen line, thing's page, temple guide and recording the dialogue review's extractor
  reads (`.claude/skills/dialogue-review/extract.mjs`), the twenty-four story groups on the route, home, the Lantern, the
  shops, the aliens and the night mail: **289 speakers**. The seven discarded side worlds are left out (`DISCARDED`,
  src/levels/names.js). Plumb is read from its own sources, which the extractor does not see: `src/companion.js` (its
  own lines), `src/temples/hints.js` and each guardian's `asks.lines` (its fight hints), and the ship's voice it speaks
  in (`src/story/signature.js`, `signature-search.js`, `src/ambush.js`, `src/ship/cinematics.js`, `homecoming.js`,
  `src/story/calls.js`, `relay.js`). The guardians' own fight notices (each phase's `hint`, the wind and plate
  notices) are scored as one more area.
- **Mechanical pass:** `.claude/skills/dialogue-review/clarity.mjs <extract-dir> <out.json>` scores each speaker on
  sentence length, four-syllable words, figures of speech ("like a", "as if"), objects given wants ("that plate wants",
  "it sulks"), pages that open on a pronoun, short fragments, and help nodes (`again`, `how`, `where`…) with no
  imperative and no starred place. It only points: of its 25 speakers at 3 or below, most were greeting nodes and long
  descriptions with no instruction in them. Before 0 / 2 / 23 / 119 / 141 speakers at 1 / 2 / 3 / 4 / 5; after
  0 / 2 / 23 / 118 / 142 (it reads sentence shape, and the rewrites changed meaning more than shape).
- **Editorial pass:** every script was read whole, speaker by speaker, and scored by hand: **5** every line understood on
  the first read, instructions literal; **4** one odd phrase; **3** some lines need a second read, or one instruction is
  partly figurative; **2** several unclear lines, or an instruction hidden in imagery or pronouns; **1** mostly
  unintelligible. Plumb was held to a harder bar: a ten-year-old understands every line on the first read.
- **Rule for rewrites:** every speaker at 2 or below, and every instruction, direction or hint line that was not literal
  in any speaker. Light touch: voice, humour, tones, placeholders, starred places, page counts, ids, conditions and
  effects kept; answers re-read under every edited node (quest-qc rule 5); hints say where, never who.

## Scores

| area | before | after |
|---|---|---|
| Plumb: its own lines (opening, lost, makers' house) | 3 | 5 |
| Plumb: guardian fight hints | 2 | 4 |
| Plumb: the ship's voice (prologue, map, signal, pirates, landing, reel) | 2 | 5 |
| Guardian fight notices | 2 | 4 |
| People: Qanat, the Glass Dunes, the Garage, home, Tansy, Anselm, the reel | 4.6 | 4.7 |
| People: the City-Shaft, the Signal Market, the night mail, the shops, the aliens | 4.7 | 4.8 |
| People: Vael, the sky stones, Lorn, the Deep Wood | 4.4 | 4.8 |
| People: Edena, the Engine-City, the Footprint, the Underwater City, the Moon Foundry, the City in Space, the Lantern | 4.5 | 4.5 |

Speakers by score, people only (289): **before** 0 at 1, 1 at 2 (Oïa), 19 at 3, 82 at 4, 187 at 5; **after** 0 at 1,
0 at 2, 1 at 3 (Weir, by design), 76 at 4, 212 at 5. Plumb counts as one speaker: **2 → 5** on its own lines and
the ship's voice, **2 → 4** in fights. Lines rewritten: **51** people's pages, **~140** Plumb lines (19 of its own, 84
fight hints, 9 guardians' `asks` lines, 29 ship lines) and **48** guardian notices.

## Plumb first

Plumb was the complaint, and it earned it. Its own lines leaned on a joke where the instruction should be ("My petals
are dizzy", "Scenic route? It's the other way": *it* never named); its fight hints opened with a riddle and only got
literal on the third ping ("She will not trust still air", "the stone into the other"); and the ship's voice it speaks
in was a technical readout ("drained the core and left a magnetic signature on the hull. I can track its pulse"). Every
line now names the thing and the action. The worst, before and after:

| where | before | after |
|---|---|---|
| prologue, after the landing (`LANDING_LINE`) | Emergency power online. Whatever passed us drained the core and left a magnetic signature on the hull. I can track its pulse. | Some power is back. That light took our power as it passed, and left a signal on the hull: three slow pulses. I can follow it. |
| the map, first time (`MAP_LINE`) | These worlds carry the same magnetic signature as our scar. | These worlds give off the same signal as our hull. The singing light passed through them. |
| givers on the map (`GIVERS_LINE`) | The same pulse, faint, on people below who saw the light pass. | Some people down there saw the light pass. They give off the same faint signal. |
| the map search (`SEARCH_LINE`, `foundLine`) | Sweep the chart: I will sing louder… / Signature locked. Vael is on the chart. | Move across the map: I'll sing louder… / Found it! Vael is on the map now. |
| lost, circling | My petals are dizzy. This way. | Round and round. I'm getting dizzy. This way. |
| lost, still | Scenic route? It's the other way. | Long way round? Our goal is the other way. |
| makers' house: plate | That plate wants a weight. | Put something heavy on that plate. |
| makers' house: switch | A switch nobody has thrown. | There's a switch to flip. |
| the Elder, phase 3 | She will not trust still air. / When she hangs over a vent, make the wind rise from it: the stone into the other. | She only hovers where the wind blows. Make it blow by her. / Block the other vent with the stone, and the wind rises from the vent by her. |
| the Keeper, phase 1 | It is afraid of the dark round the walls. / …a ball cut out through its spoke's little fire lights one. | It is scared of the dark. Light the fire bowls round the walls. / Cut a ball loose on a spoke: it rolls through a small fire and lights a bowl at the edge. |
| the First Sign, phase 2 | Its one word floods the cables. It hears nothing. / Shut the word out at the hall's relay. | Its word fills the cables, so it can't hear anything else. / Pull the lever by the door to shut its word out. |
| the Foreman | Six numerals, one breath, again. | All six numbers again, quickly. Keep away from its flying cogs. |
| the Anchor-Warden | Too far for the tether: push its bars to wind it in, then pull. | Push the bars on its drum to wind the anchor closer, then pull it. |
| pirates | Hull breached. Falling back to try again. / A hauler, laying mines. | We're hit too badly. Going back to try again. / A big ship is dropping mines. |
| the landing's hold (`homecoming.js`) | Cargo check before descent. … Beginning descent. | Before we land, a look in the hold. … Going down. |
| the reel | Log from the receiver… Same signature as our scar. | While you were at the stone, the receiver picked something up… Same signal as on our hull. |

Each guardian hint keeps its three steps (a nudge, plainer, plainest), but the nudge is an action now, not a mood:
"She cries, and nobody answers" became "She cries out. Answer her with a bell." The guardians' own notices got the same
treatment within their one-line limit ("Guard its hammer: jarred, its face swings open" → "Block its hammer with your
guard: the hit makes its face open"; "The void breathes up under the hall. It bears your wings…" → "Wind rises from the
drop under the hall. Open your wings in it…"). Plumb's character sheet (`lore/characters/plumb.md`) now carries the
rule: plain first, no metaphor in an instruction's place, no ship jargon on its own.

## People, by world group

Most of the cast was already plain: the earlier passes had done the quest givers. What remained were directions behind a
figure of speech or a pronoun. The rows below list every speaker; things (a frieze, a bell, a mounting stone) count as
speakers because their pages are read.

### The City-Shaft, the Signal Market, the night mail, the shops, the aliens

| world | speaker | source | before | after | worst line before | lines changed |
|---|---|---|---|---|---|---|
| incal | A rim resident, A tourist, A roof gardener, A flower seller, A cable mender, A commuter, A laundry hanger, A child, Someone looking up, Someone from the bottom | incal-data CROWD_TALK.* | 5 | 5 | — | 0 |
| incal | A worshipper | CROWD_TALK.lower.0 | 4 | 4 | “the light can still feel you looking” | 0 |
| incal | Basile, Ossa, Pip, Corvin Sale, Lio, Wren | incal-data | 5 | 5 | — | 0 |
| incal | Nima | PEOPLE.nima | 4 | 4 | “They dropped landing to landing before there were cabs.” | 0 |
| incal | Perrine | PEOPLE.perrine | 4 | 4 | “…like someone remembering something.” | 0 |
| incal | Abel (v2.26) | PEOPLE.abel | 4 | 4 | “Now it throws it at my wall.” | 0 |
| incal | Dov | PEOPLE.dov | 4 | 4 | “Very exclusive, stairs apparently.” | 0 |
| incal | Tobin | RIM.hask | 4 | 4 | “Possibly in views.” | 0 |
| incal | The Upward Shrine, goods hoist, halfway mirror, call-lamp, lamplighters' pad, upper pad, locker, relay lamp, Tobin's view pad | THINGS.* | 5 | 5 | — | 0 |
| incal | Vell | src/temples/incal-data.js PEOPLE.vell | 3 | 4 | “My grandmother said the tower ran on its own breath … Splash one, she said, and watch it go.” | 2 |
| bazaar | A fruit seller (market) | bazaar-data CROWD_TALK.market.0 | 3 | 5 | “Ummu's crates came down in its alley … The quiet one hasn't found its bowl since.” | 1 |
| bazaar | A noodle cook, A shopper, A listener, An old trader, A bridge walker, Someone in the square, A fruit seller (on air), A stranger | CROWD_TALK.* | 5 | 5 | — | 0 |
| bazaar | A window cleaner | CROWD_TALK.bridge.1 | 3 | 5 | “Somebody should *wake it up*.” | 1 |
| bazaar | Madame Sel (v2.26) | PEOPLE.sel | 4 | 5 | “Go home under the avenue, love: …” | 1 |
| bazaar | Kip, Ferro, Brush, Teb, Wynn | PEOPLE.*, STREET.* | 5 | 5 | — | 0 |
| bazaar | Doss | STREET.doss | 4 | 5 | “Or the parked cab, or that pack on your back.” | 1 |
| bazaar | Oyo | STREET.oyo | 4 | 4 | “Like a bruise fading.” | 0 |
| bazaar | console, oldest sign, first stall, screen-mender, mast, fallen crates, Ummu, broadcast | THINGS.* | 5 | 5 | — | 0 |
| bazaar | Hobb (v2.25) | src/temples/bazaar-data.js PEOPLE.hobb | 5 | 5 | — | 0 |
| night-train | Edda | night-train-data PEOPLE.edda | 3 | 5 | “She rides *the roofs of the long tail*” | 1 |
| night-train | Ambrose | PEOPLE.ambrose | 3 | 5 | “walk till the rails run out behind you” | 2 |
| night-train | Solange, the halt's bell, the timetable, the platform | | 5 | 5 | — | 0 |
| shop | Haddu | shop-data SHOPKEEPERS.haddu | 4 | 4 | “a few *hearts' worth of courage*” | 0 |
| shop | Brin | SHOPKEEPERS.brin | 4 | 4 | “Cures. Hearts. Chimes.” (terse by design, explained in her topic) | 0 |
| shop | Odo | SHOPKEEPERS.odo | 4 | 4 | “The Major remembered his own desk, they say.” | 0 |
| shop | Gunnar | SHOPKEEPERS.gunnar | 4 | 4 | “Each poured once, cooled slow. Chimes on the ingot.” | 0 |
| shop | Perpetue, Nettle, Burdock, Clover, Fausta, Marit, Mott, Hale, Pashka, Odette, Amaro | SHOPKEEPERS.* | 5 | 5 | — | 0 |
| aliens | Ommo, Veil, Hum, Slow Orm, Sill, Old Turl, the Tullos, the Mimmis, the Zells | ALIENS.* | 5 | 5 | — | 0 |
| aliens | Ivet, Oul | ALIENS.arzach.0/2 | 4 | 4 | one-word gestures (by design) | 0 |
| aliens | Weir | ALIENS.arzach.1 | 3 | 3 | “(taps … the highest. It looks at the stone hand.) Small. Tall.” (by design) | 0 |
| aliens | Moor | ALIENS.perdide2.0 | 4 | 5 | “The pools take colours. Yours are bright ones.” | 1 |

### Vael, the sky stones, Lorn, the Deep Wood

| world | speaker | source | before | after | worst line before | lines changed |
|---|---|---|---|---|---|---|
| arzach | Tam | arzach-data LOCALS.0 | 4 | 4 | “(…draws a square with a star on top…)” (mime, flavour) | 0 |
| arzach | Senn | LOCALS.1 | 3 | 5 | “*Two spires. Their flat tops.*” (the feathers never named) | 1 |
| arzach | Kesh | LOCALS.2 | 4 | 4 | “(…as though offering a gift.) Gives.” | 0 |
| arzach | Oïa | PEOPLE.oia | 2 | 4 | “sweeps both hands up its side, like rising air. Then she spreads her arms: *wings*.” (where the wings are, only mimed) | 4 |
| arzach | A drawing in the sand, the riders' mast, the rider's roost, the great bird's bones, the riders' shrine, a broken slab, the highest stone, the stone hand | THINGS.* | 5 | 5 | — | 0 |
| arzach | The fallen giant | THINGS.colossus | 4 | 4 | “…as if it lay down to rest and the plain came up round it.” | 0 |
| arzach | A mounting stone | THINGS.mounting | 4 | 4 | long descriptions, no instruction | 0 |
| arzach | A stone ear | THINGS.ear | 4 | 4 | “It runs on ahead of you down the road” | 0 |
| arzach | An hour stone | THINGS.hourstone | 4 | 4 | “Not its hour.” | 0 |
| arzach | Lark | src/temples/arzach-data.js PEOPLE.lark | 4 | 4 | “*The Aerie.* Birds learned here.” | 0 |
| arzach2 | Sister Aube, Mother Ysolde, Tiv | arzach2-data | 5 | 5 | — | 0 |
| arzach2 | Brother Calix | LOCALS.1 | 3 | 5 | “*Follow them home* with it; they know the way better than anyone.” | 3 |
| arzach2 | Ondine | LOCALS.2 | 3 | 5 | “The bell's tongue is on that island” / “I know her thinking light.” | 2 |
| arzach2 | The riders' gate | THINGS.gate | 4 | 4 | long descriptive pages | 0 |
| arzach2 | The face on the tower, the signal lamp, fallen-up tiles, the bell rope, Tiv's cairn | THINGS.* | 5 | 5 | — | 0 |
| arzach2 | Agathe | src/temples/arzach2-data.js PEOPLE.ysel | 4 | 4 | “The ringers pulled them by a ring underneath.” | 0 |
| perdide | Wendel | perdide-data LANDING.0 | 3 | 5 | “Your backpack seems to be carrying a useful imitation.” (the hint inside a joke) | 2 |
| perdide | Sedge, Ivo | LANDING.1/2 | 5 | 5 | — | 0 |
| perdide | Saba | PEOPLE.saba | 4 | 5 | “raise the splinter at the cave's heart” | 1 |
| perdide | Corm | PEOPLE.corm | 4 | 4 | “A sky-tooth.” | 0 |
| perdide | Ysse | PEOPLE.ysse | 4 | 5 | “Take it *to the ring at the cave's heart*.” | 1 |
| perdide | The root stone, the Great Crystal, the fireflies' nest | THINGS.* | 5 | 5 | — | 0 |
| perdide | The heart of the cave | THINGS.heart | 4 | 4 | the egg-lamps page, 30 words | 0 |
| perdide | Teasel (v2.20) | src/temples/perdide-data.js PEOPLE.teasel | 5 | 5 | — | 0 |
| perdide2 | Hollin | perdide2-data KEEPERS.0 | 4 | 4 | the water-way directions, one 30-word sentence (literal) | 0 |
| perdide2 | Pim | KEEPERS.1 | 5 | 5 | — | 0 |
| perdide2 | Bram | KEEPERS.2 | 3 | 4 | “A boat that comes when anyone whistles was somebody's first.” | 1 |
| perdide2 | Robin | PEOPLE.wick | 3 | 4 | “water that remembers light” / “Go on, *try yours*.” | 2 |
| perdide2 | Fen | PEOPLE.fen | 4 | 5 | “Light the berth, get off, give her a nudge.” | 1 |
| perdide2 | The saucer, a dark pool | THINGS.* | 5 | 5 | — | 0 |
| perdide2 | Briony (v2.20) | src/temples/perdide2-data.js PEOPLE.briony | 5 | 5 | — | 0 |

### Edena, the Engine-City, the Footprint, the Underwater City, the Moon Foundry, the City in Space, the Lantern

| world | speaker | source | before | after | worst line before | lines changed |
|---|---|---|---|---|---|---|
| edena | Mira | edena-data PEOPLE.mira | 4 | 4 | “Mostly, we grow old together.” | 0 |
| edena | Sol | PEOPLE.sol | 4 | 4 | “I'd rather have been right about something less necessary.” | 0 |
| edena | Oro | PEOPLE.oro | 4 | 4 | “A little white, stepped seed rolled downhill… They seek water.” | 0 |
| edena | Rue, Esk | PEOPLE.lio, PEOPLE.esk | 5 | 5 | — | 0 |
| edena | Vey | PEOPLE.vey | 4 | 4 | “They pushed back. Try watering them.” | 0 |
| edena | the cabin, the pyramid top, the log, the scar, the lookout | THINGS.* | 5 | 5 | — | 0 |
| edena | Sorrel | src/temples/edena-data.js PEOPLE.sorrel | 3 | 4 | “Water won't wake a bud. Something in there might.” | 2 |
| buried | Wen | buried-data PEOPLE.wen | 4 | 4 | “The wheel needs light.” | 0 |
| buried | Hask | PEOPLE.hask | 4 | 4 | “Same mark on a gift and a wound.” | 0 |
| buried | Dun | PEOPLE.dun | 4 | 4 | “*Shoot its rusty collar*… The ratchet turns only one way.” | 1 |
| buried | Jot | PEOPLE.pim | 4 | 4 | “The crane only turns one way. Like me.” | 0 |
| buried | Ket | PEOPLE.ossa | 5 | 5 | — | 0 |
| buried | Tull | PEOPLE.tull | 4 | 4 | “Warm as another hand.” | 0 |
| buried | the Wick, the window, the crane, the log, the numbers, the wheel | THINGS.* | 5 | 5 | — | 0 |
| buried | Fisk (v2.12) | src/temples/buried-data.js PEOPLE.brann | 4 | 4 | “*A stone in the teeth*: every engine the makers built stops for that” (foreshadowing, kept) | 0 |
| spheres | Linnet | spheres-data PEOPLE.aube | 5 | 5 | — | 0 |
| spheres | Nell | PEOPLE.nell | 4 | 4 | “Everything down there comes twice as large” | 0 |
| spheres | Emrys | PEOPLE.ivo | 4 | 4 | “Something walked through the sky putting spheres down” | 0 |
| spheres | Cael | PEOPLE.cael | 4 | 4 | “Consider it an invitation with conditions.” | 0 |
| spheres | Ume | PEOPLE.ume | 4 | 4 | “He'll want to climb something about the chord.” | 0 |
| spheres | the detours and things (cairn, stones, arcade, lantern, lake, mark, pebble) | DETOURS.*, THINGS.* | 5 | 5 | — | 0 |
| spheres | Tessa (v2.17) | src/temples/spheres-data.js PEOPLE.tessa | 3 | 4 | “Drop only where water waits.” / “splash the sphere answering its note” | 2 |
| underwater | Achille (v2.23) | src/temples/underwater-data.js PEOPLE.achille | 4 | 4 | “The makers let it in and out of that house at a valve.” | 0 |
| underwater | Bastien | underwater-people npcs.0 | 4 | 4 | “like a stone down a well. A polite stone” | 0 |
| underwater | Coralie, Brune, Fabre | npcs.1–3 | 5 | 5 | — | 0 |
| underwater | Maelle | npcs.4 | 4 | 4 | “Go and ask it to stop.” | 1 |
| moonfoundry | Petra (v2.12) | src/temples/moonfoundry-data.js PEOPLE.ilse | 4 | 4 | “Shut a tap by a hub to stop the pour and drain them.” | 0 |
| moonfoundry | Dun | moonfoundry-people npcs.0 | 5 | 5 | — | 0 |
| moonfoundry | Wen | npcs.1 | 4 | 4 | a long but literal route | 0 |
| moonfoundry | Emrys | npcs.2 | 4 | 4 | “They mind being climbed less than the white hill does.” | 0 |
| moonfoundry | Bertil | npcs.7 | 4 | 4 | “Up. Same as everyone who lands on the apron.” | 0 |
| moonfoundry | Liesel | npcs.8 | 3 | 4 | “Follow the warm. It's straighter than he is.” | 2 |
| moonfoundry | Hedda | npcs.9 | 3 | 4 | “Whatever they face pours at night.” / “Look at the moons.” | 2 |
| spacecity | Joss (v2.25) | src/temples/spacecity-data.js PEOPLE.joss | 4 | 4 | “There's a room in there that floats on a cable. Every weight in the house hangs on the same one.” | 1 |
| spacecity | Kip, Nima, Madame Sel, Rosa | content.js spacecity.npcs | 5 | 5 | — | 0 |
| spacecity | Ines | npcs.6 | 4 | 4 | “a ship came by with no name to give” | 0 |
| lantern | Ilen (home) | lantern-data ILEN_HOME | 5 | 5 | — | 0 |
| lantern | Ilen | PEOPLE.ilen | 4 | 4 | “It sheds as it sings. Splinters of the song” (the climax's mystery, kept) | 0 |

## What is left

- **Weir** (Vael's aliens, 3): a wordless foot-tap hint, low, higher, highest, then "Small. Tall." The aliens speak in
  gestures by design; if players miss the stone hand's order, a clearer stage direction is the fix, not words.
- **Wind and plate side notices** in the temples (`ride:`, `still:`, `back:`, `openHint:`) still use "breath" and
  "spent" in places ("The breath through the vane's frame bears your wings"). They describe what happened rather than
  ask for an action, so they were left; the asking notices were all rewritten.
- **Achille's valve** ("The makers let it in and out of that house at a valve") stays vague: making it literal would mean
  inventing how the valve works.
- **The little mask** in Qanat still names "Vael II", a world merged into Vael: a continuity fix, not a clarity one.
- **Odo** opens on his own name ("Odo, quartermaster to Major Brask"), which the voice guide discourages; the test lets it
  pass and the line is clear, so it stays.
- **Oïa's gestures** now spell out what they mean ("the wind rises there… the wings are there", pointing at the house
  with stone wings): she still says nothing new, but the narration reads the mime for the player. The author may want
  to look at it.
- The extractor reads only `*-data.js`; the Glass Dunes' short barks in `src/story/glassdunes-people.js` were read by
  hand.

## Appendix: Qanat, the Glass Dunes, the Garage, home, Tansy, Anselm, the reel (every speaker)

| world | speaker | source | before | after | worst line before | lines changed |
|---|---|---|---|---|---|---|
| desert | A pilgrim | src/story/desert-data.js:CROWD_TALK.procession.0 | 5 | 5 | — | 0 |
| desert | A banner bearer | src/story/desert-data.js:CROWD_TALK.procession.1 | 4 | 4 | — | 0 |
| desert | A tired walker | src/story/desert-data.js:CROWD_TALK.procession.2 | 4 | 4 | — | 0 |
| desert | A pilgrim | src/story/desert-data.js:CROWD_TALK.drinking.0 | 5 | 5 | — | 0 |
| desert | A pilgrim | src/story/desert-data.js:CROWD_TALK.camp.0 | 5 | 5 | — | 0 |
| desert | A trader | src/story/desert-data.js:CROWD_TALK.camp.1 | 4 | 4 | — | 0 |
| desert | A child | src/story/desert-data.js:CROWD_TALK.camp.2 | 5 | 5 | — | 0 |
| desert | A pilgrim | src/story/desert-data.js:CROWD_TALK.gate.0 | 5 | 5 | — | 0 |
| desert | Ama | src/story/desert-data.js:PEOPLE.ama | 4 | 4 | — | 0 |
| desert | Teo | src/story/desert-data.js:PEOPLE.teo | 4 | 4 | — | 0 |
| desert | Sefa | src/story/desert-data.js:PEOPLE.sefa | 5 | 5 | — | 0 |
| desert | Zahir | src/story/desert-data.js:PEOPLE.zahir | 5 | 5 | — | 0 |
| desert | Bako | src/story/desert-data.js:PEOPLE.bako | 5 | 5 | — | 0 |
| desert | Ilo | src/story/desert-data.js:PEOPLE.ilo | 4 | 4 | — | 0 |
| desert | The Speaker | src/story/desert-data.js:PEOPLE.speaker | 4 | 5 | “Then the old accounts are true to the step. One of them came back with a quiet staff.” | 2 |
| desert | Oum | src/story/desert-data.js:PEOPLE.oum | 4 | 4 | — | 0 |
| desert | Nour | src/story/desert-data.js:PEOPLE.nour | 5 | 5 | — | 0 |
| desert | Hessa | src/story/desert-data.js:PEOPLE.hessa | 4 | 4 | “Useful history, if someone remembers the maintenance.” | 0 |
| desert | Marrow | src/story/desert-data.js:PEOPLE.marrow | 4 | 4 | — | 0 |
| desert | The roots | src/story/desert-data.js:THINGS.roots | 5 | 5 | — | 0 |
| desert | The mural | src/story/desert-data.js:THINGS.mural | 5 | 5 | — | 0 |
| desert | Teo’s drum | src/story/desert-data.js:THINGS.drumStuck | 5 | 5 | — | 0 |
| desert | A knuckle of bone | src/story/desert-data.js:THINGS.knuckle | 5 | 5 | — | 0 |
| desert | The sleeping mask | src/story/desert-data.js:THINGS.maskEyes | 5 | 5 | — | 0 |
| desert | The clogged drain | src/story/desert-data.js:THINGS.bone | 5 | 5 | — | 0 |
| desert | The carved frieze | src/story/desert-data.js:THINGS.carving | 4 | 4 | — | 0 |
| desert | The little mask | src/story/desert-data.js:THINGS.smallMask | 4 | 4 | “…the lone tower’s plinth in Vael II…” (stale world name) | 0 |
| desert | A salvager’s slate | src/story/desert-data.js:THINGS.slate | 5 | 5 | — | 0 |
| desert | The keepers’ bowl | src/story/desert-data.js:THINGS.wayBowl | 4 | 4 | — | 0 |
| desert | The keepers’ camp | src/story/desert-data.js:THINGS.wayCamp | 5 | 5 | — | 0 |
| desert | A small bronze bell | src/story/desert-data.js:THINGS.wayBell | 4 | 4 | — | 0 |
| desert | A sand-skiff’s wreck | src/story/desert-data.js:THINGS.rideWreck | 5 | 5 | — | 0 |
| desert | The skiff’s anchor | src/story/desert-data.js:THINGS.rideAnchor | 5 | 5 | — | 0 |
| desert | The pilgrims’ resting stone | src/story/desert-data.js:THINGS.roadStone | 4 | 4 | — | 0 |
| desert | The first verse | src/story/desert-data.js:THINGS.verse1 | 5 | 5 | — | 0 |
| desert | The second verse | src/story/desert-data.js:THINGS.verse2 | 5 | 5 | — | 0 |
| desert | The third verse | src/story/desert-data.js:THINGS.verse3 | 5 | 5 | — | 0 |
| desert | The fourth verse | src/story/desert-data.js:THINGS.verse4 | 5 | 5 | — | 0 |
| desert | The pilgrims’ lookout | src/story/desert-data.js:THINGS.lookout | 4 | 4 | — | 0 |
| desert | A doorway in the sand | src/story/desert-data.js:THINGS.ruinStair | 5 | 5 | — | 0 |
| desert | A windcatcher | src/story/desert-data.js:THINGS.ruinTower | 5 | 5 | — | 0 |
| desert | A buried caravan | src/story/desert-data.js:THINGS.ruinCaravan | 5 | 5 | — | 0 |
| desert | Three old arches | src/story/desert-data.js:THINGS.ruinArcade | 5 | 5 | — | 0 |
| desert | An old qanat well | src/story/desert-data.js:THINGS.qanatWell | 5 | 5 | — | 0 |
| desert | The Givers’ field-stone | src/story/desert-data.js:THINGS.fieldStone | 5 | 5 | — | 0 |
| desert | The tusk gate | src/story/desert-data.js:THINGS.rideTusks | 5 | 5 | — | 0 |
| desert | A stone ball | src/story/desert-data.js:THINGS.weight | 4 | 4 | — | 0 |
| desert | The grille | src/story/desert-data.js:THINGS.grille | 5 | 5 | — | 0 |
| desert | Someone from Qanat | src/story/desert-data.js:VILLAGER_TALK | 4 | 4 | — | 0 |
| desert | Sabri | src/temples/desert-data.js:PEOPLE.sabri | 4 | 5 | “Beyond the guard’s watcher, a chest holds their push gun.” | 1 |
| desert | Rima | src/levels/content.js:desert.npcs.0 | 5 | 5 | — | 0 |
| desert | Pell | src/levels/content.js:desert.npcs.1 | 5 | 5 | — | 0 |
| desert | Rook | src/levels/content.js:desert.npcs.2 | 4 | 4 | — | 0 |
| desert | Ennor | src/levels/content.js:desert.npcs.3 | 4 | 4 | — | 0 |
| desert | Dalia | src/levels/content.js:desert.npcs.4 | 4 | 4 | — | 0 |
| desert | Naji | src/levels/content.js:desert.npcs.5 | 4 | 5 | “Asleep again, in every one.” | 1 |
| desert | Yara | src/levels/content.js:desert.npcs.6 | 5 | 5 | — | 0 |
| fellow | Tansy (home listen) | src/story/fellow-data.js:HOME_TALK | 4 | 4 | — | 0 |
| fellow | Tansy | src/story/fellow-data.js:TANSY | 4 | 5 | “*The market’s night halt* takes letters.” | 1 |
| garage | Wim | src/temples/garage-data.js:PEOPLE.wim | 4 | 5 | “The clocks inside need them lit before the first one fades.” | 1 |
| glassdunes | Fenna | src/levels/content.js:glassdunes.npcs.2 | 4 | 5 | “*Read it from the upper gallery*, past the prism crossings.” | 1 |
| glassdunes | Halden | src/levels/content.js:glassdunes.npcs.5 | 5 | 5 | — | 0 |
| glassdunes | A mark in the glass | src/levels/content.js:glassdunes.traces.0.person | 4 | 4 | — | 0 |
| glassdunes | The glass | src/levels/content.js:glassdunes.traces.1.person | 5 | 5 | — | 0 |
| glassdunes | The glass | src/levels/content.js:glassdunes.traces.2.person | 5 | 5 | — | 0 |
| glassdunes | The glass | src/levels/content.js:glassdunes.traces.3.person | 5 | 5 | — | 0 |
| glassdunes | The glass | src/levels/content.js:glassdunes.traces.4.person | 5 | 5 | — | 0 |
| glassdunes | The glass | src/levels/content.js:glassdunes.traces.5.person | 5 | 5 | — | 0 |
| home | Lou | src/story/home-data.js:PEOPLE.lou | 4 | 4 | — | 0 |
| home | Aunt Tove | src/story/home-data.js:PEOPLE.tove | 5 | 5 | — | 0 |
| home | A photo | src/story/home-data.js:THINGS.photo | 5 | 5 | — | 0 |
| home | Your father’s chair | src/story/home-data.js:THINGS.chair | 5 | 5 | — | 0 |
| home | Your mother’s scarf | src/story/home-data.js:THINGS.scarf | 5 | 5 | — | 0 |
| home | The recorder | src/story/home-data.js:THINGS.recorder | 5 | 5 | — | 0 |
| home | The round window | src/story/home-data.js:THINGS.window | 5 | 5 | — | 0 |
| home | Lou’s shelf | src/story/home-data.js:THINGS.shelf | 5 | 5 | — | 0 |
| home | Lou’s drawings | src/story/home-data.js:THINGS.wall | 5 | 5 | — | 0 |
| home | The window seat | src/story/home-data.js:THINGS.seat | 5 | 5 | — | 0 |
| overnighttrain | Saba | src/levels/content.js:overnighttrain.npcs.0 | 5 | 5 | — | 0 |
| overnighttrain | Oïa | src/levels/content.js:overnighttrain.npcs.1 | 5 | 5 | — | 0 |
| overnighttrain | Sol | src/levels/content.js:overnighttrain.npcs.2 | 5 | 5 | — | 0 |
| overnighttrain | A mark on the last carriage | src/levels/content.js:overnighttrain.traces.0.person | 5 | 5 | — | 0 |
| recordings | the recordings | src/story/calls.js.reel | 4 | 4 | (They pull whole islands home with rope there. Same knots.) — subtext by design | 0 |
| scientist | Anselm Thrum | src/story/scientist-data.js:THRUM_MEETING | 4 | 5 | — | 0 |
| scientist | Anselm Thrum (count lines) | src/story/scientist-data.js:THRUM_TALK | 3 | 5 | “The Desert still sings loud.” / “Five so far.” | 5 |
