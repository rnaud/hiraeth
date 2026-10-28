# Enemy roster v3: humanoid foes on clips (issue #724, part of #722)

2026-10-27. The author, after picking the mummer and the mummer king sheets: "we have too many enemies that are animals
and low profile to the ground, we should have more that are humanoid so we can wire their animations better rather
than doing 100% procedural".

**Where the roster stands.** 4 of the 23 archetypes are humanoid (shade, fencer, furnace brute, marionette), and only
the fencer fights like a person. Most pack leads are low animals (crab, skitter, centipede, lizard, toad, worm, blot,
roller). Low bodies hide their wind-ups under the camera, are hard to hit with a level swing, and need every gait
written by hand.

**The answer.** Humanoids drawn with human proportions under a costume, moved by the clips the traveller already
uses, with the procedural layers kept on top:

- **One humanoid foe rig** (`src/enemies/humanoid-rig.js`): a skeleton with the UE mannequin names, so the
  traveller's Animator retargeting (src/animator.js: each limb aimed along the library bone's motion from its rest
  pose, so proportions don't matter) drives a 1.1 m mummer and a 2.6 m king alike.
- **Clips:** locomotion from Quaternius UAL (CC0, public/anim/ual.glb: idle, walk, jog, sprint, look round, talk);
  fighting from the Mixamo moves already shipped (public/anim/moves.glb: sword-and-shield attacks, slashes, blocks, impact,
  strafes; great-sword slashes, spin, jump attack, slide attack; stumble; get up from back and stomach for the poise
  knock-down). Clips missing for a move (a throw, a bow, a sit, a sleep) come from more of the CC0 UAL set, or a pose
  held procedurally until one is added.
- **Procedural on top, not instead:** the head looks at the traveller, the feet plant on slopes, cloth and props
  swing on springs, the wind-up's last pose is held and pushed for the telegraph (the clip's own anticipation
  stretched to the foe's wind-up time).
- **Every humanoid** gets the fight core of #722 (poise, tiers, tempo, low-HP state, alert beat) unchanged.

## The new humanoids (references in the lab; the author picks)

Prompts: [enemy-roster-v3-prompts.md](enemy-roster-v3-prompts.md). Each takes a job a low animal has now.

| id | role | replaces as lead | main skin | moves (each with its clip) |
|---|---|---|---|---|
| `mummer` (picked) | camp rank and file | lizard / blot as filler | Desert | overhead club, spear jab, bow volley, rock lob; mask knocked off at low HP |
| `mummerking` (picked) | camp chief | (new) | Desert | door-beam smash, horn call, throws a mummer |
| `pilferer` | thief (the rejected gullet's job) | (new) | Lorn II | snatches the shield or a gun mode and runs; caught or cut, it drops it |
| `doorbearer` | tank | shellback crab | Arzach II | door raised (blocks all from the front), mallet, door slam; plates knock off (#722 C11) |
| `lancer` | reach | stilt heron | Arzach | hook sweep at knee height (jump it), thrust, hook pull |
| `potter` | lobber | bellows toad | Perdide | jar lob with a landing mark, jar spray, rack smash at low HP |
| `riser` | ambusher | mound worm | Buried Machine | rises from the ground, ankle grab, lamp flash |
| `tumbler` | flanker | horn lizard | Signal Market | knife fan, back-flip away, dive cut |
| `conjurer` | trapper / support | ring centipede | Garden of Spheres | ink snares, blinks through a puddle, card volley, calls blots |

## Order

1. **The rig and the mummers** (picked): the humanoid rig with clips, the mummer and mummer king on it, in the
   Desert's camps (src/encounters/sites.js) and as the Desert's camp foes. Pictures against the sheets; Unity checked.
2. **The shade and the fencer moved onto the rig** (already humanoid; their procedural walks replaced by clips). Done
   (v2.33): docs/systems/procedural-animation.md, "The humanoid foe rig".
3. **Each new humanoid as its sheet is picked**, in the table's order of value: door-bearer, tumbler, lancer,
   pilferer, potter, riser, conjurer.
4. **Retire a low animal only when its replacement has landed in the world it led**, its skins kept in the Arena's
   list for the debug menu. Candidates: crab, lizard, toad, worm, centipede, heron. Skitters (the swarm), blots (the
   teacher), the hound, the flyers and the machines stay.
