import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { storyProgress } from '../src/analytics/progress.js';
import { AnalyticsStore, DAY, DAILY_EVENT_LIMIT } from '../worker/analytics/store.js';
const now = Date.UTC(2026, 9, 27, 12);
let id = 0;
const hex = () => (++id).toString(16).padStart(32, '0');
function store() {
  const db = new DatabaseSync(':memory:');
  const storage = { sql: { exec(sql, ...args) { if (!args.length && sql.includes(';')) { db.exec(sql); return []; } return db.prepare(sql).all(...args).map(row => ({ ...row })); } },
    transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
  return new AnalyticsStore(storage);
}
function batch(platform = 'web', at = now, installation = hex(), events) {
  return { installation, session: hex(), platform, build: '2000', events: events ?? [{ id: hex(), type: 'progression', category: 'World', name: 'desert', status: 'Start', at }] };
}
test('one SQL dataset combines all clients and isolates platform/build selections', () => {
  const s = store(); for (const platform of ['web', 'android', 'linux']) s.ingest(batch(platform), now);
  s.ingest({ ...batch('web'), build: '2001' }, now);
  assert.equal(s.report({}, now).totals.installations, 4);
  assert.equal(s.report({ platform: 'linux' }, now).totals.events, 1);
  assert.equal(s.report({ build: '2001' }, now).totals.events, 1);
  assert.equal(s.report({}, now).progression[0].starts, 4);
});
test('retry and duplicates inside a batch are idempotent, including daily budget', () => {
  const s = store(), b = batch(); b.events.push(b.events[0]);
  assert.equal(s.ingest(b, now).accepted, 1); assert.equal(s.ingest(b, now).accepted, 0);
  assert.equal(s.report({}, now).totals.events, 1); assert.equal(s.report({}, now).health.todayAccepted, 1);
});
test('retention excludes immature cohorts and counts return on the next UTC day', () => {
  const s = store(), player = hex();
  s.ingest(batch('android', now - 3 * DAY, player), now - 3 * DAY);
  s.ingest(batch('android', now - 2 * DAY, player), now - 2 * DAY);
  s.ingest(batch('web', now - 2 * DAY), now - 2 * DAY);
  s.ingest(batch('linux', now - DAY), now - DAY); s.ingest(batch('web', now), now);
  assert.deepEqual(s.report({}, now).retention, { eligible: 2, returned: 1 });
  assert.deepEqual(s.report({ platform: 'android' }, now).retention, { eligible: 1, returned: 1 });
});
test('loading P95 uses nearest rank over observed samples, no fabricated empty percentages', () => {
  const s = store(); assert.equal(s.report({}, now).retention.eligible, 0);
  s.ingest(batch('linux', now, hex(), [100, 300, 900].map(value => ({ id: hex(), at: now, type: 'design', name: 'Loading:World:desert', value }))), now);
  assert.deepEqual(s.report({}, now).loading, [{ name: 'desert', samples: 3, averageMs: 433, p95Ms: 900 }]);
});
test('automatic retention deletes old event rows; reports do not expose random IDs', () => {
  const s = store(), b = batch('web', now - 91 * DAY); s.ingest(b, now - 91 * DAY); s.ingest(batch(), now);
  s.prune(now); const r = s.report({ days: 90 }, now);
  assert.equal(r.totals.events, 1); assert.ok(!JSON.stringify(r).includes(b.installation));
  assert.equal(s.rows('SELECT COUNT(*) AS n FROM events')[0].n, 1);
});
test('global budget caps writes and does not partially accept a batch', () => {
  const s = store(); s.sql.exec('INSERT INTO budget VALUES (?, ?)', Math.floor(now / DAY), DAILY_EVENT_LIMIT);
  assert.deepEqual(s.ingest(batch(), now), { limited: true, accepted: 0 }); assert.equal(s.report({}, now).totals.events, 0);
});

test('retention pruning does not label a still-active installation as newly acquired', () => {
  const s = store(), player = hex();
  s.ingest(batch('web', now - 91 * DAY, player), now - 91 * DAY);
  s.ingest(batch('web', now - 2 * DAY, player), now - 2 * DAY);
  s.prune(now); s.ingest(batch('web', now - DAY, player), now - DAY);
  assert.deepEqual(s.report({}, now).retention, { eligible: 0, returned: 0 });
});

const progressEvent = (value, at = now) => ({ ...value, at, id: hex() });
test('player report keeps single-save high water, latest world, return visits and private aliases', () => {
  const s = store(), player = hex();
  const old = progressEvent(storyProgress('lantern', 11, 7), now - 8 * DAY);
  s.ingest(batch('web', old.at, player, [old]), old.at);
  const ended = progressEvent(storyProgress('home', 11, 15), now - 2 * DAY);
  s.ingest(batch('web', ended.at, player, [ended]), ended.at);
  const restarted = progressEvent(storyProgress('desert', 0, 0));
  s.ingest(batch('web', now, player, [restarted]), now);
  // A delayed event must not replace the latest location, or add to another save's progress.
  s.ingest(batch('web', now, player, [progressEvent(storyProgress('arzach', 1, 1), now - DAY)]), now);
  const r = s.report({}, now), p = r.players[0];
  assert.equal(p.completion, 100); assert.equal(p.lastWorld, 'desert'); assert.equal(p.sessions, 3);
  assert.equal(p.activeDays, 3); assert.equal(p.firstSeen, old.at); assert.equal(p.lastSeen, now);
  assert.ok(!JSON.stringify(r).includes(player));
  assert.equal(s.report({days:30}, now).players[0].player,p.player);
});
test('progress predating the selected period survives; unknown progress is not zero', () => {
  const s = store(), player=hex();
  s.ingest(batch('linux',now-20*DAY,player,[progressEvent(storyProgress('incal',5,1),now-20*DAY)]),now-20*DAY);
  s.ingest(batch('linux',now,player),now);
  const unknown=hex(); s.ingest(batch('web',now,unknown),now);
  assert.equal(s.report({platform:'linux'},now).players[0].completion,40);
  assert.equal(s.report({platform:'web'},now).players[0].completion,null);
  s.prune(now+91*DAY); assert.equal(s.rows('SELECT * FROM player_labels').length,0);
});
test('player pagination is bounded and stable, sorting by progress puts true endings first', () => {
  const s=store();
  for(let i=0;i<52;i++) s.ingest(batch('web',now,hex(),[progressEvent(storyProgress('desert',0,i===51?8:0))]),now);
  const first=s.report({playerSort:'progress'},now), next=s.report({playerPage:1,playerSort:'progress'},now);
  assert.equal(first.players.length,50); assert.equal(next.players.length,2); assert.equal(first.players[0].completion,100);
  assert.equal(new Set([...first.players,...next.players].map(p=>p.player)).size,52);
});

test('upgrading an existing analytics database backfills stable private aliases without new events', () => {
  const s=store(), b=batch(); s.ingest(b,now);
  s.sql.exec('DROP TABLE player_labels'); // shipped schema did not have this table
  const upgraded=new AnalyticsStore(s.storage), first=upgraded.report({},now).players[0];
  assert.equal(first.completion,null); assert.notEqual(first.player,b.installation);
  assert.equal(new AnalyticsStore(s.storage).report({},now).players[0].player,first.player);
});
