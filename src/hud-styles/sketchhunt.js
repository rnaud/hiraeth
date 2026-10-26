import { enamelCard, enamelStrip, enamelKicker, en } from '../hud-look.js';
import { INK, PAPER } from '../minigames/kit/sketchhunt-palette.js';

export default `
#hunt-list { position: fixed; left: 14px; top: 64px; z-index: 79; width: 248px; padding: 10px 12px 8px; ${enamelCard()} transform: none; font: var(--type-s)/1.35 var(--face); pointer-events: none; transition: opacity .25s; }
#hunt-list h2 { margin: 0 0 6px; font-size: 11px; ${enamelKicker()} }
#hunt-list li { list-style: none; margin: 0 0 5px; padding-left: 20px; position: relative; }
#hunt-list ol { margin: 0; padding: 0; }
#hunt-list li::before { content: ''; position: absolute; left: 0; top: 1px; width: 11px; height: 11px; border: 1.5px solid ${en('frame')}; border-radius: 2px; background: none; }
#hunt-list li.done::before { background: ${en('accent')}; border-color: ${en('accent')}; }
#hunt-list li.done::after { content: '✓'; position: absolute; left: 1px; top: -3px; font-weight: 900; font-size: 14px; color: ${en('keyInk')}; }
#hunt-list li b { display: block; font-weight: 700; }
#hunt-list li small { color: ${en('soft')}; font-size: 10.5px; }
#hunt-list li .st { color: ${en('gold')}; letter-spacing: .1em; }
@media (max-height: 560px) {   /* a phone held sideways: the list small, the hints left off (the names say enough) */
  #hunt-list { top: 54px; width: 180px; padding: 6px 8px 4px; font-size: 10.5px; }
  #hunt-list li { margin-bottom: 2px; }
  #hunt-list li small { display: none; }
}
#hunt-list.dim { opacity: .38; }
#hunt-view { position: fixed; inset: 0; z-index: 78; pointer-events: none; opacity: 0; transition: opacity .15s; }
#hunt-view.on { opacity: 1; }
#hunt-view .edge { position: absolute; inset: 0; box-shadow: inset 0 0 0 14px ${PAPER}, inset 0 0 0 16px ${INK}; }
#hunt-view .corner { position: absolute; width: 40px; height: 40px; border: 0 solid ${INK}; }
#hunt-view .c1 { left: 34px; top: 34px; border-left-width: 4px; border-top-width: 4px; }
#hunt-view .c2 { right: 34px; top: 34px; border-right-width: 4px; border-top-width: 4px; }
#hunt-view .c3 { left: 34px; bottom: 34px; border-left-width: 4px; border-bottom-width: 4px; }
#hunt-view .c4 { right: 34px; bottom: 34px; border-right-width: 4px; border-bottom-width: 4px; }
#hunt-view .mid { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 2px solid ${INK}; border-radius: 50%; opacity: .7; }
#hunt-view .third { position: absolute; border: 0 dashed rgba(43,33,31,.25); }
#hunt-view .tv { top: 30px; bottom: 30px; border-left-width: 1.5px; }
#hunt-view .th { left: 30px; right: 30px; border-top-width: 1.5px; }
#hunt-view .read { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%); min-width: min(300px, calc(100vw - 32px)); max-width: calc(100vw - 32px); box-sizing: border-box; padding: 6px 14px 7px;
  ${enamelStrip()} font: 700 var(--type-s)/1.35 var(--face); text-align: center; }
#hunt-view .read small { display: block; font-weight: 400; font-size: 11px; color: ${en('soft')}; }
#hunt-view .meter { height: 7px; margin: 4px 0 1px; border: 1px solid ${en('frame')}; border-radius: 4px; overflow: hidden; background: none; }
#hunt-view .meter i { display: block; height: 100%; background: ${en('accent')}; }
#hunt-view .zoom { position: absolute; right: 52px; top: 50%; transform: translateY(-50%); font: 700 11px/1 var(--face); ${enamelStrip()} padding: 4px 6px; }
#hunt-flash { position: fixed; inset: 0; z-index: 81; pointer-events: none; background: ${PAPER}; opacity: 0; }
#hunt-flash.go { animation: huntflash .45s ease-out; }
@keyframes huntflash { 0% { opacity: .9; } 100% { opacity: 0; } }
#hunt-hint { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 79; padding: 3px 10px; background: rgba(247,236,210,.85); border: 1.5px solid ${INK};
  font: calc(var(--type-s) * 0.85)/1.3 var(--face); color: ${INK}; pointer-events: none; white-space: nowrap; }
#minigame .hunt-page { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 4px 0 12px; background: #fbf4e2; border: 2px solid ${INK}; box-shadow: 4px 4px 0 ${INK}; }
#minigame .hunt-page .leaf { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 10px; }
#minigame .hunt-page .leaf + .leaf { border-left: 2px dashed rgba(43,33,31,.45); }
#minigame .hunt-page figure { margin: 0; display: grid; grid-template-columns: 132px 1fr; gap: 8px; align-items: center; }
#minigame .hunt-page img, #minigame .hunt-page .blank { width: 132px; height: 88px; object-fit: cover; border: 1.5px solid ${INK}; background: ${PAPER}; transform: none; }
#minigame .hunt-page figure:nth-child(2n) img { transform: none; }
#minigame .hunt-page .blank { display: grid; place-items: center; font: 900 30px/1 var(--face-title); color: rgba(43,33,31,.3); }
#minigame .hunt-page figcaption { font-size: 11px; line-height: 1.35; }
#minigame .hunt-page figcaption b { display: block; font-size: 11.5px; }
#minigame .hunt-page figcaption .st { color: #d9643a; letter-spacing: .1em; }
`;
