// A fake GitHub for the Notes page's refresh (#388): a repository of numbered issues in GitHub's REST shape, the
// list (created or updated order, `since`, pages with their Link header), the needs-author questions and their
// comments, each call answered after a latency, every call and the most in flight at once recorded. Used by
// tests/notes-refresh.test.js; no network.
import { handleIssues, REPOSITORY } from '../worker/issues.js';

export const API = `https://api.github.com/repos/${REPOSITORY}/issues`;
export const origin = 'https://notebook.example';
const allow = { limit: async () => ({ success: true }) };
export const env = { HIRAETH_ISSUES_TOKEN: 'test-github-token', HIRAETH_NOTES_PASSWORD: 'testpw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
export const BASE = Date.UTC(2026, 8, 1);

/** n issues (#1 oldest): every 3rd closed, every 40th needs-author with a question in a comment, a few labels. */
export function repository(n = 390) {
  const issues = [], comments = {};
  for (let k = 1; k <= n; k++) {
    const created = BASE + k * 3600_000, closed = k % 3 === 0;
    const needs = !closed && k % 40 === 1;
    const labels = [...(needs ? ['needs-author'] : []), ...(k % 7 === 0 ? ['combat'] : [])];
    issues.push({ number: k, title: `Issue ${k}`, body: 'A body of some length. '.repeat(30), state: closed ? 'closed' : 'open',
      state_reason: closed ? 'completed' : null, created_at: iso(created), updated_at: iso(created + 1800_000), closed_at: closed ? iso(created + 1800_000) : null,
      labels: labels.map((name) => ({ id: 1, name, color: 'ffffff', description: null, default: false })),
      comments: needs ? 3 : k % 4, user: { login: 'rnaud', id: 1 }, author_association: 'OWNER', html_url: `https://github.com/${REPOSITORY}/issues/${k}` });
    if (needs) comments[k] = [{ id: k * 10 + 1, author_association: 'OWNER', body: 'Looked into it.' }, { id: k * 10 + 2, author_association: 'OWNER', body: 'More.' },
      { id: k * 10 + 3, author_association: 'OWNER', body: `Context.\n<!-- question -->\n**Question:** Which for #${k}?\n<!-- options: single -->\n- [ ] A\n- [ ] B\n<!-- /question -->` }];
  }
  return { issues, comments };
}

/** The fake GitHub over a repository: { fetch, calls, maxInFlight(), reset() }. */
export function fakeGitHub(repo, { latency = 0 } = {}) {
  const calls = []; let inFlight = 0, most = 0;
  const page = (list, url, per) => {
    const p = Number(url.searchParams.get('page') ?? 1), last = Math.max(1, Math.ceil(list.length / per));
    const links = [...(p < last ? [`<${url.origin}${url.pathname}?page=${p + 1}>; rel="next"`, `<${url.origin}${url.pathname}?per_page=${per}&page=${last}>; rel="last"`] : [])];
    return Response.json(list.slice((p - 1) * per, p * per), { headers: links.length ? { Link: links.join(', ') } : {} });
  };
  const answer = (u) => {
    const url = new URL(u);
    if (u.startsWith(`${API}?`)) {
      const q = url.searchParams, per = Number(q.get('per_page') ?? 30);
      let list = repo.issues.filter((i) => q.get('state') === 'all' || i.state === q.get('state'));
      if (q.get('labels')) list = list.filter((i) => i.labels.some((l) => l.name === q.get('labels')));
      if (q.get('since')) list = list.filter((i) => i.updated_at >= q.get('since'));
      const key = q.get('sort') === 'updated' ? 'updated_at' : 'created_at';
      list = [...list].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (q.get('direction') === 'asc' ? 1 : -1));
      return page(list, url, per);
    }
    const m = /\/issues\/(\d+)\/comments$/.exec(url.pathname);
    if (m) return page(repo.comments[m[1]] ?? [], url, Number(url.searchParams.get('per_page') ?? 30));
    return new Response('{}', { status: 404 });
  };
  return {
    calls,
    maxInFlight: () => most,
    reset() { calls.length = 0; most = 0; },
    fetch: async (u) => {
      calls.push(u); inFlight++; most = Math.max(most, inFlight);
      try { if (latency) await sleep(latency); return answer(u); } finally { inFlight--; }
    },
  };
}

/** The page's api() over the Worker over the fake GitHub, signed in. */
export async function pageApi(github, store = null, now = () => Date.now()) {
  const login = await handleIssues(new Request(`${origin}/api/notes/session`, { method: 'POST', body: JSON.stringify({ password: env.HIRAETH_NOTES_PASSWORD }),
    headers: { Origin: origin, 'Content-Type': 'application/json' } }), env, github.fetch, now(), store);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  return async (path) => {
    const r = await handleIssues(new Request(`${origin}/api/notes/${path}`, { headers: { Cookie: cookie } }), env, github.fetch, now(), store);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    return data;
  };
}

/** The page's refresh before #388: page 1, then each next page in turn, up to five. */
export async function sequentialLoad(api, autoPages = 5) {
  let fresh = [], next = 1;
  do {
    const data = await api(`issues?state=all&page=${next}`);
    fresh = [...new Map([...fresh, ...data.issues].map((i) => [i.number, i])).values()];
    next = data.nextPage;
  } while (next && next <= autoPages);
  return fresh;
}
