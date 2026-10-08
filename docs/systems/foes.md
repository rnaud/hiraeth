# The fluid blade and the foes (v0.89)

The first things in the game that fight back, and the tool's answer to them.

## The fluid blade (`src/fluid-blade.js`)

- **Input:** F, RB / R1, touch ⚔ (`toolInput().blade`; `PadBlade` in `src/controller.js`). It comes with the
  backpack: no item, no box. It costs no charge. On a pad, LB held with the right stick still zooms.
- **The combo:** a press swings (the first cut takes 0.62 s); a press during a swing or within `BLADE.chain` after it
  chains the next, up to three: right to left, left to right, then a heavier overhead (`BLADE.damage` 1, 1, 2),
  then `BLADE.cooldown`.
- **The swings:** `SWINGS` retains anticipation through follow-through from three Mixamo clips.
  `attackSample` maps separate wind/active/recover durations (0.22/0.16/0.24 s for the first,
  0.25/0.17/0.26 for the second, 0.36/0.20/0.34 for the heavy third) onto source time.
  Grounded swings use the legs and hips; airborne cuts use the upper body. `Animator.playCombat`
  blends clip changes over 90 ms from the displayed pose, including motion matching when enabled.
  Grounded cuts step forward through Player's normal collision movement and limit steering until recovery.
- **The arm (the arcs):** the swing drives the tool's aim pose (`player.aim`, the same IK the shots use) along
  `swingArc(n, u)`, so the body turns to the swing. It turns toward the nearest target with `lock: true` within
  `BLADE.lock` (6 m), else where you face.
- **Guard:** Ctrl or Z (B also works while no gadget is owned; with one, B chooses the gadget: src/gadgets/index.js) / LB / L1 / touch ◇ independently opens the shield on the left hand (below: *In the hands*); it covers what it covers as drawn. A fresh guard has a
  0.18 s parry window (0.35 s rearm), consumes that opportunity on contact, and spends no charge.
  A held guard spends one charge per block. Both require facing the blow. A parry leaves the enemy
  open for 1.8× its normal recovery; an ordinary block for 0.65×. Guard cannot cancel an active cut.
- **Evade:** Alt / X / □ / touch ↶ moves in the input direction, or backward without input, for
  0.28 s with a 0.65 s cooldown. It uses Player's collision controller, has no invulnerability, and
  may cancel attack recovery but not wind-up or release. It is available on the ground.
  Push is a gun mode; calling a mount is LT + X (Xbox positions).
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
- **The shield** (`ShieldDevice`): the brass disc always on the hand with the backpack. `ShieldState` is the
  pure state machine (folded → opening → open → closing, and broken): it opens in `SHIELD.open` (0.16 s; the
  guard counts as up at `guardK` 0.5, unchanged), the ten ribs spinning out one after another, the fluid
  flooding out to the rim after them; held it shimmers; `hit('block')` flares it, `'perfect'` flashes it white,
  `'broken'` (a blow within its arc with the tank empty) cracks and flickers it until it mends; it folds in
  `SHIELD.close`. It swivels on the hub to face the guard's way as it opens. Sounds: `shieldOpen`,
  `shieldClose`, `shieldBreak` (src/audio.js), on the state machine's transitions.
- **Coverage is the drawn shape.** Each frame `ShieldDevice.arc` measures the bearings between the shield's two
  edges (`SHIELD.radius` + `SHIELD.slack`) as seen from the chest (`shieldArc`); `block()` tests the blow's
  bearing against that arc (`guardArc`), and the hitbox overlay draws the same arc. With no shield drawn,
  `GUARD.angle` is the arc of one held `GUARD.reach` ahead (about 55°; in the block pose the measured arc is
  about 59°, a little more to the left where the shield is held).
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
- **Knockback:** the heavy third swing throws a foe 2.2× as far.
- **Turns:** `TURNS.strikers` (2) may wind up at once (`env.mayStrike`); the others circle at a step past
  their reach. `keepApart()` pushes foes standing inside each other apart.
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

- **RB / R1** (F, ⚔) swings; **LB / L1** held (Ctrl or Z on land, 🛡) guards; **R3** (Tab, ◉) locks on.
- The push is a gun mode (`MODES.push`, always owned with the backpack): fired as a shot, it throws the cone.
- In a fight (`foes.near(20)`) LB doesn't zoom (`Controller.combat`).
- **The lock-on:** `Foes.cycleLock()` locks the nearest foe in `LOCK.reach` (those ahead of the camera
  first), then the next out, then lets go. It is lost past `LOCK.lose` or when the foe falls.
- While locked, main.js turns `rig.yaw` to keep the foe ahead, `#foe-lock` rings it, and the blade's soft
  lock and the guard turn to it first (`tool.lockOn`).

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
- **The shadow:** a new fluid kind in materials.js (`fluid: 'shadow'`, kind 5): near-black violet with streaks
  running down the body (noise over bind-space y scrolling with time) and pale runnels. It darkens toward
  the feet, which melt into print dots (bayer discard below 0.38 m), and holes drip down the body.
  `uFluidB.y` is how much has run away: 1 → 0 as it pours up out of the ground, 0 → 1 as it dies.
- **Eyes:** two pale violet glowing eyes; the brows are hidden.
- **On the floor:** drops fall off it (`ShadePools.drops`, a `Dots`), and it leaves dark pools where it walks
  (`ShadePools.pools`: a `Footprints` decal with a blob shape, so it darkens the ground and is never inked).
- **Where:** a lone shade in a later pack (`packKinds`, n ≥ 3), and in the Arena. Without the game's bodies
  (tests) it is drawn as a blot.

## Polish

- **Combat music** (`Sound.combat`): a drum, an off-beat tom and a low drone a fifth apart on their own bus
  under the music. It is on while a foe within 28 m chases, winds up or recovers.
- **Ink stains:** where a blot or a shade falls (`Foes.stain`), dark pools in the `ShadePools` decal.
- **The shade's slash:** a dark arc of drops in front of it as it strikes (`slashTrail`).
- **The temple kit** (`templeKit`, inside the temple): a blowing `Gust` shoves machines down its hall; a
  machine on a `Plate` presses it (`logic.press(id, 'foe')`).
- **Touch:** separate ⚔ attack, ◇ guard and ↶ evade buttons. ◉ shows only with
  `body.combat`.

## The Arena (`src/levels/arena.js`, `?level=arena`)

A developer's world in the worlds list: the desert's golden sand under an open sky (flat out to 150 m), standing stones, a ledge. `level.foes.waves` makes
`Foes` send `WAVES` round you, whatever the setting: one blot, three blots, a machine, two machines and two
blots, a spitter, a swarm, a machine, flyers, spitters with a machine, and a mixed last wave, round and round, `WAVE.rest` s after the last one falls.

## Tests

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
  Combat row, the Arena's board left of the way in (B / ○, E: `src/levels/arena-hitbox-board.js`, its lamp lit
  while on), `?hitboxes=1` / `=0` for the session. Kept in the settings (`settings.hitboxes`).
- **Truthful by construction:** `collectHitboxes()` reads the combat code's own data, exposed through small
  getters used by the combat code too: `Foe.attackOrigin()`, `Foe.attackPhase`, `STRIKE_RISE`, `hurtRadius()`
  (foes.js); `FluidBlade.coarse()`, `.cutting` (set when `strike()` runs), `.parryLive` (what `block()` checks),
  `bladeSegment()`, `bladeTouchRadius()`, `activeRange()` (fluid-blade.js); `BOMB` (gadgets/bomb.js).
- **What it draws:** the traveller's hurt column (foes test a point at the feet, within `STRIKE_RISE` of
  height); the blade's coarse cone, its segment and the swept quad (yellow; red on the frames it cuts); the
  guard's arc (green, white in the parry window); an evade (violet; it has no invulnerability frames); the
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
