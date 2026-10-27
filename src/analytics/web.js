// Browser-only adapter. Dynamically imported after production/preference checks.
let instance;
export async function webTransport({ gameKey, secretKey, build, loadSdk = () => import('gameanalytics') }) {
  if (!/^[a-f0-9]{32}$/i.test(gameKey ?? '') || !/^[a-f0-9]{40}$/i.test(secretKey ?? '')) return null;
  const { gameanalytics } = await loadSdk();
  const sdk = gameanalytics.GameAnalytics;
  const status = gameanalytics.EGAProgressionStatus;
  let active = false, ready = false, listening = false, queue = [];
  function send(event) {
    if (event.type === 'progression') {
      if (event.value === undefined) sdk.addProgressionEvent(status[event.status], event.category, event.name);
      else sdk.addProgressionEvent(status[event.status], event.category, event.name, undefined, event.value);
    } else if (event.type === 'design') sdk.addDesignEvent(event.name, event.value);
  }
  // initialize() returns before its session handshake. Sending immediately loses the
  // world-start event. The public configuration callback completes that handshake;
  // defer until its stack returns so the SDK has assigned the session identifier.
  const listener = { onRemoteConfigsUpdated() { queueMicrotask(() => {
    if (!active) return;
    ready = true;
    for (const event of queue) { try { send(event); } catch { /* optional telemetry */ } }
    queue = [];
  }); } };
  function stop() {
    active = ready = false; queue = [];
    if (listening) { sdk.removeRemoteConfigsListener(listener); listening = false; }
  }
  return {
    enable(on) {
      if (!on) {
        stop();
        if (instance) { sdk.setEnabledEventSubmission(false); sdk.endSession(); }
        return;
      }
      if (active) return;
      active = true; ready = false;
      sdk.addRemoteConfigsListener(listener); listening = true;
      if (!instance && on) {
        sdk.setEnabledInfoLog(false);
        sdk.setEnabledVerboseLog(false);
        sdk.configureBuild(build);
        sdk.setEnabledManualSessionHandling(true);
        sdk.enableHealthEvent(false);
        sdk.initialize(gameKey, secretKey);
        instance = sdk;
      } else {
        sdk.setEnabledEventSubmission(true); sdk.startSession();
      }
    },
    close() { stop(); if (instance) sdk.endSession(); },
    send(event) {
      if (!active) return;
      if (ready) send(event);
      else if (queue.length < 64) queue.push(event);
    },
  };
}
