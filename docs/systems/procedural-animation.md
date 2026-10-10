# Procedural animation for creatures and machines (research and plan, 2026-10-09)

The author: "the walking animations for all the enemies feel very stiff, like the joints don't move". This note
covers four things: what the field knows (with sources), why our foes look stiff (measured), a small locomotion
kit for Hiraeth, and a phased plan. The plan is written for the coming roster of **about 20 distinct body plans**,
which replaces the 100 near-identical world enemies; each plan is reused across worlds with that world's skin.
Phases 1–3 are built (section 6, "What was built": the kit in `src/motion-kit/` and the first three body
plans on real foes); the rest of the queue is in `TODO.md`, "Procedural animation". The review rubric and
the measuring script are in the `procedural-animation` skill (`.claude/skills/procedural-animation/SKILL.md`).

## 1. What the field knows

### Legs: two-bone IK is enough

- **Analytic two-bone IK.** The knee follows from the law of cosines; a pole vector sets which way it bends.
  Clamp the reach a little short of full length (`ε`), and take the bend plane from a stable "knee forward"
  reference rather than from the current knee, or the knee flips when the leg is straight. Daniel Holden,
  [Simple Two Joint IK](https://theorangeduck.com/page/simple-two-joint) and
  [foot locking](https://theorangeduck.com/page/inverse-kinematics-foot-locking); Ryan Juckett,
  [Analytic Two-Bone IK in 2D](https://www.ryanjuckett.com/analytic-two-bone-ik-in-2d/) (clamp the acos
  argument to [-1, 1] so a target out of reach gives the nearest pose); Max Kaufmann,
  [Procedural Animation: Inverse Kinematics](https://blog.littlepolygon.com/posts/twobone/).
  We already have two solvers of this kind: `kneeOf` (src/aliens/bodies.js, plain points) and `legIK`
  (src/feet.js, skinned bones from their rest pose).
- **FABRIK** (Aristidou & Lasenby 2011, [paper](https://www.andreasaristidou.com/publications/papers/FABRIK.pdf)):
  for chains of three or more joints (tentacles, necks, insect legs with a tarsus). It works on positions only:
  a backward pass from the target, then a forward pass from the root. In their measurements it converged in
  about 15 iterations against CCD's 26 and was roughly 10× faster. CCD tends to curl the joints nearest the tip.
  three.js ships a [CCDIKSolver](https://threejs.org/docs/pages/CCDIKSolver.html), but it only works on a
  SkinnedMesh with bones. Our foes are groups of rigid meshes, so a hand-written two-bone solve, or a 3–4 joint
  FABRIK, is cheaper and easier to control.

### Stepping: feet stay where they land

- **Rest targets and triggers.** Each foot has a home spot on the ground, fixed to the body (a little ahead
  when moving: velocity × lead time). A planted foot stays exactly where it landed. It steps when it gets too
  far from home (a distance threshold), or when it has been down too long while the body turns. The step
  lands past home by part of a stride, so the foot finishes ahead and the body walks over it. Tutorials that
  do this: WeaverDev's [procedural gecko](https://weaverdev.io/projects/proc-anim-tutorial/),
  [Procedural spider in Unreal](https://collederas.com/blog/unreal-procedural-spider/), argonaut's
  [A simple procedural animation technique](https://www.youtube.com/watch?v=qlfh_rv6khY).
  Our own stilt-walker already does all of this (`StiltMotor`, src/aliens/alien.js), and so do the traveller's
  feet (`plantFeet`, src/feet.js; docs/systems/animation.md, "Locomotion").
- **Gait groups.** Only one group of legs swings at a time; a group may lift only once the other group is down.
  - **Six legs:** a tripod of front-left, mid-right and back-left against front-right, mid-left and back-right.
    collederas keeps a `CurrentSwingTripod` flag; without it, every foot replants at once on a straight walk.
  - **Eight legs:** an alternating tetrapod, {L1, R2, L3, R4} against {R1, L2, R3, L4}. Spiders measure a
    duty factor of about 0.65 ([PMC6935789](https://pmc.ncbi.nlm.nih.gov/articles/PMC6935789/)).
  - **Four legs:** diagonal pairs (a trot), or one leg at a time (a slow walk).
  - **Two legs:** alternating, with the hips over the stance foot.
  - **Three legs** (tripod machines): a wave, one leg at a time.
- **Spore** (Hecker et al., SIGGRAPH 2008,
  [paper](https://www.chrishecker.com/images/c/cb/Sporeanim-siggraph08.pdf)) solved arbitrary creatures with a
  few parameters:
  - legs are grouped by length, and each group's cadence is set by its leg length;
  - each foot has a duty factor (the share of the cycle it is down) and a step trigger (its phase offset);
  - the step's arc is authored once, normalised, and scaled by leg length;
  - gait styles are parameter sets per speed, blended by speed and layered (limp, lumber);
  - a creature with no feet inches along.

  A 25-body creature cost about 0.2 ms on a 2008 laptop. Spore's model fits our ~20 body plans well: one kit,
  a parameter table per plan.
- **The step itself.**
  - Duration scales with leg length divided by speed.
  - The arc: the foot rises first and then travels, using a smootherstep along the way and a sine for height.
    Higher steps read as heavier or more careful.
  - At touchdown, a small dip of the body, dust, and a sound.
  - One ground ray per step (`physics.groundAt` at the landing spot, when the step starts), never one per foot
    per frame.
- **Body from feet.**
  - Height: the body sits at the average height of the planted feet plus its ride height.
  - Pitch and roll: the plane fitted through the feet (front minus back, left minus right).
  - Bob: it drops a little as each group lifts, about 2–4 % of leg length.
  - Lean: into acceleration and into turns (turn rate × speed).

  The traveller's `Locomotion` already does lean and bank (docs/systems/animation.md).

### Secondary motion: springs, chains, waves

- **Second-order dynamics** (t3ssel8r, [Giving Personality to Procedural Animations using Math](https://www.youtube.com/watch?v=KPoeNZZ6H4s);
  code transcription: [ttalexander2's gist](https://gist.github.com/ttalexander2/3b8743bf2d38d40a017e807aab43c016)).
  One filter makes any value follow its target with character, controlled by three numbers:
  - `f` sets how fast it responds (Hz);
  - `ζ` sets the damping (below 1 it overshoots, 0 wobbles forever);
  - `r` sets the initial response (above 1 it overshoots at the start, below 0 it anticipates by going the
    wrong way first).

  The coefficients are `k1 = ζ/(πf)`, `k2 = 1/(2πf)²` and `k3 = rζ/(2πf)`. Each frame:
  `y += T·yd; yd += T·(x + k3·xd − y − k1·yd)/k2s`, where `xd` is the target's velocity and
  `k2s = max(k2, T²/2 + T·k1/2, T·k1)` keeps it stable at low frame rates. This is the most useful single tool
  here. A body that follows its legs, a head that tracks you, a machine's turret that overshoots and settles,
  a wind-up that dips back before it lunges (`r < 0`): each is one filter, a few multiplies a channel.
- **Verlet chains** (Thomas Jakobsen, [Advanced Character Physics](https://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf),
  GDC 2001). Position Verlet `x' = 2x − x_prev + a·Δt²`, then a few passes of distance constraints; the root is
  pinned to the body (inverse mass 0). Good for tails, cables, antennae, cloth strips and smoke. Keep chains
  short (6–12 points, 2–4 passes, no collision) when there are dozens of foes. Our ragdoll (src/ragdoll.js)
  is the same method.
- **Follow-the-leader** (argonaut). Each point is pulled to a fixed distance behind the one before it, with
  the angle between segments clamped. One pass, head to tail, no integration. Good for serpents, centipedes
  and eels; the body outline and the fins can follow the spine's curvature.
- **Travelling waves.** For fins, wings, tentacles and flagella: `angle_i = A·sin(ωt − i·φ)·w_i`, where
  `i` is the joint's index down the chain. Speed changes ω, not the phase directly: keep a phase accumulator,
  `phase += ω(speed)·dt`, so the motion never jumps when the speed changes.

### Whole-creature approaches

- **Rain World** (Joar Jakobsson and James Therrien, GDC 2016,
  [The Rain World Animation Process](https://www.youtube.com/watch?v=-iXwvoFhPuU);
  [Unity blog](https://unity.com/blog/exploring-procedural-design-rain-world)). Each creature is a few physical
  chunks; limbs and tails are drawn over them, procedural and cosmetic, and each limb reaches for terrain.
  The animation emerges from physics plus goals, which suits soft creatures (worms, jellies, blobs).
- **David Rosen, Overgrowth** ([An Indie Approach to Procedural Animation](https://www.youtube.com/watch?v=LNidsMesxSE),
  GDC 2014). A dozen or so key poses, blended and interpolated procedurally, with physics on top, give fluid
  and responsive motion. The lesson for us: author a few strong **poses** per plan (rest, crouch, wind-up,
  strike, recover, hurt) and let the kit move between them. Don't author cycles.

### Anticipation, follow-through, telegraphs

- These are the twelve principles of animation (Thomas & Johnston; see
  [Wikipedia](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation)).
  - Anticipation: a small move the other way before a large one.
  - Follow-through: loose parts carry on after the mass stops.
  - Overlap: parts start and stop at different times.
- Jonathan Cooper, [The 12 principles in video games](https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games):
  bigger attacks get longer wind-ups; the head and torso lead and the extremities trail; push the poses
  further than life so they read at gameplay distance.
- Nicolas Kraj, [Anatomy of an Attack](https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/):
  - an attack has three phases (anticipation, attack, recovery), and each attack's anticipation must look
    different from the others;
  - minimum anticipation = reaction time (about 0.25 s) + the defence's start-up + a margin;
  - the active part should be short and clean; recovery is the player's window.
- This ties into the queued body telegraphs (TODO.md, "Combat telegraphs"): the ground zones go, so **the body
  is the telegraph**, and the locomotion kit must hand the body over to the attack pose cleanly. The feet
  plant and widen, the body sinks and coils (a spring with `r < 0` gives the counter-move for free), then
  releases. Recovery is a held, slumped pose with secondary motion settling.

### Machines vs creatures

- **Machines** move on hard curves:
  - an exponential approach (`pos += (target − pos)·(1 − e^{−k·dt})`) reads as pneumatic or servo
    ([Hackaday on Bruton's smooth servos](https://hackaday.com/2021/09/03/smooth-servo-motion-for-lifelike-animatronics/));
  - an underdamped spring with ζ ≈ 0.3–0.5 overshoots and settles like a heavy arm stopping;
  - a quantised target (a deadband, or ticks of a few degrees) reads as a stepper motor;
  - pistons slide along their axis between two pivots (aim both ends, scale or slide the rod);
  - gears turn in proportion to the joint they drive;
  - stops are hard, with a small overshoot and a 1–3 frame settle.

  Overlap comes only from genuinely loose parts: cables, a dangling hook, a spirit's smoke
  ([The Practice of Animation in Robotics](https://www.researchgate.net/publication/342828011_The_Practice_of_Animation_in_Robotics)).
  A **possessed** machine can break these rules on purpose, and that reads as the spirit inside: a joint
  twitching past its stop, a limb moving with organic lag where a servo should not.
- **Creatures** move on soft curves: critically damped or slightly underdamped springs, continuous waves
  down the body, breathing, weight shifts, and the head stabilised while the body moves.

### Cost: animation LOD

- Unreal's [Animation Budget Allocator](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-budget-allocator-in-unreal-engine)
  works like this:
  - a fixed per-frame budget (1 ms by default) shared by significance, nearest first;
  - far meshes tick every 2nd to 10th frame and are interpolated in between;
  - at most 4 off-screen meshes tick each frame;
  - state changes are held 30 frames, so nothing flickers between tiers.

  Its predecessor, [URO](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-optimization-in-unreal-engine),
  skipped frames by distance. Physics secondary motion breaks under frame skipping, so freeze it at a distance
  rather than skipping frames.
- Our own people already follow this rule (docs/systems/animation.md, "By distance"): posed every frame within
  30 m, every 2nd frame to 60 m, every 3rd to 110 m.
- A two-bone leg with stepping costs **0.63 µs per leg** on the M4 in node (40 six-legged creatures, 240 legs:
  0.15 ms a frame; scratch benchmark, no ground rays). The Retroid is perhaps 5–8× slower: about 1 ms for 40
  hexapods at full detail. That fits a budget if far foes drop tiers, and since there are rarely more than
  6–10 foes near at once, the realistic cost is well under 0.5 ms.

### The Moebius ink look

- **Hold poses; step the output.** Spider-Verse animated on twos (12 fps) by default and changed rate per
  character and shot, with no motion blur, so every frame is a clean drawing
  ([Imageworks](https://www.imageworks.com/our-craft/feature-animation/movies/spider-man-spider-verse),
  [VFX Voice](https://vfxvoice.com/imageworks-artists-break-the-mold-to-create-an-alternate-spider-verse/)).
  Guilty Gear Xrd held 3D poses with limited frames
  ([GDC 2015](https://www.gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The)). Our ink lines shimmer
  when thin parts move a little every frame (docs/systems/rendering.md, "Stable in motion"). So simulate on
  every frame, but optionally copy the pose to the meshes on a 12 or 15 fps clock per foe, phase-offset per
  foe. Telegraph poses are held for a few of those steps; fast strikes snap on ones.
- **Silhouette first.** Legs must bend visibly from the camera's usual angle (three-quarter, from above).
  Knees out and up for arthropods, knees forward for birds and humanoids, hocks back for beasts. A bend of
  under 20° doesn't read in ink.
- **Contrast of timing.** Long holds and fast moves: a crab that freezes, then scuttles; a machine that waits,
  then snaps. Constant sine motion is what reads as "a toy on a stick".
- **Contact marks.** Dust puffs, footprints (`Footprints`, as the shade's pools) and a small squash at
  touchdown make planting legible even at a distance.

## 2. The audit: why ours look stiff

Measured by `node scripts/motion-audit/run.mjs`. Each subject walks 4 s in a straight line at its own speed,
through the game's own models and `Foes.look`. The columns:

- **slide/m:** how far a foot moves over the ground while touching it, per metre walked (a leg's average).
- **worst:** the longest single contact's slide (m).
- **reach span:** how much the hip-to-foot distance changes. A rigid stick keeps one length, so it is near 0;
  a bending knee changes it by tens of cm.
- **lift:** the lowest foot's lift (m).
- **groups:** which legs swing fore and aft together.

| Subject | legs | slide/m | worst (m) | reach span (m) | lift (m) | groups |
|---|---|---|---|---|---|---|
| old machine | 3 | 0.57 | 0.87 | 0.00 | 0.05 | each alone |
| glass golem | 2 | 1.39 | 2.35 | 0.00 | 0.05 | each alone |
| salt crab (old kind) | 6 | 1.01 | 12.29 | 0.00 | 0.02 | pairs by row |
| slag walker | 2 | 1.34 | 3.46 | 0.00 | 0.03 | each alone |
| shadow hound (solid, chasing) | 4 | 0.29 | 0.70 | 0.00 | 0.11 | none (pairs 0.6 rad apart) |
| root stalker | 4 | 0.18 | 0.82 | 0.01 | 0.34 | each alone |
| world enemy, crab / mantis / shell form | 6 | 0.33–0.41 | 0.74 | 0.03 | 0.10 | [0,2,4] [1,3,5]: **all left vs all right** |
| world enemy, bird / stalker / urn / wasp / shade | 2 | 0.29–0.37 | 0.7 | 0.01–0.02 | 0.12 | alternate |
| world enemy, tripod / bell machine | 3 | 0.56–0.62 | 0.8–1.2 | 0.03 | 0.13 | two together |
| Cistern-Keeper (guardian) | 6 | 0.07 | 1.42 | 0.10 | 0.54 | a true tripod |
| sentinel / First Sign (guardians) | 3 | 0.14–0.16 | 0.6 | 0.29 | 0.2 | each alone |
| Clockwork Foreman (guardian) | 4 | 0.62 | 5.08 | 0.20 | 0.07 | each alone |
| Gardener (guardian) | 4 | 0.08 | 0.36 | 0.11 | 0.15 | each alone |

At half speed (`--pace=0.5`), the dune skitter's steps stay at **2.25 a second** (the same as at full speed),
and its slide rises to 0.49 m per metre. The world enemies' rhythm is set by the clock, not by how far they go.

Motion strips (eight frames of one cycle, side view, from `enemies.html`) show the same thing. The dune
skitter's six legs hang straight down like table legs and barely swing. The ridge-runner's two legs scissor
from the hip with a fixed knee, while its body, neck and head do not move at all.

### The causes, by family

**The 100 world enemies** (src/enemies/models.js `animate`), soon replaced, but the same mistakes would carry
over:

1. **Every leg is one rigid group.** The hip ball, thigh, knee ball and shin are built inside a single
   `T.Group`, and the walk rotates that group about x by `sin(t·7)·0.2` (±11°). The knee is modelled but never
   bends; the leg is a stick on a pivot.
2. **The rhythm is a clock.** The phase is `t·7`, where `t` is shared by every foe (`Foes.look` advances one
   `_t`). Every enemy of a kind steps in unison, at the same rate whatever its speed. The body moves at
   `def.speed` while the feet sweep at a fixed rate, so the feet skate (0.3–0.6 m of slide per metre walked).
3. **The two sides, not the gait groups, alternate.** The phase depends only on `side`, so on a six-legged
   crab all three left legs swing together against all three right legs: a waddle, not a tripod.
4. **The body ignores the feet.** The bob is `|sin(t·7)|·0.06` whatever the legs do. There is no pitch or roll
   from the feet, no lean into acceleration or turns, no settling when it stops (the walk switches off
   instantly with `moving`), and no response to ground height (the group snaps to `f.pos.y`).
5. **No secondary motion** beyond smoke strips swaying at ±0.045 rad. Heads, necks, antennae, tails and claws
   are welded to the body; wings flap as a pure sine.
6. **Attacks are one-axis rotations of the whole body or arm** (`-w·0.9 + k·1.05`). There is no anticipation
   counter-move, no weight shift onto the planted feet, no follow-through or settle. The new body telegraphs
   need exactly these.

**The 15 old kinds** (src/foes.js `look`, src/foe-kinds.js `anim`):

- the same stick legs on clock sines (the machine's three legs at ±0.35 rad);
- the salt crab's legs rotate sideways (`rotation.z`) and never leave the ground: its feet skate the whole
  12 m of the run;
- the solid hound's sticks swing ±0.7 rad at 16 rad/s whatever its speed: a blur of legs without knees;
- the blots squash and stretch, which suits a blob, but on a global clock.

**The guardians** (src/temples/guardians.js) are the best of the lot, and show the way:

- the phase advances with speed (`M.gait += dt·speed·k`), so the slide is small (0.07–0.16 m per metre);
- the keeper walks in a real tripod with a two-joint leg.

But:

- the legs are still pendulums: the foot is lowest at mid-swing, and lifts at both ends of its stride;
- the keeper's knee bends only `max(0, −sw)·0.5` (reach span 0.10 m on 4.2 m legs);
- the machines' legs swing ±0.15 rad (9°) with no knee;
- the Foreman's feet skate 5 m in one contact, because its swing is too small for its speed;
- the body heights are sines, not functions of the feet;
- the fliers (whale, moth, elder, echo) are pure sines with no lag down their fins or wings.

**Already done right in the game, and reusable:**

- the stilt-walker's planted wave gait, with 2-bone knees out and up, a body spring and a lantern pendulum
  (`StiltMotor`);
- the drifter's trailing threads (`DrifterMotor`);
- the traveller's `plantFeet` and `Locomotion`, and the hands' damped-spring lag;
- the ragdoll's position-based dynamics;
- the people's LOD schedule.

## 3. The recommended architecture: a small locomotion kit (built as `src/motion-kit/`)

(Built in `src/motion-kit/`, not `src/motion/`: that folder is the Motion page's, motion.html. The sketch below
is the plan as written; section 6 says what was built and how it differs.) The kit is pure logic over plain
vectors, tested in node like `Foe`. It writes into whatever the model exposes:
rigid `Object3D` joints, or instanced bone matrices as `StiltMotor` does. It never decides where the foe goes:
the mind (`Foe.update`) stays as it is, and the kit only draws the body following `f.pos` and `f.heading`.

```
src/motion/
  spring.js     SecondOrder (t3ssel8r's f/ζ/r, scalar + Vector3 + angle), expDamp, deadband/quantise
  ik.js         twoBone(hip, foot, lenA, lenB, pole, outKnee)  (one solver for kneeOf + legIK)
                fabrik(points, lengths, target, iters)  (3+ joints); aim(obj, from, to)  (a rigid segment)
  gait.js       GaitPlanner: feet with rest offsets, groups, duty factor, step trigger (distance/time/turn),
                lead by velocity, step arc (smootherstep travel + sine lift, height by plan), one ground ray
                per step, touchdown events (dust, sound, rumble); groups may only lift when the others are down
  body.js       BodyFromFeet: ride height over planted feet, pitch/roll from the foot plane, bob per lift,
                lean into acceleration and turns, all through SecondOrder springs
  chain.js      Chain: follow-the-leader (angle-limited) or verlet (pinned root, 2–4 passes); a wave driver
                (phase accumulator, A·sin(φ − i·k)·w_i) for fins, wings, tails, tentacles
  pose.js       PoseBlend: a plan's few named key poses (rest, coil, strike, recover, hurt, stagger) as
                per-joint targets, blended by the mind's state and k, fed through springs (anticipation r<0)
  rig.js        Rig: binds a model's joints (by role: leg chains, spine, neck, tail, wings, arms) to the above;
                LOD tiers; the stepped-output clock; one update(f, dt, ctx) per foe
```

- **The data per body plan** (a table, as Spore's): legs (hip offset, segment lengths, pole direction, group,
  phase), the gait per speed band (stride, duty factor, step height, step time), the body (ride height, bob,
  lean, spring f/ζ/r), the chains (count, length, mode, wave), the key poses, and the style (`organic`,
  `machine`, `possessed`).
- **Models expose joints instead of rigid legs.** Each leg is two or three nested groups (thigh, shin, foot),
  or bone instances as in `StiltMotor`. The model builders (src/enemies/models.js, src/temples/guardians.js)
  only need to return `{ legs: [{ hip, knee, foot, lengths }], spine, neck, tail, wings }`. The other agent
  reworking the models can adopt this shape now.
- **Hooks for telegraphs.** The mind's state drives `PoseBlend`:
  - `wind` with `k`: the coil pose; feet planted wide (the planner locks stepping); the body sinks via a
    spring with `r < 0`, so it first moves against the strike;
  - `strike`: snap to the strike pose (high f, low ζ for overshoot);
  - `recover`: slump, and let the secondaries settle.

  `ctx.telegraph` (from the body-telegraph work) adds a glow and a tremble on the striking part. Each of a
  plan's attacks gets its own coil pose, so the attacks read apart (Kraj).
- **LOD tiers** (by distance and on-screen, held for 30 frames, as Unreal's allocator):

  | tier | where | what runs |
  |---|---|---|
  | **near** | ≤ 25 m on screen | all of it, every frame |
  | **mid** | 25–60 m | planner and IK every 2nd frame; chains as waves only (no verlet); body springs kept |
  | **far** | > 60 m, or off screen | a canned phase cycle by distance walked (stick legs swung by `gait += speed·dt`, which at least never skates at a distance), no chains |
  | **hidden** | | nothing |

  The stepped-output clock (12–15 fps per foe, phase-offset) can be a style switch per plan, and it doubles as
  a saving.

## 4. The body plans (about 20) and what each needs

Each archetype is listed with its locomotion techniques and the poses its telegraphs need. Legend:
**IK2** two-bone legs; **FAB** FABRIK chains; **GP** gait planner; **BFF** body from feet; **SO** second-order
springs; **VC** verlet chain; **FL** follow-the-leader spine; **WV** wave driver; **PB** pose blend.

| # | Plan | Locomotion | Techniques | Notes for reading in ink |
|---|---|---|---|---|
| 1 | Multi-legged walker (crab/spider, 6–8 legs) | tripod / alternating tetrapod, duty 0.6–0.65 | IK2 (knees out and up), GP, BFF, SO | sideways scuttle allowed (rest targets in body frame); pincers on SO; hold-then-burst timing |
| 2 | Tiny skitterers (swarm of 5–12) | each a 6-leg GP at **mid** tier or a stepped canned cycle; one shared planner phase per group, offset per member | GP (cheap), SO | read as a ripple; per-member phase offset is essential |
| 3 | Crawler / centipede | FL spine of 8–16 segments, legs per segment in a metachronal wave (phase −i·φ) | FL, WV for legs (canned arcs), optional IK2 near | head leads, body follows path exactly: no sliding by construction |
| 4 | Slitherer / serpent | FL or lateral undulation (WV along spine, amplitude grows toward tail), head stabilised | FL, WV, SO | the head stays level and aims; strike = coil (S-curve pose) then straighten |
| 5 | Hopper (toad, flea) | ballistic hops; crouch → launch → air tuck → land squash | PB, SO (squash/stretch), BFF on landing | the crouch is the telegraph; land with a dust puff |
| 6 | Quadruped beast (hound, lizard) | trot (diagonals) / walk (lateral sequence) / gallop bound at speed; spine flexes | IK2 (hocks back on hind), GP, BFF, SO for head and tail, VC tail | head stabilised against the body bob; tail on VC |
| 7 | Stilt-walker (harvestman, heron) | wave gait, one leg at a time, long step time | IK2 (knees high), GP, BFF; the existing `StiltMotor` generalised | slow and deliberate; the sway of the high body on SO |
| 8 | Giant slow brute (golem, ogre) | biped/quadruped with long stance, big body dip at each touchdown, camera shake/rumble | IK2, GP, BFF (heavy springs: low f), PB | weight: slow f, hips over stance foot, overshoot on stops |
| 9 | Humanoid spirit (shades) | biped: the skinned `Humanoid` + `Locomotion` + `plantFeet` (as the shade does); for rigid shadow figures, biped GP + IK2 knees forward + arm swing counter-phase | IK2, GP, BFF, VC for cloak strips and smoke | float a little: feet that touch late and lift early; cloth lags |
| 10 | Shelled turtle-like | slow 4-leg walk, one leg at a time; head/legs retract into the shell (the shellback's `inK`) | IK2 (short), GP, PB, SO | retraction is the guard pose; peek out as the telegraph |
| 11 | Floater / jelly | no legs: bell pulse (scale), bob, tentacles trailing | VC or WV tentacles, SO tilt into motion (the drifter's) | pulse rate rises as the telegraph |
| 12 | Tentacled (octopus, root knot) | arms that reach and plant (FAB per arm with a planted tip), body pulled between them | FAB, GP (arms as feet, slow), SO, VC for idle arms | arms curl (FAB with a curl pole); suckers plant |
| 13 | Flyer (moth, wasp) | flap cycle by speed, body pitch from acceleration, hover bob | WV (wings, lag from root to tip), SO (body tilt, banking) | wing beat speeds up on the wind-up; dive = wings tucked pose |
| 14 | Winged glider (ray, manta, bird of prey) | slow travelling wave across the wing span, banking into turns | WV (span-wise phase), SO (bank, pitch), FL tail | the ray's wing tips lag behind the body; bank = turn rate × speed |
| 15 | Burrower (dune ray, worm) | under: a fin or mound moving (FL path of sand mounds); surfacing: PB rise | FL, PB, SO | the mound path is the telegraph (already: `swimTo`) |
| 16 | Roller (pill bug, wheel creature) | rolls: rotation = distance / radius (never slips); unrolls to a walker | none for legs; SO for wobble; PB unroll | spin locked to travel; a bump wobbles on SO |
| 17 | Tracked / wheeled machine | wheels or tracks turn by distance; body pitches on springs over bumps; a turret aims on SO (ζ 0.4, overshoot) | SO, quantised aim, pistons | servo whine; the turret settles; tracks never slip |
| 18 | Piston-legged machine (tripod, walker) | GP with mechanical rules: a rigid step arc (lift, translate, drop: three linear moves), hard stops, pistons between the thigh and the body | IK2, GP, BFF (stiff springs, ζ 0.5), pistons, quantised joints | the possessed twitch: noise on a joint past its stop; steam on touchdown |
| 19 | Siege machine (giant walker, crane, bell) | very slow GP or wheels; parts with their own lag (hanging hook, chains on VC, rotating drum) | GP or wheels, VC chains, SO, PB | the wind-up is mechanical: a winch winding, a counterweight rising: long, unmistakable |
| 20 | Blob / ink blot (existing) | squash and stretch hops, a lean into motion | SO (scale), PB | already right in spirit; move to a per-foe phase by distance |

**The guardians.** Each is one of these plans at a large scale, with more poses:

- Cistern-Keeper: plan 7/1 (six legs);
- Gardener: plan 8;
- Clockwork Foreman: plan 18 with four legs;
- First Sign and the sentinel: plan 18/19;
- Elder: plan 6 grounded, plan 14 flying;
- whale: plan 14;
- moth: plan 13;
- echo: plan 11;
- Mother Snapper: plan 4 (a neck on FL/FAB, rooted).

**What the kit needs, per technique** (so the build order follows the roster):

| technique | plans needing it |
|---|---|
| IK2 + GP + BFF | 1, 2, 6, 7, 8, 9, 10, 12, 18 and 7 guardians: **the core** |
| SO | all 20 |
| PB | all 20 (the telegraphs) |
| FL / WV | 3, 4, 11, 13, 14, 15 |
| VC | tails, cloaks, cables, tentacles |
| FAB | 12, the Snapper's neck |
| distance-locked rotation (roll, wheels, tracks) | 16, 17 |

## 5. Phased plan (after the telegraph batch)

Costs are rough working sessions for one agent, including tests and docs.

1. **Kit core** (1 session).
   - Build `spring.js` (SecondOrder with the stability clamp, expDamp, quantise), `ik.js` (twoBone replacing
     `kneeOf`; fabrik) and `gait.js` (planner, groups, triggers, arc, one ray per step, events).
   - Unit tests: the IK reaches and clamps, the pole is stable through a straight leg, the springs stay stable
     at 10–240 fps, a planted foot never moves, the groups never overlap, a tripod and a tetrapod form.
   - The motion-audit script gains a kit subject.
2. **Body and poses** (1 session).
   - Build `body.js` (ride height, plane, bob, lean) and `pose.js` (key poses blended by the mind's state, with
     an anticipation spring), plus the `wind` hooks: lock stepping, plant wide, coil.
   - Tests: the body follows the foot plane on a slope, and the coil moves against the strike first.
3. **First three plans end to end** (1–2 sessions). Multi-legged walker (1), quadruped beast (6) and piston
   machine (18), in the enemies viewer and the Arena.
   - Targets: slide/m < 0.05, reach span > 15 % of leg length, lift ≥ 6 % of leg length, the right groups.
   - Capture before/after motion strips for the changelog.
4. **Chains** (1 session). Build `chain.js` (follow-the-leader, verlet, wave) for plans 3, 4, 11, 13 and 14,
   plus tails, cloaks and cables on the plans from step 3. Done (2026-10-09, "Phase 4, the chains" above): plans 3,
   11, 13, 14 and 15 on them with the roster's batch 2; plan 4 (the serpent) waits for the Mother Snapper (phase 6).
5. **The rest of the roster** (2–3 sessions, alongside the new archetypes). Each new body plan is a table entry
   and its poses, checked with the rubric.
6. **Guardians** (1–2 sessions). Move the keeper, gardener, foreman, sentinel and sign onto the kit (legs with
   IK, bodies from feet); the fliers onto waves with lag. Give each fight's new attacks their own key poses
   (the "richer, staged fights" of the telegraph TODO).
7. **LOD and style** (1 session).
   - Add the tiers (held 30 frames) and the stepped-output clock per plan.
   - Measure on the Retroid: kit time per frame with 10 foes near and 30 far, kept under 1 ms
     (docs/systems/performance.md).
   - Re-run the motion check (docs/systems/rendering.md, "Stable in motion") for the ink shimmer.

**Total:** about 8–11 sessions, of which phases 1–3 (3–4 sessions) remove the stiffness for most of the roster.

## 6. What was built (phases 1–3, 2026-10-09)

### The kit: `src/motion-kit/`

| module | what it does |
|---|---|
| `spring.js` | `SecondOrder` (t3ssel8r's f / ζ / r with the k2 stability clamp), `SecondOrderAngle`, `SecondOrder3`, `expDamp`, `quantise`, `deadband` |
| `ik.js` | `twoBone(hip, target, lenA, lenB, pole, outKnee, outEnd)`: the pole is fixed to the body, so a straight leg never flips; out of reach it stops just short on the line to the target. `fabrik` for 3+ joints; `aim` points a segment modelled along +Y from joint to joint |
| `gait.js` | `layoutLegs` sorts feet into sides and rows and gives the groups (alternate: a tripod on 6, tetrapods on 8, diagonals on 4; wave: one at a time on 3; lateral) and each foot's neighbours. `GaitPlanner`: homes in the body's frame, drift and stance-time triggers, a group lifts only when every other foot is down (most urgent first, groups take turns), the swing shortened so no waiting foot is dragged past its reach, landings a part of a stride past home (re-aimed in the first 60 % of the swing), organic (rise, then smootherstep) or machine (lift, translate, drop) arcs, one ground ray per step, touchdown events, a seeded per-foe phase and stride, the wind-up's brace and lock (`setStance`), and the far tier's canned cycle by distance walked |
| `body.js` | `BodyFromFeet`: height from the feet on the ground, pitch and roll from their plane, a dip while a group is up (deepest mid-swing), sway over the planted feet, lean into acceleration, bank into turns, all through springs |
| `pose.js` | `PoseBlend`: a plan's rest / coil / strike / recover / hurt poses (and `coil:<attack>`, `strike:<attack>`); the coil builds with the telegraph's own timing (`coilK`: complete at `POSE_DONE` of src/telegraph.js, then held); the wind-up locks the feet and widens their homes; the strike is on a fast underdamped spring (overshoot), the recovery on a soft one; machines' yaw is quantised |
| `rig.js` | `jointedLeg` / `planLeg` build a leg as a hip pivot on the body and a chain (thigh, shin, foot, an optional telescoping piston) hung from the model's root, so the feet stay planted while the body moves. `Rig`: one `update(f, dt, ctx)` per foe (pose, planner, body; returns the body's offsets) and `write()` (IK from the drawn hip to the planted foot, segments aimed; the feet hang or tuck from the body when `ctx.air`). Tiers by distance (near ≤ 25 m; mid ≤ 60 m: the planner every 2nd frame; far: the canned cycle), held 30 frames (`TierHold`); the stepped clock (`stepped: 12`, off by default) |
| `plans.js` | the tables: `walker` (plan 1), `quadruped` (plan 6), `machine` (plan 18); lengths as shares of the leg |

The mind never calls the kit: a model's `anim` / `animate` asks its rig for the body's offsets, adds its own
wind-up moves, and calls `rig.write()` last. `Foes.animKit` hands it `ground` (the physics' ray), `touch` (a
puff where a foot lands) and `eye` (the traveller, for the tiers). The hook from the telegraphs: a wind-up
brace-steps the feet to homes 12–18 % wider (quick steps, done before the pose holds), locks them, and the coil
sits the body back and down against the strike; the strike snaps through, unlocked if it lunges.

### The first three plans on real foes

- **Walker (plan 1):** the salt crab (src/foe-kinds.js) and the 13 six-legged world enemies (forms crab,
  mantis, grub, shell, pearl: src/enemies/models.js). Knees out and up, a tripod. The crab's legs tuck for its
  spin and wave in the air when it is flipped (`ctx.air`).
- **Quadruped (plan 6):** the shadow hound (its legs hidden with its body when it sinks into its shadow,
  stretched fore and aft through the pounce) and the four newts, which now stand on four legs instead of two
  legs and two hanging arms (the horn lizard's shape). Front knees forward, hocks back, a trot.
- **Machine (plan 18):** the makers' machine (src/foes.js `machineModel`, now a hull riding on three legs) and
  the 25 possessed machines (two or three legs). Steps in three straight moves, a wave on three legs, a piston
  from the hull to each thigh.

World-enemy legs on the kit are built after the body (`kitLegs`), their feet's rest a little wider than drawn
(×1.05 walkers, ×1.3 newts, ×1.9 machines) so the knees bend. (Noticed, not changed: `animate` resets the
machines' `proportions` body scale on its first frame, so they were never drawn with it.) The enemies viewer
now really walks a foe in Moving, the view following it, so the planted feet read.

### Measured (`node scripts/motion-audit/run.mjs --pack`; `--pace=0.5` for the cadence)

| subject | slide/m before → after | worst contact (m) | reach span, % of leg | lift, % of leg | steps/s full → half | groups | pack unison before → after |
|---|---|---|---|---|---|---|---|
| salt crab | 1.02 → 0.00 | 12.31 → 0.00 | 0 → 19 % | 23 % | 2.75 → 1.50 | [0,2,4] [1,3,5] (was pairs by row) | 0.97 → −0.27 |
| dune skitter | 0.42 → 0.00 | 0.74 → 0.00 | 0.03 m → 21 % | 23 % | 2.63 → 1.38 | a tripod (was all left / all right) | 0.99 → −0.35 |
| shadow hound | 0.30 → 0.00 | 0.70 → 0.00 | 0 → 30 % | 20 % | 7.50 → 4.25 | diagonals | 0.96 → −0.01 |
| coin lizard | 0.60 → 0.00 | 1.43 → 0.00 | 0.11 m → 29 % | 22 % | 3.00 → 1.63 | diagonals (was 2 legs) | 1.00 → −0.15 |
| makers' machine | 0.60 → 0.00 | 0.86 → 0.00 | 0 → 18 % | 17 % | 2.50 → 1.25 | each alone | 1.00 → −0.28 |
| inspection tripod | 0.57 → 0.00 | 0.77 → 0.00 | 0.03 m → 27 % | 17 % | 1.67 → 0.92 | each alone (was two together) | 1.00 → −0.07 |

Before, the cadence did not follow the speed (the crab's feet never left the ground; the machine kept 1.83
steps a second at half speed). Every target is met: slide < 0.05 m/m, reach span > 15 %, lift ≥ 6 %, the
right groups, cadence by speed, packs out of step. `tests/motion-plans.test.js` holds them, and checks that a
wind-up braces and then holds the feet while the body sits back. The hound's 7.5 steps a second at a run is
high: its legs are short for 5.6 m/s (a gallop with a flight phase would be phase 5's).

**Cost** (`node scripts/motion-audit/cost.mjs`, M4, node, after a warm-up; Rig.update + Rig.write): about
**0.5 µs a leg** near (0.75 on the machines, whose pistons are aimed too): 3.1 µs per crab, 2.1 per hound, 2.3
per machine; a mixed scene of 10 foes near and 30 far costs 0.1 ms a frame. The rigid legs before cost next
to nothing. On the Retroid (5–8× slower) that is an estimated 0.15–0.25 ms for 10 foes near and 0.5–0.8 ms
for 40: within the 1 ms budget. The far tier still solves and draws the legs (only the planning and the rays
are skipped); skipping its drawing is phase 7's.

**Strips** (`node scripts/motion-audit/strips.mjs`: 8 frames over 2 s, three-quarters from above, from the
enemies viewer through the game's own models and `Foes.look`, the same drawing as the Arena):
`changelog-media/1.7/walk-{crab,skitter,hound,lizard,machine,tripod}-{before,after}.webp`. The Arena itself was
checked in headless Chrome (`?level=arena&enemy=desert/dune-skitter`): no errors, the skitter standing on its
jointed legs on the sand.

Left for later phases: chains (4: tails, antennae, cloaks), the other body plans (5), the guardians (6), the
far tier's cheaper drawing, on-screen tiers and the Retroid measurement (7); the stepped clock is built but no
plan turns it on yet.

### Moustache on the kit (src/dog.js)

The dog at home is the first creature outside the foes on the kit: `PLANS.dog` (plan 6, a longer and lower step
than the hound's, no attack poses). His mind only moves `pos` and `heading`; sitting and lying change the
planner's foot homes (it steps the feet there) and the body is lowered and pitched about the shoulders on top of
the kit's offsets. `scripts/motion-audit/walk.mjs dogSubject` leads him behind a walker:

| subject | slide/m before → after | reach span, % of leg | lift, % of leg | steps/s full → half | groups |
|---|---|---|---|---|---|
| Moustache, 1.6 m/s | 0.43 → 0.01 | 1–2 cm → 29 % | 17 % | 2.6 → 1.5 | diagonals |
| Moustache, 4.2 m/s | 0.19 → 0.00 | 2 cm → 26 % | 17 % | 5.9 → 3.3 | diagonals (was each alone) |

`tests/family.test.js` holds these and the sit, lie, sniff and wag poses.

### The enemy roster's batch 1 on the kit (2026-10-09)

The archetypes (docs/design/enemy-roster.md; docs/systems/foes.md, "The enemy roster") ride the kit through one
builder per plan in `src/enemies/plans/`: the shellback crab (plan 1, `walker.js`), the horn lizard and the antler
hound (plan 6, one rig: `quadruped.js`), the lamp tripod (plan 18, `piston.js`), the ink blot (plan 20, `blob.js`:
hops by distance). New in the kit: `src/motion-kit/chain.js` `VerletChain` (a pinned chain with a rest shape, a curl
and a stiffness: the lizard's tail, the hound's smoke; the start of phase 4), and a leg's own `lift` in `rig.js`
(that foot hangs from the body while the others stay planted: the lizard rearing for its blare, the tripod's stamp
and its possessed twitch). Measured (`node scripts/motion-audit/run.mjs --pack`, `--skins` for every skin): slide
0.00–0.01 m/m, reach span 21–36 %, lift 17–22 %, cadence halving at half speed, the right groups, packs out of step
(docs/audits/combat-v1.8.md, "Motion"); `tests/motion-plans.test.js` holds each archetype in two skins.

### Phase 4, the chains, and the roster's batch 2 (2026-10-09)

`src/motion-kit/chain.js` gains the three chains of §1 ("Secondary motion"), each pure maths over THREE.Vector3:

- `PathTrail`: the leader's path as a polyline (a point every `spacing` m, `length` m long); `at(s)` is the point s m
  back along it and its heading there, `travelled` the distance walked. A body whose parts sit at fixed arc lengths
  on it follows its head exactly: nothing slides sideways, by construction. `seed()` lays a rest shape out behind the
  head (the centipede's coil).
- `FollowChain`: follow-the-leader with an angle limit per joint (and an optional straightening): tails and whips.
- `Wave`: a travelling wave on a phase accumulator (`angle(i, amp, lag)`); the rate may change any frame without a jump.

and `src/motion-kit/wave-legs.js` `WaveLegs`: legs in a metachronal wave, each leg's phase its own segment's arc
length over the stride, minus a lag down the body, a half cycle between a pair's left and right; planted in stance,
an arc in the swing to half a stance past its rest, one ground ray at touchdown. Standing still, the phase stands.

The plans on them (`src/motion-kit/plans.js`; `src/enemies/plans/`):

| plan | archetype | how it moves |
|---|---|---|
| 3 centipede | ring centipede | 12 segments on the head's `PathTrail`, 24 two-bone legs (knees out and up) on `WaveLegs`; the plates rock with the wave; antennae on `FollowChain`s; the ring's wind-up quickens the wave (the legs' clock runs 1.6× the distance: shorter steps, never a slide) |
| 15 burrower | mound worm | under: six mounds on the head's path and a fin; up: seven rings stacked as a spine bent by the pose, a slow `Wave` up it, rising on a spring with `r < 0` (it dips first) and slumping back through its recovery |
| 14 glider | sky ray | each wing four nested strips turned by one `Wave` (0.45–1.3 beats/s by speed, the tip 2.1 rad behind the root); bank = turn rate × speed on a spring, pitch from acceleration; the skim sweeps the wings back and stills the beat; the tail a 9-link `FollowChain` |
| 13 flyer | signal moth | upright; each kite wing three nested strips turned about the upright by a `Wave` (2.4–3.6 beats/s by speed, the outer edge 1.1 rad behind), swept back as it flies, open and still to flash, wrapped round the lantern to dart; antennae on `FollowChain`s, its six hooked legs on `VerletChain`s |
| 11 floater | lantern jelly | the bell's pulse on a `Wave` (0.55/s drifting, 2.4/s through a wind-up: the telegraph), a bob, a tilt into its drift; 12 threads and 3 lanterns on `VerletChain`s; the curtain drops the threads to the ground |

Measured (`node scripts/motion-audit/run.mjs centipede --pack`, `--pace=0.5`; `node scripts/motion-audit/chains.mjs`):
the centipede's legs slide 0.00 m/m (worst 0.00 m), reach span 36 % of the leg, lift 42 %, 8.75 → 4.38 steps/s at half
speed, a pair's legs never in one group, two side by side out of step; the centipede's segments and the worm's mounds
keep to their heads' weaving path (0.000 m off); the ray beats 1.17/s at full speed and 0.80/s at half, the moth 3.58
and 3.07; the jelly pulses 0.55/s drifting and 2.38/s winding up. `tests/motion-chains.test.js` holds the chains and
these measures; `tests/motion-plans.test.js` the centipede's legs in two skins.

### Phase 5, the rest of the roster: batch 3 (2026-10-09)

Four more plans, each a table entry in `src/motion-kit/plans.js` and its body in `src/enemies/plans/`, with three small
additions to the kit (`src/motion-kit/rig.js`):

- **A third segment** (`jointedLeg`'s `lenC`, a plan's `knee.lenC`): a root-arm with two bends, solved by FABRIK
  (`ik.js fabrik`) from a guess curled toward the pole each frame (`Rig.solveChain`: the first joint up and out, the
  second over the tip, the end started off the target so FABRIK runs), so the bends keep their side frame to frame.
- **A detail tier floor** (`Rig`'s `tier`, a plan's `tier: 'mid'`): a swarm's members plan every second frame even
  close by (IK every frame).
- **A hopper's landing** (`ctx.landHome`): off the air, the feet plant at their homes, not spread over a stride.
- **The bird's pole** (`poleFor('back')`): the joint halfway down a stilt bends back.

| plan | archetype | how it moves |
|---|---|---|
| 2 skitterers | skitter swarm | six two-bone legs (long for the short hip-to-foot span, so the knees ride up level with the dome) in a quick tripod (swings 0.05–0.16 s) at the mid tier; fast underdamped body springs (it twitches); the rush rears it on its back legs with the front pair lifted; in a heap (`Foe.ride`) its legs hang and it rides its level |
| 5 hopper | bellows toad | its drawn root lags the mind's position and hops: a crouch (0.14 s), a 0.36 s arc to where the mind will be by then, a squashed landing with dust, at least 0.3 s down; it hops once it lags 0.62 m (by a share of its own: two toads never hop together), so a slower toad hops less often; between hops the kit only settles its feet; in the air (and on its back) they tuck; the belly flop's leap is the mind's own (`attack.leap`, `alt`) |
| 7 stilt | stilt heron | StiltMotor's rules (src/aliens/alien.js) as the kit's table: two legs one at a time with a long slow swing (0.3–0.62 s), the bird's joint two thirds up bending back, the high body on a soft spring (f 1.5, ζ 0.38) and its own pendulum that lags a change of pace, a turn and a blow; the S-neck ten segments on a Catmull-Rom curve blended between key shapes (rest, the spear's S drawn back, the thrust, down to the water), the head along the key's direction; the sweep lifts one leg (`leg.lift`), the stamp turns the body round on the other |
| 12 tentacled | root knot | five three-segment root-arms as feet, one at a time round the ring (the `wave` gait, swings 0.28–0.6 s); the body carried between them on slow springs; the grip and the lash lift two front arms on their own (`leg.lift` with an arcing `air`); the cap follows you on its own pivot |

Measured (`node scripts/motion-audit/run.mjs toad heron skitter rootknot --pack`, `--pace=0.5`): the toad's feet slide
0.00 m/m (its hops 1.25/s at full speed, 1.00 at half; two toads out of step), the heron's 0.01 (worst 0.03 m, reach span
31 %, lift 13 %, one leg at a time, 0.75 → 0.38 steps/s), the skitter's 0.00 (reach 53 %, lift 18 %, the tripod, 5.88 →
3.13 steps/s), the root knot's 0.02 (worst 0.04 m, reach 29 %, lift 14 %, one arm at a time, 0.90 → 0.65).
`tests/motion-plans.test.js` holds these (two skins of the heron and the toad); `tests/motion-kit.test.js` the
three-segment arm, the bird's joint, the mid tier and the hopper's landing.

### Phase 5, the machines: batch 4 (2026-10-09)

Four more plans for the roster's possessed machines, each a table entry in `src/motion-kit/plans.js` and its body in
`src/enemies/plans/`, with two kit pieces (`src/motion-kit/machines.js`) and a way to draw a body cheaply:

- **TrackDrive** (plan 17): each side's belt runs by the distance that side covered (the body's travel along its heading,
  plus or minus its turn times half the gauge), so a track never slips and a turn on the spot runs the belts opposite
  ways; the road wheels turn by that run over their radius; the chassis pitches and rolls on springs over the ground
  under its four corners (two rays every other frame). The belts' treads are painted (`bands`, their offset the run; the
  upper run's joint bound unturned and turned round after, so its treads run the other way).
- **Pendulum** (plan 19): a weight on a rod hung from a moving pivot, two small angles driven by the pivot's
  acceleration in its own frame, damped, kicked to swing it higher.
- **Skinned on the kit's joints** (`src/enemies/plans/kit.js` `skinned`, `skinBy`): a body's moving parts of one
  material become one skinned mesh whose bones are the joints the kit already moves (thigh, shin and foot groups, arm
  pivots, plates), one skeleton a body, the parts' own colours kept as vertex tints, bounds that follow the joints. Each
  machine is 6–16 meshes, and the skitter (batch 3) went from 44 to 5 with its motion unchanged. The motion audit reads a
  skinned leg's lowest vertex through the skin (`scripts/motion-audit/walk.mjs lowest`).
- **The legs' joints** (`jointedLeg`'s `balls` and `taper`): smaller knee balls and a stouter shin for a heavy leg.

| plan | archetype | how it moves |
|---|---|---|
| 8 brute | furnace brute | two short legs, the knee forward (pole `forward`), a long slow step (0.38–0.72 s); the body on soft underdamped springs (f 1.5–2.1, ζ 0.32–0.42): it dips deep at each footfall and overshoots when it stops, its hips shift over the standing foot (sway 0.55); each footfall a thump (`animKit.thump`: a camera kick and the pad's rumble within 10 m); its long arms swing from the shoulders against the legs by the distance walked; the slam's both fists over the top, the hurl's bend and lift, the sweep's arm swung back are its poses (`coil:hurl`, `coil:sweep`) |
| 13 hover (a machine's) | ring drone | no wings: it bobs on springs, tilts into its drift with a servo's overshoot (ζ 0.35), turns in notches (0.12 rad); its three plates spin at their own speeds, part and slow for the harpoon, lock and spin up for the ram; its arms dangle and lag its moves on springs, folding up when it is low |
| 17 tracked | crucible cart | TrackDrive; the turret on a slow angle spring (f 1.1, ζ 0.4: it overshoots and settles) in notches; the crucible tips on its trunnions on a spring; the smoke column a chain of puffs on their own joints, swaying and leaning with the pour; the ram's wind-up runs the belts in place (gravel off the back) |
| 19 siege | bell walker | five spider legs round a hub, one at a time round the ring (`wave`), a slow step (0.32–0.6 s) in a machine's three straight moves, a short thigh up to a high knee and a long shin to a point (knee 0.4 / 1.08); the bell swings on its yoke and the clapper inside it, two pendulums driven by the hub; the toll rears it back on its rear legs (the front ones lift: `leg.lift`) and drives the clapper higher three times; the drop straightens its legs (`coil:drop`) and its leap is the mind's (`attack.leap`) |

Measured (`node scripts/motion-audit/run.mjs brute bell --pack`, `--pace=0.5`): the brute's feet slide 0.01 m/m (worst
0.03 m, reach span 23 %, lift 14 %, one leg at a time, 1.38 → 0.75 steps/s), the bell's 0.00 (worst 0.05 m, reach 36 %,
lift 20 %, one leg at a time round the ring, 0.70 → 0.45). `tests/motion-plans.test.js` holds these (two skins of
each); `tests/motion-kit.test.js` the tracks and the pendulum.

## Measuring

- `node scripts/motion-audit/run.mjs [ids…] [--all] [--pace=0.5] [--json]` walks the old kinds, a sample of
  the world enemies and the legged guardians, and prints the table above.
- The pure measures are in `scripts/motion-audit/metrics.mjs`: foot slide in contact, contact share,
  cadence, reach span, joint angle, gait groups by fore-aft correlation, and travel.
- `tests/motion-metrics.test.js` checks them on hand-made gaits: a planted foot, a dragged stick, a tripod
  against both sides in phase.
- A model on the kit adds its subject to the script's `OLD` / `GUARDIANS` tables (now in `walk.mjs`): where its legs are.
- `--pack` walks two of a kind side by side (unison: 1 is in step), `--cost` times the kit per foe;
  `cost.mjs` is the proper benchmark, `strips.mjs` the motion strips (one Vite on 5357, one muted Chrome on 5407).
