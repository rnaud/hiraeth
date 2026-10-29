// The walkthrough page (walkthrough.html; docs/systems/testing.md "The walkthrough", issue #777): how to finish the game,
// world by world and temple by temple, drawn from src/walkthrough-page/steps.js, the steps the daily play-through plays
// (tests/playthrough.test.js, tests/walkthrough.js). The daily run's result, walkthrough-status.json, is read when the site
// has it (it is the site's alone: scripts/content-policy.mjs WALKTHROUGH_FILE): each step is then marked passed or broken.
import { walkthroughPage } from './view.js';

const $ = (s) => document.querySelector(s);
const draw = (status) => {
  const { nav, main } = walkthroughPage({ status });
  $('#sections').innerHTML = nav;
  $('#walkthrough').innerHTML = main;
};
draw(null);
// (a link to a part or a temple lands below the sticky header, however many lines it wraps to; on a phone it is not sticky)
const pad = () => { const h = $('body > header'); document.documentElement.style.scrollPaddingTop = getComputedStyle(h).position === 'sticky' ? `${h.offsetHeight + 8}px` : '0px'; };
pad();
addEventListener('resize', pad);
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
// (the daily run's marks, when this copy of the site has them: a bundled copy or a dev server has none)
fetch('./walkthrough/status.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null))
  .then((s) => { if (s?.kind === 'hiraeth-walkthrough-status') { const y = scrollY; draw(s); scrollTo(0, y); } })
  .catch(() => {});
