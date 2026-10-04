// Screen-space pieces for the ship's cinematics, in the game's paper-and-ink
// UI: letterbox bars, subtitles (speaker + line), "hold to skip", a fade,
// eyelids, a red alarm wash, the objective card and the warp streaks of
// travel. Built on demand (no index.html changes); inert in node.
import { speakLine } from '../story/voice.js';   // the mumbled voice under each subtitle

const CSS = `
#cine { position: fixed; inset: 0; z-index: 8000; pointer-events: none; }
#cine .bar { position: absolute; left: 0; right: 0; height: 0; background: #2b211f; transition: height 1.1s cubic-bezier(.6,0,.3,1); }
#cine .bar.top { top: 0; } #cine .bar.bot { bottom: 0; }
#cine.on .bar { height: 11vh; }
#cine.lids .bar { height: 50.5vh; transition-duration: 0s; }
#cine .sub { position: absolute; left: 50%; bottom: calc(11vh + 18px); transform: translateX(-50%); width: min(820px, 88vw); text-align: center;
  font: 17px/1.45 ui-monospace, Menlo, monospace; color: #2b211f; opacity: 0; transition: opacity .25s; }
#cine .sub span { display: inline; padding: 4px 10px; background: rgba(247, 236, 210, 0.93); border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f;
  box-decoration-break: clone; -webkit-box-decoration-break: clone; }
#cine .sub b { letter-spacing: .14em; margin-right: 8px; font-weight: bold; }
#cine .sub b.father { color: #7a3a35; } #cine .sub b.mother { color: #277e86; } #cine .sub b.ship { color: #c8483a; }
#cine .sub.show { opacity: 1; }
#cine .skip { position: absolute; right: 26px; bottom: calc(11vh - 34px); font: 12px ui-monospace, Menlo, monospace; color: #f7ecd2; opacity: 0; transition: opacity .3s; letter-spacing: .08em; }
#cine .skip.show { opacity: .85; }
#cine .skip i { display: inline-block; vertical-align: middle; width: 60px; height: 6px; margin-left: 8px; border: 1px solid #f7ecd2; }
#cine .skip i u { display: block; height: 100%; width: 0; background: #f2c54b; }
#cine .fade { position: absolute; inset: 0; background: #2b211f; opacity: 0; transition: opacity .6s; }
#cine .fade.white { background: #fff6dc; }
#cine .red { position: absolute; inset: 0; opacity: 0; mix-blend-mode: multiply;
  background: radial-gradient(ellipse at center, rgba(255, 150, 130, .55) 30%, rgba(170, 30, 25, .95) 100%); }
#cine .hint { position: absolute; left: 50%; top: calc(11vh + 16px); transform: translateX(-50%); font: 13px ui-monospace, Menlo, monospace; color: #2b211f;
  padding: 6px 12px; background: rgba(255, 246, 220, .92); border: 1.5px solid #2b211f; opacity: 0; transition: opacity .4s; }
#cine .hint.show { opacity: 1; }
#objective { position: fixed; left: 50%; top: 18vh; transform: translateX(-50%); z-index: 7900; pointer-events: none; text-align: center; opacity: 0;
  font: 13px ui-monospace, Menlo, monospace; color: #2b211f; }
#objective .k { letter-spacing: .3em; font-size: 11px; opacity: .75; }
#objective .t { margin-top: 6px; padding: 10px 22px; font-size: 24px; letter-spacing: .06em; background: #fff6dc; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f; }
#objective.show { animation: objective 6.5s forwards; }
@keyframes objective { 0% { opacity: 0; transform: translate(-50%, 10px) rotate(-1deg); } 8%, 82% { opacity: 1; transform: translate(-50%, 0) rotate(-.6deg); } 100% { opacity: 0; } }
#warp { position: fixed; inset: 0; z-index: 8400; pointer-events: none; opacity: 0; transition: opacity .5s; }
#warp.on { opacity: 1; }
#warp .title { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font: 30px ui-monospace, Menlo, monospace; letter-spacing: .24em;
  color: #2b211f; padding: 10px 22px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f; text-transform: uppercase; opacity: 0; transition: opacity .6s .4s; }
#warp.on .title { opacity: 1; }
`;

const hasDOM = () => typeof document !== 'undefined' && !!document.body;

export class Cinema {
  constructor() {
    this.dom = hasDOM();
    this.skipK = 0;
    if (!this.dom) return;
    if (!document.getElementById('cine-css')) {
      const st = document.createElement('style'); st.id = 'cine-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const el = (this.el = document.createElement('div'));
    el.id = 'cine';
    el.innerHTML = `<div class="red"></div><div class="fade"></div><div class="bar top"></div><div class="bar bot"></div>
      <div class="hint"></div><div class="sub"><span></span></div><div class="skip">hold ESC to skip<i><u></u></i></div>`;
    document.body.appendChild(el);
    this.sub = el.querySelector('.sub'); this.subText = this.sub.querySelector('span');
    this.skipEl = el.querySelector('.skip'); this.skipBar = this.skipEl.querySelector('u');
    this.fadeEl = el.querySelector('.fade'); this.redEl = el.querySelector('.red'); this.hintEl = el.querySelector('.hint');
    this.obj = document.createElement('div'); this.obj.id = 'objective';
    this.obj.innerHTML = '<div class="k">OBJECTIVE</div><div class="t"></div>';
    document.body.appendChild(this.obj);
  }

  bars(on) { this.dom && this.el.classList.toggle('on', on); }
  lids(closed) { this.dom && this.el.classList.toggle('lids', closed); }
  /** Eyelids opening: k = 0 closed .. 1 open (drives the bar heights directly). */
  eyelids(k) {
    if (!this.dom) return;
    const h = 50.5 - (50.5 - 11) * Math.max(0, Math.min(1, k));
    for (const b of this.el.querySelectorAll('.bar')) { b.style.transition = 'none'; b.style.height = `${h}vh`; }
  }
  releaseLids() { if (this.dom) for (const b of this.el.querySelectorAll('.bar')) { b.style.transition = ''; b.style.height = ''; } }

  say(line) {
    speakLine(line);
    if (!this.dom) return;
    if (!line) { this.sub.classList.remove('show'); return; }
    const who = { father: 'FATHER', mother: 'MOTHER', ship: 'SHIP' }[line.who] ?? '';
    this.subText.innerHTML = `${who ? `<b class="${line.who}">${who}</b>` : ''}${line.text}`;
    this.sub.classList.add('show');
  }

  hint(text) {
    if (!this.dom) return;
    if (text) this.hintEl.textContent = text;
    this.hintEl.classList.toggle('show', !!text);
  }

  fade(k, white = false, secs = 0.6) {
    if (!this.dom) return;
    this.fadeEl.classList.toggle('white', white);
    this.fadeEl.style.transition = `opacity ${secs}s`;
    this.fadeEl.style.opacity = String(k);
  }

  red(k) { if (this.dom) this.redEl.style.opacity = String(k); }

  skip(k, show) {
    this.skipK = k;
    if (!this.dom) return;
    this.skipEl.classList.toggle('show', show);
    this.skipBar.style.width = `${Math.round(k * 100)}%`;
  }

  objective(text) {
    if (!this.dom) return;
    this.obj.querySelector('.t').textContent = text;
    this.obj.classList.remove('show'); void this.obj.offsetWidth; this.obj.classList.add('show');
  }

  /** Hide or show the game HUD (status box, scout label, fps) during a cinematic. */
  hud(show) {
    if (!this.dom) return;
    for (const id of ['hud', 'scout-label', 'fps', 'gear', 'touch']) { const e = document.getElementById(id); if (e) e.style.visibility = show ? '' : 'hidden'; }
  }

  clear() { this.say(null); this.hint(null); this.red(0); this.skip(0, false); this.bars(false); this.releaseLids(); this.lids(false); this.fade(0); this.hud(true); }
}

/** Travel between worlds: ink streaks rushing out from the centre, then the destination's name. */
export class Warp {
  constructor() {
    if (!hasDOM()) return;
    const el = (this.el = document.createElement('div'));
    el.id = 'warp';
    el.innerHTML = '<canvas></canvas><div class="title"></div>';
    document.body.appendChild(el);
    this.canvas = el.querySelector('canvas');
    this.streaks = Array.from({ length: 220 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.4 + Math.random(), w: 1 + Math.random() * 2.5, c: Math.random() }));
  }
  start(title) {
    if (!this.el) return;
    this.el.querySelector('.title').textContent = title;
    this.el.classList.add('on');
    this.t = 0;
  }
  update(dt) {
    if (!this.el || !this.el.classList.contains('on')) return;
    this.t += dt;
    const c = this.canvas, W = (c.width = innerWidth), H = (c.height = innerHeight), g = c.getContext('2d');
    g.fillStyle = '#f7ecd2'; g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy), k = Math.min(1, this.t / 1.2);
    for (const s of this.streaks) {
      s.r = (s.r + dt * s.v * (0.3 + 1.6 * k)) % 1;
      const r0 = s.r * s.r * R, r1 = r0 + (30 + 260 * k) * s.r;
      g.strokeStyle = s.c < 0.12 ? '#c8483a' : s.c < 0.22 ? '#277e86' : '#2b211f';
      g.lineWidth = s.w * (0.4 + s.r);
      g.beginPath(); g.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0); g.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1); g.stroke();
    }
  }
}
