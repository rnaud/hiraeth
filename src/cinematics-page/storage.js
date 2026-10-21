// Progress in a review frame is ephemeral, including slot metadata and migrations.
export function reviewStorage(search = globalThis.location?.search ?? '') {
  const query = new URLSearchParams(search);
  if (!query.has('cinematicReview') && !query.has('markReview')) return null;
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}

/**
 * Notes read from an export (this page's, or a QC pass's: docs/systems/cinematics-qc-notes.json) merged over
 * the ones here: per cinematic, the newer `updated` wins; anything that isn't a note is left out.
 */
export const QC_VERDICTS = ['Not reviewed', 'Pass', 'Needs work', 'Pass with creative recommendation'];

export function mergeNotes(current = {}, imported = {}) {
  const src = imported?.notes ?? imported, out = { ...current };
  for (const [id, n] of Object.entries(src ?? {})) {
    if (!n || typeof n !== 'object' || !QC_VERDICTS.includes(n.verdict)) continue;
    const note = { verdict: n.verdict, text: String(n.text ?? ''), updated: String(n.updated ?? '') };
    if (!out[id] || (note.updated && note.updated > (out[id].updated ?? ''))) out[id] = note;
  }
  return out;
}
