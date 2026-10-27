// Optional native capability: old Unity players simply do not collect analytics.
export function unityTransport(host, build) {
  if (!host?.analytics) return null;
  return { close: () => host.analytics('end', '{}'), enable: on => host.analytics('enabled', JSON.stringify({ enabled: on, build })), send: event => host.analytics('event', JSON.stringify({ ...event, hasValue: event.value !== undefined })) };
}
