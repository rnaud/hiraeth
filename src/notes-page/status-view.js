// The Notes page's status of each note (issue #277): the pill, the filter, the counts, the latest comment's line and
// the caches that keep the page quick and GitHub's calls few. Pure but for the storage passed in.
// The status itself is worker/status.js's (from GitHub's state and labels). docs/systems/notes.md "Status".
import { issueStatus, STATUSES, STATUS_LABELS } from '../../worker/status.js';

export { STATUSES };
export const STATUS_TEXT = { open: 'Open', progress: 'In progress', needs: 'Needs you', blocked: 'Blocked', done: 'Done' };
/** The filter's chips, in order: "To do" (everything not done, the page's default) and "All", then each status. */
export const FILTERS = [['todo', 'To do'], ['all', 'All'], ...STATUSES.map((s) => [s, STATUS_TEXT[s]])];

/** The note's status: the Worker's, else worked out from its state and labels (an older Worker's answer). */
export const statusOf = (issue) => STATUSES.includes(issue?.status) ? issue.status : issueStatus(issue);

export function matchesFilter(issue, filter) {
  if (filter === 'all') return true;
  const status = statusOf(issue);
  return filter === 'todo' ? status !== 'done' : status === filter;
}

/** In To do, what waits on the author first, then what an agent is on, then the rest (newest first within each). */
const RANK = { needs: 0, progress: 1, open: 2, blocked: 3, done: 4 };
export function sortForFilter(issues, filter) {
  return filter === 'todo' ? [...issues].sort((a, b) => RANK[statusOf(a)] - RANK[statusOf(b)]) : issues;
}

/** How many loaded notes each chip would show: { todo, all, open, progress, needs, blocked, done }. */
export function filterCounts(issues) {
  const counts = Object.fromEntries(FILTERS.map(([f]) => [f, 0]));
  for (const issue of issues) {
    const status = statusOf(issue);
    counts.all++; counts[status]++;
    if (status !== 'done') counts.todo++;
  }
  return counts;
}

/** Its labels without the ones the status already says. */
export function otherLabels(issue) {
  const status = new Set(Object.values(STATUS_LABELS));
  return (issue?.labels ?? []).filter((l) => !status.has(String(l).toLowerCase()));
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const minutes = Math.round((now - t) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  if (minutes < 14 * 24 * 60) return `${Math.round(minutes / 1440)} d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const shortSha = (sha) => typeof sha === 'string' ? sha.slice(0, 7) : '';

// ---- the caches (localStorage): the last list, shown at once on the next visit while the new one loads, and each
// opened note's activity, kept while the issue's updatedAt stands (a comment, a label or closing it moves updatedAt).
export const LIST_CACHE = 'hiraeth.notes.list.v2';
export const ACTIVITY_CACHE = 'hiraeth.notes.activity.v1';
const ACTIVITY_KEEP = 200;

function read(storage, key) {
  try { const value = JSON.parse(storage?.getItem(key) ?? 'null'); return value && typeof value === 'object' ? value : null; }
  catch { return null; }
}
function write(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/** The cached list: { at, issues, nextPage } or null. */
export function readList(storage) {
  const v = read(storage, LIST_CACHE);
  return v && Array.isArray(v.issues) && typeof v.at === 'number' ? v : null;
}
export const writeList = (storage, issues, nextPage, at = Date.now()) => write(storage, LIST_CACHE, { at, issues, nextPage: nextPage ?? null });

/** The cached activity of an issue if still current (its updatedAt unchanged), else null. */
export function cachedActivity(storage, issue) {
  const entry = read(storage, ACTIVITY_CACHE)?.[issue?.number];
  return entry && entry.updatedAt === issue.updatedAt ? entry.data : null;
}
export function storeActivity(storage, issue, data) {
  const all = read(storage, ACTIVITY_CACHE) ?? {};
  all[issue.number] = { updatedAt: issue.updatedAt, data, at: Date.now() };
  const keys = Object.keys(all);
  if (keys.length > ACTIVITY_KEEP) for (const k of keys.sort((a, b) => (all[a].at ?? 0) - (all[b].at ?? 0)).slice(0, keys.length - ACTIVITY_KEEP)) delete all[k];
  return write(storage, ACTIVITY_CACHE, all);
}

/** The pages the list loads by itself on a refresh (100 notes each); past them, Load more. */
export const AUTO_PAGES = 5;
