// The Updates page in the Unity players (the Unity-default plan's D13, issue #264): the game's script over the air
// (BridgeUpdates.cs) as the settings' update section shows it in the Android app and on the Deck's web runtime
// (src/update-panel.js), the same words from src/updates.js updateView: the build playing, Check for updates, what
// the newest build brings, Download and restart with its progress, Restart now. The player does the work
// (BridgeHost.UpdateInfo / UpdateCheck / UpdateDownload / UpdateRestart); this follows its state while the page is open
// and turns it into the menus' rows (engine/menus.js, its `updates`).
//
//   const updates = new UnityUpdates({ host, version: VERSION, save: () => game.save() });
//   updates.auto();          // the title's own check, once a launch (a newer build downloads by itself)
//   updates.rows(at); updates.act('download'); updates.tick();   // (engine/menus.js)

import { updateView, armedStep } from '../../src/updates.js';

/** The page's poll: close while something happens, now and then otherwise (src/update-panel.js schedule). */
export const POLL_BUSY_MS = 400, POLL_IDLE_MS = 4000;

export class UnityUpdates {
  /**
   * @param o.host     BridgeHost (engine/unity/host.js): UpdateInfo, UpdateCheck(auto), UpdateDownload, UpdateRestart
   * @param o.version  the game's version (src/version.js VERSION)
   * @param o.save     () the game saved before a restart (its position and time played)
   */
  constructor({ host, version = '', save = () => {}, now = () => Date.now() } = {}) {
    Object.assign(this, { host, version, save, now });
    this.info = null;
    this.armed = false;
    this.restarting = false;
    this.failed = '';
    this.polled = -Infinity;
    this.autoDone = false;
  }

  /** Whether this player has updates at all (a player from before them has no UpdateInfo). */
  get on() { return !!this.host?.UpdateInfo; }

  /** The player's state now (JSON from BridgeUpdates.Info), the last one kept when it doesn't answer. */
  read() {
    if (!this.on) return null;
    try { const info = JSON.parse(this.host.UpdateInfo()); if (info && typeof info === 'object') this.info = info; } catch { /* keep the last */ }
    this.polled = this.now();
    if (this.armed && this.info) {
      const step = armedStep(this.info);
      if (step === 'restart') this.restart();
      else if (step === 'stop') this.armed = false;
    }
    return this.info;
  }

  /** The title's own check, once a launch (BridgeUpdates: at most every 6 h, and it downloads a newer build itself). */
  auto() {
    if (this.autoDone || !this.on) return;
    this.autoDone = true;
    try { this.host.UpdateCheck(true); } catch (e) { console.warn(`[updates] the check: ${e?.message ?? e}`); }
  }

  view() { return updateView(this.info, { version: this.version, now: this.now(), armed: this.armed, restarting: this.restarting, failed: this.failed }); }

  /** Each frame while the page shows: true when it should be drawn again (the state moved). */
  tick() {
    const busy = this.view()?.busy || this.armed;
    if (this.now() - this.polled < (busy ? POLL_BUSY_MS : POLL_IDLE_MS)) return false;
    const was = JSON.stringify(this.info);
    this.read();
    return JSON.stringify(this.info) !== was;
  }

  /** A button: 'check', 'download' (and restart when it is in), 'restart'. */
  act(a) {
    this.failed = '';
    try {
      if (a === 'check') this.host.UpdateCheck(false);
      else if (a === 'download') { this.armed = true; this.host.UpdateDownload(); }
      else if (a === 'restart') { this.restart(); return; }
    } catch (e) {
      this.armed = false;
      this.failed = a === 'download' ? 'The download couldn\'t start' : 'The check couldn\'t start';
      console.warn(`[updates] ${a}: ${e?.message ?? e}`);
    }
    this.polled = -Infinity;
    this.read();
  }

  restart() {
    if (this.restarting) return;
    this.restarting = true;
    try { this.save(); } catch (e) { console.warn(`[updates] saving before the restart: ${e?.message ?? e}`); }
    try { this.host.UpdateRestart(); }
    catch (e) { this.restarting = false; this.armed = false; this.failed = 'The restart didn\'t work'; console.warn(`[updates] restart: ${e?.message ?? e}`); }
  }

  /**
   * The page's rows for the menus (engine/menus.js page rows: { text, val, slider, plain, head, wide, act }): what is
   * playing, the state and its progress, the buttons (the cursor's rows), then what the newest build brings.
   */
  rows() {
    if (!this.info) this.read();
    const v = this.view();
    if (!v) return [{ text: 'Updates aren\'t available in this player', plain: true, wide: true }];
    const rows = [{ text: 'Playing', val: v.running, plain: true }, { text: v.title, plain: true, wide: true, head: true }];
    if (v.progress !== null) rows.push({ text: v.progressText || '…', slider: v.progress, plain: false, bar: true });
    if (v.detail) rows.push({ text: v.detail, plain: true, wide: true });
    for (const b of v.actions) rows.push({ text: b.label, act: b.a, primary: !!b.primary });
    if (v.notes.length) {
      rows.push({ text: `WHAT'S NEW IN ${v.notesFor.toUpperCase()}`, plain: true, head: true });
      for (const n of v.notes) rows.push({ text: n, plain: true, wide: true });
      if (v.more) rows.push({ text: `… and ${v.more} more`, plain: true, wide: true });
    }
    return rows;
  }
}
