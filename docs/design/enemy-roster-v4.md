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

- 2026-10-28: the sentinel, the oracle and the crawler built (issue #726; docs/systems/foes.md, "The makers' droids"), met in
  the Arena only until step 4.
- 2026-10-28, step 4 (v2.35): every route world on this roster (src/foe-worlds.js `WORLDS`, src/encounters/sites.js
  `SITES`; docs/systems/foes.md, "The world rosters"). The `?staged=roster4` switch is gone: what it staged is the
  default. Below: each foe's place and the curve measured.

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
4. **The world rosters**: every route world's sites and packs from this roster; the per-world animals (crab, lizard,
   toad, worm, centipede, heron, and the rest led by a world) and the mummers move to the Arena list for the debug
   menu. Blots stay as the first world's teacher. The shade, hound, skitters and flyers are reviewed then. Done (v2.35):
   "Each foe's place" below.

## Each foe's place (step 4, the author's rule of 2026-10-28)

"The same foes in every world. Tiers, not new looks, carry the later worlds." Every foe that was met on the route was
looked at once: kept where it fits the monsters-and-droids rule or does a job roster v4 has no foe for, else retired.
A retired foe keeps its code, its skins, its place in the Arena's list and the debug menu's foes (the roster), the
discarded side worlds' tables and its world's fight-temple horde (`WORLDS[w].horde`, the pre-v4 roster: the fight temples
breed their own crowds of light foes and are left as they were). `RETIRED` in src/foe-worlds.js lists them.

| Foe | Decision | Why |
|---|---|---|
| ink blot | **kept**, the Desert only | the first world's teacher: the Desert's first pack is still a blot, the game explains them |
| sky ray | **kept** (Vael, Vael II, the Underwater City, the Glass Dunes) | the flyer: v4 has no foe in the air but the oracle's hover |
| ring drone | **kept** (Viridel, the City-Shaft, the Glass Dunes, the Garden, the Floating City, the Market) | a makers' machine that flies: a droid, and the flyer of the machine worlds |
| skitter | **kept** (the Buried Machine, the Moon Foundry: in the rails) | the swarm: no v4 foe comes in a flock of eight |
| lamp tripod | **kept**, a droid (the Desert's cistern pump; the Underwater City's ruin; the City-Shaft's beat) | a makers' machine already: the sheet's ivory ceramic family |
| makers' fencer | **kept**, a droid (the Moon Foundry's beat, the Floating City's ruin) | a makers' machine already; left out of the Market's beat, where at stage 4 with an oracle it cost a careful player 11 hearts |
| makers' machine | kept in the temple rooms | never on a world's roster: the temples' own |
| crab, lizard, toad, mound worm, ring centipede, stilt heron | **retired** | the per-world animals (the author's list) |
| mummer, mummer king | **retired** | the author's list; the Desert's camp is the grunts' and the hulk's now |
| shade | retired | a spirit duellist: the sentinel duels now (guard, parry, riposte) |
| antler hound | retired | a creature stalker: the prowler is the quick one |
| signal moth | retired | a creature flyer in threes: the ray and the drone keep the air |
| pearl roller | retired | a creature charger: the hulk's smash and the warlord's charge |
| bell walker | retired | a bronze heavy: the sentinel's guard and the warlord's plates answer a masher now |
| furnace brute | retired (still the Buried Machine's Boiler Keeper, a temple's own) | the heavy: the hulk |
| crucible cart | retired | a foundry machine whose slag is the world's hazard, not a foe's job; the Pour Floor keeps it |
| lantern jelly | retired | the support: the oracle wards a packmate |
| ember wisp | retired (the Eclipse, a side world, keeps it) | the spirit bombardier: the oracle's volley and the grunt's rocks |
| marionette | retired | a spirit puppeteer: no place in either family |
| root knot | retired | a creature area-denier: no place in either family |

The posts placed by hand: the Desert's cistern pump stays a lamp tripod; Lorn II's post on the lit path's bank is a
sentinel's (the wood cutter, a furnace brute, stood there); the Garden's white archway an oracle's, hanging over its
threshold (the glass puppet swayed there).

### Where they live, world by world

- **Packs** (`WORLDS[w].roster`): grunts, prowlers and crawlers in every world, mixed by its stage (the existing
  `BUDGET` and tier stages): the grunt leads to the City-Shaft, the prowler from the Buried Machine and in the Garden
  and the Market; the prowler a third of a place more (`COSTS` 1.5) and from the second pack (`FROM`); crawlers come in
  pairs (`GROUP`); the grunt's rock is no ranged role (`rangedKind`), so early packs hold more than one.
- **Sites** (`SITES`): each kept its place, kind and terrain-checked layout; its foes are v4's and grow with the stage. A
  camp: grunts round the fire with a hulk, a lookout grunt, their rack and one or two of them empty-handed for it. A
  nest or an ambush: prowlers (one in the Desert's ambush, two early, three from the stage-2 worlds). A hoard or a
  patrol: droids. Where a world had no hoard or patrol for its ruin, its nest became one of dormant droids asleep round
  the coffer (Vael, the Glass Dunes, the Buried Machine: the oracle wakes the rest). One warlord's hold a world from Vael
  on, each with its coffer (paying twice): it took the world's hoard, or its patrol or nest where it had no hoard to
  spare (the Underwater City's and the Buried Machine's beats, the Floating City's nest). Site ids name what holds them
  now, so a save's cleared flag (the old foes') does not hide the new ones.
- **Tiers**: as before (`TIER`, `TIER_SHARE` from stage 3); and since the same foe is met everywhere, it pays as much
  more as it is tougher there (src/chimes.js `DROP_BY_STAGE`).
- **One tuning**: the grunt scrambles back out of the combo on the second light cut in a row and lunges back in
  (`answerMash { cuts: 2, evade: true, then: 'lunge' }`), so the first worlds' rank and file outlive a mashed combo.

| World (stage) | Packs before | Sites before | Packs now | Sites now |
|---|---|---|---|---|
| The Desert (0) | blot 4, worm 3, heron 2, skitter 2, mummer 1.5; placed tripod | camp mummer+mummerking+mummer+mummer+mummer (lookout); ambush worm+worm; nest skitter+skitter+skitter+skitter+skitter+skitter; hoard blot+heron+blot | blot 4, grunt 4, crawler 2, prowler 1.5; placed tripod | camp grunt+hulk+grunt+grunt (lookout); ambush prowler; nest prowler+prowler; hoard crawler+sentinel+crawler |
| Vael (0) | ray 4, heron 2, blot 3 / crab 4, ray 3, jelly 2, blot 2 | camp blot+blot+heron+heron (lookout); ambush ray+ray; nest crab+crab+crab; hoard crab+jelly+crab | grunt 4, crawler 2.5, ray 2, prowler 1.5 / grunt 3.5, prowler 2.5, crawler 2, ray 2.5 | camp grunt+hulk+grunt+grunt (lookout); ambush prowler+prowler; nest crawler+sentinel+crawler; warlord-hold warlord+grunt+grunt |
| Lorn (1) | toad 3.5, rootknot 3, heron 1.5, skitter 3 / rootknot 4, jelly 2, moth 3, shade 1, wisp 1.5; placed brute | camp toad+toad+rootknot+heron (lookout); nest skitter+skitter+skitter+skitter+skitter+skitter; patrol shade+shade; ambush moth+moth+moth; hoard rootknot+jelly+rootknot | grunt 4, prowler 2.5, crawler 2.5 / grunt 3.5, prowler 3, crawler 2.5; placed sentinel | camp grunt+hulk+grunt+grunt (lookout); nest prowler+prowler; patrol sentinel+crawler; ambush prowler+prowler; warlord-hold warlord+grunt+grunt |
| Viridel (2) | moth 4, rootknot 2, brute 1.5, blot 1 | camp blot+blot+rootknot+moth (lookout); hoard brute+rootknot; ambush moth+moth+moth; patrol brute+blot | grunt 4, prowler 3, crawler 2.5, drone 1.5 | camp grunt+grunt+hulk+grunt+grunt (lookout); warlord-hold warlord+grunt+grunt+grunt; ambush prowler+prowler; patrol sentinel+oracle+crawler |
| The Underwater City (2) | crab 4, ray 2.5, jelly 3, tripod 2 | nest crab+crab+crab+crab; hoard tripod+crab; patrol crab+crab; ambush ray+ray+jelly | grunt 3.5, prowler 3, crawler 2.5, ray 2 | nest prowler+prowler+prowler; hoard tripod+oracle+sentinel; warlord-hold warlord+grunt+grunt+grunt; ambush prowler+prowler |
| The City-Shaft (2) | tripod 4, drone 1, lizard 3.5, toad 2.5, shade 2.5 | camp lizard+lizard+toad+tripod (lookout); patrol shade+shade; hoard tripod+drone; nest toad+toad+toad | grunt 4, prowler 3, crawler 3, drone 1.5 | camp grunt+grunt+hulk+grunt+grunt (lookout); patrol sentinel+tripod+crawler; warlord-hold warlord+grunt+grunt+grunt; nest prowler+prowler+prowler |
| The Glass Dunes (2) | brute 4, crab 3, ray 2, worm 2, drone 2, shade 1 | camp crab+crab+brute+drone (lookout); ambush worm+worm+worm; hoard brute+shade; nest crab+crab+crab+crab | grunt 4, prowler 3, crawler 2.5, drone 1.5, ray 1.5 | camp grunt+grunt+hulk+grunt+grunt (lookout); ambush prowler+prowler+prowler; warlord-hold warlord+grunt+grunt+grunt; nest sentinel+crawler+oracle+crawler |
| The Buried Machine (3) | worm 3.5, tripod 3, cart 2, lizard 2, centipede 2, skitter 3 | camp lizard+lizard+centipede+tripod (lookout); ambush worm+worm; nest centipede+skitter+skitter+skitter+skitter+skitter+skitter; patrol cart+lizard | grunt 3.5, prowler 3.5, crawler 3, skitter 2 | camp grunt+grunt+hulk+grunt+grunt (lookout); ambush prowler+prowler+prowler; nest sentinel+crawler+oracle+crawler; warlord-hold warlord+grunt+grunt+grunt |
| The Moon Foundry (3) | cart 4, skitter 3, lizard 2.5, brute 2, wisp 2.5, fencer 1.5 | camp lizard+lizard+fencer+wisp (lookout); hoard brute+cart; patrol fencer+fencer; nest skitter+skitter+skitter+skitter+skitter+skitter | grunt 3.5, prowler 3.5, crawler 3, skitter 2 | camp grunt+grunt+hulk+grunt+grunt (lookout); warlord-hold warlord+grunt+grunt+grunt; patrol fencer+sentinel+crawler; nest prowler+prowler+prowler |
| The Garden of Spheres (3) | roller 4, drone 1, jelly 1, centipede 4, shade 3.5, hound 4; placed marionette | nest centipede+centipede+roller; camp roller+roller+centipede+drone (lookout); hoard centipede+jelly+roller; patrol shade+shade; ambush marionette+hound+hound | grunt 3.5, prowler 4, crawler 3, drone 1.5; placed oracle | nest prowler+prowler+prowler; camp grunt+grunt+hulk+grunt+grunt (lookout); warlord-hold warlord+grunt+grunt+grunt; patrol sentinel+oracle+crawler; ambush prowler+prowler+prowler |
| The City Floating in Space (3) | drone 4, moth 3, roller 3, fencer 2 | hoard fencer+roller; ambush moth+moth+moth; nest roller+roller+roller | grunt 3, prowler 4, crawler 3, drone 2.5 | hoard fencer+crawler+crawler; ambush prowler+prowler+prowler; warlord-hold warlord+grunt+grunt+grunt |
| The Signal Market (4) | lizard 4, moth 1.5, crab 1.5, bell 3, marionette 2.5, hound 3.5, fencer 1.5 | camp lizard+lizard+crab+bell (lookout); hoard bell+crab; nest lizard+lizard+lizard+lizard; patrol fencer+fencer; ambush marionette+lizard+lizard | grunt 3.5, prowler 4, crawler 3, drone 1.5 | camp grunt+grunt+hulk+grunt+grunt (lookout); warlord-hold warlord+grunt+grunt+grunt; nest prowler+prowler+prowler; patrol sentinel+crawler+oracle; ambush prowler+prowler+prowler |


### The curve, measured (the review's fight-core bench, before and after)

The combat review v2.34's node bench (docs/audits/combat-v2.34.md, "The setup"): real `Foes` on flat ground, every
route world's packs 0–5 from `packOf`, three seeds each (216 packs), and every site (50), each fought by the still, the
mashing and the guarding traveller with his hearts on arriving. Before: `a607ab40c`; after: this change.

| World (stage) | One-combo kills, packs | at sites | Attacks before death, packs | Mash: hearts a pack | Guard: hearts a pack | Mash: hearts a site | Guard: hearts a site |
|---|---|---|---|---|---|---|---|
| The Desert (0) | 100 → 87 % | 94 → 30 % | 0.33 → 1.17 | 0.00 → 0.22 | 0.00 → 0.00 | 0.31 → 0.63 | 0.00 → 0.00 |
| Vael (0) | 100 → 60 % | 78 → 50 % | 0.88 → 2.00 | 0.69 → 0.81 | 0.07 → 0.00 | 0.88 → 1.69 | 0.00 → 0.38 |
| Lorn (1) | 89 → 64 % | 81 → 54 % | 0.98 → 1.79 | 0.63 → 0.83 | 0.19 → 0.08 | 1.20 → 1.30 | 0.65 → 0.60 |
| Viridel (2) | 79 → 74 % | 64 → 43 % | 1.38 → 1.88 | 0.65 → 0.93 | 0.21 → 0.24 | 1.50 → 3.38 | 0.81 → 2.06 |
| The Underwater City (2) | 50 → 49 % | 45 → 25 % | 1.72 → 2.18 | 3.28 → 1.60 | 2.29 → 0.49 | 2.06 → 3.50 | 1.69 → 2.19 |
| The City-Shaft (2) | 57 → 65 % | 45 → 40 % | 1.77 → 1.89 | 1.94 → 1.17 | 1.42 → 0.39 | 1.94 → 2.50 | 0.88 → 0.94 |
| The Glass Dunes (2) | 30 → 54 % | 31 → 50 % | 2.30 → 2.35 | 4.14 → 1.79 | 2.22 → 0.64 | 2.81 → 2.75 | 0.81 → 1.50 |
| The Buried Machine (3) | 34 → 46 % | 40 → 25 % | 2.23 → 2.59 | 3.96 → 1.82 | 2.33 → 0.42 | 2.25 → 4.69 | 1.44 → 1.81 |
| The Moon Foundry (3) | 38 → 42 % | 43 → 27 % | 2.40 → 3.25 | 5.08 → 2.06 | 2.93 → 0.56 | 5.25 → 7.13 | 2.56 → 2.81 |
| The Garden of Spheres (3) | 0 → 12 % | 0 → 6 % | 3.30 → 3.99 | 5.79 → 3.19 | 2.03 → 1.31 | 3.20 → 3.80 | 2.10 → 3.30 |
| The City Floating in Space (3) | 39 → 22 % | 38 → 40 % | 2.41 → 4.01 | 3.68 → 3.17 | 1.51 → 1.42 | 1.67 → 5.33 | 0.00 → 1.00 |
| The Signal Market (4) | 15 → 1 % | 0 → 11 % | 3.08 → 4.47 | 8.18 → 5.58 | 6.25 → 2.31 | 7.25 → 6.55 | 4.80 → 2.70 |

Before at `a607ab40c`; after, this change (the scratch bench: the combat review's `bench.mjs`, `analyse.mjs`). Hearts
are a pack's or a site's mean (the bench tops the traveller up under 1.5); "one-combo kills" the share of the foes the
masher killed within three hits and 2.2 s.

- **The first three worlds no longer die to one combo**: in packs the share fell 100 → 87 % (the Desert, its blots and
  its first grunts), 100 → 60 % (Vael), 89 → 64 % (Lorn); at their sites 94 → 30 %, 78 → 50 %, 81 → 54 %. A foe there
  now starts 1.2–2.0 attacks before it dies (0.3–1.0 before). The grunt alone still dies inside one combo 55–60 % of the
  time (two hearts: the combo's heavy third swing, three, ends a fresh one); the prowler 1–3 %, the hulk, the sentinel
  and the warlord never.
- **No world is a wall.** A wandering pack costs the masher 0.2 → 0.8 → 0.9 → 0.9 → 1.6 → 1.2 → 1.8 → 1.8 → 2.1 → 3.2 →
  3.2 → 5.6 hearts along the route (before: 0 → 0.7 → 0.6 → 0.7 → 3.3 → 1.9 → 4.1 → 4.0 → 5.1 → 5.8 → 3.7 → 8.2); the
  careful player 0 → 2.3 at the Market (6.25 before: the review's rec. 6, softened). Every pack was cleared by both bots
  but one Floating City pack by the guard in 60 s. The sites are the harder fights now (a hulk at every camp, a warlord a
  world): the Market's 6.6 / 2.7 hearts a site (7.3 / 4.8 before), the Moon Foundry's 7.1 / 2.8, the Floating City's 5.3
  / 1.0 (1.7 / 0 before). Two late sites that cost a careful player 11–14 hearts in a first try were cut: a fencer out of
  the Market's beat, a camp of six grunts and a hulk to five.
- **What it costs**: the late worlds' packs are gentler than before (Glass Dunes to Market, the masher's hearts about
  halved; one-combo kills in the Glass Dunes and the Buried Machine up 30 → 54 % and 34 → 46 %). The tiers carry them
  (`TIER_SHARE` from stage 3 as before); if the old peak is wanted, a tier share from stage 2 or more prowlers in the
  stage-2 packs is the lever.
