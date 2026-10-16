// Words in the world for a minigame (docs/systems/minigames.md): a point's "+20" that floats up from
// where a shot landed, a speech balloon over someone who calls out, a label over a thing to pick.
// Plain DOM over the canvas, placed where a world point falls on the screen each frame; and the same words as the
// screen's 'words' part (src/platform.js), which an engine draws (BridgeHud.cs DrawWords): the pops by their world
// point, kind and length (it floats and fades them on its own clock), the balloons and tags where they were placed.
//
//   const words = new WorldLabels(camera);
//   words.pop(point, '+20', 'gold');                 // floats up and fades
//   const say = words.balloon();  say.show(text, 2.5); say.place(headPoint);
//   const tag = words.tag('<b>Longer blade</b><br>…'); tag.place(point); tag.remove();
//   words.update(dt);  …  words.dispose();

import * as THREE from 'three';
import { screen } from '../../platform.js';

const CSS = `
#mg-words { position: fixed; inset: 0; pointer-events: none; z-index: 79; font: 700 calc(var(--type-s) * 1.15)/1.2 var(--face); color: #2b211f; }
#mg-words .pop { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; color: #fbf4e2; -webkit-text-stroke: 3px #2b211f; paint-order: stroke fill; font-size: 20px; letter-spacing: .04em; }
#mg-words .pop.gold { color: #f2c54b; font-size: 28px; }
#mg-words .pop.bad { color: #d9643a; font-size: 22px; }
#mg-words .pop.combo { color: #71d7cf; font-size: 24px; }
#mg-words .say { position: absolute; transform: translate(-50%, -100%); max-width: 300px; padding: 7px 12px 8px; background: #fbf4e2; border: 2px solid #2b211f; border-radius: 14px;
  box-shadow: 3px 3px 0 #2b211f; font: var(--type-s)/1.35 var(--face); white-space: normal; transition: opacity .2s; }
#mg-words .say::after { content: ''; position: absolute; left: 24px; bottom: -11px; border: 6px solid transparent; border-top: 6px solid #2b211f; border-left: 6px solid #2b211f; }
#mg-words .say.off { opacity: 0; }
#mg-words .tag { position: absolute; transform: translate(-50%, -100%); padding: 5px 10px 6px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f;
  font: calc(var(--type-s) * 0.85)/1.3 var(--face); text-align: center; white-space: normal; width: max-content; max-width: 13em; }
#mg-words .tag b { display: block; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
`;

const _p = new THREE.Vector3();

// every WorldLabels alive (a game's and a fight temple's could overlap a frame), merged into the screen's one part
const LIVE = new Set();
let popIds = 0;
const r2 = (v) => Math.round(v * 100) / 100;
const at3 = (p) => [r2(p.x), r2(p.y), r2(p.z)];
/** A tag's html as words: its <b> the title, the rest its text (<br> a new line). */
export function tagWords(html) {
  const s = String(html ?? '');
  const b = s.match(/<b>([\s\S]*?)<\/b>/i);
  const plain = (t) => t.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  return { title: b ? plain(b[1]) : '', text: plain(b ? s.replace(b[0], '') : s) };
}
function publish() {
  const pops = [], says = [], tags = [];
  for (const w of LIVE) {
    for (const q of w.pops) pops.push({ id: q.id, text: q.text, kind: q.kind, at: q.at3, secs: q.secs });
    for (const i of w.items) if (i.at) (i.kind === 'say' ? says : tags).push(i.kind === 'say' ? { text: i.text, at: i.at } : { ...i.words, at: i.at });
  }
  screen.set('words', pops.length || says.length || tags.length ? { pops, says, tags } : null);
}

export class WorldLabels {
  constructor(camera) {
    this.camera = camera;
    this.pops = [];
    this.items = new Set();
    LIVE.add(this);
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
    const el = this.el?.appendChild(Object.assign(document.createElement('div'), { className: `pop ${kind}`, textContent: text })) ?? null;
    this.pops.push({ el, at: point.clone(), at3: at3(point), id: ++popIds, text: String(text), kind, t: 0, secs });
    while (this.pops.length > 14) this.pops.shift().el?.remove();
  }

  /** A speech balloon: show(text, secs), place(point) every frame. */
  balloon() {
    const el = this.el?.appendChild(Object.assign(document.createElement('div'), { className: 'say off' }));
    const b = {
      el, left: 0, text: '', kind: 'say', at: null,
      show(text, secs = 2.5) { b.text = String(text); b.left = secs; if (!el) return; el.textContent = text; el.classList.remove('off'); },
      hide() { b.left = 0; b.at = null; el?.classList.add('off'); },
      place: (p) => { if (b.left > 0) { b.at = at3(p); if (el) this.place(el, p, true); } },
      remove: () => { el?.remove(); this.items.delete(b); },
      tick(dt) { if (b.left > 0 && (b.left -= dt) <= 0) b.hide(); },
    };
    this.items.add(b);
    return b;
  }

  /** A label over a thing (html: its words). */
  tag(html) {
    const el = this.el?.appendChild(Object.assign(document.createElement('div'), { className: 'tag', innerHTML: html }));
    const t = { el, kind: 'tag', words: tagWords(html), at: null, place: (p) => { t.at = at3(p); if (el) this.place(el, p, true); }, remove: () => { el?.remove(); this.items.delete(t); }, tick() {} };
    this.items.add(t);
    return t;
  }

  update(dt) {
    for (const i of this.items) i.tick(dt);
    for (const q of this.pops) {
      q.t += dt;
      const k = q.t / q.secs;
      if (!q.el) continue;
      const s = this.screen(q.at);
      if (!s || k >= 1) { q.el.style.display = 'none'; continue; }
      q.el.style.display = '';
      q.el.style.left = `${s.x}px`;
      q.el.style.top = `${s.y - 70 * k}px`;
      q.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      q.el.style.transform = `translate(-50%, -50%) scale(${(1.35 - 0.35 * Math.min(1, k * 4)).toFixed(2)})`;
    }
    for (const q of this.pops) if (q.t >= q.secs) q.el?.remove();
    this.pops = this.pops.filter((q) => q.t < q.secs);
    publish();
  }

  /** Everything off the screen (a retry). */
  clear() { for (const q of this.pops) q.el?.remove(); this.pops = []; for (const i of [...this.items]) i.remove(); publish(); }
  dispose() { this.clear(); this.el?.remove(); LIVE.delete(this); publish(); }
}
