// The Surface shader's combinations left out of Android's Unity builds (issue #703; BridgeShaderStrip.NeverOnAndroid,
// docs/systems/unity.md "Android: Vulkan only, and the variants never asked for"): what BridgeRenderer.Lean can ask for on
// Android is derived here from the code (each guard it relies on checked in the C#), and no strip rule may match any of it.
// Android is Vulkan only: no OpenGL ES 3 in the settings, the build scripts or the CI workflow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../unity/Hiraeth/', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const shader = read('Assets/Hiraeth/Shaders/Surface.shader');
const renderer = read('Assets/HiraethJS/Runtime/BridgeRenderer.cs');
const loader = read('Assets/Hiraeth/Runtime/WorldLoader.cs');
const strip = read('Assets/HiraethJS/Editor/BridgeShaderStrip.cs');

const LEANS = ['HIRAETH_LEAN', 'HIRAETH_LEAN_TERRAIN', 'HIRAETH_LEAN_WATER', 'HIRAETH_LEAN_SLIM', 'HIRAETH_LEAN_SCRUB', 'HIRAETH_LEAN_GLASS'];
const GROUP = ['HIRAETH_CROWD', 'HIRAETH_PUFFS', 'HIRAETH_INSTMAT', 'HIRAETH_GRASS', 'HIRAETH_FLORA', 'HIRAETH_VMAT', 'HIRAETH_SKIN'];

function csFiles(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) csFiles(p, out); else if (f.endsWith('.cs')) out.push(p);
  }
  return out;
}
const sources = csFiles(join(root, 'Assets')).filter((p) => !p.includes('/Gen/')).map((p) => [p.slice(root.length), readFileSync(p, 'utf8')]);
const leanBody = renderer.split('static void Lean(Material m)')[1].split('/// <summary>How many of the full variant')[0];

// The strip rules as BridgeShaderStrip reads them: +K all, ?K at least one, -K none.
const rules = [...strip.split('public static readonly string[] NeverOnAndroid =')[1].split('};')[0].matchAll(/"([^"]+)"/g)].map((m) => m[1].split(' '));
const matches = (set, rule) => {
  let anyWanted = false, any = false;
  for (const t of rule) {
    const on = set.has(t.slice(1));
    if (t[0] === '+' && !on) return false;
    if (t[0] === '-' && on) return false;
    if (t[0] === '?') { anyWanted = true; any ||= on; }
  }
  return !anyWanted || any;
};

test('the shader\'s keyword sets are the ones the rules are written for', () => {
  assert.match(shader, new RegExp(`#pragma multi_compile_local _ ${GROUP.join(' ')}\\n`));
  assert.match(shader, new RegExp(`#pragma multi_compile_local _ ${LEANS.join(' ')}\\n`));
  assert.match(shader, /#pragma multi_compile_local_fragment _ HIRAETH_PLAIN\n/);
  assert.equal(rules.length, 3);
  for (const r of rules) for (const t of r) assert.ok([...LEANS, ...GROUP, 'HIRAETH_PLAIN'].includes(t.slice(1)) && '+?-'.includes(t[0]), t);
  // (Android only, and a switch to keep them for a test build)
  assert.match(strip, /bool android = EditorUserBuildSettings\.activeBuildTarget == BuildTarget\.Android && !BridgeArgs\.Flag\("-keep-unasked"\);/);
  assert.match(strip, /if \(android\) \{ bool never = false; foreach \(var r in NeverOnAndroid\) never \|= Matches\(shader, fk, r\); if \(never\) \{ data\.RemoveAt\(i\); continue; \} \}/);
});

test('only Lean gives the lean and plain keywords, and only WorldLoader.MakeMaterial a skin, before Lean', () => {
  for (const [p, s] of sources) {
    if (p.endsWith('BridgeShaderStrip.cs')) continue;
    for (const m of s.matchAll(/EnableKeyword\(([^)]*)\)/g)) {
      const arg = m[1].trim();
      const k = arg.replace(/"/g, '');
      if (LEANS.includes(k) || k === 'HIRAETH_PLAIN') {
        assert.ok(p.endsWith('BridgeRenderer.cs'), `${k} in ${p}`);
        const at = s.indexOf(m[0], m.index);
        const inLean = leanBody.includes(m[0]);
        const inUnslim = s.slice(s.indexOf('static void Unslim'), s.indexOf('static void Unslim') + 300).includes(m[0]);
        assert.ok(inLean || inUnslim, `${k} at ${at}`);
      }
      if (k === 'HIRAETH_SKIN') assert.ok(p.endsWith('WorldLoader.cs'), `HIRAETH_SKIN in ${p}`);
      // (a keyword named by a variable: Lean's kw, or a global keyword, which can't set the shader's local ones)
      if (!arg.startsWith('"')) assert.ok((p.endsWith('BridgeRenderer.cs') && arg === 'kw') || /Shader\.EnableKeyword\(k\)|cmd\.EnableKeyword\(PrepassKeyword\)/.test(s.slice(m.index - 12, m.index + m[0].length)), `${arg} in ${p}`);
    }
    for (const m of s.matchAll(/shaderKeywords\s*=\s*([^;]+);/g)) assert.equal(m[1].trim(), 'System.Array.Empty<string>()', p);
  }
  assert.equal((loader.match(/EnableKeyword\("HIRAETH_SKIN"\)/g) ?? []).length, 1);
  // (the skin's keyword is set in MakeMaterial, which every material Lean sees is made by: the port's materials and the prewarm's)
  const make = loader.split('public static Material MakeMaterial(')[1].split('\n        }\n')[0];
  assert.ok(make.includes('mat.EnableKeyword("HIRAETH_SKIN")'));
  assert.match(renderer, /var mat = WorldLoader\.MakeMaterial\(surface \? surface : Shader\.Find\("Hiraeth\/Surface"\), m\);\n\s+Lean\(mat\);/);
  // (the copies keep their material's keywords: Unslim only trades the slim one for the lean one)
  assert.match(renderer, /static void Unslim\(Material c\)\n\s+\{\n\s+if \(c\.IsKeywordEnabled\("HIRAETH_LEAN_SLIM"\)\) \{ c\.DisableKeyword\("HIRAETH_LEAN_SLIM"\); c\.EnableKeyword\("HIRAETH_LEAN"\); \}\n\s+\}/);
});

// Lean's decisions, each guard checked in the C# before it is modelled.
function leanOutcomes() {
  assert.match(leanBody, /^\s*\{\n\s+if \(!lean \|\| !m \|\| m\.shader == null \|\| !m\.shader\.name\.StartsWith\("Hiraeth\/Surface"\) \|\| !m\.HasProperty\("_Mode"\)\) return;\n\s+\/\/[^\n]*\n\s+if \(m\.IsKeywordEnabled\("HIRAETH_SKIN"\)\) \{[^}]*return; \}/);
  assert.match(leanBody, /if \(m\.IsKeywordEnabled\("HIRAETH_FIGHT"\)\) \{[^}]*return; \}/);
  assert.match(leanBody, /string kw = why != null \? null : mode == 1 \? "HIRAETH_LEAN_TERRAIN" : mode == 3 \? "HIRAETH_LEAN_WATER" : "HIRAETH_LEAN";/);
  assert.match(leanBody, /kw = why == "scrub" \? \(leanScrub \? "HIRAETH_LEAN_SCRUB" : null\) : \(leanGlass \? "HIRAETH_LEAN_GLASS" : null\);/);
  assert.match(leanBody, /bool plainOk = kw != null && plain && /);
  assert.match(leanBody, /if \(kw == "HIRAETH_LEAN" && slim && \(!plainOk \|\| slimOnPlain\) && Slim\(m, mode\)\) kw = "HIRAETH_LEAN_SLIM";/);
  assert.match(leanBody, /if \(kw != null\) \{ m\.EnableKeyword\(kw\);/);
  assert.match(leanBody, /if \(plainOk\)\n\s+\{\n\s+m\.EnableKeyword\("HIRAETH_PLAIN"\);/);
  assert.equal((leanBody.match(/EnableKeyword/g) ?? []).length, 2);
  assert.match(renderer, /public static string\[\] slimNot; public static bool slimNoCopies = true, slimOnPlain;/);   // (off unless -slim-on-plain)
  const out = new Set();
  const add = (kws) => out.add(JSON.stringify(kws.filter(Boolean).sort()));
  add([]);   // (lean off, -one-variant, not the port's Surface, a skin, a foe)
  for (const why of [null, 'rare', 'scrub', 'glass'])
    for (const mode of [0, 1, 3])
      for (const leanRare of [false, true]) for (const one of [false, true]) for (const on of [false, true])
        for (const plainFits of [false, true]) for (const slim of [false, true]) for (const slimFits of [false, true]) for (const copy of [false, true]) {
          let kw = why != null ? null : mode === 1 ? 'HIRAETH_LEAN_TERRAIN' : mode === 3 ? 'HIRAETH_LEAN_WATER' : 'HIRAETH_LEAN';
          if (leanRare && (why === 'scrub' || why === 'glass') && mode !== 1 && mode !== 3 && one) kw = on ? (why === 'scrub' ? 'HIRAETH_LEAN_SCRUB' : 'HIRAETH_LEAN_GLASS') : null;
          const plainOk = kw != null && plainFits;
          const slimOnPlain = false;
          if (kw === 'HIRAETH_LEAN' && slim && (!plainOk || slimOnPlain) && slimFits) kw = 'HIRAETH_LEAN_SLIM';
          if (copy && kw === 'HIRAETH_LEAN_SLIM') kw = 'HIRAETH_LEAN';
          add([kw, plainOk && 'HIRAETH_PLAIN']);
        }
  return [...out].map((s) => JSON.parse(s));
}

test('no rule leaves out a combination Lean can ask for on Android', () => {
  const outcomes = leanOutcomes();
  // (what can be asked for: every lean keyword, alone or plain, but the slim one never plain, and plain never alone)
  assert.equal(outcomes.length, 7 + 5);
  const requested = [];
  for (const g of [null, ...GROUP]) for (const o of outcomes) {
    if (g === 'HIRAETH_SKIN' && o.length) continue;   // (a skin: Lean returns before any keyword)
    requested.push(new Set([g, ...o].filter(Boolean)));
  }
  for (const set of requested) for (const r of rules) assert.ok(!matches(set, r), `${[...set].join(' ')} matches ${r.join(' ')}`);
});

test('the rules leave out 54 of the G-buffer pass\'s Vulkan variants', () => {
  let dropped = 0, all = 0;
  for (const g of [null, ...GROUP]) for (const l of [null, ...LEANS]) for (const p of [null, 'HIRAETH_PLAIN']) {
    const set = new Set([g, l, p].filter(Boolean));
    all++;
    if (rules.some((r) => matches(set, r))) dropped++;
  }
  assert.equal(all, 112);
  assert.equal(dropped * 2, 54);   // (× 2: with and without HIRAETH_PREPASS; the foes' variants were left out already)
});

test('Android is Vulkan only', () => {
  const settings = read('ProjectSettings/ProjectSettings.asset');
  assert.match(settings, /- m_BuildTarget: AndroidPlayer\n\s+m_APIs: 15000000i\n\s+m_Automatic: 0/);
  for (const p of ['Assets/HiraethJS/Editor/BridgeBuild.cs', 'Assets/Hiraeth/Editor/BenchBuild.cs']) {
    const s = read(p);
    assert.match(s, /PlayerSettings\.SetGraphicsAPIs\(BuildTarget\.Android, new\[\] \{ GraphicsDeviceType\.Vulkan \}\);/, p);
    assert.ok(!/BuildTarget\.Android[^\n]*OpenGLES3/.test(s), p);
  }
  // (with Vulkan alone Unity writes <uses-feature android:name="android.hardware.vulkan.version" android:required="true" />
  // into the manifest itself: seen in the APK built for #703, aapt2 dump xmltree)
  const ci = readFileSync(new URL('../.github/workflows/unity-android.yml', import.meta.url), 'utf8');
  assert.ok(!/gles|opengl/i.test(ci));
});
