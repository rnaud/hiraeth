# The fluid blade and the foes (v0.89; captured attacks v1.3)

The first things in the game that fight back, and the tool's answer to them.

## The fluid blade (`src/fluid-blade.js`)

- **Input:** F, RB / R1, touch ⚔ (`toolInput().blade`; `PadBlade` in `src/controller.js`). It comes with the
  backpack: no item, no box. It costs no charge. On a pad, LB held with the right stick still zooms.
- **The combo:** a press swings (the first cut takes 0.62 s); a press during a swing or within `BLADE.chain` after it
  chains the next, up to three: right to left, left to right, then a heavier overhead (`BLADE.damage` 1, 1, 2),
  then `BLADE.cooldown`. A press the blade can't act on yet (during an evade, the cooldown) is kept `BLADE.buffer`
  (0.2 s) and swings as soon as it can (v0.96).
- **The cut's pull** (`MAGNET`, `closeInSpeed`, v0.96): a swing begun with its target (the lock, else the soft lock)
  a little out of reach steps you in through the wind-up and cut, to stand `MAGNET.ideal` (1.2 m) off its body, up
  to `MAGNET.max` (2.2 m) of ground; in reach, or further, nothing. Not the lunge (it carries you itself) nor in the air.
- **The swings:** `SWINGS` retains anticipation through follow-through from three Mixamo clips.
  `attackSample` maps separate wind/active/recover durations (0.22/0.16/0.24 s for the first,
  0.25/0.17/0.26 for the second, 0.36/0.20/0.34 for the heavy third) onto source time.
  Grounded swings use the legs and hips. `Animator.playCombat` blends clip changes (and the way back to
  locomotion) over 90 ms from the displayed pose, including motion matching when enabled (v1.3: it had
  blended nothing, `isBone` finding none of the library's plain-node joints; a swing into the next jumped up to
  2.3 rad in a frame). Grounded cuts step forward through Player's normal collision movement and limit
  steering until recovery. Every attack played from a clip is in `ATTACKS` (the three, the whirl, the lunge,
  the charge, the air cut, the riposte, the dash cut).
- **On the clip's own swing frames** (v1.3): each attack's cut (`activeRange`: `activeFrom`–`activeTo`, else
  `hit` −0.08/+0.1) is where its clip's blade moves fastest, measured on the traveller (the tip's speed through
  `from`–`to`): the three 47/36/30 m/s at 0.60/0.81/1.13 s, the whirl 27 at 1.06, the charge 22 at 0.66, the air
  cut 18 at 1.16, the riposte 33 at 1.39, the dash cut 43 at 0.56, each well over its speed round the cut. `tests/blade-attacks.test.js` checks it, so a clip's
  times can't drift off its swing. The trail follows the same window (`trailCut`): through the cut the fluid's wake and drops off the
  edge and sparks over the ground the edge crossed since the last frame (v1.7: "The look" below), else one glint
  at the tip; while charging, sparks drawn in to the blade. (The studio's paused `time` is not the clip's: its
  0.4 s is about 0.85 s of the clip. Measure in the game, as the test does.)
- **The charged cut** (`CHARGE`, v1.3, the Great Sword pack's slash `gs_slash_1`): the blade button still held
  `CHARGE.after` (0.2 s) into the first swing's wind-up (not chained, on the ground) turns it into a charge
  (`FluidBlade.charging`): the clip drawn from 0.3 s to its cocked pose (`hold` 0.45 s, the sword back over
  the right shoulder) over 0.18 s, blended in from the swing over 0.2 s (`playCombat`'s `blend`), and held
  there with a slow breath (`chargePose`) as long as the button is; a slow step at most (`combatMotion.scale`
  0.3), turned to the nearest foe; the blade pulses; full after `CHARGE.full` (0.6 s): a white ring and a ping
  (`sound.fluidCharge`). Let go (or leave the ground): `release()` plays the clip's swing from 0.45 s (cut
  0.54–0.76 s, 0.07/0.17/0.36 s), cone half-angle 1.5 rad, reach 3.3 m, the cut's pull as a swing's;
  `CHARGE.damage` [2, 3] (not full / full), heavy (combo 2: the knockback, the hit-stop 0.11, full 0.15), and
  `breaks`: Foe.hit reels any foe it touches, armoured or committed to its blow. Then the cooldown, as after a
  third swing (`ENDS`). An evade cancels a charge. A tap is the light swing as before.
- **The air cut** (`AIR`, v1.3, the Great Sword pack's jump attack `gs_jump_attack`): a swing begun in the air
  (not the rising cut) plays the clip from 0.72 s (the sword going up) over the whole body, its own rise left
  out (`swingMove.air`: `playCombat` `full` and `ground` in the air): `player.airKick` holds the body up at
  the top (`lift` 2 m/s) through the wind-up and carries it in to a foe up to `pull` (3.5 m) out of reach, to
  stand `ideal` (0.7 m) off its body; as the cut starts (0.98 s) the body is driven down at `plunge` (12 m/s)
  and the overhead cleave (to 1.24 s) lands with it, its cone tipped `down` 0.6 rad. Damage 2, heavy. One an
  airtime (`airUsed`, reset on the ground): a press in the air after it waits for the ground (the buffer).
- **The riposte** (`RIPOSTE`, v1.4, the Sword and Shield pack's slash 4 `ss_slash_4`): a perfect parry
  (`block()` → `'perfect'`) opens a `window` of 0.6 s (`riposteOpen(sinceParry)`); a blade press in it (the
  guard may still be held) plays the clip's overhead chop from 1.05 s (cut 1.30–1.43 s, 0.12/0.12/0.30 s). The
  chop comes down `turn` (1.3 rad) to his right, so he is turned that much to his left into it at once (and his
  walking lead is off: `pose.lead`), and the cut's pull brings him to `ideal` (0.5 m) off the foe's body. Damage
  3, as a full charge (doubled on the foe the parry left stunned: 6, the end of any foe so far but a boss), heavy, `breaks` and `stagger`: Foe.hit holds it reeling
  1.2 s at least (`reel` `'riposted'`). A gold ring and `sound.fluidRiposte(false)` as it starts; landed, a gold
  burst off the foe, the hit-stop 0.15 and `fluidRiposte(true)` (a bell under the blow). One a parry; the window
  missed, a press is what it was (nothing while the guard is held, else the first swing).
- **The dash cut** (`DASH`, v1.4, its attack 2 `ss_attack_2`): a press during an evade (`dashWant`), or within
  `late` (0.15 s) of its end (`sinceEvade`), with the dash cut's `cooldown` (1.5 s, `dashCool`) over, plays it
  the moment the evade ends (`dashOpen`): the clip from 0.3 s, cut 0.49–0.64 s (0.16/0.14/0.26 s), a sweep from
  his left round to his right (cone half-angle 1.7 rad). Player's controller carries him (`combatMotion.dash`,
  set like the evade's) toward `past` (1 m) beyond a foe within `pull` (5 m), `side` (1.1 m) to its left, so it
  passes on his sword side and the sweep crosses it, at what that takes over the wind-up and cut (5.4–16 m/s;
  no foe: 9 m/s straight on), slowing through the follow-through; still facing the foe. No i-frames of its own:
  the evade's window is over before it starts. Damage 2, heavy; the cooldown, as after a third swing. Within its
  cooldown a press out of an evade is the plain buffered swing. `tests/blade-attacks.test.js` checks both
  (window, damage, stagger, chop on the foe's line, the carry past the foe, no i-frames, the cooldown).
- **The arm (the arcs):** the swing drives the tool's aim pose (`player.aim`, the same IK the shots use) along
  `swingArc(n, u)`, so the body turns to the swing. It turns toward the nearest target with `lock: true` within
  `BLADE.lock` (6 m), else where you face.
- **Guard:** Ctrl or Z / LB / L1 / touch ◇ independently opens the shield on the left hand (below: *In the hands*); it covers what it covers as drawn. A fresh guard has a
  0.18 s parry window (0.35 s rearm), consumes that opportunity on contact, and spends no charge.
  A held guard spends one charge per block. Both require facing the blow. A parry leaves the enemy
  open for 1.8× its normal recovery; an ordinary block for 0.65×. Guard cannot cancel an active cut.
- **Evade:** Alt / B / ○ / touch ↶ moves in the input direction, or backward without input, for
  0.28 s with a 0.65 s cooldown. It uses Player's collision controller and may cancel attack recovery
  but not wind-up or release. It is available on the ground.
- **The evade's i-frames** (`EVADE.iframes`, `iframeWindow`, `evadeInvulnerable`, `FluidBlade.dodge`): from
  0.03 s to 0.24 s into the evade (0.21 s of its 0.28; Gentle `EVADE.gentle`, 0.02 s to its end) no foe's blow
  lands. `Player.dodge(from, kind, gentle)` asks the blade first thing in `Foes.strike` (a melee strike, a lob, a
  volley, a charge, a flash, a harpoon's line or a root's grip: no harm, no line, no blinding), as a shockwave's
  front crosses you (marked `dodged`, spent) and on each tick of burning slag (no burn while the window is open;
  stand in it after and it burns: lingering ground is not swallowed, only crossed). The first blow an evade
  swallows is a perfect dodge (`'perfect'`): a 0.05 s hit-stop, a slight kick, a white ring at the feet and a
  hum; Ink tide wraps `player.dodge` for `TIDE.dodge` style points ("Dodge!"). No unbroken cover: when a window
  closes `EVADE.rest` (0.3 s) must pass before the next can open, so an evade begun sooner (the Light feet boon's
  shorter cooldown) has none (`evadeGranted` false). At the usual pace (the 0.65 s cooldown) each evade has its
  window, and back to back they cover a third of the time. `tests/evade-iframes.test.js` checks the window,
  every kind of blow in and out of it, the spam gaps, Gentle and the overlay.
  Push is a gun mode; calling a mount is D-pad ↓ (v0.93: docs/systems/controls.md, "The layout").
- **The flinch:** a strike that lands without knocking you down plays the pack's impact on the upper body
  (`Player.flinch`, `FLINCH`).
- **What it hits:** during the active cut, coarse cone/range and wall checks find candidates, then
  a swept segment from the glove to the blade tip checks contact with target volumes. Each target
  is hit once per swing. Without a loaded character clip, the original cone is the fallback.
  Wildlife scatters once per swing; other non-blade targets do not take damage.
- **The look** (v1.7, `src/fluid-sword.js`; the selected design, `references/Core Objects/Reviewed Gadgets/Fluid
  Sword - Selected 2026-10-09/reference-3.jpeg`): a broad blade of turquoise fluid out of a brass cup, on a
  leather-wrapped hilt (the hilt: `docs/systems/traveller-kit.md`, "The fluid sword").
  - *The blade* (`bladeEdges`, `bladeGeometry`): `BLADE.length` 0.85 m, `BLADE.width` 0.111 m at its widest, narrow
    where it leaves the cup (0.048 m), splashing out to its width within a tenth of the way (its edges ragged
    there, as water thrown: a fixed jag over the first 30 %), the leading edge (`+x`, the edge that cuts) nearly
    straight, the trailing edge curving up into a long point that leans to the lead. A lens in section, 17 mm
    through its ridge, thin at the edges, the two faces split at the edge so the ink draws it; 792 triangles.
    `aFold` carries across (-1 trailing .. 1 leading) and along (0 .. 1) for the shader.
  - *The fluid* (`src/materials.js` fluid kind `blade`, 6: `bladeFluid`): turquoise (`SWORD_TONES.base`) with
    sand-cream currents (toward the trailing edge, from a quarter of the way up) and deep teal pools (more by the
    hilt), noise stretched along the blade so they run as streaks, flowing up it over time; soft where they meet
    (v1.11: ringed by its own fine teal pen line, the post pass drawing only the outline: *Alive* below); a bright ridge down the middle, a pale rim on the leading
    edge and a gold one on the trailing (as the sheet draws them); a little self-light (`glow` 0.5). The colours
    are the sheet's, not the gun mode's (the old blade took the tank's tones).
  - *Growing* (`bladeGrowth`): as it lights for a swing it grows out of the cup to `bladeLength` (the reach step:
    `REACH_UP` longer, as before) and fills out from 30 % to its width; `bladeWidth` is `BLADE.width` broader by
    `INK_BROADER` (10 %) for each step of ink reached (`src/ink.js` UPGRADES: the reach, the whirl, the lunge), so
    the ink shows on the blade. The width is only the look: hits still use the segment (`bladeSegment`).
  - *Trailing fluid* (`BladeWake`, `wakeStyle`, `shedDrops`): through the cut (the same `trailCut` window as the
    sparks: each attack's `activeRange`) each frame lays the blade's segment into a wake of two ribbons
    (`WAKE_STRANDS`: one off the outer fifth of the blade, a thinner, shorter-lived one off its middle), which
    narrow to their outer edge, fall and dissolve into print dots over `life` (MODE_RIBBON, the hover trail's
    dissolve; bands of `WAKE_TONES` fixed along it; one mesh, 16 samples a strand). Drops fly off the outer part
    of the edge with a third of its speed (capped at 9 m/s) and fall (`tool.drops`). The style by attack: the
    combo and others alike; the charged cut wider and spilling more (more still when full); the riposte gold; the
    air cut thrown down (more gravity); the dash cut the longest streak. The sparks stay, fewer (up to 6 steps
    on the outer part: the wake draws the sweep). Through the wind-up and follow-through, a glint at the tip and
    now and then a drip off the splash by the cup; charging, the gathering sparks and drips.
  - *Cost*: three draw calls held (grip, brass, the bead), four lit, five through a cut; in the Arena (High) the
    lit sword draws 13 calls over every pass (14 before), 7.6k triangles (the mesh is 2.5k); placing it and the
    wake take about 0.01 ms of CPU each a frame. Tests: `tests/fluid-sword.test.js`.
  - *Alive* (v1.11, `src/blade-shader.js`, `FluidBlade.alive()`; `tests/blade-shader.test.js`): the blade moves
    inside, answers the swing and the blows, and glows. All in the G-buffer shader and a few uniforms: no pass, no
    texture, no draw call added (the sword still draws 11 calls over every pass mid-swing in the Arena, High).
    - *Inside*: the currents run on their own clock (`uFluidA.z`: the game's time plus `flowExtra`, which runs up to
      `BLADE_LOOK.flow` (2.5×) faster while it smears). Fine pale ripple lines (a second warped field's middle, a pen
      width at any distance, gone where they would crowd under a pixel) and small bubbles rising toward the point
      (a pale ring and a glint, each column of 2.5 cm cells at its own pace) drift through it. A fine darker-teal pen
      line rings the cream currents (the post pass draws nothing inside the blade now: below).
    - *The skin*: the outermost 3–7 % of the width is a meniscus that comes and goes with a slow wobble (discarded,
      so the outline itself wobbles; whole by the cup and at the point); a thin bright line just inside it on the
      leading edge (gold on the trailing), a pixel and a half at least, over the bloom threshold (a faint halo).
    - *The swing* (`bladeSmear`, `bladeLag`): the point's speed (world, frame to frame) smears it (0..1, whole at
      `smearAt` 30 m/s; in fast, out over ~0.2 s): the currents stretch back across the blade, the side it trails
      frays. The fluid trails the point by `bladeLag` (speed × 1.6 ms, at most 7 cm), turned into the blade's own
      frame (`uBladeB.xy`): the vertex shader bows the outer blade back along it (`v^1.6`) and stretches the trailing
      half out, with a wave running up the edges. Through the cut more drops fly off the point (`shedDrops`'s `near`
      0.85, one or two a frame when it smears past 0.45), and the drops fall to the ground at his feet and splash
      there (`Dots`: a drop's `floor` and `land`; two droplets pop up and a flat splash spreads and fades).
    - *The blows* (`rippleAt`): a hit sends a bright ring along the blade both ways from where it struck (the hit
      point projected on the blade; heavier for the third swing and the specials), a block a ring up from the cup,
      a perfect parry a gold one and the blade flares out of the cup a moment (`lit` 0.9, then back), the charge
      gathered full a ring; each with a flash of the whole blade (`uBladeC.z`, gone in ~0.3 s) and the bead swelling.
      The ring bulges the edges as it passes.
    - *At rest*: in the fist between cuts a short tongue of the fluid stands out of the cup (`bladeIdle`: 11 % of the
      blade, 9 cm, breathing ±12 % on a 3 s breath, eased in and out with `idleK`; the hits still use `lit`); the bead
      in the cup breathes on the same beat, on the back too.
    - *Light* (`bladeLight`, after the light term as the chimes' crystal): a pale rim where the faces turn away,
      flecks of sunlight on the ripples (no sun: a softer glint off a light over your shoulder), never under the toon
      threshold. The glow (`BLADE_LOOK`): 0.5 by day, breathing +0.07, +0.04 with the magic bar full (all under the
      bloom threshold 0.62), +0.16 after dark (`uNight`, or no sun): over it, so at night the blade is lit from within
      with a printed halo round it, and reads in the dark. The edge line, the bubbles, the flecks and a ring glow over
      the threshold by day too.
    - *Ink*: soft ink (`gHatch.a` + 8, as the chimes and the makers' boxes) with a pen share of 0.5: post.js draws its
      outline half pen, half a darker shade of the water, and nothing inside it (no colour-edge, crease or shadow line
      across the currents, no hatching): the shader's own pale ripple lines and teal pen line draw its inside.
    - *Lite* (`BLADE_QUALITY.lite`, `bladeLiteFor`, said by main.js applyDetail; `uBlade.w`): the handheld (its lighter
      ink pass), Low, and a desktop Auto that had to drop resolution leave out the ripple lines, the bubbles, the
      extra drops off the point and the splashes; the currents, the skin, the swing's bow, the rings and the light
      stay. The Deck keeps the whole look.
    - *Cost* (M4 Pro, Chrome ANGLE Metal, 1280 × 720; the Arena, the first swing frozen on its cut, GPU-synced
      renders): the sword's draw calls and triangles unchanged (11 draws, 7.4k triangles over every pass, High);
      its render cost at play distance under 0.1 ms either way, close up (the blade filling the screen) +0.2 ms
      against +0.1 ms before; `place()` 0.02 ms of CPU (0.017 before). Deck preset: the same draws, the frame
      within ±0.2 ms.

## In the hands: the grip and the shield (`src/blade-grip.js`, `src/shield.js`, v0.93)

- **Carried by the bones.** The hilt is a child of the right hand's bone and the shield's bracer of the left's,
  so they are wherever the hand is drawn after every layer of the frame's pose (clips, motion matching, combat
  moves, aim and foot IK, scene overlays): no lag, nothing to update in order. `carry` parents them;
  `fitScale` undoes the bone's world scale (a taller body holds the same sword).
- **Where in the hand** is read once per body from its own fingers (`fistGrip`): in the fist pose each finger
  wraps round the grip, so the circle through its three joints is centred on the grip's axis; the line through
  the four centres (little finger to index) is the grip, the blade out on the index's side, the edge the way the
  fingers point out of the palm (`+x` of the hilt), the flat to the palm. The hilt's origin is the middle of
  its grip. On the swings the edge leads the tip's motion (|cos| 0.93–0.99), which tests check. The bracer
  (`bracerMount`) sits on the back of the left hand, over the middle of its bones.
- **Drawn or put away** (`bladeDrawn`, `STANCE`): in the fist while swinging, guarding, evading, locked on, or
  within `STANCE.linger` (2.5 s) of any of those or of a blow taken; put away at once when the tool may not act
  (climbing, swimming, gliding, the jets, riding, aiming the gun, knocked down, a scene or a conversation). The
  hands close round them (`player.swordGrip`, `player.shieldGrip` → `handTargets` `sword` / `shield`).
  Put away, the hilt sits in a leather frog on his back, behind the right shoulder (`src/sword-sheath.js`;
  `docs/systems/traveller-kit.md`, "On his back"): drawn, the right hand reaches back over the shoulder for it
  (0.34 s), put back the same way (0.36 s), and with the arms busy it flies back at once (0.15 s). A press with
  it on the back swings on that frame, every attack's timing and cut unchanged: the hilt comes to the fist in
  0.12 s, before any cut opens, and the blade lights only in the fist (`FluidBlade.place`: `sheath.held`).
  The hits always read the fist's own frame (`gripMatrix`), never where the hilt is drawn on its way.
- **The blade's segment** (hits) is read from the hilt's own frame, so it is the drawn blade exactly.
- **The shield** (`ShieldDevice`): the brass disc always on the hand with the backpack. Open, it is 0.35 m in mean
  radius (`SHIELD.radius`): a collar of six brass petals (`SHIELD.petal`) and a brass ring round the hub, the
  only solid parts; beyond them the fluid as a blob, not a disc: its edge `blobRadius(θ, t, wobble)`, three waves
  of 3, 5 and 8 lobes running round at different speeds (about 0.86–1.1 of the radius), rippling more as it
  spills out, on a block and cracked (`ShieldState.wobble`). It is drawn in flat two-sided strokes rebuilt each
  frame (`Stroke`): five strokes of the tank's fluid swirling out from the collar and turning slowly round the
  hub, a bright wavy rim with an ink line just outside it, a ripple running out to the rim while held (the
  game's materials are opaque: the see-through is the gaps between strokes). `ShieldState` is the
  pure state machine (folded → opening → open → closing, and broken): it opens in `SHIELD.open` (0.16 s; the
  guard counts as up at `guardK` 0.5, unchanged), the six petals spinning out one after another, the fluid
  flooding out to the rim after them; held a ripple runs out; `hit('block')` flares it (two ripples running out past the rim), `'perfect'` bursts two bright blob-shaped rings off it,
  `'broken'` (a blow within its arc with the tank empty) cracks and flickers it until it mends; it folds in
  `SHIELD.close`. It swivels on the hub to face the guard's way as it opens. Sounds: `shieldOpen`,
  `shieldClose`, `shieldBreak` (src/audio.js), on the state machine's transitions.
- **Coverage is the drawn shape.** Each frame `ShieldDevice.arc` measures the bearings between the shield's two
  edges (`SHIELD.radius` + `SHIELD.slack`) as seen from the chest (`shieldArc`); `block()` tests the blow's
  bearing against that arc (`guardArc`), and the hitbox overlay draws the same arc. With no shield drawn,
  `GUARD.angle` is the arc of one held `GUARD.reach` ahead (about 48°). The reach either side is measured off
  the drawn blob's edge (`ShieldDevice.outline`, 36 points: its furthest along the shield's flat side either
  way, never less than 0.9 × `SHIELD.radius` while it floods), so the arc follows the shape as it ripples.
- **In front of the chest** (`centreTarget`, `SHIELD.pull`, `ahead`, `arm`): as it opens, the shield slides off
  the bracer on a short brass arm (`ShieldDevice.arm`: a rod from a knuckle on the disc to the shield's hub) to
  the chest's middle line, its reach ahead of the chest kept within 0.36–0.44 m, at the hand's height, never
  more than 0.42 m from the bracer; folding, it comes back onto the hand. In the block pose the arc is about
  52° each side, centred within 2° of facing (v1 traveller: left 53°, right 50°; plain body 55° and 51°);
  before it was 45° each side of a line 18° left of facing (63° left, 28° right). `tests/blade-grip.test.js`
  checks 50–55° and ±5° on both bodies.
- **Inspect:** the studio (`studio.html?backpack=true&sword=true&shield=1&view=arms`, any clip scrubbed with
  `anim=clip:mixamo_ss_slash_1&paused=true&time=0.4`; views `hands` and `bracer` for close-ups; `guard=block|
  parry|broken`) runs the blade's own placing code (`FluidBlade.inspect`). `tests/blade-grip.test.js` samples
  every frame of each combat clip on both bodies.

## The foes (`src/foes.js`)

`FOES` holds the tuning. Each foe is a `Foe` (pure logic over plain vectors, tested in node) drawn by `Foes`,
which also registers its target (`kind: 'foe', lock: true, accepts: ['blade', 'stun', 'fire']`).

- **The mind:** idle → chase → wind → strike → recover. Blots coil for 0.7 s, then lunge over
  0.24 s; machines plant and raise their arms for 1.05 s, then slam over 0.32 s. Direction locks
  when the wind-up begins. Damage occurs 55% through the strike, with a wall check. Movement
  checks footing and walls. Every wind-up is told by the body (pose, glow, rising sound: "Telegraphs: the body,
  not the floor" below); only a lob marks the floor. The off-screen warning marker remains. Light hits interrupt blots and the first
  two thirds of a machine's wind-up; the machine's late wind-up and strike commit.
- **What hurts them:**
  - the blade: `info.damage`;
  - a fluid or ember glob: washes a blot (1), only staggers a machine;
  - stilling: holds either for 3.5 s;
  - the push: shoves them.

  A cut breaks a blot's wind-up, and a machine's in its first two thirds.
- **What they do to you:** hearts (October 2026, v1.5; `src/resources.js`), every attack's `damage` in
  hearts, counted in quarters. The table below. A blot shoves you; a machine knocks you down.
- **The reward:** each foe cut down gives a unit of the magic bar back, a third of the starting bar
  (glowing drops fly to the flask).
- **Chimes** (v1.5, `src/chimes.js`; docs/systems/items.md, "Chimes"): each foe cut down also scatters a few
  brass chimes, the currency, by its weight (a swarm blot a chance of one, an ink blot two, a machine six, a shade
  or a golem eight; the 100 world enemies four, six or eight by their category), and a temple's guardian a purse
  of forty, once. Walk over them or come near: they are drawn in. None from Ink tide's foes or one lost out of the
  world; the Arena's are training (`Foes.burst` emits `foe:burst` with the kind, the category, where and `lost`).

### The damage table (hearts; v1.5)

The traveller starts with **three hearts** (`HEARTS.start`). Every hurt is counted in **quarter hearts**
(`quarters()`: rounded to the nearest quarter, a tie down, never less than one quarter for any hurt).
They never come back by themselves (`FALL.regen` 0): a healing potion gives two back (`POTION`).
The baseline is **an ordinary foe's blow: half a heart** (`DAMAGE.blow`); heavier ones scale from it. The
values were the old bar's shares times four, to the nearest quarter (a few world foes' pecks and stings
brought down to the baseline), so an ordinary blow (12–15 % of the old bar) now takes a sixth of a fresh
traveller instead of an eighth: a little harder, as asked.

| What | Hearts | Where |
|---|---|---|
| A swarm's nip, a moth's flash, a dart, a root's grab, a crab's lunge; each contact of a world foe's multi-contact attack (pincers, a scythe, a barrage, a jet) | ¼ | `FOES.swarm`, `foe-kinds.js`, `enemies/attacks.js` |
| Burning slag underfoot, a first touch of spines (a bite) | ¼ | `foes.js` (`DAMAGE.graze`), `hazards.js` |
| **An ordinary blow**: an ink blot's lunge, each hit of its combo, a spitter's lob, each glob of a volley, a machine's quake wave, a harpoon, a ram, a lash, a snap, a pounce, a bite, a shards ring; a world foe's peck, sting, lob, pull, buffet | **½** | `FOES.blot`, `foe-kinds.js`, `enemies/attacks.js` |
| A heavy blow: a winged blot's dive, a shade's sword, a machine's quake slam, an erupting ray, a glass golem's slam or hurl, a crab's spin, a slag walker's stomp or pour; a world foe's rush, tail, beam, pulse, dive | ¾ | same |
| A crushing blow: a machine's slam; a world foe's groundbreaker | 1 | `FOES.machine`, `enemies/attacks.js` |
| A guardian's lighter blows: a combo's quick links (pecks, snaps, jabs, stutters), each shard of a thrown volley, a gale, a shockwave ring | ½ | each temple's `attacks` (`wind:` lines) |
| A guardian's strike: the sweeps, the cries, the lobs, the buffets | ¾ | same |
| A guardian's heaviest: the stamps, the slams, the charges, the dives, the beams of the Tooth-Warden and the sentinel | 1 | same |
| A temple's swinging guardian piece; a fall into a temple's pit | ½; ¼ | `temples/pieces.js`, `temples/runtime.js` |
| Fire (the burning tree), a fan's embers, spines (cacti), a temple's spike row | 1, ¾, ½, ¼ a second, in quarter bites | `HAZARD_DPS` (`hazards.js`) |
| Out of air under water | ¼ every 1.2 s, never the last quarter | `SWIM.bite` |
| A hard landing (a drop of 16–36 m) | ¼ to 2 (`FALL.worst`), never the last quarter | `fallDamage` (`player.js`) |
| A fatal fall (36 m and more) | all of them | `FALL.lethal` |

- **Gentle** (the Enemies setting) still halves the foes' harm (`GENTLE.harm`), then counts it in quarters,
  never under one: a heart's blow takes half, half a heart a quarter, a quarter still a quarter.
  The guardians and the world's hazards don't change with it (as before).
- **The forgiving rule, kept:** a single blow never takes you from **more than one heart to nothing**
  (`strikeDamage`, `HIT`: above one heart it leaves at least a quarter; at one heart or less, a blow can knock
  you out). With three hearts and nothing over a heart a blow it only matters at the end of a fight, which
  is where it mattered before (the old bar's floor was 8 %, about a quarter heart, above 22 %, about two
  thirds of one); kept so a heavy guardian strike or a machine's slam always leaves you the chance to drink.
  Falls, drowning and a temple's pit never take the last quarter; a fatal fall, fire and spines can.
- Knockouts and the Restart panel are as they were (`player.restart()`: back where you last stood, whole).

Tests: `tests/resources.test.js` (the table, quarters, Gentle, the rule), `tests/health.test.js`,
`tests/foes.test.js`.
- **Ink blots, in the wilds:**
  - `wild(p)` is this far from every person (placed and spawned, `WILD.people` 45 m) and from the ship's
    landing (`WILD.spawn` 55 m), not in the temple, not on `level.unsafe` ground, not riding or swimming.
  - After `PACK.settle` s out there, a pack of 2–3 comes in 18–26 m round you (the first ever is one, with a
    notice).
  - After a pack, a rest of 35–55 s. A pack left behind past 85 m dissolves.
- **The makers' machines, in the temples:**
  - one by each checkpoint stone past the first (`rt.marks`), none within 14 m of the guardian's arena;
  - placed where there is footing and nothing between it and the stone;
  - they stir only while you are inside the temple;
  - broken, they stay broken (flag `foes.<world>.m<i>`).
- **The Enemies setting** (`settings.enemies`): `normal`, `gentle` (`GENTLE`: wind-ups 1.35× slower, half
  the harm, one striking at a time, packs of two at most and 1.6× rarer) or `off` (v0.87's on / off carries
  over: `migrateSettings`).
- **The machine's look:** a round brass shell on three legs, clawed arms, the glyph for an eye; broken, its
  parts fly apart, bounce and fade (`breakApart`, `updateDebris`). Home, the Lab, the References and the Atelier
  (`PEACEFUL`) never have any.

## Telegraphs: the body, not the floor (v1.6, `src/telegraph.js`)

No attack is drawn on the ground. Every attack of every foe, world enemy and guardian is told by the body that
makes it; the only mark on the floor is a **projectile's landing mark** (`lob: true`: a spitter's globs, a golem's
hurled chunk, the guardians' seeds, clods, cogs, mortars, notes and hail), drawn where it will fall, because the
thrower's wind-up can't show where it lands. `groundMark(a)` is the one test (src/foes.js `look`, the world
enemies' zone tells, src/temples/boss.js `tells`); `tests/telegraphs.test.js` walks every attack definition and
fails on a ground zone that isn't a lob. The hitbox overlay (`src/hitboxes.js`, debug) still draws every zone.

**The rules a new enemy follows** (the coming archetypes reuse them; nothing per enemy is needed for the generic
path):

1. **The pose.** Each attack has its own wind-up of the body: rear back (a slam, a stamp), crouch and draw back (a
   charge, a pounce, a peck), coil away (a sweep), spin up (a spin), raise (an overhead, a lob), swell (a cry, a
   pulse), rise (a dive). The models' `anim` (src/foe-kinds.js), the world enemies' shared motions
   (src/enemies/models.js `animate`, keyed by the attack's `motion` in src/enemies/attacks.js), a guardian's `rig`
   (src/temples/boss.js `poseRig`) and the model's own poses. The pose is complete at **`POSE_DONE` (75 %) of the
   wind-up and then held still**: the brief stillness before the strike.
2. **The glow.** A spark of the attacker's tone (`ChargeGlow`) gathers on the striking part (a model's
   `tell(attackId)` returns the Object3D: the golem's fist, the crab's claw, the drone's harpoon, the slag walker's
   raised foot; a world enemy's `tell(motion)`: an arm's claw, the head, the nozzle, a wing, the core; a guardian's
   attack `part`: mouth, head, eye, feet, arms, wings, core, tail, a glow on each of a pair). It swells and spins
   faster with the wind-up and burns white through the stillness; one flare as the strike lands.
3. **The sound.** `Sound.foeWarn(kind, dur)` / `guardianWarn(kind, dur, heavy)` rise over exactly the wind-up
   (Gentle's longer one too), and tick at the stillness.
4. **The eyes** turn orange through the wind-up (as before).
5. **Fair wind-ups** (`WIND_MIN`, Normal; Gentle × `GENTLE.wind` 1.35 for foes and guardians alike, through
   `TELL.slow`): a combo's follow-up ≥ 0.4 s, a quarter heart's nip ≥ 0.5 s, an ordinary blow (½ heart) ≥ 0.7 s, a
   heavy one (¾ or more, a knock-down, a grab) ≥ 0.95 s; a guardian's own move ≥ 1.0 s, a link inside its combo
   ≥ 0.6 s. The off-screen warning marker (`warnSpot`) still shows a foe winding up behind you.
6. **No invisible foes** (src/foe-presence.js) still holds: a hound sinking into its shadow to step behind you
   keeps its pool, its hump and its eyes.

What changed per family:

- **The 15 kinds**: every `tele` floor shape removed (the ray's glide, the golem's shards, the moth's flash, the
  drone's harpoon and ram, the stalker's grab, the crab's spin, the slag walker's stomp and pour, the hound's step,
  the machine's quake); the spitter's lob and volley and the golem's hurl keep their landing marks. Poses made
  plainer where they were faint (the machine's slam one arm, its quake both and crouched; the flyer climbs and tips;
  the drone rocks back for its ram; the stalker rears both arms; the crab raises its claws; the slag walker leans
  back on its raised foot; the moth's dart sweeps its wings; the splinter drops and spins). A dune ray no longer
  sprays sand where it will come up: its fin stands tall, glows and races there. A hound's step sinks it into its
  own pool (no ring behind you). Wind-ups raised to the minimums: the blot's lunge 0.65 → 0.7 s and its combo's
  second 0.32 → 0.4, the crab's snap 0.6 → 0.7, the hound's pounce 0.6 → 0.8 and bite 0.45 → 0.55, the splinter's
  lunge 0.45 → 0.5.
- **The 100 world enemies** (to be replaced by about twenty archetypes): the generic path only. Their zone tells
  show only for `lob` (the arcing glob and the barrage); the strike's visible effect only for the motions that throw
  something you can see (`ENERGY`: lob, jet, beam, pulse, slam); the shared motions build to `POSE_DONE` and hold,
  with stronger rears, crouches, coils and swells, and the glow on the limb the motion uses.
- **The 11 guardians**: below, "The guardians' staged fights".


**The wind-up table** (the 15 kinds; the guardians' are in their section):

| Kind · attack | Wind-up (s) | Class (min) | The body’s tell |
|---|---|---|---|
| ink blot · lunge | 0.7 | ordinary (0.7) | squashes down, leans back |
| ink blot · combo | 0.8 | ordinary (0.7) | a longer squash |
| ink blot · again | 0.4 | chain (0.4) | (the combo’s second: straight on) |
| makers’ machine · slam | 1.05 | heavy (0.95) | one arm high over its shoulder |
| makers’ machine · quake | 1.35 | heavy (0.95) | both arms high, crouched low |
| spitting blot · lob | 1.25 | ordinary (0.7) | rears, the glob at its snout (lands on a mark); **landing mark** |
| spitting blot · volley | 1.45 | ordinary (0.7) | rears; three globs (three marks); **landing mark** |
| blot swarm · strike | 0.5 | light (0.5) | squashes down |
| winged blot · strike | 1 | heavy (0.95) | climbs, tips its nose down at you |
| shade · strike | 0.95 | heavy (0.95) | its flame flares, the sword drawn back (motion capture) |
| dune ray · erupt | 1.25 | heavy (0.95) | its fin stands tall and races at you |
| dune ray · glide | 0.85 | ordinary (0.7) | rises off the sand, wings spread |
| glass golem · slam | 1.1 | heavy (0.95) | arm raised high, leans back |
| glass golem · shards | 1.3 | ordinary (0.7) | hunches, its back shards rise and burn |
| glass golem · hurl | 1.35 | heavy (0.95) | arm back, the chunk lifted (lands on a mark); **landing mark** |
| glass splinter · lunge | 0.5 | light (0.5) | drops low, spins up |
| sign moth · flash | 1 | light (0.5) | wings spread flat toward you, tubes burn white |
| sign moth · dart | 0.6 | light (0.5) | wings swept back, nose high |
| rust drone · harpoon | 1.1 | heavy (0.95) | tips its gun at you |
| rust drone · ram | 0.8 | ordinary (0.7) | rocks back and rises, rotors screaming |
| root stalker · grab | 1 | heavy (0.95) | both root-arms reared high back |
| root stalker · lash | 0.75 | ordinary (0.7) | arms swept back to one side |
| salt crab · snap | 0.7 | ordinary (0.7) | claws raised high and wide |
| salt crab · spin | 1.1 | heavy (0.95) | tucks into its shell and spins faster and faster |
| slag walker · stomp | 0.95 | heavy (0.95) | one foot raised high, leaning back |
| slag walker · pour | 1.15 | heavy (0.95) | leans and tips its lip at you |
| shadow hound · pounce | 0.8 | ordinary (0.7) | crouches back on its haunches |
| shadow hound · step | 0.9 | light (0.5) | sinks into its own shadow pool |
| shadow hound · bite | 0.55 | chain (0.4) | (behind you; the screen-edge marker) |

### Legs on the locomotion kit (v1.7, `src/motion-kit/`)

The salt crab, the shadow hound, the makers' machine, and the world enemies with six legs, four (the newts) or
pistons (every possessed machine) walk on jointed legs planted by the kit (docs/systems/procedural-animation.md,
§6). Its pose blend is the body's half of a wind-up: as the wind-up starts the feet brace-step wide and lock,
the body sits back and down against the strike with the telegraph's own timing (complete at `POSE_DONE`, then
held still), and the strike snaps through on an underdamped spring; a lunge unlocks the feet. The models' own
wind-up moves (claws up, a crouch, an arm raised) go on top, so each attack still reads apart.

## The guardians' staged fights (v1.6, `src/temples/boss.js`)

All eleven shared one template before (three attacks, two phases, 1.4-1.7 s floor telegraphs). Each is now a fight
of its own, from its body and its temple's verb, on the same engine:

- **Moves** (4-6 of its own, `def.attacks`): a shape (`ring` at `self`, `front` or the `player`; `cone`; `lane`), a
  `wind`, a `part` for the glow, a `rig` and the model's `pose`, a `side` for mirrored swings; `track` (how long it
  keeps aiming), `lob` + `volley` (thrown things and their landing marks), `over` (its body travels to hang over,
  or plough under, the spot: dives, falls, the Keeper's burrow), `dash` (a charge), `wave` (a ring running out
  along the floor: jump it, or fly over it), `reachUp` (it reaches the air over it: the warden's flare).
- **Combos** (`then` → a `link`): two or three moves chained, the links quicker (≥ 0.6 s), the last the big one to
  read, and after it the opening (`open`). A combo cut short (you are knocked down) still ends in its opening.
  `comboOf(def, id)` lists one.
- **Openings read from the body**: `open` after a move or a combo (it pants, its vents open, its dish lowers), and
  `miss` when a move misses you (stuck: forefeet wedged, a beak in the floor, spun dizzy, crashed into the wall),
  told by `def.missHint`. The temple's own verb counts only then, as before.
- **Phases**: three fighting phases each (the last phase of v1.5 split in two, at a meter step the temples'
  puzzles already land on), each adding moves. At a change it **shifts** (`SHIFT` 2.4 s): it staggers and shakes,
  no move, its phase hint said; its **marks** (`PhaseMarks`) light: none at first, half after the first change, all
  and pulsing after the second (cracks on a machine, glyph veins on a living one). The meter still counts during
  the shift.
- **Closing in**: a close move with you out of its reach makes it come for you first (≤ 3 s) instead of swapping
  for another move; a rooted one (the Mother Snapper) throws instead.
- Unchanged: organic guardians are calmed (never hurt), machines broken; a strike never takes the last of a healthy
  bar (`strikeDamage`); a knock-out puts it back to sleep at its phase's start; the stilling lens stops a move
  before it lands (and the rest of its combo).

| Guardian (temple verb) | Phase 1 | Phase 2 | Phase 3 | Combos (the last opens it) | Stuck when it misses |
|---|---|---|---|---|---|
| The Keeper (ember, then water) | stamp, sweep | sweep, charge, stamp | burrow (ploughs under the sand at you), spit (3 clods) | sweep → sweepBack → stamp | stamp, charge |
| The warden (jets: get above it) | beam, mortar, stomp | stomp, sweeping beam, mortar | flare (vents straight up at you over it), beam, 3 mortars | stomp → stomp → slam (wave); flare → slam | - |
| The Elder (wings beside her) | peck, stamp, buffet | buffet, dive, gale | stone feathers (3), peck, gale | peck → peck → buffet; gale → dive | - |
| The Cloud-Mother (the bell) | gust, dive, wail (wave) | roll, dive, gust | hail (4), roll, wail | roll → tail → wail; hail → dive | - |
| The Mother Snapper (stilling) | lunge, sweep | snap, seed, sweep | thrash, seed, snap | sweep → sweepBack; snap → snap → lunge; thrash → 3 seeds | - |
| The Lampless (the lantern) | swoop, gust, dust | flutter, scales (3), swoop | spiral, scales, gust | flutter → flutter → dust; spiral → spiral | - |
| The Gardener (bloom) | sweep, stamp (wave), clods | sweep, roots, stamp | crush, clods, sweep | sweep → sweepL → stamp | roots, crush |
| The Clockwork Foreman (six numerals in a breath) | jab, chime (wave), hammer | cog, spin, hammer | jab, cogs (3), spin | jab → jab → hammer | spin (dizzy: its face opens) |
| The Tooth-Warden (four vents) | beam, mortar, stomp | grind, beam, stomp | charge, 3 mortars, grind | stomp → stomp → slam; grind → beam | charge (into the wall) |
| The Echo (answer its note) | note (a lobbed note), pulse (wave), ripple | fall, chord (its rings lock into a lens), note | scale (3 notes), ripple, fall | ripple → ripple → pulse; scale → chord | fall |
| The First Sign (its word played back) | cry (wave), beam, static | beam, stutter, static | statics (3), stutter, beam | beam → sweep; stutter → stutter → cry | - |

Wind-ups: every guardian's own move 1.0-2.0 s (the Keeper's burrow 2.0 s, it ploughs at you), links 0.65-0.75 s,
combo finishers 1.1-1.3 s. `tests/telegraphs.test.js` checks the move lists, the phases (each adds a move), a combo
that ends in an opening, an opening in every phase, a combo's timing, the body tells, a phase change and the shock
ring; `tests/temples.test.js` still plays every temple through.

## Feel (`src/feel.js`)

- **Hit-stop (frame freeze):** `hitStop(s)` freezes the world (`FEEL.slow` 0: main.js `feelDt` passes a
  1e-5 s step, never zero): 0.06 s on a cut, 0.11 s on the heavy third swing, the whirl and the lunge, 0.07 s
  on a block, 0.14 s on a perfect parry.
- **Camera kick:** `kick(k)` jolts the camera after the rig places it (`shakeCamera`), settling over
  `FEEL.settle`; a foe's hit kicks harder (main.js `onHurt`).
- **The finishing blow** (v0.96, `Foes.burst`): 0.09 s and a bigger kick; the last foe of a fight (none other
  stirring within 28 m) 0.12 s, then `slowMo(0.45, 0.35)`: the world at 35% for 0.45 s, easing back over its last
  third (`feelDt`, after any hit-stop).
- **Knockback:** the heavy third swing throws a foe 2.2× as far.
- **Turns:** `TURNS.strikers` (2) may wind up at once (`env.mayStrike`); the others circle at a step past
  their reach (`Foe.circle`). One off the screen (`Foes.onScreen`) waits while any other strikes (v0.96), so a
  blow from behind never lands on top of one you are watching. `keepApart()` pushes foes standing inside each other apart.
- **Warnings:** a foe winding up off the screen (or behind the camera) shows a round marker at the screen's
  edge on its side, filling as its strike comes (`#foe-warn`, `Foes.warnings`).

## Ink and the blade's growth (`src/ink.js`)

The blots are the drawing's unfinished margins, gathered thickest where the singing light passed. Cut down,
a foe leaves ink (`INK_OF`: a blot 1, a machine 3) that runs into the glove (flag `ink`, never down). At
`UPGRADES` steps the blade grows, each said once:
- **reach** (8): the blade 1.3× as long, its swing as far (`REACH_UP`);
- **whirl** (20): the third swing is the Great Sword pack's high spin (`WHIRL`), cutting all round (half-angle
  π), damage 2;
- **lunge** (40): a swing begun at a run (not chained) is the pack's slide attack (`LUNGE`), carrying you
  into the cut, reach 3.6 m, damage 2.

The count is said every 5 ink.

## Placed encounters

- **Relic guards:** a relic out in the wilds (`content.relics.spots`, where `wild()` holds) gets `GUARDS.size`
  blots round it as you come within `GUARDS.near` (32 m).
- Cut down, they are gone for good (flag `foes.<world>.r<i>`).

## Controls and the lock-on

- **RB / R1** (a left click, F, ⚔) swings (held, the charged cut; in the air, the air cut); **LB / L1** held (Ctrl or Z on land, 🛡) guards; **B / ○** (Alt, ↶) evades; **R3** (Tab, ◉) locks on, and with no foe in reach sends the scout (docs/systems/controls.md, "The layout").
- The push is a gun mode (`MODES.push`, always owned with the backpack): fired as a shot, it throws the cone.
- In a fight (`foes.near(20)`) LB doesn't zoom (`Controller.combat`).
- **The lock-on:** `Foes.cycleLock()` locks a foe in `LOCK.reach`: those ahead of the camera first, by distance
  × (1.6 − how straight ahead), so the one nearest the middle of the view wins; then the next, then lets go. It
  is lost past `LOCK.lose`; when its foe falls it moves on to the nearest still standing in reach (`nextLock`, v0.96).
- While locked, main.js turns `rig.yaw` to keep the foe ahead, the reticle marks it, and the blade's soft
  lock, the guard and the cut's pull turn to it first (`tool.lockOn`; `lockTarget()` carries its body's radius).
- **The reticle** (`src/lock-reticle.js`, `#foe-lock`, v0.96): an SVG drawn as the prompts are, gold in a thick ink
  line: four chevrons on a hand-drawn dashed ring, sized to the foe's body on the screen (`RETICLE.min`–`max` px),
  a centre diamond, and pips over it for its hp (up to 8; more, each a share). `reticleLook(f)` reads the foe:
  `calm` (turning slowly, breathing), `wind` (red, the chevrons closing to `RETICLE.close` as k², the ring filling
  in; meeting at the strike with a white flash), `open` (stunned, reeling, flipped, asleep: pale blue, spread to
  `RETICLE.open`, pulsing, still), `veiled` (buried, phased: dimmed, dashed). A new lock snaps in (from twice the
  size, a quick turn, `acquire()`). Off the screen it waits small at the edge on its side. Each state has its own
  shape as well as its colour (`reticleShape`, for colour-blind players): winding up the chevrons double (»), the
  strike puts a four-point burst in the centre, open turns the chevrons round (tips in, like brackets) round a hollow ring,
  veiled dashes them.
- **Switching with a flick** (`FLICK`, `Foes.flickLook`, `switchLock`, v0.97): main.js wraps `rig.look` (the
  right stick, the mouse, a touch drag all pass through it); while locked, the sideways part goes to `flickLook`
  instead of the camera, into a leaky sum (decay 8/s). Past `FLICK.px` (70) the lock jumps to the nearest foe on
  that side of the screen (by projected x, a little by y), then rests `FLICK.rest` s; none that way, it stays. Full
  tilt gets there in ~0.12 s; half tilt or less never does.

## Staying in the fight (v0.96, `PRESSURE`)

Foes press you rather than run (enemies that flee are a chore to chase, not a fight):
- **Knocked down** (`P.down`), they no longer go home: they hold round you `PRESSURE.hold` (1.6 m) past their reach,
  facing you, never striking, and come on as you rise. Only **lost** (dead, riding, 6 m above or below) sends them home.
- **The leash** (`giveUp`) holds only once you have left too: home only when you are past `giveUp + PRESSURE.leave`
  (8 m) from its home. Fighting it out there, it stays.
- **Keeping its distance** (`keep`: the spitter, the drone) backs off at most `PRESSURE.retreat` (1.1 s, at 0.7 of
  its speed), then stands its ground and attacks from there; the budget refills when it winds up a strike.
- **The dune ray** (`BURROW`): up (`Foe.surfaced`) it stays up `BURROW.up` (6 s), fighting surfaced, and dives only
  at the end of a recovery after that. Buried, a tall fin and an ink ripple ring on the sand show it; a cut there
  flushes it (`'flushed'`: dazed `BURROW.flush`, unharmed, sand thrown up); a bomb, stomp or gust still throws it
  up for 1.6 s. A shot finds only sand. It can be locked on buried (the reticle dimmed).
- **The shadow hound** is phased only more than `PHASE.near` (3.2 m) from you (`Foe.dist`): close, it is solid.
- **Armour** (`Foe.shrugged`, `Foes.armour`, `ARMOUR`, v0.97): a cut that lands and doesn't make it reel (a `heavy`
  kind, or any foe late in its wind-up or striking) plays `foeArmour` (a dull thunk) instead of the hurt sound,
  throws sparks and a gold ring off it, and once says what does stagger one (flag `foes.armour`).
- **Hovering foes** (v0.97): a blade cut knocks a `hover` kind low (`Foe.low`, `KNOCKED_LOW` 2.6 s, dropping fast to
  0.35 m). **The rising cut** (`RISE`, `riseTo`, fluid-blade.js): a swing begun on the ground at a target `RISE.min`
  (1 m)+ over the chest within `RISE.flat` (4.5 m) sets `player.riseKick`: Player leaps up to its height (at most
  `RISE.max` 2.8 m, with its own `GRAVITY`) and in, and the cut is the leap's cone (no swept test: the captured arms
  swing level). Then the foe is low and the next swings are on the ground.
- `tests/combat-feel.test.js` checks each of these, the turns off the screen, the lock, slow motion, the pull and the buffer.

## Strafing, locked on (`src/player.js` `LOCK_MOVE`)

- main.js sets `player.lockOn = { dir }` each frame while a foe is locked.
- The body faces it square (no lead into the step) at `LOCK_MOVE.turn`; speed is capped at a jog
  (`LOCK_MOVE.speed` 4.2 m/s) with no sprint.
- The camera keeps the foe ahead, so the stick strafes round it, or backs away.
- Sideways and backwards, `updateStrafe` plays the Sword and Shield pack's strafes (`ss_strafe_1` left,
  `ss_strafe_2` right) or its walk back (`ss_walk_2`) over the whole body, their time following the ground
  covered.
- A fast approach toward the locked foe counts as a run for the lunge.

## More foes, the perfect parry, combos

- **Spitter:** keeps `keep` (6.5 m) away, backing off. It lobs a glob (drawn arcing over the second half of
  its wind-up) at the ring drawn where you stood (`attack.at: 'target'`).
- **Swarm:** six tiny blots, 1 hp; a push ends one.
- **Flyer:** hovers `hover` (3.6 m) up, out of the blade's reach, and dives along a lane. Low (`alt`) while
  it recovers, and falls when stilled. Only under open sky (`SKY_WORLDS`).
- **Packs:** `packKinds(n, world)`: the first is one blot; then blots, a spitter with blots, a swarm, or a
  flyer with blots.
- **Perfect parry:** a guard up less than `GUARD.perfect` (0.18 s) when the strike comes costs nothing and
  stuns the foe `PARRY_STUN` s.
- **Combos:** a stilled foe takes the blade double (and the stilling breaks); a push ends a swarm blot.

## The shade (`src/shade.js`)

A person made of living shadow (`FOES.shade`: 5 hp, a sword's cone).
- **Body:** the game's own skinned body (`buildCharacter`, `Humanoid`, `Animator`, `Locomotion`, as an NPC's).
  It walks where its mind went, and plays the Sword and Shield pack's attack (`SHADE_STRIKE`): up to the cut
  as it winds up, through the cut during its strike phase, then the follow-through as it recovers.
- **The look:** a cartoon drawn in negative. One material per shade (`SHADE_MATERIAL`, the `'shadow'` fluid,
  kind 5 in materials.js): flat black, always lit flat (no shade side, so no shadow-edge line across it), a few
  white fold strokes (contours of a stretched noise in bind space, masked to a few short ones, a few mm wide,
  never under a pixel). Its lines are white: `makeMaterial({ lineWhite })` stores RT0.a as −(1 + L + 2 × step)
  (the sign bit, rendering.md "The G-buffer's layout"), and post.js 1b draws the line's owner's line in
  `INK_WHITE` instead of the ink, so the contour round it, both sides of the silhouette, and its creases are
  white in any world's light. No extra pass: one more tap was already there.
- **Its head, a black flame** (`ShadeFlame`): drawn as a cartoon draws a flame, three flat tongues (`TONGUES`:
  the head's onion, rising from behind the collar so the chest and shoulders hide its root, and two lesser tips
  out of its flanks, leaning out and curling in) on one card that turns to the eye round its upright as it is
  drawn (`onBeforeRender`, a perspective camera's only: the shadow's leaves it), 525 vertices rewritten on the CPU
  each frame, sharing the body's material. Overlapping on the card they make one silhouette with three wavy tips.
  Its normals bulge it out to its edges, so the material's inner white contour runs round it; each edge is
  scalloped by licks travelling up it out of step left and right (`lickWave`), and its axis by an S-wave
  travelling up (`tongueAxis`); a white lick is drawn up each tongue (the head's only up its tip, clear of the
  eyes), from its `aFold` (x 1 + across a tongue, 3 + the head's; y up it), which also keeps the body's cuts off
  it. The body's head is cut at the neck (`fluidBox.w`, 1.5 m in bind space). Two white eye-slits (`EYES`) sit on
  the card. The drive is pure maths (`flameTarget`, `flameDrive`, `FLAME`): it leans from its velocity (across
  the card; toward or away from the eye it foreshortens), flares to `1 + flare` over the wind-up (eyes
  narrowing), whips across with the cut (`sin 2πk`), gutters (smaller, choppier, eyes shut to lines) while stunned
  or just hit, and is gone as it melts; it flares fast and dies down slower, on its own clock. Every 0.35–0.8 s a
  tip breaks off as a small rising wisp (`ShadePools.licks`, white-lined), its tongue jumping short a moment
  (`drive.snap`); oftener as it flares or gutters, a stream as it dies.
- **The contour:** post.js' white line on both sides of its silhouette, and inside it a white band ~1.4 px wide
  (`SHADE_RIM`, × the render scale) where its surface turns from the eye (n·v over its own screen derivative: how
  many pixels to the edge): about 2–3 px of clean white in all, as rubber-hose cartoons draw it.
- **Its strike** (`SHADE_STRIKE`) is the blade's first cut (`mixamo_ss_attack_1`: moves.glb has it; the attack
  it named before was gone, so it never moved its arms).
- **Coming and going:** `uFluidB.y` (melt) pours it up out of the floor and back down into it under a dripping
  edge; its flame's root sinks with it, and black licks tear off the tips and rise. Its feet run into the floor in
  wavering drips.
- **On the floor:** a few plain black drops fall off it (`ShadePools.drops`, smooth spheres, inked as anything is), and it leaves dark pools where it walks (`ShadePools.pools`: a `Footprints` decal with a blob shape,
  so it darkens the ground and is never inked). The costume's pieces (a hat, a pack) are hidden: only the
  skinned body is drawn.
- **Where:** a lone shade in a later pack (`packKinds`, n ≥ 3), and in the Arena. Without the game's bodies
  (tests) it is drawn as a blot.

## Polish

- **Combat music** (`Sound.combat`): a drum, an off-beat tom and a low drone a fifth apart on their own bus
  under the music. It is on while a foe within 28 m chases, winds up or recovers.
- **Ink stains:** where a blot or a shade falls (`Foes.stain`), dark pools in the `ShadePools` decal.
- **The shade's slash:** an arc of black drops in front of it as it strikes (`slashTrail`).
- **The temple kit** (`templeKit`, inside the temple): a foe on a `Plate` presses it (`logic.press(id, 'foe')`);
  gusts, updrafts and pendulums act on any foe as workings (below: *Foes in the world's workings*).
- **Touch:** separate ⚔ attack, ◇ guard and ↶ evade buttons. ◉ shows only with
  `body.combat`.

## The enemy roster (v1.8–v1.9, `src/enemies/`)

The 100 world enemies are retired: 21 archetypes take their place (docs/design/enemy-roster.md, approved 2026-10-09),
each with its own silhouette, body plan, way of moving and job in a fight, met in several worlds in each world's skin.

- **The archetypes** (`src/enemies/archetypes.js` `ARCHETYPES`): family, body plan (the kit's), role, tier, ranged,
  the moves by name, the answers that beat it, how it lives when nobody fights it, its sound family, its chimes
  (`drop`, read by src/chimes.js), what it replaces (`was`), and `art`: `'pending'` (not matched to its picked
  reference sheet yet), `'sheet-1'` (drawn to `references/enemy-archetypes/<id>/sheet-1.jpg`) or `{ main, alt }`
  (drawn to both its sheets: `sheet-1.jpg` in its main skin's world, `sheet-2.jpg` in the alternate's; batch 1).
  `status` says how far it is:
  - `built`: on its own body, its tuning (`def`, a foe kind's, added to `FOES`) here. Batch 1: the **shellback crab**
    (`crab`), the **horn lizard** (`lizard`), the **antler hound** (`hound`), the **lamp tripod** (`tripod`), the
    **ink blot** (`blot`). Batch 2 (v1.9): the **mound worm** (`worm`), the **sky ray** (`ray`), the **signal moth**
    (`moth`), the **ring centipede** (`centipede`), the **lantern jelly** (`jelly`);
  - `stand-in`: not built yet, an old kind runs as its body meanwhile (the skitter swarm on the blot swarm, the
    bellows toad on the spitting blot, the root knot on the root stalker, the crucible cart on the slag walker, the
    ring drone on the rust drone, the furnace brute on the glass golem, the shade on the shade);
  - `planned`: nothing stands in (the stilt heron, the pearl roller, the bell walker, the marionette): the world
    tables list them, spawning passes them over until they land.
- **Skins** (`src/enemies/skins.js` `SKINS[archetype][world]`): a name, a palette, props (lichen, a beetle's
  antennae, a hermit's awning, barnacles and rope, glass facets, coral, patina; a pipe-elbow horn, coins, soot;
  crescent, driftwood, halo or wire antlers; a drill lamp, a diving bell, gyroscope rings, a cistern pump), and
  skin-only moves (`moves`: the crab's burrow in the Salt Harbour and Underwater). The first world listed is the
  archetype's own skin (the Arena's, `HOME_SKIN`). The blot's are made from each world's ground colour, its edge.
  A kind is written `kind@skin` where the skin matters (`crab@saltharbour`: `parseKind`, `skinned`); in a world
  without a skin given, an archetype wears that world's (`skinFor`; its own where the world has none).
- **The world tables** (`src/foe-worlds.js` `WORLDS`, the doc's table): each world's stage on the difficulty curve,
  its lead, its archetypes by weight, the late ones (from the third pack), the placed ones (the Desert's cistern
  pump, Lorn II's wood cutter, the Garden's glass puppet: placement in the worlds is still to do) and its temple
  rooms. `ROSTERS` turns them into what spawning reads (kinds: each archetype's own or its stand-in's): `wild`,
  `fill`, `first` (the lead alone), `guards`, `temple`. Packs are sized by stage (`BUDGET`: 1–2, 2–3, 3–4, 4–5),
  group kinds come as a group (`GROUP`: the lizards and the hounds in pairs, moths in threes, the swarm in six),
  and the first half of the route holds at most one ranged kind a pack.
- **Bodies** (`src/enemies/plans/`, one builder per plan, `archetypeModel(kind, skin)`): `walker.js` (plan 1: the
  crab), `quadruped.js` (plan 6: the lizard and the hound, one rig), `piston.js` (plan 18: the tripod), `blob.js`
  (plan 20: the blot). Each rides the locomotion kit (src/motion-kit/: the rig, the gait, the poses), its loose parts
  on a verlet chain (`src/motion-kit/chain.js`: the lizard's tail, the hound's smoke); a leg may lift on its own
  (`leg.lift`: the lizard rearing, the tripod's stamp and its possessed twitch). Batch 2 rides the kit's chains
  (phase 4, procedural-animation.md): `centipede.js` (plan 3: segments on the head's own path, `PathTrail`; 24 legs
  stepping in a metachronal wave on distance, `src/motion-kit/wave-legs.js`), `burrower.js` (plan 15: the worm's
  mounds on its path, its ring stack rising on a spring that dips first), `glider.js` (plan 14: the ray's wings as
  strips turned by a travelling `Wave`, the tail on a `FollowChain`), `flyer.js` (plan 13: the moth's flap by speed,
  its antennae on chains), `floater.js` (plan 11: the jelly's bell pulsing on a `Wave` that quickens as it winds up,
  threads and lanterns on verlet chains).
- **Calm until provoked** (`def.calm`): out in the wilds (a pack: `Foes.add(kind, at, { calm: true })`) a kind with
  a calm keeps to it. Wildlife (`wild`) grazes, basks or lies about and fights only when provoked: you come within
  `provoke` m in sight, you hurt it, or one of its own near it is roused (`Foes.alarm`, `alarm` m); a shy one (the
  crab) backs away as you come near; home again it calms down. The tripod patrols its round and comes for you at
  20 m; the blot lies pooled until you are 9 m off; of the hounds, not every one hunts (`hunts`: the others stand up
  and watch you go). Anywhere else (the Arena, a relic's guards, a temple, the tests) every kind comes for you.
- **The archetypes' attack fields** (beside those in src/foe-kinds.js's header): `skins` (only in those skins),
  `below` (only under a share of its health: the hound's antler rake), `rear` / `back` (the lizard's tail whip: only
  with you behind it, its area behind it), `flank` (the lizard's bite: only from behind you, out of your sight),
  `far` (begun from beyond its reach once it has chased you that long: the blot's spit), `shove` (the blare: shoved
  toward its partner), a lane's `track` (the tripod's searchlight follows you, then locks), `onParry: 'reflect'` (a
  perfect parry sends the bolt back into the lamp: 2). The `burst` of a kind ([go, stop] s: the crab's scuttle) and
  `flanks` (a pair: the second circles behind you). Every move carries its `tell` and its `counter` (the gallery
  says them). The attack-pattern library (`src/enemies/attacks.js` `ATTACKS`, the world enemies' fifteen) stays:
  `fromPattern(id, o)` makes one an archetype's attack (the lizard's whip from `tail`, the tripod's stamp from `stomp`).
- **Batch 2's fields** (v1.9): `up` (a burrower's move only while it is up: the worm's stones and dive; a burrower's
  `surface` move only from under) and `dives` (back under after it); `onParry: 'ground'` (a perfect parry ploughs
  the sky ray into the ground, `GROUNDED` 2.5 s, open); `draft` (the downdraft: thrown down, the glide and the jets
  broken); `slip` (the moth's dust: the lock slips and won't take for that long, `Foes.lockSlip`); `encircle`
  (`{ r0, r1, speed }`: the centipede spirals round where you stood from r0 to r1 m, and `Foes.corral` makes its body
  a wall you can only cross from `RING.over` m above it; the push breaks the ring); `segmented` (plated: a cut from
  behind or the side does half and never staggers it, its head turned in for the ring takes a cut double) and `shed`
  (cut from behind under two thirds, two skitterers break off its tail, once: `Foes.shedTail`); `support`,
  `lanterns`, `ward` / `mend` (the jelly: it keeps over its neighbours, `Foe.allies`, and works on them; a ward halves
  the harm to its foe and takes its staggers, `Foe.ward`; a shot or the boomerang pops the lit lantern and its ward,
  `Foe.pop`; it mends only in its tier-2 skins, coming down within reach); `escort` (what comes with it alone in the
  Arena: `aloneWave`); `calm.joins` (it joins any fight near it; the jelly never starts one: `provoke: 0`); the calm
  modes `circle` (the ray in its thermals, the moth round its lamp), `drift` (the jelly) and `coil` (the centipede,
  still on its rock, laid out as a crescent). The air cut (`info.air`) onto a buried worm flushes it, the blow double.
- **Batch 1:**

  | Archetype (kind) | Silhouette | Attacks (wind-up) | Answers | Calm |
  |---|---|---|---|---|
  | shellback crab (`crab`) | a low wide dome, two raised pincers, six legs splayed like a table | snap (0.75 s; a parry chips it), shell spin (1.1 s; guarded, it flips), burrow and pinch (1.2 s; Salt Harbour and Underwater only) | parry, dash cut to its side, bombs, ember; the shell glances the blade from the front | grazes, backs away, fights at 3.2 m or cornered |
  | horn lizard (`lizard`) | long and low, a curled tail, a brass trumpet for a snout | blare (1.0 s; shoves you toward its partner), flank bite (0.8 s; only from behind you), tail whip (1.15 s; only at its back) | parry and riposte on the bite, dash cut past the blarer, split the pair | basks on its stones; territorial within 6 m |
  | antler hound (`hound`) | lean, tall, a crown of antlers wider than its body; running, a shadow | pounce (0.8 s), step behind (0.9 s) then bite, antler rake (1.0 s; under two thirds of its health) | ember (solid, 2), parry; the blade passes through its running shadow | lies as a shadow; some only watch |
  | lamp tripod (`tripod`) | a lighthouse on stilts, 3.5 m: a boiler, a searchlight, three piston legs; a face at the porthole | beam and bolt (1.4 s; the light follows, then locks), stamp (1.35 s), steam vent (1.0 s) | cover breaks the beam, dash under it, the magnet glove, a perfect parry sends the bolt back | patrols sweeping its lamp; always hostile |
  | ink blot (`blot`) | a squat ink drop with two white eyes, a rim of the ground's colour | lunge (0.7 s), lunge combo, spit (1.2 s; a lob with its landing mark, once you keep away) | everything: it teaches the combo, the guard and the shot | lies pooled, stands up as you come near |

- **Batch 2** (v1.9):

  | Archetype (kind) | Silhouette | Attacks (wind-up) | Answers | Calm |
  |---|---|---|---|---|
  | mound worm (`worm`) | under: a travelling mound with an ivory fin and a wake of humps; up: a 2.5 m stack of rings, a toothed mouth, a tall fin down its back | erupt (1.3 s; from under, the mound stops and trembles, the fin sinks), spit stones (1.0 s; up), dive (0.95 s; up, back under) | move off the spot, then cut it while it is up (6 s); flush it with a cut at the fin, a bomb, a stomp, a gust; the air cut onto the mound (double) | its mound wanders; it comes up only if you stand on it (2.6 m) |
  | sky ray (`ray`) | a broad red diamond against the sky, a pale rim, bulging eyes, a long segmented whip tail | skim (1.2 s; banks round, wings swept back, then the run in low), tail lash (0.75 s; at its back), downdraft (1.1 s; Vael and Vael II) | a perfect parry grounds it, open; evade; the air cut as it passes low | circles in the thermals; fights within 7 m |
  | signal moth (`moth`) | an upright paper lantern with a hooded face, glowing-bulb antennae, kite wings on rods that fold to a tent, six hooked legs; threes | flash (1.0 s; blinds if you face it), dart (0.6 s), dust (1.0 s; the lamp moth and the Antennas' moth: your lock slips 3 s) | one light blow, a shot, the push or a gust each; turn away or guard the flash | circles its lamp; fights within 5 m |
  | ring centipede (`centipede`) | a 5 m tube of grey plates with coloured bands, great crab claws round a drill for jaws, 24 short legs; coiled, a crescent | ring (2.3 s; spirals round you, its body a wall, then closes), pincer lunge (0.95 s) | out over its back with the wings or jets; the push breaks the ring; its head turned in takes a cut double; parry the lunge; its back takes half | coiled on its rock; takes offence at 6 m |
  | lantern jelly (`jelly`) | a broad puffy bell, three glowing lanterns under it, long pale threads | ward (1.0 s; a lantern's thread of light to a neighbour: half the harm, no staggers), mend (1.5 s; tier-2 skins: down within reach over a hurt one), sting curtain (0.9 s; threads to the ground under it) | a shot or the boomerang pops each lantern and its ward; the air cut or the push when it comes down; kill it first | drifts; never starts a fight, joins one |

- **Retired:** the 100 world enemies (src/enemies/roster.js, models.js, their tests and capture scripts: gone from
  spawning, the Arena, the FOES list and the gallery) and the glass splinter (v1.8); the dune ray, the sign moth's old
  body and the winged blot (v1.9: the mound worm, the signal moth and the sky ray took their places; the Arena's old
  waves and Ink tide field the sky ray where the winged blot came). The spitting blot's spit is the blot's.
  Old saves are unaffected: no foe is ever saved, only flags (`foes.met.crab`, a temple room's machine broken), and
  the kept kinds kept their ids.
- **Tests:** `tests/archetypes.test.js` (the tables, every world's roster valid and diverse, the curve, each built
  archetype's attacks, telegraphs, counterplay, calm and drops, batch 2's mechanics one by one, spawning by world, the
  retirement, old saves, the chain), `tests/foe-presence.test.js` (every built archetype in every skin, calm or
  fighting, shows itself), `tests/motion-plans.test.js` (their legs on the kit), `tests/motion-chains.test.js` (the
  chains, and the chain archetypes measured), `tests/hitboxes.test.js`, `tests/arena.test.js`.
- **Pictures:** `node scripts/enemy-roster/skins.mjs --out <dir>` draws each built archetype in each of its skins
  and its own skin winding up each attack, from the gallery (`enemies.html`: World, then the archetype in that
  world's skin; its moves with their tells and answers; Fight it in the Arena).
  `node scripts/enemy-roster/compare.mjs --out <dir> [--tag after] [crab …]` sets the game's body under each of its
  reference sheets, in the sheet's skin and views (front, side facing left, three-quarter, the wind-up the sheet
  draws): the contact images the art pass is checked against (`compare-<archetype>-<1|2>.png`, a working tool
  only); `--separate` writes each view alone, large, 3D only (`<archetype>-<n>-<view>[-tag].png`), the pictures for
  a before / after. The changelog's pairs come from `scripts/changelog-shots.mjs` (`view.foe`), with the sheet beside
  them as its own picture (docs/systems/changelog.md, "Enemies"). The routine for a rework:
  `.claude/skills/enemy-rework/SKILL.md`.

### Procedural surfaces (v1.11, `src/foe-surface.js`, `src/enemies/surfaces.js`)

The sheets paint their creatures: lichen stars on a slate dome, barnacle rosettes, mottled bands and rosettes on a
lizard, rust streaks under a boiler's rivets, a blot's wet violet gloss, glowing paper lanterns. A flat colour per
part read too far from them, so every built archetype's parts carry a **painted surface** drawn by the surface
shader itself, with no texture, no UVs and no extra draw:

- **The shader** (`src/foe-surface.js`, the `FOE_SURFACE` block of materials.js, added after the material's own
  colour; its gloss once the light term is known): thirteen features, each compiled only where a material names it
  (`FS_*` defines, as `S_*`): `fade` (a colour along an axis: the crab's apricot claw tips), `belly` (the underside
  another colour, inked seams across it), `mottle` (two octaves of value noise), `rust` (rust and verdigris patches,
  denser low, with pits), `grain` (wood grain with pen lines), `bands` and `stripes` (rings across an axis, inked
  edges: segments, ribs, porcelain bands), `scales` (fish scales or staggered plates, triplanar, their outlines inked),
  `spots` and `spots2` (round spots, rings or six-pointed lichen stars on the surface: 8 cells of a 3D lattice, each
  spot's centre seen along the normal, so no projection and no seam), `drips`, `glow` (translucent: a light inside,
  brightest where you look straight through, a rim, a pulse, blooming), `gloss` (a crisp highlight of the sun and of
  the sky over you, off the smooth normal so a faceted blot gets a spot, not a lit facet).
- **Anchored to the part:** object space with the scale baked in (`vObjPos`: metres), so a pattern moves with the
  body and keeps its size on a big skin; random numbers from pcg4d on the float's bits (a fract-of-product hash
  clumps at small coordinates).
- **Ink:** the colour steps are the post pass's to ink. A sharp edge (`soft: 0`) gets a pen line round each spot, as
  the sheets outline their lichen stars; a soft one doesn't (the coin lizard's amber rosettes). Bands, plates, scales
  and grain write pen lines into the drawn-detail channel (`patInk`), so they thin out with the rest of the detail.
- **Far off:** every feature fades to its mean colour once its cells are a few pixels (`FOE_SURFACE.far`): no
  shimmer, the right overall tone. On the handheld and Low (`uWearLite`) the scales take one projection and the
  finest second layer of spots is skipped.
- **The table** (`src/enemies/surfaces.js`): `SURFACES[archetype]['*'][part]` for every skin, `[skin][part]` over it
  (a feature set to null takes one away); colours are hex, a palette key, `key*0.7` darker or `key+0.3` paler, so each
  skin's palette (from sheet-1 and sheet-2) drives its pattern. Parts are the names the body builders give their
  materials (`kit.js` `materials(archetype, skin)` looks them up; `light0…2` wear `light`).
- **Fewer draws:** the cliff crab's 26 lichen-star meshes are painted now, and the anchor crab keeps 5 raised barnacle
  crusts of 13 (the rest painted rosettes): 26 and 48 draws fewer a crab.
- **Cost:** only on a foe's pixels; a feature is a handful of hashes (spots 8 cells, noise 8 a octave). A pack of
  twelve (both crabs and lizards, a hound, a tripod, two blots, a centipede, a jelly, a moth, a ray) held in view in
  the Arena, `node scripts/enemy-roster/bench.mjs` (Mac M4 Pro, headless Chrome on the GPU, 1280 × 720, medians of
  three alternating runs): draw calls 3655 → 3507 on the Steam Deck preset (the painted lichen and barnacles, each
  drawn in the view and the shadow), GPU 7.9 → 6.8 ms on High and 4.7 → 4.2 ms on the Deck preset, CPU 8.4 → 8.1 ms
  on High: no cost measurable (the GPU times move ±2 ms run to run on the shared machine).
- **Tests:** `tests/foe-surface.test.js` (only the named features compile, colours resolve in every skin, every part
  named is one its builder makes, every built archetype is painted in every skin).

## The Arena (`src/levels/arena.js`, `?level=arena`)

A developer's world in the worlds list: the desert's golden sand under an open sky (flat out to 150 m), standing stones, a ledge. `level.foes.waves` makes
`Foes` send the Arena's cycle round you, whatever the setting, `WAVE.rest` s after the last one falls (`ARENA_WAVES`,
`arenaWave(n)`, v1.5): first the old `WAVES` (one blot, three blots, a spitter and a blot, a swarm, a machine, a shade,
flyers, … then each world's own kinds and a mixed wave), then (v1.8) each built archetype alone in each of its
skins, then each world's own (`worldWaves`: each of its archetypes alone in its skin, then two of its packs); then
round again. A wave says what and from where ("Wave 40 · The Signal Market: 2 coin lizards."; `waveText`).
`?enemy=lizard@bazaar` and `?enemyWorld=bazaar` (the Creatures & spirits page's links) run one archetype in a skin,
or one world's waves, instead.

**The tool is lent** (`lendTool: { mode: null }` on the level, main.js → `lendTool`, src/minigames/kit/onfoot.js):
the backpack (so the blade and the shield) on any save, a brand-new one or one that has not found it, with the
save's own tank (no size given: its upgrades still apply); nothing is written to the save. (Before, a save
without the backpack had no blade there: `FluidTool.worn` needs it.) Ink tide lends it again inside, and its
lending puts the Arena's back.

**The FOES list** (`src/foe-spawner.js` `FoeList`, v1.5): the level's quick menu (`level.quickMenu`, as the
Arcade's board), so main.js routes the pad to it. Opened from the FOES ▸ tab on the left edge (under it, how: K on
the keyboard, D-pad ↓ on a pad, the mount's call, free here), K or D-pad ↓ again; B / ○ or Esc closes. Grouped
(`foeSections`): the roster (each archetype in its own skin, an old kind standing in for one not built, then the old
kinds no archetype uses), then a section per world with its archetypes in its skin (each with its role and moves,
and a "Waves from here" that runs that world's waves: `Foes.startWaves(world)`), then the temple guardians. A search (a name, a world, a kind, a move: every word must match) and a world filter
(chips: All, Roster, each world, Guardians; LB / RB or Page Up / Down turn it) narrow it (`filterSections`). Choosing a
foe stops the waves (`Foes.setPractice(kind)`, a kind in a skin too: `tripod@underwater`): it comes in 9 m ahead of you, and again
each time it falls. "Waves again" brings the waves back where they were, "Clear the field" leaves it empty.
`?level=arena&foe=crab` (or `crab@saltharbour`) starts on one kind; in any world the console can call
`foes.spawnKind('golem')`. Tests: `tests/arena.test.js` (the cycle's order, the waves in a running Arena, the
sections, the search and filter, the choices), `tests/foe-kinds.test.js` (practice).

**The guardians** (`src/arena-guardians.js`, v1.5): the list's Guardians section calls each temple's guardian (the
Keeper, the City-Shaft's warden, the Elder, the Cloud-Mother, the Mother Snapper, the Lampless, the Gardener, the
Clockwork Foreman, the Tooth-Warden, the Echo, the First Sign) into a temporary ring on the sand (20 m across, a
temple hall's size, 12 m ahead of you), the field cleared and the waves held. It is the temple's own `Guardian`
(src/temples/boss.js) with its body (src/temples/guardians.js) and its temple's attacks and phases, run by a small
stand-in for the temple runtime; it sleeps until you step into the ring, and is solid (`level.dynamic`). All eleven
can run outside their temples. What does not come with them is each temple's puzzle (the Keeper's braziers, the
Echo's resonators, the Tooth-Warden's vents as targets: in the ring its body is), so a sparring rule stands in
(`sparHit`): when it opens (pants, vents open), a fluid shot counts a step (`RING.step`, water for a living one, a
shot at a machine), a push frightens a living one back (`RING.fright`); the phase hints say so instead of the
temple's. Its end is its own: a hand laid on a living one, a machine broken. Choosing anything else sends it back.

**Chimes in the Arena** (v1.5): its foes drop them as anywhere (`level.foes.chimes: 'training'`), and each
guardian bout won in the ring leaves a purse (`guardian:spar`), so the wallet and the shops can be tried there;
they go into the wallet but are not counted as earned (`res.chimes.earned`).

## Each world's foes (v0.93)

The loose ink takes the shape of what is round it: each world has a foe of its own, and its packs, relic guards
and temple rooms draw from its roster.

- **Attacks** (`def.attacks`, the fields are listed at the top of `src/foe-kinds.js`): every kind has a list;
  `Foe.chooseAttack(d)` picks one whose `[min, max]` holds the distance, by weight, the last one used less
  likely. `def.attack` stays the first (old code and tests read it). An attack may be `instant` (resolved as the
  wind-up ends: lobs, flashes, blinks), `lob` (a thrown or lobbed projectile: the only attack with a mark on the
  floor, where it lands; v1.6), `track` (its aim follows you over that share of the wind-up, then holds), `sweep` (a charge that hits
  what it runs into), `then` (a quick follow-up wound straight away: a combo; a block or a parry ends it),
  `spread` (a volley of rings), and effects: `knock`, `tether` / `grab` (pull you in: `Foes.hold`, ended by
  a cut, stilling or the time), `blind` (only if the camera looks toward it), `wave` (a ground shockwave:
  a jump clears it, a guard does not), `leave` (burning slag), `surface` / `blink`. `onParry`: `chip`, `cut`,
  `flip`.
- **What a kind takes** (`def.takes`, `weak`, flags): `takes { shoot, fire, push, bloom }` is each glob's
  damage (or `'hold'`); `weak { bomb: 2 }` multiplies a source; `heavy` (light cuts don't stop it, it shoves
  less), `metal` (the magnet glove lifts it), `light` (a push or the fan's gust ends it), `flinchy` (any cut
  stops it), `breaks` (its pieces fly apart). Foes now accept bloom globs too.
- **The new kinds** (`KINDS`, models and their `anim(f, c)` in `src/foe-kinds.js`):

  | Kind | World | Attacks | How to beat it |
  |---|---|---|---|
  | dune ray (`ray`) | Desert, Buried Machine | erupt (a ring under you that tracks, then bursts up, knocks down), glide (a lane charge) | buried, a cut at its fin, a bomb, a stomp or a gust flushes it; surfaced it is open, and stays up 6 s |
  | glass golem (`golem`) | Glass Dunes | slam (cone, knocks down), shards (ring round it), hurl (a lobbed chunk) | shots do nothing, bombs ×2, a perfect parry of the slam chips 1; breaks into three `splinter`s |
  | sign moth (`moth`) | Signal Market, Antennas | flash (cone: blinds if you look at it), dart (a short dive) | in threes; 1 hp, a gust or a push ends one; turn the camera away or guard |
  | rust drone (`drone`) | Hangar, City-Shaft, Moon Foundry, Space City | harpoon (a lane; the line pulls you in), ram (a dive) | hovers out of reach; guarding the harpoon cuts the line and dazes it; metal for the magnet; stilled it drops |
  | root stalker (`stalker`) | Mangrove, Lorn, Viridel | grab (roots along a lane drag you in) then lash (cone), lash | a cut frees you; embers ×2; a bloom glob puts it to sleep (held 3 s, cut double) |
  | salt crab (`crab`) | Salt Harbour, Underwater City, Waterfall | snap (cone), spin (a charge along a lane, knocks down) | its shell turns a cut from the front (`'glance'`); guarding the spin flips it (2.6 s, no shell); a bomb cracks the shell |
  | slag walker (`slag`) | Moon Foundry | stomp (ring, leaves slag round it), pour (cone, leaves slag) | burning patches where it walks (`Foes.patches`, 0.05 every 0.7 s on your feet); a fluid shot cools its crust: cuts ×2 |
  | shadow hound (`hound`) | Eclipse | pounce (lunge), step (a pool behind you, it comes out there) then bite | in twos; running more than 3.2 m off it is a shadow (`phased`: the blade passes through); an ember hurts 2 and lights it solid |

  `NOTES` says what beats each, once, the first time one notices you (flag `foes.met.<kind>`).
- **The old foes' new attacks:** the blot's lunge-combo (a longer coil, a lunge, a quick second lunge), the
  spitter's arc volley (three rings in a row across the line to you, 0.6 m apart), the machine's ground slam
  (`quake`: a ring round it, then a shockwave running out to 8 m).
- **Rosters** (`src/foe-worlds.js`): `ROSTERS[world]` gives `wild` (pack leads by weight), `fill`, `first`
  (a visit's first pack, alone; the Desert's is a blot, as the game explains them there), `guards`, `temple`
  (by room: the Hangar, the Buried Machine and the City-Shaft alternate machines and drones) and `shade`.
  Worlds without one keep `CLASSIC`. `packOf(n, world)`: group kinds (`GROUP`: six swarm, three moths, two
  hounds) come as a group, big leads (`COSTS`) take more places, some only from the n-th pack (`FROM`).
  Gentle still cuts a pack to two; harms, holds (×0.6) and the white of a flash (×0.6) are softer too.
- **Hitboxes:** `Foes.hitShapes(out)` (registered from main.js with `registerHitboxes`) adds the shockwaves' fronts, the slag, a hold's line, a volley's rings and words over a buried ray or a running hound; `foeHitboxes` draws the attack the foe is on (`f.atk`). A charge (`sweep`: the ray's glide, the crab's spin) hits whatever its body runs into within `sweepRadius` (half its lane's width), so the lane drawn while it winds up is the ground it covers; through the strike the live shape is that circle round the body (telegraph-coloured until its `contact`), the lane kept faint from where it set off (`foe.charge.path`). `tests/hitboxes.test.js` plays every attack of the worlds' kinds with the traveller stepping round its area and checks each landed exactly when he stood inside the shape drawn.
- **Placed foes:** temple rooms (`f.placed`) still only stir while you are in the temple; a broken golem's
  splinters share its relic, so the relic is cleared when the last is down.

## Tests

`tests/foe-kinds.test.js`: each new kind's attacks, telegraphs, damage and parry / stun answers, the old foes'
new attacks, Gentle, the rosters and placed foes, the Arena's list.

`tests/foes.test.js`:
- the mind, the telegraph and stepping out of it;
- the damage table;
- the wilds and the packs;
- the floor on a hit;
- the machines staying broken;
- the blade's arcs, its soft lock, and that only blade targets feel it.

## Left to do

- Not measured on the Retroid yet (no device attached): each foe's meshes and its ground telegraph.
- The packs hold more (deaths, kicks, the great sword's spins and jump attacks): a charged spin could come
  from them.
- Foes use procedural body animation rather than skeletal clips; legacy machines retain their box model; reference-based world machines use articulated bodies.
- The hitbox overlay (`src/hitboxes.js`) still draws a foe's strike area at `f.pos.y`; for a hovering foe holding
  height over a drop it should use `f.level`.
- Cover is sampled once per strike cycle (16 rays); a foe does not path round obstacles to its hiding place (it
  only takes spots it can fly to straight).
- Not yet: foes using the open world's own workings beyond the temples' (the trials' updrafts register through
  `src/workings.js` once they do), nor a foe knocked into water, nor stilled or blocked by the Hush's crystals.
- Over height: the route grid is one level (the highest footing under each cell): under a bridge or an arch a
  foe plans over the top only; a route is replanned at most once a second, so a fast traveller up and down
  stairs is followed a step behind.

## Foes in the world's workings (v0.98)

Foes live in the same world as the traveller: its height, its hazards and its moving parts (`HOVER`, `COVER`,
`FALL`, `WORLD_HARM`, `WORKS` in `src/foes.js`; pure logic in `Foe`, the world asked through `env`: `ground(x, y, z,
range)`, `seen`, `canStep`, `hazard(p)` (src/hazards.js `hazardAt`), `workings(p, kind)` (src/workings.js
`workingsAt`), `killY()`, `pit(p)` (a temple's pits, or under its floor), `gentle()`).

- **Height** (`Foe.over`, `Foe.level`): a hovering kind (winged blot, rust drone, sign moth) holds `hover` over the
  higher of its footing and where the traveller last stood (`youY`, not every jump): on a ledge it rises to stay
  over you, out over a drop it holds its altitude (a step over lower ground adds to `over`), climbing at
  `HOVER.climb`, sinking at `HOVER.sink`, never more than `HOVER.max` (12 m) over the ground; it won't fly out over a
  deeper chasm on its own. Strikes, sight and "lost" are measured from `level` (footing + over), so the dive, the
  harpoon, `KNOCKED_LOW` and the rising cut work as on flat ground. Stilled up there, it drops all the way.
- **Cover** (`Foe.hide`, `coverSpot`): once between two strikes, while chasing with its cooldown at least
  `COVER.minCool`, it samples 8 ways at 6 and 10 m round itself for a spot at its height that the traveller can't see
  (env.seen false: a physics ray) and it can fly to straight, the nearest to you; it drifts there and waits. It comes
  out after `COVER.hold` (2.6 s; Gentle `COVER.gentle` 1.2 s), after `COVER.stay` there, when you come round and see
  it, or when a cut knocks it low; then its cooldown is cut to `COVER.out` and it strikes. It never strikes from
  hiding. Nowhere to hide: it climbs `COVER.climb` (2.2 m) higher for as long instead.
- **Hazards** (`Foe.feelWorld`, `refuses`): a foe never steps into a hazard or an updraft on its own. Shoved, thrown
  or knocked into one (a push, the fan's gust, a bomb, the heavy swing, a gust), it takes `WORLD_HARM[kind]` (spines,
  fire: one cut) at most every `WORLD_HARM.every` (0.6 s) and is thrown back out. The jaws, cacti and the burning
  tree are all hazards already, so it works anywhere.
- **Falls** (`Foe.air`, `fall`): a shove carries a walker over an edge (more than `FALL.edge` down): it falls at
  `FALL.gravity`; more than `FALL.hard` (3.5 m), or thrown by an updraft, lands hard: a cut (two past `FALL.harder`)
  and a `FALL.stun` stun. Below `killY`, into a temple's pit or past `FALL.lost` (60 m) it is gone (a burst: ink and
  the tank's charge as for any).
- **Workings** (`src/workings.js`): the temple's `Updraft`, `Gust` and `Swing` register themselves as built and let
  go in `dispose()` (TempleRuntime disposes its pieces). An updraft throws a walker up and out (`WORKS.updraft.throw`)
  to land hard, and tumbles a hovering foe up out of control (`tumble`), stunned (`stun`) as it drops; a blowing gust
  shoves any foe in the open down its hall (× `WORKS.gust`: heavy 0.7, a stilled one 1.1, sliding like a crate,
  hovering 1.2, light 1.25), not behind a screen or a shelter; a swinging pendulum knocks a foe away the way it
  swings (`WORKS.swing.knock`), a cut and a stun; off a bridge, into the pit, a machine is broken. Stilled, its
  frost holds a foe that touches it (v1.4: *Foes over height*, "Temple crystals").
- **Plates** (`Foes.templeKit`): any foe that weighs presses a plate it stands on (not a swarm blot, a flyer in the
  air or one thrown up; stilled it still weighs). A gust piece that is not a registered working still shoves foes
  there (the old path).
- **The harm** goes through `Foes.hurt(f, 'world', dir, { damage, stun, source })` (`Foes.worldEvent`): sources
  `'hazard'`, `'fall'`, `'swing'`; its sound (`foeHurt`, and spines, a hiss or a thud), a burst and ink as any blow.
  The first time, the game says the world hurts them too (flag `foes.world`).
- `tests/foes-world.test.js` checks each of these.

## Foes over height (v1.4, `src/foe-height.js`)

Walkers follow you up and down the world's height, and the world's height is a weapon against them
(`CLIMB`, `HOP`, `ROUTE`, `PERCH`, `KNOCK`; pure logic, the world asked through `env.ground` and `env.canStep`).
- **The way** (`findRoute`, `gridSearch`, `Foe.approach`, `followRoute`): on your level (within `ROUTE.flat`,
  1.15 m) a walker walks straight at you as ever. You up a ledge or down off one, or it getting nowhere for
  `ROUTE.stuck` (a wall, a gap), it plans a way (A* over 1 m cells round it, `ROUTE.radius` 13 m, at most
  `ROUTE.budget` 520 cells, at most every `ROUTE.every` 1.1 s): a step it walks (`CLIMB.step` 1.1 m), a ledge a
  `clamber` kind (blot, shade, stalker, hound) leaps up (`CLIMB.clamber` 2.4 m), a drop it hops down
  (`CLIMB.drop` 4.5 m, a heavy one `heavyDrop` 2.6 m; a burrowing ray only walks). A route holds while you stay
  within `ROUTE.drift` of where it led; a cell it can't get into, or finds at another height (an edge), is kept
  out of its next plans (`badCells`). Steps of more than `CLIMB.step` it never walks down on its own: only hops.
- **The hop** (`Foe.hop`, `leap`, `hopAt`): crouched `HOP.crouch` 0.32 s (the body squashes: the tell), then an
  arc over the higher end (`HOP.time` + `perM` a metre), a soft thud and dust as it lands ('hop'). Struck
  crouched, it stays; struck in the air, it falls from there (`knockOutOfHop`).
- **Out of reach** (`reachesUp`, `attacksAt(d, dy)`, `Foe.holdOff`): you `STRIKE_RISE` (1.6 m) or more above or
  below it, it winds up only an attack that reaches (a lob at your feet, a step through the shadow), else it
  comes for you; with no way, it holds off `ROUTE.hold` 5 m out on the side it came from, swaying, facing you
  (`Foe.waiting`), and comes on again as soon as you come down or a way opens.
- **The high ground** (`perch`, `findPerch`, `Foe.perchUp`): the spitting blot looks every `PERCH.every` s for a
  spot it can walk to (steps and ramps, `PERCH.far` 16 m of way) `PERCH.rise` 1.7 m over you (past a blow's reach),
  `keep`–`reach` m from you and in sight, and goes up there; perched (you below and in its reach) it won't step
  down off it (`Foe.perched`: `step` refuses), so it lobs down at you. Go up, or walk out of its reach, and it
  comes down.
- **Knocked off** (`KNOCK`, `knockedOff`, `Foes.knockedOff`): a cut or a push marks a foe as knocked by you for
  `KNOCK.recent` 0.9 s; carried off an edge then, it lands from `KNOCK.min` 1.4 m dazed `KNOCK.stun` 3.5 s
  (`Foe.dazed`, four pale stars turning over its head: `Foes.daze`; no harm, but stunned, so a cut lands double
  and wakes it), from `KNOCK.defeat` 4.5 m it is over (a burst, a machine broken). A heavy thud, a hit-stop, a
  kick, dust, and a note the first time (flag `foes.knocked`). A gust or a pendulum carrying it off is the old
  fall (`FALL`). The charged cut throws `KNOCK.charged` 2.2× (the heavy third's).
- **Knocked into water** (`KNOCK.deep`, `knockedInto`, `Foe.sweptBy`, `env.water`): knocked by you into water
  `KNOCK.deep` 1.3 m deep or more (as deep as lifts you off your feet, `SWIM.float`), off a bank or off a ledge from
  any height, a foe is swept away ('landed', `knocked: 'swept'`): a great splash on the surface (`Waters.splash`,
  the Foes' `waters`), a hit-stop, and it is over; a note the first time (flag `foes.swept`). Shallower, it wades;
  a gust or a pendulum carrying it in is not yours; a sea whose bed is walked (`body.sea`) is not water here.
- **Temple crystals** (`WORKS.swing.frost`, `Foe.feelWorld`): a crystal pendulum swinging knocks a foe away (the
  workings, below); stilled by a stilling glob (frosted, hanging there humming: it no longer moves) its frost takes
  a foe that touches it: held `frost` 3 s ('frosted': a chime, a puff of frost, its eyes pale; stunned, so a cut
  lands double), then not again for `frost` + `cool` s, so it walks on through. The player passes a stilled
  crystal; a foe is held by it rather than blocked, so it reads as the same frost the glob put there.
- **In the hitbox overlay** (`foeStatus`, src/hitboxes.js): a foe's label says `dazed <s>` (instead of stunned),
  `perched`, `waiting: no way to you`, `crouched to hop` / `hopping`.
- **Steps** (`env.canStep(from, x, z, radius, lift)`): a walker's way is tested `CLIMB.step` + 0.1 m over its feet,
  over a stair's riser (before v1.4 it was 0.5 m, so no foe climbed a step taller than that: a temple's dais
  stopped a machine at its foot); a flyer's at 0.5 m over its body as before.
- Tests: `tests/foe-height.test.js` (what each kind crosses, routes round by a ramp or straight up, holding off and
  no blows at air, the spitter's perch, knocked off: dazed, over, a gust not, the charged cut's throw, a hop
  broken off; knocked into water: swept off a bank or a ledge, not in the shallows, by a gust or on a sea bed; a
  stilled crystal's frost; the overlay's labels).

## Combat checks (v0.89)

`tests/combat.test.js` checks commitment, timed block/rearm, swept contact, independent inputs,
full-body playback and transitions on the actual traveller with matching off and on, and evade movement.
Locomotion matching remains experimental and off by default: see animation.md for measured foot slide.

## Hitboxes (v0.93: `src/hitboxes.js`, `src/hitbox-overlay.js`)

A debug overlay of what the fight actually tests, for tuning and for learning the timings.
- **The switch** (`hitboxes`): F4, L3 + R3 (both sticks clicked; R3 alone still locks on), the dev menu's
  Combat row, the Arena's board left of the way in (X / □, E: `src/levels/arena-hitbox-board.js`, its lamp lit
  while on), `?hitboxes=1` / `=0` for the session. Kept in the settings (`settings.hitboxes`).
- **Truthful by construction:** `collectHitboxes()` reads the combat code's own data, exposed through small
  getters used by the combat code too: `Foe.attackOrigin()`, `Foe.attackPhase`, `STRIKE_RISE`, `hurtRadius()`
  (foes.js); `FluidBlade.coarse()`, `.cutting` (set when `strike()` runs), `.parryLive` (what `block()` checks),
  `bladeSegment()`, `bladeTouchRadius()`, `activeRange()` (fluid-blade.js); `BOMB` (gadgets/bomb.js).
- **What it draws:** the traveller's hurt column (foes test a point at the feet, within `STRIKE_RISE` of
  height); the blade's coarse cone, its segment and the swept quad (yellow; red on the frames it cuts); the
  guard's arc (green, white in the parry window); an evade (violet; pale lavender with the label `I-FRAMES <s left>` while its i-frames are on, then `i-frames
  over`, `no i-frames (too soon after the last)` for one given none, `DODGED` once one swallowed a blow); the
  hard lock (orange diamond) or the soft lock. Each foe: its target sphere and the blade's touch ring, sight,
  reach, keep; its strike's area at `attackOrigin()` (orange while it winds up, red while live, dull once
  checked); a label with its state, wind-up %, stun or why it reels (`Foe.reel`: blocked, parried,
  flinched, staggered) and hp. Shots in flight, a lobbed glob, bombs and their blast reach, the hook's line.
- **Drawing:** its own scene rendered over the composite after the wind (main.js `renderFrame`): `LineSegments2`
  with fixed-size buffers written in place, see-through floors, DOM labels. Off: nothing is collected or drawn.
- **More shapes:** `registerHitboxes((out, ctx) => out.push(shape))` adds another system's (a new foe's
  projectiles) in the same kinds.
- Tests: `tests/hitboxes.test.js` (every foe's drawn area against `inArea`, the phases, target radii, the
  height window, the guard against `inGuard`, the real traveller's swing red exactly when `strike()` runs).

### Appearance quality

Flyer wings pivot at their embedded roots; machine arms have overlapping shoulder sockets. The temple sentinel and First Sign use endpoint-defined hip-to-knee links so the upper struts meet the shins. Each normal foe owns and releases its mutable warning-eye/core material; immutable hull materials stay shared. `tests/foe-appearance.test.js` checks wing-root overlap, shoulder sockets, warning-colour isolation and cache lifetime. The enemy screenshot tool sets emerged shades and floating guardian altitude explicitly before inspection.


### World enemy reference atlas (retired)

`references/archive/world-enemies/enemy-atlas.html` presents the Midjourney concepts of the 100 world enemies (two creatures, a possessed
machine and a spirit for each of 25 worlds; `references/archive/world-enemies/enemy-roster.json`, each world's `<World>/sources.json` beside it).
Their game models and kinds are retired (v1.8: "The enemy roster" above); their best pictures stay as the
archetypes' skin references (docs/design/enemy-roster.md) until each archetype's fresh sheet is drawn.

## No invisible foes (`src/foe-presence.js`, v1.1)

From the 2026-10-08 playtest. Every foe, in every state, must be seen:
- **The rule** (`PRESENCE`, `presenceOf`, `presenceProblems`): what is drawn over its footing (meshes visible up
  the tree, in world space) stands at least 0.4 m (or is 1.5 m wide and 0.3 m tall, a surfaced ray) and 0.4 m
  across, with a light part 0.2 m across: a pale colour, a glow ≥ 0.5 (an eye, red while winding up) or a white
  contour (`makeMaterial({ lineWhite })`), so an ink-black foe reads on dark ground. tests/foe-presence.test.js
  walks every kind through 30 s of a fight, including the running hound and the buried ray.
- **The shadow hound running** is a low hump of shadow with a glowing lavender rim and lit eyes over its pool
  (was a flat pool and 4 cm eyes); its ink has white contours, as the shade's. Its bite after the step behind
  you winds up 0.45 s (was 0.32).
- **The buried dune ray** has a taller white-lined fin, darker turned sand, and winding up its burst it swims to
  its ring under the sand (`Foe.swimTo`, `SWIM`: there by 85 % of the wind-up, ≤ 12 m/s, through `step`), the
  fin high and throwing sand; before, it sank the fin and came up out of nowhere.
- **The swarm's** eyes are 1.7× and **the splinters** drawn 1.3×.
- **Behind the world** (`warnSpot`, `Foes.hiddenFromCamera`): a foe winding up on the screen but hidden from the
  camera by the world (a physics ray) gets the warning marker over where it is.
- **Never inside the world** (`Foes.roomAt`, `openSpot`): a pack's, a relic's guards', a wave's and `spawnKind`'s
  spots are checked with a capsule (`physics.pushCapsule`) for its body's column; inside a solid, the next spot
  round is tried, never a guessed height.
