// Shared event vocabulary. No SDK, browser, storage or game registry imports.
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_.-]{0,31}$/.test(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
export const DEFAULT_ANALYTICS = true;

export function progression(status, category, name, score) {
  if (!['Start', 'Complete', 'Fail'].includes(status) || !['World', 'Quest', 'Minigame'].includes(category) || !id(name)) return null;
  return { type: 'progression', status, category, name, ...(finite(score) && status !== 'Start' ? { value: Math.round(Math.max(-2147483648, Math.min(2147483647, score))) } : {}) };
}
export function loading(world, ms) {
  return id(world) && finite(ms) && ms >= 0 ? { type: 'design', name: `Loading:World:${world}`, value: Math.round(ms) } : null;
}

/** Subscribe only to authored identifiers and numeric results; never forward saves, text or arbitrary payloads. */
export function observeGameplay(game, emit) {
  const off = [
    game.on('flag', ({ name, value }) => {
      const match = /^world\.([a-z0-9_-]+)\.done$/.exec(name);
      if (match && value === true) emit(progression('Complete', 'World', match[1]));
    }),
    game.on('quest', ({ id: name, stage, prev }) => {
      if (stage === 'done' || stage === 'failed') emit(progression(stage === 'done' ? 'Complete' : 'Fail', 'Quest', name));
      else if (prev === undefined) emit(progression('Start', 'Quest', name));
    }),
    game.on('minigame:attempt', ({ id: name, status, score }) => emit(progression(status, 'Minigame', name, score))),
  ];
  return () => off.forEach(fn => fn());
}

/** Local/dev/review sessions never enter production analytics, even with a saved enabled preference. */
export function productionWeb({ production = false, hostname = '', search = '', debugSlot = false } = {}) {
  if (!production || debugSlot || !['hiraeth.my', 'rnaud.github.io', 'hiraeth.alexandria-rnaud.workers.dev'].includes(hostname)) return false;
  const q = new URLSearchParams(search);
  for (const key of q.keys()) if (/review|debug|bench|test|capture|sequence/i.test(key) || ['dev', 'worlds', 'shot', 'freeze', 'hudRun', 'tour'].includes(key)) return false;
  return true;
}
