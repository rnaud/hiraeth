const tabStorage = () => { try { return globalThis.sessionStorage; } catch { return null; } };
export const ADMIN_SESSION_KEY = 'hiraeth.admin.session';
export function adminBase(location = globalThis.location) {
  return ['hiraeth.my', 'rnaud.github.io'].includes(location?.hostname) ? 'https://hiraeth.alexandria-rnaud.workers.dev' : '';
}
/** Tab-scoped token only. No password persistence, cookies, query credentials or arbitrary API proxy. */
export function adminClient({ fetcher = globalThis.fetch, storage = tabStorage(), base = adminBase(), now = Date.now } = {}) {
  let session = null;
  const sync = () => { try { if (storage) session = JSON.parse(storage.getItem(ADMIN_SESSION_KEY) || 'null'); } catch {} };
  sync();
  const signOut = () => { session = null; try { storage?.removeItem(ADMIN_SESSION_KEY); } catch {} };
  async function request(path, options = {}) {
    sync();
    if (!/^\/api\/(admin\/session|analytics\/report)(\?|$)/.test(path)) throw Error('Unsupported admin request');
    if (session?.expires <= now()) signOut();
    const response = await fetcher(`${base}${path}`, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', ...options,
      headers: { ...options.headers, ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) } });
    let body; try { body = await response.json(); } catch { throw Error('Admin server unavailable. Please try again later.'); }
    if (!response.ok) { if (response.status === 401) signOut(); throw Object.assign(new Error(body.error || 'Admin request failed'), { status: response.status }); }
    return body;
  }
  return { request, signOut,
    async signedIn() { sync(); if (!session?.token) return false; const result = await request('/api/admin/session'); if (!result.authenticated) signOut(); return !!result.authenticated; },
    async signIn(password) {
      signOut(); const result = await request('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      session = { token: result.token, expires: result.expires };
      try { storage?.setItem(ADMIN_SESSION_KEY, JSON.stringify(session)); } catch {}
      return true;
    },
  };
}
