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

import { updateView, armedStep, UNITY_APK } from '../../src/updates.js';

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
    this.playerArmed = false;
  }

  /** Whether this player has updates at all (a player from before them has no UpdateInfo). */
  get on() { return !!this.host?.UpdateInfo; }

  /** The player's state now (JSON from BridgeUpdates.Info), the last one kept when it doesn't answer. */
  read() {
    if (!this.on) return null;
    try { const info = JSON.parse(this.host.UpdateInfo()); if (info && typeof info === 'object') this.info = info; } catch { /* keep the last */ }
    if (this.info) {
      // (which player this is, and whether it can open a link: the Android player's "Get the new player", issue #715)
      try { this.info.os = String(this.host.Platform?.() ?? ''); } catch { this.info.os = ''; }
      this.info.openUrl = !!this.host.OpenUrl;
    }
    // Optional host methods: compatible script updates must still work on API 3.
    if (this.info && this.info.native >= 4 && this.host?.PlayerUpdateInfo) {
      try { this.info.player = JSON.parse(this.host.PlayerUpdateInfo()); } catch { /* no usable capability */ }
    }
    if (this.playerArmed && this.info?.player) {
      const state = this.info.player.state;
      if (state === 'ready') { this.playerArmed = false; this.restartPlayer(); }
      else if (['error', 'offline', 'current', 'busy'].includes(state)) this.playerArmed = false;
    }
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

  /** A button: 'check', 'download' (and restart when it is in), 'restart', the player's ('player-check' … 'player-apk'). */
  act(a) {
    // Ignore stale button/controller events while the native operation is pending.
    if (a.startsWith('player-') && !this.view()?.actions.some(b => b.a === a)) return;
    this.failed = '';
    try {
      if (a === 'player-check') this.host.PlayerUpdateCheck();
      else if (a === 'player-download') { this.playerArmed = true; this.host.PlayerUpdateDownload(); }
      else if (a === 'player-restart') { this.restartPlayer(); return; }
      else if (a === 'player-apk') { this.host.OpenUrl(this.apkUrl()); return; }   // (the browser downloads it; nothing to poll)
      else if (a === 'check') { this.host.UpdateCheck(false); if (this.info?.player?.supported) this.host.PlayerUpdateCheck(); }
      else if (a === 'download') { this.armed = true; this.host.UpdateDownload(); }
      else if (a === 'restart') { this.restart(); return; }
    } catch (e) {
      this.armed = false; this.playerArmed = false;
      this.failed = a === 'download' ? 'The download couldn\'t start' : a === 'player-apk' ? 'The download couldn\'t open' : 'The check couldn\'t start';
      console.warn(`[updates] ${a}: ${e?.message ?? e}`);
    }
    this.polled = -Infinity;
    this.read();
  }

  /** The new Android player: the feed's (unity.json `apk`, BridgeUpdates.Info) when it names one on the testers' release, else the testers' APK. */
  apkUrl() {
    const url = String(this.info?.apk ?? '');
    return url.startsWith('https://github.com/rnaud/hiraeth/releases/') ? url : UNITY_APK;
  }

  restartPlayer() {
    if (this.restarting || !this.info?.player?.supported) return;
    try {
      // A failed save must not close the player. Native flush + revalidation precede exit 76.
      this.save();
      this.host.PlayerUpdateRestart();
      this.info.player = { ...this.info.player, state: 'checking' };
    } catch (e) { this.playerArmed = false; this.failed = `The player restart couldn't start: ${e?.message ?? e}`; }
    this.polled = -Infinity;
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
