import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Omitted secrets stay on the Worker. Never upload empty values for credentials
// which are configured directly in Cloudflare instead of GitHub Actions.
export function deploymentSecrets(env) {
  return Object.fromEntries(['HIRAETH_ISSUES_TOKEN', 'HIRAETH_NOTES_PASSWORD']
    .filter(name => typeof env[name] === 'string' && env[name].length > 0)
    .map(name => [name, env[name]]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('A private secrets-file path is required');
  writeFileSync(process.argv[2], JSON.stringify(deploymentSecrets(process.env)), { mode: 0o600, flag: 'wx' });
}
