#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const relevantUnityInput = path => /^(src|public|engine|unity|scripts|data)\//.test(path) || /^(package(?:-lock)?\.json|index\.html|vite\.config\.[^/]+|\.github\/workflows\/unity-android\.yml)$/.test(path);
export function successfulPlayers(jobs) {
  return ['android', 'linux'].every(name => jobs.some(j => j.name === name && j.status === 'completed' && j.conclusion === 'success'));
}
async function apiJson(url, { token, request }) {
  const response = await request(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error(`Unity build history API failed (${response.status}); no skip decision made`);
  return response.json();
}
export async function builtBaseline({ repository, head, runId, git, token, api = 'https://api.github.com', request = fetch }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw Error('Repository and history token required for scheduled Unity decision');
  const options = { token, request }, root = `${api}/repos/${repository}/actions`;
  for (let page = 1; page <= 10; page++) {
    const result = await apiJson(`${root}/workflows/unity-android.yml/runs?branch=main&status=success&per_page=100&page=${page}`, options);
    if (!Array.isArray(result.workflow_runs)) throw Error('Malformed Unity history response');
    for (const run of result.workflow_runs) {
      if (String(run.id) === String(runId) || run.path !== '.github/workflows/unity-android.yml' || run.head_branch !== 'main' || run.head_repository?.full_name !== repository || run.status !== 'completed' || run.conclusion !== 'success' || !/^[a-f0-9]{40}$/.test(run.head_sha ?? '')) continue;
      if (!Number.isSafeInteger(run.id) || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) throw Error('Unity run identity/attempt unavailable');
      try { git('rev-parse', '--verify', `${run.head_sha}^{commit}`); git('merge-base', '--is-ancestor', run.head_sha, head); } catch { continue; }
      const jobs = [];
      for (let jobPage = 1; jobPage <= 10; jobPage++) {
        const batch = await apiJson(`${root}/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${jobPage}`, options);
        if (!Array.isArray(batch.jobs)) throw Error('Malformed Unity job response');
        jobs.push(...batch.jobs);
        if (batch.jobs.length < 100) break;
        if (jobPage === 10) throw Error('Unity job history exceeds bounded lookup');
      }
      // A green check job with both builds skipped is not a packaged-player baseline.
      if (successfulPlayers(jobs)) return { sha: run.head_sha, runId: run.id, attempt: run.run_attempt, url: run.html_url };
    }
    if (result.workflow_runs.length < 100) return null;
  }
  throw Error('Unity build history exceeds bounded lookup; no skip decision made');
}
export async function unityReleasePlan({ event, head, git, ...options }) {
  head = git('rev-parse', '--verify', `${head}^{commit}`).trim();
  if (event === 'workflow_dispatch') return { build: true, head, baseline: null, reason: 'manual-request', changed: null };
  if (event !== 'schedule') throw Error('Unity planning supports schedule or explicit workflow_dispatch only');
  const baseline = await builtBaseline({ ...options, head, git });
  if (!baseline) return { build: true, head, baseline: null, reason: 'no-successful-paired-player-baseline', changed: null };
  // --no-renames includes both old and new names, including moves out of relevant trees.
  const changed = git('diff', '--name-only', '-z', '--no-renames', baseline.sha, head, '--').split('\0').filter(Boolean).filter(relevantUnityInput).sort();
  return { build: changed.length > 0, head, baseline, reason: changed.length ? 'relevant-inputs-changed' : 'paired-players-current', changed };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--receipt')) throw Error('Usage: unity-release-plan.mjs [--receipt path]');
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const head = git('rev-parse', 'HEAD').trim();
  if (process.env.GITHUB_SHA && head !== process.env.GITHUB_SHA) throw Error('Unity plan checkout does not match workflow source');
  const plan = await unityReleasePlan({ event: process.env.GITHUB_EVENT_NAME, head, git, repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID, token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN, api: process.env.GITHUB_API_URL });
  const receipt = JSON.stringify(plan, null, 2) + '\n';
  writeFileSync(args[1] ?? 'unity-release-plan.json', receipt); console.log(receipt);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `build=${plan.build}\nsource_head=${plan.head}\nbaseline_sha=${plan.baseline?.sha ?? ''}\nreason=${plan.reason}\n`);
}
