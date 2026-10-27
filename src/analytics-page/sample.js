// Explicit UI demonstration only. Never sent to the collector or mixed with production data.
export function sample() {
  const day = 86400000, now = Date.UTC(2026, 9, 27, 12), since = Date.UTC(2026, 9, 21);
  return { generatedAt: now, since, days: 7, builds: ['2.32'],
    totals: { installations: 184, sessions: 326, events: 2471, latest: now - 45000 },
    retention: { eligible: 96, returned: 38 }, health: { todayAccepted: 412, dailyLimit: 10000 },
    daily: [28, 36, 32, 45, 61, 49, 42].map((installations, i) => ({ day: since / day + i, installations })),
    platforms: [{ platform: 'web', installations: 110 }, { platform: 'android', installations: 52 }, { platform: 'linux', installations: 22 }],
    players: [
      { player: 'a31f8d29e604bc72', completion: 100, milestone: 'true-ending', lastWorld: 'home', sessions: 9, activeDays: 5, platforms: 'android', firstSeen: now - 6 * day, lastSeen: now - 45000, progressAt: now - 45000 },
      { player: '8b02c71d6e45a930', completion: 73, milestone: 'homecoming', lastWorld: 'spacecity', sessions: 6, activeDays: 3, platforms: 'web', firstSeen: now - 5 * day, lastSeen: now - day, progressAt: now - day },
      { player: 'd791e0834fa62bc5', completion: 26, milestone: 'exploring', lastWorld: 'perdide', sessions: 2, activeDays: 2, platforms: 'linux', firstSeen: now - 4 * day, lastSeen: now - 2 * day, progressAt: now - 2 * day },
      { player: 'c053a9e14bd7286f', completion: 0, milestone: 'prologue', lastWorld: 'desert', sessions: 1, activeDays: 1, platforms: 'web', firstSeen: now - 3 * day, lastSeen: now - 3 * day, progressAt: now - 3 * day },
      { player: 'f820a9c143d76be5', completion: null, lastWorld: null, sessions: 1, activeDays: 1, platforms: 'android', firstSeen: now - 4 * day, lastSeen: now - 4 * day },
    ], playerPage: 0, playerPageSize: 50,
    progression: [
      { category: 'World', name: 'desert', starts: 242, completes: 108, failures: 0, installations: 156 },
      { category: 'Quest', name: 'desert.power', starts: 96, completes: 74, failures: 0, installations: 96 },
      { category: 'Minigame', name: 'canyon', starts: 83, completes: 31, failures: 42, installations: 38 },
    ], loading: [{ name: 'desert', samples: 242, averageMs: 1280, p95Ms: 2940 }, { name: 'caravan', samples: 61, averageMs: 820, p95Ms: 1810 }] };
}
