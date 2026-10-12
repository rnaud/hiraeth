# The fluid shield, raised and on its own: reference prompts

2026-10-10 (issue #92: "redo the references of the character holding the shield to protect themselves and the shield
on its own"). The old pictures (`references/Core Objects/Reviewed Gadgets/Fluid Shield - Clear Separation v3/`) are a
mechanism study: a side view of a fist behind a liquid oval, cropped, with no traveller. These prompts draw the shield
as it is in the game now (`src/shield.js`, `docs/systems/foes.md` "In the hands"): a small brass disc worn on the back
of the left hand; raised, six brass petals spin out round the hub, a brass ring closes round them, and beyond them the
tank's jade fluid spills out as a living blob, never quite round, about 70 cm across, swung on a short brass arm to the
middle of his chest. Plain text prompts for the reference lab
(`scripts/gen-reference.mjs --from docs/design/shield-prompts.md#<id>`).

Target folder: `references/Core Objects/Fluid Shield/<id>/`

What every prompt keeps: the traveller as in the game (a slim young adult, messy short black curly hair, coral
overshirt, tan neckerchief, cream trousers, small suede boots, a round glass backpack of glowing jade fluid between his
shoulder blades, the fluid sword in his right hand is fine), the house style, a plain cream background unless the
prompt says otherwise, no hose or cable from the backpack to the hand, the hand always behind the fluid, never through
it.

### 1. Raised to protect himself (`guard`)

**Main: the traveller guarding, four views.**

```
Character action reference sheet for a science fiction exploration game: a slim young adult traveller with messy short black curly hair, a coral overshirt, a tan neckerchief, cream trousers and small suede boots, a round glass backpack of glowing jade-green fluid between his shoulder blades, crouched slightly with his weight forward, raising a shield of living fluid on his left forearm to protect himself, a short blade of green light in his right hand held back, drawn in four full-body views side by side at the same scale on a plain cream background: front view, three-quarter front view, side view, and three-quarter back view. The shield: a small brass disc on the back of his left hand, from which six curved brass petals have spun open round a hub with a thin brass ring round them, and beyond them a translucent blob of swirling jade and turquoise fluid about 70 centimetres across, its edge rippling and never quite round, a bright pale lemon wavy rim, held on a short brass arm in front of the middle of his chest. His fist stays behind the fluid with clear air between them, his face visible through the translucent green, eyes alert. No hose or cable from the backpack to the hand. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral and cream clothes, jade green glow, brass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hose cable tube
```

**Variant: a blow taken, in the world.**

```
Game action concept art for a science fiction exploration game, seen from a low three-quarter angle at play distance: a slim young traveller with messy short black curly hair, a coral overshirt and cream trousers, a round glass backpack of glowing jade fluid on his back, braced on a sandstone plaza under a pale sky, raising a shield of living fluid on his left forearm as a big shelled desert creature's claw strikes it: a ring of brass petals round a hub on the back of his hand, and beyond them a translucent rippling blob of jade and turquoise fluid about 70 centimetres across, ripples running out from where the claw hits and bright pale lemon rings bursting off its rim, droplets flying. His fist stays behind the fluid with clear air between them, his face seen through the green, determined. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, golden sandstone, coral shirt, jade green glow, restrained cream paper grain, clear readable action, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hose cable tube
```

### 2. The shield alone (`shield`)

**Main: object sheet, folded to open.**

```
Object design reference sheet for a science fiction exploration game: a wearable fluid shield drawn five times side by side at the same scale on a plain cream background, showing it open in stages: folded, a small brass disc 7 centimetres across on a leather bracer strap, its six curved petals closed like a shut flower round a hub; opening, the six brass petals spinning out round the hub; open from the front, the petals spread with a thin brass ring round them and beyond them a translucent blob of swirling jade-green and turquoise fluid about 70 centimetres across, its edge rippling in soft lobes, never quite round, a bright pale lemon wavy rim, ink strokes swirling round the hub; open from the side, the fluid a thin rippling sheet on a short folding brass arm off the bracer; and cracked, the fluid flickering with jagged pale cracks. Small brass rivets, worn leather strap, a faint green glow from the fluid. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, jade green glow, brass and leather, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hose cable tube hand arm person
```

**Variant: three alternatives.**

```
Object design exploration sheet for a science fiction exploration game: three alternative designs of a wearable shield of living jade-green fluid that opens from a small brass disc worn on the back of the hand, drawn side by side at the same scale on a plain cream background, each folded and open: first, six curved brass petals round a hub with a thin brass ring and a rippling round blob of fluid beyond them; second, a brass hub with three long slender brass ribs like a fan and the fluid stretched between and beyond them in a soft leaf shape; third, a brass ring with small charge lights round a hub and the fluid spilling out in a wavy flower-like blob with a bright lemon rim. All translucent, swirling green and turquoise, glowing softly, on worn leather bracer straps. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, jade green glow, brass and leather, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hose cable tube person
```

## The second round: poses and a turnaround

2026-10-12 (issue #92 again). The first round's picks (`guard/`, `shield/`) show one stance in four views and the
shield's stages from folded to cracked. What they don't show: the traveller in more than one pose behind the shield,
and the open shield from all round with its scale right. In the game the brass is small (petals of about 10 cm round
a 7 cm hub, `SHIELD.petal`), well inside a blob of fluid about 70 cm across (`SHIELD.radius`), and the blob is
carried on a short brass arm in front of the middle of the chest, not strapped to the forearm like a buckler. These
two prompts ask for that.

### 3. Guarding, three poses (`guard-poses`)

**Main: three poses on one sheet.**

```
Character action reference sheet for a science fiction exploration game: the same slim young adult traveller drawn three times side by side at the same scale on a plain cream background, in three different poses protecting himself with a shield of living fluid. He has messy short black curly hair, a coral overshirt with rolled sleeves, a tan neckerchief, cream trousers, small suede boots and a round glass backpack of glowing jade-green fluid between his shoulder blades. First pose, three-quarter front view: standing braced, feet apart, left arm raised, the shield held high in front of his chest and face against a blow from above, a short blade of green light held back low in his right hand. Second pose, side view: crouched low on one knee behind the shield, shoulders hunched, head ducked, sheltering as if from a storm of sparks. Third pose, three-quarter back view: stepping sideways with the shield swung out to his left to turn a blow aside, his body twisting, the backpack's glass dome catching light. The shield in every pose: a small brass hub no bigger than his palm on the back of his left hand, six short curved brass petals round it with a thin brass ring, and around them a far larger translucent blob of swirling jade and turquoise fluid about 70 centimetres across, its edge rippling in soft lobes, never quite round, a bright pale lemon wavy rim, carried on a short brass arm in front of the middle of his chest. His fist stays behind the fluid with clear air between them, his body seen through the translucent green. No hose or cable from the backpack to the hand. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral and cream clothes, jade green glow, brass, restrained cream paper grain, clear readable silhouettes, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hose cable tube buckler wooden-shield metal-shield
```

### 4. The shield on its own, all round (`shield-turnaround`)

**Main: a turnaround and a detail.**

```
Object turnaround reference sheet for a science fiction exploration game: a wearable shield of living fluid, open, drawn four times side by side at the same scale on a plain cream background, as if floating on its own: front view, three-quarter view, side view, and back view, and above them one larger close-up detail of its brass hub. The shield: at its centre a small brass hub 7 centimetres across with six short curved brass petals spread round it like a flower and a thin brass ring round the petals, small rivets, about 20 centimetres across in all; from the back of the hub a short folding brass arm and a worn leather bracer strap; and around the brass a far larger translucent blob of swirling jade-green and turquoise fluid about 70 centimetres across, its edge rippling in soft lobes, never quite round, a bright pale lemon wavy rim, a few ink strokes swirling round the hub following the flow. Seen from the side the fluid is a thin rippling lens, slightly domed, thickest at the hub. Seen from the back, the petals' hinges, the arm's knuckle joint and the strap. A faint green glow on the paper under it. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, jade green glow, brass and leather, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hose cable tube hand arm person buckler
```

Picked 2026-10-12: `guard-poses/sheet-1.jpg` (OpenAI) and `shield-turnaround/sheet-1.jpg` (Gemini); the reasons are
in each folder's `manifest.json`. Both agree with `src/shield.js` (six petals in a ring on a small hub, the blob
about 70 cm, the arm off the bracer), so the model stays as it is.
