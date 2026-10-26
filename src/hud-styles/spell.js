import { en } from '../hud-look.js';

export default `
#spell-chip { position: fixed; isolation: isolate; right: calc(14px + var(--safe-right, 0px)); top: calc(26px + clamp(30px, 6vh, 42px) + var(--safe-top, 0px)); z-index: 30;
  display: none; place-items: center; width: clamp(30px, 6vh, 42px); height: clamp(30px, 6vh, 42px); box-sizing: border-box; padding: 0;
  background: ${en('strip')}; border: 1.5px solid ${en('brass')}; border-radius: 50%; box-shadow: ${en('shadow')};
  font: calc(clamp(30px, 6vh, 42px) * 0.55)/1 var(--face); color: var(--spell, ${en('ink')}); pointer-events: none; transition: opacity 0.2s, background 0.2s; }
#spell-chip.on { display: grid; }
#spell-chip::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(var(--ring, ${en('brass')}) calc(var(--k, 1) * 360deg), rgba(22, 23, 23, 0.35) 0);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); }
#spell-chip .g { text-shadow: none; }
#spell-chip.wait { background: ${en('strip')}; color: ${en('soft')}; }
#spell-chip.wait .g { font: bold calc(clamp(30px, 6vh, 42px) * 0.36)/1 var(--face); text-shadow: none; }
#spell-chip.flash { animation: schip 0.7s ease-out; }
@keyframes schip { 0% { transform: scale(1.35); box-shadow: 0 0 0 6px #f2c54b; } 100% { transform: scale(1); box-shadow: ${en('shadow')}; } }
@media (prefers-reduced-motion: reduce) { #spell-chip.flash { animation: schip-still 0.7s ease-out; } }
html.reduce-motion #spell-chip.flash { animation: schip-still 0.7s ease-out; }
@keyframes schip-still { 0% { box-shadow: 0 0 0 6px #f2c54b; } 100% { box-shadow: ${en('shadow')}; } }
body:not(.nofps) #fps:not(:empty) ~ #spell-chip { top: calc(62px + clamp(30px, 6vh, 42px) + var(--safe-top, 0px)); }
body.touch #spell-chip { right: calc(56px + var(--safe-right, 0px)); }
body.minigame #spell-chip, body.talking #spell-chip, body.photo #spell-chip { display: none !important; }
body.cine-on #spell-chip { display: none !important; }
#touch .b-spell { display: none; }
body.spell-on #touch .b-spell { display: block; }
body.minigame #touch .b-spell, body.talking #touch .b-spell { display: none !important; }
#touch .b-spell.wait { opacity: 0.45; }
`;
