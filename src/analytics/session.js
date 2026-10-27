import { createAnalytics } from './controller.js';
import { observeGameplay, progression, loading } from './events.js';

/** A page/world's listeners; platform-specific code supplies a transport, never the gameplay modules. */
export function trackSession({ game, settings, allowed, loadTransport, world, now = () => performance.now() }) {
  const analytics = createAnalytics(loadTransport, { allowed });
  const started = now();
  const stop = observeGameplay(game, analytics.send);
  let ready = false, disposed = false;
  const preference = k => {
    if (disposed || (k !== null && k !== 'analytics')) return;
    analytics.setEnabled(settings.analytics);
  };
  settings.on(preference);
  if (world) analytics.send(progression('Start', 'World', world));
  return {
    ready() {
      if (ready || disposed) return;
      ready = true;
      if (world) {
        analytics.send(loading(world, now() - started));
      }
    },
    dispose() { disposed = true; stop(); analytics.dispose(); },
  };
}
