// The game's JavaScript for the engines' VMs (docs/systems/engine-bridge.md): one CommonJS file per
// entry, three.js and the game's modules inside, nothing from Node or the page.
//
//   node scripts/engine-bundle.mjs            # every entry
//   node scripts/engine-bundle.mjs spike      # one
//
// GodotJS loads CommonJS (require / exports); Puerts too (its CommonJS loader). Neither has ESM
// with top-level await across files, so the bundle is flat; the engines' own modules ('godot',
// 'csharp', 'puerts') stay outside it.
import { rolldown } from 'rolldown';
import { viteImportGlobPlugin } from 'rolldown/experimental';
import { mkdirSync, statSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRIES = {
  spike: { input: 'engine/godot/spike.js', out: ['godot/js/hiraeth-spike.js'] },
  godot: { input: 'engine/godot/game.js', out: ['godot/js/hiraeth.js'] },
  // (into StreamingAssets, which is not committed, like the port's exports)
  unity: { input: 'engine/unity/game.js', out: ['unity/Hiraeth/Assets/StreamingAssets/hiraeth-js/hiraeth.cjs'] },
  // the sound's renderer on Unity's audio thread (engine/unity/audio-worker.js: the Web Audio shim alone)
  'unity-audio': { input: 'engine/unity/audio-worker.js', out: ['unity/Hiraeth/Assets/StreamingAssets/hiraeth-js/audio.cjs'] },
};
/** What goes with an entry made from the command line (the Unity player needs its sound's renderer too). */
const WITH = { unity: ['unity-audio'] };

/**
 * GodotJS's V8 is built without ICU: a regular expression with a Unicode property escape
 * (`\p{L}`, `\p{N}`) is a syntax error there, and the whole bundle fails to load. Inside a
 * character class (the game's only uses: story/voice.js, story/dialogue.js, story/scripts.js) they
 * become the ranges of the scripts the game writes in (Latin, Greek, Cyrillic, Armenian, Hebrew,
 * Arabic, Devanagari, kana, CJK, Hangul) and the digits; tests/engine-bridge.test.js checks they
 * match the same characters on the game's own lines.
 */
export const UNICODE_CLASSES = {
  L: 'A-Za-z\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u0370-\\u0373\\u0376-\\u037D\\u037F-\\u03FF\\u0400-\\u0481\\u048A-\\u052F\\u0531-\\u0556\\u0561-\\u0587\\u05D0-\\u05EA\\u0620-\\u064A\\u0671-\\u06D3\\u0904-\\u0939\\u0958-\\u0961\\u1E00-\\u1FFF\\u3041-\\u3096\\u30A1-\\u30FA\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7A3',
  N: '0-9\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE\\u0660-\\u0669\\u06F0-\\u06F9\\u0966-\\u096F\\u2070-\\u2079\\u2080-\\u2089\\u2150-\\u2189\\u2460-\\u249B\\uFF10-\\uFF19',
};
export function lowerUnicodeClasses(code) {
  return code.replace(/\\p\{(L|N)\}/g, (m, k) => UNICODE_CLASSES[k]);
}
const noIcu = () => ({
  name: 'hiraeth-no-icu',
  transform(code, id) { if (!id.includes('node_modules') && code.includes('\\p{')) return { code: lowerUnicodeClasses(code), map: null }; return null; },
});

/** The page's style sheets (a module's `import './x.css'`: the minigames' runner) are nothing in an engine: its HUD is drawn from state. */
const noCss = () => ({
  name: 'hiraeth-no-css',
  load(id) { return id.endsWith('.css') ? { code: 'export {};', moduleType: 'js' } : null; },
});

export async function bundle(name, override = {}) {
  const e = { ...ENTRIES[name], ...override };
  const t0 = Date.now();
  const build = await rolldown({
    input: resolve(ROOT, e.input),
    external: ['godot', 'godot-jsb', 'csharp', 'puerts'],
    platform: 'neutral',
    // (vite's import.meta.env, and the module URLs the reference sheets resolve their pictures from)
    transform: { define: { 'import.meta.env.BASE_URL': '"./"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"engine"', 'import.meta.url': '"engine://hiraeth/src/module.js"' } },
    // (Vite's import.meta.glob, as the web build has it: src/gadgets/all.js finds every gadget so, issue #344)
    plugins: [noIcu(), noCss(), viteImportGlobPlugin({ root: ROOT })],
    logLevel: 'warn',
  });
  const out = [];
  for (const file of e.out) {   // (paths from the repository root, or absolute)
    const path = resolve(ROOT, file);
    mkdirSync(dirname(path), { recursive: true });
    await build.write({ file: path, format: 'cjs', codeSplitting: false, sourcemap: false, comments: { legal: false } });
    out.push({ file, bytes: statSync(path).size });
  }
  await build.close();
  return { name, ms: Date.now() - t0, out };
}

/**
 * The items' pictures for the Unity menus (BridgeMenu.cs: the Items panel's tiles and a thing's full view): the web's
 * public/item-pictures/<id>.webp (scripts/item-pictures.mjs) as PNGs, which Unity's Texture2D.LoadImage reads (it has no
 * WebP), at the tiles' size, into StreamingAssets/hiraeth-js/item-pictures (not committed, like the bundle).
 */
export const UNITY_PICTURES = { from: 'public/item-pictures', to: 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-js/item-pictures', size: 128 };
export async function unityPictures({ to = UNITY_PICTURES.to, size = UNITY_PICTURES.size } = {}) {
  const sharp = (await import('sharp')).default;
  const src = resolve(ROOT, UNITY_PICTURES.from), dst = resolve(ROOT, to);
  mkdirSync(dst, { recursive: true });
  let n = 0, bytes = 0;
  for (const f of readdirSync(src).filter((x) => x.endsWith('.webp'))) {
    const out = resolve(dst, f.replace(/\.webp$/, '.png'));
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(resolve(src, f)).mtimeMs) await sharp(resolve(src, f)).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(out);
    n++; bytes += statSync(out).size;
  }
  // (the shops' pictures, drawn by the page as SVGs (src/shop-panel.js): the wares' flask, heart and magic cell, the
  // chime's crystal and a fragment of the singing light, for BridgeMenu's shop cards, wallet and prices; issue #264)
  const { warePicture, CHIME_SVG, FRAGMENT_SVG } = await import('../src/shop-panel.js');
  const shopSrc = resolve(ROOT, 'src/shop-panel.js');
  for (const [id, svg] of Object.entries({ 'ware-potion': warePicture('potion'), 'ware-heart': warePicture('heart'), 'ware-magic': warePicture('magic'), 'shop-chime': CHIME_SVG, 'shop-fragment': FRAGMENT_SVG })) {
    const out = resolve(dst, `${id}.png`);
    const [, , , bw, bh] = svg.match(/viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/).map(Number), k = size / Math.max(bw, bh);
    const sized = svg.replace(/^<svg[^>]*?(viewBox="[^"]*")[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(bw * k)}" height="${Math.round(bh * k)}" $1>`);
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(shopSrc).mtimeMs) await sharp(Buffer.from(sized)).png({ compressionLevel: 9 }).toFile(out);
    n++; bytes += statSync(out).size;
  }
  return { n, bytes, to };
}

/**
 * The title's painted worlds and its lettering for the Unity title (BridgeMenu.cs, issue #346), and the Map's marks
 * (issue #343), made once as the items' pictures are, into StreamingAssets/hiraeth-js (not committed):
 *   title/<shot>.jpg   each shot's vector drawing (public/title-vectors/<id>.svg, src/title-paint.js), the covers' cream
 *                      print multiplied over it as the page's .print does (src/menus.css), 1920 × 1080
 *   title/logo.png     HIRAETH as src/title-logo.js letters it, its shadow and ink, on clear, 2048 wide
 *   map-marks/<k>.png  engine/map-marks.js's marks, 128 px
 * Each made again only when what it comes from is newer.
 */
export const UNITY_TITLE = { vectors: 'public/title-vectors', to: 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-js', w: 1920, h: 1080, logo: 2048 };
export async function unityTitle({ to = UNITY_TITLE.to } = {}) {
  const sharp = (await import('sharp')).default;
  const { logoSvg } = await import('../src/title-logo.js');
  const { MAP_MARKS } = await import('../engine/map-marks.js');
  const src = resolve(ROOT, UNITY_TITLE.vectors), dir = resolve(ROOT, to, 'title'), marks = resolve(ROOT, to, 'map-marks');
  mkdirSync(dir, { recursive: true }); mkdirSync(marks, { recursive: true });
  const stale = (out, ...from) => !existsSync(out) || from.some((f) => statSync(out).mtimeMs < statSync(f).mtimeMs);
  const { w, h } = UNITY_TITLE;
  // (the print: the cover's paper, a soft cream radial wash, multiplied over the drawing)
  const print = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="p" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#fbf1dc"/><stop offset="1" stop-color="#f1dfbb"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#p)"/></svg>`);
  let n = 0, bytes = 0;
  for (const f of readdirSync(src).filter((x) => x.endsWith('.svg'))) {
    const out = resolve(dir, f.replace(/\.svg$/, '.jpg'));
    if (stale(out, resolve(src, f), fileURLToPath(import.meta.url))) {
      const art = await sharp(resolve(src, f), { density: 150 }).resize(w, h, { fit: 'cover' }).png().toBuffer();
      await sharp(art).composite([{ input: print, blend: 'multiply' }]).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
    }
    n++; bytes += statSync(out).size;
  }
  const logo = resolve(dir, 'logo.png');
  if (stale(logo, resolve(ROOT, 'src/title-logo.js'))) await sharp(Buffer.from(logoSvg()), { density: 72 }).resize({ width: UNITY_TITLE.logo }).png({ compressionLevel: 9 }).toFile(logo);
  bytes += statSync(logo).size;
  for (const [k, m] of Object.entries(MAP_MARKS)) {
    const out = resolve(marks, `${k}.png`);
    if (stale(out, resolve(ROOT, 'engine/map-marks.js'))) await sharp(Buffer.from(m.svg)).png({ compressionLevel: 9 }).toFile(out);
    bytes += statSync(out).size;
  }
  return { n, marks: Object.keys(MAP_MARKS).length, bytes, to };
}

/**
 * The galactic map's pictures for the Unity menus (BridgeMenu.StarMap.cs, engine/starmap.js), made once as the title's:
 *   starmap/planet-<id>.png   each world's planet as the page draws it (src/ship/planets.js planetSvg), its viewBox opened
 *                             to ±80 so the rings and the moons that overhang its ±50 disc are in it, 256 px
 *   starmap/star.png          the star at the chart's edge (src/ship/starmap.js starSvg, r 44 as the 1280 × 720 chart has it), ±80
 *   starmap/glyph.png, glyph-ink.png   the light's signature (the makers' mark, SIG_GLYPH) in the chart's lilac and the panel's ink
 */
export const UNITY_STARMAP = { to: 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-js/starmap', px: 256 };
export async function unityStarmap({ to = UNITY_STARMAP.to } = {}) {
  const sharp = (await import('sharp')).default;
  const { planetSvg, PLANETS } = await import('../src/ship/planets.js');
  const { starSvg, SIG_GLYPH } = await import('../src/ship/starmap.js');
  const dir = resolve(ROOT, to);
  mkdirSync(dir, { recursive: true });
  const from = ['src/ship/planets.js', 'src/ship/starmap.js', 'src/makers-mark/design.js'].map((f) => resolve(ROOT, f));
  const stale = (out) => !existsSync(out) || from.some((f) => statSync(out).mtimeMs < statSync(f).mtimeMs);
  const px = UNITY_STARMAP.px, svg = (inner, box = '-80 -80 160 160') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${box}">${inner}</svg>`);
  let n = 0, bytes = 0;
  const put = async (name, buf) => { const out = resolve(dir, name); if (stale(out)) await sharp(buf, { density: 144 }).resize(px, px).png({ compressionLevel: 9 }).toFile(out); n++; bytes += statSync(out).size; };
  for (const id of [...Object.keys(PLANETS), '_']) await put(`planet-${id}.png`, svg(planetSvg(id).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')));
  await put('star.png', svg(starSvg({ x: 0, y: 0, r: 44 })));
  for (const [name, col] of [['glyph.png', '#cdb4ff'], ['glyph-ink.png', '#6a4aa8']]) {
    const g = SIG_GLYPH.replace(/ width="[^"]*" height="[^"]*"/, ` width="${px * 0.75}" height="${px}" xmlns="http://www.w3.org/2000/svg"`).replace('fill="currentColor"', `fill="${col}"`);
    const out = resolve(dir, name);
    if (stale(out)) await sharp(Buffer.from(g), { density: 144 }).resize(px * 0.75, px).png({ compressionLevel: 9 }).toFile(out);
    n++; bytes += statSync(out).size;
  }
  return { n, bytes, to };
}

/**
 * The Unity script's bundle.json beside hiraeth.cjs (release-info.mjs unityBundleInfo: the build, version and player
 * it needs; BridgeUpdates.cs reads it): a player compares a downloaded script with the one it carries by it. `updates`
 * (a player that looks for updates over the air): the published builds, made in GitHub Actions or with UNITY_OTA=1; a
 * local build keeps the script it was built with (UNITY_OTA=0 turns it off in CI too).
 */
export async function unityBundleJson(dir = dirname(resolve(ROOT, ENTRIES.unity.out[0])), { updates = process.env.UNITY_OTA ? process.env.UNITY_OTA === '1' : process.env.GITHUB_ACTIONS === 'true' } = {}) {
  const { gameBuild, unityBundleInfo } = await import('./release-info.mjs');
  const { CHANGELOG } = await import('../src/changelog.js');
  let build = 0;
  try { build = gameBuild(); } catch (e) { console.warn(`bundle.json: no build number (${e.message}): 0, every downloaded script is newer`); }
  const info = unityBundleInfo({ build, version: CHANGELOG[0].v, updates });
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'bundle.json'), JSON.stringify(info) + '\n');
  return info;
}

/**
 * The script over the air (BridgeUpdates.cs, scripts/web-update.mjs --unity <dir>): the Unity player's
 * StreamingAssets/hiraeth-js without its public/ folder, made into `dir`: hiraeth.cjs, audio.cjs, bundle.json (updates on)
 * and the menus' pictures.
 *   node scripts/engine-bundle.mjs ota <dir>
 */
export async function unityOta(dir) {
  const to = resolve(dir);
  for (const n of ['unity', 'unity-audio']) await bundle(n, { out: [resolve(to, ENTRIES[n].out[0].split('/').pop())] });
  await unityPictures({ to: resolve(to, 'item-pictures') });
  await unityTitle({ to });
  await unityStarmap({ to: resolve(to, 'starmap') });
  return unityBundleJson(to, { updates: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'ota') {
  if (!process.argv[3]) throw new Error('node scripts/engine-bundle.mjs ota <dir>');
  const info = await unityOta(process.argv[3]);
  console.log(`the Unity script over the air in ${process.argv[3]}: build ${info.build}, v${info.version}, needs player level ${info.minUnity}`);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const asked = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ENTRIES);
  const names = [...new Set(asked.flatMap((n) => [n, ...(WITH[n] ?? [])]))];
  for (const n of names) {
    const r = await bundle(n);
    console.log(`${r.name}: ${r.out.map((o) => `${o.file} ${(o.bytes / 1e6).toFixed(2)} MB`).join(', ')} (${r.ms} ms)`);
  }
  if (names.includes('unity')) {
    const p = await unityPictures(); console.log(`the items' pictures: ${p.n} PNGs, ${(p.bytes / 1e6).toFixed(2)} MB, in ${p.to}`);
    const q = await unityTitle(); console.log(`the title's ${q.n} pictures, its lettering and the Map's ${q.marks} marks: ${(q.bytes / 1e6).toFixed(2)} MB, in ${q.to}`);
    const m = await unityStarmap(); console.log(`the galactic map's ${m.n} pictures: ${(m.bytes / 1e6).toFixed(2)} MB, in ${m.to}`);
    const b = await unityBundleJson(); console.log(`bundle.json: build ${b.build}, v${b.version}, needs player level ${b.minUnity}, updates ${b.updates ? 'on' : 'off'}`);
  }
}
