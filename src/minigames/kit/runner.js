// The minigame runner (docs/systems/minigames.md): what every game shares, around the game's own
// session. A game page is the game's page (?game=<id>, src/main.js): its arena is built as the level,
// then the runner takes the traveller and the camera over from the usual play.
//
//   intro     the start card: the name, the one-line rules, the controls (the pad's in Xbox / PlayStation
//             form, or the keys), the best so far. A / × or Enter starts; B / ○ or Esc quits.
//   count     3, 2, 1, GO: the session is drawn and its camera runs, without input
//   play      the clock runs (ctx.time), the session gets the input; Menu / Esc pauses (Resume, Retry, Quit)
//             (a game with drives: false is played on foot: the usual play runs, and the session after it)
//   finishing ctx.finish(…) was called: the score is kept (src/minigames/kit/scores.js), a moment to coast
//   results   the results card: the score, a new best stamped, Retry and Quit
//
// Quit goes back where the player came from: the world (?from=<level>, at the place saved as they left it),
// or the worlds list (Debug) the game was picked in.

import './minigames.css';
import { readInput, NO_INPUT } from './input.js';
import { gameSfx } from './sfx.js';
import { disposeTree } from './dispose.js';
import { formatScore, formatTime, bestScore, recordScore } from './scores.js';
import { inputKind, escapeHtml } from '../../prompt-keys.js';
import { confirmKey, backKey } from '../../native-pad.js';
import { COUNT, FINISH_WAIT, countNumeral, controlsFor, quitHref, optionValue, optionKey, stepOption, optionText, scoreDef, touchButtons, touchButtonsCss } from './flow.js';

export { COUNT, controlsFor, quitHref };

const h = (s) => escapeHtml(s);

export class MinigameRunner {
  /**
   * @param def   the game (src/minigames/<id>.js)
   * @param host  { scene, camera, player, physics, level, sound, wind, ship, state (game-state), kick(k),
   *                from (a level id or null), othersOpen () => bool (a menu of the game's own is up),
   *                navigate (href) => void }
   */
  constructor(def, host) {
    this.def = def;
    this.host = host;
    this.phase = 'intro';
    this.paused = false;
    this.clock = 0;
    this.penalty = 0;
    this.points = 0;
    this.lives = null;
    this.prevIn = NO_INPUT;
    this.added = [];
    this.fov0 = host.camera.fov;
    this.sfx = gameSfx(host.sound);
    this.buildDom();
    document.body.classList.add('minigame');
    document.body.classList.toggle('mg-onfoot', !this.drives);
    // a touch screen: only the buttons the game uses (kit/flow.js touchButtons)
    this.touchStyle = document.createElement('style');
    this.touchStyle.textContent = touchButtonsCss(touchButtons(def));
    document.head.appendChild(this.touchStyle);
    if (host.ship?.parked?.group) host.ship.parked.group.visible = false;   // (the ship waits out of the picture)
    this.ctx = this.makeCtx();
    this.session = def.start(this.ctx) ?? {};
    this.showIntro();
    this.onKey = (e) => this.key(e);
    window.addEventListener('keydown', this.onKey, true);
  }

  /**
   * The runner moves the traveller and the camera (main.js skips the usual play); a game with
   * `drives: false` is played on foot with the usual controls (walking, the blade, the fluid tool, the
   * lock-on), the runner keeping only its cards, clock and HUD (main.js calls update after the camera).
   */
  get drives() { return this.def.drives !== false; }
  /** A card is up (or paused): the pad navigates it, the world gets no input. */
  busy() { return this.paused || this.phase === 'intro' || this.phase === 'results'; }
  /** The card on the screen, for the pad's menu navigation (main.js menuRoot), or null. */
  cardEl() { return this.card.classList.contains('open') ? this.card : null; }

  // ---------------------------------------------------------------- what a session is given
  makeCtx() {
    const R = this, H = this.host;
    return {
      def: this.def, scene: H.scene, camera: H.camera, player: H.player, physics: H.physics, level: H.level,
      sound: H.sound, wind: H.wind, sfx: this.sfx,
      tool: H.tool ?? null, foes: H.foes ?? null, settings: H.settings ?? null,   // (a game played on foot: drives false)
      // (the world's own: the camera rig, a frame grabbed from another viewpoint, its people and creatures,
      // and what a game's own people are made of: main.js)
      rig: H.rig ?? null, capture: H.capture ?? null, npcs: H.npcs ?? [], crowd: H.crowd ?? null, wildlife: H.wildlife ?? null, flora: H.flora ?? null, people: H.people ?? null,
      /** An option chosen on the start card (def.options: a difficulty, a timing offset), or its default. */
      option: (id) => optionValue(this.def, H.state, id),
      /** Seconds since GO, with the penalties. */
      get time() { return R.clock + R.penalty; },
      get phase() { return R.phase; },
      /** A time penalty (a missed gate): added to the clock, flashed. */
      addTime(s, label = s > 0 ? `+${s} s` : `${s} s`) { R.penalty += s; if (label) R.flash(label, s > 0 ? 'bad' : 'good'); },
      get score() { return R.points; },
      setScore(n) { if (n !== R.points) { R.points = n; R.bumpScore(); } },
      addScore(n = 1) { R.points += n; R.bumpScore(); },
      /** A line of the game's own in the score's box (the speed, the gates): null gives the box back to the score. */
      status(text) { R.statusText = text; },
      /** Lives (null: none shown). */
      setLives(n, max = R.livesMax ?? n) { R.lives = n; R.livesMax = max; R.drawLives(); },
      flash: (text, kind = '', secs) => R.flash(text, kind, secs),
      /** The run is over: { score (default: the time, or the points), failed, title, lines: ['…'] }. */
      finish: (result) => R.finish(result),
      kick: (k) => H.kick?.(k),
      /** The camera's field of view (put back when the game ends). */
      setFov(f) { if (Math.abs(H.camera.fov - f) > 0.01) { H.camera.fov = f; H.camera.updateProjectionMatrix(); } },
      /** Ink streaks at the screen's edges, 0..1 (speed). */
      speed: (k) => R.speedLines(k),
      /** Something the session put in the scene, taken out (its geometry disposed) on Retry and when the game is left. */
      add(o) { H.scene.add(o); R.added.push(o); return o; },
      best: () => bestScore(H.state, scoreDef(this.def, H.state)),
      /** The save (flag(name), set(name, value)): what a game keeps besides its best (its splits, a journal). */
      state: H.state,
    };
  }

  // ---------------------------------------------------------------- the frame
  /** main.js, each frame the world runs: dt, and the merged controls (none while a card is up). */
  update(dt, controls) {
    if (this.phase === 'intro' && inputKind() !== this.introKind) this.showIntro();   // (a pad picked up: the card lists its buttons)
    const inp = readInput(controls, this.prevIn);
    this.prevIn = inp;
    if (this.phase === 'count') {
      const was = countNumeral(this.countT);
      this.countT -= dt;
      const n = countNumeral(this.countT);
      if (n !== was) {
        if (n > 0) this.showCount(String(n)); else { this.phase = 'play'; this.showCount('GO!', true); }
        this.sfx.tick(n);
      }
    }
    const live = this.phase === 'play';
    if (live) this.clock += dt;
    this.session.update?.(dt, live ? inp : NO_INPUT, { live, phase: this.phase, t: this.clock, raw: controls ?? {} });   // (raw: the merged controls, for a game reading buttons of its own)
    if (this.phase === 'finishing' && (this.doneT -= dt) <= 0) this.showResults();
    this.drawHud();
  }

  // ---------------------------------------------------------------- the run
  begin() {
    this.closeCard();
    this.phase = 'count';
    this.countT = COUNT.step * COUNT.from;
    this.showCount(String(COUNT.from));
    this.sfx.tick(COUNT.from);
    this.hud.classList.remove('off');
  }

  finish({ score, failed = false, title, lines = [], html = null, wide = false } = {}) {
    if (this.phase !== 'play') return;
    const kind = this.def.score?.kind ?? 'points';
    const value = score ?? (kind === 'time' ? this.clock + this.penalty : this.points);
    // (a time trial not finished has no time to keep; points count even when the lives run out)
    const sd = scoreDef(this.def, this.host.state);   // (a best of each difficulty: def.bestBy)
    const kept = failed && kind === 'time' ? { best: bestScore(this.host.state, sd), isNew: false } : recordScore(this.host.state, sd, value);
    this.result = { value, failed, title, lines, html, wide, ...kept };   // (html: the game's own block on the results, a page of sketches)
    this.phase = 'finishing';
    this.doneT = FINISH_WAIT;
    if (failed) this.sfx.lose(); else this.sfx.finish();
    this.flash(failed ? title ?? 'Out of lives' : title ?? 'Finish!', failed ? 'bad big' : 'good big', 1.6);
  }

  retry() {
    this.session.end?.();
    this.clearAdded();
    this.clock = this.penalty = this.points = 0;
    this.statusText = null;
    this.paused = false;
    this.result = null;
    this.flashEl.textContent = '';
    this.session = this.def.start(this.ctx) ?? {};
    this.drawLives();
    this.begin();
  }

  quit() {
    this.end();
    (this.host.navigate ?? ((href) => { location.href = href; }))(quitHref(this.host.from));
  }

  /** Leave the game: the session's things out of the scene, the camera as it was, the screens gone. */
  end() {
    if (this.ended) return;
    this.ended = true;
    this.session.end?.();
    this.clearAdded();
    this.ctx.setFov(this.fov0);
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
    this.touchStyle?.remove();
    document.body.classList.remove('minigame', 'mg-onfoot');
  }
  clearAdded() { disposeTree(...this.added); this.added.length = 0; }   // (what ctx.add took: made for the run, let go with it)

  setPaused(on) {
    if (!['count', 'play', 'finishing'].includes(this.phase)) return;
    this.paused = on;
    this.session.pause?.(on);   // (a game with a clock of its own, a song: it stops and picks up again)
    if (on) this.openCard(`<p class="kicker">${h(this.def.name)}</p><h1>Paused</h1>
      <p class="best">${this.def.score?.kind === 'time' ? `Time so far ${formatTime(this.clock + this.penalty)}` : `Score so far ${formatScore(this.def, this.points)}`}</p>
      <div class="buttons"><button class="main" data-act="resume">Resume</button><button data-act="retry">Retry</button><button data-act="quit">Quit</button></div>
      <small>${this.hint('resume', 'quit')}</small>`, true);
    else this.closeCard();
  }

  // ---------------------------------------------------------------- input to the cards
  /** A controller's action (main.js): true when the runner took it. */
  padAction(name) {
    if (name === 'zoomIn' || name === 'zoomOut') return false;
    if (!this.drives && name === 'lock' && this.phase === 'play' && !this.paused) return false;   // (on foot: R3 locks on to a foe)
    if (name === 'start' || name === 'settings') {
      if (this.phase === 'intro') this.begin();
      else if (this.phase === 'results') this.retry();
      else this.setPaused(!this.paused);
      return true;
    }
    if (name === 'back') { this.back(); return true; }
    if (name === 'confirm') { if (this.cardEl()) this.press(); return true; }
    return true;   // (the sketchbook, the worlds, photo mode, the scout, the whistle: not in a game)
  }
  back() {
    if (this.paused) this.setPaused(false);
    else if (this.phase === 'intro' || this.phase === 'results') this.quit();
  }
  /** The focused button of the card, or its first. */
  press() {
    const b = this.card.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON' ? document.activeElement : this.card.querySelector('button.main') ?? this.card.querySelector('button');
    b?.click();
  }
  /** An option changed on the start card: kept in the save, the session started again with it, the card redrawn. */
  setOption(id, value) {
    const o = (this.def.options ?? []).find((q) => q.id === id);
    if (!o || this.phase !== 'intro') return;
    this.host.state.set(optionKey(this.def.id, id), value);
    this.session.end?.();
    this.clearAdded();
    this.session = this.def.start(this.ctx) ?? {};
    this.showIntro();
  }
  act(name) {
    if (name === 'start') this.begin();
    else if (name === 'resume') this.setPaused(false);
    else if (name === 'retry') this.retry();
    else if (name === 'quit') this.quit();
  }
  key(e) {
    if (this.ended || this.host.othersOpen?.()) return;
    const card = !!this.cardEl();
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.code === 'Escape' || e.code === 'KeyO') {
      stop();
      if (e.repeat) return;
      if (card) this.back(); else this.setPaused(true);
    } else if (card && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
      stop();
      // (Enter is the card's main button, as its hint says, wherever the focus is: an option's button keeps it
      // after a click; Space presses the focused one)
      if (!e.repeat) { if (e.code === 'Space') this.press(); else this.card.querySelector('button.main')?.click(); }
    } else if (card && e.code === 'KeyR' && this.phase !== 'intro') { stop(); this.retry(); }
    else if (['KeyL', 'KeyP', 'KeyQ', 'KeyJ'].includes(e.code) || (e.code === 'Tab' && (this.drives || card))) stop();   // (the worlds, photo mode, the scout, the sketchbook, lock-on: not in a game)
  }
  hint(yes, no) {
    const kind = inputKind();
    if (kind === 'pad') return `${confirmKey()} ${yes} · ${backKey()} ${no}`;
    if (kind === 'touch') return '';
    return `Enter ${yes} · Esc ${no}${this.phase === 'results' || this.paused ? ' · R retry' : ''}`;
  }

  // ---------------------------------------------------------------- the screens
  buildDom() {
    const el = this.el = document.createElement('div');
    el.id = 'minigame';
    el.innerHTML = `<canvas class="mg-speed"></canvas>
      <div class="mg-hud off"><div class="mg-lives"></div><div class="mg-box mg-timer"></div><div class="mg-box mg-score"></div></div>
      <button class="mg-pause" type="button" aria-label="Pause">❚❚</button>
      <div class="mg-count"></div><div class="mg-flash"></div>
      <div class="mg-card" role="dialog"><div class="sheet"></div></div>`;
    document.body.appendChild(el);
    this.hud = el.querySelector('.mg-hud');
    this.timerEl = el.querySelector('.mg-timer');
    this.scoreEl = el.querySelector('.mg-score');
    this.livesEl = el.querySelector('.mg-lives');
    this.countEl = el.querySelector('.mg-count');
    this.flashEl = el.querySelector('.mg-flash');
    this.card = el.querySelector('.mg-card');
    this.sheet = el.querySelector('.sheet');
    this.speedCv = el.querySelector('canvas.mg-speed');
    this.card.addEventListener('click', (e) => {
      const o = e.target.closest('button[data-opt]');
      if (o) {
        e.stopPropagation();
        const def = (this.def.options ?? []).find((q) => q.id === o.dataset.opt);
        const v = o.dataset.step ? stepOption(def, optionValue(this.def, this.host.state, def.id), +o.dataset.step) : o.dataset.val;
        this._refocus = o.dataset.step ? `button[data-opt="${def.id}"][data-step="${o.dataset.step}"]` : `button[data-opt="${def.id}"][data-val="${o.dataset.val}"]`;
        this.setOption(def.id, v);
        return;
      }
      const b = e.target.closest('button[data-act]'); if (b) { e.stopPropagation(); this.act(b.dataset.act); }
    });
    el.querySelector('.mg-pause').addEventListener('click', (e) => { e.stopPropagation(); this.setPaused(!this.paused); });
  }
  openCard(html, clear = false) {
    this.sheet.innerHTML = html;
    this.sheet.classList.remove('wide');
    this.card.classList.add('open');
    this.card.classList.toggle('clear', clear);
    if (document.pointerLockElement) document.exitPointerLock?.();
    const focus = (this._refocus && this.card.querySelector(this._refocus)) || this.card.querySelector('button.main') || this.card.querySelector('button');
    this._refocus = null;
    setTimeout(() => focus?.focus({ preventScroll: true }), 30);
  }
  closeCard() { this.card.classList.remove('open'); document.activeElement?.blur?.(); }

  showIntro() {
    const d = this.def, S = this.host.state, best = bestScore(S, scoreDef(d, S)), kind = this.introKind = inputKind();
    const rows = controlsFor(d, kind).map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`).join('');
    // the options (def.options): a row of choices each, or a stepper (− value +)
    const opts = (d.options ?? []).map((o) => {
      const v = optionValue(d, S, o.id);
      const body = o.choices ? o.choices.map(([cv, label]) => `<button type="button" data-opt="${h(o.id)}" data-val="${h(cv)}" class="${cv === v ? 'on' : ''}">${h(label)}</button>`).join('')
        : `<button type="button" data-opt="${h(o.id)}" data-step="-1" aria-label="less">−</button><b>${h(optionText(o, v))}</b><button type="button" data-opt="${h(o.id)}" data-step="1" aria-label="more">+</button>`;
      return `<div class="opt"><span>${h(o.label)}</span>${body}${o.hint ? `<small>${h(o.hint)}</small>` : ''}</div>`;
    }).join('');
    this.openCard(`<p class="kicker">A game</p><h1>${h(d.name)}</h1><p>${h(d.blurb)}</p><p class="rules">${h(d.rules)}</p>
      ${rows ? `<dl>${rows}</dl>` : ''}${opts ? `<div class="opts">${opts}</div>` : ''}
      <p class="best">${best === null ? 'No best yet.' : `Best${d.bestBy ? ` (${h(this.optionLabel(d.bestBy))})` : ''}: ${h(formatScore(d, best))}`}</p>
      <div class="buttons"><button class="main" data-act="start">Start</button><button data-act="quit">Quit</button></div>
      <small>${this.hint('start', 'quit')}</small>`);
  }
  showResults() {
    const d = this.def, r = this.result;
    this.phase = 'results';
    this.hud.classList.add('off');
    const lines = (r.lines ?? []).map((l) => `<li>${h(l)}</li>`).join('');
    const label = r.failed ? (r.title ?? 'Out of lives') : d.score?.kind === 'time' ? 'Your time' : 'Your score';
    const showValue = !(r.failed && d.score?.kind === 'time');
    this.openCard(`<p class="kicker">${h(d.name)}</p><h1>${h(label)}</h1>
      ${showValue ? `<div class="big">${h(formatScore(d, r.value))}</div>` : ''}${r.isNew ? '<div class="stamp">New best!</div>' : ''}
      ${lines ? `<ul class="lines">${lines}</ul>` : ''}${r.html ?? ''}
      <p class="best">${r.best === null || r.best === undefined ? 'No best yet.' : `Best: ${h(formatScore(d, r.best))}`}</p>
      <div class="buttons"><button class="main" data-act="retry">Retry</button><button data-act="quit">Quit</button></div>
      <small>${this.hint('retry', 'quit')}</small>`);
    this.sheet.classList.toggle('wide', !!r.wide);
  }
  /** The chosen value's label of a choice option ('Hard'). */
  optionLabel(id) {
    const o = (this.def.options ?? []).find((q) => q.id === id), v = optionValue(this.def, this.host.state, id);
    return o?.choices?.find(([cv]) => cv === v)?.[1] ?? String(v);
  }
  showCount(text, go = false) {
    const el = this.countEl;
    el.textContent = text;
    el.classList.remove('pop', 'go');
    void el.offsetWidth;   // (restart the animation)
    el.classList.add('pop');
    el.classList.toggle('go', go);
    clearTimeout(this._countOff);
    if (go) this._countOff = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, COUNT.go * 1000 + 200);
  }
  flash(text, kind = '', secs = 1.2) {
    const d = document.createElement('div');
    d.textContent = text;
    if (kind) d.className = kind;
    d.style.setProperty('--secs', `${secs}s`);
    this.flashEl.appendChild(d);
    while (this.flashEl.children.length > 3) this.flashEl.firstElementChild.remove();
    setTimeout(() => d.remove(), secs * 1000 + 50);
  }
  bumpScore() { this.scoreEl.classList.remove('bump'); void this.scoreEl.offsetWidth; this.scoreEl.classList.add('bump'); }
  drawLives() {
    if (this.lives === null) { this.livesEl.innerHTML = ''; return; }
    const n = Math.max(this.livesMax ?? this.lives, this.lives);
    this.livesEl.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < this.lives ? '' : 'gone'}"></i>`).join('');
  }
  drawHud() {
    const d = this.def, H = d.hud ?? {};
    const timer = H.timer ?? d.score?.kind === 'time';
    // (hud.countdown: the time left of so many seconds, instead of the time taken)
    const t = timer ? `${formatTime(H.countdown ? Math.max(0, H.countdown - this.clock - this.penalty) : this.clock + this.penalty)}${this.penalty > 0 ? `<small>+${this.penalty} s penalty</small>` : this.penalty < 0 ? `<small>${-this.penalty} s bonus</small>` : ''}` : '';
    if (t !== this._t) { this.timerEl.innerHTML = t; this._t = t; }
    const s = this.statusText ?? ((H.score ?? d.score?.kind === 'points') ? formatScore(d, this.points) : '');
    if (s !== this._s) { this.scoreEl.textContent = s; this._s = s; }
  }
  /** Ink streaks from the edges toward the middle, more and darker the faster (k 0..1). */
  speedLines(k) {
    const cv = this.speedCv;
    if (k < 0.02 && !this._speedOn) return;
    const W = Math.round(innerWidth / 2), Ht = Math.round(innerHeight / 2);
    if (cv.width !== W || cv.height !== Ht) { cv.width = W; cv.height = Ht; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, Ht);
    this._speedOn = k >= 0.02;
    if (!this._speedOn) return;
    const cx = W / 2, cy = Ht * 0.5, R = Math.hypot(W, Ht) / 2, n = Math.round(6 + 22 * k);
    g.strokeStyle = '#2b211f';
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r0 = R * (0.74 + 0.24 * Math.random() - 0.12 * k), len = R * (0.05 + 0.14 * k * Math.random());
      g.globalAlpha = 0.12 + 0.4 * k * Math.random();
      g.lineWidth = 0.5 + 1.1 * Math.random();
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8);
      g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len) * 0.8);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
}
