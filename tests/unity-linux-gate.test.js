// The Linux player's gates before it is published (the Unity-default plan's D12, docs/systems/unity-updates.md): its
// smoke run under Xvfb and lavapipe (scripts/unity-linux-smoke.sh) and the unit suite on its commit
// (scripts/wait-tests.sh), both before scripts/unity-publish.sh in .github/workflows/unity-android.yml's linux job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the Linux player is published only after its smoke run and the unit suite on its commit (D12)', () => {
  const yml = src('.github/workflows/unity-android.yml');
  const linux = yml.slice(yml.indexOf('\n  linux:'));
  const smoke = linux.indexOf('scripts/unity-linux-smoke.sh'), wait = linux.indexOf('scripts/wait-tests.sh'), publish = linux.indexOf('scripts/unity-publish.sh linux');
  assert.ok(smoke > 0 && smoke < wait && wait < publish, 'the smoke run, then the suite, then the release');
  assert.match(linux, /xvfb mesa-vulkan-drivers libvulkan1/, 'Xvfb and lavapipe on the runner');
  const s = src('scripts/unity-linux-smoke.sh');
  assert.match(s, /lvp_icd/, 'Mesa\'s software Vulkan');
  assert.match(s, /-no-updates -level desert -views "\$ROOT\/scripts\/bench\/viewpoints\.json" -only spawn/, 'the desert\'s spawn drawn, nothing downloaded');
  assert.match(s, /XDG_CONFIG_HOME="\$OUT\/profile"/, 'a profile of its own');
  assert.match(s, /stdev/, 'a picture that isn\'t one colour');
  assert.ok(JSON.parse(src('scripts/bench/viewpoints.json')).views.some((v) => v.name === 'spawn'));
  const w = src('scripts/wait-tests.sh');
  assert.match(w, /actions\/workflows\/tests\.yml\/runs\?head_sha=\$SHA&event=push/);
  assert.match(w, /"completed success"\) .*exit 0/);
  for (const f of ['scripts/unity-linux-smoke.sh', 'scripts/wait-tests.sh']) assert.ok(statSync(new URL(`../${f}`, import.meta.url)).mode & 0o111, `${f} runs`);
});
