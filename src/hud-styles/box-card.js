import { enamelCard, enamelStrip, enamelPrompt, en, PIC_PAPER } from '../hud-look.js';   // (the card's prompt and its picture's disc: issue #695)

export default `
#boxscene { position: fixed; inset: 0; z-index: 8100; pointer-events: none; }
#boxscene.on { pointer-events: auto; cursor: default; }
#boxscene .skip { position: absolute; right: 18px; top: calc(11vh + 14px); font: var(--type-s) var(--face); letter-spacing: .08em;
  ${enamelStrip()} padding: 6px 12px; opacity: 0; transition: opacity .3s; pointer-events: none; }
#boxscene.on .skip { opacity: .85; pointer-events: auto; }
#boxscene.card .skip { opacity: 0; pointer-events: none; }
#boxcard { position: absolute; left: 50%; bottom: max(6px, calc(5.5vh - 34px)); width: min(46vw, 720px); min-width: min(26em, calc(100vw - 24px)); max-width: calc(100vw - 24px); box-sizing: border-box;
  transform: translate(-50%, 16px); opacity: 0; transition: opacity .35s, transform .45s cubic-bezier(.2,.9,.3,1.3); pointer-events: none;
  font: var(--type-s)/1.4 var(--face); ${enamelCard()} padding: 1.2em 1.6em; text-align: left; display: flex; align-items: center; gap: 1.2em; }
#boxscene.card #boxcard { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
#boxcard .pic { flex: none; width: 6em; height: 6em; border-radius: 50%; overflow: hidden; background: ${PIC_PAPER}; box-shadow: 0 0 0 1.5px ${en('brass')}, 0 0 14px 2px rgba(242, 197, 75, 0.22); }
#boxcard .pic img { display: block; width: 100%; height: 100%; object-fit: cover; }
#boxcard.nopic .pic { display: none; }
#boxcard .body { min-width: 0; flex: 1 1 auto; }
#boxcard h2 { margin: 0; font: 900 1.75em/1.15 var(--face-title); letter-spacing: .04em; color: ${en('ink')}; }
#boxcard h2 .star { display: none; width: 0.7em; height: 0.7em; margin-right: 0.35em; vertical-align: -1px; background: ${en('brass')};
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); }
#boxcard.nopic h2 .star { display: inline-block; }
#boxcard h2::after { content: ''; display: block; height: 1px; margin: 0.32em 0 0; background: ${en('brass')}; opacity: 0.45; }
#boxcard p.desc { margin: 0.5em 0 0; font-size: 1.04em; line-height: 1.45; }
#boxcard p.desc kbd.kp { color: ${en('accent')}; }
#boxcard p { margin: 0; }
#boxcard p.found { font-size: 1.04em; line-height: 1.45; margin: 0.5em 0 0; opacity: 1; }
#boxcard.found p.desc, #boxcard:not(.found) p.found { display: none; }
#boxscene .skip { display: inline-flex; align-items: center; }
#boxcard .gorow { display: flex; justify-content: flex-end; margin-top: 0.6em; }
${enamelPrompt('#boxcard .go')}
/* a short screen (a handheld's 800 × 450): wider and tighter, so it stays in the bottom third, clear of the item (issue #82) */
@media (max-height: 520px) { #boxcard { width: min(64vw, calc(100vw - 24px)); padding: 0.75em 1.2em; gap: 0.9em; } #boxcard .pic { width: 4.4em; height: 4.4em; }
  #boxcard h2 { font-size: 1.45em; } #boxcard p.desc, #boxcard p.found { line-height: 1.35; margin-top: 0.35em; } #boxcard .gorow { margin-top: 0.35em; } }
@media (max-width: 640px) { #boxcard h2 { font-size: 1.5em; } #boxcard { width: calc(100vw - 24px); padding: 0.9em 1.1em; gap: 0.9em; } #boxcard .pic { width: 4.6em; height: 4.6em; } }
`;
