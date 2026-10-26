// Browser harness waits use elapsed wall time; slow CDP calls must not extend a
// nominal two-minute wait into the whole CI job. A timeout remains a failure.
export async function waitUntil({ read, timeoutMs, label, intervalMs = 250,
  now = () => performance.now(), pause = ms => new Promise(r => setTimeout(r, ms)) }) {
  if (!(timeoutMs > 0) || !(intervalMs > 0)) throw Error('Positive browser wait timeout and interval required');
  const start = now();
  while (now() - start < timeoutMs) {
    try { if (await read()) return true; } catch { /* navigation can replace the context */ }
    const remaining = timeoutMs - (now() - start);
    if (remaining <= 0) break;
    await pause(Math.min(intervalMs, remaining));
  }
  throw Error(`timed out waiting for ${label}`);
}

// Finite CDP requests also bound evidence capture after a renderer crash/stall.
export function cdpRequests(socket, { timeoutMs = 30000, timer = setTimeout, cancel = clearTimeout } = {}) {
  let serial = 0, closed = false;
  const pending = new Map();
  const finish = (id, error, value) => {
    const item = pending.get(id); if (!item) return;
    pending.delete(id); cancel(item.timer);
    error ? item.reject(error) : item.resolve(value);
  };
  const close = () => { closed = true; for (const id of [...pending.keys()]) finish(id, Error('Browser connection closed')); };
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) finish(message.id, message.error ? Error(message.error.message) : null, message.result);
  });
  socket.addEventListener('close', close);
  socket.addEventListener('error', close);
  return { close, send(method, params = {}) {
    if (closed) return Promise.reject(Error('Browser connection closed'));
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const item = { resolve, reject, timer: timer(() => finish(id, Error(`Browser request timed out: ${method}`)), timeoutMs) };
      pending.set(id, item);
      try { socket.send(JSON.stringify({ id, method, params })); } catch (e) { finish(id, e); }
    });
  } };
}
