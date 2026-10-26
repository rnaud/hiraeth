import { enamelCard, enamelStrip, enamelKicker, en } from '../hud-look.js';

export default `
#mg-words { position: fixed; inset: 0; pointer-events: none; z-index: 79; font: 700 calc(var(--type-s) * 1.15)/1.2 var(--face); color: #2b211f; }
#mg-words .pop { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; color: #fbf4e2; -webkit-text-stroke: 3px #2b211f; paint-order: stroke fill; font-size: 20px; letter-spacing: .04em; }
#mg-words .pop.gold { color: #f2c54b; font-size: 28px; }
#mg-words .pop.bad { color: #d9643a; font-size: 22px; }
#mg-words .pop.combo { color: #71d7cf; font-size: 24px; }
/* a person's words and a thing's tag: the enamel of every message (issue #687, src/hud-look.js), as the balloons */
#mg-words .say { position: absolute; transform: translate(-50%, -100%); max-width: 300px; padding: 6px 12px 7px; ${enamelCard()}
  font: var(--type-s)/1.35 var(--face); white-space: normal; transition: opacity .2s; }
#mg-words .say::after { content: ''; position: absolute; left: 24px; bottom: -9px; border: 8px solid transparent; border-top-color: ${en('brass')}; border-bottom: 0; border-left: 0; }
#mg-words .say.off { opacity: 0; }
#mg-words .tag { position: absolute; transform: translate(-50%, -100%); padding: 5px 10px 6px; ${enamelStrip()}
  font: calc(var(--type-s) * 0.85)/1.3 var(--face); text-align: center; white-space: normal; width: max-content; max-width: 13em; }
#mg-words .tag b { display: block; font-size: 13px; ${enamelKicker()} }
`;
