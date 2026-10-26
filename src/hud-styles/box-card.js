import { enamelCard, enamelStrip, en } from '../hud-look.js';

export default `
#boxscene { position: fixed; inset: 0; z-index: 8100; pointer-events: none; }
#boxscene.on { pointer-events: auto; cursor: default; }
#boxscene .skip { position: absolute; right: 18px; top: calc(11vh + 14px); font: var(--type-s) var(--face); letter-spacing: .08em;
  ${enamelStrip()} padding: 6px 12px; opacity: 0; transition: opacity .3s; pointer-events: none; }
#boxscene.on .skip { opacity: .85; pointer-events: auto; }
#boxscene.card .skip { opacity: 0; pointer-events: none; }
#boxcard { position: absolute; left: 50%; bottom: max(6px, calc(5.5vh - 34px)); width: max-content; max-width: min(44ch, calc(100vw - 24px)); box-sizing: border-box;
  transform: translate(-50%, 16px); opacity: 0; transition: opacity .35s, transform .45s cubic-bezier(.2,.9,.3,1.3); pointer-events: none;
  font: var(--type-s)/1.4 var(--face); ${enamelCard()} padding: 0.6em 1.2em; text-align: center; }
#boxscene.card #boxcard { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
#boxcard h2 { margin: 0; font: 900 1.75em/1.15 var(--face-title); letter-spacing: .04em; color: ${en('ink')}; }
#boxcard h2 .star { display: inline-block; width: 0.7em; height: 0.7em; margin-right: 0.35em; vertical-align: -1px; background: ${en('brass')};
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); }
#boxcard p.desc { margin: 4px 0 0; font-size: 1.08em; }
#boxcard p.desc kbd.kp { color: ${en('accent')}; }
#boxcard p { margin: 0; }
#boxcard p.found { font-size: 1.08em; margin: 4px 0 0; opacity: 1; }
#boxcard.found p.desc, #boxcard:not(.found) p.found { display: none; }
#boxcard .go, #boxscene .skip { display: inline-flex; align-items: center; }
#boxcard .go { font: 700 0.92em var(--face); letter-spacing: .08em; color: ${en('keyInk')}; background: ${en('ink')};
  border: 1px solid ${en('brass')}; border-radius: 5px; box-shadow: none; padding: 0.35em 0.9em; cursor: pointer; }
#boxcard .gorow { margin-top: 0.5em; }
#boxcard .go:focus { outline: 1.5px solid ${en('brass')}; outline-offset: 2px; }
@media (max-width: 640px) { #boxcard h2 { font-size: 1.5em; } #boxcard { padding: 6px 12px; } }
`;
