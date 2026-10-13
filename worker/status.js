// An issue's status on the Notes page (issue #277), from its GitHub state and labels, and what one issue's activity
// shows when it is opened there: its latest comment and, once closed, the commit that closed it.
// Pure: GitHub's JSON in, plain values out (worker/issues.js calls GitHub). docs/systems/notes.md "Status".
//
//   done      closed (completed or not planned)
//   needs     open, `needs-author`: a question waits on the author
//   blocked   open, `codex-only`: the author does it in the Codex browser; agents leave it
//   progress  open, `in progress`: an agent is on it (the coordinator labels it when it starts, comments as it goes)
//   open      open, none of those

export const STATUS_LABELS = { needs: 'needs-author', blocked: 'codex-only', progress: 'in progress' };
export const STATUSES = ['open', 'progress', 'needs', 'blocked', 'done'];

export const labelNames = (issue) => (issue?.labels ?? []).map((l) => typeof l === 'string' ? l : l?.name).filter((l) => typeof l === 'string');

/** The status of one GitHub issue (the REST shape, or the Worker's view with `state` and `labels` as names). */
export function issueStatus(issue) {
  if (issue?.state === 'closed') return 'done';
  const labels = new Set(labelNames(issue).map((l) => l.toLowerCase()));
  for (const status of ['needs', 'blocked', 'progress']) if (labels.has(STATUS_LABELS[status])) return status;
  return 'open';
}

const EXCERPT_LINES = 3, EXCERPT_CHARS = 280;
/** A comment's first lines as plain text: markup comments, `<details>` bodies and images out, at most 3 lines / 280 chars. */
export function commentExcerpt(body) {
  if (typeof body !== 'string') return '';
  const lines = body.replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .split('\n').map((l) => l.trim()).filter(Boolean);
  let text = lines.slice(0, EXCERPT_LINES).join('\n');
  const more = lines.length > EXCERPT_LINES || text.length > EXCERPT_CHARS;
  if (text.length > EXCERPT_CHARS) text = text.slice(0, EXCERPT_CHARS).replace(/\s+\S*$/, '');
  return more ? `${text}…` : text;
}

/** The latest comment of a page of comments (oldest first) → { author, at, excerpt, id } or null. */
export function latestComment(comments) {
  if (!Array.isArray(comments)) return null;
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (!c || typeof c.body !== 'string') continue;
    return {
      author: typeof c.user?.login === 'string' ? c.user.login : 'someone',
      at: typeof c.created_at === 'string' ? c.created_at : null,
      excerpt: commentExcerpt(c.body),
      id: Number.isSafeInteger(c.id) ? c.id : null,   // (the page builds the link from the issue and this id)
    };
  }
  return null;
}

/** The commit that closed the issue, from its events (oldest first): the last `closed` event's commit, or null. */
export function closingCommit(events) {
  if (!Array.isArray(events)) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e?.event !== 'closed') continue;
    return typeof e.commit_id === 'string' && /^[0-9a-f]{40}$/.test(e.commit_id) ? { sha: e.commit_id, at: e.created_at ?? null } : null;
  }
  return null;
}
