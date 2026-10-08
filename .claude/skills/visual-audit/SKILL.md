---
name: visual-audit
description: Look for what is wrong in Hiraeth's pictures — visual artifacts, lighting and shadow problems (acne, peter-panning, leaks, black or blown areas, shadows in caves and interiors), flicker and shimmer in motion, clipping and floating props, LOD pops, off-style colours, face and character problems — world by world and hour by hour, and write docs/audits/visual-v<version>.md with each problem's picture, cause and fix. Use when asked about visual quality, artifacts, glitches, lighting or shadows, or before a release.
---

# The visual audit

This is a hunt for what looks wrong, not a review of the art direction: the style is judged in the
game audit (theme 7). Every finding is a picture you can point at, with its world, view, hour and
preset, and a likely cause in the renderer. Each report is `docs/audits/visual-v<version>.md`,
compared with the last.

Read first:
- `docs/systems/rendering.md`: the passes, the cast shadows, the ink shadows, smooth shadow edges,
  "Shadows close up", "Stable in motion", debug views;
- `docs/systems/materials.md`;
- `docs/systems/references.md`: the reference sheets each world is drawn after;
- `docs/systems/dev-tools.md`: the clipping audit;
- `docs/systems/movement.md`, "Contact";
- the open visual items in `TODO.md`, such as "shadow artifacts in caves and interiors" and the
  traveller's face;
- the last `docs/audits/visual-v*.md`.

**Rules for every run:** muted, never port 5173, on the real GPU (never SwiftShader), the High preset
unless the check is about a preset, and the HUD hidden. Look at every picture yourself: the numbers
only say where to look.

## 1. Stills: every world, several hours, inside every door

```sh
node .claude/skills/visual-audit/views.mjs <scratch>/visual [--worlds …] [--hours 7,12,18.5,22] [--preset high|handheld]
```

The script covers every world's benchmark views (up to 3) at dawn, noon, dusk and night, plus up to 6
interiors per world: just past each door, cave or portal, at noon. Each picture is measured, and
flagged for:
- crushed blacks;
- blown whites;
- NaN-magenta pixels;
- mostly one colour, or very few colours (nothing drawn).

It also runs the clipping audit once per world (`window.clipAudit`). Then read `report.json`, open
every flagged picture and a sample of the rest, and check them against this list.

**Shadows and light**
- Acne: striped or speckled self-shadow on lit faces.
- Peter-panning: the shadow detached from its foot.
- Shadow edges that crawl.
- Cascade seams: a line where the shadow's sharpness changes.
- Light leaking through walls into interiors and caves, or interiors lit like the outside.
- Shade that is black or grey where the style wants a colour.
- Sun-facing facets lit edge-on.
- Shadows missing under people, props or the ship.

**Lines and ink**
- Outlines missing or doubled.
- Lines too heavy far away, or broken on thin bars.
- Hatching that swims across a surface.
- Haze banding.
- Sky seams.

**Geometry**
- Z-fighting (surfaces flickering against each other).
- Props floating or sunk; people standing inside walls (the clipping and contact audits).
- Holes in the terrain or in walls.
- Back faces showing.
- Transparency sorted wrongly (water, glass, wings, fluid).

**Characters**
- Faces off-model (TODO.md: the eyes).
- Hands or capes through the body.
- Portraits empty (`scripts/portrait-check.mjs`).
- People popping as their level of detail changes.

**Colour**
- A world off its reference sheets (the References level: `?level=references`, its views beside the
  sheets).
- A pass leaving its colour where it shouldn't, for example the eclipse or the space sky outside
  their worlds.

## 2. Motion: flicker, shimmer, pops

Stills can't show these. Use the motion check (`docs/systems/rendering.md`, "Stable in motion"):

```sh
node scripts/motion-check/serve.mjs --builds <dir>
node scripts/motion-check/record.mjs --level <world> --build main --preset high --paths pan,zoom --out <dir> --save 1
```

It steps the game's clock frame by frame, so every run is identical, and measures the flicker per
frame. `scripts/motion-check/survey.sh` runs every world. Look at the hottest clips. Pops at the
level-of-detail and cascade distances show on the zoom path.

## 3. Close checks for what the TODO names

- **Caves and interiors:** walk the inside views, at least one per world, and the desert's caves and
  houses. Compare cast and ink shadows.
- **The traveller's face:** the character studio (`studio.html`), or a `people` view through
  `scripts/changelog-shots.mjs`.
- **Climbers and quick turns:** rendering.md, "Shadows close up".

## 4. Write `docs/audits/visual-v<version>.md`

- **The setup:** commit, preset, resolution, hours, GPU.
- **A findings table:** each problem's severity (*breaks the picture*, *noticeable*, or *only when
  looking*), where it is (world, view, hour), the picture's path under
  `docs/audits/visual-v<version>/` (copy only the pictures that show a problem, as WebP: `cwebp -q 72`),
  the likely cause (file and line), and a suggested fix.
- **What was fixed** since the last report, and what is new.
- **The clipping and contact audits' counts per world,** against the last.
- **The motion check's worst views.**
- **What was not checked:** devices, presets and worlds left out.

Keep the folder small: under 3 MB a report. Add the report to the `docs/audits/` line of
`docs/README.md`. It's documentation only: no changelog line, no fixes, unless asked. Commit it if
asked, after the tests and the build pass.

## 5. Tell the user

- the count of problems by severity, and the worst three with their pictures;
- what's new since the last report;
- the fixes you'd do first.

Offer the fixes as work; don't start them unasked.
