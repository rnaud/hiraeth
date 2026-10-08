// Progress in a review frame is ephemeral, including slot metadata and migrations.
export function reviewStorage(search = globalThis.location?.search ?? '') {
  if (!new URLSearchParams(search).has('cinematicReview')) return null;
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}
