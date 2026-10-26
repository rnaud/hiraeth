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
//
// What it shows is data too (docs/systems/engine-bridge.md, "The trials and games"): the HUD (the clock, the score, the
// lives, the 3-2-1, the flashes, the hint row) is the screen's 'minigame' part (src/platform.js), and the card up (the
// start card, the pause, the results) `cardModel`, its buttons by their acts: an engine draws them (the Unity bridge:
// BridgeHud.cs, and BridgeMenu.cs through engine/menus.js's card) from the same runner the page draws its elements from.

import './minigames.css';
import { readInput, NO_INPUT } from './input.js';
import { gameSfx } from './sfx.js';
import { disposeTree } from './dispose.js';
import { formatScore, formatTime, bestScore, recordScore } from './scores.js';
import { awardOutfit, rewardFor, prizeRule } from './rewards.js';
import { inputKind, escapeHtml, keyText, hasKeys } from '../../prompt-keys.js';
import { confirmKey, backKey } from '../../native-pad.js';
import { glyph } from '../../pad-glyphs.js';
import { stripTone } from '../../story/tone.js';
import { screen } from '../../platform.js';
import { COUNT, FINISH_WAIT, countNumeral, controlsFor, hintRow, quitHref, optionValue, optionOffered, optionKey, stepOption, optionText, scoreDef, touchButtons, touchButtonsCss, resultActions, promptRole, promptKey, PROMPT_KEYS } from './flow.js';

export { COUNT, controlsFor, quitHref };

const h = (s) => escapeHtml(s);
/** A card's html (a trial's prize, a page of sketches) as plain lines, for an engine's card. */
export const plainHtml = (html) => String(html ?? '').replace(/<\/(p|li|div|h\d)>\s*/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

/** The results card's block for a prize won (issue #668): the outfit, and where to wear it. */
export const prizeHtml = (r) => `<div class="mg-prize"><p class="kicker">New outfit</p><p class="name">${h(r.name)}</p><p>Yours. Wear it from the Wardrobe (Menu).</p></div>`;

export class MinigameRunner {
  /**
   * @param def   the game (src/minigames/<id>.js)
   * @param host  { scene, camera, player, physics, level, sound, wind, ship, state (game-state), kick(k),
   *                from (a level id or null), othersOpen () => bool (a menu of the game's own is up),
   *                navigate (href) => void, links? (more ways out of the cards: { quit: { label, href },
   *                extra: [{ id, label, sub, href, step }] }, the Arcade's next and previous game: kit/arcade.js) }
   */
  constructor(def, host) {
    this.def = def;
    this.host = host;
    this.recovering = !!host.recoveryHref?.();
    if (this.recovering) {
      this.phase = 'recovering'; this.paused = false; this.cardModel = null; this.cardV = 0;
      return; // No game session, start card, sources or DOM are created for receipt recovery.
    }
    this.phase = 'intro';
    this.paused = false;
    this.clock = 0;
    this.penalty = 0;
    this.points = 0;
    this.lives = null;
    this.prevIn = NO_INPUT;
    this.added = [];
    this.hintAge = 0; this.hintsUsed = new Map();   // (the hint row: s of play since shown, the buttons used: hintRow)
    this.fov0 = host.camera.fov;
    this.sfx = gameSfx(host.sound);
    this.cardModel = null; this.cardV = 0;   // (the card up, as data: an engine's card, engine/menus.js)
    this.flashes = []; this.flashN = 0; this.countState = null; this.countN = 0; this.hudOn = false;
    this.buildDom();
    document.body.classList.add('minigame');
    document.body.classList.toggle('mg-onfoot', !this.drives);
    // a touch screen: only the buttons the game uses (kit/flow.js touchButtons)
    this.touchStyle = document.createElement('style');
    this.touchStyle.textContent = touchButtonsCss(touchButtons(def), def.touchShow ?? []);
    document.head.appendChild(this.touchStyle);
    if (host.ship?.parked?.group) host.ship.parked.group.visible = false;   // (the ship waits out of the picture)
    this.ctx = this.makeCtx();
    this.session = def.start(this.ctx) ?? {};
    // (def.direct: no start card, the run counts in at once: the pirates between worlds, issue #224; its controls are
    // the small hints at the bottom right instead, def.hints)
    if (def.direct) this.begin(); else this.showIntro();
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
  busy() { return this.recovering || this.paused || this.phase === 'intro' || this.phase === 'results'; }
  /** The card on the screen, for the pad's menu navigation (main.js menuRoot), or null. */
  cardEl() { if (this.recovering) return null; return this.card.classList.contains('open') ? this.card : null; }

  // ---------------------------------------------------------------- what a session is given
  makeCtx() {
    const R = this, H = this.host;
    return {
      def: this.def, scene: H.scene, camera: H.camera, player: H.player, physics: H.physics, level: H.level,
      sound: H.sound, wind: H.wind, sfx: this.sfx, helper: H.helper ?? null,
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
      /** A line beside the controls' hint row (def.hints; html), or null: it stays while the row fades (the missiles left). */
      hintNote(html, text) { R.hintNote = html ?? null; R.hintNoteText = text ?? null; },   // (text: the line as an engine shows it, BridgeHud.cs; plain html by default)
      /** A button of the hint row was used (its id: the row's third field, or its word): its word fades (issue #326). */
      hintUsed(id) { if (!R.hintsUsed.has(id)) R.hintsUsed.set(id, R.hintAge); },
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
      /** Chimes scattered at a point, into the wallet as they are walked over (main.js: the world's chime field; a fight temple's loot). */
      drop(pos, n) { if (n > 0) H.chimes?.drop?.(pos, n); },
      /** Something the session put in the scene, taken out (its geometry disposed) on Retry and when the game is left. */
      add(o) { H.scene.add(o); R.added.push(o); return o; },
      best: () => bestScore(H.state, scoreDef(this.def, H.state)),
      /** The save (flag(name), set(name, value)): what a game keeps besides its best (its splits, a journal). */
      state: H.state,
    };
  }

  // ---------------------------------------------------------------- the frame
  /** main.js, each frame the world runs: dt, and the merged controls (none while a card is up). */
  /** main.js, each frame before the traveller and the gadget in hand read the controls: a game on foot may rewrite its buttons (session.input). */
  filterInput(controls) { if (controls && this.phase === 'play') this.session.input?.(controls); }

  update(dt, controls) {
    if (this.ended) return;
    const recovery = this.recovering && this.host.recoveryHref?.();
    if (recovery) { this.go(recovery); return; }
    if (this.recovering) return; // An invalidated receipt cannot become ordinary story play.
    if (this.phase === 'intro' && inputKind() !== this.introKind) this.showIntro();   // (a pad picked up: the card lists its buttons)
    if (this.hintsEl) this.drawHints(dt);
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
    if (this.ended) return;
    if (this.phase === 'finishing' && (this.doneT -= dt) <= 0) {
      const href = this.host.completionHref?.(this.result);
      if (href) { this.go(href); return; }
      this.showResults();
    }
    this.drawHud();
    this.publish(dt);
  }

  // ---------------------------------------------------------------- the run
  begin() {
    this.closeCard();
    this.phase = 'count';
    this.countT = COUNT.step * COUNT.from;
    this.showCount(String(COUNT.from));
    this.sfx.tick(COUNT.from);
    this.hud.classList.remove('off'); this.hudOn = true;
    // (no start card: what it said as the run begins, a game on the way somewhere: "On the way to Vael")
    if (this.def.direct && this.host.links?.intro?.kicker) this.flash(this.host.links.intro.kicker, 'good', 2.2);
  }
  /**
   * The game's controls as one small row at the bottom right while it runs (def.hints: { pad, keys, touch } rows of
   * [key, word, id], in Xbox / PlayStation form, drawn for the input in hand: src/prompt-keys.js, native-pad.js), in the
   * game's dark hint look (src/hint-look.js); it fades after the first seconds, each word once its button is used
   * (kit/flow.js hintRow, issue #326). A line of the game's own beside it stays (ctx.hintNote: the missiles left).
   */
  drawHints(dt = 0) {
    const kind = inputKind(), live = ['count', 'play'].includes(this.phase) && !this.paused;
    if (kind !== this._hintKind) { this._hintKind = kind; this.hintAge = 0; this.hintsUsed.clear(); }   // (a new input in hand: shown again)
    if (live && this.phase === 'play') this.hintAge += dt;
    const row = hintRow(controlsFor({ controls: this.def.hints }, kind), { age: this.hintAge, used: this.hintsUsed, live });
    this.hintsEl.classList.toggle('off', !live || (row.off && !this.hintNote));
    const sig = `${kind}|${this.hintNote ?? ''}|${row.off}|${row.items.map((i) => +i.gone).join('')}`;
    if (sig === this._hintSig) return;
    this._hintSig = sig;
    const keys = (x) => keyText(h(x), { kind, html: true, teach: true });
    const items = row.items.map((i) => `<span class="${i.gone || row.off ? 'gone' : ''}" data-hint="${h(i.id)}"><b>${keys(i.k)}</b>${h(i.w)}</span>`).join('');
    this.hintsEl.innerHTML = `<div class="mg-hint-row${row.off ? ' gone' : ''}">${items}</div>${this.hintNote ? `<p>${this.hintNote}</p>` : ''}`;
  }

  finish({ score, failed = false, passed = false, title, lines = [], html = null, wide = false, chimes = 0, goal = null } = {}) {
    if (this.ended || this.recovering || this.phase !== 'play') return;
    const kind = this.def.score?.kind ?? 'points';
    const value = score ?? (kind === 'time' ? this.clock + this.penalty : this.points);
    // (a time trial not finished has no time to keep; points count even when the lives run out)
    const sd = scoreDef(this.def, this.host.state);   // (a best of each difficulty: def.bestBy)
    const kept = failed && kind === 'time' ? { best: bestScore(this.host.state, sd), isNew: false } : recordScore(this.host.state, sd, value);
    // (a game's prize, issue #668: an outfit, the first time a run meets its goal; kit/rewards.js. On the results card)
    const prize = awardOutfit(this.host.state, this.def.id, { value, failed, passed });
    if (prize) html = `${html ?? ''}${prizeHtml(prize)}`;
    this.result = { value, failed, title, lines, html, wide, chimes, prize, ...kept, ...(goal ? { goal: { game: goal.game, complete: goal.complete === true } } : {}) };   // (html: the game's own block on the results, a page of sketches; chimes: won, for the host to bank)
    if (failed) this.fails = (this.fails ?? 0) + 1;
    this.host.onResult?.(this.result);   // (a host that keeps more than the best: the pirates between worlds mark the trip won)
    this.phase = 'finishing';
    this.doneT = FINISH_WAIT;
    if (failed) this.sfx.lose(); else this.sfx.finish();
    this.flash(failed ? title ?? 'Out of lives' : title ?? 'Finish!', failed ? 'bad big' : 'good big', 1.6);
  }

  retry() {
    if (this.ended || this.recovering) return;
    this.session.end?.();
    this.clearAdded();
    this.clock = this.penalty = this.points = 0;
    this.statusText = null;
    this.paused = false;
    this.result = null;
    this.flashEl.textContent = '';
    this.flashes.length = 0;
    this.session = this.def.start(this.ctx) ?? {};
    this.drawLives();
    this.begin();
  }

  /** (a game that must be played, host.links.mandatory: the pirates on the way to a world; no way out but through it) */
  get mandatory() { return !!this.host.links?.mandatory; }
  quit() { if (!this.mandatory) this.go(this.host.links?.quit?.href ?? quitHref(this.host.from)); }
  /** Leave the game for another page (Quit, or one of host.links: the Arcade's next game). */
  go(href) {
    if (this.ended) return;
    this.end();
    (this.host.navigate ?? ((href) => { location.href = href; }))(href);
  }
  /** The link `step` away (-1 the previous game, +1 the next: [ and ], LB / RB on a card), or one by its id. */
  link(q) { return (this.host.links?.extra ?? []).find((l) => (typeof q === 'number' ? l.step === q : l.id === q)) ?? null; }
  /** The cards' buttons out, as data: the host's links, then Quit (under its label). */
  outList() {
    const extra = (this.host.links?.extra ?? []).map((l) => ({ act: `link:${l.id}`, label: l.label, sub: l.sub ?? '' }));
    return this.mandatory ? extra : [...extra, { act: 'quit', label: this.host.links?.quit?.label ?? 'Quit' }];
  }
  /** Buttons as the card's html. */
  // (each a prompt, issue #695: its button's glyph and its word, no box; a button of none its pad's A while it has the focus)
  buttonsHtml(list) {
    return list.map((b) => {
      const role = promptRole(b, { paused: this.paused, links: this.host.links });
      const g = !role ? glyph('ok', { focus: true }) : role === 'r' ? `<span class="glyph keys-only" data-glyph="r" data-key="R" aria-hidden="true"></span>` : glyph(role, { key: PROMPT_KEYS[role] });
      return `<button data-act="${h(b.act)}"${b.main ? ' class="main"' : ''}>${g}<span class="lbl">${h(b.label)}${b.sub ? `<small>${h(b.sub)}</small>` : ''}</span></button>`;
    }).join('');
  }
  /** The buttons as the engines' card has them: each its key or pad button for the input in hand (issue #695). */
  cardButtons(list) {
    const kind = inputKind();
    return list.map((b) => ({ ...b, key: promptKey(promptRole(b, { paused: this.paused, links: this.host.links }), kind, { ok: confirmKey(), back: backKey() }) }));
  }
  /** The cards' buttons out: the host's links, then Quit (under its label). */
  outButtons() { return this.buttonsHtml(this.outList()); }
  /** The results card's buttons (kit/flow.js resultActions: a host's links.win, Skip first after failures). */
  resultButtons(r) { return this.buttonsHtml(resultActions(r, this.host.links, this.fails ?? 0)); }

  /** Leave the game: the session's things out of the scene, the camera as it was, the screens gone. */
  end() {
    if (this.ended) return;
    this.ended = true;
    if (this.recovering) return;
    this.session.end?.();
    this.clearAdded();
    this.ctx.setFov(this.fov0);
    window.removeEventListener('keydown', this.onKey, true);
    this.cardModel = null; this.cardV++;
    screen.set('minigame', null);
    this.el.remove();
    this.touchStyle?.remove();
    document.body.classList.remove('minigame', 'mg-onfoot');
  }
  clearAdded() { disposeTree(...this.added); this.added.length = 0; }   // (what ctx.add took: made for the run, let go with it)

  setPaused(on) {
    if (!['count', 'play', 'finishing'].includes(this.phase)) return;
    this.paused = on;
    this.session.pause?.(on);   // (a game with a clock of its own, a song: it stops and picks up again)
    if (on) {
      const best = this.def.score?.kind === 'time' ? `Time so far ${formatTime(this.clock + this.penalty)}` : `Score so far ${formatScore(this.def, this.points)}`;
      const buttons = [{ act: 'resume', label: 'Resume', main: true }, { act: 'retry', label: 'Retry' }, ...this.outList()];
      this.setCard({ kind: 'paused', kicker: this.def.name, title: 'Paused', best, buttons: this.cardButtons(buttons), hint: this.hint('resume', 'quit') });
      this.openCard(`<p class="kicker">${h(this.def.name)}</p><h1>Paused</h1>
      <p class="best">${best}</p>
      <div class="buttons">${this.buttonsHtml(buttons)}</div>`, true);
    } else this.closeCard();
    this.publish();
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
    if ((name === 'tabPrev' || name === 'tabNext') && this.cardEl()) { const l = this.link(name === 'tabPrev' ? -1 : 1); if (l) this.go(l.href); return true; }   // (the Arcade: the game before / after)
    if (name === 'confirm') { if (this.cardEl()) this.press(); return true; }
    return true;   // (the sketchbook, the worlds, photo mode, the scout, the whistle: not in a game)
  }
  back() {
    if (this.paused) this.setPaused(false);
    else if (this.mandatory) { if (this.phase === 'results' && !this.result?.failed && this.host.links?.win) this.go(this.host.links.win.href); }   // (nothing to back out to: won, it flies on)
    else if (this.phase === 'intro' || this.phase === 'results') this.quit();
  }
  /** The focused button of the card, or its first. */
  press() {
    const b = this.card.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON' ? document.activeElement : this.card.querySelector('button.main') ?? this.card.querySelector('button');
    b?.click();
  }
  /**
   * An option of the start card moved by `dir` (an engine's card: left / right on its row): a row of choices to the next
   * or the one before (round), a stepper by its step.
   */
  stepCardOption(id, dir) {
    const o = (this.def.options ?? []).find((q) => q.id === id);
    if (!o) return;
    const v = optionValue(this.def, this.host.state, id);
    if (o.choices) { const i = o.choices.findIndex(([cv]) => cv === v), n = o.choices.length; this.setOption(id, o.choices[((i < 0 ? 0 : i) + dir + n) % n][0]); }
    else this.setOption(id, stepOption(o, v, dir));
  }
  /** An option changed on the start card: kept in the save, the session started again with it, the card redrawn. */
  setOption(id, value) {
    const o = (this.def.options ?? []).find((q) => q.id === id);
    if (!o || this.phase !== 'intro' || !optionOffered(o, this.host.state)) return;
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
    else if (name === 'win' && this.host.links?.win) this.go(this.host.links.win.href);
    else if (name.startsWith('link:')) { const l = this.link(name.slice(5)); if (l) this.go(l.href); }
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
    else if (card && (e.code === 'BracketLeft' || e.code === 'BracketRight') && this.link(e.code === 'BracketLeft' ? -1 : 1)) { stop(); if (!e.repeat) this.go(this.link(e.code === 'BracketLeft' ? -1 : 1).href); }
    else if (['KeyL', 'KeyP', 'KeyQ', 'KeyJ'].includes(e.code) || (e.code === 'Tab' && (this.drives || card))) stop();   // (the worlds, photo mode, the scout, the sketchbook, lock-on: not in a game)
  }
  hint(yes, no) {
    const kind = inputKind();
    const cycle = this.link(1) || this.link(-1);   // (host.links with a step: the Arcade's game before / after)
    if (no === 'quit' && this.mandatory) no = null;   // (a game on the way somewhere: no way out but through it)
    if (kind === 'pad') return `${confirmKey()} ${yes}${no ? ` · ${backKey()} ${no}` : ''}${cycle ? ' · LB / RB other games' : ''}`;
    if (kind === 'touch') return '';
    return `Enter ${yes}${no ? ` · Esc ${no}` : ''}${this.phase === 'results' || this.paused ? ' · R retry' : ''}${cycle ? ' · [ ] other games' : ''}`;
  }

  // ---------------------------------------------------------------- the screens
  buildDom() {
    const el = this.el = document.createElement('div');
    el.id = 'minigame';
    if (this.def.hud?.multiline) el.classList.add('mg-guidance');
    el.innerHTML = `<canvas class="mg-speed"></canvas>
      <div class="mg-hud off"><div class="mg-lives"></div><div class="mg-box mg-timer"></div><div class="mg-box mg-score"></div></div>
      <button class="mg-pause" type="button" aria-label="Pause">❚❚</button>
      <div class="mg-count"></div><div class="mg-flash"></div>${this.def.hints ? '<div class="mg-hints off"></div>' : ''}
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
    this.hintsEl = el.querySelector('.mg-hints');
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
  closeCard() { this.card.classList.remove('open'); document.activeElement?.blur?.(); if (this.cardModel) { this.cardModel = null; this.cardV++; } }
  /**
   * The card up, as data (an engine's card: engine/menus.js, BridgeMenu.cs): { kind: intro | paused | results, kicker,
   * title, lead: { name, text }, text, rules, rows: [[key, what]], options: [{ id, label, choices: [{ label, on }] | text,
   * hint }], big, stamp, lines, extra (its html as plain lines), best, buttons: [{ act, label, sub, main }], hint }.
   */
  setCard(model) { this.cardModel = model; this.cardV++; }

  showIntro() {
    const d = this.def, S = this.host.state, best = bestScore(S, scoreDef(d, S)), kind = this.introKind = inputKind();
    // (a {key:verb}: the player's own key or button for the input in hand, src/prompt-keys.js; the rest as written)
    const keys = (x) => keyText(h(x), { kind, html: true, teach: true });
    const rows = controlsFor(d, kind).map(([k, v]) => `<dt>${keys(k)}</dt><dd>${keys(v)}</dd>`).join('');
    // the options (def.options): a row of choices each, or a stepper (− value +)
    const opts = (d.options ?? []).filter((o) => optionOffered(o, S)).map((o) => {
      const v = optionValue(d, S, o.id);
      const body = o.choices ? o.choices.map(([cv, label]) => `<button type="button" data-opt="${h(o.id)}" data-val="${h(cv)}" class="${cv === v ? 'on' : ''}">${h(label)}</button>`).join('')
        : `<button type="button" data-opt="${h(o.id)}" data-step="-1" aria-label="less">−</button><b>${h(optionText(o, v))}</b><button type="button" data-opt="${h(o.id)}" data-step="1" aria-label="more">+</button>`;
      return `<div class="opt"><span>${h(o.label)}</span>${body}${o.hint ? `<small>${h(o.hint)}</small>` : ''}</div>`;
    }).join('');
    // (a host's links.intro: a game on the way somewhere says where, and what is said as it begins: the pirates between worlds)
    const I = this.host.links?.intro;
    const lead = I?.lead ? `<p class="lead"><b>${h(I.lead.name ?? '')}</b> “${h(stripTone(I.lead))}”</p>` : '';
    const bestLine = best === null ? 'No best yet.' : `Best${d.bestBy ? ` (${this.optionLabel(d.bestBy)})` : ''}: ${formatScore(d, best)}`;
    const buttons = [{ act: 'start', label: 'Start', main: true }, ...this.outList()];
    const rules = [d.rules, prizeRule(rewardFor(d.id), S)].filter(Boolean).join(' ');   // (the prize, until won: issue #668)
    const plainKeys = (x) => keyText(x, { kind, teach: true });
    this.setCard({ kind: 'intro', kicker: I?.kicker ?? 'A game', title: d.name, lead: I?.lead ? { name: I.lead.name ?? '', text: stripTone(I.lead) } : null, text: d.blurb, rules,
      rows: controlsFor(d, kind).map(([k, v]) => [plainKeys(k), plainKeys(v)]),
      options: (d.options ?? []).filter((o) => optionOffered(o, S)).map((o) => {
        const v = optionValue(d, S, o.id);
        return { id: o.id, label: o.label, hint: o.hint ?? '', ...(o.choices ? { choices: o.choices.map(([cv, label]) => ({ label, on: cv === v })) } : { text: optionText(o, v) }) };
      }),
      best: bestLine, buttons: this.cardButtons(buttons), hint: this.hint('start', 'quit') });
    this.openCard(`<p class="kicker">${h(I?.kicker ?? 'A game')}</p><h1>${h(d.name)}</h1>${lead}<p>${h(d.blurb)}</p><p class="rules">${h(rules)}</p>
      ${rows ? `<dl>${rows}</dl>` : ''}${opts ? `<div class="opts">${opts}</div>` : ''}
      <p class="best">${h(bestLine)}</p>
      <div class="buttons">${this.buttonsHtml(buttons)}</div>`);
  }
  showResults() {
    const d = this.def, r = this.result;
    this.phase = 'results';
    this.hud.classList.add('off'); this.hudOn = false;
    // (a {key:verb} in a line: the player's own key or button, as the intro card's, issue #559)
    const kind = inputKind();
    const lines = (r.lines ?? []).map((l) => `<li>${keyText(h(l), { kind, html: true, teach: true })}</li>`).join('');
    const label = r.failed ? (r.title ?? 'Out of lives') : d.score?.kind === 'time' ? 'Your time' : 'Your score';
    const showValue = !(r.failed && d.score?.kind === 'time');
    const bestLine = r.best === null || r.best === undefined ? 'No best yet.' : `Best: ${formatScore(d, r.best)}`;
    const actions = resultActions(r, this.host.links, this.fails ?? 0);
    const hint = this.hint(actions[0].act === 'win' ? this.host.links.win.hint ?? 'fly on' : 'retry', !r.failed && this.host.links?.win ? null : 'quit');   // (won on the way somewhere: Esc flies on too)
    this.setCard({ kind: 'results', kicker: d.name, title: label, big: showValue ? formatScore(d, r.value) : '', stamp: !!r.isNew, lines: (r.lines ?? []).map((l) => keyText(l, { kind, teach: true })), extra: plainHtml(r.html),
      best: bestLine, buttons: this.cardButtons(actions.map((b) => ({ act: b.act, label: b.label, sub: b.sub ?? '', main: !!b.main }))), hint, wide: !!r.wide });
    this.openCard(`<p class="kicker">${h(d.name)}</p><h1>${h(label)}</h1>
      ${showValue ? `<div class="big">${h(formatScore(d, r.value))}</div>` : ''}${r.isNew ? '<div class="stamp">New best!</div>' : ''}
      ${lines ? `<ul class="lines">${lines}</ul>` : ''}${r.html ?? ''}
      <p class="best">${h(bestLine)}</p>
      <div class="buttons">${this.resultButtons(r)}</div>`);
    this.publish();
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
    const id = this.countState = { text, go, id: ++this.countN };
    if (go) this._countOff = setTimeout(() => { if (el.textContent === text) el.textContent = ''; if (this.countState === id) { this.countState = null; this.publish(); } }, COUNT.go * 1000 + 200);
    this.publish();
  }
  flash(text, kind = '', secs = 1.2) {
    const d = document.createElement('div');
    // (a {key:verb}: the player's own key or button, drawn as the cards draw them; the engines get it as words, issue #559)
    if (hasKeys(text)) { d.innerHTML = keyText(h(text), { html: true, teach: true }); text = keyText(text, { teach: true }); }
    else d.textContent = text;
    if (kind) d.className = kind;
    d.style.setProperty('--secs', `${secs}s`);
    this.flashEl.appendChild(d);
    while (this.flashEl.children.length > 3) this.flashEl.firstElementChild.remove();
    const f = { text: String(text), kind, secs, id: ++this.flashN };
    this.flashes.push(f);
    while (this.flashes.length > 3) this.flashes.shift();
    setTimeout(() => { d.remove(); const i = this.flashes.indexOf(f); if (i >= 0) { this.flashes.splice(i, 1); this.publish(); } }, secs * 1000 + 50);
    this.publish();
  }
  /**
   * The HUD as the screen's 'minigame' part (src/platform.js; an engine draws it: BridgeHud.cs): the clock as seconds
   * with whether it runs (the engine counts it on between sends, which are on a change and once a second), the score's
   * box, the lives, the 3-2-1 (each numeral its id), the flashes, the hint row, the speed lines' strength. Null once the
   * game is left.
   */
  publish(dt = 0) {
    if (this.ended) return;
    const d = this.def, H = d.hud ?? {};
    const run = this.phase === 'play' && !this.paused;
    let timer = null;
    if (H.timer ?? d.score?.kind === 'time') {
      // (running, the clock is sent once a second: the engine runs it on between, BridgeHud.cs)
      this._pubT = run && this._pubRun ? (this._pubT ?? 0) + dt : 1;
      if (this._pubT >= 1) { this._pubT = 0; this._pubSecs = +(this.clock + this.penalty).toFixed(2); }
      timer = { secs: this._pubSecs, run, down: H.countdown ?? 0, penalty: this.penalty };
    }
    this._pubRun = run;
    const s = this.statusText ?? ((H.score ?? d.score?.kind === 'points') ? formatScore(d, this.points) : '');
    let hints = null;
    if (d.hints) {
      // (paused, the row as it was: the page's stays under its card as last drawn, its loop held; issue #574)
      const kind = inputKind(), live = ['count', 'play'].includes(this.phase);
      const row = hintRow(controlsFor({ controls: d.hints }, kind), { age: this.hintAge, used: this.hintsUsed, live });
      hints = { off: !live || (row.off && !this.hintNote), items: row.items.map((i) => ({ k: keyText(i.k, { kind, teach: true }), w: i.w, gone: i.gone || row.off })), note: this.hintNote ? this.hintNoteText ?? plainHtml(this.hintNote) : '' };
    }
    // (under the pause the clock and the score stay up, as the page's HUD does under its .mg-card.clear; under a start or
    // results card they go)
    screen.set('minigame', { on: this.hudOn && (this.paused || !this.cardModel), timer, score: s, guidance: !!H.multiline, bump: this.scoreBumps ?? 0, lives: this.lives === null ? null : [this.lives, Math.max(this.livesMax ?? this.lives, this.lives)],
      count: this.countState, flashes: this.flashes, hints, speed: Math.round((this._speedK ?? 0) * 20) / 20, onFoot: !this.drives });   // (onFoot: the page's mg-onfoot, src/hud-shows.js)
  }
  bumpScore() { this.scoreBumps = (this.scoreBumps ?? 0) + 1; this.scoreEl.classList.remove('bump'); void this.scoreEl.offsetWidth; this.scoreEl.classList.add('bump'); }
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
    this._speedK = k;
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
