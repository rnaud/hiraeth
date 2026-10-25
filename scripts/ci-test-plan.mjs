#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testFiles } from './test-shards.mjs';

// Explicit event ranges, never HEAD^: a push may contain many commits.
export function eventRange({ eventName, event, head, full = false, mainBaseline = null, git }) {
  const commit = ref => git('rev-parse', '--verify', `${ref}^{commit}`).trim();
  head = commit(head);
  if (full || eventName === 'schedule') return { head, base: null, full: true };
  if (eventName === 'push') {
    if (event.after !== head) throw Error('Push checkout differs from event head');
    // Pending runs can be replaced by concurrency; failed runs prove nothing.
    // Cover both the immediate push and every change since a proven green ancestor.
    if (!mainBaseline || !/^[a-f0-9]{40}$/.test(event.before ?? '') || /^0+$/.test(event.before)) return { head, base: null, full: true };
    try {
      const before = commit(event.before), green = commit(mainBaseline.sha);
      git('merge-base', '--is-ancestor', green, head);
      return { head, base: commit(git('merge-base', before, green).trim()), full: false };
    } catch { return { head, base: null, full: true }; }
  }
  if (eventName === 'pull_request') {
    const base = commit(event.pull_request.base.sha), branch = commit(event.pull_request.head.sha);
    return { head, base: commit(git('merge-base', base, branch).trim()), full: false };
  }
  if (eventName === 'workflow_dispatch') {
    const main = commit('refs/remotes/origin/main');
    if (main === head) return { head, base: null, full: true };
    return { head, base: commit(git('merge-base', main, head).trim()), full: false };
  }
  throw Error(`Unsupported affected-test event: ${eventName}; reusable callers must request full`);
}
/** Only exact successful main push Tests runs from this repository prove a baseline. */
export function provenBaseline(runs, { repository, head, runId, git }) {
  for (const r of runs) {
    if (String(r.id) === String(runId) || r.name !== 'Tests' || r.path !== '.github/workflows/tests.yml' || r.event !== 'push' || r.head_branch !== 'main' || r.conclusion !== 'success' || r.status !== 'completed' || r.head_repository?.full_name !== repository || !/^[a-f0-9]{40}$/.test(r.head_sha ?? '')) continue;
    try {
      git('rev-parse', '--verify', `${r.head_sha}^{commit}`);
      git('merge-base', '--is-ancestor', r.head_sha, head);
      return { sha: r.head_sha, runId: r.id, url: r.html_url };
    } catch { /* Missing/non-ancestor history cannot prove this run. */ }
  }
  return null;
}
export async function lastSuccessfulMain({ repository, head, runId, git, token, api = 'https://api.github.com', request = fetch }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) return null;
  try {
    for (let page = 1; page <= 10; page++) {
      const response = await request(`${api}/repos/${repository}/actions/workflows/tests.yml/runs?branch=main&event=push&status=success&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      const { workflow_runs: runs } = await response.json();
      if (!Array.isArray(runs)) return null;
      const baseline = provenBaseline(runs, { repository, head, runId, git });
      if (baseline) return baseline;
      if (runs.length < 100) return null;
    }
  } catch { /* API outage/permission/rate limit: full suite, never partial/empty. */ }
  return null;
}
export function validateTests(files, available) {
  if (!Array.isArray(files) || files.some(f => typeof f !== 'string' || !available.includes(f)) || new Set(files).size !== files.length) throw Error('Invalid selected test list');
  return [...files].sort();
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const head = git('rev-parse', 'HEAD').trim();
  const mainBaseline = process.env.GITHUB_EVENT_NAME === 'push' && process.env.FULL_SUITE !== 'true'
    ? await lastSuccessfulMain({ repository: process.env.GITHUB_REPOSITORY, head, runId: process.env.GITHUB_RUN_ID, git, token: process.env.GITHUB_TOKEN, api: process.env.GITHUB_API_URL }) : null;
  const range = eventRange({ eventName: process.env.GITHUB_EVENT_NAME, event, head, full: process.env.FULL_SUITE === 'true', mainBaseline, git });
  const args = range.full ? ['--all', '--json'] : ['--base', range.base, '--head', range.head, '--json'];
  const files = validateTests(JSON.parse(execFileSync(process.execPath, ['scripts/affected-tests.mjs', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })), testFiles());
  if (range.full && JSON.stringify(files) !== JSON.stringify(testFiles())) throw Error('Full selector did not enumerate the complete suite');
  const receipt = JSON.stringify({ event: process.env.GITHUB_EVENT_NAME, ...range, successfulMain: mainBaseline, count: files.length, files }, null, 2);
  console.log(receipt);
  writeFileSync('test-selection.json', receipt + '\n');
  appendFileSync(process.env.GITHUB_OUTPUT, `files=${JSON.stringify(files)}\nhead=${range.head}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Test selection\nHead: ${range.head}\n\nBase: ${range.base ?? 'explicit full suite'}\n\n${files.length} selected test files across four balanced shards.\n`);
}
