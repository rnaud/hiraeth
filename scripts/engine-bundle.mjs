// The game's JavaScript for the engines' VMs (docs/systems/engine-bridge.md): one CommonJS file per
// entry, three.js and the game's modules inside, nothing from Node or the page.
//
//   node scripts/engine-bundle.mjs            # every entry
//   node scripts/engine-bundle.mjs spike      # one
//
// GodotJS loads CommonJS (require / exports); Puerts too (its CommonJS loader). Neither has ESM
// with top-level await across files, so the bundle is flat; the engines' own modules ('godot',
// 'csharp', 'puerts') stay outside it.
import { mkdirSync, statSync, readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sfxFiles } from '../src/sfx.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export { ENTRIES, UNICODE_CLASSES, lowerUnicodeClasses, bundle } from './engine-bundle-core.mjs';
import { ENTRIES, bundle } from './engine-bundle-core.mjs';
const WITH = { unity: ['unity-audio'] };

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
  // (the HUD's potion flask beside the hearts (src/hud.js POTION_SVG, index.html's own), for BridgeHud DrawHealth: the
  // flask on a viewBox a unit wider all round (its ink outline overhangs it), and its ink silhouette for the page's
  // drop-shadow; issue #461)
  const { POTION_SVG } = await import('../src/hud-view.js');
  const hudSrc = resolve(ROOT, 'src/hud.js');
  const flask = POTION_SVG.replace(/^<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 16 / 20}" height="${size}" viewBox="-1 -1 16 20">`);
  for (const [id, svg] of Object.entries({ 'hud-potion': flask, 'hud-potion-ink': flask.replace(/(fill|stroke)="#[0-9a-f]{6}"/gi, '$1="#2b211f"') })) {
    const out = resolve(dst, `${id}.png`);
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(hudSrc).mtimeMs) await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
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
 * The v2 traveller's models for the Unity players (issue #493): what the web build ships of data/characters/traveller-v2/
 * (scripts/traveller-v2-ship.mjs shippedFiles: the outfits' list, the base manifest and GLB, each outfit's; the base GLB
 * without the head and hair the game never draws) into StreamingAssets/hiraeth-js/public/ at the same paths, so a player
 * reads them where the page fetches them (BridgeHost.ReadPublic). Each written again only when its source is newer.
 */
export const UNITY_PUBLIC = 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-js/public';
export async function unityTravellerV2({ to = UNITY_PUBLIC } = {}) {
  const { shippedFiles, shippedBytes } = await import('./traveller-v2-ship.mjs');
  let n = 0, bytes = 0;
  for (const f of shippedFiles(ROOT)) {
    const out = resolve(ROOT, to, f);
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(resolve(ROOT, f)).mtimeMs) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, shippedBytes(f, ROOT));
    }
    n++; bytes += statSync(out).size;
  }
  const caravan = 'models/ships/caravan-a/playable.glb';
  const source = resolve(ROOT, 'public', caravan), target = resolve(ROOT, to, caravan);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(source)); n++; bytes += statSync(target).size;
  const effects = unityEffects({ to: resolve(ROOT, to, 'sfx') });
  n += effects.n; bytes += effects.bytes;

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

/** The complete assigned effect set travels with scripts, including same-name replacements. */
export function unityEffects({ to }) {
  mkdirSync(to, { recursive: true }); let n = 0, bytes = 0;
  for (const name of ['manifest.json', ...sfxFiles()]) {
    const data = readFileSync(resolve(ROOT, 'public/sfx', name));
    writeFileSync(resolve(to, name), data); n++; bytes += data.length;
  }
  return { n, bytes };
}

/**
 * The script over the air (BridgeUpdates.cs, scripts/web-update.mjs --unity <dir>): the Unity player's
 * StreamingAssets/hiraeth-js with only the compact public/sfx subset, made into `dir`: hiraeth.cjs, audio.cjs, bundle.json (updates on)
 * and the menus' pictures.
 *   node scripts/engine-bundle.mjs ota <dir>
 */
export async function unityOta(dir) {
  const to = resolve(dir);
  for (const n of ['unity', 'unity-audio']) await bundle(n, { out: [resolve(to, ENTRIES[n].out[0].split('/').pop())] });
  await unityPictures({ to: resolve(to, 'item-pictures') });
  await unityTitle({ to });
  await unityStarmap({ to: resolve(to, 'starmap') });
  unityEffects({ to: resolve(to, 'public/sfx') });
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
    const v = await unityTravellerV2(); console.log(`the v2 traveller's ${v.n} files: ${(v.bytes / 1e6).toFixed(2)} MB, in ${v.to}`);
    const b = await unityBundleJson(); console.log(`bundle.json: build ${b.build}, v${b.version}, needs player level ${b.minUnity}, updates ${b.updates ? 'on' : 'off'}`);
  }
}
