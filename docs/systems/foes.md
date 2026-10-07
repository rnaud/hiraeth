# The fluid blade and the foes (v0.87)

The first things in the game that fight back, and the tool's answer to them.

## The fluid blade (`src/fluid-blade.js`)

- **Input:** F, LB / L1, touch ⚔ (`toolInput().blade`; `PadBlade` in `src/controller.js`). It comes with the
  backpack: no item, no box. It costs no charge. On a pad, LB held with the right stick still zooms.
- **The combo:** a press swings (`BLADE.swing` 0.3 s); a press during a swing or within `BLADE.chain` after it
  chains the next, up to three: right to left, left to right, then a heavier overhead (`BLADE.damage` 1, 1, 2),
  then `BLADE.cooldown`.
- **The swings, from motion capture:** `SWINGS` plays the cut of three clips from Mixamo's Sword and
  Shield pack on the upper body (`player.swingMove`, `Animator.playUpper`), 1.5× as fast, the hit at the
  hand's fastest: `ss_slash_1` (right to left, down), `ss_slash_3` (a rising backhand), `ss_attack_1`
  (overhead). The blade sits in the fist then (`GRIP`, the hand bone's +z leaning along +y), and the aim
  pose only turns the body (`aim.noArm`). Until `moves.glb` has loaded, the arcs below stand in.
- **The arm (the arcs):** the swing drives the tool's aim pose (`player.aim`, the same IK the shots use) along
  `swingArc(n, u)`, so the body turns to the swing. It turns toward the nearest target with `lock: true` within
  `BLADE.lock` (6 m), else where you face.
- **The guard (hold the button):** once the swing is done, the left arm comes up (the pack's block idle,
  round and round) and a lens of fluid with a bright rim blooms over the forearm, turned to the nearest foe;
  you walk slowly and can't sprint. `blade.block(from)` (as `player.guard`): a strike from within `GUARD.angle`
  of the guard's way is blocked for a charge, no harm, the arm takes the blow (the pack's block), and the foe
  reels (`Foe.staggered`: open 1.6× as long). Behind you, or with the tank empty, it gets through.
- **The flinch:** a strike that lands without knocking you down plays the pack's impact on the upper body
  (`Player.flinch`, `FLINCH`).
- **What it hits:** at `BLADE.hitAt` of the swing, `bladeHits()` takes the targets in a cone (`reach` 2.9 m,
  half-angle 1.15 rad) that list `'blade'` in `accepts`. Nothing else feels it: people, switches and the story's
  puzzles don't (a blade is not a splash). Wildlife in the cone scatters (`push`).
- **The look:** a sword. A flat two-edged blade (`BLADE.length` 0.85 m, `width` 5 cm, extruded from an
  outline tapering to a point) of the glob's lava material in the tank's tones, its edges bright glowing lines,
  on a hilt: a brass guard, a wrapped grip in the fist and a brass pommel. The blade grows out of the guard as
  it lights for a swing and fades after. It is turned each frame so its edge leads the cut (its width along the
  hand's motion), and a fine trail of small sparks follows the edge. (The game's materials draw into the
  G-buffer: no transparency, so the glow is the bloom's.)

## The foes (`src/foes.js`)

`FOES` holds the tuning. Each foe is a `Foe` (pure logic over plain vectors, tested in node) drawn by `Foes`,
which also registers its target (`kind: 'foe', lock: true, accepts: ['blade', 'stun', 'fire']`).

- **The mind:** idle (drifting round home), then chase once you are in sight, then wind up in reach (the
  telegraph: `Telegraph` from `src/temples/boss.js`, drawn on the ground, filling), then strike (it lands only
  inside the drawn area: `inArea`), recover, and chase again. It goes home past `giveUp`, healing.
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
- **Perfect parry:** a guard up less than `GUARD.perfect` (0.3 s) when the strike comes costs nothing and
  stuns the foe `PARRY_STUN` s.
- **Combos:** a stilled foe takes the blade double (and the stilling breaks); a push ends a swarm blot.

## The shade (`src/shade.js`)

A person made of living shadow (`FOES.shade`: 5 hp, a sword's cone).
- **Body:** the game's own skinned body (`buildCharacter`, `Humanoid`, `Animator`, `Locomotion`, as an NPC's).
  It walks where its mind went, and plays the Sword and Shield pack's attack (`SHADE_STRIKE`): up to the cut
  as it winds up, then the follow-through as it recovers.
- **The shadow:** a new fluid kind in materials.js (`fluid: 'shadow'`, kind 5): near-black violet with streaks
  running down the body (noise over bind-space y scrolling with time) and pale runnels. It darkens toward
  the feet, which melt into print dots (bayer discard below 0.38 m), and holes drip down the body.
  `uFluidB.y` is how much has run away: 1 → 0 as it pours up out of the ground, 0 → 1 as it dies.
- **Eyes:** two pale violet glowing eyes; the brows are hidden.
- **On the floor:** drops fall off it (`ShadePools.drops`, a `Dots`), and it leaves dark pools where it walks
  (`ShadePools.pools`: a `Footprints` decal with a blob shape, so it darkens the ground and is never inked).
- **Where:** a lone shade in a later pack (`packKinds`, n ≥ 3), and in the Arena. Without the game's bodies
  (tests) it is drawn as a blot.

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
- Neither foe has an animation of its own beyond the procedural wobble, walk and arm raise.
- Foes don't avoid each other.
- No foe yet uses the temple kit (gusts, updrafts) or the open world's height.
