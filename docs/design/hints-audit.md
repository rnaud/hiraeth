# Hints audit (October 2026)

The author, after a playtest: "Way too many hints in the game, I don't want handholding and obvious
prompts." The TODO playtest list had also said the hints were too obvious and covered the health bar.
This is every kind of hint, prompt or nudge the game had, and what became of it. The rules applied
(the Zelda / Outer Wilds way):

- a control's prompt only the first time a genuinely new verb is needed, and only where the player
  can't find it alone; then never again;
- an interact prompt is a small quiet glyph on approach, no sentence;
- objective markers and idle nudges off by default; the drone's ping stays, on request;
- temple and puzzle hints only on request, and only after a struggle, never at once;
- lines that spelled out a solution say what is there, not what to do;
- nothing over the hearts and the magic bar;
- one setting, **Hints: off / subtle (default) / full**, every hint wired through it
  (`src/hint-level.js`, `docs/systems/hints.md`).

Counts are "shown at the default" before (everything was on) and after (subtle).

## Inventory

| # | kind | where | before | after (subtle) | decision, and why |
|---|---|---|---|---|---|
| 1 | Floating use prompt over people and things ("E talk to Ilen") | `src/story/index.js` placePrompt; 119 interactables (`prompt:`) | 119 sentences | 119 glyphs, no words | **Glyph only.** The button is the affordance; what it does is obvious from what you stand by. Full adds the words. |
| 2 | Cue prompts with nothing to float over ("E go aboard", "E galactic map", "E (X / □) turn lens 2 · 1/3 beams aligned") | `src/hud.js` cueText, `src/ship/ship.js` hud(), `src/observatory.js` hud() | 7 sentences | 7 glyphs | **Glyph only** (the beams themselves show the alignment). |
| 3 | Desert first steps: "Look around with …" | `src/first-steps.js` | 1 | 1 | **Kept** (teach): the camera is a genuinely new verb with nothing on screen to find it by; said once, only if you haven't looked. |
| 4 | Desert first steps: "Jump with …" | `src/first-steps.js` | 1 | 0 | **Full only.** Found by pressing the big button; the first gap asks for it. |
| 5 | The ship's prologue nudge (move and look, after 20 s without input) | `src/ship/prologue.js` | 1 | 1 | **Kept**: the minimal first-run teaching of movement and the camera (and the ship's scenes are left alone). |
| 6 | The potion: "Hearts don't come back by themselves: drink a potion with …" | `src/main.js` potionHint | 1 | 1 | **Kept** (teach): a new verb with no visible button; once per save. Off: never. |
| 7 | The first pack: "Creatures, possessed machines… {blade} cuts; {guard} guards; {evade} evades…" | `src/foes.js` firstSeen | 1 (5 sentences) | 1 (one line: "F cuts · CTRL guards · ALT evades.") | **Kept, cut down** (teach): three genuinely new verbs. Full keeps the long version. |
| 8 | Each foe kind, the first time: what it is and how to beat it | `src/foes.js` meet, 20 notes in `src/enemies/archetypes.js` | 20 | 0 | **Full only.** Every foe telegraphs: its tells are the lesson. |
| 9 | Fight mechanics explained after the fact (the world hurts them, swept away, knocked off a ledge, armour, the bell walker hushed, a perfect parry, strings cut) | `src/foes.js` | 7 | 0 | **Full only** (tip). |
| 10 | The ink count every five ("Ink 15 of 20.") | `src/ink.js` | every 5 ink | 0 | **Full only.** The blade's growth steps are still said when reached (that is the reward, not a hint). |
| 11 | The world's edge, first time per world ("The desert wind pushes you back.") | `src/edge.js`, `src/player.js` | 28 lines | 0 | **Full only.** The lean, the wind wisps and the stop say it. |
| 12 | Hazards, first time ("It burns! Get out of the flames.", "Ouch: spines.") | `src/hazards.js`, `src/main.js` | 3 | 0 | **Full only.** The hurt says it. |
| 13 | A quest's next step pushed as a toast ("The bells: Find the clapper") | `src/story/quests.js` | every stage (147 stage texts) | 0 (the chime, the quest log) | **Full only** (objective). |
| 14 | A quest card's first step under its title | `src/story/quests.js` startToast | 1 a quest | title only | **Full only** for the step. The quest log keeps it. |
| 15 | The gold column of light over a world's story goal | `src/quest.js` beacon | on | off | **Full only** (an objective marker). The scout finds the goal on request, its marker shows for a while. |
| 16 | The scout's ping: the objective, its flare and marker | `src/scout.js`, `src/story/quests.js` QuestMarker | on request | on request | **Kept**: an on-demand tool, not a hint. |
| 17 | Auto-ping: the drone flies up to show the way when the jets are found | `src/temples/incal.js` → `scout:ping` with a `why` | 1 | 0 | **Full only** (nudge). The ceiling is open overhead. |
| 18 | The drone's hints in a guardian's fight (11 guardians, 28 phases, 84 lines) | `src/temples/hints.js`, `src/scout.js`, `src/main.js` | on request, at once, each ping plainer | on request, none for the first 40 s of a phase, then one more line at 40, 100, 180 s | **After a struggle** (`openHint`, `Struggle`). Off: never. The four lines naming the bell's buttons now write `{key:whistle}` (taken out on subtle). |
| 19 | Guardians' reactions with the instruction tacked on ("…It is the dark it fears: light the braziers round the walls.") | `src/temples/{desert,incal,garage,perdide,arzach,arzach2,bazaar,buried,edena,spheres,perdide2}.js` | 19 instructive | 0 | **Rewritten**: the creature's reaction stays, the instruction goes ("It is the dark it fears."). The drone's hints carry the help. |
| 20 | Story reactions with what to do after ("It needs a shove: switch the gun to push with {mode}, then aim and shoot.") | `src/story/{desert,desert-errands,desert-spark,arzach2,buried,bazaar}.js` | 6 | 0 | **Quiet line** (`quietOr`): what happened only; full says the rest. |
| 21 | Other story reactions that told the solution ("Shove it out instead (push).", "Water them first (shoot)", "Look up at the light (move the camera up).", "push the frame from the side", "Fill it first, where the water is: the giant's pool…") | `src/story/{terraces,incal,garage,perdide2,arzach2,halfway,edena,desert-bike,desert-spark,desert-errands,bazaar}.js` | 23 | 0 | **Quiet line** (`quietOr`). |
| 22 | The sphere's approach nudge ("Give it a splash of your fluid, and listen.") | `src/story/spheres.js` | 1 | 0 | **Full only** (nudge). |
| 23 | Things you look at that spelled the solution step by step ("*Push the bone from the side* to roll it clear: switch the gun…", "*Wash it* with a splash: aim with…") | `src/story/{buried,incal,desert,bazaar,perdide2,arzach2}-data.js` | 16 | 0 | **Rewritten, suggestive and toned** ("Round enough to roll. Toward the rib, it would crush the drum.", "It would take a good splash to see anything in it."). |
| 24 | Controls named in lines ({key:verb} in toasts, quest steps, conversations, balloons) | everywhere `keyText` resolves (85 placeholders outside the item cards) | 85 | 0 outside the teaching moments | **Taken out unless full** (`quietKeys` in `keyText`): "Whistle for the skiff with {call}, out in the open." → "Whistle for the skiff, out in the open." |
| 25 | Item cards (a box's card, the items page, the game menu's items, a trial's reward) | `src/items.js`, `src/boxes/card.js`, `src/items-page/`, `src/game-menu.js`, `src/trials/index.js` | 16 keys | 16 keys | **Kept** (teach): a new tool's card is the one moment its verb is taught, and the items page is reference. |
| 26 | The bell / the echo shell: a toast after the box's card says it again | `src/boxes/effects.js` | 2 | 0 | **Full only**: the card has just said it. |
| 27 | The hoverbike's call ("call it from anywhere with …") | `src/story/desert-bike.js` | 1 | 1 | **Kept** (teach): summoning is a new verb nobody would guess. |
| 28 | Gadget status said again and again ("The pen is dry…", "No ink bombs left…", "The glass has clouded over…", "Out of magic: the boomerang flies plain.", pinwheels "blow into its face") | `src/gadgets/*.js` via `src/gadgets/index.js` | every time (3 s apart) | once a session each | **Once**, then the sound says it; full as before. |
| 29 | A gadget's own verb ("Hold {gadget} to draw the line out…", "Floating: steer with {move}, press {gadget} again…") | `src/gadgets/bridge.js`, `bubble.js` | 2 | 2 | **Kept** (teach), with their buttons. |
| 30 | "There are more makers' boxes in this world. The game menu's Quests page says where to look." | `src/boxes/index.js` | 1 a world | 0 | **Full only** (nudge to the menu). |
| 31 | An errand delivered: "… · View to see it in the Sketchbook" | `src/quest.js` Errands | 1 | 1 (without where to look) | **Quiet line**. |
| 32 | The controller layout note for old saves ("D-pad ↑ chooses a gadget, D-pad ← drinks…") | `src/main.js`, `src/bindings.js` PAD_SCHEME_NOTE | 1 long | 1 short ("The controller layout changed. Menu, then Controls, lists every button.") | **Cut down**; the Controls page lists everything. |
| 33 | "Updated to v… · what's new is in the settings" | `src/main.js` | 1 per update | 1 per update | **Kept**: news, not a hint. |
| 34 | Photo mode's controls strip | `src/main.js` controller-hint | in photo mode | in photo mode | **Kept**: a tool's own controls, only while it is on. |
| 35 | The stone hand's riddle: Kesh calls the order, the journal spells it | `src/story/arzach.js` | after repeated misses | same | **Kept**: it already comes only after a struggle. |
| 36 | The father's charge, region names, the scout's "Nothing to find here" | `src/story/charge.js`, `src/hud.js`, `src/main.js` | — | — | **Kept**: not hints. In a guardian's fight with no hint open, the drone's shrug says only "◇ …". |
| 37 | Notices over the hearts and the magic bar | `src/ship/cinema.js` layoutCinema (`#health` an obstacle), `tests/hints.test.js` | fixed in the 2026-10-08 pass | — | **Checked**: toasts are laid out round `#health`; the new glyph floats at the object, the cue sits at the bottom. |
| 38 | The Controls page | `src/ui.js` controlsList | every control | every control | **Kept** (accessibility); its note now says the use button shows a glyph, and where to turn the words back on. |

## Totals at the default (subtle)

| kind | before | after |
|---|---|---|
| sentences on interact prompts (floating and cue) | 126 | 0 (126 glyphs) |
| first-time control prompts | 7 (look, jump, potion, fight, call, pen, bubble) | 6 (jump gone; fight cut to one line) |
| foe and fight explanations | 28 | 0 |
| first-time world notes (edge, hazards) | 31 | 0 |
| quest steps pushed on screen | every stage + every card | 0 |
| objective markers shown by themselves | 1 (the goal's column, every story world) | 0 |
| automatic pings and nudges | 3 (jets ping, sphere nudge, more-boxes) | 0 |
| guardian hints available at once | 84 lines | 0 (opening after 40 / 100 / 180 s of a phase) |
| instructive reaction lines (temples and story) | 48 | 0 (rewritten or quiet) |
| solution-spelling inspection lines | 16 | 0 (rewritten) |
| controls named in lines outside item cards | 85 | 0 |
| repeated gadget status lines | unlimited | once each a session |

**Full** brings every one of them back as it was (with the rewritten inspection lines and temple
reactions in their new, suggestive words, and the drone's hints at once). **Off** also drops the
remaining first-time prompts (the camera, the potion, the fight's verbs, the call, the gadgets' verbs),
the words on prompts, and the drone's hints; the glyph, the scout's ping, the item cards and the
Controls page stay.
