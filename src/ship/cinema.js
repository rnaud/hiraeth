// Screen-space pieces for the ship's cinematics, in the game's paper-and-ink
// UI: letterbox bars, subtitles (speaker + line), "hold to skip", a fade,
// eyelids, a red alarm wash, the objective card and the warp streaks of
// travel. Built on demand; inert in node.
//
// Nothing written on the screen sits on anything else: each piece gets its own
// place from layoutCinema() (DOM-free, tested), which stacks the hint, the
// game's toasts (#toast) and the objective card down from the top, the
// subtitle up from the bottom and the skip bar in the bottom corner, round the
// letterbox and whatever HUD, buttons, conversation or box card is showing.
// Subtitles replace each other cleanly, one at a time (Subtitles: a line can
// also be timed, or queued behind the one showing).
import { screen } from '../platform.js';
import { speakLine } from '../story/voice.js';
import { inputKind, keyText, hasKeys, escapeHtml } from '../prompt-keys.js';
import { backKey } from '../native-pad.js';
import { toastSeconds } from '../quest.js';   // a long toast stays up longer   // the mumbled voice under each subtitle

const CSS = `
#cine { position: fixed; inset: 0; z-index: 8000; pointer-events: none; }
#cine .bar { position: absolute; left: 0; right: 0; height: 0; background: #2b211f; transition: height 1.1s cubic-bezier(.6,0,.3,1); }
#cine .bar.top { top: 0; } #cine .bar.bot { bottom: 0; }
#cine.on .bar { height: 11vh; }
#cine.lids .bar { height: 50.5vh; transition-duration: 0s; }
#cine .sub { position: absolute; left: 50%; bottom: calc(11vh + 14px); transform: translateX(-50%); width: min(820px, calc(100vw - 32px)); text-align: center;
  font: clamp(14px, 3.9vw, 17px)/1.4 ui-monospace, Menlo, monospace; color: #2b211f; opacity: 0; transition: opacity .2s; }
#cine .sub span { display: block; width: fit-content; max-width: 100%; box-sizing: border-box; margin: 0 auto; padding: 5px 12px 6px;
  background: rgba(247, 236, 210, 0.95); border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; text-wrap: balance; }
#cine .sub b { letter-spacing: .14em; margin-right: 8px; font-weight: bold; }
#cine .sub b.father { color: #7a3a35; } #cine .sub b.mother { color: #277e86; } #cine .sub b.ship { color: #c8483a; }
#cine .sub.show { opacity: 1; transition: opacity .2s, bottom .3s; }
#cine .sub.show.in span { animation: cine-sub-in .22s ease-out; }
@keyframes cine-sub-in { from { opacity: 0; transform: translateY(4px); } }
#cine .skip { position: absolute; right: calc(22px + var(--safe-right, 0px)); bottom: calc(5.5vh - 10px); font: 12px ui-monospace, Menlo, monospace; color: #f7ecd2; opacity: 0;
  transition: opacity .3s; letter-spacing: .08em; padding: 3px 8px; background: rgba(43, 33, 31, .82); white-space: nowrap; }
#cine .skip.show { opacity: .9; }
#cine .skip.press { pointer-events: auto; cursor: pointer; } #cine .skip.press i { display: none; }
#cine .skip i { display: inline-block; vertical-align: middle; width: 60px; height: 6px; margin-left: 8px; border: 1px solid #f7ecd2; }
#cine .skip i u { display: block; height: 100%; width: 0; background: #f2c54b; }
#cine .fade { position: absolute; inset: 0; background: #2b211f; opacity: 0; transition: opacity .6s; }
#cine .fade.white { background: #fff6dc; }
#cine .red { position: absolute; inset: 0; opacity: 0; mix-blend-mode: multiply;
  background: radial-gradient(ellipse at center, rgba(255, 150, 130, .55) 30%, rgba(170, 30, 25, .95) 100%); }
#cine .hint { position: absolute; left: 50%; top: calc(11vh + 12px); transform: translateX(-50%); font: 12px ui-monospace, Menlo, monospace; color: #2b211f;
  width: max-content; max-width: min(560px, calc(100vw - 40px)); box-sizing: border-box; text-align: center;
  padding: 4px 11px; background: rgba(255, 246, 220, .84); border: 1px solid rgba(43, 33, 31, .5); border-radius: 10px; opacity: 0; transition: opacity .4s; }
#cine .hint.show { opacity: 1; transition: opacity .4s, top .3s; }
#objective { position: fixed; left: 50%; top: 18vh; transform: translateX(-50%); z-index: 7900; pointer-events: none; text-align: center; opacity: 0;
  width: max-content; max-width: min(640px, calc(100vw - 32px)); font: 13px ui-monospace, Menlo, monospace; color: #2b211f; }
#objective .k { letter-spacing: .3em; font-size: 11px; opacity: .75; }
#objective .t { margin: 6px 6px 6px 0; padding: 10px 22px; font-size: clamp(18px, 5vw, 24px); letter-spacing: .06em; background: #fff6dc; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f; text-wrap: balance; }
#objective.show { animation: objective 6.5s forwards; transition: top .3s; }
@keyframes objective { 0% { opacity: 0; transform: translate(-50%, 10px) rotate(-1deg); } 8%, 82% { opacity: 1; transform: translate(-50%, 0) rotate(-.6deg); } 100% { opacity: 0; } }
#warp { position: fixed; inset: 0; z-index: 8400; pointer-events: none; opacity: 0; transition: opacity .5s; }
#warp.on { opacity: 1; }
#warp .title { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font: 30px ui-monospace, Menlo, monospace; letter-spacing: .24em;
  color: #2b211f; padding: 10px 22px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f; text-transform: uppercase; opacity: 0; transition: opacity .6s .4s; }
#warp.on .title { opacity: 1; }
`;

/** The hold-to-skip tag's words: a controller's back button (printed B), else Esc. */
export const holdToSkip = (kind = inputKind()) => (kind === 'pad' ? `hold ${backKey()} to skip` : 'hold ESC to skip');
const hasDOM = () => typeof document !== 'undefined' && !!document.body;
/** A toast's, a hint's or the objective's words into their box: plain text, a {key:verb} as the player's own key or button (src/prompt-keys.js). */
const setText = (el, text) => { if (hasKeys(text)) el.innerHTML = keyText(escapeHtml(text), { html: true }); else el.textContent = text; };

/**
 * A quest's start, as its toast says it (the toast with class "quest", index.html): a small head
 * ("New quest", "New errand") over the quest's title and its first step. Plain HTML, the step's
 * {key:verb} as the player's own key or button.
 */
export function questToastHtml({ head = 'New quest', title = '', step = '' } = {}) {
  const k = (s) => (hasKeys(s) ? keyText(escapeHtml(s), { html: true }) : escapeHtml(s));
  return `<span class="qk">◆ ${escapeHtml(head)}</span><span class="qt">${escapeHtml(title)}</span>${step ? `<span class="qs">${k(step)}</span>` : ''}`;
}

/** Seconds a line of `text` needs on screen (as the calls time theirs). */
export const readTime = (text) => Math.min(6.2, 1.4 + String(text ?? '').length * 0.052);

// ---------------------------------------------------------------------------
// Layout (no DOM: rectangles in CSS pixels, y down)

export const BAR = 0.11;     // the letterbox, as a fraction of the screen height
const hit = (a, b, pad = 0) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > -pad && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > -pad;

/**
 * Where everything written on the screen goes, so nothing overlaps.
 * @param o.w, o.h      the viewport
 * @param o.bars        the letterbox is down (BAR of the height, top and bottom)
 * @param o.items       what is showing, in the order it appeared: [{ id, w, h, place }]
 *                      place 'top': centred, stacked down from the top (hint, toast, objective)
 *                            'bottom': centred, stacked up from the bottom (the subtitle)
 *                            'corner': bottom right; inside the bottom bar when it fits (skip)
 * @param o.obstacles   rects not to cover: HUD, buttons, a conversation, the box card
 * @param o.safe        insets { top, right, bottom, left }
 * @returns { bar, rects: { id: {x0,y0,x1,y1} }, fits }   (fits: everything is on screen)
 */
export function layoutCinema({ w, h, bars = false, items = [], obstacles = [], safe = {}, gap = 8, margin = 12 }) {
  const bar = bars ? Math.round(h * BAR) : 0;
  const S = { top: 0, right: 0, bottom: 0, left: 0, ...safe };
  const placed = [], rects = {};
  let fits = true;
  const free = (r) => !obstacles.some((o) => hit(r, o, gap / 2)) && !placed.some((p) => hit(r, p, gap / 2));
  const put = (id, r) => { placed.push(r); rects[id] = r; if (r.y0 < -0.5 || r.y1 > h + 0.5 || r.x0 < -0.5 || r.x1 > w + 0.5) fits = false; };
  const top0 = (bar ? bar : S.top) + margin, bot0 = h - (bar ? bar : S.bottom) - margin;
  /** r where it is, or moved sideways along its row to the free span nearest where it was (null: none wide enough). */
  const slide = (r) => {
    if (free(r)) return r;
    const iw = r.x1 - r.x0, lo = S.left + margin, hi = w - S.right - margin;
    const row = [...obstacles, ...placed].filter((o) => Math.min(r.y1, o.y1) - Math.max(r.y0, o.y0) > -gap / 2).sort((a, b) => a.x0 - b.x0);
    let best = null, a = lo;
    for (const o of [...row, { x0: hi + gap, x1: hi + gap }]) {
      const b = o.x0 - gap;
      if (b - a >= iw) {
        const x = Math.min(Math.max(r.x0, a), b - iw), c = { x0: x, y0: r.y0, x1: x + iw, y1: r.y1 };
        if (free(c) && (!best || Math.abs(x - r.x0) < Math.abs(best.x0 - r.x0))) best = c;
      }
      a = Math.max(a, o.x1 + gap);
    }
    return best;
  };
  for (const it of items) {
    const iw = Math.min(it.w, w - 2 * margin), ih = it.h;
    if (it.place === 'corner') {
      const x1 = w - S.right - 22, x0 = x1 - iw;
      // in the bottom bar, centred on it, when it fits there; else stacked over the bottom
      if (bar >= ih + 6) {
        const y0 = h - bar / 2 - ih / 2;
        let r = { x0, y0, x1, y1: y0 + ih };
        for (let k = 0; k < 20 && !free(r); k++) {
          const left = Math.min(...[...obstacles, ...placed].filter((o) => hit(r, o, gap / 2)).map((o) => o.x0)) - gap;
          r = { x0: left - iw, y0, x1: left, y1: y0 + ih };
        }
        if (r.x0 >= S.left + margin && free(r)) { put(it.id, r); continue; }
      }
      let y1 = bot0;
      for (let k = 0; k < 40; k++) {
        const r = { x0, y0: y1 - ih, x1, y1 };
        if (free(r)) break;
        const blockers = [...obstacles, ...placed].filter((o) => hit(r, o, gap / 2));
        y1 = Math.min(...blockers.map((o) => o.y0)) - gap;
      }
      put(it.id, { x0, y0: y1 - ih, x1, y1 });
      continue;
    }
    const x0 = (w - iw) / 2, x1 = x0 + iw;
    if (it.place === 'bottom') {
      let y1 = bot0;
      for (let k = 0; k < 40; k++) {
        const r = { x0, y0: y1 - ih, x1, y1 };
        if (free(r)) break;
        const blockers = [...obstacles, ...placed].filter((o) => hit(r, o, gap / 2));
        y1 = Math.min(...blockers.map((o) => o.y0)) - gap;
      }
      put(it.id, { x0, y0: y1 - ih, x1, y1 });
    } else {
      // centred when it can be; else slid sideways into the row's widest gap nearest the centre (a phone's
      // buttons down the right, the health bar top left); else the next row down
      let y0 = Math.max(top0, it.minTop ?? 0), r = null;
      for (let k = 0; k < 40 && !r; k++) {
        r = slide({ x0, y0, x1, y1: y0 + ih });
        if (r) break;
        const band = { x0: S.left, y0, x1: w - S.right, y1: y0 + ih };
        const blockers = [...obstacles, ...placed].filter((o) => hit(band, o, gap / 2));
        y0 = (blockers.length ? Math.min(...blockers.map((o) => o.y1)) : y0) + gap;
      }
      put(it.id, r ?? { x0, y0, x1, y1: y0 + ih });
    }
  }
  // nothing but the skip bar may sit on the letterbox
  if (bar) for (const [id, r] of Object.entries(rects)) if (id !== 'skip' && (r.y0 < bar - 0.5 || r.y1 > h - bar + 0.5)) fits = false;
  return { bar, rects, fits };
}

/** Pairs of rects that overlap (for checking a layout). */
export function overlaps(rects) {
  const ks = Object.keys(rects), out = [];
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (hit(rects[ks[i]], rects[ks[j]])) out.push([ks[i], ks[j]]);
  return out;
}

// ---------------------------------------------------------------------------
// Subtitles: one line at a time

export class Subtitles {
  constructor() { this.cur = null; this.t = 0; this.queue = []; }
  /** Show a line now, replacing the one up (and anything waiting). secs: clear it after that long (else it stays until replaced). */
  say(line, secs = null) {
    this.queue.length = 0;
    this.cur = line ? { line, secs } : null;
    this.t = 0;
    return this.cur?.line ?? null;
  }
  /** Show a line after the one up (and any waiting) has had its time; secs defaults to its reading time. */
  add(line, secs = readTime(line?.text)) {
    if (!this.cur) return this.say(line, secs);
    this.queue.push({ line, secs });
    return this.cur.line;
  }
  /** Advance; returns true when the line on screen changed. */
  tick(dt) {
    if (!this.cur || this.cur.secs == null) return false;
    this.t += dt;
    if (this.t < this.cur.secs) return false;
    this.cur = this.queue.shift() ?? null;
    this.t = 0;
    return true;
  }
  get line() { return this.cur?.line ?? null; }
}

// ---------------------------------------------------------------------------

/** The rect of an element that is showing (else null). */
function shown(e) {
  if (!e || !e.isConnected) return null;
  for (let p = e; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
  }
  const r = e.getBoundingClientRect();
  return r.width > 1 && r.height > 1 ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null;
}
const HOLD_TOASTS = '#homeward.open, #starmap.open, #page.open, #journal.open, #warp.on';
// (#health whether it shows or not: it comes up the moment you are hurt, and a toast must never sit on it)
export const OBSTACLES = ['#health', '#cue.show', '#gear', '#fps', '#touch button', '#controller-hint', '#dialogue.open .dlg-panel', '#dialogue.open .dlg-who', '#dialogue.open .dlg-tag', '#boxscene.card #boxcard', '#boxscene.on .skip'];

export class Cinema {
  constructor() {
    this.dom = hasDOM();
    this.skipK = 0;
    this.subs = new Subtitles();
    this._order = [];
    this._layoutT = 0;
    this.toasts = [];        // waiting their turn (see toast())
    this._toastT = 0;
    this._lidK = 1;
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
    this.obj.addEventListener('animationend', () => { this.obj.classList.remove('show'); this.layout(); });
    // the game's toasts (index.html #toast, main.js) take their place in the stack too
    this.toastEl = document.getElementById('toast');
    if (this.toastEl) {
      this.toastEl.addEventListener('animationend', () => { this.toastEl.classList.remove('show'); this.layout(); });
      new MutationObserver(() => { if (this.toastEl.classList.contains('show') && !this._order.includes('toast')) this._toastAt = performance.now(); this.layout(); }).observe(this.toastEl, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
    }
    addEventListener('resize', () => this.layout());
  }

  bars(on) {
    if (!this.dom) return;
    this.el.classList.toggle('on', on);
    document.body.classList.toggle('cine-on', on);
    this.layout();
  }
  lids(closed) { this.dom && this.el.classList.toggle('lids', closed); }
  /** Eyelids opening: k = 0 closed .. 1 open (drives the bar heights directly). */
  eyelids(k) {
    this._lidK = k;
    if (!this.dom) return;
    const h = 50.5 - (50.5 - 11) * Math.max(0, Math.min(1, k));
    for (const b of this.el.querySelectorAll('.bar')) { b.style.transition = 'none'; b.style.height = `${h}vh`; }
  }
  releaseLids() { this._lidK = 1; if (this.dom) for (const b of this.el.querySelectorAll('.bar')) { b.style.transition = ''; b.style.height = ''; } }

  /**
   * A subtitle, replacing the one up. opts.secs: take it down after that long;
   * opts.queue: wait for the one up to have its time first.
   */
  say(line, { secs = null, queue = false } = {}) {
    const before = this.subs.line;
    if (queue && line) this.subs.add(line, secs ?? readTime(line.text));
    else this.subs.say(line, secs);
    if (this.subs.line !== before) this._showLine();
  }

  _showLine() {
    speakLine(this.subs.line);   // the voice under the line now up (src/story/voice.js; null hushes it)
    if (this.subs.line?.text) this.onWords?.(this.subs.line.text);   // (words on the screen: main.js listens for the hum)
    if (!this.dom) return;
    const line = this.subs.line;
    if (!line) { this.sub.classList.remove('show', 'in'); this._seen('sub', false); this.layout(); return; }
    const who = { father: 'FATHER', mother: 'MOTHER', ship: 'SHIP', lou: 'LOU', ilen: 'ILEN' }[line.who] ?? '';
    this.subText.innerHTML = `${who ? `<b class="${line.who}">${who}</b>` : ''}${keyText(line.text, { html: true })}`;
    // a new line comes in over the old one's place (one box, never two)
    this.sub.classList.remove('in');
    this._seen('sub', true);
    this.layout();
    void this.sub.offsetWidth;
    this.sub.classList.add('show', 'in');
  }

  hint(text) {
    if (!this.dom) return;
    if (text) setText(this.hintEl, text);
    this._seen('hint', !!text);
    this.layout();   // (placed before it shows: it fades in where it belongs, no slide)
    if (text) void this.hintEl.offsetWidth;
    this.hintEl.classList.toggle('show', !!text);
  }

  /** Show only the touch controls and the use prompt (the rest of the HUD stays hidden): a scene you walk through. */
  controls(show) {
    if (!this.dom) return;
    const t = document.getElementById('touch');
    if (t) t.style.visibility = show ? '' : 'hidden';
    const c = document.getElementById('cue');   // (over the letterbox's rule that hides it, index.html)
    if (c) c.style.visibility = show ? 'visible' : 'hidden';
    this.layout();
  }

  fade(k, white = false, secs = 0.6) {
    if (!this.dom) return;
    this.fadeEl.classList.toggle('white', white);
    this.fadeEl.style.transition = `opacity ${secs}s`;
    this.fadeEl.style.opacity = String(k);
  }

  red(k) { if (this.dom) this.redEl.style.opacity = String(k); }

  /** The skip tag: hold-to-skip with its bar (the ship's scenes), or `label` for a press (a moment, src/story/moment.js; tappable). */
  skip(k, show, label = null) {
    this.skipK = k;
    if (!this.dom) return;
    const txt = label ?? holdToSkip(), node = this.skipEl.firstChild;
    if (node && node.nodeType === 3 && node.nodeValue !== txt && (show || !label)) node.nodeValue = txt;
    this.skipEl.classList.toggle('press', !!label && show);
    const was = this.skipEl.classList.contains('show');
    this.skipEl.classList.toggle('show', show);
    this.skipBar.style.width = `${Math.round(k * 100)}%`;
    if (was !== show) { this._seen('skip', show); this.layout(); }
  }

  objective(text) {
    if (!this.dom) return;
    setText(this.obj.querySelector('.t'), text);
    this.obj.classList.remove('show');
    this._seen('objective', false); this._seen('objective', true);
    this._pending = 'objective'; this.layout(); this._pending = null;
    void this.obj.offsetWidth; this.obj.classList.add('show');
  }

  /** Hide or show the game HUD (the cue, fps, the touch buttons) during a cinematic. */
  hud(show) {
    if (!this.dom) return;
    for (const id of ['cue', 'fps', 'gear', 'touch']) { const e = document.getElementById(id); if (e) e.style.visibility = show ? '' : 'hidden'; }
    this.layout();
  }

  /**
   * A toast (the game's notices: a quest, a find, an update). They queue: each
   * has a few seconds before the next replaces it, and they wait while a scene
   * has the screen dark or the eyes shut. Placed by layout() like the rest.
   */
  toast(text, o = null) {
    if (!text) return;
    if (this.toasts.at(-1)?.text !== text) this.toasts.push({ text, ...(o?.kind === 'quest' ? o : {}) });
    this._pumpToasts();
  }

  /**
   * Toasts wait: the screen is dark (eyes shut, faded to black), or a panel
   * has it (the cargo choice, the star map, a story page, the sketchbook).
   */
  dark() {
    if (!this.dom) return false;
    if (this.held) return true;   // (a moment plays: src/story/moment.js; its toasts come after)
    return this._lidK < 0.9 || this.el.classList.contains('lids') || (parseFloat(this.fadeEl.style.opacity) || 0) > 0.5
      || !!document.querySelector(HOLD_TOASTS);
  }

  _pumpToasts() {
    if (!this.dom || !this.toastEl || !this.toasts.length || this._toastT > 0 || this.dark()) return;
    const item = this.toasts.shift(), text = item.text, quest = item.kind === 'quest';
    const secs = toastSeconds(text) + (quest ? 1 : 0);   // (a quest's start: a moment longer, it is three lines)
    this.onWords?.(text);   // (words on the screen: main.js listens for the hum)
    screen.toast(keyText(text), secs);   // (as data too: platform.js screen.toast)
    // a quest's start looks unlike the other notices: its own card (questToastHtml, index.html #toast.quest)
    if (quest) this.toastEl.innerHTML = questToastHtml(item); else setText(this.toastEl, text);
    this.toastEl.classList.toggle('quest', quest);
    this._toastItem = item;
    this.toastEl.style.animationDuration = `${secs}s`;
    this.toastEl.classList.remove('show');
    this._toastT = secs * 0.58;   // read before the next may take its place (it fades by itself after secs)
    this._seen('toast', false); this._seen('toast', true);
    this._pending = 'toast'; this.layout(); this._pending = null;
    void this.toastEl.offsetWidth; this.toastEl.classList.add('show');
    this._toastAt = performance.now();
  }

  /** Per frame: timed subtitles, waiting toasts, and a fresh layout now and then (HUD and panels come and go). */
  update(dt) {
    if (this.subs.tick(dt)) this._showLine();
    this._toastT = Math.max(0, this._toastT - dt);
    // a toast that went up just before the screen went dark (the opening's black, the eyes shut) comes back after
    const T = this.toastEl;
    if (T && T.classList.contains('show') && this.dark()) {
      if (performance.now() - (this._toastAt ?? 0) < 3200) this.toasts.unshift(this._toastItem ?? { text: T.textContent });   // (else it was fading out anyway)
      T.classList.remove('show');
      this._toastT = 0;
      this.layout();
    }
    this._pumpToasts();
    if ((this._layoutT -= dt) <= 0) { this._layoutT = 0.25; this.layout(); }
  }

  _seen(id, on) {
    const i = this._order.indexOf(id);
    if (on && i < 0) this._order.push(id);
    if (!on && i >= 0) this._order.splice(i, 1);
  }

  /** Measure what is showing and give each piece its place (layoutCinema). */
  layout() {
    if (!this.dom) return;
    const els = { hint: this.hintEl, sub: this.subText, skip: this.skipEl, objective: this.obj, toast: this.toastEl };
    const place = { hint: 'top', toast: 'top', objective: 'top', sub: 'bottom', skip: 'corner' };
    if (this.toastEl && this._pending !== 'toast') this._seen('toast', this.toastEl.classList.contains('show'));
    if (this._pending !== 'objective' && !this.obj.classList.contains('show')) this._seen('objective', false);
    const items = [];
    for (const id of this._order) {
      const e = els[id];
      if (!e) continue;
      items.push({ id, w: e.offsetWidth, h: e.offsetHeight, place: place[id], minTop: id === 'objective' && !this.el.classList.contains('on') ? innerHeight * 0.12 : 0 });
    }
    if (!items.length) { this._clear = null; return; }
    const obstacles = [];
    for (const sel of OBSTACLES) for (const e of document.querySelectorAll(sel)) { const r = shown(e); if (r) obstacles.push(r); }
    const cs = getComputedStyle(document.documentElement), px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    const L = layoutCinema({ w: innerWidth, h: innerHeight, bars: this.el.classList.contains('on') || this.el.classList.contains('lids'), items, obstacles,
      safe: { top: px('--safe-top'), right: px('--safe-right'), bottom: px('--safe-bottom'), left: px('--safe-left') } });
    this.lastLayout = L;
    const set = (e, k, v) => { const s = `${Math.round(v)}px`; if (e.style[k] !== s) e.style[k] = s; };
    for (const [id, r] of Object.entries(L.rects)) {
      if (id === 'sub') { set(this.sub, 'bottom', innerHeight - r.y1); document.documentElement.style.setProperty('--cine-sub-clear', `${Math.round(innerHeight - r.y0 + 10)}px`); }
      else if (id === 'skip') { set(this.skipEl, 'bottom', innerHeight - r.y1); set(this.skipEl, 'right', innerWidth - r.x1); }
      else { set(els[id], 'top', r.y0); set(els[id], 'left', (r.x0 + r.x1) / 2); }   // (left: its centre, the CSS translates it by half its width)
    }
    if (!L.rects.sub) document.documentElement.style.removeProperty('--cine-sub-clear');
  }

  clear() { this.say(null); this.hint(null); this.red(0); this.skip(0, false); this.bars(false); this.releaseLids(); this.lids(false); this.fade(0); this.hud(true); }
}

/** Travel between worlds: ink streaks rushing out from the centre, then the destination's name. */
/**
 * The jump to space (the take-off's last seconds, then the loading screen of the next world): it used to be
 * ink streaks on the paper's cream, a white page between a dusty sky and a new world that read as a glitch.
 * Now space opens from the middle of the screen: a disc of the night's ink grows out over the climb (`hole`,
 * the share of the screen's half-diagonal it covers, eased), the streaks are drawn in the paper's cream, a
 * little teal and red on it, and a few fixed stars show; the paper is only the course card's. The next world's
 * loading screen keeps the same ink (index.html #loading.space, ?via=ship).
 */
export const WARP = {
  space: '#151a2b',    // the night's ink: the same as the loading screen's (index.html #loading.space)
  ink: '#2b211f', paper: '#f7ecd2',
  streaks: ['#f7ecd2', '#62c3c9', '#e0705f'],   // cream, the teal and the red, light on the dark
  open: 0.9,           // s: the disc covers the screen
  stars: 90,
};

/** The warp's look at `t` seconds: the disc's reach (0..1 of the half-diagonal) and how far the streaks are drawn. */
export function warpLook(t) {
  const k = Math.min(1, Math.max(0, t / WARP.open));
  const hole = k * k * (3 - 2 * k);   // (smoothstep: a slow start, out to the corners)
  return { hole, speed: Math.min(1, Math.max(0, t / 1.2)) };
}

export class Warp {
  constructor() {
    if (!hasDOM()) return;
    const el = (this.el = document.createElement('div'));
    el.id = 'warp';
    el.innerHTML = '<canvas></canvas><div class="title"></div>';
    document.body.appendChild(el);
    this.canvas = el.querySelector('canvas');
    this.streaks = Array.from({ length: 220 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.4 + Math.random(), w: 1 + Math.random() * 2.5, c: Math.random() }));
    this.stars = Array.from({ length: WARP.stars }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.4 }));
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
    const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy), { hole, speed: k } = warpLook(this.t);
    // the climb's sky fades in under the element (its opacity); space opens out of the middle of it, an inked rim round the disc
    g.clearRect(0, 0, W, H);
    if (hole < 1) { g.fillStyle = WARP.paper; g.globalAlpha = 0.35 + 0.65 * hole; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    const rh = hole >= 1 ? R * 1.5 : Math.max(1, hole * R * 1.04);
    g.fillStyle = WARP.space;
    g.beginPath(); g.arc(cx, cy, rh, 0, Math.PI * 2); g.fill();
    if (hole < 1) { g.strokeStyle = WARP.ink; g.lineWidth = 3; g.stroke(); }
    g.save(); g.beginPath(); g.arc(cx, cy, rh, 0, Math.PI * 2); g.clip();
    g.fillStyle = WARP.paper;
    for (const st of this.stars) { g.globalAlpha = 0.55; g.fillRect(st.x * W, st.y * H, st.s, st.s); }
    g.globalAlpha = 1;
    for (const s of this.streaks) {
      s.r = (s.r + dt * s.v * (0.3 + 1.6 * k)) % 1;
      const r0 = s.r * s.r * R, r1 = r0 + (30 + 260 * k) * s.r;
      g.strokeStyle = s.c < 0.12 ? WARP.streaks[2] : s.c < 0.22 ? WARP.streaks[1] : WARP.streaks[0];
      g.lineWidth = s.w * (0.4 + s.r);
      g.beginPath(); g.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0); g.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1); g.stroke();
    }
    g.restore();
  }
}
