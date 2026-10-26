import { en, enamelStrip } from '../hud-look.js';

export default `
#gadget-chip { position: fixed; isolation: isolate; right: calc(14px + var(--safe-right, 0px)); top: calc(12px + var(--safe-top, 0px)); z-index: 30;
  display: none; place-items: center; width: clamp(30px, 6vh, 42px); height: clamp(30px, 6vh, 42px); box-sizing: border-box; padding: 0;
  background: ${en('strip')}; border: 1.5px solid ${en('brass')}; border-radius: 50%; box-shadow: ${en('shadow')};
  font: calc(clamp(30px, 6vh, 42px) * 0.55)/1 var(--face); color: ${en('ink')}; pointer-events: none; transition: opacity 0.2s; }
#gadget-chip.on { display: grid; }
body.minigame #gadget-chip, body.minigame #gadget-reticle, body.minigame #gadget-wheel { display: none !important; }   /* (a game takes the buttons: src/minigames/) */
#gadget-chip img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
#gadget-chip.gauge::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(${en('accent')} calc(var(--k, 1) * 360deg), rgba(22, 23, 23, 0.35) 0);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); }
#gadget-chip.empty { opacity: 0.5; }   /* (none left: the bombs thrown, the shell's song spent) */
#gadget-chip.flash { animation: gchip 0.6s ease-out; }
@keyframes gchip { 0% { transform: scale(1.35); box-shadow: 0 0 0 5px #f2c54b; } 100% { transform: scale(1); box-shadow: ${en('shadow')}; } }
@media (prefers-reduced-motion: reduce) { #gadget-chip.flash { animation: gchip-still 0.6s ease-out; } }
html.reduce-motion #gadget-chip.flash { animation: gchip-still 0.6s ease-out; }
@keyframes gchip-still { 0% { box-shadow: 0 0 0 5px #f2c54b; } 100% { box-shadow: ${en('shadow')}; } }
body:not(.nofps) #fps:not(:empty) ~ #gadget-chip { top: calc(48px + var(--safe-top, 0px)); }   /* (the frame readout, when asked for, keeps the corner) */
body.touch #gadget-chip { pointer-events: auto; right: calc(56px + var(--safe-right, 0px)); }   /* (beside the menu's button; tapped: the next gadget) */
body.talking #gadget-chip, body.photo #gadget-chip, body.photo #gadget-reticle, body.photo #gadget-wheel, body.photo #gadget-marks { display: none; }
body.cine-on #gadget-chip, body.cine-on #gadget-reticle, body.cine-on #gadget-wheel, body.cine-on #gadget-marks { display: none !important; }   /* (a cinematic: its letterbox is up, src/ship/cinema.js) */
#gadget-reticle { position: fixed; left: 0; top: 0; z-index: 31; pointer-events: none; display: none; width: 34px; height: 34px; margin: -17px 0 0 -17px; }
#gadget-reticle.on { display: block; }
#gadget-reticle .r { position: absolute; inset: 0; border: 2.5px solid #2b211f; border-radius: 50%; box-shadow: 0 0 0 2px rgba(247, 236, 210, 0.8); }
#gadget-reticle .r::before, #gadget-reticle .r::after { content: ''; position: absolute; left: 50%; top: 50%; background: #2b211f; }
#gadget-reticle .r::before { width: 12px; height: 2px; margin: -1px 0 0 -6px; }
#gadget-reticle .r::after { width: 2px; height: 12px; margin: -6px 0 0 -1px; }
#gadget-reticle.anchor .r { border-color: #c8483a; transform: rotate(45deg) scale(1.1); border-radius: 4px; }
#gadget-reticle.target .r { border-color: #2f7f86; }
#gadget-reticle.far .r { border-style: dashed; opacity: 0.55; transform: scale(0.7); }
#gadget-reticle.nohold .r { border-style: dashed; transform: rotate(45deg) scale(0.85); }   /* (a cross in a broken ring: a makers' house's bare stone won't take the hook, issue #432) */
#gadget-reticle.nohold .r::before { width: 16px; margin-left: -8px; }
#gadget-reticle.nohold .r::after { height: 16px; margin-top: -8px; }
#gadget-reticle span { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 0 5px;
  font: calc(var(--type-s) * 0.8)/1.5 var(--face); ${enamelStrip()} }
#gadget-marks { position: fixed; inset: 0; z-index: 31; pointer-events: none; }
#gadget-marks .m { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; }
#gadget-marks .m::before { content: ''; position: absolute; inset: 3px; border: 2.5px solid #c8483a; background: rgba(247, 236, 210, 0.75); transform: rotate(45deg); box-shadow: 0 0 0 1.5px #2b211f; }
#gadget-marks .m b { position: absolute; inset: 0; display: grid; place-items: center; font: bold 11px/1 var(--face); color: #2b211f; }
#gadget-marks .m.new { animation: gmark 0.25s ease-out; }
@keyframes gmark { 0% { transform: scale(1.9); } 100% { transform: scale(1); } }
#gadget-wheel { position: fixed; left: 50%; top: 50%; z-index: 40; width: 300px; height: 300px; margin: -150px 0 0 -150px; display: none; pointer-events: none; }
#gadget-wheel.on { display: block; }
#gadget-wheel .ring { position: absolute; inset: 40px; border: 2px dashed rgba(43, 33, 31, 0.5); border-radius: 50%; background: rgba(247, 236, 210, 0.35); }
#gadget-wheel .slot { position: absolute; width: 56px; height: 56px; margin: -28px 0 0 -28px; border: 2px solid #2b211f; border-radius: 50%; background: #f7ecd2;
  display: grid; place-items: center; font-size: 24px; box-shadow: 3px 3px 0 #2b211f; transition: transform 0.08s; color: #2b211f; }
#gadget-wheel .slot img { width: 48px; height: 48px; border-radius: 50%; }
#gadget-wheel .slot { overflow: hidden; }
#gadget-wheel .slot.none { font-size: 11px; font-family: var(--face); }
#gadget-wheel .slot.hi { transform: scale(1.25); background: #f2c54b; }
#gadget-wheel .name { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 3px 9px; ${enamelStrip()}
  font: var(--type-s)/1.4 var(--face); letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
#touch .b-gadget { display: none; }   /* (its place and size: src/touch-layout.js, set by ui.js TouchControls) */
body.gadget-on #touch .b-gadget { display: block; }
body.minigame #touch .b-gadget, body.talking #touch .b-gadget { display: none !important; }   /* (a game, a conversation: nothing to use it on) */
#gadget-wheel.many { width: 344px; height: 344px; margin: -172px 0 0 -172px; }
#gadget-wheel.many .slot { width: 50px; height: 50px; margin: -25px 0 0 -25px; font-size: 21px; }
#gadget-wheel.many .slot img { width: 44px; height: 44px; }
#gadget-wheel.many .slot.none { font-size: 11px; }
#gadget-wheel.many .slot.hi { transform: scale(1.18); }
#gadget-wheel.lots { width: 404px; height: 404px; margin: -202px 0 0 -202px; }
#gadget-wheel.lots .slot { width: 46px; height: 46px; margin: -23px 0 0 -23px; font-size: 20px; }
#gadget-wheel.lots .slot img { width: 40px; height: 40px; }
#gadget-wheel .slot.mode { font-family: var(--face); }
`;
