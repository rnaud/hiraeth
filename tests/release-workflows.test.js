// Failed releases (docs/systems/android.md, "When a release fails"): every release call retried on a transient
// error (scripts/retry.sh), and the workflow_run deploys' outcome written on the tested commit
// (scripts/commit-status.sh).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const workflows = Object.fromEntries(readdirSync(join(root, '.github/workflows')).map((f) => [f, read(`.github/workflows/${f}`)]));

test('every release call in a workflow or publish script is retried', () => {
  const sh = { ...workflows, 'scripts/unity-publish.sh': read('scripts/unity-publish.sh') };
  for (const [name, text] of Object.entries(sh)) {
    if (name === 'xbox.yml') continue;   // (PowerShell: its own loop, below)
    for (const line of text.split('\n')) {
      if (!/\bgh release (create|upload|edit)\b/.test(line) || /^\s*#/.test(line)) continue;
      // either retried itself, or inside the android publish function that is retried as a whole
      const ok = /\bretry gh release/.test(line) || (name === 'android.yml' && /\|\| return 1$/.test(line));
      assert.ok(ok, `${name}: ${line.trim()}`);
    }
  }
  assert.match(workflows['android.yml'], /\. scripts\/retry\.sh\n\s*publish\(\) \{[\s\S]*?\n\s*\}\n\s*retry publish\n/);
  assert.match(workflows['xbox.yml'], /for \(\$attempt = 1; ; \$attempt\+\+\) \{[\s\S]*gh release upload xbox[\s\S]*Start-Sleep/);
  assert.match(workflows['cloudflare.yml'], /retry npx wrangler deploy/);
});

test('the workflow_run deploys write their outcome on the tested commit', () => {
  for (const [file, context] of [['android.yml', 'release: android'], ['steam-deck.yml', 'release: steam deck'], ['cloudflare.yml', 'release: web (cloudflare)']]) {
    const w = workflows[file];
    assert.match(w, /^ {2}workflow_run:/m, file);
    assert.match(w, /^permissions:\n(?: {2}.*\n)* {2}statuses: write/m, file);
    assert.match(w, /SHA: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/, file);
    assert.ok(w.includes(`run: |\n          scripts/commit-status.sh pending "${context}"`), file);
    assert.ok(w.includes(`        if: always()\n        env:\n          GH_TOKEN: \${{ github.token }}\n        run: |\n          scripts/commit-status.sh "\${{ job.status }}" "${context}"`), file);
  }
});

test('the Unity builds sign the CLI lookup and never fail on a cache prune', () => {
  const w = workflows['unity-android.yml'];
  const builders = w.match(/uses: game-ci\/unity-builder@v6\n {8}env:\n(?: {10}.*\n)+/g) || [];
  assert.equal(builders.length, (w.match(/uses: game-ci\/unity-builder@v6/g) || []).length);
  for (const b of builders) assert.match(b, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  const prunes = w.match(/- name: [^\n]*older entries deleted\)\n(?: {8}.*\n)+/g) || [];
  assert.equal(prunes.length, 3);
  for (const p of prunes) assert.match(p, /continue-on-error: true/);
});

// a fake command that fails the first N times with the given stderr, then succeeds
function fake(dir, failures, stderr) {
  const counter = join(dir, 'count');
  writeFileSync(counter, '0');
  const bin = join(dir, 'flaky');
  writeFileSync(bin, `#!/bin/sh\nn=$(cat "${counter}"); n=$((n + 1)); echo $n > "${counter}"\nif [ $n -le ${failures} ]; then echo "${stderr}" >&2; exit 3; fi\necho ok\n`);
  chmodSync(bin, 0o755);
  return { bin, count: () => Number(readFileSync(counter, 'utf8')) };
}
const runRetry = (cmd) => spawnSync('sh', ['-c', `. "${join(root, 'scripts/retry.sh')}"; retry ${cmd}`], { env: { ...process.env, RETRY_DELAYS: '0 0 0' }, encoding: 'utf8' });

test('retry: a transient error is tried again, up to four attempts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'retry-'));
  let f = fake(dir, 2, 'HTTP 403: Resource not accessible by integration');
  let r = runRetry(f.bin);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'ok');
  assert.equal(f.count(), 3);
  f = fake(dir, 9, 'HTTP 502: Bad Gateway');
  r = runRetry(f.bin);
  assert.equal(r.status, 3);
  assert.equal(f.count(), 4);
  assert.match(r.stderr, /HTTP 502/);
});

test('retry: an error that waiting will not fix stops at once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'retry-'));
  for (const code of [400, 401, 404, 422]) {
    const f = fake(dir, 9, `HTTP ${code}: nope`);
    const r = runRetry(f.bin);
    assert.equal(r.status, 3, String(code));
    assert.equal(f.count(), 1, String(code));
  }
});

test('commit-status maps the job status and never fails the job', () => {
  const dir = mkdtempSync(join(tmpdir(), 'status-'));
  const log = join(dir, 'calls');
  // a gh that records its arguments (and fails, for the last case)
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\necho "$@" >> "${log}"\n[ -z "$GH_FAIL" ]\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, SHA: 'abc123', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '42', RETRY_DELAYS: '0' };
  const run = (state, extra = {}) => execFileSync(join(root, 'scripts/commit-status.sh'), [state, 'release: android'], { env: { ...env, ...extra }, encoding: 'utf8' });
  for (const [job, state] of [['pending', 'pending'], ['success', 'success'], ['failure', 'failure'], ['cancelled', 'error']]) {
    writeFileSync(log, '');
    run(job);
    const call = readFileSync(log, 'utf8');
    assert.match(call, /^api repos\/o\/r\/statuses\/abc123 /, job);
    assert.ok(call.includes(`state=${state} `), job);
    assert.ok(call.includes('context=release: android'), job);
    assert.ok(call.includes('target_url=https://github.com/o/r/actions/runs/42'), job);
  }
  writeFileSync(log, '');
  assert.match(run('failure', { GH_FAIL: '1' }), /::warning::couldn't set the commit status/);
  assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 2);   // (retried once with RETRY_DELAYS=0)
});
