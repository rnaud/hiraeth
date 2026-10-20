// The fights' and temples' sequences, checked in their own file (tests/sequences-fights.test.js) so that
// tests/sequences-play.test.js stays inside a shard's 240 s per file (tests/test-shards.test.js).
export const FIGHTS = new Set(['fight', 'foes', 'temple', 'fight-temple', 'fight-crowd']);
