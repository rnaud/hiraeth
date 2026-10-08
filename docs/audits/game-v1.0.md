# Hiraeth against what makes a great game (October 2026, v1.0)

The second audit against the twelve themes of
[what-makes-a-great-game.md](../what-makes-a-great-game.md), run with the `game-audit` skill
(`.claude/skills/game-audit/`). It follows [the v0.97 audit](game-v0.97.md) and the three releases built
from it: v0.98 (the first minutes and sound), v0.99 (playing your way, the tools in the worlds) and v1.0
(the ending).

**Evidence:**
- two read-only surveys of the code against every v0.97 finding;
- a capture pass in muted headless Chrome: a first-time title, a new game left idle for about 70 s,
  settings, six worlds, Home, the Lantern and the Arena;
- the docs.

**What is not verified:**
- No one has played any of the v0.98–v1.0 work. That's about 13,000 lines: the first homecoming, the
  Lantern, the twelve filmed moments, the eleven trials, the courts.
- No one has heard the new sound or the music's new timing.
- Nothing has been measured on the Retroid or the Deck since these features went in.
- The ship's nudge fell between two captures, so it wasn't seen (the default plan is now retimed to
  catch it).

**What is verified:** the node play-through reaches the true ending, and every capture booted without
a page error.

## The scores

| # | Theme | v0.97 | v1.0 | In one line |
|---|---|---|---|---|
| 1 | Core experience and coherence | 3 | 3 | The verbs combine now, but breadth grew again instead of being frozen |
| 2 | The first five minutes | 2 | 3 | The ship and the first steps teach; an early splash; the real fill still comes 25–35 minutes in |
| 3 | Exploration and wayfinding | 4 | 4 | Fire, wind and foes now act on each other; the long walks back are mostly unchanged |
| 4 | Rewarding exploration | 3 | 4 | Sightings, detour traces and gadget courts; the rewards are quiet numbers |
| 5 | Narrative and harmony | 4 | 4 | The light is answered well; two real choices; combat pulls further from the ending's tone |
| 6 | Arc and pacing | 2 | 3 | The credits come after the peak, and the climaxes are filmed; the finale is one conversation |
| 7 | Art direction | 5 | 5 | Still the strongest thing; the type split and the face are still open |
| 8 | Audio | 4 | 4 | Foley, a weightier blade, music that waits for moments; never heard; foes still synth |
| 9 | Game feel | 4 | 4 | Motion options; the feel is still judged by one person |
| 10 | Combat | 3 | 3 | Foes use height and hazards, and cues have shapes; the tone gap is wider |
| 11 | Accessibility and UX | 2 | 3 | Remapping, text size, reduce motion, hold or toggle; key names still wrong in text; the French is shallow |
| 12 | Quality, performance, discovery | 3 | 2 | More tests, but no measurements after big CPU additions; still no playtest or telemetry |

Weighted (themes 3–8 count double): **3.7 / 5, up from 3.4.**

The largest gains are in themes 6, 4, 2 and 11, the weakest areas at v0.97, which is where the work
went. The one score that went down, theme 12, went down for the same reason: a lot was built and
shipped as 1.0, and none of it was played or measured outside the author's tests.

## What happened to the v0.97 investments

| # | Investment | Status |
|---|---|---|
| 1 | Watch three people play, add opt-in progress telemetry | **Not done.** No playtest, no telemetry, no feedback channel (TODO.md's playtest line is unchecked) |
| 2 | Fix the arc | **Done.** First homecoming, then the Lantern; climaxes filmed in every route world (`src/story/ending.js:105-119`, `src/story/film.js:19-32`) |
| 3 | The first ten minutes as World 1-1 | **Mostly done.** Ship nudge, first steps, the one shot of dregs, two errands instead of four, the Hearth ride. The real fill is still stage 7 of 14 (`src/story/desert-data.js:78-90`) |
| 4 | Make the verbs multiply, stop adding breadth | **Partly.** Courts, trials, chemistry and foes in the world are built. The freeze was ignored: about 156,000 lines of JS against about 149,000, 31 levels, new systems |
| 5 | Turn the mystery into a collection, then answer it | **Mostly done.** The Sightings page, twelve detour traces, the answer at the Lantern, two choices. The page's threads never close after Ilen |
| 6 | The Basic accessibility tier | **Mostly done.** Plain-text keys in dialogue don't follow remapping; French covers menus only |
| 7 | Score the moments | **Done.** Music for arrivals, interiors and finds, then quiet (`src/music-moments.js:16-24`) |
| 8 | Be findable | **Not done, by the author's choice.** Not recommended again here |

## 1. Core experience and coherence: 3

**Better**
- The verbs combine:
  - fire spreads downwind and the fan throws sparks (`src/chemistry.js`);
  - foes are knocked into spines, jaws and updrafts (`src/workings.js`);
  - each world has a trial built from its own ride.

**Weak**
- The breadth kept growing in the same three releases: rebinding, a French layer, fire chemistry, foe
  cover, eleven trials, ten courts and a new world. The v0.97 recommendation was to freeze breadth.
- `TODO.md` lists finished items as open ("optional mastery challenges", "the desert's first hour").

## 2. The first five minutes: 3

**Better**
- **The ship nudge:** after 20 s idle it gives a single line, naming the player's own inputs
  (`src/ship/prologue.js:62-72`, `src/prompt-keys.js:59-69`).
- **The first steps:** look after 6 s, jump after 25 m (`src/first-steps.js:18-23`).
- **No "Updated to…" for a first-time player.**
- **No Debug** on the title or in the menu.
- **The arrival card** sits low and leaves in 5 s.
- **One shot of old fluid** comes about 5–8 minutes in (`src/story/desert.js:564-576`).

**Weak**
- **The tank's real fill** is still the 7th of 14 desert stages: about 25–35 minutes in. The main
  quest is about 60–90 minutes, still three to five times any other world's.
- **The teaching lines are English only,** outside the i18n layer.
- **"Developer panel" and the dev menu are still in the in-game settings** for every player
  (`src/ui.js:304-305`), and ticking it brings Debug back.

## 3. Exploration and wayfinding: 4

**Better**
- Systems now act on each other without the player (`src/chemistry.js`).
- Vael's plain has wind columns, and the Hearth ride has things to find.

**Weak**
- The Buried Machine's 330 m climb back is unchanged.
- The drone still never points at relics.
- Nothing happens to a foe knocked into water.

## 4. Rewarding exploration: 4

**Better**
- **The Sightings page** has four threads, 38 route entries and 12 detour ones, with "?" for those
  still to find (`src/story/sightings.js`).
- **One trace in each detour world.**
- **A gadget court in each of ten route worlds** (`src/finds/courts.js`).

**Weak**
- **The trials' rewards are numbers on a gadget,** and three of them come before you own that gadget:
  - the desert's trial upgrades the lens, from world 8;
  - the Buried Machine's upgrades the bombs;
  - the Spheres' upgrades the recall.

  (`src/trials/upgrades.js:16-27`.)
- **Four gadgets** have no use outside their court: the boomerang, the bubble wand, the bombs, and the
  hook away from its spires.
- **The Sightings threads stay questions after the Lantern answers them.**

## 5. Narrative and harmony: 4

**Better**
- **The light is answered, and planted well.** Ilen's answer to the father's broadcast carries the
  makers' sign. "We heard you" is seen in the market before it is explained, and Odile, Talo and
  Hollin pay off at the Lantern (`src/story/lantern-data.js`).
- **Two real choices, echoed at the stone and by Ilen:**
  - Dov's lift token (`src/story/incal-data.js:441-458`);
  - Hollin's promise, which costs a trip back (`src/story/perdide2-data.js`).

**Weak**
- **Viridel is still not a choice.**
- **Saying no to Hollin** gets no line at the stone.
- **Combat moved away from the theme.** In v0.99 a foe knocked into a chasm "is gone", foes catch fire,
  and foes are shoved into jaws, while the new ending is about gentleness and empty hands ("You don't
  have to bring us anything"). The gap with the story is wider than at v0.97.

## 6. Arc and pacing: 3

**Better**
- **The credits need roughly ten of the eleven route worlds,** including the jets and Ilen, and six
  worlds now make a midpoint (`src/story/ending.js:105-119, 276-300`).
- **Twelve filmed moments.**

**Weak**
- **The finale is one conversation.** "We Heard You" has a single stage, walk the bar and talk, with no
  relics (`src/story/lantern-data.js:35-40`). After ten worlds of build-up, the place the last stretch
  goes to find has no play in it.
- **Four worlds sit between the homecoming and the finale** with only the voicemail and the trace to
  pull the player on. Untested.
- **Viridel's filmed moment is its side quest's flood.** Its main quest has none.
- **Bug:** the Lantern's quest is missing from `ALL_QUESTS` (`src/story/all-quests.js:17-18`), so it
  will be missing from the Quests panel's Done list in other worlds.

## 7. Art direction: 5

The captures hold the style everywhere, the Lantern included.

Still open:
- the type split: toasts, cues and dialogue in a typewriter mono (`index.html`), the charge card too;
- the traveller's face;
- shadows in caves and interiors (`TODO.md`).

The new `visual-audit` skill is the way to hunt the last two.

## 8. Audio: 4

**Better**
- Body foley from CC0 recordings: 74 files, 544 KB, credited (`docs/credits.md`).
- A blade with weight.
- Music that plays at arrivals, interiors and finds, then leaves quiet between them.

**Weak**
- **None of it has been heard,** because every run is muted.
- **Foes are still synth and not placed in space** (`src/audio.js:1492-1525`).
- **The old activity layers** (riding, night, storm) are only partly back.
- **The music is still 103 MB.**

## 9. Game feel: 4

**Better:** Reduce motion and a shake slider, following the system setting (`src/feel.js:22-34`).

**Weak:** the feel is tuned by one person. That's unchanged and is theme 12's real problem.

## 10. Combat: 3

**Better**
- Flyers hold height and take cover.
- Hazards, falls and the temple workings hurt foes.
- The reticle's states have shapes as well as colours.

**Weak**
- Still no stakes, by design.
- The tone gap is wider (theme 5).
- Not checked against a colour-blindness simulation.

## 11. Accessibility and UX: 3

**Better**
- Remapping for keys and pads, hold or toggle, text size, a solid speech background, reduce motion.
- French menus with complete coverage of their 334 keys.

**Weak**
- **Key names in plain text don't follow remapping:**
  - "push mode: X or the D-pad" is in 11 places, and on a pad X is interact:
    - `desert-data.js:733, 747, 831`;
    - `perdide2-data.js:68, 76`;
    - `bazaar-data.js:347, 374`;
    - `garage-data.js:55`;
    - `incal-data.js:57, 67, 596`.
  - "aim with R… then G" and the foe tips (`foes.js:1554`).
- **About 243 toasts pass literal English,** so a French player gets French menus and English
  everything else, with French key names dropped into English sentences.
- **Stale edges:**
  - `src/save-slots.js:1` says five slots;
  - `docs/systems/ui.md:91` still says toasts name no keys;
  - the settings page runs to 22 rows.

## 12. Quality, performance, discovery: 2

**Better**
- 295 test files and about 1,980 tests, up from 271 and 1,830.
- The node play-through reaches the true ending.

**Weak**
- **No playtest, no telemetry, no feedback channel.** Item 1 of v0.97 is still open, and v1.0 has
  shipped.
- **Nothing measured since:**
  - fire chemistry runs at 8 Hz within 140 m, with embers every frame;
  - foley runs per frame;
  - foe cover sampling;
  - 74 sound files are decoded during the load;
  - the twelve moments and the ending.

  None of this has been run on the Retroid or the Deck, whose frame was already CPU-bound. The new
  `perf-audit` skill is the way to measure it.
- **The browser play-through** has no ending checks.
- **Photo mode** still downloads `moebius-….png`, with no share.

## Where I would invest

Ranked by improvement per hour of work.

1. **Watch three people play, and add opt-in local progress telemetry.**
   - *Cost: a day.*
   - *Why:* this is still first, and more urgent. v1.0 put a new ending, twelve moments and eleven
     trials in front of players with no one but the author having played them.
2. **Measure v1.0 on the Retroid and the Deck** (the `perf-audit` skill).
   - *Cost: a session per device.*
   - *Why:* several CPU-heavy systems were added to a frame that was already CPU-bound, and one sound
     load sits in the loading window.
3. **Finish the prompt and language plumbing.**
   - Put a key placeholder in the dialogue system (`{key:mode}`), and fix the 11 "push with X" lines
     and the plain-text keys.
   - Route the toasts and the teaching lines through `t()`.
   - Hide "Developer panel" and the dev menu from players.
   - Fix the Lantern's missing quest (`ALL_QUESTS`).
   - *Cost: low to medium.*
4. **Give the finale some play, and close the threads.**
   - A short last stretch on the Lantern's island that uses the verbs: climb the tower, answer the
     light's song.
   - Mark the Sightings threads as answered after Ilen.
   - *Cost: medium.*
   - *Why:* it is the peak the whole route now points at.
5. **Frame combat in the story's terms:** cleaning the ink, quieting the machines. Soften what "is
   gone" in a chasm and what burns, so that the highest-juice verb doesn't argue with "you don't have
   to bring us anything".
   - *Cost: low to medium (words, effects, a few rules).*
6. **Make the trials' rewards land.**
   - Give each one a reward the player can use when it is won: re-order the rewards, or give an
     upgrade to a tool already owned.
   - Optionally, add a second, harder par for the players who want mastery.
   - *Cost: low.*
7. **The desert's real fill earlier,** or the main quest shorter: it is still 60–90 minutes.
   - *Cost: medium.*

What I would not invest in now:
- more worlds or systems (the freeze still stands);
- the storefront (left out by the author's choice);
- more rendering work, beyond fixing what the `visual-audit` skill finds.
