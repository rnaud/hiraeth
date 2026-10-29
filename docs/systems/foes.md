# The fluid blade and the foes (v0.89; captured attacks v1.3)

The first things in the game that fight back, and the tool's answer to them.

## The fluid blade (`src/fluid-blade.js`)

- **Input:** F, RB / R1, touch ⚔ (`toolInput().blade`; `PadBlade` in `src/controller.js`). It comes with the
  backpack: no item, no box. It costs no charge. On a pad, LB held with the right stick still zooms.
- **The combo:** a press swings (the first cut takes 0.62 s); a press during a swing or within `BLADE.chain` after it
  chains the next, up to three: right to left, left to right, then a heavier overhead (`BLADE.damage` 1, 1, 3 since v1.22; 1, 1, 2 before),
  then `BLADE.cooldown`. A press the blade can't act on yet (during an evade, the cooldown) is kept `BLADE.buffer`
  (0.2 s) and swings as soon as it can (v0.96).
- **The cut's pull** (`MAGNET`, `closeInSpeed`, v0.96): a swing begun with its target (the lock, else the soft lock)
  a little out of reach steps you in through the wind-up and cut, to stand `MAGNET.ideal` (1.05 m since v1.35; 1.2 before) off its body, up
  to `MAGNET.max` (2.2 m) of ground; in reach, or further, nothing. Not the lunge (it carries you itself) nor in the air.
- **The swings:** `SWINGS` retains anticipation through follow-through from three Mixamo clips.
  `attackSample` maps separate wind/active/recover durations (0.16/0.13/0.18 s for the first,
  0.18/0.14/0.19 for the second, 0.42/0.15/0.36 for the heavy third since v2.31 (0.32/0.16/0.27 before); v1.41, the author: "speed up the main
  character's attacks": each phase about a quarter quicker, the whole combo 1.73 s against 2.28, the cooldown after
  it 0.4 s against 0.5) onto source time.
  **The heavy third** (v2.31, issue #712: "the third strike with my sword is a crouch strike which doesn't make sense, it
  should be a third heavy strike, check what BotW does"): the Great Sword pack's slash 3 (`gs_slash_3`), the combo's finisher.
  Breath of the Wild's one-handed string ends on its most committed blow: Link steps into it, it comes from higher and
  further and throws the foe back, and he is a beat longer getting out of it. Ours stands tall: the sword raised over the
  head in both hands through the longest wind-up of the three (0.42 s; the point 2.26 m up), cleaved down and across in
  front (0.15 s; the point from over his shoulder to 0.4 m off the ground 1.5 m out) and brought back up into guard over a
  slower follow-through (0.36 s): 0.93 s against the old 0.75. The camera nudges (`kick` 0.12) as it comes down, landed or
  not; on a hit the third's damage 3, knockback 2.2×, the 0.11 s hit-stop, the heavy hit burst and the heavy sounds
  (`fluidSlash(2)`'s deeper whoosh, `fluidSlashHit(true, true)`). Slash 5 (`ss_slash_5`, v1.39–v2.30) was an overhead
  chop out of a crouch: the pelvis down 0.48 m and the cut low (`tests/blade-attacks.test.js` now keeps it under 0.25 m
  and the point over 2 m); before it, attack 1 (`ss_attack_1`), a leaping overhead that took both feet 1.4 m off the
  ground (the author: "I don't want the third attack to be a jump"; slash 3's feet stay down). `scripts/combat-reach.mjs
  --swings=3`: 0 misses of 92 before and after.
  **The third that lands** (v2.35, issue #759, the author: "my third blow never connects with enemies. Like he is
  attacking up and backward vs towards the enemy?"). The reach table stands its foes still and lets no blow shove them;
  measured instead with the foes' own minds and the first two blows' shoves (the reach rig, eight kinds from 1.2 to 2.5 m,
  locked on and not, 64 combos): the third missed 26. A hulk's or a warlord's chest leapt him off the ground at the first
  press (#747); a grunt or a prowler (mass 0.8) slid 1.5 m back from the second cut through the third's 0.42 s wind-up and
  stood 2.4–2.9 m off as the blade came through, while the pull had been worked out once, at the press, from where it
  stood then; and through that wind-up the clip turns his hips 73° away from the foe, the sword dropped behind his head,
  which reads as a blow up and backward. Now:
  - **kept to its foe** (`TRACK`, `FluidBlade.follow`): through the wind-up and the cut's pull (`closeInTime`) a grounded
    swing (the combo's, the whirl, the riposte; not the carried specials) turns its way to where its foe is now and takes
    the pull again from there (up to `MAGNET.max`), so a foe shoved back or stepping aside is met. One that hops back out
    of the swing on purpose (`fight.evade`, the prowler's flip after two cuts: `hopBack`) is let go, as designed;
  - **turned into it through the coil** (`SWINGS[2].face` 0.6, `hipYaw`): the body is turned back toward the foe by 0.6 of
    the clip's own hip turn through the wind-up, eased out over the cut (locked on too: the lock's facing takes
    `aim.face`), so his hips are at most 45° off the foe (73° before) and the raised sword is cocked at it.
  After: 0 of 64 missed but those hopping back on purpose (the prowler's flip, the grunt's dodge: 10, by their design);
  with their dodges off, 0. `tests/combo-third.test.js` (a blot, a grunt and a hulk from 1.2 to 2.5 m, locked on and not,
  minds and shoves on: all three blows land; the hips within 55° of the foe in the wind-up).
  Grounded swings use the legs and hips. `Animator.playCombat` blends clip changes (and the way back to
  locomotion) over 90 ms from the displayed pose, including motion matching when enabled (v1.3: it had
  blended nothing, `isBone` finding none of the library's plain-node joints; a swing into the next jumped up to
  2.3 rad in a frame). Grounded cuts step forward through Player's normal collision movement and limit
  steering until recovery. Every attack played from a clip is in `ATTACKS` (the three, the whirl, the lunge,
  the charge, the air cut, the riposte, the dash cut).
- **On the clip's own swing frames** (v1.3): each attack's cut (`activeRange`: `activeFrom`–`activeTo`, else
  `hit` −0.08/+0.1) is where its clip's blade moves fastest, measured on the traveller (the tip's speed through
  `from`–`to`): the three 47/37/37 m/s at 0.60/0.81/0.56 s, the whirl 27 at 1.06, the charge 22 at 0.66, the air
  cut 18 at 1.16, the riposte 33 at 1.39, the dash cut 43 at 0.56, each well over its speed round the cut. `tests/blade-attacks.test.js` checks it, so a clip's
  times can't drift off its swing. The trail follows the same window (`trailCut`): through the cut the fluid's wake and drops off the
  edge and sparks over the ground the edge crossed since the last frame (v1.7: "The look" below), else one glint
  at the tip; while charging, sparks drawn in to the blade. (The studio's paused `time` is not the clip's: its
  0.4 s is about 0.85 s of the clip. Measure in the game, as the test does.)
- **The charged cut** (`CHARGE`, v1.3, the Great Sword pack's slash `gs_slash_1`): the blade button still held
  `CHARGE.after` (0.3 s) after the press that began a combo swing (on the ground) turns it into a charge once that
  swing has cut (`chargeOpen`: its wind-up or its follow-through, never mid-cut; `FluidBlade.charging`): the clip
  drawn from 0.3 s to its cocked pose (`hold` 0.45 s, the sword back over the right shoulder) over 0.18 s, blended
  in from the swing over 0.2 s (`playCombat`'s `blend`), and held there with a slow breath (`chargePose`) as long
  as the button is; a slow step at most (`combatMotion.scale` 0.3), turned to the nearest foe; the blade pulses;
  full after `CHARGE.full` (0.85 s since v1.22; 0.6 before): a white ring and a ping (`sound.fluidCharge`), and a
  ring of the fluid at his feet. **The held charge shows** (v1.41, `CHARGE_LOOK`, `chargeBody`; the author: "an
  animation that clearly shows the held charge"): he sinks 9 cm into his knees over the first 0.25 s
  (`player.chargeHold`, laid over the body after the clips), motes of fluid drift into the blade from 0.75 m round
  it (14 a second, more once full), and once full he trembles with it (0.018 rad at 31 Hz). Until v1.41 the charge
  took over the first swing's wind-up 0.2 s after the press, while that wind-up lasted 0.22 s: a press held a
  little long turned the first attack into a half-drawn charge let go at once, the strange wind-up the author saw
  now and then. Now a tap is always the swing, and a hold is the swing and then the charge. Let go (or leave the ground): `release()` plays the clip's swing from 0.45 s (cut
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
- **Mid-air combos** (`AIR_COMBO`, v1.41, the author: "mid-air sword combos after jumping and attacking"): in the
  air the first two presses play the combo's first two swings over the jump's legs (upper body; light, damage 1,
  `info.air` so they meet a flyer double; their cone tipped 0.35 rad down), each lifting him to 2.4 m/s as it starts,
  then holding his fall to 0.8 m/s through its wind-up and cut (2.4 through its follow-through) and carrying him in to
  a foe up to 2.6 m out of reach; the next one pressed for cuts the follow-through short. The third press is the air
  cut above, the plunge, ending it (`airN` counts them, reset on the ground). Tests: `tests/blade-attacks.test.js`.
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
  `late` (0.15 s) of its end (`sinceEvade`), with the dash cut's `cooldown` (1.1 s since v1.47, was 1.5; `dashCool`) over, plays it
  the moment the evade ends (`dashOpen`): the clip from 0.3 s, cut 0.49–0.64 s (0.16/0.14/0.26 s), a sweep from
  his left round to his right (cone half-angle 1.7 rad). Player's controller carries him (`combatMotion.dash`,
  set like the evade's) toward `past` (1 m) beyond a foe within `pull` (5 m), `side` (1.1 m) to its left, so it
  passes on his sword side and the sweep crosses it, at what that takes over the wind-up and cut (5.4–16 m/s;
  no foe: 9 m/s straight on), slowing through the follow-through; still facing the foe. No i-frames of its own:
  the evade's window is over before it starts. Damage 2, heavy; the cooldown, as after a third swing. Through a
  foe's back (v1.47, issue #35: the blow's way within about 75° of the way the foe faces, `Foe.fromBehind`,
  src/foes.js `BACKSTAB`) it lands double, and a gold ring runs out round the foe: the answer to a foe turned from
  you (on another target, swinging at your partner) and to the evade or the side hop round one that just struck. Within its
  cooldown a press out of an evade is the plain buffered swing. `tests/blade-attacks.test.js` checks both
  (window, damage, stagger, chop on the foe's line, the carry past the foe, no i-frames, the cooldown).
- **The running cut** (`RUN_CUT`, `runCutOpen`, v2.32, issue #718: "pressing shift + attack with the sword creates a non
  sensical animation"): the blade pressed at a run (sprinting, or 5.2 m/s and more on the ground), a combo's first swing
  and not in a chain. It was the standing first slash played over a sprinting stride, the legs held mid-stride while the
  swing's 1.7 m/s step slid him from 8 to 1.4 m/s in a third of a second. Breath of the Wild's sprint attack carries the run
  into one strong cut and a recovery; ours plays the dash cut's clip (the running cut, attack 2, 0.14/0.14/0.36 s) with
  the run's own speed (at most 9 m/s) carried through the wind-up and the cut along the swing's way (at a foe in reach, else
  straight on; no magnet step), easing to a stop over the follow-through as (1 − u)^1.6 (`combatMotion.dash`, so the run's
  lean and turn are left out). Damage 2, heavy (the knockback, the hit-stop, the heavy hit burst), the dash's rush of air
  (`fluidDash`) and the heavy whoosh; the cooldown after it, as after a third swing. Not the dash cut's backstab. The lunge
  (an ink upgrade) still takes a run's swing first. Standing with Shift held, the blade is the plain first swing. Tested
  in `tests/blade-attacks.test.js` (from a sprint: the running cut, the speed carried into the cut and eased to a stop,
  never a lurch); the same with the default sprint and with `?sprint=kevin`.
  **No spin** (v2.35, issue #760, the author: "Running attack animation is still non sensical"). Frame by frame (the Arena,
  side on, every 0.05 s) attack 2 is a spinning cut: his hips turned 108° one way through its wind-up and 141° the other
  through its follow-through (measured on the traveller), so a cut begun at a sprint ended with him turned round, the
  blade pointing back the way he came, and his whole body planted and slid along at the run's speed. The running cut is
  now the Great Sword pack's slash 1 (the charged cut's clip) from the sword going up (0.3 s; cut 0.54–0.76, as the
  charge's, 0.14/0.14/0.36 s): raised over his right shoulder and cleaved down and across in front of him the way he runs,
  his hips within ±32° of it, played over the upper body only (`RUN_CUT.upper`: `swingMove.full` false), so the legs keep
  running as the run carries him and slow to a stop with it. Slash 1 of the Sword and Shield pack (the combo's first) over
  the run read the same way but lighter; the great sword's slash with the whole body slid its planted feet. The dash cut
  keeps attack 2: it passes a foe on purpose and ends turned back to it. Tested: the hips never more than 69° off the way
  he runs (the old spin 141°), the blade 0.9 m and more out in front through the cut, the legs his own.
- **The arm (the arcs):** the swing drives the tool's aim pose (`player.aim`, the same IK the shots use) along
  `swingArc(n, u)`, so the body turns to the swing. It turns toward the nearest target with `lock: true` within
  `BLADE.lock` (6 m), else where you face.
- **Guard:** Ctrl or Z / LB / L1 / touch ◇ independently opens the shield on the left hand (below: *In the hands*); it covers what it covers as drawn. A fresh guard has a
  0.18 s parry window (0.35 s rearm), consumes that opportunity on contact, and spends no charge.
  A held guard spends one charge per block. Both require facing the blow. A parry leaves the enemy
  open for 1.8× its normal recovery; an ordinary block for 0.65×. **The guard at any moment** (v2.35, issue #757, the
  author: "I should be able to shield/parry at any time even in the middle of an attack animation"; `guardCancels`,
  `GUARD.cancel`): a fresh press of the guard stops whatever swing is under way, in its wind-up, its cut or its
  follow-through (the combo's three, the charge held or let go, the riposte, the dash cut, the running cut, the air
  combo and the air cut), and the chain with it. The guard comes up from the pose the swing had reached, drawn whole at
  once (`guardLead`: the block idle at full weight) and blended from the pose on screen over `GUARD.cancel` (0.1 s), so
  it reads as the sword pulled back into guard rather than a snap. Its parry window, rearm and the shield's rise are a
  fresh guard's: only the gate changed. Held from before, the guard still lets the riposte begin under it. Until v2.35 the
  guard waited for the swing to end (the third's 0.93 s). Tests: `tests/guard-cancel.test.js` (each of the three swings
  in each phase, the charge, the dash cut, the running cut and an air swing; a perfect parry in the fresh window; no bone
  turning 0.8 rad in a frame).
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
- **Quieter hits, and the black blocks** (v1.41, the author: "too much visual noise and too many particles on hits …
  investigate the suspected shadow artifacts when hits land"). *The artifacts were not shadows.* A few frames in every
  hundred through a swing (hit or miss; none standing still) dark blocks and discs covered the blade, the traveller and
  the braziers by the Arena's gate: hunted by counting near-black pixels at the middle of the screen every ~45 ms through
  scripted combos (3–5 frames in 144 at v1.40), then hiding parts in turn: the traveller's rigid parts, then the sword,
  then the blade alone took them all away. The blade's light (`src/blade-shader.js` `bladeLight`) took `pow(1.0 - ndv,
  3.0)` for its rim with `ndv = |n·v|`, and an interpolated normal a hair longer than 1 made the base negative: pow() of a
  negative is NaN in GLSL, the NaN went into the G-buffer's albedo and the bloom's blurs (`createBloom`) spread it into
  blocks round the blade and the other glowing things it reached. `ndv` is held to 1 and the base to 0 now (0 frames in
  288); the foes' surface glow had the same rim (`src/foe-surface.js` FS_GLOW: `facing` held to 1), and
  `tests/shader-nan.test.js` keeps every `pow(1.0 - x, …)` in both with `x` held. *The noise*: a blade's cut now lands
  its own small splash (`HIT_FX`: 7 drops and a glint, no ring; it was the gun shot's, 28 drops, 5 glints and a ring,
  on top of the foe's own), the foes splash less (`src/foes.js` `HIT_SPLASH`: 9 / 5 / 3 drops by how a blow told, was
  16 / 10 / 6; the burst 24, was 46; the glints to the tank 6, was 10; sparks 8, was 14), a block throws 10 drops (18),
  a parry 8 glints (12), and every cut lays at most 3 sparks a frame over the ground it crosses (6) and a landing drop
  pops one droplet (2). Measured through three combos into a blot: 161 → 99 drops and 45 → 25 glints at the busiest,
  93.5 → 56.9 on average.
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
    - *At rest*: in the fist between cuts out of a fight nothing stands out of the cup, only the bead in it breathes
      (±12 % on a 3 s breath, on the back too). In a fight (`FIGHT`, below) it stays open at full length between cuts
      (`bladeLitWant`: `FIGHT.lit` 1 with the hilt in the fist; issue #390, it went dark after every cut). `BLADE_LOOK.idle` (`bladeIdle`, eased with `idleK`) could stand a share of the blade
      out of the cup; it is 0: at 11 % (9 cm) the tongue read as a small dagger in stills and changed the weapon.
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

- **Carried by the bones.** The hilt is a child of the right hand's bone and the shield's bracer of the left forearm's,
  so they are wherever the hand is drawn after every layer of the frame's pose (clips, motion matching, combat
  moves, aim and foot IK, scene overlays): no lag, nothing to update in order. `carry` parents them;
  `fitScale` undoes the bone's world scale (a taller body holds the same sword).
- **Where in the hand** is read once per body from its own fingers (`fistGrip`): in the fist pose each finger
  wraps round the grip, so the circle through its three joints is centred on the grip's axis; the line through
  the four centres (little finger to index) is the grip, the blade out on the index's side, the edge the way the
  fingers point out of the palm (`+x` of the hilt), the flat to the palm. The hilt's origin is the middle of
  its grip. On the swings the edge leads the tip's motion (|cos| 0.93–0.99), which tests check. The shield's bracer
  (`forearmMount`, issue #284) is strapped round the left forearm, `FOREARM.along` (0.66) of the way from the elbow to
  the wrist, on its outside: the way the back of the hand faces as the hand is turned now (`forearmFrame`, each
  frame: the forearm bone itself never rolls, a real forearm does near the wrist).
- **The strap wraps the skin** (issue #303; `forearmWrap`, `wrapFrame`, `wrapLift`, `STRAP`; `ShieldDevice.wrapStrap`,
  `bendDisc`). Once a body, rays out of the forearm's bone line on the body as it was bound find, for each row of
  the leather (`STRAP.bands`: the wide strap's two edges and middle, the narrow one's two edges nearer the elbow),
  24 points of the outermost drawn skin round the arm (a sleeve over the arm, not the arm under it; triangles the
  forearm or the hand move), each a skin triangle and its weights. Each frame those 120 points are skinned as the GPU
  skins them (about 300 vertices, 0.06–0.09 ms), so the leather lies on the skin however the arm is posed: the
  inside 0.5 mm off it, `STRAP.leather` (3 mm) thick, its outside following the arm's own section (no circle: the
  B3 forearm is flatter than it is wide). The bracer stands where the skin crosses its outside way (`wrapLift`) plus
  the leather and `STRAP.plate`; the plate and its rivets bend to the strap's outside across the arm and the folded
  drum's foot comes down to it (`bendDisc`), so nothing floats off a round arm. A hole in the skin is filled round
  the bone line from the points either side. `tests/strap-skin.js` measures it on its own (three.js's
  `applyBoneTransform`, each strap vertex's distance to the nearest skin triangle): on the B3 traveller and the plain
  body every strap vertex is 0–3.4 mm off the skin through standing, walking, running, turning and every combat clip,
  never more than 1.5 mm under it (`tests/blade-grip.test.js`). Before, the strap was a round 4.1 cm tube on the bone
  line: on the B3 forearm it stood a centimetre off the skin at the sides and the drum floated over a flat plate.
- **Drawn or put away** (`bladeDrawn`, `STANCE`, `FIGHT`): in the fist while swinging, guarding, evading, locked on,
  in a fight (`foeEngaged`: a foe chasing, winding up, striking or recovering within `FIGHT.near`, 10 m, or locked
  on, and `FIGHT.after`, 3 s, past the last of them, so it never flickers between cuts), or within `STANCE.linger`
  (2.5 s) of any of those or of a blow taken; the fight over, the usual sheathe. Put away at once when the tool may not act
  (climbing, swimming, gliding, the jets, riding, aiming the gun, knocked down, a scene or a conversation). The
  hands close round them (`player.swordGrip`, `player.shieldGrip` → `handTargets` `sword` / `shield`).
  Put away, the hilt sits in a leather frog on his back, behind the right shoulder (`src/sword-sheath.js`;
  `docs/systems/traveller-kit.md`, "On his back"): drawn, the right hand reaches back over the shoulder for it
  (0.34 s), put back the same way (0.36 s), and with the arms busy it flies back at once (0.15 s). A press with
  it on the back swings on that frame, every attack's timing and cut unchanged: the hilt comes to the fist in
  0.12 s, before any cut opens, and the blade lights only in the fist (`FluidBlade.place`: `sheath.held`).
  The hits always read the fist's own frame (`gripMatrix`), never where the hilt is drawn on its way.
- **The blade's segment** (hits) is read from the hilt's own frame, so it is the drawn blade exactly.
- **The shield** (`ShieldDevice`; issue #284, after `references/Core Objects/Fluid Shield/shield-turnaround` and
  `guard-poses`): a worn leather bracer round the left forearm with a riveted brass plate, and on it the folded hub,
  always there with the backpack. Open, it is 0.35 m in mean radius (`SHIELD.radius`): six rounded brass petals
  (`SHIELD.petal`) spread flat inside a riveted brass ring round the hub, the solid part, standing `SHIELD.stand`
  (5 cm) off the bracer on a short knuckled arm; round them a disc of the sword's own water (`shieldMaterial`: the
  blade material, `fluid: 'blade', disc: true`, the BLADE_DISC branch of `src/blade-shader.js`): the same tones,
  currents, pen line, ripples, motes, breathing glow and soft ink, the currents wound in a slow swirl round the hub,
  jade where the water is shallow, the edge a bright pale lemon meniscus. Its edge is a blob, not a circle:
  `blobRadius(θ, t, wobble)`, three waves of 3, 5 and 8 lobes running round at different speeds (about 0.86–1.1 of
  the radius), rippling more as it floods out, on a block and cracked (`ShieldState.wobble`). The disc (`Disc`) is a
  lens of two sheets rebuilt each frame to that edge, a shallow dish (`dishZ`: its rim 1.7 cm forward of the hub)
  thickest at the hub; the back sheet (the camera's side, behind him) is see-through but for the rim, the swirl's
  strokes and a 22 % print screen of the water (discarded, the game's materials being opaque), so what he guards
  against stays in sight. `ShieldState` is the pure state machine (folded → opening → open → closing, and broken):
  it opens in `SHIELD.open` (0.16 s; the guard counts as up at `guardK` 0.5, unchanged), the six petals spinning out
  one after another, the fluid flooding out to the rim after them; `hit('block')` sends a ring running out to the rim
  (the blade's ripple, `uBladeB`, `uBladeC`), `'perfect'` a gold-tinged one, a flash and two bright blob-shaped rings
  bursting off it, `'broken'` (a blow within its arc with the tank empty) cracks and flickers it until it mends; it
  folds in `SHIELD.close`. Sounds: `shieldOpen`, `shieldClose`, `shieldBreak` (src/audio.js), on the state
  machine's transitions.
- **Coverage is the drawn shape.** Each frame `ShieldDevice.arc` measures the bearings between the shield's two
  edges (`SHIELD.radius` + `SHIELD.slack`) as seen from the chest (`shieldArc`); `block()` tests the blow's
  bearing against that arc (`guardArc`), and the hitbox overlay draws the same arc. With no shield drawn,
  `GUARD.angle` is the arc of one held `GUARD.reach` ahead (about 48°). The reach either side is measured off
  the drawn blob's edge (`ShieldDevice.outline`, 36 points: its furthest along the shield's flat side either
  way, never less than 0.9 × `SHIELD.radius` while it floods), so the arc follows the shape as it ripples.
- **Raised by the arm that wears it** (`brace`, `braceShift`, `SHIELD.middle`, `brace`, `swivel`): the guard clip
  (`mixamo_ss_block_idle`) raises the left forearm; as the shield opens the arm is brought across (a two-bone solve
  of the left arm after the pose) so the bracer stands `SHIELD.middle` (5 cm) left of the chest's middle line, moved
  `SHIELD.brace` (0.3 m) at most, never out to the left, and the face turns on its knuckle toward the guard's way, at
  most `SHIELD.swivel` (1.3 rad) off the forearm's outside (a strapped shield never faces back). In the block pose
  its hub is about 6 cm left of the middle line, 0.3–0.4 m ahead and 0.25–0.3 m over the chest, the arc 52° each side
  centred 4° from facing on the v1 traveller (58° and 3.5° on the plain body); `tests/blade-grip.test.js` checks it on the B3 traveller and the plain body,
  50–60° and ±5°, and the bracer on the forearm on every frame of every combat clip. Before (v0.93 to
  v1.66) the shield's disc sat on the back of the hand and the open shield slid on a 0.42 m brass arm to the chest.
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
  not the floor" below); only a lob and a crawler's blast mark the floor. The off-screen warning marker remains. Light hits interrupt blots;
  since v2.33 (issue #722) everyone else's wind-up is committed once begun, and only a broken poise stops it ("Poise, tiers
  and states" below). Before, a cut in the first two thirds of any wind-up cancelled it.
- **What hurts them:**
  - the blade: `info.damage`;
  - a fluid or ember glob: washes a blot (1), only staggers a machine;
  - stilling: holds either for 3.5 s;
  - the push: shoves them.

  A cut breaks a blot's wind-up; anyone else's only when it breaks its poise (v2.33).
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
| A heavy blow: a winged blot's dive, a ring drone's ram (a dive, v1.22), a shade's sword, a machine's quake slam, an erupting ray, a glass golem's slam or hurl, a crab's spin, a slag walker's stomp or pour; a world foe's rush, tail, beam, pulse, dive | ¾ | same |
| A crushing blow: a machine's slam; a world foe's groundbreaker | 1 | `FOES.machine`, `enemies/attacks.js` |
| A guardian's lighter blows: a combo's quick links (pecks, snaps, jabs, stutters), each shard of a thrown volley, a gale, a shockwave ring | ½ | each temple's `attacks` (`wind:` lines) |
| A guardian's strike: the sweeps, the cries, the lobs, the buffets | ¾ | same |
| A guardian's heaviest: the stamps, the slams, the charges, the dives, the beams of the Tooth-Warden and the sentinel | 1 | same |
| A temple's swinging guardian piece; a fall into a temple's pit | ½; ¼ | `temples/pieces.js`, `temples/runtime.js` |
| Fire (the burning tree), a fan's embers, spines (cacti), a temple's spike row | 1, ¾, ½, ¼ a second, in quarter bites | `HAZARD_DPS` (`hazards.js`) |
| Out of air under water | ¼ every 1.2 s, never the last quarter | `SWIM.bite` |
| A hard landing (a drop of 16–36 m) | ¼ to 2 (`FALL.worst`), never the last quarter | `fallDamage` (`player.js`) |
| A fatal fall (36 m and more) | all of them | `FALL.lethal` |

- **The last worlds** (v1.22, `HARM_BY_STAGE`): in the Buried Machine, the Garden of Spheres and the Signal Market a
  heavy blow takes a heart; in the Market an ordinary blow takes three quarters ("Balance and sound" below).
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
makes it; the only marks on the floor are a **projectile's landing mark** (`lob: true`: a spitter's globs, a golem's
hurled chunk, the guardians' seeds, clods, cogs, mortars, notes and hail), drawn where it will fall, because the
thrower's wind-up can't show where it lands, and since v2.35 (issue #758) a **blast about to go off** round a foe
that destroys itself (`selfDestruct`, the crawler: `isArea`), whose reach the little body can't show. `groundMark(a)`
is the one test (src/foes.js `look`, src/temples/boss.js `tells`); `tests/telegraphs.test.js` walks every attack
definition and fails on a ground zone that is neither. The hitbox overlay (`src/hitboxes.js`, debug) still draws every
zone. How they are drawn: "Ground warnings" below.

### Ground warnings (v2.35, issue #758, `src/ground-warnings.js`)

The marks and the shockwaves are drawn into the ground after the author's picked sheets
(`references/effects/lob/sheet-1.jpg`, `references/effects/area/sheet-1.jpg`, `references/effects/wave/sheet-1.jpg`; the prompts in `docs/design/ground-warnings-prompts.md`), in ink,
never a flat disc floating over it:

- **lob** (over exactly the wind-up, `f.k` 0..1): the projectile's own shadow at the landing spot, small, pale and
  hatched round its edge, then darker and crisp (`lobShadow`); a thin red-orange ring, dashed for the first 30 %,
  tightening from 1.45 × the hit's radius onto exactly it by 90 % (`lobRing`, never inside it), a dark ink line just
  outside it, four ticks pointing in from 25 %. At the strike (the `strike` event; a guardian's `strike`), a burst of
  grit strokes inside exactly the ring for 0.4 s, and grit thrown up.
- **area** (the crawler's fuse): a dashed ink ring at the blast's radius and short ink blades leaning out round it;
  from 35 % radial hatching grows in from the ring (`areaFill`) and the ring goes solid; from 72 % a warm orange disc
  grows out from the middle and the ring and hatching turn red-orange. At the blast (`Foes.shatter`), a flower of
  twelve petals whose tips reach exactly the ring, for 0.45 s.
- **wave** (`Foes.ringOut`, a guardian's `addWave`: the shock itself, not a warning): a knee-high (0.55 m) curl of sand
  with a red-orange crest, in segments round the front (one each 0.45 m, 24 to 96), each a little higher or lower,
  its footprint exactly the hit's band `r ± width`; it grows in over the first 15 % of its run and sinks over the last
  20 %; speed lines inked on the ground behind it, grit thrown off its crest. A segment is not drawn where the ground
  is more than `SHOCK_STEP` (1.2 m) above or below where it started (the hit's own rule: it does not hit there). At its
  reach it leaves a scored ring that fades over 1.1 s.

Everything sits on the ground under it: each stroke's two ends and each disc's middle on `physics.groundAt`, cached
on a 0.5 m grid (bilinear between cells; a cell sampled once, the cache cleared after 2 s with nothing drawn), so a
ring on a slope or a stair follows it. Four `InstancedMesh`es with a colour an instance (strokes, discs, the curl,
the crest) on plain `makeMaterial` surfaces (thin lines, `line: 0.25`; no shadow), so Unity draws them through the
mirror as it draws the Rings. What draws a warning touches it each frame (`gw.lob(key, at, R, k, i)`, `gw.area`,
`gw.shock`); `gw.update(dt)` draws what was touched and lets the rest go back to a pool. Measured (Mac, Chrome,
the Arena, High and Handheld): `update` 0.17 ms a frame on average while anything is drawn (p95 0.4 ms), about 1 000
ground rays for a whole run of nine attacks; at most four draws, none when idle (the pools are hidden). Tests:
`tests/ground-warnings.test.js` (radii, slope, timing with the attacks, pooling).

**The rules a new enemy follows** (the coming archetypes reuse them; nothing per enemy is needed for the generic
path):

1. **The pose.** Each attack has its own wind-up of the body: rear back (a slam, a stamp), crouch and draw back (a
   charge, a pounce, a peck), coil away (a sweep), spin up (a spin), raise (an overhead, a lob), swell (a cry, a
   pulse), rise (a dive). The models' `anim` (src/foe-kinds.js), the world enemies' shared motions
   (src/enemies/models.js `animate`, keyed by the attack's `motion` in src/enemies/attacks.js), a guardian's `rig`
   (src/temples/boss.js `poseRig`) and the model's own poses. The pose is complete at **`POSE_DONE` (75 %) of the
   wind-up and then held still**: the brief stillness before the strike.
2. **No glow** (since v2.34, issue #733: "there is a diamond shape that appears when an enemy is attacking, I want to
   get rid of that"). Until then a spark of the attacker's tone (`ChargeGlow`, an octahedron and three rays) gathered
   on the striking part through every wind-up; the Keeper's had gone in v1.71 (#320, "a weird triangle"). Foes, world
   enemies and guardians are told by the pose, the sound and the eyes. The striking part (a model's `tell(attackId)`,
   a guardian's attack `part`) still anchors the swing's trail.
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
| makers’ machine · slam | 1.05 | heavy (0.95) | one arm high over its shoulder (a perfect parry chips it, v1.63) |
| makers’ machine · quake | 1.35 | heavy (0.95) | both arms high, crouched low, a rumble under the floor (v1.63: jump it; its claws stick after) |
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
| shadow hound · pounce | 1.0 (0.8 until v1.63) | ordinary (0.7) | crouches back on its haunches, then coils: rump up, its smoke on end, a shiver and a snarl |
| shadow hound · step | 0.9 | light (0.5) | sinks into its own shadow pool |
| shadow hound · bite | 0.55 | chain (0.4) | (behind you; the screen-edge marker) |

### Swoosh trails (v2.26, issue #663, `src/attack-trail.js`)

Each foe's striking part (the part its model's `tell` names: `Foes.strikePoint`) lays an
inked ribbon behind it through an attack, so the swing's path stays on screen a moment. Its look is read from the
attack's own timing (`trailPhase`, the same states as `Foe.attackPhase`), never a clock of its own:

| phase | when | look |
|---|---|---|
| `wind` | the wind-up (the part rearing back; still after `POSE_DONE`, so the held stillness lays nothing) | a thin ink stroke, a dusk-violet edge (`TRAIL.width.wind` 0.1 m) |
| `active` | the strike until its hit is checked (`contacted` false) | the widest ribbon (0.46 m × size), warm danger red-orange with a hot cream leading edge |
| `spent` | the strike's follow-through after the check | the same colours, narrower (0.26 m) |
| (none) | recovery, a blow broken off, a lob / flash / blink / surfacing (their own signs) | nothing laid; what is there thins away over `TRAIL.fade` (0.28 s) |

A ribbon is two lanes (the part's edge, the body toward the chest) laid square to the part's motion in the plane it
swings through (`trailSide`; a straight lunge stands up). It fades by thinning, never by transparency, and folds its
unused points onto its last (no draw range), so the Unity bridge mirrors it as any dynamic mesh. One pool for every
foe (`TRAIL.max` 10 ribbons, two meshes each, four shared materials, no shadow); nothing is made per attack, and
`Foes.remove` releases its ribbon. Tests: `tests/attack-trail.test.js`.

### Entrances: out of a cloud of darkness (v2.26, issue #664, `src/foe-entrance.js`)

A foe called in (the Arena's waves and practice `spawnKind`, a pack in the wilds: `add(kind, at, {
entrance: true })`; placed machines, posts and split-offs stand in the world as before) arrives inside a swirl of
ink-outlined dark blobs. `ENTRANCE`: the cloud gathers over 0.35 s (the body hidden), the body grows up out of it over
0.55 s (`bodyGrown`, its scale after its pose), the cloud thins outward and is gone at 1.5 s (`cloudSize`). For
`ENTRANCE.hold` (1.1 s) its mind waits (`Foe.arriving`: it only turns to you) and its target is off (no lock, no cut);
its first cool (0.6 s) starts after that, so its first telegraph begins at 1.7 s at the earliest, after the cloud has
gone. One instanced mesh for every cloud (`FoeClouds`, 160 blobs, one draw, no shadow), the same pattern as the
defeat's smoke. Tests: `tests/foe-entrance.test.js` (the timeline, the pool, the held mind and lock, repeated spawns
leaving no mesh behind).

### The tells read again (v1.63, combat-v1.61 #260 #261 #258)

- **The antler hound's pounce**, its most frequent blow, told for 0.8 s and was read a beat late (the evade had to
  come in its last 0.08–0.15 s). Now 1.0 s in two beats: the crouch (as before), then from half-way the **coil**
  (`quadruped.js`: the rump up, the smoke of its mane on end, a shiver) with a snarl (`cue: 'coil'`); its weight
  1.5 → 1.0, so it comes a little less often.
- **The makers' machine** had two attacks and the fewest answers: its quake got through the guard at any lead and
  nothing told or rewarded the jump. Now the quake rumbles under the floor as both arms rise (`cue: 'quake'`), takes
  only feet on the floor (`ground`: a jump clears the slam round it as well as its ring), and its claws stay **stuck**
  in the floor after it (`opens` 1.8 s, `stuck`: stunned, the stars over it, a cut lands double; `Foes.worldEvent`
  'stuck' says "cut it now" once); the slam's perfect parry knocks a plate off (`onParry: 'chip'`). Met, it says:
  guard the slam, jump the ring, cut it while it is stuck (`FOES.machine.note`, read by `Foes.meet`).
- **Nine guardians' quickest move** (the Elder's peck, the Cloud-Mother's roll, the First Sign's stutter, the
  Tooth-Warden's stomp, the Foreman's jab, the warden's stomp, the Mother Snapper's snap, the Lampless's flutter, the
  Echo's ripple) told for 1.0–1.1 s and read 3; now 1.2 s (`WIND_MIN.guardian` 1.0 → 1.2, `tests/telegraphs.test.js`),
  the pose, the glow and the rising voice stretched with it (they follow `windOf`). A fight's beats hardly move: one
  round of every phase (`scripts/combat-review/lib.mjs` `guardianRound`) is 0.2–0.5 s longer in 44–63 s.
- **An attack's `cue`** (`src/foe-voices.js` `CUES`, played by `src/audio.js` `foeWarn` over the rising warning,
  from a share of the wind-up): a second tell by ear for the body's second beat.

### Legs on the locomotion kit (v1.7, `src/motion-kit/`)

The salt crab, the shadow hound, the makers' machine, and the world enemies with six legs, four (the newts) or
pistons (every possessed machine) walk on jointed legs planted by the kit (docs/systems/procedural-animation.md,
§6). Its pose blend is the body's half of a wind-up: as the wind-up starts the feet brace-step wide and lock,
the body sits back and down against the strike with the telegraph's own timing (complete at `POSE_DONE`, then
held still), and the strike snaps through on an underdamped spring; a lunge unlocks the feet. The models' own
wind-up moves (claws up, a crouch, an arm raised) go on top, so each attack still reads apart.

### On a slope (v1.72, issue #332, `src/enemies/slope.js`)

Drawn square to the world, a foe on a 14° hillside had its uphill side under the ground: the cart's tracks 27 cm, the
toad 60-69, the lizard's tail 22, the heron's toes 18, the tripod 25, the brute 1 m (its fists and the Lorn saw were 37
and 62 cm under even on flat ground, the shade's smoke 18, the roller's sole and chin 5).

- **The plane under it** (`readSlope`, `planeUnder`): every archetype on the ground (`SLOPE.kinds`; not the flyers and
  floaters, the worm or the guardians) reads the ground at its feet and `radius` m round them (five `groundAt`, at most
  every `SLOPE.every` = 3 frames, staggered, and only once it has gone `moved` = 0.25 m since the last, or `stale` = 60
  frames on: one standing still reads none; 16 walking ones about 5 rays a frame more), each axis from whichever side is ground it stands on (a side steeper than 45° is a
  step or a drop, left out; of two that disagree by more than `kink`, a ridge, the gentler). `f.slope` eases toward it
  (`rate` 7/s), its tilt capped at `max` (0.45 rad); a new foe is on its slope at once, one off the ground (in the air, a
  hop, a flight, lifted) eases back to level; a falling one keeps the slope it fell on.
- **The root turned onto it** (`tiltRoot`, `Foes.look`): premultiplied about its feet, its heading kept; a rigged body's
  just before its legs are solved (`Foes.beforeLegs`), the rest after its pose. On the plane the model is as on flat
  ground: tracks, soles, tails, hems and the pads of its feet lie on the hillside.
- **The kit on the plane**: the rig carries it (`Rig.setSlope`) to the planner, whose feet with no ray of their own (a
  home, a replant after a hop, the far tier's canned cycle, a step's landing moved by a turn) go on the hillside
  (`GaitPlanner.rise`: a step turned a metre round kept its ray's height and planted 52 cm under), and to the body, whose
  feet are measured against the plane (`BodyFromFeet.update(…, plane)`): only the bumps beyond it tip and lift it. A tall
  body stands back up by `upright` of the slope on its legs (the heron 0.8, the tripod 0.6, the bell walker and the
  brute 0.5, the shade 0.3). The cart's `TrackDrive` reads its belts' corners against the plane too; the centipede lays
  each plate and its head on it along their own headings and its feet's landings with it (`WaveLegs.plane`).
- **Parts that hang to the ground** keep off it, each by its own points (`kit.js outerPoints`: the outermost of a part
  along 98 directions, taken before its meshes are merged; `lowestIn`): the brute's elbows bend until its fists, the saw
  or the ladle are 5 cm over the ground (`clearGround`); the shade's smoke tongues shorten to it; the lizard's and the
  hound's tails lie on it (`placeBeads`); the toad's belly lands on it, not in it; the skitter's feelers stop on it. The
  roller's sole and chin sit on the ground; the toad banks less into its hops (`bank` 0.005).
- Measured (`tests/foe-slope.test.js`, every archetype standing and walking on a 14° slope and standing on flat ground,
  every vertex of every drawn part, Math.random and the clock pinned): 3 cm under at most (the toad's knee 2.1, the
  rootknot's roots 1.8, the hound 1.6; most 0-1); every brute skin's hands and saw over the ground. The hound sinking into
  its shadow pool is its own.

### Eyes on the traveller (v1.85, issue #508, `src/enemies/gaze.js`)

A foe that has noticed you looks at you: chasing, winding up, striking, getting its breath back, a watcher watching you go,
a shy one backing off (`watchingHim`). Idle, wandering or going home, it looks where it is going: the way it moved
(eased), else its heading, a little under level (`GAZE.low`). Stunned, dying or more than `GAZE.far` (45 m) away, it does not.

- **Aimed before the pose, turned after it** (`Foes.look`): `gazeAim` sets `f.gaze.at` (your chest, `GAZE.chest` over your
  feet, or a point `GAZE.ahead` on its way) and `f.gaze.yaw` (from its heading, eased: the headless brute twists its
  torso by `GAZE_TWIST` of it before its legs are solved); after `model.anim`, `gazeApply` moves `model.gaze`'s eyes.
- **An eye** (`gazePart(root, obj, o)`, at the build): `turn` (an eyeball with a pupil, or a head with its eyes fixed on
  it: the toad's eyes in their sockets, the roller's eyeballs on their stalks, the lizard's, hound's, heron's and moth's
  heads), `lean` (the crab's stalks lean to you), `slide` (a spot with no pupil slides over its surface: the blot's
  pupils across their whites, the wisp's eyes on its petals, the brute's brass eye in the boss of its belt, the shade's
  in its hood, the drone's and the cart's in their smoke, the jelly's, ray's, centipede's, root knot's and worm's). A
  group gets an inner group holding its contents, so the group's own pose stays its anim's; a mesh is slid (nothing
  else may move it). Each has a reach (`yaw`, `up`, `down`, rad; a target behind it holds the eye at the edge on its
  side) and eases at `GAZE.rate` (9/s).
- **Cheap, and shared shapes kept**: per eye one inverse of its host's world matrix as last drawn (eyes on one joint
  share it) and a few angles; no new mesh, so no new draw. Only transforms move, never a geometry (the foes of one kind
  and skin draw the same geometries, #468), so the eyes cross the bridge to Unity as world matrices (a skinned eye as
  its bone's, the roller's).
- Not given eyes that follow: the skitters (two tiny dots and their glints in a swarm), the tripod and the bell walker
  (their eyes behind glass or under the bell's lip), the marionette (no eyes).
- `tests/foe-gaze.test.js`: eighteen archetypes look at you within their reach, held at its edge behind them, no
  geometry rewritten; idle, back to their way, leading a sideways drift; noticed again, back on you.

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
| The Keeper (ember, then water) | stamp, sweep | sweep, charge, stamp | burrow (ploughs under the sand at you), spit (3 clods), sweep2, charge | sweep → stamp; in its last phase sweep2 → sweepBack → stamp | stamp, charge |
| The warden (jets: get above it) | beam, mortar, stomp | stomp, sweeping beam, mortar | flare (vents straight up at you over it), beam, 3 mortars | stomp → stomp → slam (wave); flare → slam | - |
| The Elder (wings beside her) | peck, stamp, buffet | buffet, dive, gale | stone feathers (3), peck, gale | peck → peck → buffet; gale → dive | dive (her beak in the floor: her hang aloft + `ROOST.miss`, 1.4 s) |
| The Cloud-Mother (the bell) | gust, dive, wail (wave) | roll, dive, gust | dive, hail (4), roll | roll → tail → wail; hail → dive | dive (on her fins, 4.4 s; in her last phase only a held stone opens her) |
| The Mother Snapper (stilling; since v1.83 the Arena's spar only, `motherSpar()`: in her house she is outwitted, below) | lunge, sweep | snap, seed, snap, sweep | thrash, seed, snap | sweep → sweepBack; snap → snap → lunge; thrash → 3 seeds | - |
| The Lampless (the lantern) | swoop, gust, dust (wave) | flutter, scales (3), swoop | spiral, scales, gust | flutter → flutter → dust (wave); spiral → spiral | swoop, spiral (its wings on the floor, 5.4 s) |
| The Gardener (bloom) | sweep, stamp (wave), clods | sweep, roots, stamp | crush, clods, sweep | sweep → sweepL → stamp | roots, crush |
| The Clockwork Foreman (six numerals in a breath) | jab, chime (wave), hammer | cog, spin, hammer | jab, cogs (3), spin | jab → jab → hammer | spin (dizzy: its face opens) |
| The Tooth-Warden (four vents) | beam, mortar, stomp | grind, beam, stomp | charge, 3 mortars, grind | stomp → stomp → slam; grind → beam | charge (into the wall) |
| The Echo (answer its note) | note (a lobbed note), pulse (wave), ripple | fall, chord (its rings lock into a lens), note | scale (3 notes), ripple, fall | ripple → ripple → pulse; scale → chord | fall |
| The First Sign (its word played back) | cry (wave), beam, static | beam, stutter, static | statics (3), stutter, beam | beam → sweep; stutter → stutter → cry | - |

Wind-ups: every guardian's own move 1.2-2.0 s (1.0 until v1.63, below; the Keeper's burrow 2.0 s, it ploughs at you), links 0.65-0.75 s,
combo finishers 1.1-1.3 s. `tests/telegraphs.test.js` checks the move lists, the phases (each adds a move), a combo
that ends in an opening, an opening in every phase, a combo's timing, the body tells, a phase change and the shock
ring; `tests/temples.test.js` still plays every temple through.

### The first guardian, fair (v1.69, issues #314, #315, #316)

The author's playtest of the Keeper: "super aggressive for a first boss … his hitboxes don't match the movement … lock on
is on all of him vs his head … too few openings, and none in the third phase". Measured by the combat review's new
guardian run (`.claude/skills/combat-review/guardian.mjs`, the fight's own code in node, the real cistern):

- **The breath between blows** (`desert.js` `KEEPER`): pauses 2.4 / 2.0 / 1.8 s (were 1.8 / 1.5 / 1.3), a link's `gap`
  0.5 s and the sweep's link 0.9 s (a combo's blows 1.42 s apart at least, were 0.97), the three-blow sweep only in its
  last phase (`sweep2`; before it, the sweep and its stamp), blows of ½–¾ of a heart (were up to a heart), and every move
  ending open (the stamp 1.6 s, the charge 2.0, the spit 1.8: its mouth open). A still traveller loses 0.5–3.3 hearts a
  minute (was 15–16).
- **An opening in every phase**: in its last phase the dark makes each of its openings a gasp (`KEEPER_DARK.open` 1.8 s,
  a drink then `KEEPER_DARK.water` of a full one) instead of nothing, and a burning ball within `HEARTH_FIRE.near`
  (8.5 m, was 6.5) still makes it pant `HEARTH_FIRE.open` s and drink deep. Dodging every blow: 6.7 / 7.3 / 7.3
  openings a minute (were 7.3 / 8 / 0).
- **Blows on its bones** (`boss.js`: a move's `parts`, `active`, `reach`; the model's `hitParts`): a move with `parts`
  lands where those posed bones meet the traveller (his column, `COLUMN` 1.8 m high, 0.45 m round), over `active` s from
  the strike (`Guardian.live`, `contact`), once. The Keeper's skin (`keeper-creature.js` `hitParts`): `head` (the jaw's
  tip, the head, the neck's top), `feet` (the forefeet, a stamp's splash of 1.1 m), `body` (the shell). Its sweep bows its
  neck to the traveller's height (`KEEPER_POSE.dip`: the jaw at 1.1–1.4 m, was 3 m). The farthest a blow took the floor
  from its body: 1.1 m (were 13.7 for the sweep, 8.9 the charge, 6.1 the stamp). `reach` is how far the blow lands
  from its middle (when it comes for you first, `reachOf`; the perfect dodge's "in its way", `flurry.js`
  `guardianThreat`). A body without `hitParts` (the procedural Keeper, every other guardian) is struck by its shapes as
  before; the Keeper's shapes shrank to its body's reach too. `Guardian.wouldHit(a, p)` is the test both ways (the QC
  calls it). The hitbox overlay draws a guardian's blows (`hitboxes.js` `guardianHitboxes`): its parts' spheres, orange
  winding, red live, then spent; its weak point; the lock's mark.
- **The lock on its weak point** (`foes.js` `GuardianLock.aim`, `aimR`): a body with `lockAt` (the Keeper: its mouth) is
  aimed at there by the gun's locked aim (`fluid-tool.js`, through `lockTarget().aim`), the aiming camera (`main.js`
  `lockAim`) and the reticle (`lock-reticle.js`: a ring round it, not the whole body); the blade still turns to its body.
- **Grounded** (`boss.js` `GroundShadow`): its skin is in the sun's shadow passes, but the cistern is lit by its braziers
  and no sun reaches its floor, so nothing grounded it. A contact shadow of the floor's colour darkened (the temple's
  palette) lies under its body (following its body bone) and under each foot (shrinking as it lifts); `model.shadow`
  sizes it.
- **Its walk and its turns** (`keeper-creature.js` `KEEPER_GAIT`; issue #287): lift 0.55 m, 17 % of the leg (was 0.26; 0.49
  in v1.69), a reach span of 21 % (16 %), 1.13 steps a
  second at 2.2 m/s (0.75), strides of 2 m (2.9), the shell rising and falling 0.17 m (0.08) and rolling 4° over the feet
  that carry it; it turns no faster than `turnRate` (1.5 rad/s, `Guardian.turnTo`; it turned up to 15 when it faced you),
  so its feet step it round on the spot (a foot dragged 0.2 m before). `tests/keeper-fairness.test.js`.

### Every guardian, fair (v1.71, issue #319)

The combat review's guardian run (`.claude/skills/combat-review/guardian.mjs`) over every guardian after the Keeper's:
all thirteen others failed it (blows landing 10–19 m from their bodies, the lock 2.3–7.4 m off their weak points, a
combo's blows 0.92–1.07 s apart, three phases with no opening, four bodies with no shadow), and the Keeper's and the
Elder's skins were found facing away from the fight. Now, for all fourteen (`tests/guardian-fairness.test.js`):

- **Every blow on its body, or drawn where it lands** (`boss.js`): a move has `parts` (its body: the model's
  `hitParts` bones, the Keeper's; else its posed mesh, `Guardian.meshParts`: the drawn vertices up to the traveller's
  height, one sphere a `MESH_PARTS.cell`, near the named part, `splash` m wider), or a `blast` (`Blast`): a **beam** out
  of its eye, dish or mouth (`from`), aimed down through where you stood as its aim held, `r` m round, ending in the
  floor (`sweep` rad: swept across its fan over its window; the warden's eye, the Tooth-Warden's, the First Sign's
  dish), or a **front**: bands of light running out from its body over its own floor in the move's shape (a ring, a fan,
  a lane), `r0` → `r1` m over `active` s, `h` m high (a shock under `HIT.airborne` is jumped: the stomps, the slams), the
  gusts, gales, cries and chords. Each lands only where it is now, once; the hitbox overlay draws it. Only a lob still
  lands on its floor marks. The farthest any hit took floor from what the guardian drew: 0.7–1.5 m (were 10–19).
- **The lock on every weak point** (`foes.js` `GuardianLock.aim`): `model.mouth`, the target its temple takes (a vent,
  the crown hatch, a beak, a face, a heart), for every body, the reticle at least a metre round it.
- **A combo's blows 1.4 s apart at least** (a link's `gap` + its wind-up), every guardian.
- **The warden and the Elder** (the second and third guardians): pauses 2.2 / 1.9 / 1.7 s, every move ending open
  (the mortars and feathers 1.6 s), blows of ½–¾ of a heart. The warden's beam is a ray out of its eye; its stomps a
  shock running out round its feet (from its dais); its flare a column of fire round it. What its vents and hatch
  reveal is unchanged. The Elder's peck brings her beak down at you (`elder-v3-creature.js` `ELDER_POSE`: her body tips
  over her feet, the head carried, so the nape's skin holds); aloft in her last phase she dives instead of pecking from
  3.5 m up; her buffet and gale are fronts of wind.
- **Openings in every phase**: the Mother Snapper's seeds leave her head hanging (1.6 / 2 s: at range she only threw
  them, with no opening, in her last two phases); the Cloud-Mother's last phase, off a held stone, gasps
  (`arzach2.js` `MOTHER_GASP`: 1.6 s, a ring then worth 0.3 of one).
- **Facing the fight**: a fitted skin took the procedural body's turn as a quaternion when it loaded, which past a
  quarter turn reads back as a half turn on x and z; with only the yaw set after, the Keeper and the Elder faced
  π − heading in their halls (and in the Arena), striking behind them. `Guardian.place` sets the whole turn.
- **Grounded and shadowed**: a guardian that swims in the air (the Cloud-Mother, the Lampless, the Echo, the Elder
  aloft) has its contact shadow's patch on the floor under it, smaller the higher it hangs; the lit eyes of the
  sentinels, the Foreman, the Founder and the Anchor-Warden shadow (`userData.castShadow`).
- **The Elder's ink**: her skin was drawn with glass's hairline (0.45) in a shade of her own colour (0.67); now the
  world's weight and black.

The run itself: hitboxes are measured on the hall's floor (a body that hung aloft no longer stays there without a
floor under it in node), its drawn blow counted as what it strikes with, its body sampled as densely as the fight's.

### The first guardian, a second pass (v1.71, issues #320, #321, #331)

The author played the Keeper again after it was made fair: "his feet get tangled … the camera angle is too close …
he clips into the walls … the burrow makes no sense in a closed space … his attack tell looks like a weird triangle
… I need to hit him too many times … Ocarina of Time bosses, 3 phases"; "strafing left and right … I still see the
bug, and the camera moves around too much"; "enemies hitting me shouldn't ragdoll me". Measured in node
(`tests/keeper-second-pass.test.js`, the combat review's `guardian.mjs`) and in the real game (headless Chrome).

- **It faced the other way** (the root of the tangle, of much of the swing and of the strafe "bug"): its skin was
  turned π − heading (`src/temples/guardian-generated.js` swap; fixed by #319's `Guardian.place`, found here too). Its feet were
  planted for the fight's heading under a body turned elsewhere, so every leg crossed every other; locked on and
  strafing, its head swung away from you as it turned to you (its mouth 2.0–2.2 rad off the line to him, median; now
  0.7–1.0), the reticle and the aim with it.
- **Its legs apart** (`src/characters/keeper-creature.js` `KEEPER_GAIT`, `src/motion-kit/gait.js` `clear`): its feet
  set out to the side (`stance`), its knees turned out of the bend's way back onto the next hip (`knees`), a foot
  stepping sooner (`reach`), and no foot landing within `clear` (a fraction of its leg, about 0.7 m) of another (along
  the body on its side, `CLEAR_TRIPOD` of it in the tripods so a group keeps in phase; across it, out to its side) nor
  past the body's middle line, its swing bowed out round the feet it passes (`BOW`), a crowded foot stepping first; a
  charge's dash a bound and its leap off the floor, the feet tucked, landing at their homes; the sweep's body twist
  0.55 → 0.18 rad (`twist`), its neck carrying the swing. Pushed off a wall or post its braced feet may step
  (GuardianLegs `pushed`); turning on the spot its feet step sooner, the middle ones too. The closest two legs' bones
  come: 0.36 m walking, 0.37 turning, 0.48 charging, 0.11 in a minute's fight with the traveller circling it (its
  legs are about 0.14 m thick); before 0.02, 0.08, 0.07 and 0.01, through each other.
- **Inside its cistern** (`boss.js` `keepIn`, `KEEP_IN`; `arena.posts`): a body with `hitParts` is kept in by its shell
  and head spheres as posed, every frame, off the wall and the basin's spout, at once while it walks and at
  `KEEP_IN.speed` m/s in a move (its feet braced); a leap's spot no nearer the wall than it may stand. Its skin reached
  19.4–20.1 m from the middle of a cistern 18 m round; now 18.3 at most for a moment in a move by the wall, 17.9
  charging, 17.1 walking.
- **A leap, not a burrow** (`desert.js` `KEEPER.attacks.leap`, `boss.js` `a.leap`, `a.late`): in its last phase it
  crouches, springs over the last third of its wind-up to where you stood when it sprang (its shadow running ahead),
  lands with its shell (live `late` 0.06 s after, as the shell comes down: `KEEPER_POSE.slam`) and lies winded 3.2 s.
- **No spark** (#320; every enemy's since v2.34, #733): its body's wind-ups are its tells.
- **Three phases of two**: two of the four braziers lit (`KEEPER_LIGHT` 0.2 each), two drinks, two more; an opening
  holds while it drinks, a gulp each `KEEPER_GUARD.gulp` 0.6 s, so one opening may end a phase (its gasp in the dark,
  1.8 s, holds both; a drink there is a full one, `KEEPER_DARK.water` 1). Calming acts 10 → 6 (4 braziers, 2 drinks,
  4 sips), openings to earn 6 → 2 (at most 4).
- **It faces you** (`def.faceYou`, `Guardian.walk(…, face)`): between its moves it steps round sideways at
  `FACE_WALK` of its pace with its head on you (it walked its circle head first, turning its tail to you).
- **The boss framing and the steady lock**: docs/systems/movement-and-camera.md "A guardian's fight". Locked on and
  strafing round it 50 s (the real game): its mouth on the screen 32 → 75 % of the time, the camera's sharpest turn
  4.5 → 2.9 rad/s, its turn's change (p95) 8.8 → 4.6 rad/s², the arm 3.05 → 9.26 m.
- **A blow staggers him** (`player.stagger`): docs/systems/movement.md, every foe and guardian.

### A second verb (v1.63, `phase.asks`; issue #257)

The temple design audit's guardian exam was 3 in six houses: their fights asked for the gadget and nothing else.
Each now asks, in its second phase, for one more verb the traveller has, against one move of its own, before the
gadget takes (`src/temples/boss.js` `asks`, `Guardian.asking`, `Guardian.answer`): until it is answered its openings
don't come (said once, `asks.hint`, also its shift's line) and the gadget's calm or harm is refused (`add`);
answered, it reels open (`asks.open`, a perfect parry `asks.perfect`; `asks.said`), and from then the phase plays as
before, the verb still opening it. A knock-out asks again. The drone's three lines while it asks: `asks.lines`
(`src/temples/hints.js`). The audit reads the verb from the def (`scripts/temple-design/lib.mjs`: `asked`, a fight
mechanic): guardian exam 3 → 4 in all six.

| Guardian (gadget) | Verb | Against | Answered |
|---|---|---|---|
| The Cloud-Mother (the bell) | the guard | her wing roll | jarred, she sinks and cries: ring |
| The Mother Snapper (stilling; the Arena's spar since v1.83) | the push | her snap, as she rears | her head slams down spent: still her mouth |
| The Lampless (the lantern) | a perfect dodge (the flurry) | its flutter | overreached, it hangs low: stand still by it |
| The Gardener (bloom) | a splash (the fluid shot) | its roots, as it crouches | it kneels to drink: bloom its back |
| The Clockwork Foreman (six numerals) | the guard | its hammer | jarred, its face opens |
| The First Sign (its word back) | a perfect dodge (the flurry) | its beam | overreached, it lowers its dish |

`tests/guardian-twists.test.js` ("a second verb") plays each: the gadget refused, no opening of its own, then the verb
answered for real (`tests/guardian-asks.js`: the push or a splash into the wind-up, the guard held or the flurry on as
it lands) and the gadget taking. The temples' walkthroughs (`tests/temples.test.js`) answer it the same way.

A combo's links no longer count as moves of the phase's rotation (`Guardian.begin`, v1.63): a three-move combo in a
list of three moves had locked the rotation on that combo (the First Sign stuttered and cried, never beamed).

### Every glob that sounds like a hit takes (v1.79, issue #373)

The author: "I still can't finish the fight with the mother snapper? She almost never opens its mouth? And when it
does even if I aim properly sometimes I hear the success sound but the health bar doesn't change". Played with real
globs and the real push cone (`tests/mother-snapper-fight.test.js`), three causes:

- **Her second phase never opened from the middle of her hall.** It asks for the push as she rears to snap, but she
  reared over her own leaves, her head 9 m and more from a traveller 12 m off, and the push reaches 6 m: from 12 m
  and 16 m, 0 openings in 280 s. Now her head looms out over you as she rears (`SNAP_LOOM` in guardians.js: 4.5 m short
  of you, up to her neck's reach) and snaps down there, short of you; her second snap (`snap2`, reared the same)
  answers the push too, and the snap comes every other move (`snap, seed, snap, sweep`).
- **A glob in the jaws she gapes as she winds up stopped the strike, and she shook it off**: a player who shot at the
  open mouth he saw never had her open (0 openings in 300 s). Now, in her first phase, stilled mid-strike her head drops
  spent and agape (`MOTHER_STILLED`, 2.8 s): still her mouth then.
- **The success sound was the splash's, played for any target.** A stilling glob on any target played the bright notes
  of a hit (`fluidSplash(true)`), and most of hers took nothing (a glob on her leaves, into her mouth in her last phase,
  mid-strike while her phase still asked for the push), and the first two crystals chimed with the bar standing still.
  Now a target may say a hit took nothing (`info.dull`, `src/targets.js` `hitTarget`): `Guardian.landed` says so when
  the hit changed nothing (no calm or damage, no opening, no strike stopped, no verb answered), the Mother's `onHit` and
  her crystals say so where it only stopped her, and the tool's splash then sounds as on a wall. Each crystal in turn
  takes its third, and a flat note takes the turn's calm back.

Measured (a scripted traveller, 60 fps, standing 5 / 12 / 16 m off her): before, a player shooting only her open mouth
won from 5 m (and 8 m), never from 12 or 16 m (stuck in phase two); a player who also shot her gaping jaws never won
(0 openings, 70 to 85 globs landing bright and taking nothing). After, both win from every stance at 60 and 30 fps in
29 to 64 s, opening 6 to 17 times a minute in each phase, and no glob lands bright or chimes without moving her bar.

### Every fight can be won from anywhere in the hall (v1.77, issue #361)

The author: "after a while the mother snapper is just throwing fireballs so I can no longer shoot its mouth". A rooted
guardian with you past a move's reach throws something that reaches instead (`Guardian.begin`); from past her snap's
7 m the Mother Snapper's second phase turned every snap into a seed, and the push into a snap it asks for never came:
seeds for ever. Now the move a phase asks for is never swapped while it asks: she rears to snap at the air, it misses,
and the push still answers it. Two more found the same way: the Foreman came for its asked guard only to 4 m (the
hammer's `reach` 4.5) and its arms landed 3.7 m out (now 3.8, landing on a guard held against the wall), and at 30
frames a second the hammer came down past a traveller 7 cm off him in one frame and through him in none. A body blow's
spheres were made wider by half of what its striking part moved as it was posed (`Guardian.sweepOf`), so a blow
landed over the way its part swept between two frames. (That widening went all round each sphere, at 60 frames too,
and was replaced in v1.87: "Kept on the body", below.)

### Kept on the body (v1.87, issue #558)

The v1.87 combat review found five guardians' blows landing 1.6–2.7 m past their bodies again (the Gardener's sweeps
and crush, the Listener's sweeps and slam, the Foreman's hammers, jabs and spin, the Tooth-Warden's charge, the Last
Founder's ladles and slam), with nothing in the suite to see it. The cause was the v1.77 widening above: half the
striking part's travel a frame, up to 1.6 m at a sweep's strike, added to every sphere's radius in every direction,
beside and behind the arm as well as along its way. Now:

- **The sweep is sampled, not widened** (`boss.js` `sweepOf`, `sweptFrom`, `partsOf`, `SWEEP`): a frame longer than a
  60th of a second adds each sphere again at each 60th of the way from where it was last frame (carried back by how
  far its middle went and by its nearest striking part's own way, in full at the part and none `MESH_PARTS.near` of
  its radius off: a shoulder stays put as the fist swings). At 60 frames a blow is its posed body alone; at 30 it lands
  as at 60. `partsOf` is worked out once a pose.
- **The Foreman's hammers** (`garage.js`, `splash` 0.4 → 0.6): they come down at head height either side of a
  traveller in front of it, and without the widening they only grazed him past 2.8 m at 30 frames; now they reach
  him to the move's `reach`, 3.8 m, at 30 and at 60.
- **The measure is a test** (`scripts/combat-review/reach.mjs`, shared by the skill's `guardian.mjs` and
  `tests/guardian-reach.test.js`): every guardian in its own temple, each move at its strike at 60 frames, over 15 % of
  a hit more than 1 m from its body, or any more than 1.5 m, fails. The body counts as touching a traveller across his
  column's footprint, 0.45 m every way (it was -0.45 and +0.05 m on each axis, so the same blow measured up to 0.4 m
  further facing one way than another: the Lampless's spiral passed or failed with where it ended its last move).

Farthest hit from the body, worst move, the measure as it is now: the Gardener 2.5 → 1.1 m, the Listener 1.9 → 1.1, the
Foreman 1.7 → 1.3, the Tooth-Warden 1.7 → 0.9, the Last Founder 1.8 → 1.1; every other guardian unchanged, all ≤ 1.2.
At 30 frames the Listener's sweeps measure 1.9 m: the run samples its body only at the frames, and its arms go 3.4 m
in the strike's first 30th of a second, the half-way spheres between them.

`tests/guardian-completable.test.js` fights every temple's guardian, and every Arena sparring one, through to weary
from three stances (close by, half way across the hall, at its far side) at 60 and at 30 frames a second, a traveller
who only stands and answers what the fight offers (the asked verb as the asked move comes, each opening taken for half
a phase); every phase must give him a way in within 45 s. All 14 temples and 14 sparring rings pass.

### Helping instead of fighting (issue #339)

Two guardians can also be helped instead of fought, each in a minigame of its own (docs/systems/minigames.md,
"The Elder's flight" and "Cistern channels"; the design and the other guardians' pitches: docs/design/helper-guardians.md).
The shipped fights are as they were. (The first prototypes, v1.76, played on the guardians in their arenas behind
`?guardianHelp=`, were taken out in v1.79.)

### The guardians’ last phases (v1.15, v1.16, v1.19, v1.24)

In the temples reworked round one idea (docs/audits/temple-design-v1.12.md, v1.16, v1.19), the guardian's last phase asks
for that idea, not only the gadget. Each is taught a phase earlier, where it works beside the old way; failing costs
time, never the meter; the old verbs still do what they did (a stilling glob still stops a strike). Nothing new is
drawn on the floor: the tells are the body's, and the pieces stand in the arena from the start.

| Guardian (temple's idea) | In the arena | Taught (phase 2) | Asked (phase 3) | Failure |
|---|---|---|---|---|
| The Cloud-Mother (a bell holds things only while it rings) | four stones that fell up, under the dome (`HallStones`, arzach2.js) | a ring during a dive's wind-up (the `over` move: she rises to hang over the spot) brings the nearest stone down onto the spot, following it till she strikes; she dives onto it and lies there crying (`GROUNDED` 4.5 s): the bell calms her | her own crying no longer opens her (`def.openFor` → 0); only the stone does | a ring between her moves brings nothing; the stone falls up again when the note fades (`HOLD.stones`) |
| The Lampless (light can be carried) | three dark pools (`LurePools`, perdide2.js) | a pool lit by a splash, or by your lantern held by it 1.2 s, lures it as it searches: it drifts there (8 m/s, its opening held while it goes) and drinks the pool dark | it shies from you: standing still by it does nothing; it drinks only at a pool, and only while you stand 5 m back (`LURE`) | by the lit pool, it hangs over it and waits |
| The Mother Snapper (hush, then sing low to high; v1.83, issue #409: outwitted, never fought, `docs/systems/temples.md` "The Hush-House with no fight at all") | three crystal pendulums over her, jangling out of tune, and a fourth crystal at her root (`Swing`, `RootNote`, perdide.js); blind, she strikes only at sounds (`Guardian.listen`) | her first phase: each pendulum stilled hangs frosted and silent, and calms her | her second: the four notes splashed low to high; her head covers the first, at her root, till a sound elsewhere turns it | out of turn a note rings flat, the notes fade, and she strikes at it |
| The First Sign (a note travels) | two low dishes on the wall, east and west, their twins high over them, a cable to its foot (`SIGN_DISHES`, bazaar.js; a `Dish` relays `via` its id) | a word played into a low dish reaches it from anywhere in the hall | its dish turns up as it listens (the model's `phase`): it hears only what the dishes carry | its word played to its face: nothing; the wrong word through a dish: refused as before |
| The Clockwork Foreman (count round from where the hand points; every clock stopped at four) | its face's six numerals (lamp i at 2i o'clock as you face it) and a ring on each (`steps`) | open, its hands come round to four; numerals hit round from four (`FROM_FOUR`, garage.js) ring and light, any order still counts | only in step takes, six inside one breath (`VOLLEY`) | out of step they all go dark; faded past a breath, begin again |
| The Gardener (v1.16; nothing grows in the shade) | the dome's louvre and its sunbeam on one quarter at a time, a footstone before each dead bed that turns it to that quarter (`rt.gardenSun`, a `Sunbeam` with `pick`, edena.js) | in the sun a bloom on its back counts double (`SUN.sun`), in the shade as before; it kneels a little longer (`SUN.open`, `def.openFor`) | in the shade nothing grows on it: stand on the footstone of the quarter it kneels in, let the sun settle on it, then bloom its back | in the shade the flowers fold and drop off it, and it says so |
| The Elder (v1.16; one wind, out wherever no stone stops it) | two vents in the roost's floor and one stone in a groove between them: in one vent, the wind rises from the other (`rt.roostWinds`, `ROOST`, arzach.js) | aloft, she drifts over the nearer vent; flown with in its wind she takes heart twice as fast (`ROOST.wind`), on still air as before | on still air she does not follow: the wind has to rise by her (the stone pushed into the other vent), and you ride it up beside her | beside her on still air she watches you sink, and it says to bring the wind |
| The warden (v1.19; the tower breathes through its vanes) | four great vanes in the hall's floor between the columns (`rt.hallVanes`, `HALL`, incal.js), turned only by the jets' wash (`Vane` `great`) | its hatch open, it backs onto the nearest vane (`HALL.back`); a hit in the crown over a turning vane counts twice (`HALL.washed`), in still air as before; the hatch stays up longer (`HALL.open`, `def.openFor`) | in still air the hatch slams: hover over the vane it stands by (aim: the jets hold you), level with its crown, and the draught lifts the hatch | its hatch slams as the shot comes, and it says the air is still |
| The Tooth-Warden (v1.19; a ball in the teeth stops the engine there) | the hall's great gear in the floor (a `Gear`, buried.js), turning with it from its second phase, and a ball in a groove from the west wall into its teeth (`bG` on `pG`) | free, a volley counts as before (`GEAR.free`); jammed, twice (`GEAR.jammed`); shifting into its last phase it stamps the ball out of the teeth | free, it opens turning, one vent facing out at a time (`model.only`, each `GEAR.turn` s), so four in a breath can't be had: roll the ball back into the teeth and all four face out (it stays open a little longer, `def.openFor`) | the turned-away vents take nothing, and it says to jam the gear |
| The Keeper (v1.24; the Givers carried their fire) | four spokes, a tar ball in each groove from behind a rim brazier in to the basin's edge (`rt.spokes`, `HEARTH_FIRE`, desert.js): rolled in past the lit brazier, a ball catches | a burning ball at rest within 8.5 m makes it pant at once (`HEARTH_FIRE.open`, once a lighting), beside its own panting | in the dark its own openings are a gasp (`KEEPER_DARK`, v1.69: 1.8 s at most, a drink then half a one; until v1.69 none at all); by a fire rolled to it, it pants long and drinks deep | a cold ball by it (its brazier unlit) is nothing; it heaves, mouth shut, and says it wants a fire by it |
| The Echo (v1.24; the lens shows where the walker set things down) | the three resonant spheres, each with the walker's print on its face toward the middle that only the lens shows | the sphere that answers glows and wears the print | it sings three notes at once: all three glow (`rt.singAll`), only the print tells the one that answers | a glowing sphere without the print is the wrong note: it flinches |

`tests/guardian-twists.test.js` plays each in its arena with a real Player: the failure, then the way through, and
the phase that teaches it; `tests/temples.test.js` plays them as part of each temple.

## Feel (`src/feel.js`)

- **Hit-stop (frame freeze):** `hitStop(s)` freezes the world (`FEEL.slow` 0: main.js `feelDt` passes a
  1e-5 s step, never zero): 0.06 s on a cut (3-4 frames), 0.11 s on the heavy third swing, the whirl and the lunge,
  0.15 s on a full charged cut or a riposte, 0.07 s on a block, 0.14 s on a perfect parry.
- **The hit burst** (v2.31, issue #713, `src/hit-burst.js` `HitBursts`, `HIT_BURST`; `FluidTool.bursts`): the author: "in
  BotW when a hit lands there is a hit effect which makes it very clear that the hit connected". What Breath of the Wild
  layers on a landed hit: a few frames' freeze, a bright star of light at the contact drawn over everything, the foe
  flashing, a slash streak and a shake on its heavy blows, a sharp crack of a sound. Hiraeth had all but the star (the
  hit-stop above, `Foes.react`'s ink flash and flinch, the blade's splash and ripple, the kick, `fluidSlashHit`); the burst
  is its star, inked: amber and orange rays round a tiny cream four-pointed core, each ray cut out of a dark plum one a little bigger, flat and
  turned to the camera, at every contact a landed blade cut makes (up to three a swing; not on armour, a block, a miss or
  a dull guardian). Heavy blows (the combo's third, the charged cut, the riposte, the dash and air cuts) get 25 needles
  against 18, with a longer directional fan, and a long inked streak along the blade's way as seen. It lives on the traveller's
  clock (`selfDt`), so the hit-stop holds its first, biggest frame through the freeze; then it bursts out and is gone
  (0.14 s light, 0.22 s heavy). It is drawn at `toward` (0.45) of the way to the camera, shrunk to the same size on the
  screen, so neither the foe's body nor the traveller in front of the camera hides it, with no depth trick the
  engines would have to mirror. One InstancedMesh (`makeMaterial`, flat): one draw for all of them, mirrored to the
  engines like the rings (checked in Unity's batch run: `scripts/unity-js-run.sh … -level arena -fight combo`, a toad
  kept up and the three blows pressed, a picture every few frames). Tests: `tests/hit-burst.test.js`.
  The approved Amber Impact reference is `references/combat/amber/approved-a.png` (concept, not a game capture).
  Rays are biased along the cut, alternate warm gold and orange, and separate into flecks as they clear. The cream
  core disappears halfway through. The star and body lift stay below the bloom threshold; `REACT.flash` keeps the
  foe's painted colours and original ink instead of turning its silhouette white. The blade wake uses turquoise
  and pale mint bands. Attack timing, damage, hit-stop and miss/armour handling are unchanged. The visual lifetime is longer to
  separate the short central flash from the slower fleck tail. The bounded budget is 432 instances in one draw.
  The fan has unequal shoulders around its leading needle, fine tapered tips and a small hot center; flecks
  move quickly outward and decelerate as they disappear.

  Research informing this pass (27 October 2026):
  [Riot’s clarity principles](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/) call for readable
  silhouettes, limited visual noise and effect prominence proportional to gameplay importance.
  [Beyond-FX’s Zelda-inspired breakdown](https://blog.beyond-fx.com/articles/level-up-episode-2-explosion-effects-tutorial)
  separates flare, streaks and secondary particles; it is an explosion tutorial, not documentation of Nintendo’s
  sword-hit implementation. [Mathis Desage’s impact breakdown](https://mathis_desage16.artstation.com/projects/dyVvmQ)
  likewise separates flare from velocity-aligned particles. Hiraeth adapts that layering to a small sword contact:
  cream flash, amber needle fan, detached flecks. Smoke, rocks and shock rings from explosion examples are not
  appropriate here. [Thomas Vasseur’s Dead Cells breakdown](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-) emphasizes attack poses and timing before VFX;
  [VFX Apprentice’s timing guide](https://www.vfxapprentice.com/blog/the-soul-of-effects-what-is-timing-in-vfx)
  treats contact as an instant intensity spike with a quieter follow-through. These sources guide timing and
  hierarchy; the approved A concept remains the art target.

- **Camera kick:** `kick(k)` jolts the camera after the rig places it (`shakeCamera`), settling over
  `FEEL.settle`; a foe's hit kicks harder (main.js `onHurt`).
- **The finishing blow** (v0.96, `Foes.burst`; since v1.35 at the blow, `Foes.defeat`, the burst after its defeat): 0.09 s and a bigger kick; the last foe of a fight (none other
  stirring within 28 m) 0.12 s, then `slowMo(0.45, 0.35)`: the world at 35% for 0.45 s, easing back over its last
  third (`feelDt`, after any hit-stop).
- **Knockback:** the heavy third swing throws a foe 2.2× as far.
- **Turns:** `TURNS.strikers` (2) may wind up at once (`env.mayStrike`); the others circle at a step past
  their reach (`Foe.circle`). One off the screen (`Foes.onScreen`) waits while any other strikes (v0.96), so a
  blow from behind never lands on top of one you are watching. `keepApart()` pushes foes standing inside each other apart.
- **Warnings:** a foe winding up off the screen (or behind the camera) shows a round marker at the screen's
  edge on its side, filling as its strike comes (`#foe-warn`, `Foes.warnings`).

## The body the blade meets, the soft aim (v1.35: `src/foe-body.js`, `src/fluid-blade.js` `AIM`, `bodyHits`)

The author's playtest: "sometimes when I attack it doesn't hit the enemy; I think my sword is going above their head".
Measured (`scripts/combat-reach.mjs`: the game's traveller with the real clips and blade swinging at each archetype's
real model, posed by `Foes.look`, from 1–2.5 m off its body at 0 and ±40° off his facing, locked on or not): the first
swing missed 72 of 504 times; every miss was a low body the level arc went over (the skitter every time, the lizard and
the blot from 2 m) or the cut's pull still short of a foe 2–2.5 m off as the blade came through (the crab, the centipede,
the moth). And 197 hits landed with the drawn blade nowhere near the drawn body: the old target was one sphere at the top
of each body (`hurtRadius`), which hung between a heron's stilts and far over a lizard's back.

- **The drawn body** (`bodyParts`, `bodyTouch`): an archetype's target says its model (`target.body()`), and the swept
  blade (each frame's segment from the last, in steps of 10 cm) is tested against the boxes of its drawn parts, each in
  the frame of the joint that moves it as the kit poses it (a skinned mesh: each joint's own box, `kit.js skinned`
  `userData.boneBoxes`), grown by `BLADE_TOUCH`. Not the body: smoke, mist, a halo, threads, a harpoon's line, a ripple
  on the sand (`NON_BODY`, by the part's material name), anything hidden (a cracked crab's dome), parts under 5 cm. The
  contact point is where the blade entered a part: the splash and the blade's ripple start there. Everything else
  (wildlife, scenery, the old kinds) keeps its sphere; the shots and the lock still use the sphere. The rising cut (a
  foe hovering over you) still cuts the leap's cone.
- **The pull arrives** (`closeInTime`, `MAGNET.arrive` 0.3): a swing begun a little out of reach steps you in through its
  wind-up and the first 30 % of its cut, then stops (it was the whole cut, so the blade passed before you were there), to
  stand `MAGNET.ideal` (1.05 m, was 1.2) off the body's front at the swing's height (`target.reach`, `bodyReach`: a
  heron's stilts are near its middle, a crab's shell is wide; never further than its sphere said).
- **The soft aim** (`AIM`, `aimTilt`, `Humanoid.swingTilt`): a swing at a foe (the lock, else the one it turns to, as
  before) tilts its plane toward the body: the blade crosses in front of him at about 1.2 m (1.1 for the overhead
  third: `AIM.natural`, measured from the clips), and when the body's middle part is lower or higher the plane tips
  down (up to 0.62 rad) or up (0.4), aimed from where the pull will have him. The back takes 45 % of it (spine_02,
  spine_03), the right shoulder the rest, eased in over the wind-up, held through the cut, out over the follow-through;
  the clip still drives the swing, the hits read the hand's bone as drawn. It never turns him: the swing's way is
  as before. Not for the air cut or the rising cut.
- **The table, after:** 1 miss of 504 first swings (a heron's thin stilts at 2.5 m), none of the 168 second and third;
  the 59 hits left with the blade off the drawn body are the rising cut's cone (the ray, the jelly, the drone, the
  marionette over you). `node scripts/combat-reach.mjs [kinds…] [--legacy] [--json]` prints it (`--legacy`: as before).
- Tests: `tests/combat-reach.test.js` (the boxes, the tilt's limits, the pull's timing, and every archetype hit by a
  plain first swing from in front at 1.5 m; the skitter missed with `legacy`).

## Hit and defeat (v1.35: `src/foe-react.js`, `src/enemies/defeat.js`)

The author: "it's not always obvious that an enemy was hit; all enemies should have a defeat animation".

- **"I've been hit"** (`FoeReact`, `Foes.react`): any blow that tells (the blade, a shot, an ember, the world) shoves the
  body along it and tips it away on springs (`SecondOrder`), and squashes it; on an archetype with legs it goes on the
  kit's `body` before the rig solves the legs (its `write` is wrapped: `Foes.beforeLegs`), so the feet stay planted.
  `REACT`: a flinch 0.14 m / 0.2 rad (3.4 Hz, ζ 0.38); a stagger (a blow of 2 or more, the riposte, the charged cut, the
  killing blow) 0.3 m / 0.42 rad, slower, leaning while it reels; a cut it shrugs off (armour, a committed blow) a little;
  smaller bodies move more (`size^0.35`). Each frame the body is put back as its own pose left it before it poses again
  (`restoreBody`), so nothing accumulates. The old kinds keep their recoil.
- **Thrown back off the guard** (issue #672, `docs/design/combat-botw-study.md`): a blow the traveller guards reels the
  attacker's body too (`Foes.strike` → `react(f, 'guard', …, { reel, flash })`): a perfect parry a stagger held while it
  is open (and the flash), a plain block a flinch without the flash (it took no harm). Before, an archetype only slid
  back: its body never moved (the old recoil is off for archetypes). `tests/guard-reel.test.js`.
- **The flash** (`installFlash`): for `REACT.flash.time` (0.18 s) each of its meshes, as it is drawn (not in the shadow
  pass: the scene's override material), takes its family's pale tone (`REACT.tone`), is self-lit over the bloom's
  threshold (`uGlow`: a printed halo) and, for its first 0.08 s, has its line drawn white (`uLineWhite`; the shade's,
  already white, goes black): the material flags the post pass already reads, no pass touched. Installed on a model's
  first hit (`onBeforeRender` / `onAfterRender` put each material back); nothing while it is not flashing.
- **The splash** where the blade met it (the contact point): its own tones and a pale fleck off a creature, sparks off a
  machine, black ink off a spirit (`splashTones`). Hit-stop as before (0.06 s a light cut, 0.11 s heavy, 0.15 s the full
  charged cut or the riposte), the family's hurt sound as before. An armoured glance (a crab's shell, the bell's bronze, a
  rolling shell) keeps its own sparks and thunk, no flash, no flinch; a stagger stays the mind's (`Foe.reel`).
- **The defeats** (`DEFEATS`, `Foes.defeat`): the killing blow's feel at once (the freeze, the kick, the last foe's slow
  motion), its mind done (state `dead`: no target, no lock, no blow, `keepApart` passes it by), then its body plan goes
  down its own way over 0.8–1.5 s, the model's own pose with the recipe's moves on top (`defeatPose`, `Foes.falling`),
  and the burst as before at the end (the ink, the tank's charge, the chimes, a machine's pieces). **Nothing ends on its
  side** (v2.37, issue #767, the author: "No enemy should fall on their side when they die. Die animation should make
  sense for the character"): one death a body (`DEATHS`), no recipe flips or rolls. Beasts on legs fold them and slump onto
  their bellies, the head down: the crab (its claws laid forward on the sand, `plans/walker.js`; the killing blow's own
  flip, `fight.down`, not played: one already on its back stays there), the skitters (legs curled under), the lizard and
  the hound (legs splayed), the toad (its bellows empty, flat), the heron (off its stilts onto its belly, its neck down;
  a toppled one comes back level, `plans/stilt.js`). The centipede's plates sink flat one after another from the head
  (its own, in its pose). The roller settles on its shell; the root knot wilts forward and sinks; the worm goes back under
  the sand. Flyers drop spiralling and land flat (the jelly deflates, the moth folds its wings, the ray, the drone, the
  wisp, the oracle settling on its shell and tipping forward). Machines power down: the tripod and the bell walker buckle
  on their legs (the kit re-solves them under the sinking body) and tip forward, venting; the cart settles on its tracks,
  its crucible forward; the brute drops to its knees and falls on its face; the crawler's legs go limp and its dome comes
  down flat. Spirits slump and empty: the blot into a puddle, the shade's cloak into a heap on its boots, the mummer's sack,
  the marionette's strings snapping and the puppet folding where it lands. Humanoids ragdoll (below); past the cap they
  sink to their knees and go over the way the blow pushed them (`topple.blow`: back when struck from in front, forward from
  behind; `startDefeat`'s `fall`). A kit walker's body comes level across as its legs go limp (`Rig.update`, over 0.25 s:
  its planted feet, left behind as the blow shoved it, tipped a skitter 28°). `tests/foe-deaths.test.js`: every archetype
  has its death; no root tipped more than 25° onto a side going down, nor its body once the blow's own flinch is past; a
  humanoid past the cap falls the way it was struck; a ragdoll lies within 50° of its front or its back.
  Its eyes go out over the first half; dust where it lands, a machine's steam, a spirit's ink. **Then the smoke** (v1.39,
  `src/smoke-puff.js`): it lies `SMOKE.linger` (1 s) after its defeat, then shrinks away over `fade` (0.35 s) inside a small
  puff of ink-outlined pastel blobs (cream, lavender, a pale teal, a blush, and a pale tone of its own) that swell, rise and
  thin out, and it is removed (its model out of the scene). One instanced mesh for every puff (`SMOKE.max` 96 blobs, the
  oldest reused), one draw call. The guardians don't: they are calmed or broken, not killed, and stay in their temple after
  their final moment (a touch, the break). A foe that went out
  of the world, the roller's own last-roll shatter and the old kinds burst at once; the guardians keep their finishers.
- **On the ground, never through it** (issue #304; `groundStart`, `groundDefeat`, `defeatHull`, `belowGround`,
  `GROUNDED` in `src/enemies/defeat.js`). A roll, a topple or a flip turns the body about its feet and a flyer comes
  down to its footing: left alone, a body rolled onto its side was half under the ground (the crab on its back 1.7 m,
  the heron 1.5 m, the brute 1.6 m, the toad 1.2 m; the jelly's threads 2.9 m). At the blow (`Foes.defeat`) the ground
  under it is read as a plane (five `groundAt` round its feet, the slope kept to 45°) and its hull is gathered: each drawn
  part's outermost vertices along the 98 directions of a 5³ grid (26 for a part under 12 cm; a skinned part's for each
  bone that moves most of it, skinned each frame; worked out once a geometry, a dense one read every few points), with
  how far under the ground it already stood (`D.allow`: a hem, a fist on the sand, a body square on a slope). Each frame
  of the defeat (`Foes.falling`, after `defeatRoot` and the plan's own letting go) the hull's lowest point is found
  (parts whose bounding spheres cannot reach deeper skipped; a rigid part of up to 4000 points whose hull comes within 5 cm of the deepest is read whole, `REFINE`: the 98 directions alone missed a round part's lowest point by 2-3 cm on a slope, the brute's saw, the crab's shell) and the body lifted onto the ground by what is under it,
  less the recipe's own `sink` and less `D.allow` easing out over `GROUNDED.ease` (the first 30 %): it rolls over on the
  ground, no pop. The mound worm (a burrower) is left to dive back under its sand. Parts that rest on the ground
  themselves are marked `userData.noGround`: the jelly's threads and lanterns (verlet chains, put back on the ground
  while it goes down: `plans/floater.js`). The crab's arms drop limp to its sides as it goes (`plans/walker.js`), so on
  its back its pincers stick up with its legs instead of propping it; a ray or a moth's bank comes out as it touches
  down (`defeatPose`, `plans/glider.js`): it lands flat, not on a wing's tip. Cost: building the hull 0.1–5 ms at the
  blow (in its hit-stop), then about 0.1 ms a falling foe a frame in node (16 falling at once: 2.2 ms against 0.4).
  `tests/foe-hit-defeat.test.js` holds every archetype's defeat (but the worm's) to 3 cm under the ground at most, every
  vertex of every drawn part, on flat ground and on a 14° slope, with Math.random seeded and a clock run by the frames (`pinned`: unseeded, the slope's worst read 2.0-3.2 cm from run to run and failed pushes at random).
- **Cost** (the Arena, High, headless Chrome on the M4 Pro): `Foes.update` for twelve foes standing 0.5 ms a frame, 0.7
  while they flinch, 0.8 while all twelve go down at once; the blade's body test 0.1 ms on a cut frame against a crab (the
  sphere's under the timer's 0.1 ms); the pack bench (`scripts/enemy-roster/bench.mjs`) the same draw calls, CPU within
  the shared machine's noise.
- Tests: `tests/foe-hit-defeat.test.js` (the springs, the shove put back, the flash's flags given back and never in the
  shadow pass, every archetype flinching on its body with its family's splash and staggering under a heavy blow, the
  glance's own look; every archetype's defeat 0.8–1.5 s, harmless, its body moving, the burst and chimes only at the end;
  sixteen at once).

### Ragdolls (v2.35, issue #750, `src/enemies/foe-ragdoll.js`)

The author: "enemies should ragdoll on being defeated, not fall on their side". A humanoid on the clip rig (the grunt, the
hulk, the prowler, the warlord, the sentinel, the fencer, the mummers and their king) struck down goes limp instead of
playing its recipe (`Foes.letGo`): the people's ragdoll (src/ragdoll.js: fifteen joint particles, the trunk rigid, knees
that bend only forward, thighs that don't swing far back, elbows and knees that never fold flat, the head kept over the
neck, each particle landing on the ground under it and its slope) is started from the rig's pose as it was struck
(`rigPoints`, the trunk's rest shape from the rig's own proportions), thrown along the blow (`toppleVelocities`:
`RAGDOLL.carry` of its shove, at most `shove` 3.5 m/s, the top tipping over `tip` m/s faster, × `heavy` for a heavy blow, a
`punch` at the joint nearest where it was struck, a twist from the foes' rng) and laid back on the rig each frame
(`applyFoeRagdoll`: the body's frame onto the hips, pelvis and chest, the head over the neck, each limb aimed joint to joint,
the feet slack), blended in from the struck pose over `blend` 0.12 s. Its particles are as thick as it is drawn
(`bodyShape`: the trunk from the torso's own drawn box, its belly half counted, a big head's sphere over its horns and
snout, clawed hands), its hanging parts (hems, kilts, a horn on its back, the face its gaze turned) go back to rest on the
body, a tail is laid back over the ground (`TailSpring.keepUp`), and what it held flies as a piece of its own
(`Foes.looseGrips`, "Pieces and plates" below). The drawn hull still keeps it on the ground (`groundDefeat`, as every
defeat: 4-14 cm for the roster's hems and big heads), held once it lies still.

**It comes to rest** (v2.37, issue #765, the author: "Enemies ragdoll and the slide on the ground?"). Measured over the
eight humanoids, four blows each on the flat, a 14° and a 24° slope (96 falls, node): before, it slid 2.3 m on average
once lying (15 m at worst, a warlord thrown at 47 m/s by a constraint fighting the ground), 57 of 96 still moving at their
puff, the whole body lifted 12.6 cm on average over the ground (40 at worst), and as it shrank in its puff it slid back to
where it was struck (0.8-1.8 m on the flat). After: 0.07 m on average (0.5 at worst), 6 of 96 still settling, lifted 4.4
cm (20 at worst), shrinking where it lies (0.26 m at most, its pelvis's own drop). What changed:
- **Friction** (`Ragdoll.friction`, opt-in, the people's keep 0): on each solver pass while a particle touches, its slide
  along the ground that sub-step is held back by μ (`RAGDOLL.mu` 0.9: it lies still on a slope to 42°) of all the ground
  has pushed it out that sub-step, so the links' and limits' pulls of a later pass are held too; not a push, so its speed
  loses it as well. The people's velocity friction alone held only the particles touching, while the rest of the body's
  weight dragged them on.
- **No throw across the arena**: no particle faster than `RAGDOLL.maxSpeed` 18 m/s (`Ragdoll.maxSpeed`); the head's limit
  (`Ragdoll.headUp`, the people's 0.55) set from how the head is drawn over its neck (the warlord's maned head sits behind
  and below its neck joint, and the people's limit threw it back up every step).
- **Asleep once its trunk is still** (pelvis, chest, head, hips, shoulders within `stillMove` 3.5 cm for `stillFor` 0.4 s):
  a knee caught between its limit and the ground trembles in place and kept the people's speed test awake.
- **Shaped as it is drawn** (`bodyShape`): each limb's particle as thick as its segment is drawn (thigh, shin, foot, upper
  arm, forearm, hand), the trunk up to 3.6 a person's (the mummer king's belly), the head's particle at the middle of
  its drawn box, as big as most of it (measured as it rests on its neck), the head turned onto it along that line.
- **Laid on the ground** (`LAY`, `layParts`): while it moves, its feet (slack, or turned flat or back), its head (turned on
  its neck, a cheek to the ground), its hands at the wrist, its fingers and what hangs off it (a hem, a horn strapped to
  its back) each tried in a few turns against the ground's plane under its pelvis (three reads a frame), the first that
  keeps its drawn box out of the ground kept. A shield on its arm is let go with its weapon (`Foes.looseGrips`).
- **On its back or its front** (`ROLL`, `rollFlat`, issue #767): down on its side (its hips' line tipped over 22°), it turns
  about its spine at up to 1 rad/s toward level, its upper hip and shoulder pushed over, for at most 0.9 s; 40 blows on the
  flat end within 22° but one (40°).
- **Shrinks where it lies** (`anchorRagdoll`, at its puff): the model's origin moved to the ground under its pelvis, every
  part kept where it is drawn, and the body laid at its scale now (`applyFoeRagdoll`), so it shrinks about its pelvis.

- **Steps**: time is gathered into steps of at least `minStep` (1/120 s; a hit-stop's sliver of a frame divided the
  constraints' pushes into thousands of m/s and threw a warlord 300 m up) and at most a 30th; lying with three joints or
  more down, what is left of its slide dies at `drag` 3.5/s; asleep (no reads, its pose held) once still `RAG.stillFor` +
  `sleepAfter` s or after `maxSecs` 3.2 s; it keeps settling through the second it lies before its puff (`SMOKE.linger`).
- **Cap**: at most `RAGDOLL.most` (4) stepping at once; any more, a spirit (the shade, `ragdoll: false`: its cloak falls empty), a
  floater (the oracle) or a burrower go down the old way.
- **The kit's walkers** (the crawler, the lamp tripod, the skitter and the rest): their recipe sags or tips the body
  (since #767 none rolls or flips it) and their legs go limp (`Rig.goLimp`, src/motion-kit/limp.js: each foot a point under gravity, sliding to a stop on
  the ground, held within its leg's reach of its hip; the IK bends the leg between), the recipe's curl left out.
- Cost (node, this Mac at load ~25): a ragdoll's step 0.03-0.05 ms, laying it on the rig 0.01-0.08 ms, the hull's ground
  check while it moves 0.6-0.8 ms (held once it lies); four ragdolls and three recipes going down 2.4-2.9 ms a frame.
  The ground for it is Foes' own height read (`groundPhysics`: one read a particle, two more for the slope near the ground);
  the world's walls are left out (`WALLS.on`).
- Tests: tests/foe-ragdoll.test.js (thrown along the blow, limits, asleep, the rig on its particles; the same blow the same
  fall; every humanoid on flat ground and a slope, its drawn parts 3 cm under at most; the cap and the cost; the crawler's
  limp feet), tests/foe-hit-defeat.test.js as before.

### Pieces and plates (v2.35, issues #753 and #754, `src/enemies/debris.js`)

The author: "when enemies are exploding in pieces they should follow physics (the pieces)", "when an enemy loses a plate
element it should follow physics". One small rigid-body integrator for both: a box a piece (`boxOf`: its meshes' bounds and
the points a skinned body binds to its bones, worked out once a geometry and bone), gravity 14 m/s², the ground's plane under
it (`groundPlane`: three height reads, again once it has gone `reread` 0.25 m across), an impulse at each corner in the
ground (restitution `bounce` 0.38 above `soft` 1.2 m/s, Coulomb friction μ 0.55, the box's own inertia: it tumbles onto a
face), a rocking slide and spin that die at `rest` 2.5/s, asleep once still 0.25 s. It holds on a 20° slope and slides down a
40° one (tests/foe-debris.test.js, deterministic: the throw is the caller's, `throwFrom` with the foes' rng).

- **Only machines and stone break** (v2.37, issue #773, the author: "Only mechanical and rock enemies should split into
  chunks when dying. Not organic enemies"): what each archetype is made of is `MATTER` (debris.js: machine, stone, flesh,
  plant, spirit; it agrees with the roster's `family`), and `breaksApart(f)` breaks only a machine or a stone body (none of
  the archetypes is stone yet), or anything blown up (`f.blast`); an old kind or a guardian with no archetype keeps its
  own `breaks`. The crab, the centipede, the moth and the root knot (their `def.breaks` now unread) lie whole and go up in
  their puff; the crawler and the oracle now come apart like the other droids. tests/foe-debris.test.js: every archetype
  classified; flesh lies whole, machines break.
- **A body broken** (`Foes.breakApart`: a machine's parts; and a crawler's self-destruct, `f.blast`): each part thrown out from its chest (`BREAK.fall` 2.6 m/s ± a third, 2.6 up, 1.6 along the killing blow, a
  spin to 7 rad/s; the blast 7 m/s, 4.5 up, 14 rad/s), lying `BREAK.lie` 1.4 s once asleep (at most `life` 3.4 s), then
  shrinking away over `fade` 0.5 s. A skinned body's joints carry its skin (kept with them till the last piece goes). A
  clatter as a piece lands hard (two a frame at most). At most `DEBRIS.max` 48 flying: the oldest put to rest.
- **What it held** (`Foes.looseGrips`, a ragdoll's): its weapon let go, tossed gently along the blow.
- **A blot's ink**: its drops land on the ground under it and lie a moment as flat splashes (`Dots`' `floor`/`land`).
- **A plate knocked off** (`Foes.dropPlate`, #722): thrown out from the body at `PLATE.out` and `up`, along the blow, spinning
  to 9 rad/s; it bounces and clatters (a glance's ring for its first two), slides to rest on the slope, lies `PLATE.lie` s
  and sinks as before. Before, it fell straight, bounced on the flat height under it and stopped dead where it met it.
- Cost: 48 pieces flying 2 s, 0.2 ms a frame in node; asleep none.

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

## The ember wisp's fireball (issue #398: `src/fireballs.js`, `src/foes.js` Foes.throwBall …)

The roster's 22nd archetype (`wisp`, a spirit, the bombardier; docs/design/fireball-foe.md, with its lore and the prompts
for its sheet) floats out of the blade's reach, 4.2 m up (`hover`), and backs off within 7 m (`keep`). Its body is its
picked sheet-1 (src/enemies/plans/ember.js, `art: 'sheet-1'`, issue #440): four petals of glossy ink closed into a bud
round a glowing coal, each hinged at the ring of light round its waist, a cup under the ring and three drips of ink, the
petals, cup and drips one skinned mesh on their pivots (6 draws, the stand-in's clam 11). Its surface (surfaces.js):
the petals' wet streaked gloss and a violet coming up from the cup, the coal mottled; the marsh wisp's lichen stars.
Stunned low, its middle is held 0.9 m over the ground (`EMBER.sit`) and its drips splay on the sand.

- **The throw** (`attack.ball`): the petals open outward (the front pair furthest, down under the coal: `EMBER.open`), the coal rises, swells and brightens, and the body tilts back over 1.05 s, while
  the `kindle` cue (src/foe-voices.js CUES) rises over the usual warning. The wind-up ends instantly (`Foe.resolve`
  pushes `{ type: 'ball' }`) and `Foes.throwBall` sends a `Fireball` from the coal. Each wisp has one ball of its own in
  the air at a time (`attacksAt`: `ballOut`).
- **Its flight** (`FIREBALL`): 6.5 m/s at your chest, turning toward you at most 1.1 rad/s (gentle homing). Inside 2.6 m
  (`near`) it flies straight, so a late step aside makes it miss. It lands within 0.75 m (`hit`), burns out after 6 s,
  and a wall puts it out. Ember drops trail behind it, and its hum (src/foe-voices.js BALL_VOICES) follows it every 0.3 s.
- **The answer:** a cut sends it back. Two ways count: the blade's own touch (the ball is a target of kind `ball` that
  accepts `blade`), and **the window**. Any cut whose active frames (`blade.cutting`) fall while the ball is within 2.4 m
  of your chest and in front of you (`catchable`, 75° each side) counts. That opens about 0.25 s before it lands at
  Normal speed (0.32 s on Gentle, which flies it at 0.8×), with the cut's own active frames on top. Sent back
  (`Fireball.deflect`), it flies straight at its thrower at 15 m/s. The "tink", a spark and a ring mark it, with a
  hit-stop of 0.05 s and a hint the first time.
- **Hit by its own fire** (`ballStrikes`): a shot sent back (v2.36, issue #766, "Shots sent back" below): 1.5 harm
  (`RETURN.damage`) and a flinch that loses its wind-up, never a stun. (Until v2.36 a 3.2 s stun dropped it to 0.3 m over
  the sand to be cut: the author, "deflecting projectiles shouldn't stun the enemy".) It stays up: it has 4 hp, so three
  returns bring it down, or the hook, a jump and the air combo, or the gun.
- **Missed:** half a heart (an ordinary blow), with a flinch and a small shove. A **perfect parry** sends the ball back
  as a cut does (the guard is the existing one, `P.guard`). A plain guard puts it out with no harm. An evade's
  i-frames let it fly past (`pass`). A **shot** douses it in the air.
- **Its other move:** the *flare*, a 3.2 m ring round it when you get under it (1.0 s wind-up, the petals clenched).
- **With the kit:** lock-on works on it. The hook (#399) treats it as a `flyer` and pulls it down. Two wisps do not
  rally balls off each other: a returned ball goes only to its own thrower, which keeps the exchange readable.
- **The engines:** the same JS. The ball is a plain mesh in the game's glowing ink (`makeMaterial`, as a thrown
  glob's), with no shader of its own. Two meshes, out and back, are swapped by visibility, because the engines' scene
  mirror keeps a mesh's first material. The trail's drops fall gently (`grav: 1`): in Unity, rising drops (`grav < 0`)
  without a stretch blacked the whole frame for good. `-fight wisp` photographs an exchange in a batch run.
- **Where:** the Moon Foundry, Lorn II and the Eclipse (src/foe-worlds.js; `FROM.wisp` 1: not in a visit's first pack),
  the Pour Floor's waves (src/fight-temples/moonfoundry.js), and the Arena's cycle and FOES list (it is a built archetype).

Tests: `tests/fireball.test.js` (the flight, the window, the throw and a missed ball's harm, the return path, the flinch
without a stun, three returns, parry, guard, evade, the hook, the douse) and `tests/engine-fireball.test.js` (an exchange in
the engines' bundle, the blade pressed on the keys).

### Shots sent back (v2.36, issue #766, `src/shot-return.js`)

The author: "Me deflecting projectiles shouldn't stun the enemy". Until v2.36 a shot guarded went through the same answer as
a blow guarded at arm's length (`Foes.strike`: `Foe.staggered`), so a mummer's arrow blocked 16 m away shoved the archer
back and wore its poise, and a perfect parry of it stunned the archer for 2 s (`PARRY_STUN`) and broke its poise (down,
cuts double); the tripod's bolt did the same plus 2 harm; the wisp's own fire stunned it 3.2 s. Now one rule for every
shot (`isShot`: a lob, the fireball, a reflected bolt, a bow's arrow, `attack.shot`: the worm's spit stones):

- **A plain guard** stops it at the shield: nothing happens to the shooter.
- **A perfect parry** (and for the fireball a cut timed as it arrives) sends it back (`Foes.returnShot`, `ballStrikes`):
  a small bright ring flies from the shield to the shooter, sparks where it lands, `RETURN.damage` 1.5 as 'world' harm
  (`returnedBlow`: no poise worn, `info.flinch`: never the heavy recoil) and a flinch (its `def.hit` s, the wind-up it
  was in lost). Never a stun, a knock-down or a broken poise. A hint the first time.
- **Not shots:** blows struck at arm's length (a guarded one still throws its striker off balance, a perfect parry still
  stuns it and opens the riposte) and a harpoon's or a root's line (`onParry: 'cut'`: the line cut, the drone dazed).

Tests: `tests/shot-return.test.js` (every shooter's shots, plain and perfect, and a blow at arm's length unchanged),
`tests/fireball.test.js`, `tests/archetypes.test.js` (the tripod's bolt).

## Placed encounters

- **Relic guards** went with the relics in v2.34 (issue #732): no world has relics, so nothing gathers round one
  (`GUARDS`, `updateGuards`, the rosters' `guards` and `guardKinds` are gone; a save's `foes.<world>.r<i>` flags stay, unread).
- **Placed by hand** (v1.16, `src/foe-worlds.js` `PLACED[world]`: `{ archetype, at: [x, z], heading }`): it comes out
  where it stands as you come within `POSTS.near` (60 m), calm (`Foes.updatePosts`), in the world's skin; it doesn't
  hold the packs back; left far behind it goes and comes back as you return; cut down, it is gone for good (flag
  `foes.<world>.p<i>`). Lorn II's wood cutter (a furnace brute) stands on the dry bank of the lit path between the root
  arches past the glass dome; the Garden of Spheres' glass puppet (a marionette, v1.18) hangs by the white archway in the
  android wood, just clear of its arch; the Desert's cistern pump (a lamp tripod, v1.26) stands on the far shore of the
  mineral basin under the lavender cliffs (src/desert-vistas.js `BASIN`, opposite the fishing sign), its lamp turned
  out over the water: the one deep water the dunes hold.

- **The Givers' watcher** (v1.65, issue #245; `src/temples/pieces.js` `Sentry`, `SENTRY`): a temple foe, not one of
  the roster's archetypes (no hearts, no lock-on, never spawned by `Foes`). A squat bronze bell on a rose-stone foot,
  one amber glass eye under a hood, three vanes down its back, about 2.1 m. It stands on the Rose House's far landing
  by the east doorway and wakes once the Givers' guard is in hand: it turns its head to you, its eye brightens and a
  beam holds on you, narrowing (1.3 s; it follows you for 70 % of it, then locks and flickers), then a bolt flies down
  it at 12 m/s. The guard turns to it across the landing (a `lock` target with its own `lockRange`, 26 m; a cut only rings
  its bronze). **Answer: any block** (`player.guard`, perfect or not) sends the bolt back into its eye at 20 m/s and
  breaks it (its head droops, its eye goes grey), which opens the east door; a sidestep after the lock dodges it; a bolt
  that gets through costs ½ heart (spared) and knocks you back. Its first wake says so in one line: "Hold up your
  guard (LB / L1) as it fires." Broken is saved (`temple.desert.lit.sentry`).

## Encounter sites (v2.33, issue #722, `src/encounters/`)

The foes live somewhere now. Every world on the route has three to six **sites** (`src/encounters/sites.js` `SITES`,
48 in all), each built from the world's own archetypes (the roster of the part it stands in, `level.foes.partAt`) on its
own ground, and each pays when it is cleared. Before them a fight was a pack spawned on a ring round you, 35–55 s apart,
with nothing round it.

Each world keeps its own foes in its own skins (issue #762, the author, 2026-10-29: "I liked the enemies per world
actually"): v2.35's same foes in every world (#726 step 4) and one look per kind (#748) were reverted. Roster v4's seven
stay in the Arena, the gallery and Unity's `-fight`; the camps' racks and the warlord's hold are staged (`?staged=roster4`).

- **The kinds** (`layoutSite` lays each out round its centre, `heading` its front, the side you come from):
  - **camp**: a fire of stones and logs, the foes sat round it facing the flames, a lookout standing off the front by
    its post (a pole with a red rag), the coffer behind the fire, dry brush round the back.
  - **nest**: a ring of stones, bones and straw, the foes asleep in it round the coffer.
  - **hoard**: a coffer by a cairn and a post, its guards before it facing out, turning to look about.
  - **ambush**: a coffer alone, the bait, and a sign before it: the sand heaving with a hiss of grit now and then
    (`sand`), or a shadow sliding about on the ground with nothing over it (`shadow`). Step within `SITE.trigger`
    (7.5 m) and they come up round it, at you (out of a cloud of darkness; a mound worm out of the sand). Left far
    behind before it is cleared, it sets again.
  - **patrol**: a coffer by a cairn, the foes walking a beat (two cairns `beat` m either side) end to end in single file.
  - **hall** (v2.36, issue #730): a level's own makers' hall, listed by the level (`level.sites`), not in `SITES`: the
    Desert's skull cave, far overhead (`dy`: it wakes only from within that many metres of its floor). Its foes (three
    mummers and their king, the Desert's own: #762) on guard at the places it names (`spots`), facing its middle; no props. Each one cut down emits
    `site:fell` (`{ id, n, of }`: the story lights a Givers' lamp for it); cleared, no camp's words (the level says its
    own: the shrine's door sinks). With no foe about (the Enemies setting off, or no blade yet) it counts as cleared,
    quietly, as you come in, so the door it keeps is never shut on anyone. tests/skull-hall.test.js.
- **The idle** (`src/encounters/idle.js`, the foe's `f.idle`; `Foe.update`'s idle case asks it while the foe is calm):
  `sit` (by the fire), `sleep`, `guard`, `lookout`, `patrol`, `orbit` (a flyer circles its post instead of sitting or
  sleeping), `hidden` (an ambush's). Each notices you within its reach (`IDLE`: × its kind's own calm distance, kept
  between `min` and `max`: one sat by the fire 4–8 m, a guard 8–12, a lookout 14–18) and in its sight; a sleeper only
  right beside it (2.4 m) or to someone running up (6 m). **One noticing you wakes the site**, a moment apart
  (`SITE.wake`, a sleeper slower), each through its alert beat (`Foe.noticed`: it rears and calls; and `Foes.alarm`
  wakes any kind within 14 m); a lookout's, a guard's or a patrol's call at once. A foe left be goes home and settles
  back into its life there.
- **The body at rest** (`restPose`): sat or asleep, its body is lowered onto its legs (a body with no legs squashes),
  its head down, asleep a little rolled and breathing; laid on as a hit's reaction is (`applyReact`'s `extra`, from
  `f.restPose`), eased in as it settles and out as it wakes. Over a sleeper near you, two inked "z"s rise.
- **The sneak strike**: a cut on a sleeper still calm lands `IDLE.sleep.sneak` (3) times over (`Foe.hit`); said once,
  hints full. Its nest wakes through the alert beat (`Foe.noticed`) when it is hurt or you come too close.
- **The coffer** (`props.js` `coffer`: rough stone in brass bands, the temples' Coffer's build): shut while the site's
  foes stand; every one cut down, the site is **cleared for good** (flag `site.<world>.<id>`), a word ("The camp is
  quiet. Its coffer is yours."), and the coffer's lamp lights. Opened (E), its lid swings back and a purse spills out:
  `SITE_PURSE` by the world's stage, 20/25/30/40/50 chimes (game event `site:cache`, `src/chimes.js` connectDrops, once a
  save: `res.site.<world>.<id>`), against a wandering pack's 2–20. With the Enemies setting off no foe comes out, and
  the coffer opens at once.
- **The prop both sides use** (B9): a camp's fire is the world's (`siteFlammables` in `src/flammable.js`'s
  `flammableSpots`): it burns whoever is knocked into it, foe or traveller (`src/story/flames.js` fireHazard, foes
  through `feelWorld`); an ember glob flares it and the sitters round it catch fire (`src/chemistry.js`), and the dry
  brush round the camp carries a fire on to them. (Left: a barrel that bursts or a boulder on a slope; nothing in the
  physics carries one cheaply yet.)
- **At work** (`src/encounters/index.js` `Encounters`, made with the foes in `src/host/game-host.js` wireFight, so the
  engines' too): a site's things are made within `SITE.build` (160 m), its foes come out within `SITE.near` (70 m),
  calm, in the world's skin (`Foes.add`, `f.site`); left past `SITE.drop` they go with the packs and come back as you
  return, the ones cut down staying down for the visit. **No wandering pack comes in within `SITE.quiet` (110 m) of a
  site still to clear** (`Foes.packQuiet`).
- **Where**: placed with the world's own ground and its paths, people and doors measured round them (the #722 site
  finder: a grid round the route's line, 30–150 m off it, flat enough for the whole site, clear of what it must keep
  clear of, then each site's pieces stood on the world), then looked at in the running game. `tests/route-worlds.test.js`
  (`siteFaults`, `SITE_CLEAR`) checks every piece of every site on the world as the play-through builds it: on the ground
  at the site's height, with room to stand, 12 m or more off the route's line, clear of doors (15 m), people (18 m), the
  makers' boxes (10 m), the landing (40 m) and inside no temple; the Floating City's small platforms by smaller distances.
  `tests/encounters.test.js`: the data, the layouts, the idles, a camp, a nest and an ambush at work.

### The wandering packs, fewer and together (v2.33, issue #722)

- **Fewer**: `PACK.rest` 60–95 s (35–55 before), none round a site still to clear.
- **Together, or not at all** (`Foes.packSpots`): a centre on the ring round you (18–26 m, footing within 5 m of your
  height, in the wilds), the lead on it and every other member within `PACK.spread` (2.4–6.5 m; a flock closer) on
  ground within `PACK.step` (2.5 m) of the centre's, with room for its body. When no centre of `PACK.tries` (10) holds
  the whole pack, the most of it that fits down to `PACK.trim` (60 %, never fewer than two), else it waits for a better
  spot. Before, each member was tried on its own round the ring and whoever fitted came: in the Signal Market 28 of 185
  wanted members, spread 6–26 m apart, lone foes in the last world.
- **Fillers from the world's own roster** (`src/foe-worlds.js` `ROSTERS[w].fill`): every kind of its roster that may
  join a pack (not the shade, a lead alone, nor a swarm), a pair or a trio as its group, each taking its own places
  (`costOf`); no blot added where the world has none. The Market's five-foe packs were a lead, a crab and three blots.

## Controls and the lock-on

- **RB / R1** (a left click, F, ⚔) swings (held, the charged cut; in the air, the air cut); **LB / L1** held (Ctrl or Z on land, 🛡) guards; **B / ○** (Alt, ↶) evades; **R3** (Tab, ◉) locks on, and with no foe in reach turns the camera behind you (v1.86; Plumb has D-pad →: docs/systems/controls.md, "The wheel and Plumb's button").
- The push is a gun mode (`MODES.push`, always owned with the backpack): fired as a shot, it throws the cone.
- **The hook on the lock** (v1.82, issue #399): locked on, **RT / R2** throws the grappling hook at the foe (the hook in
  hand, or nothing in hand). Each kind's `hook` class says what it does: `light` yanked to you and dazed, `heavy` pinned
  1.8 s, `flyer` pulled down, `armoured` clanks it off (`Foe.hookYank`, `hookPin`, `hookDown`; the classes, the rules and
  each kind's: docs/systems/gadgets.md, "The hook on a foe").
- In a fight (`foes.near(20)`) LB doesn't zoom (`Controller.combat`).
- **The lock-on:** `Foes.cycleLock()` locks a foe in `LOCK.reach`: those ahead of the camera first, by distance
  × (1.6 − how straight ahead), so the one nearest the middle of the view wins; then the next, then lets go. It
  is lost past `LOCK.lose`; when its foe falls it moves on to the nearest still standing in reach (`nextLock`, v0.96).
- While locked, main.js turns `rig.yaw` to keep the foe ahead, the reticle marks it, and the blade's soft
  lock, the guard and the cut's pull turn to it first (`tool.lockOn`; `lockTarget()` carries its body's radius).
- **A small foe kept in view** (v1.48, `LOCK_VIEW`, `lockViewAngle`; combat-v1.47 rec. 3, issue #107): straight down
  the line from the traveller to the foe, the camera set a blot, a lizard or a toad 6-9 m off right behind his back, its
  tell hidden. Now the camera swings round him off that line, on the side it was already on when the lock began, by the
  least angle that sets the foe's centre clear of his body on the screen (his half-width `body` 0.42 m at the arm's
  length, the foe's radius, `margin`), at most `max` 0.7 rad (0.5 until issue #236: a blot 2.5–3 m off needs 0.65), eased at 4/s: about 21° at 6 m, 17° at 9 m, 14° at 14 m.
  A foe whose chest stands over `tall` (1.5–2.6 m: the brute, the bell, a jelly, a ray in the air, a guardian) needs
  none. The camera QC's `arena-lock` and `arena-lock-lizard` measure it (`foe hidden`: the frames where his body covers
  half the foe's screen box).
- **A hop with the foe at his feet** (issue #236, `hopAxis` in src/jump.js): the back flip and the side hop are read
  from the stick against the line to the foe, but within `LOCK_NEAR` (1.2–2.8 m) the lock camera stops turning after
  it, so "back" on the stick was back on the screen and not away from the foe: against a ring centipede curled round
  him the press read as a plain jump and the perfect dodge never opened (dodge.mjs: 33 of 35 at v1.61). There the line
  gives way to the camera's look (`player.lockOn.hop`), blended as the camera's turn is.
- **The lock's turn** (issue #236, `LOCK_TURN`, `lockTurn`): the camera turns after the line with its speed eased (at
  most 9 rad/s more a second, 3.2 rad/s at most, braking to stop on it), so the line flipping as you walk past a foe no
  longer starts and stops the view at once (docs/systems/movement-and-camera.md, "The lock camera's turn, eased").
- **Aiming locked on** (v1.41, the author: "gun aim stays on the locked target when aiming with L2 while locked on";
  `src/fluid-tool.js` `LOCK_AIM`, `lockAim`): aiming (the tool's `k` and `camK` up), main.js turns the rig's yaw *and*
  pitch so the camera, from where it stands over the shoulder, looks at the foe's chest (at `LOCK_AIM.rate` 14/s); before,
  only the yaw was turned, from the traveller, so the over-the-shoulder crosshair sat off to one side and the pitch was
  the player's. And `updateAimPoint` gives the crosshair the chest when its ray passes within `snap` (1.4 m) of it, the
  line clear (`aimLocked`). Measured in the Arena on a crab 10 m off to one side: the crosshair settles within 0.1° of its
  chest. Tests: `tests/lock-aim.test.js`.
- **The reticle** (`src/lock-reticle.js`, `#foe-lock`; v1.42, the author: "closer to Ocarina of Time, 4 arrows pointing
  towards the character that are rotating, less complicated; remove the health bar, and remove the red when the character
  is attacking: it should be obvious"): four gold arrowheads, their tips in at the foe, turning round it at `RETICLE.spin`
  (1.4 rad/s), an SVG over the game. Each is two-toned (a lit and a shaded face, like a little pyramid) over an ink edge
  (`edge` 2.6 px) and a soft pale halo (`halo` 5 px at 0.45), so it reads on bright sand and on dark rock; `arrow` 18 px
  long, `wide` 17. They ride a rounded ring (`reticleRing`, a superellipse of power `round` 4, `arrowAt`) round the foe's
  **head** (issue #755, the author: "Sometimes the lock on feels too big vs the size of the enemy. Check how botw handles
  this"; BotW marks its target with one arrow over the head, about one size whatever the foe: `markerAt`, its weak point
  `model.weak` or the eyes its gaze turns, else its drawn body's top less `top` 0.3 m; switched to the weak point, #722
  `Foe.aimWeak`, that) grown by `gap` (14 px, breathing ±6 %), its half-size held within `size` 24–40 px (`markerHalf`):
  measured in the camera QC's `frame-<kind>` scenarios (1280 × 720), every kind's median 24–40 px, where round the whole
  body (v1.42 to v2.35, `min` 30 to `max` 300 px, still `bodyBox`) it was 47–300: a crawler 9 m off 47 → 24, a hulk 2 m
  off 175 → 34, a furnace brute 300 → 40. Tests: `tests/lock-frame-foe.test.js`, `tests/combat-feel.test.js`. The drawing scales with the screen (`reticleScale`: 1 at 720 px on the shorter side, up to 1.7,
  × 1.25 under 560 px, a handheld's small CSS pixels). A new lock flies them in over `snap` (0.35 s) from `from` (2.4) ×
  the ring with an extra `whirl` of turn. With Reduce motion on (v1.48, combat-v1.47 rec. 4, `reticleMotion`) none of
  that moves: the arrows rest at the box's corners (`still`, π/4), the gap doesn't breathe, a new lock appears at its ring
  and only fades in. Off the screen they wait small at the edge on its side. `reticleLook(f)` is only
  `calm` or `veiled` (buried, phased: the arrows hollow, their ink outline and halo with no gold faces, at `veiled` 0.75
  opacity, `reticleArrows`; v1.49, issue #126: by shape, not by opacity alone, checked on the Handheld preset with Reduce
  motion on in simulated protanopia, deuteranopia and tritanopia; before, only 0.5 opacity): no health pips, and nothing for the
  foe's wind-up, strike or stagger, which its body, its glow and its sound tell. Before: v0.96's gold chevrons on a ring
  over the chest; v1.39's corner ticks, a diamond over the head and hp pips, coral and doubled while it wound up, pale blue
  when open (v1.41 drew them bolder). Tests: `tests/combat-feel.test.js` (the tips outside the body, pointing in, the ring's
  sizes), `tests/accessibility.test.js` (one look, nothing told by colour).
- **Guardians** (v1.39, `GuardianLock`, `src/temples/boss.js` `GUARDIANS_LIVE`): a guardian in its fight is locked on as a foe is
  (its body's edge within `LOCK.reach`), through a stand-in that answers the lock's, the reticle's and the blade's fields from
  it: its chest, its model (the reticle rings it), its wind-up as `wind`, open as stunned; weary or
  calmed, the lock lets go. So the back flip and the side hop work against it.
- **Only what you can see** (issue #313, the author: "I shouldn't be able to lock on to enemies through a locked door";
  `LOCK_SIGHT`, `lockSight`, `Foes.inSight`, `lockHid`, `seesYou`): a foe is a candidate for the lock (`cycleLock`, the
  flick's `switchLock`, `nextLock` after a kill) only if a physics ray from the camera or from the traveller's eyes
  (1.5 m up) reaches its chest within its radius. A shut door's block, a gate and a wall are all in the collision
  (`physics.addCollider`), so none is locked on through one. A lock held on a foe that goes behind one is looked at every
  `every` (0.2 s) and lets go once it has been out of sight past `grace` (0.8 s), so a pillar it passes behind doesn't drop
  it. A guardian (its own fight) and a buried foe (its fin) are always seen. The foes keep the same rule: one behind a
  shut door doesn't notice you (`env.seen`, idle and coming home), and `env.mayStrike` holds a blow until it sees you
  (its own ray, every `strike` 0.25 s), so nothing winds up at you through a door. Tests: `tests/lock-sight.test.js`.
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
  **Never at a foe, never in a fight** (v2.35, issue #747, the author: "Never auto jump when fighting enemies";
  `mayRise`, `FIGHT_KINDS`): the rising cut is only for a thing hung over you (a bell, a lamp, a rope) with no fight on
  (`FluidBlade.inFight`: locked on, a foe engaged within `FIGHT.near`, or `FIGHT.after` s since). A press at a hulk (its
  chest 2.3 m up) or a warlord (3 m) leapt every time, and the combo broke in the air after the first cut. A flyer is met
  with a jump of your own and the air combo. Nor does he climb a wall of his own in a fight (`Player.inFight`, set by the
  blade each frame): walked, backed or rolled into one from the ground, or out of a locked-on hop, he stays on his feet;
  jump at it to climb. Walking off a ledge is a fall as ever. Tests: `tests/fight-no-autojump.test.js`,
  `tests/combat-feel.test.js`.
- `tests/combat-feel.test.js` checks each of these, the turns off the screen, the lock, slow motion, the pull and the buffer.

## Strafing, locked on (`src/player.js` `LOCK_MOVE`)

- main.js sets `player.lockOn = { dir }` each frame while a foe is locked.
- The body faces it square (no lead into the step) at `LOCK_MOVE.turn`; speed is capped at a jog
  (`LOCK_MOVE.speed` 4.2 m/s) with no sprint.
- The camera keeps the foe ahead, so the stick strafes round it, or backs away.
- Sideways and backwards, `updateStrafe` plays the Sword and Shield pack's strafes (`ss_strafe_1` left,
  `ss_strafe_2` right) or its walk back (`ss_walk_2`) over the whole body, their time following the ground
  covered.
- **No artifacts changing side** (v1.41, the author: "lock-on strafe animation artifacts when moving left and
  right"). Measured in Node (`tests/strafe.test.js`, left, right and still in turn): the worst turn of a bone in a
  frame was 1.64 rad (the thighs), with 263 of 450 frames under a start, stop or pivot clip; now 0.38 rad and none.
  The causes: a change of side swapped one step for the other in a frame at full weight; a diagonal near the line
  flipped between the steps and the loops frame to frame; and the starts, stops and the run's 180° pivot
  (`src/loco-moves.js`: a strafe reversal at the lock's 4.2 m/s is a pivot's speed) and the chest's lead into the
  stick's way (`src/locomotion.js`) still played. Now `strafeSide` keeps a side until another is clearly wanted,
  `strafeStep` fades the old step out (`LOCK_MOVE.swap`) before the new one comes in, and locked on the starts,
  stops, pivots and the chest's lead are off.
- A fast approach toward the locked foe counts as a run for the lunge.

## Bodies: you can't walk through a foe (v1.41, `src/foes.js` `BODY_BLOCK`, `Foes.keepOff`)

The author: "the player can't walk through enemies". Each frame, after the foes keep apart from each other, the traveller is
pushed out of any standing foe's body: flat, to `BODY_BLOCK.k` (0.8) × its radius + `player` (0.4 m) from its middle, if
he overlaps it in height (over it, jumping, he passes); his speed into it is taken away. A light foe (skitters, moths,
splinters: `def.light`) gives way, taking 85 % of the push; an ordinary one 25 %; a heavy or rooted one or a guardian none.
Never during an evade, a dash cut (which goes past the foe on purpose) or a locked-on hop, riding, knocked down, or against
a foe going down, buried, a running shadow, riding another or out of the world. The cut's pull (`MAGNET.ideal` 1.05 m off
the body's reach) stops outside the ring, so a swing never pushes into it. Tests: `tests/body-block.test.js`.

**No way through, at any speed** (v2.35, issue #751, the author: "I shouldn't be able to clip through enemies"). Measured
before: an evade, the fight temples' roll, the dash cut, the running cut and a locked-on hop were all let through (the
dash cut was even aimed 1.1 m past a foe's middle, inside a hulk's), and the ring was 0.8 × the radius + 0.4 m, so his
body and a grunt's overlapped by 9 cm standing still. Now:
- the ring is the whole radius + 0.4 m (`BODY_BLOCK.k` 1): a grunt holds him 0.85 m off its middle, a hulk 1.4 m, a
  warlord 1.25 m;
- it holds through every move: rolled, dashed or hopped into a foe he slips round it. His way since the last frame
  (`blockSweep`, flat) is tested against the ring, so a dash cut at 16 m/s (27 cm a frame, more on a slow frame) can't
  step across one in a frame: begun outside, he is put where he met it and the rest of the step slides on along it;
- on a slope: on the ground he is over a foe only `over` (0.3 m) above its top, so one step uphill of a blot (its top
  under his feet) still holds; in the air its top, as before (a jump still clears a low foe);
- walls: a wall at his back (`env.canStep`, the foes' own way test, from 0.6 m up with `wall` 0.45 m of clearance) gives
  the push to the foe instead (a hulk too: it is that or stand inside it), and the foe steps back only where it may walk
  (`Foe.step`), so neither goes through a wall.
`tests/body-block.test.js` runs a roll, a dash cut and a hop at 16 m/s into a grunt, a hulk, a warlord, a crab and a blot
(never inside the ring), the sweep, a slope and a wall.

## The stutter when a new foe comes in (v1.41: measured; `Foes.rosterKinds`, `Foes.warmModels`)

The author: "investigate stutters when new enemies appear". Measured in the Arena (Mac, headless Chrome on the GPU,
Medium; each kind called once with nothing else in play, the frames for 1.5 s after): building a foe is 3–18 ms of JS
(`spawnKind`: its model, its parts batched, its target); the hitch is its **first draws compiling GPU programs**: the
first of a kind compiled 1–5 new programs (its surface's feature combination, `src/foe-surface.js` FS_*, in each pass)
and its worst frame was 50–183 ms (the drone 183, the moth 150, the cart 83, the crab and the brute 67); the second of
the same kind compiled nothing and never dropped a frame (16.8 ms, as idle). On a console each program is a second or
more (docs/systems/xbox.md), so a new kind there is a long freeze. Drawing every kind's body once up front (28 programs,
421 ms on the Mac) took every first appearance afterwards to 16.8 ms and 0–1 programs. `Foes.warmModels(kinds)` builds
those bodies (as `add` does, batched, skinned for the world, and a telegraph's glow) in a group out of the world and out
of the target registry, for the loading work's warm pass (src/warm-shaders.js `warmRest`, main.js) to draw or compile
once; `rosterKinds()` lists the kinds a world can field (every kind in the Arena). Nothing here adds them to the scene:
when to pay the compile (behind the loading screen, or a slice at a time after the first frame) is the loading work's
call. Tests: `tests/foe-warm.test.js`.

**Wired in v1.42** (issue #1, the author: "seeing frame drops in the arena"). main.js puts `foes.warmModels()` (the world's
roster; every kind in the Arena) in the scene, far below it, before the surfaces' and the shadows' warm passes, and takes
it out after the programs' first use, before the passage's draws and the first frame (`foeWarm`). The group also holds a
`ShadePools` (the ink a fallen foe leaves: its decal's program was the last one compiled mid-fight, at the first kill), only
for the warm: kept in the world from the start, its dynamic meshes made every shadow map redraw each frame (+535 draws in
the Arena's pack view); its materials outlive it, so the pools made at the first stain find their programs ready.
Measured with a scripted fight (the Arena's own waves round a traveller kept alive, locked on and swinging three times a
second, a foe cut down after 7 s; the shipped bundle, headless Chrome on the M4 Pro's GPU, 1280 × 720, 120 s, 13 waves; the
machine shared with other work, so the medians move by a few tenths between runs; the spikes do not):

| Arena fight, Mac | High before | High after | Handheld before | Handheld after |
|---|---|---|---|---|
| frame p50 / p95 / p99 (ms) | 3.4 / 4.3 / 5.1 | 3.4 / 4.5 / 5.7 | 2.3 / 3.4 / 4.6 | 1.9 / 3.0 / 3.4 |
| main thread p95 (ms) | 3.9 | 4.2 | 3.1 | 2.9 |
| worst frame (ms) | 201.8 | 22.1 | 202.5 | 19.3 |
| frames over 50 ms | 12 | 0 | 6 | 0 |
| programs compiled mid-fight | 27 | 0 | 18 | 0 |
| the Arena's load (s) | 1.6 | 2.0 | 2.2 | 2.1 |

Every spike over 33 ms in the before runs was a frame that compiled 1-5 programs (a kind's first appearance, then the
first stain); none was a collection alone (the heap's drops came with compiles), the particles, the floor or the reticle.
The Arena's load grows by about 0.4 s on the Mac (every kind's programs, behind the loading screen); a world's own roster
is a handful of kinds. Tests: `tests/foe-warm.test.js` (the wiring's order in main.js, the pools warmed and let go).

## The back flip, the side hop and the flurry (v1.39: `src/jump.js` `HOP`, `src/flurry.js`, `src/feel.js` `flurry`)

Breath of the Wild's evade, asked for by the author (2026-10-10). Locked on, jump is an evade when the stick says so:

- **Which** (`hopKind`): the stick (at least `HOP.stick` 0.5 of its tilt) more than `backAt` (2.1 rad, 120°) off the line to
  the foe is the **back flip**; more than `sideAt` (0.85 rad, 49°) the **side hop** to that side; toward the foe, barely
  tilted, or not locked on, jump is the jump (and the double jump stays). The keyboard: Space with S, A or D while locked (Tab).
- **The move** (`Player.hop`): `HOP.back` 9 m/s up and 7.5 m/s straight away from the foe (≈4.2 m, 0.56 s in the air);
  `HOP.side` 6.5 up and 8 to the side (≈3.3 m, 0.4 s). Carried its own way: no steering in the air, no double jump, no jets
  or wings from the jump held; still facing the foe. `HOP.rest` 0.12 s on the ground before the next.
- **The flips** (`flipPose(c, s, k, spec)`, the double jump's machinery with a spec): `BACK_FLIP` the front flip turned the
  other way (`turns: -1`, 0.5 s, done before it lands), `SIDE_HOP` a lean into the hop and back (`axis: 'z'`, `lean` 0.42 rad,
  0.36 s), the legs gathered. `flipAngle` says the turn; tests check each way.
- **Dodge frames** (`FluidBlade.hop`, `hopFrames`): `HOP.back.iframes` 0.02–0.32 s, `side` 0.02–0.26 s (Gentle: 0.06 s longer),
  under the evade's own rule (`EVADE.rest`: hopping again before a window has rested 0.3 s gives none).
- **The perfect dodge** (`Foes.perfectDodge`, `foeThreat`, `guardianThreat`, `perfectAgainst`): a hop begun while a blow is
  due within `dodgeLead(wind)` = clamp(`DODGE.share` 0.35 × its wind-up, `min` 0.2 s, `max` 0.42 s) (× `gentle` 1.3), and
  you in its way (its area grown by `DODGE.margin` 1.2 m, or within its reach and 1.2 m). "Due" is `landsIn`: the rest of
  its wind-up plus its strike phase up to its `contact` (a lob, a flash, a blink: at the wind-up's end; a charge's sweep: any
  time in its strike). A blow the hop's frames swallow (a shockwave's front, anything `Foes.strike` asks `Player.dodge`
  about) counts too (`onHopDodge`). Why these numbers: a third of the tell lets a hop answer the body's wind-up, not a
  frame; a blot's 0.6–0.8 s tell gives 0.21–0.28 s, a guardian's 1.2 s gives 0.42 s; under 0.2 s a jab would be a guess,
  over 0.42 s a slow wind-up would be a free flurry. Generous next to the perfect parry's 0.18 s (`GUARD.perfect`), as a hop
  must also read the blow's way. Every archetype's attacks and every guardian's opening move are checked
  (`tests/flurry-hops.test.js`), and in the running game by `.claude/skills/combat-review/dodge.mjs`.
- **The flurry** (`FLURRY`, main.js `startFlurry`): the world at `rate` 0.12 of your speed for `time` 3.5 s of yours, eased
  in and out over `ease` 0.2 s; a breath and a falling glass note (`sound.flurry`), a soft rumble (`flurry`), and a pastel
  vignette closing in from the edges, cream to lavender with a thin ink rim (`FlurryFx`, a CSS gradient over the canvas: no
  pass, no draw call), its opacity the slow time's. While it lasts nothing touches you (`FluidBlade.dodge`, the guardians'
  `P.untouchable`), a combo swing pulls you in from up to `reach` 6 m (`MAGNET.max` is 2.2) and the third swing's rest is
  × `cool` 0.3: a few free blows. It ends early when nothing is left fighting (`Foes.anyFighting`), and another may only
  begin `time` + `again` (1.2 s) after one began. Said once after the fact with Hints full (`hint.flurry`).
- **Back to back, rationed** (v1.48, `CHAIN`, `nextFlurry`; combat-v1.47 rec. 2, issue #106): a late pack strikes about
  once a second, so a hop at every blow chained flurry on flurry (74 % of your time untouchable). One flurry is as it was;
  one begun within `within` 6 s of the last one's end is the next of a chain: the second lasts × 0.7 (2.45 s) and waits
  2.5 s after it, the third and on × 0.5 (1.75 s) and 4 s. Chained flat out that is about 30 % of your time; a pause of
  6 s and the next is whole again. Measured with `arena.mjs --pack-clear --clear-dodge --dodge-watch 30`: a traveller
  hopping at every blow of a late pack for 30 s, the flurries counted.
- **Slow time, simulated right** (`feelDt`, `selfDt`): main.js gives the world (the foes, the guardians, physics' movers,
  the weather, every system on `dt`) the slowed step and the traveller's own systems (`controller`, `player`, `rig`,
  `tool`, `gadgets`) `selfDt()`: the same step but for the flurry. Everything stays a plain function of its own `dt`, so a
  wind-up, a charge or a shockwave runs exactly as at full speed, only slower; a hit-stop still freezes both. Reduce motion
  leaves the flurry (it is a move, not a flourish).
- **Not the evade's**: the evade (B / ○) keeps its own perfect dodge (the hit-stop, the ring), no flurry; the guard and the
  perfect parry are untouched.
- **Teaching**: the first lock-on says it once (`hint.hop`, hints subtle or full): "Locked on: jump with the stick back flips
  away, to a side hops aside." Nothing else.

## Guards and their breakers (v2.27, issue #661, `src/foe-guard.js`)

The Breath of the Wild study (`docs/design/combat-botw-study.md`, ranked changes 2–4): a few kinds defend, and each
defence is opened by one move of the kit. A kind with `def.guard` raises it between its own blows while you are within
`near` m (`wantsGuard`: chasing, not stunned, not resting, not held past `hold`); it rises over `STANCE.raise` 0.22 s and
drops the moment it winds up, is stunned or reels (`lowerGuard`). Up (`guardUp`; also through a `shielded` wind-up), a
blow inside its `arc` that `guardTurns` (the blade, a bomb; a shot or an ember only off a shield, `shots`) glances
(`Foe.hit` → `'guarded'`, `Foes.guarded`: the clang, sparks, a shrug of the body without the flash, the blade's hit dull:
no splash; since v2.36 the blade rebounds off it and the guard answers at once, "The rebound off a raised guard"
below). The `breaks` move goes through (`guardBreaker`: `charged`, the charged cut, full or not; `air`,
the air cut's plunge, not the air combo's light swings; `riposte`; `bomb`): the blow lands as a cut, the guard is thrown
open (`openGuard`: stunned `open` s, 0.9–1.4: BotW's reel, never a long free stun; every first cut into it double; a
crab `onBreak: 'flip'` on its back), told by the body flung wide, the gold ring, the stagger and the stun's stars
(`Foes.guardBroken`).

Never a wall: held `hold` s at most, then down `rest` s with its blow due (`cool` 0); `blocks` blows turned in a row and
it answers at once with its `counter` (`tendGuard`), a blow begun as an answer (`answering`) that light cuts can't break
off. Spam the wrong move and you are turned away, then hit, then the answer's recovery lets your cuts in: no stalemate
(`tests/foe-guard.test.js` drives each kind in the Arena, headless). The first time each guard turns a blow, its `hint`
(tips: off in today's hint levels, so the pose carries it).

| Kind | Pose (`pose`) | Arc | Breaker | Answer to spam | Window |
|---|---|---|---|---|---|
| Furnace brute | both forearms up before it, the fists at its crown (`arms`) | 60° | the charged cut, the riposte, a bomb; round its side | its backhand after 3 | 1.2 s |
| Shellback crab | clamped flat in its shell, legs and stalks drawn under (`tuck`) | all round | the air cut's plunge onto it, a bomb (it flips) | its snap after 3 | 1.4 s on its back |
| Shade | the ink sword held up across it (`sword`) | 57° | the parry of its answering cut, then the riposte; round its side | its cut after 2 | the parry's 2 s |
| Makers' fencer | its kite shield square before it (`shield`); also through its bash, shove and leap's crouch | 66° | the charged cut, the riposte, a bomb; its back (the dash cut) | its shield bash after 3 | 1.0 s |

**The hop a blow asks for** (ranked change 2): an attack's `dodge` (`'back'` a sweep, `'side'` an overhead or a thrust;
unset: any) names the hop that answers it (`src/flurry.js` `hopFits`): only that one starts the flurry (`Foes.perfectDodge(hop)`,
`FluidBlade.dodge(…, atk)`); the other still has its dodge frames. Set on the brute's sweep (back), the shade's cut (back)
and feint (side), the fencer's overhead (side), sweep (back) and leap (side).

The creatures gallery (enemies.html) shows each guard and its broken pose beside the moves ('Guarding', 'Guard broken').

### The rebound off a raised guard (v2.36, issue #774, `src/fluid-blade.js` `REBOUND`)

The author: "If I hit an enemy with their guard up I should recoil. Research how botw does it and fix". Until v2.36 a cut
into a raised guard only clanged: the blade's hit was marked dull and the combo went on, so three quick light cuts in a
row were the cheapest way to make a guard answer, and nothing in the traveller's body said the cut had been turned.

**How the Zelda games do it** (from play and the footage of `docs/design/combat-botw-study.md`; no frame-exact BotW
number is claimed here: the wikis that list the mechanics, Zelda Dungeon and Fandom, refused automated reads, and the
guides found, GameWith's combat guide and Mic's parry guide, cover the perfect guard and the flurry only):

- **The rebound.** A melee hit on a raised enemy shield (a Bokoblin's or Moblin's wooden shield, a Lizalfos's, a Lynel's)
  does no harm: Link's weapon bounces back off it with a clang and sparks, he is knocked half a step back, and his combo
  ends there. The same rebound throws him off stone and metal (a Stone Talus' rock, a Guardian's hull) and, since
  Ocarina of Time, off walls and shields ("tink"); in Skyward Sword a slash into the side a Bokoblin guards bounces back
  the same way. It is short, about half a second by eye, and it is an opening: shield foes swing or bash back into it.
- **How long he is open.** The bounce takes his next press away for that half second; the guard and the roll come back
  sooner, so a player who reads the clang can still shield or dodge the answer, and one who mashes eats it. The foe's
  own reel after a perfect guard is 0.5–0.75 s (the study, Lynel 1:22.5–1:30): about as long.
- **What breaks a guard.** Going round it (the side or the back, a jump over it); a heavy blow (a two-handed weapon's
  charged spin or smash knocks the shield aside); a perfect guard of the foe's own blow (it stumbles, may drop its
  weapon); a perfect dodge into the flurry rush; a bomb, an arrow in the face, a thrown weapon, stasis; and the shield's
  durability (a wooden one breaks after a few blows). In BotW the "shield bash" is the perfect guard itself (A while
  shielding); Hiraeth's fencer and sentinel bash *you* when you turtle.

**What Hiraeth does now.** A blade blow its guard turns (`Foe.hit` → `'guarded'`, the guard's `arc`, not its breaker)
rebounds the traveller: the swing stops, the chain, the queued and buffered presses go (`FluidBlade.rebound`); a
hit-stop of `REBOUND.stop`, a camera nudge, the blade's ripple; the arm plays the swing's own clip back from where it met
the guard toward its wind-up over `REBOUND.back` s and is let go over the rest (upper body, `id` 'rebound'), and he is
carried back along the blow at `REBOUND.push` m/s, easing (a step: about 0.4 m). For `REBOUND.time` (0.5 s) no swing
starts and presses made then are dropped (mashing is not buffered through it); for the first `REBOUND.lock` (0.3 s) no
guard rises, no evade or hop starts. In the air the swing stops and the air combo ends.

The foe punishes it: a rebound counts as a full row of turned blows (`Foe.rebounded`), so its guard answers at once with
its `counter` (the brute's backhand, the crab's snap, the shade's cut, the fencer's bash, the sentinel's riposte), its
wind-up from 0.5 s (the sentinel's quick riposte) to about 1 s, so the blow lands at least 0.15 s after the lock lifts:
guard it, parry it or roll it then, or be hit. Its breakers are as
before (the charged cut, the air cut's plunge, the riposte, a bomb, round its side), and a bomb or a shot it turns never
rebounds anyone.

| Kind | Guard | Turned, its answer |
|---|---|---|
| Furnace brute | forearms crossed (`arms`) | its backhand (`sweep`) |
| Shellback crab | clamped in its shell (`tuck`) | its `snap` |
| Shade | its ink sword across (`sword`) | its `cut` |
| Makers' fencer | its kite shield (`shield`) | its shield `bash` |
| Sentinel | its round shield (`shield`) | its `riposte` |

Tests: `tests/rebound.test.js` (the traveller's rebound on the gait course: stopped, carried back, presses dropped, the
guard and the evade after the lock, the pose without a jump; and each guarded kind answering a rebound at once) and
`tests/engine-rebound.test.js` (a fencer's shield in the engines' bundle, the blade pressed on the keys).

## Poise, tiers and states (v2.33, issue #722, `src/enemies/fight.js`)

The fight core of [design/enemy-fun.md](../design/enemy-fun.md) section A. Each archetype's fight data (`FIGHT`) beside
its moves: `mass`, `poise`, `fodder`, `low`, `follow`, `evade`, `backstep`, `alone`, `down`; the old kinds take
`fightOf`'s defaults from their def.

- **Poise, not cancel.** A light cut no longer stops a wind-up once it has begun (the old rule: the first two thirds of
  any wind-up), and the third swing no longer staggers by itself. Every blow wears poise (`poiseWear`: its damage; a
  shot or ember 1, the push 1.5, a plain block of its blow 1.5); the breakers (charged cut, riposte, dash cut, a perfect
  parry) break it at once. Broken (`Foe.breakPoise`): down `POISE.down` s (heavy 1.1), stunned, its cuts doubled and a
  cut doesn't wake it; the heron topples, the crab and toad flip (`down`), the rest hold the `'down'` lean
  (src/foe-react.js); the blade's riposte window opens (`FluidBlade.openRiposte`, `RIPOSTE_BROKEN` s, a buffered press
  counts). Worn poise comes back after `POISE.after` s untouched. Fodder (blot, skitter, moth) flinches as before.
- **Reels keep the wait.** Out of a reel a blow sent it into (`reelHit`), its cool goes on where it was (≥ 0.3 s);
  only its own blow draws a fresh one.
- **Tiers.** `Foes.add` → `Foe.toughen(stageHere)`: health × `TIER.hp[stage]` (1, 1, 1.4, 1.8, 2.2; cap 16, in
  halves), poise × `TIER.poise`; Gentle half the growth and poise × 0.8; fodder, a house's own boss (`o.def`) and a
  game's own foes (`level.foes.own`, the fight temples) never. Its def becomes its own copy (`def.hp` is its health).
- **Tempo.** `chooseAttack(d, dy, true)`: moves out of range it can walk to (`reachable`: a few metres) join the pick
  at `REACH.share` of their weight (its `backstep` move at full weight when too close); `plan` walks it there
  (`reachFor`: backing off facing you, or closing in), at most `REACH.time` s. `follow`: a missed blow (or a plainly
  guarded one, for duelists) is followed by the same move, `FOLLOW.wind` as long (never under 0.45 s), once.
  Waiting its turn (`waitTurn`): beats of circling, a feint (in at you, a lean, out again) or a taunt (a rear).
- **Defence.** `evade`: as a swing begins in front of it within 3.4 m (`env.swing`), a hop back (`hopBack`, `lift`).
  A plain block makes it stumble (shorter the heavier: `mass`) and wears poise; a parry breaks it.
- **States.** `low` once under `below`: `enrage` (`rage`: wind-ups × 0.82, never under 0.5 s; cools × 0.6; speed ×
  1.15; red eyes, `RAGE_EYE` in src/enemies/plans/kit.js, and rising steam), `flee` (to the nearest of its pack,
  which its call wakes, `RUN.time` s; a heron flies off; cornered after, enraged), `last` (its last move next: the
  roller's last roll, now at a third of its health, `cling` leaves it a sliver so a combo can't skip it; the hound's
  rake).
- **Reactions.** The alert beat (`Foe.noticed`, `ALERT.time` s, Gentle longer): it faces you, rears and flashes and
  calls (`Foes.gesture` 'alert', the attack warning's sound, short); `Foes.alarm` wakes every foe within `ALERT.pack`
  m of a wild one, any kind, each its own beat. A packmate's fall (`Foes.packFell`): those near rear and call
  (`MOURN`); the last one left flees (wildlife, `alone: 'flee'`) or rages.
- **Hits that land.** Knock-back divided by `mass` (`knockK`); the charged cut and the riposte launch walkers of
  `LAUNCH.mass` and under (`air`, knocked: off ledges and into water as KNOCK says) and knock the heavier down in place.

Measured (node, `Foes` on flat ground, each world's packs 0, 2, 3 and 4 from `packOf`, a still, a mashing and a
guarding/parrying/rolling traveller; the script lived in the issue's scratch folder): Normal, mean time to clear and
hearts lost a pack, before → after: Desert mash 4.6 s / 0.25 → 5.3 s / 0.25, guard 4.9 s / 0 → 5.4 s / 0; Buried
mash 8.5 s / 0 → 12.1 s / 2.6, guard 8.5 / 0 → 12.5 / 1.5; Signal Market mash 12.9 s / 2.6 → 22.9 s / 10.8, guard 11.3 /
0.2 → 14.7 / 2.9; a still traveller's hearts in 20 s 4.4 / 7.3 / 9.1 → 4.8 / 8.1 / 11.6. Gentle: mash 0.13 / 0.31 /
1.9 hearts, guard 0 / 0 / 0.2. Tests: tests/foe-fight.test.js.

## Armour, weak points and tiers (v2.33, issue #722, `src/enemies/fight.js`)

[design/enemy-fun.md](../design/enemy-fun.md) C11, C12 and D13 (Darknut, the Guardian's eye, BotW's colour tiers). Data
in fight.js (`ARMOUR`, `BARE`, `PLATE`, `WEAK`, `HEAD`, `TIERS`); the plates and weak points are parts of the bodies.

- **Plates.** The bell walker (3, round its bell's waist), the furnace brute (a pauldron on each shoulder and a
  breastplate), the shellback crab (2 scutes on its dome), the lamp tripod (3 round its boiler) and the crucible cart (a
  skirt over each track) wear `ARMOUR[a].plates` plates: `model.plates`, each its own mesh (`kit.js plate`/`shellPlate`,
  `userData.plate`, never merged, batched or skinned; its material `plate`, painted `PLATE_SURFACE` in
  src/enemies/surfaces.js: rivets, wear, a dull shine). Each holds `hold`: a light cut chips 1, the heavy third swing 2,
  a blow its guard took 1 (`plateBlow`); the charged cut, the riposte, the dash cut, a perfect parry, its stance or guard
  broken and a bomb knock one off at once, and so does its gun mode (`pops`: the bell the push, the brute and the tripod
  stilling, the crab an ember, the cart a plain shot; once each `PLATE.gun` s). The plate hit is the one nearest the
  blade's contact or the shot's line (`Foes.plateNear`). Glances (the bell's bronze, the crab's shell) chip plates too,
  so armour no longer only makes you wait. While any stand, `soak` of a cut's harm goes into them (brute, tripod, cart
  0.4; never while it is stunned, down, cooled or for a breaker). Chipped, a plate hangs looser (`PLATE.loose`); knocked
  off (`Foes.dropPlate`), it is hidden on the body and a copy of it (its own geometry, the kind's material) is thrown
  out, tumbles, clatters (`foeArmour`, `foeGlance`, a thud a bounce), lies `PLATE.lie` s and sinks (`Foes.updatePlates`).
- **Bare.** The last plate off (`Foe.goBare`): `ARMOUR[a].bare` is laid over its def (the bell's `clapper` off: its
  bronze no longer turns the blade; the crab's shell and tuck gone; the brute's guard gone; the tripod takes the gun), and
  it is fast and dangerous: wind-ups × `BARE.wind` (never under 0.5 s), waits × `BARE.cool`, speed × `BARE.speed`, cuts
  land × `BARE.takes`. It rears (a gold ring); tips the first time a plate falls and the first time one goes bare.
- **Weak points.** `model.weak = { obj, r, name }`: the tripod's lamp, the brute's furnace door (its brass eye), the
  bell's clapper (the winch's hook), the cart's eyes in its smoke. A target of its own for shots (`kind: 'foe-weak'`:
  the lamp stands over the boiler's sphere); the blade finds it where it meets the drawn body (`Foes.zoneOf`, a cut
  that only reached its sphere's middle never counts). Struck (`info.zone 'weak'`): its stance breaks at once, stunned
  and down `WEAK.stun` s, the bell tipped open, the riposte's window open (`Foes.poiseBroken`), a gold ring; then
  `WEAK.cool` s before that weak point does it again. Lock-on switches to it: with a foe locked that has one, R3 / Tab
  again aims at its weak point (`Foe.aimWeak`; `Foe.aim`/`aimR` for the gun's locked aim and the reticle), once more
  to the next foe; a tip the first time.
- **The head zone.** A shot whose line passes through a foe's head (its weak point, else its first gaze part's eyes,
  `HEAD.r` × its size: `headOf`, `rayNear`) is a headshot: a creature's stance breaks at once (`HEAD.cool` s between;
  meanwhile it wears it × `HEAD.wear`), fodder takes × `HEAD.fodder`. Iron that turns the gun still turns it.
- **Tiers.** `TIERS[a]`: one new move each, built from its own: `combo [a, b]` (after a, b at once, its wind-up quicker,
  once: `Foe.next`, `tierChained`), `unlock` (a skin's move in every skin) or `patch` (the bell's toll five rings, the
  brute's slam two quakes). Its tell is its body's wind-up (its pale flare went with the glow in v2.34, #733).
  Toughness `TIER_UP` over its stage's. The look: `skinOf(a, world, 1)` → `tierSkin` (palette ×
  `TIER_LOOK.dark` but its eyes, glows and lamps; its own material keys; named 'banded …') and `TIER_SURFACE`'s bands on
  every part but eyes, glows, smoke, ink and plates. A kind `'bell*'` (or `add(…, { tier: 1 })`) asks for it; from
  `TIER_FROM` (stage 3) a share `TIER_SHARE[stage]` of the non-fodder foes added (packs, sites, waves) comes in tier
  (Gentle half); `rosterKinds` adds them to the warm. Fodder has none.

Measured (node, `Foes` on flat ground, each heavy alone, the fight core's still / mashing / guarding travellers):
Signal Market (stage 4), Normal, before → after, time to clear and hearts lost: bell mash 23.9 s / 9.75 → 12.4 s / 5.25
(its glances 21.3 s → 5.2 s), guard 25.6 / 8.25 → 13.3 / 5.25; brute mash 12.6 / 5.5 → 12.8 / 4.25; tripod mash 8.0 /
1.75 → 9.9 / 2.0; cart mash 8.1 / 2.75 → 8.0 / 2.75; crab mash 24.4 / 2.5 → 14.0 / 0.75. The five in tier: mean mash
12.7 s / 3.65 hearts (base 11.4 / 3.0). Gentle: every one cleared, at most 1.3 hearts lost on average. Tests:
tests/foe-armour.test.js. Unity: `-fight armour` (engine/unity/game.js: a plated bell, three charged cuts, its banded
tier).

### The lamp tripod's light (v2.35, issue #756, `src/enemies/plans/piston.js` `SPOT`, `Foes.lampLight`)

The author: "some lamp enemies feel like they have a cone of light but it's not real light? It's just a weird floating
cone." The lamp tripod's searchlight was a solid, inked, glowing open cone 0.8-1.1 m long off its lens, lighting nothing (no
other foe has one). Now its light is light: where the lamp's axis meets the ground (three reads along it; hunting, at the
traveller's feet where the beam reaches them) a local light (`level.lights`, the shaders' eight nearest: the ground, the
traveller and any foe in it are lit, at night a warm pool, by day faintly), its reach `LAMP_LIGHT.reach` × the beam's
footprint there (half angle `SPOT.half` 0.2 rad, narrowing to `narrow` as the shutter closes), and a faint shaft of light from
the lens down to that pool (src/veil.js `LightShaft`, washes at alpha 0.035/0.055: no ink, no shadow), in every preset (the
eight lights are shared; the Handheld draws the same). Patrolling it now looks down `SPOT.patrol` 0.5 rad, its pool some
6 m before it (0.32 before: past 9 m). Off as it goes down, gone with it. The beam attack's shaft (its telegraph) is as it
was. Foes makes the level's washes (`level.veils`) if it has none, before main.js binds them.

## The makers' fencer (v2.27, issue #665, `src/enemies/plans/fencer.js`)

A sword-and-shield duelist that fights the way you do (archetype `fencer`, a machine, role `mirror`, tier 3, plan
`fencer` on the kit until v2.33; since issue #724 on the humanoid foe rig's sword-and-shield clips: docs/systems/procedural-animation.md, "The humanoid foe rig"). **No design sheet was picked** (`art: 'pending'`): it is built from
the roster's parts in the makers' high tech, kept simple to read at play distance: a little taller than you, ivory
ceramic plates over a dark frame, a narrow helm with one round lens and a fin, a kite shield with lit seams, a straight
blade with a lit edge; three skins (the Moon Foundry's furnace orange, the Space City's white and cyan with a round
shield, the Signal Market's red-lacquered champion with a long blade and a pennant). About eight draws.

- **Its shield** (`guard`, above): the light combo, the air swings and shots ring off from the front; the charged cut
  throws it wide; behind it (the dash cut, double) it is open. Between blows it steps in behind it to `close` 2.2 m.
- **The bash** (`turtle`): hold your guard up in its reach `after` 0.9 s and it bashes it aside (`guardBreak`: a plain
  block is knocked open and the blow comes through, staggering you; a perfect parry holds it and stuns it). Also its
  answer to three blows spammed at its shield.
- **Overhead** (sword high over its head, 1.0 s: side hop) and **sweep** (wound round, the sword low behind its hip,
  0.95 s: back flip). A perfect parry of either knocks its sword away (`onParry: 'disarm'`, `Foes.swordSpot`: 3.8 m off,
  away from you, flying 0.6 s): shield alone (`unarmed` shove) it runs for it (`seekSword`) and bends to pick it up
  (`disarm.pickup` 1.4 s, open: the long opening), armed again after.
- **Leap slam** (crouched behind its shield 0.95 s, then 1.15 s in the air, about 2.6 m up, landing where you stood
  at the wind-up's 60 %): a side hop, a perfect parry, or the air cut meeting it in the air (the toad's rule: on its back,
  double).
- `stout`: light cuts never break off its wind-ups (they still land while its shield is down).
- **Where**: the Moon Foundry and the City Floating in Space (packs, from the third), the Signal Market (late); a big
  lead (`COSTS` 2), never a filler; it counts as a striker under `TURNS` like any other. And the Arena (its skins' waves,
  `?level=arena&enemy=fencer@moonfoundry`).

Headless, in the Arena (`tests/fencer.test.js`): a traveller who answers (the charged cut into the shield, a parry at
every blow, cuts while it is open) beat it in 7.0 s without a blow taken (a floor: that traveller never misses a
parry); one who only spams the combo had 5 cuts turned off the shield, took 2 blows (its bash, its leap) and still won in
9.1 s (no stalemate: its cuts land while it recovers from its own blows). Measured 2026-10-25 on this branch.

## Weapons in the fist (v2.35, issue #744, `src/enemies/wield.js`)

Every armed humanoid (the grunt, the hulk, the prowler, the warlord, the mummers and their king, the sentinel, the
fencer, the shade) holds its weapon in a closed fist, aimed by what its body does: a carry off the swinging arm, each
attack's own wind-up, strike and follow-through aims, a guard's, lying along its side; both fists on a two-handed haft
(the overheads, the sweeps, the lance), the bow at the middle of its stave with its cord drawn to the other hand. The
pose is the telegraph (no glow since #733), so the weapon now reads with it: the hulk's club up and back over its
shoulder before the smash, the sentinel's blade up over its shoulder before the cut. The aims are per model (`*_HOLD`
next to each plan's moves); how the fist, the fingers and the second hand are solved: docs/systems/procedural-animation.md,
"Holding a weapon". No timing, damage, hitbox or reach changed.

Since #746 (v2.35): the other fist stays on a two-handed haft through the whole move (the warlord's last stand never
lets go, its lance's other hand ahead), the blades' edges lead their cuts (the fencer's, the warlord's, the sentinel's,
the shade's, the prowler's: the blade rolled on its haft to the cut), and no fist sinks into the ground lying down,
getting up or asleep.

## The mummers (v2.33, issue #724, `src/enemies/plans/mummer.js`)

The camp tribe of docs/design/enemy-roster-v2.md, the first humanoids on clips (docs/design/enemy-roster-v3.md; the rig:
docs/systems/procedural-animation.md, "The humanoid foe rig"). Spirits: the dark playing at being people, dressed up in
junk. Drawn to their picked sheets (a new `mummer/` and `mummerking/` folder under the enemy references).

- **The mummer** (`mummer`, tier 1, role `camp rank and file`, 2 hp, 1.1 m): a patched sack on bowed stick legs, long ink
  arms, a dented brass coffee pot for a head with two white eyes. Skins: the Desert's dune mummer (sheet 1) and the
  bleached mummer (sheet 2, met only in the Arena until the mummers take camps in the Glass Dunes). About nine draws.
- **One weapon each** (`def.weapons` by weight: club 3, spear 2, bow 1.5; `Foe.weapon`, a separate part it drops and
  picks up): a move with `attack.weapon` only with that one in hand. The **overhead whack** (club, 0.75 s: both arms up,
  the club behind its pot, leaning back; `guardDisarms`: a plain guard knocks the club out of its hands, not only a
  parry), the **spear jab** (0.7 s: the pole drawn back under its arm; a parry knocks it away), the **volley** (bow, 5-16 m,
  0.95 s: the bow sideways, the cord at its pot; a stick flies straight, no mark). Disarmed (`f.disarmed`, the fencer's
  `seekSword`): it lobs **rocks** (0.85 s, the one lob: its mark shows) and runs for its weapon.
- **Its mask** (`def.mask { below, hits }`, `Foes.maskBlow`, `Foes.unmask`): a headshot (the #722 head zone), a charged
  cut or a riposte knocks the pot flying, and so does its low change (`FIGHT.mummer.low` 'flee' under half): it drops
  what it holds, clutches its blank wet face and runs (`RUN`), then comes back blind: its blows go `BLIND.wide` (1.1 rad)
  wide of you. Its stronger tier (`TIERS.mummer`, "masked in metal") takes two headshots and whacks twice.
- **The mummer king** (`mummerking`, tier 3, role `camp chief`, 7 hp, 2.6 m, `stout`, `heavy`): a barrel chest in patched
  rag, a copper cauldron for a mask, a cart wheel for a crown, a brass horn on its back, a door beam for a club. The
  **door-beam smash** (1.1 s: the beam high over its crown, leaning back; side hop), the **royal swing** (1.1 s: the beam
  over its shoulder, its barrel twisted away; back flip), the **horn call** (`attack.horn` 25 m: `Foes.horn` →
  `Foes.alarm(f, reach)` wakes every foe within it; once when it comes on and once more at half), and **throw a
  mummer** (`attack.throwsAlly`, `def.throws`: the nearest mummer within `CARRY.reach` 5 m is picked up, held over its
  crown in its fists (`Foes.carryUpdate`; a held one skips its own mind and is left out of `keepApart`), flung along the
  lob's arc to its mark and lands dazed `CARRY.daze` 1.6 s, `Foes.landThrown`; nothing near it: no throw).
- **Where**: the Desert keeps their camp (`SITES.desert` `mummer-camp`, the blots' old fire: three mummers round it with
  their king, a mummer on the lookout; on the sand east of the salt pan since #738, which floods when the tree drinks:
  tests/route-worlds.test.js keeps every site `SITE_CLEAR.flood` 12 m past the pan's edge); a pair of mummers now and then walks the dunes (`WORLDS.desert` roster 1.5,
  `GROUP` 2, never the first pack); the king only at the camp (`WORLDS.desert.sites`: met at a site, never in a pack).
  The blot still leads: the Desert teaches. The Arena: two waves (a troupe of three; the king with two to throw).
- Their sites' idles are clips (squatting by the fire, asleep on the back, looking out: `model.ownRest`, so
  `restPose` lays nothing over them); on a slope they stand upright (`model.upright`: no `tiltRoot`), their feet reaching
  the ground's plane.

Tests: `tests/mummers.test.js` (weapons, the guarded club, the mask, the king's horn and throw, the Desert's camp),
`tests/humanoid-rig.test.js` (the rig).

## Roster v4's monsters: the grunt and the hulk (v2.34, issue #726, `src/enemies/plans/monster.js`)

The first two of [design/enemy-roster-v4.md](../design/enemy-roster-v4.md): monsters (family `monster`), one skin in
every world, its colour the tier (`tierSkin`'s darker palette and `TIER_SURFACE`'s bands: the same red or slate blue, a
step darker, banded). On the humanoid rig (procedural-animation.md, "The humanoid foe rig"), drawn to their picked sheets
(a new `grunt/` and `hulk/` folder under the enemy references). Not on any world's roster yet.

- **The grunt** (`grunt`, tier 1, role `rank and file`, 2 hp, 1.3 m, eight draws): a tomato-red monster, all head and
  belly, long pointed ears, a pig snout, two small tusks; a khaki loincloth, a leather strap with an iron ring. It
  comes with a club (`weapons` club 3, none 1.2): the **club overhead** (0.8 s, both fists high over its head: the
  sheet's pose, `PROC_POSES.overhead`; a parry knocks the club away) and the **lunge** (0.85 s, sunk low, then 3.4 m
  across the gap). Empty-handed it lobs **rocks** (0.85 s, its mark shown) and runs to a camp's **rack** (`def.racks`,
  `src/foes.js` `RACK`, `Foe.fetch`: a bow if you are further than 6 m, else a spear; gone from the rack as it is
  reserved; the bend is the mummer's pickup) for the **spear jab** (0.7 s) or the **volley** (0.95 s). With a bow or
  bare hands it keeps 7 or 6 m from you (`def.hangBack`, the `keep` back-off by weapon). Its stronger tier lunges and
  clubs at once (`TIERS.grunt` combo).
- **The hulk** (`hulk`, tier 3, role `the heavy`, 8 hp, 2.7 m, `stout`, `heavy`, nine draws): slate blue, a pale belly,
  hunched (`HULK_STANCE.hunch` over the clip's chest, its kilt kept hanging from its hips), one ivory horn, long arms, a
  hide-patch kilt on a rope belt, a long club with iron bands (no studs: the shape pass). The **smash** (1.15 s, side hop), the **sweep**
  (1.1 s, roll), the **stomp** (1.0 s: one foot raised high by its own `style` over the guard's braced stance, the arms
  flung up, `PROC_POSES.stomp`; a ring round it on the ground, `ground`: a jump clears it; its tier's sends a quake), and
  **throw a grunt** (the mummer king's `throwsAlly` and `CARRY`, `def.throws: 'grunt'`). Low, it rages.

Answers to the combat review v2.34 (docs/audits/combat-v2.34.md, recs. 1-3), in the def so later monsters reuse them:

- `shrug` (the grunt: 1): the first light cut of an exchange is taken on its belly, no harm and no poise worn
  (`Foe.hit`: a thunk, `Foes.armour`); left alone `POISE.after` s it shrugs the next one. A breaker is never shrugged.
- `answerMash` (the hulk: `{ cuts: 3, within: 1.2, attack: 'stomp' }`): three light cuts in a row, each within 1.2 s of
  the last, and it begins its stomp at once whatever it was waiting for (`Foe.answerMash`; its own wind-up, the
  telegraph rules kept).
- `whiffRecover` (the grunt: 0.45 s): after a missed blow it is at it again quickly; its waits `cool` 0.6-1.3 s.
- `fight.low.to` (the grunt: `'hulk'`): low, it runs to a hulk if one is near (`Foes.lowChange`), before any nearer
  packmate.

Measured (tests/monsters.test.js, node): a camp of four grunts (two empty-handed, a rack) against the masher (the light
combo at the blade's cadence, never guarding): 2.58 attacks begun a grunt, mean of three seeds. `Foes.look` a frame,
walking: grunt 0.03 ms, hulk 0.03 ms.

**Staged in the Desert** (`src/encounters/sites.js` `STAGED`, `withStaged`): the mummer camp's `staged.roster4` adds
three grunts and a hulk round the fire beside the mummers, with the rack by the way in (`props.js` `rack`: its spear and
bow gone as they are taken) and two of the grunts empty-handed; off by default, on with `?staged=roster4` (a camp of
more than five sits in a wider ring). The Arena: a band of three grunts, a hulk with two grunts; `-fight monsters` in
Unity.

Tests: `tests/monsters.test.js`.

**The shape pass** (v2.34, issue #726; `tests/monster-shapes.test.js`): the four monsters' bodies drawn closer to their
sheets, the rig's joints, clips, wind-ups, hitboxes and draws unchanged.

- **Lofted limbs** (`loftLimb`: rings down a joint, each an ellipse moved forward or out, eased between keys, capped; and
  `loftAlong`: a tube on a curve, its section by keys, for horns, heads, locks and hooked claws): the shoulders' and
  thighs' masses, a biceps, a forearm swelling under the elbow, a calf, a narrow ankle, instead of cylinders.
- **Grunt:** round sloping shoulders (a domed upper arm, the torso's top falling into it), long jointed clawed fingers
  (`clawHand`, shared with the hulk and the warlord), the loincloth's hem at mid-thigh so the legs show; in the
  overhead's wind-up the club tilts back over its right shoulder (`GRUNT_AIM`, `aimGrip` in the torso's frame, eased off
  as it swings).
- **Hulk:** the head bigger and thrust forward and low on a longer neck, a heavy underslung jaw (`HULK_HEAD`); the kilt
  hung from the hips (`hangFromHips`: the hips' turn, then its sway; the grunt's and the warlord's too) and close round
  them; the club banded only; the belly's shade lifted with its hue kept (`mat: { shade, shadeHue }` in its surface) so
  the light falls on it softly; in the stomp it rises on its standing leg (`liftOver`: the hips raised as far as that leg
  reaches, the foot kept by two-bone IK) and swings the other up and out (`HULK_STANCE.stomp`).
- **Prowler:** a long lofted wedge of a head and a cream jaw under it (`PROWLER_HEAD`, at 1.3 × a person's), longer crest
  spines, hooked claws on hands and feet, the blade broader and curved, carried with its flat out; its belly's and its
  steel's shade lifted (cream and steel in the back light, not grey).
- **Warlord:** lofted ram horns (`ramHorn`, `WARLORD_HORN`: a curl of 0.82 turn round its ear, its axis out and a little
  forward, broad, ridged, tapering) that stand out past its mane from the front; the mane long flat locks over a mass
  behind its head (not cone tufts), its chest's and back's the same; two-layer pauldrons (a dome, a wider plate stepped
  out under it, a lame); a bronze buckle on each greave strap; the sweep's wind-up aims the glaive over its shoulder on
  the sheet's diagonal (`WARLORD_AIM.sweep`).

Measured: the horns show 0.14 m² from the front (0.10 before) and 0.11 m² from the side (0.07); the prowler's snout 0.14
m deep 0.12 m from its tip (0.06); the hulk's face 9 cm before its chest (3 cm). Vertices: grunt 27.3k → 29.3k, hulk
20.7k → 23.3k, prowler 23.8k → 24.6k, warlord 35.1k → 34.8k (the old horns were heavy); meshes unchanged. `Foes.look` a
frame, walking (node, alternating with a607ab40c): grunt +0.005 ms, hulk +0.005 ms, prowler and warlord +0.001 ms.

Still unlike the sheets: the grunt's legs are as long as its joints allow (its knees sit higher than drawn); the
hulk's and the grunt's skin still steps from light to shade in a hard toon band; the prowler's crest is a row of spines,
not the sheet's few long ones, and its torso and neck are still plain; the warlord's mane is thinner round its face than
drawn and its glaive's blade reads as a spear head from the front.

## The makers' droids (v2.34, issue #726)

Roster v4's defunct droids ([design/enemy-roster-v4.md](../design/enemy-roster-v4.md)), drawn to their picked sheets (a new
`sentinel/`, `oracle/` and `crawler/` folder under the enemy references). One material family for all three, built once in
`src/enemies/plans/droid.js` (`droidMaterials`, `droidGlow`; the palette `DROID_PALETTE` and its tier's `DROID_TIER` in
src/enemies/skins.js; the surface `DROID_SURFACE` in src/enemies/surfaces.js): weathered ivory ceramic (soft stains, faint
grime runs, a few chips, a dull glaze) over near-black joints, amber seams, one amber eye, a little moss. The fencer and the
lamp tripod can take it later. One skin each (`desert`, `arena: true`): met only in the Arena (its waves, its foe list, the
creatures gallery) until the world rosters take them (`roster: 'v4'`). Their tier (`skinOf(a, w, 1)`): the palette dimmed,
then `DROID_TIER` over it (scorched grey-brown ceramic, red seams, a red eye: `tierSkin(s, own)`), painted with
`TIER_SURFACES` (soot and a net of red-glowing cracks) instead of the bands.

| | sentinel (2.0 m, 6 hp, tier 3) | oracle (1.8 m, 4 hp, tier 3, ranged) | crawler (0.6 m, 2 hp, tier 1) |
|---|---|---|---|
| body | the humanoid rig's clips (src/enemies/plans/sentinel.js; its walk, its sword-and-shield moves) | the rig's upper body (idle, arms by hand), no leg clips: the hips held over a ceramic shell, a bob and a lean into its drift (`HOVER_LOOK`), a ring turning round its shoulders | the kit, plan `crawler` (a trot on diagonal pairs, four legs) |
| moves (wind-up s) | thrust 0.75 (`lowThrust`), cut 0.95 (`ss_slash_1`), shield bash 0.95 (`bash`, breaks a plain guard), sudden dash 0.75 (`dashLow`, a 5.5 m rush), riposte 0.5 (`ss_slash_3`, its guard's answer) | bolt volley 1.0, then two quick bolts 0.45 (`gather`; a perfect parry sends one back), ward 0.9 (`warding`), wake 1.0 (`calling`), pulse 0.95 when you close in (`pulsing`) | bite 0.7, call 0.9 (`coil:call`, reared up), self-destruct 1.7 (`coil:blast`) |
| guard and low change | its round shield (`guard.stings` 2: two light cuts landing within `STING.gap` 1.3 s of each other snap it up at once; `blocks` 1: the next is parried and answered with the riposte); the charged cut, the riposte, a bomb break it; overload under 40 % (enrage: red, quicker) | flees under 40 % and blinks (`fight.low.blink` 7 m: `Foes.blinkAway`, the first turn off straight back from you with ground under it) | its last move under half (`cling`: a blow that would end it leaves a sliver): the fuse |

- **The ward** (the jelly's, `attack.ward`, `lanterns` 1): a beam of light from its hand to a packmate within 12 m and rings
  round it: half the harm, no staggers, 7 s; the blade across the beam half-way cuts it (`Foes.cutWard`). A foe with
  `lanterns` now sees its allies as a support does.
- **The wake** (`attack.wakes` with `horn`: the oracle 18 m, the crawler's call 16 m): offered only while a foe not yet
  provoked is within reach (`Foe.sleeper`, set by Foes each frame); `Foes.alarm` wakes them.
- **The blast** (`attack.selfDestruct`, `seek` 3.4 m/s): through its fuse it scuttles at you (its ring centred where it
  stops), the eye and seams blinking red faster and faster; at the strike's contact a ring of 2.6 m hurts (a roll's
  frames swallow it), then it is gone (`Foe.shatter`, `Foes.shatter`: a flash of its blast's size). Finished during the
  fuse, it bursts as any foe: no blast.
- **Hovering without hiding** (`keepCasting`): the oracle never goes behind cover between casts (combat-v2.34's dead time).

Tests: `tests/droids.test.js` (every move to a clip, a pose or a gait; the wind-ups pinned; the sentinel's stings and
riposte; the ward, the wake, the blink, the blast; the tier; the cost; each one's signature move against a masher in a
pack). Unity: `-fight droids` (engine/unity/game.js: the three side by side, their wind-ups, the ward and the fuse, the
tier; `unity-droids-stand|windup|moves|tier.png`). Cost: 6 meshes the sentinel, 5 the crawler, 11 the oracle (its casts
hidden until used); about 0.01 ms a foe's pose in node, 0.02–0.08 ms in Unity's V8; a pack of six in the Arena 2.3 ms CPU
a frame on this Mac (High and Deck, headless).

Still differs from the sheets: the crawler is the plan's knee-high scout (the sheet draws it nearly chest-high); the
sentinel's resting stance is the library's idle, wider-legged than the sheet's, its blade carried low and point forward (the sheet's hangs point down: it would cut into a slope); the oracle's shell is narrower at the hips
and its hands are simple; the stains are fainter washes than the sheet's.
### The prowler and the warlord (v2.34, issue #726, the third batch)

Drawn to their picked sheets (a new `prowler/` and `warlord/` folder under the enemy references), on the humanoid rig,
one skin (`desert`, `arena: true`), their tier darker and banded. Not on any world's roster.

- **The prowler** (`prowler`, tier 2, role `the quick one`, 5 hp, 1.8 m, seven draws): a lean leaf-green lizard, a long
  narrow head with a crest of spines and wide-set yellow eyes, a cream throat, belly and tail underside, digitigrade
  legs (the shin bent back to a raised hock, the instep forward to the ball of the foot: `PROWLER_SHANK`, built on the
  rig's shin, so its joints stay the traveller's), one steel shoulder guard on a strap, a short curved blade. Its tail is
  eight segments on joints of their own, sprung (`TailSpring`: a SecondOrder per segment on pitch and yaw, softer down the
  tail; the body's turn flung out through it, a lash as it winds up, kept off the ground).
  - It **circles you** at 3.4 m while it waits out its cool (`def.circles`).
  - It **back-flips** out of your swing (`fight.evade`, chance 0.45, 3 m, `flip`: its body turned over backwards about
    its hips over the hop, `time` 0.55 s, `up` 1.1 m) and, as its answer to a masher, at once on the second light cut in a
    row within 1.3 s (`answerMash.evade`, `Foe.flipAway`: out of its own wind-up too, never its strike), then darts back
    in (`then: 'dart'`).
  - The **darting slash** (0.75 s, crouched low with the blade back: the sheet's attack pose, then 3.6 m across the gap),
    the **slash** close (0.7 s), the **tail sweep** (0.85 s: side-on, then a whole turn about its feet with the tail
    straight out at knee height, `spinAngle`; a ring on the ground: jump it), the **spit** (0.95 s, a lob at 4-11 m).
  - Low, it rages. Its tier darts twice (`TIERS.prowler` combo).
- **The warlord** (`warlord`, tier 4, role `the elite`, 12 hp, 2.5 m, `heavy`, `stout`, twelve draws): crimson, a great
  cat's maned head (`WARLORD_HEAD.scale` 1.45) with two curled ram horns (lofted since the shape pass, above), rough bronze, a wide belt, a loincloth, a long
  glaive aimed in its body's frame in the held poses (`WARLORD_AIM`: upright at its side, levelled for the charge).
  - The **glaive sweep** (1.0 s, drawn back over its shoulder, `glaiveHigh`), the **overhead** (1.1 s), the **charge**
    (1.2 s: levelled like a lance, its head down; the strike runs on the library's sprint, `M.run`, 9 m, stalling on a
    wall), the **roar** (1.1 s, `horn: 25`: every one within 25 m wakes). It steps back from your swing to charge
    (`fight.evade` chance 0.3, `then: 'charge'`).
  - **Armour** (`ARMOUR.warlord`): four bronze plates, the shoulders and the greaves, hold 3, soak 0.4; knocked off,
    bare, it loses `stout` and `heavy`.
  - **Desperation** under 30 % (`fight.low` `last`, `cling`): its **last stand**, the glaive whirled round twice
    (1.3 s wind-up, a 3.4 m ring), then it sits open 1.6 s.
  - Its tier brings the overhead down out of its charge.

**The warlord's hold** (`'warlord-hold'`, `src/encounters/sites.js`): the warlord on guard before its coffer between
two banners (`props.js` `banner`), its band of grunts sat round a fire before it; the warlord noticing you does not
wake the band (`Encounters.alarm`): its roar does. The coffer pays twice (`SITE_PAYS`). Staged in Arzach, the stone
hoard becoming the hold behind `?staged=roster4` (a staged `kind` replaces the site's own).

Measured (tests/prowler-warlord.test.js, node): neither dies to one light combo at any stage or tier; against the
masher every signature move fired (four seeds each: the prowler's dart 13, flip 8, spit 4, tail 2, slash 1; the
warlord's roar 5, charge 4, whirl 2, sweep and overhead, 13 plates off, its band woken 4 of 4). `Foes.look` a frame,
walking: about 0.04 ms each. The Arena (`arena.mjs`, a still player 24 s): the prowler's wind-ups seen 0.86 s, 20
attacks a minute; the warlord's 1.13 s, 15 a minute. A pack of two prowlers and a warlord draws as a pack of two
grunts and a hulk (High 183 against 180 calls, Steam Deck 140 against 138). `-fight roster4b` in Unity.

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

## The shade (v1.18: `src/enemies/plans/humanoid.js`)

Until v1.18 the shade was the game's own skinned person drawn as a cartoon's negative, flat black with white lines and
a black flame for a head (src/shade.js `ShadeBody`, with the Sword and Shield pack's cut). The enemy roster's batch 5
reworked it onto a body of its own, archetype 19 (below, "Batch 5"): a cloak worn by nothing on two empty boots, with a
feint and a step through its shadow beside its cut. src/shade.js keeps what the shadow leaves (`ShadePools`: the pools a
blot or a shade stains the ground with where it falls, the drops, the licks) and the flame's maths and white-lined
material (tests/shade-flame.test.js); no foe draws the flame now. The white contour lives on in the new shade's smoke.

## Polish

- **Combat music** (`Sound.combat`): a drum, an off-beat tom and a low drone a fifth apart on their own bus
  under the music. It is on while a foe within 28 m chases, winds up or recovers.
- **Ink stains:** where a blot or a shade falls (`Foes.stain`), dark pools in the `ShadePools` decal.
- **The shade's slash:** an arc of black drops in front of it as it strikes (`slashTrail`).
- **The temple kit** (`templeKit`, inside the temple): a foe on a `Plate` presses it (`logic.press(id, 'foe')`);
  gusts, updrafts and pendulums act on any foe as workings (below: *Foes in the world's workings*).
- **Touch:** separate ⚔ attack, ◇ guard and ↶ evade buttons. ◉ shows only with
  `body.combat`.

## Balance and sound (v1.22, the enemy roster's step 8)

The roster's last step (docs/design/enemy-roster.md, "Build plan" 8), measured in docs/audits/combat-v1.22.md:

- **The curve** (src/foe-worlds.js): the places by stage (`BUDGET`: 1–2, 2–3, 3–5, 4–5, and the Signal Market alone at
  stage 4, 5–6), a world's own `budget` (Viridel 3–4: its moths' threes and its brutes; the Hangar 4–5: a drone and what it pulls you into; the Garden of Spheres 4–6: its
  rollers, drones and jellies are soft one by one), groups filled round from the third stage (`GROUP_COST`), and the
  late worlds' rosters weighted toward their late kinds (the Garden's centipedes, shades and halo hounds; the Market's
  alley hounds from its second pack, its parcel puppets from the third). Measured by the combat-review script's
  `--packs` (the cost of a pack in hearts against the hearts by then: `.claude/skills/combat-review/SKILL.md`).
- **The last worlds press harder** (src/foes.js): from stage 3 (the Buried Machine, the Garden, the Market) three foes
  may wind up at once instead of two and each waits three quarters as long between strikes (`TURNS.late`,
  `strikersAt`, `coolAt`), and the harm rises with the stage (`HARM_BY_STAGE`, through `Foes.harmOf`, in quarters):
  there a heavy blow lands as a crushing one (¾ → 1), and in the Market an ordinary blow as a heavy one (½ → ¾). The
  stage is the world's (`Foes.stageHere`: the Arena plays its world's when it plays a world's waves, else stage 1; the
  review script sets `foes.stage`); Gentle keeps one striker, the usual waits, and halves the harm as before.
- **The moves' niches** (src/fluid-blade.js): the light combo's third swing lands 3 (`BLADE.damage` 1, 1, 3: the quickest
  through the mid-weight foes on the ground, 4–5 hearts of health), the air cut lands double on a hovering foe
  (`AIR_MEETS`: the ray, the moth, the jelly, the drone, the marionette), the full charged cut takes 0.85 s
  (`CHARGE.full`, was 0.6), still the quickest through the heavy ones.
- **Tuning by numbers**: the cart's slag burns every 1.1 s (`SLAG.burn`, was 0.7), its pour's slag stays 4 s (was 6),
  its trail 3.5 s (was 4.5); the drone's ram is a dive, ¾ (was ½); the shade's sword cut ¾ with a 0.95 s wind-up (the
  damage table's "a shade's sword"; the telegraph rule wants 0.95 s for a heavy blow).
- **A shot that does nothing says so** (`Foe.hit` → `'glance'`): a plain shot or an ember a kind takes nothing from
  (the machines' iron, the crab's shell to a shot, the hound to a shot) glances with a spark and a tick
  (`sound.foeGlance`), and no longer interrupts a wind-up as if it had hurt; the cart's douse, the shade and the hound lit
  by an ember still land.
- **The voices**: each archetype's own hurt and burst (src/foe-voices.js; docs/systems/audio.md, "The foes' voices").

## The enemy roster (v1.8–v1.18, `src/enemies/`)

The 100 world enemies are retired: 21 archetypes take their place (22 since the ember wisp, issue #398, below "The ember wisp's fireball") (docs/design/enemy-roster.md, approved 2026-10-09),
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
    (`moth`), the **ring centipede** (`centipede`), the **lantern jelly** (`jelly`). Batch 3 (v1.13): the **bellows toad**
    (`toad`), the **stilt heron** (`heron`), the **skitter swarm** (`skitter`), the **root knot** (`rootknot`). Batch 4
    (v1.16), the possessed machines: the **furnace brute** (`brute`), the **ring drone** (`drone`), the **crucible
    cart** (`cart`), the **bell walker** (`bell`). Batch 5 (v1.18), the late spirits and the roller: the **shade**
    (`shade`, reworked), the **pearl roller** (`roller`), the **marionette** (`marionette`). **All 21 are built.**
  - `stand-in`: not built yet, an old kind runs as its body meanwhile; none since v1.18 (src/foe-kinds.js holds no
    kind, the shade's old body is retired);
  - `planned`: nothing stands in, the world tables list it and spawning passes it over; none since v1.18.
- **Skins** (`src/enemies/skins.js` `SKINS[archetype][world]`): a name, a palette, props (lichen, a beetle's
  antennae, a hermit's awning, barnacles and rope, glass facets, coral, patina; a pipe-elbow horn, coins, soot;
  crescent, driftwood, halo or wire antlers; a drill lamp, a diving bell, gyroscope rings, a cistern pump), and
  skin-only moves (`moves`: the crab's burrow in the Salt Harbour and Underwater). The first world listed is the
  archetype's own skin (the Arena's, `HOME_SKIN`). The blot's are made from each world's ground colour, its edge.
  A kind is written `kind@skin` where the skin matters (`crab@saltharbour`: `parseKind`, `skinned`); in a world
  without a skin given, an archetype wears that world's (`skinFor`; its own where the world has none).
- **The world tables** (`src/foe-worlds.js` `WORLDS`, the doc's table): each world's stage on the difficulty curve,
  its lead, its archetypes by weight, the late ones (from the third pack), the placed ones (the Desert's cistern
  pump, Lorn II's wood cutter, the Garden's glass puppet; where each stands: `PLACED`, below) and its temple
  rooms. `ROSTERS` turns them into what spawning reads (kinds: each archetype's own or its stand-in's): `wild`,
  `fill`, `first` (the lead alone), `guards`, `temple`. Packs are sized by stage (`BUDGET`: 1–2, 2–3, 3–5, 4–5, and
  the Signal Market's own 5–6 since v1.22; a world's `budget` overrides it: Viridel 3–4, the Sealed Hangar 4–5, the Garden of Spheres 4–6),
  group kinds come as a group (`GROUP`: the lizards and the hounds in pairs, moths in threes, the swarm in eight):
  alone in the first half of the route, with fillers round them from the third stage on (the group taking
  `GROUP_COST` places), and the first half of the route holds at most one ranged kind a pack. "Balance" below says
  how the curve was set.
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
  threads and lanterns on verlet chains). Batch 3's plans (phase 5): `hopper.js`, `stilt.js`, `skitterers.js`,
  `tentacled.js`; batch 4's, the machines: `brute.js` (plan 8), `hover.js` (plan 13 for a machine), `tracked.js`
  (plan 17: `src/motion-kit/machines.js` TrackDrive), `siege.js` (plan 19: machines.js Pendulum); batch 5's:
  `humanoid.js` (plan 9: the shade's empty boots, on the humanoid rig's clips since #724, its cloak on lagging springs, its ribbons on
  verlet chains as continuous skinned strips), `roller.js` (plan 16: a rippling foot by distance, the roll locked to the
  ground), `strings.js` (plan 21: a puppet hung from a knot as a pendulum, its strings one mesh skinned between the knot
  and what they hold). **Skinned on the
  kit's joints** (v1.16, `kit.js` `skinned`, `skinBy`): a body's moving parts of one material are one skinned mesh
  whose bones are the kit's own joints (a leg's thigh, shin and foot, an arm's pivots, a plate's), each tinted by its
  own colour (vertex colours), one skeleton a body; its bounds follow the joints. The machines are 6–16 meshes each,
  a skitter 5 (44 before).
- **Calm until provoked** (`def.calm`): out in the wilds (a pack: `Foes.add(kind, at, { calm: true })`) a kind with
  a calm keeps to it. Wildlife (`wild`) grazes, basks or lies about and fights only when provoked: you come within
  `provoke` m in sight, you hurt it, or one of its own near it is roused (`Foes.alarm`, `alarm` m); a shy one (the
  crab) backs away as you come near; home again it calms down. The tripod patrols its round and comes for you at
  20 m; the blot lies pooled until you are 9 m off; of the hounds, not every one hunts (`hunts`: the others stand up
  and watch you go). Anywhere else (the Arena, a temple, the tests) every kind comes for you.
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
  `Foe.pop`; its thread of light is a target half-way from its lantern (`model.lanternAt`) to the foe it guards, and a
  blade swing across it breaks the ward, the jelly keeping its lantern (`Foes.cutWard`, v1.26); it mends only in its tier-2 skins, coming down within reach); `escort` (what comes with it alone in the
  Arena: `aloneWave`); `calm.joins` (it joins any fight near it; the jelly never starts one: `provoke: 0`); the calm
  modes `circle` (the ray in its thermals, the moth round its lamp), `drift` (the jelly) and `coil` (the centipede,
  still on its rock, laid out as a crescent). The air cut (`info.air`) onto a buried worm flushes it, the blow double.
- **Batch 1:**

  | Archetype (kind) | Silhouette | Attacks (wind-up) | Answers | Calm |
  |---|---|---|---|---|
  | shellback crab (`crab`) | a low wide dome, two raised pincers, six legs splayed like a table | snap (0.75 s; a parry chips it), shell spin (1.1 s; guarded, it flips), burrow and pinch (1.2 s; Salt Harbour and Underwater only) | parry, dash cut to its side, bombs, ember; the shell glances a light cut from the front, a heavy blow bites through at half (`SHELL`, v1.41; hp 3, was 4: the author found it took too many hits) | grazes, backs away, fights at 3.2 m or cornered |
  | horn lizard (`lizard`) | long and low, a curled tail, a brass trumpet for a snout | blare (1.0 s; shoves you toward its partner), flank bite (0.8 s; only from behind you), tail whip (1.15 s; only at its back) | parry and riposte on the bite, dash cut past the blarer, split the pair | basks on its stones; territorial within 6 m |
  | antler hound (`hound`) | lean, tall, a crown of antlers wider than its body; running, a shadow | pounce (1.0 s, a crouch then the coil and a snarl; 0.8 s until v1.63), step behind (0.9 s) then bite, antler rake (1.0 s; under two thirds of its health) | ember (solid, 2), parry; the blade passes through its running shadow | lies as a shadow; some only watch |
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

- **Batch 3's fields** (v1.13): `hops` (the toad moves hop by hop: its drawn body lags the mind's position and lands each
  hop on planted feet, src/enemies/plans/hopper.js); `choke` (a shot while it winds that up, its throat swollen, bursts
  the glob: stunned `CHOKE` s, the lob lost); `leave: 'spores'` (a lob's patch that slows you `SPORES`: your own speed
  bled off, no harm); `leap` (`{ height }`: the strike is a leap onto where you stood, within `range`, up in an arc as
  its body and its target, `alt`; the air cut meets it in the air: on its back `LEAP_FLIP` s, double); `onParry:
  'open'` (any guard knocks it aside, a perfect parry longer, `OPEN`: the heron's head hangs in reach); `topples` (a
  charged cut at its legs: down `TOPPLE` s, the cuts double and it stays down; asleep in a bloom stays down the same
  way); `flock` (`{ ring, one }`: between darts it rings you at `ring` m, backing out after one, and only one of its kind
  strikes at a time) with `pile` (n of its flock near it, `Foe.mates`, climb onto it as it winds up, `Foes.pile`,
  `Foe.ride`; it topples, throwing them; the push on any of the heap scatters it) and `calm.linger` (a flock fights only
  if you stay within `provoke` m that long; run at it and it scatters, `scatter`; an ember into it sends the rest
  running); `rooted` (nothing knocks it back), `ground` (only on your feet: a jump clears the root knot's grip), `blur`
  (spores over your sight whichever way you look, no harm); the calm modes `sit` (the toad), `wade` (the heron, slow and
  wide; `shy`, it walks off; `flee`, run at it and it flies off: `Foe.takeOff` picks a landing `far` m away from you, or
  a little to one side, where there is ground and no hazard, and `Foe.flyOff` carries it there over a crouch and an arc
  `up` m high, its new home; cut in the air it falls and fights), `flock`, `root` (the root knot stands where it is).
- **Batch 3** (v1.13):

  | Archetype (kind) | Silhouette | Attacks (wind-up) | Answers | Calm |
  |---|---|---|---|---|
  | bellows toad (`toad`) | a 2.2 m pear sitting up, a throat sac in folds, heavy lids; hops | spore lob (1.2 s; the sac swells see-through, it rears; a landing mark, spores), volley (1.45 s; the City-Shaft, the Waterfall), belly flop (0.95 s; a deep shaking crouch, a leap and a ring of shock) | a shot in the swollen throat (it chokes), walk out of the mark, jump the ring, the air cut in its leap (on its back, double), close in | sits by the water; fights within 4 m |
  | stilt heron (`heron`) | nearly 5 m: a jug or a feathered egg on two stilts, an S-neck, a spear bill | spear (0.9 s; the neck drawn back into an S, 5 m), sweep (1.0 s; a foot lifted high, then a stamp), wing buffet (0.8 s; Vael) | evade aside, a guard leaves its head open, the dash cut inside its reach, a charged cut at a leg topples it | wades and fishes; walks off as you come near; fights cornered (2.8 m) |
  | skitter swarm (`skitter`) | eight knee-high domes on high-kneed legs; a speckle of humps | ripple rush (0.6 s; it rears and clicks, one at a time), pile (1.2 s; a heap grows, then topples) | any blow, a shot or the push ends one; the push scatters the heap; an ember scatters the flock | grazes in a flock; scatters if you run at it; fights if you linger in it |
  | root knot (`rootknot`) | a 3.2 m mushroom on five jointed root-arms | grip (1.0 s; two arms plunged in, the cap tipped; the soil heaves toward you, then lash), lash (0.75 s; two arms coiled back), spore puff (1.0 s; Lorn II) | jump or sidestep the heave; a cut or stilling frees you; a parry chips the lash; a bloom glob (asleep, cuts double); embers ×2 | stands rooted, its cap following you; fights at 3.6 m |

- **Batch 4's fields** (v1.16): `stout` (light cuts never stagger it, even early in a wind-up: only a charged cut, a
  riposte, a parry; the brute, the bell); a wave's `count` and `every` (`Foes.addWave` queues the rest: the bell's toll
  sends three rings); `leaveLife` (s its slag stays: the cart's pour, 6); `jams` (s a bomb on its tracks keeps it from
  turning: `Foe.jammed`, `face` does nothing); `tracks` (it drives along its heading, slower the more it must turn:
  `walkTo`); `reverse` (m it backs up through the wind-up: the ram) and `stall` (a lunge a wall stops: it stands
  stunned, open, a `stalled` event); `opens` (s it sits open after the strike: the bell tips up toward you after its
  drop, `Foe.open`); `clapper` (only the clapper takes harm: a cut or a bomb glances off the bell unless it sits open or
  is stilled); `whistle` (the bell-note whistle sounded within 26 m while it winds this up chokes it: `Foes.bellNote`
  on the game's `bell` event, `Foe.hush`, open `HUSH` s); the calm modes `stand` (the brute stands where it stopped
  working), `trundle` (the cart's old round, as a patrol), `toll` (the bell in its square, tolling softly). The
  `cracks` surface feature (src/foe-surface.js): the brute's hull, its veins opening as it is hurt (its own body
  material's `uFsCracksO`); `share` (v1.47) keeps the veins to that share of the cells' edges (each edge by its own
  hash), more of them opening as it is hurt, so only some of the cracks glow. A heavy footfall shakes the camera and the pad near it (`animKit.thump`).
- **Batch 4** (v1.16):

  | Archetype (kind) | Silhouette | Attacks (wind-up) | Answers | Calm |
  |---|---|---|---|---|
  | furnace brute (`brute`) | a 4.2 m headless egg cracked all over, violet veins, tar drips; ball shoulders, arms to the ground, short legs | slam (1.3 s; both fists over the top, the torso arched back; a quake runs 8 m), hurl (1.5 s; a slab torn up and thrown: its landing mark), sweep (1.05 s; one arm swung back) | jump the quake, a perfect parry chips it, bombs ×2, the riposte, the charged cut; stout: light cuts don't stagger it | stands rusted mid-task; wakes at 7 m |
  | ring drone (`drone`) | three plates 1.2 m across on a spindle, smoke and eyes between them, three dangling arms | harpoon (1.1 s; the plates part, a reel slides out; reels you in), ram (0.95 s; the plates lock and spin up, it rises, then dives) | guard the harpoon (the line cut, dazed), stilling drops it, the magnet glove, the hook; it hides between strikes | circles its post; always hostile (14 m) |
  | crucible cart (`cart`) | a squat pot of boiling ink on a turntable over two tracks, a smoke column with eyes | pour (1.2 s; the crucible tips, the lip glows; slag stays 6 s), ram (1.3 s; it backs up, tracks spinning; a wall stalls it) | get behind it or aside; a plain shot douses it (cuts double); a bomb jams its tracks; walls; don't follow its dripped trail | trundles its round; always hostile (10 m) |
  | bell walker (`bell`) | a 4.4 m bell in a riveted yoke on five spider legs, the spirit at the lip; a winch drum in the Salt Harbour | toll (1.6 s; reared back, the clapper swinging higher three times; three rings run out 12 m), drop (1.2 s; the legs straighten, the bell rises; it slams where you stood, then tips up open 2.5 s) | jump each ring; the bell-note whistle chokes the toll; strike the clapper while it sits open; guard the drop | stands in its square, tolling softly; always hostile (12 m) |

- **Batch 5's fields** (v1.18): `feint` (the share of the wind-up the shade's body spends on a false cut before the
  thrust: the body's alone, the mind winds the thrust up in full); `lights` (an ember lights it solid `LIT` s, `Foe.lit`)
  with `dark` (a move only while unlit: the shade's step); `at: 'beside'` (it comes up at your side: the step's blink);
  `rolls` (it rolls through the strike: a cut, a shot, an ember glance off, `Foe.rolling`), `onParry: 'bounce'` (any
  guard bounces it off stunned, `BOUNCE`), `bounces` (the walls a roll bounces off back at you before the next stalls it,
  a `bounced` event) and `shatter` (`{ speed, reach, damage, width }`: the last roll ends, or hits a wall, in a ring that
  runs out over the ground: `Foe.shatter`, `Foes.shatter`); `puppeteer` (the marionette: it sees the creatures near it,
  `Foe.allies`, and hangs back instead of hiding) with `possess` (`{ range, time }`: its strings dropped onto a creature,
  a calm one too, `Foes.possess`: the creature's eyes go black, its wind-ups × `POSSESS.wind`, light blows never stagger
  it; each string a target of kind `'rope'` the blade, the boomerang and an ember cut, `Foes.cutStrings`: it drops free,
  stunned `POSSESS.free` s, wildlife back to its calm; the marionette gone or the time out, it is let go, `Foes.unstring`),
  `alone` (a move only with nothing held and nothing near to hold: the dance) and `lift` (m/s a line that catches you
  lifts you: the yank); the calm modes `pace` (a path walked back and forth through its home, waiting `wait` s at each
  end: the shade) and `hang` (the marionette hangs where it is).
- **Batch 5** (v1.18):

  | Archetype (kind) | Silhouette | Attacks (wind-up) | Answers | Calm |
  |---|---|---|---|---|
  | shade (`shade`) | an empty hooded cloak 2.2 m to its point, two white eyes in a black hollow, wide sleeves, empty boots, ribbons trailing, the hem breaking into white-lined smoke | cut (0.9 s; the sword back over its shoulder, the hood turning to you), feint and thrust (1.3 s; the cut stopped halfway, the sword dropped to the hip; a low lane), step through the shade (1.0 s; the cloak sinks into a pool that slides round beside you; then the recut) | parry and riposte on the cut, evade the thrust sideways, an ember (solid: no step, and it burns ×2) | walks its path back and forth, waits at its ends; turns on you at 5 m |
  | pearl roller (`roller`) | a snail under a shell bigger than itself; rolled up, a perfect ball | bowl (1.0 s; the stalks sink, the shell rocks three times; a roll that bounces off one wall back at you), ricochet (1.0 s; the Garden, Space City: two bounces), last roll (1.6 s; under a quarter, spinning in place; it shatters in a ring) | guard (it bounces off stunned), sidestep it into a wall (stalled, open), jump the ring; rolling, nothing harms it | grazes; fights if hit or touched (2.4 m) |
  | marionette (`marionette`) | a thin puppet hanging a metre off the ground on four strings rising into a knot of smoke | strings (1.2 s; both arms up, fingers curling, strings unspool onto a creature: driven), yank (1.0 s; one arm rises: a line that lifts you), dance (0.95 s; alone: dropped low, legs jerked up, a whirl) | cut the strings (the air cut, the boomerang, an ember: the creature drops free), guard the yank (the line cut), cut it while it hangs slack after its dance | hangs still under arches; comes for you at 9 m; escorted by a crab in the Arena |

- **Against the sheets again** (v1.46–v1.47, issues #29, #31, #33): the skitters' bowed legs (jointedLeg's `bow`), the
  heron's flight (`calm.flee`), the toad's see-through sac and the glass puppet (makeMaterial's veil cut, rendering.md
  "Half-transparent surfaces"), the brute's lighter cracks (`cracks.share`), the bell's spirit out past its lip and its
  plated legs, the drone's wisps, the shade's flame tongues (humanoid.js `flameGeometry`), the roller's one spiral, the
  pearl shell's rocking runners and every roller's glistening trail: its model's `c.trail` lays strokes of `SLIME` behind
  its foot as it glides, the footprints' decal (src/life.js `Footprints`) with its depth over 1, so the ground under it
  shows lighter, fading; no shader of its own.
- **Retired:** the 100 world enemies (src/enemies/roster.js, models.js, their tests and capture scripts: gone from
  spawning, the Arena, the FOES list and the gallery) and the glass splinter (v1.8); the dune ray, the sign moth's old
  body and the winged blot (v1.9: the mound worm, the signal moth and the sky ray took their places; the Arena's old
  waves and Ink tide field the sky ray where the winged blot came); the spitting blot, the blot swarm and the root
  stalker (v1.13: the bellows toad, the skitter swarm and the root knot took their places in the Arena's old waves, Ink
  tide and the centipede's shed tail); the glass golem and the slag walker (v1.16: the furnace brute and the crucible
  cart took their places; the rust drone's kind is the ring drone's); the shade's old body (v1.18: the skinned person
  with the flame head, src/shade.js `ShadeBody`; the shade's kind and its flags are kept, on its new body). The
  spitting blot's spit is the blot's.
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
  **The gallery's still camera** (`src/enemies/frame.js` `GalleryFrame`): framed on the body at rest (the walk's
  progress taken off) and, showing a move, its ground; grown by every box the pose shows and eased to it, so it settles
  within the first cycle and then holds still while the creature bobs, glides or flaps in front of it (it used to be
  fitted to the body every frame, and the page seemed to ride along with a sky ray's flight). A walk is followed only
  by its steady progress; a still pose (`viewer.fixed`, the capture) is framed on that pose alone, as before. The
  orbit's yaw, pitch and zoom are the user's; the scripts that frame a wind-up on the body alone (compare.mjs,
  changelog-shots' `view.foe`) still override `m.r` / `m.height` / the group's place after `model()`.
  `tests/gallery-frame.test.js`.
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
  colour; its gloss once the light term is known): fourteen features, each compiled only where a material names it
  (`FS_*` defines, as `S_*`): `fade` (a colour along an axis: the crab's apricot claw tips), `belly` (the underside
  another colour, inked seams across it), `mottle` (two octaves of value noise), `rust` (rust and verdigris patches,
  denser low, with pits), `grain` (wood grain with pen lines), `bands` and `stripes` (rings across an axis, inked
  edges: segments, ribs, porcelain bands), `scales` (fish scales or staggered plates, triplanar, their outlines inked),
  `spots` and `spots2` (round spots, rings or six-pointed lichen stars on the surface: 8 cells of a 3D lattice, each
  spot's centre seen along the normal, so no projection and no seam), `drips`, `glow` (translucent: a light inside,
  brightest where you look straight through, a rim, a pulse, blooming), `gloss` (a crisp highlight of the sun and of
  the sky over you, off the smooth normal so a faceted blot gets a spot, not a lit facet). v1.26 added `rivets` (rows
  of rivet heads ringed round an axis, inked: the centipede's plates, the cistern jug's ochre dabs), spots `cluster`
  (the spots only in patches of a noise that many metres across, covering `clusterShare`; both layers share the
  patches: the anchor crab's barnacle crusts) and the gloss's `streaks` (the highlight cut into curving strokes round
  the part's y axis: the blot's streaked wet shine).
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

A developer's world in the worlds list, built as a real arena (v1.39; `ARENA` in the file is its plan): a round
fighting floor 80 m across of raked, packed sand, paler than the desert's, with its markings drawn on it (a border, the
waves' ring at 18 m, a centre ring and cross, sixteen ticks, a bar across each gate's mouth); round it a stone wall
1.8 m high with three tiers of stone seats stepping up behind it to 4.5 m; two gates through the stands, north and south
(behind the spawn), each between two piers under a lintel; a bronze brazier either side of each gate, its flame glowing
(no light); twelve banners, red and teal by turns, on poles along the top tier. The Ink tide sign and the hitbox board
stand at the floor's edge by the south gate, facing the middle. **Nothing stands or grows on the floor**:
`level.keepClear` (`arenaKeepClear`, the floor and the stands, 50 m) keeps the responsive world's flowers
(src/reactive-world.js), flora and wildlife off it; they bloom out in the desert beyond. The old standing stones and the
ledge with its ramp are gone (the tiers' faces are walls to climb). It is drawn in seven merged meshes (the floor with
its markings, the stone, the bronze, the flames, the poles, the two banner cloths) and adds no light, so it stays the
performance audit's quiet stage. **The markings are painted into the floor** (v1.41, the author: "shimmering arena
ground lines when approaching or walking away"; `markingsTexture`): they were strips of geometry 2 cm over the sand,
a pixel or two tall at 20 m, whose two ink edges and the colour between them fell on and off the pixels as the camera
moved, so a far ring broke into crawling dashes (aliasing, confirmed: 523 sharply changing pixels a frame on the floor's
band walking back 4 cm a frame, 0 with the markings hidden). Now a 1024² texture over the floor's disc carries them,
each texel its share of the line (coverage from the shapes' signed distances), mipmapped and filtered at a slant, in a
dark umber near the ink's (the band's fill and its edge lines one tone): 171 a frame. A faded mip chain was tried and
was worse (410–519: a half-contrast band still trips the ink pass's colour-edge test and its edge lines crawl inside
it). Building it costs ~50 ms on the Mac at load. Tests: `tests/arena-floor.test.js` (nothing on the floor inside the
wall, the markings painted where the strips were with soft edges, the wall and tiers round it and the gates open, no
light, no flowers inside). The desert's golden sand stays the
ground under it (flat out to 150 m) under an open sky. `level.foes.waves` makes
`Foes` send the Arena's foes round you, whatever the setting.

**The run** (issue #743, the default): every enemy in the game, **one at a time**, in a shuffled order
(`ARENA_FOES`, `shuffled` on the Foes' rng: `Math.random` in the game, a new order each visit; tests inject a seed).
The list is each built archetype in each of its skins (`skinWorlds`), then any kind that is no archetype's skin (the
makers' machine; a bare archetype kind is its home skin, already there): 138 now. One enemy is one body (`oneFoe`), a
pair or a trio kind alone too; the skitters come as three (`ARENA_RUN.flock`: a swarm is the foe, a lone skitter never
makes its heap, which needs two flock-mates, and falls to any cut), the jelly and the marionette with their escort
(`def.escort`: a support needs someone to ward, a puppeteer something to drive). The next comes in `ARENA_RUN.rest`
(2 s) after the last falls, with a notice ("Foe 3 of 138 · The Signal Market: coin lizard."; said as news, not paced
as a hint); after the last, "All 138 foes beaten. Again, in a new order." and a fresh shuffle. The FOES list's
choices clear the field: the run's foe taken away unbeaten comes again with "Waves again". **The battle music is
held** from the first foe in: while the Arena's waves run (not a practice of one kind, not Ink tide's own waves)
`Foes.update`'s `fighting` stays on between foes, so the battle recording never releases and starts again (paused,
knocked out or riding: off, as anywhere). Tests: `tests/arena-run.test.js`.

**The old cycle** (`ARENA_WAVES`, `arenaWave(n)`, v1.5), from a world's "Waves from here" in the FOES list
(`Foes.startWaves(world)`): first the old `WAVES` (one blot, three blots, a spitter and a blot, a swarm, a machine,
a shade, … then each world's own kinds and mixed waves), then each built archetype alone in each of its skins, then
each world's own (`worldWaves`: each of its archetypes alone in its skin, then two of its packs); then round again,
`WAVE.rest` s apart, each said ("Wave 40 · The Signal Market: 2 coin lizards."; `waveText`).
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
each time it falls. "Waves again" brings the run back where it was, "Clear the field" leaves it empty.
`?level=arena&foe=crab` (or `crab@saltharbour`) starts on one kind; in any world the console can call
`foes.spawnKind('brute@glassdunes')`. Tests: `tests/arena.test.js` (the old cycle's order, its waves in a running Arena, the
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

The loose ink takes the shape of what is round it: each world has a foe of its own, and its packs
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
  splinters share its `placed`.

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
  (`Foe.dazed`, five amber stars turning over its head: `Foes.daze`; no harm, but stunned, so a cut lands double
  and wakes it), from `KNOCK.defeat` 4.5 m it is over (a burst, a machine broken). A heavy thud, a hit-stop, a
  kick, dust, and a note the first time (flag `foes.knocked`). A gust or a pendulum carrying it off is the old
  fall (`FALL`). The charged cut throws `KNOCK.charged` 2.2× (the heavy third's).
- **Stunned, told by shape and motion** (v1.48, `stunCue`, `STUN_CUE`; combat-v1.47 rec. 5, issue #109): any stun
  (a perfect parry, a bounce off the guard, a choke, a stall, a fall, a working) shows the same stars over its head
  and a slow dizzy circle of the body (`tilt` 0.09 rad at `rate` 6.5 rad/s, eased out over its last 0.4 s), not only
  the eyes' pale blue (`#bfe9ff`, 1.01–1.10 : 1 against the eyes at rest in every simulated colour vision). The stars
  are amber (`#f0ad2e`) with the ink edge, 7–8.5 : 1 against it in all four visions, scaled to the body and set over
  it. Not asleep in a bloom (its own look), not while it winds up or strikes, not dying. Tests:
  `tests/foe-height.test.js`.
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

## The combat review's measures (`.claude/skills/combat-review/`)

What the skill's scripts measure was added review by review; the procedure is the skill's, this is why each is there
and what it found.

- **Hearts, not health** (v1.5): the watch's health a minute is in hearts over the traveller's hearts, as hurts are.
- **Guardians staged** (v1.6): their fights are staged, and scored from their tuning; `arena.mjs` draws each in an
  Arena ring, phase by phase, at 85 % of the phase's first move.
- **Guardians played** (v1.69, issues #314–#316, `guardian.mjs`): the tuning hid what the author's playtest of the Keeper
  found, so each guardian is played in its own temple in node, a still traveller, a dodger and a guard every phase:
  openings per phase (its last had none), the recovery after each strike and a combo's blow-to-blow, its hit against
  its posed mesh (13.7 m off it), the lock against its weak point (5.6 m), its shadow in its hall, and the traveller's
  sidestep locked on (1.6 m off the foe a hop). First run over the Keeper, the warden and the Elder: the Keeper passes
  (v1.69); the warden's and the Elder's blows are still shapes on the floor (up to 18.7 and 15.1 m from their bodies),
  their locks 2.4 and 2.5 m off their weak points, their combos' blows 0.92-0.97 s apart.
- **Freeing a puppet's host** (combat-v1.18 rec. 4): the wait until the strings drop, the driven host, the strings cut
  and the wait until they come again, beside the time to kill the marionette.
- **The still traveller under-reads a big pack** (combat-v1.22): looking one way, the members off the screen wait while
  another strikes. Hence `--pack-look lock` (the lock-on camera turned to whichever foe's blow comes soonest, else the
  nearest) and `--pack-clear` (the pack cleared by a scripted traveller: the cost measured, not multiplied; a floor, as
  he never misses or guards). October 2026, two packs each: the Signal Market's packs cleared in 3-7 s for none of his
  hearts where the still traveller's cost said 5 hearts; locked on, the Garden's attacks a minute went 28-68 → 56-76.
- **How flurries chain** (combat-v1.47's question): `--clear-dodge` and `--dodge-watch 30`, a pack never thinned and
  only dodged; answered by `src/flurry.js` `CHAIN` (v1.48, "The back flip, the side hop and the flurry").
- **Each kind from the spawn, struck into its face** (combat-v1.61): the dodge's hops had walked the traveller to the
  Arena's wall, where later foes stood idle (29 of 35 -> 35 of 35 once every kind starts from the spawn, in all three
  scripts); the time to kill's "front" was the line from the player, so a crab not yet turned took the combo on its
  flank (now into its face); a kind that never winds up in the whole watch is watched once more.
- **A small foe hidden behind the traveller** (combat-v1.47 rec. 3): measured by camera-qc's `foe hidden` on its
  `arena-lock` scenarios, fixed by `LOCK_VIEW` (v1.48, "Controls and the lock-on").

## Hitboxes (v0.93: `src/hitboxes.js`, `src/hitbox-overlay.js`)

A debug overlay of what the fight actually tests, for tuning and for learning the timings.
- **The switch** (`hitboxes`): F4, the dev menu's Toggles (L3 + R3, F2 or `: docs/systems/dev-tools.md),
  the Arena's board left of the way in (X / □, E: `src/levels/arena-hitbox-board.js`, its lamp lit
  while on), `?hitboxes=1` / `=0` for the session. Kept in the settings (`settings.hitboxes`).
- **Truthful by construction:** `collectHitboxes()` reads the combat code's own data, exposed through small
  getters used by the combat code too: `Foe.attackOrigin()`, `Foe.attackPhase`, `STRIKE_RISE`, `hurtRadius()`
  (foes.js); `FluidBlade.coarse()`, `.cutting` (set when `strike()` runs), `.parryLive` (what `block()` checks),
  `bladeSegment()`, `bladeTouchRadius()`, `activeRange()` (fluid-blade.js); `BOMB` (gadgets/bomb.js).
- **What it draws:** the traveller's hurt column (foes test a point at the feet, within `STRIKE_RISE` of
  height); the blade's coarse cone, its segment and the swept quad (yellow; red on the frames it cuts); the
  guard's arc (green, white in the parry window); an evade (violet; pale lavender with the label `I-FRAMES <s left>` while its i-frames are on, then `i-frames
  over`, `no i-frames (too soon after the last)` for one given none, `DODGED` once one swallowed a blow); the
  hard lock (orange diamond) or the soft lock. Each foe: its target sphere and the blade's touch ring (an archetype's
  faint and dashed: the boxes of its drawn body, `foe.body`, are what the blade meets since v1.35), sight,
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
  you winds up 0.55 s (was 0.32; `src/enemies/archetypes.js`, the hound's `bite`).
- **The buried dune ray** has a taller white-lined fin, darker turned sand, and winding up its burst it swims to
  its ring under the sand (`Foe.swimTo`, `SWIM`: there by 85 % of the wind-up, ≤ 12 m/s, through `step`), the
  fin high and throwing sand; before, it sank the fin and came up out of nowhere.
- **The swarm's** eyes are 1.7× and **the splinters** drawn 1.3×.
- **Behind the world** (`warnSpot`, `Foes.hiddenFromCamera`): a foe winding up on the screen but hidden from the
  camera by the world (a physics ray) gets the warning marker over where it is.
- **Never inside the world** (`Foes.roomAt`, `openSpot`): a pack's, a wave's and `spawnKind`'s
  spots are checked with a capsule (`physics.pushCapsule`) for its body's column; inside a solid, the next spot
  round is tried, never a guessed height.

## Accepted blade contacts (v2.04, #635)

The swept blade proposes contact, then each target decides once. An explicit `false`
rejects it; `info.dull` marks armour or an unanswered guardian state. Neither gets
the blade's wet impact, cut splash, success ripple, riposte celebration or hitstop.
An armoured foe keeps its own metallic sound and sparks at the actual contact point.
Callbacks with no return remain accepted for existing puzzle interactions. Multi-target
cuts give only accepted targets the success splash, with one shared blade impact per
contact frame. Wildlife bonks retain their smaller stop without a second impact call.
Damage, progression and per-swing target deduplication are unchanged.

Directional reactions retain their existing sizes and springs. A vertical or directionless
accepted blow uses the foe's facing to tip back, rather than an unrelated previous
hit's direction. Reduced motion and camera-shake preferences still own all camera
feedback through `feel.js`; no new freeze, shake or louder sound was added.
