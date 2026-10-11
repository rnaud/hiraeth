// What's new's Refresh (changelog.html, issue #114): the newest changes, now.
//
// On the site the page is the newest game's own: reloading it fetches the newest changelog (the frame over
// the game reloads itself only, the game keeps running). In the Android app, the Xbox app or on the Steam
// Deck the page is the game's bundle on the device, so reloading would show the same lines: Refresh asks
// the app for the newest web bundle (web.json, over the air, as the settings' Updates do: src/update-panel.js),
// downloads it and restarts into it (the game saved first); when there is nothing newer it says so.
// Apps too old to check from the page (before NATIVE_API 4) reload, as on the site.
//
// Pure apart from what it is given (tests/changelog-refresh.test.js).

import { updateView, SETTINGS_NATIVE } from './updates.js';

/**
 * @param o.app      the app's calls (native-app.js callApp bound to the game's window), or null on the site
 * @param o.reload   reload the page
 * @param o.say      (text, busy) the line beside the button
 * @param o.beforeRestart save the game before the restart (the game under the frame; nothing on the title)
 * @param o.version  the game's version (for updateView)
 * @param o.sleep    (ms) => Promise
 * @param o.timeout  how long to follow a check or a download before giving up (ms)
 * @returns {Promise<'reload' | 'restart' | 'current' | 'apk' | 'offline' | 'error' | 'off' | 'timeout'>}
 */
export async function refreshChangelog({ app = null, reload, say = () => {}, beforeRestart, version = '', sleep = (ms) => new Promise((r) => setTimeout(r, ms)), timeout = 5 * 60e3, now = () => Date.now() } = {}) {
  const fresh = () => { say('Loading the newest changes…', true); reload(); return 'reload'; };
  if (!app) return fresh();
  let info = null;
  try { info = await app('info'); } catch { /* no answer: as on the site */ }
  if (!info?.web || (info.platform !== 'deck' && info.platform !== 'xbox' && !(info.native >= SETTINGS_NATIVE))) return fresh();
  const title = (i) => updateView(i, { version })?.title ?? '';
  const until = now() + timeout;
  const follow = async (busy) => {
    while (busy.includes(info?.check) && now() < until) {
      say(title(info), true);
      await sleep(400);
      try { info = await app('info'); } catch { break; }
    }
  };
  try {
    say('Checking for updates…', true);
    info = (await app('check')) ?? info;
    await follow(['checking']);
    if (info?.check === 'available') {
      info = (await app('download')) ?? info;
      await follow(['available', 'checking', 'downloading']);
    }
  } catch {
    say('The check couldn\'t start. Try again in a moment.', false);
    return 'error';
  }
  const state = info?.check;
  if (state === 'ready' && info.ready) {
    say(title(info).replace(/ is downloaded$/, ' is here: restarting…'), true);
    try { await beforeRestart?.(); } catch (e) { console.warn('refresh: saving before the restart', e); }
    try { await app('restart'); return 'restart'; } catch { say('The restart didn\'t work. Try again.', false); return 'error'; }
  }
  if (['checking', 'downloading', 'available'].includes(state)) { say('That is taking long: it goes on in the background.', false); return 'timeout'; }
  if (state === 'current') { say('You have the newest game.', false); return 'current'; }
  if (state === 'apk') { say(`${title(info)}: see Settings, Updates.`, false); return 'apk'; }
  say(title(info) || 'The update didn\'t come through.', false);
  return ['offline', 'off'].includes(state) ? state : 'error';
}
