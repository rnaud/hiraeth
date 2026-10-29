# Ground warnings: reference prompts (issue #758)

2026-10-28. The author: "The circles on the ground for wave attacks and lob attacks feel a bit simplistic. Let's do
references and then fix." Today a wave (the hulk's stomp, a quake) draws a flat expanding ring, and a lob (the grunt's
rock, the prowler's spit) a flat disc where it will land. These prompts ask for effect sheets in the game's own ink style:
how the warning sits on the ground, how it grows, and how it reads at a glance against sand, stone and grass. The
author picks; the effects are then redrawn after the picks.

Run in the reference lab (docs/systems/reference-lab.md) with its defaults (Gemini and OpenAI), no style references:

```
node scripts/gen-reference.mjs --from docs/design/ground-warnings-prompts.md#wave --n 2
```

Target folder: `references/effects/<id>/`

## Effects

### 1. Shockwave warning (`wave`)

**Main sheet: the stomp's shockwave itself, a visible wave rolling out along the ground (round 2: the author on round 1, "there should be a wave shock here").**

```
Visual effect design sheet for a science fiction exploration game in ink-drawn Moebius style: a huge creature stomps and a visible shockwave rolls out across the ground, shown in four panels side by side seen from a three-quarter view above, on pale desert sand: first panel, the wind-up, the great foot raised, a thin ring of trembling grit marking how far the wave will go; second panel, the stomp lands and a ring-shaped wave of force bursts out, a curling wall of sand and air knee-high with a bright inked crest, a distortion ripple in the air above it and dust thrown up behind; third panel, the shockwave further out, a clear rolling ring of displaced sand and blasting air with speed lines, pebbles flung outward, the small traveller jumping over its crest; fourth panel, the wave fading at its full radius, a scored ring in the sand and settling dust. The shockwave is the star: a strong readable ring of force travelling along the ground, drawn with bold ink lines and a warm orange-red accent along its crest, not a flat circle. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse hatching, luminous flat pastel colours, cream paper grain, clear readable construction, no characters except the creature's foot and a small cloaked traveller for scale, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels user-interface-icons flat-circle neon
```

### 2. Landing mark for a lobbed throw (`lob`)

**Main sheet: where a thrown rock or a spat glob will land, shown on the ground while it is in the air.**

```
Visual effect design sheet for a science fiction exploration game in ink-drawn Moebius style: the mark that shows on the ground where a lobbed rock or a spat glob of ink will land, while it is still in the air, shown in four panels side by side seen from a three-quarter view above, on pale stone paving: first panel, the projectile just thrown high in an arc, its shadow appearing small and soft on the ground at the landing spot; second panel, mid-flight, the shadow grows darker and sharper with a thin inked ring tightening around it and four small inked tick marks pointing inward; third panel, a moment before impact, the ring tight and bright, the shadow crisp; fourth panel, the impact, a splash of ink or a burst of grit inside exactly that ring. The mark reads as the projectile's own shadow plus a tightening inked ring drawn on the ground, not a flat floating disc, readable at a glance, with a warm orange-red accent. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse hatching, luminous flat pastel colours, cream paper grain, clear readable construction, no characters except a small cloaked traveller for scale, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels user-interface-icons flat-disc neon glow
```

### 3. Area hazard that is about to go off (`area`)

**Main sheet: a zone that will erupt (a crawler's blast, a charged area move).**

```
Visual effect design sheet for a science fiction exploration game in ink-drawn Moebius style: the warning for a small area about to erupt, a self-destructing little machine's blast zone, shown in four panels side by side seen from a three-quarter view above, on green grass: first panel, a faint dashed inked ring on the grass at the blast's radius with blades of grass beginning to lean outward; second panel, the ring fills with inked radial hatching that grows inward, grass flattening, sparks of amber light; third panel, a moment before, the whole zone tinted warm orange with crisp ink lines and lifting leaves; fourth panel, the burst, a flat ink-drawn blast flower exactly filling the ring. Drawn into the ground and the grass, not a flat floating circle, readable at a glance, warm orange-red accent. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse hatching, luminous flat pastel colours, cream paper grain, clear readable construction, no characters except a small cloaked traveller for scale, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels user-interface-icons flat-circle neon glow
```
