# Conversations: the cut, the gap, the translator

**The camera cuts, it never swings.** `Dialogue.start` sets `blend` to 1 and `close` sets it
to 0 (`src/story/dialogue.js`): the first frame of a talk is already the two-shot (or the look
over the shoulder) that `src/story/shot.js` picked, and the first frame after it is the follow
camera, which kept its place behind the traveller all along. The shot is still checked every
0.6 s and on every new page. If the new pick is close to the old one (same side, same kind,
within `CUT_FAR` = 0.8 m), the camera eases over to it. A new angle is a cut. It happens at
once when the page turns or the old view is blocked, and otherwise no sooner than `CUT_GAP`
= 2.5 s after the last cut. `dialogue.cuts` counts them.

**Room to talk.** Opening a talk from right on top of someone, `makeRoom` in
`src/story/index.js` first puts a comfortable gap between the two (`src/story/spacing.js`).
`talkSpace(npc)` is about 1.45 m feet to feet. It is a little less for a child, more for a
giant, and 0.3 m more for someone seated, to clear their knees. `stepBack` moves the
traveller straight back from them, or round them (a fan of angles up to 85°). The ground is
followed along the way: no drop or rise of more than 0.45 m. The way must be clear at the
knee, waist and head, the capsule must fit where it ends, and nobody else may stand there.
If the traveller has nowhere to go, a standing story NPC steps back instead. Seated people and
crowd people are never moved. The traveller is then turned to face them. All of this happens
on the frame the camera cuts in, so nobody sees the step. It is skipped while riding,
swimming, climbing, gliding, knocked down or under changed gravity.

**The translator.** A word turns into English `LAG` = 5 letters after it is said, and its
English fades in over `FADE` = 5 more. Both were 14 and 12 until October 2026. At the usual
pace of about 48 letters a second, the line is all English about 0.2 s after its last word
(it used to be about 0.55 s).

Tests: `tests/talk-spacing.test.js` (the gap, walls, ledges, bystanders, the cut in, out and
mid-talk) and `tests/scripts.test.js` (the translator).
