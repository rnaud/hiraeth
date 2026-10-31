// The game's updates in the Android app and on the Steam Deck, as the settings show them (src/update-panel.js), and
// the Unity players' script over the air (platform 'unity': BridgeUpdates.cs, engine/unity/updates.js).
// Pure: what the app reports (AppShell.info, android/.../WebBundles.java fill()) in, what
// to say and which buttons to offer out. The states are the app's (UpdateRules.java):
//
//   idle ─ check ─▶ checking ─┬▶ current       (this is the newest game)
//                             ├▶ available     (found from the settings: "Download and restart")
//                             ├▶ downloading ─┬▶ ready (restart to play it)
//                             │               └▶ offline / error (try again)
//                             ├▶ apk           (the newest game needs a new app: its download page)
//                             └▶ offline / error
//   off: a debug build (no updates over the air)
//
// Apps from before NATIVE_API 4 can't check or download from the settings; for them the
// view keeps the old status line (and "Restart now" when a download is ready).
// Imports nothing that loads the game state (the title screen uses it).

/** The native level from which the settings can check, download and open the APK page. */
export const SETTINGS_NATIVE = 4;
/** The Unity testers' APK for Android (.github/workflows/unity-android.yml; unity.json's `apk` names it too) and its page. */
export const UNITY_APK = 'https://github.com/rnaud/hiraeth/releases/download/unity-android/hiraeth-unity.apk';
export const UNITY_APK_PAGE = 'github.com/rnaud/hiraeth/releases/tag/unity-android';

export const STATES = ['idle', 'checking', 'current', 'available', 'downloading', 'ready', 'apk', 'offline', 'error', 'off'];

/** Compare two versions by their numbers ('0.9' < '0.10' < '0.55' < '1.0'): < 0, 0 or > 0. */
export function compareVersions(a, b) {
  const pa = String(a ?? '').split('.').map((n) => parseInt(n, 10) || 0), pb = String(b ?? '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Whether `build` (release-info.mjs gameBuild: the commit's number) is newer than every build on the device. */
export const isNewerBuild = (build, info) => (build || 0) > Math.max(info?.web || 0, info?.platform === 'deck' ? 0 : info?.app || 0, info?.ready || 0);
// (on the Steam Deck `app` is the runtime's build, on its own scale: platform 'deck', desktop/deck-updates.mjs)

// ---------------------------------------------------------------- a newer installer (issue #805)
// The players and the app ask for a new installer not only when the game needs one (minUnity, NATIVE_API) but whenever a
// newer one is published: a Unity player whose own build is older than the newest player of its platform (unity.json's
// `players`, from each prerelease's player.json: scripts/web-update.mjs newestPlayers), the Android app whose versionCode
// is older than latest.json's `code`. Never in the way: a new version is offered at launch (the Unity title's card, the
// app's dialog), dismissed until the next build; a newer build of the same version only in Updates.

/** Where every newest player is downloaded from (its prerelease's file: release-metadata.mjs playerUrl). */
export const PLAYER_DOWNLOADS = 'https://github.com/rnaud/hiraeth/releases/download/';
/** The platforms a player reads its newest build for (BridgeHost.Platform; -player-platform in a test). */
const PLAYER_OF = { android: 'android', linux: 'linux', xbox: 'xbox' };
/** The store's key of the build "Not now" was said to (engine/unity/updates.js). */
export const OFFER_DISMISSED_KEY = 'hiraeth.playerOffer.dismissed';

/**
 * The decision: does this Unity player offer a newer player? (BridgeUpdates.Info: `app` its own build, `players`,
 * `playerPlatform` or `os`, `apkInstall` whether it can download and install an APK itself, `openUrl`.)
 * @param o.dismissed the build "Not now" was said to: still offered in Updates, no longer on the title
 * @returns null (none: no entry for this platform, the same or an older build, no file to point at) or
 *   { platform, build, version, size, url, sha256, how: 'install' | 'open' | 'notice', dismissed, card }
 *   card: a new version (the changelog's vX.Y) against the player's own (`appVersion`), shown on the title; a newer
 *   build of the same version (a testers' build comes often) is offered on the Updates page only
 *   install: the Android player downloads it and opens Android's installer; open: its browser downloads it (a player
 *   with OpenUrl only); notice: the Deck's launcher or the Xbox's portal brings it, the offer only says so.
 */
export function playerOffer(info, { dismissed = 0 } = {}) {
  if (info?.platform !== 'unity') return null;
  const platform = PLAYER_OF[info.playerPlatform || info.os];
  const p = platform ? info.players?.[platform] : null;
  if (!p || !Number.isSafeInteger(p.build) || p.build <= 0 || p.build <= (info.app || 0)) return null;
  // (a record without its file is never offered: the deploy only writes those it found, this checks again)
  if (typeof p.url !== 'string' || !p.url.startsWith(PLAYER_DOWNLOADS) || !(p.size > 0) || !/^[0-9a-f]{64}$/i.test(p.sha256 ?? '')) return null;
  const how = platform !== 'android' ? 'notice' : info.apkInstall ? 'install' : info.openUrl ? 'open' : 'notice';
  const version = String(p.version ?? ''), card = !version || !info.appVersion || version !== String(info.appVersion);
  return { platform, build: p.build, version, size: p.size, url: p.url, sha256: p.sha256, how, dismissed: +dismissed === p.build, card };
}

/**
 * What the offer says and offers (the Updates page's rows and the title's card: engine/unity/updates.js), from the
 * offer and the Android player's own download (BridgeApk.Info: { state: idle | downloading | verifying | installing |
 * permission | error, got, total, error }).
 * @returns { title, card, detail, progress, progressText, actions: [{ a, label, primary }], busy }
 */
export function playerOfferView(offer, apk = null) {
  if (!offer) return null;
  const name = vb(offer.version, offer.build), size = formatBytes(offer.size);
  const v = { title: `A newer player is available: ${name}`, card: { title: 'A newer player is available', sub: name }, detail: '', progress: null, progressText: '', actions: [], busy: false };
  const notNow = () => (offer.dismissed ? [] : [{ a: 'offer-dismiss', label: 'Not now' }]);
  if (offer.how === 'install') {
    const s = apk?.state ?? 'idle';
    if (s === 'downloading' || s === 'verifying') {
      const total = apk.total || offer.size || 0, got = Math.min(apk.got || 0, total || Infinity);
      v.title = s === 'verifying' ? 'Checking the new player…' : `Downloading the new player, ${name}…`;
      v.progress = total ? got / total : 0;
      v.progressText = total ? `${Math.floor(v.progress * 100)}% · ${formatBytes(got) || '0 KB'} of ${formatBytes(total)}` : formatBytes(got);
      v.detail = 'You can keep playing. Android asks you to install it once it is here.';
      v.busy = true;
      v.card.sub = `${name} · downloading ${Math.floor(v.progress * 100)}%`;
    } else if (s === 'permission') {
      v.detail = 'Allow Hiraeth (Unity) to install apps in the screen that opened, then choose Install. Your saves are kept.';
      v.actions.push({ a: 'offer-install', label: 'Install', primary: true }, ...notNow());
    } else if (s === 'installing') {
      v.detail = 'Android\'s installer is open: choose Install there. It installs over this one and keeps your saves.';
      v.actions.push({ a: 'offer-install', label: 'Open the installer again', primary: true });
    } else {
      v.detail = `${s === 'error' && apk?.error ? `${apk.error}. ` : ''}Download it${size ? ` (${size})` : ''} and Android installs it over this one. Your saves are kept.`;
      v.actions.push({ a: 'offer-install', label: s === 'error' ? 'Try the download again' : 'Download and install', primary: true }, ...notNow());
    }
    v.card.how = 'Open Updates to install it';
    return v;
  }
  if (offer.how === 'open') {
    v.detail = 'Get the new player, then open the download to install it over this one. Your saves are kept.';
    v.actions.push({ a: 'offer-open', label: 'Get the new player', primary: true }, ...notNow());
    v.card.how = 'Open Updates to get it';
    return v;
  }
  v.detail = offer.platform === 'linux'
    ? 'On the Steam Deck its launcher brings the new player: quit Hiraeth and launch it again, and it downloads it in the background. Your saves are kept.'
    : offer.platform === 'xbox'
      ? 'On the Xbox the new player is installed through the Device Portal, over this one, the way this one was. Your saves are kept.'
      : `Download it from ${UNITY_APK_PAGE} and install it over this one. Your saves are kept.`;
  v.card.how = offer.platform === 'linux' ? 'Relaunch to update' : offer.platform === 'xbox' ? 'Install it through the Device Portal' : 'See Updates';
  v.actions.push(...notNow());
  return v;
}

/** The NATIVE_API from which the Android app downloads and installs its newer APK itself (AppShell installApk). */
export const APP_INSTALL_NATIVE = 10;

/**
 * The decision for the Android app (GeckoView or its WebView): latest.json's build (`apkBuild`, WebBundles.apkOffered)
 * newer than the app's own versionCode (`app`). Not when the newest game already needs the new app (state 'apk': its
 * own words), not on the Deck, the Xbox or a Unity player (their `platform`).
 * @returns null or { build, version, how: 'install' | 'page', state, progress, progressText, line, action }
 */
export function appOffer(info) {
  if (!info || info.platform || info.check === 'apk') return null;
  const build = +info.apkBuild || 0;
  if (!(build > (info.app || 0))) return null;
  const name = vb(info.apkVersion, build), how = info.native >= APP_INSTALL_NATIVE ? 'install' : 'page';
  const s = how === 'install' ? info.apkState || 'idle' : 'idle';
  const o = { build, version: info.apkVersion || '', how, state: s, progress: null, progressText: '', line: '', action: null };
  if (s === 'downloading') {
    const total = info.apkTotal || 0, got = Math.min(info.apkGot || 0, total || Infinity);
    o.progress = total ? got / total : 0;
    o.progressText = total ? `${Math.floor(o.progress * 100)}% · ${formatBytes(got) || '0 KB'} of ${formatBytes(total)}` : formatBytes(got);
    o.line = `Downloading the new app, ${name}…`;
  } else if (s === 'permission') {
    o.line = `A new app is available: ${name}. Allow Hiraeth to install apps in the screen that opened, then choose Install.`;
    o.action = { a: 'app-install', label: 'Install the new app' };
  } else if (s === 'installing') {
    o.line = `The new app, ${name}, is downloaded: choose Install in Android's installer. Your saves are kept.`;
    o.action = { a: 'app-install', label: 'Open the installer again' };
  } else {
    o.line = `A new app is available: ${name}.${s === 'error' && info.apkError ? ` ${info.apkError}.` : ''} It installs over this one and keeps your saves.`;
    o.action = how === 'install' ? { a: 'app-install', label: s === 'error' ? 'Try the new app again' : 'Install the new app' } : { a: 'apk', label: 'Get the new app' };
  }
  return o;
}

/** 4.6 MB, 820 KB. */
export function formatBytes(n) {
  if (!(n > 0)) return '';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export function formatAgo(t, now = Date.now()) {
  if (!(t > 0)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

const vb = (version, build) => [version && `v${version}`, build && `build ${build}`].filter(Boolean).join(' · ');

/**
 * What the update section of the settings shows.
 * @param info AppShell.info (null: not in the app)
 * @param o.version the game's own version (changelog.js VERSION)
 * @param o.armed the player asked for "Download and restart": restart once it is ready
 * @param o.restarting the restart was asked for
 * @param o.failed a button's call failed (its message)
 * @returns {{ state, running, title, detail, notes, notesFor, more, progress, progressText, actions, busy, legacy }}
 *   actions: [{ a: 'check' | 'download' | 'restart' | 'apk' | 'app-install' (a newer app: appOffer) | 'player-apk' | 'player-…', label, primary }]
 *   (a Unity player's info also has `os`, BridgeHost.Platform, and `openUrl`, whether it can open a link: engine/unity/updates.js)
 */
export function updateView(info, { version = '', now = Date.now(), armed = false, restarting = false, failed = '', maxNotes = 4 } = {}) {
  if (!info?.web) return null;
  const deck = info.platform === 'deck';   // (the Steam Deck's runtime: every one has the buttons)
  const unity = info.platform === 'unity';   // (a Unity player: its script over the air, BridgeUpdates.cs; `app` the player's own build)
  const legacy = !deck && !unity && info.platform !== 'xbox' && !(info.native >= SETTINGS_NATIVE);   // (the Xbox app's too: its own levels, xbox/)
  const running = `${vb(version, info.web)}${info.bundle ? '' : ' (built in)'} · ${deck ? 'runtime' : unity ? 'player' : 'app'} ${info.app}`;
  // (when a download not played yet starts: the web's at the next title screen, a Unity player's at its next start)
  const later = unity ? 'the game starts' : 'you open the title screen';
  const state = STATES.includes(info.check) ? info.check : 'idle';
  const latest = vb(info.latestVersion, info.latest);
  const size = formatBytes(info.size || info.total);
  const notes = Array.isArray(info.notes) ? info.notes.map(String).filter(Boolean) : [];
  const v = { state, running, title: '', detail: '', notes: [], notesFor: '', more: 0, progress: null, progressText: '', actions: [], busy: false, legacy };
  const showNotes = () => {
    v.notes = notes.slice(0, maxNotes);
    v.more = Math.max(0, notes.length - maxNotes);
    const nv = state === 'ready' ? info.readyVersion || info.latestVersion : info.latestVersion;
    v.notesFor = nv ? `v${nv}` : 'the update';
  };
  const check = (label = 'Check for updates') => ({ a: 'check', label });
  const checked = info.checkedAt ? `Checked ${formatAgo(info.checkedAt, now)}.` : '';
  // the APK feed (GitHub) out of reach: a quiet note, never an update error (apps from NATIVE_API 5 report it)
  const noApkCheck = info.apkCheck === 'failed' ? 'Couldn\'t check for a new app.' : '';

  if (restarting) {
    return { ...v, state: 'restarting', title: 'Restarting with the update…', detail: 'Your saves are kept.', busy: true };
  }
  if (legacy) {
    // (an app from before NATIVE_API 4: no check or download from here)
    v.title = info.ready ? `${vb(info.readyVersion, info.ready)} is downloaded` : 'The app looks for updates when it starts';
    v.detail = info.ready ? 'Restart to play it. Your saves are kept.' : 'Install the newest app to check for updates from here.';
    if (info.ready) v.actions.push({ a: 'restart', label: 'Restart now', primary: true });
    return v;
  }
  switch (state) {
    case 'checking':
      Object.assign(v, { title: 'Checking for updates…', busy: true });
      break;
    case 'current':
      v.title = 'You have the newest game';
      v.detail = [checked, info.error, noApkCheck].filter(Boolean).join(' ');
      v.actions.push(check());
      break;
    case 'available':
      v.title = `${latest} is available${size ? ` (${size})` : ''}`;
      v.detail = 'It downloads, then the game restarts at the title screen. Your saves are kept.';
      showNotes();
      v.actions.push({ a: 'download', label: 'Download and restart', primary: true }, check('Check again'));
      break;
    case 'downloading': {
      const total = info.total || info.size || 0, got = Math.min(info.got || 0, total || Infinity);
      v.title = `Downloading ${latest}…`;
      v.progress = total ? got / total : 0;
      v.progressText = total ? `${Math.floor(v.progress * 100)}% · ${formatBytes(got) || '0 KB'} of ${formatBytes(total)}` : formatBytes(got);
      v.detail = armed ? 'The game restarts when it is done. Your saves are kept.' : `You can keep playing: it starts the next time ${later}.`;
      v.busy = true;
      showNotes();
      break;
    }
    case 'ready':
      v.title = `${vb(info.readyVersion || info.latestVersion, info.ready || info.latest)} is downloaded`;
      v.detail = armed ? 'Restarting…' : `Restart to play it now, or it starts the next time ${later}. Your saves are kept.`;
      showNotes();
      v.actions.push({ a: 'restart', label: 'Restart now', primary: true });
      break;
    case 'apk':
      if (unity) {
        // (the script needs a newer player, minUnity: the player's own update brings it, the Deck's in the background)
        v.title = `${vb(info.latestVersion, info.latest) || 'The newest game'} needs a newer version of the player`;
        if (info.os === 'android') {
          // (the Android player can't replace itself: the testers' APK, its download opened in the browser (BridgeHost.OpenUrl),
          // installed over this one; the same release key signs every one, so the saves stay, issue #715)
          v.detail = info.openUrl
            ? 'Its engine changed, so it can\'t come over the air. Get the new player, then open the download to install it over this one. Your saves are kept.'
            : `Its engine changed, so it can't come over the air. Download the new player from ${UNITY_APK_PAGE} and install it over this one. Your saves are kept.`;
          showNotes();
          if (info.openUrl) v.actions.push({ a: 'player-apk', label: 'Get the new player', primary: true });
          v.actions.push(check('Check again'));
          break;
        }
        v.detail = 'Its engine changed, so it can\'t come over the air: it comes with the player\'s next update. You can keep playing this version.';
        showNotes();
        v.actions.push(check('Check again'));
        break;
      }
      v.title = `${vb(info.apkVersion || info.latestVersion, info.latest) || 'The newest game'} needs a new version of the app`;
      v.detail = ['Its native part changed, so it can\'t come over the air. Install the new app over this one: your saves are kept.', noApkCheck].filter(Boolean).join(' ');
      showNotes();
      v.actions.push({ a: 'apk', label: 'Get the new app', primary: true }, check('Check again'));
      break;
    case 'offline':
      v.title = 'You\'re offline';
      v.detail = 'Connect to the internet and check again. You can keep playing this version.';
      v.actions.push(check('Check again'));
      break;
    case 'error':
      v.title = 'The update didn\'t come through';
      v.detail = `${info.error ? `${info.error}. ` : ''}Try again in a moment.`;
      // (a download that failed can go on from where it stopped)
      v.actions.push(info.latest && isNewerBuild(info.latest, info) && info.latestMin <= info.native
        ? { a: 'download', label: 'Try the download again', primary: true } : check('Try again'));
      break;
    case 'off':
      v.title = 'Updates are off in this build';
      v.detail = unity ? 'A local build keeps the game it was built with.' : 'A debug build keeps the game it was built with.';
      break;
    default:
      v.title = 'Not checked yet';
      v.actions.push(check());
  }
  if (unity) {
    const p = info.player;
    if (p?.supported) {
      const action = (a, label) => ({ a, label, primary: true });
      if (p.state === 'checking' || p.state === 'downloading') {
        v.title = p.state === 'checking' ? 'Checking the player update…' : p.step === 'verifying' ? 'Verifying the player…' : p.step === 'unpacking' ? 'Preparing the player…' : 'Downloading the player…';
        v.detail = 'The launcher verifies it before restarting. Your saves and previous player are kept.';
        v.busy = true; v.actions = [];
        if (p.state === 'downloading') {
          v.progress = p.total > 0 ? Math.min(1, (p.got || 0) / p.total) : 0;
          v.progressText = p.total > 0 ? `${Math.floor(v.progress * 100)}% · ${formatBytes(p.got) || '0 KB'} of ${formatBytes(p.total)}` : 'Preparing or verifying the download…';
        }
      } else if (p.state === 'ready') {
        v.title = 'The verified player update is ready';
        v.detail = 'Restart to use it. Your saves and the previous working player are kept.';
        v.actions = [action('player-restart', 'Restart with updated player')];
      } else if (p.state === 'available') {
        v.actions.unshift(action('player-download', 'Update player and restart'));
        v.detail = `A new player is available${p.size ? ` (${formatBytes(p.size)})` : ''}. It is checked before restarting. Your saves are kept.`;
      } else if (['error', 'offline', 'busy', 'current'].includes(p.state)) {
        v.detail = p.detail || (p.state === 'offline' ? 'The player update is offline. Keep playing and try again later.' : 'The player update is not ready.');
        v.actions = [action('player-check', 'Check player again'), ...v.actions.filter(a => a.a !== 'check')];
      } else v.actions.push(action('player-check', 'Check player update'));
    } else if (state === 'apk' && info.os !== 'android') {
      // (the player's own words when it has them (BridgePlayerUpdates' guidance), else the platform's)
      v.detail = p?.guidance || (info.os === 'xbox'
        ? 'This player cannot update itself on the Xbox. Install the new Xbox package over this one, the way this one was installed. Your saves are kept.'
        : 'This player cannot update itself here. On Steam Deck, quit and relaunch Hiraeth so its launcher can fetch the new player; then launch again after the download. Other installs need their original installer. Your saves are kept.');
    }
  }
  // (the Android app: a newer APK than this one, whatever the game needs: latest.json's build, issue #805)
  const app = appOffer(info);
  if (app) {
    v.app = app;
    v.detail = [v.detail, app.line].filter(Boolean).join(' ');
    if (app.progress !== null && v.progress === null) Object.assign(v, { progress: app.progress, progressText: app.progressText, busy: true });
    if (app.action) v.actions.push(app.action);
  }
  if (failed) v.detail = `${failed}. ${v.detail}`.trim();
  return v;
}

/**
 * The next step of "Download and restart" once the player asked for it (armed): restart
 * when the download is ready, stop waiting when it failed. @returns 'restart' | 'wait' | 'stop'
 */
export function armedStep(info) {
  const s = info?.check;
  if (s === 'ready' && info.ready) return 'restart';
  if (s === 'downloading' || s === 'checking' || s === 'available') return 'wait';
  return 'stop';
}
