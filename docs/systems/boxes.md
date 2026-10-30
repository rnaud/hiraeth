# The makers' chests (v1.42 redesign; the boxes of v0.63 before them)

Code: `src/boxes/` (chest (the models), model, scene, index, placements), the shader block `MAKERS_BOX` in
`src/materials.js`, the desert's dais in `src/desert-city.js`. Tests: `tests/boxes.test.js`.

## The look: one chest in every world

The author's picks (`references/Core Objects/Chests/`, prompts in `docs/design/chest-prompts.md`): "the chest should be
the exact same in all worlds". There are two kinds and the placement says which (`chestKind`: a placement with
`temple` gets the temple chest, every other the makers'); nothing about a chest depends on its world.

- **The makers' chest** (`sheet/sheet-1.jpg`; `chest.js` `MAKERS_CHEST`): hip high and wider than tall, a rounded shell
  of pale cream ceramic like a river stone (a superellipsoid, rounder on top, flatter underneath); the makers' pale
  gold four-point star on its top (painted by the shader, its points across longer than front to back); a thin brass
  band round it a little under the middle, standing proud of the shell, with a brass hinge on either side; on the band
  at the front a round glass lens of jade fluid in a brass ring, a two-armed swirl with a bright heart and a highlight
  (the jade of the old round backpack). It opens in two: the shell over the band parts on the side hinges like petals, lined
  inside in pale jade.
- **The temple chest** (`temple/sheet-*.jpg`; `TEMPLE_CHEST`), the chest at the heart of each temple: a bud of white
  stone on a low round foot ringed in gold, six petals edged in gold, a gold four-point star with a jade heart on each,
  the jade glass of its heart (a swirling sphere) glowing in the seams between them. It opens like a flower: the
  petals fall outward from the foot and the heart rises and gives itself to the item; a jade disc glows in the foot.
- **Cheap for the Xbox.** Each kind is one vertex-coloured geometry (position, normal, colour; no uv), built once and
  shared by every chest of that kind (`chestGeometry`). A closed chest is **one mesh**; the opening parts (the bowl and
  two halves, or the foot, six petals and the heart) are swapped in only while it opens (`setOpen`). All of it is in
  the chest's one material: the same options as the old blue box but `vertexColors`, which doesn't split the program
  (`userData.sharesProgram`, `scripts/three-program-keys.mjs`), so **no new shader program** (the test checks the
  defines and the shader against the old box's). Measured in the desert (High, 1280 × 720): a chest costs the same 3
  draws as the old box, and the programs linked are unchanged (71–72 with the views shown).
- **A colour over 1 is a light.** In the `MAKERS_BOX` block, what a vertex colour has over 1 is its glow (emissive,
  woken with the star as you come near: `uBoxA.y`), its albedo brought back under 1: the lens, the bud's seams and
  heart, the stars' jade hearts, the linings. Nothing else in the game draws with this material.
- **Outline only.** The material sets the soft-ink flag (+8 in `gHatch.a`, with a full pen line in `r`), so `post.js`
  draws its silhouette and nothing inside it: no crease, colour or shadow-boundary lines (the band, the lens and the
  gold are colour, not ink), and no hatching. A tone of its own over the form (paler where it turns up) keeps it round.
- **The star** is painted in the shader on the makers' chest's top: `uBoxA.z` is its reach in metres (0: none, the
  temple chest, whose stars are its inlay). `uBoxA.y` is the marks' and the lights' glow. (The compasses on the old
  box's sides are gone.)
- **The ray.** A thin line of pale jade light crosses the shell pass after pass, a short trail behind it.
  Each pass is a plane sweeping along another direction (golden-angle turns), so the line wraps
  round the whole shell. `uBoxA.w` is its clock in passes (the line crosses in the first 80% of
  a pass, then rests); `uBoxA.x` its strength. Its core and the star are emissive, so they
  keep their colour in shade and feed the bloom.
- index.js winds the clock: one pass every `RAY_PASS.far` s, quickening to `RAY_PASS.near`
  close up, where the ray, the star and the lens brighten and the chest hums and shudders.

## The opening (scene.js)

`approach → wake → rise → wobble → dissolve → reveal → card → beat → out` (`TIMES`). It floats up
`LIFT` m, turning a corner toward the camera, and hangs there breathing; then the **wobbles**
(`WOBBLES`, like a caught pokéball deciding): three quick rocks about its heart, each with a
small squash, a knock (`sound.boxWobble(i)`) and one pass of the ray across it, with still
rests between them and a last still moment before it opens. The **opening** is the dissolve phase in stages
(`OPENING`, shares of it): over its first half the chest parts (`setOpen`: the makers' halves swing out on their
hinges, the temple's petals fall open and its heart rises), motes of jade light stream up out of it (`buildMotes`,
the sheets' column of light) and the item grows out of the light at its centre; from 55 % it comes apart from the top
down in the dissolve, the motes thinning through the reveal and gone during the card.

**Planted from the first frame** (issue #785, the author: "When I open a chest with a cinematic my characters feet move.
They should be well planted before the cinematic starts"). `start` sets him down square in front of the chest, turned to
it, and stands him still there at once (`Player.standStill`): no captured stop or turn left to play, no gait in the
clips' blend, no lean or turn from before the cut, no stair lag, the relaxed stance already in and the feet set down
afresh under it. Opened from a walk, he had carried on: one or two settling steps under the scene's camera, 0.2-0.8 m
of foot travel in its first 0.3-0.6 s. `tests/chest-feet.test.js` opens one from a walk, a run, standing and turned
round: no foot point moves 3 mm in a frame, under 3 cm in the first second (the idle's breathing).

**Since issue #223** (the author: "the chests should not float up, they should open where they are, and light should come
out from within them. Then the character should hold the item in their hand (it should float right above his open
hand). Also the sound of the chest opening is wrong, sounds like creaking"), the paragraph above is history:
- **On the ground.** `LIFT` is 0: nothing floats. `wake` clicks its brass latch (`Sound.boxLatch`; the wooden creak,
  `boxCreak`, is the home's door's alone now), `rise` (the name kept) unlatches it with a second, lower click and light
  at its seam. The wobbles rock it on its foot where it stands, `ROCK` (0.4) of their swing, pivoting on the edge that
  stays down, so it never sinks into the ground or lifts off it (the knocks and the ray as before).
- **It opens where it stands** (the `dissolve` phase, its name kept: nothing comes apart): the halves part on their
  hinges, and light pours up out of it (until issue #285 thin blades of pale jade light, `buildShaft`, with jade specks
  between them, `buildMotes`: now real light, below), the chest's own light inside it. The item
  grows out of the light inside and rises clear of the rim. The sound is `Sound.boxOpen`: a soft hollow thump of the
  halves and a swell, an open chord rising in under a few soft high notes (the bright noise burst `boxBurst` made is gone).
- **In his hand.** Over the reveal the item comes to him in a small arc and floats `HAND.above` (0.2 m) over his open
  right hand, at `HAND.scale` (0.55) of its size over the chest: he holds the hand out before him, palm up, fingers
  open (`Player.offer` = { k, at }: `offerHand` reaches the arm there and turns the palm up, `src/hands.js` opens the
  fingers, 'flat'). He holds it so through the card; the closing beat takes it from there (its own holds as before)
  as he lets go. The camera's second shot looks between the item over his hand and the open chest.
  **The hand on the lens's side** (issue #652): under the 'left' plan (its reveal lens over his left shoulder, ten of the
  42 boxes) the item over his right hand stood behind his body and pack through the whole card. `offerSide(plan)` picks
  the hand on the side of the plan's B lens; `Player.offer` carries `side` ('r' | 'l'), `offerHand` reaches that arm and
  `src/hands.js` opens that hand. `tests/box-reveal-visible.test.js`: every box's item has a model of its own (not the
  generic gem) at a size that reads over the hand, and through the card it is in the frame and clear of his body and
  pack, played through and skipped, under every plan.
- **It stays open.** After the scene the chest is left where it stood, its halves parted (the temple's bud open like a
  flower), quiet: no ray, no hum, no light (`setSpentLook`), on a fresh load too. No collider: the block it stood as
  would be solid where the parted halves leave air. A box spent without being opened (a fallback, an item had anyway)
  still goes. Its timing: `TIMES` wake 0.7, rise 0.6 (it was 1.0 to float up), the rest as before.
`tests/boxes.test.js` (on the ground all through, opened where it stands, the shaft, his hand held out and the item over
it, left open), `tests/hands.test.js` (the open hand).

### The light out of it (`light.js`; issue #285)

The author: "Right now you have little 3d shapes coming out of it, let's have real light coming out of it." The
reference (`references/Core Objects/Chests/light/light-1.jpg`, the reference lab, OpenAI, picked for the game's own
chest and the clearest structure of light: a pale gold core widening into a few flat jade bands with straight rays,
the lining glowing, a pool on the floor and light on the traveller's front; `light-day.jpg` the daylight companion;
prompts in `docs/design/chest-prompts.md#light`). `ChestLight`, made by the scene at its start and disposed at its end:

- **Washes, not meshes.** Everything is drawn the way every shaft of light is (rendering.md "Shafts of light"):
  washes laid over the finished picture after the ink pass (`level.veils`; createBoxes makes one for a level without),
  depth-tested by hand against the G-buffer, on layer 31, so no ink round it, no shadow, nothing to bump into, and
  **no new program**: four washes of the one wash program, laid **additively** (blending is the draw's state):
  - the column: two cones from the chest's mouth (`MOUTHS`: the band's height on the makers' chest, the foot's top on
    the temple's) up to `CHEST_LIGHT.height` (3.8 m), a wide pale jade one and a narrower pale gold core, taller and
    wider as it swells. The wash's **rays** (`uRays`, src/veil.js; 0 for every other wash): soft where a cone is seen
    edge-on (|n·v|), gone at its far end (uv.y), streaked into slow rays round it (uv.x, `rays.count` 7, turning on
    its clock), then stepped into three flat bands, as the pictures draw light;
  - the mouth: a flat ellipse of gold light just under the rim, the open chest full of light (the bowl's front hides
    it from low; the item rises out of it);
  - the motes: 22 small flat discs turned to the eye, drifting up and out through the beam, growing in and out.
- **It follows the lid** (`chestLightK`): none before it opens; swelling as the halves part (`OPENING.open` of the
  dissolve phase), full as they finish; settling to `SETTLE` (0.5) as the item rises and through the reveal and the
  card; dimming in the closing beat; gone as the scene hands back. The washes are drawn at nothing in the approach so
  their program is ready before it opens.
- **Its lamp** (`chestLamp`, the box's own local light in the shared list, main.js updateLights): `LAMP.base` + a
  little more while light leaks at its seam (the wake, the unlatching, the wobbles) + `LAMP.reach` (6 m) with its
  light, raised `LAMP.lift` over the mouth, so his face, his hands and the ground round the chest are in it. The scene
  writes it (index.js leaves it to the scene while it plays); out at its end.
- **The linings glow with it**: `uBoxA.y` goes over 1 while the light is out (`1 + LINING_GLOW · k`), and the
  `MAKERS_BOX` block reads what is over 1 as light on its glows (the linings, the undersides of the halves, the inside
  of the bowl; the temple's petals), the marks still capped at 1.
- **Cost**: four wash draws while a chest opens (the 11 blades and 18 specks were 29 G-buffer meshes), a few ALU a
  pixel over the column; nothing when no chest opens. The same on every preset (Handheld checked).
- The item's reveal (its sparkles, its arc to his hand, the sword and the guard as they come out) is as it was.
- `tests/chest-light.test.js`: the curve, the lamp, the washes (one program, additive, not in the G-buffer, out of the
  pass when disposed), and in a makers' and a temple opening: no light before it opens, light and lid rising
  together, its lamp with it, full as the halves open, the linings over 1, settled on the card, all gone after.

The camera takes one of four plans per box (`BOX_PLANS`, `boxPlan(id)`: a stable hash of the box's id;
the desert's first box always the first): **shoulder**, low over his right shoulder, then beside him;
**left**, the same over his left; **side**, from the box's flank at its height with him in profile, then
a cut to past where the box stood, back at the item and his face; **high**, from above his shoulder down
on the box, then beside him. Where a plan's lens would stand behind a wall or a cliff (`clearPlan`: rays
from his chest), the box falls back to the first plan. (The cinematics QC pass: the same shots for all 32.)

**The lens and the room** (`clearLens`, issues #292 and #293). Every frame, seen from his chest: where a wall, a
roof or a gate stands between him and the lens, the lens comes in to `LENS_GAP` (0.25 m) short of it, and never past
it; where that would bring it nearer him than `LENS_NEAR` (1.3 m), it swings round him about his upright (the aim
kept; steps of 0.3 rad each way, the nearest that clears) and eases there (`SWING_RATE`), keeping the swing it has
while that still clears. Then it is lifted off the floor under it, probed from as high over the lens as stands clear,
never through a roof. Until then the lens was pulled to `max(0.9, hit − 0.25)`, behind any wall nearer than
1.15 m, and the floor probe from 2 m over the lens found the yards' alcove roofs and set the lens on top: the
founders', moorers' and divers' boxes opened through the gate's bars and went blank at ~8 s. In the **closing shot**
the aim turns toward his head (the least turn, `keepHead`) where it would be outside `HEAD_FRAME` (0.7 of the
half-frame across, 0.6 up: inside the letterbox's picture); the Givers' guard used to end on an empty corner, the
lift valve on the lid against the wall, the gun with him at the edge (its `try` shot now aims nearer him, a third
in). Out of a closing shot the room moved (`cramped`), the hand-back cuts instead of blending: the blend swung through the wall and off him. The review page holds a yard's gate open as play leaves it (`held`, src/gadgets/world.js), so the opening is
judged as the player sees it. `tests/boxes.test.js`: in walled rooms (an alcove with its gate 0.45 and 0.9 m behind
him, an open one, a closed room 4.4 m across) every plan and beat keeps the lens in front of every surface, under
the roof and in the open, and his head in the closing shot's middle 80 %.

**His head in the opening too** (issue #334). `keepHead` now frames the opening as well, with a subject: the chest
until the reveal, then the item over his hand. Where his head is outside `HEAD_FRAME`, the aim turns the least toward
it. Where that would push the subject out of `SUBJECT_FRAME` (0.8 across, 0.75 up), the lens **rises**, the least that
keeps both in. It rises at most `FIT_LIFT` (1.1 m), `LENS_GAP` under a roof and never out of sight of his chest
(`liftRoom`). Only where rising is not enough does the lens widen, by at most `FIT_WIDEN` (10°). Both ease at
`FIT_RATE` (4/s), and jump at once on a cut. The lift valve's and the gun's chests had opened with the lens pulled in
behind his back and his head above the frame; now the shot looks over his shoulder down onto the chest. A forced
**side** plan in a yard's alcove had shown only the chest's flank, close; now it rises over him. The open world's
shots barely change: where his head was already in, nothing moves; where it sat high, the aim tips up a little.
`tests/boxes.test.js`: in the walled rooms and in the open, under every plan, every opening frame has his head
within `HEAD_FRAME`, the chest in the picture until the reveal, nothing between the lens and his head, and no jump
of 0.3–1.5 m in a frame. One case is left out on purpose: the high plan forced in an alcove 0.9 m deep, whose lens
sits over the roof's lip and is pulled in as the lip comes between. Play never picks that plan there (`clearPlan`
gives the shoulder).

**A hand-back near play's lens blends** (issue #334). After a beat the hand-back cuts (see above). But where play's
lens (the camera as the rig has it this frame: `boxes.update` passes it to `scene.update`) stands within `CUT_NEAR`
(1.6 m) of the closing shot's and turned less than `CUT_TURN` (30°), a cut reads as the camera jumping. The gun's
read as a pop under the side plan, 0.7 m in one frame. There it blends instead, over `NEAR_BLEND` (0.6 s), as long as
the way between is clear of the room and keeps `CLEAR_OF` (0.35 m) from his upright (`nearPlay`).

**The card** (`card.js`): the item's name and its one description (`ITEMS[id].text`, issue #165), or, for a placement with `found` (an i18n key:
the desert's battery, `box.found.backpack`), one short line said instead (it carries a tone, stripped when shown; FR in
`src/i18n/fr.js`). Its buttons name what to press with the menus' glyphs (`src/pad-glyphs.js`): `A / ×` (Enter on the
keyboard) on Continue, `B / ○` (Esc) on Skip, nothing on touch (v1.41). **The item comes first** (issue #82: on a
handheld's screen, under 980 px wide, the card sat in the middle, its words over the lift valve the scene was holding
up): the card is a low strip along the foot of the screen, in the letterbox's bottom band and just over it, at every
size; the name first and largest, the kicker and Continue on its row, then the description under them. Since v1.51
(issue #165) that is one short paragraph, what it is and what it does together, at most 180 letters, its buttons inline
as `{key:verb}` (the player's own, in teal); before, two columns headed "What it is" and "What it does"
(`tests/item-cards.test.js`). The longest card (the Givers' blade's) takes 35 % of an 800 × 450 screen
(`CARD_MAX_SHARE`); the makers' "left for one who has come a long way" line is gone from it.

**The name and what it does** (issue #329, the author: "The new item dialog when I open a chest has too much on it. It
should just tell me the name of the item and what it does. No subtitle. And it shouldn't be 100% width"). The card is
the name, one line under it and Continue under that, centred, no wider than its words or `CARD_MAX_CH` (44 ch of them,
`max-width: min(44ch, 100vw - 24px)`), no longer a strip the width of the screen; the "AN ARTIFACT OF THE MAKERS"
kicker is gone. The line is what the item does (`itemLine(def)`, src/items.js): an item's own `does`, else its
description without its first sentence (what it is, which the items page still shows), else, one sentence with a colon,
what follows the colon; at most `CARD_LINE_MAX` (125) letters, a gadget's or a mode's naming its button
(`tests/item-cards.test.js`, `tests/box-card.test.js`).

**The closing beat** (`beats.js`, v1.3): after the card, a short beat that depends on what the box held
(`beatFor(id, def)`: `ITEM_BEATS`, then `KIND_BEATS` by the item's kind), on a closing shot that keeps
to the plan (`closingShot`: mirrored for **left**, swung toward his side for **side**, raised for
**high**), each at most `MAX_BEAT` (2 s):

| Beat | Items | What happens |
|---|---|---|
| `try` | gadgets, gun modes (only what shoots), not the fluid gun | held out in his right hand, it fires once: a spray of light ahead, a kick back, its sound (the mode's own shot) |
| `none` | the battery, the fluid gun | no beat: he wears the battery from the card on; the gun is in his hand once play is back (issue #786: no firing to watch) |
| `wear` | cosmetics (the pale star) | pinned on; a close look at it worn on his lapel |
| `keep` | charms | turned over in his fingers, then pocketed with a soft chime |
| `fit` | battery upgrades (coil, chamber), the battery's parts (the lift valve, the jets, the wings, the bellows), the Givers' blade and guard | the battery's to the battery at his left hip (`FIT_HIP`, `stowFor`; issue #728), the blade and the guard over his shoulder onto his back, a click; shot from behind him |
| `point` | the glyph lens, the listening shell | held up, he turns (≤ 70°) toward the nearest box still shut (`pointAt`), a thread of light that way, a faint answer |
| `play` | the bell-note whistle, the echo shell | to his lips: the bell's note, or a few notes on the shell; notes of light rise |

The item is granted as the beat starts (the star is on him for its look). The item asks for its own
timing too (`timingFor`): a gadget's box wobbles three quick times, the last the biggest; a charm's or a
battery part's only twice, gentler, opening 0.7 s sooner (it pays for the beat); the **side** plan holds its
reveal 1.15 s (it cuts to a new angle there). E / A on the card plays the beat; Esc / B on the card goes
past it, and in the beat ends it. After a beat the camera cuts back to play (its closing shot faces him,
and a blend would swing through him) and hands back in 0.5 s; `fit`, shot from behind, blends.
`?boxPlan=<name>` forces a plan (the QC script's `--query boxPlan=high`).

Since the author's desert playthrough (October 2026, issues #58 and #70): **nothing is fired before there is
something to fire it with.** The battery and its parts used to be `try`, held out and fired: the battery
sprayed light out of the city's chest and the lift valve did the same by the pool, long before the gun. Only
gadgets and gun modes are tried now (`tests/box-beats.test.js` checks every item). **Nothing shrinks away
into him**: put away in a beat, an item goes at its hold size and is gone; in the hand-back the hovering item
is simply gone (it flew to his chest and shrank to nothing), being his now, where it lives. **The battery comes
out as it is**: the desert's placement has `dry` (a function of the game, as `src/story/desert.js` leaves the
battery: empty unless the pool has risen), and the scene draws the glass empty (`BoxScene.fill`). **Nothing over the
card**: toasts wait while `#boxscene` is on (`HOLD_TOASTS`, src/ship/cinema.js) and nobody's balloon shows
(main.js), so the square's murmurs no longer come up over it.

## What comes out: the thing in use (issue #242)

**What rises out of a chest is what he will use**, built by the same code (`model.js buildItemModel`, which the
menu's pictures, `src/item-icons.js`, and the items page draw too). The Givers' blade came out as a thin jade
spike on a brass rod while the hand held a broad blade of living fluid; now:

| Item | Its reveal | Built by |
| --- | --- | --- |
| `sword` | the held sword: the wrapped grip, the brass collar and cup, the blade with its currents, ripples, meniscus and breathing glow | `fluid-sword.js buildSword({ key })` |
| `shield` | the guard open as raised: six brass petals in the riveted ring, the disc of the sword's water round them, its pale lemon rim (issue #284) | `shield.js buildShieldFace` (the held `ShieldDevice`'s face, `poseFace`) |
| `backpack` | the makers' battery, unworn (no clip), tipped as its reference lies | `fluid-tool.js buildFlask` (`boxes/model.js tankModel`) |

Each fluid has a material of its own (`key: 'box.item.<id>'`: the same options as the one in use, so the same
look, but the box winds its clock, not the held sword's). `tickItem(model, fluidMaterials(model), { time, fill })`
runs a frame of it: each fluid's clock and fill, its kind kept (the box used to write the battery's kind over every
fluid), and `userData.tick(time, fill)` on the parts that move of themselves (the blade's breath and its bead, the
guard's strokes). The scene scales the item (`ITEM_SCALE`, then `HAND.scale` over his open hand), so a model scales itself
on an inner group. Anselm's upgrades (`light`) and the trials' (`trial`) wrap these models, so they follow.
`tests/item-reveals.test.js` checks each against its in-use model (the same meshes, the same fluid kind).

Left as they were (issue #283: the author asked for the sword and the guard alone): the wings (three leaves of
colour on a brass rod: `wingsModel`), the fluid gun's glove (brown with a cream cuff: `gadgets/gun.js gunModel`), the lift valve (its valve, wheel and fins, the parts of the battery's first stage, on their
own) and the Warden's bellows (worn, only the battery's third-stage valve shows: there is nothing on him to match);
the gadgets already build their reveal from the model they hold (`bombBody`, `fanModel`, `lensModel`…).

## The temples' little key chests (issue #274)

Every temple key is in a smaller makers' chest (src/temples/pieces.js `Key`; docs/systems/temples.md, "The key's
little chest"): `buildBox(id, { scale })` sizes the shader's marks for the scale it is set down at (1.0, the great
key's 1.3), and its short opening reuses `ChestLight` with `reach` (the column's height and top as a share of a box's)
and `chestLamp`. Not a box: no scene, no camera; the player keeps moving, a small key says itself in a toast.

**The map's and the great key's card** (issue #486): those two are announced as a box's find is. As the key (or the
map) comes clear of the light, `Key.announce` emits `'temple:found'` { id, el, kind, name, text, done }; the world's
boxes (`createBoxes`) answer with `boxes.announce`: the box's own card (`BoxCard.show`, the screen's `boxCard`, so
the engines draw it too) with its name and a toned line (`MAP_CHEST`, `GREAT_KEY_CHEST` in pieces.js), no scene.
`boxes.busy()` is true while it is up (input cut, as on a box's card); A / × after `CARD_MIN` or B / Esc puts it away
and calls `done`, and the key, held hanging over its chest till then, goes on into the counter. Where nothing shows
the card (no boxes, a box opening), the line is a toast as before. Once per chest: a load leaves it open and quiet.

**The great key's look** (issue #486, the author's pick `references/objects/great-key/sheet-1.jpg`):
`greatKeyGeometry()` (`GREAT_KEY`): a bow in the makers' mark (the shared contours, `src/makers-mark/shape.js`
`markShape`, extruded: pale stone proud of a bevelled brass rim), a brass collar, a pale stone shaft with a teal
channel front and back, a ward of three steps, a brass foot; three meshes (the house's `trimMat` and `stoneMat`, a
self-lit teal of its own, the same in every house), about 900 triangles. The small key keeps its ring, shaft and two
bits (`keyGeometry()`).

## Where a chest stands (the rule)

A makers' chest is a gift left on purpose (docs/story-bible.md, "The boxes"), so it stands **somewhere that feels
important and free of environmental noise** (the author, issue #81): on a place made for it (a dais, a ledge, a
pedestal, a plinth), where the space's lines meet (at the end of the way in, the foot of the way on, the middle of a
room's axis), in light (a shaft through a crack, a lamp, the open sky), **with nothing round it within 3 m** but the
ground it stands on: no rocks, rubble, roots, bones, crates or props piled beside it, no wall it is pushed against.
It faces the way you come to it. Never "on the floor beside" something: a chest at a random spot reads as a dropped
thing. And it is **there when it makes sense in the story**: one whose gift follows a step (the lift valve after the
pool has filled your battery) waits, shut, dark and silent, until that step is done (`ready`, below). The lift valve's
chest (v1.45) stands on its own round dais in the makers' shrine by the giant's pool (since issue #156: below), under a
fifth crack's shaft of light (`cave.chest`, src/desert-city.js); `tests/desert-cave-exit.test.js`
checks that nothing stands near it, that it faces the pool and that the light falls on it.

**Waiting for a step** (`ready`, `sealed`, src/boxes/placements.js): a placement's `ready(game, items)` keeps the box
shut until it holds: no hum, no shudder, no light, no beacon; E on it says `sealed` instead of opening it.

## Nothing before the first

`boxesFound(game)` is true once any `box.*` flag is set (a box opened, a temple's chest, an old
save's battery). Until then nothing tells of the boxes: the per-world box quests and their
toast wait, the sketchbook has no "Item boxes" page, the empty gear page says only "Nothing
yet", and the Qanat pilgrim who tells of the roof box keeps quiet. Since v1.68 (issue #273) a
world's box quests are given by the local of the box's part's temple (`givenBy`, `boxLine`: they say
where each is as the last page of their first words), once the first box is found; a box opened
before anyone gave its quest is that quest done (docs/systems/story.md, "Quests are given"). In a
world with no temple's local, or one an old save had been to (`givers.old.<part>`), they start
`BOX_QUEST_DELAY` s after the first box opens, as before.

## Nothing before its tool

A little chest held shut by its makers' court's puzzle or a small lock (`boxTool(placement)`: the court's `needs`, or
`LOCK_ITEM[lock.tool]`) is not spoken of before that tool is yours (issue #557, the author's rule from #518: "I should
have all the tools available at that moment in the game to open them"; `toolHeld`). Most of these tools are the same
world's temple's, so: its quest is not the temple's local's to give till then (`givenBy`'s `ready`: no mark, no line
from them); the arrival's offer leaves it out, and the tool's coming offers it `BOX_QUEST_DELAY` s later; no beacon stands
over the court (a locked chest's is out anyway till its lock is answered); and the locals' lines that point at one ask
for its tool (`{ has: tool }` beside the box's flag, else a line that names no place). tests/box-quest-tools.test.js runs
every little chest of the route through it; tests/little-chests.test.js holds the tool to its world.

## The tree's dais (desert)

The first chest is everything (issue #140, v1.49: "The first chest by the tree shouldn't be on a platform up in the
tree, feels unnecessary … it should be like a temple chest"). It stands on the square at the burning tree's foot
(`city.shrine`), in a clearing between the roots toward the old shrine's corner, left of the trunk as you come up
the avenue from the gate, the bare bark behind it and the low arm reaching over it: a round dais of the Givers' white
stone in three walkable steps (0.3 m each, the top at 0.9 m, `DAIS` in src/desert-city.js: the temples' altar of
`references/Core Objects/Chests/temple/sheet-2.jpg`), a gold band round its top, the makers' ring glowing on it and
their mark on the lower riser toward the avenue; a ring of pale flagstones edged in gold round its foot, nothing else
in the clearing; a soft light over it for the dusk. On it the **temple chest** (`chest: 'temple'` on the placement:
`chestKind` gives the temple chest to the temples' own and to this one, the makers' to every other), with the temples'
opening. Its id is the same (`desert.backpack`), so a save that opened it keeps it opened. (Until v1.49 it stood on a
plank shelf 7 m up the trunk, on a pier over a buttress root: a climb in two pitches.) `tests/boxes.test.js` checks the
place: on the ground, in sight from the avenue, nothing within 3 m, the bark behind, the walk up from the gate.

Issue #160 (the author: the bench out of the close view, the dais taller so it reads from the avenue): the dais was two
steps of 0.22 m, its top at 0.46 m, and hardly showed over the paving from the avenue's end 27 m off; it is three of
0.3 m now (a gold ring on each step's edge, the colliders as many-sided as the drawn steps), its clearing 3.3 m across.
Nour's stone bench stood 3 m behind it under the low arm, in every close picture of the chest; it stands 7 m off now,
out in the square to the left as you come up the avenue, facing the chest, clear of the avenue's sightline, with an
open walk to where she waits at the dais's foot (`tests/qanat-tree-ribcage-reference.test.js`).

## The makers' shrine in the giant's chest (issue #156)

"In the skull cave the chest shouldn't be available until you filled up the pool. It's confusing to show the chest but
you can't open it. We might turn this into a mini temple." The lift valve's chest no longer stands shut and silent on a
dais in plain sight by the keepers' stair: it stands on its dais inside the makers' shrine (`SHRINE`, `buildShrine` in
`src/desert-city.js`), a round chamber of the builders' stone on the cave's floor west of the pool, 5.2 m high (out of a
jump's reach: no way out of the cave over it before the double jump, issue #68), open to the vault so the fifth crack's
shaft still falls on the chest, its doorway toward the pool. The door is a slab of white stone with a glass lens and four
lines at its heart, dull until your battery is full; then they glow (the fill's moment turns to them: "the makers' door by the
pool hums back"), and E opens it: the lens drinks, the door sinks into the floor (`src/story/desert.js`, the flag
`desert.door.open`; its collision is a box the story adds and takes away). The quest has a step for it ("Open the makers'
door with your full battery") before "Open the chest in the makers' shrine"; the chest's `ready` is the door open. Inside, the
chest has its 3 m clear and faces the door and the pool. `src/save-migrate.js` step 19 opens the door for a save that had
the lift valve and sends a save waiting at the chest back to the door. `tests/desert-playtest.test.js`,
`tests/desert-cave-exit.test.js`, `tests/desert-story.test.js`.

## The mound (issue #162)

"For the first backpack chest on the desert I want it to be on an elevated surface but with a smooth incline, not steps,
so it's easy to get on without janky animations. Make that the default for all the major chests across the world."
Every major chest stands on a mound (`src/boxes/mound.js`): a low round plinth whose side is one straight ramp from the
floor to its flat top, its top edge rounded a little, walked up from any side with no step to climb. `chestMound(x, y, z,
{ h, top, foot })` gives a kit's `both` its drawn lathe and its solid frustum (the feet stand where the stone is drawn).

| Chest | Height | Top r | Foot r | Slope |
|---|---|---|---|---|
| the desert's first, under Qanat's tree (`DAIS`) | 0.9 | 1.6 | 4.4 | 0.32 |
| the thirteen temples' chests (`MOUND`) | 0.62 | 1.4 | 3.3 | 0.33 |
| the Givers' guard, the Givers' House's second chest | 0.3 | 1.3 | 2.1 | 0.38 |
| the Givers' gun, off the Hearth's hall | 0.5 | 1.5 | 2.85 | 0.37 |
| the lift valve's, in the makers' shrine | 0.6 | 1.25 | 2.85 | 0.38 |

The chests stand as high as they did (every gadget site is where it was). Under Qanat's tree the wider mound stands
further out from the trunk (its centre is found the same way, a stride of square clear of the bark), its ring of
flagstones out to 5.4 m, the makers' mark laid in the flagstones in front, a gold ring round its top and its foot; Nour's
bench keeps 7.5 m off it. Not on one: the Whale-House's chest on the Horn Chamber's shell pulpit, 3 m up, which its riding
disc is there to reach (the room's puzzle), and the small makers' chests in the open (gifts left about the worlds, not the
major ones). `tests/boxes.test.js` walks up to each major chest from 4.6 m in front of it: no step over 6 cm, no slope over
0.4; `tests/qanat-tree-ribcage-reference.test.js` the desert's from the square.

## What comes with an item: the gun's two modes in one chest

An item may name what comes with it (`with` in `src/items.js` ITEMS, carried through a gadget's def by
`src/gadgets/registry.js`): `items.grant` grants those too. The fluid gun comes with ember mode (issue #83, v1.45: "doesn't
make sense to pick up ember mode and fluid mode as two chests in the same place"), so the Givers' Hearth has one chest,
`desert.gun`, on the dais of a round room of its own off the hall's east side (`src/desert-hearth.js` CHAMBER: a short
passage under a carved arch with the Givers' mark, the hall's glowing floor marks running in to a ring round the dais, a
warm light over it; the hall's own materials). A spare gun by the ship in a later world brings ember mode too.
`tests/boxes.test.js` counts what comes with a box's item as in that box; step 14 of `src/save-migrate.js` merges v1.44's
two chests.
