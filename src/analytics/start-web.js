import { trackSession } from './session.js';
import { productionWeb } from './events.js';

export function startWebAnalytics({ game, settings, world, debugSlot, build, location }) {
  return trackSession({ game, settings, world,
    allowed: productionWeb({ production: import.meta.env?.PROD === true, hostname: location.hostname, search: location.search, debugSlot }),
    loadTransport: async () => {
      const { webTransport } = await import('./web.js');
      return webTransport({ gameKey: import.meta.env.VITE_GAMEANALYTICS_GAME_KEY, secretKey: import.meta.env.VITE_GAMEANALYTICS_SECRET_KEY, build });
    },
  });
}
