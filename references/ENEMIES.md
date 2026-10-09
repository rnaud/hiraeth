# Enemy reference and implementation guide

The 25-world enemy set contains 100 types: two local creatures, one old machine possessed by a bad spirit, and one dark humanoid shadow spirit per world. Preserve the Moebius science-fiction style and the half-corrupted roster balance when refining them.

## Find the art

- `enemy-atlas.html` is the visual index; `enemy-roster.json` records each world's four types and selected sheet.
- Each existing world directory contains `enemies/lineup-01` through `lineup-04` (`.jpeg` or `.webp`) plus `enemies/sources.json`. All 100 sheets and 25 source records are tracked in Git here, not dependent on Downloads, an archived worktree or ignored output.
- `sources.json` preserves the Midjourney jobs, prompts, selections and notes. Keep original exports; add new revisions with new filenames and provenance instead of silently overwriting a source sheet.
- `src/enemies/roster.js` gives each runtime species its exact repository-relative `reference` path. Use that selected sheet first; the other sheets are alternatives, not interchangeable requirements.

## Improve a model or attack

1. Read `.agents/skills/moebius-ai-characters/SKILL.md` and its `references/procedural-quality.md`. Inspect the selected image before editing.
2. Locate the species in `src/enemies/roster.js`: its ID, form, proportions, colours, fittings and attack pair. `src/enemies/models.js` builds the articulated body; `src/enemies/attacks.js` defines the 15 shared attack patterns. These are procedural interpretations, with shared rigs and patterns, so improvements to a common builder can affect many species.
3. Preview in `enemies.html`, then use its Arena links to fight the enemy. `src/foes.js` integrates models, animation, warnings, damage, spawning and disposal. The newer specialized temple and relic encounters retain their own kinds in `foe-kinds.js` / `foe-worlds.js`.
4. Keep warning zones and damage zones consistent, test commitment and recovery, and retain parries, dodges, Gentle mode and safe areas. Check limb/wing attachment through motion, reference silhouette from several angles, and material cleanup on death/removal.
5. Run `node --test tests/world-enemies.test.js tests/foe-kinds.test.js tests/foe-appearance.test.js`, then the full suite and build before committing. `scripts/world-enemy-shots.mjs` captures all species (or one world argument); `scripts/world-enemy-smoke.mjs` checks actual Arena/gallery integration. Both use temporary ports 5488/5489; leave 5173 alone.
6. Record actual inspected poses and remaining limitations in `docs/systems/foes.md`; add reusable findings to the skill. Screenshots in ignored `output/` are temporary review evidence, not replacement source art.

Home, the Atelier and the Overnight Train remain peaceful in exploration. Their designs are available for Arena practice. Worlds added after this 25-world reference set need their own references before being described as covered.
