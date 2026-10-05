// The settings' update section, in the Android app only (the title's settings and the
// Start menu, src/ui.js SettingsMenu): the version and build running, "Check for updates",
// what the newest build brings (version, build, size, its first changelog lines),
// "Download and restart" with a progress bar, "Restart now", and the app download page
// when the newest game needs a new app. What it says comes from updateView()
// (src/updates.js); the app does the work (AppShellPlugin, WebBundles.java).
//
// Restarting reloads the page at the title screen, in the new build. The saves live in the
// page's storage, which every build shares (one origin, https://localhost); the game's
// position and time played are written first (onBeforeRestart).
// Buttons are plain <button>s in the panel, so the menus' controller navigation reaches them.

import { VERSION } from './changelog.js';
import { updateView, armedStep } from './updates.js';
import { callApp, inApp } from './native-app.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class UpdatePanel {
  /**
   * @param {HTMLElement} el the section to fill (stays hidden outside the app)
   * @param {{ win?: Window, onBeforeRestart?: () => void | Promise<void>, now?: () => number }} o
   */
  constructor(el, { win = window, onBeforeRestart, now = () => Date.now() } = {}) {
    this.el = el;
    this.win = win;
    this.onBeforeRestart = onBeforeRestart;
    this.now = now;
    this.info = null;
    this.armed = false;
    this.restarting = false;
    this.failed = '';
    this.showLog = false;
    this.isOpen = false;
    this.last = '';
    this.timer = 0;
    if (!el) return;
    el.hidden = true;
    if (!inApp(win)) return;
    el.addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-u]');
      if (!b || b.disabled) return;
      e.preventDefault();
      this.act(b.dataset.u);
    });
    win.addEventListener('moebius:webupdate', () => { if (this.isOpen) this.refresh(); });
  }

  /** The settings opened: read the app's state and follow it while open. */
  open() {
    if (!this.el || !inApp(this.win)) return;
    this.isOpen = true;
    this.failed = '';
    this.refresh();
  }

  /** The settings closed: stop following (and don't restart under the player's feet later). */
  close() {
    this.isOpen = false;
    this.armed = false;
    clearTimeout(this.timer);
  }

  async refresh() {
    let info = null;
    try { info = await callApp('info', this.win); } catch { /* the app didn't answer: keep the last */ }
    if (info) this.info = info;
    if (this.armed && this.info) {
      const step = armedStep(this.info);
      if (step === 'restart') { this.restart(); return; }
      if (step === 'stop') this.armed = false;
    }
    this.render();
    this.schedule();
  }

  // while something is happening, follow it closely; otherwise look now and then (a check in the background)
  schedule() {
    clearTimeout(this.timer);
    if (!this.isOpen || this.restarting) return;
    const busy = this.view?.busy || this.armed;
    this.timer = setTimeout(() => this.refresh(), busy ? 400 : 4000);
  }

  async act(a) {
    this.failed = '';
    if (a === 'log') { this.showLog = !this.showLog; this.render(true); return; }
    if (a === 'restart') { this.restart(); return; }
    try {
      if (a === 'check') this.info = await callApp('check', this.win);
      else if (a === 'download') { this.armed = true; this.info = await callApp('download', this.win); }
      else if (a === 'apk') await callApp('openApk', this.win);
    } catch (e) {
      this.armed = false;
      this.failed = a === 'download' ? 'The download couldn\'t start' : a === 'apk' ? 'The download page couldn\'t open' : 'The check couldn\'t start';
      console.warn('update', a, e);
    }
    await this.refresh();
  }

  async restart() {
    if (this.restarting) return;
    this.restarting = true;
    this.render();
    try { await this.onBeforeRestart?.(); } catch (e) { console.warn('update: saving before the restart', e); }
    try {
      await callApp('restart', this.win);   // (the page reloads at the title, in the new build)
    } catch (e) {
      this.restarting = false;
      this.armed = false;
      this.failed = 'The restart didn\'t work';
      console.warn('update: restart', e);
      this.refresh();
    }
  }

  render(force = false) {
    const el = this.el;
    if (!el) return;
    const v = updateView(this.info, { version: VERSION, now: this.now(), armed: this.armed, restarting: this.restarting, failed: this.failed });
    this.view = v;
    el.hidden = !v;
    if (!v) return;
    const log = this.showLog ? String(this.info?.log ?? '') : '';
    const key = JSON.stringify([v, log, this.showLog]);
    if (!force && key === this.last) return;
    this.last = key;
    const doc = el.ownerDocument;
    const focused = el.contains(doc.activeElement) ? doc.activeElement.dataset?.u : null;
    el.dataset.state = v.state;
    el.innerHTML = `
      <h2>UPDATES</h2>
      <p class="up-running">Playing ${esc(v.running)}</p>
      <p class="up-title">${esc(v.title)}</p>
      ${v.progress !== null ? `<div class="up-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v.progress * 100)}"><i style="width:${(v.progress * 100).toFixed(1)}%"></i></div>
      <p class="up-pct">${esc(v.progressText)}</p>` : ''}
      ${v.detail ? `<p class="up-detail">${esc(v.detail)}</p>` : ''}
      ${v.notes.length ? `<ul class="up-notes">${v.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      ${v.more ? `<p class="up-more">and ${v.more} more in What's new, after the update</p>` : ''}` : ''}
      <div class="up-actions">
        ${v.actions.map((b) => `<button type="button" data-u="${b.a}"${b.primary ? ' class="primary"' : ''}>${esc(b.label)}</button>`).join('')}
        ${v.legacy ? '' : `<button type="button" data-u="log" class="quiet">${this.showLog ? 'Hide details' : 'Details'}</button>`}
      </div>
      ${this.showLog ? `<pre class="up-log">${esc(log || 'Nothing logged yet.')}</pre>` : ''}`;
    // keep the controller's place: the same button, or the section's first one
    if (focused) {
      const again = el.querySelector(`[data-u="${focused}"]`) ?? el.querySelector('.up-actions button');
      again?.focus({ preventScroll: true });
    }
  }
}
