// The cache key of Puerts' IL2CPP glue for the Xbox build (.github/workflows/unity-xbox.yml; docs/systems/xbox.md,
// "The workflow's caches"): a hash of what the glue is made from, not of every C# file.
//   node scripts/unity-glue-key.mjs          → a sha256 (hex)
// BridgeBuild.Il2cpp runs Puerts' "Minimal Bridge, Reflection Mode" (CSharpFileExporter.GenAll(onlyConfigure: true,
// noWrapper: true)): its bridges and value types come from the [Configure] classes' [Binding] lists (their delegates and
// the value types they reach) and from the JsEnv.UsingAction / UsingFunc calls in any assembly; link.xml and the
// extension-method infos from the same lists. The script's own C# otherwise reaches the engine by reflection, so a C#
// edit that touches none of these makes the same glue. The hash covers:
//   - the lines of the project's C# (Assets, not Assets/Gen) that configure Puerts or call UsingAction / UsingFunc, with their file;
//   - BridgeBuild.GenerateGlue (what is run, and the patch it applies for this il2cpp);
//   - Packages/manifest.json, and this file.
// Puerts' version and Unity's are in the key's own prefix (the workflow's UNITY_VERSION, Puerts 3.0.3).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Puerts' configuration attributes and the generic calls the generator scans IL for
export const GLUE_LINE = /\[\s*(?:Puerts\.)?(?:Configure|Binding|BlittableCopy|Filter|Typing|CodeOutputDirectory)\b|\bPuerts\.(?:Configure|Binding|BlittableCopy|Filter)\b|\bUsing(?:Action|Func)\s*</;

function csFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) csFiles(p, out);
    else if (e.name.endsWith('.cs')) out.push(p);
  }
  return out;
}

/** The glue's inputs, as text (what is hashed): `project` is the Unity project (unity/Hiraeth). */
export function glueInputs(project, self = readFileSync(fileURLToPath(import.meta.url), 'utf8')) {
  const assets = join(project, 'Assets');
  const parts = ['key script\n' + self.replace(/\r\n/g, '\n')];
  for (const f of csFiles(assets)) {
    const rel = relative(project, f).split(sep).join('/');
    if (rel.startsWith('Assets/Gen/')) continue;
    const text = readFileSync(f, 'utf8');
    const lines = text.split(/\r?\n/).filter((l) => GLUE_LINE.test(l)).map((l) => l.trim());
    if (lines.length) parts.push(`${rel}\n${lines.join('\n')}`);
    if (rel.endsWith('/BridgeBuild.cs')) {
      const i = text.indexOf('static bool GenerateGlue()');
      if (i < 0) throw new Error(`${rel}: no GenerateGlue()`);
      const j = text.indexOf('\n        static ', i + 1);
      parts.push(`${rel} GenerateGlue\n${text.slice(i, j < 0 ? undefined : j).replace(/\r\n/g, '\n')}`);
    }
  }
  parts.push('Packages/manifest.json\n' + readFileSync(join(project, 'Packages', 'manifest.json'), 'utf8').replace(/\r\n/g, '\n'));
  return parts.join('\n\0\n');
}

export const glueKey = (project, self) => createHash('sha256').update(glueInputs(project, self)).digest('hex');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(glueKey(join(ROOT, 'unity', 'Hiraeth')) + '\n');
}
