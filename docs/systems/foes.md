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
- **The look:** a capsule of the glob's lava material from the glove along the arm (shoulder to hand, leaning
  into the swing), a pale glowing edge, and glowing drops off it as a trail. It lights for the swing and fades.
  (The game's materials draw into the G-buffer: no transparency, so the glow is the bloom's.)

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
- **Off:** the Enemies setting (`settings.enemies`). Home, the Lab, the References and the Atelier
  (`PEACEFUL`) never have any.

## The Arena (`src/levels/arena.js`, `?level=arena`)

A developer's world in the worlds list: the desert's golden sand under an open sky (flat out to 150 m), standing stones, a ledge. `level.foes.waves` makes
`Foes` send `WAVES` round you, whatever the setting: one blot, three blots, a machine, two machines and two
blots, round and round, `WAVE.rest` s after the last one falls.

## Tests

`tests/foes.test.js`:
- the mind, the telegraph and stepping out of it;
- the damage table;
- the wilds and the packs;
- the floor on a hit;
- the machines staying broken;
- the blade's arcs, its soft lock, and that only blade targets feel it.

## Left to do

- The machine's model is a first pass of boxes.
- The packs hold more (deaths, kicks, the great sword's spins and jump attacks): a charged spin could come
  from them.
- Neither foe has an animation of its own beyond the procedural wobble, walk and arm raise.
- Foes don't avoid each other.
- No foe yet uses the temple kit (gusts, updrafts) or the open world's height.
