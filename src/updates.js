// The game's updates in the Android app, as the settings show them (src/update-panel.js).
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
export const isNewerBuild = (build, info) => (build || 0) > Math.max(info?.web || 0, info?.app || 0, info?.ready || 0);

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
 *   actions: [{ a: 'check' | 'download' | 'restart' | 'apk', label, primary }]
 */
export function updateView(info, { version = '', now = Date.now(), armed = false, restarting = false, failed = '', maxNotes = 4 } = {}) {
  if (!info?.web) return null;
  const legacy = !(info.native >= SETTINGS_NATIVE);
  const running = `${vb(version, info.web)}${info.bundle ? '' : ' (built in)'} · app ${info.app}`;
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
      v.detail = armed ? 'The game restarts when it is done. Your saves are kept.' : 'You can keep playing: it starts the next time you open the title screen.';
      v.busy = true;
      showNotes();
      break;
    }
    case 'ready':
      v.title = `${vb(info.readyVersion || info.latestVersion, info.ready || info.latest)} is downloaded`;
      v.detail = armed ? 'Restarting…' : 'Restart to play it now, or it starts the next time you open the title screen. Your saves are kept.';
      showNotes();
      v.actions.push({ a: 'restart', label: 'Restart now', primary: true });
      break;
    case 'apk':
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
      v.detail = 'A debug build keeps the game it was built with.';
      break;
    default:
      v.title = 'Not checked yet';
      v.actions.push(check());
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
