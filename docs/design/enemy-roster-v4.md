# Enemy roster v4: monsters and droids, the same in every world (issue #726)

2026-10-28. Replaces the per-world plan of [enemy-roster-v3.md](enemy-roster-v3.md) (its seven humanoids were
dropped) and, once built, the per-world animals of [enemy-roster.md](enemy-roster.md). Prompts and the three rounds
that led here: [enemy-roster-v4-prompts.md](enemy-roster-v4-prompts.md). The author picked all seven on 2026-10-28.

## The idea

One roster met in every world, in two families as in Breath of the Wild:

- **Monsters** with a coloured skin. The colour is the tier (#722, `tierSkin`): the picked sheets show each kind's
  base colour; later worlds bring a darker, banded skin with one new move. No world costumes.
- **Defunct droids**, the makers' old machines: weathered ivory ceramic over dark joints, one amber eye, amber seams;
  the same ancient high tech as the temples. The fencer and the lamp tripod join this family.

Humanoids run on the clip rig (`src/enemies/humanoid-rig.js`, #724); the crawler is the one small walker on the
procedural kit. The proportions, parts and colours come from each sheet (`references/enemy-archetypes/<id>/sheet-1.jpg`)
and are built with the enemy-rework skill (procedural surface mandatory).

| id | family | job | height | moves (clip) | low HP |
|---|---|---|---|---|---|
| `grunt` | monster, red | rank and file, groups of 2–5, camps | 1.3 m | club overhead, lunge, picks up a bow (volley) or a spear (jab) from the camp rack, throws a rock when unarmed | flees to a hulk or the horn |
| `hulk` | monster, slate blue | the heavy | 2.7 m | spiked-club smash (sweep and overhead), stomp, picks up and throws a grunt | rage |
| `prowler` | monster, leaf green | the quick one | 1.8 m | circles, back-flips from your swing, darting slash, tail sweep, spit at range | rage |
| `warlord` | monster, crimson | rare elite, one guarded site a world from the second | 2.5 m | glaive sweep, overhead, charge, roar that wakes the camp; armour plates come off | desperation |
| `sentinel` | droid | the duellist | 2.0 m | guard, parry and riposte, blade thrust and cut, shield bash, sudden dash | overload: faster |
| `oracle` | droid | the caster, hovers back | 1.8 m | bolt volley, a shield over a packmate, wakes sleeping droids | flees and blinks |
| `crawler` | droid | the scout | 0.6 m | skitters, rears and flashes to call the others, bites | self-destructs |

## Status

- **2026-10-29: each world keeps its own foes (issue #762).** Step 4 (the same foes in every world, v2.35) and one look
  per kind (#748, v2.35) were reverted at the author's word: "Can we revert that, I liked the enemies per world
  actually", and of one look, "revert that as well". The worlds' own packs, sites and placed foes are back, in their
  per-world skins and tier looks; the seven v4 foes stay built, met in the Arena, the gallery and Unity's `-fight`, the
  camps' racks and the warlord's hold staged behind `?staged=roster4` as before. Steps 4 and on below are not planned.
- 2026-10-28: the sentinel, the oracle and the crawler built (issue #726; docs/systems/foes.md, "The makers' droids"), met in
  the Arena only until step 4.
- 2026-10-31: the crawler's body rebuilt from its approved design (#800, Tripo: `plans/crawler-tripo.js`, the dome kept as
  `plans/crawler-legacy.js`): a cream dome over a navy band, a round head with two amber eyes, four sage legs out of pink
  sockets; its moves, size and Arena-only skin as before (docs/systems/foes.md, "Family E on Tripo bodies").

## Where they live

- **Camps** (src/encounters/sites.js): grunts round a fire with a hulk; a weapon rack (the grunt's bow and spear).
- **Ambushes and nests:** prowlers.
- **Ruins, temple surroundings, makers' places:** droids (sentinel, oracle, crawlers, with the fencer and tripod).
- **Wandering packs:** grunts, prowlers, crawlers.
- **One warlord** a world from the second world on, at its own guarded site with a coffer.

## Order

1. **Grunt and hulk** (the backbone; the hulk's throw reuses the mummer king's). Arena, gallery, tests, Unity. Built (v2.34): docs/systems/foes.md, "Roster v4's monsters"; staged in the Desert's mummer camp behind
   `?staged=roster4`. The shape pass (docs/systems/foes.md, "The shape pass") gave them lofted limbs, the grunt
   clawed fingers and round shoulders, the hulk a jutting head and muscled arms; still unlike the sheets: the grunt's
   knees higher than drawn, both monsters' skin stepping hard from light to shade.
2. **Sentinel, oracle, crawler**, in parallel with 1.
3. **Prowler and warlord.** Built (v2.34): docs/systems/foes.md, "The prowler and the warlord"; the warlord's hold
   staged in Arzach behind `?staged=roster4`. Since the shape pass: lean lofted limbs and a long wedge head for the
   prowler, big lofted ram horns, long locks, two-layer pauldrons and buckled greave straps for the warlord. Still
   unlike the sheets: the prowler's crest and plain neck, the warlord's mane thinner round its face.
   **Rebuilt (#800, v2.39):** the prowler is the pod stalker on its Tripo body (`plans/prowler-tripo.js`, the leaf-green
   lizard kept as `legacyProwlerModel`, standing in while it loads): docs/systems/foes.md, "Family H on Tripo bodies".
4. **The world rosters**: every route world's sites and packs from this roster; the per-world animals (crab, lizard,
   toad, worm, centipede, heron, and the rest led by a world) and the mummers move to the Arena list for the debug
   menu. Blots stay as the first world's teacher. The shade, hound, skitters and flyers are reviewed then.
