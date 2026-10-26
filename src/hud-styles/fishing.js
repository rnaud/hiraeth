import { enamelCard, enamelStrip, enamelKicker, en } from '../hud-look.js';

export default `
#fishing-hud { position: fixed; inset: 0; pointer-events: none; z-index: 79; color: #2b211f; font: var(--type-s)/1.4 var(--face); }
#fishing-hud .fh-journal { position: absolute; left: 16px; top: 64px; width: 210px; padding: 7px 10px 8px; ${enamelCard()} transform: none; }
#fishing-hud .fh-journal h3 { margin: 0 0 4px; font-size: 11px; ${enamelKicker()} }
#fishing-hud .fh-journal li { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; line-height: 1.5; color: ${en('ink')}; }
#fishing-hud .fh-journal li.no { color: ${en('soft')}; opacity: .7; }
#fishing-hud .fh-journal li.now { background: rgba(121, 201, 192, 0.25); color: ${en('accent')}; }
#fishing-hud .fh-journal ul { list-style: none; margin: 0; padding: 0; }
#fishing-hud .fh-bottom { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
#fishing-hud .fh-hint { padding: 4px 12px; ${enamelStrip()} font-weight: 700; white-space: nowrap; }
#fishing-hud .fh-hint:empty { display: none; }
#fishing-hud .fh-hint.now { color: ${en('gold')}; font-size: 22px; animation: fhnow .25s ease-out; }
@keyframes fhnow { 0% { transform: scale(1.4); } 100% { transform: none; } }
#fishing-hud .fh-meter { position: relative; width: 320px; height: 22px; background: #fbf4e2; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; display: none; }
#fishing-hud .fh-meter.on { display: block; }
#fishing-hud .fh-meter i { position: absolute; left: 0; top: 0; bottom: 0; background: #71d7cf; border-right: 2px solid #2b211f; }
#fishing-hud .fh-meter.tension i { background: #9fd08a; }
#fishing-hud .fh-meter.tension.hot i { background: #ef5a3a; }
#fishing-hud .fh-meter b { position: absolute; top: -2px; bottom: -2px; border-left: 2px dashed #2b211f; }
#fishing-hud .fh-meter.tension::after { content: ''; position: absolute; left: 80%; right: 0; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(217, 100, 58, 0.35) 0 4px, transparent 4px 8px); }
#fishing-hud .fh-meter span { position: absolute; left: 6px; top: 1px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
#fishing-hud .fh-pull { font: 900 2em/1 var(--face-title); color: #f2c54b; -webkit-text-stroke: 2px #2b211f; paint-order: stroke fill; min-height: 26px; }
#fishing-hud .fh-catch { position: absolute; right: 5%; top: 30%; transform: none; padding: 10px 20px; ${enamelCard()} text-align: center; display: none; max-width: min(380px, calc(100vw - 32px)); box-sizing: border-box; }
#fishing-hud .fh-catch.on { display: block; animation: fhnow .35s ease-out; }
#fishing-hud .fh-catch h2 { margin: 0; font-size: 20px; letter-spacing: 0.1em; text-transform: uppercase; color: ${en('brassInk')}; }
#fishing-hud .fh-catch .kg { font: 900 2.3em/1.1 var(--face-title); font-variant-numeric: tabular-nums; }
#fishing-hud .fh-catch .tag { display: inline-block; margin-top: 4px; padding: 1px 8px; border: 1.5px solid ${en('gold')}; border-radius: 4px; color: ${en('gold')}; font-weight: 900; letter-spacing: 0.12em; transform: none; }
#fishing-hud .fh-catch p { margin: 4px 0 0; font-size: 11px; color: ${en('soft')}; }
body.touch #fishing-hud .fh-journal { display: none; }
#fishing-hud.idle .fh-bottom { display: none; }
`;
