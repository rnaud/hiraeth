// Pure gap comparison. Callers supply only the contracts they audit.
export function entryForEntries(entries, key) {
  return entries.find((e) => e.keys?.includes(key) || e.pattern?.test(key)) ?? null;
}

/**
 * What was found against the list: unlisted (found, in no entry), stale (an entry's key not found any more), counts
 * (a counted entry whose count moved: a site added or taken away), bad (a 'handled' screen part the bridge never reads).
 */
export function compareEntries(entries, found, { parts = null } = {}) {
  const unlisted = [], stale = [], counts = [], bad = [];
  for (const [key, v] of found) {
    const e = entryForEntries(entries, key);
    if (!e) { unlisted.push({ key, ...v }); continue; }
    const want = e.count?.[key];
    if (want !== undefined && v.count !== want) counts.push({ key, was: want, now: v.count });
  }
  for (const e of entries) for (const k of e.keys ?? []) if (!found.has(k)) stale.push(k);
  if (parts) for (const e of entries) for (const p of e.parts ?? []) if (!parts.has(p)) bad.push(`${e.keys?.[0]}: '${p}'`);
  return { unlisted, stale, counts, bad };
}

