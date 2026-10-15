#!/usr/bin/env node
// The letters an engine's canvas writes with (engine/raster.js fillText, docs/systems/engine-bridge.md "Canvas
// textures"): the outlines of a few open fonts read from their TrueType files and written as small paths into
// engine/glyphs.js, so the game's canvases (the ship's console screen, the signs, the boards) are lettered in the
// VMs, where no font can be asked of the system. The fonts (Apache License 2.0), as the web's stacks fall back to them:
//   sans, sansBold, sansBlack   Roboto Regular, Bold, Black (FACE and TITLE_FACE list Roboto)
//   mono, monoBold              Roboto Mono Regular, Bold (MONO_FACE: the console's screen, the Arcade's board)
// Run once, on a machine with Unity 6 (its editor carries both); the output is committed:
//   node scripts/engine-glyphs.mjs [--unity /Applications/Unity/Hub/Editor/<v>/Unity.app] [--roboto <dir of Roboto-*.ttf>]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

/** The characters kept: printable ASCII and the few others the canvases and their labels use. */
export const CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + '·—–…’‘“”éèêàâçôöüïî×°';

function findUnity() {
  const hub = '/Applications/Unity/Hub/Editor';
  if (arg('--unity')) return arg('--unity');
  if (!existsSync(hub)) return null;
  const v = readdirSync(hub).sort().reverse().find((d) => existsSync(join(hub, d, 'Unity.app/Contents/Resources/Fonts/RobotoMono-Regular.ttf')));
  return v ? join(hub, v, 'Unity.app') : null;
}
function findRoboto() {
  if (arg('--roboto')) return arg('--roboto');
  // (the Searcher package's own copy, in any Unity project's package cache)
  for (const base of [join(ROOT, 'unity/Hiraeth/Library/PackageCache'), '/Users/anf/projects/moebius/unity/Hiraeth/Library/PackageCache']) {
    if (!existsSync(base)) continue;
    const d = readdirSync(base).find((x) => x.startsWith('com.unity.searcher@'));
    if (d && existsSync(join(base, d, 'Editor/Resources/FlatSkin/Font/Roboto-Regular.ttf'))) return join(base, d, 'Editor/Resources/FlatSkin/Font');
  }
  return null;
}

// ------------------------------------------------------------------ a TrueType file
export function parseTTF(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o) => dv.getUint16(o), i16 = (o) => dv.getInt16(o), u32 = (o) => dv.getUint32(o);
  const tables = {};
  const n = u16(4);
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; tables[String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3])] = { off: u32(o + 8), len: u32(o + 12) }; }
  const head = tables.head.off, upm = u16(head + 18), locFormat = i16(head + 50);
  const hhea = tables.hhea.off, ascent = i16(hhea + 4), descent = i16(hhea + 6), nH = u16(hhea + 34);
  const numGlyphs = u16(tables.maxp.off + 4);
  const hmtx = tables.hmtx.off;
  const advance = (g) => u16(hmtx + Math.min(g, nH - 1) * 4);
  const loca = tables.loca.off, glyf = tables.glyf.off;
  const at = (g) => (locFormat ? u32(loca + g * 4) : u16(loca + g * 2) * 2);
  // cmap: format 4 (BMP), or 12
  const cmap = tables.cmap.off, map = new Map();
  let sub = null;
  for (let i = 0; i < u16(cmap + 2); i++) {
    const o = cmap + 4 + i * 8, pid = u16(o), eid = u16(o + 2), off = u32(o + 4), fmt = u16(cmap + off);
    if ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) if (!sub || fmt === 12) sub = { off: cmap + off, fmt };
  }
  if (sub.fmt === 4) {
    const s = sub.off, segX2 = u16(s + 6), ends = s + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      const end = u16(ends + i * 2), start = u16(starts + i * 2), delta = i16(deltas + i * 2), ro = u16(ranges + i * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (!ro) g = (c + delta) & 0xffff;
        else { const p = ranges + i * 2 + ro + (c - start) * 2; g = u16(p); if (g) g = (g + delta) & 0xffff; }
        if (g) map.set(c, g);
      }
    }
  } else if (sub.fmt === 12) {
    const s = sub.off, ng = u32(s + 12);
    for (let i = 0; i < ng; i++) { const o = s + 16 + i * 12, a = u32(o), b = u32(o + 4), g0 = u32(o + 8); for (let c = a; c <= b; c++) map.set(c, g0 + c - a); }
  }
  /** A glyph's contours: [[{ x, y, on }]], composites resolved. */
  function contours(g, depth = 0) {
    if (g >= numGlyphs || depth > 6) return [];
    const o0 = at(g), o1 = at(g + 1);
    if (o1 <= o0) return [];
    const o = glyf + o0, nc = i16(o);
    if (nc >= 0) {
      const endPts = []; for (let i = 0; i < nc; i++) endPts.push(u16(o + 10 + i * 2));
      const np = nc ? endPts[nc - 1] + 1 : 0;
      let p = o + 10 + nc * 2; p += 2 + u16(p);
      const flags = [];
      while (flags.length < np) { const f = buf[p++]; flags.push(f); if (f & 8) { let r = buf[p++]; while (r--) flags.push(f); } }
      const xs = [], ys = [];
      let x = 0; for (const f of flags) { if (f & 2) { const d = buf[p++]; x += f & 16 ? d : -d; } else if (!(f & 16)) { x += i16(p); p += 2; } xs.push(x); }
      let y = 0; for (const f of flags) { if (f & 4) { const d = buf[p++]; y += f & 32 ? d : -d; } else if (!(f & 32)) { y += i16(p); p += 2; } ys.push(y); }
      const out = []; let s = 0;
      for (const e of endPts) { const c = []; for (let i = s; i <= e; i++) c.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) }); out.push(c); s = e + 1; }
      return out;
    }
    // a composite: its parts, each moved (and scaled)
    const out = [];
    let p = o + 10, more = true;
    while (more) {
      const fl = u16(p), gi = u16(p + 2); p += 4;
      let dx, dy;
      if (fl & 1) { dx = i16(p); dy = i16(p + 2); p += 4; } else { dx = (buf[p] << 24) >> 24; dy = (buf[p + 1] << 24) >> 24; p += 2; }
      let a = 1, b = 0, c = 0, d = 1;
      const f2 = (q) => i16(q) / 16384;
      if (fl & 8) { a = d = f2(p); p += 2; } else if (fl & 0x40) { a = f2(p); d = f2(p + 2); p += 4; } else if (fl & 0x80) { a = f2(p); b = f2(p + 2); c = f2(p + 4); d = f2(p + 6); p += 8; }
      if (!(fl & 2)) { dx = 0; dy = 0; }   // (points matched by index: not used by these fonts' letters)
      for (const k of contours(gi, depth + 1)) out.push(k.map((q) => ({ x: a * q.x + c * q.y + dx, y: b * q.x + d * q.y + dy, on: q.on })));
      more = !!(fl & 0x20);
    }
    return out;
  }
  return { upm, ascent, descent, glyph: (ch) => { const g = map.get(ch.codePointAt(0)); return g === undefined ? null : { adv: advance(g), contours: contours(g) }; } };
}

/** A glyph's contours as a path: M x y, L x y, Q cx cy x y, Z (font units, y up), the implied on-points made. */
export function contourPath(cs) {
  const parts = [];
  for (const c of cs) {
    if (!c.length) continue;
    // start on an on-curve point (or the middle of two off ones)
    let k = c.findIndex((q) => q.on);
    let pts = c;
    if (k < 0) { const m = { x: (c[0].x + c[1 % c.length].x) / 2, y: (c[0].y + c[1 % c.length].y) / 2, on: true }; pts = [m, ...c.slice(1), c[0]]; k = 0; }
    else pts = [...c.slice(k), ...c.slice(0, k)];
    const r = (v) => Math.round(v);
    parts.push(`M${r(pts[0].x)} ${r(pts[0].y)}`);
    const n = pts.length;
    for (let i = 1; i <= n; i++) {
      const q = pts[i % n];
      if (q.on) { parts.push(`L${r(q.x)} ${r(q.y)}`); continue; }
      const nx = pts[(i + 1) % n];
      const end = nx.on ? nx : { x: (q.x + nx.x) / 2, y: (q.y + nx.y) / 2 };
      parts.push(`Q${r(q.x)} ${r(q.y)} ${r(end.x)} ${r(end.y)}`);
      if (nx.on) i++;
    }
    parts.push('Z');
  }
  return parts.join('');
}

/** Letters a font lacks but the canvases write (the console's "● PLAYBACK"): drawn here, in its units. */
function extras(upm) {
  const xh = upm * 0.52, r = upm * 0.3, cx = upm * 0.36, cy = xh * 0.6;
  const circle = (cx, cy, r) => { const n = 24, p = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; p.push(`${i ? 'L' : 'M'}${Math.round(cx + Math.cos(a) * r)} ${Math.round(cy + Math.sin(a) * r)}`); } return p.join('') + 'Z'; };
  return {
    '●': [Math.round(upm * 0.72), circle(cx, cy, r)],
    '◆': [Math.round(upm * 0.72), `M${cx} ${Math.round(cy - r)}L${Math.round(cx + r)} ${Math.round(cy)}L${cx} ${Math.round(cy + r)}L${Math.round(cx - r)} ${Math.round(cy)}Z`],
    '✦': [Math.round(upm * 0.72), `M${cx} ${Math.round(cy - r)}L${Math.round(cx + r * 0.25)} ${Math.round(cy - r * 0.25)}L${Math.round(cx + r)} ${Math.round(cy)}L${Math.round(cx + r * 0.25)} ${Math.round(cy + r * 0.25)}L${cx} ${Math.round(cy + r)}L${Math.round(cx - r * 0.25)} ${Math.round(cy + r * 0.25)}L${Math.round(cx - r)} ${Math.round(cy)}L${Math.round(cx - r * 0.25)} ${Math.round(cy - r * 0.25)}Z`],
    '♥': [Math.round(upm * 0.72), `M${cx} ${Math.round(cy - r)}L${Math.round(cx + r)} ${Math.round(cy + r * 0.2)}Q${Math.round(cx + r)} ${Math.round(cy + r)} ${Math.round(cx + r * 0.5)} ${Math.round(cy + r)}Q${cx} ${Math.round(cy + r)} ${cx} ${Math.round(cy + r * 0.45)}Q${cx} ${Math.round(cy + r)} ${Math.round(cx - r * 0.5)} ${Math.round(cy + r)}Q${Math.round(cx - r)} ${Math.round(cy + r)} ${Math.round(cx - r)} ${Math.round(cy + r * 0.2)}Z`],
  };
}

/** A face's letters at 1000 units an em (shorter numbers than the files' 2048). */
function face(file, upm = 1000) {
  const F = parseTTF(readFileSync(file)), k = upm / F.upm;
  const glyphs = {};
  for (const ch of CHARS) {
    const g = F.glyph(ch);
    if (g) glyphs[ch] = [Math.round(g.adv * k), contourPath(g.contours.map((c) => c.map((q) => ({ x: q.x * k, y: q.y * k, on: q.on }))))];
  }
  for (const [ch, g] of Object.entries(extras(upm))) if (!glyphs[ch] || !glyphs[ch][1]) glyphs[ch] = g;
  return { upm, ascent: Math.round(F.ascent * k), descent: Math.round(F.descent * k), glyphs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const unity = findUnity(), roboto = findRoboto();
  if (!unity || !roboto) { console.error(`fonts not found (Unity: ${unity}, Roboto: ${roboto}); pass --unity and --roboto`); process.exit(1); }
  const fonts = join(unity, 'Contents/Resources/Fonts');
  const out = {
    about: 'Glyph outlines for the engines\' canvases (engine/raster.js), from Roboto and Roboto Mono (Apache License 2.0, Google): scripts/engine-glyphs.mjs',
    faces: {
      sans: face(join(roboto, 'Roboto-Regular.ttf')), sansBold: face(join(roboto, 'Roboto-Bold.ttf')), sansBlack: face(join(roboto, 'Roboto-Black.ttf')),
      mono: face(join(fonts, 'RobotoMono-Regular.ttf')), monoBold: face(join(fonts, 'RobotoMono-Bold.ttf')),
    },
  };
  const file = join(ROOT, 'engine/glyphs.js');
  writeFileSync(file, `// ${out.about}. Generated: do not edit.\n/* eslint-disable */\nexport const GLYPHS = ${JSON.stringify(out.faces)};\n`);
  console.log(`${file}: ${(JSON.stringify(out).length / 1024).toFixed(0)} kB, ${Object.keys(out.faces.sans.glyphs).length} letters a face`);
}
