// Shared wire contract: pure and independent of worlds, UI, SDKs and storage.
import { progression, loading } from './events.js';
import { storyProgress } from './progress.js';
export const ANALYTICS_ENDPOINT = 'https://hiraeth.alexandria-rnaud.workers.dev/api/analytics/events';
export const randomId = () => crypto.randomUUID().replaceAll('-', '');
export const validId = v => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
export const validBuild = v => typeof v === 'string' && /^[a-zA-Z0-9_.-]{1,48}$/.test(v);
export function cleanEvent(e) {
  if (!e || typeof e !== 'object') return null;
  if (e.type === 'progress') return e.model === 1 ? storyProgress(e.name, e.worlds, e.milestones, e.model) : null;
  if (e.type === 'progression') return progression(e.status, e.category, e.name, e.hasValue === false ? undefined : e.value);
  if (e.type === 'design' && typeof e.name === 'string' && e.name.startsWith('Loading:World:')) {
    return e.value <= 3600000 ? loading(e.name.slice(14), e.value) : null;
  }
  return null;
}
export function cleanBatch(input, now = Date.now()) {
  if (!input || input.v !== 1 || !validId(input.installation) || !validId(input.session)
    || !['web', 'android', 'linux'].includes(input.platform) || !validBuild(input.build)
    || !Array.isArray(input.events) || !input.events.length || input.events.length > 20) return null;
  const events = [];
  for (const e of input.events) {
    const event = cleanEvent(e);
    if (!event || !validId(e.id) || !Number.isSafeInteger(e.at) || e.at < now - 86400000 || e.at > now + 300000) return null;
    events.push({ ...event, id: e.id, at: e.at });
  }
  return { v: 1, installation: input.installation, session: input.session, platform: input.platform, build: input.build, events };
}
