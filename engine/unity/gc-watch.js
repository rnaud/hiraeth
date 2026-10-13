// V8's full collections seen from the script (BridgeArgs -v8-gcs: engine/unity/game.js logs each one with its frame, so
// unity.log puts them beside the frames that missed a refresh; issue #113). There is no GC hook in Puerts' V8. An object
// held only weakly is let go by a full (mark-compact) collection, while the young generation's scavenges keep a weak
// reference's target; but reading a target keeps it to the end of the job, and the marking of a full collection runs
// over several frames, so a target read every frame would never go. Each frame makes a new one and reads, once, the one
// made `lag` frames before: gone, a full collection ended in between (seen up to `lag` frames late; one said a time).

export function fullGcWatch(lag = 8) {
  const ring = new Array(lag).fill(null);
  let frame = 0, quietUntil = 0, lastAt = 0;
  const watch = {
    count: 0,
    /** Once a frame (a job of its own): 0, or the frames since the last full collection said, when one ended. */
    check() {
      const i = frame % lag, old = ring[i];
      ring[i] = new WeakRef({});
      const at = frame++;
      if (!old || at - lag < quietUntil || old.deref() !== undefined) return 0;
      // (the canaries made before this one went with the same collection: not said again)
      quietUntil = at;
      watch.count++;
      const since = at - lastAt; lastAt = at;
      return since;
    },
  };
  return watch;
}
