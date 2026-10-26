// Hold a real browser input until its observable result. Simulation time may run
// far behind wall time on software rendering; repeated short presses reset holds.
export async function holdUntil({ press, release, done, timeoutMs = 120000,
  intervalMs = 250, pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = () => performance.now(), label = 'held input' }) {
  if (!(timeoutMs > 0) || !(intervalMs > 0)) throw new Error('Positive input timeout and interval required');
  if (await done()) return;
  const start = now();
  try {
    await press();
    while (!(await done())) {
      const remaining = timeoutMs - (now() - start);
      if (remaining <= 0) throw new Error(`timed out waiting for ${label}`);
      await pause(Math.min(intervalMs, remaining));
    }
  } finally { await release(); }
}
