# Making the foes fun (#722)

2026-10-27. The author: "the enemies we fight in the game feel a bit boring." Two studies sit beside this
plan: `enemy-research-zelda.md` (Ocarina of Time, Breath of the Wild and relatives: rosters, movesets, 17
principles) and `enemy-diagnosis.md` (why ours bore, from code and live packs). The v1.90 combat audit scored the
roster about 4/5 on readability and fairness; those foes are fair and readable, but they die before they show
anything, and they never surprise.

## What the diagnosis found (short)

1. One combo (1+1+3 in 1.7 s) kills 18 of 22 archetypes; HP never grows while the traveller goes 3 → 17 hearts.
2. Any cut in the first two thirds of a wind-up cancels it and every reel restarts the cooldown: mashing wins.
3. Encounters are random packs spawned 18–26 m round you, then 35–55 s of rest. Three foes on the whole route
   are placed by hand. No camps, nests, ambushes, terrain, props or rewards.
4. Late packs fall apart (Signal Market places 28 of 185 members); fillers are tutorial blots.
5. One move per distance band; about half the roster repeats one move.
6. Nothing changes mid-fight: no enrage, no flight, no reaction to a packmate's death; low-HP moves are skipped.
7. ~70 % of a fight is chase or recovery; waiting foes side-step in place.
8. No alert beat and no idle life: a slow circle round the spawn point, then instant chase.
9. Reactions are small horizontal shoves; foes never guard or dodge; armour only makes you wait.

## The recommendations

Ordered by value for the cost. Each is something the research shows working in Zelda and that our kit already
answers (combo, charged cut, air cut, parry and riposte, dash cut, roll, gun modes, lock-on).

### A. The fight itself (every foe)

1. **Poise, not cancel.** A light cut no longer cancels a wind-up once it has started (hyper-armour for the
   strike's committed part). Each foe has a poise bar: cuts wear it; a charged cut, a parry, a riposte, a headshot
   or a dash cut through it breaks it at once. Broken poise = a stagger or knock-down with a riposte window
   (Iron Knuckle, Lynel, Sekiro). Reels no longer restart the attack cooldown.
2. **Toughness that grows by world.** HP and poise scale with the world's tier, so the early world stays a
   teacher and later foes survive two or three combos. Blots stay fragile (the fodder that makes you feel strong).
3. **Tempo.** Shorter dead time: chained follow-ups (a second swing if the first is guarded or whiffs), a step
   back then a lunge, a weighted pick among moves at every distance so the same foe varies. Waiting foes circle,
   feint and taunt instead of side-stepping in place (an attack token: at most two strike at once).
4. **Defence becomes offence.** A guarded blow makes the foe stumble (OoT Lizalfos); a parried one staggers it.
   Some foes guard or hop back from your swing (Lizalfos, Stalfos) so you need a feint, a charged cut or a dash cut.
5. **States that change.** Every archetype gets one low-HP change: enrage (faster, a new chain), flight (calls
   for help, runs to a packmate), or desperation (its last move). Fix the skipped ones (the roller's last roll).
6. **Reactions to each other.** An alert beat (a half-second rear-up / yell / flash, then the pack wakes, any
   kind); a yell when a packmate falls; the last one alone may cower or flee.
7. **Hits that land.** The charged cut and the riposte launch or knock down walkers; knock-back carries off
   ledges and into water; heavier foes slide less (mass).

### B. Encounters as places

8. **Camps and sites.** Each route world gets 3–6 hand-placed encounter sites using its terrain: a camp round a
   fire with a lookout, a nest, an ambush (a sign before the drop: a shadow, a sound, a twitch in the sand), a
   guarded chest. Idle life at the site: sitting, sleeping, eating, guarding, patrolling a path. A sleeping foe
   takes a sneak-strike bonus. A cleared site pays: a chest, a better reward than the wandering packs.
9. **One prop per site** that both sides can use: a barrel that bursts, a boulder on a slope, a brazier.
10. **Wandering packs fewer and better.** Keep the roaming spawner for life between sites but fewer, never into
    terrain the pack can't fill; fix the Market/City-Shaft placement and the blot fillers (fillers come from the
    world's own roster).

### C. Armour and weak points (Darknut, Talus, Hinox)

11. **Armour that comes off.** The heavy foes (bell walker, furnace brute, shellback crab, lamp tripod, crucible
    cart) wear plates that a parry, a charged cut or the right gun mode knocks off, piece by piece, with a clatter.
    Without them they turn fast and dangerous and fully open. Glancing hits stop being the only answer.
12. **Visible weak points** that lock-on can switch to (the tripod's lamp, the brute's furnace door, the bell's
    clapper): a shot there stuns and opens a finisher.

### D. Variety

13. **Tiers.** Each archetype gets a stronger tier for later worlds: a darker or banded skin and one new move.
14. **New foes for missing roles** (reference sheets in the lab first, the author picks): a camp-dwelling
    weapon-carrying tribe (the Bokoblin role: picks up and drops weapons, throws rocks when unarmed, the backbone
    of camps), and a thief/swallower that takes something not hearts (the Like Like role: your shield or ink).
    Deprecation candidates, only when the new ones land: none forced; the blot keeps its teacher role.

## Batches

1. **Fight core** (A1–A7, C11–C12): src/foes.js, src/foe-react.js, src/enemies/*, the blade's damage. Tests.
2. **Encounters** (B8–B10): a new src/encounters/ with sites per route world, the spawner and the world rosters.
3. **References** (D14): lab batches for the new archetypes; build them after the author picks.
4. **Tiers** (D13) after batch 1.

Every batch: before/after pictures from the running game, Unity checked (same JS through engine/), the changelog.
