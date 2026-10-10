// The Unity bridge's Xbox package from the Mac, through the console's Device Portal (docs/systems/xbox.md, "The Unity
// build on the Xbox").
//
//   node scripts/xbox-unity.mjs install <dir>   → installs the .msix in <dir> with every .appx beside it (the unpacked
//                                                 memento-unity-xbox.zip of the unity-xbox prerelease), waits till done
//   node scripts/xbox-unity.mjs launch          → starts the installed rnaud.HiraethUnity
//   node scripts/xbox-unity.mjs stop            → stops it
//   node scripts/xbox-unity.mjs uninstall       → removes rnaud.HiraethUnity (only that package: never rnaud.Hiraeth)
//   node scripts/xbox-unity.mjs log [prev]      → LocalState\unity.log (or unity.prev.log, the launch before)
//   node scripts/xbox-unity.mjs packages        → the installed Hiraeth packages
//
// XBOX_PORTAL (default https://192.168.68.64:11443) says which console. The portal's certificate is self-signed: TLS
// checks are off here. The portal checks a CSRF token on writes: the CSRF-Token cookie of a first GET, sent back as
// the X-CSRF-Token header.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const PORTAL = process.env.XBOX_PORTAL ?? 'https://192.168.68.64:11443';
const FAMILY = 'rnaud.HiraethUnity';
const [cmd = 'log', a1] = process.argv.slice(2);

let cookie = '', csrf = '';
async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${PORTAL}${path}`, { method, body, headers: { ...headers, ...(cookie ? { cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) } });
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';');
    cookie = [...cookie.split('; ').filter((x) => x && !x.startsWith(kv.split('=')[0] + '=')), kv].join('; ');
    if (kv.startsWith('CSRF-Token=')) csrf = kv.slice('CSRF-Token='.length);
  }
  return r;
}
const json = async (path, opts) => { const r = await call(path, opts); if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`); return r.json(); };

async function installed() {
  const r = await json('/api/app/packagemanager/packages');
  return r.InstalledPackages.filter((p) => p.PackageFamilyName?.startsWith('rnaud.Hiraeth'));
}
async function unityPackage() {
  const p = (await installed()).find((x) => x.PackageFamilyName.startsWith(FAMILY));
  if (!p) throw new Error(`${FAMILY} is not installed on the console`);
  return p;
}
const b64 = (s) => Buffer.from(s).toString('base64');

if (cmd === 'packages') {
  for (const p of await installed()) console.log(`${p.PackageFullName}  ${p.Name}  (${p.PackageRelativeId})`);
} else if (cmd === 'install') {
  if (!a1) throw new Error('install <dir>: the unpacked memento-unity-xbox.zip');
  const files = readdirSync(a1);
  const msix = files.find((f) => /\.(msix|appx)$/i.test(f) && /^memento-unity-xbox/i.test(f));
  if (!msix) throw new Error(`no memento-unity-xbox.msix in ${a1}`);
  const form = new FormData();
  form.append(msix, new Blob([readFileSync(join(a1, msix))]), msix);
  for (const f of files.filter((f) => /\.appx$/i.test(f) && f !== msix)) form.append(f, new Blob([readFileSync(join(a1, f))]), basename(f));
  await call('/api/app/packagemanager/packages');   // (the CSRF cookie)
  const t0 = Date.now();
  const r = await call(`/api/app/packagemanager/package?package=${encodeURIComponent(msix)}`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`install: ${r.status} ${await r.text()}`);
  console.log(`uploaded ${msix} with ${files.filter((f) => /\.appx$/i.test(f) && f !== msix).length} dependencies in ${((Date.now() - t0) / 1000).toFixed(1)} s; installing…`);
  for (;;) {
    await new Promise((res) => setTimeout(res, 1500));
    const s = await call('/api/app/packagemanager/state');
    if (s.status === 204) continue;   // (still installing)
    const body = await s.text();
    if (!s.ok) throw new Error(`install failed: ${s.status} ${body}`);
    console.log(`installed in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${body || 'ok'}`);
    break;
  }
  const p = await unityPackage();
  console.log(p.PackageFullName);
} else if (cmd === 'uninstall') {
  // (the Unity package only: never rnaud.Hiraeth, whose LocalState holds the web game's saves)
  const p = await unityPackage();
  if (!p.PackageFullName.startsWith(`${FAMILY}_`)) throw new Error(`refusing to uninstall ${p.PackageFullName}`);
  await call('/api/app/packagemanager/packages');
  const r = await call(`/api/app/packagemanager/package?package=${encodeURIComponent(p.PackageFullName)}`, { method: 'DELETE' });
  console.log(`uninstall ${p.PackageFullName}: ${r.status} ${await r.text()}`);
} else if (cmd === 'launch' || cmd === 'stop') {
  const p = await unityPackage();
  await call('/api/app/packagemanager/packages');
  const q = cmd === 'launch' ? `appid=${b64(p.PackageRelativeId)}&package=${b64(p.PackageFullName)}` : `package=${b64(p.PackageFullName)}`;
  const r = await call(`/api/taskmanager/app?${q}`, { method: cmd === 'launch' ? 'POST' : 'DELETE' });
  console.log(`${cmd} ${p.PackageFullName}: ${r.status} ${await r.text()}`);
} else if (cmd === 'log') {
  const p = await unityPackage();
  const name = a1 === 'prev' ? 'unity.prev.log' : 'unity.log';
  const r = await call(`/api/filesystem/apps/file?knownfolderid=LocalAppData&packagefullname=${encodeURIComponent(p.PackageFullName)}&filename=${name}&path=${encodeURIComponent('\\LocalState')}`);
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
  process.stdout.write(await r.text());
} else throw new Error(`unknown: ${cmd}`);
