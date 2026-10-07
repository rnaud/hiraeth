# Conversations: the cut, his face, the gap, the translator

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

**His face, close.** In the two-shot the traveller's face was about 35 px tall and mostly in
profile, so his expressions (`docs/systems/faces.md`) never read. `src/story/coverage.js`
(`Coverage`, driven each frame by `Dialogue.update`) decides who is framed: the two-shot, or a
close three-quarter shot of him (`pickSingle` in `src/story/shot.js`). He is framed while he says
his answer (the answer beat, below), on his own pages (`speaker: 'player'`), and sometimes when the
other says a line with a strong tone (`REACTS`: sad, angry, scared, surprised, shout, happy,
playful, solemn). Once that line is out, the camera cuts to him taking it in, and he wears the
look `REACTS` gives him (`faces().player.look`). The cuts are kept calm:

- a cut the camera makes by itself (a reaction) waits until the shot before it has been held
  `COVER.hold` = 1.6 s, the conversation's opening shot included;
- a reaction comes 0.45 s after the line is out, only for a line of 18 letters or more, and no
  sooner than `COVER.react.gap` = 6 s after his face was last on the screen. It is held until
  the page turns;
- consecutive pages by the same speaker keep their shot;
- going into or out of his close shot is always a cut, never a swing.

`pickSingle` puts the camera about 1 m from his face, 20–45° off the way his face looks (taken
mostly from the head's own direction, `SINGLE.turn`, since his head sways as he listens). It stays
on the two-shot's side of the line between them (the 180° rule: `pickTwoShot` now also keeps that
side, `side`, and only crosses it when its side is blocked). The camera drops part of the way
toward a child's or a seated person's face height (`SINGLE.follow`). The face (0.21 m, hairline to
chin) fills a fifth of the frame's height, capped at `SINGLE.most` = 170 CSS px on a big screen:
about 145 px at 1280×720 and 175 px at 1920×1080. It sits in the upper third, with room on the
side he looks toward. Candidates are scored like the two-shot's: walls and the ground in the way,
bystanders, the other's head or body in front of his face, the camera pressed into scenery, or the
camera inside the other person (a giant). If the best costs more than `SINGLE.max`, the two-shot
stays for that beat and the camera does not cut back to him later. There is no close shot while
he rides (a cab's cabin, a mount), swims, climbs, glides or lies knocked down (`o.single` is null:
`src/story/index.js`).

**The answer beat.** Choosing an answer used to start the reply at once, with his mumble still
playing under it. Now the reply waits while he says his answer (`Dialogue.beat`, `ANSWER_BEAT`:
as long as the mumble, 0.9 to 2.4 s). The panel shows his words, all at once, in his italic style,
his name tag (`You`) and his portrait, and the camera is on him. A press skips the beat to the
reply. `screen.dialogue` publishes the beat too (`speaker: 'player'`, `name: 'You'`, his portrait),
for an engine's own panel.

**His portrait.** On his lines the chip shows the traveller's own portrait (`portraitYou` in
`src/story/index.js`), with the initial letter as the fallback. It is taken with `captureView`, as
the others' are: from in front of his face as it is turned, a little to the side and below, against
his backdrop. His face is set to the line's tone for the capture and given back afterwards. A
conversation captures it once per tone (`Dialogue.youShot`).

Choices (October 2026): a clean three-quarter single at the game's own field of view rather than
an over-the-shoulder shot on a longer lens. Changing the lens would touch the settings' FOV, the
post pass's line widths and the portrait code. A three-quarter view from beside the other's
shoulder shows both his eyes and his mouth, which a near-frontal over-the-shoulder shot would not
improve. The other person's shots stay the existing two-shot. For the traveller's lines, his
answers are the lines: the game has only one `speaker: 'player'` node.

Tests: `tests/talk-spacing.test.js` (the gap, walls, ledges, bystanders, the cut in, out and
mid-talk), `tests/scripts.test.js` (the translator), `tests/convo-closeup.test.js` (who is framed,
holds and spacing, no thrash, the close shot's size, angle, side, height, walls and giants, the
answer beat, his portrait).
