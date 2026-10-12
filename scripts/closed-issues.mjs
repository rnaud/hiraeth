#!/usr/bin/env node
// The closed GitHub issues, kept offline for tests/todo-done.test.js (issue #175): the tests can't ask GitHub, so this
// writes the numbers of every closed issue of rnaud/hiraeth to tests/closed-issues.json, and lists the open TODO.md
// items that link one of them (move each to DONE.md, ticked, with how it closed). Run it whenever issues close (in the
// hourly issue check, say); `--check` only lists, writing nothing.
//
//   node scripts/closed-issues.mjs [--check]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const FILE = new URL('tests/closed-issues.json', ROOT);
const REPO = 'rnaud/hiraeth';

const list = JSON.parse(execFileSync('gh', ['issue', 'list', '--repo', REPO, '--state', 'closed', '--limit', '5000', '--json', 'number'], { encoding: 'utf8' }));
const closed = [...new Set(list.map((i) => i.number))].sort((a, b) => a - b);
if (!closed.length) throw new Error('gh listed no closed issues: not writing an empty list');
if (!process.argv.includes('--check')) {
  writeFileSync(FILE, `${JSON.stringify({ repo: REPO, refreshed: new Date().toISOString().slice(0, 10), closed })}\n`);
  console.log(`tests/closed-issues.json: ${closed.length} closed issues`);
}
const shut = new Set(closed);
const stale = [...readFileSync(new URL('TODO.md', ROOT), 'utf8').matchAll(/^\s*- \[ \] \[#(\d+)\].*$/gm)].filter((m) => shut.has(+m[1]));
for (const m of stale) console.log(`TODO.md still lists closed #${m[1]}: ${m[0].trim().slice(0, 100)}`);
if (stale.length) process.exitCode = 1;
