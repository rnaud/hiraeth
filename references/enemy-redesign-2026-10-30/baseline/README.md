# Baseline pictures of the four trial foes (#800 phase 1)

Today's crab (arzach2), hound (eclipse), brute (perdide2) and mummer (desert) in the real Arena, High preset,
1280×720, 10:00, clear, on main `f50d71928`, captured 2026-10-30 in muted headless Chrome (Apple M-series, Metal).
Same spot, same pinned camera and light for all four, the traveller beside each for scale. After-only views of
the current game, the "current" column for phase 2's comparisons; not reference art and not a before/after.

- `<foe>-still.webp`: three-quarter front, settled idle, the full frame.
- `<foe>-<idle|walk|turn|attack|hurt|death>.webp`: eight frames each, game time in the labels; walk and attack
  side on (the view follows the walk), the rest three-quarter. Attack: the foe's first move (snap, pounce, slam,
  whack). Hurt and death: the game's own `Foes.hurt` and `Foes.update`.
- `baseline-shots.mjs`: the capture (`PORT=5462 CDP=5463 node baseline-shots.mjs <repo> <out> crab@arzach2`; one
  foe a run so no debris carries over). `bench-all.mjs`: the cost runs through `scripts/enemy-roster/bench.mjs`.

Findings and numbers: `docs/handoffs/enemy-rebuild-2026-10-30-baseline.md`.
