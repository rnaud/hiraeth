# The walkthrough

How to finish Hiraeth, from a new game to the true ending, world by world and temple by temple, is a page on the game's
site: [walkthrough.html](https://rnaud.github.io/hiraeth/walkthrough.html) (in the game: Debug → Pages → Walkthrough).

Its steps are `src/walkthrough-page/steps.js`. The daily play-through (`tests/playthrough.test.js`) plays the game through
those same steps, in the same order and done the same way, and fails at the first step that no longer works. The page
marks each step with the last daily run's result. How it works: [systems/testing.md, "The walkthrough"](systems/testing.md).
