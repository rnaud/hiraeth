import { createAnalytics } from './controller.js';
import { observeGameplay, progression, loading } from './events.js';
import { progressSnapshot, STORY_FLAGS } from './progress.js';

/** A page/world's listeners; collection starts only once actual play begins. */
export function trackSession({ game, settings, allowed, loadTransport, world, now = () => performance.now() }) {
  const analytics = createAnalytics(loadTransport, { allowed });
  const started = now();
  let ready = false, playing = false, disposed = false, loadMs = 0, lastSnapshot = '';
  const snapshot = () => {
    if (!playing || disposed || !settings.analytics) return;
    const event = progressSnapshot(game, world), key = JSON.stringify(event);
    if (event && key !== lastSnapshot) { lastSnapshot = key; analytics.send(event); }
  };
  const stop = observeGameplay(game, e => { if (playing) analytics.send(e); });
  const stopProgress = game.on('flag', ({ name }) => {
    if (STORY_FLAGS.includes(name) || /^world\.[a-z0-9_-]+\.done$/.test(name)) snapshot();
  });
  const preference = k => {
    if (disposed || (k !== null && k !== 'analytics')) return;
    analytics.setEnabled(playing && settings.analytics);
    lastSnapshot = ''; snapshot();
  };
  settings.on(preference);
  return {
    ready() {
      if (ready || disposed) return;
      ready = true; loadMs = now() - started;
      if (playing && world) analytics.send(loading(world, loadMs));
    },
    play() {
      if (playing || disposed) return;
      playing = true; preference(null);
      if (world) {
        analytics.send(progression('Start', 'World', world));
        if (ready) analytics.send(loading(world, loadMs));
      }
    },
    dispose() { disposed = true; stop(); stopProgress(); analytics.dispose(); },
  };
}
