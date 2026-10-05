# Continuity and scope of the dialogue pass

## Facts to preserve

- The traveller is about twenty-six; left at seventeen. His parents died two
  years ago. He knows they are dead before the player understands it.
- The console plays recordings. It searches by words; the parents do not
  respond to the current journey. Coincidental relevance is part of the ache.
- Ilen is his elder sister, gone before his birth. Her last transmission
  sounded like singing. Her fate is unknown. The market message took thirty
  years to arrive; the mother's “For when he asks” recording is separate.
- Lou is seven and a half. He brought her to Tove at two and did not knock on
  his parents' door. His postcards have reached her. Tove finished the small
  house; Lou, Tove, and Moustache live there. The parents' round house is dark.
- Home becomes available after six worlds. The market and Ilen revelation are
  optional under the current rules. Do not assume the player has heard them.
- The recent singing light passed the worlds on the night of the collision.
  It turned and climbed away. The Great Crystal fell long before that night.
- Odile and Talo were struck over Viridel forty years ago, left in their
  saucer, were struck again over the deep wood, waited a season, borrowed
  Fen's skiff, visited the Crystal, and went east. Their later fate is unknown.
- The makers' glyph is three dots over an upward-bowing arc (∩), not a smile.
  Locals have different names for it. Those names express local beliefs.
- The white builders found the older spheres and pyramids, then copied them
  and the mark. They are not established as the original makers.
- The field in the ship's scar matches the reachable worlds. Home has no such
  signature. This explains the route without explaining the light's intent.
- Esk's flood is unavoidable after the requested gate turn. The side quest
  remains failed; the main Viridel quest is unaffected. No line should imply
  the player could have succeeded by turning the wheel more gently.
- Wendel has not *seen* an egg hatch before the firefly quest. The eggs do
  hatch. His ignorance and the world's behaviour are different facts.

## The current opening

The tree is cold and the backpack chest contains an empty tank. The player
visits Qanat, opens the chest, speaks to Nour, checks the well, gets Ama's jar,
and asks the Speaker about the giant's mouth beyond the back gate. Inside,
the fallen rib blocks a dry pool. With an empty tank, use the keepers' pole
and carved post as a lever; a filled tank can also push the rib. The released
water fills the pool, backpack, and jar. Back at Qanat the well fills, but the
tree still needs the spark-stone. Nour sends the traveller to Marrow's hidden
hoverbike and the marked route to the Givers' Hearth in the south-east. Move
the stone ball to lift the grille, take the spark-stone, and bring it to the
well. Only then does the glowing jar power the ship.

This pass states these actions more clearly. It does not rearrange them or
change what the game accepts.

## Documentation drift

`LORE.md` is valuable as the detailed design record, but “as built” notes span
several revisions. `docs/story-bible.md` also retains the earlier desert
sequence. Their old dialogue quotations are not the current script. Both now
point here and to the new [voice guide](voice-guide.md).

The old “Wendel's eggs never hatch” decision directly conflicts with the
existing `perdide.fireflies` quest and its nest scene. The relevant LORE notes
are corrected in this pass; the hatching itself was already implemented.
Further quest proposals live in [plot-review.md](plot-review.md), not in live
quest data.

## What this pass edits

- Conversation data for all eleven journey worlds and Home in `src/story/`.
- Family recordings, the final stone scene, and the ship's signature wording.
- All eleven temple guides and their associated readable scene text.
- Ambient conversations and inter-world errands in `src/levels/content.js`.
- World journal introductions/outros and opening quest directions where needed.
- Makers' item descriptions in `src/items.js`.
- Supporting character histories, performance premises, and plot recommendations.

Short choices, useful control prompts, names, the glyph, and strong existing
lines are retained where they work. Developer galleries and settings copy
are not narrative scenes. The pass does not replace every unchanged “Thank
you” or movement prompt merely to produce a larger diff.

Runtime IDs, branch order, conditions, effects, rewards, timings, geometry,
and quest completion rules stay the same. Copy-sensitive test assertions are
updated where wording intentionally changes, keeping their state/flow checks.
The shared source is also used by the Unity export pipeline; generated Unity
content has not been rebuilt or playtested in Unity as part of this pass.

## Release integration

v0.58 incorporates the current main branch's bystander conversations: those
NPCs use its rotating, condition-aware listening lines without player choices.
The writing pass is applied to that structure; the new hints and reactions
from main are retained. Relative to main, game-source changes remain text only.
