// Development switches for measuring the surface patterns (issue #694, docs/audits/perf-materials-v2.31.md): each of the
// patterns of #669–#693 drawn or not, so a frame can be timed with and without it. Web only, never in a player's game.
//
//   ?marks=0                  every pattern below off (each material compiled without its define, the machined finish
//                             returning before it draws); the painted relief has its own ?relief=0 (main.js)
//   ?marksOff=paving,mk       only those off (names: MARK_NAMES)
//   ?marksAb=1                nothing off, but the machined finish compiled with its switch, so window.__marks(list)
//                             (main.js) can turn any of them off and on again in the page (an A/B at one view)
// Off, a material simply lacks the define (surfaceFeatures's), so its program is the one it would have had before the
// pattern landed; the machined finish (src/temples/skins/machined.js mkFinish, in the skins' own text) is cut by MK_OFF,
// a define spliceSkin guards it with only while one of these switches is in the address.

export const MARK_DEFINES = { paving: 'S_PAVING', interior: 'S_INTERIOR', sheet: 'S_SHEET', timber: 'S_TIMBER', groundmid: 'S_GROUNDMID',
  seawall: 'S_SEAWALL', palestone: 'S_PALESTONE', buried: 'S_BURIED', domes: 'S_DOMES', channel: 'S_CHANNEL', rocktop: 'S_ROCKTOP',
  crystal: 'S_CRYSTAL', beds: 'S_BEDS' };
export const MARK_NAMES = [...Object.keys(MARK_DEFINES), 'mk'];

/** A list of names ('all' / '0': every one) → the Set of them. */
export function marksList(s) {
  if (s == null || s === '' || s === '1') return new Set();
  const names = String(s).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (names.includes('all') || names.includes('0')) return new Set(MARK_NAMES);
  return new Set(names.filter((n) => MARK_NAMES.includes(n)));
}

/** The address's switches: { off: Set, guard: bool } (nothing off and no guard outside a browser, or with none in it). */
export function marksFromSearch(search) {
  const q = new URLSearchParams(search ?? '');
  const off = q.has('marksOff') ? marksList(q.get('marksOff')) : q.get('marks') === '0' ? new Set(MARK_NAMES) : new Set();
  return { off, guard: q.has('marks') || q.has('marksOff') || q.has('marksAb') };
}

const SEARCH = typeof location !== 'undefined' && typeof location.search === 'string' ? location.search : '';
export const MARKS = marksFromSearch(SEARCH);

/** A surface material's defines without the patterns in `off` (MK_OFF added for the machined finish). */
export function marksDefines(defines, off) {
  if (!off?.size || !defines?.SURFACE_SPEC) return defines;
  const d = { ...defines };
  for (const n of off) if (MARK_DEFINES[n]) delete d[MARK_DEFINES[n]];
  if (off.has('mk')) d.MK_OFF = 1;
  return d;
}

/** The machined finish's text, with its switch when one of the address's switches is set. */
export const MK_GUARD = '\n#ifdef MK_OFF\n    return 0.0;\n#endif\n';
export function guardMk(fs, guard = MARKS.guard) {
  if (!guard) return fs;
  return fs.replace(/(float mkFinish\([^)]*\)\s*\{)/, `$1${MK_GUARD}`);
}

/** In the page: every surface material under root drawn with the patterns of `list` off (the others on). → materials changed. */
export function setMarksOff(root, list) {
  const off = list instanceof Set ? list : marksList(list);
  let n = 0;
  root.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m?.defines?.SURFACE_SPEC) continue;
      m.userData.marksBase ??= { ...m.defines };
      const d = marksDefines(m.userData.marksBase, off);
      const a = Object.keys(d).join(), b = Object.keys(m.defines).join();
      if (a !== b) { m.defines = d === m.userData.marksBase ? { ...d } : d; m.needsUpdate = true; n++; }
    }
  });
  return n;
}
