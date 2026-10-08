// Words in the world for a minigame (docs/systems/minigames.md): a point's "+20" that floats up from
// where a shot landed, a speech balloon over someone who calls out, a label over a thing to pick.
// Plain DOM over the canvas, placed where a world point falls on the screen each frame.
//
//   const words = new WorldLabels(camera);
//   words.pop(point, '+20', 'gold');                 // floats up and fades
//   const say = words.balloon();  say.show(text, 2.5); say.place(headPoint);
//   const tag = words.tag('<b>Longer blade</b><br>…'); tag.place(point); tag.remove();
//   words.update(dt);  …  words.dispose();

import * as THREE from 'three';

const CSS = `
#mg-words { position: fixed; inset: 0; pointer-events: none; z-index: 79; font: 700 15px/1.2 ui-monospace, Menlo, monospace; color: #2b211f; }
#mg-words .pop { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; color: #fbf4e2; -webkit-text-stroke: 3px #2b211f; paint-order: stroke fill; font-size: 20px; letter-spacing: .04em; }
#mg-words .pop.gold { color: #f2c54b; font-size: 28px; }
#mg-words .pop.bad { color: #d9643a; font-size: 22px; }
#mg-words .pop.combo { color: #71d7cf; font-size: 24px; }
#mg-words .say { position: absolute; transform: translate(-50%, -100%); max-width: 300px; padding: 7px 12px 8px; background: #fbf4e2; border: 2px solid #2b211f; border-radius: 14px;
  box-shadow: 3px 3px 0 #2b211f; font: 13px/1.35 ui-monospace, Menlo, monospace; white-space: normal; transition: opacity .2s; }
#mg-words .say::after { content: ''; position: absolute; left: 24px; bottom: -11px; border: 6px solid transparent; border-top: 6px solid #2b211f; border-left: 6px solid #2b211f; }
#mg-words .say.off { opacity: 0; }
#mg-words .tag { position: absolute; transform: translate(-50%, -100%); padding: 5px 10px 6px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f;
  font: 11px/1.3 ui-monospace, Menlo, monospace; text-align: center; white-space: normal; width: max-content; max-width: 150px; }
#mg-words .tag b { display: block; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
`;

const _p = new THREE.Vector3();

export class WorldLabels {
  constructor(camera) {
    this.camera = camera;
    this.pops = [];
    this.items = new Set();
    if (typeof document === 'undefined') { this.el = null; return; }
    if (!document.getElementById('mg-words-css')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'mg-words-css', textContent: CSS }));
    this.el = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'mg-words' }));
  }

  /** Where a world point is on the screen ({ x, y } in px), or null behind the camera / off it. */
  screen(p) {
    _p.copy(p).project(this.camera);
    if (_p.z > 1 || Math.abs(_p.x) > 1.2 || Math.abs(_p.y) > 1.2) return null;
    return { x: (_p.x * 0.5 + 0.5) * innerWidth, y: (0.5 - _p.y * 0.5) * innerHeight };
  }

  /** Put an element at a world point (keep: kept this many px in from the screen's edges, e.g. a balloon's half width). */
  place(el, p, keep = 0) {
    const s = this.screen(p);
    el.style.display = s ? '' : 'none';
    if (!s) return;
    if (keep) { const w = el.offsetWidth / 2 + 8; s.x = Math.max(w, Math.min(innerWidth - w, s.x)); s.y = Math.max(el.offsetHeight + 8, s.y); }
    el.style.left = `${s.x.toFixed(1)}px`; el.style.top = `${s.y.toFixed(1)}px`;
  }

  /** A word that floats up from a point and fades (kind: '', 'gold', 'bad', 'combo'). */
  pop(point, text, kind = '', secs = 0.9) {
    if (!this.el) return;
    const el = this.el.appendChild(Object.assign(document.createElement('div'), { className: `pop ${kind}`, textContent: text }));
    this.pops.push({ el, at: point.clone(), t: 0, secs });
    while (this.pops.length > 14) this.pops.shift().el.remove();
  }

  /** A speech balloon: show(text, secs), place(point) every frame. */
  balloon() {
    const el = this.el?.appendChild(Object.assign(document.createElement('div'), { className: 'say off' }));
    const b = {
      el, left: 0, text: '',
      show(text, secs = 2.5) { if (!el) return; b.text = text; el.textContent = text; el.classList.remove('off'); b.left = secs; },
      hide() { b.left = 0; el?.classList.add('off'); },
      place: (p) => { if (el && b.left > 0) this.place(el, p, true); },
      remove: () => { el?.remove(); this.items.delete(b); },
      tick(dt) { if (b.left > 0 && (b.left -= dt) <= 0) b.hide(); },
    };
    this.items.add(b);
    return b;
  }

  /** A label over a thing (html: its words). */
  tag(html) {
    const el = this.el?.appendChild(Object.assign(document.createElement('div'), { className: 'tag', innerHTML: html }));
    const t = { el, place: (p) => { if (el) this.place(el, p, true); }, remove: () => { el?.remove(); this.items.delete(t); }, tick() {} };
    this.items.add(t);
    return t;
  }

  update(dt) {
    for (const i of this.items) i.tick(dt);
    for (const q of this.pops) {
      q.t += dt;
      const k = q.t / q.secs;
      const s = this.screen(q.at);
      if (!s || k >= 1) { q.el.style.display = 'none'; continue; }
      q.el.style.display = '';
      q.el.style.left = `${s.x}px`;
      q.el.style.top = `${s.y - 70 * k}px`;
      q.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      q.el.style.transform = `translate(-50%, -50%) scale(${(1.35 - 0.35 * Math.min(1, k * 4)).toFixed(2)})`;
    }
    for (const q of this.pops) if (q.t >= q.secs) q.el.remove();
    this.pops = this.pops.filter((q) => q.t < q.secs);
  }

  /** Everything off the screen (a retry). */
  clear() { for (const q of this.pops) q.el.remove(); this.pops = []; for (const i of [...this.items]) i.remove(); }
  dispose() { this.clear(); this.el?.remove(); }
}
