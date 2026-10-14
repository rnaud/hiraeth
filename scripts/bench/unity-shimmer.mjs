// The distant shimmer in the Unity build's pictures (issue #218; docs/systems/performance.md, "Unity on the Retroid:
// the distant shimmer"): the frames of a slow pan (the bridge's `-views <file> -pan N [-pan-step deg] -out <dir>`, each
// view turned a fixed step a frame, a picture of every frame: engine/unity/game.js) measured as the web's motion check
// measures its own (scripts/motion-check/record.mjs): per frame, the pixels whose luma went one way by over 20 levels and
// straight back (flicker, per 10 000 px), and the same over what is more than --far m off alone (the view's depth
// picture, pan-<view>-depth.png: the composite's debug view 4, pow(depth / 3000, 0.4), the sky white).
//   node scripts/bench/unity-shimmer.mjs <dir> [--far 60] [--json]
// Prints one line a view (and JSON with --json). A camera turned a third of a pixel a frame over a still world should
// flick nothing: what flicks is drawing that the pixels sample differently each frame (thin far lines, fine hatching).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const dir = argv.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const FAR = +opt('far', 60), T = 20, json = argv.includes('--json');
if (!dir) { console.error('usage: unity-shimmer.mjs <dir of pan-*.png> [--far 60] [--json]'); process.exit(2); }

/** A picture as its luma, one byte a pixel (Rec. 709 weights, as record.mjs). */
async function luma(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const Y = new Uint8Array(info.width * info.height);
  for (let i = 0, j = 0; i < Y.length; i++, j += 3) Y[i] = (data[j] * 54 + data[j + 1] * 183 + data[j + 2] * 19) >> 8;
  return { Y, w: info.width, h: info.height };
}

/** The flicker of a run of frames: events per pixel (whole, and over the mask), the mean change a frame. */
export function flicker(frames, mask) {
  const n = frames[0].length; let fl = 0, ff = 0, d1 = 0, pairs = 0, triples = 0;
  const farN = mask ? mask.reduce((a, v) => a + v, 0) : 0;
  for (let k = 1; k < frames.length; k++) {
    const b = frames[k - 1], c = frames[k], a = k >= 2 ? frames[k - 2] : null;
    for (let i = 0; i < n; i++) {
      const d = c[i] - b[i];
      d1 += d < 0 ? -d : d;
      if (a) { const e = b[i] - a[i]; if ((d > T && e < -T) || (d < -T && e > T)) { fl++; if (mask && mask[i]) ff++; } }
    }
    pairs++; if (a) triples++;
  }
  return { flick: (1e4 * fl) / (n * Math.max(triples, 1)), far: farN ? (1e4 * ff) / (farN * Math.max(triples, 1)) : 0, farShare: farN / n, change: d1 / (n * Math.max(pairs, 1)) };
}

const files = readdirSync(dir).filter((f) => /^pan-.+-\d{3}\.png$/.test(f)).sort();
const views = [...new Set(files.map((f) => f.replace(/-\d{3}\.png$/, '').slice(4)))];
const out = [];
for (const v of views) {
  const own = files.filter((f) => f.startsWith(`pan-${v}-`));
  const frames = []; let w = 0, h = 0;
  for (const f of own) { const p = await luma(join(dir, f)); frames.push(p.Y); w = p.w; h = p.h; }
  let mask = null;
  try {
    const dp = await luma(join(dir, `pan-${v}-depth.png`)), lo = Math.pow(FAR / 3000, 0.4) * 255;
    mask = new Uint8Array(dp.Y.length); for (let i = 0; i < mask.length; i++) mask[i] = dp.Y[i] > lo && dp.Y[i] < 254 ? 1 : 0;
  } catch { /* no depth picture: the whole frame only */ }
  const r = { view: v, frames: frames.length, size: `${w}x${h}`, ...flicker(frames, mask) };
  out.push(r);
  if (!json) console.log(`${v.padEnd(14)} ${String(r.frames).padStart(3)} frames  flicker ${r.flick.toFixed(1).padStart(6)} /1e4 px  far (> ${FAR} m, ${(r.farShare * 100).toFixed(0)} % of the frame) ${r.far.toFixed(1).padStart(6)}  change ${r.change.toFixed(2)}`);
}
if (json) console.log(JSON.stringify(out, null, 1));
