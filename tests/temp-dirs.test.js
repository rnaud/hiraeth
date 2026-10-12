// Temporary profiles and directories are removed however a run ends (scripts/temp-dirs.mjs; issue #220: headless
// Chrome profiles left by failed, timed-out and stopped runs filled 17 GB of TMPDIR in a day). A child process makes
// a profile with the helper, starts a stand-in browser (and, where Chrome is installed, a real headless one) and
// ends every way a run ends; nothing of it may be left. And every test and script that makes a temp dir or starts
// a browser with a profile goes through the helper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tempDir } from '../scripts/temp-dirs.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HELPER = pathToFileURL(join(ROOT, 'scripts/temp-dirs.mjs')).href;
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/**
 * Run a child that makes a profile in `base` with the helper and owns a browser in it, then ends by `how`:
 * { profile, pid, code, signal } once it has gone.
 */
async function run(base, how, { chrome = false } = {}) {
  const browser = chrome
    ? `spawn(${JSON.stringify(CHROME)}, ['--headless=new', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' })`
    : `spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })`;
  const src = `
    import { spawn } from 'node:child_process';
    import { writeFileSync, readdirSync } from 'node:fs';
    import { tempDir, ownProcess } from ${JSON.stringify(HELPER)};
    const profile = tempDir('leak-check-', ${JSON.stringify(base)});
    writeFileSync(profile + '/Cookies', 'x'.repeat(4096));
    const proc = ownProcess(${browser});
    // (a real Chrome: until it has written its profile)
    for (let i = 0; i < 100 && ${chrome} && readdirSync(profile).length < 3; i++) await new Promise((r) => setTimeout(r, 100));
    console.log(JSON.stringify({ profile, pid: proc.pid }));
    const how = ${JSON.stringify(how)};
    if (how === 'own SIGINT') process.on('SIGINT', () => setTimeout(() => process.exit(130), 100));
    if (how === 'throw') throw new Error('a failed run');
    if (how === 'reject') Promise.reject(new Error('a failed run'));
    if (how === 'exit') process.exit(3);
    if (how === 'end') { proc.unref(); }
    else setInterval(() => {}, 1000);   // (waits for the signal, as a long capture would)
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', src], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const gone = new Promise((r) => child.once('exit', (code, signal) => r({ code, signal })));
  for (let i = 0; i < 200 && !out.includes('\n'); i++) await sleep(50);
  const info = JSON.parse(out.split('\n')[0]);
  if (/SIG/.test(how)) child.kill(how.replace('own ', ''));
  let timer;
  const end = await Promise.race([gone, new Promise((r) => { timer = setTimeout(() => r(null), 15000); })]);
  clearTimeout(timer);
  if (!end) child.kill('SIGKILL');
  for (let i = 0; i < 40 && alive(info.pid); i++) await sleep(50);
  return { ...info, ...end };
}

test('a temp profile and the browser in it are gone however the run ends', async () => {
  const base = tempDir('hiraeth-temp-dirs-test-');
  for (const how of ['end', 'throw', 'reject', 'exit', 'SIGINT', 'SIGTERM', 'SIGHUP', 'own SIGINT']) {
    const r = await run(base, how);
    assert.ok(r.code !== undefined, `${how}: the run ended`);
    assert.ok(!existsSync(r.profile), `${how}: ${r.profile} left behind`);
    assert.ok(!alive(r.pid), `${how}: the browser ${r.pid} still runs`);
    if (how === 'SIGINT' || how === 'own SIGINT') assert.equal(r.code, 130, `${how}: ends as stopped`);
  }
  assert.deepEqual(readdirSync(base), [], 'nothing new in the temp dir');
});

test('a real headless Chrome stopped mid-run leaves no profile behind', { skip: !CHROME || !!process.env.CI ? 'no Chrome here' : false }, async () => {
  const base = tempDir('hiraeth-temp-dirs-chrome-');
  for (const how of ['SIGINT', 'throw']) {
    const r = await run(base, how, { chrome: true });
    assert.ok(!existsSync(r.profile), `${how}: ${r.profile} left behind`);
    assert.ok(!alive(r.pid), `${how}: Chrome ${r.pid} still runs`);
  }
  assert.deepEqual(readdirSync(base), [], 'nothing new in the temp dir');
});

test('every test and script that makes a temp dir or starts a browser with a profile removes it through scripts/temp-dirs.mjs', () => {
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n.startsWith('.') && n !== '.claude') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(m?js)$/.test(n)) files.push(p);
    }
  };
  for (const d of ['scripts', 'tools', 'tests', '.claude/skills']) if (existsSync(join(ROOT, d))) walk(join(ROOT, d));
  const bad = [];
  for (const p of files) {
    const rel = relative(ROOT, p);
    if (rel === 'scripts/temp-dirs.mjs' || rel === 'tests/temp-dirs.test.js') continue;
    const src = readFileSync(p, 'utf8');
    const lines = src.split('\n');
    lines.forEach((l, i) => {
      // (an output kept for the author to look at says so on its line)
      if (/mkdtempSync\(/.test(l) && !/temp-dirs: an output/.test(l)) bad.push(`${rel}:${i + 1}: mkdtempSync (use tempDir)`);
      if (/join\(tmpdir\(\), `[^`]*\$\{process\.pid\}/.test(l) && !/tempPath\(/.test(l)) bad.push(`${rel}:${i + 1}: a temp file of its own naming (wrap it in tempPath)`);
    });
    if (/--user-data-dir/.test(src) && !/ownProcess\(/.test(src)) bad.push(`${rel}: a browser with a profile not owned (ownProcess)`);
    if (/launchPersistentContext\(/.test(src) && !/tempPath\(/.test(src)) bad.push(`${rel}: a persistent profile not registered (tempPath)`);
  }
  assert.deepEqual(bad, []);
});
