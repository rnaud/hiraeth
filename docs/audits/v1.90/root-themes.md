# Root game themes — frozen v1.90 contribution

These are contributions to the combined audit, not its final weighted score. Source: c5449ab6c. Later ship work is excluded.

## 3. Exploration and wayfinding — 5/5, unchanged

The fresh level audit scores 4.73 across 12 route worlds, unchanged overall. Evidence includes 64 prescribed views, 11 corrected views and 26 plans/maps. The Desert opening and the decision at the roots remain 3/5 weak spots despite the visible marker improvements. A formal 223-step quest walk and bounded live Footprint input strengthen confidence without proving every late puzzle. Do not raise the mean or claim every route was played.

## 8. Audio — 4/5, unchanged

All 116 fresh action checks pass for the recorded browser and engine synthesiser output. Conversation voice is 3.6 dB above music; combined fight peak is −7 dBFS. This retires 13 numerical excesses. Every run was muted: timbre, emotion, comfort and device audio remain unheard. Passing the numerical checks alone does not establish that no listening work is needed. The singing light's synthesised theme remains intentional; issue #27 was closed as not planned.

## 12. Quality, performance and discovery — proposed 4/5, previously 3

All 30 main-branch test runs at or before c5449ab6c passed (ci-recent.json). Later ship-release runs are outside this frozen baseline and have their own release record. There are 791 top-level test files versus 784 previously; that count alone is not quality evidence.

All 178 Mac benchmark views and 30 loads meet their budgets, with no page errors. On the physical Retroid, 57 views across 13 worlds meet the 55 fps world-median and 40 fps worst-view handheld floors. City-Shaft wide (47.8 fps) and Floating City start (57.7 fps) still miss the 60 fps target. Device payload is 189.50 MiB, up 30.5%, with 37.94 MiB of traveller and outfit assets. These content costs should stay visible beside the improved release reliability.

The new-game capture shows the traveller 12 seconds after the click, but this is not an instrumented time-to-control result. No cold-install measurement, thermal soak or portal-hitch trace was completed. The Retroid touch-mirror attempt was inconclusive. No outside playtest or fresh discovery/retention study is evidenced. README has a clear ligne-claire exploration hook, a 48-second trailer and photo mode; their availability does not establish audience reach.

A score of 4 is supported by release reliability and measured budget coverage. A 5 would ignore first-time experience, download cost and target-device gaps. Keep this proposed until the final feel/art synthesis; do not publish a weighted total yet.

## Prior investment dispositions owned by root

- **Outside players:** not evidenced. Agent automation and the author's screenshots do not substitute for three new players. Keep the recommendation off the issue tracker, following the established preference.
- **Release quality:** stronger baseline CI evidence, now 30/30 through the frozen commit. Do not mix later work-in-progress failures into this baseline or conceal them from the ship's release record.
- **Device performance:** now measured on the Retroid. Two scenes remain below the target; do not describe the game as uniformly 60 fps. Xbox and Deck are excluded by the user's request.
- **Sound excesses:** fixed in the numerical render; no listening judgement.
