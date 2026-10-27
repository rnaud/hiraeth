// Explicit UI demonstration only. Never sent to the collector or mixed with production data.
export function sample() {
  const day = 86400000, now = Date.UTC(2026, 9, 27, 12), since = Date.UTC(2026, 9, 21);
  return { generatedAt: now, since, days: 7, builds: ['2.32'],
    totals: { installations: 184, sessions: 326, events: 2471, latest: now - 45000 },
    retention: { eligible: 96, returned: 38 }, health: { todayAccepted: 412, dailyLimit: 10000 },
    daily: [28, 36, 32, 45, 61, 49, 42].map((installations, i) => ({ day: since / day + i, installations })),
    platforms: [{ platform: 'web', installations: 110 }, { platform: 'android', installations: 52 }, { platform: 'linux', installations: 22 }],
    progression: [
      { category: 'World', name: 'desert', starts: 242, completes: 108, failures: 0, installations: 156 },
      { category: 'Quest', name: 'desert.power', starts: 96, completes: 74, failures: 0, installations: 96 },
      { category: 'Minigame', name: 'canyon', starts: 83, completes: 31, failures: 42, installations: 38 },
    ], loading: [{ name: 'desert', samples: 242, averageMs: 1280, p95Ms: 2940 }, { name: 'caravan', samples: 61, averageMs: 820, p95Ms: 1810 }] };
}
