import { enamelCard, enamelStrip, enamelKicker, en } from '../hud-look.js';
import { HINT } from '../hint-look.js';
const OBJECTIVE_SECS = 6.5;

export default `
#cine { position: fixed; inset: 0; z-index: 8000; pointer-events: none; }
#cine .bar { position: absolute; left: 0; right: 0; height: 0; background: #2b211f; transition: height 1.1s cubic-bezier(.6,0,.3,1); }
#cine .bar.top { top: 0; } #cine .bar.bot { bottom: 0; }
#cine.on .bar { height: 11vh; }
#cine.lids .bar { height: 50.5vh; transition-duration: 0s; }
#cine .sub { position: absolute; left: 50%; bottom: calc(11vh + 14px); transform: translateX(-50%); width: min(max(820px, 46em), calc(100vw - 32px)); text-align: center;
  font: var(--type)/1.4 var(--face); color: ${en('ink')}; opacity: 0; transition: opacity .2s; }
/* the conversation's dark panel (D) for every subtitle, the voicemail's too (issue #687, src/hud-look.js): one brass hairline,
   the speaker's name in brass capitals before the words */
#cine .sub span { display: block; width: fit-content; max-width: 100%; box-sizing: border-box; margin: 0 auto; padding: .3em .85em .35em;
  ${enamelCard()} text-wrap: balance; }
#cine .sub b { ${enamelKicker()} font-size: .8em; margin-right: .6em; }
#cine .sub em { font-style: normal; font-weight: bold; color: ${en('brassInk')}; }
#cine .sub em.value { color: ${en('gold')}; border-bottom: 2px solid ${en('brass')}; white-space: nowrap; }
#cine .sub em.value::before { content: '✦'; color: ${en('gold')}; font-size: .8em; margin-right: 3px; }
#cine .sub b.father { color: #eaa58f; } #cine .sub b.mother { color: ${en('accent')}; } #cine .sub b.plumb { color: #f2897a; }
html.speech-solid #cine .sub span { background: #000; color: #fff; border-color: #fff; box-shadow: none; }
html.speech-solid #cine .sub b, html.speech-solid #cine .sub em { color: #fff; }
#cine .sub.show { opacity: 1; transition: opacity .2s, bottom .3s; }
#cine .sub.show.in span { animation: cine-sub-in .22s ease-out; }
@keyframes cine-sub-in { from { opacity: 0; transform: translateY(4px); } }
#cine .skip { position: absolute; right: calc(22px + var(--safe-right, 0px)); bottom: calc(5.5vh - 10px); font: calc(var(--type-s) * 0.9) var(--face); opacity: 0;
  transition: opacity .3s; letter-spacing: .08em; padding: 4px 10px; ${enamelStrip()} white-space: nowrap; }
#cine .skip.show { opacity: .9; }
#cine .skip.press { pointer-events: auto; cursor: pointer; } #cine .skip.press i { display: none; }
#cine .skip i { display: inline-block; vertical-align: middle; width: 60px; height: 6px; margin-left: 8px; border: 1px solid ${en('frame')}; border-radius: 3px; overflow: hidden; }
#cine .skip i u { display: block; height: 100%; width: 0; background: ${en('accent')}; }
#cine .fade { position: absolute; inset: 0; background: #2b211f; opacity: 0; transition: opacity .6s; }
#cine .fade.white { background: #fff6dc; }
#cine .red { position: absolute; inset: 0; opacity: 0; mix-blend-mode: multiply;
  background: radial-gradient(ellipse at center, rgba(255, 150, 130, .55) 30%, rgba(170, 30, 25, .95) 100%); }
#cine .hint { position: absolute; left: 50%; top: calc(11vh + 12px); transform: translateX(-50%); font: 500 var(--type-s)/1.35 var(--face); color: var(--hint-ink, ${HINT.ink});
  width: max-content; max-width: min(32em, calc(100vw - 40px)); box-sizing: border-box; text-align: center; text-wrap: balance;
  padding: 0.3em 0.95em 0.35em; background: var(--hint-bg, ${HINT.bg}); border-radius: var(--hint-radius, ${HINT.radius}); opacity: 0; transition: opacity .4s; }
#cine .hint.show { opacity: 1; transition: opacity .4s, top .3s; }
/* the objective card: one line, the step itself, on the notices' dark strip (issue #222: no "OBJECTIVE" over it, nothing slanted) */
#objective { position: fixed; left: 50%; top: 18vh; transform: translateX(-50%); z-index: 7900; pointer-events: none; text-align: center; opacity: 0;
  width: max-content; max-width: min(48em, calc(100vw - 32px)); font: var(--type-s) var(--face); color: var(--hint-ink, ${HINT.ink}); }
#objective .t { padding: 0.35em 1.1em 0.4em; font: 500 max(clamp(15px, 4vw, 20px), calc(var(--type) * 1.1))/1.3 var(--face); letter-spacing: .03em;
  background: var(--hint-bg, ${HINT.bg}); border-radius: var(--hint-radius, ${HINT.radius}); box-shadow: 0 1px 0 rgba(0, 0, 0, .25); text-wrap: balance; }
#objective .t::before { content: '◆'; margin-right: .55em; color: var(--hint-accent, ${HINT.accent}); }
#objective.show { animation: objective ${OBJECTIVE_SECS}s forwards; transition: top .3s; }
@keyframes objective { 0% { opacity: 0; transform: translate(-50%, 8px); } 8%, 82% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; } }
#warp { position: fixed; inset: 0; z-index: 8400; pointer-events: none; opacity: 0; transition: opacity .5s; }
#warp.on { opacity: 1; }
/* the next world's name: the enamel card (issue #687, src/hud-look.js), the brass hairline, ivory capitals */
#warp .title { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font: 600 max(26px, calc(var(--type) * 1.45)) var(--face); letter-spacing: .24em;
  padding: .45em 1.1em .45em 1.34em; ${enamelCard()} max-width: calc(100vw - 32px); box-sizing: border-box; text-align: center; text-transform: uppercase; opacity: 0; transition: opacity .6s .4s; }
#warp.on .title { opacity: 1; }
`;
