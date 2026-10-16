// The Linux player's gate before it is published (the Unity-default plan's D12, docs/systems/unity-updates.md): the
// unit suite on its commit (scripts/wait-tests.sh), before scripts/unity-publish.sh in .github/workflows/unity-android.yml's
// linux job. (Its smoke run under lavapipe was removed: Unity's player refuses the runner's software Vulkan.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the Linux player is published only after the unit suite on its commit (D12)', () => {
  const yml = src('.github/workflows/unity-android.yml');
  const linux = yml.slice(yml.indexOf('\n  linux:'));
  const wait = linux.indexOf('scripts/wait-tests.sh'), publish = linux.indexOf('scripts/unity-publish.sh linux');
  assert.ok(wait > 0 && wait < publish, 'the suite, then the release');
  assert.ok(!linux.includes('scripts/unity-linux-smoke.sh'), 'no smoke run on the runner');
  const w = src('scripts/wait-tests.sh');
  assert.match(w, /actions\/workflows\/tests\.yml\/runs\?head_sha=\$SHA&event=push/);
  assert.match(w, /"completed success"\) .*exit 0/);
  for (const f of ['scripts/wait-tests.sh']) assert.ok(statSync(new URL(`../${f}`, import.meta.url)).mode & 0o111, `${f} runs`);
});
