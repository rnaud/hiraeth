import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deploymentSecrets } from '../scripts/cloudflare-secrets.mjs';

test('rotating only the notebook password preserves a signing key configured on the Worker', () => {
  assert.deepEqual(deploymentSecrets({ HIRAETH_NOTES_PASSWORD: 'replacement', HIRAETH_ISSUES_TOKEN: '' }), { HIRAETH_NOTES_PASSWORD: 'replacement' });
  assert.deepEqual(deploymentSecrets({ HIRAETH_ISSUES_TOKEN: 'replacement-key', HIRAETH_NOTES_PASSWORD: '' }), { HIRAETH_ISSUES_TOKEN: 'replacement-key' });
});

test('deployment includes only supplied notebook credentials, without changing their bytes', () => {
  assert.deepEqual(deploymentSecrets({ HIRAETH_NOTES_PASSWORD: ' spaces matter ', HIRAETH_ISSUES_TOKEN: 'key', UNRELATED_SECRET: 'private' }), {
    HIRAETH_ISSUES_TOKEN: 'key', HIRAETH_NOTES_PASSWORD: ' spaces matter ',
  });
  assert.deepEqual(deploymentSecrets({ HIRAETH_NOTES_PASSWORD: '', HIRAETH_ISSUES_TOKEN: undefined }), {});
});

test('Cloudflare deployment uploads independently configured secrets through the private file helper', () => {
  const workflow = readFileSync(new URL('../.github/workflows/cloudflare.yml', import.meta.url), 'utf8');
  assert.match(workflow, /if \[ -n "\$HIRAETH_ISSUES_TOKEN" \] \|\| \[ -n "\$HIRAETH_NOTES_PASSWORD" \]; then/);
  assert.match(workflow, /node scripts\/cloudflare-secrets\.mjs "\$RUNNER_TEMP\/worker-secrets\.json"/);
  assert.match(workflow, /SECRETS=\(--secrets-file "\$RUNNER_TEMP\/worker-secrets\.json"\)/);
});
