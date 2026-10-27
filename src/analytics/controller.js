// Owns asynchronous SDK loading and preference changes. Tests inject an inert transport.
export function createAnalytics(loadTransport, { allowed = false, limit = 64 } = {}) {
  let wanted = false, transport = null, pending = null, queue = [], generation = 0;
  const safely = fn => { try { fn(); } catch { /* analytics must never interrupt play */ } };
  async function setEnabled(value) {
    const next = allowed && value === true;
    if (next === wanted) return pending;
    wanted = next;
    const revision = ++generation;
    if (!wanted) { queue = []; if (transport) safely(() => transport.enable(false)); return; }
    if (transport) { safely(() => transport.enable(true)); return; }
    pending = (async () => {
      try {
        const loaded = await loadTransport();
        if (generation !== revision || !wanted) return; // opt-out while the SDK downloaded
        transport = loaded;
        if (!transport) { queue = []; return; }
        transport.enable(true);
        for (const event of queue) safely(() => transport.send(event));
        queue = [];
      } catch { queue = []; } // blocked analytics must not block the game
      finally { if (generation === revision) pending = null; }
    })();
    return pending;
  }
  function send(event) {
    if (!wanted || !event) return;
    if (transport) safely(() => transport.send(event));
    else if (queue.length < limit) queue.push(event);
  }
  return { setEnabled, send, dispose() { wanted = false; queue = []; ++generation; if (transport) safely(() => transport.close?.()); } };
}
