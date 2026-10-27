// One SQLite-backed Durable Object for all Hiraeth platforms. No IPs or user-agent strings.
export const DAY = 86400000;
export const RETENTION_DAYS = 90;
export const DAILY_EVENT_LIMIT = 10000;
export class AnalyticsStore {
  constructor(storage) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, installation TEXT NOT NULL, session TEXT NOT NULL,
      platform TEXT NOT NULL, build TEXT NOT NULL, at INTEGER NOT NULL, received INTEGER NOT NULL,
      type TEXT NOT NULL, category TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, value REAL);
      CREATE INDEX IF NOT EXISTS events_at ON events(at);
      CREATE INDEX IF NOT EXISTS events_installation ON events(installation, received);
      CREATE TABLE IF NOT EXISTS budget (day INTEGER PRIMARY KEY, accepted INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS first_seen (installation TEXT PRIMARY KEY, at INTEGER NOT NULL);`);
  }
  rows(query, ...args) { return [...this.sql.exec(query, ...args)]; }
  ingest(batch, now) {
    const day = Math.floor(now / DAY);
    return this.storage.transactionSync(() => {
      const used = this.rows('SELECT accepted FROM budget WHERE day = ?', day)[0]?.accepted ?? 0;
      const fresh = [...new Map(batch.events.map(e => [e.id, e])).values()].filter(e => !this.rows('SELECT id FROM events WHERE id = ?', e.id).length);
      const own = this.rows('SELECT COUNT(*) AS n FROM events WHERE installation = ? AND received >= ?', batch.installation, day * DAY)[0].n;
      if (used + fresh.length > DAILY_EVENT_LIMIT || own + fresh.length > 1000) return { limited: true, accepted: 0 };
      let accepted = 0;
      for (const e of fresh) {
        // Receipt time bounds retention and prevents client clocks polluting future cohorts.
        const at = Math.min(e.at, now);
        this.sql.exec('INSERT OR IGNORE INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          e.id, batch.installation, batch.session, batch.platform, batch.build, at, now,
          e.type, e.category ?? 'Loading', e.type === 'design' ? e.name.slice(14) : e.name, e.status ?? '', e.value ?? null);
        this.sql.exec('INSERT INTO first_seen VALUES (?, ?) ON CONFLICT(installation) DO UPDATE SET at = MIN(at, excluded.at)', batch.installation, at);
        accepted++;
      }
      this.sql.exec('INSERT INTO budget VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET accepted = accepted + excluded.accepted', day, accepted);
      return { accepted };
    });
  }
  prune(now) {
    this.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM events WHERE at < ?', now - RETENTION_DAYS * DAY);
      this.sql.exec('DELETE FROM first_seen WHERE at < ?', now - RETENTION_DAYS * DAY);
      this.sql.exec('DELETE FROM budget WHERE day < ?', Math.floor(now / DAY) - RETENTION_DAYS);
    });
  }
  report({ days = 7, platform = 'all', build = '' }, now) {
    const since = Math.floor(now / DAY) * DAY - (days - 1) * DAY;
    const terms = ['at >= ?', 'at <= ?'], args = [since, now];
    if (platform !== 'all') { terms.push('platform = ?'); args.push(platform); }
    if (build) { terms.push('build = ?'); args.push(build); }
    const where = terms.join(' AND '), query = (sql, ...extra) => this.rows(sql.replaceAll('$filter', where), ...args, ...extra);
    const totals = query('SELECT COUNT(*) AS events, COUNT(DISTINCT installation) AS installations, COUNT(DISTINCT installation || session) AS sessions, MAX(received) AS latest FROM events WHERE $filter')[0];
    const daily = query('SELECT CAST(at / 86400000 AS INTEGER) AS day, COUNT(DISTINCT installation) AS installations, COUNT(DISTINCT installation || session) AS sessions FROM events WHERE $filter GROUP BY day ORDER BY day');
    const platforms = query('SELECT platform, COUNT(DISTINCT installation) AS installations, COUNT(*) AS events FROM events WHERE $filter GROUP BY platform');
    const progression = query(`SELECT category, name, SUM(status='Start') AS starts, SUM(status='Complete') AS completes, SUM(status='Fail') AS failures,
      COUNT(DISTINCT installation) AS installations FROM events WHERE $filter AND type='progression' GROUP BY category,name ORDER BY starts DESC, name LIMIT 200`);
    const loading = query(`WITH samples AS (SELECT name,value, ROW_NUMBER() OVER(PARTITION BY name ORDER BY value) AS rank, COUNT(*) OVER(PARTITION BY name) AS n
      FROM events WHERE $filter AND type='design') SELECT name, COUNT(*) AS samples, ROUND(AVG(value)) AS averageMs,
      MAX(CASE WHEN rank = CAST((n * 95 + 99) / 100 AS INTEGER) THEN value END) AS p95Ms FROM samples GROUP BY name ORDER BY p95Ms DESC LIMIT 100`);
    // D1 = returned on the following UTC calendar day, among fully observed eligible cohorts.
    // First-seen is across platforms; selected filters restrict activity and cohort inclusion.
    const retention = query(`WITH activity AS (SELECT DISTINCT installation, CAST(at / 86400000 AS INTEGER) AS day FROM events WHERE $filter),
      cohorts AS (SELECT a.installation, a.day FROM activity a JOIN first_seen f ON f.installation=a.installation
        WHERE a.day=CAST(f.at / 86400000 AS INTEGER) AND a.day < ?)
      SELECT COUNT(*) AS eligible, SUM(EXISTS(SELECT 1 FROM activity a WHERE a.installation=c.installation AND a.day=c.day+1)) AS returned FROM cohorts c`, Math.floor(now / DAY) - 1)[0];
    const observedFirst = this.rows('SELECT MIN(at) AS at FROM events')[0]?.at ?? null;
    return { generatedAt: now, since, days, platform, build, totals, daily, platforms, progression, loading,
      retention: { eligible: retention.eligible, returned: retention.returned ?? 0 }, observedFirst,
      builds: this.rows('SELECT DISTINCT build FROM events WHERE at >= ? ORDER BY build DESC LIMIT 100', now - 90 * DAY).map(x => x.build),
      health: { todayAccepted: this.rows('SELECT accepted FROM budget WHERE day = ?', Math.floor(now / DAY))[0]?.accepted ?? 0, dailyLimit: DAILY_EVENT_LIMIT }, retentionDays: RETENTION_DAYS };
  }
}
export class HiraethAnalytics {
  constructor(ctx) { this.ctx = ctx; this.store = new AnalyticsStore(ctx.storage); }
  async fetch(request) {
    const { op, data } = await request.json();
    const now = Date.now();
    if (!await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(now + DAY);
    if (op === 'ingest') { const result = this.store.ingest(data, now); return Response.json(result, { status: result.limited ? 429 : 200 }); }
    if (op === 'report') return Response.json(this.store.report(data, now));
    return new Response(null, { status: 404 });
  }
  async alarm() { this.store.prune(Date.now()); await this.ctx.storage.setAlarm(Date.now() + DAY); }
}
