// The Notes page's list refresh (#388): the list kept on the device is brought up to date with the issues updated
// since it was read (one small call, usually), and read whole only when there is none, when it is over a day old,
// when its format changed or from Reload all. A whole read asks for page 1, then every other page at once.
// Pure but for the api passed in (path → the Worker's JSON). docs/systems/notes.md "Calls and caching".

/** A whole read once a day at least: deleted or transferred issues leave the list only then. */
export const FULL_EVERY = 24 * 60 * 60 * 1000;
/** `since` starts this long before the newest change the list holds: GitHub's search of updates may lag a little. */
export const SINCE_MARGIN = 5 * 60 * 1000;

/** The list with the updated issues in (new ones added, changed, closed and reopened ones replaced), newest first. */
export function mergeUpdates(issues, updates) {
  const byNumber = new Map(issues.map((i) => [i.number, i]));
  for (const u of updates) if (Number.isSafeInteger(u?.number)) byNumber.set(u.number, u);
  return [...byNumber.values()].sort((a, b) => b.number - a.number);
}

/** `since` for a list: its newest updatedAt less SINCE_MARGIN, to the second; null when it has none to go by. */
export function sinceOf(issues) {
  let newest = -Infinity;
  for (const i of issues) { const t = Date.parse(i?.updatedAt); if (t > newest) newest = t; }
  return Number.isFinite(newest) ? new Date(newest - SINCE_MARGIN).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
}

/** Whether a refresh must read the whole list: asked to, nothing kept, kept over a day, or nothing to go by. */
export function needsFullReload(cached, now, all = false) {
  return all || !cached?.issues?.length || typeof cached.fullAt !== 'number' || !(now - cached.fullAt < FULL_EVERY) || now < cached.fullAt
    || !sinceOf(cached.issues);
}

/** Every page of one query up to maxPages: page 1, then the others at once. → { issues, nextPage, calls } */
export async function readPages(api, query, maxPages) {
  const first = await api(`issues?${query}&page=1`);
  const last = Math.min(Number.isSafeInteger(first.lastPage) ? first.lastPage : (first.nextPage ? maxPages : 1), maxPages);
  const rest = await Promise.all(Array.from({ length: Math.max(0, last - 1) }, (_, k) => api(`issues?${query}&page=${k + 2}`)));
  const pages = [first, ...rest];
  const tail = pages[pages.length - 1];
  return { issues: mergeUpdates([], pages.flatMap((p) => p.issues ?? [])), nextPage: tail.nextPage ?? null, calls: pages.length };
}

/**
 * The refreshed list → { issues, nextPage, fullAt, full, calls }.
 * cached: { issues, nextPage, fullAt } (what the page holds); all: Reload all.
 */
export async function syncList(api, cached, { now = Date.now(), all = false, maxPages = 10 } = {}) {
  let spent = 0;
  if (!needsFullReload(cached, now, all)) {
    const got = await readPages(api, `state=all&since=${sinceOf(cached.issues)}`, maxPages);
    // (more updates than the pages read: the whole list instead, rather than a list with holes)
    if (!got.nextPage) return { issues: mergeUpdates(cached.issues, got.issues), nextPage: cached.nextPage ?? null, fullAt: cached.fullAt, full: false, calls: got.calls };
    spent = got.calls;
  }
  const got = await readPages(api, 'state=all', maxPages);
  return { issues: got.issues, nextPage: got.nextPage, fullAt: now, full: true, calls: spent + got.calls };
}
