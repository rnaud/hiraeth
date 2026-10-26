import { enamelCard, en } from '../hud-look.js';

export default `
#charge-card { position: fixed; left: 0; right: 0; bottom: calc(6vh + var(--safe-bottom, env(safe-area-inset-bottom, 0px))); z-index: 8050; pointer-events: none;
  display: flex; justify-content: center; opacity: 0; transition: opacity .8s; }
#charge-card.on { opacity: 1; }
#charge-card.off { opacity: 0; transition: opacity 1.1s; }
#charge-card .sheet { position: relative; box-sizing: border-box; max-width: calc(100vw - 32px); display: flex; align-items: center; gap: 0;
  padding: .7em 1.6em .7em 0; ${enamelCard()} transform: translateY(8px); transition: transform 1.4s cubic-bezier(.2,.7,.2,1); }
#charge-card.on .sheet { transform: none; }
#charge-card .mark { flex: 0 0 auto; align-self: stretch; display: grid; place-items: center; padding: 0 .95em 0 1.05em; margin-right: 1.1em;
  border-right: 1px solid ${en('frame')}; font: 400 clamp(16px, 2.3vw, 24px)/1 var(--face); color: ${en('gold')}; }
#charge-card h1 { margin: 0; font: 500 clamp(15px, 2.1vw, 23px)/1.25 var(--face); white-space: nowrap; text-wrap: balance; color: ${en('ink')};
  letter-spacing: .3em; margin-right: -.3em; transition: letter-spacing 1.8s cubic-bezier(.2,.7,.2,1), margin 1.8s cubic-bezier(.2,.7,.2,1); }
#charge-card.on h1 { letter-spacing: .18em; margin-right: -.18em; }
#charge-card .words { display: grid; justify-items: start; gap: 2px; }
#charge-card svg { display: block; width: min(220px, 40vw); height: 10px; margin: 3px 0 0; overflow: visible; }
#charge-card svg path { fill: none; stroke: ${en('brass')}; stroke-width: 1.5; stroke-linecap: round; stroke-dasharray: 600; stroke-dashoffset: 600; transition: stroke-dashoffset 1.2s .5s ease-in-out; }
#charge-card.on svg path { stroke-dashoffset: 0; }
@media (max-width: 600px) { #charge-card h1 { white-space: normal; } #charge-card.on h1 { letter-spacing: .1em; margin-right: -.1em; } }
html.speech-solid #charge-card .sheet { background: #000; color: #fff; border-color: #fff; box-shadow: none; }
html.speech-solid #charge-card .mark { border-color: #fff; }
`;
