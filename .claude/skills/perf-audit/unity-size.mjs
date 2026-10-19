// The Unity packages' sizes by what they carry (.claude/skills/perf-audit/SKILL.md, step 1; issue #500): the APK
// (hiraeth-unity.apk), the Linux player (hiraeth-unity-linux.tar.gz, the Deck's) or the Xbox's .msix, or a player's
// folder. Each area: the shaders and settings (globalgamemanagers.assets), Unity's built-in resources
// (unity_builtin_extra), the engine, the game's C# (IL2CPP), Puerts' V8, the JS bundle, the music, bodies and
// animations, the pipeline lists, pictures, the Android app's own, the build's leftovers. With --against <previous
// json>, the change for each; with --check, a non-zero exit when the package breaks a rule (`problems` below).
//   gh release download v1.85 -p hiraeth-unity.apk -D <scratch>
//   node .claude/skills/perf-audit/unity-size.mjs <scratch>/hiraeth-unity.apk [--out apk.json] [--against old.json] [--check]
// (an .msix inside the Xbox's zip: unzip it first. A .tar.gz gives its sizes uncompressed only.)
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The areas, first match wins (a package's path, any platform's layout). */
export const AREAS = [
  ['build leftovers (never to ship)', /_BackUpThisFolder_ButDontShipItWithYourGame|_BurstDebugInformation_DoNotShip/],
  ['shaders and settings (globalgamemanagers.assets)', /globalgamemanagers\.assets(\.split\d+|\.resS)?$/],
  ['built-in resources (unity_builtin_extra)', /unity_builtin_extra$/],
  ['game code (IL2CPP)', /(libil2cpp\.so|GameAssembly\.(so|dll)|global-metadata\.dat|lib_burst_generated\.(so|dll))$|il2cpp_data\//],
  ['V8 (Puerts)', /(libPapiV8\.so|PapiV8\.dll|libPuertsCore\.so|PuertsCore\.dll)$/],
  ['engine', /(libunity\.so|UnityPlayer\.(so|dll)|libmain\.so|unity default resources|D3D12Core\.dll|libc\+\+_shared\.so)$/],
  ['JS bundle', /hiraeth-js\/[^/]+\.c?js$/],
  ['music', /\/music\/[^/]+\.mp3$/],
  ['bodies, guardians and animations', /hiraeth-js\/public\/(anim|characters|guardians)\//],
  ['pipeline lists', /hiraeth-pso\//],
  ['pictures', /hiraeth-js\/(title|item-pictures|starmap|map-marks)\//],
  ['Android app (dex, resources)', /^(classes\d*\.dex|res\/|resources\.arsc|kotlin\/|META-INF\/|AndroidManifest\.xml)/],
  ['other', /./],
];
export const areaOf = (path) => AREAS.find(([, re]) => re.test(path))[0];

/** Unity's own built-in resources: under 2 MiB (0.7 MB in v1.85 once the dead shader copies were gone, issue #500). */
export const BUILTIN_EXTRA_MAX = 2 * 2 ** 20;

/** Entries ({ path, bytes, packed? }) summed by area, the biggest files kept. */
export function summarise(entries) {
  const areas = Object.fromEntries(AREAS.map(([n]) => [n, { files: 0, bytes: 0, packed: 0 }]));
  let bytes = 0, packed = 0;
  for (const e of entries) {
    const a = areas[areaOf(e.path)];
    a.files++; a.bytes += e.bytes; a.packed += e.packed ?? e.bytes;
    bytes += e.bytes; packed += e.packed ?? e.bytes;
  }
  const biggest = [...entries].sort((a, b) => (b.packed ?? b.bytes) - (a.packed ?? a.bytes)).slice(0, 15);
  return { files: entries.length, bytes, packed, areas, biggest };
}

/**
 * What a package must not carry: the build's leftovers (IL2CPP's C++ and symbols: the Deck's installer never unpacks
 * them, they only made the download three times bigger), and a unity_builtin_extra over BUILTIN_EXTRA_MAX (the
 * project's shaders written into it again, dead copies under one object id: BridgeBuild.KeepShaders).
 */
export function problems(summary, entries) {
  const out = [];
  const left = summary.areas['build leftovers (never to ship)'];
  if (left.files) out.push(`the build's leftovers ship: ${left.files} files, ${(left.bytes / 2 ** 20).toFixed(1)} MB (*_BackUpThisFolder_ButDontShipItWithYourGame)`);
  for (const e of entries) {
    if (/unity_builtin_extra$/.test(e.path) && e.bytes > BUILTIN_EXTRA_MAX)
      out.push(`${e.path} is ${(e.bytes / 2 ** 20).toFixed(1)} MB (over ${BUILTIN_EXTRA_MAX / 2 ** 20} MB): the project's shaders always included again? (BridgeBuild.KeepShaders, issue #500)`);
  }
  return out;
}

/** A package's entries: a zip (APK, msix, zip) by zipinfo, a .tar.gz by tar, or a folder walked. */
export function readPackage(file) {
  if (statSync(file).isDirectory()) {
    const out = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f), s = statSync(p); s.isDirectory() ? walk(p) : out.push({ path: relative(file, p), bytes: s.size }); } };
    walk(file);
    return out;
  }
  if (/\.(tar\.gz|tgz)$/.test(file)) {
    const text = execFileSync('tar', ['tvzf', file], { maxBuffer: 1 << 28 }).toString();
    return text.split('\n').filter((l) => l.startsWith('-')).map((l) => {
      const p = l.trim().split(/\s+/);
      return { path: p.slice(8).join(' '), bytes: Number(p[4]) };
    });
  }
  const text = execFileSync('zipinfo', ['-l', file], { maxBuffer: 1 << 28 }).toString();
  return text.split('\n').filter((l) => l.startsWith('-')).map((l) => {
    const p = l.trim().split(/\s+/);
    return { path: p.slice(9).join(' '), bytes: Number(p[3]), packed: Number(p[5]) };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arg = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
  const file = args.find((a, i) => !a.startsWith('--') && !['--out', '--against'].includes(args[i - 1]));
  if (!file) { console.error('usage: unity-size.mjs <package or folder> [--out json] [--against json] [--check]'); process.exit(2); }
  const entries = readPackage(file);
  const sum = { file, date: new Date().toISOString(), ...summarise(entries) };
  const old = arg('against') ? JSON.parse(readFileSync(arg('against'), 'utf8')) : null;
  const MB = (b) => `${(b / 2 ** 20).toFixed(2)} MB`;
  const delta = (now, was) => (was == null ? '' : `  (${now >= was ? '+' : ''}${((now - was) / 2 ** 20).toFixed(2)})`);
  console.log(`${file}: ${sum.files} files, ${MB(sum.packed)} packed, ${MB(sum.bytes)} unpacked${delta(sum.packed, old?.packed)}`);
  for (const [n, a] of Object.entries(sum.areas).sort((x, y) => y[1].packed - x[1].packed)) {
    if (!a.files && !old?.areas?.[n]?.files) continue;
    console.log(`  ${MB(a.packed).padStart(10)} ${MB(a.bytes).padStart(10)}  ${n}${delta(a.packed, old?.areas?.[n]?.packed)}`);
  }
  console.log('  biggest:');
  for (const e of sum.biggest) console.log(`  ${MB(e.packed ?? e.bytes).padStart(10)}  ${e.path}`);
  if (arg('out')) writeFileSync(arg('out'), JSON.stringify(sum, null, 1));
  const bad = problems(sum, entries);
  for (const p of bad) console.log(`PROBLEM: ${p}`);
  if (args.includes('--check') && bad.length) process.exit(1);
}
