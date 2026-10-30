# Enemy rebuild, phase 1: the baseline (#800)

Phase 1 of [issue #800](https://github.com/rnaud/hiraeth/issues/800), made 30 October 2026 on main at
`f50d71928` (after #741, #794, #797 landed). It changes no game code and rebuilds no enemy. It records:

1. what each of the 29 archetype IDs in rebuild scope is today, and what any rebuild must keep;
2. the selected Midjourney source images (all 45 originals now archived; see section 2);
3. baseline pictures, motion strips and costs of the four trial foes (crab, hound, brute, mummer);
4. the phase 2 brief: eight prototypes (direct and Tripo for each of the four), the harness, the measures, the inputs
   the author must pick, and the cost.

Read it with [the handoff](enemy-rebuild-2026-10-30.md) and the canonical manifest `tools/enemy-review-references.js`.

## 1. The 29 archetypes on main today

How it was read: `src/enemies/archetypes.js` (ARCHETYPES), `skins.js`, `plans/index.js` (BUILDERS), `src/foe-worlds.js`
(WORLDS, `worldArchetypes`), `src/foes.js` (ARENA_KINDS, #797), `src/foe-sounds.js` (`callKey`/`moveKey`, #771),
`src/foe-sound-trims.js`, `src/enemies/defeat.js` (DEATHS, DEFEATS, `leavesBody`, #767/#797) and
`src/enemies/foe-ragdoll.js` (#750/#794). Every model was built in node in its home skin; the counts are of that
build (all meshes, including weapon and prop variants kept at scale 0, so they are upper bounds; the game batches
some of them, see section 3 for the drawn cost of the four trial foes). "Drawn h" is the node build's bounding
height (with props, horns and raised weapons), "def r/h" the gameplay radius and height (`grow`n where #741 applied).

All 29 are `status: 'built'`, all are in the Arena's run (ARENA_KINDS: 29 kinds plus the temple `machine`; the
discarded `lizard`, `heron` and `marionette` are OUT_OF_PLAY and stay so). The seven roster-v4 bodies (`grunt`, `hulk`,
`prowler`, `warlord`, `sentinel`, `oracle`, `crawler`) have one Arena-only skin each and are fielded in no world
roster yet (staged at a site behind a flag, #726).

| ID | Body (file · builder) | Rig · motion | Skins (home first) | Fielded in | Drawn h · def r/h (m) | Voice · steps | Death · body left | Meshes · tris · mats |
|---|---|---|---|---|---|---|---|---|
| `crab` | shellback crab · plans/walker.js `crabModel` | motion kit (procedural legs) | 7: arzach2, garage, bazaar, saltharbour, glassdunes, underwater, antennas | arzach, arzach2, underwater, garage, glassdunes, bazaar, saltharbour, antennas | 2.36 · 0.85/0.60 | shell · walker | beast · recipe, lying body (#797) | 67 (0 skinned) · 8600 · 9 |
| `toad` | bellows toad · plans/hopper.js `toadModel` | motion kit (procedural legs) | 4: perdide, incal, waterfall, home (Arena-only: home) | perdide, incal, waterfall | 2.95 · 0.85/1.10 | bellows · hopper | beast · recipe, lying body (#797) | 47 (0 skinned) · 7580 · 9 |
| `centipede` | ring centipede · plans/centipede.js `centipedeModel` | motion kit (procedural legs) | 6: buried, spheres, fallenring, eclipse, waterfall, antennas | buried, spheres, waterfall, antennas, eclipse, fallenring | 1.18 · 0.75/0.55 | chitin · centipede | long · recipe, lying body (#797) | 190 (0 skinned) · 13332 · 9 |
| `rootknot` | root knot · plans/tentacled.js `rootknotModel` | motion kit (procedural legs) | 5: perdide, perdide2, edena, mangrove, waterfall | perdide, perdide2, edena, mangrove, waterfall | 3.38 · 0.95/1.50 | roots · tentacled | plant · recipe, lying body (#797) | 50 (0 skinned) · 14360 · 8 |
| `jelly` | lantern jelly · plans/floater.js `jellyModel` | procedural, own (no kit legs) | 5: arzach2, perdide2, spheres, underwater, fallenring | arzach2, perdide2, underwater, spheres, fallenring | 2.42 · 0.75/0.60 · hover 3.60 | glass · floater | flyer · recipe, lying body (#797) | 134 (0 skinned) · 5450 · 10 |
| `moth` | signal moth · plans/flyer.js `mothModel` | procedural, own (no kit legs) | 5: perdide2, edena, bazaar, antennas, spacecity | perdide2, edena, spacecity, bazaar, antennas | 1.39 · 0.50/0.40 · hover 1.60 | paper · flyer | flyer · recipe, no body | 126 (0 skinned) · 4908 · 8 |
| `ray` | sky ray · plans/glider.js `rayModel` | procedural, own (no kit legs) | 6: arzach, arzach2, garage, glassdunes, underwater, underside | arzach, arzach2, underwater, garage, glassdunes, underside | 1.11 · 0.90/0.30 · hover 3.60 | ray · glider | flyer · recipe, lying body (#797) | 60 (0 skinned) · 2092 · 5 |
| `worm` | mound worm · plans/burrower.js `wormModel` | procedural, own (no kit legs) | 3: desert, buried, glassdunes | desert, glassdunes, buried | 3.35 · 0.80/1.10 | earth · burrower | burrower · recipe, no body | 40 (0 skinned) · 4577 · 10 |
| `fencer` | makers’ fencer · plans/fencer.js `fencerModel` | humanoid rig, **clips** (#724) + procedural layers | 3: moonfoundry, spacecity, bazaar | moonfoundry, spacecity, bazaar | 2.19 · 0.50/1.45 | steel · fencer | humanoid · ragdoll (#750/#794) | 7 (6 skinned) · 4384 · 7 |
| `blot` | ink blot · plans/blob.js `blotModel` | procedural, own (no kit legs) | 22: desert, arzach, arzach2, perdide, perdide2, edena, incal, garage, buried, spheres, bazaar, mangrove, glassdunes, waterfall, saltharbour, antennas, underwater, eclipse, fallenring, moonfoundry, underside, spacecity | desert, arzach, arzach2, perdide, perdide2, edena, incal, buried, moonfoundry | 1.09 · 0.60/0.55 | ink · blob | spirit · recipe, no body | 30 (0 skinned) · 2972 · 5 |
| `hound` | antler hound · plans/quadruped.js `houndModel` | motion kit (procedural legs) | 4: eclipse, mangrove, spheres, bazaar | spheres, bazaar, mangrove, eclipse | 2.64 · 0.55/1.15 | smoke · quadruped | beast · recipe, lying body (#797) | 54 (0 skinned) · 5919 · 7 |
| `grunt` | grunt · plans/monster.js `gruntModel` | humanoid rig, **clips** (#724) + procedural layers | 1: desert (Arena-only: desert) | — (Arena; v4 site flag) | 2.27 · 0.65/1.89 · ×1.45 (#741) | flesh · monster | humanoid · ragdoll (#750/#794) | 9 (7 skinned) · 10234 · 8 |
| `hulk` | hulk · plans/monster.js `hulkModel` | humanoid rig, **clips** (#724) + procedural layers | 1: desert (Arena-only: desert) | — (Arena; v4 site flag) | 2.66 · 1.00/2.70 | flesh · monster | humanoid · ragdoll (#750/#794) | 10 (8 skinned) · 7872 · 9 |
| `prowler` | prowler · plans/monster.js `prowlerModel` | humanoid rig, **clips** (#724) + procedural layers | 1: desert (Arena-only: desert) | — (Arena; v4 site flag) | 1.85 · 0.45/1.80 | scale · monster | humanoid · ragdoll (#750/#794) | 7 (6 skinned) · 8648 · 7 |
| `warlord` | warlord · plans/monster.js `warlordModel` | humanoid rig, **clips** (#724) + procedural layers | 1: desert (Arena-only: desert) | — (Arena; v4 site flag) | 3.31 · 0.85/2.50 | hide · monster | humanoid · ragdoll (#750/#794) | 12 (7 skinned) · 13186 · 9 |
| `sentinel` | sentinel · plans/sentinel.js `sentinelModel` | humanoid rig, **clips** (#724) + procedural layers | 1: desert (Arena-only: desert) | — (Arena; v4 site flag) | 2.01 · 0.45/1.55 | ceramic · sentinel | humanoid · ragdoll (#750/#794) | 6 (5 skinned) · 6760 · 6 |
| `skitter` | skitter swarm · plans/skitterers.js `skitterModel` | motion kit (procedural legs) | 5: desert, perdide, buried, moonfoundry, underside | desert, perdide, buried, moonfoundry, underside | 0.52 · 0.56/0.39 · ×1.75 (#741) | chitin · skitterers | beast · recipe, no body | 5 (1 skinned) · 5260 · 5 |
| `roller` | pearl roller · plans/roller.js `rollerModel` | procedural, own (no kit legs) | 5: garage, spheres, saltharbour, spacecity, mangrove | garage, spheres, spacecity, mangrove, saltharbour | 1.55 · 0.80/0.90 | roller · roller | shell · recipe, lying body (#797) | 5 (2 skinned) · 8716 · 5 |
| `tripod` | lamp tripod · plans/piston.js `tripodModel` | motion kit (procedural legs) | 5: incal, buried, underwater, fallenring, desert | desert, underwater, incal, buried, fallenring | 4.19 · 0.90/1.60 | steam · machine | machine · recipe, lying body (#797) | 127 (0 skinned) · 8792 · 14 |
| `cart` | crucible cart · plans/tracked.js `cartModel` | procedural, own (no kit legs) | 4: garage, buried, moonfoundry, overnighttrain (Arena-only: overnighttrain) | garage, buried, moonfoundry | 4.27 · 1.10/1.00 | slag · tracked | machine · recipe, lying body (#797) | 19 (7 skinned) · 14058 · 15 |
| `bell` | bell walker · plans/siege.js `bellModel` | motion kit (procedural legs) | 3: bazaar, saltharbour, underside | bazaar, saltharbour, underside | 4.83 · 1.30/2.60 | brass · siege | machine · recipe, lying body (#797) | 16 (4 skinned) · 14908 · 12 |
| `drone` | ring drone · plans/hover.js `droneModel` | procedural, own (no kit legs) | 7: incal, garage, glassdunes, spheres, antennas, spacecity, fallenring | incal, garage, glassdunes, spheres, spacecity, antennas, fallenring | 2.36 · 0.70/0.80 · hover 1.70 | tin · hover | flyer · recipe, lying body (#797) | 9 (5 skinned) · 13388 · 9 |
| `brute` | furnace brute · plans/brute.js `bruteModel` | motion kit (procedural legs) | 5: perdide2, edena, glassdunes, waterfall, moonfoundry | perdide2, edena, glassdunes, moonfoundry, waterfall | 4.72 · 1.15/2.40 | iron · brute | machine · recipe, lying body (#797) | 12 (3 skinned) · 16342 · 9 |
| `shade` | shade · plans/humanoid.js `shadeModel` | humanoid rig, **clips** (#724) + procedural layers | 6: perdide2, incal, garage, spheres, glassdunes, eclipse | perdide2, incal, garage, glassdunes, spheres, eclipse | 3.15 · 0.45/1.30 | cloth · humanoid | spirit · recipe, no body | 9 (7 skinned) · 10008 · 9 |
| `wisp` | ember wisp · plans/ember.js `wispModel` | procedural, own (no kit legs) | 3: moonfoundry, perdide2, eclipse | perdide2, moonfoundry, eclipse | 2.16 · 0.60/0.50 · hover 4.20 | ember · ember | flyer · recipe, lying body (#797) | 6 (2 skinned) · 5924 · 5 |
| `mummer` | mummer · plans/mummer.js `mummerModel` | humanoid rig, **clips** (#724) + procedural layers | 2: desert, glassdunes (Arena-only: glassdunes) | desert | 2.09 · 0.63/1.65 · ×1.5 (#741) | junk · mummer | spirit · ragdoll (#750/#794) | 9 (7 skinned) · 9738 · 8 |
| `mummerking` | mummer king · plans/mummer.js `mummerKingModel` | humanoid rig, **clips** (#724) + procedural layers | 1: desert | desert | 2.68 · 0.95/2.60 | junk · mummerking | humanoid · ragdoll (#750/#794) | 11 (9 skinned) · 8040 · 10 |
| `oracle` | oracle · plans/oracle.js `oracleModel` | humanoid rig, **clips** (#724) + procedural layers | 1: desert (Arena-only: desert) | — (Arena; v4 site flag) | 1.98 · 0.45/1.30 · hover 0.35 | ceramic · oracle | flyer · recipe, lying body (#797) | 11 (4 skinned) · 5388 · 6 |
| `crawler` | crawler · plans/crawler.js `crawlerModel` | motion kit (procedural legs) | 1: desert (Arena-only: desert) | — (Arena; v4 site flag) | 0.93 · 0.57/0.68 · ×1.5 (#741) | servo · crawler | machine · recipe, lying body (#797) | 5 (4 skinned) · 5118 · 5 |

Rig: "humanoid rig, clips" is `src/enemies/humanoid-rig.js` (#724): one skeleton on the traveller's clip library
(`ual.glb` + `moves.glb`), each foe state mapped to a clip, the wind-up clip stretched over the foe's own wind-up and
held from 75 %, procedural layers (gaze, feet IK to the slope, sway springs, weapons in the clip's fist) over it.
"motion kit" is `src/motion-kit/` (gait planner, IK, springs: legs planted in world space). "own" bodies animate
their parts in their own `anim()` (flyers, floaters, rollers, tracks, the blot). Voice is FOE_CALLS's key (the kind's
own, else its `sound` family); steps are FOE_MOVES keyed by the archetype's **plan** name (`moveKey`), so a rebuild that
renames `plan` silently changes its footsteps. Every voice has its trims (FOE_TRIM, `scripts/sound-qc/foe-levels.mjs`).

### What every rebuild keeps (all 29)

- **IDs and compatibility:** the archetype id, `kind`, every skin id in `SKINS[id]` (saves, world rosters, sites,
  `?enemy=<kind>@<skin>` links and `changelog-media` views name them), its DEATHS entry, GROUP/COSTS/FROM in
  `foe-worlds.js`, chimes drop, gallery rows (`enemies.html`) and the bestiary names.
- **Size (#741):** the GROWN scales (mummer ×1.5, grunt ×1.45, skitter ×1.75, crawler ×1.5) and `grow`n radius,
  height and hover; `tests/foe-heights.test.js` (bipeds at least the traveller's 1.75 m, no foe under his hip, none
  wider or taller than the temple machine). Attack reach is measured from the centre, still past the body.
- **Fight core (#722, #661):** the def's attacks with their ids, wind-ups (`WIND_MIN`), strike/contact windows,
  `tell(attackId)` glow on the striking part, warning cues; only lobs mark the ground (`tests/telegraphs.test.js`);
  guards (`def.guard`: pose, arc, blocks, breaks), tiers (`TIERS`, `tierSkin` banded look), weak points and zones,
  `takes`/`weak` immunities, parry effects (`onParry`).
- **Sounds (#771):** calls (alert, cry, bark, idle, death), effort and blow by `attackSort`, steps/flaps/hums from
  the plan, the mix caps (3 voices, 3 blows), trims. A new anatomy keeps its voice family or gets a new FOE_CALLS
  entry plus `foe-levels.mjs` trims; a new gait needs its FOE_MOVES entry, timed to its real foot contacts.
- **Death and bodies (#750, #767, #794, #797):** the DEATHS recipe per archetype (`tests/foe-deaths.test.js`); a
  humanoid on the rig ragdolls through `M.joints` (cap `RAGDOLL.most`), fitted to the drawn hull (`defeatHull`, FIT)
  and stopped by walls; a recipe body leaves a lying footprint the traveller cannot walk through (`lyingBody`,
  `keepOffBodies`; none for spirits, burrowers, light or flocking foes); machines come apart (`src/enemies/debris.js`,
  materials disposed after the debris expires).
- **Arena run (#797):** every skin is warmed at load and bodies are kept; `Foes.buildAhead` builds the next body;
  a body that comes apart has an unbatched warm copy. A new model must stay warmable (no lazy program variants at
  the blow) or the 75–827 ms arrival stutter returns.
- **Model contract:** `{ group, body, rig, parts, eyeMat, size, tones, tell(attackId), anim(f, c), dispose() }`
  (plans/index.js); per-enemy warning materials owned and released; draws batched within a joint, never across.
- **Surfaces and skins:** `SURFACES[id]` (procedural surface, mandatory) and each skin's palette and props.
- **Unity parity:** the same JS runs in Unity; foe surfaces go through `engine/foe-pack.js` and FoeSurface.hlsl.
  A GLB texture (JPEG) is not decoded by the engine VMs: generated bodies use sampled vertex colours (as the
  Keeper and the Elder) or the `ENCODED_PICTURES` route (engine/boot.js).

### What each one keeps (its own mechanics)

| ID | Keep: attacks (ids) and what makes it play as it does |
|---|---|
| `crab` | snap, spin, burrow (Salt Harbour and Underwater only); a shell that rings off light blows (heavy ones bite at half), the tucked guard (#661) broken by the air cut or a bomb and flipping it; a guarded spin flips it; sideways scuttle in bursts; wild, shy, grazes. hp 3, bombs ×1.5 |
| `toad` | lob and volley (a shot into the swollen throat chokes it), belly-flop leap with a ground wave (the air cut meets it: double, onto its back); hops on planted feet; perches |
| `centipede` | ring (it spirals round you, its body a wall), lunge; segmented plates (half from behind or the side, the head double), tail segments shed as small foes; ripple death |
| `rootknot` | pod and seeds lobs (#769), spore puff (blur); rooted (never knocked back); wilts and sinks |
| `jelly` | support: ward (up to 3 lanterns, a shot pops one), mend, curtain; joins any fight, never starts one; escort blot in the Arena |
| `moth` | flash, dart, dust (the lock-on slips); a group of 3; light, flinchy |
| `ray` | skim (a perfect parry ploughs it into the ground, open), lash, downdraft (breaks the glide) |
| `worm` | erupt where you stand, spit stones while up, dive; burrows (no lying body) |
| `fencer` | overhead, sweep, leap, bash, shove on clips (FENCER_MOVES); shield guard, turtle, sword knocked away (`disarm`); stout; ragdolls |
| `blot` | lunge, combo/again chain, far spit lob; the teacher of every world (22 skins), pools when calm |
| `hound` | pounce (its coiled snarl cue), step, bite, antler rake below two thirds; `phase` (a hit sends it into an ink pool, seen in the hurt strip); pairs |
| `grunt` | club, lunge, jab, bow volley, rock lob; weapons from racks, disarm, the first light cut shrugged off, hangs back; #768 Tripo trial is pipeline evidence only |
| `hulk` | smash, sweep, stomp (a jump clears it), throws a grunt; stout, heavy; answers button-mashing |
| `prowler` | slash, dart, tail sweep on the ground, spit lob; circles at 3.4 m |
| `warlord` | sweep, overhead, charge, roar (calls the pack), whirl below a share of health; hp 12 |
| `sentinel` | thrust, cut, bash, dash, riposte; shield guard and turtle |
| `skitter` | rush and pile (a heap topples on you; the push scatters it); a flock of 8 that rings you and strikes one at a time |
| `roller` | bowl, ricochet, a last roll below its health; rolled up, blows glance off |
| `tripod` | beam (its aim tracks, then locks), stamp, vent; keeps its distance; placed in the Desert too |
| `cart` | pour (slag that stays), ram; turns on tracks, a bomb on them jams it; douses fire |
| `bell` | toll (a sound ring to jump), clapper drop leap; stout |
| `drone` | harpoon (a tether), ram; hovers |
| `brute` | slam (a quake ring to jump), hurl lob, sweep; arms guard, stout (light cuts never stagger it), weak point; comes apart into debris |
| `shade` | cut, feint (a clip stopped at half), step, recut on clips; sword guard; emerges (`melt`), its cloak on springs, no ragdoll (the cloak falls empty) |
| `wisp` | fireball (cued), flare; hovers high |
| `mummer` | whack, jab, bow volley, rock lob; club, spear and bow as droppable parts, a guarded club flies, the mask knocked off (it runs, then swings blind); camps and lookouts with its king; pairs; ragdolls |
| `mummerking` | smash, royal swing, horn (wakes the camp), throws a mummer that lands dazed; heavy, stout; its Desert site |
| `oracle` | three volleys, ward (one lantern), wake, pulse; keeps casting; floats (no ragdoll) |
| `crawler` | bite, call (cued), blast below a share of health; knee-high scout in bursts |

## 2. The selected source images

**Resolved after the baseline audit:** all 45 selected originals are now saved unchanged in
`references/enemy-redesign-2026-10-30/<concept-key>/<job>-<index>.png`, downloaded using
Midjourney’s Download image action in the signed-in internal browser on 2026-10-30.
All are 1232 × 928 PNGs. The folder’s `originals.json` records provenance, sizes and
SHA-256 checksums, and each concept folder has a README. No author download is needed.
The original audit’s direct CDN requests returned HTTP 403; the browser download
resolved that blocker without changing the selections or substituting previews.
The existing `shellback.webp` remains a historical 640px preview only.

The table below uses zero-based indices (index 0 is “option 1”). All four trial images
and the remaining roster inputs are available locally. Other phase 2 gates remain below.

| Priority | Concept key | Existing ID | Job | Index |
|---|---|---|---|---|
| trial | shellback | crab | e8102be7-014a-4a03-8150-394a7f722fec | 2 |
| trial | hound | hound | 5d7b275f-a6fd-4e34-a0fe-7c6d4ebc850a | 1 |
| trial | keep-brute | brute | a1860f49-ecc5-4922-91f6-94b031e5e9a7 | 0 |
| trial | keep-mummer | mummer | ad94a6b0-55ba-461e-9577-d745036565ae | 1 |
| roster | bellows-toad | toad | c5a76758-e908-4034-acc5-7b88452dcb71 | 0 |
| roster | centipede | centipede | 616e0bd4-9a63-476b-9485-1e5efda02210 | 3 |
| roster | reed-knot | rootknot | 0de92fb6-aa84-4252-b110-fd96a9913888 | 1 |
| roster | cloud-jelly | jelly | 0cdfba00-da12-409f-8fd5-03de262f50ca | 1 |
| roster | lamp-moth | moth | 5b88e9ea-3cc5-4ea8-ab97-4431bfb5584b | 1 |
| roster | storm-ray | ray | 4fc2da68-aa8c-4a93-bc00-5f1795b5e039 | 0 |
| roster | dune-worm | worm | ca727e90-9d58-49d2-a060-bbbd815e325f | 3 |
| roster | fencer | fencer | dd52ce4f-1165-4d5c-b09b-a459cf2baa4d | 1 |
| roster | blob | blot | eb43fb37-f063-47ab-9a4f-212ba29d443b | 2 |
| roster (open) | cistern-forager | grunt | e7f4d3f5-de8c-4c1e-8c6c-69804bac7b85 | 1 |
| roster (open) | cistern-forager | grunt | 509d2563-8e51-4650-8bd1-13b032b0fff9 | 0 |
| roster (open) | cistern-forager | grunt | c4086168-5ecf-4644-9163-3fc1645be0aa | 0 |
| roster (open) | salt-drifter | grunt | 504390cd-9735-4e47-9526-abe8fe95f29f | 3 |
| roster (open) | salt-drifter | grunt | e0af33a3-1cce-4a8e-8820-054651a5f08f | 2 |
| roster | hulk | hulk | 69ae4d9f-9bdb-4eab-998a-08bdf543617d | 2 |
| roster | prowler | prowler | 5d011893-58f1-4c33-a34d-ac8df1a99842 | 2 |
| roster | warlord | warlord | b7d9aa56-69bf-44a7-becc-6a2e9737b4bf | 2 |
| roster | sentinel | sentinel | 395884ff-9eec-4903-ba5c-e910310ff88d | 0 |
| roster | keep-skitter | skitter | 711f83a4-63bc-4576-b299-458c14ce5bac | 1 |
| roster | keep-roller | roller | f586ce93-9d9c-4203-a22c-2731075f1065 | 1 |
| roster | keep-tripod | tripod | 9bb4fd97-30dd-471d-8ac0-c8da599468ee | 0 |
| roster | keep-cart | cart | 13ed7341-1960-43e2-8f12-8b8481c2bd68 | 3 |
| roster | keep-bell | bell | b4852320-c23b-4bf7-a8e2-10c9ede8cabd | 1 |
| roster | keep-drone | drone | e708a0d0-e805-46fd-aee5-4c328202ff41 | 0 |
| roster | keep-shade | shade | 91fff498-280d-4229-bae9-e270dee52ba4 | 3 |
| roster | keep-wisp | wisp | 885e3431-b1b8-4db6-ad7b-c772cd14d530 | 3 |
| roster | keep-mummerking | mummerking | 71c2e792-5ceb-40f7-966d-19b12c1b10a6 | 1 |
| roster | keep-oracle | oracle | b4b39e06-0115-4b08-8d3b-1e017919b98c | 1 |
| roster | keep-crawler | crawler | 22d8861b-51c8-4a48-9776-9c45ee542615 | 0 |
| new | boar (reserved) | — | 221148a3-5cfa-4c0d-a595-7816f210f56e | 3 |
| new | dew-gatherer | — | fee16b22-fbf9-4250-a225-8179ef4fa67d | 1 |
| new | dew-gatherer | — | 7e1ddd98-bd37-45c2-8128-61192ea5d24a | 3 |
| new | tripod-surveyor | — | 1cb3a983-41de-4c96-9b19-cd143990c114 | 3 |
| new | plumb-walker | — | ef3b0203-c81d-4f64-bd85-1253a5598144 | 1 |
| new | kiln-beetle | — | d83c3f89-4602-41ca-a8e5-bad7f9ce5a5f | 1 |
| new | compass-warden | — | c397331d-8fc5-470e-bbbb-6cd4e453ada9 | 0 |
| new | puff-keeper | — | 7ae3347a-d68f-4d71-928a-cab8ec66cff2 | 1 |
| new | shovel-mole | — | 57f66563-892d-4373-a2d6-83c631e7e9b0 | 1 |
| new | cistern-ram | — | ea19bfb0-518c-4868-b2f5-41db51095ec8 | 1 |
| new | pebble-hare | — | 31d4e042-743f-422b-a815-95c153d539fc | 2 |
| new | seed-splitter | — | c0860859-bd12-43ff-8228-782a68ec39fd | 1 |

(45 images. The jobs are the manifest's after `APPROVED_STYLE`; its `CONCEPTS` table above that block still lists
the superseded first passes for twelve concepts, kept as `previousSelections`. Do not download those.)

## 3. Baseline evidence: the four trial foes

**How.** `references/enemy-redesign-2026-10-30/baseline/baseline-shots.mjs` (muted headless Chrome on its own Vite,
ports 5462/5463): the real Arena on the High preset at 1280×720, 10:00, clear, the game loop held
(`window.cinematicReview.paused`), each frame posed by hand (`foes.look` for idle, walk, turn and the attack; the
game's own `Foes.hurt` then `Foes.update` for hurt and death) and drawn by `renderFrame`. Every foe stands on the
same spot with the same pinned camera (three-quarter front 14 m away, fov 35; side on for walk and attack, the view
following the walk) and the traveller (1.75 m) beside it, so sizes compare directly. Mute checked before any frame
(`sound.muted`, master level 0, context gain 0). One page per foe, so no debris carries over. Each strip is eight
frames, game time in the label (attack: wind 50/75/97 %, strike 50/97 %, recover 35/90 %). Web only.

| Foe (home skin) | Still | Idle | Walk | Turn | Attack | Hurt | Death |
|---|---|---|---|---|---|---|---|
| crab@arzach2 | [still](../../references/enemy-redesign-2026-10-30/baseline/crab-still.webp) | [idle](../../references/enemy-redesign-2026-10-30/baseline/crab-idle.webp) | [walk](../../references/enemy-redesign-2026-10-30/baseline/crab-walk.webp) | [turn](../../references/enemy-redesign-2026-10-30/baseline/crab-turn.webp) | [snap](../../references/enemy-redesign-2026-10-30/baseline/crab-attack.webp) | [hurt](../../references/enemy-redesign-2026-10-30/baseline/crab-hurt.webp) | [death](../../references/enemy-redesign-2026-10-30/baseline/crab-death.webp) |
| hound@eclipse | [still](../../references/enemy-redesign-2026-10-30/baseline/hound-still.webp) | [idle](../../references/enemy-redesign-2026-10-30/baseline/hound-idle.webp) | [walk](../../references/enemy-redesign-2026-10-30/baseline/hound-walk.webp) | [turn](../../references/enemy-redesign-2026-10-30/baseline/hound-turn.webp) | [pounce](../../references/enemy-redesign-2026-10-30/baseline/hound-attack.webp) | [hurt](../../references/enemy-redesign-2026-10-30/baseline/hound-hurt.webp) | [death](../../references/enemy-redesign-2026-10-30/baseline/hound-death.webp) |
| brute@perdide2 | [still](../../references/enemy-redesign-2026-10-30/baseline/brute-still.webp) | [idle](../../references/enemy-redesign-2026-10-30/baseline/brute-idle.webp) | [walk](../../references/enemy-redesign-2026-10-30/baseline/brute-walk.webp) | [turn](../../references/enemy-redesign-2026-10-30/baseline/brute-turn.webp) | [slam](../../references/enemy-redesign-2026-10-30/baseline/brute-attack.webp) | [hurt](../../references/enemy-redesign-2026-10-30/baseline/brute-hurt.webp) | [death](../../references/enemy-redesign-2026-10-30/baseline/brute-death.webp) |
| mummer@desert | [still](../../references/enemy-redesign-2026-10-30/baseline/mummer-still.webp) | [idle](../../references/enemy-redesign-2026-10-30/baseline/mummer-idle.webp) | [walk](../../references/enemy-redesign-2026-10-30/baseline/mummer-walk.webp) | [turn](../../references/enemy-redesign-2026-10-30/baseline/mummer-turn.webp) | [whack](../../references/enemy-redesign-2026-10-30/baseline/mummer-attack.webp) | [hurt](../../references/enemy-redesign-2026-10-30/baseline/mummer-hurt.webp) | [death](../../references/enemy-redesign-2026-10-30/baseline/mummer-death.webp) |

What the pictures show (all looked at; "after-only" pictures of today's game, not a before/after of a change):

- **crab** (drawn 2.64 × 2.36 × 1.86 m with raised claws): a low studded slate dome on six thin jointed legs
  ending in points, two pale claws held high, eye stalks. Far from the approved shellback (a tall ochre dome over a
  simple face, six thick legs on broad red feet, two big red claws held in front). Walk: the sideways scuttle, legs stepping. Turn: steps round on
  the spot. Snap: the near claw opens and draws back, then snaps; a short strike (0.2 s). Hurt: a light cut rings off
  the shell (hp unchanged, a recoil), then it backs off low. Death: legs fold, belly down, claws over the face, then
  the dust puff.
- **hound** (1.36 × 2.66 × 2.66 m, horns included): a black stick-legged body under a spiky purple mane, long pale
  antlers, pale belly sac. Thin weight-bearing legs and the mane are exactly what the new brief rejects. Walk: a
  trot on planted feet. Pounce: a long, low coil (1.0 s) then the leap over the traveller. Hurt: it phases into an
  ink pool (its `phase` escape) and waits there. Death: legs fold, ink puff.
- **brute** (4.39 × 4.72 × 3.47 m with the saw): the furnace brute, a very large stone-and-brass body with a saw
  hand and a clamp fist, knuckle-walking. Already a "wood cutter" in parts (saw forearm, heavy feet) but about
  2.7× the traveller's height, far bigger than the compact forest robot of the new reference. Slam: the saw arm rises
  straight up over 1.3 s and comes down into the ground; reads well side on. Hurt: stout, a light cut does not stagger
  it; it goes straight on into an attack. Death: it sags, topples and comes apart into its pieces.
- **mummer** (1.16 × 1.83 × 1.35 m with its weapon, ×1.5 since #741): the gourd/coffee-pot mask on a short blue body,
  sack and club. Idle at heading 0 shows its back pack side to this camera (its face turns to the traveller); the
  turn strip shows the face. Walk: a crouched scuttle on clips. Whack: the club raised over the head and brought down
  (clip). Hurt: a flinch and back to its guard; weapons vary per spawn (spear in the death strip). Death: the
  ragdoll falls with the spear, then the puff.

The cost of one and of six, in the Arena on this Mac (Apple M-series, headless Chrome on Metal, 1280×720, the
foes standing posed 7–11 m in front of a fixed camera: `scripts/enemy-roster/bench.mjs`, two rounds, order
reversed). Draws and triangles are renderer.info's for the whole frame, all passes, minus the empty Arena's; CPU
and GPU are medians of 8 s of frames minus the empty Arena's, so they are noisy to about ±0.5 ms on this shared
machine. Materials are the node build's. Desktop numbers for comparing variants, not device budgets.

| Foe | Materials | Preset | Draws, 1 · 6 | Triangles (all passes), 1 · 6 | CPU ms, 1 · 6 | GPU ms, 1 · 6 |
|---|---:|---|---|---|---|---|
| empty Arena | – | High | 87 | 267k | 2.15 | 7.52 |
| crab@arzach2 | 9 | High | +102 · +594 | +26.3k · +151.0k | +0.15 · +0.80 | +1.05 · +0.71 |
| hound@eclipse | 7 | High | +20 · +93 | +4.0k · +22.0k | +0.05 · +0.60 | -1.08 · -0.60 |
| brute@perdide2 | 9 | High | +35 · +195 | +51.8k · +296.2k | +0.35 · +1.05 | -2.34 · -2.09 |
| mummer@desert | 8 | High | +27 · +162 | +27.8k · +173.5k | +0.15 · +1.15 | -1.67 · -0.35 |
| empty Arena | – | Handheld | 76 | 118k | 2.10 | 3.65 |
| crab@arzach2 | 9 | Handheld | +66 · +396 | +16.9k · +101.6k | +0.25 · +1.00 | +0.40 · +0.30 |
| hound@eclipse | 7 | Handheld | +16 · +68 | +3.9k · +16.0k | +0.10 · +0.30 | +0.48 · -0.21 |
| brute@perdide2 | 9 | Handheld | +23 · +128 | +35.4k · +199.8k | +0.15 · +0.70 | +0.22 · +1.50 |
| mummer@desert | 8 | Handheld | +18 · +108 | +19.4k · +116.8k | +0.15 · +1.05 | +0.08 · +1.08 |

(36 runs, 2 rounds; uptime load during the runs 4.9–23.4; frames vsync-capped at 16.7 ms on both presets, so the frame time itself says nothing here.)

Reading it: **draws are the clear signal.** The crab costs about 100 draws a body on High (66 on Handheld), six of
them nearly 600: its 67 separate meshes (legs, joints, studs, stalks) are not batched, and it is the one to fix
whatever wins. The hound is cheap (about 20, fewer per body in a pack: the far ones are its running shadow). The
brute is the heaviest in triangles (about 52k a body over all passes, 300k for six) for 35 draws; the mummer on its
clips about 28k and 27 draws. CPU: about 0.1-0.35 ms a body (a pack of six +0.6 to +1.15 ms), the mummer's clips
and the brute's skinned kit the dearest. **The GPU timer did not separate the foes from the empty Arena** at this
machine's load (deltas of either sign up to 2.3 ms; the control itself 7.5 ms on High): no GPU claim is made from
these runs. Raw runs: `references/enemy-redesign-2026-10-30/baseline/bench.jsonl`.

## 4. Phase 2 brief: eight prototypes

### Inputs (gates)

1. **The four originals at full resolution — satisfied** (section 2): archived in `shellback/`,
   `hound/`, `keep-brute/` and `keep-mummer/` under the reference folder. Use those unchanged PNGs.
2. **The mummer's T-pose** (the character skill's hard gate for a Tripo humanoid): Midjourney in the visible internal
   browser, from `keep-mummer` job `ad94a6b0-…` index 1 as the image prompt, one frontal full-body T-pose: arms
   straight out, open empty hands with separated fingers, legs apart, no club, flat even light, plain background.
   Generate 4–8 options; **the author hearts one** before any credit is spent. Same for a clean side view if the
   front alone gives a muddled sack or mask.
3. **Rest views for the three non-humanoids** (optional, author's pick if made): the selected images may be enough
   for single-image Tripo generation if they show the whole body without occlusion; the shellback preview does (six
   legs, claws and face all visible, plain background). If the hound's or the wood cutter's selected image hides a
   leg or the tool arm, generate a neutral standing side view from it and have the author pick it.
4. **Tripo account and credits**: the author confirms which Tripo route (Studio as in #768, or the API key
   `TRIPO_3D_API_KEY` through `scripts/reference-lab/providers/tripo.mjs`) and the credit ceiling below.

### The two variants per foe

- **Direct** (the agent authors it with the game's builders): a new body in `src/enemies/plans/` drawn to the
  approved image, its procedural surfaces in `surfaces.js`, palettes in `skins.js`, on the same rig family as today
  (crab and hound on the motion kit, wood cutter on the kit's skinned machine joints, mummer on the humanoid rig and
  its clips), with the anatomy-specific changes the reference needs (six thick legs and broad feet for the
  shellback; thick legs and wide paws for the hound, no mane; a compact 2–2.5 m wood cutter with saw forearm and clamp
  hand, `#741`'s "at least the traveller's size" floor kept; the gourd-and-mask mummer at 1.8 m).
- **Tripo**: the approved image (or the author's picked T-pose for the mummer) → Tripo image-to-3D with Remove
  Lighting on, PBR off, 2k texture, 20–30k face target; the untouched export kept as source. Then per anatomy:
  mummer: Tripo's native humanoid rig (the #768 finding: better belly and finger weights than Meshy) retargeted
  through the #768 adapter pattern onto the humanoid rig's clips; crab and hound: no forced humanoid skeleton, a
  custom skin on the motion kit's leg frames (the Keeper's `src/characters/creature-legs.js` route, #267) or rigid
  parts split at the joints; wood cutter: rigid parts split at the joints and parented to the kit's pivots (a
  machine does not deform). Then the optimisation the skill asks: atlas down to 512–1024², flat colour zones where
  baked hatching prints busier than the ink pass (#768's "flat Tripo" route), a 10–15k LOD, vertex colours sampled
  for the engine VMs.

Both variants keep everything in section 1's lists (IDs, attacks and windows, hit shapes refitted to the new
anatomy, sounds re-timed to the new contacts, deaths, size floors) and stay out of the live roster until chosen.

### The equal-comparison harness

One dedicated review entry (an `arena.html` in a new `trials/` folder beside this phase's `baseline/`), generalising #768's
`arena-bootstrap.js` (page-local storage, review mute applied before the Sound is built, AI frozen to scripted modes,
pack benchmark, invulnerable traveller) to all four foes and three variants: **current | direct | Tripo**, and a
side-by-side mode (the variants 3 m apart on one clock, the same clip or pose at the same moment). The Tripo body is
attached to the real foe at runtime (`f.trial.update()` after `foes.look`, as #768 does), the direct body through a
trial-only builder override in the page, so the game build and roster are untouched until a winner lands. The
capture is this phase's `baseline-shots.mjs` with a `--variant` switch: the same Arena spot, camera, light, traveller
and the same eight-frame strips (idle, walk, turn, the full attack, hurt, death), plus front, side and rear stills,
a clay/unlit pass for the Tripo texture (baked light check), and `bench.mjs`-style packs of 1 and 6. Phase 1's
pictures are the "current" column.

### The measures (one table per foe, both variants and today's)

- **Fidelity to the approved image**: silhouette, proportions, face/eyes, palette, defining equipment, at the
  three-quarter still and side; and readability at combat distance (the 14 m strip frames) under the ink pass.
- **Motion**: `scripts/motion-audit/run.mjs` slide/m, worst contact, reach span, groups, cadence at full and half
  pace; the procedural-animation rubric (8 rows, 0–3); weapon/tool contact (club in the fist, saw on the arm, claws
  closing) in the strike frames.
- **Rig and deformation** (Tripo, and any direct skinning): weights normalised, bind round-trip, isolated joint
  displacement, belly/shell/sack stretch at the extreme poses, as `validate-trial.mjs` did.
- **Combat contacts**: `tests/telegraphs.test.js`, `combat-reach`, `foe-heights`, the combat-review `defend.mjs`
  and `dodge.mjs` on the four kinds (each attack's parry/guard/evade windows unchanged), hit shapes against the new
  mesh.
- **Sound**: each attack's blow on its contact frame, steps on foot contacts (`sound-qc`, muted renders only).
- **Cost**: triangles, draws (all passes), materials, texture memory (RGBA8 + mips), shipped bytes (gzip noted
  separately), CPU and GPU ms for 1 and 6 on High and Handheld (bench.mjs), the Unity batch frame (`-mute`) for the
  winner; and the Retroid only if the handoff's device rules allow it.
- **Effort and money**: agent hours of build and cleanup per variant, Tripo credits per step with job ids.

### Cost estimate

- **Tripo credits** (from #768 and `providers/tripo.mjs`'s price table: image-to-3D 20–50, native rig 20–25,
  retarget 10 an animation; 1 API credit = $0.01): about 30–50 to generate, 20–25 to rig where a rig is used, one
  retry budgeted: **≈ 80–150 credits a foe, ≈ 320–600 for the four** (≈ $3–6 at API rates, or Studio credits).
- **Midjourney**: one T-pose batch for the mummer (plus at most three rest-view batches), on the existing plan.
- **Agent time**: direct ≈ 1 working session a foe (model, surfaces, motion, contacts, sounds); Tripo ≈ 1.5–2
  sessions a foe (generation, orientation, rig/split, retarget/adapter, texture flattening, LOD, vertex colours);
  the harness ≈ half a session; the comparison write-up and winner integration ≈ 1 session. About **10–12 sessions**
  for the eight prototypes and the four integrations, at test concurrency 2.

### Order

Harness first (current column reproduces this phase's pictures exactly), then the shellback pair (the reference
is already visible), the hound pair, the wood cutter pair, and the mummer pair once its T-pose is picked. Each pair
lands as its own reviewable commit with its pictures; the winner replaces the live body only after the author has
seen the side-by-side.

### Phase 2a results (shellback)

The harness and the shellback pair are in `references/enemy-redesign-2026-10-30/trials/` (its README: the trial page,
the scripts, the pictures and the comparison table). Both new bodies cut the crab's draws from +99 to +15 a body on
High (six: +594 to +90); Tripo used 30 credits. Neither is in the game until the author picks one.

### Phase 2b results (hound)

The hound pair is in the same folder (the trials README's hound section): a direct broad-pawed hound and a Tripo one
(generation 30 credits, Tripo's quadruped rig 25, its weights kept on the game's bones). Both look at the traveller.
Neither is in the game until the author picks one.

### Phase 2b results (wood cutter)

Both wood cutters stand 2.4 m (the author's 2.2–2.6 m) on the brute's rig family with its id, attacks and windows, the
reach scaled (`woodcutterDef`), the saw and clamp meeting the ground where the slam lands, the head turning to the
traveller; the comparison, pictures and recommendation are in the trials README's wood cutter section. Tripo used 30
credits. Neither is in the game until the author picks one.

## 5. Decisions for the author

1. **Completed:** all 45 selected originals are archived in the folders above; no download action remains.
2. Generate and pick the mummer's T-pose (and say whether non-humanoid rest views are wanted).
3. Which Tripo route and what credit ceiling (estimate: 320–600 credits for the four).
4. The wood cutter's size: today's brute is 4.7 m tall; the new reference reads as a compact robot. Confirm a target
   (proposed 2.2–2.6 m, at least the traveller's height per #741) so both variants are built to the same size.
5. Still open from the handoff, not needed for the trials: the grunt (cistern forager or salt drifter) and the dew
   gatherer's single anatomy.
