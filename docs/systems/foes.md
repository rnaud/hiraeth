# The fluid blade and the foes (v0.89)

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
  Grounded swings use the legs and hips; airborne cuts use the upper body. `Animator.playCombat`
  blends clip changes over 90 ms from the displayed pose, including motion matching when enabled.
  Grounded cuts step forward through Player's normal collision movement and limit steering until recovery.
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
- **The look:** a sword. A flat two-edged blade (`BLADE.length` 0.85 m, `width` 5 cm, extruded from an
  outline tapering to a point) of the glob's lava material in the tank's tones, its edges bright glowing lines,
  on a hilt: a brass guard, a wrapped grip in the fist and a brass pommel. The blade grows out of the guard as
  it lights for a swing and fades after, and a fine trail of small sparks follows the edge. (The game's materials
  draw into the G-buffer: no transparency, so the glow is the bloom's.)

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

- **The mind:** idle → chase → wind → strike → recover. Blots coil for 0.65 s, then lunge over
  0.24 s; machines plant and raise their arms for 1.05 s, then slam over 0.32 s. Direction locks
  when the wind-up begins. Damage occurs 55% through the strike, with a wall check. Movement
  checks footing and walls. Normal melee has no floor marker; body poses and sound are the tell.
  Boss area telegraphs and offscreen warnings remain. Light hits interrupt blots and the first
  two thirds of a machine's wind-up; the machine's late wind-up and strike commit.
- **What hurts them:**
  - the blade: `info.damage`;
  - a fluid or ember glob: washes a blot (1), only staggers a machine;
  - stilling: holds either for 3.5 s;
  - the push: shoves them.

  A cut breaks a blot's wind-up, and a machine's in its first two thirds.
- **What they do to you:** `strikeDamage` (as the guardians): a hit never takes a healthy bar below
  `HIT.floor`. A blot shoves you; a machine knocks you down.
- **The reward:** each foe cut down gives the tank a charge back (glowing drops fly to the flask).
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

- **RB / R1** (a left click, F, ⚔) swings; **LB / L1** held (Ctrl or Z on land, 🛡) guards; **B / ○** (Alt, ↶) evades; **R3** (Tab, ◉) locks on, and with no foe in reach sends the scout (docs/systems/controls.md, "The layout").
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
  size, a quick turn, `acquire()`). Off the screen it waits small at the edge on its side.

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
- **The temple kit** (`templeKit`, inside the temple): a blowing `Gust` shoves machines down its hall; a
  machine on a `Plate` presses it (`logic.press(id, 'foe')`).
- **Touch:** separate ⚔ attack, ◇ guard and ↶ evade buttons. ◉ shows only with
  `body.combat`.

## The Arena (`src/levels/arena.js`, `?level=arena`)

A developer's world in the worlds list: the desert's golden sand under an open sky (flat out to 150 m), standing stones, a ledge. `level.foes.waves` makes
`Foes` send `WAVES` round you, whatever the setting: one blot, three blots, a machine, two machines and two
blots, a spitter, a swarm, a machine, flyers, spitters with a machine, a mixed wave, then each world's own kinds and a mixed last wave, round and round, `WAVE.rest` s after the last one falls.

**The tool is lent** (`lendTool: { mode: null }` on the level, main.js → `lendTool`, src/minigames/kit/onfoot.js):
the backpack (so the blade and the shield) on any save, a brand-new one or one that has not found it, with the
save's own tank (no size given: its upgrades still apply); nothing is written to the save. (Before, a save
without the backpack had no blade there: `FluidTool.worn` needs it.) Ink tide lends it again inside, and its
lending puts the Arena's back.

**The foe list** (`src/foe-spawner.js`): a FOES tab on the left edge opens a list of every kind. Choosing one
stops the waves (`Foes.setPractice(kind)`): it comes in 9 m ahead of you, and again each time it falls. "Waves
again" brings the waves back, "Clear the field" leaves it empty. `?level=arena&foe=crab` starts on one kind;
in any world the console can call `foes.spawnKind('golem')`.

## Each world's foes (v0.93)

The loose ink takes the shape of what is round it: each world has a foe of its own, and its packs, relic guards
and temple rooms draw from its roster.

- **Attacks** (`def.attacks`, the fields are listed at the top of `src/foe-kinds.js`): every kind has a list;
  `Foe.chooseAttack(d)` picks one whose `[min, max]` holds the distance, by weight, the last one used less
  likely. `def.attack` stays the first (old code and tests read it). An attack may be `instant` (resolved as the
  wind-up ends: lobs, flashes, blinks), `tele` (drawn on the floor; plain melee still reads from the body),
  `track` (the drawn area follows you over that share of the wind-up, then holds), `sweep` (a charge that hits
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
- Foes use procedural body animation rather than skeletal clips; machines still use the box model.
- No foe yet uses the temple kit (gusts, updrafts) or the open world's height.

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
