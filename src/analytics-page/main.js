import './style.css';
import { TITLES } from '../levels/names.js';
import { adminClient } from '../admin/session.js';
const client = adminClient();
const app = document.querySelector('#app');
const demo = location.hash === '#demo';
app.innerHTML = `<header><a class="brand" href="./admin/">HIRAETH <span>/ Observatory</span></a><span class="badge">PRIVATE ANALYTICS</span></header>
<main><div class="intro"><div class="eyebrow">UNDERSTAND THE JOURNEY</div><h1>Where players wander.<br>Where they get stuck.</h1><p>One game. Every platform. A shared view of exploration, challenges and loading.</p></div>
<div id="notice" role="status" aria-live="polite"></div>
<form id="login" hidden><h2>Unlock your reports</h2><p>Use your private Hiraeth notebook password.</p><label>Password<input type="password" id="password" autocomplete="current-password" required></label><button>Sign in</button></form>
<section id="dashboard" hidden><div class="toolbar"><div class="filters"><label>Period<select id="days"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><label>Platform<select id="platform"><option value="all">All platforms</option><option value="web">Web</option><option value="android">Android</option><option value="linux">Linux</option></select></label><label>Build<select id="build"><option value="">All builds</option></select></label></div><button id="refresh">Refresh</button></div>
<div id="cards" class="cards"></div><section class="panel player-panel"><div class="panel-head"><div><h2>Player journeys</h2><p>Main story · True ending = 100%. Best reported progress from one save, over the retained 90 days.</p></div><label>Sort<select id="playerSort"><option value="recent">Recently seen</option><option value="progress">Furthest along</option><option value="oldest">Longest since seen</option></select></label></div><div class="scroll"><table class="players"><thead><tr><th>Anonymous player</th><th>Story completion</th><th>Last world</th><th>Visits</th><th>First seen</th><th>Last seen</th></tr></thead><tbody id="players"></tbody></table></div><div class="pagination"><span id="playerCount"></span><button id="playerPrev" class="quiet">Previous</button><button id="playerNext" class="quiet">Next</button></div><p class="small">A milestone-based estimate, not a measure of playtime or optional content. Filters choose players and visits; progress uses their retained history. A visit on another UTC day counts as a return. “Not reported” means the client has not sent a progress snapshot. Last seen is the last recorded event, not a live online indicator.</p></section><div class="panels"><section class="panel"><div class="panel-head"><h2>Daily activity</h2><span>Distinct installations · UTC</span></div><div id="chart" class="chart"></div></section><section class="panel"><div class="panel-head"><h2>Platform mix</h2></div><div id="mix"></div><p class="small">An installation is one browser profile or native app. The same person on two devices counts twice.</p></section></div>
<section class="panel"><div class="panel-head"><div><h2>Progress & challenges</h2><p>Event counts, not a matched-attempt funnel. Revisits, retries and opt-outs affect the totals.</p></div></div><div class="scroll"><table><thead><tr><th>Activity</th><th>Type</th><th>Starts</th><th>Completions</th><th>Failures</th><th>Installations</th></tr></thead><tbody id="progress"></tbody></table></div></section>
<section class="panel"><div class="panel-head"><div><h2>World loading</h2><p>Entry-point setup to world-ready. P95: 95% of recorded loads finished within this time.</p></div></div><div class="scroll"><table><thead><tr><th>World</th><th>Loads</th><th>Average</th><th>P95</th></tr></thead><tbody id="loading"></tbody></table></div></section>
<footer><span id="freshness"></span><span id="health"></span></footer><p class="small">Best-effort, opt-out telemetry; this is not a census. Events are retained for 90 days. D1 measures return on the next UTC calendar day, using only cohorts whose next day has finished; “new” means first observed within the retained history. Build filters restrict both days. Player labels are random report-only aliases, separate from collection identifiers. Clearing app/browser data creates a new player; devices are not linked.</p><button id="logout" class="quiet">Sign out</button></section></main>`;
const $ = id => document.getElementById(id);
const number = v => Number(v ?? 0).toLocaleString();
const seconds = v => `${(Number(v) / 1000).toFixed(2)} s`;
function cell(row, value, header = false) { const el = document.createElement(header ? 'th' : 'td'); el.textContent = value; row.append(el); return el; }
function rows(target, data, columns) {
  target.replaceChildren();
  for (const item of data) { const row = document.createElement('tr'); columns.forEach(fn => cell(row, fn(item))); target.append(row); }
  if (!data.length) { const row = document.createElement('tr'); const el = cell(row, 'No observations in this selection.'); el.colSpan = columns.length; target.append(row); }
}
let playerPage = 0;
const stamp = value => value == null ? '—' : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const milestones = { 'true-ending': 'True ending reached', 'ilen-found': 'Ilen found', homecoming: 'First homecoming', exploring: 'Exploring', prologue: 'Prologue' };
function render(data) {
  $('login').hidden = true; $('dashboard').hidden = false;
  $('cards').replaceChildren();
  const retention = data.retention.eligible ? `${Math.round(data.retention.returned / data.retention.eligible * 100)}%` : '—';
  for (const [label, value, detail] of [
    ['Active installations', number(data.totals.installations), 'Distinct browser profiles & apps'],
    ['Sessions', number(data.totals.sessions), 'A new session after 30 minutes idle'],
    ['Recorded events', number(data.totals.events), 'Progress, results & loading'],
    ['Next-day return', retention, `${number(data.retention.returned)} / ${number(data.retention.eligible)} eligible installations`],
  ]) { const card = document.createElement('article'); card.className = 'card'; for (const [tag, text] of [['span', label], ['strong', value], ['small', detail]]) { const e = document.createElement(tag); e.textContent = text; card.append(e); } $('cards').append(card); }
  const selectedBuild = $('build').value;
  $('build').replaceChildren(new Option('All builds', ''));
  for (const build of data.builds) $('build').add(new Option(build, build));
  $('build').value = selectedBuild;
  const daily = new Map(data.daily.map(d => [d.day, d.installations])), max = Math.max(1, ...daily.values());
  $('chart').replaceChildren();
  for (let day = Math.floor(data.since / 86400000); day <= Math.floor(data.generatedAt / 86400000); day++) {
    const count = daily.get(day) ?? 0, date = new Date(day * 86400000).toISOString().slice(5, 10);
    const col = document.createElement('div'); col.className = 'column'; col.title = `${date}: ${count} installations`; col.setAttribute('aria-label', col.title);
    const value = document.createElement('span'); value.className = 'count'; value.textContent = count;
    const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = `${Math.max(1, count / max * 115)}px`;
    const label = document.createElement('small'); label.textContent = date;
    col.append(value, bar, label); $('chart').append(col);
  }
  $('mix').replaceChildren();
  for (const platform of ['web', 'android', 'linux']) {
    const p = data.platforms.find(x => x.platform === platform), count = p?.installations ?? 0;
    const row = document.createElement('div'); row.className = 'mix-row';
    const label = document.createElement('span'); label.textContent = platform;
    const value = document.createElement('strong'); value.textContent = number(count);
    row.append(label, value); $('mix').append(row);
  }
  $('players').replaceChildren();
  for (const player of data.players ?? []) {
    const row = document.createElement('tr');
    const label = cell(row, `Player ${player.player}`); label.title = player.platforms;
    const progress = cell(row, player.completion == null ? 'Not reported' : `${player.completion}%`);
    if (player.completion != null) {
      const meter = document.createElement('progress'); meter.max = 100; meter.value = player.completion;
      meter.setAttribute('aria-label', `${player.completion}% main story`); progress.append(meter);
      const detail = document.createElement('small'); detail.textContent = milestones[player.milestone] ?? ''; progress.append(detail);
    }
    const world = cell(row, TITLES[player.lastWorld] ?? '—'); world.title = player.progressAt ? `Progress last reported ${new Date(player.progressAt).toLocaleString()}` : 'No progress snapshot yet';
    cell(row, `${player.sessions} session${player.sessions === 1 ? '' : 's'} · ${player.activeDays} day${player.activeDays === 1 ? '' : 's'}${player.activeDays > 1 ? ' · returned' : ''}`);
    cell(row, stamp(player.firstSeen)).title = new Date(player.firstSeen).toLocaleString();
    cell(row, stamp(player.lastSeen)).title = new Date(player.lastSeen).toLocaleString();
    $('players').append(row);
  }
  if (!(data.players ?? []).length) rows($('players'), [], Array(6).fill(() => ''));
  $('playerCount').textContent = `${number(data.totals.installations)} player${data.totals.installations === 1 ? '' : 's'} · page ${playerPage + 1}`;
  $('playerPrev').disabled = demo || playerPage === 0;
  $('playerNext').disabled = demo || (playerPage + 1) * 50 >= data.totals.installations;
  rows($('progress'), data.progression, [x => x.name, x => x.category, x => number(x.starts), x => number(x.completes), x => number(x.failures), x => number(x.installations)]);
  rows($('loading'), data.loading, [x => x.name, x => number(x.samples), x => seconds(x.averageMs), x => seconds(x.p95Ms)]);
  $('freshness').textContent = data.totals.latest ? `Latest event · ${new Date(data.totals.latest).toLocaleString()}` : 'Waiting for the first production event';
  $('health').textContent = `Today · ${number(data.health.todayAccepted)} / ${number(data.health.dailyLimit)} event budget`;
}
const api = client.request;
let revision = 0;
async function refresh() {
  const current = ++revision;
  $('notice').textContent = demo ? 'DEMONSTRATION · Illustrative data, not player activity. Filters are disabled.' : 'Loading reports…';
  try {
    const data = demo ? (await import('./sample.js')).sample() : await api(`/api/analytics/report?${new URLSearchParams({ days: $('days').value, platform: $('platform').value, build: $('build').value, playerPage, playerSort: $('playerSort').value })}`);
    if (current !== revision) return;
    render(data); if (!demo) $('notice').textContent = data.totals.events ? '' : 'Collection is ready to receive events. No observations in this selection yet.';
  } catch (e) {
    if (current !== revision) return;
    $('notice').textContent = e.message;
    if (e.status === 401) { $('login').hidden = false; $('dashboard').hidden = true; }
    else { $('dashboard').hidden = true; }
  }
}
$('login').onsubmit = async e => {
  e.preventDefault();
  try { const password = $('password').value; $('password').value = ''; await client.signIn(password); await refresh(); }
  catch (error) { $('notice').textContent = error.message; }
};
$('logout').onclick = () => { ++revision; client.signOut(); $('dashboard').hidden = true; $('login').hidden = false; $('notice').textContent = 'Signed out on this tab.'; };
$('refresh').onclick = refresh;
$('playerPrev').onclick = () => { playerPage--; void refresh(); };
$('playerNext').onclick = () => { playerPage++; void refresh(); };
for (const id of ['days', 'platform', 'build', 'playerSort']) { $(id).onchange = () => { playerPage = 0; void refresh(); }; if (demo) $(id).disabled = true; }
if (demo) $('logout').hidden = true;
window.addEventListener('pagehide', () => { ++revision; $('dashboard').hidden = true; });
window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
void refresh();
